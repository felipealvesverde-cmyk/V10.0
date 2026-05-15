// V19 — MEDDIC Engine
// Captura B2B: Metrics, Economic buyer, Decision criteria, Decision process,
// Identify pain, Champion, Competition (variante MEDDPICC). Não força preenchimento;
// quem preenche dá score-boost (até +12 pts no fit total).
window.MeddicEngine = {
  FIELDS: [
    { key: 'metrics',          label: 'M · Métricas / ROI esperado',    short: 'Métricas' },
    { key: 'economicBuyer',    label: 'E · Decisor econômico',           short: 'Decisor econômico' },
    { key: 'decisionCriteria', label: 'D · Critérios de decisão',        short: 'Critérios' },
    { key: 'decisionProcess',  label: 'D · Processo de decisão',         short: 'Processo' },
    { key: 'identifyPain',     label: 'I · Dor identificada',            short: 'Dor identificada' },
    { key: 'champion',         label: 'C · Champion interno',            short: 'Champion' },
    { key: 'competition',      label: 'C · Competição mapeada',          short: 'Competição' }
  ],

  emptyData() {
    const out = {};
    for (const f of this.FIELDS) out[f.key] = '';
    return out;
  },

  completeness(meddic) {
    if (!meddic) return 0;
    const filled = this.FIELDS.filter(f => String(meddic[f.key] || '').trim().length >= 5).length;
    return Math.round((filled / this.FIELDS.length) * 100);
  },

  scoreBoost(meddic) {
    return Math.round((this.completeness(meddic) / 100) * 12);
  },

  update(lead, patch) {
    if (!lead) return null;
    const current = lead.meddic || this.emptyData();
    return { ...lead, meddic: { ...current, ...patch } };
  }
};
