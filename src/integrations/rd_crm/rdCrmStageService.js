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

    // V21.4.6 — Mudança de estratégia: o RD CRM legacy não suporta DELETE
    // em /deal_stages/{id} (retorna 404). Como pipelines novos vêm com etapas
    // default (Contato feito, Apresentação...) e nossas 9 Journey somadas
    // estouram o limite por pipeline (~12), em vez de tentar deletar, agora
    // RENOMEAMOS as defaults pros labels Journey via PATCH. Reaproveita os
    // slots existentes em vez de criar novos.
    //
    // Também tolera falhas parciais: se uma stage específica falhar, continua
    // tentando as outras em vez de abortar. Retorna ok:true se conseguiu pelo
    // menos 1 stage; status detalhado em created/reused/renamed/failedCreates.
    const journeyLabels = new Set(RdCrmConfig.defaultStages().map(s => s.label.toLowerCase()));
    const remoteByName = new Map();
    const renameCandidates = [];
    for (const stage of (remote.stages || [])) {
      const name = String(stage?.name || '').trim().toLowerCase();
      if (journeyLabels.has(name)) {
        remoteByName.set(name, stage);
      } else {
        const stageId = stage?.id || stage?._id || stage?.deal_stage_id;
        if (stageId) {
          renameCandidates.push({ id: stageId, originalName: stage?.name || String(stageId) });
        }
      }
    }

    const created = [];
    const reused = [];
    const renamed = [];
    const failed = [];
    const stageMap = {};
    const defs = RdCrmConfig.defaultStages();

    for (const def of defs) {
      const key = def.label.toLowerCase();
      const existing = remoteByName.get(key);
      if (existing) {
        stageMap[def.code] = {
          rdStageId: existing.id || existing._id || existing.deal_stage_id,
          label: def.label, order: def.order, tag: def.tag
        };
        reused.push(def.label);
        continue;
      }

      // Tenta renomear uma stage default que ainda não foi usada.
      if (renameCandidates.length > 0) {
        const candidate = renameCandidates.shift();
        const upd = await this.updateStage(candidate.id, { name: def.label, order: def.order });
        if (upd.ok) {
          stageMap[def.code] = {
            rdStageId: candidate.id,
            label: def.label, order: def.order, tag: def.tag
          };
          renamed.push(`"${candidate.originalName}" → ${def.label}`);
          continue;
        }
        // PATCH falhou — registra e segue tentando create (não devolve candidato à pool, ia falhar de novo).
        failed.push(`Rename "${candidate.originalName}" → ${def.label}: ${upd.message || 'erro desconhecido'}`);
      }

      // Fallback: criar nova stage do zero.
      const result = await this.createStage(pipelineId, def.label, def.order);
      if (!result.ok) {
        failed.push(`Criar "${def.label}": ${result.message}`);
        continue; // V21.4.6 — tolera e segue tentando próximas
      }
      const id = result.stage?.id || result.stage?._id || result.stage?.deal_stage_id || '';
      if (!id) {
        failed.push(`Criar "${def.label}": resposta sem ID`);
        continue;
      }
      stageMap[def.code] = { rdStageId: id, label: def.label, order: def.order, tag: def.tag };
      created.push(def.label);
    }

    const totalMapped = Object.keys(stageMap).length;
    const totalNeeded = defs.length;
    const parts = [];
    if (created.length) parts.push(`${created.length} criada(s)`);
    if (renamed.length) parts.push(`${renamed.length} renomeada(s)`);
    if (reused.length) parts.push(`${reused.length} reaproveitada(s)`);
    const summary = `${totalMapped}/${totalNeeded} stages provisionadas (${parts.join(', ') || 'nada novo'}).`;
    const failSuffix = failed.length ? ` Falhas: ${failed.join('; ')}` : '';

    return {
      ok: totalMapped > 0,
      stageMap,
      created,
      reused,
      renamed,
      failed,
      message: summary + failSuffix
    };
  }
};
