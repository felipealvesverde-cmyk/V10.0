// V37.5.0 — POST /api/admin-migrate-pins
// Cria tabela `pins` no tenant DB. Idempotente.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas Master LJ.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não plugado.' });

  const results = [];
  try {
    await req.tenantDb.query(`
      CREATE TABLE IF NOT EXISTS pins (
        id BIGSERIAL PRIMARY KEY,
        tenant_id INT NOT NULL,
        creator_user_id INT NOT NULL,
        target_url TEXT NOT NULL,
        anchor_x_pct NUMERIC(6,3) NOT NULL,
        anchor_y_pct NUMERIC(6,3) NOT NULL,
        text VARCHAR(400) NOT NULL,
        audience_user_ids INT[] DEFAULT '{}',
        seen_by_user_ids INT[] DEFAULT '{}',
        archived_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ
      )
    `);
    results.push('pins table ✓');

    await req.tenantDb.query(`
      CREATE INDEX IF NOT EXISTS idx_pins_url_active
        ON pins(tenant_id, target_url)
        WHERE archived_at IS NULL
    `);
    results.push('idx_pins_url_active ✓');

    await req.tenantDb.query(`
      CREATE INDEX IF NOT EXISTS idx_pins_creator
        ON pins(creator_user_id)
    `);
    results.push('idx_pins_creator ✓');

    return res.status(200).json({ ok: true, message: 'Migration pins aplicada.', results });
  } catch (err) {
    console.error('[admin-migrate-pins]', err);
    return res.status(500).json({ ok: false, message: err.message, results });
  }
};
