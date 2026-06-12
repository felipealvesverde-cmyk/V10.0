// V34.9.3 — POST /api/triggers-mirror
// Espelha triggers de uma campanha origem pra uma campanha destino.
// Comportamento (decisão cravada): SUBSTITUI SÓ OS FALTANTES — preserva os
// triggers que já existem no destino, adiciona apenas os que não tem.
//
// "Mesmo trigger" = mesma (from_stage, to_stage, trigger_type, trigger_param, trigger_value_int).
//
// Body: { source_campaign_id, target_campaign_id }
// Permissão: master only.

const { resolveCredentialOwnerId } = require('../lib/credentials-owner');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas master pode espelhar triggers.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  // V37.4.34 — Triggers vivem na linha do OWNER do tenant.
  const userId = await resolveCredentialOwnerId(req);
  const sourceId = Number(body.source_campaign_id);
  const targetId = Number(body.target_campaign_id);
  if (!sourceId || !targetId) {
    return res.status(400).json({ ok: false, message: 'source_campaign_id e target_campaign_id obrigatórios.' });
  }
  if (sourceId === targetId) {
    return res.status(400).json({ ok: false, message: 'Origem e destino são a mesma campanha.' });
  }

  try {
    // Lista source
    const src = await req.tenantDb.query(
      `SELECT is_master, from_stage, to_stage, trigger_type, trigger_param, trigger_value_int, is_active
         FROM lj_transition_rules
        WHERE user_id = $1 AND campaign_id = $2`,
      [userId, sourceId]
    );

    if (!src.rows.length) {
      return res.status(200).json({ ok: true, copied: 0, skipped: 0, message: 'Campanha origem sem triggers.' });
    }

    // Lista target existente (pra dedupe)
    const tgt = await req.tenantDb.query(
      `SELECT is_master, from_stage, to_stage, trigger_type,
              COALESCE(trigger_param, '') AS trigger_param,
              COALESCE(trigger_value_int, 0) AS trigger_value_int
         FROM lj_transition_rules
        WHERE user_id = $1 AND campaign_id = $2`,
      [userId, targetId]
    );
    const targetKeys = new Set(tgt.rows.map(r => [
      r.is_master, r.from_stage || 'NULL', r.to_stage, r.trigger_type, r.trigger_param, r.trigger_value_int
    ].join('|')));

    let copied = 0, skipped = 0;
    for (const s of src.rows) {
      const key = [
        s.is_master, s.from_stage || 'NULL', s.to_stage, s.trigger_type,
        s.trigger_param || '', s.trigger_value_int || 0
      ].join('|');
      if (targetKeys.has(key)) { skipped++; continue; }
      await req.tenantDb.query(
        `INSERT INTO lj_transition_rules
           (user_id, campaign_id, is_master, from_stage, to_stage,
            trigger_type, trigger_param, trigger_value_int, is_active, created_via)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'mirror')`,
        [
          userId, targetId, s.is_master, s.from_stage, s.to_stage,
          s.trigger_type, s.trigger_param, s.trigger_value_int, s.is_active
        ]
      );
      copied++;
    }

    return res.status(200).json({ ok: true, copied, skipped, sourceTotal: src.rows.length });
  } catch (err) {
    console.error('[triggers-mirror]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
