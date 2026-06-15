# Revenue Operations — Sean Lane & Laura Adint

Framework operacional pra **construir e escalar área de RevOps** (Revenue Operations). 4 partes: Construir conhecimento → Construir time → Tecnologia & processo → Parcerias & resultados. Use em diagnóstico de funil quebrado, atrito MKT↔Vendas↔CS, decisão de quando contratar RevOps, governança de CRM, forecast inconfiável.

> Citação útil: "Lane & Adint mostram no RevOps que ..."

## Parte 1 — Quando criar área de RevOps

### Sinais matemáticos (não "sentimento de bagunça")

- **CAC↑ sem ticket médio↑** → ineficiência de conversão interna do funil
- **LTV↓ por churn precoce** (cancelamento em 3-6 meses) → Vendas trazendo cliente errado pra bater meta
- **Produtividade por rep↓** → faturamento total cresce porque contratou mais gente, mas média individual está caindo (engrenagem saturada)

### Regra do ROI de RevOps

Gerente sem RevOps gasta tempo assim:

```
40% — extraindo relatório manual, limpando duplicado no CRM, planilha pra diretoria
30% — resolvendo problema técnico (integração caiu, validador parou)
30% — coaching, ligações, deals grandes (o que importa)
```

**Se gerente gasta 70% em ops, está pagando salário de liderança pra fazer trabalho de analista.** 1ª contratação de RevOps libera o gerente e paga o investimento imediatamente.

## Parte 1 — Know Your Numbers

### Pipeline Velocity (métrica soberana)

```
Velocidade (R$/dia) = (V × C × L) / T

V = Volume de oportunidades ativas no início do período
C = Taxa de conversão histórica real (decimal: 15% = 0,15)
L = Ticket médio real dos contratos fechados
T = Ciclo médio de venda em dias
```

### Simulação cravada do livro (volume × qualidade)

| | Empresa A (foco em volume) | Empresa B (foco em RevOps) |
|---|---|---|
| V (opps) | 200 | 120 (menos, mais qualificadas) |
| C | 10% | 15% (funil limpo) |
| L | R$ 10.000 | R$ 10.000 |
| T | 60 dias | 30 dias (assinatura digital, automação) |
| **R$/dia** | **R$ 3.333** | **R$ 6.000** |

Empresa B faz **quase o dobro de receita por dia** gastando menos pra atrair lead — só porque RevOps reduziu atrito e acelerou ciclo.

### Cohort Analytics + Auto-arquivamento

Se 90% das vendas fecham no Mês 0 da coorte e só 2% no Mês 2, no **dia 61** sem avanço o CRM marca "Perdido — Expirado por Tempo" e devolve pra fluxo de nutrição. Vendedor não desperdiça tempo em deal morto.

### SLA Dinâmico de MQL (Marketing Qualified Lead)

MQL ≠ "deu lead pra Vendas". MQL = matriz cruzada de **Perfil (ICP)** + **Comportamento (Intenção)**:

```
Lead baixa e-book                  → +5 pts comportamento
Lead visita página de preço        → +30 pts comportamento
Lead = Diretor (Perfil A)          → +50 pts perfil
                                    ─────────
Se total > 70 (corte): CRM carimba Status=MQL automático
Se Lead = estudante (Perfil D=0): bloqueia mesmo baixando tudo
```

### Roteamento Round Robin com Peso

Lead Enterprise entra? CRM verifica qual AE Enterprise está há mais tempo sem receber, atribui automático e dispara notificação no celular dele.

## Parte 1 — Know What You Sell

### 2 engrenagens separadas (pipelines DIFERENTES no CRM)

| Engrenagem de Volume (PLG / Transacional) | Engrenagem de Valor (Enterprise / Consultiva) |
|---|---|
| Cliente compra sozinho ou tira dúvida rápida | Ciclo longo, múltiplos decisores |
| RevOps automatiza tudo | RevOps obriga **Account Mapping** |
| Alerta de upsell pelo uso real do produto | Vendedor cadastra: **Campeão / Decisor Econômico / Detrator** |

Aplicar mesmo processo nos dois destrói os dados.

### Matriz de Alçada Sistêmica (anti-cultura-do-desconto)

