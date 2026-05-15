// StorageAdapter centraliza a persistência local.
// Mantenha esta API quando migrar para Supabase substituindo apenas os internals.
var StorageAdapter = {
  loadRaw() {
    const saved = localStorage.getItem(Config.storageKey);
    return saved ? JSON.parse(saved) : null;
  },
  saveRaw(state) {
    localStorage.setItem(Config.storageKey, JSON.stringify(state));
  },
  clear() {
    localStorage.removeItem(Config.storageKey);
  }
};
window.StorageAdapter = StorageAdapter;
