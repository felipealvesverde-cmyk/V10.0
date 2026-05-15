// V16.4 — Railway Connection Tester
// Roda 5 sondagens seguidas no provider e calcula estabilidade. Cada rodada
// fica acessível para a UI mostrar individualmente. Estabilidade = % de sucesso.
window.RailwayConnectionTester = {
  ROUNDS: 5,

  async run(cfg, onRound) {
    const results = [];
    for (let i = 0; i < this.ROUNDS; i += 1) {
      const round = i + 1;
      const result = await RailwayDatabaseProvider.probe(cfg);
      const record = { round, ok: Boolean(result.ok), latencyMs: Math.max(0, Number(result.latencyMs || 0)), message: result.message || '' };
      results.push(record);
      if (typeof onRound === 'function') onRound(record, results.slice());
      await this._sleep(80);
    }
    return { results, ...this.summarize(results) };
  },

  summarize(results) {
    const total = results.length;
    if (!total) return { stability: 0, status: 'unknown', avgLatencyMs: 0, message: 'Nenhum teste rodado.' };
    const success = results.filter(r => r.ok).length;
    const stability = Math.round((success / total) * 100);
    const avgLatencyMs = Math.round(results.reduce((sum, r) => sum + r.latencyMs, 0) / total);
    let status, message;
    if (stability === 100) { status = 'stable'; message = 'Conexão estável.'; }
    else if (stability >= 60) { status = 'unstable'; message = 'Conexão instável. Verifique credenciais, rede, SSL ou limites do Railway.'; }
    else if (stability > 0) { status = 'critical'; message = 'Conexão crítica. Configuração não confiável — revise URL/credenciais.'; }
    else { status = 'failed'; message = 'Todos os testes falharam. Confira a DATABASE_URL e o proxy HTTPS.'; }
    return { stability, status, avgLatencyMs, message };
  },

  _sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
};
