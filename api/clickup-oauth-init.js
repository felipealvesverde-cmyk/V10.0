// V30.0.0 — Inicia OAuth ClickUp.
// GET: retorna URL de autorização (frontend redireciona o user pra ela).
// State é codificado com user_id + nonce pra validar no callback.
const { decrypt, isConfigured } = require('../lib/clickup-crypto');
const { resolveCredentialOwnerId, assertCanWriteCredentials } = require('../lib/credentials-owner');
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

  // V37.4.34 — Iniciar OAuth = mutar credencial do tenant. Só owner ou master.
  try { await assertCanWriteCredentials(req); }
  catch (err) { return res.status(err.statusCode || 403).json({ ok: false, message: err.message }); }

  try {
    // V32.0.9 — clickup_config vive no tenant plane.
    // V37.4.34 — Resolve pro owner do tenant. Token vai ser salvo na linha dele.
    const userId = await resolveCredentialOwnerId(req);
    const r = await req.tenantDb.query('SELECT client_id_enc FROM clickup_config WHERE user_id = $1', [userId]);
    if (!r.rows.length) return res.status(404).json({ ok: false, message: 'Configure Client ID/Secret primeiro.' });
    const clientId = decrypt(r.rows[0].client_id_enc);
    const redirectUri = redirectUriFor(req);
    // State: user_id (owner) + nonce (timestamp + random). Decodificado no callback.
    const nonce = crypto.randomBytes(8).toString('hex');
    const state = Buffer.from(JSON.stringify({ u: userId, n: nonce, t: Date.now() })).toString('base64url');
    const url = `https://app.clickup.com/api?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
    return res.status(200).json({ ok: true, url, redirectUri });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};
