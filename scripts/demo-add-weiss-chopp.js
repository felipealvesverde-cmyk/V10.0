// V40.7.5 — Addon do demo Engenho Norte: 2 produtos novos (Cerveja Weiss +
// Chopp de Vinho), 6 campanhas (3 por produto), 32 ações (16 por produto)
// e ~64 execuções (2 por ação) com origem/destino travados na lógica de
// jornada (TOF→MOF→BOF dentro do setor; handoffs MKT→VND, VND→CS, CS→VND).
//
// Função `buildWeissChoppAddon()` retorna um objeto plain:
//   { products, campaigns, actions, executionTasks }
//
// Aplicação: `api/admin-add-demo-products.js` faz MERGE no journey_state
// do demo@leadjourney.app sem mexer no que já existe (Cerveja Pilsen e
// todo o resto). Idempotente — checar produto id 5001 antes de aplicar.

const NOW = '2026-06-19T00:00:00Z';

function iso(daysAgo = 0) {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}

function uid(prefix) { return `${prefix}_${Math.random().toString(36).slice(2, 9)}`; }

// === PRODUTOS ===
const PRODUCTS = [
  {
    id: 5001,
    name: 'Cerveja Weiss',
    type: 'Cerveja artesanal',
    price: 'R$ 28',
    priceValue: 28,
    revenueModel: 'Venda única',
    operationalCost: 'R$ 9',
    operationalCostValue: 9,
    status: 'Ativo',
    unitProfit: 19,
    marginPercent: 68,
    grossMargin: '68%',
    mrr: 'R$ 0',
    arr: 'R$ 28',
    revenueScore: 73,
    healthScore: 78,
    okrs: [],
    createdAt: iso(60)
  },
  {
    id: 5002,
    name: 'Chopp de Vinho',
    type: 'Bebida gastronômica premium',
    price: 'R$ 72',
    priceValue: 72,
    revenueModel: 'Venda única',
    operationalCost: 'R$ 28',
    operationalCostValue: 28,
    status: 'Ativo',
    unitProfit: 44,
    marginPercent: 61,
    grossMargin: '61%',
    mrr: 'R$ 0',
    arr: 'R$ 72',
    revenueScore: 64,
    healthScore: 70,
    okrs: [],
    createdAt: iso(35)
  }
];

// === CAMPANHAS ===
const CAMPAIGNS = [
  // Weiss
  {
    id: 5101, productId: 5001, name: 'Cerveja Weiss — Weiss pro Verão 2026',
    objective: 'Capturar 2.000 leads quentes na onda do verão com o conceito "a cerveja que abraça o sol".',
    owner: 'Marina Costa', sector: 'Marketing', status: 'Ativa', mediaInvestment: 14000, okrs: [], createdAt: iso(55)
  },
  {
    id: 5102, productId: 5001, name: 'Cerveja Weiss — Festival Cervejeiro SP',
    objective: 'Ativar 30 bares parceiros e fechar 12 propostas pré-festival até outubro.',
    owner: 'Rafael Almeida', sector: 'Vendas', status: 'Ativa', mediaInvestment: 6000, okrs: [], createdAt: iso(48)
  },
  {
    id: 5103, productId: 5001, name: 'Cerveja Weiss — Fan Club Engenho Norte',
    objective: 'Comunidade de 500 cervejeiros fiéis com recompra 45%+ em 90d e advocacy ativo.',
    owner: 'Beatriz Ribeiro', sector: 'CS', status: 'Ativa', mediaInvestment: 2500, okrs: [], createdAt: iso(42)
  },
  // Chopp de Vinho
  {
    id: 5104, productId: 5002, name: 'Chopp de Vinho — Lançamento Reserva Vinífera',
    objective: 'Educar mercado gastronômico premium sobre o conceito e gerar 200 leads qualificados.',
    owner: 'Marina Costa', sector: 'Marketing', status: 'Ativa', mediaInvestment: 18000, okrs: [], createdAt: iso(32)
  },
  {
    id: 5105, productId: 5002, name: 'Chopp de Vinho — Top 50 Restaurantes',
    objective: 'Colocar o produto em 25 das 50 casas mais sofisticadas de SP/RJ até dezembro.',
    owner: 'Rafael Almeida', sector: 'Vendas', status: 'Ativa', mediaInvestment: 9000, okrs: [], createdAt: iso(28)
  },
  {
    id: 5106, productId: 5002, name: 'Chopp de Vinho — Embaixadores',
    objective: 'Formar 20 embaixadores ativos (sommeliers + chefs) com casos publicáveis.',
    owner: 'Beatriz Ribeiro', sector: 'CS', status: 'Ativa', mediaInvestment: 3500, okrs: [], createdAt: iso(22)
  }
];

