var LeadsModule = {
  render() {
    const activeSubTab = App.state.activeLeadSubTab || 'profile';
    const subTabs = this.subTabs(activeSubTab);

    if (activeSubTab === 'pipeline') {
      return subTabs + JourneyPipelineModule.render();
    }

    const allLeads = this.getGlobalLeads();
    const selectedLead = allLeads.find(lead => lead.id === App.state.selectedLeadId) || null;
    if (selectedLead) return subTabs + this.detail(selectedLead);

    let displayLeads = allLeads;
    if (App.state.profileActive && App.state.profileFilters.length) {
      displayLeads = ProfileFinder.applyFilters(allLeads, App.state.profileFilters);
    }

    return subTabs + this._campaignContextChips() + this.profileFinderUI(displayLeads, allLeads.length) + this.importModal() + this.list(displayLeads, allLeads.length);
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
    const tabs = [
      { id: 'profile', label: 'Buscador de Perfil', icon: 'scan-search' },
      { id: 'pipeline', label: 'Journey Pipeline', icon: 'workflow' }
    ];
    return `<div class="bg-white rounded-3xl p-2 shadow-sm border border-slate-100 mb-4 grid md:grid-cols-2 gap-2">${tabs.map(tab => `<button onclick="JourneyPipelineModule.setLeadSubTab('${tab.id}')" class="px-4 py-3 rounded-2xl font-black text-sm flex items-center justify-center gap-2 ${activeSubTab === tab.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}"><i data-lucide="${tab.icon}" class="w-4 h-4"></i> ${tab.label}</button>`).join('')}</div>`;
  },

  getGlobalLeads() {
    const map = new Map();
    const fallbackScoreId = App.state.scores[0]?.id || 1;

    const upsertLead = (lead, context = {}) => {
      const scored = lead.score !== undefined ? lead : ScoreEngine.withScore(lead, context.scoreId || fallbackScoreId);
      const key = String(scored.email || scored.phone || scored.name).toLowerCase().trim();
      if (!key) return;

      if (!map.has(key)) {
        map.set(key, {
          id: key,
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

  profileFinderUI(filteredLeads, totalInBase) {
    const filters = App.state.profileFilters || [];
    const isActive = App.state.profileActive && filters.length > 0;
    const filtersHtml = filters.map((f, i) => `<span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-bold">${Utils.escape(f.label)}<button onclick="Actions.removeProfileFilter(${i})" class="ml-1 text-slate-400 hover:text-red-400 font-black">×</button></span>`).join(' ');
    const actionPanel = isActive && filteredLeads.length > 0 ? `<div class="mt-4 p-4 rounded-2xl bg-slate-50 border border-slate-200"><div class="flex flex-col md:flex-row md:items-center justify-between gap-3"><div><p class="font-black text-sm">${filteredLeads.length} lead(s) no perfil <span class="text-slate-400 font-normal">de ${totalInBase} na base</span></p><p class="text-xs text-slate-500">Aplique uma ação ou campanha a este grupo.</p></div><div class="flex gap-2"><button onclick="Actions.createActionFromProfile()" class="px-4 py-2.5 rounded-2xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800 flex items-center gap-2"><i data-lucide="plug" class="w-3.5 h-3.5"></i> Criar ação com este perfil</button><button onclick="Actions.createCampaignFromProfile()" class="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 font-bold text-sm hover:bg-slate-50 flex items-center gap-2"><i data-lucide="megaphone" class="w-3.5 h-3.5"></i> Nova campanha</button></div></div></div>` : '';
    const refineHtml = filters.length ? `<div class="flex flex-wrap gap-2 mb-3">${filtersHtml}</div><div class="flex gap-2"><input id="refineInput" placeholder="Refinar: cidade, estado, tag, faixa salarial, quente..." onkeydown="if(event.key==='Enter')Actions.refineProfile()" class="flex-1 px-4 py-3 rounded-2xl bg-slate-100 font-semibold" /><button onclick="Actions.refineProfile()" class="px-4 py-3 rounded-2xl bg-slate-200 font-bold text-sm hover:bg-slate-300">Refinar</button></div>` : '';

    return `<div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-4"><div class="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-4"><div><div class="flex items-center gap-2 mb-2"><i data-lucide="scan-search" class="w-5 h-5 text-slate-700"></i><h3 class="text-lg font-black">Buscador de Perfil</h3></div><p class="text-sm text-slate-500">Busca simples estilo Google: perfil + comportamento. Ex: <strong>mulheres de 30 a 40 anos do estado de São Paulo</strong>.</p></div><button onclick="Actions.openLeadImportModal()" class="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black text-sm flex items-center justify-center gap-2"><i data-lucide="user-plus" class="w-4 h-4"></i> Inserir leads</button></div><div class="flex gap-2 mb-3"><input id="profileInput" value="${Utils.escape(App.state.profileQuery)}" oninput="App.state.profileQuery=this.value; App.save();" onkeydown="if(event.key==='Enter')Actions.applyProfileSearch()" placeholder="Ex: mulheres de 30 a 40 anos de SP, #cta, quente..." class="flex-1 px-4 py-3 rounded-2xl bg-slate-100 font-semibold" /><button onclick="Actions.applyProfileSearch()" class="px-5 py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm hover:bg-slate-800">Buscar</button>${isActive ? `<button onclick="Actions.clearProfile()" class="px-4 py-3 rounded-2xl bg-slate-100 font-bold text-sm hover:bg-slate-200">Limpar</button>` : ''}</div>${refineHtml}${actionPanel}</div>`;
  },

  importModal() {
    if (!App.state.showLeadImportModal) return '';
    const mode = App.state.leadBaseInputMode || 'manual';
    return `<div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto"><div class="bg-white rounded-3xl p-5 shadow-2xl border border-slate-100 w-full max-w-3xl mt-8"><div class="flex items-start justify-between gap-3 mb-4"><div><h3 class="text-xl font-black">Inserir leads na base global</h3><p class="text-sm text-slate-500">Dados de perfil ficam separados das tags comportamentais. Ambos aparecem na busca.</p></div><button onclick="Actions.closeLeadImportModal()" class="w-10 h-10 rounded-2xl bg-slate-100 font-black text-xl">×</button></div><div class="grid grid-cols-2 gap-2 mb-4"><button onclick="Actions.setLeadBaseInputMode('manual')" class="px-4 py-2.5 rounded-2xl font-black text-sm ${mode === 'manual' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}">Manual</button><button onclick="Actions.setLeadBaseInputMode('csv')" class="px-4 py-2.5 rounded-2xl font-black text-sm ${mode === 'csv' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}">CSV</button></div>${mode === 'csv' ? this.csvImportUI() : this.manualImportUI()}</div></div>`;
  },

  manualImportUI() {
    const placeholder = 'Nome, Telefone, Email, Idade, Estado, Cidade, Estado Civil, Sexo, Faixa Salarial, Tags\nEx: Ana Souza, 11999999999, ana@email.com, 35, São Paulo, São Paulo, Casado(a), Feminino, R$ 5 mil a R$ 10 mil, #open #cta';
    return `<div class="space-y-3"><textarea oninput="App.state.leadManualText=this.value; App.save();" placeholder="${Utils.escape(placeholder)}" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold min-h-[180px]">${Utils.escape(App.state.leadManualText || '')}</textarea><p class="text-xs text-slate-500">Uma linha por lead. Ordem: Nome, Telefone, Email, Idade, Estado, Cidade, Estado Civil, Sexo, Faixa Salarial, Tags.</p><div class="flex flex-col md:flex-row gap-2"><button onclick="Actions.importManualLeadsFromText()" class="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black">Importar lead(s)</button><button onclick="Actions.closeLeadImportModal()" class="px-5 py-3 rounded-2xl bg-slate-100 font-black">Cancelar</button></div></div>`;
  },

  csvImportUI() {
    return `<div class="space-y-3"><div class="flex flex-col md:flex-row gap-2"><button onclick="Actions.downloadGlobalLeadCsvTemplate()" class="px-4 py-3 rounded-2xl bg-white border border-slate-200 font-bold text-sm">Baixar modelo CSV</button><label class="px-4 py-3 rounded-2xl bg-slate-900 text-white font-bold text-sm cursor-pointer text-center">Selecionar CSV<input type="file" accept=".csv" class="hidden" onchange="Actions.handleGlobalLeadCSV(event)" /></label></div><textarea oninput="App.state.leadCsvText=this.value; App.save();" placeholder="Nome,Telefone,Email,Idade,Estado,Cidade,Estado Civil,Sexo,Faixa Salarial,Tags" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold min-h-[150px]">${Utils.escape(App.state.leadCsvText || '')}</textarea><p class="text-xs text-slate-500">Colunas aceitas: Nome, Telefone, Email, Idade, Estado, Cidade, Estado Civil, Sexo, Faixa Salarial, Tags. Tags = comportamento.</p><div class="flex flex-col md:flex-row gap-2"><button onclick="Actions.importGlobalLeadsFromCsv()" class="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black">Importar CSV para base global</button><button onclick="Actions.closeLeadImportModal()" class="px-5 py-3 rounded-2xl bg-slate-100 font-black">Cancelar</button></div></div>`;
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
    return `<div class="space-y-4"><div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><button onclick="App.state.selectedLeadId=null; App.save(); App.render();" class="mb-4 px-4 py-2 rounded-2xl bg-slate-100 font-black text-sm">← Voltar para Leads</button><div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5"><div><div class="flex items-center gap-2 mb-2"><h2 class="text-2xl font-black">${Utils.escape(lead.name)}</h2><span class="px-3 py-1 rounded-full text-xs font-black ${tempClass}">${lead.temperature}</span></div><p class="text-sm text-slate-500">${Utils.escape(lead.email || 'sem email')} • ${Utils.escape(lead.phone || 'sem telefone')}</p></div><div class="grid grid-cols-3 gap-2 text-center"><div class="bg-slate-50 rounded-2xl px-4 py-3"><div class="text-2xl font-black">${lead.globalScore}</div><div class="text-xs text-slate-500">Score Global</div></div><div class="bg-slate-50 rounded-2xl px-4 py-3"><div class="text-2xl font-black">${lead.campaigns.length}</div><div class="text-xs text-slate-500">Campanhas</div></div><div class="bg-slate-50 rounded-2xl px-4 py-3"><div class="text-2xl font-black">${lead.interactions}</div><div class="text-xs text-slate-500">Interações</div></div></div></div><div class="grid lg:grid-cols-3 gap-4"><div class="bg-slate-50 rounded-3xl p-4 border border-slate-100"><h3 class="font-black text-lg mb-3">Dados de perfil</h3><div class="grid grid-cols-2 gap-2 text-xs">${this.profileCell('Sexo', lead.sexo)}${this.profileCell('Idade', lead.idade ? lead.idade + ' anos' : '')}${this.profileCell('Estado', lead.estado)}${this.profileCell('Cidade', lead.cidade)}${this.profileCell('Estado civil', lead.estadoCivil)}${this.profileCell('Faixa salarial', lead.faixaSalarial)}</div></div><div class="lg:col-span-2 bg-slate-50 rounded-3xl p-4 border border-slate-100"><h3 class="font-black text-lg mb-3">Tags comportamentais</h3><div class="flex flex-wrap gap-2">${lead.behaviorTags.map(tag => `<span class="px-3 py-2 rounded-2xl bg-slate-900 text-white text-xs font-black">${Utils.escape(tag)}</span>`).join('') || '<span class="text-sm text-slate-500">Sem tags comportamentais</span>'}</div></div></div></div><div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><h3 class="text-xl font-black mb-5">Timeline da Jornada</h3><div class="space-y-3">${lead.actions.map(item => this.timelineItem(item)).join('') || Components.empty('Sem eventos de jornada.')}</div></div></div>`;
  },

  profileCell(label, value) {
    return `<div class="bg-white rounded-xl p-2"><span class="text-slate-500">${label}</span><div class="font-black">${Utils.escape(value || '-')}</div></div>`;
  },

  timelineItem(item) {
    return `<div class="flex gap-3 items-start"><div class="w-3 h-3 rounded-full ${item.type === 'behavior' ? 'bg-slate-900' : 'bg-slate-300'} mt-2"></div><div class="flex-1 bg-slate-50 border border-slate-100 rounded-2xl p-4"><div class="flex flex-col lg:flex-row lg:items-center justify-between gap-2 mb-2"><div><p class="font-black">${Utils.escape(item.action)}</p><p class="text-xs text-slate-500">${Utils.escape(item.campaign)} • ${Utils.escape(item.channel)}</p></div><div class="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-black">Score ${item.score}</div></div><div class="flex flex-wrap gap-2 mt-3">${String(item.tags || '').split(' ').filter(Boolean).map(tag => `<span class="px-2 py-1 rounded-xl bg-slate-900 text-white text-[10px] font-black">${Utils.escape(tag)}</span>`).join('') || '<span class="text-xs text-slate-400">Sem tags</span>'}</div></div></div>`;
  }
};
window.LeadsModule = LeadsModule;
