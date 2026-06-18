// V23.0.0 — GET /api/auth-me
// Retorna info do usuário se JWT válido, ou { ok:false } se não.
// Usado pelo client pra checar se a sessão ainda está viva ao recarregar.
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });

  if (!req.user) {
    return res.status(200).json({ ok: false, authenticated: false });
  }

  // V32.0.12 — Inclui info do tenant atual do user no response (pro frontend
  // mostrar badge + saber se ainda tem default_tenant_id válido).
  // Refresca dados do usuário do banco (mode pode ter mudado por aprovação).
  if (req.db) {
    try {
      const result = await req.db.query(
        `SELECT u.id, u.username, u.email, u.is_master, u.is_approved, u.mode, u.default_tenant_id,
                u.display_name,
                COALESCE(u.is_lj_operator, u.is_master) AS is_lj_operator,
                t.slug AS tenant_slug, t.name AS tenant_name, t.status AS tenant_status,
                t.db_connection_string_enc IS NOT NULL AS tenant_db_plugged
         FROM users u
         LEFT JOIN tenants t ON t.id = u.default_tenant_id
         WHERE u.id = $1`,
        [req.user.sub]
      );
      const row = result.rows[0];
      if (!row || !row.is_approved) {
        return res.status(200).json({ ok: false, authenticated: false, message: 'Acesso revogado.' });
      }
      return res.status(200).json({
        ok: true,
        authenticated: true,
        user: {
          id: row.id,
          username: row.username,
          email: row.email,
          displayName: row.display_name || null,
          isMaster: row.is_master,
          isLjOperator: row.is_lj_operator || row.is_master,
          mode: row.mode || 'sandbox',
          tenantId: row.default_tenant_id || null,
          tenantSlug: row.tenant_slug || null,
          tenantName: row.tenant_name || null,
          tenantStatus: row.tenant_status || null,
          tenantDbPlugged: row.tenant_db_plugged || false,
          // V40.0.0 — Se sessão é impersonation, banner amarelo no LJ-cliente.
          impersonatedBy: req.user.impersonatedBy || null
        }
      });
    } catch (err) {
      console.error('[auth-me]', err);
      // Fallback: confia no JWT (sem tenant info enriquecido).
      return res.status(200).json({
        ok: true,
        authenticated: true,
        user: {
          id: req.user.sub,
          username: req.user.username,
          isMaster: req.user.isMaster,
          mode: req.user.mode || 'sandbox',
          tenantId: req.user.tenantId || null
        }
      });
    }
  }

  return res.status(200).json({
    ok: true,
    authenticated: true,
    user: {
      id: req.user.sub,
      username: req.user.username,
      isMaster: req.user.isMaster,
      mode: req.user.mode || 'sandbox',
      tenantId: req.user.tenantId || null
    }
  });
};
