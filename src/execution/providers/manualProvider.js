// V16.3 — Manual Provider
// Modo sem integração externa: tarefas vivem só no LeadJourney. Sempre "conecta".
window.ExecutionProviders = window.ExecutionProviders || {};
window.ExecutionProviders.manual = {
  id: 'manual',
  async testConnection() {
    return { ok: true, message: 'Modo manual ativo: tarefas ficam no LeadJourney.' };
  },
  async createTask(payload) {
    return {
      providerTaskId: `manual_${Date.now()}`,
      externalUrl: null
    };
  },
  async updateTask() { return { ok: true }; },
  async fetchTask(providerTaskId) {
    return { status: 'pending' };
  }
};
