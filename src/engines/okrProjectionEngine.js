// V12.2 — OKR Projection Engine
window.OKRProjectionEngine = {
  normalizeName(name = "") {
    return String(name).trim().toLowerCase();
  },
  toNumber(value) {
    const n = Number(String(value ?? 0).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  },
  calculateGap(projected, current) {
    const p = this.toNumber(projected);
    const c = this.toNumber(current);
    if (!p) return 0;
    return ((c - p) / p) * 100;
  },
  trendFromGap(gap) {
    if (gap >= 0) return "ahead";
    if (gap >= -10) return "attention";
    return "behind";
  },
  enrichOKR(okr = {}) {
    const projected = this.toNumber(okr.projected ?? okr.projection ?? okr.goal ?? okr.target ?? 0);
    const current = this.toNumber(okr.current ?? okr.actual ?? 0);
    const gap = this.calculateGap(projected, current);
    return {
      id: okr.id || `okr-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: "okr",
      name: okr.name || "OKR",
      projected,
      current,
      gap,
      trend: okr.trend || this.trendFromGap(gap),
      impact: okr.impact || "strategic",
      funnelStage: okr.funnelStage || okr.stageId || "",
      sector: okr.sector || "",
      campaignId: okr.campaignId || "",
      productId: okr.productId || ""
    };
  },
  aggregateOKRs(okrs = []) {
    const grouped = {};
    for (const raw of okrs) {
      const okr = this.enrichOKR(raw);
      const key = `${this.normalizeName(okr.name)}::${okr.sector || "global"}::${okr.funnelStage || "global"}`;
      let bucket = grouped[key];
      if (!bucket) {
        bucket = { ...okr, projected: 0, current: 0, children: [] };
        grouped[key] = bucket;
      }
      bucket.projected += okr.projected;
      bucket.current += okr.current;
      bucket.children.push(okr);
    }
    const result = [];
    for (const item of Object.values(grouped)) {
      const gap = this.calculateGap(item.projected, item.current);
      result.push({ ...item, gap, trend: this.trendFromGap(gap) });
    }
    return result;
  },
  cascade({ actions = [] } = {}) {
    const allOkrs = actions.flatMap(action =>
      (action.okrs || []).map(okr => ({
        ...okr,
        actionId: action.id,
        campaignId: okr.campaignId || action.campaignId,
        productId: okr.productId || action.productId,
        sector: okr.sector || action.sector,
        funnelStage: okr.funnelStage || action.funnelStage || action.originStage
      }))
    );
    return {
      action: actions.map(action => ({ actionId: action.id, okrs: this.aggregateOKRs(action.okrs || []) })),
      funnel: this.aggregateOKRs(allOkrs),
      raw: allOkrs.map(okr => this.enrichOKR(okr))
    };
  }
};
