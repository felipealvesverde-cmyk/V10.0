// V21.6 — RD CRM Movement Engine
// Move o lead no pipeline RD CRM (1 por campanha) quando um checkpoint dispara
// mudança de estágio. Aceita campaignId p/ resolver qual pipeline/stageMap usar.
window.RdCrmMovementEngine = {
  async moveLeadToStage(leadIdentityKey, stageCode, campaignId = null) {
    if (!leadIdentityKey || !stageCode || !window.RdCrmApiClient) return { ok: false };
    const stageMap = campaignId != null
      ? (window.RdCrmConfig?.stageMapForCampaign?.(campaignId) || {})
      : (App.state.integrations?.rdCrm?.stageMap || {});
    const stage = stageMap[stageCode];
    if (!stage?.rdStageId) return { ok: false, message: 'Etapa RD não provisionada para esta campanha/etapa.' };
    if (window.RdCrmTagService) RdCrmTagService.incrementStage(leadIdentityKey, stageCode);
    const info = campaignId != null ? window.RdCrmConfig?.pipelineInfoForCampaign?.(campaignId) : null;
    return {
      ok: true,
      moved: {
        leadIdentityKey,
        stageCode,
        rdStageId: stage.rdStageId,
        campaignId: campaignId != null ? Number(campaignId) : null,
        pipelineId: info?.pipelineId || null,
        at: new Date().toISOString()
      }
    };
  }
};
