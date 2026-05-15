// LeadJourney V13.1.1 — OAuth Runtime Fix
window.RDAuthService = {
  normalize(config = {}) {
    return { ...(window.RDConfig ? RDConfig.defaultConfig() : {}), ...(config || {}) };
  },

  buildAuthorizationUrl(config = {}) {
    const cfg = this.normalize(config);
    if (!cfg.clientId) {
      return { ok: false, message: "Informe o Client ID do app RD." };
    }
    if (!cfg.redirectUri) {
      return { ok: false, message: "Informe a Redirect URI/callback." };
    }

    const url = new URL("https://api.rd.services/auth/dialog");
    url.searchParams.set("client_id", cfg.clientId.trim());
    url.searchParams.set("redirect_uri", cfg.redirectUri.trim());
    url.searchParams.set("response_type", "code");

    return {
      ok: true,
      url: url.toString(),
      message: "URL OAuth gerada com sucesso."
    };
  },

  validateConfig(config = {}) {
    const cfg = this.normalize(config);
    const missing = [];
    if (!cfg.clientId) missing.push("Client ID");
    if (!cfg.clientSecret) missing.push("Client Secret");
    if (!cfg.redirectUri) missing.push("Redirect URI");
    return missing.length
      ? { ok: false, message: `Campos pendentes: ${missing.join(", ")}.` }
      : { ok: true, message: "Configuração mínima RD preenchida." };
  },

  async testConnection(config = {}) {
    const cfg = this.normalize(config);
    const validation = this.validateConfig(cfg);
    if (!validation.ok) return validation;

    // V21.8 — Se já tem accessToken, faz um ping REAL na API do RD CRM
    // (GET /crm/v1/deal_pipelines). Senão, só valida o preenchimento.
    if (cfg.accessToken) {
      try {
        const res = await fetch("https://api.rd.services/crm/v1/deal_pipelines", {
          method: "GET",
          headers: { "Authorization": `Bearer ${cfg.accessToken}` }
        });
        if (res.status === 401) {
          return { ok: false, status: "token_expired", message: "Access Token expirado. Use 'Renovar token' (refresh) ou refaça o OAuth." };
        }
        if (!res.ok) {
          return { ok: false, status: `http_${res.status}`, message: `RD respondeu HTTP ${res.status}.` };
        }
        return {
          ok: true,
          provider: "rd_station",
          status: "connected",
          message: "Conexão real com RD CRM OK.",
          testedAt: new Date().toISOString()
        };
      } catch (err) {
        return { ok: false, status: "network_error", message: `Falha de rede: ${err?.message || err}. Pode ser CORS.` };
      }
    }

    const hasCode = Boolean(cfg.authorizationCode);
    return {
      ok: true,
      provider: "rd_station",
      status: hasCode ? "ready_for_exchange" : "ready_for_oauth",
      message: hasCode
        ? "Code presente. Clique em 'Trocar code por token' para finalizar o OAuth."
        : "RD configurado. Gere a URL OAuth, autorize e cole o code retornado.",
      testedAt: new Date().toISOString()
    };
  },

  // V21.8 — Troca authorization_code por access_token + refresh_token.
  // Chama POST https://api.rd.services/auth/token direto do front. Se o RD
  // bloquear CORS, o catch retorna mensagem nítida pro usuário.
  async exchangeAuthorizationCode(config = {}) {
    const cfg = this.normalize(config);
    if (!cfg.clientId)     return { ok: false, message: "Client ID ausente." };
    if (!cfg.clientSecret) return { ok: false, message: "Client Secret ausente." };
    if (!cfg.authorizationCode) return { ok: false, message: "Authorization Code ausente. Faça o passo OAuth primeiro." };
    try {
      const res = await fetch("https://api.rd.services/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: cfg.clientId.trim(),
          client_secret: cfg.clientSecret.trim(),
          code: cfg.authorizationCode.trim()
        })
      });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (_) { data = { raw: text }; }
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          message: `RD respondeu HTTP ${res.status}: ${data?.error_description || data?.error || JSON.stringify(data) || 'sem corpo'}.`,
          data
        };
      }
      if (!data?.access_token) {
        return { ok: false, message: "Resposta sem access_token.", data };
      }
      const now = Date.now();
      return {
        ok: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || "",
        expiresIn: Number(data.expires_in || 0),
        expiresAt: data.expires_in ? new Date(now + Number(data.expires_in) * 1000).toISOString() : "",
        message: "Token RD obtido."
      };
    } catch (err) {
      return {
        ok: false,
        status: "network_or_cors",
        message: `Falha ao trocar code por token: ${err?.message || err}. Provavelmente CORS — o RD pode estar bloqueando POST direto do navegador.`
      };
    }
  },

  // V21.8 — Renova accessToken usando refresh_token.
  async refreshAccessToken(config = {}) {
    const cfg = this.normalize(config);
    if (!cfg.clientId)     return { ok: false, message: "Client ID ausente." };
    if (!cfg.clientSecret) return { ok: false, message: "Client Secret ausente." };
    if (!cfg.refreshToken) return { ok: false, message: "Refresh Token ausente. Refaça o OAuth." };
    try {
      const res = await fetch("https://api.rd.services/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: cfg.clientId.trim(),
          client_secret: cfg.clientSecret.trim(),
          refresh_token: cfg.refreshToken.trim()
        })
      });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (_) { data = { raw: text }; }
      if (!res.ok || !data?.access_token) {
        return {
          ok: false,
          status: res.status,
          message: `Refresh falhou HTTP ${res.status}: ${data?.error_description || data?.error || 'sem corpo'}.`,
          data
        };
      }
      const now = Date.now();
      return {
        ok: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || cfg.refreshToken,
        expiresIn: Number(data.expires_in || 0),
        expiresAt: data.expires_in ? new Date(now + Number(data.expires_in) * 1000).toISOString() : "",
        message: "Token renovado."
      };
    } catch (err) {
      return {
        ok: false,
        status: "network_or_cors",
        message: `Refresh falhou: ${err?.message || err}.`
      };
    }
  },

  openAuthorizationUrl(config = {}) {
    const result = this.buildAuthorizationUrl(config);
    if (!result.ok) return result;

    try {
      window.open(result.url, "_blank", "noopener,noreferrer");
      return { ...result, opened: true, message: "URL OAuth aberta em nova aba." };
    } catch (error) {
      return { ...result, opened: false, message: "URL gerada, mas o navegador bloqueou a abertura automática." };
    }
  }
};
