// V37.4.28 — POST /api/admin-migrate-user-action-tokens
// Cria tabela user_action_tokens se não existir. Idempotente.
//
// Tabela armazena tokens efêmeros pra ações que envolvem confirmação por email:
//   - password_reset: usuário troca senha sem precisar saber a atual
//   - email_change: usuário troca o próprio email
//
// Cada token vincula a um user, expira em 7 dias, vira inválido após used_at.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  // Master ou owner de qualquer tenant.
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
      CREATE TABLE IF NOT EXISTS user_action_tokens (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        action_type VARCHAR(32) NOT NULL,
        token VARCHAR(128) UNIQUE NOT NULL,
        payload JSONB DEFAULT '{}'::jsonb,
        issued_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    results.push('user_action_tokens table ✓');

    await req.db.query('CREATE INDEX IF NOT EXISTS idx_user_action_tokens_token ON user_action_tokens(token)');
    await req.db.query('CREATE INDEX IF NOT EXISTS idx_user_action_tokens_user ON user_action_tokens(user_id, action_type) WHERE used_at IS NULL');
    results.push('user_action_tokens índices ✓');

    return res.status(200).json({ ok: true, message: 'Migration aplicada.', results });
  } catch (err) {
    console.error('[admin-migrate-user-action-tokens]', err);
    return res.status(500).json({ ok: false, message: err.message, results });
  }
};
