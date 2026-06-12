// V37.4.24 — POST /api/auth-change-email
// User troca o próprio email (login). Exige currentPassword pra confirmar.
//
// Body: { newEmail, currentPassword }
//
// Atualiza users.email E users.username (já que username=email no LJ desde V32).
// Falha se newEmail já está em uso por outro user.

const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const userId = req.user.sub;
  const newEmail = String(req.body?.newEmail || '').trim().toLowerCase();
  const currentPassword = String(req.body?.currentPassword || '');

  if (!newEmail || !newEmail.includes('@') || newEmail.length < 5) {
    return res.status(400).json({ ok: false, message: 'Email inválido.' });
  }
  if (!currentPassword) {
    return res.status(400).json({ ok: false, message: 'Senha atual obrigatória pra confirmar a troca.' });
  }

  try {
    const r = await req.db.query('SELECT password_hash, email FROM users WHERE id = $1', [userId]);
    const row = r.rows[0];
    if (!row) return res.status(404).json({ ok: false, message: 'User não encontrado.' });
    if (!row.password_hash) {
      return res.status(400).json({ ok: false, message: 'Sua conta não tem senha cadastrada. Peça ajuda ao admin.' });
    }

    if (String(row.email).toLowerCase() === newEmail) {
      return res.status(400).json({ ok: false, message: 'O novo email é igual ao atual.' });
    }

    const ok = await bcrypt.compare(currentPassword, row.password_hash);
    if (!ok) return res.status(401).json({ ok: false, message: 'Senha atual incorreta.' });

    const dup = await req.db.query(
      'SELECT id FROM users WHERE (LOWER(email) = $1 OR LOWER(username) = $1) AND id != $2',
      [newEmail, userId]
    );
    if (dup.rows.length) {
      return res.status(409).json({ ok: false, message: 'Este email já está em uso por outra conta.' });
    }

    await req.db.query(
      'UPDATE users SET email = $1, username = $1 WHERE id = $2',
      [newEmail, userId]
    );

    return res.status(200).json({
      ok: true,
      message: 'Email atualizado. Da próxima vez que logar, use o novo email.',
      newEmail
    });
  } catch (err) {
    console.error('[auth-change-email]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
