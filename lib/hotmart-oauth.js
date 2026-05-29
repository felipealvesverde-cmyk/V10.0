// V35.1.0 — Hotmart OAuth helper.
//
// Fluxo client_credentials (2-legged OAuth2). Cliente cria credencial em
// "Tools > Developer Credentials" no painel Hotmart e cola client_id +
// client_secret no wizard LJ. Token vive ~5h e é cacheado em hotmart_config
// (oauth_token_cache_enc + oauth_token_expires_at) pra evitar refresh
// desnecessário.
//
// Endpoints Hotmart:
//   Token:    POST https://api-sec-vlc.hotmart.com/security/oauth/token
//   Sales:    GET  https://api-hot-connect.hotmart.com/payments/rest/v2/sales/history
//   Subs:     GET  https://api-hot-connect.hotmart.com/payments/rest/v2/subscriptions
//   Club:     GET  https://api-hot-connect.hotmart.com/club/api/v1/...

const { encrypt, decrypt } = require('./clickup-crypto');

const TOKEN_URL = 'https://api-sec-vlc.hotmart.com/security/oauth/token';
const SALES_BASE = 'https://api-hot-connect.hotmart.com/payments/rest/v2';

// Margem de segurança: renovar token 5 min antes de expirar
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * Lê config OAuth do user. Retorna { clientId, clientSecret, cachedToken, expiresAt } ou null.
 */
async function readOAuthConfig(tenantDb, userId) {
  const r = await tenantDb.query(
    `SELECT client_id_enc, client_secret_enc, oauth_token_cache_enc, oauth_token_expires_at
       FROM hotmart_config WHERE user_id = $1`,
    [userId]
  );
  if (!r.rows.length) return null;
  const row = r.rows[0];
  if (!row.client_id_enc || !row.client_secret_enc) return null;
  try {
    return {
      clientId: decrypt(row.client_id_enc),
      clientSecret: decrypt(row.client_secret_enc),
      cachedToken: row.oauth_token_cache_enc ? decrypt(row.oauth_token_cache_enc) : null,
      expiresAt: row.oauth_token_expires_at ? new Date(row.oauth_token_expires_at) : null
    };
  } catch (err) {
    console.warn('[hotmart-oauth] decrypt falhou:', err.message);
    return null;
  }
}

/**
 * Solicita novo token via client_credentials. Retorna { token, expiresInSec }.
 */
async function fetchToken(clientId, clientSecret) {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret
  });
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const text = await r.text();
  if (!r.ok) {
    throw new Error(`Hotmart token endpoint ${r.status}: ${text.slice(0, 200)}`);
  }
  let data;
  try { data = JSON.parse(text); } catch (_) { throw new Error('Resposta não-JSON do Hotmart token endpoint'); }
  if (!data.access_token) throw new Error('access_token ausente na resposta Hotmart');
  return {
    token: String(data.access_token),
    expiresInSec: Number(data.expires_in || 18000) // default 5h
  };
}

/**
 * Pega token válido — usa cache se ainda fresco, senão refresca.
 * Persiste novo token + expiração em hotmart_config.
 */
async function getValidToken(tenantDb, userId) {
  const config = await readOAuthConfig(tenantDb, userId);
  if (!config) throw new Error('Cliente sem OAuth configurado (precisa de client_id/client_secret).');

  // Cache fresco?
  if (config.cachedToken && config.expiresAt) {
    const margin = config.expiresAt.getTime() - REFRESH_MARGIN_MS;
    if (Date.now() < margin) return config.cachedToken;
  }

  // Refresca
  const { token, expiresInSec } = await fetchToken(config.clientId, config.clientSecret);
  const expiresAt = new Date(Date.now() + expiresInSec * 1000);
  await tenantDb.query(
    `UPDATE hotmart_config
        SET oauth_token_cache_enc = $1, oauth_token_expires_at = $2, updated_at = NOW()
      WHERE user_id = $3`,
    [encrypt(token), expiresAt.toISOString(), userId]
  );
  return token;
}

/**
 * GET autenticado na Sales API. Retorna o JSON parseado.
 * opts.qs = objeto convertido em querystring.
 */
async function hotmartGet(tenantDb, userId, path, opts = {}) {
  const token = await getValidToken(tenantDb, userId);
  const qs = opts.qs ? '?' + new URLSearchParams(opts.qs).toString() : '';
  const url = `${SALES_BASE}${path}${qs}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Hotmart GET ${path} ${r.status}: ${text.slice(0, 200)}`);
  try { return JSON.parse(text); } catch (_) { throw new Error('Resposta não-JSON do Hotmart'); }
}

/**
 * Pagina sales/history a partir de startDate até endDate. Yield batch por batch.
 */
async function* iterSalesHistory(tenantDb, userId, { startDate, endDate, pageSize = 50 }) {
  let page = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const data = await hotmartGet(tenantDb, userId, '/sales/history', {
      qs: {
        start_date: startDate,    // YYYY-MM-DD
        end_date: endDate,
        max_results: pageSize,
        page_token: page > 0 ? String(page) : ''
      }
    });
    const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data?.data) ? data.data : []);
    if (!items.length) break;
    yield items;
    if (items.length < pageSize) break;
    page++;
    if (page > 200) break; // safety: max 10k sales por sync
  }
}

module.exports = {
  readOAuthConfig,
  getValidToken,
  hotmartGet,
  iterSalesHistory,
  TOKEN_URL,
  SALES_BASE
};
