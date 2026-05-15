// V17.1 — Strategic Map Modal (jornada guiada de 5 etapas)
// Cada etapa tem critério de conclusão, CTA "Próximo passo →" e Djow lateral.
// A etapa Executar fecha o ciclo: a partir de um OKR, abre o DjowModal V16.3
// pré-preenchido para criar tarefa no provider operacional ativo (ClickUp/Trello/etc).
window.StrategicMapModal = {
  render() {
    if (!App.state.showStrategicMap) return '';
    const productId = App.state.strategicMapProductId;
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    if (!product) return '';
    const showOnboarding = !StrategicOnboarding.hasSeen(productId);
    return `<div class="fixed inset-0 z-[80] bg-slate-950/85 backdrop-blur-sm p-4 overflow-auto grid place-items-start justify-items-center">
      <div class="rounded-[2rem] overflow-hidden shadow-2xl text-white" style="width:92vw;max-width:1400px;background: radial-gradient(circle at 18% 8%, rgba(99,102,241,.25), transparent 32%), radial-gradient(circle at 82% 0%, rgba(34,197,94,.15), transparent 32%), #071326;">
        ${this._header(product)}
        ${showOnboarding ? this._onboarding(product) : this._body(product)}
      </div>
      ${window.QuickActionModal ? QuickActionModal.render() : ''}
      ${window.StrategicOverviewModal ? StrategicOverviewModal.render() : ''}
    </div>`;
  },

  _header(product) {
    const snap = StrategicMapEngine.snapshot(product.id);
    return `<header class="p-5 border-b border-white/10 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1"><i data-lucide="compass" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-slate-300 uppercase tracking-wider">Revenue Strategic Map</p></div>
        <h2 class="text-2xl font-black">Mapa da Receita — ${Utils.escape(product.name)}</h2>
        <p class="text-xs text-slate-300 mt-1">${snap.objectivesCount} objetivo(s) · ${snap.okrsCount} OKR(s) · ${snap.connectedFlows} fluxo(s) · progresso médio ${snap.avgProgress}%</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <button onclick="Actions.openStrategicOverview()" title="Ver árvore Visão → Objetivos → OKRs" class="px-3 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-100 text-xs font-black flex items-center gap-1"><i data-lucide="layout-grid" class="w-3.5 h-3.5"></i> Visão geral</button>
        <button onclick="Actions.openStrategicOnboarding()" title="Reabrir onboarding" class="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-black flex items-center gap-1"><i data-lucide="help-circle" class="w-3.5 h-3.5"></i> Ajuda</button>
        <button onclick="Actions.syncStrategicOkrsFromOps()" title="Atualizar OKRs com leitura operacional" class="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-black flex items-center gap-1"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Sync geral</button>
        <button onclick="Actions.closeStrategicMap()" class="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-semibold flex items-center gap-2"><i data-lucide="x" class="w-4 h-4"></i> Fechar</button>
      </div>
    </header>`;
  },

  _onboarding(product) {
    return `<div class="p-6 lg:p-8 space-y-6">
      <div class="rounded-3xl bg-white/[0.05] border border-white/10 p-6">
        <div class="flex items-center gap-2 mb-3"><i data-lucide="sparkles" class="w-5 h-5 text-indigo-300"></i><p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Bem-vindo ao Mapa da Receita</p></div>
        <h3 class="text-3xl font-black mb-2">Da estratégia até o card no ClickUp.</h3>
        <p class="text-slate-300 max-w-3xl">5 etapas guiadas conectam visão, OKRs, ações e execução real. Em cada etapa, o Djow ajuda. No final, suas decisões viram tarefas no provider operacional configurado (ClickUp, Trello, Monday, Jira, Notion ou Manual).</p>
      </div>

      <div class="grid lg:grid-cols-5 gap-3">
        ${StrategicZoomNavigation.LEVELS.map((l, i) => `<div class="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
          <div class="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-200 font-black grid place-items-center mb-2 text-sm">${i + 1}</div>
          <div class="flex items-center gap-1.5 mb-1"><i data-lucide="${l.icon}" class="w-3.5 h-3.5 text-indigo-300"></i><p class="font-black text-white text-sm">${Utils.escape(l.label)}</p></div>
          <p class="text-[11px] text-slate-400">${Utils.escape(l.description)}</p>
        </div>`).join('')}
      </div>

      <div class="rounded-3xl bg-gradient-to-br from-indigo-500/15 to-emerald-500/10 border border-white/10 p-6">
        <p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider mb-3">O ciclo completo</p>
        ${StrategicMapRenderer.flowDiagramHtml()}
        <p class="text-xs text-slate-300 mt-4">Vision → Objective → OKR → Action → Task no ClickUp. Tudo conectado, com o Djow como copiloto.</p>
      </div>

      <div class="flex flex-col sm:flex-row gap-3 justify-end">
        <button onclick="Actions.closeStrategicMap()" class="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-black">Voltar depois</button>
        <button onclick="Actions.dismissStrategicOnboarding()" style="color:#fff!important;" class="px-5 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-black flex items-center gap-2"><i data-lucide="arrow-right" class="w-4 h-4"></i> Começar pela Visão</button>
      </div>
    </div>`;
  },

  _body(product) {
    const stepId = StrategicZoomNavigation.current();
    return `<div class="p-5 space-y-4">
      ${this._stepper(product)}
      <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div class="space-y-4 min-w-0">
          ${this._stepContent(product, stepId)}
        </div>
        ${this._djowSide(product, stepId)}
      </div>
    </div>`;
  },

  _stepper(product) {
    const progress = StrategicMapEngine.journeyProgress(product.id);
    const current = StrategicZoomNavigation.current();
    return `<div class="rounded-3xl bg-white/[0.04] border border-white/10 p-3">
      <div class="grid grid-cols-2 md:grid-cols-5 gap-2">
        ${StrategicZoomNavigation.LEVELS.map((level, i) => {
          const done = progress[level.id];
          const active = current === level.id;
          const tone = active ? 'bg-indigo-500/25 border-indigo-400/50' : (done ? 'bg-emerald-500/15 border-emerald-400/30' : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]');
          const numTone = active ? 'bg-indigo-500 text-white' : (done ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-300');
          return `<button onclick="Actions.setStrategicZoom('${level.id}')" class="text-left p-3 rounded-2xl border ${tone} transition flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-xl ${numTone} grid place-items-center font-black text-xs shrink-0">${done ? '✓' : (i + 1)}</div>
            <div class="min-w-0">
              <p class="text-[11px] font-black text-white truncate">${Utils.escape(level.short)}</p>
              <p class="text-[10px] text-slate-400 truncate">${done ? 'Concluído' : active ? 'Em foco' : 'Pendente'}</p>
            </div>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  },

  _stepContent(product, stepId) {
    if (stepId === 'vision')     return this._stepVision(product);
    if (stepId === 'objectives') return this._stepObjectives(product);
    if (stepId === 'okrs')       return this._stepOkrs(product);
    if (stepId === 'operations') return this._stepOperations(product);
    if (stepId === 'execution')  return this._stepExecution(product);
    return this._stepVision(product);
  },

  _stepCta(label, enabled) {
    const cls = enabled
      ? 'bg-indigo-500 hover:bg-indigo-600 text-white cursor-pointer'
      : 'bg-white/5 text-slate-500 cursor-not-allowed';
    return `<div class="flex justify-end pt-2">
      <button ${enabled ? '' : 'disabled'} onclick="Actions.advanceStrategicStep()" class="px-5 py-3 rounded-2xl ${cls} font-black flex items-center gap-2" ${enabled ? 'style="color:#fff!important;"' : ''}>${Utils.escape(label)} <i data-lucide="arrow-right" class="w-4 h-4"></i></button>
    </div>`;
  },

  // -------------------- STEP 1: VISÃO --------------------
  _stepVision(product) {
    const map = StrategicMapEngine.getForProduct(product.id);
    const hasVision = Boolean(String(map.vision || '').trim());
    return `<section class="space-y-3">
      ${this._stepIntro('Visão', 'Onde o produto quer chegar em uma frase. Pergunte ao Djow se travar.', 'eye')}
      <div class="rounded-3xl bg-white/[0.05] border border-white/10 p-5">
        <textarea oninput="Actions.updateStrategicVision(this.value)" placeholder="Ex: Transformar motoristas em empresários rentáveis até 2027." class="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-white/15 text-white text-sm font-semibold min-h-[90px] placeholder:text-slate-500" style="color-scheme:dark;">${Utils.escape(map.vision || '')}</textarea>
        <p class="text-[11px] text-slate-400 mt-2">Frase curta e ambiciosa. Esta visão guia todos os objetivos abaixo.</p>
      </div>
      ${this._stepCta('Próximo passo: definir Objetivos', hasVision)}
    </section>`;
  },

  // -------------------- STEP 2: OBJETIVOS --------------------
  _stepObjectives(product) {
    const map = StrategicMapEngine.getForProduct(product.id);
    const objectives = map.objectives || [];
    const draft = App.state.strategicObjectiveDraft;
    return `<section class="space-y-3">
      ${this._stepIntro('Objetivos Estratégicos', 'Quebre a visão em 2-4 objetivos. Cada objetivo agrupará OKRs.', 'flag')}
      <div class="flex justify-between items-center">
        <p class="text-xs text-slate-400">${objectives.length} objetivo(s) cadastrado(s)</p>
        ${!draft ? '<button onclick="Actions.startStrategicObjectiveDraft()" class="px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-black flex items-center gap-1.5" style="color:#fff!important;"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Novo objetivo</button>' : ''}
      </div>
      ${draft ? this._objectiveDraftCard(draft) : ''}
      <div class="space-y-3">
        ${objectives.length ? objectives.map(o => this._objectiveSummaryCard(o)).join('') : (!draft ? '<div class="rounded-3xl bg-white/[0.04] border border-dashed border-white/15 p-6 text-center text-slate-300"><i data-lucide="flag" class="w-7 h-7 mx-auto mb-2 text-indigo-300"></i><p class="text-sm">Nenhum objetivo ainda. Clique em <b>Novo objetivo</b>.</p></div>' : '')}
      </div>
      ${this._stepCta('Próximo passo: criar OKRs', objectives.length > 0)}
    </section>`;
  },

  _objectiveSummaryCard(obj) {
    return `<div class="rounded-2xl bg-white/[0.04] border border-white/10 p-3 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="font-black text-white">${Utils.escape(obj.label || 'Objetivo')}</p>
        <p class="text-[11px] text-slate-400 mt-0.5">${obj.owner ? `Dono: <b class="text-slate-200">${Utils.escape(obj.owner)}</b> · ` : ''}${obj.deadline ? `Prazo: <b class="text-slate-200">${Utils.escape(obj.deadline)}</b> · ` : ''}${(obj.okrs || []).length} OKR(s)</p>
      </div>
      <button onclick="Actions.removeStrategicObjective('${obj.id}')" title="Remover" class="px-2 py-1 rounded-lg bg-red-500/10 border border-red-400/30 text-red-300 text-[10px] font-black">×</button>
    </div>`;
  },

  _objectiveDraftCard(draft) {
    return `<div class="rounded-3xl bg-indigo-500/15 border border-indigo-400/30 p-4 space-y-3">
      <div class="flex items-center gap-2"><i data-lucide="flag" class="w-4 h-4 text-indigo-200"></i><p class="text-xs font-black text-indigo-200 uppercase tracking-wider">Novo objetivo</p></div>
      <input value="${Utils.escape(draft.label || '')}" oninput="Actions.updateStrategicObjectiveDraft('label', this.value)" placeholder="Ex: Aumentar aquisição" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-bold placeholder:text-slate-500" />
      <div class="grid grid-cols-2 gap-2">
        <input value="${Utils.escape(draft.owner || '')}" oninput="Actions.updateStrategicObjectiveDraft('owner', this.value)" placeholder="Dono (ex: Marketing)" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-semibold placeholder:text-slate-500" />
        <input type="date" value="${Utils.escape(draft.deadline || '')}" oninput="Actions.updateStrategicObjectiveDraft('deadline', this.value)" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-semibold" style="color-scheme:dark;" />
      </div>
      <div class="flex justify-end gap-2">
        <button onclick="Actions.cancelStrategicObjectiveDraft()" class="px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-white text-xs font-black">Cancelar</button>
        <button onclick="Actions.saveStrategicObjectiveDraft()" class="px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-black" style="color:#fff!important;">Adicionar</button>
      </div>
    </div>`;
  },

  // -------------------- STEP 3: OKRs --------------------
  _stepOkrs(product) {
    const map = StrategicMapEngine.getForProduct(product.id);
    const objectives = map.objectives || [];
    const totalOkrs = objectives.reduce((sum, o) => sum + (o.okrs?.length || 0), 0);
    if (!objectives.length) {
      return `<section class="space-y-3">
        ${this._stepIntro('OKRs', 'Crie pelo menos um objetivo primeiro.', 'target')}
        <div class="rounded-3xl bg-amber-500/10 border border-amber-400/30 p-5 text-amber-200">
          <p class="font-black mb-1">Volte um passo.</p>
          <p class="text-sm">Você precisa criar Objetivos antes de adicionar OKRs.</p>
          <button onclick="Actions.setStrategicZoom('objectives')" class="mt-3 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-black">← Voltar para Objetivos</button>
        </div>
      </section>`;
    }
    return `<section class="space-y-3">
      ${this._stepIntro('OKRs', 'Em cada objetivo, defina resultados-chave mensuráveis (números, prazo).', 'target')}
      <div class="space-y-3">
        ${objectives.map(o => this._okrsObjectiveCard(product, o)).join('')}
      </div>
      ${this._stepCta('Próximo passo: conectar à operação', totalOkrs > 0)}
    </section>`;
  },

  _okrsObjectiveCard(product, obj) {
    const okrs = obj.okrs || [];
    const draft = App.state.strategicOkrDraft;
    const isDraftHere = draft && draft.objectiveId === obj.id;
    return `<div class="rounded-3xl bg-white/[0.05] border border-white/10 p-4 space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="font-black text-white">${Utils.escape(obj.label)}</p>
          <p class="text-[11px] text-slate-400 mt-0.5">${okrs.length} OKR(s)</p>
        </div>
        ${!isDraftHere ? `<button onclick="Actions.startStrategicOkrDraft('${obj.id}')" class="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-[11px] font-black flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i> Novo OKR</button>` : ''}
      </div>
      ${isDraftHere ? this._okrDraftCard(draft, product, /* hideConnect */ true) : ''}
      <div class="space-y-2">
        ${okrs.length ? okrs.map(kr => this._okrSummaryCard(product, obj, kr)).join('') : (isDraftHere ? '' : '<p class="text-[11px] text-slate-500 italic">Sem OKRs neste objetivo ainda.</p>')}
      </div>
    </div>`;
  },

  _okrSummaryCard(product, obj, kr) {
    const progress = StrategicOkrEngine.progress(kr);
    const status = StrategicMapRenderer.okrStatus(progress);
    return `<div class="rounded-2xl bg-black/30 border border-white/10 p-3">
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="min-w-0">
          <p class="font-black text-white text-sm">${Utils.escape(kr.name)}</p>
          <p class="text-[11px] text-slate-400 mt-0.5">${Number(kr.current || 0)}/${Number(kr.target || 0)} ${Utils.escape(kr.metric)}${kr.deadline ? ` · até ${Utils.escape(kr.deadline)}` : ''}</p>
        </div>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-${status.color}-500/20 text-${status.color}-200 border border-${status.color}-400/30 whitespace-nowrap">${progress}%</span>
      </div>
      ${StrategicMapRenderer.progressBar(progress, status.color)}
      <div class="flex justify-end gap-1 mt-2">
        <button onclick="Actions.removeStrategicOkr('${obj.id}','${kr.id}')" class="px-2 py-1 rounded bg-red-500/10 border border-red-400/30 text-red-300 text-[10px] font-black">Remover</button>
      </div>
    </div>`;
  },

  _okrDraftCard(draft, product, hideConnect) {
    const actions = StrategicFlowBridge.actionsForProduct(product.id);
    return `<div class="rounded-2xl bg-emerald-500/10 border border-emerald-400/30 p-3 space-y-2">
      <div class="flex items-center gap-2"><i data-lucide="target" class="w-3.5 h-3.5 text-emerald-200"></i><p class="text-[10px] font-black text-emerald-200 uppercase tracking-wider">Novo OKR</p></div>
      <input value="${Utils.escape(draft.name || '')}" oninput="Actions.updateStrategicOkrDraft('name', this.value)" placeholder="Ex: Gerar 2.000 leads qualificados até julho" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-bold placeholder:text-slate-500" />
      <div class="grid grid-cols-3 gap-2">
        <select onchange="Actions.updateStrategicOkrDraft('metric', this.value)" class="w-full px-2 py-2 rounded-xl bg-slate-900 border border-white/15 text-white text-xs font-bold" style="color-scheme:dark;">
          ${['leads','converted','revenue'].map(m => `<option value="${m}" ${draft.metric === m ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
        <input type="number" min="0" value="${Number(draft.target || 0)}" oninput="Actions.updateStrategicOkrDraft('target', Number(this.value||0))" placeholder="Meta" class="w-full px-2 py-2 rounded-xl bg-slate-900 border border-white/15 text-white text-xs font-bold" />
        <input type="number" min="0" value="${Number(draft.current || 0)}" oninput="Actions.updateStrategicOkrDraft('current', Number(this.value||0))" placeholder="Atual" class="w-full px-2 py-2 rounded-xl bg-slate-900 border border-white/15 text-white text-xs font-bold" />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <input value="${Utils.escape(draft.owner || '')}" oninput="Actions.updateStrategicOkrDraft('owner', this.value)" placeholder="Dono" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white text-xs font-bold placeholder:text-slate-500" />
        <input type="date" value="${Utils.escape(draft.deadline || '')}" oninput="Actions.updateStrategicOkrDraft('deadline', this.value)" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white text-xs font-bold" style="color-scheme:dark;" />
      </div>
      ${!hideConnect && actions.length ? `<div>
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Conectar ações (opcional aqui — pode fazer no próximo passo)</p>
        <div class="flex flex-wrap gap-1.5 max-h-24 overflow-auto">${actions.map(a => {
          const selected = (draft.connectedActionIds || []).map(Number).includes(Number(a.id));
          return `<button onclick="Actions.toggleStrategicOkrDraftAction(${a.id})" class="px-2 py-1 rounded-lg text-[10px] font-black ${selected ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/40' : 'bg-white/5 text-slate-300 border border-white/15'}">${Utils.escape(a.name || 'Ação')}</button>`;
        }).join('')}</div>
      </div>` : ''}
      <div class="flex justify-end gap-2">
        <button onclick="Actions.cancelStrategicOkrDraft()" class="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-white text-[11px] font-black">Cancelar</button>
        <button onclick="Actions.saveStrategicOkrDraft()" class="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black" style="color:#fff!important;">Adicionar OKR</button>
      </div>
    </div>`;
  },

  // -------------------- STEP 4: CONECTAR OPERAÇÃO --------------------
  _stepOperations(product) {
    const map = StrategicMapEngine.getForProduct(product.id);
    const objectives = map.objectives || [];
    const okrs = objectives.flatMap(o => (o.okrs || []).map(kr => ({ obj: o, kr })));
    const connected = okrs.filter(({ kr }) => (kr.connectedActionIds || []).length > 0);
    const actions = StrategicFlowBridge.actionsForProduct(product.id);
    if (!okrs.length) {
      return `<section class="space-y-3">
        ${this._stepIntro('Conectar à Operação', 'Crie OKRs antes de conectar.', 'plug')}
        <div class="rounded-3xl bg-amber-500/10 border border-amber-400/30 p-5 text-amber-200">
          <p class="font-black mb-1">Faltam OKRs.</p>
          <p class="text-sm">Volte para a etapa de OKRs e crie pelo menos um.</p>
          <button onclick="Actions.setStrategicZoom('okrs')" class="mt-3 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-black">← Voltar para OKRs</button>
        </div>
      </section>`;
    }
    const hasCampaigns = (App.state.campaigns || []).some(c => Number(c.productId) === Number(product.id));
    if (!actions.length) {
      return `<section class="space-y-3">
        ${this._stepIntro('Conectar à Operação', 'Conecte cada OKR às ações operacionais que entregam o resultado.', 'plug')}
        <div class="rounded-3xl bg-amber-500/10 border border-amber-400/30 p-5 text-amber-200">
          <p class="font-black mb-1">${hasCampaigns ? 'Nenhuma ação cadastrada ainda neste produto.' : 'Nenhuma campanha cadastrada para este produto.'}</p>
          <p class="text-sm">${hasCampaigns ? 'Crie ações rapidamente em cada OKR abaixo, ou abra a aba Ações de Campanha para o cadastro completo.' : 'Crie uma campanha primeiro — depois aqui você pode criar ações rápidas direto pelos OKRs.'}</p>
          ${!hasCampaigns ? '<button onclick="Actions.closeStrategicMap(); App.setTab(\'campaigns\');" class="mt-3 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-black">Ir para Campanhas →</button>' : ''}
        </div>
        ${hasCampaigns ? `<div class="space-y-3">${okrs.map(({ obj, kr }) => this._operationsOkrCard(product, obj, kr, [])).join('')}</div>` : ''}
        ${this._stepCta('Próximo passo: executar via Djow', connected.length > 0)}
      </section>`;
    }
    return `<section class="space-y-3">
      ${this._stepIntro('Conectar à Operação', 'Para cada OKR, marque as ações que vão entregá-lo. Faltou alguma? Crie rápido pelo botão verde.', 'plug')}
      <div class="space-y-3">
        ${okrs.map(({ obj, kr }) => this._operationsOkrCard(product, obj, kr, actions)).join('')}
      </div>
      ${this._stepCta('Próximo passo: executar via Djow', connected.length > 0)}
    </section>`;
  },

  _operationsOkrCard(product, obj, kr, actions) {
    const linked = new Set((kr.connectedActionIds || []).map(Number));
    const hasDraftConnected = (kr.connectedActionIds || []).some(id => {
      const a = (App.state.actions || []).find(a => Number(a.id) === Number(id));
      return a?.isDraft;
    });
    return `<div class="rounded-3xl bg-white/[0.05] border border-white/10 p-4 space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">${Utils.escape(obj.label)}</p>
          <p class="font-black text-white">${Utils.escape(kr.name)}</p>
          <p class="text-[11px] text-slate-400 mt-0.5">Meta ${Number(kr.target || 0)} ${Utils.escape(kr.metric)} · ${linked.size} ação(ões) conectada(s)</p>
        </div>
        <button onclick="Actions.openQuickActionModal(${product.id}, '${obj.id}', '${kr.id}')" class="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[11px] font-black flex items-center gap-1 whitespace-nowrap" title="Criar e conectar uma ação ao OKR (modo rápido)"><i data-lucide="plus" class="w-3 h-3"></i> Criar ação</button>
      </div>
      <div>
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Ações disponíveis · clique para conectar</p>
        ${actions.length ? `<div class="flex flex-wrap gap-1.5">${actions.map(a => {
          const on = linked.has(Number(a.id));
          const draft = Boolean(a.isDraft);
          return `<button onclick="Actions.toggleStrategicOkrAction('${obj.id}','${kr.id}', ${a.id})" class="px-2.5 py-1.5 rounded-lg text-[11px] font-black transition flex items-center gap-1 ${on ? 'bg-emerald-500/30 text-emerald-100 border border-emerald-400/50' : 'bg-white/5 text-slate-300 border border-white/15 hover:bg-white/10'}">${on ? '✓ ' : ''}${Utils.escape(a.name || 'Ação')}${draft ? ' <span class="text-[9px] px-1 rounded bg-amber-400/30 text-amber-100 border border-amber-300/40">rascunho</span>' : ''}</button>`;
        }).join('')}</div>` : '<p class="text-[11px] text-slate-500 italic">Nenhuma ação ainda. Use <b class="text-emerald-300">Criar ação</b> acima para cadastrar a primeira.</p>'}
      </div>
      ${hasDraftConnected ? `<div class="rounded-xl bg-amber-500/15 border border-amber-400/30 p-2.5 text-[11px] text-amber-100 flex items-start gap-2">
        <i data-lucide="alert-triangle" class="w-3.5 h-3.5 mt-0.5 shrink-0"></i>
        <p>Há ações em <b>rascunho</b> conectadas a este OKR. <button onclick="Actions.closeStrategicMap(); App.setTab('actions');" class="underline font-black">Complete em Ações de Campanha</button> para a leitura ficar precisa.</p>
      </div>` : ''}
    </div>`;
  },

  // -------------------- STEP 5: EXECUTAR --------------------
  _stepExecution(product) {
    const map = StrategicMapEngine.getForProduct(product.id);
    const objectives = map.objectives || [];
    const okrs = objectives.flatMap(o => (o.okrs || []).map(kr => ({ obj: o, kr })));
    const connectedOkrs = okrs.filter(({ kr }) => (kr.connectedActionIds || []).length > 0);
    if (!connectedOkrs.length) {
      return `<section class="space-y-3">
        ${this._stepIntro('Executar via Djow', 'Conecte OKRs a ações antes de executar.', 'send')}
        <div class="rounded-3xl bg-amber-500/10 border border-amber-400/30 p-5 text-amber-200">
          <p class="font-black mb-1">Nenhum OKR conectado.</p>
          <p class="text-sm">Volte para Conectar Operação e plugue ao menos um OKR a uma ação.</p>
          <button onclick="Actions.setStrategicZoom('operations')" class="mt-3 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-black">← Voltar para Conectar Operação</button>
        </div>
      </section>`;
    }
    return `<section class="space-y-3">
      ${this._stepIntro('Executar via Djow', 'Para cada OKR conectado, dispare uma tarefa real no provider operacional configurado.', 'send')}
      ${this._executionProviderBanner()}
      <div class="space-y-3">
        ${connectedOkrs.map(({ obj, kr }) => this._executionOkrCard(product, obj, kr)).join('')}
      </div>
    </section>`;
  },

  _executionProviderBanner() {
    const providerId = window.ExecutionProviderRegistry?.getDefaultProviderId?.() || 'manual';
    const provider = window.ExecutionProviderRegistry?.byId(providerId);
    const cfg = window.ExecutionProviderRegistry?.getProviderConfig(providerId) || {};
    const isManual = providerId === 'manual';
    const isConnected = isManual || Boolean(cfg.connected);
    const tone = isConnected ? 'from-emerald-500/15 to-emerald-400/5 border-emerald-400/30 text-emerald-100' : 'from-amber-500/15 to-amber-400/5 border-amber-400/30 text-amber-100';
    return `<div class="rounded-3xl bg-gradient-to-br ${tone} border p-4 flex items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl bg-white/10 grid place-items-center"><i data-lucide="${provider?.icon || 'edit'}" class="w-5 h-5"></i></div>
        <div>
          <p class="text-[10px] font-black uppercase tracking-wider opacity-80">Provider operacional ativo</p>
          <p class="font-black text-base">${Utils.escape(provider?.label || 'Manual')}</p>
          <p class="text-[11px] opacity-80 mt-0.5">${isManual ? 'Tarefas ficam no LeadJourney. Configure ClickUp/Trello para sair para sua squad.' : (isConnected ? 'Tarefas criadas aqui serão enviadas para sua squad automaticamente.' : 'Credenciais não testadas. Configure antes de disparar.')}</p>
        </div>
      </div>
      ${isManual || !isConnected ? '<button onclick="Actions.closeStrategicMap(); Actions.openSettingsModal(); Actions.setSettingsSection(\'execution\');" class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-black whitespace-nowrap">Configurar</button>' : ''}
    </div>`;
  },

  _executionOkrCard(product, obj, kr) {
    const actions = StrategicFlowBridge.actionsForOkr(product.id, kr);
    const tasks = (window.ExecutionTaskStore?.all() || []).filter(t => actions.some(a => Number(a.id) === Number(t.linked_action_id)));
    const executed = tasks.filter(t => t.status === 'completed').length;
    const pending = tasks.length - executed;
    const progress = StrategicOkrEngine.progress(kr);
    const status = StrategicMapRenderer.okrStatus(progress);
    return `<div class="rounded-3xl bg-white/[0.05] border border-white/10 p-4">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="min-w-0">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">${Utils.escape(obj.label)}</p>
          <p class="font-black text-white">${Utils.escape(kr.name)}</p>
          <p class="text-[11px] text-slate-400 mt-0.5">${Number(kr.current || 0)}/${Number(kr.target || 0)} ${Utils.escape(kr.metric)} · ${actions.length} ação(ões) conectada(s) · ${tasks.length} tarefa(s) (${executed} concluída(s))</p>
        </div>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-${status.color}-500/20 text-${status.color}-200 border border-${status.color}-400/30 whitespace-nowrap">${progress}%</span>
      </div>
      ${StrategicMapRenderer.progressBar(progress, status.color)}
      <div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/10">
        ${actions.map(a => `<button onclick="Actions.createTaskFromOkr(${product.id}, '${obj.id}', '${kr.id}', ${a.id})" class="px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-[11px] font-black flex items-center gap-1.5" style="color:#fff!important;" title="Abrir Djow já preenchido para criar tarefa nesta ação"><i data-lucide="send" class="w-3 h-3"></i> Criar tarefa via Djow · ${Utils.escape(a.name)}</button>`).join('')}
        <button onclick="Actions.syncStrategicOkrSingle('${obj.id}','${kr.id}')" class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-[11px] font-black flex items-center gap-1.5"><i data-lucide="refresh-cw" class="w-3 h-3"></i> Atualizar leitura</button>
        ${tasks.length ? `<button onclick="Actions.closeStrategicMap(); Actions.openTasksModal(${actions[0]?.id || 0});" class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-[11px] font-black">Ver ${tasks.length} tarefa(s)</button>` : ''}
      </div>
    </div>`;
  },

  // -------------------- COMMON --------------------
  _stepIntro(title, hint, icon) {
    return `<div>
      <div class="flex items-center gap-2 mb-1"><i data-lucide="${icon}" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Etapa: ${title}</p></div>
      <p class="text-xs text-slate-400">${Utils.escape(hint)}</p>
    </div>`;
  },

  _djowSide(product, stepId) {
    const messages = DjowStrategicAssistant.history(product.id);
    const draft = App.state.strategicDjowDraft || '';
    const sending = Boolean(App.state.strategicDjowSending);
    return `<aside class="rounded-3xl bg-white/[0.04] border border-white/10 p-4 flex flex-col" style="max-height:74vh;min-height:520px;">
      <div class="flex items-center gap-2 mb-3"><i data-lucide="sparkles" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Djow — Estratégia</p></div>
      ${this._djowStepTip(stepId)}
      <div class="flex-1 overflow-auto space-y-2 pr-1 mt-3">
        ${messages.length ? messages.map(m => this._chatBubble(m)).join('') : this._djowStepHints(stepId)}
      </div>
      <div class="mt-3 border-t border-white/10 pt-3">
        <textarea ${sending ? 'disabled' : ''} oninput="Actions.updateStrategicDjowDraft(this.value)" placeholder="Pergunte qualquer coisa sobre esta etapa..." class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-semibold min-h-[64px] placeholder:text-slate-500" style="color-scheme:dark;">${Utils.escape(draft)}</textarea>
        <button ${sending ? 'disabled' : ''} onclick="Actions.sendStrategicDjow()" class="mt-2 w-full px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-600 text-white text-xs font-black flex items-center justify-center gap-2" style="color:#fff!important;">${sending ? '<span class="w-3 h-3 rounded-full border-2 border-current border-r-transparent animate-spin"></span> Pensando…' : '<i data-lucide="send" class="w-3.5 h-3.5"></i> Perguntar ao Djow'}</button>
      </div>
    </aside>`;
  },

  _djowStepTip(stepId) {
    const tipMap = {
      vision:     'Comece com uma frase curta e ambiciosa. Foque no "para quê", não no "como".',
      objectives: 'Bons objetivos têm verbo de ação: Aumentar, Reduzir, Melhorar, Capturar.',
      okrs:       'OKR = resultado mensurável. Exemplo: "2.000 leads qualificados até julho".',
      operations: 'Conecte cada OKR à ação operacional real. Pode ser mais de uma.',
      execution:  'Clique em "Criar tarefa via Djow" — a tarefa vai direto para o ClickUp/provider configurado.'
    };
    const tip = tipMap[stepId] || '';
    if (!tip) return '';
    return `<div class="rounded-xl bg-indigo-500/15 border border-indigo-400/30 p-2.5 text-[11px] text-indigo-100"><b class="text-indigo-200">Dica:</b> ${Utils.escape(tip)}</div>`;
  },

  _djowStepHints(stepId) {
    const hintsByStep = {
      vision:     ['Como criar uma visão poderosa?', 'Exemplos de visão de produto', 'Visão muito longa, como encurtar?'],
      objectives: ['Sugestões de objetivos para meu produto', 'Quantos objetivos é o ideal?', 'Diferença entre objetivo e OKR'],
      okrs:       ['Exemplo de OKR para aquisição', 'Como escolher a métrica certa?', 'Meta ambiciosa vs realista'],
      operations: ['Posso conectar uma ação a múltiplos OKRs?', 'Como saber se uma ação serve este OKR?', 'Não tenho ações ainda'],
      execution:  ['Para onde a tarefa vai?', 'Como configurar ClickUp?', 'Tarefa criada não aparece no provider']
    };
    const hints = hintsByStep[stepId] || hintsByStep.vision;
    return `<div class="space-y-2">
      <p class="text-xs text-slate-400">Sugestões para esta etapa:</p>
      ${hints.map(h => `<button onclick="Actions.askStrategicDjow('${Utils.escape(h).replace(/'/g, '&#39;')}')" class="w-full text-left px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-200 text-xs">${Utils.escape(h)}</button>`).join('')}
    </div>`;
  },

  _chatBubble(m) {
    if (m.role === 'user') {
      return `<div class="flex justify-end"><div class="max-w-[85%] px-3 py-2 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-50 text-xs whitespace-pre-wrap">${Utils.escape(m.text)}</div></div>`;
    }
    return `<div class="flex justify-start"><div class="max-w-[88%] px-3 py-2 rounded-2xl bg-white/10 border border-white/15 text-slate-100 text-xs whitespace-pre-wrap">${Utils.escape(m.text)}</div></div>`;
  }
};
