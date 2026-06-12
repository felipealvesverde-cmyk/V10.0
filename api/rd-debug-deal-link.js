// V34.9.3.4 — Diagnóstico cirúrgico do link contato↔deal e rename do deal.
// Testa 4-5 variações de body e método pra descobrir o que o RD CRM aceita.
//
// GET /api/rd-debug-deal-link
//   → pega 1 visitor com external_rd_deal_id + external_rd_contact_id
//      do user logado, mostra ID dos dois
// POST /api/rd-debug-deal-link
//   body { deal_id, contact_id, new_name }
//   → testa 5 variações de cada operação, retorna response cru de cada

const { rdFetch } = require('../lib/rd-contact-sync-engine');
const { getRdCredential } = require('../lib/rd-credentials');
const { resolveCredentialOwnerId } = require('../lib/credentials-owner');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  // V37.4.34 — Dados e credenciais vivem na linha do OWNER do tenant.
  const userId = Number(await resolveCredentialOwnerId(req));

  let token = null;
  try {
    const cred = await getRdCredential(req.tenantDb, userId, 'crm_pat');
    token = cred?.token;
  } catch (err) {
    return res.status(400).json({ ok: false, message: `RD CRM não conectado: ${err.message}` });
  }
  if (!token) return res.status(400).json({ ok: false, message: 'crm_pat não configurado.' });

  if (req.method === 'GET') {
    // Pega 1 candidato pra testar
    const v = await req.tenantDb.query(
      `SELECT lj_visitor_id, name, email, external_rd_contact_id, external_rd_deal_id
         FROM lj_visitors
        WHERE user_id = $1
          AND external_rd_deal_id IS NOT NULL
          AND external_rd_contact_id IS NOT NULL
        ORDER BY updated_at DESC LIMIT 1`,
      [userId]
    );
    if (!v.rows.length) {
      return res.status(200).json({ ok: true, message: 'Nenhum visitor com deal_id+contact_id encontrado.' });
    }
    return res.status(200).json({ ok: true, candidate: v.rows[0] });
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use GET ou POST.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  const dealId = String(body.deal_id || '').trim();
  const contactId = String(body.contact_id || '').trim();
  const newName = String(body.new_name || '').trim();
  if (!dealId || !contactId) {
    return res.status(400).json({ ok: false, message: 'deal_id e contact_id obrigatórios.' });
  }

  // === Variantes pra LINK contato↔deal ===
  const linkVariants = [
    { label: 'POST /deals/{id}/contacts body { contacts: [{id}] }', path: `/deals/${encodeURIComponent(dealId)}/contacts`, method: 'POST', body: { contacts: [{ id: contactId }] } },
    { label: 'POST /deals/{id}/contacts body { contact_id }', path: `/deals/${encodeURIComponent(dealId)}/contacts`, method: 'POST', body: { contact_id: contactId } },
    { label: 'PATCH /deals/{id} body { deal: { contacts: [{id}] } }', path: `/deals/${encodeURIComponent(dealId)}`, method: 'PATCH', body: { deal: { contacts: [{ id: contactId }] } } },
    { label: 'PUT /deals/{id} body { deal: { contacts: [{id}] } }', path: `/deals/${encodeURIComponent(dealId)}`, method: 'PUT', body: { deal: { contacts: [{ id: contactId }] } } },
    { label: 'PATCH /deals/{id} body { deal: { contact_ids: [id] } }', path: `/deals/${encodeURIComponent(dealId)}`, method: 'PATCH', body: { deal: { contact_ids: [contactId] } } }
  ];
  const linkResults = [];
  for (const v of linkVariants) {
    const r = await rdFetch(v.path, token, { method: v.method, body: v.body });
    linkResults.push({
      label: v.label,
      status: r.status, ok: r.ok,
      elapsedMs: r.elapsedMs,
      data: typeof r.data === 'object' ? JSON.stringify(r.data).slice(0, 300) : String(r.data || '').slice(0, 300),
      error: r.error || null
    });
  }

  // === Variantes pra RENAME do deal ===
  const renameResults = [];
  if (newName) {
    const renameVariants = [
      { label: 'PATCH /deals/{id} body { deal: { name } }', path: `/deals/${encodeURIComponent(dealId)}`, method: 'PATCH', body: { deal: { name: newName } } },
      { label: 'PUT /deals/{id} body { deal: { name } }', path: `/deals/${encodeURIComponent(dealId)}`, method: 'PUT', body: { deal: { name: newName } } },
      { label: 'PATCH /deals/{id} body { name }', path: `/deals/${encodeURIComponent(dealId)}`, method: 'PATCH', body: { name: newName } }
    ];
    for (const v of renameVariants) {
      const r = await rdFetch(v.path, token, { method: v.method, body: v.body });
      renameResults.push({
        label: v.label,
        status: r.status, ok: r.ok,
        elapsedMs: r.elapsedMs,
        data: typeof r.data === 'object' ? JSON.stringify(r.data).slice(0, 300) : String(r.data || '').slice(0, 300),
        error: r.error || null
      });
    }
  }

  // GET final do deal pra ver estado pós-tentativas
  const finalGet = await rdFetch(`/deals/${encodeURIComponent(dealId)}`, token, { method: 'GET' });

  return res.status(200).json({
    ok: true,
    dealId, contactId, newName,
    linkResults,
    renameResults,
    finalDealState: {
      status: finalGet.status,
      ok: finalGet.ok,
      data_keys: finalGet.data && typeof finalGet.data === 'object' ? Object.keys(finalGet.data) : null,
      name: finalGet.data?.deal?.name || finalGet.data?.name || null,
      contacts: finalGet.data?.deal?.contacts || finalGet.data?.contacts || null
    }
  });
};
