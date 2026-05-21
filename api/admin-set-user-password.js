// V32.0.17 — POST /api/admin-set-user-password (master only)
// Body: { username, password }
// Atualiza password_hash de qualquer user. Usado pra:
//   - Setar senha inicial de cliente externo (ex: Sansone)
//   - Resetar senha de user que esqueceu
//   - Bootstrap após auth-login virar password-required (V32.0.17)
//
// Segurança: só master pode chamar. Mínimo 4 chars (poderia ser mais
// rigoroso mas master é quem decide; cliente externo recebe a senha
// e troca depois quando tiver UI de "trocar minha senha" — V32.X futuro).
const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas master pode setar senha de outros users.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!username) return res.status(400).json({ ok: false, message: 'username obrigatório.' });
  if (!password || password.length < 4) {
    return res.status(400).json({ ok: false, message: 'password obrigatório (mínimo 4 chars).' });
  }

  try {
    const userRow = await req.db.query(
      'SELECT id, username, is_master FROM users WHERE LOWER(username) = $1',
      [username]
    );
    if (!userRow.rows.length) {
      return res.status(404).json({ ok: false, message: `User ${username} não encontrado.` });
    }
    if (userRow.rows[0].is_master) {
      return res.status(403).json({
        ok: false,
        message: 'Senha do master se troca via env var MASTER_PASSWORD no Railway, não por este endpoint.'
      });
    }

    const hash = await bcrypt.hash(password, 10);
    await req.db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, userRow.rows[0].id]);

    return res.status(200).json({
      ok: true,
      username: userRow.rows[0].username,
      message: `Senha atualizada para ${userRow.rows[0].username}.`
    });
  } catch (err) {
    console.error('[admin-set-user-password]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
