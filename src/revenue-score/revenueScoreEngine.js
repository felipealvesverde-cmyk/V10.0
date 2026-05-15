// V18 — Revenue Score Engine
// Núcleo do Revenue Score Center: lê/grava blueprints por campanha e calcula
// stats agregados que alimentam o card no menu Score.
window.RevenueScoreEngine = {
  getBlueprint(campaignId) {
    if (!campaignId) return null;
    return (App.state.revenueScoreBlueprints || {})[campaignId] || null;
  },

  hasBlueprint(campaignId) {
    return Boolean(this.getBlueprint(campaignId));
  },

  saveBlueprint(campaignId, blueprint) {
    const bp = { ...blueprint, campaignId: Number(campaignId), updatedAt: new Date().toISOString() };
    App.state.revenueScoreBlueprints = { ...(App.state.revenueScoreBlueprints || {}), [campaignId]: bp };
    return bp;
  },

  removeBlueprint(campaignId) {
    const all = { ...(App.state.revenueScoreBlueprints || {}) };
    delete all[campaignId];
    App.state.revenueScoreBlueprints = all;
  },

  campaignStats(campaign) {
    const actions = (App.state.actions || []).filter(a => Number(a.campaignId) === Number(campaign.id));
    let totalLeads = 0, hotLeads = 0, revenueReady = 0, sumScore = 0;
    for (const action of actions) {
      const leads = action.leads || [];
      totalLeads += leads.length;
      for (const lead of leads) {
        const s = Number(lead.score || 0);
        sumScore += s;
        if (s >= 45) hotLeads += 1;
        if (s >= 60) revenueReady += 1;
      }
    }
    const healthScore = totalLeads ? Math.round(sumScore / totalLeads) : 0;
    const blueprint = this.getBlueprint(campaign.id);
    return {
      totalLeads,
      hotLeads,
      revenueReady,
      healthScore,
      lastUpdate: blueprint?.updatedAt || null,
      hasBlueprint: Boolean(blueprint)
    };
  }
};
