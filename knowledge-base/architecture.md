# LeadJourney — Arquitetura (resumo pro Djow)

> Knowledge base ATIVA. Carregado no system prompt do Djow.
> Atualizado em V38.0.3 (2026-06-15).

## Visão de 10 segundos

LeadJourney é um **Revenue Operating System multi-tenant** (web app vanilla JS + Express backend + Postgres). Roda no Railway. Cada tenant é uma empresa cliente; cada empresa tem 1 owner + N membros colaborando na mesma operação.

A hierarquia conceitual da operação:

```
Tenant
  └─ Membros (owner / gerente / usuário)
  └─ Produtos
       └─ Ofertas (main / cross-sell / up-sell / down-sell)
            └─ Preço, mix, meta de vendas
       └─ Campanhas
            └─ Mapa da Receita (Visão + KRs Marketing/Vendas/CS)
            └─ Ações
                 └─ Execuções (tasks no gestor de projeto)
                 └─ Leads (passam pelo funil)
                      └─ Score → Conversão
```

A **Saúde do Produto** é a métrica única que mede o estado dessa pilha (ver [[health-score]]).

## Stack

- **Frontend**: HTML/CSS/JS vanilla, namespace `window.X = X`. SEM build, SEM framework. Tailwind via CDN.
- **Backend**: Node.js + Express. Endpoints em `api/*.js` montados auto em `/api/<nome>`.
- **DB**: Postgres. **2 planos**:
  - **Control plane DB** (`req.db`): tabelas globais — users, tenants, tenant_members, tenant_invites, user_action_tokens, app_secrets.
  - **Tenant DB** (`req.tenantDb`): cada tenant tem seu próprio Postgres plugado via `db_connection_string_enc`. Contém tabelas de dado operacional — tenant_state, journey_state (legacy), journey_snapshots, djow_conversations/messages, notifications, pins, governance_closings, lj_visitors/leads, score_rules, credenciais de integração.
- **Auth**: JWT bcrypt + middleware no `server.js`. JWT contém `sub` (user_id), `tenantId`, `isMaster`, `mode`.
- **IA**: Djow plugado em Claude API (Sonnet 4.6 default, configurável). Resolve API key via `lib/ai-resolver` (master env → master-shared → user key).

## Multi-tenant — colaboração real (V37.4.29 + V37.4.34)

A V37 trouxe a virada: tenant deixou de ser arquitetura formal e virou comportamento.

- **State per-tenant**: tabela `tenant_state` (PK = tenant_id) substitui `journey_state` per-user. Owner edita produtos/campanhas/ações → todo membro do tenant vê. Dual-write transitório com `journey_state` legado pra rollback. Migration `/api/admin-migrate-tenant-state`.
- **Integrações per-tenant**: helper `lib/credentials-owner.js` exporta:
  - `resolveCredentialOwnerId(req)` — retorna o user_id do owner do tenant (em runtime, via cache em `req`)
  - `assertCanWriteCredentials(req)` — joga 403 se não-owner tenta mutar credencial
- ~60 endpoints (ClickUp, RD, Hotmart, Google Ads, GA4, score, governance, triggers) usam o helper. Manager/user comum LÊ e USA credencial do owner; só owner controla.

Mais detalhes em [[multi-tenant]].

## Permission System (V37.3.1)

3 roles + overrides granulares:
- **Master LJ** — acesso global a TODOS os tenants. Master no app = `is_master=true` em users.
- **Owner do tenant** — controla integrações, membros, governance do seu tenant.
- **Gerente** / **Usuário** — diferentes níveis de acesso, customizáveis via `tenant_members.permissions_overrides` JSONB.

Engine: `lib/permission-engine.js`. Endpoint debug: `/api/auth-debug-perms`. Frontend role-gating consome `App.state.userPermissions`.

Mais detalhes em [[permission-system]].

## Estado (App.state)

State global vive em `window.App.state`, JSONB sincronizado entre browser e Postgres via `RemoteSyncAdapter` (debounce 2s). Pós V37.4.29, pra tenants migrados, leitura vem de `tenant_state` (compartilhado entre membros), escrita faz dual-write em `tenant_state` + `journey_state`.

