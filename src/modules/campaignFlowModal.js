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
    const allLeads = actions.flatMap(a => a.leads || []);
    const handoffStats = this._handoffStats(flowsByAction);
    const bestAction = this._bestActionStats(actions, flowsByAction);
    const insight = (App.state.roadmapInsights || {})[campaign.id] || null;
    return `<div class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm p-4 overflow-auto"><main class="min-h-full"><section class="rounded-[2rem] overflow-hidden shadow-2xl text-white" style="background: radial-gradient(circle at 18% 10%, rgba(124,58,237,.22), transparent 30%), radial-gradient(circle at 82% 0%, rgba(14,165,233,.16), transparent 32%), #071326;"><header class="p-6 lg:p-7 border-b border-white/10"><div class="flex flex-col xl:flex-row xl:items-start justify-between gap-5"><div><div class="flex flex-wrap items-center gap-3 mb-3"><h2 class="text-3xl lg:text-4xl font-black tracking-tight">Roadmap</h2><span class="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 text-xs font-bold">${Utils.escape(campaign.status || 'Ativa')}</span></div><p class="text-slate-300 text-sm">Campanha: ${Utils.escape(campaign.name)} <span class="mx-3">•</span> Produto: ${Utils.escape(product?.name || 'Sem produto')} <span class="mx-3">•</span> ${actions.length} ações ativas</p></div><div class="flex gap-3"><button onclick="Actions.closeCampaignFlowModal()" class="px-5 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center gap-2 text-sm font-semibold"><i data-lucide="x" class="w-4 h-4"></i> Fechar</button><button onclick="Actions.closeCampaignFlowModal(); Actions.openCampaignEditModal(${campaign.id})" class="px-5 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white flex items-center gap-2 text-sm font-semibold"><i data-lucide="pencil" class="w-4 h-4"></i> Editar Campanha</button></div></div></header><div class="p-5 lg:p-7 space-y-5"><section class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">${this.metric('Leads Totais da Campanha', totalLeads, 'users')}${this.flowMetric('marketing','sales', mktToVendas, 'arrow-right-left')}${this.flowMetric('sales','cs', vendasToCs, 'arrow-right-left')}${this.icpMetric(allLeads, product)}${this.metricInactive('Ações Ativas', 'activity')}</section><section class="rounded-[1.75rem] overflow-hidden border border-white/10 bg-white/[0.055] backdrop-blur-xl"><div class="flex flex-col xl:flex-row xl:items-start justify-between p-5 border-b border-white/10 gap-4"><div><h3 class="text-xl font-black">Mapa Geral da Campanha</h3><p class="text-sm text-slate-400 mt-1">Cada linha representa uma ação atravessando setores e estágios operacionais.</p></div><div class="flex flex-wrap items-center gap-5 text-xs text-slate-300"><span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-violet-400"></span> Origem</span><span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-sky-400"></span> Caminho</span><span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-amber-400"></span> Handoff</span><span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-emerald-400"></span> Destino</span></div></div><div class="p-5 overflow-x-auto"><div class="space-y-4"><div class="grid text-xs font-black tracking-widest text-slate-400 gap-3" style="grid-template-columns:160px repeat(9,118px); min-width:1240px;"><div></div><div class="text-center text-violet-300 col-span-3">MARKETING</div><div class="text-center text-sky-300 col-span-3">VENDAS</div><div class="text-center text-emerald-300 col-span-3">CS</div></div><div class="grid text-xs font-black text-slate-500 gap-3" style="grid-template-columns:160px repeat(9,118px); min-width:1240px;"><div>Ação</div>${this._funnelHeader}</div><div class="space-y-4">${actions.map(a => this.row(a, flowsByAction.get(a.id))).join('')}</div></div></div></section><section class="grid md:grid-cols-4 gap-3">${this.insightWorstHandoff(handoffStats)}${this.insightBestAction(bestAction)}${this.insightTopVolume(handoffStats)}${this.insightDjow(campaign, insight)}</section></div></section></main></div>`;
  },
  metric(label, value, icon) { return `<div class="rounded-2xl p-4 flex items-center justify-between gap-4 border border-white/10 bg-white/[0.055] backdrop-blur-xl"><div><p class="text-xs text-slate-400 font-bold">${label}</p><p class="text-2xl font-black mt-1">${Utils.escape(value)}</p></div><div class="w-11 h-11 rounded-2xl bg-white/10 grid place-items-center text-violet-300"><i data-lucide="${icon}"></i></div></div>`; },
  // V38.1.47 — tile inativo: cinza dimmed + "Em breve" pra reservar espaço sem prometer dado.
  metricInactive(label, icon) { return `<div class="rounded-2xl p-4 flex items-center justify-between gap-4 border border-white/5 bg-white/[0.02] backdrop-blur-xl opacity-50"><div><p class="text-xs text-slate-500 font-bold">${label}</p><p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Em breve</p></div><div class="w-11 h-11 rounded-2xl bg-white/5 grid place-items-center text-slate-500"><i data-lucide="${icon}"></i></div></div>`; },
  _areaLabel(area) { return area === 'marketing' ? 'Marketing' : area === 'sales' ? 'Vendas' : area === 'cs' ? 'CS' : area; },
  _areaVar(area) { return area === 'marketing' ? 'var(--lj-marketing)' : area === 'sales' ? 'var(--lj-sales)' : area === 'cs' ? 'var(--lj-cs)' : '#94a3b8'; },
  flowMetric(fromArea, toArea, value, icon) {
    const from = this._areaLabel(fromArea), to = this._areaLabel(toArea);
    const fromColor = this._areaVar(fromArea), toColor = this._areaVar(toArea);
    return `<div class="rounded-2xl p-4 flex items-center justify-between gap-4 border border-white/10 bg-white/[0.055] backdrop-blur-xl"><div><p class="text-xs font-bold"><span style="color:${fromColor};">${from}</span> <span class="text-slate-400">→</span> <span style="color:${toColor};">${to}</span></p><p class="text-2xl font-black mt-1">${Utils.escape(this._numberFormatter.format(Number(value || 0)))}</p></div><div class="w-11 h-11 rounded-2xl bg-white/10 grid place-items-center text-slate-300"><i data-lucide="${icon}"></i></div></div>`;
  },
  // V40.13.1 — icpMetric removido (engine Audiência+Coleta legada).
  // Tile vira "Em breve" pra reservar espaço sem prometer dado.
  // Lugar onde ficavam Suspect/PA/ICP/BP. Razão da remoção: a engine
  // de transmutação (lj-suspect/lj-pa/lj-icp/lj-bp) ficou desalinhada
  // com a Audiência V2 (arquétipos + consequências adaptativas).
  icpMetric(leads, product) {
    return `<div class="md:col-span-2 xl:col-span-2 rounded-2xl p-4 border border-white/5 bg-white/[0.02] backdrop-blur-xl opacity-50"><div class="flex items-center justify-between gap-3 mb-3"><p class="text-xs text-slate-500 font-bold">Audiência</p><div class="w-7 h-7 rounded-xl bg-white/5 grid place-items-center text-slate-500"><i data-lucide="target" class="w-3.5 h-3.5"></i></div></div><p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Em breve</p></div>`;
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
  insight(title, body, value, sub) { return `<button class="rounded-2xl p-4 text-left hover:bg-white/10 transition border border-white/10 bg-white/[0.055]"><div class="flex items-center justify-between gap-3 mb-2"><p class="text-sm font-black text-amber-200">${Utils.escape(title)}</p><span class="text-xl font-black text-amber-300">${Utils.escape(value)}</span></div><p class="text-sm text-slate-200">${Utils.escape(body)}</p><p class="text-xs text-slate-400 mt-1">${Utils.escape(sub)}</p></button>`; },

  // V38.1.51 — Agrega taxas e volumes dos handoffs entre setores ao longo de
  // todas as ações da campanha. Cada par (prev.stageId → curr.stageId) onde
  // curr.isHandoff vira uma chave; somamos os leads que CHEGARAM em prev
  // (entered) e os que CRUZARAM pra curr (crossed). Pior par = menor taxa.
  // Maior volume = maior crossed absoluto. Empate decidido por volume.
  _handoffStats(flowsByAction) {
    const pairs = new Map();
    for (const flow of flowsByAction.values()) {
      const steps = flow.steps || [];
      for (let i = 1; i < steps.length; i++) {
        const prev = steps[i - 1], curr = steps[i];
        if (!curr.isHandoff) continue;
        const key = `${prev.stageId}>${curr.stageId}`;
        const acc = pairs.get(key) || { fromStage: prev.stageId, toStage: curr.stageId, entered: 0, crossed: 0, occurrences: 0 };
        acc.entered += prev.converted || 0;
        acc.crossed += curr.converted || 0;
        acc.occurrences += 1;
        pairs.set(key, acc);
      }
    }
    if (!pairs.size) return { worst: null, topVolume: null };
    const list = [...pairs.values()].map(p => ({ ...p, rate: p.entered ? Math.round((p.crossed / p.entered) * 1000) / 10 : 0 }));
    const worst = list.slice().sort((a, b) => (a.rate - b.rate) || (b.entered - a.entered))[0];
    const topVolume = list.slice().sort((a, b) => (b.crossed - a.crossed) || (b.rate - a.rate))[0];
    return { worst, topVolume };
  },

  // V38.1.51 — A ação com maior taxa de conversão fim-a-fim (converted/impacted).
  // Ignora ações com impacted=0 (sem leads pra rodar).
  _bestActionStats(actions, flowsByAction) {
    let best = null;
    for (const a of actions) {
      const f = flowsByAction.get(a.id);
      if (!f || !f.impacted) continue;
      const rate = Math.round((f.converted / f.impacted) * 1000) / 10;
      if (!best || rate > best.rate || (rate === best.rate && f.impacted > best.impacted)) {
        best = { name: a.name, channel: a.channel, rate, impacted: f.impacted, converted: f.converted };
      }
    }
    return best;
  },

  _pairLabel(stageId) {
    const sector = FlowResolutionEngine.sector(stageId);
    const funnel = FlowResolutionEngine.funnel(stageId);
    return `${sector} ${funnel}`;
  },

  insightWorstHandoff(stats) {
    if (!stats?.worst) return this._insightEmpty('Handoff mais crítico', 'Sem handoffs entre setores ainda.');
    const w = stats.worst;
    const value = `${w.rate}%`;
    const body = `${this._pairLabel(w.fromStage)} → ${this._pairLabel(w.toStage)}`;
    const sub = `${this._numberFormatter.format(w.crossed)} cruzaram de ${this._numberFormatter.format(w.entered)} que chegaram · ${w.occurrences} ${w.occurrences > 1 ? 'ações' : 'ação'}`;
    return `<div class="rounded-2xl p-4 border border-white/10 bg-white/[0.055]"><div class="flex items-center justify-between gap-3 mb-2"><p class="text-sm font-black text-rose-200">Handoff mais crítico</p><span class="text-xl font-black text-rose-300">${Utils.escape(value)}</span></div><p class="text-sm text-slate-200">${Utils.escape(body)}</p><p class="text-xs text-slate-400 mt-1">${Utils.escape(sub)}</p></div>`;
  },

  insightBestAction(best) {
    if (!best) return this._insightEmpty('Melhor ação', 'Sem ação com leads pra ranquear.');
    const value = `${best.rate}%`;
    const sub = `${this._numberFormatter.format(best.converted)} convertidos de ${this._numberFormatter.format(best.impacted)} impactados · ${Utils.escape(best.channel || '')}`;
    return `<div class="rounded-2xl p-4 border border-white/10 bg-white/[0.055]"><div class="flex items-center justify-between gap-3 mb-2"><p class="text-sm font-black text-emerald-200">Melhor ação</p><span class="text-xl font-black text-emerald-300">${Utils.escape(value)}</span></div><p class="text-sm text-slate-200">${Utils.escape(best.name)}</p><p class="text-xs text-slate-400 mt-1">${sub}</p></div>`;
  },

  insightTopVolume(stats) {
    if (!stats?.topVolume) return this._insightEmpty('Maior volume', 'Sem handoffs com volume ainda.');
    const t = stats.topVolume;
    const value = this._numberFormatter.format(t.crossed);
    const body = `${this._pairLabel(t.fromStage)} → ${this._pairLabel(t.toStage)}`;
    const sub = `${t.rate}% de taxa · ${t.occurrences} ${t.occurrences > 1 ? 'ações' : 'ação'} alimentando esse caminho`;
    return `<div class="rounded-2xl p-4 border border-white/10 bg-white/[0.055]"><div class="flex items-center justify-between gap-3 mb-2"><p class="text-sm font-black text-cyan-200">Maior volume</p><span class="text-xl font-black text-cyan-300">${Utils.escape(value)}</span></div><p class="text-sm text-slate-200">${Utils.escape(body)}</p><p class="text-xs text-slate-400 mt-1">${Utils.escape(sub)}</p></div>`;
  },

  // V38.1.51 — Card de insight do Djow. Sem cached → CTA pra disparar análise.
  // Cached → mostra prosa + timestamp + botão "Renovar análise".
  insightDjow(campaign, insight) {
    if (insight?.loading) {
      return `<div class="rounded-2xl p-4 border border-white/10 bg-white/[0.055]"><div class="flex items-center justify-between gap-3 mb-2"><p class="text-sm font-black text-violet-200">Insight do Djow</p><span class="text-xs font-black text-violet-300 animate-pulse">Pensando…</span></div><p class="text-xs text-slate-400 leading-snug">Djow está lendo o quadro de ações da campanha.</p></div>`;
    }
    if (!insight) {
      return `<div class="rounded-2xl p-4 border border-white/10 bg-white/[0.055]"><div class="flex items-center justify-between gap-3 mb-2"><p class="text-sm font-black text-violet-200">Insight do Djow</p><i data-lucide="sparkles" class="w-4 h-4 text-violet-300"></i></div><p class="text-xs text-slate-400 leading-snug mb-2">Djow lê ação por ação e aponta pontos de atenção pragmáticos.</p><button onclick="Actions.requestRoadmapInsight(${campaign.id})" class="text-[11px] font-black text-violet-300 hover:text-violet-200 underline">Pedir análise ao Djow →</button></div>`;
    }
    const when = insight.timestamp ? new Date(insight.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
    return `<div class="rounded-2xl p-4 border border-violet-400/30 bg-violet-500/10"><div class="flex items-center justify-between gap-3 mb-2"><p class="text-sm font-black text-violet-200">Insight do Djow</p><button onclick="Actions.requestRoadmapInsight(${campaign.id})" title="Renovar análise" class="text-[10px] font-black text-violet-300 hover:text-violet-200 underline">Renovar</button></div><p class="text-xs text-slate-200 leading-snug whitespace-pre-line">${Utils.escape(insight.text)}</p>${when ? `<p class="text-[10px] text-violet-300/70 mt-2">Analisado ${when}</p>` : ''}</div>`;
  },

  _insightEmpty(title, msg) {
    return `<div class="rounded-2xl p-4 border border-white/5 bg-white/[0.02] opacity-50"><div class="flex items-center justify-between gap-3 mb-2"><p class="text-sm font-black text-slate-400">${Utils.escape(title)}</p></div><p class="text-xs text-slate-500 leading-snug">${Utils.escape(msg)}</p></div>`;
  }
};
window.CampaignFlowModal = CampaignFlowModal;
