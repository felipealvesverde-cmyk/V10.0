// V31.0.0 — Gerador de state pra empresa fictícia "Engenho Norte" (cervejaria).
// Exportado pra ser usado em server.js (runMigrations) no startup.
// Idempotente: o caller checa se o demo user já tem state antes de chamar.
//
// Estrutura: 3 produtos × 4 campanhas/produto × 16 ações/campanha = 192 ações
// + OKRs (Mapa Estratégico V29) + branches por campanha + leads + RevOps.

const SEED_BASE_DATE = '2026-04-01T00:00:00Z';
const NOW = '2026-05-17T00:00:00Z';

// --- Helpers ---
function iso(daysAgo = 0) {
  const d = new Date('2026-05-17T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}
function uid(prefix) { return `${prefix}_${Math.random().toString(36).slice(2, 9)}`; }
function pick(arr, i) { return arr[i % arr.length]; }

// --- Catálogos pra gerar ações realistas ---
const CHANNELS_MKT = ['Instagram Orgânico', 'Meta Ads', 'Google Ads', 'TikTok Orgânico', 'YouTube', 'RD Email', 'Blog SEO', 'Influenciador'];
const CHANNELS_SALES = ['WhatsApp', 'LinkedIn Outbound', 'Cold Email', 'Telefone', 'Reunião Presencial'];
const CHANNELS_CS = ['Email transacional', 'WhatsApp pós-venda', 'Programa Fidelidade', 'NPS Survey'];

const TYPES_MKT = ['Post', 'Anúncio pago', 'Sequência email', 'Webinar', 'Landing page', 'Live'];
const TYPES_SALES = ['Outbound 1-1', 'Demo agendada', 'Follow-up', 'Proposta'];
const TYPES_CS = ['Onboarding', 'Check-in', 'Reativação', 'Upsell'];

const FUNNEL = ['TOF', 'MOF', 'BOF'];
const SECTORS = ['marketing', 'sales', 'cs'];

// --- Produtos ---
const PRODUCTS = [
  {
    id: 1001,
    name: 'Engenho IPA',
    type: 'Cerveja artesanal',
    price: 'R$ 35',
    priceValue: 35,
    revenueModel: 'Venda única',
    operationalCost: 'R$ 12',
    operationalCostValue: 12,
    status: 'Ativo',
    unitProfit: 23,
    marginPercent: 66,
    grossMargin: '66%',
    mrr: 'R$ 0',
    arr: 'R$ 35',
    revenueScore: 78,
    healthScore: 82,
    okrs: [],
    createdAt: iso(45)
  },
  {
    id: 1002,
    name: 'Engenho Weiss',
    type: 'Cerveja artesanal',
    price: 'R$ 30',
    priceValue: 30,
    revenueModel: 'Venda única',
    operationalCost: 'R$ 10',
    operationalCostValue: 10,
    status: 'Ativo',
    unitProfit: 20,
    marginPercent: 67,
    grossMargin: '67%',
    mrr: 'R$ 0',
    arr: 'R$ 30',
    revenueScore: 71,
    healthScore: 75,
    okrs: [],
    createdAt: iso(44)
  },
  {
    id: 1003,
    name: 'Engenho Porter',
    type: 'Cerveja artesanal',
    price: 'R$ 40',
    priceValue: 40,
    revenueModel: 'Venda única',
    operationalCost: 'R$ 14',
    operationalCostValue: 14,
    status: 'Ativo',
    unitProfit: 26,
    marginPercent: 65,
    grossMargin: '65%',
    mrr: 'R$ 0',
    arr: 'R$ 40',
    revenueScore: 68,
    healthScore: 72,
    okrs: [],
    createdAt: iso(43)
  }
];

// --- Campanhas (4 por produto = 12) ---
const CAMPAIGN_TEMPLATES = [
  { suffix: 'Awareness Q2', objective: 'Gerar 1.500 leads qualificados no trimestre', sector: 'Marketing', mediaInvestment: 12000 },
  { suffix: 'Conversão Lançamento', objective: 'Converter 300 leads em primeira compra', sector: 'Marketing', mediaInvestment: 8000 },
  { suffix: 'Retenção Cervejeiros', objective: 'Aumentar recompra em 40%', sector: 'CS', mediaInvestment: 3000 },
  { suffix: 'Distribuição Bares', objective: 'Fechar 25 bares parceiros', sector: 'Vendas', mediaInvestment: 5000 }
];

const CAMPAIGNS = [];
PRODUCTS.forEach((product, pIdx) => {
  CAMPAIGN_TEMPLATES.forEach((tpl, cIdx) => {
    CAMPAIGNS.push({
      id: 2000 + pIdx * 10 + cIdx + 1,
      productId: product.id,
      name: `${product.name} — ${tpl.suffix}`,
      objective: tpl.objective,
      owner: pIdx === 0 ? 'Marina' : pIdx === 1 ? 'Rafael' : 'Beatriz',
      sector: tpl.sector,
      status: 'Ativa',
      mediaInvestment: tpl.mediaInvestment,
      okrs: [],
      createdAt: iso(40 - pIdx * 2 - cIdx)
    });
  });
});

// --- Ações (16 por campanha = 192) ---
function generateActions() {
  const all = [];
  let actionIdSeq = 3000;
  CAMPAIGNS.forEach(camp => {
    const isMkt = camp.sector === 'Marketing';
    const isSales = camp.sector === 'Vendas';
    const isCs = camp.sector === 'CS';
    const channels = isMkt ? CHANNELS_MKT : isSales ? CHANNELS_SALES : CHANNELS_CS;
    const types = isMkt ? TYPES_MKT : isSales ? TYPES_SALES : TYPES_CS;
    for (let i = 0; i < 16; i++) {
      const funnel = pick(FUNNEL, i);
      const channel = pick(channels, i);
      const actionType = pick(types, i);
      const sector = isMkt ? 'marketing' : isSales ? 'sales' : 'cs';
      const status = i < 10 ? 'Pronta para conectar' : i < 14 ? 'Rascunho estratégico' : 'Conectada';
      all.push({
        id: actionIdSeq++,
        campaignId: camp.id,
        name: `${actionType} — ${channel} #${i + 1}`,
        channel,
        actionType,
        sector,
        funnel,
        originSector: sector,
        originFunnel: funnel,
        destinationSector: sector,
        destinationFunnel: funnel === 'TOF' ? 'MOF' : funnel === 'MOF' ? 'BOF' : 'BOF',
        objective: `Mover lead de ${funnel} para próximo estágio`,
        conversionObjective: funnel === 'TOF' ? 'Lead capturado' : funnel === 'MOF' ? 'Lead qualificado' : 'Compra realizada',
        expectedConversion: funnel === 'TOF' ? 25 : funnel === 'MOF' ? 18 : 12,
        status,
        flowPath: [],
        flowConfig: null,
        okrs: [],
        kpis: [],
        rdEmailConfig: {},
        scoreId: 1,
        connected: status === 'Conectada',
        connectionStatus: status === 'Conectada' ? 'connected' : 'ready',
        mailingDefined: false,
        leads: [],
        createdAt: iso(35 - Math.floor(i / 4))
      });
    }
  });
  return all;
}
const ACTIONS = generateActions();

// --- Leads (~100, distribuídos em algumas ações) ---
const LEAD_FIRST_NAMES = ['Marina', 'Pedro', 'Rafael', 'Beatriz', 'João', 'Lucas', 'Ana', 'Carlos', 'Juliana', 'Felipe', 'Camila', 'Bruno', 'Letícia', 'André', 'Fernanda', 'Ricardo', 'Patrícia', 'Diego'];
const LEAD_LAST_NAMES = ['Silva', 'Santos', 'Oliveira', 'Pereira', 'Costa', 'Almeida', 'Ferreira', 'Rodrigues', 'Souza', 'Lima', 'Carvalho', 'Ribeiro'];
const STATES = ['SP', 'RJ', 'MG', 'RS', 'PR', 'SC', 'BA', 'PE'];
const LIFECYCLES = ['subscriber', 'lead', 'lead', 'mql', 'sql', 'customer'];

function generateLeads() {
  const leads = [];
  let leadIdSeq = 4000;
  // Distribui leads em ~30 ações
  const actionsWithLeads = ACTIONS.filter((_, i) => i % 6 === 0).slice(0, 30);
  actionsWithLeads.forEach((action, aIdx) => {
    const count = 3 + (aIdx % 3); // 3-5 leads
    for (let i = 0; i < count; i++) {
      const fn = pick(LEAD_FIRST_NAMES, leadIdSeq);
      const ln = pick(LEAD_LAST_NAMES, leadIdSeq);
      const state = pick(STATES, leadIdSeq);
      const lifecycle = pick(LIFECYCLES, leadIdSeq);
      const score = 30 + ((leadIdSeq * 13) % 65);
      const daysAgo = (leadIdSeq * 7) % 45;
      leads.push({
        id: leadIdSeq++,
        actionId: action.id,
        campaignId: action.campaignId,
        name: `${fn} ${ln}`,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@email.com`,
        phone: `11${(900000000 + leadIdSeq * 137).toString().slice(-9)}`,
        tags: `#${action.funnel.toLowerCase()} #${action.channel.split(' ')[0].toLowerCase()}`,
        score,
        estado: state,
        cidade: state === 'SP' ? 'São Paulo' : state === 'RJ' ? 'Rio de Janeiro' : state === 'MG' ? 'Belo Horizonte' : 'Capital',
        lifecycleStage: lifecycle,
        lifecycleStageAt: iso(daysAgo),
        cohortMonth: '2026-05',
        outcome: lifecycle === 'customer' ? 'Conversão' : null,
        outcomeAt: lifecycle === 'customer' ? iso(Math.floor(daysAgo / 2)) : null,
        triggerEvents: [],
        scoreHistory: [
          { date: iso(daysAgo), score: Math.max(20, score - 20), reason: 'Captura inicial' },
          { date: iso(Math.floor(daysAgo / 2)), score, reason: 'Engajamento' }
        ],
        eventHistory: [],
        source: 'manual',
        createdAt: iso(daysAgo)
      });
    }
    // Vincula leads à action
    action.leads = leads.filter(l => l.actionId === action.id);
  });
  return leads;
}
const ALL_LEADS = generateLeads();

// --- Mapa Estratégico V29 (productKrs do CEO) ---
function buildStrategicMaps() {
  const maps = {};
  PRODUCTS.forEach((product, idx) => {
    const visionByIdx = [
      'Ser a IPA artesanal mais vendida do Sudeste em 12 meses.',
      'Tornar-se referência em Weiss premium nos bares de São Paulo.',
      'Liderar o segmento de cerveja escura artesanal no Brasil.'
    ];
    maps[product.id] = {
      productId: product.id,
      vision: visionByIdx[idx],
      productKrs: [
        { id: uid('pkr'), name: 'Receita trimestral', metric: 'reais', target: 180000 + idx * 40000, current: 95000 + idx * 22000, unit: 'R$', deadline: '2026-09-30', owner: 'CEO', parentKrId: null, catalogId: 'ceo_revenue' },
        { id: uid('pkr'), name: 'EBITDA', metric: 'percentual', target: 22, current: 14, unit: '%', deadline: '2026-09-30', owner: 'CEO', parentKrId: null, catalogId: 'ceo_ebitda' },
        { id: uid('pkr'), name: 'Volume de vendas', metric: 'quantidade', target: 4500 + idx * 800, current: 2100 + idx * 350, unit: 'un', deadline: '2026-09-30', owner: 'CEO', parentKrId: null, catalogId: 'ceo_units' },
        { id: uid('pkr'), name: 'NPS', metric: 'percentual', target: 70, current: 58, unit: 'pts', deadline: '2026-09-30', owner: 'CS', parentKrId: null, catalogId: 'ceo_nps' },
        { id: uid('pkr'), name: 'Recompra', metric: 'percentual', target: 35, current: 22, unit: '%', deadline: '2026-09-30', owner: 'CS', parentKrId: null, catalogId: 'ceo_retention' }
      ],
      strategicCampaignId: CAMPAIGNS.find(c => c.productId === product.id)?.id || null,
      flowConnections: [],
      objectives: [],
      createdAt: iso(45 - idx),
      updatedAt: iso(5)
    };
  });
  return maps;
}
const STRATEGIC_MAPS = buildStrategicMaps();

// --- Branches por campanha (strategicCampaignMaps V29) ---
function buildCampaignBranches() {
  const branches = {};
  CAMPAIGNS.forEach((camp, cIdx) => {
    const productMap = STRATEGIC_MAPS[camp.productId];
    const parentRevenue = productMap.productKrs[0].id;
    const parentEbitda = productMap.productKrs[1].id;
    const parentUnits = productMap.productKrs[2].id;
    const parentNps = productMap.productKrs[3].id;
    branches[camp.id] = {
      campaignId: camp.id,
      productId: camp.productId,
      objective: camp.objective,
      objectives: [
        {
          id: uid('obj'),
          label: 'Marketing',
          area: 'marketing',
          owner: 'Marina',
          deadline: '2026-09-30',
          okrs: [
            { id: uid('okr'), name: 'Leads gerados', metric: 'quantidade', catalogId: 'mkt_leads', isHandoff: true, current: 320 + cIdx * 40, targetCommitted: 800, targetStretch: 1200, period: 90, confirmed: true, connectedActionIds: [], parentProductKrId: parentRevenue },
            { id: uid('okr'), name: 'CAC marketing', metric: 'reais', catalogId: 'mkt_cac', isHandoff: false, current: 38, targetCommitted: 30, targetStretch: 22, period: 90, confirmed: true, connectedActionIds: [], parentProductKrId: parentEbitda },
            { id: uid('okr'), name: 'Engajamento Instagram', metric: 'percentual', catalogId: 'mkt_engagement', isHandoff: false, current: 4.2, targetCommitted: 6, targetStretch: 8, period: 90, confirmed: false, connectedActionIds: [], parentProductKrId: parentRevenue }
          ],
          createdAt: iso(30 - cIdx)
        },
        {
          id: uid('obj'),
          label: 'Vendas',
          area: 'sales',
          owner: 'Rafael',
          deadline: '2026-09-30',
          okrs: [
            { id: uid('okr'), name: 'Vendas fechadas', metric: 'quantidade', catalogId: 'sal_new_clients', isHandoff: true, current: 85 + cIdx * 12, targetCommitted: 200, targetStretch: 300, period: 90, confirmed: true, connectedActionIds: [], parentProductKrId: parentUnits },
            { id: uid('okr'), name: 'Taxa de conversão', metric: 'percentual', catalogId: 'sal_conversion', isHandoff: false, current: 12, targetCommitted: 18, targetStretch: 25, period: 90, confirmed: true, connectedActionIds: [], parentProductKrId: parentRevenue }
          ],
          createdAt: iso(30 - cIdx)
        },
        {
          id: uid('obj'),
          label: 'Sucesso do Cliente',
          area: 'cs',
          owner: 'Beatriz',
          deadline: '2026-09-30',
          okrs: [
            { id: uid('okr'), name: 'NPS por campanha', metric: 'percentual', catalogId: 'cs_nps', isHandoff: false, current: 58, targetCommitted: 70, targetStretch: 80, period: 90, confirmed: true, connectedActionIds: [], parentProductKrId: parentNps },
            { id: uid('okr'), name: 'Recompra 30d', metric: 'percentual', catalogId: 'cs_retention', isHandoff: true, current: 18, targetCommitted: 28, targetStretch: 38, period: 90, confirmed: true, connectedActionIds: [], parentProductKrId: parentNps }
          ],
          createdAt: iso(30 - cIdx)
        }
      ],
      createdAt: iso(30 - cIdx),
      updatedAt: iso(5)
    };
  });
  return branches;
}
const CAMPAIGN_BRANCHES = buildCampaignBranches();

// --- RevOps Finance por produto ---
function buildRevopsFinance() {
  const finance = {};
  PRODUCTS.forEach((product, idx) => {
    finance[product.id] = {
      productId: product.id,
      period: 90,
      periodLabel: 'Q3 2026',
      offers: [
        { id: uid('off'), name: product.name, priceValue: product.priceValue, costValue: product.operationalCostValue, mixPercent: 100 }
      ],
      fixedCosts: {
        software: 2400,
        rh: 18000,
        estrutura: 6500,
        outros: 1200
      },
      variableCosts: {
        insumos: product.operationalCostValue,
        frete: 4,
        comissao: 3
      },
      salesProjection: {
        ticketMedio: product.priceValue,
        cacTarget: 28 + idx * 4,
        ebitdaTarget: 22,
        breakevenUnits: Math.round(28100 / Math.max(1, product.unitProfit))
      },
      meta: {
        revenueTarget: 180000 + idx * 40000,
        unitsTarget: 4500 + idx * 800
      },
      updatedAt: iso(7)
    };
  });
  return finance;
}
const REVOPS_FINANCE = buildRevopsFinance();

// --- Custom Action Catalog (ações customizadas aprendidas) ---
const CUSTOM_ACTION_CATALOG = [
  { id: uid('cac'), name: 'Degustação em bar parceiro', sector: 'marketing', funnel: 'TOF', channel: 'Evento presencial', actionType: 'Degustação', usageCount: 8, createdAt: iso(20) },
  { id: uid('cac'), name: 'Kit influenciador cervejeiro', sector: 'marketing', funnel: 'TOF', channel: 'PR/Imprensa', actionType: 'Envio de mostra', usageCount: 5, createdAt: iso(18) },
  { id: uid('cac'), name: 'Tour cervejaria', sector: 'cs', funnel: 'BOF', channel: 'Evento presencial', actionType: 'Tour guiado', usageCount: 12, createdAt: iso(15) },
  { id: uid('cac'), name: 'Combo lançamento bar', sector: 'sales', funnel: 'BOF', channel: 'Outbound', actionType: 'Proposta comercial', usageCount: 6, createdAt: iso(10) }
];

// --- Scores ---
const SCORES = [
  {
    id: 1,
    name: 'Score Padrão Cervejaria',
    description: 'Pontua leads por engajamento e perfil B2C/B2B.',
    tagRules: [
      { tag: '#tof', score: 10 },
      { tag: '#mof', score: 25 },
      { tag: '#bof', score: 45 },
      { tag: '#cliente_recorrente', score: 30 }
    ],
    createdAt: iso(40)
  }
];

// --- ICP / Score signals ---
const CUSTOM_SCORE_SIGNALS = {
  B2B: [
    { id: uid('sig'), name: 'Bar com cardápio premium', weight: 25 },
    { id: uid('sig'), name: 'Localização capital', weight: 15 }
  ],
  B2C: [
    { id: uid('sig'), name: 'Já comprou cerveja artesanal', weight: 20 },
    { id: uid('sig'), name: 'Engajou com posts educativos', weight: 12 }
  ],
  negative: [
    { id: uid('sig'), name: 'Idade < 18 (bloqueio legal)', weight: -100 }
  ],
  triggers: [
    { id: uid('trg'), name: 'Visitou tour da cervejaria', weight: 30 }
  ]
};

// --- Función principal exportada ---
function buildEngenhoNorteState() {
  return {
    activeTab: 'home',

    // Dados core
    products: PRODUCTS,
    campaigns: CAMPAIGNS,
    actions: ACTIONS,
    scores: SCORES,
    manualLeads: ALL_LEADS,

    // Mapa Estratégico V29
    strategicMaps: STRATEGIC_MAPS,
    strategicCampaignMaps: CAMPAIGN_BRANCHES,

    // RevOps Finance
    revopsFinance: REVOPS_FINANCE,

    // Score signals
    customScoreSignals: CUSTOM_SCORE_SIGNALS,
    revenueScoreBlueprints: {},
    leadScoreHistory: {},
    leadOutcomes: {},

    // Custom catalog
    customActionCatalog: CUSTOM_ACTION_CATALOG,

    // Integrações (vazias — demo não conecta)
    integrations: { rd: {}, rdCrm: { pipelinesByCampaign: {}, dealsByLead: {} } },
    rdCrmLeadTags: {},

    // OKRs / KPIs auxiliares
    strategicOkrs: [],
    operationalKpis: [],
    cxProjects: [],

    // Configurações (vazias — só leitura)
    databaseConfig: {},
    executionConfig: {},
    agentConfig: {},
    djowConfig: {},
    djowConversation: { id: null, messages: [] },

    // Drafts vazios
    productDraft: {}, campaignDraft: {}, actionDraft: {}, okrDraft: {}, kpiDraft: {}, leadDraft: {}, scoreDraft: {},

    // Seleções iniciais
    selectedProductId: PRODUCTS[0].id,
    selectedCampaignId: CAMPAIGNS[0].id,
    selectedActionId: null,
    selectedScoreId: 1,
    selectedLeadId: null,
    selectedOkrId: null,

    // Metadata
    schemaVersion: '31.0.0',
    dataCreatedAt: SEED_BASE_DATE,
    lastMigrationAt: NOW,
    lastSavedAt: NOW,
    __demoSeed: 'engenho-norte-v1'
  };
}

module.exports = { buildEngenhoNorteState };
