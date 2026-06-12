// V34.9.13 — CRUD do ICP Profile (Ideal Customer Profile) por user.
//
// GET → retorna { fields_json, tier_method, tier_rules_json } do user
// POST → upsert (aceita tier_method 'percentage' | 'rules', e tier_rules_json)
//
// Permissão: qualquer user autenticado (self-scope).

const { resolveCredentialOwnerId, assertCanWriteCredentials } = require('../lib/credentials-owner');

const ALLOWED_TIER_METHODS = ['percentage', 'rules'];
const EMPTY_TIER_RULES = { tier_1: [], tier_2: [], tier_3: [] };

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  // V37.4.34 — ICP profile vive na linha do OWNER do tenant.
  const userId = await resolveCredentialOwnerId(req);

  try {
    if (req.method === 'GET') {
      const r = await req.tenantDb.query(
        `SELECT user_id, fields_json, tier_method, tier_rules_json, updated_at
           FROM lj_icp_profile WHERE user_id = $1`,
        [userId]
      );
      if (!r.rows.length) {
        return res.status(200).json({
          ok: true,
          profile: { fields_json: {}, tier_method: 'percentage', tier_rules_json: EMPTY_TIER_RULES }
        });
      }
      return res.status(200).json({ ok: true, profile: r.rows[0] });
    }

    if (req.method === 'POST') {
      try { await assertCanWriteCredentials(req); }
      catch (err) { return res.status(err.statusCode || 403).json({ ok: false, message: err.message }); }
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
      body = body || {};

      const fields = body.fields_json && typeof body.fields_json === 'object' ? body.fields_json : {};
      const tierMethod = String(body.tier_method || 'percentage').toLowerCase();
      if (!ALLOWED_TIER_METHODS.includes(tierMethod)) {
        return res.status(400).json({ ok: false, message: `tier_method deve ser ${ALLOWED_TIER_METHODS.join('|')}.` });
      }
      const tierRules = body.tier_rules_json && typeof body.tier_rules_json === 'object'
        ? { tier_1: Array.isArray(body.tier_rules_json.tier_1) ? body.tier_rules_json.tier_1 : [],
            tier_2: Array.isArray(body.tier_rules_json.tier_2) ? body.tier_rules_json.tier_2 : [],
            tier_3: Array.isArray(body.tier_rules_json.tier_3) ? body.tier_rules_json.tier_3 : [] }
        : EMPTY_TIER_RULES;

      await req.tenantDb.query(
        `INSERT INTO lj_icp_profile (user_id, fields_json, tier_method, tier_rules_json, updated_at)
           VALUES ($1, $2::jsonb, $3, $4::jsonb, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           fields_json = EXCLUDED.fields_json,
           tier_method = EXCLUDED.tier_method,
           tier_rules_json = EXCLUDED.tier_rules_json,
           updated_at = NOW()`,
        [userId, JSON.stringify(fields), tierMethod, JSON.stringify(tierRules)]
      );

      return res.status(200).json({ ok: true, profile: { fields_json: fields, tier_method: tierMethod, tier_rules_json: tierRules } });
    }

    return res.status(405).json({ ok: false, message: 'Use GET ou POST.' });
  } catch (err) {
    console.error('[icp-profile]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
