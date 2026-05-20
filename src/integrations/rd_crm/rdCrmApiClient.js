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

  // V24.0.0 — `which` escolhe qual OAuth refrescar: 'marketing' (default,
  // App.state.integrations.rd) ou 'crm' (App.state.integrations.rd.crmOauth).
  async _tryRefresh(which = 'marketing') {
    if (!window.RDAuthService) return { ok: false, message: 'RDAuthService indisponível.' };
    if (which === 'crm') {
      const cfg = App.state.integrations?.rd?.crmOauth || {};
      if (!cfg.refreshToken) return { ok: false, message: 'Sem refresh_token CRM OAuth salvo.' };
      const r = await RDAuthService.refreshAccessToken(cfg);
      if (!r.ok) return r;
      App.state.integrations.rd.crmOauth = {
        ...cfg,
        accessToken: r.accessToken,
        refreshToken: r.refreshToken || cfg.refreshToken,
        expiresAt: r.expiresAt || cfg.expiresAt
      };
      try { App.save(); } catch (_) {}
      // V31.2.36 — Write-through pro DB após auto-refresh em 401.
      try { window.Actions?._persistRdToDb?.('crm_oauth'); } catch (_) {}
      return { ok: true };
    }
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
    // V31.2.36 — Write-through pro DB após auto-refresh em 401.
    try { window.Actions?._persistRdToDb?.('marketing_oauth'); } catch (_) {}
    return { ok: true };
  },

  async request(method, path, options = {}) {
    // V21.4.3 — Para chamadas CRM (legacy=true, default), usa o Personal Access
    // Token do CRM. Para outras (api.rd.services / Marketing), usa accessToken OAuth.
    // V24.0.0 — Quando options.useCrmOauthV2=true, usa o accessToken do app
    // OAuth do CRM (separado do Marketing). Necessário pra /crm/v2/* porque
    // o OAuth do Marketing não tem scope CRM.
    // V31.2.37 — Em vez de extrair o token do state e enviar no body, agora
    // mandamos `token_source` (qual tipo usar) e o backend lê do DB criptografado.
    // Continua passando o token legado como fallback pra OAuth setup (quando
    // token ainda não está no DB).
    const useLegacyForToken = options.legacy !== false;
    const useCrmOauthV2 = options.useCrmOauthV2 === true;
    const tokenSource = useCrmOauthV2 ? 'crm_oauth' : (useLegacyForToken ? 'crm_pat' : 'marketing_oauth');
    let token;
    if (useCrmOauthV2) {
      token = window.App?.state?.integrations?.rd?.crmOauth?.accessToken || '';
    } else if (useLegacyForToken) {
      token = RdCrmConfig.crmToken();
    } else {
      token = RdCrmConfig.oauthCredentials().accessToken || '';
    }
    if (!token) {
      return {
        ok: false,
        dryRun: true,
        status: 'missing_token',
        message: useCrmOauthV2
          ? 'Access Token OAuth CRM ausente. Conecte o app OAuth CRM em Configurações → RD Station → aba CRM OAuth.'
          : useLegacyForToken
            ? 'CRM Personal Token ausente. Gere um em RD CRM → Configurações → Integrações e cole em Configurações → RD Station.'
            : 'Access Token OAuth Marketing ausente. Conecte em Configurações → RD Station → aba Marketing.',
        data: null
      };
    }
    // V21.4 — Toda chamada ao RD vai via /api/rd-proxy (CORS workaround).
    // V21.4.1 — A API CRM unificada (api.rd.services/crm/v1) retorna 404,
    // então o default agora é a base oficial crm.rdstation.com/api/v1 ("legacy").
    // Quem precisa do unified explicita options.legacy = false.
    // V24.0.0 — Removida a auto-injeção de '/crm/v1' quando legacy=false.
    // Caller agora passa path completo (ex: '/crm/v2/...', '/integrations/...',
    // '/platform/...'). Antes, '/integrations/webhooks' virava '/crm/v1/integrations/webhooks' → 404.
    const useLegacy = options.legacy !== false;
    const rdPath = path.startsWith('/') ? path : `/${path}`;
    // V21.4.2 — Legacy CRM API rejeita Authorization: Bearer; usa ?token=X.
    const useQueryToken = useLegacy;
    // V31.2.37 — Adiciona JWT no header pra backend conseguir resolver token_source.
    const jwt = localStorage.getItem('lj_jwt');
    const reqHeaders = { 'Content-Type': 'application/json' };
    if (jwt) reqHeaders.Authorization = `Bearer ${jwt}`;
    try {
      let response = await fetch('/api/rd-proxy', {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify({
          method,
          path: rdPath,
          body: options.body,
          token,             // fallback legado (OAuth setup, antes do DB ter o token)
          token_source: tokenSource, // V31.2.37 — preferido (backend lê do DB)
          legacy: useLegacy,
          useQueryToken
        })
      });
      // V31.2.39 — Log diagnóstico quando o RD rejeita (401/403/4xx). Ajuda
      // a entender qual token tá falhando sem precisar abrir Network tab.
      if (!response.ok && (response.status === 401 || response.status === 403 || response.status >= 400)) {
        const tokenPreview = token ? `${token.slice(0, 8)}...${token.slice(-4)}` : '(vazio)';
        const respClone = response.clone();
        const errText = await respClone.text().catch(() => '');
        console.warn(`[rd] ${response.status} ${method} ${rdPath} (source=${tokenSource}, token=${tokenPreview}, legacy=${useLegacy})`);
        console.warn(`[rd] resposta:`, errText.slice(0, 500));
      }
      // Auto-refresh em 401 (uma única vez).
      // V24.0.0 — Quando useCrmOauthV2=true, refresca o CRM OAuth.
      if (response.status === 401 && !options._retried) {
        const refreshed = await this._tryRefresh(useCrmOauthV2 ? 'crm' : 'marketing');
        if (refreshed.ok) {
          const newToken = useCrmOauthV2
            ? (App.state.integrations?.rd?.crmOauth?.accessToken || '')
            : (App.state.integrations?.rd?.accessToken || '');
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
      // V31.2.49 — Log diagnóstico em 4xx/5xx pra ver o que RD respondeu (RD
      // não documenta formatos consistentes — pode ser data.errors, data.error,
      // data.detail, data.code, data.description, raw string, etc).
      if (!response.ok) {
        console.warn(`[rd-crm] ${method} ${rdPath} → ${response.status}`, data);
      }
      // Extrai mensagem do erro tentando vários formatos possíveis do RD
      let extractedMessage;
      if (response.ok) {
        extractedMessage = 'Requisição RD CRM realizada.';
      } else if (data && typeof data === 'object') {
        if (data.errors) {
          extractedMessage = Array.isArray(data.errors)
            ? data.errors.map(e => (typeof e === 'string' ? e : (e.message || e.detail || e.description || JSON.stringify(e)))).join(' | ')
            : JSON.stringify(data.errors);
        } else if (data.error) {
          extractedMessage = typeof data.error === 'string' ? data.error : JSON.stringify(data.error);
        } else if (data.message) {
          extractedMessage = String(data.message);
        } else if (data.detail) {
          extractedMessage = String(data.detail);
        } else if (data.description) {
          extractedMessage = String(data.description);
        } else {
          extractedMessage = `HTTP ${response.status} — body: ${JSON.stringify(data).slice(0, 200)}`;
        }
      } else if (typeof data === 'string' && data.length) {
        extractedMessage = `HTTP ${response.status} — ${data.slice(0, 200)}`;
      } else {
        extractedMessage = `HTTP ${response.status} (resposta vazia)`;
      }
      return {
        ok: response.ok,
        status: response.status,
        data,
        message: extractedMessage
      };
    } catch (error) {
      return { ok: false, status: 'network_error', message: error?.message || 'Falha de rede ao chamar /api/rd-proxy.', error };
    }
  },

  get(path, options = {}) { return this.request('GET', path, options); },
  post(path, body, options = {}) { return this.request('POST', path, { ...options, body }); },
  patch(path, body, options = {}) { return this.request('PATCH', path, { ...options, body }); },
  put(path, body, options = {}) { return this.request('PUT', path, { ...options, body }); },
  del(path, options = {}) { return this.request('DELETE', path, options); }
};
