// V35.7.0-alpha4 — Lista campanhas Google Ads agregadas 30d.
//
// GET /api/google-ads-campaigns-list
//
// Lê de lj_google_ads_campaigns_daily, agrupa por campaign_id, retorna
// no mesmo formato do mock (campaign_id, campaign_name, metrics_30d, etc).
//
// Frontend usa pra preencher state.googleAdsCampaignsCache. Se retornar []
// (sync nunca rodou ou conta nova), frontend cai pro mock.

const { listCampaignsAggregated30d } = require('../lib/google-ads-sync');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);
  try {
    const campaigns = await listCampaignsAggregated30d(req.tenantDb, userId);
    return res.json({ ok: true, campaigns });
  } catch (err) {
    console.error('[google-ads-campaigns-list] erro:', err);
    return res.status(500).json({ ok: false, message: err.message || 'Erro interno.' });
  }
};
