// V32.8.1 (RevOps Whitelabel — Onda 2) — Painel novo com 5 tabs + gating.
//
// Estrutura:
//   [Header: produto + período + sales + métricas strip]
//   [Tabs: 💰 Custos · 🟢 Ofertas & TM · 📊 Resultado · 🌹 RevOps · ⚪ DRE]
//   [Conteúdo da tab ativa]
//
// Gating progressivo (D3 cravado):
//   - Custos e Ofertas&TM abertas por default
//   - Resultado/RevOps/DRE TRANCAM com candeado até:
//     (≥1 grupo com ≥1 item) + (≥1 oferta com preço) + (salesProjection > 0)
//
// Builder A: dropdown de "tipo de cálculo" + campos guiados por modo.
// Modo B (Excel/expressão livre) vai pra V32.8.2.

(function() {
  'use strict';

  const TABS = [
    { id: 'costs',    label: 'Custos',         icon: '💰', alwaysOpen: true  },
    { id: 'offers',   label: 'Ofertas & TM',   icon: '🟢', alwaysOpen: true  },
    { id: 'result',   label: 'Resultado',      icon: '📊', alwaysOpen: false },
    { id: 'revops',   label: 'RevOps KPIs',    icon: '🌹', alwaysOpen: false },
    { id: 'dre',      label: 'DRE',            icon: '⚪', alwaysOpen: false }
  ];

  const CALC_MODES = [
    { id: 'fixed',           label: 'Valor fixo (R$)',           hint: 'Insira o valor mensal exato' },
    { id: 'percent_self',    label: '% sobre valor de referência', hint: 'X% de um valor que você define (ex: alocação)' },
    { id: 'percent_of',      label: '% sobre outro item/handle', hint: 'X% de outro item ou métrica (ex: 30% do Fat. Bruto)' },
    { id: 'derived',         label: 'Soma de outro grupo',       hint: 'Total de outro grupo (ex: S&M = total Aquisição)' },
    { id: 'custom_formula',  label: 'Fórmula avançada (Modo B)', hint: 'Expressão livre — edição completa só no Modo Excel (em breve)' }
  ];

  const BUCKETS = [
    { id: 'fixed',       label: 'Fixos (G&A)' },
    { id: 'acquisition', label: 'Aquisição (S&M)' },
    { id: 'variable',    label: 'Variáveis (% sobre Faturamento)' },
    { id: 'custom',      label: 'Outro' }
  ];

  const RevopsWhitelabelPanel = {

    render() {
      const products = App.state.products || [];
      if (!products.length) {
        return `<div class="rounded-3xl bg-slate-50 border border-slate-200 p-8 text-center">
          <p class="text-sm text-slate-600">Cadastre um produto primeiro pra abrir o RevOps.</p>
        </div>`;
      }
      const productId = this._currentProductId();
      const cfg = this._currentConfig(productId);
      const evaluation = RevopsWhitelabelEngine.evaluate(cfg);
      const activeTab = this._activeTab();
      const tabUnlocked = this._tabUnlockState(cfg);

      return `<div class="space-y-4">
        ${this._header(productId, products, cfg, evaluation)}
        ${this._tabsBar(activeTab, tabUnlocked)}
        <div class="bg-white rounded-3xl border border-slate-200 p-5">
          ${this._tabContent(activeTab, cfg, evaluation, tabUnlocked)}
        </div>
      </div>`;
    },

    // ────────────────────────────────────────────────────────────
    // HEADER + MÉTRICAS STRIP
    // ────────────────────────────────────────────────────────────

    _header(productId, products, cfg, ev) {
      const periodLabel = cfg.period === 'yearly' ? 'Anual' : cfg.period === 'quarterly' ? 'Trimestral' : 'Mensal';
      return `<div class="bg-gradient-to-br from-violet-50 to-slate-50 rounded-3xl border border-violet-200 p-5">
        <div class="flex items-start justify-between gap-3 flex-wrap mb-3">
          <div>
            <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest">RevOps & Governança · DRE Operacional</p>
            <h2 class="text-xl font-black text-slate-900 mt-0.5">Whitelabel — modele sua operação como ela é</h2>
            <p class="text-[12px] text-slate-600 mt-1">Sem categorias forçadas: você cria os grupos e itens, o sistema calcula EBITDA/Breakeven.</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <select onchange="Actions.setRevopsActiveProductId(this.value)" class="px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-bold text-slate-800">
              ${products.map(p => `<option value="${p.id}" ${Number(p.id) === Number(productId) ? 'selected' : ''}>${Utils.escape(p.name)}</option>`).join('')}
            </select>
            <select onchange="Actions.setRevopsWhitelabelPeriod('${productId}', this.value)" class="px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-bold text-slate-800">
              <option value="monthly"   ${cfg.period === 'monthly'   ? 'selected' : ''}>Mensal</option>
              <option value="quarterly" ${cfg.period === 'quarterly' ? 'selected' : ''}>Trimestral</option>
              <option value="yearly"    ${cfg.period === 'yearly'    ? 'selected' : ''}>Anual</option>
            </select>
            <button onclick="Actions.toggleRevopsClassicMode()" title="Voltar ao painel clássico (V14)" class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold">← Clássico</button>
          </div>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
          ${this._metricCell('Ticket Médio', this._money(ev.ticket), 'violet')}
          ${this._metricCell(`Faturamento Bruto (${periodLabel})`, this._money(ev.fatBruto), 'emerald')}
          ${this._metricCell('Faturamento Líquido', this._money(ev.fatLiquido), 'sky')}
          ${this._metricCell('EBITDA', this._money(ev.ebitda), ev.ebitda >= 0 ? 'emerald' : 'rose')}
          ${this._metricCell('Margem EBITDA', `${ev.ebitdaMargin.toFixed(1)}%`, ev.ebitdaMargin >= 25 ? 'emerald' : ev.ebitdaMargin >= 0 ? 'amber' : 'rose')}
        </div>

        <div class="mt-3 flex items-center gap-3 flex-wrap">
          <label class="text-[11px] font-black text-slate-600 uppercase">Vendas previstas no período:</label>
          <input type="number" min="0" value="${cfg.salesProjection}" onchange="Actions.setRevopsSalesProjection('${productId}', this.value)" placeholder="0" class="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-800 w-32" />
          <span class="text-[11px] text-slate-500 italic">Usado pra calcular Faturamento Bruto = Vendas × Ticket.</span>
        </div>
      </div>`;
    },

    _metricCell(label, value, tone) {
      const toneCls = {
        violet:  'bg-violet-100 border-violet-200 text-violet-900',
        emerald: 'bg-emerald-100 border-emerald-200 text-emerald-900',
        sky:     'bg-sky-100 border-sky-200 text-sky-900',
        amber:   'bg-amber-100 border-amber-200 text-amber-900',
        rose:    'bg-rose-100 border-rose-200 text-rose-900'
      }[tone] || 'bg-slate-100 border-slate-200 text-slate-900';
      return `<div class="rounded-xl border ${toneCls} px-3 py-2">
        <p class="text-[9px] font-black uppercase tracking-wider opacity-70">${label}</p>
        <p class="text-sm font-black mt-0.5 truncate">${value}</p>
      </div>`;
    },

    // ────────────────────────────────────────────────────────────
    // TABS BAR + GATING
    // ────────────────────────────────────────────────────────────

    _tabsBar(activeTab, unlocked) {
      return `<div class="flex items-center gap-1.5 overflow-x-auto pb-1">
        ${TABS.map(t => {
          const isActive = t.id === activeTab;
          const isLocked = !t.alwaysOpen && !unlocked.all;
          const baseCls = isActive
            ? 'bg-violet-600 text-white shadow-md'
            : isLocked
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-white border border-slate-200 hover:border-violet-300 text-slate-700';
          const onClick = isLocked
            ? `onclick="Utils.toast('${this._lockReason(unlocked)}')"`
            : `onclick="Actions.setRevopsWhitelabelTab('${t.id}')"`;
          return `<button ${onClick} class="px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 whitespace-nowrap transition ${baseCls}" ${isActive ? 'style="color:#fff!important;"' : ''}>
            ${isLocked ? '<i data-lucide="lock" class="w-3 h-3"></i>' : `<span class="text-sm">${t.icon}</span>`}
            ${t.label}
          </button>`;
        }).join('')}
      </div>`;
    },

    _lockReason(unlocked) {
      const faltas = [];
      if (!unlocked.hasCosts) faltas.push('1 custo');
      if (!unlocked.hasOffers) faltas.push('1 oferta com preço');
      if (!unlocked.hasSales) faltas.push('vendas previstas > 0');
      return `Pra abrir: ${faltas.join(' + ')}`;
    },

    _tabUnlockState(cfg) {
      const hasCosts = (cfg.groups || []).some(g => (g.items || []).length > 0);
      const hasOffers = (cfg.offers || []).some(o => Number(o.price) > 0);
      const hasSales = Number(cfg.salesProjection) > 0;
      return { hasCosts, hasOffers, hasSales, all: hasCosts && hasOffers && hasSales };
    },

    // ────────────────────────────────────────────────────────────
    // CONTEÚDO DAS TABS
    // ────────────────────────────────────────────────────────────

    _tabContent(tabId, cfg, ev, unlocked) {
      if (!TABS.find(t => t.id === tabId)?.alwaysOpen && !unlocked.all) {
        return this._lockedTabContent(tabId, unlocked);
      }
      switch (tabId) {
        case 'costs':  return this._costsTab(cfg, ev);
        case 'offers': return this._offersTab(cfg, ev);
        case 'result': return this._resultTab(cfg, ev);
        case 'revops': return this._revopsTab(cfg, ev);
        case 'dre':    return this._dreTab(cfg, ev);
        default:       return '';
      }
    },

    _lockedTabContent(tabId, unlocked) {
      const tab = TABS.find(t => t.id === tabId);
      return `<div class="py-12 text-center">
        <div class="w-16 h-16 rounded-full bg-slate-100 grid place-items-center mx-auto mb-3">
          <i data-lucide="lock" class="w-6 h-6 text-slate-400"></i>
        </div>
        <p class="font-black text-slate-900 text-base mb-1">${tab?.label} ainda está trancada</p>
        <p class="text-sm text-slate-500">${this._lockReason(unlocked)}</p>
      </div>`;
    },

    // ────────────────────────────────────────────────────────────
    // TAB 1: CUSTOS — grupos dinâmicos + Builder A
    // ────────────────────────────────────────────────────────────

    _costsTab(cfg, ev) {
      const groups = cfg.groups || [];
      const productId = cfg.productId;
      return `<div class="space-y-4">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 class="font-black text-slate-900">Seus custos e despesas</h3>
            <p class="text-[12px] text-slate-500 mt-0.5">Crie grupos como faz na sua planilha. Cada item pode ser valor fixo, % sobre algo, ou fórmula avançada.</p>
          </div>
          <div class="flex items-center gap-2">
            <select id="lj-revops-new-bucket" class="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800">
              ${BUCKETS.map(b => `<option value="${b.id}">${b.label}</option>`).join('')}
            </select>
            <button onclick="Actions.addRevopsGroup('${productId}', document.getElementById('lj-revops-new-bucket').value)" class="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black flex items-center gap-1.5" style="color:#fff!important;">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i> Novo grupo
            </button>
          </div>
        </div>

        ${groups.length === 0
          ? `<div class="rounded-2xl bg-amber-50 border border-amber-300 p-5 text-center">
              <p class="text-sm font-bold text-amber-900 mb-1">Nenhum grupo criado ainda</p>
              <p class="text-xs text-amber-800">Crie pelo menos um (ex: "Software", "Aquisição") pra começar a montar seu DRE.</p>
            </div>`
          : groups.map(g => this._groupCard(productId, g, ev)).join('')}
      </div>`;
    },

    _groupCard(productId, group, ev) {
      const items = group.items || [];
      const total = ev.groupTotals[group.id] || 0;
      const bucketLabel = BUCKETS.find(b => b.id === group.bucket)?.label || group.bucket;
      return `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-4">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <input value="${Utils.escape(group.label)}" onchange="Actions.renameRevopsGroup('${productId}', '${group.id}', this.value)" class="font-black text-slate-900 text-sm bg-transparent border-b border-transparent hover:border-slate-300 focus:border-violet-500 focus:outline-none px-1 py-0.5" />
              <span class="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">${Utils.escape(bucketLabel)}</span>
              <code class="text-[9px] text-slate-400">${group.id}</code>
            </div>
            <p class="text-[10px] text-slate-500 mt-1">${items.length} item(ns) · Total: <b class="text-slate-800">${this._money(total)}</b></p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button onclick="Actions.addRevopsItem('${productId}', '${group.id}')" class="px-2 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-[10px] font-black flex items-center gap-1">
              <i data-lucide="plus" class="w-3 h-3"></i> Item
            </button>
            <button onclick="if(confirm('Apagar grupo \\'${Utils.escape(group.label)}\\' e todos os itens?')) Actions.deleteRevopsGroup('${productId}', '${group.id}')" class="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-[10px] font-black">×</button>
          </div>
        </div>

        ${items.length === 0
          ? `<p class="text-[11px] text-slate-400 italic px-2 py-3 text-center">Sem itens. Clique "+ Item" pra adicionar.</p>`
          : `<div class="space-y-2">${items.map(it => this._itemRow(productId, group, it, ev)).join('')}</div>`}
      </div>`;
    },

    _itemRow(productId, group, item, ev) {
      const calc = item.calc || { mode: 'fixed', value: 0 };
      const value = ev.itemValues[item.id] || 0;
      return `<div class="rounded-xl bg-white border border-slate-200 p-3">
        <div class="flex items-start gap-2 mb-2">
          <input value="${Utils.escape(item.name)}" onchange="Actions.renameRevopsItem('${productId}', '${group.id}', '${item.id}', this.value)" placeholder="Nome do item" class="flex-1 min-w-0 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-sm font-bold text-slate-800" />
          <div class="text-right shrink-0">
            <p class="text-[9px] font-black text-slate-400 uppercase">Calculado</p>
            <p class="text-sm font-black text-slate-900 whitespace-nowrap">${this._money(value)}</p>
          </div>
          <button onclick="if(confirm('Apagar item \\'${Utils.escape(item.name)}\\'?')) Actions.deleteRevopsItem('${productId}', '${group.id}', '${item.id}')" class="px-1.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-black shrink-0">×</button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-2 items-end">
          <div>
            <label class="text-[9px] font-black text-slate-500 uppercase block mb-0.5">Tipo de cálculo</label>
            <select onchange="Actions.changeRevopsItemMode('${productId}', '${group.id}', '${item.id}', this.value)" class="w-full px-2 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800">
              ${CALC_MODES.map(m => `<option value="${m.id}" ${calc.mode === m.id ? 'selected' : ''}>${m.label}</option>`).join('')}
            </select>
          </div>
          <div>
            ${this._calcInputs(productId, group, item, calc)}
          </div>
        </div>
      </div>`;
    },

    _calcInputs(productId, group, item, calc) {
      const update = (field) => `Actions.updateRevopsItemCalc('${productId}', '${group.id}', '${item.id}', '${field}', this.value)`;
      switch (calc.mode) {
        case 'fixed':
          return `<label class="block">
            <span class="text-[9px] font-black text-slate-500 uppercase">Valor (R$)</span>
            <input type="number" step="0.01" value="${calc.value || 0}" oninput="${update('value')}" class="mt-0.5 w-full px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-800" />
          </label>`;
        case 'percent_self':
          return `<div class="grid grid-cols-2 gap-2">
            <label class="block">
              <span class="text-[9px] font-black text-slate-500 uppercase">Valor base (R$)</span>
              <input type="number" step="0.01" value="${calc.baseValue || 0}" oninput="${update('baseValue')}" class="mt-0.5 w-full px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-800" />
            </label>
            <label class="block">
              <span class="text-[9px] font-black text-slate-500 uppercase">% aplicado</span>
              <input type="number" step="0.1" value="${calc.factor || 0}" oninput="${update('factor')}" class="mt-0.5 w-full px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-800" />
            </label>
          </div>`;
        case 'percent_of': {
          const handles = RevopsWhitelabelEngine.availableHandles(this._currentConfig(productId));
          return `<div class="grid grid-cols-2 gap-2">
            <label class="block">
              <span class="text-[9px] font-black text-slate-500 uppercase">Base (referência)</span>
              <select onchange="${update('base')}" class="mt-0.5 w-full px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-800">
                <option value="">— escolha —</option>
                ${handles.filter(h => h.id !== item.id).map(h => `<option value="${h.id}" ${calc.base === h.id ? 'selected' : ''}>${Utils.escape(h.label)} (${h.id})</option>`).join('')}
              </select>
            </label>
            <label class="block">
              <span class="text-[9px] font-black text-slate-500 uppercase">% aplicado</span>
              <input type="number" step="0.1" value="${calc.factor || 0}" oninput="${update('factor')}" class="mt-0.5 w-full px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-800" />
            </label>
          </div>`;
        }
        case 'derived': {
          const groups = (this._currentConfig(productId).groups || []).filter(g => g.id !== group.id);
          return `<label class="block">
            <span class="text-[9px] font-black text-slate-500 uppercase">Grupo de referência</span>
            <select onchange="${update('groupRef')}" class="mt-0.5 w-full px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-800">
              <option value="">— escolha —</option>
              ${groups.map(g => `<option value="${g.id}" ${calc.groupRef === g.id ? 'selected' : ''}>${Utils.escape(g.label)} (total)</option>`).join('')}
            </select>
          </label>`;
        }
        case 'custom_formula':
          return `<label class="block">
            <span class="text-[9px] font-black text-slate-500 uppercase">Fórmula (Modo B — edição completa na V32.8.2)</span>
            <input type="text" value="${Utils.escape(calc.formula || '=0')}" oninput="${update('formula')}" placeholder="=fat_bruto * 0.3" class="mt-0.5 w-full px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-sm font-mono text-slate-800" />
            <p class="text-[10px] text-amber-700 mt-0.5"><i data-lucide="zap" class="w-3 h-3 inline-block"></i> Use handles: <code>fat_bruto</code>, <code>ebitda</code>, <code>g_software_total</code>, etc.</p>
          </label>`;
        default:
          return '';
      }
    },

    // ────────────────────────────────────────────────────────────
    // TAB 2: OFERTAS & TM
    // ────────────────────────────────────────────────────────────

    _offersTab(cfg, ev) {
      const offers = cfg.offers || [];
      const productId = cfg.productId;
      return `<div class="space-y-4">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 class="font-black text-slate-900">Ofertas e Ticket Médio</h3>
            <p class="text-[12px] text-slate-500 mt-0.5">Cadastre as ofertas com preço e mix. Sistema calcula o TM ponderado, ou você define manual.</p>
          </div>
          <button onclick="Actions.addRevopsOffer('${productId}')" class="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5" style="color:#fff!important;">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i> Nova oferta
          </button>
        </div>

        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3 flex items-center gap-3 flex-wrap">
          <label class="text-[11px] font-black text-slate-600 uppercase">Modo do TM:</label>
          <label class="flex items-center gap-1.5 text-xs"><input type="radio" name="lj-tm-mode" ${cfg.ticketMode === 'weighted' ? 'checked' : ''} onchange="Actions.setRevopsTicketMode('${productId}', 'weighted')" /> Ponderado (preço × mix)</label>
          <label class="flex items-center gap-1.5 text-xs"><input type="radio" name="lj-tm-mode" ${cfg.ticketMode === 'manual' ? 'checked' : ''} onchange="Actions.setRevopsTicketMode('${productId}', 'manual')" /> Manual</label>
          ${cfg.ticketMode === 'manual'
            ? `<input type="number" step="0.01" value="${cfg.ticketManualValue}" onchange="Actions.setRevopsTicketManual('${productId}', this.value)" placeholder="Ticket manual" class="px-2 py-1 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-800 w-32" />`
            : `<span class="text-xs text-slate-500">TM calculado: <b class="text-slate-800">${this._money(ev.ticket)}</b></span>`}
        </div>

        ${offers.length === 0
          ? `<div class="rounded-2xl bg-amber-50 border border-amber-300 p-5 text-center">
              <p class="text-sm font-bold text-amber-900 mb-1">Nenhuma oferta cadastrada</p>
              <p class="text-xs text-amber-800">Sem oferta, Faturamento Bruto = 0. Crie ao menos uma.</p>
            </div>`
          : `<div class="space-y-2">${offers.map(o => this._offerRow(productId, o, cfg.ticketMode)).join('')}</div>`}
      </div>`;
    },

    _offerRow(productId, offer, ticketMode) {
      const isWeighted = ticketMode === 'weighted';
      return `<div class="rounded-xl bg-white border border-slate-200 p-3 flex items-center gap-2">
        <input value="${Utils.escape(offer.name)}" onchange="Actions.renameRevopsOffer('${productId}', '${offer.id}', this.value)" placeholder="Nome da oferta" class="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-sm font-bold text-slate-800" />
        <label class="block w-28">
          <span class="text-[9px] font-black text-slate-500 uppercase">Preço (R$)</span>
          <input type="number" step="0.01" value="${offer.price}" onchange="Actions.updateRevopsOfferField('${productId}', '${offer.id}', 'price', this.value)" class="mt-0.5 w-full px-2 py-1 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-800" />
        </label>
        ${isWeighted ? `<label class="block w-20">
          <span class="text-[9px] font-black text-slate-500 uppercase">Mix (%)</span>
          <input type="number" step="0.1" value="${offer.mix}" onchange="Actions.updateRevopsOfferField('${productId}', '${offer.id}', 'mix', this.value)" class="mt-0.5 w-full px-2 py-1 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-800" />
        </label>
        <label class="flex items-center gap-1 text-[11px] text-slate-700 ml-1">
          <input type="checkbox" ${offer.selectedForTicket ? 'checked' : ''} onchange="Actions.toggleRevopsOfferTicket('${productId}', '${offer.id}')" />
          TM
        </label>` : ''}
        <button onclick="if(confirm('Apagar oferta \\'${Utils.escape(offer.name)}\\'?')) Actions.deleteRevopsOffer('${productId}', '${offer.id}')" class="px-1.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-black shrink-0">×</button>
      </div>`;
    },

    // ────────────────────────────────────────────────────────────
    // TAB 3: RESULTADO
    // ────────────────────────────────────────────────────────────

    _resultTab(cfg, ev) {
      const realSales = RevopsFinanceEngine?.productRealSales?.(cfg.productId) || 0;
      const realRevenue = realSales * ev.ticket;
      const cac = realSales > 0 ? ev.acquisitionTotal / realSales : 0;
      return `<div class="space-y-3">
        <h3 class="font-black text-slate-900">Resultado consolidado</h3>
        <p class="text-[12px] text-slate-500">Comparação previsto × real. CAC vem do total da Aquisição dividido pelos convertidos no funil.</p>
        <div class="grid md:grid-cols-3 gap-3">
          ${this._bigCell('Vendas previstas',  Math.round(ev.sales).toLocaleString('pt-BR'), 'violet')}
          ${this._bigCell('Vendas reais',      Math.round(realSales).toLocaleString('pt-BR'), 'sky')}
          ${this._bigCell('CAC efetivo',       this._money(cac), cac > 0 && cac <= ev.ticket ? 'emerald' : 'amber')}
          ${this._bigCell('Faturamento previsto', this._money(ev.fatBruto), 'violet')}
          ${this._bigCell('Faturamento real',  this._money(realRevenue), 'sky')}
          ${this._bigCell('Aquisição total',   this._money(ev.acquisitionTotal), 'rose')}
        </div>
      </div>`;
    },

    _bigCell(label, value, tone) {
      const toneCls = {
        violet: 'bg-violet-50 border-violet-200 text-violet-900',
        sky:    'bg-sky-50 border-sky-200 text-sky-900',
        emerald:'bg-emerald-50 border-emerald-200 text-emerald-900',
        amber:  'bg-amber-50 border-amber-200 text-amber-900',
        rose:   'bg-rose-50 border-rose-200 text-rose-900'
      }[tone] || 'bg-slate-50 border-slate-200 text-slate-900';
      return `<div class="rounded-2xl border ${toneCls} p-4">
        <p class="text-[10px] font-black uppercase tracking-wider opacity-80">${label}</p>
        <p class="text-2xl font-black mt-1">${value}</p>
      </div>`;
    },

    // ────────────────────────────────────────────────────────────
    // TAB 4: REVOPS KPIs
    // ────────────────────────────────────────────────────────────

    _revopsTab(cfg, ev) {
      const mcu = ev.ticket > 0 ? ev.ticket : 0;
      const msu = ev.fixedTotal > 0 && mcu > 0 ? Math.ceil(ev.fixedTotal / mcu) : 0;
      const breakevenRevenue = msu * ev.ticket;
      const customKpis = cfg.customKpis || [];
      return `<div class="space-y-4">
        <h3 class="font-black text-slate-900">RevOps KPIs (rosa)</h3>
        <p class="text-[12px] text-slate-500">Margem de contribuição, breakeven, e KPIs custom que você criar via fórmula.</p>

        <div class="grid md:grid-cols-3 gap-3">
          ${this._bigCell('MCU — Margem Contribuição Unit.', this._money(mcu), 'rose')}
          ${this._bigCell('MSU — Breakeven (vendas)', msu.toLocaleString('pt-BR'), 'rose')}
          ${this._bigCell('Faturamento no Breakeven', this._money(breakevenRevenue), 'rose')}
        </div>

        <div class="rounded-2xl bg-rose-50/50 border border-rose-200 p-3">
          <div class="flex items-center justify-between mb-2">
            <p class="text-[11px] font-black text-rose-700 uppercase tracking-wider">KPIs Custom (fórmula livre)</p>
            <button onclick="Actions.addRevopsCustomKpi('${cfg.productId}')" class="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black" style="color:#fff!important;">+ KPI</button>
          </div>
          ${customKpis.length === 0
            ? '<p class="text-[11px] text-rose-700/70 italic">Crie KPIs personalizados como % crescimento receita, NRR, etc.</p>'
            : customKpis.map(k => this._customKpiRow(cfg.productId, k, ev)).join('')}
        </div>
      </div>`;
    },

    _customKpiRow(productId, kpi, ev) {
      const value = ev.customKpiValues?.[kpi.id] || 0;
      const display = kpi.unit === 'percent' ? `${value.toFixed(1)}%` : kpi.unit === 'BRL' ? this._money(value) : value.toLocaleString('pt-BR');
      return `<div class="rounded-xl bg-white border border-rose-200 p-2 mt-2 flex items-center gap-2">
        <input value="${Utils.escape(kpi.name)}" onchange="Actions.updateRevopsCustomKpi('${productId}', '${kpi.id}', 'name', this.value)" placeholder="Nome do KPI" class="flex-1 min-w-0 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800" />
        <input value="${Utils.escape(kpi.formula)}" onchange="Actions.updateRevopsCustomKpi('${productId}', '${kpi.id}', 'formula', this.value)" placeholder="=fat_bruto / sales" class="flex-1 min-w-0 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono text-slate-800" />
        <select onchange="Actions.updateRevopsCustomKpi('${productId}', '${kpi.id}', 'unit', this.value)" class="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800">
          <option value="BRL" ${kpi.unit === 'BRL' ? 'selected' : ''}>R$</option>
          <option value="percent" ${kpi.unit === 'percent' ? 'selected' : ''}>%</option>
          <option value="unit" ${kpi.unit === 'unit' ? 'selected' : ''}>un</option>
        </select>
        <span class="text-sm font-black text-rose-900 w-24 text-right">${display}</span>
        <button onclick="Actions.deleteRevopsCustomKpi('${productId}', '${kpi.id}')" class="px-1.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-black">×</button>
      </div>`;
    },

    // ────────────────────────────────────────────────────────────
    // TAB 5: DRE
    // ────────────────────────────────────────────────────────────

    _dreTab(cfg, ev) {
      const lines = [
        { label: '(+) Faturamento Bruto',   value: ev.fatBruto,             tone: 'emerald', bold: true },
        { label: '(−) Custos Variáveis',    value: -ev.variableTotal,       tone: 'rose'                 },
        { label: '(=) Faturamento Líquido', value: ev.fatLiquido,           tone: 'sky',     bold: true },
        { label: '(−) G&A (Fixos)',         value: -ev.fixedTotal,          tone: 'rose'                 },
        { label: '(=) Resultado após Fixos',value: ev.resultadoAposFixos,   tone: 'amber',   bold: true },
        { label: '(−) Aquisição (S&M)',     value: -ev.acquisitionTotal,    tone: 'rose'                 },
        { label: '(=) EBITDA',              value: ev.ebitda,               tone: ev.ebitda >= 0 ? 'emerald' : 'rose', bold: true, highlight: true }
      ];
      return `<div class="space-y-3">
        <h3 class="font-black text-slate-900">DRE Operacional (cinza da planilha)</h3>
        <p class="text-[12px] text-slate-500">Demonstrativo do Resultado do Exercício — operacional. Linha por linha do Bruto até o EBITDA.</p>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden">
          ${lines.map(l => {
            const cls = l.highlight ? 'bg-amber-50' : l.bold ? 'bg-white' : '';
            const textCls = {
              emerald: 'text-emerald-700',
              rose:    'text-rose-700',
              sky:     'text-sky-700',
              amber:   'text-amber-700'
            }[l.tone] || 'text-slate-700';
            return `<div class="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-200 last:border-b-0 ${cls}">
              <span class="${l.bold ? 'font-black text-slate-900' : 'text-slate-600'} text-[13px]">${l.label}</span>
              <span class="${l.bold ? 'font-black text-base' : 'font-bold text-sm'} ${textCls} whitespace-nowrap">${this._money(l.value)}</span>
            </div>`;
          }).join('')}
        </div>
        <div class="rounded-xl bg-slate-100 border border-slate-200 p-3 text-[11px] text-slate-600">
          <b>Saúde da operação:</b> ${ev.health} · Margem EBITDA: <b class="text-slate-900">${ev.ebitdaMargin.toFixed(1)}%</b>
        </div>
      </div>`;
    },

    // ────────────────────────────────────────────────────────────
    // HELPERS
    // ────────────────────────────────────────────────────────────

    _currentProductId() {
      const stored = App.state.revopsSelectedProductId;
      const products = App.state.products || [];
      if (stored && products.find(p => Number(p.id) === Number(stored))) return Number(stored);
      return products[0]?.id || null;
    },

    _currentConfig(productId) {
      if (!productId) return RevopsWhitelabelEngine.defaultConfig(productId);
      const stored = App.state.revopsFinanceV2?.[productId];
      if (stored) return RevopsWhitelabelEngine.normalize(stored, productId);
      // Sem V2 ainda — tenta migrar do legacy on-the-fly
      const legacy = App.state.revopsFinance?.[productId];
      if (legacy) return RevopsWhitelabelEngine.migrateFromLegacy(legacy);
      return RevopsWhitelabelEngine.defaultConfig(productId);
    },

    _activeTab() {
      const stored = App.state.revopsWhitelabelActiveTab;
      if (stored && TABS.find(t => t.id === stored)) return stored;
      return 'costs';
    },

    _money(value) {
      const n = Number(value) || 0;
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
    }
  };

  window.RevopsWhitelabelPanel = RevopsWhitelabelPanel;
})();
