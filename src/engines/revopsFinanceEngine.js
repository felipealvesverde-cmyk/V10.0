// V14 — RevOps Finance Engine
// Cálculos financeiros do produto: ticket médio ponderado, G&A, EBITDA, breakeven.
// Engine puro: recebe config, retorna métricas. Não toca em App.state.
var RevopsFinanceEngine = {
  _moneyFormatter: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),

  PERIODS: [
    { id: 'monthly', label: 'Mensal', factorPerYear: 12 },
    { id: 'quarterly', label: 'Trimestral', factorPerYear: 4 },
    { id: 'yearly', label: 'Anual', factorPerYear: 1 }
  ],

  METRIC_CATALOG: {
    ticket: { label: 'Ticket Médio', unit: 'R$', direction: 'higher', scope: 'product' },
    contributionUnit: { label: 'Margem Contribuição Unit.', unit: 'R$', direction: 'higher', scope: 'product' },
    cac: { label: 'CAC Geral', unit: 'R$', direction: 'lower', scope: 'product' },
    safetyMargin: { label: 'Margem Segurança Unit.', unit: 'R$', direction: 'higher', scope: 'product' },
    breakevenSales: { label: 'Breakeven (vendas)', unit: 'un', direction: 'lower', scope: 'product' },
    realSales: { label: 'Vendas Reais', unit: 'un', direction: 'higher', scope: 'product' },
    ebitda: { label: 'EBITDA', unit: 'R$', direction: 'higher', scope: 'product' },
    ebitdaMargin: { label: 'Margem EBITDA', unit: '%', direction: 'higher', scope: 'product' },
    grossRevenue: { label: 'Receita Bruta', unit: 'R$', direction: 'higher', scope: 'product' },
    campaignCAC: { label: 'CAC da Campanha', unit: 'R$', direction: 'lower', scope: 'campaign' },
    campaignConverted: { label: 'Leads convertidos', unit: 'un', direction: 'higher', scope: 'campaign' },
    campaignLeads: { label: 'Leads impactados', unit: 'un', direction: 'higher', scope: 'campaign' },
    campaignMedia: { label: 'Mídia investida', unit: 'R$', direction: 'lower', scope: 'campaign' }
  },

  metricList(scope) {
    return Object.entries(this.METRIC_CATALOG)
      .filter(([, meta]) => meta.scope === scope)
      .map(([id, meta]) => ({ id, ...meta }));
  },

  campaignMetrics(campaignId) {
    if (!campaignId || !window.App?.state) return null;
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    if (!campaign) return null;
    const actions = (App.state.actions || []).filter(a => Number(a.campaignId) === Number(campaignId));
    let leads = 0, converted = 0;
    for (const action of actions) {
      leads += (action.leads || []).length;
      try { converted += Number(FlowResolutionEngine.buildActionFlow(action).converted || 0); }
      catch (_) {}
    }
    const media = this.number(campaign.mediaInvestment);
    return {
      leads,
      converted,
      media,
      cac: converted > 0 ? media / converted : 0
    };
  },

  getMetricValue(metricId, context = {}) {
    const meta = this.METRIC_CATALOG[metricId];
    if (!meta) return 0;
    if (meta.scope === 'product') {
      const config = App.state.revopsFinance?.[context.productId];
      if (!config) return 0;
      const dashboard = this.computeDashboard(config);
      return Number(dashboard[metricId] ?? 0);
    }
    if (meta.scope === 'campaign') {
      const metrics = this.campaignMetrics(context.campaignId);
      if (!metrics) return 0;
      if (metricId === 'campaignCAC') return metrics.cac;
      if (metricId === 'campaignConverted') return metrics.converted;
      if (metricId === 'campaignLeads') return metrics.leads;
      if (metricId === 'campaignMedia') return metrics.media;
    }
    return 0;
  },

  evaluateKeyResult(kr, context = {}) {
    const meta = this.METRIC_CATALOG[kr.metric];
    if (!meta) return { progress: 0, health: 'Atenção', current: 0, target: this.number(kr.target) };
    const current = this.getMetricValue(kr.metric, context);
    const target = this.number(kr.target);
    if (target === 0) return { progress: 0, health: 'Atenção', current, target, meta };
    let progress;
    if (meta.direction === 'lower') {
      progress = current <= target ? 100 : Math.max(0, (target / current) * 100);
    } else {
      progress = (current / target) * 100;
    }
    const clamped = Math.max(0, Math.min(999, progress));
    const health = clamped >= 100 ? 'No alvo' : clamped >= 70 ? 'Atenção' : 'Crítico';
    return { progress: clamped, health, current, target, meta };
  },

  defaultKeyResult(metricId = 'ebitda') {
    const meta = this.METRIC_CATALOG[metricId] || this.METRIC_CATALOG.ebitda;
    return { id: `kr_${Date.now()}_${Math.floor(Math.random() * 1000)}`, label: meta.label, metric: metricId, target: 0, parentKrId: null };
  },

  dashboardAlerts(productId) {
    if (!productId) return [];
    const config = App.state.revopsFinance?.[productId];
    if (!config) return [];
    const d = this.computeDashboard(config);
    const alerts = [];
    if (d.realSales > 0 && d.cac > 0 && d.safetyMargin <= 0) {
      alerts.push({ level: 'critical', metric: 'cac', title: 'CAC consumiu a contribuição unitária', insight: `CAC de ${this.money(d.cac)} ≥ contribuição unitária (${this.money(d.contributionUnit)}). Cada venda está dando prejuízo.`, suggestKr: { metric: 'cac', target: Math.max(d.contributionUnit * 0.5, 1) } });
    }
    if (d.breakevenSales !== null && d.realSales < d.breakevenSales && d.realProgress < 40) {
      alerts.push({ level: 'critical', metric: 'breakevenSales', title: 'Longe do breakeven', insight: `Você está em ${Math.round(d.realProgress)}% do breakeven. Faltam ${d.remaining} vendas para o produto começar a dar lucro.`, suggestKr: { metric: 'realSales', target: d.breakevenSales } });
    } else if (d.breakevenSales !== null && d.realSales < d.breakevenSales && d.realProgress < 70) {
      alerts.push({ level: 'attention', metric: 'breakevenSales', title: 'Breakeven em meio caminho', insight: `Você está em ${Math.round(d.realProgress)}% do breakeven. Mantenha o ritmo: faltam ${d.remaining} vendas.`, suggestKr: { metric: 'realSales', target: d.breakevenSales } });
    }
    if (d.ebitda < 0 && d.realSales > 0) {
      alerts.push({ level: 'critical', metric: 'ebitda', title: 'EBITDA negativo', insight: `Operação no vermelho: ${this.money(d.ebitda)} no período. Reveja G&A ou volume de vendas.`, suggestKr: { metric: 'ebitda', target: 0 } });
    } else if (d.ebitda >= 0 && d.ebitdaMargin < 15 && d.grossRevenue > 0) {
      alerts.push({ level: 'attention', metric: 'ebitdaMargin', title: 'Margem EBITDA apertada', insight: `Margem de ${this.percent(d.ebitdaMargin)}. Saudável fica acima de 25%.`, suggestKr: { metric: 'ebitdaMargin', target: 25 } });
    }
    return alerts;
  },

  FIXED_CATEGORIES: [
    { id: 'software', label: 'Software', icon: 'monitor', description: 'SaaS, ferramentas e licenças.' },
    { id: 'people', label: 'Pessoas (RH)', icon: 'users', description: 'Salários, encargos, freelas e parceiros fixos.' },
    { id: 'structure', label: 'Estrutura', icon: 'home', description: 'Sede, infraestrutura, contas operacionais.' },
    { id: 'others', label: 'Outros fixos', icon: 'package', description: 'Demais custos recorrentes do produto.' }
  ],

  VARIABLE_APPLIES_TO: [
    { id: 'grossRevenue', label: 'Sobre Receita Bruta', shortLabel: 'Receita Bruta', explanation: 'Desconta na receita antes de calcular a líquida (impostos, taxas de gateway).' },
    { id: 'netRevenue', label: 'Sobre Receita Líquida', shortLabel: 'Receita Líquida', explanation: 'Aplica depois de descontar custos sobre receita bruta (royalties, comissões).' },
    { id: 'afterFixed', label: 'Depois do G&A (sobre lucro)', shortLabel: 'Pós G&A', explanation: 'Aplica em cima do que sobrou após pagar o fixo (impostos sobre lucro, repasses).' }
  ],

  TICKET_MODES: [
    { id: 'weighted', label: 'Ponderado pelo mix', shortLabel: 'Ponderado', description: 'TM = média ponderada das ofertas pelo mix de vendas.' },
    { id: 'manual', label: 'Manual', shortLabel: 'Manual', description: 'Você define o valor fixo do Ticket Médio diretamente.' },
    { id: 'sumSelected', label: 'Soma das ofertas marcadas', shortLabel: 'Soma marcadas', description: 'TM = soma do preço de cada oferta que você marcar.' }
  ],

  defaultConfig(productId = null) {
    return {
      productId,
      period: 'monthly',
      salesProjection: 0,
      offers: [],
      ticketMode: 'weighted',
      ticketManualValue: 0,
      fixedCosts: {
        software: { items: [] },
        people: { items: [] },
        structure: { items: [] },
        others: { items: [] }
      },
      variableCosts: [],
      acquisitionCosts: { items: [] },
      scenarios: [],
      savedAt: null
    };
  },

  emptyOffer(name = '') {
    return { id: `offer_${Date.now()}_${Math.floor(Math.random() * 1000)}`, name, price: 0, mix: 0, selectedForTicket: false };
  },

  emptyFixedItem(name = '') {
    return { id: `fx_${Date.now()}_${Math.floor(Math.random() * 1000)}`, name, value: 0 };
  },

  emptyAcquisitionItem(name = '') {
    return { id: `acq_${Date.now()}_${Math.floor(Math.random() * 1000)}`, name, value: 0 };
  },

  emptyVariableCost(name = '') {
    return { id: `vc_${Date.now()}_${Math.floor(Math.random() * 1000)}`, name, type: 'percent', value: 0, appliesTo: 'grossRevenue' };
  },

  number(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const clean = String(value || '').replace(/R\$/g, '').replace(/%/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
    const parsed = Number(clean);
    return Number.isFinite(parsed) ? parsed : 0;
  },

  money(value) {
    return this._moneyFormatter.format(this.number(value));
  },

  percent(value, decimals = 1) {
    const n = this.number(value);
    const factor = Math.pow(10, decimals);
    return `${Math.round(n * factor) / factor}%`;
  },

  _normalizeFixedCategory(raw, defaultLabel) {
    if (raw && Array.isArray(raw.items)) {
      return {
        items: raw.items.map(item => ({
          id: item.id || `fx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          name: String(item.name || '').trim(),
          value: this.number(item.value)
        }))
      };
    }
    if (typeof raw === 'number' && raw > 0) {
      return { items: [{ id: `fx_legacy_${Math.floor(Math.random() * 1000)}`, name: defaultLabel || 'Total', value: raw }] };
    }
    return { items: [] };
  },

  _normalizeVariableCosts(raw) {
    if (Array.isArray(raw)) {
      return raw.map(item => ({
        id: item.id || `vc_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: String(item.name || '').trim(),
        type: ['percent', 'fixed'].includes(item.type) ? item.type : 'percent',
        value: this.number(item.value),
        appliesTo: ['grossRevenue', 'netRevenue', 'afterFixed'].includes(item.appliesTo) ? item.appliesTo : 'grossRevenue'
      }));
    }
    if (raw && typeof raw === 'object') {
      const list = [];
      if (raw.taxes !== undefined && this.number(raw.taxes) > 0) list.push({ id: 'vc_legacy_taxes', name: 'Impostos', type: 'percent', value: this.number(raw.taxes), appliesTo: 'grossRevenue' });
      if (raw.partner !== undefined && this.number(raw.partner) > 0) list.push({ id: 'vc_legacy_partner', name: 'Parceiro / Shooting House', type: 'percent', value: this.number(raw.partner), appliesTo: 'grossRevenue' });
      return list;
    }
    return [];
  },

  normalize(config = {}, productId = null) {
    const base = this.defaultConfig(productId);
    const raw = config && typeof config === 'object' ? config : {};
    return {
      ...base,
      ...raw,
      productId: productId ?? raw.productId ?? null,
      period: ['monthly', 'quarterly', 'yearly'].includes(raw.period) ? raw.period : base.period,
      salesProjection: this.number(raw.salesProjection),
      offers: Array.isArray(raw.offers) ? raw.offers.map(offer => ({
        id: offer.id || this.emptyOffer().id,
        name: String(offer.name || '').trim(),
        price: this.number(offer.price),
        mix: this.number(offer.mix),
        selectedForTicket: Boolean(offer.selectedForTicket)
      })) : [],
      ticketMode: ['weighted', 'manual', 'sumSelected'].includes(raw.ticketMode) ? raw.ticketMode : 'weighted',
      ticketManualValue: this.number(raw.ticketManualValue),
      fixedCosts: {
        software: this._normalizeFixedCategory(raw.fixedCosts?.software, 'Software'),
        people: this._normalizeFixedCategory(raw.fixedCosts?.people, 'Pessoas'),
        structure: this._normalizeFixedCategory(raw.fixedCosts?.structure, 'Estrutura'),
        others: this._normalizeFixedCategory(raw.fixedCosts?.others, 'Outros fixos')
      },
      variableCosts: this._normalizeVariableCosts(raw.variableCosts),
      acquisitionCosts: this._normalizeFixedCategory(raw.acquisitionCosts, 'Aquisição'),
      scenarios: Array.isArray(raw.scenarios) ? raw.scenarios : []
    };
  },

  acquisitionTotal(config = {}) {
    return this.fixedCategoryTotal(config.acquisitionCosts);
  },

  computeTicket(config = {}) {
    const offers = Array.isArray(config.offers) ? config.offers : [];
    const mode = ['weighted', 'manual', 'sumSelected'].includes(config.ticketMode) ? config.ticketMode : 'weighted';
    if (mode === 'manual') return this.number(config.ticketManualValue);
    if (mode === 'sumSelected') {
      let sum = 0;
      for (const offer of offers) {
        if (offer.selectedForTicket) sum += this.number(offer.price);
      }
      return sum;
    }
    return this.weightedTicket(offers);
  },

  weightedTicket(offers = []) {
    if (!offers.length) return 0;
    let totalMix = 0;
    for (const offer of offers) totalMix += this.number(offer.mix);
    if (totalMix <= 0) {
      let sum = 0;
      for (const offer of offers) sum += this.number(offer.price);
      return sum / offers.length;
    }
    let weighted = 0;
    for (const offer of offers) weighted += this.number(offer.price) * (this.number(offer.mix) / totalMix);
    return weighted;
  },

  fixedCategoryTotal(category) {
    if (!category || !Array.isArray(category.items)) return 0;
    let sum = 0;
    for (const item of category.items) sum += this.number(item.value);
    return sum;
  },

  totalFixedCosts(fixedCosts = {}) {
    return this.fixedCategoryTotal(fixedCosts.software)
      + this.fixedCategoryTotal(fixedCosts.people)
      + this.fixedCategoryTotal(fixedCosts.structure)
      + this.fixedCategoryTotal(fixedCosts.others);
  },

  totalVariablePercent(variableCosts = []) {
    if (!Array.isArray(variableCosts)) return 0;
    let pct = 0;
    for (const item of variableCosts) {
      if (item.type === 'percent') pct += this.number(item.value);
    }
    return pct;
  },

  sumDeductions(base, items) {
    if (!Array.isArray(items) || items.length === 0) return 0;
    let total = 0;
    for (const item of items) {
      if (item.type === 'percent') total += base * (this.number(item.value) / 100);
      else total += this.number(item.value);
    }
    return total;
  },

  computeMetricsForSales(config, sales) {
    const normalized = this.normalize(config);
    const ticket = this.computeTicket(normalized);
    const fixed = this.totalFixedCosts(normalized.fixedCosts);
    const variableCosts = Array.isArray(normalized.variableCosts) ? normalized.variableCosts : [];

    const onGross = variableCosts.filter(v => v.appliesTo === 'grossRevenue');
    const onNet = variableCosts.filter(v => v.appliesTo === 'netRevenue');
    const onAfterFixed = variableCosts.filter(v => v.appliesTo === 'afterFixed');

    const grossRevenue = sales * ticket;
    const grossDeduction = this.sumDeductions(grossRevenue, onGross);
    const afterGross = grossRevenue - grossDeduction;
    const netDeduction = this.sumDeductions(afterGross, onNet);
    const netRevenue = afterGross - netDeduction;

    const ebitdaBeforeAfter = netRevenue - fixed;
    const afterFixedDeduction = this.sumDeductions(ebitdaBeforeAfter, onAfterFixed);
    const ebitda = ebitdaBeforeAfter - afterFixedDeduction;

    const variableValue = grossDeduction + netDeduction + afterFixedDeduction;
    const variablePctEffective = grossRevenue > 0 ? (variableValue / grossRevenue) * 100 : 0;

    let unitVariable = 0;
    for (const v of [...onGross, ...onNet]) {
      if (v.type === 'percent') unitVariable += ticket * (this.number(v.value) / 100);
      else if (sales > 0) unitVariable += this.number(v.value) / sales;
    }
    const contributionUnit = ticket - unitVariable;

    const breakevenSales = contributionUnit > 0 ? Math.ceil(fixed / contributionUnit) : null;
    const breakevenRevenue = breakevenSales !== null ? breakevenSales * ticket : null;
    const ebitdaMargin = grossRevenue > 0 ? (ebitda / grossRevenue) * 100 : 0;

    return {
      ticket,
      fixed,
      variablePct: variablePctEffective,
      variableValue,
      sales,
      grossRevenue,
      netRevenue,
      ebitda,
      ebitdaMargin,
      contributionUnit,
      breakevenSales,
      breakevenRevenue,
      health: ebitda >= 0 ? (ebitdaMargin >= 25 ? 'Saudável' : 'Atenção') : 'Crítico',
      breakdown: { grossDeduction, netDeduction, afterFixedDeduction, onGross, onNet, onAfterFixed }
    };
  },

  computeMetrics(config = {}) {
    return this.computeMetricsForSales(config, this.number(config.salesProjection));
  },

  buildBreakevenCurve(config, range = 10) {
    const baseMetrics = this.computeMetrics(config);
    const maxSales = Math.max(baseMetrics.sales || 0, baseMetrics.breakevenSales || 0, 10) * 1.4;
    const points = [];
    const step = maxSales / range;
    for (let i = 0; i <= range; i++) {
      const x = step * i;
      const m = this.computeMetricsForSales(config, x);
      points.push({
        sales: Math.round(x),
        revenue: m.netRevenue,
        totalCost: baseMetrics.fixed
      });
    }
    return { points, breakevenSales: baseMetrics.breakevenSales, maxSales };
  },

  productRealSales(productId) {
    if (!productId || !window.App?.state) return 0;
    const campaigns = (App.state.campaigns || []).filter(c => Number(c.productId) === Number(productId));
    const campaignIds = new Set(campaigns.map(c => Number(c.id)));
    const actions = (App.state.actions || []).filter(a => campaignIds.has(Number(a.campaignId)));
    if (!window.FlowResolutionEngine) return 0;
    let total = 0;
    for (const action of actions) {
      try { total += Number(FlowResolutionEngine.buildActionFlow(action).converted || 0); }
      catch (_) {}
    }
    return total;
  },

  productMediaInvestment(productId) {
    if (!productId || !window.App?.state) return 0;
    let total = 0;
    for (const campaign of (App.state.campaigns || [])) {
      if (Number(campaign.productId) !== Number(productId)) continue;
      if (String(campaign.status || 'Ativa').toLowerCase() !== 'ativa') continue;
      total += this.number(campaign.mediaInvestment);
    }
    const config = App.state.revopsFinance?.[productId];
    if (config?.acquisitionCosts?.items) {
      for (const item of config.acquisitionCosts.items) {
        total += this.number(item.value);
      }
    }
    return total;
  },

  computeDashboard(config = {}) {
    const normalized = this.normalize(config);
    const metrics = this.computeMetrics(normalized);
    const productId = normalized.productId;
    const realSales = productId ? this.productRealSales(productId) : 0;
    const mediaInvestment = productId ? this.productMediaInvestment(productId) : 0;
    const cac = realSales > 0 ? mediaInvestment / realSales : 0;
    const safetyMargin = metrics.contributionUnit - cac;
    const breakevenSales = metrics.breakevenSales;
    const realProgress = breakevenSales && breakevenSales > 0 ? (realSales / breakevenSales) * 100 : (realSales > 0 ? 100 : 0);
    const remaining = breakevenSales !== null ? Math.max(0, breakevenSales - realSales) : null;
    let beStatus = 'pending';
    if (breakevenSales === null) beStatus = 'invalid';
    else if (realSales >= breakevenSales) beStatus = 'reached';
    else if (realProgress >= 70) beStatus = 'close';
    else if (realProgress >= 40) beStatus = 'midway';
    else beStatus = 'far';
    return {
      ...metrics,
      realSales,
      mediaInvestment,
      cac,
      safetyMargin,
      safetyMarginPercent: metrics.contributionUnit > 0 ? (safetyMargin / metrics.contributionUnit) * 100 : 0,
      remaining,
      realProgress,
      beStatus,
      realEbitda: (realSales * metrics.ticket * (1 - metrics.variablePct / 100)) - metrics.fixed,
      cacHealth: safetyMargin > 0 ? (cac < metrics.contributionUnit * 0.4 ? 'Saudável' : 'Atenção') : 'Crítico'
    };
  },

  buildEbitdaCurve(config, points = 12) {
    const normalized = this.normalize(config);
    const metrics = this.computeMetrics(normalized);
    const realSales = this.productRealSales(normalized.productId);
    const maxSales = Math.max(metrics.sales || 0, metrics.breakevenSales || 0, realSales || 0, 10) * 1.4;
    const series = [];
    for (let i = 0; i <= points; i++) {
      const x = (maxSales / points) * i;
      const m = this.computeMetricsForSales(normalized, x);
      series.push({ sales: Math.round(x), ebitda: m.ebitda });
    }
    return { series, maxSales, breakevenSales: metrics.breakevenSales, realSales, projectedSales: metrics.sales };
  },

  scenarioSnapshot(config = {}, name = 'Cenário sem nome') {
    const normalized = this.normalize(config);
    return {
      id: `scenario_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      name: String(name || 'Cenário sem nome').trim() || 'Cenário sem nome',
      savedAt: new Date().toISOString(),
      period: normalized.period,
      salesProjection: normalized.salesProjection,
      offers: normalized.offers,
      fixedCosts: normalized.fixedCosts,
      variableCosts: normalized.variableCosts
    };
  },

  applyScenario(config, scenario) {
    const normalized = this.normalize(config);
    return {
      ...normalized,
      period: scenario.period || normalized.period,
      salesProjection: this.number(scenario.salesProjection),
      offers: Array.isArray(scenario.offers) ? scenario.offers.map(o => ({ ...o })) : normalized.offers,
      fixedCosts: { ...normalized.fixedCosts, ...(scenario.fixedCosts || {}) },
      variableCosts: { ...normalized.variableCosts, ...(scenario.variableCosts || {}) }
    };
  }
};
window.RevopsFinanceEngine = RevopsFinanceEngine;
