var OperationalAggregationEngine = {
  stageIds: ['marketing-tof','marketing-mof','marketing-bof','vendas-tof','vendas-mof','vendas-bof','cs-tof','cs-mof','cs-bof'],
  aggregate(actions = App.state.actions) {
    const nodes = Object.fromEntries(this.stageIds.map(id => [id, { stageId: id, volume: 0, converted: 0, okrs: [], score: 0, actions: 0, handoffs: 0 }]));
    for (const action of actions) {
      const flow = FlowResolutionEngine.buildActionFlow(action);
      const scoreImpact = Number(flow.scoreImpact || 0);
      const okrs = action.okrs || [];
      for (const step of flow.steps) {
        const node = nodes[step.stageId];
        if (!node) continue;
        node.volume += step.impacted || 0;
        node.converted += step.converted || 0;
        node.actions += 1;
        node.score += scoreImpact;
        if (step.isHandoff) node.handoffs += 1;
        if (okrs.length) node.okrs.push(...okrs);
      }
    }
    return nodes;
  },
  productMetrics(productId) {
    const productKey = String(productId);
    const campaigns = App.state.campaigns.filter(c => String(c.productId) === productKey);
    const campaignIds = new Set(campaigns.map(c => c.id));
    const actions = App.state.actions.filter(a => campaignIds.has(a.campaignId));
    let leads = 0, converted = 0;
    for (const action of actions) {
      leads += action.leads?.length || 0;
      converted += FlowResolutionEngine.buildActionFlow(action).converted || 0;
    }
    return { campaigns: campaigns.length, actions: actions.length, leads, converted, conversion: leads ? Math.round((converted / leads) * 1000) / 10 : 0 };
  }
};
window.OperationalAggregationEngine = OperationalAggregationEngine;
