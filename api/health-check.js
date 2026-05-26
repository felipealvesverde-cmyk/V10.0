// V34.0.0 — V34.6.u: Health check minimalista.
// Diagnostica timeout Railway sem dependências (não usa DB, não chama RD).
// Felipe acessa direto via browser: https://leadjourney.up.railway.app/api/health-check
// Se demora >5s pra responder = problema infra Railway.

module.exports = async function handler(req, res) {
  res.status(200).json({
    ok: true,
    ts: new Date().toISOString(),
    node_version: process.version,
    uptime_s: Math.round(process.uptime()),
    memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
  });
};
