# Multi-tenant — Tenant compartilhado de verdade

> KB ativa pro Djow. Cravado em V37.4.29 + V37.4.34.

## Conceito

LeadJourney é multi-tenant **de verdade desde V37.4**: tenant é uma operação compartilhada, não um login replicado.

Hierarquia:
- **LJ Master** (Felipe) — controla TODOS os tenants. `users.is_master=true`.
- **Tenant** — uma empresa cliente (ex: "Sansone Management").
- **Owner do tenant** — o dono. Conecta integrações, controla membros.
- **Membros** — adicionados pelo owner com role (manager/user) e overrides.

## State per-tenant (V37.4.29)

### Antes (V37.3.x e anteriores)
- `journey_state.user_id` PK — cada user tinha seu próprio LJ
- Owner editava produtos/campanhas/ações → ninguém mais via
- Convidar membro = ele entrava num LJ vazio

### Depois (V37.4.29+)
- **Nova tabela** `tenant_state(tenant_id PK, state_json JSONB, last_writer_user_id, updated_at)` no tenant DB
- Owner edita → todos os membros do tenant veem no próximo F5 ou sync (60s)
- Last-write-wins via `last_writer_user_id` (auditoria)

### Migration

Endpoint `/api/admin-migrate-tenant-state` (POST, master ou owner): cria a tabela `tenant_state` no tenant DB + importa o state do owner.

Sem rodar a migration, o tenant continua usando `journey_state` legacy (compat backward total).

### Dual-write transitório

`api/state-sync.js` escreve em AMBAS as tabelas:
- `tenant_state` (source of truth)
- `journey_state` (backup pra rollback se algo der ruim)

Quando estável (1-2 dias sem incidente), o write em `journey_state` vai sair. Backlog V38.x.

### Read priority
1. `tenant_state` (se existe row pro tenant)
2. `journey_state` legacy (fallback)
3. `null` (produto novo / tenant sem state ainda)

## Integrações per-tenant (V37.4.34)

### O problema

Tabelas de credencial (`clickup_credentials`, `rd_credentials`, `hotmart_config`, `google_ads_config`, `ga4_config`, `score_rules`, `governance_closings`, `triggers`) usavam `user_id` como chave (legado pré-V32).

Quando member novo entrava no tenant compartilhado (V37.4.29), todas as integrações apareciam DESCONECTADAS — porque a query filtrava pelo SEU user_id (que nunca conectou).

### O fix

Helper centralizado `lib/credentials-owner.js`:

```js
const { resolveCredentialOwnerId, assertCanWriteCredentials, CredentialPermissionError } = require('../lib/credentials-owner');

// Em GETs (qualquer membro do tenant lê):
const userId = await resolveCredentialOwnerId(req);
const cred = await req.tenantDb.query('SELECT ... FROM clickup_credentials WHERE user_id = $1', [userId]);

// Em POST/DELETE (só owner ou master):
await assertCanWriteCredentials(req);  // joga 403 se não for
```

**Sem migration de schema**. A resolução é runtime via `tenant_members WHERE role='owner'`. Cache em `req._credOwnerId` evita N queries.

### Permission law

- **Manager/user**: LÊ status, USA integrações (criar task, sync leads, ver dashboards)
- **Owner / Master**: pode TROCAR token, DESCONECTAR, ver PAT em texto cru

`clickup-reveal-pat.js` aplica `assertCanWriteCredentials` mesmo sendo GET — token é sensível.

### Endpoints refatorados (~60)

ClickUp (17): config, connect-pat, tree, mappings-list, metadata, pull-action-subtasks, pull-task-statuses, proxy, reveal-pat, set-list, setup-space, spaces-list, test-space, update-settings, user-tasks-count, delete-mirror, migrate-to-mirror, rename-mirror, list-fields, create-task, oauth-init

RD (9): credentials, proxy, marketing-refresh, webhook-failures-summary, purge-deals-by-pipeline, full-diagnostic, debug-deal-link, visitors-rd-debug, leads-impute-rd-push

Hotmart (3): config, dashboard-metrics, event-suggestions

Google Ads (3): config, oauth-init, sync-trigger

GA4 (3): config, oauth-init, reports-list

Outras configs do tenant (~25): score-rules, score-recalc, visitor-score-breakdown, icp-profile, known-tags, triggers, triggers-mirror, transitions-summary, reconciliation-alerts, governance-closings, substages, visitors-update, visitors-enrich-names, visitors-merge, visitors-find-duplicates, visitors-pending-counts, visitors-purge-all, leads-impute-to-campaign, leads-dedup-preview, leads-import-batch, campaign-pipeline-counts, djow-chat

### Exceções (continuam per-user)

- `api/user-ai-config.js` — chave Anthropic pessoal
- `api/clickup-oauth-callback.js`, `api/google-ads-oauth-callback.js` — callbacks públicos com state CSRF
- `api/rd-webhook.js`, `api/rd-token.js` — webhook/legado público
- Crons (`cron-daily-tick.js`, `cron-time-triggers.js`) — sem req.user
- `djow_conversations`/`djow_messages` — histórico Djow é PESSOAL de cada membro

## Membros + Convites (V37.3.x)

### Convidar membro

`POST /api/tenant-invite-create` (master ou owner):
- Body: `{ email, role: 'manager'|'user', permissions_overrides? }`
- Gera token único, salva em `tenant_invites`, expira em 7d
- Email automático via Resend (V37.3.0) com link `/?invite=TOKEN`
- Se SMTP off ou Resend falhar, owner copia o link manual

### Aceitar convite

Página `/?invite=TOKEN` → `POST /api/tenant-invite-accept` (PÚBLICO):
- Valida token + expira
- Cria user em `users` (ou usa user existente se email já cadastrado)
- Insere `tenant_members` com role + permissions_overrides
- Marca convite como `accepted_at`

### Cancelar convite

`POST /api/tenant-invite-cancel` (master ou owner): rejeita se já aceito, manda usar Membros.

### Self-healing pra logins legados (V37.4.20)

`api/auth-backfill-membership.js`: user pré-V37.3 sem `tenant_members` row é criado como owner (se único) ou user.

## Resolver tenantId quando JWT é pré-V37 (V37.4.21)

`lib/permission-check.js` fallback: se `req.user.tenantId` é null/undefined, lê `users.default_tenant_id`. Permite users com JWT velho continuar funcionando.
