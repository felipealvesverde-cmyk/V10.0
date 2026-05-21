// V16.3 — Trello Provider
// API: https://api.trello.com/1. Usa apiKey + token como query params.
// V32.0.16 — Bridge pra padrão novo (execution_credentials criptografado no DB).
// Quando o user está conectado via /api/execution-connect, roteia createTask
// pelo backend (token nunca toca o browser). Senão, fluxo legado V16.3.
window.ExecutionProviders = window.ExecutionProviders || {};
window.ExecutionProviders.trello = {
  id: 'trello',
  _baseUrl: 'https://api.trello.com/1',

  _auth(cfg) { return `key=${encodeURIComponent(cfg.apiKey || '')}&token=${encodeURIComponent(cfg.token || '')}`; },

  _isNewPathConnected() {
    const list = window.App?.state?._executionCredentialsCache || [];
    return list.some(p => p.providerId === 'trello' && p.status === 'connected');
  },

  async testConnection(cfg) {
    if (this._isNewPathConnected()) {
      return { ok: true, message: 'Conectado via execution_credentials (DB criptografado).' };
    }
    if (!cfg?.apiKey || !cfg?.token) return { ok: false, message: 'Informe API Key e Token do Trello.' };
    try {
      const res = await fetch(`${this._baseUrl}/members/me?${this._auth(cfg)}`);
      if (!res.ok) return { ok: false, message: `Trello respondeu ${res.status}.` };
      return { ok: true, message: 'Conectado ao Trello.' };
    } catch (err) { return { ok: false, message: String(err?.message || err) }; }
  },

  async createTask(payload, cfg) {
    // V32.0.16 — Caminho novo via backend (credenciais criptografadas).
    if (this._isNewPathConnected()) {
      try {
        const jwt = localStorage.getItem('lj_jwt');
        const res = await fetch('/api/trello-create-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({
            name: payload.title || payload.name,
            description: payload.description,
            due_date: payload.due_date
          })
        });
        const data = await res.json();
        if (data.ok) return { providerTaskId: data.providerTaskId, externalUrl: data.externalUrl };
        return { providerTaskId: `trello_mock_${Date.now()}`, externalUrl: null, error: data.message || 'Trello create-task falhou.' };
      } catch (err) {
        return { providerTaskId: `trello_mock_${Date.now()}`, externalUrl: null, error: String(err?.message || err) };
      }
    }
    // Caminho legado V16.3
    if (!cfg?.apiKey || !cfg?.token || !cfg?.listTodo) return { providerTaskId: `trello_mock_${Date.now()}`, externalUrl: null };
    try {
      const body = new URLSearchParams({
        idList: cfg.listTodo,
        name: payload.title,
        desc: payload.description || '',
        due: payload.due_date || ''
      });
      const res = await fetch(`${this._baseUrl}/cards?${this._auth(cfg)}&${body.toString()}`, { method: 'POST' });
      const data = await res.json();
      return { providerTaskId: data.id || null, externalUrl: data.url || null };
    } catch (_) {
      return { providerTaskId: `trello_mock_${Date.now()}`, externalUrl: null };
    }
  },

  async updateTask(providerTaskId, patch, cfg) {
    if (!cfg?.apiKey || !cfg?.token || !providerTaskId) return { ok: true };
    try {
      const targetList = patch.status === 'completed' ? cfg.listDone : cfg.listTodo;
      if (targetList) {
        await fetch(`${this._baseUrl}/cards/${providerTaskId}?${this._auth(cfg)}&idList=${encodeURIComponent(targetList)}`, { method: 'PUT' });
      }
      return { ok: true };
    } catch (_) { return { ok: false }; }
  },

  async fetchTask(providerTaskId, cfg) {
    if (!cfg?.apiKey || !cfg?.token || !providerTaskId) return null;
    try {
      const res = await fetch(`${this._baseUrl}/cards/${providerTaskId}?${this._auth(cfg)}`);
      const data = await res.json();
      const done = data.idList === cfg.listDone;
      return { status: done ? 'completed' : 'in_progress', completedAt: done ? new Date().toISOString() : null };
    } catch (_) { return null; }
  }
};
