// V15 — Mapper de ação Journey ↔ pipeline RD CRM.
// Cada ação pode opcionalmente ser ligada ao pipeline RD, com etapa inicial
// e etapa final que definem a conversão completa.
window.RdCrmActionMapper = {
  isMapped(action) {
    return Boolean(action?.rdCrmEnabled && action?.rdCrmPipelineId && action?.rdCrmStartStageId);
  },

  ensureFields(action) {
    return {
      ...action,
      rdCrmEnabled: Boolean(action.rdCrmEnabled),
      rdCrmPipelineId: action.rdCrmPipelineId || '',
      rdCrmStartStageId: action.rdCrmStartStageId || '',
      rdCrmEndStageId: action.rdCrmEndStageId || '',
      rdCrmOwnerId: action.rdCrmOwnerId || '',
      rdCrmTags: Array.isArray(action.rdCrmTags) ? action.rdCrmTags : [],
      rdCrmSyncStatus: action.rdCrmSyncStatus || 'pending',
      rdCrmLastSyncAt: action.rdCrmLastSyncAt || ''
    };
  },

  linkAction(actionId, payload = {}) {
    const index = (App.state.actions || []).findIndex(a => Number(a.id) === Number(actionId));
    if (index < 0) return { ok: false, message: 'Ação não encontrada.' };
    const action = App.state.actions[index];
    const next = this.ensureFields({
      ...action,
      rdCrmEnabled: payload.enabled !== undefined ? Boolean(payload.enabled) : action.rdCrmEnabled,
      rdCrmPipelineId: payload.pipelineId || action.rdCrmPipelineId,
      rdCrmStartStageId: payload.startStageId || action.rdCrmStartStageId,
      rdCrmEndStageId: payload.endStageId || action.rdCrmEndStageId,
      rdCrmOwnerId: payload.ownerId || action.rdCrmOwnerId,
      rdCrmTags: payload.tags || action.rdCrmTags || []
    });
    App.state.actions[index] = next;
    return { ok: true, action: next };
  },

  unlinkAction(actionId) {
    const index = (App.state.actions || []).findIndex(a => Number(a.id) === Number(actionId));
    if (index < 0) return { ok: false, message: 'Ação não encontrada.' };
    App.state.actions[index] = this.ensureFields({ ...App.state.actions[index], rdCrmEnabled: false });
    return { ok: true };
  },

  mappedActions() {
    return (App.state.actions || []).filter(a => this.isMapped(a));
  },

  // V21.6 — resolve o stageMap correto para esta ação. Prioridade:
  // 1. pipeline da campanha (per-campaign), 2. legacy global stageMap.
  stageMapForAction(action) {
    if (!action) return {};
    if (action.campaignId != null) {
      const map = RdCrmConfig.stageMapForCampaign(action.campaignId);
      if (map && Object.keys(map).length) return map;
    }
    return App.state.integrations?.rdCrm?.stageMap || {};
  },

  pipelineForAction(action) {
    if (action?.campaignId != null) {
      const info = RdCrmConfig.pipelineInfoForCampaign(action.campaignId);
      if (info?.pipelineId) return info;
    }
    const cfg = App.state.integrations?.rdCrm || {};
    if (cfg.pipelineId) return { pipelineId: cfg.pipelineId, pipelineName: cfg.pipelineName, stageMap: cfg.stageMap || {} };
    return null;
  },

  computeConversion(action) {
    // O cálculo real consome os events do RD; aqui derivamos a partir dos
    // contadores locais de tag por etapa. Quando o sync popula tags, este
    // método reflete leads que efetivamente passaram pela etapa final.
    if (!this.isMapped(action)) return null;
    const stageMap = this.stageMapForAction(action);
    const endStage = Object.entries(stageMap).find(([, info]) => info.rdStageId === action.rdCrmEndStageId);
    if (!endStage) return null;
    const tag = endStage[1].tag;
    let leadsAtEnd = 0;
    const root = App.state.rdCrmLeadTags || {};
    for (const entry of Object.values(root)) {
      if ((entry.etapas?.[tag] || 0) > 0) leadsAtEnd += 1;
    }
    const totalLeads = (action.leads || []).length;
    const rate = totalLeads > 0 ? (leadsAtEnd / totalLeads) * 100 : 0;
    return { leadsAtEnd, totalLeads, conversionRate: rate };
  },

  syncAction(action) {
    if (!this.isMapped(action)) return { ok: true, dryRun: true };
    const conversion = this.computeConversion(action);
    const index = (App.state.actions || []).findIndex(a => Number(a.id) === Number(action.id));
    if (index >= 0) {
      App.state.actions[index] = {
        ...App.state.actions[index],
        rdCrmSyncStatus: 'synced',
        rdCrmLastSyncAt: new Date().toISOString(),
        rdCrmConversion: conversion
      };
    }
    return { ok: true, conversion };
  }
};
