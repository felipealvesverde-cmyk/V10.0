// V14.3 — Modal de criação/edição de OKR conectado a métricas RevOps.
// Suporta nível Produto (estratégico) e nível Campanha (tático).
// Quando aberto a partir de um KPI do Painel Rosa, pré-seleciona a métrica do KR inicial.
var RevopsOkrModal = {
  render() {
    if (!App.state.showRevopsOkrModal || !App.state.revopsOkrDraft) return '';
    const draft = App.state.revopsOkrDraft;
    const scope = draft.scope || 'product';
    const context = { productId: draft.productId, campaignId: draft.campaignId };
    const product = (App.state.products || []).find(p => Number(p.id) === Number(draft.productId));
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(draft.campaignId));
    const title = scope === 'product' ? 'OKR Estratégico do Produto' : 'OKR Tático da Campanha';
    const subtitle = scope === 'product'
      ? `Objetivo qualitativo do produto ${Utils.escape(product?.name || '')} com KRs vinculados a métricas RevOps.`
      : `Objetivo tático para a campanha ${Utils.escape(campaign?.name || '')}. KRs podem herdar de um KR do produto.`;

    return `<div class="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm p-4 overflow-auto">
      <div class="max-w-3xl mx-auto rounded-[2rem] overflow-hidden shadow-2xl text-white" style="background: radial-gradient(circle at 18% 10%, rgba(99,102,241,.24), transparent 30%), #071326;">
        <header class="p-6 border-b border-white/10 flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 mb-2"><i data-lucide="compass" class="w-4 h-4 text-indigo-300"></i><p class="text-xs font-black text-slate-300 uppercase tracking-wider">${scope === 'product' ? 'Nível Produto' : 'Nível Campanha'}</p></div>
            <h2 class="text-2xl font-black">${title}</h2>
            <p class="text-sm text-slate-300 mt-1">${subtitle}</p>
          </div>
          <button onclick="Actions.closeRevopsOkr()" class="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center gap-2 text-sm font-semibold"><i data-lucide="x" class="w-4 h-4"></i> Fechar</button>
        </header>

        <div class="p-6 space-y-4">
          <div>
            <label class="text-xs font-black text-slate-300 uppercase tracking-wider">Objetivo (O)</label>
            <input value="${Utils.escape(draft.objective || '')}" oninput="Actions.updateRevopsOkrDraft('objective', this.value)" placeholder="${scope === 'product' ? 'Ex.: Atingir lucratividade máxima' : 'Ex.: Estabilizar Campanha Maio'}" class="mt-2 w-full px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-bold placeholder:text-slate-500" />
          </div>

          <div class="rounded-3xl border border-white/10 bg-white/[0.055] p-4">
            <div class="flex items-center justify-between gap-3 mb-3">
              <div>
                <h3 class="font-black text-lg">Key Results (KRs)</h3>
                <p class="text-xs text-slate-400">Cada KR é uma métrica viva. O valor "atual" é calculado em tempo real pelo motor RevOps.</p>
              </div>
              <button onclick="Actions.addRevopsOkrKr()" class="px-3 py-2 rounded-xl bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 text-xs font-black">+ KR</button>
            </div>
            <div class="space-y-3">${(draft.keyResults || []).map((kr, index) => this._krRow(kr, index, scope, context)).join('') || '<p class="text-sm text-slate-400">Nenhum KR ainda. Adicione um para vincular este OKR a uma métrica.</p>'}</div>
          </div>
        </div>

        <footer class="p-6 border-t border-white/10 flex flex-col md:flex-row gap-3 justify-end">
          <button onclick="Actions.closeRevopsOkr()" class="px-5 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-black">Cancelar</button>
          ${draft.editingId ? `<button onclick="Actions.deleteRevopsOkr()" class="px-5 py-3 rounded-2xl bg-red-500/10 text-red-200 border border-red-400/30 font-black">Remover OKR</button>` : ''}
          <button onclick="Actions.saveRevopsOkr()" class="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black">${draft.editingId ? 'Salvar alterações' : 'Criar OKR'}</button>
        </footer>
      </div>
    </div>`;
  },

  _krRow(kr, index, scope, context) {
    const metrics = RevopsFinanceEngine.metricList(scope);
    const meta = RevopsFinanceEngine.METRIC_CATALOG[kr.metric] || metrics[0];
    const evaluation = scope === 'product'
      ? RevopsFinanceEngine.evaluateKeyResult(kr, { productId: context.productId })
      : RevopsFinanceEngine.evaluateKeyResult(kr, { campaignId: context.campaignId });
    const currentDisplay = meta?.unit === 'R$' ? RevopsFinanceEngine.money(evaluation.current)
      : meta?.unit === '%' ? RevopsFinanceEngine.percent(evaluation.current)
      : Math.round(evaluation.current).toLocaleString('pt-BR');
    const targetDisplay = meta?.unit === 'R$' ? 'R$' : meta?.unit === '%' ? '%' : 'un';

    const parentOptions = scope === 'campaign' ? this._parentKrOptions(context.productId, kr.parentKrId) : '';

    return `<div class="rounded-2xl border border-white/10 bg-black/20 p-3">
      <div class="grid lg:grid-cols-[1fr_220px_140px_36px] gap-2 items-end">
        <div>
          <label class="text-[10px] text-slate-400 font-black uppercase">Descrição do KR</label>
          <input value="${Utils.escape(kr.label || '')}" oninput="Actions.updateRevopsOkrKrField(${index}, 'label', this.value)" placeholder="Ex.: Reduzir CAC para R$ 15" class="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white font-semibold text-sm" />
        </div>
        <div>
          <label class="text-[10px] text-slate-400 font-black uppercase">Métrica vinculada</label>
          <select onchange="Actions.updateRevopsOkrKrField(${index}, 'metric', this.value)" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/20 text-white text-sm font-black" style="color-scheme: dark;">
            ${metrics.map(m => `<option value="${m.id}" ${kr.metric === m.id ? 'selected' : ''} class="bg-slate-900 text-white">${m.label} (${m.unit})</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-[10px] text-slate-400 font-black uppercase">Meta (${targetDisplay})</label>
          <input type="number" min="0" step="0.01" value="${Number(kr.target || 0)}" oninput="Actions.updateRevopsOkrKrField(${index}, 'target', Number(this.value || 0))" class="w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white font-black text-sm text-right" />
        </div>
        <button onclick="Actions.removeRevopsOkrKr(${index})" class="h-10 rounded-xl bg-red-500/10 text-red-200 border border-red-400/20 font-black">×</button>
      </div>
      ${parentOptions ? `<div class="mt-2"><label class="text-[10px] text-slate-400 font-black uppercase">Herda do KR estratégico (opcional)</label><select onchange="Actions.updateRevopsOkrKrField(${index}, 'parentKrId', this.value || null)" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/20 text-white text-sm font-black" style="color-scheme: dark;"><option value="" class="bg-slate-900">Não vincular</option>${parentOptions}</select></div>` : ''}
      <div class="mt-2 flex items-center justify-between gap-3 text-xs">
        <span class="text-slate-400">Atual ao vivo: <b class="text-white">${currentDisplay}</b> • Progresso ${Math.round(evaluation.progress)}%</span>
        <span class="px-2 py-1 rounded-full text-[10px] font-black ${evaluation.health === 'No alvo' ? 'bg-emerald-500/20 text-emerald-300' : evaluation.health === 'Atenção' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}">${evaluation.health}</span>
      </div>
    </div>`;
  },

  _parentKrOptions(productId, selectedId) {
    if (!productId) return '';
    const productOkrs = (App.state.strategicOkrs || []).filter(okr => Number(okr.productId) === Number(productId));
    const krs = [];
    for (const okr of productOkrs) {
      for (const kr of (okr.keyResults || [])) {
        krs.push({ okrObjective: okr.objective || okr.name, kr });
      }
    }
    if (!krs.length) return '';
    return krs.map(item => `<option value="${Utils.escape(item.kr.id)}" ${selectedId === item.kr.id ? 'selected' : ''} class="bg-slate-900 text-white">${Utils.escape(item.okrObjective)} → ${Utils.escape(item.kr.label || RevopsFinanceEngine.METRIC_CATALOG[item.kr.metric]?.label || 'KR')}</option>`).join('');
  }
};
window.RevopsOkrModal = RevopsOkrModal;
