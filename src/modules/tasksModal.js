// V16.3 — Tasks Modal
// Lista de tarefas vinculadas a uma ação. Permite avançar status manualmente,
// remover e ver link externo. Não mostra JSON nem campos técnicos.
window.TasksModal = {
  render() {
    if (!App.state.showTasksModal) return '';
    const actionId = App.state.tasksModalActionId;
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return '';
    const tasks = window.ExecutionTaskStore ? ExecutionTaskStore.byAction(action.id) : [];
    return `<div class="fixed inset-0 z-[80] bg-slate-950/75 backdrop-blur-sm p-4 overflow-auto grid place-items-start justify-items-center">
      <div class="rounded-[2rem] bg-white shadow-2xl border border-slate-100 overflow-hidden" style="width:90vw;max-width:920px;">
        <header class="bg-slate-950 text-white p-5 flex items-start justify-between gap-4">
          <div>
            <p class="text-[11px] font-black text-slate-300 uppercase tracking-wider">Tarefas da ação</p>
            <h2 class="text-2xl font-black">${Utils.escape(action.name || 'Ação')}</h2>
            <p class="text-xs text-slate-300 mt-1">${tasks.length} tarefa(s) vinculada(s)</p>
          </div>
          <div class="flex items-center gap-2">
            <button onclick="Actions.openDjowModal(${action.id})" class="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-black text-sm flex items-center gap-2" style="color:#fff!important;"><i data-lucide="plus" class="w-4 h-4"></i> Nova com Djow</button>
            <button onclick="Actions.closeTasksModal()" class="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 font-black flex items-center gap-2"><i data-lucide="x" class="w-4 h-4"></i> Fechar</button>
          </div>
        </header>
        <div class="p-5 space-y-3 max-h-[70vh] overflow-auto">
          ${tasks.length ? tasks.map(t => this._taskRow(t)).join('') : this._empty()}
        </div>
      </div>
    </div>`;
  },

  _taskRow(t) {
    const statusMap = {
      pending: { label: 'Para executar', bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400' },
      in_progress: { label: 'Em execução', bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
      completed: { label: 'Concluída', bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
      blocked: { label: 'Bloqueada', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
      failed: { label: 'Falhou', bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' }
    };
    const s = statusMap[t.status] || statusMap.pending;
    const providerLabel = window.ExecutionProviderRegistry?.byId(t.provider)?.label || t.provider;
    return `<div class="rounded-3xl border border-slate-100 bg-slate-50 p-4">
      <div class="flex items-start justify-between gap-3 mb-2">
        <div class="min-w-0">
          <p class="font-black text-slate-900 text-lg">${Utils.escape(t.title || 'Tarefa')}</p>
          <p class="text-xs text-slate-500 mt-1">${t.assignee ? `Responsável: <b>${Utils.escape(t.assignee)}</b> · ` : ''}${t.due_date ? `Prazo: <b>${Utils.escape(t.due_date)}</b> · ` : ''}Provider: <b>${Utils.escape(providerLabel)}</b> · Origem: <b>${Utils.escape(t.source_agent || 'manual')}</b></p>
        </div>
        <span class="px-3 py-1.5 rounded-full ${s.bg} ${s.text} text-[11px] font-black flex items-center gap-1.5 whitespace-nowrap"><span class="w-2 h-2 rounded-full ${s.dot}"></span>${s.label}</span>
      </div>
      ${t.description ? `<p class="text-sm text-slate-600 mt-1">${Utils.escape(t.description)}</p>` : ''}
      <div class="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-200">
        ${t.status !== 'in_progress' && t.status !== 'completed' ? `<button onclick="Actions.startExecutionTask('${t.task_id}')" class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs">Iniciar</button>` : ''}
        ${t.status !== 'completed' ? `<button onclick="Actions.completeExecutionTask('${t.task_id}')" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs">Concluir</button>` : ''}
        ${t.external_url ? `<a href="${Utils.escape(t.external_url)}" target="_blank" rel="noopener" class="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-xs">Abrir externo →</a>` : ''}
        <button onclick="Actions.removeExecutionTask('${t.task_id}')" class="px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-600 font-black text-xs">Remover</button>
        <span class="ml-auto text-[10px] text-slate-400">Criada em ${Utils.escape(new Date(t.created_at).toLocaleString('pt-BR'))}</span>
      </div>
    </div>`;
  },

  _empty() {
    return `<div class="text-center py-12">
      <i data-lucide="list-checks" class="w-10 h-10 text-slate-300 mx-auto mb-3"></i>
      <p class="text-slate-600 font-black">Nenhuma tarefa ainda</p>
      <p class="text-xs text-slate-400 mt-1">Clique em <b>Nova com Djow</b> para criar a primeira.</p>
    </div>`;
  }
};
