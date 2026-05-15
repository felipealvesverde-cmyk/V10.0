// V18 — Revenue Score Blueprint Engine
// Camada de orquestração: cria, atualiza e versiona blueprints. Usa o
// IcpBlueprintGenerator para construir e o RevenueScoreEngine para persistir.
window.RevenueScoreBlueprintEngine = {
  createFromAnswers(campaignId, answers) {
    const blueprint = IcpBlueprintGenerator.generate(answers || {});
    blueprint.answers = answers || {};
    blueprint.version = 1;
    return RevenueScoreEngine.saveBlueprint(campaignId, blueprint);
  },

  updateFromAnswers(campaignId, answers) {
    const existing = RevenueScoreEngine.getBlueprint(campaignId);
    const blueprint = IcpBlueprintGenerator.generate(answers || {});
    blueprint.answers = answers || {};
    blueprint.version = Number(existing?.version || 0) + 1;
    return RevenueScoreEngine.saveBlueprint(campaignId, blueprint);
  },

  archive(campaignId) {
    return RevenueScoreEngine.removeBlueprint(campaignId);
  }
};
