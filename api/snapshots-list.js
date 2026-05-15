// V23.0.0 — GET /api/snapshots-list
// Lista os últimos 50 snapshots do banco. POST cria um novo snapshot manual.
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  if (req.method === 'GET') {
    try {
      const result = await req.db.query(
        `SELECT s.id, s.label, s.created_at, u.username AS triggered_by
         FROM journey_snapshots s
         LEFT JOIN users u ON u.id = s.triggered_by_user_id
         ORDER BY s.created_at DESC
         LIMIT 50`
      );
      return res.status(200).json({ ok: true, snapshots: result.rows });
    } catch (err) {
      console.error('[snapshots-list GET]', err);
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  if (req.method === 'POST') {
    // Cria snapshot novo. Sandbox bloqueado.
    if (req.user.mode === 'sandbox' && !req.user.isMaster) {
      return res.status(403).json({ ok: false, message: 'Sandbox não persiste snapshots.' });
    }
    const state = req.body?.state;
    const label = String(req.body?.label || 'manual').slice(0, 128);
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ ok: false, message: 'Body precisa de { state, label? }' });
    }
    try {
      const result = await req.db.query(
        `INSERT INTO journey_snapshots (state_json, label, triggered_by_user_id)
         VALUES ($1, $2, $3) RETURNING id, created_at`,
        [state, label, req.user.sub]
      );
      // Retenção: mantém últimos 50, deleta excedentes.
      await req.db.query(
        `DELETE FROM journey_snapshots WHERE id NOT IN (
           SELECT id FROM journey_snapshots ORDER BY created_at DESC LIMIT 50
         )`
      );
      return res.status(201).json({ ok: true, snapshot: result.rows[0] });
    } catch (err) {
      console.error('[snapshots-list POST]', err);
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  return res.status(405).json({ ok: false, message: 'Use GET ou POST.' });
};
