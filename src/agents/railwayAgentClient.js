// V16.3 — Railway Agent Client
// Cliente HTTP do Djow. Faz POST para a URL configurada, com timeout e auth.
// Em falha de rede, devolve { ok: false, message } — o caller decide o fallback.
window.RailwayAgentClient = {
  async send(message, context, cfg) {
    if (!cfg?.url) return { ok: false, message: 'URL do agente Djow não configurada.', latencyMs: 0 };
    const endpoint = `${String(cfg.url).replace(/\/+$/, '')}${cfg.endpoint || '/execute'}`;
    const method = (cfg.method || 'POST').toUpperCase();
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), Number(cfg.timeoutMs || 30000));
    const startedAt = Date.now();
    try {
      const res = await fetch(endpoint, {
        method,
        headers,
        signal: controller.signal,
        body: JSON.stringify({ message, context })
      });
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startedAt;
      if (!res.ok) return { ok: false, message: `Djow respondeu ${res.status}.`, latencyMs };
      const data = await res.json();
      return { ok: true, data, latencyMs };
    } catch (err) {
      clearTimeout(timeoutId);
      return { ok: false, message: String(err?.message || err), latencyMs: Date.now() - startedAt };
    }
  },

  async ping(cfg) {
    if (!cfg?.url) return { ok: false, message: 'URL não configurada.' };
    const startedAt = Date.now();
    try {
      const res = await fetch(`${String(cfg.url).replace(/\/+$/, '')}/health`, { method: 'GET' });
      const latencyMs = Date.now() - startedAt;
      return { ok: res.ok, message: res.ok ? 'Online' : `HTTP ${res.status}`, latencyMs };
    } catch (err) {
      return { ok: false, message: String(err?.message || err), latencyMs: Date.now() - startedAt };
    }
  }
};
