// V40.7.15 — Population complementar do demo Engenho Norte:
//   - Mapa da Receita (visão + productKrs + areaOwners + objectives legacy) pros 3 produtos
//   - Audiência composicional (PA/ICP/BP) pros 3 produtos
//   - ~150 leads fictícios distribuídos nas ações
//
// Gerador puro. Aplicação em api/admin-add-demo-mapa-audiencia-leads.js.

const NOW_ISO = '2026-06-19T00:00:00Z';

function iso(daysAgo = 0) {
  const d = new Date(NOW_ISO);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}
function uid(prefix) { return `${prefix}_${Math.random().toString(36).slice(2, 9)}`; }
function pick(arr, i) { return arr[i % arr.length]; }

const PRODUCT_IDS = {
  PILSEN: 1781869701831,
  WEISS: 5001,
  CHOPP: 5002
};

// ============================================================
// MAPA DA RECEITA
// ============================================================

const STRATEGIC_MAPS_CONFIG = [
  {
    productId: PRODUCT_IDS.PILSEN,
    vision: 'Ser a Pilsen mais consumida do Sudeste, presente em 10.000 bares até dezembro de 2027.',
    areaOwners: { marketing: 'Marina Costa', sales: 'Rafael Almeida', cs: 'Beatriz Ribeiro' },
    krs: [
      { area: 'marketing', name: 'Leads gerados/mês',        target: 3500,    current: 1900,    unit: 'leads', catalogId: 'mkt_leads',  owner: 'Marina Costa' },
      { area: 'marketing', name: 'CPL médio',                target: 15,      current: 22,      unit: 'R$',    catalogId: 'mkt_cpl',    owner: 'Marina Costa' },
      { area: 'sales',     name: 'Bares parceiros ativos',   target: 1200,    current: 740,     unit: 'un',    catalogId: 'sal_b2b_customers', owner: 'Rafael Almeida' },
      { area: 'sales',     name: 'Receita trimestral',       target: 800000,  current: 633600,  unit: 'R$',    catalogId: 'sal_revenue', owner: 'Rafael Almeida' },
      { area: 'cs',        name: 'Recompra bar 30d',         target: 65,      current: 42,      unit: '%',     catalogId: 'cs_retention', owner: 'Beatriz Ribeiro' },
      { area: 'cs',        name: 'NPS',                      target: 70,      current: 56,      unit: 'pts',   catalogId: 'cs_nps',     owner: 'Beatriz Ribeiro' }
    ]
  },
  {
    productId: PRODUCT_IDS.WEISS,
    vision: 'Tornar-se referência em Weiss premium no eixo SP-RJ, ocupando 500 PDVs gourmet em 18 meses.',
    areaOwners: { marketing: 'Júlia Mendes', sales: 'Thiago Pereira', cs: 'Camila Souza' },
    krs: [
      { area: 'marketing', name: 'Alcance qualificado/mês',  target: 50000,   current: 28000,   unit: 'pessoas', catalogId: 'mkt_reach', owner: 'Júlia Mendes' },
      { area: 'marketing', name: 'Conversão LP',             target: 4,       current: 2.1,     unit: '%',     catalogId: 'mkt_conv',   owner: 'Júlia Mendes' },
      { area: 'sales',     name: 'Bares premium ativos',     target: 280,     current: 165,     unit: 'un',    catalogId: 'sal_premium_customers', owner: 'Thiago Pereira' },
      { area: 'sales',     name: 'Ticket médio por bar',     target: 750,     current: 610,     unit: 'R$',    catalogId: 'sal_avg_ticket', owner: 'Thiago Pereira' },
      { area: 'cs',        name: 'Recompra 60d',             target: 55,      current: 38,      unit: '%',     catalogId: 'cs_retention', owner: 'Camila Souza' },
      { area: 'cs',        name: 'Eventos com presença Weiss', target: 18,    current: 8,       unit: 'un',    catalogId: 'cs_events',  owner: 'Camila Souza' }
    ]
  },
  {
    productId: PRODUCT_IDS.CHOPP,
    vision: 'Liderar o conceito de Chopp de Vinho no Brasil, presente nas 50 mesas mais sofisticadas até 2027.',
    areaOwners: { marketing: 'Eduardo Lima', sales: 'Fernanda Rocha', cs: 'André Carvalho' },
    krs: [
      { area: 'marketing', name: 'Cobertura mídia gastronômica', target: 12,  current: 4,       unit: 'publicações', catalogId: 'mkt_pr',  owner: 'Eduardo Lima' },
      { area: 'marketing', name: 'Leads sommelier/mês',      target: 80,      current: 32,      unit: 'leads', catalogId: 'mkt_leads',  owner: 'Eduardo Lima' },
      { area: 'sales',     name: 'Top 50 ativos',            target: 35,      current: 12,      unit: 'restaurantes', catalogId: 'sal_top50', owner: 'Fernanda Rocha' },
      { area: 'sales',     name: 'Receita trimestral',       target: 259200,  current: 207360,  unit: 'R$',    catalogId: 'sal_revenue', owner: 'Fernanda Rocha' },
      { area: 'cs',        name: 'Embaixadores ativos',      target: 25,      current: 9,       unit: 'un',    catalogId: 'cs_ambassadors', owner: 'André Carvalho' },
      { area: 'cs',        name: 'NPS embaixador',           target: 80,      current: 71,      unit: 'pts',   catalogId: 'cs_nps',     owner: 'André Carvalho' }
    ]
  }
];

