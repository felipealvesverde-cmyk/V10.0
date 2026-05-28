// V34.9.7 — Diagnóstico: testa 5 variações de POST de deal+contato no RD CRM.
//
// Pra cada variante:
//   1. Cria um deal de teste com contato_id já existente (passado no body)
//   2. GET /deals/{id} pra ver se contacts aparece preenchido
//   3. Limpa? Não — deixa pra ver no RD (master pode deletar manualmente)
//
// Use isso 1 vez pra descobrir qual sintaxe o RD aceita PRA SÉRIO.
//
// GET → retorna 1 contato candidate pro Felipe usar como contact_id no POST
// POST body { contact_id, pipeline_id, deal_stage_id, name_prefix }
//   → testa as 5 variantes em sequência

const { rdFetch } = require('../lib/rd-contact-sync-engine');
const { getRdCredential } = require('../lib/rd-credentials');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
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

  // GET → pega candidato (1 contato + pipeline + 1 stage)
  if (req.method === 'GET') {
    // 1 contato qualquer do RD
    const cResp = await rdFetch('/contacts?limit=1', token);
    const contact = cResp.data?.contacts?.[0] || null;

    // Pipelines disponíveis
    const pResp = await rdFetch('/deal_pipelines?limit=20', token);
    const pipelines = pResp.data?.deal_pipelines || pResp.data?.data || pResp.data || [];

    return res.status(200).json({
      ok: true,
      candidateContact: contact ? { id: contact.id || contact._id, name: contact.name, email: contact.emails?.[0]?.email } : null,
      pipelines: (Array.isArray(pipelines) ? pipelines : []).slice(0, 10).map(p => ({ id: p.id || p._id, name: p.name }))
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use GET ou POST.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  const contactId = String(body.contact_id || '').trim();
  const pipelineId = String(body.pipeline_id || '').trim();
  const dealStageId = String(body.deal_stage_id || '').trim();
  const prefix = String(body.name_prefix || 'TEST').trim();
  if (!contactId || !pipelineId || !dealStageId) {
    return res.status(400).json({ ok: false, message: 'contact_id, pipeline_id, deal_stage_id obrigatórios.' });
  }

  // 5 variantes
  const variants = [
    {
      label: 'A: body { deal:{...}, contacts:[{id}] }  ← formato atual leads-impute-rd-push',
      path: '/deals',
      method: 'POST',
      body: { deal: { name: `${prefix}-A`, deal_stage_id: dealStageId, deal_pipeline_id: pipelineId }, contacts: [{ id: contactId }] }
    },
    {
      label: 'B: body { deal:{..., contacts:[{id}]} }  ← contacts dentro do deal',
      path: '/deals',
      method: 'POST',
      body: { deal: { name: `${prefix}-B`, deal_stage_id: dealStageId, deal_pipeline_id: pipelineId, contacts: [{ id: contactId }] } }
    },
    {
      label: 'C: body { deal:{..., contact_ids:[id]} }  ← contact_ids array string',
      path: '/deals',
      method: 'POST',
      body: { deal: { name: `${prefix}-C`, deal_stage_id: dealStageId, deal_pipeline_id: pipelineId, contact_ids: [contactId] } }
    },
    {
      label: 'D: POST /contacts/{id}/deals  ← cria deal a partir do contato',
      path: `/contacts/${encodeURIComponent(contactId)}/deals`,
      method: 'POST',
      body: { deal: { name: `${prefix}-D`, deal_stage_id: dealStageId, deal_pipeline_id: pipelineId } }
    },
    {
      label: 'E: body { deal:{..., contact_links:[{contact_id}]} }  ← contact_links naming',
      path: '/deals',
      method: 'POST',
      body: { deal: { name: `${prefix}-E`, deal_stage_id: dealStageId, deal_pipeline_id: pipelineId, contact_links: [{ contact_id: contactId }] } }
    }
  ];

  const results = [];
  for (const v of variants) {
    const create = await rdFetch(v.path, token, { method: v.method, body: v.body });
    const createdId = create.data?.id || create.data?._id || create.data?.deal?.id || create.data?.deal?._id || null;

    // Se criou, busca de novo pra ver se contato vinculou
    let verified = null;
    if (createdId) {
      const get = await rdFetch(`/deals/${encodeURIComponent(createdId)}`, token);
      verified = {
        status: get.status,
        ok: get.ok,
        deal_name: get.data?.name || get.data?.deal?.name || null,
        deal_contacts: get.data?.contacts || get.data?.deal?.contacts || null,
        deal_contact_count: Array.isArray(get.data?.contacts) ? get.data.contacts.length : (Array.isArray(get.data?.deal?.contacts) ? get.data.deal.contacts.length : 0)
      };
    }

    results.push({
      label: v.label,
      createStatus: create.status,
      createOk: create.ok,
      createdId,
      elapsedMs: create.elapsedMs,
      createError: create.error || null,
      verified
    });
  }

  return res.status(200).json({ ok: true, contactId, pipelineId, dealStageId, results });
};
