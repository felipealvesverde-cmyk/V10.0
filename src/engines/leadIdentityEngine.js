var LeadIdentityEngine = {
  normalizeEmail(v) { return String(v || '').trim().toLowerCase(); },
  normalizePhone(v) { return String(v || '').replace(/\D+/g, ''); },
  normalizeName(v) { return String(v || '').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim(); },
  makeId(seed) {
    let hash = 0; const s = String(seed || Date.now());
    for (let i=0;i<s.length;i++) hash = ((hash << 5) - hash) + s.charCodeAt(i) | 0;
    return 'LD-' + String(Math.abs(hash)).padStart(6,'0').slice(0,6);
  },
  identityKey(lead) {
    const email = this.normalizeEmail(lead.email);
    if (email) return `email:${email}`;
    const phone = this.normalizePhone(lead.phone);
    if (phone) return `phone:${phone}`;
    return `name:${this.normalizeName(lead.name)}:${lead.idade || ''}:${this.normalizeName(lead.empresa || lead.company || '')}`;
  },
  _normalizeWithStamp(lead, source, stamp) {
    const key = this.identityKey(lead);
    const tags = Array.isArray(lead.tags) ? lead.tags : String(lead.tags || '').split(/\s+/).filter(Boolean);
    return {
      ...lead,
      leadId: lead.leadId || this.makeId(key),
      identityKey: key,
      tags: Array.from(new Set(tags)),
      sources: Array.from(new Set([...(lead.sources || []), source])),
      lastUpdatedAt: stamp
    };
  },
  normalizeLead(lead, source = 'base') {
    return this._normalizeWithStamp(lead, source, new Date().toISOString());
  },
  merge(existing, incoming) {
    const stamp = new Date().toISOString();
    const a = this._normalizeWithStamp(existing || {}, 'existente', stamp);
    const b = this._normalizeWithStamp(incoming || {}, 'importação', stamp);
    const tags = Array.from(new Set([...(a.tags || []), ...(b.tags || [])]));
    const score = Math.max(Number(a.score || a.globalScore || 0), Number(b.score || b.globalScore || 0));
    return {
      ...a,
      ...Object.fromEntries(Object.entries(b).filter(([, v]) => v !== '' && v !== null && v !== undefined)),
      leadId: a.leadId || b.leadId,
      identityKey: a.identityKey || b.identityKey,
      score,
      tags,
      sources: Array.from(new Set([...(a.sources || []), ...(b.sources || [])])),
      lastUpdatedAt: stamp
    };
  },
  mergeMany(existingLeads = [], incomingLeads = [], source = 'importação') {
    const stamp = new Date().toISOString();
    const map = new Map();
    for (const lead of existingLeads) {
      const normalized = this._normalizeWithStamp(lead, lead.origem || 'base', stamp);
      map.set(normalized.identityKey, normalized);
    }
    for (const lead of incomingLeads) {
      const normalized = this._normalizeWithStamp(lead, source, stamp);
      map.set(normalized.identityKey, map.has(normalized.identityKey) ? this.merge(map.get(normalized.identityKey), normalized) : normalized);
    }
    return Array.from(map.values());
  }
};
window.LeadIdentityEngine = LeadIdentityEngine;
