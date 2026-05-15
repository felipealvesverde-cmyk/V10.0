// V19 — Intent Engine (predictive)
// O que o lead está fazendo agora. Usa engagementHistory (timestamp por sinal)
// quando existe; cai para tags do lead com decay sobre createdAt como fallback.
// Half-life por tipo de sinal (form-fill > demo > pageview).
window.IntentEngine = {
  // Half-life (dias) baseado no tipo de sinal. Override pelo blueprint quando necessário.
  DEFAULT_HALF_LIVES: {
    explicit: 90,   // pediu orçamento, demo, SDR — sinais fortes duram mais
    implicit: 30,   // abriu email, scroll, voltou — decaem rápido
    form: 60,       // form fill — meio termo
    purchase: 180   // checkout abandonado, intent de compra real
  },

  forLead(blueprint, lead, campaignId) {
    if (!blueprint?._internal?.engagementSignals) return { score: 0, detected: 0, possible: 0, momentum: 0, reasons: [] };
    const signals = blueprint._internal.engagementSignals;
    const segmentHalfLife = this._segmentHalfLife(blueprint.segment);
    const history = this._historyFor(lead, campaignId);
    const tags = this._tagSet(lead);
    let score = 0;
    let detected = 0;
    let possible = 0;
    const reasons = [];
    for (const [signalLabel, meta] of Object.entries(signals)) {
      possible += 1;
      const weight = typeof meta === 'object' ? Number(meta.weight || 0) : Number(meta || 0);
      const isExplicit = typeof meta === 'object' ? (meta.type === 'explicit') : (window.IcpConversationFlow?.isExplicit?.(signalLabel));
      const halfLife = (typeof meta === 'object' && meta.halfLife) || this.DEFAULT_HALF_LIVES[isExplicit ? 'explicit' : 'implicit'] || segmentHalfLife;
      const tagAliases = (typeof meta === 'object' && Array.isArray(meta.tagAliases)) ? meta.tagAliases : [signalLabel];
      // 1. Tenta engagementHistory (preferido — tem timestamp)
      const matchedFromHistory = history.find(h => tagAliases.some(a => this._normalize(a) === this._normalize(h.signal)));
      if (matchedFromHistory) {
        const days = (Date.now() - new Date(matchedFromHistory.ts).getTime()) / (24 * 3600 * 1000);
        const factor = Math.exp(-Math.max(0, days) / halfLife);
        const points = weight * factor;
        score += points;
        detected += 1;
        reasons.push({ type: 'engagement', label: `${signalLabel} (há ${Math.round(days)}d)`, points: Math.round(points) });
        continue;
      }
      // 2. Fallback: tags do lead (sem timestamp) — decay sobre lead.createdAt
      if (this._tagsMatchAny(tags, tagAliases)) {
        const days = lead?.createdAt ? (Date.now() - new Date(lead.createdAt).getTime()) / (24 * 3600 * 1000) : 0;
        const factor = Math.exp(-Math.max(0, days) / halfLife);
        const points = weight * factor;
        score += points;
        detected += 1;
        reasons.push({ type: 'engagement', label: `${signalLabel} (data_quality_decay)`, points: Math.round(points) });
      }
    }
    // V20 — soma trigger events configurados no blueprint
    if (window.TriggerEventEngine) {
      const trig = TriggerEventEngine.scoreFor(blueprint, lead);
      score += trig.score * 0.6; // triggers somam até 60% do peso bruto (já saturados)
      detected += trig.detected;
      possible += trig.possible;
      for (const c of (trig.contributions || [])) {
        reasons.push({ type: 'engagement', label: `Trigger: ${c.event} (há ${c.daysAgo}d)`, points: c.points });
      }
    }
    const momentum = window.ScoreHistoryEngine ? ScoreHistoryEngine.momentumFor(lead, campaignId) : 0;
    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      detected,
      possible,
      momentum,
      reasons
    };
  },

  _segmentHalfLife(segment) {
    if (segment === 'B2B') return 90;
    if (segment === 'B2C') return 21;
    return 45;
  },

  _historyFor(lead, campaignId) {
    if (Array.isArray(lead?.engagementHistory)) return lead.engagementHistory;
    const key = this._leadKey(lead);
    return (App.state.leadEngagementHistory?.[key]) || [];
  },

  _leadKey(lead) {
    return String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
  },

  _tagSet(lead) {
    const raw = Array.isArray(lead?.tags) ? lead.tags : String(lead?.tags || '').split(/[,;]/);
    return new Set(raw.map(t => this._normalize(t)).filter(Boolean));
  },

  _normalize(s) {
    return String(s || '').toLowerCase().trim().replace(/^#/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_-]/g, ' ');
  },

  _tagsMatchAny(tags, aliases) {
    for (const a of aliases) {
      const n = this._normalize(a);
      if (!n) continue;
      if (tags.has(n)) return true;
      for (const t of tags) {
        if (n.length >= 3 && t.length >= 3 && (t === n || t.includes(n) || n.includes(t))) return true;
      }
    }
    return false;
  }
};