// === AÇÕES ===
// Cada ação: { name, channel, actionType, sector, funnel, originSector, originFunnel,
// destinationSector, destinationFunnel, status, objective, expectedConversion }
//
// Padrão de status: alguns 'Conectada' (em campo), maioria 'Pronta para conectar'.
const ACTION_TEMPLATES = [
  // ---------- WEISS · Camp 5101 (Marketing — Verão 2026) ----------
  { campaignId: 5101, name: 'Reels "Como nasce uma Weiss"', channel: 'Instagram Orgânico', actionType: 'Post', sector: 'marketing', funnel: 'TOF', destSector: 'marketing', destFunnel: 'MOF', status: 'Conectada', goal: 'Mostrar processo artesanal pra capturar curiosos', conv: 22 },
  { campaignId: 5101, name: 'Meta Ads "Refresque-se com Weiss"', channel: 'Meta Ads', actionType: 'Anúncio pago', sector: 'marketing', funnel: 'TOF', destSector: 'marketing', destFunnel: 'MOF', status: 'Conectada', goal: 'Atrair compradores em metrópoles SP/RJ', conv: 18 },
  { campaignId: 5101, name: 'Blog SEO "Weiss vs Pilsen: qual escolher?"', channel: 'Blog SEO', actionType: 'Post', sector: 'marketing', funnel: 'TOF', destSector: 'marketing', destFunnel: 'MOF', status: 'Pronta para conectar', goal: 'Capturar busca orgânica de quem está pesquisando estilos', conv: 14 },
  { campaignId: 5101, name: 'Parceria com chef cervejeiro', channel: 'Influenciador', actionType: 'Live', sector: 'marketing', funnel: 'TOF', destSector: 'marketing', destFunnel: 'MOF', status: 'Pronta para conectar', goal: 'Validação social + alcance qualificado', conv: 20 },
  { campaignId: 5101, name: 'Email "Conheça a Weiss" pra base', channel: 'RD Email', actionType: 'Sequência email', sector: 'marketing', funnel: 'MOF', destSector: 'marketing', destFunnel: 'BOF', status: 'Conectada', goal: 'Nutrir leads frios da base com história do produto', conv: 28 },
  { campaignId: 5101, name: 'Live degustação no IG', channel: 'Instagram Orgânico', actionType: 'Live', sector: 'marketing', funnel: 'MOF', destSector: 'marketing', destFunnel: 'BOF', status: 'Pronta para conectar', goal: 'Engajar quem já tem interesse com prova de produto', conv: 32 },
  { campaignId: 5101, name: 'LP de pré-venda do verão', channel: 'Landing page', actionType: 'Landing page', sector: 'marketing', funnel: 'BOF', destSector: 'sales', destFunnel: 'BOF', status: 'Pronta para conectar', goal: 'Converter leads quentes em primeira compra antes do verão', conv: 12 },
  // ---------- WEISS · Camp 5102 (Vendas — Festival Cervejeiro SP) ----------
  { campaignId: 5102, name: 'Cold email pra novos bares SP', channel: 'Cold Email', actionType: 'Outbound 1-1', sector: 'sales', funnel: 'TOF', destSector: 'sales', destFunnel: 'MOF', status: 'Conectada', goal: 'Abrir conversa com bares que nunca compraram', conv: 8 },
  { campaignId: 5102, name: 'WhatsApp pra bares 2025 que sumiram', channel: 'WhatsApp', actionType: 'Follow-up', sector: 'sales', funnel: 'MOF', destSector: 'sales', destFunnel: 'BOF', status: 'Conectada', goal: 'Recuperar clientes que pararam de pedir', conv: 35 },
  { campaignId: 5102, name: 'Follow-up de propostas em aberto', channel: 'Telefone', actionType: 'Follow-up', sector: 'sales', funnel: 'MOF', destSector: 'sales', destFunnel: 'BOF', status: 'Pronta para conectar', goal: 'Fechar propostas estagnadas há 7+ dias', conv: 40 },
  { campaignId: 5102, name: 'Visita com kit degustação', channel: 'Reunião Presencial', actionType: 'Demo agendada', sector: 'sales', funnel: 'BOF', destSector: 'cs', destFunnel: 'BOF', status: 'Pronta para conectar', goal: 'Demonstração in-loco pra fechar contrato anual', conv: 45 },
  { campaignId: 5102, name: 'Proposta diferenciada Festival', channel: 'Reunião Presencial', actionType: 'Proposta', sector: 'sales', funnel: 'BOF', destSector: 'cs', destFunnel: 'BOF', status: 'Pronta para conectar', goal: 'Fechar 12 contratos antes da abertura do Festival', conv: 38 },
  // ---------- WEISS · Camp 5103 (CS — Fan Club) ----------
  { campaignId: 5103, name: 'Onboarding novos bares parceiros', channel: 'Email transacional', actionType: 'Onboarding', sector: 'cs', funnel: 'BOF', destSector: 'cs', destFunnel: 'MOF', status: 'Conectada', goal: 'Reduzir churn dos primeiros 30 dias', conv: 92 },
  { campaignId: 5103, name: 'Programa Fidelidade Fan Club', channel: 'WhatsApp pós-venda', actionType: 'Upsell', sector: 'cs', funnel: 'MOF', destSector: 'cs', destFunnel: 'MOF', status: 'Pronta para conectar', goal: 'Aumentar recompra através de pontos + brindes exclusivos', conv: 55 },
  { campaignId: 5103, name: 'NPS pós-Festival', channel: 'NPS Survey', actionType: 'Check-in', sector: 'cs', funnel: 'BOF', destSector: 'cs', destFunnel: 'MOF', status: 'Pronta para conectar', goal: 'Medir satisfação pós-evento e capturar promotores', conv: 65 },
  { campaignId: 5103, name: 'Reativação de bares inativos 90+d', channel: 'WhatsApp pós-venda', actionType: 'Reativação', sector: 'cs', funnel: 'MOF', destSector: 'sales', destFunnel: 'MOF', status: 'Pronta para conectar', goal: 'Despertar clientes que pararam de pedir', conv: 22 },

  // ---------- CHOPP DE VINHO · Camp 5104 (Marketing — Lançamento) ----------
  { campaignId: 5104, name: 'Live YouTube "O nascimento do Chopp de Vinho"', channel: 'YouTube', actionType: 'Live', sector: 'marketing', funnel: 'TOF', destSector: 'marketing', destFunnel: 'MOF', status: 'Conectada', goal: 'Plantar conceito + responder ceticismo do mercado', conv: 16 },
  { campaignId: 5104, name: 'Reels com sommelier convidada', channel: 'Instagram Orgânico', actionType: 'Post', sector: 'marketing', funnel: 'TOF', destSector: 'marketing', destFunnel: 'MOF', status: 'Conectada', goal: 'Credibilidade técnica + ampliar alcance pra público gastronômico', conv: 19 },
  { campaignId: 5104, name: 'Press release pra mídia gastronômica', channel: 'Blog SEO', actionType: 'Post', sector: 'marketing', funnel: 'TOF', destSector: 'marketing', destFunnel: 'MOF', status: 'Pronta para conectar', goal: 'Cobertura em Veja Comer&Beber, Folha, Gula', conv: 25 },
  { campaignId: 5104, name: 'LP premium com história + harmonização', channel: 'Landing page', actionType: 'Landing page', sector: 'marketing', funnel: 'MOF', destSector: 'marketing', destFunnel: 'BOF', status: 'Conectada', goal: 'Educar e qualificar leads pra abordagem comercial', conv: 30 },
  { campaignId: 5104, name: 'Sequência email educativa em 5 etapas', channel: 'RD Email', actionType: 'Sequência email', sector: 'marketing', funnel: 'MOF', destSector: 'marketing', destFunnel: 'BOF', status: 'Pronta para conectar', goal: 'Maturar leads frios em 14 dias com conteúdo profundo', conv: 24 },
  { campaignId: 5104, name: 'Webinar "Como apresentar Chopp de Vinho ao cliente"', channel: 'Webinar', actionType: 'Webinar', sector: 'marketing', funnel: 'MOF', destSector: 'sales', destFunnel: 'BOF', status: 'Pronta para conectar', goal: 'Treinar maître/sommelier de casas interessadas em adotar', conv: 28 },
  // ---------- CHOPP DE VINHO · Camp 5105 (Vendas — Top 50) ----------
  { campaignId: 5105, name: 'Mapeamento Top 50 restaurantes SP/RJ', channel: 'LinkedIn Outbound', actionType: 'Outbound 1-1', sector: 'sales', funnel: 'TOF', destSector: 'sales', destFunnel: 'MOF', status: 'Conectada', goal: 'Identificar gestores + sommeliers das casas-alvo', conv: 60 },
  { campaignId: 5105, name: 'Outbound LinkedIn pra sommeliers/gerentes', channel: 'LinkedIn Outbound', actionType: 'Outbound 1-1', sector: 'sales', funnel: 'MOF', destSector: 'sales', destFunnel: 'BOF', status: 'Conectada', goal: 'Marcar 1ª conversa exploratória', conv: 14 },
  { campaignId: 5105, name: 'Cold email pra hotéis 5 estrelas', channel: 'Cold Email', actionType: 'Outbound 1-1', sector: 'sales', funnel: 'TOF', destSector: 'sales', destFunnel: 'MOF', status: 'Pronta para conectar', goal: 'Abrir conta em redes premium (Fasano, Tivoli, Fairmont)', conv: 7 },
  { campaignId: 5105, name: 'Demo presencial com cozinha-laboratório', channel: 'Reunião Presencial', actionType: 'Demo agendada', sector: 'sales', funnel: 'BOF', destSector: 'cs', destFunnel: 'BOF', status: 'Pronta para conectar', goal: 'Experiência sensorial que vende sozinha', conv: 50 },
  { campaignId: 5105, name: 'Reunião em rodada de degustação', channel: 'Reunião Presencial', actionType: 'Demo agendada', sector: 'sales', funnel: 'MOF', destSector: 'sales', destFunnel: 'BOF', status: 'Pronta para conectar', goal: 'Apresentar produto a 8 casas no mesmo evento', conv: 35 },
  { campaignId: 5105, name: 'Proposta com kit de instalação', channel: 'Cold Email', actionType: 'Proposta', sector: 'sales', funnel: 'BOF', destSector: 'cs', destFunnel: 'BOF', status: 'Pronta para conectar', goal: 'Reduzir fricção do "como começar" na casa', conv: 42 },
  // ---------- CHOPP DE VINHO · Camp 5106 (CS — Embaixadores) ----------
  { campaignId: 5106, name: 'Treinamento da equipe do restaurante', channel: 'WhatsApp pós-venda', actionType: 'Onboarding', sector: 'cs', funnel: 'BOF', destSector: 'cs', destFunnel: 'MOF', status: 'Conectada', goal: 'Garantir que garçom/maître consegue narrar o produto', conv: 88 },
  { campaignId: 5106, name: 'Check-in mensal nos primeiros 3 meses', channel: 'WhatsApp pós-venda', actionType: 'Check-in', sector: 'cs', funnel: 'MOF', destSector: 'cs', destFunnel: 'MOF', status: 'Pronta para conectar', goal: 'Acompanhar adoção + resolver atrito cedo', conv: 75 },
  { campaignId: 5106, name: 'Upsell de linhas complementares', channel: 'Email transacional', actionType: 'Upsell', sector: 'cs', funnel: 'MOF', destSector: 'sales', destFunnel: 'BOF', status: 'Pronta para conectar', goal: 'Vender Cerveja Weiss e Pilsen pras casas do Chopp de Vinho', conv: 30 },
  { campaignId: 5106, name: 'Programa Embaixador (cases + comunidade)', channel: 'NPS Survey', actionType: 'Check-in', sector: 'cs', funnel: 'MOF', destSector: 'cs', destFunnel: 'MOF', status: 'Pronta para conectar', goal: 'Formar embaixadores com case publicado + acesso a eventos exclusivos', conv: 18 }
];

