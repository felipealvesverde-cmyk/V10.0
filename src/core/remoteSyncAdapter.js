// V23.0.0 — Remote Sync Adapter
// Sincroniza App.state com Postgres via /api/state-sync.
//
// Estratégia:
//   - GET no boot (após login OK) traz state mais recente do banco
//   - Debounce 2s no save: agrupa múltiplas mudanças num único POST
//   - Auto-snapshot a cada 3 min via setInterval enquanto a aba está aberta
//   - Sandbox: GET funciona (lê produção), POST é rejeitado pelo server (403)
window.RemoteSyncAdapter = {
  _saveTimer: null,
  _snapshotTimer: null,
  _lastPushAt: null,
  _lastPushStatus: 'idle',
  _started: false,

  authHeaders() {
    const token = localStorage.getItem('lj_jwt');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  },

  isProduction() {
    try {
      const u = JSON.parse(localStorage.getItem('lj_user') || '{}');
      return u.mode === 'production' || u.isMaster === true;
    } catch (_) { return false; }
  },

  // V31.0.0 — Demo lê do DB (igual produção) mas é read-only.
  // Usado pra decidir se carrega state remoto no boot.
  isDbBacked() {
    try {
      const u = JSON.parse(localStorage.getItem('lj_user') || '{}');
      return u.mode === 'production' || u.mode === 'demo' || u.isMaster === true;
    } catch (_) { return false; }
  },

  isDemo() {
    try {
      const u = JSON.parse(localStorage.getItem('lj_user') || '{}');
      return u.mode === 'demo';
    } catch (_) { return false; }
  },

  // V23.0.0 — Baixa state remoto se existir. Retorna o state ou null.
  // V36.7.1 — Marca _remoteSnapshotAtLoad pra _doPush usar como guard
  // anti-perda (impede push de state vazio sobrescrever remoto que tinha dados).
  async loadRemoteState() {
    try {
      const res = await fetch('/api/state-sync', { headers: this.authHeaders() });
      if (!res.ok) return null;
      const data = await res.json();
      if (data?.ok && data.state) {
        const s = data.state;
        const totalRemote = (s.products||[]).length + (s.campaigns||[]).length + (s.actions||[]).length;
        this._remoteSnapshotAtLoad = {
          total: totalRemote,
          updatedAt: data.updatedAt,
          loadedAt: Date.now()
        };
        return { state: s, updatedAt: data.updatedAt };
      }
      return null;
    } catch (err) {
      console.warn('[RemoteSync] loadRemoteState falhou:', err);
      return null;
    }
  },

  // V23.0.0 — Push state pro banco. Debounce 2s pra evitar spam em digitação.
  schedulePush() {
    if (!this.isProduction()) return; // sandbox não persiste
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._doPush(), 2000);
  },

  // V27.0.2 — Flush síncrono: cancela debounce + força push imediato + aguarda.
  // Usado antes de chamar Djow (que lê state do Postgres). Se não flushar, Djow
  // vê state desatualizado (até 2s atrás), gastando tokens em conclusão errada.
  //
  // V36.1.3 — flushNow chama _doPush com force=true. Sem isso, o guard
  // sessionExpired da V36.1.1 transformava flushNow em no-op silencioso quando
  // chamado em submitReloginInline (linha 2540 do appActions) — momento em que
  // sessionExpired ainda era true. Resultado: trabalho do cliente ficava em
  // memória até o próximo debounce. Defesa em profundidade: força bypass.
  async flushNow() {
    if (!this.isProduction()) return; // sandbox não persiste
    clearTimeout(this._saveTimer);
    this._saveTimer = null;
    await this._doPush({ force: true });
  },

  // V32.12.3 — Detecta erro de rede (offline, DNS fail, internet caiu).
  // Usado pra silenciar TypeError: Failed to fetch (vinha jogando stack
  // trace feio no console quando a rede oscila).
  _isOfflineError(err) {
    if (!err) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    const msg = String(err.message || err || '').toLowerCase();
    return msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed');
  },

  async _doPush(opts) {
    if (!window.App?.state) return;
    const s = window.App.state;
    const force = opts && opts.force === true;

    // V36.1.1 — GUARDA DE SESSÃO EXPIRADA. Quando JWT venceu, o auth-resolver
    // rejeita TODOS os endpoints. Sem essa guarda, _doPush dispara em loop
    // (debounce 2s + fluxos que chamam schedulePush) → cada falha vira mais
    // um 401 no console + re-seta sessionExpired=true → modal pisca.
    // Quando cliente reentra (submitReloginInline limpa sessionExpired=false),
    // o push volta a funcionar normalmente.
    //
    // V36.1.3 — `force` bypassa o guard. Usado por flushNow pra garantir
    // push imediato pós-relogin mesmo se o caller esquecer de limpar a flag
    // antes (defesa em profundidade contra ordem trocada no futuro).
    if (s.sessionExpired === true && !force) {
      this._lastPushStatus = 'paused_session_expired';
      return;
    }

    // V32.10.4 — GUARDA DE EMERGÊNCIA (Felipe perda de dados RevOps).
    // BLOQUEIA push se state aparenta corrompido/vazio. Pior cenário: push
    // raro deixa de propagar mudança real. Melhor cenário: impede DB ser
    // sobrescrito com state vazio durante boot/race/migration buggy.
    //
    // Critério: nunca pode pushar se TODOS desaparecerem (products + campaigns
    // + actions = 0). Se PRIMEIRO uso, sem dados ainda, o último push remoto
    // do user também é vazio — sem regressão.
    //
    // Guarda extra: se memória anterior MOSTRA que tinha N produtos e agora
    // tem 0, é OBVIAMENTE perda de dados em curso. Bloqueia E faz snapshot
    // do estado anterior (recuperável) E avisa cliente alto.
    const productsNow = (s.products || []).length;
    const campaignsNow = (s.campaigns || []).length;
    const actionsNow = (s.actions || []).length;
    const totalNow = productsNow + campaignsNow + actionsNow;
    const lastSnapshot = this._lastPushSnapshot || null;
    if (lastSnapshot && totalNow === 0 && lastSnapshot.total > 5) {
      // Regressão massiva detectada — não pusha. Salva snapshot recuperável.
      console.error('[RemoteSync] 🚨 BLOQUEADO: state aparenta corrompido.', {
        antes: lastSnapshot,
        agora: { products: productsNow, campaigns: campaignsNow, actions: actionsNow }
      });
      this._lastPushStatus = 'blocked_data_loss_guard';
      try {
        if (window.Utils?.toast) {
          window.Utils.toast('⚠ PERDA DE DADOS DETECTADA — push remoto BLOQUEADO. Vá em Configurações → Backup pra restaurar.');
        }
      } catch (_) {}
      return;
    }

    // V36.7.1 — GUARD ADICIONAL: compara contra state REMOTO recém-carregado
    // no boot. Pega o caso que o V32.10.4 não pega: PRIMEIRA sessão após boot,
    // sem _lastPushSnapshot ainda. Felipe perdeu Sansone 2x hoje (2026-06-08)
    // por causa disso — _doPush enviou state vazio em ~5s após boot, sobrescrevendo
    // o remoto que tinha dados.
    //
    // Lógica: se loadRemoteState carregou state com N produtos/campanhas/ações,
    // e agora vamos pushar com 0, isso é regressão MASSIVA em poucos segundos —
    // impossível ser ação real do usuário.
    const remoteAtLoad = this._remoteSnapshotAtLoad || null;
    if (remoteAtLoad && totalNow === 0 && remoteAtLoad.total > 0) {
      const secondsSinceLoad = (Date.now() - remoteAtLoad.loadedAt) / 1000;
      console.error('[RemoteSync] 🚨 BLOQUEADO V36.7.1: push vazio sobre remoto que tinha dados.', {
        remoto_no_boot: remoteAtLoad,
        push_tentando: { products: productsNow, campaigns: campaignsNow, actions: actionsNow },
        segundos_desde_boot: secondsSinceLoad.toFixed(1)
      });
      this._lastPushStatus = 'blocked_empty_over_nonempty_remote';
      try {
        if (window.Utils?.toast) {
          window.Utils.toast('⚠ Push bloqueado — state local vazio mas servidor tem dados. Recarregue a página (F5) sem fechar.');
        }
      } catch (_) {}
      return;
    }

    // Marca snapshot pra próxima comparação
    this._lastPushSnapshot = { products: productsNow, campaigns: campaignsNow, actions: actionsNow, total: totalNow };

    this._lastPushStatus = 'pushing';
    try {
      const res = await fetch('/api/state-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify({ state: window.App.state })
      });
      if (res.ok) {
        this._lastPushAt = new Date();
        this._lastPushStatus = 'ok';
      } else if (res.status === 401) {
        // V32.12.4 — JWT expirado. NÃO marcar como erro silencioso (foi o que
        // causou perda Sansone). Dispara modal de relogin inline preservando
        // App.state e localStorage.
        this._lastPushStatus = 'auth_expired';
        this._triggerAuthExpired();
      } else if (res.status === 409) {
        // V40.14.17 — Cross-tenant/cross-user write bloqueado pelo servidor.
        // Significa que o navegador tem state contaminado de outra conta. NÃO
        // tentar de novo (cada retry continuaria contaminado). Avisa o user
        // crítico — única saída é fechar a aba e abrir de novo.
        this._lastPushStatus = 'cross_tenant_blocked';
        try {
          const body = await res.json();
          console.error('[RemoteSync] 🚨 Save BLOQUEADO V40.14.17 — cross-tenant/user mismatch.', body);
          if (window.Utils?.toast) {
            window.Utils.toast('⚠ Save bloqueado — state do navegador é de outra conta. Feche esta aba e abra de novo.');
          }
          // Para o agendador de push pra não martelar o servidor.
          if (this._saveTimer) { clearTimeout(this._saveTimer); this._saveTimer = null; }
        } catch (_) { /* defensive */ }
      } else {
        this._lastPushStatus = `error_${res.status}`;
      }
    } catch (err) {
      // V32.12.3 — Offline = silencioso (volta sozinho quando rede voltar).
      // Stack trace de TypeError não ajuda ninguém quando a internet caiu.
      if (this._isOfflineError(err)) {
        this._lastPushStatus = 'offline';
      } else {
        this._lastPushStatus = 'network_error';
        console.warn('[RemoteSync] push falhou:', err);
      }
    }
  },

  // V32.12.4 — Dispara feedback de auth expirado (idempotente).
  // Lei JWT silent failure: 401 NUNCA pode ser silencioso.
  //
  // V35.6.3 — Auto-push em background NÃO abre mais o modal bloqueante
  // (era invasivo: aparecia mesmo sem o user ter clicado em nada).
  // Agora só seta `sessionExpired = true` (banner âmbar discreto).
  // O modal continua aparecendo quando o user efetivamente tenta write
  // manual (interceptado em slidingSession.js, que distingue write vs
  // read por método HTTP). Mantém lei: 401 sempre vira algo visível.
  _triggerAuthExpired() {
    if (window.App?.state) {
      if (!window.App.state.sessionExpired) {
        window.App.state.sessionExpired = true;
        if (window.App.render) window.App.render();
      }
    } else {
      console.error('[RemoteSync] 401 detectado mas App.state indisponível.');
    }
  },

  // V23.0.0 — Auto-snapshot a cada 3 min em background.
  startAutoSnapshot() {
    if (this._snapshotTimer) return;
    this._snapshotTimer = setInterval(() => this._doSnapshot('auto-3min'), 3 * 60 * 1000);
  },

  stopAutoSnapshot() {
    if (this._snapshotTimer) { clearInterval(this._snapshotTimer); this._snapshotTimer = null; }
  },

  async _doSnapshot(label) {
    if (!window.App?.state) return;
    if (!this.isProduction()) return;
    const s = window.App.state;
    // V36.6.3 — REMOVIDA a guarda de sessionExpired (V36.1.1).
    //
    // A guarda original (paralela ao guard de _doPush) impedia snapshot quando
    // banner âmbar estava aberto. Mas isso é O CONTRÁRIO do que deveríamos
    // fazer: snapshot é EXATAMENTE quando o cliente precisa salvar — se a
    // sessão expirou e ele continuou trabalhando, é o momento mais crítico
    // pra preservar o estado.
    //
    // Bug operacional documentado (Felipe 2026-06-08): durante a sessão de
    // debug do sliding session, banner âmbar ficou ativo por horas. Push e
    // snapshot pausados → trabalho do Sansone não foi pro banco → quando
    // localStorage foi limpo, dados se perderam. Felipe recuperou via backup
    // manual mas foi sorte.
    //
    // Decisão: snapshot tenta sempre (mesmo com sessionExpired=true). Se der
    // 401 no servidor por JWT inválido, _triggerAuthExpired apenas seta a
    // flag (já está setada, idempotente). Sem loops.
    // V32.10.4 — Guarda: NÃO criar snapshot vazio. Snapshot vazio polui retention
    // (LIMIT 50) e pode mascarar histórico bom. Só salva se há dados reais.
    const totalReal = (s.products||[]).length + (s.campaigns||[]).length + (s.actions||[]).length;
    if (totalReal === 0) {
      console.warn(`[RemoteSync] snapshot "${label}" PULADO: state vazio (nada pra salvar).`);
      return;
    }
    try {
      const res = await fetch('/api/snapshots-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify({
          state: window.App.state,
          label: `${label}-${window.LJVersion || 'V?'}`
        })
      });
      if (!res.ok) {
        if (res.status === 401) {
          // V32.12.4 — Auto-snapshot também dispara modal de relogin.
          this._triggerAuthExpired();
        } else {
          console.warn('[RemoteSync] snapshot falhou:', res.status);
        }
      }
    } catch (err) {
      // V32.12.3 — Offline = silencioso (snapshot tenta de novo no próximo tick).
      if (!this._isOfflineError(err)) {
        console.warn('[RemoteSync] snapshot falhou:', err);
      }
    }
  },

  status() {
    return {
      mode: this.isProduction() ? 'production' : 'sandbox',
      lastPushAt: this._lastPushAt,
      lastPushStatus: this._lastPushStatus,
      autoSnapshotRunning: Boolean(this._snapshotTimer)
    };
  },

  // V23.0.0 — Inicializa: liga auto-snapshot se modo produção.
  start() {
    if (this._started) return;
    this._started = true;
    if (this.isProduction()) {
      this.startAutoSnapshot();
    }
  }
};
