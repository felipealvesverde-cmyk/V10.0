// V35.14.0 — Google Analytics 4 OAuth + API helper.
//
// Espelha lib/google-ads-oauth.js: fluxo OAuth 2.0 authorization_code 3-legged.
// Cliente cadastra próprio Cloud Project (igual Google Ads) e cola
// client_id/client_secret. LJ guarda refresh_token encrypted.
//
// Endpoints Google validados oficial (2026-06-03):
//   Auth:      https://accounts.google.com/o/oauth2/v2/auth
//   Token:     https://oauth2.googleapis.com/token
//   Data API:  https://analyticsdata.googleapis.com/v1beta
//              (POST /properties/<id>:runReport, etc)
//   Admin API: https://analyticsadmin.googleapis.com/v1beta
//              (GET /accountSummaries)
//
// Scope único pra leitura: analytics.readonly — cobre tanto Data API
// quanto Admin API (validado em developers.google.com/identity/protocols/
// oauth2/scopes e accountSummaries.list reference).
//
// Diferenças vs Google Ads:
//   - Sem developer_token (Google Ads exclusivo)
//   - Sem login-customer-id header (MCC do Google Ads)
//   - Property ID vem no formato "properties/<id>" (não plano)
//   - Admin API substitui customers:listAccessibleCustomers
//   - Data API usa POST com body JSON (vs Google Ads que usa POST custom GAQL)

const { encrypt, decrypt } = require('./clickup-crypto');

const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DATA_API_BASE = 'https://analyticsdata.googleapis.com/v1beta';
const ADMIN_API_BASE = 'https://analyticsadmin.googleapis.com/v1beta';
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

async function readConfig(tenantDb, userId) {
  const r = await tenantDb.query(
    `SELECT client_id_enc, client_secret_enc,
            refresh_token_enc, access_token_cache_enc, access_token_expires_at,
            selected_property_id, property_display_name,
            business_profile, selected_packs, custom_settings,
            available_customs, last_metadata_at,
            sync_frequency_per_day, backfill_days,
            connected_at, last_sync_at, last_sync_result
       FROM lj_ga4_config WHERE user_id = $1`,
    [userId]
  );
  if (!r.rows.length) return null;
  const row = r.rows[0];
  try {
    return {
      clientId: row.client_id_enc ? decrypt(row.client_id_enc) : null,
      clientSecret: row.client_secret_enc ? decrypt(row.client_secret_enc) : null,
      refreshToken: row.refresh_token_enc ? decrypt(row.refresh_token_enc) : null,
      cachedAccessToken: row.access_token_cache_enc ? decrypt(row.access_token_cache_enc) : null,
      accessTokenExpiresAt: row.access_token_expires_at ? new Date(row.access_token_expires_at) : null,
      selectedPropertyId: row.selected_property_id || null,
      propertyDisplayName: row.property_display_name || null,
      businessProfile: row.business_profile || null,
      selectedPacks: Array.isArray(row.selected_packs) ? row.selected_packs : [],
      customSettings: row.custom_settings && typeof row.custom_settings === 'object' ? row.custom_settings : {},
      availableCustoms: Array.isArray(row.available_customs) ? row.available_customs : [],
      lastMetadataAt: row.last_metadata_at || null,
      syncFrequencyPerDay: Number(row.sync_frequency_per_day || 2),
      backfillDays: Number(row.backfill_days || 30),
      connectedAt: row.connected_at || null,
      lastSyncAt: row.last_sync_at || null,
      lastSyncResult: row.last_sync_result || null
    };
  } catch (err) {
    console.warn('[ga4-oauth] decrypt falhou:', err.message);
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
  if (!cfg || !cfg.refreshToken) throw new Error('GA4 não conectado (sem refresh_token).');
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
    `UPDATE lj_ga4_config
        SET access_token_cache_enc = $1, access_token_expires_at = $2, updated_at = NOW()
      WHERE user_id = $3`,
    [encrypt(accessToken), expiresAt.toISOString(), userId]
  );
  return accessToken;
}

// Lista propriedades GA4 acessíveis via refresh_token.
// Endpoint: GET https://analyticsadmin.googleapis.com/v1beta/accountSummaries
// Response: { accountSummaries: [{ account, displayName, propertySummaries: [{ property, displayName, propertyType, parent }] }] }
// Achata pro frontend retornar uma lista [{ propertyId, displayName, accountName, propertyType }].
async function listAccessibleProperties(tenantDb, userId) {
  const accessToken = await getValidAccessToken(tenantDb, userId);
  const r = await fetch(`${ADMIN_API_BASE}/accountSummaries`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Admin API ${r.status}: ${text.slice(0, 400)}`);
  const data = JSON.parse(text);
  const out = [];
  for (const acc of (data.accountSummaries || [])) {
    const accountDisplay = acc.displayName || acc.account || 'Conta sem nome';
    for (const p of (acc.propertySummaries || [])) {
      out.push({
        propertyId: p.property,                    // "properties/<id>"
        displayName: p.displayName || p.property,
        accountName: accountDisplay,
        propertyType: p.propertyType || null,
        parent: p.parent || acc.account || null
      });
    }
  }
  return out;
}

// Roda relatório no Data API. body = { dimensions:[{name}], metrics:[{name}], dateRanges:[{startDate,endDate}], ... }
// Retorna o JSON cru da API (dimensionHeaders/metricHeaders/rows/rowCount).
async function runReport(tenantDb, userId, propertyId, body) {
  const accessToken = await getValidAccessToken(tenantDb, userId);
  // propertyId pode vir como "properties/123" OU "123" — normalizamos
  const path = String(propertyId).startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;
  const r = await fetch(`${DATA_API_BASE}/${path}:runReport`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body || {})
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Data API runReport ${r.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

// Descobre dimensões/métricas disponíveis (incluindo customs da propriedade).
// Endpoint: GET /properties/<id>/metadata
// Response: { dimensions: [{ apiName, uiName, description, customDefinition, category }],
//             metrics: [{ apiName, uiName, description, type, customDefinition, category }] }
async function getMetadata(tenantDb, userId, propertyId) {
  const accessToken = await getValidAccessToken(tenantDb, userId);
  const path = String(propertyId).startsWith('properties/')
    ? propertyId
    : `properties/${propertyId}`;
  const r = await fetch(`${DATA_API_BASE}/${path}/metadata`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Data API metadata ${r.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

module.exports = {
  buildAuthUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  getValidAccessToken,
  listAccessibleProperties,
  runReport,
  getMetadata,
  readConfig,
  SCOPE,
  AUTH_URL,
  TOKEN_URL,
  DATA_API_BASE,
  ADMIN_API_BASE
};
