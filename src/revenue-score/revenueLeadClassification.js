// V18 — Revenue Lead Classification
// Classifica cada lead da campanha como Quente / Morno / Frio com base na
// média ponderada de Fit Score (60%) e Engagement Score (40%). Marca
// "Revenue Ready" quando passa o threshold do blueprint.
window.RevenueLeadClassification = {
  // Etapa 1: compõe fit/engagement/revScore por lead (sem tier).
  // Etapa 2: calcula percentis P50/P75/P90 da campanha — usa-os como
  // thresholds dinâmicos quando há >=5 leads. Abaixo disso, cai no
  // fallback fixo do blueprint.
  classifyLead(blueprint, lead) {
    const fitResult = RevenueFitEngine.forLead(blueprint, lead);
    const engResult = EngagementSignalEngine.forLead(blueprint, lead);
    const fit = fitResult.score;
    const engagement = engResult.score;
    const revScore = Math.round(fit * 0.6 + engagement * 0.4);
    const detected = (fitResult.detected || 0) + (engResult.detected || 0);
    const possible = (fitResult.possible || 0) + (engResult.possible || 0);
    const confidence = possible ? Math.round((detected / possible) * 100) : 0;
    return {
      fit, engagement, revenueScore: revScore,
      confidence,
      detected, possible,
      partial: detected < 2,
      negativesHit: fitResult.negativesHit || 0,
      decay: engResult.decay || 100,
      lead
    };
  },

  classifyCampaign(campaignId) {
    const blueprint = window.RevenueScoreEngine?.getBlueprint(campaignId);
    if (!blueprint) return { ok: false, message: 'Sem Revenue Score para esta campanha.' };
    const actions = (App.state.actions || []).filter(a => Number(a.campaignId) === Number(campaignId));
    const stage1 = [];
    for (const action of actions) {
      for (const lead of (action.leads || [])) {
        const c = this.classifyLead(blueprint, lead);
        stage1.push({ ...c, actionId: action.id, actionName: action.name });
      }
    }
    // Thresholds dinâmicos com >=5 leads, senão fallback fixo do blueprint.
    const fallback = blueprint._internal?.thresholds || { hot: 60, warm: 35, revenueReady: 75 };
    const scores = stage1.map(c => c.revenueScore);
    const thresholds = scores.length >= 5
      ? { warm: this._percentile(scores, 50), hot: this._percentile(scores, 75), revenueReady: this._percentile(scores, 90), source: 'dynamic' }
      : { ...fallback, source: 'fallback' };
    const classified = stage1.map(c => {
      let tier;
      if (c.revenueScore >= thresholds.hot) tier = 'hot';
      else if (c.revenueScore >= thresholds.warm) tier = 'warm';
      else tier = 'cold';
      const revenueReady = c.revenueScore >= thresholds.revenueReady;
      return { ...c, tier, revenueReady };
    });
    return { ok: true, blueprint, classified, thresholds, summary: this._summarize(classified) };
  },

  _percentile(values, p) {
    if (!values.length) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const rank = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(rank);
    const hi = Math.ceil(rank);
    if (lo === hi) return Math.round(sorted[lo]);
    return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo));
  },

  _summarize(classified) {
    const tier = { hot: 0, warm: 0, cold: 0 };
    let revenueReady = 0;
    let sumFit = 0, sumEng = 0, sumRev = 0, sumConf = 0, partialCount = 0;
    for (const c of classified) {
      tier[c.tier] += 1;
      if (c.revenueReady) revenueReady += 1;
      sumFit += c.fit;
      sumEng += c.engagement;
      sumRev += c.revenueScore;
      sumConf += c.confidence;
      if (c.partial) partialCount += 1;
    }
    const n = classified.length || 1;
    return {
      total: classified.length,
      tier,
      revenueReady,
      avgFit: Math.round(sumFit / n),
      avgEngagement: Math.round(sumEng / n),
      avgRevenueScore: Math.round(sumRev / n),
      avgConfidence: Math.round(sumConf / n),
      partialCount
    };
  }
};
