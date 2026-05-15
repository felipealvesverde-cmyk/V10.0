// V14.3 — Mapa de Impacto: fluxograma da cascata Ação → KR de Campanha → OKR do Produto.
// Renderiza, para cada OKR do produto, os KRs vinculados, campanhas que herdam
// e ações operacionais que apontam para os KRs táticos.
var RevopsImpactMap = {
  render(productId) {
    if (!productId) return '';
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    if (!product) return '';
    const productOkrs = (App.state.strategicOkrs || []).filter(okr => Number(okr.productId) === Number(productId));
    const campaigns = (App.state.campaigns || []).filter(c => Number(c.productId) === Number(productId));

    return `<section class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
      <div class="flex items-start justify-between gap-3 mb-4">
        <div>
          <div class="flex items-center gap-2 mb-1"><i data-lucide="git-branch" class="w-4 h-4 text-indigo-700"></i><h3 class="text-lg font-black text-slate-900">Mapa de Impacto Causa-Efeito</h3></div>
          <p class="text-sm text-slate-500 max-w-2xl">Visualize a cascata: <b>Ação operacional</b> ➔ <b>KR da campanha</b> ➔ <b>KPI do produto</b> ➔ <b>OKR estratégico</b>. Cada nível mostra o progresso vivo.</p>
        </div>
        <button onclick="Actions.openRevopsOkr('product', ${productId})" class="px-4 py-2.5 rounded-2xl bg-slate-900 text-white text-sm font-black flex items-center gap-2 lj-dark-button" style="color:#fff!important;"><i data-lucide="plus" class="w-4 h-4"></i> Novo OKR Estratégico</button>
      </div>

      ${productOkrs.length ? this._okrList(productOkrs, campaigns, productId) : this._emptyState(productId)}
    </section>`;
  },

  _emptyState(productId) {
    return `<div class="rounded-3xl border border-dashed border-slate-200 p-6 text-center">
      <div class="w-12 h-12 rounded-2xl bg-slate-100 grid place-items-center mx-auto mb-3"><i data-lucide="compass" class="w-6 h-6 text-slate-400"></i></div>
      <p class="text-sm font-black text-slate-700">Nenhum OKR estratégico ainda</p>
      <p class="text-xs text-slate-500 mt-1 max-w-md mx-auto">Clique em "+ OKR" em qualquer card do Painel Rosa ou no botão acima para criar um objetivo vinculado às métricas RevOps.</p>
    </div>`;
  },

  _okrList(productOkrs, campaigns, productId) {
    return `<div class="space-y-5">${productOkrs.map(okr => this._okrBlock(okr, campaigns, productId)).join('')}</div>`;
  },

  _okrBlock(okr, campaigns, productId) {
    const keyResults = okr.keyResults || [];
    const overallProgress = this._averageProgress(keyResults, { productId });
    const healthClass = overallProgress >= 100 ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : overallProgress >= 70 ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-red-100 text-red-700 border-red-200';
    return `<div class="rounded-3xl border border-indigo-100 bg-indigo-50/40 p-4">
      <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3 mb-4">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1"><span class="px-2 py-0.5 rounded-md bg-indigo-200 text-indigo-900 text-[10px] font-black uppercase">OKR Estratégico</span><span class="text-[11px] text-indigo-700 font-black">Produto</span></div>
          <h4 class="font-black text-lg text-indigo-950 leading-tight">${Utils.escape(okr.objective || okr.name || 'Objetivo sem nome')}</h4>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-3 py-1.5 rounded-full text-xs font-black border ${healthClass}">Progresso ${Math.round(overallProgress)}%</span>
          <button onclick="Actions.openRevopsOkr('product', ${productId}, '${Utils.escape(okr.id)}')" class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-black">Editar</button>
        </div>
      </div>

      ${keyResults.length ? this._krCascade(keyResults, okr.id, campaigns, productId) : '<p class="text-sm text-slate-500 px-2">Este OKR ainda não possui KRs. Edite para adicionar métricas vivas.</p>'}
    </div>`;
  },

  _krCascade(keyResults, okrId, campaigns, productId) {
    return `<div class="space-y-3">${keyResults.map(kr => this._krBlock(kr, okrId, campaigns, productId)).join('')}</div>`;
  },

  _krBlock(productKr, okrId, campaigns, productId) {
    const evaluation = RevopsFinanceEngine.evaluateKeyResult(productKr, { productId });
    const meta = evaluation.meta || RevopsFinanceEngine.METRIC_CATALOG[productKr.metric];
    const currentDisplay = meta?.unit === 'R$' ? RevopsFinanceEngine.money(evaluation.current)
      : meta?.unit === '%' ? RevopsFinanceEngine.percent(evaluation.current)
      : Math.round(evaluation.current).toLocaleString('pt-BR');
    const targetDisplay = meta?.unit === 'R$' ? RevopsFinanceEngine.money(productKr.target)
      : meta?.unit === '%' ? RevopsFinanceEngine.percent(productKr.target)
      : Math.round(productKr.target).toLocaleString('pt-BR');
    const barColor = evaluation.progress >= 100 ? '#10b981' : evaluation.progress >= 70 ? '#f59e0b' : '#ef4444';
    const linkedCampaignKrs = this._findCampaignKrsLinkedTo(productKr.id, campaigns);

    return `<div class="rounded-2xl bg-white border border-slate-200 p-4">
      <div class="grid lg:grid-cols-[1fr_auto] gap-3 items-center mb-3">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-black uppercase">KR Produto</span>
            <span class="text-[11px] text-slate-500 font-black">${meta?.label || 'Métrica'}</span>
          </div>
          <p class="font-black text-slate-900">${Utils.escape(productKr.label || meta?.label || 'KR sem rótulo')}</p>
        </div>
        <div class="text-right">
          <p class="text-xs text-slate-500"><b class="text-slate-900">${currentDisplay}</b> / meta ${targetDisplay}</p>
          <div class="mt-1 h-2 w-44 rounded-full bg-slate-100 overflow-hidden"><div class="h-full rounded-full" style="width:${Math.min(100, evaluation.progress)}%; background:${barColor};"></div></div>
        </div>
      </div>

      <div class="mt-3 pl-4 border-l-2 border-indigo-200 space-y-2">
        ${linkedCampaignKrs.length ? linkedCampaignKrs.map(item => this._campaignKrBlock(item.campaign, item.okr, item.kr)).join('') : `<p class="text-xs text-slate-400 italic">Nenhuma campanha herdou este KR ainda. Crie um KR tático na campanha apontando para este indicador.</p>`}
      </div>
    </div>`;
  },

  _findCampaignKrsLinkedTo(productKrId, campaigns) {
    const result = [];
    for (const campaign of campaigns) {
      for (const okr of (campaign.okrs || [])) {
        for (const kr of (okr.keyResults || [])) {
          if (kr.parentKrId === productKrId) result.push({ campaign, okr, kr });
        }
      }
    }
    return result;
  },

  _campaignKrBlock(campaign, campaignOkr, campaignKr) {
    const meta = RevopsFinanceEngine.METRIC_CATALOG[campaignKr.metric];
    const evaluation = RevopsFinanceEngine.evaluateKeyResult(campaignKr, { campaignId: campaign.id });
    const currentDisplay = meta?.unit === 'R$' ? RevopsFinanceEngine.money(evaluation.current)
      : meta?.unit === '%' ? RevopsFinanceEngine.percent(evaluation.current)
      : Math.round(evaluation.current).toLocaleString('pt-BR');
    const targetDisplay = meta?.unit === 'R$' ? RevopsFinanceEngine.money(campaignKr.target)
      : meta?.unit === '%' ? RevopsFinanceEngine.percent(campaignKr.target)
      : Math.round(campaignKr.target).toLocaleString('pt-BR');
    const barColor = evaluation.progress >= 100 ? '#10b981' : evaluation.progress >= 70 ? '#f59e0b' : '#ef4444';
    const linkedActions = (App.state.actions || []).filter(action => action.linkedCampaignKrId === campaignKr.id);

    return `<div class="rounded-xl bg-slate-50 border border-slate-100 p-3">
      <div class="grid lg:grid-cols-[1fr_auto] gap-2 items-center mb-2">
        <div>
          <div class="flex items-center gap-2 mb-1"><span class="px-2 py-0.5 rounded bg-sky-100 text-sky-700 text-[10px] font-black uppercase">KR Campanha</span><span class="text-[11px] text-slate-500 font-black">${Utils.escape(campaign.name)} • ${meta?.label || 'Métrica'}</span></div>
          <p class="font-black text-slate-800 text-sm">${Utils.escape(campaignKr.label || `${campaignOkr.objective || 'Tático'}: ${meta?.label || ''}`)}</p>
        </div>
        <div class="text-right">
          <p class="text-[11px] text-slate-500"><b class="text-slate-900">${currentDisplay}</b> / meta ${targetDisplay}</p>
          <div class="mt-1 h-1.5 w-32 rounded-full bg-slate-200 overflow-hidden"><div class="h-full rounded-full" style="width:${Math.min(100, evaluation.progress)}%; background:${barColor};"></div></div>
        </div>
      </div>
      <div class="pl-3 border-l-2 border-sky-200 space-y-1">
        ${linkedActions.length ? linkedActions.map(action => this._actionLeaf(action)).join('') : '<p class="text-[11px] text-slate-400 italic">Nenhuma ação ainda apontando para este KR.</p>'}
      </div>
    </div>`;
  },

  _actionLeaf(action) {
    const flow = window.FlowResolutionEngine ? FlowResolutionEngine.buildActionFlow(action) : { converted: 0, impacted: 0 };
    return `<div class="flex items-center justify-between gap-2 text-xs">
      <div class="flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-violet-500"></span><span class="font-black text-slate-700">${Utils.escape(action.name)}</span><span class="text-slate-400">${Utils.escape(action.channel || '')}</span></div>
      <span class="text-slate-500">${flow.converted}/${flow.impacted} convertidos</span>
    </div>`;
  },

  _averageProgress(keyResults, context) {
    if (!keyResults.length) return 0;
    let sum = 0, count = 0;
    for (const kr of keyResults) {
      const evaluation = RevopsFinanceEngine.evaluateKeyResult(kr, context);
      sum += evaluation.progress;
      count += 1;
    }
    return count > 0 ? sum / count : 0;
  }
};
window.RevopsImpactMap = RevopsImpactMap;
