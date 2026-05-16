# Financial Ops — Frameworks (KB Djow)

> Starter populado em V26.3.0 (2026-05-16). Refinar com tempo.

## CAC (Customer Acquisition Cost)

Custo total pra adquirir 1 cliente pagante.

$$ CAC = \frac{\text{Soma de gastos em Vendas + Marketing no período}}{\text{Novos clientes pagantes no período}} $$

**Inclui em "gastos"**:
- Salários + benefícios de Marketing e Vendas
- Mídia paga (Google, Meta, LinkedIn ads)
- Ferramentas (CRM, automation, analytics)
- Eventos, conteúdo, etc.

**NÃO inclui**:
- Custo do produto (CS, infra, suporte) — isso é COGS, não CAC

### CAC por canal

Sempre quebrar CAC por canal de aquisição:
- CAC Orgânico
- CAC Pago (subdivide por plataforma)
- CAC Outbound (SDR-driven)
- CAC Referral

Um canal pode estar puxando média pra baixo enquanto outros sangram.

### CAC payback period

Quanto tempo demora pra recuperar o CAC.

$$ \text{Payback} = \frac{CAC}{\text{Gross Margin mensal}} $$

**Benchmark SaaS**:
- < 12 meses: excelente
- 12-18 meses: saudável
- 18-24 meses: aceitável (early stage)
- \> 24 meses: risco (precisa muito capital)

## LTV (Lifetime Value)

Valor total que 1 cliente médio gera ao longo da relação.

### Formula simples (B2B SaaS subscription)

$$ LTV = \frac{ARPU \times \text{Gross Margin}}{\text{Churn rate mensal}} $$

Onde ARPU = Average Revenue Per User (receita mensal média por cliente).

Exemplo: ARPU R$500/mês, GM 75%, churn 2%/mês
- LTV = (500 × 0.75) / 0.02 = R$18.750

### Formula com expansion (NRR-based)

$$ LTV = \frac{ARPU \times GM}{\text{Net Churn rate}} $$

Onde Net Churn = Churn - Expansion. Pode ficar NEGATIVO se NRR > 100% (expansion > churn). Aí LTV vira infinito teoricamente — sinal de produto sticky.

## LTV / CAC Ratio

A métrica mais importante de SaaS depois de growth rate.

$$ \text{Ratio} = \frac{LTV}{CAC} $$

**Benchmark**:
| Ratio | Diagnóstico |
|---|---|
| < 1 | Vermelho. Tá perdendo dinheiro em cada cliente. Parar de gastar em aquisição agora. |
| 1-3 | Crescendo no negativo. Otimizar antes de escalar. |
| 3-5 | Saudável. Pode escalar com confiança. |
| > 5 | Excelente. Pode investir mais agressivo em aquisição (talvez tá subinvestindo). |

3x é o "golden rule" do VC.

## MRR / ARR

- **MRR (Monthly Recurring Revenue)**: receita recorrente mensal. Foundation de SaaS.
- **ARR (Annual Recurring Revenue)**: MRR × 12.

### Quebra do MRR

$$ MRR_{novo \, mes} = MRR_{anterior} + \text{New MRR} + \text{Expansion MRR} - \text{Contraction MRR} - \text{Churned MRR} $$

Tracking saudável separa esses 5 movements em waterfall.

## Magic Number

Mede eficiência de growth.

$$ \text{Magic Number} = \frac{(MRR_Q - MRR_{Q-1}) \times 4}{\text{Gasto em Sales+Marketing no trimestre anterior}} $$

**Benchmark**:
- < 0.5: ineficiente. Cortar S&M ou melhorar conversão.
- 0.5-0.75: ok pra early stage.
- 0.75-1.0: bom.
- \> 1.0: ótimo. Investir mais em growth.

## Rule of 40

Pra SaaS de growth stage:

$$ \text{Growth rate %} + \text{Profit margin %} \geq 40\% $$

