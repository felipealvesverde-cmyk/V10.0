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
  // V39.1.0 — Canal de fechamento da venda. Define a fonte do Realizado
  // (Forecast × Realizado em Resultados) E o ponto crítico que o tenant
  // monitora automaticamente.
  SALES_CHANNELS: [
    { id: 'checkout', label: 'Checkout',           tagline: 'Página de venda',           body: 'Cliente clica "Comprar", insere cartão, fecha sozinho. Ex: Hotmart, Eduzz, Kiwify, Stripe, página própria.' },
    { id: 'crm',      label: 'Comercial via CRM',  tagline: 'Vendedor + contrato',       body: 'Vendedor conversa, manda proposta, fecha contrato. Faturamento declarado no Fechamento mensal + cruzamento com CRM. Ex: serviço B2B, software enterprise, consultoria.' },
    { id: 'hybrid',   label: 'Os dois caminhos',   tagline: 'Híbrido (checkout + CRM)',  body: 'Esse produto vende dos dois jeitos. Ex: SaaS com plano self-service + plano enterprise.' }
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
        </div>
        ${this._footer(w, step)}
      </div>
    </div>`;
  },

  // V38.1.44 — Steps 3 e 4 fundidos (Step 4 dispensado: contagem de
  // obrigatórios já aparece nos chips de cada coluna do Step 3).
  _header(w, step) {
    const titles = ['O que é ICP?', 'Modelo de Negócio', 'Modelo Operacional', 'Quadro de Audiência'];
    const dots = [0,1,2,3].map(i => `<span class="w-2 h-2 rounded-full ${i <= step ? 'bg-white' : 'bg-white/25'}"></span>`).join('');
    const productName = w.mode === 'existingProduct'
      ? (App.state.products.find(p => Number(p.id) === Number(w.productId))?.name || 'Produto')
      : (w.pendingDraft?.name || 'Novo produto');
    return `<header class="bg-violet-700 text-white p-6 flex items-start justify-between gap-4">
      <div class="min-w-0">
        <p class="text-[10px] font-black text-violet-200 uppercase tracking-widest">${w.mode === 'existingProduct' ? 'Editar audiência' : 'Definir audiência'} · Passo ${step + 1} de 4</p>
        <h2 class="text-2xl font-black mt-1 truncate">${Utils.escape(productName)} <span class="text-violet-200 font-normal">— ${Utils.escape(titles[step])}</span></h2>
        <div class="flex items-center gap-1.5 mt-3">${dots}</div>
      </div>
      <button onclick="Actions.cancelAudienceWizard()" title="Fechar (produto não será criado)" class="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-xl">×</button>
    </header>`;
  },

  _footer(w, step) {
    const canAdvance = (step === 0) ||
                       (step === 1 && !!w.modeloNegocio) ||
                       (step === 2 && !!w.modeloOperacional && !!w.salesChannel) ||
                       (step === 3);
    const isLast = step === 3;
    const isExisting = w.mode === 'existingProduct';
    const advanceLabel = isLast
      ? (isExisting ? 'Salvar audiência' : 'Salvar e criar produto')
      : 'Continuar';
    const backLabel = step === 0 ? 'Cancelar' : 'Voltar';
    const backAction = step === 0 ? 'Actions.cancelAudienceWizard()' : 'Actions.audienceWizardBack()';
    const advanceAction = isLast ? 'Actions.audienceWizardFinish()' : 'Actions.audienceWizardNext()';
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
    return `<div class="space-y-5">
      <div class="space-y-3">
        <p class="text-sm text-slate-600">Qual o modelo operacional e de receita?</p>
        ${this.OPERATIONAL_MODELS.map(m => this._choiceCard('modeloOperacional', m, w.modeloOperacional === m.id)).join('')}
      </div>
      <div class="pt-5 border-t border-slate-200 space-y-3">
        <div>
          <p class="text-sm text-slate-600">Como esse produto vende?</p>
          <p class="text-[11px] text-slate-500 mt-0.5">Define a fonte do Forecast × Realizado em Resultados e o ponto crítico que o tenant monitora.</p>
        </div>
        ${this.SALES_CHANNELS.map(m => this._choiceCard('salesChannel', m, w.salesChannel === m.id)).join('')}
      </div>
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
    if (!window.AudienceFusionEngine) {
      return `<div class="rounded-2xl bg-amber-50 border border-amber-300 p-4 text-sm text-amber-900">Motor de fusão de audiência não carregado. Recarregue a página.</div>`;
    }
    const fused = AudienceFusionEngine.fuse(w.modeloNegocio, w.modeloOperacional);
    if (!fused.ok) {
      return `<div class="rounded-2xl bg-rose-50 border border-rose-300 p-4 text-sm text-rose-900">${Utils.escape(fused.error || 'Erro ao montar quadro.')}</div>`;
    }

    // V38.1.44 — separa notas: incompatibilidade fica visível direto (exige
    // ação do cliente); negócio/operacional/marketplace ficam num acordeão.
    const notasAll = fused.notas || [];
    const notasIncompat = notasAll.filter(n => n.origem === 'incompatibilidade');
    const notasInfo = notasAll.filter(n => n.origem !== 'incompatibilidade');
    const renderNota = (n) => {
      const toneByOrigin = { negocio: 'violet', operacional: 'pink', marketplace: 'sky', incompatibilidade: 'amber' };
      const tone = toneByOrigin[n.origem] || 'slate';
      const iconByOrigin = { negocio: 'briefcase', operacional: 'package', marketplace: 'split', incompatibilidade: 'alert-triangle' };
      const icon = iconByOrigin[n.origem] || 'info';
      return `<div class="rounded-xl bg-${tone}-50 border border-${tone}-200 border-l-4 border-l-${tone}-500 px-3 py-2 flex items-start gap-2">
        <i data-lucide="${icon}" class="w-3.5 h-3.5 text-${tone}-700 mt-0.5 shrink-0"></i>
        <p class="text-xs text-${tone}-900 leading-relaxed">${Utils.escape(n.texto)}</p>
      </div>`;
    };
    const notasIncompatHtml = notasIncompat.map(renderNota).join('');
    const notasAccordion = notasInfo.length
      ? `<details class="rounded-xl bg-slate-50 border border-slate-200">
          <summary class="cursor-pointer px-3 py-2 text-[11px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2 select-none">
            <i data-lucide="book-open" class="w-3.5 h-3.5"></i>
            Ver regras desta combinação <span class="text-slate-400 font-bold ml-1">(${notasInfo.length})</span>
          </summary>
          <div class="px-3 pb-3 space-y-1.5 mt-1">${notasInfo.map(renderNota).join('')}</div>
        </details>`
      : '';

    // V38.1.44 — Mescla custom fields salvos no draft pra UI mostrar TUDO.
    const custom = w.customFields || { pa: [], icp: [], bp: [] };
    const paAll  = [...fused.pa,  ...(custom.pa  || [])];
    const icpAll = [...fused.icp, ...(custom.icp || [])];
    const bpAll  = [...fused.bp,  ...(custom.bp  || [])];
    const reqPa  = paAll.filter(f => !f.optional).length;
    const reqIcp = icpAll.filter(f => !f.optional).length;
    const reqBp  = bpAll.filter(f => !f.optional).length;

    return `<div class="space-y-3">
      <div class="rounded-2xl bg-slate-100 border border-slate-200 p-3 flex items-center gap-2 flex-wrap">
        <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Combinação</span>
        <span class="px-2.5 py-0.5 rounded-full bg-white border border-violet-300 text-violet-700 text-[11px] font-black">${Utils.escape(fused.negocioLabel)}</span>
        <span class="text-slate-400">×</span>
        <span class="px-2.5 py-0.5 rounded-full bg-white border border-pink-300 text-pink-700 text-[11px] font-black">${Utils.escape(fused.operacionalLabel)}</span>
        <span class="text-slate-300">|</span>
        <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Unidade</span>
        <span class="px-2.5 py-0.5 rounded-full bg-white border border-slate-300 text-slate-700 text-[11px] font-black">${Utils.escape(fused.unidade)}</span>
      </div>

      ${notasIncompatHtml ? `<div class="space-y-1.5">${notasIncompatHtml}</div>` : ''}
      ${notasAccordion}

      <div class="grid md:grid-cols-3 gap-3">
        ${this._layerColumn('C', 'Público-Alvo',  paAll,  reqPa,  'violet', 'pa')}
        ${this._layerColumn('B', 'ICP',           icpAll, reqIcp, 'pink',   'icp')}
        ${this._layerColumn('A', 'Buyer Persona', bpAll,  reqBp,  'amber',  'bp')}
      </div>

      ${this._djowBlock(w, fused)}
    </div>`;
  },

  // V38.1.40 — Bloco do Djow no Step 3. 3 estados:
  //   - inicial: convite pra pedir análise (lê leads do RD + KB de audiência)
  //   - loading: spinner 2-5s
  //   - resposta: prosa do Djow + botão "Pedir novamente"
  _djowBlock(w, fused) {
    if (w.djowLoading) {
      return `<div class="rounded-2xl bg-violet-50 border border-violet-200 border-l-4 border-l-violet-600 px-4 py-3 flex items-center gap-3">
        <div class="w-5 h-5 rounded-full border-2 border-violet-300 border-t-violet-700 animate-spin shrink-0"></div>
        <p class="text-xs text-violet-900 leading-relaxed"><b>Djow está analisando…</b> Cruzando os modelos escolhidos, sua amostra de leads e a base de conhecimento de audiência. Demora alguns segundos.</p>
      </div>`;
    }
    if (w.djowError) {
      return `<div class="rounded-2xl bg-rose-50 border border-rose-200 border-l-4 border-l-rose-600 px-4 py-3 flex items-start gap-2">
        <i data-lucide="alert-octagon" class="w-4 h-4 text-rose-700 mt-0.5 shrink-0"></i>
        <div class="flex-1 text-xs text-rose-900 leading-relaxed">
          <p><b>Djow não respondeu:</b> ${Utils.escape(w.djowError)}</p>
          <button onclick="Actions.djowAnalyzeAudience()" class="mt-2 px-3 py-1.5 rounded-lg bg-rose-700 text-white text-[11px] font-black hover:bg-rose-800">Tentar de novo</button>
        </div>
      </div>`;
    }
    if (w.djowAnalise) {
      const paragrafos = String(w.djowAnalise).split(/\n\s*\n/).filter(p => p.trim().length);
      const html = paragrafos.map(p => `<p>${Utils.escape(p).replace(/\n/g, '<br>')}</p>`).join('');
      return `<div class="rounded-2xl bg-gradient-to-br from-violet-50 to-pink-50 border border-violet-200 border-l-4 border-l-violet-600 p-4">
        <div class="flex items-center gap-2 mb-2">
          <i data-lucide="sparkles" class="w-4 h-4 text-violet-700"></i>
          <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest">Análise do Djow</p>
          <button onclick="Actions.djowAnalyzeAudience()" title="Pedir nova análise" class="ml-auto text-[10px] font-black text-violet-700 hover:text-violet-900 flex items-center gap-1"><i data-lucide="refresh-cw" class="w-3 h-3"></i> Pedir novamente</button>
        </div>
        <div class="text-xs text-slate-800 leading-relaxed space-y-2">${html}</div>
      </div>`;
    }
    // Estado inicial: convite
    return `<div class="rounded-2xl bg-violet-50 border border-violet-200 border-l-4 border-l-violet-600 p-4 flex items-start gap-3">
      <i data-lucide="sparkles" class="w-5 h-5 text-violet-700 shrink-0 mt-0.5"></i>
      <div class="flex-1 min-w-0">
        <p class="text-xs text-violet-900 leading-relaxed"><b>Djow montou o esqueleto.</b> ${fused.requiredCounts.pa} campos obrigatórios no PA, ${fused.requiredCounts.icp} no ICP, ${fused.requiredCounts.bp} no BP. Threshold 80% por camada.</p>
        <p class="text-xs text-violet-700 leading-relaxed mt-1">Quer que o Djow comente esse quadro lendo seus leads do RD e a base de conhecimento de audiência?</p>
        <button onclick="Actions.djowAnalyzeAudience()" class="mt-2.5 px-3 py-1.5 rounded-lg bg-violet-700 text-white text-[11px] font-black hover:bg-violet-800 flex items-center gap-1.5"><i data-lucide="sparkles" class="w-3.5 h-3.5"></i> Pedir análise do Djow</button>
      </div>
    </div>`;
  },

  // V38.1.44 — Aceita layerKey opcional pra suportar custom fields (botão +).
  _layerColumn(tag, title, fields, requiredCount, tone, layerKey) {
    const items = (fields || []).map(f => {
      const tagBadge = f.type === 'fit'
        ? `<span class="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">FIT</span>`
        : `<span class="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200 shrink-0">DADO</span>`;
      const optionalBadge = f.optional
        ? `<span class="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-200 shrink-0">OPC</span>`
        : '';
      const customBadge = f.custom
        ? `<button onclick="event.stopPropagation(); Actions.removeCustomAudienceField('${layerKey}', '${Utils.escape(f.key)}')" title="Remover campo custom" class="text-[10px] font-black px-1 py-0.5 rounded text-rose-500 hover:bg-rose-100 shrink-0">×</button>`
        : '';
      const tooltip = (f.tooltip || '') + (f.criterio ? ' Critério: ' + f.criterio : '') + (f.inferenciaRd ? ' Origem: ' + f.inferenciaRd : '');
      const customCls = f.custom ? 'border-violet-300 bg-violet-50/30' : 'border-slate-200 bg-white';
      return `<div title="${Utils.escape(tooltip)}" class="rounded-xl border ${customCls} px-2.5 py-2 flex items-center gap-1.5">
        <span class="text-[11px] font-bold text-slate-700 truncate flex-1">${Utils.escape(f.label || f.key)}</span>
        ${optionalBadge}
        ${tagBadge}
        ${customBadge}
      </div>`;
    }).join('');
    const addBtn = layerKey
      ? `<button onclick="Actions.addCustomAudienceField('${layerKey}')" class="mt-1.5 w-full px-2 py-1.5 rounded-xl border-2 border-dashed border-${tone}-300 text-${tone}-700 text-[10px] font-black uppercase tracking-wider hover:bg-${tone}-50 transition flex items-center justify-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i> Campo custom</button>`
      : '';
    return `<div class="rounded-2xl bg-${tone}-50/40 border border-${tone}-200 border-l-4 border-l-${tone}-500 p-3">
      <div class="flex items-center gap-1.5 mb-2">
        <span class="w-5 h-5 rounded-md bg-${tone}-100 text-${tone}-700 grid place-items-center text-[10px] font-black">${tag}</span>
        <p class="text-[11px] font-black text-${tone}-900 uppercase tracking-widest">${title}</p>
        <span class="ml-auto text-[10px] font-black text-${tone}-700">${requiredCount} obrig.</span>
      </div>
      <div class="space-y-1.5">${items || `<p class="text-[10px] text-slate-400 italic">Sem campos.</p>`}</div>
      ${addBtn}
    </div>`;
  },

  _step4Deprecated(w) {
    const negocio = this.BUSINESS_MODELS.find(m => m.id === w.modeloNegocio);
    const operacional = this.OPERATIONAL_MODELS.find(m => m.id === w.modeloOperacional);
    const fused = (window.AudienceFusionEngine && w.modeloNegocio && w.modeloOperacional)
      ? AudienceFusionEngine.fuse(w.modeloNegocio, w.modeloOperacional)
      : null;
    const counts = fused?.requiredCounts || { pa: 0, icp: 0, bp: 0 };
    return `<div class="space-y-5">
      <p class="text-sm text-slate-600">Confirme antes de salvar.</p>
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
      <div class="grid grid-cols-3 gap-3">
        <div class="rounded-2xl bg-violet-50 border border-violet-200 border-l-4 border-l-violet-600 p-3 text-center">
          <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest">PA</p>
          <p class="font-black text-2xl text-slate-900 mt-0.5">${counts.pa}</p>
          <p class="text-[10px] text-slate-500">obrigatórios</p>
        </div>
        <div class="rounded-2xl bg-pink-50 border border-pink-200 border-l-4 border-l-pink-500 p-3 text-center">
          <p class="text-[10px] font-black text-pink-700 uppercase tracking-widest">ICP</p>
          <p class="font-black text-2xl text-slate-900 mt-0.5">${counts.icp}</p>
          <p class="text-[10px] text-slate-500">obrigatórios</p>
        </div>
        <div class="rounded-2xl bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 p-3 text-center">
          <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest">BP</p>
          <p class="font-black text-2xl text-slate-900 mt-0.5">${counts.bp}</p>
          <p class="text-[10px] text-slate-500">obrigatórios</p>
        </div>
      </div>
      <div class="rounded-2xl bg-emerald-50 border border-emerald-200 border-l-4 border-l-emerald-600 p-4">
        <p class="text-xs text-emerald-900 leading-relaxed"><b>Pronto.</b> Ao salvar, o produto ganha o quadro de audiência completo e a badge <b>"ICP CONFIGURADO"</b>. Threshold default 80% por camada. Você pode editar a audiência depois pelo mesmo botão no card.</p>
      </div>
    </div>`;
  }
};

window.ProductAudienceModal = ProductAudienceModal;
