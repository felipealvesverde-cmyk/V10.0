// V15 — Endpoint serverless de leitura dos eventos coletados.
// O Journey faz polling (a cada 5min) e busca tudo a partir de `since`.
// Os eventos são lidos da mesma memória usada por /api/lp-event.

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
    const buffer = global.__JOURNEY_LP_EVENT_BUFFER__ || [];
    const since = req.query?.since || (req.url?.includes('since=') ? decodeURIComponent(req.url.split('since=')[1] || '') : '');
    let filtered = buffer;
    if (since) {
      const sinceMs = Date.parse(since);
      if (!Number.isNaN(sinceMs)) {
        filtered = buffer.filter(event => Date.parse(event.receivedAt || event.timestamp || '') > sinceMs);
      }
    }
    res.status(200).json({ ok: true, events: filtered, total: filtered.length, fetchedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ ok: false, message: error?.message || 'Erro inesperado.' });
  }
};
