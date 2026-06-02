// V35.5.0 — GET /api/google-ads-list-accounts
// Após OAuth, lista contas Google Ads que o refresh_token consegue acessar.
// Usado no wizard pra cliente escolher qual conta operacional conectar.

const { listAccessibleCustomers } = require('../lib/google-ads-oauth');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);

  try {
    const accounts = await listAccessibleCustomers(req.tenantDb, userId);
    return res.status(200).json({ ok: true, accounts });
  } catch (err) {
    console.error('[google-ads-list-accounts]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
