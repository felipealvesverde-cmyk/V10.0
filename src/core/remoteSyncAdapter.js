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

  async _doPush() {
    if (!window.App?.state) return;
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
      } else {
        this._lastPushStatus = `error_${res.status}`;
      }
    } catch (err) {
      this._lastPushStatus = 'network_error';
      console.warn('[RemoteSync] push falhou:', err);
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
    try {
      const res = await fetch('/api/snapshots-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authHeaders() },
        body: JSON.stringify({
          state: window.App.state,
          label: `${label}-${window.LJVersion || 'V?'}`
        })
      });
      if (!res.ok) console.warn('[RemoteSync] snapshot falhou:', res.status);
    } catch (err) {
      console.warn('[RemoteSync] snapshot falhou:', err);
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
