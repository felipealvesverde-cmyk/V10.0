// V34.9.6 — GET /api/visitor-score-breakdown?visitor_id=X
// Retorna detalhamento ITEM POR ITEM do score de 1 visitor.
// Read-only — não recalcula nem grava nada.

const { computeR, computeF, computeV, applyHierarchy, DEFAULT_WEIGHTS } = require('../lib/score-engine');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);
  const visitorId = String(req.query?.visitor_id || '').trim();
  if (!visitorId) return res.status(400).json({ ok: false, message: 'visitor_id obrigatório.' });

  try {
    // 1) Visitor base
    const vRes = await req.tenantDb.query(
      `SELECT lj_visitor_id, name, email, phone, entity_type, current_stage,
              global_score, total_value_cents, first_seen_at, last_seen_at, updated_at
         FROM lj_visitors WHERE user_id = $1 AND lj_visitor_id = $2 LIMIT 1`,
      [userId, visitorId]
    );
    if (!vRes.rows.length) return res.status(404).json({ ok: false, message: 'Visitor não encontrado.' });
    const visitor = vRes.rows[0];

    // 2) Tags (cada uma com timestamp e source)
    let tags = [];
    try {
      const r = await req.tenantDb.query(
        `SELECT tag, source, category, created_at
           FROM lj_visitor_tags
          WHERE user_id = $1 AND lj_visitor_id = $2
          ORDER BY created_at DESC`,
        [userId, visitorId]
      );
      tags = r.rows;
    } catch (_) {}

    // 3) Touchpoints
    let touchpoints = [];
    try {
      const r = await req.tenantDb.query(
        `SELECT id, channel, source_type, source_id, occurred_at, raw_payload
           FROM lj_visitor_touchpoints
          WHERE user_id = $1 AND lj_visitor_id = $2
          ORDER BY occurred_at DESC LIMIT 50`,
        [userId, visitorId]
      );
      touchpoints = r.rows;
    } catch (_) {}

    // 4) Eventos custom
    let events = [];
    try {
      const r = await req.tenantDb.query(
        `SELECT id, event_type, occurred_at, raw_payload
           FROM lj_visitor_events
          WHERE user_id = $1 AND lj_visitor_id = $2
          ORDER BY occurred_at DESC LIMIT 50`,
        [userId, visitorId]
      );
      events = r.rows;
    } catch (_) {}

    // 5) Transitions (movimentos entre estágios)
    let transitions = [];
    try {
      const r = await req.tenantDb.query(
        `SELECT id, from_entity, to_entity, from_stage, to_stage, source, occurred_at, raw_payload
           FROM lj_transitions
          WHERE user_id = $1 AND lj_visitor_id = $2
          ORDER BY occurred_at DESC LIMIT 50`,
        [userId, visitorId]
      );
      transitions = r.rows;
    } catch (_) {}

    // 6) Score por campanha
    let campaignScores = [];
    try {
      const r = await req.tenantDb.query(
        `SELECT campaign_id, current_stage, entry_stage, score, last_movement_at
           FROM lj_visitor_campaign_state
          WHERE user_id = $1 AND lj_visitor_id = $2
          ORDER BY last_movement_at DESC NULLS LAST`,
        [userId, visitorId]
      );
      campaignScores = r.rows;
    } catch (_) {}

    // ===== Cálculo do score (espelha score-engine.js#computeScore) =====
    const NEGATIVE_TAGS = /bounced|unsubscrib|descadastr|invalid|hard-bounce|spam/i;
    const POSITIVE_TAGS = /abriu|opened|clicou|clicked|baixou|download|formul|converted|comprou/i;
    let posTagsCount = 0, negTagsCount = 0;
    const channelsSet = new Set();
    for (const t of tags) {
      const tag = String(t.tag || '');
      if (NEGATIVE_TAGS.test(tag)) negTagsCount++;
      else if (POSITIVE_TAGS.test(tag)) posTagsCount++;
      if (tag.startsWith('lj-source-')) channelsSet.add(tag.replace(/^lj-source-/, ''));
    }
    for (const tp of touchpoints) if (tp.channel) channelsSet.add(tp.channel);

    const totalTagsCount = tags.length;
    const totalEvents = totalTagsCount + touchpoints.length + events.length;

    const now = Date.now();
    const lastEventAt = Math.max(
      visitor.last_seen_at ? new Date(visitor.last_seen_at).getTime() : 0,
      touchpoints[0] ? new Date(touchpoints[0].occurred_at).getTime() : 0,
      events[0] ? new Date(events[0].occurred_at).getTime() : 0
    );
    const daysSinceLastEvent = lastEventAt ? (now - lastEventAt) / (24 * 60 * 60 * 1000) : 999;

    const signals = {
      posTagsCount, negTagsCount, totalTagsCount,
      totalEvents,
      distinctChannels: channelsSet.size,
      hasEmail: Boolean(visitor.email),
      hasPhone: Boolean(visitor.phone),
      hasName: Boolean(visitor.name)
    };

    const R = computeR(daysSinceLastEvent);
    const F = computeF(totalEvents);
    const { V, breakdown: Vbreakdown } = computeV(visitor, null, signals);

    const w = DEFAULT_WEIGHTS;
    const raw01 = R * w.pR + F * w.pF + V * w.pV;
    const clamped01 = applyHierarchy(raw01, visitor.entity_type);
    const finalScore = Math.round(clamped01 * 999);

    return res.status(200).json({
      ok: true,
      visitor: {
        lj_visitor_id: visitor.lj_visitor_id,
        name: visitor.name,
        email: visitor.email,
        phone: visitor.phone,
        entity_type: visitor.entity_type,
        current_stage: visitor.current_stage,
        first_seen_at: visitor.first_seen_at,
        last_seen_at: visitor.last_seen_at,
        global_score: visitor.global_score,
        recomputedScore: finalScore
      },
      weights: w,
      components: {
        R: { value: Number(R.toFixed(4)), weight: w.pR, contribution: Number((R * w.pR).toFixed(4)), daysSinceLastEvent: Number(daysSinceLastEvent.toFixed(2)), lambda: 0.05 },
        F: { value: Number(F.toFixed(4)), weight: w.pF, contribution: Number((F * w.pF).toFixed(4)), totalEvents, saturation: 100 },
        V: { value: Number(V.toFixed(4)), weight: w.pV, contribution: Number((V * w.pV).toFixed(4)), breakdown: Vbreakdown }
      },
      score: {
        raw01: Number(raw01.toFixed(4)),
        afterHierarchy: Number(clamped01.toFixed(4)),
        final: finalScore,
        appliedClamp: visitor.entity_type
      },
      counts: {
        tags: tags.length,
        positiveTags: posTagsCount,
        negativeTags: negTagsCount,
        touchpoints: touchpoints.length,
        events: events.length,
        transitions: transitions.length,
        distinctChannels: channelsSet.size
      },
      items: {
        tags,
        touchpoints,
        events,
        transitions
      },
      campaignScores
    });
  } catch (err) {
    console.error('[visitor-score-breakdown]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
