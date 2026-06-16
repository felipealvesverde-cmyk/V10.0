var ProductsModule = {
  render() {
    const selected = this.selectedProduct();
    return `<div class="space-y-4">
      ${this.hero(selected)}
      <div class="grid lg:grid-cols-[600px_1fr] gap-4 items-stretch">
        ${this.createPanel()}
        ${this.productsPanel()}
      </div>
      ${this.cxDormantLayer()}
      ${CampaignFlowModal.render()}
      ${this.editProductModal()}
      ${this.productTotalFlowModal()}
      ${this.productCampaignsModal()}
      ${window.CampaignModule?.editCampaignModal ? CampaignModule.editCampaignModal() : ''}
      ${window.StrategicMapModal ? StrategicMapModal.render() : ''}
      ${this.newProductWithMapaPopup()}
      ${window.HealthScoreModal ? HealthScoreModal.render() : ''}
      ${window.ProductAudienceModal ? ProductAudienceModal.render() : ''}
    </div>`;
  },

  // V31.2.5 — Popup curto pra criar produto JÁ no fluxo Mapa da Receita.
  // Pede só o nome (e opcionalmente tipo + recorrência). Confirmar cria o
  // produto e abre o Mapa direto na etapa Visão.
  newProductWithMapaPopup() {
    const draft = App.state.newProductWithMapaPopup;
    if (!draft || !draft.open) return '';
    return `<div class="fixed inset-0 z-[95] bg-slate-950/85 backdrop-blur-sm grid place-items-center p-4">
      <div class="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden">
        <header class="p-5 text-white" style="background:linear-gradient(135deg, #7C3AED, #4F46E5);">
          <div class="flex items-center gap-2 mb-2"><i data-lucide="compass" class="w-4 h-4"></i><p class="text-[11px] font-black uppercase tracking-wider opacity-90">Estratégico-primeiro</p></div>
          <h3 class="text-xl font-black">Criar Produto com Mapa da Receita</h3>
          <p class="text-xs opacity-90 mt-1">Vamos começar pelo essencial e seguir direto pra Visão.</p>
        </header>
        <div class="p-5 space-y-3">
          <div>
            <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Nome do produto</label>
            <input value="${Utils.escape(draft.name || '')}" oninput="Actions.updateNewProductWithMapaField('name', this.value)" autofocus placeholder="Ex: Diagnóstico Comercial" class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-100 border border-slate-200 font-semibold text-slate-900" />
          </div>
          <div>
            <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Audiência (ICP)</label>
            ${this._mapaPopupAudienceButton(draft)}
          </div>
          <div>
            <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Recorrência</label>
            <select onchange="Actions.updateNewProductWithMapaField('revenueModel', this.value)" class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-100 border border-slate-200 font-semibold text-slate-900">
              <option value="Venda única" ${(draft.revenueModel || 'Venda única') === 'Venda única' ? 'selected' : ''}>Venda única</option>
              <option value="Recorrente" ${draft.revenueModel === 'Recorrente' ? 'selected' : ''}>Recorrente</option>
            </select>
          </div>
          <div class="rounded-xl bg-indigo-50 border border-indigo-200 p-3 text-[11px] text-indigo-900 flex items-start gap-2">
            <i data-lucide="info" class="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-600"></i>
            <p>Próximo passo: você cai direto no <b>Mapa da Receita</b> pra definir a Visão, as 3 frentes (Mkt/Vendas/CS) e os números. Resto dos dados financeiros você completa depois.</p>
          </div>
        </div>
        <footer class="border-t border-slate-100 p-4 flex justify-end gap-2 bg-slate-50">
          <button onclick="Actions.closeNewProductWithMapaPopup()" class="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs">Cancelar</button>
          <button onclick="Actions.confirmNewProductWithMapa()" class="px-4 py-2.5 rounded-2xl text-white font-black text-xs flex items-center gap-1.5" style="background:linear-gradient(135deg, #7C3AED, #4F46E5); color:#fff!important;">
            <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i> Criar e ir pra Visão
          </button>
        </footer>
      </div>
    </div>`;
  },

  selectedProduct() {
    return App.state.products.find(product => Number(product.id) === Number(App.state.selectedProductId)) || App.state.products[0] || null;
  },

  operationalFlowRail(product) {
    const activeProduct = product ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200';
    return `<div class="lj-operational-rail bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
      <div class="lj-flow-rail-grid text-sm" style="display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important;align-items:stretch!important;width:100%!important;">
        <button onclick="App.setTab('products')" style="min-height:88px!important;width:100%!important;display:grid!important;grid-template-columns:36px minmax(0,1fr)!important;gap:10px!important;align-items:center!important;justify-content:initial!important;text-align:left!important;" class="px-4 py-3 rounded-2xl border ${activeProduct} font-black text-left lj-flow-step"><span class="lj-flow-step-number">1</span><span><span class="lj-flow-step-title">Produto</span><span class="lj-flow-step-subtitle">Cadastro e revenue</span></span></button>
        <button onclick="${product ? `Actions.goToProductCampaigns(${product.id})` : `App.setTab('campaigns')`}" style="min-height:88px!important;width:100%!important;display:grid!important;grid-template-columns:36px minmax(0,1fr)!important;gap:10px!important;align-items:center!important;justify-content:initial!important;text-align:left!important;" class="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-black text-left lj-flow-step"><span class="lj-flow-step-number">2</span><span><span class="lj-flow-step-title">Campanhas</span><span class="lj-flow-step-subtitle">Vinculadas ao produto</span></span></button>
        <button onclick="App.setTab('actions')" style="min-height:88px!important;width:100%!important;display:grid!important;grid-template-columns:36px minmax(0,1fr)!important;gap:10px!important;align-items:center!important;justify-content:initial!important;text-align:left!important;" class="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-black text-left lj-flow-step"><span class="lj-flow-step-number">3</span><span><span class="lj-flow-step-title">Ações</span><span class="lj-flow-step-subtitle">Execução operacional</span></span></button>
        <button onclick="App.setTab('results')" style="min-height:88px!important;width:100%!important;display:grid!important;grid-template-columns:36px minmax(0,1fr)!important;gap:10px!important;align-items:center!important;justify-content:initial!important;text-align:left!important;" class="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-black text-left lj-flow-step"><span class="lj-flow-step-number">4</span><span><span class="lj-flow-step-title">Leitura</span><span class="lj-flow-step-subtitle">Resultado da campanha</span></span></button>
      </div>
    </div>`;
  },

  productCampaigns(productId) {
    return App.state.campaigns.filter(campaign => Number(campaign.productId) === Number(productId));
  },

  productActions(productId) {
    const campaignIds = new Set(this.productCampaigns(productId).map(campaign => Number(campaign.id)));
    return App.state.actions.filter(action => campaignIds.has(Number(action.campaignId)));
  },

  // V38.0.2 — Hero agora é OVERVIEW agregado de TODOS os produtos (não do
  // selecionado). Antes mostrava "Atira.Pro" + métricas do produto vigente —
  // mas a aba se chama "Produtos" (plural) e o card individual já vive abaixo.
  // KPIs: Produtos / Campanhas / Ações / Execuções (total/done).
  // "Conversão de Vendas" agregada vem em V38.x quando integração checkout
  // for refinada (hoje "—").
  hero(product) {
    const agg = OperationalAggregationEngine.aggregateAll();
    const execLabel = agg.executionsTotal > 0
      ? `${agg.executionsTotal}/${agg.executionsDone}`
      : '0';
    // V38.1.10 — Header da aba já mostra "Produtos" grande, e os 4 KPI cards
    // à direita já trazem os números. Hero do módulo fica enxuto: só selo +
    // subtítulo descrevendo a camada + cards (sem título redundante).
    return `<div class="bg-slate-950 text-white rounded-[2rem] p-5 shadow-sm overflow-hidden relative">
      <div class="absolute inset-0 opacity-60" style="background: radial-gradient(circle at 20% 10%, rgba(59,130,246,.20), transparent 28%), radial-gradient(circle at 80% 20%, rgba(16,185,129,.16), transparent 30%);"></div>
      <div class="relative z-10 grid lg:grid-cols-[1.2fr_1fr] gap-4 items-center">
        <div>
          <div class="flex items-center gap-2 mb-3"><i data-lucide="box" class="w-4 h-4"></i><p class="text-xs font-black text-slate-300 uppercase tracking-wider">Revenue Layer · Visão consolidada</p></div>
          <p class="text-base text-slate-300 max-w-3xl leading-relaxed">O produto é onde o Revenue Operation (operação de receita) começa: ancora Mapa da Receita, ofertas, campanhas, custos e leitura de saúde.</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          ${this.darkMetric('Produtos', agg.productsCount, 'box')}
          ${this.darkMetric('Campanhas', agg.campaigns, 'megaphone')}
          ${this.darkMetric('Ações', agg.actions, 'activity')}
          ${this.darkMetric('Execuções', execLabel, 'check-circle')}
        </div>
      </div>
    </div>`;
  },

  createPanel() {
    const d = App.state.productDraft || {};
    return `<div class="flex flex-col gap-3 h-full">
      <!-- V31.2.4 — Caminho recomendado: criar produto JÁ ligado ao Mapa da Receita -->
      <button onclick="Actions.openNewProductWithMapaPopup()" class="w-full px-5 py-4 rounded-3xl text-white font-black flex items-center justify-center gap-3 shadow-md hover:shadow-lg transition shrink-0" style="background:linear-gradient(135deg, #7C3AED, #4F46E5); color:#fff!important;">
        <i data-lucide="compass" class="w-5 h-5"></i>
        <span class="text-base">Criar Produto com Mapa da Receita</span>
        <span class="text-[10px] font-bold opacity-80 ml-1">recomendado</span>
      </button>

      <!-- V38.1.4 — Coluna de 600px (dobrou pra ficar mais respirável).
           Card "Criar sem Mapa" estica via flex-1 pra alinhar com o card
           de Produtos Criados ao lado. Botão Criar cola no fim. -->
      <div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex-1 flex flex-col gap-3">
        <div>
          <h2 class="text-xl font-black leading-tight">Criar Produto sem Mapa</h2>
          <p class="text-[12px] text-slate-500 leading-snug mt-1">Cadastro puro — preço, modelo, custo. Sem Visão / KRs / rollup. <span class="text-amber-700 font-bold">Considere o caminho violeta acima pra conectar estratégia desde o início.</span></p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] font-black text-slate-500 uppercase tracking-wide">Nome</label>
            <input value="${Utils.escape(d.name || '')}" oninput="App.state.productDraft.name=this.value; App.save();" placeholder="Ex: Diagnóstico Comercial" class="w-full px-3 py-2.5 rounded-xl bg-slate-100 font-semibold text-sm" />
          </div>
          <div>
            <label class="text-[10px] font-black text-slate-500 uppercase tracking-wide">Audiência (ICP)</label>
            ${this._draftAudienceButton(d)}
          </div>
          <div class="col-span-2">
            <label class="text-[10px] font-black text-slate-500 uppercase tracking-wide">Recorrência</label>
            <select onchange="App.state.productDraft.revenueModel=this.value; App.save();" class="w-full px-3 py-2.5 rounded-xl bg-slate-100 font-semibold text-sm">
              <option value="Venda única" ${(d.revenueModel || 'Venda única') === 'Venda única' ? 'selected' : ''}>Venda única</option>
              <option value="Recorrente" ${d.revenueModel === 'Recorrente' ? 'selected' : ''}>Recorrente</option>
            </select>
          </div>
        </div>
        <!-- Spacer pra empurrar botão pra base e alinhar com o card de Produtos Criados -->
        <div class="flex-1"></div>
        <button onclick="Actions.createProduct()" style="color:#fff!important;" class="w-full px-4 py-3 rounded-xl bg-slate-900 text-white font-black text-sm lj-dark-button shrink-0">Criar Produto sem Mapa</button>
      </div>
    </div>`;
  },

  productsPanel() {
    // V32.5.7 — Produtos arquivados não aparecem nas listas principais.
    // Gerenciamento (reativar/deletar) em Configurações → Minha Conta → Produtos.
    const visible = (App.state.products || []).filter(p => !p.archived);
    // V38.1.5 — h-full + flex pra alinhar com o card de Criar à esquerda
    // (items-stretch no grid mantém os 2 com mesma altura).
    return `<div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 h-full flex flex-col">
      <div class="flex items-start justify-between gap-3 mb-5 shrink-0"><div><h2 class="text-xl font-black mb-1">Produtos Criados</h2><p class="text-sm text-slate-500">Clique em um produto para selecionar.</p></div><div class="text-3xl font-black">${visible.length}</div></div>
      <div class="space-y-3 overflow-auto flex-1">${visible.map(product => this.productCard(product)).join('')}</div>
    </div>`;
  },

  productCard(product) {
    const summary = ProductRevenueEngine.summary(product.id);
    const selected = Number(product.id) === Number(App.state.selectedProductId);
    // V32.12.0 — Leonardo: card produto ganha left-border violet (cor RevOps)
    // pra ancorar visualmente com as campanhas filhas (que também tem accent
    // violet quando estratégicas). Selo "Produto" no header. KPI boxes com
    // left-border tone consistente (violet/sky/emerald).
    return `<div onclick="Actions.selectProduct(${product.id})" class="lj-product-created-card relative w-full text-left p-4 rounded-3xl border border-l-4 ${selected ? 'border-slate-900 border-l-violet-600 bg-slate-50 ring-2 ring-slate-900/5' : 'border-slate-200 border-l-violet-500 bg-white'} hover:bg-slate-50 transition cursor-pointer">
      <button onclick="event.stopPropagation(); Actions.openProductEditModal(${product.id})" title="Editar Produto" aria-label="Editar Produto" class="absolute top-3 right-3 w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 grid place-items-center shadow-sm"><i data-lucide="settings" class="w-4 h-4"></i></button>
      <div class="flex flex-col gap-4">
        <div class="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-3 pr-12">
          <div class="min-w-0">
            <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest mb-0.5">Produto</p>
            <div class="flex items-center gap-2 mb-1 flex-wrap">
              <h3 class="font-black text-xl leading-tight break-words text-slate-900">${Utils.escape(product.name)}</h3>
              ${selected ? '<span class="shrink-0 px-2 py-0.5 rounded-md bg-violet-500/15 border border-violet-400/30 text-violet-700 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> Selecionado</span>' : ''}
              ${this._audienceBadge(product)}
            </div>
            <p class="text-sm text-slate-500">${Utils.escape(product.type || 'Produto')} • ${Utils.escape(product.revenueModel || 'Venda única')}</p>
          </div>
          <div class="grid grid-cols-3 gap-2 w-full xl:w-[320px] shrink-0">
            <div class="bg-white rounded-2xl border border-slate-200 border-l-4 border-l-violet-500 px-3 py-2 text-center">
              <div class="text-[9px] font-black text-violet-700 uppercase tracking-widest">Campanhas</div>
              <div class="font-black text-lg text-slate-900 mt-0.5">${summary.campaigns}</div>
            </div>
            <div class="bg-white rounded-2xl border border-slate-200 border-l-4 border-l-sky-500 px-3 py-2 text-center">
              <div class="text-[9px] font-black text-sky-700 uppercase tracking-widest">Ações</div>
              <div class="font-black text-lg text-slate-900 mt-0.5">${summary.actions}</div>
            </div>
            <div class="bg-white rounded-2xl border border-slate-200 border-l-4 border-l-emerald-500 px-3 py-2 text-center">
              <div class="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Execuções</div>
              <div class="font-black text-lg text-slate-900 mt-0.5">${summary.executionsTotal || 0}/${summary.executionsDone || 0}</div>
            </div>
          </div>
        </div>
        ${this._healthScoreRow(product)}
        ${this._strategicMapSummary(product)}
        ${this._audienceSummary(product)}
        ${this._audienceCollectionHealth(product)}
        ${this._audienceCta(product)}
        <div class="lj-product-card-actions grid grid-cols-2 gap-2">
          <button onclick="event.stopPropagation(); Actions.prepareCampaignForProduct(${product.id})" style="color:#fff!important;" class="px-3 py-2 rounded-2xl bg-slate-900 text-white text-xs font-black lj-dark-button">Criar Campanha para este produto</button>
          <button onclick="event.stopPropagation(); Actions.openStrategicMap(${product.id})" style="color:#0f172a!important;" class="lj-strategic-map-btn px-3 py-1.5 rounded-2xl border-2 border-slate-900 bg-transparent hover:bg-slate-100 text-xs font-black transition leading-tight flex flex-col items-center justify-center"><span style="color:#0f172a!important;">Mapa da Receita</span><span style="color:#0f172a!important;" class="text-[9px] font-bold opacity-70 -mt-0.5">OKR's</span></button>
        </div>
      </div>
    </div>`;
  },

  // V38.1.38 — Botão de Audiência no popup "Criar Produto com Mapa".
  // Mesmo padrão do form sem-mapa: pré-submit, salva em popup.audience.
  _mapaPopupAudienceButton(draft) {
    const a = (draft && draft.audience) || null;
    if (a && a.configured) {
      const tags = [a.modeloNegocio, a.modeloOperacional].filter(Boolean).map(s => String(s).toUpperCase()).join(' · ');
      return `<button onclick="Actions.openAudienceWizardForMapaPopup()" class="mt-1 w-full px-4 py-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 text-emerald-900 font-black text-sm text-left flex items-center justify-between gap-2 hover:bg-emerald-100 transition">
        <span class="flex items-center gap-1.5 min-w-0"><i data-lucide="target" class="w-4 h-4 shrink-0"></i><span class="truncate">ICP ${Utils.escape(tags)}</span></span>
        <span class="text-xs font-bold opacity-70 shrink-0">Editar</span>
      </button>`;
    }
    return `<button onclick="Actions.openAudienceWizardForMapaPopup()" class="mt-1 w-full px-4 py-3 rounded-2xl border-2 border-amber-300 bg-amber-50 text-amber-900 font-black text-sm text-left flex items-center justify-between gap-2 hover:bg-amber-100 transition">
      <span class="flex items-center gap-1.5 min-w-0"><i data-lucide="alert-triangle" class="w-4 h-4 shrink-0"></i><span class="truncate">Definir audiência</span></span>
      <span class="text-xs font-bold opacity-70 shrink-0">Obrigatório</span>
    </button>`;
  },

  // V38.1.37 — Botão de Audiência no form "Criar Produto sem Mapa".
  // Substitui o campo "Tipo" (que era redundante com Modelo Negócio +
  // Operacional do wizard). Pré-submit: cliente define o ICP no draft e
  // só depois o botão "Criar Produto sem Mapa" libera.
  _draftAudienceButton(d) {
    const a = (d && d.audience) || null;
    if (a && a.configured) {
      const tags = [a.modeloNegocio, a.modeloOperacional].filter(Boolean).map(s => String(s).toUpperCase()).join(' · ');
      return `<button onclick="Actions.openAudienceWizardForDraft()" class="w-full px-3 py-2.5 rounded-xl border-2 border-emerald-300 bg-emerald-50 text-emerald-900 font-black text-xs text-left flex items-center justify-between gap-2 hover:bg-emerald-100 transition">
        <span class="flex items-center gap-1.5 min-w-0"><i data-lucide="target" class="w-3.5 h-3.5 shrink-0"></i><span class="truncate">ICP ${Utils.escape(tags)}</span></span>
        <span class="text-[10px] font-bold opacity-70 shrink-0">Editar</span>
      </button>`;
    }
    return `<button onclick="Actions.openAudienceWizardForDraft()" class="w-full px-3 py-2.5 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-900 font-black text-xs text-left flex items-center justify-between gap-2 hover:bg-amber-100 transition">
      <span class="flex items-center gap-1.5 min-w-0"><i data-lucide="alert-triangle" class="w-3.5 h-3.5 shrink-0"></i><span class="truncate">Definir audiência</span></span>
      <span class="text-[10px] font-bold opacity-70 shrink-0">Obrigatório</span>
    </button>`;
  },

  // V38.1.46 — Saúde da coleta: mostra cobertura agregada e top campos
  // mais bloqueados no produto. Aparece logo abaixo do summary.
  _audienceCollectionHealth(product) {
    if (!product?.audience?.configured) return '';
    if (!window.AudienceCollectionAdvisor) return '';
    const health = AudienceCollectionAdvisor.productCollectionHealth(product.id);
    if (!health || !health.totalFields) return '';
    const tone = health.coveragePct >= 70 ? 'emerald' : health.coveragePct >= 40 ? 'amber' : 'rose';
    const top3 = (health.bloqueados || []).slice(0, 3).map(b => {
      const meta = b.strategyMeta || {};
      return `<div class="flex items-center gap-1.5 text-[10px]">
        <i data-lucide="${meta.icon || 'help-circle'}" class="w-2.5 h-2.5 text-${meta.tone || 'slate'}-600 shrink-0"></i>
        <span class="text-slate-700 truncate flex-1">${Utils.escape(b.label)}</span>
        <span class="font-black text-${b.pctMissing >= 80 ? 'rose' : b.pctMissing >= 50 ? 'amber' : 'slate'}-700 shrink-0">${b.pctMissing}% sem dado</span>
      </div>`;
    }).join('');
    return `<div class="rounded-2xl border border-slate-200 bg-white px-3 py-2 space-y-1.5">
      <div class="flex items-center gap-2">
        <i data-lucide="lightbulb" class="w-3.5 h-3.5 text-${tone}-600 shrink-0"></i>
        <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest flex-1">Saúde da coleta</p>
        <span class="text-[10px] font-black text-${tone}-700">${health.coveragePct}% cobertos</span>
      </div>
      <div class="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div class="h-full bg-${tone}-500" style="width:${health.coveragePct}%;"></div>
      </div>
      ${top3 ? `<div class="space-y-0.5 pt-1">${top3}</div>` : ''}
      ${(health.bloqueados || []).length ? `<p class="text-[9px] text-slate-400 italic pt-1">Clique numa badge de camada no lead pra ver sugestões de coleta detalhadas.</p>` : ''}
    </div>`;
  },

  // V38.1.41 — Sumário de transmutação de audiência no card do produto.
  // Mostra distribuição Suspect/PA/ICP/BP dos leads vinculados às campanhas
  // do produto. Só aparece se: audience configurada + tem leads.
  _audienceSummary(product) {
    if (!product?.audience?.configured) return '';
    if (!window.AudienceTransmutationEngine) return '';
    const s = AudienceTransmutationEngine.summarize(product.id);
    if (!s || !s.total) return '';
    const pct = (n) => Math.round((n / s.total) * 100);
    const seg = (label, n, tone) => n > 0
      ? `<div class="flex-1 min-w-0" style="flex-grow:${n};" title="${label}: ${n} (${pct(n)}%)"><div class="h-2 rounded-full bg-${tone}-500"></div><div class="text-[9px] font-black text-${tone}-700 uppercase tracking-wider mt-0.5 truncate">${label} ${n}</div></div>`
      : '';
    return `<div class="rounded-2xl border border-slate-200 bg-white px-3 py-2">
      <div class="flex items-center justify-between mb-1.5">
        <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest">Audiência (${s.total} leads)</p>
        <p class="text-[9px] font-bold text-slate-400">Limiar 80%</p>
      </div>
      <div class="flex items-stretch gap-1">
        ${seg('Suspect', s.suspect, 'slate')}
        ${seg('PA',      s.pa,      'violet')}
        ${seg('ICP',     s.icp,     'pink')}
        ${seg('BP',      s.bp,      'amber')}
      </div>
    </div>`;
  },

  // V38.1.36 — Badge de status do ICP no header do card.
  _audienceBadge(product) {
    const a = product.audience || {};
    if (a.configured) {
      const tags = [a.modeloNegocio, a.modeloOperacional].filter(Boolean).map(s => s.toUpperCase()).join(' · ');
      return `<span class="shrink-0 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-700 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1"><i data-lucide="target" class="w-3 h-3"></i> ICP${tags ? ' · ' + Utils.escape(tags) : ''}</span>`;
    }
    return `<span class="shrink-0 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-400/40 text-amber-800 text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-1"><i data-lucide="alert-triangle" class="w-3 h-3"></i> ICP não definido</span>`;
  },

  // V38.1.36 — CTA pra Definir/Editar Audiência. Aparece sempre — pra produto
  // novo já criado sem audience (legacy), aparece como CTA bloqueante visível.
  _audienceCta(product) {
    const a = product.audience || {};
    if (a.configured) {
      return `<button onclick="event.stopPropagation(); Actions.openAudienceWizardForExisting(${product.id})" class="w-full text-left px-3 py-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 text-emerald-800 text-xs font-black flex items-center justify-between hover:bg-emerald-100/60 transition">
        <span class="flex items-center gap-1.5"><i data-lucide="target" class="w-3.5 h-3.5"></i> Editar audiência (ICP)</span>
        <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
      </button>`;
    }
    return `<button onclick="event.stopPropagation(); Actions.openAudienceWizardForExisting(${product.id})" class="w-full text-left px-3 py-2 rounded-2xl border-2 border-amber-300 bg-amber-50 text-amber-900 text-xs font-black flex items-center justify-between hover:bg-amber-100 transition">
      <span class="flex items-center gap-1.5"><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> Definir audiência (ICP) — obrigatório</span>
      <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
    </button>`;
  },

  // V38.1.0 — Linha de Saúde do Produto no card. Score 0-100 + barra +
  // label do gargalo + "?" pra abrir modal explicador.
  // V38.1.4 — Estado "em construção" pra produto recém-criado.
  _healthScoreRow(product) {
    if (!window.HealthScoreEngine) return '';
    const h = HealthScoreEngine.compute(product.id);
    const tone = h.tier.color;  // violet (construindo) / emerald / amber / orange / rose
    const pct = Math.max(0, Math.min(100, h.score));
    return `<div class="rounded-2xl border border-l-4 border-l-${tone}-500 bg-${tone}-50/60 border-${tone}-200 px-3 py-2 flex items-center gap-3">
      <div class="shrink-0">
        <div class="text-[9px] font-black text-${tone}-700 uppercase tracking-widest">Saúde</div>
        ${h.isBuilding
          ? '<div class="font-black text-xl text-slate-900 leading-none mt-0.5">🚧</div>'
          : `<div class="font-black text-xl text-slate-900 leading-none mt-0.5">${h.score}<span class="text-[10px] text-slate-400 font-bold">/100</span></div>`}
      </div>
      <div class="flex-1 min-w-0">
        <div class="h-2 w-full bg-${tone}-100 rounded-full overflow-hidden">
          <div class="h-full bg-${tone}-500 rounded-full" style="width:${pct}%;"></div>
        </div>
        <p class="text-[10px] font-bold text-slate-600 mt-1 truncate">
          ${h.isBuilding
            ? `<span class="text-${tone}-800">Em construção</span> · vamos cadastrar as primeiras peças?`
            : `${h.tier.label} · gargalo: <span class="text-${tone}-800">${Utils.escape(h.gargalo.label)}</span>`}
        </p>
      </div>
      <button onclick="event.stopPropagation(); Actions.openHealthScoreModal(${product.id})"
        class="shrink-0 w-7 h-7 rounded-full bg-white border border-${tone}-300 text-${tone}-700 hover:bg-${tone}-100 grid place-items-center text-xs font-black"
        title="Por que esta Saúde?">?</button>
    </div>`;
  },

  // V28.4.0 — Resumo do Mapa da Receita inline no card de produto.
  // Mostra objetivo + 3 frentes com KRs confirmados + progresso médio.
  _strategicMapSummary(product) {
    if (!window.StrategicMapEngine) return '';
    const map = StrategicMapEngine.getForProduct(product.id);
    const vision = String(map?.vision || '').trim();
    const areas = StrategicMapEngine.COMERCIAL_AREAS || [];
    // V38.1.6 — Junta legado V28 + branches V29 (mesmo bug do healthScoreEngine).
    // Antes lia só map.objectives e cards mostravam "pendente" mesmo com 7 KRs
    // confirmados em branches.
    const legacyObjectives = map?.objectives || [];
    const branches = (typeof StrategicMapEngine.getBranchesByProduct === 'function')
      ? StrategicMapEngine.getBranchesByProduct(product.id) || []
      : [];
    // V38.1.14 — O Mapa mostra os productKrs (KR-mãe do produto), não os
    // childKrs das branches. Diagnóstico do Felipe: branches tinham 5 mkt
    // (4 órfãos) + 1 sales + 0 cs. Mas o Mapa mostra 1+3+3=7 productKrs.
    // Card e Saúde devem refletir o que o Mapa mostra → productKrs.
    const productKrs = map?.productKrs || [];
    const objectives = [
      ...legacyObjectives,
      ...branches.flatMap(b => b.objectives || [])
    ];
    const allKrs = productKrs;
    const confirmedKrs = allKrs;  // qualquer KR-mãe criado conta
    const snapshot = StrategicMapEngine.snapshot(product.id);
    if (!vision && !confirmedKrs.length) {
      return `<div class="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-[12px] text-amber-800 flex items-center justify-between gap-2">
        <span>📋 Mapa da Receita ainda não foi preenchido para este produto.</span>
        <button onclick="event.stopPropagation(); Actions.openStrategicMap(${product.id})" class="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black" style="color:#fff!important;">Começar →</button>
      </div>`;
    }
    return `<div class="rounded-2xl bg-slate-100 border border-slate-200 p-3 space-y-2">
      ${vision ? `<p class="text-[12px] text-slate-700"><b class="text-slate-900">🎯 Objetivo:</b> ${Utils.escape(vision.length > 120 ? vision.slice(0, 120) + '…' : vision)}</p>` : '<p class="text-[12px] text-amber-700">⚠️ Objetivo do produto ainda não definido.</p>'}
      <div class="grid grid-cols-3 gap-2">
        ${areas.map(area => {
          // V38.1.18 — Conta KR-mãe da área. Sem cruzamentos.
          const krsArea = productKrs.filter(k => String(k.area || '').toLowerCase() === area.id);
          const totalKrs = krsArea.length;
          const status = totalKrs > 0 ? `${totalKrs} KR${totalKrs === 1 ? '' : 's'}` : 'pendente';
          const tone = totalKrs > 0
            ? `bg-${area.color}-100 border-${area.color}-300 text-${area.color}-900 hover:bg-${area.color}-200`
            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50';
          return `<button type="button" onclick="event.stopPropagation(); Actions.openProductAreaInMap(${product.id}, '${area.id}')" class="rounded-xl border ${tone} p-2 text-center transition cursor-pointer" title="${Utils.escape(area.description)}">
            <p class="text-[10px] font-black uppercase tracking-wider">${Utils.escape(area.label)}</p>
            <p class="text-[11px] mt-0.5 font-bold">${status}</p>
          </button>`;
        }).join('')}
      </div>
      <p class="text-[11px] text-slate-500 text-right">Progresso médio: <b class="text-slate-900">${snapshot.avgProgress}%</b></p>
    </div>`;
  },

  productTotalFlowModal() {
    if (!App.state.showProductTotalFlowModal) return '';
    const products = App.state.products || [];
    const selectedId = App.state.productTotalFlowProductId;
    const product = products.find(item => Number(item.id) === Number(selectedId)) || null;
    const campaigns = product ? this.productCampaigns(product.id) : [];
    const actions = product ? this.productActions(product.id) : [];
    const totalLeads = actions.reduce((sum, action) => sum + (action.leads?.length || 0), 0);
    const totalConverted = actions.reduce((sum, action) => sum + (FlowResolutionEngine.buildActionFlow(action).converted || 0), 0);
    const conversion = totalLeads ? Math.round((totalConverted / totalLeads) * 1000) / 10 : 0;
    const opportunities = Math.round(totalConverted * 0.28);
    const headerText = product
      ? `Produto selecionado: ${Utils.escape(product.name)} <span class="mx-3">•</span> ${campaigns.length} campanha(s) <span class="mx-3">•</span> ${actions.length} ação(ões)`
      : 'Selecione um produto no Mapa Geral dos Produtos para consolidar campanhas, ações e KPIs.';
    return `<div class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm p-4 overflow-auto"><main class="min-h-full"><section class="rounded-[2rem] overflow-hidden shadow-2xl text-white" style="background: radial-gradient(circle at 18% 10%, rgba(124,58,237,.22), transparent 30%), radial-gradient(circle at 82% 0%, rgba(14,165,233,.16), transparent 32%), #071326;"><header class="p-6 lg:p-7 border-b border-white/10"><div class="flex flex-col xl:flex-row xl:items-start justify-between gap-5"><div><div class="flex flex-wrap items-center gap-3 mb-3"><h2 class="text-3xl lg:text-4xl font-black tracking-tight">Fluxo Total de Produtos</h2><span class="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 text-xs font-bold">${product ? Utils.escape(product.revenueModel || 'Venda única') : `${products.length} produto(s)`}</span></div><p class="text-slate-300 text-sm">${headerText}</p></div><div class="flex flex-wrap gap-3"><button onclick="Actions.closeProductTotalFlowModal()" class="px-5 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white flex items-center gap-2 text-sm font-semibold"><i data-lucide="x" class="w-4 h-4"></i> Fechar</button>${product ? `<button onclick="Actions.closeProductTotalFlowModal(); Actions.openProductEditModal(${product.id})" class="px-5 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white flex items-center gap-2 text-sm font-semibold"><i data-lucide="pencil" class="w-4 h-4"></i> Editar Produto</button>` : ''}</div></div></header><div class="p-5 lg:p-7 space-y-5"><section class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">${this.flowMetric('Campanhas', product ? campaigns.length : '—', 'megaphone')}${this.flowMetric('Ações', product ? actions.length : '—', 'activity')}${this.flowMetric('Leads Impactados', product ? totalLeads : '—', 'users')}${this.flowMetric('Leads Convertidos', product ? totalConverted : '—', 'arrow-right-left')}${this.flowMetric('Oportunidades', product ? opportunities : '—', 'dollar-sign')}${this.flowMetric('Conversão Total', product ? `${conversion}%` : '—', 'trending-up')}</section><section class="grid xl:grid-cols-[340px_1fr] gap-5"><aside class="rounded-[1.75rem] p-4 border border-white/10 bg-white/[0.055] backdrop-blur-xl"><div class="flex items-center justify-between mb-4"><h3 class="text-lg font-black">Campanhas do Produto</h3><span class="text-xs text-slate-400">${product ? `${campaigns.length} campanhas` : 'aguardando seleção'}</span></div><div class="space-y-3">${product ? (campaigns.map(campaign => this.flowCampaignCard(campaign)).join('') || '<p class="text-sm text-slate-400">Este produto ainda não possui campanhas vinculadas.</p>') : '<div class="rounded-[22px] p-4 bg-white/[0.04] border border-white/10"><p class="text-sm text-slate-300 font-bold">Selecione um produto para trazer as campanhas.</p><p class="text-xs text-slate-500 mt-1">A lista será carregada conforme o produto escolhido no Mapa Geral dos Produtos.</p></div>'}</div></aside><section class="rounded-[1.75rem] overflow-hidden border border-white/10 bg-white/[0.055] backdrop-blur-xl"><div class="flex flex-col xl:flex-row xl:items-start justify-between p-5 border-b border-white/10 gap-4"><div><h3 class="text-xl font-black">Mapa Geral dos Produtos</h3><p class="text-sm text-slate-400 mt-1">Selecione um produto para consolidar campanhas, ações, leads, oportunidades e conversão total.</p></div><div class="text-xs text-slate-300 font-bold">${products.length} produto(s) cadastrados</div></div><div class="p-5"><div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">${products.map(item => this.totalFlowProductCard(item, selectedId)).join('') || '<p class="text-sm text-slate-400">Nenhum produto cadastrado.</p>'}</div></div></section></section><section class="grid md:grid-cols-4 gap-3">${this.flowInsight('Produto consolidado', product?.name || 'Nenhum produto selecionado', product?.grossMargin || '—', 'Margem estimada do produto')}${this.flowInsight('Campanhas ligadas', product ? `${campaigns.length} campanha(s)` : 'Selecione um produto', product ? campaigns.length : '—', 'Total vinculado ao produto')}${this.flowInsight('Volume total', product ? `${totalLeads} leads` : 'Selecione um produto', product ? `${conversion}%` : '—', 'Conversão consolidada')}${this.flowInsight('Insight RevOps', product ? (actions.length ? 'Produto possui leitura operacional consolidada por campanhas.' : 'Produto ainda precisa de ações para leitura completa.') : 'Escolha um produto para ativar a leitura RevOps.', 'IA', 'KPIs somados de todas as campanhas')}</section></div></section></main></div>`;
  },

  totalFlowProductCard(product, selectedId) {
    const summary = ProductRevenueEngine.summary(product.id);
    const selected = Number(product.id) === Number(selectedId);
    return `<button onclick="Actions.selectProductInTotalFlow(${product.id})" class="text-left rounded-[24px] p-4 border ${selected ? 'border-emerald-300 bg-emerald-400/10' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]'} transition"><div class="flex items-start justify-between gap-3"><div><p class="text-base font-black text-white leading-tight">${Utils.escape(product.name)}</p><p class="text-xs text-slate-400 mt-1">${Utils.escape(product.type || 'Produto')} • ${Utils.escape(product.revenueModel || 'Venda única')}</p></div><span class="px-2 py-1 rounded-full text-[10px] font-black ${selected ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/10 text-slate-300'}">${selected ? 'Selecionado' : 'Selecionar'}</span></div><div class="grid grid-cols-3 gap-2 mt-4 text-xs"><div class="rounded-2xl bg-white/[0.055] p-2"><p class="text-slate-500">Campanhas</p><p class="font-black text-white">${summary.campaigns}</p></div><div class="rounded-2xl bg-white/[0.055] p-2"><p class="text-slate-500">Ações</p><p class="font-black text-white">${summary.actions}</p></div><div class="rounded-2xl bg-white/[0.055] p-2"><p class="text-slate-500">Conversão</p><p class="font-black text-white">${summary.conversion}%</p></div></div></button>`;
  },

  flowMetric(label, value, icon) { return `<div class="rounded-2xl p-4 flex items-center justify-between gap-4 border border-white/10 bg-white/[0.055] backdrop-blur-xl"><div><p class="text-xs text-slate-400 font-bold">${label}</p><p class="text-2xl font-black mt-1">${Utils.escape(value)}</p></div><div class="w-11 h-11 rounded-2xl bg-white/10 grid place-items-center text-violet-300"><i data-lucide="${icon}"></i></div></div>`; },

  flowCampaignCard(campaign) {
    const actions = App.state.actions.filter(action => Number(action.campaignId) === Number(campaign.id));
    const leads = actions.reduce((sum, action) => sum + (action.leads?.length || 0), 0);
    const media = Number(campaign.mediaInvestment || 0);
    const mediaLabel = media > 0 ? `R$ ${Math.round(media).toLocaleString('pt-BR')}` : '—';
    return `<button onclick="Actions.openCampaignFlowModal(${campaign.id})" class="w-full text-left min-h-[104px] rounded-[22px] p-4 bg-white/[0.04] border border-white/10 hover:bg-violet-500/10 hover:border-violet-400/40 transition"><div class="flex items-start justify-between gap-3 mb-2"><div><p class="font-black text-sm text-white">${Utils.escape(campaign.name)}</p><p class="text-xs text-slate-400 mt-1">${Utils.escape(campaign.status || 'Ativa')} • ${actions.length} ação(ões)</p></div><span class="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10">${leads} leads</span></div><div class="grid grid-cols-3 gap-2 text-xs mt-3"><div><p class="text-slate-500">Ações</p><p class="font-black">${actions.length}</p></div><div><p class="text-slate-500">Mídia</p><p class="font-black">${mediaLabel}</p></div><div><p class="text-slate-500">Fluxo</p><p class="font-black">Ver</p></div></div></button>`;
  },

  productFlowRow(action) {
    const flow = FlowResolutionEngine.buildActionFlow(action);
    const active = new Set(flow.path);
    const campaign = App.state.campaigns.find(item => Number(item.id) === Number(action.campaignId));
    return `<div class="grid gap-3 items-center relative" style="grid-template-columns:190px repeat(9,118px); min-width:1270px;"><div class="pr-2"><p class="text-sm font-black text-white leading-tight">${Utils.escape(action.name)}</p><p class="text-xs text-slate-400 mt-1">${Utils.escape(campaign?.name || 'Sem campanha')}</p></div>${CampaignFlowModal.stages.map(stageId => this.productFlowCell(action, stageId, flow, active)).join('')}</div>`;
  },

  productFlowCell(action, stageId, flow, active) {
    if (!active.has(stageId)) return `<div class="h-[88px] rounded-[22px] grid place-items-center text-slate-700 border border-white/10 bg-white/[0.03]">—</div>`;
    const step = flow.steps.find(s => s.stageId === stageId);
    const color = step.isDestination ? 'emerald' : step.isHandoff ? 'amber' : step.isOrigin ? 'violet' : 'sky';
    return `<button class="h-[88px] rounded-[22px] grid place-items-center text-center relative border border-${color}-400/70 bg-${color}-500/20"><div><p class="text-[10px] font-black uppercase text-${color}-300">${step.isOrigin ? 'Origem' : step.isDestination ? 'Destino' : step.isHandoff ? 'Handoff' : 'Passagem'}</p><p class="text-xl font-black text-white mt-1">${new Intl.NumberFormat('pt-BR').format(step.converted)}</p><p class="text-[10px] text-slate-300 mt-1">${stageId.replace('-', ' ').toUpperCase()}</p></div>${step.drop ? `<span class="absolute right-[-12px] bottom-[-14px] z-10 bg-red-900/90 border border-dashed border-red-400 text-red-100 text-[10px] font-black px-2 py-1 rounded-full">drop ${step.conversionRate}%</span>` : ''}</button>`;
  },

  flowInsight(title, body, value, sub) { return `<button class="rounded-2xl p-4 text-left hover:bg-white/10 transition border border-white/10 bg-white/[0.055]"><div class="flex items-center justify-between gap-3 mb-2"><p class="text-sm font-black text-amber-200">${Utils.escape(title)}</p><span class="text-xl font-black text-amber-300">${Utils.escape(value)}</span></div><p class="text-sm text-slate-200">${Utils.escape(body)}</p><p class="text-xs text-slate-400 mt-1">${Utils.escape(sub)}</p></button>`; },


  productCampaignsModal() {
    const product = (App.state.products || []).find(item => Number(item.id) === Number(App.state.productCampaignsModalId));
    if (!App.state.showProductCampaignsModal || !product) return '';
    const campaigns = this.productCampaigns(product.id);
    return `<div class="fixed inset-0 z-[999] bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div class="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-4xl mx-auto mt-8 overflow-hidden">
        <header class="bg-slate-900 text-white p-5 flex items-start justify-between gap-3">
          <div><p class="text-xs font-black text-slate-300 uppercase tracking-wider">Campanhas vinculadas ao produto</p><h3 class="text-2xl font-black">${Utils.escape(product.name)}</h3><p class="text-sm text-slate-300 mt-1">Lista operacional das campanhas criadas para este produto.</p></div>
          <button onclick="Actions.closeProductCampaignsModal()" class="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-black text-xl">×</button>
        </header>
        <div class="p-5 space-y-4">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            ${Components.resultMetric('Campanhas', campaigns.length)}
            ${Components.resultMetric('Preço', product.price)}
            ${Components.resultMetric('Modelo', product.revenueModel)}
            ${Components.resultMetric('Margem', product.grossMargin)}
          </div>
          <div class="bg-slate-50 rounded-3xl p-4 border border-slate-100">
            <h3 class="font-black text-lg mb-3">Campanhas</h3>
            <div class="space-y-3">${campaigns.map(campaign => this.campaignRow(campaign)).join('') || Components.empty('Nenhuma campanha vinculada a este produto.')}</div>
          </div>
          <div class="flex flex-col md:flex-row justify-end gap-2">
            <button onclick="Actions.closeProductCampaignsModal()" class="px-5 py-3 rounded-2xl bg-slate-100 text-slate-700 font-black">Fechar</button>
            <button onclick="event.stopPropagation(); Actions.prepareCampaignForProduct(${product.id})" style="color:#fff!important;" class="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black lj-dark-button">Criar campanha para este produto</button>
          </div>
        </div>
      </div>
    </div>`;
  },

  campaignRow(campaign) {
    const actions = App.state.actions.filter(action => Number(action.campaignId) === Number(campaign.id));
    return `<div onclick="Actions.goToCampaignActions(${campaign.id})" class="bg-white rounded-2xl p-3 border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer hover:bg-slate-50 transition"><div><p class="font-black text-sm">${Utils.escape(campaign.name)}</p><p class="text-xs text-slate-500">${actions.length} ação(ões) • ${Utils.escape(campaign.status || 'Ativa')}</p></div><div class="flex flex-wrap gap-2"><button onclick="event.stopPropagation(); Actions.openCampaignEditModal(${campaign.id})" class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-black">Editar</button><button onclick="event.stopPropagation(); Actions.prepareActionForCampaign(${campaign.id})" style="color:#fff!important;" class="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-black lj-dark-button">Ações</button><button onclick="event.stopPropagation(); Actions.goToCampaignResults(${campaign.id})" class="px-3 py-2 rounded-xl bg-slate-100 text-xs font-black">Resultados</button><button onclick="event.stopPropagation(); Actions.openCampaignFlowModal(${campaign.id})" ${actions.length ? '' : 'disabled'} style="color:#fff!important;" class="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-black disabled:bg-slate-200 disabled:text-slate-500 lj-dark-button">Fluxo</button></div></div>`;
  },

  revopsInsight(title, text) {
    return `<div class="bg-white rounded-2xl p-4 border border-slate-100"><p class="font-black text-sm">${Utils.escape(title)}</p><p class="text-xs text-slate-500 mt-1">${Utils.escape(text)}</p></div>`;
  },

  darkMetric(label, value, icon) { return `<div class="bg-white/10 border border-white/10 rounded-2xl p-4"><div class="flex items-center justify-between"><p class="text-xs font-black text-slate-300">${label}</p><i data-lucide="${icon}" class="w-4 h-4 text-slate-300"></i></div><div class="text-3xl font-black mt-2">${value}</div></div>`; },

  editProductModal() {
    const product = (App.state.products || []).find(item => Number(item.id) === Number(App.state.editProductId));
    if (!App.state.showProductEditModal || !product) return '';
    const model = product.revenueModel || 'Venda única';
    return `<div class="fixed inset-0 z-[999] bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div class="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-2xl mx-auto mt-8 overflow-hidden">
        <header class="bg-slate-900 text-white p-5 flex items-start justify-between gap-3">
          <div><p class="text-xs font-black text-slate-300 uppercase tracking-wider">Editar produto</p><h3 class="text-2xl font-black">${Utils.escape(product.name)}</h3></div>
          <button onclick="Actions.closeProductEditModal()" class="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-black text-xl">×</button>
        </header>
        <div class="p-5 grid md:grid-cols-2 gap-3">
          <div class="md:col-span-2"><label class="text-xs font-black text-slate-500">Nome do produto</label><input value="${Utils.escape(product.name || '')}" oninput="Actions.updateEditingProductField('name', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" /></div>
          <div><label class="text-xs font-black text-slate-500">Tipo de produto</label><input value="${Utils.escape(product.type || '')}" oninput="Actions.updateEditingProductField('type', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" /></div>
          <div><label class="text-xs font-black text-slate-500">Preço</label><input value="${Utils.escape(product.price || '')}" oninput="Actions.updateEditingProductField('price', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" /></div>
          <div><label class="text-xs font-black text-slate-500">Recorrência ou venda única</label><select onchange="Actions.updateEditingProductField('revenueModel', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold"><option value="Venda única" ${model === 'Venda única' ? 'selected' : ''}>Venda única</option><option value="Recorrente" ${model === 'Recorrente' ? 'selected' : ''}>Recorrente</option></select></div>
          <div><label class="text-xs font-black text-slate-500">Custo operacional</label><input value="${Utils.escape(product.operationalCost || '')}" oninput="Actions.updateEditingProductField('operationalCost', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" /></div>
          <div class="md:col-span-2 flex flex-col md:flex-row gap-2 justify-end pt-2 border-t border-slate-100">
            ${/* V32.5.7 — Deletar redireciona pra Configurações → Minha Conta →
                 Produtos (não deleta inline). Caminho centralizado de gerenciamento
                 destrutivo no Minha Conta. */ ''}
            <button onclick="Actions.archiveProduct(${product.id})" class="px-4 py-3 rounded-2xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 font-black text-sm flex items-center gap-1.5"><i data-lucide="archive" class="w-4 h-4"></i>Arquivar</button>
            <button onclick="Actions.goToMyAccountProductsForDelete(${product.id})" class="px-4 py-3 rounded-2xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-black text-sm flex items-center gap-1.5" title="Abre Minha Conta → Produtos com flow de delete pré-aberto"><i data-lucide="trash-2" class="w-4 h-4"></i>Deletar…</button>
            <div class="flex-1"></div>
            <button onclick="Actions.closeProductEditModal()" class="px-5 py-3 rounded-2xl bg-slate-100 text-slate-700 font-black">Cancelar</button>
            <button onclick="Actions.saveProductEdit()" style="color:#fff!important;" class="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black lj-dark-button">Salvar Produto</button>
          </div>
        </div>
      </div>
    </div>`;
  },

  cxDormantLayer() {
    return `<div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><div class="flex items-start gap-3"><div class="w-10 h-10 rounded-2xl bg-slate-900 text-white grid place-items-center"><i data-lucide="route" class="w-5 h-5"></i></div><div><h3 class="font-black text-lg">CX Governance — estrutura base</h3><p class="text-sm text-slate-500">Camada paralela ao RevOps preparada para projetos de melhoria e gestão de mudança. Nesta versão fica apenas estruturada, sem botões operacionais habilitados.</p></div></div></div>`;
  }
};
window.ProductsModule = ProductsModule;