Campos principais (ver `src/core/state.js`):

- `products: []` — produtos cadastrados
- `campaigns: []` — campanhas vinculadas a produtos
- `actions: []` — ações dentro de campanhas (canal, funil, leads, flow)
- `globalLeads: []` + `actions[].leads: []` — base de leads
- `strategicMaps: {}` — Mapa da Receita por produto (Visão + KRs por área M/V/CS)
- `revopsFinanceV2: {}` — config financeira por produto: **offers[]**, groups (custos), customKpis, dreExtraLines
- `metasResultado: {}` — meta de vendas por produto+mês (LEGACY V37.0.0; migrada pra `offers[].metaVendas` em V38.0.3)
- `scores: []` — regras de scoring
- `notificationsCache: {...}` — sininho V2
- `pinUp: {pinsForCurrentUrl, createModal, viewModal, editModal}` — Pin-Up
- `homeProductIndex` — produto vigente no Pulso da Receita (rotação 7s)
- `user: {}` — display name, email, role, tenantId
- `userPermissions` — permissões efetivas calculadas pelo permission-engine

**Lei de novo campo (V37.4.39)**: todo `App.state.X` novo precisa entrar em `State.initial()` E `State.normalize()`, senão F5 droppa. Toda action `loadX()` que busca backend precisa load em `src/main.js` init() (senão F5 = tela vazia).

## Módulos UI (src/modules/*.js)

- `home.js` — página Início (Pulso da Receita + cards + box Djow + card Alertas Importantes)
- `products.js` — CRUD de produtos. Hero é overview agregado (V38.0.2). Card do produto mostra Camp/Ações/Execuções + Saúde.
- `campaigns.js` — CRUD de campanhas
- `actions.js` — CRUD de ações
- `leads.js` — Base de leads + Buscador de Perfil + Journey Pipeline
- `scores.js` — regras de scoring
- `dashboard.js` — KPIs, gráficos, RD Email stats, **sub-tab Tarefas Por Pessoa** (V37.1)
- `settingsModal.js` — configurações (Banco, RD, ClickUp, Hotmart, Google Ads, GA4, Agentes/Djow, **Membros do Tenant**, **Minha Conta**, Backup)
- `membersPanel.js` — listar/editar membros, convidar, resetar senha (V37.3-V37.4.28)
- `notificationsPanel.js` — drawer estilo Linear (V37.4)
- `topBar.js` — TopBar com sino + pin + Djow shortcut
- `pinUp.js` — sistema de pins/comentários no contexto (V37.5+)
- `djowAIModal.js` — modal flutuante Djow (Ctrl+K)
- `strategicMapModal.js` — Mapa da Receita (Etapas 1-5)
- `revopsGovernance/revopsWhitelabelPanel.js` — RevOps Whitelabel (Fechamento/Custos/Ofertas/Resultado/RevOps KPIs/DRE)
- `fechamentoPanel.js` — Fechamento mensal (V37.0)

## Engines (src/engines/*.js + src/strategic-map/* + src/revenue-score/*)

- `productRevenueEngine.js` — preço, custo, margem, ARR/MRR
- `operationalAggregationEngine.js` — productMetrics(productId), aggregateAll() (V38.0.2)
- `flowResolutionEngine.js` — calcula flow (origem/destino/handoff/passagem) de cada ação no funil
- `revopsWhitelabelEngine.js` — engine financeira completa do RevOps (Ofertas, Custos, DRE). `defaultOffer()` (V38.0.3) cria oferta padrão.
- `strategicMapEngine.js` + `strategicOkrEngine.js` — Mapa da Receita: objectives, KRs com targetCommitted (Segura) + targetStretch (Avançada). `scoreStatus(kr)` classifica em 4 níveis.
- `notificationEngine.js` + `emit-notification.js` — notifications V2
- `revenueScoreEngine.js` — RevenueScore (V34)
- `triggersEngine.js` — V34.9.3 motor de transição entre stages

## Estágios do funil (9)

```
mkt_tof, mkt_mof, mkt_bof    (Marketing TOF/MOF/BOF)
vnd_tof, vnd_mof, vnd_bof    (Vendas TOF/MOF/BOF)
cs_onboarding, cs_retencao, cs_expansao  (CS)
```

