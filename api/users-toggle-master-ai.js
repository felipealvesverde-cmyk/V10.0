// V34.7.h — POST /api/users-toggle-master-ai
// Master habilita/desabilita o uso do saldo ANTHROPIC_API_KEY do LJ para um
// usuário específico. Cliente com flag=true pode usar Djow/Enriquecer/etc
// sem precisar plugar API key própria.
// Body: { userId, enabled: true|false }

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas o master.' });

  const userId = Number(req.body?.userId);
  const enabled = Boolean(req.body?.enabled);
  if (!userId) return res.status(400).json({ ok: false, message: 'userId obrigatório.' });

  try {
    const result = await req.db.query(
      'UPDATE users SET master_ai_enabled = $2 WHERE id = $1 AND is_master = FALSE RETURNING id, username, master_ai_enabled',
      [userId, enabled]
    );
    if (result.rowCount === 0) return res.status(404).json({ ok: false, message: 'Usuário não encontrado ou é master.' });
    return res.status(200).json({ ok: true, user: result.rows[0] });
  } catch (err) {
    console.error('[users-toggle-master-ai]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
