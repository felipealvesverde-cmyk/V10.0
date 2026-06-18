// V40.0.0 — POST /api/admin-impersonate-token (operador LJ only)
// Emite JWT temporário pra abrir o LJ-cliente vendo o tenant alvo.
// Token carrega: sub=operadorUserId, tenantId=alvo, impersonatedBy=operadorEmail,
// shortTTL (default 2h). Frontend cliente lê impersonatedBy e mostra banner amarelo.
// Toda ação no LJ-cliente nessa sessão grava em lj_impersonation_audit.
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'lj-dev-secret-change-me';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isLjOperator && !req.user.isMaster) {
    return res.status(403).json({ ok: false, message: 'Apenas operador LJ pode impersonar.' });
  }

  try {
    const { tenantId } = req.body || {};
    if (!tenantId) return res.status(400).json({ ok: false, message: 'tenantId obrigatório.' });

    // Acha um usuário "dono" do tenant alvo (preferencialmente owner_user_id).
    // Senão pega qualquer membro. Senão falha.
    const tenant = await req.db.query(
      `SELECT id, slug, name, owner_user_id FROM tenants WHERE id = $1`,
      [Number(tenantId)]
    );
    if (!tenant.rows.length) return res.status(404).json({ ok: false, message: 'Tenant não encontrado.' });
    const t = tenant.rows[0];

    let targetUserId = t.owner_user_id;
    if (!targetUserId) {
      const fallback = await req.db.query(
        `SELECT user_id FROM tenant_members WHERE tenant_id = $1 LIMIT 1`,
        [Number(tenantId)]
      );
      targetUserId = fallback.rows[0]?.user_id;
    }
    if (!targetUserId) {
      return res.status(409).json({ ok: false, message: 'Tenant sem usuários — crie um primeiro.' });
    }

    const target = await req.db.query(
      `SELECT id, username, email, is_master, mode FROM users WHERE id = $1`,
      [Number(targetUserId)]
    );
    if (!target.rows.length) return res.status(404).json({ ok: false, message: 'Usuário alvo não encontrado.' });
    const u = target.rows[0];

    // Audit: registra início da impersonation.
    try {
      await req.db.query(
        `INSERT INTO lj_impersonation_audit (operator_user_id, target_tenant_id, target_user_id, action, path)
         VALUES ($1, $2, $3, 'impersonate_start', '/admin')`,
        [req.user.sub, Number(tenantId), Number(targetUserId)]
      );
    } catch (e) {
      console.warn('[admin-impersonate-token] audit insert failed (talvez migration não rodou):', e.message);
    }

    const tokenPayload = {
      sub: u.id,
      username: u.username,
      isMaster: false,           // impersonation NUNCA herda master
      isLjOperator: false,       // nem operator
      mode: u.mode || 'sandbox',
      tenantId: Number(tenantId),
      impersonatedBy: req.user.username || req.user.sub,
      impersonatedByUserId: req.user.sub
    };
    // Token curto: 2h. Renovação exige nova chamada deste endpoint.
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '2h' });

    return res.status(200).json({
      ok: true,
      token,
      tenant: { id: t.id, slug: t.slug, name: t.name },
      target: { id: u.id, username: u.username, email: u.email }
    });
  } catch (err) {
    console.error('[admin-impersonate-token]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
