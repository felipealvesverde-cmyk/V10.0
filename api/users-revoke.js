// V23.0.0 — POST /api/users-revoke
// Body: { userId }
// Master revoga acesso de um usuário (set is_approved=false).
// Não permite revogar o próprio master.
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas o master pode revogar.' });

  const userId = Number(req.body?.userId);
  if (!userId) return res.status(400).json({ ok: false, message: 'userId obrigatório.' });

  try {
    const result = await req.db.query(
      'UPDATE users SET is_approved = FALSE WHERE id = $1 AND is_master = FALSE RETURNING id, username',
      [userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ ok: false, message: 'Usuário não encontrado ou é master.' });
    return res.status(200).json({ ok: true, user: result.rows[0] });
  } catch (err) {
    console.error('[users-revoke]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
