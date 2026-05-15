// V15.1 — Flow Conversion Engine
// Calcula taxas de conversão tanto por ação individual quanto pelo fluxo
// completo (do nó raiz até cada nó folha). Reutiliza os contadores existentes
// de FlowResolutionEngine.buildActionFlow para extrair impacted/converted.
window.FlowConversionEngine = {
  actionMetrics(action) {
    if (!action) return { impacted: 0, converted: 0, conversionRate: 0 };
    try {
      const flow = FlowResolutionEngine.buildActionFlow(action);
      return {
        impacted: Number(flow.impacted || 0),
        converted: Number(flow.converted || 0),
        conversionRate: flow.impacted ? (flow.converted / flow.impacted) * 100 : 0
      };
    } catch (_) {
      const leads = (action.leads || []).length;
      const converted = Math.round(leads * (Number(action.expectedConversion || 0) / 100));
      return { impacted: leads, converted, conversionRate: leads ? (converted / leads) * 100 : 0 };
    }
  },

  flowMetrics(rootAction) {
    if (!rootAction) return { entered: 0, finished: 0, conversionRate: 0, perAction: [] };
    const path = FlowEngine.traverseFromRoot(FlowEngine.ensureActionFlow(rootAction));
    const perAction = path.map(action => ({ action, ...this.actionMetrics(action) }));
    const entered = perAction[0]?.impacted || 0;
    let finished = 0;
    for (const node of path) {
      const isLeaf = !(node.flow?.nextActions?.length);
      if (isLeaf) finished += this.actionMetrics(node).converted;
    }
    const conversionRate = entered ? (finished / entered) * 100 : 0;
    return { entered, finished, conversionRate, perAction };
  },

  campaignFlows(campaignId) {
    const graph = FlowEngine.flowsForCampaign(campaignId);
    return graph.roots.map(root => ({
      rootId: Number(root.id),
      ...this.flowMetrics(root)
    }));
  },

  edgeMetrics(fromAction, toAction) {
    if (!fromAction || !toAction) return null;
    const fromMetrics = this.actionMetrics(fromAction);
    const toMetrics = this.actionMetrics(toAction);
    const pass = fromMetrics.converted > 0 ? (toMetrics.impacted / fromMetrics.converted) * 100 : 0;
    return {
      fromConverted: fromMetrics.converted,
      toImpacted: toMetrics.impacted,
      passRate: Math.min(100, pass),
      drop: Math.max(0, fromMetrics.converted - toMetrics.impacted)
    };
  }
};
