# Marketing Ops — Frameworks (KB Djow)

> Starter populado em V26.3.0 (2026-05-16). Refinar com tempo.

## Funil clássico TOF / MOF / BOF

- **TOF (Top of Funnel)**: descoberta. Lead nem sabe que tem dor. KPI: visitantes, alcance, impressões. Conteúdo: educacional, awareness.
- **MOF (Middle of Funnel)**: consideração. Lead sabe da dor, tá pesquisando soluções. KPI: leads capturados, MQLs. Conteúdo: comparativos, cases, frameworks.
- **BOF (Bottom of Funnel)**: decisão. Lead tá comparando vendors. KPI: SQLs, demos agendadas. Conteúdo: prova social, ROI calculator, trial.

**Sinais de funil saudável**:
- TOF→MOF: 5-15% conversão (tráfego não-pago)
- MOF→BOF: 10-25% conversão (MQL→SQL)
- BOF→Won: 15-30% conversão (SQL→cliente)

Se vê queda brutal em MOF→BOF, problema é qualificação ou produto/oferta. Em TOF→MOF, problema é mensagem ou captura.

## Bowtie / Hourglass Funnel

Estendeu o clássico pós-venda. Forma de gravata-borboleta: aquisição (TOF/MOF/BOF) → cliente (onboarding/adoption/expansion).

- **Onboarding**: time-to-value. Cliente novo precisa hit primeiro "aha moment" em 30 dias ou churn risk alto.
- **Adoption**: usage % de features chave. > 60% = saudável.
- **Expansion**: upsell/cross-sell. NRR > 110% é benchmark SaaS.

Recomendar quando: user só foca aquisição e churn alto silenciosamente.

## Pirate Metrics (AARRR)

Dave McClure. 5 estágios:

- **Acquisition**: como o lead chegou? Por qual canal?
- **Activation**: teve primeira experiência boa?
- **Retention**: voltou em N dias?
- **Referral**: indica pra outros? (NPS, referral program)
- **Revenue**: paga?

Útil pra startups. Bom pra mapear onde tá o "leak" do funil. Pergunta-chave: "qual desses 5 é o gargalo da semana?"

## MQL vs SQL — definições operacionais

- **MQL (Marketing Qualified Lead)**: lead que demonstrou interesse via comportamento (baixou material, abriu emails, clicou CTA). Marketing aprova: "tá no nosso ICP, parece quente".
- **SQL (Sales Qualified Lead)**: SDR/Sales validou via conversa — tem dor + budget + timing + autoridade. Tá pronto pra entrar em negociação.

Critério de promoção MQL→SQL deve ser **escrito e auditável** (SLA com Sales). Senão vira jogo de empurra ("isso aí não é SQL!").

## Lead Scoring — frameworks

### 1. Demográfico + Comportamental (2 eixos)
- **Fit (demográfico)**: cargo, empresa, segmento, tamanho — bate com ICP?
- **Intent (comportamental)**: ações recentes — clicou, abriu, visitou pricing, etc.

Quadrante: leads com alto fit + alto intent = priorizar.

### 2. Pontuação por evento (tag-based)
Atribui pontos por cada interação. Ex:
- Visitou home: 1 pt
- Baixou ebook: 10 pts
- Visitou pricing: 25 pts
- Abriu email: 5 pts
- Clicou CTA: 15 pts

Threshold definido (ex: 50pts = MQL, 100pts = SQL).

### 3. Decay temporal
Score envelhece. Lead que era quente 60 dias atrás e sumiu não vale 100. Implementar: multiplicar pontos por decay factor baseado em days_since_last_action.

## Modelos de atribuição

- **First touch**: 100% pro canal que trouxe pela primeira vez. Privilegia awareness.
- **Last touch**: 100% pro canal da conversão. Privilegia BOF/conversão.
- **Linear**: divide igualmente entre todos touchpoints.
- **Time decay**: peso maior aos touchpoints mais recentes.
- **U-shaped**: 40% first + 40% last + 20% middle.
- **Data-driven (Markov chain)**: peso calculado estatisticamente. Mais correto, mais complexo.

Recomendação: começar com **U-shaped** ou **linear**. Last-touch é cilada (subestima awareness).

## Demand Gen vs Inbound vs Outbound

- **Demand Gen**: cria demanda em quem nem sabia que tinha o problema. Conteúdo grosso, awareness, PR, eventos. Mensurável por **brand search lift** + leads que entram via direct/branded.
- **Inbound**: captura demanda já existente. SEO, content, landing pages. Mensurável por orgânico + paid search.
- **Outbound**: ativa contas frias (não pediram). Cold email, cold call. Mensurável por meetings booked.

3 motions complementares, não excludentes. Mix saudável: 60% inbound + 25% outbound + 15% demand gen.

## CPL, CPO, CAC — diferenças que confundem

- **CPL** (Cost per Lead): custo pra trazer 1 lead (qualquer cadastro).
- **CPO** (Cost per Opportunity): custo pra ter 1 SQL/oportunidade real.
- **CAC** (Customer Acquisition Cost): custo pra ter 1 cliente pagante.

Relação típica B2B: CPL R$50 → CPO R$300 → CAC R$1500.

Quando user diz "meu CAC tá em R$50", desconfia: provavelmente é CPL. Pede pra detalhar funil.

## Recomendações Djow comuns em Marketing Ops

1. **Funil sem MQL→SQL definido**: priorizar criar SLA escrito entre Marketing e Vendas.
2. **CAC muito alto com poucos clientes**: pedir pra olhar canal por canal (algum tá puxando média). Pode ser canal único que faz sentido pausar.
3. **Conversão TOF muito alta**: suspeitar de tráfego só de fã/branded. Pedir pra segmentar por canal.
4. **Lead score travado**: rever pesos, principalmente decay temporal.
