// V37.4.31 — POST /api/admin-migrate-password-reset-flag
// Adiciona em users as colunas pra fluxo de reset de senha SEM email:
//   - password_reset_pending BOOLEAN — marca user pra trocar senha no próx login
//   - password_reset_expires_at TIMESTAMPTZ — janela de validade (24h default)
//   - password_reset_requested_by_user_id INT — auditoria de quem disparou
//
// Idempotente — IF NOT EXISTS em todas as DDLs.
//
// Quem pode: Master LJ ou owner de qualquer tenant.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  if (!req.user.isMaster) {
    const tenantId = req.user.tenantId;
    if (!tenantId) return res.status(403).json({ ok: false, message: 'Sem tenant ativo.' });
    const m = await req.db.query(
      'SELECT role FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, req.user.sub]
    );
    if (!m.rows.length || String(m.rows[0].role).toLowerCase() !== 'owner') {
      return res.status(403).json({ ok: false, message: 'Apenas Master LJ ou Admin Master de algum tenant.' });
    }
  }

  const results = [];

  try {
    await req.db.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_reset_pending BOOLEAN DEFAULT FALSE
    `);
    results.push('users.password_reset_pending ✓');

    await req.db.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ
    `);
    results.push('users.password_reset_expires_at ✓');

    await req.db.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS password_reset_requested_by_user_id INT REFERENCES users(id) ON DELETE SET NULL
    `);
    results.push('users.password_reset_requested_by_user_id ✓');

    return res.status(200).json({ ok: true, message: 'Migration aplicada.', results });
  } catch (err) {
    console.error('[admin-migrate-password-reset-flag]', err);
    return res.status(500).json({ ok: false, message: err.message, results });
  }
};
