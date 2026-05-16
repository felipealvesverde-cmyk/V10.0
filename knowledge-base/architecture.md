# LeadJourney — Arquitetura (resumo pro Djow)

> Knowledge base ATIVA (não é .example). Carregado no system prompt do Djow.
> Atualizado em V26.2.0 (2026-05-16).

## Visão de 10 segundos

LeadJourney é um **Revenue Operating System** (web app vanilla JS + Express backend + Postgres). Roda no Railway.

A hierarquia conceitual da operação é:

```
Produto → Campanha → Ação → Execução (tarefa do gestor de projeto)
                 ↓
             Lead (passa pelo funil)
                 ↓
             Score → Receita
```

## Stack

- **Frontend**: HTML/CSS/JS vanilla, namespace `window.X = X`. SEM build, SEM framework. Tailwind via CDN.
- **Backend**: Node.js + Express. Endpoints em `api/*.js` montados auto em `/api/<nome>`.
- **DB**: Postgres no Railway. Tabelas: `users`, `journey_state`, `journey_snapshots`, `djow_conversations`, `djow_messages`, `app_secrets` (futuro).
- **Auth**: JWT bcrypt + middleware no `server.js`. Master + approved users.
- **IA**: Djow plugado em Claude API (Sonnet 4.6 default, configurável).

## Estado (App.state)

State global vive em `window.App.state`, JSONB sincronizado entre browser e Postgres via `RemoteSyncAdapter` (debounce 2s).

Campos principais (ver `src/core/state.js` para schema completo):

- `products: []` — produtos cadastrados
- `campaigns: []` — campanhas vinculadas a produtos
- `actions: []` — ações dentro de campanhas (canal, funil, leads, flow)
- `globalLeads: []` + `actions[].leads: []` — base de leads
- `scores: []` — regras de scoring (tagRules)
- `integrations.rd` — config RD CRM (PAT + OAuth Marketing + OAuth CRM)
- `integrations.rdCrm` — pipelines por campanha, deals
- `djowConfig` — model, allowedRoles do Djow
- `djowConversation` — última conversa em cache (histórico real no Postgres)
- `homeProductIndex` — produto vigente no Pulso da Receita (rotação 7s)

## Módulos UI (src/modules/*.js)

- `home.js` — página Início (Pulso da Receita + cards + box Djow)
- `products.js` — CRUD de produtos
- `campaigns.js` — CRUD de campanhas
- `actions.js` — CRUD de ações
- `leads.js` — Base de leads + Buscador de Perfil + Journey Pipeline
- `scores.js` — regras de scoring
- `dashboard.js` — KPIs, gráficos, RD Email stats
- `settingsModal.js` — todas as configurações (Banco, RD, Agentes/Djow, Execução, Usuários, Backup)
- `djowAIModal.js` — modal flutuante Djow (Ctrl+K)
- `actionLpModal.js`, `actionFlowModal.js`, `actionEditModal.js` — modais auxiliares de ação

## Estágios do funil (9)

```
mkt_tof, mkt_mof, mkt_bof    (Marketing TOF/MOF/BOF)
vnd_tof, vnd_mof, vnd_bof    (Vendas TOF/MOF/BOF)
cs_onboarding, cs_retencao, cs_expansao  (CS)
```

Pesos default no `RdCrmLeadScoringBridge`:
- Marketing: 4 / Vendas: 12 / CS: 18
- Stage: mkttof=1, mktmof=2, mktbof=4, vndtof=6, vndmof=10, vndbof=16, csonboarding=12, csretencao=14, csexpansao=18
- Cap: 60pts vindos de tags + score base do lead (max 100)

## Integrações externas

### RD Station (V21-V26)

3 tokens distintos:
- **CRM PAT**: token estático em `crm.rdstation.com/api/v1/*` via `?token=X`
- **CRM OAuth**: app criado no Publisher RD com produto = "RD CRM". Usado em `api.rd.services/integrations/webhooks`
- **Marketing OAuth**: app separado, produto = "RD Marketing". Usado em `api.rd.services/platform/*`

Endpoints úteis:
- `/api/rd-proxy` — proxy stateless pra contornar CORS do RD
- `/api/rd-token` — exchange/refresh OAuth
- `/api/rd-webhook` — recebe webhooks do RD (eventos: crm_deal_*, WEBHOOK.CONVERTED)
- `/api/rd-events-fetch` — frontend puxa eventos do buffer

3 webhooks ativos em prod: `crm_deal_created`, `crm_deal_updated`, `crm_deal_deleted`.

### Gestor de Projeto (Execução)

Suporta ClickUp, Trello, Monday, Jira, Notion ou modo Manual via `ExecutionProviderRegistry`. Tarefas viram "execuções" das ações.

## Versionamento

Single source of truth: `window.LJVersion` em `src/core/version.js`.

- **Grande** (V25 → V26): mexe em vários módulos / nova feature de plataforma
- **Média** (V26.0 → V26.1): nova feature contida ou refactor relevante
- **Pequena** (V26.1.0 → V26.1.1): bugfix, tweak de UX, copy

Toda mudança bump corresponde + commit message com versão + descrição.

## Onde NÃO mexer

- `node_modules/` — dependências
- `.env` ou env vars do Railway — segredos
- `password_hash` de users no Postgres
- Tokens em `App.state.integrations.rd.*` (crmPersonalToken, accessToken, refreshToken, clientSecret)
- `journey_state.state_json` direto sem usar `App.save()` (perde sync remoto)
