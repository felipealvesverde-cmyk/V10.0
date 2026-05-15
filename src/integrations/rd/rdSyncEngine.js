
window.RDSyncEngine = {
  async syncAction(actionId) {
    const action = App.state.actions.find(a => Number(a.id) === Number(actionId));
    if (!action) return { ok:false, message:"Ação não encontrada." };
    if (!RDMapper.isRDEmailAction(action)) return { ok:false, message:"Ação não é RD Email." };

    const result = await RDEmailStatsService.fetchStats(action);
    const next = window.RDKpiMapper ? RDKpiMapper.applyToAction(action, result.stats || {}) : { ...action, rdEmailStats: result.stats || action.rdEmailStats || {} };

    next.lastRdSyncAt = new Date().toISOString();
    next.rdSyncStatus = result.ok ? (result.dryRun ? "dry_run" : "synced") : "error";
    next.rdSyncMessage = result.message;
    next.rdSyncAttempts = result.attempts || [];

    App.state.actions = App.state.actions.map(a => Number(a.id) === Number(actionId) ? next : a);
    App.save();
    return { ...result, actionId, action: next };
  },
  async syncAll() {
    const rdActions = (App.state.actions || []).filter(action => RDMapper.isRDEmailAction(action));
    const results = [];
    for (const action of rdActions) results.push(await this.syncAction(action.id));
    App.state.integrations = App.state.integrations || {};
    App.state.integrations.rd = { ...RDConfig.defaultConfig(), ...(App.state.integrations.rd || {}), lastSyncAt:new Date().toISOString() };
    App.save();
    return { ok:true, total:rdActions.length, results };
  }
};
