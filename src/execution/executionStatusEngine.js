// V16.3 — Execution Status Engine
// Deriva contadores de execução por ação a partir do TaskStore. Usado no card
// para mostrar "X para executar / Y executadas".
window.ExecutionStatusEngine = {
  forAction(actionId) {
    const tasks = window.ExecutionTaskStore ? ExecutionTaskStore.byAction(actionId) : [];
    let toExecute = 0, executing = 0, executed = 0, blocked = 0;
    for (const t of tasks) {
      if (t.status === 'completed') executed += 1;
      else if (t.status === 'in_progress') executing += 1;
      else if (t.status === 'blocked' || t.status === 'failed') blocked += 1;
      else toExecute += 1;
    }
    return { total: tasks.length, toExecute, executing, executed, blocked };
  },

  forCampaign(campaignId) {
    const tasks = (window.ExecutionTaskStore?.all() || []).filter(t => Number(t.linked_campaign_id) === Number(campaignId));
    return tasks.reduce((acc, t) => {
      acc.total += 1;
      if (t.status === 'completed') acc.executed += 1;
      else if (t.status === 'in_progress') acc.executing += 1;
      else acc.toExecute += 1;
      return acc;
    }, { total: 0, toExecute: 0, executing: 0, executed: 0 });
  },

  globalSnapshot() {
    const tasks = window.ExecutionTaskStore?.all() || [];
    const byProvider = {};
    for (const t of tasks) {
      const key = t.provider || 'manual';
      byProvider[key] = byProvider[key] || { total: 0, completed: 0 };
      byProvider[key].total += 1;
      if (t.status === 'completed') byProvider[key].completed += 1;
    }
    return { total: tasks.length, byProvider };
  }
};
