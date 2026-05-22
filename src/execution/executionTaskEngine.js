// V16.3 — Execution Task Engine
// Orquestra criação de tarefa: bridge → selector → provider → store.
// Não toca em UI — devolve o registro persistido (ou erro).
window.ExecutionTaskEngine = {
  async createFromParsedResponse(actionId, parsed, agentName) {
    if (!window.ExecutionActionBridge) return { ok: false, message: 'Bridge não disponível.' };
    const ctx = ExecutionActionBridge.resolveContext(actionId);
    if (!ctx) return { ok: false, message: 'Ação não encontrada.' };
    const providerId = ExecutionProviderSelector.selectFor(ctx.action);
    const draft = ExecutionActionBridge.toTaskRecord(ctx, parsed, providerId, agentName);
    const providerCfg = ExecutionProviderRegistry.getProviderConfig(providerId);
    const provider = window.ExecutionProviders?.[providerId];
    let providerResult = { providerTaskId: null, externalUrl: null };
    if (provider?.createTask) {
      try { providerResult = await provider.createTask(draft, providerCfg) || providerResult; }
      catch (err) { providerResult = { providerTaskId: null, externalUrl: null, error: String(err?.message || err) }; }
    }
    const record = ExecutionTaskStore.create({
      ...draft,
      provider_task_id: providerResult.providerTaskId,
      external_url: providerResult.externalUrl
    });
    return { ok: true, task: record, providerWarning: providerResult.error || null };
  },

  async startTask(taskId) {
    const task = ExecutionTaskStore.byId(taskId);
    if (!task) return { ok: false, message: 'Tarefa não encontrada.' };
    const updated = ExecutionTaskStore.setStatus(taskId, 'in_progress');
    const provider = window.ExecutionProviders?.[task.provider];
    if (provider?.updateTask) {
      try { await provider.updateTask(task.provider_task_id, { status: 'in_progress' }, ExecutionProviderRegistry.getProviderConfig(task.provider)); }
      catch (_) {}
    }
    return { ok: true, task: updated };
  },

  async completeTask(taskId) {
    const task = ExecutionTaskStore.byId(taskId);
    if (!task) return { ok: false, message: 'Tarefa não encontrada.' };
    const updated = ExecutionTaskStore.setStatus(taskId, 'completed');
    const provider = window.ExecutionProviders?.[task.provider];
    if (provider?.updateTask) {
      try { await provider.updateTask(task.provider_task_id, { status: 'completed' }, ExecutionProviderRegistry.getProviderConfig(task.provider)); }
      catch (_) {}
    }
    return { ok: true, task: updated };
  },

  // V32.3.0 (Geraldo Novo-1) — Antes de remover do store local, dispara
  // provider.deleteTask pra evitar subtask órfã no ClickUp (ou em qualquer
  // provider que implemente deleteTask). Falha silenciosa não bloqueia o
  // delete local — task some do LJ mesmo se ClickUp recusar.
  async removeTask(taskId) {
    const task = ExecutionTaskStore.byId(taskId);
    if (task) {
      const provider = window.ExecutionProviders?.[task.provider];
      if (provider?.deleteTask) {
        try { await provider.deleteTask(task.provider_task_id, ExecutionProviderRegistry.getProviderConfig(task.provider)); }
        catch (_) { /* não bloqueia delete local */ }
      }
    }
    ExecutionTaskStore.remove(taskId);
    return { ok: true };
  }
};
