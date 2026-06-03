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

      // V35.13.6 — Auto-clear de sessionExpired em 2xx. Cobre cenário transient:
      // pool de tenant DB ainda inicializando no boot → 401 falso-positivo →
      // sessionExpired marcado → race resolve, POSTs voltam a 200 → modal
      // ficava preso até relogin manual. Agora qualquer 2xx com Auth Bearer
      // sinaliza "auth tá viva", limpa a flag. Idempotente (só limpa se true).
      if (response.status >= 200 && response.status < 300) {
        if (window.App?.state?.sessionExpired) {
          window.App.state.sessionExpired = false;
          // Também fecha modal inline se estava aberto por falso-positivo.
          if (window.App.state.reloginInlineModal?.open) {
            window.App.state.reloginInlineModal = { open: false, error: null, loading: false };
          }
          if (window.App.render) window.App.render();
          if (DEBUG) console.log('[SlidingSession] sessionExpired auto-limpo (2xx confirmou auth viva).');
        }
      }

      // V35.4.3 — A3 (banner discreto pra READs, modal só pra WRITEs).
      // GET 401 → seta sessionExpired flag (banner aparece, não bloqueia).
      // POST/PUT/DELETE/PATCH 401 → modal inline (write precisa de auth válida).
      // Original V34.6.bb: TODO 401 abria modal bloqueante.
      if (response.status === 401) {
        const method = (init?.method || 'GET').toUpperCase();
        const isWrite = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
        setTimeout(() => {
          // Sempre marca sessão como expirada (banner aparece)
          if (window.App?.state && !window.App.state.sessionExpired) {
            window.App.state.sessionExpired = true;
            if (window.App.render) window.App.render();
          }
          // Writes ainda abrem o modal inline (operação destrutiva precisa confirmação)
          if (isWrite && window.Actions?.openReloginInlineModal) {
            window.Actions.openReloginInlineModal();
          }
        }, 0);
      }
    }

    return response;
  };

  if (DEBUG) console.log('[SlidingSession] Interceptor instalado.');
})();
