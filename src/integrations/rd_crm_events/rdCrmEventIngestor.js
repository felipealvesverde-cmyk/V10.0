// V21 — RD CRM Event Ingestor
// Recebe eventos brutos (de poll ou webhook) e os normaliza para o formato
// canônico de evento { source, type, contactId, payload, ts }. Despacha
// para LeadBaseBridge, ScoreBridge, OutcomeBridge conforme o tipo.
window.RdCrmEventIngestor = {
  async ingest(rawEvent) {
    const event = this._canonicalize(rawEvent);
    if (!event) return { ok: false, reason: 'invalid-event' };
    this._log(event);
    // Roteia por tipo
    let leadKey = null;
    if (event.type === 'contact.upserted' || event.type === 'contact.updated') {
      const result = await window.RdCrmLeadBaseBridge?.upsertContact(event.payload);
      leadKey = result?.leadKey || null;
    } else if (event.type === 'deal.won' || event.type === 'deal.lost') {
      const result = await window.RdCrmOutcomeBridge?.applyDealOutcome(event.payload);
      leadKey = result?.leadKey || null;
    } else if (event.type === 'tag.applied') {
      leadKey = window.RdCrmLeadBaseBridge?.applyTag(event.payload) || null;
    } else if (event.type === 'stage.changed') {
      leadKey = window.RdCrmLeadBaseBridge?.applyStage(event.payload) || null;
    }
    // Recalcula score se tiver lead
    if (leadKey && window.RdCrmScoreBridge) {
      RdCrmScoreBridge.recalcAfterEvent(leadKey, event);
    }
    return { ok: true, leadKey, event };
  },

  _canonicalize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    return {
      source: 'rd-crm',
      type: String(raw.type || raw.event_type || '').toLowerCase(),
      contactId: raw.contact_id || raw.contactId || raw.payload?.contact_id || null,
      payload: raw.payload || raw,
      ts: raw.ts || raw.timestamp || new Date().toISOString()
    };
  },

  _log(event) {
    const log = Array.isArray(App.state.rdEventLog) ? App.state.rdEventLog : [];
    App.state.rdEventLog = [...log, event].slice(-200);
  }
};
