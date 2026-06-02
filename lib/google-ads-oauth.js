// V35.5.0 — Google Ads OAuth helper.
//
// Fluxo OAuth 2.0 authorization_code (3-legged) — cliente autoriza no browser,
// recebemos code via callback, trocamos por refresh_token (vida longa) +
// access_token (1h). Refresh_token guarda no DB; access_token cacheamos
// com expiração.
//
// Endpoints Google:
//   Auth:    https://accounts.google.com/o/oauth2/v2/auth
//   Token:   https://oauth2.googleapis.com/token
//   Ads API: https://googleads.googleapis.com/v18/...
//
// Header obrigatório em TODA chamada da Google Ads API:
//   developer-token: <token aprovado>
//   login-customer-id: <MCC ID sem traços>  (só se gerencia via MCC)
//   Authorization: Bearer <access_token>

const { encrypt, decrypt } = require('./clickup-crypto');

const SCOPE = 'https://www.googleapis.com/auth/adwords';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ADS_API_BASE = 'https://googleads.googleapis.com/v18';
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

async function readConfig(tenantDb, userId) {
  const r = await tenantDb.query(
    `SELECT client_id_enc, client_secret_enc, developer_token_enc,
            login_customer_id, selected_customer_id,
            refresh_token_enc, access_token_cache_enc, access_token_expires_at,
            account_descriptive_name, connected_at
       FROM lj_google_ads_config WHERE user_id = $1`,
    [userId]
  );
  if (!r.rows.length) return null;
  const row = r.rows[0];
  try {
    return {
      clientId: row.client_id_enc ? decrypt(row.client_id_enc) : null,
      clientSecret: row.client_secret_enc ? decrypt(row.client_secret_enc) : null,
      developerToken: row.developer_token_enc ? decrypt(row.developer_token_enc) : null,
      loginCustomerId: row.login_customer_id || null,
      selectedCustomerId: row.selected_customer_id || null,
      refreshToken: row.refresh_token_enc ? decrypt(row.refresh_token_enc) : null,
      cachedAccessToken: row.access_token_cache_enc ? decrypt(row.access_token_cache_enc) : null,
      accessTokenExpiresAt: row.access_token_expires_at ? new Date(row.access_token_expires_at) : null,
      accountDescriptiveName: row.account_descriptive_name || null,
      connectedAt: row.connected_at || null
    };
  } catch (err) {
    console.warn('[google-ads-oauth] decrypt falhou:', err.message);
    return null;
  }
}

function buildAuthUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state
  });
  return `${AUTH_URL}?${params.toString()}`;
}

async function exchangeCodeForTokens({ code, clientId, clientSecret, redirectUri }) {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code'
  });
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Google token exchange ${r.status}: ${text.slice(0, 300)}`);
  let data; try { data = JSON.parse(text); } catch (_) { throw new Error('Token endpoint não-JSON'); }
  if (!data.refresh_token) {
    // Google só manda refresh_token na PRIMEIRA autorização (com prompt=consent).
    // Se não veio, cliente já autorizou antes — pede pra revogar e tentar de novo.
    throw new Error('refresh_token ausente — revogue acesso em myaccount.google.com/permissions e tente conectar de novo.');
  }
  return {
    refreshToken: String(data.refresh_token),
    accessToken: String(data.access_token || ''),
    expiresInSec: Number(data.expires_in || 3600)
  };
}

async function refreshAccessToken({ refreshToken, clientId, clientSecret }) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token'
  });
  const r = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Google refresh ${r.status}: ${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  return {
    accessToken: String(data.access_token),
    expiresInSec: Number(data.expires_in || 3600)
  };
}

async function getValidAccessToken(tenantDb, userId) {
  const cfg = await readConfig(tenantDb, userId);
  if (!cfg || !cfg.refreshToken) throw new Error('Google Ads não conectado (sem refresh_token).');
  if (cfg.cachedAccessToken && cfg.accessTokenExpiresAt) {
    const safeUntil = cfg.accessTokenExpiresAt.getTime() - REFRESH_MARGIN_MS;
    if (Date.now() < safeUntil) return cfg.cachedAccessToken;
  }
  const { accessToken, expiresInSec } = await refreshAccessToken({
    refreshToken: cfg.refreshToken,
    clientId: cfg.clientId,
    clientSecret: cfg.clientSecret
  });
  const expiresAt = new Date(Date.now() + expiresInSec * 1000);
  await tenantDb.query(
    `UPDATE lj_google_ads_config
        SET access_token_cache_enc = $1, access_token_expires_at = $2, updated_at = NOW()
      WHERE user_id = $3`,
    [encrypt(accessToken), expiresAt.toISOString(), userId]
  );
  return accessToken;
}

// Lista contas Google Ads que esse refresh_token consegue acessar.
// Usado no wizard pra cliente escolher qual conta operacional conectar.
async function listAccessibleCustomers(tenantDb, userId) {
  const cfg = await readConfig(tenantDb, userId);
  if (!cfg) throw new Error('Sem config.');
  const accessToken = await getValidAccessToken(tenantDb, userId);
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': cfg.developerToken,
    'Content-Type': 'application/json'
  };
  if (cfg.loginCustomerId) headers['login-customer-id'] = cfg.loginCustomerId;

  const r = await fetch(`${ADS_API_BASE}/customers:listAccessibleCustomers`, { headers });
  const text = await r.text();
  if (!r.ok) throw new Error(`Google Ads API ${r.status}: ${text.slice(0, 400)}`);
  const data = JSON.parse(text);
  // resourceNames vem como ["customers/1234567890", ...]
  const ids = Array.isArray(data.resourceNames)
    ? data.resourceNames.map(rn => String(rn).replace('customers/', ''))
    : [];
  return ids.map(id => ({ customerId: id }));
}

// GAQL search query (lista de campanhas, métricas, etc).
// Exemplo: query = "SELECT campaign.id, campaign.name FROM campaign LIMIT 10"
async function searchGAQL(tenantDb, userId, customerId, query) {
  const cfg = await readConfig(tenantDb, userId);
  if (!cfg) throw new Error('Sem config.');
  const accessToken = await getValidAccessToken(tenantDb, userId);
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'developer-token': cfg.developerToken,
    'Content-Type': 'application/json'
  };
  if (cfg.loginCustomerId) headers['login-customer-id'] = cfg.loginCustomerId;

  const r = await fetch(`${ADS_API_BASE}/customers/${customerId}/googleAds:search`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query })
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Google Ads search ${r.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

module.exports = {
  buildAuthUrl,
  exchangeCodeForTokens,
  getValidAccessToken,
  listAccessibleCustomers,
  searchGAQL,
  readConfig,
  SCOPE,
  ADS_API_BASE
};
