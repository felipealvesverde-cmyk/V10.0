// V35.0.0 — Modal de confirmação genérico.
// Substitui window.confirm() em pontos críticos onde o nativo quebra o design.
// Uso: Actions.openConfirmModal({ title, message, onConfirm, confirmTone }).

window.ConfirmModal = {
  render() {
    const m = App.state.confirmModal;
    if (!m || !m.open) return '';
    const toneMap = {
      red:    { bg: 'bg-red-600 hover:bg-red-700',       icon: 'alert-triangle', accent: 'text-red-600' },
      amber:  { bg: 'bg-amber-600 hover:bg-amber-700',   icon: 'alert-circle',   accent: 'text-amber-600' },
      slate:  { bg: 'bg-slate-900 hover:bg-slate-950',   icon: 'help-circle',    accent: 'text-slate-700' },
      violet: { bg: 'bg-violet-600 hover:bg-violet-700', icon: 'sparkles',       accent: 'text-violet-600' }
    };
    const tone = toneMap[m.confirmTone] || toneMap.slate;
    return `<div class="fixed inset-0 z-[80] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" onclick="if(event.target===this) Actions.closeConfirmModal()">
      <section class="max-w-md w-full rounded-3xl bg-white shadow-2xl border border-white/20 overflow-hidden">
        <div class="p-6">
          <div class="flex items-start gap-3 mb-3">
            <div class="shrink-0 w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center ${tone.accent}">
              <i data-lucide="${tone.icon}" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="text-lg font-black text-slate-900">${Utils.escape(m.title || 'Confirmar')}</h3>
              <p class="text-sm text-slate-600 mt-1">${Utils.escape(m.message || '')}</p>
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-5">
            <button onclick="Actions.closeConfirmModal()" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-black text-slate-700">${Utils.escape(m.cancelLabel || 'Cancelar')}</button>
            <button onclick="Actions.runConfirmModal()" class="px-4 py-2.5 rounded-xl ${tone.bg} text-sm font-black text-white" style="color:#fff;">${Utils.escape(m.confirmLabel || 'Confirmar')}</button>
          </div>
        </div>
      </section>
    </div>`;
  }
};
