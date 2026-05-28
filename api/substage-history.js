// V35.0.0 — GET /api/substage-history?lj_visitor_id=X
// Retorna o histórico de movimentos de um visitor entre sub-stages.

const { listSubstageHistory } = require('../lib/substage-engine');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);
  const ljVisitorId = String(req.query?.lj_visitor_id || '').trim();
  const limit = Math.min(Number(req.query?.limit || 50), 200);

  if (!ljVisitorId) return res.status(400).json({ ok: false, message: 'lj_visitor_id obrigatório.' });

  try {
    const history = await listSubstageHistory(req.tenantDb, userId, ljVisitorId, limit);
    return res.status(200).json({ ok: true, history });
  } catch (err) {
    console.error('[substage-history]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
