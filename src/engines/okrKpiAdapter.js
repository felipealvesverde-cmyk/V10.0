// V12.2 — OKR/KPI Compatibility Adapter
window.OKRKPIAdapter = {
  classifyMetric(metric = {}) {
    const explicit = String(metric.type || metric.kind || "").toLowerCase();
    if (explicit === "kpi") return "kpi";
    if (explicit === "okr") return "okr";
    if (metric.projected !== undefined || metric.projection !== undefined || metric.goal !== undefined || metric.target !== undefined) return "okr";
    return "kpi";
  },
  splitMetrics(items = []) {
    const okrs = [];
    const kpis = [];
    items.forEach(item => {
      if (this.classifyMetric(item) === "okr") okrs.push({ ...item, type: "okr" });
      else kpis.push({ ...item, type: "kpi" });
    });
    return { okrs, kpis };
  },
  normalizeAction(action = {}) {
    const legacy = action.metrics || action.okrs || [];
    const split = this.splitMetrics(legacy);
    return {
      ...action,
      okrs: (action.okrsSeparated || action.strategicOkrs || split.okrs || []).map(item => ({ ...item, type: "okr" })),
      kpis: (action.kpis || action.contextKpis || split.kpis || []).map(item => ({ ...item, type: "kpi" }))
    };
  }
};
