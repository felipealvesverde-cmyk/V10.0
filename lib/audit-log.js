// V35.4.0 — Audit Log middleware.
//
// Registra cada request autenticada na tabela lj_audit_log do master DB.
// Append-only. Lifecycle: 90 dias (job de limpeza fica em background).
//
// O que registra:
//   user_id, username, is_master, method, path, status_code, ip,
//   user_agent, latency_ms, occurred_at
//
// O que NÃO registra:
//   - body (pode ter dado sensível — exposição em DB de audit é cara)
//   - response (mesmo motivo)
//   - query string (pode ter token; só path)
//
// Uso (em server.js):
//   const { auditMiddleware, cleanupOldAuditLogs } = require('./lib/audit-log');
//   app.use(auditMiddleware());
//   setInterval(() => cleanupOldAuditLogs(pgPool), 24 * 60 * 60 * 1000);

const { redact } = require('./safe-logger');

// Paths que NÃO logamos (alto volume, baixo valor — saúde/heartbeat).
const SKIP_PATHS = new Set([
  '/health', '/healthz', '/ping', '/favicon.ico'
]);

function auditMiddleware() {
  return (req, res, next) => {
    // Pula requests não-autenticadas (login, signup, assets) e healthchecks.
    // Audit só faz sentido pra ações de user logado.
    if (SKIP_PATHS.has(req.path) || req.path.startsWith('/public/')) return next();

    const start = Date.now();
    const pgPool = req.app.get('pgPool');
    if (!pgPool) return next();

    // Registra DEPOIS de responder (não bloqueia o request).
    res.on('finish', () => {
      try {
        const u = req.user || {};
        const userId = Number(u.sub || u.id) || null;
        // Só audita se houve auth (user_id presente) OU se é endpoint auth-relevant.
        // Login/logout sem user_id ainda interessam.
        const isAuthRelevant = req.path.includes('/auth/') || req.path.includes('/login') || req.path.includes('/logout');
        if (!userId && !isAuthRelevant) return;

        const ip = (req.headers['x-forwarded-for'] || req.ip || '').toString().split(',')[0].trim().slice(0, 64);
        const ua = String(req.headers['user-agent'] || '').slice(0, 512);
        const path = String(req.path || '').slice(0, 255);

        pgPool.query(
          `INSERT INTO lj_audit_log
             (user_id, username, is_master, method, path, status_code, ip, user_agent, latency_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            userId,
            u.username ? String(u.username).slice(0, 128) : null,
            Boolean(u.isMaster),
            String(req.method || '').slice(0, 8),
            path,
            res.statusCode,
            ip,
            ua,
            Date.now() - start
          ]
        ).catch(err => {
          // Falha de audit não pode quebrar request. Só loga (com redaction).
          console.warn('[audit-log]', redact(err.message));
        });
      } catch (err) {
        console.warn('[audit-log] middleware err:', redact(err.message));
      }
    });

    next();
  };
}

// Job periódico: deleta logs > 90 dias. Chamado de hora em hora (cheap).
async function cleanupOldAuditLogs(pgPool, retentionDays = 90) {
  if (!pgPool) return;
  try {
    const r = await pgPool.query(
      `DELETE FROM lj_audit_log WHERE occurred_at < NOW() - INTERVAL '${Number(retentionDays) || 90} days'`
    );
    if (r.rowCount > 0) {
      console.log(`[audit-log] retention cleanup: removed ${r.rowCount} rows`);
    }
  } catch (err) {
    console.warn('[audit-log] cleanup err:', redact(err.message));
  }
}

module.exports = { auditMiddleware, cleanupOldAuditLogs };
