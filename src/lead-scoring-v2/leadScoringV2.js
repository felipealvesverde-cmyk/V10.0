// V19 — Lead Scoring V2 — Facade
// API pública única para classificação de leads. Orquestra Fit/Intent/Account/
// Lifecycle/Tier/ColdStart/Confidence/History em uma chamada.
// Substitui RevenueLeadClassification para uso novo, mas mantém shape compat.
window.LeadScoringV2 = {
  classifyCampaign(campaignId, opts = {}) {
    const blueprint = window.RevenueScoreEngine?.getBlueprint(campaignId);
    if (!blueprint) return { ok: false, message: 'Sem Revenue Score para esta campanha.' };
    const actions = (App.state.actions || []).filter(a => Number(a.campaignId) === Number(campaignId));
    const stage1 = [];
    const seenKeys = new Set();
    // 1) leads em actions (canal histórico)
    for (const action of actions) {
      for (const lead of (action.leads || [])) {
        const key = window.LeadBaseService ? LeadBaseService.keyOf(lead) : String(lead?.email || lead?.id || '').toLowerCase();
        if (key) seenKeys.add(key);
        const c = this.classifyLead(blueprint, lead, campaignId);
        stage1.push({ ...c, actionId: action.id, actionName: action.name });
      }
    }
    // 2) V21 — leads vinculados via LeadBaseService (Buscador → Adicionar à campanha)
    if (window.LeadBaseService) {
      const linkedLeads = LeadBaseService.forCampaign(campaignId);
      for (const lead of linkedLeads) {
        const key = LeadBaseService.keyOf(lead);
        if (seenKeys.has(key)) continue; // não duplica
        const c = this.classifyLead(blueprint, lead, campaignId);
        stage1.push({ ...c, actionId: null, actionName: 'Buscador de Perfil' });
      }
    }
    // Tier dinâmico por percentis (com floor absoluto + multiplier por awareness)
    const scores = stage1.map(c => c.revenueScore);
    const awareness = blueprint?._internal?.fitRules?.awarenessLevel || null;
    const thresholds = window.TierEngine ? TierEngine.thresholdsFor(scores, awareness) : { A: 60, B: 45, C: 25, source: 'fallback' };
    // Revenue Ready: top quartil OU score >=75, o que for mais alto
    const revenueReadyFloor = Math.max(thresholds.A, 75);
    const classified = stage1.map(c => {
      const tier = window.TierEngine ? TierEngine.tierFor(c.revenueScore, thresholds) : 'D';
      const revenueReady = c.revenueScore >= revenueReadyFloor;
      // Push score history (snapshot por classification)
      if (window.ScoreHistoryEngine && !opts.skipHistory) {
        ScoreHistoryEngine.push(c.lead, campaignId, { fit: c.fit, intent: c.intent, revenueScore: c.revenueScore, tier, revenueReady });
      }
      return { ...c, tier, revenueReady };
    });
    // Account aggregation
    const accounts = window.AccountAggregator ? AccountAggregator.group(classified) : [];
    // Concept drift baseline
    if (window.ConceptDriftMonitor && classified.length >= 10) {
      const baseline = (App.state.driftBaselines || {})[campaignId];
      if (!baseline) ConceptDriftMonitor.recordBaseline(campaignId, scores);
    }
    const drift = window.ConceptDriftMonitor ? ConceptDriftMonitor.detectDrift(campaignId, scores) : { drift: false };
    return {
      ok: true,
      blueprint,
      classified,
      accounts,
      thresholds,
      drift,
      summary: this._summarize(classified, accounts)
    };
  },

  classifyLead(blueprint, lead, campaignId) {
    const fit = window.FitEngine ? FitEngine.forLead(blueprint, lead) : { score: 0, reasons: [], detected: 0, possible: 5, negativesHit: 0 };
    const intent = window.IntentEngine ? IntentEngine.forLead(blueprint, lead, campaignId) : { score: 0, reasons: [], detected: 0, possible: 0, momentum: 0 };
    // MEDDIC boost no fit (somente se tiver dado preenchido)
    let fitScore = fit.score;
    if (lead?.meddic && window.MeddicEngine) fitScore = Math.min(100, fitScore + MeddicEngine.scoreBoost(lead.meddic));
    // Revenue Score: combina fit + intent. Pesos por segmento.
    const fitWeight = blueprint.segment === 'B2C' ? 0.45 : 0.6;
    const intentWeight = 1 - fitWeight;
    let revenueScore = Math.round(fitScore * fitWeight + intent.score * intentWeight);
    // Cold start: lead novo → blend com prior
    let coldStartMeta = null;
    if (window.ColdStartEngine && (fit.reasons.length + intent.reasons.length) < 3) {
      const adjusted = ColdStartEngine.apply({
        fit: fitScore, intent: intent.score,
        fitReasons: fit.reasons, intentReasons: intent.reasons
      }, blueprint);
      fitScore = adjusted.fit;
      revenueScore = Math.round(adjusted.fit * fitWeight + adjusted.intent * intentWeight);
      coldStartMeta = { coldStart: true, priorWeight: adjusted.priorWeight };
    }
    // Lifecycle suggestion
    const suggestedStage = window.LifecycleEngine ? LifecycleEngine.suggestStage({ fit: fitScore, intent: intent.score, revenueScore, lead }) : 'subscriber';
    // Confidence
    const detected = (fit.detected || 0) + (intent.detected || 0);
    const possible = (fit.possible || 0) + (intent.possible || 0);
    const confidence = possible ? Math.round((detected / possible) * 100) : 0;
    // Trend arrow
    const trend = window.ScoreHistoryEngine ? ScoreHistoryEngine.trendArrow(lead, campaignId) : null;
    return {
      fit: fitScore,
      intent: intent.score,
      revenueScore,
      confidence,
      detected,
      possible,
      partial: detected < 2,
      negativesHit: fit.negativesHit || 0,
      momentum: intent.momentum || 0,
      trend,
      suggestedStage,
      currentStage: lead?.lifecycleStage || 'subscriber',
      coldStart: Boolean(coldStartMeta),
      priorWeight: coldStartMeta?.priorWeight || 0,
      reasons: {
        positive: [...(fit.reasons || []).filter(r => r.type !== 'negative'), ...(intent.reasons || [])].sort((a, b) => (b.points || 0) - (a.points || 0)),
        negative: (fit.reasons || []).filter(r => r.type === 'negative')
      },
      lead
    };
  },

  _summarize(classified, accounts) {
    const n = classified.length || 1;
    const tier = { A: 0, B: 0, C: 0, D: 0 };
    let revenueReady = 0;
    let sumFit = 0, sumIntent = 0, sumRev = 0, sumConf = 0, partialCount = 0, coldCount = 0;
    for (const c of classified) {
      tier[c.tier] = (tier[c.tier] || 0) + 1;
      if (c.revenueReady) revenueReady += 1;
      if (c.partial) partialCount += 1;
      if (c.coldStart) coldCount += 1;
      sumFit += c.fit; sumIntent += c.intent; sumRev += c.revenueScore; sumConf += c.confidence;
    }
    return {
      total: classified.length,
      accounts: accounts.length,
      tier,
      revenueReady,
      partialCount,
      coldCount,
      avgFit: Math.round(sumFit / n),
      avgIntent: Math.round(sumIntent / n),
      avgRevenueScore: Math.round(sumRev / n),
      avgConfidence: Math.round(sumConf / n)
    };
  }
};
