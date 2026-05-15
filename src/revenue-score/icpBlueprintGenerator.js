// V18 — ICP Blueprint Generator
// Converte respostas em Revenue Score Blueprint. Cria a parte pública (resumo
// humano) e a parte interna (pesos por sinal, regras de fit). O usuário só vê
// a pública; a interna alimenta classificação e dashboard.
window.IcpBlueprintGenerator = {
  generate(answers) {
    const interpreted = IcpIntelligenceAgent.interpret(answers);
    const signals = interpreted.signals || [];
    const negativeSignals = Array.isArray(answers.negativeSignals) ? answers.negativeSignals : [];
    // Engagement weights: peso base + explicit/implicit doubling (Iris).
    // tagAliases: mapeamento manual signal→tag-do-RD/CSV (resolve matcher fuzzy).
    const engagementSignals = {};
    const userAliases = (answers.tagAliases && typeof answers.tagAliases === 'object') ? answers.tagAliases : {};
    signals.forEach((s, i) => {
      const base = 22 - Math.min(18, i * 2);
      const isExplicit = window.IcpConversationFlow?.isExplicit?.(s);
      const aliasList = Array.isArray(userAliases[s]) ? userAliases[s] : [];
      engagementSignals[s] = {
        weight: base * (isExplicit ? 2 : 1),
        type: isExplicit ? 'explicit' : 'implicit',
        tagAliases: aliasList
      };
    });
    // V20 — Trigger weights: para cada trigger marcado em relevantTriggers,
    // guarda { triggerId: weight } usando o catálogo do TriggerEventEngine.
    const triggerWeights = {};
    const relevantTriggers = Array.isArray(answers.relevantTriggers) ? answers.relevantTriggers : [];
    if (window.TriggerEventEngine) {
      for (const label of relevantTriggers) {
        const meta = TriggerEventEngine.metaFor(label);
        if (meta) triggerWeights[meta.id] = meta.weight;
      }
    }
    const internal = {
      fitRules: {
        decisionMaker: answers.decisionMaker || null,
        companySize: answers.companySize || null,
        ageRange: answers.ageRange || null,
        painPoint: answers.painPoint || null,
        interest: answers.interest || null,
        // V20 — persona expandida
        industry: answers.industry || null,
        companyRevenue: answers.companyRevenue || null,
        income: answers.income || null,
        jobTitle: answers.jobTitle || null,
        geography: answers.geography || null,
        awarenessLevel: answers.awarenessLevel || null
      },
      avgDecisionDays: Number(answers.avgDecisionDays || 0) || null,
      relevantTriggers,
      triggerWeights,
      engagementSignals,
      negativeSignals,
      thresholds: { hot: 60, warm: 35, revenueReady: 75 },
      decayHalfLifeDays: 30
    };
    return {
      segment: interpreted.segment,
      profileSummary: interpreted.narrative,
      fitFactors: interpreted.fitFactors,
      importantSignals: signals,
      negativeSignals,
      intentScore: interpreted.intentScore,
      _internal: internal,
      createdAt: new Date().toISOString()
    };
  }
};
