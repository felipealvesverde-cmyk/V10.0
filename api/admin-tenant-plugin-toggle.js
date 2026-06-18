// V40.1.0 — POST /api/admin-tenant-plugin-toggle (operador LJ only)
// Body: { tenantId, pluginId, enabled }
// Upsert em tenant_plugins. Operador define enabled=true (libera) ou
// enabled=false (corta acesso) pra um plugin específico do tenant.
const { getPluginById } = require('../lib/plugins-catalog');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isLjOperator && !req.user.isMaster) {
    return res.status(403).json({ ok: false, message: 'Apenas operador LJ.' });
  }

  const { tenantId, pluginId, enabled } = req.body || {};
  if (!tenantId || !pluginId) {
    return res.status(400).json({ ok: false, message: 'tenantId e pluginId obrigatórios.' });
  }
  if (!getPluginById(pluginId)) {
    return res.status(404).json({ ok: false, message: `pluginId desconhecido: ${pluginId}` });
  }

  try {
    await req.db.query(
      `INSERT INTO tenant_plugins (tenant_id, plugin_id, enabled, enabled_at, enabled_by_user_id)
       VALUES ($1, $2, $3, NOW(), $4)
       ON CONFLICT (tenant_id, plugin_id)
       DO UPDATE SET enabled = EXCLUDED.enabled, enabled_at = NOW(), enabled_by_user_id = EXCLUDED.enabled_by_user_id`,
      [Number(tenantId), String(pluginId), Boolean(enabled), req.user.sub]
    );
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin-tenant-plugin-toggle]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
