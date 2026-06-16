// V38.1.36 — Wizard "Definir Audiência" (ICP do produto).
//
// Hard bloqueante: produto não nasce sem audience.configured=true.
//
// 5 steps:
//   0 — Apresentação (mini aula ICP base Olyng)
//   1 — Modelo de Negócio (B2B/B2C/B2B2C/C2C)
//   2 — Modelo Operacional (SaaS/E-commerce/Agência/Marketplace/Freemium)
//   3 — Quadro PA/ICP/BP (Djow sugere — placeholder até KB chegar)
//   4 — Finalizar
//
// State: App.state.audienceWizard = {
//   open, mode: 'createProduct'|'createProductMapa'|'existingProduct',
//   step, productId, pendingDraft,
//   modeloNegocio, modeloOperacional,
//   quadroPA: [], quadroICP: [], quadroBP: []
// }

var ProductAudienceModal = {
  BUSINESS_MODELS: [
    { id: 'b2b',   label: 'B2B',   tagline: 'Empresa → Empresa',  body: 'Vendas de empresas para empresas. Foco em resolver problemas corporativos, otimizar processos ou revender produtos. Ex: software de gestão (ERP), consultoria.' },
    { id: 'b2c',   label: 'B2C',   tagline: 'Empresa → Consumidor', body: 'Vendas diretas da empresa para o consumidor final. Foco em atender necessidades e desejos individuais. Ex: varejo, supermercados, cinemas.' },
    { id: 'b2b2c', label: 'B2B2C', tagline: 'Empresa → Empresa → Consumidor', body: 'Uma empresa B2B faz parceria com outra para alcançar o consumidor final, ou plataforma conecta empresas a consumidores. Ex: delivery que vende pra restaurantes.' },
    { id: 'c2c',   label: 'C2C',   tagline: 'Consumidor → Consumidor', body: 'Transações diretas entre consumidores, geralmente intermediadas por plataforma digital. Ex: marketplaces de usados ou artesanato.' }
  ],
  OPERATIONAL_MODELS: [
    { id: 'saas',        label: 'SaaS',        tagline: 'Software por assinatura', body: 'Software hospedado na nuvem. Cliente paga assinatura (mensal/anual) para usar. Ex: streaming, automação de marketing.' },
    { id: 'ecommerce',   label: 'E-commerce',  tagline: 'Loja online',             body: 'Venda de produtos físicos ou digitais exclusivamente pela internet. Ex: lojas virtuais de roupas, eletrônicos.' },
    { id: 'agencia',     label: 'Agência',     tagline: 'Serviços especializados', body: 'Time vende tempo, conhecimento e execução pra outras empresas. Ex: publicidade, marketing digital, desenvolvimento web.' },
    { id: 'marketplace', label: 'Marketplace', tagline: 'Plataforma de conexão',   body: 'Conecta múltiplos vendedores a múltiplos compradores. Cobra taxa/comissão. Ex: apps de transporte, grandes varejistas.' },
    { id: 'freemium',    label: 'Freemium',    tagline: 'Grátis + premium',        body: 'Produto básico grátis; recursos avançados, mais capacidade ou exclusividade são cobrados. Ex: apps de edição, jogos com compras.' }
  ],

  render() {
    const w = App.state.audienceWizard;
    if (!w || !w.open) return '';
    const step = Number(w.step || 0);
    return `<div class="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div class="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-3xl mx-auto mt-8 overflow-hidden">
        ${this._header(w, step)}
        <div class="p-6 lg:p-8">
          ${step === 0 ? this._step0() : ''}
          ${step === 1 ? this._step1(w) : ''}
          ${step === 2 ? this._step2(w) : ''}
          ${step === 3 ? this._step3(w) : ''}
          ${step === 4 ? this._step4(w) : ''}
        </div>
        ${this._footer(w, step)}
      </div>
    </div>`;
  },

  _header(w, step) {
    const titles = ['O que é ICP?', 'Modelo de Negócio', 'Modelo Operacional', 'Quadro de Audiência', 'Finalizar'];
    const dots = [0,1,2,3,4].map(i => `<span class="w-2 h-2 rounded-full ${i <= step ? 'bg-white' : 'bg-white/25'}"></span>`).join('');
    const productName = w.mode === 'existingProduct'
      ? (App.state.products.find(p => Number(p.id) === Number(w.productId))?.name || 'Produto')
      : (w.pendingDraft?.name || 'Novo produto');
    return `<header class="bg-violet-700 text-white p-6 flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="text-[10px] font-black text-violet-200 uppercase tracking-widest">${w.mode === 'existingProduct' ? 'Editar audiência' : 'Definir audiência'} · Passo ${step + 1} de 5</p>
        <h2 class="text-2xl font-black mt-1 truncate">${Utils.escape(productName)} <span class="text-violet-200 font-normal">— ${Utils.escape(titles[step])}</span></h2>
        <div class="flex items-center gap-1.5 mt-3">${dots}</div>
      </div>
      <button onclick="Actions.cancelAudienceWizard()" title="Fechar (produto não será criado)" class="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xl">×</button>
    </header>`;
  },

  _footer(w, step) {
    const canAdvance = (step === 0) ||
                       (step === 1 && !!w.modeloNegocio) ||
                       (step === 2 && !!w.modeloOperacional) ||
                       (step === 3) ||
                       (step === 4);
    const isLast = step === 4;
    const advanceLabel = isLast ? 'Salvar e criar produto' : 'Continuar';
    const backLabel = step === 0 ? 'Cancelar' : 'Voltar';
    const backAction = step === 0 ? 'Actions.cancelAudienceWizard()' : 'Actions.audienceWizardBack()';
    const advanceAction = isLast ? 'Actions.audienceWizardFinish()' : 'Actions.audienceWizardNext()';
    if (w.mode === 'existingProduct' && isLast) {
      // produto já existe: copy diferente
      return `<footer class="bg-slate-50 border-t border-slate-200 p-5 flex items-center justify-between">
        <button onclick="${backAction}" class="px-5 py-3 rounded-2xl bg-white border border-slate-300 text-slate-700 font-black">${backLabel}</button>
        <button onclick="${advanceAction}" class="px-5 py-3 rounded-2xl bg-violet-700 hover:bg-violet-800 text-white font-black">Salvar audiência</button>
      </footer>`;
    }
    return `<footer class="bg-slate-50 border-t border-slate-200 p-5 flex items-center justify-between">
      <button onclick="${backAction}" class="px-5 py-3 rounded-2xl bg-white border border-slate-300 text-slate-700 font-black">${backLabel}</button>
      <button onclick="${advanceAction}" ${canAdvance ? '' : 'disabled style="opacity:.4;cursor:not-allowed;"'} class="px-5 py-3 rounded-2xl bg-violet-700 hover:bg-violet-800 text-white font-black">${advanceLabel}</button>
    </footer>`;
  },

  _step0() {
    return `<div class="space-y-5">
      <div class="rounded-2xl bg-violet-50 border border-violet-200 border-l-4 border-l-violet-600 p-5">
        <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest mb-2">Mini aula</p>
        <p class="text-sm text-slate-700 leading-relaxed">Definir bem a <b>audiência</b> de um produto é o que separa marketing que gera atenção de marketing que <b>fecha venda</b>. O LJ trabalha com 3 camadas que se acumulam: cada uma é um filtro mais fino sobre a anterior.</p>
      </div>
      <div class="grid md:grid-cols-3 gap-3">
        ${this._layerCard('C', 'Público-Alvo', 'Quem TEM CHANCE de virar lead. Firmografia e demografia bruta: setor, porte, geografia, faixa de renda.', 'violet')}
        ${this._layerCard('B', 'ICP', 'Quem é VIÁVEL de fechar. PA + sinais comportamentais e contextuais: uso de categoria, momento de compra, orçamento.', 'pink')}
        ${this._layerCard('A', 'Buyer Persona', 'COMO falar com quem decide. ICP + pessoa: cargo decisor, dor declarada, prioridades, processo de decisão.', 'amber')}
      </div>
      <p class="text-xs text-slate-500 leading-relaxed">Esse wizard vai te guiar a definir os 3. Depois, o LJ usa essas definições pra classificar automaticamente cada lead que entra na campanha desse produto.</p>
    </div>`;
  },

  _layerCard(tag, title, body, tone) {
    return `<div class="rounded-2xl bg-white border border-slate-200 border-l-4 border-l-${tone}-500 p-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="w-6 h-6 rounded-lg bg-${tone}-100 text-${tone}-700 grid place-items-center text-xs font-black">${tag}</span>
        <p class="font-black text-slate-900">${title}</p>
      </div>
      <p class="text-xs text-slate-600 leading-relaxed">${body}</p>
    </div>`;
  },

  _step1(w) {
    return `<div class="space-y-3">
      <p class="text-sm text-slate-600 mb-4">Como esse produto chega no comprador?</p>
      ${this.BUSINESS_MODELS.map(m => this._choiceCard('modeloNegocio', m, w.modeloNegocio === m.id)).join('')}
    </div>`;
  },

  _step2(w) {
    return `<div class="space-y-3">
      <p class="text-sm text-slate-600 mb-4">Qual o modelo operacional e de receita?</p>
      ${this.OPERATIONAL_MODELS.map(m => this._choiceCard('modeloOperacional', m, w.modeloOperacional === m.id)).join('')}
    </div>`;
  },

  _choiceCard(field, m, selected) {
    return `<button onclick="Actions.audienceWizardChoose('${field}', '${m.id}')" class="w-full text-left rounded-2xl border-2 p-4 transition ${selected ? 'border-violet-600 bg-violet-50' : 'border-slate-200 bg-white hover:bg-slate-50'}">
      <div class="flex items-start gap-3">
        <div class="w-9 h-9 rounded-xl grid place-items-center font-black text-sm shrink-0 ${selected ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700'}">${m.label[0]}</div>
        <div class="min-w-0">
          <div class="flex items-center gap-2 mb-0.5">
            <p class="font-black text-slate-900">${m.label}</p>
            <span class="text-[10px] font-bold text-slate-500">${m.tagline}</span>
          </div>
          <p class="text-xs text-slate-600 leading-relaxed">${m.body}</p>
        </div>
      </div>
    </button>`;
  },

  _step3(w) {
    const negocio = this.BUSINESS_MODELS.find(m => m.id === w.modeloNegocio);
    const operacional = this.OPERATIONAL_MODELS.find(m => m.id === w.modeloOperacional);
    return `<div class="space-y-5">
      <div class="rounded-2xl bg-slate-100 border border-slate-200 p-4 flex items-center gap-3 flex-wrap">
        <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Combinação escolhida</span>
        <span class="px-3 py-1 rounded-full bg-white border border-violet-300 text-violet-700 text-xs font-black">${negocio?.label || '?'}</span>
        <span class="text-slate-400">×</span>
        <span class="px-3 py-1 rounded-full bg-white border border-violet-300 text-violet-700 text-xs font-black">${operacional?.label || '?'}</span>
      </div>
      <div class="rounded-2xl bg-gradient-to-br from-violet-50 to-pink-50 border border-violet-200 border-l-4 border-l-violet-600 p-6">
        <div class="flex items-center gap-2 mb-3">
          <i data-lucide="sparkles" class="w-4 h-4 text-violet-700"></i>
          <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest">Djow vai sugerir aqui</p>
        </div>
        <p class="text-sm text-slate-700 leading-relaxed">Nesta etapa o <b>Djow</b> cruza o modelo de negócio, o modelo operacional, a descrição do produto e os leads já importados do RD pra propor um quadro inicial com os campos esperados em cada camada (PA / ICP / BP).</p>
        <p class="text-sm text-slate-600 leading-relaxed mt-3">Você poderá editar, adicionar e remover campos, e o Djow valida se faz sentido no contexto.</p>
        <div class="mt-4 px-4 py-3 rounded-xl bg-white border border-amber-200 border-l-4 border-l-amber-500">
          <p class="text-xs font-black text-amber-800">⏳ Aguardando base de conhecimento</p>
          <p class="text-xs text-slate-600 mt-1 leading-relaxed">A base de conhecimento do Djow pra este passo está sendo construída. Por enquanto você pode avançar — o quadro fica em branco e o produto nasce com os modelos escolhidos. O Djow vai sugerir o quadro completo assim que a KB for ativada.</p>
        </div>
      </div>
    </div>`;
  },

  _step4(w) {
    const negocio = this.BUSINESS_MODELS.find(m => m.id === w.modeloNegocio);
    const operacional = this.OPERATIONAL_MODELS.find(m => m.id === w.modeloOperacional);
    return `<div class="space-y-5">
      <p class="text-sm text-slate-600">Confirme os modelos antes de salvar.</p>
      <div class="grid md:grid-cols-2 gap-3">
        <div class="rounded-2xl bg-white border border-slate-200 border-l-4 border-l-violet-600 p-4">
          <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest mb-1">Modelo de Negócio</p>
          <p class="font-black text-slate-900">${negocio?.label || '—'}</p>
          <p class="text-xs text-slate-500 mt-1">${negocio?.tagline || ''}</p>
        </div>
        <div class="rounded-2xl bg-white border border-slate-200 border-l-4 border-l-pink-500 p-4">
          <p class="text-[10px] font-black text-pink-700 uppercase tracking-widest mb-1">Modelo Operacional</p>
          <p class="font-black text-slate-900">${operacional?.label || '—'}</p>
          <p class="text-xs text-slate-500 mt-1">${operacional?.tagline || ''}</p>
        </div>
      </div>
      <div class="rounded-2xl bg-emerald-50 border border-emerald-200 border-l-4 border-l-emerald-600 p-4">
        <p class="text-xs text-emerald-900 leading-relaxed"><b>Pronto.</b> Ao salvar, o produto será marcado com a badge <b>"ICP CONFIGURADO"</b>. Você pode editar a audiência depois pelo mesmo botão no card do produto.</p>
      </div>
    </div>`;
  }
};

window.ProductAudienceModal = ProductAudienceModal;
