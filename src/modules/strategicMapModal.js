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
    // V31.2.0 — Welcome sempre aparece ao abrir Mapa (não persiste mais seen).
    // Skip via "Já configurou?" usa flag transient resetada por openStrategicMap.
    const showOnboarding = !App.state.strategicSkipOnboarding;
    return `<div id="strategicMapScrollContainer" class="fixed inset-0 z-[80] bg-slate-950/85 backdrop-blur-sm p-4 overflow-auto grid place-items-start justify-items-center">
      <style>
        /* V32.13.6 — Animação "seta caminhando" pra action recém-criada no
           mind-map. Card sai da esquerda + fade-in + pulse no border. */
        @keyframes lj-mind-map-action-enter {
          0%   { opacity: 0; transform: translateX(-32px) scale(0.92); box-shadow: 0 0 0 0 rgba(167, 139, 250, 0); }
          50%  { opacity: 1; transform: translateX(0) scale(1.04);    box-shadow: 0 0 24px 6px rgba(167, 139, 250, 0.5); }
          100% { opacity: 1; transform: translateX(0) scale(1);       box-shadow: 0 0 0 0 rgba(167, 139, 250, 0); }
        }
        .lj-mind-map-action-enter { animation: lj-mind-map-action-enter 1100ms cubic-bezier(0.16, 1, 0.3, 1) both; }

        /* Conectores do mind-map: linha com efeito de "fluxo" sutil */
        @keyframes lj-mind-map-flow {
          0%   { background-position: 0% 0; }
          100% { background-position: 200% 0; }
        }
        .lj-mind-map-connector {
          background-size: 200% 100%;
          animation: lj-mind-map-flow 3s linear infinite;
        }

        /* V32.13.8 — Setas SVG: linha sendo "desenhada" + pulso sutil de
           opacidade pra simular fluxo de energia. */
        @keyframes lj-mind-map-svg-draw {
          0%   { stroke-dashoffset: 100%; opacity: 0.4; }
          60%  { stroke-dashoffset: 0%;   opacity: 1; }
          100% { stroke-dashoffset: 0%;   opacity: 0.85; }
        }
        .lj-mind-map-svg-line {
          animation: lj-mind-map-svg-draw 1100ms ease-out both;
        }
      </style>
      <div class="rounded-[2rem] overflow-hidden shadow-2xl text-white" style="width:98vw;max-width:1800px;background: radial-gradient(circle at 18% 8%, rgba(99,102,241,.25), transparent 32%), radial-gradient(circle at 82% 0%, rgba(34,197,94,.15), transparent 32%), #071326;">
        ${this._header(product)}
        ${showOnboarding ? this._onboarding(product) : this._body(product)}
      </div>
      ${window.QuickActionModal ? QuickActionModal.render() : ''}
      ${window.StrategicOverviewModal ? StrategicOverviewModal.render() : ''}
      ${App.state.strategicHandoffPopup ? this._handoffPopup() : ''}
      ${App.state.strategicCampaignPrompt ? this._strategicCampaignPromptModal() : ''}
      ${App.state.strategicExecuteMetricsPopup ? this._executeMetricsConfirmPopup() : ''}
      ${App.state.strategicUnlockCeoPopup ? this._unlockCeoAsGestorPopup() : ''}
      ${App.state.strategicCreateCampaignPopup ? this._createCampaignPopup() : ''}
      ${App.state.activateCatalogKrModal ? this._activateCatalogKrModalRender() : ''}
      ${App.state.createCustomKrModal ? this._createCustomKrModalRender() : ''}
      ${App.state.pluggedActionsModal ? this._pluggedActionsModalRender() : ''}
      ${App.state.connectActionToKrsModal ? this._connectActionToKrsModalRender() : ''}
      ${App.state.strategicKrPickerOpen ? this._strategicKrPickerModalRender() : ''}
      ${App.state.strategicMindMapActionEditor ? this._mindMapActionEditorRender() : ''}
      ${App.state.executionTaskDetail ? this._executionTaskDetailRender() : ''}
      ${App.state.acompanhamentoKrDetail ? this._acompanhamentoKrDetailRender() : ''}
      ${App.state.acompanhamentoActionDetail ? this._acompanhamentoActionDetailRender() : ''}
      ${App.state.strategicActionDetailModalId ? this._actionDetailModalRender() : ''}
      ${App.state.taskCreationModal?.open ? this._taskCreationModalRender() : ''}
      ${App.state.djowTaskChat?.open ? this._djowTaskChatRender() : ''}
      ${window.ActionEditModal ? ActionEditModal.render() : ''}
    </div>`;
  },

  // V31.2.34 — Chat modal-on-modal: abre acima do taskCreationModal pra conversar
  // com o Djow. Quando Djow propõe um draft (tool propose_task_draft), aparece
  // botão "Aplicar à ação" que copia os campos pra modal pai e fecha o chat.
  _djowTaskChatRender() {
    const c = App.state.djowTaskChat;
    if (!c || !c.open) return '';
    const messages = c.messages || [];
    return `<div class="fixed inset-0 z-[99] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4" onclick="if(event.target === this) Actions.closeDjowTaskChat()">
      <div class="bg-slate-950 border border-violet-400/40 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        <div class="p-4 border-b border-white/10 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 grid place-items-center"><i data-lucide="sparkles" class="w-4 h-4 text-white"></i></div>
            <div>
              <p class="text-[10px] font-black text-violet-300 uppercase tracking-wider">Djow</p>
              <p class="text-[13px] font-black text-white">Vamos montar a task juntos</p>
            </div>
          </div>
          <button onclick="Actions.closeDjowTaskChat()" class="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 text-white font-black text-xl">×</button>
        </div>

        <div id="djowTaskChatScroll" class="flex-1 overflow-y-auto p-4 space-y-3">
          ${messages.length === 0 ? `<div class="text-center py-8">
            <p class="text-[12px] text-slate-400 mb-2">Conta o que essa task precisa entregar.</p>
            <p class="text-[11px] text-slate-500 italic">Exemplos: "preciso de uma task pra revisar a copy do e-mail" · "data limite sexta-feira, prioridade alta" · "atribui pra equipe de mkt"</p>
          </div>` : messages.map(m => {
            if (m.role === 'user') {
              const text = typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.map(x => x.text || '').join('') : '');
              return `<div class="flex justify-end"><div class="max-w-[80%] rounded-2xl rounded-br-sm bg-violet-600 text-white px-3 py-2 text-[12px] whitespace-pre-wrap">${Utils.escape(text)}</div></div>`;
            }
            // assistant
            const text = typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.filter(x => x.type === 'text').map(x => x.text).join('') : '');
            const hasDraft = m._draft || null;
            return `<div class="flex justify-start"><div class="max-w-[85%]">
              <div class="rounded-2xl rounded-bl-sm bg-slate-800 border border-white/10 text-slate-100 px-3 py-2 text-[12px] whitespace-pre-wrap">${Utils.escape(text || '...')}</div>
              ${hasDraft ? `<div class="mt-2 rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-2 text-[11px] text-emerald-100">
                <p class="font-black mb-1">📋 Draft proposto</p>
                <p><b>Nome:</b> ${Utils.escape(hasDraft.name || '—')}</p>
                <p class="mt-0.5"><b>Descrição:</b> ${Utils.escape((hasDraft.description || '').slice(0, 180))}${(hasDraft.description || '').length > 180 ? '…' : ''}</p>
                ${hasDraft.priority ? `<p class="mt-0.5"><b>Prioridade:</b> ${Utils.escape(hasDraft.priority)}</p>` : ''}
                ${hasDraft.due_date ? `<p class="mt-0.5"><b>Entrega:</b> ${Utils.escape(hasDraft.due_date)}</p>` : ''}
                ${hasDraft.assignees_hints?.length ? `<p class="mt-0.5"><b>Sugeridos:</b> ${hasDraft.assignees_hints.map(a => Utils.escape(a)).join(', ')}</p>` : ''}
                ${hasDraft.reasoning ? `<p class="mt-1 italic text-emerald-200/80">💡 ${Utils.escape(hasDraft.reasoning)}</p>` : ''}
                <button onclick='Actions.applyDjowDraftToTask(${JSON.stringify(hasDraft).replace(/'/g, "&#39;")})' class="mt-2 w-full px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black" style="color:#fff!important;">✓ Aplicar à ação</button>
              </div>` : ''}
            </div></div>`;
          }).join('')}
          ${c.loading ? `<div class="flex justify-start"><div class="rounded-2xl rounded-bl-sm bg-slate-800 border border-white/10 text-slate-400 px-3 py-2 text-[12px] flex items-center gap-2"><i data-lucide="loader" class="w-3 h-3 animate-spin"></i> Djow pensando...</div></div>` : ''}
        </div>

        <div class="p-3 border-t border-white/10 flex items-end gap-2">
          <textarea id="djowTaskChatInput" oninput="Actions.updateDjowChatInput(this.value)" onkeydown="if(event.key === 'Enter' && !event.shiftKey){ event.preventDefault(); Actions.sendDjowTaskMessage(); }" placeholder="Conta o que tu precisa..." rows="2" class="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-white text-[12px] resize-none">${Utils.escape(c.input || '')}</textarea>
          <button onclick="Actions.sendDjowTaskMessage()" ${c.loading || !String(c.input || '').trim() ? 'disabled' : ''} class="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black text-[12px] disabled:opacity-50 flex items-center gap-1.5" style="color:#fff!important;"><i data-lucide="send" class="w-3.5 h-3.5"></i> Enviar</button>
        </div>
      </div>
    </div>`;
  },

  // V31.2.33 — Modal de transição ação → execução no ClickUp.
  // Layout: form Normal sempre visível + expander "Mostrar avançado" + botão lateral Djow.
  // Sem ações destrutivas — só CREATE. Não edita/deleta tasks, links, users existentes.
  _taskCreationModalRender() {
    const m = App.state.taskCreationModal;
    if (!m || !m.open) return '';
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(m.actionId));
    if (!action) return '';
    const d = m.draft;
    const meta = App.state.clickupMeta || { loaded: false, members: [], statuses: [], tags: [], customFields: [] };
    const submitting = m.submitting;
    const djowLoading = m.djowLoading;
    const priorityOpts = [
      { v: '', l: '— sem prioridade —' },
      { v: 'urgent', l: '🔴 Urgente' },
      { v: 'high', l: '🟠 Alta' },
      { v: 'normal', l: '🔵 Normal' },
      { v: 'low', l: '⚪ Baixa' }
    ];
    return `<div class="fixed inset-0 z-[98] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onclick="if(event.target === this) Actions.closeTaskCreationModal()">
      <div class="bg-slate-950 border border-purple-400/30 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-auto shadow-2xl">
        <!-- Header -->
        <div class="p-5 border-b border-white/10 flex items-start justify-between gap-3 sticky top-0 bg-slate-950 z-10">
          <div class="min-w-0 flex-1">
            <p class="text-[10px] font-black text-purple-300 uppercase tracking-wider"><i data-lucide="send" class="w-3 h-3 inline-block"></i> Ação → ClickUp</p>
            <h2 class="text-lg font-black text-white mt-0.5 truncate">${Utils.escape(action.name)}</h2>
            <p class="text-[11px] text-slate-400 mt-0.5">Workspace: <b>${Utils.escape(App.state.clickupStatus?.workspaceName || '—')}</b>${meta.listId ? ` · List ID: <code class="text-[10px]">${Utils.escape(String(meta.listId))}</code>` : ''}</p>
          </div>
          <button onclick="Actions.closeTaskCreationModal()" class="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 text-white font-black text-xl shrink-0">×</button>
        </div>

        <div class="p-5 space-y-4">
          <!-- Djow chat trigger -->
          <button onclick="Actions.openDjowTaskChat()" ${djowLoading ? 'disabled' : ''} class="w-full px-3 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white font-black text-[12px] flex items-center justify-center gap-2 disabled:opacity-50" style="color:#fff!important;"><i data-lucide="${djowLoading ? 'loader' : 'message-square'}" class="w-4 h-4 ${djowLoading ? 'animate-spin' : ''}"></i> ${djowLoading ? 'Djow pensando...' : 'Pedir para o Djow'}</button>

          <!-- Normal -->
          <div class="space-y-3">
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Nome *</label>
              <input value="${Utils.escape(d.name)}" oninput="Actions.updateTaskDraft('name', this.value)" placeholder="Ex: Lançar campanha de e-mail" class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-[13px]" />
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Descrição *</label>
              <textarea oninput="Actions.updateTaskDraft('description', this.value)" placeholder="O que precisa ser feito + critério de pronto." rows="3" class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-[13px] resize-y">${Utils.escape(d.description)}</textarea>
            </div>
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Responsáveis * <span class="text-slate-500 font-normal">(${d.assignees.length} selecionado(s))</span></label>
              ${meta.members.length === 0 ? `<p class="text-[11px] text-slate-500 italic px-3 py-2 rounded-lg bg-slate-900/50 border border-white/5">${meta.loaded ? 'Nenhum membro encontrado no workspace.' : 'Carregando membros...'}</p>` : `<div class="rounded-lg bg-slate-900 border border-white/10 p-2 max-h-44 overflow-y-auto space-y-0.5">
                ${meta.members.map(mem => {
                  const checked = d.assignees.includes(mem.id);
                  return `<label class="flex items-center gap-2 p-1.5 rounded hover:bg-white/5 cursor-pointer">
                    <input type="checkbox" ${checked ? 'checked' : ''} onchange="Actions.toggleTaskAssignee(${mem.id})" />
                    <span class="text-[12px] text-white truncate">${Utils.escape(mem.username)}${mem.email && mem.email !== mem.username ? ` <span class="text-slate-500 text-[10px]">${Utils.escape(mem.email)}</span>` : ''}</span>
                  </label>`;
                }).join('')}
              </div>`}
            </div>
            <!-- V31.2.34 — Datas movidas pro Normal -->
            <!-- V32.14.0 — Data de entrega agora é OBRIGATÓRIA (Felipe cravou)
                 pra alimentar Etapa 6 (status atrasada/em dia). -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Data de entrega <span class="text-rose-400">*</span></label>
                <input type="datetime-local" value="${Utils.escape(d.due_date)}" oninput="Actions.updateTaskDraft('due_date', this.value); Actions.updateTaskDraft('due_date_time', this.value.includes('T'))" required class="w-full px-2 py-2 rounded-lg bg-slate-900 border ${d.due_date ? 'border-white/10' : 'border-amber-400/40'} text-white text-[12px]" style="color-scheme:dark;" />
                ${!d.due_date ? `<p class="text-[9px] text-amber-300 mt-0.5 inline-flex items-center gap-1"><i data-lucide="alert-triangle" class="w-2.5 h-2.5"></i> Obrigatório pra acompanhar atrasos.</p>` : ''}
              </div>
              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Data de início</label>
                <input type="datetime-local" value="${Utils.escape(d.start_date)}" oninput="Actions.updateTaskDraft('start_date', this.value); Actions.updateTaskDraft('start_date_time', this.value.includes('T'))" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-[12px]" style="color-scheme:dark;" />
              </div>
            </div>

            <!-- V32.14.3 — Custom fields tipo drop_down do ClickUp aparecem
                 AQUI no Normal (visível por default), não escondidos no Avançado.
                 Felipe cravou: "tipo" e outros dropdowns devem ser sempre vistos. -->
            ${(() => {
              const targetListId = Actions._resolveClickupTargetList?.(m);
              const cached = targetListId ? App.state.clickupListFieldsCache?.[targetListId] : null;
              if (targetListId && !cached && !App._listFieldsAutoload?.has(targetListId)) {
                if (!App._listFieldsAutoload) App._listFieldsAutoload = new Set();
                App._listFieldsAutoload.add(targetListId);
                setTimeout(() => Actions.loadClickupListFields?.(targetListId), 50);
              }
              const fields = (cached?.fields && cached.fields.length) ? cached.fields : (meta.customFields || []);
              if (cached?.loading) {
                return `<div class="text-[11px] text-slate-400 italic flex items-center gap-1.5"><i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Carregando campos do ClickUp…</div>`;
              }
              // Só drop_down no Normal (outros tipos ficam no Avançado pra não poluir)
              const dropdowns = fields.filter(f => f.type === 'drop_down' && Array.isArray(f.options) && f.options.length);
              if (dropdowns.length === 0) return '';
              return `<div class="space-y-2 pt-2 border-t border-white/5">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider inline-flex items-center gap-1.5">
                  <i data-lucide="list-tree" class="w-3 h-3"></i> Categorias do ClickUp
                </p>
                <div class="grid ${dropdowns.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} gap-2">
                  ${dropdowns.map(cf => {
                    const value = String((d.custom_fields || {})[cf.id] || '');
                    return `<div>
                      <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">${Utils.escape(cf.name)}</label>
                      <select onchange="Actions.updateClickupCustomField('${cf.id}', this.value)" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-[12px]" style="color-scheme:dark;">
                        <option value="">— escolha (opcional) —</option>
                        ${cf.options.map(o => `<option value="${Utils.escape(o.id)}" ${value === o.id ? 'selected' : ''}>${Utils.escape(o.name)}</option>`).join('')}
                      </select>
                    </div>`;
                  }).join('')}
                </div>
              </div>`;
            })()}
          </div>

          <!-- Toggle Avançado -->
          <button onclick="Actions.toggleTaskAdvanced()" class="w-full px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[12px] font-black flex items-center justify-between">
            <span>${m.showAdvanced ? '▴' : '▾'} Campos avançados (opcionais)</span>
            <span class="text-[10px] font-normal text-slate-500">${m.showAdvanced ? 'esconder' : 'expandir'}</span>
          </button>

          ${m.showAdvanced ? `<div class="space-y-3 rounded-xl bg-slate-900/30 border border-white/5 p-3">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Prioridade</label>
                <select onchange="Actions.updateTaskDraft('priority', this.value)" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-[12px]" style="color-scheme:dark;">
                  ${priorityOpts.map(o => `<option value="${o.v}" ${d.priority === o.v ? 'selected' : ''}>${o.l}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Status</label>
                <select onchange="Actions.updateTaskDraft('status', this.value)" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-[12px]" style="color-scheme:dark;">
                  <option value="">— default da list —</option>
                  ${meta.statuses.map(s => `<option value="${Utils.escape(s.status)}" ${d.status === s.status ? 'selected' : ''}>${Utils.escape(s.status)}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Estimativa (horas)</label>
                <input type="number" min="0" step="0.5" value="${Utils.escape(String(d.time_estimate_hours))}" oninput="Actions.updateTaskDraft('time_estimate_hours', this.value)" placeholder="ex: 2.5" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-[12px]" />
              </div>
              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Pontos (Sprint)</label>
                <input type="number" min="0" value="${Utils.escape(String(d.points))}" oninput="Actions.updateTaskDraft('points', this.value)" placeholder="ex: 3" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-[12px]" />
              </div>
            </div>

            ${meta.tags.length > 0 ? `<div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Tags <span class="text-slate-500 font-normal">(${d.tags.length} selecionada(s))</span></label>
              <div class="flex flex-wrap gap-1">
                ${meta.tags.map(t => {
                  const active = d.tags.includes(t.name);
                  return `<button onclick="Actions.toggleTaskTag('${Utils.escape(t.name)}')" class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${active ? 'bg-emerald-700 border-emerald-600 text-white' : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'}">${Utils.escape(t.name)}</button>`;
                }).join('')}
              </div>
            </div>` : ''}

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Subtask de (parent task ID)</label>
                <input value="${Utils.escape(d.parent)}" oninput="Actions.updateTaskDraft('parent', this.value)" placeholder="ex: abc123def" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-[12px] font-mono" />
              </div>
              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Dependência de (task ID)</label>
                <input value="${Utils.escape(d.links_to)}" oninput="Actions.updateTaskDraft('links_to', this.value)" placeholder="ex: xyz789" class="w-full px-2 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-[12px] font-mono" />
              </div>
            </div>

            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Markdown (sobrescreve descrição se preenchido)</label>
              <textarea oninput="Actions.updateTaskDraft('markdown_content', this.value)" rows="3" placeholder="# Título\n- bullet\n- outra coisa" class="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 text-white text-[12px] font-mono resize-y">${Utils.escape(d.markdown_content)}</textarea>
            </div>

            ${(() => {
              // V32.9.2 (Geraldo A16) — Pré-check custom fields obrigatórios.
              // Usa cache novo (clickupListFieldsCache) que cobre list específica
              // (dropdown trocado pelo cliente). Fallback meta.customFields.
              const targetListId = Actions._resolveClickupTargetList?.(m);
              const cached = targetListId ? App.state.clickupListFieldsCache?.[targetListId] : null;
              // Auto-load se não tem cache da list atual (1x por list por sessão)
              if (targetListId && !cached && !App._listFieldsAutoload?.has(targetListId)) {
                if (!App._listFieldsAutoload) App._listFieldsAutoload = new Set();
                App._listFieldsAutoload.add(targetListId);
                setTimeout(() => Actions.loadClickupListFields?.(targetListId), 50);
              }
              const fields = (cached?.fields && cached.fields.length) ? cached.fields : (meta.customFields || []);
              // V32.14.3 / V32.14.8 — drop_downs no Normal. Avançado tem só
              // não-dropdown (texto, número). Todos OPCIONAIS no LJ.
              const nonDropdownFields = fields.filter(f => f.type !== 'drop_down');
              if (cached?.loading) {
                return `<div class="text-[11px] text-slate-400 italic flex items-center gap-1.5"><i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Verificando custom fields da list…</div>`;
              }
              if (nonDropdownFields.length === 0) return '';
              return `<div>
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Outros custom fields da list <span class="text-slate-500 font-normal normal-case tracking-normal">(opcionais)</span></p>
                <div class="space-y-2">
                  ${nonDropdownFields.map(cf => {
                    const value = String((d.custom_fields || {})[cf.id] || '');
                    return `<div>
                      <label class="block text-[10px] font-bold text-slate-400 mb-0.5">${Utils.escape(cf.name)} <span class="text-slate-500">(${Utils.escape(cf.type)})</span></label>
                      <input value="${Utils.escape(value)}" oninput="Actions.updateClickupCustomField('${cf.id}', this.value)" placeholder="valor (opcional)" class="w-full px-2 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white text-[12px]" />
                    </div>`;
                  }).join('')}
                </div>
              </div>`;
            })()}
          </div>` : ''}
        </div>

        <!-- Footer -->
        <div class="p-4 border-t border-white/10 flex items-center justify-between gap-2 sticky bottom-0 bg-slate-950">
          ${(() => {
            // V32.7.2 (Geraldo A4) — Feedback do que está acontecendo quando
            // o backend está criando estrutura cascada em workspace virgem
            // (Folder Produto + List Campanha + Task pai Ação + Subtask).
            // Pode demorar 2-4s. Cliente ficava olhando o botão "Enviando..."
            // sem saber o que está rolando.
            if (!submitting) return '<span></span>';
            const status = App.state.clickupStatus || {};
            const hasRoot = Boolean(status.rootId || status.ljSpaceId);
            const isMirror = hasRoot && status.mirrorEnabled !== false;
            const cache = App.state._clickupMappingsCache;
            const isFirstTime = isMirror && (!cache || ((cache.counts?.products || 0) + (cache.counts?.campaigns || 0) + (cache.counts?.actions || 0)) === 0);
            const copy = isFirstTime
              ? 'Criando estrutura no ClickUp (Folder do Produto + List da Campanha + Task pai da Ação)… 2-4s'
              : isMirror
              ? 'Resolvendo hierarquia no ClickUp…'
              : 'Enviando pra ClickUp…';
            return `<span class="text-[11px] text-violet-300 flex items-center gap-1.5"><i data-lucide="loader" class="w-3 h-3 animate-spin"></i> ${copy}</span>`;
          })()}
          <div class="flex items-center gap-2">
            <button onclick="Actions.closeTaskCreationModal()" class="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 text-[12px] font-black">Cancelar</button>
            <button onclick="Actions.submitTaskCreation()" ${submitting ? 'disabled' : ''} class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[12px] font-black flex items-center gap-1.5 disabled:opacity-50" style="color:#fff!important;"><i data-lucide="${submitting ? 'loader' : 'send'}" class="w-3.5 h-3.5 ${submitting ? 'animate-spin' : ''}"></i> ${submitting ? 'Enviando…' : (m.editingTaskId ? 'Criar/Atualizar ClickUp' : 'Criar no ClickUp')}</button>
          </div>
        </div>
      </div>
    </div>`;
  },

  // V31.2.21 — Modal "Conectar ação a KRs": engine de checkboxes pra plugar
  // uma ação JÁ EXISTENTE em um ou mais KRs-mãe da área dela. Reusa o padrão
  // visual do _customActionEngineForm mas pra ação existente, não criando nova.
  _connectActionToKrsModalRender() {
    const m = App.state.connectActionToKrsModal;
    if (!m || !m.open) return '';
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(m.actionId));
    if (!action) return '';
    const areaId = action.strategicAreaId || 'marketing';
    const area = (StrategicMapEngine.COMERCIAL_AREAS || []).find(a => a.id === areaId);
    const tone = area?.color || 'indigo';
    const productId = App.state.strategicMapProductId;
    const campaignId = App.state.strategicMapCampaignId;
    const areaKrs = StrategicMapEngine.getProductKrs(productId).filter(k => k.area === areaId);
    const selectedKrIds = Array.isArray(m.selectedKrIds) ? m.selectedKrIds : [];
    return `<div class="fixed inset-0 z-[96] bg-slate-950/85 backdrop-blur-md grid place-items-center p-4">
      <div class="bg-slate-900 rounded-[2rem] shadow-2xl border-2 border-${tone}-400/40 w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <header class="p-5 bg-${tone}-500/15 border-b border-${tone}-400/30 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <i data-lucide="link" class="w-4 h-4 text-${tone}-200"></i>
              <p class="text-[11px] font-black text-${tone}-200 uppercase tracking-wider">${Utils.escape(area?.label || '')} · Conectar ação a KRs</p>
            </div>
            <h3 class="text-xl font-black text-white">${Utils.escape(action.name)}</h3>
            <p class="text-[11px] text-slate-300 mt-0.5">${Utils.escape(action.channel || '—')} · ${Utils.escape(action.actionType || '—')}</p>
          </div>
          <button onclick="Actions.closeConnectActionToKrsModal()" class="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white text-xs font-black flex items-center gap-1.5">
            <i data-lucide="x" class="w-3.5 h-3.5"></i> Fechar
          </button>
        </header>

        <div class="p-5 overflow-y-auto space-y-3">
          <div class="rounded-lg bg-${tone}-500/10 border border-${tone}-400/30 p-3">
            <p class="text-[10px] font-black text-${tone}-200 uppercase tracking-wider mb-2">Esta ação vai mover quais OKR(s) de ${Utils.escape(area?.label || '')}?</p>
            <div class="space-y-1.5">
              ${areaKrs.length === 0
                ? '<p class="text-[11px] text-slate-400 italic">Nenhum KR-mãe nesta área. Defina na etapa "Os Números".</p>'
                : areaKrs.map(k => {
                    const checked = selectedKrIds.includes(k.id);
                    const safe = k.targetCommitted != null ? k.targetCommitted : '—';
                    const stretch = k.targetStretch != null ? k.targetStretch : '—';
                    return `<label class="flex items-start gap-2 p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/80 cursor-pointer">
                      <input type="checkbox" ${checked ? 'checked' : ''} onchange="Actions.toggleConnectActionKr('${k.id}')" class="mt-1 shrink-0" />
                      <div class="min-w-0 flex-1">
                        <p class="font-black text-white text-[12px]">${Utils.escape(k.name)} <span class="text-[10px] text-slate-400 font-normal">(${Utils.escape(k.metric || 'quantidade')})</span></p>
                        <p class="text-[10px] text-slate-300">🔒 Segura <b class="text-emerald-300">${safe}</b> · 🚀 Avançada <b class="text-violet-300">${stretch}</b></p>
                      </div>
                    </label>`;
                  }).join('')}
            </div>
          </div>
        </div>
        <footer class="border-t border-white/10 p-4 flex justify-end gap-2 bg-slate-950/40">
          <button onclick="Actions.closeConnectActionToKrsModal()" class="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 font-black text-xs">Cancelar</button>
          <button onclick="Actions.confirmConnectActionToKrs()" class="px-4 py-2.5 rounded-2xl bg-${tone}-500 hover:bg-${tone}-600 text-white font-black text-xs flex items-center gap-1.5" style="color:#fff!important;">
            <i data-lucide="link" class="w-3.5 h-3.5"></i> Conectar
          </button>
        </footer>
      </div>
    </div>`;
  },

  // V31.2.25 — Modal de detalhe da ação operacional, aberto ao clicar na pill
  // de uma ação dentro do card de KR-mãe. Antes a pill navegava pro menu Ações
  // (forçando sair do Mapa); agora abre detalhe full inline com:
  //   - Info da ação (canal, travessia, status, dono, campanha)
  //   - Dashboard (leads, score médio, etapas do fluxo, KRs plugados)
  //   - KRs conectados (across todas branches do produto)
  //   - Execuções/tasks linkadas com contadores
  //   - Botões Editar / Desplugar / Deletar com guardrails
  _actionDetailModalRender() {
    const actionId = Number(App.state.strategicActionDetailModalId);
    const action = (App.state.actions || []).find(a => Number(a.id) === actionId);
    if (!action) return '';
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId));
    const productId = campaign?.productId || App.state.strategicMapProductId;
    const branches = productId ? (StrategicMapEngine.getBranchesByProduct(productId) || []) : [];
    const linkedKrs = [];
    branches.forEach(b => {
      (b.objectives || []).forEach(o => {
        (o.okrs || []).forEach(kr => {
          if ((kr.connectedActionIds || []).map(Number).includes(actionId)) {
            const parentPkr = StrategicMapEngine.getProductKrs(productId).find(p => p.id === kr.parentProductKrId);
            const c = (App.state.campaigns || []).find(x => Number(x.id) === Number(b.campaignId));
            linkedKrs.push({ kr, parentPkr, campaign: c });
          }
        });
      });
    });
    const tasks = window.ExecutionTaskStore ? ExecutionTaskStore.byAction(actionId) : [];
    const execStatus = window.ExecutionStatusEngine ? ExecutionStatusEngine.forAction(actionId) : { toExecute: 0, executing: 0, executed: 0, blocked: 0 };
    const status = (StrategicMapEngine.STRATEGIC_ACTION_STATUSES || []).find(s => s.id === action.strategicStatus) || { label: 'Planejada', color: 'slate' };
    const leadsCount = (action.leads || []).length;
    const score = leadsCount > 0 ? (action.leads.reduce((sum, l) => sum + Number(l.score || 0), 0) / leadsCount) : 0;
    const flowSteps = Array.isArray(action.flowPath) ? action.flowPath.length : 0;
    const canDelete = linkedKrs.length === 0;
    return `<div class="fixed inset-0 z-[97] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4" onclick="if(event.target === this) Actions.closeStrategicActionDetail()">
      <div class="bg-slate-950 border border-violet-400/30 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-auto p-5 space-y-4 shadow-2xl">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-[10px] font-black text-violet-300 uppercase tracking-wider"><i data-lucide="rocket" class="w-3 h-3 inline-block"></i> Ação operacional</p>
            <h2 class="text-xl font-black text-white mt-0.5">${Utils.escape(action.name)}</h2>
            <div class="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span class="px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-400/40 text-violet-100 text-[10px] font-black">${Utils.escape(action.channel || '—')}</span>
              <span class="px-2 py-0.5 rounded-full bg-${status.color}-500/20 border border-${status.color}-400/40 text-${status.color}-100 text-[10px] font-black">${Utils.escape(status.label).toUpperCase()}</span>
              ${action.strategicConfirmed ? '<span class="text-[10px] font-black text-emerald-300">✓ CONFIRMADA</span>' : '<span class="text-[10px] font-black text-amber-300">⚠ PENDENTE</span>'}
              ${action.strategicOwner ? `<span class="text-[10px] text-slate-400">👤 ${Utils.escape(action.strategicOwner)}</span>` : ''}
              ${campaign ? `<span class="text-[10px] text-slate-400">📁 ${Utils.escape(campaign.name)}</span>` : ''}
            </div>
          </div>
          <button onclick="Actions.closeStrategicActionDetail()" class="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 text-white font-black text-xl shrink-0">×</button>
        </div>

        <div class="rounded-xl bg-slate-900/60 border border-white/10 p-3">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Travessia da ação</p>
          <p class="text-[13px] text-white"><b>${Utils.escape(action.originSector || action.sector || '—')}</b> <span class="text-slate-500">${Utils.escape(action.originFunnel || action.funnel || '')}</span> <span class="mx-2 text-violet-400">→</span> <b>${Utils.escape(action.destinationSector || '—')}</b> <span class="text-slate-500">${Utils.escape(action.destinationFunnel || '')}</span></p>
          ${action.strategicDescription && action.strategicDescription !== 'Ação custom criada via engine' ? `<p class="text-[11px] text-slate-400 italic mt-1.5">${Utils.escape(action.strategicDescription)}</p>` : ''}
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div class="rounded-xl bg-blue-500/10 border border-blue-400/30 p-3"><p class="text-[9px] font-black text-blue-300 uppercase tracking-wider">Leads</p><p class="text-xl font-black text-white">${leadsCount}</p></div>
          <div class="rounded-xl bg-amber-500/10 border border-amber-400/30 p-3"><p class="text-[9px] font-black text-amber-300 uppercase tracking-wider">Score médio</p><p class="text-xl font-black text-white">${score.toFixed(1)}</p></div>
          <div class="rounded-xl bg-violet-500/10 border border-violet-400/30 p-3"><p class="text-[9px] font-black text-violet-300 uppercase tracking-wider">Etapas do fluxo</p><p class="text-xl font-black text-white">${flowSteps}</p></div>
          <div class="rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-3"><p class="text-[9px] font-black text-emerald-300 uppercase tracking-wider">KRs plugados</p><p class="text-xl font-black text-white">${linkedKrs.length}</p></div>
        </div>

        <div class="rounded-xl bg-slate-900/60 border border-white/10 p-3">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">${linkedKrs.length ? linkedKrs.length + ' KR(s) conectados' : 'Nenhum KR conectado'}</p>
          ${linkedKrs.length ? `<div class="space-y-1.5">
            ${linkedKrs.map(({ kr, parentPkr, campaign: c }) => `<div class="rounded-lg bg-black/30 border border-white/10 p-2 flex items-center justify-between gap-2">
              <div class="min-w-0">
                <p class="font-black text-white text-[12px]">${Utils.escape(kr.name)}${parentPkr ? ` <span class="text-[10px] text-slate-500 font-normal">(filho de ${Utils.escape(parentPkr.name)})</span>` : ''}</p>
                <p class="text-[10px] text-slate-400">Meta: <b>${kr.targetCommitted || '—'}</b> ${Utils.escape(kr.metric || '')} · Atual: <b class="text-emerald-300">${kr.current || 0}</b>${c ? ' · 📁 ' + Utils.escape(c.name) : ''}</p>
              </div>
            </div>`).join('')}
          </div>` : '<p class="text-[11px] text-slate-500 italic">Ação não está plugada em nenhum KR. Pode ser deletada com segurança.</p>'}
        </div>

        <div class="rounded-xl bg-slate-900/60 border border-white/10 p-3">
          <div class="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Execuções (${tasks.length})</p>
            <p class="text-[10px] text-slate-400"><span class="text-amber-300 font-black">${execStatus.toExecute || 0}</span> a executar · <span class="text-blue-300 font-black">${execStatus.executing || 0}</span> executando · <span class="text-emerald-300 font-black">${execStatus.executed || 0}</span> executadas</p>
          </div>
          ${tasks.length === 0 ? '<p class="text-[11px] text-slate-500 italic">Sem tasks ainda. Use "Criar Tarefas" na ação pra começar.</p>' : `<div class="space-y-1">
            ${tasks.slice(0, 10).map(t => `<div class="rounded bg-black/30 border border-white/10 p-1.5 flex items-center justify-between gap-2">
              <p class="text-[11px] text-white truncate flex-1">${Utils.escape(t.title || t.name || 'Task')}</p>
              <span class="text-[9px] font-black ${t.status === 'completed' ? 'text-emerald-300' : t.status === 'in_progress' ? 'text-blue-300' : 'text-amber-300'}">${Utils.escape(String(t.status || '—'))}</span>
            </div>`).join('')}
            ${tasks.length > 10 ? `<p class="text-[10px] text-slate-500 italic">... mais ${tasks.length - 10} tasks</p>` : ''}
          </div>`}
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-white/10 flex-wrap">
          <button onclick="Actions.editActionFromDetail(${action.id})" class="px-3 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-[12px] font-black flex items-center gap-1.5" style="color:#fff!important;"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i> Editar</button>
          <button onclick="Actions.desplugActionFromDetail(${action.id})" ${linkedKrs.length === 0 ? 'disabled' : ''} class="px-3 py-2 rounded-xl ${linkedKrs.length === 0 ? 'bg-slate-700/40 text-slate-500 cursor-not-allowed' : 'bg-amber-500 hover:bg-amber-600 text-white'} text-[12px] font-black flex items-center gap-1.5" ${linkedKrs.length === 0 ? '' : 'style="color:#fff!important;"'} title="${linkedKrs.length === 0 ? 'Ação já está desplugada' : 'Remover dos KRs (mantém a ação)'}"><i data-lucide="unplug" class="w-3.5 h-3.5"></i> Desplugar</button>
          <button onclick="Actions.deleteActionFromDetail(${action.id})" class="px-3 py-2 rounded-xl ${canDelete ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-slate-700/40 text-slate-500'} text-[12px] font-black flex items-center gap-1.5" ${canDelete ? 'style="color:#fff!important;"' : ''} title="${canDelete ? 'Excluir ação permanentemente' : 'Desplugue antes de deletar'}"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Deletar</button>
        </div>
      </div>
    </div>`;
  },

  // V31.2.20 — Modal-on-modal: ver ações plugadas a um KR-mãe.
  // Aparece em z-[96] (acima do Mapa da Receita que é z-[80]). Mostra:
  //   - Mini-dashboard (velocímetro) do KR: rollup atual vs Meta Segura/Avançada
  //   - Lista de ações conectadas (across todas branches do produto) com
  // V32.14.1 — Drill-down (lupa) do KR no Acompanhamento. Mostra ações deste
  // KR + tasks de cada ação com status (em dia/atrasada/concluída) + due_date
  // + responsáveis. Click na task abre o executionTaskDetail existente.
  _acompanhamentoKrDetailRender() {
    const detail = App.state.acompanhamentoKrDetail;
    if (!detail?.krId) return '';
    const productId = App.state.strategicMapProductId;
    // Localiza o childKr (branch local) e o productKr (mãe)
    let childKr = null, branchObj = null, branchCampaignId = null;
    if (detail.branchCampaignId) {
      const branch = StrategicMapEngine.getBranchMap(detail.branchCampaignId);
      (branch?.objectives || []).forEach(o => {
        (o.okrs || []).forEach(kr => {
          if (kr.id === detail.krId) { childKr = kr; branchObj = o; branchCampaignId = detail.branchCampaignId; }
        });
      });
    }
    if (!childKr) {
      // Fallback: procura em todas branches do produto
      const branches = StrategicMapEngine.getBranchesByProduct(productId) || [];
      branches.forEach(b => {
        (b.objectives || []).forEach(o => {
          (o.okrs || []).forEach(kr => {
            if (kr.id === detail.krId && !childKr) { childKr = kr; branchObj = o; branchCampaignId = b.campaignId; }
          });
        });
      });
    }
    if (!childKr) return '';
    const krColor = StrategicMapEngine.krColorFromId(childKr.parentProductKrId || childKr.id);
    const area = (StrategicMapEngine.COMERCIAL_AREAS || []).find(a => a.id === branchObj?.area);
    const target = Number(childKr.targetCommitted || 0);
    const current = Number(childKr.current || 0);
    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    const pctTone = pct >= 75 ? 'emerald' : pct >= 40 ? 'amber' : 'rose';
    const actionIds = (childKr.connectedActionIds || []).map(Number);
    const actions = (App.state.actions || []).filter(a => actionIds.includes(Number(a.id)));
    const now = new Date();
    return `<div class="fixed inset-0 z-[92] grid place-items-center p-4" style="background: rgba(15,23,42,0.78); backdrop-filter: blur(6px);" onclick="if(event.target===this) Actions.closeAcompanhamentoKrDetail()">
      <div class="w-full max-w-3xl rounded-3xl bg-slate-900 border-2 shadow-2xl overflow-hidden" style="border-color: ${krColor};">
        <!-- HEADER -->
        <div class="px-5 py-4 flex items-start justify-between gap-3" style="background: linear-gradient(135deg, ${krColor.replace('hsl(', 'hsla(').replace(')', ', 0.20)')}, transparent);">
          <div class="min-w-0">
            <p class="text-[10px] font-black uppercase tracking-widest" style="color: ${krColor};">
              ${area ? `<i data-lucide="${area.icon}" class="w-3 h-3 inline-block"></i> ${Utils.escape(area.label)} · ` : ''}KR · ACOMPANHAMENTO
            </p>
            <h2 class="text-lg font-black text-white mt-1 leading-tight">${Utils.escape(childKr.name)}</h2>
            <p class="text-[11px] text-slate-300 mt-0.5">
              <span class="text-emerald-400 font-bold">SEGURA <b class="text-white">${target.toLocaleString('pt-BR')}</b></span>
              ${childKr.targetStretch ? ` · <span class="text-violet-400 font-bold">AVANÇADA <b class="text-white">${Number(childKr.targetStretch).toLocaleString('pt-BR')}</b></span>` : ''}
              <span class="text-slate-500"> ${Utils.escape(childKr.metric || '')}</span>
            </p>
          </div>
          <button onclick="Actions.closeAcompanhamentoKrDetail()" class="shrink-0 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 grid place-items-center"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>

        <!-- BODY -->
        <div class="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <!-- Progresso -->
          <div class="rounded-xl bg-slate-800/40 border border-white/5 p-3">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progresso atual</p>
              <span class="text-[10px] font-black px-2 py-0.5 rounded bg-${pctTone}-500/15 border border-${pctTone}-400/30 text-${pctTone}-200 uppercase tracking-wider">${pct}% da meta</span>
            </div>
            <p class="text-[14px] font-black text-white"><b style="color: ${krColor};">${current.toLocaleString('pt-BR')}</b> <span class="text-slate-500 text-[11px]">de ${target.toLocaleString('pt-BR')} ${Utils.escape(childKr.metric || '')}</span></p>
            <div class="mt-2 h-2 rounded-full bg-white/5 overflow-hidden">
              <div class="h-full bg-gradient-to-r from-${pctTone}-500 to-${pctTone}-400" style="width:${pct}%;"></div>
            </div>
          </div>

          <!-- Lista de ações + suas tasks -->
          ${actions.length === 0 ? `<div class="rounded-xl bg-amber-500/10 border border-amber-400/30 p-4 text-amber-200 text-center">
            <p class="text-[12px] font-bold">Nenhuma ação conectada a este KR.</p>
          </div>` : ''}

          ${actions.map(action => this._acompanhamentoKrDetailActionBlock(action, now)).join('')}
        </div>

        <!-- FOOTER -->
        <div class="bg-slate-900/80 border-t border-white/5 px-5 py-3 flex justify-end">
          <button onclick="Actions.closeAcompanhamentoKrDetail()" class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[10px] font-black uppercase tracking-wider">Fechar</button>
        </div>
      </div>
    </div>`;
  },

  // V32.14.2 — Drill-down (lupa) da Ação no Acompanhamento. Mostra detalhe da
  // ação + KRs vinculados + lista de tasks com status agregado.
  _acompanhamentoActionDetailRender() {
    const detail = App.state.acompanhamentoActionDetail;
    if (!detail?.actionId) return '';
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(detail.actionId));
    if (!action) return '';
    const productId = App.state.strategicMapProductId;
    const area = (StrategicMapEngine.COMERCIAL_AREAS || []).find(a => a.id === action.strategicAreaId);
    const tone = area?.color || 'slate';
    // Coleta KRs vinculados a essa ação (across branches)
    const branches = StrategicMapEngine.getBranchesByProduct(productId) || [];
    const linkedKrs = [];
    branches.forEach(b => {
      (b.objectives || []).forEach(o => {
        (o.okrs || []).forEach(kr => {
          if ((kr.connectedActionIds || []).map(Number).includes(Number(action.id))) {
            linkedKrs.push({ kr, branchCampaignId: b.campaignId, area: o.area });
          }
        });
      });
    });
    const productKrs = StrategicMapEngine.getProductKrs(productId) || [];
    // Tasks
    const tasks = window.ExecutionTaskStore
      ? (ExecutionTaskStore.all() || []).filter(t => Number(t.linked_action_id) === Number(action.id))
      : [];
    const now = new Date();
    const completed = tasks.filter(t => t.status === 'completed').length;
    const late = tasks.filter(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < now).length;
    const onTime = tasks.length - late - completed;
    const statusMap = {
      pending: 'bg-amber-500/15 border-amber-400/30 text-amber-200',
      in_progress: 'bg-sky-500/15 border-sky-400/30 text-sky-200',
      review: 'bg-orange-500/15 border-orange-400/30 text-orange-200',
      completed: 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200',
      blocked: 'bg-rose-500/15 border-rose-400/30 text-rose-200'
    };
    const statusLabel = { pending: 'Pendente', in_progress: 'Em curso', review: 'Em revisão', completed: 'Concluída', blocked: 'Bloqueada' };
    return `<div class="fixed inset-0 z-[92] grid place-items-center p-4" style="background: rgba(15,23,42,0.78); backdrop-filter: blur(6px);" onclick="if(event.target===this) Actions.closeAcompanhamentoActionDetail()">
      <div class="w-full max-w-3xl rounded-3xl bg-slate-900 border-2 border-${tone}-400/40 shadow-2xl overflow-hidden">
        <!-- HEADER -->
        <div class="bg-${tone}-500/15 border-b border-${tone}-400/30 px-5 py-4 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[10px] font-black text-${tone}-200 uppercase tracking-widest">
              ${area ? `<i data-lucide="${area.icon}" class="w-3 h-3 inline-block"></i> ${Utils.escape(area.label)} · ` : ''}AÇÃO · ACOMPANHAMENTO
            </p>
            <h2 class="text-lg font-black text-white mt-1 leading-tight">${Utils.escape(action.name || 'Sem nome')}</h2>
            <p class="text-[11px] text-slate-300 mt-0.5">
              ${Utils.escape(action.channel || '— canal —')} · ${Utils.escape(action.actionType || '— tipo —')}
              ${action.funnelPoint ? ` · começa em <b>${Utils.escape(action.funnelPoint)}</b>` : ''}
              ${action.destSector && action.destFunnelPoint ? ` · leva pra <b>${Utils.escape(action.destSector)} ${Utils.escape(action.destFunnelPoint)}</b>` : ''}
            </p>
          </div>
          <button onclick="Actions.closeAcompanhamentoActionDetail()" class="shrink-0 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 grid place-items-center"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>

        <!-- BODY -->
        <div class="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <!-- KRs vinculados -->
          <div class="rounded-xl bg-slate-800/40 border border-white/5 p-3">
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 inline-flex items-center gap-1.5">
              <i data-lucide="target" class="w-3 h-3"></i> KRs que esta ação move
            </p>
            ${linkedKrs.length === 0 ? `<p class="text-[11px] text-slate-500 italic">Sem KRs vinculados.</p>` : `<div class="space-y-1.5">
              ${linkedKrs.map(({ kr, branchCampaignId }) => {
                const productKr = productKrs.find(p => p.id === kr.parentProductKrId) || kr;
                const krColor = StrategicMapEngine.krColorFromId(kr.parentProductKrId || kr.id);
                return `<button onclick="Actions.closeAcompanhamentoActionDetail(); setTimeout(() => Actions.openAcompanhamentoKrDetail('${kr.id}', ${branchCampaignId || 'null'}), 100)" class="w-full text-left rounded-lg bg-slate-900/60 hover:bg-slate-900 border border-white/5 p-2 flex items-center justify-between gap-2 transition" style="border-left:4px solid ${krColor};">
                  <div class="flex items-center gap-2 min-w-0 flex-1">
                    <span class="shrink-0 w-2 h-2 rounded-full" style="background:${krColor};"></span>
                    <div class="min-w-0">
                      <p class="text-[12px] font-bold text-white truncate">${Utils.escape(productKr.name || kr.name)}</p>
                      <p class="text-[10px] text-slate-500">SEGURA <b class="text-emerald-400">${Utils.escape(String(productKr.targetCommitted || '—'))}</b> ${Utils.escape(productKr.metric || '')}</p>
                    </div>
                  </div>
                  <i data-lucide="external-link" class="w-3 h-3 text-slate-500 shrink-0"></i>
                </button>`;
              }).join('')}
            </div>`}
          </div>

          <!-- Tasks -->
          <div class="rounded-xl bg-slate-800/40 border border-white/5 p-3">
            <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest inline-flex items-center gap-1.5">
                <i data-lucide="list-checks" class="w-3 h-3"></i> Tasks · ${tasks.length}
              </p>
              <div class="flex items-center gap-1.5">
                ${completed > 0 ? `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 uppercase tracking-wider">✓ ${completed}</span>` : ''}
                ${onTime > 0 ? `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-400/30 text-sky-200 uppercase tracking-wider">⏱ ${onTime}</span>` : ''}
                ${late > 0 ? `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-400/30 text-rose-200 uppercase tracking-wider">⚠ ${late}</span>` : ''}
              </div>
            </div>
            ${tasks.length === 0 ? `<p class="text-[11px] text-slate-500 italic">Sem tasks ainda. Volte pra As Ações e clique <b>Executar Ação</b> no card desta ação.</p>` : `<div class="space-y-1.5">
              ${tasks.map(t => {
                const isLate = t.status !== 'completed' && t.due_date && new Date(t.due_date) < now;
                const statusCls = isLate ? 'bg-rose-500/20 border-rose-400/40 text-rose-200' : (statusMap[t.status] || statusMap.pending);
                const statusTxt = isLate ? 'Atrasada' : (statusLabel[t.status] || 'Pendente');
                const dueLabel = t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR') : '—';
                return `<button onclick="Actions.openExecutionTaskDetail('${t.task_id}')" class="w-full text-left rounded-lg bg-slate-900/60 hover:bg-slate-900 border border-white/5 p-2 flex items-center justify-between gap-2 transition">
                  <div class="min-w-0 flex-1">
                    <p class="text-[12px] font-bold text-white truncate" title="${Utils.escape(t.title || '')}">${Utils.escape(t.title || 'Task sem nome')}</p>
                    <p class="text-[10px] text-slate-500 mt-0.5">Entrega: <b class="text-slate-300">${dueLabel}</b> · ${Utils.escape((t.provider || 'task').toUpperCase())}</p>
                  </div>
                  <span class="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border ${statusCls} shrink-0">${statusTxt}</span>
                </button>`;
              }).join('')}
            </div>`}
          </div>
        </div>

        <!-- FOOTER -->
        <div class="bg-slate-900/80 border-t border-white/5 px-5 py-3 flex justify-end">
          <button onclick="Actions.closeAcompanhamentoActionDetail()" class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[10px] font-black uppercase tracking-wider">Fechar</button>
        </div>
      </div>
    </div>`;
  },

  // V32.14.1 — Bloco de 1 ação dentro do drill-down do KR. Mostra nome da ação
  // + suas tasks com due_date + status + responsáveis.
  _acompanhamentoKrDetailActionBlock(action, now) {
    const tasks = window.ExecutionTaskStore
      ? (ExecutionTaskStore.all() || []).filter(t => Number(t.linked_action_id) === Number(action.id))
      : [];
    const statusMap = {
      pending: 'bg-amber-500/15 border-amber-400/30 text-amber-200',
      in_progress: 'bg-sky-500/15 border-sky-400/30 text-sky-200',
      review: 'bg-orange-500/15 border-orange-400/30 text-orange-200',
      completed: 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200',
      blocked: 'bg-rose-500/15 border-rose-400/30 text-rose-200'
    };
    const statusLabel = { pending: 'Pendente', in_progress: 'Em curso', review: 'Em revisão', completed: 'Concluída', blocked: 'Bloqueada' };
    return `<div class="rounded-xl bg-slate-800/40 border border-white/10 p-3 space-y-2">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="min-w-0 flex-1">
          <p class="font-black text-white text-[13px] truncate" title="${Utils.escape(action.name || 'Sem nome')}">${Utils.escape(action.name || 'Sem nome')}</p>
          <p class="text-[10px] text-slate-400 mt-0.5">${Utils.escape(action.channel || '— canal —')} · ${tasks.length} task${tasks.length === 1 ? '' : 's'}</p>
        </div>
      </div>
      ${tasks.length === 0 ? `<p class="text-[11px] text-slate-500 italic">Sem tasks criadas. Volte pra <b>As Ações</b> e clique em "Executar Ação".</p>` : `<div class="space-y-1.5">
        ${tasks.map(t => {
          const isLate = t.status !== 'completed' && t.due_date && new Date(t.due_date) < now;
          const statusCls = isLate ? 'bg-rose-500/20 border-rose-400/40 text-rose-200' : (statusMap[t.status] || statusMap.pending);
          const statusTxt = isLate ? 'Atrasada' : (statusLabel[t.status] || 'Pendente');
          const dueLabel = t.due_date ? new Date(t.due_date).toLocaleDateString('pt-BR') : '—';
          return `<button onclick="Actions.openExecutionTaskDetail('${t.task_id}')" class="w-full text-left rounded-lg bg-slate-900/60 hover:bg-slate-900 border border-white/5 p-2 flex items-center justify-between gap-2 transition">
            <div class="min-w-0 flex-1">
              <p class="text-[12px] font-bold text-white truncate" title="${Utils.escape(t.title || '')}">${Utils.escape(t.title || 'Task sem nome')}</p>
              <p class="text-[10px] text-slate-500 mt-0.5">Entrega: <b class="text-slate-300">${dueLabel}</b> · ${Utils.escape((t.provider || 'task').toUpperCase())}</p>
            </div>
            <span class="text-[9px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider border ${statusCls} shrink-0">${statusTxt}</span>
          </button>`;
        }).join('')}
      </div>`}
    </div>`;
  },

  // V32.13.16 — Modal de detalhe da task de execução. Aberto via click no
  // card amber da branch de execução no mind-map. Mostra metadados +
  // ações: sincronizar status, abrir no provider, marcar concluída manual,
  // apagar (sem tocar no provider).
  _executionTaskDetailRender() {
    const detail = App.state.executionTaskDetail;
    if (!detail?.taskId) return '';
    const task = window.ExecutionTaskStore ? ExecutionTaskStore.byId(detail.taskId) : null;
    if (!task) return '';
    const syncing = !!detail.syncing;
    const statusMap = {
      pending:     { label: 'Pendente',   tone: 'amber',   icon: 'circle' },
      in_progress: { label: 'Em curso',   tone: 'sky',     icon: 'loader' },
      review:      { label: 'Em revisão', tone: 'orange',  icon: 'eye' },
      completed:   { label: 'Concluída',  tone: 'emerald', icon: 'check-circle-2' },
      blocked:     { label: 'Bloqueada',  tone: 'rose',    icon: 'x-circle' }
    };
    const status = statusMap[task.status] || statusMap.pending;
    const provider = (task.provider || 'task').toUpperCase();
    return `<div class="fixed inset-0 z-[92] grid place-items-center p-4" style="background: rgba(15,23,42,0.75); backdrop-filter: blur(6px);" onclick="if(event.target===this) Actions.closeExecutionTaskDetail()">
      <div class="w-full max-w-lg rounded-3xl bg-slate-900 border-2 border-amber-400/40 shadow-2xl overflow-hidden">
        <!-- HEADER -->
        <div class="bg-amber-500/15 border-b border-amber-400/30 px-5 py-4 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[10px] font-black text-amber-300 uppercase tracking-widest">Execução · ${Utils.escape(provider)}</p>
            <h2 class="text-base font-black text-white mt-1 leading-tight">${Utils.escape(task.title || 'Task sem nome')}</h2>
          </div>
          <button onclick="Actions.closeExecutionTaskDetail()" class="shrink-0 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 grid place-items-center">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- BODY -->
        <div class="p-5 space-y-3">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-${status.tone}-500/15 border border-${status.tone}-400/40 text-${status.tone}-200 text-[10px] font-black uppercase tracking-wider">
              <i data-lucide="${status.icon}" class="w-3 h-3"></i>
              ${status.label}
            </span>
            ${task.completed_at ? `<span class="text-[10px] text-slate-500">Concluída em ${new Date(task.completed_at).toLocaleString('pt-BR')}</span>` : ''}
          </div>

          ${task.description ? `<div>
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Descrição</p>
            <p class="text-[12px] text-slate-300 leading-relaxed whitespace-pre-wrap">${Utils.escape(task.description)}</p>
          </div>` : ''}

          <div class="grid grid-cols-2 gap-3">
            <div>
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Provider</p>
              <p class="text-[12px] font-black text-slate-200">${Utils.escape(provider)}</p>
            </div>
            ${task.provider_task_id ? `<div>
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Task ID externo</p>
              <p class="text-[11px] font-mono text-slate-300 truncate" title="${Utils.escape(task.provider_task_id)}">${Utils.escape(task.provider_task_id)}</p>
            </div>` : ''}
          </div>

          ${task.external_url ? `<a href="${Utils.escape(task.external_url)}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-sky-500/15 border border-sky-400/40 text-sky-200 text-[11px] font-black uppercase tracking-wider hover:bg-sky-500/25">
            <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
            Abrir no ${Utils.escape(task.provider || 'provider')}
          </a>` : ''}
        </div>

        <!-- FOOTER ACTIONS -->
        <div class="bg-slate-900/80 border-t border-white/5 px-5 py-3 flex items-center justify-between gap-2 flex-wrap">
          <div class="flex items-center gap-1.5">
            <button onclick="Actions.deleteExecutionTask()" class="px-2.5 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1">
              <i data-lucide="trash-2" class="w-3 h-3"></i> Apagar
            </button>
            ${task.status !== 'completed' ? `<button onclick="Actions.markExecutionTaskComplete()" class="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1">
              <i data-lucide="check" class="w-3 h-3"></i> Marcar feita
            </button>` : ''}
          </div>
          <div class="flex items-center gap-1.5">
            <button onclick="Actions.closeExecutionTaskDetail()" class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[10px] font-black uppercase tracking-wider">Fechar</button>
            ${task.provider !== 'manual' && task.provider_task_id ? `<button onclick="Actions.syncExecutionTask()" ${syncing ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 disabled:opacity-60" style="color:#fff!important;">
              <i data-lucide="${syncing ? 'loader-2' : 'refresh-cw'}" class="w-3 h-3 ${syncing ? 'animate-spin' : ''}"></i>
              ${syncing ? 'Sincronizando' : 'Sincronizar status'}
            </button>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  },

  // V32.13.12 — Editor do card de ação no mind-map. Aberto via click no card.
  // Visual do Print 1 cravado por Felipe: KR plugado (header) + checkboxes de
  // outros KRs (esta ação move quais números?) + Nome + Onde começa + Pra onde
  // leva + Canal + "+ Criar Ação". Opera sobre action existente (não cria).
  _mindMapActionEditorRender() {
    const ed = App.state.strategicMindMapActionEditor;
    if (!ed?.actionId) return '';
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(ed.actionId));
    if (!action) return '';
    const productId = App.state.strategicMapProductId;
    const campaignId = Number(action.campaignId);
    const branch = StrategicMapEngine.getBranchMap(campaignId);
    const areaId = action.strategicAreaId;
    const area = (StrategicMapEngine.COMERCIAL_AREAS || []).find(a => a.id === areaId);
    const tone = area?.color || 'violet';
    // KRs da frente
    const productKrs = (StrategicMapEngine.getProductKrs(productId) || []).filter(k => k.area === areaId);
    // KR primário (cor + meta): pega 1º KR conectado a essa action via branch
    const branchObj = (branch?.objectives || []).find(o => o.area === areaId);
    const childKrs = branchObj?.okrs || [];
    const primaryChildKr = childKrs.find(kr => (kr.connectedActionIds || []).map(Number).includes(Number(action.id)));
    const primaryProductKrId = primaryChildKr?.parentProductKrId;
    const primaryKr = productKrs.find(k => k.id === primaryProductKrId);
    const primaryKrColor = primaryProductKrId ? StrategicMapEngine.krColorFromId(primaryProductKrId) : `hsl(0 0% 50%)`;
    // KRs vinculados atuais (todos os que têm action.id em connectedActionIds)
    const linkedKrIds = childKrs
      .filter(kr => (kr.connectedActionIds || []).map(Number).includes(Number(action.id)))
      .map(kr => kr.parentProductKrId)
      .filter(Boolean);
    // Selected via input
    const sel = new Set(linkedKrIds.map(String));
    // Channels disponíveis (genérico)
    const channels = ['RD Station', 'Meta Ads', 'Google Ads', 'Email', 'WhatsApp', 'Site/Blog', 'Evento', 'Webinar', 'Outro'];
    const actionTypes = ['Post', 'Anúncio', 'Email', 'Vídeo', 'E-book', 'Webinar', 'Reunião', 'Outro'];
    const funnelPoints = ['TOF', 'MOF', 'BOF'];
    const sectors = ['Marketing', 'Sales', 'CS'];

    const inputId = 'lj-mm-action-editor';
    const handlePrefix = `${inputId}-`;

    return `<div class="fixed inset-0 z-[91] grid place-items-center p-4" style="background: rgba(15,23,42,0.75); backdrop-filter: blur(6px);" onclick="if(event.target===this) Actions.closeMindMapActionEditor()">
      <div class="w-full max-w-4xl rounded-3xl bg-slate-900 border-2 border-${tone}-400/40 shadow-2xl overflow-hidden">
        <!-- HEADER: KR plugado -->
        <div class="bg-${tone}-500/15 border-b border-${tone}-400/30 px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2 min-w-0">
            <span class="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 uppercase tracking-wider inline-flex items-center gap-1">
              <i data-lucide="check" class="w-3 h-3"></i> Plugado
            </span>
            ${primaryKr ? `<span class="font-black text-white text-sm" style="color:${primaryKrColor};">${Utils.escape(primaryKr.name)}</span>
              <span class="text-[11px] text-slate-300">· Meta ${Utils.escape(String(primaryKr.targetCommitted || '—'))} ${Utils.escape(primaryKr.metric || '')}</span>` : '<span class="text-[12px] text-slate-400">Sem KR vinculado</span>'}
          </div>
          <button onclick="Actions.closeMindMapActionEditor()" class="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 grid place-items-center"><i data-lucide="x" class="w-4 h-4"></i></button>
        </div>

        <!-- BODY: 2 colunas (form esquerda + contexto KRs direita) -->
        <div class="grid md:grid-cols-[1.4fr_1fr] gap-0">
          <!-- FORM ESQUERDA -->
          <div class="p-5 space-y-4 border-r border-white/5">
            <div>
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Esta ação move quais números?</p>
              <div class="space-y-1.5">
                ${productKrs.map(kr => {
                  const isPrimary = kr.id === primaryProductKrId;
                  const isChecked = sel.has(String(kr.id));
                  const krColor = StrategicMapEngine.krColorFromId(kr.id);
                  return `<label class="flex items-start gap-2 px-2.5 py-1.5 rounded-lg ${isChecked ? `bg-${tone}-500/10` : 'bg-slate-800/40'} border ${isChecked ? `border-${tone}-400/30` : 'border-white/5'} cursor-pointer hover:bg-slate-800/60">
                    <input type="checkbox" id="${handlePrefix}kr-${kr.id}" ${isChecked ? 'checked' : ''} data-kr-id="${kr.id}" class="mt-1 accent-violet-500" />
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5">
                        <span class="shrink-0 w-2 h-2 rounded-full" style="background:${krColor};"></span>
                        <span class="font-black text-white text-[12px]">${Utils.escape(kr.name)}</span>
                        <span class="text-[10px] text-slate-400">(${Utils.escape(kr.metric || '')})</span>
                        ${isPrimary ? `<span class="text-[9px] font-black uppercase tracking-widest" style="color:${krColor};">· deste card</span>` : ''}
                      </div>
                      <p class="text-[10px] text-slate-500 mt-0.5">
                        <span class="text-emerald-400 font-bold">SEGURA ${Utils.escape(String(kr.targetCommitted || '—'))}</span>
                        ${kr.targetStretch ? ` · <span class="text-violet-400 font-bold">AVANÇADA ${Utils.escape(String(kr.targetStretch))}</span>` : ''}
                      </p>
                    </div>
                  </label>`;
                }).join('')}
              </div>
            </div>

            <div>
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nome da ação</label>
              <input type="text" id="${handlePrefix}name" value="${Utils.escape(action.name || '')}" placeholder="Ex: Webinar trimestral pra C-level"
                class="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-[13px] focus:border-${tone}-400 outline-none" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Onde começa</label>
                <select id="${handlePrefix}funnelPoint" class="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-[13px] outline-none">
                  <option value="">— escolha —</option>
                  ${funnelPoints.map(fp => `<option value="${fp}" ${action.funnelPoint === fp ? 'selected' : ''}>${fp}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Pra onde leva</label>
                <div class="grid grid-cols-2 gap-1.5">
                  <select id="${handlePrefix}destSector" class="px-2 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-[12px] outline-none">
                    ${sectors.map(s => `<option value="${s}" ${(action.destSector || area?.label) === s ? 'selected' : ''}>${s}</option>`).join('')}
                  </select>
                  <select id="${handlePrefix}destFunnelPoint" class="px-2 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-[12px] outline-none">
                    <option value="">— funil —</option>
                    ${funnelPoints.map(fp => `<option value="${fp}" ${action.destFunnelPoint === fp ? 'selected' : ''}>${fp}</option>`).join('')}
                  </select>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Canal</label>
                <select id="${handlePrefix}channel" class="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-[13px] outline-none">
                  <option value="">— escolha —</option>
                  ${channels.map(c => `<option value="${c}" ${action.channel === c ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
              </div>
              <div>
                <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tipo</label>
                <select id="${handlePrefix}actionType" class="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-[13px] outline-none">
                  <option value="">— escolha —</option>
                  ${actionTypes.map(t => `<option value="${t}" ${action.actionType === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="flex justify-end gap-2 pt-2">
              <button onclick="Actions.closeMindMapActionEditor()" class="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[12px] font-bold">Cancelar</button>
              <button onclick="(function(){
                const sel = Array.from(document.querySelectorAll('[id^=&quot;${handlePrefix}kr-&quot;]:checked')).map(el => el.dataset.krId);
                Actions.saveMindMapAction({
                  name: document.getElementById('${handlePrefix}name').value,
                  channel: document.getElementById('${handlePrefix}channel').value,
                  actionType: document.getElementById('${handlePrefix}actionType').value,
                  funnelPoint: document.getElementById('${handlePrefix}funnelPoint').value,
                  destSector: document.getElementById('${handlePrefix}destSector').value,
                  destFunnelPoint: document.getElementById('${handlePrefix}destFunnelPoint').value,
                  selectedKrIds: sel
                });
              })()" class="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-[12px] font-black inline-flex items-center gap-1.5" style="color:#fff!important;">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i> Criar Ação
              </button>
            </div>
          </div>

          <!-- SIDEBAR DIREITA: contexto dos KRs -->
          <div class="bg-slate-900/60 p-5 space-y-3">
            ${primaryKr ? `<div>
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Esta ação move</p>
              <div class="rounded-xl bg-slate-800/60 border-2 p-3" style="border-color:${primaryKrColor};">
                <p class="font-black text-white text-[13px]">${Utils.escape(primaryKr.name)} <span class="text-[10px] font-black uppercase tracking-widest" style="color:${primaryKrColor};">· move</span></p>
                <p class="text-[10px] mt-1">
                  <span class="text-emerald-400 font-bold">SEGURA <b class="text-white">${Utils.escape(String(primaryKr.targetCommitted || '—'))}</b></span>
                  <span class="text-slate-500"> ${Utils.escape(primaryKr.metric || '')}</span>
                </p>
                ${primaryKr.targetStretch ? `<p class="text-[10px] mt-0.5">
                  <span class="text-violet-400 font-bold">AVANÇADA <b class="text-white">${Utils.escape(String(primaryKr.targetStretch))}</b></span>
                  <span class="text-slate-500"> ${Utils.escape(primaryKr.metric || '')}</span>
                </p>` : ''}
              </div>
            </div>` : ''}
            ${productKrs.filter(k => k.id !== primaryProductKrId).length > 0 ? `<div>
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Outros números desta frente</p>
              <div class="space-y-2">
                ${productKrs.filter(k => k.id !== primaryProductKrId).map(kr => {
                  const krColor = StrategicMapEngine.krColorFromId(kr.id);
                  return `<div class="rounded-xl bg-slate-800/40 border p-2.5" style="border-left:4px solid ${krColor};">
                    <p class="font-black text-white text-[12px]">${Utils.escape(kr.name)}</p>
                    <p class="text-[10px] mt-0.5">
                      <span class="text-emerald-400 font-bold">SEGURA <b class="text-white">${Utils.escape(String(kr.targetCommitted || '—'))}</b></span>
                      <span class="text-slate-500"> ${Utils.escape(kr.metric || '')}</span>
                    </p>
                    ${kr.targetStretch ? `<p class="text-[10px] mt-0.5">
                      <span class="text-violet-400 font-bold">AVANÇADA <b class="text-white">${Utils.escape(String(kr.targetStretch))}</b></span>
                    </p>` : ''}
                  </div>`;
                }).join('')}
              </div>
            </div>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  },

  // V32.13.1 — Mini-modal KR Picker. Aberto via "+ Adicionar ação" no card
  // da frente ativa (Etapa 5). Lista os KRs daquela frente como cards
  // clicáveis. Cor à esquerda = krColorFromId determinística. Click no card
  // = chooseKrInPicker(area, kr) → fecha modal + abre engine de criação de
  // ação existente (pré-populado com area + krId).
  _strategicKrPickerModalRender() {
    const picker = App.state.strategicKrPickerOpen;
    if (!picker?.areaId) return '';
    const productId = App.state.strategicMapProductId;
    const area = (StrategicMapEngine.COMERCIAL_AREAS || []).find(a => a.id === picker.areaId);
    if (!area) return '';
    const tone = area.color;
    const productKrs = StrategicMapEngine.getProductKrs(productId).filter(k => k.area === area.id);
    return `<div class="fixed inset-0 z-[90] grid place-items-center p-4" style="background: rgba(15,23,42,0.75); backdrop-filter: blur(6px);" onclick="if(event.target===this) Actions.closeStrategicKrPicker()">
      <div class="w-full max-w-lg rounded-3xl bg-slate-900 border-2 border-${tone}-400/40 shadow-2xl overflow-hidden">
        <div class="bg-${tone}-500/20 border-b border-${tone}-400/30 px-5 py-4 flex items-start justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <span class="shrink-0 w-9 h-9 rounded-xl bg-${tone}-500/30 grid place-items-center">
              <i data-lucide="${area.icon}" class="w-4 h-4 text-${tone}-200"></i>
            </span>
            <div class="min-w-0">
              <p class="text-[10px] font-black text-${tone}-200 uppercase tracking-widest">${Utils.escape(area.label)}</p>
              <p class="text-base font-black text-white leading-tight">Qual KR esta ação vai mover?</p>
            </div>
          </div>
          <button onclick="Actions.closeStrategicKrPicker()" title="Cancelar" class="shrink-0 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 grid place-items-center">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
        <div class="p-5">
          ${productKrs.length === 0 ? `
            <div class="rounded-xl bg-amber-500/10 border border-amber-400/30 p-4 text-center">
              <p class="text-[12px] text-amber-200 font-bold">CEO ainda não definiu números nesta frente.</p>
              <p class="text-[11px] text-slate-400 mt-1">Sem KR-mãe não dá pra plugar ação aqui.</p>
            </div>
          ` : `
            <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Selecione 1 KR principal</p>
            <p class="text-[11px] text-slate-400 mb-3">A cor escolhida vai ancorar visualmente esta ação na árvore. Você pode marcar outros KRs depois no modal de configuração.</p>
            <div class="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              ${productKrs.map(kr => {
                const krColor = StrategicMapEngine.krColorFromId(kr.id);
                const krColorBg = StrategicMapEngine.krColorBgFromId(kr.id);
                return `<button onclick="Actions.chooseKrInPicker('${area.id}', '${kr.id}')" class="w-full text-left rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-white/10 hover:border-white/20 p-3 transition flex items-start gap-3 group" style="border-left: 4px solid ${krColor};">
                  <span class="shrink-0 w-3 h-3 rounded-full mt-1" style="background:${krColor};"></span>
                  <div class="min-w-0 flex-1">
                    <p class="font-black text-white text-[13px]">${Utils.escape(kr.name)}</p>
                    <p class="text-[10px] text-slate-400 mt-0.5">
                      ${kr.targetCommitted ? `Segura <b class="text-slate-200">${Utils.escape(String(kr.targetCommitted))}</b>` : 'sem meta segura'}
                      ${kr.targetStretch ? ` · Avançada <b class="text-slate-200">${Utils.escape(String(kr.targetStretch))}</b>` : ''}
                      ${kr.metric ? ` <span class="text-slate-500">${Utils.escape(kr.metric)}</span>` : ''}
                    </p>
                  </div>
                  <i data-lucide="chevron-right" class="w-4 h-4 text-slate-500 shrink-0 mt-1 group-hover:text-white transition"></i>
                </button>`;
              }).join('')}
            </div>
          `}
        </div>
        <div class="bg-slate-900/80 border-t border-white/5 px-5 py-3 flex justify-end">
          <button onclick="Actions.closeStrategicKrPicker()" class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[11px] font-black uppercase tracking-wider">
            Cancelar
          </button>
        </div>
      </div>
    </div>`;
  },

  //     canal/status/dono + link "Abrir ação" pra editar no menu Ações.
  _pluggedActionsModalRender() {
    const m = App.state.pluggedActionsModal;
    if (!m || !m.open) return '';
    const productId = App.state.strategicMapProductId;
    const pkr = StrategicMapEngine.getProductKrs(productId).find(k => k.id === m.pkrId);
    if (!pkr) return '';
    const area = (StrategicMapEngine.COMERCIAL_AREAS || []).find(a => a.id === pkr.area);
    const tone = area?.color || 'indigo';
    // Coleta TODOS os childKrs do produto que apontam pra esse pkr-mãe (across branches)
    const branches = StrategicMapEngine.getBranchesByProduct(productId);
    const childKrs = branches.flatMap(b => (b.objectives || []).flatMap(o => (o.okrs || []).map(kr => ({ ...kr, branchId: b.campaignId }))))
      .filter(k => k.parentProductKrId === pkr.id);
    // Rollup atual: soma current de todos os childKrs
    const rollupCurrent = childKrs.reduce((sum, k) => sum + Number(k.current || 0), 0);
    const safeTarget = Number(pkr.targetCommitted || 0);
    const stretchTarget = Number(pkr.targetStretch || 0);
    const pctSafe = safeTarget ? Math.min(100, Math.round((rollupCurrent / safeTarget) * 100)) : 0;
    const pctStretch = stretchTarget ? Math.min(100, Math.round((rollupCurrent / stretchTarget) * 100)) : 0;
    // Coleta todas as actions conectadas
    const connectedActionIds = new Set(childKrs.flatMap(k => (k.connectedActionIds || []).map(Number)));
    const actions = (App.state.actions || []).filter(a => connectedActionIds.has(Number(a.id)));
    const statuses = (StrategicMapEngine.STRATEGIC_ACTION_STATUSES || []);
    return `<div class="fixed inset-0 z-[96] bg-slate-950/85 backdrop-blur-md grid place-items-center p-4">
      <div class="bg-slate-900 rounded-[2rem] shadow-2xl border-2 border-${tone}-400/40 w-full max-w-3xl overflow-hidden max-h-[92vh] flex flex-col">
        <header class="p-5 bg-${tone}-500/15 border-b border-${tone}-400/30 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <i data-lucide="${area?.icon || 'target'}" class="w-4 h-4 text-${tone}-200"></i>
              <p class="text-[11px] font-black text-${tone}-200 uppercase tracking-wider">${Utils.escape(area?.label || '')} · Ações plugadas a este KR</p>
            </div>
            <h3 class="text-xl font-black text-white">${Utils.escape(pkr.name)}</h3>
            <p class="text-[11px] text-slate-300 mt-0.5">${actions.length} ação(ões) ativa(s) em ${childKrs.length} branch(es)</p>
          </div>
          <button onclick="Actions.closePluggedActionsModal()" class="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-white text-xs font-black flex items-center gap-1.5">
            <i data-lucide="x" class="w-3.5 h-3.5"></i> Fechar
          </button>
        </header>

        <div class="p-5 overflow-y-auto space-y-4">
          ${this._pluggedActionsDashboard(pkr, rollupCurrent, safeTarget, stretchTarget, pctSafe, pctStretch, tone)}

          <div>
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Ações alimentando este KR</p>
            ${actions.length === 0
              ? `<div class="rounded-xl bg-slate-800/50 border border-dashed border-white/15 p-4 text-center text-slate-400 text-sm italic">Nenhuma ação plugada ainda. Crie uma na etapa Ações pra esse número começar a se mover.</div>`
              : `<div class="space-y-2">${actions.map(a => this._pluggedActionRow(a, tone)).join('')}</div>`}
          </div>
        </div>
      </div>
    </div>`;
  },

  // V31.2.20 — Mini-dashboard com velocímetro semicircular + métricas.
  _pluggedActionsDashboard(pkr, rollupCurrent, safeTarget, stretchTarget, pctSafe, pctStretch, tone) {
    // Velocímetro: arc semicircular SVG. Ângulo varia de 180° (esquerda) a 0° (direita).
    // Posição da agulha baseada em pctSafe (clampa 0-100). Verde se >=70%, amber 40-70, red <40.
    const angleDeg = 180 - (pctSafe * 1.8); // 0% = 180°, 100% = 0°
    const needleColor = pctSafe >= 70 ? '#10B981' : (pctSafe >= 40 ? '#F59E0B' : '#EF4444');
    return `<div class="rounded-2xl bg-slate-800/50 border border-white/10 p-4">
      <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">Como esse KR está</p>
      <div class="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-4 items-center">
        <div class="flex flex-col items-center">
          <svg viewBox="0 0 200 120" class="w-full max-w-[200px]">
            <!-- Arc background -->
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="14" stroke-linecap="round"/>
            <!-- Arc fill (até pctSafe) -->
            <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="${needleColor}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${(pctSafe / 100) * 251} 251"/>
            <!-- Needle -->
            <line x1="100" y1="100" x2="${100 + 70 * Math.cos(angleDeg * Math.PI / 180)}" y2="${100 - 70 * Math.sin(angleDeg * Math.PI / 180)}" stroke="white" stroke-width="3" stroke-linecap="round"/>
            <circle cx="100" cy="100" r="5" fill="white"/>
            <!-- Percentage label -->
            <text x="100" y="90" text-anchor="middle" fill="white" font-size="22" font-weight="900">${pctSafe}%</text>
          </svg>
          <p class="text-[10px] text-slate-400 -mt-2">do piso (Meta Segura)</p>
        </div>
        <div class="space-y-2">
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="rounded-lg bg-slate-900/60 border border-white/10 p-2.5">
              <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Hoje</p>
              <p class="font-black text-white text-lg">${rollupCurrent}</p>
              <p class="text-[9px] text-slate-500">${Utils.escape(pkr.metric || '')}</p>
            </div>
            <div class="rounded-lg bg-emerald-500/10 border border-emerald-400/30 p-2.5">
              <p class="text-[9px] font-black text-emerald-300 uppercase tracking-wider">🔒 Segura</p>
              <p class="font-black text-white text-lg">${safeTarget || '—'}</p>
              <p class="text-[9px] text-emerald-200">${pctSafe}%</p>
            </div>
            <div class="rounded-lg bg-violet-500/10 border border-violet-400/30 p-2.5">
              <p class="text-[9px] font-black text-violet-300 uppercase tracking-wider">🚀 Avançada</p>
              <p class="font-black text-white text-lg">${stretchTarget || '—'}</p>
              <p class="text-[9px] text-violet-200">${pctStretch}%</p>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  },

  // V31.2.20 — Card compact de uma ação plugada. Mostra canal/status/dono + leads.
  // Botão "Abrir ação" navega pro menu Ações de Campanha (caminho já existente).
  _pluggedActionRow(action, tone) {
    const statuses = (StrategicMapEngine.STRATEGIC_ACTION_STATUSES || []);
    const status = statuses.find(s => s.id === action.strategicStatus) || statuses[0] || { label: 'Planejada', color: 'slate' };
    const leadsCount = (action.leads || []).length;
    return `<div class="rounded-xl bg-slate-800/50 border border-white/10 p-3 flex items-center justify-between gap-3 hover:bg-slate-800/80 transition">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5 mb-1 flex-wrap">
          <span class="px-1.5 py-0.5 rounded-full bg-${tone}-500/30 border border-${tone}-400/40 text-${tone}-100 text-[9px] font-black uppercase tracking-wider">${Utils.escape(action.channel || '—')}</span>
          <span class="px-1.5 py-0.5 rounded-full bg-${status.color}-500/30 border border-${status.color}-400/40 text-${status.color}-100 text-[9px] font-black">${Utils.escape(status.label).toUpperCase()}</span>
          ${action.strategicConfirmed ? '<span class="text-[10px] font-black text-emerald-300">✓ confirmada</span>' : ''}
        </div>
        <p class="font-bold text-white text-[12px] leading-tight">${Utils.escape(action.name)}</p>
        <p class="text-[10px] text-slate-400 mt-0.5">${action.strategicOwner ? '👤 ' + Utils.escape(action.strategicOwner) + ' · ' : ''}${leadsCount} lead(s) · ${Utils.escape(action.actionType || '—')}</p>
      </div>
      <button onclick="Actions.openStrategicActionDetail(${action.id})" class="px-3 py-2 rounded-xl bg-${tone}-500/20 hover:bg-${tone}-500/30 border border-${tone}-400/40 text-${tone}-100 text-[11px] font-black flex items-center gap-1.5 shrink-0">
        Abrir <i data-lucide="arrow-right" class="w-3 h-3"></i>
      </button>
    </div>`;
  },

  // V31.2.13 — Helper: prefix/suffix visual conforme a unidade do número.
  //   reais → "R$" antes  ·  percentual → "%" depois  ·  quantidade → "un" depois
  //   pontuacao → "pts" depois  ·  numero → sem decoração
  _unitDecoration(metric) {
    const m = String(metric || '').toLowerCase();
    if (m === 'reais') return { prefix: 'R$', suffix: '' };
    if (m === 'percentual') return { prefix: '', suffix: '%' };
    if (m === 'quantidade') return { prefix: '', suffix: 'un' };
    if (m === 'pontuacao') return { prefix: '', suffix: 'pts' };
    return { prefix: '', suffix: '' };
  },

  // V31.2.13 — Helper: input numérico com prefix/suffix visual.
  // borderColor = 'emerald'|'violet'|'white/10' etc. fieldKey usado no oninput.
  _unitDecoratedInput(metric, value, placeholder, borderColor, oninputCall) {
    const { prefix, suffix } = this._unitDecoration(metric);
    const valAttr = (value === null || value === undefined || value === '') ? '' : value;
    return `<div class="flex items-center px-3 py-2.5 rounded-xl bg-slate-800 border ${borderColor}">
      ${prefix ? `<span class="text-slate-300 text-sm font-bold mr-1.5 shrink-0">${prefix}</span>` : ''}
      <input type="number" value="${valAttr}" placeholder="${Utils.escape(placeholder)}" onfocus="this.select()" oninput="${oninputCall}" class="bg-transparent text-white text-sm font-bold w-full focus:outline-none placeholder:text-slate-500 min-w-0" />
      ${suffix ? `<span class="text-slate-400 text-sm font-bold ml-1.5 shrink-0">${suffix}</span>` : ''}
    </div>`;
  },

  // V31.2.12 — Modal pra ATIVAR KPI do catálogo: 3 inputs (Atual / Meta Segura
  // / Meta Avançada). Sem período (tempo vem da campanha quando plugar). Confirma →
  // cria productKr direto com confirmed:true e cai na lista verde da frente.
  _activateCatalogKrModalRender() {
    const m = App.state.activateCatalogKrModal;
    if (!m || !m.open) return '';
    const area = (StrategicMapEngine.COMERCIAL_AREAS || []).find(a => a.id === m.area);
    if (!area) return '';
    // Pega KPI do catálogo curado OU do catálogo customizado aprendido
    const curated = (StrategicMapEngine.KPI_CATALOG || {})[m.area] || [];
    const custom = (App.state.customKpiCatalog || {})[m.area] || [];
    const kpi = curated.find(k => k.id === m.catalogId) || custom.find(k => k.id === m.catalogId);
    if (!kpi) return '';
    const tone = area.color;
    return `<div class="fixed inset-0 z-[95] bg-slate-950/85 backdrop-blur-sm grid place-items-center p-4">
      <div class="bg-slate-900 rounded-[2rem] shadow-2xl border border-${tone}-400/40 w-full max-w-xl overflow-hidden">
        <header class="p-5 bg-${tone}-500/20 border-b border-${tone}-400/30">
          <div class="flex items-center gap-2 mb-2">
            <i data-lucide="${area.icon}" class="w-4 h-4 text-${tone}-200"></i>
            <p class="text-[11px] font-black text-${tone}-200 uppercase tracking-wider">${Utils.escape(area.label)} · Ativar número</p>
            ${kpi.handoff ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-200 border border-amber-400/30 ml-1">🔁 HANDOFF</span>' : ''}
          </div>
          <h3 class="text-xl font-black text-white">${Utils.escape(kpi.name)}</h3>
          ${kpi.description ? `<p class="text-xs text-slate-300 mt-1">${Utils.escape(kpi.description)}</p>` : ''}
        </header>
        <div class="p-5 space-y-3">
          <div class="grid grid-cols-3 gap-2">
            <label class="flex flex-col gap-1">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-wide">Atual</span>
              ${this._unitDecoratedInput(kpi.metric, m.current, '0', 'border-white/10', "Actions.updateActivateCatalogKrModalField('current', this.value)")}
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[10px] font-black text-emerald-300 uppercase tracking-wide">🔒 Meta Segura</span>
              ${this._unitDecoratedInput(kpi.metric, m.targetCommitted, 'piso', 'border-emerald-400/30', "Actions.updateActivateCatalogKrModalField('targetCommitted', this.value)")}
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[10px] font-black text-violet-300 uppercase tracking-wide">🚀 Meta Avançada</span>
              ${this._unitDecoratedInput(kpi.metric, m.targetStretch, 'sonho', 'border-violet-400/30', "Actions.updateActivateCatalogKrModalField('targetStretch', this.value)")}
            </label>
          </div>
          <div class="rounded-xl bg-indigo-500/10 border border-indigo-400/30 p-3 text-[11px] text-indigo-100 flex items-start gap-2">
            <i data-lucide="info" class="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-300"></i>
            <p><b>Sem prazo aqui.</b> O tempo é definido lá na campanha — quando você plugar este número numa campanha, ela injeta a faixa de tempo dela.</p>
          </div>
        </div>
        <footer class="border-t border-white/10 p-4 flex items-center justify-end gap-2 bg-slate-950/40">
          <button onclick="Actions.closeActivateCatalogKrModal()" class="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 font-black text-xs">Cancelar</button>
          <button onclick="Actions.confirmActivateCatalogKr()" class="px-4 py-2.5 rounded-2xl bg-${tone}-500 hover:bg-${tone}-600 text-white font-black text-xs flex items-center gap-1.5" style="color:#fff!important;">
            <i data-lucide="check" class="w-3.5 h-3.5"></i> Confirmar OKR
          </button>
        </footer>
      </div>
    </div>`;
  },

  // V31.2.12 — Modal pra CRIAR KR custom: 5 inputs (nome, unidade select,
  // atual, segura, avançada). Sem período. Confirma → cria productKr + adiciona
  // no customKpiCatalog[area] (base de conhecimento → vira sugestão futura).
  _createCustomKrModalRender() {
    const m = App.state.createCustomKrModal;
    if (!m || !m.open) return '';
    const area = (StrategicMapEngine.COMERCIAL_AREAS || []).find(a => a.id === m.area);
    if (!area) return '';
    const tone = area.color;
    const units = [
      { v: 'percentual',  l: '% (porcentagem)' },
      { v: 'quantidade',  l: 'Quantidade (unidades)' },
      { v: 'pontuacao',   l: 'Pontuação (NPS, CSAT)' },
      { v: 'reais',       l: 'R$ (reais)' },
      { v: 'numero',      l: 'Número' }
    ];
    return `<div class="fixed inset-0 z-[95] bg-slate-950/85 backdrop-blur-sm grid place-items-center p-4">
      <div class="bg-slate-900 rounded-[2rem] shadow-2xl border border-${tone}-400/40 w-full max-w-xl overflow-hidden max-h-[92vh] flex flex-col">
        <header class="p-5 bg-${tone}-500/20 border-b border-${tone}-400/30">
          <div class="flex items-center gap-2 mb-2">
            <i data-lucide="${area.icon}" class="w-4 h-4 text-${tone}-200"></i>
            <p class="text-[11px] font-black text-${tone}-200 uppercase tracking-wider">${Utils.escape(area.label)} · Novo número</p>
          </div>
          <h3 class="text-xl font-black text-white">Criar KR-mãe customizado</h3>
          <p class="text-xs text-slate-300 mt-1">Defina o número, a unidade e as duas metas. Vai pra base de conhecimento e aparece como sugestão pros próximos produtos.</p>
        </header>
        <div class="p-5 space-y-3 overflow-y-auto">
          <div>
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wide">Nome do número</label>
            <input value="${Utils.escape(m.name || '')}" oninput="Actions.updateCreateCustomKrModalField('name', this.value)" autofocus placeholder="Ex: Engajamento Instagram" class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-800 border border-white/10 text-white font-semibold placeholder:text-slate-500" />
          </div>
          <div>
            <label class="text-[10px] font-black text-slate-400 uppercase tracking-wide">Unidade</label>
            <select onchange="Actions.updateCreateCustomKrModalField('metric', this.value)" class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-800 border border-white/10 text-white font-semibold">
              ${units.map(u => `<option value="${u.v}" ${m.metric === u.v ? 'selected' : ''}>${u.l}</option>`).join('')}
            </select>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <label class="flex flex-col gap-1">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-wide">Atual</span>
              ${this._unitDecoratedInput(m.metric, m.current, '0', 'border-white/10', "Actions.updateCreateCustomKrModalField('current', this.value)")}
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[10px] font-black text-emerald-300 uppercase tracking-wide">🔒 Meta Segura</span>
              ${this._unitDecoratedInput(m.metric, m.targetCommitted, 'piso', 'border-emerald-400/30', "Actions.updateCreateCustomKrModalField('targetCommitted', this.value)")}
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-[10px] font-black text-violet-300 uppercase tracking-wide">🚀 Meta Avançada</span>
              ${this._unitDecoratedInput(m.metric, m.targetStretch, 'sonho', 'border-violet-400/30', "Actions.updateCreateCustomKrModalField('targetStretch', this.value)")}
            </label>
          </div>
          <div class="rounded-xl bg-indigo-500/10 border border-indigo-400/30 p-3 text-[11px] text-indigo-100 flex items-start gap-2">
            <i data-lucide="info" class="w-3.5 h-3.5 mt-0.5 shrink-0 text-indigo-300"></i>
            <p><b>Sem prazo aqui.</b> O tempo é definido lá na campanha quando você plugar o número nela.</p>
          </div>
          <div class="rounded-xl bg-${tone}-500/10 border border-${tone}-400/30 p-3 text-[11px] text-${tone}-100 flex items-start gap-2">
            <i data-lucide="sparkles" class="w-3.5 h-3.5 mt-0.5 shrink-0 text-${tone}-300"></i>
            <p><b>Aprendizado:</b> esse número entra na base de conhecimento de <b>${Utils.escape(area.label)}</b> e aparece como sugestão pros próximos produtos.</p>
          </div>
        </div>
        <footer class="border-t border-white/10 p-4 flex items-center justify-end gap-2 bg-slate-950/40">
          <button onclick="Actions.closeCreateCustomKrModal()" class="px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 font-black text-xs">Cancelar</button>
          <button onclick="Actions.confirmCreateCustomKr()" class="px-4 py-2.5 rounded-2xl bg-${tone}-500 hover:bg-${tone}-600 text-white font-black text-xs flex items-center gap-1.5" style="color:#fff!important;">
            <i data-lucide="check" class="w-3.5 h-3.5"></i> Confirmar OKR
          </button>
        </footer>
      </div>
    </div>`;
  },

  // V29.1.3 — Confirmação de "Executar Métricas" (publicar pros gestores).
  // Lista campanhas plugadas/desplugadas pra dar visão pro CEO antes de publicar.
  _executeMetricsConfirmPopup() {
    const productId = App.state.strategicMapProductId;
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    const productKrs = StrategicMapEngine.getProductKrs ? StrategicMapEngine.getProductKrs(productId) : [];
    const branches = StrategicMapEngine.getBranchesByProduct ? StrategicMapEngine.getBranchesByProduct(productId) : [];
    const desplugadas = StrategicMapEngine.getDesplugedCampaigns ? StrategicMapEngine.getDesplugedCampaigns(productId) : [];
    const wasExecuted = StrategicMapEngine.isMetricsExecuted ? StrategicMapEngine.isMetricsExecuted(productId) : false;
    const executedAt = wasExecuted ? new Date(StrategicMapEngine.getMetricsExecutedAt(productId)) : null;
    return `<div class="fixed inset-0 z-[95] bg-slate-950/90 backdrop-blur-sm p-4 grid place-items-center overflow-auto">
      <div class="rounded-3xl shadow-2xl text-white max-w-2xl w-full" style="background:radial-gradient(circle at 0% 0%, rgba(251,191,36,.25), transparent 35%), #0b1428;">
        <div class="p-6 lg:p-7 space-y-5">
          <div>
            <div class="flex items-center gap-2 mb-2"><i data-lucide="rocket" class="w-4 h-4 text-amber-300"></i><p class="text-[11px] font-black text-amber-200 uppercase tracking-wider">${wasExecuted ? 'Re-publicar métricas' : 'Publicar métricas pros gestores'}</p></div>
            <h2 class="text-2xl lg:text-3xl font-black leading-tight">${wasExecuted ? 'Atualizar o que os gestores recebem?' : 'Pronto pra mandar pros gestores?'}</h2>
            <p class="text-sm text-slate-300 mt-2 leading-relaxed">Você definiu <b class="text-amber-300">${productKrs.length} KR-mãe</b> pro produto <b>${Utils.escape(product?.name || '...')}</b>. ${wasExecuted ? `Já foi publicado em <b>${String(executedAt.getDate()).padStart(2,'0')}/${String(executedAt.getMonth()+1).padStart(2,'0')}/${executedAt.getFullYear()}</b>. Re-publicar dispara nova notificação pros gestores avaliarem se precisam plugar mudanças.` : 'Ao confirmar, esses números viram oficiais e os gestores recebem notificação pra plugar nas campanhas.'}</p>
          </div>

          <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-4 space-y-3">
            <p class="text-[11px] font-black text-sky-200 uppercase tracking-wider">Quem vai receber a notificação</p>
            ${branches.length === 0 && desplugadas.length === 0 ? '<p class="text-[12px] text-amber-300 italic">⚠️ Nenhuma campanha vinculada ainda. Crie uma no menu Campanhas pra os números terem onde plugar.</p>' : ''}
            ${branches.length > 0 ? `<div>
              <p class="text-[10px] font-black text-violet-200 uppercase tracking-wider mb-1.5">🟣 ${branches.length} campanha(s) plugada(s) — vão receber alerta no Djow:</p>
              <div class="flex flex-wrap gap-1.5">
                ${branches.map(b => {
                  const c = (App.state.campaigns || []).find(c => Number(c.id) === Number(b.campaignId));
                  return c ? `<span class="px-2.5 py-1 rounded-lg bg-violet-500/15 border border-violet-400/30 text-violet-100 text-[11px] font-bold">${Utils.escape(c.name)}</span>` : '';
                }).join('')}
              </div>
            </div>` : ''}
            ${desplugadas.length > 0 ? `<div>
              <p class="text-[10px] font-black text-red-300 uppercase tracking-wider mb-1.5">🔴 ${desplugadas.length} campanha(s) desplugada(s) — NÃO vão receber (ative o Mapa nelas primeiro se quiser que contribuam):</p>
              <div class="flex flex-wrap gap-1.5">
                ${desplugadas.slice(0, 6).map(c => `<span class="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-400/30 text-red-200 text-[11px] font-bold">${Utils.escape(c.name)}</span>`).join('')}
                ${desplugadas.length > 6 ? `<span class="text-[11px] text-slate-400 self-center">+${desplugadas.length - 6} mais</span>` : ''}
              </div>
            </div>` : ''}
          </div>

          <div class="flex flex-col sm:flex-row gap-2 justify-end pt-2">
            <button onclick="Actions.dismissExecuteMetricsPopup()" class="px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 text-sm font-black">Cancelar</button>
            <button onclick="Actions.confirmExecuteMetrics()" class="px-5 py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2" style="background:linear-gradient(135deg, #fbbf24, #f59e0b); color:#1f2937!important;"><i data-lucide="rocket" class="w-4 h-4"></i> ${wasExecuted ? 'Re-publicar' : 'Publicar e notificar gestores'}</button>
          </div>
        </div>
      </div>
    </div>`;
  },

  // V29.1.4 — Popup pra criar campanha nova quando CEO destrava sem ter
  // nenhuma branch ainda. Cria + ativa Mapa + abre como gestor.
  _createCampaignPopup() {
    const draft = App.state.strategicCreateCampaignPopup || {};
    const productId = App.state.strategicMapProductId;
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    return `<div class="fixed inset-0 z-[95] bg-slate-950/90 backdrop-blur-sm p-4 grid place-items-center overflow-auto">
      <div class="rounded-3xl shadow-2xl text-white max-w-xl w-full" style="background:radial-gradient(circle at 0% 0%, rgba(34,197,94,.22), transparent 35%), #0b1428;">
        <div class="p-6 space-y-4">
          <div>
            <div class="flex items-center gap-2 mb-1.5"><i data-lucide="folder-plus" class="w-4 h-4 text-emerald-300"></i><p class="text-[11px] font-black text-emerald-200 uppercase tracking-wider">Criar primeira campanha</p></div>
            <h3 class="text-xl font-black leading-tight">Nenhuma campanha plugada ainda — vamos criar a primeira?</h3>
            <p class="text-[12px] text-slate-300 mt-1.5 leading-relaxed">Você não tem campanha plugada no produto <b>${Utils.escape(product?.name || '...')}</b> ainda. Pra continuar como gestor, vamos criar uma agora. Ela já vai entrar com o Mapa ativado.</p>
          </div>
          <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-3 space-y-2">
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Nome da campanha</label>
            <input value="${Utils.escape(draft.newName || '')}" oninput="Actions.updateStrategicCreateCampaignDraft('newName', this.value)" placeholder="Ex: Lançamento Q2 — Maio Verde" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-bold placeholder:text-slate-500" autofocus />
          </div>
          <div class="flex flex-col sm:flex-row gap-2 justify-end pt-1">
            <button onclick="Actions.dismissStrategicCreateCampaignPopup()" class="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 text-xs font-black">Cancelar</button>
            <button onclick="Actions.createCampaignAndUnlockAsGestor()" class="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black flex items-center justify-center gap-2" style="color:#fff!important;"><i data-lucide="rocket" class="w-3.5 h-3.5"></i> Criar campanha e editar como Gestor</button>
          </div>
        </div>
      </div>
    </div>`;
  },

  // V29.1.3 — Popup "Continuar como Gestor" (destravar).
  // V29.2.1 — Mostra TODAS campanhas do produto (plugadas e desplugadas).
  // Click numa desplugada ativa Mapa antes de abrir.
  _unlockCeoAsGestorPopup() {
    const productId = App.state.strategicMapProductId;
    const allCampaigns = (App.state.campaigns || []).filter(c => Number(c.productId) === Number(productId));
    return `<div class="fixed inset-0 z-[95] bg-slate-950/90 backdrop-blur-sm p-4 grid place-items-center overflow-auto">
      <div class="rounded-3xl shadow-2xl text-white max-w-xl w-full" style="background:radial-gradient(circle at 0% 0%, rgba(99,102,241,.22), transparent 35%), #0b1428;">
        <div class="p-6 space-y-4">
          <div>
            <div class="flex items-center gap-2 mb-1.5"><i data-lucide="unlock" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Destravar etapas do Gestor</p></div>
            <h3 class="text-xl font-black leading-tight">Você quer trabalhar como gestor de qual campanha?</h3>
            <p class="text-[12px] text-slate-300 mt-1.5 leading-relaxed">Idealmente esse trabalho é do dono da campanha. Se você precisa fazer (empresa solo, gestor ausente, etc.), escolha:</p>
          </div>
          <div class="space-y-1.5">
            ${allCampaigns.map(c => {
              const branch = StrategicMapEngine.getBranchMap(c.id);
              const plugged = Boolean(branch);
              return `<button onclick="Actions.confirmUnlockCeoAsGestor(${c.id})" class="w-full text-left px-3 py-2.5 rounded-xl bg-white/5 hover:bg-violet-500/20 border border-white/10 hover:border-violet-400/40 transition flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <p class="font-black text-white text-[12px]">${Utils.escape(c.name)}</p>
                  <p class="text-[10px] ${plugged ? 'text-violet-300' : 'text-amber-300'}">${plugged ? '🟣 Já plugada — abrir como Gestor' : '🟡 Sem Mapa ativo — vai plugar e abrir'}</p>
                </div>
                <span class="text-[10px] text-violet-300">→</span>
              </button>`;
            }).join('')}
          </div>
          <div class="flex justify-end pt-1">
            <button onclick="Actions.dismissUnlockCeoPopup()" class="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 text-xs font-black">Cancelar</button>
          </div>
        </div>
      </div>
    </div>`;
  },

  // V28.4.1 — Popup pra nomear/vincular a campanha estratégica antes da 1ª ativação.
  _strategicCampaignPromptModal() {
    const prompt = App.state.strategicCampaignPrompt || {};
    const productId = prompt.productId;
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    const productName = product?.name || 'Produto';
    // Lista campanhas existentes do produto que NÃO são guarda-chuva estratégica
    // (pra opção de vincular a uma existente).
    const existingCampaigns = (App.state.campaigns || []).filter(c =>
      Number(c.productId) === Number(productId) && !c.isStrategicHost
    );
    const newName = String(prompt.newName || '').trim();
    const placeholder = `Plano Comercial 2026 — ${productName}`;
    return `<div class="fixed inset-0 z-[95] bg-slate-950/90 backdrop-blur-sm p-4 grid place-items-center overflow-auto">
      <div class="rounded-3xl shadow-2xl text-white max-w-xl w-full" style="background:radial-gradient(circle at 0% 0%, rgba(34,197,94,.22), transparent 40%), #0b1428;">
        <div class="p-6 space-y-4">
          <div>
            <div class="flex items-center gap-2 mb-1.5"><i data-lucide="folder-plus" class="w-4 h-4 text-emerald-300"></i><p class="text-[11px] font-black text-emerald-200 uppercase tracking-wider">Antes de ativar a ação</p></div>
            <h3 class="text-xl font-black leading-tight">Qual o nome da campanha estratégica deste produto?</h3>
            <p class="text-[12px] text-slate-300 mt-1.5 leading-relaxed">Toda ação que você ativar no Mapa vai pra dentro desta campanha — assim ela aparece organizada no menu <b>Campanhas</b>, com nome próprio. Você só precisa fazer isso 1 vez por produto.</p>
          </div>

          <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-3 space-y-2">
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Criar uma nova</label>
            <input value="${Utils.escape(newName)}" oninput="Actions.updateStrategicCampaignDraft('newName', this.value)" placeholder="${Utils.escape(placeholder)}" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-bold placeholder:text-slate-500" />
            <button onclick="Actions.confirmStrategicCampaign('new')" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black flex items-center justify-center gap-1.5" style="color:#fff!important;"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Criar e usar essa</button>
          </div>

          ${existingCampaigns.length ? `<div class="text-center text-[10px] text-slate-500 font-bold">────────── ou ──────────</div>
          <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-3 space-y-2">
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Vincular a uma campanha existente do produto</label>
            <select onchange="Actions.updateStrategicCampaignDraft('existingCampaignId', this.value)" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-bold" style="color-scheme:dark;">
              <option value="">— escolha uma campanha —</option>
              ${existingCampaigns.map(c => `<option value="${c.id}" ${String(prompt.existingCampaignId) === String(c.id) ? 'selected' : ''}>${Utils.escape(c.name)}</option>`).join('')}
            </select>
            <button onclick="Actions.confirmStrategicCampaign('existing')" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-xs font-black flex items-center justify-center gap-1.5" style="color:#fff!important;"><i data-lucide="link" class="w-3.5 h-3.5"></i> Vincular ao existente</button>
          </div>` : ''}

          <div class="flex justify-end pt-1">
            <button onclick="Actions.dismissStrategicCampaignPrompt()" class="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 text-xs font-black">Cancelar</button>
          </div>
        </div>
      </div>
    </div>`;
  },

  // V28.3.1 — Popup didático do passe do bastão (estratégico → tático).
  // Aparece quando o CEO confirma o último número das 3 frentes. Explica POR QUE
  // a metodologia separa quem decide o QUÊ de quem decide o COMO, sem citar Doerr.
  _handoffPopup() {
    return `<div class="fixed inset-0 z-[95] bg-slate-950/90 backdrop-blur-sm p-4 grid place-items-center overflow-auto">
      <div class="rounded-3xl shadow-2xl text-white max-w-2xl w-full" style="background:radial-gradient(circle at 0% 0%, rgba(139,92,246,.28), transparent 35%), radial-gradient(circle at 100% 100%, rgba(34,197,94,.22), transparent 35%), #0b1428;">
        <div class="p-6 lg:p-7 space-y-5">
          <div>
            <div class="flex items-center gap-2 mb-2"><span class="text-emerald-300 text-lg font-black">✓</span><p class="text-[11px] font-black text-emerald-200 uppercase tracking-wider">Branch desta campanha concluída</p></div>
            <h2 class="text-2xl lg:text-3xl font-black leading-tight">Hora de plugar as ações.</h2>
            <p class="text-sm text-slate-300 mt-2 leading-relaxed">Você confirmou os números desta campanha (Marketing, Vendas e Sucesso do Cliente). Eles agora alimentam os KRs-mãe do produto via rollup. Próximo: conectar as ações operacionais que vão mover cada número no dia-a-dia desta branch.</p>
          </div>

          <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
            <p class="text-[11px] font-black text-violet-200 uppercase tracking-wider mb-2">Por que estratégico e tático andam separados?</p>
            <p class="text-[13px] text-slate-200 leading-relaxed mb-3">Quem decide <b class="text-white">o quê</b> precisa acontecer é, quase sempre, uma cabeça diferente de quem decide <b class="text-white">como</b> fazer acontecer. Essa separação não é detalhe — é o que faz o sistema funcionar.</p>
            <ul class="space-y-2 text-[12px] text-slate-300">
              <li class="flex items-start gap-2"><span class="text-violet-300 shrink-0">▸</span><span><b class="text-violet-200">Estratégico</b> olha o tabuleiro inteiro. Pensa em quanto alocar, em que aposta priorizar, em quem ganha e quem perde recurso. Precisa visão larga e distanciamento da operação.</span></li>
              <li class="flex items-start gap-2"><span class="text-emerald-300 shrink-0">▸</span><span><b class="text-emerald-200">Tático</b> mergulha na disciplina. Conhece o canal a fundo, sabe o que funciona em campanha de mídia paga, sabe negociar com cliente difícil, sabe atender um detrator e devolver promotor. Precisa profundidade vertical.</span></li>
            </ul>
            <p class="text-[12px] text-slate-400 italic mt-3">Quando a mesma pessoa faz os dois ao mesmo tempo sem trocar de chapéu, ou a estratégia perde contato com a realidade do canal, ou a operação anda sem norte.</p>
          </div>

          <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
            <p class="text-[11px] font-black text-sky-200 uppercase tracking-wider mb-2">O que muda agora?</p>
            <div class="space-y-3 text-[13px] text-slate-200 leading-relaxed">
              <div>
                <p class="font-black text-white mb-0.5">Se sua empresa tem time formado:</p>
                <p>Este Mapa pode ser aberto pelos gestores de Marketing, Vendas e Sucesso do Cliente. Cada um vai na aba da frente dele e define a estratégia local: hipótese central, canais prioritários e as ações que vão mover cada número no dia-a-dia. Você (CEO) vira observador.</p>
              </div>
              <div>
                <p class="font-black text-white mb-0.5">Se você toca tudo sozinho:</p>
                <p>A separação acontece na sua cabeça. Você sai do chapéu de CEO e veste, um de cada vez, o do gestor de cada frente. Eu (Djow) fico do seu lado em cada aba, ajudando a montar a estratégia da área.</p>
              </div>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row gap-2 justify-end pt-2">
            <button onclick="Actions.dismissStrategicHandoffPopup(false)" class="px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 text-sm font-black">Fechar e ficar aqui</button>
            <button onclick="Actions.dismissStrategicHandoffPopup(true)" class="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-black flex items-center justify-center gap-2" style="color:#fff!important;">Vamos pro Comercial tático <i data-lucide="arrow-right" class="w-4 h-4"></i></button>
          </div>
        </div>
      </div>
    </div>`;
  },

  _header(product) {
    // V29.0.1 — Subtítulo contextual: se em modo branch, mostra nome da campanha.
    const mode = App.state.strategicMapMode || 'product';
    const campaignId = App.state.strategicMapCampaignId;
    const campaign = campaignId ? (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId)) : null;
    const branches = window.StrategicMapEngine?.getBranchesByProduct ? StrategicMapEngine.getBranchesByProduct(product.id) : [];
    const productKrs = window.StrategicMapEngine?.getProductKrs ? StrategicMapEngine.getProductKrs(product.id) : [];
    // V32.5.4 (Leonardo) — "branch" / "KR(s)-mãe" eram vocab V27 escapado.
    // Cliente leigo lê e congela. Substituido por "campanha plugada" /
    // "número do produto" (zero-jargão, alinhado com memória V28.x).
    const subtitle = mode === 'campaign' && campaign
      ? `Editando <b class="text-violet-300">${Utils.escape(campaign.name)}</b> · ${branches.length} campanha(s) plugada(s) no produto`
      : `${branches.length} campanha(s) plugada(s) · ${productKrs.length} número(s) do produto`;
    return `<header class="p-5 border-b border-white/10 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1"><i data-lucide="compass" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-slate-300 uppercase tracking-wider">Revenue Strategic Map</p></div>
        <h2 class="text-2xl font-black">Mapa da Receita — ${Utils.escape(product.name)}</h2>
        <p class="text-xs text-slate-300 mt-1">${subtitle}</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <button onclick="Actions.openStrategicOverview()" title="Mapa de fluxo: árvore consolidada Visão → KRs-mãe → Branches → OKRs" class="px-3 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-100 text-xs font-black flex items-center gap-1"><i data-lucide="git-fork" class="w-3.5 h-3.5"></i> Mapa de Fluxo</button>
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
        <button onclick="Actions.skipStrategicOnboarding()" class="px-5 py-3 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 font-black flex items-center gap-2"><i data-lucide="check-circle" class="w-4 h-4"></i> Já configurou?</button>
        <button onclick="Actions.dismissStrategicOnboarding()" style="color:#fff!important;" class="px-5 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-black flex items-center gap-2"><i data-lucide="arrow-right" class="w-4 h-4"></i> Começar pela Visão</button>
      </div>
    </div>`;
  },

  _body(product) {
    // V31.1.1 — Removido switcher de BRANCHES e ModeHint (CEO/Gestor) do body.
    // Navegação entre campanhas fica na etapa 4 "Campanha". Modo único: criar livre.
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

  // V29.1.0 — Banner sutil indicando qual papel o user assume neste mode.
  // V31.0.4 — Demo user não vê distinção CEO/Gestor (só explora o mapa pronto).
  _modeHint(product, mode) {
    if (this._isDemoView()) return '';
    if (mode === 'campaign') {
      const campaignId = App.state.strategicMapCampaignId;
      const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
      const name = campaign?.name || 'esta campanha';
      return `<div class="rounded-2xl bg-violet-500/10 border border-violet-400/30 p-3 text-[12px] text-violet-100 flex items-start gap-2">
        <i data-lucide="user-cog" class="w-3.5 h-3.5 mt-0.5 text-violet-300 shrink-0"></i>
        <span><b>Modo Gestor</b> · Você está editando a campanha <b>${Utils.escape(name)}</b>. As mudanças daqui ficam só nesta campanha — não afetam outras do mesmo produto.</span>
      </div>`;
    }
    return `<div class="rounded-2xl bg-indigo-500/10 border border-indigo-400/30 p-3 text-[12px] text-indigo-100 flex items-start gap-2">
      <i data-lucide="crown" class="w-3.5 h-3.5 mt-0.5 text-indigo-300 shrink-0"></i>
      <span><b>Modo CEO</b> · Você está editando o macro do produto <b>${Utils.escape(product.name)}</b> (etapas 1-3). As mudanças aqui afetam todas as campanhas plugadas. Etapas 4-6 são preenchidas pelos gestores de cada campanha.</span>
    </div>`;
  },

  // V31.0.4 — Helper: demo user vê o mapa unificado (sem CEO/Gestor).
  // V31.1.1 → V31.2.6 — Era todos users (aplica unificação UI). Agora voltou
  // só pra demo. CEO/Gestor distinction segue desativada via remoção dos
  // ifs em cada _stepX, sem precisar de hack global.
  _isDemoView() {
    try {
      const u = JSON.parse(localStorage.getItem('lj_user') || '{}');
      return u.mode === 'demo';
    } catch (_) { return false; }
  },

  // V29.0.0 — Switcher no topo: troca entre vista produto e branches (campanhas).
  // V31.0.4 — Demo: sem botão "Produto (CEO)", só navegação entre branches.
  _branchSwitcher(product, mode) {
    const branches = StrategicMapEngine.getBranchesByProduct ? StrategicMapEngine.getBranchesByProduct(product.id) : [];
    const activeCampaignId = App.state.strategicMapCampaignId;
    const isDemo = this._isDemoView();
    return `<div class="rounded-2xl bg-white/[0.05] border border-white/10 p-2.5 flex items-center gap-2 flex-wrap">
      <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider px-2">${isDemo ? 'Branches:' : 'Vendo:'}</span>
      ${isDemo ? '' : `<button onclick="Actions.openStrategicMap(${product.id})" class="px-3 py-1.5 rounded-lg text-[11px] font-black ${mode === 'product' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'}" ${mode === 'product' ? 'style="color:#fff!important;"' : ''}>
        <i data-lucide="layout" class="w-3 h-3 inline-block mr-1"></i> Produto (CEO)
      </button>`}
      ${branches.map(b => {
        const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(b.campaignId));
        if (!campaign) return '';
        const isActive = mode === 'campaign' && Number(activeCampaignId) === Number(b.campaignId);
        return `<button onclick="Actions.switchStrategicBranch(${b.campaignId})" class="px-3 py-1.5 rounded-lg text-[11px] font-black ${isActive ? 'bg-violet-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'}" ${isActive ? 'style="color:#fff!important;"' : ''}>
          <i data-lucide="git-branch" class="w-3 h-3 inline-block mr-1"></i> ${Utils.escape(campaign.name)}
        </button>`;
      }).join('')}
    </div>`;
  },

  // V29.0.0 — Vista PRODUTO (CEO mode): Visão + KRs-mãe + branches + desplugadas.
  _productView(product) {
    const map = StrategicMapEngine.getForProduct(product.id);
    const vision = String(map?.vision || '').trim();
    const productKrs = StrategicMapEngine.getProductKrs ? StrategicMapEngine.getProductKrs(product.id) : [];
    const branches = StrategicMapEngine.getBranchesByProduct ? StrategicMapEngine.getBranchesByProduct(product.id) : [];
    const desplugadas = StrategicMapEngine.getDesplugedCampaigns ? StrategicMapEngine.getDesplugedCampaigns(product.id) : [];
    const orphans = StrategicMapEngine.getOrphanChildKrs ? StrategicMapEngine.getOrphanChildKrs(product.id) : [];
    return `<div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <div class="space-y-4 min-w-0">
        ${this._productVisionBlock(product, vision)}
        ${this._productKrsBlock(product, productKrs, orphans)}
        ${this._productBranchesBlock(product, branches, desplugadas)}
      </div>
      ${this._djowSide(product, 'product-overview')}
    </div>`;
  },

  _productVisionBlock(product, vision) {
    return `<section class="rounded-3xl bg-white/[0.05] border border-white/10 p-5">
      <div class="flex items-center gap-2 mb-2"><i data-lucide="star" class="w-4 h-4 text-violet-300"></i><p class="text-[11px] font-black text-violet-200 uppercase tracking-wider">Visão do Produto (única, compartilhada por todas as campanhas)</p></div>
      <textarea id="strategicVisionTextareaOverview" oninput="Actions.updateStrategicVision(this.value)" placeholder="Aonde esse produto chega nos próximos 12 meses?" class="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-white/15 text-white text-sm font-semibold min-h-[80px] placeholder:text-slate-500" style="color-scheme:dark;">${Utils.escape(vision)}</textarea>
    </section>`;
  },

  _productKrsBlock(product, productKrs, orphans) {
    // V31.2.10 — Tabs Mkt/Vendas/CS no topo + renderiza só a área ativa abaixo.
    // Antes empilhava as 3 áreas, agora navega por aba (igual etapa 5 V29.3.0).
    const areas = StrategicMapEngine.COMERCIAL_AREAS || [];
    const activeAreaId = App.state.strategicNumberAreaTab || areas[0]?.id || 'marketing';
    const activeArea = areas.find(a => a.id === activeAreaId) || areas[0];
    const draft = App.state.strategicOkrDraft;
    const isDraftForActiveArea = draft && draft.area === activeArea.id;
    return `<section class="rounded-3xl bg-white/[0.05] border border-white/10 p-5 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2"><i data-lucide="target" class="w-4 h-4 text-emerald-300"></i><p class="text-[11px] font-black text-emerald-200 uppercase tracking-wider">KRs-Mãe (números que o produto inteiro precisa entregar)</p></div>
      </div>
      ${orphans.length ? `<div class="rounded-xl bg-amber-500/10 border border-amber-400/30 p-2.5 text-[11px] text-amber-200">⚠️ ${orphans.length} número(s) em branches sem KR-mãe correspondente. Crie a mãe pra ativar o rollup.</div>` : ''}
      ${productKrs.length === 0 ? '<p class="text-[12px] text-slate-400 italic">Nenhum KR-mãe criado ainda. Adicione pelo menos um pra começar o rollup.</p>' : ''}
      <div class="grid grid-cols-3 gap-2">
        ${areas.map(area => {
          const isActive = area.id === activeArea.id;
          const countInArea = productKrs.filter(k => k.area === area.id).length;
          return `<button onclick="Actions.setStrategicNumberAreaTab('${area.id}')" class="px-3 py-2 rounded-2xl border ${isActive ? `bg-${area.color}-500/20 border-${area.color}-400/50` : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]'} text-left flex items-center gap-2 transition">
            <div class="w-7 h-7 rounded-lg ${isActive ? `bg-${area.color}-500/40` : 'bg-white/5'} grid place-items-center shrink-0"><i data-lucide="${area.icon}" class="w-3.5 h-3.5 text-${area.color}-200"></i></div>
            <div class="min-w-0">
              <p class="text-[11px] font-black ${isActive ? `text-${area.color}-100` : 'text-slate-300'} truncate">${Utils.escape(area.label)}</p>
              <p class="text-[10px] ${isActive ? `text-${area.color}-300` : 'text-slate-500'}">${countInArea} número(s)</p>
            </div>
          </button>`;
        }).join('')}
      </div>
      ${this._productKrsAreaPanel(product, activeArea, productKrs, isDraftForActiveArea, draft)}
    </section>`;
  },

  // V31.2.10 — Painel da área ativa: lista KRs + catálogo (curado + aprendido) + criar custom.
  // V31.2.12 — Chip do catálogo abre MODAL com 3 inputs (atual/segura/avançada).
  // Botão "Criar customizado" abre OUTRO MODAL com 5 inputs (nome/unidade + 3 metas).
  // Customs criados aparecem no catálogo da área como sugestões (base de conhecimento).
  _productKrsAreaPanel(product, area, productKrs, isDraftForActiveArea, draft) {
    const areaKrs = productKrs.filter(k => k.area === area.id);
    const curated = (StrategicMapEngine.KPI_CATALOG || {})[area.id] || [];
    const learned = (App.state.customKpiCatalog || {})[area.id] || [];
    const activatedIds = new Set(areaKrs.map(k => k.catalogId).filter(Boolean));
    const availableCurated = curated.filter(c => !activatedIds.has(c.id));
    const availableLearned = learned.filter(c => !activatedIds.has(c.id));
    const owner = StrategicMapEngine.getAreaOwner ? StrategicMapEngine.getAreaOwner(product.id, area.id) : '';
    return `<div class="rounded-2xl bg-${area.color}-500/5 border border-${area.color}-400/20 p-3">
      <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <p class="text-[10px] font-black text-${area.color}-200 uppercase tracking-wider"><i data-lucide="${area.icon}" class="w-3 h-3 inline-block"></i> ${Utils.escape(area.label)}</p>
        <label class="flex items-center gap-1.5 text-[10px] text-slate-400">Dono (compartilhado): <input value="${Utils.escape(owner)}" oninput="Actions.setStrategicAreaOwner(${product.id}, '${area.id}', this.value)" placeholder="quem responde" class="px-2 py-0.5 rounded bg-slate-900 border border-white/10 text-white text-[11px] font-bold w-32" /></label>
      </div>
      ${areaKrs.length === 0 ? '<p class="text-[11px] text-slate-500 italic">Sem KRs-mãe nesta área.</p>' : '<div class="space-y-2">' + areaKrs.map(kr => this._productKrCard(product, kr, area.color)).join('') + '</div>'}
      ${(availableCurated.length || availableLearned.length) ? `<div class="mt-2 pt-2 border-t border-${area.color}-400/20">
        <p class="text-[9px] font-black text-${area.color}-300/70 uppercase mb-1">+ Adicionar KR-mãe do catálogo:</p>
        <div class="flex flex-wrap gap-1">
          ${availableCurated.map(c => `<button onclick="Actions.openActivateCatalogKrModal(${product.id}, '${area.id}', '${c.id}')" title="${Utils.escape(c.description || '')}" class="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-${area.color}-200 text-[10px] font-bold">+ ${Utils.escape(c.name)}</button>`).join('')}
          ${availableLearned.map(c => `<button onclick="Actions.openActivateCatalogKrModal(${product.id}, '${area.id}', '${c.id}')" title="${Utils.escape(c.description || 'Sugerido a partir de um KR custom criado anteriormente')}" class="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border-2 border-dashed border-${area.color}-400/40 text-${area.color}-100 text-[10px] font-bold flex items-center gap-1">✨ ${Utils.escape(c.name)}</button>`).join('')}
        </div>
      </div>` : ''}
      <div class="mt-2 pt-2 border-t border-${area.color}-400/20">
        <button onclick="Actions.openCreateCustomKrModal(${product.id}, '${area.id}')" class="px-2.5 py-1.5 rounded-lg bg-${area.color}-500/15 hover:bg-${area.color}-500/25 border border-dashed border-${area.color}-400/40 text-${area.color}-100 text-[10px] font-black flex items-center gap-1.5">
          <i data-lucide="zap" class="w-3 h-3"></i> Criar KR-mãe customizado
        </button>
      </div>
    </div>`;
  },

  // V31.2.11 — Refator padrão V28.2: card bi-estado (editing → confirmed verde).
  _productKrCard(product, kr, tone) {
    const handoffBadge = kr.isHandoff
      ? `<span title="Handoff: entrega desse segmento pro próximo" class="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-200 border border-amber-400/30">🔁 HANDOFF</span>`
      : '';
    if (kr.confirmed) return this._productKrCardConfirmed(product, kr, tone, handoffBadge);
    return this._productKrCardEditing(product, kr, tone, handoffBadge);
  },

  // V31.2.11 — Card verde colapsado após confirmar (read-only com botão Editar).
  _productKrCardConfirmed(product, kr, tone, handoffBadge) {
    const rollup = StrategicMapEngine.rollupForProductKr ? StrategicMapEngine.rollupForProductKr(product.id, kr.id) : { current: 0, contributors: 0 };
    const target = Number(kr.targetCommitted || 0);
    const progress = target ? Math.round((rollup.current / target) * 100) : 0;
    return `<div class="rounded-2xl bg-emerald-500/[0.05] border border-emerald-400/30 p-3">
      <div class="flex items-start justify-between gap-2 mb-1.5">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 flex-wrap mb-1">
            <span class="text-emerald-300 font-black">✓</span>
            <p class="font-black text-white text-[13px]">${Utils.escape(kr.name)}</p>
            ${handoffBadge}
          </div>
          <p class="text-[11px] text-slate-300">
            Hoje <b class="text-white">${Number(kr.current ?? 0)}</b>
            · Segura <b class="text-emerald-300">${Number(kr.targetCommitted ?? 0)}</b>
            · Avançada <b class="text-violet-300">${Number(kr.targetStretch ?? 0)}</b>
            ${/* V32.4.4 — Felipe pediu remover "em X dias" — por hora sem prazo setado. */ ''}
          </p>
          <p class="text-[10px] text-slate-400 mt-1">Rollup: <b class="text-${tone}-200">${rollup.current}</b> de ${rollup.contributors} branch(es) contribuindo · ${progress}%</p>
        </div>
      </div>
      ${window.StrategicMapRenderer ? StrategicMapRenderer.progressBar(progress, 'emerald') : ''}
      <div class="flex justify-end gap-1 mt-2">
        <button onclick="Actions.editProductKr(${product.id}, '${kr.id}')" class="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 text-[10px] font-black">Editar</button>
        <button onclick="Actions.removeProductKrAction(${product.id}, '${kr.id}')" class="px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-400/30 text-red-300 text-[10px] font-black">Remover</button>
      </div>
    </div>`;
  },

  // V31.2.11 — Card editing inline com 4 campos (Atual + Meta Segura + Meta
  // Avançada + Período em chips) + botão Confirmar (só ativa quando os 3
  // numéricos estão preenchidos). Ring colorido + badge PRÓXIMO no kr da fila.
  _productKrCardEditing(product, kr, tone, handoffBadge) {
    const productId = product.id;
    const next = StrategicMapEngine.nextUnconfirmedProductKr ? StrategicMapEngine.nextUnconfirmedProductKr(productId) : null;
    const isNext = next && next.krId === kr.id;
    const ringCls = isNext ? `ring-2 ring-${tone}-400 shadow-lg shadow-${tone}-500/20` : '';
    const desc = kr.catalogDescription ? `<p class="text-[10px] text-slate-400 italic mb-2">${Utils.escape(kr.catalogDescription)}</p>` : '';
    const hasSafe = Number(kr.targetCommitted ?? 0) > 0;
    const hasAdv = Number(kr.targetStretch ?? 0) > 0;
    const missingAdv = hasSafe && !hasAdv;
    const complete = hasSafe && hasAdv && (kr.current !== null && kr.current !== undefined && kr.current !== '');
    return `<div class="rounded-2xl bg-black/30 border border-${tone}-400/30 p-3 ${ringCls}">
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 flex-wrap mb-1">
            ${isNext ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-${tone}-500/30 text-${tone}-100 border border-${tone}-400/40">PRÓXIMO</span>` : ''}
            <p class="font-black text-white text-[13px]">${Utils.escape(kr.name)}</p>
            ${handoffBadge}
          </div>
          ${desc}
        </div>
      </div>

      <div class="grid grid-cols-3 gap-1.5 mb-2">
        <label class="flex flex-col gap-0.5">
          <span class="text-[9px] font-black text-slate-500 uppercase">Atual</span>
          <input type="number" value="${kr.current ?? ''}" placeholder="0" onfocus="this.select()" oninput="Actions.updateProductKrField(${productId}, '${kr.id}', 'current', this.value)" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white text-[12px] font-bold w-full placeholder:text-slate-600" />
        </label>
        <label class="flex flex-col gap-0.5">
          <span class="text-[9px] font-black text-emerald-300 uppercase">🔒 Meta Segura</span>
          <input type="number" value="${kr.targetCommitted ?? ''}" placeholder="piso" onfocus="this.select()" oninput="Actions.updateProductKrField(${productId}, '${kr.id}', 'targetCommitted', this.value)" class="px-2 py-1.5 rounded-lg bg-slate-900 border ${hasSafe ? 'border-emerald-400/40' : 'border-white/10'} text-white text-[12px] font-bold w-full placeholder:text-slate-600" />
        </label>
        <label class="flex flex-col gap-0.5">
          <span class="text-[9px] font-black text-violet-300 uppercase">🚀 Meta Avançada</span>
          <input type="number" value="${kr.targetStretch ?? ''}" placeholder="sonho" onfocus="this.select()" oninput="Actions.updateProductKrField(${productId}, '${kr.id}', 'targetStretch', this.value)" class="px-2 py-1.5 rounded-lg bg-slate-900 border ${hasAdv ? 'border-violet-400/40' : (missingAdv ? 'border-amber-400/60' : 'border-white/10')} text-white text-[12px] font-bold w-full placeholder:text-slate-600" />
        </label>
      </div>

      ${missingAdv ? `<div class="rounded-lg bg-amber-500/10 border border-amber-400/30 p-2 text-[11px] text-amber-200 mb-2">⚠️ Você definiu a Meta Segura. Agora preencha a <b>Meta Avançada</b> — o sonho do time. Sem ela, o número fica só com o piso e perde a ambição.</div>` : ''}

      <div class="mb-2">
        <p class="text-[9px] font-black text-slate-500 uppercase mb-1">Período Tático</p>
        <button class="px-3 py-1.5 rounded-lg border bg-${tone}-500/30 border-${tone}-400/60 text-white text-[11px] font-bold cursor-default">90 dias — próximo trimestre</button>
        <p class="text-[11px] text-slate-400 mt-2 leading-relaxed">💡 <b class="text-slate-200">Por que 90 dias?</b> Em um trimestre você vê resultado real (não só promessa), e ainda dá tempo de corrigir rota antes de gastar o ano inteiro num caminho errado.</p>
      </div>

      <div class="flex justify-between items-center pt-2 border-t border-white/10">
        <button onclick="Actions.removeProductKrAction(${productId}, '${kr.id}')" class="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-400/30 text-red-300 text-[10px] font-black">Remover</button>
        <button onclick="Actions.confirmProductKr(${productId}, '${kr.id}')" ${complete ? '' : 'disabled'} class="px-3 py-1.5 rounded-lg ${complete ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'} text-[11px] font-black" ${complete ? 'style="color:#fff!important;"' : ''}>✓ Confirmar número →</button>
      </div>
    </div>`;
  },

  _productBranchesBlock(product, branches, desplugadas) {
    return `<section class="rounded-3xl bg-white/[0.05] border border-white/10 p-5 space-y-3">
      <div class="flex items-center gap-2"><i data-lucide="git-branch" class="w-4 h-4 text-sky-300"></i><p class="text-[11px] font-black text-sky-200 uppercase tracking-wider">Branches (campanhas plugadas) — ${branches.length} ativa(s) · ${desplugadas.length} desplugada(s)</p></div>
      ${branches.length === 0 ? '<p class="text-[12px] text-slate-400 italic">Nenhuma campanha plugada ainda. Ative o Mapa numa campanha pra criar a 1ª branch.</p>' : '<div class="space-y-2">' + branches.map(b => {
        const c = (App.state.campaigns || []).find(c => Number(c.id) === Number(b.campaignId));
        if (!c) return '';
        const status = StrategicMapEngine.getCampaignStrategicStatus(b.campaignId);
        const statusInfo = { active: { color: 'violet', label: 'Ativa' }, configuring: { color: 'amber', label: 'Em configuração' }, unplugged: { color: 'red', label: 'Desplugada' } }[status] || {};
        return `<div class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900/40 border border-white/10">
          <div class="min-w-0"><p class="font-black text-white text-[12px] truncate">${Utils.escape(c.name)}</p><p class="text-[10px] text-${statusInfo.color}-300">● ${statusInfo.label}</p></div>
          <button onclick="Actions.openStrategicMapForCampaign(${b.campaignId})" class="px-2.5 py-1 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-[10px] font-black shrink-0" style="color:#fff!important;">Abrir</button>
        </div>`;
      }).join('') + '</div>'}
      ${desplugadas.length ? `<div class="pt-2 border-t border-white/10">
        <p class="text-[10px] font-black text-red-300 uppercase mb-1">⚠️ Campanhas desplugadas (não alimentam o Mapa):</p>
        <div class="space-y-1">${desplugadas.map(c => `<div class="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-400/30">
          <span class="text-[11px] text-white truncate">${Utils.escape(c.name)}</span>
          <button onclick="Actions.activateStrategicMapForCampaign(${c.id})" class="px-2 py-0.5 rounded text-[10px] font-black bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 shrink-0">Ativar Mapa</button>
        </div>`).join('')}</div>
      </div>` : ''}
    </section>`;
  },

  _campaignView(product) {
    const stepId = StrategicZoomNavigation.current();
    // V32.5.2 (Leonardo) — Fade-in suave do step ao trocar (200ms). key= força
    // o navegador a recriar o elemento (e disparar a animação) quando step muda.
    return `<div class="space-y-4">
      ${this._stepper(product)}
      <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div class="space-y-4 min-w-0">
          <div class="lj-step-enter" data-step="${stepId}">
            ${this._stepContent(product, stepId)}
          </div>
        </div>
        ${this._djowSide(product, stepId)}
      </div>
    </div>`;
  },

  _stepper(product) {
    // V31.2.6 — Sem distinção CEO/Gestor. Stepper mostra progress REAL de cada
    // etapa (vision, objectives, okrs, campaign, operations, execution).
    //   - Demo: state seedado → tudo verdadeiramente concluído (sem hack all-true)
    //   - Master/production: progress real baseado nos dados
    const mode = App.state.strategicMapMode || 'product';
    const campaignId = App.state.strategicMapCampaignId;
    // Quando tem campaign selecionada usa progress por branch (cobre 6 etapas).
    // Sem campaign, usa progress do produto (cobre etapas 1-3 reais; 4-6 = false).
    const progress = (campaignId && StrategicMapEngine.journeyProgressForBranch)
      ? StrategicMapEngine.journeyProgressForBranch(product.id, campaignId)
      : StrategicMapEngine.journeyProgressForProduct(product.id);
    const current = StrategicZoomNavigation.current();
    // V31.1.1 — Stepper sticky no topo do container scrollable.
    // V32.5.2 (Leonardo) — Trilha que esquenta: cada step usa cor térmica
    // própria (violet→purple→fuchsia→pink→orange→amber). Concluído mantém
    // verde (sinal de feito), ativo intensifica a cor térmica (saturada + ring),
    // pendente mostra cor térmica SUTIL (10% opacity) — cliente vê de longe
    // a TRILHA esquentando até o dourado da Receita.
    return `<div class="rounded-3xl border border-white/10 p-3 sticky top-0 z-10" style="background: rgba(7, 19, 38, 0.92); backdrop-filter: blur(12px);">
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        ${StrategicZoomNavigation.LEVELS.map((level, i) => {
          const done = progress[level.id];
          const active = current === level.id;
          const t = level.thermal || 'indigo';
          let toneCls, numToneCls, labelColorCls;
          if (active) {
            // Ativo: cor térmica intensa + ring marcando posição.
            toneCls = `bg-${t}-500/25 border-${t}-400/60 ring-2 ring-${t}-400/30`;
            numToneCls = `bg-${t}-500 text-white`;
            labelColorCls = 'text-white';
          } else if (done) {
            // Concluído: verde (sinal universal de feito).
            toneCls = 'bg-emerald-500/15 border-emerald-400/30';
            numToneCls = 'bg-emerald-500 text-white';
            labelColorCls = 'text-emerald-100';
          } else {
            // Pendente: cor térmica SUTIL — vê de longe a trilha esquentando.
            toneCls = `bg-${t}-500/8 border-${t}-400/20 hover:bg-${t}-500/15`;
            numToneCls = `bg-${t}-500/30 text-${t}-100`;
            labelColorCls = `text-${t}-100`;
          }
          const subLabel = done ? 'Concluído' : active ? 'Em foco' : `Pendente · ${level.word || ''}`;
          return `<button onclick="Actions.setStrategicZoom('${level.id}')" title="${Utils.escape(level.description)}" class="text-left p-3 rounded-2xl border ${toneCls} transition flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-xl ${numToneCls} grid place-items-center font-black text-xs shrink-0">${done ? '✓' : (i + 1)}</div>
            <div class="min-w-0">
              <p class="text-[11px] font-black ${labelColorCls} truncate">${Utils.escape(level.short)}</p>
              <p class="text-[10px] text-slate-400 truncate">${subLabel}</p>
            </div>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  },

  _stepContent(product, stepId) {
    if (stepId === 'vision')     return this._stepVision(product);
    if (stepId === 'objectives') return this._stepObjectives(product);
    if (stepId === 'campaign')   return this._stepCampaign(product);
    if (stepId === 'okrs')       return this._stepOkrs(product);
    if (stepId === 'operations') return this._stepOperations(product);
    if (stepId === 'execution')  return this._stepExecution(product);
    return this._stepVision(product);
  },

  // V29.1.3 — "Executar Métricas" = publicar KRs-mãe pros gestores.
  // Se ainda não executado: botão dourado clicável.
  // Se já executado: botão cinza com selo "✓ Executado em DD/MM" (re-clicar abre popup pra re-publicar).
  _executeMetricsButton(opts) {
    const compact = opts && opts.compact;
    const productId = App.state.strategicMapProductId;
    const executedAt = window.StrategicMapEngine?.getMetricsExecutedAt ? StrategicMapEngine.getMetricsExecutedAt(productId) : null;
    if (executedAt) {
      const d = new Date(executedAt);
      const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      return `<button onclick="Actions.executeStrategicMetrics()" title="Métricas já publicadas. Clique pra re-publicar (sobrescreve)." class="px-${compact ? '3' : '5'} py-${compact ? '2.5' : '3'} rounded-${compact ? 'xl' : '2xl'} font-black flex items-center gap-${compact ? '1' : '2'} ${compact ? 'text-xs' : 'text-sm'}" style="background:rgba(16,185,129,.15); border:1px solid rgba(16,185,129,.4); color:#6ee7b7;"><i data-lucide="check-circle" class="w-${compact ? '3.5' : '4'} h-${compact ? '3.5' : '4'}"></i> Executado em ${dateStr}</button>`;
    }
    return `<button onclick="Actions.executeStrategicMetrics()" title="Publica as métricas pra os gestores começarem a plugar nas campanhas" class="px-${compact ? '3' : '5'} py-${compact ? '2.5' : '3'} rounded-${compact ? 'xl' : '2xl'} font-black flex items-center gap-${compact ? '1.5' : '2'} ${compact ? 'text-xs' : 'text-sm'} transition" style="background:linear-gradient(135deg, #fbbf24, #f59e0b); color:#1f2937!important; box-shadow: 0 4px 14px rgba(251,191,36,.35);"><i data-lucide="rocket" class="w-${compact ? '3.5' : '4'} h-${compact ? '3.5' : '4'}"></i> Executar Métricas</button>`;
  },

  _stepCta(label, enabled, currentStepId) {
    // V31.2.6 — Removida distinção CEO/Gestor + Executar Métricas + Continuar como Gestor.
    // V32.5.0 (Leonardo L4) — Disabled state ganha candeado + tooltip.
    // V32.5.2 (Leonardo) — CTA principal usa cor TÉRMICA da PRÓXIMA etapa
    // (esquentando conforme caminha pra Receita). Botão fantasma "← Rever"
    // ao lado do principal pra navegação simétrica (volta nunca foi
    // gesto natural antes). currentStepId opcional pra calcular vizinhos.
    const levels = StrategicZoomNavigation.LEVELS;
    const idx = currentStepId ? levels.findIndex(l => l.id === currentStepId) : -1;
    const nextLevel = idx >= 0 && idx < levels.length - 1 ? levels[idx + 1] : null;
    const prevLevel = idx > 0 ? levels[idx - 1] : null;
    const nextThermal = nextLevel?.thermal || 'indigo';

    const cls = enabled
      ? `bg-${nextThermal}-500 hover:bg-${nextThermal}-600 text-white cursor-pointer`
      : 'bg-white/5 text-slate-500 cursor-not-allowed';
    const icon = enabled ? 'arrow-right' : 'lock';
    // V32.5.5 — Tooltip dinâmico por step quando disabled. Antes era genérico
    // "Preencha o campo desta etapa" — pouco informativo. Agora cada etapa
    // explica o que falta.
    const disabledHints = {
      vision:     'Escreva o objetivo do produto em uma frase pra avançar',
      objectives: 'Defina o dono de cada uma das 3 frentes (Marketing, Vendas, CS)',
      okrs:       'Defina pelo menos 1 número em cada uma das 3 frentes (Marketing, Vendas e CS)',
      campaign:   'Selecione uma campanha acima clicando em "Seguir →"',
      operations: 'Conecte pelo menos 1 ação a um número pra colocar em campo',
      execution:  ''
    };
    const title = enabled ? '' : `title="${Utils.escape(disabledHints[currentStepId] || 'Complete esta etapa pra avançar')}"`;

    const reverBtn = prevLevel
      ? `<button onclick="Actions.setStrategicZoom('${prevLevel.id}')" title="Voltar pra ${Utils.escape(prevLevel.short)}" class="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-slate-200 text-[11px] font-bold flex items-center gap-1 transition"><i data-lucide="arrow-left" class="w-3 h-3"></i> Rever ${Utils.escape(prevLevel.short)}</button>`
      : '';

    return `<div class="flex justify-between items-center gap-2 pt-2 flex-wrap">
      <div>${reverBtn}</div>
      <button ${enabled ? '' : 'disabled'} ${title} onclick="Actions.advanceStrategicStep()" class="px-5 py-3 rounded-2xl ${cls} font-black flex items-center gap-2" ${enabled ? 'style="color:#fff!important;"' : ''}>${Utils.escape(label)} <i data-lucide="${icon}" class="w-4 h-4"></i></button>
    </div>`;
  },

  // -------------------- STEP 1: OBJETIVO DO PRODUTO --------------------
  // V28.1.0 — Vocabulário RevOps: foco é "produto" + ambição.
  // V31.2.6 — Sem bifurcação CEO/Gestor: sempre versão editável, mesmo dentro
  // de uma campanha. Visão é compartilhada pelo produto inteiro.
  _stepVision(product) {
    const map = StrategicMapEngine.getForProduct(product.id);
    const hasVision = Boolean(String(map.vision || '').trim());

    const exampleCacau = 'Ser o chocolate em barra preferido das famílias brasileiras até 2027.';
    const otherExamples = [
      'Ser o app que toda dona de pet abre antes de comprar ração',
      'Virar o café da manhã favorito de quem trabalha em escritório',
      'Ser o produto de credito que toda pequena empresa do bairro confia',
      'Ser a primeira opção de doce em casamento no Sul do país'
    ];

    return `<section class="space-y-4">
      ${this._stepIntro(
        'Qual é o objetivo comercial de seu produto nos próximos 12 meses?',
        'Uma frase só, ambiciosa, conectada ao que esse produto entrega.',
        'star',
        'vision',
        'vision-objetivo-comercial',
        'É a missão que a empresa dá para aquele produto específico para ajudar a ganhar dinheiro.'
      )}

      ${/* V32.5.3 — Felipe: card de exemplo + transição SEMPRE visíveis na
          etapa 1. Antes era condicionado a !hasVision — quando user digitava
          1 letra, a tela mudava (exemplo sumia). Sensação: a interface
          "engolia" o exemplo no meio do typing. Agora tela é estável: o
          cliente sempre tem a referência visível enquanto escreve. */ ''}
      <div class="rounded-3xl bg-violet-500/10 border border-violet-400/30 p-5">
        <div class="flex items-center gap-2 mb-3">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-500/30 text-violet-100">Exemplo de produto</span>
          <span class="text-[11px] text-slate-400">Pra você entender o formato — escreva o seu abaixo</span>
        </div>
        <p class="text-base text-white font-semibold leading-relaxed italic mb-3">"${Utils.escape(exampleCacau)}"</p>

        <div class="mt-4 pt-3 border-t border-white/10">
          <p class="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Outros exemplos pra leitura (não clicáveis):</p>
          <ul class="space-y-1">
            ${otherExamples.map(e => `<li class="text-[12px] text-slate-300">• ${Utils.escape(e)}</li>`).join('')}
          </ul>
        </div>
      </div>

      <p class="text-center text-[12px] text-slate-300 italic px-4">Agora, depois que você entendeu o conceito, escreva o objetivo do seu produto aqui ↓</p>

      <div class="rounded-3xl bg-white/[0.05] border border-white/10 p-5">
        <label class="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Objetivo do produto em uma frase</label>
        <textarea id="strategicVisionTextarea" oninput="Actions.updateStrategicVision(this.value)" placeholder="Tornar [esse produto] o(a) [posição] pra [público] até [horizonte]" class="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-white/15 text-white text-sm font-semibold min-h-[100px] placeholder:text-slate-500" style="color-scheme:dark;">${Utils.escape(map.vision || '')}</textarea>
        <p class="text-[11px] text-slate-400 mt-2">💡 Conecta o produto a quem ele serve. Esse objetivo norteia tudo: Marketing, Vendas e Sucesso do Cliente.</p>
      </div>

      ${this._stepCta('Próximo passo: definir o Comercial', hasVision, 'vision')}
    </section>`;
  },

  // -------------------- STEP 2: COMERCIAL --------------------
  // V28.1.0 — 3 cards fixos Marketing / Vendas / Sucesso do Cliente.
  // Sem wizard livre; cada card é um layer do funil com descrição minimalista
  // (RevOps) e edição inline de dono/prazo. Os números (KRs) entram na etapa 3.
  // V29.1.0 — Em mode='product', CEO edita só os DONOS compartilhados das 3 frentes
  // (areaOwners no produto). Cards mais simples, sem prazo/contador de números.
  // Em mode='campaign' mantém comportamento atual (donos herdados + override + prazo).
  _stepObjectives(product) {
    const mode = App.state.strategicMapMode || 'product';
    if (mode === 'product') {
      return this._stepObjectivesCEO(product);
    }
    const map = StrategicMapEngine.getForProduct(product.id);
    const objectives = map.objectives || [];
    const visionShort = (map.vision || '').length > 80 ? (map.vision || '').slice(0, 80) + '…' : (map.vision || '');
    const areasReady = (StrategicMapEngine.COMERCIAL_AREAS || []).every(a => objectives.some(o => o.area === a.id) || (StrategicMapEngine.getBranchMap(App.state.strategicMapCampaignId)?.objectives || []).some(o => o.area === a.id));

    return `<section class="space-y-4">
      ${this._stepIntro(
        'Como o Comercial se organiza pra realizar esse objetivo?',
        'Marketing, Vendas e Sucesso do Cliente. Defina o dono e o prazo de cada frente.',
        'flag',
        'objectives',
        'objectives-area-comercial',
        'Área Comercial é a área de contato com o cliente: gera o desejo, vende e cuida da entrega do produto prometido. Dentro dela existem 3 segmentos: Marketing (quem gera desejo), Vendas (quem fecha negócio) e Sucesso do Cliente (quem garante a entrega e fala tão bem com o cliente que ele pensa em comprar mais).'
      )}

      ${visionShort ? `<div class="rounded-xl bg-violet-500/10 border border-violet-400/20 px-3 py-2 text-[11px] text-slate-300">⭐ <b class="text-violet-200">Objetivo comercial do produto:</b> «${Utils.escape(visionShort)}»</div>` : ''}

      <div class="rounded-2xl bg-indigo-500/10 border border-indigo-400/25 p-3 text-[12px] text-indigo-100 leading-relaxed">
        <b class="text-indigo-200">Área Comercial no LeadJourney:</b> é onde a empresa toca o cliente — gera o desejo, vende e cuida da entrega do que foi prometido. Funciona como um funil de 3 segmentos:
        <span class="block mt-1.5">• <b class="text-sky-200">Marketing</b> gera desejo no público (transforma suspeito em lead).</span>
        <span class="block">• <b class="text-emerald-200">Vendas</b> fecha negócio (transforma lead em cliente).</span>
        <span class="block">• <b class="text-violet-200">Sucesso do Cliente</b> entrega o que foi prometido tão bem que o cliente quer comprar mais.</span>
      </div>

      <div class="grid lg:grid-cols-3 gap-3">
        ${(StrategicMapEngine.COMERCIAL_AREAS || []).map(area => this._comercialAreaCard(area, StrategicMapEngine.getObjectiveByArea(product.id, area.id))).join('')}
      </div>

      ${this._stepCta('Próximo passo: definir os números', areasReady)}
    </section>`;
  },

  // V28.1.0 — Card de uma frente comercial (Marketing/Vendas/CS).
  // Mostra descrição minimalista RevOps + dono/prazo editáveis + contador de números.
  _comercialAreaCard(area, objective) {
    // V29.0.1 — Owner agora vem prioritariamente do produto (compartilhado entre branches).
    // Branch override só se foi explicitamente setado no objective.owner.
    const productId = App.state.strategicMapProductId;
    const sharedOwner = window.StrategicMapEngine?.getAreaOwner ? StrategicMapEngine.getAreaOwner(productId, area.id) : '';
    const branchOwner = objective?.owner || '';
    const owner = branchOwner || sharedOwner;
    const ownerSource = branchOwner ? '(override desta campanha)' : (sharedOwner ? '(compartilhado do produto)' : '');
    const deadline = objective?.deadline || '';
    const okrCount = (objective?.okrs || []).length;
    const customLabel = objective?.label && objective.label !== area.label ? objective.label : '';
    const tone = area.color;
    return `<div class="rounded-3xl bg-white/[0.05] border border-${tone}-400/30 p-4 flex flex-col gap-3" style="min-height:280px;">
      <div class="flex items-center gap-2">
        <div class="w-9 h-9 rounded-xl bg-${tone}-500/20 grid place-items-center"><i data-lucide="${area.icon}" class="w-4 h-4 text-${tone}-200"></i></div>
        <div class="min-w-0">
          <p class="font-black text-white text-base leading-tight">${Utils.escape(area.label)}</p>
          ${customLabel ? `<p class="text-[10px] text-${tone}-200 truncate">${Utils.escape(customLabel)}</p>` : ''}
        </div>
      </div>

      <p class="text-[12px] text-slate-300 leading-relaxed flex-1">${Utils.escape(area.description)}</p>

      <div class="space-y-2 pt-2 border-t border-white/10">
        <div>
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Dono dessa frente ${ownerSource ? `<span class="text-[9px] font-normal text-slate-500">${ownerSource}</span>` : ''}</label>
          <input value="${Utils.escape(owner)}" oninput="Actions.updateStrategicAreaField('${area.id}', 'owner', this.value)" placeholder="Quem responde por essa frente?" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border ${branchOwner ? 'border-amber-400/40' : 'border-white/15'} text-white text-[12px] font-bold placeholder:text-slate-500" title="Edite na vista CEO pra mudar pra todas as branches do produto" />
        </div>
        <div>
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Prazo do ciclo</label>
          <div class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-white/15 text-white text-[12px] font-bold flex items-center gap-1.5"><i data-lucide="clock" class="w-3.5 h-3.5 text-slate-400"></i> 90 dias</div>
        </div>
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-white/10">
        <span class="text-[11px] text-slate-400 inline-flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-${tone}-400"></span> ${okrCount} número${okrCount === 1 ? '' : 's'} definido${okrCount === 1 ? '' : 's'}</span>
        <button onclick="Actions.setStrategicZoom('okrs')" class="px-2.5 py-1.5 rounded-lg bg-${tone}-500/20 hover:bg-${tone}-500/30 border border-${tone}-400/30 text-${tone}-100 text-[10px] font-black">Ver números →</button>
      </div>
    </div>`;
  },

  // -------------------- STEP 3: OS NÚMEROS --------------------
  // V28.2.0 — Catálogo guiado por segmento + handoff visual entre frentes.
  // Não pede pro user inventar números — ele ATIVA do catálogo curado e preenche meta.
  // V29.1.0 — Em mode='product': CEO edita productKrs via _productKrsBlock.
  // Em mode='campaign': Gestor vê os KRs-mãe read-only + banner pra ir pra etapa Campanha.
  _stepOkrs(product) {
    // V31.2.0 — Sempre versão editável (não há mais distinção CEO/Gestor).
    // V32.5.5 (Geraldo Opção A) — Agora exige PELO MENOS 1 KR em CADA uma
    // das 3 frentes (Marketing + Vendas + CS). Antes habilitava com qualquer
    // KR — cliente setava só Marketing, avançava, e ia descobrir na etapa 5
    // que não havia o que plugar em Vendas/CS. Funil RevOps por filosofia
    // exige cobertura completa. Falta de área é confrontada AGORA, não depois.
    const productKrs = StrategicMapEngine.getProductKrs(product.id);
    const orphans = StrategicMapEngine.getOrphanChildKrs ? StrategicMapEngine.getOrphanChildKrs(product.id) : [];
    const areas = StrategicMapEngine.COMERCIAL_AREAS || [];
    const missingAreas = areas.filter(a => !productKrs.some(k => k.area === a.id));
    const allAreasCovered = missingAreas.length === 0;
    return `<section class="space-y-4">
      ${this._stepIntro('Quais são os números deste produto?', 'Defina pelo menos 1 número em cada uma das 3 frentes: Marketing, Vendas e CS. Sem cobrir as 3, o funil fica manco.', 'target', null, 'okrs-kr-mae', 'O funil RevOps clássico é Marketing → Vendas → CS. Se você só seta números em Marketing, gera leads que ninguém recebe. Setar 1+ número em cada frente garante que a campanha tenha cobertura completa pra trabalhar.')}
      ${this._productKrsBlock(product, productKrs, orphans)}
      ${!allAreasCovered && productKrs.length > 0 ? `<div class="rounded-2xl bg-amber-500/10 border border-amber-400/30 p-3 text-[12px] text-amber-100 flex items-start gap-2">
        <i data-lucide="alert-triangle" class="w-3.5 h-3.5 mt-0.5 text-amber-300 shrink-0"></i>
        <span>Falta setar pelo menos 1 número em <b>${missingAreas.map(a => Utils.escape(a.label)).join('</b> e <b>')}</b> pra cobrir o funil completo.</span>
      </div>` : ''}
      ${this._stepCta('Próximo passo: escolher a campanha', allAreasCovered, 'okrs')}
    </section>`;
  },

  _stepOkrsReadOnly(product) {
    const productKrs = StrategicMapEngine.getProductKrs(product.id);
    const areas = StrategicMapEngine.COMERCIAL_AREAS || [];
    // V32.5.5 (Geraldo Opção A) — Mesma regra das 3 áreas obrigatórias.
    const missingAreas = areas.filter(a => !productKrs.some(k => k.area === a.id));
    const allAreasCovered = missingAreas.length === 0;
    return `<section class="space-y-4">
      ${this._stepIntro('Quais são os números deste produto?', 'Estes são os números que o CEO definiu. Para plugar à esta campanha, vá pra etapa Campanha (próxima).', 'target')}
      <div class="rounded-2xl bg-indigo-500/10 border border-indigo-400/30 p-3 text-[12px] text-indigo-100 flex items-start gap-2">
        <i data-lucide="lock" class="w-3.5 h-3.5 mt-0.5 text-indigo-300 shrink-0"></i>
        <span>🔒 <b>Definido pelo CEO</b> · Você só edita esta lista na vista CEO. Aqui você vê o que existe e na próxima etapa decide quais plugar à sua campanha.</span>
      </div>
      ${productKrs.length === 0 ? '<p class="text-[12px] text-amber-300 italic">⚠️ CEO ainda não definiu números pro produto. Peça pra ele preencher a etapa 3 da vista CEO.</p>' : ''}
      ${areas.map(area => {
        const areaKrs = productKrs.filter(k => k.area === area.id);
        if (!areaKrs.length) return '';
        return `<div class="rounded-2xl bg-${area.color}-500/5 border border-${area.color}-400/20 p-3 space-y-2">
          <p class="text-[10px] font-black text-${area.color}-200 uppercase tracking-wider"><i data-lucide="${area.icon}" class="w-3 h-3 inline-block"></i> ${Utils.escape(area.label)}</p>
          ${areaKrs.map(kr => `<div class="rounded-xl bg-slate-900/40 border border-${area.color}-400/20 p-2.5">
            <p class="font-black text-white text-[12px]">${Utils.escape(kr.name)}</p>
            <p class="text-[10px] text-slate-400 mt-0.5">Meta produto: <b class="text-${area.color}-200">${kr.targetCommitted || '—'}</b> ${kr.metric || ''} · período ${kr.period || 90}d</p>
          </div>`).join('')}
        </div>`;
      }).join('')}
      ${!allAreasCovered && productKrs.length > 0 ? `<div class="rounded-2xl bg-amber-500/10 border border-amber-400/30 p-3 text-[12px] text-amber-100 flex items-start gap-2">
        <i data-lucide="alert-triangle" class="w-3.5 h-3.5 mt-0.5 text-amber-300 shrink-0"></i>
        <span>CEO precisa setar pelo menos 1 número em <b>${missingAreas.map(a => Utils.escape(a.label)).join('</b> e <b>')}</b> pra cobrir o funil completo.</span>
      </div>` : ''}
      ${this._stepCta('Próximo passo: escolher a campanha', allAreasCovered, 'okrs')}
    </section>`;
  },

  _stepOkrsOriginal(product) {
    const map = StrategicMapEngine.getForProduct(product.id);
    const objectives = map.objectives || [];
    const totalOkrs = objectives.reduce((sum, o) => sum + (o.okrs?.length || 0), 0);
    if (!objectives.length) {
      return `<section class="space-y-3">
        ${this._stepIntro('Os números', 'Defina as frentes comerciais antes de medir.', 'target')}
        <div class="rounded-3xl bg-amber-500/10 border border-amber-400/30 p-5 text-amber-200">
          <p class="font-black mb-1">Volte um passo.</p>
          <p class="text-sm">As 3 frentes comerciais precisam estar prontas antes de você criar números.</p>
          <button onclick="Actions.setStrategicZoom('objectives')" class="mt-3 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-black">← Voltar para Comercial</button>
        </div>
      </section>`;
    }
    return `<section class="space-y-3">
      ${this._stepIntro(
        'Que números dizem se cada frente está performando?',
        'Ative 1 a 3 números por frente. Sugerimos os mais comuns — escolha os que fazem sentido pro seu produto.',
        'target',
        'keyresults',
        'okrs-numeros-handoff',
        'Pense nos números como o "entregável" de cada frente: Marketing entrega leads pra Vendas, Vendas entrega clientes pra CS, CS devolve advogados/indicações pro topo. Os números marcados com 🔁 são exatamente esse handoff.'
      )}

      ${this._handoffNav(product)}

      ${this._unpluggedParentKrsBanner(product)}

      <div class="space-y-3">
        ${this._activeAreaObjective(product, objectives) ? this._okrsObjectiveCard(product, this._activeAreaObjective(product, objectives)) : '<p class="text-[11px] text-slate-500 italic">Selecione uma frente acima.</p>'}
      </div>
      ${this._stepCta('Próximo passo: conectar à operação', totalOkrs > 0, 'okrs')}
    </section>`;
  },

  // V29.0.1 — Banner L (top-down): mostra KRs-mãe do CEO que ainda não foram
  // plugados nesta branch — gestor confirma se quer adicionar filho local.
  _unpluggedParentKrsBanner(product) {
    const campaignId = App.state.strategicMapCampaignId;
    if (!campaignId || !window.StrategicMapEngine?.getMissingChildrenInBranch) return '';
    const activeAreaId = this._activeAreaIdWithFallback(product.id);
    const missing = StrategicMapEngine.getMissingChildrenInBranch(product.id, campaignId)
      .filter(pkr => pkr.area === activeAreaId);
    if (!missing.length) return '';
    return `<div class="rounded-2xl bg-amber-500/10 border border-amber-400/40 p-3">
      <p class="text-[11px] font-black text-amber-200 uppercase tracking-wider mb-1.5">🔔 CEO criou KR(s)-mãe sem filho aqui</p>
      <p class="text-[12px] text-amber-100 mb-2 leading-relaxed">O CEO definiu números que esta campanha pode contribuir. Plugue se fizer sentido pra esta frente:</p>
      <div class="flex flex-wrap gap-1.5">
        ${missing.map(pkr => `<button onclick="Actions.plugProductKrIntoBranch('${pkr.id}')" class="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-100 text-[11px] font-bold">+ Plugar "${Utils.escape(pkr.name)}"</button>`).join('')}
      </div>
    </div>`;
  },

  // V28.2.3 — Determina qual área está ativa (state user OU próxima a confirmar OU marketing).
  // V32.13.0 — Suporta null (nenhuma frente selecionada — Etapa 5 stack vertical).
  // Etapas anteriores que usam fallback chamam `_activeAreaIdWithFallback`.
  _activeAreaId(productId) {
    const stored = App.state.strategicActiveArea;
    if (stored === null) return null;
    const valid = (StrategicMapEngine.COMERCIAL_AREAS || []).some(a => a.id === stored);
    if (valid) return stored;
    return null;  // V32.13.0: estado neutro válido
  },

  // Fallback pra etapas anteriores (Números, Comercial) que precisam de área sempre.
  _activeAreaIdWithFallback(productId) {
    const stored = this._activeAreaId(productId);
    if (stored) return stored;
    const next = StrategicMapEngine.nextUnconfirmedKr ? StrategicMapEngine.nextUnconfirmedKr(productId) : null;
    return next?.areaId || 'marketing';
  },

  _activeAreaObjective(product, objectives) {
    const areaId = this._activeAreaIdWithFallback(product.id);
    return objectives.find(o => o.area === areaId);
  },

  // V28.2.3 — Banner do handoff agora é navegação (3 abas clicáveis).
  // Substitui o _handoffBanner estático: cada frente vira tab, ativa fica destacada.
  _handoffNav(product) {
    const activeId = this._activeAreaIdWithFallback(product.id);
    const areas = StrategicMapEngine.COMERCIAL_AREAS || [];
    const handoffArrows = ['→', '→', '↩'];
    return `<div class="rounded-2xl bg-gradient-to-r from-pink-500/10 via-teal-500/10 to-sky-500/10 border border-white/10 p-2">
      <div class="grid grid-cols-3 gap-2">
        ${areas.map((area, i) => {
          const isActive = activeId === area.id;
          const objective = (StrategicMapEngine.getObjectiveByArea ? StrategicMapEngine.getObjectiveByArea(product.id, area.id) : null);
          const okrs = objective?.okrs || [];
          const confirmedCount = okrs.filter(k => k.confirmed).length;
          const totalCount = okrs.length;
          const stateLabel = !totalCount ? 'sem números ainda' : `${confirmedCount}/${totalCount} confirmado${confirmedCount === 1 ? '' : 's'}`;
          const baseCls = isActive
            ? `bg-${area.color}-500/20 border-${area.color}-400/60 ring-2 ring-${area.color}-400/40`
            : `bg-white/[0.03] border-white/10 hover:bg-white/[0.07]`;
          return `<button onclick="Actions.setStrategicActiveArea('${area.id}')" class="text-left p-2.5 rounded-xl border ${baseCls} transition flex flex-col items-center gap-1 cursor-pointer">
            <div class="w-7 h-7 rounded-full bg-${area.color}-500/30 grid place-items-center"><i data-lucide="${area.icon}" class="w-3.5 h-3.5 text-${area.color}-200"></i></div>
            <p class="font-black text-${area.color}-${isActive ? '100' : '200'} text-[12px]">${Utils.escape(area.label)}</p>
            <p class="text-[10px] text-slate-400">${area.id === 'cs' ? 'devolve <b>advogados</b>' : (area.id === 'marketing' ? 'entrega <b>leads</b>' : 'entrega <b>clientes</b>')} ${handoffArrows[i]}</p>
            <p class="text-[10px] ${isActive ? `text-${area.color}-200` : 'text-slate-500'} font-bold mt-0.5">${stateLabel}</p>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  },

  _okrsObjectiveCard(product, obj) {
    const okrs = obj.okrs || [];
    const draft = App.state.strategicOkrDraft;
    const isDraftHere = draft && draft.objectiveId === obj.id;
    const area = (StrategicMapEngine.COMERCIAL_AREAS || []).find(a => a.id === obj.area);
    const tone = area?.color || 'indigo';
    const headerLabel = area?.label || obj.label;
    const sub = area && obj.label && obj.label !== area.label ? Utils.escape(obj.label) : '';
    return `<div class="rounded-3xl bg-white/[0.05] border border-${tone}-400/30 p-4 space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex items-center gap-3">
          ${area ? `<div class="w-9 h-9 rounded-xl bg-${tone}-500/20 grid place-items-center shrink-0"><i data-lucide="${area.icon}" class="w-4 h-4 text-${tone}-200"></i></div>` : ''}
          <div class="min-w-0">
            <p class="font-black text-white">${Utils.escape(headerLabel)}</p>
            <p class="text-[11px] text-slate-400 mt-0.5">${sub ? `${sub} · ` : ''}${okrs.length} número(s) ativo(s)${area?.handoff ? ` · ${area.handoff}` : ''}</p>
          </div>
        </div>
      </div>

      <div class="space-y-2">
        ${okrs.length ? okrs.map(kr => this._numeroCard(product, obj, kr, tone)).join('') : '<p class="text-[11px] text-slate-500 italic">Sem números ativos. Ative algum do catálogo abaixo.</p>'}
      </div>

      ${area && !isDraftHere ? this._kpiCatalogStrip(product, area, obj) : ''}

      ${isDraftHere ? this._okrDraftCard(draft, product, /* hideConnect */ true) : ''}

      ${!isDraftHere && area ? `<div class="flex justify-end pt-2 border-t border-white/10">
        <button onclick="Actions.startStrategicOkrDraft('${obj.id}')" class="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 text-[11px] font-black flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i> Criar número customizado</button>
      </div>` : ''}
    </div>`;
  },

  // V28.2 — Strip do catálogo: mostra KPIs do segmento ainda não ativados.
  _kpiCatalogStrip(product, area, obj) {
    const catalog = (StrategicMapEngine.KPI_CATALOG || {})[area.id] || [];
    const activated = StrategicMapEngine.getActivatedCatalogIds(product.id, area.id);
    const available = catalog.filter(k => !activated.has(k.id));
    if (!available.length) {
      return `<div class="rounded-xl bg-${area.color}-500/5 border border-${area.color}-400/20 p-2.5 text-[11px] text-${area.color}-200 italic">Todos os números típicos de ${Utils.escape(area.label)} já estão ativos.</div>`;
    }
    return `<div class="rounded-xl bg-${area.color}-500/5 border border-${area.color}-400/20 p-3">
      <p class="text-[10px] font-black text-${area.color}-200 uppercase tracking-wider mb-2">Números típicos de ${Utils.escape(area.label)} — clique pra ativar</p>
      <div class="grid sm:grid-cols-2 gap-1.5">
        ${available.map(k => `<button onclick="Actions.activateStrategicKpi('${area.id}', '${k.id}')" title="${Utils.escape(k.description)}" class="text-left px-2.5 py-2 rounded-lg bg-slate-900/60 hover:bg-slate-800 border border-white/10 text-white text-[11px] font-bold flex items-start gap-1.5">
          ${k.handoff ? `<span class="shrink-0 text-amber-300 mt-px" title="Handoff: entrega pro próximo segmento">🔁</span>` : `<i data-lucide="plus" class="w-3 h-3 text-${area.color}-300 shrink-0 mt-px"></i>`}
          <span class="min-w-0">${Utils.escape(k.name)}<span class="block text-[10px] text-slate-400 font-normal mt-0.5">${Utils.escape(k.description)}</span></span>
        </button>`).join('')}
      </div>
    </div>`;
  },

  // V28.2.1 — Card de número totalmente reformulado.
  // - Atual começa vazio (placeholder 0, value="" se null)
  // - Meta Segura + Meta Avançada como 2 campos separados (não dropdown)
  // - Período via chips (7d/15d/30d/3m/6m), sem datepicker
  // - Aviso amarelo se Segura preenchida sem Avançada
  // - Botão Confirmar (só ativa quando os 4 campos estão preenchidos)
  // - Quando confirmed: collapsed read-only com botão Editar
  // - Ring colorido se for o próximo da fila de confirmação
  _numeroCard(product, obj, kr, tone) {
    const handoffBadge = kr.isHandoff
      ? `<span title="Handoff: entrega desse segmento pro próximo" class="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-200 border border-amber-400/30">🔁 HANDOFF</span>`
      : '';

    if (kr.confirmed) {
      return this._numeroCardConfirmed(obj, kr, tone, handoffBadge);
    }
    return this._numeroCardEditing(product, obj, kr, tone, handoffBadge);
  },

  _numeroCardConfirmed(obj, kr, tone, handoffBadge) {
    const progress = StrategicOkrEngine.progress(kr);
    const score = StrategicOkrEngine.score ? StrategicOkrEngine.score(kr) : 0;
    const scoreStatus = StrategicOkrEngine.scoreStatus ? StrategicOkrEngine.scoreStatus(kr) : { color: 'slate', label: '' };
    const periodLabel = this._periodLabel(kr.period);
    return `<div class="rounded-2xl bg-emerald-500/[0.05] border border-emerald-400/30 p-3">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 flex-wrap mb-1">
            <span class="text-emerald-300 font-black">✓</span>
            <p class="font-black text-white text-sm">${Utils.escape(kr.name)}</p>
            ${handoffBadge}
          </div>
          <p class="text-[11px] text-slate-300">
            Hoje <b class="text-white">${Number(kr.current ?? 0)}</b>
            · Segura <b class="text-emerald-300">${Number(kr.targetCommitted ?? 0)}</b>
            · Avançada <b class="text-violet-300">${Number(kr.targetStretch ?? 0)}</b>
            · em <b class="text-white">${periodLabel}</b>
          </p>
        </div>
        <div class="flex flex-col items-end gap-0.5 shrink-0">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-${scoreStatus.color}-500/20 text-${scoreStatus.color}-200 border border-${scoreStatus.color}-400/30 whitespace-nowrap" title="${Utils.escape(scoreStatus.label)}">${score.toFixed(2)}</span>
          <span class="text-[9px] text-slate-500">${progress}%</span>
        </div>
      </div>
      ${StrategicMapRenderer.progressBar(progress, scoreStatus.color)}
      <div class="flex justify-end gap-1 mt-2">
        <button onclick="Actions.editStrategicNumero('${obj.id}','${kr.id}')" class="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 text-[10px] font-black">Editar</button>
        <button onclick="Actions.removeStrategicOkr('${obj.id}','${kr.id}')" class="px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-400/30 text-red-300 text-[10px] font-black">Remover</button>
      </div>
    </div>`;
  },

  _numeroCardEditing(product, obj, kr, tone, handoffBadge) {
    const next = StrategicMapEngine.nextUnconfirmedKr(product.id);
    const isNext = next && next.krId === kr.id;
    const ringCls = isNext ? `ring-2 ring-${tone}-400 shadow-lg shadow-${tone}-500/20` : '';
    const desc = kr.catalogDescription ? `<p class="text-[10px] text-slate-400 italic mb-2">${Utils.escape(kr.catalogDescription)}</p>` : '';
    const hasSafe = Number(kr.targetCommitted ?? 0) > 0;
    const hasAdv = Number(kr.targetStretch ?? 0) > 0;
    const missingAdv = hasSafe && !hasAdv;
    const complete = StrategicOkrEngine.isComplete(kr);
    // V28.2.3 — Período Tático = 90d default + alternativas (30/60) com aviso do Djow.
    const currentPeriod = Number(kr.period) || 90;
    const warning = App.state.strategicPeriodWarning;
    const isWarningHere = warning && warning.krId === kr.id;

    return `<div class="rounded-2xl bg-black/30 border border-${tone}-400/20 p-3 ${ringCls}">
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 flex-wrap mb-1">
            ${isNext ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-${tone}-500/30 text-${tone}-100 border border-${tone}-400/40">PRÓXIMO</span>` : ''}
            <p class="font-black text-white text-sm">${Utils.escape(kr.name)}</p>
            ${handoffBadge}
          </div>
          ${desc}
        </div>
      </div>

      <div class="grid grid-cols-3 gap-1.5 mb-2">
        <label class="flex flex-col gap-0.5">
          <span class="text-[9px] font-black text-slate-500 uppercase">Atual</span>
          <input type="number" value="${kr.current ?? ''}" placeholder="0" onfocus="this.select()" oninput="Actions.updateStrategicOkrField('${obj.id}','${kr.id}','current', this.value)" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white text-[12px] font-bold w-full placeholder:text-slate-600" />
        </label>
        <label class="flex flex-col gap-0.5">
          <span class="text-[9px] font-black text-emerald-300 uppercase">🔒 Meta Segura</span>
          <input type="number" value="${kr.targetCommitted ?? ''}" placeholder="piso" onfocus="this.select()" oninput="Actions.updateStrategicOkrField('${obj.id}','${kr.id}','targetCommitted', this.value)" class="px-2 py-1.5 rounded-lg bg-slate-900 border ${hasSafe ? 'border-emerald-400/40' : 'border-white/10'} text-white text-[12px] font-bold w-full placeholder:text-slate-600" />
        </label>
        <label class="flex flex-col gap-0.5">
          <span class="text-[9px] font-black text-violet-300 uppercase">🚀 Meta Avançada</span>
          <input type="number" value="${kr.targetStretch ?? ''}" placeholder="sonho" onfocus="this.select()" oninput="Actions.updateStrategicOkrField('${obj.id}','${kr.id}','targetStretch', this.value)" class="px-2 py-1.5 rounded-lg bg-slate-900 border ${hasAdv ? 'border-violet-400/40' : (missingAdv ? 'border-amber-400/60' : 'border-white/10')} text-white text-[12px] font-bold w-full placeholder:text-slate-600" />
        </label>
      </div>

      ${missingAdv ? `<div class="rounded-lg bg-amber-500/10 border border-amber-400/30 p-2 text-[11px] text-amber-200 mb-2">⚠️ Você definiu a Meta Segura. Agora preencha a <b>Meta Avançada</b> — o sonho do time. Sem ela, o número fica só com o piso e perde a ambição.</div>` : ''}

      <div class="mb-2">
        <p class="text-[9px] font-black text-slate-500 uppercase mb-1">Período Tático</p>
        <div class="flex flex-wrap gap-1.5 items-center">
          <button onclick="Actions.tryChangeStrategicPeriod('${obj.id}','${kr.id}', 90)" class="px-3 py-1.5 rounded-lg border text-[11px] font-bold ${currentPeriod === 90 ? `bg-${tone}-500/30 border-${tone}-400/60 text-white` : 'bg-slate-900 border-white/15 text-slate-300 hover:bg-slate-800'}">90 dias — próximo trimestre</button>
          <span class="text-[10px] text-slate-500">ou</span>
          <button onclick="Actions.tryChangeStrategicPeriod('${obj.id}','${kr.id}', 30)" class="px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${currentPeriod === 30 ? `bg-${tone}-500/30 border-${tone}-400/60 text-white` : 'bg-slate-900 border-white/15 text-slate-400 hover:bg-slate-800'}">30 dias</button>
          <button onclick="Actions.tryChangeStrategicPeriod('${obj.id}','${kr.id}', 60)" class="px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${currentPeriod === 60 ? `bg-${tone}-500/30 border-${tone}-400/60 text-white` : 'bg-slate-900 border-white/15 text-slate-400 hover:bg-slate-800'}">60 dias</button>
        </div>
        <p class="text-[11px] text-slate-400 mt-2 leading-relaxed">💡 <b class="text-slate-200">Por que 90 dias?</b> Em um trimestre você vê resultado real (não só promessa), e ainda dá tempo de corrigir rota antes de gastar o ano inteiro num caminho errado. No fim do período, você decide: manter, ajustar ou trocar o número.</p>
        ${isWarningHere ? this._djowPeriodWarning(obj, kr, warning.attemptedDays) : ''}
      </div>

      <div class="flex justify-between items-center pt-2 border-t border-white/10">
        <button onclick="Actions.removeStrategicOkr('${obj.id}','${kr.id}')" class="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-400/30 text-red-300 text-[10px] font-black">Remover</button>
        <button onclick="Actions.confirmStrategicNumero('${obj.id}','${kr.id}')" ${complete ? '' : 'disabled'} class="px-3 py-1.5 rounded-lg ${complete ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'} text-[11px] font-black" ${complete ? 'style="color:#fff!important;"' : ''}>✓ Confirmar número →</button>
      </div>
    </div>`;
  },

  _periodLabel(days) {
    // V28.2.2 — Periodo Tatico = 90d. Outros valores ficam como fallback pra dados legados.
    const map = { 7: '7 dias', 15: '15 dias', 30: '30 dias', 60: '60 dias', 90: '90 dias (1 trimestre)', 180: '6 meses' };
    return map[Number(days)] || (days ? `${days} dias` : 'sem período');
  },

  // V28.2.3 — Balão do Djow quando user tenta mudar pra 30 ou 60 dias.
  // Conciso, pragmático, Doerr-aligned sem nominar Doerr.
  _djowPeriodWarning(obj, kr, attemptedDays) {
    const texts = {
      30: `<b class="text-amber-200">30 dias é tempo de sprint, não de medir uma frente comercial.</b> Você vê movimento, mas não sabe se sustenta — pode ser sorte de uma semana. E te força a parar todo mês pra revisar com pouco dado, o que cansa o time e gera ajuste em cima de ruído.<br><br><b class="text-slate-200">Sugestão:</b> deixa em 90. Se você bater a meta antes, ganha tempo de sobra pro próximo ciclo.`,
      60: `<b class="text-amber-200">60 dias é o pior dos mundos.</b> Curto demais pra você ter certeza (dados ainda voláteis), e longo demais pra ser sprint operacional. Você chega ao fim do período ainda em dúvida se o número realmente move.<br><br><b class="text-slate-200">Sugestão:</b> os 30 dias extras do trimestre eliminam essa zona cinzenta — você sai do "parece que funciona" pro "tenho certeza".`
    };
    const txt = texts[attemptedDays] || texts[30];
    return `<div class="mt-3 rounded-2xl bg-amber-500/[0.08] border border-amber-400/40 p-3">
      <div class="flex items-start gap-2 mb-2">
        <div class="w-7 h-7 rounded-full bg-violet-500/30 grid place-items-center shrink-0"><i data-lucide="sparkles" class="w-3.5 h-3.5 text-violet-200"></i></div>
        <div class="min-w-0">
          <p class="text-[10px] font-black text-violet-200 uppercase tracking-wider">Djow alerta</p>
          <p class="text-[11px] text-slate-200 leading-relaxed mt-1">${txt}</p>
        </div>
      </div>
      <div class="flex justify-end gap-1.5 mt-2">
        <button onclick="Actions.confirmStrategicPeriodChange('${obj.id}','${kr.id}')" class="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 text-[10px] font-black">Sei o que faço · manter ${attemptedDays} dias</button>
        <button onclick="Actions.dismissStrategicPeriodWarning('${obj.id}','${kr.id}')" class="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black" style="color:#fff!important;">✓ Voltar pra 90 dias</button>
      </div>
    </div>`;
  },

  _okrDraftCard(draft, product, hideConnect) {
    // V28.0.0 — Wizard didático de 7 substeps, uma pergunta por vez.
    // Substitui o form denso anterior que confundia o user.
    const step = Number(draft.wizardStep || 1);
    const actions = StrategicFlowBridge.actionsForProduct(product.id);
    const unitOptions = [
      { v: 'quantidade', l: 'Quantidade (unidades)' },
      { v: 'reais', l: 'R$ (Reais)' },
      { v: 'percentual', l: '% (Porcentagem)' },
      { v: 'dias', l: 'Dias / horas' },
      { v: 'pontuacao', l: 'Pontuação (NPS, CSAT)' },
      { v: 'outra', l: 'Outra' }
    ];
    const tipo = draft.commitmentType === 'committed' ? 'committed' : 'stretch';
    const stepTitles = [
      'Pergunta 1 de 7: O que medir',
      'Pergunta 2 de 7: Em que unidade',
      'Pergunta 3 de 7: Valor atual',
      'Pergunta 4 de 7: Onde quer chegar',
      'Pergunta 5 de 7: Tipo de meta',
      'Pergunta 6 de 7: Dono e impacto',
      'Pergunta 7 de 7: Confere'
    ];

    return `<div class="rounded-3xl bg-emerald-500/10 border border-emerald-400/30 p-5 space-y-4">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <i data-lucide="target" class="w-4 h-4 text-emerald-200"></i>
          <p class="text-xs font-black text-emerald-200 uppercase tracking-wider">Novo número · ${stepTitles[step - 1]}</p>
        </div>
        <button onclick="Actions.cancelStrategicOkrDraft()" class="text-slate-400 hover:text-white text-xs font-black">✕ Cancelar</button>
      </div>

      ${step === 1 ? `
        <div>
          <label class="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Qual número descreve essa batalha?</label>
          <input value="${Utils.escape(draft.name || '')}" oninput="Actions.updateStrategicOkrDraft('name', this.value)" placeholder="Ex: Lojas abertas no ano" class="w-full px-3 py-3 rounded-xl bg-slate-900 border border-white/15 text-white text-base font-bold placeholder:text-slate-500" />
          <p class="text-[11px] text-slate-400 mt-2">💡 Pode ser uma métrica que vc já acompanha, ou uma nova que quer começar a medir.</p>
          <div class="mt-3 flex flex-wrap gap-1.5">
            ${['Lojas abertas no ano', 'Cidades atendidas', 'Vendas no horário do almoço (%)', 'Frequência de compra por cliente'].map(ex => `<button onclick="Actions.updateStrategicOkrDraft('name', ${JSON.stringify(ex).replace(/"/g, '&quot;')}); App.render();" class="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-400/20 text-emerald-200 text-[10px] font-bold">${Utils.escape(ex)}</button>`).join('')}
          </div>
        </div>
      ` : step === 2 ? `
        <div>
          <label class="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Em que unidade esse número é contado?</label>
          <div class="grid grid-cols-2 gap-2">
            ${unitOptions.map(u => `<button onclick="Actions.updateStrategicOkrDraft('metric', '${u.v}'); App.render();" class="px-3 py-3 rounded-xl border text-left ${draft.metric === u.v ? 'bg-emerald-500/20 border-emerald-400/50 text-white' : 'bg-slate-900 border-white/15 text-slate-300 hover:bg-slate-800'} text-sm font-bold">${u.l}</button>`).join('')}
          </div>
          <p class="text-[11px] text-slate-400 mt-2">💡 Só pra UI saber como mostrar o número.</p>
        </div>
      ` : step === 3 ? `
        <div>
          <label class="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Qual é o valor atual desse número hoje?</label>
          <input type="number" value="${Number(draft.current || 0)}" oninput="Actions.updateStrategicOkrDraft('current', Number(this.value || 0)); Actions.updateStrategicOkrDraft('startValue', Number(this.value || 0));" class="w-full px-3 py-3 rounded-xl bg-slate-900 border border-white/15 text-white text-2xl font-black" />
          <p class="text-[11px] text-slate-400 mt-2">💡 Se não souber exato, chuta — dá pra ajustar depois. Sem ponto de partida, não dá pra mostrar progresso.</p>
        </div>
      ` : step === 4 ? `
        <div>
          <label class="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">E aonde você quer chegar até <b class="text-emerald-300">${draft.deadline || '<defina o prazo>'}</b>?</label>
          <input type="number" value="${Number(draft.target || 0)}" oninput="Actions.updateStrategicOkrDraft('target', Number(this.value || 0))" class="w-full px-3 py-3 rounded-xl bg-slate-900 border border-white/15 text-white text-2xl font-black" />
          <div class="mt-2 flex gap-1.5">
            <span class="text-[11px] text-slate-400 self-center">Atalhos:</span>
            <button onclick="Actions.updateStrategicOkrDraft('target', (Number(App.state.strategicOkrDraft.current||0))*2); App.render();" class="px-2 py-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-400/30 text-violet-200 text-[10px] font-bold">2x</button>
            <button onclick="Actions.updateStrategicOkrDraft('target', (Number(App.state.strategicOkrDraft.current||0))*3); App.render();" class="px-2 py-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-400/30 text-violet-200 text-[10px] font-bold">3x</button>
            <button onclick="Actions.updateStrategicOkrDraft('target', Math.round(Number(App.state.strategicOkrDraft.current||0)*1.5)); App.render();" class="px-2 py-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-400/30 text-violet-200 text-[10px] font-bold">+50%</button>
          </div>
          <input type="date" value="${Utils.escape(draft.deadline || '')}" oninput="Actions.updateStrategicOkrDraft('deadline', this.value)" class="mt-3 w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-bold" style="color-scheme:dark;" placeholder="Prazo" />
          <p class="text-[11px] text-slate-400 mt-2">💡 Esse é o destino. Pensa grande mas com pé no chão.</p>
        </div>
      ` : step === 5 ? `
        <div>
          <label class="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3">Esse número é uma Meta Avançada ou Meta Segura?</label>
          <div class="grid md:grid-cols-2 gap-3">
            <button onclick="Actions.updateStrategicOkrDraft('commitmentType', 'stretch'); App.render();" class="text-left p-4 rounded-2xl border ${tipo === 'stretch' ? 'bg-violet-500/20 border-violet-400/60 ring-2 ring-violet-400/40' : 'bg-slate-900/80 border-white/15 hover:bg-slate-800'}">
              <div class="flex items-center gap-2 mb-2"><i data-lucide="rocket" class="w-4 h-4 text-violet-300"></i><p class="font-black text-violet-200">🚀 Meta Avançada</p></div>
              <p class="text-[12px] text-slate-300 mb-2">É o sonho grande que faz o time brilhar o olho. Não precisa ser realista — precisa engajar.</p>
              <p class="text-[12px] text-slate-300 mb-2">Aposta em mercados novos, canais que ainda não domina.</p>
              <p class="text-[11px] text-violet-300 font-black">🎯 Vitória = 70% do alvo</p>
            </button>
            <button onclick="Actions.updateStrategicOkrDraft('commitmentType', 'committed'); App.render();" class="text-left p-4 rounded-2xl border ${tipo === 'committed' ? 'bg-emerald-500/20 border-emerald-400/60 ring-2 ring-emerald-400/40' : 'bg-slate-900/80 border-white/15 hover:bg-slate-800'}">
              <div class="flex items-center gap-2 mb-2"><i data-lucide="lock" class="w-4 h-4 text-emerald-300"></i><p class="font-black text-emerald-200">🔒 Meta Segura</p></div>
              <p class="text-[12px] text-slate-300 mb-2">É o que vc PRECISA entregar, sem desculpa. Foca nos canais que já domina.</p>
              <p class="text-[12px] text-slate-300 mb-2">SLAs, contratos, faturamento mínimo, retenção.</p>
              <p class="text-[11px] text-emerald-300 font-black">🎯 Vitória = bater 100% do alvo</p>
            </button>
          </div>
        </div>
      ` : step === 6 ? `
        <div class="space-y-3">
          <div>
            <label class="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Quem é o dono desse número?</label>
            <input value="${Utils.escape(draft.owner || '')}" oninput="Actions.updateStrategicOkrDraft('owner', this.value)" placeholder="Ex: Maria, Time de Marketing" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-bold" />
          </div>
          <div>
            <label class="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Qual o impacto se bater? <span class="text-slate-500 font-normal">(opcional)</span></label>
            <textarea oninput="Actions.updateStrategicOkrDraft('impact', this.value)" placeholder="O que muda no negócio?" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-semibold min-h-[60px]">${Utils.escape(draft.impact || '')}</textarea>
            <p class="text-[11px] text-slate-400 mt-1">💡 Pula se quiser, dá pra preencher depois.</p>
          </div>
        </div>
      ` : `
        <div>
          <p class="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3">Confere se ficou bom:</p>
          <div class="rounded-2xl bg-slate-900/60 border border-emerald-400/30 p-4 space-y-2">
            <p class="font-black text-white text-base">${Utils.escape(draft.name || 'Sem nome')}</p>
            <p class="text-sm text-slate-300">De <b class="text-white">${Number(draft.startValue || draft.current || 0)}</b> → <b class="text-emerald-300">${Number(draft.target || 0)}</b> ${Utils.escape(draft.metric || '')}${draft.deadline ? ` até <b class="text-white">${Utils.escape(draft.deadline)}</b>` : ''}</p>
            <p class="text-[11px]">${tipo === 'stretch' ? '<span class="px-2 py-0.5 rounded bg-violet-500/20 text-violet-200">🚀 Meta Avançada · 70% = vitória</span>' : '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200">🔒 Meta Segura · precisa 100%</span>'}</p>
            ${draft.owner ? `<p class="text-[11px] text-slate-400">Dono: <b class="text-slate-200">${Utils.escape(draft.owner)}</b></p>` : ''}
            ${draft.impact ? `<p class="text-[11px] text-slate-400 italic">"${Utils.escape(draft.impact)}"</p>` : ''}
          </div>
        </div>
      `}

      <div class="flex justify-between gap-2 pt-2 border-t border-white/10">
        ${step > 1 ? `<button onclick="Actions.prevStrategicOkrStep()" class="px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-white text-xs font-black">← Voltar</button>` : '<div></div>'}
        ${step < 7 ? `<button onclick="Actions.nextStrategicOkrStep()" ${step === 1 && !String(draft.name || '').trim() ? 'disabled' : ''} class="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 text-white text-xs font-black" style="color:#fff!important;">Próximo →</button>` : `<button onclick="Actions.saveStrategicOkrDraft()" class="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black" style="color:#fff!important;">✓ Salvar número</button>`}
      </div>
    </div>`;
  },

  // V29.1.0 — Etapa Comercial na vista CEO. Define donos compartilhados das 3 frentes.
  _stepObjectivesCEO(product) {
    const areas = StrategicMapEngine.COMERCIAL_AREAS || [];
    const map = StrategicMapEngine.getForProduct(product.id);
    const visionShort = (map.vision || '').length > 80 ? (map.vision || '').slice(0, 80) + '…' : (map.vision || '');
    const allHaveOwners = areas.every(a => String(StrategicMapEngine.getAreaOwner(product.id, a.id) || '').trim());
    return `<section class="space-y-4">
      ${this._stepIntro(
        'Quem responde por cada frente comercial?',
        'Define o dono de Marketing, Vendas e Sucesso do Cliente. Esses donos cuidam de TODAS as campanhas do produto.',
        'flag',
        'objectives',
        'objectives-area-comercial',
        'Área Comercial é onde a empresa toca o cliente: Marketing gera desejo, Vendas fecha, CS entrega. O dono de cada frente é o mesmo independente de quantas campanhas o produto tenha — quem cuida do Marketing cuida de todas as campanhas do produto.'
      )}
      ${visionShort ? `<div class="rounded-xl bg-violet-500/10 border border-violet-400/20 px-3 py-2 text-[11px] text-slate-300">⭐ <b class="text-violet-200">Objetivo:</b> «${Utils.escape(visionShort)}»</div>` : ''}
      <div class="grid lg:grid-cols-3 gap-3">
        ${areas.map(area => {
          const owner = StrategicMapEngine.getAreaOwner(product.id, area.id) || '';
          const tone = area.color;
          return `<div class="rounded-3xl bg-white/[0.05] border border-${tone}-400/30 p-4 flex flex-col gap-3" style="min-height:240px;">
            <div class="flex items-center gap-2">
              <div class="w-9 h-9 rounded-xl bg-${tone}-500/20 grid place-items-center"><i data-lucide="${area.icon}" class="w-4 h-4 text-${tone}-200"></i></div>
              <p class="font-black text-white text-base leading-tight">${Utils.escape(area.label)}</p>
            </div>
            <p class="text-[12px] text-slate-300 leading-relaxed flex-1">${Utils.escape(area.description)}</p>
            <div class="pt-2 border-t border-white/10">
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Dono desta frente (compartilhado entre todas as campanhas)</label>
              <input value="${Utils.escape(owner)}" oninput="Actions.setStrategicAreaOwner(${product.id}, '${area.id}', this.value)" placeholder="Quem responde por essa frente?" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-${tone}-400/40 text-white text-[12px] font-bold placeholder:text-slate-500" />
            </div>
          </div>`;
        }).join('')}
      </div>
      ${this._stepCta('Próximo passo: os números do produto', allHaveOwners, 'objectives')}
    </section>`;
  },

  // -------------------- STEP 4: CAMPANHA (NOVA V29.1.0) --------------------
  // Onde o gestor pluga KRs-mãe do produto na campanha (cria KRs-filhos com meta).
  // CEO vê locked com banner explicando.
  _stepCampaign(product) {
    // V31.2.6 — Sem bifurcação CEO/Gestor. Sempre renderiza o hub.
    return this._stepCampaignHub(product);
  },

  // V29.2.0 — Hub: lista TODAS as campanhas do produto. Gestor seleciona uma
  // e clica "Seguir →" pra ir pra etapa 5 (trabalho unificado: plugar + ações).
  _stepCampaignHub(product) {
    const productKrs = StrategicMapEngine.getProductKrs(product.id);
    const branches = StrategicMapEngine.getBranchesByProduct(product.id);
    const desplugadas = StrategicMapEngine.getDesplugedCampaigns(product.id);
    const activeCampaignId = App.state.strategicMapCampaignId;

    if (!productKrs.length) {
      return `<section class="space-y-4">
        ${this._stepIntro('Campanha', 'Selecione a campanha pra trabalhar.', 'git-branch')}
        <div class="rounded-3xl bg-amber-500/10 border border-amber-400/30 p-5 text-amber-200">
          <p class="font-black mb-1">⚠️ CEO ainda não definiu os números do produto.</p>
          <p class="text-sm">Peça pro CEO preencher a etapa 3 (Os Números) na vista CEO. Sem KRs-mãe, a campanha não tem o que contribuir.</p>
          <button onclick="Actions.openStrategicMap(${product.id})" class="mt-3 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-black">Ir pra vista CEO</button>
        </div>
      </section>`;
    }

    // V31.1.1 — Título com nome do produto + subtitle único com bolinha roxa.
    const totalCampanhas = branches.length + desplugadas.length;
    return `<section class="space-y-4">
      ${this._stepIntro(
        `Em qual campanha do produto ${product.name} quer trabalhar agora?`,
        '',
        'git-branch',
        'campaign',
        'campaign-hub',
        'Cada campanha é uma APOSTA diferente pra entregar os números do produto. Várias campanhas podem rodar ao mesmo tempo, cada uma contribuindo um pedaço (rollup). Selecione uma aqui e siga pra etapa 5 onde você pluga os números e ativa as ações.'
      )}
      ${(() => {
        // V32.5.0 (Geraldo G3) — Removido vermelho. Desplugada é escolha do
        // gestor (não rastrear por mapa) — não é erro. Tom neutro slate.
        return `<div class="rounded-xl bg-violet-500/10 border border-violet-400/25 px-3 py-2 text-[12px] text-violet-100 inline-flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-violet-400"></span>
          <span><b>${totalCampanhas}</b> campanha(s) mapeada(s), sendo <b class="text-emerald-200">${branches.length}</b> plugada(s) e <b class="text-slate-300">${desplugadas.length}</b> não rastreada(s)</span>
        </div>`;
      })()}

      ${branches.length > 0 ? `<div class="space-y-2">
        ${branches.map(b => this._campaignHubCard(product, b)).join('')}
      </div>` : ''}

      ${desplugadas.length > 0 ? `<div class="space-y-2 pt-2">
        ${desplugadas.map(c => this._campaignHubDesplugadaCard(product, c)).join('')}
      </div>` : ''}

      <div class="rounded-2xl border border-dashed border-emerald-400/30 bg-emerald-500/5 p-3 flex items-center justify-between gap-2">
        <p class="text-[12px] text-emerald-200"><b>+</b> Quer rodar uma campanha nova pra cobrir esses números?</p>
        <button onclick="Actions.unlockCeoAsGestor()" class="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-black" style="color:#fff!important;">+ Criar nova campanha</button>
      </div>

      ${/* V32.5.2 (Leonardo) — Guia visual quando user procura "Próximo passo"
          mas não acha (a etapa 4 só avança via "Seguir" nos cards de campanha). */ ''}
      <div class="flex justify-between items-center gap-2 pt-2 flex-wrap">
        <button onclick="Actions.setStrategicZoom('okrs')" title="Voltar pra Números" class="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-slate-200 text-[11px] font-bold flex items-center gap-1 transition"><i data-lucide="arrow-left" class="w-3 h-3"></i> Rever Números</button>
        <p class="text-[11px] text-slate-400 italic flex items-center gap-1.5"><i data-lucide="arrow-up" class="w-3 h-3"></i> Clique <b class="text-pink-200">"Seguir →"</b> em uma campanha acima pra continuar</p>
      </div>
    </section>`;
  },

  _campaignHubCard(product, branch) {
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(branch.campaignId));
    if (!campaign) return '';
    const status = StrategicMapEngine.getCampaignStrategicStatus(branch.campaignId);
    const statusInfo = { active: { color: 'emerald', label: 'Ativa', icon: 'check-circle' }, configuring: { color: 'amber', label: 'Em config', icon: 'loader' } }[status] || { color: 'slate', label: 'Pendente', icon: 'clock' };
    const productKrs = StrategicMapEngine.getProductKrs(product.id);
    const allBranchKrs = (branch.objectives || []).flatMap(o => o.okrs || []);
    const pluggedCount = allBranchKrs.filter(k => k.parentProductKrId).length;
    const actionsCount = (App.state.actions || []).filter(a => Number(a.campaignId) === Number(branch.campaignId) && a.strategicAreaId).length;
    const isActive = Number(App.state.strategicMapCampaignId) === Number(branch.campaignId);
    return `<div class="rounded-2xl bg-white/[0.05] border ${isActive ? 'border-violet-400/60 ring-2 ring-violet-400/20' : `border-${statusInfo.color}-400/30`} p-3 flex items-center justify-between gap-3">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 mb-0.5 flex-wrap">
          <p class="font-black text-white text-sm truncate">${Utils.escape(campaign.name)}</p>
          <span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-${statusInfo.color}-500/20 text-${statusInfo.color}-200 border border-${statusInfo.color}-400/30">${statusInfo.label.toUpperCase()}</span>
          ${isActive ? '<span class="text-[10px] text-violet-200 font-bold">· editando agora</span>' : ''}
        </div>
        <p class="text-[11px] text-slate-400">${pluggedCount}/${productKrs.length} números plugados · ${actionsCount} ação(ões) ativa(s)</p>
      </div>
      <button onclick="Actions.selectAndAdvanceCampaign(${branch.campaignId})" class="px-3 py-2 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-[11px] font-black flex items-center gap-1 shrink-0" style="color:#fff!important;">Seguir <i data-lucide="arrow-right" class="w-3 h-3"></i></button>
    </div>`;
  },

  _campaignHubDesplugadaCard(product, campaign) {
    // V32.5.0 (Geraldo G3) — Removido vermelho. Desplugada é estado neutro
    // (gestor escolheu não rastrear via mapa). Tom slate informativo.
    return `<div class="rounded-2xl bg-slate-500/5 border border-slate-400/25 p-3 flex items-center justify-between gap-3">
      <div class="min-w-0 flex-1">
        <p class="font-black text-white text-sm truncate">${Utils.escape(campaign.name)}</p>
        <p class="text-[11px] text-slate-400">📋 Não rastreada por mapa — pode ativar quando quiser contribuir pros números.</p>
      </div>
      <button onclick="Actions.activateStrategicMapForCampaign(${campaign.id})" class="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/20 text-slate-200 text-[11px] font-black flex items-center gap-1 shrink-0">Ativar Mapa</button>
    </div>`;
  },

  _anyPluggedInBranch(productId, campaignId) {
    const branch = StrategicMapEngine.getBranchMap(campaignId);
    if (!branch) return false;
    return (branch.objectives || []).some(o => (o.okrs || []).some(kr => kr.parentProductKrId));
  },

  _stepCampaignAreaBlock(product, area, areaKrs, campaignId) {
    const tone = area.color;
    const branch = StrategicMapEngine.getBranchMap(campaignId);
    const branchObjective = (branch?.objectives || []).find(o => o.area === area.id);
    const branchKrs = branchObjective?.okrs || [];
    const pluggedKrsByParent = new Map();
    branchKrs.forEach(kr => { if (kr.parentProductKrId) pluggedKrsByParent.set(kr.parentProductKrId, kr); });

    if (areaKrs.length === 0) {
      return `<div class="rounded-2xl bg-${tone}-500/5 border border-${tone}-400/20 p-3">
        <p class="text-[10px] font-black text-${tone}-200 uppercase tracking-wider mb-1"><i data-lucide="${area.icon}" class="w-3 h-3 inline-block"></i> ${Utils.escape(area.label)}</p>
        <p class="text-[11px] text-slate-500 italic">CEO não definiu números nesta área.</p>
      </div>`;
    }
    return `<div class="rounded-2xl bg-${tone}-500/5 border border-${tone}-400/20 p-3 space-y-2">
      <p class="text-[10px] font-black text-${tone}-200 uppercase tracking-wider"><i data-lucide="${area.icon}" class="w-3 h-3 inline-block"></i> ${Utils.escape(area.label)} · ${pluggedKrsByParent.size}/${areaKrs.length} plugado(s)</p>
      ${areaKrs.map(pkr => {
        const pluggedKr = pluggedKrsByParent.get(pkr.id);
        if (pluggedKr) return this._stepCampaignPluggedCard(branchObjective, pluggedKr, pkr, tone);
        return this._stepCampaignNotPluggedCard(pkr, tone);
      }).join('')}
    </div>`;
  },

  _stepCampaignNotPluggedCard(pkr, tone) {
    const targetSummary = pkr.targetCommitted ? `meta produto: <b>${pkr.targetCommitted}</b> ${pkr.metric}` : 'meta produto pendente';
    return `<div class="rounded-xl bg-slate-900/40 border border-${tone}-400/20 p-2.5 flex items-center justify-between gap-2">
      <div class="min-w-0">
        <p class="font-black text-white text-[12px]">${Utils.escape(pkr.name)}</p>
        <p class="text-[10px] text-slate-400">${targetSummary}</p>
      </div>
      <button onclick="Actions.plugProductKrIntoBranch('${pkr.id}')" class="px-2.5 py-1 rounded-lg bg-${tone}-500/20 hover:bg-${tone}-500/30 border border-${tone}-400/40 text-${tone}-100 text-[10px] font-black shrink-0">+ Plugar nesta campanha</button>
    </div>`;
  },

  _stepCampaignPluggedCard(objective, kr, pkr, tone) {
    return `<div class="rounded-xl bg-emerald-500/[0.06] border border-emerald-400/30 p-2.5">
      <div class="flex items-start justify-between gap-2 mb-1.5">
        <div class="min-w-0">
          <p class="font-black text-white text-[12px]"><span class="text-emerald-300">✓ plugado</span> · ${Utils.escape(kr.name)}</p>
          <p class="text-[10px] text-slate-400">Meta produto: <b>${pkr.targetCommitted || '—'}</b> ${kr.metric || ''} · Sua contribuição abaixo</p>
        </div>
        <button onclick="Actions.removeStrategicOkr('${objective.id}','${kr.id}')" title="Despluga" class="px-1.5 py-0.5 rounded text-[10px] text-red-300 hover:bg-red-500/20 border border-red-400/30 shrink-0">×</button>
      </div>
      <div class="grid grid-cols-2 gap-1.5">
        <label class="flex flex-col gap-0.5">
          <span class="text-[9px] font-black text-emerald-300 uppercase">🔒 Meta Segura</span>
          <input type="number" value="${kr.targetCommitted ?? ''}" placeholder="piso" oninput="Actions.updateStrategicOkrField('${objective.id}','${kr.id}','targetCommitted', this.value)" class="px-2 py-1 rounded bg-slate-900 border border-white/10 text-white text-[11px] font-bold" />
        </label>
        <label class="flex flex-col gap-0.5">
          <span class="text-[9px] font-black text-violet-300 uppercase">🚀 Meta Avançada</span>
          <input type="number" value="${kr.targetStretch ?? ''}" placeholder="sonho" oninput="Actions.updateStrategicOkrField('${objective.id}','${kr.id}','targetStretch', this.value)" class="px-2 py-1 rounded bg-slate-900 border border-white/10 text-white text-[11px] font-bold" />
        </label>
      </div>
    </div>`;
  },

  // V29.1.1 — Placeholder pras etapas 5/6 quando o CEO clica (mode='product').
  // Não bloqueia, só mostra que essa etapa é do gestor + link pra ver o consolidado.
  _stepGestorOnlyPlaceholder(product, stepName, stepIcon, description) {
    const branches = StrategicMapEngine.getBranchesByProduct ? StrategicMapEngine.getBranchesByProduct(product.id) : [];
    return `<section class="space-y-4">
      ${this._stepIntro(stepName, description, stepIcon)}
      <div class="rounded-3xl bg-indigo-500/10 border border-indigo-400/30 p-5 space-y-3">
        <p class="text-sm text-slate-200 leading-relaxed">🔒 <b class="text-indigo-200">Etapa do Gestor</b></p>
        <p class="text-[13px] text-slate-300 leading-relaxed">Essa etapa é preenchida pelo gestor de cada campanha. Você (CEO) vê o resultado consolidado em <b class="text-amber-300">Executar Métricas</b> (botão dourado no topo) ou abrindo a campanha desejada abaixo.</p>
        ${branches.length ? `<div class="pt-2 border-t border-white/10">
          <p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider mb-2">Branches ativas:</p>
          <div class="flex flex-wrap gap-2">
            ${branches.map(b => {
              const c = (App.state.campaigns || []).find(c => Number(c.id) === Number(b.campaignId));
              if (!c) return '';
              return `<button onclick="Actions.openStrategicMapForCampaign(${b.campaignId})" class="px-3 py-1.5 rounded-lg bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/40 text-violet-100 text-[11px] font-black">${Utils.escape(c.name)} →</button>`;
            }).join('')}
          </div>
        </div>` : '<p class="text-[12px] text-slate-400 italic">Nenhuma campanha plugada ainda.</p>'}
      </div>
      <div class="flex justify-end items-center gap-2 pt-2 flex-wrap">
        ${this._executeMetricsButton()}
      </div>
    </section>`;
  },

  // -------------------- STEP 5: AS AÇÕES --------------------
  // V28.3.0 — Mesmo padrão didático das etapas anteriores: tabs Mkt/Vendas/CS,
  // catálogo curado de ações típicas por segmento, vínculo automático aos
  // números pelo catalogId, edição inline (dono/cadência/status), aviso de
  // número órfão (sem ação).
  _stepOperations(product) {
    // V31.2.6 — Sem bifurcação CEO/Gestor. Sempre renderiza versão completa.
    // V29.2.0 — Trabalho unificado: plugar números + ativar ações que cobrem.
    const productKrs = StrategicMapEngine.getProductKrs(product.id);
    const campaignId = App.state.strategicMapCampaignId;
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    const areas = StrategicMapEngine.COMERCIAL_AREAS || [];
    if (!productKrs.length) {
      return `<section class="space-y-3">
        ${this._stepIntro('As ações', 'CEO ainda não definiu os números do produto.', 'plug')}
        <div class="rounded-3xl bg-amber-500/10 border border-amber-400/30 p-5 text-amber-200">
          <p class="font-black mb-1">⚠️ Sem números do produto.</p>
          <p class="text-sm">Peça pro CEO preencher a etapa 3 (Os Números) na vista CEO. Sem KRs-mãe, sua campanha não tem o que cobrir.</p>
        </div>
      </section>`;
    }
    // V32.13.0 — Stack vertical das 3 frentes em vez de tabs horizontais.
    // V32.13.17 — Auto-sync silencioso ClickUp ao entrar (1× por 5min por
    // campanha) + botão visível "Sincronizar do ClickUp" quando há tasks.
    if (window.Actions?._autoSyncClickupTasksOnce) {
      Actions._autoSyncClickupTasksOnce(`mapa-etapa5-${campaignId}`);
    }
    // Conta tasks ClickUp pra decidir se mostra botão de sync
    const clickupTaskCount = window.ExecutionTaskStore
      ? (ExecutionTaskStore.all() || []).filter(t => t.provider === 'clickup' && t.provider_task_id).length
      : 0;
    // V32.14.8 — Timestamp da última sync ClickUp ao lado do botão.
    const lastSyncAt = App.state.clickupLastSyncAt;
    let lastSyncLabel = '';
    if (lastSyncAt) {
      const minsAgo = Math.floor((Date.now() - lastSyncAt) / 60000);
      lastSyncLabel = minsAgo < 1 ? '· há segundos' : minsAgo < 60 ? `· há ${minsAgo}min` : `· há ${Math.floor(minsAgo / 60)}h`;
    }
    const syncBtn = (clickupTaskCount > 0 && App.state.clickupStatus?.connected) ? `
      <div class="flex justify-end mb-2">
        <button onclick="Actions.syncClickupTaskStatuses(false)" title="Atualizar status das ${clickupTaskCount} task(s) ClickUp"
          class="px-3 py-2 rounded-xl bg-violet-500/15 hover:bg-violet-500/30 border border-violet-400/40 text-violet-200 text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
          <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Sincronizar ${clickupTaskCount} task${clickupTaskCount === 1 ? '' : 's'} do ClickUp
          ${lastSyncLabel ? `<span class="text-violet-300/70 font-normal normal-case ml-1">${lastSyncLabel}</span>` : ''}
        </button>
      </div>` : '';

    return `<section class="space-y-3">
      ${this._stepIntro(
        `Como você vai cobrir os números em ${Utils.escape(campaign?.name || 'sua campanha')}?`,
        'Pra cada número que o CEO definiu, você decide se esta campanha contribui. Plugando, define meta local e ativa as ações que vão cobrir.',
        'plug',
        'operations',
        'operations-unified',
        'Plugar = sua campanha contribui pra esse número (cria meta local). Ativar ação = roda uma tática (Tráfego Pago, Webinar, etc.) que move esse número. A soma das metas locais de todas as campanhas plugadas alimenta o número-mãe do produto via rollup.'
      )}

      ${this._unifiedWorkCampaignHeader(product, campaign)}

      ${syncBtn}

      ${this._frenteStackVertical(product, productKrs, campaignId)}

      ${this._stepCta('Próximo passo: colocar em campo', this._anyActionConnectedInBranch(campaignId), 'operations')}
    </section>`;
  },

  // V32.13.3 — Híbrido: 3 frentes empilhadas verticalmente. Cada uma pode
  // ficar em 3 estados:
  //   - neutral (nenhuma ativa): cards compactos lado a lado, sem ações.
  //   - active: ocupa todo espaço com mind-map horizontal expandido (master
  //     à esquerda + ações ramificadas à direita em flex-wrap).
  //   - fade: opacity-40 + pointer-events-none, compacto sem ações visíveis.
  // Click no master toggla. Re-click na mesma volta neutro.
  // V32.13.14 — Microcopy CTA proeminente no topo quando nenhuma frente
  // selecionada, pra usuário saber que precisa clicar pra abrir árvore.
  _frenteStackVertical(product, productKrs, campaignId) {
    const areas = StrategicMapEngine.COMERCIAL_AREAS || [];
    const activeId = this._activeAreaId(product.id);  // null se neutro
    const anyActive = activeId !== null;
    // V32.14.8 — CTA discreto (sem gradient pesado) quando neutro.
    const ctaHint = !anyActive ? `<div class="rounded-xl bg-slate-900/40 border border-l-4 border-l-violet-500 border-white/5 px-3 py-2 flex items-center gap-2 mb-3">
      <i data-lucide="mouse-pointer-click" class="w-3.5 h-3.5 text-violet-300 shrink-0"></i>
      <p class="text-[11px] text-slate-300">Clique numa frente abaixo pra montar a árvore de ações.</p>
    </div>` : '';
    return `<div>
      ${ctaHint}
      <div class="space-y-3">
        ${areas.map(area => {
          const isActive = activeId === area.id;
          const isFade = anyActive && !isActive;
          return this._frenteMindMapRow(product, area, productKrs, campaignId, isActive, isFade);
        }).join('')}
      </div>
    </div>`;
  },

  // V32.13.5 — Felipe alinhou: master continua compacto quando ativo (sem
  // expansão grande). Botão "Add Ação" é um nó intermediário SEPARADO,
  // conectado ao master por linha. Ações ramificam do Add Ação (não do master).
  //
  //   [Master] ──► [+ Add Ação] ──┬──► [ação1]
  //                                ├──► [ação2]
  //                                └──► [ação3]
  _frenteMindMapRow(product, area, productKrs, campaignId, isActive, isFade) {
    const tone = area.color;
    const objective = (StrategicMapEngine.getObjectiveByArea ? StrategicMapEngine.getObjectiveByArea(product.id, area.id) : null);
    const okrs = objective?.okrs || [];
    const confirmedCount = okrs.filter(k => k.confirmed).length;
    const totalCount = okrs.length;
    const stateLabel = !totalCount ? 'sem números ainda' : `${confirmedCount}/${totalCount} confirmado${confirmedCount === 1 ? '' : 's'}`;
    const handoffHint = area.id === 'cs' ? 'devolve <b>advogados</b> ↺'
                     : area.id === 'marketing' ? 'entrega <b>leads</b> →'
                     : 'entrega <b>clientes</b> →';

    // Wrapper só pra fade quando outra está ativa. Sem ring/bg destacado pesado.
    const wrapperCls = isFade
      ? `opacity-40 pointer-events-none transition-opacity duration-300`
      : '';

    // Master card — SEMPRE COMPACTO. Felipe alinhou (V32.13.10): quando ativo,
    // o master e o Add Ação ficam ANEXADOS (mesmo bloco, divisória vertical
    // entre os dois). Sem conector/seta entre eles.
    const masterBorderCls = isActive
      ? `bg-${tone}-500/10 border-${tone}-400/40`
      : `bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-${tone}-400/30 cursor-pointer transition`;

    // Estado neutro/fade: master sozinho (sem Add Ação anexado).
    // V32.13.14: cards neutros (não-fade) ganham hint inline "Clique pra abrir
    // árvore →" pra deixar claro que a interação primária é clicar no card.
    // Hover state reforçado: ring + scale leve.
    if (!isActive) {
      const isNeutralClickable = !isFade;
      const enhancedHover = isNeutralClickable
        ? `bg-white/[0.04] border-${tone}-400/20 hover:bg-${tone}-500/10 hover:border-${tone}-400/50 hover:ring-2 hover:ring-${tone}-400/30 hover:scale-[1.005] cursor-pointer transition`
        : masterBorderCls;
      const wrapperClsNeutral = isNeutralClickable ? enhancedHover : masterBorderCls;
      const clickHint = isNeutralClickable
        ? `<span class="hidden md:inline-flex shrink-0 ml-auto items-center gap-1 px-2 py-1 rounded-md bg-${tone}-500/15 border border-${tone}-400/30 text-${tone}-200 text-[10px] font-black uppercase tracking-wider">
            Abrir árvore <i data-lucide="arrow-right" class="w-3 h-3"></i>
          </span>`
        : '';
      const masterCardSolo = `<button ${isFade ? 'tabindex="-1"' : ''} onclick="Actions.setStrategicActiveArea('${area.id}')"
        class="w-full text-left rounded-2xl border p-3 ${wrapperClsNeutral} ${isFade ? 'cursor-not-allowed' : ''}">
        <div class="flex items-center gap-2.5">
          <span class="shrink-0 w-10 h-10 rounded-xl bg-${tone}-500/25 grid place-items-center">
            <i data-lucide="${area.icon}" class="w-4 h-4 text-${tone}-200"></i>
          </span>
          <div class="min-w-0">
            <p class="text-[10px] font-black text-${tone}-200 uppercase tracking-widest">${Utils.escape(area.label)}</p>
            <p class="text-[10px] text-slate-400 mt-0.5">${handoffHint}</p>
            <p class="text-[10px] text-slate-500 font-bold mt-0.5">${stateLabel}</p>
          </div>
          ${clickHint}
        </div>
      </button>`;
      return `<div class="${wrapperCls}">${masterCardSolo}</div>`;
    }

    // ATIVA: Master + Add Ação ANEXADOS num único bloco (divisória vertical).
    const actions = this._actionsForFrente(area.id, campaignId);
    const hue = this._hslHueForArea(tone);

    // Bloco anexado: master (área principal) + Add Ação (tira lateral direita).
    // Borda externa única envolve os dois; divisória interna vertical separa.
    // V32.14.9 — Felipe: self-center pra alinhar com setas/cards laterais
    // (era self-start, ficava encostado no topo e visualmente desbalanceado).
    const masterPlusAdd = `<div class="shrink-0 self-center flex rounded-2xl overflow-hidden border ${masterBorderCls}">
      <!-- Master (esquerda, principal) -->
      <button onclick="Actions.setStrategicActiveArea('${area.id}')"
        class="w-64 text-left p-3 hover:bg-${tone}-500/15 transition">
        <div class="flex items-center gap-2.5">
          <span class="shrink-0 w-10 h-10 rounded-xl bg-${tone}-500/25 grid place-items-center">
            <i data-lucide="${area.icon}" class="w-4 h-4 text-${tone}-200"></i>
          </span>
          <div class="min-w-0">
            <p class="text-[10px] font-black text-${tone}-200 uppercase tracking-widest">${Utils.escape(area.label)} <span class="text-${tone}-100">· Ativo</span></p>
            <p class="text-[10px] text-slate-400 mt-0.5">${handoffHint}</p>
            <p class="text-[10px] text-${tone}-200 font-bold mt-0.5">${stateLabel}</p>
          </div>
        </div>
      </button>
      <!-- Divisória vertical -->
      <div class="self-stretch w-px bg-${tone}-400/40"></div>
      <!-- Add Ação (direita, tira lateral) -->
      <button onclick="event.stopPropagation(); Actions.openStrategicKrPicker('${area.id}')"
        title="Adicionar ação à árvore desta frente"
        class="self-stretch px-4 bg-${tone}-500/20 hover:bg-${tone}-500/40 text-${tone}-100 text-[11px] font-black uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition" style="min-width:96px;">
        <i data-lucide="plus" class="w-4 h-4"></i>
        <span class="text-[10px] leading-tight text-center">Add<br/>Ação</span>
      </button>
    </div>`;

    // V32.13.11 — Felipe alinhou: setas "vindas do nada" sem tronco que ligue
    // ao Add Ação. Agora há um TRONCO VERTICAL colorido (16px largura) entre
    // o bloco master+Add e as setas individuais. Visualmente lê-se: bloco
    // saída → tronco vertical → galhos individuais coloridos por KR → cards.
    // Também agrupa ações do mesmo KR (gap-1 dentro, gap-3 entre grupos).
    let actionsBlock;
    if (actions.length === 0) {
      actionsBlock = `${this._mindMapConnectorSVG(`hsl(${hue} 50% 50% / 0.5)`, 30)}
        <p class="text-[11px] text-slate-500 italic self-center ml-2">Nenhuma ação ainda — clique no botão pra criar a primeira.</p>`;
    } else {
      // Agrupa por primaryKrId (cores juntas) — Gestalt de proximidade
      const groups = {};
      const order = [];
      actions.forEach(a => {
        const k = a.primaryKrId || '__none__';
        if (!groups[k]) { groups[k] = []; order.push(k); }
        groups[k].push(a);
      });
      // Tronco vertical conectando Add Ação às setas individuais
      const truncoVertical = `<div class="shrink-0 self-stretch flex flex-col items-center" style="width:16px;">
        <span class="block w-0.5 h-full lj-mind-map-connector" style="background:linear-gradient(to bottom, hsla(${hue},60%,55%,0.3) 0%, hsla(${hue},65%,60%,0.7) 50%, hsla(${hue},60%,55%,0.3) 100%);"></span>
      </div>`;
      // Renderiza grupos com gap maior entre grupos diferentes
      const groupBlocks = order.map(krId => {
        const group = groups[krId];
        return `<div class="flex flex-col gap-1">
          ${group.map(a => this._actionMindMapNodeWithConnector(a, area, productKrs, hue)).join('')}
        </div>`;
      }).join('');
      actionsBlock = `${truncoVertical}<div class="flex flex-col gap-3 self-center">${groupBlocks}</div>`;
    }

    return `<div class="${wrapperCls}">
      <div class="flex items-stretch gap-0 flex-wrap">
        ${masterPlusAdd}
        ${actionsBlock}
      </div>
    </div>`;
  },

  // V32.13.7/8 — Wrapper de cada ação no mind-map: SVG com seta individual à
  // esquerda (cor do KR da própria ação) + card. Setas independentes pra cada
  // ação, criando visual de árvore com galhos próprios + ponta de flecha.
  _actionMindMapNodeWithConnector(actionMeta, area, productKrs, fallbackHue) {
    const { primaryKrId } = actionMeta;
    const krColor = primaryKrId ? StrategicMapEngine.krColorFromId(primaryKrId) : `hsl(${fallbackHue} 60% 55%)`;
    return `<div class="flex items-stretch shrink-0">
      ${this._mindMapConnectorSVG(krColor, 30)}
      ${this._actionMindMapCard(actionMeta, area, productKrs)}
    </div>`;
  },

  // V32.13.8 — SVG inline com seta (ponta de flecha) pra conectores do mind-map.
  // Cor controlável via param. Linha + marker triangular no fim.
  // Stroke-dasharray + dashoffset animado pra efeito de "fluxo desenhando".
  _mindMapConnectorSVG(color, width = 30) {
    const markerId = `lj-arrow-${Math.random().toString(36).slice(2, 8)}`;
    const lineY = 8;
    const lineEnd = width - 6;  // deixa espaço pra ponta
    return `<div class="shrink-0 self-center flex items-center" style="width:${width}px;height:16px;">
      <svg width="${width}" height="16" viewBox="0 0 ${width} 16" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;">
        <defs>
          <marker id="${markerId}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/>
          </marker>
        </defs>
        <line x1="0" y1="${lineY}" x2="${lineEnd}" y2="${lineY}"
          stroke="${color}" stroke-width="2" stroke-linecap="round"
          marker-end="url(#${markerId})"
          class="lj-mind-map-svg-line"
          style="stroke-dasharray:${width};stroke-dashoffset:0;" />
      </svg>
    </div>`;
  },

  // V32.13.5 — Helper: hue numérico (0-360) por tone da área, pra gradientes
  // de conector. Mantém consistência com COMERCIAL_AREAS color.
  _hslHueForArea(toneName) {
    return ({
      pink:   330,
      teal:   175,
      sky:    200,
      violet: 270,
      emerald: 145,
      amber:  35,
      rose:   355
    })[toneName] || 220;
  },

  // V32.13.2 — Coleta ações desta frente nesta campanha, retorna ORDENADAS
  // por KR principal (cores juntas adjacentes). Cada ação leva metadata:
  // { action, primaryKrId, krColor, status }.
  _actionsForFrente(areaId, campaignId) {
    const allActions = (App.state.actions || []).filter(a =>
      Number(a.campaignId) === Number(campaignId) && a.strategicAreaId === areaId
    );
    // Mapa actionId → primaryKrId (1º KR conectado via branchKrs)
    const branch = StrategicMapEngine.getBranchMap(campaignId);
    const branchObj = (branch?.objectives || []).find(o => o.area === areaId);
    const branchKrs = branchObj?.okrs || [];
    const actionPrimaryKr = new Map();
    branchKrs.forEach(kr => {
      (kr.connectedActionIds || []).forEach(aid => {
        if (!actionPrimaryKr.has(Number(aid))) {
          actionPrimaryKr.set(Number(aid), kr.parentProductKrId || kr.id);
        }
      });
    });
    const decorated = allActions.map(a => {
      const primaryKrId = actionPrimaryKr.get(Number(a.id)) || null;
      return { action: a, primaryKrId };
    });
    // Sort: por primaryKrId pra agrupar cores adjacentes; sem KR vai pro fim.
    decorated.sort((x, y) => {
      if (!x.primaryKrId && !y.primaryKrId) return 0;
      if (!x.primaryKrId) return 1;
      if (!y.primaryKrId) return -1;
      return String(x.primaryKrId).localeCompare(String(y.primaryKrId));
    });
    return decorated;
  },

  // V32.13.2 / V32.13.6 / V32.13.11 / V32.13.12 — Card da ação no mind-map.
  // V32.13.12: click abre _mindMapActionEditor (Print 1 Felipe), não mais o
  // ActionEditModal genérico. Quando ação completa (verde/OK), card ganha
  // botão "Executar Ação" amber anexado à direita (igual master+Add Ação).
  _actionMindMapCard({ action, primaryKrId }, area, productKrs) {
    const krColor = primaryKrId ? StrategicMapEngine.krColorFromId(primaryKrId) : 'hsl(0 0% 50%)';
    const kr = primaryKrId ? productKrs.find(k => k.id === primaryKrId) : null;
    const krLabel = kr ? kr.name : 'Sem KR';
    // V32.13.13 — Regra estrita: ação só é "completa" (mostra botão Executar
    // Ação amber) quando TODOS os campos do modal de edição estão preenchidos.
    // Frouxo antes (só name+channel+type) deixava stubs herdados com defaults
    // parciais aparecerem como completos. Agora exige também funnel + dest.
    const hasName = String(action.name || '').trim().length > 0;
    const hasChannel = String(action.channel || '').trim().length > 0;
    const hasType = String(action.actionType || '').trim().length > 0;
    const hasFunnel = String(action.funnelPoint || '').trim().length > 0;
    const hasDestSector = String(action.destSector || '').trim().length > 0;
    const hasDestFunnel = String(action.destFunnelPoint || '').trim().length > 0;
    const isComplete = hasName && hasChannel && hasType && hasFunnel && hasDestSector && hasDestFunnel;
    const statusIcon = isComplete ? 'check-circle-2' : 'alert-triangle';
    const statusPillCls = isComplete
      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
      : 'bg-amber-500/15 border-amber-400/40 text-amber-300';
    const statusLabel = isComplete ? 'OK' : 'Pendente';
    const borderStatus = isComplete ? 'border-emerald-400/60' : 'border-amber-400/60';
    const isJustCreated = Number(App.state.strategicJustCreatedActionId) === Number(action.id);
    const animCls = isJustCreated ? 'lj-mind-map-action-enter' : '';
    const displayName = hasName ? action.name : 'Qual o nome da ação?';
    const nameCls = hasName ? 'text-white' : 'text-amber-200 italic';

    // V32.13.12 — Card sozinho (incompleto) ou Card + Executar Ação (completo)
    const cardInner = `<div class="flex items-center justify-between gap-2 mb-2">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="shrink-0 w-2 h-2 rounded-full" style="background:${krColor};"></span>
          <p class="text-[9px] font-black uppercase tracking-widest truncate" style="color:${krColor};" title="${Utils.escape(krLabel)}">${Utils.escape(krLabel)}</p>
        </div>
        <span class="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${statusPillCls}">
          <i data-lucide="${statusIcon}" class="w-2.5 h-2.5"></i>
          ${statusLabel}
        </span>
      </div>
      <p class="text-[13px] font-black leading-snug line-clamp-2 mb-1.5 ${nameCls}" title="${Utils.escape(displayName)}">${Utils.escape(displayName)}</p>
      <p class="text-[10px] text-slate-500 truncate">${Utils.escape(action.channel || '— canal —')}</p>`;

    const cardButton = `<button onclick="Actions.openMindMapActionEditor(${action.id})"
      title="Clique pra editar esta ação"
      class="w-48 text-left bg-slate-900/60 border-2 ${borderStatus} p-3 hover:bg-slate-800 transition group ${isComplete ? 'rounded-l-xl border-r-0' : 'rounded-xl hover:scale-[1.02] hover:shadow-lg'} ${animCls}"
      style="border-left: 4px solid ${krColor};">
      ${cardInner}
    </button>`;

    if (!isComplete) {
      return cardButton;
    }

    // V32.14.9 — Botão Executar Ação: gradient agora sai de TRANSPARENTE
    // (lado do card emerald) → amber dourado. Era from-emerald-500/15 que
    // criava uma mancha verde acidental. Transparent deixa o amber "emergir".
    const executeBtn = `<button onclick="Actions.executeStrategicAction(${action.id})"
      title="Executar ação no provider operacional (ClickUp/Trello/etc)"
      class="self-stretch px-3 rounded-r-xl border-2 border-l-0 border-amber-400/60 bg-gradient-to-r from-transparent via-amber-500/25 to-amber-500/45 hover:from-amber-500/10 hover:via-amber-500/40 hover:to-amber-500/60 text-amber-100 text-[10px] font-black uppercase tracking-wider flex flex-col items-center justify-center gap-1 transition" style="min-width:64px;">
      <i data-lucide="play" class="w-3.5 h-3.5"></i>
      <span class="text-[9px] leading-tight text-center">Executar<br/>Ação</span>
    </button>`;

    // V32.13.15 / V32.14.7 — Branch de execuções: tasks criadas no ClickUp pra
    // esta ação. Felipe alinhou: cada task ramifica DA AÇÃO (não em cadeia
    // horizontal). Então as tasks ficam empilhadas verticalmente, cada uma
    // com sua própria seta saindo do botão Executar Ação.
    const executionTasks = window.ExecutionTaskStore ? ExecutionTaskStore.byAction(action.id) : [];
    const executionBranch = executionTasks.length > 0
      ? `<div class="flex flex-col gap-2 self-center">
          ${executionTasks.map(t => this._executionBranchRender([t])).join('')}
        </div>`
      : '';

    return `<div class="flex items-stretch ${animCls.replace('lj-mind-map-action-enter', '')}">
      ${cardButton}
      ${executeBtn}
      ${executionBranch}
    </div>`;
  },

  // V32.13.15 — Renderiza tasks de execução (ClickUp/Trello/etc) saindo do
  // botão Executar Ação. Cada task = card compacto amber com nome + provider
  // + status + link externo. Conectada por seta SVG amber.
  _executionBranchRender(tasks) {
    const statusColorMap = {
      pending:     { bg: 'bg-amber-500/15',   border: 'border-amber-400/40',   text: 'text-amber-200',   label: 'Pendente',   icon: 'circle' },
      in_progress: { bg: 'bg-sky-500/15',     border: 'border-sky-400/40',     text: 'text-sky-200',     label: 'Em curso',   icon: 'loader' },
      review:      { bg: 'bg-orange-500/15',  border: 'border-orange-400/40',  text: 'text-orange-200',  label: 'Em revisão', icon: 'eye' },
      completed:   { bg: 'bg-emerald-500/15', border: 'border-emerald-400/40', text: 'text-emerald-200', label: 'Feita',      icon: 'check-circle-2' },
      blocked:     { bg: 'bg-rose-500/15',    border: 'border-rose-400/40',    text: 'text-rose-200',    label: 'Bloqueada',  icon: 'x-circle' }
    };
    const providerIconMap = { clickup: 'check-square', trello: 'trello', manual: 'list' };
    return tasks.map(task => {
      const status = statusColorMap[task.status] || statusColorMap.pending;
      const providerIcon = providerIconMap[task.provider] || 'briefcase';
      return `<div class="flex items-stretch shrink-0">
        ${this._mindMapConnectorSVG('hsl(35 90% 60%)', 24)}
        <button onclick="Actions.openExecutionTaskDetail('${task.task_id}')" title="Ver detalhe da task no ${task.provider || 'provider'}"
          class="w-44 text-left rounded-l-xl border-r-0 bg-slate-900/60 border-2 ${status.border} p-2.5 hover:bg-slate-800 transition group"
          style="border-left: 4px solid hsl(35 90% 60%);">
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <span class="inline-flex items-center gap-1 text-[9px] font-black text-amber-300 uppercase tracking-widest">
              <i data-lucide="${providerIcon}" class="w-2.5 h-2.5"></i>
              ${Utils.escape((task.provider || 'task').toUpperCase())}
            </span>
            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${status.bg} ${status.border} ${status.text}">
              <i data-lucide="${status.icon}" class="w-2.5 h-2.5"></i>
              ${status.label}
            </span>
          </div>
          <p class="text-[12px] font-black text-white leading-snug line-clamp-2" title="${Utils.escape(task.title || '')}">${Utils.escape(task.title || 'Task sem nome')}</p>
          ${task.external_url ? `<p class="text-[9px] text-sky-400 mt-1 inline-flex items-center gap-1"><i data-lucide="external-link" class="w-2.5 h-2.5"></i> Ver detalhe</p>` : ''}
        </button>
        <!-- V32.14.6 / V32.14.8 — Botões Editar/Duplicar compactos (só ícone).
             Leonardo: economizar largura, evitar 3 elementos volumosos lado a lado. -->
        <button onclick="Actions.openTaskCreationModal(${task.linked_action_id}, '${task.task_id}')" title="Editar esta task"
          class="self-stretch w-8 border-t-2 border-b-2 ${status.border} bg-violet-500/15 hover:bg-violet-500/40 text-violet-200 grid place-items-center transition">
          <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
        </button>
        <button onclick="Actions.duplicateExecutionTask('${task.task_id}')" title="Duplicar (cria branch local em revisão)"
          class="self-stretch w-8 rounded-r-xl border-2 border-l-0 ${status.border} bg-sky-500/15 hover:bg-sky-500/40 text-sky-200 grid place-items-center transition">
          <i data-lucide="copy" class="w-3.5 h-3.5"></i>
        </button>
      </div>`;
    }).join('');
  },

  _anyActionConnectedInBranch(campaignId) {
    const branch = StrategicMapEngine.getBranchMap(campaignId);
    if (!branch) return false;
    return (branch.objectives || []).some(o => (o.okrs || []).some(kr => (kr.connectedActionIds || []).length > 0));
  },

  _unifiedWorkCampaignHeader(product, campaign) {
    if (!campaign) return '';
    return `<div class="rounded-2xl bg-violet-500/10 border border-violet-400/30 p-3 flex items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <i data-lucide="git-branch" class="w-4 h-4 text-violet-300 shrink-0"></i>
        <div class="min-w-0">
          <p class="text-[10px] font-black text-violet-200 uppercase tracking-wider">Editando a campanha</p>
          <p class="text-sm font-black text-white truncate">${Utils.escape(campaign.name)}</p>
        </div>
      </div>
      <button onclick="Actions.setStrategicZoom('campaign')" class="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 text-[10px] font-black flex items-center gap-1 shrink-0"><i data-lucide="arrow-left" class="w-3 h-3"></i> Trocar campanha</button>
    </div>`;
  },

  // V29.2.0 — Por área (Mkt/Vendas/CS), lista TODOS os KRs-mãe do produto.
  // Cada KR não-plugado: card simples "Plugar". Plugado: card grande com
  // metas + catálogo de ações filtrado pelos kpiIds.
  _unifiedAreaBlock(product, area, areaProductKrs, campaignId) {
    const tone = area.color;
    if (!areaProductKrs.length) {
      return `<div class="rounded-2xl bg-${tone}-500/5 border border-${tone}-400/20 p-3">
        <p class="text-[10px] font-black text-${tone}-200 uppercase tracking-wider mb-1"><i data-lucide="${area.icon}" class="w-3 h-3 inline-block"></i> ${Utils.escape(area.label)}</p>
        <p class="text-[11px] text-slate-500 italic">CEO não definiu números nesta frente.</p>
      </div>`;
    }
    const branch = StrategicMapEngine.getBranchMap(campaignId);
    const branchObj = (branch?.objectives || []).find(o => o.area === area.id);
    const branchKrs = branchObj?.okrs || [];
    const pluggedByParent = new Map();
    branchKrs.forEach(kr => { if (kr.parentProductKrId) pluggedByParent.set(kr.parentProductKrId, kr); });
    return `<div class="rounded-3xl bg-${tone}-500/5 border border-${tone}-400/30 p-3 space-y-2.5">
      <p class="text-[11px] font-black text-${tone}-200 uppercase tracking-wider"><i data-lucide="${area.icon}" class="w-3.5 h-3.5 inline-block"></i> ${Utils.escape(area.label)} · ${pluggedByParent.size}/${areaProductKrs.length} plugado(s)</p>
      <p class="text-[12px] text-slate-300 leading-relaxed">Conecte ações à campanha para cobrir os números que a campanha-mãe exige.</p>
      ${areaProductKrs.map(pkr => {
        const child = pluggedByParent.get(pkr.id);
        if (!child) return this._unifiedKrNotPluggedCard(pkr, area);
        // V31.2.23 — Plugado: por padrão renderiza colapsado (estilo simples
        // tipo not-plugged, mas com pills das ações). Expande só quando user
        // clica "+ Criar ação" no card colapsado.
        const isOpen = !!(App.state.strategicKrCardOpen && App.state.strategicKrCardOpen[pkr.id]);
        return isOpen
          ? this._unifiedKrPluggedCard(product, area, pkr, branchObj, child, campaignId)
          : this._unifiedKrPluggedCardCollapsed(pkr, area);
      }).join('')}
      ${this._unpluggedActionsLayer(area, campaignId)}
    </div>`;
  },

  // V31.2.23 — Versão recolhida do card plugado: visualmente idêntica ao
  // _unifiedKrNotPluggedCard (rowzinha simples com nome + meta + Ver ações +
  // Criar ação), mas com as pills das ações conectadas abaixo da meta e o
  // botão "+ Criar ação" expande pro card cheio + abre a engine.
  _unifiedKrPluggedCardCollapsed(pkr, area) {
    const tone = area.color;
    const actionsPills = this._actionPillsForKr(pkr, tone);
    return `<div class="rounded-xl bg-slate-900/40 border border-${tone}-400/20 p-2.5 flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <p class="font-black text-white text-[12px]">${Utils.escape(pkr.name)}</p>
        <p class="text-[10px] text-slate-400">Meta produto: <b>${pkr.targetCommitted || '—'}</b> ${pkr.metric || ''}</p>
        ${actionsPills}
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button onclick="Actions.openPluggedActionsModal('${pkr.id}')" class="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 text-[11px] font-black flex items-center gap-1"><i data-lucide="eye" class="w-3 h-3"></i> Ver ações</button>
        <button onclick="Actions.expandPluggedKrCard('${area.id}', '${pkr.id}')" class="px-2.5 py-1.5 rounded-lg bg-${tone}-500/20 hover:bg-${tone}-500/30 border border-${tone}-400/40 text-${tone}-100 text-[11px] font-black">+ Criar ação</button>
      </div>
    </div>`;
  },

  // V31.2.21 — Layer "Ações não plugadas a nenhum KR" abaixo da lista de KRs
  // da área. Lista ações da campanha que pertencem à área mas não estão
  // conectadas a nenhum childKr da branch atual. Cada ação tem botões
  // [Editar] e [Conectar a KRs].
  _unpluggedActionsLayer(area, campaignId) {
    const branch = StrategicMapEngine.getBranchMap(campaignId);
    const branchObj = (branch?.objectives || []).find(o => o.area === area.id);
    const connectedIds = new Set((branchObj?.okrs || []).flatMap(k => (k.connectedActionIds || []).map(Number)));
    const unplugged = (App.state.actions || []).filter(a =>
      Number(a.campaignId) === Number(campaignId)
      && a.strategicAreaId === area.id
      && !connectedIds.has(Number(a.id))
    );
    if (!unplugged.length) return '';
    const tone = area.color;
    return `<div class="rounded-2xl bg-amber-500/5 border border-amber-400/30 p-2.5 space-y-2 mt-2">
      <p class="text-[10px] font-black text-amber-200 uppercase tracking-wider"><i data-lucide="alert-triangle" class="w-3 h-3 inline-block"></i> ${unplugged.length} ação(ões) sem KR vinculado</p>
      <p class="text-[11px] text-slate-300">Estas ações estão soltas — clique <b>Conectar</b> pra escolher qual(is) KR(s) elas movem.</p>
      <div class="space-y-1.5">
        ${unplugged.map(a => `<div class="rounded-lg bg-slate-900/40 border border-white/10 p-2 flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <p class="font-black text-white text-[12px] truncate">${Utils.escape(a.name)}</p>
            <p class="text-[10px] text-slate-400">${Utils.escape(a.channel || '—')} · ${Utils.escape(a.actionType || '—')}</p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button onclick="Actions.openConnectActionToKrsModal(${a.id})" class="px-2 py-1 rounded-lg bg-${tone}-500/20 hover:bg-${tone}-500/30 border border-${tone}-400/40 text-${tone}-100 text-[10px] font-black flex items-center gap-1"><i data-lucide="link" class="w-3 h-3"></i> Conectar</button>
            <button onclick="Actions.openEditActionFromMap(${a.id})" class="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 text-[10px] font-black flex items-center gap-1"><i data-lucide="edit-2" class="w-3 h-3"></i> Editar</button>
          </div>
        </div>`).join('')}
      </div>
    </div>`;
  },

  _unifiedKrNotPluggedCard(pkr, area) {
    const tone = area.color;
    // V31.2.21 — Layout muda: KR ocupa toda a largura. Botões em coluna à
    // direita pra liberar espaço pras pills de ações conectadas abaixo da meta.
    const actionsPills = this._actionPillsForKr(pkr, tone);
    return `<div class="rounded-xl bg-slate-900/40 border border-${tone}-400/20 p-2.5 flex items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <p class="font-black text-white text-[12px]">${Utils.escape(pkr.name)}</p>
        <p class="text-[10px] text-slate-400">Meta produto: <b>${pkr.targetCommitted || '—'}</b> ${pkr.metric || ''}</p>
        ${actionsPills}
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button onclick="Actions.openPluggedActionsModal('${pkr.id}')" class="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 text-[11px] font-black flex items-center gap-1"><i data-lucide="eye" class="w-3 h-3"></i> Ver ações</button>
        <button onclick="Actions.plugProductKrIntoBranch('${pkr.id}')" class="px-2.5 py-1.5 rounded-lg bg-${tone}-500/20 hover:bg-${tone}-500/30 border border-${tone}-400/40 text-${tone}-100 text-[11px] font-black">+ Criar ação</button>
      </div>
    </div>`;
  },

  // V31.2.21 — Pills com nomes das ações conectadas a um KR-mãe. Aparece
  // abaixo da meta, flex-wrap. Cada pill é link que abre a ação no menu.
  _actionPillsForKr(pkr, tone) {
    const productId = App.state.strategicMapProductId;
    const branches = StrategicMapEngine.getBranchesByProduct(productId);
    const childKrs = branches.flatMap(b => (b.objectives || []).flatMap(o => o.okrs || []))
      .filter(k => k.parentProductKrId === pkr.id);
    const actionIds = new Set(childKrs.flatMap(k => (k.connectedActionIds || []).map(Number)));
    if (!actionIds.size) return '';
    const actions = (App.state.actions || []).filter(a => actionIds.has(Number(a.id)));
    if (!actions.length) return '';
    return `<div class="mt-2 flex flex-wrap gap-1">
      <span class="text-[10px] font-black text-slate-400 self-center mr-1">${actions.length} ação(ões):</span>
      ${actions.map(a => `<button onclick="event.stopPropagation(); Actions.openStrategicActionDetail(${a.id})" title="Ver detalhe da ação '${Utils.escape(a.name)}'" class="px-2 py-0.5 rounded bg-${tone}-500/10 hover:bg-${tone}-500/20 border border-${tone}-400/30 text-${tone}-100 text-[10px] font-bold hover:underline">${Utils.escape(a.name)}</button>`).join('')}
    </div>`;
  },

  // V29.3.0 — Card reescrito: layout split (esquerda 3/4 engine + direita 1/4 metas)
  // + balão (?) em cada meta + catálogo scroll horizontal embaixo (curadas + customs).
  _unifiedKrPluggedCard(product, area, pkr, branchObj, childKr, campaignId) {
    const tone = area.color;
    const allTemplates = (StrategicMapEngine.STRATEGIC_ACTION_CATALOG[area.id] || []);
    const relevantTemplates = allTemplates.filter(t => (t.kpiIds || []).includes(pkr.catalogId));
    const activatedIds = StrategicMapEngine.getActivatedCatalogActionIds(product.id, area.id, campaignId);
    // V29.3.1 — passa krCatalogId pra aplicar ML (curva C esconde do KR)
    const customs = StrategicMapEngine.getCustomActionsForArea ? StrategicMapEngine.getCustomActionsForArea(area.id, pkr.catalogId) : [];
    const activatedCustomIds = new Set(((App.state.actions || []).filter(a => Number(a.campaignId) === Number(campaignId) && a.strategicCustomActionId)).map(a => a.strategicCustomActionId));
    const helpOpen = App.state.strategicMetaHelpOpen || {};
    const safeKey = `kr-${childKr.id}-safe`;
    const advKey = `kr-${childKr.id}-adv`;
    const engineOpen = App.state.customActionEngine && App.state.customActionEngine.parentProductKrId === pkr.id;

    // V32.6.7 → V32.6.8 — Card herda paleta da frente. Verde só no chip estado.
    // V32.6.8 (Geraldo+Leonardo): SPOTLIGHT MODE. Quando o form de criar ação
    // está aberto, o card inteiro sai do fluxo e vira modal-light — overlay
    // escurecido + card centrado + click-fora-fecha. Cliente foca 100% na
    // criação. Catálogo de ações + ações conectadas continuam dentro do card
    // (são contexto da decisão), mas tudo o que está ALÉM (tabs, outros KRs,
    // rodapé, header da frente) some atrás do overlay. Geraldo: uma decisão
    // por vez visualmente.

    // Conteúdo do card (idêntico nos 2 modos — muda apenas o wrapper).
    const cardContent = `
      <!-- Header: nome do KR + chip de estado + meta inline + ações -->
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 uppercase tracking-wider">✓ Plugado</span>
            <p class="font-black text-white text-[13px]">${Utils.escape(childKr.name)}</p>
            <span class="text-[10px] text-slate-400">· Meta <b class="text-slate-200">${pkr.targetCommitted || '—'}</b> ${childKr.metric || ''}</span>
          </div>
          ${this._actionPillsForKr(pkr, tone)}
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <button onclick="Actions.openPluggedActionsModal('${pkr.id}')" title="Ver ações plugadas a esse KR" class="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 text-[10px] font-black flex items-center gap-1"><i data-lucide="eye" class="w-3 h-3"></i> Ver ações</button>
          ${engineOpen
            ? `<button onclick="Actions.closeCustomActionEngine()" title="Fechar criação" class="px-1.5 py-0.5 rounded text-[10px] text-slate-300 hover:bg-white/10 border border-white/15"><i data-lucide="x" class="w-3 h-3"></i></button>`
            : `<button onclick="Actions.collapsePluggedKrCard('${pkr.id}')" title="Recolher" class="px-1.5 py-0.5 rounded text-[10px] text-slate-300 hover:bg-white/10 border border-white/15"><i data-lucide="chevron-up" class="w-3 h-3"></i></button>
               <button onclick="Actions.removeStrategicOkr('${branchObj.id}','${childKr.id}')" title="Desplugar KR da branch" class="px-1.5 py-0.5 rounded text-[10px] text-red-300 hover:bg-red-500/20 border border-red-400/30">×</button>`}
        </div>
      </div>

      <!-- Split 60/40 quando engine aberta · 50/50 quando só CTA + side -->
      ${engineOpen ? `<div class="grid grid-cols-1 lg:grid-cols-5 gap-3 items-start">
        <div class="lg:col-span-3">${this._customActionEngineForm(area, pkr)}</div>
        <div class="lg:col-span-2">${this._unifiedKrPluggedSideKrs(pkr, area)}</div>
      </div>` : `<div class="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <div class="flex justify-center"><button onclick="Actions.openCustomActionEngine('${area.id}', '${pkr.id}')" class="w-1/2 px-3 py-2.5 rounded-xl bg-${tone}-500/10 hover:bg-${tone}-500/20 border border-dashed border-${tone}-400/40 text-${tone}-100 text-[12px] font-black flex items-center justify-center gap-1.5 transition"><i data-lucide="zap" class="w-3.5 h-3.5"></i> Criar ação</button></div>
        ${this._unifiedKrPluggedSideKrs(pkr, area)}
      </div>`}

      <!-- V31.1.0 — Ações conectadas (operacional): listadas ANTES do catálogo.
           Quando engine aberta, escondemos (foco no form), volta quando fecha. -->
      ${engineOpen ? '' : this._connectedActionsList(childKr, area)}

      <!-- V32.5.0 (Leonardo L5) — Catálogo dentro de <details>. Quando engine
           aberta, escondemos pra não competir com o form. -->
      ${engineOpen ? '' : `<details open class="pt-2 border-t border-${tone}-400/20 group">
        <summary class="cursor-pointer text-[10px] font-black text-${tone}-200 uppercase tracking-wider mb-1.5 hover:text-${tone}-100 transition flex items-center gap-1.5 select-none">
          <i data-lucide="chevron-down" class="w-3 h-3 group-open:rotate-0 -rotate-90 transition-transform"></i>
          Como cobrir esse número? (catálogo de ações)
        </summary>
        ${relevantTemplates.length === 0 && customs.length === 0 ? '<p class="text-[11px] text-slate-500 italic">Sem ações do catálogo que movam este número. Use o "Criar ação" ao lado.</p>' : `<div class="flex gap-1.5 overflow-x-auto pb-2" style="scrollbar-width:thin;">
          ${relevantTemplates.map(t => {
            const isAct = activatedIds.has(t.id);
            return `<button onclick="Actions.activateStrategicCatalogAction('${area.id}', '${t.id}')" ${isAct ? 'disabled' : ''} title="${Utils.escape(t.description)}" class="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border ${isAct ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200 cursor-default' : `bg-slate-900 hover:bg-slate-800 border-${tone}-400/30 text-${tone}-100`}">${isAct ? '✓ ' : '+ '}${Utils.escape(t.name)}</button>`;
          }).join('')}
          ${customs.map(c => {
            const isAct = activatedCustomIds.has(c.id);
            const isSel = App.state.coverageChipSelected === c.id;
            const cls = isSel
              ? 'bg-emerald-700 border border-emerald-600 text-white shadow-inner'
              : (isAct
                  ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/50 text-emerald-100'
                  : 'bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200');
            return `<button onclick="Actions.toggleCoverageChip('${c.id}')" title="Custom · ${Utils.escape(c.channel)}" class="shrink-0 px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${cls}">${isAct ? '✓ ' : ''}${Utils.escape(c.name)}</button>`;
          }).join('')}
        </div>`}
        ${(() => {
          const selId = App.state.coverageChipSelected;
          if (!selId) return '';
          const sel = customs.find(c => c.id === selId);
          if (!sel) return '';
          return `<div class="mt-2 flex items-center gap-2 rounded-lg bg-slate-900/60 border border-${tone}-400/30 p-2">
            <p class="text-[11px] text-slate-300 flex-1 min-w-0 truncate"><b class="text-${tone}-200">${Utils.escape(sel.name)}</b> selecionada</p>
            <button onclick="Actions.plugCoverageChip('${sel.id}', '${area.id}', '${pkr.id}')" class="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black flex items-center gap-1" style="color:#fff!important;"><i data-lucide="plug" class="w-3 h-3"></i> Plugar</button>
            <button onclick="Actions.editCoverageChip('${sel.id}', '${area.id}', '${pkr.id}')" class="px-2.5 py-1 rounded bg-sky-500/80 hover:bg-sky-600 text-white text-[10px] font-black flex items-center gap-1" style="color:#fff!important;"><i data-lucide="edit-2" class="w-3 h-3"></i> Editar</button>
            <button onclick="Actions.unplugCoverageChip('${sel.id}', '${area.id}', '${pkr.id}')" class="px-2.5 py-1 rounded bg-red-500/80 hover:bg-red-600 text-white text-[10px] font-black flex items-center gap-1" style="color:#fff!important;"><i data-lucide="unplug" class="w-3 h-3"></i> Desplugar</button>
            <button onclick="Actions.toggleCoverageChip('${sel.id}')" title="Cancelar seleção" class="px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 text-[10px] font-black">✕</button>
          </div>`;
        })()}
      </details>`}
    `;

    // Wrapper: modal-light quando engine aberta, card inline quando fechada.
    if (engineOpen) {
      return `<div class="fixed inset-0 z-[90] bg-black/85 backdrop-blur-sm overflow-auto"
        onclick="if(event.target===this)Actions.closeCustomActionEngine()">
        <div class="min-h-full grid place-items-center p-4">
          <div class="rounded-2xl bg-slate-900/95 border border-${tone}-400/50 p-4 space-y-3 shadow-2xl shadow-${tone}-500/20 w-full max-w-5xl">
            ${cardContent}
          </div>
        </div>
      </div>`;
    }
    return `<div class="rounded-2xl bg-slate-900/40 border border-${tone}-400/40 p-3 space-y-3">${cardContent}</div>`;
  },

  // V31.2.19 → V32.6.7 (Leonardo full pass) — Lado direito do card plugado.
  // Headers humanizados: "KR-mãe" / "Outros KRs" agora dizem o que o cliente
  // precisa decidir, não o jargão técnico. Move este número / Outros números.
  _unifiedKrPluggedSideKrs(currentPkr, area) {
    const tone = area.color;
    const productId = App.state.strategicMapProductId;
    const allAreaKrs = StrategicMapEngine.getProductKrs(productId).filter(k => k.area === area.id);
    const eng = App.state.customActionEngine;
    const engineSelected = (eng && eng.parentProductKrId === currentPkr.id && Array.isArray(eng.selectedKrIds))
      ? eng.selectedKrIds
      : null; // só pinta verde se a engine está aberta DESTE card
    const others = allAreaKrs.filter(k => k.id !== currentPkr.id);
    return `<div class="space-y-3 w-full">
      <div>
        <p class="text-[10px] font-bold text-${tone}-200/80 mb-1.5">Esta ação move</p>
        ${this._sideKrItem(currentPkr, area, true, engineSelected && engineSelected.includes(currentPkr.id))}
      </div>
      ${others.length > 0 ? `<div>
        <p class="text-[10px] font-bold text-slate-400 mb-1.5">${others.length === 1 ? 'Outro número' : 'Outros números'} desta frente</p>
        <div class="space-y-1.5">${others.map(k =>
          this._sideKrItem(k, area, false, engineSelected && engineSelected.includes(k.id))
        ).join('')}</div>
      </div>` : ''}
    </div>`;
  },

  // V32.6.7 — Card de número (KR) na sidebar.
  // Refator Leonardo: "Segura" / "Avançada" como CHIPS TEXTUAIS antes do número,
  // não mais 🔒/🚀 sozinhos (emoji não é label legível). Ritmo Fibonacci
  // (p-3, gap-2). Card current herda paleta Marketing/Vendas/CS da frente —
  // identidade cromática preservada mesmo quando "plugado" semanticamente.
  _sideKrItem(kr, area, isCurrent, isEngineSelected) {
    const tone = area.color;
    const safe = kr.targetCommitted != null ? kr.targetCommitted : '—';
    const stretch = kr.targetStretch != null ? kr.targetStretch : '—';
    const metric = Utils.escape(kr.metric || '');
    // 3 estados visuais (não 5): default neutral, current tone, engine-selected emerald.
    // Reduz "muitas paletas" — Leonardo: 3 fundos no card todo, não 5.
    const borderCls = isEngineSelected
      ? 'border-emerald-400/60 bg-emerald-500/[0.08] ring-1 ring-emerald-400/30'
      : (isCurrent ? `border-${tone}-400/40 bg-${tone}-500/[0.06]` : 'border-white/10 bg-slate-900/30');
    const checkBadge = isEngineSelected
      ? '<span class="text-[10px] font-bold text-emerald-300 ml-1">· move</span>'
      : '';
    return `<div class="rounded-xl ${borderCls} border p-3">
      <p class="font-black text-white text-[12px] leading-tight mb-2">${Utils.escape(kr.name)}${checkBadge}</p>
      <div class="space-y-1.5">
        <div class="flex items-baseline gap-2">
          <span class="text-[9px] font-black text-emerald-300/80 uppercase tracking-wider w-[52px] shrink-0">Segura</span>
          <span class="font-black text-white text-[13px]">${safe}</span>
          <span class="text-[10px] text-slate-400">${metric}</span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-[9px] font-black text-violet-300/80 uppercase tracking-wider w-[52px] shrink-0">Avançada</span>
          <span class="font-black text-white text-[13px]">${stretch}</span>
          <span class="text-[10px] text-slate-400">${metric}</span>
        </div>
      </div>
    </div>`;
  },

  // V31.1.0 — Caminho inverso (estratégico → operacional): lista as ações reais
  // já conectadas a este OKR, com canal/status/dono + atalho "Abrir ação".
  // Antes só existia o caminho operacional → estratégico (retângulo azul no card).
  _connectedActionsList(childKr, area) {
    const ids = (childKr.connectedActionIds || []).map(Number);
    if (!ids.length) return '';
    const actions = (App.state.actions || []).filter(a => ids.includes(Number(a.id)));
    if (!actions.length) return '';
    const statuses = (window.StrategicMapEngine?.STRATEGIC_ACTION_STATUSES) || [];
    const tone = area.color;
    return `<div class="pt-2 border-t border-${tone}-400/20">
      <p class="text-[10px] font-black text-${tone}-300 uppercase tracking-wider mb-1.5">${actions.length} ação(ões) conectada(s) a este número</p>
      <div class="space-y-1.5">
        ${actions.map(action => {
          const status = statuses.find(s => s.id === action.strategicStatus) || statuses[0] || { label: 'Planejada', color: 'slate' };
          return `<div class="rounded-xl bg-black/30 border border-white/10 p-2.5 flex items-center justify-between gap-2">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 mb-0.5">
                <span class="px-1.5 py-0.5 rounded-full bg-${tone}-500/30 border border-${tone}-400/40 text-${tone}-100 text-[9px] font-black uppercase tracking-wider">${Utils.escape(action.channel || '—')}</span>
                <span class="px-1.5 py-0.5 rounded-full bg-${status.color}-500/30 border border-${status.color}-400/40 text-${status.color}-100 text-[9px] font-black">${Utils.escape(status.label).toUpperCase()}</span>
                ${action.strategicConfirmed ? '<span class="text-[9px] font-black text-emerald-300">✓</span>' : ''}
              </div>
              <p class="font-bold text-white text-[12px] leading-tight truncate">${Utils.escape(action.name)}</p>
              <p class="text-[10px] text-slate-400 mt-0.5">${action.strategicOwner ? '👤 ' + Utils.escape(action.strategicOwner) + ' · ' : ''}${(action.leads || []).length} lead(s)</p>
            </div>
            <button onclick="Actions.openStrategicActionDetail(${action.id})" class="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-slate-200 text-[10px] font-black flex items-center gap-1 shrink-0">Abrir ação <i data-lucide="arrow-right" class="w-3 h-3"></i></button>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  // V29.3.0 — Form da engine de criação de ação custom (abre quando user clica
  // "Criar engine de ação"). Vocabulário humano (Topo/Meio/Fundo, não TOF/MOF/BOF).
  _customActionEngineForm(area, pkr) {
    const eng = App.state.customActionEngine || {};
    const channels = (window.Config?.allChannels?.() || []);
    const tone = area.color;
    const funnelOptions = [
      { v: 'TOF', l: 'Topo (atração)' },
      { v: 'MOF', l: 'Meio (qualificação)' },
      { v: 'BOF', l: 'Fundo (decisão)' }
    ];
    const sectorOptions = (StrategicMapEngine.COMERCIAL_AREAS || []);
    // V31.2.18 — User escolhe quais KR-mãe(s) esta ação vai mover via checkboxes.
    // V31.2.19 — Frame vermelho quando KR de origem desmarcado (sinaliza
    // desalinhamento entre "onde abri o engine" e "o que esta ação cobre").
    const areaKrs = StrategicMapEngine.getProductKrs(App.state.strategicMapProductId).filter(k => k.area === area.id);
    const selectedKrIds = Array.isArray(eng.selectedKrIds) && eng.selectedKrIds.length
      ? eng.selectedKrIds
      : [pkr.id]; // default: KR de origem pré-marcado
    const originUnmarked = !selectedKrIds.includes(pkr.id);
    const frameBorder = originUnmarked ? 'border-red-500/60' : `border-${tone}-400/40`;
    const frameBg = originUnmarked ? 'bg-red-950/20' : 'bg-slate-900/60';
    // V32.6.7 (Leonardo) — Header "Nova ação custom · Marketing" REMOVIDO.
    // A área já está chumbada no contexto da frente (card pai já é Marketing).
    // Header repetia identidade — virou ruído. Sobra apenas ✕ no canto superior
    // pra fechar o form. Form É a ação de criar; não precisa anunciar isso.
    return `<div class="rounded-xl ${frameBg} border-2 ${frameBorder} p-3 space-y-3 relative">
      <button onclick="Actions.closeCustomActionEngine()" title="Fechar (sem perder o que digitou)" class="absolute top-2 right-2 w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-slate-400 hover:text-white grid place-items-center">
        <i data-lucide="x" class="w-3 h-3"></i>
      </button>

      ${originUnmarked ? `<div class="rounded-lg bg-red-500/15 border border-red-400/40 p-3 flex items-start gap-2">
        <i data-lucide="alert-triangle" class="w-4 h-4 text-red-300 shrink-0 mt-0.5"></i>
        <div>
          <p class="font-black text-red-100 text-[11px]">⚠️ KR de origem desmarcado</p>
          <p class="text-[10px] text-red-200 mt-0.5">Essa ação foi criada a partir do card de <b>${Utils.escape(pkr.name)}</b>. Remarque ele abaixo pra evitar desfigurar os KRs.</p>
        </div>
      </div>` : ''}

      <div class="rounded-lg bg-${tone}-500/[0.06] border border-${tone}-400/20 p-3">
        <p class="text-[10px] font-bold text-${tone}-200/90 mb-2">Esta ação move quais números?</p>
        <div class="space-y-1">
          ${areaKrs.length === 0
            ? '<p class="text-[10px] text-slate-400 italic">Nenhum número definido nesta frente ainda. Volte pra "Os Números".</p>'
            : areaKrs.map(k => {
                const checked = selectedKrIds.includes(k.id);
                const isOrigin = k.id === pkr.id;
                const safe = k.targetCommitted != null ? k.targetCommitted : '—';
                const stretch = k.targetStretch != null ? k.targetStretch : '—';
                return `<label class="flex items-start gap-2 p-2 rounded hover:bg-white/5 cursor-pointer ${isOrigin ? 'bg-' + tone + '-500/5' : ''}">
                  <input type="checkbox" ${checked ? 'checked' : ''} onchange="Actions.toggleCustomActionEngineKr('${k.id}')" class="mt-1 shrink-0" />
                  <div class="min-w-0 flex-1">
                    <p class="font-black text-white text-[12px]">${Utils.escape(k.name)} <span class="text-[10px] text-slate-400 font-normal">(${Utils.escape(k.metric || 'quantidade')})</span>${isOrigin ? ` <span class="text-[9px] text-${tone}-300 font-bold ml-1">· deste card</span>` : ''}</p>
                    <div class="flex items-baseline gap-3 mt-1 text-[10px]">
                      <span><span class="font-black text-emerald-300/80 uppercase tracking-wider">Segura</span> <b class="text-white">${safe}</b></span>
                      <span><span class="font-black text-violet-300/80 uppercase tracking-wider">Avançada</span> <b class="text-white">${stretch}</b></span>
                    </div>
                  </div>
                </label>`;
              }).join('')}
        </div>
      </div>

      <div>
        <label class="block text-[9px] font-black text-slate-400 uppercase mb-0.5">Nome da ação</label>
        <input value="${Utils.escape(eng.name || '')}" oninput="Actions.updateCustomActionEngineField('name', this.value)" placeholder="Ex: Webinar trimestral pra C-level" class="w-full px-2 py-1.5 rounded bg-slate-900 border border-white/10 text-white text-[12px] font-bold placeholder:text-slate-600" />
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-[9px] font-black text-slate-400 uppercase mb-0.5">Onde começa <span class="text-slate-500">(${Utils.escape(area.label)})</span></label>
          <select onchange="Actions.updateCustomActionEngineField('funnelPoint', this.value)" class="w-full px-2 py-1.5 rounded bg-slate-900 border border-white/10 text-white text-[11px] font-bold" style="color-scheme:dark;">
            <option value="">— escolha —</option>
            ${funnelOptions.map(o => `<option value="${o.v}" ${eng.funnelPoint === o.v ? 'selected' : ''}>${o.l}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block text-[9px] font-black text-slate-400 uppercase mb-0.5">Pra onde leva</label>
          <div class="flex gap-1">
            <select onchange="Actions.updateCustomActionEngineField('destSector', this.value)" class="flex-1 min-w-0 px-2 py-1.5 rounded bg-slate-900 border border-white/10 text-white text-[11px] font-bold" style="color-scheme:dark;">
              ${sectorOptions.map(s => `<option value="${s.id}" ${eng.destSector === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}
            </select>
            <select onchange="Actions.updateCustomActionEngineField('destFunnelPoint', this.value)" class="flex-1 min-w-0 px-2 py-1.5 rounded bg-slate-900 border border-white/10 text-white text-[11px] font-bold" style="color-scheme:dark;">
              <option value="">— funil —</option>
              ${funnelOptions.map(o => `<option value="${o.v}" ${eng.destFunnelPoint === o.v ? 'selected' : ''}>${o.l}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>

      <div>
        <label class="block text-[9px] font-black text-slate-400 uppercase mb-0.5">Canal</label>
        <select onchange="Actions.updateCustomActionEngineField('channel', this.value)" class="w-full px-2 py-1.5 rounded bg-slate-900 border border-white/10 text-white text-[11px] font-bold" style="color-scheme:dark;">
          <option value="">— escolha —</option>
          ${channels.map(c => `<option value="${Utils.escape(c)}" ${eng.channel === c ? 'selected' : ''}>${Utils.escape(c)}</option>`).join('')}
          <option value="Outro" ${eng.channel === 'Outro' ? 'selected' : ''}>Outro (digitar)</option>
        </select>
        ${eng.channel === 'Outro' ? `<input value="${Utils.escape(eng.channelOther || '')}" oninput="Actions.updateCustomActionEngineField('channelOther', this.value)" placeholder="Nome do canal customizado" class="w-full mt-1 px-2 py-1.5 rounded bg-slate-900 border border-amber-400/40 text-white text-[11px] font-bold placeholder:text-slate-600" />` : ''}
      </div>

      <div class="flex justify-end gap-1.5 pt-1">
        <button onclick="Actions.closeCustomActionEngine()" class="px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 text-[10px] font-black">Cancelar</button>
        <button onclick="Actions.createCustomAction()" class="px-3 py-1 rounded bg-${tone}-500 hover:bg-${tone}-600 text-white text-[10px] font-black flex items-center gap-1" style="color:#fff!important;"><i data-lucide="${eng.editingCustomId ? 'save' : 'plus'}" class="w-3 h-3"></i> ${eng.editingCustomId ? 'Salvar' : 'Criar'}</button>
      </div>
    </div>`;
  },

  // V28.4.1 — Header mostrando a campanha estratégica vinculada (com botão renomear).
  // V28.4.4 — Adicionado contador de ações órfãs (sem objetivo vinculado).
  _strategicCampaignHeader(product) {
    if (!window.StrategicMapEngine?.getStrategicCampaign) return '';
    const campaign = StrategicMapEngine.getStrategicCampaign(product.id);
    if (!campaign) {
      return `<div class="rounded-2xl bg-amber-500/10 border border-amber-400/30 px-3 py-2.5 text-[11px] text-amber-200 flex items-center gap-2">
        <i data-lucide="folder-plus" class="w-3.5 h-3.5 shrink-0"></i>
        <span>Sua campanha estratégica ainda não tem nome — vai pedir quando você ativar a primeira ação.</span>
      </div>`;
    }
    // Conta ações órfãs (sem KR vinculado) e ações totais da campanha.
    const campaignActions = (App.state.actions || []).filter(a => Number(a.campaignId) === Number(campaign.id));
    const map = StrategicMapEngine.getForProduct(product.id);
    const allKrs = (map?.objectives || []).flatMap(o => o.okrs || []);
    const linkedActionIds = new Set(allKrs.flatMap(kr => (kr.connectedActionIds || []).map(Number)));
    const orphanCount = campaignActions.filter(a => !linkedActionIds.has(Number(a.id))).length;
    const totalCount = campaignActions.length;

    return `<div class="rounded-2xl bg-emerald-500/10 border border-emerald-400/30 p-3 flex items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <i data-lucide="folder-check" class="w-4 h-4 text-emerald-300 shrink-0"></i>
        <div class="min-w-0">
          <p class="text-[10px] font-black text-emerald-200 uppercase tracking-wider">Campanha estratégica deste produto</p>
          <p class="text-sm font-black text-white truncate">${Utils.escape(campaign.name)}</p>
          ${totalCount > 0 ? `<p class="text-[11px] mt-0.5 ${orphanCount > 0 ? 'text-amber-200' : 'text-emerald-200'}">${orphanCount > 0 ? `⚠️ ${orphanCount} de ${totalCount} ação(ões) sem objetivo vinculado` : `✓ Todas as ${totalCount} ações estão vinculadas a algum objetivo`}</p>` : ''}
        </div>
      </div>
      <button onclick="(function(){const n=prompt('Renomear campanha:', ${JSON.stringify(campaign.name).replace(/"/g, '&quot;')}); if(n) Actions.renameStrategicCampaignAction(n);})()" class="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 text-[10px] font-black flex items-center gap-1 shrink-0"><i data-lucide="edit-2" class="w-3 h-3"></i> Renomear</button>
    </div>`;
  },

  // V28.3.0 → V32.6.6 — Painel da frente ativa com progressive disclosure.
  // Geraldo: 1 ação expandida por vez (em foco). Pendentes sem foco ficam
  // colapsadas com CTA "Configurar". Confirmadas mini-card verde compacto.
  // Reduz "muralha de 6 blocos × N ações" que confundia o cliente.
  _areaAcoesSection(product) {
    const areaId = this._activeAreaIdWithFallback(product.id);
    const area = (StrategicMapEngine.COMERCIAL_AREAS || []).find(a => a.id === areaId);
    if (!area) return '';
    const objective = StrategicMapEngine.getObjectiveByArea(product.id, areaId);
    const confirmedKrs = (objective?.okrs || []).filter(k => k.confirmed);
    // V29.0.3 — Passa campaignId pra escopar ações/órfãs à branch ativa (não ao produto inteiro).
    const campaignId = App.state.strategicMapCampaignId;
    const activeActions = StrategicMapEngine.getStrategicActionsByArea(product.id, areaId, campaignId);
    const activatedTemplateIds = StrategicMapEngine.getActivatedCatalogActionIds(product.id, areaId, campaignId);
    const orphanKrs = StrategicMapEngine.getKrsWithoutActions(product.id, areaId, campaignId);
    const tone = area.color;

    // V32.6.6 — Auto-foco na primeira pendente da frente quando nada está em
    // foco. Cliente sempre vê a próxima decisão exposta. Hydratado via setTimeout
    // (não muda state durante render).
    const activeId = Number(App.state.strategicActiveActionId || 0);
    const activeBelongsHere = activeId && activeActions.some(a => Number(a.id) === activeId);
    if (!activeBelongsHere) {
      const firstPending = activeActions.find(a => !a.strategicConfirmed);
      if (firstPending && Number(firstPending.id) !== activeId) {
        const targetId = Number(firstPending.id);
        if (!App._strategicAutofocusScheduled) {
          App._strategicAutofocusScheduled = true;
          setTimeout(() => {
            App._strategicAutofocusScheduled = false;
            if (App.state.strategicActiveActionId !== targetId) {
              App.state.strategicActiveActionId = targetId;
              App.save(); App.render();
            }
          }, 30);
        }
      }
    }

    return `<div class="rounded-3xl bg-white/[0.05] border border-${tone}-400/30 p-4 space-y-3">
      <div class="flex items-start gap-3">
        <div class="w-9 h-9 rounded-xl bg-${tone}-500/20 grid place-items-center shrink-0"><i data-lucide="${area.icon}" class="w-4 h-4 text-${tone}-200"></i></div>
        <div class="min-w-0">
          <p class="font-black text-white">${Utils.escape(area.label)}</p>
          <p class="text-[11px] text-slate-400 mt-0.5">${confirmedKrs.length} número(s) confirmado(s) · ${activeActions.length} ação(ões) ativa(s)</p>
        </div>
      </div>

      ${confirmedKrs.length ? `<div class="rounded-xl bg-slate-900/40 border border-white/10 p-2.5">
        <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Números confirmados desta frente:</p>
        <div class="flex flex-wrap gap-1.5">
          ${confirmedKrs.map(kr => {
            const acoesQueMovem = activeActions.filter(a => (kr.connectedActionIds || []).map(Number).includes(Number(a.id))).length;
            const orphan = acoesQueMovem === 0;
            return `<span class="px-2 py-1 rounded-lg text-[10px] font-bold ${orphan ? 'bg-amber-500/15 border border-amber-400/40 text-amber-200' : `bg-${tone}-500/15 border border-${tone}-400/30 text-${tone}-200`}" title="${acoesQueMovem} ação(ões) movem este número">${kr.isHandoff ? '🔁 ' : ''}${Utils.escape(kr.name)} · ${acoesQueMovem} ${acoesQueMovem === 1 ? 'ação' : 'ações'}</span>`;
          }).join('')}
        </div>
      </div>` : ''}

      ${orphanKrs.length ? `<div class="rounded-xl bg-amber-500/10 border border-amber-400/40 p-2.5 text-[11px] text-amber-100">
        ⚠️ <b>${orphanKrs.length} número${orphanKrs.length === 1 ? '' : 's'} sem ação vinculada</b> — ${orphanKrs.length === 1 ? 'ele não vai' : 'eles não vão'} se mover sozinho${orphanKrs.length === 1 ? '' : 's'}. Ative pelo menos uma ação abaixo.
      </div>` : ''}

      <div class="space-y-2">
        ${activeActions.length ? activeActions.map(a => this._acaoCard(product, area, a)).join('') : '<p class="text-[11px] text-slate-500 italic">Nenhuma ação ativa nesta frente. Ative do catálogo abaixo.</p>'}
      </div>

      ${this._actionCatalogStrip(product, area, activatedTemplateIds)}
    </div>`;
  },

  // V28.3.0 — Strip de ações do catálogo ainda não ativadas.
  _actionCatalogStrip(product, area, activatedTemplateIds) {
    const catalog = (StrategicMapEngine.STRATEGIC_ACTION_CATALOG || {})[area.id] || [];
    const available = catalog.filter(t => !activatedTemplateIds.has(t.id));
    if (!available.length) {
      return `<div class="rounded-xl bg-${area.color}-500/5 border border-${area.color}-400/20 p-2.5 text-[11px] text-${area.color}-200 italic">Todas as ações típicas de ${Utils.escape(area.label)} já estão ativas.</div>`;
    }
    const kpiCatalog = (StrategicMapEngine.KPI_CATALOG || {})[area.id] || [];
    return `<div class="rounded-xl bg-${area.color}-500/5 border border-${area.color}-400/20 p-3">
      <p class="text-[10px] font-black text-${area.color}-200 uppercase tracking-wider mb-2">Ações típicas de ${Utils.escape(area.label)} — clique pra ativar</p>
      <div class="grid sm:grid-cols-2 gap-1.5">
        ${available.map(t => {
          const moves = (t.kpiIds || []).map(id => (kpiCatalog.find(k => k.id === id) || {}).name).filter(Boolean);
          return `<button onclick="Actions.activateStrategicCatalogAction('${area.id}', '${t.id}')" title="${Utils.escape(t.description)}" class="text-left px-2.5 py-2 rounded-lg bg-slate-900/60 hover:bg-slate-800 border border-white/10 text-white text-[11px] font-bold flex items-start gap-1.5">
            <i data-lucide="plus" class="w-3 h-3 text-${area.color}-300 shrink-0 mt-px"></i>
            <span class="min-w-0">
              ${Utils.escape(t.name)}
              <span class="block text-[10px] text-slate-400 font-normal mt-0.5">${Utils.escape(t.description)}</span>
              ${moves.length ? `<span class="block text-[10px] text-${area.color}-200 font-bold mt-1">Move: ${moves.map(m => Utils.escape(m)).join(' · ')}</span>` : ''}
            </span>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  },

  // V28.3.0 → V32.6.6 — Card de ação em 3 estados (progressive disclosure):
  //
  // 1. CONFIRMED        → mini-card verde compacto (dono/cadência inline)
  // 2. PENDING + active → expandido (dono input + chips cadência + confirmar)
  // 3. PENDING + idle   → mini-card cinza CTA "Configurar →" (collapsed)
  //
  // Status (Planejada/Rodando/Encerrada) só aparece quando CONFIRMED — decisão
  // prematura antes disso. Cliente preenche dono+cadência → confirma → próxima
  // pendente da frente entra em foco automático.
  _acaoCard(product, area, action) {
    const tone = area.color;
    const linkedKrs = this._krsLinkedToAction(product.id, area.id, action.id);
    const linkedNames = linkedKrs.map(k => k.name);
    const cadences = StrategicMapEngine.STRATEGIC_ACTION_CADENCES || [];
    const statuses = StrategicMapEngine.STRATEGIC_ACTION_STATUSES || [];
    const status = (statuses.find(s => s.id === action.strategicStatus) || statuses[0] || { id: 'planned', label: 'Planejada', color: 'slate' });
    const ownerSet = Boolean(String(action.strategicOwner || '').trim());
    const cadenceSet = Boolean(action.strategicCadence);
    const complete = ownerSet && cadenceSet;
    const isActive = Number(App.state.strategicActiveActionId) === Number(action.id);

    // ── ESTADO 1: CONFIRMED — mini-card verde ────────────────────
    if (action.strategicConfirmed) {
      const cadenceLabel = (cadences.find(c => c.id === action.strategicCadence) || {}).label || '—';
      return `<div class="rounded-2xl bg-emerald-500/[0.05] border border-emerald-400/30 p-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap mb-1">
              <span class="text-emerald-300 font-black">✓</span>
              <p class="font-black text-white text-sm">${Utils.escape(action.name)}</p>
              <span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-${status.color}-500/20 text-${status.color}-200 border border-${status.color}-400/30">${status.label.toUpperCase()}</span>
            </div>
            <p class="text-[11px] text-slate-300">Dono <b class="text-white">${Utils.escape(action.strategicOwner || '—')}</b> · Cadência <b class="text-white">${Utils.escape(cadenceLabel)}</b>${linkedNames.length ? ` · Move <b class="text-${tone}-200">${linkedNames.map(n => Utils.escape(n)).join(', ')}</b>` : ''}</p>
          </div>
        </div>
        <div class="flex justify-end gap-1 mt-2">
          <button onclick="Actions.editStrategicAcao(${action.id})" class="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 text-[10px] font-black">Editar</button>
          <button onclick="Actions.removeStrategicCatalogAction(${action.id})" class="px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-400/30 text-red-300 text-[10px] font-black">Remover</button>
        </div>
      </div>`;
    }

    // ── ESTADO 3: PENDING + IDLE — mini-card colapsado com CTA ─────
    if (!isActive) {
      const missing = [];
      if (!ownerSet) missing.push('dono');
      if (!cadenceSet) missing.push('cadência');
      const missingLabel = missing.length ? `Falta ${missing.join(' + ')}` : 'Pronta pra confirmar';
      return `<button onclick="Actions.setStrategicActiveAction(${action.id})" class="w-full text-left rounded-2xl bg-black/20 hover:bg-black/30 border border-white/10 hover:border-${tone}-400/40 p-3 transition flex items-center justify-between gap-3 group">
        <div class="min-w-0 flex-1">
          <p class="font-black text-white text-sm truncate">${Utils.escape(action.name)}</p>
          <p class="text-[10px] text-${missing.length ? 'amber-300' : 'emerald-300'} font-bold mt-0.5">${missing.length ? '○' : '●'} ${missingLabel}${linkedNames.length ? ` · Move ${linkedNames.length} número${linkedNames.length > 1 ? 's' : ''}` : ''}</p>
        </div>
        <span class="text-[11px] font-black text-${tone}-200 group-hover:text-${tone}-100 flex items-center gap-1 shrink-0">Configurar <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i></span>
      </button>`;
    }

    // ── ESTADO 2: PENDING + ACTIVE — expandido (foco) ──────────────
    // Borda mais grossa + bg destacado pra cliente saber onde está.
    const desc = action.strategicDescription ? `<p class="text-[10px] text-slate-400 italic mb-2">${Utils.escape(action.strategicDescription)}</p>` : '';
    const missingForCopy = [];
    if (!ownerSet) missingForCopy.push('dono');
    if (!cadenceSet) missingForCopy.push('cadência');
    return `<div class="rounded-2xl bg-${tone}-500/[0.08] border-2 border-${tone}-400/50 p-3 shadow-lg shadow-${tone}-500/10">
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-0.5">
            <span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-${tone}-500/30 text-${tone}-100 border border-${tone}-400/50 uppercase tracking-wider">Em foco</span>
            <p class="font-black text-white text-sm">${Utils.escape(action.name)}</p>
          </div>
          ${desc}
          ${linkedNames.length ? `<p class="text-[10px] text-${tone}-200 font-bold">🔗 Move: ${linkedNames.map(n => Utils.escape(n)).join(' · ')}</p>` : `<p class="text-[10px] text-amber-300 font-bold">⚠️ Nenhum número confirmado dessa frente é movido por essa ação — ative os números primeiro.</p>`}
        </div>
        <button onclick="Actions.setStrategicActiveAction(null)" title="Fechar (sem perder o que digitou)" class="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-slate-400 grid place-items-center shrink-0">
          <i data-lucide="x" class="w-3 h-3"></i>
        </button>
      </div>

      <div class="grid grid-cols-1 gap-2 mb-2">
        <label class="flex flex-col gap-0.5">
          <span class="text-[9px] font-black text-slate-500 uppercase">Dono</span>
          <input value="${Utils.escape(action.strategicOwner || '')}" oninput="Actions.updateStrategicActionField(${action.id}, 'strategicOwner', this.value)" placeholder="Quem executa essa ação?" class="px-2 py-1.5 rounded-lg bg-slate-900 border ${ownerSet ? `border-${tone}-400/40` : 'border-white/10'} text-white text-[12px] font-bold w-full placeholder:text-slate-600" />
        </label>
      </div>

      <div class="mb-2">
        <p class="text-[9px] font-black text-slate-500 uppercase mb-1">Cadência</p>
        <div class="flex flex-wrap gap-1.5">
          ${cadences.map(c => `<button onclick="Actions.updateStrategicActionField(${action.id}, 'strategicCadence', '${c.id}')" class="px-2.5 py-1 rounded-lg border text-[11px] font-bold ${action.strategicCadence === c.id ? `bg-${tone}-500/30 border-${tone}-400/60 text-white` : 'bg-slate-900 border-white/15 text-slate-300 hover:bg-slate-800'}">${c.label}</button>`).join('')}
        </div>
      </div>

      ${/* V32.6.6 — Removido bloco "Status" pré-confirmação. Status (Planejada/
          Rodando/Encerrada) só faz sentido APÓS confirmar a ação. Decisão
          prematura confundia o cliente. Status aparece no card confirmed. */ ''}

      <div class="flex justify-between items-center pt-2 border-t border-white/10">
        <button onclick="Actions.removeStrategicCatalogAction(${action.id})" class="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-400/30 text-red-300 text-[10px] font-black">Remover</button>
        <div class="flex items-center gap-2">
          ${!complete ? `<span class="text-[10px] text-amber-300 font-bold">Falta ${missingForCopy.join(' + ')}</span>` : ''}
          <button onclick="Actions.confirmStrategicAcao(${action.id})" ${complete ? '' : 'disabled'} class="px-3 py-1.5 rounded-lg ${complete ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'} text-[11px] font-black" ${complete ? 'style="color:#fff!important;"' : ''}>✓ Confirmar ação →</button>
        </div>
      </div>
    </div>`;
  },

  _krsLinkedToAction(productId, areaId, actionId) {
    const obj = StrategicMapEngine.getObjectiveByArea(productId, areaId);
    if (!obj) return [];
    return (obj.okrs || []).filter(kr => (kr.connectedActionIds || []).map(Number).includes(Number(actionId)));
  },

  // -------------------- STEP 5: EXECUTAR --------------------
  _stepExecution(product) {
    // V31.2.6 — Sem bifurcação CEO/Gestor. Sempre renderiza versão completa.
    // V32.14.0 — Etapa 6 reformulada: ACOMPANHAMENTO (não mais "criar tarefas",
    // que já migrou pra Etapa 5 via Executar Ação). Agora é o dashboard pós-
    // execução: filtro campanha/produto + stat cards + KRs com saúde + ações
    // com status agregado.
    const campaignId = App.state.strategicMapCampaignId;
    const acompanhamentoScope = App.state.strategicAcompanhamentoScope || 'campaign';  // 'campaign' | 'product'
    const isProductWide = acompanhamentoScope === 'product';

    // Source dos KRs: branch da campanha OU todas branches do produto
    let kruzhAll = [];
    if (isProductWide) {
      const branches = StrategicMapEngine.getBranchesByProduct(product.id) || [];
      branches.forEach(b => {
        (b.objectives || []).forEach(o => {
          (o.okrs || []).forEach(kr => kruzhAll.push({ obj: o, kr, branchCampaignId: b.campaignId }));
        });
      });
    } else if (campaignId) {
      const branch = StrategicMapEngine.getBranchMap(campaignId);
      (branch?.objectives || []).forEach(o => {
        (o.okrs || []).forEach(kr => kruzhAll.push({ obj: o, kr, branchCampaignId: campaignId }));
      });
    }
    const connectedKrs = kruzhAll.filter(({ kr }) => (kr.connectedActionIds || []).length > 0);

    // Auto-sync silencioso
    if (window.Actions?._autoSyncClickupTasksOnce) {
      Actions._autoSyncClickupTasksOnce(`mapa-etapa6-${isProductWide ? 'product' : campaignId}`);
    }

    // Header com filtro
    const campaigns = (App.state.campaigns || []).filter(c => Number(c.productId) === Number(product.id));
    const currentCampaign = campaigns.find(c => Number(c.id) === Number(campaignId));
    const scopeSelector = `<div class="flex items-center gap-2 flex-wrap">
      <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Escopo</label>
      <select onchange="Actions.setAcompanhamentoScope(this.value)" class="px-3 py-2 rounded-lg bg-slate-800 border border-white/10 text-white text-[12px] font-bold">
        ${campaignId ? `<option value="campaign" ${!isProductWide ? 'selected' : ''}>Campanha: ${Utils.escape(currentCampaign?.name || 'atual')}</option>` : ''}
        <option value="product" ${isProductWide ? 'selected' : ''}>📊 Produto inteiro (${campaigns.length} campanhas)</option>
      </select>
    </div>`;

    if (!connectedKrs.length) {
      return `<section class="space-y-3">
        ${this._stepIntro('Acompanhamento em campo', 'Como cada número e cada ação está performando no provider operacional.', 'activity')}
        ${scopeSelector}
        <div class="rounded-3xl bg-amber-500/10 border border-amber-400/30 p-5 text-amber-200">
          <p class="font-black mb-1">Nenhum número conectado a ação ainda.</p>
          <p class="text-sm">Volte pra <b>As Ações</b> e plugue ao menos um número a uma ação.</p>
          <button onclick="Actions.setStrategicZoom('operations')" class="mt-3 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-black">← Voltar pra As Ações</button>
        </div>
      </section>`;
    }

    // Agrega stats (V32.14.0)
    const stats = this._acompanhamentoStats(connectedKrs, isProductWide);
    return `<section class="space-y-3">
      ${this._stepIntro('Acompanhamento em campo', 'Como cada número e cada ação está performando no provider operacional.', 'activity')}
      ${scopeSelector}
      ${this._acompanhamentoStatCards(stats)}
      ${this._acompanhamentoKrList(product, connectedKrs)}
      ${this._acompanhamentoActionsList(connectedKrs)}
      ${this._acompanhamentoCargaUsuariosList(connectedKrs)}
      ${this._acompanhamentoGanttTimeline(connectedKrs)}
    </section>`;
  },

  // V32.14.5 — Gantt timeline simples no Acompanhamento. Barras horizontais
  // representam tasks entre start_date e due_date. Cor por status (em dia,
  // atrasada, completa). Range temporal auto-calculado pelas tasks existentes.
  _acompanhamentoGanttTimeline(connectedKrs) {
    const allActionIds = new Set();
    connectedKrs.forEach(({ kr }) => {
      (kr.connectedActionIds || []).forEach(aid => allActionIds.add(Number(aid)));
    });
    if (allActionIds.size === 0) return '';
    const allTasks = window.ExecutionTaskStore
      ? (ExecutionTaskStore.all() || []).filter(t => allActionIds.has(Number(t.linked_action_id)) && t.due_date)
      : [];
    if (allTasks.length === 0) {
      // V32.15.0 — Recolhível mesmo no estado vazio.
      const empty = this._acompanhamentoSectionHeader('gantt', 'bar-chart-horizontal', 'Cronograma (Gantt)');
      return `<div class="rounded-3xl bg-slate-900/40 border border-white/10 p-4">
        ${empty.headerHtml}
        ${empty.isCollapsed ? '' : `<p class="text-[11px] text-slate-500 italic">Sem tasks com data de entrega ainda. Crie tasks via "Executar Ação" pra ver o cronograma aqui.</p>`}
      </div>`;
    }

    // Calcula range temporal: min start vs min due, max due
    const parseDate = (s) => s ? new Date(s) : null;
    const taskRanges = allTasks.map(t => {
      const due = parseDate(t.due_date);
      let start = parseDate(t.start_date);
      // Sem start, assume 7 dias antes do due (default visual)
      if (!start) start = new Date(due.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { task: t, start, end: due };
    });
    const minDate = new Date(Math.min(...taskRanges.map(r => r.start.getTime())));
    const maxDate = new Date(Math.max(...taskRanges.map(r => r.end.getTime())));
    // Margem 5% nas pontas
    const totalMs = maxDate - minDate;
    const margin = totalMs * 0.05;
    const rangeStart = new Date(minDate.getTime() - margin);
    const rangeEnd = new Date(maxDate.getTime() + margin);
    const rangeMs = rangeEnd - rangeStart;

    // Marcadores temporais — divide o range em 4-5 ticks
    const tickCount = 5;
    const ticks = [];
    for (let i = 0; i < tickCount; i++) {
      const t = new Date(rangeStart.getTime() + (rangeMs * i / (tickCount - 1)));
      ticks.push({
        pct: (i / (tickCount - 1)) * 100,
        label: t.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
      });
    }

    // Marca de "hoje" (se está dentro do range)
    const now = new Date();
    const todayPct = (now >= rangeStart && now <= rangeEnd)
      ? ((now - rangeStart) / rangeMs) * 100
      : null;

    // Ordena tasks por start_date asc
    taskRanges.sort((a, b) => a.start - b.start);

    // V32.15.0 — Recolhível (state.acompanhamentoSectionsCollapsed.gantt).
    const { headerHtml, isCollapsed } = this._acompanhamentoSectionHeader('gantt', 'bar-chart-horizontal', `Cronograma (Gantt) · ${taskRanges.length} task${taskRanges.length === 1 ? '' : 's'}`);
    return `<div class="rounded-3xl bg-slate-900/40 border border-white/10 p-4">
      ${headerHtml}
      ${isCollapsed ? '' : `<!-- Header de marcadores temporais -->
      <div class="relative h-6 mb-2 border-b border-white/10">
        ${ticks.map(t => `<div class="absolute top-0 bottom-0 flex items-center" style="left:${t.pct}%; transform:translateX(-50%);">
          <span class="text-[9px] font-bold text-slate-500 whitespace-nowrap">${t.label}</span>
        </div>`).join('')}
        ${todayPct !== null ? `<div class="absolute top-0 bottom-0 w-px bg-violet-400" style="left:${todayPct}%;" title="Hoje"></div>` : ''}
      </div>

      <!-- Linhas de tasks -->
      <div class="space-y-1.5 relative">
        ${todayPct !== null ? `<div class="absolute top-0 bottom-0 w-px bg-violet-400/40 pointer-events-none z-10" style="left:${todayPct}%;"></div>` : ''}
        ${taskRanges.map(r => this._acompanhamentoGanttRow(r, rangeStart, rangeMs, now)).join('')}
      </div>

      ${todayPct !== null ? `<p class="text-[9px] text-violet-400 mt-2 inline-flex items-center gap-1"><span class="inline-block w-2 h-px bg-violet-400"></span> Hoje (${now.toLocaleDateString('pt-BR')})</p>` : ''}`}
    </div>`;
  },

  // V32.14.5 — Linha de uma task no Gantt. Calcula posição/largura % e cor por status.
  _acompanhamentoGanttRow({ task, start, end }, rangeStart, rangeMs, now) {
    const startPct = Math.max(0, ((start - rangeStart) / rangeMs) * 100);
    const endPct = Math.min(100, ((end - rangeStart) / rangeMs) * 100);
    const widthPct = Math.max(2, endPct - startPct);  // min 2% pra ficar visível
    const isCompleted = task.status === 'completed';
    const isLate = !isCompleted && end < now;
    const tone = isCompleted ? 'emerald' : isLate ? 'rose' : 'sky';
    const statusLabel = isCompleted ? 'Concluída' : isLate ? 'Atrasada' : 'Em curso';
    const dueLabel = task.due_date ? new Date(task.due_date).toLocaleDateString('pt-BR') : '—';
    return `<div class="grid items-center gap-2" style="grid-template-columns: 160px 1fr;">
      <div class="min-w-0">
        <p class="text-[11px] font-bold text-white truncate" title="${Utils.escape(task.title || '')}">${Utils.escape(task.title || 'Task')}</p>
        <p class="text-[9px] text-slate-500 truncate">${dueLabel} · ${statusLabel}</p>
      </div>
      <div class="relative h-5 rounded bg-white/5">
        <button onclick="Actions.openExecutionTaskDetail('${task.task_id}')" title="${Utils.escape(task.title || '')} · ${statusLabel} · entrega ${dueLabel}"
          class="absolute top-0 bottom-0 rounded bg-gradient-to-r from-${tone}-500 to-${tone}-400 hover:opacity-80 transition border border-${tone}-300/40"
          style="left:${startPct}%; width:${widthPct}%;">
          <span class="absolute inset-0 grid place-items-center text-[9px] font-black text-white px-1 truncate" style="color:#fff !important;">${widthPct > 15 ? Utils.escape(task.title || '').slice(0, 20) : ''}</span>
        </button>
      </div>
    </div>`;
  },

  // V32.14.4 — Bloco "Carga por usuário" no Acompanhamento. Ranking de
  // responsáveis ClickUp por volume de tasks atribuídas. Identifica gargalos
  // (1 pessoa com 12 tasks vs outra com 2) e tasks sem responsável.
  _acompanhamentoCargaUsuariosList(connectedKrs) {
    const allActionIds = new Set();
    connectedKrs.forEach(({ kr }) => {
      (kr.connectedActionIds || []).forEach(aid => allActionIds.add(Number(aid)));
    });
    if (allActionIds.size === 0) return '';
    const allTasks = window.ExecutionTaskStore
      ? (ExecutionTaskStore.all() || []).filter(t => allActionIds.has(Number(t.linked_action_id)))
      : [];
    if (allTasks.length === 0) return '';

    // Agrega por assignee
    const carga = new Map();  // userId → { count, completed, late, onTime }
    const noAssigneeBucket = { count: 0, completed: 0, late: 0, onTime: 0 };
    const now = new Date();
    allTasks.forEach(t => {
      const isCompleted = t.status === 'completed';
      const due = t.due_date ? new Date(t.due_date) : null;
      const isLate = !isCompleted && due && due < now;
      const isOnTime = !isCompleted && !isLate;
      const assignees = Array.isArray(t.assignees) ? t.assignees : [];
      if (assignees.length === 0) {
        noAssigneeBucket.count++;
        if (isCompleted) noAssigneeBucket.completed++;
        else if (isLate) noAssigneeBucket.late++;
        else if (isOnTime) noAssigneeBucket.onTime++;
      } else {
        assignees.forEach(aid => {
          const key = String(aid);
          if (!carga.has(key)) carga.set(key, { userId: key, count: 0, completed: 0, late: 0, onTime: 0 });
          const bucket = carga.get(key);
          bucket.count++;
          if (isCompleted) bucket.completed++;
          else if (isLate) bucket.late++;
          else if (isOnTime) bucket.onTime++;
        });
      }
    });

    // Cruza com members do ClickUp
    const members = App.state.clickupMeta?.members || [];
    const entries = Array.from(carga.values()).map(b => {
      const m = members.find(mem => String(mem.id) === b.userId);
      return {
        ...b,
        username: m?.username || `User ${b.userId}`,
        email: m?.email || ''
      };
    });
    // Sort desc por count
    entries.sort((a, b) => b.count - a.count);
    const maxCount = Math.max(noAssigneeBucket.count, ...entries.map(e => e.count));
    if (maxCount === 0) return '';

    const renderBar = (count, label, sublabel, completed, late, onTime, isNoAssignee) => {
      const widthPct = Math.round((count / maxCount) * 100);
      const tone = isNoAssignee ? 'amber' : (count >= maxCount * 0.7 ? 'rose' : count >= maxCount * 0.4 ? 'sky' : 'emerald');
      const initial = label.charAt(0).toUpperCase();
      return `<div class="rounded-xl bg-slate-900/60 border border-white/10 p-3">
        <div class="flex items-center justify-between gap-3 mb-2">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <span class="shrink-0 w-8 h-8 rounded-lg bg-${tone}-500/20 border border-${tone}-400/30 grid place-items-center text-${tone}-200 text-xs font-black">${isNoAssignee ? '?' : Utils.escape(initial)}</span>
            <div class="min-w-0">
              <p class="font-black text-white text-[13px] truncate" title="${Utils.escape(label)}">${Utils.escape(label)}${isNoAssignee ? ` <span class="text-amber-400 text-[10px] font-bold">⚠</span>` : ''}</p>
              ${sublabel ? `<p class="text-[10px] text-slate-500 truncate">${Utils.escape(sublabel)}</p>` : ''}
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            ${completed > 0 ? `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 uppercase tracking-wider">✓ ${completed}</span>` : ''}
            ${onTime > 0 ? `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-400/30 text-sky-200 uppercase tracking-wider">⏱ ${onTime}</span>` : ''}
            ${late > 0 ? `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-400/30 text-rose-200 uppercase tracking-wider">⚠ ${late}</span>` : ''}
            <span class="text-[12px] font-black text-white whitespace-nowrap ml-1">${count}</span>
          </div>
        </div>
        <div class="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div class="h-full bg-gradient-to-r from-${tone}-500 to-${tone}-400" style="width:${widthPct}%;"></div>
        </div>
      </div>`;
    };

    const totalUsers = entries.length + (noAssigneeBucket.count > 0 ? 1 : 0);
    // V32.15.0 — Recolhível (state.acompanhamentoSectionsCollapsed.carga).
    const { headerHtml, isCollapsed } = this._acompanhamentoSectionHeader('carga', 'users', `Carga por usuário (ClickUp) · ${totalUsers} ${totalUsers === 1 ? 'responsável' : 'responsáveis'}`);
    return `<div class="rounded-3xl bg-slate-900/40 border border-white/10 p-4">
      ${headerHtml}
      ${isCollapsed ? '' : `<div class="space-y-2">
        ${entries.map(e => renderBar(e.count, e.username, e.email, e.completed, e.late, e.onTime, false)).join('')}
        ${noAssigneeBucket.count > 0 ? renderBar(noAssigneeBucket.count, 'Sem responsável', 'Tasks órfãs — atribua alguém', noAssigneeBucket.completed, noAssigneeBucket.late, noAssigneeBucket.onTime, true) : ''}
      </div>`}
    </div>`;
  },

  // V32.14.0 — Agrega estatísticas de tasks (ClickUp + manual) pros stat cards
  // do Acompanhamento. Considera due_date pra "atrasada/em dia".
  _acompanhamentoStats(connectedKrs, isProductWide) {
    const allActionIds = new Set();
    connectedKrs.forEach(({ kr }) => {
      (kr.connectedActionIds || []).forEach(aid => allActionIds.add(Number(aid)));
    });
    const allTasks = window.ExecutionTaskStore
      ? (ExecutionTaskStore.all() || []).filter(t => allActionIds.has(Number(t.linked_action_id)))
      : [];
    const now = new Date();
    let onTime = 0, late = 0, completed = 0, noAssignee = 0, noDueDate = 0;
    allTasks.forEach(t => {
      const due = t.due_date ? new Date(t.due_date) : null;
      const isCompleted = t.status === 'completed';
      if (isCompleted) {
        completed++;
      } else if (due && due < now) {
        late++;
      } else if (due) {
        onTime++;
      } else {
        noDueDate++;
      }
      // Sem responsável: t.assignees vazio OU undefined
      if (!Array.isArray(t.assignees) || t.assignees.length === 0) noAssignee++;
    });
    return { total: allTasks.length, onTime, late, completed, noAssignee, noDueDate, actionCount: allActionIds.size, krCount: connectedKrs.length };
  },

  // V32.15.0 — Header recolhível dos blocos da Etapa 6 (Acompanhamento).
  // Felipe pediu chevron pra recolher Números/Ações/Carga/Gantt e manter só
  // o que está olhando. State persiste (acompanhamentoSectionsCollapsed.{key}).
  // Retorna { headerHtml, isCollapsed } pro caller condicionalmente renderizar o body.
  _acompanhamentoSectionHeader(key, icon, title) {
    const cur = App.state.acompanhamentoSectionsCollapsed || {};
    const isCollapsed = Boolean(cur[key]);
    const chevron = isCollapsed ? 'chevron-down' : 'chevron-up';
    const ariaLabel = isCollapsed ? `Expandir ${title}` : `Recolher ${title}`;
    const headerHtml = `<div class="flex items-center justify-between gap-2 ${isCollapsed ? '' : 'mb-3'}">
      <p class="text-[11px] font-black text-slate-400 uppercase tracking-widest inline-flex items-center gap-1.5">
        <i data-lucide="${icon}" class="w-3.5 h-3.5"></i> ${title}
      </p>
      <button onclick="Actions.toggleAcompanhamentoSection('${key}')" title="${ariaLabel}" aria-label="${ariaLabel}"
        class="shrink-0 w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 grid place-items-center transition">
        <i data-lucide="${chevron}" class="w-3.5 h-3.5"></i>
      </button>
    </div>`;
    return { headerHtml, isCollapsed };
  },

  // V32.14.0 — Stat cards horizontais. 4 indicadores principais.
  _acompanhamentoStatCards(s) {
    const card = (icon, label, value, tone) => `<div class="rounded-xl bg-${tone}-500/10 border border-${tone}-400/30 p-3">
      <div class="flex items-center gap-2 mb-1">
        <span class="w-7 h-7 rounded-lg bg-${tone}-500/20 grid place-items-center text-${tone}-300"><i data-lucide="${icon}" class="w-3.5 h-3.5"></i></span>
        <p class="text-[9px] font-black text-${tone}-200 uppercase tracking-widest leading-tight">${label}</p>
      </div>
      <p class="text-xl font-black text-white">${value}</p>
    </div>`;
    return `<div class="grid grid-cols-2 md:grid-cols-5 gap-2">
      ${card('list-checks', 'Total tasks', s.total, 'violet')}
      ${card('clock', 'Em dia', s.onTime, 'sky')}
      ${card('alert-triangle', 'Atrasadas', s.late, 'rose')}
      ${card('check-circle-2', 'Concluídas', s.completed, 'emerald')}
      ${card('user-x', 'Sem resp.', s.noAssignee, 'amber')}
    </div>`;
  },

  // V32.14.0 — Lista de KRs com saúde (% atingido, ações, tasks).
  // V32.15.0 — Recolhível via chevron (state acompanhamentoSectionsCollapsed.krs).
  _acompanhamentoKrList(product, connectedKrs) {
    if (!connectedKrs.length) return '';
    const { headerHtml, isCollapsed } = this._acompanhamentoSectionHeader('krs', 'target', `Números (KRs) — saúde por número · ${connectedKrs.length}`);
    return `<div class="rounded-3xl bg-slate-900/40 border border-white/10 p-4">
      ${headerHtml}
      ${isCollapsed ? '' : `<div class="space-y-2">
        ${connectedKrs.map(({ obj, kr, branchCampaignId }) => this._acompanhamentoKrRow(product, obj, kr, branchCampaignId)).join('')}
      </div>`}
    </div>`;
  },

  // V32.14.0 / V32.14.1 — Row de 1 KR no Acompanhamento. Lupa abre drill-down.
  _acompanhamentoKrRow(product, obj, kr, branchCampaignId) {
    const target = Number(kr.targetCommitted || 0);
    const current = Number(kr.current || 0);
    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    const actionIds = (kr.connectedActionIds || []).map(Number);
    const allTasks = window.ExecutionTaskStore
      ? (ExecutionTaskStore.all() || []).filter(t => actionIds.includes(Number(t.linked_action_id)))
      : [];
    const now = new Date();
    const late = allTasks.filter(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < now).length;
    const completed = allTasks.filter(t => t.status === 'completed').length;
    const onTime = allTasks.length - late - completed;
    const krColor = StrategicMapEngine.krColorFromId(kr.parentProductKrId || kr.id);
    const pctTone = pct >= 75 ? 'emerald' : pct >= 40 ? 'amber' : 'rose';
    return `<div class="rounded-xl bg-slate-900/60 border border-white/10 p-3 hover:bg-slate-900/80 transition" style="border-left: 4px solid ${krColor};">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span class="shrink-0 w-2 h-2 rounded-full" style="background:${krColor};"></span>
          <div class="min-w-0">
            <p class="font-black text-white text-[13px] truncate" title="${Utils.escape(kr.name)}">${Utils.escape(kr.name)}</p>
            <p class="text-[10px] text-slate-400 mt-0.5">${actionIds.length} ação${actionIds.length === 1 ? '' : 'ões'} · ${allTasks.length} task${allTasks.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          ${completed > 0 ? `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 uppercase tracking-wider"><i data-lucide="check" class="w-2.5 h-2.5 inline-block"></i> ${completed}</span>` : ''}
          ${onTime > 0 ? `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-400/30 text-sky-200 uppercase tracking-wider"><i data-lucide="clock" class="w-2.5 h-2.5 inline-block"></i> ${onTime}</span>` : ''}
          ${late > 0 ? `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-400/30 text-rose-200 uppercase tracking-wider"><i data-lucide="alert-triangle" class="w-2.5 h-2.5 inline-block"></i> ${late}</span>` : ''}
          <span class="text-[10px] font-black px-2 py-0.5 rounded bg-${pctTone}-500/15 border border-${pctTone}-400/30 text-${pctTone}-200 uppercase tracking-wider">${pct}% meta</span>
          <button onclick="Actions.openAcompanhamentoKrDetail('${kr.id}', ${branchCampaignId || 'null'})" title="Lupa: ver ações e tasks deste KR" class="shrink-0 w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-slate-200 grid place-items-center">
            <i data-lucide="search" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
      <div class="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div class="h-full bg-gradient-to-r from-${pctTone}-500 to-${pctTone}-400" style="width:${pct}%;"></div>
      </div>
    </div>`;
  },

  // V32.14.0 — Lista de ações com status agregado de suas tasks.
  // V32.15.0 — Recolhível (state.acompanhamentoSectionsCollapsed.actions).
  _acompanhamentoActionsList(connectedKrs) {
    const allActionIds = new Set();
    connectedKrs.forEach(({ kr }) => {
      (kr.connectedActionIds || []).forEach(aid => allActionIds.add(Number(aid)));
    });
    if (allActionIds.size === 0) return '';
    const actions = (App.state.actions || []).filter(a => allActionIds.has(Number(a.id)));
    if (actions.length === 0) return '';
    const { headerHtml, isCollapsed } = this._acompanhamentoSectionHeader('actions', 'zap', `Ações — status por ação · ${actions.length}`);
    return `<div class="rounded-3xl bg-slate-900/40 border border-white/10 p-4">
      ${headerHtml}
      ${isCollapsed ? '' : `<div class="space-y-2">
        ${actions.map(a => this._acompanhamentoActionRow(a)).join('')}
      </div>`}
    </div>`;
  },

  _acompanhamentoActionRow(action) {
    const tasks = window.ExecutionTaskStore
      ? (ExecutionTaskStore.all() || []).filter(t => Number(t.linked_action_id) === Number(action.id))
      : [];
    const now = new Date();
    const late = tasks.filter(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < now).length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const onTime = tasks.length - late - completed;
    return `<div class="rounded-xl bg-slate-900/60 border border-white/10 p-3 flex items-center justify-between gap-3 flex-wrap hover:bg-slate-900/80 transition">
      <div class="min-w-0 flex-1">
        <p class="font-black text-white text-[12px] truncate" title="${Utils.escape(action.name || 'Sem nome')}">${Utils.escape(action.name || 'Sem nome')}</p>
        <p class="text-[10px] text-slate-400 mt-0.5">${Utils.escape(action.channel || '— canal —')} · ${tasks.length} task${tasks.length === 1 ? '' : 's'}</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        ${completed > 0 ? `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 uppercase tracking-wider">✓ ${completed}</span>` : ''}
        ${onTime > 0 ? `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-400/30 text-sky-200 uppercase tracking-wider">⏱ ${onTime}</span>` : ''}
        ${late > 0 ? `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-400/30 text-rose-200 uppercase tracking-wider">⚠ ${late}</span>` : ''}
        ${tasks.length === 0 ? `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-400/30 text-amber-200 uppercase tracking-wider">Sem task</span>` : ''}
        <button onclick="Actions.openAcompanhamentoActionDetail(${action.id})" title="Lupa: ver tasks e KRs desta ação" class="shrink-0 w-7 h-7 rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-slate-200 grid place-items-center">
          <i data-lucide="search" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    </div>`;
  },

  _executionProviderBanner() {
    const providerId = window.ExecutionProviderRegistry?.getDefaultProviderId?.() || 'manual';
    const provider = window.ExecutionProviderRegistry?.byId(providerId);
    const cfg = window.ExecutionProviderRegistry?.getProviderConfig(providerId) || {};
    const isManual = providerId === 'manual';
    // V31.2.31 — ClickUp tem 2 paths possíveis: legado V16.3 (Execução Operacional)
    // grava cfg.connected em App.state.executionProviders; novo V31.2.29 (Integrações)
    // grava App.state.clickupStatus.connected via /api/clickup-config. Banner respeita ambos.
    const isClickup = providerId === 'clickup';
    const clickupNewConnected = isClickup && Boolean(App.state.clickupStatus?.connected);
    const isConnected = isManual || Boolean(cfg.connected) || clickupNewConnected;
    const tone = isConnected ? 'from-emerald-500/15 to-emerald-400/5 border-emerald-400/30 text-emerald-100' : 'from-amber-500/15 to-amber-400/5 border-amber-400/30 text-amber-100';
    const workspaceTag = clickupNewConnected && App.state.clickupStatus?.workspaceName
      ? ` <span class="text-[10px] font-bold opacity-80">· ${Utils.escape(App.state.clickupStatus.workspaceName)}</span>`
      : '';
    const configureSection = isClickup ? 'integrations' : 'execution';
    return `<div class="rounded-3xl bg-gradient-to-br ${tone} border p-4 flex items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl bg-white/10 grid place-items-center"><i data-lucide="${provider?.icon || 'edit'}" class="w-5 h-5"></i></div>
        <div>
          <p class="text-[10px] font-black uppercase tracking-wider opacity-80">Provider operacional ativo</p>
          <p class="font-black text-base">${Utils.escape(provider?.label || 'Manual')}${workspaceTag}</p>
          <p class="text-[11px] opacity-80 mt-0.5">${isManual ? 'Tarefas ficam no LeadJourney. Configure ClickUp/Trello para sair para sua squad.' : (isConnected ? 'Tarefas criadas aqui serão enviadas para sua squad automaticamente.' : 'Credenciais não testadas. Configure antes de disparar.')}</p>
        </div>
      </div>
      ${isManual || !isConnected ? `<button onclick="Actions.closeStrategicMap(); Actions.openSettingsModal(); Actions.setSettingsSection('${configureSection}');" class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-black whitespace-nowrap">Configurar</button>` : ''}
    </div>`;
  },

  // V32.6.9 → V32.7.0 — ClickUp = source of truth. Antes lia ExecutionTaskStore
  // local (frágil — multi-aba, race condition, snapshot restore faziam tasks
  // sumirem). Agora puxa subtasks reais via clickupActionSubtasks cache.
  // Auto-pull no abrir do step. Fallback ExecutionTaskStore em modo flat
  // (raiz=List, sem mapping cascado).
  _executionOkrCard(product, obj, kr) {
    const actions = StrategicFlowBridge.actionsForOkr(product.id, kr);
    const cache = App.state.clickupActionSubtasks || { byActionId: {}, fetchedAt: null, loading: false };
    const subtasksByAction = cache.byActionId || {};
    const rootKind = App.state.clickupStatus?.rootKind || cache.rootKind;
    const isFlatMode = rootKind === 'list';

    // Auto-pull subtasks na primeira abertura do step (1x por sessão).
    // Modo flat: pula, cai no fallback ExecutionTaskStore.
    if (!isFlatMode && App.state.clickupStatus?.connected && !cache.fetchedAt && !cache.loading && !App._clickupSubtasksPullScheduled) {
      App._clickupSubtasksPullScheduled = true;
      setTimeout(() => {
        App._clickupSubtasksPullScheduled = false;
        Actions.pullClickupActionSubtasks?.(null, true);
      }, 100);
    }

    // Coleta subtasks de TODAS as actions desse OKR.
    let tasks = [];
    if (isFlatMode) {
      // Fallback: ExecutionTaskStore (cobre tasks pré-V32.7.0 e modo list).
      tasks = (window.ExecutionTaskStore?.all() || [])
        .filter(t => actions.some(a => Number(a.id) === Number(t.linked_action_id)))
        .map(t => ({
          id: t.provider_task_id || t.task_id,
          name: t.title,
          ljStatus: t.status,
          url: t.external_url,
          fromLocal: true
        }));
    } else {
      actions.forEach(a => {
        const subs = subtasksByAction[a.id] || subtasksByAction[String(a.id)] || [];
        subs.forEach(s => tasks.push({
          id: s.id,
          name: s.name,
          status: s.status,
          statusType: s.statusType,
          url: s.url,
          assignees: s.assignees
        }));
      });
    }

    const isDoneTask = (t) => t.fromLocal ? (t.ljStatus === 'completed') : (t.statusType === 'closed');
    const executed = tasks.filter(isDoneTask).length;
    const pending = tasks.length - executed;
    const progress = StrategicOkrEngine.progress(kr);
    const status = StrategicMapRenderer.okrStatus(progress);
    const isLoading = cache.loading && !isFlatMode;
    const skippedHere = (cache.skipped && actions.some(a => cache.skipped[a.id])) ? true : false;

    const tasksList = (() => {
      if (isLoading && !tasks.length) {
        return `<div class="mt-3 pt-3 border-t border-white/10 text-[11px] text-slate-400 italic flex items-center gap-2">
          <i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Puxando tarefas do ClickUp…
        </div>`;
      }
      if (!tasks.length) {
        if (skippedHere && !isFlatMode) {
          return `<div class="mt-3 pt-3 border-t border-white/10 text-[11px] text-amber-300/80 italic">
            Ações ainda não têm task pai no ClickUp — crie uma tarefa abaixo pra começar a cadeia.
          </div>`;
        }
        return '';
      }
      const sourceLabel = isFlatMode
        ? 'Tarefas no LJ (modo achatado)'
        : `Tarefas no ClickUp${cache.fetchedAt ? ` <span class="text-slate-500 font-normal normal-case">· lido ${new Date(cache.fetchedAt).toLocaleTimeString('pt-BR')}</span>` : ''}`;
      return `<div class="mt-3 pt-3 border-t border-white/10 space-y-1.5">
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">${sourceLabel}</p>
        ${tasks.map(t => {
          const isDone = isDoneTask(t);
          const statusLabel = t.fromLocal
            ? (t.ljStatus === 'completed' ? 'CONCLUÍDA' : t.ljStatus === 'in_progress' ? 'EM PROGRESSO' : 'PENDENTE')
            : String(t.status || '—').toUpperCase();
          const isProgress = !isDone && /progress|doing|andamento/i.test(statusLabel);
          const badgeCls = isDone
            ? 'bg-emerald-500/25 text-emerald-200 border-emerald-400/40'
            : isProgress
            ? 'bg-amber-500/25 text-amber-200 border-amber-400/40'
            : 'bg-slate-500/25 text-slate-200 border-slate-400/40';
          const badgeIcon = isDone ? '✓' : isProgress ? '○' : '◌';
          const externalLink = t.url
            ? `<a href="${Utils.escape(t.url)}" target="_blank" rel="noopener" title="Abrir no ClickUp" class="text-slate-400 hover:text-white shrink-0"><i data-lucide="external-link" class="w-3 h-3"></i></a>`
            : '';
          return `<div class="flex items-center gap-2 px-2 py-1.5 rounded-lg ${isDone ? 'bg-emerald-500/[0.04] border border-emerald-500/15' : 'bg-slate-900/40 border border-white/5'}">
            <span class="px-1.5 py-0.5 rounded text-[9px] font-black border ${badgeCls} whitespace-nowrap shrink-0">${badgeIcon} ${Utils.escape(statusLabel)}</span>
            <span class="text-[12px] font-bold text-white flex-1 min-w-0 truncate ${isDone ? 'line-through text-slate-400' : ''}">${Utils.escape(t.name)}</span>
            ${externalLink}
          </div>`;
        }).join('')}
      </div>`;
    })();

    return `<div class="rounded-3xl bg-white/[0.05] border border-white/10 p-4">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="min-w-0">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">${Utils.escape(obj.label)}</p>
          <p class="font-black text-white">${Utils.escape(kr.name)}</p>
          <p class="text-[11px] text-slate-400 mt-0.5">${Number(kr.current || 0)}/${Number(kr.target || 0)} ${Utils.escape(kr.metric)} · ${actions.length} ação(ões) · ${tasks.length} tarefa(s) (${executed} concluída · ${pending} pendente)</p>
        </div>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-${status.color}-500/20 text-${status.color}-200 border border-${status.color}-400/30 whitespace-nowrap">${progress}%</span>
      </div>
      ${StrategicMapRenderer.progressBar(progress, status.color)}
      ${tasksList}
      <div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/10">
        ${actions.map(a => `<button onclick="Actions.openTaskCreationModal(${a.id})" class="px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-[11px] font-black flex items-center gap-1.5" style="color:#fff!important;" title="Abrir modal de transição ação → ClickUp"><i data-lucide="send" class="w-3 h-3"></i> Criar task · ${Utils.escape(a.name)}</button>`).join('')}
        ${!isFlatMode && App.state.clickupStatus?.connected ? `<button onclick="Actions.pullClickupActionSubtasks(null, false)" ${isLoading ? 'disabled' : ''} class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-[11px] font-black flex items-center gap-1.5 disabled:opacity-50" title="Puxar lista atualizada do ClickUp"><i data-lucide="${isLoading ? 'loader-2' : 'refresh-cw'}" class="w-3 h-3 ${isLoading ? 'animate-spin' : ''}"></i> ${isLoading ? 'Puxando…' : 'Sync ClickUp'}</button>` : ''}
        <button onclick="Actions.syncStrategicOkrSingle('${obj.id}','${kr.id}')" class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-[11px] font-black flex items-center gap-1.5"><i data-lucide="refresh-cw" class="w-3 h-3"></i> Atualizar leitura</button>
      </div>
    </div>`;
  },

  // -------------------- COMMON --------------------
  _stepIntro(title, hint, icon, interviewKey, helpKey, helpText) {
    // V27.0.0 — interviewKey opcional ativava botão "Djow me entrevista".
    // V31.1.1 — Botão removido globalmente (criando fricção).
    // V32.5.0 (Geraldo G6) — HelpText ganha distinção visual.
    // V32.5.2 (Leonardo) — Selo "a X passos da receita" alinhado à trilha
    // térmica. Cliente sabe exatamente onde está na jornada até a Receita.
    const interviewBtn = '';
    const helpOpen = helpKey && (App.state.strategicHelpOpen || {})[helpKey];
    const helpBtn = helpKey && helpText
      ? `<button onclick="Actions.toggleStrategicHelp('${helpKey}')" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-200 text-[10px] font-black transition" title="O que é isso?">
          <i data-lucide="info" class="w-3 h-3"></i>
          ${helpOpen ? 'Fechar' : 'Entenda mais'}
        </button>`
      : '';
    const helpBalloon = helpKey && helpText && helpOpen
      ? `<div class="mt-3 rounded-2xl bg-indigo-500/[0.08] border-l-4 border-indigo-400/60 border-y border-r border-y-indigo-400/20 border-r-indigo-400/20 p-4 text-[12px] text-indigo-50 leading-relaxed relative flex gap-3">
          <i data-lucide="lightbulb" class="w-4 h-4 text-indigo-300 shrink-0 mt-0.5"></i>
          <div class="flex-1 pr-6">${Utils.escape(helpText)}</div>
          <button onclick="Actions.toggleStrategicHelp('${helpKey}')" class="absolute top-2 right-2 w-5 h-5 rounded-full text-indigo-300 hover:text-white hover:bg-indigo-500/30 text-xs font-black grid place-items-center" title="Fechar">×</button>
        </div>`
      : '';

    // V32.5.2 — Selo "X passos até a receita" usa cor térmica do step atual.
    const currentStep = StrategicZoomNavigation.current();
    const currentLevel = StrategicZoomNavigation.LEVELS.find(l => l.id === currentStep);
    const stepsLeft = StrategicZoomNavigation.stepsUntilRevenue(currentStep);
    const thermal = currentLevel?.thermal || 'indigo';
    const revenueBadge = stepsLeft !== null
      ? (stepsLeft === 0
          ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-400/40 text-yellow-200 text-[10px] font-black"><i data-lucide="circle-dollar-sign" class="w-3 h-3"></i> Você chegou à receita</span>`
          : `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-${thermal}-500/15 border border-${thermal}-400/30 text-${thermal}-100 text-[10px] font-black"><i data-lucide="map-pin" class="w-3 h-3"></i> ${stepsLeft} ${stepsLeft === 1 ? 'passo' : 'passos'} até a receita</span>`)
      : '';

    // V32.5.4 (Leonardo) — Título da etapa ganha hierarquia: pill "ETAPA N"
    // pequena lateral + título principal em text-lg branco. Antes era tudo
    // upper-case 11px — competia em volume baixo com o stepper sticky enorme
    // acima. Agora o título lidera o olho: cliente le a PERGUNTA primeiro,
    // o tabbar vira coadjuvante de wayfinding.
    const stepIdx = StrategicZoomNavigation.LEVELS.findIndex(l => l.id === currentStep);
    const stepNum = stepIdx >= 0 ? stepIdx + 1 : 1;
    return `<div>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-2 flex-wrap">
            <span class="px-2 py-0.5 rounded-full bg-${thermal}-500/20 border border-${thermal}-400/30 text-${thermal}-100 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1">
              <i data-lucide="${icon}" class="w-3 h-3"></i>
              Etapa ${stepNum}
            </span>
            ${revenueBadge}
            ${helpBtn}
          </div>
          <h3 class="text-lg md:text-xl font-black text-white leading-tight mb-1">${title}</h3>
          <p class="text-xs text-slate-400">${Utils.escape(hint)}</p>
        </div>
        ${interviewBtn}
      </div>
      ${helpBalloon}
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
      vision:     'Foco no produto. Frase curta, ambiciosa, conectada a quem ele serve.',
      objectives: 'O Comercial é um funil de 3 frentes: Marketing → Vendas → CS. Cada frente tem um dono.',
      okrs:       'Pra cada frente, 1-3 números. Marketing: leads. Vendas: clientes. CS: retenção/advocacy.',
      operations: 'Conecte cada número à ação operacional real. Pode ser mais de uma.',
      execution:  'Clique em "Criar tarefa via Djow" — a tarefa vai direto para o ClickUp/provider configurado.'
    };
    const tip = tipMap[stepId] || '';
    if (!tip) return '';
    return `<div class="rounded-xl bg-indigo-500/15 border border-indigo-400/30 p-2.5 text-[11px] text-indigo-100"><b class="text-indigo-200">Dica:</b> ${Utils.escape(tip)}</div>`;
  },

  _djowStepHints(stepId) {
    const hintsByStep = {
      vision:     ['Como escrever o objetivo do produto?', 'Exemplos de objetivo de produto', 'Objetivo muito longo, como encurtar?'],
      objectives: ['Como definir o dono de cada frente?', 'Quem deve responder por Marketing/Vendas/CS?', 'Posso ter mais de uma pessoa por frente?'],
      okrs:       ['Bons números para Marketing', 'Bons números para Vendas', 'Bons números para Sucesso do Cliente'],
      operations: ['Posso conectar uma ação a múltiplos números?', 'Como saber se uma ação serve esse número?', 'Não tenho ações ainda'],
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
    if (m.role === 'transition') {
      // V32.5.2 (Leonardo) — Hand-off entre etapas. Visual distinto: borda
      // esquerda colorida na cor térmica da etapa de chegada + check verde.
      const tone = m.thermal || 'indigo';
      return `<div class="rounded-xl bg-${tone}-500/[0.08] border-l-4 border-${tone}-400/60 border-y border-r border-y-${tone}-400/15 border-r-${tone}-400/15 px-3 py-2.5 text-[12px] text-${tone}-50 leading-relaxed flex items-start gap-2">
        <i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-300 shrink-0 mt-0.5"></i>
        <span class="whitespace-pre-wrap">${Utils.escape(m.text)}</span>
      </div>`;
    }
    return `<div class="flex justify-start"><div class="max-w-[88%] px-3 py-2 rounded-2xl bg-white/10 border border-white/15 text-slate-100 text-xs whitespace-pre-wrap">${Utils.escape(m.text)}</div></div>`;
  }
};
