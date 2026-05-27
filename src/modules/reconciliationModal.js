// V34.8.0 — Modal de conciliação RD↔LJ.
// Renderiza alertas (visitor + campo + valor LJ vs RD) com 3 botões por linha:
// Manter LJ (push pro RD) · Aceitar RD (sobrescreve LJ) · Descartar.

window.ReconciliationModal = {
  render() {
    const m = App.state.reconciliationModal;
    if (!m || !m.open) return '';
    const alerts = m.alerts || [];
    const loading = Boolean(m.loading);
    const resolvingId = m.resolvingId;

    return `<div id="reconciliationModalBackdrop" class="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm p-4 overflow-auto" onclick="if(event.target===this) Actions.closeReconciliationModal()">
      <section class="max-w-4xl mx-auto rounded-[2rem] bg-slate-50 shadow-2xl overflow-hidden border border-white/20">
        <header class="bg-slate-950 text-white p-6 flex items-start justify-between gap-4">
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-200 text-xs font-black mb-3">
              <i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i>
              CONCILIAÇÃO LJ ↔ RD
            </div>
            <h2 class="text-3xl font-black">Resolver conflitos</h2>
            <p class="text-slate-300 mt-2 text-sm">
              Quando LJ e RD têm valores diferentes pra mesmo campo, sem um claro "mais recente", o sistema espera você decidir.
              <strong class="text-white">Manter LJ</strong> = empurra valor LJ pro RD. <strong class="text-white">Aceitar RD</strong> = sobrescreve LJ. <strong class="text-white">Descartar</strong> = ignora o conflito.
            </p>
          </div>
          <button onclick="Actions.closeReconciliationModal()" class="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 font-black flex items-center gap-2">
            <i data-lucide="x" class="w-4 h-4"></i>
            Fechar
          </button>
        </header>

        <main class="p-5 lg:p-6 max-h-[70vh] overflow-y-auto">
          ${loading ? `<p class="text-sm text-slate-500">Carregando alertas…</p>` : ''}
          ${!loading && !alerts.length ? `<div class="rounded-3xl bg-emerald-50 border-2 border-emerald-200 p-6 text-center">
            <i data-lucide="check-circle-2" class="w-8 h-8 text-emerald-700 inline-block mb-2"></i>
            <p class="text-base font-black text-emerald-900">Nenhuma conciliação pendente.</p>
            <p class="text-xs text-emerald-800 mt-1">LJ e RD estão alinhados. Quando o cron de 15min encontrar um conflito, ele aparece aqui.</p>
          </div>` : ''}

          ${alerts.length ? `<div class="space-y-3">
            ${alerts.map(a => this._alertRow(a, resolvingId)).join('')}
          </div>` : ''}
        </main>
      </section>
    </div>`;
  },

  _alertRow(a, resolvingId) {
    const isResolving = resolvingId === a.id;
    const ljTs = a.lj_updated_at ? new Date(a.lj_updated_at).toLocaleString('pt-BR') : '—';
    const rdTs = a.rd_updated_at ? new Date(a.rd_updated_at).toLocaleString('pt-BR') : '—';
    const visitorLabel = a.visitor_name || a.visitor_email || a.lj_visitor_id;
    const fieldLabel = ({ name: 'Nome', phone: 'Telefone', email: 'Email' })[a.field] || a.field;

    return `<div class="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm ${isResolving ? 'opacity-60' : ''}">
      <div class="flex items-center justify-between gap-3 mb-3">
        <div class="min-w-0">
          <p class="text-xs font-black text-slate-500 uppercase tracking-widest">${Utils.escape(fieldLabel)}</p>
          <p class="text-lg font-black text-slate-900 truncate">${Utils.escape(visitorLabel)}</p>
          <p class="text-[11px] text-slate-500">${Utils.escape(a.visitor_email || '—')}</p>
        </div>
        <div class="text-[10px] text-slate-400 text-right shrink-0">
          Detectado: ${a.detected_at ? new Date(a.detected_at).toLocaleString('pt-BR') : '—'}
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div class="rounded-2xl bg-violet-50 border-2 border-violet-200 p-3">
          <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest mb-1">Valor no LJ</p>
          <p class="text-sm font-bold text-violet-900 break-words">${Utils.escape(a.lj_value || '(vazio)')}</p>
          <p class="text-[10px] text-violet-700 mt-1">Atualizado: ${ljTs}</p>
        </div>
        <div class="rounded-2xl bg-sky-50 border-2 border-sky-200 p-3">
          <p class="text-[10px] font-black text-sky-700 uppercase tracking-widest mb-1">Valor no RD CRM</p>
          <p class="text-sm font-bold text-sky-900 break-words">${Utils.escape(a.rd_value || '(vazio)')}</p>
          <p class="text-[10px] text-sky-700 mt-1">Atualizado: ${rdTs}</p>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <button ${isResolving ? 'disabled' : ''} onclick="Actions.resolveReconciliationAlert(${a.id}, 'keep_lj')"
                class="px-4 py-2 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black flex items-center gap-1.5" style="color:#fff!important;">
          <i data-lucide="arrow-up-circle" class="w-3.5 h-3.5"></i>
          Manter LJ (empurra pro RD)
        </button>
        <button ${isResolving ? 'disabled' : ''} onclick="Actions.resolveReconciliationAlert(${a.id}, 'keep_rd')"
                class="px-4 py-2 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black flex items-center gap-1.5" style="color:#fff!important;">
          <i data-lucide="arrow-down-circle" class="w-3.5 h-3.5"></i>
          Aceitar RD (sobrescreve LJ)
        </button>
        <button ${isResolving ? 'disabled' : ''} onclick="Actions.resolveReconciliationAlert(${a.id}, 'dismiss')"
                class="px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-xs font-black flex items-center gap-1.5">
          <i data-lucide="x-circle" class="w-3.5 h-3.5"></i>
          Descartar
        </button>
      </div>
    </div>`;
  }
};
