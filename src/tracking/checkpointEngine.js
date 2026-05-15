// V15 — Tracking Checkpoint Engine
// Recebe um evento já enriquecido (com leadIdentityKey resolvido), procura
// a ação LP correspondente pelo trackingId, varre os checkpoints daquela
// ação e dispara o que casar com o evento. Movimenta o lead, aplica tag,
// pontua via FlowLeadScoringBridge e sincroniza RD CRM.
window.TrackingCheckpointEngine = {
  processEvent(event) {
    if (!event || !event.trackingId || !event.eventType) return { fired: false };
    const registry = App.state.lpRegistry || {};
    const lpEntry = Object.values(registry).find(e => e.trackingId === event.trackingId);
    if (!lpEntry) return { fired: false, reason: 'LP não cadastrada para este trackingId.' };
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(lpEntry.actionId));
    if (!action || !action.flow) return { fired: false, reason: 'Ação não encontrada.' };
    const flow = action.flow;
    const matched = (flow.checkpoints || []).filter(c => c.event === event.eventType);
    if (!matched.length) return { fired: false, reason: 'Nenhum checkpoint corresponde.' };
    const leadKey = event.leadIdentityKey;
    let fired = false;
    for (const checkpoint of matched) {
      const result = FlowCheckpointEngine.triggerCheckpoint(action, checkpoint, leadKey);
      if (result?.ok) fired = true;
      if (checkpoint.moveToStage && lpEntry.syncRdActive && window.RdCrmMovementEngine) {
        RdCrmMovementEngine.moveLeadToStage(leadKey, checkpoint.moveToStage, action.campaignId);
      }
      if (window.RevenueEventBridge) RevenueEventBridge.recordPassage(action, checkpoint, leadKey);
    }
    if (fired && window.FlowSyncEngine) FlowSyncEngine.bridgeFromTrackingEvent({ actionId: action.id, leadIdentityKey: leadKey });
    return { fired, action: action.id, leadKey };
  }
};
