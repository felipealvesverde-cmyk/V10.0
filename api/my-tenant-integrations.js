// V40.2.0 — GET /api/my-tenant-integrations (qualquer user autenticado)
// Retorna lista de integrationIds habilitados pro tenant do user atual.
// Filtra 'draft' (oculta de tenant comum). Operador LJ recebe TUDO (override).
const { getIntegrationsCatalog } = require('../lib/integrations-catalog');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  const catalog = getIntegrationsCatalog();

  if (req.user.isLjOperator || req.user.isMaster) {
    return res.status(200).json({
      ok: true,
      enabledIntegrationIds: catalog.map(i => i.id),
      override: 'operator'
    });
  }

  const visible = catalog.filter(i => i.status !== 'draft');
  const tenantId = Number(req.user.tenantId);

  if (!tenantId || !req.db) {
    return res.status(200).json({
      ok: true,
      enabledIntegrationIds: visible.filter(i => i.defaultEnabled).map(i => i.id)
    });
  }

  try {
    const rows = await req.db.query(
      `SELECT integration_id, enabled FROM tenant_integrations WHERE tenant_id = $1`,
      [tenantId]
    );
    const map = new Map(rows.rows.map(r => [r.integration_id, Boolean(r.enabled)]));
    const enabledIntegrationIds = visible
      .filter(i => map.has(i.id) ? map.get(i.id) : i.defaultEnabled)
      .map(i => i.id);
    return res.status(200).json({ ok: true, enabledIntegrationIds });
  } catch (err) {
    console.error('[my-tenant-integrations]', err);
    return res.status(200).json({
      ok: true,
      enabledIntegrationIds: visible.filter(i => i.defaultEnabled).map(i => i.id),
      degraded: true
    });
  }
};