## Integrações externas

### RD Station

3 tokens distintos:
- **CRM PAT**: token estático em `crm.rdstation.com/api/v1/*` via `?token=X`
- **CRM OAuth**: produto = "RD CRM" no Publisher RD. Usado em `api.rd.services/integrations/webhooks`
- **Marketing OAuth**: produto = "RD Marketing". Usado em `api.rd.services/platform/*`. Refresh token automático.

3 webhooks: `crm_deal_created`, `crm_deal_updated`, `crm_deal_deleted`.

### ClickUp

OAuth + PAT coexistem (V32.5.6). Token salvo em `clickup_credentials.access_token_enc` (criptografado).
Mirror Engine espelha Produto→Campanha→Ação no Space configurado.

### Hotmart

OAuth opcional. Dashboard com aba Checkout (V35.1). Conecta produtos LJ ↔ produtos Hotmart via `productIdHotmart`.

### Google Ads + GA4

OAuth flows com CSRF state. Sync de campaigns + transactions/sessões.

### SMTP (Resend)

Stub plug-and-play (V37.3.0). Sandbox `onboarding@resend.dev` só entrega pro email dono da conta — domínio próprio pendente (backlog V38.x).

**TODAS** as integrações resolvem credencial via `lib/credentials-owner.js`: cliente conectou pelo owner, tenant inteiro usa.

## Fechamento mensal (V37.0)

4 tipos de snapshot em `governance_closings`:
- `product_auto` — cron mensal, 1 por produto
- `product_custom` — cliente refecha manual
- `consolidated_monthly` — partial até cliente associar produtos
- `consolidated_custom` — wizard com escolha de produtos + mês

Download PDF via html2pdf.js. Reabertura registra `reopens_log` JSONB (snapshot original nunca é modificado).

## Saúde do Produto (V38.x — em desenvolvimento)

Score 0-100 que combina 4 dimensões:
- **E (Eficácia)**: % de tasks completas (status=completed) sobre tasks vinculadas a ações do produto
- **C (Cobertura)**: % das 3 áreas comerciais (M/V/CS) que têm KR confirmado
- **K (KR Health)**: média ponderada dos KRs (multiplicador — sem KR, Saúde=0)
- **R (Resultado)**: vendas_realizadas / soma_metaVendas das ofertas (cap em 1)

Fórmula: `Saúde = K × (0.4×E + 0.4×C + 0.2×R) × 100`

Detalhes completos em [[health-score]].

## Versionamento

Single source of truth: `window.LJVersion` em `src/core/version.js`.

- **Grande** (V37 → V38): mexe em vários módulos / virada conceitual
- **Média** (V38.0 → V38.1): nova feature contida ou refactor relevante
- **Pequena** (V38.0.0 → V38.0.1): bugfix, tweak de UX, copy

Toda release entry em `src/core/changelog.js` no mesmo commit. Master bump = relatório completo cumulativo (CLAUDE.md item 8).

## Onde NÃO mexer

- `node_modules/` — dependências
- `.env` ou env vars do Railway — segredos
- `password_hash` de users
- Tokens em `App.state.integrations.rd.*` (acesso só pelo Djow tools)
- `journey_state.state_json` direto sem `App.save()` (perde sync remoto)
- Tabela `tenant_state` direto — só via `/api/state-sync`

## Leis técnicas cravadas

1. **Migrations não rodam sozinhas** (`feedback_migrations_silent_failure_V37_4_22`): endpoints `admin-migrate-*` precisam ser chamados manualmente pós-deploy.
2. **Health check é read-only** (V36.8.3): never POST com body fake; sobrescrevia state e causou perda Sansone.
3. **Login não fica refém de migration** (V37.4.33): SELECT com coluna nova tem try/catch defensivo.
4. **Novo state field precisa normalize** (`feedback_new_state_fields_must_normalize`): senão F5 dropa.
5. **Toda feature loadX precisa init em main.js** (V37.4.39): senão F5 = vazio.
6. **Master changelog = relatório completo** (V38.0.0): cumulativo agrupado por tema.
