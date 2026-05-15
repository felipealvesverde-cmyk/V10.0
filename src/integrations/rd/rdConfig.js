// LeadJourney V13 — RD Station integration configuration
window.RDConfig = {
  authBaseUrl: "https://api.rd.services/auth/dialog",
  apiBaseUrl: "https://api.rd.services",

  defaultConfig() {
    return {
      enabled: false,
      status: "not_configured",
      // V21.4.3 — Token estático do RD CRM legacy API (gerado no painel
      // CRM → Integrações). Usado para chamadas em crm.rdstation.com/api/v1
      // via query string ?token=X. NÃO confundir com accessToken do OAuth.
      crmPersonalToken: "",
      clientId: "",
      clientSecret: "",
      redirectUri: "",
      authorizationCode: "",
      accessToken: "",
      refreshToken: "",
      expiresAt: "",
      accountName: "",
      workspaceId: "",
      lastTestAt: "",
      lastSyncAt: "",
      syncFrequency: "manual",
      authUrl: ""
    };
  },

  emailDefaults() {
    return {
      provider: "RD Station",
      listId: "",
      listName: "",
      emailCampaignId: "",
      emailCampaignName: "",
      emailSubject: "",
      sendDate: "",
      ctaUrl: "",
      appliedTags: "",
      leadIdentifierField: "email",
      sourceStageId: "",
      destinationStageId: "",
      syncFrequency: "manual",
      notes: ""
    };
  },

  emailKpiDefaults() {
    return window.RDKpiMapper ? RDKpiMapper.mapStatsToKpis(RDKpiMapper.emptyStatsTemplate()) : ["Enviados","Entregues","Aberturas","Cliques","CTR","CTOR","Bounces","Descadastros","Conversões"].map(name => ({ type:"kpi", name, current:0, trend:"stable", context:"RD Email" }));
  }
};
