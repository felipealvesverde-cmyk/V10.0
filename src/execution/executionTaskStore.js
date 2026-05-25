// V16.3 — Execution Task Store
// CRUD em App.state.executionTasks. Cada task carrega vínculo com action/campaign/flow,
// provider e id externo. Não toca em UI nem chama provider — só persiste.
window.ExecutionTaskStore = {
  all() { return App.state.executionTasks || []; },

  byAction(actionId) {
    return this.all().filter(t => Number(t.linked_action_id) === Number(actionId));
  },

  byId(taskId) {
    return this.all().find(t => t.task_id === taskId) || null;
  },

  create(task) {
    const now = new Date().toISOString();
    const record = {
      task_id: task.task_id || `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      provider: task.provider || 'manual',
      provider_task_id: task.provider_task_id || null,
      linked_action_id: Number(task.linked_action_id) || null,
      linked_campaign_id: Number(task.linked_campaign_id) || null,
      linked_flow_id: task.linked_flow_id || null,
      title: String(task.title || 'Tarefa sem título'),
      description: String(task.description || ''),
      assignee: String(task.assignee || ''),
      due_date: task.due_date || null,
      priority: task.priority || 'normal',
      status: task.status || 'pending',
      // V32.15.2 — Status RAW do provider (ClickUp/Trello/etc) com label e cor
      // que o user definiu lá. Quando preenchidos, os badges no LJ exibem
      // esses valores em vez do mapping binário pending/in_progress/completed.
      provider_status_label: task.provider_status_label || null,
      provider_status_color: task.provider_status_color || null,
      external_url: task.external_url || null,
      source_agent: task.source_agent || null,
      execution_context: task.execution_context || null,
      created_at: now,
      started_at: null,
      completed_at: null,
      last_synced_at: null
    };
    App.state.executionTasks = [...(App.state.executionTasks || []), record];
    return record;
  },

  update(taskId, patch) {
    let updated = null;
    App.state.executionTasks = (App.state.executionTasks || []).map(t => {
      if (t.task_id !== taskId) return t;
      updated = { ...t, ...patch, last_synced_at: new Date().toISOString() };
      return updated;
    });
    // V31.1.0 — Recompute strategicStatus da ação vinculada (auto-transição).
    if (updated && updated.linked_action_id && window.StrategicStatusEngine) {
      try { window.StrategicStatusEngine.recompute(updated.linked_action_id); } catch (_) {}
    }
    return updated;
  },

  remove(taskId) {
    App.state.executionTasks = (App.state.executionTasks || []).filter(t => t.task_id !== taskId);
  },

  setStatus(taskId, status) {
    const patch = { status };
    if (status === 'in_progress' && !this.byId(taskId)?.started_at) patch.started_at = new Date().toISOString();
    if (status === 'completed') patch.completed_at = new Date().toISOString();
    return this.update(taskId, patch);
  }
};
