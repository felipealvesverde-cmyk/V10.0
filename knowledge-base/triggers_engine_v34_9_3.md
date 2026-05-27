# Triggers Engine — V34.9.3

**Status:** Spec fechada, aguardando implementação
**Decisor:** Felipe Alves
**Data:** 2026-05-27
**Versão alvo:** V34.9.3

---

## 1. Contexto e Problema

O LJ tem **9 estágios fixos** (Marketing/Vendas/CS × TOF/MOF/BOF). Hoje só existem **3 regras hardcoded** de transição em `lib/lj-promotion-rules.js`:

1. `form_submit + email/phone` → Suspect vira Lead em **Marketing MOF**
2. `payment_confirmed` (Hotmart) + email/phone → Lead vira Customer em **CS TOF**
3. Mesmo do (2), mas pra Suspect que compra direto

**Resultado prático no Sansone:** 500 leads em `Marketing TOF`, **zero** em todos os outros 8 estágios. Lead entra e fica parado, porque 7 dos 9 estágios não têm regra de transição cravada.

O **Mapa da Receita** é o desenho estratégico (objetivos, ações, OKRs). Os **Triggers** são o motor que faz o desenho acontecer:

```
Mapa da Receita (desenho)
       ↓
Ação executada gera evento (pageview, click, form_submit, payment...)
       ↓
Trigger captura → move lead de estágio
       ↓
Flow Map mostra movimento
       ↓
Receita prevista do Mapa começa a se realizar
```

**Mapa = o quê e por quê. Trigger = quando e como.**

---

## 2. UI / Localização

### 2.1 Botão de abertura

Botão fixo no card **Revenue Flow Map**, **depois do dropdown MVP** (campanha). Substitui a antiga linha de controles removida em V34.9.2.

### 2.2 Granularidade

**Por campanha.** Cada campanha tem seu próprio conjunto de triggers. Ao trocar o dropdown de campanha, os triggers do modal mudam pra refletir a nova campanha selecionada.

### 2.3 Permissão

Só **usuários master** (admin do tenant) podem criar/editar/deletar triggers. Cliente comum vê mas não modifica.

### 2.4 Layout do modal

```
┌─ Triggers da campanha [MVP] ──────────────────────┐
│ [🔄 Espelhar triggers de outra campanha ▼]        │
├────────────────────────────────────────────────────┤
│ TRIGGERS MASTER (pulam etapas)                     │
│   ▸ Pagamento aprovado → [CS TOF ▼]                │
│   ▸ Tag lj-perdido → [SAIR ▼]                      │
│   ▸ Tag lj-cancelamento → [SAIR ▼]                 │
│   ▸ Tempo: [5] dias inativo → [Marketing TOF ▼]    │
│   ▸ Score atingiu [900] → [Vendas TOF ▼]           │
│   ▸ Demo agendada → [Vendas BOF ▼]                 │
│   [+ Adicionar trigger master]                     │
├────────────────────────────────────────────────────┤
│ PARES DE TRANSIÇÃO                                 │
│                                                    │
│ ┌─ Marketing TOF → Marketing MOF ───────[3/7d]──┐ │
│ │ Triggers configurados:                          │ │
│ │ ● [Form] /lp-checkout                  [ATIVO]  │ │
│ │ ● [CTA] /comprar                       [ATIVO]  │ │
│ │ ● [Tag] lj-quente                      [INATIVO]│ │
│ │ [+ Adicionar trigger]                           │ │
│ └─────────────────────────────────────────────────┘ │
│                                                    │
│ ┌─ Marketing MOF → Marketing BOF ───────[0/7d]──┐ │
│ │ Sem triggers configurados.                     │ │
│ │ [+ Adicionar trigger]                          │ │
│ └─────────────────────────────────────────────────┘ │
│                                                    │
│ ... (mais 6 pares: MKT BOF→Vendas TOF; Vendas    │
│      TOF→MOF; Vendas MOF→BOF; Vendas BOF→CS TOF;  │
│      CS TOF→MOF; CS MOF→BOF)                       │
└────────────────────────────────────────────────────┘
```

