// V21 — Lead Base Service
// Camada unificada sobre a base global de leads. Lista provém de
// LeadsModule.getGlobalLeads() (dedup por email/phone). Acrescenta operações
// de campanha-link, accumulating tags e event history que outros módulos
// (RD bridge, Score, Buscador) consomem.
window.LeadBaseService = {
  list() {
    if (window.LeadsModule?.getGlobalLeads) return LeadsModule.getGlobalLeads();
    return Array.isArray(App.state.manualLeads) ? App.state.manualLeads : [];
  },

  keyOf(lead) {
    return String(lead?.email || lead?.phone || lead?.id || lead?.name || '').toLowerCase().trim();
  },

  byKey(key) {
    const norm = String(key || '').toLowerCase().trim();
    if (!norm) return null;
    return this.list().find(l => this.keyOf(l) === norm) || null;
  },

  // ----- Campaign linking -----
  linkToCampaign(leadKey, campaignId) {
    const norm = String(leadKey || '').toLowerCase().trim();
    if (!norm || !campaignId) return false;
    const links = { ...(App.state.campaignLeadLinks || {}) };
    const list = Array.isArray(links[campaignId]) ? links[campaignId].slice() : [];
    if (list.includes(norm)) return false;
    list.push(norm);
    links[campaignId] = list;
    App.state.campaignLeadLinks = links;
    return true;
  },

  unlinkFromCampaign(leadKey, campaignId) {
    const norm = String(leadKey || '').toLowerCase().trim();
    const links = { ...(App.state.campaignLeadLinks || {}) };
    const list = Array.isArray(links[campaignId]) ? links[campaignId].filter(k => k !== norm) : [];
    links[campaignId] = list;
    App.state.campaignLeadLinks = links;
  },

  forCampaign(campaignId) {
    const keys = new Set((App.state.campaignLeadLinks || {})[campaignId] || []);
    if (!keys.size) return [];
    return this.list().filter(l => keys.has(this.keyOf(l)));
  },

  isLinked(leadKey, campaignId) {
    const norm = String(leadKey || '').toLowerCase().trim();
    const list = (App.state.campaignLeadLinks || {})[campaignId] || [];
    return list.includes(norm);
  },

  // ----- Lead writes (escreve em manualLeads quando o lead não existe em ação) -----
  upsert(rawLead, source) {
    const merged = this._normalize(rawLead);
    const key = this.keyOf(merged);
    if (!key) return null;
    const manualLeads = Array.isArray(App.state.manualLeads) ? App.state.manualLeads.slice() : [];
    const idx = manualLeads.findIndex(l => this.keyOf(l) === key);
    if (idx >= 0) {
      manualLeads[idx] = this._mergeRecords(manualLeads[idx], merged, source);
    } else {
      // Verifica também actions — se já existe lá, atualiza in-place
      const inActions = this._findInActions(key);
      if (inActions) {
        this._patchActionLead(inActions, merged, source);
        return inActions.lead;
      }
      manualLeads.unshift({ ...merged, createdAt: merged.createdAt || new Date().toISOString(), source: source || 'lead-base' });
    }
    App.state.manualLeads = manualLeads;
    return manualLeads[idx >= 0 ? idx : 0];
  },

  accumulateTag(leadKey, tag) {
    const key = String(leadKey || '').toLowerCase().trim();
    const tagN = String(tag || '').trim().replace(/^#/, '');
    if (!key || !tagN) return;
    this._patchEverywhere(key, lead => {
      const tags = Array.isArray(lead.tags) ? lead.tags.slice() : [];
      const counters = { ...(lead.tagCounters || {}) };
      if (!tags.includes(tagN)) tags.push(tagN);
      counters[tagN] = (counters[tagN] || 0) + 1;
      return { ...lead, tags, tagCounters: counters };
    });
  },

  pushEvent(leadKey, event) {
    const key = String(leadKey || '').toLowerCase().trim();
    if (!key) return;
    this._patchEverywhere(key, lead => {
      const history = Array.isArray(lead.eventHistory) ? lead.eventHistory : [];
      return { ...lead, eventHistory: [...history.slice(-49), { ...event, ts: event.ts || new Date().toISOString() }] };
    });
  },

  setStage(leadKey, stageId) {
    const key = String(leadKey || '').toLowerCase().trim();
    this._patchEverywhere(key, lead => ({
      ...lead,
      lifecycleStage: stageId || lead.lifecycleStage,
      lifecycleStageAt: new Date().toISOString()
    }));
  },

  markOutcome(leadKey, outcome) {
    const key = String(leadKey || '').toLowerCase().trim();
    this._patchEverywhere(key, lead => ({ ...lead, outcome, outcomeAt: new Date().toISOString() }));
  },

  // ----- Internals -----
  _normalize(raw) {
    return {
      ...raw,
      email: String(raw?.email || '').trim().toLowerCase(),
      phone: String(raw?.phone || '').replace(/\D/g, ''),
      name: String(raw?.name || '').trim()
    };
  },

  _mergeRecords(existing, incoming, source) {
    return {
      ...existing,
      ...incoming,
      tags: Array.from(new Set([...(existing.tags || []), ...(incoming.tags || [])])),
      tagCounters: { ...(existing.tagCounters || {}), ...(incoming.tagCounters || {}) },
      eventHistory: [...(existing.eventHistory || []), ...(incoming.eventHistory || [])].slice(-49),
      source: source || existing.source || 'merge',
      updatedAt: new Date().toISOString()
    };
  },

  _findInActions(key) {
    for (const action of (App.state.actions || [])) {
      for (const lead of (action.leads || [])) {
        if (this.keyOf(lead) === key) return { action, lead };
      }
    }
    return null;
  },

  _patchActionLead(target, patch, source) {
    App.state.actions = (App.state.actions || []).map(action => {
      if (action.id !== target.action.id) return action;
      return {
        ...action,
        leads: (action.leads || []).map(l => {
          if (this.keyOf(l) !== this.keyOf(target.lead)) return l;
          return this._mergeRecords(l, patch, source);
        })
      };
    });
  },

  _patchEverywhere(key, patcher) {
    // manualLeads
    App.state.manualLeads = (App.state.manualLeads || []).map(l => this.keyOf(l) === key ? patcher(l) : l);
    // leads em actions
    App.state.actions = (App.state.actions || []).map(action => ({
      ...action,
      leads: (action.leads || []).map(l => this.keyOf(l) === key ? patcher(l) : l)
    }));
  }
};
