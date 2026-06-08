// V21.4 — Proxy genérico stateless para a API do RD Station.
//
// EXISTE PORQUE o RD bloqueia CORS em toda a API de CRM (api.rd.services/crm/*).
// É um "carteiro burro": recebe { method, path, body, token | token_source } do navegador,
// faz fetch contra o RD com esses parâmetros e devolve a resposta intacta.
//
// V31.2.37 — Agora aceita `token_source` em vez de `token` no body. Quando dado,
// o token é lido criptografado do DB (rd_credentials). Frontend não precisa
// mais expor o token — basta dizer "use o crm_pat" ou "use o marketing_oauth".
// Mantém compat com `token` legado durante OAuth setup (antes do token entrar
// no DB).
//
// Body:
//   {
//     method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
//     path:   "/crm/v1/deal_pipelines",
//     body:   { ... } | null | undefined,
//     token:  "eyJ0eXAiOi...",                  // OPCIONAL (compat legado)
//     token_source: 'crm_pat'|'marketing_oauth'|'crm_oauth', // PREFERIDO (V31.2.37)
//     legacy: false,
//     useQueryToken: false
//   }
const { getRdCredential } = require('../lib/rd-credentials');
const { encrypt, decrypt } = require('../lib/clickup-crypto');

const API_BASE = 'https://api.rd.services';
const LEGACY_BASE = 'https://crm.rdstation.com/api/v1';
const VALID_SOURCES = new Set(['crm_pat', 'marketing_oauth', 'crm_oauth']);
const RD_TOKEN_URL = 'https://api.rd.services/auth/token';
const REFRESH_MARGIN_MS = 10 * 60 * 1000; // 10 min — renova se faltar menos que isso

