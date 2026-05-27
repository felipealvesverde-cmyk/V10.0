var JourneyPipelineModule = {
  defaultStages() {
    // V31.2.65 — Container aumentado (h-[420px] lg) + bolinhas movidas down.
    // V32.15.6 — Felipe pediu reset dos números de amostra. Volumes/conversões/
    // intent zerados. Health 'Inativa' (sem dado). Insights genéricos pedindo
    // pra plugar ações. Os valores reais virão do OperationalAggregationEngine
    // quando o user tiver ações conectadas a OKRs.
    return [
      { id: 'marketing-tof', label: 'TOF', area: 'Marketing', x: 60,   y: 120, volume: 0, conversion: '0%', intent: 0, velocity: '—', health: 'Inativa', color: '#2563eb', size: 96, gravity: 0, active: true, insight: 'Sem dados ainda. Plugue ações com origem TOF Marketing pra ver volume aqui.', action: 'Conectar ações de aquisição a este estágio.', risk: 'Sem leitura de TOF, não dá pra avaliar saúde da entrada.' },
      { id: 'marketing-mof', label: 'MOF', area: 'Marketing', x: 217,  y: 200, volume: 0, conversion: '0%', intent: 0, velocity: '—', health: 'Inativa', color: '#f59e0b', size: 86, gravity: 0, active: true, insight: 'Sem dados ainda. Plugue ações de nutrição/qualificação aqui.', action: 'Conectar ações de qualificação MOF Marketing.', risk: '—' },
      { id: 'marketing-bof', label: 'BOF', area: 'Marketing', x: 373,  y: 280, volume: 0, conversion: '0%', intent: 0, velocity: '—', health: 'Inativa', color: '#ef4444', size: 76, gravity: 0, active: true, insight: 'Sem dados ainda. Plugue ações de handoff pra vendas.', action: 'Conectar ações que entregam leads qualificados pra vendas.', risk: '—' },
      { id: 'vendas-tof',    label: 'TOF', area: 'Vendas',    x: 493,  y: 280, volume: 0, conversion: '0%', intent: 0, velocity: '—', health: 'Inativa', color: '#0ea5e9', size: 76, gravity: 0, active: true, insight: 'Sem dados ainda. Plugue ações de prospect/SDR.', action: 'Conectar ações de entrada do funil comercial.', risk: '—' },
      { id: 'vendas-mof',    label: 'MOF', area: 'Vendas',    x: 650,  y: 200, volume: 0, conversion: '0%', intent: 0, velocity: '—', health: 'Inativa', color: '#10b981', size: 70, gravity: 0, active: true, insight: 'Sem dados ainda. Plugue ações de descoberta/diagnóstico.', action: 'Conectar ações de meio do funil comercial.', risk: '—' },
      { id: 'vendas-bof',    label: 'BOF', area: 'Vendas',    x: 807,  y: 120, volume: 0, conversion: '0%', intent: 0, velocity: '—', health: 'Inativa', color: '#16a34a', size: 62, gravity: 0, active: true, insight: 'Sem dados ainda. Plugue ações de proposta/fechamento.', action: 'Conectar ações de fechamento.', risk: '—' },
      { id: 'cs-tof',        label: 'TOF', area: 'CS',        x: 927,  y: 120, volume: 0, conversion: '0%', intent: 0, velocity: '—', health: 'Inativa', color: '#8b5cf6', size: 58, gravity: 0, active: true, insight: 'Sem dados ainda. Plugue ações de onboarding/ativação.', action: 'Conectar ações de onboarding inicial.', risk: '—' },
      { id: 'cs-mof',        label: 'MOF', area: 'CS',        x: 1084, y: 200, volume: 0, conversion: '0%', intent: 0, velocity: '—', health: 'Inativa', color: '#7c3aed', size: 54, gravity: 0, active: true, insight: 'Sem dados ainda. Plugue ações de uso recorrente/sucesso.', action: 'Conectar ações de adoção/retenção.', risk: '—' },
      { id: 'cs-bof',        label: 'BOF', area: 'CS',        x: 1240, y: 280, volume: 0, conversion: '0%', intent: 0, velocity: '—', health: 'Inativa', color: '#6d28d9', size: 50, gravity: 0, active: true, insight: 'Sem dados ainda. Plugue ações de expansão/upsell.', action: 'Conectar ações de expansão.', risk: '—' }
    ];
  },

  healthClasses: {
    'Saudável': 'bg-emerald-100 text-emerald-700',
    'Atenção': 'bg-amber-100 text-amber-700',
    'Gargalo': 'bg-red-100 text-red-700',
    // V31.2.57 — Era 'text-slate-500' = #64748b em fundo #e2e8f0 (contraste 3:1 — falha WCAG AA pra texto pequeno).
    // Trocado pra text-slate-800 (#1e293b) que vence WCAG (~10:1).
    'Inativa': 'bg-slate-200 text-slate-800'
  },

  // V32.15.6 — Bump força ensureState() a sobrescrever pipelineStages no F5
  // dos users existentes. Sem bump, o state remoto antigo (com 8420, etc)
  // continuava prevalecendo.
  visualVersion: 'revenue-flow-v9-zeroed',

  ensureState() {
    const defaultStages = this.defaultStages();
    const storedStages = Array.isArray(App.state.pipelineStages) ? App.state.pipelineStages : [];
    const hasValidVisualMap =
      App.state.pipelineVisualVersion === this.visualVersion &&
      storedStages.length === defaultStages.length &&
      storedStages.every((stage, index) => {
        const base = defaultStages[index];
        return stage && stage.id === base.id && Number(stage.x) === base.x && Number(stage.y) === base.y;
      });

    if (!hasValidVisualMap) {
      App.state.pipelineStages = defaultStages;
      App.state.pipelineVisualVersion = this.visualVersion;
    }

    if (!App.state.selectedPipelineStageId || !App.state.pipelineStages.some(stage => stage.id === App.state.selectedPipelineStageId)) {
      App.state.selectedPipelineStageId = 'marketing-mof';
    }
    if (!App.state.selectedPipelineCampaignId) App.state.selectedPipelineCampaignId = 'all';
    if (!App.state.selectedPipelineActionId) App.state.selectedPipelineActionId = 'all';
  },

  getStages() {
    this.ensureState();
    const base = App.state.pipelineStages || [];

    // V34.6.aa + V34.7.g — Fonte PRIMÁRIA: counts da campanha selecionada,
    // opcionalmente cross-filtrados por banco selecionado.
    const selectedCampaignId = App.state.selectedPipelineCampaignId;
    const selectedBankId = App.state.selectedPipelineBankId;
    const useCampaignDb = selectedCampaignId && selectedCampaignId !== 'all';
    const cacheKey = useCampaignDb ? `${selectedCampaignId}${selectedBankId ? `::${selectedBankId}` : ''}` : null;
    const campaignCounts = useCampaignDb
      ? App.state.campaignPipelineCounts?.[cacheKey]?.counts || null
      : null;
    // Auto-fetch counts (com bank filter se aplicável) se ainda não tem
    if (useCampaignDb && !campaignCounts && window.Actions?.loadCampaignPipelineCounts) {
      setTimeout(() => Actions.loadCampaignPipelineCounts(selectedCampaignId, selectedBankId), 0);
    }

    // V33.0.0 — Fonte secundária: trackerVisitorsCache.counts (cross-campanha,
    // do tracker). Quando NÃO há campanha selecionada ("all"), usa essa.
    const trackerCounts = App.state.trackerVisitorsCache?.counts?.byStage || null;
    if (!useCampaignDb && !trackerCounts && !App.state.trackerVisitorsCache?.loadedAt && !App.state.trackerVisitorsCache?.loading) {
      if (window.Actions?.loadVisitorCounts) {
        setTimeout(() => Actions.loadVisitorCounts(), 0);
      }
    }

    // Mantém leitura legado pro OperationalAggregationEngine (ações com flowResolution).
    const selectedActions = this.selectableActions().filter(action => App.state.selectedPipelineActionId === 'all' || String(action.id) === String(App.state.selectedPipelineActionId));
    const agg = window.OperationalAggregationEngine ? OperationalAggregationEngine.aggregate(selectedActions) : {};

    return base.map(stage => {
      // 1ª prioridade (V34.6.aa): counts de lj_visitor_campaign_state da campanha selecionada
      const campaignVolume = campaignCounts ? Number(campaignCounts[stage.id] || 0) : 0;
      if (campaignVolume > 0) {
        const health = campaignVolume >= 100 ? 'Saudável' : campaignVolume >= 25 ? 'Atenção' : 'Gargalo';
        const gravity = Math.min(90, Math.max(30, Math.round(20 + Math.log10(campaignVolume + 1) * 25)));
        return {
          ...stage,
          volume: campaignVolume,
          conversion: stage.conversion,
          intent: stage.intent,
          health,
          gravity,
          insight: `${campaignVolume} pessoa(s) em ${stage.area} ${stage.label} desta campanha.`,
          action: 'Crie ações pra mover esses leads pro próximo estágio.',
          risk: stage.risk
        };
      }

      // 2ª prioridade: count REAL do tracker (visitors no estágio, cross-campanha)
      const trackerVolume = trackerCounts ? Number(trackerCounts[stage.id] || 0) : 0;
      if (trackerVolume > 0) {
        const health = trackerVolume >= 100 ? 'Saudável' : trackerVolume >= 25 ? 'Atenção' : 'Gargalo';
        const gravity = Math.min(90, Math.max(30, Math.round(20 + Math.log10(trackerVolume + 1) * 25)));
        return {
          ...stage,
          volume: trackerVolume,
          conversion: stage.conversion, // mantém placeholder até ciclo 3 calcular real
          intent: stage.intent,
          health,
          gravity,
          insight: `${trackerVolume} pessoa(s) em ${stage.area} ${stage.label} (rastreio em tempo real).`,
          action: 'Veja os visitors detalhadamente em "Resultados" ou na lista de leads.',
          risk: stage.risk
        };
      }

      // 2ª prioridade: OperationalAggregationEngine (legado — ações com flowResolution)
      const key = String(stage.id || '');
      const node = agg[key];
      if (node && node.volume) {
        const conversion = node.volume ? `${Math.round((node.converted / node.volume) * 100)}%` : stage.conversion;
        const score = node.actions ? Math.round(node.score / Math.max(node.actions, 1)) : stage.intent;
        const health = conversion && parseFloat(conversion) < 25 ? 'Gargalo' : parseFloat(conversion) < 50 ? 'Atenção' : 'Saudável';
        return { ...stage, volume: node.volume, conversion, intent: score, health, gravity: Math.max(20, Math.min(90, Math.round(parseFloat(conversion) || stage.gravity))), insight: `${stage.area} ${stage.label} está sendo alimentado por ${node.actions} ação(ões) e ${node.okrs.length} OKR(s) operacional(is).`, action: 'Priorizar leitura dos OKRs da ação e do handoff para decidir próxima intervenção.', risk: node.handoffs ? 'Há travessia entre setores; sem SLA, o handoff pode gerar perda operacional.' : stage.risk };
      }

      // 3ª prioridade: default zerado (V32.15.6 reset)
      return stage;
    });
  },
  selectedStage() {
    const stages = this.getStages();
    return stages.find(stage => stage.id === App.state.selectedPipelineStageId) || stages[0];
  },
  selectedCampaign() { return App.state.campaigns.find(c => String(c.id) === String(App.state.selectedPipelineCampaignId)); },
  selectableActions() {
    if (App.state.selectedPipelineCampaignId === 'all') return App.state.actions;
    return App.state.actions.filter(action => String(action.campaignId) === String(App.state.selectedPipelineCampaignId));
  },

  filteredLeads() {
    const campaignId = App.state.selectedPipelineCampaignId;
    const actionId = App.state.selectedPipelineActionId;
    const actions = App.state.actions.filter(action => {
      const campaignMatch = campaignId === 'all' || String(action.campaignId) === String(campaignId);
      const actionMatch = actionId === 'all' || String(action.id) === String(actionId);
      return campaignMatch && actionMatch;
    });
    return actions.flatMap(action => ScoreEngine.actionLeads(action));
  },

  metrics() {
    const stages = this.getStages();
    const leads = this.filteredLeads();
    // V32.15.6 — Reset dos números de amostra. Sem leads reais → tudo zero/—.
    // Antes: fallbacks hardcoded (8420 people, +18%, 61 score, R$ 184k) davam
    // sensação de dados quando o pipeline estava vazio.
    const avgScore = leads.length
      ? Math.round(leads.reduce((sum, lead) => sum + Number(lead.score || 0), 0) / leads.length)
      : 0;
    const activeStages = stages.filter(stage => stage.active !== false);
    const totalVolume = stages.reduce((sum, s) => sum + Number(s.volume || 0), 0);
    return {
      people: leads.length || totalVolume,
      velocity: '—',
      avgScore,
      bottlenecks: activeStages.filter(stage => stage.health === 'Gargalo' || (stage.health !== 'Inativa' && stage.gravity < 45)).length,
      forecast: 'R$ 0',
      conversionRate: '—'
    };
  },

  // V33.0.0-alpha22 (Leonardo) — Versão chamada por LeadsModule sem hero
  // próprio. Hero "Leads" vem do pai; aqui rende só o strip de métricas +
  // Revenue Flow Map + stage panel. Elimina quebra vertical entre sub-tabs.
  renderInline() {
    this.ensureState();
    // V34.7.g — Auto-fetch banks pra popular dropdown de filtro (silencioso, 1x)
    if (!App.state.leadBanksCache?.loadedAt && window.Actions?.loadLeadBanks) {
      setTimeout(() => Actions.loadLeadBanks(), 0);
    }
    const metrics = this.metrics();
    const stage = this.selectedStage();
    return `<div class="journey-pipeline space-y-5">
      ${this._lightMetricsStrip(metrics)}
      <section class="bg-white rounded-[2rem] p-5 lg:p-8 shadow-sm border border-slate-100 overflow-hidden">
        <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-4"><div><h3 class="text-2xl font-black">Revenue Flow Map</h3><p class="text-sm text-slate-500 mt-1">Cada círculo pulsa conforme o volume, a saúde e a intenção média do estágio.</p></div><div class="flex items-center gap-3 text-xs font-black text-slate-500"><span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Saudável</span><span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Atenção</span><span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-red-500"></span> Gargalo</span></div></div>
        ${this.controls()}
        ${this.map()}
      </section>
      <section class="grid lg:grid-cols-3 gap-5">${this.stagePanel(stage)}${this.insightPanel(stage)}</section>
      ${this.modal()}
    </div>`;
  },

  // V33.0.0-alpha22 (Leonardo) — Strip CLARO de métricas dentro do conteúdo
  // do Pipeline (em vez de hero próprio escuro). Mantém continuidade visual
  // com o hero do Leads acima (escuro) e o Revenue Flow Map abaixo (claro).
  // 6 mini-cards em fundo branco com border-l colored pra hierarquia visual.
  _lightMetricsStrip(metrics) {
    return `<section class="bg-white rounded-[2rem] p-4 lg:p-5 shadow-sm border border-slate-100">
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="activity" class="w-4 h-4 text-slate-700"></i>
        <p class="text-[10px] font-black text-slate-600 uppercase tracking-widest">JourneyScore Labs · Indicadores</p>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        ${this._lightMetricCard('Pessoas no fluxo', this.formatNumber(metrics.people), 'users', 'sky')}
        ${this._lightMetricCard('Velocidade', metrics.velocity, 'gauge', 'violet')}
        ${this._lightMetricCard('Score médio', metrics.avgScore, 'star', 'amber')}
        ${this._lightMetricCard('Gargalos', metrics.bottlenecks, 'alert-triangle', 'rose')}
        ${this._lightMetricCard('Previsão', metrics.forecast, 'trending-up', 'emerald')}
        ${this._lightMetricCard('Conversion', metrics.conversionRate, 'arrow-right-left', 'indigo')}
      </div>
    </section>`;
  },

  _lightMetricCard(label, value, icon, tone) {
    return `<div class="bg-slate-50 border border-slate-200 border-l-4 border-l-${tone}-500 rounded-2xl p-3 min-w-0 overflow-hidden">
      <div class="flex items-center justify-between gap-2 mb-1">
        <p class="text-[9px] font-black text-${tone}-700 uppercase tracking-widest truncate">${label}</p>
        <i data-lucide="${icon}" class="w-3.5 h-3.5 text-${tone}-600 shrink-0"></i>
      </div>
      <div class="text-xl font-black text-slate-900 truncate">${value}</div>
    </div>`;
  },

  // V33.0.0-alpha19 — darkMetric mantido pra compat (se algum outro lugar
  // ainda chama metricCard com fundo escuro). Não usado em renderInline.
  metricCard(label, value, icon = 'circle') {
    return `<div class="bg-white/10 border border-white/10 rounded-2xl p-3 min-w-0 overflow-hidden">
      <div class="flex items-center justify-between gap-2">
        <p class="text-[11px] font-black text-slate-300 truncate">${label}</p>
        <i data-lucide="${icon}" class="w-3.5 h-3.5 text-slate-300 shrink-0"></i>
      </div>
      <div class="text-2xl font-black mt-1 truncate text-white">${value}</div>
    </div>`;
  },

  controls() {
    const campaignOptions = [`<option value="all">Todas as campanhas</option>`, ...App.state.campaigns.map(c => `<option value="${c.id}" ${String(App.state.selectedPipelineCampaignId) === String(c.id) ? 'selected' : ''}>${Utils.escape(c.name)}</option>`)].join('');
    const actionOptions = [`<option value="all">Todas as ações</option>`, ...this.selectableActions().map(a => `<option value="${a.id}" ${String(App.state.selectedPipelineActionId) === String(a.id) ? 'selected' : ''}>${Utils.escape(a.name)}</option>`)].join('');
    // V34.7.g — dropdown de banco (cross-filter campanha × banco).
    const banks = App.state.leadBanksCache?.banks || [];
    const selectedBankId = App.state.selectedPipelineBankId;
    const bankOptions = [
      `<option value="">Todos os bancos</option>`,
      ...banks.map(b => `<option value="${b.id}" ${String(selectedBankId) === String(b.id) ? 'selected' : ''}>${Utils.escape(b.name)} · ${b.visitor_count || 0} lead(s)</option>`)
    ].join('');
    return `<div class="grid md:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 w-full mb-6">
      <select onchange="JourneyPipelineModule.changeCampaign(this.value)" class="px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-800 font-black text-sm">${campaignOptions}</select>
      <select onchange="Actions.setPipelineBankFilter(this.value)" class="px-4 py-3 rounded-2xl bg-white border-2 border-amber-200 text-slate-800 font-black text-sm" title="Filtra leads do pipeline por banco de origem">${bankOptions}</select>
      <select onchange="JourneyPipelineModule.changeAction(this.value)" class="px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-800 font-black text-sm">${actionOptions}</select>
      <button onclick="JourneyPipelineModule.openStageModal()" class="px-4 py-3 rounded-2xl bg-slate-950 text-white font-black text-sm flex items-center justify-center gap-2"><i data-lucide="settings-2" class="w-4 h-4"></i> Editar fase</button>
      <button onclick="JourneyPipelineModule.toggleSelectedStageActive()" class="px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-800 font-black text-sm flex items-center justify-center gap-2"><i data-lucide="power" class="w-4 h-4"></i> Ativar/Desativar</button>
    </div>`;
  },

  map() {
    // V31.2.58 — Path SVG ajustado pras 9 bolinhas em x={40,192,345,497,650,802,955,1107,1260}.
    // V31.2.60 — Tracejados Marketing/Vendas/CS via HTML divs (não SVG line) pra
    // garantir visibilidade. SVG <line> não aparecia por algum motivo (provavelmente
    // contraste branco-sobre-claro do card). Divs com border-l-2 border-dashed
    // são absolute-positioned + bg gradient sutil pra reforço visual.
    return `<div class="relative h-[620px] lg:h-[420px] overflow-hidden"><div class="relative w-full h-full"><svg class="jp-pipeline-line" viewBox="0 0 1300 400" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="pipelineGradient" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#0f172a" /><stop offset="18%" stop-color="#2563eb" /><stop offset="36%" stop-color="#f59e0b" /><stop offset="54%" stop-color="#ef4444" /><stop offset="72%" stop-color="#10b981" /><stop offset="100%" stop-color="#6d28d9" /></linearGradient></defs><path class="jp-pipeline-path" d="M 60 120 L 217 200 L 373 280 Q 433 295 493 280 L 650 200 L 807 120 Q 867 105 927 120 L 1084 200 L 1240 280" /><path class="jp-pipeline-scan" d="M 60 120 L 217 200 L 373 280 Q 433 295 493 280 L 650 200 L 807 120 Q 867 105 927 120 L 1084 200 L 1240 280" /></svg><div class="absolute top-4 bottom-4 border-l-2 border-dashed border-slate-400" style="left: 33.308%; z-index: 1;"></div><div class="absolute top-4 bottom-4 border-l-2 border-dashed border-slate-400" style="left: 66.692%; z-index: 1;"></div><div class="jp-sector-label" style="left:13.538%; top:28px;">Marketing</div><div class="jp-sector-label" style="left:46.923%; top:28px;">Vendas</div><div class="jp-sector-label" style="left:80.308%; top:28px;">CS</div><div class="jp-particle"></div><div class="jp-particle p2"></div><div class="jp-particle p3"></div><div class="jp-particle p4"></div><div class="jp-particle p5"></div><div class="absolute inset-0 z-10">${this.nodes()}</div></div></div>`;
  },

  nodes() {
    // V31.2.64 — left em percentual de 1300 (sistema de coordenadas SVG viewBox).
    // Container agora é w-full então bolinhas seguem o tamanho real do container,
    // escalando junto com o SVG. Antes (pixel fixo) descolava em container largo.
    return this.getStages().map((stage, index) => {
      const inactive = stage.active === false;
      const pulse = stage.health === 'Gargalo' ? '1.15s' : stage.health === 'Atenção' ? '1.75s' : '2.55s';
      const leftPct = (stage.x / 1300 * 100).toFixed(3);
      return `<button onclick="JourneyPipelineModule.selectStage('${stage.id}')" class="jp-stage-node absolute flex flex-col items-center gap-3 text-center ${inactive ? 'opacity-40 grayscale' : ''}" style="left:${leftPct}%; top:${stage.y}px; transform: translate(-50%, -50%); animation-delay:${index * 80}ms"><div class="jp-stage-aura" style="background:${stage.color};"></div><div class="jp-stage-core" style="width:${stage.size}px; height:${stage.size}px; background: radial-gradient(circle at 30% 25%, rgba(255,255,255,.38), transparent 28%), ${stage.color}; animation-duration:${pulse}"><div><div class="text-xl font-black">${this.formatNumber(stage.volume)}</div><div class="text-[10px] uppercase tracking-wide opacity-80">pessoas</div></div></div><div><p class="font-black text-sm mt-1">${Utils.escape(stage.label)}</p><p class="text-xs text-slate-500">${Utils.escape(stage.area)}</p><div class="mt-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white/80 border border-slate-100 text-[10px] font-black text-slate-600"><span class="jp-health-dot w-2 h-2 rounded-full" style="background:${stage.color}"></span>${inactive ? 'Inativa' : Utils.escape(stage.health)}</div></div></button>`;
    }).join('');
  },

  stagePanel(stage) {
    const health = stage.active === false ? 'Inativa' : stage.health;
    const gravityLabel = stage.gravity >= 70 ? 'forte' : stage.gravity >= 50 ? 'média' : 'fraca';
    const gravityText = stage.gravity >= 70 ? 'Este estágio possui forte capacidade de puxar pessoas para o próximo movimento.' : stage.gravity >= 50 ? 'Este estágio ainda puxa leads, mas perde velocidade antes do próximo avanço.' : 'Este estágio está com baixa gravidade operacional e pode estar travando o fluxo.';
    return `<div class="lg:col-span-2 bg-white rounded-[2rem] p-5 lg:p-6 shadow-sm border border-slate-100"><div class="flex items-center justify-between gap-3 mb-5"><div><h3 class="text-2xl font-black">${Utils.escape(stage.label)}</h3><p class="text-sm text-slate-500">${Utils.escape(stage.area)} • estágio do fluxo operacional de receita</p></div><div class="px-4 py-2 rounded-2xl font-black text-sm ${this.healthClasses[health] || this.healthClasses['Atenção']}">${health}</div></div><div class="grid md:grid-cols-4 gap-3 mb-6">${Components.resultMetric('Volume', this.formatNumber(stage.volume))}${Components.resultMetric('Conversão', Utils.escape(stage.conversion))}${Components.resultMetric('Intenção', stage.intent)}${Components.resultMetric('Velocidade', Utils.escape(stage.velocity))}</div><div class="bg-slate-50 rounded-3xl p-4 border border-slate-100"><div class="flex items-center justify-between mb-3"><h4 class="font-black">Gravidade operacional</h4><span class="text-xs font-black text-slate-500">${gravityLabel}</span></div><div class="h-4 rounded-full bg-white border border-slate-100 overflow-hidden"><div class="h-full rounded-full bg-slate-950 jp-bar-fill" style="width: ${stage.gravity}%"></div></div><p class="text-sm text-slate-500 mt-3">${gravityText}</p></div></div>`;
  },

  insightPanel(stage) {
    return `<aside class="jp-dark-glass rounded-[2rem] p-5 lg:p-6 text-white jp-floating-card"><div class="flex items-center gap-2 mb-4"><div class="w-10 h-10 rounded-2xl bg-white/10 grid place-items-center"><i data-lucide="sparkles" class="w-5 h-5"></i></div><div><h3 class="font-black text-xl">RevOps AI</h3><p class="text-xs text-slate-300">Insight vivo da operação</p></div></div><p class="text-sm leading-relaxed text-slate-200 mb-5">${Utils.escape(stage.insight)}</p><div class="space-y-3"><div class="bg-white/8 rounded-2xl p-3 border border-white/10"><p class="text-xs font-black text-slate-300 mb-1">Ação recomendada</p><p class="text-sm font-semibold">${Utils.escape(stage.action)}</p></div><div class="bg-white/8 rounded-2xl p-3 border border-white/10"><p class="text-xs font-black text-slate-300 mb-1">Risco</p><p class="text-sm font-semibold">${Utils.escape(stage.risk)}</p></div></div></aside>`;
  },

  modal() {
    const stage = this.selectedStage();
    if (!App.state.showPipelineStageModal) return '';
    return `<div class="fixed inset-0 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"><div class="bg-white rounded-[2rem] shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-auto p-5 lg:p-6"><div class="flex items-start justify-between gap-4 mb-5"><div><h3 class="text-2xl font-black">Editar fase</h3><p class="text-sm text-slate-500">As fases são fixas no RevOps pragmático. Aqui você edita métricas, saúde, status e leitura operacional.</p></div><button onclick="JourneyPipelineModule.closeStageModal()" class="w-10 h-10 rounded-2xl bg-slate-100 grid place-items-center font-black">×</button></div><div class="grid md:grid-cols-2 gap-3">${this.input('stageFormLabel', 'Fase', stage.label, 'text', true)}${this.input('stageFormArea', 'Setor', stage.area, 'text', true)}${this.input('stageFormVolume', 'Volume', stage.volume, 'number')}${this.input('stageFormConversion', 'Conversão', stage.conversion)}${this.input('stageFormIntent', 'Intenção média', stage.intent, 'number')}${this.input('stageFormVelocity', 'Velocidade', stage.velocity)}<div><label class="text-xs font-black text-slate-500">Saúde</label><select id="stageFormHealth" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold">${['Saudável','Atenção','Gargalo','Inativa'].map(h => `<option ${h === (stage.active === false ? 'Inativa' : stage.health) ? 'selected' : ''}>${h}</option>`).join('')}</select></div><div><label class="text-xs font-black text-slate-500">Fase ativa?</label><select id="stageFormActive" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold"><option value="true" ${stage.active !== false ? 'selected' : ''}>Ativa</option><option value="false" ${stage.active === false ? 'selected' : ''}>Inativa</option></select></div>${this.input('stageFormGravity', 'Gravidade operacional', stage.gravity, 'number')}<div></div>${this.textarea('stageFormInsight', 'Insight RevOps', stage.insight)}${this.textarea('stageFormAction', 'Ação recomendada', stage.action)}${this.textarea('stageFormRisk', 'Risco', stage.risk)}</div><div class="flex flex-col md:flex-row gap-2 mt-5"><button onclick="JourneyPipelineModule.saveStageFromModal()" class="flex-1 px-5 py-3 rounded-2xl bg-slate-950 text-white font-black">Salvar fase</button><button onclick="JourneyPipelineModule.closeStageModal()" class="px-5 py-3 rounded-2xl bg-slate-100 font-black">Cancelar</button></div></div></div>`;
  },

  // V31.2.57 — Era 'text-slate-500' em input disabled (contraste insuficiente).
  // Trocado pra text-slate-700 que mantém aparência "desabilitada" sem ser ilegível.
  input(id, label, value, type = 'text', disabled = false) { return `<div><label class="text-xs font-black text-slate-500">${label}</label><input id="${id}" ${disabled ? 'disabled' : ''} type="${type}" value="${Utils.escape(value)}" class="w-full px-4 py-3 rounded-2xl ${disabled ? 'bg-slate-200 text-slate-700' : 'bg-slate-100'} font-semibold" /></div>`; },
  textarea(id, label, value) { return `<div class="md:col-span-2"><label class="text-xs font-black text-slate-500">${label}</label><textarea id="${id}" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold min-h-[80px]">${Utils.escape(value)}</textarea></div>`; },

  setLeadSubTab(tab) { App.state.activeLeadSubTab = tab; App.state.selectedLeadId = null; App.save(); App.render(); },
  selectStage(id) { App.state.selectedPipelineStageId = id; App.save(); App.render(); },
  changeCampaign(id) { App.state.selectedPipelineCampaignId = id; App.state.selectedPipelineActionId = 'all'; App.save(); App.render(); },
  changeAction(id) { App.state.selectedPipelineActionId = id; App.save(); App.render(); },
  openStageModal() { App.state.showPipelineStageModal = true; App.save(); App.render(); },
  closeStageModal() { App.state.showPipelineStageModal = false; App.save(); App.render(); },

  toggleSelectedStageActive() {
    const stage = this.selectedStage();
    const nextActive = stage.active === false;
    App.state.pipelineStages = this.getStages().map(item => item.id === stage.id ? { ...item, active: nextActive, health: nextActive && item.health === 'Inativa' ? 'Atenção' : item.health } : item);
    App.save(); App.render(); Utils.toast(nextActive ? 'Fase ativada.' : 'Fase desativada.');
  },

  saveStageFromModal() {
    const stage = this.selectedStage();
    const health = document.getElementById('stageFormHealth').value;
    const active = document.getElementById('stageFormActive').value === 'true' && health !== 'Inativa';
    const updated = {
      ...stage,
      volume: Number(document.getElementById('stageFormVolume').value || 0),
      conversion: document.getElementById('stageFormConversion').value.trim() || '0%',
      intent: Number(document.getElementById('stageFormIntent').value || 0),
      velocity: document.getElementById('stageFormVelocity').value.trim() || '0d',
      health: health === 'Inativa' ? stage.health : health,
      gravity: Number(document.getElementById('stageFormGravity').value || 50),
      active,
      insight: document.getElementById('stageFormInsight').value.trim() || 'Sem insight definido.',
      action: document.getElementById('stageFormAction').value.trim() || 'Sem ação recomendada.',
      risk: document.getElementById('stageFormRisk').value.trim() || 'Sem risco definido.'
    };
    App.state.pipelineStages = this.getStages().map(item => item.id === updated.id ? updated : item);
    App.state.showPipelineStageModal = false;
    App.save(); App.render(); Utils.toast('Fase atualizada.');
  },

  formatNumber(value) { return new Intl.NumberFormat('pt-BR').format(Number(value || 0)); }
};
window.JourneyPipelineModule = JourneyPipelineModule;
