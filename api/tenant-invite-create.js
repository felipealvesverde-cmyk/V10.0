// V37.3.3 — POST /api/tenant-invite-create
// Cria convite + manda email via Resend (se SMTP ativo).
// Sempre retorna acceptUrl pra fallback "Copiar link" no UI.
//
// Body: { email, role: 'manager'|'user'|'owner', permissionsOverrides?, tenantId? }
// Quem pode: Master LJ OU owner do tenant.

const crypto = require('crypto');
const { ROLES, normalizeRole, PERMISSION_KEYS } = require('../lib/permission-engine');
const { sendEmail, isConfigured: isSmtpConfigured } = require('../lib/email-client');
const { inviteEmail } = require('../lib/email-templates');

const INVITE_EXPIRES_DAYS = 7;

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function buildAcceptUrl(req, token) {
  // Reusa origin do request (cobre staging + prod sem env var).
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = forwardedProto || (req.connection?.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}/accept-invite.html?token=${token}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const tenantId = Number(req.body?.tenantId || req.user.tenantId);
  const email = String(req.body?.email || '').trim().toLowerCase();
  const role = normalizeRole(req.body?.role || 'user');
  let permissionsOverrides = {};

  if (!tenantId) return res.status(400).json({ ok: false, message: 'tenantId obrigatório.' });
  if (!email || !email.includes('@')) return res.status(400).json({ ok: false, message: 'email inválido.' });
  if (!ROLES.includes(role)) return res.status(400).json({ ok: false, message: 'role inválido.' });

  if (req.body?.permissionsOverrides && typeof req.body.permissionsOverrides === 'object') {
    for (const [k, v] of Object.entries(req.body.permissionsOverrides)) {
      if (PERMISSION_KEYS.includes(k) && typeof v === 'boolean') permissionsOverrides[k] = v;
    }
  }

  try {
    // Auth: Master LJ OU owner do tenant.
    if (!req.user.isMaster) {
      const m = await req.db.query(
        'SELECT role FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
        [tenantId, req.user.sub]
      );
      if (!m.rows.length || normalizeRole(m.rows[0].role) !== 'owner') {
        return res.status(403).json({ ok: false, message: 'Apenas Master ou Admin Master do tenant.' });
      }
    }

    // Verifica tenant existe.
    const tenant = await req.db.query('SELECT id, name FROM tenants WHERE id = $1', [tenantId]);
    if (!tenant.rows.length) return res.status(404).json({ ok: false, message: 'Tenant não encontrado.' });
    const tenantName = tenant.rows[0].name;

    // Verifica se já não é membro ativo.
    const existing = await req.db.query(`
      SELECT u.id FROM users u
      JOIN tenant_members tm ON tm.user_id = u.id AND tm.tenant_id = $1
      WHERE LOWER(u.email) = $2
    `, [tenantId, email]);
    if (existing.rows.length) {
      return res.status(409).json({ ok: false, message: 'Este email já é membro do tenant.' });
    }

    // Verifica se já existe convite pendente. Se sim, atualiza ele (re-emite).
    const pendingInvite = await req.db.query(`
      SELECT id FROM tenant_invites
      WHERE tenant_id = $1 AND LOWER(invitee_email) = $2 AND accepted_at IS NULL
    `, [tenantId, email]);

    const token = generateToken();
    const expiresAt = new Date(Date.now() + INVITE_EXPIRES_DAYS * 24 * 3600 * 1000);

    if (pendingInvite.rows.length) {
      await req.db.query(`
        UPDATE tenant_invites
          SET token = $1, role = $2, permissions_overrides = $3, expires_at = $4
        WHERE id = $5
      `, [token, role, JSON.stringify(permissionsOverrides), expiresAt, pendingInvite.rows[0].id]);
    } else {
      await req.db.query(`
        INSERT INTO tenant_invites (tenant_id, inviter_user_id, invitee_email, role, permissions_overrides, token, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [tenantId, req.user.sub, email, role, JSON.stringify(permissionsOverrides), token, expiresAt]);
    }

    // Inviter info pra email.
    const inviterRow = await req.db.query(
      'SELECT display_name, username FROM users WHERE id = $1',
      [req.user.sub]
    );
    const inviterName = inviterRow.rows[0]?.display_name || inviterRow.rows[0]?.username || 'Admin';

    const acceptUrl = buildAcceptUrl(req, token);

    // Tenta enviar email (stub se SMTP não configurado).
    const emailResult = await (async () => {
      try {
        const tpl = inviteEmail({
          inviterName,
          tenantName,
          inviteUrl: acceptUrl,
          role,
          expiresInDays: INVITE_EXPIRES_DAYS
        });
        return await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
      } catch (err) {
        return { ok: false, error: err.message };
      }
    })();

    return res.status(200).json({
      ok: true,
      token,
      acceptUrl,
      expiresAt: expiresAt.toISOString(),
      emailSent: emailResult.ok && !emailResult.simulated,
      emailSimulated: Boolean(emailResult.simulated),
      smtpConfigured: isSmtpConfigured(),
      message: emailResult.ok && !emailResult.simulated
        ? 'Convite enviado por email.'
        : 'Convite criado — SMTP não configurado, copie o link manualmente.'
    });
  } catch (err) {
    console.error('[tenant-invite-create]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
