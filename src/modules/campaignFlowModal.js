var CampaignFlowModal = {
  stages: FlowResolutionEngine.order,
  _funnelHeader: ['TOF','MOF','BOF','TOF','MOF','BOF','TOF','MOF','BOF'].map(f => `<div class="text-center">${f}</div>`).join(''),
  _numberFormatter: new Intl.NumberFormat('pt-BR'),
  render() {
    if (!App.state.showCampaignFlowModal) return '';
    const campaign = App.state.campaigns.find(c => Number(c.id) === Number(App.state.campaignFlowModalId));
    if (!campaign) return '';
    const actions = App.state.actions.filter(a => Number(a.campaignId) === Number(campaign.id));
    const product = App.state.products.find(p => Number(p.id) === Number(campaign.productId));
    const flowsByAction = new Map();
    let totalLeads = 0, totalConverted = 0;
    let mktToVendas = 0, vendasToCs = 0;
    for (const action of actions) {
      const flow = FlowResolutionEngine.buildActionFlow(action);
      flowsByAction.set(action.id, flow);
      totalLeads += action.leads?.length || 0;
      totalConverted += flow.converted || 0;
      for (let i = 1; i < (flow.steps || []).length; i++) {
        const prev = flow.steps[i - 1], curr = flow.steps[i];
        if (!curr.isHandoff) continue;
        if (prev.sector === 'Marketing' && curr.sector === 'Vendas') mktToVendas += curr.converted || 0;
        if (prev.sector === 'Vendas' && curr.sector === 'CS') vendasToCs += curr.converted || 0;
      }
    }
    const conversion = totalLeads ? Math.round((totalConverted / totalLeads) * 1000) / 10 : 0;
    return `<div class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm p-4 overflow-auto"><main class="min-h-full"><section class="rounded-[2rem] overflow-hidden shadow-2xl text-white" style="background: radial-gradient(circle at 18% 10%, rgba(124,58,237,.22), transparent 30%), radial-gradient(circle at 82% 0%, rgba(14,165,233,.16), transparent 32%), #071326;"><header class="p-6 lg:p-7 border-b border-white/10"><div class="flex flex-col xl:flex-row xl:items-start justify-between gap-5"><div><div class="flex flex-wrap items-center gap-3 mb-3"><h2 class="text-3xl lg:text-4xl font-black tracking-tight">Roadmap</h2><span class="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 text-xs font-bold">${Utils.escape(campaign.status || 'Ativa')}</span></div><p class="text-slate-300 text-sm">Campanha: ${Utils.escape(campaign.name)} <span class="mx-3">•</span> Produto: ${Utils.escape(product?.name || 'Sem produto')} <span class="mx-3">•</span> ${actions.length} ações ativas</p></div><div class="flex gap-3"><button onclick="Actions.closeCampaignFlowModal()" class="px-5 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center gap-2 text-sm font-semibold"><i data-lucide="x" class="w-4 h-4"></i> Fechar</button><button onclick="Actions.closeCampaignFlowModal(); Actions.openCampaignEditModal(${campaign.id})" class="px-5 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white flex items-center gap-2 text-sm font-semibold"><i data-lucide="pencil" class="w-4 h-4"></i> Editar Campanha</button></div></div></header><div class="p-5 lg:p-7 space-y-5"><section class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">${this.metric('Leads Totais da Campanha', totalLeads, 'users')}${this.flowMetric('marketing','sales', mktToVendas, 'arrow-right-left')}${this.flowMetric('sales','cs', vendasToCs, 'arrow-right-left')}${this.icpMetric()}${this.metric('Score Gerado', '+21', 'star')}${this.metric('Ações Ativas', actions.length, 'activity')}</section><section class="grid xl:grid-cols-[270px_1fr] gap-5"><aside class="rounded-[1.75rem] p-4 border border-white/10 bg-white/[0.055] backdrop-blur-xl"><div class="flex items-center justify-between mb-4"><h3 class="text-lg font-black">Fluxos por ação</h3><span class="text-xs text-slate-400">${actions.length} ações</span></div><div class="space-y-3">${actions.map(a => this.actionCard(a, flowsByAction.get(a.id))).join('') || '<p class="text-sm text-slate-400">Nenhuma ação.</p>'}</div></aside><section class="rounded-[1.75rem] overflow-hidden border border-white/10 bg-white/[0.055] backdrop-blur-xl"><div class="flex flex-col xl:flex-row xl:items-start justify-between p-5 border-b border-white/10 gap-4"><div><h3 class="text-xl font-black">Mapa Geral da Campanha</h3><p class="text-sm text-slate-400 mt-1">Cada linha representa uma ação atravessando setores e estágios operacionais.</p></div><div class="flex flex-wrap items-center gap-5 text-xs text-slate-300"><span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-violet-400"></span> Origem</span><span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-sky-400"></span> Caminho</span><span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-amber-400"></span> Handoff</span><span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-emerald-400"></span> Destino</span></div></div><div class="p-5 overflow-x-auto"><div class="space-y-4"><div class="grid text-xs font-black tracking-widest text-slate-400 gap-3" style="grid-template-columns:160px repeat(9,118px); min-width:1240px;"><div></div><div class="text-center text-violet-300 col-span-3">MARKETING</div><div class="text-center text-sky-300 col-span-3">VENDAS</div><div class="text-center text-emerald-300 col-span-3">CS</div></div><div class="grid text-xs font-black text-slate-500 gap-3" style="grid-template-columns:160px repeat(9,118px); min-width:1240px;"><div>Ação</div>${this._funnelHeader}</div><div class="space-y-4">${actions.map(a => this.row(a, flowsByAction.get(a.id))).join('')}</div></div></div></section></section><section class="grid md:grid-cols-4 gap-3">${this.insight('Handoff mais crítico','Marketing BOF → Vendas TOF','42,4%','Queda concentrada na transferência setorial')}${this.insight('Melhor ação', actions[0]?.name || 'Sem ação','8,8%','Maior conversão até destino')}${this.insight('Maior volume', actions[0]?.name || 'Sem ação', totalLeads,'Origem principal de leads impactados')}${this.insight('Insight RevOps','Campanha gera atenção, mas perde velocidade no handoff.','IA','Priorizar SLA e abordagem em Vendas TOF')}</section></div></section></main></div>`;
  },
  metric(label, value, icon) { return `<div class="rounded-2xl p-4 flex items-center justify-between gap-4 border border-white/10 bg-white/[0.055] backdrop-blur-xl"><div><p class="text-xs text-slate-400 font-bold">${label}</p><p class="text-2xl font-black mt-1">${Utils.escape(value)}</p></div><div class="w-11 h-11 rounded-2xl bg-white/10 grid place-items-center text-violet-300"><i data-lucide="${icon}"></i></div></div>`; },
  _areaLabel(area) { return area === 'marketing' ? 'Marketing' : area === 'sales' ? 'Vendas' : area === 'cs' ? 'CS' : area; },
  _areaVar(area) { return area === 'marketing' ? 'var(--lj-marketing)' : area === 'sales' ? 'var(--lj-sales)' : area === 'cs' ? 'var(--lj-cs)' : '#94a3b8'; },
  flowMetric(fromArea, toArea, value, icon) {
    const from = this._areaLabel(fromArea), to = this._areaLabel(toArea);
    const fromColor = this._areaVar(fromArea), toColor = this._areaVar(toArea);
    return `<div class="rounded-2xl p-4 flex items-center justify-between gap-4 border border-white/10 bg-white/[0.055] backdrop-blur-xl"><div><p class="text-xs font-bold"><span style="color:${fromColor};">${from}</span> <span class="text-slate-400">→</span> <span style="color:${toColor};">${to}</span></p><p class="text-2xl font-black mt-1">${Utils.escape(this._numberFormatter.format(Number(value || 0)))}</p></div><div class="w-11 h-11 rounded-2xl bg-white/10 grid place-items-center text-slate-300"><i data-lucide="${icon}"></i></div></div>`;
  },
  icpMetric() {
    const layer = (tag, label) => `<div class="flex items-center justify-between gap-2 text-[10px]"><span class="font-black text-slate-400">${tag}</span><span class="font-bold text-slate-300">${label}</span><span class="font-black text-slate-500">—</span></div>`;
    return `<div class="rounded-2xl p-4 border border-white/10 bg-white/[0.055] backdrop-blur-xl"><div class="flex items-center justify-between gap-3 mb-2"><p class="text-xs text-slate-400 font-bold">ICP</p><div class="w-7 h-7 rounded-xl bg-white/10 grid place-items-center text-violet-300"><i data-lucide="target" class="w-3.5 h-3.5"></i></div></div><div class="space-y-1">${layer('C', 'Público-alvo')}${layer('B', 'ICP')}${layer('A', 'Buyer Persona')}</div></div>`;
  },
  actionCard(action, flow) {
    if (!flow) flow = FlowResolutionEngine.buildActionFlow(action);
    const rate = flow.impacted ? Math.round((flow.converted / flow.impacted) * 1000) / 10 : 0;
    return `<button class="w-full text-left min-h-[104px] rounded-[22px] p-4 bg-white/[0.04] border border-white/10 hover:bg-violet-500/10 hover:border-violet-400/40 transition"><div class="flex items-start justify-between gap-3 mb-2"><div><p class="font-black text-sm text-white">${Utils.escape(action.name)}</p><p class="text-xs text-slate-400 mt-1">${Utils.escape(action.channel)} • ${Utils.escape(FlowResolutionEngine.label(flow.path[0]))} → ${Utils.escape(FlowResolutionEngine.label(flow.path[flow.path.length - 1]))}</p></div><span class="text-xs px-2 py-1 rounded-full bg-white/10 border border-white/10">${rate}%</span></div><div class="grid grid-cols-3 gap-2 text-xs mt-3"><div><p class="text-slate-500">Volume</p><p class="font-black">${flow.impacted}</p></div><div><p class="text-slate-500">Score</p><p class="font-black">+${flow.scoreImpact}</p></div><div><p class="text-slate-500">Etapas</p><p class="font-black">${flow.path.length}</p></div></div></button>`;
  },
  row(action, flow) {
    if (!flow) flow = FlowResolutionEngine.buildActionFlow(action);
    const stepsByStage = new Map(flow.steps.map(step => [step.stageId, step]));
    return `<div class="grid gap-3 items-center relative" style="grid-template-columns:160px repeat(9,118px); min-width:1240px;"><div class="pr-2"><p class="text-sm font-black text-white leading-tight">${Utils.escape(action.name)}</p><p class="text-xs text-slate-400 mt-1">${Utils.escape(action.channel)}</p></div>${this.stages.map(stageId => this.cell(stageId, stepsByStage.get(stageId))).join('')}</div>`;
  },
  cell(stageId, step) {
    if (!step) return `<div class="h-[88px] rounded-[22px] grid place-items-center text-slate-700 border border-white/10 bg-white/[0.03]">—</div>`;
    const color = step.isDestination ? 'emerald' : step.isHandoff ? 'amber' : step.isOrigin ? 'violet' : 'sky';
    const role = step.isOrigin ? 'Origem' : step.isDestination ? 'Destino' : step.isHandoff ? 'Handoff' : 'Passagem';
    return `<button class="h-[88px] rounded-[22px] grid place-items-center text-center relative border border-${color}-400/70 bg-${color}-500/20"><div><p class="text-[10px] font-black uppercase text-${color}-300">${role}</p><p class="text-xl font-black text-white mt-1">${this._numberFormatter.format(step.converted)}</p><p class="text-[10px] text-slate-300 mt-1">${stageId.replace('-', ' ').toUpperCase()}</p></div>${step.drop ? `<span class="absolute right-[-12px] bottom-[-14px] z-10 bg-red-900/90 border border-dashed border-red-400 text-red-100 text-[10px] font-black px-2 py-1 rounded-full">drop ${step.conversionRate}%</span>` : ''}</button>`;
  },
  insight(title, body, value, sub) { return `<button class="rounded-2xl p-4 text-left hover:bg-white/10 transition border border-white/10 bg-white/[0.055]"><div class="flex items-center justify-between gap-3 mb-2"><p class="text-sm font-black text-amber-200">${Utils.escape(title)}</p><span class="text-xl font-black text-amber-300">${Utils.escape(value)}</span></div><p class="text-sm text-slate-200">${Utils.escape(body)}</p><p class="text-xs text-slate-400 mt-1">${Utils.escape(sub)}</p></button>`; }
};
window.CampaignFlowModal = CampaignFlowModal;
