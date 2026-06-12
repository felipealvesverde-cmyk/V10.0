// V37.4.6 — POST /api/admin-migrate-notification-prefs
// Cria tabela notification_preferences no tenant DB. Idempotente.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não plugado.' });
  if (!req.user.isMaster) {
    const tenantId = req.user.tenantId;
    if (!tenantId || !req.db) return res.status(403).json({ ok: false, message: 'Sem tenant ativo.' });
    const m = await req.db.query(
      'SELECT role FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, req.user.sub]
    );
    if (!m.rows.length || String(m.rows[0].role).toLowerCase() !== 'owner') {
      return res.status(403).json({ ok: false, message: 'Apenas Master LJ ou Admin Master do tenant.' });
    }
  }

  const results = [];
  try {
    await req.tenantDb.query(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id BIGSERIAL PRIMARY KEY,
        tenant_id INT NOT NULL,
        user_id INT NOT NULL,
        category VARCHAR(32) NOT NULL,
        in_app BOOLEAN NOT NULL DEFAULT TRUE,
        email BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, user_id, category)
      )
    `);
    results.push('notification_preferences table ✓');

    // Digest semanal opt-in (linha global por user, category=NULL)
    await req.tenantDb.query(`
      CREATE TABLE IF NOT EXISTS notification_digest_optins (
        tenant_id INT NOT NULL,
        user_id INT NOT NULL,
        weekly_digest BOOLEAN NOT NULL DEFAULT FALSE,
        last_digest_sent_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (tenant_id, user_id)
      )
    `);
    results.push('notification_digest_optins table ✓');

    return res.status(200).json({ ok: true, message: 'Migration prefs aplicada.', results });
  } catch (err) {
    console.error('[admin-migrate-notification-prefs]', err);
    return res.status(500).json({ ok: false, message: err.message, results });
  }
};
