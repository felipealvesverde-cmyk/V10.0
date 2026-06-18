// V40.2.0 — POST /api/admin-tenant-billing-add (operador LJ only)
// Body: { tenantId, hours, rate, performedAt? (YYYY-MM-DD), note? }
// Cria entry de cobrança em status='pending'.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isLjOperator && !req.user.isMaster) {
    return res.status(403).json({ ok: false, message: 'Apenas operador LJ.' });
  }

  const { tenantId, hours, rate, performedAt, note } = req.body || {};
  if (!tenantId || hours == null || rate == null) {
    return res.status(400).json({ ok: false, message: 'tenantId, hours e rate obrigatórios.' });
  }
  const h = Number(hours);
  const r = Number(rate);
  if (!isFinite(h) || h <= 0) return res.status(400).json({ ok: false, message: 'hours inválido.' });
  if (!isFinite(r) || r < 0) return res.status(400).json({ ok: false, message: 'rate inválido.' });

  try {
    const result = await req.db.query(
      `INSERT INTO tenant_billing_entries (tenant_id, hours, rate, performed_at, note, created_by_user_id)
       VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE), $5, $6)
       RETURNING id, hours, rate, total, status, performed_at, paid_at, note, created_at`,
      [Number(tenantId), h, r, performedAt || null, note || null, req.user.sub]
    );
    return res.status(200).json({ ok: true, entry: result.rows[0] });
  } catch (err) {
    console.error('[admin-tenant-billing-add]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
