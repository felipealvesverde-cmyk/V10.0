// V21 — RD CRM Live Sync Engine
// Polling de 5min. Busca contatos/deals updated desde lastSyncAt e
// despacha eventos pro Ingestor. Botão manual "Sincronizar RD agora"
// chama runOnce() diretamente.
//
// V24.0.0 — Agora também puxa:
//   - webhook events do /api/rd-events-fetch (eventos em tempo real do RD)
//   - contatos do Marketing platform via RdMarketingContactService (base
//     separada do CRM; usada pra lead scoring + email no RD Marketing).
window.RdCrmLiveSyncEngine = {
  INTERVAL_MS: 5 * 60 * 1000,
  WEBHOOK_FETCH_ENDPOINT: '/api/rd-events-fetch',
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

  // V24.0.0 — Puxa eventos do buffer de webhook e despacha pro Ingestor.
  // Mantém state.rdWebhookLastFetchedAt como cursor.
  async _fetchWebhookEvents() {
    const since = App.state.rdWebhookLastFetchedAt || '';
    const url = `${this.WEBHOOK_FETCH_ENDPOINT}?since=${encodeURIComponent(since)}&limit=200`;
    try {
      const response = await fetch(url);
      if (!response.ok) return { ok: false, applied: 0 };
      const data = await response.json();
      const events = Array.isArray(data?.events) ? data.events : [];
      let applied = 0;
      for (const e of events) {
        try {
          const r = await RdCrmEventIngestor.ingest({
            type: this._mapWebhookType(e.eventType),
            contact_id: e.contactId,
            payload: e.payload,
            ts: e.receivedAt
          });
          if (r?.ok) applied += 1;
        } catch (_) {}
      }
      App.state.rdWebhookLastFetchedAt = new Date().toISOString();
      return { ok: true, applied, total: events.length };
    } catch (err) {
      return { ok: false, reason: err?.message || String(err) };
    }
  },

  _mapWebhookType(raw) {
    const map = {
      'contact_changed': 'contact.updated',
      'contact_created': 'contact.upserted',
      'tag_added': 'tag.applied',
      'stage_changed': 'stage.changed',
      'deal_won': 'deal.won',
      'deal_lost': 'deal.lost',
      'deal_changed': 'deal.updated'
    };
    return map[String(raw || '').toLowerCase()] || String(raw || '').toLowerCase();
  },

  async runOnce(silent) {
    if (App.state.rdSyncRunning) return { ok: false, reason: 'busy' };
    App.state.rdSyncRunning = true;
    if (!silent) App.render?.();
    const sinceIso = App.state.rdLastSyncAt || new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    let upserted = 0, dealsApplied = 0, webhookApplied = 0, marketingUpserted = 0;
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
      // V24.0.0 — Webhook events em tempo real (entre os polls de 5min).
      const wh = await this._fetchWebhookEvents();
      if (wh.ok) webhookApplied = wh.applied;
      // V24.0.0 — Contatos do Marketing platform (api.rd.services).
      if (window.RdMarketingContactService?.syncUpdatedSince) {
        const mk = await RdMarketingContactService.syncUpdatedSince(sinceIso, 100);
        if (mk.ok) marketingUpserted = mk.applied;
      }
      App.state.rdLastSyncAt = new Date().toISOString();
    } catch (err) {
      console.warn('[RD Live Sync] erro:', err);
    } finally {
      App.state.rdSyncRunning = false;
      App.save?.();
      App.render?.();
    }
    if (!silent) {
      Utils?.toast?.(`RD sync: ${upserted} CRM • ${dealsApplied} deal(s) • ${webhookApplied} webhook • ${marketingUpserted} marketing.`);
    }
    return { ok: true, upserted, dealsApplied, webhookApplied, marketingUpserted, syncedAt: App.state.rdLastSyncAt };
  }
};
