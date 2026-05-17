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
    // V27.0.0 — Adicionado commitmentType (stretch/committed) e startValue
    // pra scoring 0.0-1.0 conforme Doerr.
    // V28.2 — catalogId/catalogDescription/isHandoff vindos do catálogo guiado.
    const okr = {
      id: `okr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: String(draft?.name || '').trim() || 'Key Result sem nome',
      metric: String(draft?.metric || 'leads'),
      target: Number(draft?.target || 0),
      current: Number(draft?.current || 0),
      startValue: Number(draft?.startValue || draft?.current || 0), // V27 — baseline pro scoring
      commitmentType: draft?.commitmentType === 'committed' ? 'committed' : 'stretch', // V27 — Doerr type
      deadline: draft?.deadline || null,
      owner: String(draft?.owner || '').trim(),
      impact: String(draft?.impact || '').trim(),
      catalogId: draft?.catalogId || null,                       // V28.2
      catalogDescription: draft?.catalogDescription || null,     // V28.2
      isHandoff: Boolean(draft?.isHandoff),                      // V28.2
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

  // V27.0.0 — Auto-score 0.0–1.0 conforme Doerr.
  // Fórmula: (current - startValue) / (target - startValue)
  // Clamp em [0, 1]. Suporta start=0 (linear simples).
  score(okr) {
    const target = Number(okr.target || 0);
    const current = Number(okr.current || 0);
    const start = Number(okr.startValue || 0);
    if (target === start) return 0;
    const raw = (current - start) / (target - start);
    return Math.max(0, Math.min(1, raw));
  },

  // V27.0.0 — Status do score considerando commitmentType.
  // Stretch: 0.7+ = sucesso (regra Doerr); Committed: precisa 1.0.
  scoreStatus(okr) {
    const s = this.score(okr);
    const stretch = okr.commitmentType !== 'committed';
    if (stretch) {
      if (s >= 0.7) return { tier: 'success', color: 'emerald', label: 'Atingido (stretch ≥ 0.7)' };
      if (s >= 0.4) return { tier: 'progress', color: 'amber', label: 'Em progresso' };
      return { tier: 'risk', color: 'red', label: 'Em risco' };
    }
    // committed
    if (s >= 1.0) return { tier: 'success', color: 'emerald', label: 'Entregue' };
    if (s >= 0.7) return { tier: 'progress', color: 'amber', label: 'Próximo (committed exige 1.0)' };
    return { tier: 'risk', color: 'red', label: 'Não cumprido (committed)' };
  },

  _patchObjective(productId, objectiveId, patcher) {
    const map = StrategicMapEngine.getForProduct(productId);
    const objectives = (map.objectives || []).map(o => o.id === objectiveId ? patcher(o) : o);
    StrategicMapEngine.save(productId, { objectives });
  }
};
