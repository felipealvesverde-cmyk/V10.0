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
