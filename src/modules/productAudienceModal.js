// V38.1.36 — Wizard "Definir Audiência" (renomeado pra "Arquétipo de Vendas").
//
// V40.14.3 — Onda Leonardo + reorganização estrutural (Felipe 2026-06-24):
//
//   1. Botão Continuar/Confirmar PRETO (slate-900) — quebra a ressonância
//      cromática com o header roxo.
//   2. Fundo do modal off-white (stone-50) + cards internos bg-white.
//   3. Passo 0 sem brinde + mensagem-mestre vira prosa de boas-vindas em
//      text-base (era card "MINI AULA" empacotando o lema).
//   4. CALIBRATED_AREAS const + lei dos consumidores. Esse registry alimenta
//      DOIS lugares (passo 0 + passo 6) — promessa = entrega sincronizadas.
//      Score Engine e Mapa da Receita NÃO entram até consumirem o arquétipo
//      (lei [[feedback_no_source_no_dash]]).
//   5. Operacional e Canal separados em 2 steps → wizard de 7 passos.
//   6. Modelo Operacional em grid 3×3 (resolve órfão Agribusiness, 9 cards
//      perfeitos em 3 linhas de 3).
//   7. Painel lateral navegável (zigzag): cliente clica em step já visitado
//      pra editar sem voltar 3× no botão.
//   8. Refinamento vira 4 ROLETAS (Ticket / Ciclo / Time / Tracking) com
//      defaults razoáveis no meio + descrição ao vivo + dots clicáveis.
//      Conceitual: refinamento deixa de ser "opcional" e vira "ajuste fino
//      com defaults".
//   9. Quadro de Audiência: card "Combinação" do topo removido (vive no
//      painel lateral agora — sem duplicação).
//  10. Confirmação: card "O que você escolheu" removido (idem), card do
//      Arquétipo ELEVADO com cor do próprio arquétipo (border-l 6px),
//      Score Engine e Mapa da Receita REMOVIDOS dos consequência (não
//      consomem), títulos aliviados ("Velocidade" em vez de "Card de
//      Velocidade" etc), emoji lupa removido do eyebrow, copy do card
//      escuro simplificada + contraste subido (text-slate-100 em vez de
//      slate-300, ratio 13:1 em vez de 5.4:1).
//
// State: App.state.audienceWizard = {
//   open, mode: 'createProduct'|'createProductMapa'|'existingProduct'|'draft'|'mapaPopupDraft',
//   step, productId, pendingDraft,
//   modeloNegocio, modeloOperacional, salesChannel, refinamento,
//   quadroPA: [], quadroICP: [], quadroBP: [], customFields,
//   visited: [0, 1, ...]  // V40.14.3 — pro painel lateral navegável
// }

