// V34.9.3 — Engine de regras de transição agora DINÂMICO.
// Lê de lj_transition_rules (tenant DB) em vez do array hardcoded antigo.
//
// API pública (compat com callers existentes):
//   findMatching(visitor, eventType, payload) — DEPRECATED, retorna null sempre
//   findMatchingAsync({ tenantDb, userId, campaignId, visitor, eventType, payload })
//     → retorna rule {} OR null
//   listRules({ tenantDb, userId, campaignId }) — lista rules ativas
//
// REGRAS HARDCODED LEGACY (V33.0.0 alpha3) viraram fallback opcional pra
// callers que ainda não passam (tenantDb, campaignId). Vão ser removidas
// em V34.10 quando todos callers migrarem.

const LEGACY_FALLBACK_RULES = [
  {
    id: 'form-submit-identifies-suspect-as-lead',
    description: '[LEGACY] Suspect que preenche form → Lead em MOF Marketing',
    fromEntity: 'suspect',
    fromStage: null,
    trigger: { eventType: 'form_submit', requires: ['email_or_phone'] },
    toEntity: 'lead',
    toStage: 'marketing-mof',
    capturesIdentity: true
  },
  {
    id: 'payment-confirms-customer',
    description: '[LEGACY] Lead paga → Customer CS TOF',
    fromEntity: 'lead',
    fromStage: null,
    trigger: { eventType: 'payment_confirmed', requires: ['email_or_phone'] },
    toEntity: 'customer',
    toStage: 'cs-tof',
    capturesIdentity: true
  },
  {
    id: 'payment-confirms-suspect-direct-buy',
    description: '[LEGACY] Suspect compra direto → Customer CS TOF',
    fromEntity: 'suspect',
    fromStage: null,
    trigger: { eventType: 'payment_confirmed', requires: ['email_or_phone'] },
    toEntity: 'customer',
    toStage: 'cs-tof',
    capturesIdentity: true
  }
];

function checkRequires(requires, payload) {
  if (!Array.isArray(requires) || requires.length === 0) return true;
  for (const req of requires) {
    if (req === 'email_or_phone') {
      const email = String(payload?.email || '').trim();
      const phone = String(payload?.phone || '').trim();
      if (!email && !phone) return false;
    } else if (req === 'email') {
      if (!String(payload?.email || '').trim()) return false;
    } else if (req === 'phone') {
      if (!String(payload?.phone || '').trim()) return false;
    }
  }
  return true;
}

// Match do parâmetro da rule contra o payload do evento.
// CTA/Pageview: trigger_param é URL. Match: URL do payload === trigger_param (ou contém).
// Form: trigger_param pode ser URL, ID OU nome — match contra qualquer campo do payload.
// Tag: trigger_param é tag name. Payload deve ter { tag: '...' } igualando.
// Score: trigger_value_int é valor alvo. Payload deve ter score >= alvo.
// Time: trigger_value_int é dias. Match externo via cron (não passa por findMatching).
function matchesParam(rule, payload) {
  const t = rule.trigger_type;
  const param = rule.trigger_param || '';
  const valueInt = rule.trigger_value_int || 0;

  if (t === 'cta' || t === 'pageview') {
    const url = String(payload?.url || payload?.target_url || '').toLowerCase();
    if (!url) return false;
    const target = param.toLowerCase();
    if (!target) return true; // wildcard se sem param
    return url === target || url.includes(target);
  }
  if (t === 'form') {
    if (!param) return true;
    const candidates = [
      payload?.form_id, payload?.form_name, payload?.form_url, payload?.url
    ].map(v => String(v || '').toLowerCase());
    const target = param.toLowerCase();
    return candidates.some(c => c && (c === target || c.includes(target)));
  }
  if (t === 'tag') {
    const tag = String(payload?.tag || '').toLowerCase();
    return tag && tag === param.toLowerCase();
  }
  if (t === 'payment') {
    return true; // qualquer pagamento aprovado
  }
  if (t === 'score') {
    const current = Number(payload?.score || 0);
    return current >= valueInt;
  }
  // time não passa por aqui — cron próprio
  return false;
}

