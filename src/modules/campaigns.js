var CampaignModule = {
  _actionsByCampaign(campaignsScope = App.state.campaigns) {
    const map = new Map();
    for (const campaign of campaignsScope) map.set(Number(campaign.id), []);
    for (const action of (App.state.actions || [])) {
      const key = Number(action.campaignId);
      if (map.has(key)) map.get(key).push(action);
      else map.set(key, [action]);
    }
    return map;
  },

  render() {
    const selectedProductId = App.state.selectedProductId || null;
    const campaigns = selectedProductId
      ? App.state.campaigns.filter(c => Number(c.productId) === Number(selectedProductId))
      : App.state.campaigns;
    const actionsByCampaign = this._actionsByCampaign(campaigns);
    return `<div class="space-y-4">
      ${this.campaignLayer()}
      <div class="grid lg:grid-cols-3 gap-4">
        <div class="lg:col-span-1 bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <h2 class="text-xl font-black mb-1">Campanha</h2>
          <p class="text-sm text-slate-500 mb-5">A campanha é o container operacional vinculado a um produto. Os OKRs nascem nas ações e alimentam estágios, setores e receita.</p>
          <div class="space-y-3">
            <div><label class="text-xs font-black text-slate-500">Produto vinculado</label><select onchange="App.state.campaignDraft.productId=Number(this.value); App.state.selectedProductId=Number(this.value); App.save();" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold">${App.state.products.map(product => `<option value="${product.id}" ${Number(App.state.campaignDraft.productId) === Number(product.id) ? 'selected' : ''}>${Utils.escape(product.name)}</option>`).join('')}</select></div>
            <div><label class="text-xs font-black text-slate-500">Nome da campanha</label><input value="${Utils.escape(App.state.campaignDraft.name)}" oninput="App.state.campaignDraft.name=this.value; App.save();" placeholder="Ex: Campanha Maio" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" /></div>
            <div><label class="text-xs font-black text-slate-500">Objetivo</label><textarea oninput="App.state.campaignDraft.objective=this.value; App.save();" placeholder="Qual é o objetivo operacional desta campanha?" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold min-h-[100px]">${Utils.escape(App.state.campaignDraft.objective)}</textarea></div>
            <div class="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-sm text-slate-600"><b>Regra RevOps:</b> campanhas não possuem OKRs estratégicos próprios. As metas operacionais são definidas nas ações e alimentam produto, funil e setor.</div>
            <div><label class="text-xs font-black text-slate-500">Responsável</label><input value="${Utils.escape(App.state.campaignDraft.owner)}" oninput="App.state.campaignDraft.owner=this.value; App.save();" placeholder="Ex: Felipe" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" /></div>
            <button onclick="Actions.createCampaign()" class="w-full px-5 py-3 rounded-2xl bg-slate-900 text-white font-black">Criar campanha</button>
          </div>
        </div>
        <div class="lg:col-span-2 bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <div class="flex items-start justify-between gap-3 mb-4"><div><h2 class="text-xl font-black mb-1">Campanhas Criadas</h2><p class="text-sm text-slate-500">Cada campanha fica plugada a um produto e pode receber várias ações.</p></div><div class="text-3xl font-black">${campaigns.length}</div></div>
          <div class="mb-4">
            <label class="text-xs font-black text-slate-500">Produto</label>
            <select onchange="Actions.selectProductForCampaigns(this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold">
              <option value="" ${!selectedProductId ? 'selected' : ''}>Todos os produtos</option>
              ${App.state.products.map(p => `<option value="${p.id}" ${Number(selectedProductId) === Number(p.id) ? 'selected' : ''}>${Utils.escape(p.name)}</option>`).join('')}
            </select>
          </div>
          <div class="space-y-3">${campaigns.map(campaign => this.card(campaign, actionsByCampaign.get(Number(campaign.id)) || [])).join('') || Components.empty(selectedProductId ? 'Nenhuma campanha vinculada a este produto.' : 'Nenhuma campanha criada ainda.')}</div>
        </div>
      </div>
      ${this.cxBase()}
      ${CampaignFlowModal.render()}
      ${this.editCampaignModal()}
      ${window.StrategicMapModal ? StrategicMapModal.render() : ''}
    </div>`;
  },

  editCampaignModal() {
    const campaign = (App.state.campaigns || []).find(item => Number(item.id) === Number(App.state.editCampaignId));
    if (!App.state.showCampaignEditModal || !campaign) return '';
    return `<div class="fixed inset-0 z-[999] bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div class="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-2xl mx-auto mt-8 overflow-hidden">
        <header class="bg-slate-900 text-white p-5 flex items-start justify-between gap-3">
          <div><p class="text-xs font-black text-slate-300 uppercase tracking-wider">Editar campanha</p><h3 class="text-2xl font-black">${Utils.escape(campaign.name)}</h3></div>
          <button onclick="Actions.closeCampaignEditModal()" class="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-black text-xl">×</button>
        </header>
        <div class="p-5 space-y-3">
          <div><label class="text-xs font-black text-slate-500">Produto vinculado</label><select onchange="Actions.updateEditingCampaignField('productId', Number(this.value))" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold">${App.state.products.map(product => `<option value="${product.id}" ${Number(campaign.productId) === Number(product.id) ? 'selected' : ''}>${Utils.escape(product.name)}</option>`).join('')}</select></div>
          <div><label class="text-xs font-black text-slate-500">Nome da campanha</label><input value="${Utils.escape(campaign.name || '')}" oninput="Actions.updateEditingCampaignField('name', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" /></div>
          <div><label class="text-xs font-black text-slate-500">Objetivo</label><textarea oninput="Actions.updateEditingCampaignField('objective', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold min-h-[110px]">${Utils.escape(campaign.objective || '')}</textarea></div>
          <div><label class="text-xs font-black text-slate-500">Responsável</label><input value="${Utils.escape(campaign.owner || '')}" oninput="Actions.updateEditingCampaignField('owner', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" /></div>
          <div><label class="text-xs font-black text-slate-500">Status</label><select onchange="Actions.updateEditingCampaignField('status', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold">${['Ativa','Pausada','Finalizada'].map(status => `<option ${String(campaign.status || 'Ativa') === status ? 'selected' : ''}>${status}</option>`).join('')}</select></div>
          <div>
            <label class="text-xs font-black text-slate-500">Investimento em mídia (R$)</label>
            <input type="number" min="0" step="0.01" value="${Number(campaign.mediaInvestment || 0)}" oninput="Actions.updateEditingCampaignField('mediaInvestment', Number(this.value || 0))" placeholder="0" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-black" />
            <p class="text-[11px] text-slate-400 mt-1">Soma alimenta o CAC do produto no Painel Rosa de RevOps.</p>
          </div>
          <div class="flex flex-col md:flex-row gap-2 justify-end pt-2">
            <button onclick="Actions.closeCampaignEditModal()" class="px-5 py-3 rounded-2xl bg-slate-100 text-slate-700 font-black">Cancelar</button>
            <button onclick="Actions.saveCampaignEdit()" class="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black">Salvar Campanha</button>
          </div>
        </div>
      </div>
    </div>`;
  },

  operationalFlowRail(product) {
    return `<div class="lj-operational-rail bg-white rounded-3xl p-4 shadow-sm border border-slate-100">
      <div class="lj-flow-rail-grid text-sm" style="display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:12px!important;align-items:stretch!important;width:100%!important;">
        <button onclick="App.setTab('products')" style="min-height:88px!important;width:100%!important;display:grid!important;grid-template-columns:36px minmax(0,1fr)!important;gap:10px!important;align-items:center!important;justify-content:initial!important;text-align:left!important;" class="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-black text-left lj-flow-step"><span class="lj-flow-step-number">1</span><span><span class="lj-flow-step-title">Produto</span><span class="lj-flow-step-subtitle">Voltar ao núcleo</span></span></button>
        <button onclick="${product ? `Actions.goToProductCampaigns(${product.id})` : `App.setTab('campaigns')`}" style="min-height:88px!important;width:100%!important;display:grid!important;grid-template-columns:36px minmax(0,1fr)!important;gap:10px!important;align-items:center!important;justify-content:initial!important;text-align:left!important;" class="px-4 py-3 rounded-2xl border border-slate-900 bg-slate-900 text-white font-black text-left lj-flow-step"><span class="lj-flow-step-number">2</span><span><span class="lj-flow-step-title">Campanhas</span><span class="lj-flow-step-subtitle">Criar ou editar</span></span></button>
        <button onclick="App.setTab('actions')" style="min-height:88px!important;width:100%!important;display:grid!important;grid-template-columns:36px minmax(0,1fr)!important;gap:10px!important;align-items:center!important;justify-content:initial!important;text-align:left!important;" class="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-black text-left lj-flow-step"><span class="lj-flow-step-number">3</span><span><span class="lj-flow-step-title">Ações</span><span class="lj-flow-step-subtitle">Executar campanha</span></span></button>
        <button onclick="App.setTab('results')" style="min-height:88px!important;width:100%!important;display:grid!important;grid-template-columns:36px minmax(0,1fr)!important;gap:10px!important;align-items:center!important;justify-content:initial!important;text-align:left!important;" class="px-4 py-3 rounded-2xl border border-slate-200 bg-white text-slate-700 font-black text-left lj-flow-step"><span class="lj-flow-step-number">4</span><span><span class="lj-flow-step-title">Leitura</span><span class="lj-flow-step-subtitle">Resultado da campanha</span></span></button>
      </div>
    </div>`;
  },

  campaignLayer() {
    const campaigns = App.state.campaigns || [];
    let active = 0, paused = 0, finished = 0;
    for (const campaign of campaigns) {
      const status = String(campaign.status || 'Ativa').toLowerCase();
      if (status === 'ativa') active += 1;
      else if (status === 'pausada') paused += 1;
      else if (status === 'finalizada') finished += 1;
    }
    let leads = 0, converted = 0;
    for (const action of (App.state.actions || [])) {
      leads += action.leads?.length || 0;
      converted += FlowResolutionEngine.buildActionFlow(action).converted || 0;
    }
    const conversion = leads ? Math.round((converted / leads) * 1000) / 10 : 0;
    return `<div class="bg-slate-950 text-white rounded-[2rem] p-5 shadow-sm overflow-hidden relative">
      <div class="absolute inset-0 opacity-60" style="background: radial-gradient(circle at 20% 10%, rgba(59,130,246,.20), transparent 28%), radial-gradient(circle at 80% 20%, rgba(16,185,129,.16), transparent 30%);"></div>
      <div class="relative z-10 grid lg:grid-cols-[1.2fr_1fr] gap-4 items-start">
        <div>
          <div class="flex items-center gap-2 mb-2"><i data-lucide="megaphone" class="w-4 h-4"></i><p class="text-xs font-black text-slate-300 uppercase tracking-wider">Campaign Operational Layer</p></div>
          <h2 class="text-3xl font-black">Campanhas</h2>
          <p class="text-sm text-slate-300 max-w-3xl mt-2">Painel operacional de campanhas: performance, produtos vinculados, receita gerada, handoffs, conversões, gargalos, ações plugadas e fluxo consolidado.</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          ${this.darkMetric('Ativas', active, 'play-circle')}
          ${this.darkMetric('Pausadas', paused, 'pause-circle')}
          ${this.darkMetric('Finalizadas', finished, 'check-circle')}
          ${this.darkMetric('Conversão', `${conversion}%`, 'arrow-right-left')}
        </div>
      </div>
    </div>`;
  },

  darkMetric(label, value, icon) { return `<div class="bg-white/10 border border-white/10 rounded-2xl p-4"><div class="flex items-center justify-between"><p class="text-xs font-black text-slate-300">${label}</p><i data-lucide="${icon}" class="w-4 h-4 text-slate-300"></i></div><div class="text-3xl font-black mt-2">${value}</div></div>`; },

  cxBase() { return `<div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><div class="flex items-start gap-3"><div class="w-10 h-10 rounded-2xl bg-slate-900 text-white grid place-items-center"><i data-lucide="route" class="w-5 h-5"></i></div><div><h3 class="font-black text-lg">CX Governance — estrutura base</h3><p class="text-sm text-slate-500">Camada paralela ao RevOps preparada para projetos de melhoria, planos de ação, kickoff, weeklys, checkpoints, onboarding da mudança e validação final RevOps. Nesta versão fica apenas estruturada, sem botões operacionais habilitados.</p></div></div></div>`; },

  card(campaign, actions = null) {
    if (actions === null) actions = App.state.actions.filter(action => Number(action.campaignId) === Number(campaign.id));
    let totalLeads = 0, converted = 0;
    for (const action of actions) {
      totalLeads += action.leads?.length || 0;
      converted += Number(FlowResolutionEngine.buildActionFlow(action).converted || 0);
    }
    const conversion = totalLeads ? Math.round((converted / totalLeads) * 1000) / 10 : 0;
    const product = App.state.products.find(p => Number(p.id) === Number(campaign.productId));

    // V22.0 — Estado do pipeline RD da campanha (gate de "Criar Ação" e visual do botão).
    const hasPipeline = Boolean(window.RdCrmConfig?.hasPipelineForCampaign?.(campaign.id));
    const pipelineInfo = hasPipeline ? RdCrmConfig.pipelineInfoForCampaign(campaign.id) : null;
    // V32.12.0 — Leonardo: vermelho é cor destrutiva; "Gerar Pipeline" é ação
    // positiva principal. Trocar pra violet (cor RevOps/ação) quando faltar
    // pipeline, mantém emerald quando OK.
    const pipelineOutline = hasPipeline ? 'border-emerald-500' : 'border-violet-500';
    const pipelineLabel = hasPipeline ? 'Pipeline OK' : 'Gerar Pipeline';
    const pipelineIcon = hasPipeline ? 'check-circle-2' : 'git-branch';

    // V29.0.0 — 3 estágios visuais via getCampaignStrategicStatus:
    //   'unplugged' (🔴) = sem branch, fica preto como qualquer campanha
    //   'configuring' (🟡) = branch criada mas sem KRs confirmados
    //   'active' (🟣) = KRs confirmados, rolando rollup
    const strategicStatus = (window.StrategicMapEngine?.getCampaignStrategicStatus)
      ? StrategicMapEngine.getCampaignStrategicStatus(campaign.id)
      : (campaign.isStrategicHost ? 'configuring' : 'unplugged');
    const isStrategic = strategicStatus === 'active' || strategicStatus === 'configuring';
    const defaultObjectivePlaceholder = 'Campanha estratégica vinculada ao Mapa da Receita.';
    const rawObjective = String(campaign.objective || '').trim();
    const objectiveText = (rawObjective && rawObjective !== defaultObjectivePlaceholder) ? rawObjective : '';
    // Contador de ações órfãs (sem KR vinculado).
    let actionsWithoutObjective = 0;
    if (window.StrategicMapEngine && product) {
      const map = StrategicMapEngine.getForProduct(product.id);
      const allKrs = (map?.objectives || []).flatMap(o => o.okrs || []);
      const linkedActionIds = new Set(allKrs.flatMap(kr => (kr.connectedActionIds || []).map(Number)));
      actionsWithoutObjective = actions.filter(a => !linkedActionIds.has(Number(a.id))).length;
    }
    // V29.0.0 — Visual por status estratégico (3 estágios):
    // active = roxo, configuring = âmbar, unplugged = padrão preto.
    // V32.12.0 — Leonardo: adiciona left-border tone como assinatura visual
    // por status (consistente com card de produto que ancora violet).
    let cardBgCls, cardStyle;
    if (strategicStatus === 'active') {
      cardBgCls = App.state.selectedCampaignId === campaign.id ? 'border-violet-500 border-l-4 border-l-violet-600 ring-2 ring-violet-300' : 'border-violet-200 border-l-4 border-l-violet-500';
      cardStyle = 'style="background:linear-gradient(135deg, rgba(139,92,246,.04), rgba(34,197,94,.02));"';
    } else if (strategicStatus === 'configuring') {
      cardBgCls = App.state.selectedCampaignId === campaign.id ? 'border-amber-500 border-l-4 border-l-amber-600 ring-2 ring-amber-200' : 'border-amber-200 border-l-4 border-l-amber-500';
      cardStyle = 'style="background:linear-gradient(135deg, rgba(251,191,36,.04), rgba(251,191,36,.01));"';
    } else {
      cardBgCls = App.state.selectedCampaignId === campaign.id ? 'border-slate-900 border-l-4 border-l-slate-900 bg-slate-50' : 'border-slate-200 border-l-4 border-l-slate-400 bg-white';
      cardStyle = '';
    }

    // V28.4.3 — Selos no bottom-right (Pipeline + Mapa da Receita lado a lado).
    // Botão "Mapa da Receita" agora vai DENTRO do grid de botões, entre Pipeline OK
    // e Enviar ICP pro RD — mantém o estilo dos outros (mesmo enquadre).
    // V38.1.x — Layout refatorado pra sair do grid lj-entity-card-grid (que tem
    // !important rígido em lj-card-actions e quebrava trilha + CTA).
    // Estrutura agora é vertical com seções full-width: header → aviso →
    // trilha → grid 2-col (setor cards + próximo passo) → atalhos.
    // Selos bottom-right (Pipeline criado / Mapa ativo / Mapa em config)
    // removidos por redundância com a trilha. Engrenagem mantida.

    // V38.1.26 — Trilha sequencial substituída por 4 badges independentes.
    // Cada badge é uma capacidade clicável: off → leva pra ativar; on →
    // leva pra visualizar/gerir. Sem cadeia forçada — cliente escolhe a
    // ordem. Bloco "Próximo passo" sai (cada badge já é o CTA da sua
    // capacidade). Mapa volta a ser estratégico (paralelo), não operacional.
    const linkedLeadsCount = (window.LeadBaseService?.forCampaign?.(campaign.id) || []).length;
    const hasMapActive = strategicStatus === 'active';
    const hasMapConfiguring = strategicStatus === 'configuring';
    const hasActions = actions.length > 0;
    const hasLeads = linkedLeadsCount > 0 || totalLeads > 0;

    const badges = [
      {
        label: 'Pipeline',
        state: hasPipeline ? 'on' : 'off',
        action: hasPipeline
          ? `Actions.openCampaignEditModal(${campaign.id})`
          : `Actions.generateCampaignPipeline(${campaign.id})`,
        tooltip: hasPipeline ? 'Pipeline RD ativo. Clique pra ver os detalhes da campanha.' : 'Clique pra gerar o pipeline RD desta campanha.'
      },
      {
        label: 'Mapa',
        state: hasMapActive ? 'on' : (hasMapConfiguring ? 'partial' : 'off'),
        action: (hasMapActive || hasMapConfiguring) && product
          ? `Actions.openStrategicMap(${product.id})`
          : `Actions.activateStrategicMapForCampaign(${campaign.id})`,
        tooltip: hasMapActive
          ? 'Plugada no Mapa da Receita. Clique pra abrir.'
          : hasMapConfiguring
            ? 'Mapa em configuração. Clique pra terminar de plugar os KRs.'
            : 'Clique pra plugar esta campanha no Mapa da Receita do produto.'
      },
      {
        label: 'Ações',
        state: hasActions ? 'on' : 'off',
        count: hasActions ? actions.length : null,
        action: hasActions
          ? `Actions.goToCampaignActions(${campaign.id})`
          : `Actions.prepareActionForCampaign(${campaign.id})`,
        tooltip: hasActions ? `${actions.length} ação(ões) criadas. Clique pra ver.` : 'Clique pra criar a primeira ação desta campanha.'
      },
      {
        label: 'Leads',
        state: hasLeads ? 'on' : 'off',
        count: hasLeads ? (linkedLeadsCount || totalLeads) : null,
        action: `Actions.pushCampaignICPToRD(${campaign.id})`,
        tooltip: hasLeads ? `${linkedLeadsCount || totalLeads} lead(s) vinculados. Clique pra enviar mais pro RD.` : 'Clique pra adicionar leads e enviar pro RD.'
      }
    ];

    const badgesHtml = badges.map(b => {
      const isOn = b.state === 'on';
      const isPartial = b.state === 'partial';
      const tone = isOn
        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
        : isPartial
          ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
          : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-700';
      const icon = isOn
        ? '<i data-lucide="check-circle-2" class="w-3 h-3 shrink-0"></i>'
        : isPartial
          ? '<i data-lucide="loader" class="w-3 h-3 shrink-0"></i>'
          : '<i data-lucide="circle" class="w-3 h-3 shrink-0"></i>';
      const countBadge = b.count != null
        ? `<span class="ml-1 px-1.5 py-0.5 rounded-md bg-white/70 text-[9px] font-black">${b.count}</span>`
        : '';
      return `<button onclick="event.stopPropagation(); ${b.action}" title="${Utils.escape(b.tooltip)}" class="px-2.5 py-1 rounded-lg border-2 ${tone} flex items-center gap-1.5 transition text-[10px] font-black uppercase tracking-wider">
        ${icon} <span>${b.label}</span>${countBadge}
      </button>`;
    }).join('');

    // Atalhos (só Fluxo agora — Mapa virou badge)
    const fluxoAtalho = hasActions
      ? `<button onclick="event.stopPropagation(); Actions.openCampaignFlowModal(${campaign.id})" class="text-[11px] font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1"><i data-lucide="workflow" class="w-3 h-3"></i> Fluxo da Campanha</button>`
      : '';
    const hasAtalhos = !!fluxoAtalho;

    // Aviso amber dos KRs-mãe pendentes
    const krsMaeAviso = (() => {
      if (!isStrategic || !window.StrategicMapEngine?.getMissingChildrenInBranch || !product) return '';
      const missing = StrategicMapEngine.getMissingChildrenInBranch(product.id, campaign.id);
      if (!missing.length) return '';
      return `<div class="rounded-md bg-amber-50/40 border border-amber-200 border-l-2 border-l-amber-500 px-2 py-1 flex items-center gap-1.5">
        <i data-lucide="alert-triangle" class="w-3 h-3 text-amber-700 shrink-0"></i>
        <p class="text-[10px] text-amber-900 font-bold leading-tight">${missing.length} número(s)-mãe ainda não plugado(s) — abra o Mapa e vá na etapa Campanha.</p>
      </div>`;
    })();

    // Cards de setor (Marketing / Vendas / CS) — compactos
    const areas = (window.StrategicMapEngine?.COMERCIAL_AREAS) || [
      { id: 'marketing', label: 'Marketing', color: 'pink' },
      { id: 'sales',     label: 'Vendas',    color: 'teal' },
      { id: 'cs',        label: 'CS',        color: 'sky' }
    ];
    const setorCardsHtml = areas.map(area => {
      const count = actions.filter(a => String(a.sector || '').toLowerCase() === area.id).length;
      return `<div class="bg-white rounded-xl border border-slate-200 border-l-4 border-l-${area.color}-500 px-2.5 py-1.5 text-center">
        <div class="text-[9px] font-black text-${area.color}-700 uppercase tracking-wider leading-tight">${Utils.escape(area.label)}</div>
        <div class="font-black text-base text-slate-900 mt-0.5 leading-none">${count}</div>
      </div>`;
    }).join('');

    return `<div onclick="Actions.goToCampaignActions(${campaign.id})" class="lj-entity-card relative p-4 rounded-3xl border ${cardBgCls} hover:bg-slate-100 cursor-pointer transition" ${cardStyle}>
      <button onclick="event.stopPropagation(); Actions.openCampaignEditModal(${campaign.id})" title="Editar Campanha" aria-label="Editar Campanha" class="absolute top-3 right-3 w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 grid place-items-center shadow-sm z-10"><i data-lucide="settings" class="w-4 h-4"></i></button>

      <div class="space-y-3">
        <div class="pr-12">
          <p class="text-[10px] font-black ${isStrategic ? 'text-violet-700' : 'text-slate-500'} uppercase tracking-widest mb-0.5">Campanha</p>
          <h3 class="font-black text-lg ${isStrategic ? 'text-violet-900' : 'text-slate-900'}">${Utils.escape(campaign.name)}</h3>
          ${objectiveText ? `<p class="text-sm text-slate-500 mt-1">${Utils.escape(objectiveText)}</p>` : (isStrategic ? '' : '<p class="text-sm text-slate-500 mt-1">Sem objetivo</p>')}
          <p class="text-xs text-slate-400 mt-2">Produto: ${Utils.escape(product?.name || 'não vinculado')} • ${actions.length} ação(ões) • ${totalLeads} lead(s) • ${conversion}% conversão</p>
          ${hasPipeline ? `<p class="text-[11px] text-emerald-600 mt-1">Pipeline RD: <b>${Utils.escape(pipelineInfo?.pipelineName || '')}</b></p>` : ''}
        </div>

        ${krsMaeAviso}

        <div class="flex items-center gap-2 flex-wrap">${badgesHtml}</div>

        <div class="grid grid-cols-3 gap-2 max-w-md">
          ${setorCardsHtml}
        </div>

        ${hasAtalhos ? `<div class="flex items-center gap-3 justify-end flex-wrap pt-1">
          ${fluxoAtalho}
        </div>` : ''}
      </div>
      ${this._performanceStrip(campaign)}
    </div>`;
  },

  // V32.12.1/2 — Leonardo: faixa "Performance Externa" embaixo do card de
  // Campanha. V32.12.2: modo demo (campaignPerfDemoMode) força dados mockados
  // pra cliente visualizar antes do backend OAuth (V32.12.3+).
  //
  // Estados:
  //   - colapsada (default): linha com chevron + selo + status resumido
  //   - expandida + não conectado: CTA "Conectar Meta · Google · Stripe"
  //   - expandida + conectado: 3 pills (Investido/Conv/CAC) + breakdown por canal
  _performanceStrip(campaign) {
    const expanded = !!App.state.campaignPerfExpanded?.[campaign.id];
    const demoMode = !!App.state.campaignPerfDemoMode;
    // V32.12.2 — Sem backend ainda. Em demo, mock realista; senão "não conectado".
    // Quando OAuth estiver vivo, ler de App.state.campaignPerformance[campaign.id].
    const perf = demoMode
      ? {
          connected: true,
          sources: [
            { id: 'meta',   name: 'Meta',   invested: 1200, conversions: 16 },
            { id: 'google', name: 'Google', invested: 647,  conversions: 7  }
          ]
        }
      : { connected: false, sources: [] };
    const totalInvested = perf.sources.reduce((s, x) => s + x.invested, 0);
    const totalConv = perf.sources.reduce((s, x) => s + x.conversions, 0);
    const cac = totalConv > 0 ? totalInvested / totalConv : 0;
    const fmtBRL = (v) => 'R$ ' + Math.round(v).toLocaleString('pt-BR');
    const chevron = expanded ? 'chevron-up' : 'chevron-down';
    if (!expanded) {
      const statusLabel = perf.connected
        ? `💸 ${fmtBRL(totalInvested)} · 🎯 ${totalConv} · 📐 ${fmtBRL(cac)}`
        : 'Meta · Google · Stripe · não conectado';
      return `<div onclick="event.stopPropagation(); Actions.toggleCampaignPerfExpanded(${campaign.id})" class="mt-3 pt-3 border-t border-slate-200 cursor-pointer hover:bg-slate-50 -mx-4 px-4 -mb-4 pb-4 rounded-b-3xl">
        <div class="flex items-center gap-2 text-[11px] font-bold text-slate-500 hover:text-slate-700">
          <i data-lucide="${chevron}" class="w-3.5 h-3.5"></i>
          <span class="text-[10px] font-black uppercase tracking-widest text-slate-600">Performance Externa</span>
          <span class="text-slate-400">·</span>
          <span class="text-[11px] ${perf.connected ? 'text-slate-800' : ''}">${statusLabel}</span>
          ${demoMode ? '<span class="text-[9px] font-black bg-amber-500/15 border border-amber-400/30 text-amber-700 px-1.5 py-0.5 rounded-md uppercase tracking-wider ml-auto">demo</span>' : ''}
        </div>
      </div>`;
    }
    // Expandida
    const breakdown = (key) => perf.sources.map(s => `${s.name} ${key === 'invested' ? fmtBRL(s[key]) : s[key]}`).join(' · ');
    const body = perf.connected
      ? `<div class="grid grid-cols-3 gap-2 mt-2">
          <div class="bg-white rounded-xl border border-slate-200 border-l-4 border-l-sky-500 px-3 py-2">
            <div class="text-[9px] font-black text-sky-700 uppercase tracking-widest">Investido</div>
            <div class="font-black text-base text-slate-900 mt-0.5">${fmtBRL(totalInvested)}</div>
            <div class="text-[9px] text-slate-500 mt-0.5">${breakdown('invested')}</div>
          </div>
          <div class="bg-white rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 px-3 py-2">
            <div class="text-[9px] font-black text-emerald-700 uppercase tracking-widest">Conversões</div>
            <div class="font-black text-base text-slate-900 mt-0.5">${totalConv}</div>
            <div class="text-[9px] text-slate-500 mt-0.5">${breakdown('conversions')}</div>
          </div>
          <div class="bg-white rounded-xl border border-slate-200 border-l-4 border-l-violet-500 px-3 py-2">
            <div class="text-[9px] font-black text-violet-700 uppercase tracking-widest">CAC</div>
            <div class="font-black text-base text-slate-900 mt-0.5">${fmtBRL(cac)}</div>
            <div class="text-[9px] text-slate-500 mt-0.5 inline-flex items-center gap-1"><i data-lucide="trending-down" class="w-2.5 h-2.5 text-emerald-600"></i> vs mês anterior</div>
          </div>
        </div>
        <p class="text-[10px] text-slate-400 italic mt-2 inline-flex items-center gap-1"><i data-lucide="info" class="w-3 h-3"></i> Detalhe por canal (criativos, ROAS, gráficos) chega na V32.12.4.</p>`
      : `<div class="mt-2 rounded-xl bg-slate-50 border border-dashed border-slate-300 p-3 text-center">
          <p class="text-[12px] text-slate-600 mb-2">Nenhuma fonte conectada. Plugue Meta Ads, Google Ads ou Stripe pra ver gasto, conversões e CAC reais aqui.</p>
          <button onclick="event.stopPropagation(); Actions.openSettingsModal('integrations')" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black uppercase tracking-wider" style="color:#fff!important;">
            <i data-lucide="plug" class="w-3 h-3"></i> Conectar Meta · Google · Stripe
          </button>
        </div>`;
    return `<div onclick="event.stopPropagation();" class="mt-3 pt-3 border-t border-slate-200 -mx-4 px-4 -mb-4 pb-4 rounded-b-3xl bg-slate-50/40">
      <div onclick="event.stopPropagation(); Actions.toggleCampaignPerfExpanded(${campaign.id})" class="flex items-center gap-2 cursor-pointer hover:opacity-70">
        <i data-lucide="${chevron}" class="w-3.5 h-3.5 text-slate-600"></i>
        <span class="text-[10px] font-black uppercase tracking-widest text-slate-700">Performance Externa</span>
        ${perf.connected
          ? '<span class="text-[10px] font-black text-emerald-700 bg-emerald-500/10 border border-emerald-400/30 px-2 py-0.5 rounded-md uppercase tracking-wider inline-flex items-center gap-1"><i data-lucide="check-circle-2" class="w-3 h-3"></i> conectado</span>'
          : '<span class="text-[10px] font-black text-slate-500 bg-slate-200/60 border border-slate-300 px-2 py-0.5 rounded-md uppercase tracking-wider">não conectado</span>'}
        ${demoMode ? '<span class="text-[9px] font-black bg-amber-500/15 border border-amber-400/30 text-amber-700 px-1.5 py-0.5 rounded-md uppercase tracking-wider ml-auto">modo demo</span>' : ''}
      </div>
      ${body}
    </div>`;
  }
};
window.CampaignModule = CampaignModule;
