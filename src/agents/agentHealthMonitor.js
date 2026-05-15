// V16.3 — Agent Health Monitor
// Mantém estatística de saúde do Djow (último status, latência, erro). Os
// callers (bridge, settings) consultam aqui em vez de tocar direto no state.
window.AgentHealthMonitor = {
  recordSuccess(latencyMs) {
    if (!window.AgentRegistry) return;
    AgentRegistry.setConfig('djow', {
      lastStatus: 'online',
      lastLatencyMs: Number(latencyMs || 0),
      lastCheckedAt: new Date().toISOString(),
      lastError: null
    });
    App.save?.();
  },

  recordFailure(message) {
    if (!window.AgentRegistry) return;
    AgentRegistry.setConfig('djow', {
      lastStatus: 'offline',
      lastCheckedAt: new Date().toISOString(),
      lastError: String(message || 'Erro desconhecido')
    });
    App.save?.();
  },

  async ping() {
    const cfg = App.state.agentConfig?.djow;
    if (!cfg?.url) {
      this.recordFailure('URL não configurada.');
      return { ok: false };
    }
    const res = await RailwayAgentClient.ping(cfg);
    if (res.ok) this.recordSuccess(res.latencyMs);
    else this.recordFailure(res.message);
    return res;
  },

  snapshot() {
    const cfg = App.state.agentConfig?.djow || {};
    return {
      status: cfg.lastStatus || 'unknown',
      latencyMs: cfg.lastLatencyMs || null,
      checkedAt: cfg.lastCheckedAt || null,
      error: cfg.lastError || null,
      enabled: Boolean(cfg.enabled)
    };
  }
};
