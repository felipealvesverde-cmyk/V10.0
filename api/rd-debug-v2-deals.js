// V34.9.7.4 — Diagnóstico da API V2 do RD CRM (api.rd.services/crm/v2/deals).
// Doc diz que aceita { id: contactId } no array contacts pra vincular contato
// existente. Legacy não aceita — descobrimos em 12 variantes.
//
// Vai tentar 3 formas de auth:
//   1. PAT como query (?token=X) — como na legacy
//   2. PAT como Bearer
//   3. OAuth do app CRM (se Sansone tiver crm_oauth configurado)

const { getRdCredential } = require('../lib/rd-credentials');
const RD_V2_BASE = 'https://api.rd.services/crm/v2';

async function tryV2(authMethod, token, path, options = {}) {
  let url = `${RD_V2_BASE}${path}`;
  const headers = { 'Accept': 'application/json' };
  if (options.body) headers['Content-Type'] = 'application/json';

  if (authMethod === 'query') {
    url += (url.includes('?') ? '&' : '?') + `token=${encodeURIComponent(token)}`;
  } else if (authMethod === 'bearer') {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  const start = Date.now();
  try {
    const r = await fetch(url, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    return { ok: r.ok, status: r.status, data, elapsedMs: Date.now() - start };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err.message, elapsedMs: Date.now() - start };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);

  let pat = null;
  try {
    const cred = await getRdCredential(req.tenantDb, userId, 'crm_pat');
    pat = cred?.token;
  } catch (_) {}

  let oauth = null;
  try {
    const cred = await getRdCredential(req.tenantDb, userId, 'crm_oauth');
    oauth = cred?.token;
  } catch (_) {}

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  const contactId = String(body.contact_id || '').trim();
  const pipelineId = String(body.pipeline_id || '').trim();
  if (!contactId || !pipelineId) {
    return res.status(400).json({ ok: false, message: 'contact_id e pipeline_id obrigatórios.' });
  }

  // Stage: aceita do body direto OU busca na LEGACY (v2 não tem esse endpoint)
  let firstStage = String(body.deal_stage_id || '').trim() || null;
  if (!firstStage) {
    // Fallback: tenta legacy v1 com PAT
    try {
      const legacyResp = await fetch(`https://crm.rdstation.com/api/v1/deal_stages?deal_pipeline_id=${encodeURIComponent(pipelineId)}&token=${encodeURIComponent(pat)}`, { headers: { Accept: 'application/json' } });
      const legacyData = await legacyResp.json();
      const stages = legacyData?.deal_stages || legacyData?.data || legacyData || [];
      firstStage = Array.isArray(stages) && stages[0] ? (stages[0].id || stages[0]._id) : null;
    } catch (_) {}
  }

  const dealBody = {
    deal: {
      name: 'TEST-V2',
      deal_stage_id: firstStage,
      deal_pipeline_id: pipelineId,
      contacts: [{ id: contactId }]
    }
  };

  // Tenta criar com cada método de auth
  const results = {
    firstStage,
    patPresent: Boolean(pat),
    oauthPresent: Boolean(oauth),
    attempts: []
  };

  if (pat && firstStage) {
    const r = await tryV2('query', pat, '/deals', { method: 'POST', body: dealBody });
    results.attempts.push({
      label: 'PAT como query (?token=)',
      status: r.status, ok: r.ok, elapsedMs: r.elapsedMs,
      response: typeof r.data === 'object' ? JSON.stringify(r.data).slice(0, 300) : r.data
    });

    const r2 = await tryV2('bearer', pat, '/deals', { method: 'POST', body: dealBody });
    results.attempts.push({
      label: 'PAT como Bearer',
      status: r2.status, ok: r2.ok, elapsedMs: r2.elapsedMs,
      response: typeof r2.data === 'object' ? JSON.stringify(r2.data).slice(0, 300) : r2.data
    });
  }

  if (oauth && firstStage) {
    const r3 = await tryV2('bearer', oauth, '/deals', { method: 'POST', body: dealBody });
    results.attempts.push({
      label: 'OAuth Bearer (crm_oauth)',
      status: r3.status, ok: r3.ok, elapsedMs: r3.elapsedMs,
      response: typeof r3.data === 'object' ? JSON.stringify(r3.data).slice(0, 300) : r3.data
    });
  }

  return res.status(200).json({ ok: true, results });
};
