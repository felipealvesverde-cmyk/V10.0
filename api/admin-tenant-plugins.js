// V40.1.0 — GET /api/admin-tenant-plugins?tenantId=X (operador LJ only)
// Devolve catálogo completo de plugins + status enabled por tenant.
// Tenant sem registro pra plugin X: defaultEnabled aplica.
const { getPluginsCatalog } = require('../lib/plugins-catalog');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isLjOperator && !req.user.isMaster) {
    return res.status(403).json({ ok: false, message: 'Apenas operador LJ.' });
  }

  const tenantId = Number(req.query.tenantId);
  if (!tenantId) return res.status(400).json({ ok: false, message: 'tenantId obrigatório.' });

  try {
    const tenant = await req.db.query(
      `SELECT id, slug, name FROM tenants WHERE id = $1`,
      [tenantId]
    );
    if (!tenant.rows.length) return res.status(404).json({ ok: false, message: 'Tenant não encontrado.' });

    const rows = await req.db.query(
      `SELECT plugin_id, enabled, enabled_at FROM tenant_plugins WHERE tenant_id = $1`,
      [tenantId]
    );
    const map = new Map(rows.rows.map(r => [r.plugin_id, { enabled: r.enabled, enabled_at: r.enabled_at }]));

    const catalog = getPluginsCatalog().map(p => {
      const r = map.get(p.id);
      const enabled = r ? Boolean(r.enabled) : Boolean(p.defaultEnabled);
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        icon: p.icon,
        color: p.color,
        enabled,
        hasRecord: !!r,
        enabledAt: r?.enabled_at || null
      };
    });

    return res.status(200).json({ ok: true, tenant: tenant.rows[0], plugins: catalog });
  } catch (err) {
    console.error('[admin-tenant-plugins]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