**Aba lateral "Config avançada" (AND)** — placeholder **inativa no MVP**. Permitirá no futuro: "form X **E** tag Y → move" (em vez de OR padrão).

### 2.5 Espelhar Triggers

Ao clicar:
- Dropdown lista outras campanhas com triggers configurados
- Cliente escolhe → copia triggers da campanha origem **substituindo só os faltantes** (preserva os atuais da campanha destino, adiciona o que não tem)

### 2.6 Contador no Flow Map

Cada par de transição mostra ao lado do título um contador discreto **"X movimentações nos últimos 7 dias"**. Útil pra ver funil "vivo".

---

## 3. Modelo de Dados

### 3.1 Tabela nova: `lj_transition_rules` (tenant DB)

```sql
CREATE TABLE IF NOT EXISTS lj_transition_rules (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  campaign_id INT NOT NULL,
  -- Master ou normal:
  is_master BOOLEAN NOT NULL DEFAULT FALSE,
  -- Origem: NULL pra Master (qualquer estágio)
  from_stage VARCHAR(32),
  -- Destino: estágio dos 9, OU 'EXIT' (sai da campanha)
  to_stage VARCHAR(32) NOT NULL,
  -- Tipo: 'cta' | 'form' | 'pageview' | 'tag' | 'payment' | 'time' | 'score'
  trigger_type VARCHAR(16) NOT NULL,
  -- Parâmetro (URL, nome tag, número de dias, etc) interpretado conforme tipo
  trigger_param TEXT,
  -- Campo extra pra Tempo (dias) — Score (valor numérico)
  trigger_value_int INT,
  -- Toggle ativo/inativo (Felipe — pode pausar sem deletar)
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  -- Origem da criação (ui | espelho | seed)
  created_via VARCHAR(16) DEFAULT 'ui',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transition_rules_campaign
  ON lj_transition_rules(user_id, campaign_id, is_active);
CREATE INDEX IF NOT EXISTS idx_transition_rules_lookup
  ON lj_transition_rules(user_id, campaign_id, trigger_type, is_active)
  WHERE is_active = TRUE;
```

### 3.2 Audit log: `lj_transitions` (já existe, ampliado)

Cada disparo grava em `lj_transitions` **com referência ao `trigger_rule_id`** pra debug "por que esse lead moveu?".

```sql
ALTER TABLE lj_transitions ADD COLUMN IF NOT EXISTS triggered_by_rule_id INT;
```

Quando lead sai da campanha (via Master `lj-perdido` ou Cancelamento), o histórico de `lj_transitions` daquela campanha **é preservado** (não apaga). Útil pra você ver depois "foi perdido vindo de qual estágio".

### 3.3 Sair da campanha

Quando trigger Master `lj-perdido` ou `lj-cancelamento` dispara:
- `DELETE FROM lj_visitor_campaign_state WHERE user_id = $1 AND lj_visitor_id = $2 AND campaign_id = $3`
- `lj_visitors` (base global) **preservado**
- Lead some do Flow Map dessa campanha, mas continua na base global
- Pode entrar em outra campanha depois (novo registro de campaign_state)

### 3.4 Pagamento

Pagamento aprovado **NÃO sai da campanha**. É Master que move o lead pra `CS TOF` e continua trabalhando upsell/cross-sell na mesma campanha.

---

## 4. Catálogo de Tipos