function buildStrategicMaps(campaigns) {
  const maps = {};
  for (const cfg of STRATEGIC_MAPS_CONFIG) {
    const firstCampaign = (campaigns || []).find(c => Number(c.productId) === Number(cfg.productId));
    const productKrs = cfg.krs.map(kr => ({
      id: uid('pkr'),
      area: kr.area,
      name: kr.name,
      metric: typeof kr.target === 'number' && kr.unit === 'R$' ? 'reais' : (kr.unit === '%' ? 'percentual' : 'quantidade'),
      target: kr.target,
      current: kr.current,
      unit: kr.unit,
      deadline: '2026-09-30',
      owner: kr.owner,
      parentKrId: null,
      catalogId: kr.catalogId
    }));
    // Objectives legacy V29 — espelha branch ativo pro journeyProgress reconhecer
    const objectives = ['marketing', 'sales', 'cs'].map(area => ({
      id: uid('obj'),
      label: area === 'marketing' ? 'Marketing' : (area === 'sales' ? 'Vendas' : 'CS'),
      area,
      owner: cfg.areaOwners[area],
      deadline: '2026-09-30',
      okrs: cfg.krs.filter(k => k.area === area).map(kr => ({
        id: uid('okr'),
        name: kr.name,
        target: kr.target,
        current: kr.current,
        unit: kr.unit,
        metric: kr.unit === 'R$' ? 'reais' : (kr.unit === '%' ? 'percentual' : 'quantidade'),
        stageId: area === 'marketing' ? 'TOF' : (area === 'sales' ? 'BOF' : 'BOF'),
        connectedActionIds: []
      })),
      createdAt: iso(40)
    }));
    maps[cfg.productId] = {
      productId: cfg.productId,
      vision: cfg.vision,
      productKrs,
      strategicCampaignId: firstCampaign?.id || null,
      areaOwners: cfg.areaOwners,
      metricsExecutedAt: iso(25),
      flowConnections: [],
      objectives,
      createdAt: iso(45),
      updatedAt: iso(2)
    };
  }
  return maps;
}

// ============================================================
// AUDIÊNCIA COMPOSICIONAL
// ============================================================

