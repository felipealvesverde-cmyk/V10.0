// V16.3 — Notion Provider
// API v1: https://api.notion.com/v1. Auth Bearer + header Notion-Version.
window.ExecutionProviders = window.ExecutionProviders || {};
window.ExecutionProviders.notion = {
  id: 'notion',
  _baseUrl: 'https://api.notion.com/v1',

  _headers(cfg) {
    return {
      'Authorization': `Bearer ${cfg.apiToken || ''}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28'
    };
  },

  async testConnection(cfg) {
    if (!cfg?.apiToken) return { ok: false, message: 'Informe API Token Notion.' };
    try {
      const res = await fetch(`${this._baseUrl}/users/me`, { headers: this._headers(cfg) });
      if (!res.ok) return { ok: false, message: `Notion respondeu ${res.status}.` };
      return { ok: true, message: 'Conectado ao Notion.' };
    } catch (err) { return { ok: false, message: String(err?.message || err) }; }
  },

  async createTask(payload, cfg) {
    if (!cfg?.apiToken || !cfg?.databaseId) return { providerTaskId: `notion_mock_${Date.now()}`, externalUrl: null };
    try {
      const res = await fetch(`${this._baseUrl}/pages`, {
        method: 'POST',
        headers: this._headers(cfg),
        body: JSON.stringify({
          parent: { database_id: cfg.databaseId },
          properties: {
            Name: { title: [{ text: { content: payload.title || 'Tarefa' } }] }
          }
        })
      });
      const data = await res.json();
      return { providerTaskId: data.id || null, externalUrl: data.url || null };
    } catch (_) {
      return { providerTaskId: `notion_mock_${Date.now()}`, externalUrl: null };
    }
  },

  async updateTask() { return { ok: true }; },

  async fetchTask(providerTaskId, cfg) {
    if (!cfg?.apiToken || !providerTaskId) return null;
    try {
      const res = await fetch(`${this._baseUrl}/pages/${providerTaskId}`, { headers: this._headers(cfg) });
      const data = await res.json();
      return { status: data.archived ? 'completed' : 'pending', completedAt: data.archived ? new Date().toISOString() : null };
    } catch (_) { return null; }
  }
};