| Tipo | Campo livre | Como o LJ interpreta |
|---|---|---|
| **CTA** | URL | Lead clica num botão/link com essa URL → dispara |
| **Form** | URL, ID **ou** nome do form | LJ reconhece os 3 formatos. Submit → dispara |
| **Pageview** | URL | Lead visita essa URL → dispara |
| **Tag** | Nome da tag | Tag adicionada/removida ao visitor → dispara. 1 trigger por tag (se quer outra, cria novo) |
| **Pagamento** | (sem campo) | Auto-detect: se Hotmart API conectada, badge verde "configurado pra cliente ganho". Sem parametrização. |
| **Tempo** | Dias (int) + endpoint configurável | Master. Cron diário varre visitors, se inativo >= dias, move pro endpoint |
| **Score** | Valor (int) | Master. Score atingiu/cruzou este valor → move pro endpoint |

**Removidos do MVP** (voltam depois):
- **WhatsApp** (click no botão)
- **Email** (abertura/click — vira tag via mapping RD, então acessado via tipo Tag)

---

## 5. Triggers Master (MVP)

Master = pulo de etapas com **destino editável pelo cliente** (todos configuráveis).

| Master | Destino default | Configurável? |
|---|---|---|
| Pagamento aprovado | CS TOF | ✓ |
| Tag `lj-perdido` | SAIR (DELETE campaign_state) | ✓ |
| Tag `lj-cancelamento` | SAIR | ✓ |
| Tempo: N dias inativo | configurado pelo cliente | ✓ (dias + destino) |
| Score atinge N | configurado pelo cliente | ✓ (valor + destino) |
| Demo agendada | Vendas BOF | ✓ |

Cliente pode criar masters customizados além desses 6 (botão "+ Adicionar trigger master").

---

## 6. Engine de Execução

### 6.1 Refactor de `lib/lj-promotion-rules.js`

Hoje regras são hardcoded em array JS. Vira **dinâmico**: lê de `lj_transition_rules` por (user_id, campaign_id).

```js
// API nova:
async function findMatching(tenantDb, userId, campaignId, visitor, eventType, payload) {
  const r = await tenantDb.query(
    `SELECT * FROM lj_transition_rules
      WHERE user_id = $1 AND campaign_id = $2
        AND is_active = TRUE
        AND trigger_type = $3
        AND (is_master = TRUE OR from_stage = $4)
      ORDER BY is_master DESC, id ASC`,
    [userId, campaignId, eventType, visitor.current_stage]
  );

  for (const rule of r.rows) {
    if (matchesParam(rule, visitor, payload)) return rule;
  }
  return null;
}
```

### 6.2 Lógica OR (múltiplos triggers no mesmo par)

Cada trigger é independente. **Qualquer um que matche** dispara o movimento. Não precisa AND no MVP.

### 6.3 Lead já em estágio à frente

Lead em `Vendas MOF`. Trigger `TOF → MOF` dispara via evento.

**Decisão:** ignora silenciosamente. Não move, não loga, não retrocede. O `findMatching` filtra por `from_stage = visitor.current_stage` antes de retornar a rule.

### 6.4 Cron de Tempo

Endpoint novo: `POST /api/cron-time-triggers` (auth: master JWT OR X-Cron-Token).

```
Pra cada user com triggers de tipo 'time':
  Pra cada campanha do user com triggers de tipo 'time' ativos:
    Pra cada visitor em lj_visitor_campaign_state daquela campanha:
      diasInativo = (NOW() - visitor.last_seen_at) / 1 dia
      Pra cada trigger de tipo 'time' da campanha:
        se diasInativo >= trigger.trigger_value_int:
          aplicaTransicao(visitor, trigger)
```

Cron externo dispara diariamente.

**Importante:** o cron de Tempo considera **só os triggers de Tempo da campanha onde o visitor está**. Se um lead está em 2 campanhas, cron processa cada campanha independentemente.

### 6.5 Auto-detect Hotmart pra trigger Pagamento

Quando cliente cria trigger Master "Pagamento aprovado":
- Front consulta status da integração Hotmart (já tem endpoint `/api/hotmart-status`?)
- Se conectada: badge verde "configurado pra cliente ganho" ao lado do trigger
- Se não conectada: badge âmbar "configure Hotmart em Integrações" com link

