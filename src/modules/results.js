var ResultModule = {
  render() {
    // V33.0.0 — Hierarquia produto-first. Fallback pro modo clássico via
    // App.state.resultsClassicMode (toggle no header).
    if (App.state.resultsClassicMode) return this._renderClassic();
    return this._renderProductFirst();
  },

  // V33.0.0 — Modo NOVO (default): Produto → Campanha → Ação.
  _renderProductFirst() {
    const selectedAction = App.state.actions.find(action => Number(action.id) === Number(App.state.selectedActionId)) || null;
    if (selectedAction) {
      const campaign = App.state.campaigns.find(c => Number(c.id) === Number(selectedAction.campaignId));
      return this.detail(campaign, selectedAction);
    }
    const selectedCampaignId = App.state.selectedResultCampaignId || null;
    if (selectedCampaignId) {
      const campaign = App.state.campaigns.find(c => Number(c.id) === Number(selectedCampaignId));
      if (campaign) return this.campaignOverview(campaign);
    }
    const selectedProductId = App.state.selectedResultProductId || null;
    if (selectedProductId) {
      const product = App.state.products.find(p => Number(p.id) === Number(selectedProductId));
      if (product) return this.productOverview(product);
    }
    return this.productList();
  },

  // V33.0.0 — Modo CLÁSSICO (legado): direto na lista de campanhas.
  _renderClassic() {
    const selectedAction = App.state.actions.find(action => Number(action.id) === Number(App.state.selectedActionId)) || null;
    if (selectedAction) {
      const campaign = App.state.campaigns.find(c => Number(c.id) === Number(selectedAction.campaignId));
      return this.detail(campaign, selectedAction);
    }
    const selectedCampaignId = App.state.selectedResultCampaignId || null;
    if (!selectedCampaignId) return this.campaignList();
    const campaign = App.state.campaigns.find(c => Number(c.id) === Number(selectedCampaignId));
    if (!campaign) return this.campaignList();
    return this.campaignOverview(campaign);
  },

  // V33.0.0 — Toggle modo clássico no header (mostra em qualquer nível).
  _modeToggle() {
    const isClassic = App.state.resultsClassicMode;
    return `<div class="flex justify-end mb-2">
      <button onclick="Actions.toggleResultsClassicMode()" class="px-3 py-1.5 rounded-xl ${isClassic ? 'bg-violet-100 text-violet-800' : 'bg-slate-100 text-slate-600'} hover:bg-slate-200 text-[11px] font-bold flex items-center gap-1.5">
        <i data-lucide="${isClassic ? 'sparkles' : 'undo-2'}" class="w-3 h-3"></i>
        ${isClassic ? 'Voltar ao novo (produto-first)' : 'Ver modo clássico'}
      </button>
    </div>`;
  },

  // V38.1.67 — Header dark unificado nos padrões dos outros menus (Produto /
  // Campanha / Ação / Execução). Selo + descrição geral + KPIs agregados de
  // todos os produtos visíveis (não-arquivados). Aparece nas 4 views da aba.
  resultLayer() {
    const products = (App.state.products || []).filter(p => p.archived !== true);
    const campaigns = (App.state.campaigns || []);
    const actions = (App.state.actions || []);
    let leads = 0, converted = 0;
    for (const a of actions) {
      leads += a.leads?.length || 0;
      converted += Number(FlowResolutionEngine.buildActionFlow(a).converted || 0);
    }
    const conversion = leads ? Math.round((converted / leads) * 1000) / 10 : 0;
    return `<div class="bg-slate-950 text-white rounded-[2rem] p-5 shadow-sm overflow-hidden relative">
      <div class="absolute inset-0 opacity-60" style="background: radial-gradient(circle at 18% 10%, rgba(244,63,94,.18), transparent 28%), radial-gradient(circle at 82% 20%, rgba(124,58,237,.16), transparent 30%);"></div>
      <div class="relative z-10 grid lg:grid-cols-[1.2fr_1fr] gap-4 items-center">
        <div>
          <div class="flex items-center gap-2 mb-3"><i data-lucide="trending-up" class="w-4 h-4"></i><p class="text-xs font-black text-slate-300 uppercase tracking-wider">Result Layer · Leitura consolidada</p></div>
          <p class="text-base text-slate-300 max-w-3xl leading-relaxed">O resultado é a leitura final do ciclo: funil consolidado por produto, drill-down por campanha e ação. Onde se responde "o que aconteceu e por causa do quê".</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          ${this._darkMetric('Produtos', products.length, 'box')}
          ${this._darkMetric('Campanhas', campaigns.length, 'megaphone')}
          ${this._darkMetric('Impactados', leads, 'users')}
          ${this._darkMetric('Conversão', `${conversion}%`, 'arrow-right-left')}
        </div>
      </div>
    </div>`;
  },

  _darkMetric(label, value, icon) {
    return `<div class="bg-white/10 border border-white/10 rounded-2xl p-4"><div class="flex items-center justify-between"><p class="text-xs font-black text-slate-300">${label}</p><i data-lucide="${icon}" class="w-4 h-4 text-slate-300"></i></div><div class="text-3xl font-black mt-2">${value}</div></div>`;
  },

  // V33.0.0 — Nível 0: lista de produtos com snapshot executivo.
  productList() {
    const products = (App.state.products || []).filter(p => p.archived !== true);
    return `<div class="space-y-3">
      ${this._modeToggle()}
      ${this.resultLayer()}
      ${window.FlowBreadcrumb ? FlowBreadcrumb.render('results') : ''}
      <div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
        <h2 class="text-xl font-black mb-1">Resultado por produto</h2>
        <p class="text-sm text-slate-500 mb-5">Escolha um produto pra ver o funil consolidado, performance das campanhas e atribuição de receita.</p>
        ${products.length === 0
          ? Components.empty('Cadastre um produto antes de ver resultados.')
          : `<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${products.map(p => this.productCard(p)).join('')}</div>`}
      </div>
    </div>`;
  },

  // V33.0.0 — Card de produto na lista (snapshot agregado de campanhas).
  productCard(product) {
    const campaigns = (App.state.campaigns || []).filter(c => Number(c.productId) === Number(product.id) && c.status !== 'Encerrada');
    const actions = (App.state.actions || []).filter(a => campaigns.some(c => Number(c.id) === Number(a.campaignId)));
    const summary = this._summaryFromActions(actions);
    // V39.1.0 — Aviso quando salesChannel não está definido (Forecast × Realizado
    // bloqueado até o cliente declarar). Aparece em pré-V39.1 e em produtos
    // antigos que ainda não passaram pelo force-prompt.
    const needsSalesChannel = product.audience && product.audience.configured && !product.audience.salesChannel;
    return `<button onclick="Actions.openResultProduct(${product.id})" class="text-left p-5 rounded-3xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition w-full">
      <div class="flex items-start justify-between gap-3 mb-4">
        <div class="min-w-0 flex-1">
          <p class="text-[10px] font-black text-violet-600 uppercase tracking-wider mb-0.5">Produto</p>
          <h3 class="font-black text-lg truncate">${Utils.escape(product.name || 'Sem nome')}</h3>
          <p class="text-xs text-slate-500 mt-1">${campaigns.length} campanha(s) ativa(s) · ${actions.length} ação(ões)</p>
        </div>
        <i data-lucide="arrow-right" class="w-4 h-4 text-slate-400"></i>
      </div>
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="bg-white rounded-2xl px-2 py-2"><div class="font-black text-base">${summary.impacted}</div><div class="text-[10px] text-slate-500">Impactados</div></div>
        <div class="bg-white rounded-2xl px-2 py-2"><div class="font-black text-base">${summary.converted}</div><div class="text-[10px] text-slate-500">Convertidos</div></div>
        <div class="bg-white rounded-2xl px-2 py-2"><div class="font-black text-base">${summary.conversion}%</div><div class="text-[10px] text-slate-500">Conversão</div></div>
      </div>
      ${needsSalesChannel ? `<div onclick="event.stopPropagation(); Actions.openAudienceWizardForExisting(${product.id})" class="mt-3 rounded-2xl bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 px-3 py-2 flex items-start gap-2 hover:bg-amber-100 transition">
        <i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-amber-700 mt-0.5 shrink-0"></i>
        <div class="min-w-0 flex-1">
          <p class="text-[11px] font-black text-amber-900 leading-tight">Forecast × Realizado bloqueado</p>
          <p class="text-[10px] text-amber-800 leading-tight mt-0.5">Defina como esse produto vende (checkout / CRM / híbrido).</p>
        </div>
        <span class="text-[10px] font-black text-amber-900 underline shrink-0">Definir →</span>
      </div>` : ''}
      ${this._forecastRealizadoMini(product)}
    </button>`;
  },

  // V39.2.0 — Bloco grande Forecast × Realizado no drill-down do produto.
  // Mostra Meta · Realizado · Projeção em régua expandida com semáforo, dias
  // restantes, ritmo necessário pra bater meta + Djow opinando (placeholder).
  _forecastRealizadoBlock(product) {
    if (!window.ForecastRealizadoEngine) return '';
    const f = ForecastRealizadoEngine.forProduct(product.id);
    if (!f) return '';
    if (f.status === 'blocked') return ''; // aviso âmbar abaixo cobre esse caso

    if (f.status === 'loading') {
      return `<div class="mb-5 rounded-3xl bg-slate-50 border-2 border-slate-200 border-l-8 border-l-slate-300 p-5 flex items-center gap-3">
        <div class="w-5 h-5 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin shrink-0"></div>
        <p class="text-sm text-slate-600">Carregando Forecast × Realizado…</p>
      </div>`;
    }
    if (f.status === 'pending') {
      const label = f.salesChannel === 'crm' ? 'Comercial via CRM' : 'Híbrido';
      return `<div class="mb-5 rounded-3xl bg-violet-50 border-2 border-violet-200 border-l-8 border-l-violet-500 p-5">
        <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest">Forecast × Realizado · ${Utils.escape(label)}</p>
        <h3 class="font-black text-lg text-violet-900 mt-1">Em breve — V39.3</h3>
        <p class="text-sm text-violet-900 leading-relaxed mt-1">Pra modo CRM/híbrido, o realizado vai vir do Fechamento mensal declarado por você + cruzamento com deals ganhos no RD. A próxima onda entrega esse caminho.</p>
      </div>`;
    }
    if (f.status === 'error') {
      return `<div class="mb-5 rounded-3xl bg-rose-50 border-2 border-rose-200 border-l-8 border-l-rose-500 p-5">
        <p class="text-[10px] font-black text-rose-700 uppercase tracking-widest">Forecast × Realizado</p>
        <p class="text-sm text-rose-900 mt-1">Erro ao carregar: ${Utils.escape(App.state.forecastRealizedCache?.error || 'desconhecido')}.</p>
        <button onclick="Actions.loadForecastRealizedSummary({force:true})" class="mt-2 px-3 py-1.5 rounded-xl bg-rose-700 text-white text-xs font-black hover:bg-rose-800" style="color:#fff!important;">Tentar de novo</button>
      </div>`;
    }
    if (f.meta <= 0) {
      return `<div class="mb-5 rounded-3xl bg-amber-50 border-2 border-amber-200 border-l-8 border-l-amber-500 p-5">
        <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest">Forecast × Realizado</p>
        <h3 class="font-black text-lg text-amber-900 mt-1">Defina a meta de vendas</h3>
        <p class="text-sm text-amber-900 leading-relaxed mt-1">Esse produto ainda não tem meta de vendas declarada nas ofertas. Vá em RevOps → Ofertas e preencha pra ver projeção × meta.</p>
        <button onclick="Actions.setTab('revops')" class="mt-3 px-4 py-2 rounded-2xl bg-amber-700 hover:bg-amber-800 text-white font-black text-sm" style="color:#fff!important;">Ir pra RevOps</button>
      </div>`;
    }

    const semColor = { green: 'emerald', amber: 'amber', red: 'rose', gray: 'slate' }[f.semaforo] || 'slate';
    const semLabel = { green: 'Vai bater a meta', amber: 'Risco de não bater', red: 'Não vai bater no ritmo atual', gray: '—' }[f.semaforo] || '';
    const daysRemaining = Math.max(0, f.daysInMonth - f.daysPassed);
    const restante = Math.max(0, f.meta - f.realized);
    const ritmoAtual = f.daysPassed > 0 ? f.realized / f.daysPassed : 0;
    const ritmoNecessario = daysRemaining > 0 ? restante / daysRemaining : 0;
    const ritmoDelta = ritmoAtual > 0 ? ((ritmoNecessario - ritmoAtual) / ritmoAtual) : 0;

    return `<div class="mb-5 rounded-3xl bg-${semColor}-50 border-2 border-${semColor}-200 border-l-8 border-l-${semColor}-500 p-5">
      <div class="flex items-start justify-between gap-3 mb-4">
        <div>
          <p class="text-[10px] font-black text-${semColor}-700 uppercase tracking-widest">Forecast × Realizado · ${f.yyyymm || ''}</p>
          <h3 class="font-black text-lg text-${semColor}-900 mt-0.5">${semLabel}</h3>
          <p class="text-xs text-slate-600 mt-1">Dia ${f.daysPassed} de ${f.daysInMonth} · ${daysRemaining} dia(s) restante(s) · ${f.approvedCount || 0} venda(s) processada(s)</p>
        </div>
        <button onclick="Actions.loadForecastRealizedSummary({force:true})" title="Recarregar do Hotmart" class="w-9 h-9 rounded-full bg-white border border-${semColor}-300 text-${semColor}-700 hover:bg-${semColor}-100 grid place-items-center"><i data-lucide="refresh-cw" class="w-4 h-4"></i></button>
      </div>

      <div class="grid grid-cols-3 gap-3 mb-4">
        <div class="bg-white rounded-2xl border border-${semColor}-200 px-3 py-3 text-center">
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Meta declarada</p>
          <p class="font-black text-2xl text-slate-900 mt-1">${ForecastRealizadoEngine.formatMoney(f.meta)}</p>
        </div>
        <div class="bg-white rounded-2xl border border-${semColor}-200 px-3 py-3 text-center">
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Realizado</p>
          <p class="font-black text-2xl text-slate-900 mt-1">${ForecastRealizadoEngine.formatMoney(f.realized)}</p>
          <p class="text-[10px] text-slate-500 mt-0.5">${f.progressPct}% da meta</p>
        </div>
        <div class="bg-white rounded-2xl border border-${semColor}-200 px-3 py-3 text-center">
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Projeção fim do mês</p>
          <p class="font-black text-2xl text-${semColor}-700 mt-1">${ForecastRealizadoEngine.formatMoney(f.projected)}</p>
          <p class="text-[10px] font-black text-${semColor}-700 mt-0.5">${ForecastRealizadoEngine.formatPct(f.variance)} vs meta</p>
        </div>
      </div>

      <div class="h-2 rounded-full bg-white/80 overflow-hidden mb-3">
        <div class="h-full bg-${semColor}-500 transition-all" style="width:${f.progressPct}%"></div>
      </div>

      <div class="rounded-2xl bg-white/60 border border-${semColor}-200 p-3">
        <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Diagnóstico</p>
        <p class="text-sm text-slate-800 leading-relaxed">
          ${f.semaforo === 'green'
            ? `<b>Você vai bater.</b> No ritmo atual de ${ForecastRealizadoEngine.formatMoney(ritmoAtual)}/dia, fecha em ${ForecastRealizadoEngine.formatMoney(f.projected)} — ${ForecastRealizadoEngine.formatPct(f.variance)} acima da meta.`
            : f.semaforo === 'amber'
              ? `<b>Apertou.</b> Falta ${ForecastRealizadoEngine.formatMoney(restante)} pra meta nos ${daysRemaining} dia(s) que restam. Precisa fechar ${ForecastRealizadoEngine.formatMoney(ritmoNecessario)}/dia — ${ritmoDelta > 0 ? `${Math.round(ritmoDelta * 100)}% acima` : `${Math.round(-ritmoDelta * 100)}% abaixo`} do ritmo atual.`
              : `<b>Não bate no ritmo atual.</b> Falta ${ForecastRealizadoEngine.formatMoney(restante)} pra meta e só ${daysRemaining} dia(s) restantes. Precisaria de ${ForecastRealizadoEngine.formatMoney(ritmoNecessario)}/dia — ${Math.round(ritmoDelta * 100)}% acima do ritmo atual de ${ForecastRealizadoEngine.formatMoney(ritmoAtual)}/dia.`
          }
        </p>
      </div>
    </div>`;
  },

  // V39.2.0 — Mini bloco Forecast × Realizado no card de produto da lista.
  // Mostra Meta · Realizado · Projeção em régua compacta com semáforo.
  // Pra modos crm/hybrid mostra placeholder; pra blocked nada (já tem aviso âmbar).
  _forecastRealizadoMini(product) {
    if (!window.ForecastRealizadoEngine) return '';
    const f = ForecastRealizadoEngine.forProduct(product.id);
    if (!f) return '';
    if (f.status === 'blocked') return '';
    if (f.status === 'loading') {
      return `<div class="mt-3 rounded-2xl bg-slate-50 border border-slate-200 border-l-4 border-l-slate-300 px-3 py-2 flex items-center gap-2">
        <div class="w-3 h-3 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin shrink-0"></div>
        <p class="text-[11px] text-slate-600">Carregando Forecast × Realizado…</p>
      </div>`;
    }
    if (f.status === 'pending') {
      const label = f.salesChannel === 'crm' ? 'CRM' : 'Híbrido';
      return `<div class="mt-3 rounded-2xl bg-violet-50 border border-violet-200 border-l-4 border-l-violet-500 px-3 py-2">
        <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest">Forecast × Realizado · ${label}</p>
        <p class="text-[10px] text-violet-900 mt-0.5 leading-tight">Em breve (V39.3): leitura do Fechamento mensal declarado + cruzamento com RD.</p>
      </div>`;
    }
    if (f.status === 'error') return '';
    if (f.meta <= 0) {
      return `<div class="mt-3 rounded-2xl bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 px-3 py-2">
        <p class="text-[10px] font-black text-amber-800 uppercase tracking-widest">Forecast × Realizado</p>
        <p class="text-[10px] text-amber-900 mt-0.5 leading-tight">Defina a meta de vendas nas ofertas do produto pra ver projeção.</p>
      </div>`;
    }
    const semColor = { green: 'emerald', amber: 'amber', red: 'rose', gray: 'slate' }[f.semaforo] || 'slate';
    return `<div class="mt-3 rounded-2xl bg-${semColor}-50 border border-${semColor}-200 border-l-4 border-l-${semColor}-500 px-3 py-2.5">
      <div class="flex items-center justify-between gap-2 mb-1.5">
        <p class="text-[10px] font-black text-${semColor}-800 uppercase tracking-widest">Forecast × Realizado · ${f.yyyymm || ''}</p>
        <span class="text-[10px] font-black text-${semColor}-800">${ForecastRealizadoEngine.formatPct(f.variance)}</span>
      </div>
      <div class="grid grid-cols-3 gap-1 text-center">
        <div>
          <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Meta</p>
          <p class="font-black text-xs text-slate-900 mt-0.5">${ForecastRealizadoEngine.formatMoney(f.meta)}</p>
        </div>
        <div>
          <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Realizado</p>
          <p class="font-black text-xs text-slate-900 mt-0.5">${ForecastRealizadoEngine.formatMoney(f.realized)}</p>
        </div>
        <div>
          <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Projeção</p>
          <p class="font-black text-xs text-${semColor}-700 mt-0.5">${ForecastRealizadoEngine.formatMoney(f.projected)}</p>
        </div>
      </div>
      <div class="mt-2 h-1.5 rounded-full bg-white/80 overflow-hidden">
        <div class="h-full bg-${semColor}-500" style="width:${f.progressPct}%"></div>
      </div>
      <p class="text-[9px] text-slate-500 mt-1 text-center">${f.daysPassed}/${f.daysInMonth} dias · ${f.approvedCount || 0} venda(s)</p>
    </div>`;
  },

  // V33.0.0 — Nível 1: Produto Overview (funil consolidado + lista campanhas).
  productOverview(product) {
    const campaigns = (App.state.campaigns || []).filter(c => Number(c.productId) === Number(product.id));
    const actions = (App.state.actions || []).filter(a => campaigns.some(c => Number(c.id) === Number(a.campaignId)));
    const summary = this._summaryFromActions(actions);

    // V33.0.0 Onda 3 — Auto-fetch atribuições pra Top Ações
    const attrCache = App.state.actionAttributionsCache;
    if (!attrCache?.loadedAt && !attrCache?.loading && window.Actions?.loadActionAttributions) {
      setTimeout(() => Actions.loadActionAttributions(30), 0);
    }
    // Pega top 5 ações atribuídas DESTE produto, ordenadas por customers→transitions
    const byId = attrCache?.byActionId || {};
    const productActionIds = new Set(actions.map(a => Number(a.id)));
    const topActions = Object.values(byId)
      .filter(a => productActionIds.has(Number(a.actionId)))
      .sort((a, b) => (b.customers - a.customers) || (b.transitions - a.transitions))
      .slice(0, 5);

    // V33.0.0 — Funil consolidado vindo do tracker (visitors deste produto)
    const counts = App.state.trackerVisitorsCache?.counts;
    const trackerFunnel = counts?.byEntityType || { suspect: 0, lead: 0, customer: 0 };
    const trackerTotal = counts?.total || 0;

    return `<div class="space-y-4">
      ${this._modeToggle()}
      ${this.resultLayer()}
      ${window.FlowBreadcrumb ? FlowBreadcrumb.render('results') : ''}
      <div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
        <button onclick="Actions.backToResultsProductList()" class="mb-4 px-4 py-2 rounded-2xl bg-slate-100 font-black text-sm">← Voltar para produtos</button>
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
          <div>
            <p class="text-xs font-black text-violet-600 uppercase tracking-wider">Produto</p>
            <h2 class="text-2xl font-black">${Utils.escape(product.name)}</h2>
            <p class="text-sm text-slate-500">Funil consolidado de todas as campanhas + ações deste produto.</p>
          </div>
        </div>

        ${this._forecastRealizadoBlock(product)}

        ${(product.audience && product.audience.configured && !product.audience.salesChannel) ? `<div class="mb-5 rounded-3xl bg-amber-50 border-2 border-amber-300 border-l-8 border-l-amber-500 p-5 flex items-start gap-4">
          <div class="w-12 h-12 rounded-2xl bg-amber-100 grid place-items-center shrink-0">
            <i data-lucide="alert-triangle" class="w-6 h-6 text-amber-700"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest">Forecast × Realizado bloqueado</p>
            <h3 class="font-black text-lg text-amber-900 mt-1">Defina como esse produto vende</h3>
            <p class="text-sm text-amber-900 leading-relaxed mt-1">Pra ver Forecast × Realizado, a gente precisa saber por onde fecha a venda — checkout (Hotmart pull) ou comercial via CRM (Fechamento mensal). Define a fonte do número e o ponto crítico do tenant.</p>
            <button onclick="Actions.openAudienceWizardForExisting(${product.id})" class="mt-3 px-4 py-2 rounded-2xl bg-amber-700 hover:bg-amber-800 text-white font-black text-sm flex items-center gap-2" style="color:#fff!important;">
              <i data-lucide="settings" class="w-4 h-4"></i> Definir agora
            </button>
          </div>
        </div>` : ''}

        <!-- Funil de suspects/leads/customers (tracker) -->
        ${trackerTotal > 0 ? `<div class="rounded-3xl bg-gradient-to-br from-violet-50 to-sky-50 border border-violet-200 p-4 mb-5">
          <p class="text-[11px] font-black text-violet-800 uppercase tracking-widest mb-3 inline-flex items-center gap-1.5">
            <i data-lucide="filter" class="w-3.5 h-3.5"></i> Funil real (tracker)
          </p>
          <div class="grid grid-cols-3 gap-3">
            <div class="bg-white rounded-2xl px-3 py-3 text-center">
              <div class="text-2xl font-black text-violet-700">${trackerFunnel.suspect}</div>
              <div class="text-[10px] font-bold text-slate-500 uppercase">Suspects</div>
            </div>
            <div class="bg-white rounded-2xl px-3 py-3 text-center">
              <div class="text-2xl font-black text-sky-700">${trackerFunnel.lead}</div>
              <div class="text-[10px] font-bold text-slate-500 uppercase">Leads</div>
            </div>
            <div class="bg-white rounded-2xl px-3 py-3 text-center">
              <div class="text-2xl font-black text-emerald-700">${trackerFunnel.customer}</div>
              <div class="text-[10px] font-bold text-slate-500 uppercase">Customers</div>
            </div>
          </div>
        </div>` : `<div class="rounded-3xl bg-slate-50 border border-slate-200 p-4 mb-5 text-center">
          <p class="text-[11px] text-slate-500 italic">Sem visitors rastreados ainda. Conecte LPs das campanhas pra ativar o funil.</p>
        </div>`}

        <!-- Métricas legadas (Analytics) -->
        <div class="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
          ${Components.resultMetric('Campanhas', campaigns.length)}
          ${Components.resultMetric('Ações', actions.length)}
          ${Components.resultMetric('Impactados', summary.impacted)}
          ${Components.resultMetric('Convertidos', summary.converted)}
          ${Components.resultMetric('Conversão', `${summary.conversion}%`)}
          ${Components.resultMetric('Score médio', summary.avgScore)}
        </div>

        <!-- V33.0.0 Onda 3 — Top ações por atribuição causal (30d) -->
        ${topActions.length > 0 ? `<div class="rounded-3xl bg-white border border-emerald-200 p-4 mb-5">
          <h3 class="font-black text-base mb-3 inline-flex items-center gap-2 text-emerald-800">
            <i data-lucide="award" class="w-4 h-4"></i> Top ações por movimentação · últimos 30 dias
          </h3>
          <div class="space-y-2">
            ${topActions.map((a, idx) => {
              const action = actions.find(x => Number(x.id) === Number(a.actionId));
              if (!action) return '';
              const lastAt = a.lastAttributedAt ? new Date(a.lastAttributedAt).toLocaleDateString('pt-BR') : '—';
              return `<button onclick="Actions.openActionResult(${action.id})" class="w-full text-left flex items-center justify-between gap-3 p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <span class="shrink-0 w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-black grid place-items-center" style="color:#fff!important;">${idx + 1}</span>
                  <div class="min-w-0">
                    <p class="font-black text-sm text-emerald-900 truncate">${Utils.escape(action.name || 'Sem nome')}</p>
                    <p class="text-[10px] text-emerald-700/70 truncate">${Utils.escape(action.channel || '—')} · último atribuído: ${lastAt}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  ${a.customers > 0 ? `<span class="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-black" style="color:#fff!important;">${a.customers} CUST</span>` : ''}
                  <span class="px-2 py-1 rounded bg-sky-100 border border-sky-300 text-sky-800 text-[10px] font-black">${a.transitions} MOV</span>
                </div>
              </button>`;
            }).join('')}
          </div>
        </div>` : ''}

        <!-- Lista de campanhas (drill-down) -->
        <h3 class="font-black text-lg mb-3 mt-5">Campanhas do produto</h3>
        ${campaigns.length === 0
          ? Components.empty('Nenhuma campanha cadastrada para este produto.')
          : `<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${campaigns.map(c => this.campaignCard(c, actions.filter(a => Number(a.campaignId) === Number(c.id)))).join('')}</div>`}
      </div>
    </div>`;
  },

  _actionsByCampaign() {
    const map = new Map();
    for (const action of (App.state.actions || [])) {
      const key = Number(action.campaignId);
      const bucket = map.get(key);
      if (bucket) bucket.push(action);
      else map.set(key, [action]);
    }
    return map;
  },

  campaignList() {
    const activeCampaigns = App.state.campaigns.filter(campaign => campaign.status !== 'Encerrada');
    const actionsByCampaign = this._actionsByCampaign();
    return `<div class="space-y-4">
      ${this.resultLayer()}
      ${window.FlowBreadcrumb ? FlowBreadcrumb.render('results') : ''}
      <div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
        <h2 class="text-xl font-black mb-1">Resultado da campanha</h2>
        <p class="text-sm text-slate-500 mb-5">Escolha uma campanha ativa para ver o resultado consolidado e navegar pelas ações plugadas.</p>
        <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${activeCampaigns.map(campaign => this.campaignCard(campaign, actionsByCampaign.get(Number(campaign.id)) || [])).join('') || Components.empty('Nenhuma campanha ativa encontrada.')}</div>
      </div>
    </div>`;
  },

  campaignCard(campaign, actions) {
    if (!actions) actions = App.state.actions.filter(action => Number(action.campaignId) === Number(campaign.id));
    const summary = this._summaryFromActions(actions);
    const product = App.state.products.find(p => Number(p.id) === Number(campaign.productId));
    return `<button onclick="Actions.openCampaignResults(${campaign.id})" class="text-left p-5 rounded-3xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition">
      <div class="flex items-start justify-between gap-3 mb-4"><div><p class="text-xs font-black text-slate-500">${Utils.escape(product?.name || 'Produto não vinculado')}</p><h3 class="font-black text-lg">${Utils.escape(campaign.name)}</h3><p class="text-sm text-slate-500 mt-1">${Utils.escape(campaign.objective || 'Sem objetivo descrito')}</p></div><span class="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-black">${Utils.escape(campaign.status || 'Ativa')}</span></div>
      <div class="grid grid-cols-3 gap-2 text-center"><div class="bg-white rounded-2xl px-3 py-2"><div class="font-black">${actions.length}</div><div class="text-xs text-slate-500">Ações</div></div><div class="bg-white rounded-2xl px-3 py-2"><div class="font-black">${summary.impacted}</div><div class="text-xs text-slate-500">Impactados</div></div><div class="bg-white rounded-2xl px-3 py-2"><div class="font-black">${summary.conversion}%</div><div class="text-xs text-slate-500">Conversão</div></div></div>
    </button>`;
  },

  campaignOverview(campaign) {
    const actions = App.state.actions.filter(action => Number(action.campaignId) === Number(campaign.id));
    const summary = this._summaryFromActions(actions);
    return `<div class="space-y-4">
      ${this.resultLayer()}
      ${window.FlowBreadcrumb ? FlowBreadcrumb.render('results') : ''}
      <div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
        <button onclick="Actions.backToResultsCampaignList()" class="mb-4 px-4 py-2 rounded-2xl bg-slate-100 font-black text-sm">← Voltar ${App.state.resultsClassicMode ? 'para campanhas' : 'para o produto'}</button>
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5"><div><p class="text-xs font-black text-slate-500">Resultado consolidado da campanha</p><h2 class="text-2xl font-black">${Utils.escape(campaign.name)}</h2><p class="text-sm text-slate-500">Compilando todos os resultados das ações plugadas à campanha antes da leitura individual.</p></div><button onclick="Actions.openCampaignFlowModal(${campaign.id})" class="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black text-sm">Ver Fluxo da Campanha</button></div>
        <div class="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">${Components.resultMetric('Ações', actions.length)}${Components.resultMetric('Impactados', summary.impacted)}${Components.resultMetric('Convertidos', summary.converted)}${Components.resultMetric('Conversão', `${summary.conversion}%`)}${Components.resultMetric('Score médio', summary.avgScore)}${Components.resultMetric('OKRs únicos', summary.groupedOkrs.length)}</div>
        <div class="grid lg:grid-cols-2 gap-4">
          <div class="bg-slate-50 rounded-3xl p-4 border border-slate-100"><h3 class="font-black text-lg mb-3">OKRs consolidados da campanha</h3><div class="space-y-2 max-h-72 overflow-auto">${summary.groupedOkrs.map(item => this.groupedOkrRow(item)).join('') || Components.empty('Nenhum OKR encontrado nas ações.')}</div></div>
          <div class="bg-slate-50 rounded-3xl p-4 border border-slate-100"><h3 class="font-black text-lg mb-3">Ações plugadas</h3><div class="space-y-3">${actions.map(action => this.actionCard(action)).join('') || Components.empty('Nenhuma ação plugada nesta campanha.')}</div></div>
        </div>
      </div>
      ${CampaignFlowModal.render()}
    </div>`;
  },

  groupedOkrRow(item) {
    return `<div class="bg-white rounded-2xl p-3 border border-slate-100 flex items-center justify-between gap-3"><div><p class="font-black text-sm">${Utils.escape(item.name)}</p><p class="text-xs text-slate-500">${item.count} ocorrência(s) • ${Utils.escape(item.stages.join(', ') || 'sem vínculo')}</p></div><div class="text-right"><div class="text-xl font-black">${item.current}${Utils.escape(item.unit || '')}</div><div class="text-xs text-slate-500">meta ${item.target}${Utils.escape(item.unit || '')}</div></div></div>`;
  },

  campaignSummary(campaignId) {
    return this._summaryFromActions(App.state.actions.filter(action => Number(action.campaignId) === Number(campaignId)));
  },

  _summaryFromActions(actions) {
    let impacted = 0, converted = 0;
    const allLeads = [];
    for (const action of actions) {
      const flow = FlowResolutionEngine.buildActionFlow(action);
      impacted += Number(flow.impacted || 0);
      converted += Number(flow.converted || 0);
      const leadsScored = ScoreEngine.actionLeads(action);
      for (const lead of leadsScored) allLeads.push(lead);
    }
    const conversion = impacted ? Math.round((converted / impacted) * 1000) / 10 : 0;
    let sumScore = 0;
    for (const lead of allLeads) sumScore += Number(lead.score || 0);
    const avgScore = allLeads.length ? Math.round(sumScore / allLeads.length) : 0;
    return { impacted, converted, conversion, avgScore, groupedOkrs: this.groupOkrs(actions) };
  },

  groupOkrs(actions) {
    const map = {};
    for (const action of actions) {
      const okrs = action.okrs || [];
      for (const okr of okrs) {
        const key = String(okr.name || '').trim().toLowerCase();
        if (!key) continue;
        let bucket = map[key];
        if (!bucket) {
          bucket = { name: String(okr.name || '').trim(), current: 0, target: 0, unit: okr.unit || '', count: 0, stages: [] };
          map[key] = bucket;
        }
        bucket.current += Number(String(okr.current || '0').replace(',', '.')) || 0;
        bucket.target += Number(String(okr.target || '0').replace(',', '.')) || 0;
        bucket.count += 1;
        const stageLabel = okr.stageId ? FlowResolutionEngine.label(okr.stageId) : '';
        if (stageLabel && !bucket.stages.includes(stageLabel)) bucket.stages.push(stageLabel);
      }
    }
    return Object.values(map);
  },

  actionCard(action) {
    const result = Analytics.actionResult(action);
    const score = ScoreEngine.getById(action.scoreId);
    const flow = FlowResolutionEngine.buildActionFlow(action);
    return `<div onclick="Actions.openActionResult(${action.id})" class="cursor-pointer p-4 rounded-3xl bg-white border border-slate-100 hover:bg-slate-50 transition"><div class="flex flex-col md:flex-row md:items-center justify-between gap-3"><div><h3 class="font-black text-lg">${Utils.escape(action.name)}</h3><p class="text-sm text-slate-500">${Utils.escape(action.channel)} • ${result.total} leads • ${flow.converted} convertidos • score médio ${result.avgScore} • ${Utils.escape(score?.name || 'sem score')}</p></div><div class="grid grid-cols-3 gap-2 text-center"><div class="bg-slate-50 rounded-2xl px-3 py-2"><div class="font-black">${result.cold}</div><div class="text-xs text-slate-500">Frios</div></div><div class="bg-slate-50 rounded-2xl px-3 py-2"><div class="font-black">${result.warm}</div><div class="text-xs text-slate-500">Mornos</div></div><div class="bg-slate-50 rounded-2xl px-3 py-2"><div class="font-black">${result.hot}</div><div class="text-xs text-slate-500">Quentes</div></div></div></div></div>`;
  },

  detail(campaign, action) {
    const result = Analytics.actionResult(action);
    const score = ScoreEngine.getById(action.scoreId);
    const flow = FlowResolutionEngine.buildActionFlow(action);
    const rate = flow.impacted ? Math.round((flow.converted / flow.impacted) * 1000) / 10 : 0;
    return `<div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><button onclick="Actions.backToCampaignResults()" class="mb-4 px-4 py-2 rounded-2xl bg-slate-100 font-black text-sm">← Voltar para ações da campanha</button><div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5"><div><p class="text-xs font-black text-slate-500">${Utils.escape(campaign?.name || 'Campanha')}</p><h2 class="text-2xl font-black">${Utils.escape(action.name)}</h2><p class="text-sm text-slate-500">Resultado local desta ação usando ${Utils.escape(score?.name || 'score não encontrado')}.</p></div><div class="flex gap-2"><button onclick="Actions.openCampaignFlowModal(${campaign?.id || 0})" class="px-4 py-2 rounded-2xl bg-slate-900 text-white font-black text-sm">Roadmap</button><span class="px-4 py-2 rounded-2xl bg-slate-100 font-black text-sm">${Utils.escape(action.channel)}</span></div></div><div class="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">${Components.resultMetric('Leads', result.total)}${Components.resultMetric('Convertidos', flow.converted)}${Components.resultMetric('Conversão', `${rate}%`)}${Components.resultMetric('Score médio', result.avgScore)}${Components.resultMetric('Mornos', result.warm)}${Components.resultMetric('Quentes', result.hot)}</div>${this.deepFunnel(result)}<div class="mt-5 bg-slate-900 text-white rounded-3xl p-5"><h3 class="font-black text-lg mb-2">Próximo movimento</h3><p class="text-sm text-slate-300 mb-4">A partir deste resultado, a próxima etapa será criar uma nova ação ligada à mesma campanha.</p><button onclick="Actions.prepareNextActionFromResult(${action.id})" class="px-5 py-3 rounded-2xl bg-white text-slate-900 font-black">Criar nova ação a partir deste resultado</button></div></div>`;
  },

  deepFunnel(result) {
    const stages = [{ name: 'Entrada', count: result.total, desc: 'Leads recebidos pela ação' }, { name: 'Abertura', count: result.opened, desc: 'Leads que abriram comunicação' }, { name: 'Leitura', count: result.read, desc: 'Leads que consumiram conteúdo' }, { name: 'CTA', count: result.cta, desc: 'Leads com intenção mais forte' }];
    return `<div class="grid lg:grid-cols-3 gap-4"><div class="bg-slate-50 rounded-3xl p-4 border border-slate-100"><h3 class="font-black text-lg mb-3">Funil da ação</h3><div class="space-y-3">${stages.map(stage => `<div class="bg-white rounded-2xl p-4 border border-slate-100"><div class="flex items-center justify-between gap-3"><div><p class="font-black">${stage.name}</p><p class="text-xs text-slate-500">${stage.desc}</p></div><div class="text-2xl font-black">${stage.count}</div></div></div>`).join('')}</div></div><div class="lg:col-span-2 bg-slate-50 rounded-3xl p-4 border border-slate-100"><h3 class="font-black text-lg mb-3">Estágio por lead</h3><div class="space-y-2 max-h-96 overflow-auto">${result.leads.map(lead => `<div class="bg-white rounded-2xl p-3 border border-slate-100 flex items-center justify-between gap-3"><div><p class="font-black text-sm">${Utils.escape(lead.name)}</p><p class="text-xs text-slate-500">${Utils.escape(lead.email || 'sem email')} • ${Utils.escape(lead.tags || 'sem tags')}</p></div><div class="text-right"><div class="font-black">${this.leadStage(lead)}</div><div class="text-xs text-slate-500">score ${lead.score || 0}</div></div></div>`).join('')}</div></div></div>`;
  },
  leadStage(lead) { const tags = String(lead.tags || '').toLowerCase(); if (tags.includes('#cta')) return 'CTA'; if (tags.includes('#read')) return 'Leitura'; if (tags.includes('#open')) return 'Abertura'; return 'Entrada'; }
};
window.ResultModule = ResultModule;
