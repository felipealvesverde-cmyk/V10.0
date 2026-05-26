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
  -- V32.1.3-V32.2.0 — Geraldo safe-integration columns (incluídas no
  -- schema base em V32.4.2 — antes só via ALTER TABLE no master).
  default_space_id VARCHAR(64),
  default_list_name VARCHAR(255),
  task_prefix VARCHAR(32),
  lj_tag_name VARCHAR(64) DEFAULT 'lj-auto',
  status_map_json TEXT,
  write_enabled BOOLEAN DEFAULT TRUE,
  lj_space_id VARCHAR(64),
  mirror_enabled BOOLEAN DEFAULT TRUE,
  -- V32.6.0: raiz flexível (space|folder|list) — lj_space_id continua existindo
  -- por back-compat (sinônimo de lj_root_id quando lj_root_kind='space').
  lj_root_id VARCHAR(64),
  lj_root_kind VARCHAR(16),
  lj_root_name VARCHAR(255),
  connected_at TIMESTAMPTZ DEFAULT NOW()
);

-- V32.2.0 — Mapeamento LJ ↔ ClickUp (hierarquia espelhada).
-- Movido pro schema base em V32.4.2 — antes só criado via server.js no master.
CREATE TABLE IF NOT EXISTS clickup_lj_mappings (
  user_id INT NOT NULL,
  lj_kind VARCHAR(16) NOT NULL,
  lj_id BIGINT NOT NULL,
  clickup_id VARCHAR(64) NOT NULL,
  clickup_kind VARCHAR(16) NOT NULL,
  clickup_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, lj_kind, lj_id)
);

-- V32.10.1 — Migração idempotente pra tenants antigos: lj_id INT estourava
-- pra IDs Date.now() (13 dígitos > max INT 32-bit ~2.1bi). Convertido pra BIGINT.
DO $$ BEGIN
  BEGIN
    ALTER TABLE clickup_lj_mappings ALTER COLUMN lj_id TYPE BIGINT;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

CREATE INDEX IF NOT EXISTS idx_clickup_mappings_user
  ON clickup_lj_mappings(user_id);

