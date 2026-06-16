var ActionModule = {
  render() {
    const selectedCampaign = App.getSelectedCampaign();
    if (!selectedCampaign) return this.emptyActionsState();
    const actions = App.state.actions.filter(action => Number(action.campaignId) === Number(selectedCampaign.id));
    const product = App.state.products.find(p => Number(p.id) === Number(selectedCampaign.productId));
    return `<div class="space-y-4">
      ${this.actionLayer(selectedCampaign, product, actions)}
      <div class="grid lg:grid-cols-3 gap-4"><div class="lg:col-span-1 bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><h2 class="text-xl font-black mb-1">Criar ação</h2><p class="text-sm text-slate-500 mb-4">Defina contexto operacional, origem, destino e base de leads.</p>${this._createTabs()}${App.state.actionCreateTab === 'ai' ? this._aiCreatePanel() : this._manualCreatePanel()}</div><div class="lg:col-span-2 bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><div class="flex items-start justify-between gap-3 mb-3"><div><h2 class="text-xl font-black mb-1">Ações plugadas</h2><p class="text-sm text-slate-500">Cada ação possui canal, KPIs, fluxo transversal, leads, score, conexão e resultado próprio.</p></div></div>${this._actionsListFilter(actions)}<div class="space-y-3">${this._filteredActionsList(actions)}</div></div></div>
      ${ActionFlowModal.render()}
      ${window.ActionEditModal ? ActionEditModal.render() : ''}
      ${/* V32.4.1 (Geraldo Item 1) — DjowModal V16.3 aposentado. DjowAIModal global cobre. */ ''}
      ${/* V37.0.8 — ActionLpModal removido (era vestigial pré-Tracking V33). */ ''}
      ${/* V38.1.53 — ActionFlowBuilder migrou pra tab Plugins (módulo PluginsModule). */ ''}
      ${window.TasksModal ? TasksModal.render() : ''}
      ${window.StrategicMapModal ? StrategicMapModal.render() : ''}
    </div>`;
  },
  emptyActionsState() {
    return `<div class="space-y-4">
      ${this.actionLayer(null, null, [])}
      <div class="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 text-center">
        <h2 class="text-2xl font-black mb-2">Nenhuma campanha selecionada</h2>
        <p class="text-sm text-slate-500 mb-5">Para criar ações, siga o fluxo: produto → campanha → ação.</p>
        <div class="flex flex-col md:flex-row gap-2 justify-center">
          <button onclick="App.setTab('products')" class="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-900 font-black">Ir para Produtos</button>
          <button onclick="App.setTab('campaigns')" class="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black lj-dark-button" style="color:#fff!important;">Criar Campanha</button>
        </div>
      </div>
    </div>`;
  },


  actionLayer(selectedCampaign, product, actions = []) {
    const totalActions = actions.length;
    const leads = actions.reduce((sum, action) => sum + (action.leads?.length || 0), 0);
    const score = actions.length ? Math.round(actions.reduce((sum, action) => sum + Number(action.score || 0), 0) / actions.length) : 0;
    const flows = actions.map(action => FlowResolutionEngine.buildActionFlow(action));
    const converted = flows.reduce((sum, flow) => sum + Number(flow.converted || 0), 0);
    const conversion = leads ? Math.round((converted / leads) * 1000) / 10 : 0;
    // V33.0.0-alpha19 — Alinhado EXATAMENTE ao padrão Produtos + Campanhas:
    // h2 text-3xl font-black (sem md:text-4xl, sem tracking-tight), badge
    // sem bullet, paleta radial idêntica, darkMetric mesmo helper.
    return `<div class="bg-slate-950 text-white rounded-[2rem] p-5 shadow-sm overflow-hidden relative">
      <div class="absolute inset-0 opacity-60" style="background: radial-gradient(circle at 20% 10%, rgba(59,130,246,.20), transparent 28%), radial-gradient(circle at 80% 20%, rgba(16,185,129,.16), transparent 30%);"></div>
      <div class="relative z-10 grid lg:grid-cols-[1.2fr_1fr] gap-4 items-start">
        <div>
          <h2 class="text-3xl font-black">Ações da campanha</h2>
          <p class="text-xs text-slate-400 mt-2">Campanha: <b class="text-white">${Utils.escape(selectedCampaign?.name || 'nenhuma selecionada')}</b> • Produto: <b class="text-white">${Utils.escape(product?.name || 'não vinculado')}</b></p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          ${this.darkMetric('Ações', totalActions, 'plug')}
          ${this.darkMetric('Leads', leads, 'users')}
          ${this.darkMetric('Score médio', score, 'gauge')}
          ${this.darkMetric('Conversão', `${conversion}%`, 'arrow-right-left')}
        </div>
      </div>
    </div>`;
  },

  darkMetric(label, value, icon) { return `<div class="bg-white/10 border border-white/10 rounded-2xl p-4"><div class="flex items-center justify-between"><p class="text-xs font-black text-slate-300">${label}</p><i data-lucide="${icon}" class="w-4 h-4 text-slate-300"></i></div><div class="text-3xl font-black mt-2">${value}</div></div>`; },

  _createTabs() {
    const tab = App.state.actionCreateTab || 'manual';
    const cls = (active) => `flex-1 px-3 py-2.5 rounded-xl text-xs font-black text-center transition ${active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`;
    return `<div class="flex gap-2 p-1 rounded-2xl bg-slate-100 mb-4">
      <button onclick="Actions.setActionCreateTab('manual')" class="${cls(tab === 'manual')}" ${tab === 'manual' ? 'style="color:#fff!important;"' : ''}>Ações Manuais</button>
      <button onclick="Actions.setActionCreateTab('ai')" class="${cls(tab === 'ai')}" ${tab === 'ai' ? 'style="color:#fff!important;"' : ''}>Ações via IA</button>
    </div>`;
  },

  _manualCreatePanel() {
    // V37.0.8 — Removido botão "Criar ação LP especializada". O modal LP
    // (actionLpModal + lpRegistry + flowCheckpointEngine + lpAnalyticsEngine
    // + tracking/checkpointEngine) era código vestigial pré-Tracking V33 que
    // produzia draft mas nenhum consumidor no LJ moderno lia o output.
    // Pra LP com tracking real hoje, fluxo é: snippet embarcável (V33) → /api/tracker-event.
    return this.form();
  },

  _aiCreatePanel() {
    const ai = App.state.actionAiDraft || { prompt: '', count: 3 };
    return `<div class="space-y-3">
      <textarea oninput="Actions.updateActionAiDraft('prompt', this.value)" placeholder="Converse com a IA. Ex: gere 3 posts orgânicos para nutrir leads MOF que baixaram o ebook." class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold min-h-[260px]">${Utils.escape(ai.prompt)}</textarea>
      <button onclick="Actions.generateActionsViaAI()" style="color:#fff!important;" class="w-full px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black flex items-center justify-center gap-2"><i data-lucide="sparkles" class="w-4 h-4"></i> Gerar ações com IA</button>
    </div>`;
  },

  form() {
    const d = App.state.actionDraft;
    const path = FlowResolutionEngine.resolve(d.originSector, d.originFunnel, d.destinationSector, d.destinationFunnel);
    return `<div class="space-y-3">
      <div><label class="text-xs font-black text-slate-500">Nome da ação</label><input value="${Utils.escape(d.name)}" oninput="App.state.actionDraft.name=this.value; App.save();" placeholder="Ex: Post orgânico Instagram" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" /></div>
      <div class="rounded-3xl bg-slate-50 border border-slate-100 p-4"><h3 class="font-black mb-3">Contexto operacional</h3><div class="grid grid-cols-2 gap-2"><div><label class="text-xs font-black text-slate-500">Setor</label><select onchange="Actions.updateActionContext('sector', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold">${Config.sectors.map(s => `<option ${d.sector === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div><div><label class="text-xs font-black text-slate-500">Funil</label><select onchange="Actions.updateActionContext('funnel', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold">${Config.funnels.map(f => `<option ${d.funnel === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div><div><div class="flex items-center justify-between mb-1"><label class="text-xs font-black text-slate-500">Canal</label><button onclick="Actions.addCustomChannel()" title="Adicionar novo canal" class="text-[10px] font-black text-indigo-600 hover:text-indigo-700 flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i>Adicionar Canal</button></div><select onchange="Actions.updateActionContext('channel', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold">${Config.allChannels().map(channel => `<option value="${Utils.escape(channel)}" ${d.channel === channel ? 'selected' : ''}>${Utils.escape(channel)}</option>`).join('')}</select></div><div><div class="flex items-center justify-between mb-1"><label class="text-xs font-black text-slate-500">Tipo</label><button onclick="Actions.addCustomActionType()" title="Adicionar novo tipo" class="text-[10px] font-black text-indigo-600 hover:text-indigo-700 flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i>Adicionar Tipo</button></div><select onchange="Actions.updateActionContext('actionType', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold">${Config.allActionTypes().map(t => `<option ${d.actionType === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div></div>
      <div class="rounded-3xl bg-slate-50 border border-slate-100 p-4">
        <h3 class="font-black mb-1">Travessia da ação</h3>
        <p class="text-xs text-slate-500 mb-3">A origem é definida automaticamente pelo Contexto operacional: <b>${Utils.escape(d.sector || 'Marketing')} ${Utils.escape(d.funnel || 'MOF')}</b>. Aqui você só define onde a ação deve terminar.</p>
        <div class="grid grid-cols-2 gap-2 mb-3">
          <div><label class="text-xs font-black text-slate-500">Destino setor</label><select onchange="Actions.updateActionContext('destinationSector', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold">${Config.sectors.map(s => `<option ${d.destinationSector === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
          <div><label class="text-xs font-black text-slate-500">Destino funil</label><select onchange="Actions.updateActionContext('destinationFunnel', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold">${Config.funnels.map(f => `<option ${d.destinationFunnel === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
        </div>
        <div class="text-xs font-black text-slate-500 mb-2">Fluxo obrigatório resolvido automaticamente</div>
        <div class="flex flex-wrap gap-2">${path.map((stage, index) => `<span class="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-black">${index + 1}. ${FlowResolutionEngine.label(stage)}</span>`).join('')}</div>
      </div>
      <div><label class="text-xs font-black text-slate-500">Descrição da Ação</label><textarea oninput="App.state.actionDraft.objective=this.value; App.save();" placeholder="Qual sinal esta ação precisa gerar?" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold min-h-[80px]">${Utils.escape(d.objective)}</textarea></div>
      <div class="rounded-3xl bg-indigo-50 border border-indigo-100 p-4 flex items-start gap-3">
        <span class="shrink-0 w-9 h-9 rounded-xl bg-indigo-100 border border-indigo-200 grid place-items-center text-indigo-700">
          <i data-lucide="upload-cloud" class="w-4 h-4"></i>
        </span>
        <div class="min-w-0 flex-1">
          <h3 class="text-sm font-black text-slate-900">Base de leads</h3>
          <p class="text-xs text-slate-600 mt-0.5 mb-2">Cria a ação primeiro. Depois anexa base de leads pelo Importador (4 steps · dedup · validação · RD real).</p>
          <button onclick="Actions.openLeadImportModal()" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black inline-flex items-center gap-1.5" style="color:#fff!important;">
            <i data-lucide="arrow-right" class="w-3 h-3"></i> Abrir Importador
          </button>
        </div>
      </div>
      <button onclick="Actions.createAction()" style="color:#fff!important;" class="w-full px-5 py-3 rounded-2xl bg-slate-900 text-white font-black lj-dark-button">Criar ação plugada</button>
    </div>`;
  },
  okrRow(okr, index) { return `<div class="grid grid-cols-[1fr_74px_74px_auto] gap-2"><input value="${Utils.escape(okr.name)}" oninput="Actions.updateActionDraftOkr(${index}, 'name', this.value)" placeholder="Nome do KPI" class="w-full px-3 py-2.5 rounded-2xl bg-white border border-slate-200 font-semibold text-sm" /><input value="${Utils.escape(okr.target || '')}" oninput="Actions.updateActionDraftOkr(${index}, 'target', this.value)" placeholder="Meta" class="w-full px-3 py-2.5 rounded-2xl bg-white border border-slate-200 font-black text-sm" /><input value="${Utils.escape(okr.current || '')}" oninput="Actions.updateActionDraftOkr(${index}, 'current', this.value)" placeholder="Atual" class="w-full px-3 py-2.5 rounded-2xl bg-white border border-slate-200 font-black text-sm" /><button onclick="Actions.removeActionDraftOkr(${index})" class="px-3 py-2 rounded-2xl bg-white border border-slate-200 text-red-500 font-black">×</button></div>`; },
  // V37.0.9 — leadInput / leadTextArea / scorePreview REMOVIDOS junto com o
  // bloco "Mailing definido?". Importação de leads agora é só via
  // Actions.openLeadImportModal (Lead Import Wizard 4 steps, V35.3.7).
  card(action) {
    // V29.2.3 — Defensivo
    if (!Array.isArray(action.leads)) action.leads = [];
    if (!Array.isArray(action.okrs)) action.okrs = [];
    if (!Array.isArray(action.flowPath)) action.flowPath = [];
    const visual = this.visual(action);
    const leads = ScoreEngine.actionLeads(action);
    const avgScore = leads.length ? Math.round(leads.reduce((sum, lead) => sum + (lead.score || 0), 0) / leads.length) : 0;
    const scorePreset = ScoreEngine.getById(action.scoreId);
    const flow = FlowResolutionEngine.buildActionFlow(action);
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId));
    const krTag = this._linkedKrTag(action, campaign);

    // V33.0.0-alpha20 (Leonardo) — Aplicação da paleta semântica oficial
    // [[semantic-color-palette]]:
    //   - Eixo NORTE-SUL (vivo, ÁREA) → borda esquerda externa + botões
    //   - Eixo LESTE-OESTE (terra, HIERARQUIA AÇÃO) → label categórico + mini-cards
    // Sem strategicAreaId, ação é "solta": cor recai pra hierarquia (marrom).
    const areaToneMap = { marketing: 'pink', sales: 'teal', cs: 'sky' };
    const areaTone = areaToneMap[action.strategicAreaId] || null;
    const areaIsConnected = !!areaTone;
    const borderLeftStyle = areaIsConnected
      ? `border-l-${areaTone}-500`
      : '';
    const borderLeftInline = areaIsConnected ? '' : 'style="border-left: 4px solid var(--lj-action);"';
    const labelColor = areaIsConnected ? `var(--lj-${action.strategicAreaId === 'sales' ? 'sales' : action.strategicAreaId})` : 'var(--lj-action)';
    const hasKrLinked = action.strategicAreaId && (() => {
      if (!campaign) return false;
      const productId = campaign.productId;
      if (!productId || !window.StrategicMapEngine) return false;
      const objective = StrategicMapEngine.getObjectiveByArea(productId, action.strategicAreaId);
      return (objective?.okrs || []).some(kr => (kr.connectedActionIds || []).map(Number).includes(Number(action.id)));
    })();

    return `<div class="lj-entity-card relative p-4 rounded-3xl bg-slate-50 border border-slate-100 ${areaIsConnected ? `border-l-4 ${borderLeftStyle}` : 'border-l-4'}" ${borderLeftInline}>
      <button onclick="event.stopPropagation(); Actions.openActionEditModal(${action.id})" title="Editar Ação" aria-label="Editar Ação" class="absolute top-3 right-3 w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 grid place-items-center shadow-sm"><i data-lucide="settings" class="w-4 h-4"></i></button>
      <div class="flex flex-col gap-4">
        <div class="lj-entity-card-grid">
          <!-- V33.0.0-alpha21 (Leonardo) — Label "AÇÃO" agora fora do flex,
               solto no topo do lj-entity-copy (mesma estrutura do card de
               campanha). Evita colisão com a engrenagem absoluta no canto. -->
          <div class="lj-entity-copy pr-14">
            <p class="text-[10px] font-black uppercase tracking-widest mb-1" style="color: ${labelColor};">
              Ação${areaIsConnected ? ` · ${Utils.escape(action.strategicAreaId === 'cs' ? 'CS' : action.strategicAreaId === 'sales' ? 'Vendas' : 'Marketing')}` : ' · sem área'}
            </p>
            <div class="flex items-start gap-3">
              <div class="w-3 h-3 rounded-full mt-2 ${visual.dotClass} shrink-0"></div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-black text-lg text-slate-900">${Utils.escape(action.name)}</h3>
                  <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-black text-slate-700"><i data-lucide="radio" class="w-3 h-3"></i> ${Utils.escape(action.channel)}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="lj-entity-metrics">
            <!-- V33.0.0-alpha20 — Mini-cards usam hierarquia Ação (LO, terra)
                 em vez de cores aleatórias. border-l-4 + label colored. -->
            <div class="grid grid-cols-3 gap-2 text-center">
              <div class="bg-white rounded-2xl border border-slate-200 px-3 py-2" style="border-left: 4px solid var(--lj-action);">
                <div class="text-[9px] font-black uppercase tracking-widest" style="color: var(--lj-action);">Leads</div>
                <div class="font-black text-lg text-slate-900 mt-0.5">${action.leads.length}</div>
              </div>
              <div class="bg-white rounded-2xl border border-slate-200 px-3 py-2" style="border-left: 4px solid var(--lj-action);">
                <div class="text-[9px] font-black uppercase tracking-widest" style="color: var(--lj-action);">Score</div>
                <div class="font-black text-lg text-slate-900 mt-0.5">${avgScore}</div>
              </div>
              <div class="bg-white rounded-2xl border border-slate-200 px-3 py-2" style="border-left: 4px solid var(--lj-action);">
                <div class="text-[9px] font-black uppercase tracking-widest" style="color: var(--lj-action);">Etapas</div>
                <div class="font-black text-lg text-slate-900 mt-0.5">${flow.path.length}</div>
              </div>
            </div>
          </div>
          <div class="flex flex-col items-end justify-end gap-2 min-w-[220px]">
            <!-- V33.0.0-alpha20 — Botões com gramática unificada: bg-slate-900
                 + border-2 (cor área se conectada, action se solta). -->
            <button onclick="event.stopPropagation(); Actions.openActionFlowModal(${action.id})" style="color:#fff!important; ${areaIsConnected ? '' : 'border-color: var(--lj-action);'}" class="w-full px-4 py-2.5 rounded-2xl bg-slate-900 text-white font-bold text-xs lj-dark-button border-2 ${areaIsConnected ? `border-${areaTone}-500` : ''} flex items-center justify-center gap-1.5"><i data-lucide="map" class="w-3.5 h-3.5"></i> Ver Fluxo da Ação</button>
            <div class="grid grid-cols-2 gap-2 w-full">
              <button onclick="event.stopPropagation(); Actions.openDjowAIModal({ actionId: ${action.id}, seedPrompt: 'Crie uma tarefa para a ação atual: ' })" class="px-3 py-2 rounded-xl bg-slate-900 text-white font-bold text-[11px] border-2 ${areaIsConnected ? `border-${areaTone}-500` : ''} flex items-center justify-center gap-1.5" style="color:#fff!important; ${areaIsConnected ? '' : 'border-color: var(--lj-action);'}"><i data-lucide="sparkles" class="w-3 h-3"></i> Criar Tarefas</button>
              <button onclick="event.stopPropagation(); Actions.openTasksModal(${action.id})" class="px-3 py-2 rounded-xl bg-slate-900 text-white font-bold text-[11px] border-2 ${areaIsConnected ? `border-${areaTone}-500` : ''} flex items-center justify-center gap-1.5" style="color:#fff!important; ${areaIsConnected ? '' : 'border-color: var(--lj-action);'}"><i data-lucide="list-checks" class="w-3 h-3"></i> Ver Tarefas</button>
            </div>
            ${this._executionStatusLine(action)}
          </div>
        </div>
        <div class="flex flex-wrap gap-2">${flow.path.map(stage => `<span class="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[11px] font-black">${FlowResolutionEngine.label(stage)}</span>`).join('')}</div>
        ${this._strategicTag(action)}
        ${this._connectToMapaButton(action)}
        ${krTag}
      </div>
    </div>`;
  },

  // V31.1.0 — Quando ação NÃO tem strategicAreaId, mostra CTA pra conectar
  // ao Mapa da Receita. Click abre wizard (Frente → KR-mãe → Confirmar).
  _connectToMapaButton(action) {
    if (action.strategicAreaId) return ''; // já conectada — _strategicTag cobre
    return `<div class="rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 p-3 flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <i data-lucide="compass" class="w-4 h-4 text-indigo-600 shrink-0"></i>
        <p class="text-[12px] text-indigo-900"><b>Ação solta.</b> Conecte ao Mapa da Receita pra plugá-la num KR e gerar rollup.</p>
      </div>
      <button onclick="event.stopPropagation(); Actions.openConnectActionToMapa(${action.id})" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] flex items-center gap-1.5 shrink-0" style="color:#fff!important;">
        <i data-lucide="link" class="w-3 h-3"></i> Conectar ao Mapa
      </button>
    </div>`;
  },

  // V28.4.0 — Tag estratégica: badge da área (Mkt/Vendas/CS) + status + cadência
  // + KRs que essa ação move + atalho pro Mapa da Receita.
  _strategicTag(action) {
    if (!action.strategicAreaId || !window.StrategicMapEngine) return '';
    const area = (StrategicMapEngine.COMERCIAL_AREAS || []).find(a => a.id === action.strategicAreaId);
    if (!area) return '';
    const cadences = StrategicMapEngine.STRATEGIC_ACTION_CADENCES || [];
    const statuses = StrategicMapEngine.STRATEGIC_ACTION_STATUSES || [];
    const cadenceLabel = (cadences.find(c => c.id === action.strategicCadence) || {}).label || 'sem cadência';
    const status = (statuses.find(s => s.id === action.strategicStatus) || statuses[0] || { label: 'Planejada', color: 'slate' });
    const confirmed = action.strategicConfirmed;

    // Encontra o produto via campaign → KRs vinculados a essa ação na área certa
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId));
    const productId = campaign?.productId;
    const objective = productId ? StrategicMapEngine.getObjectiveByArea(productId, area.id) : null;
    const linkedKrs = (objective?.okrs || []).filter(kr => (kr.connectedActionIds || []).map(Number).includes(Number(action.id)));
    const linkedNames = linkedKrs.map(k => k.name);
    const tone = area.color;

    return `<div class="rounded-2xl border-2 border-${tone}-200 bg-${tone}-50 p-3 flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="px-2 py-1 rounded-full bg-${status.color}-100 text-${status.color}-800 border border-${status.color}-300 text-[10px] font-black">${Utils.escape(status.label).toUpperCase()}</span>
          <span class="text-[11px] text-slate-700">⏱ ${Utils.escape(cadenceLabel)}</span>
          ${action.strategicOwner ? `<span class="text-[11px] text-slate-700">👤 ${Utils.escape(action.strategicOwner)}</span>` : ''}
          ${confirmed ? '<span class="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 text-[10px] font-black">✓ CONFIRMADA</span>' : '<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 text-[10px] font-black">⚠ PENDENTE</span>'}
        </div>
        ${productId ? `<button onclick="event.stopPropagation(); Actions.openActionOnMap(${productId}, ${action.id})" class="px-2 py-1 rounded-lg bg-white border border-${tone}-300 text-${tone}-700 text-[10px] font-black hover:bg-${tone}-100">Abrir no Mapa →</button>` : ''}
      </div>
      ${linkedNames.length ? `<p class="text-[11px] text-slate-700"><b class="text-${tone}-800">🔗 Move:</b> ${linkedNames.map(n => Utils.escape(n)).join(' · ')}</p>` : '<p class="text-[11px] text-amber-700">⚠️ Nenhum número confirmado é movido por essa ação ainda.</p>'}
      ${action.strategicDescription && action.strategicDescription !== 'Ação custom criada via engine' ? `<p class="text-[11px] text-slate-500 italic">${Utils.escape(action.strategicDescription)}</p>` : ''}
    </div>`;
  },

  _executionStatusLine(action) {
    const s = window.ExecutionStatusEngine ? ExecutionStatusEngine.forAction(action.id) : { toExecute: 0, executed: 0 };
    return `<div class="w-full text-[11px] text-slate-500 font-bold text-right">Execução: <span class="text-slate-700">${s.toExecute} para executar</span> • <span class="text-emerald-700">${s.executed} executada${s.executed === 1 ? '' : 's'}</span></div>`;
  },

  _actionsListFilter(actions) {
    const filter = App.state.actionsListFilter || 'all';
    const stages = window.FlowEngine ? FlowEngine.STAGE_PRESETS : [];
    const counts = {};
    for (const a of actions) {
      const stage = a.flow?.startStage || (window.FlowEngine ? FlowEngine._stageIdFromLegacy(a.originSector || a.sector, a.originFunnel || a.funnel) : 'mkt_tof');
      counts[stage] = (counts[stage] || 0) + 1;
    }
    return `<div class="flex items-center gap-2 flex-wrap mb-4">
      <span class="text-[11px] font-black text-slate-500 uppercase tracking-wider">Filtrar por etapa inicial:</span>
      <button onclick="Actions.setActionsListFilter('all')" class="px-3 py-1.5 rounded-full text-xs font-black ${filter === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">Todas (${actions.length})</button>
      ${stages.map(stage => {
        const count = counts[stage.id] || 0;
        if (count === 0) return '';
        const active = filter === stage.id;
        return `<button onclick="Actions.setActionsListFilter('${stage.id}')" class="px-3 py-1.5 rounded-full text-xs font-black ${active ? 'text-white' : 'text-slate-700 hover:opacity-80'}" style="background:${active ? stage.color : stage.color + '22'};">${Utils.escape(stage.label)} (${count})</button>`;
      }).join('')}
    </div>`;
  },

  _filteredActionsList(actions) {
    const filter = App.state.actionsListFilter || 'all';
    let filtered = actions;
    if (filter !== 'all') {
      filtered = actions.filter(a => {
        const stage = a.flow?.startStage || (window.FlowEngine ? FlowEngine._stageIdFromLegacy(a.originSector || a.sector, a.originFunnel || a.funnel) : null);
        return stage === filter;
      });
    }
    if (!filtered.length) return Components.empty(filter === 'all' ? 'Nenhuma ação criada para esta campanha.' : 'Nenhuma ação começa nesta etapa.');
    return filtered.map(action => this.card(action)).join('');
  },

  _linkedKrTag(action, campaign) {
    if (!window.RevopsFinanceEngine || !campaign) return '';
    const okrs = Array.isArray(campaign.okrs) ? campaign.okrs : [];
    const allKrs = [];
    for (const okr of okrs) for (const kr of (okr.keyResults || [])) allKrs.push({ ...kr, okr });
    if (!allKrs.length && !action.linkedCampaignKrId) return '';
    const selectId = `kr_link_${action.id}`;
    const options = ['<option value="">— sem vínculo —</option>'].concat(allKrs.map(kr => {
      const meta = RevopsFinanceEngine.METRIC_CATALOG[kr.metric];
      const label = `${kr.okr.objective || 'Tático'}: ${kr.label || meta?.label || 'KR'}`;
      return `<option value="${Utils.escape(kr.id)}" ${action.linkedCampaignKrId === kr.id ? 'selected' : ''}>${Utils.escape(label)}</option>`;
    })).join('');
    return `<div class="mt-3 flex flex-col md:flex-row md:items-center gap-2 pt-3 border-t border-slate-200">
      <span class="text-[11px] font-black text-indigo-700 uppercase tracking-wider whitespace-nowrap"><i data-lucide="compass" class="w-3 h-3 inline mr-1"></i> KR da Campanha</span>
      <select id="${selectId}" onchange="Actions.linkActionToCampaignKr(${action.id}, this.value || null)" class="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 font-semibold text-xs">${options}</select>
      ${campaign ? `<button onclick="Actions.openRevopsOkr('campaign', ${campaign.productId || 'null'}, null, ${campaign.id})" class="px-2 py-1 rounded-md bg-slate-900 text-white text-[10px] font-black flex items-center gap-1 lj-dark-button" style="color:#fff!important;"><i data-lucide="plus" class="w-3 h-3"></i> Novo KR Tático</button>` : ''}
    </div>`;
  },

  visual(action) { if (!action.connected) return { label: 'canal ainda não plugado', dotClass: 'bg-slate-300', buttonClass: 'bg-slate-200 text-slate-500', buttonText: 'Ativar' }; if (action.connectionStatus === 'active') return { label: 'trocando dados', dotClass: 'bg-emerald-500', buttonClass: 'bg-emerald-100 text-emerald-700', buttonText: 'Pausar' }; return { label: 'conectado sem troca', dotClass: 'bg-amber-500', buttonClass: 'bg-amber-100 text-amber-700', buttonText: 'Ativar' }; }
};
window.ActionModule = ActionModule;

// V38.1.53 — Removidos `operationalFlowRail` (rail navegacional não chamado),
// `rdEmailFields`/`rdInput`/`rdKpiMappingPanel` (painéis V13 RD Email Fase 2/3 stub
// pré-integração OAuth) e `rdActionStatusBadge` (badge nunca renderizada).
// Backend rdSyncEngine continua intacto pra ações já configuradas.
