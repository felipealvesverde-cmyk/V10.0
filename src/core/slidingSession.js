// V33.0.0 — Sliding Session interceptor.
//
// Monkey-patcha window.fetch pra interceptar TODAS as responses do LJ. Quando
// o backend retorna header `X-Auth-Refresh: <new-jwt>`, atualiza localStorage
// silenciosamente. Cliente ativo nunca mais vê tela de relogin enquanto usar
// o LJ a cada <24h.
//
// Cliente inativo >24h consecutivas → JWT expira → 401 → ReloginInlineModal
// (V32.12.4) aparece. Sliding Session é PREVENÇÃO; o modal é REMEDIAÇÃO.
//
// Cuidados:
// - Só processa response se a request original tinha header Authorization: Bearer.
//   Evita interferir em fetches pra CDNs (Tailwind, Lucide, etc).
// - Não bloqueia a Promise da request — patch é transparente.
// - Não loga em produção pra não poluir console; só em dev.

(function() {
  'use strict';

  if (window.__LJ_SLIDING_SESSION_INSTALLED__) return;
  window.__LJ_SLIDING_SESSION_INSTALLED__ = true;

  const _originalFetch = window.fetch.bind(window);
  const DEBUG = false; // ligar pra ver renovações no console

  window.fetch = async function(...args) {
    const [input, init] = args;

    // Detecta se a request enviou Authorization Bearer (única fonte de tokens nossos)
    const hadAuthBearer = (() => {
      const headers = (init && init.headers) || (input && input.headers) || null;
      if (!headers) return false;
      let value = null;
      if (typeof headers.get === 'function') {
        value = headers.get('Authorization') || headers.get('authorization');
      } else if (headers && typeof headers === 'object') {
        value = headers.Authorization || headers.authorization;
      }
      return typeof value === 'string' && value.startsWith('Bearer ');
    })();

    const response = await _originalFetch(...args);

    // Só processa se request tinha bearer (request nossa) E response tem header refresh.
    if (hadAuthBearer) {
      try {
        const refreshed = response.headers.get('X-Auth-Refresh');
        if (refreshed && refreshed.length > 20) {
          const previous = localStorage.getItem('lj_jwt');
          if (refreshed !== previous) {
            localStorage.setItem('lj_jwt', refreshed);
            if (DEBUG) console.log('[SlidingSession] JWT renovado silenciosamente');
          }
        }
      } catch (_) {
        // Falha em ler header (CORS bloqueado, etc) — silencioso. Não afeta a request.
      }
    }

    return response;
  };

  if (DEBUG) console.log('[SlidingSession] Interceptor instalado.');
})();
