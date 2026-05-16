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
    { id: 'marketing', label: 'Marketing', icon: 'megaphone', color: 'sky',     description: 'Em definição minimalista, Marketing tem o objetivo de transformar um público suspeito em um potencial comprador (lead).' },
    { id: 'sales',     label: 'Vendas',    icon: 'handshake', color: 'emerald', description: 'Em definição minimalista, Vendas tem o objetivo de transformar um potencial comprador (lead) em um cliente.' },
    { id: 'cs',        label: 'Sucesso do Cliente', icon: 'heart', color: 'violet', description: 'Em definição minimalista, Sucesso do Cliente tem o objetivo de transformar um cliente em um advogado da marca.' }
  ],

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
