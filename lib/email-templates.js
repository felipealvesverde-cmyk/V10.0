// V37.3.0 — Templates de email (HTML + plain text).
// Cada template retorna { subject, html, text } pra passar pro sendEmail.
//
// Design simples, inline-CSS pra compatibilidade com clients (Gmail/Outlook/etc).

const COLORS = {
  primary: '#7c3aed',
  bg: '#fafaf9',
  card: '#ffffff',
  border: '#e7e5e4',
  text: '#1c1917',
  muted: '#78716c',
  cta: '#7c3aed'
};

function shellHtml(content) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${COLORS.text};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:16px;max-width:560px;overflow:hidden;">
          <tr>
            <td style="padding:24px 32px;border-bottom:1px solid ${COLORS.border};background:${COLORS.card};">
              <div style="font-weight:900;font-size:18px;color:${COLORS.primary};letter-spacing:-0.02em;">LeadJourney</div>
              <div style="font-size:10px;font-weight:700;color:${COLORS.muted};letter-spacing:0.18em;text-transform:uppercase;margin-top:2px;">Revenue Operating System</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid ${COLORS.border};background:${COLORS.bg};">
              <p style="margin:0;font-size:11px;color:${COLORS.muted};line-height:1.5;">
                Este email foi enviado pelo LeadJourney. Se você não esperava receber este email, pode ignorá-lo com segurança.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function inviteEmail({ inviterName, tenantName, inviteUrl, role, expiresInDays }) {
  const roleLabel = role === 'owner' ? 'Admin Master'
                  : role === 'manager' ? 'Gerente'
                  : 'Usuário';
  const subject = `${inviterName} te convidou pra ${tenantName} no LeadJourney`;
  const html = shellHtml(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;color:${COLORS.text};line-height:1.3;">
      Você foi convidado pra ${escapeHtml(tenantName)}
    </h1>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${COLORS.text};">
      <strong>${escapeHtml(inviterName)}</strong> te convidou pra entrar como <strong>${roleLabel}</strong> no workspace do LeadJourney.
    </p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:${COLORS.muted};">
      Clique no botão abaixo pra criar sua senha e acessar:
    </p>
    <p style="margin:0 0 24px;">
      <a href="${inviteUrl}" style="display:inline-block;background:${COLORS.cta};color:#fff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:10px;font-size:14px;">
        Aceitar convite
      </a>
    </p>
    <p style="margin:0 0 8px;font-size:12px;color:${COLORS.muted};line-height:1.5;">
      Ou copie e cole este link no navegador:
    </p>
    <p style="margin:0 0 24px;font-size:11px;color:${COLORS.muted};word-break:break-all;background:${COLORS.bg};padding:8px 12px;border-radius:6px;border:1px solid ${COLORS.border};">
      ${inviteUrl}
    </p>
    <p style="margin:0;font-size:12px;color:${COLORS.muted};line-height:1.5;">
      Este convite expira em ${expiresInDays} dia${expiresInDays === 1 ? '' : 's'}.
    </p>
  `);
  const text = `${inviterName} te convidou pra ${tenantName} no LeadJourney como ${roleLabel}.\n\nAceite em: ${inviteUrl}\n\nConvite expira em ${expiresInDays} dia(s).`;
  return { subject, html, text };
}

function recoveryEmail({ username, recoveryUrl }) {
  const subject = `LeadJourney — Redefinir sua senha`;
  const html = shellHtml(`
    <h1 style="margin:0 0 16px;font-size:22px;font-weight:900;color:${COLORS.text};line-height:1.3;">
      Redefinir sua senha
    </h1>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${COLORS.text};">
      Olá <strong>${escapeHtml(username)}</strong>,
    </p>
    <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:${COLORS.text};">
      Recebemos um pedido pra redefinir sua senha. Clique abaixo pra criar uma nova:
    </p>
    <p style="margin:0 0 24px;">
      <a href="${recoveryUrl}" style="display:inline-block;background:${COLORS.cta};color:#fff;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:10px;font-size:14px;">
        Redefinir senha
      </a>
    </p>
    <p style="margin:0;font-size:12px;color:${COLORS.muted};line-height:1.5;">
      Se você não pediu pra redefinir a senha, ignore este email — sua conta segue protegida.
    </p>
  `);
  const text = `Olá ${username},\n\nRecebemos um pedido pra redefinir sua senha. Acesse: ${recoveryUrl}\n\nSe você não pediu, ignore.`;
  return { subject, html, text };
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = { inviteEmail, recoveryEmail };
