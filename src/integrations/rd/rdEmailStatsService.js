
window.RDEmailStatsService = {
  buildCandidateEndpoints(action = {}) {
    const cfg = action.rdEmailConfig || {};
    const id = encodeURIComponent(cfg.emailCampaignId || cfg.emailCampaignName || "");
    return [
      `/email_marketing/campaigns/${id}/statistics`,
      `/email_marketing/campaigns/${id}/stats`,
      `/emails/${id}/statistics`,
      `/emails/${id}/stats`
    ];
  },
  normalizeStatsPayload(payload = {}) {
    const data = payload?.data || payload || {};
    return {
      sent: data.sent ?? data.sent_count ?? data.emails_sent ?? data.total_sent ?? 0,
      delivered: data.delivered ?? data.delivered_count ?? data.emails_delivered ?? data.total_delivered ?? data.sent ?? 0,
      opens: data.opens ?? data.open_count ?? data.opened ?? data.unique_opens ?? 0,
      clicks: data.clicks ?? data.click_count ?? data.clicked ?? data.unique_clicks ?? 0,
      bounces: data.bounces ?? data.bounce_count ?? data.bounced ?? 0,
      unsubscribes: data.unsubscribes ?? data.unsubscribe_count ?? data.unsubscribed ?? 0,
      conversions: data.conversions ?? data.conversion_count ?? data.converted ?? 0,
      ctr: data.ctr ?? data.click_rate ?? undefined,
      ctor: data.ctor ?? data.click_to_open_rate ?? undefined
    };
  },
  mockStatsFromAction(action = {}) {
    const base = action.rdEmailStats || {};
    const leads = Array.isArray(action.leads) ? action.leads.length : 0;
    return {
      sent: Number(base.sent ?? leads ?? 0),
      delivered: Number(base.delivered ?? Math.round((leads || 0) * 0.94)),
      opens: Number(base.opens ?? Math.round((leads || 0) * 0.32)),
      clicks: Number(base.clicks ?? Math.round((leads || 0) * 0.08)),
      bounces: Number(base.bounces ?? Math.round((leads || 0) * 0.02)),
      unsubscribes: Number(base.unsubscribes ?? Math.round((leads || 0) * 0.005)),
      conversions: Number(base.conversions ?? Math.round((leads || 0) * 0.025))
    };
  },
  async fetchStats(action = {}) {
    if (!window.RDMapper?.isRDEmailAction?.(action)) return { ok:false, message:"Ação não é RD Email." };
    const cfg = action.rdEmailConfig || {};
    if (!cfg.emailCampaignId && !cfg.emailCampaignName) return { ok:false, message:"Informe a campanha de e-mail RD na ação." };
    if (!window.RDApiClient?.hasAccessToken?.()) return { ok:true, dryRun:true, stats:this.mockStatsFromAction(action), message:"Sem Access Token RD. Usando fallback local/manual." };

    const attempts = [];
    for (const endpoint of this.buildCandidateEndpoints(action)) {
      const result = await RDApiClient.request(endpoint, { method:"GET" });
      attempts.push({ endpoint, ok: result.ok, status: result.status });
      if (result.ok) return { ok:true, endpoint, stats:this.normalizeStatsPayload(result.data), raw:result.data, attempts, message:"Estatísticas RD sincronizadas." };
    }
    return { ok:false, attempts, stats:this.mockStatsFromAction(action), message:"Não foi possível consultar estatísticas RD. Mantido fallback local/manual." };
  }
};
