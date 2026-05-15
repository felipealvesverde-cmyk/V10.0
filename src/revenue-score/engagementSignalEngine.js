// V18 — Engagement Signal Engine
// Mede o engagement de um lead com base nos sinais declarados no blueprint
// e nas tags reais do lead. Tags do lead que casam com signals do blueprint
// somam pontos; saída é 0-100.
window.EngagementSignalEngine = {
  forLead(blueprint, lead) {
    if (!blueprint?._internal?.engagementSignals) return { score: 0, detected: 0, possible: 0 };
    const signals = blueprint._internal.engagementSignals;
    const tags = this._extractTags(lead);
    const halfLife = Number(blueprint._internal.decayHalfLifeDays || 30);
    const decayFactor = this._decayFactor(lead, halfLife);
    let score = 0;
    let detected = 0;
    let possible = 0;
    for (const [signal, meta] of Object.entries(signals)) {
      possible += 1;
      const weight = typeof meta === 'object' ? Number(meta.weight || 0) : Number(meta || 0);
      if (this._tagMatchesSignal(tags, signal)) {
        score += weight * decayFactor;
        detected += 1;
      }
    }
    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      detected,
      possible,
      decay: Math.round(decayFactor * 100)
    };
  },

  _extractTags(lead) {
    if (!lead) return [];
    const raw = Array.isArray(lead.tags) ? lead.tags : String(lead.tags || '').split(/[,;]/);
    return raw.map(t => String(t).trim().toLowerCase().replace(/^#/, '')).filter(Boolean);
  },

  _tagMatchesSignal(tags, signal) {
    const norm = String(signal).toLowerCase();
    return tags.some(t => norm.includes(t) || t.includes(norm.split(' ')[0]));
  },

  // Decay temporal: weight × e^(-days/halfLife). Fonte do tempo é lead.createdAt.
  // Sem timestamp, assume "agora" (sem decay) para não punir leads novos sem dado.
  _decayFactor(lead, halfLife) {
    if (!lead?.createdAt) return 1;
    const ts = new Date(lead.createdAt).getTime();
    if (!Number.isFinite(ts)) return 1;
    const days = Math.max(0, (Date.now() - ts) / (24 * 3600 * 1000));
    return Math.exp(-days / Math.max(1, halfLife));
  }
};
