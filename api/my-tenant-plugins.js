// V40.1.0 — GET /api/my-tenant-plugins (qualquer user autenticado)
// Retorna lista de pluginIds habilitados pro tenant do user atual.
// Operador LJ recebe TUDO (override) — pra debug e fallback em emergência.
// Tenant sem registro pra plugin X: defaultEnabled aplica.
const { getPluginsCatalog } = require('../lib/plugins-catalog');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  const catalog = getPluginsCatalog();

  // Operador LJ vê tudo (override).
  if (req.user.isLjOperator || req.user.isMaster) {
    return res.status(200).json({
      ok: true,
      enabledPluginIds: catalog.map(p => p.id),
      override: 'operator'
    });
  }

  const tenantId = Number(req.user.tenantId);
  if (!tenantId) {
    // User sem tenant (caso raro): default applies.
    return res.status(200).json({
      ok: true,
      enabledPluginIds: catalog.filter(p => p.defaultEnabled).map(p => p.id)
    });
  }
  if (!req.db) {
    // Sem DB: default permissivo.
    return res.status(200).json({
      ok: true,
      enabledPluginIds: catalog.filter(p => p.defaultEnabled).map(p => p.id)
    });
  }

  try {
    const rows = await req.db.query(
      `SELECT plugin_id, enabled FROM tenant_plugins WHERE tenant_id = $1`,
      [tenantId]
    );
    const map = new Map(rows.rows.map(r => [r.plugin_id, Boolean(r.enabled)]));
    const enabledPluginIds = catalog
      .filter(p => map.has(p.id) ? map.get(p.id) : p.defaultEnabled)
      .map(p => p.id);
    return res.status(200).json({ ok: true, enabledPluginIds });
  } catch (err) {
    console.error('[my-tenant-plugins]', err);
    // Fail-open: tenant não fica travado se DB tossir.
    return res.status(200).json({
      ok: true,
      enabledPluginIds: catalog.filter(p => p.defaultEnabled).map(p => p.id),
      degraded: true
    });
  }
};
