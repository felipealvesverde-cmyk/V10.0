// V17 — Strategic OKR Engine
// CRUD de OKRs dentro de cada objetivo estratégico. Cada OKR pode estar
// vinculado a actions (que atualizam current via KPIs/Revenue), formando a
// cadeia estratégia → execução → receita.
window.StrategicOkrEngine = {
  list(productId, objectiveId) {
    const obj = (StrategicMapEngine.getForProduct(productId)?.objectives || []).find(o => o.id === objectiveId);
    return obj?.okrs || [];
  },

  add(productId, objectiveId, draft, campaignId) {
    // V27.0.0 — Adicionado commitmentType (stretch/committed) e startValue
    // pra scoring 0.0-1.0 conforme Doerr.
    // V28.2 — catalogId/catalogDescription/isHandoff vindos do catálogo guiado.
    // V28.2.1 — Toda número tem PAR de metas: targetCommitted (segura, piso)
    // + targetStretch (avançada, sonho). E `period` em dias substitui deadline livre.
    // V29.0.0 — Aceita campaignId opcional (escreve na branch certa) + parentProductKrId
    // pra vincular ao KR-mãe pra rollup.
    const targetCommitted = draft?.targetCommitted != null ? Number(draft.targetCommitted) : (draft?.target != null ? Number(draft.target) : null);
    const targetStretch = draft?.targetStretch != null ? Number(draft.targetStretch) : null;
    const period = draft?.period != null ? Number(draft.period) : null;
    const currentRaw = draft?.current;
    const current = (currentRaw === null || currentRaw === undefined || currentRaw === '') ? null : Number(currentRaw);
    const okr = {
      id: `okr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: String(draft?.name || '').trim() || 'Key Result sem nome',
      metric: String(draft?.metric || 'leads'),
      current,
      targetCommitted,                                                    // V28.2.1 meta segura
      targetStretch,                                                      // V28.2.1 meta avançada
      target: targetCommitted ?? 0,                                       // compat (= targetCommitted)
      period,                                                             // V28.2.1 dias (7/15/30/90/180)
      confirmed: Boolean(draft?.confirmed),                               // V28.2.1
      startValue: Number(draft?.startValue ?? current ?? 0),
      commitmentType: 'committed',                                        // legado — todo KR tem ambas metas agora
      deadline: draft?.deadline || (period ? this._computeDeadline(period) : null),
      owner: String(draft?.owner || '').trim(),
      impact: String(draft?.impact || '').trim(),
      catalogId: draft?.catalogId || null,
      catalogDescription: draft?.catalogDescription || null,
      isHandoff: Boolean(draft?.isHandoff),
      parentProductKrId: draft?.parentProductKrId || null,                // V29.0.0 — rollup
      connectedActionIds: Array.isArray(draft?.connectedActionIds) ? draft.connectedActionIds.map(Number) : [],
      createdAt: new Date().toISOString()
    };
    this._patchObjective(productId, objectiveId, o => ({ ...o, okrs: [...(o.okrs || []), okr] }), campaignId);
    return okr;
  },

  update(productId, objectiveId, okrId, patch, campaignId) {
    this._patchObjective(productId, objectiveId, o => ({ ...o, okrs: (o.okrs || []).map(kr => kr.id === okrId ? { ...kr, ...patch } : kr) }), campaignId);
  },

  remove(productId, objectiveId, okrId, campaignId) {
    this._patchObjective(productId, objectiveId, o => ({ ...o, okrs: (o.okrs || []).filter(kr => kr.id !== okrId) }), campaignId);
  },

  toggleAction(productId, objectiveId, okrId, actionId, campaignId) {
    const numId = Number(actionId);
    this._patchObjective(productId, objectiveId, o => ({
      ...o,
      okrs: (o.okrs || []).map(kr => {
        if (kr.id !== okrId) return kr;
        const current = Array.isArray(kr.connectedActionIds) ? kr.connectedActionIds.map(Number) : [];
        const exists = current.includes(numId);
        return { ...kr, connectedActionIds: exists ? current.filter(id => id !== numId) : [...current, numId] };
      })
    }), campaignId);
  },

  progress(okr) {
    // V28.2.1 — % vs. Meta Segura (committed = piso obrigatório).
    const target = Number(okr.targetCommitted ?? okr.target ?? 0);
    if (!target) return 0;
    const current = Number(okr.current ?? 0);
    return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
  },

  // V28.2.1 — Score 0.0–1.0 vs. Meta Avançada (stretch = sonho Doerr).
  // Fórmula: (current - startValue) / (targetStretch - startValue), clamp [0, 1].
  score(okr) {
    const target = Number(okr.targetStretch ?? okr.target ?? 0);
    const current = Number(okr.current ?? 0);
    const start = Number(okr.startValue ?? 0);
    if (target === start) return 0;
    return Math.max(0, Math.min(1, (current - start) / (target - start)));
  },

  // V28.2.1 — Status leva em conta as duas metas.
  // - Bateu a Avançada (score >= 1.0): success
  // - Bateu a Segura (progress >= 100%): success-soft
  // - Acima de 70% da Segura: em progresso
  // - Abaixo: risco
  scoreStatus(okr) {
    const prog = this.progress(okr);
    const sc = this.score(okr);
    if (sc >= 1.0) return { tier: 'success', color: 'emerald', label: 'Bateu a Meta Avançada 🚀' };
    if (prog >= 100) return { tier: 'success', color: 'emerald', label: 'Bateu a Meta Segura ✓' };
    if (prog >= 70) return { tier: 'progress', color: 'amber', label: 'Em progresso' };
    return { tier: 'risk', color: 'red', label: 'Em risco' };
  },

  // V28.2.1 — Checa se o número tem todos os campos pra ser confirmado.
  isComplete(okr) {
    return okr.current !== null && okr.current !== undefined
      && Number(okr.targetCommitted ?? 0) > 0
      && Number(okr.targetStretch ?? 0) > 0
      && Number(okr.period ?? 0) > 0;
  },

  _computeDeadline(periodDays) {
    const d = new Date();
    d.setDate(d.getDate() + Number(periodDays));
    return d.toISOString().split('T')[0];
  },

  _patchObjective(productId, objectiveId, patcher, campaignId) {
    // V29.0.0 — Se há campaignId (ou strategicCampaignId ativo), escreve no branch.
    // Senão, fallback no legacy strategicMaps[productId].objectives.
    const targetCampaignId = campaignId || StrategicMapEngine._getActiveCampaignId(productId);
    if (targetCampaignId && StrategicMapEngine.getBranchMap(targetCampaignId)) {
      const branch = StrategicMapEngine.getBranchMap(targetCampaignId);
      const objectives = (branch.objectives || []).map(o => o.id === objectiveId ? patcher(o) : o);
      StrategicMapEngine.saveBranchMap(targetCampaignId, { objectives });
      return;
    }
    const map = StrategicMapEngine.getForProduct(productId);
    const objectives = (map.objectives || []).map(o => o.id === objectiveId ? patcher(o) : o);
    StrategicMapEngine.save(productId, { objectives });
  }
};
