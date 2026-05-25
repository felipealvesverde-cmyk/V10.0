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
//   - Se event_type indica promoção (form_submit com email/phone) E visitor
//     ainda é 'suspect' em 'marketing-tof' → promove pra 'lead' em 'marketing-mof'
//     + grava transition + atualiza visitor (entity_type, email/phone/name se vier)
//   - Engine de promoção formal vem em Onda 1.3 (lj-transition-engine.js).
//     Aqui é a regra MVP inline simples.

const { decrypt } = require('../lib/clickup-crypto');
const tenantPoolHelper = require('../lib/tenant-pool');

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

// Regra MVP: form_submit COM email vira promoção Suspect→Lead.
// Onda 1.3 substitui isso pelo lj-transition-engine genérico com regras configuráveis.
function shouldPromoteToLead(visitor, eventType, payload) {
  if (visitor.entity_type !== 'suspect') return false;
  if (eventType !== 'form_submit') return false;
  const email = String(payload?.email || '').trim();
  const phone = String(payload?.phone || '').trim();
  return !!(email || phone);
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

    // Promoção Suspect → Lead (regra MVP)
    let promoted = false;
    let newEntityType = visitor.entity_type;
    let newStage = visitor.current_stage;
    if (shouldPromoteToLead(visitor, eventType, payload)) {
      const email = String(payload.email || '').trim() || visitor.email;
      const phone = String(payload.phone || '').trim() || visitor.phone;
      const name = String(payload.name || '').trim() || visitor.name;

      await tenantDb.query(
        `UPDATE lj_visitors
            SET entity_type = 'lead',
                current_stage = 'marketing-mof',
                email = COALESCE($3, email),
                phone = COALESCE($4, phone),
                name = COALESCE($5, name),
                promoted_to_lead_at = NOW(),
                updated_at = NOW()
          WHERE user_id = $1 AND lj_visitor_id = $2`,
        [decoded.userId, visitorId, email || null, phone || null, name || null]
      );

      // Audit log da transição
      await tenantDb.query(
        `INSERT INTO lj_transitions
          (lj_visitor_id, user_id, from_entity, to_entity, from_stage, to_stage, source, raw_payload)
         VALUES ($1, $2, $3, 'lead', $4, 'marketing-mof', 'tracker', $5)`,
        [
          visitorId, decoded.userId, visitor.entity_type, visitor.current_stage,
          JSON.stringify({ event_type: eventType, campaign_id: decoded.campaignId, payload })
        ]
      );

      promoted = true;
      newEntityType = 'lead';
      newStage = 'marketing-mof';

      // TODO Onda 1.4: chamar rd-crm-service.createOrUpdateLead(visitor) aqui pra empurrar pro RD.
      // Pra Onda 1.2 (atual) só grava local — empurra RD vem na próxima fase.
    }

    return res.status(200).json({
      ok: true,
      promoted,
      new_entity_type: newEntityType,
      new_stage: newStage
    });
  } catch (err) {
    console.error('[tracker-event]', err);
    return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
  }
};
