var State = {
  initialActionDraft() {
    return {
      campaignId: null,
      name: '',
      channel: 'Instagram Orgânico',
      actionType: 'Post',
      sector: 'Marketing',
      funnel: 'MOF',
      originSector: 'Marketing',
      originFunnel: 'MOF',
      destinationSector: 'Marketing',
      destinationFunnel: 'MOF',
      objective: '',
      conversionObjective: '',
      expectedConversion: 0,
      okrs: OkrSuggestionEngine.defaultFor('Marketing', 'MOF', 'Instagram Orgânico', 'Post'),
      mailingDefined: false,
      leadInputMode: 'manual',
      leadsText: '',
      rdListName: '',
      scoreId: null,
      rdEmailConfig: window.RDConfig ? RDConfig.emailDefaults() : {},
      kpis: []
    };
  },
  initial() {
    return {
      activeTab: 'products',
      showSettingsModal: false,
      settingsActiveSection: 'database',
      databaseConfig: DatabaseService.defaultConfig(),
      databaseTestResult: null,
      databaseTesting: false,
      showDatabaseTutorial: false,
      railwayTesting: false,
      railwayTestResults: null,
      railwayShowPassword: false,
      showRailwaySnapshotPrompt: false,
      integrations: {
        rd: window.RDConfig ? RDConfig.defaultConfig() : {},
        rdCrm: window.RdCrmConfig ? RdCrmConfig.defaultConfig() : {}
      },
      rdCrmLeadTags: {},
      selectedProductId: null,
      selectedCampaignId: null,
      selectedActionId: null,
      selectedScoreId: Config.defaultScore?.id || 1,
      selectedDashboardCampaignId: null,
      selectedOkrId: null,
      selectedLeadId: null,
      activeLeadSubTab: 'profile',
      selectedPipelineStageId: 'marketing-mof',
      selectedPipelineCampaignId: 'all',
      selectedPipelineActionId: 'all',
      pipelineStages: null,
      pipelineVisualVersion: 'revenue-flow-v1',
      showActionFlowModal: false,
      actionFlowModalId: null,
      actionFlowEditMode: false,
      showActionEditModal: false,
      actionEditDraft: null,
      showFlowBuilderModal: false,
      flowBuilderCampaignId: null,
      showLpModal: false,
      lpDraft: null,
      lpEvents: [],
      lpRegistry: {},
      lpLastPolledAt: '',
      showCampaignFlowModal: false,
      campaignFlowModalId: null,
      showProductRevenueOverview: false,
      revenueOverviewProductId: null,
      showProductTotalFlowModal: false,
      productTotalFlowProductId: null,
      showProductCampaignsModal: false,
      productCampaignsModalId: null,
      campaignProductFilterId: null,
      revopsSelectedProductId: null,
      revopsFinance: {},
      customChannels: [],
      customActionTypes: [],
      executionConfig: window.ExecutionProviderRegistry?.defaultConfig?.() || { defaultProvider: 'manual', providers: {} },
      agentConfig: window.AgentRegistry?.defaultConfig?.() || { djow: { name: 'Djow', url: '', endpoint: '/execute', method: 'POST', apiKey: '', timeoutMs: 30000, enabled: false, lastStatus: null, lastLatencyMs: null, lastCheckedAt: null } },
      executionTasks: [],
      djowChats: {},
      showDjowModal: false,
      djowModalActionId: null,
      djowDraftMessage: '',
      djowSending: false,
      djowLastResponse: null,
      showTasksModal: false,
      tasksModalActionId: null,
      showStrategicMap: false,
      strategicMapProductId: null,
      strategicMapZoom: 'strategy',
      strategicMapOnboardingSeen: {},
      strategicMaps: {},
      strategicDjowChats: {},
      strategicDjowDraft: '',
      strategicDjowSending: false,
      strategicObjectiveDraft: null,
      strategicOkrDraft: null,
      showQuickActionModal: false,
      quickActionContext: null,
      quickActionDraft: { name: '', campaignId: null, channel: '', actionType: '' },
      showStrategicOverview: false,
      revenueScoreBlueprints: {},
      revenueReadyTriggered: {},
      leadOutcomes: {},
      leadScoreHistory: {},
      leadEngagementHistory: {},
      negativeSelection: { excludedDomains: [], excludedAccounts: [] },
      abTestVariants: {},
      driftBaselines: {},
      customScoreSignals: { B2B: [], B2C: [], negative: [], triggers: [] },
      showLeadDetailModal: false,
      leadDetailContext: null,
      campaignLeadLinks: {},
      profileCampaignContext: null,
      profileIcpContext: null,
      showPostScoreSearchPrompt: false,
      postScoreSearchCampaignId: null,
      rdEventLog: [],
      rdLastSyncAt: null,
      rdSyncRunning: false,
      showRevenueScoreCreator: false,
      revenueScoreCreatorCtx: null,
      showRevenueScoreDashboard: false,
      revenueScoreDashboardCampaignId: null,
      actionsListFilter: 'all',
      actionCreateTab: 'manual',
      actionAiDraft: { prompt: '', count: 3 },
      flowBuilderStartFilter: 'all',
      flowBuilderZoom: 1.0,
      flowBuilderConnectionArm: null,
      flowDisconnectConfirm: null,
      flowBuilderShowHelp: false,
      showRevopsSimulationModal: false,
      revopsSimulationDraft: null,
      revopsSimulationLoadedScenarioId: null,
      showRevopsScenariosModal: false,
      showRevopsScenarioNameModal: false,
      showRevopsOkrModal: false,
      revopsOkrDraft: null,
      showRevopsFixedCostsModal: false,
      revopsFixedCostsCategory: null,
      showRevopsAcquisitionModal: false,
      profileQuery: '', profileFilters: [], profileActive: false,
      leadBaseInputMode: 'manual',
      showLeadImportModal: false,
      leadManualText: '',
      leadCsvText: '',
      leadDraft: { name: '', phone: '', email: '', idade: '', estado: '', cidade: '', estadoCivil: '', sexo: '', faixaSalarial: '', tags: '' },
      manualLeads: [],
      productDraft: { name: '', type: '', price: '', revenueModel: 'Venda única', operationalCost: '' },
      okrDraft: { objective: '', keyResult: '', target: '', unit: 'R$', owner: '', deadline: '', status: 'Em andamento' },
      kpiDraft: { name: '', metric: 'revenue', scope: 'global', productId: null, target: '', unit: 'R$', frequency: 'Semanal', source: 'Automático pelo Revenue Engine', relatedOkrId: null },
      campaignDraft: { name: '', objective: '', productId: null, owner: '', sector: 'Marketing' },
      actionDraft: this.initialActionDraft(),
      scoreDraft: { name: '', description: '', tagRules: [{ tag: '#nova', score: 0 }] },
      products: [],
      strategicOkrs: [],
      operationalKpis: [],
      cxProjects: [],
      campaigns: [],
      scores: [Utils.clone(Config.defaultScore)],
      actions: [],
      schemaVersion: '12.4.1',
      dataCreatedAt: new Date().toISOString(),
      lastMigrationAt: null
    };
  },
  normalizeKeyResults(raw, scope = 'product') {
    const list = Array.isArray(raw) ? raw : [];
    return list.map((kr, index) => ({
      id: kr.id || `kr_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}`,
      label: String(kr.label || '').trim(),
      metric: typeof kr.metric === 'string' ? kr.metric : (scope === 'product' ? 'ebitda' : 'campaignCAC'),
      target: Number(kr.target || 0),
      parentKrId: kr.parentKrId || null
    }));
  },
  normalizeCampaignOkrs(raw) {
    const list = Array.isArray(raw) ? raw : [];
    if (!list.length) return [];
    if (list[0] && typeof list[0] === 'object' && 'objective' in list[0] && 'keyResults' in list[0]) {
      return list.map((okr, index) => ({
        id: okr.id || `okrc_${Date.now()}_${index}`,
        objective: String(okr.objective || '').trim(),
        keyResults: this.normalizeKeyResults(okr.keyResults, 'campaign'),
        createdAt: okr.createdAt || new Date().toISOString()
      }));
    }
    return [];
  },
  normalizeRevopsFinance(raw) {
    if (!raw || typeof raw !== 'object' || !window.RevopsFinanceEngine) return {};
    const normalized = {};
    for (const [productId, config] of Object.entries(raw)) {
      normalized[productId] = RevopsFinanceEngine.normalize(config, productId);
    }
    return normalized;
  },
  normalizeOkrs(okrs) {
    const source = Array.isArray(okrs) ? okrs : [];
    return source.map((okr, index) => ({
      id: okr.id || `okr_${index}_${Date.now()}`,
      name: okr.name || '',
      target: okr.target || okr.goal || '',
      current: okr.current || '',
      unit: okr.unit || '',
      benchmark: okr.benchmark || '',
      trend: okr.trend || 'stable',
      health: okr.health || 'Atenção',
      stageId: okr.stageId || ''
    }));
  },
  normalizeTagRules(tagRules) {
    const rules = Array.isArray(tagRules) ? tagRules : Config.defaultScore.tagRules;
    return rules.map(rule => ({ tag: rule.tag || '#nova', score: Number(rule.score || 0) }));
  },
  normalizeScore(score, index = 0) {
    return { id: score?.id || Date.now() + index, name: score?.name || 'Score sem nome', description: score?.description || '', tagRules: this.normalizeTagRules(score?.tagRules) };
  },
  normalizeAction(action, index, fallbackScoreId, base) {
    const sector = action.sector || action.originSector || 'Marketing';
    const funnel = action.funnel || action.originFunnel || 'MOF';
    const originSector = action.originSector || sector;
    const originFunnel = action.originFunnel || funnel;
    const destinationSector = action.destinationSector || sector;
    const destinationFunnel = action.destinationFunnel || funnel;
    const okrs = this.normalizeOkrs(action.okrs || []);
    const resolvedFlow = Array.isArray(action.flowPath)
      ? action.flowPath
      : FlowResolutionEngine.resolve(originSector, originFunnel, destinationSector, destinationFunnel);
    const fallbackStageId = resolvedFlow[0];
    const scoreId = action.scoreId || fallbackScoreId;
    const actionName = action.name || 'ação';
    const baseOkrs = okrs.length
      ? okrs
      : OkrSuggestionEngine.defaultFor(sector, funnel, action.channel, action.actionType || 'Post');
    return {
      id: action.id || Date.now() + index,
      campaignId: action.campaignId || base.selectedCampaignId,
      name: action.name || 'Ação sem nome',
      channel: action.channel || 'RD Station',
      actionType: action.actionType || action.type || 'Post',
      sector, funnel,
      originSector, originFunnel, destinationSector, destinationFunnel,
      conversionObjective: action.conversionObjective || action.objective || '',
      objective: action.objective || '',
      expectedConversion: Number(action.expectedConversion || 25),
      mailingDefined: Boolean(action.mailingDefined),
      flowConfig: Array.isArray(action.flowConfig) ? action.flowConfig : null,
      okrs: baseOkrs.map(okr => ({ ...okr, stageId: okr.stageId || fallbackStageId })),
      kpis: Array.isArray(action.kpis) ? action.kpis.map(kpi => ({ ...kpi, type: 'kpi' })) : (window.RDMapper?.isRDEmailAction?.(action) ? RDConfig.emailKpiDefaults() : []),
      rdEmailConfig: window.RDConfig ? { ...RDConfig.emailDefaults(), ...(action.rdEmailConfig || {}) } : (action.rdEmailConfig || {}),
      flowPath: resolvedFlow,
      scoreId,
      connected: Boolean(action.connected),
      connectionStatus: action.connectionStatus || 'ready',
      status: action.status || 'Pronta para conectar',
      linkedCampaignKrId: action.linkedCampaignKrId || null,
      leads: Array.isArray(action.leads) ? action.leads.map((lead, leadIndex) => {
        const normalized = LeadParser.normalizeLead(lead, leadIndex, scoreId);
        const { score, ...plain } = normalized;
        const identityNormalized = LeadIdentityEngine.normalizeLead(plain, actionName);
        // V19 — lead scoring maturity additions (todos opcionais, defaults seguros)
        const emailDomain = String(identityNormalized.email || '').split('@')[1] || '';
        const createdAt = identityNormalized.createdAt || lead.createdAt || new Date().toISOString();
        return {
          ...identityNormalized,
          companyDomain: identityNormalized.companyDomain || emailDomain || null,
          outcome: identityNormalized.outcome || lead.outcome || null,
          lifecycleStage: identityNormalized.lifecycleStage || lead.lifecycleStage || 'subscriber',
          lifecycleStageAt: identityNormalized.lifecycleStageAt || lead.lifecycleStageAt || createdAt,
          cohortMonth: identityNormalized.cohortMonth || lead.cohortMonth || createdAt.slice(0, 7),
          buyingRole: identityNormalized.buyingRole || lead.buyingRole || null,
          meddic: identityNormalized.meddic || lead.meddic || null,
          // V20 — Persona expandida + trigger events + awareness level
          industry: identityNormalized.industry || lead.industry || null,
          companyRevenue: identityNormalized.companyRevenue || lead.companyRevenue || null,
          income: identityNormalized.income || lead.income || null,
          jobTitle: identityNormalized.jobTitle || lead.jobTitle || null,
          geography: identityNormalized.geography || lead.geography || null,
          awarenessLevel: identityNormalized.awarenessLevel || lead.awarenessLevel || null,
          triggerEvents: Array.isArray(lead.triggerEvents) ? lead.triggerEvents : (Array.isArray(identityNormalized.triggerEvents) ? identityNormalized.triggerEvents : []),
          // V21.4 BUGFIX — campos do RD Live Bridge que ANTES eram silenciosamente
          // descartados pelo LeadParser. Recuperando do raw lead aqui:
          tagCounters: lead.tagCounters && typeof lead.tagCounters === 'object' ? lead.tagCounters : {},
          eventHistory: Array.isArray(lead.eventHistory) ? lead.eventHistory : [],
          engagementHistory: Array.isArray(lead.engagementHistory) ? lead.engagementHistory : [],
          scoreHistory: Array.isArray(lead.scoreHistory) ? lead.scoreHistory : [],
          rdContactId: lead.rdContactId || null,
          rdContext: lead.rdContext && typeof lead.rdContext === 'object' ? lead.rdContext : null,
          outcomeAt: lead.outcomeAt || null,
          lastSyncedAt: lead.lastSyncedAt || null,
          source: lead.source || 'manual',
          createdAt
        };
      }) : [],
      createdAt: action.createdAt || new Date().toISOString()
    };
  },
  normalize(raw) {
    const base = this.initial();
    if (!raw || typeof raw !== 'object') return base;
    const now = Date.now();
    const nowIso = new Date().toISOString();
    const scores = Array.isArray(raw.scores) && raw.scores.length ? raw.scores.map((score, index) => this.normalizeScore(score, index)) : [this.normalizeScore(Config.defaultScore)];
    const fallbackScoreId = scores[0].id;
    const products = Array.isArray(raw.products) && raw.products.length ? raw.products.map((product, index) => ProductRevenueEngine.normalize(product, index)) : base.products;
    const selectedProductId = raw.selectedProductId || products[0]?.id || base.selectedProductId;
    const campaigns = Array.isArray(raw.campaigns) ? raw.campaigns.map((campaign, index) => ({
      id: campaign.id || now + index,
      productId: campaign.productId || selectedProductId,
      name: campaign.name || 'Campanha sem nome',
      objective: campaign.objective || '',
      owner: campaign.owner || '',
      sector: campaign.sector || 'Marketing',
      status: campaign.status || 'Ativa',
      mediaInvestment: Number(campaign.mediaInvestment || 0),
      okrs: this.normalizeCampaignOkrs(campaign.okrs),
      createdAt: campaign.createdAt || nowIso
    })) : base.campaigns;
    return {
      ...base,
      activeTab: raw.activeTab || base.activeTab,
      showSettingsModal: Boolean(raw.showSettingsModal),
      settingsActiveSection: raw.settingsActiveSection || base.settingsActiveSection,
      databaseConfig: DatabaseService.normalize(raw.databaseConfig || base.databaseConfig),
      databaseTestResult: raw.databaseTestResult || null,
      databaseTesting: false,
      showDatabaseTutorial: false,
      // V21.4 BUGFIX — campos persistidos que somem se não forem preservados aqui:
      // V21.6 ADD — pipelinesByCampaign preservado explicitamente (objeto aninhado).
      // V22.0 ADD — dealsByLead preservado (mapa de leadKey→campaign→dealId).
      integrations: raw.integrations && typeof raw.integrations === 'object'
        ? {
            rd: { ...(base.integrations?.rd || {}), ...(raw.integrations.rd || {}) },
            rdCrm: {
              ...(base.integrations?.rdCrm || {}),
              ...(raw.integrations.rdCrm || {}),
              pipelinesByCampaign: (raw.integrations.rdCrm?.pipelinesByCampaign && typeof raw.integrations.rdCrm.pipelinesByCampaign === 'object')
                ? raw.integrations.rdCrm.pipelinesByCampaign
                : (base.integrations?.rdCrm?.pipelinesByCampaign || {}),
              dealsByLead: (raw.integrations.rdCrm?.dealsByLead && typeof raw.integrations.rdCrm.dealsByLead === 'object')
                ? raw.integrations.rdCrm.dealsByLead
                : (base.integrations?.rdCrm?.dealsByLead || {})
            }
          }
        : (base.integrations || {}),
      rdCrmLeadTags: raw.rdCrmLeadTags && typeof raw.rdCrmLeadTags === 'object' ? raw.rdCrmLeadTags : {},
      railwayTesting: false,
      railwayTestResults: null,
      railwayShowPassword: false,
      showRailwaySnapshotPrompt: false,
      selectedProductId,
      selectedCampaignId: raw.selectedCampaignId || base.selectedCampaignId,
      selectedActionId: raw.selectedActionId || null,
      selectedScoreId: raw.selectedScoreId || fallbackScoreId,
      selectedDashboardCampaignId: raw.selectedDashboardCampaignId || null,
      selectedOkrId: raw.selectedOkrId || null,
      selectedLeadId: raw.selectedLeadId || null,
      activeLeadSubTab: raw.activeLeadSubTab || base.activeLeadSubTab,
      selectedPipelineStageId: raw.selectedPipelineStageId || base.selectedPipelineStageId,
      selectedPipelineCampaignId: raw.selectedPipelineCampaignId || base.selectedPipelineCampaignId,
      selectedPipelineActionId: raw.selectedPipelineActionId || base.selectedPipelineActionId,
      pipelineStages: Array.isArray(raw.pipelineStages) ? raw.pipelineStages : null,
      pipelineVisualVersion: raw.pipelineVisualVersion || null,
      showActionFlowModal: Boolean(raw.showActionFlowModal),
      actionFlowModalId: raw.actionFlowModalId || null,
      actionFlowEditMode: Boolean(raw.actionFlowEditMode),
      showActionEditModal: false,
      actionEditDraft: null,
      showFlowBuilderModal: false,
      flowBuilderCampaignId: null,
      showLpModal: false,
      lpDraft: null,
      lpEvents: Array.isArray(raw.lpEvents) ? raw.lpEvents : [],
      lpRegistry: raw.lpRegistry && typeof raw.lpRegistry === 'object' ? raw.lpRegistry : {},
      lpLastPolledAt: raw.lpLastPolledAt || '',
      showCampaignFlowModal: Boolean(raw.showCampaignFlowModal),
      campaignFlowModalId: raw.campaignFlowModalId || null,
      showProductRevenueOverview: Boolean(raw.showProductRevenueOverview),
      revenueOverviewProductId: raw.revenueOverviewProductId || null,
      showProductTotalFlowModal: Boolean(raw.showProductTotalFlowModal),
      productTotalFlowProductId: raw.productTotalFlowProductId || null,
      showProductCampaignsModal: Boolean(raw.showProductCampaignsModal),
      productCampaignsModalId: raw.productCampaignsModalId || null,
      campaignProductFilterId: raw.campaignProductFilterId || null,
      revopsSelectedProductId: raw.revopsSelectedProductId || null,
      revopsFinance: this.normalizeRevopsFinance(raw.revopsFinance),
      customChannels: Array.isArray(raw.customChannels) ? raw.customChannels : [],
      customActionTypes: Array.isArray(raw.customActionTypes) ? raw.customActionTypes : [],
      executionConfig: window.ExecutionProviderRegistry?.normalize?.(raw.executionConfig) || raw.executionConfig || base.executionConfig,
      agentConfig: window.AgentRegistry?.normalize?.(raw.agentConfig) || raw.agentConfig || base.agentConfig,
      executionTasks: Array.isArray(raw.executionTasks) ? raw.executionTasks : [],
      djowChats: raw.djowChats && typeof raw.djowChats === 'object' ? raw.djowChats : {},
      showDjowModal: false,
      djowModalActionId: null,
      djowDraftMessage: '',
      djowSending: false,
      djowLastResponse: null,
      showTasksModal: false,
      tasksModalActionId: null,
      showStrategicMap: false,
      strategicMapProductId: null,
      strategicMapZoom: raw.strategicMapZoom || 'strategy',
      strategicMapOnboardingSeen: raw.strategicMapOnboardingSeen && typeof raw.strategicMapOnboardingSeen === 'object' ? raw.strategicMapOnboardingSeen : {},
      strategicMaps: raw.strategicMaps && typeof raw.strategicMaps === 'object' ? raw.strategicMaps : {},
      strategicDjowChats: raw.strategicDjowChats && typeof raw.strategicDjowChats === 'object' ? raw.strategicDjowChats : {},
      strategicDjowDraft: '',
      strategicDjowSending: false,
      strategicObjectiveDraft: null,
      strategicOkrDraft: null,
      showQuickActionModal: false,
      quickActionContext: null,
      quickActionDraft: { name: '', campaignId: null, channel: '', actionType: '' },
      showStrategicOverview: false,
      revenueScoreBlueprints: raw.revenueScoreBlueprints && typeof raw.revenueScoreBlueprints === 'object' ? raw.revenueScoreBlueprints : {},
      revenueReadyTriggered: raw.revenueReadyTriggered && typeof raw.revenueReadyTriggered === 'object' ? raw.revenueReadyTriggered : {},
      leadOutcomes: raw.leadOutcomes && typeof raw.leadOutcomes === 'object' ? raw.leadOutcomes : {},
      leadScoreHistory: raw.leadScoreHistory && typeof raw.leadScoreHistory === 'object' ? raw.leadScoreHistory : {},
      leadEngagementHistory: raw.leadEngagementHistory && typeof raw.leadEngagementHistory === 'object' ? raw.leadEngagementHistory : {},
      negativeSelection: raw.negativeSelection && typeof raw.negativeSelection === 'object'
        ? { excludedDomains: Array.isArray(raw.negativeSelection.excludedDomains) ? raw.negativeSelection.excludedDomains : [], excludedAccounts: Array.isArray(raw.negativeSelection.excludedAccounts) ? raw.negativeSelection.excludedAccounts : [] }
        : { excludedDomains: [], excludedAccounts: [] },
      abTestVariants: raw.abTestVariants && typeof raw.abTestVariants === 'object' ? raw.abTestVariants : {},
      driftBaselines: raw.driftBaselines && typeof raw.driftBaselines === 'object' ? raw.driftBaselines : {},
      customScoreSignals: raw.customScoreSignals && typeof raw.customScoreSignals === 'object'
        ? {
            B2B: Array.isArray(raw.customScoreSignals.B2B) ? raw.customScoreSignals.B2B : [],
            B2C: Array.isArray(raw.customScoreSignals.B2C) ? raw.customScoreSignals.B2C : [],
            negative: Array.isArray(raw.customScoreSignals.negative) ? raw.customScoreSignals.negative : [],
            triggers: Array.isArray(raw.customScoreSignals.triggers) ? raw.customScoreSignals.triggers : []
          }
        : { B2B: [], B2C: [], negative: [], triggers: [] },
      showLeadDetailModal: false,
      leadDetailContext: null,
      campaignLeadLinks: raw.campaignLeadLinks && typeof raw.campaignLeadLinks === 'object' ? raw.campaignLeadLinks : {},
      profileCampaignContext: null,
      profileIcpContext: null,
      showPostScoreSearchPrompt: false,
      postScoreSearchCampaignId: null,
      rdEventLog: Array.isArray(raw.rdEventLog) ? raw.rdEventLog.slice(-200) : [],
      rdLastSyncAt: raw.rdLastSyncAt || null,
      rdSyncRunning: false,
      showRevenueScoreCreator: false,
      revenueScoreCreatorCtx: null,
      showRevenueScoreDashboard: false,
      revenueScoreDashboardCampaignId: null,
      actionsListFilter: 'all',
      actionCreateTab: raw.actionCreateTab === 'ai' ? 'ai' : 'manual',
      actionAiDraft: { prompt: raw.actionAiDraft?.prompt || '', count: Number(raw.actionAiDraft?.count || 3) },
      flowBuilderStartFilter: 'all',
      flowBuilderZoom: 1.0,
      flowBuilderConnectionArm: null,
      flowDisconnectConfirm: null,
      flowBuilderShowHelp: false,
      showRevopsSimulationModal: false,
      revopsSimulationDraft: null,
      revopsSimulationLoadedScenarioId: null,
      showRevopsScenariosModal: false,
      showRevopsScenarioNameModal: false,
      showRevopsOkrModal: false,
      revopsOkrDraft: null,
      showRevopsFixedCostsModal: false,
      revopsFixedCostsCategory: null,
      showRevopsAcquisitionModal: false,
      profileQuery: raw.profileQuery || '', profileFilters: Array.isArray(raw.profileFilters) ? raw.profileFilters : [], profileActive: Boolean(raw.profileActive),
      leadBaseInputMode: raw.leadBaseInputMode || 'manual',
      showLeadImportModal: Boolean(raw.showLeadImportModal),
      leadManualText: raw.leadManualText || '',
      leadCsvText: raw.leadCsvText || '',
      leadDraft: { ...base.leadDraft, ...(raw.leadDraft || {}) },
      manualLeads: Array.isArray(raw.manualLeads) ? LeadIdentityEngine.mergeMany([], raw.manualLeads.map((lead, index) => {
        const normalized = LeadParser.normalizeLead(lead, index, fallbackScoreId);
        const { score, ...plain } = normalized;
        // V21.4 BUGFIX — preserva campos do RD Live Bridge que o LeadParser descartava
        return {
          ...plain,
          score,
          tagCounters: lead.tagCounters && typeof lead.tagCounters === 'object' ? lead.tagCounters : {},
          eventHistory: Array.isArray(lead.eventHistory) ? lead.eventHistory : [],
          engagementHistory: Array.isArray(lead.engagementHistory) ? lead.engagementHistory : [],
          scoreHistory: Array.isArray(lead.scoreHistory) ? lead.scoreHistory : [],
          rdContactId: lead.rdContactId || null,
          rdContext: lead.rdContext && typeof lead.rdContext === 'object' ? lead.rdContext : null,
          outcome: lead.outcome || null,
          outcomeAt: lead.outcomeAt || null,
          lifecycleStage: lead.lifecycleStage || 'subscriber',
          lifecycleStageAt: lead.lifecycleStageAt || null,
          buyingRole: lead.buyingRole || null,
          meddic: lead.meddic || null,
          industry: lead.industry || null,
          companyRevenue: lead.companyRevenue || null,
          income: lead.income || null,
          jobTitle: lead.jobTitle || null,
          geography: lead.geography || null,
          awarenessLevel: lead.awarenessLevel || null,
          triggerEvents: Array.isArray(lead.triggerEvents) ? lead.triggerEvents : [],
          companyDomain: lead.companyDomain || null,
          cohortMonth: lead.cohortMonth || null,
          lastSyncedAt: lead.lastSyncedAt || null,
          source: lead.source || 'base global',
          createdAt: lead.createdAt || new Date().toISOString()
        };
      }), 'base global') : [],
      productDraft: { ...base.productDraft, ...(raw.productDraft || {}) },
      okrDraft: { ...base.okrDraft, ...(raw.okrDraft || {}) },
      kpiDraft: { ...base.kpiDraft, ...(raw.kpiDraft || {}), productId: raw.kpiDraft?.productId || selectedProductId || null, relatedOkrId: raw.kpiDraft?.relatedOkrId || raw.selectedOkrId || null },
      campaignDraft: { ...base.campaignDraft, ...(raw.campaignDraft || {}), productId: raw.campaignDraft?.productId || selectedProductId },
      actionDraft: { ...base.actionDraft, ...(raw.actionDraft || {}), scoreId: raw.actionDraft?.scoreId || fallbackScoreId, okrs: this.normalizeOkrs(raw.actionDraft?.okrs || base.actionDraft.okrs) },
      scoreDraft: { ...base.scoreDraft, ...(raw.scoreDraft || {}), tagRules: this.normalizeTagRules(raw.scoreDraft?.tagRules || base.scoreDraft.tagRules) },
      products,
      strategicOkrs: Array.isArray(raw.strategicOkrs) ? raw.strategicOkrs.map((okr, index) => ({ id: okr.id || `okr_strategic_${now}_${index}`, objective: okr.objective || okr.name || '', name: okr.name || okr.objective || '', keyResult: okr.keyResult || '', target: okr.target || '', current: okr.current || '', unit: okr.unit || 'R$', owner: okr.owner || '', deadline: okr.deadline || '', status: okr.status || 'Em andamento', productId: okr.productId || null, keyResults: this.normalizeKeyResults(okr.keyResults, 'product'), createdAt: okr.createdAt || nowIso })) : base.strategicOkrs,
      operationalKpis: Array.isArray(raw.operationalKpis) ? raw.operationalKpis.map((kpi, index) => ({ id: kpi.id || `kpi_operational_${now}_${index}`, name: kpi.name || 'KPI de receita', metric: kpi.metric || 'revenue', scope: kpi.scope || 'global', productId: kpi.productId || null, target: kpi.target || '', unit: kpi.unit || 'R$', frequency: kpi.frequency || 'Semanal', source: kpi.source || 'Automático pelo Revenue Engine', relatedOkrId: kpi.relatedOkrId || null, manualCurrent: kpi.manualCurrent || '', createdAt: kpi.createdAt || nowIso })) : base.operationalKpis,
      cxProjects: Array.isArray(raw.cxProjects) ? raw.cxProjects : [],
      scores,
      campaigns,
      actions: Array.isArray(raw.actions) ? raw.actions.map((action, index) => this.normalizeAction(action, index, fallbackScoreId, base)) : base.actions,
      schemaVersion: raw.schemaVersion || base.schemaVersion,
      dataCreatedAt: raw.dataCreatedAt || base.dataCreatedAt,
      lastMigrationAt: raw.lastMigrationAt || base.lastMigrationAt,
      // V23.1.1 — Campos novos do V23 que estavam sumindo no normalize
      // (auditor detectou em produção).
      lastSavedAt: raw.lastSavedAt || base.lastSavedAt || null,
      // V24.0.0 — Adicionado 'crmOauth' (3ª aba para OAuth do app CRM,
      // necessário pra /crm/v2/webhooks e features modernas).
      settingsRdActiveTab: ['crm','crmOauth','marketing'].includes(raw.settingsRdActiveTab)
        ? raw.settingsRdActiveTab
        : (base.settingsRdActiveTab || 'crm'),
      rdAssistantDismissed: Boolean(raw.rdAssistantDismissed),
      rdMarketingSkipped: Boolean(raw.rdMarketingSkipped)
    };
  },
  load() {
    let raw = null;
    let usedBackup = false;
    try {
      raw = StorageAdapter.loadRaw();
    } catch (error) {
      console.warn('Falha ao ler localStorage principal:', error);
    }
    // V22.1.1 — Safety net contra reset silencioso:
    // se o raw veio vazio/sem dados E existe backup com dados, RESTAURA do backup.
    // Isso previne perda quando algo na cadeia de load/save zera o key principal.
    if (!raw || !StorageAdapter._hasRealData?.(JSON.stringify(raw))) {
      const backup = StorageAdapter.findBackupWithData?.();
      if (backup?.data) {
        console.warn(`[State.load] Main key vazio/sem dados — restaurado do backup slot ${backup.slot}.`);
        raw = backup.data;
        usedBackup = true;
      }
    }
    try {
      const normalized = raw ? this.normalize(raw) : this.initial();
      if (raw) this._auditLostFields(raw, normalized);
      const migrated = DatabaseService.applyMigrations(normalized);
      // Se restaurou do backup, salva imediato no main key pra reestabelecer.
      if (usedBackup) {
        try { StorageAdapter.saveRaw(migrated); } catch (_) {}
      }
      return migrated;
    } catch (error) {
      console.warn('Falha ao normalizar estado:', error);
      // Última tentativa: tenta restaurar de backup mesmo após erro de normalize
      const backup = !usedBackup && StorageAdapter.findBackupWithData?.();
      if (backup?.data) {
        console.warn(`[State.load] Normalize falhou — tentando backup slot ${backup.slot} como fallback.`);
        try {
          const normalized = this.normalize(backup.data);
          return DatabaseService.applyMigrations(normalized);
        } catch (_) { /* desiste */ }
      }
      return this.initial();
    }
  },

  _auditLostFields(raw, normalized) {
    try {
      const transient = new Set([
        'showSettingsModal','databaseTesting','showDatabaseTutorial',
        'railwayTesting','railwayShowPassword','showRailwaySnapshotPrompt',
        'showActionEditModal','actionEditDraft','showFlowBuilderModal','flowBuilderCampaignId',
        'showLpModal','lpDraft','showDjowModal','djowModalActionId','djowDraftMessage','djowSending','djowLastResponse',
        'showTasksModal','tasksModalActionId','showStrategicMap','strategicMapProductId',
        'strategicDjowDraft','strategicDjowSending','strategicObjectiveDraft','strategicOkrDraft',
        'showQuickActionModal','quickActionContext','quickActionDraft','showStrategicOverview',
        'showLeadDetailModal','leadDetailContext','profileCampaignContext','profileIcpContext',
        'showPostScoreSearchPrompt','postScoreSearchCampaignId','rdSyncRunning',
        'showRevenueScoreCreator','revenueScoreCreatorCtx','showRevenueScoreDashboard','revenueScoreDashboardCampaignId',
        'actionsListFilter','flowBuilderStartFilter','flowBuilderZoom','flowBuilderConnectionArm','flowDisconnectConfirm','flowBuilderShowHelp',
        'showRevopsSimulationModal','revopsSimulationDraft','revopsSimulationLoadedScenarioId',
        'showRevopsScenariosModal','showRevopsScenarioNameModal','showRevopsOkrModal','revopsOkrDraft',
        'showRevopsFixedCostsModal','revopsFixedCostsCategory','showRevopsAcquisitionModal'
      ]);
      const lost = [];
      for (const key of Object.keys(raw)) {
        if (transient.has(key)) continue;
        if (raw[key] == null) continue;
        if (key in normalized) continue;
        lost.push(key);
      }
      if (lost.length) {
        console.warn('[State.load] Campos persistidos NÃO mapeados em normalize() — risco de perda de dados:', lost);
      }
    } catch (_) { /* defensive */ }
  },
  save() { StorageAdapter.saveRaw(App.state); }
};
window.State = State;