// Converte rule do DB pro shape que lj-transition-engine espera.
function adaptRuleForEngine(dbRow, visitor) {
  return {
    id: `dyn-${dbRow.id}`,
    ruleId: dbRow.id,
    description: `${dbRow.trigger_type}${dbRow.trigger_param ? ' ' + dbRow.trigger_param : ''} → ${dbRow.to_stage}`,
    fromEntity: visitor.entity_type, // não filtra por entity aqui — só por stage
    fromStage: dbRow.from_stage,
    isMaster: Boolean(dbRow.is_master),
    toEntity: _resolveToEntity(dbRow.to_stage, visitor.entity_type),
    toStage: dbRow.to_stage,
    capturesIdentity: true,
    // Mantém payload pra audit:
    trigger_type: dbRow.trigger_type,
    trigger_param: dbRow.trigger_param,
    trigger_value_int: dbRow.trigger_value_int
  };
}

// Inferência: estágio → entity_type natural.
function _resolveToEntity(stage, currentEntity) {
  if (stage === 'EXIT') return currentEntity;
  if (stage && stage.startsWith('cs-')) return 'customer';
  if (stage && (stage.startsWith('vendas-') || stage === 'marketing-bof')) return 'lead';
  if (stage && stage.startsWith('marketing-')) {
    // marketing-tof permanece suspect; marketing-mof/bof viram lead
    if (stage === 'marketing-tof') return 'suspect';
    return 'lead';
  }
  return currentEntity;
}

// V34.9.3 — API nova async com DB. Aceita também eventType pra match.
async function findMatchingAsync({ tenantDb, userId, campaignId, visitor, eventType, payload }) {
  if (!tenantDb || !userId || !campaignId) return null;

  try {
    const r = await tenantDb.query(
      `SELECT * FROM lj_transition_rules
        WHERE user_id = $1 AND campaign_id = $2
          AND is_active = TRUE
          AND trigger_type = $3
          AND trigger_type <> 'time'
          AND (is_master = TRUE OR from_stage = $4)
        ORDER BY is_master DESC, id ASC`,
      [userId, campaignId, eventType, visitor.current_stage]
    );

    for (const row of r.rows) {
      if (matchesParam(row, payload)) {
        return adaptRuleForEngine(row, visitor);
      }
    }
  } catch (err) {
    console.warn('[lj-promotion-rules findMatchingAsync]', err.message);
  }
  return null;
}

// V34.9.3 — Lista rules ativas de uma campanha pra UI.
async function listRules({ tenantDb, userId, campaignId, includeInactive = false }) {
  if (!tenantDb || !userId || !campaignId) return [];
  try {
    const r = await tenantDb.query(
      `SELECT * FROM lj_transition_rules
        WHERE user_id = $1 AND campaign_id = $2
          ${includeInactive ? '' : 'AND is_active = TRUE'}
        ORDER BY is_master DESC, from_stage, id ASC`,
      [userId, campaignId]
    );
    return r.rows;
  } catch (err) {
    console.warn('[lj-promotion-rules listRules]', err.message);
    return [];
  }
}

// V34.9.3 — Compat com callers antigos (sem DB). Retorna apenas a regra
// legacy se matchar — manter pra não quebrar tracker-event.js durante a migração.
function findMatching(visitor, eventType, payload) {
  for (const r of LEGACY_FALLBACK_RULES) {
    if (visitor.entity_type !== r.fromEntity) continue;
    if (r.fromStage && visitor.current_stage !== r.fromStage) continue;
    if (r.trigger.eventType !== eventType) continue;
    if (!checkRequires(r.trigger.requires, payload)) continue;
    return r;
  }
  return null;
}

module.exports = { findMatching, findMatchingAsync, listRules, LEGACY_FALLBACK_RULES };
