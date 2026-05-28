// V35.0.0 — POST /api/substages-reorder
// Recebe array de ids ordenado e reatribui order_idx (0..n-1).
// Body: { campaign_id, parent_stage, ordered_ids: [id1, id2, ...] }

const { syncSubstageCacheForBolinha } = require('../lib/substage-engine');

const FIXED_STAGES = new Set([
  'marketing-tof', 'marketing-mof', 'marketing-bof',
  'vendas-tof',    'vendas-mof',    'vendas-bof',
  'cs-tof',        'cs-mof',        'cs-bof'
]);

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  const campaignId = Number(body.campaign_id || 0);
  const parentStage = String(body.parent_stage || '').toLowerCase();
  const orderedIds = Array.isArray(body.ordered_ids) ? body.ordered_ids.map(Number).filter(Boolean) : [];

  if (!campaignId || !FIXED_STAGES.has(parentStage) || !orderedIds.length) {
    return res.status(400).json({ ok: false, message: 'campaign_id, parent_stage e ordered_ids são obrigatórios.' });
  }

  try {
    // Bulk update — order_idx vira a posição no array
    for (let i = 0; i < orderedIds.length; i++) {
      await req.tenantDb.query(
        `UPDATE lj_substages SET order_idx = $1, updated_at = NOW()
          WHERE id = $2 AND user_id = $3 AND campaign_id = $4 AND parent_stage = $5`,
        [i, orderedIds[i], userId, campaignId, parentStage]
      );
    }
    // Sincroniza cache porque a entrada padrão (order_idx = 0) pode ter mudado de identidade
    syncSubstageCacheForBolinha(req.tenantDb, userId, campaignId, parentStage).catch(() => {});
    return res.status(200).json({ ok: true, reordered: orderedIds.length });
  } catch (err) {
    console.error('[substages-reorder]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
