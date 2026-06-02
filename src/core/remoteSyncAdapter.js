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
  async loadRemoteState() {
    try {
      const res = await fetch('/api/state-sync', { headers: this.authHeaders() });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.ok && data.state ? { state: data.state, updatedAt: data.updatedAt } : null;
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
  async flushNow() {
    if (!this.isProduction()) return; // sandbox não persiste
    clearTimeout(this._saveTimer);
    this._saveTimer = null;
    await this._doPush();
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

  async _doPush() {
    if (!window.App?.state) return;
    const s = window.App.state;

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