// Constrói as ações finais com IDs + metadados padronizados.
function buildActions() {
  const ownerByCampaign = {
    5101: 'Marina Costa', 5102: 'Rafael Almeida', 5103: 'Beatriz Ribeiro',
    5104: 'Marina Costa', 5105: 'Rafael Almeida', 5106: 'Beatriz Ribeiro'
  };
  return ACTION_TEMPLATES.map((tpl, idx) => {
    const id = 5200 + idx;
    const isConn = tpl.status === 'Conectada';
    return {
      id,
      campaignId: tpl.campaignId,
      name: tpl.name,
      channel: tpl.channel,
      actionType: tpl.actionType,
      sector: tpl.sector,
      funnel: tpl.funnel,
      originSector: tpl.sector,
      originFunnel: tpl.funnel,
      destinationSector: tpl.destSector,
      destinationFunnel: tpl.destFunnel,
      objective: tpl.goal,
      conversionObjective: tpl.funnel === 'TOF' ? 'Lead capturado' : tpl.funnel === 'MOF' ? 'Lead qualificado' : 'Compra realizada',
      expectedConversion: tpl.conv,
      status: tpl.status,
      flowPath: [],
      flowConfig: null,
      okrs: [],
      kpis: [],
      rdEmailConfig: {},
      scoreId: 1,
      connected: isConn,
      connectionStatus: isConn ? 'connected' : 'ready',
      mailingDefined: false,
      leads: [],
      strategicAreaId: tpl.sector,
      strategicCatalogId: null,
      strategicDescription: tpl.goal,
      strategicOwner: ownerByCampaign[tpl.campaignId],
      strategicCadence: null,
      strategicStatus: isConn ? 'active' : 'planned',
      strategicConfirmed: isConn,
      createdAt: iso(40 - Math.floor(idx / 4))
    };
  });
}
const ACTIONS = buildActions();

