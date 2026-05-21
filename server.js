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

// V32.0.6 — Diagnostic: imprime exatamente o que Railway entregou pra gente.
// Sem isso é difícil saber se env var foi atualizada ou tá vindo cacheada.
console.log(`[server] ENV CHECK: MASTER_USERNAME=${JSON.stringify(MASTER_USERNAME)} (length=${MASTER_USERNAME.length})`);
console.log(`[server] ENV CHECK: MASTER_PASSWORD=${MASTER_PASSWORD ? '<set, length=' + MASTER_PASSWORD.length + '>' : '<empty>'}`);
console.log(`[server] ENV CHECK: JWT_SECRET=${JWT_SECRET ? '<set, length=' + JWT_SECRET.length + '>' : '<empty>'}`);
console.log(`[server] ENV CHECK: DATABASE_URL=${process.env.DATABASE_URL ? '<set>' : '<empty>'}`);
console.log(`[server] ENV CHECK: ENCRYPTION_KEY=${process.env.ENCRYPTION_KEY ? '<set, length=' + process.env.ENCRYPTION_KEY.length + '>' : '<empty>'}`);

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
    // V32.0.14 — execution_credentials criptografado por provider.
    // Substitui o legacy executionConfig.providers[].apiToken (que vivia em
    // journey_state.state_json plaintext). Schema flexível: fields_enc guarda
    // JSON encriptado dos campos sensíveis (apiKey, token, etc — variável por
    // provider), display_meta guarda metadata exibível na UI.
    // Providers que vão migrar pra cá: trello, monday, jira, notion (V32.0.16+).
    // ClickUp continua em clickup_credentials próprio (compat).
    await client.query(`
      CREATE TABLE IF NOT EXISTS execution_credentials (
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider_id VARCHAR(32) NOT NULL,
        fields_enc TEXT NOT NULL,
        display_meta JSONB DEFAULT '{}',
        status VARCHAR(32),
        last_tested_at TIMESTAMPTZ,
        last_error TEXT,
        connected_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, provider_id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_execution_credentials_user
        ON execution_credentials(user_id);
    `);
    // V32.0.0 — Global Mode (control plane).
    // tenants = empresas-cliente. tenant_members = quem pertence a qual tenant.
    // users.default_tenant_id = tenant que abre por padrão no login.
    //
    // Isolamento: cada tenant pode ter db_connection_string_enc preenchido (DB
    // Postgres próprio na Railway/Supabase). Enquanto NULL, o tenant ainda usa
    // o control plane (compat com V31). Migração tenant-by-tenant em V32.0.1+.
    //
    // status: 'active' | 'demo' | 'suspended' | 'trial'
    // role:   'owner'  | 'admin' | 'member'   | 'viewer'
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        slug VARCHAR(64) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        plan VARCHAR(32) NOT NULL DEFAULT 'starter',
        db_connection_string_enc TEXT,
        owner_user_id INT REFERENCES users(id) ON DELETE SET NULL,
        migrated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenant_members (
        tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role VARCHAR(32) NOT NULL DEFAULT 'member',
        invited_at TIMESTAMPTZ,
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (tenant_id, user_id)
      );
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON tenant_members(user_id);
    `);
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS default_tenant_id INT REFERENCES tenants(id) ON DELETE SET NULL;
    `);
    // V32.1.2 — display_name editável pelo próprio user (saudação na UI).
    // Substitui derivação automática do email (que mostrava "Felipe" pra
    // qualquer cliente cujo email começasse com felipe@ — confuso pro Sansone).
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(128);
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

    // V32.0.2 — Global Mode tenant seed (REVISADO).
    // Modelo correto de quem-é-quem:
    //   - Felipe Alves (CEO/dev) → master (felipe@w2c.pro.br) + demo (demo@leadjourney.app)
    //     Master é admin global, NÃO é dono de nenhum tenant.
    //     Demo é staging do Felipe, dono do tenant 'engenho-norte' (cervejaria fictícia).
    //   - João Sansone (primeiro CLIENTE EXTERNO) → vai ganhar user próprio + tenant
    //     'sansone' como owner + DB próprio plugado. Ainda não criado.
    //
    // Esta seed:
    //   1. Garante tenant 'sansone' existe com owner_user_id=NULL (reservado pro João)
    //   2. Se algum user (ex.: master antigo) foi linkado como tenant_member ou owner
    //      do 'sansone' por um seed anterior bugado, REMOVE essa ligação.
    //   3. Garante tenant 'engenho-norte' linkado ao demo user como owner.
    //   4. Se mais de 1 user com is_master=TRUE existir, demote todos exceto o atual
    //      MASTER_USERNAME (caso env var tenha mudado no Railway).
    //   5. Limpa default_tenant_id do master (master é admin global, não fica preso a tenant).
    //
    // Idempotente — re-rodar é seguro.
    try {
      console.log('[v32-tenant-seed] Começando (V32.0.2 revisado)...');

      // 0. Demote masters órfãos: se MASTER_USERNAME no env não bate com algum
      //    is_master=TRUE existente, derruba o flag dos antigos.
      if (MASTER_USERNAME) {
        const demoteResult = await client.query(
          `UPDATE users SET is_master = FALSE
           WHERE is_master = TRUE AND username <> $1
           RETURNING id, username`,
          [MASTER_USERNAME]
        );
        if (demoteResult.rowCount > 0) {
          console.log(`[v32-tenant-seed] Demoted ${demoteResult.rowCount} master(s) órfãos:`,
            demoteResult.rows.map(r => r.username).join(', '));
        }
      }

      // 1. Tenant Sansone Management — RESERVADO. owner_user_id = NULL até João existir.
      await client.query(`
        INSERT INTO tenants (slug, name, status, plan, owner_user_id)
        VALUES ('sansone', 'Sansone Management', 'active', 'starter', NULL)
        ON CONFLICT (slug) DO UPDATE SET
          name = 'Sansone Management',
          status = 'active',
          updated_at = NOW()
      `);
      const sansoneRow = await client.query("SELECT id FROM tenants WHERE slug = 'sansone'");
      const sansoneTenantId = sansoneRow.rows[0]?.id;

      // Limpa qualquer linkagem errada anterior (master havia sido linkado em V32.0.1 buggy).
      if (sansoneTenantId) {
        const masterRow = await client.query('SELECT id FROM users WHERE is_master = TRUE LIMIT 1');
        const masterUserId = masterRow.rows[0]?.id;
        if (masterUserId) {
          await client.query('DELETE FROM tenant_members WHERE tenant_id = $1 AND user_id = $2', [sansoneTenantId, masterUserId]);
          await client.query('UPDATE tenants SET owner_user_id = NULL WHERE id = $1 AND owner_user_id = $2', [sansoneTenantId, masterUserId]);
          await client.query('UPDATE users SET default_tenant_id = NULL WHERE id = $1 AND default_tenant_id = $2', [masterUserId, sansoneTenantId]);
        }
        console.log(`[v32-tenant-seed] ✓ Tenant 'sansone' (id=${sansoneTenantId}) RESERVADO sem owner — aguardando criação do user João Sansone.`);
      }

      // 2. Tenant Engenho Norte ← demo user (Felipe's staging)
      const demoUserRow2 = await client.query("SELECT id FROM users WHERE username = 'demo@leadjourney.app' LIMIT 1");
      const demoUserId2 = demoUserRow2.rows[0]?.id;
      if (demoUserId2) {
        await client.query(`
          INSERT INTO tenants (slug, name, status, plan, owner_user_id)
          VALUES ('engenho-norte', 'Engenho Norte (staging)', 'demo', 'demo', $1)
          ON CONFLICT (slug) DO UPDATE SET
            name = 'Engenho Norte (staging)',
            status = 'demo',
            owner_user_id = $1,
            updated_at = NOW()
        `, [demoUserId2]);
        const engenhoRow = await client.query("SELECT id FROM tenants WHERE slug = 'engenho-norte'");
        const engenhoTenantId = engenhoRow.rows[0]?.id;
        if (engenhoTenantId) {
          await client.query(`
            INSERT INTO tenant_members (tenant_id, user_id, role, joined_at)
            VALUES ($1, $2, 'owner', NOW())
            ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'owner'
          `, [engenhoTenantId, demoUserId2]);
          await client.query(`
            UPDATE users SET default_tenant_id = $1
            WHERE id = $2 AND (default_tenant_id IS NULL OR default_tenant_id <> $1)
          `, [engenhoTenantId, demoUserId2]);
          console.log(`[v32-tenant-seed] ✓ Tenant 'engenho-norte' (id=${engenhoTenantId}) ← user demo (id=${demoUserId2}) como owner.`);
        }
      } else {
        console.warn('[v32-tenant-seed] User demo não encontrado — tenant Engenho Norte pulado.');
      }

      console.log('[v32-tenant-seed] OK.');
    } catch (err) {
      console.error('[v32-tenant-seed] FALHOU (continuando):', err.message);
      console.error('[v32-tenant-seed] Stack:', err.stack);
    }

    // V32.0.5 — Rotação de master: felipe@w2c.pro.br (CEO antigo) → felipealvesverde@gmail.com (CEO novo).
    // Modelo final desejado:
    //   - felipealvesverde@gmail.com = MASTER, dono do LeadJourney (CEO Felipe)
    //   - felipe@w2c.pro.br = owner do tenant 'sansone' (primeiro CLIENTE externo)
    //   - demo@leadjourney.app = owner do tenant 'engenho-norte' (staging do Felipe)
    //
    // Esta migration:
    //   1. Migra TODOS os dados do felipe@w2c.pro.br pro felipealvesverde@gmail.com
    //      (mesma lógica do V32.0.4 mas com IDs diferentes).
    //   2. Linka felipe@w2c.pro.br como owner do tenant 'sansone' (que estava reservado).
    //   3. Atualiza tenants.owner_user_id = felipe@w2c.pro.br id pro tenant 'sansone'.
    //   4. Seta users.default_tenant_id = sansone pro felipe@w2c.pro.br.
    //
    // Pré-requisito: MASTER_USERNAME=felipealvesverde@gmail.com no Railway. Senão
    // o user destino não existe e a migração pula com warning.
    //
    // Idempotente: depois que rodar 1x, felipe@w2c.pro.br fica VAZIO. Re-rodar
    // só re-confirma o tenant link (não copia dados de volta).
    try {
      const FROM_USERNAME = 'felipe@w2c.pro.br';
      const TO_USERNAME = 'felipealvesverde@gmail.com';

      const fromRow = await client.query('SELECT id, is_master FROM users WHERE username = $1', [FROM_USERNAME]);
      const toRow = await client.query('SELECT id, is_master FROM users WHERE username = $1', [TO_USERNAME]);
      const fromId = fromRow.rows[0]?.id;
      const toId = toRow.rows[0]?.id;

      if (!fromId) {
        console.log(`[v32-master-rotate] User ${FROM_USERNAME} não existe — nada a fazer.`);
      } else if (!toId) {
        console.warn(`[v32-master-rotate] ⚠ User ${TO_USERNAME} não existe. Setar MASTER_USERNAME=${TO_USERNAME} no Railway e redeploy.`);
      } else if (fromId === toId) {
        console.log('[v32-master-rotate] FROM e TO são o mesmo user — nada a fazer.');
      } else if (fromRow.rows[0].is_master) {
        console.warn(`[v32-master-rotate] ⚠ ${FROM_USERNAME} ainda é master. Esperando demote (que roda no V32 tenant-seed). Próximo deploy resolve.`);
      } else {
        console.log(`[v32-master-rotate] Migrando: ${FROM_USERNAME}(id=${fromId}) → ${TO_USERNAME}(id=${toId})...`);

        // Single-row-per-user: DELETE destino → UPDATE source.
        await client.query('DELETE FROM journey_state WHERE user_id = $1', [toId]);
        const stateMoved = await client.query(
          'UPDATE journey_state SET user_id = $1, updated_by_user_id = $1 WHERE user_id = $2',
          [toId, fromId]
        );
        console.log(`[v32-master-rotate]   journey_state: ${stateMoved.rowCount} row(s).`);

        const snapsMoved = await client.query(
          'UPDATE journey_snapshots SET owner_user_id = $1 WHERE owner_user_id = $2',
          [toId, fromId]
        );
        await client.query(
          'UPDATE journey_snapshots SET triggered_by_user_id = $1 WHERE triggered_by_user_id = $2',
          [toId, fromId]
        );
        console.log(`[v32-master-rotate]   journey_snapshots: ${snapsMoved.rowCount} row(s).`);

        const djowMoved = await client.query(
          'UPDATE djow_conversations SET user_id = $1 WHERE user_id = $2',
          [toId, fromId]
        );
        console.log(`[v32-master-rotate]   djow_conversations: ${djowMoved.rowCount} row(s).`);

        await client.query('DELETE FROM clickup_config WHERE user_id = $1', [toId]);
        const cfgMoved = await client.query(
          'UPDATE clickup_config SET user_id = $1 WHERE user_id = $2',
          [toId, fromId]
        );
        console.log(`[v32-master-rotate]   clickup_config: ${cfgMoved.rowCount} row(s).`);

        await client.query('DELETE FROM clickup_credentials WHERE user_id = $1', [toId]);
        const credMoved = await client.query(
          'UPDATE clickup_credentials SET user_id = $1 WHERE user_id = $2',
          [toId, fromId]
        );
        console.log(`[v32-master-rotate]   clickup_credentials: ${credMoved.rowCount} row(s).`);

        await client.query('DELETE FROM rd_credentials WHERE user_id = $1', [toId]);
        const rdMoved = await client.query(
          'UPDATE rd_credentials SET user_id = $1 WHERE user_id = $2',
          [toId, fromId]
        );
        console.log(`[v32-master-rotate]   rd_credentials: ${rdMoved.rowCount} row(s).`);

        // Preserva default_tenant_id do FROM no TO (improvável mas garantia)
        await client.query(`
          UPDATE users SET default_tenant_id = (SELECT default_tenant_id FROM users WHERE id = $1)
          WHERE id = $2 AND default_tenant_id IS NULL
        `, [fromId, toId]);
        // E zera o do FROM porque vamos setar pro tenant Sansone logo abaixo.
        await client.query('UPDATE users SET default_tenant_id = NULL WHERE id = $1', [fromId]);

        console.log('[v32-master-rotate] ✓ Dados migrados.');
      }

      // Sempre (idempotente): linkar felipe@w2c.pro.br como owner do tenant 'sansone',
      // mesmo que migração tenha sido no-op em re-deploys.
      if (fromId) {
        const sansoneTenantRow = await client.query("SELECT id FROM tenants WHERE slug = 'sansone'");
        const sansoneTenantId = sansoneTenantRow.rows[0]?.id;
        if (sansoneTenantId) {
          await client.query(
            'UPDATE tenants SET owner_user_id = $1, updated_at = NOW() WHERE id = $2 AND (owner_user_id IS NULL OR owner_user_id <> $1)',
            [fromId, sansoneTenantId]
          );
          await client.query(`
            INSERT INTO tenant_members (tenant_id, user_id, role, joined_at)
            VALUES ($1, $2, 'owner', NOW())
            ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'owner'
          `, [sansoneTenantId, fromId]);
          await client.query(
            'UPDATE users SET default_tenant_id = $1 WHERE id = $2 AND default_tenant_id IS NULL',
            [sansoneTenantId, fromId]
          );
          console.log(`[v32-master-rotate] ✓ ${FROM_USERNAME} (id=${fromId}) é owner do tenant 'sansone' (id=${sansoneTenantId}).`);
        }
      }
    } catch (err) {
      console.error('[v32-master-rotate] FALHOU (continuando):', err.message);
      console.error('[v32-master-rotate] Stack:', err.stack);
    }

    // V32.0.4 — Migração de dados legacy joao.sansone@gmail.com → felipe@w2c.pro.br
    // ANTES do V32.0.3 cleanup deletar o legacy.
    //
    // Por que: o user joao.sansone@gmail.com pode ter state/snapshots/integrações
    // úteis (Felipe testou coisas logado nesse email no passado). Em vez de
    // descartar via cascade, copiamos pro novo master felipe@w2c.pro.br.
    //
    // Estratégia por tabela:
    //   - journey_state (PK user_id): DELETE felipe (recém-criado, vazio) → UPDATE legacy → felipe
    //   - journey_snapshots: UPDATE owner_user_id + triggered_by_user_id
    //   - djow_conversations: UPDATE user_id
    //   - djow_messages: FK via conversation_id, segue junto
    //   - clickup_config (PK user_id): DELETE felipe → UPDATE legacy
    //   - clickup_credentials (PK user_id): DELETE felipe → UPDATE legacy
    //   - rd_credentials (PK user_id+token_type): DELETE felipe → UPDATE legacy
    //   - tenant_members: nenhum (V32.0.2 já limpou)
    //
    // Guarda: só roda se AMBOS users existem E são distintos. Idempotente
    // depois do delete pq legacy some.
    try {
      const legacy = await client.query("SELECT id FROM users WHERE username = 'joao.sansone@gmail.com'");
      const felipe = await client.query("SELECT id FROM users WHERE username = 'felipe@w2c.pro.br'");
      const legacyId = legacy.rows[0]?.id;
      const felipeId = felipe.rows[0]?.id;

      if (!legacyId) {
        console.log('[v32-legacy-migrate] User legacy não existe — nada a migrar.');
      } else if (!felipeId) {
        console.warn('[v32-legacy-migrate] User felipe@w2c.pro.br não existe ainda. Trocar MASTER_USERNAME no Railway e redeploy. Migração pulada (legacy preservado).');
      } else if (legacyId === felipeId) {
        console.log('[v32-legacy-migrate] Legacy e Felipe são o mesmo user — nada a migrar.');
      } else {
        console.log(`[v32-legacy-migrate] Começando migração: legacy(id=${legacyId}) → felipe(id=${felipeId})...`);

        // journey_state (single row per user)
        await client.query('DELETE FROM journey_state WHERE user_id = $1', [felipeId]);
        const stateMoved = await client.query(
          'UPDATE journey_state SET user_id = $1, updated_by_user_id = $1 WHERE user_id = $2 RETURNING user_id',
          [felipeId, legacyId]
        );
        console.log(`[v32-legacy-migrate]   journey_state: ${stateMoved.rowCount} row(s) movidas.`);

        // journey_snapshots
        const snapshotsOwner = await client.query(
          'UPDATE journey_snapshots SET owner_user_id = $1 WHERE owner_user_id = $2',
          [felipeId, legacyId]
        );
        await client.query(
          'UPDATE journey_snapshots SET triggered_by_user_id = $1 WHERE triggered_by_user_id = $2',
          [felipeId, legacyId]
        );
        console.log(`[v32-legacy-migrate]   journey_snapshots: ${snapshotsOwner.rowCount} row(s) movidas.`);

        // djow_conversations (messages seguem via FK)
        const djowMoved = await client.query(
          'UPDATE djow_conversations SET user_id = $1 WHERE user_id = $2',
          [felipeId, legacyId]
        );
        console.log(`[v32-legacy-migrate]   djow_conversations: ${djowMoved.rowCount} row(s) movidas.`);

        // clickup_config (single row per user)
        await client.query('DELETE FROM clickup_config WHERE user_id = $1', [felipeId]);
        const clickupCfgMoved = await client.query(
          'UPDATE clickup_config SET user_id = $1 WHERE user_id = $2',
          [felipeId, legacyId]
        );
        console.log(`[v32-legacy-migrate]   clickup_config: ${clickupCfgMoved.rowCount} row(s) movidas.`);

        // clickup_credentials (single row per user)
        await client.query('DELETE FROM clickup_credentials WHERE user_id = $1', [felipeId]);
        const clickupCredMoved = await client.query(
          'UPDATE clickup_credentials SET user_id = $1 WHERE user_id = $2',
          [felipeId, legacyId]
        );
        console.log(`[v32-legacy-migrate]   clickup_credentials: ${clickupCredMoved.rowCount} row(s) movidas.`);

        // rd_credentials (multiple token_types per user)
        await client.query('DELETE FROM rd_credentials WHERE user_id = $1', [felipeId]);
        const rdMoved = await client.query(
          'UPDATE rd_credentials SET user_id = $1 WHERE user_id = $2',
          [felipeId, legacyId]
        );
        console.log(`[v32-legacy-migrate]   rd_credentials: ${rdMoved.rowCount} row(s) movidas.`);

        // Preserva o default_tenant_id (legacy não devia ter, mas garantia):
        await client.query(`
          UPDATE users SET default_tenant_id = (SELECT default_tenant_id FROM users WHERE id = $1)
          WHERE id = $2 AND default_tenant_id IS NULL
        `, [legacyId, felipeId]);

        console.log('[v32-legacy-migrate] ✓ Migração concluída — pronto pro cleanup deletar o legacy.');
      }
    } catch (err) {
      console.error('[v32-legacy-migrate] FALHOU (continuando, MAS cleanup vai pular delete):', err.message);
      console.error('[v32-legacy-migrate] Stack:', err.stack);
    }

    // V32.0.3 — Limpeza do user legacy 'joao.sansone@gmail.com'.
    // Esse email era a identidade Anthropic do Felipe (Claude Code login) que
    // foi usado por engano como MASTER_USERNAME em algum momento. Agora que o
    // master correto é felipe@w2c.pro.br, esse user antigo vira lixo no DB.
    //
    // O slug 'sansone' está reservado pro CLIENTE João Sansone (pessoa
    // diferente, ainda sem login). Manter joao.sansone@gmail.com no DB
    // confundiria a auditoria. Decisão Felipe 2026-05-21: deletar.
    //
    // CASCADE: o ON DELETE CASCADE em users(id) leva junto:
    //   journey_state, journey_snapshots, djow_conversations, djow_messages,
    //   clickup_config, clickup_credentials, rd_credentials, tenant_members
    //
    // Guarda: SÓ deleta se o user já NÃO for o master atual (segurança extra,
    // caso Felipe não tenha trocado MASTER_USERNAME no Railway ainda — não
    // queremos deletar o login pelo qual ele está logado agora).
    try {
      const LEGACY_USERNAME = 'joao.sansone@gmail.com';
      const legacyRow = await client.query(
        'SELECT id, is_master FROM users WHERE username = $1',
        [LEGACY_USERNAME]
      );
      const legacy = legacyRow.rows[0];
      if (!legacy) {
        console.log('[v32-legacy-cleanup] User joao.sansone@gmail.com não existe — nada a fazer.');
      } else if (legacy.is_master) {
        console.warn(`[v32-legacy-cleanup] ⚠ User joao.sansone@gmail.com (id=${legacy.id}) ainda é MASTER. Trocar MASTER_USERNAME=felipe@w2c.pro.br no Railway e redeploy ANTES dessa limpeza rodar.`);
      } else {
        await client.query('DELETE FROM users WHERE id = $1', [legacy.id]);
        console.log(`[v32-legacy-cleanup] ✓ User joao.sansone@gmail.com (id=${legacy.id}) deletado (cascade levou state/snapshots/integrations).`);
      }
    } catch (err) {
      console.error('[v32-legacy-cleanup] FALHOU (continuando):', err.message);
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
  '/api/clickup-oauth-callback',  // V30.0.0 — ClickUp redireciona aqui sem JWT
  '/api/env-info'  // V32.0.13 — frontend identifica staging × produção mesmo no login
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

// V32.0.7 — Middleware de roteamento por tenant.
// Popula em CADA request autenticada:
//   req.tenantId — id do tenant (null pro master sem default_tenant_id)
//   req.tenant   — { id, slug, name, status, plan } (null se sem tenant)
//   req.tenantDb — Pool a usar pra dados do tenant
//                  • Se tenant tem db_connection_string_enc preenchido → pool específico
//                  • Senão                                              → req.db (control plane)
//
// Comportamento atual (V32.0.7): nenhum handler usa req.tenantDb ainda. A infra
// fica plantada pros refactors V32.0.8+ migrarem handler-por-handler de req.db
// pra req.tenantDb sem big-bang.
//
// Pra requests sem JWT (rotas públicas), req.tenantDb também = req.db (fallback).
const tenantPoolHelper = require('./lib/tenant-pool');
app.use(async (req, res, next) => {
  req.tenantId = null;
  req.tenant = null;
  req.tenantDb = req.db; // fallback default — control plane

  if (!req.user) return next();
  const tenantId = req.user.tenantId;
  if (!tenantId) return next(); // master ou user sem default tenant

  try {
    const tenant = await tenantPoolHelper.getTenant(req.db, tenantId);
    if (!tenant) {
      console.warn(`[tenant-middleware] tenant ${tenantId} (do JWT) não existe no control plane.`);
      return next();
    }
    if (tenant.status === 'suspended') {
      return res.status(403).json({ ok: false, code: 'tenant_suspended', message: 'Conta suspensa. Contate o administrador.' });
    }
    req.tenantId = tenant.id;
    req.tenant = tenant;
    const tenantPool = await tenantPoolHelper.getTenantPool(req.db, tenantId);
    if (tenantPool) req.tenantDb = tenantPool; // override só se tenant tem DB próprio
  } catch (err) {
    console.error('[tenant-middleware] erro (continuando com fallback control plane):', err.message);
  }
  next();
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
