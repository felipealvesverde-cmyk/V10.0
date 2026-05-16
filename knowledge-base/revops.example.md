# RevOps — Princípios e Diagnósticos (Exemplo)

> Este é um arquivo EXEMPLO. Renomeie pra `revops.md` (sem `.example`) pra ativar.

## Quando o funil tá "vazando" no MOF

Sinais:
- Conversão TOF→MOF acima de 50%, mas MOF→BOF abaixo de 20%
- Tempo médio em estágio MOF > 14 dias
- Lead score médio em MOF não sobe ao longo do tempo

**Diagnóstico provável**: faltam ações de qualificação (email nurturing, webinars, conteúdo bottom-of-mid).

**Recomendação ao user**: olhar ações cadastradas no MOF. Se < 3 ações ativas, sugerir criar campanha de nurturing.

## CAC vs LTV — regras de bolso

| LTV/CAC | Diagnóstico |
|---|---|
| < 1 | Sangrando dinheiro. Pausar campanhas pagas urgente. |
| 1-3 | Crescendo no negativo. Otimizar canal de aquisição. |
| 3-5 | Saudável. Pode escalar gastos com cuidado. |
| 5+ | Excelente. Acelerar investimento. |

## Quando alertar sobre dependência de canal único

Se 1 canal traz > 60% dos leads:
- Risco operacional alto (algoritmo muda → operação para)
- Recomendar diversificar pra 3+ canais com peso 30/30/30/10

## Quando recomendar revisar ICP

Sinais de ICP desatualizado:
- Score médio de leads em queda
- Conversão BOF < 5%
- CS reportando churn > 8%

→ Sugerir refazer Revenue Score com dados dos últimos 90 dias.
