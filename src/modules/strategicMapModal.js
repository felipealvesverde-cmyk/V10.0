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
        <p class="text-xs text-slate-300 mt-1">${snap.objectivesCount} objetivo(s) · ${snap.okrsCount} OKR(s) · ${snap.connectedFlows} fluxo(s) · progresso médio ${snap.avgProgress}%</p>
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

  // -------------------- STEP 1: O SONHO --------------------
  // V28.0.0 — Redesenhada didática: pergunta humana + exemplos cotidianos
  // (Cacau Show + outros) + textarea grande + helper inspiracional.
  _stepVision(product) {
    const map = StrategicMapEngine.getForProduct(product.id);
    const hasVision = Boolean(String(map.vision || '').trim());

    const exampleCacau = 'Ser a marca de chocolate mais querida do Brasil até 2027.';
    const otherExamples = [
      'Virar a padaria onde todo mundo do bairro toma café',
      'Ser o lugar onde dono e bichinho se sentem em casa',
      'Resolver o almoço de quem trabalha em escritório',
      'Ter os melhores doces de casamento do Sul'
    ];

    return `<section class="space-y-4">
      ${this._stepIntro('Qual é o sonho desse produto pros próximos 12 meses?', 'Uma frase só. Bem ambiciosa. Pra todo time saber pra onde estamos remando.', 'star', 'vision')}

      ${!hasVision ? `
        <div class="rounded-3xl bg-violet-500/10 border border-violet-400/30 p-5">
          <div class="flex items-center gap-2 mb-3">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-500/30 text-violet-100">Exemplo</span>
            <span class="text-[11px] text-slate-400">Pra inspirar — pode adaptar pro seu negócio</span>
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
        <label class="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Seu sonho em uma frase</label>
        <textarea oninput="Actions.updateStrategicVision(this.value)" placeholder="Tornar [seu produto] o(a) [posição] pra [público] até [horizonte]" class="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-white/15 text-white text-sm font-semibold min-h-[100px] placeholder:text-slate-500" style="color-scheme:dark;">${Utils.escape(map.vision || '')}</textarea>
        <p class="text-[11px] text-slate-400 mt-2">💡 Tem que dar arrepio. Se não der, é meta, não sonho.</p>
      </div>

      ${this._stepCta('Próximo passo: definir as batalhas', hasVision)}
    </section>`;
  },

  // -------------------- STEP 2: AS BATALHAS --------------------
  // V28.0.0 — Empty state com exemplo Cacau Show + wizard 3 substeps pra criar batalha.
  _stepObjectives(product) {
    const map = StrategicMapEngine.getForProduct(product.id);
    const objectives = map.objectives || [];
    const draft = App.state.strategicObjectiveDraft;
    const visionShort = (map.vision || '').length > 80 ? (map.vision || '').slice(0, 80) + '…' : (map.vision || '');

    return `<section class="space-y-4">
      ${this._stepIntro('Quais são as 3 a 5 batalhas pra realizar esse sonho?', 'Frentes grandes, sem números ainda. São as guerras que você vai travar.', 'flag', 'objectives')}

      ${visionShort ? `<div class="rounded-xl bg-violet-500/10 border border-violet-400/20 px-3 py-2 text-[11px] text-slate-300">🌟 <b class="text-violet-200">Seu sonho:</b> «${Utils.escape(visionShort)}»</div>` : ''}

      ${!objectives.length && !draft ? this._batalhasEmptyState() : ''}

      <div class="flex justify-between items-center">
        <p class="text-xs text-slate-400">${objectives.length} de até 5 batalhas</p>
        ${!draft && objectives.length < 5 ? '<button onclick="Actions.startStrategicObjectiveDraft()" class="px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-black flex items-center gap-1.5" style="color:#fff!important;"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Criar batalha</button>' : ''}
      </div>

      ${draft ? this._objectiveWizardCard(draft) : ''}

      <div class="space-y-2">
        ${objectives.map((o, i) => this._objectiveSummaryCard(o, i)).join('')}
      </div>

      ${objectives.length >= 1 && objectives.length < 3 ? '<p class="text-[11px] text-amber-300/80 italic">💡 Tem espaço pra mais. Sonhos grandes raramente cabem em ' + objectives.length + ' batalha' + (objectives.length === 1 ? '' : 's') + ' só.</p>' : ''}
      ${objectives.length === 5 ? '<p class="text-[11px] text-amber-300/80 italic">💡 Você atingiu o limite de 5 batalhas. Mais que isso, o time se perde.</p>' : ''}

      ${this._stepCta('Próximo passo: definir os números', objectives.length > 0)}
    </section>`;
  },

  _batalhasEmptyState() {
    return `<div class="rounded-3xl bg-violet-500/10 border border-violet-400/30 p-5">
      <p class="text-sm text-slate-200 leading-relaxed mb-3">
        Pensa assim: se daqui 12 meses o sonho virou realidade, quais foram as 3, 4 ou 5 grandes coisas que você fez?
      </p>

      <div class="rounded-2xl bg-slate-900/60 border border-violet-400/20 p-4">
        <div class="flex items-center gap-2 mb-2">
          <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-violet-500/30 text-violet-100">Exemplo Cacau Show</span>
        </div>
        <p class="text-[12px] text-slate-300 mb-3">Pra "Ser a marca de chocolate mais querida do Brasil", as batalhas poderiam ser:</p>
        <ol class="space-y-1.5 mb-4">
          <li class="text-sm text-white"><b class="text-violet-300">1.</b> Estar presente em mais bairros do Brasil</li>
          <li class="text-sm text-white"><b class="text-violet-300">2.</b> Fazer cada cliente voltar mais vezes no ano</li>
          <li class="text-sm text-white"><b class="text-violet-300">3.</b> Garantir que todo mundo lembre da gente nas datas comemorativas</li>
          <li class="text-sm text-white"><b class="text-violet-300">4.</b> Conquistar quem hoje compra chocolate importado</li>
        </ol>
        <button onclick="Actions.loadCacauShowBatalhasExample()" class="px-3 py-1.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-xs font-black" style="color:#fff!important;">Carregar como rascunho →</button>
      </div>
    </div>`;
  },

  _objectiveSummaryCard(obj, idx) {
    const okrCount = (obj.okrs || []).length;
    const okrDot = okrCount > 0 ? 'bg-violet-500' : 'bg-emerald-500';
    const numero = String(idx + 1).padStart(2, '0');
    return `<div class="rounded-2xl bg-white/[0.04] border border-white/10 p-3 flex items-start gap-3">
      <div class="w-8 h-8 rounded-lg bg-violet-500/20 grid place-items-center font-black text-violet-200 text-sm shrink-0">${numero}</div>
      <div class="flex-1 min-w-0">
        <p class="font-black text-white text-sm">${Utils.escape(obj.label || 'Batalha sem nome')}</p>
        <p class="text-[11px] text-slate-400 mt-0.5">
          ${obj.owner ? `Dono: <b class="text-slate-200">${Utils.escape(obj.owner)}</b>` : '<span class="italic">Sem dono</span>'}
          ${obj.deadline ? ` · Prazo: <b class="text-slate-200">${Utils.escape(obj.deadline)}</b>` : ''}
          · <span class="inline-flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full ${okrDot}"></span> ${okrCount} número${okrCount === 1 ? '' : 's'} definido${okrCount === 1 ? '' : 's'}</span>
        </p>
      </div>
      <button onclick="Actions.removeStrategicObjective('${obj.id}')" title="Remover batalha" class="px-2 py-1 rounded-lg bg-red-500/10 border border-red-400/30 text-red-300 text-[10px] font-black hover:bg-red-500/20">×</button>
    </div>`;
  },

  // V28.0.0 — Wizard de 3 substeps pra criar uma batalha (Nome / Dono / Prazo).
  _objectiveWizardCard(draft) {
    const step = Number(draft.wizardStep || 1);
    const stepTitle = step === 1 ? 'Pergunta 1 de 3: Nome da batalha' : step === 2 ? 'Pergunta 2 de 3: Quem é o dono?' : step === 3 ? 'Pergunta 3 de 3: Até quando?' : 'Confere se ficou bom:';
    return `<div class="rounded-3xl bg-indigo-500/15 border border-indigo-400/30 p-5 space-y-4">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <i data-lucide="flag" class="w-4 h-4 text-indigo-200"></i>
          <p class="text-xs font-black text-indigo-200 uppercase tracking-wider">Nova batalha · ${stepTitle}</p>
        </div>
        <button onclick="Actions.cancelStrategicObjectiveDraft()" class="text-slate-400 hover:text-white text-xs font-black">✕ Cancelar</button>
      </div>

      ${step === 1 ? `
        <div>
          <label class="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Qual é o nome dessa batalha?</label>
          <input value="${Utils.escape(draft.label || '')}" oninput="Actions.updateStrategicObjectiveDraft('label', this.value)" placeholder="Ex: Estar presente em mais bairros do Brasil" class="w-full px-3 py-3 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-bold placeholder:text-slate-500" />
          <p class="text-[11px] text-slate-400 mt-2">💡 Frase curta, ambiciosa, começa com verbo. Sem números aqui — os números entram na próxima etapa.</p>
          <div class="mt-3 flex flex-wrap gap-1.5">
            ${[
              'Fazer cada cliente voltar mais vezes no ano',
              'Conquistar quem hoje compra do concorrente premium',
              'Garantir que todo mundo lembre da gente nas datas comemorativas'
            ].map(ex => `<button onclick="Actions.updateStrategicObjectiveDraft('label', ${JSON.stringify(ex).replace(/"/g, '&quot;')}); App.render();" class="px-2 py-1 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-400/20 text-violet-200 text-[10px] font-bold">${Utils.escape(ex)}</button>`).join('')}
          </div>
        </div>
      ` : step === 2 ? `
        <div>
          <label class="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Quem é o responsável por essa batalha?</label>
          <input value="${Utils.escape(draft.owner || '')}" oninput="Actions.updateStrategicObjectiveDraft('owner', this.value)" placeholder="Nome de uma pessoa ou time (ex: Maria, Time de Marketing)" class="w-full px-3 py-3 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-bold placeholder:text-slate-500" />
          <p class="text-[11px] text-slate-400 mt-2">💡 Uma pessoa só. Quem perde sono se essa batalha não andar.</p>
        </div>
      ` : `
        <div>
          <label class="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Até quando você quer ter essa batalha vencida?</label>
          <input type="date" value="${Utils.escape(draft.deadline || '')}" oninput="Actions.updateStrategicObjectiveDraft('deadline', this.value)" class="w-full px-3 py-3 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-bold" style="color-scheme:dark;" />
          <p class="text-[11px] text-slate-400 mt-2">💡 Geralmente um trimestre ou o ano todo. Sem prazo, vira eterna.</p>
        </div>
      `}

      <div class="flex justify-between gap-2 pt-2 border-t border-white/10">
        ${step > 1 ? `<button onclick="Actions.prevStrategicObjectiveStep()" class="px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-white text-xs font-black">← Voltar</button>` : '<div></div>'}
        ${step < 3 ? `<button onclick="Actions.nextStrategicObjectiveStep()" ${step === 1 && !String(draft.label || '').trim() ? 'disabled' : ''} class="px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-30 text-white text-xs font-black" style="color:#fff!important;">Próximo →</button>` : `<button onclick="Actions.saveStrategicObjectiveDraft()" class="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black" style="color:#fff!important;">✓ Salvar batalha</button>`}
      </div>
    </div>`;
  },

  // -------------------- STEP 3: OKRs --------------------
  _stepOkrs(product) {
    const map = StrategicMapEngine.getForProduct(product.id);
    const objectives = map.objectives || [];
    const totalOkrs = objectives.reduce((sum, o) => sum + (o.okrs?.length || 0), 0);
    if (!objectives.length) {
      return `<section class="space-y-3">
        ${this._stepIntro('Key Results', 'Crie pelo menos um Objective antes de medir.', 'target')}
        <div class="rounded-3xl bg-amber-500/10 border border-amber-400/30 p-5 text-amber-200">
          <p class="font-black mb-1">Volte um passo.</p>
          <p class="text-sm">Você precisa criar Objetivos antes de adicionar OKRs.</p>
          <button onclick="Actions.setStrategicZoom('objectives')" class="mt-3 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-black">← Voltar para Objetivos</button>
        </div>
      </section>`;
    }
    return `<section class="space-y-3">
      ${this._stepIntro('Key Results', 'Por Objective, 3-5 KRs quantitativos: "de X pra Y até Z". Marque Stretch (0.7=sucesso) ou Committed (precisa 1.0).', 'target', 'keyresults')}
      <div class="space-y-3">
        ${objectives.map(o => this._okrsObjectiveCard(product, o)).join('')}
      </div>
      ${this._stepCta('Próximo passo: conectar à operação', totalOkrs > 0)}
    </section>`;
  },

  _okrsObjectiveCard(product, obj) {
    const okrs = obj.okrs || [];
    const draft = App.state.strategicOkrDraft;
    const isDraftHere = draft && draft.objectiveId === obj.id;
    return `<div class="rounded-3xl bg-white/[0.05] border border-white/10 p-4 space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="font-black text-white">${Utils.escape(obj.label)}</p>
          <p class="text-[11px] text-slate-400 mt-0.5">${okrs.length} OKR(s)</p>
        </div>
        ${!isDraftHere ? `<button onclick="Actions.startStrategicOkrDraft('${obj.id}')" class="px-2.5 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-[11px] font-black flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i> Novo OKR</button>` : ''}
      </div>
      ${isDraftHere ? this._okrDraftCard(draft, product, /* hideConnect */ true) : ''}
      <div class="space-y-2">
        ${okrs.length ? okrs.map(kr => this._okrSummaryCard(product, obj, kr)).join('') : (isDraftHere ? '' : '<p class="text-[11px] text-slate-500 italic">Sem OKRs neste objetivo ainda.</p>')}
      </div>
    </div>`;
  },

  _okrSummaryCard(product, obj, kr) {
    // V27.0.0 — Card de KR mostra: score 0.0-1.0 (Doerr) + commitment badge + status color.
    const progress = StrategicOkrEngine.progress(kr);
    const score = StrategicOkrEngine.score ? StrategicOkrEngine.score(kr) : (progress / 100);
    const scoreStatus = StrategicOkrEngine.scoreStatus ? StrategicOkrEngine.scoreStatus(kr) : { color: 'slate', label: '' };
    const commitmentType = kr.commitmentType || 'stretch';
    const commitmentBadge = commitmentType === 'committed'
      ? `<span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-200 border border-amber-400/30 inline-flex items-center gap-1"><i data-lucide="lock" class="w-2.5 h-2.5"></i> COMMITTED</span>`
      : `<span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-violet-500/20 text-violet-200 border border-violet-400/30 inline-flex items-center gap-1"><i data-lucide="rocket" class="w-2.5 h-2.5"></i> STRETCH</span>`;
    const startLabel = kr.startValue != null && Number(kr.startValue) !== 0 ? ` (de ${Number(kr.startValue)})` : '';
    return `<div class="rounded-2xl bg-black/30 border border-white/10 p-3">
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap mb-1">
            <p class="font-black text-white text-sm">${Utils.escape(kr.name)}</p>
            ${commitmentBadge}
          </div>
          <p class="text-[11px] text-slate-400">${Number(kr.current || 0)}/${Number(kr.target || 0)} ${Utils.escape(kr.metric)}${startLabel}${kr.deadline ? ` · até ${Utils.escape(kr.deadline)}` : ''}</p>
        </div>
        <div class="flex flex-col items-end gap-0.5 shrink-0">
          <span class="px-2 py-0.5 rounded-full text-[11px] font-black bg-${scoreStatus.color}-500/20 text-${scoreStatus.color}-200 border border-${scoreStatus.color}-400/30 whitespace-nowrap" title="${Utils.escape(scoreStatus.label)}">${score.toFixed(2)}</span>
          <span class="text-[9px] text-slate-500">${progress}%</span>
        </div>
      </div>
      ${StrategicMapRenderer.progressBar(progress, scoreStatus.color)}
      <div class="flex justify-end gap-1 mt-2">
        <button onclick="Actions.removeStrategicOkr('${obj.id}','${kr.id}')" class="px-2 py-1 rounded bg-red-500/10 border border-red-400/30 text-red-300 text-[10px] font-black">Remover</button>
      </div>
    </div>`;
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
  _stepIntro(title, hint, icon, interviewKey) {
    // V27.0.0 — interviewKey opcional ativa botão "Djow me entrevista" que abre
    // o modal Djow com prompt contextualizado pra entrevistar o user no formato Doerr.
    const interviewBtn = interviewKey ? `<button onclick="Actions.djowInterviewStrategic('${interviewKey}')" class="px-3 py-1.5 rounded-xl bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/40 text-violet-100 text-[11px] font-black flex items-center gap-1.5 shrink-0" title="Djow conduz entrevista guiada"><i data-lucide="sparkles" class="w-3 h-3"></i> Djow me entrevista</button>` : '';
    return `<div class="flex items-start justify-between gap-3">
      <div>
        <div class="flex items-center gap-2 mb-1"><i data-lucide="${icon}" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Etapa: ${title}</p></div>
        <p class="text-xs text-slate-400">${Utils.escape(hint)}</p>
      </div>
      ${interviewBtn}
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
      vision:     'Comece com uma frase curta e ambiciosa. Foque no "para quê", não no "como".',
      objectives: 'Bons objetivos têm verbo de ação: Aumentar, Reduzir, Melhorar, Capturar.',
      okrs:       'OKR = resultado mensurável. Exemplo: "2.000 leads qualificados até julho".',
      operations: 'Conecte cada OKR à ação operacional real. Pode ser mais de uma.',
      execution:  'Clique em "Criar tarefa via Djow" — a tarefa vai direto para o ClickUp/provider configurado.'
    };
    const tip = tipMap[stepId] || '';
    if (!tip) return '';
    return `<div class="rounded-xl bg-indigo-500/15 border border-indigo-400/30 p-2.5 text-[11px] text-indigo-100"><b class="text-indigo-200">Dica:</b> ${Utils.escape(tip)}</div>`;
  },

  _djowStepHints(stepId) {
    const hintsByStep = {
      vision:     ['Como criar uma visão poderosa?', 'Exemplos de visão de produto', 'Visão muito longa, como encurtar?'],
      objectives: ['Sugestões de objetivos para meu produto', 'Quantos objetivos é o ideal?', 'Diferença entre objetivo e OKR'],
      okrs:       ['Exemplo de OKR para aquisição', 'Como escolher a métrica certa?', 'Meta ambiciosa vs realista'],
      operations: ['Posso conectar uma ação a múltiplos OKRs?', 'Como saber se uma ação serve este OKR?', 'Não tenho ações ainda'],
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
