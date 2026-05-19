// V23.0.0 — Servidor Node com autenticação, sincronização de state com
// Postgres (Railway) e snapshots automáticos.
//
// Arquitetura:
//   - Pool Postgres compartilhado via req.db (lazy init na primeira request)
//   - Migrations automáticas no startup
//   - Auth middleware: rotas /api/auth-login, /api/auth-register e
//     /api/auth-me são abertas; demais /api/* exigem JWT válido
//   - Handlers em ./api/*.js recebem (req, res) — req tem db, user, body
//
// Env vars necessárias:
//   DATABASE_URL          conexão Postgres (Railway provê)
//   JWT_SECRET            secret pra assinar tokens (32+ chars random)
//   MASTER_USERNAME       email do master
//   MASTER_PASSWORD       senha do master (texto puro, hash gerado no startup)
const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json({ limit: '5mb' })); // state pode ser grande
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// V23.0.0 — Pool Postgres único, compartilhado entre handlers.
// SSL habilitado para Railway (rejectUnauthorized=false aceita certs auto-assinados).
const pgPool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5
    })
  : null;

if (!pgPool) {
  console.warn('[server] DATABASE_URL ausente — sync remoto desabilitado.');
}

// V23.0.0 — JWT secret + segredos do master vindos de env vars.
const JWT_SECRET = process.env.JWT_SECRET || '';
const MASTER_USERNAME = process.env.MASTER_USERNAME || '';
const MASTER_PASSWORD = process.env.MASTER_PASSWORD || '';
let MASTER_PASSWORD_HASH = '';

if (!JWT_SECRET) console.warn('[server] JWT_SECRET ausente — auth desabilitado.');
if (!MASTER_USERNAME || !MASTER_PASSWORD) console.warn('[server] MASTER_USERNAME / MASTER_PASSWORD ausentes — login do master indisponível.');

