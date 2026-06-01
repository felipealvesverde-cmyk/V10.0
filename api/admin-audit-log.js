// V35.4.0 — GET /api/admin-audit-log
// Lê audit log do master DB. Master-only.
//
// Query:
//   user_id     filtra por usuário
//   from_date   YYYY-MM-DD
//   to_date     YYYY-MM-DD
//   path        filtra por path (LIKE)
//   limit       max 500 (default 100)
//   offset

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Master only.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'DB indisponível.' });

  const limit = Math.min(Number(req.query?.limit || 100), 500);
  const offset = Math.max(Number(req.query?.offset || 0), 0);
  const userId = req.query?.user_id ? Number(req.query.user_id) : null;
  const fromDate = req.query?.from_date || null;
  const toDate = req.query?.to_date || null;
  const pathFilter = req.query?.path ? String(req.query.path).trim() : null;

  const where = [];
  const params = [];
  if (userId) { params.push(userId); where.push(`user_id = $${params.length}`); }
  if (fromDate) { params.push(fromDate); where.push(`occurred_at >= $${params.length}::date`); }
  if (toDate) { params.push(toDate); where.push(`occurred_at <= ($${params.length}::date + INTERVAL '1 day')`); }
  if (pathFilter) { params.push('%' + pathFilter + '%'); where.push(`path LIKE $${params.length}`); }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  try {
    const countR = await req.db.query(`SELECT COUNT(*) AS c FROM lj_audit_log ${whereClause}`, params);
    const total = Number(countR.rows[0]?.c || 0);

    params.push(limit);
    params.push(offset);
    const r = await req.db.query(
      `SELECT id, user_id, username, is_master, method, path, status_code,
              ip, user_agent, latency_ms, occurred_at
         FROM lj_audit_log
         ${whereClause}
         ORDER BY occurred_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.status(200).json({ ok: true, total, rows: r.rows, limit, offset });
  } catch (err) {
    console.error('[admin-audit-log]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
