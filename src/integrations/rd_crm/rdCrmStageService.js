// V15 — Etapas (deal stages) do RD Station CRM.
// CRUD completo + função de sincronização com as 9 etapas padrão Journey.
window.RdCrmStageService = {
  endpoints: {
    list: (pipelineId) => `/deal_stages${pipelineId ? `?deal_pipeline_id=${encodeURIComponent(pipelineId)}` : ''}`,
    create: '/deal_stages',
    byId: (id) => `/deal_stages/${encodeURIComponent(id)}`
  },

  async listStages(pipelineId) {
    const result = await RdCrmApiClient.get(this.endpoints.list(pipelineId));
    if (!result.ok) return { ok: false, message: result.message, stages: [] };
    const raw = Array.isArray(result.data) ? result.data : result.data?.deal_stages || result.data?.data || [];
    return { ok: true, stages: raw, raw: result.data };
  },

  async createStage(pipelineId, name, order = 0, extras = {}) {
    if (!pipelineId) return { ok: false, message: 'Pipeline RD não informado.' };
    const body = {
      name: String(name || '').trim(),
      deal_pipeline_id: pipelineId,
      order: Number(order || 0),
      ...extras
    };
    const result = await RdCrmApiClient.post(this.endpoints.create, body);
    if (!result.ok) return { ok: false, message: result.message };
    return { ok: true, stage: result.data?.deal_stage || result.data };
  },

  async updateStage(stageId, data = {}) {
    if (!stageId) return { ok: false, message: 'ID da etapa ausente.' };
    const result = await RdCrmApiClient.patch(this.endpoints.byId(stageId), data);
    if (!result.ok) return { ok: false, message: result.message };
    return { ok: true, stage: result.data?.deal_stage || result.data };
  },

  async deleteStage(stageId) {
    if (!stageId) return { ok: false, message: 'ID da etapa ausente.' };
    const result = await RdCrmApiClient.del(this.endpoints.byId(stageId));
    if (!result.ok) return { ok: false, message: result.message };
    return { ok: true };
  },

  async ensureJourneyStages(pipelineId) {
    if (!pipelineId) return { ok: false, message: 'Pipeline RD não conectado.' };
    const remote = await this.listStages(pipelineId);
    if (!remote.ok) return remote;
    const remoteByName = new Map();
    for (const stage of (remote.stages || [])) {
      remoteByName.set(String(stage?.name || '').trim().toLowerCase(), stage);
    }
    const created = [];
    const reused = [];
    const stageMap = {};
    for (const def of RdCrmConfig.defaultStages()) {
      const key = def.label.toLowerCase();
      const existing = remoteByName.get(key);
      if (existing) {
        stageMap[def.code] = { rdStageId: existing.id || existing._id || existing.deal_stage_id, label: def.label, order: def.order, tag: def.tag };
        reused.push(def.label);
        continue;
      }
      const result = await this.createStage(pipelineId, def.label, def.order);
      if (!result.ok) return { ok: false, message: `Falha ao criar etapa "${def.label}": ${result.message}` };
      const id = result.stage?.id || result.stage?._id || result.stage?.deal_stage_id || '';
      stageMap[def.code] = { rdStageId: id, label: def.label, order: def.order, tag: def.tag };
      created.push(def.label);
    }
    return { ok: true, stageMap, created, reused };
  }
};
