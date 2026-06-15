# Data Model — Entidades do LeadJourney

> KB ativa pro Djow. Atualizado em V38.0.3.
> Quando o user pedir "cria produto/campanha/ação", use o schema abaixo.

## Tabelas no Postgres

### Control plane DB (`req.db`)

Tabelas globais ao LJ — vivem no DB master, não no DB do tenant.

- `users` — id, username, email, password_hash, display_name, is_master, is_approved, mode, default_tenant_id, **password_reset_pending**, **password_reset_expires_at**, **password_reset_requested_by_user_id** (V37.4.31), master_ai_enabled
- `tenants` — id, slug, name, owner_user_id, status, db_connection_string_enc (criptografada)
- `tenant_members` — id, tenant_id, user_id, role (owner/manager/user), **permissions_overrides** JSONB (V37.3.1), invited_at, joined_at
- `tenant_invites` — id, tenant_id, inviter_user_id, invitee_email, role, **permissions_overrides** JSONB, token, expires_at, accepted_at (V37.3.3)
- `user_action_tokens` — id, user_id, action_type ('password_reset'|'email_change'), token, payload JSONB, issued_by_user_id, expires_at, used_at (V37.4.28)
- `app_secrets` — k-v pra segredos globais

### Tenant DB (`req.tenantDb`)

Cada tenant tem seu próprio Postgres plugado.

- **`tenant_state`** (V37.4.29) — tenant_id PK, state_json JSONB, last_writer_user_id, updated_at. **Source of truth** do App.state.
- `journey_state` — user_id PK, state_json JSONB, updated_at. **Legacy** (V31). Mantido por dual-write transitório pra rollback.
- `journey_snapshots` — id, user_id, label, state_json, created_at. Backup automático.
- `djow_conversations` + `djow_messages` — histórico Djow (per-user, não compartilhado no tenant)
- `notifications` (V37.4.0) — id, tenant_id, audience_user_ids INT[], category, severity, kind, title, body, data JSONB, entity_kind, entity_id, created_at, expires_at, seen_by_user_ids INT[], saved_by_user_ids INT[], archived_by_user_ids INT[]
- `pins` (V37.5.0) — id BIGSERIAL, tenant_id, creator_user_id, target_url, anchor_x_pct, anchor_y_pct, text, audience_user_ids INT[], seen_by_user_ids INT[], archived_at, expires_at, created_at. **IMPORTANTE**: NUNCA fazer JOIN com `users` aqui — users vive no control plane.
- `governance_closings` (V37.0.2) — id, user_id, kind ('product_auto'|'product_custom'|'consolidated_monthly'|'consolidated_custom'), product_id, period (YYYY-MM), status ('partial'|'complete'), snapshot_json JSONB, reopens_log JSONB, created_at
- `clickup_credentials`, `clickup_config`, `clickup_mappings`, `clickup_ij_mappings` — V30+. Chave: user_id = owner do tenant (resolvido via `lib/credentials-owner.js`).
- `rd_credentials`, `rd_marketing_credentials` — RD Station. 3 tokens (CRM PAT, CRM OAuth, Marketing OAuth).
- `hotmart_config`, `hotmart_credentials` — Hotmart OAuth.
- `google_ads_config`, `google_ads_credentials` — Google Ads.
- `ga4_config`, `ga4_credentials` — Google Analytics 4.
- `lj_visitors`, `lj_leads`, `lj_score_*` — operação de lead/score.

## State (App.state) — entidades JS principais

### Product

Vive em `App.state.products`. Sincronizado via `tenant_state` (compartilhado entre membros do tenant).

```ts
{
  id: number,             // auto: Date.now() + random
  name: string,           // OBRIGATÓRIO
  type?: string,          // 'Consultoria' | 'SaaS' | 'Curso' | livre
  revenueModel: string,   // 'Venda única' | 'Recorrente'
  price: string,          // ex: "R$ 497,00" (display, legacy — preço agora vem das ofertas)
  priceValue: number,     // ex: 497
  operationalCost: string,
  operationalCostValue: number,
  unitProfit: number,
  marginPercent: number,
  grossMargin: string,    // '40%'
  archived?: boolean,
  okrs?: [],
  createdAt: string
}
```

