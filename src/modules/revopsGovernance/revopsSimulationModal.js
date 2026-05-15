// V14 — Modal de simulação em tempo real (sandbox).
// Duplica a configuração oficial e permite editar livremente, sem afetar o original
// até que o usuário escolha salvar como cenário ou aplicar ao produto.
var RevopsSimulationModal = {
  render() {
    if (!App.state.showRevopsSimulationModal || !App.state.revopsSimulationDraft) return '';
    const draft = RevopsFinanceEngine.normalize(App.state.revopsSimulationDraft);
    const productId = draft.productId || App.state.revopsSelectedProductId;
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    const original = RevopsFinanceEngine.normalize((App.state.revopsFinance || {})[productId] || {}, productId);
    const projected = RevopsFinanceEngine.computeMetrics(draft);
    const baseline = RevopsFinanceEngine.computeMetrics(original);
    const loadedScenario = App.state.revopsSimulationLoadedScenarioId
      ? (original.scenarios || []).find(s => s.id === App.state.revopsSimulationLoadedScenarioId)
      : null;
    return `<div class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm p-4 overflow-auto">
      <main class="min-h-full">
        <section class="rounded-[2rem] overflow-hidden shadow-2xl text-white" style="background: radial-gradient(circle at 18% 10%, rgba(99,102,241,.24), transparent 30%), radial-gradient(circle at 82% 0%, rgba(139,92,246,.18), transparent 32%), #071326;">
          ${this._header(product, loadedScenario)}
          <div class="p-5 lg:p-7 space-y-5">
            ${this._comparisonStrip(baseline, projected)}
            <div class="grid xl:grid-cols-[1.1fr_1fr] gap-5">
              ${this._inputsPanel(draft)}
              ${this._chartsPanel(projected, draft)}
            </div>
            ${this._waterfall(projected)}
            ${this._footerActions(loadedScenario)}
          </div>
        </section>
      </main>
    </div>`;
  },

  _header(product, loadedScenario) {
    const badge = loadedScenario
      ? `<span class="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-400/30 text-xs font-bold">Cenário carregado: ${Utils.escape(loadedScenario.name)}</span>`
      : `<span class="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-bold">Sandbox • Modo Projeção</span>`;
    return `<header class="p-6 lg:p-7 border-b border-white/10">
      <div class="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
        <div>
          <div class="flex flex-wrap items-center gap-3 mb-3">
            <h2 class="text-3xl lg:text-4xl font-black tracking-tight">Simulador de Cenários</h2>
            ${badge}
          </div>
          <p class="text-slate-300 text-sm">Produto: <b class="text-white">${Utils.escape(product?.name || 'Sem produto')}</b> <span class="mx-3">•</span> Tudo que você alterar aqui só altera os números oficiais quando você decidir salvar como cenário ou aplicar.</p>
        </div>
        <div class="flex gap-2">
          <button onclick="Actions.resetRevopsSimulation()" class="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center gap-2 text-sm font-semibold"><i data-lucide="rotate-ccw" class="w-4 h-4"></i> Resetar</button>
          <button onclick="Actions.closeRevopsSimulation()" class="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center gap-2 text-sm font-semibold"><i data-lucide="x" class="w-4 h-4"></i> Fechar</button>
        </div>
      </div>
    </header>`;
  },

  _comparisonStrip(baseline, projected) {
    const items = [
      { label: 'Vendas', base: baseline.sales, proj: projected.sales, fmt: n => Math.round(n).toLocaleString('pt-BR') },
      { label: 'Ticket Médio', base: baseline.ticket, proj: projected.ticket, fmt: RevopsFinanceEngine.money.bind(RevopsFinanceEngine) },
      { label: 'Receita Bruta', base: baseline.grossRevenue, proj: projected.grossRevenue, fmt: RevopsFinanceEngine.money.bind(RevopsFinanceEngine) },
      { label: 'G&A', base: baseline.fixed, proj: projected.fixed, fmt: RevopsFinanceEngine.money.bind(RevopsFinanceEngine) },
      { label: 'EBITDA', base: baseline.ebitda, proj: projected.ebitda, fmt: RevopsFinanceEngine.money.bind(RevopsFinanceEngine) },
      { label: 'Margem', base: baseline.ebitdaMargin, proj: projected.ebitdaMargin, fmt: v => RevopsFinanceEngine.percent(v) }
    ];
    return `<div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">${items.map(item => this._diffCard(item)).join('')}</div>`;
  },

  _diffCard(item) {
    const delta = (item.proj || 0) - (item.base || 0);
    const arrow = delta > 0 ? 'trending-up' : delta < 0 ? 'trending-down' : 'minus';
    const positiveIsGood = !['G&A'].includes(item.label);
    const goodColor = positiveIsGood
      ? (delta > 0 ? 'text-emerald-300' : delta < 0 ? 'text-red-300' : 'text-slate-300')
      : (delta < 0 ? 'text-emerald-300' : delta > 0 ? 'text-red-300' : 'text-slate-300');
    return `<div class="rounded-2xl p-4 border border-white/10 bg-white/[0.055] backdrop-blur-xl">
      <p class="text-xs text-slate-400 font-bold">${Utils.escape(item.label)}</p>
      <p class="text-2xl font-black mt-1">${item.fmt(item.proj)}</p>
      <div class="flex items-center gap-1 mt-1"><i data-lucide="${arrow}" class="w-3 h-3 ${goodColor}"></i><span class="text-[11px] ${goodColor}">vs ${item.fmt(item.base)}</span></div>
    </div>`;
  },

  _inputsPanel(draft) {
    return `<div class="rounded-[1.75rem] border border-white/10 bg-white/[0.055] backdrop-blur-xl p-5 space-y-4">
      <h3 class="text-lg font-black">Ajustes do cenário</h3>
      ${this._inputRow('Vendas no período', draft.salesProjection, 'salesProjection', 'number', '0', 'users')}
      ${this._periodControl(draft)}
      ${this._offersBlock(draft)}
      ${this._fixedBlock(draft)}
      ${this._variableBlock(draft)}
    </div>`;
  },

  _inputRow(label, value, field, type, placeholder, icon) {
    const key = `sim_${field}`;
    return `<div class="grid grid-cols-[20px_1fr_140px] gap-3 items-center">
      <i data-lucide="${icon}" class="w-4 h-4 text-indigo-300"></i>
      <label class="text-sm font-bold text-slate-200">${Utils.escape(label)}</label>
      <input id="${key}" data-focus-key="${key}" type="${type}" value="${RevopsFinanceEngine.number(value)}" oninput="Actions.updateRevopsSimulationSilent('${field}', this.value)" onchange="App.render()" placeholder="${Utils.escape(placeholder || '')}" class="px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white font-black text-sm text-right placeholder:text-slate-500" />
    </div>`;
  },

  _periodControl(draft) {
    return `<div class="grid grid-cols-[20px_1fr_140px] gap-3 items-center">
      <i data-lucide="calendar" class="w-4 h-4 text-indigo-300"></i>
      <label class="text-sm font-bold text-slate-200">Período</label>
      <select onchange="Actions.updateRevopsSimulation('period', this.value)" class="px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white font-bold text-sm" style="color-scheme: dark;">
        ${RevopsFinanceEngine.PERIODS.map(p => `<option value="${p.id}" ${draft.period === p.id ? 'selected' : ''} class="text-slate-900">${p.label}</option>`).join('')}
      </select>
    </div>`;
  },

  _offersBlock(draft) {
    const offers = draft.offers || [];
    const mode = draft.ticketMode || 'weighted';
    return `<div class="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div class="flex items-center justify-between mb-2"><p class="text-xs font-black text-slate-300 uppercase">Ofertas e Ticket Médio</p><button onclick="Actions.addRevopsSimulationOffer()" class="px-2 py-1 rounded-lg bg-indigo-500/20 text-indigo-200 text-xs font-black">+ Oferta</button></div>
      <div class="grid grid-cols-3 gap-1 bg-white/5 rounded-lg p-1 mb-2">
        ${RevopsFinanceEngine.TICKET_MODES.map(opt => {
          const active = mode === opt.id;
          return `<button onclick="Actions.setRevopsSimulationTicketMode('${opt.id}')" title="${Utils.escape(opt.description)}" class="px-2 py-1 rounded text-[10px] font-black transition ${active ? 'bg-indigo-500 text-white' : 'text-slate-300 hover:bg-white/10'}">${Utils.escape(opt.shortLabel)}</button>`;
        }).join('')}
      </div>
      ${mode === 'manual' ? this._manualTicketInput(draft) : ''}
      <div class="space-y-2">${offers.map(offer => this._offerRow(offer, mode)).join('') || '<p class="text-xs text-slate-400">Nenhuma oferta cadastrada.</p>'}</div>
    </div>`;
  },

  _manualTicketInput(draft) {
    return `<div class="mb-2 rounded-lg bg-white/[0.05] border border-white/10 p-2">
      <label class="text-[10px] font-black text-slate-300 uppercase">TM manual (R$)</label>
      <div class="relative mt-1">
        <span class="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 pointer-events-none">R$</span>
        <input id="sim_ticket_manual" data-focus-key="sim_ticket_manual" type="text" inputmode="numeric" value="${Utils.formatCents(draft.ticketManualValue)}" oninput="Actions.updateRevopsSimulationTicketManualValueSilent(Utils.applyMoneyMask(this))" onfocus="this.setSelectionRange(this.value.length, this.value.length)" onchange="App.render()" class="w-full pl-7 pr-2 py-1.5 rounded-md bg-white/10 border border-white/15 text-white text-sm font-black text-right" />
      </div>
    </div>`;
  },

  _offerRow(offer, mode = 'weighted') {
    const fN = `sim_offer_${offer.id}_name`;
    const fP = `sim_offer_${offer.id}_price`;
    const fM = `sim_offer_${offer.id}_mix`;
    const selected = Boolean(offer.selectedForTicket);
    const showCheckbox = mode === 'sumSelected';
    const showMix = mode === 'weighted';
    return `<div class="flex items-center gap-2 min-w-0">
      ${showCheckbox ? `<button onclick="Actions.toggleRevopsSimulationOfferSelected('${offer.id}')" title="${selected ? 'Remover do TM' : 'Incluir no TM'}" class="shrink-0 w-8 h-8 rounded-lg border-2 ${selected ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white/5 border-white/30 text-white/30'} font-black text-xs flex items-center justify-center">${selected ? '✓' : ''}</button>` : ''}
      <input id="${fN}" data-focus-key="${fN}" value="${Utils.escape(offer.name || '')}" oninput="Actions.updateRevopsSimulationOfferSilent('${offer.id}', 'name', this.value)" onchange="App.render()" placeholder="Oferta" class="flex-1 min-w-0 px-2 py-2 rounded-lg bg-white/10 border border-white/15 text-white text-sm font-semibold placeholder:text-slate-500" />
      <input id="${fP}" data-focus-key="${fP}" type="text" inputmode="numeric" value="${Utils.formatCents(offer.price)}" oninput="Actions.updateRevopsSimulationOfferSilent('${offer.id}', 'price', Utils.applyMoneyMask(this))" onfocus="this.setSelectionRange(this.value.length, this.value.length)" onchange="App.render()" placeholder="0,00" class="shrink-0 w-20 px-2 py-2 rounded-lg bg-white/10 border border-white/15 text-white text-sm font-black text-right placeholder:text-slate-500" />
      ${showMix ? `<input id="${fM}" data-focus-key="${fM}" type="number" min="0" max="100" step="1" value="${RevopsFinanceEngine.number(offer.mix)}" oninput="Actions.updateRevopsSimulationOfferSilent('${offer.id}', 'mix', this.value)" onchange="App.render()" placeholder="%" class="shrink-0 w-14 px-2 py-2 rounded-lg bg-white/10 border border-white/15 text-white text-sm font-black text-right placeholder:text-slate-500" />` : ''}
      <button onclick="Actions.removeRevopsSimulationOffer('${offer.id}')" class="shrink-0 w-8 h-8 rounded-lg bg-red-500/20 text-red-200 font-black">×</button>
    </div>`;
  },

  _fixedBlock(draft) {
    const fc = draft.fixedCosts || {};
    return `<div class="rounded-2xl border border-white/10 bg-black/20 p-3">
      <p class="text-xs font-black text-slate-300 uppercase mb-2">Custos fixos (G&A)</p>
      <div class="space-y-3">${RevopsFinanceEngine.FIXED_CATEGORIES.map(cat => this._fixedCategoryBlock(cat, fc[cat.id])).join('')}</div>
    </div>`;
  },

  _fixedCategoryBlock(meta, category) {
    const items = category?.items || [];
    const total = items.reduce((sum, item) => sum + RevopsFinanceEngine.number(item.value), 0);
    return `<div class="rounded-xl bg-slate-950/40 border border-white/10 p-3">
      <div class="flex items-center justify-between gap-3 mb-2">
        <div class="flex items-center gap-2">
          <i data-lucide="${meta.icon}" class="w-3.5 h-3.5 text-amber-300"></i>
          <p class="text-xs font-black text-slate-200">${Utils.escape(meta.label)}</p>
        </div>
        <div class="flex items-center gap-2">
          <p class="text-xs font-black text-amber-200">${RevopsFinanceEngine.money(total)}</p>
          <button onclick="Actions.addRevopsSimulationFixedItem('${meta.id}')" class="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-400/30 text-[10px] font-black">+ Item</button>
        </div>
      </div>
      <div class="space-y-1.5">${items.length ? items.map(item => this._fixedItemRow(meta.id, item)).join('') : '<p class="text-[11px] text-slate-500">Sem origens nesta categoria.</p>'}</div>
    </div>`;
  },

  _fixedItemRow(category, item) {
    const fN = `sim_fx_${category}_${item.id}_name`;
    const fV = `sim_fx_${category}_${item.id}_value`;
    return `<div class="grid grid-cols-[1fr_120px_28px] gap-1.5 items-center">
      <input id="${fN}" data-focus-key="${fN}" value="${Utils.escape(item.name || '')}" oninput="Actions.updateRevopsSimulationFixedItemSilent('${category}', '${item.id}', 'name', this.value)" onchange="App.render()" placeholder="Origem (ex.: RD Station)" class="px-2 py-1.5 rounded-lg bg-white/10 border border-white/15 text-white text-xs font-semibold placeholder:text-slate-500" />
      <div class="relative">
        <span class="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 pointer-events-none">R$</span>
        <input id="${fV}" data-focus-key="${fV}" type="text" inputmode="numeric" value="${Utils.formatCents(item.value)}" oninput="Actions.updateRevopsSimulationFixedItemSilent('${category}', '${item.id}', 'value', Utils.applyMoneyMask(this))" onfocus="this.setSelectionRange(this.value.length, this.value.length)" onchange="App.render()" class="w-full pl-7 pr-2 py-1.5 rounded-lg bg-white/10 border border-white/15 text-white text-xs font-black text-right" />
      </div>
      <button onclick="Actions.removeRevopsSimulationFixedItem('${category}', '${item.id}')" class="w-7 h-7 rounded-lg bg-red-500/20 text-red-200 font-black text-xs">×</button>
    </div>`;
  },

  _variableBlock(draft) {
    const items = Array.isArray(draft.variableCosts) ? draft.variableCosts : [];
    return `<div class="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div class="flex items-center justify-between gap-2 mb-2">
        <p class="text-xs font-black text-slate-300 uppercase">Custos variáveis</p>
        <button onclick="Actions.addRevopsSimulationVariableCost()" class="px-2 py-1 rounded-lg bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 text-[10px] font-black">+ Custo</button>
      </div>
      <div class="space-y-2">${items.length ? items.map(item => this._varItemRow(item)).join('') : '<p class="text-[11px] text-slate-400">Sem custos variáveis nesta simulação.</p>'}</div>
    </div>`;
  },

  _varItemRow(item) {
    const fN = `sim_var_${item.id}_name`;
    const fV = `sim_var_${item.id}_value`;
    const isPercent = item.type === 'percent';
    return `<div class="rounded-xl bg-slate-950/40 border border-white/10 p-2 space-y-1.5">
      <div class="grid grid-cols-[1fr_100px_28px] gap-1.5 items-center">
        <input id="${fN}" data-focus-key="${fN}" value="${Utils.escape(item.name || '')}" oninput="Actions.updateRevopsSimulationVariableCostSilent('${item.id}', 'name', this.value)" onchange="App.render()" placeholder="Nome" class="px-2 py-1.5 rounded-lg bg-white/10 border border-white/15 text-white text-xs font-semibold placeholder:text-slate-500" />
        <div class="relative">
          <span class="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 pointer-events-none">${isPercent ? '%' : 'R$'}</span>
          ${isPercent
            ? `<input id="${fV}" data-focus-key="${fV}" type="number" min="0" step="0.1" value="${RevopsFinanceEngine.number(item.value)}" oninput="Actions.updateRevopsSimulationVariableCostSilent('${item.id}', 'value', this.value)" onchange="App.render()" class="w-full pl-6 pr-1 py-1.5 rounded-lg bg-white/10 border border-white/15 text-white text-xs font-black text-right" />`
            : `<input id="${fV}" data-focus-key="${fV}" type="text" inputmode="numeric" value="${Utils.formatCents(item.value)}" oninput="Actions.updateRevopsSimulationVariableCostSilent('${item.id}', 'value', Utils.applyMoneyMask(this))" onfocus="this.setSelectionRange(this.value.length, this.value.length)" onchange="App.render()" class="w-full pl-6 pr-1 py-1.5 rounded-lg bg-white/10 border border-white/15 text-white text-xs font-black text-right" />`}
        </div>
        <button onclick="Actions.removeRevopsSimulationVariableCost('${item.id}')" class="w-7 h-7 rounded-lg bg-red-500/20 text-red-200 font-black text-xs">×</button>
      </div>
      <div class="grid grid-cols-2 gap-1.5">
        <select onchange="Actions.updateRevopsSimulationVariableCost('${item.id}', 'type', this.value)" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-white/20 text-white text-[10px] font-black" style="color-scheme: dark;">
          <option value="percent" ${isPercent ? 'selected' : ''} class="bg-slate-900">%</option>
          <option value="fixed" ${!isPercent ? 'selected' : ''} class="bg-slate-900">R$ fixo</option>
        </select>
        <select onchange="Actions.updateRevopsSimulationVariableCost('${item.id}', 'appliesTo', this.value)" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-white/20 text-white text-[10px] font-black" style="color-scheme: dark;">
          ${RevopsFinanceEngine.VARIABLE_APPLIES_TO.map(a => `<option value="${a.id}" ${item.appliesTo === a.id ? 'selected' : ''} class="bg-slate-900">${Utils.escape(a.shortLabel)}</option>`).join('')}
        </select>
      </div>
    </div>`;
  },

  _chartsPanel(metrics, draft) {
    return `<div class="rounded-[1.75rem] border border-white/10 bg-white/[0.055] backdrop-blur-xl p-5 space-y-5">
      <div>
        <h3 class="text-lg font-black mb-1">Decomposição da Receita</h3>
        <p class="text-xs text-slate-400 mb-3">Como a receita bruta se transforma em EBITDA.</p>
        ${this._barChart(metrics)}
      </div>
      <div>
        <h3 class="text-lg font-black mb-1">Curva de Breakeven</h3>
        <p class="text-xs text-slate-400 mb-3">Ponto em que a receita líquida cobre o G&A.</p>
        ${this._breakevenChart(draft)}
      </div>
    </div>`;
  },

  _barChart(metrics) {
    const max = Math.max(metrics.grossRevenue, metrics.fixed, 1);
    const bars = [
      { label: 'Receita Bruta', value: metrics.grossRevenue, color: '#6366f1' },
      { label: 'Custos Variáveis', value: metrics.variableValue, color: '#f59e0b' },
      { label: 'Receita Líquida', value: metrics.netRevenue, color: '#0ea5e9' },
      { label: 'G&A (fixos)', value: metrics.fixed, color: '#ef4444' },
      { label: 'EBITDA', value: Math.max(metrics.ebitda, 0), color: metrics.ebitda >= 0 ? '#10b981' : '#ef4444' }
    ];
    return `<div class="space-y-2">${bars.map(bar => {
      const width = Math.max(2, Math.round((Math.abs(bar.value) / max) * 100));
      return `<div>
        <div class="flex items-center justify-between text-xs mb-1"><span class="text-slate-300 font-bold">${Utils.escape(bar.label)}</span><span class="text-white font-black">${RevopsFinanceEngine.money(bar.value)}</span></div>
        <div class="h-3 rounded-full bg-white/5 overflow-hidden"><div class="h-full rounded-full" style="width:${width}%; background:${bar.color};"></div></div>
      </div>`;
    }).join('')}</div>`;
  },

  _breakevenChart(draft) {
    const curve = RevopsFinanceEngine.buildBreakevenCurve(draft, 10);
    const points = curve.points;
    if (points.length < 2) return '<p class="text-xs text-slate-400">Preencha ofertas e custos para visualizar o breakeven.</p>';
    const maxRevenue = Math.max(...points.map(p => p.revenue), points[0]?.totalCost || 0, 1);
    const maxSales = curve.maxSales || 1;
    const W = 320, H = 180, P = 20;
    const toX = sales => P + (sales / maxSales) * (W - 2 * P);
    const toY = revenue => H - P - (revenue / maxRevenue) * (H - 2 * P);
    const revenuePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.sales).toFixed(1)} ${toY(p.revenue).toFixed(1)}`).join(' ');
    const costPath = `M ${toX(0)} ${toY(points[0].totalCost).toFixed(1)} L ${toX(maxSales).toFixed(1)} ${toY(points[0].totalCost).toFixed(1)}`;
    const beX = curve.breakevenSales !== null ? toX(curve.breakevenSales) : null;
    return `<svg viewBox="0 0 ${W} ${H}" class="w-full h-44">
      <defs>
        <linearGradient id="revGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#10b981" stop-opacity="0.35"/><stop offset="100%" stop-color="#10b981" stop-opacity="0"/></linearGradient>
      </defs>
      <rect x="0" y="0" width="${W}" height="${H}" fill="transparent"/>
      <path d="${revenuePath} L ${toX(maxSales).toFixed(1)} ${(H - P).toFixed(1)} L ${toX(0).toFixed(1)} ${(H - P).toFixed(1)} Z" fill="url(#revGrad)" />
      <path d="${revenuePath}" stroke="#10b981" stroke-width="2" fill="none"/>
      <path d="${costPath}" stroke="#ef4444" stroke-width="2" stroke-dasharray="4 4" fill="none"/>
      ${beX !== null ? `<line x1="${beX.toFixed(1)}" y1="${P}" x2="${beX.toFixed(1)}" y2="${(H - P).toFixed(1)}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="2 3"/><text x="${beX.toFixed(1)}" y="${(P - 6).toFixed(1)}" fill="#f59e0b" font-size="10" font-weight="900" text-anchor="middle">BE ${curve.breakevenSales}</text>` : ''}
      <text x="${P}" y="${(H - 4).toFixed(1)}" fill="#94a3b8" font-size="9">0 vendas</text>
      <text x="${(W - P).toFixed(1)}" y="${(H - 4).toFixed(1)}" fill="#94a3b8" font-size="9" text-anchor="end">${Math.round(maxSales)} vendas</text>
    </svg>
    <div class="flex gap-4 text-[11px] text-slate-300 mt-2"><span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-400"></span> Receita líquida</span><span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-red-400"></span> G&A fixo</span>${curve.breakevenSales !== null ? `<span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-400"></span> Breakeven (${curve.breakevenSales})</span>` : ''}</div>`;
  },

  _waterfall(metrics) {
    return `<div class="rounded-[1.75rem] border border-white/10 bg-white/[0.055] backdrop-blur-xl p-5">
      <h3 class="text-lg font-black mb-3">Resumo Executivo da Projeção</h3>
      <div class="grid lg:grid-cols-4 gap-3 text-center">
        <div class="rounded-2xl bg-black/20 border border-white/10 p-4"><p class="text-xs text-slate-400 font-bold uppercase">EBITDA</p><p class="text-2xl font-black mt-1 ${metrics.ebitda >= 0 ? 'text-emerald-300' : 'text-red-300'}">${RevopsFinanceEngine.money(metrics.ebitda)}</p></div>
        <div class="rounded-2xl bg-black/20 border border-white/10 p-4"><p class="text-xs text-slate-400 font-bold uppercase">Margem EBITDA</p><p class="text-2xl font-black mt-1">${RevopsFinanceEngine.percent(metrics.ebitdaMargin)}</p></div>
        <div class="rounded-2xl bg-black/20 border border-white/10 p-4"><p class="text-xs text-slate-400 font-bold uppercase">Breakeven (vendas)</p><p class="text-2xl font-black mt-1">${metrics.breakevenSales === null ? '—' : metrics.breakevenSales}</p></div>
        <div class="rounded-2xl bg-black/20 border border-white/10 p-4"><p class="text-xs text-slate-400 font-bold uppercase">Contribuição unitária</p><p class="text-2xl font-black mt-1">${RevopsFinanceEngine.money(metrics.contributionUnit)}</p></div>
      </div>
    </div>`;
  },

  _footerActions(loadedScenario) {
    const updateLabel = loadedScenario ? `Atualizar "${loadedScenario.name}"` : 'Salvar Cenário de Projeção';
    return `<div class="rounded-[1.75rem] border border-white/10 bg-white/[0.055] backdrop-blur-xl p-5 flex flex-col lg:flex-row gap-3 justify-end">
      <button onclick="Actions.openRevopsScenarioName()" class="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black flex items-center gap-2"><i data-lucide="bookmark-plus" class="w-4 h-4"></i> ${Utils.escape(updateLabel)}</button>
      <button onclick="Actions.applyRevopsSimulationToProduct()" class="px-5 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-black flex items-center gap-2"><i data-lucide="upload" class="w-4 h-4"></i> Aplicar ao produto oficial</button>
      <button onclick="Actions.closeRevopsSimulation()" class="px-5 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-black flex items-center gap-2"><i data-lucide="x" class="w-4 h-4"></i> Descartar e Fechar</button>
    </div>`;
  }
};
window.RevopsSimulationModal = RevopsSimulationModal;

// Sub-modal: input do nome do cenário antes de salvar.
var RevopsScenarioNameModal = {
  render() {
    if (!App.state.showRevopsScenarioNameModal) return '';
    const draftName = App.state.revopsScenarioDraftName || '';
    return `<div class="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm grid place-items-center p-4">
      <div class="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md text-white">
        <h3 class="text-2xl font-black mb-2">Nome do cenário</h3>
        <p class="text-sm text-slate-300 mb-4">Dê um rótulo para reabrir depois. Ex.: "Cenário Otimista — 1.500 vendas".</p>
        <input id="revopsScenarioNameInput" value="${Utils.escape(draftName)}" oninput="App.state.revopsScenarioDraftName=this.value" placeholder="Cenário..." class="w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-bold mb-4" autofocus />
        <div class="flex justify-end gap-2">
          <button onclick="Actions.cancelRevopsScenarioName()" class="px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-black">Cancelar</button>
          <button onclick="Actions.confirmRevopsScenarioName()" class="px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black">Salvar</button>
        </div>
      </div>
    </div>`;
  }
};
window.RevopsScenarioNameModal = RevopsScenarioNameModal;
