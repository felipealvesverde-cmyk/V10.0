// V12.4 — Revenue OKR/KPI Engine
// Conecta Produto → Campanha → Ação → Leads → Receita → KPI → OKR.
var RevenueOKRKPIEngine = {
  _moneyFormatter: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),
  _moneyMetrics: new Set(['revenue', 'grossProfit', 'mrr']),
  number(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const clean = String(value || '')
      .replace(/R\$/g, '')
      .replace(/%/g, '')
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^0-9.-]/g, '');
    const parsed = Number(clean);
    return Number.isFinite(parsed) ? parsed : 0;
  },
  money(value) {
    return this._moneyFormatter.format(Number(value || 0));
  },
  percent(value) {
    return `${Math.round(Number(value || 0) * 10) / 10}%`;
  },
  productCampaigns(productId) {
    const key = Number(productId);
    return (App.state.campaigns || []).filter(c => Number(c.productId) === key);
  },
  campaignActions(campaignId) {
    const key = Number(campaignId);
    return (App.state.actions || []).filter(a => Number(a.campaignId) === key);
  },
  productActions(productId) {
    const ids = new Set(this.productCampaigns(productId).map(c => Number(c.id)));
    return (App.state.actions || []).filter(a => ids.has(Number(a.campaignId)));
  },
  actionConverted(action) {
    try { return Number(FlowResolutionEngine.buildActionFlow(action).converted || 0); }
    catch (e) { return Math.round((action.leads || []).length * (Number(action.expectedConversion || 0) / 100)); }
  },
  actionKpis(action) {
    const leads = (action.leads || []).length;
    const converted = this.actionConverted(action);
    const opportunities = Math.round(converted * 0.28);
    const conversion = leads ? (converted / leads) * 100 : 0;
    return { leads, converted, opportunities, conversion };
  },
  productKpis(productId) {
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    if (!product) return null;
    const campaigns = this.productCampaigns(productId);
    const actions = this.productActions(productId);
    const price = this.number(product.price);
    const cost = this.number(product.operationalCost);
    const unitProfit = Math.max(price - cost, 0);
    let leads = 0, converted = 0, opportunities = 0;
    for (const action of actions) {
      leads += (action.leads || []).length;
      const c = this.actionConverted(action);
      converted += c;
      opportunities += Math.round(c * 0.28);
    }
    const revenue = converted * price;
    const grossProfit = converted * unitProfit;
    const margin = price ? (unitProfit / price) * 100 : 0;
    const conversion = leads ? (converted / leads) * 100 : 0;
    const mrr = String(product.revenueModel || '').toLowerCase().includes('recorr') ? revenue : 0;
    return { product, campaigns, actions, price, cost, unitProfit, margin, leads, converted, opportunities, conversion, revenue, grossProfit, mrr };
  },
  globalKpis() {
    const products = App.state.products || [];
    const acc = { products: 0, campaigns: 0, actions: 0, leads: 0, converted: 0, opportunities: 0, conversion: 0, revenue: 0, grossProfit: 0, mrr: 0 };
    for (const product of products) {
      const row = this.productKpis(product.id);
      if (!row) continue;
      acc.products += 1;
      acc.campaigns += row.campaigns.length;
      acc.actions += row.actions.length;
      acc.leads += row.leads;
      acc.converted += row.converted;
      acc.opportunities += row.opportunities;
      acc.revenue += row.revenue;
      acc.grossProfit += row.grossProfit;
      acc.mrr += row.mrr;
    }
    return acc;
  },
  kpiValue(kpi) {
    const scope = kpi.scope || 'global';
    const data = (scope === 'product' && kpi.productId) ? this.productKpis(kpi.productId) : this.globalKpis();
    if (!data) return 0;
    const key = kpi.metric || kpi.key || 'revenue';
    switch (key) {
      case 'revenue': return Number(data.revenue || 0);
      case 'grossProfit': return Number(data.grossProfit || 0);
      case 'mrr': return Number(data.mrr || 0);
      case 'leads': return Number(data.leads || 0);
      case 'converted': return Number(data.converted || 0);
      case 'opportunities': return Number(data.opportunities || 0);
      case 'conversion': return Number(data.leads ? (data.converted / data.leads) * 100 : data.conversion || 0);
      case 'campaigns': return Number(data.campaigns?.length ?? data.campaigns ?? 0);
      case 'actions': return Number(data.actions?.length ?? data.actions ?? 0);
      default: return 0;
    }
  },
  normalizeKpi(kpi = {}, index = 0) {
    const target = this.number(kpi.target ?? kpi.goal ?? 0);
    const current = kpi.manualCurrent !== undefined && kpi.manualCurrent !== '' ? this.number(kpi.manualCurrent) : this.kpiValue(kpi);
    const progress = target ? Math.min(999, (current / target) * 100) : 0;
    return {
      id: kpi.id || `kpi_${Date.now()}_${index}`,
      name: kpi.name || 'KPI de receita',
      metric: kpi.metric || 'revenue',
      scope: kpi.scope || 'global',
      productId: kpi.productId || null,
      target,
      current,
      unit: kpi.unit || (this._moneyMetrics.has(kpi.metric) ? 'R$' : kpi.metric === 'conversion' ? '%' : 'un'),
      frequency: kpi.frequency || 'Semanal',
      source: kpi.source || 'Automático pelo Revenue Engine',
      relatedOkrId: kpi.relatedOkrId || null,
      progress,
      health: progress >= 100 ? 'No alvo' : progress >= 70 ? 'Atenção' : 'Crítico'
    };
  },
  normalizeOkr(okr = {}, index = 0) {
    const target = this.number(okr.target ?? okr.goal ?? 0);
    const linked = (App.state.operationalKpis || []).filter(k => k.relatedOkrId === okr.id).map((k, i) => this.normalizeKpi(k, i));
    const current = linked.length ? linked.reduce((sum, k) => sum + k.current, 0) : this.number(okr.current || 0);
    const progress = target ? Math.min(999, (current / target) * 100) : 0;
    return {
      id: okr.id || `okr_${Date.now()}_${index}`,
      name: okr.name || 'OKR estratégico',
      objective: okr.objective || okr.name || 'Objetivo estratégico',
      keyResult: okr.keyResult || 'Resultado-chave',
      target,
      current,
      unit: okr.unit || 'R$',
      owner: okr.owner || '',
      deadline: okr.deadline || '',
      status: okr.status || (progress >= 100 ? 'Concluído' : progress >= 70 ? 'Em andamento' : 'Em risco'),
      progress,
      linkedKpis: linked
    };
  },
  scaleOkr(okr) {
    const enriched = this.normalizeOkr(okr);
    const products = (App.state.products || []).map(p => this.productKpis(p.id)).filter(Boolean);
    const totalWeight = products.reduce((sum, p) => sum + Math.max(p.revenue, p.price, 1), 0) || products.length || 1;
    return products.map(p => {
      const weight = Math.max(p.revenue, p.price, 1) / totalWeight;
      const target = Math.round(enriched.target * weight);
      const gap = Math.max(target - p.revenue, 0);
      const salesNeeded = p.price ? Math.ceil(gap / p.price) : 0;
      return { productId: p.product.id, productName: p.product.name, target, current: p.revenue, gap, salesNeeded, campaigns: p.campaigns.length, actions: p.actions.length };
    });
  },
  revopsAlerts() {
    const alerts = [];
    const linkedKpis = App.state.operationalKpis || [];
    const okrLinkCount = new Map();
    for (const kpi of linkedKpis) {
      if (kpi.relatedOkrId) okrLinkCount.set(kpi.relatedOkrId, (okrLinkCount.get(kpi.relatedOkrId) || 0) + 1);
    }
    for (const product of (App.state.products || [])) {
      const p = this.productKpis(product.id);
      if (!p) continue;
      if (!p.campaigns.length) alerts.push(`Produto ${product.name} ainda não possui campanha vinculada.`);
      if (p.margin < 35 && p.price) alerts.push(`Produto ${product.name} tem margem estimada baixa (${this.percent(p.margin)}).`);
      if (p.campaigns.length && !p.actions.length) alerts.push(`Produto ${product.name} possui campanha, mas ainda não tem ações executáveis.`);
      if (p.leads > 0 && p.conversion < 5) alerts.push(`Produto ${product.name} tem baixa conversão consolidada (${this.percent(p.conversion)}).`);
    }
    for (const okr of (App.state.strategicOkrs || [])) {
      if (!okrLinkCount.get(okr.id)) alerts.push(`OKR ${okr.name || okr.objective} ainda não possui KPI vinculado.`);
    }
    return alerts.slice(0, 8);
  }
};
window.RevenueOKRKPIEngine = RevenueOKRKPIEngine;
