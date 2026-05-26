var LeadsModule = {
  render() {
    // V33.0.0-alpha22 (Leonardo) — Hero ÚNICO sempre presente. Elimina a
    // quebra vertical entre Buscador ↔ Pipeline que existia quando cada
    // sub-tab tinha hero próprio. Hero+sub-tabs ficam fixos; conteúdo varia.
    //
    // V34.0.0 Onda 4 — Buscador agora consome visitorSearchResults (tenant DB).
    // Quando loadedAt está setado, usa esses leads; senão, fallback legacy.
    // V34.0.0 Onda 6.d — Trigger lazy do counts pra badge "Duplicatas".
    // Só busca se não fez ainda OU se últimas 60s passaram.
    const pc = App.state.pendingCounts;
    const staleCounts = !pc?.loadedAt || (Date.now() - pc.loadedAt) > 60000;
    if (staleCounts && window.Actions?.loadPendingCounts) {
      // Background, sem await — não bloqueia render
      setTimeout(() => Actions.loadPendingCounts(), 100);
    }
    const activeSubTab = App.state.activeLeadSubTab || 'profile';
    const searchResults = App.state.visitorSearchResults || {};
    const usingSearchResults = Boolean(searchResults.loadedAt);
    const allLeads = usingSearchResults ? (searchResults.visitors || []) : this.getGlobalLeads();
    const heroAndTabs = this.hero(allLeads) + this.subTabs(activeSubTab);

    if (activeSubTab === 'pipeline') {
      return heroAndTabs + JourneyPipelineModule.renderInline();
    }

    const selectedLead = allLeads.find(lead => lead.id === App.state.selectedLeadId) || null;
    if (selectedLead) return heroAndTabs + this.detail(selectedLead);

    let displayLeads = allLeads;
    if (App.state.profileActive && App.state.profileFilters.length) {
      displayLeads = ProfileFinder.applyFilters(allLeads, App.state.profileFilters);
    }

    return heroAndTabs
      + this._campaignContextChips()
      + this.profileFinderUI(displayLeads, allLeads.length)
      + this.bankSelectionModal()
      + this.imputeCampaignModal()
      + this.duplicatesModal()
      + this.importModal()
      // V34.6.f hotfix — Modal "Criar banco" precisa render aqui também.
      // SettingsModal._leadBankEditModal só roda dentro de Settings; user
      // dispara via "+ Criar banco" no import modal sem Settings aberto.
      + (window.SettingsModal?._leadBankEditModal?.() || '')
      + this.rdMailingModal(displayLeads)
      + (usingSearchResults
          ? this.searchResultsActionPanel(displayLeads, allLeads.length)
          : '')
      + this.list(displayLeads, allLeads.length);
  },

  // V33.0.0-alpha19 — Hero alinhado ao padrão Produtos + Campanhas:
  // h2 text-3xl font-black (sem md:text-4xl, sem tracking-tight),
  // badge "Leads Revenue Intelligence" sem bullet, darkMetric idêntico.
  hero(allLeads, mode) {
    const total = allLeads.length;
    const quentes = allLeads.filter(l => l.temperature === 'Quente').length;
    const mornos = allLeads.filter(l => l.temperature === 'Morno').length;
    const avgScore = total ? Math.round(allLeads.reduce((sum, l) => sum + Number(l.globalScore || 0), 0) / total) : 0;
    return `<div class="bg-slate-950 text-white rounded-[2rem] p-5 shadow-sm overflow-hidden relative mb-4">
      <div class="absolute inset-0 opacity-60" style="background: radial-gradient(circle at 20% 10%, rgba(59,130,246,.20), transparent 28%), radial-gradient(circle at 80% 20%, rgba(16,185,129,.16), transparent 30%);"></div>
      <div class="relative z-10 grid lg:grid-cols-[1.2fr_1fr] gap-4 items-start">
        <div>
          <div class="flex items-center gap-2 mb-2"><i data-lucide="users-round" class="w-4 h-4"></i><p class="text-xs font-black text-slate-300 uppercase tracking-wider">Leads Revenue Intelligence</p></div>
          <h2 class="text-3xl font-black">Leads</h2>
          <p class="text-sm text-slate-300 max-w-3xl mt-2">Base global, buscador de perfil e Journey Pipeline conectados à inteligência RevOps. Aqui você desce do macro pro indivíduo.</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          ${this.darkMetric('Leads', total, 'users')}
          ${this.darkMetric('Quentes', quentes, 'flame')}
          ${this.darkMetric('Mornos', mornos, 'thermometer')}
          ${this.darkMetric('Score médio', avgScore, 'gauge')}
        </div>
      </div>
    </div>`;
  },

  // Helper idêntico ao usado em products.js + campaigns.js + actions.js.
  darkMetric(label, value, icon) {
    return `<div class="bg-white/10 border border-white/10 rounded-2xl p-4"><div class="flex items-center justify-between"><p class="text-xs font-black text-slate-300">${label}</p><i data-lucide="${icon}" class="w-4 h-4 text-slate-300"></i></div><div class="text-3xl font-black mt-2">${value}</div></div>`;
  },

  // V21 — Context chips: quando o Buscador foi aberto via "Buscar Leads Agora"
  // pós-criação de Revenue Score, mostra qual campanha/ICP está em foco e
  // permite limpar contexto. Sem contexto = Buscador normal.
  _campaignContextChips() {
    const campaignId = App.state.profileCampaignContext;
    if (!campaignId) return '';
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    if (!campaign) return '';
    const blueprint = window.RevenueScoreEngine?.getBlueprint(campaignId);
    const linked = window.LeadBaseService ? LeadBaseService.forCampaign(campaignId).length : 0;
    return `<div class="bg-gradient-to-br from-indigo-500/10 to-emerald-500/10 border border-indigo-400/30 rounded-3xl p-4 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <i data-lucide="link" class="w-5 h-5 text-indigo-600 shrink-0"></i>
        <div class="min-w-0">
          <p class="text-[10px] font-black text-indigo-700 uppercase tracking-wider">Contexto ativo · vinculação à campanha</p>
          <p class="font-black text-slate-900 truncate">Campanha: <span class="text-indigo-700">${Utils.escape(campaign.name)}</span></p>
          ${blueprint?.profileSummary ? `<p class="text-xs text-slate-600 mt-0.5">ICP: ${Utils.escape(blueprint.profileSummary)}</p>` : ''}
          <p class="text-[11px] text-slate-500 mt-1">${linked} lead(s) já vinculado(s) a essa campanha · clique em <b>Vincular</b> em qualquer card pra adicionar mais.</p>
        </div>
      </div>
      <button onclick="Actions.clearProfileCampaignContext()" class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-xs whitespace-nowrap"><i data-lucide="x" class="w-3 h-3 inline mr-1"></i> Limpar contexto</button>
    </div>`;
  },

  subTabs(activeSubTab) {
    // V33.0.0-alpha16 (Leonardo) — Pill switcher dark (alinhado ao DNA Print 1).
    // Fundo slate-900/60 + selected violet, hover sutil.
    const tabs = [
      { id: 'profile', label: 'Buscador de Perfil', icon: 'scan-search' },
      { id: 'pipeline', label: 'Journey Pipeline', icon: 'workflow' }
    ];
    return `<div class="bg-slate-900/80 rounded-3xl p-2 shadow-sm border border-white/10 mb-4 grid md:grid-cols-2 gap-2">${tabs.map(tab => {
      const isActive = activeSubTab === tab.id;
      const cls = isActive
        ? 'bg-white text-slate-900 shadow-md'
        : 'bg-transparent text-slate-300 hover:bg-white/5 hover:text-white';
      return `<button onclick="JourneyPipelineModule.setLeadSubTab('${tab.id}')" class="px-4 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 transition ${cls}">
        <i data-lucide="${tab.icon}" class="w-4 h-4"></i> ${tab.label}
      </button>`;
    }).join('')}</div>`;
  },

  getGlobalLeads() {
    const map = new Map();
    const fallbackScoreId = App.state.scores[0]?.id || 1;

    const upsertLead = (lead, context = {}) => {
      const scored = lead.score !== undefined ? lead : ScoreEngine.withScore(lead, context.scoreId || fallbackScoreId);
      const key = String(scored.email || scored.phone || scored.name).toLowerCase().trim();
      if (!key) return;

      if (!map.has(key)) {
        // V22.1 — internalId preserva o id original do lead (do manualLeads/CSV).
        // É usado por integrações externas (RD CRM) que precisam de um
        // identificador estável diferente da chave de dedup (email).
        map.set(key, {
          id: key,
          internalId: scored.id || null,
          name: scored.name,
          email: scored.email,
          phone: scored.phone,
          idade: Number(scored.idade || 0),
          sexo: scored.sexo || scored.genero || '',
          genero: scored.genero || scored.sexo || '',
          estado: scored.estado || '',
          cidade: scored.cidade || '',
          estadoCivil: scored.estadoCivil || '',
          faixaSalarial: scored.faixaSalarial || '',
          tags: new Set(),
          behaviorTags: new Set(),
          campaigns: new Set(),
          channels: new Set(),
          actions: [],
          scoreSum: 0,
          interactions: 0,
          lastChannel: context.channel || '',
          lastAction: context.actionName || ''
        });
      }

      const item = map.get(key);
      item.name = scored.name || item.name;
      item.email = scored.email || item.email;
      item.phone = scored.phone || item.phone;
      item.idade = Number(scored.idade || item.idade || 0);
      item.sexo = scored.sexo || scored.genero || item.sexo || '';
      item.genero = scored.genero || scored.sexo || item.genero || '';
      item.estado = scored.estado || item.estado || '';
      item.cidade = scored.cidade || item.cidade || '';
      item.estadoCivil = scored.estadoCivil || item.estadoCivil || '';
      item.faixaSalarial = scored.faixaSalarial || item.faixaSalarial || '';

      String(scored.tags || '').split(' ').filter(Boolean).forEach(tag => {
        item.tags.add(tag);
        item.behaviorTags.add(tag);
      });

      if (context.campaignName) item.campaigns.add(context.campaignName);
      if (context.channel) item.channels.add(context.channel);

      item.scoreSum += Number(scored.score || 0);
      item.interactions += context.countAsInteraction === false ? 0 : 1;
      item.lastChannel = context.channel || item.lastChannel;
      item.lastAction = context.actionName || item.lastAction;

      if (context.timeline !== false) {
        item.actions.push({
          campaign: context.campaignName || 'Base global',
          action: context.actionName || 'Cadastro/importação de lead',
          channel: context.channel || 'Base manual',
          score: scored.score || 0,
          tags: scored.tags || '',
          createdAt: context.createdAt || new Date().toISOString(),
          type: context.type || 'base'
        });
      }
    };

    (App.state.manualLeads || []).forEach((lead, index) => {
      upsertLead(LeadParser.normalizeLead(lead, index, fallbackScoreId), {
        campaignName: '',
        actionName: 'Cadastro/importação de lead',
        channel: 'Base manual',
        createdAt: lead.createdAt,
        type: 'base',
        scoreId: fallbackScoreId,
        countAsInteraction: Boolean(lead.tags)
      });
    });

    // V33.0.0 — Onda 1 Fase 3.2: visitors rastreados pelo tracker entram
    // como fonte adicional. Auto-fetch silencioso uma vez (guard via loadedAt).
    // Não quebra dedup — upsertLead reune por email/phone igual ao resto.
    if (!App.state.trackerVisitorsCache?.loadedAt && !App.state.trackerVisitorsCache?.loading && window.Actions?.loadVisitorsList) {
      setTimeout(() => Actions.loadVisitorsList({ limit: 500 }), 0);
    }
    const visitorList = App.state.trackerVisitorsCache?.list || [];
    visitorList.forEach(v => {
      if (!v.email && !v.phone && !v.name) return; // suspect 100% anônimo não vira "lead" no buscador
      upsertLead({
        id: v.lj_visitor_id,
        name: v.name || v.email || v.phone,
        email: v.email || '',
        phone: v.phone || '',
        score: 0,
        tags: v.entity_type === 'customer' ? 'customer' : (v.entity_type === 'lead' ? 'lead' : 'suspect')
      }, {
        campaignName: '',
        actionName: 'Tracker LJ',
        channel: 'tracker',
        createdAt: v.first_seen_at,
        type: 'tracker',
        scoreId: fallbackScoreId,
        countAsInteraction: false
      });
    });

    const campaignsById = new Map(App.state.campaigns.map(c => [c.id, c]));
    App.state.actions.forEach(action => {
      const campaign = campaignsById.get(action.campaignId);
      const context = {
        campaignName: campaign?.name || 'Campanha desconhecida',
        actionName: action.name,
        channel: action.channel,
        createdAt: action.createdAt,
        type: 'behavior',
        scoreId: action.scoreId
      };
      ScoreEngine.actionLeads(action).forEach(lead => upsertLead(lead, context));
    });

    return Array.from(map.values()).map(lead => {
      const divisor = Math.max(lead.interactions, 1);
      const score = Math.min(100, Math.round(lead.scoreSum / divisor));
      return {
        ...lead,
        tags: Array.from(lead.tags),
        behaviorTags: Array.from(lead.behaviorTags),
        campaigns: Array.from(lead.campaigns).filter(Boolean),
        channels: Array.from(lead.channels).filter(Boolean),
        globalScore: score,
        temperature: score >= 60 ? 'Quente' : score >= 30 ? 'Morno' : 'Frio'
      };
    }).sort((a, b) => b.globalScore - a.globalScore);
  },

  // V34.0.0 Onda 4 — Strip de bancos ativos no Buscador. Mostra "Buscando em: A · B"
  // quando há busca server-side carregada, com botões "Trocar bancos" e "Limpar busca".
  _activeBanksStrip() {
    const sr = App.state.visitorSearchResults || {};
    if (!sr.loadedAt) return '';
    const names = (sr.bankNames || []).join(' · ') || 'Todos';
    const count = (sr.visitors || []).length;
    return `<div class="bg-violet-50 border border-violet-200 rounded-2xl p-3 mb-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0 flex-wrap">
        <i data-lucide="database" class="w-4 h-4 text-violet-700 shrink-0"></i>
        <span class="text-xs font-black text-violet-900 uppercase tracking-wide">Buscando em:</span>
        <span class="text-sm font-bold text-violet-900 truncate">${Utils.escape(names)}</span>
        <span class="text-xs text-violet-700">· ${count} lead(s) na busca</span>
      </div>
      <div class="flex gap-2 shrink-0">
        <button onclick="Actions.openSearchBankSelector('refine')" class="px-3 py-1.5 rounded-xl bg-white border border-violet-300 text-violet-800 font-black text-xs hover:bg-violet-100">Trocar bancos</button>
        <button onclick="Actions.clearVisitorSearch()" class="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-xs hover:bg-slate-100">Limpar busca</button>
      </div>
    </div>`;
  },

  profileFinderUI(filteredLeads, totalInBase) {
    const filters = App.state.profileFilters || [];
    const isActive = App.state.profileActive && filters.length > 0;
    const filtersHtml = filters.map((f, i) => `<span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-bold">${Utils.escape(f.label)}<button onclick="Actions.removeProfileFilter(${i})" class="ml-1 text-slate-400 hover:text-red-400 font-black">×</button></span>`).join(' ');
    // V24.1.0 — Adicionado botão "Enviar mailing RD" (3o) que abre modal pra
    // segmentar os leads filtrados como uma lista no RD Marketing vinculada
    // a uma campanha Journey. Tag-based (RD Marketing → criar segmentação por tag).
    const hasMktOAuth = Boolean(App.state.integrations?.rd?.accessToken);
    const mailingBtn = hasMktOAuth
      ? `<button onclick="Actions.openRdMailingModal()" class="px-4 py-2.5 rounded-2xl bg-violet-600 text-white font-bold text-sm hover:bg-violet-700 flex items-center gap-2" style="color:#fff;"><i data-lucide="send" class="w-3.5 h-3.5"></i> Enviar mailing RD</button>`
      : `<button onclick="Utils.toast('Conecte RD Marketing em Configurações → RD primeiro.')" class="px-4 py-2.5 rounded-2xl bg-slate-200 text-slate-500 font-bold text-sm cursor-not-allowed flex items-center gap-2" title="Requer RD Marketing conectado"><i data-lucide="send" class="w-3.5 h-3.5"></i> Enviar mailing RD</button>`;
    // V34.0.0 Onda 4 — legacy actionPanel só aparece quando NÃO há busca server-side.
    // Com busca V34 ativa, o searchResultsActionPanel substitui (CSV + Imputar).
    const usingV34Search = Boolean(App.state.visitorSearchResults?.loadedAt);
    const actionPanel = (!usingV34Search && isActive && filteredLeads.length > 0) ? `<div class="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200"><div class="flex flex-col md:flex-row md:items-center justify-between gap-3"><div><p class="font-black text-sm">${filteredLeads.length} lead(s) no perfil <span class="text-slate-400 font-normal">de ${totalInBase} na base</span></p><p class="text-xs text-slate-500">Aplique uma ação ou campanha a este grupo.</p></div><div class="flex flex-wrap gap-2"><button onclick="Actions.createActionFromProfile()" class="px-4 py-2.5 rounded-2xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 flex items-center gap-2"><i data-lucide="plug" class="w-3.5 h-3.5"></i> Criar ação com este perfil</button><button onclick="Actions.createCampaignFromProfile()" class="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 font-bold text-sm hover:bg-slate-50 flex items-center gap-2"><i data-lucide="megaphone" class="w-3.5 h-3.5"></i> Nova campanha</button>${mailingBtn}</div></div></div>` : '';
    const refineHtml = filters.length ? `<div class="flex flex-wrap gap-2 mb-3">${filtersHtml}</div><div class="flex gap-2"><input id="refineInput" placeholder="Refinar: cidade, estado, tag, faixa salarial, quente..." onkeydown="if(event.key==='Enter')Actions.refineProfile()" class="flex-1 px-4 py-3 rounded-2xl bg-slate-100 font-semibold" /><button onclick="Actions.refineProfile()" class="px-4 py-3 rounded-2xl bg-slate-200 font-bold text-sm hover:bg-slate-300">Refinar</button></div>` : '';

    // V26.1.1 — Djow é o motor único de busca. Removido o botão "Buscar" preto
    // (parser regex local). Apenas Djow agora. Enter na caixa aciona Djow.
    // Diretriz arquitetural: toda busca/edição/configuração/execução futura
    // do LeadJourney passa pelo Djow.
    const djowSearching = Boolean(App.state._djowSearchRunning);
    const djowBtn = `<button onclick="Actions.djowSearchProfile()" ${djowSearching ? 'disabled' : ''} class="px-5 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-sm flex items-center gap-1.5" style="color:#fff;" title="Djow é o motor de busca do LeadJourney"><i data-lucide="${djowSearching ? 'loader-2' : 'sparkles'}" class="w-3.5 h-3.5 ${djowSearching ? 'animate-spin' : ''}"></i> ${djowSearching ? 'Pensando…' : 'Buscar'}</button>`;

    const dupTotal = Number(App.state.pendingCounts?.duplicateGroupsTotal || 0);
    const dupBadge = dupTotal > 0
      ? `<span class="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black" style="color:#fff!important;">${dupTotal}</span>`
      : '';
    const dupBtnClass = dupTotal > 0
      ? 'px-4 py-3 rounded-2xl bg-amber-50 border-2 border-amber-300 hover:bg-amber-100 font-black text-sm flex items-center gap-2'
      : 'px-4 py-3 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 font-black text-sm flex items-center gap-2';
    return `<div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-4"><div class="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-4"><div><div class="flex items-center gap-2 mb-2"><i data-lucide="scan-search" class="w-5 h-5 text-violet-600"></i><h3 class="text-lg font-black">Buscador de Perfil</h3></div><p class="text-sm text-slate-500">Linguagem natural. Ex: <strong>mulheres jovens de SP com alta intenção</strong>.</p></div><div class="flex gap-2"><button onclick="Actions.openDuplicatesModal()" title="${dupTotal > 0 ? `${dupTotal} grupo(s) de duplicatas pendente(s)` : 'Buscar e fundir duplicatas'}" class="${dupBtnClass}"><i data-lucide="git-merge" class="w-4 h-4 text-amber-600"></i> Duplicatas${dupBadge}</button><button onclick="Actions.openLeadImportModal()" class="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black text-sm flex items-center justify-center gap-2"><i data-lucide="user-plus" class="w-4 h-4"></i> Inserir leads</button></div></div>${this._activeBanksStrip()}<div class="flex flex-wrap gap-2 mb-3"><input id="profileInput" value="${Utils.escape(App.state.profileQuery)}" oninput="App.state.profileQuery=this.value; App.save();" onkeydown="if(event.key==='Enter'){event.preventDefault(); Actions.djowSearchProfile();}" placeholder="Ex: mulheres de 30 a 40 anos de SP, #cta, quente..." class="flex-1 min-w-[200px] px-4 py-3 rounded-2xl bg-slate-100 font-semibold" />${djowBtn}${isActive ? `<button onclick="Actions.clearProfile()" class="px-4 py-3 rounded-2xl bg-slate-100 font-bold text-sm hover:bg-slate-200">Limpar</button>` : ''}</div>${refineHtml}${actionPanel}</div>`;
  },

  // V34.0.0 Onda 4 — Modal multi-select de bancos antes da busca.
  // Aparece quando user clica Buscar sem ter rodado busca antes, ou ao
  // clicar "Trocar bancos" no strip ativo.
  bankSelectionModal() {
    const m = App.state.searchBankSelectionModal;
    if (!m?.open) return '';
    const banks = App.state.leadBanksCache?.banks || [];
    const selected = m.selected;
    const isAll = selected === null;
    const isSelected = (id) => Array.isArray(selected) && selected.some(s => Number(s) === Number(id));
    const totalSel = isAll ? banks.length : (Array.isArray(selected) ? selected.length : 0);
    const banksHtml = banks.map(b => `<label class="flex items-center gap-3 px-4 py-3 rounded-2xl ${isSelected(b.id) ? 'bg-violet-50 border-violet-300' : 'bg-slate-50 border-slate-200'} border-2 cursor-pointer hover:bg-violet-50 transition" ${isAll ? 'style="opacity:0.5;"' : ''}>
      <input type="checkbox" ${isSelected(b.id) ? 'checked' : ''} ${isAll ? 'disabled' : ''} onchange="Actions.toggleSearchBank(${b.id})" class="w-5 h-5 rounded accent-violet-600" />
      <div class="flex-1 min-w-0">
        <p class="font-black text-sm text-slate-900 truncate">${Utils.escape(b.name)}${b.is_default ? ' <span class="text-[10px] font-bold text-violet-600 ml-1">DEFAULT</span>' : ''}</p>
        <p class="text-xs text-slate-500">${b.visitor_count || 0} lead(s)</p>
      </div>
    </label>`).join('');
    return `<div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div class="bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 w-full max-w-2xl mt-8">
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <div class="flex items-center gap-2 mb-1"><i data-lucide="database" class="w-5 h-5 text-violet-600"></i><h3 class="text-xl font-black">De qual(is) banco(s) quer buscar?</h3></div>
            <p class="text-sm text-slate-500">Multi-select. Marque "Todos" pra buscar na base inteira do tenant.</p>
          </div>
          <button onclick="Actions.closeSearchBankSelector()" class="w-10 h-10 rounded-2xl bg-slate-100 font-black text-xl shrink-0">×</button>
        </div>
        <label class="flex items-center gap-3 px-4 py-3 rounded-2xl ${isAll ? 'bg-violet-600 text-white border-violet-700' : 'bg-slate-50 border-slate-200 text-slate-900'} border-2 cursor-pointer mb-3 transition">
          <input type="checkbox" ${isAll ? 'checked' : ''} onchange="Actions.toggleAllSearchBanks()" class="w-5 h-5 rounded accent-white" />
          <div class="flex-1">
            <p class="font-black text-sm">Todos os bancos</p>
            <p class="text-xs ${isAll ? 'text-violet-100' : 'text-slate-500'}">Busca em todos os ${banks.length} banco(s) do tenant.</p>
          </div>
        </label>
        <div class="space-y-2 max-h-[40vh] overflow-y-auto">${banksHtml || '<p class="text-sm text-slate-500">Nenhum banco encontrado.</p>'}</div>
        <div class="flex flex-col md:flex-row gap-2 pt-4 mt-3 border-t border-slate-100">
          <button onclick="Actions.confirmSearchBankSelection()" class="flex-1 px-5 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black" style="color:#fff!important;">Buscar em ${totalSel} banco(s)</button>
          <button onclick="Actions.closeSearchBankSelector()" class="px-5 py-3 rounded-2xl bg-slate-100 font-black">Cancelar</button>
        </div>
      </div>
    </div>`;
  },

  // V34.0.0 Onda 6 — Modal de revisão e merge de duplicatas.
  // Mostra grupos detectados (mesmo email OU mesmo phone) e permite fundir
  // cada grupo individualmente. UI deixa o cliente escolher manualmente quem
  // sobrevive ou usar default (mais antigo).
  duplicatesModal() {
    const m = App.state.duplicatesModal;
    if (!m?.open) return '';
    const total = (m.emailGroups?.length || 0) + (m.phoneGroups?.length || 0);
    return `<div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div class="bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 w-full max-w-4xl mt-8">
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <div class="flex items-center gap-2 mb-1"><i data-lucide="git-merge" class="w-5 h-5 text-amber-600"></i><h3 class="text-xl font-black">Identity Resolution · Duplicatas</h3></div>
            <p class="text-sm text-slate-500">Visitors com mesmo email ou phone exato. Funda pra preservar histórico único do lead.</p>
          </div>
          <button onclick="Actions.closeDuplicatesModal()" class="w-10 h-10 rounded-2xl bg-slate-100 font-black text-xl shrink-0">×</button>
        </div>

        ${m.loading ? `<div class="py-12 text-center text-sm text-slate-500"><i data-lucide="loader-2" class="w-6 h-6 animate-spin inline mb-2"></i><p>Procurando duplicatas...</p></div>` : ''}

        ${m.error ? `<div class="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm font-bold text-rose-800 mb-3">${Utils.escape(m.error)}</div>` : ''}

        ${!m.loading && total === 0 ? `<div class="py-12 text-center"><i data-lucide="check-circle-2" class="w-12 h-12 text-emerald-500 inline mb-2"></i><p class="font-black text-slate-700">Nenhuma duplicata encontrada</p><p class="text-sm text-slate-500 mt-1">Sua base está limpa.</p></div>` : ''}

        ${!m.loading && total > 0 ? `
          <div class="mb-3 text-xs font-black text-slate-600 uppercase tracking-wider">${total} grupo(s) com duplicatas</div>
          <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            ${(m.emailGroups || []).map(g => this._duplicateGroupCard(g, 'email-exact', m.mergingKey)).join('')}
            ${(m.phoneGroups || []).map(g => this._duplicateGroupCard(g, 'phone-exact', m.mergingKey)).join('')}
          </div>
        ` : ''}

        <div class="flex gap-2 pt-4 mt-3 border-t border-slate-100 flex-wrap">
          <button onclick="Actions.openDuplicatesModal()" class="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 font-black text-sm flex items-center gap-2"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Re-escanear</button>
          ${App.currentUser?.isMaster ? `<button onclick="Actions.triggerRdTagReconcile()" title="Master-only: reconcilia lj_visitor_tags com tags atuais do RD CRM" class="px-4 py-2.5 rounded-2xl bg-white border border-violet-200 hover:bg-violet-50 text-violet-800 font-black text-sm flex items-center gap-2"><i data-lucide="rotate-cw" class="w-3.5 h-3.5"></i> Reconciliar com RD <span class="text-[10px] text-violet-500">(master)</span></button>` : ''}
          <button onclick="Actions.closeDuplicatesModal()" class="ml-auto px-5 py-2.5 rounded-2xl bg-slate-100 font-black text-sm">Fechar</button>
        </div>
      </div>
    </div>`;
  },

  _duplicateGroupCard(group, signal, mergingKey) {
    const merging = mergingKey === group.key;
    const visitors = group.visitors || [];
    // Sobrevivente default: mais antigo (sorted por first_seen_at asc no backend)
    const defaultSurvivor = visitors[0]?.lj_visitor_id;
    const label = signal === 'email-exact' ? `email = "${Utils.escape(group.key)}"` : `phone = ${Utils.escape(group.key)}`;
    return `<div class="bg-slate-50 border border-slate-200 rounded-2xl p-4">
      <div class="flex items-center justify-between gap-2 mb-3">
        <div class="flex items-center gap-2">
          <span class="px-2 py-1 rounded-lg ${signal === 'email-exact' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'} text-[10px] font-black uppercase tracking-wide">${signal}</span>
          <code class="text-xs font-mono text-slate-700">${label}</code>
          <span class="text-xs text-slate-500">· ${visitors.length} visitors</span>
        </div>
        <button ${merging ? 'disabled' : ''} onclick="Actions.mergeDuplicateGroup('${signal}', '${Utils.escape(group.key)}', '${Utils.escape(defaultSurvivor || '')}')" class="px-3 py-1.5 rounded-xl ${merging ? 'bg-slate-300 text-slate-500 cursor-wait' : 'bg-amber-600 hover:bg-amber-700 text-white'} font-black text-xs flex items-center gap-1.5" ${merging ? '' : 'style="color:#fff!important;"'}>
          <i data-lucide="${merging ? 'loader-2' : 'git-merge'}" class="w-3.5 h-3.5 ${merging ? 'animate-spin' : ''}"></i>
          ${merging ? 'Fundindo...' : `Fundir ${visitors.length}`}
        </button>
      </div>
      <div class="grid gap-2">
        ${visitors.map((v, i) => `
          <div class="flex items-center gap-3 px-3 py-2 rounded-xl ${i === 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-white border border-slate-100'}">
            ${i === 0 ? '<span class="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black" style="color:#fff!important;">SURVIVOR</span>' : '<span class="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black">FUNDE</span>'}
            <div class="flex-1 min-w-0">
              <p class="font-black text-sm text-slate-900 truncate">${Utils.escape(v.name || '(sem nome)')}</p>
              <p class="text-xs text-slate-500 truncate">${Utils.escape(v.email || '-')} · ${Utils.escape(v.phone || '-')} · banco: ${Utils.escape(v.bank_name || '-')}</p>
              <p class="text-[10px] text-slate-400 mt-0.5">id: ${Utils.escape(v.lj_visitor_id)} · primeiro contato: ${v.first_seen_at ? new Date(v.first_seen_at).toLocaleDateString('pt-BR') : '-'} · ${v.tag_count} tag(s) · score ${v.global_score || 0}${v.external_rd_deal_id ? ' · RD✓' : ''}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
  },

  // V34.6.k hotfix — Progress bar do chunking de imputação (2 fases: DB depois RD).
  _imputeProgressBar(p) {
    const pct = Math.min(100, Math.round((p.current / p.total) * 100));
    const isDb = p.phase === 'db';
    const color = isDb ? 'slate' : 'violet';
    const label = isDb ? 'DB (LJ)' : 'RD CRM';
    return `<div class="bg-${color}-50 border border-${color}-200 rounded-2xl p-3">
      <div class="flex items-center justify-between gap-2 mb-2">
        <div class="flex items-center gap-2 text-sm text-${color}-900 font-black">
          <i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>
          Fase ${label} · Lote ${p.currentChunk}/${p.totalChunks}
        </div>
        <div class="text-xs text-${color}-700 font-bold">${p.current}/${p.total} · ${pct}%</div>
      </div>
      <div class="w-full h-2 rounded-full bg-${color}-100 overflow-hidden">
        <div class="h-full bg-${color}-500 transition-all" style="width:${pct}%"></div>
      </div>
      <p class="text-[10px] text-${color}-700 mt-2">${isDb ? 'Imputando no banco do LJ (50 por lote)' : 'Empurrando pro RD CRM (25 por lote, API mais lenta)'}. Não feche o modal.</p>
    </div>`;
  },

  // V34.0.0 Onda 5.b — Bloco do modal de imputação que controla o push pro RD CRM.
  // Mostra checkbox "Também empurrar pro RD CRM" (default ON se crm_pat conectado).
  // Avisa que pipeline RD precisa ter nome EXATO da campanha LJ.
  _imputeRdPushBlock(m, selectedCampaign) {
    const crmStatus = App.state.rdConnectionStatus?.crm_pat?.status || 'unknown';
    const connected = crmStatus === 'connected';
    if (!connected) {
      return `<div class="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs">
        <div class="flex items-center gap-2 font-black text-amber-900 mb-1"><i data-lucide="alert-circle" class="w-3.5 h-3.5"></i>RD CRM não conectado</div>
        <p class="text-amber-800">A imputação acontece só no LJ. Pra empurrar pro RD CRM, conecte o Token (PAT) em Configurações → RD primeiro.</p>
      </div>`;
    }
    const enabled = Boolean(m.pushToRd);
    return `<label class="flex items-start gap-3 px-4 py-3 rounded-2xl ${enabled ? 'bg-violet-50 border-violet-300' : 'bg-slate-50 border-slate-200'} border-2 cursor-pointer transition">
      <input type="checkbox" ${enabled ? 'checked' : ''} onchange="Actions.toggleImputePushToRd()" class="mt-0.5 w-5 h-5 rounded accent-violet-600" />
      <div class="flex-1">
        <p class="font-black text-sm text-slate-900">Também empurrar pro RD CRM</p>
        <p class="text-xs text-slate-600 mt-0.5">Cria contato + deal no RD. O LJ procura o pipeline com nome <b>EXATO</b> da campanha LJ${selectedCampaign ? ` ("${Utils.escape(selectedCampaign.name)}")` : ''}.</p>
        <p class="text-xs text-slate-500 mt-1">Se não achar, o LJ avisa e a imputação no LJ continua válida — só o RD não recebe.</p>
      </div>
    </label>`;
  },

  // V34.0.0 Onda 5 — Modal de imputar leads numa campanha LJ.
  // Cliente confirma os N visitors filtrados + escolhe campanha alvo.
  // Backend cria estado em lj_visitor_campaign_state + tagueia.
  imputeCampaignModal() {
    const m = App.state.imputeCampaignModal;
    if (!m?.open) return '';
    const campaigns = App.state.campaigns || [];
    const visitorCount = (m.visitorIds || []).length;
    const processing = Boolean(m.processing);
    const canConfirm = !processing && m.campaignId && visitorCount > 0;
    const selectedCampaign = campaigns.find(c => Number(c.id) === Number(m.campaignId));
    return `<div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div class="bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 w-full max-w-2xl mt-8">
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <div class="flex items-center gap-2 mb-1"><i data-lucide="send" class="w-5 h-5 text-slate-900"></i><h3 class="text-xl font-black">Imputar leads em campanha</h3></div>
            <p class="text-sm text-slate-500">Os ${visitorCount} lead(s) selecionado(s) entram em <b>marketing-tof</b> da campanha escolhida e ganham as tags <code class="bg-slate-100 px-1.5 py-0.5 rounded text-xs">lj-campanha-X</code> + <code class="bg-slate-100 px-1.5 py-0.5 rounded text-xs">lj-stage-marketing-tof</code>.</p>
          </div>
          <button onclick="Actions.closeImputeCampaignModal()" class="w-10 h-10 rounded-2xl bg-slate-100 font-black text-xl shrink-0">×</button>
        </div>

        ${campaigns.length === 0 ? `
          <div class="bg-rose-50 border border-rose-200 rounded-2xl p-4">
            <p class="text-sm font-black text-rose-800 mb-1">Nenhuma campanha encontrada</p>
            <p class="text-xs text-rose-700">Crie uma campanha primeiro em Campanhas.</p>
          </div>
        ` : `
          <div class="space-y-3">
            <div>
              <label class="text-[10px] font-black text-slate-500 uppercase tracking-wide">Campanha de destino</label>
              <select onchange="Actions.setImputeCampaignId(this.value)" class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold">
                <option value="">— Selecione uma campanha —</option>
                ${campaigns.map(c => `<option value="${c.id}" ${Number(m.campaignId) === Number(c.id) ? 'selected' : ''}>${Utils.escape(c.name)}</option>`).join('')}
              </select>
            </div>

            <div class="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-xs space-y-1">
              <div class="font-black text-slate-700 mb-2">Resumo da imputação:</div>
              <div>• <b>${visitorCount}</b> lead(s) entram em <b>marketing-tof</b> da campanha</div>
              ${selectedCampaign ? `<div>• Campanha: <b>${Utils.escape(selectedCampaign.name)}</b></div>` : ''}
              <div>• Score inicial da campanha = <code class="bg-white px-1.5 py-0.5 rounded">round(global_score × 0.5)</code></div>
              <div>• Leads que já estão na campanha são pulados (não duplica)</div>
            </div>

            ${this._imputeRdPushBlock(m, selectedCampaign)}

            ${m.progress ? this._imputeProgressBar(m.progress) : ''}

            ${m.error ? `<div class="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-sm font-bold text-rose-800">${Utils.escape(m.error)}</div>` : ''}

            <div class="flex flex-col md:flex-row gap-2 pt-2">
              <button ${canConfirm ? '' : 'disabled'} onclick="Actions.confirmImputeCampaign()" class="flex-1 px-5 py-3 rounded-2xl ${canConfirm ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-300 text-slate-500 cursor-not-allowed'} font-black flex items-center justify-center gap-2" ${canConfirm ? 'style="color:#fff!important;"' : ''}>
                <i data-lucide="${processing ? 'loader-2' : 'send'}" class="w-4 h-4 ${processing ? 'animate-spin' : ''}"></i>
                ${processing ? 'Imputando...' : `Imputar ${visitorCount} lead(s)`}
              </button>
              <button onclick="Actions.closeImputeCampaignModal()" class="px-5 py-3 rounded-2xl bg-slate-100 font-black">Cancelar</button>
            </div>
          </div>
        `}
      </div>
    </div>`;
  },

  // V34.0.0 Onda 4 — Painel de ações em cima dos resultados (quando há busca server-side).
  // Substitui o "Criar ação/campanha/Mailing RD" pelos outputs novos da V34: CSV + Imputar.
  searchResultsActionPanel(displayLeads, totalInBase) {
    const count = displayLeads.length;
    if (!count) return '';
    return `<div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-4">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <p class="font-black text-sm">${count} lead(s) no resultado <span class="text-slate-400 font-normal">de ${totalInBase} carregado(s)</span></p>
          <p class="text-xs text-slate-500">Exporte pra fora do LJ ou imputa em campanha (motor entra na V34.5).</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button onclick="Actions.exportSearchResultsCsv()" class="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 font-black text-sm flex items-center gap-2"><i data-lucide="download" class="w-3.5 h-3.5"></i> Baixar CSV</button>
          <button onclick="Actions.openImputeCampaignModal()" class="px-4 py-2.5 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 font-black text-sm flex items-center gap-2" style="color:#fff!important;"><i data-lucide="send" class="w-3.5 h-3.5"></i> Imputar em campanha</button>
        </div>
      </div>
    </div>`;
  },

  // V24.1.0 — Modal de criação de mailing RD a partir dos leads filtrados.
  // Flow: user define nome + escolhe campanha vinculada + estágio do funil.
  // Cada lead vai pro RD Marketing via upsertContact com 2 tags:
  //   - lj_mailing_<slug-do-nome>  → user usa pra segmentar no RD UI
  //   - target_<stage>             → marca o estágio-alvo desse mailing
  // Quando WEBHOOK.CONVERTED chegar, mapeamento mailing→campanha resolve
  // qual campanha do Journey recebe a tag #convert_<stage>.
  rdMailingModal(displayLeads) {
    if (!App.state.showRdMailingModal) return '';
    const draft = App.state.rdMailingDraft || { name: '', campaignId: '', targetStage: 'mkt_tof' };
    const leadCount = Array.isArray(displayLeads) ? displayLeads.length : 0;
    const campaigns = (App.state.campaigns || []);
    const stages = window.RdCrmConfig?.defaultStages?.() || [
      { code: 'mkt_tof', label: 'Marketing TOF' }, { code: 'mkt_mof', label: 'Marketing MOF' }, { code: 'mkt_bof', label: 'Marketing BOF' },
      { code: 'vnd_tof', label: 'Vendas TOF' }, { code: 'vnd_mof', label: 'Vendas MOF' }, { code: 'vnd_bof', label: 'Vendas BOF' },
      { code: 'cs_onboarding', label: 'CS Onboarding' }, { code: 'cs_retencao', label: 'CS Retenção' }, { code: 'cs_expansao', label: 'CS Expansão' }
    ];
    const slug = (draft.name || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const tag = slug ? `lj_mailing_${slug}` : '<defina o nome>';
    const responseTag = `#convert_${draft.targetStage || 'mkt_tof'}`;
    const isSending = Boolean(App.state.rdMailingSending);
    const canSend = !isSending && draft.name.trim().length >= 3 && draft.campaignId && leadCount > 0;

    return `<div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div class="bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 w-full max-w-2xl mt-8">
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <i data-lucide="send" class="w-5 h-5 text-violet-600"></i>
              <h3 class="text-xl font-black">Enviar mailing RD</h3>
            </div>
            <p class="text-sm text-slate-500">Manda os ${leadCount} lead(s) filtrado(s) pro RD Marketing como uma segmentação nomeada, vinculada a uma campanha do Journey.</p>
          </div>
          <button onclick="Actions.closeRdMailingModal()" class="w-10 h-10 rounded-2xl bg-slate-100 font-black text-xl shrink-0">×</button>
        </div>

        <div class="space-y-4">
          <div>
            <label class="text-[10px] font-black text-slate-500 uppercase tracking-wide">Nome do mailing</label>
            <input value="${Utils.escape(draft.name)}" oninput="Actions.updateRdMailingDraftSilent('name', this.value)" onblur="Actions.updateRdMailingDraft('name', this.value)" placeholder="Ex: Aquecimento outubro 2026" class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" />
            <p class="text-[11px] text-slate-500 mt-1">Tag aplicada no RD: <code class="text-violet-700 font-mono">${Utils.escape(tag)}</code> (vc usa essa tag no RD pra criar a segmentação do email).</p>
          </div>

          <div>
            <label class="text-[10px] font-black text-slate-500 uppercase tracking-wide">Campanha vinculada</label>
            <select onchange="Actions.updateRdMailingDraft('campaignId', this.value)" class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold">
              <option value="">— Selecione a campanha —</option>
              ${campaigns.map(c => `<option value="${c.id}" ${String(draft.campaignId) === String(c.id) ? 'selected' : ''}>${Utils.escape(c.name)}</option>`).join('')}
            </select>
            <p class="text-[11px] text-slate-500 mt-1">Respostas (conversões na LP) voltam pra essa campanha.</p>
          </div>

          <div>
            <label class="text-[10px] font-black text-slate-500 uppercase tracking-wide">Estágio do funil que esse mailing mira</label>
            <select onchange="Actions.updateRdMailingDraft('targetStage', this.value)" class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold">
              ${stages.map(s => `<option value="${s.code}" ${draft.targetStage === s.code ? 'selected' : ''}>${Utils.escape(s.label)} (${s.code})</option>`).join('')}
            </select>
            <p class="text-[11px] text-slate-500 mt-1">Quando o lead converter, recebe a tag: <code class="text-violet-700 font-mono">${Utils.escape(responseTag)}</code></p>
          </div>

          <div class="rounded-2xl bg-violet-50 border border-violet-200 p-3 text-xs text-violet-900">
            <div class="font-black mb-1">Resumo:</div>
            <div>• <b>${leadCount}</b> contato(s) serão criados/atualizados no RD Marketing</div>
            <div>• Tags aplicadas em cada um: <code>${Utils.escape(tag)}</code></div>
            <div>• Quando algum lead converter em LP, ganhará <code>${Utils.escape(responseTag)}</code> e a conversão volta pra campanha <b>${Utils.escape((campaigns.find(c => String(c.id) === String(draft.campaignId)) || {}).name || '—')}</b></div>
          </div>

          ${(() => {
            const p = App.state.rdMailingProgress;
            if (!p || !p.total) return '';
            const pct = Math.min(100, Math.round((p.current / p.total) * 100));
            return `<div class="bg-violet-50 border border-violet-200 rounded-2xl p-3">
              <div class="flex items-center justify-between gap-2 mb-2">
                <div class="flex items-center gap-2 text-sm text-violet-900 font-black">
                  <i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>
                  Enviando pro RD Marketing
                </div>
                <div class="text-xs text-violet-700 font-bold">${p.current}/${p.total} · ${pct}%</div>
              </div>
              <div class="w-full h-2 rounded-full bg-violet-100 overflow-hidden">
                <div class="h-full bg-violet-500 transition-all" style="width:${pct}%"></div>
              </div>
              <p class="text-[10px] text-violet-700 mt-2">Se cascatear 401 (token RD expirado), aborto e te aviso.</p>
            </div>`;
          })()}

          <div class="flex flex-col md:flex-row gap-2 pt-2">
            <button onclick="Actions.confirmCreateRdMailing()" ${canSend ? '' : 'disabled'} class="flex-1 px-5 py-3 rounded-2xl ${canSend ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'} font-black flex items-center justify-center gap-2" ${canSend ? 'style="color:#fff;"' : ''}>
              <i data-lucide="${isSending ? 'loader-2' : 'send'}" class="w-4 h-4 ${isSending ? 'animate-spin' : ''}"></i>
              ${isSending ? 'Enviando…' : `Enviar ${leadCount} lead(s) pro RD`}
            </button>
            <button onclick="Actions.closeRdMailingModal()" class="px-5 py-3 rounded-2xl bg-slate-100 font-black">Cancelar</button>
          </div>
        </div>
      </div>
    </div>`;
  },

  importModal() {
    if (!App.state.showLeadImportModal) return '';
    const mode = App.state.leadBaseInputMode || 'manual';
    const processing = Boolean(App.state.leadImportProcessing);
    return `<div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto"><div class="bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 w-full max-w-3xl mt-8">
      <div class="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 class="text-xl font-black">Inserir leads</h3>
          <p class="text-sm text-slate-500">Os leads são salvos no banco escolhido, com tags automáticas de origem.</p>
        </div>
        <button onclick="Actions.closeLeadImportModal()" class="w-10 h-10 rounded-2xl bg-slate-100 font-black text-xl">×</button>
      </div>
      ${this._importBankSelector()}
      <div class="grid grid-cols-2 gap-2 mb-4">
        <button onclick="Actions.setLeadBaseInputMode('manual')" class="px-4 py-2.5 rounded-2xl font-black text-sm ${mode === 'manual' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}">Manual</button>
        <button onclick="Actions.setLeadBaseInputMode('csv')" class="px-4 py-2.5 rounded-2xl font-black text-sm ${mode === 'csv' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}">CSV</button>
      </div>
      ${processing ? this._importProgressBar() : ''}
      ${mode === 'csv' ? this.csvImportUI() : this.manualImportUI()}
    </div></div>`;
  },

  // V34.6.h — Progress bar do import chunked. Mostra "Lote X/Y · N leads
  // processado(s) de M". Substitui o "Processando batch" genérico.
  _importProgressBar() {
    const p = App.state.leadImportProgress;
    if (!p || !p.total) {
      return `<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-3 text-sm text-amber-800 font-bold flex items-center gap-2"><span class="inline-block w-3 h-3 rounded-full bg-amber-400 animate-pulse"></span>Processando batch no servidor...</div>`;
    }
    const pct = Math.min(100, Math.round((p.current / p.total) * 100));
    return `<div class="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-3">
      <div class="flex items-center justify-between gap-2 mb-2">
        <div class="flex items-center gap-2 text-sm text-amber-900 font-black">
          <i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>
          Lote ${p.currentChunk}/${p.totalChunks}
        </div>
        <div class="text-xs text-amber-700 font-bold">${p.current}/${p.total} leads · ${pct}%</div>
      </div>
      <div class="w-full h-2 rounded-full bg-amber-100 overflow-hidden">
        <div class="h-full bg-amber-500 transition-all" style="width:${pct}%"></div>
      </div>
      <p class="text-[10px] text-amber-700 mt-2">Processando em batches de 50 pra evitar timeout. Não feche o modal.</p>
    </div>`;
  },

  // V34.0.0 Onda 3 — Seletor de banco no topo do modal. Sem banco selecionado,
  // import fica bloqueado. Mostra link "+ Criar banco" inline se tenant não tem nenhum.
  _importBankSelector() {
    const banks = App.state.leadBanksCache?.banks || [];
    const selectedId = App.state.leadImportBankId || null;
    // V34.6.g hotfix — race recovery: se banks carregaram mas selectedId nunca
    // foi setado (created via "+ Criar banco" antes do fix do saveLeadBank, ou
    // race condition de load paralelo), auto-seleciona o default/primeiro.
    // Deferido pra próximo tick pra não mutar state durante render.
    if (banks.length && !selectedId && window.Actions?.setLeadImportBank) {
      setTimeout(() => {
        if (!App.state.leadImportBankId && App.state.showLeadImportModal) {
          const fallback = banks.find(b => b.is_default) || banks[0];
          if (fallback) Actions.setLeadImportBank(fallback.id);
        }
      }, 0);
    }
    if (!banks.length) {
      return `<div class="bg-rose-50 border border-rose-200 rounded-2xl p-4 mb-4">
        <p class="text-sm font-black text-rose-800 mb-1">Nenhum banco de leads encontrado</p>
        <p class="text-xs text-rose-700 mb-3">Você precisa criar um banco antes de importar. Bancos agrupam leads e podem virar audiência de campanha.</p>
        <button onclick="Actions.openLeadBankEditModal()" class="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-black text-sm" style="color:#fff!important;">+ Criar banco</button>
      </div>`;
    }
    const options = banks.map(b => `<option value="${b.id}" ${Number(selectedId) === Number(b.id) ? 'selected' : ''}>${Utils.escape(b.name)}${b.is_default ? ' · default' : ''} · ${b.visitor_count || 0} lead(s)</option>`).join('');
    return `<div class="bg-slate-50 border border-slate-200 rounded-2xl p-3 mb-4 flex flex-col md:flex-row md:items-center gap-3">
      <div class="flex-1 min-w-0">
        <p class="text-xs font-black text-slate-500 mb-1">Banco de destino</p>
        <select onchange="Actions.setLeadImportBank(this.value)" class="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-bold text-sm">${options}</select>
      </div>
      <button onclick="Actions.openLeadBankEditModal()" class="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 font-bold text-xs whitespace-nowrap">+ Criar novo</button>
    </div>`;
  },

  manualImportUI() {
    const placeholder = 'Nome, Telefone, Email, Idade, Estado, Cidade, Estado Civil, Sexo, Faixa Salarial, Tags\nEx: Ana Souza, 11999999999, ana@email.com, 35, São Paulo, São Paulo, Casado(a), Feminino, R$ 5 mil a R$ 10 mil, #open #cta';
    const processing = Boolean(App.state.leadImportProcessing);
    const disabled = processing || !App.state.leadImportBankId;
    return `<div class="space-y-3"><textarea ${processing ? 'disabled' : ''} oninput="App.state.leadManualText=this.value; App.save();" placeholder="${Utils.escape(placeholder)}" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold min-h-[180px]">${Utils.escape(App.state.leadManualText || '')}</textarea><p class="text-xs text-slate-500">Uma linha por lead. Ordem: Nome, Telefone, Email, Idade, Estado, Cidade, Estado Civil, Sexo, Faixa Salarial, Tags.</p><div class="flex flex-col md:flex-row gap-2"><button ${disabled ? 'disabled' : ''} onclick="Actions.importManualLeadsFromText()" class="px-5 py-3 rounded-2xl ${disabled ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-slate-900 text-white'} font-black">${processing ? 'Processando...' : 'Importar lead(s)'}</button><button onclick="Actions.closeLeadImportModal()" class="px-5 py-3 rounded-2xl bg-slate-100 font-black">Cancelar</button></div></div>`;
  },

  csvImportUI() {
    const processing = Boolean(App.state.leadImportProcessing);
    const disabled = processing || !App.state.leadImportBankId;
    return `<div class="space-y-3"><div class="flex flex-col md:flex-row gap-2"><button onclick="Actions.downloadGlobalLeadCsvTemplate()" class="px-4 py-3 rounded-2xl bg-white border border-slate-200 font-bold text-sm">Baixar modelo CSV</button><label class="px-4 py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm cursor-pointer text-center">Selecionar CSV<input type="file" accept=".csv" class="hidden" onchange="Actions.handleGlobalLeadCSV(event)" /></label></div><textarea ${processing ? 'disabled' : ''} oninput="App.state.leadCsvText=this.value; App.save();" placeholder="Nome,Telefone,Email,Idade,Estado,Cidade,Estado Civil,Sexo,Faixa Salarial,Tags" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold min-h-[150px]">${Utils.escape(App.state.leadCsvText || '')}</textarea><p class="text-xs text-slate-500">Colunas aceitas: Nome, Telefone, Email, Idade, Estado, Cidade, Estado Civil, Sexo, Faixa Salarial, Tags. Tags = comportamento.</p><div class="flex flex-col md:flex-row gap-2"><button ${disabled ? 'disabled' : ''} onclick="Actions.importGlobalLeadsFromCsv()" class="px-5 py-3 rounded-2xl ${disabled ? 'bg-slate-300 text-slate-500 cursor-not-allowed' : 'bg-slate-900 text-white'} font-black">${processing ? 'Processando...' : 'Importar CSV'}</button><button onclick="Actions.closeLeadImportModal()" class="px-5 py-3 rounded-2xl bg-slate-100 font-black">Cancelar</button></div></div>`;
  },

  list(leads) {
    const avg = Math.round(leads.reduce((sum, lead) => sum + lead.globalScore, 0) / Math.max(leads.length, 1));
    const isProfile = App.state.profileActive && App.state.profileFilters.length > 0;
    return `<div class="space-y-4"><div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5"><div><h2 class="text-2xl font-black">${isProfile ? 'Perfil Filtrado' : 'Leads Globais'}</h2><p class="text-sm text-slate-500">${isProfile ? 'Resultado do perfil buscado.' : 'Base global consolidada de leads e presença comportamental.'}</p></div><div class="grid grid-cols-3 gap-2 text-center"><div class="bg-slate-50 rounded-2xl px-4 py-3"><div class="text-2xl font-black">${leads.length}</div><div class="text-xs text-slate-500">Leads</div></div><div class="bg-slate-50 rounded-2xl px-4 py-3"><div class="text-2xl font-black">${leads.filter(l => l.temperature === 'Quente').length}</div><div class="text-xs text-slate-500">Quentes</div></div><div class="bg-slate-50 rounded-2xl px-4 py-3"><div class="text-2xl font-black">${avg}</div><div class="text-xs text-slate-500">Score médio</div></div></div></div>${this._bulkLinkBar(leads)}<div class="grid gap-3">${leads.map(lead => this.card(lead)).join('') || Components.empty('Nenhum lead encontrado.')}</div></div></div>`;
  },

  // V21.3 — Faixa de bulk-link visível quando há contexto de campanha. Mostra
  // quantos do resultado já estão vinculados vs disponíveis e CTA "Vincular todos".
  _bulkLinkBar(leads) {
    const campaignId = App.state.profileCampaignContext;
    if (!campaignId || !window.LeadBaseService) return '';
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    if (!campaign) return '';
    let alreadyLinked = 0;
    for (const lead of leads) {
      if (LeadBaseService.isLinked(lead.id, campaignId)) alreadyLinked += 1;
    }
    const available = leads.length - alreadyLinked;
    if (!leads.length) return '';
    const allLinked = available === 0;
    return `<div class="bg-indigo-500/10 border border-indigo-400/30 rounded-2xl p-3 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div class="flex items-center gap-2 min-w-0">
        <i data-lucide="list-plus" class="w-4 h-4 text-indigo-700 shrink-0"></i>
        <p class="text-sm text-slate-700"><b class="text-indigo-700">${available} lead(s)</b> deste resultado ainda não vinculados a <b>${Utils.escape(campaign.name)}</b>${alreadyLinked ? ` · ${alreadyLinked} já vinculado(s)` : ''}.</p>
      </div>
      <button ${allLinked ? 'disabled' : ''} onclick="Actions.linkAllDisplayedLeads()" class="px-4 py-2.5 rounded-xl ${allLinked ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'} text-xs font-black flex items-center gap-1.5 whitespace-nowrap" ${allLinked ? '' : 'style="color:#fff!important;"'}>
        <i data-lucide="link" class="w-3.5 h-3.5"></i> ${allLinked ? 'Todos já vinculados' : `Vincular ${available} lead(s) à campanha`}
      </button>
    </div>`;
  },

  _getDisplayedLeads() {
    const all = this.getGlobalLeads();
    if (App.state.profileActive && App.state.profileFilters.length && window.ProfileFinder) {
      return ProfileFinder.applyFilters(all, App.state.profileFilters);
    }
    return all;
  },

  card(lead) {
    const tempClass = lead.temperature === 'Quente' ? 'bg-red-100 text-red-700' : lead.temperature === 'Morno' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-200 text-slate-700';
    const safeId = String(lead.id).replace(/'/g, "\\'");
    // V21 — quando há contexto de campanha ativo, mostra botão de vincular
    const campaignId = App.state.profileCampaignContext;
    const isLinked = campaignId && window.LeadBaseService ? LeadBaseService.isLinked(lead.id, campaignId) : false;
    const linkBtn = campaignId
      ? (isLinked
          ? `<button onclick="event.stopPropagation(); Actions.unlinkLeadFromCampaign('${safeId}', ${campaignId})" class="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black flex items-center gap-1 whitespace-nowrap"><i data-lucide="check" class="w-3 h-3"></i> Vinculado · clique p/ remover</button>`
          : `<button onclick="event.stopPropagation(); Actions.linkLeadToCampaignFromBuscador('${safeId}')" class="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1 whitespace-nowrap" style="color:#fff!important;"><i data-lucide="link" class="w-3 h-3"></i> Vincular à campanha</button>`)
      : '';
    return `<div class="p-4 rounded-3xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div onclick="Actions.openLead('${safeId}')" class="cursor-pointer min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-1"><h3 class="font-black text-lg">${Utils.escape(lead.name)}</h3><span class="px-3 py-1 rounded-full text-xs font-black ${tempClass}">${lead.temperature}</span></div>
          <p class="text-sm text-slate-500">${Utils.escape(lead.email || 'sem email')} • ${Utils.escape(lead.phone || 'sem telefone')}</p>
          <p class="text-xs text-slate-400 mt-1">${Utils.escape([lead.sexo, lead.idade ? lead.idade + ' anos' : '', lead.cidade, lead.estado].filter(Boolean).join(' • ') || 'sem dados de perfil')}</p>
        </div>
        <div class="flex flex-col items-stretch gap-2">
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="bg-white rounded-2xl px-3 py-2 border border-slate-100"><div class="font-black text-xl">${lead.globalScore}</div><div class="text-xs text-slate-500">Score</div></div>
            <div class="bg-white rounded-2xl px-3 py-2 border border-slate-100"><div class="font-black text-sm truncate">${Utils.escape(lead.lastChannel || '-')}</div><div class="text-xs text-slate-500">Canal</div></div>
            <div class="bg-white rounded-2xl px-3 py-2 border border-slate-100"><div class="font-black text-sm truncate">${lead.behaviorTags.length}</div><div class="text-xs text-slate-500">Tags</div></div>
          </div>
          ${linkBtn}
        </div>
      </div>
    </div>`;
  },

  detail(lead) {
    const tempClass = lead.temperature === 'Quente' ? 'bg-red-100 text-red-700' : lead.temperature === 'Morno' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-200 text-slate-700';
    // V33.0.0 — Se o lead foi capturado pelo tracker, mostra botão "Jornada Causal"
    // que abre TrackerVisitorDetailModal com touchpoints/transitions/events.
    const hasTrackerOrigin = (lead.actions || []).some(a => a.channel === 'tracker');
    const trackerVisitorId = hasTrackerOrigin ? lead.internalId : null;
    const trackerBtn = trackerVisitorId
      ? `<button onclick="Actions.loadVisitorDetail('${Utils.escape(String(trackerVisitorId))}')" class="ml-2 px-4 py-2 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-sm inline-flex items-center gap-1.5" style="color:#fff!important;"><i data-lucide="user-search" class="w-3.5 h-3.5"></i> Jornada Causal</button>`
      : '';
    return `<div class="space-y-4"><div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><div class="mb-4 flex items-center"><button onclick="App.state.selectedLeadId=null; App.save(); App.render();" class="px-4 py-2 rounded-2xl bg-slate-100 font-black text-sm">← Voltar para Leads</button>${trackerBtn}</div><div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5"><div><div class="flex items-center gap-2 mb-2"><h2 class="text-2xl font-black">${Utils.escape(lead.name)}</h2><span class="px-3 py-1 rounded-full text-xs font-black ${tempClass}">${lead.temperature}</span></div><p class="text-sm text-slate-500">${Utils.escape(lead.email || 'sem email')} • ${Utils.escape(lead.phone || 'sem telefone')}</p></div><div class="grid grid-cols-3 gap-2 text-center"><div class="bg-slate-50 rounded-2xl px-4 py-3"><div class="text-2xl font-black">${lead.globalScore}</div><div class="text-xs text-slate-500">Score Global</div></div><div class="bg-slate-50 rounded-2xl px-4 py-3"><div class="text-2xl font-black">${lead.campaigns.length}</div><div class="text-xs text-slate-500">Campanhas</div></div><div class="bg-slate-50 rounded-2xl px-4 py-3"><div class="text-2xl font-black">${lead.interactions}</div><div class="text-xs text-slate-500">Interações</div></div></div></div><div class="grid lg:grid-cols-3 gap-4"><div class="bg-slate-50 rounded-3xl p-4 border border-slate-100"><h3 class="font-black text-lg mb-3">Dados de perfil</h3><div class="grid grid-cols-2 gap-2 text-xs">${this.profileCell('Sexo', lead.sexo)}${this.profileCell('Idade', lead.idade ? lead.idade + ' anos' : '')}${this.profileCell('Estado', lead.estado)}${this.profileCell('Cidade', lead.cidade)}${this.profileCell('Estado civil', lead.estadoCivil)}${this.profileCell('Faixa salarial', lead.faixaSalarial)}</div></div><div class="lg:col-span-2 bg-slate-50 rounded-3xl p-4 border border-slate-100"><h3 class="font-black text-lg mb-3">Tags comportamentais</h3><div class="flex flex-wrap gap-2">${lead.behaviorTags.map(tag => `<span class="px-3 py-2 rounded-2xl bg-slate-900 text-white text-xs font-black">${Utils.escape(tag)}</span>`).join('') || '<span class="text-sm text-slate-500">Sem tags comportamentais</span>'}</div></div></div></div><div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><h3 class="text-xl font-black mb-5">Timeline da Jornada</h3><div class="space-y-3">${lead.actions.map(item => this.timelineItem(item)).join('') || Components.empty('Sem eventos de jornada.')}</div></div></div>`;
  },

  profileCell(label, value) {
    return `<div class="bg-white rounded-xl p-2"><span class="text-slate-500">${label}</span><div class="font-black">${Utils.escape(value || '-')}</div></div>`;
  },

  timelineItem(item) {
    return `<div class="flex gap-3 items-start"><div class="w-3 h-3 rounded-full ${item.type === 'behavior' ? 'bg-slate-900' : 'bg-slate-300'} mt-2"></div><div class="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-4"><div class="flex flex-col lg:flex-row lg:items-center justify-between gap-2 mb-2"><div><p class="font-black">${Utils.escape(item.action)}</p><p class="text-xs text-slate-500">${Utils.escape(item.campaign)} • ${Utils.escape(item.channel)}</p></div><div class="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-black">Score ${item.score}</div></div><div class="flex flex-wrap gap-2 mt-3">${String(item.tags || '').split(' ').filter(Boolean).map(tag => `<span class="px-2 py-1 rounded-xl bg-slate-900 text-white text-[10px] font-black">${Utils.escape(tag)}</span>`).join('') || '<span class="text-xs text-slate-400">Sem tags</span>'}</div></div></div>`;
  }
};
window.LeadsModule = LeadsModule;
