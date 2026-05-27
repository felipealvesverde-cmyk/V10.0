// V34.8.5 — GET /api/rd-debug-contacts
// Diagnóstico: retorna response cru de GET /contacts no RD CRM, sem
// interpretar/extrair. Pra entender o shape do JSON antes de ajustar
// pullUpdatedContacts.

const { rdFetch } = require('../lib/rd-contact-sync-engine');
const { getRdCredential } = require('../lib/rd-credentials');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);
  const limit = Math.min(Number(req.query?.limit || 5), 20);

  let token = null;
  try {
    const cred = await getRdCredential(req.tenantDb, userId, 'crm_pat');
    token = cred?.token;
  } catch (err) {
    return res.status(400).json({ ok: false, message: `RD CRM não conectado: ${err.message}` });
  }
  if (!token) return res.status(400).json({ ok: false, message: 'crm_pat sem access_token.' });

  // Tenta 3 variantes pra ver qual o RD aceita.
  // RD CRM legacy v1 doc oficial mostra GET /contacts retornando { contacts, has_more, total }
  // Mas pode mudar dependendo da versão da API. Testa as 3 mais comuns:
  const variants = [
    { label: 'GET /contacts (sem order)', path: `/contacts?limit=${limit}&page=1` },
    { label: 'GET /contacts (order=updated_at,desc)', path: `/contacts?limit=${limit}&order=updated_at,desc&page=1` },
    { label: 'GET /contacts/search', path: `/contacts/search?limit=${limit}` }
  ];

  const results = [];
  for (const v of variants) {
    const r = await rdFetch(v.path, token, { method: 'GET' });
    results.push({
      label: v.label,
      path: v.path,
      status: r.status,
      ok: r.ok,
      elapsedMs: r.elapsedMs,
      data_type: Array.isArray(r.data) ? 'array' : typeof r.data,
      data_keys: r.data && typeof r.data === 'object' ? Object.keys(r.data).slice(0, 10) : null,
      data_sample: Array.isArray(r.data)
        ? r.data.slice(0, 2)
        : (r.data?.contacts ? { contacts_count: r.data.contacts.length, contacts_sample: r.data.contacts.slice(0, 2), other_keys: Object.keys(r.data).filter(k => k !== 'contacts') } : r.data),
      error: r.error || null
    });
  }

  return res.status(200).json({ ok: true, userId, results });
};
