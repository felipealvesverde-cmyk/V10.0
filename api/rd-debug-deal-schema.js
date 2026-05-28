// V34.9.7.9 — Variante O: POST /deals com contacts NO FORMATO EXATO do schema.
//
// Schema (confirmado pela doc):
//   contacts: [{
//     name: string,
//     emails: [{ email: string }],          ← ARRAY de OBJECTS, não string!
//     phones: [{ phone: string, type: string }]
//   }]
//
// Hipótese: RD detecta email duplicado e vincula contato existente (upsert).
//
// POST body { contact_email, contact_name, contact_phone, pipeline_id, user_id }
//   → cria deal com estrutura correta do schema

const { rdFetch } = require('../lib/rd-contact-sync-engine');
const { getRdCredential } = require('../lib/rd-credentials');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);
  let token = null;
  try { const c = await getRdCredential(req.tenantDb, userId, 'crm_pat'); token = c?.token; } catch (_) {}
  if (!token) return res.status(400).json({ ok: false, message: 'PAT não configurado.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  const email = String(body.contact_email || '').trim();
  const name = String(body.contact_name || '').trim();
  const phone = String(body.contact_phone || '').trim();
  const pipelineId = String(body.pipeline_id || '').trim();
  const rdUserId = String(body.user_id || '').trim();
  const prefix = String(body.name_prefix || 'TEST-O').trim();
  if (!email || !pipelineId || !rdUserId) {
    return res.status(400).json({ ok: false, message: 'contact_email, pipeline_id, user_id obrigatórios.' });
  }

  // Pega stage
  const stagesResp = await rdFetch(`/deal_stages?deal_pipeline_id=${encodeURIComponent(pipelineId)}`, token);
  const stages = stagesResp.data?.deal_stages || stagesResp.data?.data || stagesResp.data || [];
  const firstStage = Array.isArray(stages) && stages[0] ? (stages[0].id || stages[0]._id) : '';
  if (!firstStage) return res.status(400).json({ ok: false, message: 'Pipeline sem stages.' });

  // VARIANTE O: contacts com estrutura EXATA do schema (emails como array de objects)
  const dealBody = {
    deal: {
      name: prefix,
      user_id: rdUserId,
      deal_stage_id: firstStage
    },
    contacts: [
      {
        name: name || 'Sem nome',
        emails: [{ email }],
        ...(phone ? { phones: [{ phone, type: 'cellphone' }] } : {})
      }
    ]
  };

  const create = await rdFetch('/deals', token, { method: 'POST', body: dealBody });
  const createdId = create.data?.id || create.data?._id || create.data?.deal?.id || null;

  // Verifica com GET /deals/{id}/contacts (rota dedicada — melhor pra ver vínculo)
  let verify = null;
  if (createdId) {
    const dContacts = await rdFetch(`/deals/${encodeURIComponent(createdId)}/contacts`, token);
    verify = {
      status: dContacts.status,
      ok: dContacts.ok,
      contacts_count: dContacts.data?.total || (Array.isArray(dContacts.data?.contacts) ? dContacts.data.contacts.length : 0),
      contacts_sample: Array.isArray(dContacts.data?.contacts) ? dContacts.data.contacts.slice(0, 2).map(c => ({
        id: c.id || c._id, name: c.name, email: c.emails?.[0]?.email
      })) : null,
      raw: typeof dContacts.data === 'object' ? JSON.stringify(dContacts.data).slice(0, 400) : null
    };
  }

  // Verifica se contato existe no RD com esse email (deveria ser o mesmo do LJ — não duplicar)
  let contactLookup = null;
  const cSearch = await rdFetch(`/contacts?email=${encodeURIComponent(email)}`, token);
  const matches = cSearch.data?.contacts || cSearch.data?.data || [];
  contactLookup = {
    total_with_email: Array.isArray(matches) ? matches.length : 0,
    first_id: Array.isArray(matches) && matches[0] ? (matches[0].id || matches[0]._id) : null
  };

  return res.status(200).json({
    ok: true,
    sentBody: dealBody,
    createStatus: create.status,
    createOk: create.ok,
    createdId,
    createResponse: typeof create.data === 'object' ? JSON.stringify(create.data).slice(0, 500) : null,
    verify,
    contactLookup
  });
};
