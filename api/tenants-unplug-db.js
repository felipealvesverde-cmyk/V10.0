// V32.0.12 — POST /api/tenants-unplug-db (master only)
// Body: { tenant_id, confirm: true }
// Zera tenants.db_connection_string_enc. Tenant volta a operar no control plane.
//
// PERIGO: se o tenant já gravou dados no DB próprio, esses dados FICAM ÓRFÃOS
// (não somem do DB plugado, mas LJ deixa de ler de lá). Use confirm=true pra
// indicar que você sabe disso.
const tenantPoolHelper = require('../lib/tenant-pool');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas master pode desplugar DBs.' });

  const tenantId = Number(req.body?.tenant_id);
  const confirm = req.body?.confirm === true;
  if (!tenantId) return res.status(400).json({ ok: false, message: 'tenant_id obrigatório.' });
  if (!confirm) return res.status(400).json({ ok: false, message: 'confirm: true obrigatório (operação destrutiva).' });

  try {
    const exists = await req.db.query('SELECT id, slug, db_connection_string_enc FROM tenants WHERE id = $1', [tenantId]);
    if (!exists.rows.length) return res.status(404).json({ ok: false, message: 'Tenant não encontrado.' });
    if (!exists.rows[0].db_connection_string_enc) {
      return res.status(200).json({ ok: true, message: 'Tenant já não tem DB plugado.', no_op: true });
    }

    await req.db.query(
      `UPDATE tenants
       SET db_connection_string_enc = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [tenantId]
    );

    tenantPoolHelper.invalidateTenantCache(tenantId);
    await tenantPoolHelper.closeTenantPool(tenantId);

    return res.status(200).json({
      ok: true,
      tenant_id: tenantId,
      slug: exists.rows[0].slug,
      message: `DB desplugado. Tenant ${exists.rows[0].slug} volta a operar no control plane.`
    });
  } catch (err) {
    console.error('[tenants-unplug-db]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
