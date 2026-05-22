// V30.0.0 — Create ClickUp Task Modal (Caminho híbrido C)
// Mínimo por padrão (lista, título, responsável, prazo, prioridade).
// "+ Mais opções" expande pra descrição, tags e multi-assignees.
// "Falar com Djow" abre o chat com seed pra refinar a task antes de criar.
window.CreateClickupTaskModal = {
  render() {
    const m = App.state.createClickupTaskModal;
    if (!m || !m.open) return '';
    const d = m.draft || {};
    const priorityOptions = [
      { value: 1, label: 'Urgente' },
      { value: 2, label: 'Alta' },
      { value: 3, label: 'Normal' },
      { value: 4, label: 'Baixa' }
    ];
    return `<div class="fixed inset-0 z-[95] bg-slate-950/85 backdrop-blur-sm grid place-items-center p-4">
      <div class="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-xl overflow-hidden max-h-[92vh] flex flex-col">
        <header class="bg-gradient-to-br from-purple-600 via-fuchsia-600 to-indigo-700 text-white p-5 shrink-0">
          <div class="flex items-center gap-2 mb-2">
            <i data-lucide="check-square" class="w-4 h-4"></i>
            <p class="text-[11px] font-black uppercase tracking-wider opacity-90">ClickUp · Nova tarefa</p>
          </div>
          <h3 class="text-xl font-black">Criar tarefa no ClickUp</h3>
          <p class="text-xs opacity-90 mt-1">Mínimo viável agora. Clique em <b>+ Mais opções</b> pra tudo da API, ou em <b>Falar com Djow</b> pra refinar conversando.</p>
        </header>

        <div class="p-5 space-y-3 overflow-y-auto">
          ${m.loadError ? `<div class="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-900 flex items-start gap-2">
            <i data-lucide="alert-circle" class="w-4 h-4 mt-0.5 shrink-0"></i>
            <div><b>Falha ao carregar dados do ClickUp:</b> ${Utils.escape(m.loadError)}</div>
          </div>` : ''}
          ${m.loading ? `<div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 flex items-center gap-2">
            <i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>
            Carregando spaces, lists e usuários do ClickUp…
          </div>` : ''}

          ${m.seedContext?.summary ? `<div class="rounded-xl bg-indigo-50 border border-indigo-200 p-3 text-[11px] text-indigo-900 flex items-start gap-2">
            <i data-lucide="link-2" class="w-3.5 h-3.5 mt-0.5 shrink-0"></i>
            <div><b>Contexto:</b> ${Utils.escape(m.seedContext.summary)}</div>
          </div>` : ''}

          <div>
            <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Lista de destino</label>
            <select onchange="Actions.updateClickupTaskField('list_id', this.value)" class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-100 border border-slate-200 font-semibold text-slate-900">
              <option value="">${m.loading ? 'Carregando…' : 'Selecione uma lista'}</option>
              ${(m.lists || []).map(l => `<option value="${Utils.escape(String(l.id))}" ${String(d.list_id) === String(l.id) ? 'selected' : ''}>${Utils.escape(l.label)}</option>`).join('')}
            </select>
            ${(() => {
              // V32.1.7 — Avisa se user escolheu list diferente da default Geraldo.
              const def = App.state.clickupStatus?.defaultListId;
              if (!def) return '';
              if (!d.list_id) return `<p class="text-[11px] text-emerald-600 mt-1">✓ List padrão (Configurações → ClickUp) será usada se você não trocar.</p>`;
              if (String(d.list_id) === String(def)) return `<p class="text-[11px] text-emerald-600 mt-1">✓ Usando list padrão configurada.</p>`;
              return `<p class="text-[11px] text-amber-700 mt-1">⚠ Override: você escolheu list diferente da padrão (Configurações → ClickUp).</p>`;
            })()}
          </div>

          <div>
            <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Título</label>
            <input value="${Utils.escape(d.name || '')}" oninput="Actions.updateClickupTaskField('name', this.value)" placeholder="Ex: Publicar landing v2" class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-100 border border-slate-200 font-semibold text-slate-900" autofocus />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Prazo</label>
              <input type="date" value="${Utils.escape(d.due_date || '')}" onchange="Actions.updateClickupTaskField('due_date', this.value)" class="mt-1 w-full px-3 py-3 rounded-2xl bg-slate-100 border border-slate-200 font-semibold text-slate-900" />
            </div>
            <div>
              <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Prioridade</label>
              <select onchange="Actions.updateClickupTaskField('priority', Number(this.value))" class="mt-1 w-full px-3 py-3 rounded-2xl bg-slate-100 border border-slate-200 font-semibold text-slate-900">
                ${priorityOptions.map(p => `<option value="${p.value}" ${Number(d.priority) === p.value ? 'selected' : ''}>${p.label}</option>`).join('')}
              </select>
            </div>
          </div>

          <div>
            <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Responsável principal</label>
            <select onchange="(function(v){ Actions.updateClickupTaskField('assignees', v ? [Number(v)] : []); App.render(); })(this.value)" class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-100 border border-slate-200 font-semibold text-slate-900">
              <option value="">${m.loading ? 'Carregando usuários…' : 'Selecione (opcional)'}</option>
              ${(m.users || []).map(u => `<option value="${Utils.escape(String(u.id))}" ${(d.assignees || []).includes(Number(u.id)) ? 'selected' : ''}>${Utils.escape(u.username)}${u.email ? ` · ${Utils.escape(u.email)}` : ''}</option>`).join('')}
            </select>
          </div>

          <div class="pt-1">
            <button onclick="Actions.toggleClickupTaskExpanded()" class="text-xs font-black text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5">
              <i data-lucide="${m.expanded ? 'chevron-up' : 'chevron-down'}" class="w-3.5 h-3.5"></i>
              ${m.expanded ? '— Menos opções' : '+ Mais opções (descrição, tags, multi-responsáveis)'}
            </button>
          </div>

          ${m.expanded ? `<div class="space-y-3 pt-1 border-t border-slate-100">
            <div>
              <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Descrição</label>
              <textarea oninput="Actions.updateClickupTaskField('description', this.value)" rows="4" placeholder="Detalhes, links, critério de aceite…" class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-100 border border-slate-200 font-semibold text-slate-900 text-sm">${Utils.escape(d.description || '')}</textarea>
            </div>
            <div>
              <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Tags (separadas por vírgula)</label>
              <input value="${Utils.escape((d.tags || []).join(', '))}" oninput="Actions.updateClickupTaskTags(this.value)" placeholder="ex: leadjourney, mkt, sprint-2" class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-100 border border-slate-200 font-semibold text-slate-900" />
            </div>
            <div>
              <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Responsáveis (múltiplos)</label>
              <div class="mt-1 max-h-40 overflow-y-auto rounded-2xl bg-slate-50 border border-slate-200 p-2 grid grid-cols-1 gap-1">
                ${(m.users || []).length === 0 ? `<div class="text-xs text-slate-500 p-2">${m.loading ? 'Carregando…' : 'Nenhum usuário disponível.'}</div>` : (m.users || []).map(u => {
                  const checked = (d.assignees || []).includes(Number(u.id));
                  return `<label class="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-white cursor-pointer text-sm">
                    <input type="checkbox" ${checked ? 'checked' : ''} onchange="Actions.toggleClickupAssignee(${Utils.escape(String(u.id))})" class="accent-indigo-600" />
                    <span class="font-semibold text-slate-800">${Utils.escape(u.username)}</span>
                    ${u.email ? `<span class="text-xs text-slate-500">${Utils.escape(u.email)}</span>` : ''}
                  </label>`;
                }).join('')}
              </div>
            </div>
          </div>` : ''}
        </div>

        <footer class="border-t border-slate-100 p-4 flex items-center justify-between gap-2 shrink-0 bg-slate-50">
          <button onclick="Actions.openDjowFromClickupModal()" class="px-3 py-2.5 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 font-black text-xs flex items-center gap-1.5" title="Refinar conversando com o Djow">
            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-purple-600"></i> Falar com Djow
          </button>
          <div class="flex items-center gap-2">
            <button onclick="Actions.closeCreateClickupTaskModal()" class="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs">Cancelar</button>
            <button onclick="Actions.submitClickupTask()" ${m.loading ? 'disabled' : ''} class="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-xs flex items-center gap-1.5" style="color:#fff!important;">
              <i data-lucide="send" class="w-3.5 h-3.5"></i> Criar no ClickUp
            </button>
          </div>
        </footer>
      </div>
    </div>`;
  }
};
