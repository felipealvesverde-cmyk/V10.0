// V35.14.1 — GET /api/ga4-reports-list
// Lê reports já sincronizados do banco (sem chamar Data API).
// Frontend usa pra hidratar dashboards rápido.
//
// Query params:
//   days: window de dias (default 30, max 365)
//   limit: max rows (default 1000, max 10000)
//
// Response:
//   { ok: true, propertyId, rows: [{ date, dimensions, metrics }], totalRows, syncedAt }

const { readConfig } = require('../lib/ga4-oauth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);
  const days = Math.max(1, Math.min(365, Number(req.query?.days || 30)));
  const limit = Math.max(1, Math.min(10000, Number(req.query?.limit || 1000)));

  try {
    const cfg = await readConfig(req.tenantDb, userId);
    if (!cfg || !cfg.selectedPropertyId) {
      return res.status(200).json({ ok: true, configured: false, rows: [] });
    }

    let result;
    try {
      result = await req.tenantDb.query(
        `SELECT date, dimensions, metrics, synced_at
           FROM lj_ga4_reports_daily
          WHERE user_id = $1
            AND property_id = $2
            AND date >= CURRENT_DATE - $3::int
          ORDER BY date DESC
          LIMIT $4`,
        [userId, cfg.selectedPropertyId, days, limit]
      );
    } catch (err) {
      if (/relation .* does not exist/i.test(err.message || '')) {
        return res.status(200).json({ ok: true, configured: true, rows: [], schemaMissing: true });
      }
      throw err;
    }

    const rows = result.rows.map(r => ({
      date: r.date,
      dimensions: r.dimensions || {},
      metrics: r.metrics || {},
      syncedAt: r.synced_at
    }));

    return res.status(200).json({
      ok: true,
      configured: true,
      propertyId: cfg.selectedPropertyId,
      propertyDisplayName: cfg.propertyDisplayName,
      days,
      rows,
      totalRows: rows.length,
      lastSyncAt: cfg.lastSyncAt
    });
  } catch (err) {
    console.error('[ga4-reports-list]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
