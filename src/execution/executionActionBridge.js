// V16.3 — Execution Action Bridge
// Faz a ponte entre uma action do LeadJourney e o payload operacional enviado
// para o provider. Concentra a tradução de domínio (action+campaign+product)
// → contexto técnico (title, assignee, due_date, description, priority, context).
window.ExecutionActionBridge = {
  resolveContext(actionId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return null;
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId)) || null;
    const product = campaign ? (App.state.products || []).find(p => Number(p.id) === Number(campaign.productId)) : null;
    const flow = action.flow || null;
    return { action, campaign, product, flow };
  },

  toTaskRecord(ctx, parsed, providerId, agentName) {
    return {
      provider: providerId || (window.ExecutionProviderRegistry?.getDefaultProviderId?.() || 'manual'),
      linked_action_id: ctx.action?.id || null,
      linked_campaign_id: ctx.campaign?.id || null,
      linked_flow_id: ctx.flow?.id || null,
      title: parsed?.title || `Tarefa: ${ctx.action?.name || 'Ação'}`,
      description: parsed?.description || '',
      assignee: parsed?.assignee || ctx.campaign?.owner || '',
      due_date: parsed?.due_date || null,
      priority: parsed?.priority || 'normal',
      status: 'pending',
      source_agent: agentName || 'manual',
      execution_context: {
        action_name: ctx.action?.name,
        campaign_name: ctx.campaign?.name,
        product_name: ctx.product?.name,
        sector: ctx.action?.sector,
        funnel: ctx.action?.funnel,
        channel: ctx.action?.channel
      }
    };
  }
};
