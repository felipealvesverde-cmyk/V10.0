// V40.12.0 — Catálogo de Átomos da Audiência (externalizado do engine).
//
// Sprint 1 da onda V2 do "Definir Audiência" cravada por Felipe 2026-06-23.
//
// ARQUITETURA da Máxima da Triangulação Viva ([[maxima-triangulacao-viva]]):
//   - Catálogo de Átomos vivos (este arquivo) versionado
//   - Regras de Triangulação (incompatibilidades + dedupe) versionadas
//   - Engine `audienceFusionEngine.js` LÊ deste catálogo (não hardcoda)
//   - Audiência salva no produto carimba `atomsVersion` + `rulesVersion`
//
// Versionar:
//   CATALOG_VERSION  → bump quando adicionar/remover ÁTOMOS (insumos do wizard)
//   RULES_VERSION    → bump quando adicionar/remover REGRAS (dedupe/incompatibilidades)
//   ENGINE_VERSION   → bump quando engine de fusão muda comportamento
//
// Bumps seguem semver:
//   - patch (1.0.0 → 1.0.1): typo, ajuste de label/tooltip, sem efeito downstream
//   - minor (1.0.0 → 1.1.0): átomo novo, regra nova — produtos antigos ficam OK
//   - major (1.0.0 → 2.0.0): remove átomo, muda significado — exige refundir produtos antigos
//
// Próximo passo (Sprint 2): adicionar átomos de ticket/ciclo/time/tracking e
// modelos operacionais novos (Atacado, Consultoria, Manufatura, Agribusiness).

