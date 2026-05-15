// V15 — Attribution Engine
// Multi-touch attribution: para cada lead que converteu, distribui o crédito
// entre todas as ações que ele atravessou (first-touch, last-touch, linear).
window.AttributionEngine = {
  MODES: ['first', 'last', 'linear'],

  attributeFor(leadIdentityKey, mode = 'linear') {
    const events = (App.state.lpEvents || []).filter(e => e.leadIdentityKey === leadIdentityKey);
    if (!events.length) return [];
    const actions = new Map();
    for (const event of events) {
      const registry = App.state.lpRegistry || {};
      const entry = Object.values(registry).find(e => e.trackingId === event.trackingId);
      if (!entry) continue;
      if (!actions.has(entry.actionId)) actions.set(entry.actionId, []);
      actions.get(entry.actionId).push(event);
    }
    const list = Array.from(actions.keys());
    if (mode === 'first') return list.length ? [{ actionId: list[0], weight: 1 }] : [];
    if (mode === 'last') return list.length ? [{ actionId: list[list.length - 1], weight: 1 }] : [];
    const w = 1 / list.length;
    return list.map(actionId => ({ actionId, weight: w }));
  },

  revenuePerAction(mode = 'linear') {
    const out = {};
    const leadKeys = new Set((App.state.lpEvents || []).map(e => e.leadIdentityKey).filter(Boolean));
    for (const key of leadKeys) {
      const chain = this.attributeFor(key, mode);
      for (const slot of chain) {
        out[slot.actionId] = (out[slot.actionId] || 0) + slot.weight;
      }
    }
    return out;
  }
};
