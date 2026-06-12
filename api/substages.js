// V34.9.20 — CRUD de sub-stages (mini-funil por campanha × parent_stage).
//
// GET    /api/substages?campaign_id=X&parent_stage=Y → lista com contagem de leads
// POST   /api/substages → cria/atualiza um sub-stage
// DELETE /api/substages?id=Z[&move_leads_to=W] → exclui (leads vão p/ outro sub-stage ou ficam órfãos)
//
// Self-scope: user vê/edita só seus próprios sub-stages.

const { listSubstagesWithCounts, syncSubstageCacheForBolinha } = require('../lib/substage-engine');
const { resolveCredentialOwnerId } = require('../lib/credentials-owner');

const FIXED_STAGES = new Set([
  'marketing-tof', 'marketing-mof', 'marketing-bof',
  'vendas-tof',    'vendas-mof',    'vendas-bof',
  'cs-tof',        'cs-mof',        'cs-bof'
]);

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  // V37.4.34 — Substages vivem na linha do OWNER do tenant.
  const userId = await resolveCredentialOwnerId(req);

  try {
    if (req.method === 'GET') {
      const campaignId = Number(req.query?.campaign_id || 0);
      const parentStage = String(req.query?.parent_stage || '').toLowerCase();
      if (!campaignId || !FIXED_STAGES.has(parentStage)) {
        return res.status(400).json({ ok: false, message: 'campaign_id e parent_stage válidos são obrigatórios.' });
      }
      const substages = await listSubstagesWithCounts(req.tenantDb, userId, campaignId, parentStage);
      return res.status(200).json({ ok: true, substages });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
      body = body || {};

      const id = body.id ? Number(body.id) : null;
      const campaignId = Number(body.campaign_id || 0);
      const parentStage = String(body.parent_stage || '').toLowerCase();
      const orderIdx = Number.isFinite(Number(body.order_idx)) ? Number(body.order_idx) : 0;
      const name = String(body.name || '').trim().slice(0, 120);
      const tagTrigger = body.tag_trigger ? String(body.tag_trigger).trim().toLowerCase().slice(0, 120) : null;
      const color = body.color ? String(body.color).trim().slice(0, 16) : null;

      if (!campaignId || !FIXED_STAGES.has(parentStage)) {
        return res.status(400).json({ ok: false, message: 'campaign_id e parent_stage válidos são obrigatórios.' });
      }
      if (!name) return res.status(400).json({ ok: false, message: 'name obrigatório.' });

      if (id) {
        // UPDATE (mesma campaign + parent_stage do sub-stage existente)
        const r = await req.tenantDb.query(
          `UPDATE lj_substages
              SET name = $2, tag_trigger = $3, color = $4, order_idx = $5, updated_at = NOW()
            WHERE id = $1 AND user_id = $6
            RETURNING id, order_idx, name, tag_trigger, color, parent_stage, campaign_id`,
          [id, name, tagTrigger, color, orderIdx, userId]
        );
        if (!r.rows.length) return res.status(404).json({ ok: false, message: 'Sub-stage não encontrado.' });
        // V35.0.0 — Sincroniza cache em background (mudança de tag → leads se redistribuem)
        const updated = r.rows[0];
        syncSubstageCacheForBolinha(req.tenantDb, userId, Number(updated.campaign_id), updated.parent_stage).catch(() => {});
        return res.status(200).json({ ok: true, substage: updated });
      }

      // INSERT — order_idx auto se não vier
      let finalOrder = orderIdx;
      if (!body.order_idx) {
        const maxR = await req.tenantDb.query(
          `SELECT COALESCE(MAX(order_idx), -1) + 1 AS next_order
             FROM lj_substages WHERE user_id = $1 AND campaign_id = $2 AND parent_stage = $3`,
          [userId, campaignId, parentStage]
        );
        finalOrder = Number(maxR.rows[0].next_order || 0);
      }

      const r = await req.tenantDb.query(
        `INSERT INTO lj_substages (user_id, campaign_id, parent_stage, order_idx, name, tag_trigger, color)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, order_idx, name, tag_trigger, color, parent_stage, campaign_id`,
        [userId, campaignId, parentStage, finalOrder, name, tagTrigger, color]
      );
      // V35.0.0 — Sincroniza cache em background (não bloqueia resposta)
      syncSubstageCacheForBolinha(req.tenantDb, userId, campaignId, parentStage).catch(() => {});
      return res.status(200).json({ ok: true, substage: r.rows[0] });
    }

    if (req.method === 'DELETE') {
      const id = Number(req.query?.id || 0);
      if (!id) return res.status(400).json({ ok: false, message: 'id obrigatório.' });
      // Lê parent_stage + campaign_id antes do delete pra sincronizar cache depois
      const beforeR = await req.tenantDb.query(
        `SELECT campaign_id, parent_stage FROM lj_substages WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );
      const r = await req.tenantDb.query(
        `DELETE FROM lj_substages WHERE id = $1 AND user_id = $2 RETURNING id`,
        [id, userId]
      );
      if (!r.rows.length) return res.status(404).json({ ok: false, message: 'Sub-stage não encontrado.' });
      // V35.0.0 — Sincroniza cache em background
      if (beforeR.rows.length) {
        const b = beforeR.rows[0];
        syncSubstageCacheForBolinha(req.tenantDb, userId, Number(b.campaign_id), b.parent_stage).catch(() => {});
      }
      return res.status(200).json({ ok: true, deletedId: r.rows[0].id });
    }

    return res.status(405).json({ ok: false, message: 'Use GET / POST / DELETE.' });
  } catch (err) {
    console.error('[substages]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
