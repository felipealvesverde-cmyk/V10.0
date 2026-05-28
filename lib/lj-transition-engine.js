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
const { mirrorStageToRd } = require('./rd-stage-mirror');
const { getRdCredential } = require('./rd-credentials');

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

  // V34.9.4 — Ponte 2: refletir movimento LJ → RD CRM.
  // Best-effort: erros não revertem a transition já gravada. Caller pode
  // saber se deu certo via result.rdMirror.
  let rdMirror = null;
  try {
    if (campaignId) {
      // Tenta resolver token RD do user. Se não tem, mirror marca pending-stage-update.
      let token = null;
      try {
        const cred = await getRdCredential(tenantDb, userId, 'crm_pat');
        token = cred?.token || null;
      } catch (_) { token = null; }

      rdMirror = await mirrorStageToRd({
        tenantDb, userId,
        visitor: { ...visitor, current_stage: rule.toStage }, // já com novo stage
        campaignId,
        newStage: rule.toStage,
        token
      });
    }
  } catch (err) {
    console.error('[transition-engine] rd-stage-mirror falhou (não-fatal):', err.message);
    rdMirror = { ok: false, source: 'exception', note: err.message };
  }

  // V35.0.0 — Se a regra tem to_substage_id, ajusta o cache substage_id e
  // grava lj_substage_transitions. Movimento sub-stage acontece DEPOIS do macro
  // (macro vence: lead já mudou de bolinha, agora cai num sub-stage específico).
  if (rule.toSubstageId && campaignId) {
    try {
      const prevR = await tenantDb.query(
        `SELECT substage_id FROM lj_visitor_campaign_state
          WHERE user_id = $1 AND lj_visitor_id = $2 AND campaign_id = $3`,
        [userId, visitor.lj_visitor_id, campaignId]
      );
      const fromSubId = prevR.rows[0]?.substage_id ? Number(prevR.rows[0].substage_id) : null;
      await tenantDb.query(
        `UPDATE lj_visitor_campaign_state SET substage_id = $1
          WHERE user_id = $2 AND lj_visitor_id = $3 AND campaign_id = $4`,
        [rule.toSubstageId, userId, visitor.lj_visitor_id, campaignId]
      );
      if (fromSubId !== rule.toSubstageId) {
        await tenantDb.query(
          `INSERT INTO lj_substage_transitions
             (user_id, lj_visitor_id, campaign_id, parent_stage, from_substage_id, to_substage_id, source)
           VALUES ($1, $2, $3, $4, $5, $6, 'trigger-rule')`,
          [userId, visitor.lj_visitor_id, campaignId, rule.toStage, fromSubId, rule.toSubstageId]
        );
      }
    } catch (err) {
      console.error('[transition-engine] substage move falhou (não-fatal):', err.message);
    }
  }

  result.promoted = true;
  result.rule = rule;
  result.newEntityType = rule.toEntity;
  result.newStage = rule.toStage;
  result.newSubstageId = rule.toSubstageId || null;
  result.transitionId = transitionId;
  result.capturedIdentity = identity;
  result.attributedActionId = attributedActionId;
  result.attributionReason = attributionReason;
  result.rdMirror = rdMirror;
  return result;
}

module.exports = { applyEventRules };
