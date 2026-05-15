// V16.3 — Djow Modal
// Chat com o agente Djow para criar tarefas em linguagem natural. Mostra
// histórico, status do agente, provider de destino e preview da última
// resposta (sem expor JSON técnico).
window.DjowModal = {
  render() {
    if (!App.state.showDjowModal) return '';
    const actionId = App.state.djowModalActionId;
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return '';
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId));
    const messages = (App.state.djowChats?.[actionId]?.messages) || [];
    const draft = App.state.djowDraftMessage || '';
    const sending = Boolean(App.state.djowSending);
    const health = window.AgentHealthMonitor ? AgentHealthMonitor.snapshot() : { status: 'unknown', enabled: false };
    const providerId = window.ExecutionProviderRegistry?.getDefaultProviderId?.() || 'manual';
    const provider = window.ExecutionProviderRegistry?.byId(providerId);
    const lastResponse = App.state.djowLastResponse || null;
    return `<div class="fixed inset-0 z-[80] bg-slate-950/75 backdrop-blur-sm p-4 overflow-auto grid place-items-start justify-items-center">
      <div class="rounded-[2rem] overflow-hidden shadow-2xl text-white" style="width:90vw;max-width:920px;background: radial-gradient(circle at 18% 10%, rgba(99,102,241,.22), transparent 30%), #071326;">
        ${this._header(action, campaign, health, provider)}
        <div class="p-5 grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          <div class="rounded-3xl bg-white/[0.04] border border-white/10 p-4 flex flex-col gap-3" style="min-height:60vh;max-height:65vh;">
            <div class="flex-1 overflow-auto space-y-2 pr-1">
              ${messages.length ? messages.map(m => this._message(m)).join('') : this._emptyState(action)}
            </div>
            <div class="border-t border-white/10 pt-3">
              <textarea ${sending ? 'disabled' : ''} oninput="Actions.updateDjowDraft(this.value)" placeholder="Ex: Djow, crie uma tarefa de criação de LP para o Thiago executar até 21/05." class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white font-semibold text-sm min-h-[80px] placeholder:text-slate-500" style="color-scheme:dark;">${Utils.escape(draft)}</textarea>
              <div class="flex items-center justify-between gap-2 mt-2">
                <p class="text-[11px] text-slate-400">${sending ? 'Djow processando…' : 'Enter envia (Shift+Enter pula linha).'}</p>
                <button ${sending ? 'disabled' : ''} onclick="Actions.sendDjowMessage()" class="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-600 text-white font-black text-sm flex items-center gap-2" style="color:#fff!important;">${sending ? '<span class="w-3.5 h-3.5 rounded-full border-2 border-current border-r-transparent animate-spin"></span>' : '<i data-lucide="send" class="w-3.5 h-3.5"></i>'} Executar</button>
              </div>
            </div>
          </div>
          ${this._sidePanel(provider, lastResponse, action)}
        </div>
      </div>
    </div>`;
  },

  _header(action, campaign, health, provider) {
    const dotColor = health.status === 'online' ? '#10b981' : health.status === 'offline' ? '#ef4444' : '#94a3b8';
    return `<header class="p-5 border-b border-white/10 flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1"><i data-lucide="cpu" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-slate-300 uppercase tracking-wider">Djow • Execução Operacional</p></div>
        <h2 class="text-2xl font-black">${Utils.escape(action.name || 'Ação')}</h2>
        <p class="text-xs text-slate-300 mt-1">Campanha: <b class="text-white">${Utils.escape(campaign?.name || '—')}</b> • Provider de destino: <b class="text-white">${Utils.escape(provider?.label || 'Manual')}</b></p>
      </div>
      <div class="flex items-center gap-2">
        <span class="px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs font-black flex items-center gap-2"><span class="w-2 h-2 rounded-full" style="background:${dotColor};"></span> ${health.status === 'online' ? 'Online' : health.status === 'offline' ? 'Offline' : (health.enabled ? 'Aguardando teste' : 'Desativado')}</span>
        <button onclick="Actions.closeDjowModal()" class="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-semibold flex items-center gap-2"><i data-lucide="x" class="w-4 h-4"></i> Fechar</button>
      </div>
    </header>`;
  },

  _emptyState(action) {
    return `<div class="h-full grid place-items-center text-center text-slate-400 p-6">
      <div>
        <i data-lucide="sparkles" class="w-7 h-7 mx-auto mb-2 text-indigo-300"></i>
        <p class="text-sm">Converse com o Djow em linguagem natural.</p>
        <p class="text-[11px] mt-1">O Djow vai estruturar a tarefa e o LeadJourney cria no provider configurado.</p>
      </div>
    </div>`;
  },

  _message(m) {
    if (m.role === 'user') {
      return `<div class="flex justify-end"><div class="max-w-[80%] px-3.5 py-2 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-50 text-sm whitespace-pre-wrap">${Utils.escape(m.text)}</div></div>`;
    }
    if (m.role === 'task') {
      const t = m.task || {};
      return `<div class="flex justify-start"><div class="max-w-[85%] px-3.5 py-3 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-50 text-sm">
        <p class="font-black text-emerald-200 text-xs uppercase tracking-wider mb-1">Tarefa criada</p>
        <p class="font-black">${Utils.escape(t.title || 'Tarefa')}</p>
        <p class="text-xs mt-1">${t.assignee ? `Responsável: <b>${Utils.escape(t.assignee)}</b> · ` : ''}${t.due_date ? `Prazo: <b>${Utils.escape(t.due_date)}</b> · ` : ''}Prioridade: <b>${Utils.escape(t.priority || 'normal')}</b></p>
        ${t.description ? `<p class="text-xs mt-1 text-emerald-100/80">${Utils.escape(t.description)}</p>` : ''}
      </div></div>`;
    }
    return `<div class="flex justify-start"><div class="max-w-[80%] px-3.5 py-2 rounded-2xl bg-white/10 border border-white/15 text-slate-100 text-sm whitespace-pre-wrap">${Utils.escape(m.text)}</div></div>`;
  },

  _sidePanel(provider, lastResponse, action) {
    const taskCount = window.ExecutionStatusEngine ? ExecutionStatusEngine.forAction(action.id) : { total: 0, executed: 0 };
    return `<aside class="rounded-3xl bg-white/[0.055] border border-white/10 p-4 space-y-3">
      <div>
        <p class="text-[10px] font-black uppercase tracking-wider text-slate-400">Provider ativo</p>
        <div class="flex items-center gap-2 mt-1"><i data-lucide="${provider?.icon || 'edit'}" class="w-4 h-4" style="color:${provider?.tone || '#94a3b8'};"></i><p class="text-sm font-black text-white">${Utils.escape(provider?.label || 'Manual')}</p></div>
      </div>
      <div>
        <p class="text-[10px] font-black uppercase tracking-wider text-slate-400">Tarefas desta ação</p>
        <p class="text-2xl font-black text-white mt-1">${taskCount.total}</p>
        <p class="text-[11px] text-slate-400">${taskCount.executed} concluída(s)</p>
      </div>
      ${lastResponse ? `<div class="rounded-2xl bg-black/30 border border-white/10 p-3">
        <p class="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Última execução</p>
        <p class="text-[11px] text-slate-300">Agente: <b>${Utils.escape(lastResponse.agentUsed || 'fallback')}</b> · ${Number(lastResponse.latencyMs || 0)}ms</p>
      </div>` : ''}
      <button onclick="Actions.openTasksModal(${action.id})" class="w-full px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-black text-xs">Ver tarefas da ação</button>
    </aside>`;
  }
};
