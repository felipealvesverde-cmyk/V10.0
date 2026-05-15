// V19 — Cold Start Engine
// Lead novo, sem evidência. Em vez de mostrar baseline-50 mentiroso, retorna
// prior por segmento (média histórica). Score migra do prior pra evidência
// conforme dados aparecem.
window.ColdStartEngine = {
  PRIORS: {
    B2B:   { fit: 28, intent: 12 },
    B2C:   { fit: 32, intent: 18 },
    Ambos: { fit: 30, intent: 15 }
  },

  // alpha controla quão rápido a evidência domina o prior.
  // Com 5+ sinais detectados, prior pesa <10%.
  ALPHA: 4,

  apply(scored, blueprint) {
    if (!scored) return scored;
    const segment = blueprint?.segment || 'B2B';
    const prior = this.PRIORS[segment] || this.PRIORS.Ambos;
    const detected = (scored.fitReasons?.length || 0) + (scored.intentReasons?.length || 0);
    if (detected >= this.ALPHA * 2) return scored; // evidência suficiente
    const lambda = Math.max(0, 1 - detected / (this.ALPHA * 2));
    return {
      ...scored,
      fit: Math.round(scored.fit * (1 - lambda) + prior.fit * lambda),
      intent: Math.round(scored.intent * (1 - lambda) + prior.intent * lambda),
      coldStart: true,
      priorWeight: Math.round(lambda * 100)
    };
  }
};
