// V21 — RD CRM Contact Service
// Busca contatos do RD via API existente. Devolve no formato canônico do
// LeadBase. Sem token configurado, retorna lista vazia (não simula dados).
window.RdCrmContactService = {
  async fetchUpdatedSince(sinceIso, limit = 100) {
    if (!window.RdCrmApiClient?.request) return { ok: false, contacts: [], reason: 'no-client' };
    try {
      const params = { limit };
      if (sinceIso) params.updated_at_period = `${sinceIso}|${new Date().toISOString()}`;
      const res = await RdCrmApiClient.request('GET', '/contacts', null, params);
      const contacts = (res?.contacts || res?.data || []).map(c => this._toCanonical(c));
      return { ok: true, contacts, raw: res };
    } catch (err) {
      return { ok: false, contacts: [], reason: String(err?.message || err) };
    }
  },

  async fetchById(rdContactId) {
    if (!window.RdCrmApiClient?.request || !rdContactId) return null;
    try {
      const res = await RdCrmApiClient.request('GET', `/contacts/${rdContactId}`);
      return this._toCanonical(res);
    } catch (_) { return null; }
  },

  _toCanonical(raw) {
    if (!raw) return null;
    const email = (raw.emails && raw.emails[0]?.email) || raw.email || '';
    const phone = (raw.phones && raw.phones[0]?.phone) || raw.phone || '';
    const tags = Array.isArray(raw.tags) ? raw.tags.map(t => t.name || t.id || t).filter(Boolean) : [];
    return {
      rdContactId: raw.id || raw._id || raw.contact_id || null,
      name: raw.name || raw.full_name || '',
      email,
      phone,
      tags,
      rdContext: {
        origin: raw.origin || raw.source || null,
        utm: raw.utm || null,
        updatedAt: raw.updated_at || null,
        legalBases: raw.legal_bases || null
      }
    };
  }
};
