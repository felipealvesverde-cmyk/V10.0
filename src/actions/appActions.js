var Actions = {
      selectCampaign(id) {
        const campaign = (App.state.campaigns || []).find(item => Number(item.id) === Number(id));
        if (!campaign) return Utils.toast('Campanha não encontrada.');
        App.state.selectedCampaignId = Number(id);
        App.state.selectedProductId = Number(campaign.productId || App.state.selectedProductId || 0) || App.state.selectedProductId;
        App.state.actionDraft.campaignId = Number(id);
        App.state.activeTab = 'actions';
        App.save(); App.render();
      },
      selectCampaignFromActions(id) { App.state.selectedCampaignId = id; App.state.actionDraft.campaignId = id; App.state.selectedActionId = null; App.save(); App.render(); },
      setLeadInputMode(mode) { App.state.actionDraft.leadInputMode = mode; App.save(); App.render(); },
  setMailingDefined(value) { App.state.actionDraft.mailingDefined = Boolean(value); if (!value) App.state.actionDraft.leadsText = ''; App.save(); App.render(); },
      updateActionChannel(id, channel) { App.state.actions = App.state.actions.map(action => action.id === id ? { ...action, channel, connected: false, connectionStatus: 'ready', status: 'Canal selecionado' } : action); App.save(); App.render(); Utils.toast('Canal atualizado. Conecte novamente.'); },
      connectAction(id) { App.state.actions = App.state.actions.map(action => action.id === id ? { ...action, connected: true, connectionStatus: 'ready', status: `Conectada ao ${action.channel}` } : action); App.save(); App.render(); Utils.toast('Canal conectado. Ação pronta para ativar.'); },
      toggleActionTransfer(id) { App.state.actions = App.state.actions.map(action => { if (action.id !== id || !action.connected) return action; const next = action.connectionStatus === 'active' ? 'idle' : 'active'; return { ...action, connectionStatus: next, status: next === 'active' ? `Ativa: trocando dados com ${action.channel}` : 'Sem troca de dados' }; }); App.save(); App.render(); Utils.toast('Status da troca atualizado.'); },
      openActionResult(id) { App.state.selectedActionId = id; App.state.activeTab = 'results'; App.save(); App.render(); },
      prepareNextActionFromResult(id) {
        const action = App.state.actions.find(item => item.id === id);
        if (!action) return;
        const hot = ScoreEngine.actionLeads(action).filter(lead => Number(lead.score || 0) >= 45);
        App.state.actionDraft = { campaignId: action.campaignId, name: `Próxima ação após ${action.name}`, channel: 'Meta Ads', objective: 'Continuar a jornada com os leads de maior score desta ação.', leadInputMode: 'manual', leadsText: hot.map(lead => `${lead.name}, ${lead.email}, ${lead.phone || ''}, ${lead.tags || ''}`).join('\n'), rdListName: '', scoreId: action.scoreId };
        App.state.selectedCampaignId = action.campaignId;
        App.state.activeTab = 'actions';
        App.save(); App.render(); Utils.toast('Nova ação preparada com leads filtrados do resultado.');
      },
      createScorePreset() {
        const d = App.state.scoreDraft;
        if (!d.name.trim()) return Utils.toast('Digite o nome do score.');
        const score = State.normalizeScore({ ...d, id: Date.now() });
        App.state.scores.unshift(score);
        App.state.selectedScoreId = score.id;
        App.state.scoreDraft = { name: '', description: '', tagRules: [{ tag: '#nova', score: 0 }] };
        App.save(); App.render(); Utils.toast('Score criado. Agora ele pode ser usado nas ações.');
      },
      selectScore(id) { App.state.selectedScoreId = id; App.save(); App.render(); },
      updateScoreField(id, field, value, shouldRender = true) { App.state.scores = App.state.scores.map(score => Number(score.id) === Number(id) ? { ...score, [field]: value } : score); App.save(); if (shouldRender) App.render(); },
      updateScoreTag(id, index, field, value, shouldRender = true) { App.state.scores = App.state.scores.map(score => { if (Number(score.id) !== Number(id)) return score; const rules = Utils.clone(score.tagRules); rules[index][field] = field === 'score' ? Number(value || 0) : value; return { ...score, tagRules: rules }; }); App.save(); if (shouldRender) App.render(); },
      addScoreTag(id) { App.state.scores = App.state.scores.map(score => Number(score.id) === Number(id) ? { ...score, tagRules: [...score.tagRules, { tag: '#nova', score: 0 }] } : score); App.save(); App.render(); },
      removeScoreTag(id, index) { App.state.scores = App.state.scores.map(score => Number(score.id) === Number(id) ? { ...score, tagRules: score.tagRules.filter((_, i) => i !== index) } : score); App.save(); App.render(); },
      addScoreDraftTag() { App.state.scoreDraft.tagRules.push({ tag: '#nova', score: 0 }); App.save(); App.render(); },
      removeScoreDraftTag(index) { App.state.scoreDraft.tagRules.splice(index, 1); App.save(); App.render(); },
      loadLeadExample() { App.state.actionDraft.leadsText = ['Nome do Lead, email@empresa.com, 48999999999, #tag_exemplo', 'Outro Lead, outro@email.com, 48988888888, #cta #mof'].join('\n'); App.save(); App.render(); },
      handleActionCSV(event) { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = e => { App.state.actionDraft.leadsText = String(e.target.result || '').trim(); App.save(); App.render(); Utils.toast('CSV importado.'); }; reader.readAsText(file); event.target.value = ''; },
      downloadCsvTemplate() { const csv = ['name,email,phone,tags', 'Nome do Lead,email@empresa.com,48999999999,#tag_exemplo', 'Outro Lead,outro@email.com,48988888888,#cta'].join('\n'); const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'modelo_leads_acao.csv'; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); },
      importFromRDMock() { const list = App.state.actionDraft.rdListName.trim() || 'Lista RD'; App.state.actionDraft.leadsText = [`Lead RD 1, lead1@empresa.com, 48991110001, #rd ${list}`, `Lead RD 2, lead2@empresa.com, 48991110002, #rd ${list}`].join('\n'); App.save(); App.render(); Utils.toast('Modelo de importação RD carregado.'); },
      openDashboardCampaign(id) { App.state.selectedDashboardCampaignId = id; App.save(); App.render(); },
      openLead(id) { App.state.selectedLeadId = id; App.state.activeTab = 'leads'; App.save(); App.render(); },
      openLeadImportModal() { App.state.showLeadImportModal = true; App.save(); App.render(); },
      closeLeadImportModal() { App.state.showLeadImportModal = false; App.save(); App.render(); },

      setLeadBaseInputMode(mode) { App.state.leadBaseInputMode = mode; App.save(); App.render(); },
      handleGlobalLeadCSV(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => { App.state.leadCsvText = String(e.target.result || '').trim(); App.save(); App.render(); Utils.toast('CSV carregado. Clique em importar para salvar na base.'); };
        reader.readAsText(file);
        event.target.value = '';
      },
      downloadGlobalLeadCsvTemplate() {
        const csv = ['Nome,Telefone,Email,Idade,Estado,Cidade,Estado Civil,Sexo,Faixa Salarial,Tags', 'Nome do Lead,48999999999,email@empresa.com,38,SC,Florianópolis,Casado(a),Feminino,R$ 5 mil a R$ 10 mil,#tag_exemplo', 'Outro Lead,48988888888,outro@email.com,42,SP,São Paulo,Solteiro(a),Masculino,R$ 10 mil a R$ 20 mil,#cta'].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'modelo_leads_globais.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      },
      resetDemo() { StorageAdapter.clear(); App.state = DatabaseService.emptyDataState(); App.render(); Utils.toast('Dados locais limpos. A pasta configurada não foi apagada automaticamente.'); },
      async applyProfileSearch() {
        const q = App.state.profileQuery || '';
        if (!String(q).trim()) {
          App.state.profileFilters = [];
          App.state.profileActive = false;
          App.save(); App.render();
          return;
        }

        Utils.toast('Interpretando busca com IA...');
        const interpretation = await AISearchClient.interpret(q);
        const filters = interpretation.filters || [];
        const warnings = interpretation.warnings || [];
        const allLeads = LeadsModule.getGlobalLeads();

        if (!filters.length && q.trim()) {
          Utils.searchLog('Não consegui interpretar a busca', [
            ...warnings,
            'A IA não conseguiu transformar sua frase em filtros seguros.',
            'Tente explicitar sexo, idade, estado/cidade, score, tags ou temperatura.'
          ], 'error');
          Utils.toast('Busca não interpretada.');
          return;
        }

        App.state.profileFilters = filters;
        App.state.profileActive = filters.length > 0;
        App.save(); App.render();

        if (filters.length) {
          const filtered = ProfileFinder.applyFilters(allLeads, filters);
          const sourceMessage = interpretation.source === 'openai'
            ? 'Fonte: IA no backend.'
            : 'Fonte: fallback local, porque a IA/backend ainda não respondeu.';

          if (!filtered.length) {
            Utils.searchLog('Busca sem resultado', [
              sourceMessage,
              ...warnings,
              ...(interpretation.messages || []),
              ...ProfileFinder.explainNoResults(allLeads, filters, q)
            ], 'warning');
          } else {
            const groupSearch = filters.some(filter => filter.type === 'or_segments');
            const logicMessage = groupSearch
              ? 'A busca foi interpretada como clusters de público somados por “E”. Exemplo: homens 20-30 + mulheres 30-40.'
              : 'A lógica usada foi: filtros diferentes afunilam juntos; múltiplos valores do mesmo campo entram como classes do perfil.';
            const logType = warnings.length || interpretation.source !== 'openai' ? 'warning' : 'success';
            const title = warnings.length ? 'Busca aplicada com alerta' : 'Busca aplicada';
            Utils.searchLog(title, [sourceMessage, ...warnings, `${filtered.length} lead(s) encontrado(s).`, 'Interpretação:', ...(interpretation.messages || []), logicMessage], logType);
          }
        }
      },
      refineProfile() {
        const input = document.getElementById('refineInput');
        if (!input) return;
        const q = input.value.trim();
        if (!q) return;
        const newFilters = ProfileFinder.parseQuery(q);
        if (!newFilters.length) {
          Utils.searchLog('Refino não interpretado', ['Use termos como: com telefone, score acima de 50, quente, SP, #cta.'], 'error');
          Utils.toast('Não entendi o refino.');
          return;
        }
        const existing = App.state.profileFilters.map(f => f.label);
        newFilters.forEach(f => { if (!existing.includes(f.label)) App.state.profileFilters.push(f); });
        App.state.profileActive = true;
        input.value = '';
        App.save(); App.render();
        const filtered = ProfileFinder.applyFilters(LeadsModule.getGlobalLeads(), App.state.profileFilters);
        if (!filtered.length) Utils.searchLog('Refino sem resultado', ProfileFinder.explainNoResults(LeadsModule.getGlobalLeads(), App.state.profileFilters, q), 'warning');
        else Utils.toast('Perfil refinado.');
      },
      removeProfileFilter(index) {
        App.state.profileFilters.splice(index, 1);
        if (!App.state.profileFilters.length) App.state.profileActive = false;
        App.save(); App.render();
      },
      clearProfile() {
        App.state.profileQuery = '';
        App.state.profileFilters = [];
        App.state.profileActive = false;
        App.save(); App.render();
        Utils.toast('Perfil limpo.');
      },
      createActionFromProfile() {
        const allLeads = LeadsModule.getGlobalLeads();
        const filtered = ProfileFinder.applyFilters(allLeads, App.state.profileFilters);
        if (!filtered.length) return Utils.toast('Nenhum lead no perfil.');
        const filtersDesc = App.state.profileFilters.map(f => f.label).join(', ');
        App.state.actionDraft = {
          campaignId: App.state.selectedCampaignId,
          name: `Ação: ${filtersDesc}`.substring(0, 60),
          channel: 'Meta Ads',
          objective: `Ação direcionada ao perfil: ${filtersDesc}`,
          leadInputMode: 'manual',
          leadsText: filtered.map(l => `${l.name}, ${l.email}, ${l.phone || ''}, ${l.tags.join(' ')}`).join('\n'),
          rdListName: '',
          scoreId: App.state.scores[0]?.id || 1
        };
        App.state.activeTab = 'actions';
        App.save(); App.render();
        Utils.toast(`${filtered.length} lead(s) carregados na nova ação.`);
      },
      createCampaignFromProfile() {
        const filtersDesc = App.state.profileFilters.map(f => f.label).join(', ');
        App.state.campaignDraft = {
          name: `Campanha: ${filtersDesc}`.substring(0, 60),
          objective: `Campanha para perfil: ${filtersDesc}`,
          okrs: Utils.clone(Config.emptyOkrs),
          owner: ''
        };
        App.state.activeTab = 'campaigns';
        App.save(); App.render();
        Utils.toast('Rascunho de campanha preparado.');
      }
    };
window.Actions = Actions;