-- ============================================================================
-- MIGRATIONS IDEMPOTENTES (V32.4.2)
-- ============================================================================
-- Garante que tenants ANTIGOS (schema pré-V32.4.2) ganhem colunas novas.
-- Cada ADD COLUMN IF NOT EXISTS é no-op em tabelas que já têm a coluna.
-- Pra tenants novos (criados via tenant-plug-own-db.js após V32.4.2), as
-- colunas já vêm no CREATE TABLE acima — ALTER vira no-op.
ALTER TABLE clickup_credentials ADD COLUMN IF NOT EXISTS default_space_id VARCHAR(64);
ALTER TABLE clickup_credentials ADD COLUMN IF NOT EXISTS default_list_name VARCHAR(255);
ALTER TABLE clickup_credentials ADD COLUMN IF NOT EXISTS task_prefix VARCHAR(32);
ALTER TABLE clickup_credentials ADD COLUMN IF NOT EXISTS lj_tag_name VARCHAR(64) DEFAULT 'lj-auto';
ALTER TABLE clickup_credentials ADD COLUMN IF NOT EXISTS status_map_json TEXT;
ALTER TABLE clickup_credentials ADD COLUMN IF NOT EXISTS write_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE clickup_credentials ADD COLUMN IF NOT EXISTS lj_space_id VARCHAR(64);
ALTER TABLE clickup_credentials ADD COLUMN IF NOT EXISTS mirror_enabled BOOLEAN DEFAULT TRUE;
-- V32.6.0: raiz flexível
ALTER TABLE clickup_credentials ADD COLUMN IF NOT EXISTS lj_root_id VARCHAR(64);
ALTER TABLE clickup_credentials ADD COLUMN IF NOT EXISTS lj_root_kind VARCHAR(16);
ALTER TABLE clickup_credentials ADD COLUMN IF NOT EXISTS lj_root_name VARCHAR(255);
UPDATE clickup_credentials
   SET lj_root_id = lj_space_id, lj_root_kind = 'space'
 WHERE lj_space_id IS NOT NULL AND (lj_root_id IS NULL OR lj_root_kind IS NULL);

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
-- EXECUTION PROVIDERS (Trello, Monday, Jira, Notion, etc — credenciais criptografadas)
-- V32.0.14 — Substitui o legacy executionConfig.providers[].apiToken em
-- App.state (localStorage / journey_state plaintext). Cada provider que entra
-- no padrão V30+ ganha row aqui (user_id + provider_id como PK composta).
--
-- Schema flexível por design: providers diferentes precisam de campos
-- diferentes (Trello = apiKey + token + board; Jira = url + email +
-- apiToken + project; Notion = apiToken + databaseId; Monday = apiToken +
-- workspace + boardId). Pra evitar 1 coluna por field × N providers, guardamos
-- todos criptografados juntos em `fields_enc` (JSON encriptado AES-256-GCM).
-- Metadata não-secreta (account_name pra exibir, default_list, etc) fica
-- em `display_meta` (JSONB plain pra UI).
-- ============================================================================
CREATE TABLE IF NOT EXISTS execution_credentials (
  user_id INT NOT NULL,
  provider_id VARCHAR(32) NOT NULL,  -- 'trello' | 'monday' | 'jira' | 'notion' | 'clickup' (futuro merge)
  fields_enc TEXT NOT NULL,          -- JSON dos campos sensíveis, criptografado
  display_meta JSONB DEFAULT '{}',   -- metadata pra UI (workspace_name, account, default_list_id, etc)
  status VARCHAR(32),                -- 'connected' | 'error' | 'pending'
  last_tested_at TIMESTAMPTZ,
  last_error TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_execution_credentials_user
  ON execution_credentials(user_id);

-- ============================================================================
-- V33 — ORQUESTRAÇÃO (tracker próprio + Suspect→Lead→Customer + atribuição causal)
-- ============================================================================
-- Onda 1 da V33 (memória [[project_v33_orchestration_architecture]]).
-- 4 tabelas novas — NENHUMA altera tabela pré-existente. Zero risco em prod.
-- Visitor é unidade central. Ele PERTENCE ao tenant + produto. Touchpoints
-- registram qual campanha o trouxe (pode haver N touchpoints / N campanhas
-- distintas pro mesmo visitor). Transitions registram mudanças de entidade.
-- Events guardam o log cru do tracker (audit + debug).

-- Visitor — 1 linha por pessoa rastreada (dedup por lj_visitor_id).
-- Pertence a (user_id, product_id). entity_type evolui suspect→lead→customer.
-- current_stage é qual dos 9 estágios ele tá agora (default marketing-tof).
CREATE TABLE IF NOT EXISTS lj_visitors (
  id BIGSERIAL PRIMARY KEY,
  lj_visitor_id VARCHAR(64) NOT NULL,
  user_id INT NOT NULL,
  product_id BIGINT,
  entity_type VARCHAR(16) NOT NULL DEFAULT 'suspect',  -- 'suspect' | 'lead' | 'customer'
  current_stage VARCHAR(32) NOT NULL DEFAULT 'marketing-tof',
  email VARCHAR(255),
  phone VARCHAR(64),
  name VARCHAR(255),
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  promoted_to_lead_at TIMESTAMPTZ,
  promoted_to_customer_at TIMESTAMPTZ,
  total_value_cents INT DEFAULT 0,   -- soma de receita atribuída (preenchida em Onda 2)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT lj_visitors_visitor_id_user_uniq UNIQUE (user_id, lj_visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_lj_visitors_user_entity_stage
  ON lj_visitors(user_id, entity_type, current_stage);
CREATE INDEX IF NOT EXISTS idx_lj_visitors_user_product
  ON lj_visitors(user_id, product_id);
CREATE INDEX IF NOT EXISTS idx_lj_visitors_email
  ON lj_visitors(user_id, email) WHERE email IS NOT NULL;

-- V33.0.0-alpha4 — IDs externos pra rastreabilidade com sistemas terceiros
-- (RD CRM contact/deal, Hotmart purchase, etc) + status do sync mais recente.
ALTER TABLE lj_visitors ADD COLUMN IF NOT EXISTS external_rd_contact_id VARCHAR(64);
ALTER TABLE lj_visitors ADD COLUMN IF NOT EXISTS external_rd_deal_id VARCHAR(64);
ALTER TABLE lj_visitors ADD COLUMN IF NOT EXISTS external_rd_sync_status VARCHAR(16);  -- 'pending'|'synced'|'error'|'skipped'
ALTER TABLE lj_visitors ADD COLUMN IF NOT EXISTS external_rd_sync_error TEXT;
ALTER TABLE lj_visitors ADD COLUMN IF NOT EXISTS external_rd_synced_at TIMESTAMPTZ;
ALTER TABLE lj_visitors ADD COLUMN IF NOT EXISTS external_hotmart_purchase_id VARCHAR(128);  -- preenchido em Onda 2

-- Events — log cru de TUDO que o snippet captura (page_view, click, form_submit, etc).
-- Volume alto esperado; tabela append-only. Útil pra debug e replays.
CREATE TABLE IF NOT EXISTS lj_visitor_events (
  id BIGSERIAL PRIMARY KEY,
  lj_visitor_id VARCHAR(64) NOT NULL,
  user_id INT NOT NULL,
  event_type VARCHAR(64) NOT NULL,    -- 'page_view' | 'click' | 'form_submit' | etc
  event_payload JSONB,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lj_visitor_events_visitor
  ON lj_visitor_events(lj_visitor_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_lj_visitor_events_user_type
  ON lj_visitor_events(user_id, event_type, occurred_at);

-- Touchpoints — toda visita registra source+campaign+UTM+cost. Coração do
-- source tracking. Visitor pode ter N touchpoints. Atribuição (first/last/etc)
-- é leitura sobre esta tabela.
CREATE TABLE IF NOT EXISTS lj_visitor_touchpoints (
  id BIGSERIAL PRIMARY KEY,
  lj_visitor_id VARCHAR(64) NOT NULL,
  user_id INT NOT NULL,
  campaign_id BIGINT,                    -- campanha LJ que rastreou (vinda do snippet)
  source VARCHAR(64),                    -- 'google_ads' | 'meta_ads' | 'google_organic' | 'rd_email' | 'direct' | ...
  source_type VARCHAR(16),               -- 'paid' | 'owned' | 'earned' | 'direct'
  utm_source VARCHAR(128),
  utm_medium VARCHAR(128),
  utm_campaign VARCHAR(128),
  utm_content VARCHAR(255),
  utm_term VARCHAR(128),
  referrer_url TEXT,
  landing_url TEXT,
  cost_cents INT DEFAULT 0,              -- preenchido em Onda 4 pelos APIs Ads
  is_first BOOLEAN DEFAULT FALSE,        -- primeiro touchpoint do visitor (pra first-touch attribution)
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lj_touchpoints_visitor
  ON lj_visitor_touchpoints(lj_visitor_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_lj_touchpoints_user_campaign
  ON lj_visitor_touchpoints(user_id, campaign_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_lj_touchpoints_user_source
  ON lj_visitor_touchpoints(user_id, source, occurred_at);

-- Transitions — audit log permanente de mudanças de entidade/estágio.
-- NUNCA apagado. Coração da atribuição causal (triggered_by_action_id).
-- Source diz como o LJ soube da transição (tracker próprio, webhook RD, etc).
CREATE TABLE IF NOT EXISTS lj_transitions (
  id BIGSERIAL PRIMARY KEY,
  lj_visitor_id VARCHAR(64) NOT NULL,
  user_id INT NOT NULL,
  from_entity VARCHAR(16),               -- 'suspect' | 'lead' | 'customer' | NULL (criação)
  to_entity VARCHAR(16) NOT NULL,
  from_stage VARCHAR(32),
  to_stage VARCHAR(32),
  triggered_by_action_id BIGINT,         -- FK conceitual com App.state.actions; NULL quando não atribuível
  source VARCHAR(32) NOT NULL,           -- 'tracker' | 'rd_webhook' | 'hotmart_webhook' | 'manual'
  raw_payload JSONB,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lj_transitions_visitor
  ON lj_transitions(lj_visitor_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_lj_transitions_user_to
  ON lj_transitions(user_id, to_entity, occurred_at);
CREATE INDEX IF NOT EXISTS idx_lj_transitions_user_action
  ON lj_transitions(user_id, triggered_by_action_id) WHERE triggered_by_action_id IS NOT NULL;

-- ============================================================================
-- V33.0.0 ONDA 2 — HOTMART (Lead→Customer + receita real)
-- ============================================================================
-- Webhook do Hotmart bate em /api/hotmart-webhook quando alguém compra.
-- LJ valida, matcha por email/phone com visitors existentes, promove pra
-- Customer e grava purchase no audit log permanente.

-- Config do Hotmart por tenant (HOTTOK + mapping produto Hotmart → LJ).
CREATE TABLE IF NOT EXISTS hotmart_config (
  user_id INT PRIMARY KEY,
  hottok_enc TEXT NOT NULL,                  -- HOTTOK do produto, criptografado
  webhook_secret_enc TEXT,                   -- secret opcional pra HMAC validation
  product_mappings JSONB DEFAULT '{}',       -- {"<hotmart_product_id>": <lj_product_id>}
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchases — audit log permanente de toda transação Hotmart capturada.
-- transaction_id é unique pra dedup (Hotmart retry envia o mesmo webhook).
CREATE TABLE IF NOT EXISTS lj_hotmart_purchases (
  id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  transaction_id VARCHAR(128) NOT NULL,
  product_id_hotmart VARCHAR(64),            -- id no Hotmart
  product_id_lj BIGINT,                      -- produto LJ mapeado (pode ser NULL se sem mapping)
  lj_visitor_id VARCHAR(64),                 -- visitor matchado (pode ser NULL se compra direta)
  buyer_email VARCHAR(255),
  buyer_name VARCHAR(255),
  buyer_phone VARCHAR(64),
  purchase_status VARCHAR(32),               -- 'approved'|'refunded'|'chargeback'|'canceled'|...
  transaction_value_cents INT DEFAULT 0,
  commission_cents INT DEFAULT 0,            -- valor líquido vendedor
  currency VARCHAR(8) DEFAULT 'BRL',
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_number INT,                     -- 1=primeira compra; 2,3,...=recompras/recorrência
  raw_payload JSONB,
  occurred_at TIMESTAMPTZ,                   -- timestamp da compra no Hotmart
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT lj_hotmart_purchases_tx_uniq UNIQUE (user_id, transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_lj_hotmart_purchases_user_status
  ON lj_hotmart_purchases(user_id, purchase_status, occurred_at);
CREATE INDEX IF NOT EXISTS idx_lj_hotmart_purchases_visitor
  ON lj_hotmart_purchases(user_id, lj_visitor_id) WHERE lj_visitor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lj_hotmart_purchases_email
  ON lj_hotmart_purchases(user_id, buyer_email) WHERE buyer_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lj_hotmart_purchases_product_lj
  ON lj_hotmart_purchases(user_id, product_id_lj, occurred_at) WHERE product_id_lj IS NOT NULL;

-- V33.0.0 Onda 2 — Métricas Hotmart agregadas no próprio visitor pra leitura
-- rápida sem JOIN. Atualizadas no webhook processor.
ALTER TABLE lj_visitors ADD COLUMN IF NOT EXISTS hotmart_first_purchase_at TIMESTAMPTZ;
ALTER TABLE lj_visitors ADD COLUMN IF NOT EXISTS hotmart_last_purchase_at TIMESTAMPTZ;
ALTER TABLE lj_visitors ADD COLUMN IF NOT EXISTS hotmart_purchase_count INT DEFAULT 0;

-- ============================================================================
-- V34.0.0 ONDA 2 — BANCO DE LEADS (infra)
-- ============================================================================
-- Banco de leads é uma lista nomeada de pessoas. Vive SOLTO no tenant
-- (decisão Felipe 2026-05-26): mesmo banco pode servir N produtos.
-- Cada visitor pode pertencer a UM banco (FK em lj_visitors.bank_id).
-- Tag `lj-banco-{slug}` é aplicada pelo motor de import.
-- Mais detalhes em [[v34-leads-banco-tagueamento]].

CREATE TABLE IF NOT EXISTS lj_lead_banks (
  id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(128) NOT NULL,
  slug VARCHAR(128) NOT NULL,           -- normalizado pra tag (lowercase, hífen, sem acento)
  description TEXT,
  is_default BOOLEAN DEFAULT FALSE,     -- só 1 default por user_id (constraint parcial)
  visitor_count INT DEFAULT 0,          -- denormalizado pra contagem rápida; atualizado on insert/delete em lj_visitors
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT lj_lead_banks_user_name_uniq UNIQUE (user_id, name),
  CONSTRAINT lj_lead_banks_user_slug_uniq UNIQUE (user_id, slug)
);

-- Garante NO MÁXIMO 1 banco default por user
CREATE UNIQUE INDEX IF NOT EXISTS idx_lj_lead_banks_user_default
  ON lj_lead_banks(user_id) WHERE is_default = TRUE;

-- V34.0.0 — Colunas em lj_visitors:
-- - bank_id: FK soft pra banco. NULL = visitor do tracker (sem banco)
-- - global_score: score lifetime do lead (pesado pra mover). [[v34-leads-banco-tagueamento]]
ALTER TABLE lj_visitors ADD COLUMN IF NOT EXISTS bank_id BIGINT;
ALTER TABLE lj_visitors ADD COLUMN IF NOT EXISTS global_score INT DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_lj_visitors_bank ON lj_visitors(user_id, bank_id) WHERE bank_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lj_visitors_global_score ON lj_visitors(user_id, global_score DESC);

-- ============================================================================
-- META (versão do schema, pra migrations futuras saberem onde estão)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tenant_schema_meta (
  key VARCHAR(64) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO tenant_schema_meta (key, value) VALUES ('schema_version', 'v34.0.0-onda2.a')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