**Mínimo pra criar**: `name`. Resto pode ser default.

### Offer (V38.0.3 — NOVO modelo)

Vive em `App.state.revopsFinanceV2[productId].offers[]`. Cada produto tem N ofertas.

```ts
{
  id: string,                // 'offer_xxxx'
  name: string,              // 'Produto Principal', 'Cross-sell X'
  kind: string,              // 'main' | 'cross-sell' | 'up-sell' | 'down-sell'
  price: number,             // em reais
  mix: number,               // %  da TM ponderada
  metaVendas: number,        // META de vendas (unidades, não R$)
  selectedForTicket: boolean
}
```

Helper: `RevopsWhitelabelEngine.defaultOffer(name, price)` retorna oferta padrão (kind=main, mix=100).

**Criar produto AUTOMATICAMENTE cria 1 oferta default** via `Actions._ensureRevopsOffersForProduct(productId, productName)`. Cliente novo nasce com oferta pronta pra preencher meta.

### Campaign

Vive em `App.state.campaigns`. Vinculada a um produto.

```ts
{
  id: number,
  name: string,           // OBRIGATÓRIO
  productId: number,      // OBRIGATÓRIO
  status: string,         // 'Ativa' | 'Pausada' | 'Em planejamento'
  sector?: string,
  owner?: string,
  objective?: string,
  blueprintId?: number,
  createdAt: string
}
```

### Action

Vive em `App.state.actions`. Pertence a uma campanha.

```ts
{
  id: number,
  campaignId: number,     // OBRIGATÓRIO
  name: string,           // OBRIGATÓRIO
  channel: string,        // OBRIGATÓRIO. RD Station, Instagram Ads, Meta Ads, Google Ads, WhatsApp, LinkedIn, Email, SDR, Outbound, Webhook, Outro
  actionType: string,     // OBRIGATÓRIO. Post, Campanha, Sequência, Automação, Ligação, Remarketing, Webinar, Nutrição, SDR, Email, LP, Checkout, CRM, CS, Outro
  sector: string,         // OBRIGATÓRIO: 'Marketing' | 'Vendas' | 'CS'
  funnel: string,         // OBRIGATÓRIO: 'TOF' | 'MOF' | 'BOF'
  strategicAreaId?: string,   // 'marketing' | 'vendas' | 'cs' — vincula ao KR-mãe da área
  parentKrId?: string,
  connectedActionIds?: number[],
  leads?: [],
  flow?: {
    enabled?: boolean,
    startStage?: string,
    endStage?: string
  },
  createdAt: string
}
```

### Lead

Vive em `App.state.actions[].leads` (por ação) OU `App.state.globalLeads` (base global).

```ts
{
  id: string | number,
  name: string,
  email: string,
  phone?: string,
  tags?: string[],
  behaviorTags?: string[],
  score?: number,
  globalScore?: number,
  temperature?: string,
  rdContactId?: string,
  createdAt: string
}
```

Leads vêm via: conversão LP (pixel), upload manual no Buscador, pull RD Marketing, Hotmart webhook (V35.1).

### KR (Mapa da Receita)

Vive em `App.state.strategicMaps[productId].objectives[].okrs[]`. Cada KR tem **par de metas** (filosofia Doerr):

```ts
{
  id: string,
  metric: string,
  current: number,
  startValue: number,
  targetCommitted: number,   // Meta SEGURA (piso obrigatório)
  targetStretch: number,     // Meta AVANÇADA (sonho)
  target: number,            // compat (= targetCommitted)
  period: number,            // dias (7/15/30/90/180)
  confirmed: boolean,        // cravado E completo
  area?: string,             // 'marketing' | 'vendas' | 'cs'
  connectedActionIds: number[],
  catalogId?: string,
  isHandoff?: boolean,
  parentProductKrId?: string,  // vincula KR-filho ao KR-mãe pra rollup
  campaignId?: number          // se vinculado a uma campanha específica
}
```

