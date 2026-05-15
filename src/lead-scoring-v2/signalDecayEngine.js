// V19 — Signal Decay Engine
// Half-life por tipo de sinal. IntentEngine consulta este módulo quando o
// blueprint não tem half-life custom. Cada tipo de sinal decai diferente.
window.SignalDecayEngine = {
  TABLE: {
    'pedir orçamento':        180,
    'visitar checkout':       150,
    'responder sdr':          120,
    'assistir aula inteira':  100,
    'responder direct':        90,
    'clicar cta':              60,
    'voltar ao site':          45,
    'scroll completo na lp':   30,
    'scroll lp':               30,
    'abrir email':             14,
    'opens email':             14
  },

  halfLifeFor(signal, fallback = 30) {
    if (!signal) return fallback;
    const norm = String(signal).toLowerCase().trim();
    return this.TABLE[norm] || fallback;
  },

  decayFactor(daysAgo, halfLife) {
    return Math.exp(-Math.max(0, Number(daysAgo || 0)) / Math.max(1, Number(halfLife || 30)));
  }
};
