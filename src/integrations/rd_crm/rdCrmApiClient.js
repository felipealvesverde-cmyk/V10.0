// V15 — Cliente HTTP para RD Station CRM.
// Compartilha o OAuth com o RD Email mas mantém o tracking de erros separado.
// Quando não há token configurado, opera em modo dryRun retornando mocks para
// a UI testar sem quebrar.
window.RdCrmApiClient = {
  _buildHeaders(token) {
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  },

  baseUrl(version = 'v1') {
    const cfg = RdCrmConfig;
    return version === 'legacy' ? cfg.legacyBaseUrl : `${cfg.apiBaseUrl}${cfg.crmBasePath}`;
  },

  async _tryRefresh() {
    if (!window.RDAuthService) return { ok: false, message: 'RDAuthService indisponível.' };
    const cfg = App.state.integrations?.rd || {};
    if (!cfg.refreshToken) return { ok: false, message: 'Sem refresh_token salvo.' };
    const r = await RDAuthService.refreshAccessToken(cfg);
    if (!r.ok) return r;
    App.state.integrations = App.state.integrations || {};
    App.state.integrations.rd = {
      ...cfg,
      accessToken: r.accessToken,
      refreshToken: r.refreshToken || cfg.refreshToken,
      expiresAt: r.expiresAt || cfg.expiresAt
    };
    try { App.save(); } catch (_) {}
    return { ok: true };
  },

  async request(method, path, options = {}) {
    const credentials = RdCrmConfig.oauthCredentials();
    const token = credentials.accessToken || '';
    if (!token) {
      return {
        ok: false,
        dryRun: true,
        status: 'missing_token',
        message: 'Access Token RD não configurado. Conecte o RD Station em Configurações → RD Station.',
        data: null
      };
    }
    const base = options.legacy ? this.baseUrl('legacy') : this.baseUrl('v1');
    const url = path.startsWith('http') ? path : `${base}${path}`;
    const buildInit = (tok) => {
      const init = { method, headers: { ...this._buildHeaders(tok), ...(options.headers || {}) } };
      if (options.body !== undefined) init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      return init;
    };
    try {
      let response = await fetch(url, buildInit(token));
      // V21.8 — Auto-refresh em 401 (uma única vez).
      if (response.status === 401 && !options._retried) {
        const refreshed = await this._tryRefresh();
        if (refreshed.ok) {
          const newToken = App.state.integrations?.rd?.accessToken || '';
          if (newToken) {
            return this.request(method, path, { ...options, _retried: true });
          }
        } else {
          return { ok: false, status: 401, message: `Token expirou e refresh falhou: ${refreshed.message}` };
        }
      }
      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
      if (response.status === 401) {
        return { ok: false, status: 401, data, message: 'Token RD expirado. Refresh do OAuth necessário.' };
      }
      return {
        ok: response.ok,
        status: response.status,
        data,
        message: response.ok ? 'Requisição RD CRM realizada.' : (data?.errors ? JSON.stringify(data.errors) : `HTTP ${response.status}`)
      };
    } catch (error) {
      return { ok: false, status: 'network_error', message: error?.message || 'Falha de rede ao chamar RD CRM.', error };
    }
  },

  get(path, options = {}) { return this.request('GET', path, options); },
  post(path, body, options = {}) { return this.request('POST', path, { ...options, body }); },
  patch(path, body, options = {}) { return this.request('PATCH', path, { ...options, body }); },
  put(path, body, options = {}) { return this.request('PUT', path, { ...options, body }); },
  del(path, options = {}) { return this.request('DELETE', path, options); }
};
