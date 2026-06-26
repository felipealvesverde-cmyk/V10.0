// V36.5.2 — Sentinel de force_logout / orphan_logout. Roda PRIMEIRO de tudo,
// antes de qualquer fetch ou init. Se URL tem qualquer um dos query params
// de logout forçado, limpa SEMPRE localStorage + sessionStorage e marca flag
// global pra forçar tela de login (ignora qualquer JWT que estiver lá).
// Isso é defesa contra cenário do Felipe (V36.5.1): após forceFullLogout,
// JWT velho voltava no localStorage por motivo não identificado, mantendo
// app logado mesmo após "Sair forçado". Esta verificação é IMPOSSÍVEL de
// bypassar — roda no parse do JS, antes de qualquer outro código.
(function forceLogoutSentinel() {
  try {
    const q = window.location.search || '';
    if (q.includes('force_logout=') || q.includes('orphan_logout=')) {
      console.warn('[Boot] 🚨 force_logout/orphan_logout detectado na URL. Limpando TUDO.');
      try { localStorage.clear(); } catch (_) {}
      try { sessionStorage.clear(); } catch (_) {}
      window.__LJ_FORCE_LOGIN_SCREEN = true;
      console.warn('[Boot] Flag __LJ_FORCE_LOGIN_SCREEN=true. Init vai pular _checkSession.');
      // V36.5.3 — Remove os query params da URL DEPOIS de processar.
      // Sem isso, qualquer reload (ex: após login OK) re-disparava o sentinel
      // e limpava o JWT recém-salvo → loop infinito de login.
      try {
        const cleanUrl = window.location.pathname;
        history.replaceState(null, '', cleanUrl);
        console.warn('[Boot] URL limpa (force_logout removido pra evitar loop pós-login).');
      } catch (_) {}
    }
  } catch (_) {}
})();

// V40.0.0 — Sentinel de impersonateToken: quando vem `?impersonateToken=xxx` na
// URL (aberto via "Entrar como" do cockpit /admin), trocamos o JWT atual pelo
// token de impersonation antes de qualquer init. URL é limpa pra evitar loop.
(function impersonationSentinel() {
  try {
    const q = new URLSearchParams(window.location.search || '');
    const tok = q.get('impersonateToken');
    if (tok) {
      console.warn('[Boot] 🎭 Impersonation token detectado. Trocando JWT da aba.');
      try { localStorage.setItem('lj_jwt', tok); } catch (_) {}
      // V40.0.0 — Marca a aba como impersonation (flag de sessão, não persistente).
      try { sessionStorage.setItem('lj_impersonation_session', '1'); } catch (_) {}
      try {
        q.delete('impersonateToken');
        const cleanQ = q.toString();
        history.replaceState(null, '', window.location.pathname + (cleanQ ? '?' + cleanQ : ''));
      } catch (_) {}
    }
  } catch (_) {}
})();

