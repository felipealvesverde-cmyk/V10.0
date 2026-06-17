// V39.1.0 — Force-prompt modal de salesChannel
//
// Audiência V38.1.36 cravou ICP obrigatório no nascimento do produto, mas
// V39.1.0 adiciona uma pergunta nova: "como esse produto vende?" (checkout |
// crm | hybrid). Produtos pré-V39.1 têm audience.configured=true mas falta
// salesChannel.
//
// Este modal abre no boot quando detecta produtos sem salesChannel. Bloqueia
// até o cliente preencher TODOS — sem botão de fechar/dispensar. Cliente
// escolhe um produto por vez (currentProductId no state). Quando termina,
// salesChannelPrompt.open vira false e o boot dispara render.
//
// Fonte da pergunta: SALES_CHANNELS de ProductAudienceModal.

var SalesChannelPromptModal = {
  render() {
    const s = App.state.salesChannelPrompt;
    if (!s || !s.open) return '';
    const pendingProducts = (App.state.products || [])
      .filter(p => p.audience && p.audience.configured && !p.audience.salesChannel);
    if (pendingProducts.length === 0) return '';

    const current = pendingProducts.find(p => Number(p.id) === Number(s.currentProductId)) || pendingProducts[0];
    const index = pendingProducts.findIndex(p => Number(p.id) === Number(current.id));
    const total = pendingProducts.length;
    const choice = s.choice || current.audience?.salesChannel || null;
    const channels = (window.ProductAudienceModal && ProductAudienceModal.SALES_CHANNELS) || [];

    return `<div class="fixed inset-0 z-[9999] bg-slate-950/90 backdrop-blur-sm p-4 overflow-y-auto">
      <div class="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-2xl mx-auto mt-12 overflow-hidden">
        <header class="bg-violet-700 text-white p-6">
          <p class="text-[10px] font-black text-violet-200 uppercase tracking-widest">Atualização V39.1 · Forecast × Realizado</p>
          <h2 class="text-2xl font-black mt-1">Como o produto <span class="underline decoration-violet-300">${Utils.escape(current.name)}</span> vende?</h2>
          <p class="text-[12px] text-violet-100 mt-2 leading-relaxed">Pra ativar Forecast × Realizado na aba Resultados, precisamos saber por onde fecha a venda. Define a fonte do realizado (Hotmart pull vs Fechamento mensal) e o ponto crítico que o tenant monitora.</p>
          <div class="flex items-center gap-2 mt-3">
            <div class="flex-1 h-1.5 rounded-full bg-violet-900/40 overflow-hidden">
              <div class="h-full bg-white" style="width:${Math.round(((index + 1) / total) * 100)}%"></div>
            </div>
            <span class="text-[10px] font-black text-violet-200 uppercase tracking-widest shrink-0">${index + 1} de ${total}</span>
          </div>
        </header>
        <div class="p-6 lg:p-8 space-y-3">
          ${channels.map(c => this._choiceCard(c, choice === c.id)).join('')}
        </div>
        <footer class="bg-slate-50 border-t border-slate-200 p-5 flex items-center justify-end">
          <button onclick="Actions.confirmSalesChannelPrompt()" ${choice ? '' : 'disabled style="opacity:.4;cursor:not-allowed;"'} class="px-5 py-3 rounded-2xl bg-violet-700 hover:bg-violet-800 text-white font-black">
            ${index + 1 < total ? 'Continuar pro próximo' : 'Salvar e fechar'}
          </button>
        </footer>
      </div>
    </div>`;
  },

  _choiceCard(c, selected) {
    return `<button onclick="Actions.chooseSalesChannelInPrompt('${c.id}')" class="w-full text-left rounded-2xl border-2 p-4 transition ${selected ? 'border-violet-600 bg-violet-50' : 'border-slate-200 bg-white hover:bg-slate-50'}">
      <div class="flex items-start gap-3">
        <div class="w-9 h-9 rounded-xl grid place-items-center font-black text-sm shrink-0 ${selected ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700'}">${c.label[0]}</div>
        <div class="min-w-0">
          <div class="flex items-center gap-2 mb-0.5">
            <p class="font-black text-slate-900">${Utils.escape(c.label)}</p>
            <span class="text-[10px] font-bold text-slate-500">${Utils.escape(c.tagline)}</span>
          </div>
          <p class="text-xs text-slate-600 leading-relaxed">${Utils.escape(c.body)}</p>
        </div>
      </div>
    </button>`;
  }
};

window.SalesChannelPromptModal = SalesChannelPromptModal;
