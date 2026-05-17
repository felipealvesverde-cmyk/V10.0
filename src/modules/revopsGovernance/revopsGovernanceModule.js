// V14 — RevOps & Governança: tela principal.
// Dropdown de produto + cards editáveis + métricas + entradas para Simulação e Cenários Salvos.
var RevopsGovernanceModule = {
  render() {
    const products = App.state.products || [];
    if (!products.length) return this._emptyState();
    const productId = this._currentProductId();
    const config = this._currentConfig(productId);
    const metrics = RevopsFinanceEngine.computeMetrics(config);
    return `<div class="space-y-4">
      ${this._hero(productId, products, config)}
      ${this._metricsStrip(metrics, config)}
      ${window.RevopsPinkDashboard ? RevopsPinkDashboard.render(config) : ''}
      ${window.RevopsImpactMap ? RevopsImpactMap.render(productId) : ''}
      <div class="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        ${this._offersCard(config, metrics)}
        ${this._fixedCostsCard(config, metrics)}
        ${this._variableCostsCard(config, metrics)}
        ${this._acquisitionCard(config, metrics)}
      </div>
      ${this._operationalControls(config)}
      ${this._strategicMapBlock(productId, metrics, config)}
      ${window.RevopsSimulationModal ? RevopsSimulationModal.render() : ''}
      ${window.RevopsScenariosModal ? RevopsScenariosModal.render() : ''}
      ${window.RevopsScenarioNameModal ? RevopsScenarioNameModal.render() : ''}
      ${window.RevopsOkrModal ? RevopsOkrModal.render() : ''}
      ${window.RevopsFixedCostsModal ? RevopsFixedCostsModal.render() : ''}
      ${window.RevopsAcquisitionCostsModal ? RevopsAcquisitionCostsModal.render() : ''}
    </div>`;
  },

  _acquisitionCard(config, metrics) {
    const items = config.acquisitionCosts?.items || [];
    const totalCost = items.reduce((sum, item) => sum + RevopsFinanceEngine.number(item.value), 0);
    const realSales = RevopsFinanceEngine.productRealSales(config.productId);
    const ticket = metrics.ticket;
    const realRevenue = realSales * ticket;
    const summary = items.length === 0
      ? 'Nenhuma origem cadastrada'
      : items.slice(0, 2).map(item => Utils.escape(item.name || 'Sem nome')).join(', ') + (items.length > 2 ? ` +${items.length - 2}` : '');
    return `<div class="bg-sky-50 rounded-3xl p-5 shadow-sm border border-sky-200">
      <div class="flex items-start justify-between gap-3 mb-1">
        <div>
          <div class="flex items-center gap-2"><i data-lucide="target" class="w-4 h-4 text-sky-700"></i><h3 class="font-black text-lg text-sky-900">Custo de Aquisição</h3></div>
          <p class="text-xs text-sky-800/80 mt-1 max-w-md">Plataformas e mídia paga que trazem clientes: Google Ads, Meta Ads, RD Station, Hotmart etc.</p>
        </div>
        <button onclick="Actions.openRevopsAcquisitionModal()" class="px-3 py-2 rounded-xl bg-sky-600 text-white text-xs font-black hover:bg-sky-700 whitespace-nowrap">Gerenciar →</button>
      </div>

      <button onclick="Actions.openRevopsAcquisitionModal()" class="w-full mt-3 rounded-2xl bg-white border border-sky-200 hover:bg-sky-50 hover:border-sky-300 transition p-3 text-left">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0">
            <p class="text-[11px] font-black text-sky-700 uppercase">Origens</p>
            <p class="text-xs text-sky-700/80 truncate">${summary}</p>
          </div>
          <p class="text-base font-black text-sky-900 text-right whitespace-nowrap">${RevopsFinanceEngine.money(totalCost)}</p>
        </div>
      </button>

      <div class="mt-3 space-y-2">
        <div class="rounded-2xl bg-white border border-sky-200 p-3">
          <p class="text-[11px] font-black text-sky-700 uppercase">Número de vendas</p>
          <p class="text-xl font-black text-sky-900">${Math.round(realSales).toLocaleString('pt-BR')}</p>
          <p class="text-[10px] text-sky-700/70 mt-0.5">Convertidos no funil das ações.</p>
        </div>
        <div class="rounded-2xl bg-white border border-sky-200 p-3">
          <p class="text-[11px] font-black text-sky-700 uppercase">Faturamento total</p>
          <p class="text-xl font-black text-sky-900">${RevopsFinanceEngine.money(realRevenue)}</p>
          <p class="text-[10px] text-sky-700/70 mt-0.5">Vendas reais × Ticket Médio.</p>
        </div>
        <div class="rounded-2xl bg-white border border-sky-200 p-3">
          <p class="text-[11px] font-black text-sky-700 uppercase">Total investido</p>
          <p class="text-xl font-black text-sky-900">${RevopsFinanceEngine.money(totalCost)}</p>
          <p class="text-[10px] text-sky-700/70 mt-0.5">Soma das origens listadas acima.</p>
        </div>
      </div>
    </div>`;
  },

  _currentProductId() {
    const stored = App.state.revopsSelectedProductId;
    if (stored && (App.state.products || []).some(p => Number(p.id) === Number(stored))) return Number(stored);
    return Number(App.state.products?.[0]?.id || 0) || null;
  },

  _currentConfig(productId) {
    const finance = App.state.revopsFinance || {};
    return RevopsFinanceEngine.normalize(finance[productId] || {}, productId);
  },

  _emptyState() {
    return `<div class="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 text-center">
      <div class="w-14 h-14 rounded-3xl bg-indigo-50 text-indigo-600 grid place-items-center mx-auto mb-4"><i data-lucide="landmark" class="w-7 h-7"></i></div>
      <h2 class="text-2xl font-black mb-2">RevOps & Governança</h2>
      <p class="text-sm text-slate-500 max-w-xl mx-auto mb-5">Para abrir a engenharia financeira de um produto, primeiro cadastre ao menos um produto na camada estratégica.</p>
      <button onclick="App.setTab('products')" class="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black">Ir para Produtos</button>
    </div>`;
  },

  _hero(productId, products, config) {
    const periodLabel = RevopsFinanceEngine.PERIODS.find(p => p.id === config.period)?.label || 'Mensal';
    const savedLabel = config.savedAt ? new Date(config.savedAt).toLocaleString('pt-BR') : 'ainda não salvo';
    return `<div class="bg-slate-950 text-white rounded-[2rem] p-5 shadow-sm overflow-hidden relative">
      <div class="absolute inset-0 opacity-60" style="background: radial-gradient(circle at 18% 10%, rgba(99,102,241,.24), transparent 30%), radial-gradient(circle at 82% 0%, rgba(139,92,246,.18), transparent 32%);"></div>
      <div class="relative z-10 grid lg:grid-cols-[1.2fr_1fr] gap-4 items-start">
        <div>
          <div class="flex items-center gap-2 mb-2"><i data-lucide="landmark" class="w-4 h-4 text-indigo-300"></i><p class="text-xs font-black text-slate-300 uppercase tracking-wider">Revenue Operations • Engenharia Financeira</p></div>
          <h1 class="text-3xl md:text-4xl font-black tracking-tight">RevOps & Governança</h1>
          <p class="text-sm text-slate-300 max-w-3xl mt-2">Selecione um produto e configure a operação financeira modular: ofertas, custos fixos (G&A), custos variáveis, projeção de vendas e leitura imediata de EBITDA e breakeven. Use o simulador para testar cenários sem afetar o oficial.</p>
          <p class="text-xs text-slate-400 mt-3">Período em uso: <b class="text-white">${periodLabel}</b> • Última configuração salva: <b class="text-white">${Utils.escape(savedLabel)}</b></p>
        </div>
        <div class="space-y-3">
          <div>
            <label class="text-xs font-black text-slate-300 uppercase tracking-wider">Selecione um produto para analisar</label>
            <select onchange="Actions.setRevopsProduct(Number(this.value))" class="mt-2 w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-bold backdrop-blur">
              ${products.map(product => `<option value="${product.id}" ${Number(productId) === Number(product.id) ? 'selected' : ''} class="text-slate-900">${Utils.escape(product.name)}</option>`).join('')}
            </select>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button onclick="Actions.openRevopsSimulation()" class="px-4 py-3 rounded-2xl bg-indigo-500/90 hover:bg-indigo-400 text-white font-black text-sm flex items-center justify-center gap-2"><i data-lucide="zap" class="w-4 h-4"></i> Simular Cenários</button>
            <button onclick="Actions.openRevopsScenarios()" class="px-4 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-black text-sm flex items-center justify-center gap-2"><i data-lucide="history" class="w-4 h-4"></i> Projeções Salvas</button>
          </div>
        </div>
      </div>
    </div>`;
  },

  _metricsStrip(metrics, config) {
    const healthClass = metrics.health === 'Saudável' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : metrics.health === 'Atenção' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-red-50 border-red-200 text-red-700';
    const breakeven = metrics.breakevenSales === null ? '—' : `${metrics.breakevenSales}`;
    return `<div class="grid grid-cols-2 lg:grid-cols-6 gap-3">
      ${this._kpi('Ticket Médio (TM)', RevopsFinanceEngine.money(metrics.ticket), 'tag')}
      ${this._kpi('Receita Bruta', RevopsFinanceEngine.money(metrics.grossRevenue), 'trending-up')}
      ${this._kpi('G&A Total', RevopsFinanceEngine.money(metrics.fixed), 'building-2', 'text-amber-700')}
      ${this._kpi('EBITDA', RevopsFinanceEngine.money(metrics.ebitda), 'wallet', metrics.ebitda >= 0 ? 'text-emerald-700' : 'text-red-700')}
      ${this._kpi('Margem EBITDA', RevopsFinanceEngine.percent(metrics.ebitdaMargin), 'percent', metrics.ebitdaMargin >= 25 ? 'text-emerald-700' : metrics.ebitdaMargin >= 0 ? 'text-amber-700' : 'text-red-700')}
      <div class="bg-white rounded-3xl p-4 shadow-sm border border-slate-100"><div class="flex items-center justify-between mb-1"><span class="text-xs font-black text-slate-500">Breakeven (vendas)</span><i data-lucide="target" class="w-4 h-4 text-slate-400"></i></div><div class="text-2xl font-black">${breakeven}</div><span class="px-2 py-1 rounded-full text-[10px] font-black ${healthClass} mt-1 inline-block">${metrics.health}</span></div>
    </div>`;
  },

  _kpi(label, value, icon, valueClass = '') {
    return `<div class="bg-white rounded-3xl p-4 shadow-sm border border-slate-100"><div class="flex items-center justify-between mb-1"><span class="text-xs font-black text-slate-500">${Utils.escape(label)}</span><i data-lucide="${icon}" class="w-4 h-4 text-slate-400"></i></div><div class="text-2xl font-black ${valueClass}">${value}</div></div>`;
  },

  _offersCard(config, metrics) {
    const offers = Array.isArray(config.offers) ? config.offers : [];
    const mode = config.ticketMode || 'weighted';
    const totalMix = offers.reduce((sum, o) => sum + RevopsFinanceEngine.number(o.mix), 0);
    const selectedCount = offers.filter(o => o.selectedForTicket).length;
    return `<div class="bg-emerald-50 rounded-3xl p-5 shadow-sm border border-emerald-100">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div>
          <div class="flex items-center gap-2 mb-1"><i data-lucide="layers" class="w-4 h-4 text-emerald-700"></i><h3 class="font-black text-lg text-emerald-900">Estrutura do Produto</h3></div>
          <p class="text-xs text-emerald-800/80">Ofertas vinculadas ao produto. Escolha como o Ticket Médio é calculado.</p>
        </div>
        <button onclick="Actions.addRevopsOffer()" class="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700 whitespace-nowrap">+ Oferta</button>
      </div>
      ${this._ticketModePills(mode, 'Actions.setRevopsTicketMode')}
      ${mode === 'manual' ? this._ticketManualInput(config) : ''}
      <div class="space-y-2 mt-3">${offers.map((offer, index) => this._offerRow(offer, index, mode)).join('') || '<p class="text-sm text-emerald-900/70">Nenhuma oferta cadastrada. Adicione planos, SKUs ou bundles.</p>'}</div>
      <div class="mt-3 rounded-2xl bg-white border border-emerald-200 p-3 flex items-center justify-between">
        <div>
          <p class="text-xs font-black text-emerald-700 uppercase">Ticket Médio</p>
          <p class="text-xl font-black text-emerald-900">${RevopsFinanceEngine.money(metrics.ticket)}</p>
        </div>
        <div class="text-right">
          ${this._ticketModeSummary(mode, totalMix, selectedCount, offers.length)}
        </div>
      </div>
      ${this._ticketModeWarning(mode, offers, totalMix)}
    </div>`;
  },

  _ticketModePills(activeMode, actionName) {
    return `<div class="grid grid-cols-3 gap-1 bg-emerald-100/60 rounded-xl p-1 mt-2">
      ${RevopsFinanceEngine.TICKET_MODES.map(opt => {
        const active = activeMode === opt.id;
        return `<button onclick="${actionName}('${opt.id}')" title="${Utils.escape(opt.description)}" class="px-2 py-1.5 rounded-lg text-[11px] font-black transition ${active ? 'bg-emerald-600 text-white shadow' : 'text-emerald-800 hover:bg-emerald-200'}">${Utils.escape(opt.shortLabel)}</button>`;
      }).join('')}
    </div>`;
  },

  _ticketManualInput(config) {
    return `<div class="mt-3 rounded-2xl bg-white border border-emerald-200 p-3">
      <label class="text-[11px] font-black text-emerald-700 uppercase tracking-wider">Ticket Médio manual (R$)</label>
      <div class="relative mt-1">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 pointer-events-none">R$</span>
        <input id="revops_ticket_manual" data-focus-key="revops_ticket_manual" type="text" inputmode="numeric" value="${Utils.formatCents(config.ticketManualValue)}" oninput="Actions.updateRevopsTicketManualValueSilent(Utils.applyMoneyMask(this))" onfocus="this.setSelectionRange(this.value.length, this.value.length)" onchange="App.render()" class="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white border border-emerald-200 font-black text-lg text-right" />
      </div>
      <p class="text-[11px] text-emerald-700/80 mt-1">Sobrescreve qualquer cálculo automático. Use para travar um TM oficial.</p>
    </div>`;
  },

  _ticketModeSummary(mode, totalMix, selectedCount, totalOffers) {
    if (mode === 'manual') return `<p class="text-xs text-emerald-700">Modo</p><p class="text-sm font-black text-emerald-900">Manual</p>`;
    if (mode === 'sumSelected') return `<p class="text-xs text-emerald-700">Marcadas</p><p class="text-sm font-black text-emerald-900">${selectedCount} / ${totalOffers}</p>`;
    return `<p class="text-xs text-emerald-700">Mix total</p><p class="text-sm font-black text-emerald-900">${RevopsFinanceEngine.percent(totalMix)}</p>`;
  },

  _ticketModeWarning(mode, offers, totalMix) {
    if (mode === 'weighted' && offers.length && Math.abs(totalMix - 100) > 0.5) {
      return `<p class="text-xs font-black text-amber-700 mt-2 flex items-center gap-2"><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> Mix soma ${RevopsFinanceEngine.percent(totalMix)}; ideal é 100%.</p>`;
    }
    if (mode === 'sumSelected' && offers.length && !offers.some(o => o.selectedForTicket)) {
      return `<p class="text-xs font-black text-amber-700 mt-2 flex items-center gap-2"><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> Nenhuma oferta marcada. O TM ficará em R$ 0 até você marcar.</p>`;
    }
    return '';
  },

  _offerRow(offer, index, mode = 'weighted') {
    const fName = `revops_offer_${offer.id}_name`;
    const fPrice = `revops_offer_${offer.id}_price`;
    const fMix = `revops_offer_${offer.id}_mix`;
    const selected = Boolean(offer.selectedForTicket);
    const showCheckbox = mode === 'sumSelected';
    const showMix = mode === 'weighted';
    return `<div class="flex items-center gap-2 min-w-0">
      ${showCheckbox ? `<button onclick="Actions.toggleRevopsOfferSelected('${offer.id}')" title="${selected ? 'Remover desta oferta do TM' : 'Incluir esta oferta no TM'}" class="shrink-0 w-9 h-9 rounded-xl border-2 ${selected ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-emerald-300 text-emerald-300'} font-black flex items-center justify-center">${selected ? '✓' : ''}</button>` : ''}
      <input id="${fName}" data-focus-key="${fName}" value="${Utils.escape(offer.name || '')}" oninput="Actions.updateRevopsOfferSilent('${offer.id}', 'name', this.value)" onchange="App.render()" placeholder="Nome da oferta" class="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-white border border-emerald-200 font-semibold text-sm" />
      <input id="${fPrice}" data-focus-key="${fPrice}" type="text" inputmode="numeric" value="${Utils.formatCents(offer.price)}" oninput="Actions.updateRevopsOfferSilent('${offer.id}', 'price', Utils.applyMoneyMask(this))" onfocus="this.setSelectionRange(this.value.length, this.value.length)" onchange="App.render()" placeholder="0,00" class="shrink-0 w-24 px-2 py-2.5 rounded-xl bg-white border border-emerald-200 font-black text-sm text-right" />
      ${showMix ? `<input id="${fMix}" data-focus-key="${fMix}" type="number" min="0" max="100" step="1" value="${RevopsFinanceEngine.number(offer.mix)}" oninput="Actions.updateRevopsOfferSilent('${offer.id}', 'mix', this.value)" onchange="App.render()" placeholder="%" class="shrink-0 w-16 px-2 py-2.5 rounded-xl bg-white border border-emerald-200 font-black text-sm text-right" />` : ''}
      <button onclick="Actions.removeRevopsOffer('${offer.id}')" title="Remover oferta" class="shrink-0 w-9 h-9 rounded-xl bg-red-50 border border-red-200 text-red-500 font-black flex items-center justify-center">×</button>
    </div>`;
  },

  _fixedCostsCard(config, metrics) {
    const categories = RevopsFinanceEngine.FIXED_CATEGORIES;
    const periodLabel = RevopsFinanceEngine.PERIODS.find(p => p.id === config.period)?.label || '';
    return `<div class="bg-amber-50 rounded-3xl p-5 shadow-sm border border-amber-200">
      <div class="flex items-center gap-2 mb-1"><i data-lucide="building-2" class="w-4 h-4 text-amber-700"></i><h3 class="font-black text-lg text-amber-900">Central de Custos • G&A</h3></div>
      <p class="text-xs text-amber-800/80 mb-3">Clique em cada categoria para detalhar as origens (ex.: RD Station: R$ 6.000, LeadJourney: R$ 4.000). O total alimenta o EBITDA.</p>
      <div class="space-y-2">${categories.map(cat => this._fixedCategoryRow(cat, config.fixedCosts?.[cat.id])).join('')}</div>
      <div class="mt-3 rounded-2xl bg-white border border-amber-200 p-3 flex items-center justify-between">
        <div><p class="text-xs font-black text-amber-700 uppercase">G&A Total${periodLabel ? ` (${periodLabel})` : ''}</p><p class="text-xl font-black text-amber-900">${RevopsFinanceEngine.money(metrics.fixed)}</p></div>
        <i data-lucide="calculator" class="w-5 h-5 text-amber-700"></i>
      </div>
    </div>`;
  },

  _fixedCategoryRow(meta, category) {
    const items = category?.items || [];
    const total = items.reduce((sum, item) => sum + RevopsFinanceEngine.number(item.value), 0);
    const summary = items.length === 0
      ? 'Nenhuma origem cadastrada'
      : items.slice(0, 2).map(item => Utils.escape(item.name || 'Sem nome')).join(', ') + (items.length > 2 ? ` +${items.length - 2}` : '');
    return `<button onclick="Actions.openRevopsFixedCostsModal('${meta.id}')" class="w-full grid grid-cols-[32px_1fr_140px_90px] gap-3 items-center text-left rounded-2xl bg-white border border-amber-200 hover:bg-amber-50 hover:border-amber-300 transition p-3">
      <div class="w-8 h-8 rounded-xl bg-amber-100 grid place-items-center"><i data-lucide="${meta.icon}" class="w-4 h-4 text-amber-700"></i></div>
      <div class="min-w-0">
        <p class="text-sm font-black text-amber-900">${Utils.escape(meta.label)}</p>
        <p class="text-[11px] text-amber-700/80 truncate">${summary}</p>
      </div>
      <p class="text-base font-black text-amber-900 text-right">${RevopsFinanceEngine.money(total)}</p>
      <span class="text-[10px] font-black text-amber-700 uppercase text-right tracking-wider">Gerenciar →</span>
    </button>`;
  },

  _variableCostsCard(config, metrics) {
    const items = Array.isArray(config.variableCosts) ? config.variableCosts : [];
    return `<div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-200">
      <div class="flex items-start justify-between gap-3 mb-1">
        <div>
          <div class="flex items-center gap-2"><i data-lucide="percent" class="w-4 h-4 text-slate-700"></i><h3 class="font-black text-lg text-slate-900">Custos Variáveis & Parceiros</h3></div>
          <p class="text-xs text-slate-500 mt-1 max-w-md">Adicione cada custo manualmente, escolha se é % ou valor fixo, e decida em qual ponto da cadeia ele se aplica — isso muda o EBITDA final.</p>
        </div>
        <button onclick="Actions.addRevopsVariableCost()" class="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-black flex items-center gap-1 whitespace-nowrap lj-dark-button" style="color:#fff!important;"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Adicionar</button>
      </div>
      <div class="space-y-2 mt-3">${items.length ? items.map(item => this._variableCostRow(item)).join('') : this._variableCostEmpty()}</div>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3"><p class="text-xs font-black text-slate-500 uppercase">% efetivo total</p><p class="text-xl font-black text-slate-900">${RevopsFinanceEngine.percent(metrics.variablePct)}</p><p class="text-[10px] text-slate-400 mt-1">Sobre a receita bruta no período.</p></div>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3"><p class="text-xs font-black text-slate-500 uppercase">CV $ no período</p><p class="text-xl font-black text-slate-900">${RevopsFinanceEngine.money(metrics.variableValue)}</p><p class="text-[10px] text-slate-400 mt-1">Total absoluto (%+fixos somados).</p></div>
      </div>
    </div>`;
  },

  _variableCostEmpty() {
    return `<div class="rounded-2xl border border-dashed border-slate-300 p-4 text-center">
      <div class="w-10 h-10 rounded-xl bg-slate-50 grid place-items-center mx-auto mb-2"><i data-lucide="receipt" class="w-5 h-5 text-slate-400"></i></div>
      <p class="text-sm font-black text-slate-700">Nenhum custo variável cadastrado</p>
      <p class="text-[11px] text-slate-500 mt-1">Adicione impostos, comissões, taxas de parceiros, royalties — o que se aplica.</p>
    </div>`;
  },

  _variableCostRow(item) {
    const fName = `revops_var_${item.id}_name`;
    const fValue = `revops_var_${item.id}_value`;
    const isPercent = item.type === 'percent';
    const appliesTo = RevopsFinanceEngine.VARIABLE_APPLIES_TO.find(a => a.id === item.appliesTo);
    const explanation = appliesTo?.explanation || '';
    return `<div class="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2 min-w-0">
      <div class="flex gap-2 min-w-0">
        <input id="${fName}" data-focus-key="${fName}" value="${Utils.escape(item.name || '')}" oninput="Actions.updateRevopsVariableCostSilent('${item.id}', 'name', this.value)" onchange="App.render()" placeholder="Nome do custo (ex.: Impostos)" class="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-white border border-slate-200 font-semibold text-sm" />
        <button onclick="Actions.removeRevopsVariableCost('${item.id}')" title="Remover" class="shrink-0 w-10 h-10 rounded-xl bg-red-50 text-red-500 border border-red-200 font-black">×</button>
      </div>
      <div class="grid grid-cols-3 gap-2 min-w-0">
        <div class="relative min-w-0">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 pointer-events-none">${isPercent ? '%' : 'R$'}</span>
          ${isPercent
            ? `<input id="${fValue}" data-focus-key="${fValue}" type="number" min="0" step="0.1" value="${RevopsFinanceEngine.number(item.value)}" oninput="Actions.updateRevopsVariableCostSilent('${item.id}', 'value', this.value)" onchange="App.render()" class="w-full pl-8 pr-2 py-2.5 rounded-xl bg-white border border-slate-200 font-black text-sm text-right" />`
            : `<input id="${fValue}" data-focus-key="${fValue}" type="text" inputmode="numeric" value="${Utils.formatCents(item.value)}" oninput="Actions.updateRevopsVariableCostSilent('${item.id}', 'value', Utils.applyMoneyMask(this))" onfocus="this.setSelectionRange(this.value.length, this.value.length)" onchange="App.render()" class="w-full pl-8 pr-2 py-2.5 rounded-xl bg-white border border-slate-200 font-black text-sm text-right" />`}
        </div>
        <select onchange="Actions.updateRevopsVariableCost('${item.id}', 'type', this.value)" class="min-w-0 px-2 py-2.5 rounded-xl bg-white border border-slate-200 font-bold text-xs">
          <option value="percent" ${isPercent ? 'selected' : ''}>%</option>
          <option value="fixed" ${!isPercent ? 'selected' : ''}>R$ fixo</option>
        </select>
        <select onchange="Actions.updateRevopsVariableCost('${item.id}', 'appliesTo', this.value)" class="min-w-0 px-2 py-2.5 rounded-xl bg-white border border-slate-200 font-bold text-xs" title="${Utils.escape(explanation)}">
          ${RevopsFinanceEngine.VARIABLE_APPLIES_TO.map(a => `<option value="${a.id}" ${item.appliesTo === a.id ? 'selected' : ''}>${Utils.escape(a.shortLabel)}</option>`).join('')}
        </select>
      </div>
      <p class="text-[11px] text-slate-500 leading-snug flex items-start gap-1"><i data-lucide="info" class="w-3 h-3 mt-0.5 shrink-0"></i><span>${Utils.escape(explanation)}</span></p>
    </div>`;
  },

  _operationalControls(config) {
    return `<div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
      <div class="grid lg:grid-cols-[1fr_1fr_1fr_auto] gap-4 items-end">
        <div>
          <label class="text-xs font-black text-slate-500 uppercase tracking-wider">Período financeiro</label>
          <select onchange="Actions.updateRevopsPeriod(this.value)" class="mt-2 w-full px-4 py-3 rounded-2xl bg-slate-100 font-bold">
            ${RevopsFinanceEngine.PERIODS.map(p => `<option value="${p.id}" ${config.period === p.id ? 'selected' : ''}>${p.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs font-black text-slate-500 uppercase tracking-wider">Vendas previstas no período</label>
          <input id="revops_sales_projection" data-focus-key="revops_sales_projection" type="number" min="0" step="1" value="${RevopsFinanceEngine.number(config.salesProjection)}" oninput="Actions.updateRevopsSalesProjectionSilent(this.value)" onchange="App.render()" class="mt-2 w-full px-4 py-3 rounded-2xl bg-slate-100 font-black" />
        </div>
        <div class="text-sm text-slate-500">
          <p class="font-black text-slate-700 mb-1">Como o cálculo funciona</p>
          <p>Receita Bruta = vendas × TM. CV reduz a receita pelo %. EBITDA = Receita Líquida − G&A.</p>
        </div>
        <button onclick="Actions.saveRevopsConfig()" class="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black hover:bg-slate-800 flex items-center gap-2 lj-dark-button" style="color:#fff!important;"><i data-lucide="save" class="w-4 h-4"></i> Salvar Configuração Operacional</button>
      </div>
    </div>`;
  },

  // V29.4.0 — Bloco do Mapa Estratégico V29 dentro da RevOps & Governança.
  // Substitui o _governanceBlock antigo que mostrava OKRs/KPIs desconectados.
  // 3 sub-seções: alertas no topo, saúde dos KRs-mãe (rollup), branches do produto.
  _strategicMapBlock(productId, metrics, config) {
    if (!window.StrategicMapEngine || !productId) return '';
    const map = StrategicMapEngine.getForProduct(productId);
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    if (!product) return '';
    const vision = String(map?.vision || '').trim();
    const productKrs = StrategicMapEngine.getProductKrs(productId);
    const branches = StrategicMapEngine.getBranchesByProduct(productId);
    const desplugadas = StrategicMapEngine.getDesplugedCampaigns(productId);
    const orphans = StrategicMapEngine.getOrphanChildKrs(productId);
    const executedAt = StrategicMapEngine.getMetricsExecutedAt ? StrategicMapEngine.getMetricsExecutedAt(productId) : null;

    if (!vision && !productKrs.length && !branches.length) {
      return `<div class="bg-slate-900 text-white rounded-3xl p-5 shadow-sm">
        <div class="flex items-center gap-2 mb-2"><i data-lucide="compass" class="w-4 h-4 text-indigo-300"></i><p class="text-xs font-black text-slate-300 uppercase tracking-wider">Mapa da Receita</p></div>
        <h3 class="text-xl font-black mb-1">Este produto ainda não tem Mapa da Receita.</h3>
        <p class="text-sm text-slate-300 mb-3">Defina visão, números-mãe e campanhas pra ver aqui a saúde estratégica.</p>
        <button onclick="Actions.openStrategicMap(${productId})" class="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-900 font-black text-xs flex items-center gap-1.5"><i data-lucide="rocket" class="w-3.5 h-3.5"></i> Abrir Mapa da Receita</button>
      </div>`;
    }

    return `<div class="bg-slate-900 text-white rounded-3xl p-5 shadow-sm space-y-4">
      ${this._smHeader(productId, product, vision, branches, desplugadas, orphans, executedAt)}
      ${productKrs.length ? this._smRollupTable(productId, productKrs) : ''}
      ${branches.length || desplugadas.length ? this._smBranchesList(productId, branches, desplugadas) : ''}
    </div>`;
  },

  _smHeader(productId, product, vision, branches, desplugadas, orphans, executedAt) {
    const dateStr = executedAt ? new Date(executedAt) : null;
    const dateFmt = dateStr ? `${String(dateStr.getDate()).padStart(2,'0')}/${String(dateStr.getMonth()+1).padStart(2,'0')}` : null;
    const totalAlerts = desplugadas.length + orphans.length;
    return `<div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 mb-1">
          <i data-lucide="compass" class="w-4 h-4 text-indigo-300"></i>
          <p class="text-xs font-black text-slate-300 uppercase tracking-wider">Mapa da Receita — saúde estratégica</p>
          ${executedAt ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">✓ publicado em ${dateFmt}</span>` : '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-200 border border-amber-400/30">⚠ não publicado</span>'}
        </div>
        ${vision ? `<p class="text-sm text-slate-200"><b>Objetivo:</b> ${Utils.escape(vision.length > 140 ? vision.slice(0, 140) + '…' : vision)}</p>` : '<p class="text-sm text-amber-300">⚠ Visão do produto ainda não definida.</p>'}
        ${totalAlerts > 0 ? `<p class="text-[12px] mt-2 text-amber-200">⚠ <b>${totalAlerts} alerta(s):</b> ${desplugadas.length ? `${desplugadas.length} campanha(s) desplugada(s)` : ''}${desplugadas.length && orphans.length ? ' · ' : ''}${orphans.length ? `${orphans.length} número(s) órfão(s)` : ''}</p>` : ''}
      </div>
      <button onclick="Actions.openStrategicMap(${productId})" class="px-3 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-xs font-black flex items-center gap-1.5 shrink-0" style="color:#fff!important;"><i data-lucide="compass" class="w-3.5 h-3.5"></i> Abrir Mapa</button>
    </div>`;
  },

  // V29.4.0 — Tabela do rollup dos KRs-mãe. Soma das filhas em todas as branches do produto.
  _smRollupTable(productId, productKrs) {
    const areas = StrategicMapEngine.COMERCIAL_AREAS || [];
    return `<div class="rounded-2xl bg-white/[0.04] border border-white/10 p-3 overflow-x-auto">
      <p class="text-[11px] font-black text-emerald-200 uppercase tracking-wider mb-2">Rollup dos KRs-mãe (CEO → soma das filhas)</p>
      <table class="w-full text-[12px]">
        <thead>
          <tr class="text-left text-slate-400 text-[10px] uppercase tracking-wider border-b border-white/10">
            <th class="py-1.5 pr-3">Área</th>
            <th class="py-1.5 pr-3">KR-mãe</th>
            <th class="py-1.5 pr-3 text-right">Meta Segura</th>
            <th class="py-1.5 pr-3 text-right">Atual (rollup)</th>
            <th class="py-1.5 pr-3 text-right">%</th>
            <th class="py-1.5 text-right">Branches</th>
          </tr>
        </thead>
        <tbody>
          ${productKrs.map(pkr => {
            const area = areas.find(a => a.id === pkr.area);
            const rollup = StrategicMapEngine.rollupForProductKr(productId, pkr.id);
            const target = Number(pkr.targetCommitted || 0);
            const pct = target ? Math.round((rollup.current / target) * 100) : 0;
            const pctColor = pct >= 100 ? 'text-emerald-300' : pct >= 70 ? 'text-amber-300' : 'text-red-300';
            const autoBadge = pkr.createdBy === 'auto' ? `<span class="text-[9px] text-amber-300 ml-1" title="Criado automaticamente por gestor">⚠</span>` : '';
            return `<tr class="border-b border-white/5">
              <td class="py-1.5 pr-3"><span class="px-1.5 py-0.5 rounded text-[10px] font-black bg-${area?.color || 'slate'}-500/20 text-${area?.color || 'slate'}-200 border border-${area?.color || 'slate'}-400/30">${area?.label || pkr.area}</span></td>
              <td class="py-1.5 pr-3 font-bold">${Utils.escape(pkr.name)}${autoBadge}</td>
              <td class="py-1.5 pr-3 text-right">${target || '—'}</td>
              <td class="py-1.5 pr-3 text-right font-black">${rollup.current}</td>
              <td class="py-1.5 pr-3 text-right font-black ${pctColor}">${pct}%</td>
              <td class="py-1.5 text-right text-slate-400">${rollup.contributors}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  },

  // V29.4.0 — Lista das branches (plugadas e desplugadas) deste produto.
  _smBranchesList(productId, branches, desplugadas) {
    return `<div class="rounded-2xl bg-white/[0.04] border border-white/10 p-3 space-y-2">
      <p class="text-[11px] font-black text-violet-200 uppercase tracking-wider">Campanhas deste produto · ${branches.length} plugada(s) · ${desplugadas.length} desplugada(s)</p>
      ${branches.length ? `<div class="space-y-1.5">${branches.map(b => {
        const c = (App.state.campaigns || []).find(c => Number(c.id) === Number(b.campaignId));
        if (!c) return '';
        const status = StrategicMapEngine.getCampaignStrategicStatus(b.campaignId);
        const statusInfo = { active: { color: 'emerald', label: 'Ativa' }, configuring: { color: 'amber', label: 'Em config' } }[status] || { color: 'slate', label: 'Pendente' };
        const allKrs = (b.objectives || []).flatMap(o => o.okrs || []);
        const plugged = allKrs.filter(k => k.parentProductKrId).length;
        const actionsCount = (App.state.actions || []).filter(a => Number(a.campaignId) === Number(b.campaignId) && a.strategicAreaId).length;
        return `<div class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-800/40 border border-${statusInfo.color}-400/30">
          <div class="min-w-0 flex-1">
            <p class="font-black text-white text-[12px] truncate">${Utils.escape(c.name)} <span class="text-[10px] text-${statusInfo.color}-300 ml-1">● ${statusInfo.label}</span></p>
            <p class="text-[10px] text-slate-400">${plugged} número(s) plugado(s) · ${actionsCount} ação(ões)</p>
          </div>
          <button onclick="Actions.openStrategicMapForCampaign(${b.campaignId})" class="px-2.5 py-1 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/40 text-violet-100 text-[10px] font-black shrink-0">Abrir</button>
        </div>`;
      }).join('')}</div>` : ''}
      ${desplugadas.length ? `<div class="pt-2 border-t border-white/10">
        <p class="text-[10px] font-black text-red-300 uppercase mb-1">🔴 Desplugadas (não alimentam o rollup):</p>
        <div class="space-y-1">${desplugadas.map(c => `<div class="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-400/30">
          <span class="text-[11px] text-white truncate">${Utils.escape(c.name)}</span>
          <button onclick="Actions.activateStrategicMapForCampaign(${c.id})" class="px-2 py-0.5 rounded text-[10px] font-black bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 shrink-0">Ativar Mapa</button>
        </div>`).join('')}</div>
      </div>` : ''}
    </div>`;
  },

  // DEPRECATED V29.4.0 — substituído por _strategicMapBlock. Mantido como dead code.
  _governanceBlock(metrics, config) {
    const okrs = (App.state.strategicOkrs || []);
    const kpis = (App.state.operationalKpis || []);
    const productOkrs = okrs.length;
    const productKpis = kpis.filter(k => k.scope === 'global' || Number(k.productId) === Number(config.productId)).length;
    return `<div class="bg-slate-900 text-white rounded-3xl p-5 shadow-sm">
      <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3 mb-4">
        <div>
          <div class="flex items-center gap-2 mb-2"><i data-lucide="compass" class="w-4 h-4 text-indigo-300"></i><p class="text-xs font-black text-slate-300 uppercase tracking-wider">Governança de OKRs (V14.2 em diante)</p></div>
          <h3 class="text-xl font-black">Conectando saúde financeira ao atingimento de metas</h3>
          <p class="text-sm text-slate-300 max-w-3xl mt-1">Esta seção amarra os números do produto à governança operacional. Próximas fases trarão alertas automáticos, cascata de OKRs por área e direcionamento de receita.</p>
        </div>
        <div class="grid grid-cols-3 gap-2 text-center">
          <div class="rounded-2xl bg-white/10 border border-white/10 p-3"><p class="text-xs text-slate-300 font-black">OKRs estratégicos</p><p class="text-2xl font-black mt-1">${productOkrs}</p></div>
          <div class="rounded-2xl bg-white/10 border border-white/10 p-3"><p class="text-xs text-slate-300 font-black">KPIs operacionais</p><p class="text-2xl font-black mt-1">${productKpis}</p></div>
          <div class="rounded-2xl bg-white/10 border border-white/10 p-3"><p class="text-xs text-slate-300 font-black">Health do produto</p><p class="text-2xl font-black mt-1">${metrics.health}</p></div>
        </div>
      </div>
      <button onclick="App.setTab('dashboard')" class="px-4 py-2.5 rounded-2xl bg-white/10 border border-white/10 text-white text-xs font-black">Ver workspace de OKR/KPI</button>
    </div>`;
  }
};
window.RevopsGovernanceModule = RevopsGovernanceModule;
