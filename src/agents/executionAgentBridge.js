// V16.3 — Execution Agent Bridge
// Caminho completo: usuário → mensagem → Djow → parser → engine → task.
// Quando o agente não responde, faz fallback parsing local para não bloquear o usuário.
window.ExecutionAgentBridge = {
  async dispatch(actionId, userMessage) {
    if (!window.ExecutionPromptBuilder) return { ok: false, message: 'PromptBuilder ausente.' };
    const { message, context } = ExecutionPromptBuilder.build(userMessage, actionId);
    if (!message) return { ok: false, message: 'Mensagem vazia.' };
    const agentCfg = App.state.agentConfig?.djow || (window.AgentRegistry ? AgentRegistry.defaultConfig().djow : {});
    let parsed = null;
    let agentUsed = 'fallback-local';
    let latencyMs = 0;
    if (agentCfg.enabled && agentCfg.url) {
      const response = await RailwayAgentClient.send(message, context, agentCfg);
      latencyMs = response.latencyMs || 0;
      if (response.ok && response.data) {
        parsed = ExecutionResponseParser.parse(response.data);
        agentUsed = 'djow';
        if (window.AgentHealthMonitor) AgentHealthMonitor.recordSuccess(latencyMs);
      } else if (window.AgentHealthMonitor) {
        AgentHealthMonitor.recordFailure(response.message);
      }
    }
    if (!parsed) parsed = ExecutionResponseParser.parseLocal(message, context);
    const result = await ExecutionTaskEngine.createFromParsedResponse(actionId, parsed, agentUsed);
    return { ...result, latencyMs, agentUsed, parsed };
  }
};
