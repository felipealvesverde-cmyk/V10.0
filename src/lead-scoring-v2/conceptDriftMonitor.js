// V19 — Concept Drift Monitor
// Acompanha a distribuição de scores ao longo do tempo. Se média ou variância
// mudam >25% vs baseline, dispara alerta — modelo provavelmente precisa retreinar
// (ou pesos não refletem mais a realidade).
window.ConceptDriftMonitor = {
  recordBaseline(campaignId, distribution) {
    if (!distribution || !distribution.length) return;
    const stats = this._statsOf(distribution);
    const all = App.state.driftBaselines || {};
    App.state.driftBaselines = { ...all, [campaignId]: { ...stats, capturedAt: new Date().toISOString() } };
  },

  detectDrift(campaignId, currentDistribution) {
    const baseline = (App.state.driftBaselines || {})[campaignId];
    if (!baseline || !currentDistribution || !currentDistribution.length) return { drift: false };
    const current = this._statsOf(currentDistribution);
    const meanDelta = baseline.mean ? Math.abs((current.mean - baseline.mean) / baseline.mean) : 0;
    const stdDelta = baseline.std ? Math.abs((current.std - baseline.std) / baseline.std) : 0;
    const drift = meanDelta > 0.25 || stdDelta > 0.4;
    return {
      drift,
      meanDelta: Math.round(meanDelta * 100),
      stdDelta: Math.round(stdDelta * 100),
      baseline,
      current
    };
  },

  _statsOf(arr) {
    const n = arr.length;
    const mean = arr.reduce((s, v) => s + v, 0) / n;
    const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    return { n, mean: Math.round(mean * 100) / 100, std: Math.round(Math.sqrt(variance) * 100) / 100 };
  }
};
