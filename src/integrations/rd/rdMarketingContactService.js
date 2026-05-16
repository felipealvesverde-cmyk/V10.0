// V24.0.0 — RD Marketing Contact Service
//
// O RD Station tem DUAS bases de contatos distintas:
//   - CRM (crm.rdstation.com): contatos com deals/pipelines. Gerenciado por
//     RdCrmContactService usando PAT (legacy=true, ?token=X).
//   - Marketing (api.rd.services/platform/contacts): contatos com lead-scoring
//     próprio do RD Marketing, listas de email, eventos de conversão. Usa
//     OAuth Bearer (legacy=false).
//
// Este service cuida da base MARKETING. Por que importa:
//   - Quando vc dispara email do RD Marketing, ele vai pra base Marketing.
//   - Lead-scoring do Marketing (que o RD calcula nativamente) gera tags que
//     são empurradas pra cá — e podem ser puxadas pelo Journey via webhook
//     ou via este pull.
//   - Bidirecional: leads novos do Journey podem ser empurrados pra Marketing
//     pra entrar em fluxos de email.
//
// Todas as chamadas passam por /api/rd-proxy (legacy=false, useQueryToken=false)
// pra contornar CORS — mesmo padrão do RdCrmApiClient mas com flags diferentes.
window.RdMarketingContactService = {
  _accessToken() {
    return App.state.integrations?.rd?.accessToken || '';
  },

  hasOAuth() { return Boolean(this._accessToken()); },

  async _request(method, path, body = null) {
    const token = this._accessToken();
    if (!token) return { ok: false, status: 'missing_token', message: 'OAuth do RD Marketing não conectado.' };
    try {
      const response = await fetch('/api/rd-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          path: path.startsWith('/') ? path : `/${path}`,
          body,
          token,
          legacy: false,
          useQueryToken: false
        })
      });
      const text = await response.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
      return {
        ok: response.ok,
        status: response.status,
        data,
        message: response.ok ? 'OK' : (data?.errors?.[0]?.error_message || data?.message || `HTTP ${response.status}`)
      };
    } catch (error) {
      return { ok: false, status: 'network_error', message: error?.message || 'Erro de rede.' };
    }
  },

  _toCanonical(raw) {
    if (!raw) return null;
    return {
      rdMarketingId: raw.uuid || raw.id || null,
      name: raw.name || '',
      email: raw.email || '',
      phone: raw.personal_phone || raw.mobile_phone || '',
      company: raw.company || '',
      jobTitle: raw.job_title || '',
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      leadScore: Number(raw.lead_score?.score || raw.lead_score || 0),
      leadStage: raw.lifecycle_stage || raw.lead_stage || '',
      lastConversionAt: raw.last_conversion?.created_at || null,
      origin: raw.origin || null,
      updatedAt: raw.updated_at || null
    };
  },

  // Busca contato no Marketing por email. Retorna canonical ou null.
  async findByEmail(email) {
    if (!email) return null;
    const path = `/platform/contacts/email:${encodeURIComponent(email)}`;
    const res = await this._request('GET', path);
    if (!res.ok) return null;
    return this._toCanonical(res.data);
  },

  // Cria/atualiza contato no Marketing. RD usa UPSERT por email naturalmente.
  // Body Marketing: { name, email, personal_phone, company, job_title, tags, ... }
  async upsertContact(lead) {
    const email = String(lead?.email || '').trim().toLowerCase();
    if (!email) return { ok: false, message: 'Lead sem email.' };
    const body = {
      name: lead.name || email,
      email,
      personal_phone: lead.phone || '',
      company: lead.company || '',
      job_title: lead.jobTitle || ''
    };
    if (Array.isArray(lead.tags) && lead.tags.length) {
      body.tags = lead.tags.map(t => String(t).trim()).filter(Boolean);
    }
    // Endpoint UPSERT: PATCH /platform/contacts/email:<email>
    const path = `/platform/contacts/email:${encodeURIComponent(email)}`;
    const res = await this._request('PATCH', path, body);
    if (!res.ok) return { ok: false, message: res.message };
    const canonical = this._toCanonical(res.data);
    return { ok: true, contact: canonical, rdMarketingId: canonical?.rdMarketingId };
  },

  // V24.0.0 — Pull de contatos modificados desde ISO. RD Marketing não tem
  // endpoint nativo "since=" pra todos contatos, mas tem /platform/conversions
  // que dá o que importa: leads convertidos com timestamp. Estratégia:
  //   1. Pula leads do Marketing pra LeadBaseService (origem = "rd-marketing")
  //   2. Tags + lead_score viram tags acumulativas em RdCrmTagService
  //
  // Limitação RD: paginação por offset; sem timestamp absoluto no /contacts.
  // Pra MVP V24.0.0 fazemos best-effort com /platform/conversions.
  async syncUpdatedSince(sinceIso, limit = 100) {
    if (!this.hasOAuth()) return { ok: false, applied: 0, reason: 'no-oauth' };
    const path = `/platform/conversions?page_size=${limit}`;
    const res = await this._request('GET', path);
    if (!res.ok) return { ok: false, applied: 0, reason: res.message };
    const list = res.data?.conversions || res.data?.data || [];
    if (!Array.isArray(list)) return { ok: false, applied: 0, reason: 'invalid-payload' };
    const sinceMs = sinceIso ? Date.parse(sinceIso) : 0;
    let applied = 0;
    for (const conv of list) {
      const ts = Date.parse(conv.created_at || '');
      if (sinceMs && !Number.isNaN(ts) && ts < sinceMs) continue;
      const contact = conv.contact || conv;
      const email = contact.email || conv.email || '';
      if (!email) continue;
      if (window.LeadBaseService?.upsert) {
        const lead = LeadBaseService.upsert({
          name: contact.name || email,
          email,
          phone: contact.personal_phone || '',
          rdMarketingId: contact.uuid || null,
          tags: Array.isArray(contact.tags) ? contact.tags : []
        }, 'rd-marketing');
        if (lead) {
          applied += 1;
          const key = LeadBaseService.keyOf(lead);
          if (key) {
            LeadBaseService.pushEvent(key, {
              source: 'rd-marketing',
              type: 'conversion.captured',
              identifier: conv.identifier || conv.conversion_identifier || '',
              at: conv.created_at || new Date().toISOString()
            });
          }
        }
      }
    }
    App.state.rdMarketingLastSyncAt = new Date().toISOString();
    return { ok: true, applied, total: list.length };
  },

  // Empurra um lead do Journey pro RD Marketing.
  // Idempotente: o endpoint /platform/contacts/email:X é UPSERT por design.
  async pushLead(lead) {
    return this.upsertContact(lead);
  }
};
