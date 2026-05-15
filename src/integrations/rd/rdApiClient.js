
window.RDApiClient = {
  config() { return App?.state?.integrations?.rd || RDConfig.defaultConfig(); },
  hasAccessToken() { return Boolean(this.config().accessToken); },
  _buildHeaders(token) {
    return { "Content-Type": "application/json", "Authorization": token ? `Bearer ${token}` : "" };
  },
  authHeaders() { return this._buildHeaders(this.config().accessToken); },
  async request(path, options = {}) {
    const cfg = this.config();
    if (!cfg.accessToken) return { ok:false, dryRun:true, status:"missing_token", message:"Access Token RD não configurado." };
    const url = path.startsWith("http") ? path : `${RDConfig.apiBaseUrl}${path}`;
    try {
      const response = await fetch(url, { ...options, headers: { ...this._buildHeaders(cfg.accessToken), ...(options.headers || {}) } });
      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
      return { ok: response.ok, status: response.status, data, message: response.ok ? "Requisição RD realizada." : "Erro na requisição RD." };
    } catch (error) {
      return { ok:false, status:"network_error", message:error?.message || "Erro de rede ao consultar RD.", error };
    }
  }
};
