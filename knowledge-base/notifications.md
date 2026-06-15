# Notifications V2 — Sininho expandido

> KB ativa pro Djow. Maduro desde V37.4.0–V37.4.16.

## Conceito

Sininho V2 é o **canal único** de notificações do tenant. Absorve alertas legados (ClickUp, RD, Reconciliation, Lead Import, Health Check), releases do LJ, eventos automáticos (produto/campanha/ação criados), e handoffs entre membros (incluindo Pin-Up).

## Tabela `notifications` (no tenant DB)

```sql
id BIGSERIAL PRIMARY KEY,
tenant_id INT NOT NULL,
audience_user_ids INT[],         -- pra quem aparece (vazio = tenant_wide)
category VARCHAR,                -- 'handoff' | 'event' | 'state' | 'operational' | 'integration' | 'health'
severity VARCHAR,                -- 'critical' | 'warning' | 'info'
kind VARCHAR,                    -- 'event.product_created', 'handoff.pin_mentioned', etc
title VARCHAR(255),
body TEXT,
data JSONB,                      -- payload custom (pinId, productId, etc)
entity_kind VARCHAR,             -- 'pin' | 'product' | 'release' | ...
entity_id VARCHAR,
created_at TIMESTAMPTZ DEFAULT NOW(),
expires_at TIMESTAMPTZ,          -- some sozinha após esse momento
seen_by_user_ids INT[],
saved_by_user_ids INT[],
archived_by_user_ids INT[]
```

## Engine + Emit

- `lib/notification-engine.js` — query helpers, filtros, dedup
- `lib/emit-notification.js` — função `emit(req, { audience, kind, category, severity, title, body, data, entityKind, entityId, expiresAt })`

3 disparos automáticos cravados:
- `event.product_created` (V37.4.3) — em `Actions.createProduct`
- `event.campaign_created` — em `Actions.createCampaign`
- `event.action_created` — em `Actions.createAction`

Pin-Up dispara `handoff.pin_mentioned` quando alguém crava pin marcando audience.

## Endpoints

- `GET /api/notifications-list?status=inbox|saved|archive&category=X&severity=Y` — lista paginada
- `POST /api/notification-update` — body `{ id, action: 'read'|'save'|'archive'|'unread' }`
- `GET /api/notification-preferences` — preferências do user (V37.4.6)
- `POST /api/notification-preferences-update` — toggle por categoria + opt-in digest semanal
- `GET /api/notifications-daily-summary?since=ISO` (V37.4.4) — usado pelo Bom Dia card (que virou linha no card Alertas Importantes em V37.4.32)

## Frontend

### Drawer estilo Linear (V37.4.2)

`src/modules/notificationsPanel.js`:
- 3 abas: **Inbox** / **Salvos** / **Arquivo**
- Filtros: por categoria + severidade
- Triagem rápida: hover mostra ações "marcar visto" / "salvar" / "arquivar"
- Cluster automático por `kind` quando >3 notifs do mesmo tipo (V37.4.19 — label humano "4 atualizações desde ontem")

### Roteamento por click (V37.4.9)

`Actions.handleNotificationClick(id)` faz switch por `kind`:
- `handoff.pin_mentioned` → abre pin (mesmo aba se possível, redirect se diferente)
- `data.action === 'open_recon'` → abre modal de Reconciliação
- `data.action === 'open_releases'` → abre modal de Releases
- etc

### Cluster do Bom Dia → card Alertas Importantes (V37.4.32)

Antes: chip "X atualizações desde ontem" flutuante no topo da Home.
Depois: vira primeira linha do card "Alertas importantes" no canto direito inferior. Click abre sininho.

### Preferences + Digest (V37.4.6)

Configurações → Notificações:
- Toggle por categoria (handoff/event/state/operational/integration/health)
- Opt-in "Receber digest semanal por email" — segunda-feira 9h

## Releases viram notification individual (V37.4.16)

Cada bump no `src/core/changelog.js` aparece como notification separada (`kind: 'event.lj_release'`), com `audience` = tenant_wide. Cluster "X atualizações" agrupa quando >3.

## TopBar (V37.4.7–V37.4.10)

`src/modules/topBar.js`: ícone sino + ícone pin + ícone Djow shortcut. Sticky no flow (não cobre conteúdo). Drawer do sininho passa por cima quando aberto. Root próprio fora do #app.
