// V33.0.0-alpha18 — Onda 3.5: breakdown por LP de uma campanha. Privado (JWT).
//
// Caminho C cravado por Felipe: 1 snippet pra N LPs. O LJ agrupa visitors
// automaticamente pelo `landing_url` capturado em cada touchpoint.
//
// GET /api/campaign-lp-breakdown?campaign_id=123
// Response:
//   { ok, campaign_id, total_visitors, total_leads, total_customers,
//     lps: [
//       { landing_url, visitors, leads, customers, last_visit_at }, ...
//     ] }
//
// Normalização: remove query string (?...) e fragment (#...) do landing_url
// pra evitar fragmentar a mesma LP por UTMs diferentes.

module.exports = async function handler(req, res) {
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });

  const userId = req.user.sub;
  const campaignId = Number(req.query.campaign_id || 0);
  if (!campaignId) return res.status(400).json({ ok: false, message: 'campaign_id obrigatório.' });

  try {
    // Agrega visitors únicos por landing_url normalizado (sem query/fragment).
    // entity_type permite contar leads/customers separadamente do total.
    const result = await req.tenantDb.query(
      `WITH normalized AS (
        SELECT
          v.lj_visitor_id,
          v.entity_type,
          SUBSTRING(t.landing_url FROM '^([^?#]+)') AS lp_url,
          t.occurred_at
        FROM lj_visitor_touchpoints t
        INNER JOIN lj_visitors v ON v.user_id = t.user_id AND v.lj_visitor_id = t.lj_visitor_id
        WHERE t.user_id = $1 AND t.campaign_id = $2 AND t.landing_url IS NOT NULL
      )
      SELECT
        COALESCE(lp_url, '(direto)') AS landing_url,
        COUNT(DISTINCT lj_visitor_id) AS visitors,
        COUNT(DISTINCT CASE WHEN entity_type = 'lead' THEN lj_visitor_id END) AS leads,
        COUNT(DISTINCT CASE WHEN entity_type = 'customer' THEN lj_visitor_id END) AS customers,
        MAX(occurred_at) AS last_visit_at
      FROM normalized
      GROUP BY lp_url
      ORDER BY visitors DESC
      LIMIT 50`,
      [userId, campaignId]
    );

    const lps = result.rows.map(r => ({
      landing_url: r.landing_url,
      visitors: Number(r.visitors),
      leads: Number(r.leads),
      customers: Number(r.customers),
      last_visit_at: r.last_visit_at
    }));

    const totals = lps.reduce((acc, lp) => ({
      visitors: acc.visitors + lp.visitors,
      leads: acc.leads + lp.leads,
      customers: acc.customers + lp.customers
    }), { visitors: 0, leads: 0, customers: 0 });

    return res.status(200).json({
      ok: true,
      campaign_id: campaignId,
      total_visitors: totals.visitors,
      total_leads: totals.leads,
      total_customers: totals.customers,
      lp_count: lps.length,
      lps
    });
  } catch (err) {
    console.error('[campaign-lp-breakdown]', err);
    return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
  }
};
