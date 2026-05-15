// V21.6 — RD CRM Movement Engine
// Move o lead no pipeline RD CRM (1 por campanha) quando um checkpoint dispara
// mudança de estágio. Aceita campaignId p/ resolver qual pipeline/stageMap usar.
//
// V22.0 — Agora move o DEAL real no RD via RdCrmDealService.moveDealToStage,
// não só atualiza tag local. Se o deal não existe ainda (lead não foi pushado),
// retorna ok:false com pending:true pra o caller decidir (ex: pushar primeiro).
window.RdCrmMovementEngine = {
  async moveLeadToStage(leadIdentityKey, stageCode, campaignId = null) {
    if (!leadIdentityKey || !stageCode || !window.RdCrmApiClient) return { ok: false };
    const stageMap = campaignId != null
      ? (window.RdCrmConfig?.stageMapForCampaign?.(campaignId) || {})
      : (App.state.integrations?.rdCrm?.stageMap || {});
    const stage = stageMap[stageCode];
    if (!stage?.rdStageId) return { ok: false, message: 'Etapa RD não provisionada para esta campanha/etapa.' };

    // Sempre atualiza tag local (acumula contador → score sobe).
    if (window.RdCrmTagService) RdCrmTagService.incrementStage(leadIdentityKey, stageCode);

    // V22.1 — Bônus de score quando o lead atinge o endStage de uma ação
    // configurada na campanha. Significa "completou o fluxo de uma ação"
    // (ex: ação tinha endStage = Mkt MOF; lead chegou lá; +bônus).
    // Mecanismo: incrementa tag de novo (peso 2x) + evento explícito de
    // auditoria via LeadBaseService.pushEvent.
    let bonusAwarded = false;
    let completedActions = [];
    if (campaignId != null && window.RdCrmTagService) {
      const actions = (App.state.actions || []).filter(a =>
        Number(a.campaignId) === Number(campaignId) && a.rdCrmEndStageId === stage.rdStageId
      );
      if (actions.length > 0) {
        RdCrmTagService.incrementStage(leadIdentityKey, stageCode); // +1 extra
        bonusAwarded = true;
        completedActions = actions.map(a => ({ id: a.id, name: a.name }));
        if (window.LeadBaseService?.pushEvent) {
          for (const a of actions) {
            LeadBaseService.pushEvent(leadIdentityKey, {
              source: 'rd-crm',
              type: 'action.completed',
              actionId: a.id,
              actionName: a.name,
              stageCode,
              campaignId: Number(campaignId),
              bonusPoints: 1
            });
          }
        }
      }
    }

    const info = campaignId != null ? window.RdCrmConfig?.pipelineInfoForCampaign?.(campaignId) : null;
    let pushed = false;
    let pushMessage = '';

    // V22.0 — Se o deal do lead nessa campanha já existe no RD, move ele.
    if (campaignId != null && window.RdCrmConfig?.dealForLead) {
      const dealEntry = RdCrmConfig.dealForLead(leadIdentityKey, campaignId);
      if (dealEntry?.rdDealId && window.RdCrmDealService?.moveDealToStage) {
        const result = await RdCrmDealService.moveDealToStage(dealEntry.rdDealId, stage.rdStageId);
        if (result.ok) {
          pushed = true;
          RdCrmConfig.setDealForLead(leadIdentityKey, campaignId, {
            currentStageCode: stageCode,
            lastMovedAt: new Date().toISOString()
          });
          try { App.save(); } catch (_) {}
        } else {
          pushMessage = result.message || 'Falha ao mover deal no RD.';
        }
      } else {
        pushMessage = 'Lead ainda não tem deal nessa campanha (faltou Enviar ICP).';
      }
    }

    return {
      ok: true,
      pushed,
      pushMessage,
      bonusAwarded,
      completedActions,
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
