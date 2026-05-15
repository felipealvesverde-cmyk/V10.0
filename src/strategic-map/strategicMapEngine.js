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
  }
};
