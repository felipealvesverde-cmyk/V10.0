// LeadJourney V13 — RD data mapper
window.RDMapper = {
  isRDEmailAction(action = {}) {
    const channel = String(action.channel || "").toLowerCase();
    return channel.includes("rd email") || channel.includes("rd station email") || channel === "email rd";
  },

  ensureRDEmailConfig(actionOrDraft = {}) {
    return {
      ...RDConfig.emailDefaults(),
      ...(actionOrDraft.rdEmailConfig || {})
    };
  },

  ensureRDEmailKpis(actionOrDraft = {}) {
    const existing = Array.isArray(actionOrDraft.kpis) ? actionOrDraft.kpis : [];
    const names = new Set(existing.map(kpi => String(kpi.name || "").toLowerCase()));
    const defaults = RDConfig.emailKpiDefaults().filter(kpi => !names.has(kpi.name.toLowerCase()));
    return window.RDKpiMapper ? RDKpiMapper.mapStatsToKpis(actionOrDraft.rdEmailStats || RDKpiMapper.emptyStatsTemplate(), existing) : [...existing, ...defaults];
  },

  mapActionPayload(action = {}) {
    if (!this.isRDEmailAction(action)) return action;
    return {
      ...action,
      rdEmailConfig: this.ensureRDEmailConfig(action),
      kpis: this.ensureRDEmailKpis(action)
    };
  }
};