Empresa pode crescer rápido E queimar (50% growth, -10% margin) OU crescer devagar E lucrar (20% growth, 20% margin). Mas a soma precisa bater 40%.

Abaixo de 40 = problema. Investors usam pra avaliar.

## Burn Multiple

Quanto vc queima pra cada R$ de novo ARR.

$$ \text{Burn Multiple} = \frac{\text{Net Burn (cash)}}{\text{Net New ARR}} $$

**Benchmark (Bessemer)**:
- < 1.0: excelente
- 1.0-1.5: bom
- 1.5-2.0: aceitável
- 2.0-3.0: precisa atenção
- \> 3.0: ruim, queimando demais

## Quick Ratio (David Skok)

$$ \text{Quick Ratio} = \frac{\text{New MRR} + \text{Expansion MRR}}{\text{Churned MRR} + \text{Contraction MRR}} $$

Mede crescimento líquido. > 4 é saudável SaaS.

Se Quick Ratio < 1, a empresa tá ENCOLHENDO (perdendo mais MRR do que ganhando).

## Net Dollar Retention (NDR) / Net Revenue Retention (NRR)

Já mencionado em CS Ops mas merece ser financeiro:

$$ NDR = \frac{MRR_{start} + Expansion - Downgrade - Churn}{MRR_{start}} $$

Calcula por cohort:
- Pega o MRR da cohort no mês 0
- Mede o MRR daquela MESMA cohort 12 meses depois (sem contar novos clientes)

> 100% = base atual cresceu sozinha (expansion compensa churn).

Empresas top-tier (Snowflake, etc.): 140%+. SaaS B2B saudável: 105-115%.

## Pricing strategies

### 1. Per-seat (per-user)
Cobra por usuário. Slack, Notion. Pro: escala linear com cliente. Con: limita adoção por motivos de custo.

### 2. Usage-based
Cobra por consumo. AWS, Stripe, Twilio. Pro: cliente cresce, vc cresce. Con: receita imprevisível.

### 3. Tiered
Planos com diferentes features/limites. HubSpot. Pro: capture value em diferentes ICPs.

### 4. Platform fee + usage
Mensalidade fixa + variável. Boa pra produtos que escalam.

### 5. Flat-rate
1 preço, qualquer uso. Mais simples. Limita upside.

Boa estratégia: começar simples (flat ou per-seat), evoluir pra tiered conforme entende ICPs.

## Unit Economics em B2B

Pra avaliar saúde:

| Métrica | Saudável |
|---|---|
| LTV/CAC | > 3 |
| CAC Payback | < 12 meses |
| Gross Margin | > 70% (SaaS) |
| Burn Multiple | < 2 |
| NRR | > 100% |
| Quick Ratio | > 4 |

Se 5 das 6 estão verdes, a operação é financeiramente saudável.

## Cash management

Runway = dinheiro em caixa / burn mensal.
- < 12 meses: alerta. Começar fundraising agora ou cortar.
- 12-18 meses: prudente.
- 18-24+ meses: confortável.

**Default-alive vs default-dead** (Paul Graham): empresa é default-alive se com o crescimento atual chega à break-even antes de acabar o caixa.

## Recomendações Djow comuns em Financial Ops

1. **LTV/CAC < 3**: priorizar redução de CAC OU aumento de LTV. Geralmente o caminho é melhorar GM/retention.
2. **CAC Payback > 18 meses**: rever canais de aquisição. Algum tá inflando.
3. **NRR < 100%**: implementar motion de expansion antes de subir gastos com aquisição.
4. **Magic Number < 0.5**: parar growth, focar em eficiência (qualificação melhor, automação, redução de churn).
5. **Burn Multiple > 2**: questionar onde o capital tá sendo queimado. Geralmente é S&M sem retorno proporcional.
6. **Sem unit economics rastreado**: implementar dashboard mensal (LTV, CAC, NRR, Burn, Runway) antes de qualquer outra coisa estratégica.
