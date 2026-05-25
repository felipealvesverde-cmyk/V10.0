// V33.0.0 — Onda 1.5: status do tracker por campanha. Privado (JWT).
// Usado pelo card de campanha (Mapa Etapa 4 + Resultados) pra mostrar:
//   "✓ Conectado · último evento há 2min"  ou  "Aguardando primeiro evento".
//
// GET /api/tracker-status?campaign_id=123
// Response: {
//   ok, connected, lastEventAt, totalVisitors,
//   byEntityType: {suspect, lead, customer}
// }
//
// connected = true se houve qualquer touchpoint vinculado à campanha.

module.exports = async function handler(req, res) {
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });

  const userId = req.user.sub;
  const campaignId = Number(req.query.campaign_id || 0);
  if (!campaignId) return res.status(400).json({ ok: false, message: 'campaign_id obrigatório.' });

  try {
    // Último evento + total visitors únicos
    const last = await req.tenantDb.query(
      `SELECT MAX(t.occurred_at) AS last_event_at,
              COUNT(DISTINCT t.lj_visitor_id) AS total_visitors
       FROM lj_visitor_touchpoints t
       WHERE t.user_id = $1 AND t.campaign_id = $2`,
      [userId, campaignId]
    );
    const lastEventAt = last.rows[0]?.last_event_at || null;
    const totalVisitors = Number(last.rows[0]?.total_visitors || 0);

    // Breakdown por entityType — JOIN com visitors
    const breakdown = await req.tenantDb.query(
      `SELECT v.entity_type, COUNT(DISTINCT v.lj_visitor_id) AS c
       FROM lj_visitors v
       INNER JOIN lj_visitor_touchpoints t
         ON t.lj_visitor_id = v.lj_visitor_id AND t.user_id = v.user_id
       WHERE v.user_id = $1 AND t.campaign_id = $2
       GROUP BY v.entity_type`,
      [userId, campaignId]
    );
    const byEntityType = { suspect: 0, lead: 0, customer: 0 };
    for (const row of breakdown.rows) byEntityType[row.entity_type] = Number(row.c);

    return res.status(200).json({
      ok: true,
      connected: totalVisitors > 0,
      lastEventAt,
      totalVisitors,
      byEntityType
    });
  } catch (err) {
    console.error('[tracker-status]', err);
    return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
  }
};
