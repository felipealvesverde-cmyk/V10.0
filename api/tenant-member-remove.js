// V37.3.2 — POST /api/tenant-member-remove
// Remove um membro do tenant (revoga membership). User na users table fica.
// Body: { tenantId, userId }
//
// Quem pode: Master LJ OU owner do tenant.
// Não pode: remover o próprio owner do tenant (tenants.owner_user_id).

const { normalizeRole } = require('../lib/permission-engine');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const { tenantId: rawTenantId, userId: rawUserId } = req.body || {};
  const tenantId = Number(rawTenantId || req.user.tenantId);
  const userId = Number(rawUserId);
  if (!tenantId || !userId) return res.status(400).json({ ok: false, message: 'tenantId + userId obrigatórios.' });

  try {
    if (!req.user.isMaster) {
      const callerMember = await req.db.query(
        'SELECT role FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
        [tenantId, req.user.sub]
      );
      if (!callerMember.rows.length || normalizeRole(callerMember.rows[0].role) !== 'owner') {
        return res.status(403).json({ ok: false, message: 'Apenas Master ou Admin Master.' });
      }
    }

    const target = await req.db.query(
      `SELECT t.owner_user_id FROM tenants t WHERE t.id = $1`,
      [tenantId]
    );
    if (!target.rows.length) return res.status(404).json({ ok: false, message: 'Tenant não encontrado.' });
    if (target.rows[0].owner_user_id === userId) {
      return res.status(400).json({ ok: false, message: 'Não dá pra remover o Admin Master do tenant. Transfira a propriedade antes.' });
    }

    const del = await req.db.query(
      'DELETE FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
      [tenantId, userId]
    );
    if (del.rowCount === 0) return res.status(404).json({ ok: false, message: 'Membro já não estava no tenant.' });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[tenant-member-remove]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
