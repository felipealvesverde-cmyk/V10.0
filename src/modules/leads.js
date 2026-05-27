var LeadsModule = {
  render() {
    // V33.0.0-alpha22 (Leonardo) — Hero ÚNICO sempre presente.
    // V34.0.0 Onda 4 — Buscador consome visitorSearchResults (tenant DB).
    // V34.6.q — Sanitização: se state veio com profileActive=true mas SEM
    // visitorSearchResults V34, limpa filtros. Força cliente a passar pelo
    // modal de bancos. Elimina state legacy zumbi (que voltava cada F5
    // mesmo após normalize resetar — vinha do remote state_sync).
    if (App.state.profileActive && !App.state.visitorSearchResults?.loadedAt) {
      App.state.profileActive = false;
      App.state.profileFilters = [];
      App.state.profileQuery = '';
      App.save();
    }
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
      + this.rdBacklogModal()
      + this.importModal()
      // V34.6.f hotfix — Modal "Criar banco" precisa render aqui também.
      // SettingsModal._leadBankEditModal só roda dentro de Settings; user
      // dispara via "+ Criar banco" no import modal sem Settings aberto.
      + (window.SettingsModal?._leadBankEditModal?.() || '')
      + this.rdMailingModal(displayLeads)
      + (usingSearchResults
          ? this.searchResultsActionPanel(displayLeads, allLeads.length)
          : '')
      + this._bankQuickSelectorLayer()
      + this.list(displayLeads, allLeads.length);
  },

  // V33.0.0-alpha19 — Hero alinhado ao padrão Produtos + Campanhas:
  // h2 text-3xl font-black (sem md:text-4xl, sem tracking-tight),
  // badge "Leads Revenue Intelligence" sem bullet, darkMetric idêntico.
  hero(allLeads, mode) {
    const total = allLeads.length;
    // V34.7.g — temperatura unificada via globalScore V34 (alinhado com _scoreBadgeClasses)
    const quentes = allLeads.filter(l => Number(l.globalScore || 0) >= 501).length;
    const mornos = allLeads.filter(l => { const s = Number(l.globalScore || 0); return s >= 334 && s < 501; }).length;
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

  // V34.7.h.5 — Barra de progresso do enriquecimento em loop.
  // Só renderiza enquanto App.state.enrichProgress.running. Mostra %, batch,
  // total e contagem done/total. Não pode ser cancelado (loop bloqueante).
  _enrichProgressBar() {
    const p = App.state.enrichProgress;
    if (!p || !p.running) return '';
    const total = Math.max(p.total || 0, 1);
    const done = Math.min(p.done || 0, total);
    const pct = Math.min(100, Math.round((done / total) * 100));
    const batchLabel = p.currentBatch ? `Lote ${p.currentBatch}` : 'Iniciando';
    return `<div class="bg-violet-50 border-2 border-violet-200 rounded-2xl p-4 mb-3">
      <div class="flex items-center justify-between mb-2 gap-3">
        <div class="flex items-center gap-2 min-w-0">
          <i data-lucide="sparkles" class="w-4 h-4 text-violet-700 shrink-0 animate-pulse"></i>
          <span class="text-sm font-black text-violet-900">Enriquecendo nomes via Djow…</span>
          <span class="text-xs font-bold text-violet-700">· ${batchLabel}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-sm font-black text-violet-900">${pct}%</span>
          <span class="text-xs text-violet-700">(${done} / ${total})</span>
        </div>
      </div>
      <div class="w-full h-2.5 bg-white rounded-full overflow-hidden border border-violet-200">
        <div class="h-full bg-violet-600 transition-all duration-300" style="width: ${pct}%;"></div>
      </div>
    </div>`;
  },

  // V34.9.1 — Barra de progresso do motor com %, lote atual e done/total.
  _reconciliationRunBar() {
    const p = App.state.reconciliationRunProgress;
    if (!p || !p.running) return '';
    const phase = p.phase || 'Conciliando…';
    const total = Math.max(p.total || 0, 0);
    const done = Math.min(p.done || 0, total);
    const showBar = total > 0;
    const pct = showBar ? Math.min(100, Math.round((done / total) * 100)) : 0;
    return `<div class="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 mb-3">
      <div class="flex items-center justify-between gap-3 mb-2">
        <div class="flex items-center gap-2 min-w-0">
          <i data-lucide="refresh-ccw" class="w-4 h-4 text-sky-700 animate-spin shrink-0"></i>
          <span class="text-sm font-black text-sky-900">Conciliando LJ ↔ RD CRM</span>
          <span class="text-xs font-bold text-sky-700 truncate">· ${Utils.escape(phase)}</span>
        </div>
        ${showBar ? `<div class="flex items-center gap-2 shrink-0">
          <span class="text-sm font-black text-sky-900">${pct}%</span>
          <span class="text-xs text-sky-700">(${done} / ${total})</span>
        </div>` : ''}
      </div>
      ${showBar ? `<div class="w-full h-2.5 bg-white rounded-full overflow-hidden border border-sky-200">
        <div class="h-full bg-sky-600 transition-all duration-300" style="width: ${pct}%;"></div>
      </div>` : ''}
    </div>`;
  },

  // V34.7.h.6 — Barra de progresso do Sync RD em loop (azul/sky pra diferenciar do enrich).
  _rdSyncProgressBar() {
    const p = App.state.rdSyncProgress;
    if (!p || !p.running) return '';
    const total = Math.max(p.total || 0, 1);
    const done = Math.min(p.done || 0, total);
    const pct = Math.min(100, Math.round((done / total) * 100));
    const batchLabel = p.currentBatch ? `Lote ${p.currentBatch}` : 'Iniciando';
    return `<div class="bg-sky-50 border-2 border-sky-200 rounded-2xl p-4 mb-3">
      <div class="flex items-center justify-between mb-2 gap-3">
        <div class="flex items-center gap-2 min-w-0">
          <i data-lucide="rotate-cw" class="w-4 h-4 text-sky-700 shrink-0 animate-spin"></i>
          <span class="text-sm font-black text-sky-900">Sincronizando contatos com RD CRM…</span>
          <span class="text-xs font-bold text-sky-700">· ${batchLabel}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-sm font-black text-sky-900">${pct}%</span>
          <span class="text-xs text-sky-700">(${done} / ${total})</span>
        </div>
      </div>
      <div class="w-full h-2.5 bg-white rounded-full overflow-hidden border border-sky-200">
        <div class="h-full bg-sky-600 transition-all duration-300" style="width: ${pct}%;"></div>
      </div>
    </div>`;
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

    const pc = App.state.pendingCounts || {};
    const dupTotal = Number(pc.duplicateGroupsTotal || 0);
    const enrichTotal = Number(pc.enrichablePending || 0);
    const syncTotal = Number(pc.rdContactSyncPending || 0);
    const enrichRunning = Boolean(App.state._enrichRunning);
    const syncRunning = Boolean(App.state._rdContactSyncRunning);

    // Helper pra montar mini-botão com badge
    const pendBtn = (label, total, color, icon, onClick, running, title) => {
      const has = total > 0;
      const baseClasses = has
        ? `px-3 py-2 rounded-2xl bg-${color}-50 border-2 border-${color}-300 hover:bg-${color}-100 text-${color}-900 font-black text-xs flex items-center gap-1.5`
        : `px-3 py-2 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5`;
      const badge = has ? `<span class="ml-0.5 px-1.5 py-0.5 rounded-full bg-${color}-500 text-white text-[10px] font-black" style="color:#fff!important;">${total}</span>` : '';
      const iconElement = running ? `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>` : `<i data-lucide="${icon}" class="w-3.5 h-3.5 text-${color}-600"></i>`;
      return `<button ${running ? 'disabled' : ''} onclick="${onClick}" title="${title}" class="${baseClasses} ${running ? 'opacity-60 cursor-wait' : ''}">${iconElement} ${label}${badge}</button>`;
    };

    return `<div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-4">
      <div class="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-4">
        <div>
          <div class="flex items-center gap-2 mb-2"><i data-lucide="scan-search" class="w-5 h-5 text-violet-600"></i><h3 class="text-lg font-black">Buscador de Perfil</h3></div>
          <p class="text-sm text-slate-500">Linguagem natural. Ex: <strong>mulheres jovens de SP com alta intenção</strong>.</p>
        </div>
        <div class="flex gap-2 flex-wrap items-start">
          ${pendBtn('Duplicatas', dupTotal, 'amber', 'git-merge', 'Actions.openDuplicatesModal()', false, dupTotal > 0 ? `${dupTotal} grupo(s) de duplicatas` : 'Buscar e fundir duplicatas')}
          ${pendBtn(enrichRunning ? 'Enriquecendo' : 'Enriquecer', enrichTotal, 'violet', 'sparkles', 'Actions.triggerEnrichNames()', enrichRunning, enrichTotal > 0 ? `${enrichTotal} lead(s) sem nome — clique pra rodar Djow agora` : 'Enriquecer nomes via heurística + Djow')}
          ${(() => {
            // V34.8.2 — Botão "Conciliar" substitui "Sync RD". Dispara motor
            // bidirecional (pull + push + alertas). Estado: state.reconciliationRunProgress.running.
            const running = Boolean(App.state.reconciliationRunProgress?.running);
            return pendBtn(running ? 'Conciliando' : 'Conciliar', 0, 'sky', 'refresh-ccw', 'Actions.triggerReconciliation()', running, 'Roda o motor de conciliação RD↔LJ: puxa updates, empurra órfãos, marca conflitos no sininho.');
          })()}
          <button onclick="Actions.openLeadImportModal()" class="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black text-sm flex items-center justify-center gap-2"><i data-lucide="user-plus" class="w-4 h-4"></i> Inserir leads</button>
        </div>
      </div>
      ${this._activeBanksStrip()}
      ${this._enrichProgressBar()}
      ${this._rdSyncProgressBar()}
      ${this._reconciliationRunBar()}
      <div class="flex flex-wrap gap-2 mb-3">
        <input id="profileInput" value="${Utils.escape(App.state.profileQuery)}" oninput="App.state.profileQuery=this.value; App.save();" onkeydown="if(event.key==='Enter'){event.preventDefault(); Actions.djowSearchProfile();}" placeholder="Ex: mulheres de 30 a 40 anos de SP, #cta, quente..." class="flex-1 min-w-[200px] px-4 py-3 rounded-2xl bg-slate-100 font-semibold" />
        ${djowBtn}
        ${isActive ? `<button onclick="Actions.clearProfile()" class="px-4 py-3 rounded-2xl bg-slate-100 font-bold text-sm hover:bg-slate-200">Limpar</button>` : ''}
      </div>
      ${refineHtml}${actionPanel}
    </div>`;
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

  // V34.6.s — Progress bar honesto: mostra pushed (sucessos reais), não current
  // (tentativas). Antes enganava cliente quando tudo dava 502.
  _imputeProgressBar(p) {
    const isDb = p.phase === 'db';
    const color = isDb ? 'slate' : 'violet';
    const label = isDb ? 'DB (LJ)' : 'RD CRM';
    const total = Number(p.total || 1);
    const tried = Number(p.current || 0);
    // DB: cada chunk é confiável, usa current. RD: usa pushed (sucessos).
    const pushed = isDb ? tried : Number(p.pushed || 0);
    const already = Number(p.already || 0);
    const failed = Math.max(0, tried - pushed - already);
    const pctSuccess = Math.min(100, Math.round((pushed / total) * 100));
    const pctTried = Math.min(100, Math.round((tried / total) * 100));
    const failingMostly = !isDb && tried > 5 && (failed / tried) > 0.5;
    const boxColor = failingMostly ? 'rose' : color;
    return `<div class="bg-${boxColor}-50 border border-${boxColor}-200 rounded-2xl p-3">
      <div class="flex items-center justify-between gap-2 mb-2">
        <div class="flex items-center gap-2 text-sm text-${boxColor}-900 font-black">
          <i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>
          ${failingMostly ? `${label} recusando` : `Fase ${label} · Lote ${p.currentChunk}/${p.totalChunks}`}
        </div>
        <div class="text-xs text-${boxColor}-700 font-bold">
          ${pushed} ok${already ? ` · ${already} já` : ''}${failed ? ` · ${failed} falhas` : ''} de ${total} · ${pctSuccess}%
        </div>
      </div>
      <div class="w-full h-2 rounded-full bg-slate-100 overflow-hidden relative">
        <div class="h-full bg-${boxColor}-500 transition-all" style="width:${pctSuccess}%"></div>
        <div class="absolute top-0 h-full bg-slate-300 opacity-50 transition-all" style="left:${pctSuccess}%; width:${Math.max(0, pctTried - pctSuccess)}%"></div>
      </div>
      <p class="text-[10px] text-${boxColor}-700 mt-2">
        ${isDb
          ? 'Imputando no banco do LJ (50 por lote).'
          : failingMostly
            ? '⚠️ Barra colorida = deals reais. Cinza = falhas. Aborto em 5 lotes seguidos falhando.'
            : 'Barra colorida = deals criados no RD. Cinza = tentativas em curso. 5 por lote, 3 paralelos.'}
        Não feche o modal.
      </p>
    </div>`;
  },

  // V34.6.z — Modal de backlog RD push (visitors imputados mas que não entraram
  // no RD CRM). Mostra razões agrupadas + lista + botão retry.
  rdBacklogModal() {
    const m = App.state.rdBacklogModal;
    if (!m?.open) return '';
    const total = Number(m.total || 0);
    const byReason = m.byReason || {};
    const visitors = m.visitors || [];
    const retrying = Boolean(m.retrying);
    const reasonsHtml = Object.entries(byReason)
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => `<div class="flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
        <span class="text-sm text-slate-800 font-bold">${Utils.escape(key)}</span>
        <span class="px-2 py-1 rounded-lg bg-rose-100 text-rose-800 text-xs font-black">${count}</span>
      </div>`).join('');
    const visitorsList = visitors.slice(0, 50).map(v => `
      <div class="px-3 py-2 rounded-xl bg-white border border-slate-100">
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <p class="font-black text-sm text-slate-900 truncate">${Utils.escape(v.name || '(sem nome)')}</p>
            <p class="text-xs text-slate-500 truncate">${Utils.escape(v.email || '-')} · ${Utils.escape(v.phone || '-')} · banco: ${Utils.escape(v.bank_name || '-')}</p>
          </div>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${v.sync_status === 'failed' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-600'}">${Utils.escape(v.sync_status || 'pendente')}</span>
        </div>
        ${v.sync_error ? `<p class="text-[11px] text-rose-700 mt-1 font-mono">${Utils.escape(v.sync_error.slice(0, 120))}</p>` : ''}
      </div>
    `).join('');
    return `<div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div class="bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 w-full max-w-3xl mt-8">
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <div class="flex items-center gap-2 mb-1"><i data-lucide="alert-circle" class="w-5 h-5 text-rose-600"></i><h3 class="text-xl font-black">Backlog RD push</h3></div>
            <p class="text-sm text-slate-500">Visitors imputados na campanha mas que NÃO entraram no RD CRM. Agrupados por motivo.</p>
          </div>
          <button onclick="Actions.closeRdBacklogModal()" class="w-10 h-10 rounded-2xl bg-slate-100 font-black text-xl shrink-0">×</button>
        </div>

        ${m.loading ? `<div class="py-12 text-center text-sm text-slate-500"><i data-lucide="loader-2" class="w-6 h-6 animate-spin inline mb-2"></i><p>Buscando backlog...</p></div>` : ''}
        ${m.error ? `<div class="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-sm font-bold text-rose-800 mb-3">${Utils.escape(m.error)}</div>` : ''}

        ${!m.loading && total === 0 ? `
          <div class="py-12 text-center">
            <i data-lucide="check-circle-2" class="w-12 h-12 text-emerald-500 inline mb-2"></i>
            <p class="font-black text-slate-700">Nenhum backlog</p>
            <p class="text-sm text-slate-500 mt-1">Todos os imputados entraram no RD CRM.</p>
          </div>
        ` : ''}

        ${!m.loading && total > 0 ? `
          <div class="bg-rose-50 border border-rose-200 rounded-2xl p-3 mb-3">
            <p class="text-sm font-black text-rose-900">${total} visitor(s) imputado(s) mas SEM deal no RD</p>
          </div>

          <div class="mb-3">
            <p class="text-xs font-black text-slate-500 uppercase tracking-wide mb-2">Motivos agrupados</p>
            <div class="space-y-1">${reasonsHtml}</div>
          </div>

          <details class="mb-3">
            <summary class="text-xs font-black text-slate-500 uppercase tracking-wide cursor-pointer">Ver visitors (${visitors.length}${visitors.length > 50 ? ', mostrando 50' : ''})</summary>
            <div class="space-y-1 mt-2 max-h-[40vh] overflow-y-auto pr-1">${visitorsList}</div>
          </details>
        ` : ''}

        <div class="flex gap-2 pt-4 mt-3 border-t border-slate-100 flex-wrap">
          ${total > 0 ? `<button ${retrying ? 'disabled' : ''} onclick="Actions.retryRdBacklog()" class="flex-1 px-5 py-3 rounded-2xl ${retrying ? 'bg-slate-300 text-slate-500 cursor-wait' : 'bg-violet-600 hover:bg-violet-700 text-white'} font-black flex items-center justify-center gap-2" ${retrying ? '' : 'style="color:#fff!important;"'}>
            <i data-lucide="${retrying ? 'loader-2' : 'rotate-cw'}" class="w-4 h-4 ${retrying ? 'animate-spin' : ''}"></i>
            ${retrying ? 'Retentando...' : `Retentar ${total} visitor(s)`}
          </button>` : ''}
          <button onclick="Actions.closeRdBacklogModal()" class="px-5 py-3 rounded-2xl bg-slate-100 font-black">Fechar</button>
        </div>
      </div>
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
            ${selectedCampaign ? `<button onclick="Actions.openRdBacklogModal(${selectedCampaign.id})" class="mt-2 w-full px-4 py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 font-black text-sm flex items-center justify-center gap-2"><i data-lucide="alert-circle" class="w-3.5 h-3.5"></i> Ver backlog RD desta campanha (visitors não imputados)</button>` : ''}
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
            // V34.6.o — barra reflete SUCESSOS reais (pushed), não tentativas.
            // Tentadas = current (idx). Sucessos = pushed. Falhas = failed.
            const tried = Number(p.current || 0);
            const pushed = Number(p.pushed || 0);
            const failed = Number(p.failed || 0);
            const total = Number(p.total || 1);
            const pctSuccess = Math.min(100, Math.round((pushed / total) * 100));
            const pctTried = Math.min(100, Math.round((tried / total) * 100));
            const failingMostly = tried > 5 && (failed / tried) > 0.5;
            return `<div class="${failingMostly ? 'bg-rose-50 border border-rose-200' : 'bg-violet-50 border border-violet-200'} rounded-2xl p-3">
              <div class="flex items-center justify-between gap-2 mb-2">
                <div class="flex items-center gap-2 text-sm ${failingMostly ? 'text-rose-900' : 'text-violet-900'} font-black">
                  <i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>
                  ${failingMostly ? 'RD recusando — aguarde abort' : 'Enviando pro RD Marketing'}
                </div>
                <div class="text-xs ${failingMostly ? 'text-rose-700' : 'text-violet-700'} font-bold">
                  ${pushed} ok${failed ? ` · ${failed} falhas` : ''} de ${total} · ${pctSuccess}%
                </div>
              </div>
              <div class="w-full h-2 rounded-full bg-slate-100 overflow-hidden relative">
                <div class="h-full ${failingMostly ? 'bg-rose-500' : 'bg-violet-500'} transition-all" style="width:${pctSuccess}%"></div>
                <div class="absolute top-0 h-full bg-slate-300 opacity-50 transition-all" style="left:${pctSuccess}%; width:${Math.max(0, pctTried - pctSuccess)}%"></div>
              </div>
              <p class="text-[10px] ${failingMostly ? 'text-rose-700 font-black' : 'text-violet-700'} mt-2">
                ${failingMostly
                  ? '⚠️ Roxo/rosa = leads gravados. Cinza = tentativas falhando. Aborto em 5 falhas seguidas.'
                  : 'Barra colorida = leads de fato gravados no RD. Cinza = tentativas em curso.'}
              </p>
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

  // V34.7.g.4 — Layer ISOLADO entre Buscador e Leads Globais.
  // Dropdown rápido de banco quando NÃO há V34 search ativa.
  _bankQuickSelectorLayer() {
    const hasV34Search = Boolean(App.state.visitorSearchResults?.loadedAt);
    const banks = App.state.leadBanksCache?.banks || [];
    if (!banks.length && !App.state.leadBanksCache?.loadedAt && window.Actions?.loadLeadBanks) {
      setTimeout(() => Actions.loadLeadBanks(), 0);
    }
    if (hasV34Search || !banks.length) return '';
    return `<div class="bg-violet-50 border-2 border-violet-200 rounded-3xl p-4 mb-4 flex items-center gap-3 shadow-sm">
      <i data-lucide="database" class="w-5 h-5 text-violet-700 shrink-0"></i>
      <span class="text-xs font-black text-violet-900 uppercase tracking-wide whitespace-nowrap">Ver leads do banco:</span>
      <select onchange="Actions.quickPickBuscadorBank(this.value)" class="flex-1 px-4 py-2.5 rounded-2xl bg-white border-2 border-violet-300 font-bold text-sm focus:border-violet-500 outline-none">
        <option value="">— Selecione um banco —</option>
        ${banks.map(b => `<option value="${b.id}">${Utils.escape(b.name)}${b.is_default ? ' · default' : ''} · ${b.visitor_count || 0} lead(s)</option>`).join('')}
      </select>
      <span class="text-[11px] text-violet-700 hidden lg:block whitespace-nowrap">ou clique <b>Buscar</b> acima pra multi-banco</span>
    </div>`;
  },

  list(leads) {
    const avg = Math.round(leads.reduce((sum, lead) => sum + lead.globalScore, 0) / Math.max(leads.length, 1));
    const isProfile = App.state.profileActive && App.state.profileFilters.length > 0;
    const quentes = leads.filter(l => Number(l.globalScore || 0) >= 501).length;

    // V34.7.g.4 — Título dinâmico: muda pra "Leads do Banco X" quando V34 search ativo
    const sr = App.state.visitorSearchResults;
    const hasV34Search = Boolean(sr?.loadedAt);
    let title = 'Leads Globais';
    let subtitle = 'Base global consolidada de leads e presença comportamental.';
    if (isProfile) {
      title = 'Perfil Filtrado';
      subtitle = 'Resultado do perfil buscado.';
    } else if (hasV34Search && sr?.bankNames?.length) {
      if (sr.bankNames.length === 1 && sr.bankNames[0] !== 'Todos') {
        title = `Leads do Banco ${sr.bankNames[0]}`;
        subtitle = `Leads vinculados a este banco · ${leads.length} resultado(s).`;
      } else if (sr.bankNames.length > 1) {
        title = `Leads de ${sr.bankNames.length} bancos`;
        subtitle = `Vinculados a: ${sr.bankNames.join(' · ')}.`;
      } else {
        title = 'Leads (todos os bancos)';
        subtitle = `${leads.length} leads · base completa do tenant.`;
      }
    }

    return `<div class="space-y-4"><div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5"><div><h2 class="text-2xl font-black">${title}</h2><p class="text-sm text-slate-500">${subtitle}</p></div><div class="grid grid-cols-3 gap-2 text-center"><div class="bg-slate-50 rounded-2xl px-4 py-3"><div class="text-2xl font-black">${leads.length}</div><div class="text-xs text-slate-500">Leads</div></div><div class="bg-slate-50 rounded-2xl px-4 py-3"><div class="text-2xl font-black">${quentes}</div><div class="text-xs text-slate-500">Quentes</div></div><div class="bg-slate-50 rounded-2xl px-4 py-3"><div class="text-2xl font-black">${avg}</div><div class="text-xs text-slate-500">Score médio</div></div></div></div>${this._bulkLinkBar(leads)}<div class="grid gap-3">${leads.map(lead => this.card(lead)).join('') || Components.empty('Nenhum lead encontrado.')}</div></div></div>`;
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

  // V34.7.f.3 — Cor do badge de score por faixa (alinhado com hierarquia entity_type):
  //   0-333: cinza (suspect)
  //   334-500: amarelo (lead frio/morno)
  //   501-666: laranja (lead quente)
  //   667+: verde (customer)
  _scoreBadgeClasses(score) {
    const s = Number(score || 0);
    if (s >= 667) return { box: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'Customer' };
    if (s >= 501) return { box: 'bg-orange-50 border-orange-200', text: 'text-orange-700', label: 'Quente' };
    if (s >= 334) return { box: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Lead' };
    return { box: 'bg-slate-50 border-slate-200', text: 'text-slate-600', label: 'Frio' };
  },

  // V34.7.g — temperature UNIFICADA com globalScore V34 (substitui lead.temperature
  // legacy do ScoreEngine V11). Casa com _scoreBadgeClasses.
  _temperatureFromScore(score) {
    const s = Number(score || 0);
    if (s >= 667) return 'Customer';
    if (s >= 501) return 'Quente';
    if (s >= 334) return 'Morno';
    return 'Frio';
  },

  card(lead) {
    // V34.7.g — temperatura unificada via globalScore V34
    const temperature = this._temperatureFromScore(lead.globalScore);
    const tempClass = temperature === 'Customer' ? 'bg-emerald-100 text-emerald-700' : temperature === 'Quente' ? 'bg-red-100 text-red-700' : temperature === 'Morno' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-200 text-slate-700';
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
          <div class="flex items-center gap-2 mb-1"><h3 class="font-black text-lg">${Utils.escape(lead.name)}</h3><span class="px-3 py-1 rounded-full text-xs font-black ${tempClass}">${temperature}</span></div>
          <p class="text-sm text-slate-500">${Utils.escape(lead.email || 'sem email')} • ${Utils.escape(lead.phone || 'sem telefone')}</p>
          <p class="text-xs text-slate-400 mt-1">${Utils.escape([lead.sexo, lead.idade ? lead.idade + ' anos' : '', lead.cidade, lead.estado].filter(Boolean).join(' • ') || 'sem dados de perfil')}</p>
        </div>
        <div class="flex flex-col items-stretch gap-2">
          <div class="grid grid-cols-3 gap-2 text-center">
            ${(() => {
              const sb = this._scoreBadgeClasses(lead.globalScore);
              // V34.9.6 — Badge clicável abre modal "Score Breakdown".
              const vid = lead.internalId || lead.lj_visitor_id || lead.id || '';
              const clickable = Boolean(vid);
              const onClick = clickable ? `onclick="event.stopPropagation(); Actions.openScoreBreakdownModal('${String(vid).replace(/'/g, "\\'")}')"` : '';
              const cursorCls = clickable ? 'cursor-pointer hover:brightness-110 transition' : '';
              return `<div ${onClick} class="${sb.box} ${cursorCls} rounded-2xl px-3 py-2 border-2" title="${clickable ? 'Clique pra ver detalhamento item por item' : ''}"><div class="font-black text-xl ${sb.text}">${lead.globalScore || 0}</div><div class="text-[10px] font-black ${sb.text} uppercase tracking-wide">${sb.label}</div></div>`;
            })()}
            <div class="bg-white rounded-2xl px-3 py-2 border border-slate-100"><div class="font-black text-sm truncate">${Utils.escape(lead.lastChannel || '-')}</div><div class="text-xs text-slate-500">Canal</div></div>
            <div class="bg-white rounded-2xl px-3 py-2 border border-slate-100"><div class="font-black text-sm truncate">${lead.behaviorTags.length}</div><div class="text-xs text-slate-500">Tags</div></div>
          </div>
          ${linkBtn}
        </div>
      </div>
    </div>`;
  },

  detail(lead) {
    // V34.7.g — temperatura unificada via globalScore V34
    const temperature = this._temperatureFromScore(lead.globalScore);
    const tempClass = temperature === 'Customer' ? 'bg-emerald-100 text-emerald-700' : temperature === 'Quente' ? 'bg-red-100 text-red-700' : temperature === 'Morno' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-200 text-slate-700';
    // V33.0.0 — Se o lead foi capturado pelo tracker, mostra botão "Jornada Causal"
    const hasTrackerOrigin = (lead.actions || []).some(a => a.channel === 'tracker');
    const trackerVisitorId = hasTrackerOrigin ? lead.internalId : null;
    const trackerBtn = trackerVisitorId
      ? `<button onclick="Actions.loadVisitorDetail('${Utils.escape(String(trackerVisitorId))}')" class="ml-2 px-4 py-2 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-sm inline-flex items-center gap-1.5" style="color:#fff!important;"><i data-lucide="user-search" class="w-3.5 h-3.5"></i> Jornada Causal</button>`
      : '';
    // V34.7.a.2 — Indicador ✨ se nome foi enriquecido por heurística/Djow
    const tags = Array.isArray(lead.behaviorTags) ? lead.behaviorTags : [];
    const enrichedTag = tags.find(t => String(t).startsWith('lj-enriched-'));
    const enrichedBadge = enrichedTag
      ? `<span class="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 text-[10px] font-black" title="Nome enriquecido via ${enrichedTag === 'lj-enriched-djow' ? 'Djow (Claude)' : 'heurística email→nome'}"><i data-lucide="sparkles" class="w-2.5 h-2.5"></i> enriquecido</span>`
      : '';
    // V34.7.f.3 — Score badge colorido por faixa + bloco RFV breakdown
    const sb = this._scoreBadgeClasses(lead.globalScore);
    const visitorId = String(lead.internalId || lead.id || '');
    const scoreDetail = App.state.visitorScoreDetail?.[visitorId] || null;
    const scoreLoading = Boolean(App.state._visitorScoreLoading?.[visitorId]);

    return `<div class="space-y-4">
      <div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
        <div class="mb-4 flex items-center"><button onclick="App.state.selectedLeadId=null; App.save(); App.render();" class="px-4 py-2 rounded-2xl bg-slate-100 font-black text-sm">← Voltar para Leads</button>${trackerBtn}</div>
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5">
          <div>
            <div class="flex items-center gap-2 mb-2"><h2 class="text-2xl font-black">${Utils.escape(lead.name)}</h2><span class="px-3 py-1 rounded-full text-xs font-black ${tempClass}">${temperature}</span>${enrichedBadge}</div>
            <p class="text-sm text-slate-500">${Utils.escape(lead.email || 'sem email')} • ${Utils.escape(lead.phone || 'sem telefone')}</p>
          </div>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="${sb.box} rounded-2xl px-4 py-3 border-2">
              <div class="text-2xl font-black ${sb.text}">${lead.globalScore || 0}</div>
              <div class="text-[10px] font-black ${sb.text} uppercase tracking-wide">${sb.label}</div>
            </div>
            <div class="bg-slate-50 rounded-2xl px-4 py-3"><div class="text-2xl font-black">${lead.campaigns.length}</div><div class="text-xs text-slate-500">Campanhas</div></div>
            <div class="bg-slate-50 rounded-2xl px-4 py-3"><div class="text-2xl font-black">${lead.interactions}</div><div class="text-xs text-slate-500">Interações</div></div>
          </div>
        </div>
        <div class="grid lg:grid-cols-3 gap-4">
          <div class="bg-slate-50 rounded-3xl p-4 border border-slate-100"><h3 class="font-black text-lg mb-3">Dados de perfil</h3><div class="grid grid-cols-2 gap-2 text-xs">${this.profileCell('Sexo', lead.sexo)}${this.profileCell('Idade', lead.idade ? lead.idade + ' anos' : '')}${this.profileCell('Estado', lead.estado)}${this.profileCell('Cidade', lead.cidade)}${this.profileCell('Estado civil', lead.estadoCivil)}${this.profileCell('Faixa salarial', lead.faixaSalarial)}</div></div>
          <div class="lg:col-span-2 bg-slate-50 rounded-3xl p-4 border border-slate-100"><h3 class="font-black text-lg mb-3">Tags comportamentais</h3><div class="flex flex-wrap gap-2">${lead.behaviorTags.map(tag => `<span class="px-3 py-2 rounded-2xl bg-slate-900 text-white text-xs font-black">${Utils.escape(tag)}</span>`).join('') || '<span class="text-sm text-slate-500">Sem tags comportamentais</span>'}</div></div>
        </div>
      </div>

      <!-- V34.7.f.3 — Bloco Score RFV breakdown -->
      ${this._scoreRfvBlock(visitorId, lead, scoreDetail, scoreLoading)}

      <div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><h3 class="text-xl font-black mb-5">Timeline da Jornada</h3><div class="space-y-3">${lead.actions.map(item => this.timelineItem(item)).join('') || Components.empty('Sem eventos de jornada.')}</div></div>
    </div>`;
  },

  // V34.7.f.3 — Bloco "Composição do Score (RFV)" no detalhe do lead.
  // Mostra R, F, V com barras + breakdown dos 7 subcomponentes do V.
  _scoreRfvBlock(visitorId, lead, scoreDetail, loading) {
    if (!visitorId) return '';
    const hasDetail = scoreDetail && typeof scoreDetail.R === 'number';
    const bar = (val, color) => {
      const pct = Math.max(0, Math.min(100, Math.round((val || 0) * 100)));
      return `<div class="w-full h-2 rounded-full bg-slate-100 overflow-hidden"><div class="h-full bg-${color}-500 transition-all" style="width:${pct}%"></div></div>`;
    };
    return `<div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
      <div class="flex items-center justify-between gap-2 mb-4">
        <div class="flex items-center gap-2">
          <i data-lucide="gauge" class="w-5 h-5 text-violet-600"></i>
          <h3 class="text-lg font-black">Composição do Score (RFV)</h3>
        </div>
        <button ${loading ? 'disabled' : ''} onclick="Actions.loadVisitorScoreDetail('${Utils.escape(visitorId)}')" class="px-3 py-1.5 rounded-xl ${loading ? 'bg-slate-200 cursor-wait' : 'bg-violet-50 hover:bg-violet-100 text-violet-700'} font-black text-xs flex items-center gap-1.5">
          <i data-lucide="${loading ? 'loader-2' : 'refresh-cw'}" class="w-3 h-3 ${loading ? 'animate-spin' : ''}"></i>
          ${loading ? 'Recalculando...' : 'Recalcular'}
        </button>
      </div>
      ${!hasDetail ? `
        <p class="text-sm text-slate-500">Clique em <b>Recalcular</b> pra ver a composição matemática do score (Recency × Frequency × Value).</p>
      ` : `
        <div class="grid grid-cols-3 gap-3 mb-4">
          <div class="bg-blue-50 border border-blue-200 rounded-2xl p-3">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[10px] font-black text-blue-700 uppercase tracking-wider">Recency</span>
              <span class="text-sm font-black text-blue-900">${Math.round(scoreDetail.R * 100)}%</span>
            </div>
            ${bar(scoreDetail.R, 'blue')}
            <p class="text-[10px] text-blue-600 mt-2">Decay exponencial por tempo de inatividade. Peso: ${Math.round((scoreDetail.weights?.pR || 0.3) * 100)}%</p>
          </div>
          <div class="bg-orange-50 border border-orange-200 rounded-2xl p-3">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[10px] font-black text-orange-700 uppercase tracking-wider">Frequency</span>
              <span class="text-sm font-black text-orange-900">${Math.round(scoreDetail.F * 100)}%</span>
            </div>
            ${bar(scoreDetail.F, 'orange')}
            <p class="text-[10px] text-orange-600 mt-2">Logarítmica de eventos. Peso: ${Math.round((scoreDetail.weights?.pF || 0.3) * 100)}%</p>
          </div>
          <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Value</span>
              <span class="text-sm font-black text-emerald-900">${Math.round(scoreDetail.V * 100)}%</span>
            </div>
            ${bar(scoreDetail.V, 'emerald')}
            <p class="text-[10px] text-emerald-600 mt-2">7 subcomponentes. Peso: ${Math.round((scoreDetail.weights?.pV || 0.4) * 100)}%</p>
          </div>
        </div>

        ${scoreDetail.breakdown ? `
          <details class="bg-slate-50 rounded-2xl p-3 border border-slate-200">
            <summary class="text-xs font-black text-slate-700 uppercase tracking-wider cursor-pointer">Detalhes do Value (V)</summary>
            <div class="mt-3 space-y-1 text-xs">
              ${this._breakdownRow('Completude do perfil', scoreDetail.breakdown.completudePerfil, 'name+email+phone preenchidos')}
              ${this._breakdownRow('Engagement rate', scoreDetail.breakdown.engagementRate, 'tags positivas / total')}
              ${this._breakdownRow('Multi-canal bonus', scoreDetail.breakdown.multiCanalBonus, '# canais distintos / 5')}
              ${this._breakdownRow('Cross-banco bonus', scoreDetail.breakdown.crossBancoBonus, '# bancos do tenant / 3')}
              ${this._breakdownRow('Tag signal', scoreDetail.breakdown.tagSignal, 'saldo pos vs neg')}
              ${this._breakdownRow('Burst conversion', scoreDetail.breakdown.burstConversion, '1.0 se customer')}
              ${this._breakdownRow('Tempo no funil parado', scoreDetail.breakdown.tempoFunilPenalty, 'penalty se >30d parado', true)}
            </div>
          </details>

          <div class="mt-3 text-[11px] text-slate-500 font-mono">
            score = (R × pR + F × pF + V × pV) × hierarquia × 999<br>
            score = (${scoreDetail.R} × ${scoreDetail.weights?.pR || 0.3} + ${scoreDetail.F} × ${scoreDetail.weights?.pF || 0.3} + ${scoreDetail.V} × ${scoreDetail.weights?.pV || 0.4}) × hierarquia
            = <b class="text-slate-900">${scoreDetail.score}</b>
          </div>
        ` : ''}

        ${scoreDetail.campaignScores && scoreDetail.campaignScores.length ? `
          <div class="mt-4 pt-3 border-t border-slate-200">
            <p class="text-xs font-black text-slate-700 uppercase tracking-wider mb-2">Score por campanha</p>
            <div class="grid gap-1.5">
              ${scoreDetail.campaignScores.map(cs => {
                const csSb = this._scoreBadgeClasses(cs.score);
                return `<div class="flex items-center justify-between px-3 py-2 rounded-xl ${csSb.box} border">
                  <span class="text-xs font-bold text-slate-700">Campanha #${cs.campaignId}</span>
                  <span class="text-sm font-black ${csSb.text}">${cs.score} · ${csSb.label}</span>
                </div>`;
              }).join('')}
            </div>
          </div>
        ` : ''}
      `}
    </div>`;
  },

  _breakdownRow(label, value, hint, isPenalty = false) {
    const v = Number(value || 0);
    const pct = isPenalty ? Math.round(Math.abs(v) * 100) : Math.round(v * 100);
    const color = isPenalty && v < 0 ? 'rose' : v > 0.5 ? 'emerald' : v > 0.2 ? 'amber' : 'slate';
    return `<div class="flex items-center gap-2">
      <div class="flex-1 min-w-0">
        <div class="flex items-center justify-between">
          <span class="text-slate-700 font-bold">${label}</span>
          <span class="text-${color}-700 font-black">${isPenalty && v < 0 ? '-' : ''}${pct}%</span>
        </div>
        <div class="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden mt-0.5">
          <div class="h-full bg-${color}-500" style="width:${pct}%"></div>
        </div>
        <p class="text-[10px] text-slate-400 mt-0.5">${hint}</p>
      </div>
    </div>`;
  },

  profileCell(label, value) {
    return `<div class="bg-white rounded-xl p-2"><span class="text-slate-500">${label}</span><div class="font-black">${Utils.escape(value || '-')}</div></div>`;
  },

  timelineItem(item) {
    return `<div class="flex gap-3 items-start"><div class="w-3 h-3 rounded-full ${item.type === 'behavior' ? 'bg-slate-900' : 'bg-slate-300'} mt-2"></div><div class="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-4"><div class="flex flex-col lg:flex-row lg:items-center justify-between gap-2 mb-2"><div><p class="font-black">${Utils.escape(item.action)}</p><p class="text-xs text-slate-500">${Utils.escape(item.campaign)} • ${Utils.escape(item.channel)}</p></div><div class="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-black">Score ${item.score}</div></div><div class="flex flex-wrap gap-2 mt-3">${String(item.tags || '').split(' ').filter(Boolean).map(tag => `<span class="px-2 py-1 rounded-xl bg-slate-900 text-white text-[10px] font-black">${Utils.escape(tag)}</span>`).join('') || '<span class="text-xs text-slate-400">Sem tags</span>'}</div></div></div>`;
  }
};
window.LeadsModule = LeadsModule;
