var ActionModule = {
  render() {
    const selectedCampaign = App.getSelectedCampaign();
    if (!selectedCampaign) return this.emptyActionsState();
    const actions = App.state.actions.filter(action => Number(action.campaignId) === Number(selectedCampaign.id));
    const product = App.state.products.find(p => Number(p.id) === Number(selectedCampaign.productId));
    return `<div class="space-y-4">
      ${this.actionLayer(selectedCampaign, product, actions)}
      <div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-4"><div class="grid md:grid-cols-[1fr_auto] gap-3 md:items-end"><div><p class="text-xs font-black text-slate-500">Campanha selecionada</p><h2 class="text-2xl font-black">${Utils.escape(selectedCampaign.name)}</h2><p class="text-sm text-slate-500 mt-1">Produto: ${Utils.escape(product?.name || 'não vinculado')} • A ação é onde os OKRs nascem e alimentam funil, setor e Revenue Intelligence.</p></div><div><label class="text-xs font-black text-slate-500">Trocar campanha</label><select onchange="Actions.selectCampaignFromActions(Number(this.value))" class="w-full md:w-72 px-4 py-3 rounded-2xl bg-slate-100 font-bold">${App.state.campaigns.map(campaign => `<option value="${campaign.id}" ${campaign.id === selectedCampaign.id ? 'selected' : ''}>${Utils.escape(campaign.name)}</option>`).join('')}</select></div></div></div>
      <div class="grid lg:grid-cols-3 gap-4"><div class="lg:col-span-1 bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><h2 class="text-xl font-black mb-1">Criar ação</h2><p class="text-sm text-slate-500 mb-4">Defina contexto operacional, origem, destino e base de leads.</p>${this._createTabs()}${App.state.actionCreateTab === 'ai' ? this._aiCreatePanel() : this._manualCreatePanel()}</div><div class="lg:col-span-2 bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><div class="flex items-start justify-between gap-3 mb-3"><div><h2 class="text-xl font-black mb-1">Ações plugadas</h2><p class="text-sm text-slate-500">Cada ação possui canal, KPIs, fluxo transversal, leads, score, conexão e resultado próprio.</p></div><button onclick="Actions.openFlowBuilder(${selectedCampaign.id})" class="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-2 whitespace-nowrap" style="color:#fff!important;"><i data-lucide="git-merge" class="w-3.5 h-3.5"></i> Construir Fluxo</button></div>${this._actionsListFilter(actions)}<div class="space-y-3">${this._filteredActionsList(actions)}</div></div></div>
      ${ActionFlowModal.render()}
      ${window.ActionEditModal ? ActionEditModal.render() : ''}
      ${window.ActionFlowBuilder ? ActionFlowBuilder.render(App.state.flowBuilderCampaignId) : ''}
      ${window.ActionLpModal ? ActionLpModal.render() : ''}
      ${window.DjowModal ? DjowModal.render() : ''}
      ${window.TasksModal ? TasksModal.render() : ''}
      ${window.StrategicMapModal ? StrategicMapModal.render() : ''}
    </div>`;
  },
  emptyActionsState() {
    return `<div class="space-y-4">
      ${this.actionLayer(null, null, [])}
      <div class="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 text-center">
        <h2 class="text-2xl font-black mb-2">Nenhuma campanha selecionada</h2>
        <p class="text-sm text-slate-500 mb-5">Para criar ações, siga o fluxo: produto → campanha → ação.</p>
        <div class="flex flex-col md:flex-row gap-2 justify-center">
          <button onclick="App.setTab('products')" class="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-900 font-black">Ir para Produtos</button>
          <button onclick="App.setTab('campaigns')" class="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black lj-dark-button" style="color:#fff!important;">Criar Campanha</button>
        </div>
      </div>
    </div>`;
  },


  actionLayer(selectedCampaign, product, actions = []) {
    const totalActions = actions.length;
    const leads = actions.reduce((sum, action) => sum + (action.leads?.length || 0), 0);
    const score = actions.length ? Math.round(actions.reduce((sum, action) => sum + Number(action.score || 0), 0) / actions.length) : 0;
    const flows = actions.map(action => FlowResolutionEngine.buildActionFlow(action));
    const converted = flows.reduce((sum, flow) => sum + Number(flow.converted || 0), 0);
    const conversion = leads ? Math.round((converted / leads) * 1000) / 10 : 0;
    return `<div class="bg-slate-950 text-white rounded-[2rem] p-5 shadow-sm overflow-hidden relative">
      <div class="absolute inset-0 opacity-60" style="background: radial-gradient(circle at 20% 10%, rgba(99,102,241,.22), transparent 28%), radial-gradient(circle at 80% 20%, rgba(14,165,233,.16), transparent 30%);"></div>
      <div class="relative z-10 grid lg:grid-cols-[1.2fr_1fr] gap-4 items-start">
        <div>
          <div class="flex items-center gap-2 mb-2"><i data-lucide="plug" class="w-4 h-4"></i><p class="text-xs font-black text-slate-300 uppercase tracking-wider">Action Operational Layer</p></div>
          <h2 class="text-3xl font-black">Ações da campanha</h2>
          <p class="text-sm text-slate-300 max-w-3xl mt-2">Camada de execução: ações vinculadas à campanha, origem e destino do funil, base de leads, score, conversões e leitura operacional.</p>
          <p class="text-xs text-slate-400 mt-3">Campanha: <b class="text-white">${Utils.escape(selectedCampaign?.name || 'nenhuma selecionada')}</b> • Produto: <b class="text-white">${Utils.escape(product?.name || 'não vinculado')}</b></p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          ${this.darkMetric('Ações', totalActions, 'plug')}
          ${this.darkMetric('Leads', leads, 'users')}
          ${this.darkMetric('Score médio', score, 'gauge')}
          ${this.darkMetric('Conversão', `${conversion}%`, 'arrow-right-left')}
        </div>
      </div>
    </div>`;
  },

  darkMetric(label, value, icon) { return `<div class="bg-white/10 border border-white/10 rounded-2xl p-4"><div class="flex items-center justify-between"><p class="text-xs font-black text-slate-300">${label}</p><i data-lucide="${icon}" class="w-4 h-4 text-slate-300"></i></div><div class="text-3xl font-black mt-2">${value}</div></div>`; },

  _createTabs() {
    const tab = App.state.actionCreateTab || 'manual';
    const cls = (active) => `flex-1 px-3 py-2.5 rounded-xl text-xs font-black text-center transition ${active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`;
    return `<div class="flex gap-2 p-1 rounded-2xl bg-slate-100 mb-4">
      <button onclick="Actions.setActionCreateTab('manual')" class="${cls(tab === 'manual')}" ${tab === 'manual' ? 'style="color:#fff!important;"' : ''}>Ações Manuais</button>
      <button onclick="Actions.setActionCreateTab('ai')" class="${cls(tab === 'ai')}" ${tab === 'ai' ? 'style="color:#fff!important;"' : ''}>Ações via IA</button>
    </div>`;
  },

  _manualCreatePanel() {
    return `${this.form()}<div class="mt-4 pt-4 border-t border-slate-100"><button onclick="Actions.openLpModal()" class="w-full px-4 py-3 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-black text-sm flex items-center justify-center gap-2" style="color:#fff!important;"><i data-lucide="layout" class="w-4 h-4"></i> Criar ação LP especializada</button><p class="text-[11px] text-slate-400 mt-2 text-center">Use o modal de LP quando a ação for uma página com tracking, checkpoints e movimentação automática.</p></div>`;
  },

  _aiCreatePanel() {
    const ai = App.state.actionAiDraft || { prompt: '', count: 3 };
    return `<div class="space-y-3">
      <textarea oninput="Actions.updateActionAiDraft('prompt', this.value)" placeholder="Converse com a IA. Ex: gere 3 posts orgânicos para nutrir leads MOF que baixaram o ebook." class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold min-h-[260px]">${Utils.escape(ai.prompt)}</textarea>
      <button onclick="Actions.generateActionsViaAI()" style="color:#fff!important;" class="w-full px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black flex items-center justify-center gap-2"><i data-lucide="sparkles" class="w-4 h-4"></i> Gerar ações com IA</button>
    </div>`;
  },

  operationalFlowRail(campaign, product) {
    return `<div class="lj-operational-rail bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
      <div class="lj-flow-rail-grid text-sm" style="display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important;align-items:stretch!important;width:100%!important;">
        <button onclick="App.setTab('products')" style="min-height:88px!important;width:100%!important;display:grid!important;grid-template-columns:36px minmax(0,1fr)!important;gap:10px!important;align-items:center!important;justify-content:initial!important;text-align:left!important;" class="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-black text-left lj-flow-step"><span class="lj-flow-step-number">1</span><span><span class="lj-flow-step-title">Produto</span><span class="lj-flow-step-subtitle">${Utils.escape(product?.name || 'Escolher produto')}</span></span></button>
        <button onclick="${product ? `Actions.goToProductCampaigns(${product.id})` : `App.setTab('campaigns')`}" style="min-height:88px!important;width:100%!important;display:grid!important;grid-template-columns:36px minmax(0,1fr)!important;gap:10px!important;align-items:center!important;justify-content:initial!important;text-align:left!important;" class="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-black text-left lj-flow-step"><span class="lj-flow-step-number">2</span><span><span class="lj-flow-step-title">Campanhas</span><span class="lj-flow-step-subtitle">${Utils.escape(campaign?.name || 'Criar campanha')}</span></span></button>
        <button onclick="App.setTab('actions')" style="min-height:88px!important;width:100%!important;display:grid!important;grid-template-columns:36px minmax(0,1fr)!important;gap:10px!important;align-items:center!important;justify-content:initial!important;text-align:left!important;" class="px-4 py-3 rounded-2xl border border-slate-900 bg-slate-900 text-white font-black text-left lj-flow-step"><span class="lj-flow-step-number">3</span><span><span class="lj-flow-step-title">Ações</span><span class="lj-flow-step-subtitle">Executar</span></span></button>
        <button onclick="App.setTab('results')" style="min-height:88px!important;width:100%!important;display:grid!important;grid-template-columns:36px minmax(0,1fr)!important;gap:10px!important;align-items:center!important;justify-content:initial!important;text-align:left!important;" class="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-black text-left lj-flow-step"><span class="lj-flow-step-number">4</span><span><span class="lj-flow-step-title">Leitura</span><span class="lj-flow-step-subtitle">Resultado da campanha</span></span></button>
      </div>
    </div>`;
  },

  form() {
    const d = App.state.actionDraft;
    const path = FlowResolutionEngine.resolve(d.originSector, d.originFunnel, d.destinationSector, d.destinationFunnel);
    return `<div class="space-y-3">
      <div><label class="text-xs font-black text-slate-500">Nome da ação</label><input value="${Utils.escape(d.name)}" oninput="App.state.actionDraft.name=this.value; App.save();" placeholder="Ex: Post orgânico Instagram" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" /></div>
      <div class="rounded-3xl bg-slate-50 border border-slate-100 p-4"><h3 class="font-black mb-3">Contexto operacional</h3><div class="grid grid-cols-2 gap-2"><div><label class="text-xs font-black text-slate-500">Setor</label><select onchange="Actions.updateActionContext('sector', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold">${Config.sectors.map(s => `<option ${d.sector === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div><div><label class="text-xs font-black text-slate-500">Funil</label><select onchange="Actions.updateActionContext('funnel', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold">${Config.funnels.map(f => `<option ${d.funnel === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div><div><div class="flex items-center justify-between mb-1"><label class="text-xs font-black text-slate-500">Canal</label><button onclick="Actions.addCustomChannel()" title="Adicionar novo canal" class="text-[10px] font-black text-indigo-600 hover:text-indigo-700 flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i>Adicionar Canal</button></div><select onchange="Actions.updateActionContext('channel', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold">${Config.allChannels().map(channel => `<option value="${Utils.escape(channel)}" ${d.channel === channel ? 'selected' : ''}>${Utils.escape(channel)}</option>`).join('')}</select></div><div><div class="flex items-center justify-between mb-1"><label class="text-xs font-black text-slate-500">Tipo</label><button onclick="Actions.addCustomActionType()" title="Adicionar novo tipo" class="text-[10px] font-black text-indigo-600 hover:text-indigo-700 flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i>Adicionar Tipo</button></div><select onchange="Actions.updateActionContext('actionType', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold">${Config.allActionTypes().map(t => `<option ${d.actionType === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div></div>
      <div class="rounded-3xl bg-slate-50 border border-slate-100 p-4">
        <h3 class="font-black mb-1">Travessia da ação</h3>
        <p class="text-xs text-slate-500 mb-3">A origem é definida automaticamente pelo Contexto operacional: <b>${Utils.escape(d.sector || 'Marketing')} ${Utils.escape(d.funnel || 'MOF')}</b>. Aqui você só define onde a ação deve terminar.</p>
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div><label class="text-xs font-black text-slate-500">Destino setor</label><select onchange="Actions.updateActionContext('destinationSector', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold">${Config.sectors.map(s => `<option ${d.destinationSector === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
          <div><label class="text-xs font-black text-slate-500">Destino funil</label><select onchange="Actions.updateActionContext('destinationFunnel', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold">${Config.funnels.map(f => `<option ${d.destinationFunnel === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
        </div>
        <div class="text-xs font-black text-slate-500 mb-2">Fluxo obrigatório resolvido automaticamente</div>
        <div class="flex flex-wrap gap-2">${path.map((stage, index) => `<span class="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-black">${index + 1}. ${FlowResolutionEngine.label(stage)}</span>`).join('')}</div>
      </div>
      <div><label class="text-xs font-black text-slate-500">Descrição da Ação</label><textarea oninput="App.state.actionDraft.objective=this.value; App.save();" placeholder="Qual sinal esta ação precisa gerar?" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold min-h-[80px]">${Utils.escape(d.objective)}</textarea></div>
      ${this.rdEmailFields ? this.rdEmailFields(d, path) : ''}${this.rdKpiMappingPanel ? this.rdKpiMappingPanel(d) : ''}
      <div class="rounded-3xl bg-slate-50 border border-slate-100 p-4"><div class="flex items-center justify-between gap-3 mb-3"><div><h3 class="font-black">Mailing definido?</h3><p class="text-xs text-slate-500">Ligue para inserir uma base de mailing nesta ação.</p></div><div class="flex rounded-2xl bg-white border border-slate-200 p-1"><button onclick="Actions.setMailingDefined(true)" class="px-4 py-2 rounded-xl text-xs font-black ${d.mailingDefined ? 'bg-slate-900 text-white' : 'text-slate-500'}">Sim</button><button onclick="Actions.setMailingDefined(false)" class="px-4 py-2 rounded-xl text-xs font-black ${!d.mailingDefined ? 'bg-slate-900 text-white' : 'text-slate-500'}">Não</button></div></div><div class="${d.mailingDefined ? '' : 'opacity-40 pointer-events-none select-none'}"><div class="grid grid-cols-3 gap-2"><button onclick="Actions.setLeadInputMode('manual')" class="px-3 py-2 rounded-2xl text-sm font-black ${d.leadInputMode === 'manual' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700'}">Manual</button><button onclick="Actions.setLeadInputMode('csv')" class="px-3 py-2 rounded-2xl text-sm font-black ${d.leadInputMode === 'csv' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700'}">CSV</button><button onclick="Actions.setLeadInputMode('rd')" class="px-3 py-2 rounded-2xl text-sm font-black ${d.leadInputMode === 'rd' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700'}">RD</button></div><div class="mt-3">${this.leadInput()}</div></div></div>${d.mailingDefined ? this.scorePreview() : '<div class="rounded-3xl bg-slate-50 border border-slate-100 p-4 opacity-50"><h3 class="font-black">Preview de mailing desabilitado</h3><p class="text-sm text-slate-500">Ative “Mailing definido?” para inserir base e visualizar o score.</p></div>'}
      <button onclick="Actions.createAction()" style="color:#fff!important;" class="w-full px-5 py-3 rounded-2xl bg-slate-900 text-white font-black lj-dark-button">Criar ação plugada</button>
    </div>`;
  },
  okrRow(okr, index) { return `<div class="grid grid-cols-[1fr_74px_74px_auto] gap-2"><input value="${Utils.escape(okr.name)}" oninput="Actions.updateActionDraftOkr(${index}, 'name', this.value)" placeholder="Nome do KPI" class="w-full px-3 py-2.5 rounded-2xl bg-white border border-slate-200 font-semibold text-sm" /><input value="${Utils.escape(okr.target || '')}" oninput="Actions.updateActionDraftOkr(${index}, 'target', this.value)" placeholder="Meta" class="w-full px-3 py-2.5 rounded-2xl bg-white border border-slate-200 font-black text-sm" /><input value="${Utils.escape(okr.current || '')}" oninput="Actions.updateActionDraftOkr(${index}, 'current', this.value)" placeholder="Atual" class="w-full px-3 py-2.5 rounded-2xl bg-white border border-slate-200 font-black text-sm" /><button onclick="Actions.removeActionDraftOkr(${index})" class="px-3 py-2 rounded-2xl bg-white border border-slate-200 text-red-500 font-black">×</button></div>`; },
  leadInput() {
    if (App.state.actionDraft.leadInputMode === 'csv') return `<div class="rounded-3xl bg-slate-50 border border-slate-100 p-4"><div class="flex gap-2 mb-3"><button onclick="Actions.downloadCsvTemplate()" class="px-3 py-2 rounded-2xl bg-white border border-slate-200 font-bold text-sm">Modelo</button><label class="px-3 py-2 rounded-2xl bg-slate-900 text-white font-bold text-sm cursor-pointer">Selecionar CSV<input type="file" accept=".csv" class="hidden" onchange="Actions.handleActionCSV(event)" /></label></div>${this.leadTextArea()}</div>`;
    if (App.state.actionDraft.leadInputMode === 'rd') return `<div class="rounded-3xl bg-slate-50 border border-slate-100 p-4"><label class="text-xs font-black text-slate-500">Lista RD</label><input value="${Utils.escape(App.state.actionDraft.rdListName)}" oninput="App.state.actionDraft.rdListName=this.value; App.save();" placeholder="Ex: Lista RD - Maio" class="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-semibold mb-3" /><button onclick="Actions.importFromRDMock()" class="w-full px-4 py-3 rounded-2xl bg-slate-900 text-white font-black mb-3">Simular importação RD</button>${this.leadTextArea()}</div>`;
    return `<div class="rounded-3xl bg-slate-50 border border-slate-100 p-4"><div class="flex items-center justify-between gap-2 mb-3"><p class="text-sm text-slate-500">Formato: nome, email, telefone, tags</p><button onclick="Actions.loadLeadExample()" class="px-3 py-2 rounded-2xl bg-white border border-slate-200 font-bold text-sm">Exemplo</button></div>${this.leadTextArea()}</div>`;
  },
  leadTextArea() { return `<textarea oninput="App.state.actionDraft.leadsText=this.value; App.save();" placeholder="Nome do Lead, email@empresa.com, 48999999999, #tag_exemplo" class="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-semibold min-h-[150px]">${Utils.escape(App.state.actionDraft.leadsText)}</textarea>`; },
  scorePreview() { const leads = LeadParser.parse(App.state.actionDraft.leadsText, Number(App.state.actionDraft.scoreId)); const avgScore = leads.length ? Math.round(leads.reduce((sum, lead) => sum + lead.score, 0) / leads.length) : 0; const hotLeads = leads.filter(lead => lead.score >= 45).length; const selectedScore = ScoreEngine.getById(Number(App.state.actionDraft.scoreId)); return `<div class="rounded-3xl bg-slate-50 border border-slate-100 p-4"><div class="flex items-start justify-between gap-3 mb-4"><div><h3 class="font-black">Preview com score selecionado</h3><p class="text-xs text-slate-500">${Utils.escape(selectedScore?.name || 'Score não encontrado')}</p></div><button onclick="App.setTab('scores')" class="px-3 py-2 rounded-xl bg-white border border-slate-200 font-bold text-sm">Editar scores</button></div><div class="grid grid-cols-3 gap-2 text-center mb-4"><div class="bg-white rounded-2xl p-3"><div class="font-black text-xl">${leads.length}</div><div class="text-xs text-slate-500">Leads</div></div><div class="bg-white rounded-2xl p-3"><div class="font-black text-xl">${avgScore}</div><div class="text-xs text-slate-500">Score médio</div></div><div class="bg-white rounded-2xl p-3"><div class="font-black text-xl">${hotLeads}</div><div class="text-xs text-slate-500">45+</div></div></div><div class="space-y-2 max-h-56 overflow-auto">${leads.map(Components.leadPreview).join('') || Components.empty('Nenhum lead inserido.')}</div></div>`; },
  card(action) {
    // V29.2.3 — Defensivo: ações estratégicas criadas antes do V29.2.3
    // podem não ter leads/okrs/flowPath setados (causava TypeError).
    if (!Array.isArray(action.leads)) action.leads = [];
    if (!Array.isArray(action.okrs)) action.okrs = [];
    if (!Array.isArray(action.flowPath)) action.flowPath = [];
    const visual = this.visual(action);
    const leads = ScoreEngine.actionLeads(action);
    const avgScore = leads.length ? Math.round(leads.reduce((sum, lead) => sum + (lead.score || 0), 0) / leads.length) : 0;
    const scorePreset = ScoreEngine.getById(action.scoreId);
    const flow = FlowResolutionEngine.buildActionFlow(action);
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId));
    const krTag = this._linkedKrTag(action, campaign);
    return `<div class="lj-entity-card relative p-4 rounded-3xl bg-slate-50 border border-slate-100">
      <button onclick="event.stopPropagation(); Actions.openActionEditModal(${action.id})" title="Editar Ação" aria-label="Editar Ação" class="absolute top-3 right-3 w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 grid place-items-center shadow-sm"><i data-lucide="settings" class="w-4 h-4"></i></button>
      <div class="flex flex-col gap-4">
        <div class="lj-entity-card-grid">
          <div class="lj-entity-copy flex items-start gap-3 pr-12">
            <div class="w-3 h-3 rounded-full mt-2 ${visual.dotClass}"></div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-black text-lg">${Utils.escape(action.name)}</h3>
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-black text-slate-700"><i data-lucide="radio" class="w-3 h-3"></i> ${Utils.escape(action.channel)}</span>
              </div>
              <p class="text-sm text-slate-500 mt-1">${Utils.escape(action.sector || 'Marketing')} ${Utils.escape(action.funnel || 'MOF')} → ${Utils.escape(action.destinationSector || action.sector || 'Marketing')} ${Utils.escape(action.destinationFunnel || action.funnel || 'MOF')}</p>
              <p class="text-xs text-slate-400 mt-2 truncate" title="${action.leads.length} leads • score médio ${avgScore} • ${Utils.escape(scorePreset?.name || 'sem score')} • ${flow.path.length} etapas">${action.leads.length} leads • score médio ${avgScore} • ${Utils.escape(scorePreset?.name || 'sem score')} • ${flow.path.length} etapas</p>
            </div>
          </div>
          <div class="lj-entity-metrics">
            <div class="grid grid-cols-3 gap-2 text-center">
              <div class="bg-white rounded-2xl px-3 py-2"><div class="font-black">${action.leads.length}</div><div class="text-xs text-slate-500">Leads</div></div>
              <div class="bg-white rounded-2xl px-3 py-2"><div class="font-black">${avgScore}</div><div class="text-xs text-slate-500">Score</div></div>
              <div class="bg-white rounded-2xl px-3 py-2"><div class="font-black">${flow.path.length}</div><div class="text-xs text-slate-500">Etapas</div></div>
            </div>
          </div>
          <div class="flex flex-col items-end justify-end gap-2 min-w-[220px]">
            <button onclick="event.stopPropagation(); Actions.openActionFlowModal(${action.id})" style="color:#fff!important;" class="w-full px-4 py-2.5 rounded-2xl bg-slate-900 text-white font-bold text-xs lj-dark-button flex items-center justify-center gap-1.5"><i data-lucide="map" class="w-3.5 h-3.5"></i> Ver Fluxo da Ação</button>
            <div class="grid grid-cols-2 gap-2 w-full">
              <button onclick="event.stopPropagation(); Actions.openDjowModal(${action.id})" class="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] flex items-center justify-center gap-1.5" style="color:#fff!important;"><i data-lucide="sparkles" class="w-3 h-3"></i> Criar Tarefas</button>
              <button onclick="event.stopPropagation(); Actions.openTasksModal(${action.id})" class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-[11px] flex items-center justify-center gap-1.5"><i data-lucide="list-checks" class="w-3 h-3"></i> Ver Tarefas</button>
            </div>
            ${this._executionStatusLine(action)}
          </div>
        </div>
        <div class="flex flex-wrap gap-2">${flow.path.map(stage => `<span class="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-black">${FlowResolutionEngine.label(stage)}</span>`).join('')}</div>
        ${this._strategicTag(action)}
        ${this._connectToMapaButton(action)}
        ${krTag}
      </div>
    </div>`;
  },

  // V31.1.0 — Quando ação NÃO tem strategicAreaId, mostra CTA pra conectar
  // ao Mapa da Receita. Click abre wizard (Frente → KR-mãe → Confirmar).
  _connectToMapaButton(action) {
    if (action.strategicAreaId) return ''; // já conectada — _strategicTag cobre
    return `<div class="rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 p-3 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <i data-lucide="compass" class="w-4 h-4 text-indigo-600 shrink-0"></i>
        <p class="text-[12px] text-indigo-900"><b>Ação solta.</b> Conecte ao Mapa da Receita pra plugá-la num KR e gerar rollup.</p>
      </div>
      <button onclick="event.stopPropagation(); Actions.openConnectActionToMapa(${action.id})" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] flex items-center gap-1.5 shrink-0" style="color:#fff!important;">
        <i data-lucide="link" class="w-3 h-3"></i> Conectar ao Mapa
      </button>
    </div>`;
  },

  // V28.4.0 — Tag estratégica: badge da área (Mkt/Vendas/CS) + status + cadência
  // + KRs que essa ação move + atalho pro Mapa da Receita.
  _strategicTag(action) {
    if (!action.strategicAreaId || !window.StrategicMapEngine) return '';
    const area = (StrategicMapEngine.COMERCIAL_AREAS || []).find(a => a.id === action.strategicAreaId);
    if (!area) return '';
    const cadences = StrategicMapEngine.STRATEGIC_ACTION_CADENCES || [];
    const statuses = StrategicMapEngine.STRATEGIC_ACTION_STATUSES || [];
    const cadenceLabel = (cadences.find(c => c.id === action.strategicCadence) || {}).label || 'sem cadência';
    const status = (statuses.find(s => s.id === action.strategicStatus) || statuses[0] || { label: 'Planejada', color: 'slate' });
    const confirmed = action.strategicConfirmed;

    // Encontra o produto via campaign → KRs vinculados a essa ação na área certa
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId));
    const productId = campaign?.productId;
    const objective = productId ? StrategicMapEngine.getObjectiveByArea(productId, area.id) : null;
    const linkedKrs = (objective?.okrs || []).filter(kr => (kr.connectedActionIds || []).map(Number).includes(Number(action.id)));
    const linkedNames = linkedKrs.map(k => k.name);
    const tone = area.color;

    return `<div class="rounded-2xl border-2 border-${tone}-200 bg-${tone}-50 p-3 flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="px-2 py-1 rounded-full bg-${tone}-600 text-white text-[10px] font-black flex items-center gap-1" style="color:#fff!important;">📊 ${Utils.escape(area.label)}</span>
          <span class="px-2 py-1 rounded-full bg-${status.color}-100 text-${status.color}-800 border border-${status.color}-300 text-[10px] font-black">${Utils.escape(status.label).toUpperCase()}</span>
          <span class="text-[11px] text-slate-700">⏱ ${Utils.escape(cadenceLabel)}</span>
          ${action.strategicOwner ? `<span class="text-[11px] text-slate-700">👤 ${Utils.escape(action.strategicOwner)}</span>` : ''}
          ${confirmed ? '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 text-[10px] font-black">✓ CONFIRMADA</span>' : '<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 text-[10px] font-black">⚠ PENDENTE</span>'}
        </div>
        ${productId ? `<button onclick="event.stopPropagation(); Actions.openStrategicMap(${productId})" class="px-2 py-1 rounded-lg bg-white border border-${tone}-300 text-${tone}-700 text-[10px] font-black hover:bg-${tone}-100">Abrir no Mapa →</button>` : ''}
      </div>
      ${linkedNames.length ? `<p class="text-[11px] text-slate-700"><b class="text-${tone}-800">🔗 Move:</b> ${linkedNames.map(n => Utils.escape(n)).join(' · ')}</p>` : '<p class="text-[11px] text-amber-700">⚠️ Nenhum número confirmado é movido por essa ação ainda.</p>'}
      ${action.strategicDescription && action.strategicDescription !== 'Ação custom criada via engine' ? `<p class="text-[11px] text-slate-500 italic">${Utils.escape(action.strategicDescription)}</p>` : ''}
    </div>`;
  },

  _executionStatusLine(action) {
    const s = window.ExecutionStatusEngine ? ExecutionStatusEngine.forAction(action.id) : { toExecute: 0, executed: 0 };
    return `<div class="w-full text-[11px] text-slate-500 font-bold text-right">Execução: <span class="text-slate-700">${s.toExecute} para executar</span> • <span class="text-emerald-700">${s.executed} executada${s.executed === 1 ? '' : 's'}</span></div>`;
  },

  _actionsListFilter(actions) {
    const filter = App.state.actionsListFilter || 'all';
    const stages = window.FlowEngine ? FlowEngine.STAGE_PRESETS : [];
    const counts = {};
    for (const a of actions) {
      const stage = a.flow?.startStage || (window.FlowEngine ? FlowEngine._stageIdFromLegacy(a.originSector || a.sector, a.originFunnel || a.funnel) : 'mkt_tof');
      counts[stage] = (counts[stage] || 0) + 1;
    }
    return `<div class="flex items-center gap-2 flex-wrap mb-4">
      <span class="text-[11px] font-black text-slate-500 uppercase tracking-wider">Filtrar por etapa inicial:</span>
      <button onclick="Actions.setActionsListFilter('all')" class="px-3 py-1.5 rounded-full text-xs font-black ${filter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">Todas (${actions.length})</button>
      ${stages.map(stage => {
        const count = counts[stage.id] || 0;
        if (count === 0) return '';
        const active = filter === stage.id;
        return `<button onclick="Actions.setActionsListFilter('${stage.id}')" class="px-3 py-1.5 rounded-full text-xs font-black ${active ? 'text-white' : 'text-slate-700 hover:opacity-80'}" style="background:${active ? stage.color : stage.color + '22'};">${Utils.escape(stage.label)} (${count})</button>`;
      }).join('')}
    </div>`;
  },

  _filteredActionsList(actions) {
    const filter = App.state.actionsListFilter || 'all';
    let filtered = actions;
    if (filter !== 'all') {
      filtered = actions.filter(a => {
        const stage = a.flow?.startStage || (window.FlowEngine ? FlowEngine._stageIdFromLegacy(a.originSector || a.sector, a.originFunnel || a.funnel) : null);
        return stage === filter;
      });
    }
    if (!filtered.length) return Components.empty(filter === 'all' ? 'Nenhuma ação criada para esta campanha.' : 'Nenhuma ação começa nesta etapa.');
    return filtered.map(action => this.card(action)).join('');
  },

  _linkedKrTag(action, campaign) {
    if (!window.RevopsFinanceEngine || !campaign) return '';
    const okrs = Array.isArray(campaign.okrs) ? campaign.okrs : [];
    const allKrs = [];
    for (const okr of okrs) for (const kr of (okr.keyResults || [])) allKrs.push({ ...kr, okr });
    if (!allKrs.length && !action.linkedCampaignKrId) return '';
    const selected = action.linkedCampaignKrId ? allKrs.find(kr => kr.id === action.linkedCampaignKrId) : null;
    const selectId = `kr_link_${action.id}`;
    const options = ['<option value="">— sem vínculo —</option>'].concat(allKrs.map(kr => {
      const meta = RevopsFinanceEngine.METRIC_CATALOG[kr.metric];
      const label = `${kr.okr.objective || 'Tático'}: ${kr.label || meta?.label || 'KR'}`;
      return `<option value="${Utils.escape(kr.id)}" ${action.linkedCampaignKrId === kr.id ? 'selected' : ''}>${Utils.escape(label)}</option>`;
    })).join('');
    const status = selected
      ? `<span class="px-2 py-1 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-black">Vinculada: ${Utils.escape(selected.label || RevopsFinanceEngine.METRIC_CATALOG[selected.metric]?.label || 'KR')}</span>`
      : `<span class="px-2 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-black">Sem vínculo de KR</span>`;
    return `<div class="mt-3 flex flex-col md:flex-row md:items-center gap-2 pt-3 border-t border-slate-200">
      <span class="text-[11px] font-black text-indigo-700 uppercase tracking-wider whitespace-nowrap"><i data-lucide="compass" class="w-3 h-3 inline mr-1"></i> KR da Campanha</span>
      <select id="${selectId}" onchange="Actions.linkActionToCampaignKr(${action.id}, this.value || null)" class="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 font-semibold text-xs">${options}</select>
      ${status}
      ${campaign ? `<button onclick="Actions.openRevopsOkr('campaign', ${campaign.productId || 'null'}, null, ${campaign.id})" class="px-2 py-1 rounded-md bg-slate-900 text-white text-[10px] font-black flex items-center gap-1 lj-dark-button" style="color:#fff!important;"><i data-lucide="plus" class="w-3 h-3"></i> Novo KR Tático</button>` : ''}
    </div>`;
  },

  visual(action) { if (!action.connected) return { label: 'canal ainda não plugado', dotClass: 'bg-slate-300', buttonClass: 'bg-slate-200 text-slate-500', buttonText: 'Ativar' }; if (action.connectionStatus === 'active') return { label: 'trocando dados', dotClass: 'bg-emerald-500', buttonClass: 'bg-emerald-100 text-emerald-700', buttonText: 'Pausar' }; return { label: 'conectado sem troca', dotClass: 'bg-amber-500', buttonClass: 'bg-amber-100 text-amber-700', buttonText: 'Ativar' }; }
};
window.ActionModule = ActionModule;


// V13 — RD Email dynamic fields inside action creation.
Object.assign(ActionModule, {
  rdEmailFields(d, path) {
    if (!window.RDMapper?.isRDEmailAction?.(d)) return '';
    const cfg = { ...(window.RDConfig ? RDConfig.emailDefaults() : {}), ...(d.rdEmailConfig || {}) };

    return `<div class="lj-rd-panel">
      <div class="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 class="lj-rd-title">Configuração RD Email</h3>
          <p class="lj-rd-help">Este bloco aparece porque o canal da ação é RD Email. A integração alimentará KPIs; os OKRs continuam no LeadJourney.</p>
        </div>
        <span class="lj-rd-kpi-chip">Fase 2</span>
      </div>

      <div class="lj-rd-grid">
        ${this.rdInput('listName', 'Lista/segmentação', cfg.listName, 'Ex: Leads Maio Verde')}
        ${this.rdInput('emailCampaignName', 'Campanha de e-mail RD', cfg.emailCampaignName, 'Ex: Nutrição MOF Maio')}
        ${this.rdInput('emailSubject', 'Assunto do e-mail', cfg.emailSubject, 'Ex: Como destravar seu funil')}
        ${this.rdInput('sendDate', 'Data de disparo', cfg.sendDate, '2026-05-20')}
        ${this.rdInput('ctaUrl', 'URL/CTA principal', cfg.ctaUrl, 'https://...')}
        ${this.rdInput('appliedTags', 'Tags aplicadas', cfg.appliedTags, '#rd_email, #mof')}

        <div>
          <label class="text-xs font-black text-slate-500">Campo identificador</label>
          <select onchange="Actions.updateActionDraftRDEmail('leadIdentifierField', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold">
            ${['email','uuid','telefone'].map(v => `<option value="${v}" ${cfg.leadIdentifierField === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>

        <div>
          <label class="text-xs font-black text-slate-500">Frequência de sync</label>
          <select onchange="Actions.updateActionDraftRDEmail('syncFrequency', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold">
            ${['manual','daily','weekly'].map(v => `<option value="${v}" ${cfg.syncFrequency === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="mt-4">
        <p class="text-xs font-black text-slate-400 mb-2">KPIs que serão preparados nesta ação</p>
        <div class="flex flex-wrap gap-2">${(window.RDConfig ? RDConfig.emailKpiDefaults() : []).map(kpi => `<span class="lj-rd-kpi-chip">${kpi.name}</span>`).join('')}</div>
      </div>
    </div>`;
  },

  rdInput(field, label, value, placeholder) {
    return `<div>
      <label class="text-xs font-black text-slate-500">${label}</label>
      <input value="${Utils.escape(value || '')}" oninput="Actions.updateActionDraftRDEmail('${field}', this.value)" placeholder="${Utils.escape(placeholder || '')}" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold" />
    </div>`;
  }
});

Object.assign(ActionModule, {
  rdKpiMappingPanel(d) {
    if (!window.RDMapper?.isRDEmailAction?.(d)) return '';
    const stats = { ...(window.RDKpiMapper ? RDKpiMapper.emptyStatsTemplate() : {}), ...(d.rdEmailStats || {}) };
    const kpis = window.RDKpiMapper ? RDKpiMapper.mapStatsToKpis(stats, d.kpis || []) : (window.RDConfig ? RDConfig.emailKpiDefaults() : []);
    const statInput = (field, label) => `<div><label class="text-xs font-black text-slate-500">${label}</label><input type="number" value="${stats[field] || 0}" oninput="Actions.updateActionDraftRDStats('${field}', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold" /></div>`;
    return `<div class="lj-rd-panel">
      <div class="flex items-start justify-between gap-3 mb-4"><div><h3 class="lj-rd-title">Mapeamento de KPIs RD Email</h3><p class="lj-rd-help">Fase 3: simule ou preencha os KPIs que depois serão alimentados pelo sync real.</p></div><span class="lj-rd-kpi-chip">Fase 3</span></div>
      <div class="lj-rd-grid mb-4">${statInput('sent','Enviados')}${statInput('delivered','Entregues')}${statInput('opens','Aberturas')}${statInput('clicks','Cliques')}${statInput('bounces','Bounces')}${statInput('unsubscribes','Descadastros')}${statInput('conversions','Conversões')}</div>
      <div class="grid md:grid-cols-3 gap-2">${kpis.map(kpi => `<div class="rounded-2xl bg-white/10 border border-white/10 p-3"><p class="text-xs text-slate-300 font-black">${Utils.escape(kpi.name)}</p><p class="text-2xl font-black text-white mt-1">${Utils.escape(kpi.current)}</p><p class="text-[11px] text-slate-400 mt-1">${Utils.escape(kpi.formula || kpi.context || '')}</p></div>`).join('')}</div>
    </div>`;
  }
});


// V13.0.1 — RD action status helpers
Object.assign(ActionModule, {
  rdActionStatusBadge(action) {
    if (!window.RDMapper?.isRDEmailAction?.(action)) return '';
    const status = action.rdSyncStatus || 'pending';
    const last = action.lastRdSyncAt ? new Date(action.lastRdSyncAt).toLocaleString('pt-BR') : 'Nunca';
    return `<div class="mt-3 flex flex-wrap items-center gap-2">
      <button onclick="Actions.syncRDAction(${action.id})" class="px-3 py-2 rounded-2xl bg-sky-500/10 border border-sky-300/20 text-sky-700 font-black text-xs">Sincronizar RD</button>
      <span class="px-3 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 font-black text-xs">RD: ${Utils.escape(status)} • ${Utils.escape(last)}</span>
    </div>`;
  }
});
