// V21.4 — Proxy genérico stateless para a API do RD Station.
//
// EXISTE PORQUE o RD bloqueia CORS em toda a API de CRM (api.rd.services/crm/*).
// É um "carteiro burro": recebe { method, path, body, token } do navegador,
// faz fetch contra o RD com esses parâmetros e devolve a resposta intacta.
//
// NÃO armazena credenciais, NÃO tem sessão, NÃO loga token, NÃO decide nada.
// Toda lógica do Journey continua no navegador.
//
// Body:
//   {
//     method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
//     path:   "/crm/v1/deal_pipelines",   // sempre começa com /
//     body:   { ... } | null | undefined, // ignorado em GET/HEAD
//     token:  "eyJ0eXAiOi...",            // token do RD
//     legacy: false,                      // true → usa crm.rdstation.com/api/v1 como base
//     useQueryToken: false                // V21.4.2: true → manda token como ?token=X (esquema legacy do CRM) em vez de Authorization: Bearer
//   }
//
// Retorna o status HTTP do RD + o corpo (JSON parsed quando possível).
const API_BASE = 'https://api.rd.services';
const LEGACY_BASE = 'https://crm.rdstation.com/api/v1';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, message: 'Use POST.' });
  }

  const { method = 'GET', path = '', body = null, token = '', legacy = false, useQueryToken = false } = req.body || {};

  if (typeof path !== 'string' || !path.startsWith('/')) {
    return res.status(400).json({ ok: false, message: 'path inválido (deve começar com /).' });
  }
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ ok: false, message: 'token ausente.' });
  }

  const upper = String(method).toUpperCase();
  if (!['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'HEAD'].includes(upper)) {
    return res.status(400).json({ ok: false, message: `Método ${upper} não suportado.` });
  }

  const base = legacy ? LEGACY_BASE : API_BASE;
  // V21.4.2 — Quando useQueryToken=true, mandamos o token como ?token=X
  // (esquema legacy do RD CRM) em vez de Authorization: Bearer.
  let url = `${base}${path}`;
  if (useQueryToken) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}token=${encodeURIComponent(token)}`;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  if (!useQueryToken) headers['Authorization'] = `Bearer ${token}`;

  const init = {
    method: upper,
    headers
  };
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
