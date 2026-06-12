// V34.9.10 — CRUD de regras de scoring (modo Critérios / HubSpot-style).
//
// GET  → lista regras do user
// POST → cria { trigger_type, trigger_param, points, category?, notes? }
// PATCH → { id, ...campos } atualiza
// DELETE → { id } remove
//
// Permissão: master only pra escrita (cliente comum só lê).

const { resolveCredentialOwnerId, assertCanWriteCredentials } = require('../lib/credentials-owner');

const ALLOWED_TYPES = ['tag', 'pageview', 'form', 'cta', 'payment', 'event', 'time', 'score'];
const ALLOWED_CATEGORIES = ['engagement', 'fit', 'intent', null];

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  // V37.4.34 — Score rules vivem na linha do OWNER do tenant.
  const userId = await resolveCredentialOwnerId(req);

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  try {
    if (req.method === 'GET') {
      const r = await req.tenantDb.query(
        `SELECT * FROM lj_score_rules WHERE user_id = $1
          ORDER BY category NULLS LAST, points DESC, id ASC`,
        [userId]
      );
      return res.status(200).json({ ok: true, rules: r.rows });
    }

    if (req.method === 'POST') {
      try { await assertCanWriteCredentials(req); }
      catch (err) { return res.status(err.statusCode || 403).json({ ok: false, message: err.message }); }
      const triggerType = String(body.trigger_type || '').toLowerCase();
      if (!ALLOWED_TYPES.includes(triggerType)) {
        return res.status(400).json({ ok: false, message: `trigger_type inválido (use ${ALLOWED_TYPES.join('|')}).` });
      }
      const category = body.category ? String(body.category).toLowerCase() : null;
      if (category && !ALLOWED_CATEGORIES.includes(category)) {
        return res.status(400).json({ ok: false, message: 'category deve ser engagement|fit|intent ou null.' });
      }
      const points = Number(body.points);
      if (!Number.isFinite(points)) return res.status(400).json({ ok: false, message: 'points obrigatório (número).' });

      const r = await req.tenantDb.query(
        `INSERT INTO lj_score_rules
           (user_id, trigger_type, trigger_param, points, category, is_active, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          userId, triggerType, body.trigger_param || null,
          Math.round(points), category,
          body.is_active !== false,
          body.notes || null
        ]
      );
      return res.status(200).json({ ok: true, rule: r.rows[0] });
    }

    if (req.method === 'PATCH') {
      try { await assertCanWriteCredentials(req); }
      catch (err) { return res.status(err.statusCode || 403).json({ ok: false, message: err.message }); }
      const id = Number(body.id);
      if (!id) return res.status(400).json({ ok: false, message: 'id obrigatório.' });
      const sets = [];
      const params = [userId, id];
      let idx = 3;
      const editable = ['trigger_type', 'trigger_param', 'points', 'category', 'is_active', 'notes'];
      for (const f of editable) {
        if (body[f] !== undefined) {
          sets.push(`${f} = $${idx++}`);
          params.push(body[f]);
        }
      }
      if (!sets.length) return res.status(400).json({ ok: false, message: 'Nada a atualizar.' });
      sets.push('updated_at = NOW()');
      const r = await req.tenantDb.query(
        `UPDATE lj_score_rules SET ${sets.join(', ')}
          WHERE user_id = $1 AND id = $2 RETURNING *`,
        params
      );
      if (r.rowCount === 0) return res.status(404).json({ ok: false, message: 'Regra não encontrada.' });
      return res.status(200).json({ ok: true, rule: r.rows[0] });
    }

    if (req.method === 'DELETE') {
      try { await assertCanWriteCredentials(req); }
      catch (err) { return res.status(err.statusCode || 403).json({ ok: false, message: err.message }); }
      const id = Number(body.id || req.query?.id);
      if (!id) return res.status(400).json({ ok: false, message: 'id obrigatório.' });
      const r = await req.tenantDb.query(
        `DELETE FROM lj_score_rules WHERE user_id = $1 AND id = $2 RETURNING id`,
        [userId, id]
      );
      if (r.rowCount === 0) return res.status(404).json({ ok: false, message: 'Regra não encontrada.' });
      return res.status(200).json({ ok: true, deletedId: id });
    }

    return res.status(405).json({ ok: false, message: 'Use GET, POST, PATCH ou DELETE.' });
  } catch (err) {
    console.error('[score-rules]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
