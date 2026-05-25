// V33.0.0 — Onda 1.3: regras declarativas de promoção entre entidades.
//
// Cada regra define: a partir de qual entidade/estágio + qual evento + quais
// requisitos → promove pra qual entidade/estágio.
//
// MVP V33.0.0-alpha3: 1 regra fixa (form_submit identifica → vira lead).
// Próximas evoluções (V33.x):
//   - Regras configuráveis por produto (custom event names, requires custom)
//   - Multi-step rules (depth: alguém clicou em X + visitou Y + tempo Z)
//   - Rules engine externo (JSON config no tenant DB) pra cliente customizar sem código
//
// API:
//   const rules = listRules();   // → array de regras
//   const r = findMatching(visitor, eventType, payload);
//     → retorna a 1ª regra que matcha (ou null)

const RULES = [
  {
    id: 'form-submit-identifies-suspect-as-lead',
    description: 'Suspect que preenche form com email ou phone vira Lead em MOF Marketing',
    fromEntity: 'suspect',
    fromStage: null,                 // qualquer estágio (geralmente marketing-tof)
    trigger: {
      eventType: 'form_submit',
      requires: ['email_or_phone']   // payload precisa ter pelo menos um
    },
    toEntity: 'lead',
    toStage: 'marketing-mof',
    capturesIdentity: true            // copia email/phone/name do payload pro visitor
  },
  // V33.0.0 Onda 2 — Lead→Customer via Hotmart purchase_approved.
  // O webhook gera evento sintético 'payment_confirmed' que aciona esta regra.
  // Funciona pra suspect tb (cliente que comprou sem nunca ter sido lead — Hotmart é a 1ª aparição).
  {
    id: 'payment-confirms-customer',
    description: 'Lead (ou Suspect) que paga via Hotmart vira Customer em CS TOF',
    fromEntity: 'lead',
    fromStage: null,
    trigger: {
      eventType: 'payment_confirmed',
      requires: ['email_or_phone']
    },
    toEntity: 'customer',
    toStage: 'cs-tof',
    capturesIdentity: true
  },
  {
    id: 'payment-confirms-suspect-direct-buy',
    description: 'Suspect que compra direto (sem virar Lead antes) vira Customer',
    fromEntity: 'suspect',
    fromStage: null,
    trigger: {
      eventType: 'payment_confirmed',
      requires: ['email_or_phone']
    },
    toEntity: 'customer',
    toStage: 'cs-tof',
    capturesIdentity: true
  }
  // Próximas regras virão aqui (whatsapp_click → lead, demo_scheduled → lead, etc).
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
    // Outros requires custom podem entrar aqui depois.
  }
  return true;
}

function findMatching(visitor, eventType, payload) {
  for (const r of RULES) {
    if (visitor.entity_type !== r.fromEntity) continue;
    if (r.fromStage && visitor.current_stage !== r.fromStage) continue;
    if (r.trigger.eventType !== eventType) continue;
    if (!checkRequires(r.trigger.requires, payload)) continue;
    return r;
  }
  return null;
}

function listRules() {
  return RULES.slice();
}

module.exports = { findMatching, listRules };
