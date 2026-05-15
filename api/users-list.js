// V23.0.0 — GET /api/users-list
// Lista todos os usuários do banco. Só master pode ver.
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas o master pode listar usuários.' });

  try {
    const result = await req.db.query(
      `SELECT id, username, email, is_master, is_approved, mode,
              created_at, last_login_at
       FROM users
       ORDER BY is_approved ASC, created_at DESC`
    );
    return res.status(200).json({ ok: true, users: result.rows });
  } catch (err) {
    console.error('[users-list]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
