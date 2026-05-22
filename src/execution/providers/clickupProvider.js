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
    // V32.1.6 — Read-only mode: bloqueia criação no frontend antes mesmo de
    // chamar backend (UI mais clara). Backend tem o mesmo guard (defesa em
    // profundidade) — qualquer um dos dois evita criação indevida.
    if (window.App?.state?.clickupStatus?.writeEnabled === false) {
      if (window.Utils?.toast) Utils.toast('ClickUp em modo somente-leitura — task NÃO criada. Ative em Configurações → ClickUp.');
      return { providerTaskId: null, externalUrl: null, error: 'ClickUp em modo somente-leitura.' };
    }
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
    if (!providerTaskId) return { ok: true };
    // V32.1.6 — Read-only: bloqueia update se user desativou write.
    if (window.App?.state?.clickupStatus?.writeEnabled === false) {
      return { ok: true, skipped: 'read_only' };
    }
    // V32.1.5 — Path novo (PAT via DB): usa statusMap do user setado em
    // Configurações → Integrações → ClickUp → Mapping de status. Backend
    // /api/clickup-proxy é quem faz a chamada (token criptografado no DB).
    if (this._isNewPathConnected()) {
      try {
        const statusMap = window.App?.state?.clickupStatus?.statusMap || {};
        const ljStatus = patch.status === 'completed' ? 'completed' : 'in_progress';
        const remoteStatus = statusMap[ljStatus];
        if (!remoteStatus) return { ok: true }; // sem mapping → não tenta update (silent no-op)
        const jwt = localStorage.getItem('lj_jwt');
        await fetch('/api/clickup-proxy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
          body: JSON.stringify({
            method: 'PUT',
            path: `/task/${providerTaskId}`,
            body: { status: remoteStatus }
          })
        });
        return { ok: true };
      } catch (_) { return { ok: false }; }
    }
    // Legacy V16.3: cfg.apiToken inline + cfg.statusDone/statusInProgress.
    if (!cfg?.apiToken) return { ok: true };
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
