// V23.0.0 — POST /api/users-mode
// Body: { userId, mode: 'production' | 'sandbox' }
// Master altera o modo de um usuário (sem precisar revogar/aprovar de novo).
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas o master.' });

  const userId = Number(req.body?.userId);
  const mode = req.body?.mode;
  if (!userId) return res.status(400).json({ ok: false, message: 'userId obrigatório.' });
  if (!['production', 'sandbox', 'demo'].includes(mode)) return res.status(400).json({ ok: false, message: 'mode inválido.' });

  try {
    const result = await req.db.query(
      'UPDATE users SET mode = $2 WHERE id = $1 AND is_master = FALSE RETURNING id, username, mode',
      [userId, mode]
    );
    if (result.rowCount === 0) return res.status(404).json({ ok: false, message: 'Usuário não encontrado ou é master.' });
    return res.status(200).json({ ok: true, user: result.rows[0] });
  } catch (err) {
    console.error('[users-mode]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
