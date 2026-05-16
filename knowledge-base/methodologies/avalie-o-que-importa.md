# Avalie o que importa — John Doerr (Measure What Matters)

> Frameworks do livro de John Doerr (2018). Base pro Mapa de Receita.
> KB carregada em V26.3.1 (2026-05-16).

## Contexto histórico

Andy Grove (CEO Intel anos 70-80) inventou os **OKRs** evoluindo o "Management by Objectives" do Peter Drucker. Acrescentou "Key Results" mensuráveis. John Doerr aprendeu na Intel, levou pro Google em 1999 (Larry + Sergey adotaram), e dali pra todo Vale do Silício.

**Premissa fundamental**: o problema das empresas não é falta de boas ideias, é **execução**. OKRs são uma disciplina de execução com transparência radical.

## Os 4 Superpoderes dos OKRs (FACTS)

Doerr define 4 "superpoderes":

### 1. **Focus** (Foco)
Escolher o que **NÃO** fazer. Limite máximo de **3-5 Objectives por ciclo**. Mais que isso, perde foco.

> "Se tudo é prioritário, nada é prioritário."

**Aplicação operacional**: se uma empresa lista 12 prioridades pro trimestre, 10 não vão acontecer. Forçar a corte.

### 2. **Align** (Alinhamento)
OKRs **públicos** (todo mundo vê o de todo mundo). Cada nível da empresa puxa do nível acima:
- Company OKRs → Department OKRs → Team OKRs → Individual OKRs

**Híbrido top-down + bottom-up**: ~50% dos OKRs nascem dos times (não do CEO mandar). Engagement.

### 3. **Track** (Acompanhamento)
**Check-in semanal** ou bi-semanal. Scoring transparente. Não é "marca no fim do trimestre" — é vivo.

Scoring de KR: **0.0 a 1.0** baseado em % atingido. 
- 0.0–0.3 = vermelho (não aconteceu)
- 0.4–0.6 = amarelo (progresso real, falhou em escalar)
- 0.7–1.0 = verde (sucesso)

**Para STRETCH OKRs**: 0.7 = sucesso. Bateu 1.0? Estabeleceu meta tímida demais.
**Para COMMITTED OKRs**: 1.0 ou nada. Tem que entregar.

### 4. **Stretch** (Ousadia)
OKRs ambiciosos (10x, não 10%). Google chama de "moonshots".

> "Não confunda ambição com expectativa irreal. Stretch goals devem ser difíceis MAS plausíveis."

Se a equipe sempre bate 100%, as metas estão fracas. Time deve sentir tensão produtiva.

## Estrutura de um OKR

### Objective — QUALITATIVO

- O que vc quer atingir
- **Aspirational, memorable, time-bound**
- Linguagem inspiradora
- 1-2 frases máximo

**Exemplos bons**:
- "Tornar-se o produto líder de gestão de receita no mercado SaaS B2B Brasil"
- "Construir uma operação previsível e escalável de aquisição"

**Exemplos ruins**:
- "Crescer" (vago)
- "Atingir R$10M ARR" (já é métrica, não objetivo)

### Key Results — QUANTITATIVOS

3-5 KRs por Objective. Cada um:
- **Measurable** (número, taxa, percentual)
- **Specific** (não "melhorar X" — "X de A pra B")
- **Time-bound** (até quando)
- **Verifiable** (auditável — alguém de fora consegue ver se atingiu)

**Exemplos bons**:
- "Aumentar MRR de R$200k pra R$350k até 31/dez"
- "Reduzir CAC de R$1.500 pra R$900 até final do Q4"
- "Atingir NPS de 65 (de 47) até dezembro"

**Exemplos ruins**:
- "Ter mais clientes" (não específico)
- "Melhorar atendimento" (não mensurável)

## Tipos de OKRs

### Committed (Compromisso)
- Obrigatório bater 100%
- Não pode falhar (riscos operacionais, contratuais, regulatórios)
- Exemplo: "Migrar 100% dos clientes pro novo billing até 30/jun"