// RevOps patches 1-5: operational overrides and helpers.
Object.assign(Actions, {
  createProduct() {
    const d = App.state.productDraft || {};
    if (!String(d.name || '').trim()) return Utils.toast('Digite o nome do produto.');
    const product = ProductRevenueEngine.normalize({
      id: Date.now(),
      name: d.name.trim(),
      type: d.type || '',
      price: d.price || '',
      revenueModel: d.revenueModel || 'Venda única',
      operationalCost: d.operationalCost || ''
    });
    App.state.products.unshift(product);
    App.state.selectedProductId = product.id;
    App.state.campaignDraft.productId = product.id;
    App.state.productDraft = { name: '', type: '', price: '', revenueModel: 'Venda única', operationalCost: '' };
    App.save(); App.render(); Utils.toast('Produto criado e pronto para receber campanhas.');
  },
  createCampaign() {
    const d = App.state.campaignDraft;
    if (!d.name.trim()) return Utils.toast('Digite o nome da campanha.');
    if (!d.productId) return Utils.toast('Selecione o produto vinculado.');
    const campaign = { id: Date.now(), productId: Number(d.productId), name: d.name.trim(), objective: d.objective.trim(), owner: d.owner.trim(), sector: d.sector || 'Marketing', status: 'Ativa', createdAt: new Date().toISOString() };
    App.state.campaigns.unshift(campaign);
    App.state.selectedCampaignId = campaign.id;
    App.state.selectedProductId = Number(d.productId);
    App.state.actionDraft.campaignId = campaign.id;
    App.state.campaignDraft = { name: '', objective: '', productId: App.state.selectedProductId, owner: '', sector: 'Marketing' };
    App.state.activeTab = 'actions';
    App.save(); App.render(); Utils.toast('Campanha criada. Agora crie ações com OKRs operacionais.');
  },
  updateActionContext(field, value) {
    App.state.actionDraft[field] = value;
    if (field === 'sector') App.state.actionDraft.originSector = value;
    if (field === 'funnel') App.state.actionDraft.originFunnel = value;
    App.state.actionDraft.okrs = OkrSuggestionEngine.defaultFor(App.state.actionDraft.sector, App.state.actionDraft.funnel, App.state.actionDraft.channel, App.state.actionDraft.actionType);
    App.save(); App.render();
  },
  updateActionDraftOkr(index, field, value) {
    App.state.actionDraft.okrs = App.state.actionDraft.okrs || [];
    App.state.actionDraft.okrs[index] = App.state.actionDraft.okrs[index] || { name: '', target: '', current: '' };
    App.state.actionDraft.okrs[index][field] = value;
    App.save();
  },
  addActionDraftOkr() { App.state.actionDraft.okrs = [...(App.state.actionDraft.okrs || []), { name: 'Novo OKR', target: '', current: '', unit: '', benchmark: '', trend: 'stable', health: 'Atenção' }]; App.save(); App.render(); },
  removeActionDraftOkr(index) { App.state.actionDraft.okrs = (App.state.actionDraft.okrs || []).filter((_, i) => i !== index); App.save(); App.render(); },
  createAction() {
    const d = App.state.actionDraft;
    if (!d.name.trim()) return Utils.toast('Digite o nome da ação.');
    const parsed = LeadParser.parse(d.leadsText, d.scoreId);
    const clean = LeadIdentityEngine.mergeMany([], parsed.map(({ score, ...lead }) => ({ ...lead, score })), d.name.trim()).map(({ score, ...lead }) => lead);
    const sector = d.sector || 'Marketing';
    const funnel = d.funnel || 'MOF';
    const originSector = d.originSector || sector;
    const originFunnel = d.originFunnel || funnel;
    const destinationSector = d.destinationSector || sector;
    const destinationFunnel = d.destinationFunnel || funnel;
    const flowPath = FlowResolutionEngine.resolve(originSector, originFunnel, destinationSector, destinationFunnel);
    const baseOkrs = State.normalizeOkrs(d.okrs || OkrSuggestionEngine.defaultFor(sector, funnel, d.channel, d.actionType));
    const action = {
      id: Date.now(),
      campaignId: App.state.selectedCampaignId,
      name: d.name.trim(),
      channel: d.channel,
      actionType: d.actionType || 'Post',
      sector, funnel,
      originSector, originFunnel, destinationSector, destinationFunnel,
      conversionObjective: d.conversionObjective || d.objective || '',
      objective: d.objective.trim(),
      expectedConversion: Number(d.expectedConversion || 25),
      mailingDefined: Boolean(d.mailingDefined),
      okrs: baseOkrs.map(okr => ({ ...okr, stageId: okr.stageId || flowPath[0] })),
      flowPath,
      scoreId: d.scoreId,
      connected: false,
      connectionStatus: 'ready',
      status: 'Pronta para conectar',
      leads: d.mailingDefined ? clean : [],
      flowConfig: FlowResolutionEngine.buildDefaultFlowConfig(flowPath, d.channel),
      createdAt: new Date().toISOString()
    };
    App.state.actions.unshift(action);
    App.state.selectedActionId = action.id;
    App.state.actionDraft = { ...State.initialActionDraft(), campaignId: App.state.selectedCampaignId, scoreId: App.state.scores[0]?.id || 1 };
    App.save(); App.render(); Utils.toast('Ação criada com OKRs e fluxo operacional.');
  },
  importManualLeadsFromText() {
    const text = String(App.state.leadManualText || '').trim();
    if (!text) return Utils.toast('Digite ao menos um lead para importar.');
    const leads = LeadParser.parseProfileCsv(text, App.state.scores[0]?.id || 1);
    if (!leads.length) return Utils.toast('Nenhum lead encontrado. Use: Nome, Telefone, Email, Idade, Estado, Cidade, Estado Civil, Sexo, Faixa Salarial, Tags');
    const clean = leads.map(({ score, ...lead }) => ({ ...lead, score, origem: 'manual', createdAt: new Date().toISOString() }));
    App.state.manualLeads = LeadIdentityEngine.mergeMany(App.state.manualLeads || [], clean, 'manual');
    App.state.leadManualText = '';
    App.state.showLeadImportModal = false;
    App.save(); App.render(); Utils.toast(`${clean.length} lead(s) triangulado(s) na base global.`);
  },
  addManualLead() {
    const d = App.state.leadDraft || {};
    if (!String(d.name || '').trim() && !String(d.email || '').trim() && !String(d.phone || '').trim()) return Utils.toast('Preencha pelo menos nome, email ou telefone.');
    const lead = LeadParser.normalizeLead({ ...d, origem: 'manual', createdAt: new Date().toISOString() }, App.state.manualLeads.length, App.state.scores[0]?.id || 1);
    App.state.manualLeads = LeadIdentityEngine.mergeMany(App.state.manualLeads || [], [lead], 'manual');
    App.state.leadDraft = { name: '', phone: '', email: '', idade: '', estado: '', cidade: '', estadoCivil: '', sexo: '', faixaSalarial: '', tags: '' };
    App.save(); App.render(); Utils.toast('Lead triangulado na base global.');
  },
  importGlobalLeadsFromCsv() {
    const leads = LeadParser.parseProfileCsv(App.state.leadCsvText, App.state.scores[0]?.id || 1);
    if (!leads.length) return Utils.toast('Nenhum lead encontrado no CSV.');
    const clean = leads.map(({ score, ...lead }) => ({ ...lead, score, origem: 'csv', createdAt: new Date().toISOString() }));
    App.state.manualLeads = LeadIdentityEngine.mergeMany(App.state.manualLeads || [], clean, 'csv');
    App.state.leadCsvText = '';
    App.state.showLeadImportModal = false;
    App.save(); App.render(); Utils.toast(`${clean.length} lead(s) triangulado(s) na base global.`);
  },

  openCampaignResults(id) { App.state.selectedResultCampaignId = id; App.state.selectedActionId = null; App.state.selectedCampaignId = id; App.state.activeTab = 'results'; App.save(); App.render(); },
  backToCampaignResults() { App.state.selectedActionId = null; App.save(); App.render(); },
  backToResultsCampaignList() { App.state.selectedResultCampaignId = null; App.state.selectedActionId = null; App.save(); App.render(); },
  openActionEditModal(actionId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return Utils.toast('Ação não encontrada.');
    App.state.actionEditDraft = JSON.parse(JSON.stringify(action));
    App.state.showActionEditModal = true;
    App.save(); App.render();
  },

  closeActionEditModal() {
    App.state.showActionEditModal = false;
    App.state.actionEditDraft = null;
    App.save(); App.render();
  },

  updateActionEditFieldSilent(field, value) {
    if (!App.state.actionEditDraft) return;
    App.state.actionEditDraft[field] = value;
    App.save();
  },

  updateActionEditField(field, value) {
    if (!App.state.actionEditDraft) return;
    App.state.actionEditDraft[field] = value;
    if (field === 'sector') App.state.actionEditDraft.originSector = value;
    if (field === 'funnel') App.state.actionEditDraft.originFunnel = value;
    App.save(); App.render();
  },

  addActionEditKpi() {
    if (!App.state.actionEditDraft) return;
    App.state.actionEditDraft.okrs = [...(App.state.actionEditDraft.okrs || []), { name: '', target: '', current: '', unit: '', benchmark: '', trend: 'stable', health: 'Atenção' }];
    App.save(); App.render();
  },

  removeActionEditKpi(index) {
    if (!App.state.actionEditDraft) return;
    App.state.actionEditDraft.okrs = (App.state.actionEditDraft.okrs || []).filter((_, i) => i !== index);
    App.save(); App.render();
  },

  updateActionEditKpiSilent(index, field, value) {
    if (!App.state.actionEditDraft) return;
    const list = App.state.actionEditDraft.okrs || [];
    if (!list[index]) return;
    list[index] = { ...list[index], [field]: value };
    App.state.actionEditDraft.okrs = list;
    App.save();
  },

  saveActionEdit() {
    const draft = App.state.actionEditDraft;
    if (!draft) {
      App.state.showActionEditModal = false;
      App.save(); App.render();
      return;
    }
    if (!String(draft.name || '').trim()) return Utils.toast('Digite o nome da ação.');
    const originSector = draft.originSector || draft.sector || 'Marketing';
    const originFunnel = draft.originFunnel || draft.funnel || 'MOF';
    const destinationSector = draft.destinationSector || originSector;
    const destinationFunnel = draft.destinationFunnel || originFunnel;
    const flowPath = FlowResolutionEngine.resolve(originSector, originFunnel, destinationSector, destinationFunnel);
    const sameFlow = Array.isArray(draft.flowConfig) && draft.flowConfig.length === flowPath.length && draft.flowConfig.every((step, i) => step.stageId === flowPath[i]);
    const flowConfig = sameFlow ? draft.flowConfig : FlowResolutionEngine.buildDefaultFlowConfig(flowPath, draft.channel);
    const previous = (App.state.actions || []).find(a => Number(a.id) === Number(draft.id));
    const channelChanged = Boolean(previous && previous.channel !== draft.channel);
    const next = {
      ...draft,
      name: String(draft.name).trim(),
      originSector,
      originFunnel,
      destinationSector,
      destinationFunnel,
      flowPath,
      flowConfig,
      connected: channelChanged ? false : Boolean(draft.connected),
      connectionStatus: channelChanged ? 'ready' : (draft.connectionStatus || 'ready'),
      status: channelChanged ? 'Canal selecionado' : (draft.status || 'Pronta para conectar')
    };
    // ORDEM CRÍTICA: fecha modal ANTES de mexer no array para evitar re-render no estado intermediário
    App.state.showActionEditModal = false;
    App.state.actionEditDraft = null;
    App.state.actions = (App.state.actions || []).map(a => Number(a.id) === Number(next.id) ? next : a);
    App.save();
    App.render();
    Utils.toast('Ação atualizada.');
  },

  deleteActionFromEdit() {
    const draft = App.state.actionEditDraft;
    if (!draft) return;
    App.state.actions = (App.state.actions || []).filter(a => Number(a.id) !== Number(draft.id));
    if (Number(App.state.selectedActionId) === Number(draft.id)) App.state.selectedActionId = null;
    App.state.showActionEditModal = false;
    App.state.actionEditDraft = null;
    App.save(); App.render();
    Utils.toast('Ação excluída.');
  },

  openActionFlowModal(id) { App.state.actionFlowModalId = id; App.state.showActionFlowModal = true; App.state.actionFlowEditMode = false; App.save(); App.render(); },
  closeActionFlowModal() { App.state.showActionFlowModal = false; App.state.actionFlowModalId = null; App.state.actionFlowEditMode = false; App.save(); App.render(); },
  toggleActionFlowEdit() { App.state.actionFlowEditMode = !App.state.actionFlowEditMode; App.save(); App.render(); },
  saveActionFlowConfig() { App.state.actionFlowEditMode = false; App.save(); App.render(); Utils.toast('Configuração do fluxo salva e aplicada.'); },
  updateActionFlowStep(actionId, index, field, value) {
    const action = App.state.actions.find(a => Number(a.id) === Number(actionId));
    if (!action) return;
    const path = action.flowPath || FlowResolutionEngine.resolve(action.originSector || action.sector, action.originFunnel || action.funnel, action.destinationSector || action.sector, action.destinationFunnel || action.funnel);
    action.flowConfig = action.flowConfig || FlowResolutionEngine.buildDefaultFlowConfig(path, action.channel);
    action.flowConfig[index] = action.flowConfig[index] || { stageId: path[index], enabled: true };
    if (field === 'manualConverted') action.flowConfig[index][field] = Math.max(0, Number(value || 0));
    else action.flowConfig[index][field] = value;
    App.save();
  },
  toggleActionFlowStep(actionId, index) {
    const action = App.state.actions.find(a => Number(a.id) === Number(actionId));
    if (!action) return;
    const path = action.flowPath || FlowResolutionEngine.resolve(action.originSector || action.sector, action.originFunnel || action.funnel, action.destinationSector || action.sector, action.destinationFunnel || action.funnel);
    action.flowConfig = action.flowConfig || FlowResolutionEngine.buildDefaultFlowConfig(path, action.channel);
    action.flowConfig[index] = action.flowConfig[index] || { stageId: path[index], enabled: true };
    action.flowConfig[index].enabled = !action.flowConfig[index].enabled;
    App.save(); App.render();
  },
  updateActionFlowOkr(actionId, index, field, value) {
    const action = App.state.actions.find(a => Number(a.id) === Number(actionId));
    if (!action) return;
    action.okrs = action.okrs || [];
    action.okrs[index] = action.okrs[index] || { name: '', target: '', current: '' };
    action.okrs[index][field] = value;
    App.save();
  },
  addActionFlowOkr(actionId) {
    const action = App.state.actions.find(a => Number(a.id) === Number(actionId));
    if (!action) return;
    action.okrs = [...(action.okrs || []), { id: `okr_${Date.now()}`, name: 'Novo OKR', target: '', current: '', unit: '', benchmark: '', trend: 'stable', health: 'Atenção', stageId: (action.flowPath || [])[0] || FlowResolutionEngine.stageId(action.originSector || action.sector, action.originFunnel || action.funnel) }];
    App.save(); App.render();
  },
  removeActionFlowOkr(actionId, index) {
    const action = App.state.actions.find(a => Number(a.id) === Number(actionId));
    if (!action) return;
    action.okrs = (action.okrs || []).filter((_, i) => i !== index);
    App.save(); App.render();
  },
  openCampaignFlowModal(id) { App.state.campaignFlowModalId = id; App.state.showCampaignFlowModal = true; App.save(); App.render(); },
  closeCampaignFlowModal() { App.state.showCampaignFlowModal = false; App.state.campaignFlowModalId = null; App.save(); App.render(); }
});
window.Actions = Actions;

// V10.4 - Products as master navigation layer.
Object.assign(Actions, {
  selectProduct(id) {
    App.state.selectedProductId = Number(id);
    App.state.campaignDraft.productId = Number(id);
    App.save(); App.render();
  },
  prepareCampaignForProduct(id) {
    if (!id) return Utils.toast('Selecione um produto para criar campanha.');
    App.state.selectedProductId = Number(id);
    App.state.campaignDraft = { ...App.state.campaignDraft, productId: Number(id), name: '', objective: '', owner: '', sector: 'Marketing' };
    App.state.showProductCampaignsModal = false;
    App.state.productCampaignsModalId = null;
    App.state.activeTab = 'campaigns';
    App.save(); App.render();
    Utils.toast('Campanha preparada e vinculada ao produto selecionado.');
  },
  viewProductCampaigns(id) {
    return this.openProductCampaignsModal(id);
  },
  openProductCampaignsModal(id) {
    const product = (App.state.products || []).find(item => Number(item.id) === Number(id));
    if (!product) return Utils.toast('Produto não encontrado.');
    App.state.selectedProductId = Number(id);
    App.state.campaignDraft.productId = Number(id);
    App.state.productCampaignsModalId = Number(id);
    App.state.showProductCampaignsModal = true;
    App.save(); App.render();
  },
  closeProductCampaignsModal() {
    App.state.showProductCampaignsModal = false;
    App.state.productCampaignsModalId = null;
    App.save(); App.render();
  },
  openProductConsolidatedFlow(id) {
    return this.openProductTotalFlowModal(id);
  },
  openProductTotalFlowModal(id = null) {
    if (!(App.state.products || []).length) return Utils.toast('Cadastre um produto para abrir o Fluxo Total de Produtos.');
    if (id) {
      const product = (App.state.products || []).find(item => Number(item.id) === Number(id));
      if (!product) return Utils.toast('Produto não encontrado.');
      App.state.selectedProductId = Number(id);
      App.state.productTotalFlowProductId = Number(id);
    } else {
      App.state.productTotalFlowProductId = null;
    }
    App.state.showProductTotalFlowModal = true;
    App.state.activeTab = 'products';
    App.save(); App.render();
  },
  selectProductInTotalFlow(id) {
    const product = (App.state.products || []).find(item => Number(item.id) === Number(id));
    if (!product) return Utils.toast('Produto não encontrado.');
    App.state.selectedProductId = Number(id);
    App.state.productTotalFlowProductId = Number(id);
    App.save(); App.render();
  },
  closeProductTotalFlowModal() {
    App.state.showProductTotalFlowModal = false;
    App.state.productTotalFlowProductId = null;
    App.save(); App.render();
  },
  editCampaignsForProduct(id) { return Actions.goToProductCampaigns(id); },
  clearCampaignProductFilter() {
    App.state.campaignProductFilterId = null;
    App.save(); App.render();
  },
  selectProductForCampaigns(value) {
    const id = value && String(value).trim() !== '' ? Number(value) : null;
    App.state.selectedProductId = Number.isFinite(id) ? id : null;
    App.save(); App.render();
  },
  openProductRevenueOverview(id) {
    const product = (App.state.products || []).find(item => Number(item.id) === Number(id));
    if (!product) return Utils.toast('Produto não encontrado.');
    App.state.selectedProductId = Number(id);
    App.state.revenueOverviewProductId = Number(id);
    App.state.showProductRevenueOverview = true;
    App.save(); App.render();
  },
  closeProductRevenueOverview() {
    App.state.showProductRevenueOverview = false;
    App.state.revenueOverviewProductId = null;
    App.save(); App.render();
  }
});



// V12.4.1 - Navegação operacional fluida.
Object.assign(Actions, {
  goToProduct(id) {
    const product = (App.state.products || []).find(item => Number(item.id) === Number(id));
    if (!product) return Utils.toast('Produto não encontrado.');
    App.goTo('products', { productId: Number(id) });
  },
  goToProductCampaigns(id) {
    const product = (App.state.products || []).find(item => Number(item.id) === Number(id));
    if (!product) return Utils.toast('Produto não encontrado.');
    App.goTo('campaigns', { productId: Number(id), campaignProductFilterId: Number(id) });
    Utils.toast('Campanhas filtradas para o produto selecionado.');
  },
  goToCampaignActions(id) {
    const campaign = (App.state.campaigns || []).find(item => Number(item.id) === Number(id));
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    App.goTo('actions', { productId: campaign.productId, campaignId: campaign.id });
  },
  prepareActionForCampaign(id) {
    const campaign = (App.state.campaigns || []).find(item => Number(item.id) === Number(id));
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    App.state.selectedCampaignId = Number(campaign.id);
    App.state.selectedProductId = Number(campaign.productId || App.state.selectedProductId || 0) || App.state.selectedProductId;
    App.state.actionDraft = { ...State.initialActionDraft(), campaignId: Number(campaign.id), scoreId: App.state.scores[0]?.id || 1 };
    App.state.showProductCampaignsModal = false;
    App.state.productCampaignsModalId = null;
    App.state.activeTab = 'actions';
    App.save(); App.render();
    Utils.toast('Ação preparada para a campanha selecionada.');
  },
  goToCampaignResults(id) {
    const campaign = (App.state.campaigns || []).find(item => Number(item.id) === Number(id));
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    App.state.selectedResultCampaignId = Number(id);
    App.state.selectedActionId = null;
    App.state.selectedCampaignId = Number(id);
    App.state.selectedProductId = Number(campaign.productId || App.state.selectedProductId || 0) || App.state.selectedProductId;
    App.state.showProductCampaignsModal = false;
    App.state.productCampaignsModalId = null;
    App.state.activeTab = 'results';
    App.save(); App.render();
  },
  goToLeadsJourney() {
    App.state.activeTab = 'leads';
    App.state.activeLeadSubTab = 'pipeline';
    App.save(); App.render();
  }
});


// V12.3.1 - Edit product and campaign modals.
Object.assign(Actions, {
  openProductEditModal(id) {
    const product = (App.state.products || []).find(item => Number(item.id) === Number(id));
    if (!product) return Utils.toast('Produto não encontrado.');
    App.state.editProductId = Number(id);
    App.state.showProductEditModal = true;
    App.save(); App.render();
  },
  closeProductEditModal() {
    App.state.showProductEditModal = false;
    App.state.editProductId = null;
    App.save(); App.render();
  },
  updateEditingProductField(field, value) {
    const index = (App.state.products || []).findIndex(item => Number(item.id) === Number(App.state.editProductId));
    if (index < 0) return;
    App.state.products[index] = { ...App.state.products[index], [field]: value };
    App.save();
  },
  saveProductEdit() {
    const index = (App.state.products || []).findIndex(item => Number(item.id) === Number(App.state.editProductId));
    if (index < 0) return Utils.toast('Produto não encontrado.');
    const current = App.state.products[index];
    if (!String(current.name || '').trim()) return Utils.toast('Digite o nome do produto.');
    App.state.products[index] = ProductRevenueEngine.normalize({ ...current, name: String(current.name).trim() }, index);
    App.state.selectedProductId = App.state.products[index].id;
    App.state.showProductEditModal = false;
    App.state.editProductId = null;
    App.save(); App.render(); Utils.toast('Produto atualizado.');
  },
  openCampaignEditModal(id) {
    const campaign = (App.state.campaigns || []).find(item => Number(item.id) === Number(id));
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    App.state.editCampaignId = Number(id);
    App.state.showCampaignEditModal = true;
    App.save(); App.render();
  },
  closeCampaignEditModal() {
    App.state.showCampaignEditModal = false;
    App.state.editCampaignId = null;
    App.save(); App.render();
  },
  updateEditingCampaignField(field, value) {
    const index = (App.state.campaigns || []).findIndex(item => Number(item.id) === Number(App.state.editCampaignId));
    if (index < 0) return;
    App.state.campaigns[index] = { ...App.state.campaigns[index], [field]: field === 'productId' ? Number(value) : value };
    if (field === 'productId') App.state.selectedProductId = Number(value);
    App.save();
  },
  saveCampaignEdit() {
    const index = (App.state.campaigns || []).findIndex(item => Number(item.id) === Number(App.state.editCampaignId));
    if (index < 0) return Utils.toast('Campanha não encontrada.');
    const campaign = App.state.campaigns[index];
    if (!String(campaign.name || '').trim()) return Utils.toast('Digite o nome da campanha.');
    if (!campaign.productId) return Utils.toast('Selecione o produto vinculado.');
    App.state.campaigns[index] = { ...campaign, name: String(campaign.name).trim(), objective: String(campaign.objective || '').trim(), owner: String(campaign.owner || '').trim(), sector: campaign.sector || 'Marketing', status: campaign.status || 'Ativa' };
    App.state.selectedCampaignId = App.state.campaigns[index].id;
    App.state.selectedProductId = Number(App.state.campaigns[index].productId);
    App.state.showCampaignEditModal = false;
    App.state.editCampaignId = null;
    App.save(); App.render(); Utils.toast('Campanha atualizada.');
  }
});
window.Actions = Actions;

