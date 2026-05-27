// V34.9.4 — Espelhamento LJ → RD do estágio do deal.
//
// Quando o motor de transição move o lead de TOF pra MOF (etc.) dentro do LJ,
// esta função reflete a mudança no RD CRM: PATCH /deals/{deal_id} body
// { deal: { deal_stage_id: X } }, onde X vem de stageMap da campanha.
//
// Fallbacks (cravados em V34.9.4):
//   - Sem deal_id no visitor    → marca pending-deal-creation
//   - Sem stageMap na campanha  → marca pending-stage-update
//   - PATCH falhou (RD off etc) → marca pending-stage-update
//
// O cron-rd-pull e o botão Conciliar processam esses pending depois.

const { rdFetch } = require('./rd-contact-sync-engine');

// Resolve deal_stage_id do RD pra um stage do LJ (ex.: marketing-mof).
// Lê do journey_state legacy onde rdCrmSyncEngine guarda pipelinesByCampaign.
// Retorna { dealStageId, pipelineId } ou null se não tem mapping.
async function resolveRdStageMapping(tenantDb, userId, campaignId, ljStage) {
  try {
    // pipelinesByCampaign vive no journey_state.state_json.integrations.rd.crmConfig
    const r = await tenantDb.query(
      `SELECT state_json FROM journey_state WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    const state = r.rows[0]?.state_json;
    const crmCfg = state?.integrations?.rd?.crmConfig
                 || state?.integrations?.rd
                 || null;
    if (!crmCfg?.pipelinesByCampaign) return null;
    const entry = crmCfg.pipelinesByCampaign[campaignId]
               || crmCfg.pipelinesByCampaign[String(campaignId)]
               || crmCfg.pipelinesByCampaign[Number(campaignId)];
    if (!entry?.stageMap) return null;
    const dealStageId = entry.stageMap[ljStage] || null;
    if (!dealStageId) return null;
    return { dealStageId, pipelineId: entry.pipelineId };
  } catch (err) {
    console.warn('[rd-stage-mirror] resolveRdStageMapping err:', err.message);
    return null;
  }
}

async function markStatus(tenantDb, userId, visitorId, status, reason = null) {
  try {
    await tenantDb.query(
      `UPDATE lj_visitors SET external_rd_sync_status = $3,
         external_rd_sync_error = $4, updated_at = NOW()
        WHERE user_id = $1 AND lj_visitor_id = $2`,
      [userId, visitorId, status, reason ? String(reason).slice(0, 200) : null]
    );
  } catch (err) {
    console.warn('[rd-stage-mirror markStatus]', err.message);
  }
}

// Espelha movimento LJ → RD. Sempre devolve { ok, source, note }.
// Caller (transition engine) já fez UPDATE local; aqui só sincroniza o RD.
async function mirrorStageToRd({ tenantDb, userId, visitor, campaignId, newStage, token }) {
  if (!campaignId) return { ok: false, source: 'no-campaign', note: 'sem campaign_id, skip' };
  if (newStage === 'EXIT') return { ok: true, source: 'exit-skip', note: 'EXIT trata em outro caminho' };

  // Resolve deal_stage_id
  const mapping = await resolveRdStageMapping(tenantDb, userId, campaignId, newStage);
  if (!mapping) {
    await markStatus(tenantDb, userId, visitor.lj_visitor_id, 'pending-stage-update', `no-mapping:${newStage}`);
    return { ok: false, source: 'no-mapping', note: 'sem stageMap pro stage, marcado pending-stage-update' };
  }

  // Visitor sem deal? Marca pending-deal-creation
  if (!visitor.external_rd_deal_id) {
    await markStatus(tenantDb, userId, visitor.lj_visitor_id, 'pending-deal-creation', `target:${newStage}`);
    return { ok: false, source: 'no-deal', note: 'sem external_rd_deal_id, marcado pending-deal-creation' };
  }

  // Sem token? Marca pending pra próximo cron tentar
  if (!token) {
    await markStatus(tenantDb, userId, visitor.lj_visitor_id, 'pending-stage-update', 'no-token');
    return { ok: false, source: 'no-token', note: 'sem token RD, marcado pending-stage-update' };
  }

  // Try PATCH
  const r = await rdFetch(`/deals/${encodeURIComponent(visitor.external_rd_deal_id)}`, token, {
    method: 'PATCH',
    body: { deal: { deal_stage_id: mapping.dealStageId } }
  });
  if (r.ok) {
    await tenantDb.query(
      `UPDATE lj_visitors SET external_rd_sync_status = 'synced',
         external_rd_sync_error = NULL, external_rd_synced_at = NOW(),
         updated_at = NOW()
        WHERE user_id = $1 AND lj_visitor_id = $2`,
      [userId, visitor.lj_visitor_id]
    );
    return { ok: true, source: 'patched', note: `deal_stage_id=${mapping.dealStageId}` };
  }
  // Falhou — marca pending pra retry no cron
  await markStatus(tenantDb, userId, visitor.lj_visitor_id, 'pending-stage-update', `http-${r.status}`);
  return { ok: false, source: 'patch-failed', note: `HTTP ${r.status}`, status: r.status };
}

module.exports = { mirrorStageToRd, resolveRdStageMapping };
