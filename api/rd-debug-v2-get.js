// V34.9.7.6 — Diagnóstico simples: GET na API v2 com OAuth fresh.
// Pra isolar se o "global_credentials" é problema do POST específico OR de
// todo acesso v2 com app privado.
//
// GET /api/rd-debug-v2-get → testa GET /crm/v2/contacts e mostra resposta

const { getRdCredential } = require('../lib/rd-credentials');
const RD_V2_BASE = 'https://api.rd.services/crm/v2';

async function tryV2(authMethod, token, path) {
  const url = authMethod === 'query'
    ? `${RD_V2_BASE}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
    : `${RD_V2_BASE}${path}`;
  const headers = { 'Accept': 'application/json' };
  if (authMethod === 'bearer') headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  const start = Date.now();
  try {
    const r = await fetch(url, { method: 'GET', headers, signal: controller.signal });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    return { status: r.status, ok: r.ok, data, elapsedMs: Date.now() - start };
  } catch (err) {
    return { status: 0, ok: false, error: err.message, elapsedMs: Date.now() - start };
  } finally { clearTimeout(timer); }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);

  let pat = null, oauth = null;
  try { const c = await getRdCredential(req.tenantDb, userId, 'crm_pat'); pat = c?.token; } catch (_) {}
  try { const c = await getRdCredential(req.tenantDb, userId, 'crm_oauth'); oauth = c?.token; } catch (_) {}

  // Decode JWT se for (pra ver scopes)
  let oauthDecoded = null;
  if (oauth) {
    try {
      const parts = oauth.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        oauthDecoded = {
          scopes: payload.scopes || payload.scope || payload.permissions || null,
          exp: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
          iss: payload.iss || null,
          aud: payload.aud || null,
          sub: payload.sub || null,
          client_id: payload.client_id || null
        };
      }
    } catch (_) { oauthDecoded = { error: 'não é JWT decodificável' }; }
  }

  const tests = [
    { label: 'GET /crm/v2/contacts (OAuth Bearer)', path: '/contacts', auth: 'bearer', token: oauth },
    { label: 'GET /crm/v2/deals (OAuth Bearer)', path: '/deals', auth: 'bearer', token: oauth },
    { label: 'GET /crm/v2/deal_pipelines (OAuth Bearer)', path: '/deal_pipelines', auth: 'bearer', token: oauth },
    { label: 'GET /crm/v2/contacts (PAT Bearer)', path: '/contacts', auth: 'bearer', token: pat },
    { label: 'GET /crm/v2/contacts (PAT query)', path: '/contacts', auth: 'query', token: pat }
  ];

  const results = [];
  for (const t of tests) {
    if (!t.token) { results.push({ label: t.label, skipped: 'sem token' }); continue; }
    const r = await tryV2(t.auth, t.token, t.path);
    results.push({
      label: t.label,
      status: r.status,
      ok: r.ok,
      elapsedMs: r.elapsedMs,
      response: typeof r.data === 'object' ? JSON.stringify(r.data).slice(0, 400) : String(r.data || '').slice(0, 400)
    });
  }

  return res.status(200).json({
    ok: true,
    patPresent: Boolean(pat),
    oauthPresent: Boolean(oauth),
    oauthDecoded,
    results
  });
};
