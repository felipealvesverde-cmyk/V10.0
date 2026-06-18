// V40.4.0 — GET /api/admin-tenants-ai-cost-summary (operador LJ only)
// Retorna custo de IA agregado por tenant — usado pra mostrar "IA gasta"
// no card de cada Tenant na tela /admin sem precisar chamar
// /api/admin-tenant-users por tenant.
//
// Response: { ok: true, tenants: [{ tenantId, totalUsd }] }
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isLjOperator && !req.user.isMaster) {
    return res.status(403).json({ ok: false, message: 'Apenas operador LJ.' });
  }

  try {
    const r = await req.db.query(
      `SELECT tm.tenant_id AS tenant_id,
              COALESCE(SUM(dm.cost_usd), 0) AS total_usd
         FROM tenant_members tm
         LEFT JOIN djow_conversations dc ON dc.user_id = tm.user_id
         LEFT JOIN djow_messages dm ON dm.conversation_id = dc.id
        GROUP BY tm.tenant_id`
    );
    const tenants = (r.rows || []).map(row => ({
      tenantId: Number(row.tenant_id),
      totalUsd: Number(row.total_usd || 0)
    }));
    return res.status(200).json({ ok: true, tenants });
  } catch (err) {
    console.error('[admin-tenants-ai-cost-summary]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
