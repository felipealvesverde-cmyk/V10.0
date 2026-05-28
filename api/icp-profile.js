// V34.9.11 — CRUD do ICP Profile (Ideal Customer Profile) por user.
//
// GET → retorna { fields_json, scoring_method, fit_max_bonus } do user
// POST → upsert
//
// Permissão: qualquer user autenticado (self-scope).

const ALLOWED_METHODS = ['multiplier', 'sum', 'simple'];

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);

  try {
    if (req.method === 'GET') {
      const r = await req.tenantDb.query(
        `SELECT user_id, fields_json, scoring_method, fit_max_bonus, updated_at
           FROM lj_icp_profile WHERE user_id = $1`,
        [userId]
      );
      if (!r.rows.length) {
        return res.status(200).json({
          ok: true,
          profile: { fields_json: {}, scoring_method: 'multiplier', fit_max_bonus: 100 }
        });
      }
      return res.status(200).json({ ok: true, profile: r.rows[0] });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
      body = body || {};

      const fields = body.fields_json && typeof body.fields_json === 'object' ? body.fields_json : {};
      const method = String(body.scoring_method || 'multiplier').toLowerCase();
      if (!ALLOWED_METHODS.includes(method)) {
        return res.status(400).json({ ok: false, message: `scoring_method deve ser ${ALLOWED_METHODS.join('|')}.` });
      }
      const maxBonus = Number(body.fit_max_bonus);
      const fitMaxBonus = Number.isFinite(maxBonus) ? Math.max(0, Math.min(10000, Math.round(maxBonus))) : 100;

      await req.tenantDb.query(
        `INSERT INTO lj_icp_profile (user_id, fields_json, scoring_method, fit_max_bonus, updated_at)
           VALUES ($1, $2::jsonb, $3, $4, NOW())
         ON CONFLICT (user_id) DO UPDATE SET
           fields_json = EXCLUDED.fields_json,
           scoring_method = EXCLUDED.scoring_method,
           fit_max_bonus = EXCLUDED.fit_max_bonus,
           updated_at = NOW()`,
        [userId, JSON.stringify(fields), method, fitMaxBonus]
      );

      return res.status(200).json({ ok: true, profile: { fields_json: fields, scoring_method: method, fit_max_bonus: fitMaxBonus } });
    }

    return res.status(405).json({ ok: false, message: 'Use GET ou POST.' });
  } catch (err) {
    console.error('[icp-profile]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
