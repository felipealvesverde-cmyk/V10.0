// V19 — Hand-off Protocol
// Quando lead transiciona pra SAL/SQL, gera "pacote de hand-off" — bundle
// completo de contexto que Sales recebe via V16.3 (ClickUp/Trello) na tarefa.
window.HandoffProtocol = {
  buildPackage(scored, campaign, blueprint) {
    if (!scored?.lead) return null;
    const lead = scored.lead;
    const history = window.ScoreHistoryEngine ? ScoreHistoryEngine.historyFor(lead, campaign?.id) : [];
    const triggers = window.BehavioralTriggers ? BehavioralTriggers.detectFor(lead, campaign?.id) : [];
    const meddic = lead.meddic || null;
    const reasons = scored.reasons || { positive: [], negative: [] };
    return {
      lead: {
        name: lead.name || null,
        email: lead.email || null,
        phone: lead.phone || null,
        company: lead.companyDomain || null,
        buyingRole: lead.buyingRole || null,
        cohort: lead.cohortMonth || null
      },
      campaign: {
        id: campaign?.id || null,
        name: campaign?.name || null,
        owner: campaign?.owner || null
      },
      scoring: {
        fit: scored.fit,
        intent: scored.intent,
        revenueScore: scored.revenueScore,
        tier: scored.tier,
        confidence: scored.confidence,
        momentum: scored.momentum,
        partial: scored.partial,
        negativesHit: scored.negativesHit
      },
      icp: {
        segment: blueprint?.segment || null,
        profileSummary: blueprint?.profileSummary || null,
        importantSignals: blueprint?.importantSignals || []
      },
      reasons: {
        positives: (reasons.positive || []).slice(0, 5),
        negatives: (reasons.negative || []).slice(0, 3)
      },
      meddic,
      lastTriggers: triggers,
      history: history.slice(-5),
      generatedAt: new Date().toISOString()
    };
  },

  toTaskPayload(pkg) {
    if (!pkg) return null;
    const tierLabel = pkg.scoring?.tier ? `Tier ${pkg.scoring.tier} · ` : '';
    const company = pkg.lead.company ? ` · ${pkg.lead.company}` : '';
    const meddicLine = pkg.meddic ? `\nMEDDIC: ${window.MeddicEngine?.completeness?.(pkg.meddic) || 0}% completo.` : '';
    const reasonsLine = pkg.reasons.positives.length
      ? `\nMotivos: ${pkg.reasons.positives.map(r => r.label).slice(0, 3).join(' · ')}`
      : '';
    return {
      title: `[${tierLabel}Revenue ${pkg.scoring.revenueScore}%] ${pkg.lead.name || pkg.lead.email}${company} — ${pkg.campaign.name || 'Campanha'}`,
      description: `Hand-off do Revenue Score Center.\nFit ${pkg.scoring.fit}% · Intent ${pkg.scoring.intent}% · Confiança ${pkg.scoring.confidence}%${pkg.scoring.momentum ? ` · Momentum ${pkg.scoring.momentum >= 0 ? '+' : ''}${pkg.scoring.momentum}` : ''}.${reasonsLine}${meddicLine}`,
      priority: pkg.scoring.tier === 'A' ? 'high' : pkg.scoring.tier === 'B' ? 'normal' : 'low',
      assignee: pkg.campaign.owner || '',
      due_date: null
    };
  }
};
