// V16.3 — Execution Provider Registry
// Lista e descreve providers operacionais suportados (ClickUp, Trello, Monday, Jira, Notion, Manual).
// Normaliza a configuração persistida e devolve o provider escolhido como padrão.
window.ExecutionProviderRegistry = {
  PROVIDERS: [
    { id: 'clickup', label: 'ClickUp', icon: 'kanban', tone: '#7B68EE', fields: ['apiToken','workspace','space','folder','list','statusInProgress','statusDone'] },
    { id: 'trello',  label: 'Trello',  icon: 'columns', tone: '#0079BF', fields: ['apiKey','token','board','listTodo','listDone'] },
    { id: 'monday',  label: 'Monday',  icon: 'grid',    tone: '#FF3D57', fields: ['apiToken','workspace','boardId','defaultGroup'] },
    { id: 'jira',    label: 'Jira',    icon: 'ticket',  tone: '#2684FF', fields: ['url','apiToken','project','status'] },
    { id: 'notion',  label: 'Notion',  icon: 'book',    tone: '#0F172A', fields: ['apiToken','databaseId'] },
    { id: 'manual',  label: 'Manual',  icon: 'edit',    tone: '#475569', fields: [] }
  ],

  list() { return this.PROVIDERS.slice(); },

  byId(id) { return this.PROVIDERS.find(p => p.id === id) || this.PROVIDERS[this.PROVIDERS.length - 1]; },

  defaultConfig() {
    const providers = {};
    for (const p of this.PROVIDERS) {
      providers[p.id] = { connected: false, lastTested: null, lastError: null };
      for (const field of p.fields) providers[p.id][field] = '';
    }
    return { defaultProvider: 'manual', providers };
  },

  normalize(raw) {
    if (!raw || typeof raw !== 'object') return this.defaultConfig();
    const base = this.defaultConfig();
    const providers = { ...base.providers };
    if (raw.providers && typeof raw.providers === 'object') {
      for (const p of this.PROVIDERS) {
        providers[p.id] = { ...providers[p.id], ...(raw.providers[p.id] || {}) };
      }
    }
    const defaultProvider = this.byId(raw.defaultProvider)?.id || 'manual';
    return { defaultProvider, providers };
  },

  getProviderConfig(providerId) {
    const cfg = App.state.executionConfig || this.defaultConfig();
    return cfg.providers?.[providerId] || {};
  },

  getDefaultProviderId() {
    return App.state.executionConfig?.defaultProvider || 'manual';
  }
};
