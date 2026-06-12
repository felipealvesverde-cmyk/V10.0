// V37.4.28 — POST /api/tenant-member-send-password-reset
// Owner do tenant manda email pro membro criar nova senha sem precisar da atual.
//
// Body: { userId } — membro alvo
//
// Cria token em user_action_tokens (action_type='password_reset', expira em 7d)
// e envia email com link pra /user-action.html?token=X.

const crypto = require('crypto');
const { normalizeRole } = require('../lib/permission-engine');
const { sendEmail, isConfigured: isSmtpConfigured } = require('../lib/email-client');
const { recoveryEmail } = require('../lib/email-templates');

const EXPIRES_DAYS = 7;

function buildActionUrl(req, token) {
  const proto = req.headers['x-forwarded-proto'] || (req.connection?.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}/user-action.html?token=${token}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const targetUserId = Number(req.body?.userId);
  if (!targetUserId) return res.status(400).json({ ok: false, message: 'userId obrigatório.' });

  const tenantId = Number(req.user.tenantId);

  try {
    // Auth: Master OU owner do tenant do membro alvo.
    const m = await req.db.query(
      'SELECT tenant_id, role FROM tenant_members WHERE user_id = $1 AND tenant_id = $2',
      [targetUserId, tenantId]
    );
    if (!m.rows.length) return res.status(404).json({ ok: false, message: 'Membro não encontrado neste tenant.' });

    if (!req.user.isMaster) {
      const meM = await req.db.query(
        'SELECT role FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
        [tenantId, req.user.sub]
      );
      if (!meM.rows.length || normalizeRole(meM.rows[0].role) !== 'owner') {
        return res.status(403).json({ ok: false, message: 'Apenas Master ou Admin Master do tenant.' });
      }
    }

    const targetUser = await req.db.query(
      'SELECT id, email, username, display_name FROM users WHERE id = $1',
      [targetUserId]
    );
    if (!targetUser.rows.length) return res.status(404).json({ ok: false, message: 'Usuário não encontrado.' });
    const u = targetUser.rows[0];

    const token = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + EXPIRES_DAYS * 24 * 3600 * 1000);

    // Invalida tokens anteriores não usados desse user pra essa ação.
    await req.db.query(
      `UPDATE user_action_tokens SET used_at = NOW()
       WHERE user_id = $1 AND action_type = 'password_reset' AND used_at IS NULL`,
      [targetUserId]
    );

    await req.db.query(
      `INSERT INTO user_action_tokens (user_id, action_type, token, payload, issued_by_user_id, expires_at)
       VALUES ($1, 'password_reset', $2, '{}'::jsonb, $3, $4)`,
      [targetUserId, token, req.user.sub, expiresAt]
    );

    const actionUrl = buildActionUrl(req, token);
    const tpl = recoveryEmail({ username: u.display_name || u.username || u.email, recoveryUrl: actionUrl });
    const emailResult = await sendEmail({ to: u.email, subject: tpl.subject, html: tpl.html, text: tpl.text });

    const smtpOn = isSmtpConfigured();
    const sentReal = emailResult.ok && !emailResult.simulated;
    const failedAtResend = smtpOn && !sentReal && !emailResult.simulated;

    return res.status(200).json({
      ok: true,
      actionUrl,
      expiresAt: expiresAt.toISOString(),
      emailSent: sentReal,
      emailSimulated: Boolean(emailResult.simulated),
      smtpConfigured: smtpOn,
      emailError: failedAtResend ? (emailResult.error || 'Erro desconhecido na Resend.') : null,
      emailErrorStatus: failedAtResend ? (emailResult.status || null) : null,
      message: sentReal ? `Link de reset enviado pra ${u.email}.`
             : failedAtResend ? 'SMTP configurado mas Resend recusou. Copie o link.'
             : 'SMTP não configurado. Copie o link manualmente.'
    });
  } catch (err) {
    console.error('[tenant-member-send-password-reset]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
