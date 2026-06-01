// V35.4.0 — Rate Limiter por tenant.
//
// Sliding window simples baseado em Redis INCR + EXPIRE.
// Bucket de 60s. Key: ratelimit:<tenant>:<minute_bucket>.
//
// Master sem limite. Cliente atacado/bugado vira gargalo só pra ele —
// outros tenants continuam respondendo.
//
// Fail-open: se Redis cai/timeout, request passa (não bloqueia user).
// Razão: rate limit não é proteção crítica; melhor servir do que negar.
//
// API:
//   const limiter = createRateLimiter({ redisClient, windowMs: 60000, max: 1000 });
//   app.use('/api', limiter);

const { redact } = require('./safe-logger');

const DEFAULTS = {
  windowMs: 60 * 1000,        // 1 minuto
  max: 1000,                  // 1000 req/min por tenant
  skipMaster: true,
  message: 'Rate limit excedido. Tente novamente em alguns segundos.'
};

function tenantKeyFromReq(req) {
  // Prioridade: user_id autenticado > IP. Identificador único por requisitor.
  const u = req.user || {};
  if (u.sub || u.id) return `u:${u.sub || u.id}`;
  const ip = String(req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
  return `ip:${ip}`;
}

function createRateLimiter(opts = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const redisClient = opts.redisClient;
  const memoryFallback = new Map(); // { key: { count, expiresAt } }

  return async function rateLimitMiddleware(req, res, next) {
    try {
      const u = req.user || {};
      if (cfg.skipMaster && u.isMaster) return next();

      const tenantKey = tenantKeyFromReq(req);
      const bucket = Math.floor(Date.now() / cfg.windowMs);
      const key = `ratelimit:${tenantKey}:${bucket}`;

      let count = null;

      if (redisClient && redisClient.isOpen) {
        // Caminho Redis (preferido)
        try {
          const multi = redisClient.multi();
          multi.incr(key);
          multi.expire(key, Math.ceil(cfg.windowMs / 1000));
          const results = await multi.exec();
          count = Number(results?.[0]) || 0;
        } catch (err) {
          console.warn('[rate-limit] redis err — fail-open:', redact(err.message));
          return next();
        }
      } else {
        // Fallback em memória (per-process)
        const now = Date.now();
        const entry = memoryFallback.get(key);
        if (entry && entry.expiresAt > now) {
          entry.count++;
          count = entry.count;
        } else {
          memoryFallback.set(key, { count: 1, expiresAt: now + cfg.windowMs });
          count = 1;
          // Cleanup oportunístico: remove expirados se mapa cresceu
          if (memoryFallback.size > 1000) {
            for (const [k, v] of memoryFallback) {
              if (v.expiresAt <= now) memoryFallback.delete(k);
            }
          }
        }
      }

      if (count > cfg.max) {
        res.setHeader('Retry-After', String(Math.ceil(cfg.windowMs / 1000)));
        res.setHeader('X-RateLimit-Limit', String(cfg.max));
        res.setHeader('X-RateLimit-Remaining', '0');
        return res.status(429).json({ ok: false, message: cfg.message });
      }

      res.setHeader('X-RateLimit-Limit', String(cfg.max));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, cfg.max - count)));
      next();
    } catch (err) {
      // Defesa final: nunca quebra request por erro de rate limit
      console.warn('[rate-limit] middleware err — fail-open:', redact(err.message));
      next();
    }
  };
}

module.exports = { createRateLimiter };