// === EXECUÇÕES (2 por ação) ===
// Padrão por ação: 1 execução passada (completed ou in_progress) + 1 futura (pending).
// `due_date` negativo no helper iso() = futuro (iso(-5) = daqui 5 dias).
function buildExecutionTasks() {
  const tasks = [];
  let seq = 0;
  ACTIONS.forEach((action, aIdx) => {
    const owner = action.strategicOwner;
    // Execução 1: passada (completed se ação já está Conectada, in_progress senão)
    const status1 = action.status === 'Conectada' ? 'completed' : 'in_progress';
    const exec1Title = buildExecTitle1(action);
    tasks.push({
      task_id: `task_5300_${seq++}_${aIdx}`,
      provider: 'manual',
      provider_task_id: null,
      linked_action_id: action.id,
      linked_campaign_id: action.campaignId,
      linked_flow_id: null,
      title: exec1Title,
      description: `Execução inicial da ação "${action.name}". Foco: ${action.objective}.`,
      assignee: owner,
      due_date: iso(7 + (aIdx % 4)),
      priority: 'normal',
      status: status1,
      external_url: null,
      source_agent: 'demo-weiss-chopp',
      execution_context: null,
      created_at: iso(20 + (aIdx % 5)),
      started_at: iso(15 + (aIdx % 5)),
      completed_at: status1 === 'completed' ? iso(8 + (aIdx % 3)) : null,
      last_synced_at: iso(1)
    });
    // Execução 2: futura (pending)
    const exec2Title = buildExecTitle2(action);
    tasks.push({
      task_id: `task_5300_${seq++}_${aIdx}`,
      provider: 'manual',
      provider_task_id: null,
      linked_action_id: action.id,
      linked_campaign_id: action.campaignId,
      linked_flow_id: null,
      title: exec2Title,
      description: `Próximo ciclo da ação "${action.name}".`,
      assignee: owner,
      due_date: iso(-7 - (aIdx % 8)),
      priority: aIdx % 5 === 0 ? 'high' : 'normal',
      status: 'pending',
      external_url: null,
      source_agent: 'demo-weiss-chopp',
      execution_context: null,
      created_at: iso(3),
      started_at: null,
      completed_at: null,
      last_synced_at: iso(1)
    });
  });
  return tasks;
}

