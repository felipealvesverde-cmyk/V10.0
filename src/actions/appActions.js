var Actions = {
      // V31.2.1 — Administrar Lead Journey: deletar produto em cascata.
      // Master-only (Settings já gate por isMaster). Confirmação dupla via typed.
      adminRequestDeleteProduct(productId) {
        // V32.5.7 — Removida checagem isMaster. Qualquer user gerencia próprios
        // produtos via Minha Conta. Demo guard mantém — user demo é read-only.
        if (this._demoGuard && this._demoGuard('Apagar produto')) return;
        App.state.adminDeleteProductPending = { productId: Number(productId), typed: '' };
        App.render();
      },
      adminDeleteProductTyped(value) {
        const pending = App.state.adminDeleteProductPending;
        if (!pending) return;
        pending.typed = String(value || '');
        App.render();
      },
      adminCancelDeleteProduct() {
        App.state.adminDeleteProductPending = null;
        App.render();
      },
      adminConfirmDeleteProduct(productId) {
        // V32.5.7 — Removida checagem isMaster. Cliente do tenant gerencia
        // próprios produtos via Configurações → Minha Conta → Produtos.
        // Tenant DB já isola dados — não há risco de apagar produto alheio.
        const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
        if (!product) return Utils.toast('Produto não encontrado.');
        const pending = App.state.adminDeleteProductPending;
        if (!pending || pending.typed !== product.name) return Utils.toast('Confirme digitando o nome exato.');

        const pid = Number(productId);
        // Identifica dependências antes de deletar
        const campaigns = (App.state.campaigns || []).filter(c => Number(c.productId) === pid);
        const campaignIds = new Set(campaigns.map(c => Number(c.id)));
        const actions = (App.state.actions || []).filter(a => campaignIds.has(Number(a.campaignId)));
        const actionIds = new Set(actions.map(a => Number(a.id)));
        const leadIds = new Set();
        actions.forEach(a => (a.leads || []).forEach(l => leadIds.add(Number(l.id))));

        // CASCADE — apaga tudo em ordem
        // 1. Tabelas list-based
        App.state.products = (App.state.products || []).filter(p => Number(p.id) !== pid);
        App.state.campaigns = (App.state.campaigns || []).filter(c => !campaignIds.has(Number(c.id)));
        App.state.actions = (App.state.actions || []).filter(a => !actionIds.has(Number(a.id)));
        App.state.manualLeads = (App.state.manualLeads || []).filter(l =>
          !campaignIds.has(Number(l.campaignId)) && !actionIds.has(Number(l.actionId))
        );
        App.state.executionTasks = (App.state.executionTasks || []).filter(t =>
          !campaignIds.has(Number(t.linked_campaign_id)) && !actionIds.has(Number(t.linked_action_id))
        );

        // 2. Dicts keyed por productId
        const strategicMaps = { ...(App.state.strategicMaps || {}) };
        delete strategicMaps[pid];
        App.state.strategicMaps = strategicMaps;

        const revopsFinance = { ...(App.state.revopsFinance || {}) };
        delete revopsFinance[pid];
        App.state.revopsFinance = revopsFinance;

        // 3. Dicts keyed por campaignId
        const strategicCampaignMaps = { ...(App.state.strategicCampaignMaps || {}) };
        campaignIds.forEach(cid => delete strategicCampaignMaps[cid]);
        App.state.strategicCampaignMaps = strategicCampaignMaps;

        const revenueScoreBlueprints = { ...(App.state.revenueScoreBlueprints || {}) };
        campaignIds.forEach(cid => delete revenueScoreBlueprints[cid]);
        App.state.revenueScoreBlueprints = revenueScoreBlueprints;

        const revenueReadyTriggered = { ...(App.state.revenueReadyTriggered || {}) };
        campaignIds.forEach(cid => delete revenueReadyTriggered[cid]);
        App.state.revenueReadyTriggered = revenueReadyTriggered;

        if (App.state.integrations?.rdCrm?.pipelinesByCampaign) {
          const piby = { ...(App.state.integrations.rdCrm.pipelinesByCampaign) };
          campaignIds.forEach(cid => delete piby[cid]);
          App.state.integrations = {
            ...App.state.integrations,
            rdCrm: { ...(App.state.integrations.rdCrm || {}), pipelinesByCampaign: piby }
          };
        }

        // 4. Dicts keyed por leadId
        const leadOutcomes = { ...(App.state.leadOutcomes || {}) };
        const leadScoreHistory = { ...(App.state.leadScoreHistory || {}) };
        const leadEngagementHistory = { ...(App.state.leadEngagementHistory || {}) };
        leadIds.forEach(lid => {
          delete leadOutcomes[lid];
          delete leadScoreHistory[lid];
          delete leadEngagementHistory[lid];
        });
        App.state.leadOutcomes = leadOutcomes;
        App.state.leadScoreHistory = leadScoreHistory;
        App.state.leadEngagementHistory = leadEngagementHistory;

        // 5. Seleção atual se apontava pro produto deletado
        if (Number(App.state.selectedProductId) === pid) {
          App.state.selectedProductId = (App.state.products[0] || {}).id || null;
        }
        if (campaignIds.has(Number(App.state.selectedCampaignId))) {
          App.state.selectedCampaignId = (App.state.campaigns[0] || {}).id || null;
        }
        if (actionIds.has(Number(App.state.selectedActionId))) {
          App.state.selectedActionId = null;
        }

        // 6. Limpa o pending + persiste
        App.state.adminDeleteProductPending = null;
        App.save(); App.render();
        Utils.toast(`Produto "${product.name}" apagado: ${campaigns.length} campanha(s), ${actions.length} ação(ões), ${leadIds.size} lead(s).`);
        // V32.2.5 (Geraldo A15) — Sync delete cascado pro ClickUp.
        // Ordem: actions primeiro (subtasks), campanhas (lists), produto (folder).
        // Best-effort, sem bloquear UI.
        if (window.Actions?._syncDeleteToClickup) {
          actionIds.forEach(aid => Actions._syncDeleteToClickup('action', aid));
          campaignIds.forEach(cid => Actions._syncDeleteToClickup('campaign', cid));
          Actions._syncDeleteToClickup('product', pid);
        }
      },

      // V31.0.0 — Helpers demo mode. Backend bloqueia mutations (403) via middleware;
      // estes helpers no frontend são UX (toast amigável + abort) e ficam fora dos
      // Actions principais — quem quiser blindar uma Action chama Actions._demoGuard()
      // no topo. Para Actions que não chamam, o backend ainda bloqueia: state
      // in-memory pode mostrar mudança fantasma até reload, mas DB nunca é tocado.
      _isDemoUser() {
        try {
          const u = JSON.parse(localStorage.getItem('lj_user') || '{}');
          return u.mode === 'demo';
        } catch (_) { return false; }
      },
      _demoGuard(label) {
        if (!this._isDemoUser()) return false;
        Utils.toast(`Modo demo · ${label || 'cadastros'} desabilitado. Navegue à vontade!`);
        return true;
      },

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
      // V32.4.0 (Geraldo Item 6) — trocou DatabaseService.emptyDataState() por State.initial()
      // pois databaseService refatorado pra manter só helpers de state migration.
      resetDemo() { StorageAdapter.clear(); App.state = State.initial(); App.render(); Utils.toast('Dados locais limpos.'); },
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
    if (this._demoGuard && this._demoGuard('Criar produto')) return null;
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
    return product;
  },

  // V31.2.5 — Caminho "estratégico-primeiro": botão Criar com Mapa abre popup
  // mínimo (só nome do produto) e em seguida joga direto no Mapa da Receita
  // pra construir Visão → Frentes → Números → Ações → Execução guiado.
  openNewProductWithMapaPopup() {
    if (this._demoGuard && this._demoGuard('Criar produto')) return;
    App.state.newProductWithMapaPopup = { open: true, name: '', type: '', revenueModel: 'Venda única' };
    App.render();
  },
  closeNewProductWithMapaPopup() {
    App.state.newProductWithMapaPopup = null;
    App.render();
  },
  updateNewProductWithMapaField(field, value) {
    if (!App.state.newProductWithMapaPopup) return;
    App.state.newProductWithMapaPopup[field] = value;
  },
  confirmNewProductWithMapa() {
    const draft = App.state.newProductWithMapaPopup;
    if (!draft) return;
    const name = String(draft.name || '').trim();
    if (!name) return Utils.toast('Digite um nome pro produto.');
    // Cria o produto com defaults mínimos
    const product = ProductRevenueEngine.normalize({
      id: Date.now(),
      name,
      type: String(draft.type || '').trim(),
      price: '',
      revenueModel: draft.revenueModel || 'Venda única',
      operationalCost: ''
    });
    App.state.products.unshift(product);
    App.state.selectedProductId = product.id;
    App.state.campaignDraft.productId = product.id;
    App.state.newProductWithMapaPopup = null;
    App.save();
    Utils.toast(`Produto "${name}" criado. Vamos construir o Mapa da Receita.`);
    setTimeout(() => {
      Actions.openStrategicMap(product.id);
      // V31.2.16 — Welcome aparece (user pediu que pelo caminho "Criar Produto com
      // Mapa" o welcome também apareça). Etapa Visão fica como destino após dismiss.
      if (window.StrategicZoomNavigation) StrategicZoomNavigation.set('vision');
      App.save(); App.render();
    }, 80);
  },

  // V31.2.4 — Legado (chamava createProduct + openStrategicMap). Substituído pelo
  // popup acima em V31.2.5. Mantido pra compat com possíveis chamadas.
  createProductWithMapa() {
    Actions.openNewProductWithMapaPopup();
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
    // V32.2.0 — Sync rename pro ClickUp (mirror) se o nome mudou.
    const oldName = previous ? String(previous.name || '').trim() : '';
    if (oldName !== next.name && window.Actions?._syncRenameToClickup) {
      Actions._syncRenameToClickup('action', next.id, next.name);
    }
  },

  deleteActionFromEdit() {
    const draft = App.state.actionEditDraft;
    if (!draft) return;
    const deletedId = draft.id;
    App.state.actions = (App.state.actions || []).filter(a => Number(a.id) !== Number(draft.id));
    if (Number(App.state.selectedActionId) === Number(draft.id)) App.state.selectedActionId = null;
    App.state.showActionEditModal = false;
    App.state.actionEditDraft = null;
    App.save(); App.render();
    Utils.toast('Ação excluída.');
    // V32.2.5 (Geraldo A15) — Sync delete pro ClickUp.
    if (deletedId && this._syncDeleteToClickup) {
      this._syncDeleteToClickup('action', deletedId);
    }
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
    const oldName = String(current.name).trim();
    const newName = oldName; // current.name já foi atualizado por updateEditingProductField; este é o nome final salvo
    App.state.products[index] = ProductRevenueEngine.normalize({ ...current, name: newName }, index);
    App.state.selectedProductId = App.state.products[index].id;
    const productId = App.state.products[index].id;
    App.state.showProductEditModal = false;
    App.state.editProductId = null;
    App.save(); App.render(); Utils.toast('Produto atualizado.');
    // V32.2.0 — Sync rename pro ClickUp (mirror). Async, não-bloqueante.
    this._syncRenameToClickup('product', productId, newName);
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
    const newName = String(campaign.name).trim();
    App.state.campaigns[index] = { ...campaign, name: newName, objective: String(campaign.objective || '').trim(), owner: String(campaign.owner || '').trim(), sector: campaign.sector || 'Marketing', status: campaign.status || 'Ativa' };
    App.state.selectedCampaignId = App.state.campaigns[index].id;
    App.state.selectedProductId = Number(App.state.campaigns[index].productId);
    const campaignId = App.state.campaigns[index].id;
    App.state.showCampaignEditModal = false;
    App.state.editCampaignId = null;
    App.save(); App.render(); Utils.toast('Campanha atualizada.');
    // V32.2.0 — Sync rename pro ClickUp (mirror). Async, não-bloqueante.
    this._syncRenameToClickup('campaign', campaignId, newName);
  },

  // V32.2.0 — Helper interno: dispara rename mirror pro ClickUp.
  // Silent failure (sem toast erro) — sync best-effort. Loga warn no console.
  // Se ClickUp não conectado ou mirror desabilitado, backend retorna ok+skipped.
  async _syncRenameToClickup(ljKind, ljId, newName) {
    if (!ljId || !newName) return;
    const token = localStorage.getItem('lj_jwt');
    if (!token) return;
    try {
      const r = await fetch('/api/clickup-rename-mirror', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lj_kind: ljKind, lj_id: Number(ljId), new_name: newName })
      });
      const data = await r.json();
      if (!data.ok) {
        console.warn(`[clickup-mirror-rename] ${ljKind}#${ljId}: ${data.message}`);
      } else if (data.skipped) {
        // OK silencioso (ex: ClickUp não conectado)
      } else if (data.kind) {
        // Sucesso: ClickUp sincronizado
        if (window.Utils?.toast) Utils.toast(`✓ Sincronizado no ClickUp: ${data.name}`);
      }
    } catch (err) {
      console.warn('[clickup-mirror-rename] erro:', err.message);
    }
  },

  // V32.2.5 (Geraldo A15) — Helper interno: dispara DELETE mirror pro ClickUp.
  // Chamado quando user deleta produto/campanha/ação no LJ. Remove o
  // folder/list/task pai correspondente no ClickUp + mapping no DB.
  async _syncDeleteToClickup(ljKind, ljId) {
    if (!ljId) return;
    const token = localStorage.getItem('lj_jwt');
    if (!token) return;
    try {
      const r = await fetch('/api/clickup-delete-mirror', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ lj_kind: ljKind, lj_id: Number(ljId) })
      });
      const data = await r.json();
      if (!data.ok) {
        console.warn(`[clickup-mirror-delete] ${ljKind}#${ljId}: ${data.message}`);
      } else if (data.skipped) {
        // silent — ClickUp não conectado / mirror off / sem mapping
      } else if (data.kind) {
        if (window.Utils?.toast) Utils.toast(`✓ Removido do ClickUp: ${data.kind} ${data.clickupId}`);
      }
    } catch (err) {
      console.warn('[clickup-mirror-delete] erro:', err.message);
    }
  }
});
window.Actions = Actions;

