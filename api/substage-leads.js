// V34.9.20 — GET /api/substage-leads?campaign_id=X&parent_stage=Y&substage_id=Z
// Lista leads que estão num sub-stage específico. Usado pelo botão "ver leads"
// de cada linha do mini-funil.

const { listLeadsInSubstage } = require('../lib/substage-engine');

const FIXED_STAGES = new Set([
  'marketing-tof', 'marketing-mof', 'marketing-bof',
  'vendas-tof',    'vendas-mof',    'vendas-bof',
  'cs-tof',        'cs-mof',        'cs-bof'
]);

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);
  const campaignId = Number(req.query?.campaign_id || 0);
  const parentStage = String(req.query?.parent_stage || '').toLowerCase();
  const substageId = Number(req.query?.substage_id || 0);
  const limit = Math.min(Number(req.query?.limit || 200), 500);

  if (!campaignId || !FIXED_STAGES.has(parentStage) || !substageId) {
    return res.status(400).json({ ok: false, message: 'campaign_id, parent_stage e substage_id são obrigatórios.' });
  }

  try {
    const leads = await listLeadsInSubstage(req.tenantDb, userId, campaignId, parentStage, substageId, limit);
    return res.status(200).json({ ok: true, leads });
  } catch (err) {
    console.error('[substage-leads]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
