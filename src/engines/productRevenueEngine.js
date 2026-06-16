var ProductRevenueEngine = {
  _moneyFormatter: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),

  parseMoney(value) {
    if (typeof value === 'number') return value;
    const raw = String(value || '').trim();
    if (!raw) return 0;
    const cleaned = raw
      .replace(/R\$/gi, '')
      .replace(/\s/g, '')
      .replace(/\./g, '')
      .replace(',', '.')
      .replace(/[^0-9.-]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  },

  formatMoney(value) {
    return this._moneyFormatter.format(Number(value || 0));
  },

  recurrenceLabel(value) {
    const raw = String(value || '').toLowerCase();
    if (raw.includes('rec') || raw.includes('mensal')) return 'Recorrente';
    return value || 'Venda única';
  },

  isRecurring(product) {
    return String(product?.revenueModel || product?.recurrence || '').toLowerCase().includes('rec');
  },

  defaultOkrs() {
    return [
      { name: 'Receita por produto', target: 'Definir meta', current: '0', unit: 'R$', health: 'Atenção' },
      { name: 'Margem operacional', target: 'Definir meta', current: '0', unit: '%', health: 'Atenção' },
      { name: 'Campanhas vinculadas', target: '1', current: '0', unit: 'campanha', health: 'Atenção' }
    ];
  },

  normalize(product = {}, index = 0) {
    const price = product.price || product.ticket || '';
    const operationalCost = product.operationalCost || product.cost || '';
    const priceValue = this.parseMoney(price);
    const costValue = this.parseMoney(operationalCost);
    const unitProfit = Math.max(priceValue - costValue, 0);
    const marginPercent = priceValue > 0 ? Math.round((unitProfit / priceValue) * 100) : 0;
    const revenueModel = this.recurrenceLabel(product.revenueModel || product.recurrence || product.billingModel || 'Venda única');
    const recurring = revenueModel.toLowerCase().includes('rec');
    const priceLabel = this.formatMoney(priceValue);

    return {
      id: product.id || Date.now() + index,
      name: product.name || 'Produto sem nome',
      type: product.type || product.category || 'Produto principal',
      price: price || 'R$ 0',
      revenueModel,
      operationalCost: operationalCost || 'R$ 0',
      status: product.status || 'Ativo',
      priceValue,
      operationalCostValue: costValue,
      unitProfit,
      marginPercent,
      grossMargin: `${marginPercent}%`,
      mrr: recurring ? priceLabel : 'R$ 0',
      arr: recurring ? this.formatMoney(priceValue * 12) : priceLabel,
      revenueScore: product.revenueScore || Math.min(100, Math.max(20, Math.round((marginPercent * 0.7) + (recurring ? 20 : 10)))),
      healthScore: product.healthScore || Math.min(100, Math.max(20, Math.round((marginPercent * 0.8) + (priceValue > costValue ? 12 : 0)))),
      okrs: Array.isArray(product.okrs) && product.okrs.length ? product.okrs : this.defaultOkrs(),
      audience: (() => {
        const a = product.audience && typeof product.audience === 'object' ? product.audience : {};
        const cf = (a.customFields && typeof a.customFields === 'object') ? a.customFields : {};
        return {
          configured: !!a.configured,
          modeloNegocio: a.modeloNegocio || null,
          modeloOperacional: a.modeloOperacional || null,
          schema: a.schema && typeof a.schema === 'object' ? a.schema : null,
          customized: !!a.customized,
          customFields: {
            pa:  Array.isArray(cf.pa)  ? cf.pa  : [],
            icp: Array.isArray(cf.icp) ? cf.icp : [],
            bp:  Array.isArray(cf.bp)  ? cf.bp  : []
          },
          quadroPA: Array.isArray(a.quadroPA) ? a.quadroPA : [],
          quadroICP: Array.isArray(a.quadroICP) ? a.quadroICP : [],
          quadroBP: Array.isArray(a.quadroBP) ? a.quadroBP : []
        };
      })(),
      createdAt: product.createdAt || new Date().toISOString()
    };
  },

  summary(productId) {
    const product = App.state.products.find(p => String(p.id) === String(productId)) || App.state.products[0];
    const metrics = OperationalAggregationEngine.productMetrics(product?.id);
    return { product, ...metrics };
  }
};
window.ProductRevenueEngine = ProductRevenueEngine;
