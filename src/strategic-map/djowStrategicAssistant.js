// V17 — Djow Strategic Assistant
// Camada estratégica do Djow: histórico de chat por produto, dispatcher que
// reaproveita o RailwayAgentClient quando online, com fallback local que
// devolve exemplos guiados (visão, objetivo, OKR) conforme a pergunta.
window.DjowStrategicAssistant = {
  history(productId) {
    return (App.state.strategicDjowChats?.[productId]?.messages) || [];
  },

  append(productId, message) {
    const chats = App.state.strategicDjowChats || {};
    const existing = chats[productId]?.messages || [];
    App.state.strategicDjowChats = { ...chats, [productId]: { messages: [...existing, message] } };
  },

  buildContext(productId) {
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    const map = window.StrategicMapEngine ? StrategicMapEngine.getForProduct(productId) : null;
    const summary = window.StrategicFlowBridge ? StrategicFlowBridge.summary(productId) : { campaigns: 0, actions: 0, activeFlows: 0 };
    return {
      product: product?.name || null,
      product_type: product?.type || null,
      vision: map?.vision || '',
      objectives_count: (map?.objectives || []).length,
      okrs_count: (map?.objectives || []).reduce((sum, o) => sum + (o.okrs?.length || 0), 0),
      campaigns: summary.campaigns,
      actions: summary.actions,
      flows_active: summary.activeFlows,
      zoom: App.state.strategicMapZoom || 'strategy'
    };
  },

  async dispatch(productId, userMessage) {
    const ctx = this.buildContext(productId);
    const message = String(userMessage || '').trim();
    if (!message) return { ok: false, message: 'Mensagem vazia.' };
    const agentCfg = App.state.agentConfig?.djow;
    if (agentCfg?.enabled && agentCfg?.url && window.RailwayAgentClient) {
      const response = await RailwayAgentClient.send(message, { ...ctx, channel: 'strategic-map' }, agentCfg);
      if (response.ok && response.data) {
        const text = String(response.data.message || response.data.response || response.data.description || '').trim();
        if (text) {
          if (window.AgentHealthMonitor) AgentHealthMonitor.recordSuccess(response.latencyMs);
          return { ok: true, text, source: 'djow', latencyMs: response.latencyMs };
        }
      }
      if (window.AgentHealthMonitor) AgentHealthMonitor.recordFailure(response.message);
    }
    return { ok: true, text: this._localSuggestion(message, ctx), source: 'fallback' };
  },

  _localSuggestion(message, ctx) {
    const msg = message.toLowerCase();
    if (/visão|missão/.test(msg)) {
      return `Exemplo de Visão para "${ctx.product || 'seu produto'}":\n\n"Transformar ${ctx.product_type || 'usuários'} em referência operacional, ampliando geração de receita previsível."`;
    }
    if (/objetivo|estrat[eé]gico/.test(msg)) {
      return 'Exemplos de Objetivos Estratégicos:\n• Aumentar aquisição\n• Melhorar conversão de MOF para BOF\n• Reduzir CAC\n• Aumentar retenção / LTV';
    }
    if (/okr|meta|kpi/.test(msg)) {
      return 'Exemplo de OKR:\n\nObjetivo: Aumentar aquisição.\n→ OKR: "Gerar 2.000 leads qualificados até julho."\n• Métrica: leads qualificados\n• Meta: 2000\n• Atual: 0\n• Dono: Marketing';
    }
    if (/fluxo|campanha|conectar/.test(msg)) {
      return 'Para conectar fluxos, escolha o nível Fluxos no zoom. Selecione campanhas e ações relevantes para cada OKR. Exemplo: Instagram TOF → LP MOF → Email BOF → Checkout.';
    }
    if (/execu[cç][aã]o|tarefa|djow/.test(msg)) {
      return 'Na execução, cada ação pode gerar tarefas operacionais via Djow (modal "Criar Tarefas" no card da ação). O resultado das tarefas alimenta a leitura dos OKRs.';
    }
    return `Posso te ajudar com:\n• Visão do produto (escreva "visão")\n• Objetivos estratégicos (escreva "objetivos")\n• OKRs (escreva "okr")\n• Conectar fluxos (escreva "fluxos")\n• Execução operacional (escreva "execução")`;
  }
};
