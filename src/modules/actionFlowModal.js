var ActionFlowModal = {
  render() {
    if (!App.state.showActionFlowModal) return '';
    const action = App.state.actions.find(a => Number(a.id) === Number(App.state.actionFlowModalId));
    if (!action) return '';
    const campaign = App.state.campaigns.find(c => Number(c.id) === Number(action.campaignId));
    const flow = FlowResolutionEngine.buildActionFlow(action);
    const total = flow.impacted || action.leads.length || 0;
    const finalConverted = flow.converted || 0;
    const conversion = total ? Math.round((finalConverted / total) * 1000) / 10 : 0;
    const editing = Boolean(App.state.actionFlowEditMode);
    return `<div class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm p-4 overflow-auto">
      <main class="min-h-full">
        <section class="rounded-[2rem] overflow-hidden shadow-2xl text-white" style="background: radial-gradient(circle at 20% 10%, rgba(124,58,237,.20), transparent 30%), radial-gradient(circle at 80% 0%, rgba(14,165,233,.16), transparent 32%), #071326;">
          <header class="p-6 lg:p-7 border-b border-white/10">
            <div class="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
              <div>
                <div class="flex flex-wrap items-center gap-3 mb-3">
                  <h2 class="text-3xl lg:text-4xl font-black tracking-tight">Mapa de Fluxo da Ação</h2>
                  <span class="px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/20 text-xs font-bold">${Utils.escape(action.status || 'Ativa')}</span>
                  ${editing ? '<span class="px-3 py-1 rounded-lg bg-amber-500/20 text-amber-200 border border-amber-400/20 text-xs font-bold">Modo edição</span>' : ''}
                </div>
                <p class="text-slate-300 text-sm">Ação: ${Utils.escape(action.name)} <span class="mx-3">•</span> Campanha: ${Utils.escape(campaign?.name || 'Sem campanha')} <span class="mx-3">•</span> Origem: ${Utils.escape(FlowResolutionEngine.label(flow.path[0]))} <span class="mx-3">•</span> Destino: ${Utils.escape(FlowResolutionEngine.label(flow.path[flow.path.length-1]))}</p>
              </div>
              <div class="flex flex-wrap gap-3">
                ${window.RDMapper?.isRDEmailAction?.(action) ? `<button onclick="Actions.syncRDAction(${action.id})" class="px-5 py-3 rounded-xl bg-sky-500/20 border border-sky-300/30 text-sky-100 hover:bg-sky-500/30 flex items-center gap-2 text-sm font-semibold"><i data-lucide="refresh-cw" class="w-4 h-4"></i> Sincronizar RD</button>` : ``}<button onclick="Actions.closeActionFlowModal()" class="px-5 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center gap-2 text-sm font-semibold"><i data-lucide="x" class="w-4 h-4"></i> Fechar</button>
                <button onclick="${editing ? 'Actions.saveActionFlowConfig()' : 'Actions.toggleActionFlowEdit()'}" class="px-5 py-3 rounded-xl ${editing ? 'bg-emerald-500/20 border border-emerald-400/30 text-emerald-100' : 'bg-white/5 border border-white/15'} hover:bg-white/10 flex items-center gap-2 text-sm font-semibold"><i data-lucide="${editing ? 'save' : 'settings-2'}" class="w-4 h-4"></i> ${editing ? 'Salvar Configuração' : 'Editar Fluxo'}</button>
              </div>
            </div>
          </header>
          <div class="p-5 lg:p-7 space-y-5">
            <section class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">${this.metric('Leads Impactados', total, 'users')}${this.metric('Convertidos finais', finalConverted, 'arrow-right-left')}${this.metric('Conversão Total', `${conversion}%`, 'trending-up')}${this.metric('Score Gerado', `+${flow.scoreImpact}`, 'star')}${this.metric('Tempo Médio', `${flow.avgDays} dias`, 'clock')}</section>
            ${editing ? this.editPanel(action, flow) : ''}
            <section class="rounded-[1.75rem] overflow-hidden border border-white/10 bg-white/[0.055] backdrop-blur-xl">
              <div class="flex flex-col xl:flex-row xl:items-start justify-between p-5 border-b border-white/10 gap-4">
                <div><h3 class="text-xl font-black">Visão Geral do Fluxo</h3><p class="text-sm text-slate-400 mt-1">${editing ? 'Ajuste passagens, canais, OKRs e avanços no painel de edição acima.' : 'A ação atravessa automaticamente todos os estágios intermediários obrigatórios.'}</p></div>
                <div class="flex flex-wrap items-center gap-5 text-xs text-slate-300"><span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-violet-400"></span> Origem</span><span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-sky-400"></span> Passagem</span><span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-amber-400"></span> Handoff</span><span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-emerald-400"></span> Destino</span></div>
              </div>
              <div class="p-6 overflow-x-auto"><div class="min-w-[${Math.max(860, flow.steps.length * 220)}px] relative pt-6 pb-44"><div class="flex items-start gap-14 relative">${(() => { const okrsByStage = this._okrsByStage(action); return flow.steps.map((step, index) => this.stage(step, index, flow.steps, action, okrsByStage)).join(''); })()}</div></div></div>
            </section>
            <section class="grid md:grid-cols-3 gap-3">${this.handoffs(flow)}<button class="rounded-2xl p-4 text-left hover:bg-white/10 transition border border-white/10 bg-white/[0.055]"><div class="flex items-center justify-between gap-3 mb-2"><p class="text-sm font-black text-violet-200">Insight RevOps</p><i data-lucide="sparkles" class="w-5 h-5 text-violet-300"></i></div><p class="text-sm text-slate-200">Maior perda deve ser analisada no primeiro estágio com drop alto.</p><p class="text-xs text-slate-400 mt-1">Revise CTA, oferta e handoff antes de escalar mídia.</p></button></section>
            <section class="rounded-[1.75rem] p-5 border border-white/10 bg-white/[0.055]"><h3 class="text-xl font-black mb-4">Impacto nos Scores e Métricas</h3><div class="grid lg:grid-cols-5 md:grid-cols-2 gap-4">${this.bottomMetric('Score Médio Inicial','42','No estágio de origem')}${this.bottomMetric('Score Médio Final', String(42 + Number(flow.scoreImpact || 0)), 'No estágio de destino')}${this.bottomMetric('Aumento Médio', `+${flow.scoreImpact}`, 'Por lead convertido')}${this.bottomMetric('Qualidade','Muito Boa','Leads qualificados', 'text-emerald-300')}${this.bottomMetric('Velocidade','Boa','Dentro do esperado', 'text-sky-300')}</div></section>
          </div>
        </section>
      </main>
    </div>`;
  },
  
  revopsAIAnalysis(action) {
    if (!window.RevOpsAIEngine) return '';

    const analysis = RevOpsAIEngine.analyzeAction(action);

    return `<section class="lj-rd-panel mt-4">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="lj-rd-title">RevOps AI — Diagnóstico</h3>
          <p class="lj-rd-help">Leitura automática de KPIs e OKRs.</p>
        </div>

        <div class="text-right">
          <p class="text-xs text-slate-400">Health Score</p>
          <p class="text-3xl font-black text-white">${analysis.score}</p>
        </div>
      </div>

      <div class="space-y-3">
        ${analysis.findings.map(f => `
          <div class="rounded-2xl bg-white/10 border border-white/10 p-4">
            <p class="font-black text-sky-100">${Utils.escape(f.title)}</p>
            <p class="text-sm text-slate-300 mt-2">${Utils.escape(f.insight)}</p>

            <div class="mt-3 rounded-xl bg-emerald-500/10 border border-emerald-400/20 p-3">
              <p class="text-xs font-black text-emerald-300">Recomendação</p>
              <p class="text-sm text-emerald-100 mt-1">${Utils.escape(f.recommendation)}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </section>`;
  },

  metric(label, value, icon) { return `<div class="rounded-2xl p-4 flex items-center justify-between gap-4 border border-white/10 bg-white/[0.055] backdrop-blur-xl"><div><p class="text-xs text-slate-400 font-bold">${label}</p><p class="text-2xl font-black mt-1">${Utils.escape(value)}</p></div><div class="w-11 h-11 rounded-2xl bg-white/10 grid place-items-center text-violet-300"><i data-lucide="${icon}"></i></div></div>`; },
  editPanel(action, flow) {
    return `<section class="rounded-[1.75rem] border border-amber-400/20 bg-amber-400/[0.045] p-5 space-y-5">
      <div><h3 class="text-xl font-black text-amber-100">Editar configuração do fluxo</h3><p class="text-sm text-amber-100/70 mt-1">Tudo que for salvo aqui atualiza a ação, o app principal, os OKRs e os cálculos de conversão.</p></div>
      <div class="grid xl:grid-cols-2 gap-4">
        <div class="rounded-3xl border border-white/10 bg-white/[0.055] p-4"><div class="flex items-center justify-between gap-3 mb-3"><h4 class="font-black">Passagens e canais</h4><span class="text-xs text-slate-400">Remova etapas e defina locais do fluxo</span></div><div class="space-y-3">${flow.config.map((cfg, index) => this.stepEditor(action, cfg, index)).join('')}</div></div>
        <div class="rounded-3xl border border-white/10 bg-white/[0.055] p-4"><div class="flex items-center justify-between gap-3 mb-3"><h4 class="font-black">OKRs da ação</h4><button onclick="Actions.addActionFlowOkr(${action.id})" class="px-3 py-2 rounded-xl bg-white/10 border border-white/10 text-xs font-black">+ OKR</button></div><div class="space-y-2">${(action.okrs || []).map((okr, index) => this.okrEditor(action, okr, index, flow)).join('') || '<p class="text-sm text-slate-400">Nenhum OKR cadastrado.</p>'}</div></div>
      </div>
    </section>`;
  },
  stepEditor(action, cfg, index) {
    const disabled = cfg.enabled === false;
    return `<div class="rounded-2xl border border-white/10 bg-slate-950/20 p-3 ${disabled ? 'opacity-45' : ''}"><div class="grid md:grid-cols-[auto_1fr_120px] gap-2 items-center"><button onclick="Actions.toggleActionFlowStep(${action.id}, ${index})" class="px-3 py-2 rounded-xl ${disabled ? 'bg-white/10 text-slate-300' : 'bg-emerald-500/20 text-emerald-200'} text-xs font-black">${disabled ? 'Reativar' : 'Remover'}</button><div><p class="text-xs font-black text-slate-400">${Utils.escape(FlowResolutionEngine.label(cfg.stageId))}</p><input value="${Utils.escape(cfg.channelName || '')}" oninput="Actions.updateActionFlowStep(${action.id}, ${index}, 'channelName', this.value)" placeholder="Canal/local: Instagram, LP, Checkout..." class="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-slate-400 font-semibold text-sm" /></div><div><p class="text-xs font-black text-slate-400">Avançaram</p><input type="number" value="${cfg.manualConverted ?? ''}" oninput="Actions.updateActionFlowStep(${action.id}, ${index}, 'manualConverted', this.value)" placeholder="auto" class="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-slate-400 font-black text-sm" /></div></div></div>`;
  },
  okrEditor(action, okr, index, flow) {
    const options = (flow.config || []).map(cfg => `<option class="bg-slate-950 text-white" value="${Utils.escape(cfg.stageId)}" ${okr.stageId === cfg.stageId ? 'selected' : ''}>${Utils.escape(FlowResolutionEngine.label(cfg.stageId))}</option>`).join('');
    return `<div class="grid xl:grid-cols-[1.2fr_150px_80px_80px_auto] gap-2"><input value="${Utils.escape(okr.name)}" oninput="Actions.updateActionFlowOkr(${action.id}, ${index}, 'name', this.value)" placeholder="Nome do OKR" class="px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-slate-400 text-sm font-semibold" /><select onchange="Actions.updateActionFlowOkr(${action.id}, ${index}, 'stageId', this.value)" class="px-3 py-2.5 rounded-xl bg-slate-950 border border-white/20 text-white text-sm font-black" style="color-scheme: dark; background-color:#020617; color:#fff;">${options}</select><input value="${Utils.escape(okr.target || '')}" oninput="Actions.updateActionFlowOkr(${action.id}, ${index}, 'target', this.value)" placeholder="Meta" class="px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-slate-400 text-sm font-black" /><input value="${Utils.escape(okr.current || '')}" oninput="Actions.updateActionFlowOkr(${action.id}, ${index}, 'current', this.value)" placeholder="Atual" class="px-3 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white placeholder:text-slate-400 text-sm font-black" /><button onclick="Actions.removeActionFlowOkr(${action.id}, ${index})" class="px-3 py-2 rounded-xl bg-red-500/10 border border-red-400/20 text-red-200 font-black">×</button></div>`;
  },
  handoffs(flow) {
    const items = flow.steps.filter(s => s.isHandoff);
    if (!items.length) return `<div class="rounded-2xl p-4 border border-white/10 bg-white/[0.055]"><p class="text-sm font-black text-slate-200">Sem handoff setorial</p><p class="text-xs text-slate-400 mt-1">A ação permanece no mesmo setor.</p></div>`;
    return items.map(s => `<button class="rounded-2xl p-4 text-left hover:bg-white/10 transition border border-white/10 bg-white/[0.055]"><div class="flex items-center justify-between gap-3 mb-2"><p class="text-sm font-black text-amber-200">Handoff</p><span class="text-xl font-black text-amber-300">${s.conversionRate}%</span></div><p class="text-sm text-slate-200">${Utils.escape(s.label)}</p><p class="text-xs text-slate-400 mt-1">Passagem entre setores</p></button>`).join('');
  },
  _okrsByStage(action) {
    const map = new Map();
    for (const okr of (action.okrs || [])) {
      const key = okr.stageId || '';
      const bucket = map.get(key);
      if (bucket) bucket.push(okr);
      else map.set(key, [okr]);
    }
    return map;
  },
  _numberFormatter: new Intl.NumberFormat('pt-BR'),
  stage(step, index, steps, action, okrsByStage) {
    const color = step.isDestination ? 'emerald' : step.isHandoff ? 'amber' : step.isOrigin ? 'violet' : 'sky';
    const next = index < steps.length - 1;
    const channel = step.channelName ? `<p class="text-xs font-semibold text-${color}-300 mb-1">${Utils.escape(step.channelName)}</p>` : '';
    const stageOkrs = okrsByStage ? (okrsByStage.get(step.stageId) || []) : (action.okrs || []).filter(okr => (okr.stageId || '') === step.stageId);
    const okrBadges = stageOkrs.length ? `<div class="mt-3 flex flex-wrap justify-center gap-1">${stageOkrs.slice(0,3).map(okr => `<span class="px-2 py-1 rounded-full bg-white/10 border border-white/10 text-[10px] font-black text-${color}-200">${Utils.escape(okr.name)} ${Utils.escape(okr.current || '')}${Utils.escape(okr.unit || '')}</span>`).join('')}${stageOkrs.length > 3 ? `<span class="px-2 py-1 rounded-full bg-white/10 border border-white/10 text-[10px] font-black">+${stageOkrs.length - 3}</span>` : ''}</div>` : '';
    return `<div class="relative"><div class="mb-7 text-center min-h-[68px]">${channel}<h3 class="text-2xl font-black text-white">${Utils.escape(step.funnel)}</h3><p class="text-${color}-300">${Utils.escape(step.sector)}</p></div><button class="relative w-[178px] min-h-[230px] rounded-2xl border border-${color}-400/50 bg-gradient-to-b from-${color}-500/25 to-slate-950/40 p-5 text-center shadow-2xl"><div class="pt-4"><div class="text-3xl font-black text-white">${this._numberFormatter.format(step.converted)}</div><div class="text-xs mt-1">${step.isOrigin ? 'Leads impactados' : 'Leads avançaram'}</div><div class="h-px bg-white/15 my-4"></div><div class="text-2xl font-black text-white">${step.conversionRate}%</div><div class="text-xs text-slate-300">Taxa de conversão</div><div class="mt-3 inline-flex px-2 py-1 rounded-full bg-white/10 text-[10px] font-black">${step.isOrigin ? 'Origem' : step.isDestination ? 'Destino' : step.isHandoff ? 'Handoff' : 'Passagem'}</div>${okrBadges}</div></button>${next ? `<div class="absolute top-[170px] left-[178px] w-14 flex items-center z-20"><div class="h-1 flex-1 bg-white/25"></div><div class="px-2 py-1 rounded-md bg-slate-900 border border-white/20 text-xs font-bold text-white">${steps[index+1].conversionRate}%</div></div>` : ''}${index > 0 ? `<div class="absolute left-1/2 top-[342px] -translate-x-1/2 w-[162px] rounded-2xl p-4 text-center border border-red-400/70 bg-red-950/25 shadow-2xl"><div class="text-xl font-black text-red-100">${this._numberFormatter.format(step.drop)}</div><p class="text-xs text-red-100/80">Leads não avançaram</p></div>` : ''}</div>`;
  },
  bottomMetric(label, value, sub, color='text-white') { return `<div class="rounded-2xl border border-white/10 bg-white/5 p-4"><p class="text-xs text-slate-400 mb-2">${label}</p><div class="text-2xl font-black ${color}">${value}</div><p class="text-xs text-slate-400 mt-1">${sub}</p></div>`; }
};
window.ActionFlowModal = ActionFlowModal;


// V12.2 OKRs e KPIs — helper visual não destrutivo
window.renderActionOKRKPIBlock = function(action = {}) {
  const normalized = window.OKRKPIAdapter ? window.OKRKPIAdapter.normalizeAction(action) : action;
  const okrs = normalized.okrs || [];
  const kpis = normalized.kpis || [];

  return `
    <section class="grid md:grid-cols-2 gap-4 mt-4" data-v122-okr-kpi-block>
      <div class="lj-okr-section">
        <div class="flex items-center justify-between mb-3">
          <h3 class="lj-okr-title">OKRs de crescimento</h3>
          <span class="lj-badge lj-badge-marketing">Projetados</span>
        </div>
        <p class="text-xs text-slate-400 mb-4">OKRs possuem projetado, atual, gap e cascateiam para funil, setor, revenue e produto.</p>
        <div class="space-y-3">
          ${(okrs.length ? okrs : [{ name: "Gerar leads qualificados", projected: 0, current: 0 }]).map((okr) =>
            window.OKRsModule ? window.OKRsModule.renderOKRCard(okr) : `<div>${okr.name}</div>`
          ).join("")}
        </div>
      </div>

      <div class="lj-kpi-section">
        <div class="flex items-center justify-between mb-3">
          <h3 class="lj-kpi-title">KPIs de acompanhamento</h3>
          <span class="lj-badge">Contexto</span>
        </div>
        <p class="text-xs text-slate-400 mb-4">KPIs não possuem projeção. Eles explicam por que os OKRs estão ou não sendo atingidos.</p>
        <div class="space-y-3">
          ${(kpis.length ? kpis : [{ name: "CTR", current: 0, trend: "stable" }]).map((kpi) =>
            window.KPIsModule ? window.KPIsModule.renderKPICard(kpi) : `<div>${kpi.name}</div>`
          ).join("")}
        </div>
      </div>
    </section>
  `;
};
