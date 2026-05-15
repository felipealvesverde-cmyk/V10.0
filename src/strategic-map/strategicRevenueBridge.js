// V17 — Strategic Revenue Bridge
// Traduz métricas operacionais (leads, conversões, revenue) em "current" dos
// OKRs. Quando o OKR tem actions conectadas, este bridge consolida leads/
// converted nessas actions e devolve um valor sugerido.
window.StrategicRevenueBridge = {
  computeCurrent(productId, okr) {
    if (!okr) return 0;
    const metric = String(okr.metric || 'leads').toLowerCase();
    const actions = StrategicFlowBridge.actionsForOkr(productId, okr);
    if (!actions.length) return Number(okr.current || 0);
    let total = 0;
    for (const action of actions) {
      const leads = (action.leads || []).length;
      const flow = window.FlowResolutionEngine ? FlowResolutionEngine.buildActionFlow(action) : { converted: 0 };
      const converted = Number(flow.converted || 0);
      if (metric === 'leads') total += leads;
      else if (metric === 'converted' || metric === 'conversions') total += converted;
      else if (metric === 'revenue') total += converted * Number(action.ticketMedio || 0);
      else total += leads; // default
    }
    return total;
  },

  syncOkrFromOperations(productId) {
    const map = window.StrategicMapEngine ? StrategicMapEngine.getForProduct(productId) : null;
    if (!map) return;
    const objectives = (map.objectives || []).map(obj => ({
      ...obj,
      okrs: (obj.okrs || []).map(kr => ({ ...kr, current: this.computeCurrent(productId, kr) }))
    }));
    StrategicMapEngine.save(productId, { objectives });
  }
};
