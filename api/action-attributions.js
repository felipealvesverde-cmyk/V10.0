// V33.0.0 — Onda 3: lê métricas de atribuição agregadas por action.
//
// GET /api/action-attributions
//   ?since_days=30        (opcional, default 30)
//   ?action_id=123        (opcional — retorna só desta action)
//
// Response:
//   { ok, sinceDays, attributions: [
//       { actionId, transitions, leads, customers, lastAttributedAt }
//   ]}

const attributionEngine = require('../lib/lj-attribution-engine');

module.exports = async function handler(req, res) {
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });

  const userId = req.user.sub;
  const sinceDays = Math.max(1, Math.min(365, Number(req.query.since_days) || 30));
  const actionIdFilter = req.query.action_id ? Number(req.query.action_id) : null;

  try {
    const map = await attributionEngine.aggregateAttributionsByAction(req.tenantDb, userId, sinceDays);
    let list = Array.from(map.values());
    if (actionIdFilter) list = list.filter(b => b.actionId === actionIdFilter);

    // Enriquece com lastAttributedAt
    if (list.length > 0) {
      const actionIds = list.map(b => b.actionId);
      const sinceTimestamp = new Date(Date.now() - sinceDays * 86400000).toISOString();
      const lastQuery = await req.tenantDb.query(
        `SELECT triggered_by_action_id AS action_id, MAX(occurred_at) AS last_at
         FROM lj_transitions
         WHERE user_id = $1 AND triggered_by_action_id = ANY($2::int[])
           AND occurred_at >= $3
         GROUP BY triggered_by_action_id`,
        [userId, actionIds, sinceTimestamp]
      );
      const lastMap = new Map(lastQuery.rows.map(r => [Number(r.action_id), r.last_at]));
      list = list.map(b => ({ ...b, lastAttributedAt: lastMap.get(b.actionId) || null }));
    }

    list.sort((a, b) => (b.customers - a.customers) || (b.transitions - a.transitions));

    return res.status(200).json({ ok: true, sinceDays, attributions: list });
  } catch (err) {
    console.error('[action-attributions]', err);
    return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
  }
};
