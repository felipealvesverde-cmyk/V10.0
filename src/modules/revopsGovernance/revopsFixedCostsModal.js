// V14.4 — Modal de custos fixos detalhados por categoria.
// Permite adicionar/editar/remover items (origem + valor) dentro de uma categoria
// (software, people, structure, others). Substitui o input único antigo.
var RevopsFixedCostsModal = {
  render() {
    if (!App.state.showRevopsFixedCostsModal) return '';
    const category = App.state.revopsFixedCostsCategory;
    if (!category) return '';
    const meta = RevopsFinanceEngine.FIXED_CATEGORIES.find(c => c.id === category);
    if (!meta) return '';
    const productId = App.state.revopsSelectedProductId;
    const config = (App.state.revopsFinance || {})[productId];
    if (!config) return '';
    const items = config.fixedCosts?.[category]?.items || [];
    const total = items.reduce((sum, item) => sum + RevopsFinanceEngine.number(item.value), 0);

    return `<div class="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm p-4 overflow-auto">
      <div class="max-w-2xl mx-auto rounded-[2rem] overflow-hidden shadow-2xl text-white" style="background: radial-gradient(circle at 18% 10%, rgba(245,158,11,.22), transparent 30%), #071326;">
        <header class="p-6 border-b border-white/10 flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <div class="w-9 h-9 rounded-xl bg-white/10 grid place-items-center"><i data-lucide="${meta.icon}" class="w-4 h-4 text-amber-300"></i></div>
              <div>
                <p class="text-xs font-black text-slate-300 uppercase tracking-wider">Detalhar G&A • ${Utils.escape(meta.label)}</p>
                <h2 class="text-2xl font-black">${Utils.escape(meta.label)}</h2>
              </div>
            </div>
            <p class="text-sm text-slate-300 mt-1 max-w-lg">${Utils.escape(meta.description)} Cada linha vira uma origem visível no relatório.</p>
          </div>
          <button onclick="Actions.closeRevopsFixedCostsModal()" class="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center gap-2 text-sm font-semibold"><i data-lucide="x" class="w-4 h-4"></i> Fechar</button>
        </header>

        <div class="p-6 space-y-4">
          <div class="rounded-3xl border border-white/10 bg-white/[0.055] p-4">
            <div class="flex items-center justify-between gap-3 mb-3">
              <div>
                <p class="text-sm font-black text-white">Origens de custo cadastradas</p>
                <p class="text-xs text-slate-400">Adicione cada fornecedor, ferramenta ou contrato como um item separado.</p>
              </div>
              <button onclick="Actions.addRevopsFixedItem('${category}')" class="px-3 py-2 rounded-xl bg-amber-500/20 text-amber-200 border border-amber-400/30 text-xs font-black flex items-center gap-1"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Adicionar item</button>
            </div>
            <div class="space-y-2">${items.length ? items.map(item => this._itemRow(category, item)).join('') : '<p class="text-sm text-slate-400">Nenhum item ainda. Clique em <b>Adicionar item</b> para começar.</p>'}</div>
          </div>

          <div class="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-4 flex items-center justify-between gap-4">
            <div>
              <p class="text-xs font-black text-amber-200 uppercase tracking-wider">Total ${Utils.escape(meta.label)}</p>
              <p class="text-xs text-amber-100/80">Soma das origens listadas acima. Alimenta o G&A do período.</p>
            </div>
            <p class="text-3xl font-black text-amber-100">${RevopsFinanceEngine.money(total)}</p>
          </div>
        </div>

        <footer class="p-6 border-t border-white/10 flex justify-end gap-3">
          <button onclick="Actions.closeRevopsFixedCostsModal()" class="px-5 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-black">Fechar</button>
        </footer>
      </div>
    </div>`;
  },

  _itemRow(category, item) {
    const focusName = `fxitem_${category}_${item.id}_name`;
    const focusValue = `fxitem_${category}_${item.id}_value`;
    return `<div class="rounded-2xl border border-white/10 bg-black/20 p-3 grid grid-cols-[1fr_160px_36px] gap-2 items-center">
      <input id="${focusName}" data-focus-key="${focusName}" value="${Utils.escape(item.name || '')}" oninput="Actions.updateRevopsFixedItemSilent('${category}', '${item.id}', 'name', this.value)" onchange="App.render()" placeholder="Ex.: RD Station, Google Workspace, Hotmart" class="px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white font-semibold text-sm placeholder:text-slate-500" />
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 pointer-events-none">R$</span>
        <input id="${focusValue}" data-focus-key="${focusValue}" type="text" inputmode="numeric" value="${Utils.formatCents(item.value)}" oninput="Actions.updateRevopsFixedItemSilent('${category}', '${item.id}', 'value', Utils.applyMoneyMask(this))" onfocus="this.setSelectionRange(this.value.length, this.value.length)" onchange="App.render()" class="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white font-black text-sm text-right" />
      </div>
      <button onclick="Actions.removeRevopsFixedItem('${category}', '${item.id}')" title="Remover origem" class="h-10 rounded-xl bg-red-500/10 text-red-200 border border-red-400/20 font-black">×</button>
    </div>`;
  }
};
window.RevopsFixedCostsModal = RevopsFixedCostsModal;
