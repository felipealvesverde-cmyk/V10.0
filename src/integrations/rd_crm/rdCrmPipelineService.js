// V15 / V21.5 — Pipelines do RD Station CRM.
// CRUD + criação SEGURA: nunca reusa pipeline pré-existente do usuário.
// Sufixa com número crescente em colisão de nome ("Journey Revenue Pipeline",
// "Journey Revenue Pipeline (2)", ...). Sem DELETE e sem UPDATE automáticos.
window.RdCrmPipelineService = {
  endpoints: {
    list: '/deal_pipelines',
    create: '/deal_pipelines',
    byId: (id) => `/deal_pipelines/${encodeURIComponent(id)}`
  },

  async listPipelines() {
    const result = await RdCrmApiClient.get(this.endpoints.list);
    if (!result.ok) return { ok: false, message: result.message, status: result.status, attempts: result.dryRun ? ['legacy'] : null, pipelines: [] };
    const raw = Array.isArray(result.data) ? result.data : result.data?.deal_pipelines || result.data?.data || [];
    return { ok: true, pipelines: raw, raw: result.data };
  },

  async createPipeline(name) {
    const safeName = String(name || RdCrmConfig.defaultPipelineName).trim();
    const result = await RdCrmApiClient.post(this.endpoints.create, { name: safeName });
    if (!result.ok) return { ok: false, message: result.message };
    const pipeline = result.data?.deal_pipeline || result.data || {};
    return { ok: true, pipeline };
  },

  async getPipeline(id) {
    if (!id) return { ok: false, message: 'ID do pipeline ausente.' };
    const result = await RdCrmApiClient.get(this.endpoints.byId(id));
    if (!result.ok) return { ok: false, message: result.message };
    return { ok: true, pipeline: result.data };
  },

  // V21.5 — Cria pipeline novo. Se já existe pipeline com o mesmo nome no RD
  // (criado manualmente, por outra ferramenta ou em sync anterior), procura
  // o próximo sufixo livre e cria com ele. NUNCA reusa pipeline alheio.
  async createUniqueJourneyPipeline(name = RdCrmConfig.defaultPipelineName) {
    const list = await this.listPipelines();
    if (!list.ok) return list;
    const existingNames = (list.pipelines || []).map(p => String(p?.name || '').trim());
    const uniqueName = this._nextFreeName(name, existingNames);
    const created = await this.createPipeline(uniqueName);
    if (!created.ok) return created;
    const requested = String(name || '').trim();
    return {
      ok: true,
      pipeline: created.pipeline,
      created: true,
      name: uniqueName,
      collisionAvoided: uniqueName.toLowerCase() !== requested.toLowerCase(),
      requestedName: requested
    };
  },

  // Encontra próximo sufixo livre no padrão "base", "base (2)", "base (3)", ...
  // Case-insensitive, trim de espaços.
  _nextFreeName(baseName, existingNames) {
    const base = String(baseName || '').trim();
    const taken = new Set((existingNames || []).map(n => String(n || '').trim().toLowerCase()));
    if (!taken.has(base.toLowerCase())) return base;
    let n = 2;
    while (taken.has(`${base} (${n})`.toLowerCase())) n += 1;
    return `${base} (${n})`;
  },

  // V21.5 — Alias mantido por compat. Comportamento agora é SEMPRE criar
  // novo (com sufixo em colisão) em vez de reusar pipeline pré-existente.
  // Quem precisa reusar deve guardar o ID em cfg.pipelineId e usar getPipeline.
  async findOrCreateJourneyPipeline(name = RdCrmConfig.defaultPipelineName) {
    return this.createUniqueJourneyPipeline(name);
  }
};
