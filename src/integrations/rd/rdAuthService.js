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

    const hasCodeOrToken = Boolean(cfg.authorizationCode || cfg.accessToken || cfg.refreshToken);
    return {
      ok: true,
      provider: "rd_station",
      status: hasCodeOrToken ? "ready_for_api_test" : "ready_for_oauth",
      message: hasCodeOrToken
        ? "RD configurado. Code/token encontrado para próximas fases."
        : "RD configurado. Gere a URL OAuth, autorize e cole o code retornado.",
      testedAt: new Date().toISOString()
    };
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
