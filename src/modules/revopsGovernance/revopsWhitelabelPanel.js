// V32.8.1 (RevOps Whitelabel — Onda 2) — Painel novo com 5 tabs + gating.
//
// Estrutura:
//   [Header: produto + período + sales + métricas strip]
//   [Tabs: Custos · Ofertas · Resultado · RevOps KPIs · DRE] (Lucide icons)
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

  // V32.11.0 — Leonardo: tabs com Lucide icons (sem emojis decorativos).
  // Icon = lucide name (carregado via data-lucide=). Tom executivo unificado
  // com Home/Mapa.
  // V38.1.4 — Fechamento deslocado pra última posição (depois de DRE). A
  // jornada natural do CFO é: cadastra Custos / Ofertas → vê Resultado /
  // RevOps KPIs / DRE → no fim do mês, fecha. Fechamento na 1ª posição
  // (V37.0.1) ficava deslocado dessa narrativa.
  const TABS = [
    { id: 'costs',      label: 'Custos',         icon: 'wallet',         alwaysOpen: true  },
    { id: 'offers',     label: 'Ofertas',        icon: 'target',         alwaysOpen: true  },
    { id: 'result',     label: 'Resultado',      icon: 'bar-chart-3',    alwaysOpen: false },
    { id: 'revops',     label: 'RevOps KPIs',    icon: 'sparkles',       alwaysOpen: false },
    { id: 'dre',        label: 'DRE',            icon: 'file-text',      alwaysOpen: false },
    { id: 'fechamento', label: 'Fechamento',     icon: 'calendar-check', alwaysOpen: true  }
  ];

  const CALC_MODES = [
    { id: 'fixed',           label: 'Valor fixo (R$)',           hint: 'Insira o valor mensal exato' },
    { id: 'percent_self',    label: '% sobre valor de referência', hint: 'X% de um valor que você define (ex: alocação)' },
    { id: 'percent_of',      label: '% sobre outro item/handle', hint: 'X% de outro item ou métrica (ex: 30% do Fat. Bruto)' },
    { id: 'derived',         label: 'Soma de outro grupo',       hint: 'Total de outro grupo (ex: S&M = total Aquisição)' },
    { id: 'custom_formula',  label: 'Fórmula avançada (Modo B)', hint: 'Expressão livre — edição completa só no Modo Excel (em breve)' }
  ];

  // V32.11.3 — Leonardo: cada bucket ganha tom + ícone Lucide pra identidade
  // visual consistente nos cards de grupo.
  const BUCKETS = [
    { id: 'fixed',       label: 'Fixos (G&A)',                  tone: 'violet', icon: 'shield' },
    { id: 'acquisition', label: 'Aquisição (S&M)',              tone: 'sky',    icon: 'megaphone' },
    { id: 'variable',    label: 'Variáveis (% sobre Faturamento)', tone: 'amber', icon: 'percent' },
    { id: 'custom',      label: 'Outro',                         tone: 'slate',  icon: 'box' }
  ];

  const RevopsWhitelabelPanel = {

    render() {
      const products = (App.state.products || []).filter(p => !p.archived);
      if (!products.length) {
        return `<div class="rounded-3xl bg-slate-50 border border-slate-200 p-8 text-center">
          <p class="text-sm text-slate-600">Cadastre um produto primeiro pra abrir o RevOps.</p>
        </div>`;
      }

      // V32.10.2 — Auto-snapshot remoto na 1ª render desta sessão. Protege
      // contra perda de dados. Fire-and-forget, 1× por dia por sessão.
      if (window.Actions?._autoSnapshotOnce) {
        setTimeout(() => Actions._autoSnapshotOnce('auto-revops-entry-' + new Date().toISOString().slice(0, 10)), 200);
      }

      // V38.1.1 — Overview consolidado é o default (selectedProductId === null).
      // Cliente clica num card → entra na view específica do produto.
      if (!App.state.revopsSelectedProductId) {
        return this._renderOverview(products);
      }

      // View específica do produto (comportamento original).
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

    // V38.1.1 — Overview consolidado: dashboard de TODOS os produtos.
    // Cliente entra em RevOps → cai aqui primeiro → escolhe produto.
    _renderOverview(products) {
      const productsData = products.map(p => {
        const cfg = this._currentConfig(p.id);
        const ev = RevopsWhitelabelEngine.evaluate(cfg);
        const health = window.HealthScoreEngine ? HealthScoreEngine.compute(p.id) : null;
        return { product: p, cfg, ev, health };
      });

      // Métricas agregadas pro topo.
      const totals = productsData.reduce((acc, { ev, health }) => ({
        fatBruto: acc.fatBruto + (ev.fatBruto || 0),
        ebitda: acc.ebitda + (ev.ebitda || 0),
        salesPrev: acc.salesPrev + (ev.sales || 0),
        healthSum: acc.healthSum + (health?.score || 0),
        healthCount: acc.healthCount + (health ? 1 : 0)
      }), { fatBruto: 0, ebitda: 0, salesPrev: 0, healthSum: 0, healthCount: 0 });
      const margemMedia = totals.fatBruto > 0 ? (totals.ebitda / totals.fatBruto) * 100 : 0;
      const saudeMedia = totals.healthCount > 0 ? Math.round(totals.healthSum / totals.healthCount) : 0;

      return `<div class="space-y-4">
        <!-- HEADER OVERVIEW -->
        <div class="bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 rounded-3xl border border-violet-500/30 p-5 shadow-2xl">
          <div class="flex items-start justify-between gap-3 flex-wrap mb-4">
            <div class="min-w-0">
              <p class="text-[10px] font-black text-violet-300 uppercase tracking-widest">RevOps & Governança · CFO</p>
              <h2 class="text-2xl font-black text-white mt-1 leading-tight">Visão geral · ${products.length} produto${products.length === 1 ? '' : 's'}</h2>
              <p class="text-[12px] text-violet-200/70 mt-1">Selecione um produto pra entrar na governança específica.</p>
            </div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            ${this._metricCell('Receita Bruta Total', this._money(totals.fatBruto), 'emerald')}
            ${this._metricCell('EBITDA Consolidado', this._money(totals.ebitda), totals.ebitda >= 0 ? 'emerald' : 'rose')}
            ${this._metricCell('Margem Média', `${margemMedia.toFixed(1)}%`, margemMedia >= 25 ? 'emerald' : margemMedia >= 0 ? 'amber' : 'rose')}
            ${this._metricCell('Saúde Média', `${saudeMedia}/100`, saudeMedia >= 80 ? 'emerald' : saudeMedia >= 50 ? 'amber' : 'rose')}
          </div>
        </div>

        <!-- GRID DE CARDS DE PRODUTO -->
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          ${productsData.map(d => this._overviewProductCard(d)).join('')}
        </div>
      </div>`;
    },

    _overviewProductCard({ product, cfg, ev, health }) {
      const margemPct = ev.fatBruto > 0 ? (ev.ebitda / ev.fatBruto) * 100 : 0;
      const margemTone = margemPct >= 25 ? 'emerald' : margemPct >= 0 ? 'amber' : 'rose';
      const ebitdaTone = ev.ebitda >= 0 ? 'emerald' : 'rose';
      const healthScore = health?.score || 0;
      const healthTone = health?.tier?.color || 'slate';
      // Conversão de Vendas e CAC ainda dependem de integração checkout (V38.2.0).
      // Hoje mostram "—" e modal/tooltip explica.
      return `<button onclick="Actions.selectRevopsProduct(${product.id})" class="text-left bg-white rounded-2xl border border-slate-200 border-l-4 border-l-violet-500 hover:border-l-violet-600 hover:shadow-md transition p-4 space-y-3 group">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest">Produto</p>
            <h3 class="font-black text-base text-slate-900 leading-tight truncate">${Utils.escape(product.name)}</h3>
            <p class="text-[11px] text-slate-500">${Utils.escape(product.type || 'Produto')} · ${Utils.escape(product.revenueModel || 'Venda única')}</p>
          </div>
          <span class="shrink-0 text-[10px] font-black text-violet-600 group-hover:text-violet-800 group-hover:translate-x-0.5 transition">Abrir →</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-xl bg-emerald-50/60 border border-emerald-200 px-2.5 py-1.5">
            <div class="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Receita</div>
            <div class="font-black text-sm text-slate-900">${this._money(ev.fatBruto)}</div>
          </div>
          <div class="rounded-xl bg-${ebitdaTone}-50/60 border border-${ebitdaTone}-200 px-2.5 py-1.5">
            <div class="text-[9px] font-black text-${ebitdaTone}-700 uppercase tracking-widest">EBITDA</div>
            <div class="font-black text-sm text-slate-900">${this._money(ev.ebitda)}</div>
          </div>
          <div class="rounded-xl bg-${margemTone}-50/60 border border-${margemTone}-200 px-2.5 py-1.5">
            <div class="text-[9px] font-black text-${margemTone}-700 uppercase tracking-widest">Margem</div>
            <div class="font-black text-sm text-slate-900">${margemPct.toFixed(1)}%</div>
          </div>
          <div class="rounded-xl bg-${healthTone}-50/60 border border-${healthTone}-200 px-2.5 py-1.5">
            <div class="text-[9px] font-black text-${healthTone}-700 uppercase tracking-widest">Saúde</div>
            <div class="font-black text-sm text-slate-900">${healthScore}/100</div>
          </div>
          <div class="rounded-xl bg-slate-50 border border-slate-200 px-2.5 py-1.5">
            <div class="text-[9px] font-black text-slate-500 uppercase tracking-widest">CAC</div>
            <div class="font-black text-sm text-slate-400">—</div>
          </div>
          <div class="rounded-xl bg-slate-50 border border-slate-200 px-2.5 py-1.5">
            <div class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Conversão</div>
            <div class="font-black text-sm text-slate-400">—</div>
          </div>
        </div>
      </button>`;
    },

    // ────────────────────────────────────────────────────────────
    // HEADER + MÉTRICAS STRIP
    // ────────────────────────────────────────────────────────────

    // V32.11.0 — Leonardo: header executivo. Gradient escuro
    // (slate-900 → violet-950 → slate-900) na linha do Home/Mapa. Tipografia:
    // label uppercase tracking-widest violet-300 (selo), título font-black white,
    // subtítulo violet-200/70. Selects e botão tema escuro (slate-800/60 +
    // violet-400/30 border).
    _header(productId, products, cfg, ev) {
      const periodLabel = cfg.period === 'yearly' ? 'Anual' : cfg.period === 'quarterly' ? 'Trimestral' : 'Mensal';
      const selectedProduct = products.find(p => Number(p.id) === Number(productId));
      const selectedName = selectedProduct?.name || 'Produto';

      // V40.11.0 — Subtítulo dinâmico por tab + cards duais em modo leitura.
      // Modelagem (Custos, Ofertas) = só Projetado. Leitura (Resultado, KPIs,
      // DRE, Fechamento) = Realizado grande + Projetado small embaixo.
      const activeTab = this._activeTab();
      const SUBTITLE_BY_TAB = {
        costs:      'Estrutura de custos',
        offers:     'Modele sua operação como ela é',
        result:     'Vida da operação',
        revops:     'Saúde dos indicadores',
        dre:        'Demonstrativo financeiro',
        fechamento: 'Mês fechado'
      };
      const subtitle = SUBTITLE_BY_TAB[activeTab] || 'Operação de receita';
      const isReading = ['result', 'revops', 'dre', 'fechamento'].includes(activeTab);

      // Em modo leitura, calcula evReal usando vendas Hotmart approved últimos
      // 30d + ticket CRM. Se sem dados, evReal=null e cards mostram "—".
      let evReal = null;
      if (isReading && window.RevopsFinanceEngine) {
        const summary = RevopsFinanceEngine.productRevenueSummary?.(productId);
        if (summary && summary.convertedCount > 0 && summary.crmTicket > 0) {
          evReal = RevopsWhitelabelEngine.evaluate(cfg, { sales: summary.convertedCount, ticket: summary.crmTicket });
        }
      }

      const metricsGrid = isReading ? `
        <div class="grid grid-cols-2 md:grid-cols-5 gap-2">
          ${this._metricCellDual('Ticket Médio', evReal ? this._moneyPrecise(evReal.ticket) : null, this._moneyPrecise(ev.ticket), 'violet')}
          ${this._metricCellDual(`Faturamento Bruto (${periodLabel})`, evReal ? this._money(evReal.fatBruto) : null, this._money(ev.fatBruto), 'emerald')}
          ${this._metricCellDual('Faturamento Líquido', evReal ? this._money(evReal.fatLiquido) : null, this._money(ev.fatLiquido), 'sky')}
          ${this._metricCellDual('EBITDA', evReal ? this._money(evReal.ebitda) : null, this._money(ev.ebitda), evReal ? (evReal.ebitda >= 0 ? 'emerald' : 'rose') : (ev.ebitda >= 0 ? 'emerald' : 'rose'))}
          ${this._metricCellDual('Margem EBITDA', evReal ? `${evReal.ebitdaMargin.toFixed(1)}%` : null, `${ev.ebitdaMargin.toFixed(1)}%`, evReal ? (evReal.ebitdaMargin >= 25 ? 'emerald' : evReal.ebitdaMargin >= 0 ? 'amber' : 'rose') : (ev.ebitdaMargin >= 25 ? 'emerald' : ev.ebitdaMargin >= 0 ? 'amber' : 'rose'))}
        </div>` : `
        <div class="grid grid-cols-2 md:grid-cols-5 gap-2">
          ${this._metricCell('Ticket Médio', this._moneyPrecise(ev.ticket), 'violet')}
          ${this._metricCell(`Faturamento Bruto (${periodLabel})`, this._money(ev.fatBruto), 'emerald')}
          ${this._metricCell('Faturamento Líquido', this._money(ev.fatLiquido), 'sky')}
          ${this._metricCell('EBITDA', this._money(ev.ebitda), ev.ebitda >= 0 ? 'emerald' : 'rose')}
          ${this._metricCell('Margem EBITDA', `${ev.ebitdaMargin.toFixed(1)}%`, ev.ebitdaMargin >= 25 ? 'emerald' : ev.ebitdaMargin >= 0 ? 'amber' : 'rose')}
        </div>`;

      return `<div class="bg-gradient-to-br from-slate-900 via-violet-950 to-slate-900 rounded-3xl border border-violet-500/30 p-5 shadow-2xl">
        <!-- V38.1.1 — Breadcrumb pra voltar ao Overview -->
        <div class="flex items-center gap-2 mb-3 text-[11px] font-bold">
          <button onclick="Actions.backToRevopsOverview()" class="text-violet-300 hover:text-white inline-flex items-center gap-1">
            <i data-lucide="arrow-left" class="w-3 h-3"></i>
            Overview
          </button>
          <span class="text-violet-400/50">/</span>
          <span class="text-white">${Utils.escape(selectedName)}</span>
        </div>
        <div class="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div class="min-w-0">
            <p class="text-[10px] font-black text-violet-300 uppercase tracking-widest">RevOps & Governança · CFO</p>
            <h2 class="text-2xl font-black text-white mt-1 leading-tight">${Utils.escape(selectedName)}</h2>
            <p class="text-[12px] text-violet-200/70 mt-1">${Utils.escape(subtitle)}</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <select onchange="Actions.setRevopsActiveProductId(this.value)" class="px-3 py-2 rounded-xl bg-slate-800/60 border border-violet-400/30 text-sm font-bold text-white hover:bg-slate-800 focus:outline-none focus:border-violet-300">
              ${products.map(p => `<option value="${p.id}" ${Number(p.id) === Number(productId) ? 'selected' : ''} class="bg-slate-900">${Utils.escape(p.name)}</option>`).join('')}
            </select>
            <select onchange="Actions.setRevopsWhitelabelPeriod('${productId}', this.value)" class="px-3 py-2 rounded-xl bg-slate-800/60 border border-violet-400/30 text-sm font-bold text-white hover:bg-slate-800 focus:outline-none focus:border-violet-300">
              <option value="monthly"   ${cfg.period === 'monthly'   ? 'selected' : ''} class="bg-slate-900">Mensal</option>
              <option value="quarterly" ${cfg.period === 'quarterly' ? 'selected' : ''} class="bg-slate-900">Trimestral</option>
              <option value="yearly"    ${cfg.period === 'yearly'    ? 'selected' : ''} class="bg-slate-900">Anual</option>
            </select>
            <button onclick="Actions.backToRevopsOverview()" title="Voltar pro Overview de RevOps & Governança" class="px-3 py-2 rounded-xl bg-slate-800/60 hover:bg-slate-700 border border-violet-400/20 text-violet-200 text-xs font-bold whitespace-nowrap">← RevOps & Governança</button>
          </div>
        </div>

        ${metricsGrid}
      </div>`;
    },

    // V32.11.0 — Leonardo: métricas sobre fundo escuro. Padrão violet-500/15
    // bg + violet-400/30 border + text-violet-100 (cores semânticas seguem
    // mesma sintaxe pra emerald/sky/amber/rose).
    // V37.0.12 — flex column + justify-between + min-h fixo: cards do mesmo
    // tamanho com label SEMPRE no topo e valor SEMPRE no fundo (alinhamento
    // vertical idêntico mesmo quando label quebra em 2 linhas). Número subiu
    // de text-sm pra text-xl pra dominar visualmente.
    _metricCell(label, value, tone) {
      const toneCls = {
        violet:  'bg-violet-500/15  border-violet-400/30  text-violet-100',
        emerald: 'bg-emerald-500/15 border-emerald-400/30 text-emerald-100',
        sky:     'bg-sky-500/15     border-sky-400/30     text-sky-100',
        amber:   'bg-amber-500/15   border-amber-400/30   text-amber-100',
        rose:    'bg-rose-500/15    border-rose-400/30    text-rose-100'
      }[tone] || 'bg-slate-500/15 border-slate-400/30 text-slate-100';
      return `<div class="rounded-xl border ${toneCls} px-3.5 py-2.5 backdrop-blur-sm flex flex-col justify-between gap-1.5 min-h-[72px]">
        <p class="text-[11px] font-black uppercase tracking-wider opacity-75 leading-tight">${label}</p>
        <p class="text-xl font-black truncate">${value}</p>
      </div>`;
    },

    // V40.11.0 — Versão dual do _metricCell: Realizado grande em cima,
    // Projetado em letra menor embaixo. Usado em tabs de leitura (Resultado,
    // RevOps KPIs, DRE, Fechamento). Quando realValue=null, mostra "—" sem
    // mentir o Projetado.
    _metricCellDual(label, realValue, projValue, tone) {
      const toneCls = {
        violet:  'bg-violet-500/15  border-violet-400/30  text-violet-100',
        emerald: 'bg-emerald-500/15 border-emerald-400/30 text-emerald-100',
        sky:     'bg-sky-500/15     border-sky-400/30     text-sky-100',
        amber:   'bg-amber-500/15   border-amber-400/30   text-amber-100',
        rose:    'bg-rose-500/15    border-rose-400/30    text-rose-100'
      }[tone] || 'bg-slate-500/15 border-slate-400/30 text-slate-100';
      const displayReal = realValue !== null && realValue !== undefined ? realValue : '—';
      return `<div class="rounded-xl border ${toneCls} px-3.5 py-2.5 backdrop-blur-sm flex flex-col justify-between gap-1 min-h-[72px]">
        <p class="text-[11px] font-black uppercase tracking-wider opacity-75 leading-tight">${label}</p>
        <div>
          <p class="text-xl font-black truncate">${displayReal}</p>
          <p class="text-[10px] opacity-60 mt-0.5 truncate">Proj. ${projValue}</p>
        </div>
      </div>`;
    },

    // ────────────────────────────────────────────────────────────
    // TABS BAR + GATING
    // ────────────────────────────────────────────────────────────

    // V32.11.0 — Leonardo: tabs Lucide icons (sem emojis). Estilo executivo:
    // ativa violet sólido, inativa branca com hover violet, trancada cinza.
    _tabsBar(activeTab, unlocked) {
      return `<div class="flex items-center gap-1.5 overflow-x-auto pb-1">
        ${TABS.map(t => {
          const isActive = t.id === activeTab;
          const isLocked = !t.alwaysOpen && !unlocked.all;
          const baseCls = isActive
            ? 'bg-violet-600 text-white shadow-md border border-violet-700'
            : isLocked
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
            : 'bg-white border border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-slate-700';
          const onClick = isLocked
            ? `onclick="Utils.toast('${this._lockReason(unlocked)}')"`
            : `onclick="Actions.setRevopsWhitelabelTab('${t.id}')"`;
          const iconName = isLocked ? 'lock' : t.icon;
          return `<button ${onClick} class="px-3 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 whitespace-nowrap transition ${baseCls}" ${isActive ? 'style="color:#fff!important;"' : ''}>
            <i data-lucide="${iconName}" class="w-3.5 h-3.5"></i>
            ${t.label}
          </button>`;
        }).join('')}
      </div>`;
    },

    _lockReason(unlocked) {
      const faltas = [];
      if (!unlocked.hasCosts) faltas.push('1 custo');
      if (!unlocked.hasOffers) faltas.push('1 oferta com preço');
      if (!unlocked.hasSales) faltas.push('meta de vendas em pelo menos 1 oferta');
      return `Pra abrir: ${faltas.join(' + ')}`;
    },

    // V40.11.0 — Gating: input "Vendas Previstas" saiu do header. Meta agora
    // mora exclusivamente nas ofertas. Aceita salesProjection legado pra não
    // travar cliente que cadastrou pré-V40.11 sem migrar pra Ofertas ainda.
    _tabUnlockState(cfg) {
      const hasCosts = (cfg.groups || []).some(g => (g.items || []).length > 0);
      const hasOffers = (cfg.offers || []).some(o => Number(o.price) > 0);
      const hasOffersWithMeta = (cfg.offers || []).some(o => Number(o.metaVendas) > 0);
      const hasSales = Number(cfg.salesProjection) > 0 || hasOffersWithMeta;
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
        case 'fechamento': return this._fechamentoTab(cfg, ev);
        case 'costs':  return this._costsTab(cfg, ev);
        case 'offers': return this._offersTab(cfg, ev);
        case 'result': return this._resultTab(cfg, ev);
        case 'revops': return this._revopsTab(cfg, ev);
        case 'dre':    return this._dreTab(cfg, ev);
        default:       return '';
      }
    },

    // ────────────────────────────────────────────────────────────
    // TAB 0 (1ª): FECHAMENTO — placeholder pra V37.0.x
    // ────────────────────────────────────────────────────────────
    //
    // V37.0.1 — Estrutura visual + switcher de escopo.
    // V37.0.3 — Conecta no backend: auto-fetch GET /api/governance-closings,
    // lista snapshots filtrada por escopo, vista detalhada do snapshot_json,
    // botão "Refechar este produto" funcional (POST product_custom),
    // botão "Reabrir" registra auditoria (PATCH action=reopen).
    _fechamentoTab(cfg, ev) {
      const productId = cfg.productId;
      const scope = App.state.revopsFechamentoScope?.[productId] || 'product';

      // V37.0.3 → V37.0.4 — Cache global cross-product (não mais por productId)
      const cache = App.state.governanceClosings || {};
      if (!cache.loadedAt) {
        setTimeout(() => Actions.loadGovernanceClosings(), 0);
      }

      // V37.0.3 — Vista detalhada se snapshot aberto
      const openId = App.state.governanceClosingOpen;
      if (openId) {
        const openClosing = (cache.list || []).find(c => Number(c.id) === Number(openId));
        if (openClosing) return this._fechamentoSnapshotView(openClosing, cfg);
      }

      // Mês corrente em PT-BR
      const now = new Date();
      let monthLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      monthLabel = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

      // Countdown até o último dia do mês (snapshot vira no dia 1 do próximo)
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const today = now.getDate();
      const daysLeft = Math.max(0, lastDay - today);
      const closesPhrase = daysLeft === 0
        ? 'Fecha hoje, à virada do mês'
        : daysLeft === 1
          ? 'Fecha amanhã, à virada do mês'
          : `Fecha em ${daysLeft} dias`;

      const scopeBtn = (id, label, icon) => `<button onclick="Actions.setRevopsFechamentoScope('${productId}', '${id}')" class="px-3 py-1.5 rounded-lg text-xs font-black inline-flex items-center gap-1.5 transition ${scope === id ? 'bg-violet-600 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-50'}" ${scope === id ? 'style="color:#fff!important;"' : ''}>
        <i data-lucide="${icon}" class="w-3 h-3"></i> ${label}
      </button>`;

      const scopeSwitcher = `<div class="inline-flex items-center rounded-xl bg-white border border-stone-300 p-0.5 shadow-sm">
        ${scopeBtn('product', 'Este produto', 'package')}
        ${scopeBtn('monthly', 'Mensal Consolidado', 'layers')}
        ${scopeBtn('custom', 'Custom', 'wand-2')}
      </div>`;

      const scopeIntros = {
        product: 'Snapshots automáticos deste produto, mês a mês. Cron fecha no fim do mês — você pode reabrir e gerar versão custom dentro do mesmo mês.',
        monthly: 'Um fechamento por mês agregando os produtos que você escolher. Nasce parcial — quando você associa os produtos no card de pendência, vira completo.',
        custom:  'Agrupamentos arbitrários de produtos dentro de um mesmo mês. Cria quantos quiser. Cada custom tem data de geração imutável.'
      };

      // V37.0.3 → V37.0.4 — Filtra do cache global. 'product' ainda filtra por productId.
      const allClosings = cache.list || [];
      const closingsByScope = {
        product: allClosings.filter(c =>
          (c.kind === 'product_auto' || c.kind === 'product_custom') &&
          Array.isArray(c.product_ids) && c.product_ids.includes(productId)
        ),
        monthly: allClosings.filter(c => c.kind === 'consolidated_monthly'),
        custom:  allClosings.filter(c => c.kind === 'consolidated_custom')
      };
      const scopedList = closingsByScope[scope] || [];
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const refecharBtn = scope === 'product'
        ? `<button onclick="(function(){const n=prompt('Nome opcional pro snapshot custom (ex: ajuste venda 28/06):', ''); if(n!==null) Actions.createProductCustomClosing('${productId}', '${currentPeriod}', n);})()" class="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm shrink-0" style="color:#fff!important;">
            <i data-lucide="camera" class="w-3.5 h-3.5"></i> Refechar este produto (${currentPeriod})
          </button>`
        : scope === 'custom'
          ? `<button onclick="Actions.startCustomConsolidadoDraft()" class="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm shrink-0" style="color:#fff!important;">
              <i data-lucide="wand-2" class="w-3.5 h-3.5"></i> Novo Custom Consolidado
            </button>`
          : `<button disabled title="Mensal Consolidado é criado pelo cron mensal. Cliente associa produtos no card partial." class="px-3 py-2 rounded-xl bg-stone-200 text-stone-500 text-xs font-black flex items-center gap-1.5 cursor-not-allowed shrink-0">
              <i data-lucide="zap-off" class="w-3.5 h-3.5"></i> Cron mensal cuida
            </button>`;

      // V37.0.5 — Se está no escopo custom E tem draft aberto → renderiza wizard
      if (scope === 'custom' && App.state.customConsolidadoDraft) {
        return this._fechamentoCustomWizard(cfg);
      }

      return `<div class="space-y-3">
        ${this._tabHeader('Fechamento · Mensal & Consolidados', 'Fechamento do Período', 'Snapshot imutável da governança no fim de cada mês. Auto por produto, consolidado mensal e custom — tudo aqui.', scopeSwitcher)}

        <section class="rounded-3xl border p-5 shadow-md space-y-4" style="background:#f5f3f0;border-color:#e7e5e0;color-scheme:light;">

          <!-- CARD MÊS CORRENTE -->
          <div class="rounded-2xl bg-white border border-stone-200 border-l-4 border-l-violet-500 p-4 shadow-sm">
            <div class="flex items-start justify-between gap-3 flex-wrap">
              <div class="flex items-start gap-3 min-w-0">
                <span class="shrink-0 w-10 h-10 rounded-xl bg-violet-500/15 grid place-items-center text-violet-700">
                  <i data-lucide="calendar-clock" class="w-5 h-5"></i>
                </span>
                <div class="min-w-0">
                  <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest">Mês corrente</p>
                  <h4 class="text-base font-black text-slate-900">${Utils.escape(monthLabel)}</h4>
                  <p class="text-[12px] text-slate-600 mt-0.5">${closesPhrase}. Snapshot automático às 00:00 BRT do dia 1 do próximo mês.</p>
                </div>
              </div>
              ${refecharBtn}
            </div>
          </div>

          <!-- INTRO DO ESCOPO -->
          <div class="rounded-2xl bg-violet-50/60 border border-violet-200 p-3 flex items-start gap-2.5">
            <span class="shrink-0 w-7 h-7 rounded-lg bg-violet-500/15 grid place-items-center text-violet-700">
              <i data-lucide="info" class="w-3.5 h-3.5"></i>
            </span>
            <p class="text-[12px] text-slate-700 leading-relaxed">${Utils.escape(scopeIntros[scope])}</p>
          </div>

          <!-- LISTA DE SNAPSHOTS -->
          ${this._fechamentoSnapshotsList(scope, scopedList, cache)}

          <!-- COMO FUNCIONA -->
          <div class="pt-2 border-t border-stone-200">
            <p class="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Como o fechamento funciona</p>
            <div class="grid sm:grid-cols-3 gap-3">
              ${this._fechamentoConceptCard('package', 'Snapshot por produto', 'AUTO', 'violet', 'Cron mensal congela DRE, KPIs RevOps, Custos, Ofertas e metas de cada produto. Um por produto, por mês. Imutável.')}
              ${this._fechamentoConceptCard('layers', 'Mensal Consolidado', 'AUTO + ASSOC', 'sky', 'Nasce parcial junto com os snapshots. Você associa os produtos que entram → vira completo. Um único por mês.')}
              ${this._fechamentoConceptCard('wand-2', 'Consolidado Custom', 'MANUAL', 'emerald', 'Você cria quando quiser: escolhe N produtos do mês, dá nome, gera. Data de criação fica fixa. Útil pra recortes específicos.')}
            </div>
          </div>
        </section>
      </div>`;
    },

    // V37.0.3 — Lista filtrada por escopo + estados (loading/error/empty/lista)
    _fechamentoSnapshotsList(scope, list, cache) {
      const scopeLabel = scope === 'product' ? 'deste produto' : scope === 'monthly' ? 'mensais consolidados' : 'customs';
      const header = `<p class="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Snapshots ${scopeLabel}</p>`;

      if (cache?.loading) {
        return `<div>${header}
          <div class="rounded-2xl bg-white/50 border border-stone-200 p-6 text-center">
            <p class="text-[12px] text-slate-500"><i data-lucide="loader" class="w-3.5 h-3.5 inline mr-1"></i> Carregando snapshots…</p>
          </div>
        </div>`;
      }
      if (cache?.error) {
        const isMissingTable = String(cache.error).toLowerCase().includes('does not exist') || String(cache.error).toLowerCase().includes('lj_governance_closings');
        return `<div>${header}
          <div class="rounded-2xl bg-amber-50 border border-amber-200 p-4">
            <p class="text-[12px] font-black text-amber-900 mb-1"><i data-lucide="alert-triangle" class="w-3.5 h-3.5 inline mr-1"></i> ${isMissingTable ? 'Tabela ainda não migrada' : 'Erro ao carregar snapshots'}</p>
            <p class="text-[11px] text-amber-800 leading-snug">${isMissingTable ? 'Rode "Migrar Schema" em Administrar (master) ou nas Configurações do tenant pra criar a tabela lj_governance_closings.' : Utils.escape(String(cache.error))}</p>
          </div>
        </div>`;
      }
      if (!list.length) {
        return `<div>${header}
          <div class="rounded-2xl border-2 border-dashed border-stone-300 bg-white/50 p-8 text-center">
            <div class="w-12 h-12 rounded-full bg-stone-100 grid place-items-center mx-auto mb-3">
              <i data-lucide="archive" class="w-5 h-5 text-stone-400"></i>
            </div>
            <p class="text-sm font-black text-slate-700 mb-1">Nenhum snapshot ainda</p>
            <p class="text-[12px] text-slate-500 max-w-md mx-auto">${scope === 'product' ? 'O primeiro snapshot deste produto nasce no dia 1 do próximo mês, automaticamente. Ou clique em "Refechar este produto" pra criar um custom agora.' : scope === 'monthly' ? 'O consolidado mensal nasce junto com os snapshots por produto (cron dia 1).' : 'Customs você cria à mão depois que o mês fecha — agrupando produtos da forma que quiser.'}</p>
          </div>
        </div>`;
      }

      return `<div>${header}
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          ${list.map(c => this._fechamentoClosingCard(c)).join('')}
        </div>
      </div>`;
    },

    // V37.0.3 — Card vertical de um snapshot
    _fechamentoClosingCard(closing) {
      const kindMeta = {
        product_auto:         { label: 'Auto',     tone: 'violet',  icon: 'zap'      },
        product_custom:       { label: 'Custom',   tone: 'emerald', icon: 'wand-2'   },
        consolidated_monthly: { label: closing.status === 'partial' ? 'Parcial' : 'Completo', tone: closing.status === 'partial' ? 'amber' : 'sky', icon: 'layers' },
        consolidated_custom:  { label: 'Custom',   tone: 'emerald', icon: 'wand-2'   }
      };
      const k = kindMeta[closing.kind] || { label: closing.kind, tone: 'stone', icon: 'archive' };
      const tones = {
        violet:  { bg: 'bg-violet-500/15',  text: 'text-violet-700',  border: 'border-violet-200',  badgeBg: 'bg-violet-50',  badgeText: 'text-violet-800' },
        emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-700', border: 'border-emerald-200', badgeBg: 'bg-emerald-50', badgeText: 'text-emerald-800' },
        amber:   { bg: 'bg-amber-500/15',   text: 'text-amber-700',   border: 'border-amber-200',   badgeBg: 'bg-amber-50',   badgeText: 'text-amber-800' },
        sky:     { bg: 'bg-sky-500/15',     text: 'text-sky-700',     border: 'border-sky-200',     badgeBg: 'bg-sky-50',     badgeText: 'text-sky-800' },
        stone:   { bg: 'bg-stone-200',      text: 'text-stone-700',   border: 'border-stone-300',   badgeBg: 'bg-stone-100',  badgeText: 'text-stone-700' }
      };
      const t = tones[k.tone] || tones.stone;
      const periodLabel = (() => {
        try {
          const [y, m] = String(closing.period).split('-').map(Number);
          const d = new Date(y, m - 1, 1);
          let label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace(/\./g, '');
          return label.charAt(0).toUpperCase() + label.slice(1);
        } catch (_) { return closing.period; }
      })();
      const closedDate = closing.closed_at ? new Date(closing.closed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      const productCount = Array.isArray(closing.product_ids) ? closing.product_ids.length : 0;
      const reopens = Array.isArray(closing.reopens_log) ? closing.reopens_log.length : 0;
      const isPartial = closing.kind === 'consolidated_monthly' && closing.status === 'partial';

      return `<div class="lj-cost-card relative rounded-2xl bg-white/70 border ${t.border} p-4 transition" style="box-shadow:3px 3px 0 0 #e7e5e4;">
        <div class="flex items-start justify-between gap-2 mb-2">
          <div class="flex items-start gap-2 min-w-0 flex-1">
            <span class="shrink-0 w-8 h-8 rounded-lg ${t.bg} grid place-items-center ${t.text}">
              <i data-lucide="${k.icon}" class="w-4 h-4"></i>
            </span>
            <div class="min-w-0">
              <p class="text-[11px] font-black text-slate-900 leading-tight">${Utils.escape(periodLabel)}</p>
              <span class="inline-flex items-center mt-1 px-1.5 py-0.5 rounded border ${t.border} ${t.badgeText} ${t.badgeBg} text-[9px] font-black uppercase tracking-widest">${k.label}</span>
            </div>
          </div>
        </div>
        ${closing.name ? `<p class="text-[11px] text-slate-700 leading-snug mb-1"><b>${Utils.escape(closing.name)}</b></p>` : ''}
        <p class="text-[10px] text-slate-500">Criado em ${closedDate}</p>
        ${productCount > 0 && (closing.kind === 'consolidated_monthly' || closing.kind === 'consolidated_custom') ? `<p class="text-[10px] text-slate-500">${productCount} produto${productCount === 1 ? '' : 's'} associado${productCount === 1 ? '' : 's'}</p>` : ''}
        ${reopens > 0 ? `<p class="text-[10px] text-amber-700 mt-1"><i data-lucide="history" class="w-3 h-3 inline"></i> ${reopens} reabertura${reopens === 1 ? '' : 's'}</p>` : ''}
        ${isPartial ? `<p class="text-[10px] text-amber-700 mt-1"><i data-lucide="alert-circle" class="w-3 h-3 inline"></i> Aguardando associação</p>` : ''}
        <div class="mt-3 flex items-center gap-1.5">
          <button onclick="Actions.openGovernanceClosingView(${closing.id})" class="flex-1 px-2 py-1.5 rounded-lg ${isPartial ? 'bg-amber-500 hover:bg-amber-600' : 'bg-violet-600 hover:bg-violet-700'} text-white text-[10px] font-black inline-flex items-center justify-center gap-1" style="color:#fff!important;">
            <i data-lucide="${isPartial ? 'list-checks' : 'eye'}" class="w-3 h-3"></i> ${isPartial ? 'Associar produtos' : 'Abrir'}
          </button>
          ${closing.kind !== 'product_auto' && !isPartial ? `<button onclick="Actions.reopenGovernanceClosing(${closing.id})" title="Registra reabertura no log de auditoria. Snapshot continua imutável." class="px-2 py-1.5 rounded-lg bg-white border border-stone-300 hover:bg-stone-50 text-stone-700 text-[10px] font-black inline-flex items-center gap-1">
            <i data-lucide="rotate-ccw" class="w-3 h-3"></i>
          </button>` : ''}
        </div>
      </div>`;
    },

    // V37.0.4 — Bloco UI de associação pra consolidated_monthly partial.
    // Mostra checkboxes dos produtos + botão "Confirmar" + "Não consolidar este mês".
    _fechamentoAssociacaoBlock(closing) {
      const products = Array.isArray(App.state.products) ? App.state.products : [];
      if (!products.length) {
        return `<div class="rounded-2xl bg-stone-100 border border-stone-200 p-4 text-center">
          <p class="text-[12px] text-slate-600">Nenhum produto cadastrado pra associar.</p>
        </div>`;
      }
      const associacao = App.state.fechamentoAssociacao?.[String(closing.id)];
      const selectedSet = associacao instanceof Set
        ? associacao
        : new Set(Array.isArray(associacao) ? associacao.map(String) : []);
      const selectedArr = Array.from(selectedSet);
      const selectedJsonStr = JSON.stringify(selectedArr).replace(/"/g, '&quot;');
      const productCards = products.map(p => {
        const checked = selectedSet.has(String(p.id));
        return `<label class="flex items-start gap-2.5 p-3 rounded-2xl bg-white/70 border ${checked ? 'border-violet-400 ring-1 ring-violet-200' : 'border-stone-200'} cursor-pointer hover:border-violet-300 transition" style="box-shadow:3px 3px 0 0 #e7e5e4;">
          <input type="checkbox" ${checked ? 'checked' : ''} onchange="Actions.toggleFechamentoAssociacaoProduct(${closing.id}, '${p.id}')" class="mt-1 accent-violet-600" />
          <div class="min-w-0 flex-1">
            <p class="text-[12px] font-black text-slate-900 leading-tight">${Utils.escape(p.name || 'Produto sem nome')}</p>
            <p class="text-[10px] text-slate-500 mt-0.5">${Math.round(Number(p.salesProjection) || 0).toLocaleString('pt-BR')} vendas previstas</p>
          </div>
        </label>`;
      }).join('');

      return `<div class="space-y-3">
        <div class="rounded-2xl bg-amber-50 border-2 border-amber-300 p-4">
          <div class="flex items-start gap-2.5 mb-2">
            <span class="shrink-0 w-9 h-9 rounded-xl bg-amber-500/15 grid place-items-center text-amber-700">
              <i data-lucide="alert-circle" class="w-4 h-4"></i>
            </span>
            <div class="min-w-0">
              <p class="text-[10px] font-black text-amber-800 uppercase tracking-widest">Fechamento parcial · aguardando decisão</p>
              <p class="text-[12px] text-slate-700 leading-snug mt-0.5">Marque os produtos que entram no consolidado do mês. Ou confirme que não quer consolidar agora — fica registrado pro histórico.</p>
            </div>
          </div>
        </div>

        <div>
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Produtos do tenant (${products.length})</p>
          <div class="grid sm:grid-cols-2 gap-2">${productCards}</div>
        </div>

        <div class="flex items-center justify-between gap-2 flex-wrap pt-2 border-t border-stone-200">
          <p class="text-[11px] text-slate-600"><b>${selectedArr.length}</b> de ${products.length} produto${products.length === 1 ? '' : 's'} marcado${selectedArr.length === 1 ? '' : 's'}</p>
          <div class="flex items-center gap-2">
            <button onclick="if(confirm('Confirmar que NÃO quer consolidar ${closing.period}? Fica registrado como decisão consciente.')) Actions.associateMonthlyConsolidated(${closing.id}, [], true)" class="px-3 py-2 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-slate-700 text-xs font-black inline-flex items-center gap-1.5">
              <i data-lucide="x-circle" class="w-3.5 h-3.5"></i> Não consolidar este mês
            </button>
            <button onclick="Actions.associateMonthlyConsolidated(${closing.id}, JSON.parse('${selectedJsonStr}'), false)" ${selectedArr.length === 0 ? 'disabled' : ''} class="px-3 py-2 rounded-xl ${selectedArr.length === 0 ? 'bg-stone-200 text-stone-500 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-700 text-white'} text-xs font-black inline-flex items-center gap-1.5" ${selectedArr.length > 0 ? 'style="color:#fff!important;"' : ''}>
              <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> Confirmar associação
            </button>
          </div>
        </div>
      </div>`;
    },

    // V37.0.3 — Vista detalhada do snapshot (renderiza snapshot_json congelado)
    _fechamentoSnapshotView(closing, cfg) {
      const periodLabel = (() => {
        try {
          const [y, m] = String(closing.period).split('-').map(Number);
          const d = new Date(y, m - 1, 1);
          let label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
          return label.charAt(0).toUpperCase() + label.slice(1);
        } catch (_) { return closing.period; }
      })();
      const closedDate = closing.closed_at ? new Date(closing.closed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      const snap = closing.snapshot_json || {};
      const isProduct = closing.kind === 'product_auto' || closing.kind === 'product_custom';
      const isPartialMonthly = closing.kind === 'consolidated_monthly' && closing.status === 'partial';

      let mainBlock = '';
      if (isPartialMonthly) {
        // V37.0.4 — Vista de associação pra partial (substitui display dos inputs)
        mainBlock = this._fechamentoAssociacaoBlock(closing);
      } else if (isProduct) {
        const meta = snap.metas || { vendas: 0, cac: 0 };
        const groups = Array.isArray(snap.revopsConfig?.groups) ? snap.revopsConfig.groups : [];
        const offers = Array.isArray(snap.revopsConfig?.offers) ? snap.revopsConfig.offers : [];
        const itemsCount = groups.reduce((acc, g) => acc + ((g.items || []).length), 0);
        const ticketMedio = snap.revopsConfig?.ticketMedio || 0;
        mainBlock = `<div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          ${this._snapInfoCard('Produto', Utils.escape(snap.productName || '—'), 'package', 'violet')}
          ${this._snapInfoCard('Vendas previstas', Math.round(snap.salesProjection || 0).toLocaleString('pt-BR'), 'target', 'violet')}
          ${this._snapInfoCard('Meta de Vendas', Math.round(meta.vendas || 0).toLocaleString('pt-BR'), 'flag', 'emerald')}
          ${this._snapInfoCard('Meta de CAC', this._money(meta.cac || 0), 'shield-check', 'emerald')}
          ${this._snapInfoCard('TM (input)', ticketMedio > 0 ? this._money(ticketMedio) : '—', 'tag', 'sky')}
          ${this._snapInfoCard('Grupos de custos', String(groups.length), 'wallet', 'rose')}
          ${this._snapInfoCard('Items totais', String(itemsCount), 'layers', 'rose')}
          ${this._snapInfoCard('Ofertas', String(offers.length), 'shopping-bag', 'amber')}
        </div>`;
      } else {
        const products = Array.isArray(snap.products) ? snap.products : [];
        const productList = products.length
          ? `<div class="space-y-2">${products.map(p => `<div class="rounded-xl bg-white/60 border border-stone-200 p-3">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-[12px] font-black text-slate-900">${Utils.escape(p.productName || p.productId)}</p>
                  <p class="text-[10px] text-slate-500">Meta: ${Math.round(p.metas?.vendas || 0).toLocaleString('pt-BR')} vendas · CAC ${this._money(p.metas?.cac || 0)}</p>
                </div>
                <span class="text-[10px] font-black text-violet-700">${Math.round(p.salesProjection || 0).toLocaleString('pt-BR')} previstas</span>
              </div>
            </div>`).join('')}</div>`
          : '<p class="text-[12px] text-slate-500 italic">Nenhum produto associado.</p>';
        mainBlock = `<div>
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Produtos consolidados (${products.length})</p>
          ${productList}
        </div>`;
      }

      const reopens = Array.isArray(closing.reopens_log) ? closing.reopens_log : [];
      const reopensBlock = reopens.length ? `<div class="rounded-2xl bg-amber-50 border border-amber-200 p-3">
        <p class="text-[10px] font-black text-amber-900 uppercase tracking-widest mb-1.5"><i data-lucide="history" class="w-3 h-3 inline"></i> Log de reabertura</p>
        <ul class="text-[11px] text-amber-800 space-y-0.5">
          ${reopens.map(r => `<li>• ${new Date(r.at).toLocaleString('pt-BR')}${r.reason ? ' — ' + Utils.escape(r.reason) : ''}</li>`).join('')}
        </ul>
      </div>` : '';

      return `<div class="space-y-3">
        <div class="flex items-start justify-between gap-3 flex-wrap pb-2 border-b border-slate-100">
          <div class="min-w-0">
            <button onclick="Actions.closeGovernanceClosingView()" class="text-[11px] text-violet-700 hover:text-violet-900 font-black inline-flex items-center gap-1 mb-1">
              <i data-lucide="arrow-left" class="w-3 h-3"></i> Voltar à lista
            </button>
            <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest">Fechamento · ${closing.kind.replace(/_/g, ' ').toUpperCase()}</p>
            <h3 class="text-base font-black text-slate-900 mt-0.5">${Utils.escape(periodLabel)}${closing.name ? ' · ' + Utils.escape(closing.name) : ''}</h3>
            <p class="text-[12px] text-slate-500 mt-0.5">Criado em ${closedDate} · ${closing.source === 'auto' ? 'Automático (cron)' : 'Manual'}</p>
          </div>
          <button onclick="Actions.exportGovernanceClosingPdf(${closing.id})" class="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black flex items-center gap-1.5 shrink-0 shadow-sm" style="color:#fff!important;">
            <i data-lucide="file-down" class="w-3.5 h-3.5"></i> Baixar PDF
          </button>
        </div>
        <section class="rounded-3xl border p-5 shadow-md space-y-4" style="background:#f5f3f0;border-color:#e7e5e0;color-scheme:light;">
          <div class="rounded-2xl bg-violet-50/60 border border-violet-200 p-3 flex items-start gap-2.5">
            <span class="shrink-0 w-7 h-7 rounded-lg bg-violet-500/15 grid place-items-center text-violet-700">
              <i data-lucide="camera" class="w-3.5 h-3.5"></i>
            </span>
            <p class="text-[12px] text-slate-700 leading-relaxed">Foto imutável dos <b>inputs</b> da governança no instante do fechamento. Reconstrução completa de DRE / KPIs / Custos + export PDF entra em V37.0.6.</p>
          </div>
          ${mainBlock}
          ${reopensBlock}
        </section>
      </div>`;
    },

    // V37.0.5 — Wizard inline pra criar Custom Consolidado. Substitui a lista
    // quando draft está aberto. Cliente preenche nome + mês + checkbox produtos.
    _fechamentoCustomWizard(cfg) {
      const draft = App.state.customConsolidadoDraft || {};
      const products = Array.isArray(App.state.products) ? App.state.products : [];
      const selectedSet = new Set((draft.productIds || []).map(String));

      // Opções de mês: 11 atrás → corrente (cliente normalmente consolida passado)
      const now = new Date();
      const monthOpts = [];
      for (let i = 0; i <= 11; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const p = `${y}-${m}`;
        let label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        label = label.charAt(0).toUpperCase() + label.slice(1);
        monthOpts.push({ p, label, isCurrent: i === 0 });
      }

      const productCards = products.length ? products.map(p => {
        const checked = selectedSet.has(String(p.id));
        return `<label class="flex items-start gap-2.5 p-3 rounded-2xl bg-white/70 border ${checked ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-stone-200'} cursor-pointer hover:border-emerald-300 transition" style="box-shadow:3px 3px 0 0 #e7e5e4;">
          <input type="checkbox" ${checked ? 'checked' : ''} onchange="Actions.toggleCustomConsolidadoDraftProduct('${p.id}')" class="mt-1 accent-emerald-600" />
          <div class="min-w-0 flex-1">
            <p class="text-[12px] font-black text-slate-900 leading-tight">${Utils.escape(p.name || 'Produto sem nome')}</p>
            <p class="text-[10px] text-slate-500 mt-0.5">${Math.round(Number(p.salesProjection) || 0).toLocaleString('pt-BR')} vendas previstas</p>
          </div>
        </label>`;
      }).join('') : '<p class="text-[12px] text-slate-500 italic">Nenhum produto cadastrado.</p>';

      const selectedCount = (draft.productIds || []).length;

      return `<div class="space-y-3">
        <div class="flex items-start justify-between gap-3 flex-wrap pb-2 border-b border-slate-100">
          <div class="min-w-0">
            <button onclick="Actions.cancelCustomConsolidadoDraft()" class="text-[11px] text-emerald-700 hover:text-emerald-900 font-black inline-flex items-center gap-1 mb-1">
              <i data-lucide="arrow-left" class="w-3 h-3"></i> Voltar à lista
            </button>
            <p class="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Novo Custom Consolidado</p>
            <h3 class="text-base font-black text-slate-900 mt-0.5">Agrupar produtos do mês</h3>
            <p class="text-[12px] text-slate-500 mt-0.5">Snapshot custom carrega data de geração imutável. Use pra recortes específicos (ex: "Master sem piloto", "Só infoprodutos", etc).</p>
          </div>
        </div>

        <section class="rounded-3xl border p-5 shadow-md space-y-4" style="background:#f5f3f0;border-color:#e7e5e0;color-scheme:light;">

          <!-- LINHA 1: Nome + Período -->
          <div class="grid sm:grid-cols-2 gap-3">
            <label class="block">
              <span class="text-[9px] font-black text-slate-500 uppercase tracking-wider">Nome do consolidado</span>
              <input id="lj-custom-name" type="text" value="${Utils.escape(draft.name || '')}" oninput="Actions.updateCustomConsolidadoDraftField('name', this.value)" placeholder="Ex: Master sem piloto · Junho/2026" class="mt-0.5 w-full px-3 py-2 rounded-lg bg-white border border-stone-300 text-sm font-bold text-slate-800 focus:border-emerald-400 focus:outline-none" />
            </label>
            <label class="block">
              <span class="text-[9px] font-black text-slate-500 uppercase tracking-wider">Mês de referência</span>
              <select onchange="Actions.updateCustomConsolidadoDraftField('period', this.value); App.render();" class="mt-0.5 w-full px-3 py-2 rounded-lg bg-white border border-stone-300 text-sm font-bold text-slate-800 focus:border-emerald-400 focus:outline-none">
                ${monthOpts.map(o => `<option value="${o.p}" ${o.p === draft.period ? 'selected' : ''}>${Utils.escape(o.label)}${o.isCurrent ? ' (atual)' : ''}</option>`).join('')}
              </select>
            </label>
          </div>

          <!-- LINHA 2: Checkbox produtos -->
          <div>
            <p class="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-2">Produtos a agrupar (${selectedCount} de ${products.length} marcado${selectedCount === 1 ? '' : 's'})</p>
            <div class="grid sm:grid-cols-2 gap-2">${productCards}</div>
          </div>

          <!-- HINT -->
          <div class="rounded-2xl bg-emerald-50/60 border border-emerald-200 p-3 flex items-start gap-2.5">
            <span class="shrink-0 w-7 h-7 rounded-lg bg-emerald-500/15 grid place-items-center text-emerald-700">
              <i data-lucide="info" class="w-3.5 h-3.5"></i>
            </span>
            <p class="text-[12px] text-slate-700 leading-relaxed">O custom puxa o estado atual da governança de cada produto no momento da criação. Se quer foto exata do que estava no mês passado, refeche antes os produtos individuais e use os customs deles.</p>
          </div>

          <!-- AÇÕES -->
          <div class="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
            <button onclick="Actions.cancelCustomConsolidadoDraft()" class="px-3 py-2 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-slate-700 text-xs font-black">
              Cancelar
            </button>
            <button onclick="Actions.createConsolidatedCustom()" ${selectedCount === 0 ? 'disabled' : ''} class="px-3 py-2 rounded-xl ${selectedCount === 0 ? 'bg-stone-200 text-stone-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'} text-xs font-black inline-flex items-center gap-1.5" ${selectedCount > 0 ? 'style="color:#fff!important;"' : ''}>
              <i data-lucide="wand-2" class="w-3.5 h-3.5"></i> Criar Custom
            </button>
          </div>
        </section>
      </div>`;
    },

    // V37.0.3 — Card de info do snapshot (label + valor + ícone tonal)
    _snapInfoCard(label, value, icon, tone) {
      const tones = {
        violet:  { bg: 'bg-violet-500/15',  text: 'text-violet-700',  border: 'border-violet-200' },
        emerald: { bg: 'bg-emerald-500/15', text: 'text-emerald-700', border: 'border-emerald-200' },
        sky:     { bg: 'bg-sky-500/15',     text: 'text-sky-700',     border: 'border-sky-200' },
        rose:    { bg: 'bg-rose-500/15',    text: 'text-rose-700',    border: 'border-rose-200' },
        amber:   { bg: 'bg-amber-500/15',   text: 'text-amber-700',   border: 'border-amber-200' }
      };
      const t = tones[tone] || tones.violet;
      return `<div class="rounded-2xl bg-white/70 border ${t.border} p-3" style="box-shadow:3px 3px 0 0 #e7e5e4;">
        <div class="flex items-start gap-2 mb-1">
          <span class="shrink-0 w-7 h-7 rounded-lg ${t.bg} grid place-items-center ${t.text}">
            <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
          </span>
          <p class="text-[9px] font-black text-slate-500 uppercase tracking-wider leading-tight mt-1">${label}</p>
        </div>
        <p class="text-base font-black text-slate-900 mt-1">${value}</p>
      </div>`;
    },

    // V37.0.1 — Helper pra cards educativos da seção "Como funciona"
    _fechamentoConceptCard(icon, title, badge, tone, description) {
      const tones = {
        violet: { bg: 'bg-violet-500/15', text: 'text-violet-700', border: 'border-violet-200' },
        sky:    { bg: 'bg-sky-500/15',    text: 'text-sky-700',    border: 'border-sky-200' },
        emerald:{ bg: 'bg-emerald-500/15', text: 'text-emerald-700', border: 'border-emerald-200' }
      };
      const t = tones[tone] || tones.violet;
      return `<div class="rounded-2xl bg-white/70 border ${t.border} p-3" style="box-shadow:3px 3px 0 0 #e7e5e4;">
        <div class="flex items-start gap-2 mb-2">
          <span class="shrink-0 w-8 h-8 rounded-lg ${t.bg} grid place-items-center ${t.text}">
            <i data-lucide="${icon}" class="w-4 h-4"></i>
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-[11px] font-black text-slate-900 leading-tight">${title}</p>
            <span class="inline-flex items-center mt-1 px-1.5 py-0.5 rounded border ${t.border} ${t.text} text-[9px] font-black uppercase tracking-widest">${badge}</span>
          </div>
        </div>
        <p class="text-[11px] text-slate-600 leading-snug">${description}</p>
      </div>`;
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

    // V32.11.0 — Leonardo: header consistente pras 5 tabs internas. Selo
    // uppercase + título font-black + subtítulo cinza. rightSide opcional
    // pra ações (toggle Builder/Excel, botões etc).
    _tabHeader(seal, title, subtitle, rightSide = '') {
      return `<div class="flex items-start justify-between gap-3 flex-wrap pb-2 border-b border-slate-100">
        <div class="min-w-0">
          <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest">${seal}</p>
          <h3 class="text-base font-black text-slate-900 mt-0.5">${title}</h3>
          ${subtitle ? `<p class="text-[12px] text-slate-500 mt-0.5">${subtitle}</p>` : ''}
        </div>
        ${rightSide ? `<div class="flex items-center gap-2 flex-wrap shrink-0">${rightSide}</div>` : ''}
      </div>`;
    },

    // ────────────────────────────────────────────────────────────
    // TAB 1: CUSTOS — grupos dinâmicos + Builder A
    // ────────────────────────────────────────────────────────────

    // V36.14.1 — Custos com mesma régua DRE/RevOps: wrapper offwhite #f5f3f0,
    // grid 2-col com Djow lateral sticky, cards bg-white/70 stone-200,
    // espaçamentos enxutos e IDs únicos nos inputs.
    _costsTab(cfg, ev) {
      const groups = cfg.groups || [];
      const productId = cfg.productId;
      const excelMode = !!App.state.revopsExcelMode;
      const djowPanel = window.DjowRevOpsPanel ? DjowRevOpsPanel.render(productId, 'costs') : '';
      const rightSide = `
        <div class="inline-flex items-center rounded-xl bg-white border border-stone-300 p-0.5 shadow-sm">
          <button onclick="Actions.setRevopsExcelMode(false)" class="px-3 py-1.5 rounded-lg text-xs font-black inline-flex items-center gap-1 transition ${!excelMode ? 'bg-violet-600 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-50'}" ${!excelMode ? 'style="color:#fff!important;"' : ''}><i data-lucide="layout-list" class="w-3 h-3"></i> Builder</button>
          <button onclick="Actions.setRevopsExcelMode(true)" class="px-3 py-1.5 rounded-lg text-xs font-black inline-flex items-center gap-1 transition ${excelMode ? 'bg-violet-600 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-50'}" ${excelMode ? 'style="color:#fff!important;"' : ''}><i data-lucide="sigma" class="w-3 h-3"></i> Excel</button>
        </div>
        <select id="lj-revops-new-bucket" class="px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs font-bold text-slate-800 shadow-sm">
          ${BUCKETS.map(b => `<option value="${b.id}">${b.label}</option>`).join('')}
        </select>
        <button onclick="Actions.addRevopsGroup('${productId}', document.getElementById('lj-revops-new-bucket').value)" class="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black flex items-center gap-1.5 shadow-sm" style="color:#fff!important;">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i> Novo grupo
        </button>`;
      return `<div class="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        <div class="space-y-3 min-w-0">
          ${this._tabHeader('Custos · Operação', 'Custos e Despesas', 'Crie grupos como faz na sua planilha. Cada item pode ser valor fixo, % sobre algo ou fórmula avançada. Clique numa linha de fórmula pra pedir ajuda ao Djow na lateral.', rightSide)}
          <section class="rounded-3xl border p-5 shadow-md space-y-3" style="background:#f5f3f0;border-color:#e7e5e0;color-scheme:light;">
            ${excelMode ? this._handlesLegend(cfg) : ''}
            ${this._handlesDatalist(cfg)}
            ${groups.length === 0
              ? `<div class="rounded-2xl bg-amber-50 border-2 border-dashed border-amber-300 p-5 text-center">
                  <p class="text-sm font-bold text-amber-900 mb-1">Nenhum grupo criado ainda</p>
                  <p class="text-xs text-amber-800">Crie pelo menos um (ex: "Software", "Aquisição") pra começar a montar seu DRE.</p>
                </div>`
              : groups.map(g => this._groupCard(productId, g, ev, excelMode)).join('')}
          </section>
        </div>
        <aside class="xl:sticky xl:top-4 xl:self-start">${djowPanel}</aside>
      </div>`;
    },

    // V32.8.2 — Legenda dos handles disponíveis (aparece no Modo Excel).
    // Cliente vê de uma lista o que pode usar em fórmulas (sales, fat_bruto,
    // ebitda, g_<group>_total, ou qualquer item_id).
    // V32.11.2 — Leonardo: legenda de handles executiva. bg-slate-50 + accent
    // violet, selo uppercase, chips sóbrios.
    _handlesLegend(cfg) {
      const handles = RevopsWhitelabelEngine.availableHandles(cfg);
      const specials = handles.filter(h => h.kind === 'special');
      const groupTotals = handles.filter(h => h.kind === 'group_total');
      const items = handles.filter(h => h.kind === 'item');
      const chip = (h) => `<code class="text-[10px] font-mono bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-700 hover:border-violet-300 hover:bg-violet-50 transition">${h.id}</code>`;
      // V36.14.1 — Tema light: bg-white/70 stone-200 (igual cards do DRE)
      return `<details open class="rounded-2xl bg-white/70 border border-stone-200 border-l-4 border-l-violet-500 p-3">
        <summary class="cursor-pointer text-[10px] font-black text-violet-700 uppercase tracking-widest flex items-center gap-1.5 select-none">
          <i data-lucide="sigma" class="w-3.5 h-3.5"></i>
          Handles disponíveis no Modo Excel
          <span class="ml-1 px-1.5 py-0.5 rounded bg-violet-500/15 border border-violet-400/30 text-violet-700 text-[9px]">${handles.length}</span>
        </summary>
        <div class="mt-3 space-y-2.5 text-[11px]">
          <div>
            <p class="text-[9px] font-black text-stone-600 uppercase tracking-widest mb-1.5">Especiais (sempre disponíveis)</p>
            <div class="flex flex-wrap gap-1">${specials.map(chip).join('')}</div>
          </div>
          ${groupTotals.length ? `<div>
            <p class="text-[9px] font-black text-stone-600 uppercase tracking-widest mb-1.5">Totais de grupo</p>
            <div class="flex flex-wrap gap-1">${groupTotals.map(chip).join('')}</div>
          </div>` : ''}
          ${items.length ? `<div>
            <p class="text-[9px] font-black text-stone-600 uppercase tracking-widest mb-1.5">Itens cadastrados</p>
            <div class="flex flex-wrap gap-1">${items.slice(0, 30).map(chip).join('')}${items.length > 30 ? `<span class="text-stone-400 text-[10px] self-center">+${items.length - 30}</span>` : ''}</div>
          </div>` : ''}
          <div class="flex items-start gap-1.5 text-stone-500 mt-2 pt-2 border-t border-stone-200">
            <i data-lucide="info" class="w-3 h-3 mt-0.5 shrink-0"></i>
            <span>Exemplo: <code class="text-[10px] font-mono bg-white px-1.5 py-0.5 rounded border border-stone-200">=fat_bruto * 0.3 + g_software_total</code></span>
          </div>
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

    // V32.10.7 — Handle picker (olhinho) reutilizável.
    // Renderiza: "Escolha um número para se basear  👁" + popover com lista
    // agrupada (Apelidos · Especiais · KPIs · Grupos · Itens). Click no
    // handle copia o id pro clipboard (cliente cola na fórmula).
    //
    // pickerKey: chave única do contexto (ex: 'composed:p1:mcu', 'item:p1:itemX')
    // cfg: config do produto (pra extrair handles disponíveis)
    _handlePicker(pickerKey, cfg) {
      const open = App.state.revopsHandlePickerKey === pickerKey;
      const trigger = `<button onclick="Actions.toggleRevopsHandlePicker('${Utils.escape(pickerKey)}')" type="button"
        class="inline-flex items-center gap-1 text-[10px] font-bold text-sky-700 hover:text-sky-900 ${open ? 'text-sky-900' : ''}"
        title="Ver números disponíveis pra usar na fórmula">
        <span>Escolha um número para se basear</span>
        <span class="text-base leading-none">${open ? '🙈' : '👁'}</span>
      </button>`;
      if (!open) return `<span class="inline-block">${trigger}</span>`;
      return `<div class="inline-block">${trigger}</div>
        ${this._handlePickerPopover(cfg)}`;
    },

    // V32.10.7 — Só o popover (sem trigger). Usado quando o trigger é
    // renderizado em outro lugar (ex: Modo Excel — olhinho na linha do item).
    _handlePickerPopover(cfg) {
      const handles = RevopsWhitelabelEngine.availableHandles(cfg);
      const groups = {
        alias: { label: 'Apelidos', items: [], cls: 'text-sky-700' },
        special: { label: 'Básicos', items: [], cls: 'text-emerald-700' },
        kpi: { label: 'KPIs da cascata', items: [], cls: 'text-violet-700' },
        group_total: { label: 'Totais de grupo', items: [], cls: 'text-amber-700' },
        item: { label: 'Itens (linhas)', items: [], cls: 'text-slate-700' }
      };
      for (const h of handles) {
        if (groups[h.kind]) groups[h.kind].items.push(h);
      }
      const renderItem = (h) => `<button type="button"
        onclick="Actions.copyRevopsHandle('${Utils.escape(h.id)}')"
        class="text-left px-2 py-1 rounded-lg bg-white border border-slate-200 hover:border-sky-400 hover:bg-sky-50 transition"
        title="Click pra copiar &quot;${Utils.escape(h.id)}&quot; — cole depois na fórmula">
        <code class="text-[11px] font-black text-slate-900">${Utils.escape(h.id)}</code>
        <span class="text-[10px] text-slate-500 block leading-tight">${Utils.escape(h.label)}</span>
      </button>`;
      const sections = Object.entries(groups)
        .filter(([_, g]) => g.items.length > 0)
        .map(([_, g]) => `<div class="mb-2 last:mb-0">
          <p class="text-[9px] font-black uppercase tracking-wider ${g.cls} mb-1 sticky top-0 bg-sky-50 py-0.5 z-10">${g.label}</p>
          <div class="grid gap-1" style="grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));">
            ${g.items.map(renderItem).join('')}
          </div>
        </div>`).join('');
      // V32.10.8 — Popover com altura ~3 handles + scroll. Section labels
      // sticky no topo durante scroll pra cliente saber em que grupo está.
      return `<div class="mt-1.5 rounded-xl bg-sky-50/60 border border-sky-200 p-2.5">
        <p class="text-[10px] text-slate-600 mb-1.5">💡 Click no número pra copiar. Depois cole na fórmula (ex: <code>=tm*0,15</code>). Role pra ver mais.</p>
        <div style="max-height: 180px; overflow-y: auto;" class="pr-1">
          ${sections}
        </div>
      </div>`;
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

      // V32.11.2 — Leonardo: Djow tip executivo. Paleta violet (cor do RevOps),
      // selo "DJOW · ANÁLISE", ícone sparkles em pill, botão sóbrio outline.
      return `<div class="rounded-xl bg-slate-50 border border-slate-200 border-l-4 border-l-violet-500 p-3 space-y-2">
        <div class="flex items-start gap-2.5">
          <span class="shrink-0 w-7 h-7 rounded-lg bg-violet-500/15 grid place-items-center text-violet-700">
            <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
          </span>
          <div class="flex-1 min-w-0">
            <p class="text-[9px] font-black text-violet-700 uppercase tracking-widest">Djow · Análise</p>
            <p class="text-[12px] text-slate-700 leading-relaxed mt-0.5">${tip}</p>
          </div>
          ${hasResult || hasError
            ? `<button onclick="Actions.askRevopsDjow('${productId}', '${tabId}')" ${loading ? 'disabled' : ''} title="Re-pedir análise" class="px-2.5 py-1.5 rounded-lg bg-white border border-violet-300 hover:bg-violet-50 text-violet-700 text-[10px] font-black flex items-center gap-1.5 shrink-0 disabled:opacity-50 uppercase tracking-wider">
                <i data-lucide="${loading ? 'loader-2' : 'refresh-cw'}" class="w-3 h-3 ${loading ? 'animate-spin' : ''}"></i>
                ${loading ? 'Analisando' : 'Re-analisar'}
              </button>`
            : `<button onclick="Actions.askRevopsDjow('${productId}', '${tabId}')" ${loading ? 'disabled' : ''} class="px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black flex items-center gap-1.5 shrink-0 disabled:opacity-50 uppercase tracking-wider" style="color:#fff!important;">
                <i data-lucide="${loading ? 'loader-2' : 'brain'}" class="w-3 h-3 ${loading ? 'animate-spin' : ''}"></i>
                ${loading ? 'Analisando' : 'Pedir análise'}
              </button>`}
        </div>
        ${hasResult ? `<div class="rounded-lg bg-white border border-violet-200 p-3 mt-2">
          <div class="flex items-center gap-2 mb-1.5">
            <span class="text-[9px] font-black text-violet-700 uppercase tracking-widest">Análise contextual</span>
            <span class="text-[9px] text-slate-400">· ${askedAtLabel}</span>
            <button onclick="Actions.clearRevopsDjowSuggestion('${tabId}')" title="Fechar" class="ml-auto text-slate-400 hover:text-slate-600 inline-flex"><i data-lucide="x" class="w-3 h-3"></i></button>
          </div>
          <p class="text-[12px] text-slate-700 leading-relaxed whitespace-pre-wrap">${Utils.escape(suggestion.suggestion)}</p>
        </div>` : ''}
        ${hasError ? `<div class="rounded-lg bg-rose-500/10 border border-rose-400/30 p-2 text-[11px] text-rose-800 inline-flex items-start gap-1.5">
          <i data-lucide="alert-triangle" class="w-3.5 h-3.5 shrink-0 mt-0.5"></i>
          <span>Falha: ${Utils.escape(suggestion.error)}</span>
        </div>` : ''}
      </div>`;
    },

    // V32.11.3 — Leonardo: card de grupo executivo. bg-white + left-border tone
    // pelo bucket + ícone Lucide em pill + label + bucket pill sóbrio. Locked
    // state com border slate em vez de bg cinza pesado.
    _groupCard(productId, group, ev, excelMode = false) {
      const items = group.items || [];
      const total = ev.groupTotals[group.id] || 0;
      const bucket = BUCKETS.find(b => b.id === group.bucket) || BUCKETS[3];
      const tone = this._cascadeTone(bucket.tone);
      const isLocked = !!App.state.revopsGroupLocked?.[group.id];
      const isCollapsed = isLocked || !!App.state.revopsGroupCollapsed?.[group.id];
      // V36.14.1 — Tema light: bg-white/70 stone-200 (igual cards DRE/RevOps)
      const cardCls = isLocked
        ? `rounded-2xl bg-stone-100/60 border border-stone-300 border-l-4 border-l-stone-500 p-4 opacity-90`
        : `rounded-2xl bg-white/70 border border-stone-200 ${tone.borderL} p-4 shadow-sm`;
      return `<div class="${cardCls}">
        <div class="flex items-start justify-between gap-3 ${isCollapsed ? '' : 'mb-3'}">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="shrink-0 w-7 h-7 rounded-lg ${isLocked ? 'bg-stone-200 text-stone-600' : tone.iconBg + ' ' + tone.iconText} grid place-items-center">
                <i data-lucide="${isLocked ? 'lock' : bucket.icon}" class="w-3.5 h-3.5"></i>
              </span>
              <input id="lj-revops-group-${group.id}-name" value="${Utils.escape(group.label)}" ${isLocked ? 'readonly' : ''} onchange="Actions.renameRevopsGroup('${productId}', '${group.id}', this.value)" class="font-black text-slate-900 text-sm bg-transparent border-b border-transparent ${isLocked ? '' : 'hover:border-stone-300 focus:border-violet-500'} focus:outline-none px-1 py-0.5 min-w-0" />
              <span class="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded ${tone.iconBg} ${tone.iconText}">${Utils.escape(bucket.label)}</span>
              ${!isLocked ? `<code class="text-[9px] text-stone-400">${group.id}</code>` : '<span class="text-[9px] font-black text-stone-700 uppercase tracking-widest inline-flex items-center gap-1"><i data-lucide="lock" class="w-3 h-3"></i> Trancado</span>'}
            </div>
            <p class="text-[10px] text-stone-600 mt-1.5 ml-9">${items.length} item${items.length === 1 ? '' : 'ns'} · Total: <b class="text-rose-700">${this._money(total)}</b></p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            ${!isLocked
              ? `<button onclick="Actions.toggleRevopsGroupCollapsed('${group.id}')" title="${isCollapsed ? 'Expandir' : 'Recolher'}" class="px-1.5 py-1 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 text-stone-600"><i data-lucide="${isCollapsed ? 'chevron-down' : 'chevron-up'}" class="w-3.5 h-3.5"></i></button>`
              : ''}
            ${isLocked
              ? `<button onclick="Actions.requestUnlockRevopsGroup('${group.id}')" title="Destravar (pede senha do login)" class="px-2 py-1 rounded-lg bg-stone-700 hover:bg-stone-800 text-white text-[10px] font-black flex items-center gap-1 uppercase tracking-widest" style="color:#fff!important;"><i data-lucide="unlock" class="w-3 h-3"></i> Destravar</button>`
              : `<button onclick="if(confirm('Trancar este grupo? Só destrava com sua senha de login.')) Actions.lockRevopsGroup('${group.id}')" title="Trancar (pede senha pra destravar)" class="px-1.5 py-1 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 text-stone-600"><i data-lucide="lock" class="w-3.5 h-3.5"></i></button>`}
            ${!isLocked ? `<button onclick="Actions.addRevopsItem('${productId}', '${group.id}')" class="px-2 py-1 rounded-lg bg-white border border-stone-200 hover:border-violet-300 hover:bg-violet-50 text-stone-700 text-[10px] font-black flex items-center gap-1 uppercase tracking-widest">
              <i data-lucide="plus" class="w-3 h-3"></i> Item
            </button>` : ''}
            ${!isLocked ? `<button onclick="if(confirm('Apagar grupo \\'${Utils.escape(group.label)}\\' e todos os itens?')) Actions.deleteRevopsGroup('${productId}', '${group.id}')" title="Apagar grupo" class="px-1.5 py-1 rounded-lg bg-white border border-stone-200 hover:bg-rose-50 hover:border-rose-300 text-stone-600 hover:text-rose-700"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>` : ''}
          </div>
        </div>

        ${isCollapsed ? '' : (excelMode
          ? (items.length === 0
              ? `<div class="rounded-xl bg-white/40 border-2 border-dashed border-stone-300 px-3 py-4 text-center"><p class="text-[11px] text-stone-500">Sem itens. Clique <b>+ Item</b> pra adicionar.</p></div>`
              : `<div class="space-y-2">${items.map(it => this._itemRowExcel(productId, group, it, ev)).join('')}</div>`)
          : `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              ${[...items].sort((a, b) => (ev.itemValues[b.id] || 0) - (ev.itemValues[a.id] || 0)).map(it => this._itemCard(productId, group, it, ev)).join('')}
              ${!isLocked ? this._addItemCard(productId, group, items.length) : ''}
            </div>`)}
      </div>`;
    },

    // V36.14.4 — Slot "+ Adicionar item" no padrão dos slots do DRE/RevOps:
    // dashed border, microcopy progressivo.
    _addItemCard(productId, group, count) {
      const microcopy = count === 0 ? 'Comece aqui'
                     : count === 1 ? 'Mais um?'
                     : count < 5 ? 'Adiciona mais um'
                     : 'Outro item?';
      return `<button onclick="Actions.addRevopsItem('${productId}', '${group.id}')" type="button" class="rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50/40 hover:bg-violet-50/80 hover:border-violet-400 p-3 min-h-[140px] flex flex-col items-center justify-center gap-1 text-violet-700 transition">
        <span class="text-2xl font-black leading-none">＋</span>
        <span class="text-[11px] font-black">Adicionar item</span>
        <span class="text-[9px] text-violet-600/70">${Utils.escape(microcopy)}</span>
      </button>`;
    },

    // V32.8.2 — Renderização Modo B (Excel): item vira só uma linha com input
    // de fórmula + autocomplete via datalist + valor calculado.
    // Save vira calc.mode='custom_formula' automaticamente.
    _itemRowExcel(productId, group, item, ev) {
      const cfg = this._currentConfig(productId);
      const derivedFormula = RevopsWhitelabelEngine.deriveFormula(item.calc, cfg);
      const value = ev.itemValues[item.id] || 0;
      const isCustom = item.calc?.mode === 'custom_formula';
      const validation = RevopsWhitelabelEngine.validateFormula(derivedFormula, ev.symbols, item.id);
      // V36.14.1 — Validação visual igual RevOps: ✓ emerald, ? amber, × rose
      const status = !derivedFormula.trim() ? 'empty'
                   : validation.status === 'error' ? 'error'
                   : validation.status === 'warn' ? 'warn'
                   : Math.abs(Number(value || 0)) < 0.01 ? 'zero'
                   : 'ok';
      const borderCls = { empty: 'border-stone-300', ok: 'border-emerald-400', zero: 'border-amber-400', warn: 'border-amber-400', error: 'border-rose-400' }[status];
      const pickerKey = `excel:${productId}:${item.id}`;
      const pickerOpen = App.state.revopsHandlePickerKey === pickerKey;
      return `<div class="rounded-xl bg-white/70 border border-stone-200 p-2.5">
        <div class="flex items-center gap-2">
          <input id="lj-revops-excel-${item.id}-name" value="${Utils.escape(item.name)}" onchange="Actions.renameRevopsItem('${productId}', '${group.id}', '${item.id}', this.value)" placeholder="Nome" class="w-40 shrink-0 px-2 py-1 rounded-lg bg-white border border-stone-300 text-xs font-bold text-slate-800 focus:border-violet-400" />
          <code class="text-[9px] text-stone-400 shrink-0">${item.id} =</code>
          <input id="lj-revops-excel-${item.id}-formula" type="text" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" title="${Utils.escape(validation.message)}" value="${Utils.escape(derivedFormula)}" list="lj-revops-handles" onchange="Actions.saveRevopsExcelFormula('${productId}', '${group.id}', '${item.id}', this.value)" placeholder="=fat_bruto * 0.3" class="flex-1 min-w-0 px-2 py-1 rounded-lg bg-white border ${borderCls} text-xs font-mono text-slate-800 focus:border-violet-500" />
          <button onclick="Actions.toggleRevopsHandlePicker('${pickerKey}')" type="button" title="Escolha um número para se basear" class="shrink-0 px-1.5 py-1 rounded-lg bg-violet-50 border border-violet-200 hover:bg-violet-100 text-violet-700"><i data-lucide="${pickerOpen ? 'eye-off' : 'eye'}" class="w-3.5 h-3.5"></i></button>
          <div class="text-right shrink-0 w-24">
            <p class="text-[9px] font-black text-stone-500 uppercase tracking-widest">Calculado</p>
            <p class="text-xs font-black text-rose-700 whitespace-nowrap">−${this._money(value)}</p>
          </div>
          ${!isCustom ? `<span class="shrink-0 text-amber-600" title="Editar aqui vira fórmula custom (não dá pra voltar pro Builder fácil)"><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i></span>` : ''}
          <button onclick="if(confirm('Apagar item \\'${Utils.escape(item.name)}\\'?')) Actions.deleteRevopsItem('${productId}', '${group.id}', '${item.id}')" title="Apagar item" class="px-1.5 py-1 rounded-lg bg-white border border-stone-200 hover:bg-rose-50 hover:border-rose-300 text-stone-600 hover:text-rose-700 shrink-0"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </div>
        ${pickerOpen ? `<div class="mt-2">${this._handlePickerPopover(cfg)}</div>` : ''}
      </div>`;
    },

    // V32.11.3 — Leonardo: item Builder executivo. Inputs sóbrios com focus
    // violet, "Calculado" como pill, delete icon Lucide.
    // V35.9.1 — Items travados (auto-gerados pelo LJ) renderizam com cadeado
    // amber, sem possibilidade de rename/delete/mudar modo de cálculo.
    // V36.14.4 — Card vertical compacto (padrão Mapa Etapa 3 / Composição RevOps
    // / Deduções DRE). Substitui a linha horizontal _itemRow legacy. Engrenagem
    // com menu (Djow ajuda + Remover). Layout: nome > seletor de modo > input
    // do valor > valor calculado em rose embaixo.
    _itemCard(productId, group, item, ev) {
      const calc = item.calc || { mode: 'fixed', value: 0 };
      const value = ev.itemValues[item.id] || 0;
      const isLocked = Boolean(item.locked);
      // V36.14.5 — Letra watermark da inicial (sem cor, stone-300/40 atrás do
      // conteúdo) + sombra sólida chapada stone-200 + hover-lift sutil
      // (translate -2px + sombra cresce). Ordenação por valor decrescente
      // resolvida no _groupCard antes do map.
      const initial = (String(item.name || '?').trim().charAt(0) || '?').toUpperCase();
      const watermark = `<span class="absolute right-3 bottom-2 text-[56px] font-black text-stone-300/40 leading-none pointer-events-none select-none" style="font-family:'Inter','system-ui',sans-serif;">${Utils.escape(initial)}</span>`;
      const cardShellCls = 'lj-cost-card relative overflow-hidden';
      if (isLocked) {
        return `<div class="${cardShellCls} rounded-2xl bg-amber-50/50 border border-amber-300 p-3 min-h-[140px] flex flex-col gap-2" title="Item gerenciado pelo LJ — para alterar, desvincule as campanhas Ads no Dashboard." style="box-shadow:3px 3px 0 0 #fde68a;">
          ${watermark}
          <div class="relative flex items-start justify-between gap-2">
            <span class="text-[11px] font-black text-slate-900 inline-flex items-center gap-1 truncate"><i data-lucide="lock" class="w-3 h-3 text-amber-600 shrink-0"></i>${Utils.escape(item.name)}</span>
            <span class="px-1.5 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-[9px] font-black text-amber-800 shrink-0" title="Auto LJ"><i data-lucide="shield-check" class="w-3 h-3 inline"></i></span>
          </div>
          <p class="relative text-[9px] font-black text-amber-700 uppercase tracking-widest">Auto · LJ</p>
          <p class="relative text-[10px] text-amber-700/80 italic">Soma do gasto das campanhas Ads vinculadas.</p>
          <div class="relative mt-auto">
            <span class="text-rose-700 font-black text-base whitespace-nowrap">−${this._money(value)}</span>
          </div>
        </div>`;
      }
      const menuOpen = App.state.revopsDreCardMenuOpen === `revops-item-${item.id}`;
      return `<div class="${cardShellCls} rounded-2xl bg-white/80 border border-stone-200 p-3 min-h-[140px] flex flex-col gap-2" style="box-shadow:3px 3px 0 0 #e7e5e4;">
        ${watermark}
        <div class="relative flex items-start justify-between gap-2">
          <input id="lj-revops-item-${item.id}-name" value="${Utils.escape(item.name)}" onchange="Actions.renameRevopsItem('${productId}', '${group.id}', '${item.id}', this.value)" placeholder="Nome do item" class="flex-1 min-w-0 px-2 py-1 rounded-lg bg-white border border-stone-300 text-[11px] font-black text-slate-900" />
          <button onclick="Actions.toggleRevopsDreCardMenu('revops-item-${item.id}')" class="px-1.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 shrink-0" title="Opções">
            <i data-lucide="settings" class="w-3 h-3"></i>
          </button>
          ${menuOpen ? `<div class="absolute top-10 right-2 z-20 rounded-xl bg-white border border-stone-200 shadow-lg p-1 min-w-[140px]">
            <button onclick="if(confirm('Apagar item \\'${Utils.escape(item.name)}\\'?')) Actions.deleteRevopsItem('${productId}', '${group.id}', '${item.id}')" class="w-full text-left px-2 py-1.5 rounded-lg hover:bg-rose-50 text-[11px] text-rose-700 font-bold inline-flex items-center gap-1.5">
              <i data-lucide="trash-2" class="w-3 h-3"></i> Remover
            </button>
          </div>` : ''}
        </div>
        <select id="lj-revops-item-${item.id}-mode" onchange="Actions.changeRevopsItemMode('${productId}', '${group.id}', '${item.id}', this.value)" class="relative w-full px-2 py-1 rounded-lg bg-white border border-stone-300 text-[10px] font-bold text-slate-800">
          ${CALC_MODES.map(m => `<option value="${m.id}" ${calc.mode === m.id ? 'selected' : ''}>${m.label}</option>`).join('')}
        </select>
        <div class="relative">${this._calcInputsCompact(productId, group, item, calc, ev)}</div>
        <div class="relative mt-auto flex items-center justify-between gap-2 pt-1 border-t border-stone-200">
          <p class="text-[9px] font-black text-stone-500 uppercase tracking-widest">Calculado</p>
          <span class="text-rose-700 font-black text-base whitespace-nowrap">−${this._money(value)}</span>
        </div>
      </div>`;
    },

    // V36.14.4 — Versão compacta dos inputs por modo de cálculo, pra caber no
    // card vertical. Sem labels redundantes, sem badges expandidos.
    // V40.11.27 — Recebe `ev` do caller pra evitar re-evaluate(cfg) em cada
    // render de card (antes: cada card custom_formula re-rodava o engine,
    // 5 iterações × N items extras por card). Foi parte do "piscar" e da
    // lentidão na digitação reportados por Felipe 2026-06-22.
    _calcInputsCompact(productId, group, item, calc, ev) {
      const update = (field) => `Actions.updateRevopsItemCalc('${productId}', '${group.id}', '${item.id}', '${field}', this.value)`;
      const moneyUpdate = (field) => `Actions.updateRevopsItemCalc('${productId}', '${group.id}', '${item.id}', '${field}', Utils.parseBRL(this.value))`;
      const baseId = `lj-revops-calc-${item.id}`;
      switch (calc.mode) {
        case 'fixed':
          return `<input id="${baseId}-value" type="text" inputmode="decimal" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" value="${Utils.formatCents(calc.value || 0)}" oninput="Utils.applyMoneyMask(this)" onchange="${moneyUpdate('value')}" placeholder="R$ 0,00" class="w-full px-2 py-1 rounded-lg bg-white border border-stone-300 text-[11px] font-bold text-slate-800" />`;
        case 'percent_self':
          return `<div class="grid grid-cols-2 gap-1">
            <input id="${baseId}-baseValue" type="text" inputmode="decimal" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" value="${Utils.formatCents(calc.baseValue || 0)}" oninput="Utils.applyMoneyMask(this)" onchange="${moneyUpdate('baseValue')}" placeholder="Base R$" title="Valor base" class="px-2 py-1 rounded-lg bg-white border border-stone-300 text-[11px] font-bold text-slate-800" />
            <input id="${baseId}-factor" type="number" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" step="0.1" value="${calc.factor || 0}" onchange="${update('factor')}" placeholder="% aplicado" title="% aplicado" class="px-2 py-1 rounded-lg bg-white border border-stone-300 text-[11px] font-bold text-slate-800" />
          </div>`;
        case 'percent_of': {
          const handles = RevopsWhitelabelEngine.availableHandles(this._currentConfig(productId));
          return `<div class="grid grid-cols-2 gap-1">
            <select id="${baseId}-base" onchange="${update('base')}" title="Base de referência" class="px-1.5 py-1 rounded-lg bg-white border border-stone-300 text-[10px] font-bold text-slate-800">
              <option value="">— base —</option>
              ${handles.filter(h => h.id !== item.id).map(h => `<option value="${h.id}" ${calc.base === h.id ? 'selected' : ''}>${h.id}</option>`).join('')}
            </select>
            <input id="${baseId}-factor" type="number" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" step="0.1" value="${calc.factor || 0}" onchange="${update('factor')}" placeholder="%" title="% aplicado" class="px-2 py-1 rounded-lg bg-white border border-stone-300 text-[11px] font-bold text-slate-800" />
          </div>`;
        }
        case 'derived': {
          const groups = (this._currentConfig(productId).groups || []).filter(g => g.id !== group.id);
          return `<select id="${baseId}-groupRef" onchange="${update('groupRef')}" title="Grupo de referência" class="w-full px-2 py-1 rounded-lg bg-white border border-stone-300 text-[10px] font-bold text-slate-800">
            <option value="">— grupo —</option>
            ${groups.map(g => `<option value="${g.id}" ${calc.groupRef === g.id ? 'selected' : ''}>${Utils.escape(g.label)}</option>`).join('')}
          </select>`;
        }
        case 'custom_formula': {
          // V40.11.27 — Usa `ev.symbols` do caller (sem re-evaluate). Achado:
          // chamava evaluate(cfg) dentro de cada card custom_formula no render.
          const validation = RevopsWhitelabelEngine.validateFormula(calc.formula, ev?.symbols || {}, item.id);
          const status = !String(calc.formula || '').trim() || calc.formula === '=0' ? 'empty'
                       : validation.status === 'error' ? 'error'
                       : validation.status === 'warn' ? 'warn'
                       : Math.abs(Number(validation.value || 0)) < 0.01 ? 'zero'
                       : 'ok';
          const borderMap = { empty: 'border-stone-300', ok: 'border-emerald-400', zero: 'border-amber-400', warn: 'border-amber-400', error: 'border-rose-400' };
          return `<input id="${baseId}-formula" type="text" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" value="${Utils.escape(calc.formula || '=0')}" list="lj-revops-handles" onchange="${update('formula')}" placeholder="=fat_bruto*0,059" title="${Utils.escape(validation.message || '')}" class="w-full px-2 py-1 rounded-lg bg-white border ${borderMap[status]} text-[11px] font-mono text-slate-800" />`;
        }
        default:
          return '';
      }
    },

    _itemRow(productId, group, item, ev) {
      const calc = item.calc || { mode: 'fixed', value: 0 };
      const value = ev.itemValues[item.id] || 0;
      const isLocked = Boolean(item.locked);
      if (isLocked) {
        return `<div class="rounded-xl bg-amber-50/50 border border-amber-300 transition p-3" title="Item gerenciado pelo LJ — para alterar, desvincule as campanhas Ads no Dashboard.">
          <div class="flex items-center gap-2">
            <div class="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-white border border-amber-200 text-sm font-bold text-slate-800 flex items-center gap-2">
              <i data-lucide="lock" class="w-3.5 h-3.5 text-amber-600 shrink-0"></i>
              <span class="truncate">${Utils.escape(item.name)}</span>
            </div>
            <div class="text-right shrink-0 px-2.5 py-1 rounded-lg bg-white border border-amber-200">
              <p class="text-[9px] font-black text-amber-700 uppercase tracking-wider">Auto · LJ</p>
              <p class="text-sm font-black text-rose-700 whitespace-nowrap">−${this._money(value)}</p>
            </div>
            <div class="px-1.5 py-1 rounded-lg bg-amber-100 border border-amber-300 text-amber-700 shrink-0 self-start" title="Gerenciado pelo LJ (não pode ser removido aqui)">
              <i data-lucide="shield-check" class="w-3.5 h-3.5"></i>
            </div>
          </div>
          <p class="text-[10px] text-amber-700/80 mt-2 italic">Soma do gasto das campanhas Ads vinculadas. Pra alterar, vá em Dashboard → Google Ads.</p>
        </div>`;
      }
      return `<div class="rounded-xl bg-white/70 border border-stone-200 p-3">
        <div class="flex items-start gap-2 mb-2.5">
          <input id="lj-revops-item-${item.id}-name" value="${Utils.escape(item.name)}" onchange="Actions.renameRevopsItem('${productId}', '${group.id}', '${item.id}', this.value)" placeholder="Nome do item" class="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-white border border-stone-300 text-sm font-bold text-slate-800 focus:border-violet-400" />
          <div class="text-right shrink-0 px-2.5 py-1 rounded-lg bg-white border border-stone-200">
            <p class="text-[9px] font-black text-stone-500 uppercase tracking-widest">Calculado</p>
            <p class="text-sm font-black text-rose-700 whitespace-nowrap">−${this._money(value)}</p>
          </div>
          <button onclick="if(confirm('Apagar item \\'${Utils.escape(item.name)}\\'?')) Actions.deleteRevopsItem('${productId}', '${group.id}', '${item.id}')" title="Apagar item" class="px-1.5 py-1 rounded-lg bg-white border border-stone-200 hover:bg-rose-50 hover:border-rose-300 text-stone-600 hover:text-rose-700 shrink-0 self-start"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-2 items-end">
          <div>
            <label class="text-[9px] font-black text-stone-600 uppercase tracking-widest block mb-1">Tipo de cálculo</label>
            <select id="lj-revops-item-${item.id}-mode" onchange="Actions.changeRevopsItemMode('${productId}', '${group.id}', '${item.id}', this.value)" class="w-full px-2 py-1.5 rounded-lg bg-white border border-stone-300 text-xs font-bold text-slate-800 focus:border-violet-400">
              ${CALC_MODES.map(m => `<option value="${m.id}" ${calc.mode === m.id ? 'selected' : ''}>${m.label}</option>`).join('')}
            </select>
          </div>
          <div>
            ${this._calcInputs(productId, group, item, calc, ev)}
          </div>
        </div>
      </div>`;
    },

    // V40.11.27 — Recebe `ev` do caller (evita re-evaluate dentro de cada card).
    _calcInputs(productId, group, item, calc, ev) {
      const update = (field) => `Actions.updateRevopsItemCalc('${productId}', '${group.id}', '${item.id}', '${field}', this.value)`;
      // V32.9.5 — Inputs monetários usam mask BRL live (Utils.applyMoneyMask) +
      // parser tolerante no save (Utils.parseBRL). Aceita 115,29 / 1.234,56 /
      // R$ 1.000.000,00 / colado de planilha.
      const moneyUpdate = (field) => `Actions.updateRevopsItemCalc('${productId}', '${group.id}', '${item.id}', '${field}', Utils.parseBRL(this.value))`;
      // V36.14.1 — IDs únicos em TODOS os inputs do calcInputs (eliminar bug
      // de foco que perdia primeira letra). Tema light + validação visual.
      const baseId = `lj-revops-calc-${item.id}`;
      switch (calc.mode) {
        case 'fixed':
          return `<label class="block">
            <span class="text-[9px] font-black text-stone-600 uppercase tracking-widest">Valor (R$)</span>
            <input id="${baseId}-value" type="text" inputmode="decimal" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" value="${Utils.formatCents(calc.value || 0)}" oninput="Utils.applyMoneyMask(this)" onchange="${moneyUpdate('value')}" class="mt-0.5 w-full px-2 py-1.5 rounded-lg bg-white border border-stone-300 text-sm font-bold text-slate-800" />
          </label>`;
        case 'percent_self':
          return `<div class="grid grid-cols-2 gap-2">
            <label class="block">
              <span class="text-[9px] font-black text-stone-600 uppercase tracking-widest">Valor base (R$)</span>
              <input id="${baseId}-baseValue" type="text" inputmode="decimal" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" value="${Utils.formatCents(calc.baseValue || 0)}" oninput="Utils.applyMoneyMask(this)" onchange="${moneyUpdate('baseValue')}" class="mt-0.5 w-full px-2 py-1.5 rounded-lg bg-white border border-stone-300 text-sm font-bold text-slate-800" />
            </label>
            <label class="block">
              <span class="text-[9px] font-black text-stone-600 uppercase tracking-widest">% aplicado</span>
              <input id="${baseId}-factor" type="number" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" step="0.1" value="${calc.factor || 0}" onchange="${update('factor')}" class="mt-0.5 w-full px-2 py-1.5 rounded-lg bg-white border border-stone-300 text-sm font-bold text-slate-800" />
            </label>
          </div>`;
        case 'percent_of': {
          const handles = RevopsWhitelabelEngine.availableHandles(this._currentConfig(productId));
          return `<div class="grid grid-cols-2 gap-2">
            <label class="block">
              <span class="text-[9px] font-black text-stone-600 uppercase tracking-widest">Base (referência)</span>
              <select id="${baseId}-base" onchange="${update('base')}" class="mt-0.5 w-full px-2 py-1.5 rounded-lg bg-white border border-stone-300 text-sm font-bold text-slate-800">
                <option value="">— escolha —</option>
                ${handles.filter(h => h.id !== item.id).map(h => `<option value="${h.id}" ${calc.base === h.id ? 'selected' : ''}>${Utils.escape(h.label)} (${h.id})</option>`).join('')}
              </select>
            </label>
            <label class="block">
              <span class="text-[9px] font-black text-stone-600 uppercase tracking-widest">% aplicado</span>
              <input id="${baseId}-factor" type="number" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" step="0.1" value="${calc.factor || 0}" onchange="${update('factor')}" class="mt-0.5 w-full px-2 py-1.5 rounded-lg bg-white border border-stone-300 text-sm font-bold text-slate-800" />
            </label>
          </div>`;
        }
        case 'derived': {
          const groups = (this._currentConfig(productId).groups || []).filter(g => g.id !== group.id);
          return `<label class="block">
            <span class="text-[9px] font-black text-stone-600 uppercase tracking-widest">Grupo de referência</span>
            <select id="${baseId}-groupRef" onchange="${update('groupRef')}" class="mt-0.5 w-full px-2 py-1.5 rounded-lg bg-white border border-stone-300 text-sm font-bold text-slate-800">
              <option value="">— escolha —</option>
              ${groups.map(g => `<option value="${g.id}" ${calc.groupRef === g.id ? 'selected' : ''}>${Utils.escape(g.label)} (total)</option>`).join('')}
            </select>
          </label>`;
        }
        case 'custom_formula': {
          // V40.11.27 — Usa `ev.symbols` do caller. Antes: re-rodava o engine
          // inteiro a cada render de card custom_formula. Quando o cliente tem
          // 3+ items custom, eram 3+ evaluates redundantes por render — parte
          // do "piscar" e da lentidão de digitação.
          const cfg = this._currentConfig(productId);
          const validation = RevopsWhitelabelEngine.validateFormula(calc.formula, ev?.symbols || {}, item.id);
          const status = !String(calc.formula || '').trim() || calc.formula === '=0' ? 'empty'
                       : validation.status === 'error' ? 'error'
                       : validation.status === 'warn' ? 'warn'
                       : Math.abs(Number(validation.value || 0)) < 0.01 ? 'zero'
                       : 'ok';
          // V36.14.3 — Regra design diretor: VALOR sempre rose (é custo /
          // redução). Status da fórmula sinalizado em borda + badge.
          const statusMap = {
            empty: { border: 'border-stone-300', badge: '', valueColor: 'text-stone-400', valueLabel: '—' },
            ok:    { border: 'border-emerald-400', badge: '<span class="px-1.5 py-0.5 rounded-md bg-emerald-100 border border-emerald-300 text-[9px] font-black text-emerald-800">✓</span>', valueColor: 'text-rose-700', valueLabel: `−${this._money(validation.value)}` },
            zero:  { border: 'border-amber-400', badge: '<span title="Fórmula computa zero" class="px-1.5 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-[9px] font-black text-amber-800">?</span>', valueColor: 'text-rose-700', valueLabel: '−R$ 0' },
            warn:  { border: 'border-amber-400', badge: '<span class="px-1.5 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-[9px] font-black text-amber-800">!</span>', valueColor: 'text-rose-700', valueLabel: `−${this._money(validation.value)}` },
            error: { border: 'border-rose-400', badge: '<span class="px-1.5 py-0.5 rounded-md bg-rose-100 border border-rose-300 text-[9px] font-black text-rose-800">×</span>', valueColor: 'text-rose-700', valueLabel: 'erro' }
          };
          const s = statusMap[status];
          const pickerKey = `item:${productId}:${item.id}`;
          return `<div class="block">
            <div class="flex items-center justify-between flex-wrap gap-2">
              <span class="text-[9px] font-black text-stone-600 uppercase tracking-widest">Fórmula avançada</span>
              ${this._handlePicker(pickerKey, cfg)}
            </div>
            <input id="${baseId}-formula" type="text" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" value="${Utils.escape(calc.formula || '=0')}" list="lj-revops-handles" onchange="${update('formula')}" placeholder="=fat_bruto * 0,059" title="${Utils.escape(validation.message)}" class="mt-0.5 w-full px-2 py-1.5 rounded-lg bg-white border ${s.border} text-sm font-mono text-slate-800" />
            <div class="mt-1 flex items-center gap-2">
              ${s.badge}
              <span class="${s.valueColor} font-black text-sm">${s.valueLabel}</span>
              ${validation.suggestions && validation.suggestions.length ? `<span class="text-[10px] text-stone-500">Quis dizer: <code class="bg-white px-1 rounded">${Utils.escape(validation.suggestions[0])}</code>?</span>` : ''}
            </div>
            <p class="text-[10px] text-stone-500 mt-1 inline-flex items-center gap-1"><i data-lucide="info" class="w-3 h-3"></i> Vírgula BR (<code>0,059</code>) ou ponto (<code>0.059</code>) — ambos funcionam.</p>
          </div>`;
        }
        default:
          return '';
      }
    },

    // ────────────────────────────────────────────────────────────
    // TAB 2: OFERTAS & TM
    // ────────────────────────────────────────────────────────────

    // V38.1.2 — Reformatada no layout das outras tabs (grid 2-col com Djow
    // lateral, section offwhite #f5f3f0). Antes era um stack simples sem Djow
    // lateral nem fundo offwhite. Agora segue a régua visual cravada V36.12+.
    _offersTab(cfg, ev) {
      const offers = cfg.offers || [];
      const productId = cfg.productId;
      const djowPanel = window.DjowRevOpsPanel ? DjowRevOpsPanel.render(productId, 'offers') : '';
      // V40.7.20 — Leonardo: botão "+ Nova oferta" volta pra paleta. Outline
      // roxo --lj-revops (#AB3ED8) ao invés de fill verde. Mesma família do
      // header da aba — card respira a mesma temperatura emocional.
      const rightSide = `<button onclick="Actions.addRevopsOffer('${productId}')" class="px-3 py-2 rounded-xl bg-white border-2 hover:bg-violet-50 text-xs font-black flex items-center gap-1.5 shadow-sm transition" style="border-color:#AB3ED8;color:#7e22ce;">
        <i data-lucide="plus" class="w-3.5 h-3.5"></i> Nova oferta
      </button>`;

      // V40.7.20 — Leonardo: contagem auditável das ofertas que entram no TM.
      // Sub-linha sob o número grande responde silenciosamente "como esse
      // ticket foi calculado?" sem o CEO precisar abrir outra tela.
      const ticketContributors = (cfg.offers || []).filter(o => {
        if (Number(o.price) <= 0) return false;
        if (Number(o.mix) <= 0) return false;
        if (o.selectedForTicket === false) return false;
        return true;
      });
      const totalMixIn = ticketContributors.reduce((s, o) => s + Number(o.mix || 0), 0);
      const offerCountLabel = ticketContributors.length === 1 ? '1 oferta' : `${ticketContributors.length} ofertas`;

      // V40.8.1 — Rollback do toggle Plano/Real na UI. Felipe avaliou como
      // over-engineering. Conceito Projetado vs Real fica pra ser tratado em
      // outro lugar (Resultado Consolidado, futuro). Engine mantém capacidade
      // source-aware (`participationBreakdown`, `_realParticipationByOffer`)
      // pra reuso quando hora chegar — não há dívida técnica aqui.

      return `<div class="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        <div class="space-y-3 min-w-0">
          ${this._tabHeader('Ofertas · Pricing', 'Ofertas e Ticket Médio', 'Cadastre suas ofertas. O ticket médio nasce daqui.', rightSide)}
          <section class="rounded-3xl border p-5 shadow-md" style="background:#f5f3f0;border-color:#e7e5e0;color-scheme:light;">

            <!-- CAMADA 1: Decisão estrutural — Modo de Cálculo do Ticket Médio -->
            <div class="rounded-2xl bg-white border p-4 mb-5" style="border-color:#e7e5e0;">
              <div class="flex items-center gap-2 mb-3">
                <i data-lucide="settings-2" class="w-3.5 h-3.5" style="color:#7e22ce;"></i>
                <p class="text-[11px] font-black uppercase tracking-wider" style="color:#7e22ce;">Modo de cálculo do ticket médio</p>
              </div>
              <div class="grid sm:grid-cols-2 gap-2">
                <label class="flex items-start gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition ${cfg.ticketMode === 'weighted' ? 'bg-violet-50' : 'bg-stone-50 hover:bg-stone-100 border-stone-200'}" ${cfg.ticketMode === 'weighted' ? 'style="border-color:#AB3ED8;"' : ''}>
                  <input type="radio" name="lj-tm-mode" ${cfg.ticketMode === 'weighted' ? 'checked' : ''} onchange="Actions.setRevopsTicketMode('${productId}', 'weighted')" class="mt-0.5 accent-violet-600" />
                  <div class="min-w-0">
                    <div class="text-[13px] font-black text-slate-900">Ponderado</div>
                    <div class="text-[11px] text-slate-600 leading-snug">TM = média das ofertas, peso pelo mix. Use quando o cliente compra um mix variado.</div>
                  </div>
                </label>
                <label class="flex items-start gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition ${cfg.ticketMode === 'manual' ? 'bg-violet-50' : 'bg-stone-50 hover:bg-stone-100 border-stone-200'}" ${cfg.ticketMode === 'manual' ? 'style="border-color:#AB3ED8;"' : ''}>
                  <input type="radio" name="lj-tm-mode" ${cfg.ticketMode === 'manual' ? 'checked' : ''} onchange="Actions.setRevopsTicketMode('${productId}', 'manual')" class="mt-0.5 accent-violet-600" />
                  <div class="min-w-0">
                    <div class="text-[13px] font-black text-slate-900">Manual</div>
                    <div class="text-[11px] text-slate-600 leading-snug">TM fixo definido por você. Use quando todo cliente compra o mesmo pacote.</div>
                  </div>
                </label>
              </div>
              ${cfg.ticketMode === 'manual' ? `<div class="mt-3 pt-3 border-t border-stone-200 flex items-center gap-3">
                <label class="text-[11px] font-black text-slate-600 uppercase tracking-wider">Ticket fixo:</label>
                <input type="text" inputmode="decimal" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" value="${Utils.formatCents(cfg.ticketManualValue || 0)}" oninput="Utils.applyMoneyMask(this)" onchange="Actions.setRevopsTicketManual('${productId}', Utils.parseBRL(this.value))" placeholder="0,00" class="px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-sm font-bold text-slate-800 w-36" />
              </div>` : ''}
            </div>

            <!-- CAMADA 2: Operação contínua — Ofertas cadastradas -->
            <div class="flex items-baseline justify-between mb-3">
              <p class="text-[11px] font-black uppercase tracking-wider" style="color:#7e22ce;">Suas ofertas</p>
              <p class="text-[10px] text-stone-500">${offers.length === 0 ? 'Nenhuma' : `${offers.length} cadastrada${offers.length > 1 ? 's' : ''}`}</p>
            </div>

            ${offers.length === 0
              ? `<div class="rounded-2xl bg-amber-50 border-2 border-dashed border-amber-300 p-5 text-center">
                  <p class="text-sm font-bold text-amber-900 mb-1">Nenhuma oferta cadastrada</p>
                  <p class="text-xs text-amber-800">Sem oferta, Faturamento Bruto = 0. Crie ao menos uma.</p>
                </div>`
              : `<div class="space-y-2">${offers.map(o => this._offerRow(productId, o, cfg.ticketMode)).join('')}</div>`}

            <!-- CAMADA 3: Síntese — Ticket médio calculado (resposta do card) -->
            <!-- V40.11.26 — Dual Projetado · Realizado. Projetado vem das ofertas
                 cadastradas (média ponderada plano). Realizado vem do Checkout
                 (Hotmart approved últimos 30d, via RevopsFinanceEngine.productRealTicket).
                 Lei [[feedback_no_source_no_dash]]: sem dado real, mostra
                 placeholder honesto, não inventa número. -->
            ${cfg.ticketMode === 'weighted' && offers.length > 0 ? (() => {
              const tmReal = window.RevopsFinanceEngine
                ? RevopsFinanceEngine.productRealTicket(productId)
                : 0;
              const hasReal = tmReal > 0;
              const divergePct = hasReal && ev.ticket > 0
                ? ((tmReal - ev.ticket) / ev.ticket) * 100
                : 0;
              const divergeBadge = hasReal && Math.abs(divergePct) >= 10
                ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black ${divergePct > 0 ? 'bg-emerald-500/15 text-emerald-700' : 'bg-rose-500/15 text-rose-700'} uppercase tracking-wider">
                    <i data-lucide="${divergePct > 0 ? 'trending-up' : 'trending-down'}" class="w-2.5 h-2.5"></i>
                    ${divergePct > 0 ? '+' : ''}${divergePct.toFixed(0)}%
                  </span>`
                : '';
              return `
              <div class="mt-5 rounded-2xl border p-5" style="background:rgba(171,62,216,0.06);border-color:rgba(171,62,216,0.25);">
                <div class="flex items-baseline gap-2 mb-3">
                  <i data-lucide="calculator" class="w-3 h-3" style="color:#7e22ce;"></i>
                  <p class="text-[10px] font-black uppercase tracking-wider" style="color:#7e22ce;">Ticket médio calculado</p>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p class="text-[9px] font-black text-stone-500 uppercase tracking-wider mb-0.5">Projetado <span class="font-normal normal-case text-stone-400">· ofertas cadastradas</span></p>
                    <div class="text-2xl font-black text-stone-700">${this._moneyPrecise(ev.ticket)}</div>
                    <p class="text-[10px] text-stone-500 mt-0.5">
                      ${ticketContributors.length === 0
                        ? 'Nenhuma oferta entra no cálculo.'
                        : `${offerCountLabel} · ${totalMixIn.toFixed(0)}% de projeção`}
                    </p>
                  </div>
                  <div>
                    <p class="text-[9px] font-black uppercase tracking-wider mb-0.5 flex items-center gap-1.5" style="color:#7e22ce;">
                      Realizado <span class="font-normal normal-case text-stone-400">· checkout últimos 30d</span>
                      ${divergeBadge}
                    </p>
                    ${hasReal
                      ? `<div class="text-3xl font-black" style="color:#7e22ce;">${this._moneyPrecise(tmReal)}</div>
                         <p class="text-[10px] text-stone-500 mt-0.5">média Hotmart approved</p>`
                      : `<div class="text-2xl font-black text-stone-400">—</div>
                         <p class="text-[10px] text-stone-500 mt-0.5">Sem vendas Hotmart approved ainda</p>`}
                  </div>
                </div>
                ${hasReal && Math.abs(divergePct) >= 25 ? `
                  <div class="mt-3 pt-3 border-t border-violet-200/50 flex items-start gap-2 text-[11px] text-stone-600">
                    <i data-lucide="alert-circle" class="w-3 h-3 mt-0.5 shrink-0" style="color:#7e22ce;"></i>
                    <span>Ticket real está ${divergePct > 0 ? 'acima' : 'abaixo'} do projetado em ${Math.abs(divergePct).toFixed(0)}%. Revise o <b>preço</b> ou o <b>mix</b> das ofertas pra cascata refletir a operação.</span>
                  </div>
                ` : ''}
              </div>
              `;
            })() : ''}
          </section>
        </div>
        <aside class="xl:sticky xl:top-4 xl:self-start">${djowPanel}</aside>
      </div>`;
    },

    // V40.7.20 — Leonardo: refator do card de oferta.
    //   - Checkbox TM REMOVIDA. MIX agora é alavanca única (mix=0 = excluída).
    //   - Card "respira" mais (p-4, gap maior, hierarquia tipográfica clara).
    //   - Quando mix=0, card vai pra 55% opacity + side accent fica cinza.
    //     Usuário VÊ que oferta está fora sem precisar interpretar checkbox.
    //   - TIPO dropdown ganhou subdescrição inline abaixo do select.
    //   - Side accent emerald (semântica de Receita preservada — coerência).
    //   - Barra de progresso lateral ao número do mix ancora a percepção de
    //     peso no agregado.
    _offerRow(productId, offer, ticketMode) {
      const isWeighted = ticketMode === 'weighted';
      const kind = offer.kind || 'main';
      const mix = Number(offer.mix || 0);
      const excluded = isWeighted && mix <= 0;

      const KIND_LABELS = {
        'main':       { label: 'Principal',    desc: 'o produto que define o ticket' },
        'cross-sell': { label: 'Cross-sell',   desc: 'soma no checkout, peso menor' },
        'up-sell':    { label: 'Up-sell',      desc: 'pós-compra, peso maior' },
        'down-sell':  { label: 'Down-sell',    desc: 'recuperação, peso menor' }
      };
      const kindMeta = KIND_LABELS[kind] || KIND_LABELS.main;

      const labelCls = 'text-[9px] font-black text-slate-500 uppercase tracking-wider';
      const inputCls = 'mt-0.5 w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 focus:border-violet-400 focus:bg-white';

      const sideAccent = excluded ? 'border-l-stone-300' : 'border-l-emerald-500';
      const iconBg = excluded ? 'bg-stone-200 text-stone-500' : 'bg-emerald-500/15 text-emerald-700';
      const cardStyle = excluded ? 'opacity:0.55;' : '';

      // V40.7.20 — Barra de progresso do mix (ancora percepção de peso)
      const mixBar = isWeighted ? `<div class="mt-1 h-1 w-full rounded-full bg-slate-200 overflow-hidden">
        <div class="h-full rounded-full transition-all" style="width:${Math.min(100, mix)}%;background:${excluded ? '#cbd5e1' : '#10b981'};"></div>
      </div>` : '';

      return `<div class="rounded-xl bg-white border border-slate-200 border-l-4 ${sideAccent} hover:border-slate-300 transition p-4" style="${cardStyle}">
        <div class="flex items-end gap-3 flex-wrap">
          <span class="shrink-0 w-8 h-8 rounded-lg ${iconBg} grid place-items-center mb-0.5">
            <i data-lucide="tag" class="w-3.5 h-3.5"></i>
          </span>
          <label class="block w-32 shrink-0">
            <span class="${labelCls}">Tipo</span>
            <select onchange="Actions.updateRevopsOfferField('${productId}', '${offer.id}', 'kind', this.value)" class="${inputCls} text-xs">
              <option value="main" ${kind === 'main' ? 'selected' : ''} title="o produto que define o ticket">Principal</option>
              <option value="cross-sell" ${kind === 'cross-sell' ? 'selected' : ''} title="soma no checkout, peso menor">Cross-sell</option>
              <option value="up-sell" ${kind === 'up-sell' ? 'selected' : ''} title="pós-compra, peso maior">Up-sell</option>
              <option value="down-sell" ${kind === 'down-sell' ? 'selected' : ''} title="recuperação, peso menor">Down-sell</option>
            </select>
          </label>
          <label class="block flex-1 min-w-0">
            <span class="${labelCls}">Nome da oferta</span>
            <input value="${Utils.escape(offer.name)}" onchange="Actions.renameRevopsOffer('${productId}', '${offer.id}', this.value)" placeholder="Nome da oferta" class="${inputCls}" />
          </label>
          <label class="block w-28">
            <span class="${labelCls}">Preço (R$)</span>
            <input type="text" inputmode="decimal" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" value="${Utils.formatCents(offer.price || 0)}" oninput="Utils.applyMoneyMask(this)" onchange="Actions.updateRevopsOfferField('${productId}', '${offer.id}', 'price', Utils.parseBRL(this.value))" class="${inputCls}" />
          </label>
          <label class="block w-24">
            <span class="${labelCls}">Meta</span>
            <input type="number" min="0" step="1" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" value="${offer.metaVendas || 0}" onchange="Actions.updateRevopsOfferField('${productId}', '${offer.id}', 'metaVendas', this.value)" placeholder="0" title="Meta de vendas no período" class="${inputCls}" />
          </label>
          ${isWeighted ? `<label class="block w-24">
            <span class="${labelCls}">Projetado</span>
            <div class="flex items-center gap-1">
              <input type="number" min="0" max="100" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" step="0.1" value="${offer.mix}" onchange="Actions.updateRevopsOfferField('${productId}', '${offer.id}', 'mix', this.value)" title="${excluded ? 'Projetado 0% = oferta fora do cálculo do ticket médio' : 'Participação projetada desta oferta no ticket médio. Premissa que alimenta as projeções/KRs.'}" class="${inputCls}" />
              <span class="text-[10px] font-black text-slate-400">%</span>
            </div>
            ${mixBar}
          </label>` : ''}
          <button onclick="if(confirm('Apagar oferta \\'${Utils.escape(offer.name)}\\'?')) Actions.deleteRevopsOffer('${productId}', '${offer.id}')" title="Apagar oferta" class="px-2 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-300 text-slate-600 hover:text-rose-700 shrink-0 self-end mb-0.5"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </div>
        <!-- V40.7.20 — Subdescrição inline do tipo. Conecta dropdown ao significado. -->
        <p class="mt-2 pl-11 text-[11px] text-slate-500 italic">
          <span class="font-bold not-italic text-slate-600">${kindMeta.label}</span> — ${kindMeta.desc}${excluded ? ' · <span class="text-stone-500 not-italic">fora do cálculo do TM (projetado 0%)</span>' : ''}
        </p>
      </div>`;
    },

    // ────────────────────────────────────────────────────────────
    // TAB 3: RESULTADO
    // ────────────────────────────────────────────────────────────

    // V37.0.0 — Refactor pro layout régua: wrapper offwhite, grid 2-col com Djow
    // lateral sticky, selector de período (3 meses atrás → 3 à frente), área
    // dedicada de METAS (Vendas + CAC) com input inline e badge de variância.
    // Mantém indicadores principais + realizado + simulator + comparador.
    _resultTab(cfg, ev) {
      const productId = cfg.productId;
      const realSales = RevopsFinanceEngine?.productRealSales?.(productId) || 0;
      const realRevenue = realSales * ev.ticket;

      // Período visível (default = mês corrente)
      const now = new Date();
      const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const period = App.state.resultadoPeriod?.[productId] || currentPeriod;
      const meta = (App.state.metasResultado?.[productId]?.[period]) || { vendas: 0, cac: 0 };

      // Simulator (mantido)
      const sim = App.state.revopsSimulator || { active: false };
      const simSales = sim.active && sim.salesOverride != null ? sim.salesOverride : ev.sales;
      const simTicket = sim.active && sim.ticketOverride != null ? sim.ticketOverride : ev.ticket;
      const simEv = sim.active ? RevopsWhitelabelEngine.evaluate(cfg, { sales: simSales, ticket: simTicket }) : ev;

      const totalSales = simEv.sales;
      const ctc = simEv.acquisitionTotal;
      const cac = totalSales > 0 ? ctc / totalSales : 0;
      const fatBruto = simEv.fatBruto;
      const baseTotalSales = ev.sales;
      const baseCtc = ev.acquisitionTotal;
      const baseCac = baseTotalSales > 0 ? baseCtc / baseTotalSales : 0;
      const baseFatBruto = ev.fatBruto;

      // CAC realizado (do funil): CTC ÷ vendas reais
      const realCac = realSales > 0 ? ev.acquisitionTotal / realSales : 0;

      // Selector de período: 3 atrás + corrente + 3 à frente
      const periodOpts = [];
      for (let i = -3; i <= 3; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const p = `${y}-${m}`;
        let label = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace(/\./g, '');
        label = label.charAt(0).toUpperCase() + label.slice(1);
        periodOpts.push({ p, label, isCurrent: i === 0 });
      }
      const currentPeriodLabel = periodOpts.find(o => o.p === period)?.label || period;
      const periodSelect = `<select id="lj-resultado-period-${productId}" onchange="Actions.setResultadoPeriod('${productId}', this.value)" class="px-3 py-2 rounded-xl bg-white border border-stone-300 text-xs font-bold text-slate-800 shadow-sm">
        ${periodOpts.map(o => `<option value="${o.p}" ${o.p === period ? 'selected' : ''}>${Utils.escape(o.label)}${o.isCurrent ? ' (atual)' : ''}</option>`).join('')}
      </select>`;

      const simBtn = `<button onclick="Actions.toggleRevopsSimulator()" class="px-3 py-2 rounded-xl ${sim.active ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-white border border-stone-300 hover:bg-stone-50 text-slate-700'} text-xs font-black flex items-center gap-1.5 shadow-sm" ${sim.active ? 'style="color:#fff!important;"' : ''}>
        <i data-lucide="${sim.active ? 'pause' : 'flask-conical'}" class="w-3.5 h-3.5"></i>
        ${sim.active ? 'Sair do Simulador' : 'Simular cenário'}
      </button>`;
      const rightSide = `${periodSelect}${simBtn}`;

      const djowPanel = window.DjowRevOpsPanel ? DjowRevOpsPanel.render(productId, 'result') : '';

      // V40.11.14 — Modal edit-in-place da Meta de CAC.
      const cacMetaEdit = App.state.cacMetaEditOpen;
      const cacMetaModal = (cacMetaEdit && String(cacMetaEdit.productId) === String(productId)) ? `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40" onclick="if(event.target === this) Actions.closeCacMetaEdit()">
          <div class="bg-white rounded-2xl shadow-xl p-5 w-80 border border-stone-200" style="border-left: 4px solid #AB3ED8;">
            <div class="flex items-center gap-1.5 mb-1">
              <span class="w-2 h-2 rounded-full" style="background: #AB3ED8;"></span>
              <h3 class="text-xs font-black uppercase tracking-widest" style="color: #6D28D9;">Meta de CAC · ${Utils.escape(currentPeriodLabel)}</h3>
            </div>
            <p class="text-[11px] text-slate-500 mb-4">Quanto você quer pagar, no máximo, pra adquirir cada cliente novo neste período. Menor é melhor.</p>
            <label class="block">
              <span class="text-[10px] font-black text-slate-500 uppercase tracking-wider">Valor (R$)</span>
              <input id="lj-cac-meta-input" type="text" inputmode="decimal" autofocus
                     value="${Utils.escape(cacMetaEdit.draft)}"
                     oninput="Utils.applyMoneyMask && Utils.applyMoneyMask(this); Actions.updateCacMetaEditDraft(this.value);"
                     onkeydown="if(event.key==='Enter'){event.preventDefault();Actions.saveCacMetaEdit();}if(event.key==='Escape'){Actions.closeCacMetaEdit();}"
                     placeholder="R$ 0,00"
                     class="mt-0.5 w-full px-3 py-2 rounded-lg bg-white border border-stone-300 text-base font-bold text-slate-800 focus:border-violet-400 focus:outline-none" />
            </label>
            <div class="flex items-center gap-2 mt-4">
              <button onclick="Actions.closeCacMetaEdit()" class="flex-1 px-3 py-2 rounded-lg bg-white border border-stone-300 hover:bg-stone-50 text-xs font-black text-slate-700">Cancelar</button>
              <button onclick="Actions.saveCacMetaEdit()" class="flex-1 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-xs font-black" style="color:#fff!important;">Salvar</button>
            </div>
          </div>
        </div>
      ` : '';

      return `${cacMetaModal}<div class="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        <div class="space-y-3 min-w-0">
          ${this._tabHeader('Resultado · Indicadores', 'Resultado Consolidado', 'A vida da operação em três cards: Receita, CAC e Vendas. Realizado · Projetado · Meta.', rightSide)}
          <section class="rounded-3xl border p-5 shadow-md space-y-4" style="background:#f5f3f0;border-color:#e7e5e0;color-scheme:light;">
            ${sim.active ? this._simulatorPanel(cfg, ev, simEv) : ''}

            <!-- V40.11.13 — Bloco Metas: header reforçado (ícone target + texto sm),
                 3 cards triangulares dentro do MESMO bloco (Receita, CAC, Vendas) com
                 space-y-5 entre cards pra Gestalt da proximidade ficar clara. -->
            <div class="space-y-5">
              <div class="flex items-center gap-2 pb-1.5 border-b border-stone-300">
                <i data-lucide="target" class="w-4 h-4 text-slate-700"></i>
                <p class="text-sm font-black text-slate-700 uppercase tracking-wider">Metas · ${Utils.escape(currentPeriodLabel)}</p>
              </div>
              ${this._revenueCard(productId, currentPeriodLabel)}
              ${this._cacCard(productId, currentPeriodLabel)}
              ${this._salesCard(productId, currentPeriodLabel)}
            </div>

            ${sim.active ? this._simulatorEbitdaCompare(ev, simEv) : ''}
            ${this._scenarioCompareBlock(cfg, ev)}
          </section>
        </div>
        <aside class="xl:sticky xl:top-4 xl:self-start">${djowPanel}</aside>
      </div>`;
    },

    // V37.0.0 — Card editável de meta (Vendas ou CAC) com badge de variância.
    // Cores design diretor:
    //   • Vendas: realizado ≥ meta → emerald (mais é melhor); senão → rose
    //   • CAC:    realizado ≤ meta → emerald (menos é melhor); senão → rose
    // ID único no input pra _captureFocus preservar foco entre re-renders.
    _metaCard(productId, period, kind, metaValue, realizedValue) {
      const isVendas = kind === 'vendas';
      const label = isVendas ? 'Meta de Vendas' : 'Meta de CAC';
      const subtitle = isVendas ? 'Vendas convertidas no mês' : 'Custo de aquisição por venda';
      const icon = isVendas ? 'target' : 'shield-check';
      const periodSlug = period.replace('-', '');
      const inputId = `lj-meta-${kind}-${productId}-${periodSlug}`;

      // V38.1.2 — Meta de Vendas vive na OFERTA (V38.0.3), não mais em
      // metasResultado. Aqui mostra a soma das ofertas como read-only + link
      // pra editar lá. CAC continua editável em metasResultado.
      if (isVendas) {
        const offers = App.state.revopsFinanceV2?.[productId]?.offers || [];
        metaValue = offers.reduce((s, o) => s + (Number(o.metaVendas) || 0), 0);
      }

      // Variância
      let varCls = 'bg-stone-100 border-stone-200 text-stone-600';
      let varIcon = 'minus';
      let varLabel = '—';
      if (metaValue > 0 && realizedValue > 0) {
        const pct = (realizedValue / metaValue) * 100;
        const atingiu = isVendas ? realizedValue >= metaValue : realizedValue <= metaValue;
        varCls = atingiu ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700';
        if (isVendas) {
          varIcon = atingiu ? 'trending-up' : 'trending-down';
        } else {
          varIcon = atingiu ? 'trending-down' : 'trending-up';
        }
        varLabel = `${pct.toFixed(0)}% da meta`;
      } else if (metaValue > 0 && realizedValue === 0) {
        varCls = 'bg-amber-50 border-amber-200 text-amber-700';
        varIcon = 'clock';
        varLabel = 'Aguardando realizado';
      } else if (metaValue === 0) {
        varCls = 'bg-stone-100 border-stone-200 text-stone-500';
        // V38.1.4 — Vendas é read-only (vem da soma das ofertas), então o
        // ícone lápis confunde. Mostra seta externa apontando pra Ofertas.
        varIcon = isVendas ? 'external-link' : 'edit-3';
        varLabel = isVendas ? 'Sem meta nas ofertas' : 'Sem meta';
      }

      const metaDisplay = isVendas
        ? (metaValue > 0 ? Math.round(metaValue).toLocaleString('pt-BR') : '')
        : (metaValue > 0 ? Utils.formatCents(metaValue) : '');
      const realDisplay = isVendas
        ? Math.round(realizedValue).toLocaleString('pt-BR')
        : this._money(realizedValue);

      const parser = isVendas
        ? `Number(String(this.value).replace(/[^0-9]/g, '')) || 0`
        : `Utils.parseBRL(this.value)`;
      const inputMode = isVendas ? 'numeric' : 'decimal';
      const maskAttr = isVendas ? '' : 'oninput="Utils.applyMoneyMask(this)"';
      const placeholder = isVendas ? '0' : 'R$ 0,00';

      return `<div class="lj-cost-card relative rounded-2xl bg-white/70 border border-stone-200 p-4 transition" style="box-shadow:3px 3px 0 0 #e7e5e4;">
        <div class="flex items-start gap-2 mb-3">
          <span class="shrink-0 w-8 h-8 rounded-lg bg-violet-500/15 grid place-items-center text-violet-700">
            <i data-lucide="${icon}" class="w-4 h-4"></i>
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest">${label}</p>
            <p class="text-[10px] text-slate-500 mt-0.5">${subtitle}</p>
          </div>
        </div>
        ${isVendas ? `
          <div class="block">
            <span class="text-[9px] font-black text-slate-500 uppercase tracking-wider">Meta do período (soma das ofertas)</span>
            <div class="mt-0.5 w-full px-3 py-2 rounded-lg bg-stone-50 border border-stone-200 text-sm font-bold text-slate-800 flex items-center justify-between gap-2">
              <span>${metaValue > 0 ? Math.round(metaValue).toLocaleString('pt-BR') : '—'}</span>
              <button onclick="Actions.setRevopsWhitelabelTab('offers')" class="text-[10px] font-bold text-violet-700 hover:text-violet-900 inline-flex items-center gap-1 whitespace-nowrap" title="Ajustar metas nas ofertas">
                <i data-lucide="external-link" class="w-3 h-3"></i> Ajustar nas Ofertas
              </button>
            </div>
          </div>
        ` : `
          <label class="block">
            <span class="text-[9px] font-black text-slate-500 uppercase tracking-wider">Meta do período</span>
            <input id="${inputId}" type="text" inputmode="${inputMode}" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" value="${metaDisplay}" ${maskAttr} onchange="Actions.updateMetaResultado('${productId}', '${period}', '${kind}', ${parser})" placeholder="${placeholder}" class="mt-0.5 w-full px-3 py-2 rounded-lg bg-white border border-stone-300 text-sm font-bold text-slate-800 focus:border-violet-400 focus:outline-none" />
          </label>
        `}
        <div class="mt-3 flex items-end justify-between gap-2">
          <div class="min-w-0">
            <p class="text-[9px] font-black text-slate-500 uppercase tracking-wider">Realizado</p>
            <p class="text-xl font-black text-slate-900 mt-0.5">${realDisplay}</p>
          </div>
          <span class="inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-black uppercase tracking-wider ${varCls}">
            <i data-lucide="${varIcon}" class="w-3 h-3"></i>
            ${varLabel}
          </span>
        </div>
      </div>`;
    },

    // V40.11.9 — Leonardo Onda 3: pulse semafórico de saúde.
    // kind='higher' (Receita, Vendas): healthRatio = (real/meta) ÷ (dia/totalDias do mês).
    //   ≥1 verde "No ritmo", 0.7-1 amber "Atenção", <0.7 rose "Crítico".
    // kind='lower' (CAC): healthRatio = real/meta. ≤1 verde, ≤1.3 amber, >1.3 rose.
    // Sem meta ou sem real → badge cinza neutro com label honesto.
    _healthBadge(realValue, metaValue, kind) {
      if (!metaValue || metaValue <= 0) {
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest" style="background: #F3F4F6; color: #6B7280;">
          <span class="w-1.5 h-1.5 rounded-full" style="background: #9CA3AF;"></span>
          Sem meta
        </span>`;
      }
      if (!realValue || realValue <= 0) {
        return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest" style="background: #F3F4F6; color: #6B7280;">
          <span class="w-1.5 h-1.5 rounded-full" style="background: #9CA3AF;"></span>
          Aguardando dado
        </span>`;
      }
      let color, label;
      if (kind === 'lower') {
        const ratio = realValue / metaValue;
        if (ratio <= 1.0) { color = '#10B981'; label = 'Dentro da meta'; }
        else if (ratio <= 1.3) { color = '#F59E0B'; label = 'Acima da meta'; }
        else { color = '#EF4444'; label = 'Crítico'; }
      } else {
        const now = new Date();
        const day = now.getDate();
        const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const monthRatio = day / totalDays;
        const progressRatio = realValue / metaValue;
        const healthRatio = monthRatio > 0 ? progressRatio / monthRatio : 0;
        if (healthRatio >= 1) { color = '#10B981'; label = 'No ritmo'; }
        else if (healthRatio >= 0.7) { color = '#F59E0B'; label = 'Atenção'; }
        else { color = '#EF4444'; label = 'Crítico'; }
      }
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest" style="background: ${color}1A; color: ${color};">
        <span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background: ${color};"></span>
        ${label}
      </span>`;
    },

    // V40.10.0 — Card de Receita do mês — Realizado · Projetado · Meta numa
    // régua única. Substitui os 2 cards "Meta de Vendas" + "Meta de CAC" da
    // tab Resultado. Conceito Djow: Governança é leitura, não diagnóstico —
    // cliente esbarra com o número, não discute com ele. Sem CTA, sem badge
    // de divergência, sem banner. Drill vai pra Velocidade.
    _revenueCard(productId, currentPeriodLabel) {
      const summary = RevopsFinanceEngine?.productRevenueSummary?.(productId) || {
        realRevenue: 0, projectedRevenue: 0, metaRevenue: 0,
        convertedCount: 0, leadsAlive: 0, crmProjectedSales: 0, conversionRate: 0,
        crmTicket: 0, metaSales: 0, sourceLabel: ''
      };
      const { realRevenue, projectedRevenue, metaRevenue, convertedCount, crmProjectedSales, crmTicket, metaSales } = summary;

      // Escala da régua: Meta vira 100%. Se Realizado > Meta, respira 5% à direita.
      const baseScale = metaRevenue > 0 ? metaRevenue : Math.max(projectedRevenue, realRevenue, 1);
      const maxValue = Math.max(realRevenue, projectedRevenue, metaRevenue) * 1.05;
      const realPos = Math.min(100, (realRevenue / maxValue) * 100);
      const projPos = Math.min(100, (projectedRevenue / maxValue) * 100);
      const metaPos = Math.min(100, (metaRevenue / maxValue) * 100);

      // % relativo à Meta (não à escala visual)
      const realPctMeta = metaRevenue > 0 ? (realRevenue / metaRevenue) * 100 : 0;
      const projPctMeta = metaRevenue > 0 ? (projectedRevenue / metaRevenue) * 100 : 0;

      const moneyDigits = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
      const fmt = (v) => moneyDigits.format(Number(v) || 0);

      // Rastreio cinza — selo de procedência (V40.11.10: colapsa via details)
      const rastreio = `
        <details class="pt-3 border-t border-stone-200 group">
          <summary class="text-[10px] font-black text-slate-500 hover:text-slate-700 cursor-pointer uppercase tracking-widest inline-flex items-center gap-1 select-none">
            <i data-lucide="chevron-right" class="w-3 h-3 transition-transform group-open:rotate-90"></i>
            Como esse número foi calculado?
          </summary>
          <div class="space-y-1 text-[11px] text-slate-500 mt-2 pl-4">
            <p><span class="font-bold text-slate-600">Realizado:</span> ${convertedCount.toLocaleString('pt-BR')} vendas aprovadas no Checkout (últimos 30d)</p>
            <p><span class="font-bold text-slate-600">Projetado:</span> ${crmProjectedSales.toLocaleString('pt-BR')} vendas projetadas no funil do CRM × ${this._moneyPrecise(crmTicket)} ticket CRM</p>
            <p><span class="font-bold text-slate-600">Meta:</span> ${metaSales > 0 ? `soma de ${metaSales.toLocaleString('pt-BR')} vendas configuradas em Ofertas` : 'sem meta configurada · ajuste em Ofertas'}</p>
            ${summary.sourceLabel ? `<p class="italic pt-1">Fonte atual: ${summary.sourceLabel}</p>` : ''}
          </div>
        </details>`;

      // V40.11.17 — Régua sem labels posicionais. Marcadores na barra +
      // legenda em row embaixo (chips com cor · nome · %). Acabou colisão.
      const _now = new Date();
      const _day = _now.getDate();
      const _totalDays = new Date(_now.getFullYear(), _now.getMonth() + 1, 0).getDate();
      const _monthRatio = _day / _totalDays;
      const _ghostPos = metaRevenue > 0 ? _monthRatio * metaPos : 0;

      const regua = `
        <div class="relative h-1.5 bg-stone-200 rounded-full mt-7 mb-3">
          ${metaRevenue > 0 ? `
            <span class="absolute -top-4 text-[9px] font-black uppercase tracking-wider text-slate-600 -translate-x-1/2 select-none pointer-events-none" style="left: ${_ghostPos.toFixed(1)}%;">hoje</span>
            <div class="absolute -top-1.5 w-0.5 h-4 bg-slate-600 opacity-90 hover:opacity-100 transition-opacity" style="left: ${_ghostPos.toFixed(1)}%;" title="Hoje: dia ${_day} de ${_totalDays} — Realizado deveria estar aqui se on-track."></div>
            <div class="absolute -top-1 w-0.5 h-3.5 bg-emerald-600" style="left: ${metaPos.toFixed(1)}%;"></div>
          ` : ''}
          ${projectedRevenue > 0 ? `
            <div class="absolute -top-1 w-3 h-3 rounded-full bg-violet-600 ring-2 ring-white" style="left: ${projPos.toFixed(1)}%; transform: translateX(-50%);"></div>
          ` : ''}
          ${realRevenue > 0 ? `
            <div class="absolute -top-1 w-3 h-3 rounded-full bg-sky-600 ring-2 ring-white shadow" style="left: ${realPos.toFixed(1)}%; transform: translateX(-50%);"></div>
          ` : ''}
        </div>
        <div class="flex items-center gap-x-5 gap-y-1 flex-wrap text-[11px] mb-4">
          ${realRevenue > 0 ? `
            <span class="inline-flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
              <span class="font-black text-sky-700 uppercase tracking-wider">Realizado</span>
              ${metaRevenue > 0 ? `<span class="text-slate-500">${realPctMeta.toFixed(0)}%</span>` : ''}
            </span>
          ` : ''}
          ${projectedRevenue > 0 ? `
            <span class="inline-flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-violet-600"></span>
              <span class="font-black text-violet-700 uppercase tracking-wider">Projetado</span>
              ${metaRevenue > 0 ? `<span class="text-slate-500">${projPctMeta.toFixed(0)}%</span>` : ''}
            </span>
          ` : ''}
          ${metaRevenue > 0 ? `
            <span class="inline-flex items-center gap-1.5">
              <span class="w-0.5 h-2.5 bg-emerald-600"></span>
              <span class="font-black text-emerald-700 uppercase tracking-wider">Meta</span>
              <span class="text-slate-500">100%</span>
            </span>
          ` : ''}
        </div>`;

      return `<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" style="border-left: 4px solid #F6DB5C;">
        <div class="flex items-center justify-between gap-2 mb-4">
          <p class="text-xs font-black uppercase tracking-widest inline-flex items-center gap-1.5" style="color: #92660D;">
            <span class="w-2 h-2 rounded-full" style="background: #F6DB5C;"></span>
            Receita · ${Utils.escape(currentPeriodLabel)}
            <i data-lucide="info" class="w-3 h-3 text-slate-400 hover:text-slate-600 cursor-help ml-1" title="A vida da operação: o que entrou, o que vai entrar, o que se comprometeu a entregar."></i>
          </p>
          ${this._healthBadge(realRevenue, metaRevenue, 'higher')}
        </div>

        <div class="grid grid-cols-3 gap-3 mb-2 items-end">
          <div class="min-w-0">
            <p class="text-[10px] font-black text-sky-700 uppercase tracking-wider">Realizado</p>
            <p class="text-3xl font-black text-slate-900 mt-0.5 truncate leading-tight">${fmt(realRevenue)}</p>
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-black text-violet-700 uppercase tracking-wider">Projetado</p>
            <p class="text-2xl font-black text-slate-700 mt-0.5 truncate leading-tight">${fmt(projectedRevenue)}</p>
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Meta</p>
            <p class="text-xl font-black text-slate-600 mt-0.5 truncate leading-tight">${metaRevenue > 0 ? fmt(metaRevenue) : '—'}</p>
          </div>
        </div>

        ${regua}

        ${rastreio}
      </div>`;
    },

    // V40.11.3 — Card de CAC do mês — espelho do _revenueCard. Triangulação
    // Realizado · Projetado · Meta numa régua única. Substitui o card
    // "Meta de CAC" (que era 1 input + variância) e o card "CAC" da cascata
    // (que era modelo puro). Semântica de CAC é inversa (menor=melhor) mas
    // estrutura visual é idêntica à de Receita pra coerência cognitiva.
    _cacCard(productId, currentPeriodLabel) {
      const summary = RevopsFinanceEngine?.productCacSummary?.(productId) || {
        realCAC: 0, projectedCAC: 0, metaCAC: 0,
        mediaInvestment: 0, convertedCount: 0, ctcModel: 0, projectedSales: 0, sourceLabel: ''
      };
      const { realCAC, projectedCAC, metaCAC, mediaInvestment, convertedCount, ctcModel, projectedSales } = summary;

      // Escala da régua: usa o MAIOR valor como teto (CAC é menor=melhor, mas
      // visualmente a régua segue a mesma escala pra coerência com Receita).
      const maxValue = Math.max(realCAC, projectedCAC, metaCAC, 1) * 1.05;
      const realPos = Math.min(100, (realCAC / maxValue) * 100);
      const projPos = Math.min(100, (projectedCAC / maxValue) * 100);
      const metaPos = Math.min(100, (metaCAC / maxValue) * 100);

      // % relativo à Meta (não à escala visual)
      const realPctMeta = metaCAC > 0 ? (realCAC / metaCAC) * 100 : 0;
      const projPctMeta = metaCAC > 0 ? (projectedCAC / metaCAC) * 100 : 0;

      // V40.11.20 — Fmt do CAC mostra 2 casas decimais quando valor < R$ 10.
      // CAC pode ser muito pequeno (ex: R$ 0,19 = composição R$ 22k ÷ 117k vendas)
      // — arredondar pra 0 mata leitura. Acima de R$ 10, mantém arredondamento.
      const moneyDigits0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
      const moneyDigits2 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2, minimumFractionDigits: 2 });
      const fmt = (v) => {
        const n = Number(v) || 0;
        if (n > 0 && n < 10) return moneyDigits2.format(n);
        return moneyDigits0.format(n);
      };

      // Rastreio cinza — selo de procedência (V40.11.10: colapsa via details)
      const rastreio = `
        <details class="pt-3 border-t border-stone-200 group">
          <summary class="text-[10px] font-black text-slate-500 hover:text-slate-700 cursor-pointer uppercase tracking-widest inline-flex items-center gap-1 select-none">
            <i data-lucide="chevron-right" class="w-3 h-3 transition-transform group-open:rotate-90"></i>
            Como esse número foi calculado?
          </summary>
          <div class="space-y-1 text-[11px] text-slate-500 mt-2 pl-4">
            <p><span class="font-bold text-slate-600">Realizado:</span> ${this._money(mediaInvestment)} de mídia ÷ ${convertedCount.toLocaleString('pt-BR')} vendas Checkout</p>
            <p><span class="font-bold text-slate-600">Projetado:</span> ${this._money(ctcModel)} CTC da composição ÷ ${Math.round(projectedSales).toLocaleString('pt-BR')} vendas projetadas</p>
            <p><span class="font-bold text-slate-600">Meta:</span> ${metaCAC > 0 ? `${this._money(metaCAC)} cravado para o período` : 'sem meta configurada · ajuste abaixo'}</p>
            ${summary.sourceLabel ? `<p class="italic pt-1">Fonte atual: ${summary.sourceLabel}</p>` : ''}
          </div>
        </details>`;

      // V40.11.17 — Régua sem labels posicionais. Marcadores + legenda em row.
      const regua = `
        <div class="relative h-1.5 bg-stone-200 rounded-full mt-7 mb-3">
          ${metaCAC > 0 ? `
            <div class="absolute -top-1 w-0.5 h-3.5 bg-emerald-600" style="left: ${metaPos.toFixed(1)}%;"></div>
          ` : ''}
          ${projectedCAC > 0 ? `
            <div class="absolute -top-1 w-3 h-3 rounded-full bg-violet-600 ring-2 ring-white" style="left: ${projPos.toFixed(1)}%; transform: translateX(-50%);"></div>
          ` : ''}
          ${realCAC > 0 ? `
            <div class="absolute -top-1 w-3 h-3 rounded-full bg-sky-600 ring-2 ring-white shadow" style="left: ${realPos.toFixed(1)}%; transform: translateX(-50%);"></div>
          ` : ''}
        </div>
        <div class="flex items-center gap-x-5 gap-y-1 flex-wrap text-[11px] mb-4">
          ${realCAC > 0 ? `
            <span class="inline-flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
              <span class="font-black text-sky-700 uppercase tracking-wider">Realizado</span>
              ${metaCAC > 0 ? `<span class="text-slate-500">${realPctMeta.toFixed(0)}%</span>` : ''}
            </span>
          ` : ''}
          ${projectedCAC > 0 ? `
            <span class="inline-flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-violet-600"></span>
              <span class="font-black text-violet-700 uppercase tracking-wider">Projetado</span>
              ${metaCAC > 0 ? `<span class="text-slate-500">${projPctMeta.toFixed(0)}%</span>` : ''}
            </span>
          ` : ''}
          ${metaCAC > 0 ? `
            <span class="inline-flex items-center gap-1.5">
              <span class="w-0.5 h-2.5 bg-emerald-600"></span>
              <span class="font-black text-emerald-700 uppercase tracking-wider">Meta</span>
              <span class="text-slate-500">100%</span>
            </span>
          ` : ''}
        </div>`;

      const projectedExceedsMeta = metaCAC > 0 && projectedCAC > metaCAC;
      const realExceedsMeta = metaCAC > 0 && realCAC > metaCAC;
      const realCacClass = realExceedsMeta ? 'text-rose-700' : 'text-slate-900';
      const projCacClass = projectedExceedsMeta ? 'text-rose-700' : 'text-slate-700';

      // V40.11.13 — Banner amber compactado: uma linha curta, inline-flex, padding mínimo.
      const metaAbsurd = metaCAC > 0 && projectedCAC > 0 && (projectedCAC / metaCAC) > 2;
      const absurdAlert = metaAbsurd ? `
        <div class="rounded-md bg-amber-50 border border-amber-200 px-2 py-1 mb-2 inline-flex items-center gap-1.5 text-[10px] text-amber-800">
          <i data-lucide="alert-triangle" class="w-3 h-3 shrink-0"></i>
          <span><b>Meta ${(projectedCAC / metaCAC).toFixed(1)}× pequena</b> · revise em Modelagem</span>
        </div>
      ` : '';

      return `<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" style="border-left: 4px solid #AB3ED8;">
        <div class="flex items-center justify-between gap-2 mb-4">
          <p class="text-xs font-black uppercase tracking-widest inline-flex items-center gap-1.5" style="color: #6D28D9;">
            <span class="w-2 h-2 rounded-full" style="background: #AB3ED8;"></span>
            CAC · ${Utils.escape(currentPeriodLabel)}
            <i data-lucide="info" class="w-3 h-3 text-slate-400 hover:text-slate-600 cursor-help ml-1" title="O preço de cada cliente novo. Menor é melhor — meta é o teto que a operação não quer cruzar."></i>
          </p>
          <div class="flex items-center gap-2">
            <button onclick="Actions.openCacMetaEdit('${productId}')" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest text-violet-700 hover:bg-violet-50 transition-colors" title="Editar Meta de CAC">
              <i data-lucide="edit-3" class="w-3 h-3"></i> Meta
            </button>
            ${this._healthBadge(realCAC, metaCAC, 'lower')}
          </div>
        </div>

        ${absurdAlert}

        <div class="grid grid-cols-3 gap-3 mb-2 items-end">
          <div class="min-w-0">
            <p class="text-[10px] font-black text-sky-700 uppercase tracking-wider">Realizado</p>
            ${realCAC > 0
              ? `<p class="text-3xl font-black ${realCacClass} mt-0.5 truncate leading-tight">${fmt(realCAC)}</p>`
              : `<p class="text-3xl font-black text-stone-300 mt-0.5 truncate leading-tight" title="Aguardando pull de gasto Ads">—</p>`
            }
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-black text-violet-700 uppercase tracking-wider">Projetado</p>
            <p class="text-2xl font-black ${projCacClass} mt-0.5 truncate leading-tight">${projectedCAC > 0 ? fmt(projectedCAC) : '—'}</p>
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Meta</p>
            <p class="text-xl font-black text-slate-600 mt-0.5 truncate leading-tight">${metaCAC > 0 ? fmt(metaCAC) : '—'}</p>
          </div>
        </div>

        ${regua}

        ${rastreio}
      </div>`;
    },

    // V40.11.5 — Card de Vendas (quantidade) — Realizado · Projetado · Meta na
    // mesma triangulação dos cards de Receita e CAC. Substitui o antigo bloco
    // "Realizado (lido do funil)" que tinha 2 BigCells redundantes e confusos
    // (mostrava 9.600 vendas reais e R$ 46.080 faturamento real — duas fontes
    // de "real" contradizendo o Card Receita acima).
    _salesCard(productId, currentPeriodLabel) {
      const summary = RevopsFinanceEngine?.productSalesSummary?.(productId) || {
        realSales: 0, projectedSales: 0, metaSales: 0, sourceLabel: ''
      };
      const { realSales, projectedSales, metaSales } = summary;

      // Escala da régua: Meta = 100%. Se Projetado > Meta, respira 5% à direita.
      const maxValue = Math.max(realSales, projectedSales, metaSales, 1) * 1.05;
      const realPos = Math.min(100, (realSales / maxValue) * 100);
      const projPos = Math.min(100, (projectedSales / maxValue) * 100);
      const metaPos = Math.min(100, (metaSales / maxValue) * 100);

      const realPctMeta = metaSales > 0 ? (realSales / metaSales) * 100 : 0;
      const projPctMeta = metaSales > 0 ? (projectedSales / metaSales) * 100 : 0;

      const fmt = (v) => Math.round(Number(v) || 0).toLocaleString('pt-BR');

      const rastreio = `
        <details class="pt-3 border-t border-stone-200 group">
          <summary class="text-[10px] font-black text-slate-500 hover:text-slate-700 cursor-pointer uppercase tracking-widest inline-flex items-center gap-1 select-none">
            <i data-lucide="chevron-right" class="w-3 h-3 transition-transform group-open:rotate-90"></i>
            Como esse número foi calculado?
          </summary>
          <div class="space-y-1 text-[11px] text-slate-500 mt-2 pl-4">
            <p><span class="font-bold text-slate-600">Realizado:</span> ${fmt(realSales)} vendas aprovadas no Checkout (últimos 30d)</p>
            <p><span class="font-bold text-slate-600">Projetado:</span> ${fmt(projectedSales)} vendas cadenciadas no funil do CRM</p>
            <p><span class="font-bold text-slate-600">Meta:</span> ${metaSales > 0 ? `soma de ${fmt(metaSales)} vendas configuradas em Ofertas` : 'sem meta configurada · ajuste em Ofertas'}</p>
            ${summary.sourceLabel ? `<p class="italic pt-1">Fonte atual: ${summary.sourceLabel}</p>` : ''}
          </div>
        </details>`;

      // V40.11.17 — Régua sem labels posicionais. Marcadores + legenda em row.
      const _now = new Date();
      const _day = _now.getDate();
      const _totalDays = new Date(_now.getFullYear(), _now.getMonth() + 1, 0).getDate();
      const _monthRatio = _day / _totalDays;
      const _ghostPos = metaSales > 0 ? _monthRatio * metaPos : 0;

      const regua = `
        <div class="relative h-1.5 bg-stone-200 rounded-full mt-7 mb-3">
          ${metaSales > 0 ? `
            <span class="absolute -top-4 text-[9px] font-black uppercase tracking-wider text-slate-600 -translate-x-1/2 select-none pointer-events-none" style="left: ${_ghostPos.toFixed(1)}%;">hoje</span>
            <div class="absolute -top-1.5 w-0.5 h-4 bg-slate-600 opacity-90 hover:opacity-100 transition-opacity" style="left: ${_ghostPos.toFixed(1)}%;" title="Hoje: dia ${_day} de ${_totalDays} — Realizado deveria estar aqui se on-track."></div>
            <div class="absolute -top-1 w-0.5 h-3.5 bg-emerald-600" style="left: ${metaPos.toFixed(1)}%;"></div>
          ` : ''}
          ${projectedSales > 0 ? `
            <div class="absolute -top-1 w-3 h-3 rounded-full bg-violet-600 ring-2 ring-white" style="left: ${projPos.toFixed(1)}%; transform: translateX(-50%);"></div>
          ` : ''}
          ${realSales > 0 ? `
            <div class="absolute -top-1 w-3 h-3 rounded-full bg-sky-600 ring-2 ring-white shadow" style="left: ${realPos.toFixed(1)}%; transform: translateX(-50%);"></div>
          ` : ''}
        </div>
        <div class="flex items-center gap-x-5 gap-y-1 flex-wrap text-[11px] mb-4">
          ${realSales > 0 ? `
            <span class="inline-flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-sky-600"></span>
              <span class="font-black text-sky-700 uppercase tracking-wider">Realizado</span>
              ${metaSales > 0 ? `<span class="text-slate-500">${realPctMeta.toFixed(0)}%</span>` : ''}
            </span>
          ` : ''}
          ${projectedSales > 0 ? `
            <span class="inline-flex items-center gap-1.5">
              <span class="w-2.5 h-2.5 rounded-full bg-violet-600"></span>
              <span class="font-black text-violet-700 uppercase tracking-wider">Projetado</span>
              ${metaSales > 0 ? `<span class="text-slate-500">${projPctMeta.toFixed(0)}%</span>` : ''}
            </span>
          ` : ''}
          ${metaSales > 0 ? `
            <span class="inline-flex items-center gap-1.5">
              <span class="w-0.5 h-2.5 bg-emerald-600"></span>
              <span class="font-black text-emerald-700 uppercase tracking-wider">Meta</span>
              <span class="text-slate-500">100%</span>
            </span>
          ` : ''}
        </div>`;

      return `<div class="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" style="border-left: 4px solid #00CBCC;">
        <div class="flex items-center justify-between gap-2 mb-4">
          <p class="text-xs font-black uppercase tracking-widest inline-flex items-center gap-1.5" style="color: #0E7490;">
            <span class="w-2 h-2 rounded-full" style="background: #00CBCC;"></span>
            Vendas · ${Utils.escape(currentPeriodLabel)}
            <i data-lucide="info" class="w-3 h-3 text-slate-400 hover:text-slate-600 cursor-help ml-1" title="Quantas vendas tivemos: o que entrou, o que está cadenciando, o que se prometeu."></i>
          </p>
          ${this._healthBadge(realSales, metaSales, 'higher')}
        </div>

        <div class="grid grid-cols-3 gap-3 mb-2 items-end">
          <div class="min-w-0">
            <p class="text-[10px] font-black text-sky-700 uppercase tracking-wider">Realizado</p>
            <p class="text-3xl font-black text-slate-900 mt-0.5 truncate leading-tight">${fmt(realSales)}</p>
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-black text-violet-700 uppercase tracking-wider">Projetado</p>
            <p class="text-2xl font-black text-slate-700 mt-0.5 truncate leading-tight">${fmt(projectedSales)}</p>
          </div>
          <div class="min-w-0">
            <p class="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Meta</p>
            <p class="text-xl font-black text-slate-600 mt-0.5 truncate leading-tight">${metaSales > 0 ? fmt(metaSales) : '—'}</p>
          </div>
        </div>

        ${regua}

        ${rastreio}
      </div>`;
    },

    // V32.8.4 → V32.8.5 — Painel do Simulator: overrides + Save + lista de
    // cenários salvos + comparação lado-a-lado.
    _simulatorPanel(cfg, ev, simEv) {
      const sim = App.state.revopsSimulator;
      const productId = cfg.productId;
      const scenarios = (App.state.revopsScenarios?.[productId] || []);
      const compareSel = App.state.revopsCompareSelection || {};

      // V32.11.4 — Leonardo: simulator com tom executivo. bg-white + left-border
      // amber (sinaliza modo simulação) + pill icon flask-conical + selo "MODO
      // SIMULAÇÃO". Botões com tracking-wider uppercase.
      return `<div class="rounded-2xl bg-white border border-slate-200 border-l-4 border-l-amber-500 p-4 space-y-3 shadow-sm">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-start gap-2.5 min-w-0">
            <span class="shrink-0 w-9 h-9 rounded-xl bg-amber-500/15 grid place-items-center text-amber-700">
              <i data-lucide="flask-conical" class="w-4 h-4"></i>
            </span>
            <div class="min-w-0">
              <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest">Modo Simulação · ON</p>
              <p class="text-sm font-black text-slate-900 leading-tight">Valores reais não foram alterados</p>
              <p class="text-[11px] text-slate-500 mt-0.5">Edite as overrides abaixo. Salve cenários pra comparar depois.</p>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <button onclick="(function(){const n=prompt('Nome do cenário:', 'Cenário ${scenarios.length + 1}'); if(n) Actions.saveRevopsScenario('${productId}', n);})()" class="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black flex items-center gap-1 uppercase tracking-wider" style="color:#fff!important;"><i data-lucide="save" class="w-3 h-3"></i> Salvar</button>
            <button onclick="Actions.resetRevopsSimulator()" class="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-slate-700 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1"><i data-lucide="rotate-ccw" class="w-3 h-3"></i> Reset</button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-[10px] font-black text-slate-500 uppercase tracking-wider">Vendas previstas</span>
            <div class="flex items-center gap-2">
              <input type="number" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" min="0" value="${sim.salesOverride ?? ev.sales}" onchange="Actions.setRevopsSimulatorOverride('salesOverride', this.value)" placeholder="${ev.sales}" class="mt-0.5 flex-1 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 focus:border-violet-400 focus:bg-white" />
              <span class="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap">baseline: <b>${ev.sales}</b></span>
            </div>
          </label>
          <label class="block">
            <span class="text-[10px] font-black text-slate-500 uppercase tracking-wider">Ticket Médio (R$)</span>
            <div class="flex items-center gap-2">
              <input type="text" inputmode="decimal" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" value="${Utils.formatCents(sim.ticketOverride ?? ev.ticket)}" oninput="Utils.applyMoneyMask(this)" onchange="Actions.setRevopsSimulatorOverride('ticketOverride', Utils.parseBRL(this.value))" placeholder="${Utils.formatCents(ev.ticket)}" class="mt-0.5 flex-1 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm font-bold text-slate-800 focus:border-violet-400 focus:bg-white" />
              <span class="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap">baseline: <b>${this._moneyPrecise(ev.ticket)}</b></span>
            </div>
          </label>
        </div>

        ${scenarios.length > 0 ? `<div class="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest inline-flex items-center gap-1.5"><i data-lucide="bookmark" class="w-3 h-3"></i> Cenários salvos · ${scenarios.length}</p>
          <div class="space-y-1">
            ${scenarios.map(sc => `<div class="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-amber-300 transition">
              <div class="min-w-0 flex-1">
                <p class="text-[12px] font-black text-slate-900 truncate">${Utils.escape(sc.name)}</p>
                <p class="text-[10px] text-slate-500">Vendas: <b>${sc.salesOverride ?? '—'}</b> · TM: <b>${sc.ticketOverride != null ? this._money(sc.ticketOverride) : '—'}</b></p>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                <button onclick="Actions.loadRevopsScenario('${productId}', '${sc.id}')" title="Carregar no Simulador" class="px-1.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-amber-700"><i data-lucide="play" class="w-3.5 h-3.5"></i></button>
                <button onclick="if(confirm('Apagar cenário \\'${Utils.escape(sc.name)}\\'?')) Actions.deleteRevopsScenario('${productId}', '${sc.id}')" title="Apagar" class="px-1.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-300 text-slate-600 hover:text-rose-700"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
              </div>
            </div>`).join('')}
          </div>

          ${scenarios.length >= 2 ? `<div class="pt-2 border-t border-slate-200">
            <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5 inline-flex items-center gap-1.5"><i data-lucide="git-compare" class="w-3 h-3"></i> Comparar 2 cenários lado-a-lado</p>
            <div class="grid grid-cols-2 gap-2">
              <select onchange="Actions.setRevopsCompareSlot('left', this.value)" class="px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:border-violet-400">
                <option value="">— Esquerda —</option>
                ${scenarios.map(sc => `<option value="${sc.id}" ${compareSel.left === sc.id ? 'selected' : ''}>${Utils.escape(sc.name)}</option>`).join('')}
              </select>
              <select onchange="Actions.setRevopsCompareSlot('right', this.value)" class="px-2 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:border-violet-400">
                <option value="">— Direita —</option>
                ${scenarios.map(sc => `<option value="${sc.id}" ${compareSel.right === sc.id ? 'selected' : ''}>${Utils.escape(sc.name)}</option>`).join('')}
              </select>
            </div>
            ${(compareSel.left || compareSel.right) ? `<button onclick="Actions.clearRevopsCompare()" class="mt-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"><i data-lucide="x" class="w-3 h-3"></i> Limpar seleção</button>` : ''}
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
      return `<div class="rounded-2xl bg-white border border-slate-200 border-l-4 border-l-violet-500 p-4 shadow-sm">
        <div class="flex items-center gap-2.5 mb-3">
          <span class="shrink-0 w-8 h-8 rounded-lg bg-violet-500/15 grid place-items-center text-violet-700">
            <i data-lucide="git-compare" class="w-4 h-4"></i>
          </span>
          <div>
            <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest">Comparativo</p>
            <p class="text-sm font-black text-slate-900 leading-tight">Cenários lado-a-lado</p>
          </div>
        </div>
        <table class="w-full">
          <thead>
            <tr class="border-b-2 border-slate-200">
              <th class="text-left py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">Métrica</th>
              <th class="text-right py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">${Utils.escape(labelL)}</th>
              <th class="text-right py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">${Utils.escape(labelR)}</th>
              <th class="text-right py-2 text-[10px] font-black text-violet-700 uppercase tracking-widest">Δ (R→L)</th>
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

    // V32.11.4 — Leonardo: bigCell delta executivo. bg-white + left-border tone
    // + delta pill com ícone Lucide trending-up/down/minus.
    _bigCellWithDelta(label, simValue, baseValue, simNumeric, baseNumeric, tone, simActive, inverse = false) {
      if (!simActive) return this._bigCell(label, baseValue, tone);
      const t = this._cascadeTone(tone);
      const delta = simNumeric - baseNumeric;
      const deltaPct = baseNumeric !== 0 ? (delta / baseNumeric) * 100 : 0;
      const isPositive = inverse ? delta < 0 : delta > 0;
      const isNegative = inverse ? delta > 0 : delta < 0;
      const deltaCls = isPositive ? 'bg-emerald-500/10 border-emerald-400/30 text-emerald-700' : isNegative ? 'bg-rose-500/10 border-rose-400/30 text-rose-700' : 'bg-slate-500/10 border-slate-400/30 text-slate-600';
      const deltaIcon = delta > 0 ? 'trending-up' : delta < 0 ? 'trending-down' : 'minus';
      return `<div class="rounded-2xl bg-white border border-slate-200 ${t.borderL} p-4 hover:border-slate-300 transition">
        <p class="text-[10px] font-black ${t.pill} uppercase tracking-widest">${label}</p>
        <p class="text-2xl font-black ${t.text} mt-1">${simValue}</p>
        <span class="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-wider ${deltaCls}">
          <i data-lucide="${deltaIcon}" class="w-3 h-3"></i>
          ${Math.abs(deltaPct).toFixed(1)}% vs baseline
        </span>
      </div>`;
    },

    // V32.11.4 — Leonardo: bloco comparação EBITDA. Mantém slate-900 (executivo
    // pesado) mas com Lucide icons por coluna e tracking-widest consistente.
    _simulatorEbitdaCompare(ev, simEv) {
      const delta = simEv.ebitda - ev.ebitda;
      const deltaPct = ev.ebitda !== 0 ? (delta / Math.abs(ev.ebitda)) * 100 : 0;
      const cls = delta > 0 ? 'emerald' : delta < 0 ? 'rose' : 'slate';
      const deltaIcon = delta > 0 ? 'trending-up' : delta < 0 ? 'trending-down' : 'minus';
      return `<div class="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white p-4 grid md:grid-cols-3 gap-4 shadow-lg">
        <div class="flex items-start gap-2.5">
          <span class="shrink-0 w-7 h-7 rounded-lg bg-slate-700/60 grid place-items-center text-slate-300">
            <i data-lucide="bar-chart-3" class="w-3.5 h-3.5"></i>
          </span>
          <div>
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">EBITDA Baseline</p>
            <p class="text-xl font-black mt-1">${this._money(ev.ebitda)}</p>
            <p class="text-[10px] text-slate-400 mt-0.5">Margem ${ev.ebitdaMargin.toFixed(1)}%</p>
          </div>
        </div>
        <div class="flex items-start gap-2.5">
          <span class="shrink-0 w-7 h-7 rounded-lg bg-amber-500/20 grid place-items-center text-amber-300">
            <i data-lucide="flask-conical" class="w-3.5 h-3.5"></i>
          </span>
          <div>
            <p class="text-[10px] font-black text-amber-300 uppercase tracking-widest">EBITDA Simulado</p>
            <p class="text-xl font-black mt-1">${this._money(simEv.ebitda)}</p>
            <p class="text-[10px] text-amber-300/70 mt-0.5">Margem ${simEv.ebitdaMargin.toFixed(1)}%</p>
          </div>
        </div>
        <div class="flex items-start gap-2.5">
          <span class="shrink-0 w-7 h-7 rounded-lg bg-${cls}-500/20 grid place-items-center text-${cls}-300">
            <i data-lucide="${deltaIcon}" class="w-3.5 h-3.5"></i>
          </span>
          <div>
            <p class="text-[10px] font-black text-${cls}-300 uppercase tracking-widest">Δ Impacto</p>
            <p class="text-xl font-black mt-1 text-${cls}-300">${delta >= 0 ? '+' : ''}${this._money(delta)}</p>
            <p class="text-[10px] text-${cls}-300/70 mt-0.5">${delta >= 0 ? '+' : ''}${deltaPct.toFixed(1)}% vs baseline</p>
          </div>
        </div>
      </div>`;
    },

    // V32.11.4 — Leonardo: bigCell base executivo. bg-white + left-border tone.
    _bigCell(label, value, tone) {
      const t = this._cascadeTone(tone);
      return `<div class="rounded-2xl bg-white border border-slate-200 ${t.borderL} p-4 hover:border-slate-300 transition">
        <p class="text-[10px] font-black ${t.pill} uppercase tracking-widest">${label}</p>
        <p class="text-2xl font-black ${t.text} mt-1">${value}</p>
      </div>`;
    },

    // ────────────────────────────────────────────────────────────
    // TAB 4: REVOPS KPIs
    // ────────────────────────────────────────────────────────────

    // V32.10.0 — Cascata RevOps vertical: TM → MCU → CAC → MSU → Custo Fixo → Breakeven.
    // MCU e MSU editáveis (modo single ou composto). Cada linha educa o cliente
    // sobre o que aquela métrica representa.
    _revopsTab(cfg, ev) {
      const productId = cfg.productId;

      // 1. TM (auto, vem das Ofertas) + Realizado (Checkout Hotmart approved 30d)
      // V40.11.26 — Cascata abaixo ainda usa Projetado (`tm`). Linha do TM mostra
      // ambos lado a lado. Quando Felipe topar, posso plugar Realizado na cascata
      // inteira (MCU/MSU/Breakeven seguir realidade do Checkout).
      const tm = ev.ticket;
      const tmReal = window.RevopsFinanceEngine
        ? RevopsFinanceEngine.productRealTicket(productId)
        : 0;

      // 2. MCU auto (TM − Σ custos variáveis unitários inferidos)
      const mcuAuto = RevopsWhitelabelEngine.computeAutoMCU(cfg, ev);
      const mcuOverride = App.state.revopsKpiOverrides?.[productId]?.mcu || { mode: 'auto' };
      mcuOverride.baseValue = tm; // base pra modo composed
      // V36.8.4 — unitContext:true → fórmulas com fat_bruto/fat_liquido viram unit cost
      const mcuResolved = RevopsWhitelabelEngine.resolveOverride(mcuOverride, mcuAuto.value, ev.symbols, { unitContext: true });
      const mcu = mcuResolved.value;

      // 3. CAC (auto: CTC / Total de Vendas)
      const totalSales = ev.sales || 0;
      const ctc = ev.acquisitionTotal;
      const cac = totalSales > 0 ? ctc / totalSales : 0;

      // 4. MSU auto (MCU − CAC)
      const msuAuto = RevopsWhitelabelEngine.computeAutoMSU(mcu, cac);
      const msuOverride = App.state.revopsKpiOverrides?.[productId]?.msu || { mode: 'auto' };
      msuOverride.baseValue = mcu;
      // V36.8.4 — unitContext:true (MSU é métrica POR VENDA igual MCU)
      const msuResolved = RevopsWhitelabelEngine.resolveOverride(msuOverride, msuAuto.value, ev.symbols, { unitContext: true });
      const msu = msuResolved.value;

      // 5. Custo Fixo (auto: soma bucket=fixed)
      const fixedTotal = ev.fixedTotal;

      // 6. Breakeven (auto: Custo Fixo ÷ MSU)
      const breakeven = msu > 0 ? Math.ceil(fixedTotal / msu) : 0;

      // V32.10.7 — Injeta KPIs cascata em ev.symbols pra que validateFormula
      // (chamada por _composedDeductionRow etc) reconheça mcu/msu/cac/breakeven.
      // Já estão listados em availableHandles() do engine, faltava só popular.
      ev.symbols.mcu = mcu;
      ev.symbols.msu = msu;
      ev.symbols.cac = cac;
      ev.symbols.breakeven = breakeven;

      // Microcopy operacional
      // V40.11.31 — Formatação BR nos números soltos + threshold pra folga
      // gigante (≥200% vira "N× o Breakeven" em vez de "8310%" ilegível).
      const previstas = Math.round(totalSales);
      const folgaPct = breakeven > 0 ? (previstas / breakeven) * 100 : 0;
      const previstasFmt = previstas.toLocaleString('pt-BR');
      const bkRatio = folgaPct >= 200
        ? `${(folgaPct / 100).toFixed(1).replace('.', ',')}× o Breakeven`
        : `${folgaPct.toFixed(0)}% do Breakeven`;
      let bkHealth;
      if (folgaPct >= 200)       bkHealth = { cls: 'emerald', msg: `previstas ${previstasFmt} = ${bkRatio} · Breakeven dissolvido · operação em zona confortável` };
      else if (folgaPct >= 130)  bkHealth = { cls: 'emerald', msg: `previstas ${previstasFmt} = ${bkRatio} · folga sólida` };
      else if (folgaPct >= 100)  bkHealth = { cls: 'amber',   msg: `previstas ${previstasFmt} = ${bkRatio} · operação respira justo` };
      else                       bkHealth = { cls: 'rose',    msg: `previstas ${previstasFmt} = ${bkRatio} · operação queima caixa` };
      const folgaVendas = previstas - breakeven;
      const ebitdaMarginal = folgaVendas * msu;  // contribuição das vendas acima do breakeven
      // V40.11.35 — EBITDA projetado da cascata Equilíbrio passa a usar o
      // mesmo número que a DRE entrega no `lucroLiquido`. Antes era só
      // `folgaVendas × msu` — uma APROXIMAÇÃO que ignorava extras DRE
      // (Inadimplência, Frete sobre venda, descontos, etc). Divergência
      // chegou a R$ 10.560 no Pilsen quando Felipe comparou os 2 lugares.
      // Agora cascata Equilíbrio e DRE conversam — mesmo número final.
      const dreSnapshot = window.RevopsWhitelabelEngine?.evaluateDRE
        ? RevopsWhitelabelEngine.evaluateDRE(cfg, ev)
        : null;
      const ebitdaProjetado = dreSnapshot?.totals?.lucroLiquido ?? ebitdaMarginal;
      const extrasDreAjuste = ebitdaMarginal - ebitdaProjetado;  // > 0 quando extras descontam

      // V40.11.33 — Seção "KPIs Personalizados" removida da UI. Felipe confirmou
      // que ninguém usa (feature de fórmula livre era poder demais pra pouco uso).
      // Substituída pela seção "KPIs Avançados" (V40.11.32) — 4 cards auto-
      // calculados que cobrem os casos universais sem pedir cadastro.
      // Dados em cfg.customKpis ficam vivos em journey_state (sem perda).
      // Engine, actions e helper _customKpiRow ficam dormentes — descomentar
      // o trecho abaixo restaura a UI se necessário.
      const djowPanel = window.DjowRevOpsPanel ? DjowRevOpsPanel.render(productId, 'revops') : '';

      // V36.14.0 — Tema light igual DRE + grid 2-col com Djow lateral sticky.
      return `<div class="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        <div class="space-y-3 min-w-0">
          ${this._tabHeader('RevOps · Cascata', 'Equilíbrio da Operação', 'Lê de cima pra baixo. Cada linha mostra o que sai a cada etapa até o Breakeven — quantas vendas pra empatar o mês. Clique numa linha de fórmula pra pedir ajuda ao Djow na lateral.')}
          <section class="rounded-3xl border p-5 shadow-md space-y-2" style="background:#f5f3f0;border-color:#e7e5e0;color-scheme:light;">
            ${this._cascadeLineDual('coins', 'PONTO DE PARTIDA', 'TM · Ticket Médio', tm, tmReal, 'emerald',
              'Projetado vem das Ofertas (média ponderada). Realizado é o ticket médio do Checkout (Hotmart approved últimos 30d).')}
            ${this._cascadeArrow('↓')}

            ${this._cascadeMcu(productId, mcuAuto, mcuOverride, mcuResolved, ev)}
            ${this._cascadeArrow('↓')}

            ${this._cascadeLine('minus-circle', 'SUBTRAÇÃO', 'CAC · Custo de Aquisição', this._moneySmart(cac), 'rose',
              `Fórmula: CTC ÷ Total de Vendas = ${this._money(ctc)} ÷ ${Math.round(totalSales).toLocaleString('pt-BR')} = ${this._moneySmart(cac)}. O preço de cada cliente novo.`)}
            ${this._cascadeArrow('↓')}

            ${this._cascadeMsu(productId, msuAuto, msuOverride, msuResolved, mcu, cac, ev)}
            ${this._cascadeArrow('÷')}

            ${this._cascadeLine('shield', 'BARREIRA FIXA', 'Custo Fixo de Operação', this._money(fixedTotal), 'rose',
              'Soma do bucket Fixos (G&A). Mensalidade pra existir — vendas em qualquer volume não mudam esse número.')}
            ${this._cascadeArrow('↓')}

            ${this._cascadeBreakeven(breakeven, msu, fixedTotal, bkHealth, folgaVendas, ebitdaProjetado, ebitdaMarginal, extrasDreAjuste)}

            ${this._kpisAvancadosSection(productId, ev)}
          </section>

        </div>
        <aside class="xl:sticky xl:top-4 xl:self-start">${djowPanel}</aside>
      </div>`;
    },

    // V32.10.0 — Linha derivada (não-editável) da cascata. icon · badge · nome · valor · hint.
    // V32.11.1 — Leonardo: cards da cascata RevOps com padrão executivo.
    // Estrutura: bg-white + left-border 4px tone + pill com Lucide icon +
    // selo uppercase tracking-widest + título font-black + hint com info-icon.
    // Argumento `icon` agora é nome do Lucide (não emoji).
    _cascadeLine(iconLucide, badge, name, value, color, hint) {
      const tone = this._cascadeTone(color);
      // V36.14.0 — Tema light: bg-white/70 stone-200 ao invés de bg-white slate-200
      return `<div class="rounded-2xl bg-white/70 border border-stone-200 ${tone.borderL} overflow-hidden shadow-sm">
        <div class="p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="shrink-0 w-9 h-9 rounded-xl ${tone.iconBg} grid place-items-center ${tone.iconText}">
                <i data-lucide="${iconLucide}" class="w-4 h-4"></i>
              </span>
              <div class="min-w-0">
                <p class="text-[10px] font-black ${tone.pill} uppercase tracking-widest">${badge}</p>
                <p class="text-sm font-black text-slate-900 leading-tight">${Utils.escape(name)}</p>
              </div>
            </div>
            <p class="text-2xl font-black ${tone.text} whitespace-nowrap shrink-0">${value}</p>
          </div>
          ${hint ? `<div class="mt-2 flex items-start gap-1.5 text-[11px] text-stone-600">
            <i data-lucide="info" class="w-3 h-3 mt-0.5 shrink-0"></i>
            <span>${hint}</span>
          </div>` : ''}
        </div>
      </div>`;
    },

    // V40.11.26 — Variante da linha cascata com Projetado · Realizado lado a
    // lado. Espelha o padrão dos cards triangulares do Resultado Consolidado
    // (Receita/CAC/Vendas). Quando `realValue` é null/0 → mostra placeholder
    // honesto no Realizado (lei [[feedback_no_source_no_dash]]).
    _cascadeLineDual(iconLucide, badge, name, projValue, realValue, color, hint) {
      const tone = this._cascadeTone(color);
      const hasReal = realValue != null && Number.isFinite(realValue) && realValue !== 0;
      return `<div class="rounded-2xl bg-white/70 border border-stone-200 ${tone.borderL} overflow-hidden shadow-sm">
        <div class="p-4">
          <div class="flex items-start justify-between gap-3 mb-1">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="shrink-0 w-9 h-9 rounded-xl ${tone.iconBg} grid place-items-center ${tone.iconText}">
                <i data-lucide="${iconLucide}" class="w-4 h-4"></i>
              </span>
              <div class="min-w-0">
                <p class="text-[10px] font-black ${tone.pill} uppercase tracking-widest">${badge}</p>
                <p class="text-sm font-black text-slate-900 leading-tight">${Utils.escape(name)}</p>
              </div>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3 mt-2">
            <div>
              <p class="text-[9px] font-black text-stone-500 uppercase tracking-wider">Projetado</p>
              <p class="text-xl font-black text-stone-700 whitespace-nowrap">${this._moneyPrecise(projValue)}</p>
            </div>
            <div>
              <p class="text-[9px] font-black ${tone.pill} uppercase tracking-wider">Realizado</p>
              ${hasReal
                ? `<p class="text-2xl font-black ${tone.text} whitespace-nowrap">${this._moneyPrecise(realValue)}</p>`
                : `<p class="text-xl font-black text-stone-400 whitespace-nowrap">—</p>`}
            </div>
          </div>
          ${hint ? `<div class="mt-2 flex items-start gap-1.5 text-[11px] text-stone-600">
            <i data-lucide="info" class="w-3 h-3 mt-0.5 shrink-0"></i>
            <span>${hint}</span>
          </div>` : ''}
        </div>
      </div>`;
    },

    // V32.11.1 — Paleta executiva por tom da cascata. Centraliza pra cards
    // (MCU/MSU/Breakeven) usarem mesma referência sem duplicação.
    _cascadeTone(color) {
      return {
        sky:     { borderL: 'border-l-4 border-l-sky-500',     iconBg: 'bg-sky-500/15',     iconText: 'text-sky-700',     pill: 'text-sky-700',     text: 'text-sky-900',     softBg: 'bg-sky-50/40' },
        amber:   { borderL: 'border-l-4 border-l-amber-500',   iconBg: 'bg-amber-500/15',   iconText: 'text-amber-700',   pill: 'text-amber-700',   text: 'text-amber-900',   softBg: 'bg-amber-50/40' },
        emerald: { borderL: 'border-l-4 border-l-emerald-500', iconBg: 'bg-emerald-500/15', iconText: 'text-emerald-700', pill: 'text-emerald-700', text: 'text-emerald-900', softBg: 'bg-emerald-50/40' },
        rose:    { borderL: 'border-l-4 border-l-rose-500',    iconBg: 'bg-rose-500/15',    iconText: 'text-rose-700',    pill: 'text-rose-700',    text: 'text-rose-900',    softBg: 'bg-rose-50/40' },
        violet:  { borderL: 'border-l-4 border-l-violet-600',  iconBg: 'bg-violet-500/15',  iconText: 'text-violet-700',  pill: 'text-violet-700',  text: 'text-violet-900',  softBg: 'bg-violet-50/40' }
      }[color] || { borderL: 'border-l-4 border-l-slate-500', iconBg: 'bg-slate-500/15', iconText: 'text-slate-700', pill: 'text-slate-700', text: 'text-slate-900', softBg: 'bg-slate-50' };
    },

    // V32.11.1 — Conector vertical entre cards. Linha sutil + chevron Lucide
    // em vez de seta unicode. Tom executivo.
    _cascadeArrow(symbol) {
      const isDivide = symbol === '÷';
      return `<div class="flex flex-col items-center py-1.5">
        ${isDivide
          ? `<span class="text-[10px] font-black text-slate-400 tracking-widest">÷</span>`
          : `<span class="w-px h-3 bg-slate-300"></span><i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400 -my-0.5"></i><span class="w-px h-3 bg-slate-300"></span>`}
      </div>`;
    },

    // V32.11.1 — Pill executiva pra status do override (Auto/Manual/Composto).
    _cascadeOverrideBadge(mode) {
      if (mode === 'auto' || !mode) return '<span class="inline-flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest"><i data-lucide="zap" class="w-3 h-3"></i> Auto</span>';
      if (mode === 'manual') return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-violet-500/15 border border-violet-400/30 text-violet-700 uppercase tracking-widest"><i data-lucide="edit-3" class="w-3 h-3"></i> Manual</span>';
      return '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-sky-500/15 border border-sky-400/30 text-sky-700 uppercase tracking-widest"><i data-lucide="layers" class="w-3 h-3"></i> Composto</span>';
    },

    // V32.11.1 — Leonardo: MCU executivo. bg-white + left-border emerald +
    // ícone Lucide em pill + override badge sóbrio + edit panel.
    _cascadeMcu(productId, mcuAuto, override, resolved, ev) {
      const value = resolved.value;
      const tone = this._cascadeTone('emerald');
      const isOverride = override.mode === 'manual' || override.mode === 'composed';
      const diff = isOverride ? (value - mcuAuto.value) : 0;
      const diffHint = isOverride && Math.abs(diff) > 0.5
        ? `<p class="text-[10px] text-violet-700 mt-1 font-bold">Auto seria ${this._moneySmart(mcuAuto.value)} · diferença ${diff > 0 ? '+' : ''}${this._moneySmart(diff)}</p>`
        : '';
      // V37.0.10 — Chevron de collapse do painel de edição.
      const collapseKey = 'revops:mcu';
      const isCollapsed = this._isCollapsed(productId, collapseKey);
      const chevron = this._chevronToggle(productId, collapseKey, { tone: 'emerald', size: 'md' });
      return `<div class="rounded-2xl bg-white/70 border border-stone-200 ${tone.borderL} overflow-hidden shadow-sm">
        <div class="p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="shrink-0 w-9 h-9 rounded-xl ${tone.iconBg} grid place-items-center ${tone.iconText}">
                <i data-lucide="trending-up" class="w-4 h-4"></i>
              </span>
              <div class="min-w-0">
                <p class="text-[10px] font-black ${tone.pill} uppercase tracking-widest">= Margem por Venda</p>
                <p class="text-sm font-black text-slate-900 leading-tight">MCU · Margem de Contribuição Unitária</p>
                <p class="text-[10px] text-stone-500">após custos variáveis</p>
              </div>
            </div>
            <div class="flex items-start gap-2 shrink-0">
              <div class="text-right">
                <p class="text-2xl font-black ${tone.text} whitespace-nowrap">${this._moneySmart(value)}</p>
                <div class="mt-1">${this._cascadeOverrideBadge(override.mode)}</div>
                ${diffHint}
              </div>
              ${chevron}
            </div>
          </div>
          <div class="mt-2 flex items-start gap-1.5 text-[11px] text-stone-600">
            <i data-lucide="info" class="w-3 h-3 mt-0.5 shrink-0"></i>
            <span>Quanto sobra por venda depois de tirar custos que escalam com receita (impostos, comissões, taxa de plataforma).</span>
          </div>
        </div>
        ${isCollapsed ? '' : `<div class="border-t border-stone-200 bg-white/40">
          ${this._cascadeEditPanel(productId, 'mcu', override, mcuAuto)}
        </div>`}
      </div>`;
    },

    // V32.11.1 — Leonardo: MSU executivo. Mesmo padrão MCU, com pill de saúde
    // (% do TM) substituindo o ✓/⚠/✗ casual.
    _cascadeMsu(productId, msuAuto, override, resolved, mcu, cac, ev) {
      const value = resolved.value;
      const tone = this._cascadeTone('emerald');
      const isOverride = override.mode === 'manual' || override.mode === 'composed';
      const diff = isOverride ? (value - msuAuto.value) : 0;
      const diffHint = isOverride && Math.abs(diff) > 0.5
        ? `<p class="text-[10px] text-violet-700 mt-1 font-bold">Auto seria ${this._moneySmart(msuAuto.value)} · diferença ${diff > 0 ? '+' : ''}${this._moneySmart(diff)}</p>`
        : '';
      const tmPct = ev.ticket > 0 ? (value / ev.ticket) * 100 : 0;
      const healthPill = tmPct >= 40
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500/10 border border-emerald-400/30 text-emerald-700 uppercase tracking-wider"><i data-lucide="check-circle-2" class="w-3 h-3"></i> ${tmPct.toFixed(0)}% do TM · Saudável</span>`
        : tmPct >= 25
        ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/10 border border-amber-400/30 text-amber-700 uppercase tracking-wider"><i data-lucide="alert-triangle" class="w-3 h-3"></i> ${tmPct.toFixed(0)}% do TM · Apertada</span>`
        : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-500/10 border border-rose-400/30 text-rose-700 uppercase tracking-wider"><i data-lucide="x-circle" class="w-3 h-3"></i> ${tmPct.toFixed(0)}% do TM · Crítica</span>`;
      // V37.0.10 — Chevron de collapse do painel de edição.
      const collapseKey = 'revops:msu';
      const isCollapsed = this._isCollapsed(productId, collapseKey);
      const chevron = this._chevronToggle(productId, collapseKey, { tone: 'emerald', size: 'md' });
      return `<div class="rounded-2xl bg-white/70 border border-stone-200 ${tone.borderL} overflow-hidden shadow-sm">
        <div class="p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="shrink-0 w-9 h-9 rounded-xl ${tone.iconBg} grid place-items-center ${tone.iconText}">
                <i data-lucide="heart-pulse" class="w-4 h-4"></i>
              </span>
              <div class="min-w-0">
                <p class="text-[10px] font-black ${tone.pill} uppercase tracking-widest">= Margem Real</p>
                <p class="text-sm font-black text-slate-900 leading-tight">MSU · Margem de Segurança Unitária</p>
                <p class="text-[10px] text-stone-500">após CAC · Fórmula: MCU (${this._moneySmart(mcu)}) − CAC (${this._moneySmart(cac)})</p>
              </div>
            </div>
            <div class="flex items-start gap-2 shrink-0">
              <div class="text-right">
                <p class="text-2xl font-black ${tone.text} whitespace-nowrap">${this._moneySmart(value)}</p>
                <div class="mt-1">${this._cascadeOverrideBadge(override.mode)}</div>
                ${diffHint}
              </div>
              ${chevron}
            </div>
          </div>
          <div class="mt-2 flex items-start gap-1.5 text-[11px] text-stone-600">
            <i data-lucide="info" class="w-3 h-3 mt-0.5 shrink-0"></i>
            <span>Quanto cada venda contribui DE VERDADE pra pagar os custos fixos.</span>
          </div>
          <div class="mt-2">${healthPill}</div>
        </div>
        ${isCollapsed ? '' : `<div class="border-t border-stone-200 bg-white/40">
          ${this._cascadeEditPanel(productId, 'msu', override, msuAuto)}
        </div>`}
      </div>`;
    },

    // V36.14.0 — Painel de edição shared MCU/MSU: 3 modos (Auto / Valor único / Composição).
    // Botões revisados, IDs únicos nos inputs, composição em GRID de cards verticais
    // (mesmo padrão dos cards de dedução do DRE).
    _cascadeEditPanel(productId, kpi, override, autoData) {
      const mode = override.mode || 'auto';
      const tabBtn = (m, label) => {
        const active = mode === m;
        return `<button onclick="Actions.setRevopsKpiOverrideMode('${productId}', '${kpi}', '${m}')"
          class="px-3 py-1.5 rounded-lg text-[11px] font-black transition ${active
            ? 'bg-violet-600 text-white shadow-sm'
            : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-50'}" ${active ? 'style="color:#fff!important;"' : ''}>${label}</button>`;
      };
      let body = '';
      if (mode === 'manual') {
        const value = override.value != null ? String(override.value) : '';
        const cfgNow = this._currentConfig(productId);
        const pickerKey = `manual:${productId}:${kpi}`;
        body = `<div>
          <div class="flex items-center justify-between flex-wrap gap-2 mb-1">
            <label class="text-[10px] font-black text-stone-600 uppercase tracking-widest">Valor manual (número ou =fórmula)</label>
            ${this._handlePicker(pickerKey, cfgNow)}
          </div>
          <input id="lj-revops-${productId}-${kpi}-manual" type="text" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" value="${Utils.escape(value)}" list="lj-revops-handles" onchange="Actions.setRevopsKpiOverrideValue('${productId}', '${kpi}', this.value)" placeholder="220 ou =tm*0,55" class="w-full px-2 py-1.5 rounded-lg bg-white border border-stone-300 text-sm font-mono text-slate-800" />
          <p class="text-[10px] text-stone-500 mt-1">Use número direto (<code>220</code>) ou fórmula (<code>=tm*0,55</code>, <code>=tm-180</code>, <code>=fat_bruto/sales</code>).</p>
        </div>`;
      } else if (mode === 'composed') {
        // V32.10.3 (Felipe) — Refator UX: labels persistentes acima dos campos,
        // detecção de fórmula no nome (swap auto), validação verde/amarelo/
        // vermelho por dedução (igual fórmula avançada V32.9.8), mini-resultado
        // por linha. Resolve confusão "coloquei fórmula no campo errado".
        const components = Array.isArray(override.components) ? override.components : [];
        const cfgNow = this._currentConfig(productId);
        const evNow = this._evalWithCascade(cfgNow);
        const pickerKey = `composed:${productId}:${kpi}`;
        // V36.8.5 — Detecta quantas linhas têm escala mensal em métrica unitária
        // (MCU ou MSU). Banner com "Corrigir todas" aparece se ≥ 1.
        const isUnitKpi = kpi === 'mcu' || kpi === 'msu';
        const monthlyScaleCount = isUnitKpi ? components.filter(c => {
          const raw = String(c.value || '').trim();
          return raw.startsWith('=') && /\b(fat_bruto|fat_liquido)\b/i.test(raw);
        }).length : 0;
        const scaleBanner = monthlyScaleCount > 0 ? `<div class="rounded-xl bg-amber-50 border border-amber-300 p-3 flex items-start gap-2 mb-2">
          <i data-lucide="info" class="w-4 h-4 text-amber-700 shrink-0 mt-0.5"></i>
          <div class="flex-1 min-w-0">
            <p class="text-[11px] font-black text-amber-900">Métricas POR VENDA usam <code class="bg-white px-1 rounded font-mono text-[10px]">tm</code> (Ticket Médio).</p>
            <p class="text-[10px] text-amber-800 mt-0.5">${monthlyScaleCount} fórmula${monthlyScaleCount > 1 ? 's' : ''} com <code class="bg-white px-1 rounded font-mono text-[9px]">fat_bruto</code> ou <code class="bg-white px-1 rounded font-mono text-[9px]">fat_liquido</code> sendo corrigida${monthlyScaleCount > 1 ? 's' : ''} automaticamente. Aplique a correção pra eliminar essa mágica.</p>
          </div>
          <button onclick="Actions.applyAllRevopsScaleFixes('${productId}', '${kpi}')" class="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black inline-flex items-center gap-1 shrink-0" style="color:#fff!important;">
            <i data-lucide="wand-2" class="w-3 h-3"></i> Corrigir tod${monthlyScaleCount > 1 ? 'as' : 'a'}
          </button>
        </div>` : '';
        // V36.14.0 — Composição agora vira GRID 3-col de cards verticais
        // (mesmo padrão dos cards de dedução do DRE). Cada card: nome em cima,
        // fórmula no meio, valor calculado embaixo, engrenagem com menu.
        const componentCards = components.map((c, idx) => this._composedDeductionCard(productId, kpi, idx, c, evNow.symbols)).join('');
        const addCard = `<button onclick="Actions.addRevopsKpiComponent('${productId}', '${kpi}')" type="button" class="rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50/40 hover:bg-violet-50/80 hover:border-violet-400 p-3 min-h-[110px] flex flex-col items-center justify-center gap-1 text-violet-700 transition">
          <span class="text-2xl font-black leading-none">＋</span>
          <span class="text-[11px] font-black">Adicionar dedução</span>
          <span class="text-[9px] text-violet-600/70">${components.length === 0 ? 'Comece aqui' : 'Mais um componente?'}</span>
        </button>`;
        body = `<div class="space-y-2">
          ${scaleBanner}
          <div class="flex items-center justify-between flex-wrap gap-2">
            <p class="text-[10px] font-black text-stone-600 uppercase tracking-widest">Composição · cada card é uma dedução do valor base</p>
            ${this._handlePicker(pickerKey, cfgNow)}
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            ${componentCards}
            ${addCard}
          </div>
        </div>`;
      } else if (mode === 'auto' && autoData?.breakdown && autoData.breakdown.length > 0) {
        body = `<details class="text-[11px]">
          <summary class="cursor-pointer text-slate-600 hover:text-slate-900 font-bold">▼ Como chegamos automaticamente</summary>
          <div class="mt-2 space-y-0.5 pl-3">
            <div class="flex justify-between text-slate-700"><span>TM (base)</span><span>${this._money(autoData.ticket)}</span></div>
            ${autoData.breakdown.map(b => `<div class="flex justify-between text-amber-700">
              <span>(−) ${Utils.escape(b.name)} <span class="text-[9px] text-slate-400">${Utils.escape(b.formula || '')}</span></span>
              <span>−${this._money(b.unit)}</span>
            </div>`).join('')}
            <div class="flex justify-between text-emerald-700 font-black border-t border-slate-200 pt-0.5"><span>= MCU</span><span>${this._money(autoData.value)}</span></div>
          </div>
        </details>`;
      } else if (mode === 'auto') {
        body = `<p class="text-[10px] text-slate-400 italic">Sistema calcula automaticamente. Para sobrescrever, escolha "Valor único" ou "Composição".</p>`;
      }
      // V32.11.1 — Sem mt/pt/border-t aqui porque agora vive dentro de container
      // (border-t + softBg externos cuidam da divisão visual). Padding lateral
      // próprio pra respirar.
      return `<div class="px-4 py-3">
        <div class="flex items-center gap-1.5 mb-2 flex-wrap">
          <span class="text-[10px] font-black text-slate-500 uppercase tracking-wider mr-1">Edição</span>
          ${tabBtn('auto', 'Auto')}
          ${tabBtn('manual', 'Valor único')}
          ${tabBtn('composed', 'Composição')}
          ${(mode === 'manual' || mode === 'composed')
            ? `<button onclick="Actions.resetRevopsKpiOverride('${productId}', '${kpi}')" class="ml-auto text-[10px] font-bold text-slate-500 hover:text-slate-700 inline-flex items-center gap-1"><i data-lucide="rotate-ccw" class="w-3 h-3"></i> Voltar pro auto</button>`
            : ''}
        </div>
        ${body}
      </div>`;
    },

    // V36.14.0 — Card vertical de dedução no modo Composição (MCU/MSU).
    // Substitui o _composedDeductionRow horizontal. Mesmo padrão dos cards
    // de dedução do DRE: nome no topo, fórmula no meio, valor calculado
    // embaixo, engrenagem com menu Djow/Remover. IDs únicos pro foco.
    _composedDeductionCard(productId, kpi, idx, c, symbols) {
      const nameRaw = String(c.name || '');
      const valueRaw = String(c.value || '');
      const nameLooksLikeFormula = /^=/.test(nameRaw.trim()) || /=\s*[a-z_]/i.test(nameRaw);
      const isUnitKpi = kpi === 'mcu' || kpi === 'msu';
      const validation = RevopsWhitelabelEngine.validateFormula(valueRaw, symbols, null, { unitContext: isUnitKpi });

      // Status → estilo do card (igual DRE: verde quando ok com valor, amber
      // quando warn ou computa zero, rose quando erro de sintaxe, neutro vazio).
      const status = !valueRaw.trim() ? 'empty'
                   : validation.status === 'error' ? 'error'
                   : validation.status === 'warn' ? 'warn'
                   : Math.abs(Number(validation.value || 0)) < 0.01 ? 'zero'
                   : 'ok';
      // V36.14.2 — Regra do design diretor: VALOR sempre rose (é redução do
      // valor base do KPI). Borda + badge sinalizam status da fórmula
      // (verde=ok, amber=warn/zero, rose=erro) — independente da cor do valor.
      const statusMap = {
        empty: { border: 'border-stone-300',  badge: '',                                                                                                                          valueColor: 'text-stone-400',  valueLabel: '—'                                                  },
        ok:    { border: 'border-emerald-400', badge: '<span title="Fórmula válida" class="px-1.5 py-0.5 rounded-md bg-emerald-100 border border-emerald-300 text-[9px] font-black text-emerald-800 uppercase">✓</span>', valueColor: 'text-rose-700', valueLabel: `−${this._money(validation.value)}` },
        zero:  { border: 'border-amber-400',  badge: '<span title="Fórmula computa zero — confere o handle ou o número" class="px-1.5 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-[9px] font-black text-amber-800 uppercase">?</span>', valueColor: 'text-rose-700', valueLabel: `−R$ 0` },
        warn:  { border: 'border-amber-400',  badge: '<span title="Atenção" class="px-1.5 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-[9px] font-black text-amber-800 uppercase">!</span>',           valueColor: 'text-rose-700', valueLabel: `−${this._money(validation.value)}`  },
        error: { border: 'border-rose-400',   badge: '<span title="Erro de sintaxe" class="px-1.5 py-0.5 rounded-md bg-rose-100 border border-rose-300 text-[9px] font-black text-rose-800 uppercase">×</span>',     valueColor: 'text-rose-700',  valueLabel: 'erro'                                              }
      };
      const s = statusMap[status];
      const menuOpen = App.state.revopsDreCardMenuOpen === `revops-${kpi}-${idx}`;

      return `<div class="rounded-2xl border border-stone-200 bg-white/80 p-3 flex flex-col gap-2 min-h-[110px] relative">
        <div class="flex items-start justify-between gap-2">
          <input id="lj-revops-${productId}-${kpi}-${idx}-name" value="${Utils.escape(nameRaw)}" onchange="Actions.updateRevopsKpiComponent('${productId}', '${kpi}', ${idx}, 'name', this.value)" placeholder="Imposto, Comissão" class="flex-1 min-w-0 px-2 py-1 rounded-lg bg-white border ${nameLooksLikeFormula ? 'border-amber-400' : 'border-stone-300'} text-[11px] font-black text-slate-900" />
          <button onclick="Actions.toggleRevopsDreCardMenu('revops-${kpi}-${idx}')" class="px-1.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 shrink-0" title="Opções">
            <i data-lucide="settings" class="w-3 h-3"></i>
          </button>
          ${menuOpen ? `<div class="absolute top-10 right-2 z-20 rounded-xl bg-white border border-stone-200 shadow-lg p-1 min-w-[140px]">
            <button onclick="Actions.selectDjowRevopsComponent('${productId}', '${kpi}', ${idx}); Actions.toggleRevopsDreCardMenu('revops-${kpi}-${idx}');" class="w-full text-left px-2 py-1.5 rounded-lg hover:bg-violet-50 text-[11px] text-violet-700 font-bold inline-flex items-center gap-1.5">
              <i data-lucide="sparkles" class="w-3 h-3"></i> Djow ajuda
            </button>
            <button onclick="Actions.deleteRevopsKpiComponent('${productId}', '${kpi}', ${idx})" class="w-full text-left px-2 py-1.5 rounded-lg hover:bg-rose-50 text-[11px] text-rose-700 font-bold inline-flex items-center gap-1.5">
              <i data-lucide="trash-2" class="w-3 h-3"></i> Remover
            </button>
          </div>` : ''}
        </div>
        ${nameLooksLikeFormula ? `<div class="flex items-center gap-1.5 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
          <i data-lucide="alert-triangle" class="w-3 h-3 shrink-0"></i>
          <span class="flex-1">Isso parece fórmula — campo errado.</span>
          <button onclick="Actions.moveRevopsComponentFormulaToValue('${productId}', '${kpi}', ${idx})" class="px-1.5 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-[9px] font-black inline-flex items-center gap-0.5" style="color:#fff!important;">Mover ↓</button>
        </div>` : ''}
        <input id="lj-revops-${productId}-${kpi}-${idx}-value" type="text" onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}" value="${Utils.escape(valueRaw)}" title="${Utils.escape(validation.message || '')}" list="lj-revops-handles" onchange="Actions.updateRevopsKpiComponent('${productId}', '${kpi}', ${idx}, 'value', this.value)" placeholder="60 ou =tm*0,15" class="w-full px-2 py-1 rounded-lg bg-white border ${s.border} text-[11px] font-mono text-slate-800" />
        ${validation.status === 'error' && validation.suggestions && validation.suggestions.length
          ? `<p class="text-[9px] text-rose-700 -mt-1">${Utils.escape(validation.message)} · sugestão: <code class="bg-white px-1 rounded">${Utils.escape(validation.suggestions[0])}</code></p>`
          : ''}
        ${validation.scaleWarning ? `<div class="flex items-center gap-1.5 text-[10px] text-amber-800 bg-amber-50 px-1.5 py-1 rounded border border-amber-200">
          <i data-lucide="info" class="w-3 h-3 shrink-0"></i>
          <span class="flex-1 truncate">Use: <code class="bg-white px-1 rounded font-mono">${Utils.escape(validation.correctedFormula || '')}</code></span>
          <button onclick="Actions.applyRevopsScaleFix('${productId}', '${kpi}', ${idx})" class="px-1.5 py-0.5 rounded bg-amber-600 hover:bg-amber-700 text-white text-[9px] font-black shrink-0" style="color:#fff!important;">Aplicar</button>
        </div>` : ''}
        <div class="mt-auto flex items-center gap-2">
          ${s.badge}
          <span class="${s.valueColor} font-black text-base whitespace-nowrap">${s.valueLabel}</span>
        </div>
      </div>`;
    },

    // V40.11.32 — Seção "KPIs Avançados" — 4 cards auto-calculados que
    // tipicamente esbarramos em RevOps mas que não cabem na cascata padrão:
    // ROAS, Payback CAC, %CAC/TM, Margem MCU%. Colapsada por default
    // (cliente expande quando precisa). Sem custom — todos derivam de `ev`.
    // Lei [[feedback_no_source_no_dash]]: divisão por 0 vira "—".
    _kpisAvancadosSection(productId, ev) {
      const isOpen = Boolean(App.state.revopsAdvancedKpisOpen?.[productId]);
      const fatBruto = Number(ev.fatBruto) || 0;
      const aquisicao = Number(ev.acquisitionTotal) || 0;
      const ticket = Number(ev.ticket) || 0;
      const cac = (Number(ev.sales) || 0) > 0 ? aquisicao / ev.sales : 0;
      const variableUnit = (Number(ev.sales) || 0) > 0 ? (Number(ev.variableTotal) || 0) / ev.sales : 0;
      const mcu = ticket - variableUnit;
      const msu = mcu - cac;

      const roas = aquisicao > 0 ? fatBruto / aquisicao : null;
      const payback = msu > 0 ? cac / msu : null;
      const cacPctTm = ticket > 0 ? (cac / ticket) * 100 : null;
      const margemMcuPct = ticket > 0 ? (mcu / ticket) * 100 : null;

      const fmtMultiple = (v) => v == null ? '—' : `${v.toFixed(1).replace('.', ',')}×`;
      const fmtPct = (v) => v == null ? '—' : `${v.toFixed(1).replace('.', ',')}%`;
      const fmtPayback = () => {
        if (msu <= 0) return 'Operação no vermelho';
        if (payback == null) return '—';
        if (payback < 1) return `${payback.toFixed(2).replace('.', ',')} venda`;
        return `${payback.toFixed(1).replace('.', ',')} vendas`;
      };

      // V40.12.4 — Sprint 5 da Onda V2 de Audiência: KPIs Avançados leem
      // ranges saudáveis do arquétipo da Audiência. Cliente vê ROAS atual
      // vs benchmark do tipo de negócio dele (ex: B2B Wholesale Payback
      // saudável 3-6 meses; B2C E-commerce Impulso < 1 mês).
      const revopsConfig = window.AudienceConsumerEngine
        ? AudienceConsumerEngine.getRevopsConfig(productId)
        : null;
      const arch = window.AudienceConsumerEngine
        ? AudienceConsumerEngine.getArchetype(productId)
        : null;
      const archKey = window.AudienceConsumerEngine
        ? AudienceConsumerEngine.getArchetypeKey(productId)
        : null;

      const card = (label, value, formula, tone, saudavel) => {
        const t = this._cascadeTone(tone);
        return `<div class="rounded-xl bg-white border border-stone-200 ${t.borderL} p-3 shadow-sm">
          <p class="text-[9px] font-black ${t.pill} uppercase tracking-widest leading-tight">${label}</p>
          <p class="text-xl font-black ${t.text} mt-1.5 leading-tight">${value}</p>
          <p class="text-[10px] text-stone-500 mt-1 font-mono">${formula}</p>
          ${saudavel ? `<p class="text-[9px] mt-1.5 pt-1.5 border-t border-stone-100 text-stone-500"><span class="font-black">Saudável:</span> ${Utils.escape(saudavel)}</p>` : ''}
        </div>`;
      };

      const chevronIcon = isOpen ? 'chevron-down' : 'chevron-right';
      const collapsedHint = isOpen ? '' : `<span class="text-[10px] text-stone-500 font-normal normal-case ml-2">ROAS · Payback · %CAC/TM · Margem MCU</span>`;

      // V40.12.4 — Badge do arquétipo no header quando o produto tem Audiência classificada.
      const archBadge = arch && archKey
        ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-50 border border-violet-200 text-[9px] font-black text-violet-700 uppercase tracking-widest ml-2" title="${Utils.escape(arch.tagline || '')}"><i data-lucide="target" class="w-2.5 h-2.5"></i>${Utils.escape(arch.label || '')}</span>`
        : '';

      // V40.12.4 — Ranges saudáveis derivados do arquétipo, apenas pros que se aplicam.
      const paybackSaudavel = revopsConfig?.payback_saudavel || null;
      const roasSaudavel = revopsConfig?.roas_min ? `≥ ${revopsConfig.roas_min}×` : null;
      // Margem MCU% e %CAC/TM: ranges não estão no catálogo ainda — Sprint 6 pode cravar.

      return `<div class="rounded-2xl bg-white/60 border border-stone-200 mt-3">
        <button type="button" onclick="Actions.toggleRevopsAdvancedKpis('${productId}')" class="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition rounded-2xl">
          <span class="flex items-center gap-2">
            <i data-lucide="${chevronIcon}" class="w-4 h-4 text-stone-500"></i>
            <span class="text-[11px] font-black text-stone-700 uppercase tracking-widest">KPIs Avançados</span>
            ${archBadge}
            ${collapsedHint}
          </span>
          <span class="text-[10px] text-stone-400 font-normal normal-case">${isOpen ? 'recolher' : 'expandir'}</span>
        </button>
        ${isOpen ? `
          ${revopsConfig?.foco ? `<div class="px-4 pt-2 pb-1">
            <p class="text-[10px] text-stone-600"><span class="font-black text-stone-700 uppercase tracking-wider">Foco do arquétipo:</span> ${Utils.escape(revopsConfig.foco)}</p>
          </div>` : ''}
          <div class="px-4 pb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            ${card('ROAS · Retorno sobre Aquisição', fmtMultiple(roas), '= fat_bruto ÷ s&m', 'violet', roasSaudavel)}
            ${card('Payback CAC', fmtPayback(), '= cac ÷ msu', 'amber', paybackSaudavel)}
            ${card('% CAC do Ticket', fmtPct(cacPctTm), '= cac ÷ tm × 100', 'rose', null)}
            ${card('Margem MCU %', fmtPct(margemMcuPct), '= mcu ÷ tm × 100', 'emerald', null)}
          </div>
        ` : ''}
      </div>`;
    },

    // V32.10.0 — Card final de Breakeven com microcopy operacional.
    // V32.11.1 — Leonardo: Breakeven highlight final. Gradient violet-50→white
    // + left-border violet 600 (espessa, é o destino da cascata). Health pill
    // sóbria, com Lucide icon de status.
    // V40.11.35 — Recebe `ebitdaMarginal` (folga × MSU) e `extrasDreAjuste`
    // (diferença com a DRE real). Quando há extras DRE não-triviais, mostra
    // decomposição "marginal → ajuste extras DRE → EBITDA da DRE" pra cliente
    // entender de onde veio cada R$.
    _cascadeBreakeven(breakeven, msu, fixedTotal, health, folgaVendas, ebitdaProjetado, ebitdaMarginal, extrasDreAjuste) {
      const tone = this._cascadeTone('violet');
      const healthMap = {
        emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-400/30', text: 'text-emerald-800', icon: 'check-circle-2' },
        amber:   { bg: 'bg-amber-500/10',   border: 'border-amber-400/30',   text: 'text-amber-800',   icon: 'alert-triangle' },
        rose:    { bg: 'bg-rose-500/10',    border: 'border-rose-400/30',    text: 'text-rose-800',    icon: 'x-circle' }
      };
      const h = healthMap[health.cls] || healthMap.amber;
      return `<div class="rounded-2xl bg-gradient-to-br from-violet-50 to-white border-2 border-violet-200 ${tone.borderL} overflow-hidden shadow-md">
        <div class="p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2.5 min-w-0">
              <span class="shrink-0 w-10 h-10 rounded-xl ${tone.iconBg} grid place-items-center ${tone.iconText}">
                <i data-lucide="target" class="w-5 h-5"></i>
              </span>
              <div class="min-w-0">
                <p class="text-[10px] font-black ${tone.pill} uppercase tracking-widest">Linha de Equilíbrio</p>
                <p class="text-sm font-black text-slate-900 leading-tight">Breakeven em Unidades</p>
              </div>
            </div>
            <p class="text-3xl font-black ${tone.text} whitespace-nowrap shrink-0">${breakeven.toLocaleString('pt-BR')} <span class="text-sm font-bold text-violet-700">vendas</span></p>
          </div>
          <div class="mt-2 flex items-start gap-1.5 text-[11px] text-slate-500">
            <i data-lucide="info" class="w-3 h-3 mt-0.5 shrink-0"></i>
            <span>${this._money(fixedTotal)} ÷ MSU ${this._moneySmart(msu)} = ${breakeven.toLocaleString('pt-BR')} vendas pra o mês empatar.</span>
          </div>
          <div class="mt-3 rounded-xl ${h.bg} border ${h.border} p-3">
            <div class="flex items-start gap-2 ${h.text}">
              <i data-lucide="${h.icon}" class="w-4 h-4 shrink-0 mt-0.5"></i>
              <div class="min-w-0">
                <p class="text-[11px] font-black">${health.msg}</p>
                ${folgaVendas > 0
                  ? (Math.abs(extrasDreAjuste || 0) >= 1
                      ? `<p class="text-[11px] mt-1 font-bold">Folga: ${folgaVendas.toLocaleString('pt-BR')} vendas × ${this._moneySmart(msu)} = ${this._money(ebitdaMarginal)} marginal · ${extrasDreAjuste > 0 ? '−' : '+'} ${this._money(Math.abs(extrasDreAjuste))} de extras DRE = <b>${this._money(ebitdaProjetado)} de EBITDA projetado</b></p>`
                      : `<p class="text-[11px] mt-1 font-bold">Folga: ${folgaVendas.toLocaleString('pt-BR')} vendas × ${this._moneySmart(msu)} = <b>${this._money(ebitdaProjetado)} de EBITDA projetado</b></p>`)
                  : folgaVendas < 0
                  ? `<p class="text-[11px] mt-1 font-bold">Faltam ${Math.abs(folgaVendas).toLocaleString('pt-BR')} vendas pra cobrir os fixos. Prejuízo projetado: <b>${this._money(Math.abs(ebitdaProjetado))}</b></p>`
                  : ''}
              </div>
            </div>
          </div>
        </div>
      </div>`;
    },

    _customKpiRow(productId, kpi, ev) {
      const value = ev.customKpiValues?.[kpi.id] || 0;
      const display = kpi.unit === 'percent' ? `${value.toFixed(1)}%` : kpi.unit === 'BRL' ? this._money(value) : value.toLocaleString('pt-BR');
      const cfg = this._currentConfig(productId);
      const pickerKey = `customKpi:${productId}:${kpi.id}`;
      const pickerOpen = App.state.revopsHandlePickerKey === pickerKey;
      return `<div class="rounded-xl bg-white border border-rose-200 p-2 mt-2">
        <div class="flex items-center gap-2">
          <input value="${Utils.escape(kpi.name)}" onchange="Actions.updateRevopsCustomKpi('${productId}', '${kpi.id}', 'name', this.value)" placeholder="Nome do KPI" class="flex-1 min-w-0 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800" />
          <input value="${Utils.escape(kpi.formula)}" list="lj-revops-handles" onchange="Actions.updateRevopsCustomKpi('${productId}', '${kpi.id}', 'formula', this.value)" placeholder="=fat_bruto / sales" class="flex-1 min-w-0 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono text-slate-800" />
          <button onclick="Actions.toggleRevopsHandlePicker('${pickerKey}')" type="button" title="Escolha um número para se basear" class="shrink-0 px-1.5 py-1 rounded-lg bg-sky-50 border border-sky-200 hover:bg-sky-100 text-sky-700 text-xs leading-none">${pickerOpen ? '🙈' : '👁'}</button>
          <select onchange="Actions.updateRevopsCustomKpi('${productId}', '${kpi.id}', 'unit', this.value)" class="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800">
            <option value="BRL" ${kpi.unit === 'BRL' ? 'selected' : ''}>R$</option>
            <option value="percent" ${kpi.unit === 'percent' ? 'selected' : ''}>%</option>
            <option value="unit" ${kpi.unit === 'unit' ? 'selected' : ''}>un</option>
          </select>
          <span class="text-sm font-black text-rose-900 w-24 text-right">${display}</span>
          <button onclick="Actions.deleteRevopsCustomKpi('${productId}', '${kpi.id}')" class="px-1.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-black">×</button>
        </div>
        ${pickerOpen ? `<div class="mt-2">${this._handlePickerPopover(cfg)}</div>` : ''}
      </div>`;
    },

    // ────────────────────────────────────────────────────────────
    // TAB 5: DRE
    // ────────────────────────────────────────────────────────────

    // V32.10.9 — DRE FLEX (Felipe formato planilha)
    // Estrutura: FB → Deduções (expandível, sub-itens do bucket variable) →
    // VL → LB → S&M → G&A → LL. Entre cada par, botão "+" pra inserir
    // linha extra (handle ou número, signal +/−). Linhas extras persistem
    // em cfg.dreExtraLines. Cálculo cumulativo via Engine.evaluateDRE().
    // V36.12.0 — DRE refeito com tema light (offwhite #f5f3f0 igual Mapa),
    // cards no padrão Mapa Etapa 3, deduções FLAT (sem header agregado), e
    // Djow lateral sticky com apply automático. Espaçamentos enxutos.
    _dreTab(cfg, ev) {
      const productId = cfg.productId;
      const dre = RevopsWhitelabelEngine.evaluateDRE(cfg, ev);

      const variableItems = [];
      for (const g of (cfg.groups || [])) {
        if (g.bucket !== 'variable') continue;
        for (const it of (g.items || [])) {
          variableItems.push({ id: it.id, name: it.name, groupLabel: g.label, value: ev.itemValues?.[it.id] || 0 });
        }
      }

      const margemCls = dre.margem >= 25 ? 'text-emerald-700' : dre.margem >= 0 ? 'text-amber-700' : 'text-rose-700';
      const djowPanel = window.DjowRevOpsPanel ? DjowRevOpsPanel.render(productId, 'dre') : '';

      return `<div class="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        <div class="space-y-3 min-w-0">
          ${this._tabHeader('DRE · Demonstrativo do Resultado', 'Apuração do Período', 'Faturamento → Deduções → S&M → G&A → EBITDA. Clique numa linha de fórmula pra pedir ajuda ao Djow na lateral.')}
          <section class="rounded-3xl border p-5 shadow-md space-y-2" style="background:#f5f3f0;border-color:#e7e5e0;color-scheme:light;">
            ${this._dreFlatRender(productId, dre, variableItems)}
          </section>
          <div class="rounded-2xl border p-3 text-[12px] text-stone-700" style="background:#faf8f5;border-color:#e7e5e0;" title="EBITDA = Resultado antes de juros, impostos sobre lucro, depreciação e amortização. Pra infoproduto digital sem essas linhas, equivale ao seu resultado operacional do período.">
            <b>Margem EBITDA:</b> <b class="${margemCls}">${dre.margem.toFixed(1)}%</b> · EBITDA / Faturamento Bruto. <span class="text-stone-500">(passe o mouse pra entender o termo)</span>
          </div>
        </div>
        <aside class="xl:sticky xl:top-4 xl:self-start">${djowPanel}</aside>
      </div>`;
    },

    // V36.12.0 — Renderiza a DRE light com deduções flat. Cada linha vira
    // card no padrão Mapa Etapa 3 (bg-white/70 stone-200). Subtotais base
    // (Faturamento, Venda Líquida, Lucro Bruto, Lucro Líquido) são cards
    // mais destacados com cor semântica. Deduções variáveis (Custos) ficam
    // como cards read-only; deduções avulsas (deducoes_inside extras) viram
    // cards editáveis. Mesmo padrão pra extras de outros steps.
    _dreFlatRender(productId, dre, variableItems) {
      const blocks = [];
      const extrasByStep = {};
      const groupsByStep = dre.groupsByStep || {};
      for (const l of dre.lines) {
        if (l.kind === 'extra') {
          (extrasByStep[l.afterStep] = extrasByStep[l.afterStep] || []).push(l);
        }
      }

      // V36.13.3 — Suprime Lucro Bruto quando == Venda Líquida.
      // V36.13.4 — Suprime Venda Líquida também por default (subtotal
      // intermediário não ajuda na leitura executiva). Aparecem de volta
      // quando cliente inserir grupo/extra ancorado em afterStep correspondente.
      const hasExtrasOrGroupsAt = (step) =>
        (extrasByStep[step] || []).length > 0 || (groupsByStep[step] || []).length > 0;
      const vlVal = dre.totals?.vendaLiquida ?? 0;
      const lbVal = dre.totals?.lucroBruto ?? 0;
      const skipVendaLiquida = !hasExtrasOrGroupsAt('venda_liquida');
      const skipLucroBruto = !hasExtrasOrGroupsAt('venda_liquida')
                          && !hasExtrasOrGroupsAt('lucro_bruto')
                          && Math.abs(vlVal - lbVal) < 0.01;

      // V37.0.10 — Linhas-banner que TÊM conteúdo abaixo recebem chevron de collapse.
      // EBITDA (lucro_liquido) não recebe — nada abaixo dela.
      const COLLAPSIBLE_LINES = new Set(['fat_bruto', 'deducoes', 'venda_liquida', 'lucro_bruto', 's_m', 'g_a']);

      for (const l of dre.lines) {
        if (l.kind !== 'base') continue;
        if (l.id === 'venda_liquida' && skipVendaLiquida) continue;
        if (l.id === 'lucro_bruto' && skipLucroBruto) continue;
        const collapseKey = COLLAPSIBLE_LINES.has(l.id) ? `dre:${l.id}` : null;
        const isCollapsed = collapseKey ? this._isCollapsed(productId, collapseKey) : false;
        if (l.id === 'deducoes') {
          blocks.push(this._dreBaseCard(productId, l, collapseKey));
          if (!isCollapsed) {
            blocks.push(this._dreFlatDeducoes(productId, variableItems, dre.deducoesInsideExtras || []));
            // V40.11.34 — Renderizar extras + grupos ancorados em afterStep='deducoes'
            // E o botão "+ inserir linha". Antes, o `continue` abaixo pulava esses 3
            // passos, escondendo linhas extras válidas (ex: Inadimplência, descontos
            // de parceria). Engine sempre considerou esses extras no cumulativo
            // (sumExtras('deducoes')), mas a UI omitia silenciosamente. Bug global.
            for (const ex of (extrasByStep[l.id] || [])) {
              blocks.push(this._dreExtraCard(productId, ex));
            }
            for (const g of (groupsByStep[l.id] || [])) {
              blocks.push(this._dreExtraGroupBlock(productId, g));
            }
            blocks.push(this._dreAddLineBtn(productId, l.id));
          }
          continue;
        }
        blocks.push(this._dreBaseCard(productId, l, collapseKey));
        if (isCollapsed) continue;
        for (const ex of (extrasByStep[l.id] || [])) {
          blocks.push(this._dreExtraCard(productId, ex));
        }
        for (const g of (groupsByStep[l.id] || [])) {
          blocks.push(this._dreExtraGroupBlock(productId, g));
        }
        if (l.id !== 'lucro_liquido') {
          blocks.push(this._dreAddLineBtn(productId, l.id));
        }
      }

      return blocks.join('');
    },

    // V36.13.0 — Bloco do grupo: linha-banner laranja + grid de cards filhos.
    // Estrutura simétrica aos marcos base (verde/sky/rose) mas em laranja
    // pra marcar "personalizado". Cards filhos só aparecem após cliente
    // dar nome ao grupo. Engrenagem na linha edita signal/nome ou deleta.
    _dreExtraGroupBlock(productId, g) {
      const hasName = String(g.name || '').trim().length > 0;
      const collapseKey = hasName ? `dre:group_${g.id}` : null;
      const isCollapsed = collapseKey ? this._isCollapsed(productId, collapseKey) : false;
      const banner = this._dreExtraGroupBanner(productId, g, hasName, collapseKey);
      if (!hasName) {
        // Sem nome: mostra banner com input em destaque + hint
        return `<div class="space-y-2 pl-1 border-l-2 border-amber-300 ml-1">
          ${banner}
          <div class="pl-2 pr-1">
            <div class="rounded-2xl border border-dashed border-amber-300 bg-amber-50/30 p-3 text-center text-[11px] text-stone-500 italic">
              Dê um nome à linha pra liberar os cards de fórmula.
            </div>
          </div>
        </div>`;
      }
      if (isCollapsed) {
        // Collapsed: só banner
        return `<div class="space-y-2 pl-1 border-l-2 border-amber-300 ml-1">${banner}</div>`;
      }
      const cards = [];
      (g.items || []).forEach(it => cards.push(this._dreExtraGroupItemCard(productId, g.id, it)));
      cards.push(this._dreAddGroupItemCard(productId, g.id, (g.items || []).length));
      return `<div class="space-y-2 pl-1 border-l-2 border-amber-300 ml-1">
        ${banner}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-2 pr-1">
          ${cards.join('')}
        </div>
      </div>`;
    },

    _dreExtraGroupBanner(productId, g, hasName, collapseKey) {
      const positive = g.signal === '+';
      const valueColor = positive ? 'text-emerald-700' : 'text-rose-700';
      const signalLabel = positive ? '+' : '−';
      const menuOpen = App.state.revopsDreGroupMenuOpen === g.id;
      const total = Number(g.total || 0);
      // V37.0.10 — Chevron de collapse (só quando linha tem nome)
      const chevron = collapseKey ? this._chevronToggle(productId, collapseKey, { tone: 'amber' }) : '';
      return `<div class="rounded-2xl border-2 border-amber-300 shadow-sm flex items-center gap-3 px-4 py-2.5 relative" style="background:#fef3c7;color-scheme:light;">
        <select onchange="Actions.updateDreExtraGroup('${productId}', '${g.id}', 'signal', this.value)" class="px-1.5 py-0.5 rounded-md bg-white border border-amber-300 text-[11px] font-black text-slate-800 shrink-0">
          <option value="-" ${!positive ? 'selected' : ''}>−</option>
          <option value="+" ${positive ? 'selected' : ''}>+</option>
        </select>
        <input id="lj-dreg-${g.id}-name" value="${Utils.escape(g.name || '')}" onchange="Actions.updateDreExtraGroup('${productId}', '${g.id}', 'name', this.value)" placeholder="Nome da linha (ex: Receitas financeiras)" class="flex-1 min-w-0 px-2 py-1 rounded-lg bg-white border border-amber-300 text-[12px] font-black text-slate-900" />
        <span class="px-2 py-0.5 rounded-md bg-amber-200 border border-amber-400 text-[9px] font-black text-amber-900 uppercase tracking-widest shrink-0">personalizada</span>
        ${hasName ? `<span class="${valueColor} font-black text-[14px] whitespace-nowrap shrink-0">${signalLabel}${this._money(total)}</span>` : ''}
        <button onclick="Actions.toggleRevopsDreGroupMenu('${g.id}')" class="px-1.5 py-1 rounded-lg bg-white hover:bg-amber-100 border border-amber-300 text-amber-800 shrink-0" title="Opções da linha">
          <i data-lucide="settings" class="w-3.5 h-3.5"></i>
        </button>
        ${chevron}
        ${menuOpen ? `<div class="absolute top-12 right-2 z-20 rounded-xl bg-white border border-stone-200 shadow-lg p-1 min-w-[160px]">
          <button onclick="Actions.deleteDreExtraGroup('${productId}', '${g.id}')" class="w-full text-left px-2 py-1.5 rounded-lg hover:bg-rose-50 text-[11px] text-rose-700 font-bold inline-flex items-center gap-1.5">
            <i data-lucide="trash-2" class="w-3 h-3"></i> Remover linha
          </button>
        </div>` : ''}
      </div>`;
    },

    _dreExtraGroupItemCard(productId, groupId, it) {
      const isSelected = this._isDjowSelectedItem(productId, groupId, it.id);
      const selectedRing = isSelected ? 'ring-2 ring-violet-400 ring-offset-1 ring-offset-[#f5f3f0]' : '';
      const menuOpen = App.state.revopsDreCardMenuOpen === it.id;
      const valStatus = this._formulaStatus(it.value, it.computedValue, '');
      const fallbackValue = `<span class="text-amber-800">${this._money(it.computedValue || 0)}</span>`;
      return `<div class="rounded-2xl border border-stone-200 bg-white/80 ${selectedRing} p-3 flex flex-col gap-2 min-h-[110px] relative">
        <div class="flex items-start justify-between gap-2">
          <input id="lj-dregi-${it.id}-name" value="${Utils.escape(it.name || '')}" onchange="Actions.updateDreExtraGroupItem('${productId}', '${groupId}', '${it.id}', 'name', this.value)" placeholder="Nome do item" class="flex-1 min-w-0 px-2 py-1 rounded-lg bg-white border border-stone-300 text-[11px] font-black text-slate-900" />
          <button onclick="Actions.toggleRevopsDreCardMenu('${it.id}')" class="px-1.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 shrink-0" title="Opções">
            <i data-lucide="settings" class="w-3 h-3"></i>
          </button>
          ${menuOpen ? `<div class="absolute top-10 right-2 z-20 rounded-xl bg-white border border-stone-200 shadow-lg p-1 min-w-[140px]">
            <button onclick="Actions.selectDjowRevopsGroupItem('${productId}', '${groupId}', '${it.id}'); Actions.toggleRevopsDreCardMenu('${it.id}');" class="w-full text-left px-2 py-1.5 rounded-lg hover:bg-violet-50 text-[11px] text-violet-700 font-bold inline-flex items-center gap-1.5">
              <i data-lucide="sparkles" class="w-3 h-3"></i> Djow ajuda
            </button>
            <button onclick="Actions.deleteDreExtraGroupItem('${productId}', '${groupId}', '${it.id}')" class="w-full text-left px-2 py-1.5 rounded-lg hover:bg-rose-50 text-[11px] text-rose-700 font-bold inline-flex items-center gap-1.5">
              <i data-lucide="trash-2" class="w-3 h-3"></i> Remover
            </button>
          </div>` : ''}
        </div>
        <input id="lj-dregi-${it.id}-value" value="${Utils.escape(it.value || '')}" list="lj-revops-handles" onchange="Actions.updateDreExtraGroupItem('${productId}', '${groupId}', '${it.id}', 'value', this.value)" placeholder="6000 ou =vendas*5" title="${valStatus.tooltip}" class="px-2 py-1 rounded-lg bg-white border ${valStatus.border} text-[11px] font-mono text-slate-800" />
        <div class="mt-auto flex items-center gap-2">
          ${valStatus.badge}
          <span class="font-black text-base whitespace-nowrap">${valStatus.valueLabel || fallbackValue}</span>
        </div>
      </div>`;
    },

    _dreAddGroupItemCard(productId, groupId, count) {
      const microcopy = count === 0 ? 'Comece aqui'
                     : count === 1 ? 'Mais um item?'
                     : count === 2 ? 'Adiciona granularidade'
                     : 'Outro item?';
      return `<button onclick="Actions.addDreExtraGroupItem('${productId}', '${groupId}')" type="button" class="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/40 hover:bg-amber-50/80 hover:border-amber-400 p-3 min-h-[110px] flex flex-col items-center justify-center gap-1 text-amber-700 transition">
        <span class="text-2xl font-black leading-none">＋</span>
        <span class="text-[11px] font-black">Adicionar item</span>
        <span class="text-[9px] text-amber-600/70">${Utils.escape(microcopy)}</span>
      </button>`;
    },

    _isDjowSelectedItem(productId, groupId, itemId) {
      const sel = App.state.revopsDjowSelectedLine;
      return sel && String(sel.productId) === String(productId) && sel.groupId === groupId && sel.lineId === itemId;
    },

    _dreBaseCard(productId, l, collapseKey) {
      const toneMap = {
        emerald: { ring: 'border-emerald-300', text: 'text-emerald-700', bg: 'bg-emerald-50/60', tone: 'emerald' },
        rose:    { ring: 'border-rose-300',    text: 'text-rose-700',    bg: 'bg-rose-50/40',    tone: 'rose'    },
        sky:     { ring: 'border-sky-300',     text: 'text-sky-700',     bg: 'bg-sky-50/50',     tone: 'sky'     },
        slate:   { ring: 'border-stone-300',   text: 'text-stone-800',   bg: 'bg-white/70',      tone: 'slate'   }
      };
      const t = toneMap[l.tone] || toneMap.slate;
      const isHighlight = l.highlight;
      const big = l.bold || isHighlight;
      const cardCls = isHighlight
        ? 'rounded-2xl border-2 border-amber-300 bg-amber-50/80 shadow-md'
        : `rounded-2xl border ${t.ring} ${t.bg} shadow-sm`;
      // V36.13.5 — Tooltip educativo no EBITDA (linha final, highlight=true)
      const tooltip = l.id === 'lucro_liquido'
        ? 'EBITDA = Resultado antes de juros, impostos sobre lucro, depreciação e amortização. Pra infoproduto digital sem essas linhas, equivale ao seu resultado operacional do período.'
        : '';
      const helpHint = l.id === 'lucro_liquido'
        ? '<span class="text-[10px] text-amber-700/80 font-bold ml-1.5">ⓘ</span>'
        : '';
      // V37.0.10 — Chevron de collapse opcional (linhas com conteúdo abaixo)
      const chevron = collapseKey ? this._chevronToggle(productId, collapseKey, { tone: t.tone }) : '';
      return `<div class="${cardCls} flex items-center justify-between gap-3 px-4 py-2.5" ${tooltip ? `title="${tooltip}"` : ''}>
        <span class="${big ? 'font-black text-slate-900 text-[13px]' : 'text-stone-700 text-[12px] font-bold'} inline-flex items-center">${l.label}${helpHint}</span>
        <div class="flex items-center gap-2 shrink-0">
          <span class="${big ? `font-black text-base ${t.text}` : `font-bold text-sm ${t.text}`} whitespace-nowrap">${this._money(l.value)}</span>
          ${chevron}
        </div>
      </div>`;
    },

    // V36.12.1 — Cards GRID 3-col no padrão Etapa 3 do Mapa (KR-mãe style).
    // Cada dedução vira card vertical com nome, fórmula, valor calculado e
    // engrenagem com menu (Djow ajuda + Remover). Slot dashed pra
    // "Adicionar dedução" no fim do grid.
    _dreFlatDeducoes(productId, variableItems, insideExtras) {
      const cards = [];
      variableItems.forEach(it => cards.push(this._dreDeducaoCardReadOnly(it)));
      insideExtras.forEach(l => cards.push(this._dreDeducaoCardEditable(productId, l)));
      cards.push(this._dreAddDeducaoCard(productId, variableItems.length + insideExtras.length));

      // V36.13.1 — Header local "Deduções" removido (a linha-banner rose
      // acima já cumpre esse papel, em simetria com S&M e G&A).
      return `<div class="space-y-2 pl-1 border-l-2 border-rose-200 ml-1">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pl-2 pr-1 pt-1">
          ${cards.join('')}
        </div>
      </div>`;
    },

    _dreDeducaoCardReadOnly(it) {
      return `<div class="rounded-2xl border border-stone-200 bg-white/50 p-3 flex flex-col gap-2 min-h-[110px]">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="text-[11px] font-black text-slate-900 truncate">${Utils.escape(it.name)}</p>
            <p class="text-[9px] text-stone-500 uppercase tracking-widest mt-0.5">Custos · ${Utils.escape(it.groupLabel)}</p>
          </div>
          <span class="px-1.5 py-0.5 rounded-md bg-stone-100 border border-stone-200 text-[9px] font-black text-stone-600 shrink-0">read-only</span>
        </div>
        <div class="mt-auto">
          <span class="text-rose-700 font-black text-base whitespace-nowrap">−${this._money(it.value)}</span>
        </div>
      </div>`;
    },

    _dreDeducaoCardEditable(productId, l) {
      const isSelected = this._isDjowSelected(productId, l.id);
      const selectedRing = isSelected ? 'ring-2 ring-violet-400 ring-offset-1 ring-offset-[#f5f3f0]' : '';
      const menuOpen = App.state.revopsDreCardMenuOpen === l.id;
      const valStatus = this._formulaStatus(l.raw, l.value);
      return `<div class="rounded-2xl border border-stone-200 bg-white/80 ${selectedRing} p-3 flex flex-col gap-2 min-h-[110px] relative">
        <div class="flex items-start justify-between gap-2">
          <input id="lj-dre-${l.id}-name" value="${Utils.escape(l.name)}" onchange="Actions.updateDreExtraLine('${productId}', '${l.id}', 'name', this.value)" placeholder="Nome da dedução" class="flex-1 min-w-0 px-2 py-1 rounded-lg bg-white border border-stone-300 text-[11px] font-black text-slate-900" />
          <button onclick="Actions.toggleRevopsDreCardMenu('${l.id}')" class="px-1.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 shrink-0" title="Opções">
            <i data-lucide="settings" class="w-3 h-3"></i>
          </button>
          ${menuOpen ? `<div class="absolute top-10 right-2 z-20 rounded-xl bg-white border border-stone-200 shadow-lg p-1 min-w-[140px]">
            <button onclick="Actions.selectDjowRevopsLine('${productId}', '${l.id}', 'deducoes_inside'); Actions.toggleRevopsDreCardMenu('${l.id}');" class="w-full text-left px-2 py-1.5 rounded-lg hover:bg-violet-50 text-[11px] text-violet-700 font-bold inline-flex items-center gap-1.5">
              <i data-lucide="sparkles" class="w-3 h-3"></i> Djow ajuda
            </button>
            <button onclick="Actions.deleteDreExtraLine('${productId}', '${l.id}')" class="w-full text-left px-2 py-1.5 rounded-lg hover:bg-rose-50 text-[11px] text-rose-700 font-bold inline-flex items-center gap-1.5">
              <i data-lucide="trash-2" class="w-3 h-3"></i> Remover
            </button>
          </div>` : ''}
        </div>
        <input id="lj-dre-${l.id}-value" value="${Utils.escape(l.raw || '')}" list="lj-revops-handles" onchange="Actions.updateDreExtraLine('${productId}', '${l.id}', 'value', this.value)" placeholder="6000 ou =vendas*5" title="${valStatus.tooltip}" class="px-2 py-1 rounded-lg bg-white border ${valStatus.border} text-[11px] font-mono text-slate-800" />
        <div class="mt-auto flex items-center gap-2">
          ${valStatus.badge}
          <span class="${valStatus.valueColor} font-black text-base whitespace-nowrap">${valStatus.valueLabel || ('−' + this._money(l.value))}</span>
        </div>
      </div>`;
    },

    _dreAddDeducaoCard(productId, currentCount) {
      const microcopy = currentCount === 0 ? 'Comece aqui'
                     : currentCount === 1 ? 'Cobre melhor o funil'
                     : currentCount === 2 ? 'Adiciona granularidade'
                     : 'Outra dedução?';
      return `<button onclick="Actions.addDreExtraLine('${productId}', 'deducoes_inside')" type="button" class="rounded-2xl border-2 border-dashed border-rose-300 bg-rose-50/40 hover:bg-rose-50/80 hover:border-rose-400 p-3 min-h-[110px] flex flex-col items-center justify-center gap-1 text-rose-700 transition">
        <span class="text-2xl font-black leading-none">＋</span>
        <span class="text-[11px] font-black">Adicionar dedução</span>
        <span class="text-[9px] text-rose-600/70">${Utils.escape(microcopy)}</span>
      </button>`;
    },

    // V36.12.1 — Extras (S&M, G&A, etc) também viram cards verticais compactos.
    _dreExtraCard(productId, l) {
      const isSelected = this._isDjowSelected(productId, l.id);
      const selectedRing = isSelected ? 'ring-2 ring-violet-400 ring-offset-1 ring-offset-[#f5f3f0]' : '';
      const positive = l.signal === '+';
      const valueColor = positive ? 'text-emerald-700' : 'text-rose-700';
      const signalLabel = positive ? '+' : '−';
      const menuOpen = App.state.revopsDreCardMenuOpen === l.id;
      return `<div class="rounded-2xl border border-stone-200 bg-white/80 ${selectedRing} p-3 flex flex-col gap-2 min-h-[110px] relative w-full sm:max-w-[300px]">
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-1 min-w-0 flex-1">
            <select onchange="Actions.updateDreExtraLine('${productId}', '${l.id}', 'signal', this.value)" class="px-1 py-0.5 rounded-md bg-white border border-stone-300 text-[11px] font-black text-slate-800 shrink-0">
              <option value="-" ${!positive ? 'selected' : ''}>−</option>
              <option value="+" ${positive ? 'selected' : ''}>+</option>
            </select>
            <input id="lj-drex-${l.id}-name" value="${Utils.escape(l.label === '(sem nome)' ? '' : l.label)}" onchange="Actions.updateDreExtraLine('${productId}', '${l.id}', 'name', this.value)" placeholder="Nome" class="flex-1 min-w-0 px-2 py-1 rounded-lg bg-white border border-stone-300 text-[11px] font-black text-slate-900" />
          </div>
          <button onclick="Actions.toggleRevopsDreCardMenu('${l.id}')" class="px-1.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 shrink-0">
            <i data-lucide="settings" class="w-3 h-3"></i>
          </button>
          ${menuOpen ? `<div class="absolute top-10 right-2 z-20 rounded-xl bg-white border border-stone-200 shadow-lg p-1 min-w-[140px]">
            <button onclick="Actions.selectDjowRevopsLine('${productId}', '${l.id}', '${l.afterStep}'); Actions.toggleRevopsDreCardMenu('${l.id}');" class="w-full text-left px-2 py-1.5 rounded-lg hover:bg-violet-50 text-[11px] text-violet-700 font-bold inline-flex items-center gap-1.5">
              <i data-lucide="sparkles" class="w-3 h-3"></i> Djow ajuda
            </button>
            <button onclick="Actions.deleteDreExtraLine('${productId}', '${l.id}')" class="w-full text-left px-2 py-1.5 rounded-lg hover:bg-rose-50 text-[11px] text-rose-700 font-bold inline-flex items-center gap-1.5">
              <i data-lucide="trash-2" class="w-3 h-3"></i> Remover
            </button>
          </div>` : ''}
        </div>
        <input id="lj-drex-${l.id}-value" value="${Utils.escape(l.raw || '')}" list="lj-revops-handles" onchange="Actions.updateDreExtraLine('${productId}', '${l.id}', 'value', this.value)" placeholder="6000 ou =fat_bruto*0,03" class="px-2 py-1 rounded-lg bg-white border border-stone-300 text-[11px] font-mono text-slate-800" />
        <div class="mt-auto">
          <span class="${valueColor} font-black text-base whitespace-nowrap">${signalLabel}${this._money(l.value)}</span>
        </div>
      </div>`;
    },

    _dreAddLineBtn(productId, afterStep) {
      // V36.13.0 — agora cria GRUPO (linha-banner laranja + cards filhos)
      return `<div class="flex justify-center py-0.5">
        <button onclick="Actions.addDreExtraGroup('${productId}', '${afterStep}')" type="button" title="Inserir linha personalizada entre fases" class="text-[10px] text-stone-400 hover:text-amber-700 font-bold inline-flex items-center gap-1 px-3 py-1 rounded-lg hover:bg-amber-50/50">
          <span class="text-sm leading-none">＋</span> inserir linha
        </button>
      </div>`;
    },

    _isDjowSelected(productId, lineId) {
      const sel = App.state.revopsDjowSelectedLine;
      return sel && String(sel.productId) === String(productId) && sel.lineId === lineId;
    },

    // V36.13.3 — Status visual da fórmula. Retorna { border, badge, valueLabel,
    // valueColor, tooltip } baseado em raw (input cru) e computedValue.
    //   vazio              → neutro, mostra "—"
    //   preenchido e >0    → rose normal, sem badge
    //   preenchido e =0    → amber warning, badge "?", tooltip explicativo
    _formulaStatus(raw, computedValue, defaultSignal = '−') {
      const rawStr = String(raw || '').trim();
      if (!rawStr) {
        return {
          border: 'border-stone-300',
          badge: '',
          valueLabel: '<span class="text-stone-400">—</span>',
          valueColor: '',
          tooltip: 'Digite um número fixo (ex: 6000) ou uma fórmula (ex: =vendas*5)'
        };
      }
      const isZero = Math.abs(Number(computedValue || 0)) < 0.01;
      if (isZero) {
        return {
          border: 'border-amber-400',
          badge: '<span title="Fórmula computa zero — confere o handle ou o número" class="px-1.5 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-[9px] font-black text-amber-800 uppercase">?</span>',
          valueLabel: `<span class="text-amber-700">${defaultSignal}R$ 0</span>`,
          valueColor: '',
          tooltip: 'A fórmula está retornando zero. Verifique se o handle existe (vendas, fat_bruto, tm, fat_liquido, lucro_bruto) e se o número está com vírgula decimal correta.'
        };
      }
      return {
        border: 'border-stone-300',
        badge: '',
        valueLabel: '',
        valueColor: 'text-rose-700',
        tooltip: ''
      };
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

    // V32.10.7 — Evaluate + injeção dos KPIs cascata (mcu/msu/cac/breakeven)
    // em ev.symbols. Usado por qualquer chamada que precise validar fórmula
    // referenciando esses KPIs (ex: composedDeductionRow, customKpiRow).
    _evalWithCascade(cfg) {
      const ev = RevopsWhitelabelEngine.evaluate(cfg);
      const productId = cfg.productId;
      const mcuAuto = RevopsWhitelabelEngine.computeAutoMCU(cfg, ev);
      const mcuOv = App.state.revopsKpiOverrides?.[productId]?.mcu || { mode: 'auto' };
      mcuOv.baseValue = ev.ticket;
      // V36.8.4 — unitContext:true em MCU e MSU (métricas POR VENDA)
      const mcu = RevopsWhitelabelEngine.resolveOverride(mcuOv, mcuAuto.value, ev.symbols, { unitContext: true }).value;
      const cac = ev.sales > 0 ? ev.acquisitionTotal / ev.sales : 0;
      const msuAuto = RevopsWhitelabelEngine.computeAutoMSU(mcu, cac);
      const msuOv = App.state.revopsKpiOverrides?.[productId]?.msu || { mode: 'auto' };
      msuOv.baseValue = mcu;
      const msu = RevopsWhitelabelEngine.resolveOverride(msuOv, msuAuto.value, ev.symbols, { unitContext: true }).value;
      const breakeven = msu > 0 ? Math.ceil(ev.fixedTotal / msu) : 0;
      ev.symbols.mcu = mcu;
      ev.symbols.msu = msu;
      ev.symbols.cac = cac;
      ev.symbols.breakeven = breakeven;
      return ev;
    },

    _activeTab() {
      const stored = App.state.revopsWhitelabelActiveTab;
      if (stored && TABS.find(t => t.id === stored)) return stored;
      return 'costs';
    },

    _money(value) {
      const n = Number(value) || 0;
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
    },

    // V40.7.20 — Leonardo: pra números sensíveis como Ticket Médio, centavos
    // são emocionais — sumir com eles é dizer "não confio no número o suficiente
    // pra mostrar inteiro". Usado no ticket calculado da aba Ofertas.
    _moneyPrecise(value) {
      const n = Number(value) || 0;
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    },

    // V40.11.30 — Fmt adaptativo: valores < R$ 100 mostram 2 casas decimais
    // (CAC R$ 2,29, MCU R$ 20,98 — onde 29 centavos = 14% de diferença);
    // valores ≥ R$ 100 arredondam (R$ 26.300 não precisa de ",00"). Replica
    // o `fmt` local do `_cacCard` (V40.11.20) elevando pra helper reusável.
    // Lei Leonardo: centavos são emocionais quando o número é pequeno.
    _moneySmart(value) {
      const n = Number(value) || 0;
      if (Math.abs(n) > 0 && Math.abs(n) < 100) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
      }
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
    },

    // V37.0.10 — Helpers de collapse pra linhas DRE e cards RevOps.
    _isCollapsed(productId, key) {
      return Boolean(App.state.revopsCollapsed?.[productId]?.[key]);
    },

    _chevronToggle(productId, key, opts) {
      const isOpen = !this._isCollapsed(productId, key);
      const size = opts?.size || 'sm';
      const tone = opts?.tone || 'slate';
      const tones = {
        slate:   'text-stone-500 hover:text-stone-900 hover:bg-stone-100',
        emerald: 'text-emerald-700 hover:bg-emerald-100',
        rose:    'text-rose-700 hover:bg-rose-100',
        amber:   'text-amber-700 hover:bg-amber-100',
        sky:     'text-sky-700 hover:bg-sky-100'
      };
      const cls = tones[tone] || tones.slate;
      const px = size === 'md' ? 'w-7 h-7' : 'w-6 h-6';
      const ic = size === 'md' ? 'w-4 h-4' : 'w-3.5 h-3.5';
      return `<button onclick="event.stopPropagation(); Actions.toggleRevopsCollapsed('${productId}', '${key}')" title="${isOpen ? 'Recolher' : 'Expandir'}" class="${px} rounded-lg ${cls} grid place-items-center transition shrink-0">
        <i data-lucide="${isOpen ? 'chevron-up' : 'chevron-down'}" class="${ic}"></i>
      </button>`;
    }
  };

  window.RevopsWhitelabelPanel = RevopsWhitelabelPanel;
})();
