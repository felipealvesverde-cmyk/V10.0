// V17 — Strategic Objective Engine
// CRUD de objetivos estratégicos dentro do mapa de um produto. Cada objetivo
// agrupa OKRs e pode ser conectado a campanhas/fluxos.
window.StrategicObjectiveEngine = {
  list(productId) {
    return (StrategicMapEngine.getForProduct(productId)?.objectives) || [];
  },

  add(productId, draft) {
    const map = StrategicMapEngine.ensure(productId);
    const objective = {
      id: `obj_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      label: String(draft?.label || '').trim() || 'Objetivo sem nome',
      owner: String(draft?.owner || '').trim(),
      deadline: draft?.deadline || null,
      okrs: [],
      createdAt: new Date().toISOString()
    };
    StrategicMapEngine.save(productId, { objectives: [...(map.objectives || []), objective] });
    return objective;
  },

  update(productId, objectiveId, patch) {
    const map = StrategicMapEngine.getForProduct(productId);
    const objectives = (map.objectives || []).map(o => o.id === objectiveId ? { ...o, ...patch } : o);
    StrategicMapEngine.save(productId, { objectives });
  },

  remove(productId, objectiveId) {
    const map = StrategicMapEngine.getForProduct(productId);
    const objectives = (map.objectives || []).filter(o => o.id !== objectiveId);
    StrategicMapEngine.save(productId, { objectives });
  }
};
