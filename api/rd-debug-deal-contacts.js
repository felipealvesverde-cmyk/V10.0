// V34.9.7.8 — GET /api/v1/deals/{deal_id}/contacts — rota dedicada que pode
// retornar contatos vinculados mesmo quando GET /deals/{id} não mostra.
//
// POST body { deal_ids: ['id1', 'id2', ...] } → faz GET em cada e retorna
// quem tem contato vinculado.

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
  const dealIds = Array.isArray(body.deal_ids) ? body.deal_ids : [];
  if (!dealIds.length) return res.status(400).json({ ok: false, message: 'deal_ids: [array] obrigatório.' });

  const results = [];
  for (const dealId of dealIds) {
    // Compara: GET /deals/{id} (rota antiga) vs GET /deals/{id}/contacts (rota dedicada)
    const dealGet = await rdFetch(`/deals/${encodeURIComponent(dealId)}`, token);
    const contactsGet = await rdFetch(`/deals/${encodeURIComponent(dealId)}/contacts`, token);

    results.push({
      dealId,
      dealGet: {
        status: dealGet.status,
        name: dealGet.data?.name || dealGet.data?.deal?.name,
        contacts_in_payload: dealGet.data?.contacts || dealGet.data?.deal?.contacts || null
      },
      contactsGet: {
        status: contactsGet.status,
        ok: contactsGet.ok,
        contacts: contactsGet.data?.contacts || contactsGet.data?.data || (Array.isArray(contactsGet.data) ? contactsGet.data : null),
        contacts_count: Array.isArray(contactsGet.data?.contacts) ? contactsGet.data.contacts.length
                      : Array.isArray(contactsGet.data?.data) ? contactsGet.data.data.length
                      : Array.isArray(contactsGet.data) ? contactsGet.data.length : 0,
        sample_excerpt: typeof contactsGet.data === 'object' ? JSON.stringify(contactsGet.data).slice(0, 300) : null
      }
    });
  }

  return res.status(200).json({ ok: true, results });
};
