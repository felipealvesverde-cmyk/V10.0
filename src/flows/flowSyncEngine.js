// V15.1 — Flow Sync Engine
// Orquestra a movimentação real do lead pelo fluxo. Não dispara nada por
// conta própria — é invocado pelo RdCrmSyncEngine (5min) ou pelo tracker
// V15 quando recebe eventos da LP.
window.FlowSyncEngine = {
  syncAction(actionId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return { ok: false, message: 'Ação não encontrada.' };
    const enriched = FlowEngine.ensureActionFlow(action);
    if (!enriched.flow.enabled) return { ok: true, skipped: true };
    const metrics = FlowConversionEngine.actionMetrics(enriched);
    if (window.RdCrmActionMapper && RdCrmActionMapper.isMapped(enriched)) {
      RdCrmActionMapper.syncAction(enriched);
    }
    return { ok: true, metrics };
  },

  syncCampaign(campaignId) {
    const actions = (App.state.actions || []).filter(a => Number(a.campaignId) === Number(campaignId));
    const results = actions.map(a => this.syncAction(a.id));
    return { ok: true, results };
  },

  syncAll() {
    const campaigns = App.state.campaigns || [];
    return campaigns.map(c => ({ campaignId: c.id, ...this.syncCampaign(c.id) }));
  },

  bridgeFromTrackingEvent(payload = {}) {
    // Chamado pelo eventCollector (V15) quando um evento aprovado dispara
    // checkpoint. Aplica score + propaga para próxima ação se houver.
    const actionId = payload.actionId;
    const leadKey = payload.leadIdentityKey;
    if (!actionId || !leadKey) return { ok: false };
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return { ok: false };
    const enriched = FlowEngine.ensureActionFlow(action);
    for (const nextId of (enriched.flow.nextActions || [])) {
      const next = (App.state.actions || []).find(a => Number(a.id) === Number(nextId));
      if (!next) continue;
      const delta = FlowLeadScoringBridge.scoreTraversal(enriched, FlowEngine.ensureActionFlow(next));
      payload.scoreDelta = (payload.scoreDelta || 0) + delta;
    }
    return { ok: true, scoreDelta: payload.scoreDelta || 0 };
  }
};
