// V17.1 — Strategic Map Modal (jornada guiada de 5 etapas)
// Cada etapa tem critério de conclusão, CTA "Próximo passo →" e Djow lateral.
// A etapa Executar fecha o ciclo: a partir de um OKR, abre o DjowModal V16.3
// pré-preenchido para criar tarefa no provider operacional ativo (ClickUp/Trello/etc).
window.StrategicMapModal = {
  render() {
    if (!App.state.showStrategicMap) return '';
    const productId = App.state.strategicMapProductId;
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    if (!product) return '';
    const showOnboarding = !StrategicOnboarding.hasSeen(productId);
    return `<div class="fixed inset-0 z-[80] bg-slate-950/85 backdrop-blur-sm p-4 overflow-auto grid place-items-start justify-items-center">
      <div class="rounded-[2rem] overflow-hidden shadow-2xl text-white" style="width:92vw;max-width:1400px;background: radial-gradient(circle at 18% 8%, rgba(99,102,241,.25), transparent 32%), radial-gradient(circle at 82% 0%, rgba(34,197,94,.15), transparent 32%), #071326;">
        ${this._header(product)}
        ${showOnboarding ? this._onboarding(product) : this._body(product)}
      </div>
      ${window.QuickActionModal ? QuickActionModal.render() : ''}
      ${window.StrategicOverviewModal ? StrategicOverviewModal.render() : ''}
    </div>`;
  },

  _header(product) {
    const snap = StrategicMapEngine.snapshot(product.id);
    return `<header class="p-5 border-b border-white/10 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1"><i data-lucide="compass" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-slate-300 uppercase tracking-wider">Revenue Strategic Map</p></div>
        <h2 class="text-2xl font-black">Mapa da Receita — ${Utils.escape(product.name)}</h2>
        <p class="text-xs text-slate-300 mt-1">${snap.objectivesCount} frente(s) · ${snap.okrsCount} número(s) · ${snap.connectedFlows} fluxo(s) · progresso médio ${snap.avgProgress}%</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <button onclick="Actions.openStrategicOverview()" title="Ver árvore Visão → Objetivos → OKRs" class="px-3 py-2.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/40 text-indigo-100 text-xs font-black flex items-center gap-1"><i data-lucide="layout-grid" class="w-3.5 h-3.5"></i> Visão geral</button>
        <button onclick="Actions.openStrategicOnboarding()" title="Reabrir onboarding" class="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-black flex items-center gap-1"><i data-lucide="help-circle" class="w-3.5 h-3.5"></i> Ajuda</button>
        <button onclick="Actions.syncStrategicOkrsFromOps()" title="Atualizar OKRs com leitura operacional" class="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-black flex items-center gap-1"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Sync geral</button>
        <button onclick="Actions.closeStrategicMap()" class="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-semibold flex items-center gap-2"><i data-lucide="x" class="w-4 h-4"></i> Fechar</button>
      </div>
    </header>`;
  },

  _onboarding(product) {
    return `<div class="p-6 lg:p-8 space-y-6">
      <div class="rounded-3xl bg-white/[0.05] border border-white/10 p-6">
        <div class="flex items-center gap-2 mb-3"><i data-lucide="sparkles" class="w-5 h-5 text-indigo-300"></i><p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Bem-vindo ao Mapa da Receita</p></div>
        <h3 class="text-3xl font-black mb-2">Da estratégia até o card no ClickUp.</h3>
        <p class="text-slate-300 max-w-3xl">5 etapas guiadas conectam visão, OKRs, ações e execução real. Em cada etapa, o Djow ajuda. No final, suas decisões viram tarefas no provider operacional configurado (ClickUp, Trello, Monday, Jira, Notion ou Manual).</p>
      </div>

      <div class="grid lg:grid-cols-5 gap-3">
        ${StrategicZoomNavigation.LEVELS.map((l, i) => `<div class="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
          <div class="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-200 font-black grid place-items-center mb-2 text-sm">${i + 1}</div>
          <div class="flex items-center gap-1.5 mb-1"><i data-lucide="${l.icon}" class="w-3.5 h-3.5 text-indigo-300"></i><p class="font-black text-white text-sm">${Utils.escape(l.label)}</p></div>
          <p class="text-[11px] text-slate-400">${Utils.escape(l.description)}</p>
        </div>`).join('')}
      </div>

      <div class="rounded-3xl bg-gradient-to-br from-indigo-500/15 to-emerald-500/10 border border-white/10 p-6">
        <p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider mb-3">O ciclo completo</p>
        ${StrategicMapRenderer.flowDiagramHtml()}
        <p class="text-xs text-slate-300 mt-4">Vision → Objective → OKR → Action → Task no ClickUp. Tudo conectado, com o Djow como copiloto.</p>
      </div>

      <div class="flex flex-col sm:flex-row gap-3 justify-end">
        <button onclick="Actions.closeStrategicMap()" class="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-black">Voltar depois</button>
        <button onclick="Actions.dismissStrategicOnboarding()" style="color:#fff!important;" class="px-5 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-black flex items-center gap-2"><i data-lucide="arrow-right" class="w-4 h-4"></i> Começar pela Visão</button>
      </div>
    </div>`;
  },

  _body(product) {
    const stepId = StrategicZoomNavigation.current();
    return `<div class="p-5 space-y-4">
      ${this._stepper(product)}
      <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <div class="space-y-4 min-w-0">
          ${this._stepContent(product, stepId)}
        </div>
        ${this._djowSide(product, stepId)}
      </div>
    </div>`;
  },

  _stepper(product) {
    const progress = StrategicMapEngine.journeyProgress(product.id);
    const current = StrategicZoomNavigation.current();
    return `<div class="rounded-3xl bg-white/[0.04] border border-white/10 p-3">
      <div class="grid grid-cols-2 md:grid-cols-5 gap-2">
        ${StrategicZoomNavigation.LEVELS.map((level, i) => {
          const done = progress[level.id];
          const active = current === level.id;
          const tone = active ? 'bg-indigo-500/25 border-indigo-400/50' : (done ? 'bg-emerald-500/15 border-emerald-400/30' : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.06]');
          const numTone = active ? 'bg-indigo-500 text-white' : (done ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-300');
          return `<button onclick="Actions.setStrategicZoom('${level.id}')" class="text-left p-3 rounded-2xl border ${tone} transition flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-xl ${numTone} grid place-items-center font-black text-xs shrink-0">${done ? '✓' : (i + 1)}</div>
            <div class="min-w-0">
              <p class="text-[11px] font-black text-white truncate">${Utils.escape(level.short)}</p>
              <p class="text-[10px] text-slate-400 truncate">${done ? 'Concluído' : active ? 'Em foco' : 'Pendente'}</p>
            </div>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  },

  _stepContent(product, stepId) {
    if (stepId === 'vision')     return this._stepVision(product);
    if (stepId === 'objectives') return this._stepObjectives(product);
    if (stepId === 'okrs')       return this._stepOkrs(product);
    if (stepId === 'operations') return this._stepOperations(product);
    if (stepId === 'execution')  return this._stepExecution(product);
    return this._stepVision(product);
  },

  _stepCta(label, enabled) {
    const cls = enabled
      ? 'bg-indigo-500 hover:bg-indigo-600 text-white cursor-pointer'
      : 'bg-white/5 text-slate-500 cursor-not-allowed';
    return `<div class="flex justify-end pt-2">
      <button ${enabled ? '' : 'disabled'} onclick="Actions.advanceStrategicStep()" class="px-5 py-3 rounded-2xl ${cls} font-black flex items-center gap-2" ${enabled ? 'style="color:#fff!important;"' : ''}>${Utils.escape(label)} <i data-lucide="arrow-right" class="w-4 h-4"></i></button>
    </div>`;
  },

  // -------------------- STEP 1: OBJETIVO DO PRODUTO --------------------
  // V28.1.0 — Vocabulário RevOps: foco é "produto" + ambição. Pergunta humana
  // + exemplos de produto + textarea com helper.
  _stepVision(product) {
    const map = StrategicMapEngine.getForProduct(product.id);
    const hasVision = Boolean(String(map.vision || '').trim());

    const exampleCacau = 'Ser o chocolate em barra preferido das famílias brasileiras até 2027.';
    const otherExamples = [
      'Ser o app que toda dona de pet abre antes de comprar ração',
      'Virar o café da manhã favorito de quem trabalha em escritório',
      'Ser o produto de credito que toda pequena empresa do bairro confia',
      'Ser a primeira opção de doce em casamento no Sul do país'
    ];

    return `<section class="space-y-4">
      ${this._stepIntro(
        'Qual é o objetivo comercial de seu produto nos próximos 12 meses?',
        'Uma frase só, ambiciosa, conectada ao que esse produto entrega.',
        'star',
        'vision',
        'vision-objetivo-comercial',
        'É a missão que a empresa dá para aquele produto específico para ajudar a ganhar dinheiro.'
      )}

      ${!hasVision ? `
        <div class="rounded-3xl bg-violet-500/10 border border-violet-400/30 p-5">
          <div class="flex items-center gap-2 mb-3">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-500/30 text-violet-100">Exemplo de produto</span>
            <span class="text-[11px] text-slate-400">Pra inspirar — pode adaptar pro seu</span>
          </div>
          <p class="text-base text-white font-semibold leading-relaxed italic mb-3">"${Utils.escape(exampleCacau)}"</p>
          <button onclick="Actions.updateStrategicVision(${JSON.stringify(exampleCacau).replace(/"/g, '&quot;')}); App.render();" class="px-3 py-1.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-xs font-black" style="color:#fff!important;">Usar como ponto de partida →</button>

          <div class="mt-4 pt-3 border-t border-white/10">
            <p class="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Outros exemplos pra te inspirar:</p>
            <ul class="space-y-1">
              ${otherExamples.map(e => `<li class="text-[12px] text-slate-300">• ${Utils.escape(e)}</li>`).join('')}
            </ul>
          </div>
        </div>

        <div class="text-center text-[11px] text-slate-500 font-bold">────────── ou escreva o seu ──────────</div>
      ` : ''}

      <div class="rounded-3xl bg-white/[0.05] border border-white/10 p-5">
        <label class="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Objetivo do produto em uma frase</label>
        <textarea oninput="Actions.updateStrategicVision(this.value)" placeholder="Tornar [esse produto] o(a) [posição] pra [público] até [horizonte]" class="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-white/15 text-white text-sm font-semibold min-h-[100px] placeholder:text-slate-500" style="color-scheme:dark;">${Utils.escape(map.vision || '')}</textarea>
        <p class="text-[11px] text-slate-400 mt-2">💡 Conecta o produto a quem ele serve. Esse objetivo norteia tudo: Marketing, Vendas e Sucesso do Cliente.</p>
      </div>

      ${this._stepCta('Próximo passo: definir o Comercial', hasVision)}
    </section>`;
  },

  // -------------------- STEP 2: COMERCIAL --------------------
  // V28.1.0 — 3 cards fixos Marketing / Vendas / Sucesso do Cliente.
  // Sem wizard livre; cada card é um layer do funil com descrição minimalista
  // (RevOps) e edição inline de dono/prazo. Os números (KRs) entram na etapa 3.
  _stepObjectives(product) {
    const map = StrategicMapEngine.getForProduct(product.id);
    const objectives = map.objectives || [];
    const visionShort = (map.vision || '').length > 80 ? (map.vision || '').slice(0, 80) + '…' : (map.vision || '');
    const areasReady = (StrategicMapEngine.COMERCIAL_AREAS || []).every(a => objectives.some(o => o.area === a.id));

    return `<section class="space-y-4">
      ${this._stepIntro(
        'Como o Comercial se organiza pra realizar esse objetivo?',
        'Marketing, Vendas e Sucesso do Cliente. Defina o dono e o prazo de cada frente.',
        'flag',
        'objectives',
        'objectives-area-comercial',
        'Área Comercial é a área de contato com o cliente: gera o desejo, vende e cuida da entrega do produto prometido. Dentro dela existem 3 segmentos: Marketing (quem gera desejo), Vendas (quem fecha negócio) e Sucesso do Cliente (quem garante a entrega e fala tão bem com o cliente que ele pensa em comprar mais).'
      )}

      ${visionShort ? `<div class="rounded-xl bg-violet-500/10 border border-violet-400/20 px-3 py-2 text-[11px] text-slate-300">⭐ <b class="text-violet-200">Objetivo comercial do produto:</b> «${Utils.escape(visionShort)}»</div>` : ''}

      <div class="rounded-2xl bg-indigo-500/10 border border-indigo-400/25 p-3 text-[12px] text-indigo-100 leading-relaxed">
        <b class="text-indigo-200">Área Comercial no LeadJourney:</b> é onde a empresa toca o cliente — gera o desejo, vende e cuida da entrega do que foi prometido. Funciona como um funil de 3 segmentos:
        <span class="block mt-1.5">• <b class="text-sky-200">Marketing</b> gera desejo no público (transforma suspeito em lead).</span>
        <span class="block">• <b class="text-emerald-200">Vendas</b> fecha negócio (transforma lead em cliente).</span>
        <span class="block">• <b class="text-violet-200">Sucesso do Cliente</b> entrega o que foi prometido tão bem que o cliente quer comprar mais.</span>
      </div>

      <div class="grid lg:grid-cols-3 gap-3">
        ${(StrategicMapEngine.COMERCIAL_AREAS || []).map(area => this._comercialAreaCard(area, StrategicMapEngine.getObjectiveByArea(product.id, area.id))).join('')}
      </div>

      ${this._stepCta('Próximo passo: definir os números', areasReady)}
    </section>`;
  },

  // V28.1.0 — Card de uma frente comercial (Marketing/Vendas/CS).
  // Mostra descrição minimalista RevOps + dono/prazo editáveis + contador de números.
  _comercialAreaCard(area, objective) {
    const owner = objective?.owner || '';
    const deadline = objective?.deadline || '';
    const okrCount = (objective?.okrs || []).length;
    const customLabel = objective?.label && objective.label !== area.label ? objective.label : '';
    const tone = area.color;
    return `<div class="rounded-3xl bg-white/[0.05] border border-${tone}-400/30 p-4 flex flex-col gap-3" style="min-height:280px;">
      <div class="flex items-center gap-2">
        <div class="w-9 h-9 rounded-xl bg-${tone}-500/20 grid place-items-center"><i data-lucide="${area.icon}" class="w-4 h-4 text-${tone}-200"></i></div>
        <div class="min-w-0">
          <p class="font-black text-white text-base leading-tight">${Utils.escape(area.label)}</p>
          ${customLabel ? `<p class="text-[10px] text-${tone}-200 truncate">${Utils.escape(customLabel)}</p>` : ''}
        </div>
      </div>

      <p class="text-[12px] text-slate-300 leading-relaxed flex-1">${Utils.escape(area.description)}</p>

      <div class="space-y-2 pt-2 border-t border-white/10">
        <div>
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Dono dessa frente</label>
          <input value="${Utils.escape(owner)}" oninput="Actions.updateStrategicAreaField('${area.id}', 'owner', this.value)" placeholder="Quem responde por essa frente?" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-white/15 text-white text-[12px] font-bold placeholder:text-slate-500" />
        </div>
        <div>
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Prazo do ciclo</label>
          <input type="date" value="${Utils.escape(deadline)}" oninput="Actions.updateStrategicAreaField('${area.id}', 'deadline', this.value)" class="w-full px-2.5 py-2 rounded-lg bg-slate-900 border border-white/15 text-white text-[12px] font-bold" style="color-scheme:dark;" />
        </div>
      </div>

      <div class="flex items-center justify-between pt-2 border-t border-white/10">
        <span class="text-[11px] text-slate-400 inline-flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-${tone}-400"></span> ${okrCount} número${okrCount === 1 ? '' : 's'} definido${okrCount === 1 ? '' : 's'}</span>
        <button onclick="Actions.setStrategicZoom('okrs')" class="px-2.5 py-1.5 rounded-lg bg-${tone}-500/20 hover:bg-${tone}-500/30 border border-${tone}-400/30 text-${tone}-100 text-[10px] font-black">Ver números →</button>
      </div>
    </div>`;
  },

  // -------------------- STEP 3: OS NÚMEROS --------------------
  // V28.2.0 — Catálogo guiado por segmento + handoff visual entre frentes.
  // Não pede pro user inventar números — ele ATIVA do catálogo curado e preenche meta.
  _stepOkrs(product) {
    const map = StrategicMapEngine.getForProduct(product.id);
    const objectives = map.objectives || [];
    const totalOkrs = objectives.reduce((sum, o) => sum + (o.okrs?.length || 0), 0);
    if (!objectives.length) {
      return `<section class="space-y-3">
        ${this._stepIntro('Os números', 'Defina as frentes comerciais antes de medir.', 'target')}
        <div class="rounded-3xl bg-amber-500/10 border border-amber-400/30 p-5 text-amber-200">
          <p class="font-black mb-1">Volte um passo.</p>
          <p class="text-sm">As 3 frentes comerciais precisam estar prontas antes de você criar números.</p>
          <button onclick="Actions.setStrategicZoom('objectives')" class="mt-3 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-black">← Voltar para Comercial</button>
        </div>
      </section>`;
    }
    return `<section class="space-y-3">
      ${this._stepIntro(
        'Que números dizem se cada frente está performando?',
        'Ative 1 a 3 números por frente. Sugerimos os mais comuns — escolha os que fazem sentido pro seu produto.',
        'target',
        'keyresults',
        'okrs-numeros-handoff',
        'Pense nos números como o "entregável" de cada frente: Marketing entrega leads pra Vendas, Vendas entrega clientes pra CS, CS devolve advogados/indicações pro topo. Os números marcados com 🔁 são exatamente esse handoff.'
      )}

      ${this._handoffBanner()}

      <div class="space-y-3">
        ${objectives.map(o => this._okrsObjectiveCard(product, o)).join('')}
      </div>
      ${this._stepCta('Próximo passo: conectar à operação', totalOkrs > 0)}
    </section>`;
  },

  // V28.2 — Faixa visual do handoff entre as 3 frentes.
  _handoffBanner() {
    return `<div class="rounded-2xl bg-gradient-to-r from-sky-500/10 via-emerald-500/10 to-violet-500/10 border border-white/10 p-3">
      <div class="grid grid-cols-3 gap-2 text-center text-[11px]">
        <div class="flex flex-col items-center gap-1">
          <div class="w-7 h-7 rounded-full bg-sky-500/25 grid place-items-center"><i data-lucide="megaphone" class="w-3.5 h-3.5 text-sky-200"></i></div>
          <p class="font-black text-sky-100">Marketing</p>
          <p class="text-[10px] text-slate-400">entrega <b>leads</b> →</p>
        </div>
        <div class="flex flex-col items-center gap-1">
          <div class="w-7 h-7 rounded-full bg-emerald-500/25 grid place-items-center"><i data-lucide="handshake" class="w-3.5 h-3.5 text-emerald-200"></i></div>
          <p class="font-black text-emerald-100">Vendas</p>
          <p class="text-[10px] text-slate-400">entrega <b>clientes</b> →</p>
        </div>
        <div class="flex flex-col items-center gap-1">
          <div class="w-7 h-7 rounded-full bg-violet-500/25 grid place-items-center"><i data-lucide="heart" class="w-3.5 h-3.5 text-violet-200"></i></div>
          <p class="font-black text-violet-100">Sucesso do Cliente</p>
          <p class="text-[10px] text-slate-400">devolve <b>advogados</b> ↩</p>
        </div>
      </div>
    </div>`;
  },

  _okrsObjectiveCard(product, obj) {
    const okrs = obj.okrs || [];
    const draft = App.state.strategicOkrDraft;
    const isDraftHere = draft && draft.objectiveId === obj.id;
    const area = (StrategicMapEngine.COMERCIAL_AREAS || []).find(a => a.id === obj.area);
    const tone = area?.color || 'indigo';
    const headerLabel = area?.label || obj.label;
    const sub = area && obj.label && obj.label !== area.label ? Utils.escape(obj.label) : '';
    return `<div class="rounded-3xl bg-white/[0.05] border border-${tone}-400/30 p-4 space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex items-center gap-3">
          ${area ? `<div class="w-9 h-9 rounded-xl bg-${tone}-500/20 grid place-items-center shrink-0"><i data-lucide="${area.icon}" class="w-4 h-4 text-${tone}-200"></i></div>` : ''}
          <div class="min-w-0">
            <p class="font-black text-white">${Utils.escape(headerLabel)}</p>
            <p class="text-[11px] text-slate-400 mt-0.5">${sub ? `${sub} · ` : ''}${okrs.length} número(s) ativo(s)${area?.handoff ? ` · ${area.handoff}` : ''}</p>
          </div>
        </div>
      </div>

      <div class="space-y-2">
        ${okrs.length ? okrs.map(kr => this._numeroCard(product, obj, kr, tone)).join('') : '<p class="text-[11px] text-slate-500 italic">Sem números ativos. Ative algum do catálogo abaixo.</p>'}
      </div>

      ${area && !isDraftHere ? this._kpiCatalogStrip(product, area, obj) : ''}

      ${isDraftHere ? this._okrDraftCard(draft, product, /* hideConnect */ true) : ''}

      ${!isDraftHere && area ? `<div class="flex justify-end pt-2 border-t border-white/10">
        <button onclick="Actions.startStrategicOkrDraft('${obj.id}')" class="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 text-[11px] font-black flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i> Criar número customizado</button>
      </div>` : ''}
    </div>`;
  },

  // V28.2 — Strip do catálogo: mostra KPIs do segmento ainda não ativados.
  _kpiCatalogStrip(product, area, obj) {
    const catalog = (StrategicMapEngine.KPI_CATALOG || {})[area.id] || [];
    const activated = StrategicMapEngine.getActivatedCatalogIds(product.id, area.id);
    const available = catalog.filter(k => !activated.has(k.id));
    if (!available.length) {
      return `<div class="rounded-xl bg-${area.color}-500/5 border border-${area.color}-400/20 p-2.5 text-[11px] text-${area.color}-200 italic">Todos os números típicos de ${Utils.escape(area.label)} já estão ativos.</div>`;
    }
    return `<div class="rounded-xl bg-${area.color}-500/5 border border-${area.color}-400/20 p-3">
      <p class="text-[10px] font-black text-${area.color}-200 uppercase tracking-wider mb-2">Números típicos de ${Utils.escape(area.label)} — clique pra ativar</p>
      <div class="grid sm:grid-cols-2 gap-1.5">
        ${available.map(k => `<button onclick="Actions.activateStrategicKpi('${area.id}', '${k.id}')" title="${Utils.escape(k.description)}" class="text-left px-2.5 py-2 rounded-lg bg-slate-900/60 hover:bg-slate-800 border border-white/10 text-white text-[11px] font-bold flex items-start gap-1.5">
          ${k.handoff ? `<span class="shrink-0 text-amber-300 mt-px" title="Handoff: entrega pro próximo segmento">🔁</span>` : `<i data-lucide="plus" class="w-3 h-3 text-${area.color}-300 shrink-0 mt-px"></i>`}
          <span class="min-w-0">${Utils.escape(k.name)}<span class="block text-[10px] text-slate-400 font-normal mt-0.5">${Utils.escape(k.description)}</span></span>
        </button>`).join('')}
      </div>
    </div>`;
  },

  // V28.2.1 — Card de número totalmente reformulado.
  // - Atual começa vazio (placeholder 0, value="" se null)
  // - Meta Segura + Meta Avançada como 2 campos separados (não dropdown)
  // - Período via chips (7d/15d/30d/3m/6m), sem datepicker
  // - Aviso amarelo se Segura preenchida sem Avançada
  // - Botão Confirmar (só ativa quando os 4 campos estão preenchidos)
  // - Quando confirmed: collapsed read-only com botão Editar
  // - Ring colorido se for o próximo da fila de confirmação
  _numeroCard(product, obj, kr, tone) {
    const handoffBadge = kr.isHandoff
      ? `<span title="Handoff: entrega desse segmento pro próximo" class="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-200 border border-amber-400/30">🔁 HANDOFF</span>`
      : '';

    if (kr.confirmed) {
      return this._numeroCardConfirmed(obj, kr, tone, handoffBadge);
    }
    return this._numeroCardEditing(product, obj, kr, tone, handoffBadge);
  },

  _numeroCardConfirmed(obj, kr, tone, handoffBadge) {
    const progress = StrategicOkrEngine.progress(kr);
    const score = StrategicOkrEngine.score ? StrategicOkrEngine.score(kr) : 0;
    const scoreStatus = StrategicOkrEngine.scoreStatus ? StrategicOkrEngine.scoreStatus(kr) : { color: 'slate', label: '' };
    const periodLabel = this._periodLabel(kr.period);
    return `<div class="rounded-2xl bg-emerald-500/[0.05] border border-emerald-400/30 p-3">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 flex-wrap mb-1">
            <span class="text-emerald-300 font-black">✓</span>
            <p class="font-black text-white text-sm">${Utils.escape(kr.name)}</p>
            ${handoffBadge}
          </div>
          <p class="text-[11px] text-slate-300">
            Hoje <b class="text-white">${Number(kr.current ?? 0)}</b>
            · Segura <b class="text-emerald-300">${Number(kr.targetCommitted ?? 0)}</b>
            · Avançada <b class="text-violet-300">${Number(kr.targetStretch ?? 0)}</b>
            · em <b class="text-white">${periodLabel}</b>
          </p>
        </div>
        <div class="flex flex-col items-end gap-0.5 shrink-0">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-${scoreStatus.color}-500/20 text-${scoreStatus.color}-200 border border-${scoreStatus.color}-400/30 whitespace-nowrap" title="${Utils.escape(scoreStatus.label)}">${score.toFixed(2)}</span>
          <span class="text-[9px] text-slate-500">${progress}%</span>
        </div>
      </div>
      ${StrategicMapRenderer.progressBar(progress, scoreStatus.color)}
      <div class="flex justify-end gap-1 mt-2">
        <button onclick="Actions.editStrategicNumero('${obj.id}','${kr.id}')" class="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 text-[10px] font-black">Editar</button>
        <button onclick="Actions.removeStrategicOkr('${obj.id}','${kr.id}')" class="px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-400/30 text-red-300 text-[10px] font-black">Remover</button>
      </div>
    </div>`;
  },

  _numeroCardEditing(product, obj, kr, tone, handoffBadge) {
    const next = StrategicMapEngine.nextUnconfirmedKr(product.id);
    const isNext = next && next.krId === kr.id;
    const ringCls = isNext ? `ring-2 ring-${tone}-400 shadow-lg shadow-${tone}-500/20` : '';
    const desc = kr.catalogDescription ? `<p class="text-[10px] text-slate-400 italic mb-2">${Utils.escape(kr.catalogDescription)}</p>` : '';
    const hasSafe = Number(kr.targetCommitted ?? 0) > 0;
    const hasAdv = Number(kr.targetStretch ?? 0) > 0;
    const missingAdv = hasSafe && !hasAdv;
    const complete = StrategicOkrEngine.isComplete(kr);
    const periods = [
      { d: 7, label: '7 dias' },
      { d: 15, label: '15 dias' },
      { d: 30, label: '30 dias' },
      { d: 90, label: '3 meses' },
      { d: 180, label: '6 meses' }
    ];

    return `<div class="rounded-2xl bg-black/30 border border-${tone}-400/20 p-3 ${ringCls}">
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 flex-wrap mb-1">
            ${isNext ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-${tone}-500/30 text-${tone}-100 border border-${tone}-400/40">PRÓXIMO</span>` : ''}
            <p class="font-black text-white text-sm">${Utils.escape(kr.name)}</p>
            ${handoffBadge}
          </div>
          ${desc}
        </div>
      </div>

      <div class="grid grid-cols-3 gap-1.5 mb-2">
        <label class="flex flex-col gap-0.5">
          <span class="text-[9px] font-black text-slate-500 uppercase">Atual</span>
          <input type="number" value="${kr.current ?? ''}" placeholder="0" onfocus="this.select()" oninput="Actions.updateStrategicOkrField('${obj.id}','${kr.id}','current', this.value)" class="px-2 py-1.5 rounded-lg bg-slate-900 border border-white/10 text-white text-[12px] font-bold w-full placeholder:text-slate-600" />
        </label>
        <label class="flex flex-col gap-0.5">
          <span class="text-[9px] font-black text-emerald-300 uppercase">🔒 Meta Segura</span>
          <input type="number" value="${kr.targetCommitted ?? ''}" placeholder="piso" onfocus="this.select()" oninput="Actions.updateStrategicOkrField('${obj.id}','${kr.id}','targetCommitted', this.value)" class="px-2 py-1.5 rounded-lg bg-slate-900 border ${hasSafe ? 'border-emerald-400/40' : 'border-white/10'} text-white text-[12px] font-bold w-full placeholder:text-slate-600" />
        </label>
        <label class="flex flex-col gap-0.5">
          <span class="text-[9px] font-black text-violet-300 uppercase">🚀 Meta Avançada</span>
          <input type="number" value="${kr.targetStretch ?? ''}" placeholder="sonho" onfocus="this.select()" oninput="Actions.updateStrategicOkrField('${obj.id}','${kr.id}','targetStretch', this.value)" class="px-2 py-1.5 rounded-lg bg-slate-900 border ${hasAdv ? 'border-violet-400/40' : (missingAdv ? 'border-amber-400/60' : 'border-white/10')} text-white text-[12px] font-bold w-full placeholder:text-slate-600" />
        </label>
      </div>

      ${missingAdv ? `<div class="rounded-lg bg-amber-500/10 border border-amber-400/30 p-2 text-[11px] text-amber-200 mb-2">⚠️ Você definiu a Meta Segura. Agora preencha a <b>Meta Avançada</b> — o sonho do time. Sem ela, o número fica só com o piso e perde a ambição.</div>` : ''}

      <div class="mb-2">
        <p class="text-[9px] font-black text-slate-500 uppercase mb-1">Período</p>
        <div class="flex flex-wrap gap-1.5">
          ${periods.map(p => `<button onclick="Actions.setStrategicNumeroPeriod('${obj.id}','${kr.id}', ${p.d})" class="px-2.5 py-1 rounded-lg border text-[11px] font-bold ${Number(kr.period) === p.d ? `bg-${tone}-500/30 border-${tone}-400/60 text-white` : 'bg-slate-900 border-white/15 text-slate-300 hover:bg-slate-800'}">${p.label}</button>`).join('')}
        </div>
      </div>

      <div class="flex justify-between items-center pt-2 border-t border-white/10">
        <button onclick="Actions.removeStrategicOkr('${obj.id}','${kr.id}')" class="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-400/30 text-red-300 text-[10px] font-black">Remover</button>
        <button onclick="Actions.confirmStrategicNumero('${obj.id}','${kr.id}')" ${complete ? '' : 'disabled'} class="px-3 py-1.5 rounded-lg ${complete ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'} text-[11px] font-black" ${complete ? 'style="color:#fff!important;"' : ''}>✓ Confirmar número →</button>
      </div>
    </div>`;
  },

  _periodLabel(days) {
    const map = { 7: '7 dias', 15: '15 dias', 30: '30 dias', 90: '3 meses', 180: '6 meses' };
    return map[Number(days)] || (days ? `${days} dias` : 'sem período');
  },

  _okrDraftCard(draft, product, hideConnect) {
    // V28.0.0 — Wizard didático de 7 substeps, uma pergunta por vez.
    // Substitui o form denso anterior que confundia o user.
    const step = Number(draft.wizardStep || 1);
    const actions = StrategicFlowBridge.actionsForProduct(product.id);
    const unitOptions = [
      { v: 'quantidade', l: 'Quantidade (unidades)' },
      { v: 'reais', l: 'R$ (Reais)' },
      { v: 'percentual', l: '% (Porcentagem)' },
      { v: 'dias', l: 'Dias / horas' },
      { v: 'pontuacao', l: 'Pontuação (NPS, CSAT)' },
      { v: 'outra', l: 'Outra' }
    ];
    const tipo = draft.commitmentType === 'committed' ? 'committed' : 'stretch';
    const stepTitles = [
      'Pergunta 1 de 7: O que medir',
      'Pergunta 2 de 7: Em que unidade',
      'Pergunta 3 de 7: Valor atual',
      'Pergunta 4 de 7: Onde quer chegar',
      'Pergunta 5 de 7: Tipo de meta',
      'Pergunta 6 de 7: Dono e impacto',
      'Pergunta 7 de 7: Confere'
    ];

    return `<div class="rounded-3xl bg-emerald-500/10 border border-emerald-400/30 p-5 space-y-4">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <i data-lucide="target" class="w-4 h-4 text-emerald-200"></i>
          <p class="text-xs font-black text-emerald-200 uppercase tracking-wider">Novo número · ${stepTitles[step - 1]}</p>
        </div>
        <button onclick="Actions.cancelStrategicOkrDraft()" class="text-slate-400 hover:text-white text-xs font-black">✕ Cancelar</button>
      </div>

      ${step === 1 ? `
        <div>
          <label class="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Qual número descreve essa batalha?</label>
          <input value="${Utils.escape(draft.name || '')}" oninput="Actions.updateStrategicOkrDraft('name', this.value)" placeholder="Ex: Lojas abertas no ano" class="w-full px-3 py-3 rounded-xl bg-slate-900 border border-white/15 text-white text-base font-bold placeholder:text-slate-500" />
          <p class="text-[11px] text-slate-400 mt-2">💡 Pode ser uma métrica que vc já acompanha, ou uma nova que quer começar a medir.</p>
          <div class="mt-3 flex flex-wrap gap-1.5">
            ${['Lojas abertas no ano', 'Cidades atendidas', 'Vendas no horário do almoço (%)', 'Frequência de compra por cliente'].map(ex => `<button onclick="Actions.updateStrategicOkrDraft('name', ${JSON.stringify(ex).replace(/"/g, '&quot;')}); App.render();" class="px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-400/20 text-emerald-200 text-[10px] font-bold">${Utils.escape(ex)}</button>`).join('')}
          </div>
        </div>
      ` : step === 2 ? `
        <div>
          <label class="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Em que unidade esse número é contado?</label>
          <div class="grid grid-cols-2 gap-2">
            ${unitOptions.map(u => `<button onclick="Actions.updateStrategicOkrDraft('metric', '${u.v}'); App.render();" class="px-3 py-3 rounded-xl border text-left ${draft.metric === u.v ? 'bg-emerald-500/20 border-emerald-400/50 text-white' : 'bg-slate-900 border-white/15 text-slate-300 hover:bg-slate-800'} text-sm font-bold">${u.l}</button>`).join('')}
          </div>
          <p class="text-[11px] text-slate-400 mt-2">💡 Só pra UI saber como mostrar o número.</p>
        </div>
      ` : step === 3 ? `
        <div>
          <label class="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Qual é o valor atual desse número hoje?</label>
          <input type="number" value="${Number(draft.current || 0)}" oninput="Actions.updateStrategicOkrDraft('current', Number(this.value || 0)); Actions.updateStrategicOkrDraft('startValue', Number(this.value || 0));" class="w-full px-3 py-3 rounded-xl bg-slate-900 border border-white/15 text-white text-2xl font-black" />
          <p class="text-[11px] text-slate-400 mt-2">💡 Se não souber exato, chuta — dá pra ajustar depois. Sem ponto de partida, não dá pra mostrar progresso.</p>
        </div>
      ` : step === 4 ? `
        <div>
          <label class="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">E aonde você quer chegar até <b class="text-emerald-300">${draft.deadline || '<defina o prazo>'}</b>?</label>
          <input type="number" value="${Number(draft.target || 0)}" oninput="Actions.updateStrategicOkrDraft('target', Number(this.value || 0))" class="w-full px-3 py-3 rounded-xl bg-slate-900 border border-white/15 text-white text-2xl font-black" />
          <div class="mt-2 flex gap-1.5">
            <span class="text-[11px] text-slate-400 self-center">Atalhos:</span>
            <button onclick="Actions.updateStrategicOkrDraft('target', (Number(App.state.strategicOkrDraft.current||0))*2); App.render();" class="px-2 py-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-400/30 text-violet-200 text-[10px] font-bold">2x</button>
            <button onclick="Actions.updateStrategicOkrDraft('target', (Number(App.state.strategicOkrDraft.current||0))*3); App.render();" class="px-2 py-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-400/30 text-violet-200 text-[10px] font-bold">3x</button>
            <button onclick="Actions.updateStrategicOkrDraft('target', Math.round(Number(App.state.strategicOkrDraft.current||0)*1.5)); App.render();" class="px-2 py-1 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-400/30 text-violet-200 text-[10px] font-bold">+50%</button>
          </div>
          <input type="date" value="${Utils.escape(draft.deadline || '')}" oninput="Actions.updateStrategicOkrDraft('deadline', this.value)" class="mt-3 w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-bold" style="color-scheme:dark;" placeholder="Prazo" />
          <p class="text-[11px] text-slate-400 mt-2">💡 Esse é o destino. Pensa grande mas com pé no chão.</p>
        </div>
      ` : step === 5 ? `
        <div>
          <label class="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3">Esse número é uma Meta Avançada ou Meta Segura?</label>
          <div class="grid md:grid-cols-2 gap-3">
            <button onclick="Actions.updateStrategicOkrDraft('commitmentType', 'stretch'); App.render();" class="text-left p-4 rounded-2xl border ${tipo === 'stretch' ? 'bg-violet-500/20 border-violet-400/60 ring-2 ring-violet-400/40' : 'bg-slate-900/80 border-white/15 hover:bg-slate-800'}">
              <div class="flex items-center gap-2 mb-2"><i data-lucide="rocket" class="w-4 h-4 text-violet-300"></i><p class="font-black text-violet-200">🚀 Meta Avançada</p></div>
              <p class="text-[12px] text-slate-300 mb-2">É o sonho grande que faz o time brilhar o olho. Não precisa ser realista — precisa engajar.</p>
              <p class="text-[12px] text-slate-300 mb-2">Aposta em mercados novos, canais que ainda não domina.</p>
              <p class="text-[11px] text-violet-300 font-black">🎯 Vitória = 70% do alvo</p>
            </button>
            <button onclick="Actions.updateStrategicOkrDraft('commitmentType', 'committed'); App.render();" class="text-left p-4 rounded-2xl border ${tipo === 'committed' ? 'bg-emerald-500/20 border-emerald-400/60 ring-2 ring-emerald-400/40' : 'bg-slate-900/80 border-white/15 hover:bg-slate-800'}">
              <div class="flex items-center gap-2 mb-2"><i data-lucide="lock" class="w-4 h-4 text-emerald-300"></i><p class="font-black text-emerald-200">🔒 Meta Segura</p></div>
              <p class="text-[12px] text-slate-300 mb-2">É o que vc PRECISA entregar, sem desculpa. Foca nos canais que já domina.</p>
              <p class="text-[12px] text-slate-300 mb-2">SLAs, contratos, faturamento mínimo, retenção.</p>
              <p class="text-[11px] text-emerald-300 font-black">🎯 Vitória = bater 100% do alvo</p>
            </button>
          </div>
        </div>
      ` : step === 6 ? `
        <div class="space-y-3">
          <div>
            <label class="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Quem é o dono desse número?</label>
            <input value="${Utils.escape(draft.owner || '')}" oninput="Actions.updateStrategicOkrDraft('owner', this.value)" placeholder="Ex: Maria, Time de Marketing" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-bold" />
          </div>
          <div>
            <label class="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Qual o impacto se bater? <span class="text-slate-500 font-normal">(opcional)</span></label>
            <textarea oninput="Actions.updateStrategicOkrDraft('impact', this.value)" placeholder="O que muda no negócio?" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-semibold min-h-[60px]">${Utils.escape(draft.impact || '')}</textarea>
            <p class="text-[11px] text-slate-400 mt-1">💡 Pula se quiser, dá pra preencher depois.</p>
          </div>
        </div>
      ` : `
        <div>
          <p class="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-3">Confere se ficou bom:</p>
          <div class="rounded-2xl bg-slate-900/60 border border-emerald-400/30 p-4 space-y-2">
            <p class="font-black text-white text-base">${Utils.escape(draft.name || 'Sem nome')}</p>
            <p class="text-sm text-slate-300">De <b class="text-white">${Number(draft.startValue || draft.current || 0)}</b> → <b class="text-emerald-300">${Number(draft.target || 0)}</b> ${Utils.escape(draft.metric || '')}${draft.deadline ? ` até <b class="text-white">${Utils.escape(draft.deadline)}</b>` : ''}</p>
            <p class="text-[11px]">${tipo === 'stretch' ? '<span class="px-2 py-0.5 rounded bg-violet-500/20 text-violet-200">🚀 Meta Avançada · 70% = vitória</span>' : '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200">🔒 Meta Segura · precisa 100%</span>'}</p>
            ${draft.owner ? `<p class="text-[11px] text-slate-400">Dono: <b class="text-slate-200">${Utils.escape(draft.owner)}</b></p>` : ''}
            ${draft.impact ? `<p class="text-[11px] text-slate-400 italic">"${Utils.escape(draft.impact)}"</p>` : ''}
          </div>
        </div>
      `}

      <div class="flex justify-between gap-2 pt-2 border-t border-white/10">
        ${step > 1 ? `<button onclick="Actions.prevStrategicOkrStep()" class="px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-white text-xs font-black">← Voltar</button>` : '<div></div>'}
        ${step < 7 ? `<button onclick="Actions.nextStrategicOkrStep()" ${step === 1 && !String(draft.name || '').trim() ? 'disabled' : ''} class="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 text-white text-xs font-black" style="color:#fff!important;">Próximo →</button>` : `<button onclick="Actions.saveStrategicOkrDraft()" class="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black" style="color:#fff!important;">✓ Salvar número</button>`}
      </div>
    </div>`;
  },

  // -------------------- STEP 4: CONECTAR OPERAÇÃO --------------------
  _stepOperations(product) {
    const map = StrategicMapEngine.getForProduct(product.id);
    const objectives = map.objectives || [];
    const okrs = objectives.flatMap(o => (o.okrs || []).map(kr => ({ obj: o, kr })));
    const connected = okrs.filter(({ kr }) => (kr.connectedActionIds || []).length > 0);
    const actions = StrategicFlowBridge.actionsForProduct(product.id);
    if (!okrs.length) {
      return `<section class="space-y-3">
        ${this._stepIntro('Conectar à Operação', 'Crie OKRs antes de conectar.', 'plug')}
        <div class="rounded-3xl bg-amber-500/10 border border-amber-400/30 p-5 text-amber-200">
          <p class="font-black mb-1">Faltam OKRs.</p>
          <p class="text-sm">Volte para a etapa de OKRs e crie pelo menos um.</p>
          <button onclick="Actions.setStrategicZoom('okrs')" class="mt-3 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-black">← Voltar para OKRs</button>
        </div>
      </section>`;
    }
    const hasCampaigns = (App.state.campaigns || []).some(c => Number(c.productId) === Number(product.id));
    if (!actions.length) {
      return `<section class="space-y-3">
        ${this._stepIntro('Conectar à Operação', 'Conecte cada OKR às ações operacionais que entregam o resultado.', 'plug')}
        <div class="rounded-3xl bg-amber-500/10 border border-amber-400/30 p-5 text-amber-200">
          <p class="font-black mb-1">${hasCampaigns ? 'Nenhuma ação cadastrada ainda neste produto.' : 'Nenhuma campanha cadastrada para este produto.'}</p>
          <p class="text-sm">${hasCampaigns ? 'Crie ações rapidamente em cada OKR abaixo, ou abra a aba Ações de Campanha para o cadastro completo.' : 'Crie uma campanha primeiro — depois aqui você pode criar ações rápidas direto pelos OKRs.'}</p>
          ${!hasCampaigns ? '<button onclick="Actions.closeStrategicMap(); App.setTab(\'campaigns\');" class="mt-3 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-black">Ir para Campanhas →</button>' : ''}
        </div>
        ${hasCampaigns ? `<div class="space-y-3">${okrs.map(({ obj, kr }) => this._operationsOkrCard(product, obj, kr, [])).join('')}</div>` : ''}
        ${this._stepCta('Próximo passo: executar via Djow', connected.length > 0)}
      </section>`;
    }
    return `<section class="space-y-3">
      ${this._stepIntro('Conectar à Operação', 'Para cada OKR, marque as ações que vão entregá-lo. Faltou alguma? Crie rápido pelo botão verde.', 'plug')}
      <div class="space-y-3">
        ${okrs.map(({ obj, kr }) => this._operationsOkrCard(product, obj, kr, actions)).join('')}
      </div>
      ${this._stepCta('Próximo passo: executar via Djow', connected.length > 0)}
    </section>`;
  },

  _operationsOkrCard(product, obj, kr, actions) {
    const linked = new Set((kr.connectedActionIds || []).map(Number));
    const hasDraftConnected = (kr.connectedActionIds || []).some(id => {
      const a = (App.state.actions || []).find(a => Number(a.id) === Number(id));
      return a?.isDraft;
    });
    return `<div class="rounded-3xl bg-white/[0.05] border border-white/10 p-4 space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">${Utils.escape(obj.label)}</p>
          <p class="font-black text-white">${Utils.escape(kr.name)}</p>
          <p class="text-[11px] text-slate-400 mt-0.5">Meta ${Number(kr.target || 0)} ${Utils.escape(kr.metric)} · ${linked.size} ação(ões) conectada(s)</p>
        </div>
        <button onclick="Actions.openQuickActionModal(${product.id}, '${obj.id}', '${kr.id}')" class="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-[11px] font-black flex items-center gap-1 whitespace-nowrap" title="Criar e conectar uma ação ao OKR (modo rápido)"><i data-lucide="plus" class="w-3 h-3"></i> Criar ação</button>
      </div>
      <div>
        <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Ações disponíveis · clique para conectar</p>
        ${actions.length ? `<div class="flex flex-wrap gap-1.5">${actions.map(a => {
          const on = linked.has(Number(a.id));
          const draft = Boolean(a.isDraft);
          return `<button onclick="Actions.toggleStrategicOkrAction('${obj.id}','${kr.id}', ${a.id})" class="px-2.5 py-1.5 rounded-lg text-[11px] font-black transition flex items-center gap-1 ${on ? 'bg-emerald-500/30 text-emerald-100 border border-emerald-400/50' : 'bg-white/5 text-slate-300 border border-white/15 hover:bg-white/10'}">${on ? '✓ ' : ''}${Utils.escape(a.name || 'Ação')}${draft ? ' <span class="text-[9px] px-1 rounded bg-amber-400/30 text-amber-100 border border-amber-300/40">rascunho</span>' : ''}</button>`;
        }).join('')}</div>` : '<p class="text-[11px] text-slate-500 italic">Nenhuma ação ainda. Use <b class="text-emerald-300">Criar ação</b> acima para cadastrar a primeira.</p>'}
      </div>
      ${hasDraftConnected ? `<div class="rounded-xl bg-amber-500/15 border border-amber-400/30 p-2.5 text-[11px] text-amber-100 flex items-start gap-2">
        <i data-lucide="alert-triangle" class="w-3.5 h-3.5 mt-0.5 shrink-0"></i>
        <p>Há ações em <b>rascunho</b> conectadas a este OKR. <button onclick="Actions.closeStrategicMap(); App.setTab('actions');" class="underline font-black">Complete em Ações de Campanha</button> para a leitura ficar precisa.</p>
      </div>` : ''}
    </div>`;
  },

  // -------------------- STEP 5: EXECUTAR --------------------
  _stepExecution(product) {
    const map = StrategicMapEngine.getForProduct(product.id);
    const objectives = map.objectives || [];
    const okrs = objectives.flatMap(o => (o.okrs || []).map(kr => ({ obj: o, kr })));
    const connectedOkrs = okrs.filter(({ kr }) => (kr.connectedActionIds || []).length > 0);
    if (!connectedOkrs.length) {
      return `<section class="space-y-3">
        ${this._stepIntro('Executar via Djow', 'Conecte OKRs a ações antes de executar.', 'send')}
        <div class="rounded-3xl bg-amber-500/10 border border-amber-400/30 p-5 text-amber-200">
          <p class="font-black mb-1">Nenhum OKR conectado.</p>
          <p class="text-sm">Volte para Conectar Operação e plugue ao menos um OKR a uma ação.</p>
          <button onclick="Actions.setStrategicZoom('operations')" class="mt-3 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-black">← Voltar para Conectar Operação</button>
        </div>
      </section>`;
    }
    return `<section class="space-y-3">
      ${this._stepIntro('Executar via Djow', 'Para cada OKR conectado, dispare uma tarefa real no provider operacional configurado.', 'send')}
      ${this._executionProviderBanner()}
      <div class="space-y-3">
        ${connectedOkrs.map(({ obj, kr }) => this._executionOkrCard(product, obj, kr)).join('')}
      </div>
    </section>`;
  },

  _executionProviderBanner() {
    const providerId = window.ExecutionProviderRegistry?.getDefaultProviderId?.() || 'manual';
    const provider = window.ExecutionProviderRegistry?.byId(providerId);
    const cfg = window.ExecutionProviderRegistry?.getProviderConfig(providerId) || {};
    const isManual = providerId === 'manual';
    const isConnected = isManual || Boolean(cfg.connected);
    const tone = isConnected ? 'from-emerald-500/15 to-emerald-400/5 border-emerald-400/30 text-emerald-100' : 'from-amber-500/15 to-amber-400/5 border-amber-400/30 text-amber-100';
    return `<div class="rounded-3xl bg-gradient-to-br ${tone} border p-4 flex items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl bg-white/10 grid place-items-center"><i data-lucide="${provider?.icon || 'edit'}" class="w-5 h-5"></i></div>
        <div>
          <p class="text-[10px] font-black uppercase tracking-wider opacity-80">Provider operacional ativo</p>
          <p class="font-black text-base">${Utils.escape(provider?.label || 'Manual')}</p>
          <p class="text-[11px] opacity-80 mt-0.5">${isManual ? 'Tarefas ficam no LeadJourney. Configure ClickUp/Trello para sair para sua squad.' : (isConnected ? 'Tarefas criadas aqui serão enviadas para sua squad automaticamente.' : 'Credenciais não testadas. Configure antes de disparar.')}</p>
        </div>
      </div>
      ${isManual || !isConnected ? '<button onclick="Actions.closeStrategicMap(); Actions.openSettingsModal(); Actions.setSettingsSection(\'execution\');" class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-xs font-black whitespace-nowrap">Configurar</button>' : ''}
    </div>`;
  },

  _executionOkrCard(product, obj, kr) {
    const actions = StrategicFlowBridge.actionsForOkr(product.id, kr);
    const tasks = (window.ExecutionTaskStore?.all() || []).filter(t => actions.some(a => Number(a.id) === Number(t.linked_action_id)));
    const executed = tasks.filter(t => t.status === 'completed').length;
    const pending = tasks.length - executed;
    const progress = StrategicOkrEngine.progress(kr);
    const status = StrategicMapRenderer.okrStatus(progress);
    return `<div class="rounded-3xl bg-white/[0.05] border border-white/10 p-4">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="min-w-0">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-wider">${Utils.escape(obj.label)}</p>
          <p class="font-black text-white">${Utils.escape(kr.name)}</p>
          <p class="text-[11px] text-slate-400 mt-0.5">${Number(kr.current || 0)}/${Number(kr.target || 0)} ${Utils.escape(kr.metric)} · ${actions.length} ação(ões) conectada(s) · ${tasks.length} tarefa(s) (${executed} concluída(s))</p>
        </div>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-${status.color}-500/20 text-${status.color}-200 border border-${status.color}-400/30 whitespace-nowrap">${progress}%</span>
      </div>
      ${StrategicMapRenderer.progressBar(progress, status.color)}
      <div class="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/10">
        ${actions.map(a => `<button onclick="Actions.createTaskFromOkr(${product.id}, '${obj.id}', '${kr.id}', ${a.id})" class="px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-[11px] font-black flex items-center gap-1.5" style="color:#fff!important;" title="Abrir Djow já preenchido para criar tarefa nesta ação"><i data-lucide="send" class="w-3 h-3"></i> Criar tarefa via Djow · ${Utils.escape(a.name)}</button>`).join('')}
        <button onclick="Actions.syncStrategicOkrSingle('${obj.id}','${kr.id}')" class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-[11px] font-black flex items-center gap-1.5"><i data-lucide="refresh-cw" class="w-3 h-3"></i> Atualizar leitura</button>
        ${tasks.length ? `<button onclick="Actions.closeStrategicMap(); Actions.openTasksModal(${actions[0]?.id || 0});" class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-[11px] font-black">Ver ${tasks.length} tarefa(s)</button>` : ''}
      </div>
    </div>`;
  },

  // -------------------- COMMON --------------------
  _stepIntro(title, hint, icon, interviewKey, helpKey, helpText) {
    // V27.0.0 — interviewKey opcional ativa botão "Djow me entrevista".
    // V28.1.1 — helpKey+helpText opcionais ativam botão (?) com balão toggleable.
    const interviewBtn = interviewKey ? `<button onclick="Actions.djowInterviewStrategic('${interviewKey}')" class="px-3 py-1.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/40 text-violet-100 text-[11px] font-black flex items-center gap-1.5 shrink-0" title="Djow conduz entrevista guiada"><i data-lucide="sparkles" class="w-3 h-3"></i> Djow me entrevista</button>` : '';
    const helpOpen = helpKey && (App.state.strategicHelpOpen || {})[helpKey];
    const helpBtn = helpKey && helpText
      ? `<button onclick="Actions.toggleStrategicHelp('${helpKey}')" class="w-5 h-5 rounded-full bg-indigo-500/20 hover:bg-indigo-500/40 border border-indigo-400/30 text-indigo-200 text-[11px] font-black grid place-items-center transition" title="O que é isso?">?</button>`
      : '';
    const helpBalloon = helpKey && helpText && helpOpen
      ? `<div class="mt-2 rounded-xl bg-indigo-500/10 border border-indigo-400/30 p-3 text-[12px] text-indigo-50 leading-relaxed relative">
          <button onclick="Actions.toggleStrategicHelp('${helpKey}')" class="absolute top-1.5 right-2 text-indigo-300 hover:text-white text-xs font-black">×</button>
          ${Utils.escape(helpText)}
        </div>`
      : '';
    return `<div>
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <i data-lucide="${icon}" class="w-4 h-4 text-indigo-300"></i>
            <p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Etapa: ${title}</p>
            ${helpBtn}
          </div>
          <p class="text-xs text-slate-400">${Utils.escape(hint)}</p>
        </div>
        ${interviewBtn}
      </div>
      ${helpBalloon}
    </div>`;
  },

  _djowSide(product, stepId) {
    const messages = DjowStrategicAssistant.history(product.id);
    const draft = App.state.strategicDjowDraft || '';
    const sending = Boolean(App.state.strategicDjowSending);
    return `<aside class="rounded-3xl bg-white/[0.04] border border-white/10 p-4 flex flex-col" style="max-height:74vh;min-height:520px;">
      <div class="flex items-center gap-2 mb-3"><i data-lucide="sparkles" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Djow — Estratégia</p></div>
      ${this._djowStepTip(stepId)}
      <div class="flex-1 overflow-auto space-y-2 pr-1 mt-3">
        ${messages.length ? messages.map(m => this._chatBubble(m)).join('') : this._djowStepHints(stepId)}
      </div>
      <div class="mt-3 border-t border-white/10 pt-3">
        <textarea ${sending ? 'disabled' : ''} oninput="Actions.updateStrategicDjowDraft(this.value)" placeholder="Pergunte qualquer coisa sobre esta etapa..." class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-semibold min-h-[64px] placeholder:text-slate-500" style="color-scheme:dark;">${Utils.escape(draft)}</textarea>
        <button ${sending ? 'disabled' : ''} onclick="Actions.sendStrategicDjow()" class="mt-2 w-full px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-600 text-white text-xs font-black flex items-center justify-center gap-2" style="color:#fff!important;">${sending ? '<span class="w-3 h-3 rounded-full border-2 border-current border-r-transparent animate-spin"></span> Pensando…' : '<i data-lucide="send" class="w-3.5 h-3.5"></i> Perguntar ao Djow'}</button>
      </div>
    </aside>`;
  },

  _djowStepTip(stepId) {
    const tipMap = {
      vision:     'Foco no produto. Frase curta, ambiciosa, conectada a quem ele serve.',
      objectives: 'O Comercial é um funil de 3 frentes: Marketing → Vendas → CS. Cada frente tem um dono.',
      okrs:       'Pra cada frente, 1-3 números. Marketing: leads. Vendas: clientes. CS: retenção/advocacy.',
      operations: 'Conecte cada número à ação operacional real. Pode ser mais de uma.',
      execution:  'Clique em "Criar tarefa via Djow" — a tarefa vai direto para o ClickUp/provider configurado.'
    };
    const tip = tipMap[stepId] || '';
    if (!tip) return '';
    return `<div class="rounded-xl bg-indigo-500/15 border border-indigo-400/30 p-2.5 text-[11px] text-indigo-100"><b class="text-indigo-200">Dica:</b> ${Utils.escape(tip)}</div>`;
  },

  _djowStepHints(stepId) {
    const hintsByStep = {
      vision:     ['Como escrever o objetivo do produto?', 'Exemplos de objetivo de produto', 'Objetivo muito longo, como encurtar?'],
      objectives: ['Como definir o dono de cada frente?', 'Quem deve responder por Marketing/Vendas/CS?', 'Posso ter mais de uma pessoa por frente?'],
      okrs:       ['Bons números para Marketing', 'Bons números para Vendas', 'Bons números para Sucesso do Cliente'],
      operations: ['Posso conectar uma ação a múltiplos números?', 'Como saber se uma ação serve esse número?', 'Não tenho ações ainda'],
      execution:  ['Para onde a tarefa vai?', 'Como configurar ClickUp?', 'Tarefa criada não aparece no provider']
    };
    const hints = hintsByStep[stepId] || hintsByStep.vision;
    return `<div class="space-y-2">
      <p class="text-xs text-slate-400">Sugestões para esta etapa:</p>
      ${hints.map(h => `<button onclick="Actions.askStrategicDjow('${Utils.escape(h).replace(/'/g, '&#39;')}')" class="w-full text-left px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-200 text-xs">${Utils.escape(h)}</button>`).join('')}
    </div>`;
  },

  _chatBubble(m) {
    if (m.role === 'user') {
      return `<div class="flex justify-end"><div class="max-w-[85%] px-3 py-2 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 text-indigo-50 text-xs whitespace-pre-wrap">${Utils.escape(m.text)}</div></div>`;
    }
    return `<div class="flex justify-start"><div class="max-w-[88%] px-3 py-2 rounded-2xl bg-white/10 border border-white/15 text-slate-100 text-xs whitespace-pre-wrap">${Utils.escape(m.text)}</div></div>`;
  }
};
