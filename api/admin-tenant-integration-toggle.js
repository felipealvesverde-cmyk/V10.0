// V40.2.0 — POST /api/admin-tenant-integration-toggle (operador LJ only)
// Body: { tenantId, integrationId, enabled }
const { getIntegrationById } = require('../lib/integrations-catalog');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isLjOperator && !req.user.isMaster) {
    return res.status(403).json({ ok: false, message: 'Apenas operador LJ.' });
  }

  const { tenantId, integrationId, enabled } = req.body || {};
  if (!tenantId || !integrationId) {
    return res.status(400).json({ ok: false, message: 'tenantId e integrationId obrigatórios.' });
  }
  if (!getIntegrationById(integrationId)) {
    return res.status(404).json({ ok: false, message: `integrationId desconhecido: ${integrationId}` });
  }

  try {
    await req.db.query(
      `INSERT INTO tenant_integrations (tenant_id, integration_id, enabled, enabled_at, enabled_by_user_id)
       VALUES ($1, $2, $3, NOW(), $4)
       ON CONFLICT (tenant_id, integration_id)
       DO UPDATE SET enabled = EXCLUDED.enabled, enabled_at = NOW(), enabled_by_user_id = EXCLUDED.enabled_by_user_id`,
      [Number(tenantId), String(integrationId), Boolean(enabled), req.user.sub]
    );
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin-tenant-integration-toggle]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
