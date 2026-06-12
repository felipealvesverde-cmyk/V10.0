// V37.3.1 — POST /api/admin-migrate-permissions
// Adiciona coluna permissions_overrides JSONB em tenant_members se não existir.
// Idempotente — pode rodar várias vezes sem efeito colateral.
//
// Quem pode rodar: Master LJ (is_master=true) apenas.
// Por que via endpoint: control plane DB não tem sistema de migrations
// automatizado. Master roda pra migrar quando deploy chega.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas Master LJ.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const results = [];

  try {
    // 1. Adiciona permissions_overrides JSONB se não existir.
    await req.db.query(`
      ALTER TABLE tenant_members
        ADD COLUMN IF NOT EXISTS permissions_overrides JSONB DEFAULT '{}'::jsonb
    `);
    results.push('tenant_members.permissions_overrides JSONB ✓');

    // 2. Garantir que role tem valor default e check válido. Tenant criado em
    //    V32 já tinha role text. Vamos normalizar pra garantir lower e válido.
    await req.db.query(`
      UPDATE tenant_members
        SET role = LOWER(role)
        WHERE role IS NOT NULL AND role != LOWER(role)
    `);
    results.push('tenant_members.role normalizado pra lowercase ✓');

    // 3. Default 'user' em role se NULL.
    await req.db.query(`
      UPDATE tenant_members SET role = 'user' WHERE role IS NULL OR role = ''
    `);
    results.push('tenant_members.role default user em NULL/vazio ✓');

    // 4. Garante coluna invite_token + invite_email + invite_expires_at em
    //    tabela tenant_invites (criada se não existir).
    await req.db.query(`
      CREATE TABLE IF NOT EXISTS tenant_invites (
        id SERIAL PRIMARY KEY,
        tenant_id INT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        inviter_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invitee_email VARCHAR(192) NOT NULL,
        role VARCHAR(32) NOT NULL DEFAULT 'user',
        permissions_overrides JSONB DEFAULT '{}'::jsonb,
        token VARCHAR(64) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        accepted_at TIMESTAMPTZ,
        accepted_user_id INT REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    results.push('tenant_invites table ✓');

    await req.db.query(`
      CREATE INDEX IF NOT EXISTS idx_tenant_invites_token ON tenant_invites(token)
    `);
    await req.db.query(`
      CREATE INDEX IF NOT EXISTS idx_tenant_invites_tenant ON tenant_invites(tenant_id) WHERE accepted_at IS NULL
    `);
    results.push('tenant_invites índices ✓');

    return res.status(200).json({
      ok: true,
      message: 'Migration aplicada.',
      results
    });
  } catch (err) {
    console.error('[admin-migrate-permissions]', err);
    return res.status(500).json({
      ok: false,
      message: err.message,
      results
    });
  }
};
