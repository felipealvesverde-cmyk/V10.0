// V19 — Touch Attribution Engine
// Modela qual touch foi crítico no path de um lead convertido. Default:
// time-decay (touch mais recente vale mais). Roadmap: data-driven (Shapley).
window.TouchAttribution = {
  MODELS: ['first-touch', 'last-touch', 'linear', 'time-decay', 'position-based'],

  attribute(touchHistory, model = 'time-decay') {
    const touches = Array.isArray(touchHistory) ? touchHistory : [];
    if (!touches.length) return [];
    if (model === 'first-touch')   return [{ ...touches[0], weight: 1 }];
    if (model === 'last-touch')    return [{ ...touches[touches.length - 1], weight: 1 }];
    if (model === 'linear')        return touches.map(t => ({ ...t, weight: 1 / touches.length }));
    if (model === 'position-based') return this._positionBased(touches);
    return this._timeDecay(touches);
  },

  _timeDecay(touches, halfLife = 14) {
    const now = Date.now();
    const weighted = touches.map(t => {
      const days = (now - new Date(t.ts || now).getTime()) / (24 * 3600 * 1000);
      const factor = Math.exp(-Math.max(0, days) / halfLife);
      return { ...t, _raw: factor };
    });
    const total = weighted.reduce((s, t) => s + t._raw, 0) || 1;
    return weighted.map(t => ({ ...t, weight: t._raw / total }));
  },

  _positionBased(touches) {
    if (touches.length === 1) return [{ ...touches[0], weight: 1 }];
    if (touches.length === 2) return [{ ...touches[0], weight: 0.5 }, { ...touches[1], weight: 0.5 }];
    const middle = touches.slice(1, -1);
    const middleW = middle.length ? 0.2 / middle.length : 0;
    return [
      { ...touches[0], weight: 0.4 },
      ...middle.map(t => ({ ...t, weight: middleW })),
      { ...touches[touches.length - 1], weight: 0.4 }
    ];
  }
};
