// V19 — Lead Recycling Engine
// Lead parado em stage por mais que o SLA → recycle (volta um stage ou move
// pra nurture). Hoje detecta e sinaliza; aplicar manualmente via UI.
window.LeadRecyclingEngine = {
  detectStale(classified) {
    if (!Array.isArray(classified) || !window.LifecycleEngine) return [];
    return classified.filter(c => LifecycleEngine.isStale(c.lead)).map(c => ({
      lead: c.lead,
      currentStage: c.lead.lifecycleStage,
      daysInStage: LifecycleEngine.daysInStage(c.lead),
      suggestedAction: this._suggestedAction(c)
    }));
  },

  _suggestedAction(scored) {
    const stage = scored.lead?.lifecycleStage;
    if (stage === 'mql' || stage === 'mqa') return 'Voltar para nurture e re-engajar com conteúdo de awareness.';
    if (stage === 'sal' || stage === 'sql')  return 'Sales não fez follow-up no SLA. Devolver para Marketing reciclar.';
    if (stage === 'opportunity')              return 'Oportunidade parada — atualizar status (perdida/no-decision) para limpar pipeline.';
    return 'Reciclar para nurture lento.';
  },

  recycle(lead) {
    if (!lead || !window.LifecycleEngine) return lead;
    const order = LifecycleEngine.STAGES;
    const idx = order.findIndex(s => s.id === lead.lifecycleStage);
    const prev = idx > 0 ? order[idx - 1].id : 'subscriber';
    return LifecycleEngine.transition(lead, prev);
  }
};
