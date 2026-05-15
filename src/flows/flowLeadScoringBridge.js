// V15.1 — Lead Scoring Bridge para fluxos
// Cada travessia entre ações soma score. Plug & play: invocado pelo
// FlowSyncEngine quando detecta movimentação de lead, e pelo Tracking V15
// quando dispara um checkpoint que move o lead.
window.FlowLeadScoringBridge = {
  WEIGHTS: {
    traversal: 5,
    checkpoint: 3,
    finalConversion: 25,
    actionTypeBonus: {
      lp: 2,
      email: 1,
      sdr: 5,
      whatsapp: 3,
      webinar: 8,
      checkout: 12,
      crm: 6,
      cs: 4,
      channel: 1
    }
  },

  scoreTraversal(fromAction, toAction) {
    if (!fromAction || !toAction) return 0;
    const baseDelta = this.WEIGHTS.traversal;
    const bonus = this.WEIGHTS.actionTypeBonus[toAction.flow?.flowActionType] || 0;
    return baseDelta + bonus;
  },

  scoreCheckpoint(checkpoint) {
    const explicit = Number(checkpoint?.scoreDelta || 0);
    return explicit || this.WEIGHTS.checkpoint;
  },

  scoreFinalConversion(action) {
    return this.WEIGHTS.finalConversion + (this.WEIGHTS.actionTypeBonus[action?.flow?.flowActionType] || 0);
  },

  applyDelta(lead, delta) {
    if (!lead || !delta) return lead;
    const base = Number(lead.score || lead.globalScore || 0);
    const next = Math.min(100, base + delta);
    return { ...lead, score: next, globalScore: next, flowScoreDelta: (Number(lead.flowScoreDelta || 0) + delta) };
  }
};
