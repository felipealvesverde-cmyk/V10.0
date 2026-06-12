// V37.4.0 — POST /api/admin-migrate-notifications
// Cria tabela notifications no TENANT DB (req.tenantDb).
// Idempotente — IF NOT EXISTS em tudo. Master roda quando deploy chega.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas Master LJ.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não plugado.' });

  const results = [];
  try {
    await req.tenantDb.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id BIGSERIAL PRIMARY KEY,
        tenant_id INT NOT NULL,
        user_id INT NOT NULL,
        kind VARCHAR(96) NOT NULL,
        category VARCHAR(32) NOT NULL,
        severity VARCHAR(16) NOT NULL DEFAULT 'info',
        title VARCHAR(255),
        body TEXT,
        data JSONB DEFAULT '{}'::jsonb,
        entity_kind VARCHAR(32),
        entity_id VARCHAR(96),
        source_user_id INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        read_at TIMESTAMPTZ,
        done_at TIMESTAMPTZ,
        saved_at TIMESTAMPTZ,
        snoozed_until TIMESTAMPTZ,
        expires_at TIMESTAMPTZ
      )
    `);
    results.push('notifications table ✓');

    await req.tenantDb.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_inbox
        ON notifications(tenant_id, user_id, created_at DESC)
        WHERE done_at IS NULL AND saved_at IS NULL
    `);
    results.push('idx_notifications_user_inbox ✓');

    await req.tenantDb.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_entity
        ON notifications(entity_kind, entity_id)
        WHERE entity_id IS NOT NULL
    `);
    results.push('idx_notifications_entity ✓');

    await req.tenantDb.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_severity_unread
        ON notifications(tenant_id, user_id, severity)
        WHERE read_at IS NULL AND done_at IS NULL AND saved_at IS NULL
    `);
    results.push('idx_notifications_severity_unread ✓');

    return res.status(200).json({ ok: true, message: 'Migration notifications aplicada.', results });
  } catch (err) {
    console.error('[admin-migrate-notifications]', err);
    return res.status(500).json({ ok: false, message: err.message, results });
  }
};
