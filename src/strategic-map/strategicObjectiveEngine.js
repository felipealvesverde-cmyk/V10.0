// V17 — Strategic Objective Engine
// CRUD de objetivos estratégicos dentro do mapa de um produto. Cada objetivo
// agrupa OKRs e pode ser conectado a campanhas/fluxos.
window.StrategicObjectiveEngine = {
  list(productId) {
    return (StrategicMapEngine.getForProduct(productId)?.objectives) || [];
  },

  add(productId, draft, campaignId) {
    const objective = {
      id: `obj_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      label: String(draft?.label || '').trim() || 'Frente sem nome',
      owner: String(draft?.owner || '').trim(),
      deadline: draft?.deadline || null,
      area: draft?.area || null,
      okrs: [],
      createdAt: new Date().toISOString()
    };
    // V29.0.0 — escreve em branch quando há campaignId.
    const targetCampaignId = campaignId || StrategicMapEngine._getActiveCampaignId(productId);
    if (targetCampaignId) {
      const branch = StrategicMapEngine.ensureBranchMap(targetCampaignId, productId);
      StrategicMapEngine.saveBranchMap(targetCampaignId, { objectives: [...(branch.objectives || []), objective] });
    } else {
      const map = StrategicMapEngine.ensure(productId);
      StrategicMapEngine.save(productId, { objectives: [...(map.objectives || []), objective] });
    }
    return objective;
  },

  update(productId, objectiveId, patch, campaignId) {
    const targetCampaignId = campaignId || StrategicMapEngine._getActiveCampaignId(productId);
    if (targetCampaignId && StrategicMapEngine.getBranchMap(targetCampaignId)) {
      const branch = StrategicMapEngine.getBranchMap(targetCampaignId);
      const objectives = (branch.objectives || []).map(o => o.id === objectiveId ? { ...o, ...patch } : o);
      StrategicMapEngine.saveBranchMap(targetCampaignId, { objectives });
      return;
    }
    const map = StrategicMapEngine.getForProduct(productId);
    const objectives = (map.objectives || []).map(o => o.id === objectiveId ? { ...o, ...patch } : o);
    StrategicMapEngine.save(productId, { objectives });
  },

  remove(productId, objectiveId, campaignId) {
    const targetCampaignId = campaignId || StrategicMapEngine._getActiveCampaignId(productId);
    if (targetCampaignId && StrategicMapEngine.getBranchMap(targetCampaignId)) {
      const branch = StrategicMapEngine.getBranchMap(targetCampaignId);
      const objectives = (branch.objectives || []).filter(o => o.id !== objectiveId);
      StrategicMapEngine.saveBranchMap(targetCampaignId, { objectives });
      return;
    }
    const map = StrategicMapEngine.getForProduct(productId);
    const objectives = (map.objectives || []).filter(o => o.id !== objectiveId);
    StrategicMapEngine.save(productId, { objectives });
  }
};
