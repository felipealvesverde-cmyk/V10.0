// V30.0.0 — Inicia OAuth ClickUp.
// GET: retorna URL de autorização (frontend redireciona o user pra ela).
// State é codificado com user_id + nonce pra validar no callback.
const { decrypt, isConfigured } = require('../lib/clickup-crypto');
const crypto = require('crypto');

function redirectUriFor(req) {
  // Permite override via env var; senão infere do host atual.
  if (process.env.APP_URL) return `${process.env.APP_URL.replace(/\/$/, '')}/api/clickup-oauth-callback`;
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'https').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}/api/clickup-oauth-callback`;
}

module.exports = async function handler(req, res) {
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!isConfigured()) return res.status(503).json({ ok: false, message: 'ENCRYPTION_KEY não configurada no servidor.' });

  try {
    const r = await req.db.query('SELECT client_id_enc FROM clickup_config WHERE user_id = $1', [req.user.id]);
    if (!r.rows.length) return res.status(404).json({ ok: false, message: 'Configure Client ID/Secret primeiro.' });
    const clientId = decrypt(r.rows[0].client_id_enc);
    const redirectUri = redirectUriFor(req);
    // State: user_id + nonce (timestamp + random). Decodificado no callback pra associar o token ao user.
    const nonce = crypto.randomBytes(8).toString('hex');
    const state = Buffer.from(JSON.stringify({ u: req.user.id, n: nonce, t: Date.now() })).toString('base64url');
    const url = `https://app.clickup.com/api?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
    return res.status(200).json({ ok: true, url, redirectUri });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};
