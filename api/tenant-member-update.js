// V37.3.2 — POST /api/tenant-member-update
// Atualiza role + permissions_overrides de um membro do tenant.
// Body: { tenantId, userId, role?, permissionsOverrides? }
//
// Quem pode: Master LJ OU owner do tenant (role='owner').
// Não pode: trocar role do PRÓPRIO owner do tenant pra outro role (proteção).
// Não pode: rebaixar a si mesmo se for owner único.

const { ROLES, normalizeRole, PERMISSION_KEYS } = require('../lib/permission-engine');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const { tenantId: rawTenantId, userId: rawUserId, role: rawRole, permissionsOverrides: rawOverrides } = req.body || {};
  const tenantId = Number(rawTenantId || req.user.tenantId);
  const userId = Number(rawUserId);
  if (!tenantId || !userId) return res.status(400).json({ ok: false, message: 'tenantId + userId obrigatórios.' });

  try {
    // Verifica permissão de Admin: Master OU owner do tenant.
    if (!req.user.isMaster) {
      const callerMember = await req.db.query(
        'SELECT role FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
        [tenantId, req.user.sub]
      );
      if (!callerMember.rows.length || normalizeRole(callerMember.rows[0].role) !== 'owner') {
        return res.status(403).json({ ok: false, message: 'Apenas Master ou Admin Master do tenant.' });
      }
    }

    // Verifica target existe.
    const target = await req.db.query(
      `SELECT tm.role, t.owner_user_id
         FROM tenant_members tm
         JOIN tenants t ON t.id = tm.tenant_id
        WHERE tm.tenant_id = $1 AND tm.user_id = $2`,
      [tenantId, userId]
    );
    if (!target.rows.length) return res.status(404).json({ ok: false, message: 'Membro não encontrado.' });
    const isOwnerTarget = target.rows[0].owner_user_id === userId;

    // Bloqueio: não pode rebaixar o owner do tenant (a coluna tenants.owner_user_id segue como referência).
    if (isOwnerTarget && rawRole && normalizeRole(rawRole) !== 'owner') {
      return res.status(400).json({
        ok: false,
        message: 'Não dá pra rebaixar o Admin Master do tenant. Transfira a propriedade antes.'
      });
    }

    // Sanitiza permissionsOverrides — só PERMISSION_KEYS válidos + valores boolean.
    let cleanOverrides = null;
    if (rawOverrides && typeof rawOverrides === 'object') {
      cleanOverrides = {};
      for (const [k, v] of Object.entries(rawOverrides)) {
        if (PERMISSION_KEYS.includes(k) && typeof v === 'boolean') {
          cleanOverrides[k] = v;
        }
      }
    }

    // Atualiza role e/ou overrides.
    const setClauses = [];
    const params = [];
    let idx = 1;
    if (rawRole) {
      const r = normalizeRole(rawRole);
      if (!ROLES.includes(r)) return res.status(400).json({ ok: false, message: `Role inválido: ${rawRole}.` });
      setClauses.push(`role = $${idx++}`);
      params.push(r);
    }
    if (cleanOverrides !== null) {
      setClauses.push(`permissions_overrides = $${idx++}`);
      params.push(JSON.stringify(cleanOverrides));
    }
    if (!setClauses.length) return res.status(400).json({ ok: false, message: 'Nada pra atualizar.' });

    params.push(tenantId, userId);
    await req.db.query(
      `UPDATE tenant_members SET ${setClauses.join(', ')} WHERE tenant_id = $${idx++} AND user_id = $${idx++}`,
      params
    );

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[tenant-member-update]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
