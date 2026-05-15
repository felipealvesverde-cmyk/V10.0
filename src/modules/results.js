var ResultModule = {
  render() {
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
      <div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
        <button onclick="Actions.backToResultsCampaignList()" class="mb-4 px-4 py-2 rounded-2xl bg-slate-100 font-black text-sm">← Voltar para campanhas</button>
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
    return `<div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><button onclick="Actions.backToCampaignResults()" class="mb-4 px-4 py-2 rounded-2xl bg-slate-100 font-black text-sm">← Voltar para ações da campanha</button><div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5"><div><p class="text-xs font-black text-slate-500">${Utils.escape(campaign?.name || 'Campanha')}</p><h2 class="text-2xl font-black">${Utils.escape(action.name)}</h2><p class="text-sm text-slate-500">Resultado local desta ação usando ${Utils.escape(score?.name || 'score não encontrado')}.</p></div><div class="flex gap-2"><button onclick="Actions.openActionFlowModal(${action.id})" class="px-4 py-2 rounded-2xl bg-slate-900 text-white font-black text-sm">Ver Mapa de Fluxo</button><span class="px-4 py-2 rounded-2xl bg-slate-100 font-black text-sm">${Utils.escape(action.channel)}</span></div></div><div class="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">${Components.resultMetric('Leads', result.total)}${Components.resultMetric('Convertidos', flow.converted)}${Components.resultMetric('Conversão', `${rate}%`)}${Components.resultMetric('Score médio', result.avgScore)}${Components.resultMetric('Mornos', result.warm)}${Components.resultMetric('Quentes', result.hot)}</div>${this.deepFunnel(result)}<div class="mt-5 bg-slate-900 text-white rounded-3xl p-5"><h3 class="font-black text-lg mb-2">Próximo movimento</h3><p class="text-sm text-slate-300 mb-4">A partir deste resultado, a próxima etapa será criar uma nova ação ligada à mesma campanha.</p><button onclick="Actions.prepareNextActionFromResult(${action.id})" class="px-5 py-3 rounded-2xl bg-white text-slate-900 font-black">Criar nova ação a partir deste resultado</button></div>${ActionFlowModal.render()}</div>`;
  },

  deepFunnel(result) {
    const stages = [{ name: 'Entrada', count: result.total, desc: 'Leads recebidos pela ação' }, { name: 'Abertura', count: result.opened, desc: 'Leads que abriram comunicação' }, { name: 'Leitura', count: result.read, desc: 'Leads que consumiram conteúdo' }, { name: 'CTA', count: result.cta, desc: 'Leads com intenção mais forte' }];
    return `<div class="grid lg:grid-cols-3 gap-4"><div class="bg-slate-50 rounded-3xl p-4 border border-slate-100"><h3 class="font-black text-lg mb-3">Funil da ação</h3><div class="space-y-3">${stages.map(stage => `<div class="bg-white rounded-2xl p-4 border border-slate-100"><div class="flex items-center justify-between gap-3"><div><p class="font-black">${stage.name}</p><p class="text-xs text-slate-500">${stage.desc}</p></div><div class="text-2xl font-black">${stage.count}</div></div></div>`).join('')}</div></div><div class="lg:col-span-2 bg-slate-50 rounded-3xl p-4 border border-slate-100"><h3 class="font-black text-lg mb-3">Estágio por lead</h3><div class="space-y-2 max-h-96 overflow-auto">${result.leads.map(lead => `<div class="bg-white rounded-2xl p-3 border border-slate-100 flex items-center justify-between gap-3"><div><p class="font-black text-sm">${Utils.escape(lead.name)}</p><p class="text-xs text-slate-500">${Utils.escape(lead.email || 'sem email')} • ${Utils.escape(lead.tags || 'sem tags')}</p></div><div class="text-right"><div class="font-black">${this.leadStage(lead)}</div><div class="text-xs text-slate-500">score ${lead.score || 0}</div></div></div>`).join('')}</div></div></div>`;
  },
  leadStage(lead) { const tags = String(lead.tags || '').toLowerCase(); if (tags.includes('#cta')) return 'CTA'; if (tags.includes('#read')) return 'Leitura'; if (tags.includes('#open')) return 'Abertura'; return 'Entrada'; }
};
window.ResultModule = ResultModule;
