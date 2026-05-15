// V16.3 — Monday Provider
// API GraphQL: https://api.monday.com/v2. Token Bearer.
window.ExecutionProviders = window.ExecutionProviders || {};
window.ExecutionProviders.monday = {
  id: 'monday',
  _endpoint: 'https://api.monday.com/v2',

  async _query(cfg, query, variables = {}) {
    const res = await fetch(this._endpoint, {
      method: 'POST',
      headers: { 'Authorization': cfg.apiToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables })
    });
    return res.json();
  },

  async testConnection(cfg) {
    if (!cfg?.apiToken) return { ok: false, message: 'Informe API Token Monday.' };
    try {
      const data = await this._query(cfg, 'query { me { id name } }');
      if (data.errors) return { ok: false, message: data.errors[0]?.message || 'Erro Monday.' };
      return { ok: true, message: `Conectado ao Monday (${data?.data?.me?.name || 'usuário'}).` };
    } catch (err) { return { ok: false, message: String(err?.message || err) }; }
  },

  async createTask(payload, cfg) {
    if (!cfg?.apiToken || !cfg?.boardId) return { providerTaskId: `monday_mock_${Date.now()}`, externalUrl: null };
    try {
      const data = await this._query(cfg,
        'mutation ($board: ID!, $name: String!, $group: String) { create_item (board_id: $board, item_name: $name, group_id: $group) { id } }',
        { board: cfg.boardId, name: payload.title, group: cfg.defaultGroup || null }
      );
      const id = data?.data?.create_item?.id || null;
      return { providerTaskId: id, externalUrl: id ? `https://monday.com/boards/${cfg.boardId}/pulses/${id}` : null };
    } catch (_) {
      return { providerTaskId: `monday_mock_${Date.now()}`, externalUrl: null };
    }
  },

  async updateTask() { return { ok: true }; },

  async fetchTask(providerTaskId, cfg) {
    if (!cfg?.apiToken || !providerTaskId) return null;
    try {
      const data = await this._query(cfg, 'query ($id: [ID!]) { items (ids: $id) { id state } }', { id: [providerTaskId] });
      const state = data?.data?.items?.[0]?.state;
      return { status: state === 'archived' || state === 'deleted' ? 'completed' : 'in_progress', completedAt: null };
    } catch (_) { return null; }
  }
};
