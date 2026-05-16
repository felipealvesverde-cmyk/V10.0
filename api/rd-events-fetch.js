// V24.0.0 — Endpoint serverless que devolve os webhook events bufferados.
//
// O frontend (RdCrmLiveSyncEngine) chama este endpoint a cada 5min com
// ?since=<ISO> e recebe os eventos recebidos após esse timestamp. Em seguida
// despacha cada um para RdCrmEventIngestor.ingest, que já sabe rotear pro
// LeadBaseBridge / ScoreBridge / OutcomeBridge.
//
// Stateless por design: lê do global ring buffer setado por /api/rd-webhook.
const memoryBuffer = global.__JOURNEY_RD_WEBHOOK_BUFFER__ || [];
global.__JOURNEY_RD_WEBHOOK_BUFFER__ = memoryBuffer;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, message: 'Use GET.' });
    return;
  }
  try {
    const since = String(req.query?.since || '').trim();
    const limit = Math.min(Number(req.query?.limit) || 200, 500);
    let events = memoryBuffer;
    if (since) {
      const sinceMs = Date.parse(since);
      if (!Number.isNaN(sinceMs)) {
        events = events.filter(e => Date.parse(e.receivedAt) > sinceMs);
      }
    }
    events = events.slice(-limit);
    res.status(200).json({ ok: true, events, total: events.length });
  } catch (error) {
    res.status(500).json({ ok: false, message: error?.message || 'Erro inesperado.' });
  }
};
