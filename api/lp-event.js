// V15 — Endpoint serverless de ingestão de eventos do pixel.
// Compatível com Vercel/Netlify functions. Sem persistência por padrão —
// guarda os últimos eventos em memória (volátil entre cold starts).
// Para persistência real, plugue Supabase/Redis nas funções `persistEvent` e
// `loadEvents`.
const RING_BUFFER_LIMIT = 1000;
const memoryBuffer = global.__JOURNEY_LP_EVENT_BUFFER__ || [];
global.__JOURNEY_LP_EVENT_BUFFER__ = memoryBuffer;

async function persistEvent(event) {
  memoryBuffer.push({ ...event, receivedAt: new Date().toISOString() });
  if (memoryBuffer.length > RING_BUFFER_LIMIT) memoryBuffer.shift();
  // TODO: encaminhar para Supabase/Redis se configurado.
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Use POST.' });
    return;
  }
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) { body = {}; }
    }
    if (!body || typeof body !== 'object' || !body.trackingId || !body.eventType) {
      res.status(400).json({ ok: false, message: 'trackingId e eventType são obrigatórios.' });
      return;
    }
    await persistEvent(body);
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, message: error?.message || 'Erro inesperado.' });
  }
};
