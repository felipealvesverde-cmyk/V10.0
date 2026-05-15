// V15.1 — Flow Engine
// Núcleo do Revenue Flow Operating System. Cada ação ganha um objeto `flow`
// com porta de entrada, porta de saída, próximas ações e posição visual.
// O engine não tem efeito colateral — apenas normaliza, valida e calcula.
window.FlowEngine = {
  ACTION_TYPES: [
    { id: 'channel',  label: 'Canal de aquisição', icon: 'radio',          family: 'aquisition' },
    { id: 'lp',       label: 'LP',                  icon: 'layout',         family: 'page' },
    { id: 'email',    label: 'Email',               icon: 'mail',           family: 'message' },
    { id: 'webinar',  label: 'Webinar',             icon: 'video',          family: 'event' },
    { id: 'sdr',      label: 'SDR',                 icon: 'phone-call',     family: 'human' },
    { id: 'whatsapp', label: 'WhatsApp',            icon: 'message-circle', family: 'message' },
    { id: 'checkout', label: 'Checkout',            icon: 'shopping-cart',  family: 'commerce' },
    { id: 'crm',      label: 'CRM',                 icon: 'workflow',       family: 'commerce' },
    { id: 'cs',       label: 'CS',                  icon: 'heart-handshake', family: 'retention' }
  ],

  STAGE_PRESETS: [
    { id: 'mkt_tof', label: 'Marketing TOF', area: 'Marketing', funnel: 'TOF', color: '#8b5cf6' },
    { id: 'mkt_mof', label: 'Marketing MOF', area: 'Marketing', funnel: 'MOF', color: '#a78bfa' },
    { id: 'mkt_bof', label: 'Marketing BOF', area: 'Marketing', funnel: 'BOF', color: '#c4b5fd' },
    { id: 'vnd_tof', label: 'Vendas TOF',    area: 'Vendas',    funnel: 'TOF', color: '#0ea5e9' },
    { id: 'vnd_mof', label: 'Vendas MOF',    area: 'Vendas',    funnel: 'MOF', color: '#38bdf8' },
    { id: 'vnd_bof', label: 'Vendas BOF',    area: 'Vendas',    funnel: 'BOF', color: '#7dd3fc' },
    { id: 'cs_onboarding', label: 'CS Onboarding', area: 'CS',  funnel: 'TOF', color: '#10b981' },
    { id: 'cs_retention',  label: 'CS Retenção',   area: 'CS',  funnel: 'MOF', color: '#34d399' },
    { id: 'cs_expansion',  label: 'CS Expansão',   area: 'CS',  funnel: 'BOF', color: '#6ee7b7' }
  ],

  defaultFlow(action = {}) {
    return {
      enabled: false,
      flowActionType: action.flowActionType || 'channel',
      startStage: action.flow?.startStage || action.originSector ? this._stageIdFromLegacy(action.originSector, action.originFunnel) : 'mkt_tof',
      endStage: action.flow?.endStage || action.destinationSector ? this._stageIdFromLegacy(action.destinationSector, action.destinationFunnel) : 'mkt_tof',
      nextActions: [],
      previousActions: [],
      position: { x: 120, y: 120 },
      checkpoints: [],
      objective: action.objective || ''
    };
  },

  _stageIdFromLegacy(sector, funnel) {
    const sectorMap = { Marketing: 'mkt', Vendas: 'vnd', CS: 'cs' };
    const funnelMap = { TOF: 'tof', MOF: 'mof', BOF: 'bof' };
    const s = sectorMap[String(sector || 'Marketing')] || 'mkt';
    const f = funnelMap[String(funnel || 'TOF')] || 'tof';
    if (s === 'cs') {
      if (f === 'tof') return 'cs_onboarding';
      if (f === 'mof') return 'cs_retention';
      return 'cs_expansion';
    }
    return `${s}_${f}`;
  },

  stageById(stageId) {
    return this.STAGE_PRESETS.find(s => s.id === stageId) || this.STAGE_PRESETS[0];
  },

  actionTypeById(typeId) {
    return this.ACTION_TYPES.find(t => t.id === typeId) || this.ACTION_TYPES[0];
  },

  normalize(rawFlow = {}, action = {}) {
    const base = this.defaultFlow(action);
    if (!rawFlow || typeof rawFlow !== 'object') return base;
    const validStages = new Set(this.STAGE_PRESETS.map(s => s.id));
    return {
      enabled: Boolean(rawFlow.enabled),
      flowActionType: this.ACTION_TYPES.some(t => t.id === rawFlow.flowActionType) ? rawFlow.flowActionType : base.flowActionType,
      startStage: validStages.has(rawFlow.startStage) ? rawFlow.startStage : base.startStage,
      endStage: validStages.has(rawFlow.endStage) ? rawFlow.endStage : base.endStage,
      nextActions: Array.isArray(rawFlow.nextActions) ? rawFlow.nextActions.map(id => Number(id)).filter(Boolean) : [],
      previousActions: Array.isArray(rawFlow.previousActions) ? rawFlow.previousActions.map(id => Number(id)).filter(Boolean) : [],
      position: {
        x: Number(rawFlow.position?.x ?? 120),
        y: Number(rawFlow.position?.y ?? 120)
      },
      checkpoints: Array.isArray(rawFlow.checkpoints) ? rawFlow.checkpoints.map(c => this._normalizeCheckpoint(c)) : [],
      objective: String(rawFlow.objective || action.objective || '')
    };
  },

  _normalizeCheckpoint(c = {}) {
    return {
      id: c.id || `cp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      event: c.event || 'pageview',
      ruleValue: c.ruleValue || '',
      moveToStage: c.moveToStage || '',
      tagOnTrigger: c.tagOnTrigger || '',
      scoreDelta: Number(c.scoreDelta || 0)
    };
  },

  ensureActionFlow(action) {
    return { ...action, flow: this.normalize(action.flow, action) };
  },

  flowsForCampaign(campaignId) {
    const actions = (App.state.actions || []).filter(a => Number(a.campaignId) === Number(campaignId) && a.flow?.enabled);
    return this._buildGraph(actions);
  },

  _buildGraph(actions) {
    const byId = new Map(actions.map(a => [Number(a.id), this.ensureActionFlow(a)]));
    const roots = [];
    for (const action of byId.values()) {
      if (!Array.isArray(action.flow.previousActions) || action.flow.previousActions.length === 0) {
        roots.push(action);
      }
    }
    return { byId, roots };
  },

  traverseFromRoot(rootAction, visited = new Set()) {
    const path = [];
    const queue = [rootAction];
    while (queue.length) {
      const current = queue.shift();
      if (!current || visited.has(current.id)) continue;
      visited.add(current.id);
      path.push(current);
      const nextIds = current.flow?.nextActions || [];
      for (const id of nextIds) {
        const next = (App.state.actions || []).find(a => Number(a.id) === Number(id));
        if (next && !visited.has(next.id)) queue.push(this.ensureActionFlow(next));
      }
    }
    return path;
  },

  canConnect(fromAction, toAction) {
    if (!fromAction || !toAction) return { ok: false, message: 'Ações inválidas.' };
    if (Number(fromAction.id) === Number(toAction.id)) return { ok: false, message: 'Ação não pode se conectar a si mesma.' };
    if (Number(fromAction.campaignId) !== Number(toAction.campaignId)) return { ok: false, message: 'Ações de campanhas diferentes não podem se conectar.' };
    const visited = new Set();
    const queue = [toAction.id];
    while (queue.length) {
      const id = queue.shift();
      if (Number(id) === Number(fromAction.id)) return { ok: false, message: 'Conexão cria um ciclo.' };
      if (visited.has(Number(id))) continue;
      visited.add(Number(id));
      const node = (App.state.actions || []).find(a => Number(a.id) === Number(id));
      const nexts = node?.flow?.nextActions || [];
      for (const next of nexts) queue.push(next);
    }
    return { ok: true };
  }
};
