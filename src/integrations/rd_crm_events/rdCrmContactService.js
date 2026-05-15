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

  // V22.0 — Busca contato no RD CRM por email. Retorna canonical ou null.
  async findByEmail(email) {
    if (!window.RdCrmApiClient?.request || !email) return null;
    try {
      const res = await RdCrmApiClient.get(`/contacts?email=${encodeURIComponent(email)}`);
      if (!res?.ok) return null;
      const raw = res.data?.contacts || res.data?.data || [];
      const list = Array.isArray(raw) ? raw : [];
      const found = list.find(c => {
        const e = (c?.emails?.[0]?.email || c?.email || '').toLowerCase();
        return e === email.toLowerCase();
      });
      return found ? this._toCanonical(found) : null;
    } catch (_) { return null; }
  },

  // V22.0 — Upsert: procura por email; se acha reutiliza; se não cria.
  // Body do POST baseia-se no schema legacy do RD CRM:
  //   { name, emails: [{email}], phones: [{phone}] }
  // Retorna { ok, rdContactId, created, contact, message? }
  async upsertContact(lead) {
    if (!window.RdCrmApiClient?.request) return { ok: false, message: 'API client indisponível.' };
    const email = String(lead?.email || '').trim();
    const name = String(lead?.name || lead?.email || '').trim();
    const phone = String(lead?.phone || '').trim();
    if (!email) return { ok: false, message: 'Lead sem email — não dá pra fazer upsert no RD.' };
    const existing = await this.findByEmail(email);
    if (existing?.rdContactId) {
      return { ok: true, rdContactId: existing.rdContactId, created: false, contact: existing };
    }
    const body = { name: name || email };
    if (email) body.emails = [{ email }];
    if (phone) body.phones = [{ phone }];
    const res = await RdCrmApiClient.post('/contacts', body);
    if (!res?.ok) {
      return { ok: false, message: res?.message || `HTTP ${res?.status} ao criar contato.` };
    }
    const created = res.data?.contact || res.data;
    const canonical = this._toCanonical(created);
    if (!canonical?.rdContactId) {
      return { ok: false, message: 'Contato criado mas sem ID retornado.', raw: res.data };
    }
    return { ok: true, rdContactId: canonical.rdContactId, created: true, contact: canonical };
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
