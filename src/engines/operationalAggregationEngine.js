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
    // V38.0.2 — Execuções: tasks do gestor vinculadas a ações deste produto.
    let executionsTotal = 0, executionsDone = 0;
    // V38.1.29 — bug fix: metodo do ExecutionTaskStore eh byAction (nao byActionId).
    // Card de Produto mostrava sempre 0/0 porque byActionId nao existe.
    if (window.ExecutionTaskStore?.byAction) {
      for (const action of actions) {
        const tasks = ExecutionTaskStore.byAction(action.id) || [];
        executionsTotal += tasks.length;
        executionsDone += tasks.filter(t => t.status === 'completed').length;
      }
    }
    return {
      campaigns: campaigns.length,
      actions: actions.length,
      leads,
      converted,
      conversion: leads ? Math.round((converted / leads) * 1000) / 10 : 0,
      executionsTotal,
      executionsDone
    };
  },

  // V38.0.2 — Overview agregado de TODOS os produtos visíveis. Usado no Hero
  // da aba Produtos pra mostrar consolidado em vez do produto selecionado.
  aggregateAll() {
    const products = (App.state.products || []).filter(p => !p.archived);
    let campaigns = 0, actions = 0, executionsTotal = 0, executionsDone = 0;
    for (const product of products) {
      const m = this.productMetrics(product.id);
      campaigns += m.campaigns;
      actions += m.actions;
      executionsTotal += m.executionsTotal;
      executionsDone += m.executionsDone;
    }
    return { productsCount: products.length, campaigns, actions, executionsTotal, executionsDone };
  }
};
window.OperationalAggregationEngine = OperationalAggregationEngine;