`strategicOkrEngine.scoreStatus(kr)` classifica em 4 níveis:
- 🚀 Bateu Meta Avançada (`score >= 1.0`)
- ✓ Bateu Meta Segura (`progress >= 100%`)
- 🟡 Em progresso (`progress >= 70%`)
- 🔴 Em risco (`progress < 70%`)

**Saúde do Produto (V38.x)** usa esse status pra calcular o fator K. Detalhes em [[health-score]].

### Execução (Task no gestor de projeto)

Vive em `App.state.executionTasks[]` (cache local). Tasks vêm do provider configurado (ClickUp, Trello, Monday, Jira, Notion, ou Manual).

```ts
{
  id: string,
  external_id: string,        // ID na plataforma original
  provider: string,           // 'clickup' | 'trello' | ...
  linked_action_id: number,   // ação LJ vinculada
  name: string,
  status: string,             // NORMALIZADO: 'pending' | 'in_progress' | 'completed' | 'closed' | 'custom_*'
  due_date?: string,
  start_date?: string,
  assignee?: string,
  url?: string
}
```

**`status === 'completed'`** é o flag oficial de "task concluída". Usado pelo `ExecutionStatusEngine.executed` e pelo cálculo de Eficácia da Saúde do Produto.

### Score

```ts
{
  id: number,
  name: string,
  tagRules: [
    { tag: '#open', score: 5 },
    { tag: '#cta', score: 30 }
  ]
}
```

Default `id: 1`, "Score comportamento padrão".

## Estágios do funil (9)

```
mkt_tof, mkt_mof, mkt_bof          → Marketing TOF/MOF/BOF
vnd_tof, vnd_mof, vnd_bof          → Vendas TOF/MOF/BOF
cs_onboarding, cs_retencao, cs_expansao  → CS
```

## Tools disponíveis no Djow

`api/djow-chat.js` expõe (server-side, executam tools direto no `req.tenantDb`):
- `create_product({ name, type?, price?, revenueModel?, ... })` — cria produto + 1 oferta default
- `create_campaign({ name, productId, ... })`
- `create_action({ campaignId, name, channel, actionType, sector, funnel, ... })`
- `get_revenue_summary({ productId? })` — resumo financeiro do produto
- `list_campaigns({ productId? })`
- `get_campaign({ campaignId })`
- `get_funnel_health({ productId? })` — análise do funil
- `get_top_leads({ campaignId?, limit? })`
- `list_pending_tasks({ assignee?, limit? })` — tasks do gestor
- `query_state({ path })` — leitura arbitrária do App.state
- `search_kb({ query })` — busca semântica nesse próprio KB

Tools resolvem credencial via `lib/credentials-owner.js` (usuário membro do tenant = vê credencial do owner).

## Confirmação

Por convenção:
- **Criação** (produto/campanha/ação): direto, sem confirmação. Idempotência não é crítica.
- **Mutação de credencial** (token ClickUp, RD, etc): só owner ou master. `assertCanWriteCredentials(req)` joga 403 caso contrário.
- **Destrutivo** (delete, purge, reset): SEMPRE perguntar "Confirma X? sim/não" e esperar resposta.

## Informações sigilosas (NUNCA expor)

Responder educadamente "Não posso te mostrar essa informação — é sigilosa do sistema":

- `password_hash` de users
- Env vars: ANTHROPIC_API_KEY, JWT_SECRET, MASTER_PASSWORD, DATABASE_URL, ENCRYPTION_KEY, RD_WEBHOOK_SECRET, RESEND_API_KEY, CRON_RECONCILE_TOKEN
- Tokens criptografados em `*_credentials` (clickup, rd, hotmart, google_ads, ga4)
- `users.password_reset_*` columns (info de gestão interna)
- `tenant_invites.token` ativos
