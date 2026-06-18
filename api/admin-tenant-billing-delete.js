// V40.2.0 — POST /api/admin-tenant-billing-delete (operador LJ only)
// Body: { entryId }
// Apaga entry de cobrança. Hard delete — sem soft delete por enquanto.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isLjOperator && !req.user.isMaster) {
    return res.status(403).json({ ok: false, message: 'Apenas operador LJ.' });
  }

  const { entryId } = req.body || {};
  if (!entryId) return res.status(400).json({ ok: false, message: 'entryId obrigatório.' });

  try {
    const result = await req.db.query(
      `DELETE FROM tenant_billing_entries WHERE id = $1 RETURNING id`,
      [Number(entryId)]
    );
    if (!result.rows.length) return res.status(404).json({ ok: false, message: 'Entry não encontrada.' });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin-tenant-billing-delete]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
