// V34.0.0 — V34.5.a: Imputar leads do Buscador numa campanha LJ.
//
// Pega N visitors filtrados (Buscador → Imputar em campanha) e cria o estado
// inicial de cada um na campanha escolhida. SEMPRE entra em 'marketing-tof'
// (decisão cravada: estágio inicial fixo, diferenciação por score).
//
// Próxima onda (V34.5.b) adiciona o push pro RD CRM via pipeline matching
// exato pelo nome da campanha. Esta onda é DB-only.
//
// POST /api/leads-impute-to-campaign
// Body:
//   { campaign_id: 5, visitor_ids: ['imp_xxx', 'lj_yyy', ...] }
//
// Resposta:
//   { ok, campaign: {id, name, slug}, imputed, alreadyIn, skipped, total, errors }
//
// Comportamento por visitor:
//   - Já tem row em lj_visitor_campaign_state pra essa campanha? → alreadyIn++
//   - Senão: INSERT estado (stage='marketing-tof', score=round(global_score*0.5),
//     source='buscador-impute'), aplica tags lj-campanha-{slug} + lj-stage-marketing-tof,
//     registra audit em lj_tag_audit_log + transition em lj_transitions, → imputed++
//   - Visitor inexistente → skipped++ com erro

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

module.exports = async function handler(req, res) {
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });

  const userId = req.user.sub;

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }
  body = body || {};

  const campaignId = Number(body.campaign_id || 0);
  const visitorIds = Array.isArray(body.visitor_ids) ? body.visitor_ids.map(String).filter(Boolean) : [];

  if (!campaignId) return res.status(400).json({ ok: false, message: 'campaign_id obrigatório.' });
  if (!visitorIds.length) return res.status(400).json({ ok: false, message: 'Nenhum visitor pra imputar.' });
  // V34.6.k — hard limit 100 visitors/req. Frontend chunka em 50.
  // 500+ serial estourava timeout Railway (Felipe reportou 502 com 500 leads).
  if (visitorIds.length > 100) {
    return res.status(400).json({
      ok: false,
      message: `Batch grande demais (${visitorIds.length} visitors). Limite: 100 por request. Frontend deve fazer chunking.`
    });
  }

  // Lê nome da campanha do journey_state.state_json (autoridade do user) pra
  // gerar slug. Campanhas vivem em state_json.campaigns no tenant DB.
  let campaignName = null;
  let campaignSlug = null;
  try {
    const stateRow = await req.tenantDb.query(
      'SELECT state_json FROM journey_state WHERE user_id = $1 LIMIT 1',
      [userId]
    );
    if (stateRow.rows.length) {
      const st = stateRow.rows[0].state_json || {};
      const campaigns = Array.isArray(st.campaigns) ? st.campaigns : [];
      const found = campaigns.find(c => Number(c.id) === campaignId);
      if (found) {
        campaignName = String(found.name || '').trim();
        campaignSlug = slugify(campaignName);
      }
    }
  } catch (err) {
    console.error('[leads-impute-to-campaign] read journey_state err:', err);
  }
  // Fallback: usa id se não conseguiu resolver nome.
  if (!campaignName) {
    campaignName = `Campanha #${campaignId}`;
    campaignSlug = `campanha-${campaignId}`;
  }

  const campanhaTag = `lj-campanha-${campaignSlug}`;
  const stageTag = `lj-stage-marketing-tof`;

  let imputed = 0, alreadyIn = 0, skipped = 0;
  const errors = [];

  for (const visitorId of visitorIds) {
    try {
      // Confirma que o visitor existe e pega global_score pra calcular score-campanha inicial.
      const vRes = await req.tenantDb.query(
        `SELECT lj_visitor_id, global_score, entity_type, current_stage
           FROM lj_visitors WHERE user_id = $1 AND lj_visitor_id = $2 LIMIT 1`,
        [userId, visitorId]
      );
      if (!vRes.rows.length) {
        skipped++;
        errors.push({ visitor_id: visitorId, error: 'Visitor não encontrado.' });
        continue;
      }
      const visitor = vRes.rows[0];
      const initialScore = Math.round(Number(visitor.global_score || 0) * 0.5);

      // Já está nessa campanha?
      const existing = await req.tenantDb.query(
        `SELECT id FROM lj_visitor_campaign_state
           WHERE user_id = $1 AND lj_visitor_id = $2 AND campaign_id = $3 LIMIT 1`,
        [userId, visitorId, campaignId]
      );
      if (existing.rows.length) {
        alreadyIn++;
        continue;
      }

      // INSERT estado da campanha
      await req.tenantDb.query(
        `INSERT INTO lj_visitor_campaign_state
           (user_id, lj_visitor_id, campaign_id, current_stage, score, entry_stage, source, entered_at, last_movement_at)
         VALUES ($1, $2, $3, 'marketing-tof', $4, 'marketing-tof', 'buscador-impute', NOW(), NOW())`,
        [userId, visitorId, campaignId, initialScore]
      );

      // Aplica tags lj-campanha-{slug} + lj-stage-marketing-tof
      for (const tag of [campanhaTag, stageTag]) {
        await req.tenantDb.query(
          `INSERT INTO lj_visitor_tags (user_id, lj_visitor_id, tag, source, category)
             VALUES ($1, $2, $3, 'lj-motor', 'lj-native')
           ON CONFLICT (user_id, lj_visitor_id, tag) DO NOTHING`,
          [userId, visitorId, tag]
        );
        await req.tenantDb.query(
          `INSERT INTO lj_tag_audit_log (user_id, lj_visitor_id, tag, action, source)
             VALUES ($1, $2, $3, 'added', 'lj-motor')`,
          [userId, visitorId, tag]
        );
      }

      // Audit transition (lead → lead na campanha X)
      await req.tenantDb.query(
        `INSERT INTO lj_transitions
           (lj_visitor_id, user_id, from_entity, to_entity, from_stage, to_stage, source, raw_payload)
         VALUES ($1, $2, $3, $3, $4, 'marketing-tof', 'buscador-impute', $5)`,
        [
          visitorId,
          userId,
          visitor.entity_type || 'lead',
          visitor.current_stage,
          JSON.stringify({ campaign_id: campaignId, campaign_name: campaignName })
        ]
      );

      imputed++;
    } catch (err) {
      console.error('[leads-impute-to-campaign] visitor err:', err);
      skipped++;
      errors.push({ visitor_id: visitorId, error: err.message });
    }
  }

  // V34.7.f.2 — Recalcula score dos visitors imputados em paralelo
  // (3 visitors por vez pra não saturar DB). Fire-and-forget — não atrasa
  // resposta ao cliente. Erros logam mas não falham o request.
  try {
    const { applyEvent } = require('../lib/score-engine');
    const PARALLEL = 3;
    for (let i = 0; i < visitorIds.length; i += PARALLEL) {
      const slice = visitorIds.slice(i, i + PARALLEL);
      await Promise.allSettled(slice.map(vid =>
        applyEvent(req.tenantDb, userId, vid, { source: 'impute', campaignId, movedStage: true })
      ));
    }
  } catch (err) {
    console.error('[leads-impute-to-campaign] score recalc err:', err.message);
  }

  return res.status(200).json({
    ok: true,
    campaign: { id: campaignId, name: campaignName, slug: campaignSlug },
    imputed,
    alreadyIn,
    skipped,
    total: visitorIds.length,
    errors: errors.slice(0, 10)
  });
};
