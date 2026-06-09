// V35.3.3 — Google Ads Dashboard.
// V35.7.0-alpha1 — 2 sub-abas (Overview + Não associadas) lendo de cache.
// V35.7.1 — 3 sub-abas:
//   - 'overview' (Visão Geral nova): compilado dos 25 indicadores de TODAS
//     as ads associadas. Toggle "incluir não associadas" agrega órfãs também.
//     Grupo 3 (avançados) atrás de botão expansível.
//   - 'linked' (Associadas): a antiga visão geral. Cards por Campanha LJ
//     com linhas das ads dentro. Cada linha agora é expansível, mostra
//     Grupo 2 + botão "Avançados" → abre modal com 25 indicadores.
//   - 'orphans' (Não associadas): idêntica ao que era.
// V35.7.1 — Hero do card com texto branco (era slate-900 ilegível no fundo
// translúcido sobre app dark).

window.GoogleAdsDashboard = {
  render() {
    // Auto-load mock se nunca carregou.
    if (App.state.googleAdsCampaignsCache === null && window.Actions?.loadGoogleAdsCampaigns) {
      setTimeout(() => Actions.loadGoogleAdsCampaigns(), 0);
    }

    const subTab = App.state.googleAdsDashboardSubTab || 'overview';
    const allAds = Array.isArray(App.state.googleAdsCampaignsCache) ? App.state.googleAdsCampaignsCache : [];
    const isMock = Boolean(App.state.googleAdsCampaignsAreMock);
    const realEmpty = Boolean(App.state.googleAdsCampaignsRealEmpty); // V36.8.6

    // V36.8.6 — Empty state explícito quando sync rodou mas conta tem 0 campanhas.
    // Antes caía pro mock e confundia (Sansone reportou 2026-06-09).
    if (realEmpty) {
      return `<div class="space-y-4">
        ${this._hero(false, 0)}
        ${this._emptyStateRealEmpty()}
      </div>`;
    }

    const ljCampaigns = Array.isArray(App.state.campaigns) ? App.state.campaigns : [];
    const linkedExternalIds = new Set();
    ljCampaigns.forEach(c => (c.externalLinks?.googleAds || []).forEach(id => linkedExternalIds.add(String(id))));

    const orphans = allAds.filter(a => !linkedExternalIds.has(String(a.campaign_id)));
    const linked = allAds.filter(a =>  linkedExternalIds.has(String(a.campaign_id)));

    return `<div class="space-y-4">
      ${this._hero(isMock, orphans.length)}
      ${this._subTabsBar(subTab, orphans.length)}
      ${subTab === 'overview' ? this._renderOverview(linked, orphans)
        : subTab === 'orphans' ? this._renderOrphans(orphans)
        : this._renderLinked(linked, ljCampaigns)}
    </div>`;
  },

  // V36.8.6 — Empty state pra conta conectada mas sem campanhas no Google Ads.
  // Mostra: customer ativo + última sync + explicação clara + CTA pra sincronizar.
  _emptyStateRealEmpty() {
    const status = App.state.googleAdsStatus || {};
    const customer = status.selectedCustomerId || '?';
    const lastSyncLabel = status.lastSyncAt
      ? new Date(status.lastSyncAt).toLocaleString('pt-BR')
      : '—';
    return `<div class="rounded-3xl bg-white border-2 border-dashed border-amber-300 p-8 text-center">
      <div class="inline-flex w-16 h-16 rounded-2xl items-center justify-center mb-4" style="background: rgba(245,158,11,.12);">
        <i data-lucide="package-x" class="w-8 h-8 text-amber-600"></i>
      </div>
      <h3 class="text-xl font-black text-slate-900 mb-2">Conta conectada, sem campanhas ativas</h3>
      <p class="text-sm text-slate-600 max-w-md mx-auto mb-6">
        A integração com o Google Ads está ativa (Customer <code class="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-xs">${Utils.escape(String(customer))}</code>), mas a conta não tem campanhas no Google Ads neste momento.
      </p>

      <div class="max-w-md mx-auto rounded-2xl bg-slate-50 border border-slate-200 p-4 text-left mb-4">
        <p class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">O que isso significa</p>
        <ul class="text-xs text-slate-700 space-y-1.5 list-disc pl-5">
          <li>O Google Ads sincronizou em <b>${Utils.escape(lastSyncLabel)}</b> e voltou 0 campanhas.</li>
          <li>Não estamos mostrando dados de exemplo aqui — esse painel reflete a realidade da conta conectada.</li>
          <li>Quando você criar uma campanha no Google Ads e o sync rodar (manual ou no cron diário), os números vão aparecer aqui automaticamente.</li>
        </ul>
      </div>

      <div class="flex items-center justify-center gap-2">
        <button onclick="Actions.triggerGoogleAdsSync()" class="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-black inline-flex items-center gap-1.5" style="color:#fff!important;">
          <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Sincronizar agora
        </button>
        <a href="https://ads.google.com/" target="_blank" class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black inline-flex items-center gap-1.5">
          <i data-lucide="external-link" class="w-3.5 h-3.5"></i> Abrir Google Ads
        </a>
      </div>
    </div>`;
  },

  // ============================ HERO ============================
  _hero(isMock, orphansCount) {
    const mockBadge = isMock
      ? `<span class="ml-2 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-amber-400/30 border border-amber-300/60 text-amber-100">Dados de exemplo</span>`
      : '';
    const orphanBadge = orphansCount > 0
      ? `<span class="ml-2 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-rose-400/30 border border-rose-300/60 text-rose-100">${orphansCount} não associada${orphansCount > 1 ? 's' : ''}</span>`
      : '';
    const oauthDone = Boolean(App.state.googleAdsStatus?.oauthCompleted);
    const syncBtn = oauthDone
      ? `<button onclick="Actions.triggerGoogleAdsSync()"
          class="shrink-0 px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur text-white text-xs font-black inline-flex items-center gap-1.5 border border-white/30"
          style="color:#fff!important;">
          <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Sincronizar agora
        </button>`
      : '';
    // V35.7.1 — Fundo mais saturado + texto branco pra legibilidade
    // (era translúcido sobre dark, ficava ilegível).
    return `<div class="rounded-3xl p-6 lg:p-8 shadow-xl"
      style="background: linear-gradient(135deg, #BE185D 0%, #9D174D 60%, #831843 100%); border: 1px solid rgba(244,114,182,.40);">
      <div class="flex items-start gap-4">
        <div class="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center bg-white/15 border border-white/25">
          <i data-lucide="search" class="w-7 h-7 text-white"></i>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-[10px] font-black uppercase tracking-widest mb-1 text-pink-100">Marketing · Aquisição</p>
          <h2 class="text-2xl lg:text-3xl font-black text-white flex items-center flex-wrap gap-2">Google Ads ${mockBadge}${orphanBadge}</h2>
          <p class="text-sm text-pink-100/90 mt-2">Search, Display, YouTube, Performance Max. Vincule cada campanha Ads a uma Campanha LJ pra consolidar gasto, ROAS e conversões por iniciativa.</p>
        </div>
        ${syncBtn}
      </div>
    </div>`;
  },

  // ============================ SUB-TABS ============================
  _subTabsBar(active, orphansCount) {
    const tab = (id, label, icon, badge = '') => {
      const isActive = active === id;
      return `<button onclick="Actions.setGoogleAdsDashboardSubTab('${id}')"
        class="px-4 py-2.5 rounded-xl border-2 transition flex items-center gap-2 ${isActive ? 'bg-pink-600 border-pink-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-pink-300 hover:bg-pink-50'}" ${isActive ? 'style="color:#fff!important;"' : ''}>
        <i data-lucide="${icon}" class="w-4 h-4"></i>
        <span class="font-black text-sm">${label}</span>
        ${badge}
      </button>`;
    };
    const orphanBadgeCount = orphansCount > 0
      ? `<span class="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${active === 'orphans' ? 'bg-white text-pink-700' : 'bg-rose-100 text-rose-700'}">${orphansCount}</span>`
      : '';
    return `<div class="flex flex-wrap gap-2">
      ${tab('overview', 'Visão Geral', 'layout-dashboard')}
      ${tab('linked', 'Associadas', 'link-2')}
      ${tab('orphans', 'Não associadas', 'link-2-off', orphanBadgeCount)}
    </div>`;
  },

  // ============================ VISÃO GERAL (NOVA) ============================
  _renderOverview(linked, orphans) {
    const includeOrphans = Boolean(App.state.googleAdsOverviewIncludeOrphans);
    const selectedProductIds = (App.state.googleAdsOverviewSelectedProducts || []).map(Number);
    const selectedLjIds = (App.state.googleAdsOverviewSelectedLjCampaigns || []).map(Number);
    const ljCampaigns = Array.isArray(App.state.campaigns) ? App.state.campaigns : [];

    // V35.7.2 — Aplicar filtros (Produto + Campanha LJ) sobre as vinculadas.
    // Lookup ad → Campanha LJ.
    const adToLj = new Map();
    linked.forEach(ad => {
      const lj = ljCampaigns.find(c => (c.externalLinks?.googleAds || []).map(String).includes(String(ad.campaign_id)));
      if (lj) adToLj.set(String(ad.campaign_id), lj);
    });

    let filteredLinked = linked;
    if (selectedProductIds.length) {
      filteredLinked = filteredLinked.filter(ad => {
        const lj = adToLj.get(String(ad.campaign_id));
        return lj && selectedProductIds.includes(Number(lj.productId));
      });
    }
    if (selectedLjIds.length) {
      filteredLinked = filteredLinked.filter(ad => {
        const lj = adToLj.get(String(ad.campaign_id));
        return lj && selectedLjIds.includes(Number(lj.id));
      });
    }

    // Órfãs não têm Campanha LJ → filtros não se aplicam, ou aplicam todos out.
    // V35.7.2: se há filtro de Produto/Campanha selecionado, órfãs ficam fora
    // mesmo com toggle ativo — não faz sentido somar órfãs num filtro restritivo.
    const orphansApplicable = (selectedProductIds.length === 0 && selectedLjIds.length === 0);
    const universe = (includeOrphans && orphansApplicable) ? [...filteredLinked, ...orphans] : filteredLinked;

    if (!universe.length) {
      return `<div class="space-y-4">
        ${this._overviewFilters(linked, orphans, ljCampaigns, includeOrphans)}
        <div class="rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 p-12 text-center">
          <i data-lucide="layout-dashboard" class="w-10 h-10 text-slate-400 mx-auto mb-3"></i>
          <p class="text-sm font-black text-slate-700">Nenhuma campanha Ads no recorte selecionado.</p>
          <p class="text-[12px] text-slate-500 mt-1 max-w-md mx-auto">Tente limpar os filtros acima ou vincular ads na aba "Não associadas".</p>
        </div>
      </div>`;
    }

    const agg = this._aggregate(universe);

    return `<div class="space-y-4">
      ${this._overviewFilters(linked, orphans, ljCampaigns, includeOrphans)}

      <!-- Grupo 1: KPIs principais -->
      ${this._kpiGrid([
        { label: 'Gasto 30d',         value: `R$ ${this._fmtMoney(agg.cost_brl)}`,   tone: 'pink',    helpKey: 'gads.cost_30d' },
        { label: 'ROAS',              value: `${agg.roas.toFixed(2)}x`,              tone: agg.roas >= 3 ? 'emerald' : agg.roas >= 1 ? 'amber' : 'rose', helpKey: 'gads.roas' },
        { label: 'CPL',               value: `R$ ${this._fmtMoney(agg.cpl)}`,        tone: 'slate',   helpKey: 'gads.cpl' },
        { label: 'CTR',               value: `${agg.ctr.toFixed(2)}%`,               tone: 'slate',   helpKey: 'gads.ctr' }
      ])}

      <!-- Grupo 2: Volume + Conversão -->
      ${this._kpiGrid([
        { label: 'Impressões',        value: this._fmtInt(agg.impressions),          tone: 'slate',   helpKey: 'gads.impressions' },
        { label: 'Cliques',           value: this._fmtInt(agg.clicks),               tone: 'slate',   helpKey: 'gads.clicks' },
        { label: 'CPC médio',         value: `R$ ${this._fmtMoney(agg.cpc)}`,        tone: 'slate',   helpKey: 'gads.cpc' },
        { label: 'CPM médio',         value: `R$ ${this._fmtMoney(agg.cpm)}`,        tone: 'slate',   helpKey: 'gads.cpm' },
        { label: 'Conversões',        value: this._fmtInt(agg.conversions),          tone: 'pink',    helpKey: 'gads.conversions' },
        { label: 'Receita atribuída', value: `R$ ${this._fmtMoney(agg.conversions_value)}`, tone: 'emerald', helpKey: 'gads.conversions_value' },
        { label: 'Campanhas ativas',  value: this._fmtInt(universe.length),          tone: 'slate',   helpKey: 'gads.active_campaigns' },
        { label: 'Ticket médio',      value: `R$ ${this._fmtMoney(agg.ticket)}`,     tone: 'slate',   helpKey: 'gads.ticket' }
      ])}

      <!-- Grupo 3: Avançados (expansível) -->
      ${this._advancedSection(agg)}
    </div>`;
  },

  // V35.7.2 — Barra de filtros com 2 dropdowns multi-select (Produto + Campanha LJ)
  // + toggle "Incluir não associadas".
  _overviewFilters(linked, orphans, ljCampaigns, includeOrphans) {
    const selectedProducts = (App.state.googleAdsOverviewSelectedProducts || []).map(Number);
    const selectedLjs = (App.state.googleAdsOverviewSelectedLjCampaigns || []).map(Number);
    const products = Array.isArray(App.state.products) ? App.state.products : [];
    const hasFilter = selectedProducts.length > 0 || selectedLjs.length > 0;

    // Só campanhas LJ que têm pelo menos uma ads vinculada aparecem no filtro
    const ljWithAds = ljCampaigns.filter(c => (c.externalLinks?.googleAds || []).length > 0);

    // Labels resumo
    const productsLabel = selectedProducts.length === 0
      ? 'Todos os produtos'
      : selectedProducts.length === 1
        ? Utils.escape(products.find(p => Number(p.id) === selectedProducts[0])?.name || '?')
        : `${selectedProducts.length} produtos`;
    const ljLabel = selectedLjs.length === 0
      ? 'Todas as campanhas LJ'
      : selectedLjs.length === 1
        ? Utils.escape(ljCampaigns.find(c => Number(c.id) === selectedLjs[0])?.name || '?')
        : `${selectedLjs.length} campanhas LJ`;

    const orphansApplicable = !hasFilter;
    const summaryCount = linked.length;

    return `<div class="rounded-2xl bg-white border border-slate-200 p-3 flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2 flex-wrap">
        <i data-lucide="filter" class="w-3.5 h-3.5 text-slate-500 shrink-0"></i>

        <!-- Filtro Produto -->
        <details class="relative">
          <summary class="cursor-pointer px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-[11px] font-black text-slate-700 inline-flex items-center gap-1.5 list-none">
            <i data-lucide="package" class="w-3 h-3"></i>
            <span>${productsLabel}</span>
            <i data-lucide="chevron-down" class="w-3 h-3"></i>
          </summary>
          <div class="absolute top-full left-0 mt-1 z-10 w-64 max-h-72 overflow-y-auto rounded-xl bg-white border border-slate-200 shadow-xl p-2 space-y-1">
            ${products.length === 0 ? '<p class="text-[11px] text-slate-500 p-2 italic">Sem produtos cadastrados.</p>'
              : products.map(p => {
                const checked = selectedProducts.includes(Number(p.id));
                return `<label class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" ${checked ? 'checked' : ''}
                    onchange="Actions.toggleGoogleAdsOverviewProduct('${p.id}')"
                    class="w-3.5 h-3.5 accent-pink-600">
                  <span class="text-[12px] font-bold text-slate-800 truncate">${Utils.escape(p.name)}</span>
                </label>`;
              }).join('')}
          </div>
        </details>

        <!-- Filtro Campanha LJ -->
        <details class="relative">
          <summary class="cursor-pointer px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-[11px] font-black text-slate-700 inline-flex items-center gap-1.5 list-none">
            <i data-lucide="layers" class="w-3 h-3"></i>
            <span>${ljLabel}</span>
            <i data-lucide="chevron-down" class="w-3 h-3"></i>
          </summary>
          <div class="absolute top-full left-0 mt-1 z-10 w-72 max-h-72 overflow-y-auto rounded-xl bg-white border border-slate-200 shadow-xl p-2 space-y-1">
            ${ljWithAds.length === 0 ? '<p class="text-[11px] text-slate-500 p-2 italic">Nenhuma Campanha LJ com Ads vinculada ainda.</p>'
              : ljWithAds.map(c => {
                const checked = selectedLjs.includes(Number(c.id));
                const product = products.find(p => Number(p.id) === Number(c.productId));
                return `<label class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" ${checked ? 'checked' : ''}
                    onchange="Actions.toggleGoogleAdsOverviewLjCampaign('${c.id}')"
                    class="w-3.5 h-3.5 accent-pink-600">
                  <div class="min-w-0">
                    <p class="text-[12px] font-bold text-slate-800 truncate">${Utils.escape(c.name)}</p>
                    ${product ? `<p class="text-[10px] text-slate-500 truncate">${Utils.escape(product.name)}</p>` : ''}
                  </div>
                </label>`;
              }).join('')}
          </div>
        </details>

        ${hasFilter ? `<button onclick="Actions.clearGoogleAdsOverviewFilters()"
          class="px-2 py-1.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-[10px] font-black inline-flex items-center gap-1">
          <i data-lucide="x" class="w-3 h-3"></i> Limpar
        </button>` : ''}

        <span class="text-[11px] text-slate-500 ml-2">${summaryCount} associada${summaryCount !== 1 ? 's' : ''}${includeOrphans && orphansApplicable ? ` + ${orphans.length} não associada${orphans.length !== 1 ? 's' : ''}` : ''}</span>
      </div>

      <label class="flex items-center gap-2 cursor-pointer text-[12px] font-black ${orphansApplicable ? 'text-slate-700' : 'text-slate-400'}" title="${orphansApplicable ? 'Inclui órfãs no consolidado' : 'Disponível só quando não há filtro de Produto/Campanha aplicado'}">
        <span>Incluir não associadas</span>
        <button onclick="Actions.toggleGoogleAdsOverviewIncludeOrphans()" type="button" ${orphansApplicable ? '' : 'disabled'}
          class="relative inline-flex h-5 w-9 items-center rounded-full transition ${(includeOrphans && orphansApplicable) ? 'bg-pink-600' : 'bg-slate-300'} ${orphansApplicable ? '' : 'opacity-40 cursor-not-allowed'}"
          aria-checked="${includeOrphans}" role="switch">
          <span class="inline-block w-3.5 h-3.5 transform rounded-full bg-white shadow transition ${(includeOrphans && orphansApplicable) ? 'translate-x-5' : 'translate-x-0.5'}"></span>
        </button>
      </label>
    </div>`;
  },

  // V35.7.2 — Aceita `helpKey` em cada item; renderiza botão (?) no canto
  // superior direito que abre KpiHelpModal com a explicação + fórmula.
  _kpiGrid(items) {
    const toneCls = {
      pink:    'border-pink-200 bg-pink-50 text-pink-900',
      emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
      amber:   'border-amber-200 bg-amber-50 text-amber-900',
      rose:    'border-rose-200 bg-rose-50 text-rose-900',
      slate:   'border-slate-200 bg-white text-slate-900'
    };
    return `<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      ${items.map(k => `<div class="relative rounded-2xl border ${toneCls[k.tone] || toneCls.slate} p-3 text-center">
        ${k.helpKey ? `<button onclick="Actions.openKpiHelp('${Utils.escape(k.helpKey)}')"
          title="Como este KPI é calculado"
          class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-white/70 hover:bg-white border border-slate-200 text-slate-500 hover:text-slate-700 grid place-items-center transition">
          <i data-lucide="help-circle" class="w-3 h-3"></i>
        </button>` : ''}
        <p class="text-[9px] font-black uppercase tracking-widest opacity-70">${Utils.escape(k.label)}</p>
        <p class="text-lg font-black mt-1">${k.value}</p>
      </div>`).join('')}
    </div>`;
  },

  _advancedSection(agg) {
    return `<details class="rounded-2xl bg-white border border-slate-200 group">
      <summary class="px-4 py-3 cursor-pointer flex items-center justify-between gap-2 list-none">
        <div class="flex items-center gap-2">
          <i data-lucide="settings-2" class="w-4 h-4 text-slate-500"></i>
          <span class="text-sm font-black text-slate-700">Indicadores avançados</span>
          <span class="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">Grupo 3</span>
        </div>
        <i data-lucide="chevron-down" class="w-4 h-4 text-slate-500 transition group-open:rotate-180"></i>
      </summary>
      <div class="px-4 pb-4">
        ${this._kpiGrid([
          { label: 'Todas conversões',         value: this._fmtInt(agg.all_conversions),                tone: 'slate', helpKey: 'gads.all_conversions' },
          { label: 'Receita (todas conv.)',    value: `R$ ${this._fmtMoney(agg.all_conversions_value)}`, tone: 'slate', helpKey: 'gads.all_conversions_value' },
          { label: 'Custo por todas conv.',    value: `R$ ${this._fmtMoney(agg.cost_per_all_conv)}`,    tone: 'slate', helpKey: 'gads.cost_per_all_conv' },
          { label: 'Receita por todas conv.',  value: `R$ ${this._fmtMoney(agg.value_per_all_conv)}`,   tone: 'slate', helpKey: 'gads.value_per_all_conv' },
          { label: 'View-through conv.',       value: this._fmtInt(agg.view_through_conversions),       tone: 'slate', helpKey: 'gads.view_through' },
          { label: 'Conv. por interação',      value: `${(agg.conv_from_interaction_rate * 100).toFixed(2)}%`, tone: 'slate', helpKey: 'gads.conv_rate' },
          { label: 'Search impression share',  value: agg.search_impression_share != null ? `${agg.search_impression_share.toFixed(1)}%` : '—', tone: 'slate', helpKey: 'gads.search_imp_share' },
          { label: 'Search top impression sh.', value: agg.search_top_impression_share != null ? `${agg.search_top_impression_share.toFixed(1)}%` : '—', tone: 'slate', helpKey: 'gads.search_top_imp_share' }
        ])}
        <p class="text-[10px] text-slate-500 mt-3 italic">All conversions inclui primárias + secundárias + view-through. Impression share só vale pra Search/Shopping (vídeos e PMax não expõem direto).</p>
      </div>
    </details>`;
  },

  // ============================ ASSOCIADAS (era 'overview') ============================
  _renderLinked(linked, ljCampaigns) {
    if (!linked.length) {
      return `<div class="rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 p-12 text-center">
        <i data-lucide="link-2-off" class="w-10 h-10 text-slate-400 mx-auto mb-3"></i>
        <p class="text-sm font-black text-slate-700">Nenhuma campanha Ads vinculada ainda.</p>
        <p class="text-[12px] text-slate-500 mt-1">Vá para a aba "Não associadas" e amarre cada campanha Ads a uma Campanha LJ.</p>
      </div>`;
    }

    const byLj = new Map();
    linked.forEach(ad => {
      const lj = ljCampaigns.find(c => (c.externalLinks?.googleAds || []).map(String).includes(String(ad.campaign_id)));
      if (!lj) return;
      if (!byLj.has(lj.id)) byLj.set(lj.id, { lj, ads: [] });
      byLj.get(lj.id).ads.push(ad);
    });

    return `<div class="space-y-4">
      ${Array.from(byLj.values()).map(({ lj, ads }) => this._ljCampaignBlock(lj, ads)).join('')}
    </div>`;
  },

  _ljCampaignBlock(lj, ads) {
    const agg = this._aggregate(ads);
    return `<div class="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div class="p-5 border-b border-slate-100" style="background: linear-gradient(135deg, rgba(244,114,182,.10), rgba(249,168,212,.05));">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div class="min-w-0">
            <p class="text-[10px] font-black uppercase tracking-widest text-pink-700">Campanha LJ</p>
            <h3 class="text-xl font-black text-slate-900 mt-0.5">${Utils.escape(lj.name)}</h3>
            <p class="text-[11px] text-slate-500 mt-0.5">${ads.length} campanha${ads.length > 1 ? 's' : ''} Ads vinculada${ads.length > 1 ? 's' : ''} · ${Utils.escape(lj.sector || 'Marketing')}</p>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
            <div class="rounded-lg bg-white border border-slate-200 p-2 text-center min-w-[80px]">
              <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">Gasto 30d</p>
              <p class="text-sm font-black text-slate-900 mt-0.5">R$ ${this._fmtMoney(agg.cost_brl)}</p>
            </div>
            <div class="rounded-lg bg-white border border-slate-200 p-2 text-center min-w-[80px]">
              <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">ROAS</p>
              <p class="text-sm font-black ${agg.roas >= 3 ? 'text-emerald-700' : agg.roas >= 1 ? 'text-amber-700' : 'text-rose-700'} mt-0.5">${agg.roas.toFixed(2)}x</p>
            </div>
            <div class="rounded-lg bg-white border border-slate-200 p-2 text-center min-w-[80px]">
              <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">CPL</p>
              <p class="text-sm font-black text-slate-900 mt-0.5">R$ ${this._fmtMoney(agg.cpl)}</p>
            </div>
            <div class="rounded-lg bg-white border border-slate-200 p-2 text-center min-w-[80px]">
              <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">CTR</p>
              <p class="text-sm font-black text-slate-900 mt-0.5">${agg.ctr.toFixed(2)}%</p>
            </div>
          </div>
        </div>
      </div>

      <div class="divide-y divide-slate-100">
        ${ads.map(a => this._linkedAdRow(a)).join('')}
      </div>
    </div>`;
  },

  // V35.7.1 — Card de ads vinculada agora é expansível (click expande/colapsa
  // mostrando Grupo 2). Dentro do expandido tem botão "Avançados".
  _linkedAdRow(a) {
    const m = a.metrics_30d || {};
    const channelType = (a.advertising_channel_type || '').replace('_', ' ');
    const expanded = (App.state.googleAdsExpandedAds || []).map(String).includes(String(a.campaign_id));

    const header = `<button type="button" onclick="Actions.toggleGoogleAdsExpandedAd('${Utils.escape(a.campaign_id)}')"
        class="w-full p-4 flex items-center justify-between gap-3 hover:bg-slate-50 text-left">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <i data-lucide="${expanded ? 'chevron-down' : 'chevron-right'}" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>
            <p class="text-sm font-black text-slate-900 truncate">${Utils.escape(a.campaign_name || a.campaign_id)}</p>
            <span class="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-pink-100 text-pink-700">${Utils.escape(channelType)}</span>
            <span class="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700">${Utils.escape(a.status || '')}</span>
          </div>
          <p class="text-[10px] text-slate-500 font-mono mt-0.5 ml-5">ID ${Utils.escape(a.campaign_id)}</p>
        </div>
        <div class="hidden md:flex gap-3 text-right">
          <div>
            <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">Gasto 30d</p>
            <p class="text-[12px] font-black text-slate-900">R$ ${this._fmtMoney(m.cost_brl)}</p>
          </div>
          <div>
            <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">Conv.</p>
            <p class="text-[12px] font-black text-slate-900">${this._fmtInt(m.conversions)}</p>
          </div>
        </div>
      </button>`;

    const expandedBody = expanded ? `<div class="px-5 pb-4 pt-1 bg-slate-50/60 border-t border-slate-100">
        <p class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Indicadores detalhados</p>
        ${this._kpiGrid([
          { label: 'Impressões',     value: this._fmtInt(m.impressions),                tone: 'slate' },
          { label: 'Cliques',        value: this._fmtInt(m.clicks),                     tone: 'slate' },
          { label: 'CTR',            value: `${Number(m.ctr || 0).toFixed(2)}%`,        tone: 'slate' },
          { label: 'CPC médio',      value: `R$ ${this._fmtMoney(m.average_cpc)}`,      tone: 'slate' },
          { label: 'CPM médio',      value: `R$ ${this._fmtMoney(m.average_cpm)}`,      tone: 'slate' },
          { label: 'Conversões',     value: this._fmtInt(m.conversions),                tone: 'pink' },
          { label: 'Receita conv.',  value: `R$ ${this._fmtMoney(m.conversions_value)}`, tone: 'emerald' },
          { label: 'Custo / conv.',  value: `R$ ${this._fmtMoney(m.cost_per_conversion)}`, tone: 'slate' }
        ])}
        <div class="mt-3 flex flex-wrap gap-2 justify-between items-center">
          <p class="text-[11px] text-slate-500">Bidding: <b class="font-mono">${Utils.escape((a.bidding_strategy_type || '').replace('_',' '))}</b> · Budget diário: <b>R$ ${this._fmtMoney(a.daily_budget_brl)}</b></p>
          <div class="flex gap-2">
            <button onclick="Actions.openGoogleAdsAdvancedModal('${Utils.escape(a.campaign_id)}')"
              class="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black inline-flex items-center gap-1.5"
              style="color:#fff!important;">
              <i data-lucide="settings-2" class="w-3.5 h-3.5"></i> Avançados (25 indicadores)
            </button>
            <button onclick="event.stopPropagation(); Actions.unlinkGoogleAdsCampaignFromLj('${Utils.escape(a.campaign_id)}')"
              class="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-300 text-rose-700 text-[11px] font-black inline-flex items-center gap-1.5"
              title="Desvincular esta campanha Ads">
              <i data-lucide="unlink" class="w-3 h-3"></i> Desvincular
            </button>
          </div>
        </div>
      </div>` : '';

    return header + expandedBody;
  },

  // ============================ NÃO ASSOCIADAS ============================
  _renderOrphans(orphans) {
    if (!orphans.length) {
      return `<div class="rounded-3xl bg-emerald-50 border border-emerald-200 p-8 text-center">
        <i data-lucide="check-circle-2" class="w-10 h-10 text-emerald-600 mx-auto mb-3"></i>
        <p class="text-sm font-black text-emerald-900">Tudo certo — nenhuma campanha Ads órfã.</p>
        <p class="text-[12px] text-emerald-700 mt-1">Cada campanha do Google Ads já está vinculada a uma Campanha LJ.</p>
      </div>`;
    }

    return `<div class="space-y-3">
      <div class="rounded-2xl bg-rose-50 border border-rose-200 p-4 flex items-start gap-3">
        <i data-lucide="alert-circle" class="w-5 h-5 text-rose-700 mt-0.5 shrink-0"></i>
        <div class="flex-1 text-sm text-rose-900">
          <p class="font-black">Estas campanhas Google Ads ainda não estão vinculadas a nenhuma Campanha LJ.</p>
          <p class="text-[12px] mt-1">Sem vincular, os dados não consolidam por iniciativa no Mapa da Receita nem no Pulso. Clique em <b>Associar</b> pra abrir o wizard.</p>
        </div>
        <button onclick="Actions.openAdsAssociationWizard('google-ads', [])" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black inline-flex items-center gap-1.5 shrink-0" style="color:#fff!important;">
          <i data-lucide="link" class="w-3.5 h-3.5"></i> Associar todas
        </button>
      </div>

      <div class="grid md:grid-cols-2 gap-3">
        ${orphans.map(c => this._orphanCard(c)).join('')}
      </div>
    </div>`;
  },

  _orphanCard(c) {
    const m = c.metrics_30d || {};
    const channelType = (c.advertising_channel_type || '').replace('_', ' ');
    return `<div class="rounded-2xl bg-white border border-slate-200 border-l-4 border-l-rose-500 p-4 flex flex-col gap-3 shadow-sm">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="text-[10px] font-black uppercase tracking-widest text-rose-700">${Utils.escape(channelType)} · ${Utils.escape(c.status || '?')}</p>
          <p class="text-sm font-black text-slate-900 mt-1 truncate">${Utils.escape(c.campaign_name || c.campaign_id)}</p>
          <p class="text-[10px] text-slate-500 font-mono mt-0.5">ID ${Utils.escape(c.campaign_id || '?')}</p>
        </div>
        <span class="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-rose-100 border border-rose-300 text-rose-700 shrink-0">Órfã</span>
      </div>

      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="rounded-lg bg-slate-50 border border-slate-200 p-2">
          <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">Gasto 30d</p>
          <p class="text-[12px] font-black text-slate-900 mt-0.5">R$ ${this._fmtMoney(m.cost_brl)}</p>
        </div>
        <div class="rounded-lg bg-slate-50 border border-slate-200 p-2">
          <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">Cliques</p>
          <p class="text-[12px] font-black text-slate-900 mt-0.5">${this._fmtInt(m.clicks)}</p>
        </div>
        <div class="rounded-lg bg-slate-50 border border-slate-200 p-2">
          <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">Conversões</p>
          <p class="text-[12px] font-black text-slate-900 mt-0.5">${this._fmtInt(m.conversions)}</p>
        </div>
      </div>

      <button onclick="Actions.openAdsAssociationWizard('google-ads', ['${Utils.escape(c.campaign_id)}'])"
        class="mt-1 px-3 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-black inline-flex items-center justify-center gap-1.5"
        style="color:#fff!important;">
        <i data-lucide="link" class="w-3.5 h-3.5"></i> Associar a uma Campanha LJ
      </button>
    </div>`;
  },

  // ============================ AGREGAÇÃO ============================
  _aggregate(ads) {
    let cost = 0, impressions = 0, clicks = 0, conversions = 0, conversions_value = 0;
    let all_conversions = 0, all_conversions_value = 0, view_through = 0;
    let sis_sum = 0, sis_count = 0, stis_sum = 0, stis_count = 0;
    let cfir_sum = 0, cfir_count = 0;
    ads.forEach(a => {
      const m = a.metrics_30d || {};
      cost += Number(m.cost_brl || 0);
      impressions += Number(m.impressions || 0);
      clicks += Number(m.clicks || 0);
      conversions += Number(m.conversions || 0);
      conversions_value += Number(m.conversions_value || 0);
      all_conversions += Number(m.all_conversions || 0);
      all_conversions_value += Number(m.all_conversions_value || 0);
      view_through += Number(m.view_through_conversions || 0);
      if (m.search_impression_share != null) { sis_sum += Number(m.search_impression_share); sis_count++; }
      if (m.search_top_impression_share != null) { stis_sum += Number(m.search_top_impression_share); stis_count++; }
      if (m.conversions_from_interactions_rate != null) { cfir_sum += Number(m.conversions_from_interactions_rate); cfir_count++; }
    });
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? cost / clicks : 0;
    const cpm = impressions > 0 ? (cost / impressions) * 1000 : 0;
    const cpl = conversions > 0 ? cost / conversions : 0;
    const roas = cost > 0 ? conversions_value / cost : 0;
    const ticket = conversions > 0 ? conversions_value / conversions : 0;
    const cost_per_all_conv = all_conversions > 0 ? cost / all_conversions : 0;
    const value_per_all_conv = all_conversions > 0 ? all_conversions_value / all_conversions : 0;
    return {
      cost_brl: cost, impressions, clicks, conversions, conversions_value,
      ctr, cpc, cpm, cpl, roas, ticket,
      all_conversions, all_conversions_value, view_through_conversions: view_through,
      cost_per_all_conv, value_per_all_conv,
      search_impression_share: sis_count > 0 ? (sis_sum / sis_count) : null,
      search_top_impression_share: stis_count > 0 ? (stis_sum / stis_count) : null,
      conv_from_interaction_rate: cfir_count > 0 ? (cfir_sum / cfir_count) : 0
    };
  },

  _fmtMoney(n) {
    return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  _fmtInt(n) {
    return Number(n || 0).toLocaleString('pt-BR');
  }
};
