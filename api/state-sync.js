// V31.0.0 — GET/POST /api/state-sync (multi-tenant: chaveado por user_id)
//
// GET: retorna state do user autenticado + updated_at.
//   - Master, production e demo: lê de journey_state WHERE user_id = req.user.sub
//   - Sandbox: também recebe (mas frontend ignora, usa localStorage)
//
// POST: salva state do user autenticado.
//   - Body: { state, clientUpdatedAt? }
//   - Sandbox + Demo: rejeitado (403) — sandbox por design, demo pelo middleware
//   - Master + production: faz UPSERT em journey_state (user_id como PK)
//   - Conflict resolution: last-write-wins via NOW() do servidor
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  const userId = req.user.sub;

  if (req.method === 'GET') {
    try {
      // V32.0.8 — req.tenantDb pra dados (control plane fallback se tenant sem DB próprio).
      const result = await req.tenantDb.query(
        'SELECT state_json, updated_at FROM journey_state WHERE user_id = $1',
        [userId]
      );
      const row = result.rows[0];
      if (!row) {
        return res.status(200).json({ ok: true, state: null, updatedAt: null, mode: req.user.mode || 'sandbox' });
      }
      return res.status(200).json({
        ok: true,
        state: row.state_json,
        updatedAt: row.updated_at,
        mode: req.user.mode || 'sandbox'
      });
    } catch (err) {
      console.error('[state-sync GET]', err);
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  if (req.method === 'POST') {
    // V23.0.0 — Sandbox bloqueia gravação no banco. (Demo já barrado em middleware global.)
    if (req.user.mode === 'sandbox' && !req.user.isMaster) {
      return res.status(403).json({ ok: false, message: 'Modo sandbox não persiste no banco.' });
    }

    const state = req.body?.state;
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ ok: false, message: 'Body precisa de { state: {...} }' });
    }

    // V36.8.3 — GUARD DE EMERGÊNCIA: rejeita state malformado (proteção de
    // último nível, defesa em profundidade). Felipe perdeu Sansone em
    // 2026-06-08/09 porque runHealthCheck (V36.5.0) mandava body
    // { state: { hc_ping: true } } pra "testar conectividade" — endpoint
    // salvava literal sobrescrevendo state legítimo a cada 30s do panel timer.
    // Frontend já não faz mais isso (V36.8.3 mudou pra GET), mas o backend
    // agora rejeita explicitamente esse padrão E qualquer state que NÃO tenha
    // os campos mínimos de um state real do LJ.
    const stateKeys = Object.keys(state);
    const looksLikePing = stateKeys.length <= 2 && (state.hc_ping !== undefined || state.ping !== undefined);
    const hasAnyRealField = ['products', 'campaigns', 'actions', 'leads', 'integrations', 'lastSavedAt'].some(k => state[k] !== undefined);
    if (looksLikePing || !hasAnyRealField) {
      console.warn('[state-sync POST] 🚨 REJEITADO V36.8.3 — body parece ping ou state corrompido.', {
        user_id: userId,
        keys: stateKeys,
        looksLikePing,
        hasAnyRealField
      });
      return res.status(422).json({
        ok: false,
        message: 'State malformado — não tem campos mínimos de um state real (products/campaigns/actions/integrations).',
        keys_received: stateKeys
      });
    }

    // V36.8.3 — Aviso (não bloqueio): se vier 0 produtos, 0 campanhas e 0 ações
    // num tenant que tinha dados antes, loga pra investigação. NÃO bloqueia
    // porque isso pode ser legítimo (cliente novo, reset intencional).
    // Frontend tem guards V36.7.1 e V36.7.2 que cuidam disso na origem.
    try {
      const totalIncoming = (state.products||[]).length + (state.campaigns||[]).length + (state.actions||[]).length;
      if (totalIncoming === 0) {
        const prior = await req.tenantDb.query(
          `SELECT jsonb_array_length(state_json->'products') AS p,
                  jsonb_array_length(state_json->'campaigns') AS c,
                  jsonb_array_length(state_json->'actions') AS a
             FROM journey_state WHERE user_id = $1`,
          [userId]
        );
        const row = prior.rows[0];
        if (row && (row.p > 0 || row.c > 0 || row.a > 0)) {
          console.warn('[state-sync POST] ⚠ Push zerando state que tinha dados.', {
            user_id: userId,
            prior_products: row.p,
            prior_campaigns: row.c,
            prior_actions: row.a
          });
        }
      }
    } catch (_) { /* defensive — não bloqueia se telemetria falhar */ }

    try {
      // V32.0.8 — req.tenantDb pra dados.
      await req.tenantDb.query(
        `INSERT INTO journey_state (user_id, state_json, updated_at, updated_by_user_id)
         VALUES ($1, $2, NOW(), $1)
         ON CONFLICT (user_id) DO UPDATE SET
           state_json = EXCLUDED.state_json,
           updated_at = NOW(),
           updated_by_user_id = EXCLUDED.updated_by_user_id`,
        [userId, state]
      );
      return res.status(200).json({ ok: true, updatedAt: new Date().toISOString() });
    } catch (err) {
      console.error('[state-sync POST]', err);
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  return res.status(405).json({ ok: false, message: 'Use GET ou POST.' });
};
