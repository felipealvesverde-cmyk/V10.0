// V16.4 — Database Fallback Service
// Quando o provider principal vira Railway/Supabase/Amazon, garantimos que o
// snapshot local continua atualizado como rede de segurança. Sem isso, uma
// queda do provider externo cortaria o usuário do próprio dado.
window.DatabaseFallbackService = {
  ensureLocalFallback() {
    if (!App.state || !App.state.databaseConfig) return { ok: false, message: 'Sem databaseConfig.' };
    const cfg = App.state.databaseConfig;
    if (!cfg.local) cfg.local = {};
    if (cfg.local.browserStorageFallback !== true) cfg.local.browserStorageFallback = true;
    if (!cfg.local.namespace) cfg.local.namespace = 'leadscore_local_db';
    return { ok: true };
  },

  flushSnapshotToLocal() {
    try {
      this.ensureLocalFallback();
      App.save?.();
      return { ok: true, at: new Date().toISOString() };
    } catch (err) {
      return { ok: false, message: String(err?.message || err) };
    }
  },

  isFallbackHealthy() {
    try {
      const raw = (window.StorageAdapter?.loadRaw?.()) || null;
      return Boolean(raw && typeof raw === 'object');
    } catch (_) {
      return false;
    }
  }
};
