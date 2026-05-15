// V21.3 — Proxy mínimo para troca/refresh de token OAuth do RD Station.
//
// Existe por uma única razão: o RD bloqueia CORS no POST /auth/token, então
// o navegador não consegue chamá-lo diretamente. Esta rota é stateless e não
// armazena credenciais — apenas repassa a chamada do front para o RD.
//
// Body aceito:
//   { clientId, clientSecret, code }           -> troca code por access_token
//   { clientId, clientSecret, refreshToken }   -> renova access_token
//
// Retorna o status + corpo do RD intactos.
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

  const body = req.body || {};
  const { clientId, clientSecret, code, refreshToken } = body;
  if (!clientId || !clientSecret) {
    return res.status(400).json({ ok: false, message: 'clientId e clientSecret são obrigatórios.' });
  }
  if (!code && !refreshToken) {
    return res.status(400).json({ ok: false, message: 'code ou refreshToken obrigatório.' });
  }

  const rdBody = code
    ? { client_id: String(clientId).trim(), client_secret: String(clientSecret).trim(), code: String(code).trim() }
    : { client_id: String(clientId).trim(), client_secret: String(clientSecret).trim(), refresh_token: String(refreshToken).trim() };

  try {
    const rdRes = await fetch('https://api.rd.services/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rdBody)
    });
    const text = await rdRes.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = { raw: text }; }
    return res.status(rdRes.status).json(data || { ok: false, message: 'RD respondeu sem corpo.' });
  } catch (err) {
    return res.status(502).json({
      ok: false,
      message: `Falha ao chamar RD: ${err?.message || err}`
    });
  }
};
