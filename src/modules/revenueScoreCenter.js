// V18 — Revenue Score Center
// Substitui a render do menu Score. Lista campanhas com seus indicadores de
// Revenue Score e botões contextuais (Criar/Visualizar/Editar). Os modais
// Creator e Dashboard são renderizados aqui junto.
window.RevenueScoreCenter = {
  render() {
    const campaigns = App.state.campaigns || [];
    return `<div class="space-y-4">
      ${this._hero(campaigns)}
      ${this._campaignsPanel(campaigns)}
      ${window.RevenueScoreCreatorModal ? RevenueScoreCreatorModal.render() : ''}
      ${window.RevenueScoreDashboardModal ? RevenueScoreDashboardModal.render() : ''}
      ${this._postScoreSearchPrompt()}
    </div>`;
  },

  _postScoreSearchPrompt() {
    if (!App.state.showPostScoreSearchPrompt) return '';
    const campaignId = App.state.postScoreSearchCampaignId;
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    if (!campaign) return '';
    return `<div class="fixed inset-0 z-[95] bg-slate-950/85 backdrop-blur-sm grid place-items-center p-4">
      <div class="rounded-3xl bg-white shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden">
        <header class="bg-slate-950 text-white p-5">
          <div class="flex items-center gap-2 mb-2"><i data-lucide="search" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Próximo passo</p></div>
          <h3 class="text-xl font-black">Buscar leads aderentes para "${Utils.escape(campaign.name)}"?</h3>
          <p class="text-xs text-slate-300 mt-2">Revenue Score criado. Quer abrir o Buscador de Perfil já filtrando pela base global de leads com o ICP que você acabou de definir?</p>
        </header>
        <div class="p-5 flex flex-col gap-2">
          <button onclick="Actions.goToBuscadorWithContext()" class="px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center gap-2" style="color:#fff!important;"><i data-lucide="search" class="w-4 h-4"></i> Buscar leads agora</button>
          <button onclick="Actions.cancelPostScoreSearch()" class="px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black text-sm">Fazer depois</button>
        </div>
      </div>
    </div>`;
  },

  _hero(campaigns) {
    const total = campaigns.length;
    let withBlueprint = 0, totalLeads = 0, totalHot = 0;
    for (const c of campaigns) {
      const stats = RevenueScoreEngine.campaignStats(c);
      if (stats.hasBlueprint) withBlueprint += 1;
      totalLeads += stats.totalLeads;
      totalHot += stats.hotLeads;
    }
    return `<div class="bg-slate-950 text-white rounded-[2rem] p-5 shadow-sm overflow-hidden relative">
      <div class="absolute inset-0 opacity-60" style="background: radial-gradient(circle at 20% 10%, rgba(244,114,182,.22), transparent 28%), radial-gradient(circle at 80% 20%, rgba(99,102,241,.18), transparent 30%);"></div>
      <div class="relative z-10 grid lg:grid-cols-[1.2fr_1fr] gap-4 items-start">
        <div>
          <div class="flex items-center gap-2 mb-2"><i data-lucide="target" class="w-4 h-4"></i><p class="text-xs font-black text-slate-300 uppercase tracking-wider">Revenue Score Center</p></div>
          <h2 class="text-3xl font-black">Qualificação por campanha</h2>
          <p class="text-sm text-slate-300 max-w-3xl mt-2">Cada campanha pode ter um Revenue Score próprio — guiado por ICP, persona e sinais de intenção. Você não configura pesos: o Djow conduz a descoberta.</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          ${this._darkMetric('Campanhas', total, 'megaphone')}
          ${this._darkMetric('Com Revenue Score', withBlueprint, 'target')}
          ${this._darkMetric('Leads totais', totalLeads, 'users')}
          ${this._darkMetric('Leads quentes', totalHot, 'flame')}
        </div>
      </div>
    </div>`;
  },

  _darkMetric(label, value, icon) {
    return `<div class="bg-white/10 border border-white/10 rounded-2xl p-4"><div class="flex items-center justify-between"><p class="text-xs font-black text-slate-300">${Utils.escape(label)}</p><i data-lucide="${icon}" class="w-4 h-4 text-slate-300"></i></div><div class="text-3xl font-black mt-2">${value}</div></div>`;
  },

  _campaignsPanel(campaigns) {
    return `<div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
      <div class="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 class="text-xl font-black mb-1">Campanhas</h2>
          <p class="text-sm text-slate-500">Clique em <b>Criar Revenue Score</b> para iniciar a descoberta guiada com o Djow.</p>
        </div>
        <div class="text-3xl font-black">${campaigns.length}</div>
      </div>
      ${campaigns.length ? `<div class="space-y-3">${campaigns.map(c => this._card(c)).join('')}</div>` : Components.empty('Nenhuma campanha cadastrada. Crie uma campanha primeiro.')}
    </div>`;
  },

  _card(campaign) {
    const blueprint = RevenueScoreEngine.getBlueprint(campaign.id);
    let v2 = null;
    if (blueprint && window.LeadScoringV2) v2 = LeadScoringV2.classifyCampaign(campaign.id, { skipHistory: true });
    const s = v2?.summary;
    const lastUpd = blueprint?.updatedAt ? new Date(blueprint.updatedAt).toLocaleString('pt-BR') : '—';
    const segmentBadge = blueprint?.segment
      ? `<span class="px-2 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black">${Utils.escape(blueprint.segment)}</span>`
      : '<span class="px-2 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-500 text-[10px] font-black">Sem ICP</span>';
    const stats = s ? {
      fit: s.avgFit, intent: s.avgIntent, total: s.total, tierA: s.tier.A || 0, revReady: s.revenueReady
    } : null;
    // V21.2 — Estado de conexão do lead base: define tint do card + label do botão
    const linkedCount = window.LeadBaseService ? LeadBaseService.forCampaign(campaign.id).length : 0;
    const isConnected = linkedCount > 0;
    const cardTone = !blueprint
      ? 'border-slate-100 bg-slate-50'
      : isConnected
        ? 'border-emerald-200 bg-emerald-50/40'
        : 'border-rose-200 bg-rose-50/40';
    return `<div class="p-4 rounded-3xl border ${cardTone} hover:bg-slate-100 transition">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap mb-1">
            <h3 class="font-black text-lg">${Utils.escape(campaign.name)}</h3>
            ${segmentBadge}
          </div>
          <p class="text-xs text-slate-500">Último update: ${Utils.escape(lastUpd)}</p>
        </div>
        ${stats ? `<div class="grid grid-cols-5 gap-2 text-center w-full lg:w-[480px] shrink-0">
          <div class="bg-white rounded-2xl px-2 py-2"><div class="font-black text-lg">${stats.fit}%</div><div class="text-[10px] text-slate-500">Fit</div></div>
          <div class="bg-white rounded-2xl px-2 py-2"><div class="font-black text-lg">${stats.intent}%</div><div class="text-[10px] text-slate-500">Intent</div></div>
          <div class="bg-white rounded-2xl px-2 py-2"><div class="font-black text-lg">${stats.total}</div><div class="text-[10px] text-slate-500">Leads</div></div>
          <div class="bg-white rounded-2xl px-2 py-2"><div class="font-black text-lg text-emerald-600">${stats.tierA}</div><div class="text-[10px] text-slate-500">Tier A</div></div>
          <div class="bg-white rounded-2xl px-2 py-2"><div class="font-black text-lg text-red-600">${stats.revReady}</div><div class="text-[10px] text-slate-500">Rev. Ready</div></div>
        </div>` : '<div class="text-xs text-slate-400">Sem leitura ainda</div>'}
      </div>
      ${blueprint ? `<div class="rounded-2xl bg-white border border-slate-100 p-3 mb-3"><p class="text-[11px] text-slate-500 font-black uppercase tracking-wider mb-1">Perfil ideal</p><p class="text-sm text-slate-700">${Utils.escape(blueprint.profileSummary || '—')}</p></div>` : ''}
      <div class="flex flex-wrap gap-2">
        ${blueprint
          ? `<button onclick="Actions.openRevenueScoreDashboard(${campaign.id})" style="color:#fff!important;" class="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black flex items-center gap-1.5"><i data-lucide="eye" class="w-3.5 h-3.5"></i> Visualizar Revenue Score</button>
             <button onclick="Actions.openRevenueScoreCreator(${campaign.id}, true)" class="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-900 text-xs font-black flex items-center gap-1.5"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Editar Revenue Score</button>
             ${this._connectionButton(campaign.id, isConnected, linkedCount)}`
          : `<button onclick="Actions.openRevenueScoreCreator(${campaign.id}, false)" style="color:#fff!important;" class="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black flex items-center gap-1.5"><i data-lucide="sparkles" class="w-3.5 h-3.5"></i> Criar Revenue Score</button>`}
      </div>
    </div>`;
  },

  _connectionButton(campaignId, isConnected, linkedCount) {
    if (isConnected) {
      return `<button onclick="Actions.openConnectLeadsForCampaign(${campaignId})" style="color:#fff!important;" class="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center gap-1.5"><i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> Conectado a uma base de lead${linkedCount ? ` · ${linkedCount}` : ''}</button>`;
    }
    return `<button onclick="Actions.openConnectLeadsForCampaign(${campaignId})" style="color:#fff!important;" class="px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white text-xs font-black flex items-center gap-1.5"><i data-lucide="unlink" class="w-3.5 h-3.5"></i> Desconectado a uma base de lead</button>`;
  }
};