var ProductAudienceModal = {
  // V40.14.3 — Lei dos Consumidores. Todo módulo que ganhar pele adaptativa
  // (consumir AudienceConsumerEngine) precisa aparecer aqui. Esse registry
  // alimenta DOIS lugares:
  //   (a) passo 0 — "Quando você cravar, o LJ se calibra em N áreas"
  //   (b) passo 6 — cards "O que o LJ vai assumir em cada módulo"
  // Mantém promessa e entrega sincronizadas — cliente nunca vê módulo
  // prometido que não consome ainda.
  //
  // REGRA: status: 'active' OBRIGATÓRIO pra entrar. Score Engine e Mapa
  // da Receita NÃO entram até consumirem o arquétipo (hoje só passam pelo
  // catálogo, ninguém chama getScoreConfig/getMapaConfig). Quando virarem
  // adaptativos, adicionar entrada aqui e os 2 lugares puxam automático.
  CALIBRATED_AREAS: [
    { key: 'velocidade', label: 'Velocidade', icon: 'zap',            accent: 'var(--lj-sales)',   status: 'active' },
    { key: 'djow',       label: 'Djow',       icon: 'message-circle', accent: 'var(--lj-revops)',  status: 'active' },
    { key: 'revops',     label: 'RevOps',     icon: 'trending-up',    accent: 'var(--lj-revenue)', status: 'active' }
  ],

  // V40.14.3 — Defaults razoáveis pras 4 roletas do Refinamento. Aplicados
  // quando o cliente entra no step 4 e refinamento está vazio. Cliente pode
  // refinar com as setas/dots — defaults só dão ponto de partida.
  REFINAMENTO_DEFAULTS: {
    ticket: 'medio',
    ciclo: 'curto',
    time_comercial: 'autoatendimento',
    tracking_maduro: 'parcial'
  },

  BUSINESS_MODELS: [
    { id: 'b2b',   label: 'B2B',   tagline: 'Empresa → Empresa',  body: 'Vendas de empresas para empresas. Foco em resolver problemas corporativos, otimizar processos ou revender produtos. Ex: software de gestão (ERP), consultoria.' },
    { id: 'b2c',   label: 'B2C',   tagline: 'Empresa → Consumidor', body: 'Vendas diretas da empresa para o consumidor final. Foco em atender necessidades e desejos individuais. Ex: varejo, supermercados, cinemas.' },
    { id: 'b2b2c', label: 'B2B2C', tagline: 'Empresa → Empresa → Consumidor', body: 'Uma empresa B2B faz parceria com outra para alcançar o consumidor final, ou plataforma conecta empresas a consumidores. Ex: delivery que vende pra restaurantes.' },
    { id: 'c2c',   label: 'C2C',   tagline: 'Consumidor → Consumidor', body: 'Transações diretas entre consumidores, geralmente intermediadas por plataforma digital. Ex: marketplaces de usados ou artesanato.' }
  ],
  OPERATIONAL_MODELS: [
    { id: 'saas',         label: 'SaaS',                tagline: 'Software por assinatura',   body: 'Software hospedado na nuvem. Cliente paga assinatura (mensal/anual) para usar. Ex: streaming, automação de marketing.' },
    { id: 'ecommerce',    label: 'E-commerce',          tagline: 'Loja online',               body: 'Venda de produtos físicos ou digitais exclusivamente pela internet. Ex: lojas virtuais de roupas, eletrônicos.' },
    { id: 'agencia',      label: 'Agência',             tagline: 'Serviços especializados',   body: 'Time vende tempo, conhecimento e execução pra outras empresas. Ex: publicidade, marketing digital, desenvolvimento web.' },
    { id: 'marketplace',  label: 'Marketplace',         tagline: 'Plataforma de conexão',     body: 'Conecta múltiplos vendedores a múltiplos compradores. Cobra taxa/comissão. Ex: apps de transporte, grandes varejistas.' },
    { id: 'freemium',     label: 'Freemium',            tagline: 'Grátis + premium',          body: 'Produto básico grátis; recursos avançados, mais capacidade ou exclusividade são cobrados. Ex: apps de edição, jogos com compras.' },
    { id: 'atacado',      label: 'Atacado / Wholesale', tagline: 'Vende pra estabelecimento', body: 'Vende em quantidade pra estabelecimento que revende (bar, mercado, distribuidor). Ticket por pedido (fardo/caixa), não unitário. SDR/representante visita. Ex: cervejaria → bar, fornecedor de alimentos → supermercado.' },
    { id: 'consultoria',  label: 'Consultoria',         tagline: 'Estratégia + alto ticket',  body: 'Vende serviço estratégico de alto valor com ciclo longo e decisor sênior. Dor é estratégica (margem, market share), não operacional. Ex: consultoria de transformação, planejamento estratégico, M&A.' },
    { id: 'manufatura',   label: 'Manufatura B2B',      tagline: 'Indústria → indústria',     body: 'Fornece produto/insumo industrial pra outra indústria. Dois decisores (engenharia + compras). Ciclo longo, homologação trava ou destrava. Ex: autopeça → montadora, embalagem → fábrica.' },
    { id: 'agribusiness', label: 'Agribusiness',        tagline: 'Cadeia agro',               body: 'Atua na cadeia rural (produtor → cooperativa → mercado). Vendedor visita ou coop intermedia. Janela de safra manda. Negócio de confiança. Ex: insumo agrícola, máquina agrícola, grão pra exportação.' }
  ],
  SALES_CHANNELS: [
    { id: 'checkout', label: 'Checkout',           tagline: 'Página de venda',           body: 'Cliente clica "Comprar", insere cartão, fecha sozinho. Ex: Hotmart, Eduzz, Kiwify, Stripe, página própria.' },
    { id: 'crm',      label: 'Comercial via CRM',  tagline: 'Vendedor + contrato',       body: 'Vendedor conversa, manda proposta, fecha contrato. Faturamento declarado no Fechamento mensal + cruzamento com CRM. Ex: serviço B2B, software enterprise, consultoria.' },
    { id: 'hybrid',   label: 'Os dois caminhos',   tagline: 'Híbrido (checkout + CRM)',  body: 'Esse produto vende dos dois jeitos. Ex: SaaS com plano self-service + plano enterprise.' }
  ],

  STEP_TITLES: ['O que é Arquétipo de Vendas?', 'Modelo de Negócio', 'Modelo Operacional', 'Canal de Venda', 'Refinamento', 'Quadro de Audiência', 'Confirmação'],
  STEP_SHORT_LABELS: ['Apresentação', 'Modelo de Negócio', 'Modelo Operacional', 'Canal de Venda', 'Refinamento', 'Quadro', 'Confirmação'],
  TOTAL_STEPS: 7,

  // V40.14.4 — Wizard cresce horizontalmente pra ~1280px em todos os steps.
  // Antes: steps 0-4 em max-w-5xl (1024px), 5-6 em max-w-6xl (1152px).
  // O step Operacional (grid 3×3 com 9 cards) ficava espremido — body do
  // Atacado/Wholesale criava muito vazio vertical pra caber. Subir pra
  // max-w-7xl dá respiro pra todos sem quebrar a coerência visual.
  _modalWidth(step) {
    return 'max-w-7xl';
  },

  render() {
    const w = App.state.audienceWizard;
    if (!w || !w.open) return '';
    const step = Number(w.step || 0);
    const widthCls = this._modalWidth(step);
    return `<div id="audienceWizardBackdrop" class="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div class="bg-stone-50 rounded-[2rem] shadow-2xl border border-stone-100 w-full ${widthCls} mx-auto mt-8 overflow-hidden">
        ${this._header(w, step)}
        <div class="flex">
          ${this._sidebar(w, step)}
          <div class="flex-1 p-6 lg:p-8 min-h-[440px]">
            ${step === 0 ? this._step0() : ''}
            ${step === 1 ? this._step1(w) : ''}
            ${step === 2 ? this._step2(w) : ''}
            ${step === 3 ? this._step3(w) : ''}
            ${step === 4 ? this._step4(w) : ''}
            ${step === 5 ? this._step5(w) : ''}
            ${step === 6 ? this._step6(w) : ''}
          </div>
        </div>
        ${this._footer(w, step)}
      </div>
    </div>`;
  },

  _header(w, step) {
    const titles = this.STEP_TITLES;
    const totalSteps = titles.length;
    const productName = w.mode === 'existingProduct'
      ? (App.state.products.find(p => Number(p.id) === Number(w.productId))?.name || 'Produto')
      : (w.pendingDraft?.name || 'Novo produto');
    const prefix = w.mode === 'existingProduct' ? 'Editar arquétipo de vendas' : 'Definir arquétipo de vendas';
    const pct = Math.round((step / (totalSteps - 1)) * 100);
    return `<header class="text-white p-6 flex items-start justify-between gap-4" style="background: linear-gradient(135deg, var(--lj-revops) 0%, var(--lj-revops-deep) 100%);">
      <div class="min-w-0 flex-1">
        <p class="text-[10px] font-black uppercase tracking-widest" style="color: var(--lj-revops-soft);">${prefix} · <span class="text-white/90">${Utils.escape(productName)}</span></p>
        <h2 class="text-2xl font-black mt-1 truncate">${Utils.escape(titles[step])}</h2>
        <div class="flex items-center gap-3 mt-3">
          <div class="flex-1 h-1 rounded-full bg-white/15 overflow-hidden">
            <div class="h-full bg-white rounded-full transition-all duration-300" style="width: ${pct}%;"></div>
          </div>
          <span class="text-[11px] font-black text-white/90 tabular-nums shrink-0">${step + 1} / ${totalSteps}</span>
        </div>
      </div>
      <button onclick="Actions.cancelAudienceWizard()" aria-label="Fechar (produto não será criado)" title="Fechar (produto não será criado)" class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white grid place-items-center shrink-0 transition"><i data-lucide="x" class="w-5 h-5"></i></button>
    </header>`;
  },

  // V40.14.3 — Painel lateral navegável. Cliente pode pular pra qualquer
  // step JÁ VISITADO (zigzag). Steps futuros ficam locked. Refinamento
  // mostra contagem "X de 4 ajustes" quando preenchido.
  _sidebar(w, step) {
    const titles = this.STEP_SHORT_LABELS;
    const visited = new Set(Array.isArray(w.visited) ? w.visited : [0]);
    const choices = this._sidebarChoices(w);
    return `<aside class="hidden md:flex w-56 shrink-0 bg-stone-100 border-r border-stone-200 p-4 flex-col gap-1">
      <p class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 px-2">Mapeamento</p>
      ${titles.map((t, i) => this._sidebarItem(i, t, step, visited.has(i), choices[i])).join('')}
    </aside>`;
  },

  _sidebarItem(idx, label, currentStep, isVisited, choice) {
    const isCurrent = idx === currentStep;
    const isLocked = !isVisited && !isCurrent;
    let containerCls = 'rounded-xl px-2 py-1.5 transition';
    let circleCls = '';
    let labelCls = '';
    let onclick = '';
    let circleContent = String(idx + 1);
    if (isCurrent) {
      containerCls += ' bg-violet-50';
      circleCls = 'bg-violet-700 text-white';
      labelCls = 'text-violet-900 font-black';
    } else if (isVisited) {
      containerCls += ' hover:bg-stone-200 cursor-pointer';
      circleCls = 'bg-emerald-100 text-emerald-700';
      labelCls = 'text-slate-900 font-black';
      circleContent = '✓';
      onclick = `onclick="Actions.audienceWizardJumpTo(${idx})"`;
    } else {
      containerCls += ' opacity-60 cursor-not-allowed';
      circleCls = 'bg-stone-200 text-slate-400';
      labelCls = 'text-slate-400 font-medium';
    }
    const choiceHtml = choice
      ? `<p class="text-[10px] ${isCurrent ? 'text-violet-700' : 'text-slate-600'} ml-7 mt-0.5 truncate font-medium" title="${Utils.escape(choice)}">${Utils.escape(choice)}</p>`
      : (isVisited && !isCurrent ? `<p class="text-[10px] text-slate-400 ml-7 mt-0.5 italic">—</p>` : '');
    return `<div ${onclick} class="${containerCls}" style="border-left: 3px solid ${isCurrent ? 'var(--lj-revops)' : 'transparent'};">
      <div class="flex items-center gap-2">
        <span class="w-5 h-5 rounded-full grid place-items-center text-[10px] font-black shrink-0 ${circleCls}">${circleContent}</span>
        <span class="text-[12px] ${labelCls} truncate">${Utils.escape(label)}</span>
      </div>
      ${choiceHtml}
    </div>`;
  },

  _sidebarChoices(w) {
    const bus = this.BUSINESS_MODELS.find(b => b.id === w.modeloNegocio);
    const op = this.OPERATIONAL_MODELS.find(b => b.id === w.modeloOperacional);
    const sc = this.SALES_CHANNELS.find(b => b.id === w.salesChannel);
    const r = w.refinamento || {};
    const refKeys = ['ticket','ciclo','time_comercial','tracking_maduro'];
    const refCount = refKeys.filter(k => r[k]).length;
    return [
      null,
      bus?.label || null,
      op?.label || null,
      sc?.label || null,
      refCount > 0 ? `${refCount} de 4 ajustes` : null,
      null,
      null
    ];
  },

  _footer(w, step) {
    const canAdvance = (step === 0) ||
                       (step === 1 && !!w.modeloNegocio) ||
                       (step === 2 && !!w.modeloOperacional) ||
                       (step === 3 && !!w.salesChannel) ||
                       (step === 4) ||
                       (step === 5) ||
                       (step === 6);
    const isLast = step === 6;
    const isExisting = w.mode === 'existingProduct';
    const advanceLabel = isLast
      ? (isExisting ? 'Confirmar e salvar' : 'Confirmar e criar produto')
      : 'Continuar';
    const backLabel = step === 0 ? 'Cancelar' : 'Voltar';
    const backAction = step === 0 ? 'Actions.cancelAudienceWizard()' : 'Actions.audienceWizardBack()';
    const advanceAction = isLast ? 'Actions.audienceWizardFinish()' : 'Actions.audienceWizardNext()';
    // V40.14.3 — Botão preto (slate-900) em vez de violet-700. Sem ressonância
    // cromática com header roxo, contraste preto×branco crava o gesto.
    const advanceCls = canAdvance
      ? 'bg-slate-900 hover:bg-slate-950 text-white cursor-pointer'
      : 'bg-stone-200 text-slate-400 cursor-not-allowed pointer-events-none';
    return `<footer class="bg-stone-100 border-t border-stone-200 p-5 flex items-center justify-between gap-3">
      <button onclick="${backAction}" class="px-5 py-3 rounded-full bg-white border border-stone-300 text-slate-700 font-black hover:bg-stone-50 transition">${backLabel}</button>
      <button onclick="${advanceAction}" class="px-5 py-3 rounded-full font-black transition ${advanceCls}">${advanceLabel}</button>
    </footer>`;
  },

  // V40.14.3 — Passo 0 sem brinde. Mensagem-mestre vira prosa de boas-vindas
  // em text-base (em vez de empacotada num card "MINI AULA" do mesmo peso
  // que os outros 3 blocos). Cards C/B/A do brinde removidos — o quadro
  // PA/ICP/BP continua existindo, mas só aparece no passo 5 quando o
  // cliente tiver cravado as 4 dimensões. Aqui não promete o que ele ainda
  // não escolheu. Ícones das áreas calibradas lidos de CALIBRATED_AREAS.
  _step0() {
    const areas = this.CALIBRATED_AREAS;
    return `<div class="space-y-5">
      <p class="text-base text-slate-800 leading-relaxed">
        Esse wizard mapeia o <b>arquétipo de vendas</b> do seu produto — o jeito como ele faz dinheiro. Em 4 perguntas, o LJ entende a máquina e se calibra inteiro pra ela.
      </p>

      <div class="rounded-2xl bg-white border border-stone-200 p-4 space-y-2">
        <p class="text-[10px] font-black uppercase tracking-widest text-slate-500">As 4 perguntas</p>
        <div class="grid sm:grid-cols-2 gap-x-3 gap-y-1.5 text-[12px] text-slate-700 leading-relaxed">
          <p>1. <b>Pra quem você vende?</b> Empresa, consumidor ou intermediário.</p>
          <p>2. <b>Como faz dinheiro?</b> Assinatura, venda única, ticket por pedido, projeto.</p>
          <p>3. <b>Por onde fecha?</b> Checkout digital, vendedor com contrato, ou os dois.</p>
          <p>4. <b>Em qual ritmo?</b> Ticket, ciclo, time comercial, granularidade do tracking.</p>
        </div>
      </div>

      <div class="rounded-2xl bg-white border border-stone-200 p-4">
        <p class="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Quando você cravar, o LJ se calibra em ${areas.length} áreas</p>
        <div class="grid gap-2" style="grid-template-columns: repeat(${areas.length}, minmax(0, 1fr));">
          ${areas.map(a => `
            <div class="text-center">
              <div class="w-10 h-10 rounded-xl mx-auto grid place-items-center mb-1" style="background: color-mix(in srgb, ${a.accent} 14%, white); color: ${a.accent};"><i data-lucide="${a.icon}" class="w-5 h-5"></i></div>
              <p class="text-[10px] font-black leading-tight" style="color: ${a.accent};">${Utils.escape(a.label)}</p>
            </div>
          `).join('')}
        </div>
      </div>

      <p class="text-xs text-slate-500 leading-relaxed">Pode <b>Continuar</b>.</p>
    </div>`;
  },

  _step1(w) {
    return `<div class="space-y-3">
      <p class="text-sm text-slate-700 font-semibold mb-4">Como esse produto chega no comprador?</p>
      <div class="grid md:grid-cols-2 gap-3">
        ${this.BUSINESS_MODELS.map(m => this._choiceCard('modeloNegocio', m, w.modeloNegocio === m.id)).join('')}
      </div>
    </div>`;
  },

  // V40.14.3 — Operacional ganha step próprio + grid 3×3 (resolve órfão
  // Agribusiness que ficava sozinho na 5ª linha do antigo grid 2-col).
  _step2(w) {
    return `<div class="space-y-3">
      <div>
        <p class="text-sm text-slate-700 font-semibold">Qual o modelo operacional e de receita?</p>
        <p class="text-[11px] text-slate-500 mt-0.5">Define como esse produto faz dinheiro — assinatura, venda única, comissão, ticket por pedido.</p>
      </div>
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        ${this.OPERATIONAL_MODELS.map(m => this._choiceCard('modeloOperacional', m, w.modeloOperacional === m.id)).join('')}
      </div>
    </div>`;
  },

  // V40.14.3 — Canal de Venda ganha step próprio. Antes vivia colado no
  // step Operacional (ambos em scroll comprido + 2 perguntas distintas
  // empilhadas). Separar cumpre a promessa do passo 0 ("4 perguntas → 4
  // steps após Apresentação") e dá ao Canal o respiro que merece — é ele
  // que define a fonte do Forecast × Realizado em Resultados.
  _step3(w) {
    return `<div class="space-y-3">
      <div>
        <p class="text-sm text-slate-700 font-semibold">Como esse produto vende?</p>
        <p class="text-[11px] text-slate-500 mt-0.5">Define a fonte do Forecast × Realizado em Resultados e o ponto crítico que o tenant monitora.</p>
      </div>
      <div class="grid md:grid-cols-3 gap-3">
        ${this.SALES_CHANNELS.map(m => this._choiceCard('salesChannel', m, w.salesChannel === m.id)).join('')}
      </div>
    </div>`;
  },

  // V40.14.3 — Refinamento vira 4 roletas (Ticket / Ciclo / Time / Tracking).
  // Defaults razoáveis aplicados ao entrar no step (em appActions). Cliente
  // gira a roleta com as setas ou clica direto no dot pra pular pra opção
  // específica. Cada roleta mostra label + tagline + descrição da opção
  // atual em tempo real.
  _step4(w) {
    return `<div class="space-y-5">
      <div class="rounded-2xl bg-white border border-stone-200 p-4" style="border-left: 4px solid var(--lj-revops);">
        <p class="text-[10px] font-black uppercase tracking-widest mb-1" style="color: var(--lj-revops);">Ajuste fino</p>
        <p class="text-sm text-slate-700 leading-relaxed">O LJ assume defaults razoáveis pra cada eixo. Refine o que destoa do seu produto — gira a roleta com as setas ou clica direto no ponto.</p>
      </div>
      ${this._roletaCard('ticket', w)}
      ${this._roletaCard('ciclo', w)}
      ${this._roletaCard('time_comercial', w)}
      ${this._roletaCard('tracking_maduro', w)}
    </div>`;
  },

  _roletaCard(key, w) {
    if (!window.AudienceFusionEngine) return '';
    const meta = AudienceFusionEngine.refinamentoMeta(key);
    const opcoes = AudienceFusionEngine.refinamentoOpcoes(key);
    if (!meta || !opcoes.length) return '';
    const refinamento = w.refinamento || {};
    const currentId = refinamento[key] || this.REFINAMENTO_DEFAULTS[key] || opcoes[0].id;
    let currentIdx = opcoes.findIndex(o => o.id === currentId);
    if (currentIdx < 0) currentIdx = 0;
    const current = opcoes[currentIdx];
    return `<div class="rounded-2xl border border-stone-200 bg-white p-4">
      <div class="mb-3">
        <p class="text-[11px] font-black uppercase tracking-widest" style="color: var(--lj-revops);">${Utils.escape(meta.label)}</p>
        <p class="text-[11px] text-slate-500 mt-0.5">${Utils.escape(meta.tagline || '')}</p>
      </div>

      <div class="flex items-stretch gap-2">
        <button onclick="Actions.audienceWizardRoletaStep('${key}', -1)" class="w-10 shrink-0 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-700 grid place-items-center transition" aria-label="Anterior" title="Anterior"><i data-lucide="chevron-left" class="w-5 h-5"></i></button>

        <div class="flex-1 rounded-xl border border-stone-200 bg-stone-50 p-3 min-h-[110px] flex flex-col justify-center">
          <div class="flex items-baseline gap-2 mb-1 flex-wrap">
            <p class="text-sm font-black text-slate-900">${Utils.escape(current.label)}</p>
            <span class="text-[11px] font-medium text-slate-500">${Utils.escape(current.tagline || '')}</span>
          </div>
          <p class="text-[12px] text-slate-600 leading-relaxed">${Utils.escape(current.description || '')}</p>
        </div>

        <button onclick="Actions.audienceWizardRoletaStep('${key}', 1)" class="w-10 shrink-0 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-700 grid place-items-center transition" aria-label="Próximo" title="Próximo"><i data-lucide="chevron-right" class="w-5 h-5"></i></button>
      </div>

      <div class="flex justify-center gap-1.5 mt-3">
        ${opcoes.map((o, i) => `<button onclick="Actions.audienceWizardRoletaJump('${key}', '${o.id}')" title="${Utils.escape(o.label)}" aria-label="${Utils.escape(o.label)}" class="h-2 rounded-full transition ${i === currentIdx ? 'w-6 bg-violet-700' : 'w-2 bg-stone-300 hover:bg-stone-400'}"></button>`).join('')}
      </div>
    </div>`;
  },

  // V40.14.3 — Quadro de Audiência: card "Combinação" do topo removido
  // (vive no painel lateral agora — sem duplicação). Continua mostrando
  // notas de incompatibilidade + acordeão de regras + 3 colunas PA/ICP/BP
  // + bloco do Djow.
  _step5(w) {
    if (!window.AudienceFusionEngine) {
      return `<div class="rounded-2xl bg-amber-50 border border-amber-300 p-4 text-sm text-amber-900">Motor de fusão de audiência não carregado. Recarregue a página.</div>`;
    }
    const fused = AudienceFusionEngine.fuse(w.modeloNegocio, w.modeloOperacional, w.refinamento || null);
    if (!fused.ok) {
      return `<div class="rounded-2xl bg-rose-50 border border-rose-300 p-4 text-sm text-rose-900">${Utils.escape(fused.error || 'Erro ao montar quadro.')}</div>`;
    }

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
      ? `<details class="rounded-xl bg-stone-100 border border-stone-200">
          <summary class="cursor-pointer px-3 py-2 text-[11px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2 select-none">
            <i data-lucide="book-open" class="w-3.5 h-3.5"></i>
            Ver regras desta combinação <span class="text-slate-400 font-bold ml-1">(${notasInfo.length})</span>
          </summary>
          <div class="px-3 pb-3 space-y-1.5 mt-1">${notasInfo.map(renderNota).join('')}</div>
        </details>`
      : '';

    const custom = w.customFields || { pa: [], icp: [], bp: [] };
    const paAll  = [...fused.pa,  ...(custom.pa  || [])];
    const icpAll = [...fused.icp, ...(custom.icp || [])];
    const bpAll  = [...fused.bp,  ...(custom.bp  || [])];
    const reqPa  = paAll.filter(f => !f.optional).length;
    const reqIcp = icpAll.filter(f => !f.optional).length;
    const reqBp  = bpAll.filter(f => !f.optional).length;

    return `<div class="space-y-3">
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

  // V40.14.3 — Confirmação: card "O que você escolheu" REMOVIDO (redundante
  // com painel lateral). Card do Arquétipo ELEVADO com cor do próprio
  // arquétipo identificado (border-l 6px + tint sutil). Score Engine e
  // Mapa da Receita REMOVIDOS dos consequência (não consomem o arquétipo
  // hoje, lei [[feedback_no_source_no_dash]]). Títulos aliviados.
  // Emoji lupa removido do eyebrow. Card escuro: copy simplificada (sem
  // "pede pro Djow refletir" que era ação fantasma) + contraste subido
  // (text-slate-100 ≈ 13:1 sobre slate-900, AA+ pra texto pequeno).
  _step6(w) {
    if (!window.AudienceFusionEngine || !window.AudienceConsequencesCatalog) {
      return `<div class="rounded-2xl bg-amber-50 border border-amber-300 p-4 text-sm text-amber-900">Catálogo de consequências não carregado. Recarregue a página.</div>`;
    }

    const fused = AudienceFusionEngine.fuse(w.modeloNegocio, w.modeloOperacional, w.refinamento || null);
    const audienceLite = {
      modeloNegocio: w.modeloNegocio,
      modeloOperacional: w.modeloOperacional,
      salesChannel: w.salesChannel,
      refinamento: w.refinamento || null
    };
    const cls = AudienceFusionEngine.classifyArchetype(audienceLite);
    const confidence = AudienceFusionEngine.confidenceScore(audienceLite, fused);
    const arch = cls?.archetype || window.AudienceConsequencesCatalog.FALLBACK;
    const archAccent = arch.accent || 'var(--lj-revops)';

    const pct = Math.round(confidence * 100);
    const confTone = confidence >= 0.8 ? 'emerald' : confidence >= 0.5 ? 'amber' : 'rose';
    const confLabel = confidence >= 0.8 ? 'alta' : confidence >= 0.5 ? 'média' : 'baixa';

    const consequenciaCard = (icon, title, content, accentVar) => `
      <div class="rounded-2xl border border-stone-200 bg-white p-4" style="border-left: 4px solid ${accentVar};">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-8 h-8 rounded-xl grid place-items-center" style="background: color-mix(in srgb, ${accentVar} 14%, white);">
            <i data-lucide="${icon}" class="w-4 h-4" style="color: ${accentVar};"></i>
          </div>
          <p class="text-[11px] font-black uppercase tracking-widest" style="color: ${accentVar};">${title}</p>
        </div>
        <div class="text-[12px] text-slate-700 leading-relaxed space-y-1">${content}</div>
      </div>`;

    const vel = arch.velocidade || {};
    const djow = arch.djow || {};
    const revops = arch.revops || {};

    return `<div class="space-y-5">
      <!-- Arquétipo herói: cor do próprio arquétipo identificado, border-l 6px -->
      <div class="rounded-2xl bg-white p-5" style="border: 1px solid color-mix(in srgb, ${archAccent} 22%, white); border-left: 6px solid ${archAccent};">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-[10px] font-black uppercase tracking-widest mb-1" style="color: ${archAccent};">Arquétipo identificado</p>
            <p class="text-xl font-black text-slate-900 leading-tight">${Utils.escape(arch.label || 'Não classificado')}</p>
            <p class="text-[12px] text-slate-600 leading-relaxed mt-1">${Utils.escape(arch.tagline || '')}</p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confiança</p>
            <p class="text-3xl font-black tabular-nums text-${confTone}-700 leading-none mt-1">${pct}%</p>
            <p class="text-[10px] font-black text-${confTone}-700 uppercase mt-0.5">${confLabel}</p>
          </div>
        </div>
      </div>

      ${cls?.fallback ? `<div class="rounded-2xl bg-white border border-stone-200 p-3 text-[12px] text-slate-700" style="border-left: 4px solid var(--lj-warning);"><b>Combinação ainda sem arquétipo cravado.</b> LJ usa defaults genéricos por enquanto — você pode seguir mesmo assim. Master pode cravar arquétipos customizados em sprint futura.</div>` : ''}

      <!-- Só os 3 módulos que consomem o arquétipo hoje (Velocidade, Djow, RevOps) -->
      <div>
        <p class="text-[11px] font-black text-slate-700 uppercase tracking-widest mb-2">O que o LJ vai assumir em cada módulo</p>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          ${consequenciaCard('zap', 'Velocidade', `
            <p>• <b>V · ${Utils.escape(vel.v_label || '—')}</b></p>
            <p>• <b>C · ${Utils.escape(vel.c_label || '—')}</b></p>
            <p>• <b>L · ${Utils.escape(vel.l_label || '—')}</b></p>
            <p>• <b>T · ${Utils.escape(vel.t_label || '—')}</b></p>
            <p class="text-slate-500 mt-1.5 text-[11px]">Fonte: ${Utils.escape(vel.v_source || '—')}</p>
          `, 'var(--lj-sales)')}

          ${consequenciaCard('message-circle', 'Djow', `
            <p><b>Tom:</b> ${Utils.escape(djow.tone || '—')}</p>
            <p class="mt-1"><b>Foco:</b> ${Utils.escape(djow.focus || '—')}</p>
          `, 'var(--lj-revops)')}

          ${consequenciaCard('trending-up', 'RevOps', `
            <p><b>Payback saudável:</b> ${Utils.escape(revops.payback_saudavel || '—')}</p>
            ${revops.roas_min ? `<p><b>ROAS mínimo:</b> ${revops.roas_min}×</p>` : ''}
            <p class="mt-1"><b>Foco:</b> ${Utils.escape(revops.foco || '—')}</p>
          `, 'var(--lj-revenue)')}
        </div>
      </div>

      <!-- Validação final: contraste subido (text-slate-100 ≈ 13:1), copy simplificada -->
      <div class="rounded-2xl text-white p-4" style="background: rgba(15, 23, 42, 0.97); border-left: 4px solid ${archAccent};">
        <p class="text-sm font-black mb-1">Isso faz sentido pro seu negócio?</p>
        <p class="text-[13px] text-slate-100 leading-relaxed">Se clicar Confirmar, o LJ vai aplicar essas premissas em todos os módulos. Se algo destoa, volta e ajusta.</p>
      </div>
    </div>`;
  },

  // V40.12.16 — Card de escolha mantido. _layerCard removido (era só do
  // brinde do passo 0, que saiu na V40.14.3).
  _choiceCard(field, m, selected) {
    return `<button onclick="Actions.audienceWizardChoose('${field}', '${m.id}')" class="w-full text-left rounded-2xl border-2 p-4 transition ${selected ? 'border-violet-600 bg-violet-50' : 'border-stone-200 bg-white hover:bg-stone-50'}">
      <div class="flex items-start gap-3">
        <div class="w-9 h-9 rounded-xl grid place-items-center font-black text-sm shrink-0 ${selected ? 'bg-violet-600 text-white' : 'bg-stone-100 text-slate-700'}">${m.label[0]}</div>
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-2 mb-0.5 flex-wrap">
            <p class="font-black text-slate-900">${m.label}</p>
            <span class="text-[11px] font-medium text-slate-500">${m.tagline}</span>
          </div>
          <p class="text-xs text-slate-600 leading-relaxed">${m.body}</p>
        </div>
      </div>
    </button>`;
  },

  // V38.1.40 — Bloco do Djow no Quadro. 3 estados: convite/loading/resposta.
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
    return `<div class="rounded-2xl bg-violet-50 border border-violet-200 border-l-4 border-l-violet-600 p-4 flex items-start gap-3">
      <i data-lucide="sparkles" class="w-5 h-5 text-violet-700 shrink-0 mt-0.5"></i>
      <div class="flex-1 min-w-0">
        <p class="text-xs text-violet-900 leading-relaxed"><b>Djow montou o esqueleto.</b> ${fused.requiredCounts.pa} campos obrigatórios no PA, ${fused.requiredCounts.icp} no ICP, ${fused.requiredCounts.bp} no BP. Threshold 80% por camada.</p>
        <p class="text-xs text-violet-700 leading-relaxed mt-1">Quer que o Djow comente esse quadro lendo seus leads do RD e a base de conhecimento de audiência?</p>
        <button onclick="Actions.djowAnalyzeAudience()" class="mt-2.5 px-3 py-1.5 rounded-lg bg-violet-700 text-white text-[11px] font-black hover:bg-violet-800 flex items-center gap-1.5"><i data-lucide="sparkles" class="w-3.5 h-3.5"></i> Pedir análise do Djow</button>
      </div>
    </div>`;
  },

  _layerColumn(tag, title, fields, requiredCount, tone, layerKey) {
    const items = (fields || []).map(f => {
      const fitDot = f.type === 'fit'
        ? `<span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="FIT — sinal de aderência ao ICP"></span>`
        : `<span class="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" title="DADO — campo de firmografia/contexto"></span>`;
      const optionalBadge = f.optional
        ? `<span class="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0" title="Opcional">opc</span>`
        : '';
      const customBadge = f.custom
        ? `<button onclick="event.stopPropagation(); Actions.removeCustomAudienceField('${layerKey}', '${Utils.escape(f.key)}')" title="Remover campo custom" class="text-[10px] font-black px-1 py-0.5 rounded-full text-rose-500 hover:bg-rose-100 shrink-0">×</button>`
        : '';
      const tooltip = (f.tooltip || '') + (f.criterio ? ' Critério: ' + f.criterio : '') + (f.inferenciaRd ? ' Origem: ' + f.inferenciaRd : '');
      const customCls = f.custom ? 'border-violet-300 bg-violet-50/30' : 'border-stone-200 bg-white';
      return `<div title="${Utils.escape(tooltip)}" class="rounded-xl border ${customCls} px-2.5 py-2 flex items-center gap-2">
        ${fitDot}
        <span class="text-[11px] font-bold text-slate-700 truncate flex-1">${Utils.escape(f.label || f.key)}</span>
        ${optionalBadge}
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
  }
};

window.ProductAudienceModal = ProductAudienceModal;
