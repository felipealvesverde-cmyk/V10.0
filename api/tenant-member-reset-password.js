// V37.4.31 — POST /api/tenant-member-reset-password
// Admin master ou owner do tenant marca um membro pra TROCAR senha no próximo login.
// Não manda email. Não gera senha temporária. Não invalida senha atual.
//
// Fluxo:
//   1. Admin clica "Resetar senha" no Editar Membro
//   2. Este endpoint marca users.password_reset_pending=true + expira em 24h
//   3. No próximo login, auth-login detecta a flag e retorna passwordResetPending=true
//      ANTES de validar senha. Frontend troca pra tela "Defina sua nova senha"
//   4. Endpoint /api/auth-complete-password-reset finaliza (hasheia + zera flag)
//
// Body: { userId }
// Auth: Master LJ OU owner do tenant do membro alvo.

const { normalizeRole } = require('../lib/permission-engine');

const PENDING_WINDOW_HOURS = 24;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const targetUserId = Number(req.body?.userId);
  if (!targetUserId) return res.status(400).json({ ok: false, message: 'userId obrigatório.' });

  const tenantId = Number(req.user.tenantId);

  try {
    // Membro tem que existir no tenant do admin (ou admin é master LJ).
    const m = await req.db.query(
      'SELECT tenant_id, role FROM tenant_members WHERE user_id = $1 AND tenant_id = $2',
      [targetUserId, tenantId]
    );
    if (!m.rows.length && !req.user.isMaster) {
      return res.status(404).json({ ok: false, message: 'Membro não encontrado neste tenant.' });
    }

    if (!req.user.isMaster) {
      const meM = await req.db.query(
        'SELECT role FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
        [tenantId, req.user.sub]
      );
      if (!meM.rows.length || normalizeRole(meM.rows[0].role) !== 'owner') {
        return res.status(403).json({ ok: false, message: 'Apenas Master ou Admin Master do tenant.' });
      }
    }

    // Bloqueia auto-reset (admin não pode resetar a própria senha por aqui;
    // ele usa Minha Conta → Trocar senha que exige a atual).
    if (Number(targetUserId) === Number(req.user.sub)) {
      return res.status(400).json({ ok: false, message: 'Use Minha Conta → Trocar senha pra mudar a sua própria.' });
    }

    const targetUser = await req.db.query(
      'SELECT id, username, email, display_name FROM users WHERE id = $1',
      [targetUserId]
    );
    if (!targetUser.rows.length) return res.status(404).json({ ok: false, message: 'Usuário não encontrado.' });

    const expiresAt = new Date(Date.now() + PENDING_WINDOW_HOURS * 3600 * 1000);

    await req.db.query(
      `UPDATE users
         SET password_reset_pending = TRUE,
             password_reset_expires_at = $1,
             password_reset_requested_by_user_id = $2
       WHERE id = $3`,
      [expiresAt, req.user.sub, targetUserId]
    );

    const u = targetUser.rows[0];
    return res.status(200).json({
      ok: true,
      userId: u.id,
      username: u.username,
      email: u.email,
      expiresAt: expiresAt.toISOString(),
      message: `Reset agendado. Avise ${u.display_name || u.username || u.email} pra entrar e definir nova senha (válido por ${PENDING_WINDOW_HOURS}h).`
    });
  } catch (err) {
    console.error('[tenant-member-reset-password]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
