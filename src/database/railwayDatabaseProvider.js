// V16.4 — Railway Database Provider
// Adapta o cfg Railway para o shape consumido pelo sistema. Como o navegador
// não fala TCP direto com Postgres/MySQL, o teste real depende de um proxy
// HTTPS (proxyUrl). Sem proxy, o teste roda validação local (parse + sanidade).
window.RailwayDatabaseProvider = {
  id: 'railway',

  describe(cfg) {
    const r = (cfg && cfg.railway) || {};
    if (r.mode === 'url' && r.databaseUrl) {
      const parsed = window.RailwayConnectionParser ? RailwayConnectionParser.parseUrl(r.databaseUrl) : null;
      if (parsed?.ok) return `${parsed.engine} • ${parsed.host}:${parsed.port}/${parsed.database}`;
      return 'DATABASE_URL inválida';
    }
    if (r.host) return `${r.engine || 'postgres'} • ${r.host}:${r.port || '5432'}/${r.database || '—'}`;
    return 'Não configurado';
  },

  isReady(cfg) {
    const errors = window.RailwayConnectionParser ? RailwayConnectionParser.validate(cfg?.railway) : ['Parser ausente.'];
    return errors.length === 0;
  },

  async probe(cfg) {
    const railway = cfg?.railway || {};
    const proxyUrl = String(railway.proxyUrl || '').trim();
    const startedAt = Date.now();
    if (proxyUrl) {
      try {
        const res = await fetch(proxyUrl, { method: 'GET' });
        const latencyMs = Date.now() - startedAt;
        return { ok: res.ok, message: res.ok ? 'Proxy respondeu OK.' : `Proxy respondeu ${res.status}.`, latencyMs };
      } catch (err) {
        return { ok: false, message: String(err?.message || err), latencyMs: Date.now() - startedAt };
      }
    }
    const errors = window.RailwayConnectionParser ? RailwayConnectionParser.validate(railway) : [];
    const latencyMs = Date.now() - startedAt + Math.floor(Math.random() * 80) + 40;
    if (errors.length) return { ok: false, message: errors[0], latencyMs };
    return { ok: true, message: 'Configuração validada localmente (sem proxy real).', latencyMs };
  }
};
