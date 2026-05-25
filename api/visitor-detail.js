// V33.0.0 — Onda 1.5: detalhe completo de 1 visitor pra montar o prontuário
// (timeline causal) no Buscador de Perfil. Privado (JWT).
//
// GET /api/visitor-detail?lj_visitor_id=abc-123
// Response: { ok, visitor, touchpoints, events, transitions }
//   - visitor: 1 row de lj_visitors
//   - touchpoints: lista cronológica de touchpoints (sources visitados)
//   - events: lista de eventos brutos (page_view, click, form_submit) — limit 100 mais recentes
//   - transitions: audit log de mudanças de entidade/estágio

module.exports = async function handler(req, res) {
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });

  const userId = req.user.sub;
  const visitorId = String(req.query.lj_visitor_id || '').trim();
  if (!visitorId) return res.status(400).json({ ok: false, message: 'lj_visitor_id obrigatório.' });

  try {
    const visitorRes = await req.tenantDb.query(
      `SELECT * FROM lj_visitors WHERE user_id = $1 AND lj_visitor_id = $2`,
      [userId, visitorId]
    );
    if (visitorRes.rows.length === 0) return res.status(404).json({ ok: false, message: 'Visitor não encontrado.' });
    const visitor = visitorRes.rows[0];

    const [tps, events, transitions] = await Promise.all([
      req.tenantDb.query(
        `SELECT id, campaign_id, source, source_type, utm_source, utm_medium, utm_campaign,
                utm_content, utm_term, referrer_url, landing_url, cost_cents, is_first, occurred_at
         FROM lj_visitor_touchpoints
         WHERE user_id = $1 AND lj_visitor_id = $2
         ORDER BY occurred_at ASC`,
        [userId, visitorId]
      ),
      req.tenantDb.query(
        `SELECT id, event_type, event_payload, occurred_at
         FROM lj_visitor_events
         WHERE user_id = $1 AND lj_visitor_id = $2
         ORDER BY occurred_at DESC
         LIMIT 100`,
        [userId, visitorId]
      ),
      req.tenantDb.query(
        `SELECT id, from_entity, to_entity, from_stage, to_stage,
                triggered_by_action_id, source, raw_payload, occurred_at
         FROM lj_transitions
         WHERE user_id = $1 AND lj_visitor_id = $2
         ORDER BY occurred_at ASC`,
        [userId, visitorId]
      )
    ]);

    return res.status(200).json({
      ok: true,
      visitor,
      touchpoints: tps.rows,
      events: events.rows,
      transitions: transitions.rows
    });
  } catch (err) {
    console.error('[visitor-detail]', err);
    return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
  }
};
