// V33.0.0 — Onda 1.5: lista visitors do tenant. Privado (JWT).
//
// GET /api/visitors-list
//   ?product_id=123          (opcional, filtra por produto)
//   ?campaign_id=456         (opcional, filtra por touchpoint de campanha — JOIN)
//   ?entity_type=lead        (opcional, 'suspect'|'lead'|'customer')
//   ?current_stage=...       (opcional)
//   ?limit=50&offset=0       (paginação, default 50/0)
//   ?counts_only=true        (retorna só counts agregados, sem rows)
//
// Response:
//   counts_only=true:
//     { ok, total, byEntityType: {suspect, lead, customer},
//       byStage: {marketing-tof, ..., cs-bof}, byCampaign: [{id,count}] }
//   default:
//     { ok, total, visitors: [...], hasMore }

module.exports = async function handler(req, res) {
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });

  const userId = req.user.sub;
  const productId = req.query.product_id ? Number(req.query.product_id) : null;
  const campaignId = req.query.campaign_id ? Number(req.query.campaign_id) : null;
  const entityType = req.query.entity_type || null;
  const currentStage = req.query.current_stage || null;
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const countsOnly = req.query.counts_only === 'true';

  try {
    // Build WHERE clause
    const conditions = ['v.user_id = $1'];
    const params = [userId];
    if (productId) { conditions.push(`v.product_id = $${params.length + 1}`); params.push(productId); }
    if (entityType) { conditions.push(`v.entity_type = $${params.length + 1}`); params.push(entityType); }
    if (currentStage) { conditions.push(`v.current_stage = $${params.length + 1}`); params.push(currentStage); }

    let fromClause = 'lj_visitors v';
    if (campaignId) {
      fromClause += ' INNER JOIN lj_visitor_touchpoints t ON t.lj_visitor_id = v.lj_visitor_id AND t.user_id = v.user_id';
      conditions.push(`t.campaign_id = $${params.length + 1}`);
      params.push(campaignId);
    }
    const whereSql = conditions.join(' AND ');

    if (countsOnly) {
      // Counts agregados por entityType + stage (uma query só)
      const agg = await req.tenantDb.query(
        `SELECT
           COUNT(DISTINCT v.id) AS total,
           v.entity_type, v.current_stage
         FROM ${fromClause}
         WHERE ${whereSql}
         GROUP BY v.entity_type, v.current_stage`,
        params
      );
      const byEntityType = { suspect: 0, lead: 0, customer: 0 };
      const byStage = {};
      let total = 0;
      for (const row of agg.rows) {
        const c = Number(row.total);
        byEntityType[row.entity_type] = (byEntityType[row.entity_type] || 0) + c;
        byStage[row.current_stage] = (byStage[row.current_stage] || 0) + c;
        total += c;
      }
      return res.status(200).json({ ok: true, total, byEntityType, byStage });
    }

    // Lista paginada
    const listSql = `SELECT DISTINCT
        v.id, v.lj_visitor_id, v.product_id, v.entity_type, v.current_stage,
        v.email, v.phone, v.name,
        v.first_seen_at, v.last_seen_at, v.promoted_to_lead_at, v.promoted_to_customer_at,
        v.total_value_cents,
        v.external_rd_contact_id, v.external_rd_deal_id, v.external_rd_sync_status,
        v.external_rd_sync_error
       FROM ${fromClause}
       WHERE ${whereSql}
       ORDER BY v.last_seen_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const listRes = await req.tenantDb.query(listSql, [...params, limit + 1, offset]);
    const rows = listRes.rows;
    const hasMore = rows.length > limit;
    return res.status(200).json({
      ok: true,
      visitors: rows.slice(0, limit),
      hasMore,
      offset,
      limit
    });
  } catch (err) {
    console.error('[visitors-list]', err);
    return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
  }
};
