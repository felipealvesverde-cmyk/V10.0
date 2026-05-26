// V34.0.0 — V34.6.a: Identity Resolution helper.
//
// mergeVisitors() funde 2 visitors do MESMO user (tenant) num só.
// Regras cravadas (V34 spec):
//   - Mantém o lj_visitor_id MAIS ANTIGO (preserva histórico longo).
//   - Soma: total_value_cents, hotmart_purchase_count, global_score.
//   - email/phone/name: se survivor tem null e deleted tem valor → fica valor.
//   - Tags: UNION (merge dedupado).
//   - Touchpoints, events, transitions, visitor_campaign_state: re-aponta deleted→survivor.
//   - Tag `crossed-{matchSignal}` é adicionada ao survivor (V34.6 audit visual).
//   - Audit em lj_merges com snapshot do deleted pre-merge.
//   - Deleted visitor é DELETADO no fim (cascade cleanup feito pelo redireccionamento das FKs).
//
// Uso:
//   const merge = require('../lib/visitor-merge');
//   await merge.mergeVisitors(tenantDb, userId, survivorId, deletedId, {
//     matchSignal: 'email-exact',
//     sourceReason: 'find-duplicates'
//   });
//
// Throws se IDs iguais, visitor inexistente, ou mismatch de user_id.

async function loadVisitor(db, userId, ljVisitorId) {
  const r = await db.query(
    `SELECT * FROM lj_visitors WHERE user_id = $1 AND lj_visitor_id = $2 LIMIT 1`,
    [userId, ljVisitorId]
  );
  if (!r.rows.length) throw new Error(`Visitor ${ljVisitorId} não encontrado.`);
  return r.rows[0];
}

// Decide quem fica baseado em first_seen_at (mais antigo vence). Se empate, menor ID.
function pickSurvivor(a, b) {
  const ta = new Date(a.first_seen_at || a.created_at || 0).getTime();
  const tb = new Date(b.first_seen_at || b.created_at || 0).getTime();
  if (ta < tb) return { survivor: a, deleted: b };
  if (tb < ta) return { survivor: b, deleted: a };
  return a.id < b.id ? { survivor: a, deleted: b } : { survivor: b, deleted: a };
}

