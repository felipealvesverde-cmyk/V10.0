// V16.3 — ClickUp Provider
// API: https://api.clickup.com/api/v2.
// V31.2.32 — Quando o user está conectado via PAT (App.state.clickupStatus.connected),
// roteia pelo endpoint backend /api/clickup-create-task (PAT fica criptografado no DB,
// nunca toca o browser). Caso contrário, cai no fluxo legado V16.3 com cfg.apiToken.
// Sem nenhum token → retorna mock para não quebrar o fluxo.
window.ExecutionProviders = window.ExecutionProviders || {};
window.ExecutionProviders.clickup = {
  id: 'clickup',
  _baseUrl: 'https://api.clickup.com/api/v2',

  _isNewPathConnected() {
    return Boolean(window.App?.state?.clickupStatus?.connected);
  },

  async testConnection(cfg) {
    // Caminho novo: se já está conectado via PAT, considera test OK.
    if (this._isNewPathConnected()) {
      return { ok: true, message: `Conectado via PAT — workspace "${App.state.clickupStatus.workspaceName || '—'}".` };
    }
    if (!cfg?.apiToken) return { ok: false, message: 'Informe o API Token do ClickUp.' };
    try {
      const res = await fetch(`${this._baseUrl}/user`, { headers: { 'Authorization': cfg.apiToken } });
      if (!res.ok) return { ok: false, message: `ClickUp respondeu ${res.status}.` };
      return { ok: true, message: 'Conectado ao ClickUp.' };
    } catch (err) { return { ok: false, message: String(err?.message || err) }; }
  },

  async createTask(payload, cfg) {
    // Caminho novo via backend proxy (PAT no DB).
    if (this._isNewPathConnected()) {
      try {
        const jwt = localStorage.getItem('lj_jwt');
        const res = await fetch('/api/clickup-create-task', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({
            name: payload.title || payload.name,
            description: payload.description,
            due_date: payload.due_date,
            priority: payload.priority,
            assignee: payload.assignee,
            list_id: cfg?.list || undefined
          })
        });
        const data = await res.json();
        if (data.ok) return { providerTaskId: data.providerTaskId, externalUrl: data.externalUrl };
        return { providerTaskId: `clickup_mock_${Date.now()}`, externalUrl: null, error: data.message || 'ClickUp create-task falhou.' };
      } catch (err) {
        return { providerTaskId: `clickup_mock_${Date.now()}`, externalUrl: null, error: String(err?.message || err) };
      }
    }
    // Caminho legado (V16.3): cfg.apiToken no frontend state.
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
