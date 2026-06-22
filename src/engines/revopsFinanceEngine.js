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
          value: this.number(item.value),
          // V35.9.0 — Preserva metadados de auto-gerado (source + locked).
          // Convenção [LJ]: items criados pelo sistema (ex: '[LJ]Google ads')
          // têm source='auto-<integração>' e locked=true (sem edição manual).
          source: item.source || null,
          locked: Boolean(item.locked)
        }))
      };
    }
    if (typeof raw === 'number' && raw > 0) {
      return { items: [{ id: `fx_legacy_${Math.floor(Math.random() * 1000)}`, name: defaultLabel || 'Total', value: raw, source: null, locked: false }] };
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

  // V35.9.0 — Recalcula o item auto-gerado `[LJ]Google ads` em
  // revopsFinance[productId].acquisitionCosts.items. Lê todas as ads
  // vinculadas a Campanhas LJ daquele Produto e soma o gasto 30d.
  //
  // Comportamento:
  //   - Soma > 0: cria ou atualiza item com name='[LJ]Google ads',
  //     source='auto-google-ads', locked=true.
  //   - Soma === 0: remove o item auto se existir (todas ads desvinculadas).
  //
  // Idempotente. Chamado por linkGoogleAdsCampaignsToLj e
  // unlinkGoogleAdsCampaignFromLj após cada mudança de vínculo.
  recomputeAcquisitionAutoItem(productId, sourceKey) {
    if (!productId) return;
    if (!sourceKey) return;
    if (!window.App?.state) return;
    if (sourceKey !== 'auto-google-ads') return;       // só suportamos GAds por enquanto

    const state = App.state;
    if (!state.revopsFinance) state.revopsFinance = {};
    if (!state.revopsFinance[productId]) state.revopsFinance[productId] = this.defaultConfig(productId);
    const config = state.revopsFinance[productId];
    if (!config.acquisitionCosts) config.acquisitionCosts = { items: [] };
    if (!Array.isArray(config.acquisitionCosts.items)) config.acquisitionCosts.items = [];

    // 1. Coleta external IDs de Google Ads vinculados a Campanhas LJ deste Produto.
    const ljCampaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
    const productCampaigns = ljCampaigns.filter(c => Number(c.productId) === Number(productId));
    const linkedExternalIds = new Set();
    productCampaigns.forEach(c => (c.externalLinks?.googleAds || []).forEach(id => linkedExternalIds.add(String(id))));

    // 2. Soma cost_brl 30d das ads no cache cujos IDs batem.
    const allAds = Array.isArray(state.googleAdsCampaignsCache) ? state.googleAdsCampaignsCache : [];
    let sum = 0;
    allAds.forEach(ad => {
      if (linkedExternalIds.has(String(ad.campaign_id))) {
        sum += Number(ad.metrics_30d?.cost_brl || 0);
      }
    });
    sum = Math.round(sum * 100) / 100;   // 2 casas

    // 3. Procura item auto existente.
    const itemName = '[LJ]Google ads';
    const idx = config.acquisitionCosts.items.findIndex(it => it.source === sourceKey);

    if (sum > 0) {
      if (idx >= 0) {
        // Atualiza
        config.acquisitionCosts.items[idx].value = sum;
        config.acquisitionCosts.items[idx].name = itemName;
        config.acquisitionCosts.items[idx].source = sourceKey;
        config.acquisitionCosts.items[idx].locked = true;
      } else {
        // Cria novo
        config.acquisitionCosts.items.push({
          id: `acq_auto_gads_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          name: itemName,
          value: sum,
          source: sourceKey,
          locked: true
        });
      }
    } else {
      // Soma zero — desvinculou tudo. Remove item auto.
      if (idx >= 0) {
        config.acquisitionCosts.items.splice(idx, 1);
      }
    }
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

  // V40.11.24 — Fonte primária do CAC Realizado vira a S&M da Composição V2
  // (revopsFinanceV2.groups[bucket=acquisition]). Mesma fonte do Projetado CAC.
  // Diferença CAC Projetado vs Realizado fica no DENOMINADOR (vendas CRM vs
  // vendas Checkout), não no numerador. Google Ads pull alimenta o item
  // auto-google-ads dentro dessa S&M (V35.9.1), então Realizado reflete gasto
  // real sem cliente precisar digitar mediaInvestment manualmente nas campanhas.
  //
  // Fallback pra tenants antigos: se Composição V2 não tem bucket=acquisition
  // com items, lê de campaigns[].mediaInvestment + revopsFinance V1 (legado).
  productMediaInvestment(productId) {
    if (!productId || !window.App?.state) return 0;

    // Primário: acquisitionTotal da Composição V2 (respeita calc modes:
    // fixed, percent_self, percent_of, derived, custom_formula).
    const v2 = window.App.state.revopsFinanceV2?.[productId];
    const hasAcquisition = v2?.groups
      && v2.groups.some(g => g.bucket === 'acquisition' && Array.isArray(g.items) && g.items.length > 0);
    if (hasAcquisition && window.RevopsWhitelabelEngine?.evaluate) {
      try {
        const ev = window.RevopsWhitelabelEngine.evaluate(v2);
        if (ev && typeof ev.acquisitionTotal === 'number') return ev.acquisitionTotal;
      } catch (_) { /* fallback abaixo */ }
    }

    // Fallback legacy: campaigns[].mediaInvestment manual + revopsFinance V1
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

  // V40.9.0 — Quadro de Receita do mês (Realizado · Projetado · Meta).
  // Conceito cravado com Felipe: CRM dita timing/operação, Checkout dita
  // dinheiro confirmado. Proxy de Onda 1: hoje a fonte de "venda fechada"
  // é Hotmart approved (Checkout) pra Realizado E numerador da taxa, porque
  // o LJ ainda não tem timestamp granular de avanço Vendas BOF → CS TOF.
  // Quando RD CRM granular for plugado, troca-se a fonte aqui sem mexer
  // na UI. Achado #13 do [[demo-population-findings]] cobre o débito.
  _velocityCacheRow(productId) {
    const cache = window.App?.state?.pipelineVelocityCache;
    if (!cache || cache.loading || cache.error) return null;
    return (cache.byProduct || []).find(r => Number(r.product_id_lj) === Number(productId)) || null;
  },

  // V40.11.2 — Trocou fonte: antes contava leads em actions LJ (action.leads
  // + flow.steps[0].impacted), que descasa do numerador (Hotmart approved).
  // Resultado: taxa de conversão impossível (964,8% em demo Pilsen). Agora puxa
  // visitors únicos do tracker (mesma fonte que PipelineVelocityEngine usa).
  // Numerador (vendas Checkout) e denominador (visitors) vêm do mesmo plano
  // observacional → taxa visitor→customer nunca passa de 100%.
  // Nome mantido pra não quebrar callers; semântica passa a ser "visitas únicas".
  // Achado #13 do inventário cobre o débito de timestamp granular de avanço.
  productLeadsAlive(productId) {
    if (!productId || !window.App?.state) return 0;
    const cache = window.App.state.pipelineVelocityCache;
    if (!cache || cache.loading || cache.error) return 0;
    const campanhasDoProduto = (App.state.campaigns || [])
      .filter(c => Number(c.productId) === Number(productId))
      .map(c => Number(c.id));
    const campanhaSet = new Set(campanhasDoProduto);
    let total = 0;
    for (const row of (cache.byCampaign || [])) {
      if (campanhaSet.has(Number(row.campaign_id))) {
        total += Number(row.visitors || 0);
      }
    }
    return total;
  },

  // Vendas confirmadas no Checkout (últimos 30d). Hoje serve TANTO pro
  // Realizado QUANTO pro numerador da taxa — proxy até CRM granular.
  productConvertedCount(productId) {
    const row = this._velocityCacheRow(productId);
    return row ? Number(row.approved_count || 0) : 0;
  },

  // Taxa de conversão: vendas Checkout ÷ leads vivos. Quando ambos vêm
  // da mesma janela natural (mês corrente), conversa. Oscila quando
  // operação muda — Felipe aceitou (modo brasileiro).
  productConversionRate(productId) {
    const leadsAlive = this.productLeadsAlive(productId);
    const converted = this.productConvertedCount(productId);
    return leadsAlive > 0 ? converted / leadsAlive : 0;
  },

  // Ticket médio CRM. Proxy: hoje é o ticket médio do Checkout (Hotmart
  // approved). Quando RD CRM granular existir, vira média dos valores
  // cravados nos deals que avançaram pra CS TOF.
  productCrmTicket(productId) {
    const row = this._velocityCacheRow(productId);
    if (!row) return 0;
    const cents = Number(row.avg_value_cents || row.avg_ticket * 100 || 0);
    return cents / 100;
  },

  // V40.11.26 — TM Realizado: SUM(value_cents)/COUNT(*) das vendas Hotmart
  // approved do produto últimos 30d. Hoje é alias semântico de productCrmTicket
  // (que já lê de pipeline-velocity-summary.byProduct[].avg_ticket). Mantemos
  // os dois nomes: "crmTicket" pra calls antigas (Receita Realizada usa proxy
  // CRM), "realTicket" pra calls que querem nomear "verdade do Checkout" sem
  // ambiguidade. Quando CRM granular plugar, productCrmTicket muda fonte SEM
  // afetar este aqui (que continua sempre Checkout).
  productRealTicket(productId) {
    return this.productCrmTicket(productId);
  },

  // Realizado: soma das vendas Checkout aprovadas últimos 30d.
  productRealRevenue(productId) {
    return this.productConvertedCount(productId) * this.productCrmTicket(productId);
  },

  // V40.11.4 — Projetado vem do CRM (vendas cadenciadas no funil das actions),
  // NÃO de visitas × taxa. Fórmula anterior era tautológica por construção:
  // como conversionRate = converted/leadsAlive, então leadsAlive × conversionRate × ticket
  // sempre reduzia a convertedCount × ticket = Realizado.
  // Agora Projetado lê productRealSales (somatório de FlowResolutionEngine.buildActionFlow.converted
  // das actions do produto) × ticket CRM. Realizado segue Checkout (Hotmart approved).
  // Achado #13 do inventário: quando RD CRM granular for plugado, productRealSales muda
  // de fonte (funil das actions → deals em estágio CRM avançado) sem mexer aqui.
  productProjectedRevenue(productId) {
    return this.productRealSales(productId) * this.productCrmTicket(productId);
  },

  // Resumo consolidado pra UI consumir em 1 read, evitando 6 chamadas.
  productRevenueSummary(productId) {
    const leadsAlive = this.productLeadsAlive(productId);
    const convertedCount = this.productConvertedCount(productId);
    const crmTicket = this.productCrmTicket(productId);
    const crmProjectedSales = this.productRealSales(productId);
    const conversionRate = leadsAlive > 0 ? convertedCount / leadsAlive : 0;
    const realRevenue = convertedCount * crmTicket;
    const projectedRevenue = crmProjectedSales * crmTicket;
    const offers = App.state.revopsFinanceV2?.[productId]?.offers || [];
    const metaSales = offers.reduce((s, o) => s + (Number(o.metaVendas) || 0), 0);
    const metaRevenue = metaSales * crmTicket;
    return {
      leadsAlive,
      convertedCount,
      crmTicket,
      crmProjectedSales,
      conversionRate,
      realRevenue,
      projectedRevenue,
      metaSales,
      metaRevenue,
      sourceLabel: 'Realizado: Checkout · Projetado: funil CRM · Meta: Ofertas'
    };
  },

  // V40.11.3 — CAC summary espelho do Receita. Triangulação Realizado · Projetado · Meta.
  // Realizado: gasto real de mídia ÷ vendas Checkout aprovadas (productMediaInvestment ÷ convertedCount).
  // Projetado: CTC modelado (acquisitionTotal da composição) ÷ vendas projetadas (visitors × rate).
  // Meta: valor cravado em metasResultado pelo cliente.
  // Mesma semântica do Revenue, mas direção inversa: menor é melhor. UI lida com o sinal — engine só entrega valores.
  productCacSummary(productId) {
    if (!productId || !window.App?.state) {
      return { realCAC: 0, projectedCAC: 0, metaCAC: 0, mediaInvestment: 0, convertedCount: 0, ctcModel: 0, projectedSales: 0, sourceLabel: '' };
    }
    const now = new Date();
    const periodKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const selectedPeriod = App.state.resultadoPeriod?.[productId] || periodKey;

    const mediaInvestment = this.productMediaInvestment(productId);
    const convertedCount = this.productConvertedCount(productId);
    const realCAC = convertedCount > 0 ? mediaInvestment / convertedCount : 0;

    const cfg = App.state.revopsFinanceV2?.[productId] || {};
    let ctcModel = 0;
    try {
      ctcModel = window.RevopsWhitelabelEngine?.evaluate?.(cfg)?.acquisitionTotal || 0;
    } catch (_) {}
    // V40.11.4 — projectedSales agora vem do CRM (funil das actions), não de visitas × taxa.
    const projectedSales = this.productRealSales(productId);
    const projectedCAC = projectedSales > 0 ? ctcModel / projectedSales : 0;

    const metaCAC = Number(App.state.metasResultado?.[productId]?.[selectedPeriod]?.cac) || 0;

    return {
      realCAC,
      projectedCAC,
      metaCAC,
      mediaInvestment,
      convertedCount,
      ctcModel,
      projectedSales,
      sourceLabel: 'Mídia Ads (Real) · Composição (Proj) · Meta cravada'
    };
  },

  // V40.11.5 — Quantas vendas tivemos. Triangulação Realizado · Projetado · Meta
  // na mesma lógica de fonte do Receita, sem o multiplicador de ticket.
  // Realizado: vendas Checkout aprovadas (Hotmart approved 30d).
  // Projetado: somatório de vendas cadenciadas no funil das actions (CRM proxy).
  // Meta: soma das metaVendas das ofertas configuradas.
  productSalesSummary(productId) {
    if (!productId || !window.App?.state) {
      return { realSales: 0, projectedSales: 0, metaSales: 0, sourceLabel: '' };
    }
    const realSales = this.productConvertedCount(productId);
    const projectedSales = this.productRealSales(productId);
    const offers = App.state.revopsFinanceV2?.[productId]?.offers || [];
    const metaSales = offers.reduce((s, o) => s + (Number(o.metaVendas) || 0), 0);
    return {
      realSales,
      projectedSales,
      metaSales,
      sourceLabel: 'Realizado: Checkout · Projetado: funil CRM · Meta: Ofertas'
    };
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
