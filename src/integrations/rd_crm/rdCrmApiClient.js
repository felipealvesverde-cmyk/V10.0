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
    const init = {
      method,
      headers: { ...this._buildHeaders(token), ...(options.headers || {}) }
    };
    if (options.body !== undefined) init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    try {
      const response = await fetch(url, init);
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
