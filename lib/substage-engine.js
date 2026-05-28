// V34.9.20 — Sub-stage Engine.
//
// Sub-stages = mini-funil editável dentro de cada bolinha do Revenue Flow Map,
// configurado por (campanha × parent_stage). Lead avança quando ganha tag;
// não volta; tag macro vence (lead muda de bolinha → perde sub-stage).
//
// Design derivado: o sub-stage atual NÃO é persistido. É calculado a partir
// das tags do visitor — a maior `order_idx` cuja `tag_trigger` o lead possui.
// Isso faz "não volta" emergir naturalmente (se tem tag 2 e tag 4, fica no 4).
//
// A coluna lj_visitor_campaign_state.substage_id existe como cache opcional
// pra v2 (se virar gargalo de performance). Hoje não é lida.

/**
 * Calcula o substage_id atual de um lead numa campanha × parent_stage.
 * Retorna null se não há sub-stages configurados ou lead não casa com nenhuma tag.
 * Sub-stage 1 (order_idx = 0) é a entrada padrão — leads sem nenhuma tag de
 * sub-stage caem nele.
 */
async function resolveCurrentSubstageId(db, userId, ljVisitorId, campaignId, parentStage) {
  // 1. Lista de sub-stages configurados, em order_idx desc (do mais avançado pro inicial)
  const subRes = await db.query(
    `SELECT id, order_idx, tag_trigger FROM lj_substages
      WHERE user_id = $1 AND campaign_id = $2 AND parent_stage = $3
      ORDER BY order_idx DESC`,
    [userId, campaignId, parentStage]
  );
  if (!subRes.rows.length) return null;

  // 2. Tags do visitor
  const tagsRes = await db.query(
    `SELECT tag FROM lj_visitor_tags WHERE user_id = $1 AND lj_visitor_id = $2`,
    [userId, ljVisitorId]
  );
  const visitorTags = new Set(tagsRes.rows.map(r => String(r.tag || '').toLowerCase()));

  // 3. Primeiro sub-stage (maior order_idx) cuja tag o lead possui
  for (const sub of subRes.rows) {
    const trigger = String(sub.tag_trigger || '').toLowerCase();
    if (trigger && visitorTags.has(trigger)) return Number(sub.id);
  }

  // 4. Nenhuma tag bateu — cai na entrada padrão (order_idx = 0)
  const defaultSub = subRes.rows[subRes.rows.length - 1];
  return Number(defaultSub?.id) || null;
}

/**
 * Lista sub-stages de uma (campanha × parent_stage) com contagem real de leads
 * em cada. Calcula on-demand iterando os leads da bolinha e atribuindo via
 * resolveCurrentSubstageId. Usado pelo modal e pela visão macro.
 */
async function listSubstagesWithCounts(db, userId, campaignId, parentStage) {
  const subRes = await db.query(
    `SELECT id, order_idx, name, tag_trigger, color
       FROM lj_substages
      WHERE user_id = $1 AND campaign_id = $2 AND parent_stage = $3
      ORDER BY order_idx ASC`,
    [userId, campaignId, parentStage]
  );
  const substages = subRes.rows;
  if (!substages.length) return [];

  // Leads na bolinha (mesma campanha, current_stage = parent_stage)
  const leadsRes = await db.query(
    `SELECT vcs.lj_visitor_id
       FROM lj_visitor_campaign_state vcs
      WHERE vcs.user_id = $1 AND vcs.campaign_id = $2 AND vcs.current_stage = $3`,
    [userId, campaignId, parentStage]
  );

  // Pra cada lead, resolve o sub-stage atual; agrega contagem
  const counts = new Map(substages.map(s => [Number(s.id), 0]));
  for (const row of leadsRes.rows) {
    const subId = await resolveCurrentSubstageId(db, userId, row.lj_visitor_id, campaignId, parentStage);
    if (subId && counts.has(subId)) counts.set(subId, counts.get(subId) + 1);
  }

  return substages.map(s => ({
    id: Number(s.id),
    order_idx: Number(s.order_idx),
    name: s.name,
    tag_trigger: s.tag_trigger,
    color: s.color,
    leadCount: counts.get(Number(s.id)) || 0
  }));
}

