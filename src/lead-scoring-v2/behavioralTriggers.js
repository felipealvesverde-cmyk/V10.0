// V19 — Behavioral Triggers
// Detecta variações grandes de score entre 2 snapshots consecutivos e emite
// "eventos de gatilho" — UI mostra notificação; futuro: webhook/automação.
window.BehavioralTriggers = {
  SURGE_THRESHOLD: 20,
  DECAY_THRESHOLD: -15,

  detectFor(lead, campaignId) {
    if (!window.ScoreHistoryEngine) return [];
    const history = ScoreHistoryEngine.historyFor(lead, campaignId);
    if (history.length < 2) return [];
    const last = history[history.length - 1];
    const prev = history[history.length - 2];
    const delta = (Number(last.revenueScore) || 0) - (Number(prev.revenueScore) || 0);
    const triggers = [];
    if (delta >= this.SURGE_THRESHOLD) triggers.push({ type: 'surge', delta, message: `Surge: +${delta} pts. Lead aqueceu rápido — abordar agora.` });
    if (delta <= this.DECAY_THRESHOLD) triggers.push({ type: 'decay', delta, message: `Decay: ${delta} pts. Engagement esfriou — acelerar nurture.` });
    if (last.revenueReady && !prev.revenueReady) triggers.push({ type: 'revenue-ready', delta, message: `Lead acabou de virar Revenue Ready.` });
    return triggers;
  },

  collectForCampaign(classified, campaignId) {
    const out = [];
    for (const c of (classified || [])) {
      const t = this.detectFor(c.lead, campaignId);
      for (const trigger of t) out.push({ ...trigger, lead: c.lead });
    }
    return out;
  }
};
