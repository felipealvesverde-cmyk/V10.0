// V34.9.4 — Modal de conciliação RD↔LJ com 3 seções:
//   1. Conflitos a resolver (alerts campo-a-campo, ação manual)
//   2. Stages aguardando RD (sistema processa, ação não exigida)
//   3. Deals aguardando criação (sistema processa, ação não exigida)
//
// Ao abrir o modal, conflitos não-lidos são marcados read (sai do badge).

window.ReconciliationModal = {
  render() {
    const m = App.state.reconciliationModal;
    if (!m || !m.open) return '';
    const counts = App.state.reconciliationCounts || {};
    const alerts = m.alerts || [];
    const stagePending = m.stagePending || [];
    const dealPending = m.dealPending || [];
    const loading = Boolean(m.loading);
    const resolvingId = m.resolvingId;

    return `<div id="reconciliationModalBackdrop" class="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm p-4 overflow-auto" onclick="if(event.target===this) Actions.closeReconciliationModal()">
      <section class="max-w-4xl mx-auto rounded-[2rem] bg-slate-50 shadow-2xl overflow-hidden border border-white/20">
        <header class="bg-slate-950 text-white p-6 flex items-start justify-between gap-4">
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-200 text-xs font-black mb-3">
              <i data-lucide="bell" class="w-3.5 h-3.5"></i>
              NOTIFICAÇÕES
            </div>
            <h2 class="text-3xl font-black">Conciliação LJ ↔ RD</h2>
            <p class="text-slate-300 mt-2 text-sm">3 tipos de pendência. Conflitos exigem ação. Stages e Deals aguardando o sistema processar automaticamente no próximo ciclo.</p>
          </div>
          <button onclick="Actions.closeReconciliationModal()" class="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 font-black flex items-center gap-2">
            <i data-lucide="x" class="w-4 h-4"></i>
            Fechar
          </button>
        </header>

        <main class="p-5 lg:p-6 max-h-[75vh] overflow-y-auto space-y-5">
          ${loading ? `<p class="text-sm text-slate-500">Carregando…</p>` : ''}
          ${!loading ? this._conflictsSection(alerts, resolvingId) : ''}
          ${!loading ? this._stagePendingSection(stagePending, counts.pendingStage || 0) : ''}
          ${!loading ? this._dealPendingSection(dealPending, counts.pendingDeal || 0) : ''}
          ${!loading && !alerts.length && !stagePending.length && !dealPending.length ? `
            <div class="rounded-3xl bg-emerald-50 border-2 border-emerald-200 p-6 text-center">
              <i data-lucide="check-circle-2" class="w-8 h-8 text-emerald-700 inline-block mb-2"></i>
              <p class="text-base font-black text-emerald-900">Tudo sincronizado.</p>
              <p class="text-xs text-emerald-800 mt-1">LJ e RD estão alinhados. Próxima notificação aparece aqui quando algo precisar de atenção.</p>
            </div>
          ` : ''}
        </main>
      </section>
    </div>`;
  },

  _conflictsSection(alerts, resolvingId) {
    if (!alerts.length) return '';
    return `<div class="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
          <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-600"></i>
          Conflitos a resolver
          <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">${alerts.length}</span>
        </h3>
      </div>
      <p class="text-xs text-slate-500 mb-3">LJ e RD têm valores diferentes pra mesmo campo. Você decide qual ganha.</p>
      <div class="space-y-3">
        ${alerts.map(a => this._alertRow(a, resolvingId)).join('')}
      </div>
    </div>`;
  },

  _stagePendingSection(rows, totalCount) {
    if (!totalCount) return '';
    return `<div class="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
          <i data-lucide="refresh-ccw" class="w-4 h-4 text-sky-600"></i>
          Stages aguardando RD
          <span class="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-black">${totalCount}</span>
        </h3>
      </div>
      <p class="text-xs text-slate-500 mb-3">O LJ moveu esses leads de etapa mas o RD ainda não foi atualizado. Próximo ciclo do motor sincroniza automaticamente. Clique "Conciliar" no Flow Map pra acelerar.</p>
      <div class="space-y-1.5 max-h-64 overflow-y-auto">
        ${rows.slice(0, 50).map(v => `<div class="flex items-center gap-2 p-2 rounded-xl bg-sky-50 border border-sky-100 text-xs">
          <span class="font-black text-sky-900 truncate flex-1">${Utils.escape(v.name || v.email || v.lj_visitor_id)}</span>
          <span class="text-[10px] text-sky-700 shrink-0">${Utils.escape(v.current_stage || '-')}</span>
          ${v.external_rd_sync_error ? `<span class="text-[10px] text-amber-700 shrink-0" title="${Utils.escape(v.external_rd_sync_error)}">⚠</span>` : ''}
        </div>`).join('')}
        ${rows.length > 50 ? `<p class="text-[11px] text-slate-500 italic text-center pt-2">+ ${rows.length - 50} adicionais (limite de exibição)</p>` : ''}
      </div>
    </div>`;
  },

  _dealPendingSection(rows, totalCount) {
    if (!totalCount) return '';
    return `<div class="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
          <i data-lucide="plus-square" class="w-4 h-4 text-violet-600"></i>
          Deals aguardando criação
          <span class="px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 text-[10px] font-black">${totalCount}</span>
        </h3>
      </div>
      <p class="text-xs text-slate-500 mb-3">Esses leads não têm deal no RD ainda. O motor cria automaticamente no próximo ciclo (POST /deals com contato vinculado).</p>
      <div class="space-y-1.5 max-h-64 overflow-y-auto">
        ${rows.slice(0, 50).map(v => `<div class="flex items-center gap-2 p-2 rounded-xl bg-violet-50 border border-violet-100 text-xs">
          <span class="font-black text-violet-900 truncate flex-1">${Utils.escape(v.name || v.email || v.lj_visitor_id)}</span>
          <span class="text-[10px] text-violet-700 shrink-0">${Utils.escape(v.current_stage || '-')}</span>
          ${v.external_rd_sync_error ? `<span class="text-[10px] text-amber-700 shrink-0" title="${Utils.escape(v.external_rd_sync_error)}">⚠</span>` : ''}
        </div>`).join('')}
        ${rows.length > 50 ? `<p class="text-[11px] text-slate-500 italic text-center pt-2">+ ${rows.length - 50} adicionais (limite de exibição)</p>` : ''}
      </div>
    </div>`;
  },

  _alertRow(a, resolvingId) {
    const isResolving = resolvingId === a.id;
    const ljTs = a.lj_updated_at ? new Date(a.lj_updated_at).toLocaleString('pt-BR') : '—';
    const rdTs = a.rd_updated_at ? new Date(a.rd_updated_at).toLocaleString('pt-BR') : '—';
    const visitorLabel = a.visitor_name || a.visitor_email || a.lj_visitor_id;
    const fieldLabel = ({ name: 'Nome', phone: 'Telefone', email: 'Email' })[a.field] || a.field;

    return `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-4 ${isResolving ? 'opacity-60' : ''}">
      <div class="flex items-center justify-between gap-3 mb-3">
        <div class="min-w-0">
          <p class="text-xs font-black text-slate-500 uppercase tracking-widest">${Utils.escape(fieldLabel)}</p>
          <p class="text-base font-black text-slate-900 truncate">${Utils.escape(visitorLabel)}</p>
          <p class="text-[10px] text-slate-500">${Utils.escape(a.visitor_email || '—')}</p>
        </div>
        <div class="text-[10px] text-slate-400 text-right shrink-0">
          ${a.detected_at ? new Date(a.detected_at).toLocaleString('pt-BR') : '—'}
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
        <div class="rounded-xl bg-violet-50 border-2 border-violet-200 p-2">
          <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest mb-1">LJ</p>
          <p class="text-xs font-bold text-violet-900 break-words">${Utils.escape(a.lj_value || '(vazio)')}</p>
          <p class="text-[10px] text-violet-700 mt-1">${ljTs}</p>
        </div>
        <div class="rounded-xl bg-sky-50 border-2 border-sky-200 p-2">
          <p class="text-[10px] font-black text-sky-700 uppercase tracking-widest mb-1">RD</p>
          <p class="text-xs font-bold text-sky-900 break-words">${Utils.escape(a.rd_value || '(vazio)')}</p>
          <p class="text-[10px] text-sky-700 mt-1">${rdTs}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button ${isResolving ? 'disabled' : ''} onclick="Actions.resolveReconciliationAlert(${a.id}, 'keep_lj')"
                class="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-black flex items-center gap-1" style="color:#fff!important;">
          <i data-lucide="arrow-up-circle" class="w-3 h-3"></i>
          Manter LJ
        </button>
        <button ${isResolving ? 'disabled' : ''} onclick="Actions.resolveReconciliationAlert(${a.id}, 'keep_rd')"
                class="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-black flex items-center gap-1" style="color:#fff!important;">
          <i data-lucide="arrow-down-circle" class="w-3 h-3"></i>
          Aceitar RD
        </button>
        <button ${isResolving ? 'disabled' : ''} onclick="Actions.resolveReconciliationAlert(${a.id}, 'dismiss')"
                class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-[11px] font-black flex items-center gap-1">
          <i data-lucide="x-circle" class="w-3 h-3"></i>
          Descartar
        </button>
      </div>
    </div>`;
  }
};
