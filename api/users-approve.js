// V23.0.0 — POST /api/users-approve
// Body: { userId, mode? }
// Master aprova um usuário pendente. Opcionalmente seta o mode na aprovação.
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas o master pode aprovar.' });

  const userId = Number(req.body?.userId);
  const mode = ['production', 'sandbox', 'demo'].includes(req.body?.mode) ? req.body.mode : null;

  if (!userId) return res.status(400).json({ ok: false, message: 'userId obrigatório.' });

  try {
    const query = mode
      ? 'UPDATE users SET is_approved = TRUE, mode = $2 WHERE id = $1 AND is_master = FALSE RETURNING id, username, mode'
      : 'UPDATE users SET is_approved = TRUE WHERE id = $1 AND is_master = FALSE RETURNING id, username, mode';
    const params = mode ? [userId, mode] : [userId];
    const result = await req.db.query(query, params);
    if (result.rowCount === 0) return res.status(404).json({ ok: false, message: 'Usuário não encontrado (ou é master).' });
    return res.status(200).json({ ok: true, user: result.rows[0] });
  } catch (err) {
    console.error('[users-approve]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
