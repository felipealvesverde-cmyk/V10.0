// V37.3.2 — GET /api/tenant-members-list
// Lista membros do tenant ATIVO do user logado (req.user.tenantId).
// Inclui pendências (tenant_invites não-aceitos).
//
// Quem pode chamar: qualquer member do tenant (lê só, sem mexer).
// Master LJ vê membros de qualquer tenant (passa ?tenantId=N).

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  let tenantId = req.user.tenantId;
  if (req.user.isMaster && req.query?.tenantId) {
    tenantId = Number(req.query.tenantId);
  }
  if (!tenantId) return res.status(400).json({ ok: false, message: 'Sem tenant ativo.' });

  try {
    // Verifica que o user é membro do tenant (a menos que seja Master).
    if (!req.user.isMaster) {
      const m = await req.db.query(
        'SELECT 1 FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
        [tenantId, req.user.sub]
      );
      if (!m.rows.length) return res.status(403).json({ ok: false, message: 'Sem acesso a este tenant.' });
    }

    const members = await req.db.query(`
      SELECT
        tm.user_id,
        u.email,
        u.username,
        u.display_name,
        u.mode,
        u.is_approved,
        tm.role,
        tm.permissions_overrides,
        tm.joined_at,
        tm.invited_at,
        (t.owner_user_id = tm.user_id) AS is_owner
      FROM tenant_members tm
      JOIN users u ON u.id = tm.user_id
      JOIN tenants t ON t.id = tm.tenant_id
      WHERE tm.tenant_id = $1
      ORDER BY (t.owner_user_id = tm.user_id) DESC, tm.role ASC, u.email ASC
    `, [tenantId]);

    const invites = await req.db.query(`
      SELECT
        id, invitee_email, role, permissions_overrides,
        expires_at, created_at,
        (expires_at < NOW()) AS expired
      FROM tenant_invites
      WHERE tenant_id = $1 AND accepted_at IS NULL
      ORDER BY created_at DESC
    `, [tenantId]);

    return res.status(200).json({
      ok: true,
      tenantId,
      members: members.rows.map(r => ({
        userId: r.user_id,
        email: r.email,
        username: r.username,
        displayName: r.display_name || null,
        mode: r.mode || 'sandbox',
        isApproved: Boolean(r.is_approved),
        isOwner: Boolean(r.is_owner),
        role: r.role,
        permissionsOverrides: r.permissions_overrides || {},
        joinedAt: r.joined_at,
        invitedAt: r.invited_at
      })),
      pendingInvites: invites.rows.map(r => ({
        id: r.id,
        email: r.invitee_email,
        role: r.role,
        permissionsOverrides: r.permissions_overrides || {},
        expiresAt: r.expires_at,
        createdAt: r.created_at,
        expired: Boolean(r.expired)
      }))
    });
  } catch (err) {
    console.error('[tenant-members-list]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
