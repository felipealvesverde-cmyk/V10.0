// V37.4.24 — POST /api/auth-change-password
// User troca a própria senha. Exige currentPassword pra confirmar.
//
// Body: { currentPassword, newPassword }
// Rate limit: 5 tentativas / 15min por user (mesmo padrão auth-verify-password).

const bcrypt = require('bcryptjs');

const attemptsByUser = new Map();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

function checkRate(userId) {
  const now = Date.now();
  const entry = attemptsByUser.get(userId);
  if (!entry) return { allowed: true };
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return { allowed: false, remainingMin: Math.ceil((entry.lockedUntil - now) / 60000) };
  }
  if (entry.lockedUntil && entry.lockedUntil <= now) attemptsByUser.delete(userId);
  return { allowed: true };
}
function recordFail(userId) {
  const entry = attemptsByUser.get(userId) || { count: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) entry.lockedUntil = Date.now() + LOCK_MS;
  attemptsByUser.set(userId, entry);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const userId = req.user.sub;
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');

  if (!currentPassword) return res.status(400).json({ ok: false, message: 'Senha atual obrigatória.' });
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ ok: false, message: 'Nova senha precisa de no mínimo 8 caracteres.' });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({ ok: false, message: 'Nova senha precisa ser diferente da atual.' });
  }

  const rate = checkRate(userId);
  if (!rate.allowed) {
    return res.status(429).json({ ok: false, message: `Muitas tentativas. Espere ${rate.remainingMin} min.` });
  }

  try {
    const r = await req.db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    const row = r.rows[0];
    if (!row || !row.password_hash) {
      return res.status(400).json({ ok: false, message: 'Sua conta não tem senha cadastrada. Peça ajuda ao admin.' });
    }
    const ok = await bcrypt.compare(currentPassword, row.password_hash);
    if (!ok) {
      recordFail(userId);
      return res.status(401).json({ ok: false, message: 'Senha atual incorreta.' });
    }
    const newHash = await bcrypt.hash(newPassword, 10);
    await req.db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);
    attemptsByUser.delete(userId);
    return res.status(200).json({ ok: true, message: 'Senha atualizada com sucesso.' });
  } catch (err) {
    console.error('[auth-change-password]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
