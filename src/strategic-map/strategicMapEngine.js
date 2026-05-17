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
      period: null,
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
