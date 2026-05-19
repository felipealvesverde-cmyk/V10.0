// V30.0.0 — Cliente ClickUp backend (compartilhado entre api/*.js).
// Lê access_token do user no DB, faz chamadas autenticadas.
const { decrypt } = require('./clickup-crypto');

const CLICKUP_BASE = 'https://api.clickup.com/api/v2';

async function getAccessToken(db, userId) {
  const r = await db.query('SELECT access_token_enc FROM clickup_credentials WHERE user_id = $1', [userId]);
  if (!r.rows.length) throw new Error('ClickUp não conectado.');
  return decrypt(r.rows[0].access_token_enc);
}

// fetch genérico autenticado. path começa com '/'.
// Retorna { ok, status, data, headers }.
async function clickupFetch(db, userId, method, path, body) {
  const token = await getAccessToken(db, userId);
  const url = `${CLICKUP_BASE}${path}`;
  // V31.2.28 — ClickUp OAuth requer 'Authorization: Bearer <token>' (docs:
  // https://developer.clickup.com/docs/authentication#build-apps-for-others---oauth-flow).
  // Antes mandava só o token cru, o que faz a v2 retornar 401 em alguns endpoints.
  const opts = { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  let data;
  try { data = await r.json(); } catch (_) { data = {}; }
  return { ok: r.ok, status: r.status, data, headers: Object.fromEntries(r.headers.entries()) };
}

module.exports = { getAccessToken, clickupFetch, CLICKUP_BASE };
