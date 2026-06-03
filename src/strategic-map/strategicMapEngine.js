// V29.0.0 — Strategic Map Engine
// REFATOR GRANDE: cada CAMPANHA tem seu próprio sub-mapa (branch).
// 1 produto = 1 visão + N KRs-mãe (productKrs) + N branches (campanhas plugadas).
// Cada branch = 3 frentes (Mkt/Vendas/CS) + childKrs (filhos das mães via rollup).
//
// Schema:
//   App.state.strategicMaps[productId] = {
//     productId, vision, productKrs[], strategicCampaignId, flowConnections,
//     objectives[]  // LEGACY V28: mantido só pra compat até a migração lazy mover pra branch
//   }
//   App.state.strategicCampaignMaps[campaignId] = {
//     campaignId, productId, objective, objectives[], createdAt
//   }
//
// Migração lazy: quando uma função tenta ler/escrever objectives e há legacy
// no strategicMaps[productId].objectives mas branch ainda não existe, copia pra
// branch (strategicCampaignMaps[strategicCampaignId]) e limpa o legacy.
window.StrategicMapEngine = {
  defaultMap(productId) {
    return {
      productId: Number(productId),
      vision: '',
      productKrs: [],         // V29.0.0 — KRs-mãe (do CEO, sofrem rollup das filhas)
      strategicCampaignId: null,
      flowConnections: [],
      objectives: [],         // LEGACY V28 — fica vazio em produtos novos; migrado pra branch
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  },

  defaultBranchMap(campaignId, productId) {
    return {
      campaignId: Number(campaignId),
      productId: Number(productId),
      objective: '',          // objetivo curto desta campanha (gestor preenche)
      objectives: [],         // as 3 áreas (Mkt/Vendas/CS) com KRs-filhos
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  },

  getForProduct(productId) {
    if (!productId) return null;
    const maps = App.state.strategicMaps || {};
    return maps[productId] || this.defaultMap(productId);
  },

  ensure(productId) {
    const existing = (App.state.strategicMaps || {})[productId];
    if (existing) return existing;
    const fresh = this.defaultMap(productId);
    App.state.strategicMaps = { ...(App.state.strategicMaps || {}), [productId]: fresh };
    return fresh;
  },

  save(productId, patch) {
    const current = this.ensure(productId);
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    App.state.strategicMaps = { ...(App.state.strategicMaps || {}), [productId]: next };
    return next;
  },

  setVision(productId, vision) {
    return this.save(productId, { vision: String(vision || '') });
  },

  snapshot(productId) {
    const map = this.getForProduct(productId);
    const objectives = (map.objectives || []);
    const okrs = objectives.flatMap(o => o.okrs || []);
    return {
      productId: Number(productId),
      vision: map.vision || '',
      objectivesCount: objectives.length,
      okrsCount: okrs.length,
      connectedFlows: (map.flowConnections || []).length,
      avgProgress: okrs.length ? Math.round(okrs.reduce((sum, kr) => sum + this._progress(kr), 0) / okrs.length) : 0
    };
  },

  _progress(okr) {
    const target = Number(okr.target || 0);
    if (!target) return 0;
    const current = Number(okr.current || 0);
    return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
  },

  journeyProgress(productId) {
    const map = this.getForProduct(productId);
    const objectives = map.objectives || [];
    const okrs = objectives.flatMap(o => o.okrs || []);
    const connectedOkrs = okrs.filter(o => (o.connectedActionIds || []).length > 0);
    const connectedActionIds = new Set(connectedOkrs.flatMap(o => (o.connectedActionIds || []).map(Number)));
    const tasks = window.ExecutionTaskStore?.all() || [];
    const hasExecutionTask = tasks.some(t => connectedActionIds.has(Number(t.linked_action_id)));
    return {
      vision: Boolean(String(map.vision || '').trim()),
      objectives: objectives.length > 0,
      okrs: okrs.length > 0,
      operations: connectedOkrs.length > 0,
      execution: hasExecutionTask
    };
  },

  // V29.0.3 — Progress da BRANCH (vista campanha). Visão vem do produto (compartilhada).
  // V29.1.0 — Adiciona 'campaign' (etapa 4): pelo menos 1 KR-filho plugado à KR-mãe.
  journeyProgressForBranch(productId, campaignId) {
    const branch = this.getBranchMap(campaignId);
    const objectives = (branch?.objectives) || [];
    const okrs = objectives.flatMap(o => o.okrs || []);
    const pluggedKrs = okrs.filter(kr => kr.parentProductKrId);
    const connectedOkrs = okrs.filter(o => (o.connectedActionIds || []).length > 0);
    const connectedActionIds = new Set(connectedOkrs.flatMap(o => (o.connectedActionIds || []).map(Number)));
    const tasks = window.ExecutionTaskStore?.all() || [];
    const hasExecutionTask = tasks.some(t => connectedActionIds.has(Number(t.linked_action_id)));
    const productVision = String(this.getForProduct(productId)?.vision || '').trim();
    const productKrs = this.getProductKrs(productId);
    const areaOwners = this.getForProduct(productId)?.areaOwners || {};
    const hasAnyOwner = Object.values(areaOwners).some(o => String(o || '').trim());
    return {
      vision: Boolean(productVision),
      objectives: hasAnyOwner,                  // donos definidos pelo CEO
      okrs: productKrs.length > 0,              // KRs-mãe definidos pelo CEO
      // V32.5.5 — Após rename V32.5.0 G4 (etapa 4 virou "Selecionar Campanha"),
      // o critério "concluído" passa a ser SELEÇÃO da campanha (campaignId
      // existe), não plug de KR. Plug mora na etapa 5 (operations).
      campaign: Boolean(campaignId),
      operations: connectedOkrs.length > 0,
      execution: hasExecutionTask
    };
  },

  // V29.1.0 — Progress da vista CEO (escopo produto, sem branch).
  // V31.2.14 — Distinção CEO/Gestor abandonada (V31.2.6). Agora as 6 etapas
  // refletem progresso REAL do produto inteiro (não mais campaign/operations/
  // execution hardcoded false). Campanha = pelo menos 1 branch existir;
  // Operations = pelo menos 1 OKR com ação conectada (em qualquer branch);
  // Execution = pelo menos 1 task vinculada a alguma dessas ações.
  journeyProgressForProduct(productId) {
    const map = this.getForProduct(productId);
    const productKrs = this.getProductKrs(productId);
    const areaOwners = map?.areaOwners || {};
    const hasAnyOwner = Object.values(areaOwners).some(o => String(o || '').trim());

    // Pelo menos 1 campanha do produto JÁ é "campaign concluída"
    const productCampaignIds = new Set(
      (App.state.campaigns || [])
        .filter(c => Number(c.productId) === Number(productId))
        .map(c => Number(c.id))
    );
    const hasCampaign = productCampaignIds.size > 0;

    // Operations: pelo menos 1 OKR (em qualquer branch deste produto) com ações conectadas
    const branches = this.getBranchesByProduct(productId);
    const allBranchOkrs = branches.flatMap(b => (b.objectives || []).flatMap(o => o.okrs || []));
    const connectedOkrs = allBranchOkrs.filter(k => (k.connectedActionIds || []).length > 0);
    const hasOperations = connectedOkrs.length > 0;

    // Execution: pelo menos 1 task vinculada a alguma ação conectada
    const connectedActionIds = new Set(connectedOkrs.flatMap(o => (o.connectedActionIds || []).map(Number)));
    const tasks = window.ExecutionTaskStore?.all() || [];
    const hasExecutionTask = tasks.some(t => connectedActionIds.has(Number(t.linked_action_id)));

    return {
      vision: Boolean(String(map?.vision || '').trim()),
      objectives: hasAnyOwner,
      okrs: productKrs.length > 0,
      campaign: hasCampaign,
      operations: hasOperations,
      execution: hasExecutionTask
    };
  },

  currentStepId(productId) {
    const progress = this.journeyProgress(productId);
    const order = ['vision', 'objectives', 'okrs', 'operations', 'execution'];
    for (const step of order) if (!progress[step]) return step;
    return 'execution';
  },

  // V28.1 — As 3 frentes do funil (RevOps minimalista).
  // V32.5.0 (Leonardo L1 + Geraldo G1) — Cores alinhadas à paleta semântica
  // oficial V32.3.2 (Norte-Sul). Antes Marketing/Vendas/CS usavam sky/emerald/
  // violet — colidindo com CS (sky) e RevOps (violet) no resto do sistema.
  // Agora: Marketing=pink (rosa-magenta #F472B6), Sales=teal (turquesa #00CBCC),
  // CS=sky (azul-céu #6BBEF9). Naming padronizado pra 'CS' (sigla principal +
  // descrição). label antigo "Sucesso do Cliente" continua acessível via fullLabel.
  COMERCIAL_AREAS: [
    { id: 'marketing', label: 'Marketing', fullLabel: 'Marketing', icon: 'megaphone', color: 'pink',  description: 'Em definição minimalista, Marketing tem o objetivo de transformar um público suspeito em um potencial comprador (lead).', handoff: 'Entrega leads pra Vendas' },
    { id: 'sales',     label: 'Vendas',    fullLabel: 'Vendas',    icon: 'handshake', color: 'teal',  description: 'Em definição minimalista, Vendas tem o objetivo de transformar um potencial comprador (lead) em um cliente.', handoff: 'Entrega clientes pra CS' },
    { id: 'cs',        label: 'CS',        fullLabel: 'CS · Sucesso do Cliente', icon: 'heart', color: 'sky', description: 'Em definição minimalista, CS (Sucesso do Cliente) tem o objetivo de transformar um cliente em um advogado da marca.', handoff: 'Devolve advogados pro topo do funil' }
  ],

  // V28.2 — Catálogo guiado de números por segmento. Usuário ATIVA do catálogo
  // (não precisa inventar do zero), e o handoff aparece destacado: o KPI marcado
  // com `handoff: true` é o "entregável" do segmento pro próximo.
  KPI_CATALOG: {
    marketing: [
      { id: 'mkt_leads',         name: 'Leads gerados no período',     metric: 'quantidade', description: 'Quantas pessoas demonstraram interesse e deixaram contato.', handoff: true },
      { id: 'mkt_cpl',           name: 'Custo por lead',                metric: 'reais',      description: 'Quanto você está pagando, em média, pra trazer cada lead.' },
      { id: 'mkt_mql_pct',       name: 'Leads qualificados (%)',        metric: 'percentual', description: 'Dos leads gerados, quantos % são realmente potenciais compradores (com perfil e momento).' },
      { id: 'mkt_campaign_resp', name: 'Taxa de resposta de campanha',  metric: 'percentual', description: 'Dos contatos disparados, quantos % responderam.' },
      { id: 'mkt_visitors',      name: 'Visitantes únicos no site',     metric: 'quantidade', description: 'Quantas pessoas distintas chegaram no seu site/loja online.' },
      { id: 'mkt_reach',         name: 'Alcance / impressões',          metric: 'quantidade', description: 'Quantas vezes a marca apareceu pra alguém (topo do topo do funil).' }
    ],
    sales: [
      { id: 'sal_new_clients',   name: 'Novos clientes ativos',         metric: 'quantidade', description: 'Quantos novos clientes começaram a comprar no período.', handoff: true },
      { id: 'sal_avg_ticket',    name: 'Ticket médio',                  metric: 'reais',      description: 'Valor médio gasto por cliente em cada compra.' },
      { id: 'sal_conv_rate',     name: 'Conversão lead → cliente',      metric: 'percentual', description: 'Dos leads que Vendas recebeu, quantos % viraram cliente.' },
      { id: 'sal_cycle',         name: 'Ciclo médio de venda',          metric: 'dias',       description: 'Tempo médio do primeiro contato até o fechamento.' },
      { id: 'sal_win_rate',      name: 'Win rate em oportunidades',     metric: 'percentual', description: 'Das oportunidades qualificadas, quantas % fecharam.' },
      { id: 'sal_new_revenue',   name: 'Receita de novas vendas',       metric: 'reais',      description: 'Quanto dinheiro novo entrou no período por vendas fechadas.' }
    ],
    cs: [
      { id: 'cs_retention',      name: 'Taxa de retenção de clientes',  metric: 'percentual', description: 'Quantos % dos clientes continuam ativos após X meses.' },
      { id: 'cs_nps',            name: 'NPS (pontuação)',               metric: 'pontuacao',  description: 'Nota de 0 a 10 que mede quanto o cliente recomendaria. Promotores = advogados da marca.' },
      { id: 'cs_ltv',            name: 'LTV — valor do cliente',        metric: 'reais',      description: 'Quanto cada cliente gasta, em média, durante toda a relação com sua marca.' },
      { id: 'cs_repurchase',     name: 'Taxa de recompra',              metric: 'percentual', description: 'Quantos % dos clientes voltaram a comprar.' },
      { id: 'cs_referrals',      name: 'Indicações geradas por clientes', metric: 'quantidade', description: 'Quantos novos leads chegaram porque um cliente atual indicou.', handoff: true },
      { id: 'cs_resolution_time', name: 'Tempo médio de resolução',     metric: 'dias',       description: 'Quanto tempo, em média, leva pra resolver um problema do cliente.' }
    ]
  },

  // V28.3 — Catálogo guiado de AÇÕES típicas por segmento. Cada ação aponta
  // pros catalogId(s) dos KPIs que ela move — vínculo automático na ativação.
  // V28.4.1 — Catálogo agora carrega sector/funnel/destSector/destFunnel/channel/
  // actionType corretos por baixo (defaults invisíveis pro user no Mapa, mas que
  // fazem a ação aparecer no setor/funil certo nos menus laterais).
  // Handoffs cross-area (Webinar→Vendas, Promo→CS, Indicação→Mkt) materializam o
  // ciclo do funil. Channel/actionType respeitam Config.channels e Config.actionTypes.
  STRATEGIC_ACTION_CATALOG: {
    marketing: [
      { id: 'mkt_paid_traffic',  name: 'Campanha de tráfego pago',     description: 'Anúncios em Meta/Google pra trazer leads qualificados.', kpiIds: ['mkt_leads', 'mkt_cpl', 'mkt_visitors'],   sector: 'Marketing', funnel: 'TOF', destinationSector: 'Marketing', destinationFunnel: 'MOF', channel: 'Meta Ads',         actionType: 'Campanha' },
      { id: 'mkt_email',         name: 'Email marketing / newsletter', description: 'Sequência de e-mails educativos pra nutrir lista e converter.', kpiIds: ['mkt_campaign_resp', 'mkt_leads'],  sector: 'Marketing', funnel: 'MOF', destinationSector: 'Marketing', destinationFunnel: 'MOF', channel: 'RD Email',         actionType: 'Sequência' },
      { id: 'mkt_seo',           name: 'Conteúdo / SEO orgânico',      description: 'Posts e materiais que ranqueiam e trazem tráfego qualificado de graça.', kpiIds: ['mkt_visitors', 'mkt_reach', 'mkt_leads'], sector: 'Marketing', funnel: 'TOF', destinationSector: 'Marketing', destinationFunnel: 'MOF', channel: 'Outro',            actionType: 'Post' },
      { id: 'mkt_webinar',       name: 'Webinar / live / lançamento',  description: 'Evento online pra captar leads quentes que assistem ao vivo.', kpiIds: ['mkt_leads', 'mkt_mql_pct'],         sector: 'Marketing', funnel: 'MOF', destinationSector: 'Vendas',    destinationFunnel: 'BOF', channel: 'Outro',            actionType: 'Webinar' },
      { id: 'mkt_social',        name: 'Mídia social orgânica',         description: 'Conteúdo recorrente em redes pra alcance e engajamento.', kpiIds: ['mkt_reach', 'mkt_visitors'],          sector: 'Marketing', funnel: 'TOF', destinationSector: 'Marketing', destinationFunnel: 'MOF', channel: 'Instagram Orgânico', actionType: 'Post' },
      { id: 'mkt_partnerships',  name: 'Parcerias / co-marketing',     description: 'Trocas com marcas complementares pra ampliar audiência.', kpiIds: ['mkt_reach', 'mkt_leads'],            sector: 'Marketing', funnel: 'TOF', destinationSector: 'Marketing', destinationFunnel: 'TOF', channel: 'Outro',            actionType: 'Campanha' }
    ],
    sales: [
      { id: 'sal_outbound',  name: 'Cadência de outbound',         description: 'Cold email/call estruturados pra abrir conversa com prospects.', kpiIds: ['sal_new_clients', 'sal_conv_rate'],  sector: 'Vendas', funnel: 'TOF', destinationSector: 'Vendas', destinationFunnel: 'MOF', channel: 'Outbound',  actionType: 'Sequência' },
      { id: 'sal_demo',      name: 'Demo / reunião comercial',     description: 'Apresentação 1:1 pra mostrar valor e fechar.',                  kpiIds: ['sal_new_clients', 'sal_win_rate'],   sector: 'Vendas', funnel: 'MOF', destinationSector: 'Vendas', destinationFunnel: 'BOF', channel: 'Outro',     actionType: 'Ligação' },
      { id: 'sal_proposal',  name: 'Proposta / negociação',        description: 'Envio e ajuste de propostas até o aceite.',                     kpiIds: ['sal_avg_ticket', 'sal_win_rate'],    sector: 'Vendas', funnel: 'BOF', destinationSector: 'Vendas', destinationFunnel: 'BOF', channel: 'Outro',     actionType: 'CRM' },
      { id: 'sal_qualif',    name: 'Qualificação inbound (SDR)',   description: 'Triagem dos leads que chegam pra entregar só os quentes ao closer.', kpiIds: ['sal_conv_rate', 'sal_cycle'],   sector: 'Vendas', funnel: 'TOF', destinationSector: 'Vendas', destinationFunnel: 'MOF', channel: 'SDR',       actionType: 'SDR' },
      { id: 'sal_promo',     name: 'Promoção / desconto sazonal',  description: 'Oferta limitada pra acelerar decisão e bater meta de receita.',  kpiIds: ['sal_new_clients', 'sal_new_revenue'], sector: 'Vendas', funnel: 'BOF', destinationSector: 'CS',     destinationFunnel: 'TOF', channel: 'Outro',     actionType: 'Campanha' },
      { id: 'sal_upsell',    name: 'Upsell no momento da venda',   description: 'Combo/upgrade ofertado durante o fechamento pra subir ticket.',  kpiIds: ['sal_avg_ticket', 'sal_new_revenue'], sector: 'Vendas', funnel: 'BOF', destinationSector: 'Vendas', destinationFunnel: 'BOF', channel: 'Outro',     actionType: 'CRM' }
    ],
    cs: [
      { id: 'cs_onboarding', name: 'Onboarding estruturado',         description: 'Roteiro de primeiros passos pra cliente extrair valor rápido.', kpiIds: ['cs_retention', 'cs_resolution_time'], sector: 'CS', funnel: 'TOF', destinationSector: 'CS',        destinationFunnel: 'MOF', channel: 'Outro',     actionType: 'CS' },
      { id: 'cs_qbr',        name: 'Acompanhamento periódico (QBR)', description: 'Review trimestral 1:1 pra revisar resultado e renovar.',         kpiIds: ['cs_retention', 'cs_nps'],            sector: 'CS', funnel: 'MOF', destinationSector: 'CS',        destinationFunnel: 'MOF', channel: 'Outro',     actionType: 'CS' },
      { id: 'cs_support',    name: 'Suporte ativo (chat/tickets)',   description: 'Atendimento responsivo pra resolver dor antes de virar churn.',  kpiIds: ['cs_resolution_time', 'cs_nps'],      sector: 'CS', funnel: 'MOF', destinationSector: 'CS',        destinationFunnel: 'MOF', channel: 'WhatsApp',  actionType: 'CS' },
      { id: 'cs_loyalty',    name: 'Programa de fidelidade',         description: 'Recompensas pra quem volta a comprar — cria recorrência.',       kpiIds: ['cs_repurchase', 'cs_ltv'],           sector: 'CS', funnel: 'BOF', destinationSector: 'CS',        destinationFunnel: 'BOF', channel: 'Outro',     actionType: 'CS' },
      { id: 'cs_nps_action', name: 'NPS + ação em detratores',       description: 'Survey periódico + plano de ação pra resgatar quem reclamou.',   kpiIds: ['cs_nps', 'cs_retention'],            sector: 'CS', funnel: 'MOF', destinationSector: 'CS',        destinationFunnel: 'MOF', channel: 'Outro',     actionType: 'CS' },
      { id: 'cs_advocacy',   name: 'Programa de indicação',          description: 'Mecânica formal pra cliente trazer outro cliente — fecha o loop com Marketing.', kpiIds: ['cs_referrals', 'cs_nps'], sector: 'CS', funnel: 'BOF', destinationSector: 'Marketing', destinationFunnel: 'TOF', channel: 'Outro',     actionType: 'Canal de aquisição' }
    ]
  },

  // V28.3 — Cadências possíveis pra uma ação (chips inline no card).
  STRATEGIC_ACTION_CADENCES: [
    { id: 'once',     label: 'Única' },
    { id: 'weekly',   label: 'Semanal' },
    { id: 'biweekly', label: 'Quinzenal' },
    { id: 'monthly',  label: 'Mensal' }
  ],

  // V28.3 — Status possíveis.
  STRATEGIC_ACTION_STATUSES: [
    { id: 'planned', label: 'Planejada', color: 'slate' },
    { id: 'running', label: 'Rodando',   color: 'emerald' },
    { id: 'paused',  label: 'Pausada',   color: 'amber' },
    { id: 'ended',   label: 'Encerrada', color: 'red' }
  ],

  // V28.4.1 — Pega a campanha estratégica vinculada ao Mapa do produto.
  // Retorna null se ainda não foi definida (user precisa nomear antes de ativar ação).
  getStrategicCampaign(productId) {
    const map = this.getForProduct(productId);
    const campaignId = map?.strategicCampaignId;
    if (!campaignId) return null;
    return (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId)) || null;
  },

  // V28.4.1 — Define a campanha estratégica do produto. Pode criar nova OU vincular existente.
  // - name + existingId=null → cria nova com esse nome
  // - existingId setado → vincula a existente (name é ignorado)
  setStrategicCampaign(productId, name, existingId) {
    if (existingId) {
      const existing = (App.state.campaigns || []).find(c => Number(c.id) === Number(existingId));
      if (!existing) return null;
      this.save(productId, { strategicCampaignId: Number(existing.id) });
      // V29.0.2 — Não marca mais isStrategicHost (deprecado, vinha quebrando migração).
      return existing;
    }
    const clean = String(name || '').trim() || 'Campanha estratégica';
    const campaign = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      productId: Number(productId),
      name: clean,
      objective: 'Campanha estratégica vinculada ao Mapa da Receita.',
      isStrategicHost: true,
      createdAt: new Date().toISOString()
    };
    App.state.campaigns = [campaign, ...(App.state.campaigns || [])];
    this.save(productId, { strategicCampaignId: Number(campaign.id) });
    return campaign;
  },

  // V28.4.1 — Renomeia a campanha estratégica do produto.
  renameStrategicCampaign(productId, newName) {
    const map = this.getForProduct(productId);
    const campaignId = map?.strategicCampaignId;
    if (!campaignId) return false;
    const clean = String(newName || '').trim();
    if (!clean) return false;
    App.state.campaigns = (App.state.campaigns || []).map(c =>
      Number(c.id) === Number(campaignId) ? { ...c, name: clean } : c
    );
    return true;
  },

  // V28.4.1 — Migração one-shot: mescla campanhas auto-criadas LEGADAS V28
  // (nome começando com "Mapa da Receita" sem branch própria). NÃO mescla
  // mais qualquer campanha com isStrategicHost — no V29, cada branch é uma
  // campanha legítima e plugada.
  // V29.0.2 — Critério restrito: nome começa com "Mapa da Receita" E não tem
  // branch própria em strategicCampaignMaps (= legado V28 puro).
  migrateLegacyStrategicCampaigns(productId) {
    const branchMaps = App.state.strategicCampaignMaps || {};
    const isLegacy = (c) =>
      Number(c.productId) === Number(productId) &&
      String(c.name || '').startsWith('Mapa da Receita') &&
      !branchMaps[c.id];   // só conta legado se NÃO tem branch própria
    const all = (App.state.campaigns || []).filter(isLegacy);
    if (all.length <= 1) {
      if (all.length === 1) {
        const map = this.getForProduct(productId);
        if (!map?.strategicCampaignId) this.save(productId, { strategicCampaignId: Number(all[0].id) });
        App.state.campaigns = (App.state.campaigns || []).map(c =>
          Number(c.id) === Number(all[0].id) ? { ...c, isStrategicHost: true } : c
        );
      }
      return 0;
    }
    all.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    const keeper = all[0];
    const duplicateIds = new Set(all.slice(1).map(c => Number(c.id)));
    App.state.actions = (App.state.actions || []).map(a =>
      duplicateIds.has(Number(a.campaignId)) ? { ...a, campaignId: Number(keeper.id) } : a
    );
    App.state.campaigns = (App.state.campaigns || []).filter(c => !duplicateIds.has(Number(c.id)));
    App.state.campaigns = App.state.campaigns.map(c =>
      Number(c.id) === Number(keeper.id) ? { ...c, isStrategicHost: true } : c
    );
    this.save(productId, { strategicCampaignId: Number(keeper.id) });
    return duplicateIds.size;
  },

  // V29.2.3 — Migração one-shot: garante que toda action estratégica tenha
  // os campos compat usados pelo ActionModule.card (leads, okrs, flowPath, etc.).
  // Resolve TypeError 'cannot read length of undefined' em ações criadas antes
  // do V29.2.3 que não setavam esses defaults.
  migrateStrategicActionsCompatFields(productId) {
    const campaignIds = new Set((App.state.campaigns || []).filter(c => Number(c.productId) === Number(productId)).map(c => Number(c.id)));
    let fixed = 0;
    App.state.actions = (App.state.actions || []).map(a => {
      if (!campaignIds.has(Number(a.campaignId)) || !a.strategicCatalogId) return a;
      const needsFix = !Array.isArray(a.leads) || !Array.isArray(a.okrs) || !Array.isArray(a.flowPath);
      if (!needsFix) return a;
      fixed++;
      return {
        ...a,
        leads: Array.isArray(a.leads) ? a.leads : [],
        okrs: Array.isArray(a.okrs) ? a.okrs : [],
        kpis: Array.isArray(a.kpis) ? a.kpis : [],
        flowPath: Array.isArray(a.flowPath) ? a.flowPath : [],
        flow: a.flow !== undefined ? a.flow : null,
        flowConfig: a.flowConfig !== undefined ? a.flowConfig : null,
        scoreId: a.scoreId || (App.state.scores?.[0]?.id) || 1,
        connected: a.connected !== undefined ? a.connected : false,
        connectionStatus: a.connectionStatus || 'ready',
        conversionObjective: a.conversionObjective !== undefined ? a.conversionObjective : '',
        objective: a.objective !== undefined ? a.objective : '',
        expectedConversion: a.expectedConversion !== undefined ? a.expectedConversion : 25,
        mailingDefined: a.mailingDefined !== undefined ? a.mailingDefined : false
      };
    });
    return fixed;
  },

  // V28.4.1 — Migração one-shot: pra cada action com strategicCatalogId, re-aplica
  // os defaults do template (sector/funnel/destSector/destFunnel/channel/actionType).
  // Conserta ações criadas em versões anteriores onde esses campos não eram propagados.
  migrateLegacyStrategicActions(productId) {
    const campaignIds = new Set((App.state.campaigns || []).filter(c => Number(c.productId) === Number(productId)).map(c => Number(c.id)));
    let fixed = 0;
    App.state.actions = (App.state.actions || []).map(a => {
      if (!campaignIds.has(Number(a.campaignId)) || !a.strategicCatalogId || !a.strategicAreaId) return a;
      const template = (this.STRATEGIC_ACTION_CATALOG[a.strategicAreaId] || []).find(t => t.id === a.strategicCatalogId);
      if (!template) return a;
      // Re-aplica apenas se algum dos campos de routing estiver faltando ou diferente do template.
      const needsFix = (
        a.sector !== template.sector ||
        a.funnel !== template.funnel ||
        a.destinationSector !== template.destinationSector ||
        a.destinationFunnel !== template.destinationFunnel ||
        a.channel !== template.channel ||
        a.actionType !== template.actionType
      );
      if (!needsFix) return a;
      fixed++;
      return {
        ...a,
        sector: template.sector,
        funnel: template.funnel,
        destinationSector: template.destinationSector,
        destinationFunnel: template.destinationFunnel,
        channel: template.channel,
        actionType: template.actionType
      };
    });
    return fixed;
  },

  // V28.3 — Ativa uma ação do catálogo: cria entry em App.state.actions e auto-vincula
  // aos KRs ativos da área que match os kpiIds do template.
  // V28.4.1 — REQUER strategicCampaignId definido no map. Se não, retorna { needsCampaign: true }
  // pra Actions.activateStrategicCatalogAction abrir o prompt de campanha. Propaga todos
  // os campos de routing do template (sector/funnel/destSector/destFunnel/channel/actionType).
  activateCatalogAction(productId, areaId, templateId) {
    const template = (this.STRATEGIC_ACTION_CATALOG[areaId] || []).find(a => a.id === templateId);
    if (!template) return { error: 'template-not-found' };
    const campaign = this.getStrategicCampaign(productId);
    if (!campaign) return { needsCampaign: true };
    const action = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      campaignId: Number(campaign.id),
      name: template.name,
      channel: template.channel,
      actionType: template.actionType,
      sector: template.sector,
      funnel: template.funnel,
      originSector: template.sector,                                  // V29.2.3 — defaults compat
      originFunnel: template.funnel,
      destinationSector: template.destinationSector,
      destinationFunnel: template.destinationFunnel,
      status: 'Rascunho estratégico',
      isDraft: true,
      // V29.2.3 — Defaults compat com ActionModule.card pra evitar TypeError em
      // action.leads.length, action.okrs, flowPath, etc.
      leads: [],
      okrs: [],
      kpis: [],
      flowPath: [],
      flow: null,
      flowConfig: null,
      scoreId: (App.state.scores?.[0]?.id) || 1,
      connected: false,
      connectionStatus: 'ready',
      conversionObjective: '',
      objective: '',
      expectedConversion: 25,
      mailingDefined: false,
      strategicAreaId: areaId,
      strategicCatalogId: templateId,
      strategicDescription: template.description,
      strategicOwner: '',
      strategicCadence: null,
      strategicStatus: 'planned',
      strategicConfirmed: false,
      createdAt: new Date().toISOString()
    };
    App.state.actions = [action, ...(App.state.actions || [])];
    // Auto-vincula a KRs ativos com catalogId compatível.
    const objective = this.getObjectiveByArea(productId, areaId);
    if (objective && window.StrategicOkrEngine) {
      (objective.okrs || []).forEach(kr => {
        if (kr.catalogId && template.kpiIds.includes(kr.catalogId)) {
          StrategicOkrEngine.toggleAction(productId, objective.id, kr.id, action.id);
        }
      });
    }
    return { action };
  },

  // V28.3 — Lista ações estratégicas de uma área (vinculadas à campanha do produto).
  // V29.0.0 — se campaignId fornecido, filtra só dessa branch. Sem ele, varre o produto inteiro.
  getStrategicActionsByArea(productId, areaId, campaignId) {
    if (campaignId) {
      return (App.state.actions || []).filter(a =>
        Number(a.campaignId) === Number(campaignId) && a.strategicAreaId === areaId
      );
    }
    const campaignIds = new Set((App.state.campaigns || []).filter(c => Number(c.productId) === Number(productId)).map(c => Number(c.id)));
    return (App.state.actions || []).filter(a =>
      campaignIds.has(Number(a.campaignId)) && a.strategicAreaId === areaId
    );
  },

  // V28.3 — IDs do catálogo já ativados na área (pra UI marcar/desabilitar).
  getActivatedCatalogActionIds(productId, areaId, campaignId) {
    return new Set(this.getStrategicActionsByArea(productId, areaId, campaignId).map(a => a.strategicCatalogId).filter(Boolean));
  },

  // V28.3 — KRs confirmados que não têm NENHUMA ação vinculada (alerta visual).
  getKrsWithoutActions(productId, areaId, campaignId) {
    const obj = this.getObjectiveByArea(productId, areaId, campaignId);
    return (obj?.okrs || []).filter(kr => kr.confirmed && !(kr.connectedActionIds || []).length);
  },

  // V28.2 — Ativa um KPI do catálogo como um novo número vazio (metas a preencher).
  // V28.2.1 — current começa null (input vazio) em vez de 0.
  // V29.0.0 — escreve em branch + K3: cria KR-mãe no produto se não existir + linka filho.
  activateCatalogKpi(productId, areaId, kpiId, campaignId) {
    const kpi = (this.KPI_CATALOG[areaId] || []).find(k => k.id === kpiId);
    if (!kpi) return null;
    const targetCampaignId = campaignId || this._getActiveCampaignId(productId);
    const objective = this.getObjectiveByArea(productId, areaId, targetCampaignId);
    if (!objective || !window.StrategicOkrEngine) return null;
    // K3 — Garante que existe KR-mãe correspondente no produto. Se não, cria auto.
    const parentResult = this.findOrCreateProductKr(productId, areaId, kpi.id, kpi.name, kpi.metric);
    return StrategicOkrEngine.add(productId, objective.id, {
      name: kpi.name,
      metric: kpi.metric,
      catalogId: kpi.id,
      catalogDescription: kpi.description,
      isHandoff: Boolean(kpi.handoff),
      current: null,
      targetCommitted: null,
      targetStretch: null,
      period: 90,
      confirmed: false,
      parentProductKrId: parentResult.parent.id  // V29.0.0 — vínculo pro rollup
    }, targetCampaignId);
  },

  // V28.2 — IDs do catálogo já ativados nesta área (pra UI marcar/desabilitar).
  getActivatedCatalogIds(productId, areaId, campaignId) {
    const objective = this.getObjectiveByArea(productId, areaId, campaignId);
    return new Set((objective?.okrs || []).map(kr => kr.catalogId).filter(Boolean));
  },

  // V28.2.1 — Próximo número a confirmar.
  // V29.0.0 — campaignId opcional (default: branch ativa).
  nextUnconfirmedKr(productId, campaignId) {
    const targetCampaignId = campaignId || this._getActiveCampaignId(productId);
    const areas = this.COMERCIAL_AREAS;
    for (const area of areas) {
      const obj = this.getObjectiveByArea(productId, area.id, targetCampaignId);
      if (!obj) continue;
      for (const kr of (obj.okrs || [])) {
        if (!kr.confirmed) return { objectiveId: obj.id, krId: kr.id, areaId: area.id };
      }
    }
    return null;
  },

  // V28.2.1 — Todos os números das 3 áreas estão confirmados?
  // V29.0.0 — agora opera em branch.
  allKrsConfirmed(productId, campaignId) {
    const targetCampaignId = campaignId || this._getActiveCampaignId(productId);
    let objectives;
    if (targetCampaignId) {
      objectives = (this.getBranchMap(targetCampaignId)?.objectives) || [];
    } else {
      objectives = (this.getForProduct(productId)?.objectives) || [];
    }
    const krs = objectives.flatMap(o => o.okrs || []);
    return krs.length > 0 && krs.every(kr => kr.confirmed);
  },

  // V28.1 — Garante que as 3 áreas existam como objetivos.
  // V29.0.0 — Agora opera em branch (se houver strategicCampaignId), com migração
  // lazy do legacy strategicMaps[productId].objectives pra branch.
  ensureComercialAreas(productId, campaignId) {
    const targetCampaignId = campaignId || this._getActiveCampaignId(productId);
    if (!targetCampaignId) {
      // Sem campaign estratégica definida ainda → opera no legacy (compat).
      return this._ensureComercialAreasLegacy(productId);
    }
    // V29 — escreve em branch.
    this._lazyMigrateLegacyToBranch(productId, targetCampaignId);
    const branch = this.ensureBranchMap(targetCampaignId, productId);
    let objectives = [...(branch.objectives || [])];
    const areaIds = this.COMERCIAL_AREAS.map(a => a.id);
    const existingAreas = new Set(objectives.filter(o => o.area).map(o => o.area));
    if (!existingAreas.size) {
      const unassigned = objectives.filter(o => !o.area);
      for (let i = 0; i < Math.min(unassigned.length, 3); i++) {
        const obj = unassigned[i];
        const area = areaIds[i];
        const idx = objectives.findIndex(o => o.id === obj.id);
        objectives[idx] = { ...obj, area };
        existingAreas.add(area);
      }
    }
    this.COMERCIAL_AREAS.forEach(area => {
      if (existingAreas.has(area.id)) return;
      objectives.push({
        id: `obj_${Date.now()}_${Math.floor(Math.random() * 1000)}_${area.id}`,
        label: area.label,
        owner: '',
        deadline: null,
        area: area.id,
        okrs: [],
        createdAt: new Date().toISOString()
      });
    });
    this.saveBranchMap(targetCampaignId, { objectives });
    return objectives;
  },

  _ensureComercialAreasLegacy(productId) {
    const map = this.ensure(productId);
    let objectives = [...(map.objectives || [])];
    const areaIds = this.COMERCIAL_AREAS.map(a => a.id);
    const existingAreas = new Set(objectives.filter(o => o.area).map(o => o.area));
    if (!existingAreas.size) {
      const unassigned = objectives.filter(o => !o.area);
      for (let i = 0; i < Math.min(unassigned.length, 3); i++) {
        const obj = unassigned[i];
        const area = areaIds[i];
        const idx = objectives.findIndex(o => o.id === obj.id);
        objectives[idx] = { ...obj, area };
        existingAreas.add(area);
      }
    }
    this.COMERCIAL_AREAS.forEach(area => {
      if (existingAreas.has(area.id)) return;
      objectives.push({
        id: `obj_${Date.now()}_${Math.floor(Math.random() * 1000)}_${area.id}`,
        label: area.label, owner: '', deadline: null, area: area.id, okrs: [],
        createdAt: new Date().toISOString()
      });
    });
    this.save(productId, { objectives });
    return objectives;
  },

  // V29.0.0 — getObjectiveByArea agora aceita campaignId opcional.
  // Lê do branch primeiro; fallback no legacy.
  getObjectiveByArea(productId, areaId, campaignId) {
    const targetCampaignId = campaignId || this._getActiveCampaignId(productId);
    if (targetCampaignId) {
      const branch = this.getBranchMap(targetCampaignId);
      if (branch) return (branch.objectives || []).find(o => o.area === areaId) || null;
    }
    const map = this.getForProduct(productId);
    return (map.objectives || []).find(o => o.area === areaId) || null;
  },

  // =================== V29.0.0 — NOVA API DE BRANCHES + PRODUCT KRs ===================

  // Branch ativa por produto (a strategicCampaignId vigente).
  _getActiveCampaignId(productId) {
    const map = this.getForProduct(productId);
    return map?.strategicCampaignId || null;
  },

  // Pega ou cria branch map de uma campanha.
  getBranchMap(campaignId) {
    if (!campaignId) return null;
    return (App.state.strategicCampaignMaps || {})[campaignId] || null;
  },

  ensureBranchMap(campaignId, productId) {
    const existing = this.getBranchMap(campaignId);
    if (existing) return existing;
    const fresh = this.defaultBranchMap(campaignId, productId);
    App.state.strategicCampaignMaps = { ...(App.state.strategicCampaignMaps || {}), [campaignId]: fresh };
    return fresh;
  },

  saveBranchMap(campaignId, patch) {
    const current = this.getBranchMap(campaignId);
    if (!current) return null;
    const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
    App.state.strategicCampaignMaps = { ...(App.state.strategicCampaignMaps || {}), [campaignId]: next };
    return next;
  },

  // Lista todas as branches (campanhas plugadas) de um produto.
  getBranchesByProduct(productId) {
    const maps = App.state.strategicCampaignMaps || {};
    return Object.values(maps).filter(b => Number(b.productId) === Number(productId));
  },

  // Lista campanhas do produto que ainda NÃO têm branch (desplugadas).
  getDesplugedCampaigns(productId) {
    const branches = this.getBranchesByProduct(productId);
    const pluggedIds = new Set(branches.map(b => Number(b.campaignId)));
    return (App.state.campaigns || []).filter(c =>
      Number(c.productId) === Number(productId) && !pluggedIds.has(Number(c.id))
    );
  },

  // === STATUS DA CAMPANHA (3 estágios: unplugged / configuring / active) ===
  // V29.0.0 — usado pra colorir badge no menu Campanhas.
  getCampaignStrategicStatus(campaignId) {
    const branch = this.getBranchMap(campaignId);
    if (!branch) return 'unplugged';        // 🔴 vermelho
    const allKrs = (branch.objectives || []).flatMap(o => o.okrs || []);
    const confirmedKrs = allKrs.filter(k => k.confirmed);
    if (!confirmedKrs.length) return 'configuring';  // 🟡 amarelo
    return 'active';                         // 🟣 roxo
  },

  // V29.3.0 — CATÁLOGO CUSTOM DE AÇÕES (engine que aprende).
  // Escopo: empresa toda (transversal entre produtos e mapas).
  // Cada custom tem sector + funnel + destination + channel + usageByKr (pra ML fase 2).
  // V1: filtragem só por sector (= área ativa); ML fase 2 esconde via curva C.
  // V29.3.0 — Constantes ML (engine de aprendizado da fase 2).
  CUSTOM_ACTION_ML_MIN_USAGE: 50,      // Min usos totais pra ML começar a decidir
  CUSTOM_ACTION_ML_HIDE_THRESHOLD: 0.20, // Se KR usa < 20% do total, é curva C

  getCustomActions() {
    return App.state.customActionCatalog || [];
  },

  // V29.3.1 — Aceita krCatalogId opcional pra aplicar ML (filtra customs escondidas
  // por curva C nesse KR específico).
  getCustomActionsForArea(areaId, krCatalogId) {
    const all = this.getCustomActions().filter(c => c.sector === areaId);
    if (!krCatalogId) return all;
    return all.filter(c => !this.isCustomActionHiddenForKr(c, krCatalogId));
  },

  // V29.3.1 — Decide se a custom action está escondida pro KR via ML (curva C).
  // Regra: só decide se a custom tem ≥ 50 usos totais. Antes disso, sempre visível.
  // Depois disso, se o KR usa < 20% do total → escondida.
  isCustomActionHiddenForKr(custom, krCatalogId) {
    const usage = custom.usageByKr || {};
    const total = Object.values(usage).reduce((s, n) => s + Number(n || 0), 0);
    if (total < this.CUSTOM_ACTION_ML_MIN_USAGE) return false;
    const krUsage = Number(usage[krCatalogId] || 0);
    const ratio = total > 0 ? krUsage / total : 0;
    return ratio < this.CUSTOM_ACTION_ML_HIDE_THRESHOLD;
  },

  // Dedup por nome (case-insensitive). Retorna {ok, action, error, revived}.
  // V29.3.1 — Recovery contextual: se já existe E está escondida pelo ML no KR
  // contexto (originKrCatalogId), "ressuscita" — bump usage no KR pra trazê-la
  // de volta + retorna ok=true com revived=true. User não precisa criar duplicata.
  addCustomAction(data) {
    const name = String(data.name || '').trim();
    if (!name) return { ok: false, error: 'Nome obrigatório.' };
    const existing = this.getCustomActions().find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      // Se está escondida no KR contexto, ressuscita.
      const krCatalogId = data.originKrCatalogId;
      if (krCatalogId && this.isCustomActionHiddenForKr(existing, krCatalogId)) {
        // Bump usage artificial pra tirar da curva C (incrementa o suficiente pra passar do threshold)
        const usage = existing.usageByKr || {};
        const total = Object.values(usage).reduce((s, n) => s + Number(n || 0), 0);
        const minNeeded = Math.ceil(total * this.CUSTOM_ACTION_ML_HIDE_THRESHOLD);
        const current = Number(usage[krCatalogId] || 0);
        const bump = Math.max(1, minNeeded - current + 1);
        for (let i = 0; i < bump; i++) this.incrementCustomActionUsage(existing.id, krCatalogId);
        return { ok: true, action: existing, revived: true };
      }
      return { ok: false, error: `Já existe uma ação custom com o nome "${existing.name}". Escolha outro nome ou use a existente no catálogo.` };
    }
    const action = {
      id: `cust_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name,
      sector: data.sector,                       // 'marketing' | 'sales' | 'cs'
      funnel: data.funnel,                        // 'TOF' | 'MOF' | 'BOF'
      destinationSector: data.destinationSector,
      destinationFunnel: data.destinationFunnel,
      channel: data.channel,                     // do Config.channels ou 'Outro: xxx'
      actionType: data.actionType || 'Outro',
      origin: { productId: data.originProductId || null, krCatalogId: data.originKrCatalogId || null },
      usageByKr: {},                              // pra ML fase 2: {krCatalogId: count}
      // V31.2.22 — KRs que o user marcou na engine quando criou a custom.
      // Usado pelo Actions.plugCoverageChip pra plugar em batch ao clicar "Plugar".
      pendingKrTargets: Array.isArray(data.pendingKrTargets) ? data.pendingKrTargets : [],
      createdAt: new Date().toISOString()
    };
    App.state.customActionCatalog = [...this.getCustomActions(), action];
    return { ok: true, action };
  },

  // Conta uso da custom num KR específico (pra ML futuro).
  incrementCustomActionUsage(customId, krCatalogId) {
    const list = this.getCustomActions();
    App.state.customActionCatalog = list.map(c => {
      if (c.id !== customId) return c;
      const usage = { ...(c.usageByKr || {}) };
      usage[krCatalogId] = (usage[krCatalogId] || 0) + 1;
      return { ...c, usageByKr: usage };
    });
  },

  // V29.3.0 — Ativa uma custom action num KR específico (similar ao
  // activateCatalogAction mas pra customs). Auto-vincula ao KR-filho.
  activateCustomAction(productId, areaId, customActionId, parentProductKrId, campaignId) {
    const custom = this.getCustomActions().find(c => c.id === customActionId);
    if (!custom) return { error: 'Custom action não encontrada.' };
    const targetCampaignId = campaignId || this._getActiveCampaignId(productId);
    if (!targetCampaignId) return { needsCampaign: true };
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(targetCampaignId));
    if (!campaign) return { error: 'Campanha não encontrada.' };
    const objective = this.getObjectiveByArea(productId, areaId, targetCampaignId);
    if (!objective) return { error: 'Frente não encontrada.' };
    const productKr = this.getProductKrs(productId).find(k => k.id === parentProductKrId);
    const action = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      campaignId: Number(targetCampaignId),
      name: custom.name,
      channel: custom.channel,
      actionType: custom.actionType,
      sector: custom.sector === 'marketing' ? 'Marketing' : (custom.sector === 'sales' ? 'Vendas' : 'CS'),
      funnel: custom.funnel,
      originSector: custom.sector === 'marketing' ? 'Marketing' : (custom.sector === 'sales' ? 'Vendas' : 'CS'),
      originFunnel: custom.funnel,
      destinationSector: custom.destinationSector === 'marketing' ? 'Marketing' : (custom.destinationSector === 'sales' ? 'Vendas' : 'CS'),
      destinationFunnel: custom.destinationFunnel,
      status: 'Rascunho estratégico (custom)',
      isDraft: true,
      leads: [], okrs: [], kpis: [], flowPath: [], flow: null, flowConfig: null,
      scoreId: (App.state.scores?.[0]?.id) || 1,
      connected: false, connectionStatus: 'ready',
      conversionObjective: '', objective: '',
      expectedConversion: 25, mailingDefined: false,
      strategicAreaId: areaId,
      strategicCustomActionId: customActionId,    // V29.3 — marca como custom
      strategicDescription: '', // V29.3.3 — sem tag custom no menu Ações; trata igual qualquer outra
      strategicOwner: '',
      strategicCadence: null,
      strategicStatus: 'planned',
      strategicConfirmed: false,
      createdAt: new Date().toISOString()
    };
    App.state.actions = [action, ...(App.state.actions || [])];
    // Auto-vincula ao KR-filho que tem esse parentProductKrId
    if (productKr && window.StrategicOkrEngine) {
      (objective.okrs || []).forEach(kr => {
        if (kr.parentProductKrId === parentProductKrId) {
          StrategicOkrEngine.toggleAction(productId, objective.id, kr.id, action.id, targetCampaignId);
        }
      });
    }
    // Incrementa usage pra ML futuro
    if (productKr?.catalogId) this.incrementCustomActionUsage(customActionId, productKr.catalogId);
    return { action };
  },

  // V29.1.3 — Marca os KRs-mãe como "executados" (publicados pros gestores).
  // É um ponto explícito de "agora vai pra produção". Antes disso, gestores
  // veem os KRs como rascunho do CEO (não devem plugar).
  markMetricsExecuted(productId) {
    this.save(productId, { metricsExecutedAt: new Date().toISOString() });
  },

  getMetricsExecutedAt(productId) {
    return this.getForProduct(productId)?.metricsExecutedAt || null;
  },

  isMetricsExecuted(productId) {
    return Boolean(this.getMetricsExecutedAt(productId));
  },

  // V29.0.1 — Dono compartilhado da área (mesmo Marketing cuida de todas as branches).
  // Armazenado em strategicMaps[productId].areaOwners = { marketing, sales, cs }.
  getAreaOwner(productId, areaId) {
    const map = this.getForProduct(productId);
    return (map?.areaOwners || {})[areaId] || '';
  },

  setAreaOwner(productId, areaId, owner) {
    const map = this.ensure(productId);
    const areaOwners = { ...(map.areaOwners || {}), [areaId]: String(owner || '') };
    this.save(productId, { areaOwners });
  },

  // === KRs-MÃE (productKrs) ===
  getProductKrs(productId) {
    return this.getForProduct(productId)?.productKrs || [];
  },

  addProductKr(productId, krData, source = 'ceo') {
    const map = this.ensure(productId);
    const kr = {
      id: `pkr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      area: krData.area || 'marketing',
      catalogId: krData.catalogId || null,
      name: String(krData.name || '').trim() || 'KR-mãe sem nome',
      metric: krData.metric || 'quantidade',
      current: krData.current != null ? Number(krData.current) : null,
      targetCommitted: krData.targetCommitted != null ? Number(krData.targetCommitted) : null,
      targetStretch: krData.targetStretch != null ? Number(krData.targetStretch) : null,
      period: krData.period != null ? Number(krData.period) : 90,
      owner: String(krData.owner || '').trim(),
      // V31.2.11 — Padrão V28.2: kr começa em editing (confirmed=false). Vira true
      // só quando user clica "✓ Confirmar número →". Estado tri-fase: criado/
      // ativado → editando inline → confirmado verde colapsado.
      confirmed: Boolean(krData.confirmed),
      isHandoff: Boolean(krData.isHandoff),
      catalogDescription: krData.catalogDescription || '',
      createdBy: source,                    // 'ceo' | 'auto' (K3)
      createdAt: new Date().toISOString(),
      // V35.10.0-alpha1 — Metadados do Djow pra puxar o `current` ao vivo
      // da fonte real. Quando djowMeta existe e tem selectedSources, o
      // engine de KrLiveValue (alpha2) recalcula current automaticamente.
      // Quando null, KR é manual (cliente atualiza no braço).
      djowMeta: krData.djowMeta || null
    };
    const productKrs = [...(map.productKrs || []), kr];
    this.save(productId, { productKrs });
    return kr;
  },

  // V31.2.11 — Helper: próximo KR não-confirmado pra UI guiar foco com ring + badge.
  nextUnconfirmedProductKr(productId) {
    const map = this.getForProduct(productId);
    const list = map?.productKrs || [];
    const next = list.find(k => !k.confirmed);
    return next ? { krId: next.id, areaId: next.area } : null;
  },

  // V31.2.12 — Adiciona KPI customizado ao catálogo aprendido (base de conhecimento
  // global, mesclada com KPI_CATALOG no render). Aparece como sugestão pros futuros
  // produtos. Dedupe por nome case-insensitive.
  addCustomKpiToCatalog(areaId, kpiData) {
    const area = String(areaId);
    const list = (App.state.customKpiCatalog && App.state.customKpiCatalog[area]) || [];
    const name = String(kpiData.name || '').trim();
    if (!name) return null;
    if (list.some(k => String(k.name || '').toLowerCase() === name.toLowerCase())) return null;
    const id = `cuskpi_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const kpi = {
      id,
      name,
      metric: kpiData.metric || 'quantidade',
      description: kpiData.description || `Custom de ${area} (aprendido)`,
      handoff: Boolean(kpiData.handoff),
      learned: true,
      createdAt: new Date().toISOString()
    };
    App.state.customKpiCatalog = {
      ...(App.state.customKpiCatalog || {}),
      [area]: [...list, kpi]
    };
    return kpi;
  },

  updateProductKr(productId, krId, patch) {
    const map = this.ensure(productId);
    const productKrs = (map.productKrs || []).map(k => k.id === krId ? { ...k, ...patch } : k);
    this.save(productId, { productKrs });
  },

  removeProductKr(productId, krId) {
    const map = this.ensure(productId);
    const productKrs = (map.productKrs || []).filter(k => k.id !== krId);
    this.save(productId, { productKrs });
    // Limpa parentProductKrId nas filhas órfãs.
    this.getBranchesByProduct(productId).forEach(branch => {
      const objectives = (branch.objectives || []).map(o => ({
        ...o,
        okrs: (o.okrs || []).map(kr => kr.parentProductKrId === krId ? { ...kr, parentProductKrId: null } : kr)
      }));
      this.saveBranchMap(branch.campaignId, { objectives });
    });
  },

  // K3 — Auto-cria KR-mãe quando uma branch ativa um KPI do catálogo e a mãe não existe.
  // Retorna {parent, autoCreated: bool}.
  findOrCreateProductKr(productId, area, catalogId, fallbackName, fallbackMetric) {
    const existing = (this.getProductKrs(productId)).find(k => k.area === area && k.catalogId === catalogId);
    if (existing) return { parent: existing, autoCreated: false };
    const parent = this.addProductKr(productId, {
      area, catalogId,
      name: fallbackName || catalogId,
      metric: fallbackMetric || 'quantidade',
      targetCommitted: null,
      targetStretch: null,
      period: 90,
      owner: ''
    }, 'auto');
    return { parent, autoCreated: true };
  },

  // === ROLLUP (soma das filhas em todas as branches → mãe) ===
  rollupForProductKr(productId, productKrId) {
    const branches = this.getBranchesByProduct(productId);
    let sumCurrent = 0, sumCommitted = 0, sumStretch = 0;
    let contributors = 0;
    branches.forEach(branch => {
      (branch.objectives || []).forEach(o => {
        (o.okrs || []).forEach(kr => {
          if (kr.parentProductKrId === productKrId) {
            sumCurrent += Number(kr.current || 0);
            sumCommitted += Number(kr.targetCommitted || 0);
            sumStretch += Number(kr.targetStretch || 0);
            contributors++;
          }
        });
      });
    });
    return { current: sumCurrent, targetCommitted: sumCommitted, targetStretch: sumStretch, contributors };
  },

  // V29.0.1 — L (top-down): lista KRs-mãe do produto que AINDA não têm filho
  // correspondente nesta branch específica. Usado pra banner "CEO criou X, quer plugar?"
  getMissingChildrenInBranch(productId, campaignId) {
    const productKrs = this.getProductKrs(productId);
    const branch = this.getBranchMap(campaignId);
    if (!branch) return productKrs;  // branch nova: todas as mães estão faltando
    const linkedParentIds = new Set();
    (branch.objectives || []).forEach(o => (o.okrs || []).forEach(kr => {
      if (kr.parentProductKrId) linkedParentIds.add(kr.parentProductKrId);
    }));
    return productKrs.filter(pkr => !linkedParentIds.has(pkr.id));
  },

  // Lista todos os KRs-filhos órfãos (sem parentProductKrId) em todas as branches do produto.
  getOrphanChildKrs(productId) {
    const branches = this.getBranchesByProduct(productId);
    const orphans = [];
    branches.forEach(branch => {
      (branch.objectives || []).forEach(o => {
        (o.okrs || []).forEach(kr => {
          if (!kr.parentProductKrId) orphans.push({ campaignId: branch.campaignId, objectiveId: o.id, kr });
        });
      });
    });
    return orphans;
  },

  // V32.13.1 — Cor determinística por KR ID. Hash → HSL com saturação e
  // luminosidade fixas pra todas cores ficarem com mesmo "peso" visual.
  // Mesmo KR sempre tem mesma cor, em qualquer tela. Garante distinção entre
  // 10+ KRs sem precisar gerenciar paleta manualmente.
  //
  // Saturação 65% + luminosidade 55% = paleta vibrante mas legível em fundo
  // claro ou escuro. Hue varia 0-360 deterministicamente.
  krColorFromId(krId) {
    const str = String(krId || '');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;  // força int32
    }
    // Golden ratio multiplier pra distribuir hues sem colisão visual
    const hue = Math.abs(hash * 137) % 360;
    return `hsl(${hue} 65% 55%)`;
  },

  // Variante mais clara (pra backgrounds sutis: bg-{tone}-500/15 equivalent)
  krColorBgFromId(krId) {
    const str = String(krId || '');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    const hue = Math.abs(hash * 137) % 360;
    return `hsla(${hue}, 65%, 55%, 0.15)`;
  },

  // === MIGRAÇÃO LAZY V28 → V29 ===
  // Quando vai mexer em objectives de um produto, move legacy pra branch da
  // strategicCampaignId (se houver) e limpa o legacy.
  _lazyMigrateLegacyToBranch(productId, campaignId) {
    const map = this.getForProduct(productId);
    if (!map?.objectives?.length) return;
    if (!campaignId) return;
    const branch = this.getBranchMap(campaignId);
    if (branch && (branch.objectives || []).length > 0) return;  // já migrou ou branch já tem dados
    // Migra: copia objectives + okrs (com parentProductKrId: null) pra branch.
    const objectivesCopy = (map.objectives || []).map(o => ({
      ...o,
      okrs: (o.okrs || []).map(kr => ({ ...kr, parentProductKrId: kr.parentProductKrId || null }))
    }));
    this.ensureBranchMap(campaignId, productId);
    this.saveBranchMap(campaignId, { objectives: objectivesCopy });
    // Limpa legacy.
    this.save(productId, { objectives: [] });
  }
};
