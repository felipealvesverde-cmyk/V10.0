# KB de Audiência — modelo COMPOSICIONAL para o Djow (LeadJourney)

> **Status:** v2 (composicional). Substitui a v1 "combos pré-fundidos".
> **Onde usar:** Step 3 do wizard "Definir Audiência" + Engine de transmutação de lead.
> **Companheira obrigatória:** [`audiencia-carta-dominio.md`](./audiencia-carta-dominio.md) — a *intuição* que esta KB *estrutura*.

> **Mudança de arquitetura em relação à v1:** nada de combos pré-fundidos. Esta KB dá ao Djow **o contexto atômico de cada ponta da fusão** (cada modelo de Negócio e cada modelo Operacional como bloco independente) **+ as regras de fusão**. O Djow compõe o quadro PA/ICP/BP de qualquer cruzamento **em runtime**, dentro dos moldes do LJ.
>
> Vantagem: 4 átomos de Negócio + 5 átomos Operacionais = **9 blocos** geram as 20 combinações comuns **e** todas as raras (B2C+SaaS, C2C+Agência…) sem schema hardcoded. Multi-tenant, editável, escalável.

---

## 1. Como a composição funciona (o modelo mental)

Todo quadro de audiência é montado a partir de três coisas:

```
NÚCLEO COMUM  ⊕  ÁTOMO DE NEGÓCIO  ⊕  ÁTOMO OPERACIONAL  →  fusão  →  quadro PA/ICP/BP
(universal)      (relação comercial)   (formato de entrega)         (do produto)
```

**A regra do eixo — quem manda em quê:**

- O **átomo de Negócio é a espinha.** Ele fixa a **unidade de análise** (olho para PJ/empresa ou para PF/pessoa?), a **identidade** (quem é o lead) e **quem decide** (um cargo numa empresa vs. o próprio consumidor).
- O **átomo Operacional é a sobreposição.** Ele define o **comportamento de consumo e pagamento**, a **dor/gatilho/objeção** ligada ao formato, e carrega o peso da **viabilidade** (camada ICP).
- O **núcleo comum** são os campos que existem em qualquer produto (geo, origem, contato, momento de compra, engajamento) — ficam fora dos átomos pra não serem redefinidos toda hora.

**Moldes do LJ que continuam valendo em tudo abaixo:**

1. **Tipagem `completude` vs `fit`.** `completude` = o dado existe (não vazio). `fit` = o dado existe **e** bate o critério-alvo. O threshold de 80% usa a regra de fit nos campos `fit` — é o que impede o carimbo de mentir (um `cargo='Estagiário'` não satisfaz `cargo_decisor`).
2. **Inferência só de RD Station + state do LJ.** Sem chamada externa. Campos que dependeriam de enrichment (porte exato, faturamento, idade) entram `obrigatorio: false` / `enrichment_futuro: true` e **não** entram no denominador do threshold.
3. **Herança PA→ICP→BP.** ICP só conta se PA fechou; BP só se ICP fechou.
4. **Privacy.** Quadro e fala sempre em agregado; nunca PII de lead nominal.

Cada átomo declara dois flags de fusão — **`domina`** (no que ele tem a palavra final) e **`defere`** (o que ele deixa o outro átomo resolver). São esses flags que o motor de fusão (§4) usa.

---

## 2. Núcleo comum (entra em todo quadro, independe do modelo)

| Campo | Camada | tipo | Inferência RD | Critério (se fit) |
|-------|--------|------|----------------|--------------------|
| geo | PA | completude | `estado` (fallback `cidade`/`pais`) | — |
| origem_lead | PA | completude | `fonte` | — |
| contato | PA | completude | `telefone`/`email`/`contatos[]` válido | — |
| momento_compra | ICP | fit | `qualificacao_atual` + `score` | qualificacao ∈ {mql,sql,opportunity} **e** score ≥ limiar do produto (default 50) |
| engajamento | ICP | fit | `score` + última atividade | score ≥ 50 **ou** atividade na janela (default 30d) |
| comportamento_compra | BP | completude | `tags` de intenção / `oportunidades[]` stage avançado | — |
| canal_decisor | BP | completude (opcional) | `contatos[]` do contato | — |

