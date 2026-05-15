// V16.3 — Execution Sync Engine
// Sincroniza tarefas com providers externos (polling ou trigger manual).
// Webhook receiver (futuro) chamará ExecutionSyncEngine.applyExternalUpdate().
window.ExecutionSyncEngine = {
  async syncAll() {
    const tasks = (window.ExecutionTaskStore?.all() || []).filter(t => t.provider !== 'manual' && t.status !== 'completed' && t.provider_task_id);
    const results = [];
    for (const task of tasks) {
      const result = await this.syncTask(task);
      results.push(result);
    }
    return { ok: true, synced: results.length };
  },

  async syncTask(task) {
    const provider = window.ExecutionProviders?.[task.provider];
    if (!provider?.fetchTask) return { ok: false, message: 'Provider sem fetchTask.' };
    try {
      const cfg = window.ExecutionProviderRegistry?.getProviderConfig(task.provider) || {};
      const remote = await provider.fetchTask(task.provider_task_id, cfg);
      if (!remote) return { ok: false, message: 'Sem resposta do provider.' };
      ExecutionTaskStore.update(task.task_id, {
        status: remote.status || task.status,
        completed_at: remote.completedAt || task.completed_at
      });
      return { ok: true };
    } catch (err) {
      return { ok: false, message: String(err?.message || err) };
    }
  },

  applyExternalUpdate(providerId, providerTaskId, patch) {
    const task = (window.ExecutionTaskStore?.all() || []).find(t => t.provider === providerId && t.provider_task_id === providerTaskId);
    if (!task) return { ok: false, message: 'Tarefa local não encontrada para sync externo.' };
    ExecutionTaskStore.update(task.task_id, patch);
    return { ok: true };
  }
};
