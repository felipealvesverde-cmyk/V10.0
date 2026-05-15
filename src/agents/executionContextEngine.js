// V16.3 — Execution Context Engine
// Monta o pacote de contexto operacional enviado ao agente externo. Combina
// dados de ação + campanha + produto + KPIs + OKRs + fluxo.
window.ExecutionContextEngine = {
  build(actionId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return null;
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId)) || null;
    const product = campaign ? (App.state.products || []).find(p => Number(p.id) === Number(campaign.productId)) : null;
    const flow = action.flow || null;
    const kpis = Array.isArray(action.kpis) ? action.kpis.map(k => k.name || k.label).filter(Boolean) : [];
    const okrs = Array.isArray(action.okrs) ? action.okrs.map(o => o.name).filter(Boolean) : [];
    return {
      campaign: campaign?.name || null,
      action: action.name || null,
      product: product?.name || null,
      funnel_stage_start: this._stageLabel(action.originSector, action.originFunnel),
      funnel_stage_end: this._stageLabel(action.destinationSector, action.destinationFunnel),
      okr: okrs.length ? okrs.join(' / ') : null,
      kpis,
      attachments: [],
      flow_enabled: Boolean(flow?.enabled),
      sector: action.sector || null,
      channel: action.channel || null,
      action_type: action.actionType || null,
      action_id: action.id,
      campaign_id: campaign?.id || null,
      product_id: product?.id || null
    };
  },

  _stageLabel(sector, funnel) {
    if (!sector && !funnel) return null;
    return `${sector || 'Marketing'} ${funnel || 'MOF'}`;
  }
};
