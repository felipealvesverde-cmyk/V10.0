// V19 — Outcome Tracker
// Captura ground truth (lead converteu? won/lost/no-decision) e expõe para
// CalibrationCurveEngine. Sem outcome, modelo é palpite organizado.
window.OutcomeTracker = {
  VALID: new Set(['won', 'lost', 'no-decision', 'in-progress']),

  mark(leadKey, campaignId, outcome, meta) {
    const valid = this.VALID.has(outcome) ? outcome : 'in-progress';
    const key = `${campaignId || 0}:${this._normalize(leadKey)}`;
    const all = App.state.leadOutcomes || {};
    App.state.leadOutcomes = {
      ...all,
      [key]: {
        outcome: valid,
        ts: new Date().toISOString(),
        campaignId: Number(campaignId) || null,
        amount: meta?.amount || null,
        reason: meta?.reason || null
      }
    };
    return App.state.leadOutcomes[key];
  },

  get(leadKey, campaignId) {
    const key = `${campaignId || 0}:${this._normalize(leadKey)}`;
    return (App.state.leadOutcomes || {})[key] || null;
  },

  forCampaign(campaignId) {
    const all = App.state.leadOutcomes || {};
    const prefix = `${Number(campaignId) || 0}:`;
    return Object.entries(all)
      .filter(([k]) => k.startsWith(prefix))
      .map(([k, v]) => ({ key: k.slice(prefix.length), ...v }));
  },

  conversionRate(campaignId) {
    const outcomes = this.forCampaign(campaignId).filter(o => o.outcome !== 'in-progress');
    if (!outcomes.length) return null;
    const won = outcomes.filter(o => o.outcome === 'won').length;
    return Math.round((won / outcomes.length) * 100);
  },

  _normalize(leadKey) {
    return String(leadKey || '').toLowerCase().trim();
  }
};
