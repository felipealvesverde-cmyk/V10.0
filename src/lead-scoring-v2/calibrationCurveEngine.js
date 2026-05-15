// V19 — Calibration Curve Engine
// Lead score 70 deveria converter ~70% das vezes. Pareando score com outcome
// real conseguimos checar: o modelo está calibrado? Precision@K, recall.
window.CalibrationCurveEngine = {
  BUCKETS: [
    { min: 0, max: 25, label: '0-25' },
    { min: 26, max: 50, label: '26-50' },
    { min: 51, max: 75, label: '51-75' },
    { min: 76, max: 100, label: '76-100' }
  ],

  curveForCampaign(campaignId, classified) {
    if (!Array.isArray(classified) || !window.OutcomeTracker) return [];
    const result = this.BUCKETS.map(b => ({ ...b, total: 0, won: 0, lost: 0, undecided: 0 }));
    for (const c of classified) {
      const outcome = OutcomeTracker.get(this._leadKey(c.lead), campaignId);
      const bucket = result.find(b => c.revenueScore >= b.min && c.revenueScore <= b.max);
      if (!bucket) continue;
      bucket.total += 1;
      if (!outcome || outcome.outcome === 'in-progress') bucket.undecided += 1;
      else if (outcome.outcome === 'won') bucket.won += 1;
      else bucket.lost += 1;
    }
    return result.map(b => ({
      ...b,
      conversionRate: (b.won + b.lost) ? Math.round((b.won / (b.won + b.lost)) * 100) : null,
      expectedRate: Math.round((b.min + b.max) / 2)
    }));
  },

  precisionAtK(classified, k, campaignId) {
    if (!Array.isArray(classified) || !window.OutcomeTracker) return null;
    const topK = classified.slice().sort((a, b) => b.revenueScore - a.revenueScore).slice(0, k);
    const decided = topK.map(c => OutcomeTracker.get(this._leadKey(c.lead), campaignId)).filter(o => o && o.outcome !== 'in-progress');
    if (!decided.length) return null;
    const won = decided.filter(o => o.outcome === 'won').length;
    return { k, won, decided: decided.length, precision: Math.round((won / decided.length) * 100) };
  },

  _leadKey(lead) {
    return String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
  }
};
