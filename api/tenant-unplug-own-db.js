// V32.1.1 — POST /api/tenant-unplug-own-db
// Cliente desconecta o próprio Postgres do tenant DELE.
// Volta a operar no control plane (fallback) — dados que ficaram no banco
// próprio NÃO são deletados, mas LJ deixa de ler de lá.
//
// Body: { confirm: true }
//
// Segurança: tenant_id vem do JWT (req.user.tenantId), nunca do body.
const tenantPoolHelper = require('../lib/tenant-pool');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const tenantId = req.user.tenantId;
  if (!tenantId) {
    return res.status(400).json({ ok: false, message: 'Você não está associado a um tenant.' });
  }

  const confirm = req.body?.confirm === true;
  if (!confirm) return res.status(400).json({ ok: false, message: 'confirm: true obrigatório (operação destrutiva).' });

  const tenantRow = await req.db.query('SELECT id, slug, name, db_connection_string_enc FROM tenants WHERE id = $1', [tenantId]);
  if (!tenantRow.rows.length) return res.status(404).json({ ok: false, message: 'Tenant não encontrado.' });
  if (!tenantRow.rows[0].db_connection_string_enc) {
    return res.status(200).json({ ok: true, message: 'Tenant já não tem banco próprio plugado.', no_op: true });
  }

  try {
    await req.db.query(
      `UPDATE tenants
       SET db_connection_string_enc = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [tenantId]
    );
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }

  tenantPoolHelper.invalidateTenantCache(tenantId);
  await tenantPoolHelper.closeTenantPool(tenantId);

  return res.status(200).json({
    ok: true,
    tenant_slug: tenantRow.rows[0].slug,
    message: `Banco desplugado. Tenant ${tenantRow.rows[0].name} volta a operar no armazenamento compartilhado.`
  });
};