async function mergeVisitors(db, userId, idA, idB, opts = {}) {
  if (!idA || !idB) throw new Error('IDs obrigatórios.');
  if (idA === idB) throw new Error('Não dá pra fundir um visitor consigo mesmo.');

  const matchSignal = String(opts.matchSignal || 'manual');
  const sourceReason = String(opts.sourceReason || 'manual-ui');
  // explicitSurvivorId: força o sobrevivente (UI manual). Senão usa pickSurvivor (mais antigo).
  const explicitSurvivorId = opts.survivorVisitorId || null;

  const va = await loadVisitor(db, userId, idA);
  const vb = await loadVisitor(db, userId, idB);
  if (Number(va.user_id) !== Number(userId) || Number(vb.user_id) !== Number(userId)) {
    throw new Error('Visitors de tenants diferentes — não dá pra fundir.');
  }

  let survivor, deleted;
  if (explicitSurvivorId) {
    if (va.lj_visitor_id === explicitSurvivorId) { survivor = va; deleted = vb; }
    else if (vb.lj_visitor_id === explicitSurvivorId) { survivor = vb; deleted = va; }
    else throw new Error('explicitSurvivorId não bate com nenhum dos visitors passados.');
  } else {
    const picked = pickSurvivor(va, vb);
    survivor = picked.survivor;
    deleted = picked.deleted;
  }

  const survivorId = survivor.lj_visitor_id;
  const deletedId = deleted.lj_visitor_id;

  // 1. Snapshot do deleted pra audit (antes de deletar)
  const detailsSnapshot = {
    id: deleted.id,
    lj_visitor_id: deleted.lj_visitor_id,
    email: deleted.email,
    phone: deleted.phone,
    name: deleted.name,
    bank_id: deleted.bank_id,
    entity_type: deleted.entity_type,
    current_stage: deleted.current_stage,
    global_score: deleted.global_score,
    total_value_cents: deleted.total_value_cents,
    hotmart_purchase_count: deleted.hotmart_purchase_count,
    first_seen_at: deleted.first_seen_at,
    last_seen_at: deleted.last_seen_at,
    external_rd_contact_id: deleted.external_rd_contact_id,
    external_rd_deal_id: deleted.external_rd_deal_id
  };

  // 2. Re-aponta as FKs do deleted → survivor (uma transação só pra garantir atomicidade)
  await db.query('BEGIN');
  try {
    // Touchpoints, events, transitions, tags, campaign_state, audit log → re-aim
    await db.query(
      `UPDATE lj_visitor_touchpoints SET lj_visitor_id = $1 WHERE user_id = $2 AND lj_visitor_id = $3`,
      [survivorId, userId, deletedId]
    );
    await db.query(
      `UPDATE lj_visitor_events SET lj_visitor_id = $1 WHERE user_id = $2 AND lj_visitor_id = $3`,
      [survivorId, userId, deletedId]
    );
    await db.query(
      `UPDATE lj_transitions SET lj_visitor_id = $1 WHERE user_id = $2 AND lj_visitor_id = $3`,
      [survivorId, userId, deletedId]
    );
    // Tags: UNION dedup — ON CONFLICT DO NOTHING preserva a tag mais antiga do survivor.
    await db.query(
      `INSERT INTO lj_visitor_tags (user_id, lj_visitor_id, tag, source, category, created_at)
         SELECT user_id, $1, tag, source, category, created_at
         FROM lj_visitor_tags
         WHERE user_id = $2 AND lj_visitor_id = $3
       ON CONFLICT (user_id, lj_visitor_id, tag) DO NOTHING`,
      [survivorId, userId, deletedId]
    );
    // Apaga tags do deleted (já copiamos as únicas pro survivor)
    await db.query(
      `DELETE FROM lj_visitor_tags WHERE user_id = $1 AND lj_visitor_id = $2`,
      [userId, deletedId]
    );
    // Audit log de tags do deleted: re-aponta pro survivor pra preservar histórico
    await db.query(
      `UPDATE lj_tag_audit_log SET lj_visitor_id = $1 WHERE user_id = $2 AND lj_visitor_id = $3`,
      [survivorId, userId, deletedId]
    );
    // Visitor campaign state: re-aponta (ON CONFLICT pra dedup se as 2 já estavam na mesma campanha)
    await db.query(
      `INSERT INTO lj_visitor_campaign_state
         (user_id, lj_visitor_id, campaign_id, current_stage, score, entry_stage, source, entered_at, last_movement_at)
       SELECT user_id, $1, campaign_id, current_stage, score, entry_stage, source, entered_at, last_movement_at
         FROM lj_visitor_campaign_state
        WHERE user_id = $2 AND lj_visitor_id = $3
       ON CONFLICT (user_id, lj_visitor_id, campaign_id) DO NOTHING`,
      [survivorId, userId, deletedId]
    );
    await db.query(
      `DELETE FROM lj_visitor_campaign_state WHERE user_id = $1 AND lj_visitor_id = $2`,
      [userId, deletedId]
    );
    // Hotmart purchases: re-aponta (FK direta)
    await db.query(
      `UPDATE lj_hotmart_purchases SET lj_visitor_id = $1 WHERE user_id = $2 AND lj_visitor_id = $3`,
      [survivorId, userId, deletedId]
    ).catch(() => {}); // table pode não existir em tenants V33-

    // 3. Atualiza survivor com COALESCE + sums
    await db.query(
      `UPDATE lj_visitors SET
         email = COALESCE(email, $3),
         phone = COALESCE(phone, $4),
         name = COALESCE(name, $5),
         bank_id = COALESCE(bank_id, $6),
         total_value_cents = COALESCE(total_value_cents, 0) + COALESCE($7::bigint, 0),
         hotmart_purchase_count = COALESCE(hotmart_purchase_count, 0) + COALESCE($8::int, 0),
         global_score = GREATEST(COALESCE(global_score, 0), COALESCE($9::int, 0)),
         last_seen_at = GREATEST(last_seen_at, $10::timestamptz),
         external_rd_contact_id = COALESCE(external_rd_contact_id, $11),
         external_rd_deal_id = COALESCE(external_rd_deal_id, $12),
         updated_at = NOW()
       WHERE user_id = $1 AND lj_visitor_id = $2`,
      [
        userId, survivorId,
        deleted.email, deleted.phone, deleted.name,
        deleted.bank_id,
        deleted.total_value_cents, deleted.hotmart_purchase_count, deleted.global_score,
        deleted.last_seen_at,
        deleted.external_rd_contact_id, deleted.external_rd_deal_id
      ]
    );

    // 4. Aplica tag crossed-{matchSignal} no survivor
    const crossedTag = `lj-crossed-${matchSignal.replace(/[^a-z0-9-]/gi, '').toLowerCase()}`;
    await db.query(
      `INSERT INTO lj_visitor_tags (user_id, lj_visitor_id, tag, source, category)
         VALUES ($1, $2, $3, 'lj-motor', 'lj-native')
       ON CONFLICT (user_id, lj_visitor_id, tag) DO NOTHING`,
      [userId, survivorId, crossedTag]
    );
    await db.query(
      `INSERT INTO lj_tag_audit_log (user_id, lj_visitor_id, tag, action, source)
         VALUES ($1, $2, $3, 'added', 'lj-motor')`,
      [userId, survivorId, crossedTag]
    );

    // 5. Insert audit em lj_merges
    await db.query(
      `INSERT INTO lj_merges (user_id, survivor_visitor_id, deleted_visitor_id, match_signal, source_reason, details_json)
         VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, survivorId, deletedId, matchSignal, sourceReason, JSON.stringify(detailsSnapshot)]
    );

    // 6. Deleta o visitor "deleted"
    await db.query(
      `DELETE FROM lj_visitors WHERE user_id = $1 AND lj_visitor_id = $2`,
      [userId, deletedId]
    );

    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }

  return {
    survivorId,
    deletedId,
    matchSignal,
    sourceReason
  };
}

module.exports = { mergeVisitors, pickSurvivor };
