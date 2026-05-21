// V23.0.0 — POST /api/auth-login
// Body: { username, password? }
//   - Master (is_master=true): exige password, valida via bcrypt.compare
//   - Outros usuários (is_approved=true): só username (sem password)
// Retorna: { ok, token, user: { id, username, mode, isMaster } }
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || '';
const JWT_TTL = '24h';

// Rate limiting simples em memória (anti força bruta no master).
const loginAttempts = new Map(); // ip -> { count, lockedUntil }
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

function clientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry) return { ok: true };
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return { ok: false, remainingMs: entry.lockedUntil - now };
  }
  if (entry.lockedUntil && entry.lockedUntil <= now) {
    loginAttempts.delete(ip);
    return { ok: true };
  }
  return { ok: true };
}

function recordFailure(ip) {
  const entry = loginAttempts.get(ip) || { count: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) entry.lockedUntil = Date.now() + LOCK_MS;
  loginAttempts.set(ip, entry);
}

function recordSuccess(ip) {
  loginAttempts.delete(ip);
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!JWT_SECRET) return res.status(503).json({ ok: false, message: 'JWT_SECRET não configurado.' });

  const ip = clientIp(req);
  const rate = checkRateLimit(ip);
  if (!rate.ok) {
    return res.status(429).json({ ok: false, message: `Muitas tentativas. Tente em ${Math.ceil(rate.remainingMs / 60000)} min.` });
  }

  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!username) return res.status(400).json({ ok: false, message: 'Username obrigatório.' });

  try {
    // V32.0.7 — Busca default_tenant_id pra incluir no JWT.
    const result = await req.db.query(
      'SELECT id, username, email, password_hash, is_master, is_approved, mode, default_tenant_id FROM users WHERE LOWER(username) = $1',
      [username]
    );
    const user = result.rows[0];
    if (!user) {
      recordFailure(ip);
      return res.status(401).json({ ok: false, message: 'Usuário não encontrado.' });
    }
    if (!user.is_approved) {
      return res.status(403).json({ ok: false, message: 'Cadastro pendente de aprovação pelo administrador.' });
    }

    // Master: exige password válida via bcrypt.
    if (user.is_master) {
      if (!password) {
        recordFailure(ip);
        return res.status(401).json({ ok: false, message: 'Senha obrigatória para o master.' });
      }
      const valid = user.password_hash && await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        recordFailure(ip);
        return res.status(401).json({ ok: false, message: 'Senha incorreta.' });
      }
    }
    // Não-master: aprovação é suficiente, não checa password.

    // V32.0.7 — Inclui tenantId no JWT pra middleware popular req.tenantDb.
    // Pra master sem tenant (admin global), tenantId fica null.
    const tokenPayload = {
      sub: user.id,
      username: user.username,
      isMaster: user.is_master,
      mode: user.mode || 'sandbox',
      tenantId: user.default_tenant_id || null
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_TTL });

    // Atualiza last_login_at
    await req.db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    recordSuccess(ip);
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
      }
    });
  } catch (err) {
    console.error('[auth-login]', err);
    return res.status(500).json({ ok: false, message: err.message || 'Erro interno.' });
  }
};
