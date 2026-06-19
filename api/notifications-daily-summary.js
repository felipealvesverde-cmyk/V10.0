// V37.4.4 — GET /api/notifications-daily-summary
// Agrega notifications "desde última visita" pro card Bom Dia na Home.
// Query: ?since=ISO_DATE (default: últimas 24h)

const { buildNotificationsDailySummary } = require('../lib/demo-system-mocks');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  // V40.7.19 — Branch demo.
  if (req.user.username === 'demo@leadjourney.app') {
    return res.status(200).json(buildNotificationsDailySummary(req.query || {}));
  }

  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não plugado.' });

  const tenantId = req.user.tenantId;
  const userId = req.user.sub;
  if (!tenantId) return res.status(400).json({ ok: false, message: 'Sem tenant ativo.' });

  const since = req.query?.since
    ? new Date(req.query.since)
    : new Date(Date.now() - 24 * 3600 * 1000);

  if (isNaN(since.getTime())) return res.status(400).json({ ok: false, message: 'since inválido.' });

  try {
    // Counts gerais
    const overall = await req.tenantDb.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE severity = 'critical') AS critical,
        COUNT(*) FILTER (WHERE severity = 'warning') AS warning,
        COUNT(*) FILTER (WHERE severity = 'info') AS info
      FROM notifications
      WHERE tenant_id = $1 AND user_id = $2 AND created_at > $3 AND done_at IS NULL
    `, [tenantId, userId, since.toISOString()]);

    // Top categorias
    const byCategory = await req.tenantDb.query(`
      SELECT category, COUNT(*) AS count
      FROM notifications
      WHERE tenant_id = $1 AND user_id = $2 AND created_at > $3 AND done_at IS NULL
      GROUP BY category
      ORDER BY count DESC
    `, [tenantId, userId, since.toISOString()]);

    // Top eventos por kind (até 5)
    const topKinds = await req.tenantDb.query(`
      SELECT kind, COUNT(*) AS count
      FROM notifications
      WHERE tenant_id = $1 AND user_id = $2 AND created_at > $3 AND done_at IS NULL
      GROUP BY kind
      ORDER BY count DESC
      LIMIT 8
    `, [tenantId, userId, since.toISOString()]);

    // Highlights: até 3 itens críticos + warnings
    const highlights = await req.tenantDb.query(`
      SELECT id, kind, category, severity, title, data, entity_kind, entity_id, created_at
      FROM notifications
      WHERE tenant_id = $1 AND user_id = $2 AND created_at > $3
        AND done_at IS NULL
        AND severity IN ('critical', 'warning')
      ORDER BY (severity = 'critical') DESC, created_at DESC
      LIMIT 3
    `, [tenantId, userId, since.toISOString()]);

    return res.status(200).json({
      ok: true,
      since: since.toISOString(),
      overall: {
        total: Number(overall.rows[0]?.total || 0),
        critical: Number(overall.rows[0]?.critical || 0),
        warning: Number(overall.rows[0]?.warning || 0),
        info: Number(overall.rows[0]?.info || 0)
      },
      byCategory: byCategory.rows.map(r => ({ category: r.category, count: Number(r.count) })),
      topKinds: topKinds.rows.map(r => ({ kind: r.kind, count: Number(r.count) })),
      highlights: highlights.rows.map(r => ({
        id: r.id, kind: r.kind, category: r.category, severity: r.severity,
        title: r.title, data: r.data || {}, entityKind: r.entity_kind, entityId: r.entity_id,
        createdAt: r.created_at
      }))
    });
  } catch (err) {
    console.error('[notifications-daily-summary]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
