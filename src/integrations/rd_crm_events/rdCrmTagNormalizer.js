// V21 — RD CRM Tag Normalizer
// Normaliza tags vindas do RD em formato canônico (lowercase, snake_case,
// sem acentos, sem #). Mapeia também tags conhecidas para sinais do Revenue
// Score (mkttof → marketing-tof etc).
window.RdCrmTagNormalizer = {
  CANONICAL_MAP: {
    'mkttof': 'marketing_tof',
    'mktmof': 'marketing_mof',
    'mktbof': 'marketing_bof',
    'vndtof': 'vendas_tof',
    'vndmof': 'vendas_mof',
    'vndbof': 'vendas_bof',
    'checkout_visitado': 'visitar_checkout',
    'checkout': 'visitar_checkout',
    'respondeu_sdr': 'responder_sdr',
    'sdr_response': 'responder_sdr',
    'email_bof_aberto': 'email_bof_aberto',
    'email_aberto': 'abrir_email',
    'email_open': 'abrir_email',
    'cliente_ganho': 'cliente_ganho',
    'cliente_perdido': 'cliente_perdido',
    'deal_won': 'cliente_ganho',
    'deal_lost': 'cliente_perdido'
  },

  normalize(raw) {
    const t = String(raw || '').trim().toLowerCase().replace(/^#/, '');
    if (!t) return null;
    const noAccent = t.normalize('NFD').replace(/[̀-ͯ]/g, '');
    const snake = noAccent.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return this.CANONICAL_MAP[snake] || snake;
  },

  normalizeAll(list) {
    if (!Array.isArray(list)) return [];
    return list.map(t => this.normalize(t)).filter(Boolean);
  },

  isStageTag(tag) {
    return /^(marketing|vendas|cs)_(tof|mof|bof|onboarding|retencao|expansao)$/.test(String(tag || ''));
  },

  isOutcomeTag(tag) {
    return tag === 'cliente_ganho' || tag === 'cliente_perdido';
  },

  stageFor(tag) {
    if (!this.isStageTag(tag)) return null;
    return tag.replace(/^(marketing|vendas|cs)_/, m => ({
      'marketing_': 'mkt_',
      'vendas_': 'vnd_',
      'cs_': 'cs_'
    }[m] || m));
  }
};
