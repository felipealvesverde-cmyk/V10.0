// V21 — RD CRM Lead Base Bridge
// Faz a ponte entre evento canônico do RD e LeadBaseService. Upsert de
// contato, accumulating de tags, mudança de stage.
window.RdCrmLeadBaseBridge = {
  upsertContact(contact) {
    if (!contact || !window.LeadBaseService) return { ok: false };
    const tags = window.RdCrmTagNormalizer
      ? RdCrmTagNormalizer.normalizeAll(contact.tags || [])
      : (contact.tags || []);
    const lead = LeadBaseService.upsert({
      name: contact.name || '',
      email: contact.email || '',
      phone: contact.phone || '',
      rdContactId: contact.rdContactId || null,
      rdContext: contact.rdContext || null,
      tags
    }, 'rd-crm');
    const leadKey = lead ? LeadBaseService.keyOf(lead) : null;
    // Acumula tag counters por tag recebida
    if (leadKey) {
      for (const tag of tags) LeadBaseService.accumulateTag(leadKey, tag);
      LeadBaseService.pushEvent(leadKey, { source: 'rd-crm', type: 'contact.upserted', tags });
    }
    return { ok: Boolean(leadKey), leadKey };
  },

  applyTag(payload) {
    if (!payload || !window.LeadBaseService) return null;
    const leadKey = this._findKeyByContactId(payload.contactId || payload.contact_id)
      || (payload.email ? LeadBaseService.keyOf({ email: payload.email }) : null);
    if (!leadKey) return null;
    const normalized = window.RdCrmTagNormalizer ? RdCrmTagNormalizer.normalize(payload.tag) : payload.tag;
    if (!normalized) return null;
    LeadBaseService.accumulateTag(leadKey, normalized);
    LeadBaseService.pushEvent(leadKey, { source: 'rd-crm', type: 'tag.applied', tag: normalized });
    return leadKey;
  },

  applyStage(payload) {
    if (!payload || !window.LeadBaseService) return null;
    const leadKey = this._findKeyByContactId(payload.contactId || payload.contact_id);
    if (!leadKey) return null;
    const rdStageId = payload.stageId || payload.stage_id || payload.rdStageId || null;
    let stageCode = null;
    let campaignId = null;
    let pipelineId = null;
    // V21.6 — Prioriza resolução por stageId (numérico do RD): identifica qual
    // campanha + stageCode pertencem àquele pipeline.
    if (rdStageId && window.RdCrmConfig?.findCampaignByStageId) {
      const found = RdCrmConfig.findCampaignByStageId(rdStageId);
      if (found) {
        stageCode = found.stageCode || null;
        campaignId = found.campaignId != null ? Number(found.campaignId) : null;
        pipelineId = found.pipelineId || null;
      }
    }
    // Fallback: deriva stageCode pelo nome textual (compatibilidade)
    const stageRaw = String(payload.stage || payload.stageName || '').toLowerCase();
    if (!stageCode && stageRaw && window.RdCrmTagNormalizer) {
      stageCode = RdCrmTagNormalizer.stageFor(RdCrmTagNormalizer.normalize(stageRaw));
    }
    if (stageCode) LeadBaseService.setStage(leadKey, stageCode);
    LeadBaseService.pushEvent(leadKey, {
      source: 'rd-crm',
      type: 'stage.changed',
      stage: stageCode,
      campaignId,
      pipelineId,
      rdStageId,
      raw: stageRaw
    });
    return leadKey;
  },

  _findKeyByContactId(contactId) {
    if (!contactId) return null;
    const all = window.LeadBaseService ? LeadBaseService.list() : [];
    const found = all.find(l => l.rdContactId === contactId);
    return found ? LeadBaseService.keyOf(found) : null;
  }
};
