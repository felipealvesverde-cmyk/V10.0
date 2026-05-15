// V16.3 — Provider Sync Engine
// Orquestra um round-robin de sync entre providers ativos. Reaproveita o
// ExecutionSyncEngine no nível de tarefa e expõe hook para webhooks futuros.
window.ProviderSyncEngine = {
  async runRound() {
    if (!window.ExecutionSyncEngine) return { ok: false, synced: 0 };
    return ExecutionSyncEngine.syncAll();
  },

  async syncOneProvider(providerId) {
    const tasks = (window.ExecutionTaskStore?.all() || []).filter(t => t.provider === providerId && t.status !== 'completed');
    let count = 0;
    for (const task of tasks) {
      const r = await ExecutionSyncEngine.syncTask(task);
      if (r.ok) count += 1;
    }
    return { ok: true, synced: count };
  }
};