// Database settings and connection patch.
Object.assign(Actions, {
  openSettingsModal() {
    App.state.showSettingsModal = true;
    // V32.4.0 (Geraldo Item 6) — default agora 'myAccount' (V11 'database' removida)
    App.state.settingsActiveSection = 'myAccount';
    App.save(); App.render();
  },
  closeSettingsModal() {
    App.state.showSettingsModal = false;
    App.save(); App.render();
  },
  // V32.4.0 (Geraldo Item 6) — Actions V11 database removidas:
  // selectDatabaseProvider, selectAmazonDatabaseType, updateDatabaseConfig,
  // testDatabaseConnection, toggleDatabaseTutorial.
  // Feature legacy de "escolher provider externo pra state" obsoleta após
  // V31+ multi-tenant. Snapshots agora vivem em journey_snapshots (DB tenant).

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

  // V26.2.0 — Substituído placeholder por integração real com Djow.
  // O botão "Gerar ações com IA" agora abre o modal Djow já contextualizado
  // com a campanha selecionada + o prompt do user + número de ações desejadas.
  // Djow extrai filtros/dados, usa create_action tool, e popula a campanha.
  async generateActionsViaAI() {
    const ai = App.state.actionAiDraft || { prompt: '', count: 3 };
    const prompt = String(ai.prompt || '').trim();
    const count = Math.max(1, Math.min(20, Number(ai.count || 3)));
    if (!prompt) return Utils.toast('Descreva o comando de geração antes.');
    const campaign = App.getSelectedCampaign();
    if (!campaign) return Utils.toast('Selecione uma campanha primeiro.');
    // Monta query estruturada pra Djow + abre modal + envia automaticamente
    const fullPrompt = `Crie ${count} ação(ões) para a campanha "${campaign.name}" (id=${campaign.id}). Descrição: ${prompt}\n\nUse a tool create_action pra cada ação. Defina campaignId=${campaign.id}, escolha channel/actionType/sector/funnel apropriados conforme a descrição.`;
    App.state.djowInput = fullPrompt;
    this.openDjowAIModal();
    // Pequeno delay pra modal montar
    setTimeout(() => this.sendDjowAIMessage(), 100);
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
  // V32.4.0 (Geraldo Item 6) — saveDatabaseConfig, chooseLocalDatabaseFolder,
  // writeLocalFolderSnapshot removidas (eram do _localPanel V11).
  // V32.4.0 (Geraldo Item 6) — readLocalFolderSnapshot + syncDatabaseNow removidas (eram do _localPanel V11).
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
    // V31.2.44 — Removido auto-/ (V31.2.42 quebrou caso RD app cadastrado SEM /).
    if (field === 'redirectUri' && typeof value === 'string') {
      value = value.trim();
    }
    App.state.integrations.rd[field] = value;
    // V22.3.6 — Quando o token CRM muda, força re-validação (crmTestStatus
    // volta a 'not_tested'). Sem isso o assistente acharia que a conexão
    // antiga ainda está válida com o novo token.
    if (field === 'crmPersonalToken' && prev !== value) {
      App.state.integrations.rd.crmTestStatus = 'not_tested';
      App.state.integrations.rd.crmTestAt = '';
    }
    App.save();
    // V31.2.36 — Write-through pro DB. Decide tipo pelo campo mutado.
    if (field === 'crmPersonalToken') this._persistRdToDb('crm_pat');
    else if (['accessToken', 'refreshToken', 'expiresAt', 'clientId', 'clientSecret', 'redirectUri', 'accountName', 'workspaceId', 'status'].includes(field)) this._persistRdToDb('marketing_oauth');
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
    this._persistRdToDb('crm_pat'); // V31.2.36 — write-through
    Utils.toast(result.message || 'Teste RD finalizado.');
  },

  clearRDConfig() {
    this.ensureIntegrations();
    App.state.integrations.rd = RDConfig.defaultConfig();
    App.save();
    App.render();
    this._deleteRdCredentialFromDb(); // V31.2.36 — apaga TODOS os 3 tipos do DB
    Utils.toast('Configuração RD limpa.');
  },

  // V23.0.0 — Logout: limpa JWT + user cache + reload (vai pra tela de login).
  // V31.2.3 — Fix vazamento entre contas no mesmo navegador:
  //   1. Flush push pendente PRIMEIRO (garante deleções/edits no DB antes de sair)
  //   2. Limpa state localStorage SEMPRE (antes só sandbox limpava → vazava
  //      pra próxima conta que logasse no mesmo browser)
  async logout() {
    if (!confirm('Deslogar do LeadJourney? Mudanças não salvas podem ser perdidas.')) return;
    // 1. Flush push pendente. Se master/production tinha edit pendente (ex: apagou
    // produto e logou em < 2s do debounce), garante que o DB recebe antes do logout.
    try {
      if (window.RemoteSyncAdapter?.flushNow) await RemoteSyncAdapter.flushNow();
    } catch (_) { /* segue mesmo se push falhar */ }
    // 2. Limpa state local de QUALQUER user (master, production, demo, sandbox).
    // DB é fonte da verdade; localStorage é só cache. Evita vazamento entre contas.
    try { StorageAdapter?.clear?.(); } catch (_) {}
    // 3. Limpa auth cache.
    localStorage.removeItem('lj_jwt');
    localStorage.removeItem('lj_user');
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

  // V32.0.16 — Execution credentials novo padrão (encrypted DB).
  async loadExecutionCredentials() {
    const token = localStorage.getItem('lj_jwt');
    if (!token) return;
    try {
      const res = await fetch('/api/execution-credentials', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.ok) {
        App.state._executionCredentialsCache = data.providers || [];
        App.save();
        App.render();
      }
    } catch (err) { console.warn('[loadExecutionCredentials]', err); }
  },

  updateTrelloConnectDraftField(field, value) {
    App.state.trelloConnectDraft = {
      ...(App.state.trelloConnectDraft || { apiKey: '', token: '', board: '', listTodo: '', listDone: '' }),
      [field]: String(value || '')
    };
  },

  async connectTrelloNew() {
    const draft = App.state.trelloConnectDraft || {};
    if (!draft.apiKey || !draft.token) {
      return Utils.toast('API Key e Token são obrigatórios pra conectar.');
    }
    if (!draft.listTodo) {
      return Utils.toast('Informe o List ID "To Do" — sem ele tasks não nascem em lugar nenhum.');
    }
    const token = localStorage.getItem('lj_jwt');
    if (!token) return Utils.toast('Sessão expirada — faça login.');
    try {
      const res = await fetch('/api/execution-connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          provider: 'trello',
          fields: {
            apiKey: draft.apiKey,
            token: draft.token,
            board: draft.board || null,
            listTodo: draft.listTodo,
            listDone: draft.listDone || null
          },
          meta: { board: draft.board || null }
        })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ ${data.message}`);
      App.state.trelloConnectDraft = { apiKey: '', token: '', board: '', listTodo: '', listDone: '' };
      await this.loadExecutionCredentials();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async disconnectTrelloNew() {
    if (!confirm('Desconectar Trello?\n\nO LJ vai parar de criar cards lá. Credenciais criptografadas serão apagadas do DB.')) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/execution-disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: 'trello' })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast('✓ Trello desconectado.');
      await this.loadExecutionCredentials();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.1.1 — "Meu Banco" self-service (qualquer user com tenant).
  updateTenantDbPlugDraft(value) {
    App.state.tenantDbPlugDraft = String(value || '');
  },

  async plugOwnTenantDb() {
    const url = String(App.state.tenantDbPlugDraft || '').trim();
    if (!url) {
      App.state.tenantDbPlugError = 'Cole a connection string primeiro.';
      App.render();
      return;
    }
    if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) {
      App.state.tenantDbPlugError = 'URL precisa começar com postgres:// ou postgresql://';
      App.render();
      return;
    }
    if (!confirm('Plugar este Postgres no seu tenant?\n\n• A conexão será testada\n• Se OK, o schema do LJ será criado automaticamente (não destrói dados existentes — apenas adiciona tabelas faltantes)\n• Próximas requests suas vão pro banco novo\n• Dados que estão hoje no armazenamento compartilhado NÃO migram automaticamente\n\nConfirma?')) return;

    const token = localStorage.getItem('lj_jwt');
    if (!token) return Utils.toast('Sessão expirada — faça login.');
    App.state.tenantDbPlugError = '';
    App.render();

    try {
      const res = await fetch('/api/tenant-plug-own-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ connection_string: url })
      });
      const data = await res.json();
      if (!data.ok) {
        App.state.tenantDbPlugError = `${data.step ? '[' + data.step + '] ' : ''}${data.message || 'Falha desconhecida.'}`;
        App.render();
        return;
      }
      Utils.toast(`✓ ${data.message}`);
      App.state.tenantDbPlugDraft = '';
      App.state.tenantDbPlugError = '';
      // Refresca info do user (auth-me) — agora tenantDbPlugged = true
      await this._refreshCurrentUserInfo?.();
      App.render();
    } catch (err) {
      App.state.tenantDbPlugError = `Erro: ${err.message}`;
      App.render();
    }
  },

  async unplugOwnTenantDb() {
    if (!confirm('Desplugar seu banco?\n\n⚠ ATENÇÃO: dados que você criou neste banco próprio FICAM lá (não são deletados, mas o LJ deixa de ler).\n\nVocê volta a operar no armazenamento compartilhado. Pra recuperar acesso aos dados antigos, basta plugar a mesma URL de novo.\n\nConfirma?')) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const res = await fetch('/api/tenant-unplug-own-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirm: true })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ ${data.message}`);
      await this._refreshCurrentUserInfo?.();
      App.render();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.1.2 — "Minha Conta": user edita o próprio display_name.
  updateProfileDisplayNameDraft(value) {
    App.state.profileDisplayNameDraft = String(value || '');
  },

  // V32.5.7 — Sub-abas em Configurações → Minha Conta:
  // 'identity' (perfil) e 'products' (gerenciamento de produtos).
  setMyAccountTab(tab) {
    App.state.myAccountTab = (tab === 'products') ? 'products' : 'identity';
    App.save(); App.render();
  },

  // V32.5.7 — Arquivar produto. Marca archived=true sem deletar nada.
  // Produto some das listas principais mas pode ser reativado em
  // Configurações → Minha Conta → Produtos.
  archiveProduct(productId) {
    if (this._demoGuard && this._demoGuard('Arquivar produto')) return;
    const pid = Number(productId);
    const product = (App.state.products || []).find(p => Number(p.id) === pid);
    if (!product) return Utils.toast('Produto não encontrado.');
    App.state.products = (App.state.products || []).map(p =>
      Number(p.id) === pid ? { ...p, archived: true, archivedAt: new Date().toISOString() } : p
    );
    // V32.5.7 — Se o produto selecionado virou arquivado, seleciona próximo ativo.
    if (Number(App.state.selectedProductId) === pid) {
      const nextActive = (App.state.products || []).find(p => !p.archived);
      App.state.selectedProductId = nextActive?.id || null;
    }
    App.save(); App.render();
    Utils.toast(`Produto "${product.name}" arquivado. Pode reativar em Minha Conta → Produtos.`);
  },

  // V32.5.7 — Reativa produto arquivado.
  unarchiveProduct(productId) {
    const pid = Number(productId);
    const product = (App.state.products || []).find(p => Number(p.id) === pid);
    if (!product) return Utils.toast('Produto não encontrado.');
    App.state.products = (App.state.products || []).map(p =>
      Number(p.id) === pid ? { ...p, archived: false, archivedAt: null } : p
    );
    App.save(); App.render();
    Utils.toast(`Produto "${product.name}" reativado.`);
  },

  // V32.5.7 — Helper invocado por botões "Deletar" em outras telas (e.g. modal
  // de edição do produto, engrenagem do card). Em vez de abrir flow inline,
  // navega o user pra Configurações → Minha Conta → Produtos com o flow de
  // delete pré-aberto pro produto solicitado.
  goToMyAccountProductsForDelete(productId) {
    App.state.showProductEditModal = false;
    App.state.showSettingsModal = true;
    App.state.settingsActiveSection = 'myAccount';
    App.state.myAccountTab = 'products';
    App.state.adminDeleteProductPending = { productId: Number(productId), typed: '' };
    App.save(); App.render();
  },

  async saveUserProfile() {
    const token = localStorage.getItem('lj_jwt');
    if (!token) return Utils.toast('Sessão expirada — faça login.');
    const displayName = String(App.state.profileDisplayNameDraft || '').trim();
    try {
      const res = await fetch('/api/user-update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ display_name: displayName })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ ${data.message}`);
      await this._refreshCurrentUserInfo();
      // Limpa draft pra próxima edição não confundir
      App.state.profileDisplayNameDraft = '';
      App.render();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.1.1 — Helper: re-fetch auth-me pra atualizar App.currentUser (tenantDbPlugged etc).
  async _refreshCurrentUserInfo() {
    const token = localStorage.getItem('lj_jwt');
    if (!token) return;
    try {
      const res = await fetch('/api/auth-me', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data?.ok && data?.user) {
        App.currentUser = data.user;
        localStorage.setItem('lj_user', JSON.stringify(data.user));
      }
    } catch (_) { /* silencioso */ }
  },

  // V32.0.12 — Tenants admin (master only).
  async loadTenantsList() {
    const token = localStorage.getItem('lj_jwt');
    if (!token) return Utils.toast('Sessão expirada — faça login de novo.');
    try {
      const res = await fetch('/api/tenants-list', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      App.state._tenantsListCache = data.tenants;
      App.save();
      App.render();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  updateTenantPlugDraft(tenantId, value) {
    App.state.tenantPlugDraft = App.state.tenantPlugDraft || {};
    App.state.tenantPlugDraft[String(tenantId)] = String(value || '');
    // Sem render — input em tempo real, é só store.
  },

  async plugTenantDb(tenantId) {
    const token = localStorage.getItem('lj_jwt');
    const draft = (App.state.tenantPlugDraft || {})[String(tenantId)];
    const connStr = String(draft || '').trim();
    if (!connStr) return Utils.toast('Cole a connection string primeiro.');
    if (!connStr.startsWith('postgres://') && !connStr.startsWith('postgresql://')) {
      return Utils.toast('Connection string precisa começar com postgres:// ou postgresql://');
    }
    if (!confirm(`Plugar este Postgres no tenant ${tenantId}?\n\nIMPORTANTE: rode lib/tenant-db-schema.sql contra esse DB ANTES, senão as tabelas vão estar vazias e endpoints vão dar erro.`)) return;
    try {
      const res = await fetch('/api/tenants-plug-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ tenant_id: tenantId, connection_string: connStr })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ ${data.message}`);
      delete App.state.tenantPlugDraft[String(tenantId)];
      await this.loadTenantsList();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async unplugTenantDb(tenantId) {
    const token = localStorage.getItem('lj_jwt');
    if (!confirm(`Desplugar o DB do tenant ${tenantId}?\n\nO tenant volta a operar no control plane. Dados que estavam no DB plugado FICAM ÓRFÃOS (não são deletados, mas LJ deixa de ler).\n\nConfirma?`)) return;
    try {
      const res = await fetch('/api/tenants-unplug-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ tenant_id: tenantId, confirm: true })
      });
      const data = await res.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ ${data.message}`);
      await this.loadTenantsList();
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

  // V24.0.0 — Copia a URL pública do webhook RD pro clipboard.
  // (mantido como utilitário fallback caso o cadastro automático falhe e
  // o usuário precise registrar manualmente via curl/Postman)
  async copyWebhookUrl() {
    const origin = window.location?.origin || 'https://leadjourney.up.railway.app';
    const url = `${origin}/api/rd-webhook`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        Utils.toast('URL copiada.');
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        Utils.toast('URL copiada (fallback).');
      }
    } catch (err) {
      Utils.toast(`Falhou ao copiar: ${err?.message || err}. URL: ${url}`);
    }
  },

  // V24.0.0 — OAuth do CRM (app separado do Marketing no Publisher RD).
  // Mesmo fluxo do Marketing OAuth, mas grava em integrations.rd.crmOauth.
  // Razão: RD Publisher força 1 produto por app (CRM OU Marketing). Para
  // /crm/v2/* (webhooks, etc.) precisa de app criado como "RD Station CRM".
  _ensureCrmOauth() {
    this.ensureIntegrations();
    App.state.integrations.rd.crmOauth = App.state.integrations.rd.crmOauth || (window.RDConfig ? RDConfig.defaultCrmOauth() : {});
    return App.state.integrations.rd.crmOauth;
  },

  updateRdCrmOauthField(field, value) {
    const cfg = this._ensureCrmOauth();
    // V31.2.44 — Removido auto-/ no redirectUri (V31.2.42 quebrou pra users que
    // cadastram callback SEM / no RD app). Agora mantém EXATAMENTE o que o user
    // digitou. RD exige match exato — responsabilidade do user copiar igual.
    if (field === 'redirectUri' && typeof value === 'string') {
      cfg[field] = value.trim();
    } else {
      cfg[field] = value;
    }
    App.save();
  },

  generateRdCrmOauthUrl() {
    const cfg = this._ensureCrmOauth();
    const result = RDAuthService.buildAuthorizationUrl(cfg);
    if (!result.ok) return Utils.toast(result.message);
    cfg.authUrl = result.url;
    cfg.status = 'ready_for_oauth';
    App.save();
    App.render();
    Utils.toast('URL OAuth do CRM gerada. Clique em "Abrir URL".');
  },

  openRdCrmOauthUrl() {
    const cfg = this._ensureCrmOauth();
    let url = cfg.authUrl;
    if (!url) {
      const result = RDAuthService.buildAuthorizationUrl(cfg);
      if (!result.ok) return Utils.toast(result.message);
      url = result.url;
      cfg.authUrl = url;
      App.save();
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  },

  async exchangeRdCrmOauthCode() {
    const cfg = this._ensureCrmOauth();
    if (!cfg.authorizationCode) return Utils.toast('Cole o Authorization Code antes.');
    Utils.toast('Trocando code por token CRM...');
    const result = await RDAuthService.exchangeAuthorizationCode(cfg);
    if (!result.ok) {
      cfg.status = 'exchange_failed';
      cfg.lastTestAt = new Date().toISOString();
      App.save();
      App.render();
      return Utils.toast(`Falha: ${result.message}`);
    }
    cfg.accessToken = result.accessToken;
    cfg.refreshToken = result.refreshToken || cfg.refreshToken;
    cfg.expiresAt = result.expiresAt || '';
    cfg.status = 'connected';
    cfg.lastTestAt = new Date().toISOString();
    cfg.authorizationCode = ''; // one-shot
    App.save();
    App.render();
    this._persistRdToDb('crm_oauth'); // V31.2.36 — write-through
    Utils.toast('✓ OAuth CRM conectado.');
  },

  async refreshRdCrmOauthToken() {
    const cfg = this._ensureCrmOauth();
    if (!cfg.refreshToken) return Utils.toast('Sem refresh_token CRM. Refaça o OAuth.');
    Utils.toast('Renovando token CRM...');
    const result = await RDAuthService.refreshAccessToken(cfg);
    if (!result.ok) {
      cfg.status = 'refresh_failed';
      App.save();
      App.render();
      return Utils.toast(`Falha: ${result.message}`);
    }
    cfg.accessToken = result.accessToken;
    cfg.refreshToken = result.refreshToken || cfg.refreshToken;
    cfg.expiresAt = result.expiresAt || '';
    cfg.status = 'connected';
    cfg.lastTestAt = new Date().toISOString();
    App.save();
    App.render();
    this._persistRdToDb('crm_oauth'); // V31.2.36 — write-through após refresh
    Utils.toast('✓ Token CRM renovado.');
  },

  clearRdCrmOauth() {
    if (!confirm('Limpar credenciais OAuth CRM? Você precisará refazer o fluxo.')) return;
    App.state.integrations.rd.crmOauth = window.RDConfig ? RDConfig.defaultCrmOauth() : {};
    App.save();
    App.render();
    this._deleteRdCredentialFromDb('crm_oauth'); // V31.2.36 — apaga só crm_oauth no DB
    Utils.toast('OAuth CRM resetado.');
  },

  // V24.0.0 — Eventos do Webhook Service multiproduto do RD.
  // Endpoint: POST /integrations/webhooks (NÃO /crm/v2/webhooks que era 401
  // por global_credentials). RD aceita UM webhook por event_type — a gente
  // cadastra todos e guarda UUIDs em App.state.rdWebhooks pra poder deletar.
  //
  // Lista oficial dos events (extraída dos docs RD em 2026-05-16):
  //   CRM:       crm_deal_created, crm_deal_updated, crm_deal_deleted
  //   Marketing: WEBHOOK.CONVERTED, WEBHOOK.MARKED_OPPORTUNITY
  //
  // V24.0.0 entrega só CRM. Marketing webhooks ficam pra V24.x quando
  // adicionar suporte aos identificadores de conversão.
  _RD_WEBHOOK_EVENTS: [
    'crm_deal_created',
    'crm_deal_updated',
    'crm_deal_deleted'
  ],

  _webhookUrl() {
    const origin = window.location?.origin || 'https://leadjourney.up.railway.app';
    return `${origin}/api/rd-webhook`;
  },

  // V24.0.0 — GET /integrations/webhooks pra listar o que já existe no RD.
  // Endpoint multiproduto do RD (NÃO /crm/v2/webhooks). Usado pra deduplicar
  // antes de cadastrar e não criar duplicata.
  async refreshRdWebhooks() {
    if (!window.RdCrmApiClient) return { ok: false, message: 'RdCrmApiClient indisponível.' };
    const res = await RdCrmApiClient.get('/integrations/webhooks', { legacy: false, useCrmOauthV2: true });
    if (!res.ok) {
      App.state.rdWebhookRegistrationError = `GET /webhooks falhou (${res.status}): ${res.message}`;
      App.save();
      App.render();
      return { ok: false, message: res.message };
    }
    // V31.2.50 — Loga estrutura do response pra debug (RD não documenta formato consistente).
    // V31.2.53 — Stringify inline pra user conseguir ler sem expandir (e me mandar print).
    console.log('[rd] GET /integrations/webhooks raw:', JSON.stringify(res.data).slice(0, 800));
    const list = res.data?.webhooks || res.data?.subscriptions || res.data?.data
      || (Array.isArray(res.data) ? res.data : null) || [];
    // V31.2.50 — Match de URL mais tolerante (case-insensitive + strip trailing slash).
    const targetUrl = String(this._webhookUrl() || '').toLowerCase().replace(/\/$/, '');
    const ours = (Array.isArray(list) ? list : []).filter(w => {
      const url = String(w.url || w.callback_url || '').toLowerCase().replace(/\/$/, '');
      return url === targetUrl;
    }).map(w => ({
      id: w.uuid || w.id || '',
      eventName: w.event_type || w.event_name || '',
      url: w.url || w.callback_url || '',
      createdAt: w.created_at || ''
    }));
    // V31.2.53 — Smart merge: preserva entries locais marcadas alreadyExistedAtRd
    // se RD não retornou. RD GET /integrations/webhooks às vezes retorna vazio
    // mesmo com webhooks cadastrados (provavelmente paginação ou scope errado),
    // e a sobrescrita destruía as entradas que o handler DUPLICATED_URL adicionou.
    const localOrphans = (App.state.rdWebhooks || []).filter(l =>
      l.alreadyExistedAtRd && !ours.some(r => r.eventName === l.eventName)
    );
    const merged = [...ours, ...localOrphans];
    console.log(`[rd] webhooks dedup: rdList=${Array.isArray(list) ? list.length : 0}, ours=${ours.length}, orphansPreservados=${localOrphans.length}, total=${merged.length}, alvo=${targetUrl}`);
    App.state.rdWebhooks = merged;
    App.state.rdWebhookRegistrationError = '';
    // V31.2.52 — Timestamp pra UI mostrar 'última verificação há X min'.
    App.state.rdWebhooksLastSyncAt = new Date().toISOString();
    App.save();
    App.render();
    return { ok: true, webhooks: merged };
  },

  // V24.0.0 — Cadastra UM webhook por event_name no RD via API v2.
  // Roteia via /api/rd-proxy (legacy=false → OAuth Bearer) usando o
  // accessToken do user. Se o OAuth não tem scope CRM, RD devolve 401/403.
  async registerRdWebhooks() {
    if (!window.RdCrmApiClient) { Utils.toast('RdCrmApiClient indisponível.'); return; }
    // V24.0.0 — Usa o OAuth do app CRM (não do Marketing). Marketing OAuth
    // não tem scope pra /crm/v2/*. Verificamos no app CRM, não no Marketing.
    const oauthCrm = App.state.integrations?.rd?.crmOauth?.accessToken || '';
    if (!oauthCrm) {
      Utils.toast('OAuth CRM não conectado. Conecte na aba "CRM OAuth" primeiro.');
      return;
    }
    Utils.toast('Cadastrando webhooks no RD...');
    // 1. Lista o que já existe (deduplica).
    await this.refreshRdWebhooks();
    const existing = new Set((App.state.rdWebhooks || []).map(w => w.eventName));
    const toCreate = this._RD_WEBHOOK_EVENTS.filter(ev => !existing.has(ev));
    if (!toCreate.length) {
      Utils.toast(`Todos os ${this._RD_WEBHOOK_EVENTS.length} webhooks já estão cadastrados no RD.`);
      return;
    }
    const url = this._webhookUrl();
    let created = 0;
    let failures = [];
    for (const eventType of toCreate) {
      // V24.0.0 — Body schema do endpoint /integrations/webhooks (multiproduto).
      // Sem wrapper "data". entity_type é obrigatório:
      //   - 'DEAL' para eventos crm_deal_* (crm_deal_created, crm_deal_updated, crm_deal_deleted)
      //   - 'CONTACT' para eventos WEBHOOK.* (Marketing, ex: WEBHOOK.CONVERTED)
      // V31.2.48 — Fix: estava hardcoded 'CONTACT' pra TODOS, daí RD recusava
      // crm_deal_* com HTTP 422 (entity_type incompatível com event_type).
      const entityType = eventType.startsWith('crm_deal') ? 'DEAL' : 'CONTACT';
      const body = {
        event_type: eventType,
        entity_type: entityType,
        url,
        http_method: 'POST'
      };
      const res = await RdCrmApiClient.post('/integrations/webhooks', body, { legacy: false, useCrmOauthV2: true });
      if (res.ok) {
        created += 1;
        const uuid = res.data?.uuid || res.data?.id || '';
        App.state.rdWebhooks = App.state.rdWebhooks || [];
        App.state.rdWebhooks.push({
          id: uuid,
          eventName: eventType,
          url,
          createdAt: res.data?.created_at || new Date().toISOString()
        });
      } else {
        // V31.2.50 — Se RD retornar DUPLICATED_URL, a subscription JÁ EXISTE
        // (cadastro anterior bem-sucedido). Trata como sucesso pra UI não
        // marcar como falha. UUID fica vazio nesse caso — refreshRdWebhooks
        // depois preenche se conseguir listar.
        const errorBlob = JSON.stringify(res.data || {});
        if (errorBlob.includes('DUPLICATED_URL')) {
          created += 1;
          App.state.rdWebhooks = App.state.rdWebhooks || [];
          if (!App.state.rdWebhooks.some(w => w.eventName === eventType)) {
            App.state.rdWebhooks.push({
              id: '', // UUID desconhecido — RD não retornou no erro
              eventName: eventType,
              url,
              createdAt: new Date().toISOString(),
              alreadyExistedAtRd: true
            });
          }
        } else {
          failures.push(`${eventType}: HTTP ${res.status} ${res.message}`);
        }
      }
    }
    if (failures.length && !created) {
      App.state.rdWebhookRegistrationError = failures[0];
    } else if (created) {
      App.state.rdWebhookRegistrationError = '';
    }
    App.save();
    App.render();
    // V31.2.51 — Hardening: após qualquer mutação (cadastro novo OU
    // detecção de duplicado), refaz refresh do RD pra capturar UUIDs reais
    // e garantir que state local = verdade no RD. Previne situação onde
    // user cadastra → state diz ok mas UUID vazio → não consegue deletar.
    try { await this.refreshRdWebhooks(); } catch (_) {}
    if (created) {
      Utils.toast(`${created} webhook(s) cadastrado(s) no RD. ${failures.length ? `${failures.length} falharam.` : ''}`);
    } else {
      Utils.toast(`Nenhum webhook cadastrado. Erro: ${failures[0] || 'desconhecido'}`);
    }
  },

  // V31.2.51 — Classifica erros do RD em códigos acionáveis. Usado pra mostrar
  // mensagens consistentes e decidir auto-recovery (token expirado → refresh,
  // duplicado → idempotência, etc).
  _classifyRdError(res) {
    if (!res) return { code: 'unknown', message: 'Sem resposta.' };
    if (res.ok) return { code: 'ok', message: '' };
    const status = res.status || 0;
    const blob = JSON.stringify(res.data || {}).toLowerCase() + ' ' + String(res.message || '').toLowerCase();
    if (blob.includes('duplicated_url') || blob.includes('already exists')) {
      return { code: 'already_exists', message: 'Recurso já existe no RD.', friendly: 'Já cadastrado — está no ar.' };
    }
    if (blob.includes('invalid_token') || blob.includes('invalid token') || status === 401) {
      return { code: 'token_invalid', message: 'Token RD inválido ou expirado.', friendly: 'OAuth precisa reconectar. Vai em Configurações → RD.' };
    }
    if (blob.includes('access_denied') || blob.includes('permission denied') || status === 403) {
      return { code: 'forbidden', message: 'Sem permissão (scope errado).', friendly: 'App OAuth foi criado como produto errado. Verifique se é "RD Station CRM" no Publisher.' };
    }
    if (status === 422) {
      return { code: 'validation', message: res.message || 'Validação falhou.', friendly: `Validação RD: ${res.message || 'detalhes no console'}` };
    }
    if (status === 429) {
      return { code: 'rate_limited', message: 'Rate limit RD.', friendly: 'Muitas chamadas. Espera 1 min e tenta de novo.' };
    }
    if (status >= 500) {
      return { code: 'server_error', message: `RD ${status}.`, friendly: 'RD com problema. Tenta novamente em alguns minutos.' };
    }
    return { code: 'unknown', message: res.message || `HTTP ${status}`, friendly: res.message || `Erro inesperado (${status}).` };
  },

  // V31.2.51 — Sync explícito de webhooks: pull do RD, compara com local,
  // reconcilia. Útil pra recuperar quando state local diverge da verdade
  // no RD (deleção manual no RD, mudança de domínio, etc).
  async syncRdWebhooksWithRd() {
    const refreshResult = await this.refreshRdWebhooks();
    if (!refreshResult.ok) {
      const c = this._classifyRdError({ ok: false, status: 0, message: refreshResult.message });
      Utils.toast(`Sync falhou: ${c.friendly}`);
      return { ok: false, message: refreshResult.message };
    }
    const localEvents = new Set((App.state.rdWebhooks || []).map(w => w.eventName));
    const expected = new Set(this._RD_WEBHOOK_EVENTS);
    const missing = [...expected].filter(ev => !localEvents.has(ev));
    if (missing.length) {
      Utils.toast(`${missing.length} webhook(s) faltando no RD. Re-cadastrando...`);
      await this.registerRdWebhooks();
    } else {
      Utils.toast(`✓ Sync OK — ${App.state.rdWebhooks.length} webhook(s) ativos no RD.`);
    }
    return { ok: true, missing };
  },

  // V24.1.0 — Mailing RD: criar segmentação no RD Marketing a partir de leads
  // filtrados no Buscador de Perfil. State em App.state.rdMailings + Modal
  // controlado por showRdMailingModal/rdMailingDraft.
  openRdMailingModal() {
    App.state.showRdMailingModal = true;
    App.state.rdMailingDraft = App.state.rdMailingDraft || { name: '', campaignId: '', targetStage: 'mkt_tof' };
    App.save();
    App.render();
  },

  closeRdMailingModal() {
    App.state.showRdMailingModal = false;
    App.save();
    App.render();
  },

  updateRdMailingDraft(field, value) {
    App.state.rdMailingDraft = App.state.rdMailingDraft || { name: '', campaignId: '', targetStage: 'mkt_tof' };
    App.state.rdMailingDraft[field] = value;
    App.save();
    App.render();
  },

  _slugifyMailingName(name) {
    return String(name || '').trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  },

  async confirmCreateRdMailing() {
    const draft = App.state.rdMailingDraft || {};
    const name = String(draft.name || '').trim();
    if (name.length < 3) return Utils.toast('Nome do mailing precisa de pelo menos 3 caracteres.');
    if (!draft.campaignId) return Utils.toast('Selecione a campanha vinculada.');
    if (!draft.targetStage) return Utils.toast('Selecione o estágio do funil.');
    if (!window.RdMarketingContactService?.hasOAuth?.()) {
      return Utils.toast('RD Marketing OAuth não conectado. Configure em Configurações → RD → aba Marketing.');
    }
    // Pega os leads filtrados atuais
    const filtered = LeadsModule._getDisplayedLeads ? LeadsModule._getDisplayedLeads() : [];
    if (!filtered.length) return Utils.toast('Nenhum lead filtrado pra enviar.');

    const slug = this._slugifyMailingName(name);
    const mailingTag = `lj_mailing_${slug}`;
    const targetTag = `target_${draft.targetStage}`;

    App.state.rdMailingSending = true;
    App.render();

    let pushed = 0;
    let failed = 0;
    const failures = [];
    const leadIds = [];

    try {
      for (const lead of filtered) {
        if (!lead?.email) { failed += 1; continue; }
        try {
          const r = await RdMarketingContactService.upsertContact({
            name: lead.name || lead.email,
            email: lead.email,
            phone: lead.phone || '',
            company: lead.company || '',
            tags: [mailingTag, targetTag]
          });
          if (r.ok) {
            pushed += 1;
            leadIds.push(lead.id || lead.email);
          } else {
            failed += 1;
            if (failures.length < 3) failures.push(r.message || 'falha');
          }
        } catch (err) {
          failed += 1;
          if (failures.length < 3) failures.push(err?.message || String(err));
        }
      }

      // Salva o mailing no state pra mapear conversões → campanha depois
      App.state.rdMailings = Array.isArray(App.state.rdMailings) ? App.state.rdMailings : [];
      const mailing = {
        id: `mailing_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name,
        slug,
        tag: mailingTag,
        targetStage: draft.targetStage,
        responseTag: `#convert_${draft.targetStage}`,
        campaignId: Number(draft.campaignId),
        leadCount: pushed,
        leadIds,
        createdAt: new Date().toISOString(),
        lastConversionAt: null
      };
      App.state.rdMailings.unshift(mailing);
      App.state.rdMailings = App.state.rdMailings.slice(0, 100);

      // V24.1.0 — Auto-registra webhook WEBHOOK.CONVERTED do RD Marketing
      // (só na primeira criação de mailing — depois fica ativo)
      try {
        await this._ensureMarketingConversionWebhook();
      } catch (_) {}

      App.state.showRdMailingModal = false;
      App.state.rdMailingDraft = { name: '', campaignId: '', targetStage: 'mkt_tof' };
    } finally {
      App.state.rdMailingSending = false;
      App.save();
      App.render();
    }

    if (pushed) {
      Utils.toast(`✓ Mailing "${name}" criado · ${pushed} contato(s) no RD${failed ? ` · ${failed} falha(s): ${failures[0] || ''}` : ''}`);
    } else {
      Utils.toast(`Falhou: ${failures[0] || 'nenhum contato pushado'}`);
    }
  },

  // V24.1.0 — Registra (idempotente) o webhook WEBHOOK.CONVERTED do Marketing
  // se ainda não estiver no App.state.rdWebhooks. Usa OAuth Marketing (não CRM).
  async _ensureMarketingConversionWebhook() {
    const existing = (App.state.rdWebhooks || []).find(w => w.eventName === 'WEBHOOK.CONVERTED');
    if (existing) return { ok: true, alreadyExists: true };
    const oauth = App.state.integrations?.rd?.accessToken || '';
    if (!oauth) return { ok: false, message: 'Marketing OAuth ausente.' };
    const url = this._webhookUrl();
    const body = {
      event_type: 'WEBHOOK.CONVERTED',
      entity_type: 'CONTACT',
      url,
      http_method: 'POST'
    };
    // Marketing webhook usa OAuth Marketing, não CRM → não passar useCrmOauthV2.
    const res = await RdCrmApiClient.post('/integrations/webhooks', body, { legacy: false });
    if (!res.ok) {
      App.state.rdWebhookRegistrationError = `WEBHOOK.CONVERTED: HTTP ${res.status} ${res.message}`;
      App.save();
      return { ok: false, message: res.message };
    }
    App.state.rdWebhooks = App.state.rdWebhooks || [];
    App.state.rdWebhooks.push({
      id: res.data?.uuid || res.data?.id || '',
      eventName: 'WEBHOOK.CONVERTED',
      url,
      createdAt: res.data?.created_at || new Date().toISOString()
    });
    App.save();
    return { ok: true };
  },

  // V26.0.0 — Djow AI: ações pra chat + config.
  //
  // State usado:
  //   App.state.djowConfig = { model, allowedRoles }
  //   App.state.djowStatus = (preenchido por loadDjowStatus())
  //   App.state.djowConversation = { id, messages: [{role, content, ts}] }
  //   App.state.djowOpen = boolean (modal Ctrl+K aberto)
  //   App.state.djowSending = boolean (loading state)
  //   App.state.djowInput = string (input atual no modal/home)

  async loadDjowStatus() {
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/djow-status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await r.json();
      if (data.ok) {
        App.state.djowStatus = data;
        App.save();
        App.render();
      }
    } catch (_) {}
  },

  updateDjowConfig(field, value) {
    App.state.djowConfig = App.state.djowConfig || { model: 'claude-sonnet-4-6', allowedRoles: ['master'] };
    App.state.djowConfig[field] = value;
    App.save();
    App.render();
  },

  updateDjowAllowedRoles(rolePreset) {
    App.state.djowConfig = App.state.djowConfig || { model: 'claude-sonnet-4-6', allowedRoles: ['master'] };
    if (rolePreset === 'master') App.state.djowConfig.allowedRoles = ['master'];
    else if (rolePreset === 'production') App.state.djowConfig.allowedRoles = ['master', 'production'];
    else if (rolePreset === 'all') App.state.djowConfig.allowedRoles = ['master', 'production', 'all'];
    App.save();
    App.render();
  },

  async testDjowConnection() {
    Utils.toast('Testando Djow...');
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/djow-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message: 'Diga "ok" pra confirmar que tá funcionando.' })
      });
      const data = await r.json();
      if (data.ok) {
        Utils.toast(`✓ Djow respondeu: "${(data.message || '').slice(0, 60)}..." · custo: $${data.usage?.costUsd || '0'}`);
        this.loadDjowStatus();
      } else {
        Utils.toast(`Falhou: ${data.message || 'erro desconhecido'}`);
      }
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V26.0.5 — Renomeadas pra djowAI* porque existiam funções legacy (V16.3
  // djowModal Railway agent) com os mesmos nomes mais abaixo no arquivo,
  // que sobrescreviam estas via ordem de declaração. Resultado: o toggle
  // do modal AI rodava a função legacy (que setava showDjowModal/djowDraftMessage,
  // não djowOpen), então o modal nunca aparecia.
  // V32.4.1 (Geraldo Item 1) — Aceita context opcional pra unificação:
  //   openDjowAIModal()                     → modo global (Ctrl+K)
  //   openDjowAIModal({ actionId: 42 })     → contexto de ação (substitui DjowModal V16.3)
  //   openDjowAIModal({ seedPrompt: '...' }) → pré-preenche o input
  openDjowAIModal(opts = {}) {
    App.state.djowOpen = true;
    App.state.djowContext = (opts && opts.actionId) ? { actionId: Number(opts.actionId) } : null;
    if (opts && opts.seedPrompt) {
      App.state.djowInput = String(opts.seedPrompt);
    }
    App.save();
    App.render();
    setTimeout(() => {
      const input = document.getElementById('djowInput');
      if (input) {
        input.focus();
        // Se tem seedPrompt, posiciona cursor no fim pra user continuar digitando
        if (opts.seedPrompt) input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 50);
  },

  closeDjowAIModal() {
    App.state.djowOpen = false;
    App.state.djowContext = null;
    App.save();
    App.render();
  },

  toggleDjowAIModal() {
    if (App.state.djowOpen) this.closeDjowAIModal();
    else this.openDjowAIModal();
  },

  updateDjowAIInput(value) {
    App.state.djowInput = value;
    // Não dá save+render aqui (cada keystroke recarregaria o modal e perderia foco)
  },

  async sendDjowAIMessage(event) {
    if (event && event.key && event.key !== 'Enter') return;
    if (event && event.shiftKey) return; // shift+enter = nova linha
    if (event && event.preventDefault) event.preventDefault();

    // V26.0.4 — Lê de QUALQUER input Djow (home ou modal). Antes só tentava o modal,
    // que falhava quando enviado pelo home (id diferente).
    const modalInput = document.getElementById('djowInput');
    const homeInput = document.getElementById('djowHomeInput');
    const message = (
      modalInput?.value ||
      homeInput?.value ||
      App.state.djowInput ||
      ''
    ).trim();
    if (!message) {
      Utils.toast('Digite uma pergunta primeiro.');
      return;
    }
    // V26.0.4 — Reset stuck state (caso uma chamada anterior tenha travado em fetch hang).
    // Se já tem 30s+ que djowSending=true, considera stuck e libera.
    if (App.state.djowSending) {
      const stuckSince = App.state._djowSendingStartedAt || 0;
      if (Date.now() - stuckSince < 30000) {
        Utils.toast('Já tem uma pergunta sendo processada. Aguarda.');
        return;
      }
      // 30s+ = liberar
      App.state.djowSending = false;
    }
    App.state._djowSendingStartedAt = Date.now();

    App.state.djowConversation = App.state.djowConversation || { id: null, messages: [] };
    App.state.djowConversation.messages.push({ role: 'user', content: message, ts: Date.now() });
    App.state.djowInput = '';
    // V26.0.4 — Limpa AMBOS inputs (home + modal) pra UX consistente.
    if (modalInput) modalInput.value = '';
    if (homeInput) homeInput.value = '';
    App.state.djowSending = true;
    App.render();

    try {
      const token = localStorage.getItem('lj_jwt');
      // V27.0.1 — Anexa flags de entrevista (uma vez só, consumidas aqui).
      // Backend usa pra augmentar system prompt; user não vê o prompt verboso.
      const reqBody = {
        message,
        conversationId: App.state.djowConversation.id
      };
      // V32.4.1 (Geraldo Item 1) — Quando modal aberto via contexto de ação
      // (substituindo DjowModal V16.3), anexa action_id no payload. Backend
      // + tool create_clickup_task já aceitam (V32.2.1+).
      if (App.state.djowContext?.actionId) {
        reqBody.actionId = App.state.djowContext.actionId;
      }
      if (App.state._djowInterviewStage) {
        reqBody.interviewStage = App.state._djowInterviewStage;
        reqBody.interviewProductName = App.state._djowInterviewProductName || '';
        reqBody.interviewProductId = App.state._djowInterviewProductId || null;
        // Limpa imediatamente — não queremos passar nas próximas mensagens
        App.state._djowInterviewStage = null;
        App.state._djowInterviewProductName = null;
        App.state._djowInterviewProductId = null;
      }
      const r = await fetch('/api/djow-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(reqBody)
      });
      const data = await r.json();
      App.state.djowSending = false;
      if (data.ok) {
        App.state.djowConversation.id = data.conversationId;
        App.state.djowConversation.messages.push({
          role: 'assistant',
          content: data.message,
          ts: Date.now(),
          usage: data.usage
        });
        // V29.1.2 — Djow chamou navigate_strategic_map: dispara abertura do Mapa.
        if (data.navTarget && data.navTarget.type === 'strategic-map') {
          const t = data.navTarget;
          setTimeout(() => {
            if (t.campaignId) Actions.openStrategicMapForCampaign(t.campaignId);
            else if (t.productId) Actions.openStrategicMap(t.productId);
          }, 100); // pequeno delay pra render do chat completar antes
        }
        // V26.2.0 — Se Djow criou entidades (state mutou no backend), puxa state
        // fresco do Postgres pro frontend ver os registros novos imediatamente.
        if (data.stateModified && window.App?._loadStateWithRemoteFallback) {
          try { await App._loadStateWithRemoteFallback(); } catch (_) {}
          if (Array.isArray(data.entitiesCreated) && data.entitiesCreated.length) {
            const names = data.entitiesCreated.map(e => {
              const t = e.kind === 'create_product' ? 'Produto' : e.kind === 'create_campaign' ? 'Campanha' : 'Ação';
              return `${t}: ${e.payload?.name || '?'}`;
            }).join(' · ');
            Utils.toast(`✓ Djow criou: ${names}`);
          }
        }
      } else {
        App.state.djowConversation.messages.push({
          role: 'assistant',
          content: `❌ Erro: ${data.message || 'falha desconhecida'}`,
          ts: Date.now(),
          isError: true
        });
      }
    } catch (err) {
      App.state.djowSending = false;
      App.state.djowConversation.messages.push({
        role: 'assistant',
        content: `❌ Erro de rede: ${err.message}`,
        ts: Date.now(),
        isError: true
      });
    }
    App.save();
    App.render();
    // Auto-scroll
    setTimeout(() => {
      const log = document.getElementById('djowMessages');
      if (log) log.scrollTop = log.scrollHeight;
    }, 50);
  },

  // V27.0.1 — Djow entrevista no Mapa da Receita.
  // User vê uma mensagem CURTA e amigável. O contexto verboso (instruções Doerr
  // pro Djow conduzir) vai via system prompt augmentation no backend, invisível
  // pro user. Antes (V27.0.0) o prompt verboso aparecia como "user message" no
  // chat — confundia visualmente.
  async djowInterviewStrategic(stage) {
    const productId = App.state.strategicMapProductId;
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    if (!product) return Utils.toast('Selecione um produto primeiro.');

    const friendly = {
      vision: `Djow, me ajuda a definir a Visão do produto "${product.name}" no Mapa da Receita.`,
      objectives: `Djow, me ajuda com os Objectives do produto "${product.name}" no Mapa da Receita.`,
      keyresults: `Djow, me ajuda com os Key Results do produto "${product.name}" no Mapa da Receita.`
    };

    App.state.djowInput = friendly[stage] || friendly.vision;
    App.state._djowInterviewStage = stage;
    App.state._djowInterviewProductName = product.name;
    App.state._djowInterviewProductId = product.id;
    // V27.0.2 — Flush state pro Postgres antes de chamar Djow.
    // Sem isso, se user acabou de digitar a Visão e clica "Djow me entrevista"
    // dentro dos 2s do debounce, Djow lê state velho do banco e responde
    // como se a Visão estivesse vazia (desperdiça créditos).
    Utils.toast('Sincronizando state…');
    if (window.RemoteSyncAdapter?.flushNow) {
      try { await RemoteSyncAdapter.flushNow(); } catch (_) {}
    }
    this.openDjowAIModal();
    setTimeout(() => this.sendDjowAIMessage(), 100);
  },

  // V26.1.0 — Buscador de Perfil com Djow: usa Claude pra parsear a query em
  // filtros estruturados, depois aplica via ProfileFinder (mesma lista de leads
  // globais já existente). Vc digita "mulheres jovens com alta intenção em SP"
  // e o Djow extrai sexo:feminino + idade_range:18-30 + local:sp + temperatura:quente.
  async djowSearchProfile() {
    const query = String(App.state.profileQuery || '').trim();
    if (!query) return Utils.toast('Digite uma query primeiro.');
    if (query.length > 500) return Utils.toast('Query muito longa (max 500 caracteres).');
    if (App.state._djowSearchRunning) return;
    App.state._djowSearchRunning = true;
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/djow-search-parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ query })
      });
      const data = await r.json();
      if (!data.ok) {
        Utils.toast(`Djow falhou: ${data.message || 'erro desconhecido'}`);
        return;
      }
      // Aplica os filtros como o parser local faria (ProfileFinder.applyFilters
      // consome esse formato direto).
      App.state.profileFilters = data.filters || [];
      App.state.profileActive = (data.filters || []).length > 0;
      const count = data.filters?.length || 0;
      Utils.toast(`Djow extraiu ${count} filtro(s) · veja em Leads Globais abaixo`);
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    } finally {
      App.state._djowSearchRunning = false;
      App.save();
      App.render();
    }
  },

  clearDjowAIConversation() {
    if (!confirm('Limpar a conversa atual? O histórico fica no banco mas some daqui.')) return;
    App.state.djowConversation = { id: null, messages: [] };
    App.save();
    App.render();
  },

  // V24.1.0 — Refresh manual de TODAS as fontes RD (substituiu auto-loops).
  // Dispara: CRM (pipelines/deals via PAT), Marketing (conversões via OAuth),
  // webhook buffer (eventos em tempo real). Status fica em App.state.rdLastSyncAt.
  // Mostra toast com contadores no fim.
  async refreshAllRdData(opts = {}) {
    const silent = Boolean(opts.silent);
    if (App.state.rdRefreshing) return;
    App.state.rdRefreshing = true;
    if (!silent) App.render();
    let crmOk = 0, marketingOk = 0, webhookOk = 0, lpEventsOk = 0;
    const errors = [];
    try {
      if (window.RdCrmLiveSyncEngine?.runOnce) {
        const r = await RdCrmLiveSyncEngine.runOnce(true);
        if (r?.ok) {
          crmOk = (r.upserted || 0) + (r.dealsApplied || 0);
          marketingOk = r.marketingUpserted || 0;
          webhookOk = r.webhookApplied || 0;
        } else if (r?.reason) {
          errors.push(`RD live: ${r.reason}`);
        }
      }
      if (window.EventCollector?.poll) {
        const r = await EventCollector.poll();
        if (r?.ok) lpEventsOk = r.applied || 0;
      }
    } catch (err) {
      errors.push(`Erro: ${err?.message || err}`);
    } finally {
      App.state.rdRefreshing = false;
      App.state.rdLastManualRefreshAt = new Date().toISOString();
      App.save();
      App.render();
    }
    if (!silent) {
      const parts = [];
      if (crmOk) parts.push(`${crmOk} CRM`);
      if (marketingOk) parts.push(`${marketingOk} Marketing`);
      if (webhookOk) parts.push(`${webhookOk} webhook`);
      if (lpEventsOk) parts.push(`${lpEventsOk} LP`);
      const summary = parts.length ? parts.join(' · ') : 'nada novo';
      Utils.toast(`RD atualizado · ${summary}${errors.length ? ' · ' + errors[0] : ''}`);
    }
  },

  // V24.1.0 — DELETE /integrations/webhooks/:uuid pra desativar um evento.
  async deleteRdWebhook(id) {
    if (!id) return;
    if (!confirm('Desativar este webhook no RD? O Journey vai parar de receber esse evento em tempo real (volta pro polling de 5min).')) return;
    const res = await RdCrmApiClient.del(`/integrations/webhooks/${encodeURIComponent(id)}`, { legacy: false, useCrmOauthV2: true });
    if (res.ok || res.status === 404) {
      App.state.rdWebhooks = (App.state.rdWebhooks || []).filter(w => w.id !== id);
      App.save();
      App.render();
      Utils.toast('Webhook desativado.');
    } else {
      Utils.toast(`Falha ao desativar: HTTP ${res.status} ${res.message}`);
    }
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
    this._persistRdToDb('marketing_oauth'); // V31.2.36 — write-through
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
    this._persistRdToDb('marketing_oauth'); // V31.2.36 — write-through após refresh
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
    // V24.1.0 — lazy refresh ao abrir a seção RD
    if (typeof this._maybeAutoRefreshRd === 'function') this._maybeAutoRefreshRd();
  }
});
window.Actions = Actions;


// V13.0.3 — Settings section navigation
// V24.1.0 — Quando o user entra na seção 'rd', dispara refresh automático
// 1x (lazy load). Evita rodar polling em background pra escala.
// Cache: só re-dispara se faz mais de 5min do último refresh.
Object.assign(Actions, {
  setSettingsSection(section) {
    App.state.settingsActiveSection = section;
    App.save();
    App.render();
    if (section === 'rd') this._maybeAutoRefreshRd();
  },
  _maybeAutoRefreshRd() {
    const last = App.state.rdLastManualRefreshAt;
    const ageMs = last ? Date.now() - new Date(last).getTime() : Infinity;
    const stale = ageMs > 5 * 60 * 1000;
    if (!stale) return;
    if (App.state.rdRefreshing) return;
    // Só refresca se houver pelo menos uma fonte configurada
    const rdCfg = App.state.integrations?.rd || {};
    const hasAny = Boolean(rdCfg.crmPersonalToken || rdCfg.accessToken || rdCfg.crmOauth?.accessToken);
    if (!hasAny) return;
    this.refreshAllRdData({ silent: true });
    // V31.2.51 — Hardening: também refresh os webhooks especificamente.
    // Detecta se state local diverge do RD (ex: user deletou no RD manualmente).
    if (rdCfg.crmOauth?.accessToken) {
      this.refreshRdWebhooks().catch(_ => {});
    }
  }
});
window.Actions = Actions;


// V32.4.0 (Geraldo Item 6) — Comentário antigo do stub V13.0.4 removido —
// referenciava actions database que foram aposentadas inteiras.


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

  // ─────────────────────────────────────────────────────────────
  // V32.8.1 — RevOps Whitelabel (Onda 2): actions do painel novo.
  // ─────────────────────────────────────────────────────────────

  // Helper interno: pega config V2 do produto, garante que existe (migra do
  // legacy se ainda não), aplica mutador, salva. Mutador recebe a config e
  // retorna a versão modificada (ou só muta in-place).
  _revopsV2Mutate(productId, mutator) {
    if (!productId) return;
    const pid = String(productId);
    if (!App.state.revopsFinanceV2) App.state.revopsFinanceV2 = {};
    let cfg = App.state.revopsFinanceV2[pid];
    if (!cfg) {
      const legacy = App.state.revopsFinance?.[pid];
      cfg = legacy ? RevopsWhitelabelEngine.migrateFromLegacy(legacy) : RevopsWhitelabelEngine.defaultConfig(pid);
      cfg.productId = pid;
    }
    const next = mutator(cfg) || cfg;
    App.state.revopsFinanceV2[pid] = next;
    App.save(); App.render();
  },

  setRevopsActiveProductId(productId) {
    App.state.revopsSelectedProductId = productId ? Number(productId) : null;
    App.save(); App.render();
  },

  setRevopsWhitelabelTab(tabId) {
    App.state.revopsWhitelabelActiveTab = String(tabId || 'costs');
    App.save(); App.render();
  },

  toggleRevopsClassicMode() {
    App.state.revopsClassicMode = !App.state.revopsClassicMode;
    App.save(); App.render();
  },

  // V32.8.2 — Toggle Modo Builder (A) ↔ Modo Excel (B) na tab Custos.
  setRevopsExcelMode(on) {
    App.state.revopsExcelMode = !!on;
    App.save(); App.render();
  },

  // V32.8.3 — Pede análise contextual do Djow pra uma tab do RevOps Whitelabel.
  // One-shot: backend chama Claude Haiku c/ resumo enxuto, retorna 3-5 frases.
  // Cache em App.state.revopsDjowSuggestions[tabId] — cliente clica explicit
  // pra refrescar (evita custo de tokens automático).
  async askRevopsDjow(productId, tabId) {
    if (!productId || !tabId) return;
    const pid = String(productId);
    const cfg = App.state.revopsFinanceV2?.[pid];
    if (!cfg) return Utils.toast('Configure o RevOps deste produto primeiro.');
    const ev = window.RevopsWhitelabelEngine?.evaluate(cfg);
    if (!ev) return Utils.toast('Engine RevOps não carregada.');

    // Set loading
    App.state.revopsDjowSuggestions = {
      ...(App.state.revopsDjowSuggestions || {}),
      [tabId]: { loading: true, suggestion: null, askedAt: null, error: null }
    };
    App.render();

    // Monta resumo compacto pro Claude (limita tokens trafegados)
    const product = (App.state.products || []).find(p => Number(p.id) === Number(pid));
    const lines = [];
    lines.push(`Produto: ${product?.name || pid} (período: ${cfg.period})`);
    lines.push(`Vendas previstas: ${ev.sales} · Ticket: R$${ev.ticket.toFixed(2)}`);
    lines.push(`Fat Bruto: R$${ev.fatBruto.toFixed(0)} · Fat Líquido: R$${ev.fatLiquido.toFixed(0)} · EBITDA: R$${ev.ebitda.toFixed(0)} (${ev.ebitdaMargin.toFixed(1)}%)`);
    lines.push(`Totais: G&A R$${ev.fixedTotal.toFixed(0)} · Aquisição R$${ev.acquisitionTotal.toFixed(0)} · Variáveis R$${ev.variableTotal.toFixed(0)}`);
    lines.push('');
    lines.push('GRUPOS DE CUSTOS:');
    (cfg.groups || []).forEach(g => {
      const t = ev.groupTotals[g.id] || 0;
      lines.push(`- [${g.bucket}] ${g.label} (total R$${t.toFixed(0)}):`);
      (g.items || []).forEach(it => {
        const v = ev.itemValues[it.id] || 0;
        const calcDesc = it.calc?.mode === 'fixed' ? `R$${it.calc.value || 0}`
                       : it.calc?.mode === 'percent_of' ? `${it.calc.factor}% de ${it.calc.base}`
                       : it.calc?.mode === 'percent_self' ? `${it.calc.factor}% de R$${it.calc.baseValue}`
                       : it.calc?.mode === 'derived' ? `total de ${it.calc.groupRef}`
                       : it.calc?.mode === 'custom_formula' ? `fórmula: ${it.calc.formula}`
                       : '?';
        lines.push(`  • ${it.name} = ${calcDesc} → R$${v.toFixed(0)}`);
      });
    });
    lines.push('');
    lines.push('OFERTAS:');
    (cfg.offers || []).forEach(o => {
      lines.push(`- ${o.name}: R$${o.price} (mix ${o.mix}%${o.selectedForTicket ? ', conta no TM' : ''})`);
    });
    if ((cfg.customKpis || []).length) {
      lines.push('');
      lines.push('KPIs CUSTOM:');
      (cfg.customKpis || []).forEach(k => {
        const v = ev.customKpiValues?.[k.id] || 0;
        lines.push(`- ${k.name}: ${k.formula} → ${v.toFixed(2)} ${k.unit}`);
      });
    }
    const summary = lines.join('\n');

    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/djow-revops-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ product_id: pid, tab_id: tabId, summary })
      });
      const data = await r.json();
      if (!data.ok) {
        App.state.revopsDjowSuggestions[tabId] = { loading: false, suggestion: null, askedAt: null, error: data.message || 'Erro Djow' };
        App.render();
        return;
      }
      App.state.revopsDjowSuggestions[tabId] = {
        loading: false,
        suggestion: data.suggestion,
        askedAt: new Date().toISOString(),
        error: null
      };
      App.save(); App.render();
    } catch (err) {
      App.state.revopsDjowSuggestions[tabId] = { loading: false, suggestion: null, askedAt: null, error: err.message };
      App.render();
    }
  },

  clearRevopsDjowSuggestion(tabId) {
    if (!App.state.revopsDjowSuggestions) return;
    delete App.state.revopsDjowSuggestions[tabId];
    App.save(); App.render();
  },

  // V32.8.4 — Simulator inline. Toggle on/off + overrides voláteis pra cliente
  // testar "e se vendas fossem +20%? E se ticket fosse R$X?". Sem persistir
  // no cfg (não polui o real). Δ vs baseline mostrado nos cards de Resultado.
  toggleRevopsSimulator() {
    if (!App.state.revopsSimulator) App.state.revopsSimulator = { salesOverride: null, ticketOverride: null, active: false };
    App.state.revopsSimulator.active = !App.state.revopsSimulator.active;
    if (!App.state.revopsSimulator.active) {
      // Limpa overrides ao desligar
      App.state.revopsSimulator.salesOverride = null;
      App.state.revopsSimulator.ticketOverride = null;
    }
    App.save(); App.render();
  },

  setRevopsSimulatorOverride(field, value) {
    if (!App.state.revopsSimulator) App.state.revopsSimulator = { salesOverride: null, ticketOverride: null, active: false };
    const numeric = value === '' || value == null ? null : Number(value);
    if (field === 'salesOverride' || field === 'ticketOverride') {
      App.state.revopsSimulator[field] = Number.isFinite(numeric) ? numeric : null;
    }
    App.save(); App.render();
  },

  resetRevopsSimulator() {
    App.state.revopsSimulator = { salesOverride: null, ticketOverride: null, active: false };
    App.save(); App.render();
  },

  // V32.8.5 — Salva os overrides atuais do simulator como cenário nomeado.
  // Cenário é puro snapshot: sales/ticket overrides + nome + timestamp.
  // Custos do cfg NÃO entram (cliente preserva como referência viva).
  saveRevopsScenario(productId, name) {
    if (!productId) return Utils.toast('Sem produto ativo.');
    const sim = App.state.revopsSimulator;
    if (!sim || !sim.active) return Utils.toast('Ative o Simulador antes de salvar cenário.');
    const cleanName = String(name || '').trim();
    if (!cleanName) return Utils.toast('Dê um nome pro cenário.');
    const pid = String(productId);
    if (!App.state.revopsScenarios) App.state.revopsScenarios = {};
    if (!App.state.revopsScenarios[pid]) App.state.revopsScenarios[pid] = [];
    App.state.revopsScenarios[pid].push({
      id: `sc_${Date.now().toString(36)}`,
      name: cleanName.slice(0, 64),
      salesOverride: sim.salesOverride,
      ticketOverride: sim.ticketOverride,
      savedAt: new Date().toISOString()
    });
    App.save(); App.render();
    Utils.toast(`✓ Cenário "${cleanName}" salvo.`);
  },

  loadRevopsScenario(productId, scenarioId) {
    const pid = String(productId);
    const sc = (App.state.revopsScenarios?.[pid] || []).find(s => s.id === scenarioId);
    if (!sc) return;
    App.state.revopsSimulator = {
      active: true,
      salesOverride: sc.salesOverride,
      ticketOverride: sc.ticketOverride
    };
    App.save(); App.render();
    Utils.toast(`Cenário "${sc.name}" carregado no Simulador.`);
  },

  deleteRevopsScenario(productId, scenarioId) {
    const pid = String(productId);
    if (!App.state.revopsScenarios?.[pid]) return;
    App.state.revopsScenarios[pid] = App.state.revopsScenarios[pid].filter(s => s.id !== scenarioId);
    // Limpa seleção se cenário deletado estava sendo comparado
    const sel = App.state.revopsCompareSelection || {};
    if (sel.left === scenarioId) sel.left = null;
    if (sel.right === scenarioId) sel.right = null;
    App.state.revopsCompareSelection = sel;
    App.save(); App.render();
  },

  setRevopsCompareSlot(slot, scenarioId) {
    if (!App.state.revopsCompareSelection) App.state.revopsCompareSelection = { left: null, right: null };
    if (slot === 'left' || slot === 'right') {
      App.state.revopsCompareSelection[slot] = scenarioId || null;
    }
    App.save(); App.render();
  },

  clearRevopsCompare() {
    App.state.revopsCompareSelection = { left: null, right: null };
    App.save(); App.render();
  },

  // V32.8.2 — Save direto de fórmula via Modo Excel. Vira custom_formula.
  // Se a fórmula puder ser reduzida pra um modo Builder mais simples (ex:
  // só um número), simplifica de volta — preserva A/B sync transparente.
  saveRevopsExcelFormula(productId, groupId, itemId, formula) {
    Actions._revopsV2Mutate(productId, cfg => {
      const g = (cfg.groups || []).find(x => x.id === groupId);
      const it = g?.items?.find(i => i.id === itemId);
      if (!it) return;
      const raw = String(formula || '').trim().replace(/^=/, '').trim();
      // Reduz pra fixed se for puramente numérico (ex: "=115.29")
      const asNum = Number(raw.replace(',', '.'));
      if (Number.isFinite(asNum) && /^-?[0-9.]+$/.test(raw.replace(/\s/g, ''))) {
        it.calc = { mode: 'fixed', value: asNum };
      } else {
        it.calc = { mode: 'custom_formula', formula: `=${raw}` };
      }
    });
  },

  setRevopsWhitelabelPeriod(productId, period) {
    Actions._revopsV2Mutate(productId, cfg => {
      cfg.period = ['monthly', 'quarterly', 'yearly'].includes(period) ? period : 'monthly';
    });
  },

  setRevopsSalesProjection(productId, value) {
    Actions._revopsV2Mutate(productId, cfg => {
      cfg.salesProjection = Number(value) || 0;
    });
  },

  // GRUPOS
  addRevopsGroup(productId, bucket) {
    Actions._revopsV2Mutate(productId, cfg => {
      const labels = { fixed: 'Novo grupo fixo', acquisition: 'Nova origem de aquisição', variable: 'Novo custo variável', custom: 'Novo grupo custom' };
      const g = RevopsWhitelabelEngine.emptyGroup(labels[bucket] || 'Novo grupo', bucket);
      cfg.groups = [...(cfg.groups || []), g];
    });
  },

  renameRevopsGroup(productId, groupId, newLabel) {
    Actions._revopsV2Mutate(productId, cfg => {
      const g = (cfg.groups || []).find(x => x.id === groupId);
      if (g) g.label = String(newLabel || g.label).trim();
    });
  },

  deleteRevopsGroup(productId, groupId) {
    Actions._revopsV2Mutate(productId, cfg => {
      cfg.groups = (cfg.groups || []).filter(g => g.id !== groupId);
    });
  },

  // ITEMS
  addRevopsItem(productId, groupId) {
    Actions._revopsV2Mutate(productId, cfg => {
      const g = (cfg.groups || []).find(x => x.id === groupId);
      if (g) g.items = [...(g.items || []), RevopsWhitelabelEngine.emptyItem('Novo item')];
    });
  },

  renameRevopsItem(productId, groupId, itemId, newName) {
    Actions._revopsV2Mutate(productId, cfg => {
      const g = (cfg.groups || []).find(x => x.id === groupId);
      const it = g?.items?.find(i => i.id === itemId);
      if (it) it.name = String(newName || it.name).trim();
    });
  },

  deleteRevopsItem(productId, groupId, itemId) {
    Actions._revopsV2Mutate(productId, cfg => {
      const g = (cfg.groups || []).find(x => x.id === groupId);
      if (g) g.items = (g.items || []).filter(i => i.id !== itemId);
    });
  },

  changeRevopsItemMode(productId, groupId, itemId, mode) {
    Actions._revopsV2Mutate(productId, cfg => {
      const g = (cfg.groups || []).find(x => x.id === groupId);
      const it = g?.items?.find(i => i.id === itemId);
      if (it) it.calc = RevopsWhitelabelEngine.emptyCalc(mode);
    });
  },

  updateRevopsItemCalc(productId, groupId, itemId, field, value) {
    Actions._revopsV2Mutate(productId, cfg => {
      const g = (cfg.groups || []).find(x => x.id === groupId);
      const it = g?.items?.find(i => i.id === itemId);
      if (!it || !it.calc) return;
      // Numéricos: coerce. Strings (base, groupRef, formula): direto.
      const numericFields = ['value', 'factor', 'baseValue'];
      it.calc[field] = numericFields.includes(field) ? (Number(value) || 0) : String(value || '');
    });
  },

  // OFFERS
  addRevopsOffer(productId) {
    Actions._revopsV2Mutate(productId, cfg => {
      const o = { id: `offer_${Date.now().toString(36).slice(-4)}`, name: 'Nova oferta', price: 0, mix: 0, selectedForTicket: true };
      cfg.offers = [...(cfg.offers || []), o];
    });
  },

  renameRevopsOffer(productId, offerId, name) {
    Actions._revopsV2Mutate(productId, cfg => {
      const o = (cfg.offers || []).find(x => x.id === offerId);
      if (o) o.name = String(name || o.name).trim();
    });
  },

  updateRevopsOfferField(productId, offerId, field, value) {
    Actions._revopsV2Mutate(productId, cfg => {
      const o = (cfg.offers || []).find(x => x.id === offerId);
      if (o) o[field] = Number(value) || 0;
    });
  },

  toggleRevopsOfferTicket(productId, offerId) {
    Actions._revopsV2Mutate(productId, cfg => {
      const o = (cfg.offers || []).find(x => x.id === offerId);
      if (o) o.selectedForTicket = !o.selectedForTicket;
    });
  },

  deleteRevopsOffer(productId, offerId) {
    Actions._revopsV2Mutate(productId, cfg => {
      cfg.offers = (cfg.offers || []).filter(o => o.id !== offerId);
    });
  },

  setRevopsTicketMode(productId, mode) {
    Actions._revopsV2Mutate(productId, cfg => {
      cfg.ticketMode = mode === 'manual' ? 'manual' : 'weighted';
    });
  },

  setRevopsTicketManual(productId, value) {
    Actions._revopsV2Mutate(productId, cfg => {
      cfg.ticketManualValue = Number(value) || 0;
    });
  },

  // CUSTOM KPIs
  addRevopsCustomKpi(productId) {
    Actions._revopsV2Mutate(productId, cfg => {
      cfg.customKpis = [...(cfg.customKpis || []), {
        id: `kpi_${Date.now().toString(36).slice(-4)}`,
        name: 'Novo KPI',
        formula: '=0',
        unit: 'BRL'
      }];
    });
  },

  updateRevopsCustomKpi(productId, kpiId, field, value) {
    Actions._revopsV2Mutate(productId, cfg => {
      const k = (cfg.customKpis || []).find(x => x.id === kpiId);
      if (k) k[field] = String(value || '');
    });
  },

  deleteRevopsCustomKpi(productId, kpiId) {
    Actions._revopsV2Mutate(productId, cfg => {
      cfg.customKpis = (cfg.customKpis || []).filter(k => k.id !== kpiId);
    });
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

  // V32.4.1 (Geraldo Item 1) — Actions DjowModal V16.3 removidas:
  //   openDjowModal, closeDjowModal, updateDjowDraft, sendDjowMessage
  // Substituídas por openDjowAIModal({ actionId }) — DjowAIModal V26+ com
  // Claude + tools (create_clickup_task com cache Redis V32.3.4) faz o
  // mesmo, melhor. Botões em tasksModal.js + actions.js atualizados.

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

  // V32.3.0 (Geraldo Novo-1) — Async pra await provider.deleteTask antes do
  // render (evita race do user clicar de novo). ClickUp subtask delete vai
  // junto — não fica órfã no ClickUp do cliente.
  async removeExecutionTask(taskId) {
    if (!window.ExecutionTaskEngine) return;
    await ExecutionTaskEngine.removeTask(taskId);
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

// V32.4.0 (Geraldo Item 6) — Bloco V16.4 Railway Database removido inteiro:
// setRailwayMode, toggleRailwayPassword, parseRailwayDatabaseUrl,
// composeRailwayDatabaseUrl, testRailwayConnection, generateDatabaseSnapshot,
// openRailwaySnapshotPrompt, cancelRailwaySnapshotPrompt, confirmRailwayAsPrimary.
// Eram callers dos panels _railwayPanel + _railwaySnapshotPrompt (também removidos).

// V17 — Revenue Strategic Map
Object.assign(Actions, {
  // V29.0.0 — Abre Mapa em vista PRODUTO (CEO mode): Visão + KRs-mãe + lista de branches.
  openStrategicMap(productId) {
    if (!productId) return Utils.toast('Selecione um produto.');
    // V31.0.5 — Demo abria direto na primeira branch pra ver etapas 4-6 com conteúdo.
    // V31.1.1 — Aplicado a TODOS users: se produto tem branches, abre na primeira
    // (sem CEO/Gestor distinction = "criar livre"). Se não tem branches, abre em
    // mode='product' (estado inicial) — etapa 4 hub vai oferecer criar campanha.
    const branchesForRedirect = window.StrategicMapEngine?.getBranchesByProduct
      ? StrategicMapEngine.getBranchesByProduct(Number(productId))
      : [];
    if (branchesForRedirect.length) {
      return Actions.openStrategicMapForCampaign(branchesForRedirect[0].campaignId);
    }
    App.state.strategicMapProductId = Number(productId);
    App.state.strategicMapCampaignId = null;        // V29 — vista produto, não campanha
    App.state.strategicMapMode = 'product';         // V29 — 'product' | 'campaign'
    App.state.showStrategicMap = true;
    App.state.strategicMapZoom = 'vision'; // V29.1.0 — CEO comeca pelo Objetivo (etapa 1)
    App.state.strategicSkipOnboarding = false; // V31.2.0 — welcome screen sempre aparece
    App.state.strategicObjectiveDraft = null;
    App.state.strategicOkrDraft = null;
    App.state.strategicActiveArea = null;
    App.state.strategicCampaignPrompt = null;
    if (window.StrategicMapEngine) {
      StrategicMapEngine.ensure(Number(productId));
      if (typeof StrategicMapEngine.migrateLegacyStrategicCampaigns === 'function') {
        const mergedCount = StrategicMapEngine.migrateLegacyStrategicCampaigns(Number(productId));
        if (mergedCount > 0) Utils.toast(`Encontradas ${mergedCount} campanha(s) duplicada(s) — mescladas.`);
      }
      if (typeof StrategicMapEngine.migrateLegacyStrategicActions === 'function') {
        const fixedCount = StrategicMapEngine.migrateLegacyStrategicActions(Number(productId));
        if (fixedCount > 0) Utils.toast(`${fixedCount} ação(ões) tiveram setor/funil corrigidos.`);
      }
      // V29.2.3 — garante campos compat (leads, okrs, flowPath) em ações estratégicas
      // antigas pra não quebrar ActionModule.card.
      if (typeof StrategicMapEngine.migrateStrategicActionsCompatFields === 'function') {
        StrategicMapEngine.migrateStrategicActionsCompatFields(Number(productId));
      }
      // V29 — Lazy migration: se há strategicCampaignId e ainda há legacy objectives,
      // move pra branch automaticamente.
      const map = StrategicMapEngine.getForProduct(productId);
      if (map?.strategicCampaignId && (map.objectives || []).length > 0) {
        StrategicMapEngine._lazyMigrateLegacyToBranch(productId, map.strategicCampaignId);
        Utils.toast('Mapa migrado pro novo modelo (branches por campanha).');
      }
    }
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
    // V31.2.0 — Agora SÓ pula welcome dessa sessão de visualização (não persiste).
    // Mantém StrategicOnboarding.markSeen pra compat com chamadas legacy.
    const productId = App.state.strategicMapProductId;
    if (productId && window.StrategicOnboarding) StrategicOnboarding.markSeen(productId);
    App.state.strategicSkipOnboarding = true;
    // Garante que entra na etapa Vision (semântica "Começar pela Visão")
    if (window.StrategicZoomNavigation) StrategicZoomNavigation.set('vision');
    App.save(); App.render();
  },

  // V31.2.0 — "Já configurou?" → pula welcome sem resetar etapa atual.
  skipStrategicOnboarding() {
    App.state.strategicSkipOnboarding = true;
    App.save(); App.render();
  },

  openStrategicOnboarding() {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicOnboarding) return;
    StrategicOnboarding.reset(productId);
    App.state.strategicSkipOnboarding = false; // re-mostra welcome
    App.save(); App.render();
  },

  setStrategicZoom(level) {
    if (!window.StrategicZoomNavigation) return;
    StrategicZoomNavigation.set(level);
    App.save(); App.render();
    // V31.1.1 — Reseta scroll do container do Mapa pra topo ao trocar etapa.
    // Junto com o stepper sticky, garante que o user vê a etapa do início.
    setTimeout(() => {
      const c = document.getElementById('strategicMapScrollContainer');
      if (c) c.scrollTop = 0;
    }, 30);
  },

  advanceStrategicStep() {
    if (!window.StrategicZoomNavigation) return;
    if (StrategicZoomNavigation.isLast()) return;
    // V32.5.2 (Leonardo) — Hand-off de transição: Djow lateral celebra a
    // saída da etapa + anuncia a chegada na próxima. Reduz a "sala silenciosa"
    // que cliente sentia antes (cada etapa abria sozinha, sem rastro).
    const current = StrategicZoomNavigation.current();
    const next = StrategicZoomNavigation.next();
    if (window.DjowStrategicAssistant && App.state.strategicMapProductId) {
      const handoffMessages = {
        vision:     '✓ Objetivo cravado. Agora vamos atribuir os donos das 3 frentes comerciais.',
        objectives: '✓ Donos definidos. Hora de definir os números que cada frente precisa entregar.',
        okrs:       '✓ Números prontos. Escolha em qual campanha vai trabalhar agora.',
        campaign:   '✓ Campanha selecionada. Pluge os números aqui e ative as ações que vão cobrir.',
        operations: '✓ Ações ativadas. Pronto pra colocar em campo — vamos disparar as tarefas.'
      };
      const text = handoffMessages[current];
      if (text) {
        DjowStrategicAssistant.append(App.state.strategicMapProductId, {
          role: 'transition',
          text,
          thermal: next.thermal || 'indigo',
          ts: new Date().toISOString()
        });
      }
    }
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

  // V30.0.0 — Agora abre o CreateClickupTaskModal (Caminho híbrido C) ao invés de
  // mandar tudo via chat Djow. Pré-preenche título/descrição com contexto do OKR;
  // user pode refinar via botão "Falar com Djow" no próprio modal.
  createTaskFromOkr(productId, objectiveId, okrId, actionId) {
    const map = window.StrategicMapEngine ? StrategicMapEngine.getForProduct(productId) : null;
    const obj = map?.objectives?.find(o => o.id === objectiveId);
    const kr = obj?.okrs?.find(k => k.id === okrId);
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!kr || !action) return Utils.toast('OKR ou ação não encontrada.');
    const suggestedName = `[${kr.name}] ${action.name}`;
    const descLines = [
      `OKR: ${kr.name}`,
      `Objetivo: ${obj.label}`,
      `Meta: ${kr.target} ${kr.metric} (atual: ${kr.current || 0})`,
      kr.deadline ? `Prazo do OKR: ${kr.deadline}` : null,
      `Ação operacional: ${action.name}`,
      kr.owner ? `Responsável sugerido: ${kr.owner}` : null
    ].filter(Boolean).join('\n');
    App.state.showStrategicMap = false;
    Actions.openCreateClickupTaskModal({
      summary: `OKR "${kr.name}" · Ação "${action.name}"`,
      productId, objectiveId, okrId, actionId: Number(actionId),
      suggestedName,
      suggestedDescription: descLines,
      suggestedDueDate: kr.deadline || ''
    });
  },

  updateStrategicVision(value) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicMapEngine) return;
    // V32.4.4 — Re-render só na transição vazio↔preenchido pra habilitar o
    // botão "Próximo passo" sem perder foco do textarea durante typing normal.
    const wasFilled = Boolean(String(StrategicMapEngine.getForProduct(productId).vision || '').trim());
    StrategicMapEngine.setVision(productId, value);
    App.save();
    const isFilled = Boolean(String(value || '').trim());
    if (wasFilled !== isFilled) App.render();
  },

  startStrategicObjectiveDraft() {
    App.state.strategicObjectiveDraft = { label: '', owner: '', deadline: '', wizardStep: 1 };
    App.render();
  },

  updateStrategicObjectiveDraft(field, value) {
    if (!App.state.strategicObjectiveDraft) return;
    App.state.strategicObjectiveDraft = { ...App.state.strategicObjectiveDraft, [field]: value };
  },

  nextStrategicObjectiveStep() {
    const draft = App.state.strategicObjectiveDraft;
    if (!draft) return;
    const step = Number(draft.wizardStep || 1);
    App.state.strategicObjectiveDraft = { ...draft, wizardStep: Math.min(step + 1, 3) };
    App.render();
  },

  prevStrategicObjectiveStep() {
    const draft = App.state.strategicObjectiveDraft;
    if (!draft) return;
    const step = Number(draft.wizardStep || 1);
    App.state.strategicObjectiveDraft = { ...draft, wizardStep: Math.max(step - 1, 1) };
    App.render();
  },

  cancelStrategicObjectiveDraft() {
    App.state.strategicObjectiveDraft = null;
    App.render();
  },

  saveStrategicObjectiveDraft() {
    const productId = App.state.strategicMapProductId;
    const draft = App.state.strategicObjectiveDraft;
    if (!productId || !draft) return;
    if (!String(draft.label || '').trim()) return Utils.toast('Dê um nome à batalha.');
    StrategicObjectiveEngine.add(productId, { label: draft.label, owner: draft.owner, deadline: draft.deadline });
    App.state.strategicObjectiveDraft = null;
    App.save(); App.render();
    Utils.toast('Batalha adicionada.');
  },

  // V28.0.0 — Carrega as 4 batalhas da Cacau Show direto como objetivos salvos.
  // O usuário usa como ponto de partida e ajusta dono/prazo depois.
  loadCacauShowBatalhasExample() {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicObjectiveEngine) return;
    const exemplos = [
      'Estar presente em mais bairros do Brasil',
      'Fazer cada cliente voltar mais vezes no ano',
      'Garantir que todo mundo lembre da gente nas datas comemorativas',
      'Conquistar quem hoje compra chocolate importado'
    ];
    exemplos.forEach(label => StrategicObjectiveEngine.add(productId, { label, owner: '', deadline: '' }));
    App.state.strategicObjectiveDraft = null;
    App.save(); App.render();
    Utils.toast('4 batalhas Cacau Show carregadas como rascunho. Ajuste dono e prazo de cada uma.');
  },

  removeStrategicObjective(objectiveId) {
    const productId = App.state.strategicMapProductId;
    if (!productId) return;
    StrategicObjectiveEngine.remove(productId, objectiveId);
    App.save(); App.render();
    Utils.toast('Frente removida.');
  },

  // V28.1.1 — Toggle de balão de ajuda (?) em qualquer etapa do Mapa.
  // key: identificador único do balão (ex: 'vision-objetivo-comercial').
  toggleStrategicHelp(key) {
    const current = App.state.strategicHelpOpen || {};
    App.state.strategicHelpOpen = { ...current, [key]: !current[key] };
    App.render();
  },

  // V28.1 — Edita campo de uma frente comercial (Marketing/Vendas/CS).
  // areaId: 'marketing'|'sales'|'cs'; field: 'owner'|'deadline'|'label'.
  updateStrategicAreaField(areaId, field, value) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicMapEngine) return;
    const objective = StrategicMapEngine.getObjectiveByArea(productId, areaId);
    if (!objective) return;
    const patch = field === 'deadline' ? { deadline: value || null } : { [field]: String(value || '') };
    StrategicObjectiveEngine.update(productId, objective.id, patch);
    App.save();
  },

  startStrategicOkrDraft(objectiveId) {
    App.state.strategicOkrDraft = {
      objectiveId,
      name: '',
      metric: 'quantidade',
      target: 0,
      current: 0,
      startValue: 0,
      owner: '',
      deadline: '',
      impact: '',
      commitmentType: 'stretch',
      connectedActionIds: [],
      wizardStep: 1
    };
    App.render();
  },

  nextStrategicOkrStep() {
    const draft = App.state.strategicOkrDraft;
    if (!draft) return;
    const step = Number(draft.wizardStep || 1);
    App.state.strategicOkrDraft = { ...draft, wizardStep: Math.min(step + 1, 7) };
    App.render();
  },

  prevStrategicOkrStep() {
    const draft = App.state.strategicOkrDraft;
    if (!draft) return;
    const step = Number(draft.wizardStep || 1);
    App.state.strategicOkrDraft = { ...draft, wizardStep: Math.max(step - 1, 1) };
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
    // V31.2.10 — Roteia baseado em draft.area (V29 productKr) vs draft.objectiveId (legacy V28).
    if (draft.area) {
      const target = Number(draft.target || 0);
      const tipo = draft.commitmentType === 'committed' ? 'committed' : 'stretch';
      StrategicMapEngine.addProductKr(Number(productId), {
        area: draft.area,
        name: draft.name,
        metric: draft.metric || 'quantidade',
        // commitmentType decide se 'target' vai pra targetCommitted (seguro) ou targetStretch (avançado)
        targetCommitted: tipo === 'committed' ? target : null,
        targetStretch: tipo === 'stretch' ? target : null,
        period: 90,
        owner: String(draft.owner || '').trim()
      });
    } else {
      StrategicOkrEngine.add(productId, draft.objectiveId, draft);
    }
    App.state.strategicOkrDraft = null;
    App.save(); App.render();
    Utils.toast('Número adicionado.');
  },

  removeStrategicOkr(objectiveId, okrId) {
    const productId = App.state.strategicMapProductId;
    if (!productId) return;
    StrategicOkrEngine.remove(productId, objectiveId, okrId);
    App.save(); App.render();
    Utils.toast('Número removido.');
  },

  // V28.2 — Ativa um número do catálogo guiado (Marketing/Vendas/CS).
  activateStrategicKpi(areaId, kpiId) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicMapEngine) return;
    const already = StrategicMapEngine.getActivatedCatalogIds(productId, areaId);
    if (already.has(kpiId)) return Utils.toast('Esse número já está ativo.');
    StrategicMapEngine.activateCatalogKpi(productId, areaId, kpiId);
    App.save(); App.render();
    Utils.toast('Número ativado. Preencha a meta.');
  },

  // V28.2 — Edita campo de um número inline. V28.2.1: aceita null pra valores vazios.
  updateStrategicOkrField(objectiveId, okrId, field, value) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicOkrEngine) return;
    const numericFields = ['current', 'target', 'targetCommitted', 'targetStretch', 'startValue', 'period'];
    const patch = {};
    if (numericFields.includes(field)) {
      patch[field] = (value === '' || value === null || value === undefined) ? null : Number(value);
      // Sincroniza `target` legado com targetCommitted.
      if (field === 'targetCommitted') patch.target = patch.targetCommitted ?? 0;
    } else if (field === 'deadline') {
      patch.deadline = value || null;
    } else {
      patch[field] = String(value || '');
    }
    StrategicOkrEngine.update(productId, objectiveId, okrId, patch);
    App.save();
  },

  // V28.2.1 — Seta período (em dias) e recalcula deadline a partir de hoje.
  setStrategicNumeroPeriod(objectiveId, okrId, periodDays) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicOkrEngine) return;
    const period = Number(periodDays);
    const deadline = StrategicOkrEngine._computeDeadline ? StrategicOkrEngine._computeDeadline(period) : null;
    StrategicOkrEngine.update(productId, objectiveId, okrId, { period, deadline });
    App.save(); App.render();
  },

  // V28.2.3 — Tenta mudar período. Se for 90, aplica direto. Se for 30 ou 60,
  // abre balão do Djow com explicação antes — user confirma ou volta.
  tryChangeStrategicPeriod(objectiveId, okrId, periodDays) {
    const days = Number(periodDays);
    if (days === 90) {
      App.state.strategicPeriodWarning = null;
      return Actions.setStrategicNumeroPeriod(objectiveId, okrId, 90);
    }
    App.state.strategicPeriodWarning = { krId: okrId, objectiveId, attemptedDays: days };
    App.render();
  },

  // V28.2.3 — Confirma a mudança pra período não-recomendado (após ler o aviso do Djow).
  confirmStrategicPeriodChange(objectiveId, okrId) {
    const warning = App.state.strategicPeriodWarning;
    if (!warning || warning.krId !== okrId) return;
    Actions.setStrategicNumeroPeriod(objectiveId, okrId, warning.attemptedDays);
    App.state.strategicPeriodWarning = null;
    App.render();
  },

  // V28.2.3 — Fecha o aviso e mantém em 90 dias.
  dismissStrategicPeriodWarning(objectiveId, okrId) {
    App.state.strategicPeriodWarning = null;
    Actions.setStrategicNumeroPeriod(objectiveId, okrId, 90);
  },

  // V28.2.1 — Confirma um número (valida que tem current + 2 metas + período).
  // Se for o último de todos, dispara mensagem do Djow.
  // V28.2.3 — Auto-avança a aba ativa quando próximo unconfirmed está em outra área.
  confirmStrategicNumero(objectiveId, okrId) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicOkrEngine) return;
    const objectives = (StrategicMapEngine.getForProduct(productId)?.objectives) || [];
    const obj = objectives.find(o => o.id === objectiveId);
    const kr = obj?.okrs?.find(k => k.id === okrId);
    if (!kr) return;
    if (!StrategicOkrEngine.isComplete(kr)) {
      return Utils.toast('Preencha Atual, Meta Segura, Meta Avançada e Período Tático antes de confirmar.');
    }
    const currentAreaId = obj?.area;
    StrategicOkrEngine.update(productId, objectiveId, okrId, { confirmed: true });
    App.save();
    // V29.0.1 — Mensagem do Djow agora é contextual à branch (campanha).
    // O "allKrsConfirmed" opera sobre a branch ativa, não sobre o produto inteiro.
    const campaignId = App.state.strategicMapCampaignId;
    const campaign = campaignId ? (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId)) : null;
    if (StrategicMapEngine.allKrsConfirmed(productId, campaignId) && window.DjowStrategicAssistant) {
      const branchLabel = campaign ? `da campanha "${campaign.name}"` : 'desta branch';
      const msg = `🎯 Boa! Você cobriu todos os números ${branchLabel} (Marketing, Vendas e Sucesso do Cliente).\n\nEsses números agora alimentam o rollup dos KRs-mãe do produto via soma automática.\n\nA partir de agora vou ficar de olho neles — se algum sair da rota, te aviso. E se eu perceber que precisa pivotar, te chamo aqui mesmo.\n\nPróximo passo: conectar cada número à ação operacional que move o ponteiro nesta campanha.`;
      DjowStrategicAssistant.append(productId, { role: 'agent', text: msg, ts: new Date().toISOString() });
      App.state.strategicHandoffPopup = true;
      Utils.toast('🎯 Todos os números confirmados nesta branch.');
    } else {
      // V28.2.3 — auto-advance: se próximo unconfirmed está em outra frente, mudar aba ativa.
      const next = StrategicMapEngine.nextUnconfirmedKr(productId);
      if (next && next.areaId && next.areaId !== currentAreaId) {
        App.state.strategicActiveArea = next.areaId;
        Utils.toast(`Número confirmado. Avançando pra próxima frente.`);
      } else {
        Utils.toast('Número confirmado.');
      }
    }
    App.render();
  },

  // V28.2.3 — Seleciona qual frente está ativa (tab nav). V28.3: compartilhado
  // entre as etapas Números e Ações.
  setStrategicActiveArea(areaId) {
    App.state.strategicActiveArea = areaId;
    App.render();
  },

  // V28.3.1 — Fecha o popup didático do passe do bastão (estratégia → tático).
  // Se `advance=true`, navega pra etapa "As Ações"; caso contrário, só fecha.
  dismissStrategicHandoffPopup(advance) {
    App.state.strategicHandoffPopup = false;
    if (advance) {
      App.state.strategicMapZoom = 'operations';
    }
    App.save(); App.render();
  },

  // V28.3.0 — Ativa uma ação do catálogo na frente selecionada.
  // V28.4.1 — Se a campanha estratégica do produto ainda não foi nomeada,
  // abre prompt bloqueante e guarda a ativação como pendente.
  activateStrategicCatalogAction(areaId, templateId) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicMapEngine) return;
    const already = StrategicMapEngine.getActivatedCatalogActionIds(productId, areaId);
    if (already.has(templateId)) return Utils.toast('Essa ação já está ativa.');
    const result = StrategicMapEngine.activateCatalogAction(productId, areaId, templateId);
    if (result?.needsCampaign) {
      // Abre prompt e guarda a ativação como pendente.
      App.state.strategicCampaignPrompt = { productId: Number(productId), pending: { areaId, templateId } };
      App.render();
      return;
    }
    if (result?.error || !result?.action) return Utils.toast('Não consegui ativar essa ação.');
    const action = result.action;
    App.save(); App.render();
    const linkedKrs = (StrategicMapEngine.getObjectiveByArea(productId, areaId)?.okrs || []).filter(k => (k.connectedActionIds || []).map(Number).includes(Number(action.id))).length;
    Utils.toast(linkedKrs ? `Ação ativada e vinculada a ${linkedKrs} número(s).` : 'Ação ativada. Preencha dono e cadência.');
  },

  // V28.4.1 — Atualiza o draft do prompt de campanha (input do nome).
  updateStrategicCampaignDraft(field, value) {
    const current = App.state.strategicCampaignPrompt || {};
    App.state.strategicCampaignPrompt = { ...current, [field]: value };
  },

  // V28.4.1 — Confirma a campanha estratégica e roda a ativação pendente.
  // mode: 'new' (cria com nome) ou 'existing' (vincula a campanha existente).
  confirmStrategicCampaign(mode) {
    const prompt = App.state.strategicCampaignPrompt;
    if (!prompt) return;
    const { productId, pending } = prompt;
    if (!productId) return;
    let campaign;
    if (mode === 'existing') {
      const id = Number(prompt.existingCampaignId);
      if (!id) return Utils.toast('Escolha uma campanha existente.');
      campaign = StrategicMapEngine.setStrategicCampaign(productId, null, id);
    } else {
      const name = String(prompt.newName || '').trim();
      if (!name) return Utils.toast('Dê um nome à campanha estratégica.');
      campaign = StrategicMapEngine.setStrategicCampaign(productId, name, null);
    }
    if (!campaign) return Utils.toast('Não consegui criar/vincular a campanha.');
    App.state.strategicCampaignPrompt = null;
    // Roda a ativação que estava pendente.
    if (pending) {
      const result = StrategicMapEngine.activateCatalogAction(productId, pending.areaId, pending.templateId);
      if (result?.action) {
        const linkedKrs = (StrategicMapEngine.getObjectiveByArea(productId, pending.areaId)?.okrs || []).filter(k => (k.connectedActionIds || []).map(Number).includes(Number(result.action.id))).length;
        Utils.toast(`Campanha "${campaign.name}" definida e ação ativada${linkedKrs ? ` (vinculada a ${linkedKrs} número(s))` : ''}.`);
      } else {
        Utils.toast(`Campanha "${campaign.name}" definida.`);
      }
    } else {
      Utils.toast(`Campanha "${campaign.name}" definida.`);
    }
    App.save(); App.render();
  },

  // V28.4.1 — Cancela o prompt sem definir campanha (ativação pendente é descartada).
  dismissStrategicCampaignPrompt() {
    App.state.strategicCampaignPrompt = null;
    App.render();
  },

  // V29.0.0 — Ativa Mapa pra uma campanha como BRANCH (compartilha visão do produto).
  // Cada campanha vira uma branch independente em strategicCampaignMaps.
  // Não troca mais o strategicCampaignId global — cada branch é autônoma.
  // Se for a 1ª branch do produto, vira a default (strategicCampaignId).
  activateStrategicMapForCampaign(campaignId) {
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    const productId = campaign.productId;
    if (!productId) return Utils.toast('Esta campanha não tem produto vinculado.');
    // V29.0.2 — Não marca mais isStrategicHost (deprecado): visual vem do branchMap
    // via getCampaignStrategicStatus. Marcar quebrava a migração legacy.
    if (window.StrategicMapEngine) {
      StrategicMapEngine.ensureBranchMap(Number(campaignId), Number(productId));
      StrategicMapEngine.ensureComercialAreas(productId, Number(campaignId));
      // Se era a 1ª branch, vira a default do produto.
      const map = StrategicMapEngine.getForProduct(productId);
      if (!map?.strategicCampaignId) {
        StrategicMapEngine.save(productId, { strategicCampaignId: Number(campaignId) });
      }
    }
    Utils.toast(`Mapa da Receita ativado em "${campaign.name}". Branch criada — preencha os números desta campanha.`);
    Actions.openStrategicMapForCampaign(Number(campaignId));
  },

  // V29.0.0 — Abre Mapa em vista CAMPANHA (5 etapas da branch).
  openStrategicMapForCampaign(campaignId) {
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    if (!campaign) return Utils.toast('Campanha não encontrada.');
    App.state.strategicMapProductId = Number(campaign.productId);
    App.state.strategicMapCampaignId = Number(campaignId);   // V29 — vista campanha
    App.state.strategicMapMode = 'campaign';                  // V29
    App.state.showStrategicMap = true;
    App.state.strategicMapZoom = 'campaign'; // V29.1.0 — Gestor abre na etapa Campanha (onde pluga KRs)
    // V31.2.16 — Quando o Mapa é aberto VINDO de uma campanha (card de campanha,
    // Djow, action, etc.), pula o welcome — só aparece pelo caminho 'Mapa da
    // Receita' do menu Produtos ou 'Criar Produto com Mapa'.
    App.state.strategicSkipOnboarding = true;
    App.state.strategicObjectiveDraft = null;
    App.state.strategicOkrDraft = null;
    App.state.strategicActiveArea = null;
    App.state.strategicCampaignPrompt = null;
    if (window.StrategicMapEngine) {
      StrategicMapEngine.ensure(Number(campaign.productId));
      StrategicMapEngine.ensureBranchMap(Number(campaignId), Number(campaign.productId));
      StrategicMapEngine.ensureComercialAreas(Number(campaign.productId), Number(campaignId));
    }
    App.save(); App.render();
  },

  // V31.2.41 — Modal info "RD + LeadJourney" (accordion das 3 conexões).
  openRdInfoModal() {
    App.state.rdInfoModal = { open: true, openSection: null };
    App.render();
  },
  closeRdInfoModal() {
    App.state.rdInfoModal = null;
    App.render();
  },
  toggleRdInfoSection(section) {
    if (!App.state.rdInfoModal) return;
    const current = App.state.rdInfoModal.openSection;
    App.state.rdInfoModal = { ...App.state.rdInfoModal, openSection: current === section ? null : section };
    App.render();
  },

  // V31.2.41 — Testa as 3 conexões RD em sequência e atualiza rdConnectionStatus.
  // Status por conexão:
  //   - 'missing': sem token configurado
  //   - 'connected': RD respondeu 2xx
  //   - 'error': RD respondeu 4xx/5xx OU falha de rede
  async testAllRdConnections() {
    if (App.state.rdTestingConnections) return;
    App.state.rdTestingConnections = true;
    App.render();
    const rdCfg = App.state.integrations?.rd || {};
    const jwt = localStorage.getItem('lj_jwt');
    const now = new Date().toISOString();

    const tests = [
      {
        key: 'crm_pat',
        hasToken: Boolean(rdCfg.crmPersonalToken),
        method: 'GET', path: '/deal_pipelines', legacy: true, useQueryToken: true
      },
      {
        // V31.2.56 — Era /platform/account_info que retornava 404 (RD mudou
        // ou o path nunca existiu). Troca pra /integrations/webhooks que é
        // multi-produto (qualquer OAuth válido passa). Mesmo padrão do
        // crm_oauth (V31.2.55).
        key: 'marketing_oauth',
        hasToken: Boolean(rdCfg.accessToken),
        method: 'GET', path: '/integrations/webhooks', legacy: false, useQueryToken: false
      },
      {
        // V31.2.55 — Era /crm/v2/deals?limit=1 mas alguns apps OAuth só tem
        // scope de cadastrar webhook (não de ler deals). Testando /integrations/webhooks
        // (multi-produto, mesmo endpoint que cadastra webhook), bate exatamente
        // a permissão que essa feature usa. Se GET aqui funciona, o OAuth é OK
        // pra propósito de receber eventos em tempo real.
        key: 'crm_oauth',
        hasToken: Boolean(rdCfg.crmOauth?.accessToken),
        method: 'GET', path: '/integrations/webhooks', legacy: false, useQueryToken: false, useCrmOauthV2: true
      }
    ];

    const results = {};
    for (const t of tests) {
      if (!t.hasToken) {
        results[t.key] = { status: 'missing', message: 'Não conectado — clique nos passos abaixo pra configurar', testedAt: now };
        continue;
      }
      try {
        const token = t.key === 'crm_pat' ? rdCfg.crmPersonalToken
          : t.key === 'marketing_oauth' ? rdCfg.accessToken
          : rdCfg.crmOauth?.accessToken;
        const r = await fetch('/api/rd-proxy', {
          method: 'POST',
          headers: jwt ? { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` } : { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method: t.method, path: t.path, token, token_source: t.key, legacy: t.legacy, useQueryToken: t.useQueryToken })
        });
        if (r.ok) {
          results[t.key] = { status: 'connected', message: 'RD respondeu OK', testedAt: now };
        } else {
          const body = await r.json().catch(() => ({}));
          const msg = body?.error || body?.message || `HTTP ${r.status}`;
          results[t.key] = { status: 'error', message: `${r.status}: ${msg}`, testedAt: now };
        }
      } catch (err) {
        results[t.key] = { status: 'error', message: `Rede: ${err.message}`, testedAt: now };
      }
    }

    App.state.rdConnectionStatus = results;
    App.state.rdTestingConnections = false;
    App.save(); App.render();
    const connected = Object.values(results).filter(r => r.status === 'connected').length;
    Utils.toast(`Teste finalizado: ${connected}/3 conectada(s).`);
  },

  // V31.2.36 — RD STATION/CRM CREDENTIALS WRITE-THROUGH
  // Strategy: tokens continuam vivendo em App.state.integrations.rd (mesma
  // API de leitura interna), mas TODA mutação dispara save criptografado no
  // backend pra DB sobreviver a perda de state. No boot, hidrata do DB pra
  // recuperar conexões caso state tenha sido limpo.

  async loadRdCredentialsFromDb() {
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/rd-credentials', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!data.ok) return;
      const creds = data.credentials || {};
      // V31.2.38 — Migration one-shot: se DB está vazio mas App.state tem tokens
      // de versões antigas (pré V31.2.36), backfill o DB com o que tem em state.
      // Isso cobre o gap onde write-through só dispara em mutação.
      const hasDbAny = Boolean(creds.crm_pat?.access_token || creds.marketing_oauth?.access_token || creds.crm_oauth?.access_token);
      if (!hasDbAny) {
        const rdState = App.state.integrations?.rd || {};
        const stateHasAny = Boolean(rdState.crmPersonalToken || rdState.accessToken || rdState.crmOauth?.accessToken);
        if (stateHasAny) {
          console.log('[rd] DB vazio + state com tokens → backfill DB (one-shot migration).');
          this._persistRdToDb('crm_pat');
          this._persistRdToDb('marketing_oauth');
          this._persistRdToDb('crm_oauth');
          // Não chama loadRdCredentialsFromDb recursivo. Próximo boot vai ler do DB normalmente.
          return;
        }
      }
      const rd = App.state.integrations?.rd || (window.RDConfig ? RDConfig.defaultConfig() : {});
      let changed = false;
      // CRM PAT (estático)
      if (creds.crm_pat?.access_token && !rd.crmPersonalToken) {
        rd.crmPersonalToken = creds.crm_pat.access_token;
        if (creds.crm_pat.status) rd.crmTestStatus = creds.crm_pat.status;
        changed = true;
      }
      // Marketing OAuth
      const mkt = creds.marketing_oauth;
      if (mkt && (!rd.accessToken || !rd.refreshToken)) {
        if (mkt.access_token) rd.accessToken = mkt.access_token;
        if (mkt.refresh_token) rd.refreshToken = mkt.refresh_token;
        if (mkt.client_id) rd.clientId = mkt.client_id;
        if (mkt.client_secret) rd.clientSecret = mkt.client_secret;
        if (mkt.redirect_uri) rd.redirectUri = mkt.redirect_uri;
        if (mkt.expires_at) rd.expiresAt = mkt.expires_at;
        if (mkt.account_name) rd.accountName = mkt.account_name;
        if (mkt.workspace_id) rd.workspaceId = mkt.workspace_id;
        if (mkt.status) rd.status = mkt.status;
        changed = true;
      }
      // CRM OAuth v2 (nested em rd.crmOauth)
      const crmO = creds.crm_oauth;
      if (crmO && (!rd.crmOauth?.accessToken || !rd.crmOauth?.refreshToken)) {
        rd.crmOauth = rd.crmOauth || {};
        if (crmO.access_token) rd.crmOauth.accessToken = crmO.access_token;
        if (crmO.refresh_token) rd.crmOauth.refreshToken = crmO.refresh_token;
        if (crmO.client_id) rd.crmOauth.clientId = crmO.client_id;
        if (crmO.client_secret) rd.crmOauth.clientSecret = crmO.client_secret;
        if (crmO.redirect_uri) rd.crmOauth.redirectUri = crmO.redirect_uri;
        if (crmO.expires_at) rd.crmOauth.expiresAt = crmO.expires_at;
        if (crmO.status) rd.crmOauth.status = crmO.status;
        changed = true;
      }
      if (changed) {
        App.state.integrations = { ...(App.state.integrations || {}), rd };
        App.save(); App.render();
      }
    } catch (err) { console.warn('[rd] loadCredentialsFromDb erro:', err); }
  },

  // Salva 1 token type no DB criptografado. Não-bloqueante: erro de rede só
  // loga warn. Frontend continua usando App.state normal — DB é shadow copy.
  async _saveRdCredentialToDb(tokenType, fields) {
    try {
      const token = localStorage.getItem('lj_jwt');
      const body = { token_type: tokenType, ...fields };
      const r = await fetch('/api/rd-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        console.warn(`[rd] saveCredential ${tokenType} falhou: ${data.message || r.status}`);
      }
    } catch (err) { console.warn(`[rd] saveCredential ${tokenType} erro:`, err); }
  },

  // Dispara write-through pros 3 token types lendo do estado atual.
  // Chamado sempre que alguma action muta os tokens.
  async _persistRdToDb(tokenType) {
    const rd = App.state.integrations?.rd;
    if (!rd) return;
    if (tokenType === 'crm_pat' || !tokenType) {
      if (rd.crmPersonalToken) {
        this._saveRdCredentialToDb('crm_pat', {
          access_token: rd.crmPersonalToken,
          status: rd.crmTestStatus || null
        });
      }
    }
    if (tokenType === 'marketing_oauth' || !tokenType) {
      if (rd.accessToken || rd.refreshToken || rd.clientId) {
        this._saveRdCredentialToDb('marketing_oauth', {
          access_token: rd.accessToken || null,
          refresh_token: rd.refreshToken || null,
          client_id: rd.clientId || null,
          client_secret: rd.clientSecret || null,
          redirect_uri: rd.redirectUri || null,
          expires_at: rd.expiresAt || null,
          account_name: rd.accountName || null,
          workspace_id: rd.workspaceId || null,
          status: rd.status || null
        });
      }
    }
    if (tokenType === 'crm_oauth' || !tokenType) {
      const co = rd.crmOauth;
      if (co && (co.accessToken || co.refreshToken || co.clientId)) {
        this._saveRdCredentialToDb('crm_oauth', {
          access_token: co.accessToken || null,
          refresh_token: co.refreshToken || null,
          client_id: co.clientId || null,
          client_secret: co.clientSecret || null,
          redirect_uri: co.redirectUri || null,
          expires_at: co.expiresAt || null,
          status: co.status || null
        });
      }
    }
  },

  async _deleteRdCredentialFromDb(tokenType) {
    try {
      const token = localStorage.getItem('lj_jwt');
      const qs = tokenType ? `?token_type=${encodeURIComponent(tokenType)}` : '';
      await fetch('/api/rd-credentials' + qs, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) { console.warn(`[rd] deleteCredential ${tokenType || 'all'} erro:`, err); }
  },

  // V30.0.0 — INTEGRAÇÃO CLICKUP. Actions pra Settings UI + criar task via modal.

  // Carrega status ClickUp do backend.
  // V32.1.3 — agora também hidrata defaultListId/Name/SpaceId pra UI mostrar
  // qual list o LJ vai usar (substitui auto-discovery).
  async loadClickupStatus() {
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-config', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (data.ok) {
        // V32.6.1 — detecta transição "acabou de conectar sem raiz" pra
        // abrir o wizard automaticamente (cliente não fica perdido procurando).
        const wasConnected = !!(App.state.clickupStatus && App.state.clickupStatus.connected);
        const nowConnected = !!data.connected;
        const hasRoot = !!(data.rootId || data.ljSpaceId);
        const justConnected = nowConnected && !wasConnected && !hasRoot;
        App.state.clickupStatus = {
          configured: data.configured,
          connected: data.connected,
          workspaceName: data.workspaceName,
          encryptionReady: data.encryptionReady,
          // V32.5.6 — tokenType ('oauth' | 'pat' | null) diferencia método na UI
          tokenType: data.tokenType || null,
          defaultListId: data.defaultListId || null,
          defaultListName: data.defaultListName || null,
          defaultSpaceId: data.defaultSpaceId || null,
          // V32.1.4-1.6 — settings expandidas
          ljTagName: data.ljTagName || null,
          taskPrefix: data.taskPrefix || null,
          statusMap: data.statusMap || null,
          writeEnabled: data.writeEnabled !== false,
          // V32.2.0 — hierarquia espelhada (back-compat)
          ljSpaceId: data.ljSpaceId || null,
          mirrorEnabled: data.mirrorEnabled !== false,
          // V32.6.0 — raiz flexível
          rootId: data.rootId || null,
          rootKind: data.rootKind || null,
          rootName: data.rootName || null
        };
        App.save(); App.render();
        // V31.2.33 — Quando conecta, pre-fetch metadata pra modal de criar task abrir instantâneo.
        if (data.connected && !App.state.clickupMeta?.loaded) {
          this.loadClickupMetadata();
        }
        // V32.6.1 — Empurra o cliente direto pro setup wizard logo após conectar.
        // Evita o usuário ficar perdido procurando "onde escolher a list?".
        if (justConnected && !App.state.clickupSpaceWizard?.open) {
          setTimeout(() => Actions.openClickupSpaceWizard(), 400);
        }
      }
    } catch (err) { console.warn('[clickup] loadStatus erro:', err); }
  },

  // V32.1.3 — Picker de list ClickUp (Geraldo safe integration).
  openClickupListPicker() {
    App.state.showClickupListPicker = true;
    App.save(); App.render();
    if (!App.state._clickupTreeCache) {
      this.loadClickupTree();
    }
  },

  closeClickupListPicker() {
    App.state.showClickupListPicker = false;
    App.save(); App.render();
  },

  async loadClickupTree() {
    const token = localStorage.getItem('lj_jwt');
    if (!token) return;
    App.state.clickupTreeLoading = true;
    App.render();
    try {
      const r = await fetch('/api/clickup-tree', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (data.ok) {
        App.state._clickupTreeCache = data;
      } else {
        Utils.toast(`Falha ao carregar árvore: ${data.message}`);
      }
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    } finally {
      App.state.clickupTreeLoading = false;
      App.render();
    }
  },

  // V32.1.4 — Drafts e save de marcação automática (tag + prefix).
  updateClickupMarkerDraft(field, value) {
    App.state.clickupMarkerDrafts = {
      ...(App.state.clickupMarkerDrafts || { ljTagName: '', taskPrefix: '' }),
      [field]: String(value || '')
    };
  },

  async saveClickupMarkers() {
    const token = localStorage.getItem('lj_jwt');
    const drafts = App.state.clickupMarkerDrafts || {};
    const status = App.state.clickupStatus || {};
    // Só envia campos que mudaram — UI usa current value como placeholder,
    // então draft vazio significa "manter atual". Pra LIMPAR o user manda 'null'
    // via botão dedicado (não implementado nesta UI inicial).
    const body = {};
    if (drafts.ljTagName && drafts.ljTagName !== status.ljTagName) {
      body.lj_tag_name = drafts.ljTagName;
    }
    if (drafts.taskPrefix !== '' && drafts.taskPrefix !== status.taskPrefix) {
      body.task_prefix = drafts.taskPrefix;
    }
    if (!Object.keys(body).length) {
      return Utils.toast('Nenhuma mudança pra salvar.');
    }
    try {
      const r = await fetch('/api/clickup-update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast('✓ Marcação ClickUp atualizada.');
      App.state.clickupMarkerDrafts = { ljTagName: '', taskPrefix: '' };
      await this.loadClickupStatus();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.5.9 → V32.6.0 — Setup Wizard ClickUp.
  // Cliente navega tree do workspace (Space → Folder → List) e escolhe um nó
  // como raiz LJ. Tipo do nó define o modo de espelhamento:
  //   - Space  → cascado completo (Folder=Produto, List=Campanha, ...)
  //   - Folder → cascado parcial (List=Campanha, ...). Produto vira só metadado LJ.
  //   - List   → achatado: tarefas viram Tasks na list direto.
  // Princípio (workspace-sovereignty): LJ nunca cria nada sem cliente mandar.

  openClickupSpaceWizard() {
    App.state.clickupSpaceWizard = {
      open: true,
      loading: true,
      tree: [],
      workspaceName: null,
      currentRootId: null,
      currentRootKind: null,
      mode: 'select',
      expandedSpaces: [],
      expandedFolders: [],
      selectedNode: null,
      newName: 'LeadJourney',
      submitting: false,
      error: null
    };
    App.save(); App.render();
    this.loadClickupSpaceWizard();
  },

  closeClickupSpaceWizard() {
    App.state.clickupSpaceWizard = {
      ...App.state.clickupSpaceWizard,
      open: false,
      submitting: false,
      error: null
    };
    App.save(); App.render();
  },

  async loadClickupSpaceWizard() {
    const w = App.state.clickupSpaceWizard;
    w.loading = true;
    w.error = null;
    App.save(); App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-tree', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!data.ok) {
        w.loading = false;
        w.error = data.message || 'Falha ao listar árvore do ClickUp.';
        App.save(); App.render();
        return;
      }
      w.loading = false;
      w.tree = Array.isArray(data.spaces) ? data.spaces : [];
      w.workspaceName = data.workspaceName || null;
      // Pega raiz atual do clickupStatus (loadClickupStatus já rodou em paralelo).
      const st = App.state.clickupStatus || {};
      w.currentRootId = st.rootId || st.ljSpaceId || null;
      w.currentRootKind = st.rootKind || (st.ljSpaceId ? 'space' : null);
      // Pré-seleciona o nó atual + expande os ancestrais pra usuário ver onde tá.
      if (w.currentRootId && w.currentRootKind) {
        const found = Actions._findNodeInTree(w.tree, w.currentRootId, w.currentRootKind);
        if (found) {
          w.selectedNode = { id: found.node.id, kind: w.currentRootKind, name: found.node.name };
          if (found.spaceId && !w.expandedSpaces.includes(found.spaceId)) w.expandedSpaces.push(found.spaceId);
          if (found.folderId && !w.expandedFolders.includes(found.folderId)) w.expandedFolders.push(found.folderId);
        }
      }
      App.save(); App.render();
    } catch (err) {
      w.loading = false;
      w.error = err.message;
      App.save(); App.render();
    }
  },

  // Helper interno (não é Action UI-callable): localiza nó na tree por kind+id.
  // Retorna { node, spaceId, folderId? } se achar, null caso contrário.
  _findNodeInTree(tree, targetId, targetKind) {
    if (!Array.isArray(tree)) return null;
    for (const space of tree) {
      if (targetKind === 'space' && space.id === targetId) {
        return { node: space, spaceId: null, folderId: null };
      }
      if (targetKind === 'list') {
        const fl = (space.folderlessLists || []).find(l => l.id === targetId);
        if (fl) return { node: fl, spaceId: space.id, folderId: null };
        for (const folder of (space.folders || [])) {
          const li = (folder.lists || []).find(l => l.id === targetId);
          if (li) return { node: li, spaceId: space.id, folderId: folder.id };
        }
      }
      if (targetKind === 'folder') {
        const folder = (space.folders || []).find(f => f.id === targetId);
        if (folder) return { node: folder, spaceId: space.id, folderId: null };
      }
    }
    return null;
  },

  setClickupSpaceWizardMode(mode) {
    App.state.clickupSpaceWizard.mode = (mode === 'create') ? 'create' : 'select';
    App.save(); App.render();
  },

  toggleClickupWizardSpace(spaceId) {
    const w = App.state.clickupSpaceWizard;
    const id = String(spaceId);
    const idx = w.expandedSpaces.indexOf(id);
    if (idx >= 0) w.expandedSpaces.splice(idx, 1);
    else w.expandedSpaces.push(id);
    App.save(); App.render();
  },

  toggleClickupWizardFolder(folderId) {
    const w = App.state.clickupSpaceWizard;
    const id = String(folderId);
    const idx = w.expandedFolders.indexOf(id);
    if (idx >= 0) w.expandedFolders.splice(idx, 1);
    else w.expandedFolders.push(id);
    App.save(); App.render();
  },

  setClickupWizardSelectedNode(id, kind, name) {
    App.state.clickupSpaceWizard.selectedNode = {
      id: String(id || ''),
      kind: (kind === 'space' || kind === 'folder' || kind === 'list') ? kind : 'space',
      name: String(name || '')
    };
    App.save(); App.render();
  },

  setClickupSpaceWizardNewName(name) {
    App.state.clickupSpaceWizard.newName = String(name || '').slice(0, 64);
    App.save();
    // não chama render — evita perder foco do input
  },

  async confirmClickupSpaceWizard() {
    const w = App.state.clickupSpaceWizard;
    if (w.submitting) return;

    const body = {};
    if (w.mode === 'create') {
      const name = String(w.newName || '').trim();
      if (!name) {
        w.error = 'Dê um nome pro Space novo.';
        App.save(); App.render();
        return;
      }
      body.space_name = name;
    } else {
      if (!w.selectedNode || !w.selectedNode.id) {
        w.error = 'Selecione um nó da árvore (Space, Folder ou List) ou troque pra criar novo.';
        App.save(); App.render();
        return;
      }
      body.root_id = w.selectedNode.id;
      body.root_kind = w.selectedNode.kind;
    }

    w.submitting = true;
    w.error = null;
    App.save(); App.render();

    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-setup-space', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      if (!data.ok) {
        w.submitting = false;
        w.error = data.message || 'Falha ao configurar raiz.';
        App.save(); App.render();
        return;
      }
      Utils.toast(`✓ ${data.message}`);
      App.state.clickupSpaceWizard = {
        ...App.state.clickupSpaceWizard,
        open: false,
        submitting: false,
        error: null
      };
      App.save();
      await this.loadClickupStatus();
      await this.loadClickupMappings();
      App.render();
    } catch (err) {
      w.submitting = false;
      w.error = err.message;
      App.save(); App.render();
    }
  },

  // V32.2.5 (Geraldo A12) — Migra estrutura LJ pro ClickUp em lote.
  // Útil pra cliente que já tem produtos/campanhas/ações no LJ e quer pré-criar
  // toda a hierarquia no ClickUp dele de uma vez (sem esperar primeira task).
  async migrateClickupToMirror() {
    const products = App.state.products || [];
    if (!products.length) return Utils.toast('Sem produtos pra migrar.');
    if (!confirm(`Migrar ${products.length} produto(s) e toda hierarquia (campanhas + ações) pro Space LeadJourney no ClickUp?\n\nIsso cria folder/list/task pai pra cada entity. Operação demora 1-5min em árvores grandes.\n\nConfirma?`)) return;

    // Monta árvore enxuta (id + name) pro POST
    const campaigns = App.state.campaigns || [];
    const actions = App.state.actions || [];
    const tree = products.map(p => ({
      id: Number(p.id),
      name: String(p.name || `Produto ${p.id}`),
      campaigns: campaigns
        .filter(c => Number(c.productId) === Number(p.id))
        .map(c => ({
          id: Number(c.id),
          name: String(c.name || `Campanha ${c.id}`),
          actions: actions
            .filter(a => Number(a.campaignId) === Number(c.id))
            .map(a => ({ id: Number(a.id), name: String(a.name || `Ação ${a.id}`) }))
        }))
    }));

    const token = localStorage.getItem('lj_jwt');
    Utils.toast('Migrando... pode demorar.');
    try {
      const r = await fetch('/api/clickup-migrate-to-mirror', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ products: tree })
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ ${data.message}`);
      if (data.errors?.length) {
        console.warn('[migrate-to-mirror] erros parciais:', data.errors);
      }
      await this.loadClickupMappings();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.2.3 (Geraldo A6) — Testa acessibilidade do Space LeadJourney sob demanda.
  async testClickupSpace() {
    const token = localStorage.getItem('lj_jwt');
    Utils.toast('Testando raiz LJ no ClickUp…');
    try {
      const r = await fetch('/api/clickup-test-space', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      if (data.accessible) {
        Utils.toast(`✓ ${data.message}`);
      } else {
        Utils.toast(`⚠ ${data.message}`);
      }
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async loadClickupMappings() {
    const token = localStorage.getItem('lj_jwt');
    if (!token) return;
    try {
      const r = await fetch('/api/clickup-mappings-list', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (data.ok) {
        App.state._clickupMappingsCache = data;
        App.save(); App.render();
      }
    } catch (err) { console.warn('[clickup-mappings] load erro:', err); }
  },

  async toggleClickupMirror() {
    const status = App.state.clickupStatus || {};
    const next = !(status.mirrorEnabled !== false);
    const confirmMsg = next
      ? 'Reativar modo espelhado?\n\nLJ vai voltar a criar folder/list/task na hierarquia Produto>Campanha>Ação no ClickUp.'
      : '⚠ Desativar modo espelhado?\n\nNovas tasks vão pra default_list_id (modelo simples). Tasks já criadas na hierarquia ficam como estão.\n\nNão recomendado pra cliente em produção.';
    if (!confirm(confirmMsg)) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const r = await fetch('/api/clickup-update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mirror_enabled: next })
      });
      // V32.2.0 — endpoint precisa aceitar mirror_enabled (vou adicionar)
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(next ? '✓ Modo espelhado REATIVADO.' : '✓ Modo espelhado DESATIVADO.');
      await this.loadClickupStatus();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.1.6 — Toggle modo escrita do ClickUp (read-only safety switch).
  async toggleClickupWriteMode() {
    const token = localStorage.getItem('lj_jwt');
    const status = App.state.clickupStatus || {};
    const next = !(status.writeEnabled !== false); // se atual=true, vira false; se false, vira true
    const confirmMsg = next
      ? 'Reativar modo de escrita do ClickUp?\n\nLJ voltará a criar/atualizar tasks no ClickUp do cliente.'
      : 'Ativar modo somente-leitura do ClickUp?\n\nLJ NÃO criará nem atualizará tasks até reativar. Útil pra teste/pausa.';
    if (!confirm(confirmMsg)) return;
    try {
      const r = await fetch('/api/clickup-update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ write_enabled: next })
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(next ? '✓ Modo escrita REATIVADO.' : '✓ Modo somente-leitura ATIVADO.');
      await this.loadClickupStatus();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.1.5 — Status mapping LJ → ClickUp.
  updateClickupStatusMapDraft(ljStatus, remoteStatus) {
    App.state.clickupStatusMapDraft = {
      ...(App.state.clickupStatusMapDraft || { pending: '', in_progress: '', completed: '' }),
      [ljStatus]: String(remoteStatus || '')
    };
    App.render();
  },

  async saveClickupStatusMap() {
    const token = localStorage.getItem('lj_jwt');
    const drafts = App.state.clickupStatusMapDraft || {};
    const current = App.state.clickupStatus?.statusMap || {};
    // Merge atual com drafts (só campos que mudaram). Mantém o que user não tocou.
    const merged = {
      pending: drafts.pending || current.pending || null,
      in_progress: drafts.in_progress || current.in_progress || null,
      completed: drafts.completed || current.completed || null
    };
    if (!merged.pending && !merged.in_progress && !merged.completed) {
      return Utils.toast('Mapeia pelo menos um status antes de salvar.');
    }
    try {
      const r = await fetch('/api/clickup-update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status_map_json: merged })
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast('✓ Mapping de status atualizado.');
      App.state.clickupStatusMapDraft = { pending: '', in_progress: '', completed: '' };
      await this.loadClickupStatus();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async clearClickupStatusMap() {
    if (!confirm('Remover mapping de status? Tasks novas vão usar o status default da list (ClickUp escolhe).')) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const r = await fetch('/api/clickup-update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status_map_json: null })
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast('✓ Mapping removido.');
      await this.loadClickupStatus();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async clearClickupMarker(field) {
    // field: 'lj_tag_name' ou 'task_prefix' — manda null pra LIMPAR no DB.
    if (!confirm(field === 'lj_tag_name'
      ? 'Remover tag automática? Tasks novas não vão mais ser marcadas (mais difícil de identificar o que veio do LJ).'
      : 'Remover prefixo do nome? Tasks novas não vão mais ter o prefixo.'
    )) return;
    const token = localStorage.getItem('lj_jwt');
    try {
      const r = await fetch('/api/clickup-update-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ [field]: null })
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast('✓ Removido.');
      await this.loadClickupStatus();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  async selectClickupList(listId, spaceId, listName) {
    const token = localStorage.getItem('lj_jwt');
    try {
      const r = await fetch('/api/clickup-set-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ list_id: listId, space_id: spaceId, list_name: listName })
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Falha: ${data.message}`);
      Utils.toast(`✓ ${data.message}`);
      App.state.showClickupListPicker = false;
      // Re-hidrata status pra mostrar lista nova
      await this.loadClickupStatus();
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V31.2.33 — Pre-fetch members/statuses/tags/custom_fields do ClickUp.
  // Chamado após login + connected, ou ao abrir modal de criar task se cache vazio.
  async loadClickupMetadata() {
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-metadata', { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      if (data.ok) {
        App.state.clickupMeta = {
          loaded: true,
          loadedAt: Date.now(),
          workspaceId: data.workspaceId,
          listId: data.listId,
          spaceId: data.spaceId,
          members: data.members || [],
          statuses: data.statuses || [],
          tags: data.tags || [],
          customFields: data.customFields || []
        };
        App.save();
        // Re-render se modal de task já tá aberto (pra preencher os dropdowns).
        if (App.state.taskCreationModal?.open) App.render();
      } else {
        console.warn('[clickup] loadMetadata falhou:', data.message);
      }
    } catch (err) { console.warn('[clickup] loadMetadata erro:', err); }
  },

  updateClickupConfigDraft(field, value) {
    App.state.clickupConfigDraft = { ...(App.state.clickupConfigDraft || {}), [field]: value };
  },

  async saveClickupConfig() {
    const draft = App.state.clickupConfigDraft || {};
    if (!draft.client_id || !draft.client_secret) return Utils.toast('Preencha Client ID e Client Secret.');
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ client_id: draft.client_id, client_secret: draft.client_secret })
      });
      const data = await r.json();
      if (data.ok) {
        Utils.toast('✓ Credenciais salvas. Agora clique em Conectar.');
        App.state.clickupConfigDraft = { client_id: '', client_secret: '' };
        await Actions.loadClickupStatus();
      } else {
        Utils.toast(`Erro: ${data.message}`);
      }
    } catch (err) { Utils.toast(`Erro de rede: ${err.message}`); }
  },

  // V31.2.33 — TASK CREATION MODAL: ponte ação → execução ClickUp.
  // Substitui o clique direto do antigo "Criar tarefa via Djow" no Mapa.
  // 3 modos: form Normal (obrigatório), expand Avançado (opcional), botão Djow (auto).
  openTaskCreationModal(actionId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return Utils.toast('Ação não encontrada.');
    // Pre-fetch metadata se ainda não tem
    if (!App.state.clickupMeta?.loaded) this.loadClickupMetadata();
    App.state.taskCreationModal = {
      open: true,
      actionId: Number(actionId),
      showAdvanced: false,
      djowLoading: false,
      submitting: false,
      draft: {
        name: action.name || '',
        description: action.strategicDescription && action.strategicDescription !== 'Ação custom criada via engine'
          ? action.strategicDescription
          : `Ação operacional: ${action.name}. Canal: ${action.channel || '—'}.`,
        assignees: [],
        // Avançado (vazio por default)
        priority: '',
        status: '',
        due_date: '',
        due_date_time: false,
        start_date: '',
        start_date_time: false,
        tags: [],
        time_estimate_hours: '',
        points: '',
        parent: '',
        links_to: '',
        markdown_content: '',
        custom_fields: {}
      }
    };
    App.render();
  },

  closeTaskCreationModal() {
    App.state.taskCreationModal = null;
    App.render();
  },

  updateTaskDraft(field, value) {
    if (!App.state.taskCreationModal) return;
    App.state.taskCreationModal = {
      ...App.state.taskCreationModal,
      draft: { ...App.state.taskCreationModal.draft, [field]: value }
    };
  },

  toggleTaskAssignee(memberId) {
    if (!App.state.taskCreationModal) return;
    const list = App.state.taskCreationModal.draft.assignees || [];
    const id = Number(memberId);
    const next = list.includes(id) ? list.filter(x => x !== id) : [...list, id];
    this.updateTaskDraft('assignees', next);
    App.render();
  },

  toggleTaskTag(tagName) {
    if (!App.state.taskCreationModal) return;
    const list = App.state.taskCreationModal.draft.tags || [];
    const next = list.includes(tagName) ? list.filter(x => x !== tagName) : [...list, tagName];
    this.updateTaskDraft('tags', next);
    App.render();
  },

  toggleTaskAdvanced() {
    if (!App.state.taskCreationModal) return;
    App.state.taskCreationModal = {
      ...App.state.taskCreationModal,
      showAdvanced: !App.state.taskCreationModal.showAdvanced
    };
    App.render();
  },

  // V31.2.34 — Abre modal de chat Djow acima do taskCreationModal.
  // User digita o que precisa, Djow propõe drafts (tool propose_task_draft),
  // user clica "Aplicar" pra copiar pra modal pai.
  openDjowTaskChat() {
    if (!App.state.taskCreationModal?.open) return;
    App.state.djowTaskChat = {
      open: true,
      actionId: App.state.taskCreationModal.actionId,
      messages: [],
      input: '',
      loading: false
    };
    App.render();
  },

  closeDjowTaskChat() {
    App.state.djowTaskChat = null;
    App.render();
  },

  updateDjowChatInput(value) {
    if (!App.state.djowTaskChat) return;
    App.state.djowTaskChat = { ...App.state.djowTaskChat, input: String(value || '') };
  },

  async sendDjowTaskMessage() {
    const c = App.state.djowTaskChat;
    if (!c || c.loading) return;
    const text = String(c.input || '').trim();
    if (!text) return;
    const userMsg = { role: 'user', content: text };
    const newMessages = [...(c.messages || []), userMsg];
    App.state.djowTaskChat = { ...c, messages: newMessages, input: '', loading: true };
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/djow-task-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          actionId: c.actionId,
          messages: newMessages.map(m => ({ role: m.role, content: m.content }))
        })
      });
      const data = await r.json();
      if (data.ok) {
        const assistantMsg = { role: 'assistant', content: data.reply || '...', _draft: data.draft || null };
        App.state.djowTaskChat = {
          ...App.state.djowTaskChat,
          messages: [...newMessages, assistantMsg],
          loading: false
        };
        App.render();
      } else {
        App.state.djowTaskChat = {
          ...App.state.djowTaskChat,
          messages: [...newMessages, { role: 'assistant', content: `Erro: ${data.message || 'falha desconhecida'}` }],
          loading: false
        };
        App.render();
      }
    } catch (err) {
      App.state.djowTaskChat = {
        ...App.state.djowTaskChat,
        messages: [...newMessages, { role: 'assistant', content: `Erro de rede: ${err.message}` }],
        loading: false
      };
      App.render();
    }
  },

  // Aplica o draft proposto pelo Djow no taskCreationModal. Sobrescreve só
  // os campos preenchidos pelo Djow — não toca o que o user já tinha digitado
  // se o draft veio sem aquele campo.
  applyDjowDraftToTask(draft) {
    if (!App.state.taskCreationModal?.open || !draft) return;
    const cur = App.state.taskCreationModal.draft;
    const next = { ...cur };
    if (draft.name) next.name = draft.name;
    if (draft.description) next.description = draft.description;
    if (draft.priority) next.priority = draft.priority;
    if (draft.status) next.status = draft.status;
    if (draft.due_date) { next.due_date = draft.due_date; next.due_date_time = String(draft.due_date).includes('T'); }
    if (draft.start_date) { next.start_date = draft.start_date; next.start_date_time = String(draft.start_date).includes('T'); }
    if (Array.isArray(draft.tags) && draft.tags.length) next.tags = draft.tags;
    if (Number.isFinite(draft.time_estimate_hours)) next.time_estimate_hours = String(draft.time_estimate_hours);
    if (Number.isFinite(draft.points)) next.points = String(draft.points);
    // Assignees: tenta matchar hints com members do workspace
    if (Array.isArray(draft.assignees_hints) && draft.assignees_hints.length && App.state.clickupMeta?.members?.length) {
      const members = App.state.clickupMeta.members;
      const matched = [];
      draft.assignees_hints.forEach(hint => {
        const h = String(hint || '').toLowerCase().trim();
        if (!h) return;
        const found = members.find(m =>
          String(m.username || '').toLowerCase().includes(h)
          || String(m.email || '').toLowerCase().includes(h)
        );
        if (found && !matched.includes(found.id)) matched.push(found.id);
      });
      if (matched.length) next.assignees = matched;
    }
    App.state.taskCreationModal = { ...App.state.taskCreationModal, draft: next };
    App.state.djowTaskChat = null;
    App.render();
    Utils.toast('✓ Draft aplicado. Revisa e clica em "Criar no ClickUp".');
  },

  // Djow auto-fill: pede pro Djow gerar nome+description+priority com base no contexto da ação.
  // Substitui só os campos vazios pra não sobrescrever o que o user já digitou.
  // V31.2.34 — DEPRECATED: substituído pelo modal de chat openDjowTaskChat. Mantido por compat.
  async fillTaskDraftWithDjow() {
    if (!App.state.taskCreationModal) return;
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(App.state.taskCreationModal.actionId));
    if (!action) return Utils.toast('Ação não encontrada.');
    App.state.taskCreationModal = { ...App.state.taskCreationModal, djowLoading: true };
    App.render();
    try {
      // Reusa o flow de auto-generation via Djow Modal (V16.3).
      // Se DjowModal não estiver disponível, faz heurística local (sem call ao Claude).
      const draft = App.state.taskCreationModal.draft;
      const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId));
      const heuristicName = `${action.name} — ${campaign?.name || 'campanha'}`;
      const heuristicDesc = `Ação: ${action.name}\nCampanha: ${campaign?.name || '—'}\nCanal: ${action.channel || '—'}\nTravessia: ${action.originSector || ''} ${action.originFunnel || ''} → ${action.destinationSector || ''} ${action.destinationFunnel || ''}\n\nObjetivo: executar a ação no canal definido e capturar os leads/sinais que ela gera.`;
      const next = {
        ...draft,
        name: draft.name || heuristicName,
        description: draft.description || heuristicDesc,
        priority: draft.priority || 'normal'
      };
      App.state.taskCreationModal = { ...App.state.taskCreationModal, draft: next, djowLoading: false };
      App.render();
      Utils.toast('Djow preencheu os campos. Revisa e ajusta antes de criar.');
    } catch (err) {
      App.state.taskCreationModal = { ...App.state.taskCreationModal, djowLoading: false };
      App.render();
      Utils.toast(`Djow falhou: ${err.message}`);
    }
  },

  // Submit: valida Normal + envia tudo ao backend.
  async submitTaskCreation() {
    const m = App.state.taskCreationModal;
    if (!m) return;
    const d = m.draft;
    // Validação Normal
    if (!String(d.name || '').trim()) return Utils.toast('Nome é obrigatório.');
    if (!String(d.description || '').trim()) return Utils.toast('Descrição é obrigatória.');
    if (!Array.isArray(d.assignees) || !d.assignees.length) return Utils.toast('Selecione pelo menos 1 responsável.');

    App.state.taskCreationModal = { ...m, submitting: true };
    App.render();

    // Monta payload pro backend
    const payload = {
      name: d.name.trim(),
      description: d.description.trim(),
      assignees: d.assignees,
      list_id: App.state.clickupMeta?.listId || undefined
    };
    // Avançados — só inclui se preenchidos
    if (d.priority) payload.priority = d.priority;
    if (d.status) payload.status = d.status;
    if (d.due_date) { payload.due_date = d.due_date; payload.due_date_time = !!d.due_date_time; }
    if (d.start_date) { payload.start_date = d.start_date; payload.start_date_time = !!d.start_date_time; }
    if (Array.isArray(d.tags) && d.tags.length) payload.tags = d.tags;
    if (d.time_estimate_hours && Number(d.time_estimate_hours) > 0) payload.time_estimate = Math.round(Number(d.time_estimate_hours) * 3600000);
    if (d.points !== '' && Number.isFinite(Number(d.points))) payload.points = Number(d.points);
    if (d.parent) payload.parent = d.parent;
    if (d.links_to) payload.links_to = d.links_to;
    if (d.markdown_content && d.markdown_content.trim()) payload.markdown_content = d.markdown_content.trim();
    // custom_fields: transforma object {id: value} em array [{id, value}]
    if (d.custom_fields && Object.keys(d.custom_fields).length) {
      payload.custom_fields = Object.entries(d.custom_fields)
        .filter(([_, v]) => v !== '' && v != null)
        .map(([id, value]) => ({ id, value }));
    }

    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (data.ok) {
        // Persiste o registro local também
        if (window.ExecutionTaskStore) {
          ExecutionTaskStore.create({
            linked_action_id: m.actionId,
            title: payload.name,
            description: payload.description,
            status: 'pending',
            provider: 'clickup',
            provider_task_id: data.providerTaskId,
            external_url: data.externalUrl
          });
        }
        App.state.taskCreationModal = null;
        App.save(); App.render();
        Utils.toast(`✓ Task criada no ClickUp${data.externalUrl ? '. Clique no toast pra abrir.' : '.'}`);
      } else {
        App.state.taskCreationModal = { ...m, submitting: false };
        App.render();
        Utils.toast(`Falhou: ${data.message || 'erro desconhecido'}`);
      }
    } catch (err) {
      App.state.taskCreationModal = { ...m, submitting: false };
      App.render();
      Utils.toast(`Erro de rede: ${err.message}`);
    }
  },

  // V32.7.3 (Geraldo A5) — Cliente reconhece o risco de deletar a raiz LJ.
  // Marca ack vinculado ao rootId atual. Se ele trocar de raiz depois, modal
  // aparece de novo (risco renovado).
  acknowledgeClickupDeleteWarning() {
    const rootId = App.state.clickupStatus?.rootId || App.state.clickupStatus?.ljSpaceId || null;
    if (!rootId) return;
    App.state.clickupDeleteWarningAck = {
      rootId: String(rootId),
      ackAt: new Date().toISOString()
    };
    App.save(); App.render();
  },

  // V32.7.0 — Pull subtasks reais do ClickUp via mapping cascado.
  // ClickUp = source of truth no step 6 (substitui ExecutionTaskStore que era
  // frágil — multi-aba, snapshot restore, race condition do sync remoto
  // faziam tasks sumirem).
  //
  // Aceita actionIds explícitos OU pega todas conectadas a OKRs do produto atual.
  // silent=true pula toast (auto-call no abrir do step). Default false (manual).
  async pullClickupActionSubtasks(actionIds = null, silent = false) {
    if (!App.state.clickupStatus?.connected) {
      if (!silent) Utils.toast('ClickUp não conectado.');
      return;
    }
    // Se não passou actionIds, pega todas as ações conectadas a algum OKR do produto.
    if (!Array.isArray(actionIds) || !actionIds.length) {
      const productId = App.state.strategicMapProductId;
      const campaignId = App.state.strategicMapCampaignId;
      const source = (campaignId && window.StrategicMapEngine?.getBranchMap)
        ? (StrategicMapEngine.getBranchMap(campaignId) || { objectives: [] })
        : (productId && StrategicMapEngine.getForProduct(productId)) || { objectives: [] };
      const ids = new Set();
      (source.objectives || []).forEach(o => (o.okrs || []).forEach(kr => {
        (kr.connectedActionIds || []).forEach(id => ids.add(Number(id)));
      }));
      actionIds = Array.from(ids).filter(Boolean);
    }
    if (!actionIds.length) {
      if (!silent) Utils.toast('Nenhuma ação conectada pra puxar tasks.');
      return;
    }
    const cache = App.state.clickupActionSubtasks || { byActionId: {}, fetchedAt: null };
    cache.loading = true;
    App.state.clickupActionSubtasks = cache;
    App.render();
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-pull-action-subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action_ids: actionIds })
      });
      const data = await r.json();
      if (!data.ok) {
        cache.loading = false;
        App.state.clickupActionSubtasks = cache;
        App.render();
        if (!silent) Utils.toast(`Falha: ${data.message}`);
        return;
      }
      // Merge: mantém entries antigas que não vieram no response (caso request parcial)
      const merged = { ...(cache.byActionId || {}), ...(data.subtasksByAction || {}) };
      App.state.clickupActionSubtasks = {
        byActionId: merged,
        fetchedAt: new Date().toISOString(),
        loading: false,
        rootKind: data.rootKind || null,
        skipped: data.skipped || null
      };
      // V32.9.0 — Subtasks frescas chegaram → recomputa strategicStatus de
      // todas as ações dessa pull. Continuity loop: ClickUp → cache → engine
      // → action.strategicStatus → UI do step 4 (As Ações) reflete realidade
      // sem cliente fazer nada manual.
      if (window.StrategicStatusEngine && actionIds.length) {
        let changed = 0;
        actionIds.forEach(aid => {
          if (StrategicStatusEngine.recompute(aid) !== null) changed++;
        });
        if (changed > 0 && !silent) {
          Utils.toast(`✓ ${changed} ação(ões) tiveram status atualizado pelo ClickUp.`);
        }
      }
      App.save(); App.render();
      if (!silent) {
        const totalSubs = Object.values(data.subtasksByAction || {}).reduce((sum, arr) => sum + arr.length, 0);
        Utils.toast(`✓ ${totalSubs} subtask(s) puxada(s) do ClickUp.`);
      }
    } catch (err) {
      cache.loading = false;
      App.state.clickupActionSubtasks = cache;
      App.render();
      if (!silent) Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.6.9 — Sync status das tasks do ClickUp. Itera ExecutionTaskStore,
  // pega provider_task_ids da provider='clickup', POST pro endpoint que
  // retorna status atual de cada uma. Atualiza store local in-place.
  //
  // Mapping ClickUp → LJ:
  //   statusType='closed' → status LJ 'completed'
  //   statusType='open' + status contém 'progress'/'doing' → 'in_progress'
  //   resto → 'pending'
  //
  // silent=true pula toast (uso em auto-sync). Default false (uso manual).
  async syncClickupTaskStatuses(silent = false) {
    if (!window.ExecutionTaskStore) return;
    if (!App.state.clickupStatus?.connected) {
      if (!silent) Utils.toast('ClickUp não conectado.');
      return;
    }
    const tasks = ExecutionTaskStore.all().filter(t => t.provider === 'clickup' && t.provider_task_id);
    if (!tasks.length) return;
    const taskIds = tasks.map(t => t.provider_task_id);
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-pull-task-statuses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ task_ids: taskIds })
      });
      const data = await r.json();
      if (!data.ok) {
        if (!silent) Utils.toast(`Falha sync: ${data.message}`);
        return;
      }
      // Aplica updates no store local
      let updatedCount = 0;
      for (const task of tasks) {
        const remote = data.statuses?.[task.provider_task_id];
        if (!remote || remote.error) continue;
        const newStatus = this._mapClickupStatusToLj(remote);
        if (newStatus && newStatus !== task.status) {
          ExecutionTaskStore.setStatus(task.task_id, newStatus);
          updatedCount++;
        }
      }
      if (updatedCount > 0) {
        App.save(); App.render();
        if (!silent) Utils.toast(`✓ ${updatedCount} task(s) atualizada(s) do ClickUp.`);
      } else if (!silent) {
        Utils.toast('Tudo sincronizado — nenhuma task mudou status.');
      }
    } catch (err) {
      if (!silent) Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.6.9 — Helper interno: mapping ClickUp status → LJ status.
  _mapClickupStatusToLj(remote) {
    if (!remote) return null;
    if (remote.statusType === 'closed') return 'completed';
    const s = String(remote.status || '').toLowerCase();
    if (remote.statusType === 'open' && (s.includes('progress') || s.includes('doing') || s.includes('andamento'))) {
      return 'in_progress';
    }
    return 'pending';
  },

  // V31.2.29 — Conexão via Personal API Token. Substitui o flow OAuth na UI.
  updateClickupPatDraft(value) {
    App.state.clickupPatDraft = String(value || '');
  },

  async connectClickupWithPAT() {
    const pat = String(App.state.clickupPatDraft || '').trim();
    if (!pat) return Utils.toast('Cole o Personal API Token primeiro.');
    if (!pat.startsWith('pk_')) return Utils.toast('Token inválido — Personal API Token do ClickUp começa com "pk_".');
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-connect-pat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pat })
      });
      const data = await r.json();
      if (data.ok) {
        App.state.clickupPatDraft = '';
        Utils.toast(`✓ Conectado ao workspace "${data.workspaceName || '—'}".`);
        await Actions.loadClickupStatus();
      } else {
        Utils.toast(`Falhou: ${data.message || 'erro desconhecido'}`);
      }
    } catch (err) { Utils.toast(`Erro de rede: ${err.message}`); }
  },

  async connectClickup() {
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-oauth-init', {
        method: 'GET', headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      if (data.ok && data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer');
        Utils.toast('Aguarde autorização no ClickUp...');
        // Pollar status a cada 2s por até 60s pra detectar quando conecta
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          await Actions.loadClickupStatus();
          if (App.state.clickupStatus?.connected || attempts >= 30) clearInterval(poll);
        }, 2000);
      } else {
        Utils.toast(`Erro: ${data.message}`);
      }
    } catch (err) { Utils.toast(`Erro: ${err.message}`); }
  },

  async disconnectClickup() {
    if (!confirm('Tem certeza que quer desconectar o ClickUp?')) return;
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-config', {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      if (data.ok) {
        Utils.toast('ClickUp desconectado.');
        await Actions.loadClickupStatus();
      } else {
        Utils.toast(`Erro: ${data.message}`);
      }
    } catch (err) { Utils.toast(`Erro: ${err.message}`); }
  },

  // V32.4.3 — Revela o PAT do ClickUp salvo (descriptografa do DB).
  // Use case: cliente já colou PAT antes + ClickUp mascarou (não dá pra copiar
  // de novo) + ele quer plugar mesmo PAT em outra integração sem regenerar.
  async revealClickupPat() {
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-reveal-pat', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      if (!data.ok) return Utils.toast(`Erro: ${data.message || 'falha'}`);

      // Mostra o token em prompt nativo — user dá Ctrl+A, Ctrl+C, fecha.
      // Prompt seleciona o conteúdo todo automaticamente em chrome/firefox.
      window.prompt(
        `Personal API Token do ClickUp (workspace: ${data.workspaceName || '—'})\n\n` +
        `Selecione (Ctrl+A) e copie (Ctrl+C). Trate como senha — não compartilhe em telas/repos.`,
        data.token
      );
      // Audit hint no console pro user saber que a action rolou
      console.log('[clickup-reveal-pat] PAT revelado em prompt. Token NÃO persiste em log.');
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // V32.5.6 — Tabs OAuth | PAT no card ClickUp em Configurações → Integrações.
  // Cliente escolhe método de conexão. Backend já suporta os 2 via token_type.
  setClickupConnectTab(tab) {
    App.state.clickupConnectTab = (tab === 'pat') ? 'pat' : 'oauth';
    App.save(); App.render();
  },

  // V32.5.6 — Draft do form OAuth (Client ID + Client Secret). Não chama render
  // pra não perder foco do input enquanto digita (padrão dos outros drafts).
  updateClickupOAuthDraftField(field, value) {
    App.state.clickupOAuthDraft = App.state.clickupOAuthDraft || { clientId: '', clientSecret: '' };
    App.state.clickupOAuthDraft[field] = String(value || '');
    App.save();
  },

  // V32.5.8 — Toggle do <details> "Configurações avançadas" no card ClickUp.
  // <details> HTML nativo perde o atributo `open` em todo innerHTML re-render
  // (App.render dispara isso). Cliente percebia como "fecha sozinho". Persistir
  // em state sobrevive re-renders.
  toggleClickupAdvanced() {
    App.state.clickupAdvancedOpen = !App.state.clickupAdvancedOpen;
    App.save(); App.render();
  },

  // V32.5.6 — Salva Client ID/Secret do OAuth App em clickup_config (criptografado
  // no backend via lib/clickup-crypto). Depois disso o user pode clicar
  // "Autorizar no ClickUp" pra abrir a janela OAuth — fluxo handled em
  // Actions.connectClickup() (linha 6152, já existente desde V30).
  async saveClickupOAuthConfig() {
    const draft = App.state.clickupOAuthDraft || {};
    const clientId = String(draft.clientId || '').trim();
    const clientSecret = String(draft.clientSecret || '').trim();
    if (!clientId || !clientSecret) return Utils.toast('Client ID e Client Secret obrigatórios.');
    // V32.6.3 — Guard: browser autofill costuma colocar email no Client ID.
    // Client ID do ClickUp OAuth App tem ~32 chars hexadecimais. Bloqueia.
    if (/@/.test(clientId)) {
      return Utils.toast('Client ID parece um email (autopreenchido pelo browser). Apague e cole o Client ID real do OAuth App.');
    }
    if (clientId.length < 10) {
      return Utils.toast('Client ID muito curto. Confere se você copiou o valor inteiro do OAuth App no ClickUp.');
    }
    try {
      const token = localStorage.getItem('lj_jwt');
      const r = await fetch('/api/clickup-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret })
      });
      const data = await r.json();
      if (data.ok) {
        Utils.toast('✓ Credenciais salvas. Clique em "Autorizar no ClickUp" pra prosseguir.');
        App.state.clickupOAuthDraft = { clientId: '', clientSecret: '' };
        await Actions.loadClickupStatus();
      } else {
        Utils.toast(`Erro: ${data.message}`);
      }
    } catch (err) { Utils.toast(`Erro: ${err.message}`); }
  },

  // V30.0.0 — Proxy genérico pra chamar ClickUp API do frontend (sem expor token).
  async clickupApi(method, path, body) {
    const token = localStorage.getItem('lj_jwt');
    const r = await fetch('/api/clickup-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ method, path, body })
    });
    return r.json();
  },

  // V30.0.0 — Abre o modal de criar task. Recebe contexto (KR/ação) e pré-preenche.
  openCreateClickupTaskModal(seedContext) {
    // V32.1.7 — Pré-seleciona a default_list_id configurada (Geraldo safe).
    // User pode trocar via dropdown se quiser override.
    const defaultListId = App.state.clickupStatus?.defaultListId || '';
    App.state.createClickupTaskModal = {
      open: true,
      loading: true,
      loadError: null,
      expanded: false,
      lists: [],
      users: [],
      seedContext: seedContext || null,
      draft: {
        list_id: defaultListId,
        name: seedContext?.suggestedName || '',
        description: seedContext?.suggestedDescription || '',
        priority: 3,
        due_date: seedContext?.suggestedDueDate || '',
        assignees: [],
        tags: []
      }
    };
    App.render();
    // Carrega lists + users do ClickUp em paralelo.
    (async () => {
      try {
        const teamsRes = await Actions.clickupApi('GET', '/team', null);
        const teams = teamsRes?.data?.teams || [];
        if (!teams.length) throw new Error('Nenhum workspace encontrado.');
        const teamId = teams[0].id;
        const [lists, users] = await Promise.all([
          Actions._loadAllClickupLists(teamId),
          Actions._loadClickupTeamMembers(teamId)
        ]);
        if (App.state.createClickupTaskModal) {
          App.state.createClickupTaskModal.lists = lists;
          App.state.createClickupTaskModal.users = users;
          App.state.createClickupTaskModal.loading = false;
          App.render();
        }
      } catch (err) {
        if (App.state.createClickupTaskModal) {
          App.state.createClickupTaskModal.loading = false;
          App.state.createClickupTaskModal.loadError = err.message || 'Falha ao carregar dados do ClickUp.';
          App.render();
        }
      }
    })();
  },

  // V30.0.0 — Walka a hierarquia Workspace > Space > (Folder >) List e retorna flat list
  // com labels "Space > Folder > List" ou "Space > List".
  async _loadAllClickupLists(teamId) {
    const spacesRes = await Actions.clickupApi('GET', `/team/${teamId}/space`, null);
    const spaces = spacesRes?.data?.spaces || [];
    const all = [];
    await Promise.all(spaces.map(async space => {
      const [folderlessRes, foldersRes] = await Promise.all([
        Actions.clickupApi('GET', `/space/${space.id}/list`, null),
        Actions.clickupApi('GET', `/space/${space.id}/folder`, null)
      ]);
      (folderlessRes?.data?.lists || []).forEach(l => {
        all.push({ id: l.id, label: `${space.name} > ${l.name}` });
      });
      const folders = foldersRes?.data?.folders || [];
      await Promise.all(folders.map(async folder => {
        const listsRes = await Actions.clickupApi('GET', `/folder/${folder.id}/list`, null);
        (listsRes?.data?.lists || []).forEach(l => {
          all.push({ id: l.id, label: `${space.name} > ${folder.name} > ${l.name}` });
        });
      }));
    }));
    all.sort((a, b) => a.label.localeCompare(b.label));
    return all;
  },

  async _loadClickupTeamMembers(teamId) {
    const r = await Actions.clickupApi('GET', `/team/${teamId}/member`, null);
    const members = r?.data?.members || [];
    return members.map(m => ({
      id: m.user?.id || m.id,
      username: m.user?.username || m.username || '—',
      email: m.user?.email || m.email || ''
    }));
  },

  closeCreateClickupTaskModal() {
    App.state.createClickupTaskModal = null;
    App.render();
  },

  updateClickupTaskField(field, value) {
    if (!App.state.createClickupTaskModal) return;
    App.state.createClickupTaskModal.draft = { ...App.state.createClickupTaskModal.draft, [field]: value };
  },

  toggleClickupTaskExpanded() {
    if (!App.state.createClickupTaskModal) return;
    App.state.createClickupTaskModal.expanded = !App.state.createClickupTaskModal.expanded;
    App.render();
  },

  toggleClickupAssignee(userId) {
    const m = App.state.createClickupTaskModal;
    if (!m) return;
    const uid = Number(userId);
    const arr = Array.isArray(m.draft.assignees) ? m.draft.assignees.slice() : [];
    const idx = arr.indexOf(uid);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(uid);
    m.draft.assignees = arr;
    App.render();
  },

  updateClickupTaskTags(rawValue) {
    const m = App.state.createClickupTaskModal;
    if (!m) return;
    m.draft.tags = String(rawValue || '').split(',').map(t => t.trim()).filter(Boolean);
  },

  // V32.1.7 + V32.2.1 — Modal manual passa pelo /api/clickup-create-task com
  // mirror_context resolvido (igual Djow). Guards V32.1.4-1.6 + hierarquia
  // V32.2.0 aplicados.
  async submitClickupTask() {
    const m = App.state.createClickupTaskModal;
    if (!m) return;
    const d = m.draft;
    if (!d.name) return Utils.toast('Título obrigatório.');

    const status = App.state.clickupStatus || {};
    const mirrorOn = Boolean(status.ljSpaceId) && status.mirrorEnabled !== false;

    // V32.2.1 — Resolve mirror_context a partir de seedContext.actionId (vem do
    // botão "Criar tarefa via Djow" no Mapa da Receita). Sem seedContext, modal
    // tá em modo "standalone" — só funciona se mirror desativado OU se cliente
    // selecionou list_id explícito + cair no fallback.
    let mirror_context = null;
    if (mirrorOn && m.seedContext?.actionId) {
      const actionId = Number(m.seedContext.actionId);
      const action = (App.state.actions || []).find(a => Number(a.id) === actionId);
      if (action) {
        const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId));
        const product = campaign ? (App.state.products || []).find(p => Number(p.id) === Number(campaign.productId)) : null;
        if (campaign && product) {
          mirror_context = {
            product: { id: product.id, name: product.name },
            campaign: { id: campaign.id, name: campaign.name },
            action: { id: action.id, name: action.name }
          };
        }
      }
    }

    // V32.2.1 — Standalone sem mirror_context: bloqueia se mirror ON
    // (sem actionId, LJ não sabe onde criar na hierarquia espelhada).
    if (mirrorOn && !mirror_context && !d.list_id) {
      return Utils.toast('Modo espelhado ativo: abra esta task pelo Mapa da Receita (botão "Criar tarefa" em uma ação específica) pra LJ resolver a hierarquia.');
    }

    if (!mirror_context && !d.list_id) {
      return Utils.toast('Escolha a Lista no ClickUp.');
    }

    const token = localStorage.getItem('lj_jwt');
    const body = {
      name: d.name,
      description: d.description,
      priority: Number(d.priority) || 3,
      due_date: d.due_date ? new Date(d.due_date).getTime() : undefined,
      assignees: d.assignees,
      tags: d.tags,
      mirror_context  // V32.2.1 — null se modo legado/standalone, populated se from Mapa
    };
    // Só manda list_id se NÃO tem mirror (mirror resolve list sozinho)
    if (!mirror_context && d.list_id) body.list_id = d.list_id;

    // V32.2.3 (Geraldo A4) — Feedback durante create. Em mirror em workspace
    // virgem pode demorar 2-4s criando folder+list+task pai. Antes era silêncio.
    if (mirror_context) {
      Utils.toast('Espelhando hierarquia no ClickUp...');
    }

    try {
      const res = await fetch('/api/clickup-create-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.ok) {
        const mirrorMsg = data.mirror?.createdAny
          ? ' · estrutura espelhada atualizada'
          : '';
        Utils.toast(`✓ Tarefa criada no ClickUp${mirrorMsg}${data.externalUrl ? ' · clique pra abrir' : ''}`);
        App.state.createClickupTaskModal = null;
        App.save(); App.render();
        if (data.externalUrl) window.open(data.externalUrl, '_blank', 'noopener,noreferrer');
      } else if (data.code === 'clickup_read_only') {
        Utils.toast('ClickUp em modo somente-leitura — task NÃO criada. Reative em Configurações → ClickUp.');
      } else if (data.code === 'no_default_list') {
        Utils.toast('Configure a list de destino padrão em Configurações → ClickUp antes de criar tasks.');
      } else if (data.step === 'mirror_resolve') {
        Utils.toast(`Falha na hierarquia espelhada: ${data.message}`);
      } else {
        Utils.toast(`Erro: ${data.message || 'falha desconhecida'}`);
      }
    } catch (err) {
      Utils.toast(`Erro: ${err.message}`);
    }
  },

  // Refinar via Djow: abre o chat Djow com a sugestão de modificar a task que o user tá editando.
  openDjowFromClickupModal() {
    const m = App.state.createClickupTaskModal;
    if (!m) return;
    const d = m.draft;
    const seed = `Djow, ajuda a refinar essa tarefa que vou criar no ClickUp:
Título: ${d.name}
Descrição: ${d.description}
Prazo: ${d.due_date || 'sem prazo'}
Prioridade: ${d.priority}

[me sugere melhorias e me ajuda a ajustar]`;
    App.state.djowInput = seed;
    Actions.openDjowAIModal();
  },

  // V29.0.0 — Troca a branch ativa dentro do Mapa (switcher no header).
  switchStrategicBranch(campaignId) {
    Actions.openStrategicMapForCampaign(Number(campaignId));
  },

  // V31.2.25 — Abre o modal de detalhe da ação operacional inline no Mapa.
  // Substitui o redirect pro menu Ações que existia quando clicava em pill.
  openStrategicActionDetail(actionId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return Utils.toast('Ação não encontrada.');
    App.state.strategicActionDetailModalId = Number(actionId);
    App.render();
  },

  closeStrategicActionDetail() {
    App.state.strategicActionDetailModalId = null;
    App.render();
  },

  // V31.2.25 — Editar ação a partir do modal de detalhe: fecha o detalhe e
  // delega pro ActionEditModal já existente. Reusa toda a engine de edição.
  editActionFromDetail(actionId) {
    App.state.strategicActionDetailModalId = null;
    if (typeof this.openActionEditModal === 'function') this.openActionEditModal(actionId);
    else App.render();
  },

  // V31.2.25 — Desplugar: remove a ação de TODOS os childKrs que ela toca
  // (across todas as branches do produto). Mantém o Action record + tasks +
  // leads — só remove os vínculos. Confirma antes listando os KRs afetados.
  desplugActionFromDetail(actionId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return Utils.toast('Ação não encontrada.');
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId));
    const productId = campaign?.productId || App.state.strategicMapProductId;
    if (!productId) return Utils.toast('Produto não encontrado.');
    const branches = StrategicMapEngine.getBranchesByProduct(productId) || [];
    const linked = [];
    branches.forEach(b => {
      const c = (App.state.campaigns || []).find(x => Number(x.id) === Number(b.campaignId));
      (b.objectives || []).forEach(o => {
        (o.okrs || []).forEach(kr => {
          if ((kr.connectedActionIds || []).map(Number).includes(Number(actionId))) {
            linked.push({ branch: b, objective: o, kr, campaign: c });
          }
        });
      });
    });
    if (!linked.length) return Utils.toast('Ação já está desplugada.');
    const msg = `Vai DESPLUGAR a ação "${action.name}".\n\n` +
      `Você vai perder a contribuição dela pros seguintes KRs:\n` +
      linked.map(l => `  • ${l.kr.name} (campanha "${l.campaign?.name || '—'}")`).join('\n') +
      `\n\nA ação continua existindo (você pode replugar depois). Confirma?`;
    if (!confirm(msg)) return;
    linked.forEach(({ objective, kr, branch }) => {
      if (window.StrategicOkrEngine) {
        StrategicOkrEngine.toggleAction(productId, objective.id, kr.id, Number(actionId), branch.campaignId);
      }
    });
    App.save(); App.render();
    Utils.toast(`Ação "${action.name}" desplugada de ${linked.length} KR(s).`);
  },

  // V31.2.25 — Deletar ação. Só permite se desplugada (linkedKrs vazio).
  // Senão alerta pra desplugar primeiro. Quando deletar, remove o Action +
  // todas tasks de execução vinculadas. Operação irreversível.
  deleteActionFromDetail(actionId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return Utils.toast('Ação não encontrada.');
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId));
    const productId = campaign?.productId || App.state.strategicMapProductId;
    let connectedCount = 0;
    if (productId) {
      const branches = StrategicMapEngine.getBranchesByProduct(productId) || [];
      branches.forEach(b => {
        (b.objectives || []).forEach(o => {
          (o.okrs || []).forEach(kr => {
            if ((kr.connectedActionIds || []).map(Number).includes(Number(actionId))) connectedCount++;
          });
        });
      });
    }
    if (connectedCount > 0) {
      alert(
        `Não dá pra deletar "${action.name}" enquanto estiver plugada (${connectedCount} KR(s)).\n\n` +
        `Pra deletar:\n  1) Clique em "Desplugar" pra remover de todos os KRs\n  2) Depois clique em "Deletar"\n\n` +
        `Motivo: deletar uma ação plugada apaga toda a contribuição dela (leads, score) dos KRs que ela alimenta. Essa proteção evita que dados estratégicos sumam sem aviso.`
      );
      return;
    }
    const tasksCount = (window.ExecutionTaskStore?.byAction(actionId) || []).length;
    const leadsCount = (action.leads || []).length;
    const ok = confirm(
      `DELETAR PERMANENTEMENTE a ação "${action.name}"?\n\n` +
      `Isso vai apagar:\n` +
      `  • A ação\n` +
      `  • ${tasksCount} task(s) de execução\n` +
      `  • ${leadsCount} lead(s) vinculados\n\n` +
      `Esta operação é IRREVERSÍVEL. Confirma?`
    );
    if (!ok) return;
    App.state.executionTasks = (App.state.executionTasks || []).filter(t => Number(t.linked_action_id) !== Number(actionId));
    App.state.actions = (App.state.actions || []).filter(a => Number(a.id) !== Number(actionId));
    App.state.strategicActionDetailModalId = null;
    App.save(); App.render();
    Utils.toast(`Ação "${action.name}" deletada.`);
  },

  // V31.1.0 — Abre ação operacional desde o Mapa da Receita (caminho inverso).
  // Fecha o Mapa, navega pra aba Ações de Campanha, seleciona a campanha + ação.
  openActionFromMap(actionId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return Utils.toast('Ação não encontrada.');
    App.state.showStrategicMap = false;
    App.state.selectedActionId = Number(actionId);
    App.state.selectedCampaignId = action.campaignId;
    App.state.activeTab = 'actions';
    App.save(); App.render();
  },

  // V31.1.0 — Wizard "Conectar ao Mapa da Receita" (Frente → KR-mãe → Confirmar).
  // Plug uma ação operacional (do menu Ações de Campanha) num KR-mãe do produto.
  openConnectActionToMapa(actionId) {
    if (this._demoGuard && this._demoGuard('Conectar ao Mapa')) return;
    App.state.connectActionWizard = { open: true, actionId: Number(actionId), step: 1, areaId: null, productKrId: null };
    App.render();
  },
  closeConnectWizard() {
    App.state.connectActionWizard = null;
    App.render();
  },
  connectWizardPickArea(areaId) {
    if (!App.state.connectActionWizard) return;
    App.state.connectActionWizard.areaId = String(areaId);
    App.state.connectActionWizard.productKrId = null; // reset se trocou de área
    App.render();
  },
  connectWizardPickProductKr(productKrId) {
    if (!App.state.connectActionWizard) return;
    App.state.connectActionWizard.productKrId = String(productKrId);
    App.render();
  },
  connectWizardNext() {
    const wiz = App.state.connectActionWizard;
    if (!wiz) return;
    if (wiz.step === 1 && !wiz.areaId) return Utils.toast('Escolha uma frente comercial.');
    if (wiz.step === 2 && !wiz.productKrId) return Utils.toast('Escolha um KR-mãe.');
    wiz.step = Math.min(wiz.step + 1, 3);
    App.render();
  },
  connectWizardBack() {
    const wiz = App.state.connectActionWizard;
    if (!wiz) return;
    wiz.step = Math.max(wiz.step - 1, 1);
    App.render();
  },
  connectWizardConfirm() {
    const wiz = App.state.connectActionWizard;
    if (!wiz) return;
    const { actionId, areaId, productKrId } = wiz;
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return Utils.toast('Ação não encontrada.');
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId));
    if (!campaign || !campaign.productId) return Utils.toast('Campanha sem produto vinculado.');
    const productId = Number(campaign.productId);
    const map = window.StrategicMapEngine?.getForProduct(productId);
    const productKr = (map?.productKrs || []).find(k => k.id === productKrId);
    if (!productKr) return Utils.toast('KR-mãe não encontrado.');

    // 1. Set strategic fields na ação
    action.strategicAreaId = areaId;
    action.strategicOwner = (window.StrategicMapEngine?.getAreaOwner && StrategicMapEngine.getAreaOwner(productId, areaId)) || '';
    action.strategicStatus = action.strategicStatus || 'planned';
    action.strategicConfirmed = true;
    action.strategicCadence = action.strategicCadence || null;
    action.strategicCatalogId = action.strategicCatalogId || null;
    action.strategicDescription = action.strategicDescription || '';

    // 2. Ensure branch (strategicCampaignMap) pra essa campanha
    let branch = window.StrategicMapEngine?.getBranchMap(campaign.id);
    if (!branch) {
      branch = window.StrategicMapEngine?.ensureBranchMap(campaign.id, productId);
    }
    if (!branch) return Utils.toast('Falha ao criar branch da campanha.');

    // 3. Ensure objective (frente) dentro da branch
    branch.objectives = branch.objectives || [];
    let objective = branch.objectives.find(o => o.area === areaId);
    if (!objective) {
      const areaDef = (window.StrategicMapEngine?.COMERCIAL_AREAS || []).find(a => a.id === areaId);
      objective = {
        id: `obj_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        label: areaDef?.label || areaId,
        area: areaId,
        owner: action.strategicOwner,
        deadline: '',
        okrs: [],
        createdAt: new Date().toISOString()
      };
      branch.objectives.push(objective);
    }

    // 4. Ensure child KR com parentProductKrId = productKr.id
    let childKr = (objective.okrs || []).find(k => k.parentProductKrId === productKr.id);
    if (!childKr) {
      childKr = {
        id: `okr_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        name: productKr.name,
        metric: productKr.metric || 'quantidade',
        catalogId: productKr.catalogId || null,
        isHandoff: false,
        current: 0,
        targetCommitted: productKr.targetCommitted ?? productKr.target ?? null,
        targetStretch: productKr.targetStretch ?? null,
        period: productKr.period || 90,
        confirmed: false,
        connectedActionIds: [],
        parentProductKrId: productKr.id
      };
      objective.okrs = [...(objective.okrs || []), childKr];
    }

    // 5. Add action.id ao connectedActionIds (idempotente)
    const ids = new Set((childKr.connectedActionIds || []).map(Number));
    ids.add(Number(action.id));
    childKr.connectedActionIds = Array.from(ids);

    // 6. Persiste e fecha
    branch.updatedAt = new Date().toISOString();
    App.state.strategicCampaignMaps = { ...(App.state.strategicCampaignMaps || {}), [campaign.id]: branch };
    App.state.connectActionWizard = null;
    App.save(); App.render();
    Utils.toast(`Ação plugada em ${productKr.name}. Retângulo azul ativado.`);
  },

  // V31.2.10 — Tabs Mkt/Vendas/CS na etapa "Os Números do Produto".
  setStrategicNumberAreaTab(areaId) {
    App.state.strategicNumberAreaTab = String(areaId);
    App.state.strategicOkrDraft = null; // limpa draft ao trocar de aba
    App.render();
  },

  // V31.2.10 — Inicia o wizard 7-passos pra criar productKr custom numa área.
  // Reutiliza _okrDraftCard (existente) marcando draft.area pra rotear no save.
  startStrategicProductKrDraft(areaId) {
    if (this._demoGuard && this._demoGuard('Criar KR-mãe customizado')) return;
    App.state.strategicOkrDraft = {
      area: String(areaId),        // V29 marker: salva como productKr
      name: '',
      metric: 'quantidade',
      target: 0,
      current: 0,
      startValue: 0,
      owner: '',
      deadline: '',
      impact: '',
      commitmentType: 'stretch',
      connectedActionIds: [],
      wizardStep: 1
    };
    App.render();
  },

  // V31.2.21 — "Abrir no Mapa" do retângulo azul (_strategicTag) leva direto
  // pra etapa 5 "Ações" da campanha da ação, NÃO mais pra etapa 4 hub.
  openActionOnMap(productId, actionId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return Utils.toast('Ação não encontrada.');
    const campaignId = Number(action.campaignId);
    if (!campaignId) return Utils.toast('Ação sem campanha.');
    // Abre na branch da campanha + etapa Ações
    Actions.openStrategicMapForCampaign(campaignId);
    setTimeout(() => {
      if (window.StrategicZoomNavigation) StrategicZoomNavigation.set('operations');
      App.state.strategicActiveArea = action.strategicAreaId || null;
      App.state.strategicSkipOnboarding = true;
      App.save(); App.render();
    }, 50);
  },

  // V31.2.20 — Modal-on-modal "Ver ações plugadas": mini-dashboard + lista
  // de ações conectadas a um KR-mãe (across todas branches do produto).
  openPluggedActionsModal(pkrId) {
    App.state.pluggedActionsModal = { open: true, pkrId };
    App.render();
  },
  closePluggedActionsModal() {
    App.state.pluggedActionsModal = null;
    App.render();
  },

  // V31.2.21 — Modal "Conectar ação a KRs" (pra ação já existente, sem KR vinculado).
  openConnectActionToKrsModal(actionId) {
    if (this._demoGuard && this._demoGuard('Conectar ação a KRs')) return;
    App.state.connectActionToKrsModal = { open: true, actionId: Number(actionId), selectedKrIds: [] };
    App.render();
  },
  closeConnectActionToKrsModal() {
    App.state.connectActionToKrsModal = null;
    App.render();
  },
  toggleConnectActionKr(krId) {
    const m = App.state.connectActionToKrsModal;
    if (!m) return;
    const list = Array.isArray(m.selectedKrIds) ? m.selectedKrIds.slice() : [];
    const idx = list.indexOf(krId);
    if (idx >= 0) list.splice(idx, 1); else list.push(krId);
    App.state.connectActionToKrsModal = { ...m, selectedKrIds: list };
    App.render();
  },
  confirmConnectActionToKrs() {
    const m = App.state.connectActionToKrsModal;
    if (!m) return;
    if (!m.selectedKrIds || !m.selectedKrIds.length) return Utils.toast('Marque pelo menos um KR.');
    const productId = App.state.strategicMapProductId;
    const campaignId = App.state.strategicMapCampaignId;
    if (!productId || !campaignId) return Utils.toast('Sem branch ativa.');
    const branch = StrategicMapEngine.getBranchMap(campaignId);
    if (!branch) return Utils.toast('Branch não encontrada.');
    // Pra cada KR marcado: garante childKr na branch (se não tem) e adiciona action.id em connectedActionIds
    m.selectedKrIds.forEach(krId => {
      const pkr = StrategicMapEngine.getProductKrs(productId).find(k => k.id === krId);
      if (!pkr) return;
      const objective = (branch.objectives || []).find(o => o.area === pkr.area);
      if (!objective) return;
      let childKr = (objective.okrs || []).find(k => k.parentProductKrId === krId);
      if (!childKr) {
        // Cria childKr na branch herdando do pkr
        const newId = `okr_${Date.now()}_${Math.floor(Math.random()*1000)}`;
        childKr = {
          id: newId,
          name: pkr.name,
          metric: pkr.metric,
          catalogId: pkr.catalogId,
          isHandoff: Boolean(pkr.isHandoff),
          current: pkr.current != null ? Number(pkr.current) : null,
          targetCommitted: pkr.targetCommitted != null ? Number(pkr.targetCommitted) : null,
          targetStretch: pkr.targetStretch != null ? Number(pkr.targetStretch) : null,
          period: pkr.period || 90,
          confirmed: false,
          connectedActionIds: [],
          parentProductKrId: pkr.id
        };
        objective.okrs = [...(objective.okrs || []), childKr];
      }
      // Adiciona action.id (idempotente)
      const ids = new Set((childKr.connectedActionIds || []).map(Number));
      ids.add(Number(m.actionId));
      childKr.connectedActionIds = Array.from(ids);
    });
    branch.updatedAt = new Date().toISOString();
    App.state.strategicCampaignMaps = { ...(App.state.strategicCampaignMaps || {}), [campaignId]: branch };
    App.state.connectActionToKrsModal = null;
    App.save(); App.render();
    Utils.toast(`Ação conectada a ${m.selectedKrIds.length} KR(s).`);
  },

  // V31.2.21 — Editar ação a partir do Mapa: reusa Actions.openActionEditModal existente.
  openEditActionFromMap(actionId) {
    if (typeof this.openActionEditModal === 'function') return this.openActionEditModal(actionId);
  },

  // V29.3.0 — Abre a engine de criação de ação custom no contexto de um KR.
  // V31.2.18 — Adicionado selectedKrIds (multi-select). Pre-marca o KR de origem.
  openCustomActionEngine(areaId, parentProductKrId) {
    const productId = App.state.strategicMapProductId;
    const productKr = StrategicMapEngine.getProductKrs(productId).find(k => k.id === parentProductKrId);
    App.state.customActionEngine = {
      open: true,
      areaId,
      parentProductKrId,
      selectedKrIds: parentProductKrId ? [parentProductKrId] : [],
      originKrCatalogId: productKr?.catalogId || null,
      name: '',
      funnelPoint: '',          // 'TOF' | 'MOF' | 'BOF'
      destSector: areaId,        // default: mesma área
      destFunnelPoint: '',
      channel: '',
      channelOther: ''
    };
    App.render();
  },

  // V31.2.18 — Marca/desmarca um KR da lista de OKRs que essa ação vai mover.
  // V31.2.19 — Se tentar DESMARCAR o KR de origem (parentProductKrId), confirma
  // antes via popup. Se confirmar retirada, o frame da engine fica vermelho com
  // aviso pedindo pra remarcar o KR original (não bloqueia mas avisa o usuário
  // que os KRs ficaram desfigurados da verdade).
  toggleCustomActionEngineKr(krId) {
    const eng = App.state.customActionEngine;
    if (!eng) return;
    const list = Array.isArray(eng.selectedKrIds) ? eng.selectedKrIds.slice() : [];
    const idx = list.indexOf(krId);
    const isRemoving = idx >= 0;
    const isOriginKr = String(krId) === String(eng.parentProductKrId);
    if (isRemoving && isOriginKr) {
      const ok = confirm(
        'Esse KR é o do lugar onde você abriu a engine — ele é o destino "óbvio" dessa ação.\n\n' +
        'Se você retirar, os KRs ficam desfigurados da verdade (a ação que nasceu pra cobrir esse número vai mover outros). ' +
        'Tem certeza que quer desmarcar?'
      );
      if (!ok) return;
    }
    if (isRemoving) list.splice(idx, 1); else list.push(krId);
    App.state.customActionEngine = { ...eng, selectedKrIds: list };
    App.render();
  },

  updateCustomActionEngineField(field, value) {
    if (!App.state.customActionEngine) return;
    App.state.customActionEngine = { ...App.state.customActionEngine, [field]: value };
  },

  closeCustomActionEngine() {
    App.state.customActionEngine = null;
    App.render();
  },

  // V31.2.22 — "Criar" agora SÓ adiciona ao catálogo (sem plugar).
  // Os KRs marcados na engine ficam guardados em pendingKrTargets pra serem
  // usados quando o user clicar "Plugar" no chip em "Como cobrir esse número?".
  // V31.2.24 — Suporta edit mode: se eng.editingCustomId, atualiza o catálogo
  // em vez de criar novo (toggle via Actions.editCoverageChip).
  createCustomAction() {
    const eng = App.state.customActionEngine;
    if (!eng) return;
    const name = String(eng.name || '').trim();
    if (!name) return Utils.toast('Dê um nome à ação.');
    if (!eng.funnelPoint) return Utils.toast('Escolha onde a ação começa.');
    if (!eng.destSector || !eng.destFunnelPoint) return Utils.toast('Escolha pra onde a ação leva.');
    if (!eng.channel) return Utils.toast('Escolha o canal.');
    const productId = App.state.strategicMapProductId;
    const finalChannel = eng.channel === 'Outro' && eng.channelOther ? `Outro: ${String(eng.channelOther).trim()}` : eng.channel;
    const pendingKrTargets = Array.isArray(eng.selectedKrIds) && eng.selectedKrIds.length
      ? eng.selectedKrIds.slice()
      : (eng.parentProductKrId ? [eng.parentProductKrId] : []);
    // V31.2.24 — Edit mode: atualiza catálogo direto e propaga p/ Actions já plugados.
    if (eng.editingCustomId) {
      const existing = (App.state.customActionCatalog || []).find(c => c.id === eng.editingCustomId);
      if (!existing) return Utils.toast('Ação não encontrada no catálogo.');
      // Dedup: outro custom com mesmo nome (case-insensitive) que NÃO seja o editado
      const dup = (App.state.customActionCatalog || []).find(c =>
        c.id !== eng.editingCustomId && String(c.name).toLowerCase() === name.toLowerCase()
      );
      if (dup) return Utils.toast(`Já existe outra ação custom chamada "${dup.name}".`);
      App.state.customActionCatalog = (App.state.customActionCatalog || []).map(c => c.id === eng.editingCustomId ? ({
        ...c,
        name,
        sector: eng.areaId,
        funnel: eng.funnelPoint,
        destinationSector: eng.destSector,
        destinationFunnel: eng.destFunnelPoint,
        channel: finalChannel,
        pendingKrTargets
      }) : c);
      // Propaga pros Actions já criados dessa custom (name + channel visíveis na UI)
      App.state.actions = (App.state.actions || []).map(a => a.strategicCustomActionId === eng.editingCustomId ? ({
        ...a, name, channel: finalChannel
      }) : a);
      App.state.customActionEngine = null;
      App.state.coverageChipSelected = eng.editingCustomId;
      App.save(); App.render();
      return Utils.toast(`Ação "${name}" atualizada.`);
    }
    const result = StrategicMapEngine.addCustomAction({
      name,
      sector: eng.areaId,
      funnel: eng.funnelPoint,
      destinationSector: eng.destSector,
      destinationFunnel: eng.destFunnelPoint,
      channel: finalChannel,
      actionType: 'Outro',
      originProductId: productId,
      originKrCatalogId: eng.originKrCatalogId,
      pendingKrTargets
    });
    if (!result.ok) return Utils.toast(result.error);
    // V31.2.22 — Sobrescreve pendingKrTargets também no caso "revived" (já existia).
    if (result.revived) {
      App.state.customActionCatalog = (App.state.customActionCatalog || []).map(c =>
        c.id === result.action.id ? { ...c, pendingKrTargets } : c
      );
    }
    App.state.customActionEngine = null;
    // Pré-seleciona a chip recém-criada pra abrir a barra Plugar/Desplugar.
    App.state.coverageChipSelected = result.action.id;
    App.save(); App.render();
    Utils.toast(result.revived
      ? `✨ Ação "${result.action.name}" já existia. Selecione em "Como cobrir" + Plugar.`
      : `Ação custom "${name}" criada. Selecione em "Como cobrir" + Plugar.`);
  },

  // V29.3.0 — Ativa custom action já existente no catálogo (clicando no chip).
  activateExistingCustomAction(areaId, customActionId, parentProductKrId) {
    const productId = App.state.strategicMapProductId;
    const result = StrategicMapEngine.activateCustomAction(productId, areaId, customActionId, parentProductKrId);
    if (result?.error) return Utils.toast(result.error);
    App.save(); App.render();
    Utils.toast('Ação plugada.');
  },

  // V31.2.23 — Expande o card plugado pra mostrar engine + chips. Default
  // dos cards plugados é colapsado (visual igual aos desplugados, só com pills).
  // Auto-abre a engine ao expandir (matches "+ Criar ação" mental model).
  expandPluggedKrCard(areaId, pkrId) {
    App.state.strategicKrCardOpen = { ...(App.state.strategicKrCardOpen || {}), [pkrId]: true };
    this.openCustomActionEngine(areaId, pkrId);
  },

  // V31.2.23 — Recolhe o card plugado (fecha engine + limpa seleção de chip).
  collapsePluggedKrCard(pkrId) {
    App.state.strategicKrCardOpen = { ...(App.state.strategicKrCardOpen || {}), [pkrId]: false };
    if (App.state.customActionEngine && App.state.customActionEngine.parentProductKrId === pkrId) {
      App.state.customActionEngine = null;
    }
    App.state.coverageChipSelected = null;
    App.render();
  },

  // V31.2.24 — Abre a engine em modo edição pré-preenchida com os campos da
  // custom selecionada. Salvar atualiza o catálogo (e propaga name/channel
  // pros Actions já plugados dessa custom).
  editCoverageChip(customId, areaId, parentProductKrId) {
    const custom = (App.state.customActionCatalog || []).find(c => c.id === customId);
    if (!custom) return Utils.toast('Ação não encontrada.');
    const isOutro = String(custom.channel || '').startsWith('Outro:');
    App.state.customActionEngine = {
      open: true,
      editingCustomId: customId,
      areaId: areaId || custom.sector,
      parentProductKrId: parentProductKrId || (Array.isArray(custom.pendingKrTargets) ? custom.pendingKrTargets[0] : null),
      selectedKrIds: Array.isArray(custom.pendingKrTargets) ? custom.pendingKrTargets.slice() : (parentProductKrId ? [parentProductKrId] : []),
      originKrCatalogId: custom.origin?.krCatalogId || null,
      name: custom.name || '',
      funnelPoint: custom.funnel || '',
      destSector: custom.destinationSector || custom.sector || '',
      destFunnelPoint: custom.destinationFunnel || '',
      channel: isOutro ? 'Outro' : (custom.channel || ''),
      channelOther: isOutro ? String(custom.channel).slice('Outro:'.length).trim() : ''
    };
    // Garante que o card do KR atual está expandido pra engine ficar visível
    if (parentProductKrId) {
      App.state.strategicKrCardOpen = { ...(App.state.strategicKrCardOpen || {}), [parentProductKrId]: true };
    }
    App.state.coverageChipSelected = null;
    App.render();
  },

  // V31.2.22 — Seleciona/deseleciona uma chip custom em "Como cobrir esse número?".
  // Antes a chip ativava direto; agora seleciona pra mostrar Plugar/Desplugar.
  toggleCoverageChip(customId) {
    const current = App.state.coverageChipSelected;
    App.state.coverageChipSelected = (current === customId ? null : customId);
    App.render();
  },

  // V31.2.22 — Pluga a custom selecionada. Usa pendingKrTargets do catálogo
  // (KRs que o user marcou na engine quando criou). Idempotente: se já tinha
  // sido plugada antes nesta campanha, só vincula KRs faltantes ao Action existente.
  plugCoverageChip(customId, areaId, parentProductKrId) {
    const productId = App.state.strategicMapProductId;
    const campaignId = App.state.strategicMapCampaignId;
    const custom = (App.state.customActionCatalog || []).find(c => c.id === customId);
    if (!custom) return Utils.toast('Ação custom não encontrada.');
    const targets = (Array.isArray(custom.pendingKrTargets) && custom.pendingKrTargets.length)
      ? custom.pendingKrTargets.slice()
      : [parentProductKrId];
    // Se já existe um Action record dessa custom nesta campanha, reusa em vez de duplicar.
    const existing = (App.state.actions || []).find(a =>
      a.strategicCustomActionId === customId && Number(a.campaignId) === Number(campaignId)
    );
    if (existing) {
      const branch = StrategicMapEngine.getBranchMap(campaignId);
      let linkedNow = 0;
      targets.forEach(parentKrId => {
        if (!parentKrId) return;
        (branch?.objectives || []).forEach(obj => {
          (obj.okrs || []).forEach(kr => {
            if (kr.parentProductKrId !== parentKrId) return;
            const linked = (kr.connectedActionIds || []).map(Number).includes(Number(existing.id));
            if (!linked && window.StrategicOkrEngine) {
              StrategicOkrEngine.toggleAction(productId, obj.id, kr.id, existing.id, campaignId);
              linkedNow++;
            }
          });
        });
      });
      App.state.coverageChipSelected = null;
      App.state.customActionEngine = null;
      App.state.strategicKrCardOpen = { ...(App.state.strategicKrCardOpen || {}), [parentProductKrId]: false };
      App.save(); App.render();
      Utils.toast(linkedNow ? `Ação "${custom.name}" plugada em mais ${linkedNow} KR(s).` : `Ação "${custom.name}" já estava plugada nestes KR(s).`);
      return;
    }
    // Primeiro plug: cria Action record + vincula a todos os KRs em targets.
    let actionId = null;
    let activationError = null;
    targets.forEach((krId, idx) => {
      if (!krId) return;
      if (idx === 0) {
        const act = StrategicMapEngine.activateCustomAction(productId, areaId, customId, krId, campaignId);
        if (act?.error) { activationError = act.error; return; }
        actionId = act?.action?.id;
      } else if (actionId && window.StrategicOkrEngine) {
        const branch = StrategicMapEngine.getBranchMap(campaignId);
        (branch?.objectives || []).forEach(obj => {
          (obj.okrs || []).forEach(kr => {
            if (kr.parentProductKrId === krId && !(kr.connectedActionIds || []).map(Number).includes(Number(actionId))) {
              StrategicOkrEngine.toggleAction(productId, obj.id, kr.id, actionId, campaignId);
            }
          });
        });
      }
    });
    if (activationError) return Utils.toast(activationError);
    App.state.coverageChipSelected = null;
    App.state.customActionEngine = null;
    App.state.strategicKrCardOpen = { ...(App.state.strategicKrCardOpen || {}), [parentProductKrId]: false };
    App.save(); App.render();
    Utils.toast(`Ação "${custom.name}" plugada em ${targets.length} KR(s).`);
  },

  // V31.2.22 — Desconecta TODOS os Actions desta custom na campanha atual:
  // remove vínculos com KRs (toggleAction off) + remove os registros de App.state.actions.
  // V31.2.23 — Colapsa o card do parentProductKrId após desplugar.
  unplugCoverageChip(customId, areaId, parentProductKrId) {
    const productId = App.state.strategicMapProductId;
    const campaignId = App.state.strategicMapCampaignId;
    const matching = (App.state.actions || []).filter(a =>
      a.strategicCustomActionId === customId && Number(a.campaignId) === Number(campaignId)
    );
    if (!matching.length) {
      App.state.coverageChipSelected = null;
      App.render();
      return Utils.toast('Essa ação não está plugada nesta campanha.');
    }
    const branch = StrategicMapEngine.getBranchMap(campaignId);
    matching.forEach(action => {
      if (branch && window.StrategicOkrEngine) {
        (branch.objectives || []).forEach(obj => {
          (obj.okrs || []).forEach(kr => {
            if ((kr.connectedActionIds || []).map(Number).includes(Number(action.id))) {
              StrategicOkrEngine.toggleAction(productId, obj.id, kr.id, action.id, campaignId);
            }
          });
        });
      }
      App.state.actions = (App.state.actions || []).filter(a => Number(a.id) !== Number(action.id));
    });
    App.state.coverageChipSelected = null;
    if (parentProductKrId) {
      App.state.strategicKrCardOpen = { ...(App.state.strategicKrCardOpen || {}), [parentProductKrId]: false };
    }
    App.save(); App.render();
    Utils.toast(`Ação desplugada (${matching.length} registro(s) removido(s)).`);
  },

  // V29.3.0 — Toggle balão de ajuda (?) inline nas metas.
  toggleStrategicMetaHelp(key) {
    const current = App.state.strategicMetaHelpOpen || {};
    App.state.strategicMetaHelpOpen = { ...current, [key]: !current[key] };
    App.render();
  },

  // V29.2.0 — Hub etapa 4: gestor clica "Seguir" numa campanha →
  // troca branch ativa + avança stepper pra etapa 5 (trabalho unificado).
  selectAndAdvanceCampaign(campaignId) {
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    if (!campaign) return;
    App.state.strategicMapProductId = Number(campaign.productId);
    App.state.strategicMapCampaignId = Number(campaignId);
    App.state.strategicMapMode = 'campaign';
    if (window.StrategicMapEngine) {
      StrategicMapEngine.ensureBranchMap(Number(campaignId), Number(campaign.productId));
      StrategicMapEngine.ensureComercialAreas(Number(campaign.productId), Number(campaignId));
    }
    // V32.5.2 (Leonardo) — Hand-off da etapa 4 (campaign) → 5 (operations).
    // Esta action é a única forma de transição 4→5; advanceStrategicStep não
    // passa por aqui, então injetamos hand-off direto.
    if (window.DjowStrategicAssistant) {
      DjowStrategicAssistant.append(Number(campaign.productId), {
        role: 'transition',
        text: `✓ Campanha "${campaign.name}" selecionada. Pluge os números aqui e ative as ações que vão cobrir.`,
        thermal: 'orange',
        ts: new Date().toISOString()
      });
    }
    App.state.strategicMapZoom = 'operations';
    App.save(); App.render();
    Utils.toast(`Editando ${campaign.name}. Pluga os números e ações.`);
  },

  // V29.1.3 — "Executar Métricas" = publicar KRs-mãe pros gestores.
  // Botão dourado do CEO. Antes desse botão, KRs-mãe ficam como rascunho do CEO.
  // Abre popup de confirmação (com lista de campanhas plugadas/desplugadas).
  // Se já foi executado antes, abre popup informando + opção de re-publicar (que sobrescreve).
  executeStrategicMetrics() {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicMapEngine) return;
    const productKrs = StrategicMapEngine.getProductKrs(productId);
    if (!productKrs.length) return Utils.toast('Adicione pelo menos 1 KR-mãe antes de executar.');
    App.state.strategicExecuteMetricsPopup = true;
    App.render();
    // V29.1.4 — Scroll container do Mapa pro topo pra garantir que popup
    // (centralizado dentro do container scrollable) fica visível na viewport.
    setTimeout(() => {
      const c = document.getElementById('strategicMapScrollContainer');
      if (c) c.scrollTop = 0;
    }, 50);
  },

  // V29.1.3 — Confirma a publicação: marca timestamp + notifica branches via Djow lateral.
  confirmExecuteMetrics() {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicMapEngine) return;
    const wasAlreadyExecuted = StrategicMapEngine.isMetricsExecuted(productId);
    StrategicMapEngine.markMetricsExecuted(productId);
    // Notifica todas as branches via chat lateral do Djow.
    const branches = StrategicMapEngine.getBranchesByProduct(productId);
    if (window.DjowStrategicAssistant) {
      const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
      const productKrs = StrategicMapEngine.getProductKrs(productId);
      const msg = wasAlreadyExecuted
        ? `🔄 CEO atualizou os números do produto "${product?.name || ''}" (${productKrs.length} KR-mãe). Revise se sua campanha precisa plugar números novos.`
        : `🎯 CEO publicou os números do produto "${product?.name || ''}" (${productKrs.length} KR-mãe). Vá pra etapa Campanha do Mapa e pluga os que sua campanha vai contribuir.`;
      branches.forEach(b => {
        DjowStrategicAssistant.append(productId, { role: 'agent', text: msg, ts: new Date().toISOString() });
      });
    }
    App.state.strategicExecuteMetricsPopup = false;
    App.save(); App.render();
    Utils.toast(wasAlreadyExecuted ? '🔄 Métricas re-publicadas. Gestores notificados.' : '🎯 Métricas publicadas. Gestores notificados.');
  },

  dismissExecuteMetricsPopup() {
    App.state.strategicExecuteMetricsPopup = false;
    App.render();
  },

  // V29.1.3 — Destrava o CEO pra trabalhar como gestor de uma branch.
  // V29.1.4 — Sem campanha: modal pra criar nova.
  // V29.2.1 — Smart routing:
  //   - 0 campanhas do produto → modal criar nova
  //   - 1 campanha (plugada ou não) → assume essa, ativa Mapa se preciso, abre direto
  //   - 2+ campanhas → popup pra escolher qual
  unlockCeoAsGestor() {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicMapEngine) return;
    const allCampaigns = (App.state.campaigns || []).filter(c => Number(c.productId) === Number(productId));
    if (!allCampaigns.length) {
      // Cenário A: nenhuma campanha no produto → modal criar.
      App.state.strategicCreateCampaignPopup = { newName: '' };
      App.render();
      setTimeout(() => {
        const c = document.getElementById('strategicMapScrollContainer');
        if (c) c.scrollTop = 0;
      }, 50);
      return;
    }
    if (allCampaigns.length === 1) {
      // Cenário B/C: 1 campanha só → ativa Mapa nela (se precisar) + abre como gestor.
      const only = allCampaigns[0];
      const branch = StrategicMapEngine.getBranchMap(only.id);
      if (!branch) {
        // Não plugada ainda — ativa Mapa direto (cria branch).
        Actions.activateStrategicMapForCampaign(only.id);
      } else {
        // Já plugada — abre como gestor direto.
        Utils.toast(`Editando ${only.name} como Gestor.`);
        Actions.openStrategicMapForCampaign(only.id);
      }
      return;
    }
    // Cenário D: 2+ campanhas → popup escolher.
    App.state.strategicUnlockCeoPopup = true;
    App.render();
    setTimeout(() => {
      const c = document.getElementById('strategicMapScrollContainer');
      if (c) c.scrollTop = 0;
    }, 50);
  },

  // V29.1.4 — Cria campanha nova, vincula ao produto, ativa Mapa (cria branch),
  // e abre direto como gestor.
  createCampaignAndUnlockAsGestor() {
    const draft = App.state.strategicCreateCampaignPopup;
    if (!draft) return;
    const productId = App.state.strategicMapProductId;
    const name = String(draft.newName || '').trim();
    if (!name) return Utils.toast('Dê um nome à campanha.');
    if (!productId) return Utils.toast('Produto não selecionado.');
    const campaign = {
      id: Date.now() + Math.floor(Math.random() * 100),
      productId: Number(productId),
      name,
      objective: '',
      createdAt: new Date().toISOString()
    };
    App.state.campaigns = [campaign, ...(App.state.campaigns || [])];
    App.state.strategicCreateCampaignPopup = null;
    App.save();
    // Ativa Mapa nessa campanha (cria branch) e abre como gestor.
    Actions.activateStrategicMapForCampaign(campaign.id);
  },

  updateStrategicCreateCampaignDraft(field, value) {
    const current = App.state.strategicCreateCampaignPopup || {};
    App.state.strategicCreateCampaignPopup = { ...current, [field]: value };
  },

  dismissStrategicCreateCampaignPopup() {
    App.state.strategicCreateCampaignPopup = null;
    App.render();
  },

  // V29.1.3 — Confirma destravagem e abre branch como gestor.
  // V29.2.1 — Se campanha escolhida não tem branch ainda, ativa Mapa nela primeiro.
  confirmUnlockCeoAsGestor(campaignId) {
    App.state.strategicUnlockCeoPopup = false;
    App.save(); App.render();
    const branch = StrategicMapEngine.getBranchMap(Number(campaignId));
    if (!branch) {
      Utils.toast('🔓 Ativando Mapa nesta campanha e editando como Gestor.');
      Actions.activateStrategicMapForCampaign(Number(campaignId));
    } else {
      Utils.toast('🔓 Você está editando como Gestor. Lembre-se: idealmente este trabalho é do dono da campanha.');
      Actions.openStrategicMapForCampaign(Number(campaignId));
    }
  },

  dismissUnlockCeoPopup() {
    App.state.strategicUnlockCeoPopup = false;
    App.render();
  },

  // V29.0.0 — Adiciona um KR-mãe no produto (vista CEO).
  // V31.2.11 — Inicia em estado editing (confirmed=false). Vira confirmed só
  // após user preencher Meta Segura + Meta Avançada e clicar "Confirmar número".
  addProductKrAction(productId, area, catalogId) {
    if (!productId || !window.StrategicMapEngine) return;
    if (this._demoGuard && this._demoGuard('Adicionar KR-mãe')) return;
    const kpi = (StrategicMapEngine.KPI_CATALOG[area] || []).find(k => k.id === catalogId);
    if (!kpi) return Utils.toast('KPI não encontrado.');
    const existing = StrategicMapEngine.getProductKrs(productId).find(k => k.area === area && k.catalogId === catalogId);
    if (existing) return Utils.toast('Este KR-mãe já existe.');
    StrategicMapEngine.addProductKr(productId, {
      area, catalogId,
      name: kpi.name,
      metric: kpi.metric,
      catalogDescription: kpi.description || '',
      isHandoff: Boolean(kpi.handoff),
      current: null,
      targetCommitted: null,
      targetStretch: null,
      period: 90,
      owner: '',
      confirmed: false
    }, 'ceo');
    App.save(); App.render();
    Utils.toast(`KR-mãe "${kpi.name}" ativado. Preencha Atual + Meta Segura + Meta Avançada e confirme.`);
  },

  // V31.2.12 — Modal "Ativar KPI do catálogo": abre janela com 3 inputs (atual,
  // meta segura, meta avançada). Sem período. Confirma → cria productKr com
  // confirmed:true direto, sem etapa intermediária de edição inline.
  openActivateCatalogKrModal(productId, area, catalogId) {
    if (this._demoGuard && this._demoGuard('Ativar KR-mãe do catálogo')) return;
    App.state.activateCatalogKrModal = {
      open: true,
      productId: Number(productId),
      area: String(area),
      catalogId: String(catalogId),
      current: '',
      targetCommitted: '',
      targetStretch: ''
    };
    App.render();
  },
  closeActivateCatalogKrModal() {
    App.state.activateCatalogKrModal = null;
    App.render();
  },
  updateActivateCatalogKrModalField(field, value) {
    if (!App.state.activateCatalogKrModal) return;
    App.state.activateCatalogKrModal[field] = value;
  },
  confirmActivateCatalogKr() {
    const m = App.state.activateCatalogKrModal;
    if (!m || !m.open) return;
    if (!window.StrategicMapEngine) return;
    // KPI pode estar no catálogo curado OU no aprendido (customKpiCatalog)
    const curated = (StrategicMapEngine.KPI_CATALOG[m.area] || []).find(k => k.id === m.catalogId);
    const learned = ((App.state.customKpiCatalog || {})[m.area] || []).find(k => k.id === m.catalogId);
    const kpi = curated || learned;
    if (!kpi) return Utils.toast('KPI não encontrado.');
    const existing = StrategicMapEngine.getProductKrs(m.productId).find(k => k.area === m.area && k.catalogId === m.catalogId);
    if (existing) return Utils.toast('Este KR-mãe já existe.');
    StrategicMapEngine.addProductKr(m.productId, {
      area: m.area,
      catalogId: m.catalogId,
      name: kpi.name,
      metric: kpi.metric,
      catalogDescription: kpi.description || '',
      isHandoff: Boolean(kpi.handoff),
      current: m.current !== '' ? Number(m.current) : null,
      targetCommitted: m.targetCommitted !== '' ? Number(m.targetCommitted) : null,
      targetStretch: m.targetStretch !== '' ? Number(m.targetStretch) : null,
      period: 90,
      owner: '',
      confirmed: true
    }, 'ceo');
    App.state.activateCatalogKrModal = null;
    App.save(); App.render();
    Utils.toast(`✓ "${kpi.name}" confirmado em ${m.area}.`);
  },

  // V31.2.12 — Modal "Criar KR-mãe customizado": 5 inputs (nome, unidade,
  // atual, segura, avançada). Sem período. Confirma → cria productKr +
  // adiciona ao customKpiCatalog[area] (base de conhecimento aprendida).
  openCreateCustomKrModal(productId, area) {
    if (this._demoGuard && this._demoGuard('Criar KR-mãe customizado')) return;
    App.state.createCustomKrModal = {
      open: true,
      productId: Number(productId),
      area: String(area),
      name: '',
      metric: 'quantidade',
      current: '',
      targetCommitted: '',
      targetStretch: ''
    };
    App.render();
  },
  closeCreateCustomKrModal() {
    App.state.createCustomKrModal = null;
    App.render();
  },
  updateCreateCustomKrModalField(field, value) {
    if (!App.state.createCustomKrModal) return;
    App.state.createCustomKrModal[field] = value;
    // V31.2.13 — Trocar unidade re-renderiza pra refletir prefix/suffix nos inputs.
    if (field === 'metric') App.render();
  },
  confirmCreateCustomKr() {
    const m = App.state.createCustomKrModal;
    if (!m || !m.open) return;
    const name = String(m.name || '').trim();
    if (!name) return Utils.toast('Digite o nome do KR-mãe.');
    if (!window.StrategicMapEngine) return;
    // 1. Adiciona ao customKpiCatalog (base de conhecimento global)
    const learnedKpi = StrategicMapEngine.addCustomKpiToCatalog(m.area, {
      name,
      metric: m.metric || 'quantidade',
      description: `Custom criado em ${m.area}`,
      handoff: false
    });
    // 2. Cria productKr no produto atual já confirmed
    StrategicMapEngine.addProductKr(m.productId, {
      area: m.area,
      catalogId: learnedKpi ? learnedKpi.id : null,
      name,
      metric: m.metric || 'quantidade',
      catalogDescription: `Custom (aprendido) em ${m.area}`,
      isHandoff: false,
      current: m.current !== '' ? Number(m.current) : null,
      targetCommitted: m.targetCommitted !== '' ? Number(m.targetCommitted) : null,
      targetStretch: m.targetStretch !== '' ? Number(m.targetStretch) : null,
      period: 90,
      owner: '',
      confirmed: true
    }, 'ceo');
    App.state.createCustomKrModal = null;
    App.save(); App.render();
    Utils.toast(`✓ "${name}" criado e adicionado à base de conhecimento de ${m.area}.`);
  },

  // V31.2.11 — Confirma o KR-mãe (estado editing → confirmed verde).
  // Exige Meta Segura e Meta Avançada preenchidas pra confirmar.
  confirmProductKr(productId, krId) {
    if (!productId || !window.StrategicMapEngine) return;
    const kr = StrategicMapEngine.getProductKrs(productId).find(k => k.id === krId);
    if (!kr) return Utils.toast('KR-mãe não encontrado.');
    const hasSafe = Number(kr.targetCommitted || 0) > 0;
    const hasAdv = Number(kr.targetStretch || 0) > 0;
    if (!hasSafe || !hasAdv) return Utils.toast('Preencha Meta Segura E Meta Avançada antes de confirmar.');
    StrategicMapEngine.updateProductKr(productId, krId, { confirmed: true });
    App.save(); App.render();
    Utils.toast(`✓ Número confirmado.`);
  },

  // V31.2.11 — Volta KR confirmado pra estado editing (pra ajustar).
  editProductKr(productId, krId) {
    if (!productId || !window.StrategicMapEngine) return;
    StrategicMapEngine.updateProductKr(productId, krId, { confirmed: false });
    App.save(); App.render();
  },

  // V29.0.0 — Edita campo do KR-mãe.
  // V31.2.11 — Adicionado 'current' aos campos numéricos.
  updateProductKrField(productId, krId, field, value) {
    if (!productId || !window.StrategicMapEngine) return;
    const numericFields = ['current', 'targetCommitted', 'targetStretch', 'period'];
    const patch = {};
    if (numericFields.includes(field)) {
      patch[field] = (value === '' || value === null || value === undefined) ? null : Number(value);
    } else {
      patch[field] = String(value || '');
    }
    StrategicMapEngine.updateProductKr(productId, krId, patch);
    App.save();
  },

  // V29.0.1 — Dono compartilhado da área (Marketing/Vendas/CS) — mesmo across branches.
  setStrategicAreaOwner(productId, areaId, owner) {
    if (!productId || !window.StrategicMapEngine) return;
    // V32.4.4 — Re-render só na transição "todos preenchidos ↔ algum vazio"
    // pra habilitar/desabilitar o botão "Próximo passo" sem perder foco do input.
    const areas = StrategicMapEngine.COMERCIAL_AREAS || [];
    const wasAllSet = areas.every(a => String(StrategicMapEngine.getAreaOwner(productId, a.id) || '').trim());
    StrategicMapEngine.setAreaOwner(productId, areaId, owner);
    App.save();
    const isAllSet = areas.every(a => String(StrategicMapEngine.getAreaOwner(productId, a.id) || '').trim());
    if (wasAllSet !== isAllSet) App.render();
  },

  // V29.0.1 — L (top-down): gestor confirma plugar um KR-mãe que o CEO criou,
  // criando o filho correspondente na branch atual com defaults do catálogo.
  // V29.1.0 — Aceita metas opcionais (D2): plugar + definir meta na mesma tela.
  plugProductKrIntoBranch(productKrId, opts) {
    const productId = App.state.strategicMapProductId;
    const campaignId = App.state.strategicMapCampaignId;
    if (!productId || !campaignId || !window.StrategicMapEngine) return;
    const pkr = (StrategicMapEngine.getProductKrs(productId)).find(k => k.id === productKrId);
    if (!pkr) return Utils.toast('KR-mãe não encontrado.');
    const objective = StrategicMapEngine.getObjectiveByArea(productId, pkr.area, campaignId);
    if (!objective || !window.StrategicOkrEngine) return Utils.toast('Frente não encontrada nesta branch.');
    const kpi = (StrategicMapEngine.KPI_CATALOG[pkr.area] || []).find(k => k.id === pkr.catalogId);
    const o = opts || {};
    // V31.2.17 — Default-fill com valores do pkr-mãe. Antes vinha tudo null (placeholder
    // "piso"/"sonho"). Agora a contribuição da campanha começa igualada à meta-mãe;
    // gestor ajusta pra refletir o pedaço real que essa campanha vai entregar.
    StrategicOkrEngine.add(productId, objective.id, {
      name: pkr.name,
      metric: pkr.metric,
      catalogId: pkr.catalogId,
      catalogDescription: kpi?.description || '',
      isHandoff: Boolean(kpi?.handoff),
      current: o.current != null ? Number(o.current) : (pkr.current != null ? Number(pkr.current) : null),
      targetCommitted: o.targetCommitted != null ? Number(o.targetCommitted) : (pkr.targetCommitted != null ? Number(pkr.targetCommitted) : null),
      targetStretch: o.targetStretch != null ? Number(o.targetStretch) : (pkr.targetStretch != null ? Number(pkr.targetStretch) : null),
      period: o.period != null ? Number(o.period) : 90,
      confirmed: false,
      parentProductKrId: pkr.id
    }, campaignId);
    App.save(); App.render();
    Utils.toast(`"${pkr.name}" plugado nesta campanha (metas herdadas do KR-mãe — ajuste se necessário).`);
  },

  // V29.0.0 — Remove KR-mãe (e desvincula filhas).
  removeProductKrAction(productId, krId) {
    if (!productId || !window.StrategicMapEngine) return;
    StrategicMapEngine.removeProductKr(productId, krId);
    App.save(); App.render();
    Utils.toast('KR-mãe removido. Filhas viraram órfãs.');
  },

  // V28.4.1 — Renomeia a campanha estratégica via UI no header da etapa Ações.
  renameStrategicCampaignAction(newName) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicMapEngine) return;
    const clean = String(newName || '').trim();
    if (!clean) return Utils.toast('Nome não pode ficar vazio.');
    const ok = StrategicMapEngine.renameStrategicCampaign(productId, clean);
    if (ok) {
      App.save(); App.render();
      Utils.toast('Campanha renomeada.');
    }
  },

  // V28.3.0 — Edita campo de uma ação estratégica (dono / cadência / status).
  updateStrategicActionField(actionId, field, value) {
    if (!actionId) return;
    App.state.actions = (App.state.actions || []).map(a =>
      Number(a.id) === Number(actionId) ? { ...a, [field]: (typeof value === 'string' ? value : value) } : a
    );
    App.save();
    if (field === 'strategicStatus' || field === 'strategicCadence') App.render();
  },

  // V28.3.0 — Confirma uma ação (valida que tem dono e cadência).
  // V32.6.6 — Após confirmar, auto-foca na PRÓXIMA ação pendente da mesma frente.
  confirmStrategicAcao(actionId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return;
    if (!String(action.strategicOwner || '').trim()) return Utils.toast('Defina o dono da ação antes de confirmar.');
    if (!action.strategicCadence) return Utils.toast('Defina a cadência da ação antes de confirmar.');
    App.state.actions = (App.state.actions || []).map(a =>
      Number(a.id) === Number(actionId) ? { ...a, strategicConfirmed: true, strategicStatus: a.strategicStatus || 'planned' } : a
    );
    // V32.6.6 — Auto-foca na próxima pendente da mesma frente (campaign + area).
    // Reduz "e agora?" — cliente já vê a próxima decisão exposta.
    const sameFrenteNextPending = (App.state.actions || []).find(a =>
      Number(a.id) !== Number(actionId)
      && Number(a.campaignId) === Number(action.campaignId)
      && a.strategicAreaId === action.strategicAreaId
      && !a.strategicConfirmed
    );
    App.state.strategicActiveActionId = sameFrenteNextPending ? Number(sameFrenteNextPending.id) : null;
    App.save(); App.render();
    Utils.toast(sameFrenteNextPending ? 'Ação confirmada. Próxima pendente em foco.' : 'Ação confirmada. Frente fechada.');
  },

  // V28.3.0 — Reabre uma ação confirmada pra edição.
  // V32.6.6 — Reabrir = trazer pro foco também.
  editStrategicAcao(actionId) {
    App.state.actions = (App.state.actions || []).map(a =>
      Number(a.id) === Number(actionId) ? { ...a, strategicConfirmed: false } : a
    );
    App.state.strategicActiveActionId = Number(actionId);
    App.save(); App.render();
  },

  // V32.6.6 — Coloca uma ação pendente em foco (a anterior fecha automaticamente
  // porque só 1 active por vez). Click no card collapsed dispara isso.
  setStrategicActiveAction(actionId) {
    App.state.strategicActiveActionId = actionId ? Number(actionId) : null;
    App.save(); App.render();
  },

  // V28.3.0 — Remove uma ação estratégica: tira de App.state.actions
  // E remove o vínculo de todos os KRs que apontavam pra ela.
  removeStrategicCatalogAction(actionId) {
    const productId = App.state.strategicMapProductId;
    if (!productId) return;
    const numId = Number(actionId);
    App.state.actions = (App.state.actions || []).filter(a => Number(a.id) !== numId);
    // Limpa connectedActionIds em todos os KRs do produto.
    const map = StrategicMapEngine.getForProduct(productId);
    const objectives = (map?.objectives || []).map(o => ({
      ...o,
      okrs: (o.okrs || []).map(kr => ({
        ...kr,
        connectedActionIds: (kr.connectedActionIds || []).filter(id => Number(id) !== numId)
      }))
    }));
    StrategicMapEngine.save(productId, { objectives });
    App.save(); App.render();
    Utils.toast('Ação removida.');
  },

  // V28.2.1 — Reabre um número confirmado pra edição.
  editStrategicNumero(objectiveId, okrId) {
    const productId = App.state.strategicMapProductId;
    if (!productId || !window.StrategicOkrEngine) return;
    StrategicOkrEngine.update(productId, objectiveId, okrId, { confirmed: false });
    App.save(); App.render();
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
