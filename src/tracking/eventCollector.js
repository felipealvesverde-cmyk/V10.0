// V15 — Event Collector
// Faz polling do endpoint /api/lp-events-fetch para pegar eventos novos do
// pixel e despacha para o CheckpointEngine + LeadScoring + RD CRM movement.
window.EventCollector = {
  _intervalId: null,
  _running: false,

  async poll() {
    if (this._running) return { ok: false, message: 'Poll já em andamento.' };
    this._running = true;
    try {
      const since = this._lastPolledAt();
      const url = `${LpRegistry.fetchEndpoint()}?since=${encodeURIComponent(since || '')}`;
      let events = [];
      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          events = Array.isArray(data?.events) ? data.events : [];
        }
      } catch (error) {
        console.warn('LP fetch falhou (provavelmente endpoint offline):', error?.message);
      }
      const applied = this.ingestEvents(events);
      App.state.lpLastPolledAt = new Date().toISOString();
      App.save();
      return { ok: true, applied, total: events.length };
    } finally {
      this._running = false;
    }
  },

  _lastPolledAt() {
    return App.state.lpLastPolledAt || '';
  },

  ingestEvents(events) {
    App.state.lpEvents = Array.isArray(App.state.lpEvents) ? App.state.lpEvents : [];
    let applied = 0;
    for (const raw of events) {
      const enriched = LeadIdentityResolver.enrichEvent(raw);
      App.state.lpEvents.push(enriched);
      if (App.state.lpEvents.length > 1000) App.state.lpEvents.shift();
      const registry = App.state.lpRegistry || {};
      const entry = Object.values(registry).find(e => e.trackingId === enriched.trackingId);
      if (entry) {
        entry.lastEventAt = new Date().toISOString();
        entry.status = 'receiving';
      }
      if (window.TrackingCheckpointEngine) {
        const fired = TrackingCheckpointEngine.processEvent(enriched);
        if (fired?.fired) applied += 1;
      }
    }
    return applied;
  },

  startPolling(intervalMs = 5 * 60 * 1000) {
    if (this._intervalId) clearInterval(this._intervalId);
    this._intervalId = setInterval(() => this.poll(), intervalMs);
  },

  stopPolling() {
    if (this._intervalId) clearInterval(this._intervalId);
    this._intervalId = null;
  }
};
