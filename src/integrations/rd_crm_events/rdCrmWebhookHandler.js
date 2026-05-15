// V21 — RD CRM Webhook Handler
// Parser/validador de payloads de webhook do RD. Hoje exposto via API local
// (window.__rdWebhook) pra teste; futuro backend serverless invoca handler
// real ao receber webhook POST.
window.RdCrmWebhookHandler = {
  // Entrada pública (chame de um endpoint serverless ou colando JSON na UI de teste)
  async receive(payload) {
    const validated = this._validate(payload);
    if (!validated.ok) return { ok: false, reason: validated.reason };
    const result = await window.RdCrmEventIngestor?.ingest(validated.event);
    return result || { ok: false, reason: 'no-ingestor' };
  },

  _validate(payload) {
    if (!payload || typeof payload !== 'object') return { ok: false, reason: 'invalid-payload' };
    const type = payload.event_type || payload.type;
    if (!type) return { ok: false, reason: 'missing-type' };
    return {
      ok: true,
      event: {
        type: this._mapType(type),
        contactId: payload.entity_id || payload.contact_id || payload.payload?.contact_id,
        payload: payload.payload || payload,
        ts: payload.timestamp || new Date().toISOString()
      }
    };
  },

  // Mapeia tipos RD para nossa taxonomia canônica
  _mapType(rdType) {
    const map = {
      'contact_changed': 'contact.updated',
      'contact_created': 'contact.upserted',
      'tag_added':       'tag.applied',
      'stage_changed':   'stage.changed',
      'deal_won':        'deal.won',
      'deal_lost':       'deal.lost',
      'deal_changed':    'deal.updated'
    };
    return map[String(rdType).toLowerCase()] || String(rdType).toLowerCase();
  }
};

// Helper de teste local (cola JSON no console: window.__rdWebhook({...}))
if (typeof window !== 'undefined') {
  window.__rdWebhook = (p) => window.RdCrmWebhookHandler.receive(p);
}
