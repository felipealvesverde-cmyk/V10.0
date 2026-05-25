// V33.0.0 — Onda 1.3: engine de transição. Aplica regras declarativas
// de lj-promotion-rules.js, atualiza visitor, grava lj_transitions.
//
// API:
//   const result = await applyEventRules({
//     tenantDb, userId, visitor, eventType, payload, source, campaignId
//   });
//   → { promoted: bool, rule: {...}|null, newEntityType, newStage, transitionId|null }
//
// Não chama integrações externas (RD CRM, Hotmart) — isso é responsabilidade
// do CALLER (tracker-event.js, hotmart-webhook.js etc) depois que o engine
// confirma a promoção. Engine só lida com state local + audit log.

const promotionRules = require('./lj-promotion-rules');
const attributionEngine = require('./lj-attribution-engine');

async function applyEventRules({ tenantDb, userId, visitor, eventType, payload, source = 'tracker', campaignId = null, rawPayloadExtras = {} }) {
  // Estado base — sem mudança
  const result = {
    promoted: false,
    rule: null,
    newEntityType: visitor.entity_type,
    newStage: visitor.current_stage,
    transitionId: null,
    capturedIdentity: null
  };

  const rule = promotionRules.findMatching(visitor, eventType, payload);
  if (!rule) return result;

  // Identidade (email/phone/name) — coleta do payload se a regra pede
  let identity = null;
  if (rule.capturesIdentity) {
    identity = {
      email: String(payload?.email || '').trim() || visitor.email || null,
      phone: String(payload?.phone || '').trim() || visitor.phone || null,
      name:  String(payload?.name  || '').trim() || visitor.name  || null
    };
  }

  // Promove no visitor — UPDATE atômico
  const updateFields = [
    `entity_type = $3`,
    `current_stage = $4`,
    `updated_at = NOW()`
  ];
  const updateValues = [userId, visitor.lj_visitor_id, rule.toEntity, rule.toStage];

  // Timestamp de promoção (lead ou customer)
  if (rule.toEntity === 'lead') {
    updateFields.push(`promoted_to_lead_at = COALESCE(promoted_to_lead_at, NOW())`);
  } else if (rule.toEntity === 'customer') {
    updateFields.push(`promoted_to_customer_at = COALESCE(promoted_to_customer_at, NOW())`);
  }

  if (identity) {
    updateFields.push(`email = COALESCE($${updateValues.length + 1}, email)`);
    updateValues.push(identity.email);
    updateFields.push(`phone = COALESCE($${updateValues.length + 1}, phone)`);
    updateValues.push(identity.phone);
    updateFields.push(`name = COALESCE($${updateValues.length + 1}, name)`);
    updateValues.push(identity.name);
  }

  await tenantDb.query(
    `UPDATE lj_visitors SET ${updateFields.join(', ')}
     WHERE user_id = $1 AND lj_visitor_id = $2`,
    updateValues
  );

  // Audit log da transição
  const rawPayload = {
    rule_id: rule.id,
    event_type: eventType,
    event_payload: payload,
    campaign_id: campaignId,
    ...rawPayloadExtras
  };

  const ins = await tenantDb.query(
    `INSERT INTO lj_transitions
       (lj_visitor_id, user_id, from_entity, to_entity, from_stage, to_stage,
        triggered_by_action_id, source, raw_payload)
     VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, $8)
     RETURNING id, occurred_at`,
    [
      visitor.lj_visitor_id, userId,
      visitor.entity_type, rule.toEntity,
      visitor.current_stage, rule.toStage,
      source, JSON.stringify(rawPayload)
    ]
  );

  const transitionId = ins.rows[0]?.id || null;
  const occurredAt = ins.rows[0]?.occurred_at || new Date().toISOString();

  // V33.0.0 Onda 3 — Atribuição causal: tenta achar action ClickUp que
  // provavelmente moveu o lead (janela 48h). Best-effort: erros não revertem
  // a transition já gravada.
  let attributedActionId = null;
  let attributionReason = null;
  try {
    const attr = await attributionEngine.attributeTransition({
      tenantDb, userId,
      visitorId: visitor.lj_visitor_id,
      toStage: rule.toStage,
      occurredAt
    });
    attributedActionId = attr.actionId;
    attributionReason = attr.reason;
    if (attributedActionId && transitionId) {
      await tenantDb.query(
        `UPDATE lj_transitions SET triggered_by_action_id = $1 WHERE id = $2`,
        [attributedActionId, transitionId]
      );
    }
  } catch (err) {
    console.error('[transition-engine] attribution falhou (não-fatal):', err.message);
  }

  result.promoted = true;
  result.rule = rule;
  result.newEntityType = rule.toEntity;
  result.newStage = rule.toStage;
  result.transitionId = transitionId;
  result.capturedIdentity = identity;
  result.attributedActionId = attributedActionId;
  result.attributionReason = attributionReason;
  return result;
}

module.exports = { applyEventRules };