const AUDIENCE_CONFIG = {
  [PRODUCT_IDS.PILSEN]: {
    modeloNegocio: 'B2B2C',
    modeloOperacional: 'híbrido',
    salesChannel: 'multi-canal',
    schema: 'cpg-cervejaria',
    quadroPA: [
      { id: uid('pa'), titulo: 'Bar de bairro fiel',           descricao: 'Bar de bairro com clientela cativa, fatura R$ 30-60k/mês, dono pessoalmente no caixa, valoriza relação direta com fornecedor.', tags: ['B2B', 'bar', 'tradicional'] },
      { id: uid('pa'), titulo: 'Adega popular',                descricao: 'Adega com volume alto e ticket médio R$ 25-40, atende delivery + balcão, alta giro semanal.', tags: ['B2B', 'varejo'] },
      { id: uid('pa'), titulo: 'Distribuidora regional',       descricao: 'Distribuidora que atende 200+ PDVs no interior, relaciona com vendedor de campo direto.', tags: ['B2B', 'atacado'] }
    ],
    quadroICP: [
      { id: uid('icp'), titulo: 'Bar 50-200 lugares', descricao: 'Bar/petiscaria com 50-200 lugares, ticket R$ 35, recompra 60-90d, atende noite + happy hour.', tier: 'tier_1', tags: ['volume', 'sudeste'] },
      { id: uid('icp'), titulo: 'Restaurante casual', descricao: 'Restaurante casual com volume de almoço + cerveja na noite, R$ 80/mês de R$ 800-1500 em cerveja.', tier: 'tier_2', tags: ['mix'] },
      { id: uid('icp'), titulo: 'Mercado de bairro',  descricao: 'Mercado com geladeira de bebidas, giro semanal de 500-800 unidades.', tier: 'tier_3', tags: ['varejo'] }
    ],
    quadroBP: [
      { id: uid('bp'), titulo: 'Dono operador',  descricao: 'Dono/sócio 35-55 anos, opera o caixa pessoalmente, conhece todos clientes pelo nome.', persona: 'decisor' },
      { id: uid('bp'), titulo: 'Gerente compras',descricao: 'Gerente de compras de rede com 5-15 unidades, foca em margem e regularidade de entrega.', persona: 'influenciador' }
    ]
  },
  [PRODUCT_IDS.WEISS]: {
    modeloNegocio: 'B2B2C',
    modeloOperacional: 'híbrido',
    salesChannel: 'gastronômico',
    schema: 'cpg-cervejaria-premium',
    quadroPA: [
      { id: uid('pa'), titulo: 'Gastrobar curado',     descricao: 'Gastrobar com curadoria de cervejas, sommelier residente, pega festivais cervejeiros.', tags: ['premium', 'gourmet'] },
      { id: uid('pa'), titulo: 'Cervejaria especializada', descricao: 'Cervejaria que vende exclusivamente artesanais, ticket R$ 90+, frequência de eventos.', tags: ['nicho'] },
      { id: uid('pa'), titulo: 'Festival cervejeiro', descricao: 'Organizador de festival cervejeiro em cidades médias, busca marcas de portfólio variado.', tags: ['evento'] }
    ],
    quadroICP: [
      { id: uid('icp'), titulo: 'Gastrobar ticket R$ 80+',  descricao: 'PDVs com ticket médio R$ 80+, sommelier ou cervejeiro residente, programa de novidades trimestral.', tier: 'tier_1', tags: ['SP', 'RJ'] },
      { id: uid('icp'), titulo: 'Cervejaria curada',        descricao: 'Cervejaria com 30+ rótulos artesanais, foco em educação do paladar.', tier: 'tier_1', tags: ['premium'] },
      { id: uid('icp'), titulo: 'Hotel boutique',            descricao: 'Hotel boutique com curadoria de cervejas no minibar, hospedagem alto padrão.', tier: 'tier_2', tags: ['hospitalidade'] }
    ],
    quadroBP: [
      { id: uid('bp'), titulo: 'Sommelier de cerveja', descricao: 'Sommelier ou cervejeiro residente, 30-45 anos, segue trends, participa de competições.', persona: 'decisor' },
      { id: uid('bp'), titulo: 'Gerente de compras gourmet', descricao: 'Gerente de compras de rede gourmet, foco em diferenciação + margem.', persona: 'decisor' }
    ]
  },
  [PRODUCT_IDS.CHOPP]: {
    modeloNegocio: 'B2B2C',
    modeloOperacional: 'híbrido',
    salesChannel: 'alta-gastronomia',
    schema: 'cpg-bebida-luxo',
    quadroPA: [
      { id: uid('pa'), titulo: 'Restaurante de chef',      descricao: 'Restaurante de chef estrelado/Michelin, carta de vinhos curada, busca elementos diferenciadores únicos.', tags: ['estrelado', 'inovação'] },
      { id: uid('pa'), titulo: 'Hotel 5 estrelas',          descricao: 'Hotel 5 estrelas com restaurante assinatura, busca experiência exclusiva pro hóspede.', tags: ['luxo'] },
      { id: uid('pa'), titulo: 'Evento corporativo VIP',   descricao: 'Organizador de eventos VIP/corporativos onde experiência sensorial é diferencial.', tags: ['evento'] }
    ],
    quadroICP: [
      { id: uid('icp'), titulo: 'Top 50 SP/RJ',         descricao: 'Top 50 restaurantes do Brasil, mínimo 12 meses operação, ticket R$ 250+, sommelier profissional.', tier: 'tier_1', tags: ['top50'] },
      { id: uid('icp'), titulo: 'Hotel 5* eixo SP-RJ',   descricao: 'Hotel 5 estrelas eixo SP-RJ com restaurante assinatura premiado.', tier: 'tier_1', tags: ['hospitalidade'] },
      { id: uid('icp'), titulo: 'Casa de eventos VIP', descricao: 'Casa de eventos premium ticket R$ 500+, eventos exclusivos.', tier: 'tier_2', tags: ['evento'] }
    ],
    quadroBP: [
      { id: uid('bp'), titulo: 'Sommelier profissional', descricao: 'Sommelier/maître profissional 35-50 anos, formação enológica, busca produtos únicos pra surpreender o cliente.', persona: 'decisor' },
      { id: uid('bp'), titulo: 'Chef proprietário',       descricao: 'Chef proprietário, decide pessoalmente sobre carta de bebidas, valoriza storytelling do produto.', persona: 'decisor' }
    ]
  }
};

