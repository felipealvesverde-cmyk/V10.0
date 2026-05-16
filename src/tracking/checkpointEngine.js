// V15 — Tracking Checkpoint Engine
// Recebe um evento já enriquecido (com leadIdentityKey resolvido), procura
// a ação LP correspondente pelo trackingId, varre os checkpoints daquela
// ação e dispara o que casar com o evento. Movimenta o lead, aplica tag,
// pontua via FlowLeadScoringBridge e sincroniza RD CRM.
//
// V24.0.0 — Eventos de conversão (form submit) agora disparam o
// RdCrmConversionBridge ANTES dos checkpoints: cria contato + deal no RD
// e tagueia conforme o startStage da ação. Isso fecha o gap entre o pixel
// e o CRM: lead novo entra direto no funil correto, scoring inicial aplicado.
window.TrackingCheckpointEngine = {
  async processEvent(event) {
    if (!event || !event.trackingId || !event.eventType) return { fired: false };
    const registry = App.state.lpRegistry || {};
    const lpEntry = Object.values(registry).find(e => e.trackingId === event.trackingId);
    if (!lpEntry) return { fired: false, reason: 'LP não cadastrada para este trackingId.' };
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(lpEntry.actionId));
    if (!action || !action.flow) return { fired: false, reason: 'Ação não encontrada.' };
    // V24.0.0 — Conversão: cria contato/deal/tag no RD antes de qualquer checkpoint.
    let conversionResult = null;
    if (window.RdCrmConversionBridge?.isConversionEvent?.(event.eventType) && lpEntry.syncRdActive) {
      try {
        conversionResult = await RdCrmConversionBridge.handle(event, lpEntry, action);
      } catch (e) {
        conversionResult = { ok: false, reason: 'exception', message: e?.message || String(e) };
      }
    }
    const flow = action.flow;
    const matched = (flow.checkpoints || []).filter(c => c.event === event.eventType);
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
    return { fired, action: action.id, leadKey, conversion: conversionResult };
  }
};
