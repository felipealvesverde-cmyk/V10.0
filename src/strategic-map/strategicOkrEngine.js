// V17 — Strategic OKR Engine
// CRUD de OKRs dentro de cada objetivo estratégico. Cada OKR pode estar
// vinculado a actions (que atualizam current via KPIs/Revenue), formando a
// cadeia estratégia → execução → receita.
window.StrategicOkrEngine = {
  list(productId, objectiveId) {
    const obj = (StrategicMapEngine.getForProduct(productId)?.objectives || []).find(o => o.id === objectiveId);
    return obj?.okrs || [];
  },

  add(productId, objectiveId, draft) {
    const okr = {
      id: `okr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: String(draft?.name || '').trim() || 'OKR sem nome',
      metric: String(draft?.metric || 'leads'),
      target: Number(draft?.target || 0),
      current: Number(draft?.current || 0),
      deadline: draft?.deadline || null,
      owner: String(draft?.owner || '').trim(),
      impact: String(draft?.impact || '').trim(),
      connectedActionIds: Array.isArray(draft?.connectedActionIds) ? draft.connectedActionIds.map(Number) : [],
      createdAt: new Date().toISOString()
    };
    this._patchObjective(productId, objectiveId, o => ({ ...o, okrs: [...(o.okrs || []), okr] }));
    return okr;
  },

  update(productId, objectiveId, okrId, patch) {
    this._patchObjective(productId, objectiveId, o => ({ ...o, okrs: (o.okrs || []).map(kr => kr.id === okrId ? { ...kr, ...patch } : kr) }));
  },

  remove(productId, objectiveId, okrId) {
    this._patchObjective(productId, objectiveId, o => ({ ...o, okrs: (o.okrs || []).filter(kr => kr.id !== okrId) }));
  },

  toggleAction(productId, objectiveId, okrId, actionId) {
    const numId = Number(actionId);
    this._patchObjective(productId, objectiveId, o => ({
      ...o,
      okrs: (o.okrs || []).map(kr => {
        if (kr.id !== okrId) return kr;
        const current = Array.isArray(kr.connectedActionIds) ? kr.connectedActionIds.map(Number) : [];
        const exists = current.includes(numId);
        return { ...kr, connectedActionIds: exists ? current.filter(id => id !== numId) : [...current, numId] };
      })
    }));
  },

  progress(okr) {
    const target = Number(okr.target || 0);
    if (!target) return 0;
    const current = Number(okr.current || 0);
    return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
  },

  _patchObjective(productId, objectiveId, patcher) {
    const map = StrategicMapEngine.getForProduct(productId);
    const objectives = (map.objectives || []).map(o => o.id === objectiveId ? patcher(o) : o);
    StrategicMapEngine.save(productId, { objectives });
  }
};
