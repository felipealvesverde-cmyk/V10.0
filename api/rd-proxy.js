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

const API_BASE = 'https://api.rd.services';
const LEGACY_BASE = 'https://crm.rdstation.com/api/v1';
const VALID_SOURCES = new Set(['crm_pat', 'marketing_oauth', 'crm_oauth']);

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
  let effectiveToken = String(token || '').trim();
  if (token_source && VALID_SOURCES.has(token_source)) {
    if (!req.user) return res.status(401).json({ ok: false, message: 'token_source requer autenticação.' });
    if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
    try {
      const cred = await getRdCredential(req.db, req.user.sub, token_source);
      effectiveToken = cred.token || '';
    } catch (err) {
      if (err.message?.includes('não conectado')) {
        return res.status(404).json({ ok: false, message: `RD ${token_source} não conectado. Reconecte em Configurações.` });
      }
      if (err.message?.includes('ENCRYPTION_KEY')) {
        return res.status(503).json({ ok: false, message: 'ENCRYPTION_KEY ausente no servidor.' });
      }
      return res.status(500).json({ ok: false, message: err.message });
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
