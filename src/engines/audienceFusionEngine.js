// V38.1.39 — Motor de Fusão de Audiência.
//
// Implementa o modelo composicional v2 da KB do Djow:
//   knowledge-base/djow/audiencia-kb-composicional.md
//   knowledge-base/djow/audiencia-carta-dominio.md
//
// Arquitetura: 4 átomos de Negócio × 5 átomos Operacional + núcleo comum.
// Pura: função fuse(negocio, operacional) → quadro PA/ICP/BP determinístico.
// Sem chamada externa, sem leitura de state.
//
// Tipagem por campo:
//   - completude: o dado existe (não-vazio) → conta no denominador
//   - fit:        o dado existe E bate o critério-alvo → conta no denominador
//   - optional:   true → fora do denominador do threshold
//
// Threshold default: 80% dos obrigatórios por camada (configurável por produto).

var AudienceFusionEngine = {
  // §2 — Núcleo comum: entra em todo quadro
  NUCLEO_COMUM: [
    { key: 'geo',                 layer: 'pa',  type: 'completude', label: 'Localização',         inferenciaRd: 'estado (fallback cidade/país)',                       criterio: null,                                                          tooltip: 'De onde o lead é. Qualquer campo geográfico preenchido conta.' },
    { key: 'origem_lead',         layer: 'pa',  type: 'completude', label: 'Origem do lead',      inferenciaRd: 'campo fonte',                                          criterio: null,                                                          tooltip: 'Por onde o lead chegou (ads, orgânico, indicação...).' },
    { key: 'contato',             layer: 'pa',  type: 'completude', label: 'Forma de contato',    inferenciaRd: 'telefone, email ou contatos[] válido',                criterio: null,                                                          tooltip: 'Pelo menos um canal pra falar com o lead.' },
    { key: 'momento_compra',      layer: 'icp', type: 'fit',        label: 'Momento de compra',   inferenciaRd: 'qualificacao_atual + score',                          criterio: 'qualificação ∈ {mql, sql, opportunity} e score ≥ limiar',     tooltip: 'Lead em estágio que indica intenção (MQL/SQL/oportunidade) e score acima do limiar do produto.' },
    { key: 'engajamento',         layer: 'icp', type: 'fit',        label: 'Engajamento',         inferenciaRd: 'score + última atividade',                            criterio: 'score ≥ 50 ou atividade na janela (30d default)',             tooltip: 'Score alto ou atividade recente — lead que está "vivo".' },
    { key: 'comportamento_compra',layer: 'bp',  type: 'completude', label: 'Comportamento', inferenciaRd: 'tags de intenção / oportunidades em stage avançado', criterio: null,                                                          tooltip: 'Sinal de intenção real de compra (carrinho, demo agendada, proposta).' },
    { key: 'canal_decisor',       layer: 'bp',  type: 'completude', label: 'Canal preferido',     inferenciaRd: 'contatos[] do contato',                               criterio: null,    optional: true,                                       tooltip: 'Canal que a pessoa decisora prefere (opcional).' }
  ],

  // §3 — Átomos de Família NEGÓCIO (a espinha: identidade + decisor)
  ATOMS_NEGOCIO: {
    b2b: {
      label: 'B2B',
      unidade: 'PJ',
      contribui: [
        { key: 'empresa_corporativa', layer: 'pa',  type: 'fit',        label: 'Empresa corporativa', inferenciaRd: "domínio próprio no email OU 'empresa' preenchido", criterio: 'domínio próprio (não gmail/hotmail/outlook) ou empresa preenchida', tooltip: 'Confirma que é uma empresa de verdade, não pessoa curiosa.' },
        { key: 'setor_empresa',       layer: 'pa',  type: 'completude', label: 'Setor da empresa',    inferenciaRd: "segmento/subsegmento; fallback domínio→setor",      criterio: null,                                                                tooltip: 'Vertical de atuação (SaaS, Saúde, Educação...).' },
        { key: 'porte_empresa',       layer: 'pa',  type: 'completude', label: 'Porte da empresa',    inferenciaRd: 'numero_funcionarios (enrichment)',                  criterio: null,    optional: true,                                             tooltip: 'Faixa de funcionários — exige enrichment.' },
        { key: 'maturidade_stack',    layer: 'icp', type: 'completude', label: 'Maturidade de stack', inferenciaRd: 'tags de ferramentas/stack OU formulário',           criterio: null,                                                                tooltip: 'Já usa ferramentas da categoria — entende o valor.' },
        { key: 'fit_porte',           layer: 'icp', type: 'fit',        label: 'Fit de porte',        inferenciaRd: 'porte ∈ faixa-alvo do produto',                     criterio: 'porte dentro da faixa configurada no produto',   optional: true,    tooltip: 'Porte bate com a faixa que você atende.' },
        // V38.1.45 — Sinais comportamentais que DISTINGUEM B2B sem depender de email/cargo/empresa.
        { key: 'horario_comercial',   layer: 'icp', type: 'fit',        label: 'Horário comercial',   inferenciaRd: 'eventHistory[] do tracker LJ',                       criterio: '≥60% dos eventos em dias úteis 8h-19h',                              tooltip: 'Acesso majoritário em horário de trabalho — sinal forte de uso corporativo.' },
        { key: 'consumo_b2b',         layer: 'icp', type: 'completude', label: 'Consumo técnico',     inferenciaRd: 'tags com termos B2B (whitepaper, case, integração, ROI)', criterio: null,                                                            tooltip: 'Consome conteúdo de research/integração/ROI — interesse profissional, não de consumo.' },
        { key: 'cargo_decisor',       layer: 'bp',  type: 'fit',        label: 'Cargo decisor',       inferenciaRd: "cargo classificado por dicionário de decisores",    criterio: "cargo ∈ {CEO, Diretor, Head, VP, C-Level, Gerente Sênior}",         tooltip: 'Pessoa tem cargo de decisão real — não analista nem estagiário.' },
        { key: 'alcada',              layer: 'bp',  type: 'completude', label: 'Alçada/hierarquia',   inferenciaRd: 'cargo → faixa hierárquica',                         criterio: null,                                                                tooltip: 'Faixa de senioridade — proxy de poder de assinatura.' }
      ],
      remove: [],
      notas: 'A unidade é a empresa; o cargo é o filtro mais decisivo no BP. Sem cargo, BP não fecha. Sinais comportamentais (horário comercial + consumo técnico) ajudam a distinguir B2B mesmo sem cargo identificado.'
    },

    b2c: {
      label: 'B2C',
      unidade: 'PF',
      contribui: [
        { key: 'consumidor_final',    layer: 'pa',  type: 'fit',        label: 'Consumidor final',    inferenciaRd: 'email pessoal OU empresa vazia',                    criterio: 'email de provedor pessoal (gmail/hotmail/yahoo) ou empresa vazia', tooltip: 'É uma pessoa física, não corporativo.' },
        { key: 'interesse_categoria', layer: 'pa',  type: 'completude', label: 'Interesse na categoria', inferenciaRd: 'tag de produto/categoria',                       criterio: null,                                                                tooltip: 'Demonstrou interesse na categoria do produto.' },
        { key: 'faixa_etaria',        layer: 'pa',  type: 'completude', label: 'Faixa etária',        inferenciaRd: 'formulário (enrichment)',                           criterio: null,    optional: true,                                             tooltip: 'Faixa de idade — opcional, exige formulário.' },
        { key: 'historico_conversao', layer: 'icp', type: 'fit',        label: 'Histórico de conversão', inferenciaRd: 'qualificacao=customer OU ≥1 oportunidade ganha', criterio: 'já comprou antes ou tem oportunidade ganha no histórico',          tooltip: 'Já comprou antes — pessoa que converte.' },
        { key: 'perfil_consumo',      layer: 'icp', type: 'completude', label: 'Perfil de consumo',   inferenciaRd: 'tags de comportamento/preferência',                 criterio: null,                                                                tooltip: 'Padrão de consumo detectado (preferências, hábitos).' },
        // V38.1.45 — Sinais comportamentais que DISTINGUEM B2C sem depender de email pessoal/empresa vazia.
        { key: 'horario_pessoal',     layer: 'icp', type: 'fit',        label: 'Horário pessoal',     inferenciaRd: 'eventHistory[] do tracker LJ',                       criterio: '≥60% dos eventos noite (20h-7h) ou fim de semana',                   tooltip: 'Acesso fora de horário comercial — sinal de uso pessoal, não corporativo.' },
        { key: 'consumo_b2c',         layer: 'icp', type: 'completude', label: 'Consumo emocional',   inferenciaRd: 'tags com termos B2C (promoção, oferta, desejo)',     criterio: null,                                                                 tooltip: 'Consome conteúdo de promoção/desejo/preço — interesse de consumo individual.' },
        { key: 'gatilho_pessoal',     layer: 'bp',  type: 'completude', label: 'Gatilho pessoal',     inferenciaRd: 'tipo de gatilho DEFERIDO ao Operacional',           criterio: null,                                                                tooltip: 'O que motivou — tipo concreto vem do formato (carrinho, paywall etc).' }
      ],
      // B2C remove cargo_decisor do BP: o próprio consumidor decide.
      remove: ['cargo_decisor', 'alcada'],
      notas: 'O consumidor é o próprio decisor. BP NÃO exige cargo. Foque em gatilho e medo. Sinais comportamentais (horário pessoal + consumo emocional) ajudam a distinguir B2C mesmo sem email pessoal identificado.'
    },

    b2b2c: {
      label: 'B2B2C',
      unidade: 'DUPLA',
      contribui: [
        { key: 'parceiro_corporativo',layer: 'pa',  type: 'fit',        label: 'Parceiro corporativo',inferenciaRd: 'mesmo teste de B2B (empresa parceira)',             criterio: 'domínio próprio + empresa preenchida',                              tooltip: 'O lead é a empresa-parceira que vai contratar.' },
        { key: 'base_consumidora',    layer: 'pa',  type: 'completude', label: 'Base consumidora',    inferenciaRd: 'perfil/tamanho da base final do parceiro',          criterio: null,                                                                tooltip: 'Perfil/tamanho da base final que o parceiro atende.' },
        { key: 'fit_parceiro',        layer: 'icp', type: 'fit',        label: 'Fit do parceiro',     inferenciaRd: 'firmográfico do parceiro',                          criterio: 'parceiro em faixa de porte/setor configurada',                      tooltip: 'O parceiro bate com o perfil-alvo.' },
        { key: 'aderencia_base_final',layer: 'icp', type: 'fit',        label: 'Aderência da base',   inferenciaRd: 'base do parceiro vs consumidor-alvo',               criterio: 'base do parceiro tem fit com o consumidor-alvo do produto',         tooltip: 'A base final do parceiro vai gostar do produto.' },
        { key: 'decisor_no_parceiro', layer: 'bp',  type: 'fit',        label: 'Decisor no parceiro', inferenciaRd: 'cargo dentro do parceiro',                          criterio: 'cargo decisor dentro do parceiro (quem assina)',                    tooltip: 'Quem dentro do parceiro tem poder de assinatura.' }
      ],
      remove: [],
      notas: 'Dois recortes: parceiro PJ (lead operável) + base PF (atributo de viabilidade do parceiro).'
    },

    c2c: {
      label: 'C2C',
      unidade: 'BILATERAL',
      contribui: [
        { key: 'lado',                layer: 'pa',  type: 'fit',        label: 'Lado da transação',   inferenciaRd: 'tag/origem/formulário "oferta" ou "demanda"',       criterio: "lado ∈ {oferta, demanda}",                                          tooltip: 'Identifica se o lead é vendedor ou comprador.' },
        { key: 'usuario_plataforma',  layer: 'pa',  type: 'fit',        label: 'Usuário validado',    inferenciaRd: 'cadastrado + antifraude OK',                        criterio: 'cadastro completo e validação antifraude aprovada',                 tooltip: 'Cadastrado e validado pela plataforma.' },
        { key: 'tem_bem_ou_capacidade', layer: 'icp', type: 'fit',      label: 'Tem bem/capacidade (oferta)', inferenciaRd: 'estoque/produção quando lado=oferta',         criterio: 'lado=oferta com estoque ou capacidade declarada',                   tooltip: 'Vendedor tem o que oferecer.' },
        { key: 'busca_recorrente',    layer: 'icp', type: 'fit',        label: 'Busca recorrente (demanda)', inferenciaRd: 'recorrência/raridade buscada quando lado=demanda', criterio: 'lado=demanda com padrão de busca recorrente',                    tooltip: 'Comprador volta — não é one-shot.' },
        { key: 'confianca_reputacao', layer: 'bp',  type: 'completude', label: 'Reputação/confiança', inferenciaRd: 'tag de medo de fraude / valor de reputação',         criterio: null,                                                                tooltip: 'Reputação na plataforma ou medo de fraude declarado.' }
      ],
      remove: ['cargo_decisor', 'alcada'],
      notas: 'Sem cargo (PF). O eixo é confiança/reputação. Quase sempre vem com Marketplace.'
    }
  },

  // §4 — Átomos de Família OPERACIONAL (a pele: consumo + dor + viabilidade)
  ATOMS_OPERACIONAL: {
    saas: {
      label: 'SaaS',
      contribui: [
        { key: 'uso_digital',         layer: 'pa',  type: 'completude', label: 'Uso digital',         inferenciaRd: 'conectividade/uso de ferramentas',                  criterio: null,                                                                tooltip: 'Lead consegue usar ferramentas digitais (quase sempre satisfeito).' },
        { key: 'usa_categoria_solucao', layer: 'icp', type: 'completude', label: 'Usa categoria',     inferenciaRd: "tag de stack OU formulário 'ferramenta atual'",     criterio: null,                                                                tooltip: 'Já usa alguma ferramenta da categoria — entende o problema.' },
        { key: 'orcamento_recorrente',layer: 'icp', type: 'fit',        label: 'Orçamento recorrente',inferenciaRd: 'oportunidade com valor recorrente > 0',             criterio: 'oportunidade com valor recorrente ou tag de OPEX',                  tooltip: 'Tem verba pra gasto recorrente (assinatura).' },
        { key: 'objecao_formato',     layer: 'bp',  type: 'completude', label: 'Objeção de formato',  inferenciaRd: 'tag de curva/cancelamento/integração',              criterio: null,                                                                tooltip: 'Detectada objeção típica de SaaS (curva, cancelamento, integração).' },
        { key: 'gatilho',             layer: 'bp',  type: 'completude', label: 'Gatilho (dor)',       inferenciaRd: 'dor de tarefa manual/repetitiva',                   criterio: null,                                                                tooltip: 'Dor de automação/repetição mapeada — gatilho da venda.' }
      ],
      refina: {},
      notas: 'Recorrência manda. Inimigo é churn. Dor mora no status quo, não na feature.'
    },

    ecommerce: {
      label: 'E-commerce',
      contribui: [
        { key: 'geo_entregavel',      layer: 'pa',  type: 'fit',        label: 'Geo entregável',      inferenciaRd: 'cidade/estado ∈ cobertura',                          criterio: 'região do lead atendida pela cobertura logística',                  tooltip: 'Loja entrega na região do lead — sem isso, lead morto.' },
        { key: 'historico_compra_online', layer: 'icp', type: 'fit',    label: 'Histórico de compra online', inferenciaRd: 'qualificacao=customer OU oportunidades ganhas', criterio: 'já comprou online antes',                                          tooltip: 'Já comprou online antes — não é virgem do canal.' },
        { key: 'ticket_fit',          layer: 'icp', type: 'fit',        label: 'Ticket compatível',   inferenciaRd: 'valor de oportunidade ∈ faixa do produto',          criterio: 'oportunidade dentro da faixa de ticket do produto',                 tooltip: 'Valor que o lead movimenta bate com seu ticket médio.' },
        { key: 'gatilho_recente',     layer: 'bp',  type: 'completude', label: 'Gatilho recente',     inferenciaRd: 'tag de carrinho ou pico de score em 24-72h',         criterio: null,                                                                tooltip: 'Sinal quente nas últimas 24-72h (carrinho, navegação).' },
        { key: 'objecao_logistica',   layer: 'bp',  type: 'completude', label: 'Objeção logística',   inferenciaRd: 'tag de frete/troca/tamanho',                         criterio: null,                                                                tooltip: 'Detectada objeção típica de e-commerce (frete, troca, tamanho).' }
      ],
      // E-commerce refina geo do núcleo: vira geo_entregavel (fit)
      refina: { geo: 'geo_entregavel' },
      notas: 'Geo não é cadastro — é filtro de viabilidade. Ciclo curto, gatilho recente manda.'
    },

    agencia: {
      label: 'Agência',
      contribui: [
        { key: 'contrata_servico',    layer: 'pa',  type: 'fit',        label: 'Contrata serviço',    inferenciaRd: 'pressupõe PJ que emite/recebe NF',                  criterio: 'lead é PJ com perfil de contratação de serviço (emite NF)',         tooltip: 'É um contratante de serviço — não consumidor final.' },
        { key: 'investe_em_aquisicao',layer: 'icp', type: 'fit',        label: 'Investe em aquisição',inferenciaRd: "fonte=ads OU tag 'anuncia'",                         criterio: "fonte de ads paga ou tag 'anuncia'",                                tooltip: 'Já investe em mídia paga — prova de verba + dor.' },
        { key: 'ticket_compativel',   layer: 'icp', type: 'fit',        label: 'Ticket compatível',   inferenciaRd: 'oportunidade ≥ piso de fee',                         criterio: 'oportunidade com valor ≥ piso de fee do serviço',                   tooltip: 'Valor da oportunidade alcança seu fee mínimo.' },
        { key: 'gargalo_execucao',    layer: 'icp', type: 'completude', label: 'Gargalo de execução', inferenciaRd: 'ausência de time interno (formulário/tag)',          criterio: null,    optional: true,                                             tooltip: 'Não tem time pra executar — dor de delegação.' },
        { key: 'objecao_alinhamento', layer: 'bp',  type: 'completude', label: 'Objeção de alinhamento', inferenciaRd: "tag de 'agência não entende meu nicho'",          criterio: null,                                                                tooltip: 'Já se queimou com agência antes — medo de não entenderem.' },
        { key: 'dor_sobrecarga',      layer: 'bp',  type: 'completude', label: 'Dor de sobrecarga',   inferenciaRd: 'tag de acúmulo de função / necessidade de delegar',  criterio: null,                                                                tooltip: 'Pessoa acumulada — precisa delegar.' }
      ],
      refina: {},
      notas: 'Pressupõe contratante PJ com verba de fee. Avise antes de fundir com B2C puro.'
    },

    marketplace: {
      label: 'Marketplace',
      contribui: [
        { key: 'lado',                layer: 'pa',  type: 'fit',        label: 'Lado da transação',   inferenciaRd: 'oferta/demanda',                                     criterio: "lado ∈ {oferta, demanda}",                                          tooltip: 'Identifica se o lead está no lado da oferta ou da demanda.' },
        { key: 'categoria_plataforma',layer: 'pa',  type: 'fit',        label: 'Categoria suportada', inferenciaRd: 'segmento ∈ categorias suportadas',                   criterio: 'segmento do lead bate com categoria operada pelo marketplace',      tooltip: 'O que o lead oferece/busca está dentro das categorias.' },
        { key: 'volume_liquidez',     layer: 'icp', type: 'fit',        label: 'Volume de liquidez',  inferenciaRd: 'capacidade de oferta OU recorrência de demanda',     criterio: 'oferta com volume ou demanda com recorrência ≥ piso da plataforma', tooltip: 'Contribui pra liquidez (volume relevante).' },
        { key: 'ativacao_inicial',    layer: 'icp', type: 'completude', label: 'Ativação inicial',    inferenciaRd: 'primeiro passo de onboarding',                       criterio: null,    optional: true,                                             tooltip: 'Completou o primeiro passo do onboarding.' },
        { key: 'dor_lado',            layer: 'bp',  type: 'completude', label: 'Dor por lado',        inferenciaRd: 'oferta=distribuição / demanda=sourcing',             criterio: null,                                                                tooltip: 'Oferta sofre com distribuição. Demanda sofre com sourcing.' },
        { key: 'comportamento_plataforma', layer: 'bp',  type: 'completude', label: 'Comportamento na plataforma', inferenciaRd: 'engajou com a plataforma, não só com anúncio', criterio: null,                                                            tooltip: 'Engajou com a plataforma — não só veio do anúncio.' }
      ],
      refina: {},
      bilateraliza: true, // §5.1 — Marketplace impõe lados sobre qualquer Negócio
      notas: 'Liquidez manda sobre qualidade individual. Marketplace IMPÕE 2 lados (PJ se B2B, PF se B2C/C2C).'
    },

    freemium: {
      label: 'Freemium',
      contribui: [
        { key: 'conta_criada',        layer: 'pa',  type: 'fit',        label: 'Conta criada',        inferenciaRd: "email válido + tag 'signup'",                       criterio: 'signup real (email validado + evento de cadastro)',                 tooltip: 'Signup real — não é só visitante.' },
        { key: 'uso_ativo',           layer: 'icp', type: 'fit',        label: 'Uso ativo',           inferenciaRd: 'score de atividade ≥ 50 OU atividade ≤ 14d',         criterio: 'score ≥ 50 OU atividade na janela de 14 dias',                      tooltip: 'Está usando o produto de verdade.' },
        { key: 'atingiu_limite_free', layer: 'icp', type: 'fit',        label: 'Atingiu limite free', inferenciaRd: "tag 'atingiu-limite'",                               criterio: "tag 'atingiu-limite' presente",                                     tooltip: 'Esbarrou no teto do plano grátis — gatilho de upgrade.' },
        { key: 'caso_uso_pago',       layer: 'icp', type: 'fit',        label: 'Caso de uso pago',    inferenciaRd: 'caso de uso ∈ casos cobertos por plano pago',        criterio: 'uso casa com features do plano pago',                               tooltip: 'O que o lead faz se beneficia do plano pago.' },
        { key: 'power_user',          layer: 'bp',  type: 'fit',        label: 'Power user',          inferenciaRd: "score topo ≥ 70 OU tag 'power-user'",                criterio: "score ≥ 70 OU tag 'power-user'",                                    tooltip: 'Usuário no topo da curva de uso — provável convertido.' },
        { key: 'gatilho_upgrade',     layer: 'bp',  type: 'completude', label: 'Gatilho de upgrade',  inferenciaRd: 'esbarrou em paywall / tentou feature paga',          criterio: null,                                                                tooltip: 'Tentou recurso pago e bateu na parede.' }
      ],
      refina: {},
      notas: 'Cadastro é começo do funil de uso, não lead quente. Sem eventos instrumentados, degrada.'
    }
  },

  // §5.3 — Regras de incompatibilidade (pares que exigem ajuste)
  INCOMPATIBILIDADES: [
    {
      par: { negocio: 'b2c', operacional: 'saas' },
      acao: { rebaixar: [], remover: [], aviso: 'Combinação rara: SaaS pra consumidor final. Assinatura individual. Confirma se é isso mesmo.' }
    },
    {
      par: { negocio: 'b2c', operacional: 'agencia' },
      acao: { rebaixar: ['contrata_servico'], remover: [], aviso: 'Combinação incomum: Agência atendendo pessoa física. Vou tratar como serviço premium individual. Confirma?' }
    },
    {
      par: { negocio: 'c2c', operacional: 'saas' },
      acao: { rebaixar: [], remover: [], aviso: 'Combinação atípica: C2C raramente é SaaS puro. Faltam sinais de liquidez bilateral.' }
    },
    {
      par: { negocio: 'c2c', operacional: 'ecommerce' },
      acao: { rebaixar: [], remover: [], aviso: 'Combinação atípica: C2C costuma exigir Marketplace pra mecânica bilateral.' }
    },
    {
      par: { negocio: 'c2c', operacional: 'agencia' },
      acao: { rebaixar: [], remover: [], aviso: 'Combinação muito incomum: C2C + Agência. Verifique se não seria B2B + Agência ou Marketplace.' }
    },
    {
      par: { negocio: 'c2c', operacional: 'freemium' },
      acao: { rebaixar: [], remover: [], aviso: 'Combinação atípica: C2C sem Marketplace dificulta medir liquidez. Sinais ficam parciais.' }
    },
    {
      par: { negocio: 'b2b', operacional: 'freemium' },
      acao: { rebaixar: [], remover: [], aviso: 'Modelo Product-Led B2B. Decisor pode demorar a aparecer — o usuário grátis costuma ser analista, não comprador.' }
    }
  ],

  // §5.2 — Dedupe: pares de conceito que se sobrepõem (quem vence)
  DEDUPE_PAIRS: [
    { conceitos: ['orcamento_recorrente', 'ticket_compativel', 'ticket_fit', 'volume_liquidez'], regra: 'manter_operacional_escolhido' },
    { conceitos: ['historico_conversao', 'historico_compra_online'],                              regra: 'manter_mais_especifico' }, // E-comm vence se presente
    { conceitos: ['empresa_corporativa', 'contrata_servico'],                                     regra: 'manter_empresa_corporativa' }
  ],

  // Fusão principal — chama os 8 passos da KB §5
  fuse(modeloNegocio, modeloOperacional) {
    const negocio = this.ATOMS_NEGOCIO[modeloNegocio];
    const operacional = this.ATOMS_OPERACIONAL[modeloOperacional];
    if (!negocio || !operacional) {
      return { ok: false, error: 'Modelo de Negócio ou Operacional inválido.' };
    }

    // Passo 1 — Núcleo comum
    let fields = this.NUCLEO_COMUM.map(f => ({ ...f, origem: 'nucleo' }));
    const notas = [];

    // Passo 2 — Aplica átomo de Negócio
    negocio.contribui.forEach(c => fields.push({ ...c, origem: 'negocio' }));
    if (negocio.remove?.length) {
      fields = fields.filter(f => !negocio.remove.includes(f.key));
    }
    if (negocio.notas) notas.push({ origem: 'negocio', texto: negocio.notas });

    // Passo 3 — Aplica átomo Operacional
    // 3.1 — refina (ex: E-commerce: geo → geo_entregavel)
    if (operacional.refina) {
      Object.entries(operacional.refina).forEach(([from, to]) => {
        fields = fields.filter(f => f.key !== from);
      });
    }
    operacional.contribui.forEach(c => fields.push({ ...c, origem: 'operacional' }));
    if (operacional.notas) notas.push({ origem: 'operacional', texto: operacional.notas });

    // Passo 4 — Dedupe (pares conhecidos que se sobrepõem)
    this.DEDUPE_PAIRS.forEach(pair => {
      const presentes = fields.filter(f => pair.conceitos.includes(f.key));
      if (presentes.length > 1) {
        // Mantém apenas o do operacional (regra default da KB)
        const vencedor = presentes.find(f => f.origem === 'operacional') || presentes[0];
        fields = fields.filter(f => !pair.conceitos.includes(f.key) || f.key === vencedor.key);
      }
    });

    // Passo 5 — Resolve unidade (vencedor: Negócio, salvo Marketplace bilateraliza)
    let unidade = negocio.unidade;
    let bilateral = unidade === 'BILATERAL';
    if (operacional.bilateraliza) {
      bilateral = true;
      if (unidade === 'PJ') unidade = 'BILATERAL_PJ';
      else if (unidade === 'PF') unidade = 'BILATERAL_PF';
      notas.push({ origem: 'marketplace', texto: 'Marketplace IMPÔS 2 lados sobre o Negócio. Geramos 2 perfis sob este produto.' });
    }

    // Passo 6 — Regras de incompatibilidade
    const incomp = this.INCOMPATIBILIDADES.find(r =>
      r.par.negocio === modeloNegocio && r.par.operacional === modeloOperacional
    );
    if (incomp) {
      // Rebaixa campos pra opcional
      incomp.acao.rebaixar?.forEach(k => {
        const f = fields.find(x => x.key === k);
        if (f) f.optional = true;
      });
      // Remove campos
      if (incomp.acao.remover?.length) {
        fields = fields.filter(f => !incomp.acao.remover.includes(f.key));
      }
      if (incomp.acao.aviso) {
        notas.push({ origem: 'incompatibilidade', texto: incomp.acao.aviso });
      }
    }

    // Passo 7 — Monta obrigatórios por camada + denominadores
    const pa  = fields.filter(f => f.layer === 'pa');
    const icp = fields.filter(f => f.layer === 'icp');
    const bp  = fields.filter(f => f.layer === 'bp');

    const obrigatoriosPa  = pa.filter(f => !f.optional);
    const obrigatoriosIcp = icp.filter(f => !f.optional);
    const obrigatoriosBp  = bp.filter(f => !f.optional);

    // Passo 8 — Entrega
    return {
      ok: true,
      modeloNegocio,
      modeloOperacional,
      negocioLabel: negocio.label,
      operacionalLabel: operacional.label,
      unidade,
      bilateral,
      pa,
      icp,
      bp,
      requiredCounts: {
        pa: obrigatoriosPa.length,
        icp: obrigatoriosIcp.length,
        bp: obrigatoriosBp.length
      },
      notas
    };
  }
};

window.AudienceFusionEngine = AudienceFusionEngine;
