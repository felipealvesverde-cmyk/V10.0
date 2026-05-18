// V31.2.2 — Strategic Overview Modal (Mapa de Fluxo)
// Refatorado pra árvore hierárquica top-down (padrão OKR clássico):
//   Visão → 3 frentes (Mkt/Vendas/CS) → KRs-mãe da frente → Ações conectadas → Tasks
// Cada nível conectado ao pai via linhas CSS (border-left vertical + border-top
// horizontal nos siblings). Substitui o SVG anterior que ficava bagunçado.
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
    const areas = window.StrategicMapEngine?.COMERCIAL_AREAS || [];
    return `<div class="flex flex-col items-center space-y-0">
      ${this._visionBlock(vision)}
      ${this._verticalConnector()}
      <div class="w-full">
        ${this._horizontalBus(areas.length)}
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          ${areas.map(area => this._areaSubTree(area, productKrs, branches)).join('')}
        </div>
      </div>
    </div>`;
  },

  // ───────────── nível 0: Visão (centralizado) ─────────────
  _visionBlock(vision) {
    return `<div class="rounded-2xl bg-gradient-to-br from-indigo-500/30 to-indigo-400/15 border border-indigo-400/50 px-6 py-4 max-w-3xl w-full text-center">
      <div class="flex items-center justify-center gap-2 mb-1.5"><i data-lucide="eye" class="w-3.5 h-3.5 text-indigo-200"></i><p class="text-[10px] font-black text-indigo-200 uppercase tracking-wider">Visão do Produto</p></div>
      <p class="font-black text-white text-base leading-snug">${Utils.escape(vision || '— Sem visão definida —')}</p>
    </div>`;
  },

  // Conector vertical entre níveis (visão → bus dos frentes; frente → bus dos KRs; etc.)
  _verticalConnector(height = 24) {
    return `<div style="width:1px;height:${height}px;background:rgba(255,255,255,0.22);"></div>`;
  },

  // Bus horizontal que distribui n filhos abaixo de um pai centralizado.
  _horizontalBus(n) {
    if (n <= 1) return '';
    const inset = `calc(${100 / (n * 2)}% - 0px)`;
    return `<div class="relative h-3 mb-1">
      <div style="position:absolute;left:${inset};right:${inset};top:50%;height:1px;background:rgba(255,255,255,0.22);"></div>
    </div>`;
  },

  // ───────────── nível 1: Frente comercial (Mkt/Vendas/CS) ─────────────
  _areaSubTree(area, allProductKrs, branches) {
    const tone = area.color;
    const areaPkrs = allProductKrs.filter(k => k.area === area.id);
    return `<div class="flex flex-col items-center">
      <div class="relative w-full flex flex-col items-center">
        <div style="width:1px;height:8px;background:rgba(255,255,255,0.22);"></div>
        <div class="rounded-2xl bg-${tone}-500/20 border border-${tone}-400/50 px-4 py-3 w-full text-center">
          <div class="flex items-center justify-center gap-2 mb-0.5">
            <i data-lucide="${area.icon}" class="w-4 h-4 text-${tone}-100"></i>
            <p class="font-black text-${tone}-50 text-sm">${Utils.escape(area.label)}</p>
          </div>
          <p class="text-[10px] text-${tone}-200 opacity-80">${areaPkrs.length} KR(s)-mãe</p>
        </div>
      </div>
      ${areaPkrs.length === 0
        ? `<p class="text-[11px] text-slate-500 italic mt-3">CEO não definiu números nesta frente.</p>`
        : `${this._verticalConnector(20)}
            ${areaPkrs.length > 1 ? this._horizontalBus(areaPkrs.length) : ''}
            <div class="grid ${areaPkrs.length > 1 ? 'grid-cols-' + Math.min(areaPkrs.length, 2) : 'grid-cols-1'} gap-3 w-full">
              ${areaPkrs.map(pkr => this._pkrSubTree(pkr, tone, branches)).join('')}
            </div>`}
    </div>`;
  },

  // ───────────── nível 2: KR-mãe do produto ─────────────
  _pkrSubTree(pkr, tone, branches) {
    // Coleta todos os childKrs com parentProductKrId = pkr.id (across all branches)
    const childOkrs = branches.flatMap(b =>
      (b.objectives || [])
        .flatMap(o => o.okrs || [])
        .filter(k => k.parentProductKrId === pkr.id)
        .map(k => ({ kr: k, branch: b }))
    );
    // Coleta todos os actionIds connected nesses childKrs
    const actionIds = new Set();
    childOkrs.forEach(({ kr }) => (kr.connectedActionIds || []).forEach(id => actionIds.add(Number(id))));
    const actions = (App.state.actions || []).filter(a => actionIds.has(Number(a.id)));
    const progress = this._krProgress(pkr);
    const status = window.StrategicMapRenderer ? StrategicMapRenderer.okrStatus(progress) : { color: 'slate' };
    return `<div class="flex flex-col items-center">
      <div class="rounded-xl bg-black/40 border border-${tone}-400/30 p-3 w-full text-center">
        <p class="text-[9px] font-black text-${tone}-200 uppercase tracking-wider mb-0.5">KR-mãe</p>
        <p class="font-black text-white text-[12px] leading-tight mb-1">${Utils.escape(pkr.name)}</p>
        <div class="flex items-center justify-between gap-2 mb-1">
          <p class="text-[9px] text-slate-400">${Number(pkr.current || 0)}/${Number(pkr.target || 0)} ${Utils.escape(pkr.unit || pkr.metric || '')}</p>
          <span class="text-[10px] font-black text-${status.color}-200">${progress}%</span>
        </div>
        ${window.StrategicMapRenderer ? StrategicMapRenderer.progressBar(progress, status.color) : ''}
      </div>
      ${actions.length === 0
        ? `<p class="text-[10px] text-slate-500 italic mt-2">Nenhuma ação conectada.</p>`
        : `${this._verticalConnector(16)}
            ${actions.length > 1 ? this._horizontalBus(actions.length) : ''}
            <div class="grid grid-cols-${Math.min(actions.length, 2)} gap-2 w-full">
              ${actions.map(a => this._actionLeaf(a, tone)).join('')}
            </div>`}
    </div>`;
  },

  // ───────────── nível 3: Ação operacional ─────────────
  _actionLeaf(action, tone) {
    const tasks = (App.state.executionTasks || []).filter(t => Number(t.linked_action_id) === Number(action.id));
    const status = (window.StrategicMapEngine?.STRATEGIC_ACTION_STATUSES || []).find(s => s.id === action.strategicStatus) || { label: 'Planejada', color: 'slate' };
    return `<div class="flex flex-col items-center">
      <div class="rounded-lg bg-${tone}-500/10 border border-${tone}-400/30 p-2 w-full">
        <p class="text-[9px] font-black text-${tone}-200 uppercase tracking-wider mb-0.5">${Utils.escape(action.channel || 'AÇÃO')}</p>
        <p class="font-bold text-white text-[10px] leading-tight mb-1 truncate" title="${Utils.escape(action.name)}">${Utils.escape(action.name)}</p>
        <div class="flex items-center justify-between gap-1">
          <span class="px-1.5 py-0.5 rounded-full bg-${status.color}-500/30 border border-${status.color}-400/40 text-${status.color}-100 text-[8px] font-black">${Utils.escape(status.label).toUpperCase()}</span>
          <button onclick="Actions.openActionFromMap(${action.id})" class="text-[9px] font-black text-white/60 hover:text-white" title="Abrir ação">↗</button>
        </div>
      </div>
      ${tasks.length === 0
        ? `<p class="text-[9px] text-slate-600 italic mt-1">sem tasks</p>`
        : `${this._verticalConnector(12)}
            ${tasks.length > 1 ? this._horizontalBus(tasks.length) : ''}
            <div class="grid grid-cols-${Math.min(tasks.length, 2)} gap-1 w-full">
              ${tasks.map(t => this._taskLeaf(t, tone)).join('')}
            </div>`}
    </div>`;
  },

  // ───────────── nível 4: Task de execução ─────────────
  _taskLeaf(task, tone) {
    const isDone = task.status === 'completed';
    const isRunning = task.status === 'in_progress' || task.status === 'running';
    const iconColor = isDone ? 'emerald' : isRunning ? 'amber' : 'slate';
    const icon = isDone ? 'check' : isRunning ? 'play' : 'clock';
    return `<div class="rounded-md bg-black/40 border border-${iconColor}-400/30 p-1.5 flex items-center gap-1">
      <i data-lucide="${icon}" class="w-2.5 h-2.5 text-${iconColor}-300 shrink-0"></i>
      <p class="text-[9px] text-slate-200 font-bold truncate" title="${Utils.escape(task.title || '')}">${Utils.escape((task.title || '').slice(0, 20))}</p>
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
