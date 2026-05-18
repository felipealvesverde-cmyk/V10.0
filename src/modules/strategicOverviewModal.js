// V31.0.11 — Strategic Overview Modal (Mapa de Fluxo)
// Visão árvore COMPLETA do Mapa da Receita V29:
//   Visão → KRs-mãe (productKrs por área) → Branches (cada uma com seus OKRs)
// Antes lia só de map.objectives (legacy V28). Agora renderiza V29 inteira.
window.StrategicOverviewModal = {
  render() {
    if (!App.state.showStrategicOverview) return '';
    const productId = App.state.strategicMapProductId;
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    if (!product) return '';
    const map = StrategicMapEngine.getForProduct(product.id);
    const productKrs = (map && map.productKrs) || [];
    const branches = window.StrategicMapEngine?.getBranchesByProduct
      ? StrategicMapEngine.getBranchesByProduct(product.id)
      : [];
    const allBranchOkrs = branches.flatMap(b => (b.objectives || []).flatMap(o => o.okrs || []));
    return `<div class="fixed inset-0 z-[90] bg-slate-950/90 backdrop-blur-sm p-4 overflow-auto grid place-items-start justify-items-center">
      <div class="rounded-[2rem] overflow-hidden shadow-2xl text-white" style="width:93vw;max-width:1500px;background: radial-gradient(circle at 18% 8%, rgba(99,102,241,.25), transparent 32%), radial-gradient(circle at 82% 0%, rgba(34,197,94,.15), transparent 32%), #071326;">
        ${this._header(product, productKrs, branches, allBranchOkrs)}
        <div class="p-6 lg:p-8 overflow-auto" style="max-height:82vh;">
          ${this._tree(product, map, productKrs, branches)}
        </div>
      </div>
    </div>`;
  },

  _header(product, productKrs, branches, allBranchOkrs) {
    const totalProgress = allBranchOkrs.length
      ? Math.round(allBranchOkrs.reduce((s, k) => s + this._okrProgress(k), 0) / allBranchOkrs.length)
      : 0;
    return `<header class="p-5 border-b border-white/10 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1"><i data-lucide="git-fork" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-slate-300 uppercase tracking-wider">Mapa de Fluxo · Visão Geral</p></div>
        <h2 class="text-2xl font-black">${Utils.escape(product.name)}</h2>
        <p class="text-xs text-slate-300 mt-1">${productKrs.length} KR(s)-mãe · ${branches.length} branch(es) · ${allBranchOkrs.length} OKR(s) operacionais · progresso médio ${totalProgress}%</p>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="Actions.closeStrategicOverview()" class="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-semibold flex items-center gap-2"><i data-lucide="x" class="w-4 h-4"></i> Fechar</button>
      </div>
    </header>`;
  },

  _tree(product, map, productKrs, branches) {
    const vision = String((map && map.vision) || '').trim();
    if (!vision && !productKrs.length && !branches.length) {
      return `<div class="rounded-3xl bg-white/[0.04] border border-dashed border-white/15 p-10 text-center text-slate-300">
        <i data-lucide="git-fork" class="w-8 h-8 mx-auto mb-3 text-indigo-300"></i>
        <p class="font-black text-white">Nada para visualizar ainda</p>
        <p class="text-sm mt-1">Cadastre visão, KRs-mãe e branches no Mapa da Receita para ver a árvore aqui.</p>
      </div>`;
    }
    return `<div class="space-y-8">
      ${this._visionNode(vision)}
      ${productKrs.length ? this._productKrsByArea(productKrs, branches) : ''}
      ${branches.length ? this._branchesSection(branches) : ''}
    </div>`;
  },

  _visionNode(vision) {
    return `<div class="grid place-items-center">
      <div class="rounded-2xl bg-gradient-to-br from-indigo-500/25 to-indigo-400/10 border border-indigo-400/40 px-5 py-4 max-w-3xl w-full text-center">
        <div class="flex items-center justify-center gap-2 mb-1"><i data-lucide="eye" class="w-3.5 h-3.5 text-indigo-200"></i><p class="text-[10px] font-black text-indigo-200 uppercase tracking-wider">Visão</p></div>
        <p class="font-black text-white text-base leading-snug">${Utils.escape(vision || '— Sem visão definida —')}</p>
      </div>
    </div>`;
  },

  // V31.0.11 — productKrs agrupados por área (Mkt/Vendas/CS), com indicação
  // de quantas OKRs operacionais (filhas) rolam pra cada um.
  _productKrsByArea(productKrs, branches) {
    const areas = (StrategicMapEngine.COMERCIAL_AREAS || []);
    const allChildOkrs = branches.flatMap(b => (b.objectives || []).flatMap(o => o.okrs || []));
    const countChildren = pkrId => allChildOkrs.filter(k => k.parentProductKrId === pkrId).length;
    return `<div>
      <p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider mb-3 text-center">KRs-mãe do produto (CEO)</p>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        ${areas.map(area => {
          const krs = productKrs.filter(k => k.area === area.id);
          const tone = area.color;
          return `<div class="rounded-2xl bg-${tone}-500/10 border border-${tone}-400/30 p-4 space-y-3">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-${tone}-500/20 grid place-items-center"><i data-lucide="${area.icon}" class="w-3.5 h-3.5 text-${tone}-200"></i></div>
              <p class="font-black text-${tone}-100 text-sm">${Utils.escape(area.label)}</p>
              <span class="ml-auto text-[10px] font-black text-${tone}-200">${krs.length} KR(s)</span>
            </div>
            ${krs.length === 0 ? `<p class="text-[11px] text-slate-500 italic">Nenhuma KR-mãe definida.</p>` : krs.map(kr => {
              const children = countChildren(kr.id);
              const progress = this._krProgress(kr);
              const status = window.StrategicMapRenderer ? StrategicMapRenderer.okrStatus(progress) : { color: 'slate' };
              return `<div class="rounded-xl bg-black/30 border border-white/10 p-2.5">
                <div class="flex items-center gap-1.5 mb-1"><i data-lucide="target" class="w-3 h-3 text-${tone}-300"></i><p class="text-[9px] font-black text-${tone}-200 uppercase tracking-wider">KR-mãe</p></div>
                <p class="font-bold text-white text-xs leading-tight mb-1">${Utils.escape(kr.name || 'Sem nome')}</p>
                <div class="flex items-center justify-between gap-2 mb-1">
                  <p class="text-[9px] text-slate-400">${Number(kr.current || 0)}/${Number(kr.target || 0)} ${Utils.escape(kr.unit || kr.metric || '')} · ${children} filha(s)</p>
                  <span class="text-[10px] font-black text-${status.color}-200">${progress}%</span>
                </div>
                ${window.StrategicMapRenderer ? StrategicMapRenderer.progressBar(progress, status.color) : ''}
              </div>`;
            }).join('')}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  // V31.0.11 — Cada branch (campanha) renderizada como sub-mapa com suas OKRs
  // agrupadas por área. Mostra qual OKR plugou em qual productKr-mãe.
  _branchesSection(branches) {
    return `<div>
      <p class="text-[11px] font-black text-violet-200 uppercase tracking-wider mb-3 text-center">Branches (campanhas plugadas)</p>
      <div class="space-y-4">
        ${branches.map(branch => this._branchNode(branch)).join('')}
      </div>
    </div>`;
  },

  _branchNode(branch) {
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(branch.campaignId));
    const campaignName = campaign?.name || `Branch ${branch.campaignId}`;
    const objectives = branch.objectives || [];
    const allOkrs = objectives.flatMap(o => o.okrs || []);
    const avgProgress = allOkrs.length
      ? Math.round(allOkrs.reduce((s, k) => s + this._okrProgress(k), 0) / allOkrs.length)
      : 0;
    const status = window.StrategicMapRenderer ? StrategicMapRenderer.okrStatus(avgProgress) : { color: 'slate' };
    return `<div class="rounded-2xl bg-violet-500/[0.08] border border-violet-400/30 p-4">
      <div class="flex items-center justify-between gap-3 mb-3">
        <div class="flex items-center gap-2 min-w-0">
          <i data-lucide="git-branch" class="w-4 h-4 text-violet-300 shrink-0"></i>
          <p class="font-black text-white text-sm truncate">${Utils.escape(campaignName)}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span class="text-[10px] text-slate-400">${allOkrs.length} OKR(s)</span>
          <span class="text-[11px] font-black text-${status.color}-200">${avgProgress}%</span>
        </div>
      </div>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
        ${objectives.map(obj => this._branchObjectiveCard(obj)).join('')}
      </div>
    </div>`;
  },

  _branchObjectiveCard(obj) {
    const area = (StrategicMapEngine.COMERCIAL_AREAS || []).find(a => a.id === obj.area) || { color: 'slate', icon: 'flag', label: obj.label || 'Frente' };
    const tone = area.color;
    const okrs = obj.okrs || [];
    return `<div class="rounded-xl bg-${tone}-500/5 border border-${tone}-400/20 p-3 space-y-2">
      <div class="flex items-center gap-1.5 mb-1">
        <i data-lucide="${area.icon}" class="w-3 h-3 text-${tone}-300"></i>
        <p class="text-[10px] font-black text-${tone}-200 uppercase tracking-wider">${Utils.escape(area.label || obj.label || 'Frente')}</p>
        <span class="ml-auto text-[10px] text-slate-400">${okrs.length}</span>
      </div>
      ${okrs.length === 0 ? `<p class="text-[10px] text-slate-500 italic">Sem OKRs.</p>` : okrs.map(kr => {
        const progress = this._okrProgress(kr);
        const status = window.StrategicMapRenderer ? StrategicMapRenderer.okrStatus(progress) : { color: 'slate' };
        const connected = (kr.connectedActionIds || []).length;
        return `<div class="rounded-lg bg-black/30 border border-white/10 p-2">
          <p class="font-bold text-white text-[11px] leading-tight mb-1">${Utils.escape(kr.name || 'Sem nome')}</p>
          <div class="flex items-center justify-between gap-2 mb-1">
            <p class="text-[9px] text-slate-400">${Number(kr.current || 0)}/${Number(kr.targetCommitted || kr.target || 0)} · ${connected} ação(ões)</p>
            <span class="text-[10px] font-black text-${status.color}-200">${progress}%</span>
          </div>
          ${window.StrategicMapRenderer ? StrategicMapRenderer.progressBar(progress, status.color) : ''}
        </div>`;
      }).join('')}
    </div>`;
  },

  _okrProgress(kr) {
    const target = Number(kr.targetCommitted || kr.target || 0);
    if (!target) return 0;
    const current = Number(kr.current || 0);
    return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
  },

  _krProgress(kr) {
    const target = Number(kr.target || kr.targetCommitted || 0);
    if (!target) return 0;
    const current = Number(kr.current || 0);
    return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
  }
};
