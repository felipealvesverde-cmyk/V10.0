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
    // V38.1.68 — Header dark continua refletindo a campanha selecionada
    // globalmente (selectedCampaignId). A lista direita usa filtros próprios
    // (executionListFilter) e é independente do form.
    const headerExecutions = this._collectExecutions(campaignActions);

    return `<div class="space-y-4">
      ${this.executionLayer(selectedCampaign, product, headerExecutions)}
      ${window.FlowBreadcrumb ? FlowBreadcrumb.render('executions') : ''}
      <div class="grid lg:grid-cols-3 gap-4">
        <div class="lg:col-span-1 bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <h2 class="text-xl font-black mb-1">Criar execução</h2>
          <p class="text-sm text-slate-500 mb-4">Escolha a campanha, depois a ação, depois adicione a execução.</p>
          ${this._createPanel(campaignActions)}
        </div>
        <div class="lg:col-span-2 bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <div class="flex items-start justify-between gap-3 mb-3">
            <h2 class="text-xl font-black">Execuções</h2>
          </div>
          ${this._filterControls()}
          ${this._listSection()}
        </div>
      </div>
      ${window.CampaignFlowModal ? CampaignFlowModal.render() : ''}
      ${window.TasksModal ? TasksModal.render() : ''}
      ${App.state.taskCreationModal?.open && window.StrategicMapModal?._taskCreationModalRender ? StrategicMapModal._taskCreationModalRender() : ''}
      ${App.state.djowTaskChat?.open && window.StrategicMapModal?._djowTaskChatRender ? StrategicMapModal._djowTaskChatRender() : ''}
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
    const campaigns = App.state.campaigns || [];
    const currentCampaignId = App.state.selectedCampaignId;
    const draft = App.state.executionDraft || { actionId: actions[0]?.id, title: '' };
    return `<div class="space-y-3">
      <div>
        <label class="text-xs font-black text-slate-500">Campanha</label>
        <select onchange="Actions.selectCampaignFromActions(Number(this.value))" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold">
          ${campaigns.length === 0 ? '<option value="">— nenhuma campanha cadastrada —</option>' : ''}
          ${campaigns.map(c => `<option value="${c.id}" ${Number(currentCampaignId) === Number(c.id) ? 'selected' : ''}>${Utils.escape(c.name)}</option>`).join('')}
        </select>
      </div>
      ${!actions.length ? `<div class="rounded-2xl border border-dashed border-slate-300 p-4 text-center">
        <p class="text-sm text-slate-500 mb-3">Esta campanha ainda não tem nenhuma ação. Crie uma ação primeiro pra plugar execuções nela.</p>
        <button onclick="App.setTab('actions')" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black" style="color:#fff!important;">Ir para Ações</button>
      </div>` : `
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
      <button onclick="Actions.openExecutionTaskFromTab()" class="w-full px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black flex items-center justify-center gap-2 lj-dark-button" style="color:#fff!important;">
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
      </div>`}
    </div>`;
  },

  // V38.1.68 — Filtros da lista de execuções (Campanha + Ação cascateados).
  // Independente do form de criação: cliente pode estar criando na campanha A
  // e ver execuções da campanha B sem interferência.
  _filterControls() {
    const filter = App.state.executionListFilter || { campaignId: null, actionId: null };
    const campaigns = App.state.campaigns || [];
    const allActions = App.state.actions || [];
    const filteredActions = filter.campaignId
      ? allActions.filter(a => Number(a.campaignId) === Number(filter.campaignId))
      : allActions;
    return `<div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4 rounded-2xl bg-slate-50 border border-slate-100 p-3">
      <div>
        <label class="text-[10px] font-black text-slate-500 uppercase tracking-wider">Filtrar por campanha</label>
        <select onchange="Actions.setExecutionListFilter('campaignId', this.value)" class="w-full mt-1 px-3 py-2 rounded-xl bg-white border border-slate-200 font-semibold text-sm">
          <option value="" ${filter.campaignId == null ? 'selected' : ''}>Todas as campanhas</option>
          ${campaigns.map(c => `<option value="${c.id}" ${Number(filter.campaignId) === Number(c.id) ? 'selected' : ''}>${Utils.escape(c.name)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="text-[10px] font-black text-slate-500 uppercase tracking-wider">Filtrar por ação</label>
        <select onchange="Actions.setExecutionListFilter('actionId', this.value)" class="w-full mt-1 px-3 py-2 rounded-xl bg-white border border-slate-200 font-semibold text-sm" ${filteredActions.length === 0 ? 'disabled' : ''}>
          <option value="" ${filter.actionId == null ? 'selected' : ''}>Todas as ações${filter.campaignId ? ' desta campanha' : ''}</option>
          ${filteredActions.map(a => `<option value="${a.id}" ${Number(filter.actionId) === Number(a.id) ? 'selected' : ''}>${Utils.escape(a.name)}</option>`).join('')}
        </select>
      </div>
    </div>`;
  },

  // V38.1.68 — Aplica o filtro e renderiza a lista (ou vazio).
  _listSection() {
    const filter = App.state.executionListFilter || { campaignId: null, actionId: null };
    const allActions = App.state.actions || [];
    let scopedActions = allActions;
    if (filter.campaignId) scopedActions = scopedActions.filter(a => Number(a.campaignId) === Number(filter.campaignId));
    if (filter.actionId) scopedActions = scopedActions.filter(a => Number(a.id) === Number(filter.actionId));
    const executions = this._collectExecutions(scopedActions);
    if (!executions.length) return this._emptyExecutionsList(filter);
    return this._executionsList(executions, scopedActions);
  },

  _executionsList(executions, actions) {
    const actionsById = new Map(actions.map(a => [Number(a.id), a]));
    return `<div class="space-y-3">${executions.map(t => this._executionCard(t, actionsById.get(Number(t.linked_action_id)))).join('')}</div>`;
  },

  // V38.1.71 — Refinamento do card:
  //   1. Mini-cards encolheram 50% verticalmente (py-3 → py-1.5, text-xl → base).
  //   2. Engrenagem (Configurar) no canto superior direito chama
  //      openExecutionEditModal — reusa o modal de edição de tarefa do Mapa.
  //   3. Badge fica AO LADO da engrenagem (esquerda dela), não mais embaixo do título.
  //   4. Lixeira saiu do inline — agora vive dentro do modal de edição
  //      (footer rose "Excluir execução" em V38.1.71 do strategicMapModal).
  _executionCard(task, action) {
    const campaign = action ? (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId)) : null;
    const productId = campaign?.productId;
    const completed = task.status === 'completed';

    const badge = (window.StrategicMapModal && typeof StrategicMapModal._taskStatusBadge === 'function')
      ? StrategicMapModal._taskStatusBadge(task)
      : { label: completed ? 'Concluída' : 'Pendente', icon: completed ? 'check-circle-2' : 'circle', useInline: false, styleAttr: '', bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-700' };

    const created = task.created_at ? new Date(task.created_at) : null;
    const completedAt = task.completed_at ? new Date(task.completed_at) : null;
    const endRef = completedAt || new Date();
    const daysOpen = created ? Math.max(0, Math.floor((endRef - created) / 86400000)) : null;
    const closingDate = completedAt
      ? this._formatDate(completedAt) + ' · concluída'
      : (task.due_date ? this._formatDate(new Date(task.due_date)) + ' · prevista' : '— sem data');
    const owner = (task.assignee && String(task.assignee).trim()) || '— sem responsável';

    return `<div class="lj-entity-card relative p-4 rounded-2xl bg-slate-50 border border-slate-100 border-l-4 border-l-emerald-500">
      <div class="absolute top-3 right-3 flex items-center gap-2 z-10">
        <span class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${badge.bg} ${badge.border} ${badge.text}" ${badge.useInline ? `style="${badge.styleAttr}"` : ''}>
          <i data-lucide="${badge.icon}" class="w-3 h-3"></i>
          ${Utils.escape(String(badge.label).toUpperCase())}
        </span>
        <button onclick="event.stopPropagation(); Actions.openExecutionEditModal('${task.task_id}')" title="Editar execução" aria-label="Editar execução" class="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 grid place-items-center shadow-sm"><i data-lucide="settings" class="w-4 h-4"></i></button>
      </div>

      <div class="min-w-0 pr-44 mb-3">
        <p class="text-[10px] font-black uppercase tracking-widest mb-1" style="color: var(--lj-action);">Execução</p>
        <h3 class="font-black text-sm text-slate-900">${Utils.escape(task.title)}</h3>
        <p class="text-[11px] text-slate-500 mt-1">Ação: <b>${Utils.escape(action?.name || 'sem vínculo')}</b></p>
      </div>

      <div class="grid grid-cols-3 gap-2 text-center mb-3">
        <div class="bg-white rounded-2xl border border-slate-200 px-3 py-1.5" style="border-left: 4px solid var(--lj-action);">
          <div class="text-[9px] font-black uppercase tracking-widest" style="color: var(--lj-action);">Dias em aberto</div>
          <div class="font-black text-base text-slate-900 mt-0.5 leading-tight">${daysOpen != null ? daysOpen : '—'}</div>
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 px-3 py-1.5" style="border-left: 4px solid var(--lj-action);">
          <div class="text-[9px] font-black uppercase tracking-widest" style="color: var(--lj-action);">Fechamento</div>
          <div class="font-black text-[11px] text-slate-900 mt-0.5 leading-tight">${Utils.escape(closingDate)}</div>
        </div>
        <div class="bg-white rounded-2xl border border-slate-200 px-3 py-1.5" style="border-left: 4px solid var(--lj-action);">
          <div class="text-[9px] font-black uppercase tracking-widest" style="color: var(--lj-action);">Responsável</div>
          <div class="font-black text-[11px] text-slate-900 mt-0.5 leading-tight truncate">${Utils.escape(owner)}</div>
        </div>
      </div>

      <div class="flex items-center justify-between gap-2 flex-wrap">
        ${(action && productId) ? `<button onclick="Actions.openActionOnMap(${productId}, ${action.id})" class="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-700 text-[10px] font-black hover:bg-emerald-50 flex items-center gap-1.5">
          <i data-lucide="map" class="w-3 h-3"></i> Ver no Mapa →
        </button>` : '<span></span>'}
        ${completed
          ? `<button onclick="Actions.reopenExecution('${task.task_id}')" title="Reabrir execução" class="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-amber-600 hover:border-amber-300 grid place-items-center"><i data-lucide="rotate-ccw" class="w-4 h-4"></i></button>`
          : `<button onclick="Actions.markExecutionDone('${task.task_id}')" title="Marcar como concluída" class="w-8 h-8 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white grid place-items-center" style="color:#fff!important;"><i data-lucide="check" class="w-4 h-4"></i></button>`
        }
      </div>
    </div>`;
  },

  _formatDate(d) {
    if (!d || isNaN(d.getTime())) return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  },

  _emptyExecutionsList(filter) {
    const hasFilter = filter && (filter.campaignId != null || filter.actionId != null);
    return `<div class="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
      <i data-lucide="play-circle" class="w-10 h-10 text-slate-300 mx-auto mb-3"></i>
      <p class="text-sm font-black text-slate-700 mb-1">${hasFilter ? 'Nenhuma execução pra este filtro' : 'Nenhuma execução criada ainda'}</p>
      <p class="text-xs text-slate-500">${hasFilter ? 'Troque o filtro acima ou crie uma nova execução pelo painel ao lado.' : 'Adicione uma execução pelo painel ao lado ou crie via Djow.'}</p>
    </div>`;
  }
};

window.ExecutionsModule = ExecutionsModule;
