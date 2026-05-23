// V32.9.4 — POST /api/auth-verify-password
// Valida senha contra o user logado (do JWT). Usado pra destravar recursos
// protegidos sem reautenticar a sessão inteira (ex: grupo trancado no RevOps).
//
// Body: { password }
// Resposta:
//   { ok: true, valid: true }                            → senha bate
//   { ok: true, valid: false, code: 'wrong_password' }   → senha errada
//   { ok: true, valid: false, code: 'no_password', message } → user nunca cadastrou senha
//
// Rate limit em memória (anti brute force): max 5 tentativas / 15min por user.
const bcrypt = require('bcryptjs');

const attemptsByUser = new Map();   // userId -> { count, lockedUntil }
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

function checkRate(userId) {
  const now = Date.now();
  const entry = attemptsByUser.get(userId);
  if (!entry) return { allowed: true };
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return { allowed: false, remainingMin: Math.ceil((entry.lockedUntil - now) / 60000) };
  }
  if (entry.lockedUntil && entry.lockedUntil <= now) {
    attemptsByUser.delete(userId);
  }
  return { allowed: true };
}

function recordFail(userId) {
  const entry = attemptsByUser.get(userId) || { count: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) entry.lockedUntil = Date.now() + LOCK_MS;
  attemptsByUser.set(userId, entry);
}

function recordSuccess(userId) {
  attemptsByUser.delete(userId);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const userId = req.user.sub;
  const password = String(req.body?.password || '');
  if (!password) return res.status(400).json({ ok: false, message: 'password obrigatório.' });

  const rate = checkRate(userId);
  if (!rate.allowed) {
    return res.status(429).json({
      ok: false,
      message: `Muitas tentativas. Espere ${rate.remainingMin} min antes de tentar de novo.`
    });
  }

  try {
    const r = await req.db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    const row = r.rows[0];
    if (!row || !row.password_hash) {
      // User sem senha cadastrada (login só por username — V23 aprovado simples)
      return res.status(200).json({
        ok: true,
        valid: false,
        code: 'no_password',
        message: 'Seu usuário não tem senha cadastrada. Defina uma em Configurações → Usuários antes de trancar recursos.'
      });
    }
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      recordFail(userId);
      return res.status(200).json({ ok: true, valid: false, code: 'wrong_password', message: 'Senha incorreta.' });
    }
    recordSuccess(userId);
    return res.status(200).json({ ok: true, valid: true });
  } catch (err) {
    console.error('[auth-verify-password]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
