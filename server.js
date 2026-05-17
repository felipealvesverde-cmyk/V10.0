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
