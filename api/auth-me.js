// V23.0.0 — GET /api/auth-me
// Retorna info do usuário se JWT válido, ou { ok:false } se não.
// Usado pelo client pra checar se a sessão ainda está viva ao recarregar.
module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });

  if (!req.user) {
    return res.status(200).json({ ok: false, authenticated: false });
  }

  // Refresca dados do usuário do banco (mode pode ter mudado por aprovação).
  if (req.db) {
    try {
      const result = await req.db.query(
        'SELECT id, username, email, is_master, is_approved, mode FROM users WHERE id = $1',
        [req.user.sub]
      );
      const row = result.rows[0];
      if (!row || !row.is_approved) {
        return res.status(200).json({ ok: false, authenticated: false, message: 'Acesso revogado.' });
      }
      return res.status(200).json({
        ok: true,
        authenticated: true,
        user: {
          id: row.id,
          username: row.username,
          email: row.email,
          isMaster: row.is_master,
          mode: row.mode || 'sandbox'
        }
      });
    } catch (err) {
      console.error('[auth-me]', err);
      // Fallback: confia no JWT.
      return res.status(200).json({
        ok: true,
        authenticated: true,
        user: {
          id: req.user.sub,
          username: req.user.username,
          isMaster: req.user.isMaster,
          mode: req.user.mode || 'sandbox'
        }
      });
    }
  }

  return res.status(200).json({
    ok: true,
    authenticated: true,
    user: {
      id: req.user.sub,
      username: req.user.username,
      isMaster: req.user.isMaster,
      mode: req.user.mode || 'sandbox'
    }
  });
};
