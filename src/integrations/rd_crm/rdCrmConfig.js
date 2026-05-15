// V15 — RD Station CRM configuration.
// Reaproveita o OAuth do RD Station Marketing (App.state.integrations.rd) e
// concentra aqui apenas o que é específico do CRM: pipeline padrão, etapas,
// endpoints, regras de tags e configurações de sync.
window.RdCrmConfig = {
  apiBaseUrl: 'https://api.rd.services',
  crmBasePath: '/crm/v1',
  legacyBaseUrl: 'https://crm.rdstation.com/api/v1',
  defaultPipelineName: 'Journey Revenue Pipeline',
  autoSyncIntervalMs: 5 * 60 * 1000,

  defaultStages() {
    return [
      { code: 'mkt_tof',      label: 'Marketing TOF',  area: 'Marketing', funnel: 'TOF', tag: 'mkttof',       order: 1 },
      { code: 'mkt_mof',      label: 'Marketing MOF',  area: 'Marketing', funnel: 'MOF', tag: 'mktmof',       order: 2 },
      { code: 'mkt_bof',      label: 'Marketing BOF',  area: 'Marketing', funnel: 'BOF', tag: 'mktbof',       order: 3 },
      { code: 'vnd_tof',      label: 'Vendas TOF',     area: 'Vendas',    funnel: 'TOF', tag: 'vndtof',       order: 4 },
      { code: 'vnd_mof',      label: 'Vendas MOF',     area: 'Vendas',    funnel: 'MOF', tag: 'vndmof',       order: 5 },
      { code: 'vnd_bof',      label: 'Vendas BOF',     area: 'Vendas',    funnel: 'BOF', tag: 'vndbof',       order: 6 },
      { code: 'cs_onboarding', label: 'CS Onboarding', area: 'CS',        funnel: 'TOF', tag: 'csonboarding', order: 7 },
      { code: 'cs_retention',  label: 'CS Retenção',   area: 'CS',        funnel: 'MOF', tag: 'csretencao',   order: 8 },
      { code: 'cs_expansion',  label: 'CS Expansão',   area: 'CS',        funnel: 'BOF', tag: 'csexpansao',   order: 9 }
    ];
  },

  defaultConfig() {
    return {
      enabled: false,
      status: 'not_configured',
      // Legacy global pipeline (V21.5 e anteriores) — preservado p/ backwards-compat
      // mas a partir do V21.6 NÃO é mais escrito pelo sync. Pode ser arquivado.
      pipelineId: '',
      pipelineName: '',
      stageMap: {},
      // V21.6 — Pipelines por campanha (1:1). Cada campanha tem seu pipeline RD
      // próprio com 9 stages. Schema:
      // pipelinesByCampaign: { [campaignId]: { pipelineId, pipelineName, stageMap, createdAt, lastSyncAt, lastSyncStatus } }
      pipelinesByCampaign: {},
      autoSync: false,
      autoSyncMode: 'frontend',
      lastSyncAt: '',
      lastSyncStatus: '',
      lastSyncMessage: '',
      syncLogs: []
    };
  },

  // V21.6 — helpers per-campaign
  pipelineNameForCampaign(campaign) {
    return String(campaign?.name || '').trim() || this.defaultPipelineName;
  },

  pipelinesByCampaign() {
    return (window.App?.state?.integrations?.rdCrm?.pipelinesByCampaign) || {};
  },

  pipelineInfoForCampaign(campaignId) {
    if (!campaignId) return null;
    return this.pipelinesByCampaign()[campaignId] || null;
  },

  stageMapForCampaign(campaignId) {
    const info = this.pipelineInfoForCampaign(campaignId);
    if (info?.stageMap) return info.stageMap;
    // Fallback p/ stageMap legacy global (V21.5 e anteriores)
    return (window.App?.state?.integrations?.rdCrm?.stageMap) || {};
  },

  // Dado um rdStageId vindo de evento RD (webhook/sync), descobrir a qual
  // campanha + stageCode ele pertence. Necessário porque o RD manda só stageId.
  findCampaignByStageId(stageId) {
    if (!stageId) return null;
    const byCampaign = this.pipelinesByCampaign();
    for (const [campaignId, info] of Object.entries(byCampaign || {})) {
      const map = info?.stageMap || {};
      for (const [stageCode, stage] of Object.entries(map)) {
        if (stage?.rdStageId === stageId) {
          return { campaignId: Number(campaignId), stageCode, stage, pipelineId: info.pipelineId, pipelineName: info.pipelineName };
        }
      }
    }
    // Fallback legacy stageMap global
    const legacy = (window.App?.state?.integrations?.rdCrm?.stageMap) || {};
    for (const [stageCode, stage] of Object.entries(legacy)) {
      if (stage?.rdStageId === stageId) {
        return { campaignId: null, stageCode, stage, legacy: true };
      }
    }
    return null;
  },

  funnelTagFor(area) {
    const map = { Marketing: 'entrada_funil_marketing', Vendas: 'entrada_funil_vendas', CS: 'entrada_funil_cs' };
    return map[area] || `entrada_funil_${String(area || '').toLowerCase()}`;
  },

  stageByCode(code) {
    return this.defaultStages().find(stage => stage.code === code) || null;
  },

  stageByLabel(label) {
    const normalized = String(label || '').trim().toLowerCase();
    return this.defaultStages().find(stage => stage.label.toLowerCase() === normalized) || null;
  },

  isOAuthReady() {
    const rd = window.App?.state?.integrations?.rd;
    return Boolean(rd && (rd.accessToken || rd.refreshToken));
  },

  oauthCredentials() {
    return window.App?.state?.integrations?.rd || {};
  },

  // V21.4.3 — Token estático do RD CRM legacy (gerado no painel CRM →
  // Integrações). É o que de fato autentica chamadas em crm.rdstation.com/api/v1.
  // O accessToken do OAuth é da família Marketing e não vale aqui.
  crmToken() {
    return (window.App?.state?.integrations?.rd?.crmPersonalToken || '').trim();
  },

  hasCrmToken() {
    return Boolean(this.crmToken());
  }
};
