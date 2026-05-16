# CS Ops — Frameworks (KB Djow)

> Starter populado em V26.3.0 (2026-05-16). Refinar com tempo.

## NRR vs GRR

- **GRR (Gross Revenue Retention)**: % de MRR retido sem contar upsell. Mede churn puro. >90% saudável SaaS B2B.
- **NRR (Net Revenue Retention)**: GRR + upsell/cross-sell. >110% é benchmark de SaaS top-tier. >120% é world-class.

NRR > 100% significa que mesmo com churn, a base existente cresce em receita (expansion compensa).

Fórmula NRR (mensal):
```
NRR = (MRR_inicio + Expansion - Downgrade - Churn) / MRR_inicio
```

## Customer Health Score

Indicador composto pra prever churn. Combina 4-6 dimensões. Exemplo de pesos:

| Dimensão | Peso | Como mede |
|---|---|---|
| Usage | 30% | % de features chave usadas / freq de login |
| Engagement | 20% | tempo último contato CSM, NPS, eventos |
| Adoption | 15% | % de seats ativados, integrações configuradas |
| Suporte | 15% | tickets/mês, severidade |
| Financeiro | 10% | pagamento em dia, expansão recente |
| Relacionamento | 10% | Champion ativo? Decision Maker engajado? |

Output: score 0-100. Verde >70, amarelo 40-70, vermelho <40.

## Lifecycle stages do cliente

Mapa clássico:

1. **Sign-up / Activation** (0-14 dias): teve primeiro valor?
2. **Onboarding** (15-60 dias): implementou? Time-to-Value (TTV).
3. **Adoption** (2-6 meses): tá usando regularmente?
4. **Expansion** (6+ meses): quer mais (upsell/cross-sell)?
5. **Renewal** (próximo do fim do contrato): vai renovar?
6. **Advocacy** (cliente feliz): vira case, referral, review.

CSM precisa saber em qual estágio cada conta tá. Cobertura: ~1 CSM pra cada R$1M-R$3M ARR (varia por complexidade).

## Onboarding playbook (60 dias)

**Dias 1-7**: Kickoff
- Reunião com Champion + Decision Maker
- Definir success criteria (qual número vai melhorar?)
- Time-to-first-value (TTFV): a primeira ação que gera resultado

**Dias 8-30**: Implementação
- Setup técnico (integrações, dados, users)
- 1 reunião semanal de status
- Capacitação do time do cliente

**Dias 31-60**: Adoção
- Validação: success criteria sendo atingido?
- Quick wins documentados
- Identificar potencial de expansão

**Red flag onboarding**:
- Champion sumiu nos primeiros 14 dias = 70% chance de churn em 6 meses
- TTFV > 30 dias = revisar processo
- < 50% dos seats ativados em 60 dias = problema de adoption

## Frameworks de Churn

### 1. Churn voluntário vs involuntário
- **Voluntário**: cliente cancela ativamente (dor com produto, sem valor)
- **Involuntário**: pagamento falhou (cartão expirado, problema financeiro)

Involuntário é 20-40% do churn em SaaS. Dunning automation reduz drasticamente (retry inteligente, comunicação).

### 2. Time-based churn
- **Early churn** (<3 meses): problema de onboarding/fit
- **Mid-stage churn** (3-12 meses): adoption fraca
- **Late churn** (>12 meses): perda de Champion, mudança de contexto

Cada um requer playbook diferente.

### 3. Cohort analysis
Mensurar retenção por cohort de assinatura. Ex: cohort de jan/24 tem retenção mensal:
- M1: 100%
- M2: 90%
- M3: 85%
- M6: 75%
- M12: 70%

Curva achata = produto sticky. Curva continua caindo = problema estrutural.

## Expansion playbook

Quando recomendar upsell/cross-sell:

**Sinais positivos**:
- Usou 90%+ do limite do plano por 2 meses seguidos
- Equipe cresceu (mais users adicionados sem upgrade)
- Pediu feature que tá em plano superior
- NPS >= 8 + Champion ativo
- ROI documentado e validado pelo decisor

**Sinais negativos** (não tente vender mais):
- NPS < 6
- Champion ausente / saiu da empresa
- Tickets recentes de severidade alta sem resolução
- Onboarding < 90 dias (cliente ainda não viu valor)

## Renewal motion

Pra contratos anuais, começa renewal 90 dias antes:
- **T-90**: review de uso + ROI + plano de continuidade
- **T-60**: proposta de renovação + possível upsell
- **T-30**: assinatura formal
- **T-0**: ativação do novo período

Se ninguém tocou cliente em T-30, churn risk vermelho.

## QBR (Quarterly Business Review)

Trimestral, executivo. CSM apresenta:
- Resultados atingidos (vs success criteria)
- Adoption metrics
- Roadmap conjunto
- Renewal/expansion outlook

Decisor + Champion na call. Cliente vê valor concreto = renova + indica.

Frequência: trimestral pra Enterprise, semestral pra Mid-Market, anual pra SMB.

## Recomendações Djow comuns em CS Ops

1. **Churn > 5%/mês**: red alert. Olhar cohort — é early ou late? Resolver causa raiz.
2. **NRR < 100%**: faltando motion de expansion. Sugerir QBR + playbook de expansion.
3. **CSM sem health score**: implementar mínimo viável (3 dimensões: usage + engagement + ticket severity).
4. **Champion único na conta**: risco. Plan B: mapear pelo menos 2 advocates em cada conta enterprise.
5. **Onboarding > 60 dias**: rever processo, falta foco em TTV.