```
Desconto ≤ 5%    → CRM gera PDF da proposta direto
Desconto 6-15%   → trava + aprovação obrigatória do Gerente
Desconto > 15%   → bloqueia + justificativa escrita pro CFO/RevOps
```

Vendedor tenta burlar mudando preço em campo livre? Integração com nota fiscal/contrato rejeita o arquivo (valida ID do produto × tabela centralizada do RevOps).

## Parte 2 — Time & Cultura

### Organograma centralizado (único modelo que funciona)

```
              [Líder de RevOps / CRO]
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
  [Data & Analytics] [System Admin] [Enablement]
   atribuição,       admin CRM,       playbook,
   coortes,          gatilhos,        treino na
   dashboards        roteamento       ponta
```

Modelo **descentralizado** (analista responde ao Diretor da área) FALHA — analista nunca diz pro chefe que os dados dele estão ruins. Modelo de **matriz** gera conflito de prioridade.

### Perfil da 1ª contratação ("Profissional Híbrido")

```
50% capacidade analítica rígida (SQL, lógica IF/THEN, admin CRM, Excel avançado)
50% habilidade política (mediar conflito MKT↔Vendas sem tomar partido)
```

Não é vendedor sênior promovido. Não é programador de TI puro.

### Pergunta de entrevista cravada

> "Se Diretor de Vendas pedir 10 campos de texto livre novos no CRM, qual sua reação?"

- **Errado:** "Crio na hora, meu papel é suportar Vendas." → Vai virar bagunça
- **Certo:** "Agendo reunião pra entender que decisão ele toma com isso. Proponho transformar em dropdown fixo e reduzir pra 2 campos essenciais."

### Clawback (estorno de comissão)

```
[Venda R$ 50k anual] → [Comissão R$ 2.5k]
                  │
           (Risco: 90 dias)
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
 Cliente ativo Dia 91   Churn no Dia 45
 (comissão validada)    → Clawback automático
                        → R$ 2.5k descontados
                          no próximo holerite
```

**Impacto cultural:** vendedor vira auditor de qualidade — prefere NÃO fechar do que arriscar estorno + queimar métrica.

### Bônus cruzado (Unified Variable Pay)

- **Gestor MKT:** 30% do bônus = receita real faturada vinda dos leads (não volume gerado)
- **Vendedor:** acelerador 1.2x se retenção das contas dele > 95% no trimestre seguinte; 0.8x se churn alto
- **Time CS:** comissão direta sobre **NRR** (upsell + cross-sell) — não é mais "suporte pós-venda"

## Parte 3 — Tecnologia & Processo

### Anti-Frankenstein Tecnológico

Tecnologia não resolve processo ruim — automatiza erro em velocidade maior. Mapeia processo no papel primeiro, depois escolhe ferramenta. Empresa com dezenas de softwares caros sem integração = dados fragmentados + vendedor copiando/colando entre abas + liderança cega.

### Portões de Validação (Data Gates) por Estágio

Cada transição exige campo obrigatório preenchido — **dropdown ou checkbox, NUNCA texto livre**:

| Transição | Campos obrigatórios |
|---|---|
| Prospecção → Diagnóstico | Budget Estimado (faixas) / Cronograma de Decisão (<30d, 60d, 90d) / Autoridade do Contato (Sócio, Diretor, Gerente, Analista) |
| Proposta → Negociação | Upload do PDF gerado pelo sistema (mata proposta-PowerPoint-fora-da-tabela) + Lista de Concorrentes no páreo |
| → Closed Lost | Motivo Real (dropdown: Preço / Não atende / Vencido por X / Sumiu) + subcampo "Qual funcionalidade do concorrente pesou na decisão?" |

Texto livre em motivo de perda = 50 jeitos de escrever "achou caro" = zero análise estatística.

### Auditoria de Stack (a cada 6 meses)

```
Cada software → 1. Custo mensal por usuário
             → 2. Taxa de adoção real (% logins semanais)
             → 3. Sobreposição de funcionalidades (redundância)
             → 4. Integração nativa com CRM principal
```

Duas ferramentas com mesma função em departamentos diferentes (e-mail MKT × cadência SDR)? RevOps unifica.

