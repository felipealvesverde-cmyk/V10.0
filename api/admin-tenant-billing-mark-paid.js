// V40.2.0 — POST /api/admin-tenant-billing-mark-paid (operador LJ only)
// Body: { entryId, paid? (true reverte pra pending se false) }
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isLjOperator && !req.user.isMaster) {
    return res.status(403).json({ ok: false, message: 'Apenas operador LJ.' });
  }

  const { entryId, paid } = req.body || {};
  if (!entryId) return res.status(400).json({ ok: false, message: 'entryId obrigatório.' });

  try {
    const targetStatus = paid === false ? 'pending' : 'paid';
    const targetPaidAt = paid === false ? null : new Date().toISOString();
    const result = await req.db.query(
      `UPDATE tenant_billing_entries
       SET status = $1, paid_at = $2
       WHERE id = $3
       RETURNING id, status, paid_at`,
      [targetStatus, targetPaidAt, Number(entryId)]
    );
    if (!result.rows.length) return res.status(404).json({ ok: false, message: 'Entry não encontrada.' });
    return res.status(200).json({ ok: true, entry: result.rows[0] });
  } catch (err) {
    console.error('[admin-tenant-billing-mark-paid]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
