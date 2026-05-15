// V21 — RD CRM Outcome Bridge
// Aplica resultado de deal RD (won/lost) no lead + propaga pra
// OutcomeTracker (calibração V19) e tags acumulativas.
window.RdCrmOutcomeBridge = {
  applyDealOutcome(deal) {
    if (!deal || !window.LeadBaseService) return { ok: false };
    const leadKey = this._resolveLeadKey(deal);
    if (!leadKey) return { ok: false, reason: 'no-lead' };
    if (deal.outcome === 'won') {
      LeadBaseService.markOutcome(leadKey, 'won');
      LeadBaseService.accumulateTag(leadKey, 'cliente_ganho');
      LeadBaseService.pushEvent(leadKey, { source: 'rd-crm', type: 'deal.won', deal: { id: deal.rdDealId, amount: deal.amount }, ts: deal.closedAt || new Date().toISOString() });
      this._propagateToOutcomeTracker(leadKey, 'won', deal);
    } else if (deal.outcome === 'lost') {
      LeadBaseService.markOutcome(leadKey, 'lost');
      LeadBaseService.accumulateTag(leadKey, 'cliente_perdido');
      LeadBaseService.pushEvent(leadKey, { source: 'rd-crm', type: 'deal.lost', deal: { id: deal.rdDealId }, ts: deal.closedAt || new Date().toISOString() });
      this._propagateToOutcomeTracker(leadKey, 'lost', deal);
    } else {
      LeadBaseService.pushEvent(leadKey, { source: 'rd-crm', type: 'deal.updated', deal: { id: deal.rdDealId, stage: deal.stageName } });
    }
    return { ok: true, leadKey };
  },

  _resolveLeadKey(deal) {
    if (!window.LeadBaseService) return null;
    if (deal.leadKey) return String(deal.leadKey).toLowerCase().trim();
    if (deal.rdContactId) {
      const all = LeadBaseService.list();
      const found = all.find(l => l.rdContactId === deal.rdContactId);
      if (found) return LeadBaseService.keyOf(found);
    }
    return null;
  },

  // Marca outcome em todas campanhas em que o lead está vinculado, pra que
  // a CalibrationCurveEngine consiga aferir o modelo por campanha.
  _propagateToOutcomeTracker(leadKey, outcome, deal) {
    if (!window.OutcomeTracker) return;
    const links = App.state.campaignLeadLinks || {};
    for (const campaignId of Object.keys(links)) {
      const list = links[campaignId] || [];
      if (list.includes(leadKey)) {
        OutcomeTracker.mark(leadKey, Number(campaignId), outcome, { amount: deal.amount, reason: deal.stageName });
      }
    }
  }
};
