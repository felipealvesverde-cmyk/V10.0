// V21 — RD CRM Deal Service
// Busca negócios (deals) do RD. Cada deal traz contactId e stage —
// chave pra detectar won/lost e mudanças de pipeline.
window.RdCrmDealService = {
  async fetchUpdatedSince(sinceIso, limit = 100) {
    if (!window.RdCrmApiClient?.request) return { ok: false, deals: [] };
    try {
      const params = { limit };
      if (sinceIso) params.updated_at = sinceIso;
      const res = await RdCrmApiClient.request('GET', '/deals', null, params);
      const deals = (res?.deals || res?.data || []).map(d => this._toCanonical(d));
      return { ok: true, deals, raw: res };
    } catch (err) {
      return { ok: false, deals: [], reason: String(err?.message || err) };
    }
  },

  _toCanonical(raw) {
    if (!raw) return null;
    const status = String(raw.win || raw.status || '').toLowerCase();
    const outcome = status === 'won' || status === 'true' || raw.win === true
      ? 'won'
      : (status === 'lost' || raw.win === false ? 'lost' : 'in-progress');
    return {
      rdDealId: raw.id || raw._id || null,
      rdContactId: (raw.contacts && raw.contacts[0]?.id) || raw.contact_id || null,
      name: raw.name || '',
      amount: Number(raw.amount_total || raw.amount || 0),
      stageId: raw.deal_stage_id || raw.stage?.id || null,
      stageName: raw.deal_stage?.name || raw.stage?.name || '',
      outcome,
      closedAt: raw.closed_at || null,
      updatedAt: raw.updated_at || null
    };
  }
};
