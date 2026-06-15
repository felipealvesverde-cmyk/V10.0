# Saúde do Produto — Score 0-100

> KB ativa pro Djow. Fórmula cravada em V38.x (em desenvolvimento — engine + modal vem em V38.1.0).
> Djow usa essa doc pra explicar Saúde no modal explicador (botão "?" no card do produto).

## Conceito

Saúde do Produto é o **número único** que mede o estado da operação de um produto. Combina 4 dimensões independentes em um score 0-100.

A leitura conta uma história clara: um produto pode estar com execução boa mas estratégia ruim, ou cobrir 3 áreas mas não vender, ou vender bem com só 1 área (deixando dinheiro na mesa). A Saúde reflete tudo isso num número.

## Fórmula

```
Saúde = K × (0.4 × E + 0.4 × C + 0.2 × R) × 100
```

Onde:
- **K** = KR Health (multiplicador 0-1) — produto sem KR nunca passa de 0
- **E** = Eficácia (0-1) — peso 40%
- **C** = Cobertura comercial (0-1) — peso 40%
- **R** = Resultado (0-1) — peso 20%

## Como cada fator é medido

### E — Eficácia (peso 40%)

`% de tasks concluídas` sobre tasks vinculadas a ações do produto.

```js
const tasks = action.flatMap(a => ExecutionTaskStore.byActionId(a.id))
const tasksTotal = tasks.length
const tasksDone = tasks.filter(t => t.status === 'completed').length
E = tasksTotal > 0 ? tasksDone / tasksTotal : 0
```

`task.status === 'completed'` é o flag normalizado em todos os providers (ClickUp, Trello, Monday, etc) via `ExecutionStatusEngine`.

**Edge case**: produto sem nenhuma task vinculada → E = 0. Modal Djow explica "ainda não tem execução conectada às ações".

### C — Cobertura comercial (peso 40%)

Quantas das 3 áreas comerciais (Marketing / Vendas / CS) têm KR confirmado.

```js
const areasComKr = ['marketing', 'vendas', 'cs'].filter(area => {
  const obj = strategicMap.objectives.find(o => o.area === area)
  return obj?.okrs?.some(kr => kr.confirmed)
})
C = areasComKr.length / 3
```

- C = 1.0 (3/3): cobertura plena
- C = 0.67 (2/3)
- C = 0.33 (1/3): "tá deixando dinheiro na mesa em 2 áreas"
- C = 0: nenhuma área com KR confirmado

### K — KR Health (MULTIPLICADOR 0-1)

K é multiplicador, não peso ponderado. Produto sem KR confirmado tem K=0 → Saúde = 0.

Lógica: cada KR confirmado do produto recebe um peso baseado no `strategicOkrEngine.scoreStatus(kr)`:

| Status do KR | Peso |
|---|---|
| 🚀 Bateu Meta Avançada (`score >= 1.0`) | **1.0** |
| ✓ Bateu Meta Segura (`progress >= 100%`) | **0.8** |
| 🟡 Em progresso (`progress >= 70%`) | **0.5** |
| 🔴 Em risco (`progress < 70%`) | **0.2** |
| Parado (`current = 0`) | **0** |

```js
const krs = strategicMap.objectives.flatMap(o => o.okrs).filter(k => k.confirmed)
if (!krs.length) {
  K = 0  // sem KR → multiplicador zera tudo
} else {
  K = krs.map(kr => weightForStatus(strategicOkrEngine.scoreStatus(kr).tier))
         .reduce((a, b) => a + b, 0) / krs.length
}
```

**Por que multiplicador**: KR é onde a estratégia toca a operação. Sem KR, não há estratégia em execução — não há como ter "boa saúde". Felipe cravou esta decisão em V38.x.

### R — Resultado (peso 20%)

`vendas_realizadas / meta_consolidada_do_produto`, cap em 1.0.

```js
const offers = revopsFinanceV2[productId]?.offers || []
const metaConsolidada = offers.reduce((s, o) => s + (o.metaVendas || 0), 0)
const vendasRealizadas = /* puxado de hotmart-dashboard-metrics quando integrado */
R = metaConsolidada > 0 ? Math.min(vendasRealizadas / metaConsolidada, 1) : 0
```

**Edge cases**:
- Produto sem oferta cadastrada (ou todas com meta=0) → R = 0, redistribuir pesos? Não — modal cobra "crava meta nas ofertas em RevOps → Ofertas"
- Produto sem checkout conectado (Hotmart) → R = 0 + modal pede pra conectar checkout
- Vendas > meta (bateu) → cap em 1.0 (não inflaciona Saúde acima de 100)

## Validação com casos típicos

| Cenário | E | C | K | R | Score | Diagnóstico |
|---|---|---|---|---|---|---|
| Tudo perfeito | 1 | 1 | 1 | 1 | **100** | Saúde plena |
| Vende bem mas execução fraca | 0.4 | 1 | 0.7 | 1 | **53** | Dinheiro na mesa (execução) |
| Vende com só 1 área | 1 | 0.33 | 0.5 | 1 | **37** | Dinheiro na mesa (cobertura) |
| Executa tudo mas não vende | 1 | 1 | 0.7 | 0.2 | **59** | Estratégia ruim (operação OK) |
| Sem KR confirmado | qualquer | qualquer | **0** | qualquer | **0** | Plano só no papel |
| Vazio | 0 | 0 | 0 | 0 | **0** | Tá morrendo |

## Modal explicador (UI cravada)

Botão "?" no card do produto abre modal com:
1. **Score grande** + label do gargalo (a dimensão com menor contribuição)
2. **4 fatores** cada um com: peso/valor/barra/contribuição em pts
3. **Balões Djow** por fator (lazy — 1 call retorna JSON com 4 análises + 1 veredito)
4. **Veredito Djow** final em tom de "giro de faca" — direto, sem rodeio, identifica o gargalo central e cobra ação acionável

Djow recebe contexto:
```json
{
  "product": { "name", "type", "revenueModel" },
  "scores": { "E", "C", "K", "R", "saude" },
  "raw": {
    "tasksTotal", "tasksDone",
    "areasComKr": ["marketing"],
    "krs": [{ "name", "status", "progress" }],
    "metaConsolidada", "vendasRealizadas"
  }
}
```

E retorna:
```json
{
  "byDimension": {
    "eficacia": "Tu termina o que planeja...",
    "cobertura": "Só Marketing? E quando...",
    "krs": "60% é o que tá puxando...",
    "resultado": "Vc tá voando sem instrumento..."
  },
  "verdict": "Atira.Pro tem fundação operacional sólida..."
}
```

Tom do veredito: mentor exigente que não enrola. Identifica o gargalo principal, cobra ação numerada acionável pros próximos 7 dias. NÃO é diplomático — é construtivo-crítico.

## Onde a Saúde aparece visualmente

- **Card do produto** (em Produtos): linha cheia abaixo do quadrante de KPIs Campanhas/Ações/Execuções. Mostra score + barra + label do gargalo + botão "?"
- **Cards do RevOps Overview** (V38.1.1): Saúde é 1 dos 6 KPIs de cada produto
- Modal explicador é onde a leitura DETALHADA acontece (não na linha do card)

## Lei de implementação

A Saúde NUNCA passa de 100. A Saúde NUNCA é negativa. O cálculo é determinístico (sem RNG). Mesma input = mesmo output.

Quando alguma dimensão não puder ser calculada (ex: meta não cravada), a Saúde **não panica nem chuta** — usa 0 e modal explica o que falta.
