// V40.3.0 — GET /api/admin-tenant-users?tenantId=N (operador LJ only)
// Lista usuários de um tenant (via tenant_members JOIN users) + flag de IA.
// Usado pela tela "Usuários" do cockpit /admin pra ver quem cada cliente já
// tem cadastrado e liberar IA por user.
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isLjOperator && !req.user.isMaster) {
    return res.status(403).json({ ok: false, message: 'Apenas operador LJ.' });
  }

  const tenantId = Number(req.query?.tenantId);
  if (!tenantId) return res.status(400).json({ ok: false, message: 'tenantId obrigatório.' });

  try {
    const r = await req.db.query(
      `SELECT
         u.id, u.username, u.email, u.display_name,
         u.is_master, u.is_approved, u.master_ai_enabled,
         u.created_at, u.last_login_at,
         tm.role, tm.joined_at,
         (SELECT COUNT(*) FROM user_ai_credentials WHERE user_id = u.id) AS has_own_key
       FROM tenant_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.tenant_id = $1
       ORDER BY tm.role = 'owner' DESC, u.created_at ASC`,
      [tenantId]
    );

    const users = (r.rows || []).map(row => ({
      id: row.id,
      username: row.username,
      email: row.email || row.username,
      displayName: row.display_name || row.username,
      role: row.role || 'user',
      isMaster: !!row.is_master,
      isApproved: !!row.is_approved,
      masterAiEnabled: !!row.master_ai_enabled,
      hasOwnAiKey: Number(row.has_own_key) > 0,
      joinedAt: row.joined_at || null,
      lastLoginAt: row.last_login_at || null,
      createdAt: row.created_at || null
    }));

    return res.status(200).json({ ok: true, tenantId, users });
  } catch (err) {
    console.error('[admin-tenant-users]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