// V36.6.0 — Auto-refresh inline pro marketing_oauth.
// Antes: token expirava em 24h e cliente tinha que reconectar OAuth manual.
// Agora: a cada chamada do proxy, se faltar < 10min pra expirar, renova
// sozinho antes de fazer a chamada real. Idempotente: se outra request
// renovou recente, esta vê expires_at já atualizado e pula.
async function refreshMarketingTokenInline(tenantDb, userId) {
  const r = await tenantDb.query(
    `SELECT refresh_token_enc, client_id_enc, client_secret_enc, expires_at
       FROM rd_credentials WHERE user_id = $1 AND token_type = 'marketing_oauth'`,
    [userId]
  );
  if (!r.rows.length) return { refreshed: false, reason: 'no-row' };
  const row = r.rows[0];
  const refresh = row.refresh_token_enc ? decrypt(row.refresh_token_enc) : null;
  const clientId = row.client_id_enc ? decrypt(row.client_id_enc) : null;
  const clientSecret = row.client_secret_enc ? decrypt(row.client_secret_enc) : null;
  if (!refresh || !clientId || !clientSecret) {
    return { refreshed: false, reason: 'missing-credentials' };
  }
  const tokenRes = await fetch(RD_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId, client_secret: clientSecret,
      grant_type: 'refresh_token', refresh_token: refresh
    })
  });
  const tokenData = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenData.access_token) {
    return { refreshed: false, reason: 'rd-error', rd_status: tokenRes.status, rd_error: tokenData };
  }
  const newAccess = tokenData.access_token;
  const newRefresh = tokenData.refresh_token || refresh;
  const expiresIn = Number(tokenData.expires_in || 86400);
  const newExpiresAt = new Date(Date.now() + expiresIn * 1000);
  await tenantDb.query(
    `UPDATE rd_credentials
        SET access_token_enc = $1, refresh_token_enc = $2,
            expires_at = $3, status = 'connected', updated_at = NOW()
      WHERE user_id = $4 AND token_type = 'marketing_oauth'`,
    [encrypt(newAccess), encrypt(newRefresh), newExpiresAt.toISOString(), userId]
  );
  return { refreshed: true, newAccess, expires_at: newExpiresAt };
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Use POST.' });
  }

  const { method = 'GET', path = '', body = null, token = '', token_source = '', legacy = false, useQueryToken = false } = req.body || {};

  if (typeof path !== 'string' || !path.startsWith('/')) {
    return res.status(400).json({ ok: false, message: 'path inválido (deve começar com /).' });
  }

  // V31.2.37 — Resolve token: prioriza token_source (DB lookup), fallback pro body legado.
  // V31.2.38 — Se token_source falhar mas o frontend mandou token legado, usa o legado
  // (cobre o gap de usuários cujo token nunca foi escrito no DB — write-through V31.2.36
  // só dispara em mutação; tokens antigos no state não migravam automaticamente).
  let effectiveToken = String(token || '').trim();
  let usedSource = 'body';
  if (token_source && VALID_SOURCES.has(token_source) && req.user && req.tenantDb) {
    try {
      // V32.0.10 — rd_credentials vivem no tenant plane.
      const cred = await getRdCredential(req.tenantDb, req.user.sub, token_source);
      // V36.6.0 — Auto-refresh inline pro marketing_oauth.
      // Se faltar < 10 min pra expirar, renova ANTES de usar o token.
      if (token_source === 'marketing_oauth' && cred.expiresAt) {
        const msToExpiry = new Date(cred.expiresAt).getTime() - Date.now();
        if (msToExpiry < REFRESH_MARGIN_MS) {
          try {
            const refreshResult = await refreshMarketingTokenInline(req.tenantDb, req.user.sub);
            if (refreshResult.refreshed) {
              effectiveToken = refreshResult.newAccess;
              usedSource = 'db-refreshed';
            } else if (refreshResult.reason === 'rd-error') {
              // Refresh falhou — provavelmente refresh_token expirado.
              // Não falha aqui, deixa tentar com o token antigo (que pode ainda funcionar)
              // ou cliente vai ver erro real na chamada.
              console.warn('[rd-proxy] auto-refresh falhou:', refreshResult);
            }
          } catch (refreshErr) {
            console.warn('[rd-proxy] auto-refresh exception:', refreshErr.message);
          }
        }
      }
      if (!effectiveToken && cred.token) {
        effectiveToken = cred.token;
        usedSource = 'db';
      } else if (cred.token && usedSource !== 'db-refreshed') {
        effectiveToken = cred.token;
        usedSource = 'db';
      }
      // Se DB tem registro mas token vazio: deixa o effectiveToken do body (já setado acima)
    } catch (err) {
      if (err.message?.includes('ENCRYPTION_KEY')) {
        return res.status(503).json({ ok: false, message: 'ENCRYPTION_KEY ausente no servidor.' });
      }
      // err.message inclui "não conectado": tolera silenciosamente se o body tem token legado.
      if (!effectiveToken && err.message?.includes('não conectado')) {
        return res.status(404).json({ ok: false, message: `RD ${token_source} não conectado. Reconecte em Configurações.` });
      }
      // Senão, segue usando effectiveToken do body
    }
  }

  if (!effectiveToken) {
    return res.status(400).json({ ok: false, message: 'token ou token_source ausente/vazio.' });
  }

  const upper = String(method).toUpperCase();
  if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'HEAD'].includes(upper)) {
    return res.status(400).json({ ok: false, message: `Método ${upper} não suportado.` });
  }

  const base = legacy ? LEGACY_BASE : API_BASE;
  let url = `${base}${path}`;
  if (useQueryToken) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}token=${encodeURIComponent(effectiveToken)}`;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  if (!useQueryToken) headers['Authorization'] = `Bearer ${effectiveToken}`;

  const init = { method: upper, headers };
  if (body !== null && body !== undefined && upper !== 'GET' && upper !== 'HEAD') {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  try {
    const rdRes = await fetch(url, init);
    const text = await rdRes.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = { raw: text }; }
    return res.status(rdRes.status).json(data || { ok: rdRes.ok });
  } catch (err) {
    return res.status(502).json({
      ok: false,
      message: `Proxy falhou ao chamar RD: ${err?.message || err}`
    });
  }
};