### Aspirational / Stretch (Aspiracional)
- 70% = sucesso
- Pode falhar — falhar não pune (encoraja ousadia)
- Exemplo: "Lançar em 5 países da LATAM até dezembro"

Mistura recomendada: 60% committed + 40% stretch.

## Cascateamento — Mapa de OKRs

Como OKRs descem pela organização:

```
Company OKR
    Objective: Tornar-se líder em RevOps no Brasil
        KR1: ARR R$15M (atual R$8M)
        KR2: NPS >= 70
        KR3: 30 case studies publicados

↓ ladders into ↓

Marketing OKR (puxa do KR1 e KR3 da Company)
    Objective: Construir pipeline previsível pra suportar 2x ARR
        KR1: Gerar 800 MQLs/mês (atual 350)
        KR2: CAC <= R$1.200 (atual R$1.800)
        KR3: 18 case studies criados (atual 4)

Sales OKR (puxa do KR1 da Company)
    Objective: Escalar conversão SQL→Won
        KR1: Win rate 28% (atual 18%)
        KR2: ARR fechado R$7M (atual R$3.5M)
        KR3: Ciclo médio 45 dias (atual 72)

CS OKR (puxa do KR2 da Company)
    Objective: Construir base feliz que renova e expande
        KR1: NRR 115% (atual 92%)
        KR2: NPS 72 (atual 50)
        KR3: Churn anual < 8% (atual 18%)
```

**Princípio crítico**: cada KR de baixo serve diretamente um KR ou Objective de cima. Se não serve, **NÃO É OKR — é só uma tarefa**.

## Ritmo de OKRs

### Cadência típica
- **Anual**: Company OKRs
- **Trimestral**: Department/Team OKRs (mais granulares)
- **Semanal**: check-ins de progresso

### O ciclo
1. **Set** (1ª semana do trimestre): definir + alinhar
2. **Mid-quarter review** (6-7 semanas dentro): ajustes, kill OKRs que perderam relevância
3. **End-of-quarter scoring** (última semana): score 0.0-1.0 cada KR
4. **Retrospective** (após scoring): lições + setup do próximo ciclo

## OKRs vs KPIs — diferença que MUITA gente confunde

- **KPI**: medida contínua de saúde operacional. Sempre tá lá. Ex: NPS, churn mensal, MRR.
- **OKR**: meta de mudança/melhoria em um período. Tem prazo. Ex: "Subir NPS de 50 pra 70 em 3 meses".

KPI é o **termômetro**. OKR é o **projeto de melhorar a temperatura**.

Um OKR pode ter como KR um valor de KPI que vc quer mover. Mas KPI sem prazo/movimento não é OKR.

## CFRs — Conversations, Feedback, Recognition

Doerr argumenta que OKRs sem CFRs são vazios. CFR substitui a "avaliação anual de performance" (modelo falido).

### Conversations
1:1 estruturadas regulares (semanal/quinzenal) entre líder e liderado. Pauta:
- Como tá o progresso dos seus OKRs?
- O que tá te bloqueando?
- O que vc precisa de mim/da empresa?
- Como tá sua carreira?
- Tem feedback pra mim?

### Feedback
Multi-direcional + frequente. Não "1x por ano com 360" — **toda semana**:
- Reconhecer wins na hora
- Apontar gaps na hora
- Pedir feedback DE LIDERADO (subir liderança)

### Recognition
Público + frequente. Quando alguém faz algo notável, **toda a empresa vê**. Em ferramentas (Slack, Teams), em rituais (all-hands).

> "OKRs são um motor. CFRs são o combustível."

## Erros comuns ao implementar OKRs

### 1. Definir mais de 5 OKRs por ciclo
Perde foco. Forçar máximo 3 por área, 1-3 KRs por Objective.

### 2. KRs sem medida clara
"Melhorar X" não é KR. **De A pra B até Z** é KR.

### 3. Cascatear de forma puramente top-down
Cria desengajamento. ~50% deve vir dos times (bottom-up). CEO valida, não impõe.

