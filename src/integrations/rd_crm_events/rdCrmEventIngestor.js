// V21 — RD CRM Event Ingestor
// Recebe eventos brutos (de poll ou webhook) e os normaliza para o formato
// canônico de evento { source, type, contactId, payload, ts }. Despacha
// para LeadBaseBridge, ScoreBridge, OutcomeBridge conforme o tipo.
//
// V24.1.0 — Agora também roteia WEBHOOK.CONVERTED (do RD Marketing):
//   1. Identifica o contato (email)
//   2. Acha mailings ativos onde esse contato participa (App.state.rdMailings)
//   3. Aplica tag #convert_<stage> no contato local + push pro RD
//   4. Atribui o evento à campanha vinculada do mailing
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
    } else if (event.type === 'webhook.converted' || event.type === 'conversion') {
      leadKey = await this._handleMarketingConversion(event);
    }
    // Recalcula score se tiver lead
    if (leadKey && window.RdCrmScoreBridge) {
      RdCrmScoreBridge.recalcAfterEvent(leadKey, event);
    }
    return { ok: true, leadKey, event };
  },

  // V24.1.0 — WEBHOOK.CONVERTED do RD Marketing: extrai email, procura
  // mailing(s) ativo(s) com esse contato, aplica tag #convert_<stage>
  // na campanha vinculada. Também adiciona evento à conta do lead.
  async _handleMarketingConversion(event) {
    const payload = event.payload || {};
    const email = String(payload.email || payload.contact?.email || payload.entity?.email || '').trim().toLowerCase();
    if (!email) return null;

    const mailings = Array.isArray(App.state.rdMailings) ? App.state.rdMailings : [];
    // Acha mailings onde esse email participa (matched via tag de mailing
    // que o RD reporta no contato, ou via leadIds armazenados).
    const reportedTags = Array.isArray(payload.contact?.tags) ? payload.contact.tags : [];
    const matchedMailings = mailings.filter(m => {
      if (Array.isArray(m.leadIds) && m.leadIds.some(id => String(id).toLowerCase() === email)) return true;
      if (reportedTags.includes(m.tag)) return true;
      return false;
    });

    let leadKey = null;
    if (window.LeadBaseService?.upsert) {
      const lead = LeadBaseService.upsert({
        name: payload.contact?.name || email,
        email,
        rdMarketingId: payload.contact?.uuid || null,
        tags: []
      }, 'rd-marketing-conversion');
      leadKey = lead ? LeadBaseService.keyOf(lead) : null;
    }

    for (const m of matchedMailings) {
      const tag = m.responseTag || `#convert_${m.targetStage}`;
      m.lastConversionAt = new Date().toISOString();
      if (leadKey && window.LeadBaseService?.accumulateTag) {
        LeadBaseService.accumulateTag(leadKey, tag);
        LeadBaseService.pushEvent(leadKey, {
          source: 'rd-marketing',
          type: 'conversion.tagged',
          mailingId: m.id,
          mailingName: m.name,
          campaignId: m.campaignId,
          tag,
          conversionIdentifier: payload.conversion_identifier || payload.identifier || ''
        });
      }
      // Push tag pro RD Marketing também
      if (window.RdMarketingContactService?.upsertContact) {
        try {
          await RdMarketingContactService.upsertContact({
            email,
            name: payload.contact?.name || email,
            tags: [tag]
          });
        } catch (_) {}
      }
      // Vincula lead à campanha do mailing (se ainda não tiver)
      if (leadKey && m.campaignId && window.LeadBaseService?.linkToCampaign) {
        try { LeadBaseService.linkToCampaign(leadKey, m.campaignId); } catch (_) {}
      }
    }
    try { App.save(); } catch (_) {}
    return leadKey;
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
