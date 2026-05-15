// V19 — Score History Engine
// Snapshot do score por lead + campanha. Cap em 12 pontos. Calcula momentum
// (slope dos últimos 5 pontos). Trend: ↑ ↗ → ↘ ↓.
window.ScoreHistoryEngine = {
  MAX_POINTS: 12,

  push(lead, campaignId, snapshot) {
    const key = this._key(lead, campaignId);
    if (!key) return;
    const all = App.state.leadScoreHistory || {};
    const current = Array.isArray(all[key]) ? all[key] : [];
    const next = [...current, { ts: new Date().toISOString(), ...snapshot }].slice(-this.MAX_POINTS);
    App.state.leadScoreHistory = { ...all, [key]: next };
  },

  historyFor(lead, campaignId) {
    const key = this._key(lead, campaignId);
    if (!key) return [];
    return (App.state.leadScoreHistory || {})[key] || [];
  },

  momentumFor(lead, campaignId) {
    const h = this.historyFor(lead, campaignId);
    if (h.length < 2) return 0;
    const last5 = h.slice(-5);
    // Slope linear de revenueScore
    const xs = last5.map((_, i) => i);
    const ys = last5.map(p => Number(p.revenueScore || 0));
    return Math.round(this._slope(xs, ys));
  },

  trendArrow(lead, campaignId) {
    const m = this.momentumFor(lead, campaignId);
    if (m >= 8) return { icon: 'trending-up', label: '↑↑', tone: 'emerald' };
    if (m >= 3) return { icon: 'arrow-up-right', label: '↗', tone: 'emerald' };
    if (m <= -8) return { icon: 'trending-down', label: '↓↓', tone: 'red' };
    if (m <= -3) return { icon: 'arrow-down-right', label: '↘', tone: 'amber' };
    return { icon: 'arrow-right', label: '→', tone: 'slate' };
  },

  _slope(xs, ys) {
    const n = xs.length;
    if (n < 2) return 0;
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i += 1) {
      num += (xs[i] - meanX) * (ys[i] - meanY);
      den += (xs[i] - meanX) ** 2;
    }
    return den ? num / den : 0;
  },

  _key(lead, campaignId) {
    const leadKey = String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
    if (!leadKey) return null;
    return `${campaignId || 0}:${leadKey}`;
  }
};
