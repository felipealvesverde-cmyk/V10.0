// V30.0.0 — Cliente ClickUp backend (compartilhado entre api/*.js).
// V31.2.29 — Suporta dois tipos de token:
//   - 'oauth' → Authorization: Bearer <token>
//   - 'pat'   → Authorization: <token>  (Personal API Token, sem Bearer)
// Detecção via coluna clickup_credentials.token_type. Default 'oauth' (compat).
const { decrypt } = require('./clickup-crypto');

const CLICKUP_BASE = 'https://api.clickup.com/api/v2';

async function getCredential(db, userId) {
  const r = await db.query('SELECT access_token_enc, token_type FROM clickup_credentials WHERE user_id = $1', [userId]);
  if (!r.rows.length) throw new Error('ClickUp não conectado.');
  return {
    token: decrypt(r.rows[0].access_token_enc),
    tokenType: r.rows[0].token_type || 'oauth'
  };
}

// Backward-compat: alguns chamadores só querem o token.
async function getAccessToken(db, userId) {
  const { token } = await getCredential(db, userId);
  return token;
}

function authHeader(token, tokenType) {
  return tokenType === 'pat' ? token : `Bearer ${token}`;
}

// fetch genérico autenticado. path começa com '/'.
// Retorna { ok, status, data, headers }.
async function clickupFetch(db, userId, method, path, body) {
  const { token, tokenType } = await getCredential(db, userId);
  const url = `${CLICKUP_BASE}${path}`;
  const opts = { method, headers: { Authorization: authHeader(token, tokenType), 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  let data;
  try { data = await r.json(); } catch (_) { data = {}; }
  return { ok: r.ok, status: r.status, data, headers: Object.fromEntries(r.headers.entries()) };
}

module.exports = { getAccessToken, getCredential, clickupFetch, authHeader, CLICKUP_BASE };
