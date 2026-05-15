// V16.4 — Railway Connection Parser
// Aceita uma DATABASE_URL e devolve campos separados (engine, host, port,
// database, user, password). Também o inverso: campos → DATABASE_URL.
// Apenas validação textual — não toca em network.
window.RailwayConnectionParser = {
  parseUrl(url) {
    const raw = String(url || '').trim();
    if (!raw) return { ok: false, message: 'DATABASE_URL vazia.' };
    const match = raw.match(/^(postgres(?:ql)?|mysql):\/\/([^:@/?#\s]+)(?::([^@/?#\s]+))?@([^:/?#\s]+)(?::(\d+))?\/([^?#\s]+)(?:\?(.*))?$/i);
    if (!match) return { ok: false, message: 'Formato inválido. Esperado: postgresql://user:pass@host:port/db ou mysql://...' };
    const [, scheme, user, password, host, port, database, query] = match;
    const engine = scheme.toLowerCase().startsWith('postgres') ? 'postgres' : 'mysql';
    const ssl = /sslmode=require|ssl=true/i.test(query || '') || true;
    return {
      ok: true,
      engine,
      host,
      port: port || (engine === 'postgres' ? '5432' : '3306'),
      database,
      username: decodeURIComponent(user || ''),
      password: decodeURIComponent(password || ''),
      ssl,
      raw
    };
  },

  buildUrl(cfg) {
    if (!cfg) return '';
    const engine = cfg.engine === 'mysql' ? 'mysql' : 'postgresql';
    const user = encodeURIComponent(cfg.username || '');
    const pass = cfg.password ? `:${encodeURIComponent(cfg.password)}` : '';
    const port = cfg.port ? `:${cfg.port}` : '';
    const ssl = cfg.ssl && engine === 'postgresql' ? '?sslmode=require' : '';
    return `${engine}://${user}${pass}@${cfg.host || ''}${port}/${cfg.database || ''}${ssl}`;
  },

  validate(cfg) {
    const errors = [];
    if (!cfg) return ['Configuração ausente.'];
    if (cfg.mode === 'url') {
      const parsed = this.parseUrl(cfg.databaseUrl);
      if (!parsed.ok) errors.push(parsed.message);
    } else {
      if (!cfg.host) errors.push('Host é obrigatório.');
      if (!cfg.port) errors.push('Porta é obrigatória.');
      if (!cfg.database) errors.push('Database é obrigatório.');
      if (!cfg.username) errors.push('Usuário é obrigatório.');
    }
    return errors;
  },

  mask(url) {
    if (!url) return '';
    return String(url).replace(/(:\/\/[^:]+:)([^@]+)(@)/, '$1••••••••$3');
  }
};
