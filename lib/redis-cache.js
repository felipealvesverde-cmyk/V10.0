// V32.3.4 — Cache Redis com graceful degradation.
//
// Filosofia: cache é OTIMIZAÇÃO, não infraestrutura crítica. Se Redis cair,
// fetcher é chamado direto. Aplicação NUNCA fica indisponível por causa de
// Redis indisponível. Logs WARN quando Redis falha, não ERROR.
//
// Uso típico:
//   const cache = require('./redis-cache');
//   const data = await cache.getOrFetch(
//     `clickup:list-meta:${userId}:${listId}`,
//     300, // TTL em segundos
//     () => clickupFetch(db, userId, 'GET', `/list/${listId}`)
//   );
//
// Modo degradado (REDIS_URL ausente OU client falhou):
//   - getOrFetch chama fetcher direto, sem tentar Redis. Zero overhead.
//   - invalidate vira no-op.
//   - isHealthy retorna false.

const redis = require('redis');

let client = null;
let connectionAttempted = false;
let connectionHealthy = false;

function getClient() {
  if (connectionAttempted) return client;
  connectionAttempted = true;

  if (!process.env.REDIS_URL) {
    console.warn('[redis-cache] REDIS_URL ausente — operando em modo degradado (sem cache).');
    return null;
  }

  try {
    client = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        // Timeout curto: se Redis não responder rápido, fallback pro fetcher
        // em vez de travar a request HTTP do user.
        connectTimeout: 1500,
        reconnectStrategy: (retries) => {
          // Backoff exponencial, max 30s. Após 10 falhas seguidas, desiste
          // e marca unhealthy (próximas calls usam fetcher direto).
          if (retries > 10) {
            console.warn('[redis-cache] 10 reconnect attempts falharam — desistindo. App segue sem cache.');
            connectionHealthy = false;
            return false;
          }
          return Math.min(retries * 200, 30000);
        }
      }
    });

    client.on('error', (err) => {
      console.warn('[redis-cache] erro:', err.message);
      connectionHealthy = false;
    });

    client.on('ready', () => {
      console.log('[redis-cache] conectado e pronto.');
      connectionHealthy = true;
    });

    client.on('end', () => {
      connectionHealthy = false;
    });

    // Conecta em background; primeira call vai aguardar via clientReady().
    client.connect().catch((err) => {
      console.warn('[redis-cache] connect inicial falhou:', err.message);
      connectionHealthy = false;
    });

    return client;
  } catch (err) {
    console.warn('[redis-cache] setup falhou:', err.message);
    return null;
  }
}

/**
 * Tenta buscar `key` no Redis. Cache hit → retorna valor parseado.
 * Cache miss OU Redis indisponível → chama `fetcher`, cacheia o resultado
 * com TTL `ttlSec`, retorna valor.
 *
 * Erros do Redis (timeout, connection refused, etc.) NÃO propagam — fetcher
 * vira o caminho de fallback automaticamente.
 *
 * IMPORTANTE: fetcher só é chamado UMA vez por call. Se cache estiver
 * indisponível, fetcher é chamado direto sem tentar gravar depois.
 *
 * @param {string} key — chave única (recomendo namespace + ids)
 * @param {number} ttlSec — TTL em segundos
 * @param {() => Promise<any>} fetcher — função que retorna o valor fresco
 * @returns {Promise<any>}
 */
async function getOrFetch(key, ttlSec, fetcher) {
  const c = getClient();
  if (!c || !connectionHealthy) {
    return fetcher();  // modo degradado: nem tenta Redis
  }

  try {
    const cached = await c.get(key);
    if (cached !== null) {
      try {
        return JSON.parse(cached);
      } catch (_) {
        // Cache corrompido — invalida e refetch
        await c.del(key).catch(() => {});
      }
    }
  } catch (err) {
    console.warn(`[redis-cache] GET ${key} falhou: ${err.message} — fallback pro fetcher.`);
    return fetcher();
  }

  // Miss: busca fresh e cacheia
  const fresh = await fetcher();
  try {
    await c.setEx(key, ttlSec, JSON.stringify(fresh));
  } catch (err) {
    console.warn(`[redis-cache] SET ${key} falhou: ${err.message} — segue sem cachear.`);
  }
  return fresh;
}

/**
 * Remove `key` do cache. No-op se Redis indisponível.
 * Use após mutations que invalidam o estado cacheado.
 */
async function invalidate(key) {
  const c = getClient();
  if (!c || !connectionHealthy) return;
  try {
    await c.del(key);
  } catch (err) {
    console.warn(`[redis-cache] DEL ${key} falhou: ${err.message}`);
  }
}

/**
 * Retorna true se o cliente Redis está conectado e respondendo.
 * Use pra health checks externos.
 */
function isHealthy() {
  getClient();  // garante que tentamos conectar pelo menos uma vez
  return connectionHealthy;
}

module.exports = { getOrFetch, invalidate, isHealthy };
