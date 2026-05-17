var CampaignModule = {
  _actionsByCampaign(campaignsScope = App.state.campaigns) {
    const map = new Map();
    for (const campaign of campaignsScope) map.set(Number(campaign.id), []);
    for (const action of (App.state.actions || [])) {
      const key = Number(action.campaignId);
      if (map.has(key)) map.get(key).push(action);
      else map.set(key, [action]);
    }
    return map;
  },

  render() {
    const selectedProductId = App.state.selectedProductId || null;
    const campaigns = selectedProductId
      ? App.state.campaigns.filter(c => Number(c.productId) === Number(selectedProductId))
      : App.state.campaigns;
    const actionsByCampaign = this._actionsByCampaign(campaigns);
    return `<div class="space-y-4">
      ${this.campaignLayer()}
      ${this.operationalFlowRail(null)}
      <div class="grid lg:grid-cols-3 gap-4">
        <div class="lg:col-span-1 bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <h2 class="text-xl font-black mb-1">Campanha</h2>
          <p class="text-sm text-slate-500 mb-5">A campanha é o container operacional vinculado a um produto. Os OKRs nascem nas ações e alimentam estágios, setores e receita.</p>
          <div class="space-y-3">
            <div><label class="text-xs font-black text-slate-500">Produto vinculado</label><select onchange="App.state.campaignDraft.productId=Number(this.value); App.state.selectedProductId=Number(this.value); App.save();" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold">${App.state.products.map(product => `<option value="${product.id}" ${Number(App.state.campaignDraft.productId) === Number(product.id) ? 'selected' : ''}>${Utils.escape(product.name)}</option>`).join('')}</select></div>
            <div><label class="text-xs font-black text-slate-500">Setor onde nasce</label><select onchange="App.state.campaignDraft.sector=this.value; App.save();" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold">${Config.sectors.map(sector => `<option ${App.state.campaignDraft.sector === sector ? 'selected' : ''}>${sector}</option>`).join('')}</select></div>
            <div><label class="text-xs font-black text-slate-500">Nome da campanha</label><input value="${Utils.escape(App.state.campaignDraft.name)}" oninput="App.state.campaignDraft.name=this.value; App.save();" placeholder="Ex: Campanha Maio" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" /></div>
            <div><label class="text-xs font-black text-slate-500">Objetivo</label><textarea oninput="App.state.campaignDraft.objective=this.value; App.save();" placeholder="Qual é o objetivo operacional desta campanha?" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold min-h-[100px]">${Utils.escape(App.state.campaignDraft.objective)}</textarea></div>
            <div class="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-sm text-slate-600"><b>Regra RevOps:</b> campanhas não possuem OKRs estratégicos próprios. As metas operacionais são definidas nas ações e alimentam produto, funil e setor.</div>
            <div><label class="text-xs font-black text-slate-500">Responsável</label><input value="${Utils.escape(App.state.campaignDraft.owner)}" oninput="App.state.campaignDraft.owner=this.value; App.save();" placeholder="Ex: Felipe" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" /></div>
            <button onclick="Actions.createCampaign()" class="w-full px-5 py-3 rounded-2xl bg-slate-900 text-white font-black">Criar campanha</button>
          </div>
        </div>
        <div class="lg:col-span-2 bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <div class="flex items-start justify-between gap-3 mb-4"><div><h2 class="text-xl font-black mb-1">Campanhas Criadas</h2><p class="text-sm text-slate-500">Cada campanha fica plugada a um produto e pode receber várias ações.</p></div><div class="text-3xl font-black">${campaigns.length}</div></div>
          <div class="mb-4">
            <label class="text-xs font-black text-slate-500">Produto</label>
            <select onchange="Actions.selectProductForCampaigns(this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold">
              <option value="" ${!selectedProductId ? 'selected' : ''}>Todos os produtos</option>
              ${App.state.products.map(p => `<option value="${p.id}" ${Number(selectedProductId) === Number(p.id) ? 'selected' : ''}>${Utils.escape(p.name)}</option>`).join('')}
            </select>
          </div>
          <div class="space-y-3">${campaigns.map(campaign => this.card(campaign, actionsByCampaign.get(Number(campaign.id)) || [])).join('') || Components.empty(selectedProductId ? 'Nenhuma campanha vinculada a este produto.' : 'Nenhuma campanha criada ainda.')}</div>
        </div>
      </div>
      ${this.cxBase()}
      ${CampaignFlowModal.render()}
      ${this.editCampaignModal()}
    </div>`;
  },

  editCampaignModal() {
    const campaign = (App.state.campaigns || []).find(item => Number(item.id) === Number(App.state.editCampaignId));
    if (!App.state.showCampaignEditModal || !campaign) return '';
    return `<div class="fixed inset-0 z-[999] bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div class="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-2xl mx-auto mt-8 overflow-hidden">
        <header class="bg-slate-900 text-white p-5 flex items-start justify-between gap-3">
          <div><p class="text-xs font-black text-slate-300 uppercase tracking-wider">Editar campanha</p><h3 class="text-2xl font-black">${Utils.escape(campaign.name)}</h3></div>
          <button onclick="Actions.closeCampaignEditModal()" class="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-black text-xl">×</button>
        </header>
        <div class="p-5 space-y-3">
          <div><label class="text-xs font-black text-slate-500">Produto vinculado</label><select onchange="Actions.updateEditingCampaignField('productId', Number(this.value))" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold">${App.state.products.map(product => `<option value="${product.id}" ${Number(campaign.productId) === Number(product.id) ? 'selected' : ''}>${Utils.escape(product.name)}</option>`).join('')}</select></div>
          <div><label class="text-xs font-black text-slate-500">Setor onde nasce</label><select onchange="Actions.updateEditingCampaignField('sector', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold">${Config.sectors.map(sector => `<option ${campaign.sector === sector ? 'selected' : ''}>${sector}</option>`).join('')}</select></div>
          <div><label class="text-xs font-black text-slate-500">Nome da campanha</label><input value="${Utils.escape(campaign.name || '')}" oninput="Actions.updateEditingCampaignField('name', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" /></div>
          <div><label class="text-xs font-black text-slate-500">Objetivo</label><textarea oninput="Actions.updateEditingCampaignField('objective', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold min-h-[110px]">${Utils.escape(campaign.objective || '')}</textarea></div>
          <div><label class="text-xs font-black text-slate-500">Responsável</label><input value="${Utils.escape(campaign.owner || '')}" oninput="Actions.updateEditingCampaignField('owner', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" /></div>
          <div><label class="text-xs font-black text-slate-500">Status</label><select onchange="Actions.updateEditingCampaignField('status', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold">${['Ativa','Pausada','Finalizada'].map(status => `<option ${String(campaign.status || 'Ativa') === status ? 'selected' : ''}>${status}</option>`).join('')}</select></div>
          <div>
            <label class="text-xs font-black text-slate-500">Investimento em mídia (R$)</label>
            <input type="number" min="0" step="0.01" value="${Number(campaign.mediaInvestment || 0)}" oninput="Actions.updateEditingCampaignField('mediaInvestment', Number(this.value || 0))" placeholder="0" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-black" />
            <p class="text-[11px] text-slate-400 mt-1">Soma alimenta o CAC do produto no Painel Rosa de RevOps.</p>
          </div>
          <div class="flex flex-col md:flex-row gap-2 justify-end pt-2">
            <button onclick="Actions.closeCampaignEditModal()" class="px-5 py-3 rounded-2xl bg-slate-100 text-slate-700 font-black">Cancelar</button>
            <button onclick="Actions.saveCampaignEdit()" class="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black">Salvar Campanha</button>
          </div>
        </div>
      </div>
    </div>`;
  },

  operationalFlowRail(product) {
    return `<div class="lj-operational-rail bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
      <div class="lj-flow-rail-grid text-sm" style="display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important;align-items:stretch!important;width:100%!important;">
        <button onclick="App.setTab('products')" style="min-height:88px!important;width:100%!important;display:grid!important;grid-template-columns:36px minmax(0,1fr)!important;gap:10px!important;align-items:center!important;justify-content:initial!important;text-align:left!important;" class="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-black text-left lj-flow-step"><span class="lj-flow-step-number">1</span><span><span class="lj-flow-step-title">Produto</span><span class="lj-flow-step-subtitle">Voltar ao núcleo</span></span></button>
        <button onclick="${product ? `Actions.goToProductCampaigns(${product.id})` : `App.setTab('campaigns')`}" style="min-height:88px!important;width:100%!important;display:grid!important;grid-template-columns:36px minmax(0,1fr)!important;gap:10px!important;align-items:center!important;justify-content:initial!important;text-align:left!important;" class="px-4 py-3 rounded-2xl border border-slate-900 bg-slate-900 text-white font-black text-left lj-flow-step"><span class="lj-flow-step-number">2</span><span><span class="lj-flow-step-title">Campanhas</span><span class="lj-flow-step-subtitle">Criar ou editar</span></span></button>
        <button onclick="App.setTab('actions')" style="min-height:88px!important;width:100%!important;display:grid!important;grid-template-columns:36px minmax(0,1fr)!important;gap:10px!important;align-items:center!important;justify-content:initial!important;text-align:left!important;" class="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-black text-left lj-flow-step"><span class="lj-flow-step-number">3</span><span><span class="lj-flow-step-title">Ações</span><span class="lj-flow-step-subtitle">Executar campanha</span></span></button>
        <button onclick="App.setTab('results')" style="min-height:88px!important;width:100%!important;display:grid!important;grid-template-columns:36px minmax(0,1fr)!important;gap:10px!important;align-items:center!important;justify-content:initial!important;text-align:left!important;" class="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-black text-left lj-flow-step"><span class="lj-flow-step-number">4</span><span><span class="lj-flow-step-title">Leitura</span><span class="lj-flow-step-subtitle">Resultado da campanha</span></span></button>
      </div>
    </div>`;
  },

  campaignLayer() {
    const campaigns = App.state.campaigns || [];
    let active = 0, paused = 0, finished = 0;
    for (const campaign of campaigns) {
      const status = String(campaign.status || 'Ativa').toLowerCase();
      if (status === 'ativa') active += 1;
      else if (status === 'pausada') paused += 1;
      else if (status === 'finalizada') finished += 1;
    }
    let leads = 0, converted = 0;
    for (const action of (App.state.actions || [])) {
      leads += action.leads?.length || 0;
      converted += FlowResolutionEngine.buildActionFlow(action).converted || 0;
    }
    const conversion = leads ? Math.round((converted / leads) * 1000) / 10 : 0;
    return `<div class="bg-slate-950 text-white rounded-[2rem] p-5 shadow-sm overflow-hidden relative">
      <div class="absolute inset-0 opacity-60" style="background: radial-gradient(circle at 20% 10%, rgba(59,130,246,.20), transparent 28%), radial-gradient(circle at 80% 20%, rgba(16,185,129,.16), transparent 30%);"></div>
      <div class="relative z-10 grid lg:grid-cols-[1.2fr_1fr] gap-4 items-start">
        <div>
          <div class="flex items-center gap-2 mb-2"><i data-lucide="megaphone" class="w-4 h-4"></i><p class="text-xs font-black text-slate-300 uppercase tracking-wider">Campaign Operational Layer</p></div>
          <h2 class="text-3xl font-black">Campanhas</h2>
          <p class="text-sm text-slate-300 max-w-3xl mt-2">Painel operacional de campanhas: performance, produtos vinculados, receita gerada, handoffs, conversões, gargalos, ações plugadas e fluxo consolidado.</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          ${this.darkMetric('Ativas', active, 'play-circle')}
          ${this.darkMetric('Pausadas', paused, 'pause-circle')}
          ${this.darkMetric('Finalizadas', finished, 'check-circle')}
          ${this.darkMetric('Conversão', `${conversion}%`, 'arrow-right-left')}
        </div>
      </div>
    </div>`;
  },

  darkMetric(label, value, icon) { return `<div class="bg-white/10 border border-white/10 rounded-2xl p-4"><div class="flex items-center justify-between"><p class="text-xs font-black text-slate-300">${label}</p><i data-lucide="${icon}" class="w-4 h-4 text-slate-300"></i></div><div class="text-3xl font-black mt-2">${value}</div></div>`; },

  cxBase() { return `<div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><div class="flex items-start gap-3"><div class="w-10 h-10 rounded-2xl bg-slate-900 text-white grid place-items-center"><i data-lucide="route" class="w-5 h-5"></i></div><div><h3 class="font-black text-lg">CX Governance — estrutura base</h3><p class="text-sm text-slate-500">Camada paralela ao RevOps preparada para projetos de melhoria, planos de ação, kickoff, weeklys, checkpoints, onboarding da mudança e validação final RevOps. Nesta versão fica apenas estruturada, sem botões operacionais habilitados.</p></div></div></div>`; },

  card(campaign, actions = null) {
    if (actions === null) actions = App.state.actions.filter(action => Number(action.campaignId) === Number(campaign.id));
    let totalLeads = 0, converted = 0;
    for (const action of actions) {
      totalLeads += action.leads?.length || 0;
      converted += Number(FlowResolutionEngine.buildActionFlow(action).converted || 0);
    }
    const conversion = totalLeads ? Math.round((converted / totalLeads) * 1000) / 10 : 0;
    const product = App.state.products.find(p => Number(p.id) === Number(campaign.productId));

    // V22.0 — Estado do pipeline RD da campanha (gate de "Criar Ação" e visual do botão).
    const hasPipeline = Boolean(window.RdCrmConfig?.hasPipelineForCampaign?.(campaign.id));
    const pipelineInfo = hasPipeline ? RdCrmConfig.pipelineInfoForCampaign(campaign.id) : null;
    const pipelineOutline = hasPipeline ? 'border-emerald-500' : 'border-red-500';
    const pipelineLabel = hasPipeline ? 'Pipeline OK' : 'Gerar Pipeline';
    const pipelineIcon = hasPipeline ? 'check-circle-2' : 'git-branch';

    // V28.4.0 — Campanha guarda-chuva do Mapa da Receita ganha visual próprio
    // (badge violeta + click abre o Mapa em vez de listar ações).
    if (campaign.isStrategicHost) {
      return this._strategicHostCampaignCard(campaign, actions, product);
    }

    return `<div onclick="Actions.goToCampaignActions(${campaign.id})" class="lj-entity-card relative p-4 rounded-3xl border ${App.state.selectedCampaignId === campaign.id ? 'border-slate-900 bg-slate-50' : 'border-slate-100 bg-slate-50'} hover:bg-slate-100 cursor-pointer transition">
      <button onclick="event.stopPropagation(); Actions.openCampaignEditModal(${campaign.id})" title="Editar Campanha" aria-label="Editar Campanha" class="absolute top-3 right-3 w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 grid place-items-center shadow-sm"><i data-lucide="settings" class="w-4 h-4"></i></button>
      ${hasPipeline ? `<span class="absolute bottom-3 right-3 text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> Pipeline criado</span>` : ''}
      <div class="lj-entity-card-grid">
        <div class="lj-entity-copy pr-12">
          <h3 class="font-black text-lg">${Utils.escape(campaign.name)}</h3>
          <p class="text-sm text-slate-500 mt-1">${Utils.escape(campaign.objective || 'Sem objetivo')}</p>
          <p class="text-xs text-slate-400 mt-2">Produto: ${Utils.escape(product?.name || 'não vinculado')} • ${actions.length} ação(ões) • ${totalLeads} lead(s) • ${conversion}% conversão</p>
          ${hasPipeline ? `<p class="text-[11px] text-emerald-600 mt-1">Pipeline RD: <b>${Utils.escape(pipelineInfo?.pipelineName || '')}</b></p>` : ''}
        </div>
        <div class="lj-entity-metrics">
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="bg-white rounded-2xl px-3 py-2"><div class="font-black">${actions.length}</div><div class="text-xs text-slate-500">Ações</div></div>
            <div class="bg-white rounded-2xl px-3 py-2"><div class="font-black">${totalLeads}</div><div class="text-xs text-slate-500">Leads</div></div>
            <div class="bg-white rounded-2xl px-3 py-2"><div class="font-black">${conversion}%</div><div class="text-xs text-slate-500">Conv.</div></div>
          </div>
        </div>
        <div class="lj-card-actions grid grid-cols-2 gap-2">
          <button onclick="event.stopPropagation(); Actions.generateCampaignPipeline(${campaign.id})" class="px-3 py-2 rounded-2xl bg-slate-900 text-white text-xs font-black border-2 ${pipelineOutline} lj-dark-button flex items-center justify-center gap-1.5" style="color:#fff!important;"><i data-lucide="${pipelineIcon}" class="w-3.5 h-3.5"></i> ${pipelineLabel}</button>
          <button onclick="event.stopPropagation(); Actions.pushCampaignICPToRD(${campaign.id})" ${hasPipeline ? '' : 'disabled'} class="px-3 py-2 rounded-2xl bg-slate-900 text-white text-xs font-black disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed lj-dark-button flex items-center justify-center gap-1.5" ${hasPipeline ? 'style="color:#fff!important;"' : ''}><i data-lucide="send" class="w-3.5 h-3.5"></i> Enviar ICP pro RD</button>
          <button onclick="event.stopPropagation(); Actions.prepareActionForCampaign(${campaign.id})" ${hasPipeline ? '' : 'disabled'} title="${hasPipeline ? '' : 'Gere o pipeline antes de criar ações'}" class="px-3 py-2 rounded-2xl bg-slate-900 text-white text-xs font-black disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed lj-dark-button" ${hasPipeline ? 'style="color:#fff!important;"' : ''}>Criar Ação</button>
          <button onclick="event.stopPropagation(); Actions.openCampaignFlowModal(${campaign.id})" ${actions.length ? '' : 'disabled'} class="px-3 py-2 rounded-2xl bg-slate-900 text-white text-xs font-black disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed lj-dark-button" style="color:#fff!important;">Fluxo da Campanha</button>
        </div>
      </div>
    </div>`;
  },

  // V28.4.0 — Card especial pra campanha guarda-chuva do Mapa da Receita.
  // Diferenciado visualmente (gradiente violeta) e click abre o Mapa direto
  // em vez do fluxo padrão de campanha.
  _strategicHostCampaignCard(campaign, actions, product) {
    const areas = (window.StrategicMapEngine?.COMERCIAL_AREAS) || [];
    const byArea = areas.map(a => ({
      area: a,
      count: actions.filter(act => act.strategicAreaId === a.id).length,
      confirmed: actions.filter(act => act.strategicAreaId === a.id && act.strategicConfirmed).length
    }));
    return `<div onclick="Actions.openStrategicMap(${campaign.productId})" class="lj-entity-card relative p-4 rounded-3xl border-2 border-violet-300 cursor-pointer transition hover:border-violet-400" style="background:linear-gradient(135deg, rgba(139,92,246,.08), rgba(34,197,94,.05));">
      <span class="absolute top-3 right-3 px-2 py-1 rounded-full text-[10px] font-black bg-violet-500 text-white flex items-center gap-1" style="color:#fff!important;">📊 Estratégia · Mapa da Receita</span>
      <div class="lj-entity-card-grid">
        <div class="lj-entity-copy pr-32">
          <h3 class="font-black text-lg text-violet-900">${Utils.escape(campaign.name)}</h3>
          <p class="text-sm text-slate-600 mt-1">Campanha guarda-chuva auto-criada pra hospedar as ações estratégicas do produto. Edição é feita direto no <b>Mapa da Receita</b>.</p>
          <p class="text-xs text-slate-500 mt-2">Produto: <b>${Utils.escape(product?.name || 'não vinculado')}</b> • ${actions.length} ação(ões) estratégica(s)</p>
        </div>
        <div class="lj-entity-metrics">
          <div class="grid grid-cols-3 gap-2 text-center">
            ${byArea.map(b => `<div class="bg-white/80 rounded-2xl px-2 py-2"><div class="font-black text-${b.area.color}-700 text-base">${b.confirmed}/${b.count}</div><div class="text-[10px] text-slate-500">${Utils.escape(b.area.label)}</div></div>`).join('')}
          </div>
        </div>
        <div class="lj-card-actions grid grid-cols-1 gap-2">
          <button onclick="event.stopPropagation(); Actions.openStrategicMap(${campaign.productId})" class="px-3 py-2 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black flex items-center justify-center gap-1.5" style="color:#fff!important;"><i data-lucide="compass" class="w-3.5 h-3.5"></i> Abrir Mapa da Receita</button>
        </div>
      </div>
    </div>`;
  }
};
window.CampaignModule = CampaignModule;
