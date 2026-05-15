// V23.0.0 — POST /api/snapshots-restore
// Body: { snapshotId }
// Restaura o state daquele snapshot pra journey_state (id=1).
// Só master. Cria um snapshot "pre-restore" automaticamente antes.
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas o master pode restaurar snapshots.' });

  const snapshotId = Number(req.body?.snapshotId);
  if (!snapshotId) return res.status(400).json({ ok: false, message: 'snapshotId obrigatório.' });

  try {
    // 1. Busca o snapshot
    const snap = await req.db.query(
      'SELECT state_json, label, created_at FROM journey_snapshots WHERE id = $1',
      [snapshotId]
    );
    if (!snap.rows[0]) return res.status(404).json({ ok: false, message: 'Snapshot não encontrado.' });

    // 2. Backup do state atual ANTES de restaurar
    const current = await req.db.query('SELECT state_json FROM journey_state WHERE id = 1');
    if (current.rows[0]) {
      await req.db.query(
        `INSERT INTO journey_snapshots (state_json, label, triggered_by_user_id)
         VALUES ($1, $2, $3)`,
        [current.rows[0].state_json, `pre-restore-${new Date().toISOString().slice(0, 19)}`, req.user.sub]
      );
    }

    // 3. Restaura
    await req.db.query(
      `INSERT INTO journey_state (id, state_json, updated_at, updated_by_user_id)
       VALUES (1, $1, NOW(), $2)
       ON CONFLICT (id) DO UPDATE SET
         state_json = EXCLUDED.state_json,
         updated_at = NOW(),
         updated_by_user_id = EXCLUDED.updated_by_user_id`,
      [snap.rows[0].state_json, req.user.sub]
    );

    return res.status(200).json({
      ok: true,
      restoredFrom: {
        id: snapshotId,
        label: snap.rows[0].label,
        createdAt: snap.rows[0].created_at
      }
    });
  } catch (err) {
    console.error('[snapshots-restore]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
