// V18 — Revenue Fit Engine
// Score de aderência do lead ao ICP definido no blueprint. Compara as
// fitRules com os atributos do lead (nome, email, tags, campos extras).
// Heurística leve — sem ML. Saída 0-100.
window.RevenueFitEngine = {
  forLead(blueprint, lead) {
    if (!blueprint?._internal?.fitRules) return { score: 50, detected: 0, possible: 5, negativesHit: 0 };
    const rules = blueprint._internal.fitRules;
    const negativeSignals = blueprint._internal.negativeSignals || [];
    const tags = this._tagSet(lead);
    let score = 50;
    let detected = 0;
    let possible = 0;
    if (rules.decisionMaker)  { possible += 1; if (this._tagsContain(tags, rules.decisionMaker)) { score += 12; detected += 1; } }
    if (rules.companySize)    { possible += 1; if (this._tagsContain(tags, rules.companySize))   { score += 10; detected += 1; } }
    if (rules.ageRange)       { possible += 1; if (this._tagsContain(tags, rules.ageRange))      { score += 8;  detected += 1; } }
    if (rules.painPoint)      { possible += 1; if (this._mentionsPain(lead, rules.painPoint))    { score += 10; detected += 1; } }
    if (rules.interest)       { possible += 1; if (this._mentionsPain(lead, rules.interest))     { score += 8;  detected += 1; } }
    // Negativos: subtraem do score sem afetar confidence positiva.
    let negativesHit = 0;
    for (const neg of negativeSignals) {
      if (this._tagsContain(tags, neg) || this._mentionsPain(lead, neg)) {
        score -= 14;
        negativesHit += 1;
      }
    }
    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      detected,
      possible,
      negativesHit
    };
  },

  _tagSet(lead) {
    const raw = Array.isArray(lead?.tags) ? lead.tags : String(lead?.tags || '').split(/[,;]/);
    return new Set(raw.map(t => String(t).toLowerCase().trim().replace(/^#/, '')));
  },

  _tagsContain(tags, value) {
    const v = String(value).toLowerCase().trim();
    if (!v) return false;
    for (const t of tags) if (t === v || t.includes(v) || v.includes(t)) return true;
    return false;
  },

  _mentionsPain(lead, value) {
    const v = String(value || '').toLowerCase();
    if (!v) return false;
    const blob = `${lead?.name || ''} ${lead?.email || ''} ${(lead?.notes || '')} ${(Array.isArray(lead?.tags) ? lead.tags.join(' ') : lead?.tags || '')}`.toLowerCase();
    return blob.includes(v.split(' ')[0]);
  }
};
