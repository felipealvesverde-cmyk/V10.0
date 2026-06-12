// V37.3.0 — Email client (Resend).
// Envia email via API Resend. Se RESEND_API_KEY não estiver setada,
// loga + retorna mock success ("simulado") pra ambiente não-configurado.
//
// Env vars:
//   RESEND_API_KEY  — chave da Resend (obtida em resend.com)
//   EMAIL_FROM      — endereço sender (ex: 'noreply@leadjourney.app').
//                     Default: 'onboarding@resend.dev' (sandbox da Resend).
//
// Plug-and-play: sem API key, todo `sendEmail` retorna { ok: true, simulated: true }
// e loga no console. Quando setar a key + EMAIL_FROM no Railway, automaticamente
// passa a enviar email real. Zero refactor.

const RESEND_API_URL = 'https://api.resend.com/emails';

async function sendEmail({ to, subject, html, text, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';

  if (!Array.isArray(to)) to = [to];
  to = to.filter(Boolean);
  if (!to.length) {
    console.error('[email-client] ✗ sendEmail chamado sem destinatário');
    return { ok: false, error: 'no_recipient' };
  }

  if (!apiKey) {
    console.log(`[email-client] ⚠ RESEND_API_KEY não configurada — email SIMULADO:`);
    console.log(`  From:    ${from}`);
    console.log(`  To:      ${to.join(', ')}`);
    console.log(`  Subject: ${subject}`);
    console.log(`  (set RESEND_API_KEY + EMAIL_FROM no Railway pra ativar envio real)`);
    return { ok: true, simulated: true, message: 'SMTP not configured — email simulated.' };
  }

  try {
    const body = { from, to, subject };
    if (html) body.html = html;
    if (text) body.text = text;
    if (replyTo) body.reply_to = replyTo;

    const r = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    let data;
    try { data = await r.json(); } catch (_) { data = {}; }

    if (r.ok) {
      console.log(`[email-client] ✓ Email enviado pra ${to.join(', ')} (Resend id ${data.id || '?'})`);
      return { ok: true, id: data.id || null };
    }

    console.error(`[email-client] ✗ Erro Resend HTTP ${r.status}:`, data?.message || data);
    return { ok: false, error: data?.message || `HTTP ${r.status}`, status: r.status };
  } catch (err) {
    console.error('[email-client] ✗ Exception:', err.message);
    return { ok: false, error: err.message };
  }
}

function isConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

module.exports = { sendEmail, isConfigured };
