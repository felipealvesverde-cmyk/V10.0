// V15 — Serviço de tags acumulativas por funil e por etapa.
// Mantém um contador local por lead (identityKey) para entradas em cada funil
// e em cada etapa, e empurra também a tag para o RD via /contacts/{id}/tags
// quando o lead tem ID RD conhecido.
window.RdCrmTagService = {
  _ensureRoot() {
    App.state.rdCrmLeadTags = App.state.rdCrmLeadTags || {};
    return App.state.rdCrmLeadTags;
  },

  _ensureLead(identityKey) {
    const root = this._ensureRoot();
    if (!root[identityKey]) {
      root[identityKey] = { funis: {}, etapas: {}, history: [], lastUpdatedAt: '' };
    }
    return root[identityKey];
  },

  incrementFunnel(identityKey, area) {
    if (!identityKey || !area) return null;
    const lead = this._ensureLead(identityKey);
    const key = String(area || '').toLowerCase();
    lead.funis[key] = (lead.funis[key] || 0) + 1;
    lead.history.push({ type: 'funnel', area: key, at: new Date().toISOString() });
    lead.lastUpdatedAt = new Date().toISOString();
    return lead.funis[key];
  },

  incrementStage(identityKey, stageCode) {
    if (!identityKey || !stageCode) return null;
    const lead = this._ensureLead(identityKey);
    const def = RdCrmConfig.stageByCode(stageCode);
    const tag = def?.tag || String(stageCode).toLowerCase().replace(/[^a-z0-9]/g, '');
    lead.etapas[tag] = (lead.etapas[tag] || 0) + 1;
    lead.history.push({ type: 'stage', stage: stageCode, tag, at: new Date().toISOString() });
    lead.lastUpdatedAt = new Date().toISOString();
    return lead.etapas[tag];
  },

  tagsForLead(identityKey) {
    const root = this._ensureRoot();
    return root[identityKey] || { funis: {}, etapas: {}, history: [], lastUpdatedAt: '' };
  },

  flattenTagList(identityKey) {
    const data = this.tagsForLead(identityKey);
    const tags = [];
    for (const [funnel, count] of Object.entries(data.funis || {})) {
      tags.push(`${RdCrmConfig.funnelTagFor(funnel.charAt(0).toUpperCase() + funnel.slice(1))}=${count}`);
    }
    for (const [tag, count] of Object.entries(data.etapas || {})) {
      tags.push(`${tag}=${count}`);
    }
    return tags;
  },

  async pushTagsToContact(rdContactId, tags = []) {
    if (!rdContactId || !tags.length) return { ok: false, message: 'Sem contato ou tags.' };
    const body = { tags: tags.map(t => String(t).split('=')[0]) };
    return RdCrmApiClient.patch(`/contacts/${encodeURIComponent(rdContactId)}`, body);
  },

  reset(identityKey) {
    const root = this._ensureRoot();
    delete root[identityKey];
  }
};
