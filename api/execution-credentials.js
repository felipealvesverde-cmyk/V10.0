// V32.0.15 — GET /api/execution-credentials
// Lista todos os providers conectados pelo user (tenant plane).
// NÃO decripta fields — só retorna display_meta + status. Seguro pra hidratar
// UI sem expor secrets.
//
// Retorno: { ok, providers: [{ providerId, displayMeta, status, lastTestedAt, ... }] }
const { listConnected } = require('../lib/execution-credentials');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  try {
    const providers = await listConnected(req.tenantDb, req.user.sub);
    return res.status(200).json({ ok: true, providers });
  } catch (err) {
    console.error('[execution-credentials]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
