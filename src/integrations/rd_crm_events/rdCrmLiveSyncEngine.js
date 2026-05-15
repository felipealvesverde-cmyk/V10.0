// V21 — RD CRM Live Sync Engine
// Polling de 5min. Busca contatos/deals updated desde lastSyncAt e
// despacha eventos pro Ingestor. Botão manual "Sincronizar RD agora"
// chama runOnce() diretamente.
window.RdCrmLiveSyncEngine = {
  INTERVAL_MS: 5 * 60 * 1000,
  _intervalId: null,

  start() {
    if (this._intervalId) return;
    this._intervalId = setInterval(() => this.runOnce(true), this.INTERVAL_MS);
  },

  stop() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  },

  async runOnce(silent) {
    if (App.state.rdSyncRunning) return { ok: false, reason: 'busy' };
    App.state.rdSyncRunning = true;
    if (!silent) App.render?.();
    const sinceIso = App.state.rdLastSyncAt || new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    let upserted = 0, dealsApplied = 0;
    try {
      const contactsRes = window.RdCrmContactService ? await RdCrmContactService.fetchUpdatedSince(sinceIso, 100) : { ok: false, contacts: [] };
      if (contactsRes.ok) {
        for (const c of contactsRes.contacts) {
          const r = await RdCrmEventIngestor.ingest({ type: 'contact.upserted', payload: c });
          if (r?.ok) upserted += 1;
        }
      }
      const dealsRes = window.RdCrmDealService ? await RdCrmDealService.fetchUpdatedSince(sinceIso, 100) : { ok: false, deals: [] };
      if (dealsRes.ok) {
        for (const d of dealsRes.deals) {
          const evType = d.outcome === 'won' ? 'deal.won' : d.outcome === 'lost' ? 'deal.lost' : 'deal.updated';
          const r = await RdCrmEventIngestor.ingest({ type: evType, payload: d });
          if (r?.ok) dealsApplied += 1;
        }
      }
      App.state.rdLastSyncAt = new Date().toISOString();
    } catch (err) {
      console.warn('[RD Live Sync] erro:', err);
    } finally {
      App.state.rdSyncRunning = false;
      App.save?.();
      App.render?.();
    }
    if (!silent) Utils?.toast?.(`RD sync: ${upserted} contato(s), ${dealsApplied} deal(s).`);
    return { ok: true, upserted, dealsApplied, syncedAt: App.state.rdLastSyncAt };
  }
};
