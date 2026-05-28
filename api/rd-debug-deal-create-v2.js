// V34.9.7.3 — Variante L do diagnóstico: testar formato oficial da doc do RD.
//
// Doc do RD: contacts dentro do deal, passando { name, email, phone } SEM id.
// RD faz match por email — se já existe, vincula; senão cria.
//
// POST body { pipeline_id, contact_email, contact_name, contact_phone, name_prefix }
//   → testa 1 variante, retorna response + verificação

const { rdFetch } = require('../lib/rd-contact-sync-engine');
const { getRdCredential } = require('../lib/rd-credentials');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);

  let token = null;
  try {
    const cred = await getRdCredential(req.tenantDb, userId, 'crm_pat');
    token = cred?.token;
  } catch (err) {
    return res.status(400).json({ ok: false, message: `RD CRM não conectado: ${err.message}` });
  }
  if (!token) return res.status(400).json({ ok: false, message: 'crm_pat não configurado.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  const pipelineId = String(body.pipeline_id || '').trim();
  const email = String(body.contact_email || '').trim();
  const name = String(body.contact_name || '').trim();
  const phone = String(body.contact_phone || '').trim();
  const prefix = String(body.name_prefix || 'TEST-L').trim();
  if (!pipelineId || !email) {
    return res.status(400).json({ ok: false, message: 'pipeline_id e contact_email obrigatórios.' });
  }

  // Pega primeiro stage da pipeline
  const stagesResp = await rdFetch(`/deal_stages?deal_pipeline_id=${encodeURIComponent(pipelineId)}`, token);
  const stages = stagesResp.data?.deal_stages || stagesResp.data?.data || stagesResp.data || [];
  const firstStage = Array.isArray(stages) ? stages[0] : null;
  const dealStageId = firstStage ? (firstStage.id || firstStage._id) : '';
  if (!dealStageId) return res.status(400).json({ ok: false, message: `Pipeline ${pipelineId} sem stages.` });

  // VARIANTE L — formato oficial da doc: contacts dentro do deal, com dados (sem id)
  const dealBody = {
    deal: {
      name: `${prefix}`,
      deal_stage_id: dealStageId,
      deal_pipeline_id: pipelineId,
      contacts: [
        { name: name || 'Sem nome', email, phone: phone || undefined }
      ]
    }
  };

  const create = await rdFetch('/deals', token, { method: 'POST', body: dealBody });
  const createdId = create.data?.id || create.data?._id || create.data?.deal?.id || create.data?.deal?._id || null;

  // Verifica estado final do deal
  let verified = null;
  if (createdId) {
    const get = await rdFetch(`/deals/${encodeURIComponent(createdId)}`, token);
    verified = {
      status: get.status,
      ok: get.ok,
      deal_name: get.data?.name || get.data?.deal?.name || null,
      contacts_field: get.data?.contacts || get.data?.deal?.contacts || null,
      contacts_count: Array.isArray(get.data?.contacts) ? get.data.contacts.length : (Array.isArray(get.data?.deal?.contacts) ? get.data.deal.contacts.length : 0),
      contacts_sample: Array.isArray(get.data?.contacts) ? get.data.contacts.slice(0, 3).map(c => ({ id: c.id || c._id, name: c.name, email: c.emails?.[0]?.email || c.email })) : null
    };
  }

  // Também checa: o contato listado é o mesmo que já existia (por email)?
  let contactLookup = null;
  if (email) {
    const cSearch = await rdFetch(`/contacts?email=${encodeURIComponent(email)}`, token);
    const matches = cSearch.data?.contacts || cSearch.data?.data || [];
    contactLookup = {
      count: Array.isArray(matches) ? matches.length : 0,
      first: Array.isArray(matches) && matches[0] ? { id: matches[0].id || matches[0]._id, name: matches[0].name } : null
    };
  }

  return res.status(200).json({
    ok: true,
    sentBody: dealBody,
    createStatus: create.status,
    createOk: create.ok,
    createdId,
    createError: create.error || null,
    createResponse: typeof create.data === 'object' ? JSON.stringify(create.data).slice(0, 500) : null,
    verified,
    contactLookup
  });
};