// Database settings and connection patch.
Object.assign(Actions, {
  openSettingsModal() {
    App.state.showSettingsModal = true;
    App.state.settingsActiveSection = 'database';
    App.state.databaseConfig = DatabaseService.normalize(App.state.databaseConfig);
    App.save(); App.render();
  },
  closeSettingsModal() {
    App.state.showSettingsModal = false;
    App.save(); App.render();
  },
  selectDatabaseProvider(provider) {
    App.state.databaseConfig = DatabaseService.normalize({ ...(App.state.databaseConfig || {}), provider });
    App.state.databaseTestResult = null;
    App.save(); App.render();
  },
  selectAmazonDatabaseType(type) {
    const cfg = DatabaseService.normalize(App.state.databaseConfig);
    const selected = DatabaseService.amazonTypes.find(item => item.id === type) || DatabaseService.amazonTypes[0];
    cfg.amazon.type = selected.id;
    if (selected.port) cfg.amazon.port = selected.port;
    App.state.databaseConfig = cfg;
    App.state.databaseTestResult = null;
    App.save(); App.render();
  },
  updateDatabaseConfig(path, value, shouldRender = true) {
    const cfg = DatabaseService.normalize(App.state.databaseConfig);
    const keys = String(path || '').split('.').filter(Boolean);
    let target = cfg;
    while (keys.length > 1) {
      const key = keys.shift();
      target[key] = target[key] || {};
      target = target[key];
    }
    target[keys[0]] = value;
    App.state.databaseConfig = cfg;
    App.save();
    if (shouldRender) App.render();
  },
  async testDatabaseConnection() {
    if (App.state.databaseTesting) return;
    App.state.databaseTesting = true;
    App.save(); App.render();
    try {
      const result = await DatabaseService.testConnection(App.state.databaseConfig);
      App.state.databaseTestResult = result;
      App.state.databaseConfig = DatabaseService.normalize({ ...(App.state.databaseConfig || {}), lastTest: result });
      Utils.toast(result.ok ? '✓ Conexão validada.' : '⚠ A conexão precisa de ajustes.');
    } catch (error) {
      App.state.databaseTestResult = { ok: false, provider: App.state.databaseConfig?.provider || 'local', message: `Erro inesperado: ${error?.message || error}`, testedAt: new Date().toISOString() };
      Utils.toast('Falha no teste. Veja detalhes no card de status.');
    } finally {
      App.state.databaseTesting = false;
      App.save(); App.render();
    }
  },
  toggleDatabaseTutorial() {
    App.state.showDatabaseTutorial = !App.state.showDatabaseTutorial;
    App.save(); App.render();
  },

  // Canais e tipos customizados
  addCustomChannel() {
    const name = String(prompt('Nome do novo canal:') || '').trim();
    if (!name) return;
    App.state.customChannels = App.state.customChannels || [];
    if (App.state.customChannels.includes(name) || Config.channels.includes(name)) {
      Utils.toast('Esse canal já existe.');
      return;
    }
    App.state.customChannels.push(name);
    if (App.state.actionDraft) App.state.actionDraft.channel = name;
    App.save(); App.render();
    Utils.toast(`Canal "${name}" cadastrado.`);
  },

  addCustomActionType() {
    const name = String(prompt('Nome do novo tipo:') || '').trim();
    if (!name) return;
    App.state.customActionTypes = App.state.customActionTypes || [];
    if (App.state.customActionTypes.includes(name) || Config.actionTypes.includes(name)) {
      Utils.toast('Esse tipo já existe.');
      return;
    }
    App.state.customActionTypes.push(name);
    if (App.state.actionDraft) App.state.actionDraft.actionType = name;
    App.save(); App.render();
    Utils.toast(`Tipo "${name}" cadastrado.`);
  },

  setActionsListFilter(stageOrAll) {
    App.state.actionsListFilter = stageOrAll || 'all';
    App.save(); App.render();
  },

  setActionCreateTab(tab) {
    App.state.actionCreateTab = tab === 'ai' ? 'ai' : 'manual';
    App.save(); App.render();
  },

  updateActionAiDraft(field, value) {
    App.state.actionAiDraft = App.state.actionAiDraft || { prompt: '', count: 3 };
    if (field === 'count') App.state.actionAiDraft.count = Math.max(1, Math.min(20, Number(value || 1)));
    else App.state.actionAiDraft[field] = value;
    App.save();
  },

  generateActionsViaAI() {
    const ai = App.state.actionAiDraft || { prompt: '', count: 3 };
    const prompt = String(ai.prompt || '').trim();
    const count = Math.max(1, Math.min(20, Number(ai.count || 3)));
    if (!prompt) return Utils.toast('Descreva o comando de geração antes.');
    const campaign = App.getSelectedCampaign();
    if (!campaign) return Utils.toast('Selecione uma campanha primeiro.');
    Utils.toast(`Em breve: integração de IA para gerar ${count} ação(ões) a partir do comando.`);
  },

  setFlowBuilderStartFilter(stageOrAll) {
    App.state.flowBuilderStartFilter = stageOrAll || 'all';
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  setFlowBuilderZoom(delta) {
    const current = Number(App.state.flowBuilderZoom || 1.0);
    const next = Math.max(0.5, Math.min(2.0, Math.round((current + delta) * 100) / 100));
    App.state.flowBuilderZoom = next;
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  resetFlowBuilderZoom() {
    App.state.flowBuilderZoom = 1.0;
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  toggleFlowBuilderHelp() {
    App.state.flowBuilderShowHelp = !App.state.flowBuilderShowHelp;
    App.save(); App.render();
  },

  armFlowConnection(actionId) {
    const current = App.state.flowBuilderConnectionArm;
    App.state.flowBuilderConnectionArm = (Number(current) === Number(actionId)) ? null : Number(actionId);
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  cancelFlowConnection() {
    App.state.flowBuilderConnectionArm = null;
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  requestFlowDisconnect(fromId, toId) {
    App.state.flowDisconnectConfirm = { fromId: Number(fromId), toId: Number(toId) };
    App.save(); App.render();
  },

  confirmFlowDisconnect() {
    const pending = App.state.flowDisconnectConfirm;
    App.state.flowDisconnectConfirm = null;
    if (!pending) { App.render(); return; }
    if (window.FlowConnectionEngine) FlowConnectionEngine.disconnect(pending.fromId, pending.toId);
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
    Utils.toast('Conexão removida.');
  },

  cancelFlowDisconnect() {
    App.state.flowDisconnectConfirm = null;
    App.save(); App.render();
  },

  // V15.1 — Flow Builder actions
  openFlowBuilder(campaignId) {
    if (!campaignId) return Utils.toast('Selecione uma campanha.');
    App.state.flowBuilderCampaignId = Number(campaignId);
    App.state.showFlowBuilderModal = true;
    App.save(); App.render();
    setTimeout(() => { try { if (window.ActionFlowBuilder) ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  closeFlowBuilder() {
    App.state.showFlowBuilderModal = false;
    App.state.flowBuilderCampaignId = null;
    App.save(); App.render();
  },

  connectFlow(fromId, toId) {
    if (!window.FlowConnectionEngine) return;
    const result = FlowConnectionEngine.connect(fromId, toId);
    if (!result.ok) return Utils.toast(result.message);
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  disconnectFlow(fromId, toId) {
    if (!window.FlowConnectionEngine) return;
    FlowConnectionEngine.disconnect(fromId, toId);
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  toggleFlowEnabled(actionId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return;
    const enabled = !(action.flow?.enabled);
    FlowConnectionEngine.enableFlow(actionId, enabled);
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
  },

  dropActionToFlowCanvas(actionId, x, y) {
    if (!window.FlowConnectionEngine) return;
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return;
    if (!action.flow?.enabled) FlowConnectionEngine.enableFlow(actionId, true);
    FlowConnectionEngine.setPosition(actionId, x, y);
    App.save(); App.render();
    setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
    Utils.toast('Ação trazida para o canvas.');
  },

  setFlowActionType(actionId, typeId) {
    if (!window.FlowConnectionEngine) return;
    FlowConnectionEngine.setActionType(actionId, typeId);
    App.save(); App.render();
  },

  setFlowStages(actionId, startStage, endStage) {
    if (!window.FlowConnectionEngine) return;
    FlowConnectionEngine.setStages(actionId, startStage, endStage);
    App.save(); App.render();
  },

  // V15 — Landing Page actions
  openLpModal(actionId = null) {
    const action = actionId ? (App.state.actions || []).find(a => Number(a.id) === Number(actionId)) : null;
    App.state.lpDraft = window.LpRegistry ? LpRegistry.draftFromAction(action) : null;
    App.state.showLpModal = true;
    App.save(); App.render();
  },

  closeLpModal() {
    App.state.showLpModal = false;
    App.state.lpDraft = null;
    App.save(); App.render();
  },

  updateLpDraftFieldSilent(field, value) {
    if (!App.state.lpDraft) return;
    App.state.lpDraft[field] = value;
    App.save();
  },

  updateLpDraftField(field, value) {
    if (!App.state.lpDraft) return;
    App.state.lpDraft[field] = value;
    App.save(); App.render();
  },

  addLpCheckpoint() {
    if (!App.state.lpDraft || !window.FlowCheckpointEngine) return;
    App.state.lpDraft.checkpoints = [...(App.state.lpDraft.checkpoints || []), FlowCheckpointEngine.emptyCheckpoint()];
    App.save(); App.render();
  },

  removeLpCheckpoint(checkpointId) {
    if (!App.state.lpDraft) return;
    App.state.lpDraft.checkpoints = (App.state.lpDraft.checkpoints || []).filter(c => c.id !== checkpointId);
    App.save(); App.render();
  },

  updateLpCheckpointSilent(checkpointId, field, value) {
    if (!App.state.lpDraft) return;
    App.state.lpDraft.checkpoints = (App.state.lpDraft.checkpoints || []).map(c => {
      if (c.id !== checkpointId) return c;
      return { ...c, [field]: field === 'scoreDelta' ? Number(value || 0) : value };
    });
    App.save();
  },

  updateLpCheckpoint(checkpointId, field, value) {
    this.updateLpCheckpointSilent(checkpointId, field, value);
    App.render();
  },

  reorderLpCheckpoint(checkpointId, direction) {
    if (!App.state.lpDraft) return;
    const list = App.state.lpDraft.checkpoints || [];
    const index = list.findIndex(c => c.id === checkpointId);
    if (index < 0) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= list.length) return;
    const next = [...list];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    App.state.lpDraft.checkpoints = next;
    App.save(); App.render();
  },

  saveLpAction() {
    const draft = App.state.lpDraft;
    if (!draft) return;
    if (!String(draft.name || '').trim()) return Utils.toast('Dê um nome à LP.');
    if (!draft.url || !/^https?:\/\//i.test(draft.url)) return Utils.toast('Informe uma URL válida (http:// ou https://).');
    if (!draft.campaignId) return Utils.toast('Selecione uma campanha.');

    const isEdit = Boolean(draft.actionId);
    if (isEdit) {
      App.state.actions = (App.state.actions || []).map(action => {
        if (Number(action.id) !== Number(draft.actionId)) return action;
        return LpRegistry.applyDraftToAction(action, draft);
      });
    } else {
      const action = LpRegistry.buildActionFromDraft(draft);
      App.state.actions = [action, ...(App.state.actions || [])];
      App.state.selectedActionId = action.id;
    }
    App.state.lpRegistry = App.state.lpRegistry || {};
    App.state.lpRegistry[draft.lpId] = LpRegistry.buildRegistryEntry(draft);
    App.state.showLpModal = false;
    App.state.lpDraft = null;
    App.save(); App.render();
    Utils.toast(isEdit ? 'LP atualizada.' : 'LP criada.');
  },

  copyLpTrackingScript() {
    const draft = App.state.lpDraft;
    if (!draft || !window.LpRegistry) return;
    const script = LpRegistry.buildTrackingScript(draft);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(script).then(() => Utils.toast('✓ Script copiado. Cole no <head> da LP no RD.'));
    } else {
      Utils.toast('Selecione o script manualmente e copie.');
    }
  },

  async validateLpInstallation() {
    const draft = App.state.lpDraft;
    if (!draft || !window.LpRegistry) return;
    Utils.toast('Verificando eventos recebidos da LP...');
    const status = await LpRegistry.checkInstallation(draft);
    Utils.toast(status.message);
    App.render();
  },

  async pollLpEvents() {
    if (!window.EventCollector) return;
    const result = await EventCollector.poll();
    if (result?.applied) Utils.toast(`✓ ${result.applied} evento(s) RD aplicados.`);
  },

  // V15 — RD CRM actions
  _ensureRdCrmConfig() {
    App.state.integrations = App.state.integrations || {};
    if (!App.state.integrations.rdCrm) App.state.integrations.rdCrm = window.RdCrmConfig ? RdCrmConfig.defaultConfig() : {};
    return App.state.integrations.rdCrm;
  },

  async testRdCrmConnection() {
    const cfg = this._ensureRdCrmConfig();
    // V22.3.4 — Gate é CRM PAT, não OAuth (que é opcional p/ Marketing).
    if (!RdCrmConfig.hasCrmToken()) {
      cfg.lastSyncStatus = 'no_crm_token';
      cfg.lastSyncMessage = 'CRM Personal Token ausente.';
      App.save(); App.render();
      return Utils.toast('Configure o CRM Personal Token primeiro.');
    }
    Utils.toast('Testando conexão RD CRM...');
    const result = await RdCrmPipelineService.listPipelines();
    if (result.ok) {
      cfg.lastSyncStatus = 'success';
      cfg.lastSyncMessage = `Conexão OK • ${(result.pipelines || []).length} pipeline(s) acessíveis.`;
      Utils.toast('✓ Conexão RD CRM validada.');
    } else {
      cfg.lastSyncStatus = 'error';
      cfg.lastSyncMessage = result.message || 'Falha desconhecida ao testar.';
      Utils.toast('Falha ao conectar. Veja o card de status.');
    }
    App.save(); App.render();
  },

  async listRdCrmPipelines() {
    const cfg = this._ensureRdCrmConfig();
    Utils.toast('Listando pipelines do RD...');
    const result = await RdCrmPipelineService.listPipelines();
    if (!result.ok) {
      cfg.lastSyncStatus = 'pipeline_error';
      cfg.lastSyncMessage = result.message;
      App.save(); App.render();
      return Utils.toast(`Falha: ${result.message}`);
    }
    cfg.lastSyncStatus = 'success';
    cfg.lastSyncMessage = `${(result.pipelines || []).length} pipeline(s) encontrados.`;
    App.save(); App.render();
    Utils.toast(cfg.lastSyncMessage);
  },

  // V21.6 — Legacy: cria um pipeline global "Journey Revenue Pipeline" no RD.
  // Mantido para compat com botão antigo, mas a recomendação é usar
  // syncAllCampaignPipelines / syncCampaignPipeline (1 pipeline por campanha).
  async createJourneyRevenuePipeline() {
    const cfg = this._ensureRdCrmConfig();
    if (!RdCrmConfig.hasCrmToken()) return Utils.toast('Configure o CRM Personal Token primeiro.');
    Utils.toast('Criando Journey Revenue Pipeline no RD...');
    const result = await RdCrmPipelineService.createUniqueJourneyPipeline();
    if (!result.ok) {
      cfg.lastSyncStatus = 'pipeline_error';
      cfg.lastSyncMessage = result.message;
      App.save(); App.render();
      return Utils.toast(`Falha: ${result.message}`);
    }
    cfg.pipelineId = result.pipeline?.id || result.pipeline?._id || '';
    cfg.pipelineName = result.name || result.pipeline?.name || RdCrmConfig.defaultPipelineName;
    if (result.collisionAvoided) {
      Utils.toast(`Já existia "${result.requestedName}" no RD. Criamos "${cfg.pipelineName}" para não tocar no seu.`);
    }
    const stages = await RdCrmStageService.ensureJourneyStages(cfg.pipelineId);
    if (!stages.ok) {
      cfg.lastSyncStatus = 'stages_error';
      cfg.lastSyncMessage = stages.message;
      App.save(); App.render();
      return Utils.toast(`Pipeline OK, mas etapas falharam: ${stages.message}`);
    }
    cfg.stageMap = stages.stageMap;
    cfg.lastSyncStatus = 'success';
    cfg.lastSyncMessage = result.created
      ? `Pipeline criado e ${stages.created.length} etapa(s) criadas no RD.`
      : `Pipeline já existente conectado. ${stages.created.length} etapa(s) novas, ${stages.reused.length} reusadas.`;
    cfg.lastSyncAt = new Date().toISOString();
    App.save(); App.render();
    Utils.toast('✓ ' + cfg.lastSyncMessage);
  },

  // V21.6 — Sincroniza UMA campanha específica (cria pipeline próprio + 9 stages).
  async syncCampaignPipeline(campaignId) {
    if (!RdCrmConfig.hasCrmToken()) return Utils.toast('Configure o CRM Personal Token primeiro.');
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    Utils.toast(`Sincronizando pipeline da campanha "${campaign.name}"...`);
    const result = await RdCrmSyncEngine.runSync({ campaignId: campaign.id });
    Utils.toast(result.ok ? `✓ ${result.message}` : `Falha: ${result.message}`);
  },

  // V22.0 — Alias semântico do botão "Gerar Pipeline" no card da campanha.
  // Encapsula a mesma lógica de syncCampaignPipeline mas com toast de UX
  // mais direto pra esse contexto.
  async generateCampaignPipeline(campaignId) {
    if (!RdCrmConfig.hasCrmToken()) return Utils.toast('Configure o CRM Personal Token em Configurações → RD Station primeiro.');
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    Utils.toast(`Gerando pipeline no RD para "${campaign.name}"...`);
    const result = await RdCrmSyncEngine.runSync({ campaignId: campaign.id });
    if (result.ok) {
      Utils.toast(`✓ Pipeline criado no RD: "${campaign.name}".`);
    } else {
      Utils.toast(`Falha ao gerar pipeline: ${result.message}`);
    }
  },

  // V22.0 — Envia ICP da campanha (todos os leads vinculados a ela) pro RD.
  // Para cada lead: upsertContact + createDeal no Marketing TOF da campanha.
  // Reusa deals existentes via dealsByLead (idempotente).
  async pushCampaignICPToRD(campaignId) {
    if (!RdCrmConfig.hasCrmToken()) return Utils.toast('Configure o CRM Personal Token primeiro.');
    if (!RdCrmConfig.hasPipelineForCampaign(campaignId)) {
      return Utils.toast('Gere o pipeline da campanha antes de enviar leads.');
    }
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    const pipelineInfo = RdCrmConfig.pipelineInfoForCampaign(campaignId);
    const stageMap = pipelineInfo?.stageMap || {};
    // V22.0 — Stage inicial: Marketing TOF (primeira do funil).
    const initialStage = stageMap.mkt_tof;
    if (!initialStage?.rdStageId) {
      return Utils.toast('Stage "Marketing TOF" não encontrada. Resincronize o pipeline.');
    }
    // V22.0/22.1 — Produto da campanha p/ derivar ticket médio inicial.
    // V22.1: prefere product.priceValue (já parseado pelo normalize) sobre
    // product.price (string crua). Fallback p/ parse manual.
    const product = (App.state.products || []).find(p => Number(p.id) === Number(campaign.productId));
    const productPrice = Number(product?.priceValue) > 0
      ? Number(product.priceValue)
      : (window.ProductRevenueEngine?.parseMoney
        ? ProductRevenueEngine.parseMoney(product?.price || product?.ticket || 0)
        : Number(String(product?.price || product?.ticket || '0').replace(/[^\d.,-]/g, '').replace(',', '.')) || 0);

    const leads = window.LeadBaseService?.forCampaign?.(campaignId) || [];
    if (!leads.length) {
      return Utils.toast('Nenhum lead vinculado a essa campanha.');
    }

    Utils.toast(`Enviando ${leads.length} lead(s) pro RD...`);
    let success = 0, skipped = 0, failed = 0;
    const failures = [];

    for (const lead of leads) {
      const leadKey = LeadBaseService.keyOf(lead);
      if (!leadKey) { failed += 1; continue; }
      // Já tem deal pra esse lead nessa campanha? Skip (idempotência).
      const existing = RdCrmConfig.dealForLead(leadKey, campaignId);
      if (existing?.rdDealId) { skipped += 1; continue; }
      try {
        const contactRes = await RdCrmContactService.upsertContact(lead);
        if (!contactRes.ok) {
          failed += 1;
          failures.push(`${lead.email || lead.name}: ${contactRes.message}`);
          continue;
        }
        // V22.1 — Usa internalId formatado como L-XXXXXX (últimos 6 chars
        // do id original). Fallback p/ primeiros 8 chars do leadKey.
        const idShort = lead.internalId
          ? `L-${String(lead.internalId).slice(-6)}`
          : `L-${String(leadKey).replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase()}`;
        const dealName = `${lead.name || lead.email} – ${idShort}`;
        const dealRes = await RdCrmDealService.createDeal({
          rdContactId: contactRes.rdContactId,
          pipelineId: pipelineInfo.pipelineId,
          stageId: initialStage.rdStageId,
          name: dealName,
          amount: productPrice
        });
        if (!dealRes.ok) {
          failed += 1;
          failures.push(`${lead.email || lead.name}: ${dealRes.message}`);
          continue;
        }
        RdCrmConfig.setDealForLead(leadKey, campaignId, {
          rdDealId: dealRes.rdDealId,
          rdContactId: contactRes.rdContactId,
          currentStageCode: 'mkt_tof',
          amount: productPrice,
          createdAt: new Date().toISOString(),
          lastMovedAt: new Date().toISOString()
        });
        success += 1;
      } catch (err) {
        failed += 1;
        failures.push(`${lead.email || lead.name}: ${err?.message || err}`);
      }
    }
    App.save();
    App.render();
    const msg = `${success} enviado(s), ${skipped} já existente(s), ${failed} falha(s).${failures.length ? ` Detalhes: ${failures.slice(0, 3).join('; ')}` : ''}`;
    Utils.toast(failed ? `⚠ ${msg}` : `✓ ${msg}`);
  },

  // V21.6 — Sincroniza TODAS as campanhas elegíveis (com ações, leads ou blueprint).
  async syncAllCampaignPipelines() {
    if (!RdCrmConfig.hasCrmToken()) return Utils.toast('Configure o CRM Personal Token primeiro.');
    Utils.toast('Sincronizando pipelines de todas as campanhas elegíveis...');
    const result = await RdCrmSyncEngine.runSync();
    Utils.toast(result.ok ? `✓ ${result.message}` : `Falha: ${result.message}`);
  },

  async listRdCrmStages() {
    const cfg = this._ensureRdCrmConfig();
    if (!cfg.pipelineId) return Utils.toast('Conecte um pipeline primeiro.');
    Utils.toast('Listando etapas do RD...');
    const result = await RdCrmStageService.listStages(cfg.pipelineId);
    if (!result.ok) {
      cfg.lastSyncMessage = result.message;
      App.save(); App.render();
      return Utils.toast(`Falha: ${result.message}`);
    }
    cfg.lastSyncMessage = `${(result.stages || []).length} etapa(s) lidas do RD.`;
    App.save(); App.render();
    Utils.toast(cfg.lastSyncMessage);
  },

  async runRdCrmSyncNow() {
    const result = await RdCrmSyncEngine.runSync();
    Utils.toast(result.ok ? `✓ ${result.message || 'Sync RD CRM concluído.'}` : `Falha: ${result.message}`);
  },

  toggleRdCrmAutoSync() {
    const cfg = this._ensureRdCrmConfig();
    if (cfg.autoSync) {
      RdCrmSyncEngine.stopAutoSync();
      Utils.toast('Sync automático RD CRM desativado.');
    } else {
      if (!RdCrmConfig.hasCrmToken()) {
        Utils.toast('Configure o CRM Personal Token primeiro.');
        return;
      }
      RdCrmSyncEngine.startAutoSync();
      Utils.toast('Sync automático ativado (5 min).');
    }
    App.save(); App.render();
  },

  setRdCrmAutoSyncMode(mode) {
    const cfg = this._ensureRdCrmConfig();
    cfg.autoSyncMode = ['frontend', 'electron', 'backend'].includes(mode) ? mode : 'frontend';
    if (cfg.autoSync) {
      RdCrmSyncEngine.stopAutoSync(false);
      RdCrmSyncEngine.startAutoSync();
    }
    App.save(); App.render();
  },

  linkActionToRdCrm(actionId, payload) {
    const result = RdCrmActionMapper.linkAction(actionId, payload || {});
    if (!result.ok) return Utils.toast(result.message);
    App.save(); App.render();
    Utils.toast('Ação vinculada ao pipeline RD CRM.');
  },

  unlinkActionFromRdCrm(actionId) {
    const result = RdCrmActionMapper.unlinkAction(actionId);
    if (!result.ok) return Utils.toast(result.message);
    App.save(); App.render();
    Utils.toast('Vínculo com RD CRM removido.');
  },
  saveDatabaseConfig() {
    const cfg = DatabaseService.normalize(App.state.databaseConfig);
    cfg.savedAt = new Date().toISOString();
    App.state.databaseConfig = cfg;
    App.save(); App.render();
    Utils.toast(`Configuração ${DatabaseService.providerLabel(cfg.provider)} salva.`);
  },
  async chooseLocalDatabaseFolder() {
    Utils.toast('Abrindo seleção de pasta local...');
    const result = await DatabaseService.chooseLocalDirectory(App.state.databaseConfig);
    const cfg = DatabaseService.normalize(App.state.databaseConfig);
    if (result.ok) {
      cfg.provider = 'local';
      cfg.local.folderLabel = result.label || result.handle?.name || cfg.local.folderLabel || 'Pasta autorizada';
      cfg.local.folderPath = result.path || cfg.local.folderPath || cfg.local.folderLabel;
      cfg.local.lastFolderPermission = new Date().toISOString();
      App.state.databaseConfig = cfg;
      App.save(); App.render();
    }
    Utils.toast(result.message);
  },
  async writeLocalFolderSnapshot() {
    Utils.toast('Salvando snapshot na pasta local...');
    const result = await DatabaseService.writeSnapshotToFolder(App.state, App.state.databaseConfig);
    const cfg = DatabaseService.normalize(App.state.databaseConfig);
    if (result.ok) {
      cfg.provider = 'local';
      cfg.local.folderLabel = result.folderLabel || cfg.local.folderLabel;
      cfg.local.folderPath = result.folderPath || cfg.local.folderPath;
      cfg.local.lastFolderWriteAt = result.savedAt || new Date().toISOString();
      cfg.lastTest = { ok: true, provider: 'local', message: result.message, testedAt: cfg.local.lastFolderWriteAt };
      App.state.databaseConfig = cfg;
      App.state.databaseTestResult = cfg.lastTest;
      App.save(); App.render();
    }
    Utils.toast(result.message);
  },
  async readLocalFolderSnapshot() {
    Utils.toast('Lendo snapshot da pasta local...');
    const result = await DatabaseService.readSnapshotFromFolder(App.state.databaseConfig);
    if (!result.ok) return Utils.toast(result.message);
    const cfg = DatabaseService.normalize(App.state.databaseConfig);
    cfg.local.folderLabel = result.folderLabel || cfg.local.folderLabel;
    cfg.local.folderPath = result.folderPath || cfg.local.folderPath;
    cfg.local.lastFolderReadAt = result.loadedAt || new Date().toISOString();
    cfg.lastTest = { ok: true, provider: 'local', message: result.message, testedAt: cfg.local.lastFolderReadAt };
    const importedState = result.snapshot?.data ? State.normalize(result.snapshot.data) : App.state;
    App.state = { ...importedState, databaseConfig: cfg, databaseTestResult: cfg.lastTest, showSettingsModal: true, settingsActiveSection: 'database' };
    App.save(); App.render();
    Utils.toast('Snapshot local importado e aplicado ao app.');
  },
  async syncDatabaseNow() {
    const cfg = DatabaseService.normalize(App.state.databaseConfig);
    const summary = {
      products: (App.state.products || []).length,
      campaigns: (App.state.campaigns || []).length,
      actions: (App.state.actions || []).length,
      leads: (App.state.manualLeads || []).length,
      syncedAt: new Date().toISOString()
    };
    if (cfg.provider === 'local' && cfg.local.mode === 'folder') {
      const result = await DatabaseService.writeSnapshotToFolder(App.state, cfg);
      if (result.ok) {
        cfg.local.folderLabel = result.folderLabel || cfg.local.folderLabel;
        cfg.local.folderPath = result.folderPath || cfg.local.folderPath;
        cfg.local.lastFolderWriteAt = result.savedAt || new Date().toISOString();
        App.state.databaseConfig = cfg;
        App.save(); App.render();
      }
      return Utils.toast(result.message);
    }
    try {
      const key = `${cfg.local?.namespace || 'leadscore_local_db'}__last_sync_snapshot`;
      localStorage.setItem(key, JSON.stringify(summary));
    } catch (error) {
      console.warn('Falha ao registrar snapshot local:', error);
    }
    Utils.toast(`Sincronização preparada: ${summary.products} produto(s), ${summary.campaigns} campanha(s), ${summary.actions} ação(ões).`);
  }
});
window.Actions = Actions;

// V12.4 — OKR/KPI Revenue Operating System actions.
Object.assign(Actions, {
  updateOkrDraft(field, value) {
    App.state.okrDraft = { ...(App.state.okrDraft || {}), [field]: value };
    App.save();
  },
  createStrategicOkr() {
    const d = App.state.okrDraft || {};
    const objective = String(d.objective || d.name || '').trim();
    if (!objective) return Utils.toast('Digite o objetivo estratégico do OKR.');
    const okr = {
      id: `okr_${Date.now()}`,
      name: objective,
      objective,
      keyResult: String(d.keyResult || '').trim(),
      target: d.target || '',
      current: d.current || '',
      unit: d.unit || 'R$',
      owner: d.owner || '',
      deadline: d.deadline || '',
      status: d.status || 'Em andamento',
      createdAt: new Date().toISOString()
    };
    App.state.strategicOkrs = [okr, ...(App.state.strategicOkrs || [])];
    App.state.selectedOkrId = okr.id;
    App.state.kpiDraft = { ...(App.state.kpiDraft || {}), relatedOkrId: okr.id };
    App.state.okrDraft = { objective: '', keyResult: '', target: '', unit: 'R$', owner: '', deadline: '', status: 'Em andamento' };
    App.save(); App.render(); Utils.toast('OKR estratégico criado e pronto para receber KPIs.');
  },
  selectStrategicOkr(id) {
    App.state.selectedOkrId = id;
    App.state.kpiDraft = { ...(App.state.kpiDraft || {}), relatedOkrId: id };
    App.save(); App.render();
  },
  deleteStrategicOkr(id) {
    App.state.strategicOkrs = (App.state.strategicOkrs || []).filter(okr => okr.id !== id);
    App.state.operationalKpis = (App.state.operationalKpis || []).map(kpi => kpi.relatedOkrId === id ? { ...kpi, relatedOkrId: null } : kpi);
    if (App.state.selectedOkrId === id) App.state.selectedOkrId = null;
    App.save(); App.render(); Utils.toast('OKR removido. KPIs foram mantidos sem vínculo.');
  },
  updateKpiDraft(field, value) {
    const numericFields = ['productId'];
    App.state.kpiDraft = { ...(App.state.kpiDraft || {}), [field]: numericFields.includes(field) && value ? Number(value) : value };
    App.save();
  },
  createOperationalKpi() {
    const d = App.state.kpiDraft || {};
    const name = String(d.name || '').trim();
    if (!name) return Utils.toast('Digite o nome do KPI.');
    const kpi = {
      id: `kpi_${Date.now()}`,
      name,
      metric: d.metric || 'revenue',
      scope: d.scope || 'global',
      productId: d.scope === 'product' ? Number(d.productId || App.state.selectedProductId || 0) : null,
      target: d.target || '',
      unit: d.unit || (['revenue','grossProfit','mrr'].includes(d.metric) ? 'R$' : d.metric === 'conversion' ? '%' : 'un'),
      frequency: d.frequency || 'Semanal',
      source: d.source || 'Automático pelo Revenue Engine',
      relatedOkrId: d.relatedOkrId || App.state.selectedOkrId || null,
      manualCurrent: d.manualCurrent || '',
      createdAt: new Date().toISOString()
    };
    App.state.operationalKpis = [kpi, ...(App.state.operationalKpis || [])];
    App.state.kpiDraft = { name: '', metric: 'revenue', scope: 'global', productId: App.state.selectedProductId || null, target: '', unit: 'R$', frequency: 'Semanal', source: 'Automático pelo Revenue Engine', relatedOkrId: App.state.selectedOkrId || null };
    App.save(); App.render(); Utils.toast('KPI operacional criado e calculado pelo motor RevOps.');
  },
  deleteOperationalKpi(id) {
    App.state.operationalKpis = (App.state.operationalKpis || []).filter(kpi => kpi.id !== id);
    App.save(); App.render(); Utils.toast('KPI removido.');
  },
  createDefaultRevenueOkrStack() {
    const target = (App.state.products || []).reduce((sum, p) => sum + (RevenueOKRKPIEngine.number(p.price) * 10), 0) || 100000;
    const okr = { id: `okr_${Date.now()}`, name: 'Escalar receita previsível', objective: 'Escalar receita previsível', keyResult: `Gerar ${RevenueOKRKPIEngine.money(target)} em receita atribuída`, target, unit: 'R$', owner: 'Revenue', deadline: '', status: 'Em andamento', createdAt: new Date().toISOString() };
    App.state.strategicOkrs = [okr, ...(App.state.strategicOkrs || [])];
    App.state.operationalKpis = [
      { id: `kpi_${Date.now()}_1`, name: 'Receita atribuída', metric: 'revenue', scope: 'global', target, unit: 'R$', frequency: 'Semanal', source: 'Produto × conversões', relatedOkrId: okr.id, createdAt: new Date().toISOString() },
      { id: `kpi_${Date.now()}_2`, name: 'Leads convertidos', metric: 'converted', scope: 'global', target: 50, unit: 'leads', frequency: 'Semanal', source: 'Fluxo das ações', relatedOkrId: okr.id, createdAt: new Date().toISOString() },
      { id: `kpi_${Date.now()}_3`, name: 'Conversão total', metric: 'conversion', scope: 'global', target: 12, unit: '%', frequency: 'Semanal', source: 'Leads impactados → convertidos', relatedOkrId: okr.id, createdAt: new Date().toISOString() }
    ].concat(App.state.operationalKpis || []);
    App.state.selectedOkrId = okr.id;
    App.save(); App.render(); Utils.toast('Stack OKR/KPI padrão criada.');
  }
});
window.Actions = Actions;


// V13 — RD Station integration actions.
Object.assign(Actions, {
  ensureIntegrations() {
    App.state.integrations = App.state.integrations || {};
    App.state.integrations.rd = {
      ...(window.RDConfig ? RDConfig.defaultConfig() : {}),
      ...(App.state.integrations.rd || {})
    };
  },

  updateRDConfig(field, value) {
    this.ensureIntegrations();
    const prev = App.state.integrations.rd[field];
    App.state.integrations.rd[field] = value;
    // V22.3.6 — Quando o token CRM muda, força re-validação (crmTestStatus
    // volta a 'not_tested'). Sem isso o assistente acharia que a conexão
    // antiga ainda está válida com o novo token.
    if (field === 'crmPersonalToken' && prev !== value) {
      App.state.integrations.rd.crmTestStatus = 'not_tested';
      App.state.integrations.rd.crmTestAt = '';
    }
    App.save();
  },

  generateRDAuthUrl() {
    this.ensureIntegrations();
    const result = RDAuthService.buildAuthorizationUrl(App.state.integrations.rd);
    if (!result.ok) return Utils.toast(result.message);

    App.state.integrations.rd.authUrl = result.url;
    App.state.integrations.rd.status = 'ready_for_oauth';
    App.save();
    App.render();
    Utils.toast('URL OAuth do RD gerada.');
  },

  async testRDConnection() {
    this.ensureIntegrations();
    const result = await RDAuthService.testConnection(App.state.integrations.rd);
    // V22.3.6 — Escreve em campos SEPARADOS para CRM (que é o caminho
    // primário hoje). status/lastTestAt ficam reservados para OAuth Marketing.
    // Se o teste falhar com mensagem específica, mapeia pra status genérico.
    const isConnected = result.ok && result.status === 'connected';
    App.state.integrations.rd.crmTestStatus = isConnected ? 'connected' : (result.status || 'error');
    App.state.integrations.rd.crmTestAt = result.testedAt || new Date().toISOString();
    App.save();
    App.render();
    Utils.toast(result.message || 'Teste RD finalizado.');
  },

  clearRDConfig() {
    this.ensureIntegrations();
    App.state.integrations.rd = RDConfig.defaultConfig();
    App.save();
    App.render();
    Utils.toast('Configuração RD limpa.');
  },

  // V23.0.0 — Logout: limpa JWT + user cache + reload (vai pra tela de login).
  async logout() {
    if (!confirm('Deslogar do LeadJourney? Mudanças não salvas podem ser perdidas.')) return;
    localStorage.removeItem('lj_jwt');
    localStorage.removeItem('lj_user');
    // V23.0.0 — Sandbox: limpa state local ao deslogar (regra escolhida pelo usuário).
    try {
      const u = window.App?.currentUser || JSON.parse(localStorage.getItem('lj_user') || '{}');
      if (u && u.mode === 'sandbox' && !u.isMaster) {
        // Limpa state local pra próxima sessão sandbox começar limpa.
        StorageAdapter?.clear?.();
      }
    } catch (_) {}
    window.location.reload();
  },

  // V23.0.0 — Carrega lista de usuários (admin).
  async loadUsersList() {
    const token = localStorage.getItem('lj_jwt');
    if (!token) return Utils.toast('Sessão expirada — faça login de novo.');
    try {
      const res = await fetch('/api/users-list', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      App.state._usersListCache = data.users;
      App.save();
      App.render();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async approveUser(userId, mode) {
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/users-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId, mode })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ Usuário "${data.user.username}" aprovado (modo ${data.user.mode}).`);
      this.loadUsersList();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async revokeUser(userId) {
    if (!confirm('Revogar acesso desse usuário?')) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/users-revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ Acesso de "${data.user.username}" revogado.`);
      this.loadUsersList();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async setUserMode(userId, mode) {
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/users-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId, mode })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ "${data.user.username}" agora está em modo ${data.user.mode}.`);
      this.loadUsersList();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V23.1.0 — Troca aba ativa do painel "Conexão RD" (CRM | Marketing).
  // Estado persiste em App.state pra preservar entre re-renders.
  setRdActiveTab(tab) {
    if (!['crm', 'marketing'].includes(tab)) return;
    App.state.settingsRdActiveTab = tab;
    App.save();
    App.render();
  },

  // V23.0.0 — Liga/desliga o assistente de conexão RD no painel de configurações.
  toggleRdAssistant() {
    App.state.rdAssistantDismissed = !App.state.rdAssistantDismissed;
    App.save();
    App.render();
  },

  // V22.3.7 — Marca OAuth Marketing como "pulado" pelo usuário.
  // O assistente pula direto para 'done' (CRM já completo + Marketing
  // declaradamente ignorado). Pode reverter no botão "Conectar Marketing"
  // que continua disponível no card colapsado.
  skipMarketingOAuth() {
    this.ensureIntegrations();
    App.state.rdMarketingSkipped = true;
    App.save();
    App.render();
    Utils.toast('RD Marketing ignorado. CRM continua funcionando normalmente.');
  },

  // V22.3.7 — Reverte o skip pra retomar o fluxo OAuth Marketing.
  unskipMarketingOAuth() {
    App.state.rdMarketingSkipped = false;
    App.save();
    App.render();
  },

  // V22.1.1 — Snapshot pré-update: baixa um JSON com state completo,
  // nomeado com a versão atual. LEI do design director: rodar isso
  // antes de qualquer atualização do projeto.
  async downloadStateSnapshot(label = '') {
    if (!window.DatabaseSnapshotService?.generate) {
      return Utils.toast('Serviço de snapshot indisponível.');
    }
    const tag = label || (window.LJVersion || 'state');
    const result = await DatabaseSnapshotService.generate(`pre-${tag}`);
    if (result.ok) {
      Utils.toast(`✓ Snapshot baixado: ${result.filename} (${result.sizeKb} KB).`);
    } else {
      Utils.toast(`Falha ao gerar snapshot: ${result.message || 'erro desconhecido'}.`);
    }
  },

  // V21.8 — Troca authorization_code por access_token via fetch direto ao RD.
  async exchangeRDAuthorizationCode() {
    this.ensureIntegrations();
    const cfg = App.state.integrations.rd;
    if (!cfg.authorizationCode) return Utils.toast('Cole o Authorization Code antes.');
    Utils.toast('Trocando code por token no RD...');
    const result = await RDAuthService.exchangeAuthorizationCode(cfg);
    if (!result.ok) {
      cfg.status = 'exchange_failed';
      cfg.lastTestAt = new Date().toISOString();
      App.save(); App.render();
      return Utils.toast(`Falha: ${result.message}`);
    }
    cfg.accessToken = result.accessToken;
    cfg.refreshToken = result.refreshToken || cfg.refreshToken;
    cfg.expiresAt = result.expiresAt || '';
    cfg.status = 'connected';
    cfg.lastTestAt = new Date().toISOString();
    // V21.8 — code é one-shot: o RD invalida após troca. Limpamos pra não confundir.
    cfg.authorizationCode = '';
    App.save(); App.render();
    Utils.toast('✓ Token RD obtido e salvo.');
  },

  // V21.8 — Força refresh do accessToken usando refresh_token.
  async refreshRDAccessToken() {
    this.ensureIntegrations();
    const cfg = App.state.integrations.rd;
    if (!cfg.refreshToken) return Utils.toast('Sem refresh_token. Refaça o OAuth.');
    Utils.toast('Renovando token RD...');
    const result = await RDAuthService.refreshAccessToken(cfg);
    if (!result.ok) {
      cfg.status = 'refresh_failed';
      App.save(); App.render();
      return Utils.toast(`Falha: ${result.message}`);
    }
    cfg.accessToken = result.accessToken;
    cfg.refreshToken = result.refreshToken || cfg.refreshToken;
    cfg.expiresAt = result.expiresAt || '';
    cfg.status = 'connected';
    cfg.lastTestAt = new Date().toISOString();
    App.save(); App.render();
    Utils.toast('✓ Token RD renovado.');
  },

  updateActionDraftRDEmail(field, value) {
    App.state.actionDraft.rdEmailConfig = {
      ...(window.RDConfig ? RDConfig.emailDefaults() : {}),
      ...(App.state.actionDraft.rdEmailConfig || {})
    };
    App.state.actionDraft.rdEmailConfig[field] = value;
    App.save();
  }
});

// V13 — Preserve existing createAction logic and enrich RD Email actions after creation.
const __LJ_createAction_before_rd_v13 = Actions.createAction;
Actions.createAction = function() {
  const draft = App.state.actionDraft || {};
  const isRD = window.RDMapper?.isRDEmailAction?.(draft);
  const rdEmailConfig = { ...(window.RDConfig ? RDConfig.emailDefaults() : {}), ...(draft.rdEmailConfig || {}) };

  __LJ_createAction_before_rd_v13.call(Actions);

  if (isRD && App.state.actions && App.state.actions[0]) {
    App.state.actions[0] = RDMapper.mapActionPayload({
      ...App.state.actions[0],
      rdEmailConfig,
      rdEmailStats: { ...(draft.rdEmailStats || {}) },
      kpis: window.RDKpiMapper ? RDKpiMapper.mapStatsToKpis(draft.rdEmailStats || RDKpiMapper.emptyStatsTemplate(), draft.kpis || []) : [...(draft.kpis || [])]
    });
    App.save();
    Utils.toast('Ação RD Email criada com campos e KPIs preparados.');
  }
};

window.Actions = Actions;

Object.assign(Actions, {
  updateActionDraftRDStats(field, value) {
    App.state.actionDraft.rdEmailStats = { ...(window.RDKpiMapper ? RDKpiMapper.emptyStatsTemplate() : {}), ...(App.state.actionDraft.rdEmailStats || {}) };
    App.state.actionDraft.rdEmailStats[field] = Number(value || 0);
    if (window.RDKpiMapper) App.state.actionDraft.kpis = RDKpiMapper.mapStatsToKpis(App.state.actionDraft.rdEmailStats, App.state.actionDraft.kpis || []);
    App.save();
  },
  refreshActionRDKpis(actionId) {
    const action = App.state.actions.find(a => Number(a.id) === Number(actionId));
    if (!action || !window.RDKpiMapper) return Utils.toast('Ação RD não encontrada.');
    const next = RDKpiMapper.applyToAction(action, action.rdEmailStats || {});
    App.state.actions = App.state.actions.map(a => Number(a.id) === Number(actionId) ? next : a);
    App.save(); App.render(); Utils.toast('KPIs RD recalculados.');
  }
});

Object.assign(Actions, {
  async syncRDAction(actionId) {
    const result = await RDSyncEngine.syncAction(actionId);
    App.render();
    Utils.toast(result.message || (result.ok ? 'Sync RD realizado.' : 'Falha no sync RD.'));
  },
  async syncAllRDActions() {
    const result = await RDSyncEngine.syncAll();
    App.render();
    Utils.toast(`Sync RD concluído: ${result.total} ação(ões).`);
  }
});
window.Actions = Actions;


// V13.0.2 — direct RD settings opener
Object.assign(Actions, {
  openRDSettings() {
    App.state.showSettingsModal = true;
    App.state.settingsActiveSection = 'rd';
    App.state.integrations = App.state.integrations || {};
    App.state.integrations.rd = { ...(window.RDConfig ? RDConfig.defaultConfig() : {}), ...(App.state.integrations.rd || {}) };
    App.save();
    App.render();
    setTimeout(() => window.RDSettingsInjection?.inject?.(), 0);
  }
});
window.Actions = Actions;


// V13.0.3 — Settings section navigation
Object.assign(Actions, {
  setSettingsSection(section) {
    App.state.settingsActiveSection = section;
    App.save();
    App.render();
  }
});
window.Actions = Actions;


// V13.0.4 stub kept intentionally lean: bugs from the previous override
// (flat-only updateDatabaseConfig + fake testDatabaseConnection that bypassed
// DatabaseService) were removed in V14.4. Use the canonical actions above:
//   - Actions.selectDatabaseProvider(provider)
//   - Actions.updateDatabaseConfig(dotPath, value)   // ex.: 'local.folderPath'
//   - Actions.testDatabaseConnection()               // async, calls DatabaseService
//   - Actions.saveDatabaseConfig()                   // normalizes + stamps savedAt
//   - Actions.chooseLocalDatabaseFolder()
//   - Actions.writeLocalFolderSnapshot()
//   - Actions.readLocalFolderSnapshot()


// V13.1.1 — OAuth Runtime Fix
Object.assign(Actions, {
  ensureRDConfig() {
    App.state.integrations = App.state.integrations || {};
    App.state.integrations.rd = {
      ...(window.RDConfig ? RDConfig.defaultConfig() : {}),
      ...(App.state.integrations.rd || {})
    };
    return App.state.integrations.rd;
  },

  generateRDAuthUrl() {
    const cfg = this.ensureRDConfig();
    const result = RDAuthService.buildAuthorizationUrl(cfg);

    if (!result.ok) {
      Utils.toast(result.message);
      return;
    }

    App.state.integrations.rd.authUrl = result.url;
    App.state.integrations.rd.status = "ready_for_oauth";
    App.save();
    App.render();

    Utils.toast("URL OAuth gerada. Clique em Abrir URL OAuth.");
  },

  openRDAuthUrl() {
    const cfg = this.ensureRDConfig();
    let url = cfg.authUrl;

    if (!url) {
      const result = RDAuthService.buildAuthorizationUrl(cfg);
      if (!result.ok) {
        Utils.toast(result.message);
        return;
      }
      url = result.url;
      App.state.integrations.rd.authUrl = url;
      App.state.integrations.rd.status = "ready_for_oauth";
      App.save();
    }

    try {
      window.open(url, "_blank", "noopener,noreferrer");
      Utils.toast("URL OAuth aberta em nova aba.");
    } catch (error) {
      Utils.toast("O navegador bloqueou a abertura. Copie a URL gerada manualmente.");
    }

    App.render();
  },

  async copyRDAuthUrl() {
    const cfg = this.ensureRDConfig();
    let url = cfg.authUrl;

    if (!url) {
      const result = RDAuthService.buildAuthorizationUrl(cfg);
      if (!result.ok) {
        Utils.toast(result.message);
        return;
      }
      url = result.url;
      App.state.integrations.rd.authUrl = url;
      App.state.integrations.rd.status = "ready_for_oauth";
      App.save();
    }

    try {
      await navigator.clipboard.writeText(url);
      Utils.toast("URL OAuth copiada.");
    } catch (error) {
      Utils.toast("Não consegui copiar automaticamente. Selecione e copie a URL exibida.");
    }

    App.render();
  }
});
window.Actions = Actions;


// V14 — RevOps & Governança actions.
Object.assign(Actions, {
  _revopsEnsureConfig(productId) {
    const id = Number(productId || App.state.revopsSelectedProductId || App.state.products?.[0]?.id);
    if (!id) return null;
    if (!App.state.revopsSelectedProductId || Number(App.state.revopsSelectedProductId) !== id) {
      App.state.revopsSelectedProductId = id;
    }
    App.state.revopsFinance = App.state.revopsFinance || {};
    if (!App.state.revopsFinance[id]) App.state.revopsFinance[id] = RevopsFinanceEngine.defaultConfig(id);
    App.state.revopsFinance[id] = RevopsFinanceEngine.normalize(App.state.revopsFinance[id], id);
    return App.state.revopsFinance[id];
  },

  setRevopsProduct(productId) {
    if (!productId) return;
    App.state.revopsSelectedProductId = Number(productId);
    this._revopsEnsureConfig(productId);
    App.save(); App.render();
  },

  addRevopsOffer() {
    const config = this._revopsEnsureConfig();
    if (!config) return Utils.toast('Selecione um produto antes de adicionar ofertas.');
    config.offers = [...(config.offers || []), RevopsFinanceEngine.emptyOffer()];
    App.save(); App.render();
  },

  removeRevopsOffer(offerId) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    config.offers = (config.offers || []).filter(offer => offer.id !== offerId);
    App.save(); App.render();
  },

  updateRevopsOfferSilent(offerId, field, value) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    config.offers = (config.offers || []).map(offer => {
      if (offer.id !== offerId) return offer;
      return { ...offer, [field]: field === 'name' ? value : RevopsFinanceEngine.number(value) };
    });
    App.save();
  },

  updateRevopsOffer(offerId, field, value) {
    this.updateRevopsOfferSilent(offerId, field, value);
    App.render();
  },

  toggleRevopsOfferSelected(offerId) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    config.offers = (config.offers || []).map(offer => offer.id === offerId ? { ...offer, selectedForTicket: !offer.selectedForTicket } : offer);
    App.save(); App.render();
  },

  setRevopsTicketMode(mode) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    config.ticketMode = ['weighted', 'manual', 'sumSelected'].includes(mode) ? mode : 'weighted';
    App.save(); App.render();
  },

  updateRevopsTicketManualValueSilent(value) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    config.ticketManualValue = RevopsFinanceEngine.number(value);
    App.save();
  },

  updateRevopsTicketManualValue(value) {
    this.updateRevopsTicketManualValueSilent(value);
    App.render();
  },

  openRevopsFixedCostsModal(category) {
    const valid = RevopsFinanceEngine.FIXED_CATEGORIES.some(c => c.id === category);
    if (!valid) return;
    const config = this._revopsEnsureConfig();
    if (!config) return Utils.toast('Selecione um produto.');
    App.state.showRevopsFixedCostsModal = true;
    App.state.revopsFixedCostsCategory = category;
    App.save(); App.render();
  },

  closeRevopsFixedCostsModal() {
    App.state.showRevopsFixedCostsModal = false;
    App.state.revopsFixedCostsCategory = null;
    App.save(); App.render();
  },

  openRevopsAcquisitionModal() {
    const config = this._revopsEnsureConfig();
    if (!config) return Utils.toast('Selecione um produto.');
    if (!config.acquisitionCosts) config.acquisitionCosts = { items: [] };
    App.state.showRevopsAcquisitionModal = true;
    App.save(); App.render();
  },

  closeRevopsAcquisitionModal() {
    App.state.showRevopsAcquisitionModal = false;
    App.save(); App.render();
  },

  addRevopsAcquisitionItem() {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    if (!config.acquisitionCosts) config.acquisitionCosts = { items: [] };
    config.acquisitionCosts.items = [...(config.acquisitionCosts.items || []), RevopsFinanceEngine.emptyAcquisitionItem()];
    App.save(); App.render();
  },

  removeRevopsAcquisitionItem(itemId) {
    const config = this._revopsEnsureConfig();
    if (!config || !config.acquisitionCosts) return;
    config.acquisitionCosts.items = (config.acquisitionCosts.items || []).filter(item => item.id !== itemId);
    App.save(); App.render();
  },

  updateRevopsAcquisitionItemSilent(itemId, field, value) {
    const config = this._revopsEnsureConfig();
    if (!config || !config.acquisitionCosts) return;
    config.acquisitionCosts.items = (config.acquisitionCosts.items || []).map(item => {
      if (item.id !== itemId) return item;
      return { ...item, [field]: field === 'name' ? value : RevopsFinanceEngine.number(value) };
    });
    App.save();
  },

  addRevopsFixedItem(category) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    const cat = config.fixedCosts?.[category];
    if (!cat) return;
    cat.items = [...(cat.items || []), RevopsFinanceEngine.emptyFixedItem()];
    App.save(); App.render();
  },

  removeRevopsFixedItem(category, itemId) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    const cat = config.fixedCosts?.[category];
    if (!cat) return;
    cat.items = (cat.items || []).filter(item => item.id !== itemId);
    App.save(); App.render();
  },

  updateRevopsFixedItemSilent(category, itemId, field, value) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    const cat = config.fixedCosts?.[category];
    if (!cat) return;
    cat.items = (cat.items || []).map(item => {
      if (item.id !== itemId) return item;
      return { ...item, [field]: field === 'name' ? value : RevopsFinanceEngine.number(value) };
    });
    App.save();
  },

  addRevopsVariableCost() {
    const config = this._revopsEnsureConfig();
    if (!config) return Utils.toast('Selecione um produto.');
    config.variableCosts = [...(config.variableCosts || []), RevopsFinanceEngine.emptyVariableCost()];
    App.save(); App.render();
  },

  removeRevopsVariableCost(itemId) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    config.variableCosts = (config.variableCosts || []).filter(item => item.id !== itemId);
    App.save(); App.render();
  },

  updateRevopsVariableCostSilent(itemId, field, value) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    config.variableCosts = (config.variableCosts || []).map(item => {
      if (item.id !== itemId) return item;
      if (field === 'name') return { ...item, name: value };
      if (field === 'value') return { ...item, value: RevopsFinanceEngine.number(value) };
      return item;
    });
    App.save();
  },

  updateRevopsVariableCost(itemId, field, value) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    config.variableCosts = (config.variableCosts || []).map(item => {
      if (item.id !== itemId) return item;
      if (field === 'type') return { ...item, type: ['percent', 'fixed'].includes(value) ? value : 'percent' };
      if (field === 'appliesTo') return { ...item, appliesTo: ['grossRevenue', 'netRevenue', 'afterFixed'].includes(value) ? value : 'grossRevenue' };
      if (field === 'value') return { ...item, value: RevopsFinanceEngine.number(value) };
      return { ...item, [field]: value };
    });
    App.save(); App.render();
  },

  updateRevopsPeriod(period) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    config.period = ['monthly', 'quarterly', 'yearly'].includes(period) ? period : 'monthly';
    App.save(); App.render();
  },

  updateRevopsSalesProjectionSilent(value) {
    const config = this._revopsEnsureConfig();
    if (!config) return;
    config.salesProjection = RevopsFinanceEngine.number(value);
    App.save();
  },

  updateRevopsSalesProjection(value) {
    this.updateRevopsSalesProjectionSilent(value);
    App.render();
  },

  saveRevopsConfig() {
    const config = this._revopsEnsureConfig();
    if (!config) return Utils.toast('Selecione um produto antes de salvar.');
    config.savedAt = new Date().toISOString();
    App.save(); App.render();
    Utils.toast('Configuração operacional do produto salva.');
  },

  openRevopsSimulation() {
    const config = this._revopsEnsureConfig();
    if (!config) return Utils.toast('Selecione um produto para simular.');
    App.state.revopsSimulationDraft = JSON.parse(JSON.stringify(config));
    App.state.revopsSimulationLoadedScenarioId = null;
    App.state.showRevopsSimulationModal = true;
    App.save(); App.render();
  },

  closeRevopsSimulation() {
    App.state.showRevopsSimulationModal = false;
    App.state.revopsSimulationDraft = null;
    App.state.revopsSimulationLoadedScenarioId = null;
    App.save(); App.render();
  },

  resetRevopsSimulation() {
    const productId = App.state.revopsSelectedProductId;
    const original = (App.state.revopsFinance || {})[productId];
    App.state.revopsSimulationDraft = original ? JSON.parse(JSON.stringify(original)) : RevopsFinanceEngine.defaultConfig(productId);
    App.state.revopsSimulationLoadedScenarioId = null;
    App.save(); App.render();
    Utils.toast('Simulador resetado para a configuração oficial do produto.');
  },

  updateRevopsSimulationSilent(field, value) {
    if (!App.state.revopsSimulationDraft) return;
    if (field === 'period') {
      App.state.revopsSimulationDraft.period = ['monthly', 'quarterly', 'yearly'].includes(value) ? value : 'monthly';
    } else {
      App.state.revopsSimulationDraft[field] = RevopsFinanceEngine.number(value);
    }
    App.save();
  },

  updateRevopsSimulation(field, value) {
    this.updateRevopsSimulationSilent(field, value);
    App.render();
  },

  addRevopsSimulationFixedItem(category) {
    if (!App.state.revopsSimulationDraft) return;
    const fc = App.state.revopsSimulationDraft.fixedCosts || {};
    const cat = fc[category] || (fc[category] = { items: [] });
    cat.items = [...(cat.items || []), RevopsFinanceEngine.emptyFixedItem()];
    App.state.revopsSimulationDraft.fixedCosts = fc;
    App.save(); App.render();
  },

  removeRevopsSimulationFixedItem(category, itemId) {
    if (!App.state.revopsSimulationDraft) return;
    const fc = App.state.revopsSimulationDraft.fixedCosts || {};
    const cat = fc[category];
    if (!cat) return;
    cat.items = (cat.items || []).filter(item => item.id !== itemId);
    App.save(); App.render();
  },

  updateRevopsSimulationFixedItemSilent(category, itemId, field, value) {
    if (!App.state.revopsSimulationDraft) return;
    const fc = App.state.revopsSimulationDraft.fixedCosts || {};
    const cat = fc[category];
    if (!cat) return;
    cat.items = (cat.items || []).map(item => {
      if (item.id !== itemId) return item;
      return { ...item, [field]: field === 'name' ? value : RevopsFinanceEngine.number(value) };
    });
    App.save();
  },

  addRevopsSimulationVariableCost() {
    if (!App.state.revopsSimulationDraft) return;
    App.state.revopsSimulationDraft.variableCosts = [...(App.state.revopsSimulationDraft.variableCosts || []), RevopsFinanceEngine.emptyVariableCost()];
    App.save(); App.render();
  },

  removeRevopsSimulationVariableCost(itemId) {
    if (!App.state.revopsSimulationDraft) return;
    App.state.revopsSimulationDraft.variableCosts = (App.state.revopsSimulationDraft.variableCosts || []).filter(item => item.id !== itemId);
    App.save(); App.render();
  },

  updateRevopsSimulationVariableCostSilent(itemId, field, value) {
    if (!App.state.revopsSimulationDraft) return;
    App.state.revopsSimulationDraft.variableCosts = (App.state.revopsSimulationDraft.variableCosts || []).map(item => {
      if (item.id !== itemId) return item;
      if (field === 'name') return { ...item, name: value };
      if (field === 'value') return { ...item, value: RevopsFinanceEngine.number(value) };
      return item;
    });
    App.save();
  },

  updateRevopsSimulationVariableCost(itemId, field, value) {
    if (!App.state.revopsSimulationDraft) return;
    App.state.revopsSimulationDraft.variableCosts = (App.state.revopsSimulationDraft.variableCosts || []).map(item => {
      if (item.id !== itemId) return item;
      if (field === 'type') return { ...item, type: ['percent', 'fixed'].includes(value) ? value : 'percent' };
      if (field === 'appliesTo') return { ...item, appliesTo: ['grossRevenue', 'netRevenue', 'afterFixed'].includes(value) ? value : 'grossRevenue' };
      if (field === 'value') return { ...item, value: RevopsFinanceEngine.number(value) };
      return { ...item, [field]: value };
    });
    App.save(); App.render();
  },

  addRevopsSimulationOffer() {
    if (!App.state.revopsSimulationDraft) return;
    App.state.revopsSimulationDraft.offers = [...(App.state.revopsSimulationDraft.offers || []), RevopsFinanceEngine.emptyOffer()];
    App.save(); App.render();
  },

  removeRevopsSimulationOffer(offerId) {
    if (!App.state.revopsSimulationDraft) return;
    App.state.revopsSimulationDraft.offers = (App.state.revopsSimulationDraft.offers || []).filter(offer => offer.id !== offerId);
    App.save(); App.render();
  },

  updateRevopsSimulationOfferSilent(offerId, field, value) {
    if (!App.state.revopsSimulationDraft) return;
    App.state.revopsSimulationDraft.offers = (App.state.revopsSimulationDraft.offers || []).map(offer => {
      if (offer.id !== offerId) return offer;
      return { ...offer, [field]: field === 'name' ? value : RevopsFinanceEngine.number(value) };
    });
    App.save();
  },

  updateRevopsSimulationOffer(offerId, field, value) {
    this.updateRevopsSimulationOfferSilent(offerId, field, value);
    App.render();
  },

  toggleRevopsSimulationOfferSelected(offerId) {
    if (!App.state.revopsSimulationDraft) return;
    App.state.revopsSimulationDraft.offers = (App.state.revopsSimulationDraft.offers || []).map(offer => offer.id === offerId ? { ...offer, selectedForTicket: !offer.selectedForTicket } : offer);
    App.save(); App.render();
  },

  setRevopsSimulationTicketMode(mode) {
    if (!App.state.revopsSimulationDraft) return;
    App.state.revopsSimulationDraft.ticketMode = ['weighted', 'manual', 'sumSelected'].includes(mode) ? mode : 'weighted';
    App.save(); App.render();
  },

  updateRevopsSimulationTicketManualValueSilent(value) {
    if (!App.state.revopsSimulationDraft) return;
    App.state.revopsSimulationDraft.ticketManualValue = RevopsFinanceEngine.number(value);
    App.save();
  },

  updateRevopsSimulationTicketManualValue(value) {
    this.updateRevopsSimulationTicketManualValueSilent(value);
    App.render();
  },

  openRevopsScenarioName() {
    if (!App.state.revopsSimulationDraft) return;
    const loadedId = App.state.revopsSimulationLoadedScenarioId;
    const config = (App.state.revopsFinance || {})[App.state.revopsSelectedProductId];
    const loaded = loadedId && config ? (config.scenarios || []).find(s => s.id === loadedId) : null;
    App.state.revopsScenarioDraftName = loaded ? loaded.name : '';
    App.state.showRevopsScenarioNameModal = true;
    App.save(); App.render();
  },

  cancelRevopsScenarioName() {
    App.state.showRevopsScenarioNameModal = false;
    App.state.revopsScenarioDraftName = '';
    App.save(); App.render();
  },

  confirmRevopsScenarioName() {
    const name = String(App.state.revopsScenarioDraftName || '').trim();
    if (!name) return Utils.toast('Dê um nome ao cenário.');
    if (!App.state.revopsSimulationDraft) return;
    const productId = App.state.revopsSelectedProductId;
    const config = this._revopsEnsureConfig(productId);
    if (!config) return;
    const snapshot = RevopsFinanceEngine.scenarioSnapshot(App.state.revopsSimulationDraft, name);
    const loadedId = App.state.revopsSimulationLoadedScenarioId;
    config.scenarios = Array.isArray(config.scenarios) ? config.scenarios : [];
    if (loadedId) {
      config.scenarios = config.scenarios.map(s => s.id === loadedId ? { ...snapshot, id: loadedId } : s);
      Utils.toast(`Cenário "${name}" atualizado.`);
    } else {
      config.scenarios.unshift(snapshot);
      App.state.revopsSimulationLoadedScenarioId = snapshot.id;
      Utils.toast(`Cenário "${name}" salvo.`);
    }
    App.state.showRevopsScenarioNameModal = false;
    App.state.revopsScenarioDraftName = '';
    App.save(); App.render();
  },

  openRevopsScenarios() {
    const productId = App.state.revopsSelectedProductId;
    if (!productId) return Utils.toast('Selecione um produto para ver cenários.');
    App.state.showRevopsScenariosModal = true;
    App.save(); App.render();
  },

  closeRevopsScenarios() {
    App.state.showRevopsScenariosModal = false;
    App.save(); App.render();
  },

  loadRevopsScenario(scenarioId) {
    const productId = App.state.revopsSelectedProductId;
    const config = (App.state.revopsFinance || {})[productId];
    if (!config) return;
    const scenario = (config.scenarios || []).find(s => s.id === scenarioId);
    if (!scenario) return Utils.toast('Cenário não encontrado.');
    App.state.revopsSimulationDraft = RevopsFinanceEngine.applyScenario(config, scenario);
    App.state.revopsSimulationLoadedScenarioId = scenarioId;
    App.state.showRevopsSimulationModal = true;
    App.state.showRevopsScenariosModal = false;
    App.save(); App.render();
  },

  deleteRevopsScenario(scenarioId) {
    const productId = App.state.revopsSelectedProductId;
    const config = (App.state.revopsFinance || {})[productId];
    if (!config) return;
    config.scenarios = (config.scenarios || []).filter(s => s.id !== scenarioId);
    if (App.state.revopsSimulationLoadedScenarioId === scenarioId) App.state.revopsSimulationLoadedScenarioId = null;
    App.save(); App.render();
    Utils.toast('Cenário removido.');
  },

  applyRevopsSimulationToProduct() {
    if (!App.state.revopsSimulationDraft) return;
    const productId = App.state.revopsSelectedProductId;
    if (!productId) return;
    const previousScenarios = ((App.state.revopsFinance || {})[productId]?.scenarios) || [];
    App.state.revopsFinance = App.state.revopsFinance || {};
    App.state.revopsFinance[productId] = RevopsFinanceEngine.normalize({
      ...App.state.revopsSimulationDraft,
      scenarios: previousScenarios,
      savedAt: new Date().toISOString()
    }, productId);
    App.state.showRevopsSimulationModal = false;
    App.state.revopsSimulationDraft = null;
    App.state.revopsSimulationLoadedScenarioId = null;
    App.save(); App.render();
    Utils.toast('Configuração oficial do produto atualizada com a projeção.');
  }
});
window.Actions = Actions;


// V14.3 — Motor de OKRs: vínculos entre KPIs RevOps, campanhas e ações.
Object.assign(Actions, {
  openRevopsOkr(scope, productId, editingId = null, campaignId = null) {
    const resolvedScope = scope === 'campaign' ? 'campaign' : 'product';
    let draft;
    if (editingId) {
      if (resolvedScope === 'product') {
        const existing = (App.state.strategicOkrs || []).find(o => o.id === editingId);
        if (!existing) return Utils.toast('OKR não encontrado.');
        draft = {
          scope: 'product',
          productId: existing.productId || productId,
          editingId,
          objective: existing.objective || existing.name || '',
          keyResults: (existing.keyResults || []).map(kr => ({ ...kr }))
        };
      } else {
        const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
        if (!campaign) return Utils.toast('Campanha não encontrada.');
        const existing = (campaign.okrs || []).find(o => o.id === editingId);
        if (!existing) return Utils.toast('OKR da campanha não encontrado.');
        draft = {
          scope: 'campaign',
          productId: productId || campaign.productId,
          campaignId: campaign.id,
          editingId,
          objective: existing.objective || '',
          keyResults: (existing.keyResults || []).map(kr => ({ ...kr }))
        };
      }
    } else {
      draft = {
        scope: resolvedScope,
        productId: productId || App.state.revopsSelectedProductId,
        campaignId: resolvedScope === 'campaign' ? campaignId : null,
        editingId: null,
        objective: '',
        keyResults: [RevopsFinanceEngine.defaultKeyResult(resolvedScope === 'product' ? 'ebitda' : 'campaignCAC')]
      };
    }
    App.state.revopsOkrDraft = draft;
    App.state.showRevopsOkrModal = true;
    App.save(); App.render();
  },

  openRevopsOkrFromKpi(productId, metricId, currentValue) {
    const meta = RevopsFinanceEngine.METRIC_CATALOG[metricId];
    if (!meta) return Utils.toast('Métrica não suportada.');
    const baseTarget = meta.direction === 'lower' && Number(currentValue) > 0
      ? Math.max(1, Math.round(Number(currentValue) * 0.7))
      : Math.max(Number(currentValue) || 0, 1) * 1.2;
    App.state.revopsOkrDraft = {
      scope: 'product',
      productId: productId || App.state.revopsSelectedProductId,
      editingId: null,
      objective: `Mover ${meta.label} para a zona saudável`,
      keyResults: [{
        id: `kr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        label: `${meta.direction === 'lower' ? 'Reduzir' : 'Elevar'} ${meta.label}`,
        metric: metricId,
        target: Math.round(baseTarget * 100) / 100,
        parentKrId: null
      }]
    };
    App.state.showRevopsOkrModal = true;
    App.save(); App.render();
  },

  openRevopsOkrFromAlert(productId, encodedSuggest) {
    let suggest = {};
    try { suggest = JSON.parse(decodeURIComponent(encodedSuggest)); } catch (_) {}
    const metricId = suggest.metric || 'ebitda';
    const target = suggest.target ?? 0;
    return this.openRevopsOkrFromKpi(productId, metricId, target);
  },

  closeRevopsOkr() {
    App.state.showRevopsOkrModal = false;
    App.state.revopsOkrDraft = null;
    App.save(); App.render();
  },

  updateRevopsOkrDraft(field, value) {
    if (!App.state.revopsOkrDraft) return;
    App.state.revopsOkrDraft[field] = value;
    App.save();
  },

  addRevopsOkrKr() {
    if (!App.state.revopsOkrDraft) return;
    const scope = App.state.revopsOkrDraft.scope || 'product';
    const defaultMetric = scope === 'product' ? 'ebitda' : 'campaignCAC';
    App.state.revopsOkrDraft.keyResults = [...(App.state.revopsOkrDraft.keyResults || []), RevopsFinanceEngine.defaultKeyResult(defaultMetric)];
    App.save(); App.render();
  },

  removeRevopsOkrKr(index) {
    if (!App.state.revopsOkrDraft) return;
    App.state.revopsOkrDraft.keyResults = (App.state.revopsOkrDraft.keyResults || []).filter((_, i) => i !== index);
    App.save(); App.render();
  },

  updateRevopsOkrKrField(index, field, value) {
    if (!App.state.revopsOkrDraft) return;
    const list = App.state.revopsOkrDraft.keyResults || [];
    if (!list[index]) return;
    if (field === 'metric') {
      const meta = RevopsFinanceEngine.METRIC_CATALOG[value];
      list[index] = { ...list[index], metric: value, label: list[index].label || meta?.label || 'KR' };
    } else if (field === 'target') {
      list[index] = { ...list[index], target: RevopsFinanceEngine.number(value) };
    } else if (field === 'parentKrId') {
      list[index] = { ...list[index], parentKrId: value || null };
    } else {
      list[index] = { ...list[index], [field]: value };
    }
    App.state.revopsOkrDraft.keyResults = list;
    App.save();
    if (field === 'metric' || field === 'parentKrId') App.render();
  },

  saveRevopsOkr() {
    const draft = App.state.revopsOkrDraft;
    if (!draft) return;
    const objective = String(draft.objective || '').trim();
    if (!objective) return Utils.toast('Descreva o objetivo qualitativo.');
    if (!(draft.keyResults || []).length) return Utils.toast('Adicione ao menos um KR.');

    if (draft.scope === 'product') {
      const productId = draft.productId;
      if (!productId) return Utils.toast('Selecione um produto.');
      const payload = {
        id: draft.editingId || `okr_strategic_${Date.now()}`,
        objective,
        name: objective,
        productId: Number(productId),
        keyResults: (draft.keyResults || []).map(kr => ({ ...kr, target: RevopsFinanceEngine.number(kr.target) })),
        keyResult: '',
        target: '',
        current: '',
        unit: 'R$',
        owner: '',
        deadline: '',
        status: 'Em andamento',
        createdAt: new Date().toISOString()
      };
      const list = Array.isArray(App.state.strategicOkrs) ? App.state.strategicOkrs : [];
      if (draft.editingId) {
        App.state.strategicOkrs = list.map(o => o.id === draft.editingId ? { ...o, ...payload } : o);
      } else {
        App.state.strategicOkrs = [payload, ...list];
      }
      Utils.toast(`OKR estratégico ${draft.editingId ? 'atualizado' : 'criado'}.`);
    } else {
      const campaignId = Number(draft.campaignId);
      if (!campaignId) return Utils.toast('Selecione uma campanha.');
      const campaignIndex = (App.state.campaigns || []).findIndex(c => Number(c.id) === campaignId);
      if (campaignIndex < 0) return Utils.toast('Campanha não encontrada.');
      const campaign = App.state.campaigns[campaignIndex];
      const okrs = Array.isArray(campaign.okrs) ? campaign.okrs : [];
      const payload = {
        id: draft.editingId || `okrc_${Date.now()}`,
        objective,
        keyResults: (draft.keyResults || []).map(kr => ({ ...kr, target: RevopsFinanceEngine.number(kr.target) })),
        createdAt: new Date().toISOString()
      };
      const nextOkrs = draft.editingId
        ? okrs.map(o => o.id === draft.editingId ? { ...o, ...payload } : o)
        : [...okrs, payload];
      App.state.campaigns = App.state.campaigns.map((c, i) => i === campaignIndex ? { ...c, okrs: nextOkrs } : c);
      Utils.toast(`OKR tático ${draft.editingId ? 'atualizado' : 'criado'} na campanha.`);
    }

    App.state.showRevopsOkrModal = false;
    App.state.revopsOkrDraft = null;
    App.save(); App.render();
  },

  deleteRevopsOkr() {
    const draft = App.state.revopsOkrDraft;
    if (!draft || !draft.editingId) return;
    if (draft.scope === 'product') {
      App.state.strategicOkrs = (App.state.strategicOkrs || []).filter(o => o.id !== draft.editingId);
    } else {
      App.state.campaigns = (App.state.campaigns || []).map(c => {
        if (Number(c.id) !== Number(draft.campaignId)) return c;
        return { ...c, okrs: (c.okrs || []).filter(o => o.id !== draft.editingId) };
      });
      const krIdsRemoved = (draft.keyResults || []).map(kr => kr.id);
      App.state.actions = (App.state.actions || []).map(action => krIdsRemoved.includes(action.linkedCampaignKrId) ? { ...action, linkedCampaignKrId: null } : action);
    }
    App.state.showRevopsOkrModal = false;
    App.state.revopsOkrDraft = null;
    App.save(); App.render();
    Utils.toast('OKR removido.');
  },

  linkActionToCampaignKr(actionId, krId) {
    App.state.actions = (App.state.actions || []).map(action => Number(action.id) === Number(actionId) ? { ...action, linkedCampaignKrId: krId || null } : action);
    App.save(); App.render();
    Utils.toast(krId ? 'Ação vinculada ao KR da campanha.' : 'Vínculo removido.');
  }
});
window.Actions = Actions;

// V16.3 — Execution Provider Layer + Djow Agent
Object.assign(Actions, {
  setDefaultExecutionProvider(providerId) {
    if (!window.ExecutionProviderRegistry) return;
    const cfg = App.state.executionConfig || ExecutionProviderRegistry.defaultConfig();
    App.state.executionConfig = { ...cfg, defaultProvider: ExecutionProviderRegistry.byId(providerId).id };
    App.save(); App.render();
    Utils.toast(`Provider padrão: ${ExecutionProviderRegistry.byId(providerId).label}.`);
  },

  updateExecutionProviderField(providerId, field, value) {
    const cfg = App.state.executionConfig || ExecutionProviderRegistry.defaultConfig();
    const providers = { ...cfg.providers };
    providers[providerId] = { ...(providers[providerId] || {}), [field]: value };
    App.state.executionConfig = { ...cfg, providers };
    App.save();
  },

  async testExecutionProvider(providerId) {
    const provider = window.ExecutionProviders?.[providerId];
    if (!provider) return Utils.toast('Provider não encontrado.');
    const cfg = ExecutionProviderRegistry.getProviderConfig(providerId);
    Utils.toast(`Testando ${providerId}...`);
    const res = await provider.testConnection(cfg);
    const next = { ...cfg, connected: Boolean(res.ok), lastTested: new Date().toISOString(), lastError: res.ok ? null : res.message };
    const stateCfg = App.state.executionConfig || ExecutionProviderRegistry.defaultConfig();
    App.state.executionConfig = { ...stateCfg, providers: { ...stateCfg.providers, [providerId]: next } };
    App.save(); App.render();
    Utils.toast(res.message || (res.ok ? 'Conectado.' : 'Falhou.'));
  },

  updateAgentField(agentId, field, value) {
    const cfg = App.state.agentConfig || AgentRegistry.defaultConfig();
    const next = { ...(cfg[agentId] || {}), [field]: field === 'timeoutMs' ? Number(value || 0) : value };
    App.state.agentConfig = { ...cfg, [agentId]: next };
    App.save();
  },

  toggleAgentEnabled(agentId) {
    const cfg = App.state.agentConfig || AgentRegistry.defaultConfig();
    const next = { ...(cfg[agentId] || {}), enabled: !cfg[agentId]?.enabled };
    App.state.agentConfig = { ...cfg, [agentId]: next };
    App.save(); App.render();
    Utils.toast(next.enabled ? 'Agente ativado.' : 'Agente desativado.');
  },

  async testAgentConnection(agentId) {
    if (!window.AgentHealthMonitor) return;
    Utils.toast('Testando Djow...');
    const res = await AgentHealthMonitor.ping();
    App.render();
    Utils.toast(res.ok ? `Online · ${res.latencyMs}ms` : `Offline: ${res.message}`);
  },

  saveAgentConfig() {
    App.save();
    Utils.toast('Agente salvo.');
  },

  resetAgentConfig(agentId) {
    if (!window.AgentRegistry) return;
    const fresh = AgentRegistry.defaultConfig();
    App.state.agentConfig = { ...(App.state.agentConfig || {}), [agentId]: fresh[agentId] };
    App.save(); App.render();
    Utils.toast('Agente reiniciado.');
  },

  openDjowModal(actionId) {
    App.state.djowModalActionId = Number(actionId);
    App.state.showDjowModal = true;
    App.state.djowDraftMessage = '';
    App.state.djowSending = false;
    App.save(); App.render();
  },

  closeDjowModal() {
    App.state.showDjowModal = false;
    App.state.djowDraftMessage = '';
    App.state.djowSending = false;
    App.save(); App.render();
  },

  updateDjowDraft(value) {
    App.state.djowDraftMessage = String(value || '');
  },

  async sendDjowMessage() {
    const actionId = App.state.djowModalActionId;
    const message = String(App.state.djowDraftMessage || '').trim();
    if (!actionId || !message) return;
    const chats = App.state.djowChats || {};
    const list = (chats[actionId]?.messages) || [];
    const userMsg = { role: 'user', text: message, ts: new Date().toISOString() };
    App.state.djowChats = { ...chats, [actionId]: { messages: [...list, userMsg] } };
    App.state.djowDraftMessage = '';
    App.state.djowSending = true;
    App.save(); App.render();
    try {
      const result = await ExecutionAgentBridge.dispatch(actionId, message);
      const updated = App.state.djowChats?.[actionId]?.messages || [];
      if (result.ok && result.task) {
        const taskMsg = { role: 'task', task: result.task, ts: new Date().toISOString() };
        App.state.djowChats = { ...App.state.djowChats, [actionId]: { messages: [...updated, taskMsg] } };
        App.state.djowLastResponse = { agentUsed: result.agentUsed, latencyMs: result.latencyMs };
        Utils.toast('Tarefa criada.');
      } else {
        const errMsg = { role: 'agent', text: result.message || 'Falha ao criar tarefa.', ts: new Date().toISOString() };
        App.state.djowChats = { ...App.state.djowChats, [actionId]: { messages: [...updated, errMsg] } };
        Utils.toast(result.message || 'Falha.');
      }
    } catch (err) {
      Utils.toast(`Erro: ${err?.message || err}`);
    } finally {
      App.state.djowSending = false;
      App.save(); App.render();
    }
  },

  openTasksModal(actionId) {
    App.state.tasksModalActionId = Number(actionId);
    App.state.showTasksModal = true;
    App.save(); App.render();
  },

  closeTasksModal() {
    App.state.showTasksModal = false;
    App.state.tasksModalActionId = null;
    App.save(); App.render();
  },

  async startExecutionTask(taskId) {
    if (!window.ExecutionTaskEngine) return;
    await ExecutionTaskEngine.startTask(taskId);
    App.save(); App.render();
  },

  async completeExecutionTask(taskId) {
    if (!window.ExecutionTaskEngine) return;
    await ExecutionTaskEngine.completeTask(taskId);
    App.save(); App.render();
    Utils.toast('Tarefa concluída.');
  },

  removeExecutionTask(taskId) {
    if (!window.ExecutionTaskEngine) return;
    ExecutionTaskEngine.removeTask(taskId);
    App.save(); App.render();
    Utils.toast('Tarefa removida.');
  },

  async syncExecutionTasks() {
    if (!window.ExecutionSyncEngine) return;
    Utils.toast('Sincronizando providers...');
    const res = await ExecutionSyncEngine.syncAll();
    App.save(); App.render();
    Utils.toast(`Sync concluído: ${res.synced} tarefa(s).`);
  }
});
window.Actions = Actions;

// V16.4 — Railway Database
Object.assign(Actions, {
  setRailwayMode(mode) {
    const next = mode === 'fields' ? 'fields' : 'url';
    return Actions.updateDatabaseConfig('railway.mode', next);
  },

  toggleRailwayPassword() {
    App.state.railwayShowPassword = !App.state.railwayShowPassword;
    App.render();
  },

  parseRailwayDatabaseUrl() {
    const cfg = App.state.databaseConfig?.railway || {};
    const url = String(cfg.databaseUrl || '').trim();
    if (!url) return Utils.toast('Cole a DATABASE_URL primeiro.');
    const parsed = window.RailwayConnectionParser ? RailwayConnectionParser.parseUrl(url) : null;
    if (!parsed?.ok) return Utils.toast(parsed?.message || 'Formato inválido.');
    Actions.updateDatabaseConfig('railway.engine', parsed.engine, false);
    Actions.updateDatabaseConfig('railway.host', parsed.host, false);
    Actions.updateDatabaseConfig('railway.port', parsed.port, false);
    Actions.updateDatabaseConfig('railway.database', parsed.database, false);
    Actions.updateDatabaseConfig('railway.username', parsed.username, false);
    Actions.updateDatabaseConfig('railway.password', parsed.password, false);
    Actions.updateDatabaseConfig('railway.ssl', parsed.ssl, false);
    Actions.updateDatabaseConfig('railway.mode', 'fields');
    Utils.toast('Campos preenchidos a partir da DATABASE_URL.');
  },

  composeRailwayDatabaseUrl() {
    const cfg = App.state.databaseConfig?.railway || {};
    if (!window.RailwayConnectionParser) return;
    const errors = RailwayConnectionParser.validate({ ...cfg, mode: 'fields' });
    if (errors.length) return Utils.toast(errors[0]);
    const url = RailwayConnectionParser.buildUrl(cfg);
    Actions.updateDatabaseConfig('railway.databaseUrl', url, false);
    Actions.updateDatabaseConfig('railway.mode', 'url');
    Utils.toast('DATABASE_URL montada a partir dos campos.');
  },

  async testRailwayConnection() {
    if (!window.RailwayConnectionTester) return Utils.toast('Tester indisponível.');
    const cfg = App.state.databaseConfig || {};
    if (!cfg.railway) return Utils.toast('Configure o Railway antes.');
    const errors = window.RailwayConnectionParser ? RailwayConnectionParser.validate(cfg.railway) : [];
    if (errors.length) {
      App.state.railwayTestResults = { rounds: [], summary: { stability: 0, status: 'failed', avgLatencyMs: 0, message: errors.join(' · ') } };
      App.render();
      return Utils.toast(errors[0]);
    }
    App.state.railwayTesting = true;
    App.state.railwayTestResults = { rounds: [], summary: null };
    App.render();
    const finalResult = await RailwayConnectionTester.run(cfg, (round, partialList) => {
      App.state.railwayTestResults = { rounds: partialList, summary: RailwayConnectionTester.summarize(partialList) };
      App.render();
    });
    App.state.railwayTesting = false;
    App.state.railwayTestResults = { rounds: finalResult.results, summary: { stability: finalResult.stability, status: finalResult.status, avgLatencyMs: finalResult.avgLatencyMs, message: finalResult.message } };
    const next = { ...(App.state.databaseConfig?.railway || {}), lastTest: { at: new Date().toISOString(), status: finalResult.status, stability: finalResult.stability, avgLatencyMs: finalResult.avgLatencyMs }, lastTestResults: finalResult.results, stability: finalResult.stability };
    App.state.databaseConfig = { ...(App.state.databaseConfig || {}), railway: next };
    App.save(); App.render();
    Utils.toast(finalResult.message);
  },

  generateDatabaseSnapshot(label) {
    if (!window.DatabaseSnapshotService) return Utils.toast('Snapshot service indisponível.');
    DatabaseSnapshotService.generate(label || 'manual')
      .then(res => Utils.toast(`Snapshot gerado: ${res.filename} (${res.sizeKb}KB).`))
      .catch(err => Utils.toast(`Falha ao gerar snapshot: ${err?.message || err}`));
  },

  openRailwaySnapshotPrompt() {
    const cfg = App.state.databaseConfig?.railway || {};
    const errors = window.RailwayConnectionParser ? RailwayConnectionParser.validate(cfg) : [];
    if (errors.length) return Utils.toast(errors[0]);
    App.state.showRailwaySnapshotPrompt = true;
    App.render();
  },

  cancelRailwaySnapshotPrompt() {
    App.state.showRailwaySnapshotPrompt = false;
    App.render();
  },

  confirmRailwayAsPrimary() {
    App.state.showRailwaySnapshotPrompt = false;
    if (window.DatabaseFallbackService) DatabaseFallbackService.ensureLocalFallback();
    const cfg = App.state.databaseConfig || DatabaseService.defaultConfig();
    const railway = { ...(cfg.railway || {}), markedAsPrimary: true, savedAt: new Date().toISOString() };
    App.state.databaseConfig = { ...cfg, provider: 'railway', railway, savedAt: new Date().toISOString() };
    App.save(); App.render();
    Utils.toast('Railway definido como banco principal. Fallback local preservado.');
  }
});
window.Actions = Actions;

// V17 — Revenue Strategic Map
Object.assign(Actions, {
  openStrategicMap(productId) {
    if (!productId) return Utils.toast('Selecione um produto.');
    App.state.strategicMapProductId = Number(productId);
    App.state.showStrategicMap = true;
    App.state.strategicMapZoom = 'strategy';
    App.state.strategicObjectiveDraft = null;
    App.state.strategicOkrDraft = null;
    if (window.StrategicMapEngine) StrategicMapEngine.ensure(Number(productId));
    App.save(); App.render();
  },

  closeStrategicMap() {
    App.state.showStrategicMap = false;
    App.state.strategicObjectiveDraft = null;
    App.state.strategicOkrDraft = null;
    App.save(); App.render();
  },

  openStrategicOverview() {
    App.state.showStrategicOverview = true;
    App.save(); App.render();
  },

  closeStrategicOverview() {
    App.state.showStrategicOverview = false;
    App.save(); App.render();
  },

  // V18 — Revenue Score Center
  openRevenueScoreCreator(campaignId, editing) {
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    const existing = editing && window.RevenueScoreEngine ? RevenueScoreEngine.getBlueprint(campaignId) : null;
    App.state.revenueScoreCreatorCtx = {
      campaignId: Number(campaignId),
      editing: Boolean(editing),
      stepIndex: 0,
      answers: existing?.answers ? { ...existing.answers } : {},
      djowMessages: [{
        text: editing
          ? `Vamos revisar o ICP de "${campaign.name}". Suas respostas anteriores já estão preenchidas — ajuste o que precisar.`
          : `Vamos descobrir o ICP de "${campaign.name}" juntos. Respostas honestas geram leitura mais precisa depois.`,
        kind: 'info',
        ts: new Date().toISOString()
      }]
    };
    App.state.showRevenueScoreCreator = true;
    App.save(); App.render();
  },

  _appendDjowCreatorMessage(text, kind) {
    const ctx = App.state.revenueScoreCreatorCtx;
    if (!ctx) return;
    const list = Array.isArray(ctx.djowMessages) ? ctx.djowMessages : [];
    // Evita duplicar a última mensagem idêntica.
    if (list.length && list[list.length - 1].text === text) return;
    App.state.revenueScoreCreatorCtx = {
      ...ctx,
      djowMessages: [...list, { text, kind: kind || 'info', ts: new Date().toISOString() }]
    };
  },

  cancelRevenueScoreCreator() {
    App.state.showRevenueScoreCreator = false;
    App.state.revenueScoreCreatorCtx = null;
    App.save(); App.render();
  },

  answerRevenueScoreQuestion(questionId, value, mode) {
    const ctx = App.state.revenueScoreCreatorCtx;
    if (!ctx) return;
    const answers = { ...(ctx.answers || {}) };
    if (mode === 'multi') {
      // Backwards-compat: resposta antiga em string vira [string] antes do toggle.
      const current = answers[questionId];
      const list = Array.isArray(current) ? [...current] : (current ? [String(current)] : []);
      const idx = list.indexOf(value);
      if (idx >= 0) list.splice(idx, 1); else list.push(value);
      answers[questionId] = list;
    } else {
      answers[questionId] = value;
    }
    App.state.revenueScoreCreatorCtx = { ...ctx, answers };
    // Djow gatilho 2: resposta de texto muito curta → alerta amigável
    if (mode === 'text' && String(value || '').trim().length > 0 && String(value || '').trim().length < 12) {
      Actions._appendDjowCreatorMessage('Sua resposta está bem curta — quer detalhar um pouco? Isso melhora a precisão do Revenue Score depois.', 'warning');
    }
    App.render();
    // Auto-advance em single-choice com microdelay (200ms) — UX não brusca
    if (mode === 'single') {
      setTimeout(() => {
        // Re-checa: o usuário pode ter cancelado o modal nesse meio tempo.
        if (App.state.showRevenueScoreCreator && App.state.revenueScoreCreatorCtx?.answers?.[questionId] === value) {
          Actions.nextRevenueScoreStep();
        }
      }, 220);
    }
  },

  nextRevenueScoreStep() {
    const ctx = App.state.revenueScoreCreatorCtx;
    if (!ctx) return;
    const segment = ctx.answers?.segment || null;
    const total = segment ? IcpConversationFlow.totalSteps(segment) : 5;
    const currentIdx = Number(ctx.stepIndex || 0);
    const nextIdx = Math.min(currentIdx + 1, total);
    App.state.revenueScoreCreatorCtx = { ...ctx, stepIndex: nextIdx };
    // Djow gatilho 3: transição entre etapas (mensagem do próximo tópico)
    const nextQuestion = window.IcpConversationFlow ? IcpConversationFlow.questionAt(segment, nextIdx) : null;
    if (nextQuestion && nextIdx < total) {
      Actions._appendDjowCreatorMessage(this._transitionMessage(currentIdx, nextQuestion), 'info');
    }
    // Djow gatilho 4: fechamento (entrou na revisão)
    if (nextIdx >= total) {
      const positives = (App.state.revenueScoreCreatorCtx.answers?.qualificationSignals || App.state.revenueScoreCreatorCtx.answers?.interestSignals || []).length;
      Actions._appendDjowCreatorMessage(`Pronto. ${positives ? `Captei ${positives} sinal(is) positivo(s) — vou gerar o blueprint com decay temporal e thresholds dinâmicos.` : 'Sem sinais positivos selecionados, o engagement vai ficar baixo. Considere voltar e marcar pelo menos um.'}`, 'celebrate');
    }
    App.save(); App.render();
  },

  _transitionMessage(prevIdx, nextQuestion) {
    const topicMap = {
      segment: 'o segmento',
      decisionMaker: 'quem decide',
      companySize: 'o tamanho das empresas',
      painPoint: 'a dor principal',
      qualificationSignals: 'os sinais de qualificação',
      ageRange: 'a faixa etária',
      interest: 'o interesse principal',
      interestSignals: 'os sinais de interesse',
      negativeSignals: 'o que NÃO é seu público'
    };
    const topic = topicMap[nextQuestion.id] || 'o próximo ponto';
    return `Boa. Agora vou perguntar sobre ${topic}.`;
  },

  previousRevenueScoreStep() {
    const ctx = App.state.revenueScoreCreatorCtx;
    if (!ctx) return;
    const prev = Math.max(0, Number(ctx.stepIndex || 0) - 1);
    App.state.revenueScoreCreatorCtx = { ...ctx, stepIndex: prev };
    App.save(); App.render();
  },

  commitRevenueScoreBlueprint() {
    const ctx = App.state.revenueScoreCreatorCtx;
    if (!ctx || !window.RevenueScoreBlueprintEngine) return;
    const action = ctx.editing ? 'updateFromAnswers' : 'createFromAnswers';
    const bp = RevenueScoreBlueprintEngine[action](ctx.campaignId, ctx.answers || {});
    const wasCreate = !ctx.editing;
    App.state.showRevenueScoreCreator = false;
    App.state.revenueScoreCreatorCtx = null;
    // V21 — Pós-criação: oferece buscar leads aderentes na base global
    if (wasCreate) {
      App.state.showPostScoreSearchPrompt = true;
      App.state.postScoreSearchCampaignId = Number(ctx.campaignId);
    }
    App.save(); App.render();
    Utils.toast(`Revenue Score ${ctx.editing ? 'atualizado' : 'criado'}: ${bp.segment}.`);
  },

  cancelPostScoreSearch() {
    App.state.showPostScoreSearchPrompt = false;
    App.state.postScoreSearchCampaignId = null;
    App.save(); App.render();
  },

  // V21.2 — Abre o prompt de conexão para qualquer campanha (usado pelo
  // botão de status no Center e pela ação "Conectar" do dashboard).
  openConnectLeadsForCampaign(campaignId) {
    if (!campaignId) return;
    App.state.postScoreSearchCampaignId = Number(campaignId);
    App.state.showPostScoreSearchPrompt = true;
    App.state.showRevenueScoreDashboard = false;
    App.save(); App.render();
  },

  goToBuscadorWithContext() {
    const campaignId = App.state.postScoreSearchCampaignId;
    if (!campaignId) return Actions.cancelPostScoreSearch();
    const blueprint = window.RevenueScoreEngine?.getBlueprint(campaignId);
    App.state.profileCampaignContext = Number(campaignId);
    App.state.profileIcpContext = blueprint?.profileSummary || null;
    App.state.profileActive = true;
    App.state.showPostScoreSearchPrompt = false;
    App.state.postScoreSearchCampaignId = null;
    App.state.showRevenueScoreDashboard = false;
    App.setTab('leads');
    Utils.toast('Buscador filtrando pela campanha. Selecione e clique em "Vincular à campanha".');
  },

  clearProfileCampaignContext() {
    App.state.profileCampaignContext = null;
    App.state.profileIcpContext = null;
    App.save(); App.render();
  },

  linkLeadToCampaignFromBuscador(leadKey) {
    const campaignId = App.state.profileCampaignContext;
    if (!campaignId) return Utils.toast('Defina o contexto da campanha primeiro.');
    if (!window.LeadBaseService) return Utils.toast('LeadBaseService indisponível.');
    const added = LeadBaseService.linkToCampaign(leadKey, campaignId);
    if (!added) return Utils.toast('Esse lead já está vinculado.');
    App.save(); App.render();
    Utils.toast('Lead vinculado à campanha.');
  },

  // V21.3 — Bulk-link de todos os leads do resultado atual (filtro ou não)
  linkAllDisplayedLeads() {
    const campaignId = App.state.profileCampaignContext;
    if (!campaignId) return Utils.toast('Sem contexto de campanha.');
    if (!window.LeadBaseService || !window.LeadsModule) return Utils.toast('Serviços indisponíveis.');
    const leads = LeadsModule._getDisplayedLeads();
    if (!leads.length) return Utils.toast('Sem leads no resultado pra vincular.');
    let added = 0, already = 0;
    for (const lead of leads) {
      const ok = LeadBaseService.linkToCampaign(lead.id, campaignId);
      if (ok) added += 1; else already += 1;
    }
    if (!added) {
      Utils.toast(`Todos os ${already} lead(s) já estavam vinculados.`);
      return;
    }
    App.save(); App.render();
    Utils.toast(`${added} lead(s) vinculado(s)${already ? ` · ${already} já estavam` : ''}.`);
  },

  unlinkLeadFromCampaign(leadKey, campaignId) {
    if (!window.LeadBaseService) return;
    LeadBaseService.unlinkFromCampaign(leadKey, campaignId);
    App.save(); App.render();
    Utils.toast('Vínculo removido.');
  },

  // V21 — Sync manual do RD CRM
  async syncRdCrmNow() {
    if (!window.RdCrmLiveSyncEngine) return Utils.toast('RD Live Sync indisponível.');
    Utils.toast('Sincronizando com RD CRM...');
    await RdCrmLiveSyncEngine.runOnce(false);
  },

  openRevenueScoreDashboard(campaignId) {
    App.state.revenueScoreDashboardCampaignId = Number(campaignId);
    App.state.showRevenueScoreDashboard = true;
    App.save(); App.render();
  },

  closeRevenueScoreDashboard() {
    App.state.showRevenueScoreDashboard = false;
    App.state.revenueScoreDashboardCampaignId = null;
    App.save(); App.render();
  },

  // V18.1 — Auto-dispatch de Revenue Ready para tarefa no provider (V16.3).
  // Identifica novos Revenue Ready (não disparados ainda) e cria uma tarefa
  // por lead via ExecutionTaskEngine. Persistido em revenueReadyTriggered.
  async dispatchRevenueReadyTasks(campaignId) {
    if (!window.ExecutionTaskEngine) return Utils.toast('Execution engine indisponível.');
    const v2 = window.LeadScoringV2 ? LeadScoringV2.classifyCampaign(campaignId) : null;
    if (!v2?.ok) return Utils.toast(v2?.message || 'Sem classification.');
    const blueprint = v2.blueprint;
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    const pending = this._pendingRevenueReadyLeads(campaignId, v2.classified);
    if (!pending.length) return Utils.toast('Nenhum novo lead Revenue Ready para disparar.');
    const triggeredMap = { ...(App.state.revenueReadyTriggered || {}) };
    const byCampaign = { ...(triggeredMap[campaignId] || {}) };
    let created = 0, failed = 0;
    for (const item of pending) {
      const key = this._leadKey(item.lead);
      const pkg = window.HandoffProtocol ? HandoffProtocol.buildPackage(item, campaign, blueprint) : null;
      const parsed = pkg ? HandoffProtocol.toTaskPayload(pkg) : {
        title: `[Revenue Ready] ${item.lead?.name || item.lead?.email || 'Lead'}`,
        description: `Tier ${item.tier} · ${item.revenueScore}% revenue score`,
        priority: 'high',
        assignee: campaign?.owner || '',
        due_date: null
      };
      try {
        const res = await ExecutionTaskEngine.createFromParsedResponse(item.actionId, parsed, 'revenue-score-v2');
        if (res?.ok) { created += 1; byCampaign[key] = new Date().toISOString(); }
        else failed += 1;
      } catch (_) { failed += 1; }
    }
    triggeredMap[campaignId] = byCampaign;
    App.state.revenueReadyTriggered = triggeredMap;
    App.save(); App.render();
    Utils.toast(`${created} hand-off(s) enviado(s)${failed ? ` · ${failed} falharam` : ''}.`);
  },

  _pendingRevenueReadyLeads(campaignId, classified) {
    const triggered = (App.state.revenueReadyTriggered || {})[campaignId] || {};
    return (classified || []).filter(c => c.revenueReady && !triggered[this._leadKey(c.lead)]);
  },

  _leadKey(lead) {
    return String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim() || `lead_${Math.random().toString(36).slice(2, 8)}`;
  },

  // V19 — Outcome + Lifecycle + Negative Selection + Recycling + Signal recording
  markLeadOutcome(leadKey, campaignId, outcome) {
    if (!window.OutcomeTracker) return;
    OutcomeTracker.mark(leadKey, campaignId, outcome);
    App.save(); App.render();
    Utils.toast(`Outcome do lead marcado como "${outcome}".`);
  },

  setLeadLifecycleStage(leadKey, campaignId, stageId) {
    if (!window.LifecycleEngine) return;
    App.state.actions = (App.state.actions || []).map(action => ({
      ...action,
      leads: (action.leads || []).map(lead => {
        const k = String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
        if (k !== String(leadKey).toLowerCase().trim()) return lead;
        return LifecycleEngine.transition(lead, stageId);
      })
    }));
    App.save(); App.render();
    Utils.toast(`Stage atualizado para ${stageId}.`);
  },

  recycleStaleLead(leadKey, campaignId) {
    if (!window.LeadRecyclingEngine || !window.LifecycleEngine) return;
    App.state.actions = (App.state.actions || []).map(action => ({
      ...action,
      leads: (action.leads || []).map(lead => {
        const k = String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
        if (k !== String(leadKey).toLowerCase().trim()) return lead;
        return LeadRecyclingEngine.recycle(lead);
      })
    }));
    App.save(); App.render();
    Utils.toast('Lead reciclado para stage anterior.');
  },

  excludeAccountDomain(domain) {
    if (!window.NegativeSelectionEngine) return;
    NegativeSelectionEngine.excludeDomain(domain);
    App.save(); App.render();
    Utils.toast(`Domínio "${domain}" excluído (Negative Selection).`);
  },

  removeExcludedDomain(domain) {
    if (!window.NegativeSelectionEngine) return;
    NegativeSelectionEngine.remove('domain', domain);
    App.save(); App.render();
    Utils.toast(`Domínio "${domain}" removido da exclusão.`);
  },

  setLeadBuyingRole(leadKey, role) {
    App.state.actions = (App.state.actions || []).map(action => ({
      ...action,
      leads: (action.leads || []).map(lead => {
        const k = String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
        return k === String(leadKey).toLowerCase().trim() ? { ...lead, buyingRole: role } : lead;
      })
    }));
    App.save(); App.render();
  },

  updateLeadMeddic(leadKey, field, value) {
    if (!window.MeddicEngine) return;
    App.state.actions = (App.state.actions || []).map(action => ({
      ...action,
      leads: (action.leads || []).map(lead => {
        const k = String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
        return k === String(leadKey).toLowerCase().trim() ? MeddicEngine.update(lead, { [field]: value }) : lead;
      })
    }));
    App.save();
  },

  recordLeadSignal(leadKey, signal) {
    const key = String(leadKey).toLowerCase().trim();
    if (!key) return;
    const all = App.state.leadEngagementHistory || {};
    const current = Array.isArray(all[key]) ? all[key] : [];
    App.state.leadEngagementHistory = { ...all, [key]: [...current, { signal, ts: new Date().toISOString() }] };
    App.save();
  },

  // V19.1 — Lead Detail Modal: tags manuais, edição de campos, aliases, custom signals
  openLeadDetailModal(campaignId, actionId, leadKey) {
    App.state.leadDetailContext = { campaignId: Number(campaignId), actionId: Number(actionId), leadKey: String(leadKey) };
    App.state.showLeadDetailModal = true;
    App.save(); App.render();
  },

  closeLeadDetailModal() {
    App.state.showLeadDetailModal = false;
    App.state.leadDetailContext = null;
    App.save(); App.render();
  },

  _findLeadByKey(leadKey) {
    const target = String(leadKey).toLowerCase().trim();
    for (const action of (App.state.actions || [])) {
      for (const lead of (action.leads || [])) {
        const k = String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
        if (k === target) return { lead, action };
      }
    }
    return null;
  },

  updateLeadField(leadKey, field, value) {
    const target = String(leadKey).toLowerCase().trim();
    App.state.actions = (App.state.actions || []).map(action => ({
      ...action,
      leads: (action.leads || []).map(lead => {
        const k = String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
        return k === target ? { ...lead, [field]: value } : lead;
      })
    }));
    App.save();
  },

  addLeadTagFromInput(leadKey) {
    const el = document.getElementById('leadTagInput');
    if (!el) return;
    const value = String(el.value || '').trim().replace(/^#/, '');
    if (!value) return;
    Actions.addLeadTag(leadKey, value);
    el.value = '';
  },

  addLeadTag(leadKey, tag) {
    const value = String(tag || '').trim().replace(/^#/, '');
    if (!value) return;
    const target = String(leadKey).toLowerCase().trim();
    App.state.actions = (App.state.actions || []).map(action => ({
      ...action,
      leads: (action.leads || []).map(lead => {
        const k = String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
        if (k !== target) return lead;
        const tags = Array.isArray(lead.tags) ? lead.tags : String(lead.tags || '').split(/[,;]/).map(t => t.trim()).filter(Boolean);
        if (tags.includes(value)) return lead;
        return { ...lead, tags: [...tags, value] };
      })
    }));
    App.save(); App.render();
    Utils.toast(`Tag "${value}" adicionada.`);
  },

  // V20 — Trigger events do lead (Bloco B)
  addLeadTriggerEvent(leadKey, selectId) {
    const el = document.getElementById(selectId);
    if (!el || !el.value) return Utils.toast('Escolha um evento.');
    const kind = el.value;
    const target = String(leadKey).toLowerCase().trim();
    App.state.actions = (App.state.actions || []).map(action => ({
      ...action,
      leads: (action.leads || []).map(lead => {
        const k = String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
        if (k !== target) return lead;
        const events = Array.isArray(lead.triggerEvents) ? lead.triggerEvents : [];
        return { ...lead, triggerEvents: [...events, { kind, ts: new Date().toISOString() }] };
      })
    }));
    el.value = '';
    App.save(); App.render();
    Utils.toast('Evento-gatilho registrado.');
  },

  removeLeadTriggerEvent(leadKey, index) {
    const target = String(leadKey).toLowerCase().trim();
    App.state.actions = (App.state.actions || []).map(action => ({
      ...action,
      leads: (action.leads || []).map(lead => {
        const k = String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
        if (k !== target) return lead;
        const events = Array.isArray(lead.triggerEvents) ? lead.triggerEvents : [];
        return { ...lead, triggerEvents: events.filter((_, i) => i !== Number(index)) };
      })
    }));
    App.save(); App.render();
  },

  removeLeadTag(leadKey, tag) {
    const target = String(leadKey).toLowerCase().trim();
    App.state.actions = (App.state.actions || []).map(action => ({
      ...action,
      leads: (action.leads || []).map(lead => {
        const k = String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
        if (k !== target) return lead;
        const tags = Array.isArray(lead.tags) ? lead.tags : String(lead.tags || '').split(/[,;]/).map(t => t.trim()).filter(Boolean);
        return { ...lead, tags: tags.filter(t => t !== tag) };
      })
    }));
    App.save(); App.render();
  },

  // Adiciona texto livre numa pergunta multi-text (interest, painPoint).
  // Comportamento: append no array da resposta. Se já existe, ignora (silent).
  addRevenueScoreMultiText(questionId, inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    const value = String(el.value || '').trim();
    if (!value) return;
    const ctx = App.state.revenueScoreCreatorCtx;
    if (!ctx) return;
    const existing = ctx.answers?.[questionId];
    const arr = Array.isArray(existing) ? existing : (existing ? [String(existing)] : []);
    if (arr.includes(value)) { el.value = ''; return; }
    App.state.revenueScoreCreatorCtx = { ...ctx, answers: { ...ctx.answers, [questionId]: [...arr, value] } };
    el.value = '';
    App.save(); App.render();
  },

  // Custom signal cadastrado inline (sem window.prompt). Bucket dependente
  // da questão (positivo B2B / positivo B2C / negativo). Auto-marca como
  // selecionado já que o usuário acabou de digitar com intenção clara.
  addCustomScoreSignalFromInput(questionId, inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    const name = String(el.value || '').trim();
    if (!name) return;
    const ctx = App.state.revenueScoreCreatorCtx;
    if (!ctx) return;
    const added = window.IcpConversationFlow?.addCustomSignalForQuestion?.(questionId, name);
    if (!added) {
      Utils.toast('Esse sinal já existe.');
      el.value = '';
      return;
    }
    // Auto-marca como selecionado na pergunta atual
    const current = ctx.answers?.[questionId];
    const list = Array.isArray(current) ? [...current] : (current ? [String(current)] : []);
    if (!list.includes(name)) list.push(name);
    App.state.revenueScoreCreatorCtx = { ...ctx, answers: { ...ctx.answers, [questionId]: list } };
    el.value = '';
    App.save(); App.render();
    Utils.toast(`"${name}" cadastrado e marcado.`);
  },

  // Tag aliases por signal (mapeia tag-do-RD/CSV ao signal do blueprint)
  addTagAliasFromInput(signal, inputId) {
    const el = document.getElementById(inputId);
    if (!el) return;
    const raw = String(el.value || '').trim();
    if (!raw) return;
    const tags = raw.split(/[,;]/).map(t => t.trim().replace(/^#/, '')).filter(Boolean);
    for (const t of tags) Actions.addTagAlias(signal, t);
    el.value = '';
  },

  addTagAlias(signal, tag) {
    const ctx = App.state.revenueScoreCreatorCtx;
    if (!ctx) return;
    const value = String(tag || '').trim().replace(/^#/, '');
    if (!value) return;
    const aliases = { ...(ctx.answers?.tagAliases || {}) };
    const list = Array.isArray(aliases[signal]) ? aliases[signal] : [];
    if (list.includes(value)) return;
    aliases[signal] = [...list, value];
    App.state.revenueScoreCreatorCtx = { ...ctx, answers: { ...ctx.answers, tagAliases: aliases } };
    App.render();
  },

  removeTagAlias(signal, tag) {
    const ctx = App.state.revenueScoreCreatorCtx;
    if (!ctx) return;
    const aliases = { ...(ctx.answers?.tagAliases || {}) };
    const list = Array.isArray(aliases[signal]) ? aliases[signal] : [];
    aliases[signal] = list.filter(t => t !== tag);
    App.state.revenueScoreCreatorCtx = { ...ctx, answers: { ...ctx.answers, tagAliases: aliases } };
    App.render();
  },

  dismissStrategicOnboarding() {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicOnboarding) return;
    StrategicOnboarding.markSeen(productId);
    App.save(); App.render();
  },

  openStrategicOnboarding() {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicOnboarding) return;
    StrategicOnboarding.reset(productId);
    App.save(); App.render();
  },

  setStrategicZoom(level) {
    if (!window.StrategicZoomNavigation) return;
    StrategicZoomNavigation.set(level);
    App.save(); App.render();
  },

  advanceStrategicStep() {
    if (!window.StrategicZoomNavigation) return;
    if (StrategicZoomNavigation.isLast()) return;
    const next = StrategicZoomNavigation.next();
    StrategicZoomNavigation.set(next.id);
    App.save(); App.render();
  },

  toggleStrategicOkrAction(objectiveId, okrId, actionId) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicOkrEngine) return;
    StrategicOkrEngine.toggleAction(productId, objectiveId, okrId, actionId);
    App.save(); App.render();
  },

  syncStrategicOkrSingle(objectiveId, okrId) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicMapEngine || !window.StrategicRevenueBridge) return;
    const map = StrategicMapEngine.getForProduct(productId);
    const obj = (map.objectives || []).find(o => o.id === objectiveId);
    const kr = obj?.okrs?.find(k => k.id === okrId);
    if (!kr) return Utils.toast('OKR não encontrado.');
    const current = StrategicRevenueBridge.computeCurrent(productId, kr);
    StrategicOkrEngine.update(productId, objectiveId, okrId, { current });
    App.save(); App.render();
    Utils.toast(`OKR atualizado: ${current} ${kr.metric}.`);
  },

  openQuickActionModal(productId, objectiveId, okrId) {
    const campaigns = (App.state.campaigns || []).filter(c => Number(c.productId) === Number(productId));
    if (!campaigns.length) {
      Utils.toast('Crie uma campanha para este produto antes de criar ações.');
      return;
    }
    App.state.quickActionContext = { productId: Number(productId), objectiveId, okrId };
    const channels = window.Config?.allChannels?.() || [];
    const types = window.Config?.allActionTypes?.() || [];
    App.state.quickActionDraft = {
      name: '',
      campaignId: Number(campaigns[0].id),
      channel: channels[0] || 'Instagram Orgânico',
      actionType: types[0] || 'Post'
    };
    App.state.showQuickActionModal = true;
    App.save(); App.render();
  },

  updateQuickActionDraft(field, value) {
    App.state.quickActionDraft = { ...(App.state.quickActionDraft || {}), [field]: value };
  },

  closeQuickActionModal() {
    App.state.showQuickActionModal = false;
    App.state.quickActionContext = null;
    App.state.quickActionDraft = { name: '', campaignId: null, channel: '', actionType: '' };
    App.save(); App.render();
  },

  createQuickAction() {
    const draft = App.state.quickActionDraft || {};
    const ctx = App.state.quickActionContext;
    if (!ctx) return Utils.toast('Contexto perdido. Reabra pelo OKR.');
    const name = String(draft.name || '').trim();
    if (!name) return Utils.toast('Digite o nome da ação.');
    const campaignId = Number(draft.campaignId);
    if (!campaignId) return Utils.toast('Selecione uma campanha.');
    const sector = 'Marketing', funnel = 'MOF';
    const flowPath = FlowResolutionEngine.resolve(sector, funnel, sector, funnel);
    const channel = draft.channel || 'Instagram Orgânico';
    const actionType = draft.actionType || 'Post';
    const action = {
      id: Date.now(),
      campaignId,
      name,
      channel,
      actionType,
      sector, funnel,
      originSector: sector, originFunnel: funnel, destinationSector: sector, destinationFunnel: funnel,
      conversionObjective: '',
      objective: '',
      expectedConversion: 25,
      mailingDefined: false,
      okrs: [],
      flowPath,
      scoreId: App.state.scores?.[0]?.id || 1,
      connected: false,
      connectionStatus: 'ready',
      status: 'Rascunho — completar em Ações',
      leads: [],
      flowConfig: FlowResolutionEngine.buildDefaultFlowConfig ? FlowResolutionEngine.buildDefaultFlowConfig(flowPath, channel) : null,
      isDraft: true,
      createdAt: new Date().toISOString()
    };
    App.state.actions = [action, ...(App.state.actions || [])];
    if (window.StrategicOkrEngine) {
      StrategicOkrEngine.toggleAction(ctx.productId, ctx.objectiveId, ctx.okrId, action.id);
    }
    App.state.showQuickActionModal = false;
    App.state.quickActionContext = null;
    App.state.quickActionDraft = { name: '', campaignId: null, channel: '', actionType: '' };
    App.save(); App.render();
    Utils.toast(`"${name}" criada como rascunho e conectada ao OKR. Complete em Ações de Campanha para a leitura ficar precisa.`);
  },

  createTaskFromOkr(productId, objectiveId, okrId, actionId) {
    const map = window.StrategicMapEngine ? StrategicMapEngine.getForProduct(productId) : null;
    const obj = map?.objectives?.find(o => o.id === objectiveId);
    const kr = obj?.okrs?.find(k => k.id === okrId);
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!kr || !action) return Utils.toast('OKR ou ação não encontrada.');
    const providerLabel = window.ExecutionProviderRegistry?.byId(ExecutionProviderRegistry.getDefaultProviderId())?.label || 'Manual';
    const seed = [
      `Djow, crie uma tarefa de execução para o OKR "${kr.name}".`,
      `Objetivo estratégico: ${obj.label}.`,
      `Meta: ${kr.target} ${kr.metric}. Atual: ${kr.current || 0}. ${kr.deadline ? `Prazo: ${kr.deadline}.` : ''}`,
      `Ação operacional vinculada: ${action.name}.`,
      `Provider de destino: ${providerLabel}.`,
      kr.owner ? `Responsável sugerido: ${kr.owner}.` : '',
      'Estruture: título, responsável, prazo, descrição e prioridade.'
    ].filter(Boolean).join('\n');
    App.state.showStrategicMap = false;
    App.state.djowModalActionId = Number(actionId);
    App.state.djowDraftMessage = seed;
    App.state.djowSending = false;
    App.state.showDjowModal = true;
    App.save(); App.render();
  },

  updateStrategicVision(value) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicMapEngine) return;
    StrategicMapEngine.setVision(productId, value);
    App.save();
  },

  startStrategicObjectiveDraft() {
    App.state.strategicObjectiveDraft = { label: '', owner: '', deadline: '' };
    App.render();
  },

  updateStrategicObjectiveDraft(field, value) {
    if (!App.state.strategicObjectiveDraft) return;
    App.state.strategicObjectiveDraft = { ...App.state.strategicObjectiveDraft, [field]: value };
  },

  cancelStrategicObjectiveDraft() {
    App.state.strategicObjectiveDraft = null;
    App.render();
  },

  saveStrategicObjectiveDraft() {
    const productId = App.state.strategicMapProductId;
    const draft = App.state.strategicObjectiveDraft;
    if (!productId || !draft) return;
    if (!String(draft.label || '').trim()) return Utils.toast('Dê um nome ao objetivo.');
    StrategicObjectiveEngine.add(productId, draft);
    App.state.strategicObjectiveDraft = null;
    App.save(); App.render();
    Utils.toast('Objetivo adicionado.');
  },

  removeStrategicObjective(objectiveId) {
    const productId = App.state.strategicMapProductId;
    if (!productId) return;
    StrategicObjectiveEngine.remove(productId, objectiveId);
    App.save(); App.render();
    Utils.toast('Objetivo removido.');
  },

  startStrategicOkrDraft(objectiveId) {
    App.state.strategicOkrDraft = { objectiveId, name: '', metric: 'leads', target: 0, current: 0, owner: '', deadline: '', connectedActionIds: [] };
    App.render();
  },

  updateStrategicOkrDraft(field, value) {
    if (!App.state.strategicOkrDraft) return;
    App.state.strategicOkrDraft = { ...App.state.strategicOkrDraft, [field]: value };
  },

  toggleStrategicOkrDraftAction(actionId) {
    const draft = App.state.strategicOkrDraft;
    if (!draft) return;
    const numId = Number(actionId);
    const current = (draft.connectedActionIds || []).map(Number);
    const exists = current.includes(numId);
    App.state.strategicOkrDraft = { ...draft, connectedActionIds: exists ? current.filter(id => id !== numId) : [...current, numId] };
    App.render();
  },

  cancelStrategicOkrDraft() {
    App.state.strategicOkrDraft = null;
    App.render();
  },

  saveStrategicOkrDraft() {
    const productId = App.state.strategicMapProductId;
    const draft = App.state.strategicOkrDraft;
    if (!productId || !draft) return;
    if (!String(draft.name || '').trim()) return Utils.toast('Dê um nome ao OKR.');
    StrategicOkrEngine.add(productId, draft.objectiveId, draft);
    App.state.strategicOkrDraft = null;
    App.save(); App.render();
    Utils.toast('OKR adicionado.');
  },

  removeStrategicOkr(objectiveId, okrId) {
    const productId = App.state.strategicMapProductId;
    if (!productId) return;
    StrategicOkrEngine.remove(productId, objectiveId, okrId);
    App.save(); App.render();
    Utils.toast('OKR removido.');
  },

  syncStrategicOkrsFromOps() {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicRevenueBridge) return;
    StrategicRevenueBridge.syncOkrFromOperations(productId);
    App.save(); App.render();
    Utils.toast('OKRs atualizados com leitura operacional.');
  },

  updateStrategicDjowDraft(value) {
    App.state.strategicDjowDraft = String(value || '');
  },

  async askStrategicDjow(prefilled) {
    App.state.strategicDjowDraft = prefilled || '';
    App.render();
    await Actions.sendStrategicDjow();
  },

  async sendStrategicDjow() {
    const productId = App.state.strategicMapProductId;
    const message = String(App.state.strategicDjowDraft || '').trim();
    if (!productId || !message || !window.DjowStrategicAssistant) return;
    DjowStrategicAssistant.append(productId, { role: 'user', text: message, ts: new Date().toISOString() });
    App.state.strategicDjowDraft = '';
    App.state.strategicDjowSending = true;
    App.save(); App.render();
    try {
      const res = await DjowStrategicAssistant.dispatch(productId, message);
      if (res?.text) DjowStrategicAssistant.append(productId, { role: 'agent', text: res.text, source: res.source, ts: new Date().toISOString() });
    } catch (err) {
      DjowStrategicAssistant.append(productId, { role: 'agent', text: `Erro: ${err?.message || err}`, ts: new Date().toISOString() });
    } finally {
      App.state.strategicDjowSending = false;
      App.save(); App.render();
    }
  }
});
window.Actions = Actions;
