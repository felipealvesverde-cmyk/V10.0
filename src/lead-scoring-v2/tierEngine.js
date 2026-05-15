// V19 — Tier Engine (A/B/C/D)
// Substitui hot/warm/cold. Vendas pensa em letras, não em %. Thresholds
// dinâmicos por percentil quando há >=10 leads; senão fallback fixo com floor.
window.TierEngine = {
  TIERS: ['A', 'B', 'C', 'D'],

  TIER_DEFS: {
    A: { label: 'Tier A · Pipeline imediato', tone: 'emerald', dot: 'bg-emerald-500', sla: 'Contato em 4h' },
    B: { label: 'Tier B · Nurture acelerado', tone: 'sky', dot: 'bg-sky-500', sla: 'Contato em 48h' },
    C: { label: 'Tier C · Nurture lento', tone: 'amber', dot: 'bg-amber-500', sla: 'Drip mensal' },
    D: { label: 'Tier D · Dormente', tone: 'slate', dot: 'bg-slate-500', sla: 'Re-engagement trimestral' }
  },

  // Floor absoluto: A≥60, B≥45, C≥25. Threshold dinâmico só pode SUBIR esses pisos.
  FLOOR: { A: 60, B: 45, C: 25 },

  // V20 — multipliers por awareness level. Lead cold precisa SCORE MAIOR pra ser
  // tier alto (não está pronto pra compra). Lead em decision pode ser tier alto
  // com score mais baixo (já está no momento).
  AWARENESS_MULTIPLIERS: {
    cold:       1.25,
    aware:      1.10,
    evaluation: 1.00,
    decision:   0.85
  },

  thresholdsFor(scores, awareness) {
    let base;
    if (!Array.isArray(scores) || scores.length < 10) {
      base = { A: this.FLOOR.A, B: this.FLOOR.B, C: this.FLOOR.C, source: 'fallback' };
    } else {
      const sorted = scores.slice().sort((a, b) => a - b);
      base = {
        C: Math.max(this.FLOOR.C, this._percentile(sorted, 25)),
        B: Math.max(this.FLOOR.B, this._percentile(sorted, 60)),
        A: Math.max(this.FLOOR.A, this._percentile(sorted, 85)),
        source: 'dynamic'
      };
    }
    const mult = this.AWARENESS_MULTIPLIERS[awareness] || 1.0;
    if (mult === 1.0) return base;
    return {
      A: Math.round(base.A * mult),
      B: Math.round(base.B * mult),
      C: Math.round(base.C * mult),
      source: base.source,
      awareness,
      awarenessMultiplier: mult
    };
  },

  tierFor(score, thresholds) {
    const s = Number(score || 0);
    if (s >= thresholds.A) return 'A';
    if (s >= thresholds.B) return 'B';
    if (s >= thresholds.C) return 'C';
    return 'D';
  },

  meta(tier) {
    return this.TIER_DEFS[tier] || this.TIER_DEFS.D;
  },

  _percentile(sorted, p) {
    if (!sorted.length) return 0;
    const rank = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(rank);
    const hi = Math.ceil(rank);
    if (lo === hi) return Math.round(sorted[lo]);
    return Math.round(sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo));
  }
};
