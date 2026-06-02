// V35.7.2 — Modal compartilhado de explicação de KPI.
//
// Aberto por Actions.openKpiHelp(key) com chave do KpiHelpDictionary.
// Mostra título, descrição, fórmula, interpretação e fonte.
// Z-index 96 (acima dos modais de conexão z-[92] mas abaixo do deep-dive z-[95]).

window.KpiHelpModal = {
  render() {
    const key = App.state.kpiHelpModalKey;
    if (!key) return '';
    const dict = (window.KpiHelpDictionary || {});
    const entry = dict[key];
    if (!entry) return '';

    return `<div class="fixed inset-0 z-[96] grid place-items-center p-4"
      style="background: rgba(15,23,42,0.85); backdrop-filter: blur(6px);"
      onclick="if(event.target===this) Actions.closeKpiHelp()">
      <div class="w-full max-w-md rounded-3xl bg-white shadow-2xl border-2 border-pink-300 overflow-hidden">

        <div class="bg-gradient-to-r from-pink-700 to-rose-700 px-5 py-4 text-white flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[10px] font-black text-pink-100 uppercase tracking-widest">Como este KPI é calculado</p>
            <h2 class="text-base font-black leading-tight mt-0.5">${Utils.escape(entry.title || key)}</h2>
          </div>
          <button onclick="Actions.closeKpiHelp()" class="shrink-0 w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 text-white grid place-items-center">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <div class="p-5 space-y-4">
          ${entry.description ? `<div>
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">O que é</p>
            <p class="text-[13px] text-slate-800 leading-relaxed">${Utils.escape(entry.description)}</p>
          </div>` : ''}

          ${entry.formula ? `<div>
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Fórmula</p>
            <div class="rounded-xl bg-slate-900 text-emerald-200 p-3 font-mono text-[12px] leading-relaxed">${Utils.escape(entry.formula)}</div>
          </div>` : ''}

          ${entry.interpretation ? `<div>
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Como interpretar</p>
            <p class="text-[12px] text-slate-700 leading-relaxed italic">${Utils.escape(entry.interpretation)}</p>
          </div>` : ''}

          ${entry.source ? `<div class="rounded-xl bg-slate-50 border border-slate-200 p-3">
            <p class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Fonte</p>
            <p class="text-[11px] text-slate-700 font-mono leading-snug">${Utils.escape(entry.source)}</p>
          </div>` : ''}
        </div>

        <footer class="px-5 py-3 border-t border-slate-100 flex justify-end bg-slate-50">
          <button onclick="Actions.closeKpiHelp()" class="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-black" style="color:#fff!important;">
            Entendi
          </button>
        </footer>
      </div>
    </div>`;
  }
};
