// V16.3 — Execution Prompt Builder
// Constrói o payload final enviado ao Djow. Recebe a mensagem do usuário e o
// contexto da ação, devolve { message, context }.
window.ExecutionPromptBuilder = {
  build(message, actionId) {
    const context = window.ExecutionContextEngine ? ExecutionContextEngine.build(actionId) : null;
    return { message: String(message || '').trim(), context };
  }
};