> O núcleo já dá ao Djow o esqueleto dos 3 níveis **instantaneamente** (importa pra UX do delay de 2-5s, §5). Os átomos só acrescentam o que é distintivo de cada modelo.

---

## 3. Átomos da Família NEGÓCIO (relação comercial — a espinha)

### 3.1 — B2B

```yaml
atom: B2B   | familia: Negocio
unidade_de_analise: PJ (firmografia — o lead É a empresa)
contribui_PA:
  - empresa_corporativa   (fit; domínio próprio no email OU 'empresa' preenchido)
  - setor_empresa         (completude; 'segmento'/'subsegmento'; fallback domínio→setor)
  - porte_empresa         (completude OPCIONAL/enrichment_futuro; 'numero_funcionarios')
contribui_ICP:
  - maturidade_stack      (completude; tags de ferramentas/stack OU formulário)
  - fit_porte             (fit OPCIONAL; porte ∈ faixa-alvo do produto)
contribui_BP:
  - cargo_decisor         (fit; 'cargo' classificado como decisor — dicionário §4.5)
  - alcada                (completude; 'cargo' → faixa hierárquica)
domina: unidade=PJ; identidade da empresa; existência de "decisor ≠ usuário" (exige cargo no BP)
defere: comportamento de consumo, dor, gatilho e objeção → ao átomo Operacional
```

### 3.2 — B2C

```yaml
atom: B2C   | familia: Negocio
unidade_de_analise: PF (demografia/comportamento individual — o lead É a pessoa)
contribui_PA:
  - consumidor_final      (fit; email de provedor pessoal OU ausência de 'empresa')
  - interesse_categoria   (completude; tag de produto/categoria)
  - faixa_etaria          (completude OPCIONAL/enrichment_futuro; formulário)
contribui_ICP:
  - historico_conversao   (fit; qualificacao=customer OU ≥1 oportunidade ganha)
  - perfil_consumo        (completude; tags de comportamento/preferência)
contribui_BP:
  - (regra) o_proprio_e_decisor: NÃO exige cargo — o consumidor decide
  - gatilho_pessoal       (completude; tipo do gatilho é DEFERIDO ao Operacional)
domina: unidade=PF; REMOVE a exigência de cargo_decisor do BP; dor é emocional/conveniência
defere: forma de consumo/pagamento e a objeção do formato → ao átomo Operacional
```

### 3.3 — B2B2C

```yaml
atom: B2B2C | familia: Negocio
unidade_de_analise: DUPLA — parceiro PJ (quem contrata) + base PF (quem usa)
contribui_PA:
  - parceiro_corporativo  (fit; é a empresa-parceira — mesmo teste de B2B)
  - base_consumidora      (completude; perfil/tamanho da base final do parceiro)
contribui_ICP:
  - fit_parceiro          (fit; firmográfico do parceiro)
  - aderencia_base_final  (fit; a base do parceiro bate com o consumidor-alvo do produto)
contribui_BP:
  - decisor_no_parceiro   (fit; cargo decisor DENTRO do parceiro — quem assina)
domina: gera DOIS recortes (parceiro + base); o LEAD operável é o parceiro PJ
defere: comportamento de consumo da base final → ao átomo Operacional (aplica-se à base)
nota: default = tratar o parceiro PJ como lead; base final entra como atributo de qualificação.
      Se o produto também capta a base direto, vira bilateral (ver §4.4 / Marketplace).
```

### 3.4 — C2C

```yaml
atom: C2C   | familia: Negocio
unidade_de_analise: BILATERAL PF↔PF (dois lados, ambos pessoa física)
contribui_PA:
  - lado                  (fit; 'oferta' ou 'demanda' — tag/origem/formulário)
  - usuario_plataforma    (fit; cadastrado e validado por antifraude da plataforma)
contribui_ICP:
  - (oferta) tem_bem_ou_capacidade  (fit; estoque/produção)
  - (demanda) busca_recorrente      (fit; recorrência/raridade buscada)
contribui_BP:
  - confianca_reputacao   (completude; medo de fraude / valor de reputação)
  - (regra) o_proprio_e_decisor: sem cargo
domina: bilateralidade PF; eixo de CONFIANÇA/reputação; remove cargo
defere: mecânica de transação/pagamento → ao Operacional (quase sempre Marketplace)
nota: C2C raramente aparece sem Marketplace; se aparecer, ver regra de incompatibilidade §4.4.
```

