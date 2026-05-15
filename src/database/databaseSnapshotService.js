// V16.4 — Database Snapshot Service
// Antes de trocar o provider principal, oferece exportar um snapshot do
// App.state. Garante que dados atuais não se percam na troca.
window.DatabaseSnapshotService = {
  async generate(label = 'pre-switch') {
    const snapshot = this._buildSnapshot(label);
    const filename = `leadjourney-snapshot-${label}-${this._timestamp()}.json`;
    this._download(snapshot, filename);
    return { ok: true, filename, sizeKb: Math.round(JSON.stringify(snapshot).length / 1024) };
  },

  _buildSnapshot(label) {
    return {
      label,
      generatedAt: new Date().toISOString(),
      schemaVersion: (App.state && App.state.schemaVersion) || 'unknown',
      databaseProvider: App.state?.databaseConfig?.provider || 'local',
      state: this._serializableState()
    };
  },

  _serializableState() {
    try {
      return JSON.parse(JSON.stringify(App.state || {}));
    } catch (_) {
      return null;
    }
  },

  _timestamp() {
    const d = new Date();
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  },

  _download(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
};
