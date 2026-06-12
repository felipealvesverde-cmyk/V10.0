// V37.4.31 — POST /api/auth-complete-password-reset (PÚBLICO, sem JWT)
//
// Finaliza fluxo de reset de senha sem email. Só funciona se admin master
// rodou /api/tenant-member-reset-password e seteou flag password_reset_pending.
//
// Body: { username, newPassword }
//
// Verifica:
//   - username existe
//   - users.password_reset_pending = TRUE
//   - users.password_reset_expires_at > NOW()
//   - newPassword >= 8 chars
// Hasheia + grava + zera flag + retorna JWT já logando o user.
//
// Rate limit: 5 tentativas / 15min por IP (anti-fuzzing de username).

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_TTL = '24h';

const attemptsByIp = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

function checkRate(ip) {
  const now = Date.now();
  const entry = attemptsByIp.get(ip);
  if (!entry) return { allowed: true };
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return { allowed: false, remainingMin: Math.ceil((entry.lockedUntil - now) / 60000) };
  }
  if (entry.lockedUntil && entry.lockedUntil <= now) attemptsByIp.delete(ip);
  return { allowed: true };
}
function recordFail(ip) {
  const entry = attemptsByIp.get(ip) || { count: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) entry.lockedUntil = Date.now() + LOCK_MS;
  attemptsByIp.set(ip, entry);
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!JWT_SECRET) return res.status(503).json({ ok: false, message: 'JWT_SECRET não configurado.' });

  const ip = clientIp(req);
  const rate = checkRate(ip);
  if (!rate.allowed) {
    return res.status(429).json({ ok: false, message: `Muitas tentativas. Espere ${rate.remainingMin} min.` });
  }

  const username = String(req.body?.username || '').trim().toLowerCase();
  const newPassword = String(req.body?.newPassword || '');

  if (!username) return res.status(400).json({ ok: false, message: 'Username obrigatório.' });
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ ok: false, message: 'Nova senha precisa de no mínimo 8 caracteres.' });
  }

  try {
    const r = await req.db.query(
      `SELECT id, username, email, is_master, is_approved, mode, default_tenant_id,
              password_reset_pending, password_reset_expires_at
         FROM users WHERE LOWER(username) = $1`,
      [username]
    );
    const user = r.rows[0];
    if (!user) {
      recordFail(ip);
      return res.status(401).json({ ok: false, message: 'Usuário não encontrado ou sem reset pendente.' });
    }
    if (!user.is_approved) {
      return res.status(403).json({ ok: false, message: 'Cadastro pendente de aprovação.' });
    }
    if (!user.password_reset_pending) {
      recordFail(ip);
      return res.status(401).json({ ok: false, message: 'Nenhum reset de senha pendente pra este usuário.' });
    }
    if (user.password_reset_expires_at && new Date(user.password_reset_expires_at) < new Date()) {
      return res.status(410).json({ ok: false, message: 'Reset expirado. Peça pro admin disparar outro.' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await req.db.query(
      `UPDATE users
         SET password_hash = $1,
             password_reset_pending = FALSE,
             password_reset_expires_at = NULL,
             password_reset_requested_by_user_id = NULL,
             last_login_at = NOW()
       WHERE id = $2`,
      [newHash, user.id]
    );

    const tokenPayload = {
      sub: user.id,
      username: user.username,
      isMaster: user.is_master,
      mode: user.mode || 'sandbox',
      tenantId: user.default_tenant_id || null
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_TTL });

    attemptsByIp.delete(ip);
    return res.status(200).json({
      ok: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isMaster: user.is_master,
        mode: user.mode || 'sandbox',
        tenantId: user.default_tenant_id || null
      },
      message: 'Senha redefinida. Você já está logado.'
    });
  } catch (err) {
    console.error('[auth-complete-password-reset]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
