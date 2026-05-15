var App = {
      state: null,
      init() {
        this.state = State.load();
        this.ensureRuntimeStateV1301();
        this.runTests();
        this.render();
        this.hydrateFromConfiguredDatabase();
      },

      ensureRuntimeStateV1301() {
        this.state = this.state || {};
        this.state.integrations = this.state.integrations || {};
        this.state.integrations.rd = {
          ...(window.RDConfig ? RDConfig.defaultConfig() : {}),
          ...(this.state.integrations.rd || {})
        };
        this.state.integrations.rdCrm = {
          ...(window.RdCrmConfig ? RdCrmConfig.defaultConfig() : {}),
          ...(this.state.integrations.rdCrm || {})
        };
        this.state.rdCrmLeadTags = this.state.rdCrmLeadTags || {};
        this.state.actions = (this.state.actions || []).map(action => ({
          ...action,
          kpis: Array.isArray(action.kpis) ? action.kpis : [],
          okrs: Array.isArray(action.okrs) ? action.okrs : [],
          rdCrmEnabled: Boolean(action.rdCrmEnabled),
          rdCrmPipelineId: action.rdCrmPipelineId || '',
          rdCrmStartStageId: action.rdCrmStartStageId || '',
          rdCrmEndStageId: action.rdCrmEndStageId || '',
          flow: window.FlowEngine ? FlowEngine.normalize(action.flow, action) : action.flow
        }));
        this.state.lpEvents = Array.isArray(this.state.lpEvents) ? this.state.lpEvents : [];
        this.state.lpRegistry = this.state.lpRegistry && typeof this.state.lpRegistry === 'object' ? this.state.lpRegistry : {};
        if (window.RdCrmSyncEngine) {
          try { RdCrmSyncEngine.bootstrap(); } catch (error) { console.warn('RD CRM bootstrap falhou:', error); }
        }
        // V21 — auto-start do Live Event Bridge quando RD CRM está configurado
        if (window.RdCrmLiveSyncEngine) {
          try {
            const rdCfg = this.state.integrations?.rdCrm || {};
            const isConfigured = Boolean(rdCfg.accessToken || rdCfg.apiToken || rdCfg.refreshToken);
            if (isConfigured) RdCrmLiveSyncEngine.start();
          } catch (error) { console.warn('RD Live Sync bootstrap falhou:', error); }
        }
        if (window.EventCollector) {
          try { EventCollector.startPolling(); } catch (error) { console.warn('EventCollector bootstrap falhou:', error); }
        }
      },
      async hydrateFromConfiguredDatabase() {
        try {
          if (!window.DatabaseService?.shouldHydrateFromLocalFolder?.(this.state)) return;
          const result = await DatabaseService.readSnapshotFromFolder(this.state.databaseConfig);
          if (!result.ok || !result.snapshot?.data) return;
          // V22.1.1 — Salvaguarda contra hidratação destrutiva:
          // se o snapshot lido for vazio E o state atual tem dados, NÃO sobrescreve.
          // Isso evita que um snapshot vazio/corrompido do folder zere o localStorage.
          const data = result.snapshot.data;
          const snapHasData = (
            (Array.isArray(data.products) && data.products.length > 0) ||
            (Array.isArray(data.campaigns) && data.campaigns.length > 0) ||
            (Array.isArray(data.actions) && data.actions.length > 0) ||
            (Array.isArray(data.manualLeads) && data.manualLeads.length > 0)
          );
          const stateHasData = (
            (this.state.products?.length || 0) +
            (this.state.campaigns?.length || 0) +
            (this.state.actions?.length || 0) +
            (this.state.manualLeads?.length || 0)
          ) > 0;
          if (!snapHasData && stateHasData) {
            console.warn('Hidratação ignorada: snapshot vazio mas state atual tem dados. Folder pode estar desatualizado.');
            return;
          }
          const cfg = DatabaseService.normalize(this.state.databaseConfig);
          const hydrated = State.normalize(data);
          this.state = DatabaseService.applyMigrations({
            ...hydrated,
            databaseConfig: cfg,
            databaseTestResult: { ok: true, provider: 'local', message: 'Banco local carregado da pasta configurada.', testedAt: new Date().toISOString() }
          });
          State.save();
          this.render();
          Utils.toast('Banco local carregado da pasta configurada.');
        } catch (error) {
          console.warn('Hidratação do banco local falhou:', error);
        }
      },
      save() { State.save(); if (window.DatabaseService?.queueAutoSave) DatabaseService.queueAutoSave(this.state); },
      setTab(tab) {
        this.state.showProductCampaignsModal = false;
        this.state.productCampaignsModalId = null;
        this.state.activeTab = tab;
        this.save();
        this.render();
      },
      goTo(tab, context = {}) {
        if (context.productId) {
          this.state.selectedProductId = Number(context.productId);
          this.state.campaignDraft.productId = Number(context.productId);
        }
        if (context.campaignId) {
          this.state.selectedCampaignId = Number(context.campaignId);
          this.state.actionDraft.campaignId = Number(context.campaignId);
        }
        if (Object.prototype.hasOwnProperty.call(context, 'campaignProductFilterId')) {
          this.state.campaignProductFilterId = context.campaignProductFilterId ? Number(context.campaignProductFilterId) : null;
        }
        this.state.activeTab = tab;
        this.save();
        this.render();
      },
      getSelectedCampaign() { return this.state.campaigns.find(campaign => campaign.id === this.state.selectedCampaignId) || this.state.campaigns[0] || null; },
      _captureFocus() {
        const active = document.activeElement;
        if (!active || active === document.body) return null;
        const key = active.id || active.getAttribute?.('data-focus-key');
        if (!key) return null;
        let selectionStart, selectionEnd;
        try {
          selectionStart = active.selectionStart;
          selectionEnd = active.selectionEnd;
        } catch (_) {}
        const scope = (function findScrollable(el) {
          let node = el.parentElement;
          while (node && node !== document.body) {
            const style = getComputedStyle(node);
            const overflowY = style.overflowY;
            if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
            node = node.parentElement;
          }
          return null;
        })(active);
        return {
          key,
          tagName: active.tagName,
          selectionStart,
          selectionEnd,
          windowScrollY: window.scrollY,
          scopeSelector: scope?.id ? `#${scope.id}` : null,
          scopeScrollTop: scope ? scope.scrollTop : null
        };
      },
      _restoreFocus(snapshot) {
        if (!snapshot) return;
        const el = document.getElementById(snapshot.key) || document.querySelector(`[data-focus-key="${CSS.escape ? CSS.escape(snapshot.key) : snapshot.key}"]`);
        if (!el || typeof el.focus !== 'function') return;
        try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); }
        if (typeof snapshot.selectionStart === 'number' && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
          try { el.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd ?? snapshot.selectionStart); } catch (_) {}
        }
        if (snapshot.scopeSelector) {
          const scope = document.querySelector(snapshot.scopeSelector);
          if (scope && snapshot.scopeScrollTop !== null) scope.scrollTop = snapshot.scopeScrollTop;
        }
        if (typeof snapshot.windowScrollY === 'number') window.scrollTo({ top: snapshot.windowScrollY, left: 0, behavior: 'instant' });
      },
      render() {
        const _focusSnapshot = this._captureFocus();
        const pageMeta = {
          products: {
            title: 'Produtos',
            subtitle: 'Camada estratégica do Revenue OS: produtos, métricas consolidadas, campanhas vinculadas e leitura RevOps.'
          },
          campaigns: {
            title: 'Campanhas',
            subtitle: 'Camada operacional: campanhas por produto, performance, ações plugadas, conversões, handoffs e fluxos consolidados.'
          },
          actions: {
            title: 'Ações da campanha',
            subtitle: 'Onde os OKRs nascem, os leads entram no fluxo e a execução alimenta o funil operacional.'
          },
          results: {
            title: 'Resultado da campanha',
            subtitle: 'Resultados consolidados por campanha e por ação, respeitando fluxos, conversões e identidade única de leads.'
          },
          scores: {
            title: 'Score',
            subtitle: 'Modelos de pontuação, regras de tags, JourneyScore e leitura operacional dos leads.'
          },
          dashboard: {
            title: 'Dashboard',
            subtitle: 'Visão executiva do sistema: receita, campanhas, produtos, leads e performance operacional.'
          },
          leads: {
            title: 'Leads',
            subtitle: 'Base global, buscador de perfil e Journey Pipeline conectados à inteligência RevOps.'
          },
          revops: {
            title: 'RevOps & Governança',
            subtitle: 'Visão macro do produto: engenharia financeira (custos, ticket médio, EBITDA, breakeven) e governança operacional dos OKRs.'
          }
        };

        const mainNav = document.getElementById('mainNav');
        if (mainNav) {
          mainNav.innerHTML = Config.tabs.map(tab => `
            <button
              onclick="App.setTab('${tab.id}')"
              class="lj-master-nav-item ${this.state.activeTab === tab.id ? 'active' : ''}"
              aria-current="${this.state.activeTab === tab.id ? 'page' : 'false'}"
            >
              <i data-lucide="${tab.icon}" class="lj-master-nav-icon"></i>
              <span>${tab.label}</span>
            </button>
          `).join('');
        }

        const header = document.getElementById('pageHeader');
        const meta = pageMeta[this.state.activeTab] || pageMeta.products;
        if (header) {
          header.innerHTML = `
            <div>
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-white text-xs font-black mb-3">
                <i data-lucide="workflow" class="w-3.5 h-3.5"></i>
                LeadJourney ${window.LJVersion || 'V?.?'}
              </div>
              <h1 class="lj-page-title">${meta.title}</h1>
              <p class="lj-page-subtitle">${meta.subtitle}</p>
            </div>
            <div class="lj-page-actions">
              <button onclick="Actions.openSettingsModal()" class="lj-btn lj-btn-secondary">
                <i data-lucide="settings" class="w-4 h-4"></i>
                Configurações
              </button>
            </div>
          `;
        }

        const app = document.getElementById('app');
        const screens = { products: ProductsModule, campaigns: CampaignModule, actions: ActionModule, results: ResultModule, scores: ScoreModule, dashboard: DashboardModule, leads: LeadsModule, revops: window.RevopsGovernanceModule };
        app.innerHTML = (screens[this.state.activeTab]?.render() || ProductsModule.render()) + (window.SettingsModal ? SettingsModal.render() : '');
        if (window.lucide) lucide.createIcons();
        this._restoreFocus(_focusSnapshot);
      },
      runTests() {
        console.assert(LeadParser.parse('Ana,a@a.com,123,#open').length === 1, 'parseLeadsText lê lead');
        console.assert(Utils.splitCsvLine('Ana,"a,b@a.com",123,#open')[1] === 'a,b@a.com', 'CSV com aspas');
        console.assert(State.normalizeTagRules([{ tag: '#x', score: '7' }])[0].score === 7, 'normaliza regra de tag');
        console.assert(State.normalizeOkrs([{ name: 'A', target: '10%', current: '2%' }])[0].current === '2%', 'normaliza OKR atual');
        console.assert(Boolean(ProductsModule.render), 'ProductsModule render existe');
        console.assert(Boolean(DatabaseService.defaultConfig), 'DatabaseService configurado');
        console.assert(Boolean(SettingsModal.render), 'SettingsModal render existe');
        console.assert(Boolean(DashboardModule.render), 'DashboardModule render existe');
        console.assert(Boolean(LeadsModule.render), 'LeadsModule render existe');
        console.assert(Boolean(JourneyPipelineModule.render), 'JourneyPipelineModule render existe');
        console.assert(JourneyPipelineModule.defaultStages().length === 9, 'JourneyPipelineModule fases padrão');
        console.assert(ProfileFinder.parseQuery('mulher, 50 a 60 anos').length === 2, 'ProfileFinder: genero + idade');
        console.assert(ProfileFinder.parseQuery('com e-mail e telefone').length === 2, 'ProfileFinder: email + phone');
        console.assert(ProfileFinder.parseQuery('quente, CEO').length === 2, 'ProfileFinder: temp + cargo');
        console.assert(ProfileFinder.parseQuery('mulheres de 30 a 40 anos do estado de São Paulo').some(f => f.type === 'local'), 'ProfileFinder: reconhece São Paulo como local');
        console.assert(LeadParser.parseProfileCsv('Ana,11999999999,ana@email.com,35,São Paulo,São Paulo,Casado(a),Feminino,R$ 5 mil,#cta').length === 1, 'LeadParser: manual por vírgula');
        console.assert(ProfileFinder.parseQuery('mulher, 20 anos com score 1 para cima').some(f => f.type === 'idade_exact'), 'ProfileFinder: idade exata');
        console.assert(ProfileFinder.parseQuery('mulher, 20 anos com score 1 para cima').some(f => f.type === 'score_min'), 'ProfileFinder: score para cima');
        console.assert(ProfileFinder.interpretQuery('mulheres jovens de SP com alta intenção').confidence > 0, 'ProfileFinder: interpretação semântica local');
        console.log('LeadScore Modular tests: OK');
      }
    };

    App.init();
window.App = App;
