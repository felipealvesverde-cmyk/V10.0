// V33.0.0 — Onda 1.2: inicializa visitor pelo snippet do site do cliente.
//
// POST /api/tracker-init  (PÚBLICO, CORS aberto)
//   Body: {
//     tracker_token: string,         // opaco, decifrado pra (tenant, user, campaign)
//     lj_visitor_id: string|null,    // null = cria novo
//     utm_source, utm_medium, utm_campaign, utm_content, utm_term,
//     referrer_url, landing_url
//   }
//   → { ok, lj_visitor_id }
//
// Comportamento:
//   - Decrypt token → {tenant_id, user_id, campaign_id}
//   - Se lj_visitor_id null → gera UUID v4 simples
//   - UPSERT em lj_visitors (user_id, lj_visitor_id) — visitor novo entra como suspect/TOF marketing
//   - INSERT em lj_visitor_touchpoints (is_first=true se visitor novo)
//   - Retorna lj_visitor_id pro snippet salvar no cookie

const crypto = require('crypto');
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

// SOURCE inference simples a partir de UTMs + referrer.
// Cobre os casos mais comuns; pode evoluir com mapping configurável depois.
function inferSource(utm, referrer) {
  const src = String(utm.utm_source || '').toLowerCase();
  const med = String(utm.utm_medium || '').toLowerCase();
  if (src.includes('google') && (med.includes('cpc') || med.includes('paid'))) return { source: 'google_ads', source_type: 'paid' };
  if (src.includes('facebook') || src.includes('meta') || src.includes('instagram')) {
    if (med.includes('cpc') || med.includes('paid')) return { source: 'meta_ads', source_type: 'paid' };
    return { source: 'meta_organic', source_type: 'earned' };
  }
  if (src.includes('linkedin') && med.includes('cpc')) return { source: 'linkedin_ads', source_type: 'paid' };
  if (src.includes('rd') || src.includes('rdstation')) return { source: 'rd_email', source_type: 'owned' };
  if (med.includes('email')) return { source: 'email', source_type: 'owned' };
  if (referrer) {
    if (/google\./i.test(referrer)) return { source: 'google_organic', source_type: 'earned' };
    if (/facebook|instagram|meta\./i.test(referrer)) return { source: 'meta_organic', source_type: 'earned' };
    return { source: 'referral', source_type: 'earned' };
  }
  return { source: 'direct', source_type: 'direct' };
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

  // Pega pool do tenant (rota é pública, req.tenantDb é fallback control plane)
  let tenantDb;
  try {
    tenantDb = await tenantPoolHelper.getTenantPool(req.db, decoded.tenantId);
  } catch (err) {
    return res.status(500).json({ ok: false, message: `Falha ao acessar tenant DB: ${err.message}` });
  }
  if (!tenantDb) tenantDb = req.db; // tenant sem DB próprio → control plane

  // Gera novo visitor_id se não veio
  let visitorId = String(body.lj_visitor_id || '').trim();
  let isNew = false;
  if (!visitorId) {
    visitorId = crypto.randomUUID();
    isNew = true;
  }

  try {
    // UPSERT no visitor — se existe atualiza last_seen_at, se não cria como suspect
    const upsert = await tenantDb.query(
      `INSERT INTO lj_visitors (lj_visitor_id, user_id, entity_type, current_stage, last_seen_at)
       VALUES ($1, $2, 'suspect', 'marketing-tof', NOW())
       ON CONFLICT (user_id, lj_visitor_id)
       DO UPDATE SET last_seen_at = NOW(), updated_at = NOW()
       RETURNING id, lj_visitor_id, entity_type, current_stage, first_seen_at`,
      [visitorId, decoded.userId]
    );
    const visitor = upsert.rows[0];

    // Touchpoint — registra source/UTMs da entrada atual.
    // is_first = true só se for o primeiro touchpoint deste visitor.
    const tpExisting = await tenantDb.query(
      `SELECT 1 FROM lj_visitor_touchpoints WHERE lj_visitor_id = $1 AND user_id = $2 LIMIT 1`,
      [visitorId, decoded.userId]
    );
    const isFirstTouch = tpExisting.rows.length === 0;
    const utms = {
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
      utm_content: body.utm_content || null,
      utm_term: body.utm_term || null
    };
    const srcInfo = inferSource(utms, body.referrer_url);
    await tenantDb.query(
      `INSERT INTO lj_visitor_touchpoints
        (lj_visitor_id, user_id, campaign_id, source, source_type,
         utm_source, utm_medium, utm_campaign, utm_content, utm_term,
         referrer_url, landing_url, is_first)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        visitorId, decoded.userId, decoded.campaignId,
        srcInfo.source, srcInfo.source_type,
        utms.utm_source, utms.utm_medium, utms.utm_campaign, utms.utm_content, utms.utm_term,
        body.referrer_url || null, body.landing_url || null,
        isFirstTouch
      ]
    );

    // Transition de criação só pra visitor NOVO (audit log)
    if (isNew) {
      await tenantDb.query(
        `INSERT INTO lj_transitions
          (lj_visitor_id, user_id, from_entity, to_entity, from_stage, to_stage, source, raw_payload)
         VALUES ($1, $2, NULL, 'suspect', NULL, 'marketing-tof', 'tracker', $3)`,
        [visitorId, decoded.userId, JSON.stringify({ campaign_id: decoded.campaignId, source: srcInfo.source })]
      );
    }

    return res.status(200).json({
      ok: true,
      lj_visitor_id: visitor.lj_visitor_id,
      entity_type: visitor.entity_type,
      current_stage: visitor.current_stage,
      is_new: isNew
    });
  } catch (err) {
    console.error('[tracker-init]', err);
    return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
  }
};