// Títulos contextuais pras execuções, baseados no tipo de ação.
function buildExecTitle1(action) {
  const t = action.actionType.toLowerCase();
  if (t.includes('post') || t.includes('reels')) return `Gravação + edição "${action.name.slice(0, 40)}"`;
  if (t.includes('anúncio')) return `Setup de criativos + conjuntos — ${action.name.slice(0, 40)}`;
  if (t.includes('sequência email') || t.includes('email')) return `Roteirização + envio piloto — ${action.name.slice(0, 40)}`;
  if (t.includes('webinar') || t.includes('live')) return `Roteiro + ensaio técnico — ${action.name.slice(0, 40)}`;
  if (t.includes('landing')) return `Build + tracking ativo — ${action.name.slice(0, 40)}`;
  if (t.includes('outbound') || t.includes('cold')) return `Lista de contatos + 1º disparo — ${action.name.slice(0, 40)}`;
  if (t.includes('demo') || t.includes('proposta')) return `1ª rodada de demos / propostas — ${action.name.slice(0, 40)}`;
  if (t.includes('follow')) return `Follow-up batch — ${action.name.slice(0, 40)}`;
  if (t.includes('onboarding') || t.includes('check-in')) return `Setup do fluxo — ${action.name.slice(0, 40)}`;
  if (t.includes('upsell') || t.includes('reativação')) return `1ª onda de contato — ${action.name.slice(0, 40)}`;
  return `Execução inicial — ${action.name.slice(0, 40)}`;
}

