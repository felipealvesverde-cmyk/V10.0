// V37.4.28 — POST /api/user-action-token-confirm
// Endpoint PÚBLICO. Consome um user_action_token pra realizar a ação correspondente.
//
// Body comum: { token }
// password_reset → { token, newPassword }
//   - Atualiza users.password_hash pro user dono do token.
// email_change   → { token, newEmail, currentPassword }
//   - Atualiza users.email + users.username (login) após validar currentPassword.

const bcrypt = require('bcryptjs');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const token = String(req.body?.token || '').trim();
  if (!token || token.length < 32) return res.status(400).json({ ok: false, message: 'Token inválido.' });

  const client = await req.db.connect();
  try {
    await client.query('BEGIN');

    const r = await client.query(`
      SELECT id, user_id, action_type, expires_at, used_at
      FROM user_action_tokens WHERE token = $1 FOR UPDATE
    `, [token]);
    if (!r.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ ok: false, message: 'Link não encontrado.' }); }
    const t = r.rows[0];
    if (t.used_at) { await client.query('ROLLBACK'); return res.status(410).json({ ok: false, message: 'Link já foi usado.' }); }
    if (new Date(t.expires_at) < new Date()) {
      await client.query('ROLLBACK'); return res.status(410).json({ ok: false, message: 'Link expirou.' });
    }

    if (t.action_type === 'password_reset') {
      const newPassword = String(req.body?.newPassword || '');
      if (!newPassword || newPassword.length < 8) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, message: 'Nova senha precisa de no mínimo 8 caracteres.' });
      }
      const hash = await bcrypt.hash(newPassword, 10);
      await client.query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, t.user_id]);
      await client.query('UPDATE user_action_tokens SET used_at = NOW() WHERE id = $1', [t.id]);
      await client.query('COMMIT');
      return res.status(200).json({ ok: true, action: 'password_reset', message: 'Senha redefinida com sucesso. Já pode fazer login com a nova senha.' });
    }

    if (t.action_type === 'email_change') {
      const newEmail = String(req.body?.newEmail || '').trim().toLowerCase();
      const currentPassword = String(req.body?.currentPassword || '');
      if (!newEmail.includes('@')) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, message: 'Email inválido.' });
      }
      if (!currentPassword) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, message: 'Senha atual obrigatória pra confirmar a troca.' });
      }

      const u = await client.query('SELECT email, password_hash FROM users WHERE id = $1 FOR UPDATE', [t.user_id]);
      const row = u.rows[0];
      if (!row || !row.password_hash) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, message: 'Sua conta não tem senha cadastrada.' });
      }
      if (String(row.email).toLowerCase() === newEmail) {
        await client.query('ROLLBACK');
        return res.status(400).json({ ok: false, message: 'O novo email é igual ao atual.' });
      }
      const ok = await bcrypt.compare(currentPassword, row.password_hash);
      if (!ok) { await client.query('ROLLBACK'); return res.status(401).json({ ok: false, message: 'Senha atual incorreta.' }); }

      const dup = await client.query(
        'SELECT id FROM users WHERE (LOWER(email) = $1 OR LOWER(username) = $1) AND id != $2',
        [newEmail, t.user_id]
      );
      if (dup.rows.length) { await client.query('ROLLBACK'); return res.status(409).json({ ok: false, message: 'Este email já está em uso por outra conta.' }); }

      await client.query('UPDATE users SET email = $1, username = $1 WHERE id = $2', [newEmail, t.user_id]);
      await client.query('UPDATE user_action_tokens SET used_at = NOW() WHERE id = $1', [t.id]);
      await client.query('COMMIT');
      return res.status(200).json({ ok: true, action: 'email_change', newEmail, message: `Email atualizado pra ${newEmail}. Use ele no próximo login.` });
    }

    await client.query('ROLLBACK');
    return res.status(400).json({ ok: false, message: `Tipo de ação não suportado: ${t.action_type}` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[user-action-token-confirm]', err);
    return res.status(500).json({ ok: false, message: err.message });
  } finally {
    client.release();
  }
};
