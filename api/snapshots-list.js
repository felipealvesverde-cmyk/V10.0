// V31.0.0 — GET /api/snapshots-list (multi-tenant: scoped por owner_user_id)
// Lista os últimos 50 snapshots do user autenticado. POST cria novo snapshot manual.
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  const userId = req.user.sub;

  if (req.method === 'GET') {
    try {
      // V32.0.8 — Snapshot data live em req.tenantDb (tenant plane).
      // users vive em req.db (control plane). Quando tenant tem DB próprio,
      // são DBs separados → não dá pra fazer JOIN. Resolvemos em 2 passos.
      const dataResult = await req.tenantDb.query(
        `SELECT id, label, created_at, triggered_by_user_id
         FROM journey_snapshots
         WHERE owner_user_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId]
      );
      const snaps = dataResult.rows;
      const triggerIds = [...new Set(snaps.map(s => s.triggered_by_user_id).filter(Boolean))];
      let usernameById = {};
      if (triggerIds.length) {
        const usersResult = await req.db.query(
          'SELECT id, username FROM users WHERE id = ANY($1::int[])',
          [triggerIds]
        );
        usernameById = Object.fromEntries(usersResult.rows.map(u => [u.id, u.username]));
      }
      const enriched = snaps.map(s => ({
        id: s.id,
        label: s.label,
        created_at: s.created_at,
        triggered_by: usernameById[s.triggered_by_user_id] || null
      }));
      return res.status(200).json({ ok: true, snapshots: enriched });
    } catch (err) {
      console.error('[snapshots-list GET]', err);
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  if (req.method === 'POST') {
    // Cria snapshot novo. Sandbox bloqueado. Demo já barrado em middleware.
    if (req.user.mode === 'sandbox' && !req.user.isMaster) {
      return res.status(403).json({ ok: false, message: 'Sandbox não persiste snapshots.' });
    }
    const state = req.body?.state;
    const label = String(req.body?.label || 'manual').slice(0, 128);
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ ok: false, message: 'Body precisa de { state, label? }' });
    }
    try {
      // V32.0.8 — req.tenantDb pra dados de snapshot.
      const result = await req.tenantDb.query(
        `INSERT INTO journey_snapshots (state_json, label, triggered_by_user_id, owner_user_id)
         VALUES ($1, $2, $3, $3) RETURNING id, created_at`,
        [state, label, userId]
      );
      // Retenção: mantém últimos 50 do owner, deleta excedentes.
      await req.tenantDb.query(
        `DELETE FROM journey_snapshots
         WHERE owner_user_id = $1
         AND id NOT IN (
           SELECT id FROM journey_snapshots
           WHERE owner_user_id = $1
           ORDER BY created_at DESC LIMIT 50
         )`,
        [userId]
      );
      return res.status(201).json({ ok: true, snapshot: result.rows[0] });
    } catch (err) {
      console.error('[snapshots-list POST]', err);
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  return res.status(405).json({ ok: false, message: 'Use GET ou POST.' });
};
