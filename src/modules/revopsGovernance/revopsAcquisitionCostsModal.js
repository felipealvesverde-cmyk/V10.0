// V14.5 — Modal de custos de aquisição (mídia paga, plataformas comerciais).
// Mesma lógica de items do modal de custos fixos, mas dedicado ao CAC:
// Google Ads, Meta Ads, RD Station, Hotmart, afiliados etc.
var RevopsAcquisitionCostsModal = {
  render() {
    if (!App.state.showRevopsAcquisitionModal) return '';
    const productId = App.state.revopsSelectedProductId;
    const config = (App.state.revopsFinance || {})[productId];
    if (!config) return '';
    const items = config.acquisitionCosts?.items || [];
    const total = items.reduce((sum, item) => sum + RevopsFinanceEngine.number(item.value), 0);

    return `<div class="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm p-4 overflow-auto">
      <div class="max-w-2xl mx-auto rounded-[2rem] overflow-hidden shadow-2xl text-white" style="background: radial-gradient(circle at 18% 10%, rgba(59,130,246,.24), transparent 30%), #071326;">
        <header class="p-6 border-b border-white/10 flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <div class="w-9 h-9 rounded-xl bg-white/10 grid place-items-center"><i data-lucide="target" class="w-4 h-4 text-sky-300"></i></div>
              <div>
                <p class="text-xs font-black text-slate-300 uppercase tracking-wider">Aquisição de Clientes • Mídia Paga</p>
                <h2 class="text-2xl font-black">Custos de Aquisição</h2>
              </div>
            </div>
            <p class="text-sm text-slate-300 mt-1 max-w-lg">Plataformas e fontes que trazem clientes pagos. Cada linha vira uma origem visível no CAC do produto.</p>
          </div>
          <button onclick="Actions.closeRevopsAcquisitionModal()" class="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 flex items-center gap-2 text-sm font-semibold"><i data-lucide="x" class="w-4 h-4"></i> Fechar</button>
        </header>

        <div class="p-6 space-y-4">
          <div class="rounded-3xl border border-white/10 bg-white/[0.055] p-4">
            <div class="flex items-center justify-between gap-3 mb-3">
              <div>
                <p class="text-sm font-black text-white">Origens de aquisição cadastradas</p>
                <p class="text-xs text-slate-400">Ex.: Google Ads, Meta Ads, RD Station, Hotmart, Eduzz, afiliados, prospecção outbound.</p>
              </div>
              <button onclick="Actions.addRevopsAcquisitionItem()" class="px-3 py-2 rounded-xl bg-sky-500/20 text-sky-200 border border-sky-400/30 text-xs font-black flex items-center gap-1"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Adicionar origem</button>
            </div>
            <div class="space-y-2">${items.length ? items.map(item => this._itemRow(item)).join('') : '<p class="text-sm text-slate-400">Nenhuma origem ainda. Clique em <b>Adicionar origem</b> para começar.</p>'}</div>
          </div>

          <div class="rounded-3xl border border-sky-400/30 bg-sky-500/10 p-4 flex items-center justify-between gap-4">
            <div>
              <p class="text-xs font-black text-sky-200 uppercase tracking-wider">Total Custo de Aquisição</p>
              <p class="text-xs text-sky-100/80">Soma de todas as origens. Entra no CAC do Painel Rosa.</p>
            </div>
            <p class="text-3xl font-black text-sky-100">${RevopsFinanceEngine.money(total)}</p>
          </div>
        </div>

        <footer class="p-6 border-t border-white/10 flex justify-end gap-3">
          <button onclick="Actions.closeRevopsAcquisitionModal()" class="px-5 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-black">Fechar</button>
        </footer>
      </div>
    </div>`;
  },

  _itemRow(item) {
    const focusName = `acq_${item.id}_name`;
    const focusValue = `acq_${item.id}_value`;
    return `<div class="rounded-2xl border border-white/10 bg-black/20 p-3 grid grid-cols-[1fr_160px_36px] gap-2 items-center">
      <input id="${focusName}" data-focus-key="${focusName}" value="${Utils.escape(item.name || '')}" oninput="Actions.updateRevopsAcquisitionItemSilent('${item.id}', 'name', this.value)" onchange="App.render()" placeholder="Ex.: Google Ads, Meta Ads, RD Station, Hotmart" class="px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white font-semibold text-sm placeholder:text-slate-500" />
      <div class="relative">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 pointer-events-none">R$</span>
        <input id="${focusValue}" data-focus-key="${focusValue}" type="text" inputmode="numeric" value="${Utils.formatCents(item.value)}" oninput="Actions.updateRevopsAcquisitionItemSilent('${item.id}', 'value', Utils.applyMoneyMask(this))" onfocus="this.setSelectionRange(this.value.length, this.value.length)" onchange="App.render()" class="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white font-black text-sm text-right" />
      </div>
      <button onclick="Actions.removeRevopsAcquisitionItem('${item.id}')" title="Remover origem" class="h-10 rounded-xl bg-red-500/10 text-red-200 border border-red-400/20 font-black">×</button>
    </div>`;
  }
};
window.RevopsAcquisitionCostsModal = RevopsAcquisitionCostsModal;
