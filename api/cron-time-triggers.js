// V34.9.3 — Cron diário de triggers de tipo Tempo.
//
// POST /api/cron-time-triggers
// Auth: master JWT OR X-Cron-Token
// Body: { only_user_id?, dry_run? }
//
// Cadência alvo: 1x/dia (junto com cron-daily-tick) OR a cada hora se quiser
// reação rápida.
//
// Processo:
//   1. Pra cada user aprovado:
//      a. Pra cada campanha do user com triggers ativos de tipo 'time':
//         i. Lista visitors do lj_visitor_campaign_state daquela campanha
//         ii. Pra cada visitor: calcula diasInativo = (NOW() - last_seen_at) / 1 dia
//         iii. Pra cada trigger 'time' da campanha:
//              - Se diasInativo >= trigger.trigger_value_int E visitor está em
//                trigger.from_stage (ou is_master), aplica transição.

const tenantPoolHelper = require('../lib/tenant-pool');

function authorize(req) {
  if (req.user?.isMaster) return { ok: true, source: 'master' };
  const cronToken = process.env.CRON_RECONCILE_TOKEN;
  if (cronToken) {
    const provided = req.headers['x-cron-token'] || req.query?.cron_token;
    if (provided && String(provided) === cronToken) return { ok: true, source: 'cron-token' };
  }
  return { ok: false };
}

async function resolveTenantDb(controlPlaneDb, userId) {
  try {
    const userRow = await controlPlaneDb.query(
      'SELECT default_tenant_id FROM users WHERE id = $1',
      [userId]
    );
    if (!userRow.rows.length) return null;
    const tenantId = userRow.rows[0].default_tenant_id;
    if (!tenantId) return controlPlaneDb;
    const pool = await tenantPoolHelper.getTenantPool(controlPlaneDb, tenantId);
    return pool || controlPlaneDb;
  } catch (err) {
    console.error('[cron-time-triggers] resolve tenant err:', err.message);
    return null;
  }
}

// Aplica uma rule de Tempo ao visitor. UPDATE atômico + log em lj_transitions.
async function applyTimeRule(tenantDb, userId, visitor, rule) {
  const toStage = rule.to_stage;
  const fromStage = visitor.current_stage;

  if (toStage === 'EXIT') {
    // Sai da campanha — remove campaign_state, preserva lj_visitors
    await tenantDb.query(
      `DELETE FROM lj_visitor_campaign_state
        WHERE user_id = $1 AND lj_visitor_id = $2 AND campaign_id = $3`,
      [userId, visitor.lj_visitor_id, rule.campaign_id]
    );
  } else {
    // Move visitor
    await tenantDb.query(
      `UPDATE lj_visitors SET current_stage = $3, updated_at = NOW()
        WHERE user_id = $1 AND lj_visitor_id = $2`,
      [userId, visitor.lj_visitor_id, toStage]
    );
    // Também atualiza campaign_state da campanha alvo
    await tenantDb.query(
      `UPDATE lj_visitor_campaign_state SET current_stage = $4, updated_at = NOW()
        WHERE user_id = $1 AND lj_visitor_id = $2 AND campaign_id = $3`,
      [userId, visitor.lj_visitor_id, rule.campaign_id, toStage]
    );
  }

  // Audit
  await tenantDb.query(
    `INSERT INTO lj_transitions
       (lj_visitor_id, user_id, from_entity, to_entity, from_stage, to_stage,
        source, raw_payload, triggered_by_rule_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      visitor.lj_visitor_id, userId,
      visitor.entity_type, visitor.entity_type, // entity não muda em time-trigger
      fromStage, toStage,
      'cron-time-trigger',
      JSON.stringify({ rule_id: rule.id, days_param: rule.trigger_value_int, campaign_id: rule.campaign_id }),
      rule.id
    ]
  );
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  const auth = authorize(req);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Não autorizado.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  const onlyUserId = body.only_user_id ? Number(body.only_user_id) : null;
  const dryRun = Boolean(body.dry_run);

  let userIds = [];
  try {
    if (onlyUserId > 0) {
      userIds = [onlyUserId];
    } else {
      const r = await req.db.query('SELECT id FROM users WHERE is_approved = true ORDER BY id');
      userIds = r.rows.map(row => row.id);
    }
  } catch (err) {
    return res.status(500).json({ ok: false, message: `list users: ${err.message}` });
  }

  const startedAt = Date.now();
  let usersProcessed = 0, rulesEvaluated = 0, visitorsMoved = 0, visitorsExited = 0;
  const errors = [];

  for (const uid of userIds) {
    const tenantDb = await resolveTenantDb(req.db, uid);
    if (!tenantDb) continue;

    try {
      // Triggers ativas de Tempo do user, agrupadas por campanha
      const rulesQ = await tenantDb.query(
        `SELECT * FROM lj_transition_rules
          WHERE user_id = $1 AND trigger_type = 'time' AND is_active = TRUE
          ORDER BY campaign_id, id`,
        [uid]
      );
      if (!rulesQ.rows.length) continue;
      usersProcessed++;

      for (const rule of rulesQ.rows) {
        rulesEvaluated++;
        const days = Number(rule.trigger_value_int || 0);
        if (days <= 0) continue;

        // Lista visitors da campanha com last_seen_at antigo o suficiente
        const visitorsQ = await tenantDb.query(
          `SELECT v.lj_visitor_id, v.entity_type, v.current_stage, v.last_seen_at
             FROM lj_visitor_campaign_state vcs
             INNER JOIN lj_visitors v
               ON v.user_id = vcs.user_id AND v.lj_visitor_id = vcs.lj_visitor_id
            WHERE vcs.user_id = $1 AND vcs.campaign_id = $2
              AND v.last_seen_at IS NOT NULL
              AND v.last_seen_at < NOW() - ($3 || ' days')::interval
              AND ($4::text IS NULL OR v.current_stage = $4)`,
          [uid, rule.campaign_id, days, rule.is_master ? null : rule.from_stage]
        );

        for (const v of visitorsQ.rows) {
          if (dryRun) continue;
          try {
            await applyTimeRule(tenantDb, uid, v, rule);
            if (rule.to_stage === 'EXIT') visitorsExited++;
            else visitorsMoved++;
          } catch (err) {
            errors.push({ userId: uid, ruleId: rule.id, visitor: v.lj_visitor_id, error: err.message });
          }
        }
      }
    } catch (err) {
      errors.push({ userId: uid, error: err.message });
    }
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`[cron-time-triggers] users=${usersProcessed} rules=${rulesEvaluated} moved=${visitorsMoved} exited=${visitorsExited} ${elapsedMs}ms`);

  return res.status(200).json({
    ok: true, dryRun, usersProcessed, rulesEvaluated, visitorsMoved, visitorsExited,
    elapsedMs, triggeredBy: auth.source, errors: errors.slice(0, 20)
  });
};
