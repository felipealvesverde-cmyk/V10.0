// V17 — Strategic Flow Bridge
// Conecta o mapa estratégico aos fluxos operacionais existentes (campanhas →
// ações → fluxo). Lista quais campanhas/ações do produto estão disponíveis
// para vinculação e devolve métricas agregadas.
window.StrategicFlowBridge = {
  campaignsForProduct(productId) {
    return (App.state.campaigns || []).filter(c => Number(c.productId) === Number(productId));
  },

  actionsForProduct(productId) {
    const campaignIds = new Set(this.campaignsForProduct(productId).map(c => Number(c.id)));
    return (App.state.actions || []).filter(a => campaignIds.has(Number(a.campaignId)));
  },

  actionsForOkr(productId, okr) {
    const allowed = new Set((okr?.connectedActionIds || []).map(Number));
    if (!allowed.size) return [];
    return this.actionsForProduct(productId).filter(a => allowed.has(Number(a.id)));
  },

  summary(productId) {
    const campaigns = this.campaignsForProduct(productId);
    const actions = this.actionsForProduct(productId);
    const activeFlows = actions.filter(a => a.flow?.enabled).length;
    return {
      campaigns: campaigns.length,
      actions: actions.length,
      activeFlows
    };
  }
};
