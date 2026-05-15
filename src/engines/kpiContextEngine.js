// V12.2 — KPI Context Engine
window.KPIContextEngine = {
  normalizeName(name = "") {
    return String(name).trim().toLowerCase();
  },
  toNumber(value) {
    const n = Number(String(value ?? 0).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  },
  normalizeKPI(kpi = {}) {
    return {
      id: kpi.id || `kpi-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "kpi",
      name: kpi.name || "KPI",
      current: this.toNumber(kpi.current ?? kpi.value ?? 0),
      trend: kpi.trend || "stable",
      context: kpi.context || kpi.note || "",
      observation: kpi.observation || kpi.note || "",
      relatedOkrId: kpi.relatedOkrId || "",
      funnelStage: kpi.funnelStage || kpi.stageId || "",
      sector: kpi.sector || "",
      campaignId: kpi.campaignId || "",
      productId: kpi.productId || ""
    };
  },
  aggregateKPIs(kpis = []) {
    const grouped = {};
    for (const raw of kpis) {
      const kpi = this.normalizeKPI(raw);
      const key = `${this.normalizeName(kpi.name)}::${kpi.sector || "global"}::${kpi.funnelStage || "global"}`;
      let bucket = grouped[key];
      if (!bucket) {
        bucket = { ...kpi, current: 0, children: [] };
        grouped[key] = bucket;
      }
      bucket.current += kpi.current;
      bucket.children.push(kpi);
    }
    return Object.values(grouped);
  },
  explainOKR({ okr = {}, kpis = [] } = {}) {
    const related = kpis.map(kpi => this.normalizeKPI(kpi)).filter(kpi => !kpi.relatedOkrId || kpi.relatedOkrId === okr.id);
    return {
      okrId: okr.id,
      okrName: okr.name,
      contextKpis: related,
      message: related.length
        ? `KPIs relacionados ajudam a explicar o desempenho do OKR ${okr.name}.`
        : `Nenhum KPI contextual vinculado ao OKR ${okr.name}.`
    };
  }
};
