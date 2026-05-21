-- V32.0.0 — Global Mode: schema base de um tenant DB.
--
-- Este arquivo é rodado UMA vez por tenant DB novo (provisioning manual em V32.0,
-- depois automatizado em V32.1+). Cria todas as tabelas de DADOS isoladas do tenant.
--
-- O que NÃO entra aqui (fica no control plane):
--   users, tenants, tenant_members  -- auth/identidade global
--
-- O que entra aqui (isolado por tenant):
--   journey_state, journey_snapshots, djow_conversations, djow_messages,
--   clickup_config, clickup_credentials, rd_credentials
--
-- Nota: journey_state nesta versão continua sendo PRIMARY KEY (user_id) — um
-- tenant pode ter múltiplos users (membros), cada um tem seu state. Em V32.3+
-- podemos virar global do tenant se decidirmos compartilhamento total.
--
-- Para criar um tenant DB novo manualmente:
--   1. Provision Postgres novo no Railway/Supabase.
--   2. psql <connection-string> -f lib/tenant-db-schema.sql
--   3. Cadastra connection string no control plane via menu Administrar (V32.0.3).

-- ============================================================================
-- IDENTITY MIRROR (referência local ao user — NÃO é o registro mestre)
-- ============================================================================
-- Pequena tabela espelho pra FKs locais. O registro autoritativo está no
-- control plane (users table). Aqui guardamos só id + email pra display.
-- Sincronizada manualmente quando user é adicionado ao tenant_members.
CREATE TABLE IF NOT EXISTS tenant_users_mirror (
  user_id INT PRIMARY KEY,
  username VARCHAR(128) NOT NULL,
  email VARCHAR(192),
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- JOURNEY STATE (estado do app por user dentro do tenant)
-- ============================================================================
CREATE TABLE IF NOT EXISTS journey_state (
  user_id INT PRIMARY KEY,
  state_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by_user_id INT
);

CREATE TABLE IF NOT EXISTS journey_snapshots (
  id SERIAL PRIMARY KEY,
  owner_user_id INT NOT NULL,
  state_json JSONB NOT NULL,
  label VARCHAR(128),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  triggered_by_user_id INT
);

CREATE INDEX IF NOT EXISTS idx_journey_snapshots_owner
  ON journey_snapshots(owner_user_id, created_at DESC);

-- ============================================================================
-- DJOW (memória persistente do assistente)
-- ============================================================================
CREATE TABLE IF NOT EXISTS djow_conversations (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS djow_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INT NOT NULL REFERENCES djow_conversations(id) ON DELETE CASCADE,
  role VARCHAR(16) NOT NULL,
  content JSONB NOT NULL,
  tokens_in INT DEFAULT 0,
  tokens_out INT DEFAULT 0,
  cost_usd NUMERIC(10,5) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_djow_messages_conv
  ON djow_messages(conversation_id, created_at);

-- ============================================================================
-- CLICKUP (config + credenciais criptografadas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS clickup_config (
  user_id INT PRIMARY KEY,
  client_id_enc TEXT NOT NULL,
  client_secret_enc TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clickup_credentials (
  user_id INT PRIMARY KEY,
  access_token_enc TEXT NOT NULL,
  workspace_id VARCHAR(64),
  workspace_name VARCHAR(255),
  token_type VARCHAR(16) DEFAULT 'oauth',
  default_list_id VARCHAR(64),
  connected_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- RD STATION (3 token types por user)
-- ============================================================================
CREATE TABLE IF NOT EXISTS rd_credentials (
  user_id INT NOT NULL,
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

-- ============================================================================
-- META (versão do schema, pra migrations futuras saberem onde estão)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_schema_meta (
  key VARCHAR(64) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO tenant_schema_meta (key, value) VALUES ('schema_version', 'v32.0.0')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
