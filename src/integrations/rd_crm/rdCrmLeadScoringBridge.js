// V15 — Bridge entre tags RD CRM e o Lead Scoring nativo do Journey.
// Lê a estrutura acumulativa de tags (funil + etapa) e devolve um delta de
// score para somar ao globalScore do lead.
window.RdCrmLeadScoringBridge = {
  WEIGHTS: {
    funnel: { marketing: 4, vendas: 12, cs: 18 },
    stage: {
      mkttof: 1, mktmof: 2, mktbof: 4,
      vndtof: 6, vndmof: 10, vndbof: 16,
      csonboarding: 12, csretencao: 14, csexpansao: 18
    },
    repeatBonus: 0.5
  },
  MAX_SCORE_FROM_TAGS: 60,

  scoreFromTags(identityKey) {
    const data = RdCrmTagService.tagsForLead(identityKey);
    if (!data) return 0;
    let total = 0;
    for (const [funnel, count] of Object.entries(data.funis || {})) {
      const weight = this.WEIGHTS.funnel[funnel] || 2;
      const passes = Number(count || 0);
      if (passes <= 0) continue;
      total += weight + Math.max(0, passes - 1) * this.WEIGHTS.repeatBonus;
    }
    for (const [tag, count] of Object.entries(data.etapas || {})) {
      const weight = this.WEIGHTS.stage[tag] || 3;
      const passes = Number(count || 0);
      if (passes <= 0) continue;
      total += weight + Math.max(0, passes - 1) * this.WEIGHTS.repeatBonus;
    }
    return Math.min(this.MAX_SCORE_FROM_TAGS, Math.round(total));
  },

  applyToLead(lead) {
    if (!lead || !window.LeadIdentityEngine) return lead;
    const key = LeadIdentityEngine.identityKey(lead);
    const delta = this.scoreFromTags(key);
    const baseline = Number(lead.score || lead.globalScore || 0);
    const next = Math.min(100, baseline + delta);
    return { ...lead, score: next, globalScore: next, rdCrmScoreDelta: delta };
  },

  rescoreAll() {
    const actions = App.state.actions || [];
    let touched = 0;
    for (const action of actions) {
      if (!Array.isArray(action.leads)) continue;
      action.leads = action.leads.map(lead => {
        const enriched = this.applyToLead(lead);
        if (enriched.rdCrmScoreDelta) touched += 1;
        return enriched;
      });
    }
    if (Array.isArray(App.state.manualLeads)) {
      App.state.manualLeads = App.state.manualLeads.map(lead => this.applyToLead(lead));
    }
    return { ok: true, touched };
  }
};
