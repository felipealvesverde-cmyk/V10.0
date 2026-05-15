// V17.2 — Quick Action Modal
// Cria uma ação com campos mínimos a partir do Step 4 do Mapa da Receita.
// A ação fica marcada como isDraft:true até o usuário completar em
// Ações de Campanha. Auto-conecta ao OKR no contexto.
window.QuickActionModal = {
  render() {
    if (!App.state.showQuickActionModal) return '';
    const ctx = App.state.quickActionContext;
    if (!ctx) return '';
    const draft = App.state.quickActionDraft || {};
    const campaigns = (App.state.campaigns || []).filter(c => Number(c.productId) === Number(ctx.productId));
    if (!campaigns.length) return '';
    const product = (App.state.products || []).find(p => Number(p.id) === Number(ctx.productId));
    const channels = window.Config?.allChannels?.() || (Config?.channels || []);
    const types = window.Config?.allActionTypes?.() || (Config?.actionTypes || []);
    return `<div class="fixed inset-0 z-[90] bg-slate-950/85 backdrop-blur-sm grid place-items-center p-4">
      <div class="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden">
        <header class="bg-slate-950 text-white p-5">
          <div class="flex items-center gap-2 mb-2"><i data-lucide="bolt" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-slate-300 uppercase tracking-wider">Modo rápido</p></div>
          <h3 class="text-xl font-black">Criar ação rápida</h3>
          <p class="text-xs text-slate-300 mt-1">Para o OKR já conectar agora. Você completa os detalhes depois em <b>Ações de Campanha</b>.</p>
        </header>
        <div class="p-5 space-y-3">
          <div>
            <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Nome da ação</label>
            <input value="${Utils.escape(draft.name || '')}" oninput="Actions.updateQuickActionDraft('name', this.value)" placeholder="Ex: Post orgânico Instagram" class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-100 border border-slate-200 font-semibold text-slate-900" autofocus />
          </div>
          ${campaigns.length > 1 ? `<div>
            <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Campanha</label>
            <select onchange="Actions.updateQuickActionDraft('campaignId', Number(this.value))" class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-100 border border-slate-200 font-semibold text-slate-900">
              ${campaigns.map(c => `<option value="${c.id}" ${Number(draft.campaignId) === Number(c.id) ? 'selected' : ''}>${Utils.escape(c.name)}</option>`).join('')}
            </select>
          </div>` : `<div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600"><b>Campanha:</b> ${Utils.escape(campaigns[0]?.name || '—')} <span class="text-slate-400">(única deste produto)</span></div>`}
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Canal</label>
              <select onchange="Actions.updateQuickActionDraft('channel', this.value)" class="mt-1 w-full px-3 py-3 rounded-2xl bg-slate-100 border border-slate-200 font-semibold text-slate-900">
                ${channels.map(ch => `<option value="${Utils.escape(ch)}" ${draft.channel === ch ? 'selected' : ''}>${Utils.escape(ch)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Tipo</label>
              <select onchange="Actions.updateQuickActionDraft('actionType', this.value)" class="mt-1 w-full px-3 py-3 rounded-2xl bg-slate-100 border border-slate-200 font-semibold text-slate-900">
                ${types.map(t => `<option value="${Utils.escape(t)}" ${draft.actionType === t ? 'selected' : ''}>${Utils.escape(t)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
            <i data-lucide="alert-triangle" class="w-3.5 h-3.5 mt-0.5 shrink-0"></i>
            <p>Esta ação é criada como <b>rascunho</b>. Para a leitura do OKR ficar precisa (leads, conversão, fluxo), abra a aba <b>Ações de Campanha</b> e complete os campos.</p>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button onclick="Actions.closeQuickActionModal()" class="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-sm">Cancelar</button>
            <button onclick="Actions.createQuickAction()" class="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center gap-2" style="color:#fff!important;"><i data-lucide="plus" class="w-4 h-4"></i> Criar e conectar ao OKR</button>
          </div>
        </div>
      </div>
    </div>`;
  }
};
