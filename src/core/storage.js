// StorageAdapter centraliza a persistência local.
// Mantenha esta API quando migrar para Supabase substituindo apenas os internals.
//
// V22.1.1 — Backup rotativo: cada save() também escreve em uma chave
// __backup_N (3 slots), trocando o slot mais antigo. Se o key principal
// vier vazio/corrompido, o State.load() recupera do backup mais recente
// que tenha dados reais. Salvaguarda contra reset silencioso de dados.
var StorageAdapter = {
  BACKUP_SLOTS: 3,
  _backupKey(slot) { return `${Config.storageKey}__backup_${slot}`; },

  loadRaw() {
    const saved = localStorage.getItem(Config.storageKey);
    return saved ? JSON.parse(saved) : null;
  },

  saveRaw(state) {
    const json = JSON.stringify(state);
    // Antes de sobrescrever, rotaciona backup. Só faz isso se o estado atual
    // tem dados REAIS (evita backup vazio sobrescrever backup bom).
    try {
      const current = localStorage.getItem(Config.storageKey);
      if (current && this._hasRealData(current)) {
        this._rotateBackups(current);
      }
    } catch (_) { /* defensive — backup falhou, segue salvando o estado */ }
    localStorage.setItem(Config.storageKey, json);
  },

  // V22.1.1 — Heurística: "tem dados reais" se houver produtos/campanhas/
  // ações/leads com length > 0. Estado puramente default não é backupeado.
  _hasRealData(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') return false;
      const lengths = [
        Array.isArray(parsed.products) ? parsed.products.length : 0,
        Array.isArray(parsed.campaigns) ? parsed.campaigns.length : 0,
        Array.isArray(parsed.actions) ? parsed.actions.length : 0,
        Array.isArray(parsed.manualLeads) ? parsed.manualLeads.length : 0
      ];
      return lengths.some(n => n > 0);
    } catch (_) { return false; }
  },

  _rotateBackups(currentJson) {
    // Desloca slots: 2→3, 1→2, current→1.
    for (let i = this.BACKUP_SLOTS - 1; i > 0; i -= 1) {
      const prev = localStorage.getItem(this._backupKey(i));
      if (prev != null) localStorage.setItem(this._backupKey(i + 1), prev);
    }
    localStorage.setItem(this._backupKey(1), currentJson);
  },

  // V22.1.1 — Procura o backup mais recente com dados reais.
  findBackupWithData() {
    for (let i = 1; i <= this.BACKUP_SLOTS; i += 1) {
      const raw = localStorage.getItem(this._backupKey(i));
      if (raw && this._hasRealData(raw)) {
        try { return { slot: i, data: JSON.parse(raw) }; } catch (_) { /* skip */ }
      }
    }
    return null;
  },

  clear() {
    localStorage.removeItem(Config.storageKey);
    for (let i = 1; i <= this.BACKUP_SLOTS; i += 1) {
      localStorage.removeItem(this._backupKey(i));
    }
  }
};
window.StorageAdapter = StorageAdapter;
