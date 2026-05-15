// V21 — RD CRM Deal Service
// Busca negócios (deals) do RD. Cada deal traz contactId e stage —
// chave pra detectar won/lost e mudanças de pipeline.
//
// V22.0 — adicionados createDeal / moveDealToStage / findDealsByContact
// para o fluxo OUTBOUND (Journey originando deals no RD).
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

  // V22.0 — Cria um novo deal no RD CRM associado a um contato + pipeline + stage.
  // Body legacy: { name, deal_pipeline_id, deal_stage_id, amount_total, contacts:[{id}] }
  async createDeal({ rdContactId, pipelineId, stageId, name, amount = 0 }) {
    if (!window.RdCrmApiClient?.request) return { ok: false, message: 'API client indisponível.' };
    if (!rdContactId) return { ok: false, message: 'rdContactId ausente.' };
    if (!pipelineId)  return { ok: false, message: 'pipelineId ausente.' };
    if (!stageId)     return { ok: false, message: 'stageId ausente.' };
    const body = {
      name: String(name || `Deal ${rdContactId}`).slice(0, 200),
      deal_pipeline_id: pipelineId,
      deal_stage_id: stageId,
      amount_total: Number(amount) || 0,
      contacts: [{ id: rdContactId }]
    };
    const res = await RdCrmApiClient.post('/deals', body);
    if (!res?.ok) {
      return { ok: false, message: res?.message || `HTTP ${res?.status} ao criar deal.`, raw: res?.data };
    }
    const created = res.data?.deal || res.data;
    const rdDealId = created?.id || created?._id || null;
    if (!rdDealId) return { ok: false, message: 'Deal criado mas sem ID retornado.', raw: res.data };
    return { ok: true, rdDealId, deal: this._toCanonical(created) };
  },

  // V22.0 — Move um deal existente para outra stage. Usa PATCH (segue padrão
  // do stage rename, que sabemos funcionar no legacy do RD CRM).
  async moveDealToStage(rdDealId, newStageId) {
    if (!window.RdCrmApiClient?.request) return { ok: false, message: 'API client indisponível.' };
    if (!rdDealId)   return { ok: false, message: 'rdDealId ausente.' };
    if (!newStageId) return { ok: false, message: 'newStageId ausente.' };
    const res = await RdCrmApiClient.patch(`/deals/${encodeURIComponent(rdDealId)}`, {
      deal_stage_id: newStageId
    });
    if (!res?.ok) {
      return { ok: false, message: res?.message || `HTTP ${res?.status} ao mover deal.`, raw: res?.data };
    }
    return { ok: true, deal: this._toCanonical(res.data?.deal || res.data) };
  },

  // V22.0 — Lista deals de um contato. Usado pra dedup: se já há deal desse
  // contato num pipeline da campanha, não cria outro (idempotência).
  async findDealsByContact(rdContactId) {
    if (!window.RdCrmApiClient?.request || !rdContactId) return { ok: false, deals: [] };
    try {
      const res = await RdCrmApiClient.get(`/deals?contact_id=${encodeURIComponent(rdContactId)}`);
      if (!res?.ok) return { ok: false, deals: [] };
      const raw = res.data?.deals || res.data?.data || [];
      const list = Array.isArray(raw) ? raw : [];
      return { ok: true, deals: list.map(d => this._toCanonical(d)) };
    } catch (_) {
      return { ok: false, deals: [] };
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
