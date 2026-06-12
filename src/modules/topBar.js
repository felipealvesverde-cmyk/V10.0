// V37.5.1 — Top bar fixa em todas as páginas.
//
// Conteúdo: search + sininho ÚNICO (V2 com badge agregado dos legados) +
// pin + data. Fica fixa no topo direito.
//
// Substitui o menu antigo do _greetingBar do home.js (que só aparecia no Home).
// Agora todas as telas (Products, Campaigns, Actions, Results, Leads, Dashboard,
// RevOps, etc) herdam.

window.TopBar = {
  render() {
    // V37.5.1 — Hidratação de counters em background pro sininho agregado
    // (TTL interno 60s, idempotente). Antes estava no _greetingBar do home.js
    // — agora roda em qualquer página (TopBar é global).
    const sessionOk = !App.state.sessionExpired;
    if (sessionOk) {
      const lastRecon = App.state._reconciliationLastLoadedAt || 0;
      if ((Date.now() - lastRecon) > 60000 && window.Actions?.loadReconciliationAlerts) {
        App.state._reconciliationLastLoadedAt = Date.now();
        setTimeout(() => Actions.loadReconciliationAlerts(), 200);
      }
      const lastWh = App.state._rdWebhookSummaryLoadedAt || 0;
      if ((Date.now() - lastWh) > 60000 && window.Actions?.loadRdWebhookFailuresSummary) {
        App.state._rdWebhookSummaryLoadedAt = Date.now();
        setTimeout(() => Actions.loadRdWebhookFailuresSummary(), 250);
      }
      if (window.Actions?._processKrSnapshots) {
        setTimeout(() => Actions._processKrSnapshots(), 300);
      }
      if (App.state.ga4Status === null && window.Actions?.loadGa4Status) {
        setTimeout(() => Actions.loadGa4Status(), 350);
      }
      if (window.Actions?.loadGovernanceClosings) {
        setTimeout(() => Actions.loadGovernanceClosings(), 400);
      }
    }
    return `<div class="lj-topbar sticky top-0 z-30 flex items-center justify-end gap-2 px-4 py-2 bg-slate-950/85 backdrop-blur-sm border-b border-slate-800">
      <button onclick="Actions.openProfileFinder && Actions.openProfileFinder()" class="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 grid place-items-center text-slate-300 transition" title="Buscar">
        <i data-lucide="search" class="w-3.5 h-3.5"></i>
      </button>
      ${window.NotificationsPanel ? NotificationsPanel.bellButton() : ''}
      ${window.PinUp ? PinUp.bellButton() : ''}
      <div class="lj-topbar-date inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-bold">
        <i data-lucide="calendar" class="w-3 h-3"></i>
        <span>${Utils.escape(this._today())}</span>
      </div>
    </div>`;
  },

  _today() {
    const d = new Date();
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  }
};
