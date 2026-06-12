// V37.4.22 — GET /api/auth-debug-perms
// Diagnóstico read-only: mostra exatamente o que o backend vê do user logado
// pra rastrear por que resolveUserPermissions retorna role=null.

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  try {
    const userId = req.user.sub;

    const u = await req.db.query(
      'SELECT id, username, email, is_master, default_tenant_id, mode FROM users WHERE id = $1',
      [userId]
    );

    const tm = await req.db.query(
      'SELECT tenant_id, role, permissions_overrides, joined_at FROM tenant_members WHERE user_id = $1',
      [userId]
    );

    let resolverWouldUse = req.user.tenantId || null;
    if (!resolverWouldUse && u.rows[0]?.default_tenant_id) {
      resolverWouldUse = u.rows[0].default_tenant_id;
    }

    return res.status(200).json({
      ok: true,
      backendVersion: 'V37.4.22',
      jwt: {
        sub: req.user.sub,
        username: req.user.username,
        email: req.user.email,
        isMaster: Boolean(req.user.isMaster),
        tenantIdInJwt: req.user.tenantId || null
      },
      userRow: u.rows[0] || null,
      tenantMemberships: tm.rows,
      resolverWouldUseTenantId: resolverWouldUse,
      verdict: !u.rows[0]
        ? 'user_row_missing'
        : !resolverWouldUse
          ? 'no_tenant_id_anywhere'
          : !tm.rows.find(r => Number(r.tenant_id) === Number(resolverWouldUse))
            ? 'no_member_row_for_resolved_tenant'
            : 'should_work_check_deploy_or_caching'
    });
  } catch (err) {
    console.error('[auth-debug-perms]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
