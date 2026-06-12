// V37.4.28 — GET /api/user-action-token-info?token=xxx
// Endpoint PÚBLICO. Resolve metadados de um user_action_token pra montar a UI
// da página /user-action.html.

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const token = String(req.query?.token || '').trim();
  if (!token || token.length < 32) return res.status(400).json({ ok: false, message: 'Token inválido.' });

  try {
    const r = await req.db.query(`
      SELECT t.action_type, t.expires_at, t.used_at,
             u.id AS user_id, u.email, u.username, u.display_name
      FROM user_action_tokens t
      JOIN users u ON u.id = t.user_id
      WHERE t.token = $1
    `, [token]);

    if (!r.rows.length) return res.status(404).json({ ok: false, message: 'Link não encontrado.' });
    const row = r.rows[0];

    if (row.used_at) return res.status(410).json({ ok: false, message: 'Link já foi usado.', status: 'used' });
    if (new Date(row.expires_at) < new Date()) {
      return res.status(410).json({ ok: false, message: 'Link expirou.', status: 'expired' });
    }

    return res.status(200).json({
      ok: true,
      action: {
        type: row.action_type,
        currentEmail: row.email,
        displayName: row.display_name || row.username || row.email,
        expiresAt: row.expires_at
      }
    });
  } catch (err) {
    console.error('[user-action-token-info]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
