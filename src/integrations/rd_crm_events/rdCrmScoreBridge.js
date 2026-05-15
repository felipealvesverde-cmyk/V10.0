// V21 — RD CRM Score Bridge
// Quando o lead recebe um evento RD (tag, stage, deal), recalcula o Revenue
// Score das campanhas em que ele está vinculado. Resultado fica em
// LeadScoringV2 normalmente — aqui só dispara o refresh.
window.RdCrmScoreBridge = {
  recalcAfterEvent(leadKey, event) {
    if (!leadKey || !window.LeadBaseService || !window.LeadScoringV2) return { ok: false };
    const links = App.state.campaignLeadLinks || {};
    let recalcCount = 0;
    for (const campaignId of Object.keys(links)) {
      const list = links[campaignId] || [];
      if (!list.includes(leadKey)) continue;
      try {
        // skipHistory=false porque queremos snapshot (momentum precisa)
        LeadScoringV2.classifyCampaign(Number(campaignId));
        recalcCount += 1;
      } catch (_) {}
    }
    LeadBaseService.pushEvent(leadKey, { source: 'score-bridge', type: 'score.recalculated', forCampaigns: recalcCount, ts: new Date().toISOString() });
    return { ok: true, recalcCount };
  }
};
