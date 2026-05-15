var FlowResolutionEngine = {
  order: ['marketing-tof','marketing-mof','marketing-bof','vendas-tof','vendas-mof','vendas-bof','cs-tof','cs-mof','cs-bof'],
  labelMap: { marketing: 'Marketing', vendas: 'Vendas', cs: 'CS', tof: 'TOF', mof: 'MOF', bof: 'BOF' },
  stageId(sector, funnel) {
    const s = String(sector || 'Marketing').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
    const f = String(funnel || 'TOF').toLowerCase();
    return `${s}-${f}`;
  },
  resolve(originSector, originFunnel, destinationSector, destinationFunnel) {
    const start = this.stageId(originSector, originFunnel);
    const end = this.stageId(destinationSector || originSector, destinationFunnel || originFunnel);
    const a = this.order.indexOf(start), b = this.order.indexOf(end);
    if (a < 0 || b < 0) return [start];
    if (a <= b) return this.order.slice(a, b + 1);
    return this.order.slice(b, a + 1).reverse();
  },
  label(stageId) {
    const [sector, funnel] = String(stageId || '').split('-');
    return `${this.labelMap[sector] || sector} ${this.labelMap[funnel] || funnel}`;
  },
  sector(stageId) { return this.labelMap[String(stageId || '').split('-')[0]] || ''; },
  funnel(stageId) { return (String(stageId || '').split('-')[1] || '').toUpperCase(); },
  color(stageId) {
    const sector = String(stageId || '').split('-')[0];
    if (sector === 'marketing') return 'violet';
    if (sector === 'vendas') return 'sky';
    if (sector === 'cs') return 'emerald';
    return 'slate';
  },
  buildDefaultFlowConfig(path = [], firstChannel = '') {
    return path.map((stageId, index) => ({
      stageId,
      enabled: true,
      channelName: index === 0 ? (firstChannel || '') : '',
      manualConverted: null
    }));
  },
  normalizeFlowConfig(action) {
    const path = action.flowPath || this.resolve(action.originSector || action.sector, action.originFunnel || action.funnel, action.destinationSector || action.sector, action.destinationFunnel || action.funnel);
    const saved = Array.isArray(action.flowConfig) ? action.flowConfig : [];
    const byStage = Object.fromEntries(saved.map(item => [item.stageId, item]));
    return path.map((stageId, index) => {
      const item = byStage[stageId];
      const manual = item?.manualConverted;
      const manualEmpty = manual === null || manual === undefined || manual === '';
      return {
        stageId,
        enabled: item?.enabled !== false,
        channelName: item?.channelName || (index === 0 ? (action.channel || '') : ''),
        manualConverted: manualEmpty ? null : Number(manual)
      };
    });
  },
  buildActionFlow(action) {
    const config = this.normalizeFlowConfig(action);
    const stageIndex = new Map(config.map((item, idx) => [item.stageId, idx]));
    const enabled = config.filter(item => item.enabled !== false);
    const path = enabled.map(item => item.stageId);
    const leads = action.leads?.length || 0;
    const baseRate = Math.max(0.18, Math.min(0.78, (Number(action.expectedConversion || 25) || 25) / 100));
    const firstManual = enabled[0]?.manualConverted !== null && enabled[0]?.manualConverted !== undefined ? Number(enabled[0].manualConverted || 0) : null;
    let current = firstManual !== null ? Math.max(0, firstManual) : leads;
    const initialImpacted = current;
    const enabledSectors = enabled.map(item => this.sector(item.stageId));
    const steps = enabled.map((cfg, index) => {
      const stageId = cfg.stageId;
      const isOrigin = index === 0;
      const isDestination = index === enabled.length - 1;
      let converted;
      if (isOrigin) converted = current;
      else if (cfg.manualConverted !== null) converted = Math.min(current, Math.max(0, Number(cfg.manualConverted || 0)));
      else converted = Math.max(0, Math.round(current * (baseRate + (index * 0.04))));
      const drop = Math.max(0, current - converted);
      const step = {
        stageId,
        label: this.label(stageId),
        sector: enabledSectors[index],
        funnel: this.funnel(stageId),
        channelName: cfg.channelName || '',
        impacted: current,
        converted,
        drop,
        conversionRate: current ? Math.round((converted / current) * 1000) / 10 : 0,
        isOrigin,
        isDestination,
        isHandoff: index > 0 && enabledSectors[index - 1] !== enabledSectors[index],
        originalIndex: stageIndex.get(stageId) ?? -1
      };
      current = converted;
      return step;
    });
    return {
      path,
      config,
      steps,
      impacted: initialImpacted,
      converted: steps.at(-1)?.converted || 0,
      scoreImpact: action.scoreImpact || 18,
      avgDays: action.avgJourneyDays || 14
    };
  }
};
window.FlowResolutionEngine = FlowResolutionEngine;
