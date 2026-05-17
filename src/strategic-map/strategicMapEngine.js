// V17 — Strategic Map Engine
// Núcleo do Mapa da Receita: mantém o documento estratégico de cada produto
// (visão, objetivos, OKRs, conexões com fluxos). Persiste em
// App.state.strategicMaps[productId]. Não faz UI — apenas leitura/escrita.
window.StrategicMapEngine = {
  defaultMap(productId) {
    return {
      productId: Number(productId),
      vision: '',
      objectives: [],
      flowConnections: [],
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

  currentStepId(productId) {
    const progress = this.journeyProgress(productId);
    const order = ['vision', 'objectives', 'okrs', 'operations', 'execution'];
    for (const step of order) if (!progress[step]) return step;
    return 'execution';
  },

  // V28.1 — As 3 frentes do funil (RevOps minimalista).
  COMERCIAL_AREAS: [
    { id: 'marketing', label: 'Marketing', icon: 'megaphone', color: 'sky',     description: 'Em definição minimalista, Marketing tem o objetivo de transformar um público suspeito em um potencial comprador (lead).', handoff: 'Entrega leads pra Vendas' },
    { id: 'sales',     label: 'Vendas',    icon: 'handshake', color: 'emerald', description: 'Em definição minimalista, Vendas tem o objetivo de transformar um potencial comprador (lead) em um cliente.', handoff: 'Entrega clientes pra CS' },
    { id: 'cs',        label: 'Sucesso do Cliente', icon: 'heart', color: 'violet', description: 'Em definição minimalista, Sucesso do Cliente tem o objetivo de transformar um cliente em um advogado da marca.', handoff: 'Devolve advogados pro topo do funil' }
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
      // Marca como host estratégico (visual diferenciado).
      App.state.campaigns = App.state.campaigns.map(c =>
        Number(c.id) === Number(existing.id) ? { ...c, isStrategicHost: true } : c
      );
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

  // V28.4.1 — Migração one-shot: mescla campanhas estratégicas duplicadas do mesmo
  // produto numa só. Mantém a primeira (mais antiga), move ações das outras pra ela,
  // remove as duplicadas. Seta strategicCampaignId se o map ainda não tinha.
  // Detecção: isStrategicHost OR nome começa com "Mapa da Receita".
  migrateLegacyStrategicCampaigns(productId) {
    const all = (App.state.campaigns || []).filter(c =>
      Number(c.productId) === Number(productId) &&
      (c.isStrategicHost === true || String(c.name || '').startsWith('Mapa da Receita'))
    );
    if (all.length <= 1) {
      // Se tem só 1 e o map ainda não aponta pra ela, vincula.
      if (all.length === 1) {
        const map = this.getForProduct(productId);
        if (!map?.strategicCampaignId) this.save(productId, { strategicCampaignId: Number(all[0].id) });
        // Garante flag
        App.state.campaigns = (App.state.campaigns || []).map(c =>
          Number(c.id) === Number(all[0].id) ? { ...c, isStrategicHost: true } : c
        );
      }
      return 0;
    }
    // Ordena por createdAt asc (mais antiga primeiro) — ela é a "keeper".
    all.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    const keeper = all[0];
    const duplicateIds = new Set(all.slice(1).map(c => Number(c.id)));
    // Move ações pras keeper.
    App.state.actions = (App.state.actions || []).map(a =>
      duplicateIds.has(Number(a.campaignId)) ? { ...a, campaignId: Number(keeper.id) } : a
    );
    // Remove campanhas duplicadas.
    App.state.campaigns = (App.state.campaigns || []).filter(c => !duplicateIds.has(Number(c.id)));
    // Garante flag e nome da keeper.
    App.state.campaigns = App.state.campaigns.map(c =>
      Number(c.id) === Number(keeper.id) ? { ...c, isStrategicHost: true } : c
    );
    // Vincula no map.
    this.save(productId, { strategicCampaignId: Number(keeper.id) });
    return duplicateIds.size;
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
      destinationSector: template.destinationSector,
      destinationFunnel: template.destinationFunnel,
      status: 'Rascunho estratégico',
      isDraft: true,
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
  getStrategicActionsByArea(productId, areaId) {
    const campaignIds = new Set((App.state.campaigns || []).filter(c => Number(c.productId) === Number(productId)).map(c => Number(c.id)));
    return (App.state.actions || []).filter(a =>
      campaignIds.has(Number(a.campaignId)) && a.strategicAreaId === areaId
    );
  },

  // V28.3 — IDs do catálogo já ativados na área (pra UI marcar/desabilitar).
  getActivatedCatalogActionIds(productId, areaId) {
    return new Set(this.getStrategicActionsByArea(productId, areaId).map(a => a.strategicCatalogId).filter(Boolean));
  },

  // V28.3 — KRs confirmados que não têm NENHUMA ação vinculada (alerta visual).
  getKrsWithoutActions(productId, areaId) {
    const obj = this.getObjectiveByArea(productId, areaId);
    return (obj?.okrs || []).filter(kr => kr.confirmed && !(kr.connectedActionIds || []).length);
  },

  // V28.2 — Ativa um KPI do catálogo como um novo número vazio (metas a preencher).
  // V28.2.1 — current começa null (input vazio) em vez de 0.
  activateCatalogKpi(productId, areaId, kpiId) {
    const kpi = (this.KPI_CATALOG[areaId] || []).find(k => k.id === kpiId);
    const objective = this.getObjectiveByArea(productId, areaId);
    if (!kpi || !objective || !window.StrategicOkrEngine) return null;
    return StrategicOkrEngine.add(productId, objective.id, {
      name: kpi.name,
      metric: kpi.metric,
      catalogId: kpi.id,
      catalogDescription: kpi.description,
      isHandoff: Boolean(kpi.handoff),
      current: null,
      targetCommitted: null,
      targetStretch: null,
      period: 90, // V28.2.3 — Período Tático default = trimestre (Doerr-aligned)
      confirmed: false
    });
  },

  // V28.2 — IDs do catálogo já ativados nesta área (pra UI marcar/desabilitar).
  getActivatedCatalogIds(productId, areaId) {
    const objective = this.getObjectiveByArea(productId, areaId);
    return new Set((objective?.okrs || []).map(kr => kr.catalogId).filter(Boolean));
  },

  // V28.2.1 — Próximo número a confirmar, varrendo as 3 áreas em ordem.
  // Retorna {objectiveId, krId} ou null se não há mais nenhum incompleto.
  nextUnconfirmedKr(productId) {
    const areas = this.COMERCIAL_AREAS;
    for (const area of areas) {
      const obj = this.getObjectiveByArea(productId, area.id);
      if (!obj) continue;
      for (const kr of (obj.okrs || [])) {
        if (!kr.confirmed) return { objectiveId: obj.id, krId: kr.id, areaId: area.id };
      }
    }
    return null;
  },

  // V28.2.1 — Todos os números das 3 áreas estão confirmados?
  allKrsConfirmed(productId) {
    const objectives = (this.getForProduct(productId)?.objectives) || [];
    const krs = objectives.flatMap(o => o.okrs || []);
    return krs.length > 0 && krs.every(kr => kr.confirmed);
  },

  // V28.1 — Garante que as 3 áreas existam como objetivos.
  // Migração V28→V28.1: se já houver 3+ objetivos sem area, adota os 3 primeiros
  // como marketing/sales/cs na ordem (preserva label/owner/deadline/okrs do user).
  // Seeda áreas faltantes com defaults vazios.
  ensureComercialAreas(productId) {
    const map = this.ensure(productId);
    let objectives = [...(map.objectives || [])];
    const areaIds = this.COMERCIAL_AREAS.map(a => a.id);
    const existingAreas = new Set(objectives.filter(o => o.area).map(o => o.area));

    // Migração: adota os primeiros 3 sem area como marketing/sales/cs.
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

    // Seed: cria stubs vazios pras áreas faltantes.
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

    this.save(productId, { objectives });
    return objectives;
  },

  getObjectiveByArea(productId, areaId) {
    const map = this.getForProduct(productId);
    return (map.objectives || []).find(o => o.area === areaId) || null;
  }
};
