// V19 — A/B Test Engine
// Permite testar variantes de pesos de sinais. Holdout estável por leadKey
// (mesmo lead sempre recebe a mesma variante para não corromper resultado).
window.ABTestEngine = {
  registerVariant(testId, config) {
    const all = App.state.abTestVariants || {};
    App.state.abTestVariants = { ...all, [testId]: { ...config, registeredAt: new Date().toISOString() } };
  },

  variantFor(testId, leadKey) {
    const test = (App.state.abTestVariants || {})[testId];
    if (!test) return null;
    if (test.activeFor === 'A') return 'A';
    if (test.activeFor === 'B') return 'B';
    // Auto: holdout determinístico baseado em hash do leadKey
    const split = Number(test.holdout || 0.5);
    return this._hash(leadKey) % 100 < split * 100 ? 'A' : 'B';
  },

  weightFor(testId, leadKey, signal) {
    const test = (App.state.abTestVariants || {})[testId];
    if (!test) return null;
    const variant = this.variantFor(testId, leadKey);
    const weights = variant === 'A' ? test.weightsA : test.weightsB;
    return weights?.[signal] ?? null;
  },

  _hash(str) {
    let h = 0;
    for (let i = 0; i < String(str).length; i += 1) {
      h = ((h << 5) - h + String(str).charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }
};
