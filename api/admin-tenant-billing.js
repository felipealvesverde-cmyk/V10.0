// V40.2.0 — GET /api/admin-tenant-billing?tenantId=X (operador LJ only)
// Lista entries de cobrança do tenant + agregados (total pendente, total pago).
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isLjOperator && !req.user.isMaster) {
    return res.status(403).json({ ok: false, message: 'Apenas operador LJ.' });
  }

  const tenantId = Number(req.query.tenantId);
  if (!tenantId) return res.status(400).json({ ok: false, message: 'tenantId obrigatório.' });

  try {
    const tenant = await req.db.query(`SELECT id, slug, name FROM tenants WHERE id = $1`, [tenantId]);
    if (!tenant.rows.length) return res.status(404).json({ ok: false, message: 'Tenant não encontrado.' });

    const entries = await req.db.query(
      `SELECT id, hours, rate, total, status, performed_at, paid_at, note, created_at
       FROM tenant_billing_entries
       WHERE tenant_id = $1
       ORDER BY performed_at DESC, id DESC`,
      [tenantId]
    );

    const totals = await req.db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN status='pending' THEN total ELSE 0 END), 0) AS total_pending,
         COALESCE(SUM(CASE WHEN status='paid' THEN total ELSE 0 END), 0) AS total_paid,
         COALESCE(SUM(hours), 0) AS hours_total
       FROM tenant_billing_entries WHERE tenant_id = $1`,
      [tenantId]
    );

    return res.status(200).json({
      ok: true,
      tenant: tenant.rows[0],
      entries: entries.rows,
      totals: totals.rows[0]
    });
  } catch (err) {
    console.error('[admin-tenant-billing]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
