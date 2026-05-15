// V19 — Lifecycle Engine
// Stages: subscriber → MQL → MQA → SAL → SQL → opportunity → customer.
// Transição automática por score + sinais explícitos. SLA por stage (dias até
// próximo movimento esperado). LeadRecyclingEngine usa para detectar stale.
window.LifecycleEngine = {
  STAGES: [
    { id: 'subscriber',  label: 'Subscriber',  order: 0, slaDays: null },
    { id: 'mql',         label: 'MQL',         order: 1, slaDays: 14 },
    { id: 'mqa',         label: 'MQA',         order: 2, slaDays: 7 },
    { id: 'sal',         label: 'SAL',         order: 3, slaDays: 3 },
    { id: 'sql',         label: 'SQL',         order: 4, slaDays: 14 },
    { id: 'opportunity', label: 'Oportunidade', order: 5, slaDays: 30 },
    { id: 'customer',    label: 'Cliente',     order: 6, slaDays: null }
  ],

  stageById(id) {
    return this.STAGES.find(s => s.id === id) || this.STAGES[0];
  },

  // Sugere stage com base em fit/intent/revScore. Não força transição — UI mostra sugestão.
  suggestStage(scored) {
    if (!scored) return 'subscriber';
    const { fit = 0, intent = 0, revenueScore = 0, lead } = scored;
    const current = lead?.lifecycleStage || 'subscriber';
    if (revenueScore >= 80 && intent >= 60) return 'sql';
    if (revenueScore >= 65) return 'sal';
    if (revenueScore >= 50) return 'mqa';
    if (revenueScore >= 35 && fit >= 35) return 'mql';
    return current === 'subscriber' ? 'subscriber' : current;
  },

  transition(lead, newStageId) {
    if (!lead) return null;
    return {
      ...lead,
      lifecycleStage: newStageId,
      lifecycleStageAt: new Date().toISOString()
    };
  },

  daysInStage(lead) {
    if (!lead?.lifecycleStageAt) return null;
    return Math.floor((Date.now() - new Date(lead.lifecycleStageAt).getTime()) / (24 * 3600 * 1000));
  },

  isStale(lead) {
    const stage = this.stageById(lead?.lifecycleStage || 'subscriber');
    if (!stage.slaDays) return false;
    const days = this.daysInStage(lead);
    return days !== null && days > stage.slaDays;
  }
};
