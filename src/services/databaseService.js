var DatabaseService = {
  providers: [
    { id: 'local', label: 'Local', icon: 'hard-drive' },
    { id: 'supabase', label: 'Supabase', icon: 'database' },
    { id: 'amazon', label: 'Amazon', icon: 'cloud' },
    { id: 'railway', label: 'Railway', icon: 'train' }
  ],
  amazonTypes: [
    { id: 'rds-postgres', label: 'Amazon RDS PostgreSQL', port: '5432' },
    { id: 'rds-mysql', label: 'Amazon RDS MySQL', port: '3306' },
    { id: 'aurora', label: 'Amazon Aurora', port: '5432' },
    { id: 'dynamodb', label: 'Amazon DynamoDB', port: '' }
  ],
  localFileName: 'leadjourney-db.json',
  schemaVersion: '11.2.0',
  migrationHistoryFileName: 'migration-history.json',
  manifestFileName: 'manifest.json',
  _directoryHandle: null,
  _autoSaveTimer: null,
  _autoSaveRunning: false,
  defaultConfig() {
    return {
      provider: 'local',
      local: {
        mode: 'folder',
        namespace: 'leadscore_local_db',
        autosync: true,
        folderPath: '',
        folderLabel: '',
        fileName: this.localFileName,
        lastFolderPermission: null,
        lastFolderWriteAt: null,
        lastFolderReadAt: null,
        browserStorageFallback: true,
        desktopEnabled: this.isDesktop()
      },
      supabase: { url: '', anonKey: '', schema: 'public' },
      amazon: {
        type: 'rds-postgres', region: 'sa-east-1', endpoint: '', port: '5432', database: '', username: '', password: '', apiGatewayUrl: '', tablePrefix: 'leadscore_'
      },
      railway: {
        mode: 'url',
        engine: 'postgres',
        projectName: '',
        serviceName: '',
        databaseUrl: '',
        host: '',
        port: '5432',
        database: '',
        username: '',
        password: '',
        ssl: true,
        schema: 'public',
        tablePrefix: 'leadjourney_',
        environment: 'production',
        proxyUrl: '',
        savedAt: null,
        lastTest: null,
        lastTestResults: null,
        stability: null,
        markedAsPrimary: false
      },
      lastTest: null,
      savedAt: null,
      schemaVersion: this.schemaVersion,
      migrationsEnabled: true,
      backupsEnabled: true,
      integrityCheckEnabled: true
    };
  },
  isDesktop() { return typeof window !== 'undefined' && Boolean(window.leadJourneyDesktop?.isElectron); },
  normalize(config) {
    const base = this.defaultConfig();
    const raw = config && typeof config === 'object' ? config : {};
    return {
      ...base,
      ...raw,
      local: { ...base.local, ...(raw.local || {}), desktopEnabled: this.isDesktop() },
      supabase: { ...base.supabase, ...(raw.supabase || {}) },
      amazon: { ...base.amazon, ...(raw.amazon || {}) },
      railway: { ...base.railway, ...(raw.railway || {}) },
      provider: ['local', 'supabase', 'amazon', 'railway'].includes(raw.provider) ? raw.provider : 'local'
    };
  },
  providerLabel(provider) { return (this.providers.find(item => item.id === provider) || this.providers[0]).label; },
  amazonTypeLabel(type) { return (this.amazonTypes.find(item => item.id === type) || this.amazonTypes[0]).label; },
  supportsDirectoryPicker() { return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function'; },
  async openHandleDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('leadjourney_local_folder_handles', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('handles');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  async saveDirectoryHandle(handle) {
    this._directoryHandle = handle;
    const db = await this.openHandleDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put(handle, 'primary');
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  },
  async loadDirectoryHandle() {
    if (this._directoryHandle) return this._directoryHandle;
    if (!('indexedDB' in window)) return null;
    try {
      const db = await this.openHandleDb();
      const handle = await new Promise((resolve, reject) => {
        const tx = db.transaction('handles', 'readonly');
        const request = tx.objectStore('handles').get('primary');
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
      db.close();
      this._directoryHandle = handle || null;
      return this._directoryHandle;
    } catch (error) {
      console.warn('Não foi possível recuperar a pasta local:', error);
      return null;
    }
  },
  async ensureDirectoryPermission(handle, mode = 'readwrite') {
    if (!handle || !handle.queryPermission || !handle.requestPermission) return false;
    const opts = { mode };
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    return (await handle.requestPermission(opts)) === 'granted';
  },
  async chooseLocalDirectory(config) {
    if (this.isDesktop()) {
      const result = await window.leadJourneyDesktop.selectFolder();
      return result.ok ? { ...result, message: result.message } : result;
    }
    if (!this.supportsDirectoryPicker()) return { ok: false, message: 'Seu navegador não permite escolher pasta local. Use Chrome/Edge ou rode o app desktop Electron.' };
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'leadjourney-local-db' });
      const permission = await this.ensureDirectoryPermission(handle, 'readwrite');
      if (!permission) return { ok: false, message: 'Permissão de escrita não concedida para a pasta.' };
      await this.saveDirectoryHandle(handle);
      return { ok: true, handle, label: handle.name, path: config?.local?.folderPath || handle.name, message: `Pasta selecionada: ${handle.name}` };
    } catch (error) {
      return { ok: false, message: error?.name === 'AbortError' ? 'Seleção de pasta cancelada.' : `Falha ao selecionar pasta: ${error.message}` };
    }
  },
  buildSnapshot(appState) {
    const safeState = { ...(appState || {}) };
    delete safeState.showSettingsModal;
    delete safeState.databaseTestResult;
    return {
      version: 'v11.2-persistent-data-layer',
      schemaVersion: this.schemaVersion,
      exportedAt: new Date().toISOString(),
      app: 'LeadScore Journey',
      data: safeState,
      integrity: this.integrityReport(safeState),
      summary: {
        products: (safeState.products || []).length,
        campaigns: (safeState.campaigns || []).length,
        actions: (safeState.actions || []).length,
        leads: (safeState.manualLeads || []).length,
        scores: (safeState.scores || []).length
      }
    };
  },
  async writeSnapshotToFolder(appState, config) {
    const cfg = this.normalize(config);
    const fileName = cfg.local.fileName || this.localFileName;
    const snapshot = this.buildSnapshot(appState);
    if (this.isDesktop()) {
      const folderPath = cfg.local.folderPath;
      if (!folderPath) return { ok: false, message: 'Informe ou escolha uma pasta local para gravar no computador.' };
      const result = await window.leadJourneyDesktop.saveSnapshot({ folderPath, fileName, snapshot });
      return { ...result, savedAt: snapshot.exportedAt, summary: snapshot.summary };
    }
    const handle = await this.loadDirectoryHandle();
    if (!handle) return { ok: false, message: 'Nenhuma pasta local vinculada. Clique em “Escolher pasta”.' };
    const permission = await this.ensureDirectoryPermission(handle, 'readwrite');
    if (!permission) return { ok: false, message: 'Permissão para gravar na pasta não foi concedida.' };
    const fileHandle = await handle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(snapshot, null, 2));
    await writable.close();
    return { ok: true, message: `Dados salvos em ${handle.name}/${fileName}.`, folderLabel: handle.name, savedAt: snapshot.exportedAt, summary: snapshot.summary };
  },
  async readSnapshotFromFolder(config) {
    const cfg = this.normalize(config);
    const fileName = cfg.local.fileName || this.localFileName;
    if (this.isDesktop()) {
      const folderPath = cfg.local.folderPath;
      if (!folderPath) return { ok: false, message: 'Informe ou escolha uma pasta local para ler no computador.' };
      const result = await window.leadJourneyDesktop.readSnapshot({ folderPath, fileName });
      return result.ok ? { ...result, loadedAt: new Date().toISOString() } : result;
    }
    const handle = await this.loadDirectoryHandle();
    if (!handle) return { ok: false, message: 'Nenhuma pasta local vinculada. Clique em “Escolher pasta”.' };
    const permission = await this.ensureDirectoryPermission(handle, 'read');
    if (!permission) return { ok: false, message: 'Permissão para ler a pasta não foi concedida.' };
    try {
      const fileHandle = await handle.getFileHandle(fileName, { create: false });
      const file = await fileHandle.getFile();
      const snapshot = JSON.parse(await file.text());
      return { ok: true, message: `Snapshot carregado de ${handle.name}/${fileName}.`, snapshot, loadedAt: new Date().toISOString() };
    } catch (error) { return { ok: false, message: `Não foi possível ler o arquivo local: ${error.message}` }; }
  },
  async queueAutoSave(appState) {
    const cfg = this.normalize(appState?.databaseConfig);
    if (cfg.provider !== 'local' || !cfg.local.autosync || cfg.local.mode !== 'folder') return;
    if (this._autoSaveTimer) clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer = setTimeout(async () => {
      if (this._autoSaveRunning) return;
      this._autoSaveRunning = true;
      try {
        const result = await this.writeSnapshotToFolder(appState, cfg);
        if (result.ok && appState?.databaseConfig?.local) {
          appState.databaseConfig.local.lastFolderWriteAt = result.savedAt || new Date().toISOString();
          appState.databaseConfig.local.folderLabel = result.folderLabel || appState.databaseConfig.local.folderLabel;
        }
      } catch (error) {
        console.warn('AutoSave local falhou:', error);
      } finally { this._autoSaveRunning = false; }
    }, 1200);
  },
  shouldHydrateFromLocalFolder(appState) {
    const cfg = this.normalize(appState?.databaseConfig);
    return cfg.provider === 'local' && cfg.local.mode === 'folder' && Boolean(cfg.local.folderPath) && cfg.local.autosync;
  },
  emptyDataState() {
    const base = State?.initial ? State.initial() : {};
    return this.applyMigrations({
      ...base,
      products: [],
      campaigns: [],
      actions: [],
      manualLeads: [],
      selectedProductId: null,
      selectedCampaignId: null,
      selectedActionId: null,
      activeTab: 'products'
    });
  },
  applyMigrations(state) {
    const working = { ...(state || {}) };
    working.products = Array.isArray(working.products) ? working.products : [];
    working.campaigns = Array.isArray(working.campaigns) ? working.campaigns : [];
    working.actions = Array.isArray(working.actions) ? working.actions : [];
    working.manualLeads = Array.isArray(working.manualLeads) ? working.manualLeads : [];
    working.cxProjects = Array.isArray(working.cxProjects) ? working.cxProjects : [];
    working.campaigns = working.campaigns.map(campaign => ({
      ...campaign,
      productId: campaign.productId || working.selectedProductId || null
    }));
    working.actions = working.actions.map(action => {
      const originSector = action.originSector || action.sector || 'Marketing';
      const originFunnel = action.originFunnel || action.funnel || 'MOF';
      const destinationSector = action.destinationSector || originSector;
      const destinationFunnel = action.destinationFunnel || originFunnel;
      return {
        ...action,
        originSector,
        originFunnel,
        destinationSector,
        destinationFunnel,
        flowPath: Array.isArray(action.flowPath) && action.flowPath.length ? action.flowPath : FlowResolutionEngine.resolve(originSector, originFunnel, destinationSector, destinationFunnel),
        okrs: State.normalizeOkrs ? State.normalizeOkrs(action.okrs || []) : (action.okrs || [])
      };
    });
    if (working.selectedProductId && !working.products.some(product => Number(product.id) === Number(working.selectedProductId))) working.selectedProductId = working.products[0]?.id || null;
    if (working.selectedCampaignId && !working.campaigns.some(campaign => Number(campaign.id) === Number(working.selectedCampaignId))) working.selectedCampaignId = working.campaigns[0]?.id || null;
    if (working.selectedActionId && !working.actions.some(action => Number(action.id) === Number(working.selectedActionId))) working.selectedActionId = null;
    working.schemaVersion = this.schemaVersion;
    working.lastMigrationAt = new Date().toISOString();
    return working;
  },
  integrityReport(state) {
    const products = Array.isArray(state?.products) ? state.products : [];
    const campaigns = Array.isArray(state?.campaigns) ? state.campaigns : [];
    const actions = Array.isArray(state?.actions) ? state.actions : [];
    const productIds = new Set(products.map(product => Number(product.id)));
    const campaignIds = new Set(campaigns.map(campaign => Number(campaign.id)));
    const orphanCampaigns = campaigns.filter(campaign => campaign.productId && !productIds.has(Number(campaign.productId))).length;
    const orphanActions = actions.filter(action => action.campaignId && !campaignIds.has(Number(action.campaignId))).length;
    return {
      ok: orphanCampaigns === 0 && orphanActions === 0,
      checkedAt: new Date().toISOString(),
      schemaVersion: this.schemaVersion,
      counts: { products: products.length, campaigns: campaigns.length, actions: actions.length, leads: (state?.manualLeads || []).length },
      issues: { orphanCampaigns, orphanActions }
    };
  },
  tutorial(provider, amazonType) {
    if (provider === 'local') return this.isDesktop() ? [
      'No app desktop, você pode digitar exatamente o caminho da pasta local que deseja controlar.',
      'Exemplo: D:/Empresas/LeadJourney ou C:/LeadJourneyData.',
      'Clique em “Testar conexão” para o app criar/validar a estrutura database, backups, uploads, exports e config.',
      'O arquivo principal será gravado em database/leadjourney-db.json e cada salvamento gera backup em backups/.',
      'Com Sincronização local ativada, o app salva automaticamente após alterações.'
    ] : [
      'Informe o caminho desejado no campo “Caminho da pasta” para controle operacional e auditoria.',
      'Clique em “Escolher pasta no computador” para o navegador receber permissão real de gravação.',
      'O app gravará um arquivo leadjourney-db.json dentro da pasta escolhida.',
      'Por segurança, navegador puro não grava apenas por caminho digitado. Ele precisa da autorização da pasta.',
      'Depois clique em “Testar conexão” e “Salvar configuração”. Use “Sincronizar dados” para gravar o snapshot atual.'
    ];
    if (provider === 'supabase') return ['No Supabase, crie um projeto e copie a Project URL.', 'Em Project Settings > API, copie a anon public key.', 'Cole URL e anon key aqui. A schema padrão pode ficar como public.', 'Depois crie as tabelas do LeadScore ou use uma migration futura.', 'Clique em Testar conexão para validar se a API REST respondeu.'];
    if (provider === 'railway') return [
      'Acesse sua conta Railway em https://railway.app.',
      'Abra o projeto onde está seu banco operacional.',
      'Clique no serviço de banco (PostgreSQL ou MySQL).',
      'Abra a aba Variables ou Connect e copie a variável DATABASE_URL.',
      'Cole o valor no campo DATABASE_URL aqui no LeadJourney.',
      'Clique em Testar conexão Railway. O LeadJourney rodará 5 testes seguidos para medir estabilidade.',
      'Se quiser, deixe um proxy HTTPS preenchido (Vercel Function, Railway App público) — o navegador não conecta direto no Postgres/MySQL, então o proxy garante teste real.',
      'Salve a configuração. O LeadJourney mantém fallback local, então seus dados não se perdem.'
    ];
    const type = amazonType || 'rds-postgres';
    if (type === 'dynamodb') return ['No AWS DynamoDB, crie tabelas para produtos, campanhas, ações, leads, okrs e eventos.', 'Configure região, prefixo das tabelas e preferencialmente uma API Gateway/Lambda para acesso seguro.', 'Não exponha Access Key e Secret no front-end. Use backend/proxy.', 'O teste no navegador valida a configuração e, se houver API Gateway, tenta chamar o endpoint.'];
    if (type === 'rds-mysql') return ['No Amazon RDS, crie uma instância MySQL.', 'Copie endpoint, porta 3306, database, usuário e senha.', 'Por segurança, o navegador não deve conectar direto no RDS. Use uma API backend ou Vercel Function.', 'Deixe os dados salvos aqui para o app saber qual conector usar quando o backend estiver ativo.'];
    if (type === 'aurora') return ['No Amazon Aurora, escolha compatibilidade PostgreSQL ou MySQL.', 'Configure endpoint do cluster, região, porta, database e credenciais.', 'O ideal é conectar por backend/proxy, nunca expondo senha no front-end.', 'Se quiser acesso serverless, use Data API quando disponível.'];
    return ['No Amazon RDS PostgreSQL, crie uma instância PostgreSQL.', 'Copie endpoint, porta 5432, database, usuário e senha.', 'Por segurança, use uma API backend/Vercel Function para conectar ao banco.', 'O app deixará tudo preparado para o conector, mas não expõe conexão SQL direta no browser.'];
  },
  async testConnection(config) {
    const cfg = this.normalize(config);
    const now = new Date().toISOString();
    if (cfg.provider === 'local') {
      if (cfg.local.mode === 'folder') {
        if (this.isDesktop()) {
          if (!cfg.local.folderPath) return { ok: false, provider: 'local', message: 'Informe ou escolha uma pasta local.', testedAt: now };
          const result = await window.leadJourneyDesktop.testFolder({ folderPath: cfg.local.folderPath });
          return { ok: result.ok, provider: 'local', message: result.message, testedAt: now };
        }
        const handle = await this.loadDirectoryHandle();
        if (!handle) return { ok: false, provider: 'local', message: 'Modo pasta local ativo. Escolha uma pasta no computador para testar.', testedAt: now };
        const permission = await this.ensureDirectoryPermission(handle, 'readwrite');
        return { ok: permission, provider: 'local', message: permission ? `Pasta local pronta: ${handle.name}/${cfg.local.fileName || this.localFileName}` : 'Sem permissão para ler/gravar na pasta.', testedAt: now };
      }
      try {
        const key = `${cfg.local.namespace || 'leadscore_local_db'}__connection_test`;
        localStorage.setItem(key, JSON.stringify({ ok: true, at: now }));
        const ok = JSON.parse(localStorage.getItem(key) || '{}').ok === true;
        return { ok, provider: 'local', message: ok ? 'Banco local pronto no navegador.' : 'Falha no teste local.', testedAt: now };
      } catch (error) { return { ok: false, provider: 'local', message: `Falha no localStorage: ${error.message}`, testedAt: now }; }
    }
    if (cfg.provider === 'supabase') {
      if (!cfg.supabase.url || !cfg.supabase.anonKey) return { ok: false, provider: 'supabase', message: 'Preencha URL e anon key do Supabase.', testedAt: now };
      try {
        const url = String(cfg.supabase.url).replace(/\/$/, '');
        const response = await fetch(`${url}/rest/v1/`, { method: 'GET', headers: { apikey: cfg.supabase.anonKey, Authorization: `Bearer ${cfg.supabase.anonKey}` } });
        return { ok: response.status < 500, provider: 'supabase', message: response.status < 500 ? `Supabase respondeu HTTP ${response.status}. Configuração válida para iniciar.` : `Supabase respondeu HTTP ${response.status}.`, testedAt: now };
      } catch (error) { return { ok: false, provider: 'supabase', message: `Não foi possível chamar o Supabase: ${error.message}`, testedAt: now }; }
    }
    if (cfg.provider === 'amazon') {
      if (cfg.amazon.apiGatewayUrl) {
        try { const response = await fetch(cfg.amazon.apiGatewayUrl, { method: 'GET' }); return { ok: response.status < 500, provider: 'amazon', message: `API Gateway respondeu HTTP ${response.status}.`, testedAt: now }; }
        catch (error) { return { ok: false, provider: 'amazon', message: `Falha ao chamar API Gateway: ${error.message}`, testedAt: now }; }
      }
      const hasEndpoint = cfg.amazon.endpoint && cfg.amazon.region && (cfg.amazon.type === 'dynamodb' || (cfg.amazon.database && cfg.amazon.username));
      return { ok: Boolean(hasEndpoint), provider: 'amazon', message: hasEndpoint ? `${this.amazonTypeLabel(cfg.amazon.type)} configurado. Para conexão real, conecte um backend/API Gateway.` : 'Preencha os dados mínimos da Amazon.', testedAt: now };
    }
    return { ok: false, provider: cfg.provider, message: 'Provedor desconhecido.', testedAt: now };
  }
};
window.DatabaseService = DatabaseService;
