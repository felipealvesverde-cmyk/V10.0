// V17.3 — Strategic Overview Modal
// Visão geral macro do Mapa da Receita em formato árvore (org chart):
// Visão → Objetivos → OKRs com barra de progresso e %.
// MVP: foco em conexões e leitura. Sem edição aqui (edição fica no Mapa).
window.StrategicOverviewModal = {
  render() {
    if (!App.state.showStrategicOverview) return '';
    const productId = App.state.strategicMapProductId;
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    if (!product) return '';
    const map = StrategicMapEngine.getForProduct(product.id);
    const snap = StrategicMapEngine.snapshot(product.id);
    return `<div class="fixed inset-0 z-[90] bg-slate-950/90 backdrop-blur-sm p-4 overflow-auto grid place-items-start justify-items-center">
      <div class="rounded-[2rem] overflow-hidden shadow-2xl text-white" style="width:94vw;max-width:1400px;background: radial-gradient(circle at 18% 8%, rgba(99,102,241,.25), transparent 32%), radial-gradient(circle at 82% 0%, rgba(34,197,94,.15), transparent 32%), #071326;">
        ${this._header(product, snap)}
        <div class="p-6 lg:p-8 overflow-auto" style="max-height:78vh;">
          ${this._tree(product, map)}
        </div>
      </div>
    </div>`;
  },

  _header(product, snap) {
    return `<header class="p-5 border-b border-white/10 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1"><i data-lucide="layout-grid" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-slate-300 uppercase tracking-wider">Visão geral · Mapa Estratégico</p></div>
        <h2 class="text-2xl font-black">${Utils.escape(product.name)}</h2>
        <p class="text-xs text-slate-300 mt-1">${snap.objectivesCount} objetivo(s) · ${snap.okrsCount} OKR(s) · progresso médio ${snap.avgProgress}%</p>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="Actions.closeStrategicOverview()" class="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-semibold flex items-center gap-2"><i data-lucide="x" class="w-4 h-4"></i> Fechar</button>
      </div>
    </header>`;
  },

  _tree(product, map) {
    const vision = String(map.vision || '').trim();
    const objectives = map.objectives || [];
    if (!objectives.length && !vision) {
      return `<div class="rounded-3xl bg-white/[0.04] border border-dashed border-white/15 p-10 text-center text-slate-300">
        <i data-lucide="git-fork" class="w-8 h-8 mx-auto mb-3 text-indigo-300"></i>
        <p class="font-black text-white">Nada para visualizar ainda</p>
        <p class="text-sm mt-1">Cadastre visão, objetivos e OKRs no Mapa da Receita para ver a árvore aqui.</p>
      </div>`;
    }
    return `<div class="space-y-0 min-w-[680px]">
      ${this._visionNode(vision)}
      ${objectives.length ? this._objectivesBus(objectives) : ''}
    </div>`;
  },

  _visionNode(vision) {
    return `<div class="grid place-items-center">
      <div class="rounded-2xl bg-gradient-to-br from-indigo-500/25 to-indigo-400/10 border border-indigo-400/40 px-5 py-4 max-w-2xl w-full text-center">
        <div class="flex items-center justify-center gap-2 mb-1"><i data-lucide="eye" class="w-3.5 h-3.5 text-indigo-200"></i><p class="text-[10px] font-black text-indigo-200 uppercase tracking-wider">Visão</p></div>
        <p class="font-black text-white text-base leading-snug">${Utils.escape(vision || '— Sem visão definida —')}</p>
      </div>
    </div>`;
  },

  _objectivesBus(objectives) {
    const n = objectives.length;
    // Bus horizontal: começa no meio do primeiro filho e termina no meio do último.
    // 1 filho → sem bus; 2+ filhos → bus visível.
    const busStyle = n > 1
      ? `position:absolute;top:0;left:calc(${100 / (n * 2)}%);right:calc(${100 / (n * 2)}%);height:1px;background:rgba(255,255,255,.18);`
      : 'display:none;';
    return `<div class="grid place-items-center h-8"><div style="width:1px;height:100%;background:rgba(255,255,255,.18);"></div></div>
      <div class="relative" style="padding-top:0;">
        <div style="${busStyle}"></div>
        <div class="grid gap-3" style="grid-template-columns:repeat(${Math.min(n, 4)}, minmax(0, 1fr));">
          ${objectives.map(obj => this._objectiveNode(obj)).join('')}
        </div>
      </div>`;
  },

  _objectiveNode(obj) {
    const okrs = obj.okrs || [];
    const avgProgress = okrs.length
      ? Math.round(okrs.reduce((sum, kr) => sum + StrategicOkrEngine.progress(kr), 0) / okrs.length)
      : 0;
    const status = StrategicMapRenderer.okrStatus(avgProgress);
    return `<div class="flex flex-col items-center">
      <div style="width:1px;height:16px;background:rgba(255,255,255,.18);"></div>
      <div class="rounded-2xl bg-white/[0.06] border border-white/15 p-4 w-full">
        <div class="flex items-center gap-1.5 mb-1"><i data-lucide="flag" class="w-3 h-3 text-indigo-200"></i><p class="text-[9px] font-black text-indigo-200 uppercase tracking-wider">Objetivo</p></div>
        <p class="font-black text-white text-sm leading-tight mb-2">${Utils.escape(obj.label || 'Sem nome')}</p>
        <div class="flex items-center justify-between gap-2 mb-1.5">
          <p class="text-[10px] text-slate-400">${okrs.length} OKR(s)</p>
          <span class="text-[10px] font-black text-${status.color}-200">${avgProgress}%</span>
        </div>
        ${StrategicMapRenderer.progressBar(avgProgress, status.color)}
      </div>
      ${okrs.length ? this._okrsList(obj.id, okrs) : ''}
    </div>`;
  },

  _okrsList(objectiveId, okrs) {
    return `<div class="grid place-items-center h-5"><div style="width:1px;height:100%;background:rgba(255,255,255,.18);"></div></div>
      <div class="w-full space-y-2">
        ${okrs.map((kr, i) => this._okrNode(kr, i === okrs.length - 1)).join('')}
      </div>`;
  },

  _okrNode(kr, isLast) {
    const progress = StrategicOkrEngine.progress(kr);
    const status = StrategicMapRenderer.okrStatus(progress);
    const connectedCount = (kr.connectedActionIds || []).length;
    return `<div class="rounded-xl bg-black/30 border border-white/10 p-3 relative">
      <div class="flex items-center gap-1.5 mb-0.5"><i data-lucide="target" class="w-3 h-3 text-${status.color}-300"></i><p class="text-[9px] font-black text-${status.color}-200 uppercase tracking-wider">OKR</p></div>
      <p class="font-bold text-white text-xs leading-tight mb-1">${Utils.escape(kr.name || 'Sem nome')}</p>
      <div class="flex items-center justify-between gap-2 mb-1">
        <p class="text-[9px] text-slate-400">${Number(kr.current || 0)}/${Number(kr.target || 0)} ${Utils.escape(kr.metric)} · ${connectedCount} ação(ões)</p>
        <span class="text-[10px] font-black text-${status.color}-200">${progress}%</span>
      </div>
      ${StrategicMapRenderer.progressBar(progress, status.color)}
    </div>`;
  }
};
