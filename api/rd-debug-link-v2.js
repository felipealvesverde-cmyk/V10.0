// V34.9.7.2 — Rodada 2 de diagnóstico: endpoints dedicados pra link contato↔deal.
//
// Variantes anteriores (V34.9.7) testaram POST /deals com diferentes formatos
// de body — todas criaram deal mas NENHUMA vinculou contato.
// Esta rodada testa endpoints específicos de associação (assumindo que deal e
// contato JÁ existem):
//
// POST /api/rd-debug-link-v2 body { contact_id, deal_id }
//   → testa 6 variantes de link pós-criação, retorna response + verificação

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
  const contactId = String(body.contact_id || '').trim();
  const dealId = String(body.deal_id || '').trim();
  if (!contactId || !dealId) return res.status(400).json({ ok: false, message: 'contact_id e deal_id obrigatórios.' });

  const variants = [
    {
      label: 'F: POST /contact_links body { contact_id, deal_id }',
      path: '/contact_links',
      method: 'POST',
      body: { contact_id: contactId, deal_id: dealId }
    },
    {
      label: 'G: POST /deal_contact_links body { contact_id, deal_id }',
      path: '/deal_contact_links',
      method: 'POST',
      body: { contact_id: contactId, deal_id: dealId }
    },
    {
      label: 'H: POST /deal_contact_links body { deal_contact_link: { contact_id, deal_id } }',
      path: '/deal_contact_links',
      method: 'POST',
      body: { deal_contact_link: { contact_id: contactId, deal_id: dealId } }
    },
    {
      label: 'I: PATCH /contacts/{id} body { contact: { deals: [{id}] } }',
      path: `/contacts/${encodeURIComponent(contactId)}`,
      method: 'PATCH',
      body: { contact: { deals: [{ id: dealId }] } }
    },
    {
      label: 'J: PATCH /contacts/{id} body { contact: { deal_ids: [id] } }',
      path: `/contacts/${encodeURIComponent(contactId)}`,
      method: 'PATCH',
      body: { contact: { deal_ids: [dealId] } }
    },
    {
      label: 'K: POST /deals/{deal_id}/contact_links body { contact_id }',
      path: `/deals/${encodeURIComponent(dealId)}/contact_links`,
      method: 'POST',
      body: { contact_id: contactId }
    }
  ];

  const results = [];
  for (const v of variants) {
    const r = await rdFetch(v.path, token, { method: v.method, body: v.body });
    results.push({
      label: v.label,
      status: r.status,
      ok: r.ok,
      elapsedMs: r.elapsedMs,
      response_excerpt: typeof r.data === 'object' ? JSON.stringify(r.data).slice(0, 300) : String(r.data || '').slice(0, 300),
      error: r.error || null
    });
  }

  // Verificação final: GET contato e GET deal pra ver se aparece o link
  const contactAfter = await rdFetch(`/contacts/${encodeURIComponent(contactId)}`, token);
  const dealAfter = await rdFetch(`/deals/${encodeURIComponent(dealId)}`, token);

  return res.status(200).json({
    ok: true,
    contactId, dealId,
    results,
    afterState: {
      contact: {
        status: contactAfter.status,
        deals_field: contactAfter.data?.deals || contactAfter.data?.contact?.deals || null,
        deals_count: Array.isArray(contactAfter.data?.deals) ? contactAfter.data.deals.length : (Array.isArray(contactAfter.data?.contact?.deals) ? contactAfter.data.contact.deals.length : 0)
      },
      deal: {
        status: dealAfter.status,
        contacts_field: dealAfter.data?.contacts || dealAfter.data?.deal?.contacts || null,
        contacts_count: Array.isArray(dealAfter.data?.contacts) ? dealAfter.data.contacts.length : (Array.isArray(dealAfter.data?.deal?.contacts) ? dealAfter.data.deal.contacts.length : 0)
      }
    }
  });
};