### Territory Planning

- Vendedor Enterprise: **máximo 25-30 contas ativas simultâneas** mantendo qualidade técnica
- Carteiras com **mesmo potencial financeiro** (não mesma quantidade de leads) — equilibra balança, elimina percepção de "vendedor X só pega conta fácil"

## Parte 4 — Forecast & Cadência

### Algoritmo de Correção de Forecast (anti-otimismo)

Time declara R$ 1.000.000 pro mês. RevOps cruza com taxa histórica dos últimos 12 meses:

| Categoria declarada | Bruto | Conversão histórica | Corrigido |
|---|---|---|---|
| Pipeline | R$ 500k | 10% | R$ 50k |
| Best Case | R$ 300k | 35% | R$ 105k |
| Commit | R$ 200k | 80% | R$ 160k |
| **TOTAL** | **R$ 1M** | | **R$ 315k** |

Diretor de Vendas promete R$ 1M baseado em otimismo → caixa quebra. **RevOps protege apresentando R$ 315k corrigido** — empresa não gasta por conta de dinheiro com 70% de chance de não entrar.

### 3 Rituais Obrigatórios

| Ritual | Cadência | Foco |
|---|---|---|
| **Pipeline** | Semanal (30-45min) | Tático — guiado por desvios apontados pelo CRM, NUNCA "como vai essa conta?" |
| **GTM Alignment** | Mensal | SLAs MKT↔Vendas↔CS, leads rejeitados, ajuste imediato de filtro de campanha |
| **QBR Estratégico** | Trimestral | C-Level — CAC, LTV, NRR, Pipeline Velocity, decisões de investimento/expansão |

Pergunta proibida na reunião semanal: "Como vai essa conta?". Pergunta cravada: "Vendedor A, opp de R$ 50k em Proposta sem interação há 12 dias — plano de ação ou move pra Perdido?"

### Dashboard de 3 Níveis (anti-infoxicação)

```
1. CEO/CFO         → LTV:CAC, NRR, Pipeline Velocity, Forecast Corrigido × Meta
2. Diretor/Gerente → MQL→SQL, SLA SDR, opps abertas/rep, Closed Lost Reasons
3. Vendedor/Analista → Ligações dia, tarefas atrasadas, leads na fila, carteira por categoria
```

CEO recebendo painel cheio de gráfico confuso = paralisia. Entregue 4 números — CAC, LTV, Velocidade, Previsão Matemática.

---

## Como o Djow usa este framework

**Diagnósticos quantitativos:**
- "Quantos % do tempo do seu gerente vão pra coaching vs ops? Se for menos que 50% pra coaching, falta RevOps — Lane & Adint chamam isso de 'salário de liderança fazendo trabalho de analista'."
- "Qual a sua Pipeline Velocity em R$/dia? Vamos calcular V × C × L / T — sem isso, você não sabe se está crescendo de verdade ou só inchando funil."
- "Seu MQL é só comportamento ou cruza com ICP? Se estudante baixando e-book vira MQL, Vendas tem razão de reclamar."
- "Sua matriz de alçada de desconto está no sistema ou na cabeça do gerente?"

**Provocações de governança:**
- "Texto livre em campo de motivo de perda = 50 jeitos de escrever 'achou caro'. Como você faz análise estatística disso?"
- "Vendedor define o desconto? Aí o forecast é teatro — quem controla margem da empresa é RevOps via matriz de alçada."
- "Stack tecnológica auditada nos últimos 6 meses? Quantas licenças sem login há 30 dias?"
- "Bônus do gestor de MKT é por lead gerado ou por receita real faturada? Se for por lead, ele empurra qualquer coisa pra Vendas."
- "Seu CS tem comissão por NRR ou só salário fixo? Sem incentivo na expansão, é só atendimento pós-venda."

**Forecast corrigido:**
- "Vendedor diz 80%? Qual é o e-mail/ata sustentando? Sem evidência documental, retira do mês."
- "Cliente cancelou em 45 dias? Aciona clawback — vendedor devolve comissão. Cravado por Lane & Adint."
- "Time vendeu R$ 1M no mês? Cruza com conversão histórica por categoria — provavelmente entra R$ 300-400k."
