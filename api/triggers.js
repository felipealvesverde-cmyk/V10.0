// V34.9.3 — CRUD de triggers por campanha.
// GET ?campaign_id=X       → lista triggers da campanha
// POST { campaign_id, ... } → cria trigger
// PATCH { id, ...fields }   → atualiza (toggle ativo, mudar param, destino)
// DELETE { id }             → remove
//
// Permissão (cravada no spec V34.9.3): só usuários master criam/editam/deletam.
// Cliente comum pode fazer GET pra visualizar mas não modificar.

const ALLOWED_TYPES = ['cta', 'form', 'pageview', 'tag', 'payment', 'time', 'score'];
const ALLOWED_STAGES = [
  'marketing-tof', 'marketing-mof', 'marketing-bof',
  'vendas-tof', 'vendas-mof', 'vendas-bof',
  'cs-tof', 'cs-mof', 'cs-bof',
  'EXIT'
];

function validatePayload(body) {
  const errors = [];
  if (body.trigger_type && !ALLOWED_TYPES.includes(body.trigger_type)) {
    errors.push(`trigger_type inválido (use ${ALLOWED_TYPES.join('|')})`);
  }
  if (body.from_stage && !ALLOWED_STAGES.includes(body.from_stage)) {
    errors.push(`from_stage inválido`);
  }
  if (body.to_stage && !ALLOWED_STAGES.includes(body.to_stage)) {
    errors.push(`to_stage inválido`);
  }
  return errors;
}

const { resolveCredentialOwnerId } = require('../lib/credentials-owner');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  // V37.4.34 — Triggers vivem na linha do OWNER do tenant.
  const userId = await resolveCredentialOwnerId(req);

  // Helper pra checar permissão write (só master) — mantido V34.9.3.
  const requireMaster = () => {
    if (!req.user.isMaster) {
      res.status(403).json({ ok: false, message: 'Apenas master pode criar/editar/deletar triggers.' });
      return false;
    }
    return true;
  };

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  try {
    if (req.method === 'GET') {
      const campaignId = Number(req.query?.campaign_id || 0);
      if (!campaignId) return res.status(400).json({ ok: false, message: 'campaign_id obrigatório.' });

      const r = await req.tenantDb.query(
        `SELECT * FROM lj_transition_rules
          WHERE user_id = $1 AND campaign_id = $2
          ORDER BY is_master DESC, from_stage NULLS FIRST, id ASC`,
        [userId, campaignId]
      );
      return res.status(200).json({ ok: true, triggers: r.rows });
    }

    if (req.method === 'POST') {
      if (!requireMaster()) return;
      const errors = validatePayload(body);
      if (errors.length) return res.status(400).json({ ok: false, message: errors.join('; ') });

      const campaignId = Number(body.campaign_id);
      if (!campaignId) return res.status(400).json({ ok: false, message: 'campaign_id obrigatório.' });
      if (!body.trigger_type) return res.status(400).json({ ok: false, message: 'trigger_type obrigatório.' });
      if (!body.to_stage) return res.status(400).json({ ok: false, message: 'to_stage obrigatório.' });

      const isMaster = Boolean(body.is_master);
      // Master pode ter from_stage NULL; não-master precisa de from_stage
      if (!isMaster && !body.from_stage) {
        return res.status(400).json({ ok: false, message: 'from_stage obrigatório quando is_master=false.' });
      }

      const r = await req.tenantDb.query(
        `INSERT INTO lj_transition_rules
           (user_id, campaign_id, is_master, from_stage, to_stage,
            trigger_type, trigger_param, trigger_value_int, is_active, created_via)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          userId, campaignId, isMaster,
          isMaster ? null : body.from_stage,
          body.to_stage,
          body.trigger_type,
          body.trigger_param || null,
          body.trigger_value_int != null ? Number(body.trigger_value_int) : null,
          body.is_active !== false, // default true
          String(body.created_via || 'ui').slice(0, 16)
        ]
      );
      return res.status(200).json({ ok: true, trigger: r.rows[0] });
    }

    if (req.method === 'PATCH') {
      if (!requireMaster()) return;
      const id = Number(body.id);
      if (!id) return res.status(400).json({ ok: false, message: 'id obrigatório.' });

      const errors = validatePayload(body);
      if (errors.length) return res.status(400).json({ ok: false, message: errors.join('; ') });

      // Builds dynamic UPDATE só com os campos enviados
      const sets = [];
      const params = [userId, id];
      let idx = 3;
      const editable = ['from_stage', 'to_stage', 'trigger_type', 'trigger_param', 'trigger_value_int', 'is_active', 'is_master'];
      for (const f of editable) {
        if (body[f] !== undefined) {
          sets.push(`${f} = $${idx++}`);
          params.push(body[f]);
        }
      }
      if (!sets.length) {
        return res.status(400).json({ ok: false, message: 'Nada a atualizar.' });
      }
      sets.push(`updated_at = NOW()`);

      const r = await req.tenantDb.query(
        `UPDATE lj_transition_rules SET ${sets.join(', ')}
          WHERE user_id = $1 AND id = $2 RETURNING *`,
        params
      );
      if (r.rowCount === 0) return res.status(404).json({ ok: false, message: 'Trigger não encontrado.' });
      return res.status(200).json({ ok: true, trigger: r.rows[0] });
    }

    if (req.method === 'DELETE') {
      if (!requireMaster()) return;
      const id = Number(body.id || req.query?.id);
      if (!id) return res.status(400).json({ ok: false, message: 'id obrigatório.' });

      const r = await req.tenantDb.query(
        `DELETE FROM lj_transition_rules WHERE user_id = $1 AND id = $2 RETURNING id`,
        [userId, id]
      );
      if (r.rowCount === 0) return res.status(404).json({ ok: false, message: 'Trigger não encontrado.' });
      return res.status(200).json({ ok: true, deletedId: id });
    }

    return res.status(405).json({ ok: false, message: 'Use GET, POST, PATCH ou DELETE.' });
  } catch (err) {
    console.error('[triggers]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