function buildAudienceForProducts(existingProducts) {
  return (existingProducts || []).map(product => {
    const cfg = AUDIENCE_CONFIG[product.id];
    if (!cfg) return product;
    return {
      ...product,
      audience: {
        configured: true,
        modeloNegocio: cfg.modeloNegocio,
        modeloOperacional: cfg.modeloOperacional,
        salesChannel: cfg.salesChannel,
        schema: cfg.schema,
        customized: false,
        customFields: { pa: [], icp: [], bp: [] },
        quadroPA: cfg.quadroPA,
        quadroICP: cfg.quadroICP,
        quadroBP: cfg.quadroBP
      }
    };
  });
}

// ============================================================
// LEADS (~150 distribuídos nas ações)
// ============================================================

const FIRST_NAMES = ['Marina', 'Pedro', 'Rafael', 'Beatriz', 'João', 'Lucas', 'Ana', 'Carlos', 'Juliana', 'Felipe', 'Camila', 'Bruno', 'Letícia', 'André', 'Fernanda', 'Ricardo', 'Patrícia', 'Diego', 'Larissa', 'Henrique', 'Vitória', 'Murilo', 'Isabela', 'Renato'];
const LAST_NAMES = ['Silva', 'Santos', 'Oliveira', 'Pereira', 'Costa', 'Almeida', 'Ferreira', 'Rodrigues', 'Souza', 'Lima', 'Carvalho', 'Ribeiro', 'Martins', 'Araujo', 'Mendes'];
const ESTADOS = ['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA'];
const CIDADES = { SP: 'São Paulo', RJ: 'Rio de Janeiro', MG: 'Belo Horizonte', RS: 'Porto Alegre', PR: 'Curitiba', SC: 'Florianópolis', BA: 'Salvador' };
const LIFECYCLES = ['subscriber', 'lead', 'lead', 'mql', 'sql', 'customer'];

// V40.7.17 — distribuição inflada pra a tela "Leads" do produto não parecer vazia
// vs os KRs de leads/mês em milhares. Antes: 70/50/30 = 150 totais.
const PRODUCT_LEAD_DIST = {
  [PRODUCT_IDS.PILSEN]: 250,
  [PRODUCT_IDS.WEISS]: 150,
  [PRODUCT_IDS.CHOPP]: 60
};

