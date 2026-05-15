// V19 — Cohort Engine
// Agrupa leads pelo mês de criação. Compara conversão por cohort para detectar
// melhora/piora de campanhas/canais.
window.CohortEngine = {
  cohortKey(lead) {
    const ts = lead?.createdAt ? new Date(lead.createdAt) : new Date();
    return `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
  },

  group(classifiedLeads) {
    const cohorts = new Map();
    for (const c of (classifiedLeads || [])) {
      const key = c.lead?.cohortMonth || this.cohortKey(c.lead);
      if (!cohorts.has(key)) cohorts.set(key, []);
      cohorts.get(key).push(c);
    }
    return Array.from(cohorts.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([key, leads]) => ({
      cohort: key,
      total: leads.length,
      avgFit: Math.round(leads.reduce((s, l) => s + (l.fit || 0), 0) / leads.length),
      avgIntent: Math.round(leads.reduce((s, l) => s + (l.intent || 0), 0) / leads.length),
      avgRevenueScore: Math.round(leads.reduce((s, l) => s + (l.revenueScore || 0), 0) / leads.length),
      revenueReady: leads.filter(l => l.revenueReady).length,
      conversionRate: this._conversionRate(leads)
    }));
  },

  _conversionRate(leads) {
    if (!window.OutcomeTracker) return null;
    const decided = leads
      .map(l => OutcomeTracker.get(this._leadKey(l.lead), l.lead?.campaignId))
      .filter(o => o && o.outcome !== 'in-progress');
    if (!decided.length) return null;
    const won = decided.filter(o => o.outcome === 'won').length;
    return Math.round((won / decided.length) * 100);
  },

  _leadKey(lead) {
    return String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
  }
};
