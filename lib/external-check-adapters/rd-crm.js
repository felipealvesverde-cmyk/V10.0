// V34.0.0 — V34.6.j.A: Adapter RD CRM pro externalIntegrationCheck engine.
//
// Lista candidates do RD CRM (pipelines, deals) pra match contra ações LJ.
// Usa crm_pat (PAT) do tenant. Reaproveita getRdCredential da V34.5.b.
//
// resourceKind suportados:
//   - 'pipeline' → GET /crm/v1/deal_pipelines
//   - 'deal' → GET /crm/v1/deals (limit 200, ordenado por updated_at DESC)

const { getRdCredential } = require('../rd-credentials');

const RD_API_BASE = 'https://api.rd.services/crm/v1';

async function rdFetch(path, token) {
  const r = await fetch(`${RD_API_BASE}${path}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  return { ok: r.ok, status: r.status, data };
}

async function listCandidates(db, userId, resourceKind) {
  let cred;
  try {
    cred = await getRdCredential(db, userId, 'crm_pat');
  } catch (err) {
    throw new Error(`RD CRM não conectado: ${err.message}`);
  }
  const token = cred?.token;
  if (!token) throw new Error('crm_pat sem access_token.');

  if (resourceKind === 'pipeline') {
    const r = await rdFetch('/deal_pipelines', token);
    if (!r.ok) throw new Error(`RD pipelines HTTP ${r.status}`);
    const list = Array.isArray(r.data) ? r.data : (r.data?.deal_pipelines || r.data?.data || []);
    return list.map(p => ({
      id: String(p.id || p._id),
      name: String(p.name || ''),
      raw: p
    }));
  }

  if (resourceKind === 'deal') {
    // Lista deals recentes (limit razoável pra não bater rate limit)
    const r = await rdFetch('/deals?limit=200', token);
    if (!r.ok) throw new Error(`RD deals HTTP ${r.status}`);
    const list = Array.isArray(r.data) ? r.data : (r.data?.deals || r.data?.data || []);
    return list.map(d => ({
      id: String(d.id || d._id),
      name: String(d.name || ''),
      raw: d
    }));
  }

  throw new Error(`resource_kind não suportado pelo adapter RD CRM: ${resourceKind}`);
}

module.exports = { listCandidates };
