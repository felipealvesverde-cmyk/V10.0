// V38.1.36 — Wizard "Definir Audiência" (ICP do produto).
//
// Hard bloqueante: produto não nasce sem audience.configured=true.
//
// V40.12.5 — 6 steps (refinamento ganha passo próprio pra aliviar scroll do
// passo Operacional que carregava 9 modelos + 3 canais + 4 grupos × 5 opções):
//   0 — Apresentação (mini aula ICP base Olyng)
//   1 — Modelo de Negócio (B2B/B2C/B2B2C/C2C)
//   2 — Modelo Operacional + Canal de Venda
//   3 — Refinamento (Átomos refinadores — opcional)
//   4 — Quadro PA/ICP/BP (Djow sugere)
//   5 — Confirmação "esfregando na cara"
//
// V40.12.8 — Onda Leonardo. Auditoria visual completa (23 ajustes):
//   header em var(--lj-revops), eyebrow com nome do produto, progress bar
//   contínua + "5/6", botão fechar Lucide, footer com estados de disabled
//   limpo, min-height pra evitar footer flutuante, cards C/B/A com peso
//   decrescente, grid 2x2/2-col nos steps 1-2, refinamento com hierarquia
//   tipográfica refinada, prosa no header do quadro, paleta semântica
//   oficial nos cards de consequência (--lj-sales/marketing/revops/revenue/cs),
//   tabular-nums no confidence, animação de entrada, side-accent law
//   aplicada universalmente, border-radius disciplinado.
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
    { id: 'saas',         label: 'SaaS',                tagline: 'Software por assinatura',   body: 'Software hospedado na nuvem. Cliente paga assinatura (mensal/anual) para usar. Ex: streaming, automação de marketing.' },
    { id: 'ecommerce',    label: 'E-commerce',          tagline: 'Loja online',               body: 'Venda de produtos físicos ou digitais exclusivamente pela internet. Ex: lojas virtuais de roupas, eletrônicos.' },
    { id: 'agencia',      label: 'Agência',             tagline: 'Serviços especializados',   body: 'Time vende tempo, conhecimento e execução pra outras empresas. Ex: publicidade, marketing digital, desenvolvimento web.' },
    { id: 'marketplace',  label: 'Marketplace',         tagline: 'Plataforma de conexão',     body: 'Conecta múltiplos vendedores a múltiplos compradores. Cobra taxa/comissão. Ex: apps de transporte, grandes varejistas.' },
    { id: 'freemium',     label: 'Freemium',            tagline: 'Grátis + premium',          body: 'Produto básico grátis; recursos avançados, mais capacidade ou exclusividade são cobrados. Ex: apps de edição, jogos com compras.' },
    // V40.12.1 — Sprint 2 da Onda V2 de Audiência. Modelos pra cobrir lacunas.
    { id: 'atacado',      label: 'Atacado / Wholesale', tagline: 'Vende pra estabelecimento', body: 'Vende em quantidade pra estabelecimento que revende (bar, mercado, distribuidor). Ticket por pedido (fardo/caixa), não unitário. SDR/representante visita. Ex: cervejaria → bar, fornecedor de alimentos → supermercado.' },
    { id: 'consultoria',  label: 'Consultoria',         tagline: 'Estratégia + alto ticket',  body: 'Vende serviço estratégico de alto valor com ciclo longo e decisor sênior. Dor é estratégica (margem, market share), não operacional. Ex: consultoria de transformação, planejamento estratégico, M&A.' },
    { id: 'manufatura',   label: 'Manufatura B2B',      tagline: 'Indústria → indústria',     body: 'Fornece produto/insumo industrial pra outra indústria. Dois decisores (engenharia + compras). Ciclo longo, homologação trava ou destrava. Ex: autopeça → montadora, embalagem → fábrica.' },
    { id: 'agribusiness', label: 'Agribusiness',        tagline: 'Cadeia agro',               body: 'Atua na cadeia rural (produtor → cooperativa → mercado). Vendedor visita ou coop intermedia. Janela de safra manda. Negócio de confiança. Ex: insumo agrícola, máquina agrícola, grão pra exportação.' }
  ],
  // V39.1.0 — Canal de fechamento da venda. Define a fonte do Realizado
  // (Forecast × Realizado em Resultados) E o ponto crítico que o tenant
  // monitora automaticamente.
  SALES_CHANNELS: [
    { id: 'checkout', label: 'Checkout',           tagline: 'Página de venda',           body: 'Cliente clica "Comprar", insere cartão, fecha sozinho. Ex: Hotmart, Eduzz, Kiwify, Stripe, página própria.' },
    { id: 'crm',      label: 'Comercial via CRM',  tagline: 'Vendedor + contrato',       body: 'Vendedor conversa, manda proposta, fecha contrato. Faturamento declarado no Fechamento mensal + cruzamento com CRM. Ex: serviço B2B, software enterprise, consultoria.' },
    { id: 'hybrid',   label: 'Os dois caminhos',   tagline: 'Híbrido (checkout + CRM)',  body: 'Esse produto vende dos dois jeitos. Ex: SaaS com plano self-service + plano enterprise.' }
  ],

  // V40.12.8 — Paleta semântica por field (cada bloco de escolhas ganha sua cor).
  ACCENTS: {
    negocio:      'var(--lj-revops)',  // decisão estrutural
    operacional:  'var(--lj-sales)',   // como faz dinheiro
    canal:        'var(--lj-revenue)', // fonte do realizado
    refinamento:  'var(--lj-cs)'       // afinamento sutil
  },

  // V40.12.8 — Largura adaptativa por passo. Passos 4-5 carregam tabelas
  // (3 colunas PA/ICP/BP, 5 cards de consequência) que pedem mais ar.
  _modalWidth(step) {
    return step >= 4 ? 'max-w-5xl' : 'max-w-3xl';
  },

  // V40.12.8 — Style block injetado uma vez (presente em todo render do modal
  // mas idempotente — browsers deduplicam). Define animação de entrada e
  // refinos de hierarquia tipográfica que Tailwind sozinho não exprime.
  _styleBlock() {
    return `<style>
      @keyframes ljAudWizIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes ljAudWizBackdropIn { from { opacity: 0; } to { opacity: 1; } }
      #audienceWizardBackdrop { animation: ljAudWizBackdropIn 180ms ease-out; }
      #audienceWizardBackdrop > div { animation: ljAudWizIn 220ms cubic-bezier(.22,1,.36,1); }
      .lj-aud-num { font-variant-numeric: tabular-nums; }
    </style>`;
  },

  render() {
    const w = App.state.audienceWizard;
    if (!w || !w.open) return '';
    const step = Number(w.step || 0);
    const widthCls = this._modalWidth(step);
    return `${this._styleBlock()}
    <div id="audienceWizardBackdrop" class="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div class="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full ${widthCls} mx-auto mt-8 overflow-hidden">
        ${this._header(w, step)}
        <div class="p-6 lg:p-8 min-h-[440px]">
          ${step === 0 ? this._step0() : ''}
          ${step === 1 ? this._step1(w) : ''}
          ${step === 2 ? this._step2(w) : ''}
          ${step === 3 ? this._step3(w) : ''}
          ${step === 4 ? this._step4(w) : ''}
          ${step === 5 ? this._step5(w) : ''}
        </div>
        ${this._footer(w, step)}
      </div>
    </div>`;
  },

  // V40.12.8 — Header em var(--lj-revops). Nome do produto desce pra eyebrow
  // (junto de "Editar audiência · Passo X de Y"). H2 fica apenas com o título
  // do passo, sem em-dash. Progress bar contínua + "X / Y" tabular abaixo.
  _header(w, step) {
    const titles = ['O que é ICP?', 'Modelo de Negócio', 'Modelo Operacional', 'Refinamento', 'Quadro de Audiência', 'Confirmação'];
    const totalSteps = titles.length;
    const productName = w.mode === 'existingProduct'
      ? (App.state.products.find(p => Number(p.id) === Number(w.productId))?.name || 'Produto')
      : (w.pendingDraft?.name || 'Novo produto');
    const prefix = w.mode === 'existingProduct' ? 'Editar audiência' : 'Definir audiência';
    const pct = Math.round(((step) / (totalSteps - 1)) * 100);
    return `<header class="text-white p-6 flex items-start justify-between gap-4" style="background: linear-gradient(135deg, var(--lj-revops) 0%, var(--lj-revops-deep) 100%);">
      <div class="min-w-0 flex-1">
        <p class="text-[10px] font-black uppercase tracking-widest" style="color: var(--lj-revops-soft);">
          ${prefix} · <span class="text-white/90">${Utils.escape(productName)}</span>
        </p>
        <h2 class="text-2xl font-black mt-1 truncate">${Utils.escape(titles[step])}</h2>
        <div class="flex items-center gap-3 mt-3">
          <div class="flex-1 h-1 rounded-full bg-white/15 overflow-hidden">
            <div class="h-full bg-white rounded-full transition-all duration-300" style="width: ${pct}%;"></div>
          </div>
          <span class="text-[11px] font-black text-white/90 lj-aud-num shrink-0">${step + 1} / ${totalSteps}</span>
        </div>
      </div>
      <button onclick="Actions.cancelAudienceWizard()" aria-label="Fechar (produto não será criado)" title="Fechar (produto não será criado)" class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white grid place-items-center shrink-0 transition">
        <i data-lucide="x" class="w-5 h-5"></i>
      </button>
    </header>`;
  },

  // V40.12.8 — Footer com botão Continuar em estado disabled limpo (sem
  // opacity bruta — vira slate-200/slate-400 com cursor-not-allowed e
  // pointer-events-none, mantendo o ritmo dos hovers do resto do app).
  _footer(w, step) {
    const canAdvance = (step === 0) ||
                       (step === 1 && !!w.modeloNegocio) ||
                       (step === 2 && !!w.modeloOperacional && !!w.salesChannel) ||
                       (step === 3) ||
                       (step === 4) ||
                       (step === 5);
    const isLast = step === 5;
    const isExisting = w.mode === 'existingProduct';
    const advanceLabel = isLast
      ? (isExisting ? 'Confirmar e salvar' : 'Confirmar e criar produto')
      : 'Continuar';
    const backLabel = step === 0 ? 'Cancelar' : 'Voltar';
    const backAction = step === 0 ? 'Actions.cancelAudienceWizard()' : 'Actions.audienceWizardBack()';
    const advanceAction = isLast ? 'Actions.audienceWizardFinish()' : 'Actions.audienceWizardNext()';
    const advanceCls = canAdvance
      ? 'text-white hover:brightness-110 cursor-pointer'
      : 'bg-slate-200 text-slate-400 cursor-not-allowed pointer-events-none';
    const advanceStyle = canAdvance ? `style="background: var(--lj-revops);"` : '';
    return `<footer class="bg-slate-50 border-t border-slate-200 p-5 flex items-center justify-between gap-3">
      <button onclick="${backAction}" class="px-5 py-3 rounded-full bg-white border border-slate-300 text-slate-700 font-black hover:bg-slate-100 transition">${backLabel}</button>
      <button onclick="${advanceAction}" ${advanceStyle} class="px-5 py-3 rounded-full font-black transition ${advanceCls}">${advanceLabel}</button>
    </footer>`;
  },

  // V40.12.5 — Step 6 (índice 5) — Conclusão "esfregando na cara".
  // Cliente vê em uma tela só TODAS as consequências da Audiência (Velocidade,
  // Score, Djow, RevOps, Mapa) antes de salvar. Lei "transparência ativa de
  // inferência" cravada por Felipe — cliente valida ANTES de o LJ agir.
  //
  // V40.12.8 — Paleta semântica oficial nos 5 cards de consequência. Card
  // preto final virou slate-900/95 com accent. 5o card (Mapa) ocupa linha
  // inteira (grid 2-col com lg:col-span-2 no último), evitando o "card
  // sozinho" assimétrico.
  _step5(w) {
    if (!window.AudienceFusionEngine || !window.AudienceConsequencesCatalog) {
      return `<div class="rounded-2xl bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 p-4 text-sm text-amber-900">Catálogo de consequências não carregado. Recarregue a página.</div>`;
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

    const negocio = (this.BUSINESS_MODELS.find(b => b.id === w.modeloNegocio) || {});
    const operacional = (this.OPERATIONAL_MODELS.find(o => o.id === w.modeloOperacional) || {});
    const salesCh = (this.SALES_CHANNELS.find(s => s.id === w.salesChannel) || {});
    const r = w.refinamento || {};
    const refLabel = (key) => {
      const opcoes = AudienceFusionEngine.refinamentoOpcoes(key);
      const m = opcoes.find(o => o.id === r[key]);
      return m ? m.label : null;
    };
    const refsLista = [
      r.ticket          ? `ticket ${refLabel('ticket')}` : null,
      r.ciclo           ? `ciclo ${refLabel('ciclo')}` : null,
      r.time_comercial  ? `time ${refLabel('time_comercial')}` : null,
      r.tracking_maduro ? `tracking ${refLabel('tracking_maduro')}` : null
    ].filter(Boolean).join(', ');

    const pct = Math.round(confidence * 100);
    const confColor = confidence >= 0.8 ? 'var(--lj-success)' : confidence >= 0.5 ? 'var(--lj-warning)' : 'var(--lj-danger)';
    const confLabel = confidence >= 0.8 ? 'alta' : confidence >= 0.5 ? 'média' : 'baixa';

    // V40.12.8 — Card de consequência usa CSS vars semânticas inline. Tone
    // hex passa como cor da borda/eyebrow/ícone; background é tint de 8%.
    const consequenciaCard = (icon, title, content, accentVar, span) => `
      <div class="${span || ''} rounded-2xl border border-slate-200 bg-white p-4 transition" style="border-left: 4px solid ${accentVar};">
        <div class="flex items-center gap-2 mb-2">
          <div class="w-8 h-8 rounded-xl grid place-items-center" style="background: color-mix(in srgb, ${accentVar} 14%, white);">
            <i data-lucide="${icon}" class="w-4 h-4" style="color: ${accentVar};"></i>
          </div>
          <p class="text-[11px] font-black uppercase tracking-widest" style="color: ${accentVar};">${title}</p>
        </div>
        <div class="text-[12px] text-slate-700 leading-relaxed space-y-1">${content}</div>
      </div>`;

    const vel = arch.velocidade || {};
    const score = arch.score || {};
    const djow = arch.djow || {};
    const revops = arch.revops || {};
    const mapa = arch.mapa || {};

    return `<div class="space-y-5">
      <!-- Espelho de escolhas -->
      <div class="rounded-2xl bg-white border border-slate-200 p-4" style="border-left: 4px solid var(--lj-revops);">
        <p class="text-[10px] font-black uppercase tracking-widest mb-2" style="color: var(--lj-revops);">O que você escolheu</p>
        <p class="text-sm text-slate-800 leading-relaxed">
          Esse produto é <b>${Utils.escape(negocio.label || '—')}</b> · <b>${Utils.escape(operacional.label || '—')}</b>${salesCh.label ? `, vendendo por <b>${Utils.escape(salesCh.label)}</b>` : ''}${refsLista ? `, com refinamento de <b>${Utils.escape(refsLista)}</b>` : ' <span class="text-slate-500">(refinamento não preenchido)</span>'}.
        </p>
      </div>

      <!-- Arquétipo + Confidence -->
      <div class="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 border border-slate-200 p-4" style="border-left: 4px solid var(--lj-revops-soft);">
        <div class="min-w-0">
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Arquétipo identificado</p>
          <p class="text-sm font-black text-slate-900 mt-0.5">${Utils.escape(arch.label || 'Não classificado')}</p>
          <p class="text-[11px] text-slate-600">${Utils.escape(arch.tagline || '')}</p>
        </div>
        <div class="text-right shrink-0">
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Confiança</p>
          <p class="text-2xl font-black lj-aud-num" style="color: ${confColor};">${pct}%</p>
          <p class="text-[10px] font-black uppercase" style="color: ${confColor};">${confLabel}</p>
        </div>
      </div>

      ${cls?.fallback ? `<div class="rounded-2xl bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 p-3 text-[11px] text-amber-900"><b>Combinação rara:</b> nenhum arquétipo bateu 100%. LJ vai usar defaults genéricos. Você pode seguir mesmo assim — Sprint 4 vai permitir Master cravar arquétipos customizados.</div>` : ''}

      <!-- O que o LJ vai assumir em cada módulo -->
      <div>
        <p class="text-[11px] font-black text-slate-700 uppercase tracking-widest mb-2">O que o LJ vai assumir em cada módulo</p>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
          ${consequenciaCard('zap', 'Card de Velocidade', `
            <p>• <b>V · ${Utils.escape(vel.v_label || '—')}</b></p>
            <p>• <b>C · ${Utils.escape(vel.c_label || '—')}</b></p>
            <p>• <b>L · ${Utils.escape(vel.l_label || '—')}</b></p>
            <p>• <b>T · ${Utils.escape(vel.t_label || '—')}</b></p>
            <p class="text-slate-500 mt-1.5 text-[11px]">Fonte: ${Utils.escape(vel.v_source || '—')}</p>
          `, 'var(--lj-sales)')}

          ${consequenciaCard('target', 'Score Engine', `
            ${score.weights ? Object.entries(score.weights).map(([k,v]) => `<p>• <b>${Utils.escape(k.replace(/_/g, ' '))}:</b> ${Math.round(v*100)}%</p>`).join('') : '<p>—</p>'}
            <p class="text-slate-500 mt-1.5 text-[11px]">Threshold de cliente saudável: ${score.threshold || '—'}</p>
          `, 'var(--lj-marketing)')}

          ${consequenciaCard('message-circle', 'Djow Lateral', `
            <p><b>Tom:</b> ${Utils.escape(djow.tone || '—')}</p>
            <p class="mt-1"><b>Foco:</b> ${Utils.escape(djow.focus || '—')}</p>
          `, 'var(--lj-revops)')}

          ${consequenciaCard('trending-up', 'RevOps & Cascata', `
            <p><b>Payback saudável:</b> ${Utils.escape(revops.payback_saudavel || '—')}</p>
            ${revops.roas_min ? `<p><b>ROAS mínimo:</b> ${revops.roas_min}×</p>` : ''}
            <p class="mt-1"><b>Foco:</b> ${Utils.escape(revops.foco || '—')}</p>
          `, 'var(--lj-revenue)')}

          ${consequenciaCard('map', 'Mapa da Receita', `
            <p><b>KR-mãe sugerido:</b> ${Utils.escape(mapa.kr_mae_sugerido || '—')}</p>
            ${mapa.krs_secundarios?.length ? `<p class="mt-1"><b>Secundários:</b> ${mapa.krs_secundarios.map(k => Utils.escape(k)).join(', ')}</p>` : ''}
          `, 'var(--lj-cs)', 'lg:col-span-2')}
        </div>
      </div>

      <!-- Validação final — slate-900/95 com accent RevOps pra encerrar -->
      <div class="rounded-2xl text-white p-4" style="background: rgba(15, 23, 42, 0.96); border-left: 4px solid var(--lj-revops-soft); box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);">
        <p class="text-sm font-black mb-1">Isso faz sentido pro seu negócio?</p>
        <p class="text-[12px] text-slate-300">Se clicar Confirmar, o LJ vai aplicar essas premissas em todos os módulos. Se algo soou estranho, volta e ajusta — ou pede pro Djow refletir.</p>
      </div>
    </div>`;
  },

  _step0() {
    // V40.12.8 — Cards C/B/A com peso visual decrescente (Fibonacci nos
    // paddings + tamanho da tag), sugerindo afunilamento C → B → A.
    return `<div class="space-y-5">
      <div class="rounded-2xl bg-white border border-slate-200 p-5" style="border-left: 4px solid var(--lj-revops);">
        <p class="text-[10px] font-black uppercase tracking-widest mb-2" style="color: var(--lj-revops);">Mini aula</p>
        <p class="text-sm text-slate-700 leading-relaxed">Definir bem a <b>audiência</b> de um produto é o que separa marketing que gera atenção de marketing que <b>fecha venda</b>. O LJ trabalha com 3 camadas que se acumulam: cada uma é um filtro mais fino sobre a anterior.</p>
      </div>
      <div class="grid md:grid-cols-3 gap-3">
        ${this._layerCard(0, 'C', 'Público-Alvo', 'Quem TEM CHANCE de virar lead. Firmografia e demografia bruta: setor, porte, geografia, faixa de renda.', 'var(--lj-revops)')}
        ${this._layerCard(1, 'B', 'ICP', 'Quem é VIÁVEL de fechar. PA + sinais comportamentais e contextuais: uso de categoria, momento de compra, orçamento.', 'var(--lj-marketing)')}
        ${this._layerCard(2, 'A', 'Buyer Persona', 'COMO falar com quem decide. ICP + pessoa: cargo decisor, dor declarada, prioridades, processo de decisão.', 'var(--lj-revenue)')}
      </div>
      <p class="text-xs text-slate-500 leading-relaxed">Esse wizard vai te guiar a definir os 3. Depois, o LJ usa essas definições pra classificar automaticamente cada lead que entra na campanha desse produto.</p>
    </div>`;
  },

  _layerCard(idx, tag, title, body, accentVar) {
    // V40.12.8 — paddings decrescentes (5/4/3) e tag-size decrescente (8/7/6).
    const paddings = ['p-5', 'p-4', 'p-3'];
    const tagSizes = ['w-8 h-8 text-sm', 'w-7 h-7 text-xs', 'w-6 h-6 text-[11px]'];
    return `<div class="rounded-2xl bg-white border border-slate-200 ${paddings[idx]}" style="border-left: 4px solid ${accentVar};">
      <div class="flex items-center gap-2 mb-2">
        <span class="${tagSizes[idx]} rounded-lg grid place-items-center font-black" style="background: color-mix(in srgb, ${accentVar} 14%, white); color: ${accentVar};">${tag}</span>
        <p class="font-black text-slate-900">${title}</p>
      </div>
      <p class="text-xs text-slate-600 leading-relaxed">${body}</p>
    </div>`;
  },

  // V40.12.8 — Step 1 em grid 2×2 (4 modelos de negócio mutuamente exclusivos).
  _step1(w) {
    return `<div class="space-y-3">
      <p class="text-sm text-slate-600 mb-4">Como esse produto chega no comprador?</p>
      <div class="grid md:grid-cols-2 gap-3">
        ${this.BUSINESS_MODELS.map(m => this._choiceCard('modeloNegocio', m, w.modeloNegocio === m.id, this.ACCENTS.negocio)).join('')}
      </div>
    </div>`;
  },

  // V40.12.8 — Step 2 com modelo operacional em grid 2-col (9 modelos —
  // scroll cai pela metade) e canal de venda em grid 3-col (3 modelos
  // lado a lado). Ambas as seções com sub-frase explicativa pra ritmo
  // consistente.
  _step2(w) {
    return `<div class="space-y-6">
      <div class="space-y-3">
        <div>
          <p class="text-sm text-slate-600 font-black">Qual o modelo operacional e de receita?</p>
          <p class="text-[11px] text-slate-500 mt-0.5">Define como esse produto faz dinheiro — assinatura, venda única, comissão, ticket por pedido.</p>
        </div>
        <div class="grid md:grid-cols-2 gap-3">
          ${this.OPERATIONAL_MODELS.map(m => this._choiceCard('modeloOperacional', m, w.modeloOperacional === m.id, this.ACCENTS.operacional)).join('')}
        </div>
      </div>
      <div class="pt-5 border-t border-slate-200 space-y-3">
        <div>
          <p class="text-sm text-slate-600 font-black">Como esse produto vende?</p>
          <p class="text-[11px] text-slate-500 mt-0.5">Define a fonte do Forecast × Realizado em Resultados e o ponto crítico que o tenant monitora.</p>
        </div>
        <div class="grid md:grid-cols-3 gap-3">
          ${this.SALES_CHANNELS.map(m => this._choiceCard('salesChannel', m, w.salesChannel === m.id, this.ACCENTS.canal)).join('')}
        </div>
      </div>
    </div>`;
  },

  // V40.12.5 — Refinamento ganhou passo próprio. Opcional — cliente pode
  // só clicar Continuar e seguir. Quando preenchido, alimenta consumidores
  // (Velocidade muda V/C/L/T, Djow ajusta tom, RevOps muda ranges).
  _step3(w) {
    return `<div class="space-y-5">
      <div class="rounded-2xl bg-white border border-slate-200 p-4" style="border-left: 4px solid var(--lj-cs);">
        <p class="text-[10px] font-black uppercase tracking-widest mb-1" style="color: var(--lj-cs);">Opcional</p>
        <p class="text-sm text-slate-700 leading-relaxed">4 escolhas que ajudam o LJ a <b>triangular melhor</b> a partir do modelo que você escolheu. Cada combinação muda como o card de Velocidade fala com você, como o Djow sugere ações e quais ranges o RevOps usa.</p>
        <p class="text-[11px] text-slate-500 mt-1.5">Pode preencher agora ou clicar <b>Continuar</b> e voltar depois.</p>
      </div>
      ${this._refinamentoCards(w)}
    </div>`;
  },

  // V40.12.8 — Tagline em medium/slate-500 (caía de tom contra label em
  // black/slate-900). Badge "opcional" removida (já tem aviso global no
  // topo do step); só mostra ✓ verde quando preenchido. Side-accent CS.
  _refinamentoCards(w) {
    if (!window.AudienceFusionEngine) return '';
    const refinamento = w.refinamento || {};
    const groups = ['ticket', 'ciclo', 'time_comercial', 'tracking_maduro'];
    return `<div class="space-y-3">${groups.map(key => {
      const meta = AudienceFusionEngine.refinamentoMeta(key);
      const opcoes = AudienceFusionEngine.refinamentoOpcoes(key);
      if (!meta || !opcoes.length) return '';
      const selected = refinamento[key] || null;
      return `<div class="rounded-2xl border border-slate-200 bg-white p-4" style="border-left: 4px solid var(--lj-cs);">
        <div class="flex items-baseline justify-between mb-2">
          <div>
            <p class="text-[11px] font-black uppercase tracking-widest" style="color: var(--lj-cs);">${Utils.escape(meta.label)}</p>
            <p class="text-[11px] font-medium text-slate-500 mt-0.5">${Utils.escape(meta.tagline || '')}</p>
          </div>
          ${selected ? '<span class="text-[10px] font-black text-emerald-700 inline-flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i>preenchido</span>' : ''}
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          ${opcoes.map(op => {
            const isSelected = selected === op.id;
            const selectedStyle = isSelected ? `style="border-color: var(--lj-cs); background: color-mix(in srgb, var(--lj-cs) 8%, white);"` : '';
            return `<button onclick="Actions.audienceWizardRefinamento('${key}', '${op.id}')" ${selectedStyle} class="text-left rounded-xl border-2 ${isSelected ? '' : 'border-slate-200 bg-white hover:bg-slate-50'} p-2.5 transition">
              <div class="flex items-baseline gap-1.5 mb-0.5">
                <p class="text-[12px] font-black text-slate-900">${Utils.escape(op.label)}</p>
                <span class="text-[11px] font-medium text-slate-500">${Utils.escape(op.tagline || '')}</span>
              </div>
              <p class="text-[11px] text-slate-600 leading-snug">${Utils.escape(op.description || '')}</p>
            </button>`;
          }).join('')}
        </div>
      </div>`;
    }).join('')}</div>`;
  },

  // V40.12.8 — Side-accent law universal nos cards de escolha. Cor passa
  // do field (ACCENTS.negocio/operacional/canal). Selected ganha border
  // intensa + tint suave de 8%; idle ganha apenas a faixa lateral.
  _choiceCard(field, m, selected, accentVar) {
    const selectedStyle = selected
      ? `style="border-color: ${accentVar}; background: color-mix(in srgb, ${accentVar} 8%, white); border-left: 4px solid ${accentVar};"`
      : `style="border-left: 4px solid color-mix(in srgb, ${accentVar} 35%, white);"`;
    const tagStyle = selected
      ? `style="background: ${accentVar}; color: white;"`
      : `style="background: color-mix(in srgb, ${accentVar} 14%, white); color: ${accentVar};"`;
    return `<button onclick="Actions.audienceWizardChoose('${field}', '${m.id}')" ${selectedStyle} class="w-full text-left rounded-2xl border-2 ${selected ? '' : 'border-slate-200 bg-white hover:bg-slate-50'} p-4 transition">
      <div class="flex items-start gap-3">
        <div ${tagStyle} class="w-9 h-9 rounded-xl grid place-items-center font-black text-sm shrink-0">${m.label[0]}</div>
        <div class="min-w-0">
          <div class="flex items-center gap-2 mb-0.5 flex-wrap">
            <p class="font-black text-slate-900">${m.label}</p>
            <span class="text-[11px] font-medium text-slate-500">${m.tagline}</span>
          </div>
          <p class="text-xs text-slate-600 leading-relaxed">${m.body}</p>
        </div>
      </div>
    </button>`;
  },

  // V40.12.5 — Step 5 (índice 4) — Quadro de Audiência (PA/ICP/BP).
  // V40.12.8 — Header de combinação em prosa (em vez de chips empilhados).
  // Tags FIT/DADO/OPC viram pontinhos com tooltip (10px legível). Gap maior
  // entre colunas em mobile pra hierarquia respirar.
  _step4(w) {
    if (!window.AudienceFusionEngine) {
      return `<div class="rounded-2xl bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 p-4 text-sm text-amber-900">Motor de fusão de audiência não carregado. Recarregue a página.</div>`;
    }
    const fused = AudienceFusionEngine.fuse(w.modeloNegocio, w.modeloOperacional, w.refinamento || null);
    if (!fused.ok) {
      return `<div class="rounded-2xl bg-rose-50 border border-rose-200 border-l-4 border-l-rose-500 p-4 text-sm text-rose-900">${Utils.escape(fused.error || 'Erro ao montar quadro.')}</div>`;
    }

    const notasAll = fused.notas || [];
    const notasIncompat = notasAll.filter(n => n.origem === 'incompatibilidade');
    const notasInfo = notasAll.filter(n => n.origem !== 'incompatibilidade');
    const renderNota = (n) => {
      const accentByOrigin = {
        negocio: 'var(--lj-revops)',
        operacional: 'var(--lj-sales)',
        marketplace: 'var(--lj-cs)',
        incompatibilidade: 'var(--lj-warning)'
      };
      const accent = accentByOrigin[n.origem] || '#94A3B8';
      const iconByOrigin = { negocio: 'briefcase', operacional: 'package', marketplace: 'split', incompatibilidade: 'alert-triangle' };
      const icon = iconByOrigin[n.origem] || 'info';
      return `<div class="rounded-xl bg-white border border-slate-200 px-3 py-2 flex items-start gap-2" style="border-left: 4px solid ${accent};">
        <i data-lucide="${icon}" class="w-3.5 h-3.5 mt-0.5 shrink-0" style="color: ${accent};"></i>
        <p class="text-xs text-slate-800 leading-relaxed">${Utils.escape(n.texto)}</p>
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

    const custom = w.customFields || { pa: [], icp: [], bp: [] };
    const paAll  = [...fused.pa,  ...(custom.pa  || [])];
    const icpAll = [...fused.icp, ...(custom.icp || [])];
    const bpAll  = [...fused.bp,  ...(custom.bp  || [])];
    const reqPa  = paAll.filter(f => !f.optional).length;
    const reqIcp = icpAll.filter(f => !f.optional).length;
    const reqBp  = bpAll.filter(f => !f.optional).length;

    // V40.12.8 — header de combinação em prosa fluida.
    const negocioLabel = Utils.escape(fused.negocioLabel);
    const operacionalLabel = Utils.escape(fused.operacionalLabel);
    const unidade = Utils.escape(fused.unidade);
    return `<div class="space-y-4">
      <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700" style="border-left: 4px solid var(--lj-revops-soft);">
        <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">Combinação </span>
        <b style="color: var(--lj-revops);">${negocioLabel}</b> × <b style="color: var(--lj-sales);">${operacionalLabel}</b>
        <span class="text-slate-400">·</span>
        <span class="text-[12px] text-slate-600">unidade base: <b>${unidade}</b></span>
      </div>

      ${notasIncompatHtml ? `<div class="space-y-1.5">${notasIncompatHtml}</div>` : ''}
      ${notasAccordion}

      <div class="grid md:grid-cols-3 gap-4">
        ${this._layerColumn(0, 'C', 'Público-Alvo',  paAll,  reqPa,  'var(--lj-revops)',   'pa')}
        ${this._layerColumn(1, 'B', 'ICP',           icpAll, reqIcp, 'var(--lj-marketing)', 'icp')}
        ${this._layerColumn(2, 'A', 'Buyer Persona', bpAll,  reqBp,  'var(--lj-revenue)',   'bp')}
      </div>

      ${this._djowBlock(w, fused)}
    </div>`;
  },

  // V38.1.40 — Bloco do Djow. 3 estados: convite / loading / resposta.
  // V40.12.8 — Side-accent RevOps, rounded-full no botão CTA.
  _djowBlock(w, fused) {
    if (w.djowLoading) {
      return `<div class="rounded-2xl bg-white border border-slate-200 px-4 py-3 flex items-center gap-3" style="border-left: 4px solid var(--lj-revops);">
        <div class="w-5 h-5 rounded-full border-2 border-slate-200 animate-spin shrink-0" style="border-top-color: var(--lj-revops);"></div>
        <p class="text-xs text-slate-700 leading-relaxed"><b>Djow está analisando…</b> Cruzando os modelos escolhidos, sua amostra de leads e a base de conhecimento de audiência. Demora alguns segundos.</p>
      </div>`;
    }
    if (w.djowError) {
      return `<div class="rounded-2xl bg-rose-50 border border-rose-200 px-4 py-3 flex items-start gap-2" style="border-left: 4px solid var(--lj-danger);">
        <i data-lucide="alert-octagon" class="w-4 h-4 text-rose-700 mt-0.5 shrink-0"></i>
        <div class="flex-1 text-xs text-rose-900 leading-relaxed">
          <p><b>Djow não respondeu:</b> ${Utils.escape(w.djowError)}</p>
          <button onclick="Actions.djowAnalyzeAudience()" class="mt-2 px-3 py-1.5 rounded-full bg-rose-700 text-white text-[11px] font-black hover:bg-rose-800">Tentar de novo</button>
        </div>
      </div>`;
    }
    if (w.djowAnalise) {
      const paragrafos = String(w.djowAnalise).split(/\n\s*\n/).filter(p => p.trim().length);
      const html = paragrafos.map(p => `<p>${Utils.escape(p).replace(/\n/g, '<br>')}</p>`).join('');
      return `<div class="rounded-2xl bg-white border border-slate-200 p-4" style="border-left: 4px solid var(--lj-revops); background: linear-gradient(135deg, color-mix(in srgb, var(--lj-revops) 5%, white), color-mix(in srgb, var(--lj-marketing) 4%, white));">
        <div class="flex items-center gap-2 mb-2">
          <i data-lucide="sparkles" class="w-4 h-4" style="color: var(--lj-revops);"></i>
          <p class="text-[10px] font-black uppercase tracking-widest" style="color: var(--lj-revops);">Análise do Djow</p>
          <button onclick="Actions.djowAnalyzeAudience()" title="Pedir nova análise" class="ml-auto text-[10px] font-black hover:opacity-70 flex items-center gap-1 transition" style="color: var(--lj-revops);"><i data-lucide="refresh-cw" class="w-3 h-3"></i> Pedir novamente</button>
        </div>
        <div class="text-xs text-slate-800 leading-relaxed space-y-2">${html}</div>
      </div>`;
    }
    return `<div class="rounded-2xl bg-white border border-slate-200 p-4 flex items-start gap-3" style="border-left: 4px solid var(--lj-revops);">
      <i data-lucide="sparkles" class="w-5 h-5 shrink-0 mt-0.5" style="color: var(--lj-revops);"></i>
      <div class="flex-1 min-w-0">
        <p class="text-xs text-slate-800 leading-relaxed"><b>Djow montou o esqueleto.</b> ${fused.requiredCounts.pa} campos obrigatórios no PA, ${fused.requiredCounts.icp} no ICP, ${fused.requiredCounts.bp} no BP. Threshold 80% por camada.</p>
        <p class="text-xs leading-relaxed mt-1" style="color: var(--lj-revops);">Quer que o Djow comente esse quadro lendo seus leads do RD e a base de conhecimento de audiência?</p>
        <button onclick="Actions.djowAnalyzeAudience()" class="mt-2.5 px-3 py-1.5 rounded-full text-white text-[11px] font-black hover:brightness-110 transition flex items-center gap-1.5" style="background: var(--lj-revops);"><i data-lucide="sparkles" class="w-3.5 h-3.5"></i> Pedir análise do Djow</button>
      </div>
    </div>`;
  },

  // V40.12.8 — Layer column com paddings/intensidades decrescentes
  // (C → B → A) pra reforçar o afunilamento visual. Tags FIT/DADO/OPC
  // viraram pontinhos coloridos com tooltip (10px legível).
  _layerColumn(idx, tag, title, fields, requiredCount, accentVar, layerKey) {
    const paddings = ['p-4', 'p-3.5', 'p-3'];
    const tagSizes = ['w-6 h-6 text-xs', 'w-5 h-5 text-[10px]', 'w-5 h-5 text-[10px]'];
    const items = (fields || []).map(f => {
      const fitDot = f.type === 'fit'
        ? `<span class="w-1.5 h-1.5 rounded-full shrink-0" title="FIT — sinal de aderência ao ICP" style="background: var(--lj-success);"></span>`
        : `<span class="w-1.5 h-1.5 rounded-full shrink-0" title="DADO — campo de firmografia/contexto" style="background: #94A3B8;"></span>`;
      const optionalBadge = f.optional
        ? `<span class="text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0" title="Opcional" style="background: color-mix(in srgb, var(--lj-warning) 18%, white); color: var(--lj-warning);">opc</span>`
        : '';
      const customBadge = f.custom
        ? `<button onclick="event.stopPropagation(); Actions.removeCustomAudienceField('${layerKey}', '${Utils.escape(f.key)}')" title="Remover campo custom" class="text-[10px] font-black px-1 py-0.5 rounded-full shrink-0 hover:bg-rose-100 transition" style="color: var(--lj-danger);">×</button>`
        : '';
      const tooltip = (f.tooltip || '') + (f.criterio ? ' Critério: ' + f.criterio : '') + (f.inferenciaRd ? ' Origem: ' + f.inferenciaRd : '');
      const customStyle = f.custom
        ? `style="border-left: 2px solid ${accentVar}; background: color-mix(in srgb, ${accentVar} 5%, white);"`
        : '';
      return `<div title="${Utils.escape(tooltip)}" ${customStyle} class="rounded-xl border ${f.custom ? '' : 'border-slate-200 bg-white'} px-2.5 py-2 flex items-center gap-2">
        ${fitDot}
        <span class="text-[11px] font-bold text-slate-700 truncate flex-1">${Utils.escape(f.label || f.key)}</span>
        ${optionalBadge}
        ${customBadge}
      </div>`;
    }).join('');
    const addBtn = layerKey
      ? `<button onclick="Actions.addCustomAudienceField('${layerKey}')" class="mt-1.5 w-full px-2 py-1.5 rounded-xl border-2 border-dashed text-[10px] font-black uppercase tracking-wider hover:brightness-110 transition flex items-center justify-center gap-1" style="border-color: color-mix(in srgb, ${accentVar} 40%, white); color: ${accentVar};"><i data-lucide="plus" class="w-3 h-3"></i> Campo custom</button>`
      : '';
    return `<div class="rounded-2xl bg-white border border-slate-200 ${paddings[idx]}" style="border-left: 4px solid ${accentVar};">
      <div class="flex items-center gap-1.5 mb-2">
        <span class="${tagSizes[idx]} rounded-lg grid place-items-center font-black" style="background: color-mix(in srgb, ${accentVar} 14%, white); color: ${accentVar};">${tag}</span>
        <p class="text-[11px] font-black uppercase tracking-widest" style="color: ${accentVar};">${title}</p>
        <span class="ml-auto text-[10px] font-black lj-aud-num" style="color: ${accentVar};">${requiredCount} obrig.</span>
      </div>
      <div class="space-y-1.5">${items || `<p class="text-[10px] text-slate-400 italic">Sem campos.</p>`}</div>
      ${addBtn}
    </div>`;
  }
};

window.ProductAudienceModal = ProductAudienceModal;