---

## 4. Átomos da Família OPERACIONAL (formato de entrega — a sobreposição)

### 4.1 — SaaS

```yaml
atom: SaaS  | familia: Operacional
contribui_PA:
  - uso_digital           (completude; conectividade/uso de ferramentas — quase sempre satisfeito, baixo peso)
contribui_ICP:
  - usa_categoria_solucao (completude; tag de stack OU formulário 'ferramenta atual')
  - orcamento_recorrente  (fit; sinal de OPEX/assinatura — oportunidade com valor recorrente > 0)
contribui_BP:
  - objecao_formato       (completude; curva de aprendizado / cancelamento / integração — via tag)
  - gatilho               (completude; dor de tarefa manual/repetitiva)
domina: pagamento recorrente; dor de eficiência/automação
defere: identidade e "quem decide" → ao átomo de Negócio
```

### 4.2 — E-commerce

```yaml
atom: E-commerce | familia: Operacional
contribui_PA:
  - geo_entregavel        (fit; REFINA o geo do núcleo — 'cidade'/'estado' ∈ cobertura)
contribui_ICP:
  - historico_compra_online (fit; qualificacao=customer OU oportunidades ganhas)
  - ticket_fit            (fit; valor de oportunidade ∈ faixa de ticket do produto)
contribui_BP:
  - gatilho_recente       (completude; carrinho/navegação 24-72h — tag/pico de score)
  - objecao_logistica     (completude; frete/troca/tamanho — tag comportamental)
domina: dor logística; gatilho de conveniência; ciclo curto
defere: identidade → ao Negócio
```

### 4.3 — Agência (serviço/retainer)

```yaml
atom: Agencia | familia: Operacional
contribui_PA:
  - contrata_servico      (fit; pressupõe contratante que emite/recebe NF — sinaliza PJ)
contribui_ICP:
  - investe_em_aquisicao  (fit; 'fonte'=ads OU tag 'anuncia' — proxy forte de verba+dor)
  - ticket_compativel     (fit; oportunidade ≥ piso de fee)
  - gargalo_execucao      (completude OPCIONAL; ausência de time interno — formulário/tag)
contribui_BP:
  - objecao_alinhamento   (completude; "agência não entende meu nicho" / frustração prévia — tag)
  - dor_sobrecarga        (completude; acúmulo de função / necessidade de delegar)
domina: pressupõe contratante com verba de fee; dor de execução/delegação
defere: setor/porte/identidade → ao Negócio
incompatibilidade: assume contratante PJ → fusão com B2C puro exige ajuste (§4.4)
```

### 4.4 — Marketplace

```yaml
atom: Marketplace | familia: Operacional
contribui_PA:
  - lado                  (fit; impõe/herda o eixo bilateral 'oferta'/'demanda')
  - categoria_plataforma  (fit; 'segmento' ∈ categorias suportadas)
contribui_ICP:
  - volume_liquidez       (fit; capacidade de oferta OU recorrência de demanda ≥ piso)
  - ativacao_inicial      (completude OPCIONAL; primeiro passo de onboarding)
contribui_BP:
  - dor_lado              (completude; oferta=distribuição / demanda=sourcing)
  - comportamento_plataforma (completude; engajou com a plataforma, não só com o anúncio)
domina: IMPÕE bilateralidade — mesmo sobre um Negócio não-bilateral, cria dois lados; comissão/liquidez
defere: se os lados são PJ ou PF → ao Negócio (B2B-marketplace=lados PJ; C2C-marketplace=lados PF)
```

### 4.5 — Freemium