### 4. Confundir tarefa com KR
"Lançar feature X" é tarefa. "Adoption da feature X >= 40%" é KR.

### 5. Esconder OKRs
OKRs precisam ser **públicos internamente** (toda empresa vê todo OKR). Transparência radical.

### 6. Punir falha em stretch OKR
Stretch é pra ser difícil. Se time falhou em stretch, **valida tentativa ousada**. Caso contrário, próxima vez vão pôr metas tímidas.

### 7. Não fazer check-in
OKR sem ritual semanal vira folha de papel. Discussão deve acontecer em rituais existentes (1:1, weekly team, sprint review).

### 8. Tratar OKR como contrato de performance
OKR mede progresso. **Salário/bônus** deve estar atrelado a CFR + outras coisas, não a score 1.0 direto. Caso contrário, todo mundo seta meta fácil.

## Templates para o Mapa de Receita

### Template Company-Level (Anual)

```
Objective: <Visão grande do ano em 1 frase>

KR1: <Métrica de receita> — de <atual> pra <meta>
KR2: <Métrica de eficiência> — de <atual> pra <meta>
KR3: <Métrica de cliente/produto> — de <atual> pra <meta>
KR4: <Métrica de time/cultura, opcional>
```

### Template Marketing (Trimestral)

```
Objective: <Como Marketing contribui pra Company OKR>

KR1: MQLs gerados — de X pra Y
KR2: CAC — de X pra Y
KR3: Conversion rate TOF→MOF — de X% pra Y%
KR4: Pipeline R$ contribuído — meta R$ Z
```

### Template Sales (Trimestral)

```
Objective: <Como Sales contribui pra Company OKR>

KR1: ARR fechado — meta R$ X
KR2: Win rate — de X% pra Y%
KR3: Sales velocity — de X pra Y
KR4: Cycle time — de X dias pra Y dias
```

### Template CS (Trimestral)

```
Objective: <Como CS contribui pra Company OKR>

KR1: NRR — de X% pra Y%
KR2: Churn anual — de X% pra Y%
KR3: Expansion MRR — meta R$ Z
KR4: NPS — de X pra Y
```

## Como o Djow usa essa KB no Mapa de Receita

Quando user clica em "Mapa de Receita" no Produto e pede pro Djow ajudar:

1. **Diagnóstico inicial** (Djow pergunta):
   - Qual é o objetivo macro do ano? (vai virar Company Objective)
   - Qual receita atual vs onde quer chegar? (vai virar KRs financeiros)
   - Quais áreas o user tem mapeadas (Marketing/Sales/CS)? (vai cascatear)

2. **Estruturação** (Djow propõe):
   - Company OKR com 3-5 KRs no formato Doerr
   - Cascateia: cada área recebe Objective + KRs que servem os Company KRs
   - Mostra ligação visual: "este KR de Marketing serve este KR da Company"

3. **Refinamento** (Djow critica):
   - KR sem prazo? Aponta
   - KR vago? Sugere específico
   - Mais de 5 KRs por Objective? Sugere cortar
   - Falta um KR de eficiência (só tem de growth)? Sugere balanço

4. **Validação stretch vs committed**:
   - Pergunta ao user pra cada KR: "committed ou stretch?"
   - Stretch usa benchmark de 0.7 = sucesso

5. **Ritmo**:
   - Sugere cadência (anual + trimestral + semanal)
   - Aponta que precisa rituais CFR pra OKRs não morrerem

## Recomendações Djow ao usar Doerr framework

1. **User pede "uma estratégia anual"**: redirecionar pra OKR structure (não plano genérico).
2. **User lista 10 prioridades pro trimestre**: aplicar Focus — forçar corte pra 3-5.
3. **KR sem número**: nunca aceitar. "Melhorar X" → exigir "X de A pra B".
4. **Empresa sem ritual de OKR**: recomendar implementar weekly check-in antes de qualquer outra coisa.
5. **OKRs ocultos (só CEO conhece)**: transparência radical. Recomendar publicar pra empresa toda.
