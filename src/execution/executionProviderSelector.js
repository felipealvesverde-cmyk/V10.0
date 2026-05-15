// V16.3 — Execution Provider Selector
// Centraliza a escolha de provider para uma execução. Hoje retorna o default,
// mas o futuro pode considerar tipo de ação, canal ou área de negócio.
window.ExecutionProviderSelector = {
  selectFor(action) {
    if (!window.ExecutionProviderRegistry) return 'manual';
    const cfg = App.state.executionConfig || ExecutionProviderRegistry.defaultConfig();
    return cfg.defaultProvider || 'manual';
  },

  selectExplicit(providerId) {
    const provider = window.ExecutionProviderRegistry?.byId(providerId);
    return provider?.id || 'manual';
  },

  isConfigured(providerId) {
    if (providerId === 'manual') return true;
    const cfg = window.ExecutionProviderRegistry?.getProviderConfig(providerId) || {};
    return Boolean(cfg.connected);
  }
};
