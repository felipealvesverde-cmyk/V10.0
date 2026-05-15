// V16.3 — Jira Provider
// API REST v3. Auth: Basic (email:apiToken) base64.
window.ExecutionProviders = window.ExecutionProviders || {};
window.ExecutionProviders.jira = {
  id: 'jira',

  _headers(cfg) {
    return {
      'Authorization': `Basic ${btoa(`${cfg.email || ''}:${cfg.apiToken || ''}`)}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  },

  _url(cfg, path) {
    const base = String(cfg.url || '').replace(/\/+$/, '');
    return `${base}/rest/api/3${path}`;
  },

  async testConnection(cfg) {
    if (!cfg?.url || !cfg?.apiToken) return { ok: false, message: 'Informe URL e API Token Jira.' };
    try {
      const res = await fetch(this._url(cfg, '/myself'), { headers: this._headers(cfg) });
      if (!res.ok) return { ok: false, message: `Jira respondeu ${res.status}.` };
      return { ok: true, message: 'Conectado ao Jira.' };
    } catch (err) { return { ok: false, message: String(err?.message || err) }; }
  },

  async createTask(payload, cfg) {
    if (!cfg?.url || !cfg?.apiToken || !cfg?.project) return { providerTaskId: `jira_mock_${Date.now()}`, externalUrl: null };
    try {
      const res = await fetch(this._url(cfg, '/issue'), {
        method: 'POST',
        headers: this._headers(cfg),
        body: JSON.stringify({
          fields: {
            project: { key: cfg.project },
            summary: payload.title,
            description: payload.description || '',
            issuetype: { name: 'Task' },
            duedate: payload.due_date || undefined
          }
        })
      });
      const data = await res.json();
      const key = data.key || null;
      return { providerTaskId: key, externalUrl: key ? `${cfg.url}/browse/${key}` : null };
    } catch (_) {
      return { providerTaskId: `jira_mock_${Date.now()}`, externalUrl: null };
    }
  },

  async updateTask(providerTaskId, patch, cfg) {
    if (!cfg?.url || !cfg?.apiToken || !providerTaskId) return { ok: true };
    try {
      if (patch.status === 'completed') {
        await fetch(this._url(cfg, `/issue/${providerTaskId}/transitions`), {
          method: 'POST',
          headers: this._headers(cfg),
          body: JSON.stringify({ transition: { name: cfg.status || 'Done' } })
        });
      }
      return { ok: true };
    } catch (_) { return { ok: false }; }
  },

  async fetchTask(providerTaskId, cfg) {
    if (!cfg?.url || !cfg?.apiToken || !providerTaskId) return null;
    try {
      const res = await fetch(this._url(cfg, `/issue/${providerTaskId}`), { headers: this._headers(cfg) });
      const data = await res.json();
      const status = String(data?.fields?.status?.name || '').toLowerCase();
      return { status: status === 'done' ? 'completed' : status === 'in progress' ? 'in_progress' : 'pending', completedAt: null };
    } catch (_) { return null; }
  }
};
