// V23.0.0 — GET/POST /api/state-sync
//
// GET: retorna state atual + updated_at do banco.
//   - Sandbox users: também recebem o state (read-only) pra ver os mesmos dados
//   - Master e production: recebem state completo
//
// POST: salva state no banco.
//   - Body: { state, clientUpdatedAt? }
//   - Sandbox users: rejeitado (403) — escrita só localStorage
//   - Master e production: faz UPSERT em journey_state (id=1)
//   - Conflict resolution: last-write-wins via NOW() do servidor
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  if (req.method === 'GET') {
    try {
      const result = await req.db.query(
        'SELECT state_json, updated_at FROM journey_state WHERE id = 1'
      );
      const row = result.rows[0];
      if (!row) {
        return res.status(200).json({ ok: true, state: null, updatedAt: null });
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
    // V23.0.0 — Sandbox bloqueia gravação no banco.
    if (req.user.mode === 'sandbox' && !req.user.isMaster) {
      return res.status(403).json({ ok: false, message: 'Modo sandbox não persiste no banco.' });
    }

    const state = req.body?.state;
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ ok: false, message: 'Body precisa de { state: {...} }' });
    }

    try {
      await req.db.query(
        `INSERT INTO journey_state (id, state_json, updated_at, updated_by_user_id)
         VALUES (1, $1, NOW(), $2)
         ON CONFLICT (id) DO UPDATE SET
           state_json = EXCLUDED.state_json,
           updated_at = NOW(),
           updated_by_user_id = EXCLUDED.updated_by_user_id`,
        [state, req.user.sub]
      );
      return res.status(200).json({ ok: true, updatedAt: new Date().toISOString() });
    } catch (err) {
      console.error('[state-sync POST]', err);
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  return res.status(405).json({ ok: false, message: 'Use GET ou POST.' });
};
