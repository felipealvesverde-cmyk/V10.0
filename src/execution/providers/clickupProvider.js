// V16.3 — ClickUp Provider
// API: https://api.clickup.com/api/v2. Token Bearer no header Authorization.
// Sem token configurado → operações retornam mock para não quebrar o fluxo.
window.ExecutionProviders = window.ExecutionProviders || {};
window.ExecutionProviders.clickup = {
  id: 'clickup',
  _baseUrl: 'https://api.clickup.com/api/v2',

  async testConnection(cfg) {
    if (!cfg?.apiToken) return { ok: false, message: 'Informe o API Token do ClickUp.' };
    try {
      const res = await fetch(`${this._baseUrl}/user`, { headers: { 'Authorization': cfg.apiToken } });
      if (!res.ok) return { ok: false, message: `ClickUp respondeu ${res.status}.` };
      return { ok: true, message: 'Conectado ao ClickUp.' };
    } catch (err) { return { ok: false, message: String(err?.message || err) }; }
  },

  async createTask(payload, cfg) {
    if (!cfg?.apiToken || !cfg?.list) return { providerTaskId: `clickup_mock_${Date.now()}`, externalUrl: null };
    try {
      const res = await fetch(`${this._baseUrl}/list/${cfg.list}/task`, {
        method: 'POST',
        headers: { 'Authorization': cfg.apiToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: payload.title,
          description: payload.description,
          assignees: payload.assignee ? [payload.assignee] : [],
          due_date: payload.due_date ? new Date(payload.due_date).getTime() : undefined,
          priority: payload.priority === 'high' ? 1 : payload.priority === 'low' ? 4 : 3
        })
      });
      const data = await res.json();
      return { providerTaskId: data.id || null, externalUrl: data.url || null };
    } catch (_) {
      return { providerTaskId: `clickup_mock_${Date.now()}`, externalUrl: null };
    }
  },

  async updateTask(providerTaskId, patch, cfg) {
    if (!cfg?.apiToken || !providerTaskId) return { ok: true };
    try {
      const status = patch.status === 'completed' ? (cfg.statusDone || 'complete') : (cfg.statusInProgress || 'in progress');
      await fetch(`${this._baseUrl}/task/${providerTaskId}`, {
        method: 'PUT',
        headers: { 'Authorization': cfg.apiToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      return { ok: true };
    } catch (_) { return { ok: false }; }
  },

  async fetchTask(providerTaskId, cfg) {
    if (!cfg?.apiToken || !providerTaskId) return null;
    try {
      const res = await fetch(`${this._baseUrl}/task/${providerTaskId}`, { headers: { 'Authorization': cfg.apiToken } });
      const data = await res.json();
      const remoteStatus = String(data?.status?.status || '').toLowerCase();
      const done = remoteStatus === (String(cfg.statusDone || 'complete').toLowerCase());
      return { status: done ? 'completed' : (remoteStatus.includes('progress') ? 'in_progress' : 'pending'), completedAt: done ? new Date().toISOString() : null };
    } catch (_) { return null; }
  }
};
