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

    // V21.4.4 — Pipelines novos do RD vêm com 4-5 etapas default (Qualificação,
    // Apresentação, Negociação...). Somadas às 9 do Journey, estouram o limite
    // de etapas por pipeline. Como esses pipelines são exclusivos do Journey
    // (criados via createUniqueJourneyPipeline com sufixo em colisão de nome),
    // qualquer etapa que não case com nossas 9 é default do RD e pode ser
    // deletada com segurança antes de criarmos as nossas.
    // V21.4.5 — Rastreamos falhas de delete com a mensagem real do RD pra
    // entender por que algumas etapas defaults não estão sendo removidas.
    const journeyLabels = new Set(RdCrmConfig.defaultStages().map(s => s.label.toLowerCase()));
    const remoteByName = new Map();
    const deleted = [];
    const deleteFailures = [];
    for (const stage of (remote.stages || [])) {
      const name = String(stage?.name || '').trim().toLowerCase();
      if (journeyLabels.has(name)) {
        remoteByName.set(name, stage);
      } else {
        const stageId = stage?.id || stage?._id || stage?.deal_stage_id;
        const stageName = stage?.name || stageId || '(sem nome)';
        if (stageId) {
          const del = await this.deleteStage(stageId);
          if (del.ok) {
            deleted.push(stageName);
          } else {
            deleteFailures.push(`${stageName} → ${del.message || 'sem mensagem'}`);
          }
        } else {
          deleteFailures.push(`${stageName} → sem ID`);
        }
      }
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
      if (!result.ok) {
        const delSuffix = deleteFailures.length ? ` | Falhas de delete prévias: ${deleteFailures.join('; ')}` : '';
        return { ok: false, message: `Falha ao criar etapa "${def.label}": ${result.message}${delSuffix}`, deleted, deleteFailures };
      }
      const id = result.stage?.id || result.stage?._id || result.stage?.deal_stage_id || '';
      stageMap[def.code] = { rdStageId: id, label: def.label, order: def.order, tag: def.tag };
      created.push(def.label);
    }
    return { ok: true, stageMap, created, reused, deleted, deleteFailures };
  }
};
