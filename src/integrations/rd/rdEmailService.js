// LeadJourney V13 — RD Email action helper
window.RDEmailService = {
  listAvailableKpis() {
    return RDConfig.emailKpiDefaults();
  },

  validateEmailActionConfig(config = {}) {
    const cfg = { ...RDConfig.emailDefaults(), ...(config || {}) };
    const missing = [];
    if (!cfg.emailCampaignId && !cfg.emailCampaignName) missing.push("Campanha de e-mail RD");
    if (!cfg.listId && !cfg.listName) missing.push("Lista/segmentação");
    if (!cfg.emailSubject) missing.push("Assunto");
    if (!cfg.ctaUrl) missing.push("URL/CTA principal");

    return {
      ok: missing.length === 0,
      missing,
      message: missing.length
        ? `Campos RD Email pendentes: ${missing.join(", ")}.`
        : "Configuração RD Email completa."
    };
  }
};
