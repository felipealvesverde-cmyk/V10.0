// V30.0.0 — Salva/lê OAuth App credentials do user (client_id + client_secret).
// Ambos criptografados via lib/clickup-crypto.
//
// GET: retorna { ok, configured: bool, connected: bool, workspaceName?, encryptionReady: bool }
// POST: body { client_id, client_secret } — salva criptografado
// DELETE: remove config (e desconecta — também remove credentials)
const { encrypt, isConfigured: isEncryptionReady } = require('../lib/clickup-crypto');

module.exports = async function handler(req, res) {
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  const userId = req.user.id;

  if (req.method === 'GET') {
    try {
      const cfg = await req.db.query('SELECT 1 FROM clickup_config WHERE user_id = $1', [userId]);
      const cred = await req.db.query('SELECT workspace_name FROM clickup_credentials WHERE user_id = $1', [userId]);
      return res.status(200).json({
        ok: true,
        configured: cfg.rows.length > 0,
        connected: cred.rows.length > 0,
        workspaceName: cred.rows[0]?.workspace_name || null,
        encryptionReady: isEncryptionReady()
      });
    } catch (err) {
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  if (req.method === 'POST') {
    if (!isEncryptionReady()) {
      return res.status(503).json({
        ok: false,
        message: 'ENCRYPTION_KEY não configurada no servidor. Veja README ou peça pro admin adicionar no Railway → Variables.'
      });
    }
    const { client_id, client_secret } = req.body || {};
    if (!client_id || !client_secret) {
      return res.status(400).json({ ok: false, message: 'client_id e client_secret são obrigatórios.' });
    }
    try {
      const idEnc = encrypt(String(client_id).trim());
      const secretEnc = encrypt(String(client_secret).trim());
      await req.db.query(
        `INSERT INTO clickup_config (user_id, client_id_enc, client_secret_enc, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id) DO UPDATE SET client_id_enc = $2, client_secret_enc = $3, updated_at = NOW()`,
        [userId, idEnc, secretEnc]
      );
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      await req.db.query('DELETE FROM clickup_credentials WHERE user_id = $1', [userId]);
      await req.db.query('DELETE FROM clickup_config WHERE user_id = $1', [userId]);
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  return res.status(405).json({ ok: false, message: 'Use GET, POST ou DELETE.' });
};
