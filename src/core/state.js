var State = {
  initialActionDraft() {
    return {
      campaignId: null,
      name: '',
      channel: 'Instagram Orgânico',
      actionType: 'Post',
      sector: 'Marketing',
      funnel: 'MOF',
      originSector: 'Marketing',
      originFunnel: 'MOF',
      destinationSector: 'Marketing',
      destinationFunnel: 'MOF',
      objective: '',
      conversionObjective: '',
      expectedConversion: 0,
      okrs: OkrSuggestionEngine.defaultFor('Marketing', 'MOF', 'Instagram Orgânico', 'Post'),
      mailingDefined: false,
      leadInputMode: 'manual',
      leadsText: '',
      rdListName: '',
      scoreId: null,
      rdEmailConfig: window.RDConfig ? RDConfig.emailDefaults() : {},
      kpis: []
    };
  },
  initial() {
    return {
      activeTab: 'home', // V25.0.0 — aba Início como default
      showSettingsModal: false,
      // V32.4.0 (Geraldo Item 6) — default 'myAccount' (V11 'database' removida)
      settingsActiveSection: 'myAccount',
      // V32.4.0 — databaseConfig vira {} vazio (compat). Campos railwayX*,
      // databaseTesting, showDatabaseTutorial removidos junto com feature V11.
      integrations: {
        rd: window.RDConfig ? RDConfig.defaultConfig() : {},
        rdCrm: window.RdCrmConfig ? RdCrmConfig.defaultConfig() : {}
      },
      rdCrmLeadTags: {},
      // V31.2.35 — Campos ClickUp esquecidos: clickupStatus + clickupMeta sumiam
      // a cada normalize() porque não estavam declarados. Resultado: user perdia
      // a UI de "Conectado" toda vez que atualizávamos. Inicializa aqui pra
      // preservar no normalize() abaixo.
      // V32.1.3 — clickupStatus expandido com info da list selecionada explicitamente
      // (defaultListId/Name/SpaceId). Substitui auto-discovery do V31.2.32.
      // V32.1.4-1.6 — também ljTagName + taskPrefix + statusMap + writeEnabled.
      // V32.2.0 — também ljSpaceId + mirrorEnabled (hierarquia espelhada).
      // V32.5.6 — tokenType ('oauth' | 'pat' | null) propaga do backend pra UI
      // diferenciar visualmente o método de conexão e habilitar/desabilitar
      // "Revelar PAT" (só faz sentido em token_type='pat').
      clickupStatus: { connected: false, configured: false, encryptionReady: true, workspaceName: null, tokenType: null, defaultListId: null, defaultListName: null, defaultSpaceId: null, ljTagName: null, taskPrefix: null, statusMap: null, writeEnabled: true, ljSpaceId: null, mirrorEnabled: true, rootId: null, rootKind: null, rootName: null },
      clickupMeta: { loaded: false, loadedAt: null, workspaceId: null, listId: null, spaceId: null, members: [], statuses: [], tags: [], customFields: [] },
      // V32.9.2 (Geraldo A16) — Cache de custom fields por list. Modal de criar
      // task lê pra pré-checar required antes do submit (evita 422 do ClickUp).
      // Shape: { [listId]: { fields, fetchedAt, loading } }
      clickupListFieldsCache: {},
      clickupConfigDraft: { client_id: '', client_secret: '' },
      clickupPatDraft: '',
      // V32.5.6 — Reabilita OAuth no frontend (lado a lado com PAT em tabs).
      // clickupConnectTab: 'oauth' | 'pat' — aba ativa no card ClickUp em Configurações.
      // clickupOAuthDraft: form de Client ID + Client Secret do OAuth App do user.
      clickupConnectTab: 'oauth',
      clickupOAuthDraft: { clientId: '', clientSecret: '' },
      // V32.5.8 — Persiste estado aberto/fechado do <details> "Configurações avançadas"
      // no card ClickUp. <details> nativo perde `open` em todo innerHTML re-render.
      clickupAdvancedOpen: false,
      // V32.5.9 → V32.6.0 — Setup Wizard ClickUp: cliente navega tree do workspace
      // (Space → Folder → List), escolhe um nó como raiz LJ. Tipo do nó determina
      // modo de espelhamento (space cascado / folder parcial / list flat).
      clickupSpaceWizard: {
        open: false,
        loading: false,
        tree: [],                             // [{ id, name, folderlessLists, folders: [{ id, name, lists }] }]
        workspaceName: null,
        currentRootId: null,
        currentRootKind: null,
        mode: 'select',                       // 'select' | 'create'
        expandedSpaces: [],                   // ids dos Spaces expandidos na tree
        expandedFolders: [],                  // ids dos Folders expandidos
        selectedNode: null,                   // { id, kind, name } | null
        newName: 'LeadJourney',
        submitting: false,
        error: null
      },
      taskCreationModal: null,
      djowTaskChat: null,
      // V31.2.41 — Status das 3 conexões RD (atualizado por testAllRdConnections).
      // status: 'unknown' | 'connected' | 'missing' | 'error'
      rdConnectionStatus: {
        crm_pat: { status: 'unknown', message: null, testedAt: null },
        marketing_oauth: { status: 'unknown', message: null, testedAt: null },
        crm_oauth: { status: 'unknown', message: null, testedAt: null }
      },
      rdInfoModal: null, // { open, openSection: 'pat'|'crm_oauth'|'marketing_oauth'|null }
      rdTestingConnections: false,
      // V31.2.54 — Webhooks RD cadastrados (cache local do estado no RD).
      // CRÍTICO preservar em normalize() — F5 derrubava antes da V31.2.54.
      rdWebhooks: [],
      rdWebhookRegistrationError: '',
      rdWebhooksLastSyncAt: null,
      // V32.0.12 — Lista de tenants (só master usa) + draft do connection string
      // pra plugar DB num tenant. CRÍTICO listar em normalize() pra preservar
      // (mesma regra: novo campo em App.state precisa entrar em initial + normalize).
      _tenantsListCache: [],
      tenantPlugDraft: {},
      // V32.0.16 — Cache de providers conectados via execution_credentials (DB
      // criptografado). Hidratado por Actions.loadExecutionCredentials() ao
      // abrir Settings → Execução. Provider bridges (_isNewPathConnected) leem
      // daqui pra decidir entre path novo (backend) e legacy (frontend).
      _executionCredentialsCache: [],
      trelloConnectDraft: { apiKey: '', token: '', board: '', listTodo: '', listDone: '' },
      // V32.1.1 — Section "Meu Banco" (self-service tenant DB).
      // Estado vem de auth-me (tenantDbPlugged) — não precisa cache separado.
      // Draft do form pra plugar próprio Postgres.
      tenantDbPlugDraft: '',
      tenantDbPlugError: '',
      // V32.1.2 — Section "Minha Conta": draft do display_name editável.
      profileDisplayNameDraft: '',
      // V32.5.7 — Sub-aba ativa em Configurações → Minha Conta.
      // 'identity' = perfil (display name, email, tenant)
      // 'products' = gerenciamento de produtos (arquivar/reativar/deletar)
      myAccountTab: 'identity',
      // V32.1.3 — Modal de list-picker do ClickUp (Geraldo safe integration).
      // _clickupTreeCache: árvore completa (spaces > folders > lists) hidratada
      // sob demanda quando user abre o picker. Não persiste no localStorage.
      showClickupListPicker: false,
      _clickupTreeCache: null,
      clickupTreeLoading: false,
      // V32.1.4 — drafts do card "Marcação automática" (tag + prefix).
      clickupMarkerDrafts: { ljTagName: '', taskPrefix: '' },
      // V32.1.5 — drafts do card "Mapping de status" (LJ → ClickUp).
      // 3 dropdowns: pending, in_progress, completed → status real da list.
      clickupStatusMapDraft: { pending: '', in_progress: '', completed: '' },
      // V32.2.0 — Cache do GET /api/clickup-mappings-list (hierarquia criada).
      // Hidratado pela Actions.loadClickupMappings ao abrir Integrações.
      _clickupMappingsCache: null,
      selectedProductId: null,
      selectedCampaignId: null,
      selectedActionId: null,
      selectedScoreId: Config.defaultScore?.id || 1,
      selectedDashboardCampaignId: null,
      selectedOkrId: null,
      selectedLeadId: null,
      activeLeadSubTab: 'profile',
      selectedPipelineStageId: 'marketing-mof',
      selectedPipelineCampaignId: 'all',
      selectedPipelineActionId: 'all',
      pipelineStages: null,
      pipelineVisualVersion: 'revenue-flow-v1',
      showActionFlowModal: false,
      actionFlowModalId: null,
      actionFlowEditMode: false,
      showActionEditModal: false,
      actionEditDraft: null,
      showFlowBuilderModal: false,
      flowBuilderCampaignId: null,
      showLpModal: false,
      lpDraft: null,
      lpEvents: [],
      lpRegistry: {},
      lpLastPolledAt: '',
      showCampaignFlowModal: false,
      campaignFlowModalId: null,
      showProductRevenueOverview: false,
      revenueOverviewProductId: null,
      showProductTotalFlowModal: false,
      productTotalFlowProductId: null,
      showProductCampaignsModal: false,
      productCampaignsModalId: null,
      campaignProductFilterId: null,
      revopsSelectedProductId: null,
      revopsFinance: {},
      // V32.8.0 (RevOps Whitelabel Onda 1) — formato novo coexiste com revopsFinance
      // legacy V14. Migration silenciosa: na 1ª leitura, se revopsFinanceV2[productId]
      // estiver vazio mas revopsFinance[productId] tiver dado, migra automaticamente.
      // UI antiga continua lendo do legacy. UI nova (Onda 2) lê do V2.
      revopsFinanceV2: {},
      // V32.8.1 (Onda 2) — tab ativa do painel novo + flag pra voltar ao clássico.
      revopsWhitelabelActiveTab: 'costs',
      revopsClassicMode: false,
      // V32.8.2 (Onda 3) — toggle Modo B (Excel) na tab Custos. Quando ON,
      // cada item renderiza como input livre de fórmula com autocomplete de
      // handles. Ediçao salva como calc.mode='custom_formula'.
      revopsExcelMode: false,
      // V32.8.3 (Onda 4) — Cache de sugestões Djow por tab. Cliente clica
      // "Análise Djow" e fica até reload. Evita re-fetch (custa tokens).
      // Shape: { [tabId]: { suggestion, askedAt, loading, error } }
      revopsDjowSuggestions: {},
      // V32.8.4 (Onda 5) — Simulator inline na tab Resultado. Cliente edita
      // overrides voláteis e vê impacto em tempo real, sem mexer no salvo.
      // null = usa valor real do cfg.
      revopsSimulator: { salesOverride: null, ticketOverride: null, active: false },
      // V32.8.5 (Onda 6) — Cenários nomeados por produto. Salva combinações de
      // overrides como "Cenário pessimista", "Crescer 30%", etc. Pode carregar
      // de volta no Simulator OU comparar 2 lado-a-lado.
      // Shape: { [productId]: [{ id, name, salesOverride, ticketOverride, savedAt }] }
      revopsScenarios: {},
      // IDs dos 2 cenários selecionados pra comparação (ou null = baseline).
      revopsCompareSelection: { left: null, right: null },
      // V32.9.4 — Collapse + Lock por grupo no RevOps. Lock pede senha do
      // user logado pra desbloquear (anti edição acidental por colega no
      // mesmo login compartilhado).
      revopsGroupCollapsed: {},        // { [groupId]: bool } — UI state
      revopsGroupLocked: {},           // { [groupId]: bool } — persiste
      // V32.10.0 — Override de MCU/MSU na tab RevOps. Cliente edita 1 valor
      // único (natural ou =fórmula) OU compõe múltiplas deduções nomeadas.
      // Shape: { [productId]: { mcu: {mode,value,components}, msu: {mode,value,components} } }
      // mode: 'auto' (calcula default) | 'manual' (1 valor) | 'composed' (lista deduções)
      revopsKpiOverrides: {},
      // V32.10.6 — Cache do admin inspector (master-only). Snapshots de tenant
      // específico com preview de conteúdo (contagem RevOps groups etc).
      adminInspector: null,
      // V32.10.7 — Handle picker (olhinho) aberto em qual contexto.
      // Valor é a chave única do input (ex: "composed:p1:mcu", "item:p1:itemX").
      // null = nenhum picker aberto.
      revopsHandlePickerKey: null,
      // V32.10.9 — DRE: estado de expansão da linha "Deduções" per-product.
      // { [productId]: boolean }. Default: colapsado.
      revopsDreDeducoesExpanded: {},
      // V32.12.1 — Expansão da faixa "Performance Externa" no card de Campanha.
      // { [campaignId]: boolean }. Default: colapsado.
      campaignPerfExpanded: {},
      // V32.12.2 — Modo demo da Performance Externa: força exibição com dados
      // mockados (Meta + Google conectados) pra cliente ver como vai ficar
      // antes do backend OAuth (V32.12.3+) chegar. Toggle via console:
      //   App.state.campaignPerfDemoMode = true; App.render();
      campaignPerfDemoMode: false,
      // V32.12.4 — Modal de relogin inline (JWT expirado). Aberto quando
      // QUALQUER endpoint retorna 401. NÃO faz logout automático — preserva
      // localStorage e App.state pra cliente NÃO PERDER trabalho não-salvo.
      // Após relogin OK, dispara _doPush imediato pra empurrar pendências.
      reloginInlineModal: { open: false, error: null, loading: false },
      // V32.13.1 — Mini-modal KR picker (Etapa 5 do Mapa da Receita).
      // Quando cliente clica "+ Adicionar ação" no card da frente, abre modal
      // perguntando qual KR-mãe a nova ação vai mover. null = fechado.
      // Quando aberto: { areaId: 'marketing'|'sales'|'cs' }
      strategicKrPickerOpen: null,
      // V32.13.6 — ID da action criada agora (last) pra animação "entrar"
      // do retângulo no mind-map. Limpa após a animação rodar (3s).
      strategicJustCreatedActionId: null,
      // V32.13.12 — Editor de ação acionado pelo click no card do mind-map.
      // null = fechado. Quando aberto: { actionId }. Visual baseado no print
      // do Felipe (KR plugado + checkboxes KR + nome + onde começa/pra onde
      // leva + canal + "Criar Ação"). Opera sobre action existente (não cria).
      strategicMindMapActionEditor: null,
      // V32.13.16 — Modal de detalhe da task de execução acionado pelo click
      // no card amber da branch de execução. null = fechado.
      // Quando aberto: { taskId, syncing: bool }
      executionTaskDetail: null,
      // V32.14.1 — Modal de drill-down do KR no Acompanhamento (Etapa 6).
      // null = fechado. Aberto: { krId, branchCampaignId }. Mostra ações + tasks
      // do KR com status agregado por task.
      acompanhamentoKrDetail: null,
      // V32.14.2 — Modal de drill-down da Ação no Acompanhamento.
      // null = fechado. Aberto: { actionId }. Mostra ação + KRs que ela move
      // + tasks dela com status agregado.
      acompanhamentoActionDetail: null,
      // V32.14.8 — Timestamp da última sync ClickUp (ms). null = nunca.
      clickupLastSyncAt: null,
      // V32.15.0 — Recolher por bloco no Acompanhamento (Etapa 6 do Mapa).
      // Felipe pediu recolher dos 4 layers: Números, Ações, Carga, Gantt.
      // Persiste pra a preferência sobreviver F5.
      acompanhamentoSectionsCollapsed: { krs: false, actions: false, carga: false, gantt: false },
      // V33.0.0 — Onda 1 Fase 2: cache de visitors lidos do tenant DB.
      // Não persiste (volátil) — sempre re-fetch ao abrir LJ.
      trackerVisitorsCache: { counts: null, list: [], loadedAt: null, loading: false },
      // V33.0.0 — Status do tracker por campanha (evita fetch em todo render).
      // { [campaignId]: { connected, lastEventAt, totalVisitors, byEntityType, loadedAt } }
      trackerStatusByCampaign: {},
      // V33.0.0 — Modal wizard "Conectar LP" (volátil).
      // null = fechado. Aberto: { campaignId, step, snippet, trackerToken, apiBase, copied }
      trackerWizardOpen: null,
      // V33.0.0 — Modal detalhe do visitor (prontuário, volátil).
      // null = fechado. Aberto: { lj_visitor_id, data, loading }
      trackerVisitorDetail: null,
      // V33.0.0 — Resultados reorganizado (produto-first). null = lista de produtos.
      selectedResultProductId: null,
      // V33.0.0 — Feature flag fallback pro Resultados antigo (caso user prefira).
      resultsClassicMode: false,
      // V33.0.0 Onda 2 — Hotmart: status cache + wizard.
      hotmartStatus: null,
      hotmartWizardOpen: null,
      // V33.0.0 Onda 3 — Atribuição causal: cache de aggregação por action.
      // { byActionId: { [id]: {transitions, leads, customers, lastAttributedAt} }, sinceDays, loadedAt, loading }
      actionAttributionsCache: { byActionId: {}, sinceDays: 30, loadedAt: null, loading: false },
      // V33.0.0-alpha18 — Breakdown por LP de cada campanha (Caminho C).
      // { [campaignId]: { lps, total_visitors, total_leads, total_customers, loadedAt } }
      campaignLpBreakdown: {},
      // V34.0.0 Onda 2 — Cache de bancos de leads + UI state.
      leadBanksCache: { banks: [], loadedAt: null, loading: false },
      // Modal de criar/editar banco (volátil). null = fechado. { mode: 'create'|'edit', bank: {...}|null, saving: bool, error: string|null }
      leadBankEditModal: null,
      // V34.0.0 Onda 3 — Banco selecionado pro import (volátil, default = bank default do tenant).
      leadImportBankId: null,
      // Import em andamento — bloqueia UI durante processamento batch.
      leadImportProcessing: false,
      // V34.6.h — Progresso do chunking. null quando idle, { current, total,
      // currentChunk, totalChunks } durante o batch.
      leadImportProgress: null,
      // V34.0.0 Onda 4 — Modal multi-select de bancos antes de buscar.
      // open=true mostra modal. selected = array de bank_ids OR null (= Todos).
      // pendingAction: 'search' = vai rodar Djow após confirmar.
      searchBankSelectionModal: { open: false, selected: null, pendingAction: null },
      // V34.0.0 Onda 5 — Modal de imputar leads em campanha LJ.
      // open=true mostra modal. campaignId = id da campanha alvo. visitorIds = lista
      // pré-selecionada do Buscador. processing = bloqueia UI durante batch.
      imputeCampaignModal: { open: false, campaignId: null, visitorIds: [], pushToRd: false, processing: false, progress: null, error: null },
      // V34.0.0 Onda 6 — Modal de identity resolution.
      // open=true mostra revisão de duplicatas. emailGroups/phoneGroups = output do
      // /api/visitors-find-duplicates. mergingKey = grupo em processamento (loading).
      duplicatesModal: { open: false, loading: false, emailGroups: [], phoneGroups: [], loadedAt: null, mergingKey: null, error: null },
      // V34.6.z — Modal de backlog RD push (visitors imputados mas que não entraram no RD).
      rdBacklogModal: { open: false, loading: false, campaignId: null, total: 0, byReason: {}, visitors: [], retrying: false, error: null },
      // V34.6.aa — Counts por stage de cada campanha (lj_visitor_campaign_state).
      // Map campaignId → { counts: {'marketing-tof': N, ...}, total, loadedAt }
      campaignPipelineCounts: {},
      // V34.7.f.3 — Cache do breakdown RFV por visitor (volátil)
      visitorScoreDetail: {},
      // V34.7.g — Filtro de banco no Journey Pipeline (cross-filter campanha × banco)
      selectedPipelineBankId: null,
      // V34.7.h — Config de IA do próprio user (lê via /api/user-ai-config)
      _userAiConfigCache: null,
      // V34.7.h — Draft do input da chave Anthropic (não persiste)
      _userAiKeyDraft: '',
      // V34.7.h.5 — Progresso do enrich em loop (barra 0..100%)
      enrichProgress: { running: false, total: 0, done: 0, currentBatch: 0 },
      // V34.7.h.6 — Progresso do Sync RD em loop (barra 0..100%)
      rdSyncProgress: { running: false, total: 0, done: 0, currentBatch: 0 },
      // V34.8.0 / V34.9.4 — Conciliação RD↔LJ. Sininho agrega 3 tipos:
      // conflicts (unread) + pending-stage + pending-deal. totalUnread = badge.
      reconciliationModal: { open: false, loading: false, alerts: [], stagePending: [], dealPending: [], loadedAt: null, resolvingId: null },
      pendingReconciliationCount: 0,
      reconciliationCounts: { conflictsUnread: 0, conflictsTotal: 0, pendingStage: 0, pendingDeal: 0, totalUnread: 0 },
      // V34.8.2 — Estado do botão "Conciliar" (rodar motor bidirecional sob demanda)
      reconciliationRunProgress: { running: false, phase: '', stats: null },
      // V34.9.3 — Modal de Triggers (Revenue Flow Map). Lista triggers da
      // campanha selecionada + UI pra adicionar/editar/deletar/espelhar.
      triggersModal: {
        open: false,
        loading: false,
        campaignId: null,
        triggers: [],
        draft: null,        // { from_stage, to_stage, trigger_type, ... } durante criação
        editingId: null,
        mirroringFromId: null
      },
      // V34.9.5 / V34.9.10 — Painel Score Engine.
      // Aba 'score' (visualização) tem sub-tabs ('general' | 'campaign').
      // Aba 'settings' (configuração) seleciona modelo + regras.
      scoreConfigModal: {
        open: false,
        campaignId: null,
        activeTab: 'score',
        scoreSubTab: 'general',
        activeModel: 'rfv',
        scoreRules: [],
        ruleDraft: null,
        // V34.9.11 — ICP Profile editável
        icpProfile: { fields_json: {}, tier_method: 'percentage', tier_rules_json: { tier_1: [], tier_2: [], tier_3: [] } },
        icpDraft: null
      },
      // V34.9.6 — Modal "Score Breakdown": ao clicar no badge de score do
      // lead, abre detalhamento item por item (tags, touchpoints, eventos,
      // transitions, cálculo R/F/V).
      scoreBreakdownModal: {
        open: false,
        visitorId: null,
        loading: false,
        data: null
      },
      // V34.9.20 — Modal Sub-Funil: ao clicar numa bolinha do Revenue Flow Map
      // (com campanha selecionada), abre editor do mini-funil daquela bolinha
      // naquela campanha. Cada linha = um sub-stage (nome + tag + contagem).
      subStageFunnelModal: {
        open: false,
        campaignId: null,
        parentStage: null,
        substages: [],
        knownTags: [],
        loading: false,
        savingId: null
      },
      // V35.0.0 — Modal de confirmação genérico (substitui confirm() nativo).
      confirmModal: { open: false },
      // V35.0.0 — Filtro ativo de sub-stage no Buscador.
      subStageActiveFilter: null,
      // V35.1.0 — Tab ativa do Dashboard (overview | checkout) e estado da tab Checkout.
      activeDashboardTab: 'overview',
      checkoutDashboard: {
        loadedAt: null,
        activeSubTab: 'all',           // 'all' | productIdHotmart
        period: { days: 30 },
        products: [],
        kpis: {},
        transactions: [],
        series: [],
        pagination: { limit: 50, offset: 0, total: 0 },
        // V35.2.1 — agregado de motivos de recusa + filtro ativo
        cancellationReasons: [],
        reasonFilter: null,
        othersModalOpen: false
      },
      // V35.1.1 — Painel Djow Checkout (fresh por sessão, não persiste em DB)
      djowCheckout: {
        loadedFor: null,
        summary: null,
        summaryLoading: false,
        suggestions: [],
        suggestionsLoading: false,
        messages: [],
        asking: false,
        input: ''
      },
      // V34.0.0 Onda 6.d — Counts agregados pra "sininho" no menu Leads.
      // duplicateGroupsTotal>0 destaca botão Duplicatas com badge âmbar.
      pendingCounts: { duplicateGroupsTotal: 0, duplicateGroupsEmail: 0, duplicateGroupsPhone: 0, recentMerges24h: 0, lastMergeAt: null, loadedAt: null },
      // Resultados da busca server-side (V34.4). Substitui getGlobalLeads no
      // Buscador quando loadedAt está populado. ProfileFinder roda em cima.
      visitorSearchResults: {
        visitors: [],
        bankIds: null,          // null = Todos
        bankNames: [],          // labels resolvidos pra UI mostrar "Buscando em: A · B"
        loadedAt: null,
        loading: false,
        error: null
      },
      customChannels: [],
      customActionTypes: [],
      executionConfig: window.ExecutionProviderRegistry?.defaultConfig?.() || { defaultProvider: 'manual', providers: {} },
      agentConfig: window.AgentRegistry?.defaultConfig?.() || { djow: { name: 'Djow', url: '', endpoint: '/execute', method: 'POST', apiKey: '', timeoutMs: 30000, enabled: false, lastStatus: null, lastLatencyMs: null, lastCheckedAt: null } },
      executionTasks: [],
      // V32.4.1 (Geraldo Item 1) — djowChats/showDjowModal/djowModalActionId/
      // djowDraftMessage/djowLastResponse removidos (V16.3 DjowModal aposentado).
      // djowContext novo: { actionId } opcional quando DjowAIModal é aberto
      // com contexto de ação. djowSending continua (usado pelo DjowAIModal).
      djowSending: false,
      djowContext: null,
      showTasksModal: false,
      tasksModalActionId: null,
      showStrategicMap: false,
      strategicMapProductId: null,
      strategicMapZoom: 'strategy',
      strategicMapOnboardingSeen: {},
      strategicMaps: {},
      // V32.7.1 — Campos que estavam sendo escritos em App.state mas NÃO
      // mapeados em normalize(). Bug detectado pelo warning [State.load]
      // "Campos persistidos NÃO mapeados — risco de perda de dados".
      // Cada F5 droppava esses campos, cliente perdia branch ativa do Mapa,
      // estado dos cards expandidos, catálogo custom, etc.
      strategicMapCampaignId: null,                  // branch ativa (null = vista produto)
      strategicMapMode: 'product',                   // 'product' | 'campaign'
      strategicSkipOnboarding: false,                // pula welcome screen
      strategicKrCardOpen: {},                       // { [pkrId]: bool } — cards expandidos
      customActionCatalog: [],                       // ações custom criadas pelo user
      // V32.6.6 — Progressive disclosure no zoom "As Ações": uma ação expandida
      // por vez (em foco). Pendentes sem foco ficam colapsadas com CTA. Reduz
      // "muralha de decisões" que confundia o cliente após criar campanha.
      strategicActiveActionId: null,
      // V32.7.0 — Cache de subtasks puxadas do ClickUp por ação (step 6 do Mapa).
      // Substitui ExecutionTaskStore como fonte no step de execução: ClickUp =
      // source of truth. Cache evita refazer fetch a cada render — refresh
      // automático no boot do step 6 e manual via botão Sync.
      clickupActionSubtasks: { byActionId: {}, fetchedAt: null, loading: false },
      // V32.7.3 (Geraldo A5) — Cliente confirma 1x que entendeu o risco de
      // deletar a raiz LJ. Modal de alerta só aparece enquanto não acknowledge.
      // Reseta quando raiz muda (cliente troca pra outra Space/Folder/List).
      clickupDeleteWarningAck: null,            // { rootId: string, ackAt: ISO }
      // V31.2.12 — Catálogo aprendido: KRs customizados criados pelo user viram
      // sugestões pros próximos produtos. Estrutura: { marketing: [...], sales: [...], cs: [...] }.
      customKpiCatalog: {},
      strategicDjowChats: {},
      strategicDjowDraft: '',
      strategicDjowSending: false,
      strategicObjectiveDraft: null,
      strategicOkrDraft: null,
      showQuickActionModal: false,
      quickActionContext: null,
      quickActionDraft: { name: '', campaignId: null, channel: '', actionType: '' },
      showStrategicOverview: false,
      revenueScoreBlueprints: {},
      revenueReadyTriggered: {},
      leadOutcomes: {},
      leadScoreHistory: {},
      leadEngagementHistory: {},
      negativeSelection: { excludedDomains: [], excludedAccounts: [] },
      abTestVariants: {},
      driftBaselines: {},
      customScoreSignals: { B2B: [], B2C: [], negative: [], triggers: [] },
      showLeadDetailModal: false,
      leadDetailContext: null,
      campaignLeadLinks: {},
      profileCampaignContext: null,
      profileIcpContext: null,
      showPostScoreSearchPrompt: false,
      postScoreSearchCampaignId: null,
      rdEventLog: [],
      rdLastSyncAt: null,
      // V34.6.p — Cursor do RdCrmLiveSyncEngine pra pull incremental.
      // Sem isso em initial+normalize, F5 droppava silenciosamente o cursor
      // (warning State.load campo persistido não mapeado).
      rdWebhookLastFetchedAt: null,
      rdSyncRunning: false,
      showRevenueScoreCreator: false,
      revenueScoreCreatorCtx: null,
      showRevenueScoreDashboard: false,
      revenueScoreDashboardCampaignId: null,
      actionsListFilter: 'all',
      actionCreateTab: 'manual',
      actionAiDraft: { prompt: '', count: 3 },
      flowBuilderStartFilter: 'all',
      flowBuilderZoom: 1.0,
      flowBuilderConnectionArm: null,
      flowDisconnectConfirm: null,
      flowBuilderShowHelp: false,
      showRevopsSimulationModal: false,
      revopsSimulationDraft: null,
      revopsSimulationLoadedScenarioId: null,
      showRevopsScenariosModal: false,
      showRevopsScenarioNameModal: false,
      showRevopsOkrModal: false,
      revopsOkrDraft: null,
      showRevopsFixedCostsModal: false,
      revopsFixedCostsCategory: null,
      showRevopsAcquisitionModal: false,
      profileQuery: '', profileFilters: [], profileActive: false,
      leadBaseInputMode: 'manual',
      showLeadImportModal: false,
      leadManualText: '',
      leadCsvText: '',
      // V35.3.7 — Lead Import Wizard (4 steps: Upload → Mapear → Revisar → Importar)
      // Substitui o modo Manual (vira sub-modo do Step 1 "colar texto"). Persiste
      // entre saves pra que F5 no meio do fluxo recupere o progresso.
      leadImportWizard: null,
      // V35.3.8 — Última versão vista pelo usuário (compara com window.LJVersion
      // pra mostrar release notes não vistas no sininho da Home).
      lastSeenVersion: null,
      leadDraft: { name: '', phone: '', email: '', idade: '', estado: '', cidade: '', estadoCivil: '', sexo: '', faixaSalarial: '', tags: '' },
      manualLeads: [],
      productDraft: { name: '', type: '', price: '', revenueModel: 'Venda única', operationalCost: '' },
      okrDraft: { objective: '', keyResult: '', target: '', unit: 'R$', owner: '', deadline: '', status: 'Em andamento' },
      kpiDraft: { name: '', metric: 'revenue', scope: 'global', productId: null, target: '', unit: 'R$', frequency: 'Semanal', source: 'Automático pelo Revenue Engine', relatedOkrId: null },
      campaignDraft: { name: '', objective: '', productId: null, owner: '', sector: 'Marketing' },
      actionDraft: this.initialActionDraft(),
      scoreDraft: { name: '', description: '', tagRules: [{ tag: '#nova', score: 0 }] },
      products: [],
      strategicOkrs: [],
      operationalKpis: [],
      cxProjects: [],
      campaigns: [],
      scores: [Utils.clone(Config.defaultScore)],
      actions: [],
      schemaVersion: '12.4.1',
      dataCreatedAt: new Date().toISOString(),
      lastMigrationAt: null
    };
  },
  normalizeKeyResults(raw, scope = 'product') {
    // V31.2.9 — Spread preserva campos extras (owner, status, deadline, unit,
    // current, frequency, priority, etc.) que sejam adicionados futuramente.
    // Antes só os 5 campos explícitos eram preservados → perda silenciosa.
    const list = Array.isArray(raw) ? raw : [];
    return list.map((kr, index) => ({
      ...kr,
      id: kr.id || `kr_${Date.now()}_${index}_${Math.floor(Math.random() * 1000)}`,
      label: String(kr.label || '').trim(),
      metric: typeof kr.metric === 'string' ? kr.metric : (scope === 'product' ? 'ebitda' : 'campaignCAC'),
      target: Number(kr.target || 0),
      parentKrId: kr.parentKrId || null
    }));
  },
  normalizeCampaignOkrs(raw) {
    // V31.2.9 — Spread preserva campos extras (owner, status, priority, notes).
    const list = Array.isArray(raw) ? raw : [];
    if (!list.length) return [];
    if (list[0] && typeof list[0] === 'object' && 'objective' in list[0] && 'keyResults' in list[0]) {
      return list.map((okr, index) => ({
        ...okr,
        id: okr.id || `okrc_${Date.now()}_${index}`,
        objective: String(okr.objective || '').trim(),
        keyResults: this.normalizeKeyResults(okr.keyResults, 'campaign'),
        createdAt: okr.createdAt || new Date().toISOString()
      }));
    }
    return [];
  },
  normalizeRevopsFinance(raw) {
    if (!raw || typeof raw !== 'object' || !window.RevopsFinanceEngine) return {};
    const normalized = {};
    for (const [productId, config] of Object.entries(raw)) {
      normalized[productId] = RevopsFinanceEngine.normalize(config, productId);
    }
    return normalized;
  },
  // V32.8.0 — Normaliza revopsFinanceV2 (formato whitelabel) + migration silenciosa
  // do legacy revopsFinance quando V2 do produto ainda não existe. Idempotente.
  _normalizeRevopsFinanceV2(rawV2, rawLegacy) {
    if (!window.RevopsWhitelabelEngine) return rawV2 || {};
    const out = {};
    const v2Source = rawV2 && typeof rawV2 === 'object' ? rawV2 : {};
    const legacySource = rawLegacy && typeof rawLegacy === 'object' ? rawLegacy : {};
    // Pega TODOS productIds que aparecem em qualquer um dos dois
    const allProductIds = new Set([...Object.keys(v2Source), ...Object.keys(legacySource)]);
    for (const productId of allProductIds) {
      if (v2Source[productId]) {
        // V2 existe → normaliza
        out[productId] = RevopsWhitelabelEngine.normalize(v2Source[productId], productId);
      } else if (legacySource[productId]) {
        // Só legacy → migra
        out[productId] = RevopsWhitelabelEngine.migrateFromLegacy(legacySource[productId]);
        out[productId].productId = productId;
      }
    }
    return out;
  },
  normalizeOkrs(okrs) {
    const source = Array.isArray(okrs) ? okrs : [];
    return source.map((okr, index) => ({
      id: okr.id || `okr_${index}_${Date.now()}`,
      name: okr.name || '',
      target: okr.target || okr.goal || '',
      current: okr.current || '',
      unit: okr.unit || '',
      benchmark: okr.benchmark || '',
      trend: okr.trend || 'stable',
      health: okr.health || 'Atenção',
      stageId: okr.stageId || ''
    }));
  },
  normalizeTagRules(tagRules) {
    const rules = Array.isArray(tagRules) ? tagRules : Config.defaultScore.tagRules;
    return rules.map(rule => ({ tag: rule.tag || '#nova', score: Number(rule.score || 0) }));
  },
  normalizeScore(score, index = 0) {
    return { id: score?.id || Date.now() + index, name: score?.name || 'Score sem nome', description: score?.description || '', tagRules: this.normalizeTagRules(score?.tagRules) };
  },
  normalizeAction(action, index, fallbackScoreId, base) {
    const sector = action.sector || action.originSector || 'Marketing';
    const funnel = action.funnel || action.originFunnel || 'MOF';
    const originSector = action.originSector || sector;
    const originFunnel = action.originFunnel || funnel;
    const destinationSector = action.destinationSector || sector;
    const destinationFunnel = action.destinationFunnel || funnel;
    const okrs = this.normalizeOkrs(action.okrs || []);
    const resolvedFlow = Array.isArray(action.flowPath)
      ? action.flowPath
      : FlowResolutionEngine.resolve(originSector, originFunnel, destinationSector, destinationFunnel);
    const fallbackStageId = resolvedFlow[0];
    const scoreId = action.scoreId || fallbackScoreId;
    const actionName = action.name || 'ação';
    const baseOkrs = okrs.length
      ? okrs
      : OkrSuggestionEngine.defaultFor(sector, funnel, action.channel, action.actionType || 'Post');
    // V31.2.9 — Spread inicial preserva QUALQUER campo extra que chegue na action
    // (defesa em camadas contra perda silenciosa de fields novos não-listados).
    // Os campos explícitos abaixo sobrescrevem o spread com versões normalizadas.
    return {
      ...action,
      id: action.id || Date.now() + index,
      campaignId: action.campaignId || base.selectedCampaignId,
      name: action.name || 'Ação sem nome',
      channel: action.channel || 'RD Station',
      actionType: action.actionType || action.type || 'Post',
      sector, funnel,
      originSector, originFunnel, destinationSector, destinationFunnel,
      conversionObjective: action.conversionObjective || action.objective || '',
      objective: action.objective || '',
      expectedConversion: Number(action.expectedConversion || 25),
      mailingDefined: Boolean(action.mailingDefined),
      flowConfig: Array.isArray(action.flowConfig) ? action.flowConfig : null,
      okrs: baseOkrs.map(okr => ({ ...okr, stageId: okr.stageId || fallbackStageId })),
      kpis: Array.isArray(action.kpis) ? action.kpis.map(kpi => ({ ...kpi, type: 'kpi' })) : (window.RDMapper?.isRDEmailAction?.(action) ? RDConfig.emailKpiDefaults() : []),
      rdEmailConfig: window.RDConfig ? { ...RDConfig.emailDefaults(), ...(action.rdEmailConfig || {}) } : (action.rdEmailConfig || {}),
      flowPath: resolvedFlow,
      scoreId,
      connected: Boolean(action.connected),
      connectionStatus: action.connectionStatus || 'ready',
      status: action.status || 'Pronta para conectar',
      linkedCampaignKrId: action.linkedCampaignKrId || null,
      // V31.0.7 — Fix core: campos estratégicos da ação não estavam sendo
      // preservados pelo normalize. Sintoma: Mapa da Receita mostrava sempre
      // "0 ação(ões) ativa(s)" porque o filtro depende de strategicAreaId.
      strategicAreaId: action.strategicAreaId || null,
      strategicCatalogId: action.strategicCatalogId || null,
      strategicDescription: action.strategicDescription || '',
      strategicOwner: action.strategicOwner || '',
      strategicCadence: action.strategicCadence || null,
      strategicStatus: action.strategicStatus || null,
      strategicConfirmed: Boolean(action.strategicConfirmed),
      isDraft: Boolean(action.isDraft),
      leads: Array.isArray(action.leads) ? action.leads.map((lead, leadIndex) => {
        const normalized = LeadParser.normalizeLead(lead, leadIndex, scoreId);
        const { score, ...plain } = normalized;
        const identityNormalized = LeadIdentityEngine.normalizeLead(plain, actionName);
        // V19 — lead scoring maturity additions (todos opcionais, defaults seguros)
        const emailDomain = String(identityNormalized.email || '').split('@')[1] || '';
        const createdAt = identityNormalized.createdAt || lead.createdAt || new Date().toISOString();
        return {
          ...identityNormalized,
          companyDomain: identityNormalized.companyDomain || emailDomain || null,
          outcome: identityNormalized.outcome || lead.outcome || null,
          lifecycleStage: identityNormalized.lifecycleStage || lead.lifecycleStage || 'subscriber',
          lifecycleStageAt: identityNormalized.lifecycleStageAt || lead.lifecycleStageAt || createdAt,
          cohortMonth: identityNormalized.cohortMonth || lead.cohortMonth || createdAt.slice(0, 7),
          buyingRole: identityNormalized.buyingRole || lead.buyingRole || null,
          meddic: identityNormalized.meddic || lead.meddic || null,
          // V20 — Persona expandida + trigger events + awareness level
          industry: identityNormalized.industry || lead.industry || null,
          companyRevenue: identityNormalized.companyRevenue || lead.companyRevenue || null,
          income: identityNormalized.income || lead.income || null,
          jobTitle: identityNormalized.jobTitle || lead.jobTitle || null,
          geography: identityNormalized.geography || lead.geography || null,
          awarenessLevel: identityNormalized.awarenessLevel || lead.awarenessLevel || null,
          triggerEvents: Array.isArray(lead.triggerEvents) ? lead.triggerEvents : (Array.isArray(identityNormalized.triggerEvents) ? identityNormalized.triggerEvents : []),
          // V21.4 BUGFIX — campos do RD Live Bridge que ANTES eram silenciosamente
          // descartados pelo LeadParser. Recuperando do raw lead aqui:
          tagCounters: lead.tagCounters && typeof lead.tagCounters === 'object' ? lead.tagCounters : {},
          eventHistory: Array.isArray(lead.eventHistory) ? lead.eventHistory : [],
          engagementHistory: Array.isArray(lead.engagementHistory) ? lead.engagementHistory : [],
          scoreHistory: Array.isArray(lead.scoreHistory) ? lead.scoreHistory : [],
          rdContactId: lead.rdContactId || null,
          rdContext: lead.rdContext && typeof lead.rdContext === 'object' ? lead.rdContext : null,
          outcomeAt: lead.outcomeAt || null,
          lastSyncedAt: lead.lastSyncedAt || null,
          source: lead.source || 'manual',
          createdAt
        };
      }) : [],
      createdAt: action.createdAt || new Date().toISOString()
    };
  },
  normalize(raw) {
    const base = this.initial();
    if (!raw || typeof raw !== 'object') return base;
    const now = Date.now();
    const nowIso = new Date().toISOString();
    const scores = Array.isArray(raw.scores) && raw.scores.length ? raw.scores.map((score, index) => this.normalizeScore(score, index)) : [this.normalizeScore(Config.defaultScore)];
    const fallbackScoreId = scores[0].id;
    const products = Array.isArray(raw.products) && raw.products.length ? raw.products.map((product, index) => ProductRevenueEngine.normalize(product, index)) : base.products;
    const selectedProductId = raw.selectedProductId || products[0]?.id || base.selectedProductId;
    // V31.2.9 — Spread preserva campos extras das campanhas (description, budget,
    // startDate, endDate, funnel, stage, leadTarget, isStrategicHost, etc.) que
    // sejam adicionados em futuras versões. Antes só os 10 campos explícitos.
    const campaigns = Array.isArray(raw.campaigns) ? raw.campaigns.map((campaign, index) => ({
      ...campaign,
      id: campaign.id || now + index,
      productId: campaign.productId || selectedProductId,
      name: campaign.name || 'Campanha sem nome',
      objective: campaign.objective || '',
      owner: campaign.owner || '',
      sector: campaign.sector || 'Marketing',
      status: campaign.status || 'Ativa',
      mediaInvestment: Number(campaign.mediaInvestment || 0),
      okrs: this.normalizeCampaignOkrs(campaign.okrs),
      createdAt: campaign.createdAt || nowIso
    })) : base.campaigns;
    return {
      ...base,
      activeTab: raw.activeTab || base.activeTab,
      showSettingsModal: Boolean(raw.showSettingsModal),
      settingsActiveSection: raw.settingsActiveSection || base.settingsActiveSection,
      // V32.4.0 (Geraldo Item 6) — databaseConfig vira {} vazio. Demais flags
      // (databaseTestResult, databaseTesting, showDatabaseTutorial, railway*)
      // removidas junto com a feature V11. Backwards compat: state antigos com
      // databaseConfig populado simplesmente perdem o conteúdo (sem uso na V32+).
      // V21.4 BUGFIX — campos persistidos que somem se não forem preservados aqui:
      // V21.6 ADD — pipelinesByCampaign preservado explicitamente (objeto aninhado).
      // V22.0 ADD — dealsByLead preservado (mapa de leadKey→campaign→dealId).
      integrations: raw.integrations && typeof raw.integrations === 'object'
        ? {
            rd: { ...(base.integrations?.rd || {}), ...(raw.integrations.rd || {}) },
            rdCrm: {
              ...(base.integrations?.rdCrm || {}),
              ...(raw.integrations.rdCrm || {}),
              pipelinesByCampaign: (raw.integrations.rdCrm?.pipelinesByCampaign && typeof raw.integrations.rdCrm.pipelinesByCampaign === 'object')
                ? raw.integrations.rdCrm.pipelinesByCampaign
                : (base.integrations?.rdCrm?.pipelinesByCampaign || {}),
              dealsByLead: (raw.integrations.rdCrm?.dealsByLead && typeof raw.integrations.rdCrm.dealsByLead === 'object')
                ? raw.integrations.rdCrm.dealsByLead
                : (base.integrations?.rdCrm?.dealsByLead || {})
            }
          }
        : (base.integrations || {}),
      rdCrmLeadTags: raw.rdCrmLeadTags && typeof raw.rdCrmLeadTags === 'object' ? raw.rdCrmLeadTags : {},
      railwayTesting: false,
      railwayTestResults: null,
      railwayShowPassword: false,
      showRailwaySnapshotPrompt: false,
      selectedProductId,
      selectedCampaignId: raw.selectedCampaignId || base.selectedCampaignId,
      selectedActionId: raw.selectedActionId || null,
      selectedScoreId: raw.selectedScoreId || fallbackScoreId,
      selectedDashboardCampaignId: raw.selectedDashboardCampaignId || null,
      selectedOkrId: raw.selectedOkrId || null,
      selectedLeadId: raw.selectedLeadId || null,
      activeLeadSubTab: raw.activeLeadSubTab || base.activeLeadSubTab,
      selectedPipelineStageId: raw.selectedPipelineStageId || base.selectedPipelineStageId,
      selectedPipelineCampaignId: raw.selectedPipelineCampaignId || base.selectedPipelineCampaignId,
      selectedPipelineActionId: raw.selectedPipelineActionId || base.selectedPipelineActionId,
      pipelineStages: Array.isArray(raw.pipelineStages) ? raw.pipelineStages : null,
      pipelineVisualVersion: raw.pipelineVisualVersion || null,
      showActionFlowModal: Boolean(raw.showActionFlowModal),
      actionFlowModalId: raw.actionFlowModalId || null,
      actionFlowEditMode: Boolean(raw.actionFlowEditMode),
      showActionEditModal: false,
      actionEditDraft: null,
      showFlowBuilderModal: false,
      flowBuilderCampaignId: null,
      showLpModal: false,
      lpDraft: null,
      lpEvents: Array.isArray(raw.lpEvents) ? raw.lpEvents : [],
      lpRegistry: raw.lpRegistry && typeof raw.lpRegistry === 'object' ? raw.lpRegistry : {},
      lpLastPolledAt: raw.lpLastPolledAt || '',
      showCampaignFlowModal: Boolean(raw.showCampaignFlowModal),
      campaignFlowModalId: raw.campaignFlowModalId || null,
      showProductRevenueOverview: Boolean(raw.showProductRevenueOverview),
      revenueOverviewProductId: raw.revenueOverviewProductId || null,
      showProductTotalFlowModal: Boolean(raw.showProductTotalFlowModal),
      productTotalFlowProductId: raw.productTotalFlowProductId || null,
      showProductCampaignsModal: Boolean(raw.showProductCampaignsModal),
      productCampaignsModalId: raw.productCampaignsModalId || null,
      campaignProductFilterId: raw.campaignProductFilterId || null,
      revopsSelectedProductId: raw.revopsSelectedProductId || null,
      revopsFinance: this.normalizeRevopsFinance(raw.revopsFinance),
      // V32.8.0 — Normaliza V2 + migration silenciosa do legacy quando V2 vazio.
      // Roda 1x por F5 mas migrateFromLegacy é idempotente (sempre produz mesma
      // saída do mesmo input) — safe re-rodar.
      revopsFinanceV2: this._normalizeRevopsFinanceV2(raw.revopsFinanceV2, raw.revopsFinance),
      // V32.8.1 — tab ativa + flag clássico persistem.
      revopsWhitelabelActiveTab: typeof raw.revopsWhitelabelActiveTab === 'string' ? raw.revopsWhitelabelActiveTab : 'costs',
      revopsClassicMode: !!raw.revopsClassicMode,
      // V32.8.2 — toggle Excel persiste.
      revopsExcelMode: !!raw.revopsExcelMode,
      // V32.8.3 — cache Djow sempre boota vazio (sugestões caras de re-gerar
      // ficam stale entre sessões; melhor re-pedir).
      revopsDjowSuggestions: {},
      // V32.8.4 — Simulator boota desligado (estado UI volátil).
      revopsSimulator: { salesOverride: null, ticketOverride: null, active: false },
      // V32.8.5 — cenários persistem; seleção de comparação não.
      revopsScenarios: raw.revopsScenarios && typeof raw.revopsScenarios === 'object' ? raw.revopsScenarios : {},
      revopsCompareSelection: { left: null, right: null },
      // V32.9.4 — collapse boota da última sessão, lock idem (regra new-state).
      revopsGroupCollapsed: raw.revopsGroupCollapsed && typeof raw.revopsGroupCollapsed === 'object' ? raw.revopsGroupCollapsed : {},
      revopsGroupLocked: raw.revopsGroupLocked && typeof raw.revopsGroupLocked === 'object' ? raw.revopsGroupLocked : {},
      // V32.10.0 — overrides persistem por produto entre sessões.
      revopsKpiOverrides: raw.revopsKpiOverrides && typeof raw.revopsKpiOverrides === 'object' ? raw.revopsKpiOverrides : {},
      // V32.10.7 — Handle picker é estado UI volátil (sempre fechado em F5).
      revopsHandlePickerKey: null,
      // V32.10.9 — DRE: estado de expansão da Deduções persiste por produto.
      revopsDreDeducoesExpanded: raw.revopsDreDeducoesExpanded && typeof raw.revopsDreDeducoesExpanded === 'object' ? raw.revopsDreDeducoesExpanded : {},
      // V32.12.1 — Performance Externa expand state persiste por campanha.
      campaignPerfExpanded: raw.campaignPerfExpanded && typeof raw.campaignPerfExpanded === 'object' ? raw.campaignPerfExpanded : {},
      // V32.12.2 — Modo demo persiste (cliente pode deixar ligado pra demonstração).
      campaignPerfDemoMode: !!raw.campaignPerfDemoMode,
      // V32.12.4 — Modal volátil (sempre fecha em F5 — se token ainda expirado,
      // próxima chamada 401 reabre).
      reloginInlineModal: { open: false, error: null, loading: false },
      // V32.13.1 — KR picker é volátil (sempre fecha em F5).
      strategicKrPickerOpen: null,
      // V32.13.6 — JustCreatedActionId também é volátil.
      strategicJustCreatedActionId: null,
      // V32.13.12 — Editor de ação do mind-map é volátil (F5 fecha).
      strategicMindMapActionEditor: null,
      // V32.13.16 — Detalhe execution task volátil (F5 fecha).
      executionTaskDetail: null,
      // V32.14.1 — Drill-down KR volátil.
      acompanhamentoKrDetail: null,
      // V32.14.2 — Drill-down Ação volátil.
      acompanhamentoActionDetail: null,
      // V33.0.0 — Tracker caches + modais voláteis (sempre re-fetch/fecha em F5).
      trackerVisitorsCache: { counts: null, list: [], loadedAt: null, loading: false },
      trackerStatusByCampaign: {},
      trackerWizardOpen: null,
      trackerVisitorDetail: null,
      // V33.0.0 — Resultados produto-first persiste seleção.
      selectedResultProductId: raw.selectedResultProductId ? Number(raw.selectedResultProductId) : null,
      resultsClassicMode: Boolean(raw.resultsClassicMode),
      // V33.0.0 Onda 2 — Hotmart status/wizard sempre volátil (re-fetch + fecha em F5).
      hotmartStatus: null,
      hotmartWizardOpen: null,
      // V33.0.0 Onda 3 — Cache de atribuição volátil (re-fetch ao abrir Mapa/Resultados).
      actionAttributionsCache: { byActionId: {}, sinceDays: 30, loadedAt: null, loading: false },
      // V33.0.0-alpha18 — Breakdown por LP volátil (re-fetch ao abrir card de campanha).
      campaignLpBreakdown: {},
      // V34.0.0 Onda 2 — Cache de bancos + modal de edição (voláteis, re-fetch + fecha em F5).
      leadBanksCache: { banks: [], loadedAt: null, loading: false },
      leadBankEditModal: null,
      // V34.0.0 Onda 3 — Import: banco selecionado + flag de processamento (voláteis).
      leadImportBankId: null,
      leadImportProcessing: false,
      leadImportProgress: null,
      // V34.0.0 Onda 4 — Modal de seleção de bancos + cache de resultados (voláteis).
      searchBankSelectionModal: { open: false, selected: null, pendingAction: null },
      visitorSearchResults: { visitors: [], bankIds: null, bankNames: [], loadedAt: null, loading: false, error: null },
      // V34.0.0 Onda 5 — Modal de imputar em campanha (volátil, fecha em F5).
      imputeCampaignModal: { open: false, campaignId: null, visitorIds: [], pushToRd: false, processing: false, progress: null, error: null },
      // V34.0.0 Onda 6 — Modal de identity resolution (volátil, fecha em F5).
      duplicatesModal: { open: false, loading: false, emailGroups: [], phoneGroups: [], loadedAt: null, mergingKey: null, error: null },
      // V34.6.z — Modal de backlog RD push (volátil).
      rdBacklogModal: { open: false, loading: false, campaignId: null, total: 0, byReason: {}, visitors: [], retrying: false, error: null },
      // V34.6.aa — Counts por stage de cada campanha (lj_visitor_campaign_state).
      // Map campaignId → { counts: {'marketing-tof': N, ...}, total, loadedAt }
      campaignPipelineCounts: {},
      // V34.7.f.3 — Cache do breakdown RFV por visitor (volátil)
      visitorScoreDetail: {},
      // V34.7.g — Filtro de banco no Journey Pipeline (cross-filter campanha × banco)
      selectedPipelineBankId: null,
      // V34.7.h — Config de IA do próprio user (lê via /api/user-ai-config)
      _userAiConfigCache: null,
      // V34.7.h — Draft do input da chave Anthropic (não persiste)
      _userAiKeyDraft: '',
      // V34.7.h.5 — Progresso do enrich em loop (barra 0..100%)
      enrichProgress: { running: false, total: 0, done: 0, currentBatch: 0 },
      // V34.7.h.6 — Progresso do Sync RD em loop (barra 0..100%)
      rdSyncProgress: { running: false, total: 0, done: 0, currentBatch: 0 },
      // V34.8.0 / V34.9.4 — Conciliação RD↔LJ. Sininho agrega 3 tipos:
      // conflicts (unread) + pending-stage + pending-deal. totalUnread = badge.
      reconciliationModal: { open: false, loading: false, alerts: [], stagePending: [], dealPending: [], loadedAt: null, resolvingId: null },
      pendingReconciliationCount: 0,
      reconciliationCounts: { conflictsUnread: 0, conflictsTotal: 0, pendingStage: 0, pendingDeal: 0, totalUnread: 0 },
      // V34.8.2 — Estado do botão "Conciliar" (rodar motor bidirecional sob demanda)
      reconciliationRunProgress: { running: false, phase: '', stats: null },
      // V34.9.3 — Modal de Triggers (Revenue Flow Map). Lista triggers da
      // campanha selecionada + UI pra adicionar/editar/deletar/espelhar.
      triggersModal: {
        open: false,
        loading: false,
        campaignId: null,
        triggers: [],
        draft: null,        // { from_stage, to_stage, trigger_type, ... } durante criação
        editingId: null,
        mirroringFromId: null
      },
      // V34.9.5 / V34.9.10 — Painel Score Engine.
      // Aba 'score' (visualização) tem sub-tabs ('general' | 'campaign').
      // Aba 'settings' (configuração) seleciona modelo + regras.
      scoreConfigModal: {
        open: false,
        campaignId: null,
        activeTab: 'score',
        scoreSubTab: 'general',
        activeModel: 'rfv',
        scoreRules: [],
        ruleDraft: null,
        // V34.9.11 — ICP Profile editável
        icpProfile: { fields_json: {}, tier_method: 'percentage', tier_rules_json: { tier_1: [], tier_2: [], tier_3: [] } },
        icpDraft: null
      },
      // V34.9.6 — Modal "Score Breakdown": ao clicar no badge de score do
      // lead, abre detalhamento item por item (tags, touchpoints, eventos,
      // transitions, cálculo R/F/V).
      scoreBreakdownModal: {
        open: false,
        visitorId: null,
        loading: false,
        data: null
      },
      // V34.9.20 — Modal Sub-Funil: ao clicar numa bolinha do Revenue Flow Map
      // (com campanha selecionada), abre editor do mini-funil daquela bolinha
      // naquela campanha. Cada linha = um sub-stage (nome + tag + contagem).
      subStageFunnelModal: {
        open: false,
        campaignId: null,
        parentStage: null,
        substages: [],
        knownTags: [],
        loading: false,
        savingId: null
      },
      // V35.0.0 — Modal de confirmação genérico (substitui confirm() nativo).
      confirmModal: { open: false },
      // V35.0.0 — Filtro ativo de sub-stage no Buscador.
      subStageActiveFilter: null,
      // V35.1.0 — Tab ativa do Dashboard (overview | checkout) e estado da tab Checkout.
      activeDashboardTab: 'overview',
      checkoutDashboard: {
        loadedAt: null,
        activeSubTab: 'all',           // 'all' | productIdHotmart
        period: { days: 30 },
        products: [],
        kpis: {},
        transactions: [],
        series: [],
        pagination: { limit: 50, offset: 0, total: 0 },
        // V35.2.1 — agregado de motivos de recusa + filtro ativo
        cancellationReasons: [],
        reasonFilter: null,
        othersModalOpen: false
      },
      // V35.1.1 — Painel Djow Checkout (fresh por sessão, não persiste em DB)
      djowCheckout: {
        loadedFor: null,
        summary: null,
        summaryLoading: false,
        suggestions: [],
        suggestionsLoading: false,
        messages: [],
        asking: false,
        input: ''
      },
      // V34.0.0 Onda 6.d — Counts volátil (re-fetch periódico).
      pendingCounts: { duplicateGroupsTotal: 0, duplicateGroupsEmail: 0, duplicateGroupsPhone: 0, recentMerges24h: 0, lastMergeAt: null, loadedAt: null },
      // V32.14.8 — Timestamp da última sync ClickUp persiste.
      clickupLastSyncAt: Number(raw.clickupLastSyncAt) || null,
      // V32.15.0 — Recolher por bloco no Acompanhamento persiste.
      acompanhamentoSectionsCollapsed: (() => {
        const r = raw.acompanhamentoSectionsCollapsed || {};
        return {
          krs: Boolean(r.krs),
          actions: Boolean(r.actions),
          carga: Boolean(r.carga),
          gantt: Boolean(r.gantt)
        };
      })(),
      customChannels: Array.isArray(raw.customChannels) ? raw.customChannels : [],
      customActionTypes: Array.isArray(raw.customActionTypes) ? raw.customActionTypes : [],
      executionConfig: window.ExecutionProviderRegistry?.normalize?.(raw.executionConfig) || raw.executionConfig || base.executionConfig,
      agentConfig: window.AgentRegistry?.normalize?.(raw.agentConfig) || raw.agentConfig || base.agentConfig,
      executionTasks: Array.isArray(raw.executionTasks) ? raw.executionTasks : [],
      // V32.4.1 (Geraldo Item 1) — V16.3 DjowModal aposentado. djowChats não
      // é mais persistido (history vivia ali). djowSending continua (DjowAIModal usa).
      djowSending: false,
      djowContext: null,
      showTasksModal: false,
      tasksModalActionId: null,
      showStrategicMap: false,
      strategicMapProductId: null,
      strategicMapZoom: raw.strategicMapZoom || 'strategy',
      strategicMapOnboardingSeen: raw.strategicMapOnboardingSeen && typeof raw.strategicMapOnboardingSeen === 'object' ? raw.strategicMapOnboardingSeen : {},
      strategicMaps: raw.strategicMaps && typeof raw.strategicMaps === 'object' ? raw.strategicMaps : {},
      // V32.7.1 — Persistir 5 campos que estavam sendo dropados a cada F5.
      strategicMapCampaignId: raw.strategicMapCampaignId != null ? Number(raw.strategicMapCampaignId) : null,
      strategicMapMode: (raw.strategicMapMode === 'campaign') ? 'campaign' : 'product',
      strategicSkipOnboarding: !!raw.strategicSkipOnboarding,
      strategicKrCardOpen: raw.strategicKrCardOpen && typeof raw.strategicKrCardOpen === 'object' ? raw.strategicKrCardOpen : {},
      customActionCatalog: Array.isArray(raw.customActionCatalog) ? raw.customActionCatalog : [],
      // V32.6.6 — progressive disclosure no zoom "As Ações" (boot null = nada em foco).
      strategicActiveActionId: raw.strategicActiveActionId ? Number(raw.strategicActiveActionId) : null,
      // V32.7.0 — Cache subtasks ClickUp boot sempre vazio (refresh no abrir step 6).
      // Cache em memória — se persistisse, ficaria stale entre sessões.
      clickupActionSubtasks: { byActionId: {}, fetchedAt: null, loading: false },
      // V32.7.3 — ack persiste (cliente já viu o alerta nessa raiz).
      clickupDeleteWarningAck: raw.clickupDeleteWarningAck && typeof raw.clickupDeleteWarningAck === 'object' ? raw.clickupDeleteWarningAck : null,
      // V31.0.4 — Fix core: strategicCampaignMaps (branches V29) não estava sendo
      // preservado no normalize. Causa: cada load do state limpava as branches.
      strategicCampaignMaps: raw.strategicCampaignMaps && typeof raw.strategicCampaignMaps === 'object' ? raw.strategicCampaignMaps : {},
      // V31.2.12 — Base de conhecimento: KPIs customizados aprendidos por área.
      customKpiCatalog: raw.customKpiCatalog && typeof raw.customKpiCatalog === 'object' ? raw.customKpiCatalog : {},
      strategicDjowChats: raw.strategicDjowChats && typeof raw.strategicDjowChats === 'object' ? raw.strategicDjowChats : {},
      strategicDjowDraft: '',
      strategicDjowSending: false,
      strategicObjectiveDraft: null,
      strategicOkrDraft: null,
      showQuickActionModal: false,
      quickActionContext: null,
      quickActionDraft: { name: '', campaignId: null, channel: '', actionType: '' },
      showStrategicOverview: false,
      revenueScoreBlueprints: raw.revenueScoreBlueprints && typeof raw.revenueScoreBlueprints === 'object' ? raw.revenueScoreBlueprints : {},
      revenueReadyTriggered: raw.revenueReadyTriggered && typeof raw.revenueReadyTriggered === 'object' ? raw.revenueReadyTriggered : {},
      leadOutcomes: raw.leadOutcomes && typeof raw.leadOutcomes === 'object' ? raw.leadOutcomes : {},
      leadScoreHistory: raw.leadScoreHistory && typeof raw.leadScoreHistory === 'object' ? raw.leadScoreHistory : {},
      leadEngagementHistory: raw.leadEngagementHistory && typeof raw.leadEngagementHistory === 'object' ? raw.leadEngagementHistory : {},
      negativeSelection: raw.negativeSelection && typeof raw.negativeSelection === 'object'
        ? { excludedDomains: Array.isArray(raw.negativeSelection.excludedDomains) ? raw.negativeSelection.excludedDomains : [], excludedAccounts: Array.isArray(raw.negativeSelection.excludedAccounts) ? raw.negativeSelection.excludedAccounts : [] }
        : { excludedDomains: [], excludedAccounts: [] },
      abTestVariants: raw.abTestVariants && typeof raw.abTestVariants === 'object' ? raw.abTestVariants : {},
      driftBaselines: raw.driftBaselines && typeof raw.driftBaselines === 'object' ? raw.driftBaselines : {},
      customScoreSignals: raw.customScoreSignals && typeof raw.customScoreSignals === 'object'
        ? {
            B2B: Array.isArray(raw.customScoreSignals.B2B) ? raw.customScoreSignals.B2B : [],
            B2C: Array.isArray(raw.customScoreSignals.B2C) ? raw.customScoreSignals.B2C : [],
            negative: Array.isArray(raw.customScoreSignals.negative) ? raw.customScoreSignals.negative : [],
            triggers: Array.isArray(raw.customScoreSignals.triggers) ? raw.customScoreSignals.triggers : []
          }
        : { B2B: [], B2C: [], negative: [], triggers: [] },
      showLeadDetailModal: false,
      leadDetailContext: null,
      campaignLeadLinks: raw.campaignLeadLinks && typeof raw.campaignLeadLinks === 'object' ? raw.campaignLeadLinks : {},
      profileCampaignContext: null,
      profileIcpContext: null,
      showPostScoreSearchPrompt: false,
      postScoreSearchCampaignId: null,
      rdEventLog: Array.isArray(raw.rdEventLog) ? raw.rdEventLog.slice(-200) : [],
      rdLastSyncAt: raw.rdLastSyncAt || null,
      // V34.6.p — Cursor incremental do live sync engine (preserva entre F5)
      rdWebhookLastFetchedAt: raw.rdWebhookLastFetchedAt || null,
      rdSyncRunning: false,
      showRevenueScoreCreator: false,
      revenueScoreCreatorCtx: null,
      showRevenueScoreDashboard: false,
      revenueScoreDashboardCampaignId: null,
      actionsListFilter: 'all',
      actionCreateTab: raw.actionCreateTab === 'ai' ? 'ai' : 'manual',
      actionAiDraft: { prompt: raw.actionAiDraft?.prompt || '', count: Number(raw.actionAiDraft?.count || 3) },
      flowBuilderStartFilter: 'all',
      flowBuilderZoom: 1.0,
      flowBuilderConnectionArm: null,
      flowDisconnectConfirm: null,
      flowBuilderShowHelp: false,
      showRevopsSimulationModal: false,
      revopsSimulationDraft: null,
      revopsSimulationLoadedScenarioId: null,
      showRevopsScenariosModal: false,
      showRevopsScenarioNameModal: false,
      showRevopsOkrModal: false,
      revopsOkrDraft: null,
      showRevopsFixedCostsModal: false,
      revopsFixedCostsCategory: null,
      showRevopsAcquisitionModal: false,
      // V34.6.q — profileFilters + profileActive viraram VOLÁTEIS. Antes
      // persistiam entre F5, fazendo cliente cair sempre no path legacy
      // (chip "Tem email" preservado, getGlobalLeads ativo, modal de bancos
      // não disparado). Agora reseta toda hora — força fluxo V34 limpo.
      profileQuery: '', profileFilters: [], profileActive: false,
      leadBaseInputMode: raw.leadBaseInputMode || 'manual',
      showLeadImportModal: Boolean(raw.showLeadImportModal),
      leadManualText: raw.leadManualText || '',
      leadCsvText: raw.leadCsvText || '',
      // V35.3.7+ — Wizard de import + sininho de notificações.
      // Regra: todo App.state.X novo precisa entrar em initial() E normalize().
      leadImportWizard: raw.leadImportWizard || null,
      lastSeenVersion: raw.lastSeenVersion || null,
      leadImportReports: Array.isArray(raw.leadImportReports) ? raw.leadImportReports : [],
      pendingLeadImportReports: Number(raw.pendingLeadImportReports) || 0,
      importReportsModalOpen: Boolean(raw.importReportsModalOpen),
      leadDraft: { ...base.leadDraft, ...(raw.leadDraft || {}) },
      manualLeads: Array.isArray(raw.manualLeads) ? LeadIdentityEngine.mergeMany([], raw.manualLeads.map((lead, index) => {
        const normalized = LeadParser.normalizeLead(lead, index, fallbackScoreId);
        const { score, ...plain } = normalized;
        // V21.4 BUGFIX — preserva campos do RD Live Bridge que o LeadParser descartava
        return {
          ...plain,
          score,
          tagCounters: lead.tagCounters && typeof lead.tagCounters === 'object' ? lead.tagCounters : {},
          eventHistory: Array.isArray(lead.eventHistory) ? lead.eventHistory : [],
          engagementHistory: Array.isArray(lead.engagementHistory) ? lead.engagementHistory : [],
          scoreHistory: Array.isArray(lead.scoreHistory) ? lead.scoreHistory : [],
          rdContactId: lead.rdContactId || null,
          rdContext: lead.rdContext && typeof lead.rdContext === 'object' ? lead.rdContext : null,
          outcome: lead.outcome || null,
          outcomeAt: lead.outcomeAt || null,
          lifecycleStage: lead.lifecycleStage || 'subscriber',
          lifecycleStageAt: lead.lifecycleStageAt || null,
          buyingRole: lead.buyingRole || null,
          meddic: lead.meddic || null,
          industry: lead.industry || null,
          companyRevenue: lead.companyRevenue || null,
          income: lead.income || null,
          jobTitle: lead.jobTitle || null,
          geography: lead.geography || null,
          awarenessLevel: lead.awarenessLevel || null,
          triggerEvents: Array.isArray(lead.triggerEvents) ? lead.triggerEvents : [],
          companyDomain: lead.companyDomain || null,
          cohortMonth: lead.cohortMonth || null,
          lastSyncedAt: lead.lastSyncedAt || null,
          source: lead.source || 'base global',
          createdAt: lead.createdAt || new Date().toISOString()
        };
      }), 'base global') : [],
      productDraft: { ...base.productDraft, ...(raw.productDraft || {}) },
      okrDraft: { ...base.okrDraft, ...(raw.okrDraft || {}) },
      kpiDraft: { ...base.kpiDraft, ...(raw.kpiDraft || {}), productId: raw.kpiDraft?.productId || selectedProductId || null, relatedOkrId: raw.kpiDraft?.relatedOkrId || raw.selectedOkrId || null },
      campaignDraft: { ...base.campaignDraft, ...(raw.campaignDraft || {}), productId: raw.campaignDraft?.productId || selectedProductId },
      actionDraft: { ...base.actionDraft, ...(raw.actionDraft || {}), scoreId: raw.actionDraft?.scoreId || fallbackScoreId, okrs: this.normalizeOkrs(raw.actionDraft?.okrs || base.actionDraft.okrs) },
      scoreDraft: { ...base.scoreDraft, ...(raw.scoreDraft || {}), tagRules: this.normalizeTagRules(raw.scoreDraft?.tagRules || base.scoreDraft.tagRules) },
      products,
      strategicOkrs: Array.isArray(raw.strategicOkrs) ? raw.strategicOkrs.map((okr, index) => ({ id: okr.id || `okr_strategic_${now}_${index}`, objective: okr.objective || okr.name || '', name: okr.name || okr.objective || '', keyResult: okr.keyResult || '', target: okr.target || '', current: okr.current || '', unit: okr.unit || 'R$', owner: okr.owner || '', deadline: okr.deadline || '', status: okr.status || 'Em andamento', productId: okr.productId || null, keyResults: this.normalizeKeyResults(okr.keyResults, 'product'), createdAt: okr.createdAt || nowIso })) : base.strategicOkrs,
      operationalKpis: Array.isArray(raw.operationalKpis) ? raw.operationalKpis.map((kpi, index) => ({ id: kpi.id || `kpi_operational_${now}_${index}`, name: kpi.name || 'KPI de receita', metric: kpi.metric || 'revenue', scope: kpi.scope || 'global', productId: kpi.productId || null, target: kpi.target || '', unit: kpi.unit || 'R$', frequency: kpi.frequency || 'Semanal', source: kpi.source || 'Automático pelo Revenue Engine', relatedOkrId: kpi.relatedOkrId || null, manualCurrent: kpi.manualCurrent || '', createdAt: kpi.createdAt || nowIso })) : base.operationalKpis,
      cxProjects: Array.isArray(raw.cxProjects) ? raw.cxProjects : [],
      scores,
      campaigns,
      actions: Array.isArray(raw.actions) ? raw.actions.map((action, index) => this.normalizeAction(action, index, fallbackScoreId, base)) : base.actions,
      schemaVersion: raw.schemaVersion || base.schemaVersion,
      dataCreatedAt: raw.dataCreatedAt || base.dataCreatedAt,
      lastMigrationAt: raw.lastMigrationAt || base.lastMigrationAt,
      // V23.1.1 — Campos novos do V23 que estavam sumindo no normalize
      // (auditor detectou em produção).
      lastSavedAt: raw.lastSavedAt || base.lastSavedAt || null,
      settingsRdActiveTab: ['crm','marketing'].includes(raw.settingsRdActiveTab)
        ? raw.settingsRdActiveTab
        : (base.settingsRdActiveTab || 'crm'),
      rdAssistantDismissed: Boolean(raw.rdAssistantDismissed),
      rdMarketingSkipped: Boolean(raw.rdMarketingSkipped),
      // V24.1.0 — Mailings RD (segmentações criadas a partir do Buscador de Perfil)
      rdMailings: Array.isArray(raw.rdMailings) ? raw.rdMailings : [],
      showRdMailingModal: false, // sempre fechado no boot
      rdMailingDraft: (raw.rdMailingDraft && typeof raw.rdMailingDraft === 'object')
        ? raw.rdMailingDraft
        : { name: '', campaignId: '', targetStage: 'mkt_tof' },
      rdMailingSending: false, // sempre false no boot
      rdMailingProgress: null, // V34.6.m — { current, total } durante o envio batch
      // V24.1.0 — Cache + refresh manual (auto-loops desligados)
      rdLastManualRefreshAt: raw.rdLastManualRefreshAt || null,
      rdRefreshing: false, // sempre false no boot
      // V25.0.0 — Home: produto vigente do Pulso (rotação random 7s)
      homeProductIndex: Number.isFinite(Number(raw.homeProductIndex)) ? Number(raw.homeProductIndex) : 0,
      // V26.0.0 — Djow AI (Claude assistant)
      djowConfig: (raw.djowConfig && typeof raw.djowConfig === 'object')
        ? { model: raw.djowConfig.model || 'claude-sonnet-4-6', allowedRoles: Array.isArray(raw.djowConfig.allowedRoles) ? raw.djowConfig.allowedRoles : ['master'] }
        : { model: 'claude-sonnet-4-6', allowedRoles: ['master'] },
      djowStatus: null, // preenchido em background por Actions.loadDjowStatus
      djowConversation: (raw.djowConversation && typeof raw.djowConversation === 'object')
        ? { id: raw.djowConversation.id || null, messages: Array.isArray(raw.djowConversation.messages) ? raw.djowConversation.messages.slice(-40) : [] }
        : { id: null, messages: [] },
      djowOpen: false,    // sempre fechado no boot
      djowSending: false, // sempre false no boot
      djowInput: '',
      // V31.2.35 — Preserva campos ClickUp do raw, ou usa default. ANTES esses
      // sumiam silenciosamente em cada normalize, fazendo o user perder a UI
      // de "Conectado" mesmo com credentials válidas no DB.
      clickupStatus: (raw.clickupStatus && typeof raw.clickupStatus === 'object')
        ? {
            connected: !!raw.clickupStatus.connected,
            configured: !!raw.clickupStatus.configured,
            encryptionReady: raw.clickupStatus.encryptionReady !== false,
            workspaceName: raw.clickupStatus.workspaceName || null,
            // V32.5.6 — tokenType diferencia método de conexão na UI
            tokenType: raw.clickupStatus.tokenType || null,
            // V32.1.3 — preserva list info do raw em F5
            defaultListId: raw.clickupStatus.defaultListId || null,
            defaultListName: raw.clickupStatus.defaultListName || null,
            defaultSpaceId: raw.clickupStatus.defaultSpaceId || null,
            // V32.1.4-1.6 — preserva settings de marcação + status_map + write
            ljTagName: raw.clickupStatus.ljTagName || null,
            taskPrefix: raw.clickupStatus.taskPrefix || null,
            statusMap: raw.clickupStatus.statusMap || null,
            writeEnabled: raw.clickupStatus.writeEnabled !== false,
            // V32.2.0 — preserva mirror config
            ljSpaceId: raw.clickupStatus.ljSpaceId || null,
            mirrorEnabled: raw.clickupStatus.mirrorEnabled !== false
          }
        : base.clickupStatus,
      clickupMeta: (raw.clickupMeta && typeof raw.clickupMeta === 'object')
        ? {
            loaded: !!raw.clickupMeta.loaded,
            loadedAt: raw.clickupMeta.loadedAt || null,
            workspaceId: raw.clickupMeta.workspaceId || null,
            listId: raw.clickupMeta.listId || null,
            spaceId: raw.clickupMeta.spaceId || null,
            members: Array.isArray(raw.clickupMeta.members) ? raw.clickupMeta.members : [],
            statuses: Array.isArray(raw.clickupMeta.statuses) ? raw.clickupMeta.statuses : [],
            tags: Array.isArray(raw.clickupMeta.tags) ? raw.clickupMeta.tags : [],
            customFields: Array.isArray(raw.clickupMeta.customFields) ? raw.clickupMeta.customFields : []
          }
        : base.clickupMeta,
      clickupConfigDraft: (raw.clickupConfigDraft && typeof raw.clickupConfigDraft === 'object')
        ? { client_id: String(raw.clickupConfigDraft.client_id || ''), client_secret: String(raw.clickupConfigDraft.client_secret || '') }
        : base.clickupConfigDraft,
      clickupPatDraft: typeof raw.clickupPatDraft === 'string' ? raw.clickupPatDraft : '',
      // V32.5.6 — tab ativo no card ClickUp + draft do form OAuth.
      clickupConnectTab: (raw.clickupConnectTab === 'pat') ? 'pat' : 'oauth',
      clickupOAuthDraft: (raw.clickupOAuthDraft && typeof raw.clickupOAuthDraft === 'object')
        ? { clientId: String(raw.clickupOAuthDraft.clientId || ''), clientSecret: String(raw.clickupOAuthDraft.clientSecret || '') }
        : { clientId: '', clientSecret: '' },
      // V32.5.8 — estado persistente do <details> "Configurações avançadas".
      clickupAdvancedOpen: !!raw.clickupAdvancedOpen,
      // V32.9.2 — Cache fields ClickUp por list. Boot vazio (refetched on demand).
      clickupListFieldsCache: {},
      // V32.5.9 → V32.6.0 — Wizard sempre boota fechado (UI state).
      // Tree refetched ao abrir.
      clickupSpaceWizard: {
        open: false,
        loading: false,
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
      },
      // Modais ficam SEMPRE fechados no boot (UI state, não persiste aberto)
      taskCreationModal: null,
      djowTaskChat: null,
      // V31.2.41 — Persiste rdConnectionStatus do raw; modal e flag de teste sempre resetam no boot.
      rdConnectionStatus: (raw.rdConnectionStatus && typeof raw.rdConnectionStatus === 'object')
        ? {
            crm_pat: { ...base.rdConnectionStatus.crm_pat, ...(raw.rdConnectionStatus.crm_pat || {}) },
            marketing_oauth: { ...base.rdConnectionStatus.marketing_oauth, ...(raw.rdConnectionStatus.marketing_oauth || {}) },
            crm_oauth: { ...base.rdConnectionStatus.crm_oauth, ...(raw.rdConnectionStatus.crm_oauth || {}) }
          }
        : base.rdConnectionStatus,
      rdInfoModal: null,
      rdTestingConnections: false,
      // V31.2.54 — Preserva webhooks RD do raw. ANTES sumiam silenciosamente
      // a cada F5 (mesmo padrão do bug clickupStatus V31.2.35), fazendo user
      // ter que recadastrar webhook toda vez que atualizava a página.
      rdWebhooks: Array.isArray(raw.rdWebhooks)
        ? raw.rdWebhooks.filter(w => w && typeof w === 'object' && w.eventName).map(w => ({
            id: String(w.id || ''),
            eventName: String(w.eventName),
            url: String(w.url || ''),
            createdAt: String(w.createdAt || ''),
            alreadyExistedAtRd: Boolean(w.alreadyExistedAtRd)
          }))
        : [],
      rdWebhookRegistrationError: typeof raw.rdWebhookRegistrationError === 'string' ? raw.rdWebhookRegistrationError : '',
      rdWebhooksLastSyncAt: raw.rdWebhooksLastSyncAt || null,
      // V32.0.12 — Multi-tenant admin: lista de tenants e drafts de connection
      // string. _tenantsListCache nunca persiste no localStorage (sempre fetch
      // fresco) mas listamos pra normalize não dropar enquanto a sessão tá ativa.
      _tenantsListCache: Array.isArray(raw._tenantsListCache) ? raw._tenantsListCache : [],
      tenantPlugDraft: (raw.tenantPlugDraft && typeof raw.tenantPlugDraft === 'object') ? raw.tenantPlugDraft : {},
      // V32.0.16 — Cache + draft de execution_credentials.
      _executionCredentialsCache: Array.isArray(raw._executionCredentialsCache) ? raw._executionCredentialsCache : [],
      trelloConnectDraft: (raw.trelloConnectDraft && typeof raw.trelloConnectDraft === 'object')
        ? {
            apiKey: String(raw.trelloConnectDraft.apiKey || ''),
            token: String(raw.trelloConnectDraft.token || ''),
            board: String(raw.trelloConnectDraft.board || ''),
            listTodo: String(raw.trelloConnectDraft.listTodo || ''),
            listDone: String(raw.trelloConnectDraft.listDone || '')
          }
        : { apiKey: '', token: '', board: '', listTodo: '', listDone: '' },
      // V32.1.1 — drafts do form "Meu Banco". Nunca persiste erro de tentativa anterior.
      tenantDbPlugDraft: typeof raw.tenantDbPlugDraft === 'string' ? raw.tenantDbPlugDraft : '',
      tenantDbPlugError: '',
      // V32.1.2 — draft do nome em "Minha Conta".
      profileDisplayNameDraft: typeof raw.profileDisplayNameDraft === 'string' ? raw.profileDisplayNameDraft : '',
      // V32.5.7 — sub-aba ativa em Minha Conta
      myAccountTab: (raw.myAccountTab === 'products') ? 'products' : 'identity',
      // V32.1.3 — Modal de list-picker do ClickUp. Modal sempre fechado no boot;
      // cache nunca persiste (re-fetch sob demanda).
      showClickupListPicker: false,
      _clickupTreeCache: null,
      clickupTreeLoading: false,
      // V32.1.4 — drafts dos campos de marcação (tag + prefix). Inicializa vazio
      // e UI usa current value como placeholder. Limpa após save.
      clickupMarkerDrafts: (raw.clickupMarkerDrafts && typeof raw.clickupMarkerDrafts === 'object')
        ? {
            ljTagName: String(raw.clickupMarkerDrafts.ljTagName || ''),
            taskPrefix: String(raw.clickupMarkerDrafts.taskPrefix || '')
          }
        : { ljTagName: '', taskPrefix: '' },
      // V32.1.5 — drafts do status_map (pending/in_progress/completed → status real).
      clickupStatusMapDraft: (raw.clickupStatusMapDraft && typeof raw.clickupStatusMapDraft === 'object')
        ? {
            pending: String(raw.clickupStatusMapDraft.pending || ''),
            in_progress: String(raw.clickupStatusMapDraft.in_progress || ''),
            completed: String(raw.clickupStatusMapDraft.completed || '')
          }
        : { pending: '', in_progress: '', completed: '' },
      // V32.2.0 — Mappings cache nunca persiste (refresh sob demanda).
      _clickupMappingsCache: null
    };
  },
  load() {
    let raw = null;
    let usedBackup = false;
    try {
      raw = StorageAdapter.loadRaw();
    } catch (error) {
      console.warn('Falha ao ler localStorage principal:', error);
    }
    // V22.1.1 — Safety net contra reset silencioso:
    // se o raw veio vazio/sem dados E existe backup com dados, RESTAURA do backup.
    // Isso previne perda quando algo na cadeia de load/save zera o key principal.
    if (!raw || !StorageAdapter._hasRealData?.(JSON.stringify(raw))) {
      const backup = StorageAdapter.findBackupWithData?.();
      if (backup?.data) {
        console.warn(`[State.load] Main key vazio/sem dados — restaurado do backup slot ${backup.slot}.`);
        raw = backup.data;
        usedBackup = true;
      }
    }
    try {
      const normalized = raw ? this.normalize(raw) : this.initial();
      if (raw) this._auditLostFields(raw, normalized);
      const migrated = DatabaseService.applyMigrations(normalized);
      // Se restaurou do backup, salva imediato no main key pra reestabelecer.
      if (usedBackup) {
        try { StorageAdapter.saveRaw(migrated); } catch (_) {}
      }
      return migrated;
    } catch (error) {
      console.warn('Falha ao normalizar estado:', error);
      // Última tentativa: tenta restaurar de backup mesmo após erro de normalize
      const backup = !usedBackup && StorageAdapter.findBackupWithData?.();
      if (backup?.data) {
        console.warn(`[State.load] Normalize falhou — tentando backup slot ${backup.slot} como fallback.`);
        try {
          const normalized = this.normalize(backup.data);
          return DatabaseService.applyMigrations(normalized);
        } catch (_) { /* desiste */ }
      }
      return this.initial();
    }
  },

  _auditLostFields(raw, normalized) {
    try {
      const transient = new Set([
        'showSettingsModal','databaseTesting','showDatabaseTutorial',
        // V32.4.0 — flags V11 railway/database removidas.
        // V32.4.1 — flags V16.3 DjowModal removidas (showDjowModal, djowModalActionId, etc).
        'showActionEditModal','actionEditDraft','showFlowBuilderModal','flowBuilderCampaignId',
        'showLpModal','lpDraft','djowSending','djowContext',
        'showTasksModal','tasksModalActionId','showStrategicMap','strategicMapProductId',
        'strategicDjowDraft','strategicDjowSending','strategicObjectiveDraft','strategicOkrDraft',
        'showQuickActionModal','quickActionContext','quickActionDraft','showStrategicOverview',
        'showLeadDetailModal','leadDetailContext','profileCampaignContext','profileIcpContext',
        'showPostScoreSearchPrompt','postScoreSearchCampaignId','rdSyncRunning',
        'showRevenueScoreCreator','revenueScoreCreatorCtx','showRevenueScoreDashboard','revenueScoreDashboardCampaignId',
        'actionsListFilter','flowBuilderStartFilter','flowBuilderZoom','flowBuilderConnectionArm','flowDisconnectConfirm','flowBuilderShowHelp',
        'showRevopsSimulationModal','revopsSimulationDraft','revopsSimulationLoadedScenarioId',
        'showRevopsScenariosModal','showRevopsScenarioNameModal','showRevopsOkrModal','revopsOkrDraft',
        'showRevopsFixedCostsModal','revopsFixedCostsCategory','showRevopsAcquisitionModal',
        // V35.4.2 — Runtime-only (não persiste). Prefix '_' indica internal.
        '_reconciliationLastLoadedAt','_knownTagsCache','_subStagePreviewCache',
        '_djowShortcutBound','_djowSearchRunning','_enrichRunning','_rdContactSyncRunning',
        '_subStageSaveTimers'
      ]);
      const lost = [];
      for (const key of Object.keys(raw)) {
        if (transient.has(key)) continue;
        if (raw[key] == null) continue;
        if (key in normalized) continue;
        lost.push(key);
      }
      if (lost.length) {
        console.warn('[State.load] Campos persistidos NÃO mapeados em normalize() — risco de perda de dados:', lost);
      }
    } catch (_) { /* defensive */ }
  },
  save() { StorageAdapter.saveRaw(App.state); }
};
window.State = State;
