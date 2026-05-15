// V14 — Modal de histórico de cenários salvos do produto.
// Mostra cards com snapshot de cada cenário. Clicar abre o simulador com o cenário carregado.
var RevopsScenariosModal = {
  render() {
    if (!App.state.showRevopsScenariosModal) return '';
    const productId = App.state.revopsSelectedProductId;
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    const config = RevopsFinanceEngine.normalize((App.state.revopsFinance || {})[productId] || {}, productId);
    const scenarios = Array.isArray(config.scenarios) ? [...config.scenarios].sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || ''))) : [];
    return `<div class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm p-4 overflow-auto">
      <main class="min-h-full">
        <section class="rounded-[2rem] overflow-hidden shadow-2xl text-white max-w-5xl mx-auto" style="background: radial-gradient(circle at 18% 10%, rgba(99,102,241,.24), transparent 30%), #071326;">
          <header class="p-6 lg:p-7 border-b border-white/10 flex items-start justify-between gap-4">
            <div>
              <div class="flex items-center gap-2 mb-2"><i data-lucide="history" class="w-4 h-4 text-indigo-300"></i><p class="text-xs font-black text-slate-300 uppercase tracking-wider">Projeções Salvas</p></div>
              <h2 class="text-3xl font-black">Cenários do produto</h2>
              <p class="text-sm text-slate-300 mt-1">${Utils.escape(product?.name || 'Produto')} <span class="mx-3">•</span> ${scenarios.length} cenário(s) guardado(s)</p>
            </div>
            <button onclick="Actions.closeRevopsScenarios()" class="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center gap-2 text-sm font-semibold"><i data-lucide="x" class="w-4 h-4"></i> Fechar</button>
          </header>
          <div class="p-5 lg:p-7">${this._list(scenarios)}</div>
        </section>
      </main>
    </div>`;
  },

  _list(scenarios) {
    if (!scenarios.length) return `<div class="rounded-3xl border border-dashed border-white/15 p-8 text-center">
      <div class="w-12 h-12 rounded-2xl bg-white/10 grid place-items-center mx-auto mb-3"><i data-lucide="bookmark" class="w-6 h-6 text-slate-300"></i></div>
      <p class="text-slate-200 font-black">Nenhum cenário salvo ainda</p>
      <p class="text-xs text-slate-400 mt-1">Abra o simulador, ajuste os parâmetros e clique em "Salvar Cenário de Projeção".</p>
    </div>`;
    return `<div class="grid md:grid-cols-2 gap-3">${scenarios.map(scenario => this._card(scenario)).join('')}</div>`;
  },

  _card(scenario) {
    const metrics = RevopsFinanceEngine.computeMetrics(scenario);
    const savedLabel = scenario.savedAt ? new Date(scenario.savedAt).toLocaleString('pt-BR') : '—';
    const periodLabel = RevopsFinanceEngine.PERIODS.find(p => p.id === scenario.period)?.label || 'Mensal';
    return `<div class="rounded-3xl border border-white/10 bg-white/[0.055] p-4 hover:bg-white/[0.085] transition cursor-pointer" onclick="Actions.loadRevopsScenario('${Utils.escape(scenario.id)}')">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div>
          <p class="font-black text-base text-white">${Utils.escape(scenario.name)}</p>
          <p class="text-xs text-slate-400 mt-1">${Utils.escape(savedLabel)} <span class="mx-2">•</span> ${periodLabel}</p>
        </div>
        <span class="px-2 py-1 rounded-full text-[10px] font-black ${metrics.ebitda >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}">${metrics.health}</span>
      </div>
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="rounded-xl bg-black/20 border border-white/10 p-2"><p class="text-[10px] text-slate-400 font-bold">Vendas</p><p class="text-sm font-black text-white">${Math.round(metrics.sales).toLocaleString('pt-BR')}</p></div>
        <div class="rounded-xl bg-black/20 border border-white/10 p-2"><p class="text-[10px] text-slate-400 font-bold">Receita</p><p class="text-sm font-black text-white">${RevopsFinanceEngine.money(metrics.grossRevenue)}</p></div>
        <div class="rounded-xl bg-black/20 border border-white/10 p-2"><p class="text-[10px] text-slate-400 font-bold">EBITDA</p><p class="text-sm font-black ${metrics.ebitda >= 0 ? 'text-emerald-300' : 'text-red-300'}">${RevopsFinanceEngine.money(metrics.ebitda)}</p></div>
      </div>
      <div class="flex flex-wrap gap-2 mt-3">
        <button onclick="event.stopPropagation(); Actions.loadRevopsScenario('${Utils.escape(scenario.id)}')" class="px-3 py-2 rounded-xl bg-indigo-500/20 text-indigo-200 border border-indigo-400/30 text-xs font-black">Reabrir no simulador</button>
        <button onclick="event.stopPropagation(); Actions.deleteRevopsScenario('${Utils.escape(scenario.id)}')" class="px-3 py-2 rounded-xl bg-red-500/10 text-red-300 border border-red-400/20 text-xs font-black">Remover</button>
      </div>
    </div>`;
  }
};
window.RevopsScenariosModal = RevopsScenariosModal;
