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
          <input type="number" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" min="0" value="${cfg.salesProjection}" onchange="Actions.setRevopsSalesProjection('${productId}', this.value)" placeholder="0" class="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-800 w-32" />
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
      const excelMode = !!App.state.revopsExcelMode;
      return `<div class="space-y-4">
        ${this._djowTip('costs')}
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 class="font-black text-slate-900">Seus custos e despesas</h3>
            <p class="text-[12px] text-slate-500 mt-0.5">Crie grupos como faz na sua planilha. Cada item pode ser valor fixo, % sobre algo, ou fórmula avançada.</p>
          </div>
          <div class="flex items-center gap-2 flex-wrap">
            ${/* V32.8.2 — Toggle Modo A (Builder) ↔ Modo B (Excel). Item por item
                 fica sincronizado: o que você cria em A vê como fórmula em B; o
                 que edita em B vira custom_formula automático. */ ''}
            <div class="inline-flex items-center rounded-xl bg-slate-100 border border-slate-200 p-0.5">
              <button onclick="Actions.setRevopsExcelMode(false)" class="px-2.5 py-1.5 rounded-lg text-xs font-black ${!excelMode ? 'bg-violet-600 text-white' : 'text-slate-600'}" ${!excelMode ? 'style="color:#fff!important;"' : ''}>📝 Builder</button>
              <button onclick="Actions.setRevopsExcelMode(true)" class="px-2.5 py-1.5 rounded-lg text-xs font-black ${excelMode ? 'bg-violet-600 text-white' : 'text-slate-600'}" ${excelMode ? 'style="color:#fff!important;"' : ''}>📊 Excel</button>
            </div>
            <select id="lj-revops-new-bucket" class="px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800">
              ${BUCKETS.map(b => `<option value="${b.id}">${b.label}</option>`).join('')}
            </select>
            <button onclick="Actions.addRevopsGroup('${productId}', document.getElementById('lj-revops-new-bucket').value)" class="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black flex items-center gap-1.5" style="color:#fff!important;">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i> Novo grupo
            </button>
          </div>
        </div>

        ${excelMode ? this._handlesLegend(cfg) : ''}
        ${this._handlesDatalist(cfg)}

        ${groups.length === 0
          ? `<div class="rounded-2xl bg-amber-50 border border-amber-300 p-5 text-center">
              <p class="text-sm font-bold text-amber-900 mb-1">Nenhum grupo criado ainda</p>
              <p class="text-xs text-amber-800">Crie pelo menos um (ex: "Software", "Aquisição") pra começar a montar seu DRE.</p>
            </div>`
          : groups.map(g => this._groupCard(productId, g, ev, excelMode)).join('')}
      </div>`;
    },

    // V32.8.2 — Legenda dos handles disponíveis (aparece no Modo Excel).
    // Cliente vê de uma lista o que pode usar em fórmulas (sales, fat_bruto,
    // ebitda, g_<group>_total, ou qualquer item_id).
    _handlesLegend(cfg) {
      const handles = RevopsWhitelabelEngine.availableHandles(cfg);
      const specials = handles.filter(h => h.kind === 'special');
      const groupTotals = handles.filter(h => h.kind === 'group_total');
      const items = handles.filter(h => h.kind === 'item');
      const chip = (h) => `<code class="text-[10px] font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-700">${h.id}</code>`;
      return `<details open class="rounded-2xl bg-violet-50/40 border border-violet-200 p-3">
        <summary class="cursor-pointer text-[11px] font-black text-violet-800 uppercase tracking-wider flex items-center gap-1.5 select-none">
          <i data-lucide="zap" class="w-3.5 h-3.5"></i>
          Handles disponíveis no Modo Excel (${handles.length})
        </summary>
        <div class="mt-2 space-y-2 text-[11px]">
          <div>
            <p class="font-black text-slate-600 mb-1">Especiais (sempre disponíveis)</p>
            <div class="flex flex-wrap gap-1">${specials.map(chip).join('')}</div>
          </div>
          ${groupTotals.length ? `<div>
            <p class="font-black text-slate-600 mb-1">Totais de grupo</p>
            <div class="flex flex-wrap gap-1">${groupTotals.map(chip).join('')}</div>
          </div>` : ''}
          ${items.length ? `<div>
            <p class="font-black text-slate-600 mb-1">Itens cadastrados</p>
            <div class="flex flex-wrap gap-1">${items.slice(0, 30).map(chip).join('')}${items.length > 30 ? `<span class="text-slate-400">+${items.length - 30}</span>` : ''}</div>
          </div>` : ''}
          <p class="text-slate-500 italic mt-1">Exemplo: <code class="text-[10px] font-mono">=fat_bruto * 0.3 + g_software_total</code></p>
        </div>
      </details>`;
    },

    // V32.8.2 — Datalist HTML5 nativo pra autocomplete nos inputs de fórmula.
    // Browser sugere handles que casam com o que cliente digita.
    _handlesDatalist(cfg) {
      const handles = RevopsWhitelabelEngine.availableHandles(cfg);
      return `<datalist id="lj-revops-handles">
        ${handles.map(h => `<option value="${Utils.escape(h.id)}">${Utils.escape(h.label)}</option>`).join('')}
      </datalist>`;
    },

    // V32.8.2 → V32.8.3 — Dica Djow por tab.
    // - Estática (sempre): princípio operacional do bloco.
    // - Dinâmica (sob demanda): cliente clica "Pedir análise" → backend Claude
    //   Haiku one-shot c/ resumo enxuto do RevOps deste produto. Resposta
    //   cacheada em App.state.revopsDjowSuggestions[tabId] até refresh manual.
    _djowTip(tabId) {
      const tips = {
        costs:  'Comece pelos custos fixos óbvios (software, ferramentas). Depois liste aquisição (mídia paga, SDR). Variáveis (impostos, comissões) ficam pra depois.',
        offers: 'Mesmo que você tenha 1 oferta, cadastre — o sistema precisa pra calcular Faturamento Bruto (Vendas × Ticket).',
        result: 'CAC efetivo = Aquisição total ÷ Vendas reais (do funil). Se CAC > Ticket, você está pagando pra entregar — revise origens.',
        revops: 'MSU é seu Breakeven em vendas — número mínimo de vendas pra cobrir custos fixos. Se MSU > Vendas previstas, operação não respira.',
        dre:    'DRE roda Bruto → Variáveis → Líquido → G&A → Após Fixos → Aquisição → EBITDA. Margem EBITDA saudável: >25%.'
      };
      const tip = tips[tabId];
      if (!tip) return '';
      const productId = this._currentProductId();
      const suggestion = App.state.revopsDjowSuggestions?.[tabId];
      const loading = suggestion?.loading;
      const hasResult = !!suggestion?.suggestion;
      const hasError = !!suggestion?.error;
      const askedAtLabel = suggestion?.askedAt
        ? new Date(suggestion.askedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : null;

      return `<div class="rounded-xl bg-indigo-50 border border-indigo-200 p-3 space-y-2">
        <div class="flex items-start gap-2">
          <i data-lucide="sparkles" class="w-4 h-4 text-indigo-600 shrink-0 mt-0.5"></i>
          <p class="text-[12px] text-indigo-900 leading-relaxed flex-1"><b class="text-indigo-700">Djow:</b> ${tip}</p>
          ${hasResult || hasError
            ? `<button onclick="Actions.askRevopsDjow('${productId}', '${tabId}')" ${loading ? 'disabled' : ''} title="Re-pedir análise" class="px-2 py-1 rounded-lg bg-white border border-indigo-300 hover:bg-indigo-50 text-indigo-700 text-[10px] font-black flex items-center gap-1 shrink-0 disabled:opacity-50">
                <i data-lucide="${loading ? 'loader-2' : 'refresh-cw'}" class="w-3 h-3 ${loading ? 'animate-spin' : ''}"></i>
                ${loading ? 'Pensando…' : 'Re-analisar'}
              </button>`
            : `<button onclick="Actions.askRevopsDjow('${productId}', '${tabId}')" ${loading ? 'disabled' : ''} class="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black flex items-center gap-1 shrink-0 disabled:opacity-50" style="color:#fff!important;">
                <i data-lucide="${loading ? 'loader-2' : 'brain'}" class="w-3 h-3 ${loading ? 'animate-spin' : ''}"></i>
                ${loading ? 'Pensando…' : 'Pedir análise'}
              </button>`}
        </div>
        ${hasResult ? `<div class="rounded-lg bg-white border border-indigo-300 p-3 mt-2">
          <div class="flex items-start gap-2 mb-1">
            <span class="text-[9px] font-black text-indigo-700 uppercase tracking-wider">Análise contextual</span>
            <span class="text-[9px] text-slate-400">· ${askedAtLabel}</span>
            <button onclick="Actions.clearRevopsDjowSuggestion('${tabId}')" title="Fechar" class="ml-auto text-slate-400 hover:text-slate-600 text-[10px]">×</button>
          </div>
          <p class="text-[12px] text-slate-800 leading-relaxed whitespace-pre-wrap">${Utils.escape(suggestion.suggestion)}</p>
        </div>` : ''}
        ${hasError ? `<div class="rounded-lg bg-rose-50 border border-rose-200 p-2 text-[11px] text-rose-800">
          Falha: ${Utils.escape(suggestion.error)}
        </div>` : ''}
      </div>`;
    },

    _groupCard(productId, group, ev, excelMode = false) {
      const items = group.items || [];
      const total = ev.groupTotals[group.id] || 0;
      const bucketLabel = BUCKETS.find(b => b.id === group.bucket)?.label || group.bucket;
      // V32.9.4 — Collapse + Lock por grupo.
      // Lock: persistido, pede senha do login pra destravar (anti edição
      // acidental por colega em login compartilhado).
      // Collapse: UI state, qualquer click no chevron expande/recolhe.
      // Lock força collapse = true.
      const isLocked = !!App.state.revopsGroupLocked?.[group.id];
      const isCollapsed = isLocked || !!App.state.revopsGroupCollapsed?.[group.id];
      const cardCls = isLocked
        ? 'rounded-2xl bg-slate-100 border-2 border-slate-300 p-4'
        : 'rounded-2xl bg-slate-50 border border-slate-200 p-4';
      return `<div class="${cardCls}">
        <div class="flex items-start justify-between gap-3 ${isCollapsed ? '' : 'mb-3'}">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              ${isLocked ? '<i data-lucide="lock" class="w-3.5 h-3.5 text-slate-600"></i>' : ''}
              <input value="${Utils.escape(group.label)}" ${isLocked ? 'readonly' : ''} onchange="Actions.renameRevopsGroup('${productId}', '${group.id}', this.value)" class="font-black text-slate-900 text-sm bg-transparent border-b border-transparent ${isLocked ? '' : 'hover:border-slate-300 focus:border-violet-500'} focus:outline-none px-1 py-0.5" />
              <span class="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">${Utils.escape(bucketLabel)}</span>
              ${!isLocked ? `<code class="text-[9px] text-slate-400">${group.id}</code>` : ''}
            </div>
            <p class="text-[10px] text-slate-500 mt-1">${items.length} item(ns) · Total: <b class="text-slate-800">${this._money(total)}</b>${isLocked ? ' · <span class="text-slate-700 font-black">🔒 TRANCADO</span>' : ''}</p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            ${!isLocked
              ? `<button onclick="Actions.toggleRevopsGroupCollapsed('${group.id}')" title="${isCollapsed ? 'Expandir' : 'Recolher'}" class="px-1.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700"><i data-lucide="${isCollapsed ? 'chevron-down' : 'chevron-up'}" class="w-3 h-3"></i></button>`
              : ''}
            ${isLocked
              ? `<button onclick="Actions.requestUnlockRevopsGroup('${group.id}')" title="Destravar (pede senha do login)" class="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-[10px] font-black flex items-center gap-1" style="color:#fff!important;"><i data-lucide="unlock" class="w-3 h-3"></i> Destravar</button>`
              : `<button onclick="if(confirm('Trancar este grupo? Só destrava com sua senha de login.')) Actions.lockRevopsGroup('${group.id}')" title="Trancar (pede senha pra destravar)" class="px-1.5 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700"><i data-lucide="lock" class="w-3 h-3"></i></button>`}
            ${!isLocked ? `<button onclick="Actions.addRevopsItem('${productId}', '${group.id}')" class="px-2 py-1 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-[10px] font-black flex items-center gap-1">
              <i data-lucide="plus" class="w-3 h-3"></i> Item
            </button>` : ''}
            ${!isLocked ? `<button onclick="if(confirm('Apagar grupo \\'${Utils.escape(group.label)}\\' e todos os itens?')) Actions.deleteRevopsGroup('${productId}', '${group.id}')" class="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-[10px] font-black">×</button>` : ''}
          </div>
        </div>

        ${isCollapsed ? '' : (items.length === 0
          ? `<p class="text-[11px] text-slate-400 italic px-2 py-3 text-center">Sem itens. Clique "+ Item" pra adicionar.</p>`
          : `<div class="space-y-2">${items.map(it => excelMode
              ? this._itemRowExcel(productId, group, it, ev)
              : this._itemRow(productId, group, it, ev)
            ).join('')}</div>`)}
      </div>`;
    },

    // V32.8.2 — Renderização Modo B (Excel): item vira só uma linha com input
    // de fórmula + autocomplete via datalist + valor calculado.
    // Save vira calc.mode='custom_formula' automaticamente.
    _itemRowExcel(productId, group, item, ev) {
      const cfg = this._currentConfig(productId);
      const derivedFormula = RevopsWhitelabelEngine.deriveFormula(item.calc, cfg);
      const value = ev.itemValues[item.id] || 0;
      const isCustom = item.calc?.mode === 'custom_formula';
      // V32.9.8 — Validação compacta no Modo Excel: só borda colorida + title
      // tooltip (sem badge expandido pra não quebrar layout horizontal).
      const validation = RevopsWhitelabelEngine.validateFormula(derivedFormula, ev.symbols, item.id);
      const borderCls = validation.status === 'ok' ? 'border-emerald-300'
                      : validation.status === 'warn' ? 'border-amber-300'
                      : 'border-rose-400';
      return `<div class="rounded-xl bg-white border border-slate-200 p-2.5 flex items-center gap-2">
        <input value="${Utils.escape(item.name)}" onchange="Actions.renameRevopsItem('${productId}', '${group.id}', '${item.id}', this.value)" placeholder="Nome" class="w-40 shrink-0 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800" />
        <code class="text-[9px] text-slate-400 shrink-0">${item.id} =</code>
        <input type="text" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" title="${Utils.escape(validation.message)}" value="${Utils.escape(derivedFormula)}" list="lj-revops-handles" onchange="Actions.saveRevopsExcelFormula('${productId}', '${group.id}', '${item.id}', this.value)" placeholder="=fat_bruto * 0.3" class="flex-1 min-w-0 px-2 py-1 rounded-lg bg-amber-50 border ${borderCls} text-xs font-mono text-slate-800 focus:bg-white focus:border-amber-400" />
        <div class="text-right shrink-0 w-24">
          <p class="text-[9px] font-black text-slate-400 uppercase">Calculado</p>
          <p class="text-xs font-black text-slate-900 whitespace-nowrap">${this._money(value)}</p>
        </div>
        ${!isCustom ? `<span class="text-[9px] font-bold text-amber-700 shrink-0" title="Editar aqui vira fórmula custom (não dá pra voltar pro Builder fácil)">⚠</span>` : ''}
        <button onclick="if(confirm('Apagar item \\'${Utils.escape(item.name)}\\'?')) Actions.deleteRevopsItem('${productId}', '${group.id}', '${item.id}')" class="px-1.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-black shrink-0">×</button>
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
      // V32.9.5 — Inputs monetários usam mask BRL live (Utils.applyMoneyMask) +
      // parser tolerante no save (Utils.parseBRL). Aceita 115,29 / 1.234,56 /
      // R$ 1.000.000,00 / colado de planilha.
      const moneyUpdate = (field) => `Actions.updateRevopsItemCalc('${productId}', '${group.id}', '${item.id}', '${field}', Utils.parseBRL(this.value))`;
      switch (calc.mode) {
        case 'fixed':
          return `<label class="block">
            <span class="text-[9px] font-black text-slate-500 uppercase">Valor (R$)</span>
            <input type="text" inputmode="decimal" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" value="${Utils.formatCents(calc.value || 0)}" oninput="Utils.applyMoneyMask(this)" onchange="${moneyUpdate('value')}" class="mt-0.5 w-full px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-800" />
          </label>`;
        case 'percent_self':
          return `<div class="grid grid-cols-2 gap-2">
            <label class="block">
              <span class="text-[9px] font-black text-slate-500 uppercase">Valor base (R$)</span>
              <input type="text" inputmode="decimal" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" value="${Utils.formatCents(calc.baseValue || 0)}" oninput="Utils.applyMoneyMask(this)" onchange="${moneyUpdate('baseValue')}" class="mt-0.5 w-full px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-800" />
            </label>
            <label class="block">
              <span class="text-[9px] font-black text-slate-500 uppercase">% aplicado</span>
              <input type="number" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" step="0.1" value="${calc.factor || 0}" onchange="${update('factor')}" class="mt-0.5 w-full px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-800" />
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
              <input type="number" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" step="0.1" value="${calc.factor || 0}" onchange="${update('factor')}" class="mt-0.5 w-full px-2 py-1.5 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-800" />
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
        case 'custom_formula': {
          // V32.9.8 — Validação visual em tempo real: verde=OK, amarelo=resultado 0,
          // vermelho=erro (handle desconhecido com sugestão, sintaxe, circular ref).
          const cfg = this._currentConfig(productId);
          const evNow = RevopsWhitelabelEngine.evaluate(cfg);
          const validation = RevopsWhitelabelEngine.validateFormula(calc.formula, evNow.symbols, item.id);
          const borderCls = validation.status === 'ok' ? 'border-emerald-400 ring-1 ring-emerald-200'
                          : validation.status === 'warn' ? 'border-amber-400 ring-1 ring-amber-200'
                          : 'border-rose-400 ring-1 ring-rose-200';
          const badgeCls = validation.status === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                         : validation.status === 'warn' ? 'bg-amber-50 border-amber-200 text-amber-800'
                         : 'bg-rose-50 border-rose-200 text-rose-800';
          const badgeIcon = validation.status === 'ok' ? '✓' : validation.status === 'warn' ? '⚠' : '✗';
          return `<label class="block">
            <span class="text-[9px] font-black text-slate-500 uppercase">Fórmula avançada</span>
            <input type="text" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" value="${Utils.escape(calc.formula || '=0')}" onchange="${update('formula')}" placeholder="=fat_bruto * 0,059" class="mt-0.5 w-full px-2 py-1.5 rounded-lg bg-white border ${borderCls} text-sm font-mono text-slate-800" />
            <div class="mt-1 px-2 py-1 rounded text-[10px] font-bold border ${badgeCls}">
              ${badgeIcon} ${Utils.escape(validation.message)}
              ${validation.suggestions && validation.suggestions.length
                ? `<br><span class="font-normal">Quis dizer: ${validation.suggestions.map(s => `<code class="text-[10px] bg-white px-1 rounded">${Utils.escape(s)}</code>`).join(', ')}?</span>`
                : ''}
            </div>
            <p class="text-[10px] text-slate-500 mt-1"><i data-lucide="zap" class="w-3 h-3 inline-block"></i> Use <code>fat_bruto</code>, <code>ebitda</code>, <code>g_software_total</code>, etc. Vírgula BR (<code>0,059</code>) ou ponto (<code>0.059</code>) — ambos funcionam.</p>
          </label>`;
        }
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
        ${this._djowTip('offers')}
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
            ? `<input type="text" inputmode="decimal" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" value="${Utils.formatCents(cfg.ticketManualValue || 0)}" oninput="Utils.applyMoneyMask(this)" onchange="Actions.setRevopsTicketManual('${productId}', Utils.parseBRL(this.value))" placeholder="Ticket manual" class="px-2 py-1 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-800 w-32" />`
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
          <input type="text" inputmode="decimal" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" value="${Utils.formatCents(offer.price || 0)}" oninput="Utils.applyMoneyMask(this)" onchange="Actions.updateRevopsOfferField('${productId}', '${offer.id}', 'price', Utils.parseBRL(this.value))" class="mt-0.5 w-full px-2 py-1 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-800" />
        </label>
        ${isWeighted ? `<label class="block w-20">
          <span class="text-[9px] font-black text-slate-500 uppercase">Mix (%)</span>
          <input type="number" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" step="0.1" value="${offer.mix}" onchange="Actions.updateRevopsOfferField('${productId}', '${offer.id}', 'mix', this.value)" class="mt-0.5 w-full px-2 py-1 rounded-lg bg-white border border-slate-300 text-sm font-bold text-slate-800" />
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

      // V32.8.4 — Simulator inline. Quando ativo, recomputa o engine com
      // overrides voláteis e calcula deltas vs baseline pra mostrar impacto.
      const sim = App.state.revopsSimulator || { active: false };
      const simSales = sim.active && sim.salesOverride != null ? sim.salesOverride : ev.sales;
      const simTicket = sim.active && sim.ticketOverride != null ? sim.ticketOverride : ev.ticket;
      const simEv = sim.active
        ? RevopsWhitelabelEngine.evaluate(cfg, { sales: simSales, ticket: simTicket })
        : ev;

      return `<div class="space-y-3">
        ${this._djowTip('result')}
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 class="font-black text-slate-900">Resultado consolidado</h3>
            <p class="text-[12px] text-slate-500">Comparação previsto × real. CAC vem do total da Aquisição dividido pelos convertidos no funil.</p>
          </div>
          <button onclick="Actions.toggleRevopsSimulator()" class="px-3 py-2 rounded-xl ${sim.active ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} text-xs font-black flex items-center gap-1.5" ${sim.active ? 'style="color:#fff!important;"' : ''}>
            <i data-lucide="${sim.active ? 'pause' : 'flask-conical'}" class="w-3.5 h-3.5"></i>
            ${sim.active ? 'Sair do Simulador' : 'Simular cenário'}
          </button>
        </div>

        ${sim.active ? this._simulatorPanel(cfg, ev, simEv) : ''}

        <div class="grid md:grid-cols-3 gap-3">
          ${this._bigCellWithDelta('Vendas previstas',  Math.round(simEv.sales).toLocaleString('pt-BR'), Math.round(ev.sales).toLocaleString('pt-BR'), simEv.sales, ev.sales, 'violet', sim.active)}
          ${this._bigCell('Vendas reais',      Math.round(realSales).toLocaleString('pt-BR'), 'sky')}
          ${this._bigCellWithDelta('CAC efetivo',       this._money(simSales > 0 ? simEv.acquisitionTotal / simSales : 0), this._money(cac), simSales > 0 ? simEv.acquisitionTotal / simSales : 0, cac, cac > 0 && cac <= ev.ticket ? 'emerald' : 'amber', sim.active, true)}
          ${this._bigCellWithDelta('Faturamento previsto', this._money(simEv.fatBruto), this._money(ev.fatBruto), simEv.fatBruto, ev.fatBruto, 'violet', sim.active)}
          ${this._bigCell('Faturamento real',  this._money(realRevenue), 'sky')}
          ${this._bigCell('Aquisição total',   this._money(ev.acquisitionTotal), 'rose')}
        </div>

        ${sim.active ? this._simulatorEbitdaCompare(ev, simEv) : ''}
        ${this._scenarioCompareBlock(cfg, ev)}
      </div>`;
    },

    // V32.8.4 → V32.8.5 — Painel do Simulator: overrides + Save + lista de
    // cenários salvos + comparação lado-a-lado.
    _simulatorPanel(cfg, ev, simEv) {
      const sim = App.state.revopsSimulator;
      const productId = cfg.productId;
      const scenarios = (App.state.revopsScenarios?.[productId] || []);
      const compareSel = App.state.revopsCompareSelection || {};

      return `<div class="rounded-2xl bg-amber-50 border-2 border-amber-300 p-4 space-y-3">
        <div class="flex items-start justify-between gap-2">
          <div>
            <p class="font-black text-amber-900 text-sm flex items-center gap-1.5">
              <i data-lucide="flask-conical" class="w-4 h-4"></i>
              Modo Simulação ON · valores reais não foram alterados
            </p>
            <p class="text-[11px] text-amber-800/80 mt-0.5">Edite as overrides abaixo. Salve cenários pra comparar depois.</p>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button onclick="(function(){const n=prompt('Nome do cenário:', 'Cenário ${scenarios.length + 1}'); if(n) Actions.saveRevopsScenario('${productId}', n);})()" class="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black flex items-center gap-1" style="color:#fff!important;"><i data-lucide="save" class="w-3 h-3"></i> Salvar</button>
            <button onclick="Actions.resetRevopsSimulator()" class="px-2 py-1 rounded-lg bg-white border border-amber-300 hover:bg-amber-100 text-amber-700 text-[10px] font-black">Reset</button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-[10px] font-black text-amber-800 uppercase tracking-wider">Vendas previstas</span>
            <div class="flex items-center gap-1">
              <input type="number" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" min="0" value="${sim.salesOverride ?? ev.sales}" onchange="Actions.setRevopsSimulatorOverride('salesOverride', this.value)" placeholder="${ev.sales}" class="mt-0.5 flex-1 px-3 py-2 rounded-lg bg-white border border-amber-300 text-sm font-bold text-slate-800" />
              <span class="text-[10px] text-amber-700 mt-0.5">baseline: ${ev.sales}</span>
            </div>
          </label>
          <label class="block">
            <span class="text-[10px] font-black text-amber-800 uppercase tracking-wider">Ticket Médio (R$)</span>
            <div class="flex items-center gap-1">
              <input type="text" inputmode="decimal" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" value="${Utils.formatCents(sim.ticketOverride ?? ev.ticket)}" oninput="Utils.applyMoneyMask(this)" onchange="Actions.setRevopsSimulatorOverride('ticketOverride', Utils.parseBRL(this.value))" placeholder="${Utils.formatCents(ev.ticket)}" class="mt-0.5 flex-1 px-3 py-2 rounded-lg bg-white border border-amber-300 text-sm font-bold text-slate-800" />
              <span class="text-[10px] text-amber-700 mt-0.5">baseline: ${this._money(ev.ticket)}</span>
            </div>
          </label>
        </div>

        ${/* V32.8.5 — Lista de cenários salvos + selects de comparação */ ''}
        ${scenarios.length > 0 ? `<div class="rounded-xl bg-white border border-amber-200 p-3 space-y-2">
          <p class="text-[10px] font-black text-amber-700 uppercase tracking-wider">Cenários salvos (${scenarios.length})</p>
          <div class="space-y-1">
            ${scenarios.map(sc => `<div class="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-amber-50/60 border border-amber-200 hover:bg-amber-100/60">
              <div class="min-w-0 flex-1">
                <p class="text-[12px] font-black text-amber-900 truncate">${Utils.escape(sc.name)}</p>
                <p class="text-[9px] text-amber-700/80">Vendas: ${sc.salesOverride ?? '—'} · TM: ${sc.ticketOverride != null ? this._money(sc.ticketOverride) : '—'}</p>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button onclick="Actions.loadRevopsScenario('${productId}', '${sc.id}')" title="Carregar no Simulador" class="px-1.5 py-0.5 rounded bg-white border border-amber-300 hover:bg-amber-100 text-amber-700 text-[10px] font-black"><i data-lucide="play" class="w-3 h-3"></i></button>
                <button onclick="if(confirm('Apagar cenário \\'${Utils.escape(sc.name)}\\'?')) Actions.deleteRevopsScenario('${productId}', '${sc.id}')" class="px-1.5 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-black">×</button>
              </div>
            </div>`).join('')}
          </div>

          ${scenarios.length >= 2 ? `<div class="pt-2 border-t border-amber-200">
            <p class="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-1.5">Comparar 2 cenários lado-a-lado</p>
            <div class="grid grid-cols-2 gap-2">
              <select onchange="Actions.setRevopsCompareSlot('left', this.value)" class="px-2 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-bold text-slate-800">
                <option value="">— Esquerda —</option>
                ${scenarios.map(sc => `<option value="${sc.id}" ${compareSel.left === sc.id ? 'selected' : ''}>${Utils.escape(sc.name)}</option>`).join('')}
              </select>
              <select onchange="Actions.setRevopsCompareSlot('right', this.value)" class="px-2 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-bold text-slate-800">
                <option value="">— Direita —</option>
                ${scenarios.map(sc => `<option value="${sc.id}" ${compareSel.right === sc.id ? 'selected' : ''}>${Utils.escape(sc.name)}</option>`).join('')}
              </select>
            </div>
            ${(compareSel.left || compareSel.right) ? `<button onclick="Actions.clearRevopsCompare()" class="mt-1.5 text-[10px] text-amber-700 hover:text-amber-900 underline">Limpar seleção</button>` : ''}
          </div>` : ''}
        </div>` : ''}
      </div>`;
    },

    // V32.8.5 — Bloco de comparação 2 cenários lado-a-lado. Renderizado em
    // _resultTab quando há seleção (compareSel.left || compareSel.right).
    _scenarioCompareBlock(cfg, ev) {
      const compareSel = App.state.revopsCompareSelection || {};
      if (!compareSel.left && !compareSel.right) return '';
      const scenarios = (App.state.revopsScenarios?.[cfg.productId] || []);
      const left = compareSel.left ? scenarios.find(s => s.id === compareSel.left) : null;
      const right = compareSel.right ? scenarios.find(s => s.id === compareSel.right) : null;
      const evalScenario = (sc) => sc
        ? RevopsWhitelabelEngine.evaluate(cfg, {
            sales: sc.salesOverride != null ? sc.salesOverride : ev.sales,
            ticket: sc.ticketOverride != null ? sc.ticketOverride : ev.ticket
          })
        : ev;
      const evL = evalScenario(left);
      const evR = evalScenario(right);
      const labelL = left ? left.name : 'Baseline (real)';
      const labelR = right ? right.name : 'Baseline (real)';
      const row = (metric, valL, valR, fmt) => {
        const fmtFn = fmt === 'money' ? (v) => this._money(v) : fmt === 'percent' ? (v) => `${v.toFixed(1)}%` : (v) => Math.round(v).toLocaleString('pt-BR');
        const better = valR - valL;
        const cls = better > 0 ? 'text-emerald-700' : better < 0 ? 'text-rose-700' : 'text-slate-500';
        return `<tr class="border-b border-slate-200 last:border-0">
          <td class="py-1.5 text-[11px] font-bold text-slate-700">${metric}</td>
          <td class="py-1.5 text-[12px] font-black text-slate-900 text-right">${fmtFn(valL)}</td>
          <td class="py-1.5 text-[12px] font-black text-slate-900 text-right">${fmtFn(valR)}</td>
          <td class="py-1.5 text-[11px] font-bold text-right ${cls}">${better > 0 ? '+' : ''}${fmt === 'money' ? this._money(better) : fmt === 'percent' ? `${better.toFixed(1)}pp` : Math.round(better).toLocaleString('pt-BR')}</td>
        </tr>`;
      };
      return `<div class="rounded-2xl bg-violet-50 border-2 border-violet-300 p-4">
        <p class="font-black text-violet-900 text-sm mb-3 flex items-center gap-1.5">
          <i data-lucide="git-compare" class="w-4 h-4"></i>
          Comparação de cenários
        </p>
        <table class="w-full">
          <thead>
            <tr class="border-b-2 border-violet-300">
              <th class="text-left py-2 text-[10px] font-black text-violet-800 uppercase tracking-wider">Métrica</th>
              <th class="text-right py-2 text-[10px] font-black text-violet-800 uppercase tracking-wider">${Utils.escape(labelL)}</th>
              <th class="text-right py-2 text-[10px] font-black text-violet-800 uppercase tracking-wider">${Utils.escape(labelR)}</th>
              <th class="text-right py-2 text-[10px] font-black text-violet-800 uppercase tracking-wider">Δ (R→L)</th>
            </tr>
          </thead>
          <tbody>
            ${row('Vendas',           evL.sales,            evR.sales,            'count')}
            ${row('Ticket Médio',     evL.ticket,           evR.ticket,           'money')}
            ${row('Faturamento Bruto', evL.fatBruto,        evR.fatBruto,         'money')}
            ${row('Faturamento Líquido', evL.fatLiquido,    evR.fatLiquido,       'money')}
            ${row('EBITDA',           evL.ebitda,           evR.ebitda,           'money')}
            ${row('Margem EBITDA',    evL.ebitdaMargin,     evR.ebitdaMargin,     'percent')}
          </tbody>
        </table>
      </div>`;
    },

    // V32.8.4 — Card grande que mostra delta vs baseline quando simulator ON.
    _bigCellWithDelta(label, simValue, baseValue, simNumeric, baseNumeric, tone, simActive, inverse = false) {
      if (!simActive) return this._bigCell(label, baseValue, tone);
      const delta = simNumeric - baseNumeric;
      const deltaPct = baseNumeric !== 0 ? (delta / baseNumeric) * 100 : 0;
      const isPositive = inverse ? delta < 0 : delta > 0;
      const isNegative = inverse ? delta > 0 : delta < 0;
      const deltaCls = isPositive ? 'text-emerald-700' : isNegative ? 'text-rose-700' : 'text-slate-500';
      const deltaArrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '·';
      const deltaLabel = `${deltaArrow} ${Math.abs(deltaPct).toFixed(1)}% vs baseline`;
      const toneCls = {
        violet: 'bg-violet-50 border-violet-200 text-violet-900',
        sky:    'bg-sky-50 border-sky-200 text-sky-900',
        emerald:'bg-emerald-50 border-emerald-200 text-emerald-900',
        amber:  'bg-amber-50 border-amber-200 text-amber-900',
        rose:   'bg-rose-50 border-rose-200 text-rose-900'
      }[tone] || 'bg-slate-50 border-slate-200 text-slate-900';
      return `<div class="rounded-2xl border ${toneCls} p-4">
        <p class="text-[10px] font-black uppercase tracking-wider opacity-80">${label}</p>
        <p class="text-2xl font-black mt-1">${simValue}</p>
        <p class="text-[10px] font-black mt-1 ${deltaCls}">${deltaLabel}</p>
      </div>`;
    },

    // V32.8.4 — Bloco de comparação EBITDA: antes × depois quando simulator ON.
    _simulatorEbitdaCompare(ev, simEv) {
      const delta = simEv.ebitda - ev.ebitda;
      const deltaPct = ev.ebitda !== 0 ? (delta / Math.abs(ev.ebitda)) * 100 : 0;
      const cls = delta > 0 ? 'emerald' : delta < 0 ? 'rose' : 'slate';
      return `<div class="rounded-2xl bg-slate-900 text-white p-4 grid md:grid-cols-3 gap-4">
        <div>
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">EBITDA Baseline</p>
          <p class="text-xl font-black mt-1">${this._money(ev.ebitda)}</p>
          <p class="text-[10px] text-slate-400 mt-0.5">Margem ${ev.ebitdaMargin.toFixed(1)}%</p>
        </div>
        <div>
          <p class="text-[10px] font-black text-amber-300 uppercase tracking-wider">EBITDA Simulado</p>
          <p class="text-xl font-black mt-1">${this._money(simEv.ebitda)}</p>
          <p class="text-[10px] text-amber-300/70 mt-0.5">Margem ${simEv.ebitdaMargin.toFixed(1)}%</p>
        </div>
        <div>
          <p class="text-[10px] font-black text-${cls}-300 uppercase tracking-wider">Δ Impacto</p>
          <p class="text-xl font-black mt-1 text-${cls}-300">${delta >= 0 ? '+' : ''}${this._money(delta)}</p>
          <p class="text-[10px] text-${cls}-300/70 mt-0.5">${delta >= 0 ? '+' : ''}${deltaPct.toFixed(1)}% vs baseline</p>
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
        ${this._djowTip('revops')}
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
        ${this._djowTip('dre')}
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
