// V33.0.0 — Onda 1.2: ingere evento do snippet (page_view, click, form_submit).
//
// POST /api/tracker-event  (PÚBLICO, CORS aberto)
//   Body: {
//     tracker_token: string,
//     lj_visitor_id: string,
//     event_type: 'page_view' | 'click' | 'form_submit' | string,
//     event_payload: object
//   }
//   → { ok, promoted: bool, new_entity_type, new_stage }
//
// Comportamento:
//   - Decrypt token → {tenant_id, user_id, campaign_id}
//   - Grava em lj_visitor_events
//   - Atualiza last_seen_at do visitor
//   - Delega pra lj-transition-engine pra avaliar promoção (regras em
//     lj-promotion-rules.js). Engine atualiza visitor + grava lj_transitions
//     se alguma regra matchar.

const { decrypt } = require('../lib/clickup-crypto');
const tenantPoolHelper = require('../lib/tenant-pool');
const transitionEngine = require('../lib/lj-transition-engine');
const rdLeadSync = require('../lib/lj-rd-lead-sync');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function parseTrackerToken(token) {
  try {
    const raw = decrypt(token);
    const obj = JSON.parse(raw);
    if (!obj.t || !obj.u || !obj.c) return null;
    return { tenantId: Number(obj.t), userId: Number(obj.u), campaignId: Number(obj.c) };
  } catch (_) {
    return null;
  }
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ ok: false, message: 'Body inválido.' });

  const decoded = parseTrackerToken(body.tracker_token);
  if (!decoded) return res.status(401).json({ ok: false, message: 'tracker_token inválido.' });

  const visitorId = String(body.lj_visitor_id || '').trim();
  if (!visitorId) return res.status(400).json({ ok: false, message: 'lj_visitor_id obrigatório.' });

  const eventType = String(body.event_type || '').trim();
  if (!eventType) return res.status(400).json({ ok: false, message: 'event_type obrigatório.' });

  const payload = (body.event_payload && typeof body.event_payload === 'object') ? body.event_payload : {};

  let tenantDb;
  try {
    tenantDb = await tenantPoolHelper.getTenantPool(req.db, decoded.tenantId);
  } catch (err) {
    return res.status(500).json({ ok: false, message: `Falha ao acessar tenant DB: ${err.message}` });
  }
  if (!tenantDb) tenantDb = req.db;

  try {
    // Carrega visitor (precisa pra decidir promoção)
    const visitorQuery = await tenantDb.query(
      `SELECT id, lj_visitor_id, entity_type, current_stage, email, phone, name
       FROM lj_visitors WHERE user_id = $1 AND lj_visitor_id = $2`,
      [decoded.userId, visitorId]
    );
    if (visitorQuery.rows.length === 0) {
      return res.status(404).json({ ok: false, message: 'Visitor não encontrado. Reinicialize via /api/tracker-init.' });
    }
    const visitor = visitorQuery.rows[0];

    // Grava evento cru
    await tenantDb.query(
      `INSERT INTO lj_visitor_events (lj_visitor_id, user_id, event_type, event_payload)
       VALUES ($1, $2, $3, $4)`,
      [visitorId, decoded.userId, eventType, JSON.stringify(payload)]
    );

    // Atualiza last_seen
    await tenantDb.query(
      `UPDATE lj_visitors SET last_seen_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND lj_visitor_id = $2`,
      [decoded.userId, visitorId]
    );

    // Engine de transição — aplica regras de promoção (lj-promotion-rules.js).
    // Atualiza visitor + grava lj_transitions se alguma regra matchar.
    const transition = await transitionEngine.applyEventRules({
      tenantDb,
      userId: decoded.userId,
      visitor,
      eventType,
      payload,
      source: 'tracker',
      campaignId: decoded.campaignId
    });

    // V33.0.0-alpha4 — Fire-and-forget pro RD CRM quando Suspect→Lead.
    // Não bloqueia response (UX do site do cliente não pode esperar 2-3s).
    // Resultado do sync vai pros campos external_rd_* do visitor; UI lê depois.
    if (transition.promoted && transition.newEntityType === 'lead') {
      // Recarrega visitor com identidade atualizada pra mandar dados frescos pro RD
      const refreshed = await tenantDb.query(
        `SELECT lj_visitor_id, email, phone, name, current_stage
         FROM lj_visitors WHERE user_id = $1 AND lj_visitor_id = $2`,
        [decoded.userId, visitorId]
      );
      const updatedVisitor = refreshed.rows[0];
      if (updatedVisitor) {
        // Marca como pending antes do dispatch (UI sabe que está em andamento)
        await tenantDb.query(
          `UPDATE lj_visitors SET external_rd_sync_status = 'pending'
           WHERE user_id = $1 AND lj_visitor_id = $2`,
          [decoded.userId, visitorId]
        );
        // Dispatch sem await — log se falhar, não quebra response
        rdLeadSync.createOrUpdateLead({
          controlDb: req.db,
          tenantDb,
          userId: decoded.userId,
          visitor: updatedVisitor,
          campaignId: decoded.campaignId
        }).catch(err => console.error('[tracker-event] rd-sync dispatch fail:', err.message));
      }
    }

    return res.status(200).json({
      ok: true,
      promoted: transition.promoted,
      new_entity_type: transition.newEntityType,
      new_stage: transition.newStage,
      rule_id: transition.rule?.id || null
    });
  } catch (err) {
    console.error('[tracker-event]', err);
    return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
  }
};