function buildLeadsForActions(state) {
  const campaigns = state.campaigns || [];
  const actions = state.actions || [];
  const campaignToProduct = new Map();
  for (const c of campaigns) campaignToProduct.set(Number(c.id), Number(c.productId));

  const actionsByProduct = new Map();
  for (const a of actions) {
    const pid = campaignToProduct.get(Number(a.campaignId));
    if (!pid) continue;
    if (!actionsByProduct.has(pid)) actionsByProduct.set(pid, []);
    actionsByProduct.get(pid).push(a);
  }

  const allLeads = [];
  let leadIdSeq = 6000;

  for (const [productIdStr, total] of Object.entries(PRODUCT_LEAD_DIST)) {
    const productId = Number(productIdStr);
    const productActions = actionsByProduct.get(productId) || [];
    if (!productActions.length) continue;

    // Distribui leads entre as ações — mais leads nas TOF (captura)
    const weights = productActions.map(a => {
      const funnel = String(a.funnel || a.originFunnel || 'TOF').toUpperCase();
      return funnel === 'TOF' ? 3 : (funnel === 'MOF' ? 2 : 1);
    });
    const totalWeight = weights.reduce((s, w) => s + w, 0);

    let distributed = 0;
    productActions.forEach((action, idx) => {
      const isLast = idx === productActions.length - 1;
      let leadCount = isLast ? (total - distributed) : Math.round((weights[idx] / totalWeight) * total);
      distributed += leadCount;
      if (leadCount <= 0) return;

      const actionLeads = [];
      for (let i = 0; i < leadCount; i++) {
        const fn = pick(FIRST_NAMES, leadIdSeq * 7);
        const ln = pick(LAST_NAMES, leadIdSeq * 11);
        const estado = pick(ESTADOS, leadIdSeq);
        const cidade = CIDADES[estado] || 'Capital';
        const lifecycle = pick(LIFECYCLES, leadIdSeq * 3);
        const score = 30 + ((leadIdSeq * 13) % 65);
        const daysAgo = (leadIdSeq * 7) % 60;
        const isCustomer = lifecycle === 'customer';
        const leadObj = {
          id: leadIdSeq++,
          actionId: action.id,
          campaignId: action.campaignId,
          name: `${fn} ${ln}`,
          email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i % 99}@email.com`,
          phone: `11${(900000000 + leadIdSeq * 137).toString().slice(-9)}`,
          tags: `#${String(action.funnel || 'tof').toLowerCase()} #${String(action.channel || '').split(' ')[0].toLowerCase() || 'organic'}`,
          score,
          estado,
          cidade,
          lifecycleStage: lifecycle,
          lifecycleStageAt: iso(daysAgo),
          cohortMonth: iso(daysAgo).slice(0, 7),
          outcome: isCustomer ? 'Conversão' : null,
          outcomeAt: isCustomer ? iso(Math.floor(daysAgo / 2)) : null,
          triggerEvents: [],
          scoreHistory: [
            { date: iso(daysAgo), score: Math.max(20, score - 20), reason: 'Captura inicial' },
            { date: iso(Math.floor(daysAgo / 2)), score, reason: 'Engajamento' }
          ],
          eventHistory: [],
          source: 'manual',
          createdAt: iso(daysAgo)
        };
        actionLeads.push(leadObj);
        allLeads.push(leadObj);
      }
      action.leads = actionLeads;
    });
  }

  return { allLeads, actionsUpdated: actions };
}

function buildMapaAudienciaLeadsAddon(state) {
  const campaigns = state.campaigns || [];
  const existingProducts = state.products || [];

  const strategicMaps = buildStrategicMaps(campaigns);
  const productsWithAudience = buildAudienceForProducts(existingProducts);
  const { allLeads, actionsUpdated } = buildLeadsForActions({
    ...state,
    products: productsWithAudience
  });

  return {
    products: productsWithAudience,
    strategicMaps,
    actions: actionsUpdated,
    manualLeads: allLeads,
    meta: {
      addonVersion: 'demo-mapa-audiencia-leads-v1',
      generatedAt: NOW_ISO,
      counts: {
        strategicMaps: Object.keys(strategicMaps).length,
        productsWithAudience: productsWithAudience.length,
        leadsTotal: allLeads.length,
        leadsByProduct: Object.fromEntries(
          Object.entries(PRODUCT_LEAD_DIST).map(([pid, n]) => [pid, n])
        )
      }
    }
  };
}

const ADDON_VERSION = 'demo-mapa-audiencia-leads-v1';

module.exports = { buildMapaAudienciaLeadsAddon, ADDON_VERSION };
