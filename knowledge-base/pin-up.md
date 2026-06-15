# Pin-Up — Comentários cravados no contexto

> KB ativa pro Djow. Estreado em V37.5.0, refinado até V38.0.1.

## Conceito

Pin-Up é estilo Figma: você crava um comentário em coordenadas X/Y específicas na tela, marca quem deve ver, e o pin aparece pra essa audience até ser arquivado ou expirar (7 dias).

## Fluxo

1. **Alt+P** ativa modo cravar (cursor crosshair)
2. Click em qualquer ponto da tela → coords salvas
3. Modal abre com: multiselect de membros + textarea 400 chars + botão Cravar
4. Submit cria pin + dispara notification `handoff.pin_mentioned` pra audience
5. Pin aparece como marker SVG na tela pra creator + audience
6. Hover mostra tooltip com preview
7. Click no marker abre modal completo com texto + ações
8. Criador pode Editar (texto + audience, posição imutável) ou Remover
9. Outros membros marcados podem Arquivar
10. Auto-expira em 7 dias

## Tabela `pins` (no tenant DB)

```sql
id BIGSERIAL PRIMARY KEY,
tenant_id INT NOT NULL,
creator_user_id INT NOT NULL,
target_url TEXT NOT NULL,        -- "/path#tab=<activeTab>" (V38.0.1 escopo por aba)
anchor_x_pct NUMERIC(6,3),       -- 0-100
anchor_y_pct NUMERIC(6,3),       -- 0-100
text VARCHAR(400),
audience_user_ids INT[] DEFAULT '{}',
seen_by_user_ids INT[] DEFAULT '{}',
archived_at TIMESTAMPTZ,
created_at TIMESTAMPTZ DEFAULT NOW(),
expires_at TIMESTAMPTZ
```

## Escopo do target_url (V38.0.1)

LJ é SPA → `window.location.pathname` é sempre `/`. Sem escopo, pin cravado na Home vazava pra Ações da campanha (mesmo X/Y, abas diferentes).

Fix: `PinUp._currentPinScope()` retorna `${pathname}#tab=${App.state.activeTab}`. Cada aba tem seu próprio namespace de pins.

Quando clica em notification de pin de outra aba, `handleNotificationClick` faz switch tab **in-place** (sem reload) se for mesmo pathname.

## Endpoints

- `POST /api/pin-create` — body `{ targetUrl, anchorXPct, anchorYPct, text, audienceUserIds }` (mínimo 1 audience)
- `POST /api/pin-edit` (V37.4.38) — body `{ id, text?, audienceUserIds? }` — só creator
- `POST /api/pin-action` — body `{ id, action: 'mark_seen'|'archive' }`
- `GET /api/pins-list?targetUrl=X` — lista ativos pra mim no escopo dado

## Importante (lição aprendida V37.4.36-39)

### NÃO fazer JOIN com `users` no tenantDb

`pins` mora no tenantDb. `users` mora no control plane. Em tenants com DB próprio plugado (V36.8.0+), `users` NÃO EXISTE no tenantDb → JOIN explode com `relation "users" does not exist`.

`pins-list.js` faz **2 queries separadas**:
1. Pins do tenantDb (sem JOIN)
2. Display names dos creators no control plane via `WHERE id = ANY($1)` (1 query agregada)
3. Compõe no JS

### IDs BIGSERIAL voltam como string (V37.4.37)

pg driver retorna BIGINT como string pra evitar precision loss. Mas `id` no JSON precisa ser number pra frontend `find(p => p.id === id)` funcionar. Solução: backend faz `Number(row.id)` antes de retornar.

### Load no boot (V37.4.39)

`Actions.loadPinsForCurrentUrl()` precisa rodar em `src/main.js init()` (com `setTimeout 100ms`). Sem isso, F5 deixa pinUp.pinsForCurrentUrl zerado e pins só voltam depois do user criar outro (que dispara reload no submit).

## Frontend

`src/modules/pinUp.js`:
- `bellButton()` — botão na TopBar (Alt+P shortcut também)
- `_captureOverlay()` — fullscreen overlay cursor=crosshair quando ativo
- `_pinsLayer()` / `_clusterBadge()` — render dos markers (cluster automático quando >5 pins na tela)
- `_pinMarker(p)` — SVG marker violet posicionado por % X/Y
- `_createModal(draft)` — modal de criar com multiselect + textarea
- `_viewModal(view)` — modal de ler. Criador vê botões **Editar** + **Remover**; outros veem só Arquivar (V37.4.38)
- `_editModal(draft)` — modal de edição (texto + audience; posição fixa)
- `_currentPinScope()` (V38.0.1) — retorna `${pathname}#tab=<activeTab>`
- `_maybeReloadOnScopeChange()` — detecta troca de aba e re-fetcha pins

## State

```js
App.state.pinModeActive: false,
App.state.pinUp: {
  pinsForCurrentUrl: [],
  createModal: null,
  viewModal: null,
  editModal: null,        // V37.4.38
  clusterExpanded: false
}
```

## Actions principais

- `togglePinMode()` — Alt+P / clique no botão
- `capturePinPosition(event)` — pega X/Y do click, abre createModal
- `submitPin()` — POST pin-create
- `loadPinsForCurrentUrl()` — GET pins-list pro escopo atual
- `openPinView(id)` / `closePinView()`
- `markPinSeen(id, silent?)` — POST pin-action action=mark_seen
- `archivePin(id)` / `deletePin(id)` — alias semântico pra creator (V37.4.38)
- `openPinEdit(id)` / `closePinEdit()` / `submitPinEdit()` — V37.4.38
- `togglePinAudience(userId, checked)` / `togglePinEditAudience(...)`
- `updatePinField(field, value)` / `updatePinEditField(...)`
