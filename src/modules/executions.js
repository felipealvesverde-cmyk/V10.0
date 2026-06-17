// V38.1.63 — ExecutionsModule (Leonardo)
//
// Nova tela do menu lateral, abaixo de "Ações". Espelha a estrutura
// arquitetural das telas Produtos / Campanhas / Ações:
//
//   ┌───────────────────────────────────────┐
//   │ HEADER ESCURO + KPIs (Total / Status) │
//   ├───────────────────────────────────────┤
//   │ FLOW BREADCRUMB (Prod>Camp>Aç>Exec)   │
//   ├───────────────────────────────────────┤
//   │ [Bloco esq: criar]  [Bloco dir: lista]│
//   └───────────────────────────────────────┘
//
// "Execução" aqui = task/tarefa do ExecutionTaskStore (V16.3+). Esta tela
// promove execuções de "modal escondido dentro de uma ação" pra cidadão
// de primeira classe — listagem cross-action da campanha selecionada,
// criação direta e gestão centralizada.
//
// Esqueleto V38.1.63: leitura + criação básica. Edição/ações em lote /
// filtros avançados ficam pra ondas seguintes.

var ExecutionsModule = {
  render() {
    const selectedCampaign = App.getSelectedCampaign();
    if (!selectedCampaign) return this.emptyState();

    const campaignActions = (App.state.actions || []).filter(a => Number(a.campaignId) === Number(selectedCampaign.id));
    const product = (App.state.products || []).find(p => Number(p.id) === Number(selectedCampaign.productId));
    const executions = this._collectExecutions(campaignActions);

    return `<div class="space-y-4">
      ${this.executionLayer(selectedCampaign, product, executions)}
      ${window.FlowBreadcrumb ? FlowBreadcrumb.render('executions') : ''}
      <div class="grid lg:grid-cols-3 gap-4">
        <div class="lg:col-span-1 bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <h2 class="text-xl font-black mb-1">Criar execução</h2>
          <p class="text-sm text-slate-500 mb-4">Adicione uma execução a uma das ações desta campanha.</p>
          ${this._createPanel(campaignActions)}
        </div>
        <div class="lg:col-span-2 bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <h2 class="text-xl font-black mb-3">Execuções desta campanha</h2>
          ${executions.length ? this._executionsList(executions, campaignActions) : this._emptyExecutionsList()}
        </div>
      </div>
      ${window.CampaignFlowModal ? CampaignFlowModal.render() : ''}
      ${window.TasksModal ? TasksModal.render() : ''}
    </div>`;
  },

  emptyState() {
    return `<div class="space-y-4">
      ${this.executionLayer(null, null, [])}
      ${window.FlowBreadcrumb ? FlowBreadcrumb.render('executions') : ''}
      <div class="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 text-center">
        <h2 class="text-2xl font-black mb-2">Nenhuma campanha selecionada</h2>
        <p class="text-sm text-slate-500 mb-5">Pra criar e listar execuções, selecione uma campanha primeiro.</p>
        <div class="flex flex-col md:flex-row gap-2 justify-center">
          <button onclick="App.setTab('products')" class="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-900 font-black">Ir para Produtos</button>
          <button onclick="App.setTab('campaigns')" class="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black lj-dark-button" style="color:#fff!important;">Selecionar Campanha</button>
        </div>
      </div>
    </div>`;
  },

  executionLayer(selectedCampaign, product, executions) {
    const total = executions.length;
    const byStatus = { toExecute: 0, executing: 0, executed: 0, blocked: 0 };
    for (const t of executions) {
      if (t.status === 'completed') byStatus.executed++;
      else if (t.status === 'in_progress') byStatus.executing++;
      else if (t.status === 'blocked' || t.status === 'failed') byStatus.blocked++;
      else byStatus.toExecute++;
    }
    return `<div class="bg-slate-950 text-white rounded-[2rem] p-5 shadow-sm overflow-hidden relative">
      <div class="absolute inset-0 opacity-60" style="background: radial-gradient(circle at 18% 10%, rgba(16,185,129,.18), transparent 28%), radial-gradient(circle at 82% 20%, rgba(59,130,246,.14), transparent 30%);"></div>
      <div class="relative z-10 grid lg:grid-cols-[1.2fr_1fr] gap-4 items-center">
        <div>
          <div class="flex items-center gap-2 mb-3"><i data-lucide="play-circle" class="w-4 h-4"></i><p class="text-xs font-black text-slate-300 uppercase tracking-wider">Execution Layer · Tarefas</p></div>
          <p class="text-base text-slate-300 max-w-3xl leading-relaxed">A execução é a tarefa concreta que aterra a ação: status em tempo real, criação manual ou via Djow, e a evidência do que de fato saiu da estratégia pro mundo.</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          ${this._darkMetric('Execuções', total, 'play-circle')}
          ${this._darkMetricByStatus(byStatus)}
          ${this._darkMetric('Pendentes', byStatus.toExecute, 'clock')}
          ${this._darkMetric('Concluídas', byStatus.executed, 'check-circle-2')}
        </div>
      </div>
    </div>`;
  },

  _darkMetric(label, value, icon) {
    return `<div class="bg-white/10 border border-white/10 rounded-2xl p-4"><div class="flex items-center justify-between"><p class="text-xs font-black text-slate-300">${label}</p><i data-lucide="${icon}" class="w-4 h-4 text-slate-300"></i></div><div class="text-3xl font-black mt-2">${value}</div></div>`;
  },

  _darkMetricByStatus(byStatus) {
    const col = (label, value, color) => `<div class="text-center"><p class="text-[9px] font-black tracking-widest uppercase text-${color}-300 leading-none">${label}</p><p class="text-xl font-black text-white leading-none mt-1">${value}</p></div>`;
    return `<div class="bg-white/10 border border-white/10 rounded-2xl p-4"><div class="flex items-center justify-between mb-2"><p class="text-xs font-black text-slate-300">Por status</p><i data-lucide="layers" class="w-4 h-4 text-slate-300"></i></div><div class="grid grid-cols-3 gap-2 items-end mt-1">${col('PEND', byStatus.toExecute, 'amber')}${col('ANDA', byStatus.executing, 'sky')}${col('OK', byStatus.executed, 'emerald')}</div></div>`;
  },

  _collectExecutions(actions) {
    if (!window.ExecutionTaskStore) return [];
    const out = [];
    for (const a of actions) out.push(...ExecutionTaskStore.byAction(a.id));
    return out;
  },

  _createPanel(actions) {
    if (!actions.length) {
      return `<div class="rounded-2xl border border-dashed border-slate-300 p-4 text-center">
        <p class="text-sm text-slate-500 mb-3">Esta campanha ainda não tem nenhuma ação. Crie uma ação primeiro pra plugar execuções nela.</p>
        <button onclick="App.setTab('actions')" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black" style="color:#fff!important;">Ir para Ações</button>
      </div>`;
    }
    const draft = App.state.executionDraft || { actionId: actions[0]?.id, title: '' };
    return `<div class="space-y-3">
      <div>
        <label class="text-xs font-black text-slate-500">Ação</label>
        <select onchange="Actions.updateExecutionDraft('actionId', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold">
          ${actions.map(a => `<option value="${a.id}" ${Number(draft.actionId) === Number(a.id) ? 'selected' : ''}>${Utils.escape(a.name)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="text-xs font-black text-slate-500">Título da execução</label>
        <input id="execTitleInput" value="${Utils.escape(draft.title || '')}" oninput="Actions.updateExecutionDraft('title', this.value)" placeholder="Ex: Lançar criativo carrossel A/B" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" />
      </div>
      <button onclick="Actions.createExecutionFromDraft()" class="w-full px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black flex items-center justify-center gap-2 lj-dark-button" style="color:#fff!important;">
        <i data-lucide="plus" class="w-4 h-4"></i> Adicionar execução
      </button>
      <div class="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3 flex items-start gap-2.5">
        <span class="shrink-0 w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 grid place-items-center">
          <i data-lucide="sparkles" class="w-3.5 h-3.5"></i>
        </span>
        <div class="min-w-0">
          <p class="text-xs font-black text-slate-900">Criar com Djow</p>
          <p class="text-[11px] text-slate-500 mt-0.5 leading-tight">Use o Djow pra gerar várias execuções com contexto da ação.</p>
          <button onclick="Actions.openDjowAIModal({ actionId: ${draft.actionId || actions[0]?.id || 'null'}, seedPrompt: 'Crie execuções para esta ação: ' })" class="mt-2 text-[11px] font-black text-indigo-700 hover:text-indigo-900 flex items-center gap-1">
            <i data-lucide="arrow-right" class="w-3 h-3"></i> Abrir Djow
          </button>
        </div>
      </div>
    </div>`;
  },

  _executionsList(executions, actions) {
    const actionsById = new Map(actions.map(a => [Number(a.id), a]));
    return `<div class="space-y-3">${executions.map(t => this._executionCard(t, actionsById.get(Number(t.linked_action_id)))).join('')}</div>`;
  },

  _executionCard(task, action) {
    const statusDot = task.status === 'completed' ? 'bg-emerald-500' :
                      task.status === 'in_progress' ? 'bg-sky-500' :
                      task.status === 'blocked' || task.status === 'failed' ? 'bg-rose-500' :
                      'bg-amber-500';
    const statusLabel = task.status === 'completed' ? 'CONCLUÍDA' :
                        task.status === 'in_progress' ? 'EM ANDAMENTO' :
                        task.status === 'blocked' ? 'BLOQUEADA' :
                        task.status === 'failed' ? 'FALHA' :
                        'PENDENTE';
    return `<div class="lj-entity-card relative p-4 rounded-2xl bg-slate-50 border border-slate-100 border-l-4 border-l-emerald-500">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-1">
            <span class="w-2 h-2 rounded-full ${statusDot}"></span>
            <p class="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Execução · ${statusLabel}</p>
          </div>
          <h3 class="font-black text-sm text-slate-900">${Utils.escape(task.title)}</h3>
          <p class="text-[11px] text-slate-500 mt-1">Ação: <b>${Utils.escape(action?.name || 'sem vínculo')}</b>${task.assignee ? ` · ${Utils.escape(task.assignee)}` : ''}${task.due_date ? ` · vence ${Utils.escape(task.due_date)}` : ''}</p>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          ${task.status !== 'completed' ? `<button onclick="Actions.markExecutionDone('${task.task_id}')" title="Marcar como concluída" class="w-8 h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white grid place-items-center" style="color:#fff!important;"><i data-lucide="check" class="w-4 h-4"></i></button>` : ''}
          <button onclick="Actions.deleteExecution('${task.task_id}')" title="Remover" class="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:border-rose-200 grid place-items-center"><i data-lucide="trash-2" class="w-4 h-4"></i></button>
        </div>
      </div>
    </div>`;
  },

  _emptyExecutionsList() {
    return `<div class="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
      <i data-lucide="play-circle" class="w-10 h-10 text-slate-300 mx-auto mb-3"></i>
      <p class="text-sm font-black text-slate-700 mb-1">Nenhuma execução criada ainda</p>
      <p class="text-xs text-slate-500">Adicione uma execução pelo painel ao lado ou crie via Djow.</p>
    </div>`;
  }
};

window.ExecutionsModule = ExecutionsModule;
