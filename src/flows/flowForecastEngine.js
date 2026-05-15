// V15.1 — Flow Forecast Engine
// Projeta receita ao longo do fluxo: para cada ação raiz, multiplica leads
// projetados, taxas de avanço e ticket médio do produto, devolvendo um pacote
// que alimenta o RevOps AI e o dashboard.
window.FlowForecastEngine = {
  _ticketFor(productId) {
    if (!productId || !window.RevopsFinanceEngine) return 0;
    const cfg = App.state.revopsFinance?.[productId];
    if (!cfg) return 0;
    return RevopsFinanceEngine.computeTicket(cfg) || 0;
  },

  forecastFlow(rootAction) {
    if (!rootAction) return { rootId: null, leads: 0, finished: 0, revenue: 0, perAction: [] };
    const path = FlowEngine.traverseFromRoot(FlowEngine.ensureActionFlow(rootAction));
    const perAction = [];
    let leadsEntering = 0;
    for (let i = 0; i < path.length; i++) {
      const action = path[i];
      const metrics = FlowConversionEngine.actionMetrics(action);
      if (i === 0) leadsEntering = metrics.impacted;
      perAction.push({ action, metrics });
    }
    const lastConverted = perAction.length ? perAction[perAction.length - 1].metrics.converted : 0;
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(rootAction.campaignId));
    const productId = campaign?.productId;
    const ticket = this._ticketFor(productId);
    const revenue = lastConverted * ticket;
    return {
      rootId: Number(rootAction.id),
      leads: leadsEntering,
      finished: lastConverted,
      ticket,
      revenue,
      perAction
    };
  },

  forecastCampaign(campaignId) {
    const graph = FlowEngine.flowsForCampaign(campaignId);
    const flows = graph.roots.map(root => this.forecastFlow(root));
    const totalLeads = flows.reduce((sum, f) => sum + f.leads, 0);
    const totalFinished = flows.reduce((sum, f) => sum + f.finished, 0);
    const totalRevenue = flows.reduce((sum, f) => sum + f.revenue, 0);
    return { flows, totalLeads, totalFinished, totalRevenue };
  }
};
