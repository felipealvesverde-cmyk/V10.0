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
    return `<div id="strategicMapScrollContainer" class="fixed inset-0 z-[80] bg-slate-950/85 backdrop-blur-sm p-4 overflow-auto grid place-items-start justify-items-center">
      <div class="rounded-[2rem] overflow-hidden shadow-2xl text-white" style="width:92vw;max-width:1400px;background: radial-gradient(circle at 18% 8%, rgba(99,102,241,.25), transparent 32%), radial-gradient(circle at 82% 0%, rgba(34,197,94,.15), transparent 32%), #071326;">
        ${this._header(product)}
        ${showOnboarding ? this._onboarding(product) : this._body(product)}
      </div>
      ${window.QuickActionModal ? QuickActionModal.render() : ''}
      ${window.StrategicOverviewModal ? StrategicOverviewModal.render() : ''}
      ${App.state.strategicHandoffPopup ? this._handoffPopup() : ''}
      ${App.state.strategicCampaignPrompt ? this._strategicCampaignPromptModal() : ''}
    </div>`;
  },

  // V28.4.1 — Popup pra nomear/vincular a campanha estratégica antes da 1ª ativação.
  _strategicCampaignPromptModal() {
    const prompt = App.state.strategicCampaignPrompt || {};
    const productId = prompt.productId;
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    const productName = product?.name || 'Produto';
    // Lista campanhas existentes do produto que NÃO são guarda-chuva estratégica
    // (pra opção de vincular a uma existente).
    const existingCampaigns = (App.state.campaigns || []).filter(c =>
      Number(c.productId) === Number(productId) && !c.isStrategicHost
    );
    const newName = String(prompt.newName || '').trim();
    const placeholder = `Plano Comercial 2026 — ${productName}`;
    return `<div class="fixed inset-0 z-[95] bg-slate-950/90 backdrop-blur-sm p-4 grid place-items-center overflow-auto">
      <div class="rounded-3xl shadow-2xl text-white max-w-xl w-full" style="background:radial-gradient(circle at 0% 0%, rgba(34,197,94,.22), transparent 40%), #0b1428;">
        <div class="p-6 space-y-4">
          <div>
            <div class="flex items-center gap-2 mb-1.5"><i data-lucide="folder-plus" class="w-4 h-4 text-emerald-300"></i><p class="text-[11px] font-black text-emerald-200 uppercase tracking-wider">Antes de ativar a ação</p></div>
            <h3 class="text-xl font-black leading-tight">Qual o nome da campanha estratégica deste produto?</h3>
            <p class="text-[12px] text-slate-300 mt-1.5 leading-relaxed">Toda ação que você ativar no Mapa vai pra dentro desta campanha — assim ela aparece organizada no menu <b>Campanhas</b>, com nome próprio. Você só precisa fazer isso 1 vez por produto.</p>
          </div>

          <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-3 space-y-2">
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Criar uma nova</label>
            <input value="${Utils.escape(newName)}" oninput="Actions.updateStrategicCampaignDraft('newName', this.value)" placeholder="${Utils.escape(placeholder)}" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-bold placeholder:text-slate-500" />
            <button onclick="Actions.confirmStrategicCampaign('new')" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black flex items-center justify-center gap-1.5" style="color:#fff!important;"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Criar e usar essa</button>
          </div>

          ${existingCampaigns.length ? `<div class="text-center text-[10px] text-slate-500 font-bold">────────── ou ──────────</div>
          <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-3 space-y-2">
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Vincular a uma campanha existente do produto</label>
            <select onchange="Actions.updateStrategicCampaignDraft('existingCampaignId', this.value)" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-bold" style="color-scheme:dark;">
              <option value="">— escolha uma campanha —</option>
              ${existingCampaigns.map(c => `<option value="${c.id}" ${String(prompt.existingCampaignId) === String(c.id) ? 'selected' : ''}>${Utils.escape(c.name)}</option>`).join('')}
            </select>
            <button onclick="Actions.confirmStrategicCampaign('existing')" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-xs font-black flex items-center justify-center gap-1.5" style="color:#fff!important;"><i data-lucide="link" class="w-3.5 h-3.5"></i> Vincular ao existente</button>
          </div>` : ''}

          <div class="flex justify-end pt-1">
            <button onclick="Actions.dismissStrategicCampaignPrompt()" class="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 text-xs font-black">Cancelar</button>
          </div>
        </div>
      </div>
    </div>`;
  },

  // V28.3.1 — Popup didático do passe do bastão (estratégico → tático).
  // Aparece quando o CEO confirma o último número das 3 frentes. Explica POR QUE
  // a metodologia separa quem decide o QUÊ de quem decide o COMO, sem citar Doerr.
  _handoffPopup() {
    return `<div class="fixed inset-0 z-[95] bg-slate-950/90 backdrop-blur-sm p-4 grid place-items-center overflow-auto">
      <div class="rounded-3xl shadow-2xl text-white max-w-2xl w-full" style="background:radial-gradient(circle at 0% 0%, rgba(139,92,246,.28), transparent 35%), radial-gradient(circle at 100% 100%, rgba(34,197,94,.22), transparent 35%), #0b1428;">
        <div class="p-6 lg:p-7 space-y-5">
          <div>
            <div class="flex items-center gap-2 mb-2"><span class="text-emerald-300 text-lg font-black">✓</span><p class="text-[11px] font-black text-emerald-200 uppercase tracking-wider">Parte estratégica concluída</p></div>
            <h2 class="text-2xl lg:text-3xl font-black leading-tight">Hora de passar o bastão pro tático.</h2>
            <p class="text-sm text-slate-300 mt-2 leading-relaxed">Você terminou o papel de CEO neste Mapa: definiu o objetivo do produto, escolheu as 3 frentes do funil e setou os números que cada uma precisa entregar nos próximos 90 dias.</p>
          </div>

          <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
            <p class="text-[11px] font-black text-violet-200 uppercase tracking-wider mb-2">Por que estratégico e tático andam separados?</p>
            <p class="text-[13px] text-slate-200 leading-relaxed mb-3">Quem decide <b class="text-white">o quê</b> precisa acontecer é, quase sempre, uma cabeça diferente de quem decide <b class="text-white">como</b> fazer acontecer. Essa separação não é detalhe — é o que faz o sistema funcionar.</p>
            <ul class="space-y-2 text-[12px] text-slate-300">
              <li class="flex items-start gap-2"><span class="text-violet-300 shrink-0">▸</span><span><b class="text-violet-200">Estratégico</b> olha o tabuleiro inteiro. Pensa em quanto alocar, em que aposta priorizar, em quem ganha e quem perde recurso. Precisa visão larga e distanciamento da operação.</span></li>
              <li class="flex items-start gap-2"><span class="text-emerald-300 shrink-0">▸</span><span><b class="text-emerald-200">Tático</b> mergulha na disciplina. Conhece o canal a fundo, sabe o que funciona em campanha de mídia paga, sabe negociar com cliente difícil, sabe atender um detrator e devolver promotor. Precisa profundidade vertical.</span></li>
            </ul>
            <p class="text-[12px] text-slate-400 italic mt-3">Quando a mesma pessoa faz os dois ao mesmo tempo sem trocar de chapéu, ou a estratégia perde contato com a realidade do canal, ou a operação anda sem norte.</p>
          </div>

          <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
            <p class="text-[11px] font-black text-sky-200 uppercase tracking-wider mb-2">O que muda agora?</p>
            <div class="space-y-3 text-[13px] text-slate-200 leading-relaxed">
              <div>
                <p class="font-black text-white mb-0.5">Se sua empresa tem time formado:</p>
                <p>Este Mapa pode ser aberto pelos gestores de Marketing, Vendas e Sucesso do Cliente. Cada um vai na aba da frente dele e define a estratégia local: hipótese central, canais prioritários e as ações que vão mover cada número no dia-a-dia. Você (CEO) vira observador.</p>
              </div>
              <div>
                <p class="font-black text-white mb-0.5">Se você toca tudo sozinho:</p>
                <p>A separação acontece na sua cabeça. Você sai do chapéu de CEO e veste, um de cada vez, o do gestor de cada frente. Eu (Djow) fico do seu lado em cada aba, ajudando a montar a estratégia da área.</p>
              </div>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row gap-2 justify-end pt-2">
            <button onclick="Actions.dismissStrategicHandoffPopup(false)" class="px-4 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 text-sm font-black">Fechar e ficar aqui</button>
            <button onclick="Actions.dismissStrategicHandoffPopup(true)" class="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-black flex items-center justify-center gap-2" style="color:#fff!important;">Vamos pro Comercial tático <i data-lucide="arrow-right" class="w-4 h-4"></i></button>
          </div>
        </div>
      </div>
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
    // V29.0.0 — Dois modos: produto (CEO) ou campanha (gestor da branch).
    const mode = App.state.strategicMapMode || 'product';
    return `<div class="p-5 space-y-4">
      ${this._branchSwitcher(product, mode)}
      ${mode === 'product' ? this._productView(product) : this._campaignView(product)}
    </div>`;
  },

  // V29.0.0 — Switcher no topo: troca entre vista produto e branches (campanhas).
  _branchSwitcher(product, mode) {
    const branches = StrategicMapEngine.getBranchesByProduct ? StrategicMapEngine.getBranchesByProduct(product.id) : [];
    const activeCampaignId = App.state.strategicMapCampaignId;
    return `<div class="rounded-2xl bg-white/[0.05] border border-white/10 p-2.5 flex items-center gap-2 flex-wrap">
      <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider px-2">Vendo:</span>
      <button onclick="Actions.openStrategicMap(${product.id})" class="px-3 py-1.5 rounded-lg text-[11px] font-black ${mode === 'product' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'}" ${mode === 'product' ? 'style="color:#fff!important;"' : ''}>
        <i data-lucide="layout" class="w-3 h-3 inline-block mr-1"></i> Produto (CEO)
      </button>
      ${branches.map(b => {
        const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(b.campaignId));
        if (!campaign) return '';
        const isActive = mode === 'campaign' && Number(activeCampaignId) === Number(b.campaignId);
        return `<button onclick="Actions.switchStrategicBranch(${b.campaignId})" class="px-3 py-1.5 rounded-lg text-[11px] font-black ${isActive ? 'bg-violet-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'}" ${isActive ? 'style="color:#fff!important;"' : ''}>
          <i data-lucide="git-branch" class="w-3 h-3 inline-block mr-1"></i> ${Utils.escape(campaign.name)}
        </button>`;
      }).join('')}
    </div>`;
  },

  // V29.0.0 — Vista PRODUTO (CEO mode): Visão + KRs-mãe + branches + desplugadas.
  _productView(product) {
    const map = StrategicMapEngine.getForProduct(product.id);
    const vision = String(map?.vision || '').trim();
    const productKrs = StrategicMapEngine.getProductKrs ? StrategicMapEngine.getProductKrs(product.id) : [];
    const branches = StrategicMapEngine.getBranchesByProduct ? StrategicMapEngine.getBranchesByProduct(product.id) : [];
    const desplugadas = StrategicMapEngine.getDesplugedCampaigns ? StrategicMapEngine.getDesplugedCampaigns(product.id) : [];
    const orphans = StrategicMapEngine.getOrphanChildKrs ? StrategicMapEngine.getOrphanChildKrs(product.id) : [];
    return `<div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <div class="space-y-4 min-w-0">
        ${this._productVisionBlock(product, vision)}
        ${this._productKrsBlock(product, productKrs, orphans)}
        ${this._productBranchesBlock(product, branches, desplugadas)}
      </div>
      ${this._djowSide(product, 'product-overview')}
    </div>`;
  },

  _productVisionBlock(product, vision) {
    return `<section class="rounded-3xl bg-white/[0.05] border border-white/10 p-5">
      <div class="flex items-center gap-2 mb-2"><i data-lucide="star" class="w-4 h-4 text-violet-300"></i><p class="text-[11px] font-black text-violet-200 uppercase tracking-wider">Visão do Produto (única, compartilhada por todas as campanhas)</p></div>
      <textarea oninput="Actions.updateStrategicVision(this.value)" placeholder="Aonde esse produto chega nos próximos 12 meses?" class="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-white/15 text-white text-sm font-semibold min-h-[80px] placeholder:text-slate-500" style="color-scheme:dark;">${Utils.escape(vision)}</textarea>
    </section>`;
  },

  _productKrsBlock(product, productKrs, orphans) {
    const areas = StrategicMapEngine.COMERCIAL_AREAS || [];
    return `<section class="rounded-3xl bg-white/[0.05] border border-white/10 p-5 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2"><i data-lucide="target" class="w-4 h-4 text-emerald-300"></i><p class="text-[11px] font-black text-emerald-200 uppercase tracking-wider">KRs-Mãe (números que o produto inteiro precisa entregar)</p></div>
      </div>
      ${orphans.length ? `<div class="rounded-xl bg-amber-500/10 border border-amber-400/30 p-2.5 text-[11px] text-amber-200">⚠️ ${orphans.length} número(s) em branches sem KR-mãe correspondente. Crie a mãe pra ativar o rollup.</div>` : ''}
      ${productKrs.length === 0 ? '<p class="text-[12px] text-slate-400 italic">Nenhum KR-mãe criado ainda. Adicione pelo menos um pra começar o rollup.</p>' : ''}
      ${areas.map(area => {
        const areaKrs = productKrs.filter(k => k.area === area.id);
        const catalog = (StrategicMapEngine.KPI_CATALOG || {})[area.id] || [];
        const activatedIds = new Set(areaKrs.map(k => k.catalogId));
        const available = catalog.filter(c => !activatedIds.has(c.id));
        return `<div class="rounded-2xl bg-${area.color}-500/5 border border-${area.color}-400/20 p-3">
          <p class="text-[10px] font-black text-${area.color}-200 uppercase tracking-wider mb-2"><i data-lucide="${area.icon}" class="w-3 h-3 inline-block"></i> ${Utils.escape(area.label)}</p>
          ${areaKrs.length === 0 ? '<p class="text-[11px] text-slate-500 italic">Sem KRs-mãe nesta área.</p>' : '<div class="space-y-2">' + areaKrs.map(kr => this._productKrCard(product, kr, area.color)).join('') + '</div>'}
          ${available.length ? `<div class="mt-2 pt-2 border-t border-${area.color}-400/20">
            <p class="text-[9px] font-black text-${area.color}-300/70 uppercase mb-1">+ Adicionar KR-mãe do catálogo:</p>
            <div class="flex flex-wrap gap-1">${available.map(c => `<button onclick="Actions.addProductKrAction(${product.id}, '${area.id}', '${c.id}')" title="${Utils.escape(c.description)}" class="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-${area.color}-200 text-[10px] font-bold">+ ${Utils.escape(c.name)}</button>`).join('')}</div>
          </div>` : ''}
        </div>`;
      }).join('')}
    </section>`;
  },

  _productKrCard(product, kr, tone) {
    const rollup = StrategicMapEngine.rollupForProductKr ? StrategicMapEngine.rollupForProductKr(product.id, kr.id) : { current: 0, contributors: 0 };
    const target = Number(kr.targetCommitted || 0);
    const progress = target ? Math.round((rollup.current / target) * 100) : 0;
    const autoCreatedBadge = kr.createdBy === 'auto' ? '<span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-500/20 text-amber-200 border border-amber-400/30">CRIADO POR MKT — REVISE</span>' : '';
    return `<div class="rounded-xl bg-slate-900/40 border border-${tone}-400/20 p-2.5">
      <div class="flex items-start justify-between gap-2 mb-1.5">
        <div class="min-w-0 flex-1">
          <p class="font-black text-white text-[12px]">${Utils.escape(kr.name)} ${autoCreatedBadge}</p>
          <p class="text-[10px] text-slate-400 mt-0.5">Rollup: <b class="text-${tone}-200">${rollup.current}</b> / meta ${target || '—'} ${kr.metric || ''} · ${rollup.contributors} branch(es) contribuindo · ${progress}%</p>
        </div>
        <button onclick="Actions.removeProductKrAction(${product.id}, '${kr.id}')" title="Remover KR-mãe" class="px-1.5 py-0.5 rounded text-[10px] text-red-300 hover:bg-red-500/20 border border-red-400/30 shrink-0">×</button>
      </div>
      <div class="grid grid-cols-2 gap-1.5">
        <label class="flex flex-col gap-0.5">
          <span class="text-[9px] font-black text-emerald-300 uppercase">🔒 Meta Segura</span>
          <input type="number" value="${kr.targetCommitted ?? ''}" placeholder="piso" oninput="Actions.updateProductKrField(${product.id}, '${kr.id}', 'targetCommitted', this.value)" class="px-2 py-1 rounded bg-slate-900 border border-white/10 text-white text-[11px] font-bold" />
        </label>
        <label class="flex flex-col gap-0.5">
          <span class="text-[9px] font-black text-violet-300 uppercase">🚀 Meta Avançada</span>
          <input type="number" value="${kr.targetStretch ?? ''}" placeholder="sonho" oninput="Actions.updateProductKrField(${product.id}, '${kr.id}', 'targetStretch', this.value)" class="px-2 py-1 rounded bg-slate-900 border border-white/10 text-white text-[11px] font-bold" />
        </label>
      </div>
    </div>`;
  },

  _productBranchesBlock(product, branches, desplugadas) {
    return `<section class="rounded-3xl bg-white/[0.05] border border-white/10 p-5 space-y-3">
      <div class="flex items-center gap-2"><i data-lucide="git-branch" class="w-4 h-4 text-sky-300"></i><p class="text-[11px] font-black text-sky-200 uppercase tracking-wider">Branches (campanhas plugadas) — ${branches.length} ativa(s) · ${desplugadas.length} desplugada(s)</p></div>
      ${branches.length === 0 ? '<p class="text-[12px] text-slate-400 italic">Nenhuma campanha plugada ainda. Ative o Mapa numa campanha pra criar a 1ª branch.</p>' : '<div class="space-y-2">' + branches.map(b => {
        const c = (App.state.campaigns || []).find(c => Number(c.id) === Number(b.campaignId));
        if (!c) return '';
        const status = StrategicMapEngine.getCampaignStrategicStatus(b.campaignId);
        const statusInfo = { active: { color: 'violet', label: 'Ativa' }, configuring: { color: 'amber', label: 'Em configuração' }, unplugged: { color: 'red', label: 'Desplugada' } }[status] || {};
        return `<div class="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-900/40 border border-white/10">
          <div class="min-w-0"><p class="font-black text-white text-[12px] truncate">${Utils.escape(c.name)}</p><p class="text-[10px] text-${statusInfo.color}-300">● ${statusInfo.label}</p></div>
          <button onclick="Actions.openStrategicMapForCampaign(${b.campaignId})" class="px-2.5 py-1 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-[10px] font-black shrink-0" style="color:#fff!important;">Abrir</button>
        </div>`;
      }).join('') + '</div>'}
      ${desplugadas.length ? `<div class="pt-2 border-t border-white/10">
        <p class="text-[10px] font-black text-red-300 uppercase mb-1">⚠️ Campanhas desplugadas (não alimentam o Mapa):</p>
        <div class="space-y-1">${desplugadas.map(c => `<div class="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-400/30">
          <span class="text-[11px] text-white truncate">${Utils.escape(c.name)}</span>
          <button onclick="Actions.activateStrategicMapForCampaign(${c.id})" class="px-2 py-0.5 rounded text-[10px] font-black bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 shrink-0">Ativar Mapa</button>
        </div>`).join('')}</div>
      </div>` : ''}
    </section>`;
  },

  _campaignView(product) {
    const stepId = StrategicZoomNavigation.current();
    return `<div class="space-y-4">
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

      ${this._handoffNav(product)}

      <div class="space-y-3">
        ${this._activeAreaObjective(product, objectives) ? this._okrsObjectiveCard(product, this._activeAreaObjective(product, objectives)) : '<p class="text-[11px] text-slate-500 italic">Selecione uma frente acima.</p>'}
      </div>
      ${this._stepCta('Próximo passo: conectar à operação', totalOkrs > 0)}
    </section>`;
  },

  // V28.2.3 — Determina qual área está ativa (state user OU próxima a confirmar OU marketing).
  _activeAreaId(productId) {
    const stored = App.state.strategicActiveArea;
    const valid = (StrategicMapEngine.COMERCIAL_AREAS || []).some(a => a.id === stored);
    if (valid) return stored;
    const next = StrategicMapEngine.nextUnconfirmedKr ? StrategicMapEngine.nextUnconfirmedKr(productId) : null;
    return next?.areaId || 'marketing';
  },

  _activeAreaObjective(product, objectives) {
    const areaId = this._activeAreaId(product.id);
    return objectives.find(o => o.area === areaId);
  },

  // V28.2.3 — Banner do handoff agora é navegação (3 abas clicáveis).
  // Substitui o _handoffBanner estático: cada frente vira tab, ativa fica destacada.
  _handoffNav(product) {
    const activeId = this._activeAreaId(product.id);
    const areas = StrategicMapEngine.COMERCIAL_AREAS || [];
    const handoffArrows = ['→', '→', '↩'];
    return `<div class="rounded-2xl bg-gradient-to-r from-sky-500/10 via-emerald-500/10 to-violet-500/10 border border-white/10 p-2">
      <div class="grid grid-cols-3 gap-2">
        ${areas.map((area, i) => {
          const isActive = activeId === area.id;
          const objective = (StrategicMapEngine.getObjectiveByArea ? StrategicMapEngine.getObjectiveByArea(product.id, area.id) : null);
          const okrs = objective?.okrs || [];
          const confirmedCount = okrs.filter(k => k.confirmed).length;
          const totalCount = okrs.length;
          const stateLabel = !totalCount ? 'sem números ainda' : `${confirmedCount}/${totalCount} confirmado${confirmedCount === 1 ? '' : 's'}`;
          const baseCls = isActive
            ? `bg-${area.color}-500/20 border-${area.color}-400/60 ring-2 ring-${area.color}-400/40`
            : `bg-white/[0.03] border-white/10 hover:bg-white/[0.07]`;
          return `<button onclick="Actions.setStrategicActiveArea('${area.id}')" class="text-left p-2.5 rounded-xl border ${baseCls} transition flex flex-col items-center gap-1 cursor-pointer">
            <div class="w-7 h-7 rounded-full bg-${area.color}-500/30 grid place-items-center"><i data-lucide="${area.icon}" class="w-3.5 h-3.5 text-${area.color}-200"></i></div>
            <p class="font-black text-${area.color}-${isActive ? '100' : '200'} text-[12px]">${Utils.escape(area.label)}</p>
            <p class="text-[10px] text-slate-400">${area.id === 'cs' ? 'devolve <b>advogados</b>' : (area.id === 'marketing' ? 'entrega <b>leads</b>' : 'entrega <b>clientes</b>')} ${handoffArrows[i]}</p>
            <p class="text-[10px] ${isActive ? `text-${area.color}-200` : 'text-slate-500'} font-bold mt-0.5">${stateLabel}</p>
          </button>`;
        }).join('')}
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
    // V28.2.3 — Período Tático = 90d default + alternativas (30/60) com aviso do Djow.
    const currentPeriod = Number(kr.period) || 90;
    const warning = App.state.strategicPeriodWarning;
    const isWarningHere = warning && warning.krId === kr.id;

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
        <p class="text-[9px] font-black text-slate-500 uppercase mb-1">Período Tático</p>
        <div class="flex flex-wrap gap-1.5 items-center">
          <button onclick="Actions.tryChangeStrategicPeriod('${obj.id}','${kr.id}', 90)" class="px-3 py-1.5 rounded-lg border text-[11px] font-bold ${currentPeriod === 90 ? `bg-${tone}-500/30 border-${tone}-400/60 text-white` : 'bg-slate-900 border-white/15 text-slate-300 hover:bg-slate-800'}">90 dias — próximo trimestre</button>
          <span class="text-[10px] text-slate-500">ou</span>
          <button onclick="Actions.tryChangeStrategicPeriod('${obj.id}','${kr.id}', 30)" class="px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${currentPeriod === 30 ? `bg-${tone}-500/30 border-${tone}-400/60 text-white` : 'bg-slate-900 border-white/15 text-slate-400 hover:bg-slate-800'}">30 dias</button>
          <button onclick="Actions.tryChangeStrategicPeriod('${obj.id}','${kr.id}', 60)" class="px-2.5 py-1.5 rounded-lg border text-[11px] font-bold ${currentPeriod === 60 ? `bg-${tone}-500/30 border-${tone}-400/60 text-white` : 'bg-slate-900 border-white/15 text-slate-400 hover:bg-slate-800'}">60 dias</button>
        </div>
        <p class="text-[11px] text-slate-400 mt-2 leading-relaxed">💡 <b class="text-slate-200">Por que 90 dias?</b> Em um trimestre você vê resultado real (não só promessa), e ainda dá tempo de corrigir rota antes de gastar o ano inteiro num caminho errado. No fim do período, você decide: manter, ajustar ou trocar o número.</p>
        ${isWarningHere ? this._djowPeriodWarning(obj, kr, warning.attemptedDays) : ''}
      </div>

      <div class="flex justify-between items-center pt-2 border-t border-white/10">
        <button onclick="Actions.removeStrategicOkr('${obj.id}','${kr.id}')" class="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-400/30 text-red-300 text-[10px] font-black">Remover</button>
        <button onclick="Actions.confirmStrategicNumero('${obj.id}','${kr.id}')" ${complete ? '' : 'disabled'} class="px-3 py-1.5 rounded-lg ${complete ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'} text-[11px] font-black" ${complete ? 'style="color:#fff!important;"' : ''}>✓ Confirmar número →</button>
      </div>
    </div>`;
  },

  _periodLabel(days) {
    // V28.2.2 — Periodo Tatico = 90d. Outros valores ficam como fallback pra dados legados.
    const map = { 7: '7 dias', 15: '15 dias', 30: '30 dias', 60: '60 dias', 90: '90 dias (1 trimestre)', 180: '6 meses' };
    return map[Number(days)] || (days ? `${days} dias` : 'sem período');
  },

  // V28.2.3 — Balão do Djow quando user tenta mudar pra 30 ou 60 dias.
  // Conciso, pragmático, Doerr-aligned sem nominar Doerr.
  _djowPeriodWarning(obj, kr, attemptedDays) {
    const texts = {
      30: `<b class="text-amber-200">30 dias é tempo de sprint, não de medir uma frente comercial.</b> Você vê movimento, mas não sabe se sustenta — pode ser sorte de uma semana. E te força a parar todo mês pra revisar com pouco dado, o que cansa o time e gera ajuste em cima de ruído.<br><br><b class="text-slate-200">Sugestão:</b> deixa em 90. Se você bater a meta antes, ganha tempo de sobra pro próximo ciclo.`,
      60: `<b class="text-amber-200">60 dias é o pior dos mundos.</b> Curto demais pra você ter certeza (dados ainda voláteis), e longo demais pra ser sprint operacional. Você chega ao fim do período ainda em dúvida se o número realmente move.<br><br><b class="text-slate-200">Sugestão:</b> os 30 dias extras do trimestre eliminam essa zona cinzenta — você sai do "parece que funciona" pro "tenho certeza".`
    };
    const txt = texts[attemptedDays] || texts[30];
    return `<div class="mt-3 rounded-2xl bg-amber-500/[0.08] border border-amber-400/40 p-3">
      <div class="flex items-start gap-2 mb-2">
        <div class="w-7 h-7 rounded-full bg-violet-500/30 grid place-items-center shrink-0"><i data-lucide="sparkles" class="w-3.5 h-3.5 text-violet-200"></i></div>
        <div class="min-w-0">
          <p class="text-[10px] font-black text-violet-200 uppercase tracking-wider">Djow alerta</p>
          <p class="text-[11px] text-slate-200 leading-relaxed mt-1">${txt}</p>
        </div>
      </div>
      <div class="flex justify-end gap-1.5 mt-2">
        <button onclick="Actions.confirmStrategicPeriodChange('${obj.id}','${kr.id}')" class="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 text-[10px] font-black">Sei o que faço · manter ${attemptedDays} dias</button>
        <button onclick="Actions.dismissStrategicPeriodWarning('${obj.id}','${kr.id}')" class="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black" style="color:#fff!important;">✓ Voltar pra 90 dias</button>
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

  // -------------------- STEP 4: AS AÇÕES --------------------
  // V28.3.0 — Mesmo padrão didático das etapas anteriores: tabs Mkt/Vendas/CS,
  // catálogo curado de ações típicas por segmento, vínculo automático aos
  // números pelo catalogId, edição inline (dono/cadência/status), aviso de
  // número órfão (sem ação).
  _stepOperations(product) {
    const map = StrategicMapEngine.getForProduct(product.id);
    const objectives = map.objectives || [];
    const confirmedKrs = objectives.flatMap(o => (o.okrs || []).filter(k => k.confirmed).map(kr => ({ obj: o, kr })));
    if (!confirmedKrs.length) {
      return `<section class="space-y-3">
        ${this._stepIntro('As ações', 'Confirme números na etapa anterior antes de plugar ações.', 'plug')}
        <div class="rounded-3xl bg-amber-500/10 border border-amber-400/30 p-5 text-amber-200">
          <p class="font-black mb-1">Faltam números confirmados.</p>
          <p class="text-sm">Volte pra etapa <b>Os números</b> e confirme pelo menos um — número sem ação é promessa, ação sem número é trabalho à toa.</p>
          <button onclick="Actions.setStrategicZoom('okrs')" class="mt-3 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-black">← Voltar pros Números</button>
        </div>
      </section>`;
    }
    const allConnected = confirmedKrs.every(({ kr }) => (kr.connectedActionIds || []).length > 0);
    return `<section class="space-y-3">
      ${this._stepIntro(
        'Que ações vão mover cada número?',
        'Pra cada frente, ative as ações que entregam os números. Número sem ação não mexe sozinho.',
        'plug',
        'operations',
        'operations-acao-numero',
        'Ação é o que move o número no dia-a-dia. Cada ação ativada do catálogo já é vinculada automaticamente aos números que ela costuma mover. Se um número confirmado fica sem ação vinculada, ele aparece com aviso — porque ninguém vai movê-lo.'
      )}

      ${this._strategicCampaignHeader(product)}

      ${this._handoffNav(product)}

      ${this._areaAcoesSection(product)}

      ${this._stepCta('Próximo passo: colocar em campo', allConnected)}
    </section>`;
  },

  // V28.4.1 — Header mostrando a campanha estratégica vinculada (com botão renomear).
  // V28.4.4 — Adicionado contador de ações órfãs (sem objetivo vinculado).
  _strategicCampaignHeader(product) {
    if (!window.StrategicMapEngine?.getStrategicCampaign) return '';
    const campaign = StrategicMapEngine.getStrategicCampaign(product.id);
    if (!campaign) {
      return `<div class="rounded-2xl bg-amber-500/10 border border-amber-400/30 px-3 py-2.5 text-[11px] text-amber-200 flex items-center gap-2">
        <i data-lucide="folder-plus" class="w-3.5 h-3.5 shrink-0"></i>
        <span>Sua campanha estratégica ainda não tem nome — vai pedir quando você ativar a primeira ação.</span>
      </div>`;
    }
    // Conta ações órfãs (sem KR vinculado) e ações totais da campanha.
    const campaignActions = (App.state.actions || []).filter(a => Number(a.campaignId) === Number(campaign.id));
    const map = StrategicMapEngine.getForProduct(product.id);
    const allKrs = (map?.objectives || []).flatMap(o => o.okrs || []);
    const linkedActionIds = new Set(allKrs.flatMap(kr => (kr.connectedActionIds || []).map(Number)));
    const orphanCount = campaignActions.filter(a => !linkedActionIds.has(Number(a.id))).length;
    const totalCount = campaignActions.length;

    return `<div class="rounded-2xl bg-emerald-500/10 border border-emerald-400/30 p-3 flex items-center justify-between gap-2 flex-wrap">
      <div class="flex items-center gap-2 min-w-0 flex-1">
        <i data-lucide="folder-check" class="w-4 h-4 text-emerald-300 shrink-0"></i>
        <div class="min-w-0">
          <p class="text-[10px] font-black text-emerald-200 uppercase tracking-wider">Campanha estratégica deste produto</p>
          <p class="text-sm font-black text-white truncate">${Utils.escape(campaign.name)}</p>
          ${totalCount > 0 ? `<p class="text-[11px] mt-0.5 ${orphanCount > 0 ? 'text-amber-200' : 'text-emerald-200'}">${orphanCount > 0 ? `⚠️ ${orphanCount} de ${totalCount} ação(ões) sem objetivo vinculado` : `✓ Todas as ${totalCount} ações estão vinculadas a algum objetivo`}</p>` : ''}
        </div>
      </div>
      <button onclick="(function(){const n=prompt('Renomear campanha:', ${JSON.stringify(campaign.name).replace(/"/g, '&quot;')}); if(n) Actions.renameStrategicCampaignAction(n);})()" class="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 text-[10px] font-black flex items-center gap-1 shrink-0"><i data-lucide="edit-2" class="w-3 h-3"></i> Renomear</button>
    </div>`;
  },

  // V28.3.0 — Painel da frente ativa: números confirmados como cabeçalho,
  // alerta de KRs órfãos, ações já ativadas (cards editáveis), catálogo de
  // ações disponíveis.
  _areaAcoesSection(product) {
    const areaId = this._activeAreaId(product.id);
    const area = (StrategicMapEngine.COMERCIAL_AREAS || []).find(a => a.id === areaId);
    if (!area) return '';
    const objective = StrategicMapEngine.getObjectiveByArea(product.id, areaId);
    const confirmedKrs = (objective?.okrs || []).filter(k => k.confirmed);
    const activeActions = StrategicMapEngine.getStrategicActionsByArea(product.id, areaId);
    const activatedTemplateIds = StrategicMapEngine.getActivatedCatalogActionIds(product.id, areaId);
    const orphanKrs = StrategicMapEngine.getKrsWithoutActions(product.id, areaId);
    const tone = area.color;

    return `<div class="rounded-3xl bg-white/[0.05] border border-${tone}-400/30 p-4 space-y-3">
      <div class="flex items-start gap-3">
        <div class="w-9 h-9 rounded-xl bg-${tone}-500/20 grid place-items-center shrink-0"><i data-lucide="${area.icon}" class="w-4 h-4 text-${tone}-200"></i></div>
        <div class="min-w-0">
          <p class="font-black text-white">${Utils.escape(area.label)}</p>
          <p class="text-[11px] text-slate-400 mt-0.5">${confirmedKrs.length} número(s) confirmado(s) · ${activeActions.length} ação(ões) ativa(s)</p>
        </div>
      </div>

      ${confirmedKrs.length ? `<div class="rounded-xl bg-slate-900/40 border border-white/10 p-2.5">
        <p class="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Números confirmados desta frente:</p>
        <div class="flex flex-wrap gap-1.5">
          ${confirmedKrs.map(kr => {
            const acoesQueMovem = activeActions.filter(a => (kr.connectedActionIds || []).map(Number).includes(Number(a.id))).length;
            const orphan = acoesQueMovem === 0;
            return `<span class="px-2 py-1 rounded-lg text-[10px] font-bold ${orphan ? 'bg-amber-500/15 border border-amber-400/40 text-amber-200' : `bg-${tone}-500/15 border border-${tone}-400/30 text-${tone}-200`}" title="${acoesQueMovem} ação(ões) movem este número">${kr.isHandoff ? '🔁 ' : ''}${Utils.escape(kr.name)} · ${acoesQueMovem} ${acoesQueMovem === 1 ? 'ação' : 'ações'}</span>`;
          }).join('')}
        </div>
      </div>` : ''}

      ${orphanKrs.length ? `<div class="rounded-xl bg-amber-500/10 border border-amber-400/40 p-2.5 text-[11px] text-amber-100">
        ⚠️ <b>${orphanKrs.length} número${orphanKrs.length === 1 ? '' : 's'} sem ação vinculada</b> — ${orphanKrs.length === 1 ? 'ele não vai' : 'eles não vão'} se mover sozinho${orphanKrs.length === 1 ? '' : 's'}. Ative pelo menos uma ação abaixo.
      </div>` : ''}

      <div class="space-y-2">
        ${activeActions.length ? activeActions.map(a => this._acaoCard(product, area, a)).join('') : '<p class="text-[11px] text-slate-500 italic">Nenhuma ação ativa nesta frente. Ative do catálogo abaixo.</p>'}
      </div>

      ${this._actionCatalogStrip(product, area, activatedTemplateIds)}
    </div>`;
  },

  // V28.3.0 — Strip de ações do catálogo ainda não ativadas.
  _actionCatalogStrip(product, area, activatedTemplateIds) {
    const catalog = (StrategicMapEngine.STRATEGIC_ACTION_CATALOG || {})[area.id] || [];
    const available = catalog.filter(t => !activatedTemplateIds.has(t.id));
    if (!available.length) {
      return `<div class="rounded-xl bg-${area.color}-500/5 border border-${area.color}-400/20 p-2.5 text-[11px] text-${area.color}-200 italic">Todas as ações típicas de ${Utils.escape(area.label)} já estão ativas.</div>`;
    }
    const kpiCatalog = (StrategicMapEngine.KPI_CATALOG || {})[area.id] || [];
    return `<div class="rounded-xl bg-${area.color}-500/5 border border-${area.color}-400/20 p-3">
      <p class="text-[10px] font-black text-${area.color}-200 uppercase tracking-wider mb-2">Ações típicas de ${Utils.escape(area.label)} — clique pra ativar</p>
      <div class="grid sm:grid-cols-2 gap-1.5">
        ${available.map(t => {
          const moves = (t.kpiIds || []).map(id => (kpiCatalog.find(k => k.id === id) || {}).name).filter(Boolean);
          return `<button onclick="Actions.activateStrategicCatalogAction('${area.id}', '${t.id}')" title="${Utils.escape(t.description)}" class="text-left px-2.5 py-2 rounded-lg bg-slate-900/60 hover:bg-slate-800 border border-white/10 text-white text-[11px] font-bold flex items-start gap-1.5">
            <i data-lucide="plus" class="w-3 h-3 text-${area.color}-300 shrink-0 mt-px"></i>
            <span class="min-w-0">
              ${Utils.escape(t.name)}
              <span class="block text-[10px] text-slate-400 font-normal mt-0.5">${Utils.escape(t.description)}</span>
              ${moves.length ? `<span class="block text-[10px] text-${area.color}-200 font-bold mt-1">Move: ${moves.map(m => Utils.escape(m)).join(' · ')}</span>` : ''}
            </span>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  },

  // V28.3.0 — Card de uma ação ativa. Sigue padrão do _numeroCard:
  // confirmed = collapsed verde; senão = inputs inline + chips cadência + status.
  _acaoCard(product, area, action) {
    const tone = area.color;
    const linkedKrs = this._krsLinkedToAction(product.id, area.id, action.id);
    const linkedNames = linkedKrs.map(k => k.name);
    const cadences = StrategicMapEngine.STRATEGIC_ACTION_CADENCES || [];
    const statuses = StrategicMapEngine.STRATEGIC_ACTION_STATUSES || [];
    const status = (statuses.find(s => s.id === action.strategicStatus) || statuses[0] || { id: 'planned', label: 'Planejada', color: 'slate' });
    const desc = action.strategicDescription ? `<p class="text-[10px] text-slate-400 italic mb-2">${Utils.escape(action.strategicDescription)}</p>` : '';
    const ownerSet = Boolean(String(action.strategicOwner || '').trim());
    const cadenceSet = Boolean(action.strategicCadence);
    const complete = ownerSet && cadenceSet;

    if (action.strategicConfirmed) {
      const cadenceLabel = (cadences.find(c => c.id === action.strategicCadence) || {}).label || '—';
      return `<div class="rounded-2xl bg-emerald-500/[0.05] border border-emerald-400/30 p-3">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap mb-1">
              <span class="text-emerald-300 font-black">✓</span>
              <p class="font-black text-white text-sm">${Utils.escape(action.name)}</p>
              <span class="px-1.5 py-0.5 rounded text-[9px] font-black bg-${status.color}-500/20 text-${status.color}-200 border border-${status.color}-400/30">${status.label.toUpperCase()}</span>
            </div>
            <p class="text-[11px] text-slate-300">Dono <b class="text-white">${Utils.escape(action.strategicOwner || '—')}</b> · Cadência <b class="text-white">${Utils.escape(cadenceLabel)}</b>${linkedNames.length ? ` · Move <b class="text-${tone}-200">${linkedNames.map(n => Utils.escape(n)).join(', ')}</b>` : ''}</p>
          </div>
        </div>
        <div class="flex justify-end gap-1 mt-2">
          <button onclick="Actions.editStrategicAcao(${action.id})" class="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 text-[10px] font-black">Editar</button>
          <button onclick="Actions.removeStrategicCatalogAction(${action.id})" class="px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-400/30 text-red-300 text-[10px] font-black">Remover</button>
        </div>
      </div>`;
    }

    return `<div class="rounded-2xl bg-black/30 border border-${tone}-400/20 p-3">
      <div class="flex items-start justify-between gap-2 mb-2">
        <div class="min-w-0 flex-1">
          <p class="font-black text-white text-sm mb-0.5">${Utils.escape(action.name)}</p>
          ${desc}
          ${linkedNames.length ? `<p class="text-[10px] text-${tone}-200 font-bold">🔗 Move: ${linkedNames.map(n => Utils.escape(n)).join(' · ')}</p>` : `<p class="text-[10px] text-amber-300 font-bold">⚠️ Nenhum número confirmado dessa frente é movido por essa ação — ative os números primeiro.</p>`}
        </div>
      </div>

      <div class="grid grid-cols-1 gap-2 mb-2">
        <label class="flex flex-col gap-0.5">
          <span class="text-[9px] font-black text-slate-500 uppercase">Dono</span>
          <input value="${Utils.escape(action.strategicOwner || '')}" oninput="Actions.updateStrategicActionField(${action.id}, 'strategicOwner', this.value)" placeholder="Quem executa essa ação?" class="px-2 py-1.5 rounded-lg bg-slate-900 border ${ownerSet ? `border-${tone}-400/40` : 'border-white/10'} text-white text-[12px] font-bold w-full placeholder:text-slate-600" />
        </label>
      </div>

      <div class="mb-2">
        <p class="text-[9px] font-black text-slate-500 uppercase mb-1">Cadência</p>
        <div class="flex flex-wrap gap-1.5">
          ${cadences.map(c => `<button onclick="Actions.updateStrategicActionField(${action.id}, 'strategicCadence', '${c.id}')" class="px-2.5 py-1 rounded-lg border text-[11px] font-bold ${action.strategicCadence === c.id ? `bg-${tone}-500/30 border-${tone}-400/60 text-white` : 'bg-slate-900 border-white/15 text-slate-300 hover:bg-slate-800'}">${c.label}</button>`).join('')}
        </div>
      </div>

      <div class="mb-2">
        <p class="text-[9px] font-black text-slate-500 uppercase mb-1">Status</p>
        <div class="flex flex-wrap gap-1.5">
          ${statuses.map(s => `<button onclick="Actions.updateStrategicActionField(${action.id}, 'strategicStatus', '${s.id}')" class="px-2.5 py-1 rounded-lg border text-[11px] font-bold ${action.strategicStatus === s.id ? `bg-${s.color}-500/30 border-${s.color}-400/60 text-white` : 'bg-slate-900 border-white/15 text-slate-300 hover:bg-slate-800'}">${s.label}</button>`).join('')}
        </div>
      </div>

      <div class="flex justify-between items-center pt-2 border-t border-white/10">
        <button onclick="Actions.removeStrategicCatalogAction(${action.id})" class="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-400/30 text-red-300 text-[10px] font-black">Remover</button>
        <button onclick="Actions.confirmStrategicAcao(${action.id})" ${complete ? '' : 'disabled'} class="px-3 py-1.5 rounded-lg ${complete ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-slate-700 text-slate-500 cursor-not-allowed'} text-[11px] font-black" ${complete ? 'style="color:#fff!important;"' : ''}>✓ Confirmar ação →</button>
      </div>
    </div>`;
  },

  _krsLinkedToAction(productId, areaId, actionId) {
    const obj = StrategicMapEngine.getObjectiveByArea(productId, areaId);
    if (!obj) return [];
    return (obj.okrs || []).filter(kr => (kr.connectedActionIds || []).map(Number).includes(Number(actionId)));
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
