// V16.3 — Agent Registry
// Cadastro de agentes externos do LeadJourney. Hoje só Djow; arquitetura
// permite adicionar mais futuramente (cada agente vira chave em agentConfig).
window.AgentRegistry = {
  AGENTS: [
    { id: 'djow', label: 'Djow (Railway)', icon: 'cpu', tone: '#6366F1', description: 'Agente principal de execução operacional hospedado no Railway.' }
  ],

  list() { return this.AGENTS.slice(); },

  byId(id) { return this.AGENTS.find(a => a.id === id) || null; },

  defaultConfig() {
    return {
      djow: {
        name: 'Djow',
        url: '',
        endpoint: '/execute',
        method: 'POST',
        apiKey: '',
        timeoutMs: 30000,
        enabled: false,
        lastStatus: null,
        lastLatencyMs: null,
        lastCheckedAt: null,
        lastError: null
      }
    };
  },

  normalize(raw) {
    if (!raw || typeof raw !== 'object') return this.defaultConfig();
    const base = this.defaultConfig();
    return { djow: { ...base.djow, ...(raw.djow || {}) } };
  },

  getConfig(agentId) {
    const cfg = App.state.agentConfig || this.defaultConfig();
    return cfg[agentId] || this.defaultConfig()[agentId];
  },

  setConfig(agentId, patch) {
    const cfg = App.state.agentConfig || this.defaultConfig();
    App.state.agentConfig = { ...cfg, [agentId]: { ...(cfg[agentId] || {}), ...patch } };
  }
};
