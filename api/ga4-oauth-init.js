// V35.14.0 — GET /api/ga4-oauth-init
// Gera URL de autorização Google (scope analytics.readonly) + state CSRF.
// Frontend redireciona browser pra essa URL. Cliente autoriza, Google
// redireciona pra /api/ga4-oauth-callback?code=...&state=...
//
// Espelho de google-ads-oauth-init.js V35.5.0.

const crypto = require('crypto');
const { decrypt } = require('../lib/clickup-crypto');
const { buildAuthUrl } = require('../lib/ga4-oauth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);

  try {
    const r = await req.tenantDb.query(
      `SELECT client_id_enc FROM lj_ga4_config WHERE user_id = $1`,
      [userId]
    );
    if (!r.rows.length || !r.rows[0].client_id_enc) {
      return res.status(400).json({ ok: false, message: 'Salve client_id/secret antes de autorizar.' });
    }
    const clientId = decrypt(r.rows[0].client_id_enc);

    // CSRF state — 32 bytes random, válido por 10 min, persistido no DB
    const stateToken = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await req.tenantDb.query(
      `UPDATE lj_ga4_config SET oauth_state_token = $1, oauth_state_expires_at = $2 WHERE user_id = $3`,
      [stateToken, expiresAt.toISOString(), userId]
    );

    // Constrói redirect_uri baseado no host atual (staging vs prod).
    // CRÍTICO: precisa estar registrado EXATAMENTE assim no Cloud Console.
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const redirectUri = `${proto}://${host}/api/ga4-oauth-callback`;

    const authUrl = buildAuthUrl({ clientId, redirectUri, state: stateToken });
    return res.status(200).json({ ok: true, authUrl, redirectUri });
  } catch (err) {
    console.error('[ga4-oauth-init]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
