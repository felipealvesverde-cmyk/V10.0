// V35.11.0 — /api/rd-webhook-log
//
// GET com filtros + paginação. Filtros suportados:
//   ?status=ok|error|all       (default: all)
//   ?event_type=<tipo>         (ex: crm_contact_created)
//   ?period=24h|7d|30d|all     (default: 7d — bate com retention)
//   ?search=<texto>            (busca em event_type, error_message, rd_contact_id, payload_excerpt)
//   ?page=N                    (1-indexed; default 1)
//   ?per_page=N                (default 50, max 200)
//   ?format=csv                (download CSV completo dos filtros — sem paginação, max 5000 linhas)
//
// Master pode passar ?user_id=X pra inspecionar outro tenant.

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const myId = Number(req.user.sub || req.user.id);
  const scopeUserId = (req.user.isMaster && req.query?.user_id) ? Number(req.query.user_id) : myId;
  if (!scopeUserId) return res.status(401).json({ ok: false, message: 'JWT sem user id.' });

  const status = String(req.query?.status || 'all').toLowerCase();
  const eventType = String(req.query?.event_type || '').trim();
  const period = String(req.query?.period || '7d').toLowerCase();
  const search = String(req.query?.search || '').trim();
  const isCsv = String(req.query?.format || '').toLowerCase() === 'csv';
  const page = Math.max(1, Number(req.query?.page) || 1);
  const perPage = Math.min(200, Math.max(10, Number(req.query?.per_page) || 50));

  const wheres = ['user_id = $1'];
  const params = [scopeUserId];
  let p = 1;

  if (status === 'ok' || status === 'error') {
    p++;
    wheres.push(`status = $${p}`);
    params.push(status);
  }
  if (eventType) {
    p++;
    wheres.push(`event_type = $${p}`);
    params.push(eventType);
  }
  const periodMap = { '24h': '24 hours', '7d': '7 days', '30d': '30 days' };
  if (periodMap[period]) {
    wheres.push(`received_at > NOW() - INTERVAL '${periodMap[period]}'`);
  }
  if (search) {
    p++;
    wheres.push(`(event_type ILIKE $${p} OR error_message ILIKE $${p} OR rd_contact_id ILIKE $${p} OR payload_excerpt::text ILIKE $${p})`);
    params.push(`%${search}%`);
  }

  const whereClause = wheres.join(' AND ');

  try {
    if (isCsv) {
      const r = await req.tenantDb.query(
        `SELECT id, received_at, event_type, status, error_category, error_message,
                rd_contact_id, processing_ms
           FROM lj_rd_webhook_log
          WHERE ${whereClause}
          ORDER BY received_at DESC
          LIMIT 5000`,
        params
      );
      const csv = toCsv(r.rows);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="rd-webhook-log-${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.status(200).send(csv);
    }

    const offset = (page - 1) * perPage;
    p++;
    const limitParam = `$${p}`;
    params.push(perPage);
    p++;
    const offsetParam = `$${p}`;
    params.push(offset);

    const [items, total] = await Promise.all([
      req.tenantDb.query(
        `SELECT id, received_at, event_type, status, error_category, error_message,
                rd_contact_id, payload_excerpt, processing_ms, user_read_at
           FROM lj_rd_webhook_log
          WHERE ${whereClause}
          ORDER BY received_at DESC
          LIMIT ${limitParam} OFFSET ${offsetParam}`,
        params
      ),
      req.tenantDb.query(
        `SELECT COUNT(*)::int AS c FROM lj_rd_webhook_log WHERE ${whereClause}`,
        params.slice(0, p - 2)
      )
    ]);

    const totalCount = total.rows[0]?.c || 0;
    return res.status(200).json({
      ok: true,
      items: items.rows,
      total: totalCount,
      page,
      perPage,
      totalPages: Math.max(1, Math.ceil(totalCount / perPage))
    });
  } catch (err) {
    console.error('[rd-webhook-log]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
};

function toCsv(rows) {
  const headers = ['id', 'received_at', 'event_type', 'status', 'error_category', 'error_message', 'rd_contact_id', 'processing_ms'];
  const escape = (v) => {
    if (v == null) return '';
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [headers.join(',')];
  rows.forEach(r => {
    lines.push(headers.map(h => escape(r[h])).join(','));
  });
  return lines.join('\n');
}
