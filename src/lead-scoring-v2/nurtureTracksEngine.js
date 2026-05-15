// V19 — Nurture Tracks Engine
// Track config por tier. Define cadência de email/SDR/drip que o lead deveria
// receber. Roadmap: integração direta com RD/Apollo/etc — hoje só define plano.
window.NurtureTracksEngine = {
  TRACKS: {
    A: { label: 'Pipeline imediato',  cadence: 'SDR liga em 4h · 3 emails personalizados em 5 dias',     channels: ['sdr', 'email'], frequency: 'high' },
    B: { label: 'Nurture acelerado',  cadence: 'Sequência de 8 emails em 60 dias · 1 ligação após dia 14', channels: ['email', 'sdr'], frequency: 'medium' },
    C: { label: 'Nurture lento',      cadence: 'Drip mensal · webinar trimestral',                       channels: ['email', 'webinar'], frequency: 'low' },
    D: { label: 'Re-engagement',      cadence: 'Re-ativação trimestral · só se sinal forte',             channels: ['email'], frequency: 'rare' }
  },

  trackFor(tier) {
    return this.TRACKS[tier] || this.TRACKS.D;
  },

  recommendationFor(scored) {
    const track = this.trackFor(scored?.tier);
    return {
      ...track,
      reasoning: `${scored?.tier || 'D'}: ${track.cadence}.`
    };
  }
};