// V40.0.0 — Banner amarelo "Você está operando como X" quando a sessão for
// uma impersonation aberta pelo cockpit /admin. Lê impersonatedBy do user
// retornado em /api/auth-me. Some quando user fecha a aba.
(function installImpersonationBanner() {
  if (window.__impersonationBannerInstalled) return;
  window.__impersonationBannerInstalled = true;
  if (sessionStorage.getItem('lj_impersonation_session') !== '1') return;
  // Aguarda App.currentUser ser populado pra puxar impersonatedBy.
  const tryShow = () => {
    const u = window.App?.currentUser;
    if (!u) return setTimeout(tryShow, 300);
    if (!u.impersonatedBy) return;
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;top:0;left:0;right:0;background:linear-gradient(90deg,#f59e0b,#ea580c);color:#1f2937;font-weight:900;font-size:13px;padding:8px 16px;text-align:center;z-index:99999;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    bar.innerHTML = `🎭 Você está operando como <b>${u.username || u.tenantName || 'tenant'}</b> em nome de <b>${u.impersonatedBy}</b> — feche esta aba pra sair.`;
    document.body.appendChild(bar);
    document.body.style.paddingTop = '36px';
  };
  setTimeout(tryShow, 500);
})();

// V36.5.2/V36.6.2 — Espião de setItem('lj_jwt'/'lj_user') foi REMOVIDO.
// Foi usado pra identificar o bug raiz do sliding session auto-save
// (corrigido em V36.5.4). Agora que sabemos, o espião só polui o console
// com warnings amarelos em comportamento normal (_checkSession salvando
// lj_user após auth-me OK).
// Se reativar pra debug futuro: comentar bloco abaixo.
//
// (function jwtSetItemSpy() {
//   try {
//     const originalSet = Storage.prototype.setItem;
//     Storage.prototype.setItem = function(key, value) {
//       if (key === 'lj_jwt' || key === 'lj_user') {
//         console.warn(`[jwt-spy] 🔍 setItem('${key}') chamado:`, new Error().stack);
//       }
//       return originalSet.call(this, key, value);
//     };
//   } catch (_) {}
// })();

// V32.0.13 — Banner amarelo "🚧 STAGING" quando ENVIRONMENT=staging no backend.
// Roda no boot ANTES de qualquer outra coisa pra Felipe nunca confundir
// staging × produção. Visível inclusive na tela de login.
//
// Por que injection via DOM: simples + portável, sem precisar tocar CSS/HTML.
// Fetch contra /api/env-info (rota pública, sem JWT).
(function installEnvironmentBanner() {
  if (window.__envBannerInstalled) return;
  window.__envBannerInstalled = true;
  fetch('/api/env-info').then(r => r.json()).then(data => {
    const env = data?.environment;
    if (!env || env === 'production') return;
    const isStaging = env === 'staging';
    const banner = document.createElement('div');
    banner.id = 'lj-env-banner';
    banner.style.cssText = `
      position: sticky; top: 0; left: 0; right: 0; z-index: 99999;
      background: ${isStaging ? '#fcd34d' : '#fca5a5'};
      color: #1f2937; font-weight: 900; font-size: 13px;
      padding: 6px 16px; text-align: center;
      border-bottom: 2px solid ${isStaging ? '#d97706' : '#dc2626'};
      font-family: system-ui, -apple-system, sans-serif;
      letter-spacing: 0.5px;
    `;
    const label = isStaging ? '🚧 STAGING' : `⚠️ ${env.toUpperCase()}`;
    banner.innerHTML = `${label} — este é o ambiente de TESTE, não produção. Dados aqui são descartáveis.`;
    // Insere no TOPO do body antes de qualquer outra coisa renderizar
    const insert = () => {
      if (document.body && !document.getElementById('lj-env-banner')) {
        document.body.insertBefore(banner, document.body.firstChild);
      }
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', insert);
    } else {
      insert();
    }
  }).catch(() => {/* silencioso — backend velho não tem env-info */});
})();

// V31.0.0 — Interceptor global de fetch: quando backend retorna 403 com
// code 'demo_readonly', mostra toast amigável. Single point pra detectar
// tentativas de mutação bloqueadas no modo demo.
(function installDemoFetchInterceptor() {
  if (window.__demoFetchInstalled) return;
  window.__demoFetchInstalled = true;
  const _origFetch = window.fetch;
  window.fetch = async function(...args) {
    const res = await _origFetch.apply(this, args);
    if (res.status === 403) {
      try {
        const clone = res.clone();
        const data = await clone.json();
        if (data?.code === 'demo_readonly' && window.Utils?.toast) {
          Utils.toast(data.message || 'Modo demo: ação bloqueada.');
        }
      } catch (_) { /* não-JSON ou consumido — ignora */ }
    }
    return res;
  };
})();

var App = {
      state: null,
      currentUser: null,  // V23.0.0 — preenchido após login OK
      async init() {
        // V36.5.2 — Sentinel: se URL tinha force_logout/orphan_logout, IGNORA
        // qualquer JWT que esteja no localStorage e vai DIRETO pra tela de login.
        // Cobre cenário do Felipe onde JWT velho reaparecia no localStorage por
        // motivo desconhecido após "Sair forçado".
        if (window.__LJ_FORCE_LOGIN_SCREEN) {
          console.warn('[init] __LJ_FORCE_LOGIN_SCREEN=true — mostrando tela de login direto.');
          this._showLoginScreen();
          return;
        }
        // V23.0.0 — Gate de login antes de carregar o app.
        const sessionOk = await this._checkSession();
        if (!sessionOk) {
          this._showLoginScreen();
          return;
        }
        // V40.15.0 — Camada 2 do bug cross-tenant: se a identidade do user logado
        // mudou desde o último boot (mesmo navegador, mesmo localStorage), purga
        // o state local ANTES de carregar do servidor. Sem isso, o navegador pode
        // misturar memória da sessão antiga (App.state, localStorage do State) com
        // a nova identidade e mandar push contaminado pro tenant errado. O guard
        // V40.14.17 no servidor já rejeita o save, mas evitar a contaminação na
        // raiz fecha o ciclo. Detalhes em [[bug_client_state_leak_between_tenants]].
        this._purgeLocalIfIdentityChanged();

        // V23.0.0 — Carrega state remoto se em produção; fallback pra localStorage.
        await this._loadStateWithRemoteFallback();
        this.ensureRuntimeStateV1301();
        // V40.16.1 — Bug #38 do audit: beforeunload warning quando drafts
        // estratégicos têm conteúdo non-empty. F5 acidental, restart, deploy
        // não dropa mais o wizard de KR/Visão/Objetivo sem aviso.
        if (!window._ljMapaUnloadWarningInstalled) {
          window._ljMapaUnloadWarningInstalled = true;
          window.addEventListener('beforeunload', (ev) => {
            try {
              const s = window.App?.state;
              if (!s) return;
              const okrDraft = s.strategicOkrDraft;
              const objDraft = s.strategicObjectiveDraft;
              const visDraft = s.strategicVisionEditDraft;
              const hasKr = okrDraft && (String(okrDraft.name || '').trim() || Number(okrDraft.current) || Number(okrDraft.target));
              const hasObj = objDraft && String(objDraft.label || '').trim();
              const hasVision = visDraft && String(visDraft.value || visDraft.text || '').trim();
              if (hasKr || hasObj || hasVision) {
                ev.preventDefault();
                ev.returnValue = 'Você tem um rascunho no Mapa da Receita que vai ser descartado.';
                return ev.returnValue;
              }
            } catch (_) { /* defensive */ }
          });
        }
        // V35.3.10 — Primeira vez que o user vê este sistema de changelog?
        // Marca todas as releases existentes como "vistas" pra evitar badge
        // 14 no primeiro acesso (releases retroativas populadas em V35.3.8).
        // A partir daqui, qualquer release nova entra como "não vista".
        if (this.state.lastSeenVersion === null || this.state.lastSeenVersion === undefined) {
          this.state.lastSeenVersion = window.LJVersion || 'V35.3.10';
        }
        // V25.0.2 — "Sempre que abrir o LJ, a página inicial é Início."
        // Sobrescreve activeTab no boot (não persiste navegação entre reloads).
        this.state.activeTab = 'home';
        this.runTests();
        this.render();
        // V37.4.23 — Sincroniza App.state.user + carrega permissions no boot.
        // _checkSession populou App.currentUser mas não tocou em App.state.user,
        // e _refreshCurrentUserInfo (que chamava loadMyPermissions) só rodava em
        // ações específicas (plug DB, salvar nome). Sem isso, App.state.userPermissions
        // ficava null e Configurações escondia abas role-gated mesmo pra owner —
        // exatamente o bug do Sansone reportado em V37.4.22.
        if (this.currentUser) {
          this.state.user = this.state.user || {};
          this.state.user.id = this.currentUser.id;
          this.state.user.email = this.currentUser.email;
          this.state.user.displayName = this.currentUser.displayName;
          this.state.user.isMaster = this.currentUser.isMaster;
          this.state.user.tenantId = this.currentUser.tenantId;
          if (window.Actions?.loadMyPermissions) {
            setTimeout(() => Actions.loadMyPermissions(), 100);
          }
          // V37.4.39 — Carrega pins ativos pra URL atual no boot.
          // Antes só rodava em _refreshCurrentUserInfo (plug DB, save name) —
          // depois de F5 os pins sumiam até qualquer dessas actions disparar.
          if (window.Actions?.loadPinsForCurrentUrl) {
            setTimeout(() => Actions.loadPinsForCurrentUrl(), 100);
          }
          // V40.1.0 — Carrega plugins habilitados pro tenant no boot.
          // Antes a renderização da aba Plugins mostrava tudo do catálogo
          // direto, sem gating. Agora consulta /api/my-tenant-plugins.
          if (window.Actions?.loadEnabledPlugins) {
            setTimeout(() => Actions.loadEnabledPlugins(), 100);
          }
          // V40.2.0 — Mesma coisa pras integrações.
          if (window.Actions?.loadEnabledIntegrations) {
            setTimeout(() => Actions.loadEnabledIntegrations(), 100);
          }
          // V39.1.0 — Force-prompt de salesChannel: produtos com audience
          // configurado pré-V39.1 não têm campo `salesChannel`. Abre modal
          // bloqueante até cliente preencher cada um. Reabre todo boot até
          // todos terem o campo definido.
          if (window.Actions?.maybeOpenSalesChannelPrompt) {
            setTimeout(() => Actions.maybeOpenSalesChannelPrompt(), 200);
          }
          // V39.2.0 — Carrega Forecast × Realizado do mês corrente no boot
          // pra hidratar o card na aba Resultados antes do cliente clicar.
          if (window.Actions?.loadForecastRealizedSummary) {
            setTimeout(() => Actions.loadForecastRealizedSummary(), 250);
          }
          // V39.3.0 — Carrega Pipeline Velocity (V/C/L/T) pra hidratar a aba
          // RevOps & Velocidade antes do cliente clicar.
          if (window.Actions?.loadPipelineVelocitySummary) {
            setTimeout(() => Actions.loadPipelineVelocitySummary(), 300);
          }
          // V39.4.0 — Carrega Eficiência de Capital (LTV/CAC/Payback/NRR).
          if (window.Actions?.loadEfficiencySummary) {
            setTimeout(() => Actions.loadEfficiencySummary(), 350);
          }
          // V40.5.0 — Sininho de notificações + prefs. Antes só carregava na
          // primeira abertura do modal — badge ficava 0 no F5 até clicar.
          if (window.Actions?.loadNotifications) {
            setTimeout(() => Actions.loadNotifications(), 400);
          }
          if (window.Actions?.loadNotificationPrefs) {
            setTimeout(() => Actions.loadNotificationPrefs(), 450);
          }
          // V40.5.0 — Contadores de pendências (badges de menu).
          if (window.Actions?.loadPendingCounts) {
            setTimeout(() => Actions.loadPendingCounts(), 500);
          }
          // V40.5.0 — Reconciliação RD↔LJ (V34.8 Engine). Sem isso, alertas no
          // sininho não aparecem até o cron 15min rodar.
          if (window.Actions?.loadReconciliationCounts) {
            setTimeout(() => Actions.loadReconciliationCounts(), 550);
          }
          if (window.Actions?.loadReconciliationAlerts) {
            setTimeout(() => Actions.loadReconciliationAlerts(), 600);
          }
          // V40.5.0 — Paridade de status com loadClickupStatus (V31.2.35).
          // Antes só Ga4/GoogleAds/Hotmart só carregavam ao abrir Settings.
          // Health Check (botão verde) mostrava "Não conectado" no F5 mesmo
          // com tokens salvos.
          if (window.Actions?.loadGa4Status) {
            setTimeout(() => Actions.loadGa4Status(), 650);
          }
          if (window.Actions?.loadGoogleAdsStatus) {
            setTimeout(() => Actions.loadGoogleAdsStatus(), 700);
          }
          if (window.Actions?.loadHotmartStatus) {
            setTimeout(() => Actions.loadHotmartStatus(), 750);
          }
        }
        // V32.4.0 (Geraldo Item 6) — hydrateFromConfiguredDatabase removida (V11 folder).
        // V26.0.0 — Atalho global Ctrl+K (Cmd+K) abre modal Djow AI.
        // Funciona em qualquer aba. ESC fecha (tratado dentro do modal).
        if (!this._djowShortcutBound) {
          this._djowShortcutBound = true;
          document.addEventListener('keydown', (e) => {
            const isCmdK = (e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K');
            if (isCmdK) {
              e.preventDefault();
              if (window.Actions?.toggleDjowAIModal) Actions.toggleDjowAIModal();
            }
            // V38.1.30 — ESC sai da edição do SETOR ativo no Mapa
            // (Marketing/Vendas/CS na Etapa 4). Antes saía da campanha
            // inteira — não era o comportamento esperado.
            //
            // V40.16.3 — Bug #42 do audit: stack ordenado. ESC pega o modal
            // mais alto na pilha (sub-modal topmost) antes de mexer em
            // strategicActiveArea. Antes Esc no createCustomKrModal não
            // fechava o modal — desativava strategicActiveArea silencioso.
            if (e.key === 'Escape') {
              const tag = (document.activeElement?.tagName || '').toLowerCase();
              if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
              // Ordem do topmost ao mais baixo (sub-modais primeiro).
              if (App.state.djowTaskChat) {
                e.preventDefault();
                if (window.Actions?.closeDjowTaskChat) return Actions.closeDjowTaskChat();
              }
              if (App.state.taskCreationModal?.open) {
                e.preventDefault();
                if (window.Actions?.closeTaskCreationModal) return Actions.closeTaskCreationModal();
              }
              if (App.state.showActionEditModal) {
                e.preventDefault();
                if (window.Actions?.closeActionEditModal) return Actions.closeActionEditModal();
              }
              if (App.state.createCustomKrModal?.open) {
                e.preventDefault();
                if (window.Actions?.closeCreateCustomKrModal) return Actions.closeCreateCustomKrModal();
              }
              if (App.state.activateCatalogKrModal?.open) {
                e.preventDefault();
                if (window.Actions?.closeActivateCatalogKrModal) return Actions.closeActivateCatalogKrModal();
              }
              if (App.state.connectActionToKrsModal?.open) {
                e.preventDefault();
                if (window.Actions?.closeConnectActionToKrsModal) return Actions.closeConnectActionToKrsModal();
              }
              if (App.state.pluggedActionsModal?.open) {
                e.preventDefault();
                if (window.Actions?.closePluggedActionsModal) return Actions.closePluggedActionsModal();
              }
              if (App.state.strategicMindMapActionEditor) {
                e.preventDefault();
                if (window.Actions?.closeMindMapActionEditor) return Actions.closeMindMapActionEditor();
              }
              if (App.state.customActionEngine) {
                e.preventDefault();
                if (window.Actions?.closeCustomActionEngine) return Actions.closeCustomActionEngine();
              }
              // Comportamento legado V38.1.30 — só dispara se nenhum sub-modal acima.
              if (App.state.showStrategicMap && App.state.strategicActiveArea) {
                e.preventDefault();
                if (window.Actions?.setStrategicActiveArea) {
                  Actions.setStrategicActiveArea(App.state.strategicActiveArea);
                }
              }
            }
          });
        }
        // V26.0.0 — Carrega status do Djow em background (não bloqueia render).
        if (window.Actions?.loadDjowStatus) {
          setTimeout(() => Actions.loadDjowStatus(), 200);
        }
        // V31.2.35 — Carrega status ClickUp em background. Antes só era chamado
        // ao abrir Settings → user via "Não conectado" no boot mesmo com PAT salvo.
        if (window.Actions?.loadClickupStatus) {
          setTimeout(() => Actions.loadClickupStatus(), 250);
        }
        // V36.5.0 — Health Check no boot + auto-refresh 30s. Dá visibilidade
        // imediata do que está conectado e funcionando.
        if (window.Actions?.runHealthCheck) {
          setTimeout(() => Actions.runHealthCheck(), 2000); // 2s pra dar tempo loaders rodarem
          if (!window._healthCheckInterval) {
            window._healthCheckInterval = setInterval(() => {
              if (document.hidden) return;
              if (window.Actions?.runHealthCheck) Actions.runHealthCheck();
            }, 30 * 1000);
          }
        }
        // V31.2.36 — Hidrata credenciais RD do DB criptografado (safety net contra
        // perda de state). Continua usando App.state como API de leitura interna,
        // mas DB vira fonte autoritativa pra restaurar conexões perdidas.
        if (window.Actions?.loadRdCredentialsFromDb) {
          setTimeout(() => Actions.loadRdCredentialsFromDb(), 300);
        }
        // V31.2.52 — Auto-sync webhooks RD a cada 30 min (se OAuth CRM conectado).
        // Detecta drift: webhook deletado no RD manualmente, mudança de domínio,
        // qualquer divergência entre state local e verdade no RD. Re-cadastra
        // faltantes automaticamente. Cleanup ao destroy.
        if (!window._rdWebhookSyncInterval) {
          window._rdWebhookSyncInterval = setInterval(() => {
            const rdCfg = window.App?.state?.integrations?.rd;
            const hasCrmOauth = Boolean(rdCfg?.crmOauth?.accessToken);
            if (!hasCrmOauth) return;
            if (document.hidden) return; // só sync se aba ativa (economiza calls)
            if (window.Actions?.syncRdWebhooksWithRd) {
              Actions.syncRdWebhooksWithRd().catch(_ => {}); // silencioso
            }
          }, 30 * 60 * 1000); // 30 min
        }
        // V23.0.0 — Inicia sync remoto + auto-snapshot.
        if (window.RemoteSyncAdapter) {
          try { RemoteSyncAdapter.start(); } catch (e) { console.warn('RemoteSync start falhou:', e); }
        }
        // V31.1.0 — Inicia tick do StrategicStatusEngine (5min) pra auto-transitar
        // strategicStatus baseado em datas das tasks no provider operacional.
        if (window.StrategicStatusEngine) {
          try { StrategicStatusEngine.startTick(); StrategicStatusEngine.recomputeAll(); } catch (e) { console.warn('StrategicStatusEngine start falhou:', e); }
        }
        // V32.10.2 — Detecção multi-aba via BroadcastChannel. Toda aba LJ que
        // abre envia 'open'. Se essa aba ouvir outra 'open' depois dela ter
        // aberto, mostra banner "outra aba aberta — escolha uma pra editar".
        // Vetor principal de perda de dados: aba A salva, aba B (estado mais
        // antigo) salva DEPOIS sobrescrevendo. Aviso preventivo.
        try {
          if ('BroadcastChannel' in window) {
            window._ljTabChannel = new BroadcastChannel('lj-tabs');
            const myTabId = `tab_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            window._ljMyTabId = myTabId;
            window._ljOtherTabs = new Set();
            window._ljTabChannel.onmessage = (ev) => {
              const msg = ev.data || {};
              if (msg.type === 'open' && msg.tabId !== myTabId) {
                window._ljOtherTabs.add(msg.tabId);
                // Replica ping pra novo entrante saber que eu existo
                window._ljTabChannel.postMessage({ type: 'ping', tabId: myTabId });
                if (!window._ljMultiTabBannerShown) {
                  window._ljMultiTabBannerShown = true;
                  try { Utils.toast('⚠ Outra aba LeadJourney está aberta. Use só 1 pra evitar perda de dados.'); } catch (_) {}
                }
              } else if (msg.type === 'ping' && msg.tabId !== myTabId) {
                window._ljOtherTabs.add(msg.tabId);
              } else if (msg.type === 'close' && msg.tabId !== myTabId) {
                window._ljOtherTabs.delete(msg.tabId);
              }
            };
            window._ljTabChannel.postMessage({ type: 'open', tabId: myTabId });
            window.addEventListener('beforeunload', () => {
              try { window._ljTabChannel.postMessage({ type: 'close', tabId: myTabId }); } catch (_) {}
            });
          }
        } catch (e) { console.warn('[multi-tab] detection falhou:', e); }
      },

      // V23.0.0 — Verifica sessão JWT chamando /api/auth-me.
      // V40.15.0 — Detecta troca de identidade e purga state local.
      // Caso de uso: navegador estava logado como user A no tenant X. User trocou
      // (logout impróprio, troca de aba, impersonation, login direto sem logout
      // antes). Boot atual carrega user B no tenant Y. Sem purgar, App.state em
      // memória + localStorage do State ainda têm produtos/campanhas/configs de
      // A. Auto-save no debounce manda esse lixo pro DB do user B. Felipe perdeu
      // Atira.Pro do Sansone em 2026-06-24 exatamente assim.
      _purgeLocalIfIdentityChanged() {
        try {
          if (!this.currentUser?.id) return;
          const currentId = String(this.currentUser.id);
          const currentTenant = this.currentUser.tenantId != null ? String(this.currentUser.tenantId) : '';
          const lastId = localStorage.getItem('lj_last_user_id');
          const lastTenant = localStorage.getItem('lj_last_tenant_id') || '';
          if (lastId && (lastId !== currentId || lastTenant !== currentTenant)) {
            console.warn('[init] 🚨 Identidade trocou (last vs current):', {
              last_user: lastId, last_tenant: lastTenant,
              current_user: currentId, current_tenant: currentTenant
            }, '— purgando state local.');
            try { StorageAdapter?.clear?.(); } catch (_) {}
            this.state = null;
          }
          localStorage.setItem('lj_last_user_id', currentId);
          localStorage.setItem('lj_last_tenant_id', currentTenant);
        } catch (e) {
          console.warn('[_purgeLocalIfIdentityChanged] falhou:', e);
        }
      },

      async _checkSession() {
        const token = localStorage.getItem('lj_jwt');
        if (!token) return false;
        try {
          const res = await fetch('/api/auth-me', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (!data?.ok || !data?.authenticated) {
            // V36.5.0 — Quando auth-me rejeita, descobre POR QUÊ via auth-debug.
            // Token órfão (assinatura inválida + não expirado) = JWT_SECRET
            // rotacionada sem manter PREVIOUS no servidor. Cliente fica preso
            // em loop de 401 silencioso.
            let isOrphan = false;
            try {
              const dbg = await fetch('/api/auth-debug', {
                headers: { 'Authorization': `Bearer ${token}` }
              }).then(r => r.json());
              const mw = dbg?.middleware_verify_result || {};
              const pd = dbg?.token_payload_decoded || {};
              if (mw.ok === false && pd.already_expired === false) {
                isOrphan = true;
                console.warn('[_checkSession] 🚨 TOKEN ÓRFÃO detectado:', {
                  motivo: mw.error || 'assinatura inválida',
                  jwt_age_minutes: pd.age_minutes,
                  expira_em: pd.exp_iso,
                  previous_configurada: dbg?.jwt_secret_previous?.configured
                });
              } else if (pd.already_expired) {
                console.log('[_checkSession] JWT expirou normalmente — relogin necessário.');
              }
            } catch (_) { /* silent */ }
            // V36.5.1 — Limpa TUDO (não só lj_jwt). State em memória, sessionStorage,
            // health check interval. Felipe reportou: app continuava com JWT velho
            // mesmo após _checkSession remover lj_jwt. Limpeza completa garante.
            try {
              if (window._healthCheckInterval) {
                clearInterval(window._healthCheckInterval);
                window._healthCheckInterval = null;
              }
              if (window._rdWebhookSyncInterval) {
                clearInterval(window._rdWebhookSyncInterval);
                window._rdWebhookSyncInterval = null;
              }
              localStorage.removeItem('lj_jwt');
              localStorage.removeItem('lj_user');
              sessionStorage.clear();
              this.state = null;
              this.currentUser = null;
              if (isOrphan) {
                // V36.5.1 — Token órfão: força reload via location.replace (sem voltar
                // pelo back), com query bust pra evitar qualquer cache.
                console.warn('[_checkSession] Forçando reload limpo (location.replace).');
                window.location.replace('/?orphan_logout=' + Date.now());
                return false;
              }
            } catch (e) { console.warn('[_checkSession] cleanup err:', e); }
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
      // V31.0.0 — Demo: força carga remota sempre (state vem do DB, local é descartado).
      // V40.7.7 — Impersonation (master entrou via "Entrar como"): trata igual demo,
      // SEMPRE usa remoto. Sem isso, a aba de impersonation herda o localStorage do
      // master (vazio ou de outro tenant) e a tela do tenant alvo aparece em branco.
      async _loadStateWithRemoteFallback() {
        const local = State.load();
        let useState = local;
        const user = this.currentUser || {};
        const isImpersonation = (() => {
          try { return sessionStorage.getItem('lj_impersonation_session') === '1'; }
          catch (_) { return false; }
        })();
        const isDemo = user.mode === 'demo';
        const forceRemote = isDemo || isImpersonation;
        const canSync = user.mode === 'production' || user.mode === 'demo' || user.isMaster === true;
        if (canSync && window.RemoteSyncAdapter) {
          try {
            const remote = await RemoteSyncAdapter.loadRemoteState();
            if (remote?.state) {
              if (forceRemote) {
                // Demo OU impersonation: SEMPRE usa remoto. Local é descartado
                // (não confiável — pode ter sobras do master ou de outra sessão).
                // V31.0.1: pre-assign this.state ANTES de normalize. ScoreEngine (e outros
                // engines) lêem App.state.scores durante normalizeLead — se App.state for
                // null, crashava e caía no fallback local (mostrando dados do master).
                this.state = remote.state;
                useState = remote.state; // fallback raw: se normalize crashar, ainda mostra dados reais
                try {
                  useState = State.normalize(remote.state);
                  useState = DatabaseService.applyMigrations(useState);
                } catch (normErr) {
                  console.warn(`[App] ${isImpersonation ? 'IMPERSONATION' : 'DEMO'} normalize falhou — usando state raw do DB:`, normErr);
                }
                console.log(`[App] ${isImpersonation ? 'IMPERSONATION' : 'DEMO'} mode: state remoto carregado.`);
              } else {
                // Master/production: compara remoto vs local, usa o mais recente.
                const localUpdated = local?.lastSavedAt ? new Date(local.lastSavedAt).getTime() : 0;
                const remoteUpdated = remote.updatedAt ? new Date(remote.updatedAt).getTime() : 0;
                if (remoteUpdated >= localUpdated) {
                  this.state = remote.state; // V31.0.1: pre-assign idem (defesa em camadas)
                  // V36.7.2 — Try/catch ao redor do normalize.
                  // Se crashar, MANTER useState = remote.state raw (que tem dados)
                  // em vez de cair pro local que pode estar vazio.
                  // Antes: normalize crash → useState ficava como `local` (vazio) →
                  // this.state = useState (vazio) → save dispara → banco zerado.
                  try {
                    useState = State.normalize(remote.state);
                    useState = DatabaseService.applyMigrations(useState);
                    console.log('[App] state remoto carregado (atualizado em', remote.updatedAt, ')');
                  } catch (normErr) {
                    console.error('[App] 🚨 normalize remote CRASHOU. Usando state remoto raw:', normErr);
                    useState = remote.state; // raw com dados, sem normalize, melhor que vazio
                  }
                } else {
                  console.log('[App] state local mais novo que remoto, mantendo local');
                }
              }
            } else if (!isDemo && local && (local.products?.length || local.campaigns?.length)) {
              // Banco vazio + local tem dados: faz primeira sincronização (push).
              // Demo nunca faz isso (read-only).
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
        // V37.0.8 — lpEvents/lpRegistry removidos (LP modal vestigial)
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
      // V32.4.0 (Geraldo Item 6) — hydrateFromConfiguredDatabase removida.
      // Era hidratação do folder local V11 (Local provider). Obsoleta após
      // V31+ multi-tenant — snapshots agora vivem em journey_snapshots no DB tenant.
      save() {
        // V23.0.0 — Marca timestamp pro conflict resolution remoto.
        if (this.state) this.state.lastSavedAt = new Date().toISOString();

        // V40.15.0 — Camada 2: bloqueia push se state.user.tenantId/id divergem
        // do currentUser do JWT. Proteção dupla com o guard 409 do servidor
        // (V40.14.17) — evita ida ao servidor, evita rejeição barulhenta, e
        // tampouco persiste em localStorage o state contaminado.
        try {
          const u = this.state?.user;
          const c = this.currentUser;
          if (u && c) {
            const stateTenant = u.tenantId != null ? Number(u.tenantId) : null;
            const stateId = u.id != null ? Number(u.id) : null;
            const jwtTenant = c.tenantId != null ? Number(c.tenantId) : null;
            const jwtId = c.id != null ? Number(c.id) : null;
            const tenantMismatch = stateTenant != null && jwtTenant != null && stateTenant !== jwtTenant;
            const userMismatch = stateId != null && jwtId != null && stateId !== jwtId;
            if (tenantMismatch || userMismatch) {
              console.error('[App.save] 🚨 BLOQUEADO V40.15.0 — state.user diverge do currentUser (cross-tenant/user).', {
                state_user: { id: stateId, tenantId: stateTenant },
                jwt_user: { id: jwtId, tenantId: jwtTenant }
              });
              try {
                if (window.Utils?.toast) {
                  window.Utils.toast('⚠ Save bloqueado — state contaminado. Feche esta aba e abra de novo.');
                }
              } catch (_) {}
              return;
            }
          }
        } catch (_) { /* defensive */ }

        // V41.0.10 — Camada 2.5: stamp + validação por ENTIDADE.
        // V40.15.0 bloqueia push se state.user diverge. Mas state.user pode estar
        // consistente E os produtos/campanhas dentro virem de outra sessão (memória
        // do navegador misturada). Esse guard valida cada entidade via _originTenantId.
        // Entidades sem stamp ganham stamp = tenant atual. Entidades com stamp
        // divergente bloqueiam o save inteiro.
        try {
          const jwtTenant = this.currentUser?.tenantId != null ? Number(this.currentUser.tenantId) : null;
          if (jwtTenant != null) {
            const entityErrors = [];
            // V41.0.11 — Cobre TODAS as coleções de dados do tenant.
            ['products', 'campaigns', 'actions', 'executions', 'leads', 'manualLeads'].forEach(key => {
              const list = this.state?.[key];
              if (!Array.isArray(list)) return;
              list.forEach(entity => {
                if (!entity || typeof entity !== 'object') return;
                if (entity._originTenantId == null) {
                  entity._originTenantId = jwtTenant;
                } else if (Number(entity._originTenantId) !== jwtTenant) {
                  entityErrors.push({ key, id: entity.id, name: entity.name, stamped: entity._originTenantId, current: jwtTenant });
                }
              });
            });
            if (entityErrors.length) {
              console.error('[App.save] 🚨 BLOQUEADO V41.0.10 — entidade(s) pertencem a outro tenant.', {
                count: entityErrors.length,
                sample: entityErrors.slice(0, 5)
              });
              try {
                if (window.Utils?.toast) {
                  window.Utils.toast(`⚠ Save bloqueado — ${entityErrors.length} entidade(s) de outro tenant. Feche TODAS as abas e abra de novo.`);
                }
              } catch (_) {}
              return;
            }
          }
        } catch (_) { /* defensive */ }

        // V36.7.2 — Guard anti-perda: bloqueia o save E o push se state aparenta
        // vazio MAS o remoto recém-carregado tinha dados. Defesa antes mesmo do
        // localStorage (sem isso, save zera localStorage que ScoreEngine e outros
        // podem ler depois → cascata de zeros).
        try {
          const s = this.state || {};
          const totalNow = (s.products||[]).length + (s.campaigns||[]).length + (s.actions||[]).length;
          const remoteAtLoad = window.RemoteSyncAdapter?._remoteSnapshotAtLoad;
          if (totalNow === 0 && remoteAtLoad?.total > 0) {
            console.error('[App.save] 🚨 BLOQUEADO V36.7.2: state em memória vazio mas remoto no boot tinha dados.', {
              remoto_no_boot: remoteAtLoad,
              memoria_agora: { products: (s.products||[]).length, campaigns: (s.campaigns||[]).length, actions: (s.actions||[]).length }
            });
            try {
              if (window.Utils?.toast) {
                window.Utils.toast('⚠ Save bloqueado — state em memória vazio. Recarregue a página (F5) sem fechar.');
              }
            } catch (_) {}
            return; // não persiste local, não agenda push
          }
        } catch (_) { /* defensive */ }

        State.save();
        // V23.0.0 — Agenda push pro banco remoto (debounce 2s no Adapter).
        if (window.RemoteSyncAdapter) {
          try { RemoteSyncAdapter.schedulePush(); } catch (e) { /* swallow */ }
        }
      },
      // V36.1.2 — Persiste apenas em localStorage, SEM disparar push remoto.
      // Usado quando a mudança é estado visual transient (ex: produto que está
      // pulsando na rotação da home, página de KR atual). Esses campos precisam
      // sobreviver a F5 mas não justificam um POST /api/state-sync a cada 7s.
      // Sem isso, rotation chamava save() → schedulePush → _doPush → POST
      // ~9 vezes por minuto. Se algum desses POSTs falha (401 transient do
      // servidor), o modal de Sessão Expirada abre por bug do servidor que
      // não é culpa do cliente.
      saveLocal() {
        State.save();
      },
      setTab(tab) {
        this.state.showProductCampaignsModal = false;
        this.state.productCampaignsModalId = null;
        // V25.0.0 — Para a rotação de produto se o user sair da aba Início.
        if (this.state.activeTab === 'home' && tab !== 'home' && window.HomeModule?.stopRotation) {
          try { HomeModule.stopRotation(); } catch (_) {}
        }
        // V40.16.1 — Bug #40 do audit: setTab pra fora do escopo do Mapa fecha
        // o Mapa E todos os 18 sub-modais. Antes, Dashboard/Plugins/RevOps
        // deixavam Mapa + sub-modais zumbis vivos, que reapareciam piscando
        // quando user voltava pra Home/Produtos/Campanhas/Ações.
        // Escopo do Mapa = home, products, campaigns, actions.
        const MAPA_TABS = ['home', 'products', 'campaigns', 'actions'];
        if (this.state.showStrategicMap && !MAPA_TABS.includes(tab) && window.Actions?._closeAllStrategicSubModals) {
          this.state.showStrategicMap = false;
          Actions._closeAllStrategicSubModals();
          if (Actions._resetMapaDrafts) Actions._resetMapaDrafts();
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
        // V26.0.6 — Preserva scroll de elementos críticos (Djow chat home) em torno
        // do re-render. Sem isso, a rotação do Pulso (a cada 7s) reseta scrollTop
        // pro topo do djowHomeRecent, fazendo o user perder posição na conversa.
        // V26.1.0 — Smart preserve: se o user estava no rodapé (últimos 60px),
        // mantém no rodapé após o render (conteúdo cresceu). Senão preserva exato.
        // Resolve bug do modal "volta pra primeira pergunta" ao enviar nova msg.
        // V28.3.2 — Preserva window.scrollY (página inteira) + container do Mapa.
        // Sem isso, qualquer click em botão volta a tela pro topo.
        const _scrollSnapshots = {};
        const _windowScroll = { x: window.scrollX || 0, y: window.scrollY || 0 };
        // V31.2.42 — Adicionado settingsModalScroll pra evitar pulo pro topo
        // toda vez que App.render() roda dentro do modal de Configurações (auto-sync,
        // refresh de RD, click em botão, etc.).
        // V31.2.43 — Adicionado settingsModalBackdrop também (o outer container do
        // modal de Settings também rola — antes só preservávamos o inner).
        // V40.12.6 — audienceWizardBackdrop: mesmo problema dentro do wizard
        // "Definir Audiência" — clicar num modelo/canal/refinador re-renderizava
        // e zerava o scroll do modal. Inner do wizard é overflow-hidden, scroll
        // vive no backdrop.
        ['djowHomeRecent', 'djowMessages', 'strategicMapScrollContainer', 'settingsModalScroll', 'settingsModalBackdrop', 'audienceWizardBackdrop', 'task-create-assignees-scroll'].forEach(id => {
          const el = document.getElementById(id);
          if (el) {
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
            _scrollSnapshots[id] = { top: el.scrollTop, atBottom };
          }
        });
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
            title: 'Ações',
            subtitle: 'Camada operacional: onde os OKRs nascem, os leads entram no fluxo e a execução alimenta o funil.'
          },
          executions: {
            title: 'Execuções',
            subtitle: 'O gesto concreto: tarefas por ação, status em tempo real, criação manual ou via Djow.'
          },
          results: {
            title: 'Resultados',
            subtitle: 'Funil consolidado por produto, drill-down por campanha e ação. Onde se responde "o que aconteceu e por causa do quê".'
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
          },
          revopsVelocity: {
            title: 'RevOps & Velocidade',
            subtitle: 'Raio-x da máquina: Visitas × Conversão × Ticket / Ciclo decomposto por produto. Mostra qual letra mexer pra acelerar o faturamento.'
          },
          plugins: {
            title: 'Plugins',
            subtitle: 'Catálogo de ferramentas avançadas que estendem o LeadJourney além do fluxo padrão.'
          }
        };

        const mainNav = document.getElementById('mainNav');
        if (mainNav) {
          // V32.3.0 — Onda 1 Leonardo. Separadores sutis antes de Produtos
          // (cockpit → operação), Dashboard (operação → inteligência) e RevOps
          // (inteligência → governança). Gestalt cura sem títulos de seção.
          // V34.9.19 — Divisor antes de 'scores' migrou pra 'dashboard'.
          const dividerBefore = new Set(['products', 'dashboard', 'revops', 'plugins']);
          mainNav.innerHTML = Config.tabs.map(tab => {
            const sep = dividerBefore.has(tab.id) ? '<div class="lj-nav-divider" aria-hidden="true"></div>' : '';
            return sep + `
              <button
                onclick="App.setTab('${tab.id}')"
                data-tab="${tab.id}"
                class="lj-master-nav-item ${this.state.activeTab === tab.id ? 'active' : ''}"
                aria-current="${this.state.activeTab === tab.id ? 'page' : 'false'}"
              >
                <i data-lucide="${tab.icon}" class="lj-master-nav-icon"></i>
                <span>${tab.label}</span>
              </button>
            `;
          }).join('');
        }

        // V25.0.2 — Configurações + Logout + Versão movidos pra sidebar
        // esquerda (eram no topo direito). Topo agora só tem título da página.
        const sidebarAccount = document.getElementById('sidebarAccount');
        const userForBadge = this.currentUser || {};
        if (sidebarAccount) {
          sidebarAccount.innerHTML = `
            <button onclick="Actions.openSettingsModal()" class="lj-master-nav-item lj-nav-utility">
              <i data-lucide="settings" class="lj-master-nav-icon"></i>
              <span>Configurações</span>
            </button>
            <button onclick="Actions.logout()" data-action="logout" class="lj-master-nav-item lj-nav-utility">
              <i data-lucide="log-out" class="lj-master-nav-icon"></i>
              <span>Sair</span>
            </button>
            <div class="lj-sidebar-version">
              <i data-lucide="workflow" class="w-3 h-3"></i>
              <span>LeadJourney ${window.LJVersion || 'V?.?'}</span>
            </div>
            ${window.HealthCheckPanel ? HealthCheckPanel.render() : ''}
          `;
        }

        const header = document.getElementById('pageHeader');
        const meta = pageMeta[this.state.activeTab] || pageMeta.home;
        const user = this.currentUser || {};
        if (header) {
          // V25.0.2 — Header minimalista. Pra Home, oculto (HomeModule tem
          // greeting próprio). Pra outras abas, só título + subtítulo + sandbox warn.
          // V31.0.0 — Adicionado banner MODO DEMO (mode === 'demo').
          const sandboxBanner = user.mode === 'sandbox' && !user.isMaster
            ? '<div class="lj-sandbox-warn"><i data-lucide="alert-triangle" class="w-3 h-3"></i> MODO SANDBOX — alterações não persistem no banco</div>'
            : '';
          const demoBanner = user.mode === 'demo'
            ? '<div class="lj-demo-banner"><i data-lucide="eye" class="w-3 h-3"></i> MODO DEMO — Você está navegando a empresa fictícia <b>Engenho Norte</b>. Cadastros estão desabilitados.</div>'
            : '';
          if (this.state.activeTab === 'home') {
            header.innerHTML = sandboxBanner + demoBanner;
            header.classList.add('lj-page-header-collapsed');
          } else {
            header.classList.remove('lj-page-header-collapsed');
            header.innerHTML = `
              <div>
                ${sandboxBanner}${demoBanner}
                <h1 class="lj-page-title">${meta.title}</h1>
                <p class="lj-page-subtitle">${meta.subtitle}</p>
              </div>
            `;
          }
        }

        const app = document.getElementById('app');
        // V25.0.0 — Adicionada aba "home" (HomeModule).
        const screens = { home: window.HomeModule, products: ProductsModule, campaigns: CampaignModule, actions: ActionModule, executions: window.ExecutionsModule, results: ResultModule, scores: ScoreModule, dashboard: DashboardModule, leads: LeadsModule, revops: window.RevopsGovernanceModule, revopsVelocity: window.RevopsVelocityModule, plugins: window.PluginsModule };
        app.innerHTML = (screens[this.state.activeTab]?.render() || (window.HomeModule ? HomeModule.render() : ProductsModule.render())) + (window.SettingsModal ? SettingsModal.render() : '') + (window.CreateClickupTaskModal ? CreateClickupTaskModal.render() : '') + (window.ConnectActionWizardModal ? ConnectActionWizardModal.render() : '') + (window.ReloginInlineModal ? ReloginInlineModal.render() : '') + (window.TrackerWizardModal ? TrackerWizardModal.render() : '') + (window.TrackerVisitorDetailModal ? TrackerVisitorDetailModal.render() : '') + (window.HotmartWizardModal ? HotmartWizardModal.render() : '') + (window.ReconciliationModal ? ReconciliationModal.render() : '') + (window.TriggersModal ? TriggersModal.render() : '') + (window.ScoreConfigModal ? ScoreConfigModal.render() : '') + (window.ScoreBreakdownModal ? ScoreBreakdownModal.render() : '') + (window.SubStageFunnelModal ? SubStageFunnelModal.render() : '') + (window.ConfirmModal ? ConfirmModal.render() : '') + (window.LeadImportWizard ? LeadImportWizard.render() : '') + (window.SessionExpiredBanner ? SessionExpiredBanner.render() : '') + (window.SalesChannelPromptModal ? SalesChannelPromptModal.render() : '') + (window.GoogleAdsWizardModal ? GoogleAdsWizardModal.render() : '') + (window.Ga4WizardModal ? Ga4WizardModal.render() : '') + (window.Ga4ReconciliationModal ? Ga4ReconciliationModal.render() : '') + (window.RdConnectionModal ? RdConnectionModal.render() : '') + (window.ClickupConnectionModal ? ClickupConnectionModal.render() : '') + (window.IntegrationDeepDiveModal ? IntegrationDeepDiveModal.render() : '') + (window.AdsAssociationWizard ? AdsAssociationWizard.render() : '') + (window.GoogleAdsAdvancedModal ? GoogleAdsAdvancedModal.render() : '') + (window.KpiHelpModal ? KpiHelpModal.render() : '') + (window.RdWebhookLogModal ? RdWebhookLogModal.render() : '') + (window.TenantDbWizardModal ? TenantDbWizardModal.render() : '') + (window.NotificationsPanel ? NotificationsPanel.drawer() : '') + (window.PinUp ? PinUp.overlay() : '');
        // V26.0.4 — Modal Djow agora em root separado (#djowModalRoot fora de #app)
        // pra que position:fixed funcione corretamente (parent #app tem transform
        // via card-enter, que cria novo containing block e quebra position:fixed).
        const djowRoot = document.getElementById('djowModalRoot');
        if (djowRoot) {
          djowRoot.innerHTML = window.DjowAIModal && this.state.djowOpen ? DjowAIModal.render() : '';
        }
        // V37.4.10 — TopBar em root separado pra fixed funcionar (parent #app tem transform)
        const topBarRoot = document.getElementById('topBarRoot');
        if (topBarRoot) {
          topBarRoot.innerHTML = window.TopBar ? TopBar.render() : '';
        }
        if (window.lucide) lucide.createIcons();
        // V39.9.1 — re-attach do Flow Builder SVG. Sem isso, qualquer App.render()
        // externo (auto-save, polling, outras actions) redesenha só o container
        // vazio e o SVG some. attach() é idempotente: bail-out se !container.
        if (window.ActionFlowBuilder?.attach && this.state.showFlowBuilderModal) {
          try { window.ActionFlowBuilder.attach(); } catch (_) {}
        }
        this._restoreFocus(_focusSnapshot);
        // V26.0.6 / V26.1.0 — Restaura scroll smart (se estava no bottom, vai pro bottom).
        Object.entries(_scrollSnapshots).forEach(([id, snap]) => {
          const el = document.getElementById(id);
          if (!el) return;
          if (snap.atBottom) el.scrollTop = el.scrollHeight;
          else el.scrollTop = snap.top;
        });
        // V28.3.2 — Restaura scroll da página inteira. Sem isso, qualquer click
        // em botão (que dispara Actions.X() → App.render()) volta a tela pro topo.
        if (_windowScroll.y || _windowScroll.x) {
          window.scrollTo(_windowScroll.x, _windowScroll.y);
        }
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
        console.assert(Boolean(SettingsModal.render), 'SettingsModal render existe');
        console.assert(Boolean(DashboardModule.render), 'DashboardModule render existe');
        console.assert(Boolean(LeadsModule.render), 'LeadsModule render existe');
        console.assert(Boolean(JourneyPipelineModule.renderInline), 'JourneyPipelineModule renderInline existe');
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

// V26.0.1 — Listener Ctrl+K registrado fora do init() pra garantir bind
// mesmo se init() não chegar até o ponto antigo (ex: erro em algum render).
// V26.0.3 — Aceita também Ctrl+/ e Alt+K como atalhos alternativos
// (Ctrl+K às vezes é capturado pelo Chrome antes do JS handler chegar).
(function bindDjowShortcut() {
  if (window._djowShortcutGloballyBound) return;
  window._djowShortcutGloballyBound = true;
  const handler = (e) => {
    const isCmdK = (e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK');
    const isCmdSlash = (e.ctrlKey || e.metaKey) && (e.key === '/' || e.code === 'Slash');
    const isAltK = e.altKey && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK');
    if (isCmdK || isCmdSlash || isAltK) {
      e.preventDefault();
      e.stopPropagation();
      if (window.Actions?.toggleDjowAIModal) Actions.toggleDjowAIModal();
    }
  };
  document.addEventListener('keydown', handler, true); // capture phase
  window.addEventListener('keydown', handler, true);
})();

// V26.0.3 — Botão flutuante "Djow" visível sempre (FAB) como fallback
// pro Ctrl+K. Renderizado uma vez na carga, fica fixo no canto inferior direito.
(function ensureDjowFab() {
  if (window._djowFabInjected) return;
  window._djowFabInjected = true;
  const inject = () => {
    if (document.getElementById('djowFab')) return;
    const fab = document.createElement('button');
    fab.id = 'djowFab';
    fab.className = 'lj-djow-fab';
    fab.title = 'Perguntar ao Djow (Ctrl+K · Ctrl+/ · Alt+K)';
    fab.innerHTML = `<svg viewBox="0 0 64 64" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="djow-fab-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#A78BFA"/><stop offset="100%" stop-color="#5B21B6"/></linearGradient></defs>
      <circle cx="32" cy="8" r="3" fill="#C4B5FD"/><line x1="32" y1="11" x2="32" y2="16" stroke="#A78BFA" stroke-width="2"/>
      <rect x="14" y="16" width="36" height="32" rx="11" fill="url(#djow-fab-grad)" stroke="#7C3AED" stroke-width="1.5"/>
      <circle cx="24" cy="30" r="3.5" fill="#fff"/><circle cx="40" cy="30" r="3.5" fill="#fff"/>
      <circle cx="24" cy="30" r="1.5" fill="#5B21B6"/><circle cx="40" cy="30" r="1.5" fill="#5B21B6"/>
      <path d="M26 40 Q32 43 38 40" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>`;
    fab.onclick = () => { if (window.Actions?.toggleDjowAIModal) Actions.toggleDjowAIModal(); };
    fab.title = 'Perguntar ao Djow (Ctrl+K · Ctrl+/ · Alt+K)';
    document.body.appendChild(fab);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