function buildExecTitle2(action) {
  const t = action.actionType.toLowerCase();
  if (t.includes('post') || t.includes('reels')) return `Análise de engajamento + planejamento próx. peça — ${action.name.slice(0, 30)}`;
  if (t.includes('anúncio')) return `Análise CPL + otimização semanal — ${action.name.slice(0, 30)}`;
  if (t.includes('sequência email') || t.includes('email')) return `2º envio + análise open/click — ${action.name.slice(0, 30)}`;
  if (t.includes('webinar') || t.includes('live')) return `2ª edição com ajustes do feedback — ${action.name.slice(0, 30)}`;
  if (t.includes('landing')) return `A/B test de headline + CTA — ${action.name.slice(0, 30)}`;
  if (t.includes('outbound') || t.includes('cold')) return `2ª rodada (assunto novo) — ${action.name.slice(0, 30)}`;
  if (t.includes('demo') || t.includes('proposta')) return `Demos da semana seguinte — ${action.name.slice(0, 30)}`;
  if (t.includes('follow')) return `Follow-up dos não-respondidos — ${action.name.slice(0, 30)}`;
  if (t.includes('onboarding') || t.includes('check-in')) return `Revisão de churn 30d + ajustes — ${action.name.slice(0, 30)}`;
  if (t.includes('upsell') || t.includes('reativação')) return `2ª onda com oferta diferenciada — ${action.name.slice(0, 30)}`;
  return `Próximo ciclo — ${action.name.slice(0, 30)}`;
}

const EXECUTION_TASKS = buildExecutionTasks();

function buildWeissChoppAddon() {
  return {
    products: PRODUCTS,
    campaigns: CAMPAIGNS,
    actions: ACTIONS,
    executionTasks: EXECUTION_TASKS,
    meta: {
      addonVersion: 'weiss-chopp-v1',
      generatedAt: NOW,
      counts: {
        products: PRODUCTS.length,
        campaigns: CAMPAIGNS.length,
        actions: ACTIONS.length,
        executionTasks: EXECUTION_TASKS.length
      }
    }
  };
}

const ADDON_VERSION = 'weiss-chopp-v1';

module.exports = { buildWeissChoppAddon, ADDON_VERSION };
