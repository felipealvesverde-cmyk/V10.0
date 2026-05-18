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
      const result = await req.db.query(
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

    try {
      await req.db.query(
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