/**
 * Lista os leads dentro de UM sub-stage específico. Usado pelo botão "ver leads"
 * de cada linha do mini-funil.
 */
async function listLeadsInSubstage(db, userId, campaignId, parentStage, substageId, limit = 200) {
  const leadsRes = await db.query(
    `SELECT v.lj_visitor_id, v.name, v.email, v.phone, v.global_score, v.entity_type, v.current_stage
       FROM lj_visitor_campaign_state vcs
       JOIN lj_visitors v ON v.user_id = vcs.user_id AND v.lj_visitor_id = vcs.lj_visitor_id
      WHERE vcs.user_id = $1 AND vcs.campaign_id = $2 AND vcs.current_stage = $3
      LIMIT $4`,
    [userId, campaignId, parentStage, limit * 3]
  );

  const matches = [];
  for (const lead of leadsRes.rows) {
    const subId = await resolveCurrentSubstageId(db, userId, lead.lj_visitor_id, campaignId, parentStage);
    if (subId === Number(substageId)) {
      matches.push(lead);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}

/**
 * V35.0.0 — Atualiza o cache substage_id em lj_visitor_campaign_state pra
 * todos os leads de uma (campanha × parent_stage). Registra transições em
 * lj_substage_transitions quando o cache muda. Chamado em background após
 * save/delete de sub-stage.
 */
async function syncSubstageCacheForBolinha(db, userId, campaignId, parentStage, source = 'cache-sync') {
  const leadsRes = await db.query(
    `SELECT lj_visitor_id, substage_id FROM lj_visitor_campaign_state
      WHERE user_id = $1 AND campaign_id = $2 AND current_stage = $3`,
    [userId, campaignId, parentStage]
  );
  let updated = 0, transitions = 0;
  for (const row of leadsRes.rows) {
    const newId = await resolveCurrentSubstageId(db, userId, row.lj_visitor_id, campaignId, parentStage);
    const oldId = row.substage_id ? Number(row.substage_id) : null;
    if (newId !== oldId) {
      await db.query(
        `UPDATE lj_visitor_campaign_state SET substage_id = $1
          WHERE user_id = $2 AND lj_visitor_id = $3 AND campaign_id = $4`,
        [newId, userId, row.lj_visitor_id, campaignId]
      );
      updated++;
      // Log transição (apenas se houve mudança real)
      try {
        await db.query(
          `INSERT INTO lj_substage_transitions
             (user_id, lj_visitor_id, campaign_id, parent_stage, from_substage_id, to_substage_id, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [userId, row.lj_visitor_id, campaignId, parentStage, oldId, newId, source]
        );
        transitions++;
      } catch (_) {}
    }
  }
  return { updated, transitions };
}

/**
 * V35.0.0 — Histórico de transições de sub-stage de um visitor.
 * Retorna até 50 últimas movimentações.
 */
async function listSubstageHistory(db, userId, ljVisitorId, limit = 50) {
  const r = await db.query(
    `SELECT t.id, t.campaign_id, t.parent_stage,
            t.from_substage_id, t.to_substage_id, t.source, t.occurred_at,
            sf.name AS from_name, st.name AS to_name
       FROM lj_substage_transitions t
       LEFT JOIN lj_substages sf ON sf.id = t.from_substage_id
       LEFT JOIN lj_substages st ON st.id = t.to_substage_id
      WHERE t.user_id = $1 AND t.lj_visitor_id = $2
      ORDER BY t.occurred_at DESC LIMIT $3`,
    [userId, ljVisitorId, limit]
  );
  return r.rows;
}

module.exports = {
  resolveCurrentSubstageId,
  listSubstagesWithCounts,
  listLeadsInSubstage,
  syncSubstageCacheForBolinha,
  listSubstageHistory
};
