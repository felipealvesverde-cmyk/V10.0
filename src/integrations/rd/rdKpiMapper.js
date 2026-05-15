
window.RDKpiMapper = {
  _canonical: [
    { key:"sent", name:"Enviados", rdFields:["sent","sent_count","emails_sent"], formula:"valor direto RD", direction:"higher_is_better" },
    { key:"delivered", name:"Entregues", rdFields:["delivered","delivered_count","emails_delivered"], formula:"valor direto RD", direction:"higher_is_better" },
    { key:"opens", name:"Aberturas", rdFields:["opens","open_count","opened","unique_opens"], formula:"valor direto RD", direction:"higher_is_better" },
    { key:"clicks", name:"Cliques", rdFields:["clicks","click_count","clicked","unique_clicks"], formula:"valor direto RD", direction:"higher_is_better" },
    { key:"ctr", name:"CTR", rdFields:["ctr","click_rate"], formula:"Cliques ÷ Entregues × 100", direction:"higher_is_better", derived:true },
    { key:"ctor", name:"CTOR", rdFields:["ctor","click_to_open_rate"], formula:"Cliques ÷ Aberturas × 100", direction:"higher_is_better", derived:true },
    { key:"bounces", name:"Bounces", rdFields:["bounces","bounce_count","bounced"], formula:"valor direto RD", direction:"lower_is_better" },
    { key:"unsubscribes", name:"Descadastros", rdFields:["unsubscribes","unsubscribe_count","unsubscribed"], formula:"valor direto RD", direction:"lower_is_better" },
    { key:"conversions", name:"Conversões", rdFields:["conversions","conversion_count","converted"], formula:"valor direto RD/eventos atribuídos", direction:"higher_is_better" }
  ],
  canonicalKpis() { return this._canonical; },
  emptyStatsTemplate() {
    return { sent:0, delivered:0, opens:0, clicks:0, bounces:0, unsubscribes:0, conversions:0 };
  },
  toNumber(v) {
    if (v === null || v === undefined || v === "") return 0;
    const n = Number(String(v).replace("%","").replace(",",".").trim());
    return Number.isFinite(n) ? n : 0;
  },
  pick(stats, fields) {
    for (const f of fields) {
      const value = stats[f];
      if (value !== undefined && value !== null && value !== "") return this.toNumber(value);
    }
    return null;
  },
  mapStatsToKpis(stats = {}, existingKpis = []) {
    const canonical = this._canonical;
    const values = {};
    for (const k of canonical) values[k.key] = this.pick(stats, k.rdFields) ?? 0;
    values.ctr = this.pick(stats, ["ctr","click_rate"]) ?? (values.delivered ? (values.clicks / values.delivered) * 100 : 0);
    values.ctor = this.pick(stats, ["ctor","click_to_open_rate"]) ?? (values.opens ? (values.clicks / values.opens) * 100 : 0);

    const existingByName = new Map((existingKpis || []).map(k => [String(k.name || "").toLowerCase(), k]));
    const updatedAt = new Date().toISOString();
    return canonical.map(k => {
      const old = existingByName.get(k.name.toLowerCase()) || {};
      const current = Math.round((values[k.key] || 0) * 100) / 100;
      return {
        ...old,
        id: old.id || `rd_kpi_${k.key}`,
        type: "kpi",
        provider: "RD Station",
        source: "RD Email",
        key: k.key,
        name: k.name,
        current,
        trend: old.trend || (current > 0 ? "up" : "stable"),
        context: old.context || `KPI operacional de RD Email: ${k.name}`,
        formula: k.formula,
        direction: k.direction,
        updatedAt
      };
    });
  },
  ensureActionKpis(action = {}) {
    return this.mapStatsToKpis(action.rdEmailStats || this.emptyStatsTemplate(), action.kpis || []);
  },
  applyToAction(action = {}, stats = {}) {
    const rdEmailStats = { ...(action.rdEmailStats || {}), ...(stats || {}) };
    return { ...action, rdEmailStats, kpis: this.mapStatsToKpis(rdEmailStats, action.kpis || []) };
  }
};
