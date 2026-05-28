// V34.9.7.7 — Testa POST /deals legacy COM user_id no body (campo que faltava).
//
// 1. GET → retorna user_id do Sansone (pra usar no POST)
// 2. POST { contact_id, pipeline_id, user_id } → cria deal com user_id +
//    contacts:[{id}] e verifica visualmente.

const { rdFetch } = require('../lib/rd-contact-sync-engine');
const { getRdCredential } = require('../lib/rd-credentials');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);

  let token = null;
  try { const c = await getRdCredential(req.tenantDb, userId, 'crm_pat'); token = c?.token; } catch (_) {}
  if (!token) return res.status(400).json({ ok: false, message: 'PAT RD CRM não configurado.' });

  if (req.method === 'GET') {
    // Lista usuários do RD
    const r = await rdFetch('/users', token);
    const users = r.data?.users || r.data?.data || r.data || [];
    return res.status(200).json({
      ok: true,
      users: (Array.isArray(users) ? users : []).slice(0, 10).map(u => ({
        id: u.id || u._id, name: u.name, email: u.email
      }))
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use GET ou POST.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  const contactId = String(body.contact_id || '').trim();
  const pipelineId = String(body.pipeline_id || '').trim();
  const rdUserId = String(body.user_id || '').trim();
  const prefix = String(body.name_prefix || 'TEST-USR').trim();
  if (!contactId || !pipelineId || !rdUserId) {
    return res.status(400).json({ ok: false, message: 'contact_id, pipeline_id e user_id obrigatórios.' });
  }

  // Pega primeiro stage da pipeline
  const stagesResp = await rdFetch(`/deal_stages?deal_pipeline_id=${encodeURIComponent(pipelineId)}`, token);
  const stages = stagesResp.data?.deal_stages || stagesResp.data?.data || stagesResp.data || [];
  const firstStage = Array.isArray(stages) && stages[0] ? (stages[0].id || stages[0]._id) : '';
  if (!firstStage) return res.status(400).json({ ok: false, message: 'Pipeline sem stages.' });

  // VARIANTE M: body com user_id no deal + contacts no root
  const dealBody = {
    deal: {
      name: `${prefix}-M-with-user`,
      user_id: rdUserId,
      deal_stage_id: firstStage,
      deal_pipeline_id: pipelineId
    },
    contacts: [{ id: contactId }]
  };
  const createM = await rdFetch('/deals', token, { method: 'POST', body: dealBody });
  const createdMId = createM.data?.id || createM.data?._id || createM.data?.deal?.id || null;

  // VARIANTE N: body com user_id + contacts DENTRO do deal
  const dealBodyN = {
    deal: {
      name: `${prefix}-N-contacts-inside`,
      user_id: rdUserId,
      deal_stage_id: firstStage,
      deal_pipeline_id: pipelineId,
      contacts: [{ id: contactId }]
    }
  };
  const createN = await rdFetch('/deals', token, { method: 'POST', body: dealBodyN });
  const createdNId = createN.data?.id || createN.data?._id || createN.data?.deal?.id || null;

  // Verifica ambos
  let verifyM = null, verifyN = null;
  if (createdMId) {
    const g = await rdFetch(`/deals/${encodeURIComponent(createdMId)}`, token);
    verifyM = {
      status: g.status,
      deal_name: g.data?.name || g.data?.deal?.name,
      contacts_count: Array.isArray(g.data?.contacts) ? g.data.contacts.length : (Array.isArray(g.data?.deal?.contacts) ? g.data.deal.contacts.length : 0),
      contacts: g.data?.contacts || g.data?.deal?.contacts || null
    };
  }
  if (createdNId) {
    const g = await rdFetch(`/deals/${encodeURIComponent(createdNId)}`, token);
    verifyN = {
      status: g.status,
      deal_name: g.data?.name || g.data?.deal?.name,
      contacts_count: Array.isArray(g.data?.contacts) ? g.data.contacts.length : (Array.isArray(g.data?.deal?.contacts) ? g.data.deal.contacts.length : 0),
      contacts: g.data?.contacts || g.data?.deal?.contacts || null
    };
  }

  return res.status(200).json({
    ok: true,
    inputs: { contactId, pipelineId, rdUserId, dealStageId: firstStage },
    variantM: { sent: dealBody, createStatus: createM.status, createOk: createM.ok, createdId: createdMId, verify: verifyM },
    variantN: { sent: dealBodyN, createStatus: createN.status, createOk: createN.ok, createdId: createdNId, verify: verifyN }
  });
};
