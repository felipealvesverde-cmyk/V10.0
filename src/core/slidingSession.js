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

  // V36.3.5 — Debounce de 401 transient. Acumula timestamps dos últimos 401s
  // com Auth Bearer; só dispara sessionExpired quando há THRESHOLD_401 em
  // janela de 10s. Diagnose Felipe 2026-06-08 confirmou servidor com 401
  // ocasional em POSTs apesar de JWT válido.
  const _recent401s = [];
  const THRESHOLD_401 = 3;

  // V36.5.0 — Flag pra evitar múltiplas chamadas de auth-debug em paralelo
  // quando 401s chegam em rajada. Só 1 verificação por vez.
  let _orphanCheckInFlight = false;

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
        // V36.3.5 — Reseta contador de 401s (auth tá viva, qualquer 401 anterior
        // era transient — desconsidera pra cálculo de threshold).
        if (_recent401s.length) _recent401s.length = 0;
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

      // V36.4.0 — Tela vermelha ELIMINADA. Felipe pediu (e reforçou 2026-06-08):
      // 401 NUNCA dispara modal automático. Só seta sessionExpired=true
      // (banner discreto no topo). Cliente decide quando reentrar clicando
      // no botão "Reentrar" do banner — aí abre modal friendly (violeta).
      //
      // Por que isso ainda atende [[jwt_silent_failure_law]]:
      //   - 401 NÃO é silencioso (banner é visível)
      //   - Cliente NÃO perde trabalho (App.state preservado, alterações
      //     em memória continuam)
      //   - NÃO há logout automático (banner continua até cliente reentrar)
      //
      // V36.3.5 — Debounce de transient 401 PRESERVADO. Mesmo o banner
      // discreto só aparece após THRESHOLD 401s em janela de 10s. 401
      // isolado (transient bug do servidor) fica silencioso. 401 persistente
      // (JWT realmente expirou) ainda mostra banner — porque cada request
      // do app vai gerar mais 401, atingindo threshold em <1s.
      if (response.status === 401) {
        const now = Date.now();
        _recent401s.push(now);
        const cutoff = now - 10_000;
        while (_recent401s.length && _recent401s[0] < cutoff) _recent401s.shift();

        if (_recent401s.length >= THRESHOLD_401) {
          // V36.5.0 — Antes de mostrar banner, checa se o token está órfão
          // (assinatura inválida + não expirado = JWT_SECRET rotacionada sem
          // PREVIOUS). Se sim, faz logout limpo + redirect pra login — sem
          // deixar cliente preso na Home com banner persistente.
          if (!_orphanCheckInFlight) {
            _orphanCheckInFlight = true;
            setTimeout(async () => {
              try {
                const jwt = localStorage.getItem('lj_jwt');
                if (jwt) {
                  const dbg = await _originalFetch('/api/auth-debug', {
                    headers: { Authorization: `Bearer ${jwt}` }
                  }).then(r => r.json());
                  const mw = dbg?.middleware_verify_result || {};
                  const pd = dbg?.token_payload_decoded || {};
                  if (mw.ok === false && pd.already_expired === false) {
                    console.warn('[SlidingSession] 🚨 Token órfão detectado durante uso. Limpando e redirecionando.', {
                      motivo: mw.error,
                      previous_configurada: dbg?.jwt_secret_previous?.configured
                    });
                    localStorage.removeItem('lj_jwt');
                    localStorage.removeItem('lj_user');
                    // Salva state local em sessionStorage pra recuperação manual
                    try {
                      const st = window.App?.state;
                      if (st) sessionStorage.setItem('lj_state_recovery', JSON.stringify(st));
                    } catch (_) {}
                    location.href = '/';
                    return;
                  }
                }
              } catch (_) { /* silent */ }
              _orphanCheckInFlight = false;
              // Se não é órfão (server bug 401 transient), mostra banner normalmente.
              if (window.App?.state && !window.App.state.sessionExpired) {
                window.App.state.sessionExpired = true;
                if (window.App.render) window.App.render();
              }
            }, 0);
          }
        } else if (DEBUG) {
          console.log(`[SlidingSession] 401 transient ignorado (${_recent401s.length}/${THRESHOLD_401} em janela 10s).`);
        }
      }
    }

    return response;
  };

  if (DEBUG) console.log('[SlidingSession] Interceptor instalado.');
})();