Trigger fica criado de qualquer jeito. Só não dispara enquanto integração estiver desconectada.

---

## 7. Comportamento — Edge Cases

| Cenário | Comportamento |
|---|---|
| Trigger novo criado | Nasce **ativo** (default) |
| Toggle inativo | Trigger não dispara mas fica salvo. Pode reativar. |
| Lead em estágio à frente, trigger dispara | Ignora silenciosamente |
| Lead em 2 campanhas, trigger de Tempo | Cada campanha processa independente |
| Lead sai (perdido/cancelado) | DELETE `lj_visitor_campaign_state`. `lj_visitors` preservado. |
| Lead que saiu volta? | Pode entrar em outra campanha depois (novo registro). Histórico transitions preservado. |
| Espelhar triggers existindo conflito | Preserva os existentes, adiciona só os faltantes |
| 2 triggers do mesmo par disparam simultâneo | OR — qualquer um move. Não duplica movimento (já está no estágio destino). |
| Hotmart desconectado mas trigger Pagamento criado | Trigger salvo, não dispara, badge âmbar avisa |

---

## 8. Djow (placeholder MVP)

Djow é **habilitado** no modal mas **não é foco**:
- Botão "Djow assistente" no canto do modal
- Cliente escreve em linguagem natural ("quando o lead clica no botão de checkout, ele vira BOF")
- Djow interpreta e oferece criar o trigger estruturado (tipo + param)
- Cliente revisa e confirma
- **MVP**: só interface visual, integração com Djow pode ficar pra próxima onda

---

## 9. Fora do MVP (futuras ondas)

- **Aba "Config avançada" (AND)** — combinar 2+ triggers com lógica AND
- **WhatsApp** como tipo
- **Email** como tipo dedicado (hoje vira tag)
- **Visualização de quem disparou cada trigger** (drill down no contador)
- **Versionamento de triggers** — histórico de mudanças nas regras
- **Triggers compartilhados entre tenants** — biblioteca de templates
- **Djow autônomo sugerindo triggers** baseado em observação de eventos

---

## 10. Sequência de Implementação

1. **Schema** — `lj_transition_rules` em `lib/tenant-db-schema.sql` + ALTER `lj_transitions` pra coluna `triggered_by_rule_id`
2. **Engine** — refactor de `lib/lj-promotion-rules.js` pra ler do DB (mantém compat com regras hardcoded antigas como fallback durante migração)
3. **Endpoints**:
   - `GET /api/triggers?campaign_id=X` — lista triggers da campanha
   - `POST /api/triggers` — cria trigger
   - `PATCH /api/triggers/:id` — atualiza (toggle ativo, mudar param)
   - `DELETE /api/triggers/:id` — remove
   - `POST /api/triggers/mirror` — espelha de outra campanha
   - `POST /api/cron-time-triggers` — cron diário de Tempo
4. **State + Actions** (frontend):
   - `App.state.triggersModal` (open, campaignId, triggers, loading)
   - `Actions.openTriggersModal()`, `loadTriggers()`, `createTrigger()`, etc
5. **UI**:
   - Botão no Flow Map (depois do dropdown campanha)
   - Modal completo (Master + Pares + Espelhar)
   - Contador "X movimentações em 7d" nos pares do Flow Map
6. **Tests** — fluxo end-to-end com 1 trigger de cada tipo
7. **Bump V34.9.3 e push staging**

---

## 11. Memórias relacionadas

- `[[vocabulario-tags-definitivo]]` — `lj-perdido` segue convenção `lj-` prefix
- `[[v33-orchestration-architecture]]` — 9 estágios fixos vêm dessa onda
- `[[rd-crm-api]]` — tags do RD são fonte pro tipo Tag (sync via webhook + cron-rd-pull)
- `[[v34-leads-banco-tagueamento]]` — bancos podem virar gatilho num futuro próximo