```yaml
atom: Freemium | familia: Operacional
contribui_PA:
  - conta_criada          (fit; signup real — 'email' válido + tag 'signup')
contribui_ICP:
  - uso_ativo             (fit; score de atividade ≥ 50 OU atividade ≤ 14d)
  - atingiu_limite_free   (fit; tag 'atingiu-limite' — gatilho natural de upgrade)
  - caso_uso_pago         (fit; caso de uso ∈ casos cobertos por plano pago)
contribui_BP:
  - power_user            (fit; uso intenso — score topo ≥ 70 OU tag 'power-user')
  - gatilho_upgrade       (completude; esbarrou em paywall / tentou feature paga — tag)
domina: gatilho de conversão por limite/uso; exige instrumentação de eventos de uso
defere: identidade/decisor → ao Negócio (B2C-freemium=próprio usuário; B2B-freemium=pode ter cargo)
degradacao: sem eventos de uso instrumentados, cai para aquisição-base (estilo E-commerce) e o Djow avisa
```

---

## 5. Motor de fusão (o procedimento que o Djow executa)

Entradas: `{atomo_negocio, atomo_operacional, config_produto, state_tenant}`. Saída: o quadro PA/ICP/BP com conjunto de obrigatórios e denominadores de threshold.

**Passo a passo:**

1. **Instancia o NÚCLEO COMUM** (§2). Já dá o esqueleto dos 3 níveis instantaneamente.
2. **Aplica o átomo de Negócio:** fixa `unidade_de_analise`; injeta contribuições PA/ICP/BP; roda suas regras de `domina` (ex.: B2C remove `cargo_decisor` obrigatório do BP; B2B2C abre dois recortes).
3. **Aplica o átomo Operacional:** injeta contribuições; roda suas regras de `domina` (ex.: E-commerce refina `geo`→`geo_entregavel`; Marketplace impõe lados; Freemium exige `conta_criada`).
4. **Dedupe** — quando duas contribuições cobrem o mesmo conceito, mantém **a mais específica**; entre `fit` e `completude` sobre o mesmo sinal, o `fit` vence. (Pares conhecidos abaixo.)
5. **Resolve a unidade** pela tabela de precedência (abaixo).
6. **Aplica regras de incompatibilidade** (abaixo) quando o par exige ajuste.
7. **Monta os obrigatórios por camada** e recalcula o denominador do threshold (opcionais/enrichment ficam fora).
8. **Entrega ao Step 3** em linguagem de gestão (microcopy da v1 segue válida).

### 5.1 — Tabela de precedência (quem vence em cada dimensão)

| Dimensão | Vence |
|----------|-------|
| Unidade de análise (PF / PJ / bilateral) | **Negócio** — exceto Marketplace, que pode impor lados |
| Quem é o decisor (cargo vs. próprio consumidor) | **Negócio** |
| Identidade, setor, porte | **Negócio** |
| Bilateralidade | **Marketplace** (sobrepõe o Negócio criando lados) |
| Comportamento de consumo e pagamento | **Operacional** |
| Dor, gatilho, objeção | **Operacional** |
| Viabilidade financeira (formato do gasto) | **Operacional** |

### 5.2 — Dedupe (pares que se sobrepõem)

| Conceito | Contribuições candidatas | Mantém |
|----------|--------------------------|--------|
| Verba/viabilidade financeira | `orcamento_recorrente` (SaaS) · `ticket_compativel` (Agência) · `ticket_fit` (E-comm) · `volume_liquidez` (Mktplace) | a do Operacional escolhido (uma só) |
| Histórico/intenção de compra | `historico_conversao` (B2C) · `historico_compra_online` (E-comm) | a mais específica (E-comm, quando presente) |
| Geo | `geo` (núcleo) · `geo_entregavel` (E-comm) | `geo_entregavel` quando E-comm está no par |
| Gatilho | `gatilho_pessoal` (B2C) · `gatilho_recente`/`gatilho_upgrade` (Operacional) | a do Operacional (define o tipo) |
| Identidade corporativa | `empresa_corporativa` (B2B) · `contrata_servico` (Agência) | `empresa_corporativa` (Agência só reforça PJ) |

### 5.3 — Regras de incompatibilidade (pares que precisam de ajuste)

