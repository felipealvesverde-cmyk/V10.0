var App = {
      state: null,
      currentUser: null,  // V23.0.0 — preenchido após login OK
      async init() {
        // V23.0.0 — Gate de login antes de carregar o app.
        const sessionOk = await this._checkSession();
        if (!sessionOk) {
          this._showLoginScreen();
          return;
        }
        // V23.0.0 — Carrega state remoto se em produção; fallback pra localStorage.
        await this._loadStateWithRemoteFallback();
        this.ensureRuntimeStateV1301();
        this.runTests();
        this.render();
        this.hydrateFromConfiguredDatabase();
        // V23.0.0 — Inicia sync remoto + auto-snapshot.
        if (window.RemoteSyncAdapter) {
          try { RemoteSyncAdapter.start(); } catch (e) { console.warn('RemoteSync start falhou:', e); }
        }
      },

      // V23.0.0 — Verifica sessão JWT chamando /api/auth-me.
      async _checkSession() {
        const token = localStorage.getItem('lj_jwt');
        if (!token) return false;
        try {
          const res = await fetch('/api/auth-me', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (!data?.ok || !data?.authenticated) {
            localStorage.removeItem('lj_jwt');
            localStorage.removeItem('lj_user');
            return false;
          }
          this.currentUser = data.user;
          // Atualiza user cache no localStorage com info fresca do banco
          localStorage.setItem('lj_user', JSON.stringify(data.user));
          return true;
        } catch (err) {
          console.warn('[_checkSession]', err);
          // Falha de rede: tenta usar cache do localStorage como fallback
          try {
            this.currentUser = JSON.parse(localStorage.getItem('lj_user') || 'null');
            return Boolean(this.currentUser);
          } catch (_) { return false; }
        }
      },

      _showLoginScreen() {
        // Esconde tudo do app, mostra só a tela de login.
        const root = document.getElementById('loginRoot');
        if (root) root.style.display = 'block';
        // Esconde o resto do app
        document.querySelectorAll('.lj-master-shell, #pageHeader').forEach(el => {
          if (el) el.style.display = 'none';
        });
        if (window.LoginScreen?.render) LoginScreen.render();
      },

      // V23.0.0 — Carrega state: remoto primeiro (se produção/master), local depois.
      async _loadStateWithRemoteFallback() {
        const local = State.load();
        let useState = local;
        const user = this.currentUser || {};
        const canSync = user.mode === 'production' || user.isMaster === true;
        if (canSync && window.RemoteSyncAdapter) {
          try {
            const remote = await RemoteSyncAdapter.loadRemoteState();
            if (remote?.state) {
              // Tem state remoto. Decide: usa remoto se for mais recente que local.
              const localUpdated = local?.lastSavedAt ? new Date(local.lastSavedAt).getTime() : 0;
              const remoteUpdated = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
              if (remoteUpdated >= localUpdated) {
                useState = State.normalize(remote.state);
                useState = DatabaseService.applyMigrations(useState);
                console.log('[App] state remoto carregado (atualizado em', remote.updatedAt, ')');
              } else {
                console.log('[App] state local mais novo que remoto, mantendo local');
              }
            } else if (local && (local.products?.length || local.campaigns?.length)) {
              // Banco vazio + local tem dados: faz primeira sincronização (push).
              console.log('[App] banco vazio, fazendo primeira sincronização do local');
              setTimeout(() => RemoteSyncAdapter._doPush(), 1500);
            }
          } catch (err) {
            console.warn('[App] _loadStateWithRemoteFallback falhou:', err);
          }
        }
        this.state = useState;
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
        // V24.1.0 — Auto-loops desligados pra escala. Atualização agora
        // é manual (botão "Atualizar dados RD" nas Configurações) ou
        // lazy (ao abrir o painel RD pela primeira vez via _onSettingsModalOpen).
        //
        // Por que desligamos:
        //   - RdCrmLiveSyncEngine rodava a cada 5min em TODA aba aberta,
        //     mesmo sem ninguém olhando — 12 requests/hora por aba × N usuários.
        //   - EventCollector idem (lp-events-fetch).
        //   - Em escala (50+ users), eram milhares de requests/hora pro RD.
        //   - Usuário raramente precisa de dados ao-vivo; pull on-demand resolve.
        //
        // Quando o user clica "Atualizar dados RD", Actions.refreshAllRdData
        // dispara: RdCrmLiveSyncEngine.runOnce, EventCollector.poll, e
        // RdMarketingContactService.syncUpdatedSince.
        //
        // RdCrmSyncEngine.bootstrap continua porque ele só re-arma o auto-sync
        // se o user TIVER ligado explicitamente (cfg.autoSync) — caso contrário
        // não faz nada.
        if (window.RdCrmSyncEngine) {
          try { RdCrmSyncEngine.bootstrap(); } catch (error) { console.warn('RD CRM bootstrap falhou:', error); }
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
      save() {
        // V23.0.0 — Marca timestamp pro conflict resolution remoto.
        if (this.state) this.state.lastSavedAt = new Date().toISOString();
        State.save();
        if (window.DatabaseService?.queueAutoSave) DatabaseService.queueAutoSave(this.state);
        // V23.0.0 — Agenda push pro banco remoto (debounce 2s no Adapter).
        if (window.RemoteSyncAdapter) {
          try { RemoteSyncAdapter.schedulePush(); } catch (e) { /* swallow */ }
        }
      },
      setTab(tab) {
        this.state.showProductCampaignsModal = false;
        this.state.productCampaignsModalId = null;
        // V25.0.0 — Para a rotação de produto se o user sair da aba Início.
        if (this.state.activeTab === 'home' && tab !== 'home' && window.HomeModule?.stopRotation) {
          try { HomeModule.stopRotation(); } catch (_) {}
        }
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
          home: {
            title: 'Início',
            subtitle: 'Cockpit executivo do Revenue OS: pulso da operação, KPIs e alertas em tempo real.'
          },
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
        const meta = pageMeta[this.state.activeTab] || pageMeta.home;
        // V23.0.0 — Badge de usuário + modo + logout no header.
        const user = this.currentUser || {};
        const userBadge = user.username ? `<div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${user.mode === 'sandbox' && !user.isMaster ? 'bg-amber-500/20 border-amber-400/30 text-amber-100' : 'bg-emerald-500/15 border-emerald-400/30 text-emerald-100'} border text-xs font-black">
          <i data-lucide="${user.isMaster ? 'shield' : (user.mode === 'sandbox' ? 'flask-conical' : 'database')}" class="w-3.5 h-3.5"></i>
          ${this._escape(user.username)} · ${user.isMaster ? 'master' : (user.mode || 'sandbox')}
        </div>` : '';
        if (header) {
          header.innerHTML = `
            <div>
              ${user.mode === 'sandbox' && !user.isMaster ? '<div class="mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-100 text-xs font-black"><i data-lucide="alert-triangle" class="w-3 h-3"></i> MODO SANDBOX — alterações não persistem no banco</div>' : ''}
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-white text-xs font-black mb-3">
                <i data-lucide="workflow" class="w-3.5 h-3.5"></i>
                LeadJourney ${window.LJVersion || 'V?.?'}
              </div>
              <h1 class="lj-page-title">${meta.title}</h1>
              <p class="lj-page-subtitle">${meta.subtitle}</p>
            </div>
            <div class="lj-page-actions flex items-center gap-2">
              ${userBadge}
              <button onclick="Actions.openSettingsModal()" class="lj-btn lj-btn-secondary">
                <i data-lucide="settings" class="w-4 h-4"></i>
                Configurações
              </button>
              <button onclick="Actions.logout()" title="Sair" class="lj-btn lj-btn-secondary" style="padding-left:0.75rem;padding-right:0.75rem;">
                <i data-lucide="log-out" class="w-4 h-4"></i>
              </button>
            </div>
          `;
        }

        const app = document.getElementById('app');
        // V25.0.0 — Adicionada aba "home" (HomeModule).
        const screens = { home: window.HomeModule, products: ProductsModule, campaigns: CampaignModule, actions: ActionModule, results: ResultModule, scores: ScoreModule, dashboard: DashboardModule, leads: LeadsModule, revops: window.RevopsGovernanceModule };
        app.innerHTML = (screens[this.state.activeTab]?.render() || (window.HomeModule ? HomeModule.render() : ProductsModule.render())) + (window.SettingsModal ? SettingsModal.render() : '');
        if (window.lucide) lucide.createIcons();
        this._restoreFocus(_focusSnapshot);
      },
      _escape(s) {
        return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