// V23.0.0 — Migrations automáticas. Roda uma vez no startup.
async function runMigrations() {
  if (!pgPool) return { ok: false, message: 'No pool' };
  const client = await pgPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(128) UNIQUE NOT NULL,
        email VARCHAR(192),
        password_hash VARCHAR(255),
        is_master BOOLEAN DEFAULT FALSE,
        is_approved BOOLEAN DEFAULT FALSE,
        mode VARCHAR(16) NOT NULL DEFAULT 'sandbox',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        last_login_at TIMESTAMPTZ
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS journey_state (
        id INT PRIMARY KEY DEFAULT 1,
        state_json JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        updated_by_user_id INT REFERENCES users(id)
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS journey_snapshots (
        id SERIAL PRIMARY KEY,
        state_json JSONB NOT NULL,
        label VARCHAR(128),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        triggered_by_user_id INT REFERENCES users(id)
      );
    `);
    // V26.0.0 — Conversas do Djow (memória persistente).
    await client.query(`
      CREATE TABLE IF NOT EXISTS djow_conversations (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS djow_messages (
        id SERIAL PRIMARY KEY,
        conversation_id INT REFERENCES djow_conversations(id) ON DELETE CASCADE,
        role VARCHAR(16) NOT NULL,
        content JSONB NOT NULL,
        tokens_in INT DEFAULT 0,
        tokens_out INT DEFAULT 0,
        cost_usd NUMERIC(10,5) DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_djow_messages_conv ON djow_messages(conversation_id, created_at);
    `);
    // V30.0.0 — Integração ClickUp. clickup_config guarda OAuth App credentials
    // (client_id/secret) do user. clickup_credentials guarda tokens após OAuth.
    // Ambos criptografados via ENCRYPTION_KEY (lib/clickup-crypto.js).
    await client.query(`
      CREATE TABLE IF NOT EXISTS clickup_config (
        user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        client_id_enc TEXT NOT NULL,
        client_secret_enc TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS clickup_credentials (
        user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        access_token_enc TEXT NOT NULL,
        workspace_id VARCHAR(64),
        workspace_name VARCHAR(255),
        connected_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    // V31.2.29 — Coluna token_type distingue OAuth ('oauth') de Personal API
    // Token ('pat'). PATs entram pela rota /api/clickup-connect-pat. Header
    // Authorization muda: OAuth precisa 'Bearer <token>', PAT é '<token>' cru.
    await client.query(`
      ALTER TABLE clickup_credentials ADD COLUMN IF NOT EXISTS token_type VARCHAR(16) DEFAULT 'oauth';
    `);
    // V31.2.32 — default_list_id: lista do ClickUp onde tarefas criadas via Djow
    // são gravadas. Auto-descoberta na primeira call (/api/clickup-create-task)
    // se NULL: pega primeira list folderless OU primeiro folder → primeira list.
    await client.query(`
      ALTER TABLE clickup_credentials ADD COLUMN IF NOT EXISTS default_list_id VARCHAR(64);
    `);
    // V31.2.36 — RD Station/CRM credentials encriptados em tabela própria.
    // 3 token types possíveis (PK composta user_id + token_type):
    //   - 'crm_pat': RD CRM Personal Access Token (estático, sem refresh)
    //   - 'marketing_oauth': RD Marketing OAuth (access + refresh + expires_at)
    //   - 'crm_oauth': RD CRM OAuth v2 (access + refresh + expires_at)
    // Write-through: App.state.integrations.rd continua sendo a API de leitura
    // interna, mas cada mutação dispara save em paralelo aqui — DB vira safety
    // net contra perda de state. ENCRYPTION_KEY usado igual ClickUp.
    await client.query(`
      CREATE TABLE IF NOT EXISTS rd_credentials (
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_type VARCHAR(32) NOT NULL,
        access_token_enc TEXT,
        refresh_token_enc TEXT,
        client_id_enc TEXT,
        client_secret_enc TEXT,
        redirect_uri TEXT,
        expires_at TIMESTAMPTZ,
        account_name VARCHAR(255),
        workspace_id VARCHAR(64),
        status VARCHAR(32),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, token_type)
      );
    `);
    // Seed master user se ainda não existe e env vars disponíveis.
    if (MASTER_USERNAME && MASTER_PASSWORD) {
      if (!MASTER_PASSWORD_HASH) {
        MASTER_PASSWORD_HASH = await bcrypt.hash(MASTER_PASSWORD, 10);
      }
      await client.query(`
        INSERT INTO users (username, email, password_hash, is_master, is_approved, mode)
        VALUES ($1, $1, $2, TRUE, TRUE, 'production')
        ON CONFLICT (username) DO UPDATE SET password_hash = $2, is_master = TRUE, is_approved = TRUE
      `, [MASTER_USERNAME, MASTER_PASSWORD_HASH]);
    }

    // V31.0.0 — Multi-tenancy refactor: journey_state e journey_snapshots
    // passam a ser chaveados por user_id.
    // V31.0.10 — Isolado em try-catch próprio: falha aqui não impede o demo seed.
    try {
      console.log('[migrations] V31 multi-tenancy: começando...');
      await client.query(`
        INSERT INTO journey_snapshots (state_json, label, triggered_by_user_id)
        SELECT js.state_json, 'pre-V31-migration-backup', js.updated_by_user_id
        FROM journey_state js
        WHERE js.id = 1
        AND NOT EXISTS (SELECT 1 FROM journey_snapshots WHERE label = 'pre-V31-migration-backup')
      `).catch(err => {
        if (!/column .id. does not exist/i.test(err.message)) throw err;
      });
      await client.query(`
        ALTER TABLE journey_state ADD COLUMN IF NOT EXISTS user_id INT REFERENCES users(id) ON DELETE CASCADE
      `);
      await client.query(`
        UPDATE journey_state SET user_id = (SELECT id FROM users WHERE is_master = TRUE LIMIT 1)
        WHERE user_id IS NULL
      `).catch(() => {});
      await client.query(`ALTER TABLE journey_state ALTER COLUMN user_id SET NOT NULL`).catch(() => {});
      await client.query(`ALTER TABLE journey_state DROP CONSTRAINT IF EXISTS journey_state_pkey`);
      await client.query(`ALTER TABLE journey_state ADD CONSTRAINT journey_state_pkey PRIMARY KEY (user_id)`).catch(err => {
        if (!/already exists|multiple primary keys/i.test(err.message)) throw err;
      });
      await client.query(`ALTER TABLE journey_state DROP COLUMN IF EXISTS id`);
      await client.query(`
        ALTER TABLE journey_snapshots ADD COLUMN IF NOT EXISTS owner_user_id INT REFERENCES users(id) ON DELETE CASCADE
      `);
      await client.query(`
        UPDATE journey_snapshots SET owner_user_id = COALESCE(triggered_by_user_id, (SELECT id FROM users WHERE is_master = TRUE LIMIT 1))
        WHERE owner_user_id IS NULL
      `).catch(() => {});
      await client.query(`ALTER TABLE journey_snapshots ALTER COLUMN owner_user_id SET NOT NULL`).catch(() => {});
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_journey_snapshots_owner ON journey_snapshots(owner_user_id, created_at DESC)
      `);
      console.log('[migrations] V31 multi-tenancy: OK.');
    } catch (err) {
      console.error('[migrations] V31 multi-tenancy FALHOU (continuando assim mesmo):', err.message);
    }

    // V31.0.10 — Demo seed isolado em try-catch + logging detalhado.
    // Se algo falhar, NÃO bloqueia as migrations principais.
    try {
      console.log('[demo-seed] Começando...');
      const DEMO_USERNAME = 'demo@leadjourney.app';
      const DEMO_PASSWORD = 'lj-demo-2026';
      const demoHash = await bcrypt.hash(DEMO_PASSWORD, 10);
      await client.query(`
        INSERT INTO users (username, email, password_hash, is_master, is_approved, mode)
        VALUES ($1, $1, $2, FALSE, TRUE, 'demo')
        ON CONFLICT (username) DO UPDATE SET is_approved = TRUE, mode = 'demo'
      `, [DEMO_USERNAME, demoHash]);
      console.log('[demo-seed] User demo upsertado.');

      const { buildEngenhoNorteState, DEMO_SEED_VERSION } = require('./scripts/seed-demo-engenho-norte');
      console.log(`[demo-seed] DEMO_SEED_VERSION alvo: ${DEMO_SEED_VERSION}`);
      const demoUserRow = await client.query('SELECT id FROM users WHERE username = $1', [DEMO_USERNAME]);
      const demoUserId = demoUserRow.rows[0]?.id;
      console.log(`[demo-seed] demoUserId: ${demoUserId}`);
      if (demoUserId) {
        const existing = await client.query('SELECT state_json FROM journey_state WHERE user_id = $1', [demoUserId]);
        const existingVersion = existing.rows[0]?.state_json?.__demoSeed || null;
        const needsSeed = !existing.rows.length || existingVersion !== DEMO_SEED_VERSION;
        console.log(`[demo-seed] Existing version: ${existingVersion || '<nenhuma>'} · Precisa re-seedar: ${needsSeed}`);
        if (needsSeed) {
          const seedState = buildEngenhoNorteState();
          await client.query(
            `INSERT INTO journey_state (user_id, state_json, updated_at, updated_by_user_id)
             VALUES ($1, $2, NOW(), $1)
             ON CONFLICT (user_id) DO UPDATE SET
               state_json = EXCLUDED.state_json,
               updated_at = NOW(),
               updated_by_user_id = EXCLUDED.updated_by_user_id`,
            [demoUserId, seedState]
          );
          const reason = !existing.rows.length ? 'novo' : `re-seed (${existingVersion} → ${DEMO_SEED_VERSION})`;
          console.log(`[demo-seed] ✓ Engenho Norte aplicado pro user demo (id=${demoUserId}, ${reason}).`);
        } else {
          console.log(`[demo-seed] ✓ State já está em ${DEMO_SEED_VERSION} — seed pulado.`);
        }
      } else {
        console.warn('[demo-seed] User demo não encontrado após upsert — seed pulado.');
      }
    } catch (err) {
      console.error('[demo-seed] FALHOU:', err.message);
      console.error('[demo-seed] Stack:', err.stack);
    }

    console.log('[server] Migrations OK.');
    return { ok: true };
  } catch (err) {
    console.error('[server] Migrations falharam:', err);
    return { ok: false, message: err.message };
  } finally {
    client.release();
  }
}

// V23.0.0 — Middleware: anexa pool + usuário decodificado em req.
app.use(async (req, res, next) => {
  req.db = pgPool;
  req.user = null;
  if (JWT_SECRET) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (token) {
      try { req.user = jwt.verify(token, JWT_SECRET); } catch (_) { req.user = null; }
    }
  }
  next();
});

// V23.0.0 — Lista de rotas que NÃO exigem auth.
// V24.0.0 — Adicionado /api/rd-webhook (RD POSTa eventos, sem JWT) e
// /api/rd-events-fetch (frontend puxa do buffer; sem JWT pra simetria com
// /api/lp-events-fetch — eventos não são sensíveis, só são lidos dentro do app).
const PUBLIC_API_ROUTES = new Set([
  '/api/auth-login',
  '/api/auth-register',
  '/api/auth-me',  // retorna info do usuário ou 401 — pode ser chamado sem token pra checar
  '/api/lp-event',
  '/api/lp-events-fetch',
  '/api/rd-token',
  '/api/rd-proxy',
  '/api/rd-crm-sync',
  '/api/rd-webhook',
  '/api/rd-events-fetch',
  '/api/clickup-oauth-callback'  // V30.0.0 — ClickUp redireciona aqui sem JWT
]);

// V23.0.0 — Gate de auth: rotas privadas /api/* exigem req.user.
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  if (PUBLIC_API_ROUTES.has(req.path)) return next();
  if (req.user) return next();
  return res.status(401).json({ ok: false, message: 'Não autenticado.' });
});

// V31.0.0 — Gate demo: users com mode='demo' são read-only. Bloqueia
// POST/PUT/DELETE/PATCH em qualquer rota /api/* (exceto auth e leitura).
// Defesa real no backend, não só visual no frontend.
const DEMO_MUTATION_WHITELIST = new Set([
  '/api/auth-login',     // sair/logar precisa funcionar
  '/api/auth-register',  // não bloqueamos cadastros novos (eles ficam pending)
  '/api/auth-me'
]);
app.use((req, res, next) => {
  if (!req.path.startsWith('/api/')) return next();
  if (!req.user || req.user.mode !== 'demo') return next();
  if (req.method === 'GET' || req.method === 'OPTIONS' || req.method === 'HEAD') return next();
  if (DEMO_MUTATION_WHITELIST.has(req.path)) return next();
  return res.status(403).json({
    ok: false,
    code: 'demo_readonly',
    message: 'Modo demo: cadastros e edições estão desabilitados. Você está navegando uma empresa fictícia (Engenho Norte).'
  });
});

// V23.0.0 — Expõe helpers globais pra os handlers /api/*.js.
app.set('pgPool', pgPool);
app.set('jwtSecret', JWT_SECRET);
app.set('masterUsername', MASTER_USERNAME);

// Monta cada arquivo de ./api/*.js em /api/<nome-do-arquivo>.
const apiDir = path.join(__dirname, 'api');
if (fs.existsSync(apiDir)) {
  for (const file of fs.readdirSync(apiDir)) {
    if (!file.endsWith('.js')) continue;
    const route = '/api/' + file.replace(/\.js$/, '');
    try {
      const handler = require(path.join(apiDir, file));
      const fn = typeof handler === 'function' ? handler : (handler && handler.default);
      if (typeof fn !== 'function') {
        console.warn(`[server] ${file} não exporta uma função — ignorado.`);
        continue;
      }
      app.all(route, (req, res) => {
        Promise.resolve(fn(req, res)).catch(err => {
          console.error(`[api ${route}]`, err);
          if (!res.headersSent) res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
        });
      });
      console.log(`[server] mounted ${route}`);
    } catch (err) {
      console.error(`[server] falha ao carregar ${file}:`, err);
    }
  }
}

// Estáticos
['src', 'styles', 'public', 'design-director-branding'].forEach(dir => {
  const p = path.join(__dirname, dir);
  if (fs.existsSync(p)) app.use('/' + dir, express.static(p));
});

const indexPath = path.join(__dirname, 'index.html');
app.get('/', (_req, res) => res.sendFile(indexPath));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, message: 'Endpoint não encontrado.' });
  res.sendFile(indexPath);
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, async () => {
  console.log(`LeadJourney V23 rodando na porta ${PORT}`);
  if (pgPool) await runMigrations();
});