| Par | Tensão | Resolução do Djow |
|-----|--------|-------------------|
| **B2C + SaaS** | SaaS costuma supor decisor corporativo; B2C diz que o consumidor decide | Unidade=PF vence. BP **não** exige cargo. A objeção SaaS (cancelamento/curva) ancora no indivíduo. Resultado: assinatura individual (ex.: app por assinatura). |
| **B2C + Agência** | Agência assume contratante PJ com fee | Rebaixa `contrata_servico` a opcional, mantém `ticket_compativel` alto (serviço premium a PF), e o Djow **avisa** que a combinação é incomum, pedindo confirmação. |
| **C2C + (≠ Marketplace)** | C2C pressupõe plataforma bilateral | Injeta a mecânica bilateral mínima (campo `lado`) e avisa que, sem o formato Marketplace, parte dos sinais de liquidez não existe. |
| **Qualquer + Marketplace** | Marketplace impõe lados | Se Negócio=B2B → lados PJ; se B2C/C2C → lados PF. Gera dois perfis sob o mesmo produto (ver §6.3 da v1). |
| **B2B2C + Operacional** | Há dois recortes | O Operacional aplica-se ao recorte da **base final**; o recorte do **parceiro** usa o BP de B2B2C (decisor no parceiro). |

---

## 6. Demonstração — a fusão rodando (não é schema hardcoded, é o motor produzindo)

**Exemplo A — B2B + SaaS** (comum). O motor monta:

- **PA** = núcleo[geo, origem, contato] + B2B[empresa_corporativa, setor_empresa, (porte opc.)] + SaaS[uso_digital]
- **ICP** = núcleo[momento_compra, engajamento] + B2B[maturidade_stack, (fit_porte opc.)] + SaaS[usa_categoria_solucao, orcamento_recorrente]
- **BP** = núcleo[comportamento_compra, (canal opc.)] + B2B[cargo_decisor, alcada] + SaaS[objecao_formato, gatilho]

Obrigatórios PA: 5 · ICP: 4 · BP: 4 → reproduz o quadro que antes estava hardcoded — **mas agora derivado dos átomos**.

**Exemplo B — B2C + SaaS** (raro, sem combo pronto). O **mesmo** motor monta:

- **PA** = núcleo[geo, origem, contato] + B2C[consumidor_final, interesse_categoria, (faixa_etaria opc.)] + SaaS[uso_digital]
- **ICP** = núcleo[momento_compra, engajamento] + B2C[historico_conversao, perfil_consumo] + SaaS[usa_categoria_solucao, orcamento_recorrente→**individual**]
- **BP** = núcleo[comportamento_compra] + B2C[**sem cargo** — o próprio decide] + SaaS[objecao_formato (cancelamento/curva, no indivíduo), gatilho]

Repare: a regra de incompatibilidade **B2C+SaaS** entrou sozinha — o BP perdeu `cargo_decisor`, a objeção do SaaS migrou para o indivíduo, e o quadro saiu coerente **sem nenhum schema novo escrito**. É isso que a arquitetura atômica entrega.

---

## 7. Moldes do LJ preservados (referência rápida)

- **Templates, não hardcode:** átomos e regras são defaults editáveis por tenant. O cliente edita o quadro fundido; o Djow valida.
- **Threshold:** 80% dos obrigatórios por camada, com regra `fit` onde aplicável; opcionais/enrichment fora do denominador.
- **RD-only:** toda inferência vem de RD + state. O que dependeria de enrichment fica opcional até existir.
- **Latência 2-5s:** núcleo + esqueleto aparecem na hora (vêm do template); o "li seus N leads e notei…" chega em streaming.
- **Privacy:** só agregado, nunca lead nominal.
- **Microcopy do Step 3:** a da v1 (versão inicial / com sugestão de RD / de validação / sem leads) continua válida — muda só que o Djow agora explica que "combinei o seu tipo de relação comercial com o seu formato de entrega", em vez de ler um combo pronto.

### Apêndice — checklist de átomos

**Negócio:** B2B (PJ, exige cargo) · B2C (PF, próprio decide) · B2B2C (parceiro PJ + base PF, dois recortes) · C2C (bilateral PF, confiança/reputação)
**Operacional:** SaaS (recorrência/automação) · E-commerce (logística/conveniência) · Agência (fee/terceirização, supõe PJ) · Marketplace (bilateral/liquidez, impõe lados) · Freemium (limite/uso, exige instrumentação)
**Núcleo comum:** geo · origem · contato · momento_compra · engajamento · comportamento_compra