(function() {
  'use strict';

  // §2 — Núcleo comum: entra em todo quadro
  const NUCLEO_COMUM = [
    { key: 'geo',                 layer: 'pa',  type: 'completude', label: 'Localização',         inferenciaRd: 'estado (fallback cidade/país)',                       criterio: null,                                                          tooltip: 'De onde o lead é. Qualquer campo geográfico preenchido conta.' },
    { key: 'origem_lead',         layer: 'pa',  type: 'completude', label: 'Origem do lead',      inferenciaRd: 'campo fonte',                                          criterio: null,                                                          tooltip: 'Por onde o lead chegou (ads, orgânico, indicação...).' },
    { key: 'contato',             layer: 'pa',  type: 'completude', label: 'Forma de contato',    inferenciaRd: 'telefone, email ou contatos[] válido',                criterio: null,                                                          tooltip: 'Pelo menos um canal pra falar com o lead.' },
    { key: 'momento_compra',      layer: 'icp', type: 'fit',        label: 'Momento de compra',   inferenciaRd: 'qualificacao_atual + score',                          criterio: 'qualificação ∈ {mql, sql, opportunity} e score ≥ limiar',     tooltip: 'Lead em estágio que indica intenção (MQL/SQL/oportunidade) e score acima do limiar do produto.' },
    { key: 'engajamento',         layer: 'icp', type: 'fit',        label: 'Engajamento',         inferenciaRd: 'score + última atividade',                            criterio: 'score ≥ 50 ou atividade na janela (30d default)',             tooltip: 'Score alto ou atividade recente — lead que está "vivo".' },
    { key: 'comportamento_compra',layer: 'bp',  type: 'completude', label: 'Comportamento', inferenciaRd: 'tags de intenção / oportunidades em stage avançado', criterio: null,                                                          tooltip: 'Sinal de intenção real de compra (carrinho, demo agendada, proposta).' },
    { key: 'canal_decisor',       layer: 'bp',  type: 'completude', label: 'Canal preferido',     inferenciaRd: 'contatos[] do contato',                               criterio: null,    optional: true,                                       tooltip: 'Canal que a pessoa decisora prefere (opcional).' }
  ];

  // §3 — Átomos de Família NEGÓCIO (a espinha: identidade + decisor)
  const ATOMS_NEGOCIO = {
    b2b: {
      label: 'B2B',
      unidade: 'PJ',
      contribui: [
        { key: 'empresa_corporativa', layer: 'pa',  type: 'fit',        label: 'Empresa corporativa', inferenciaRd: "domínio próprio no email OU 'empresa' preenchido", criterio: 'domínio próprio (não gmail/hotmail/outlook) ou empresa preenchida', tooltip: 'Confirma que é uma empresa de verdade, não pessoa curiosa.' },
        { key: 'setor_empresa',       layer: 'pa',  type: 'completude', label: 'Setor da empresa',    inferenciaRd: "segmento/subsegmento; fallback domínio→setor",      criterio: null,                                                                tooltip: 'Vertical de atuação (SaaS, Saúde, Educação...).' },
        { key: 'porte_empresa',       layer: 'pa',  type: 'completude', label: 'Porte da empresa',    inferenciaRd: 'numero_funcionarios (enrichment)',                  criterio: null,    optional: true,                                             tooltip: 'Faixa de funcionários — exige enrichment.' },
        { key: 'maturidade_stack',    layer: 'icp', type: 'completude', label: 'Maturidade de stack', inferenciaRd: 'tags de ferramentas/stack OU formulário',           criterio: null,                                                                tooltip: 'Já usa ferramentas da categoria — entende o valor.' },
        { key: 'fit_porte',           layer: 'icp', type: 'fit',        label: 'Fit de porte',        inferenciaRd: 'porte ∈ faixa-alvo do produto',                     criterio: 'porte dentro da faixa configurada no produto',   optional: true,    tooltip: 'Porte bate com a faixa que você atende.' },
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
        { key: 'horario_pessoal',     layer: 'icp', type: 'fit',        label: 'Horário pessoal',     inferenciaRd: 'eventHistory[] do tracker LJ',                       criterio: '≥60% dos eventos noite (20h-7h) ou fim de semana',                   tooltip: 'Acesso fora de horário comercial — sinal de uso pessoal, não corporativo.' },
        { key: 'consumo_b2c',         layer: 'icp', type: 'completude', label: 'Consumo emocional',   inferenciaRd: 'tags com termos B2C (promoção, oferta, desejo)',     criterio: null,                                                                tooltip: 'Consome conteúdo de promoção/desejo/preço — interesse de consumo individual.' },
        { key: 'gatilho_pessoal',     layer: 'bp',  type: 'completude', label: 'Gatilho pessoal',     inferenciaRd: 'tipo de gatilho DEFERIDO ao Operacional',           criterio: null,                                                                tooltip: 'O que motivou — tipo concreto vem do formato (carrinho, paywall etc).' }
      ],
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
  };

  // §4 — Átomos de Família OPERACIONAL (a pele: consumo + dor + viabilidade)
  const ATOMS_OPERACIONAL = {
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
      bilateraliza: true,
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
    },

    // V40.12.1 — Sprint 2 da Onda V2 de Audiência (Felipe 2026-06-23).
    // 4 modelos operacionais novos cobrindo lacunas que apareceram durante a
    // reflexão sobre Pilsen Atacado (cervejaria → bar). Sem esses, B2B Atacado
    // clássico, Consultoria de alto ticket, Manufatura B2B e Agribusiness
    // tinham que se enfiar em saas/ecommerce/marketplace (sempre errado).

    atacado: {
      label: 'Atacado / Wholesale',
      contribui: [
        { key: 'pj_revenda',                    layer: 'pa',  type: 'fit',        label: 'PJ de revenda',                  inferenciaRd: 'CNPJ + CNAE de comércio/distribuição',                                criterio: 'lead é PJ com CNAE compatível com revenda/distribuição',                tooltip: 'Estabelecimento que revende — bar, mercado, restaurante, distribuidor.' },
        { key: 'volume_minimo',                 layer: 'pa',  type: 'fit',        label: 'Volume mínimo viável',           inferenciaRd: 'oportunidade com qty ≥ volume mínimo do produto',                     criterio: 'pedido bate ou supera o volume mínimo de fardo/caixa/pallet',           tooltip: 'Compra em quantidade que vale a operação (não pega 1 unidade).' },
        { key: 'frequencia_pedido',             layer: 'icp', type: 'fit',        label: 'Frequência de pedido',           inferenciaRd: 'histórico de pedidos OU tag "recorrente"',                            criterio: 'pelo menos 1 pedido na janela esperada (ex: mensal)',                   tooltip: 'Faz pedido recorrente — não é one-shot.' },
        { key: 'ticket_pedido',                 layer: 'icp', type: 'fit',        label: 'Ticket de pedido compatível',    inferenciaRd: 'valor médio do pedido ∈ faixa do produto',                            criterio: 'valor médio bate com faixa de pedido do Atacado',                       tooltip: 'Ticket de pedido (não unitário) compatível com a operação.' },
        { key: 'decisor_compras',               layer: 'bp',  type: 'fit',        label: 'Decisor de compras',             inferenciaRd: 'cargo "gerente de compras"/"sócio"/"dono"',                            criterio: 'cargo decisor de compras (não dono de RH, etc)',                        tooltip: 'Pessoa que decide a compra do estabelecimento.' },
        { key: 'relacionamento_continuo',       layer: 'bp',  type: 'completude', label: 'Relacionamento contínuo',        inferenciaRd: 'tag "cliente ativo" OU oportunidades fechadas > 1',                   criterio: null,                                                                    tooltip: 'Relação contínua — visita do SDR, contato regular, não cliente esporádico.' }
      ],
      refina: {},
      notas: 'Estabelecimento revende. Ticket é por PEDIDO (fardo/caixa), não unitário. SDR/representante visita. Inimigo é perder shelf-space ou virar commodity.'
    },

    consultoria: {
      label: 'Consultoria',
      contribui: [
        { key: 'empresa_porte_consultivel',     layer: 'pa',  type: 'fit',        label: 'Empresa porte consultível',      inferenciaRd: 'porte ≥ piso da consultoria',                                          criterio: 'porte/faturamento bate com piso pra contratar consultoria',             tooltip: 'Empresa tem porte/faturamento pra absorver um projeto de consultoria.' },
        { key: 'dor_estrategica',               layer: 'icp', type: 'fit',        label: 'Dor estratégica',                inferenciaRd: 'tag de dor estratégica (margem, market share, M&A)',                  criterio: 'dor mapeada é estratégica, não puramente operacional',                  tooltip: 'Dor mexe com estratégia, não só processo. Operacional não compra consultoria de R$ 100k.' },
        { key: 'verba_projeto',                 layer: 'icp', type: 'fit',        label: 'Verba disponível pro projeto',   inferenciaRd: 'oportunidade ≥ piso de fee do projeto',                                criterio: 'valor ∈ faixa de fee da consultoria',                                   tooltip: 'Tem verba pra ciclo de projeto (não só workshop avulso).' },
        { key: 'urgencia_definida',             layer: 'icp', type: 'completude', label: 'Urgência clara',                 inferenciaRd: 'tag/formulário "prazo até X"',                                          criterio: null,                                                                    tooltip: 'Há urgência clara — sem ela, projeto não fecha.' },
        { key: 'decisor_mandato',               layer: 'bp',  type: 'fit',        label: 'Decisor com mandato real',       inferenciaRd: "cargo ∈ {CEO, Sócio, Board, C-Level com mandato}",                     criterio: 'tem poder de assinar projeto sem 6 níveis acima',                       tooltip: 'Quem fala com você assina. Sem isso, consultoria empaca em comitê.' },
        { key: 'historico_consultoria',         layer: 'bp',  type: 'completude', label: 'Histórico com consultoria',      inferenciaRd: 'tag "contratou consultoria antes" OU mencionado no formulário',       criterio: null,                                                                    tooltip: 'Já contratou consultoria — entende o ciclo e o investimento.' }
      ],
      refina: {},
      notas: 'Ticket alto, ciclo longo, decisor sênior. Sem mandato, projeto vira reunião eterna. Inimigo é "vou pensar e te volto".'
    },

    manufatura: {
      label: 'Manufatura B2B',
      contribui: [
        { key: 'industria_compradora',          layer: 'pa',  type: 'fit',        label: 'Indústria compradora',           inferenciaRd: 'CNAE industrial + aplicação compatível',                                criterio: 'lead é indústria com aplicação clara do insumo/componente',              tooltip: 'Cliente é indústria — não revenda nem consumidor final.' },
        { key: 'aplicacao_produto',             layer: 'pa',  type: 'completude', label: 'Aplicação do produto',           inferenciaRd: 'tag/formulário com aplicação descrita',                                criterio: null,                                                                    tooltip: 'Sabe pra onde o produto vai (linha de produção X, montagem Y).' },
        { key: 'volume_industrial',             layer: 'icp', type: 'fit',        label: 'Volume industrial',              inferenciaRd: 'demanda mensal/anual estimada ≥ MOQ',                                  criterio: 'volume bate com MOQ e capacidade de produção',                          tooltip: 'Volume justifica setup de produção (não é amostra grátis).' },
        { key: 'compatibilidade_tecnica',       layer: 'icp', type: 'fit',        label: 'Compatibilidade técnica',        inferenciaRd: 'spec do cliente bate com spec do produto',                              criterio: 'especificação técnica bate ou tem ajuste viável',                       tooltip: 'Spec do cliente roda no seu produto — sem isso, não há venda.' },
        { key: 'decisor_tecnico_comercial',     layer: 'bp',  type: 'fit',        label: 'Decisor técnico + comercial',    inferenciaRd: 'dupla de contatos identificada (engenharia + compras)',                criterio: 'mapeou tanto o decisor técnico quanto o comercial',                      tooltip: 'B2B industrial tem duas portas: spec passa pela engenharia, preço pela compra.' },
        { key: 'homologacao_concluida',         layer: 'bp',  type: 'completude', label: 'Homologação',                    inferenciaRd: 'tag "homologado" OU oportunidades pós-amostra',                        criterio: null,                                                                    tooltip: 'Homologação concluída ou em curso — destrava pedidos firmes.' }
      ],
      refina: {},
      notas: 'B2B industrial. Dois decisores (técnico + comercial). Ciclo longo, homologação trava ou destrava tudo. Inimigo é spec que muda no meio do ciclo.'
    },

    agribusiness: {
      label: 'Agribusiness',
      contribui: [
        { key: 'produtor_ou_distribuidor',      layer: 'pa',  type: 'fit',        label: 'Produtor ou distribuidor',       inferenciaRd: 'CNAE rural OU cooperativa OU revenda agro',                            criterio: 'lead é produtor rural, cooperativa ou distribuidor de insumos agro',     tooltip: 'Lado do cliente na cadeia agro — produtor, cooperativa ou revenda.' },
        { key: 'cadeia_definida',               layer: 'pa',  type: 'completude', label: 'Cadeia de comercialização',      inferenciaRd: 'tag/formulário com cadeia mapeada',                                    criterio: null,                                                                    tooltip: 'Sabe pra quem vai vender depois (mercado, frigorífico, exportação).' },
        { key: 'safra_compativel',              layer: 'icp', type: 'fit',        label: 'Safra/janela compatível',        inferenciaRd: 'data atual ∈ janela de safra do produto',                              criterio: 'momento do ano bate com plantio/colheita/comercialização',              tooltip: 'Agro tem janela. Fora dela, lead esfria por meses.' },
        { key: 'escala_produtiva',              layer: 'icp', type: 'fit',        label: 'Escala produtiva viável',        inferenciaRd: 'hectares/cabeças ≥ piso da operação',                                  criterio: 'escala bate com piso de logística/preço',                                tooltip: 'Volume justifica a operação (frete, técnico, embalagem industrial).' },
        { key: 'decisor_proprietario',          layer: 'bp',  type: 'fit',        label: 'Decisor proprietário ou técnico',inferenciaRd: 'cargo ∈ {dono, sócio, técnico cooperativa}',                            criterio: 'decisor é o dono/família ou o técnico de confiança da cooperativa',     tooltip: 'Agro é familiar/de confiança — decisor é o dono ou o técnico que ele escuta.' },
        { key: 'confianca_relacional',          layer: 'bp',  type: 'completude', label: 'Confiança relacional',           inferenciaRd: 'tag "indicação" OU histórico de pedidos > 0',                          criterio: null,                                                                    tooltip: 'Negócio rural vive de confiança — sem relacionamento, não fecha.' }
      ],
      refina: {},
      notas: 'Cadeia agro. Vendedor visita ou cooperativa intermedia. Inimigo é janela de safra e ruptura de confiança. Negociação no boca a boca.'
    }
  };

  // V40.12.1 — Sprint 2: ÁTOMOS REFINADORES.
  // Nova categoria de átomos que NÃO contribuem com campos pra classificação
  // PA/ICP/BP, mas modulam como os módulos consumidores (card de Velocidade,
  // RevOps, Djow, Score) se comportam.
  //
  // Exemplo: ticket=micro + ciclo=impulso + time=autoatendimento + tracking=parcial
  // → card de Velocidade vai dizer "V = sessão única" e "Payback saudável < 1 mês".
  // Já ticket=alto + ciclo=longo + time=outbound + tracking=sim → "V = MQL no CRM"
  // e "Payback saudável 6-12 meses".
  //
  // Sem esses 4, modelos como B2B + Atacado ou B2C + E-commerce dariam o MESMO
  // arquétipo — sem nuance. Com eles, triangulação fina.
  const ATOMS_REFINAMENTO = {
    ticket: {
      label: 'Faixa de ticket por venda',
      tagline: 'Quanto cada venda vale, em média?',
      opcoes: [
        { id: 'micro',      label: 'Micro',      tagline: '< R$ 100',         description: 'Garrafa de cerveja, e-book, ingresso, app pago.' },
        { id: 'medio',      label: 'Médio',      tagline: 'R$ 100 a 1k',      description: 'Curso online, assinatura SaaS mensal, peça de roupa premium.' },
        { id: 'alto',       label: 'Alto',       tagline: 'R$ 1k a 10k',      description: 'Software corporativo, mentoria, treinamento.' },
        { id: 'enterprise', label: 'Enterprise', tagline: '> R$ 10k',         description: 'Contrato anual SaaS enterprise, consultoria estratégica, projeto industrial.' }
      ]
    },
    ciclo: {
      label: 'Ciclo de venda esperado',
      tagline: 'Quanto tempo do interesse até o fechamento?',
      opcoes: [
        { id: 'impulso', label: 'Impulso',    tagline: 'Minutos a horas',   description: 'Compra de impulso em e-commerce, infoproduto digital, ticket de evento.' },
        { id: 'curto',   label: 'Curto',      tagline: 'Dias',              description: 'SaaS self-service, curso com lançamento, atacado recorrente.' },
        { id: 'medio',   label: 'Médio',      tagline: 'Semanas',           description: 'B2B com SDR, agência, atacado novo cliente.' },
        { id: 'longo',   label: 'Longo',      tagline: 'Meses',             description: 'Enterprise SaaS, consultoria estratégica, manufatura, agribusiness.' }
      ]
    },
    time_comercial: {
      label: 'Time comercial',
      tagline: 'Quem fecha a venda?',
      opcoes: [
        { id: 'autoatendimento', label: 'Autoatendimento', tagline: 'Cliente fecha sozinho',    description: 'Checkout no site, signup self-service, app store. Sem humano no meio.' },
        { id: 'inbound',         label: 'Inbound',          tagline: 'SDR responde interesse',   description: 'Lead pede demo/orçamento, SDR responde e qualifica.' },
        { id: 'outbound',        label: 'Outbound consultivo', tagline: 'SDR prospecta ativo',  description: 'SDR/representante prospecta empresas, qualifica, agenda reunião.' },
        { id: 'hibrido',         label: 'Híbrido',           tagline: 'Auto + SDR',             description: 'Self-service pra baixo ticket, SDR pra alto. Comum em SaaS.' }
      ]
    },
    tracking_maduro: {
      label: 'Tracking maduro hoje?',
      tagline: 'O quanto a operação está instrumentada?',
      opcoes: [
        { id: 'sim',     label: 'Sim',     tagline: 'Tudo conectado',      description: 'UTM + GA4/Pixel + CRM integrado + atribuição confiável funcionando.' },
        { id: 'parcial', label: 'Parcial', tagline: 'Algumas peças',       description: 'Parte funciona (ex: UTM mas sem GA4, ou Pixel sem CRM integrado).' },
        { id: 'nao',     label: 'Não',     tagline: 'Vai começar do zero', description: 'Vai começar a instrumentar agora. Sem tracking ainda.' }
      ]
    }
  };

  // §5.3 — Regras de incompatibilidade (pares que exigem ajuste)
  const INCOMPATIBILIDADES = [
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
    },
    // V40.14.7 — 7 incompatibilidades novas pra fechar lacunas que faziam
    // confidence "ALTA" pra combinações que o LJ nunca havia visto. Antes
    // dessas regras, B2C+Atacado passava silencioso e somava +20% bônus de
    // "sem incompatibilidade" mesmo sendo conceitualmente errado.
    {
      par: { negocio: 'b2c', operacional: 'atacado' },
      acao: { rebaixar: [], remover: [], aviso: 'Atacado vende pra estabelecimento (bar, mercado, distribuidor). Pra consumidor final é incomum — talvez você queira B2C + E-commerce.' }
    },
    {
      par: { negocio: 'b2c', operacional: 'consultoria' },
      acao: { rebaixar: [], remover: [], aviso: 'Consultoria costuma exigir decisor sênior B2B. Consultoria pra consumidor final é nicho — confirme se é isso mesmo.' }
    },
    {
      par: { negocio: 'b2c', operacional: 'manufatura' },
      acao: { rebaixar: [], remover: [], aviso: 'Manufatura B2B é indústria → indústria. Pra consumidor final o modelo natural é E-commerce.' }
    },
    {
      par: { negocio: 'b2c', operacional: 'agribusiness' },
      acao: { rebaixar: [], remover: [], aviso: 'Agribusiness atua na cadeia rural (produtor → cooperativa → mercado). Pra consumidor final, o modelo natural é E-commerce.' }
    },
    {
      par: { negocio: 'b2c', operacional: 'marketplace' },
      acao: { rebaixar: [], remover: [], aviso: 'Marketplace é plataforma bilateral (oferta + demanda). B2C puro costuma ser E-commerce — verifique.' }
    },
    {
      par: { negocio: 'b2b', operacional: 'ecommerce' },
      acao: { rebaixar: [], remover: [], aviso: 'B2B com E-commerce existe (atacadista digital, SaaS self-service), mas confirme — talvez seja Atacado ou SaaS.' }
    },
    {
      par: { negocio: 'c2c', operacional: 'atacado' },
      acao: { rebaixar: [], remover: [], aviso: 'Atacado pede vendedor visitando estabelecimento. C2C raramente comporta isso — verifique se não seria Marketplace.' }
    }
  ];

  // §5.2 — Dedupe: pares de conceito que se sobrepõem (quem vence)
  const DEDUPE_PAIRS = [
    { conceitos: ['orcamento_recorrente', 'ticket_compativel', 'ticket_fit', 'volume_liquidez'], regra: 'manter_operacional_escolhido' },
    { conceitos: ['historico_conversao', 'historico_compra_online'],                              regra: 'manter_mais_especifico' },
    { conceitos: ['empresa_corporativa', 'contrata_servico'],                                     regra: 'manter_empresa_corporativa' }
  ];

  window.AudienceAtomsCatalog = {
    // V40.12.1 — Bump minor (1.0.0 → 1.1.0): adicionado ATOMS_REFINAMENTO e
    // 4 novos modelos operacionais (atacado, consultoria, manufatura, agribusiness).
    // Retrocompat 100% — campos antigos continuam funcionando. Audiências
    // fundidas em 1.0.0 ficam dormentes; banner opcional pode oferecer refusão.
    CATALOG_VERSION: '1.1.0',
    // V40.14.7 — Bump 1.0.0 → 1.1.0: +7 pares de incompatibilidade pra
    // cobrir combinações B2C-esquisitas (Atacado/Consultoria/Manufatura/
    // Agribusiness/Marketplace), B2B+E-commerce e C2C+Atacado. Átomos não
    // mudaram — só regras.
    RULES_VERSION:   '1.1.0',
    NUCLEO_COMUM,
    ATOMS_NEGOCIO,
    ATOMS_OPERACIONAL,
    ATOMS_REFINAMENTO,
    INCOMPATIBILIDADES,
    DEDUPE_PAIRS
  };
})();
