// V15 — LP Registry
// Registro central de Landing Pages. Cada LP é uma ação Journey do tipo "lp",
// com lp_id (slug interno), tracking_id (token público colado no pixel) e
// metadados. Centraliza criação, validação e geração do script.
window.LpRegistry = {
  TRACKING_ENDPOINT_DEFAULT: '/api/lp-event',
  FETCH_ENDPOINT_DEFAULT: '/api/lp-events-fetch',

  endpoint() {
    return App.state.lpTrackingEndpoint || this.TRACKING_ENDPOINT_DEFAULT;
  },

  fetchEndpoint() {
    return App.state.lpFetchEndpoint || this.FETCH_ENDPOINT_DEFAULT;
  },

  _generateId(prefix) {
    return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  },

  draftFromAction(action = null) {
    if (action) {
      const flow = window.FlowEngine ? FlowEngine.normalize(action.flow, action) : (action.flow || {});
      const lpMeta = action.lp || {};
      return {
        actionId: action.id,
        lpId: lpMeta.lpId || this._generateId('lp'),
        trackingId: lpMeta.trackingId || this._generateId('trk'),
        name: action.name || '',
        url: lpMeta.url || '',
        objective: action.objective || '',
        ctaPrimary: lpMeta.ctaPrimary || '',
        productId: lpMeta.productId || App.state.selectedProductId || '',
        campaignId: action.campaignId || App.state.selectedCampaignId || '',
        previousActionId: lpMeta.previousActionId || '',
        nextActionId: lpMeta.nextActionId || '',
        trackingActive: lpMeta.trackingActive !== false,
        syncRdActive: Boolean(lpMeta.syncRdActive),
        startStage: flow.startStage || 'mkt_mof',
        endStage: flow.endStage || 'vnd_tof',
        checkpoints: Array.isArray(flow.checkpoints) && flow.checkpoints.length ? flow.checkpoints : []
      };
    }
    return {
      actionId: null,
      lpId: this._generateId('lp'),
      trackingId: this._generateId('trk'),
      name: '',
      url: '',
      objective: '',
      ctaPrimary: '',
      productId: App.state.selectedProductId || '',
      campaignId: App.state.selectedCampaignId || '',
      previousActionId: '',
      nextActionId: '',
      trackingActive: true,
      syncRdActive: false,
      startStage: 'mkt_mof',
      endStage: 'vnd_tof',
      checkpoints: []
    };
  },

  buildRegistryEntry(draft) {
    return {
      lpId: draft.lpId,
      trackingId: draft.trackingId,
      actionId: draft.actionId,
      name: draft.name,
      url: draft.url,
      productId: draft.productId,
      campaignId: draft.campaignId,
      startStage: draft.startStage,
      endStage: draft.endStage,
      previousActionId: draft.previousActionId || null,
      nextActionId: draft.nextActionId || null,
      trackingActive: draft.trackingActive,
      syncRdActive: draft.syncRdActive,
      createdAt: new Date().toISOString(),
      lastEventAt: null,
      lastValidationAt: null,
      status: 'pending'
    };
  },

  buildActionFromDraft(draft) {
    const flow = window.FlowEngine ? FlowEngine.normalize({
      enabled: true,
      flowActionType: 'lp',
      startStage: draft.startStage,
      endStage: draft.endStage,
      previousActions: draft.previousActionId ? [Number(draft.previousActionId)] : [],
      nextActions: draft.nextActionId ? [Number(draft.nextActionId)] : [],
      checkpoints: draft.checkpoints || []
    }, {}) : {};
    return {
      id: Date.now() + Math.floor(Math.random() * 100),
      campaignId: Number(draft.campaignId),
      name: draft.name,
      channel: 'LP',
      actionType: 'LP',
      sector: 'Marketing',
      funnel: 'MOF',
      originSector: 'Marketing',
      originFunnel: 'MOF',
      destinationSector: 'Vendas',
      destinationFunnel: 'TOF',
      objective: draft.objective,
      conversionObjective: '',
      expectedConversion: 25,
      mailingDefined: false,
      okrs: [],
      kpis: [],
      leads: [],
      flowConfig: null,
      flowPath: [],
      scoreId: App.state.scores?.[0]?.id || 1,
      connected: false,
      connectionStatus: 'ready',
      status: 'Pronta para conectar',
      linkedCampaignKrId: null,
      flow,
      lp: {
        lpId: draft.lpId,
        trackingId: draft.trackingId,
        url: draft.url,
        ctaPrimary: draft.ctaPrimary,
        productId: draft.productId,
        previousActionId: draft.previousActionId,
        nextActionId: draft.nextActionId,
        trackingActive: draft.trackingActive,
        syncRdActive: draft.syncRdActive
      },
      createdAt: new Date().toISOString()
    };
  },

  applyDraftToAction(action, draft) {
    const flow = window.FlowEngine ? FlowEngine.normalize({
      ...(action.flow || {}),
      enabled: true,
      flowActionType: 'lp',
      startStage: draft.startStage,
      endStage: draft.endStage,
      previousActions: draft.previousActionId ? [Number(draft.previousActionId)] : (action.flow?.previousActions || []),
      nextActions: draft.nextActionId ? [Number(draft.nextActionId)] : (action.flow?.nextActions || []),
      checkpoints: draft.checkpoints || (action.flow?.checkpoints || [])
    }, action) : action.flow;
    return {
      ...action,
      name: draft.name,
      objective: draft.objective,
      campaignId: Number(draft.campaignId),
      flow,
      lp: {
        lpId: draft.lpId,
        trackingId: draft.trackingId,
        url: draft.url,
        ctaPrimary: draft.ctaPrimary,
        productId: draft.productId,
        previousActionId: draft.previousActionId,
        nextActionId: draft.nextActionId,
        trackingActive: draft.trackingActive,
        syncRdActive: draft.syncRdActive
      }
    };
  },

  buildTrackingScript(draft) {
    const trackingId = draft.trackingId || 'TRK_DEMO';
    const endpoint = this.endpoint();
    const fullUrl = window.location?.origin ? `${window.location.origin}${endpoint}` : endpoint;
    return `<!-- Journey Tracker -->\n<script async src="https://cdn.journey.app/journey-tracker.js" data-tracking-id="${trackingId}" data-endpoint="${fullUrl}"></script>\n<!-- /Journey Tracker -->`;
  },

  registryEntry(lpId) {
    return (App.state.lpRegistry || {})[lpId] || null;
  },

  recordEvent(trackingId, eventPayload) {
    const registry = App.state.lpRegistry || {};
    const entry = Object.values(registry).find(e => e.trackingId === trackingId);
    if (!entry) return null;
    entry.lastEventAt = new Date().toISOString();
    entry.status = 'receiving';
    return entry;
  },

  async checkInstallation(draft) {
    if (!window.EventCollector) return { ok: false, message: 'EventCollector indisponível.' };
    await EventCollector.poll();
    const entry = this.registryEntry(draft.lpId);
    if (!entry) return { ok: false, message: 'LP ainda não registrada — salve primeiro.' };
    if (!entry.lastEventAt) return { ok: false, message: 'Pixel ainda não enviou nenhum evento. Cole o script na LP e abra a URL.' };
    const seconds = Math.floor((Date.now() - new Date(entry.lastEventAt).getTime()) / 1000);
    return { ok: true, message: `✓ Último evento recebido há ${seconds}s. Pixel funcionando.` };
  }
};
