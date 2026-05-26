// V34.0.0 — V34.3.a: Import batch de leads pro tenant DB.
//
// Quando o cliente importa CSV ou cola manual no Leads → Inserir leads,
// o frontend chama este endpoint pra persistir os leads em lj_visitors
// (entidade canônica V33+) com bank_id, tags automáticas e source.
//
// POST /api/leads-import-batch
// Body: {
//   bank_id: 5,  // obrigatório, valida ownership
//   source: 'mailing-csv' | 'mailing-manual',  // pra tag lj-source-X
//   leads: [{ email?, phone?, name?, tags?: [string], idade?, estado?, cidade?, ... }]
// }
//
// Resposta: { ok, created, updated, skipped, total, errors }
//
// Comportamento:
//   - Match por email exato (case-insensitive) ou phone normalizado → UPDATE bank_id + adiciona tags
//   - Sem match → INSERT novo visitor (entity_type='lead', current_stage='marketing-tof',
//     promoted_to_lead_at=NOW)
//   - Tags aplicadas em TODOS: lj-banco-{slug} + lj-source-{source} + tags do CSV (sem prefixo)
//   - Sem email NEM phone NEM name → skipped
//   - Atualiza bank.visitor_count no fim (re-conta)
//   - Audit em lj_tag_audit_log pra cada tag aplicada

const crypto = require('crypto');
const { mergeVisitors } = require('../lib/visitor-merge');

function normalizePhone(s) {
  return String(s || '').replace(/\D/g, '');
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
  if (!body || typeof body !== 'object') return res.status(400).json({ ok: false, message: 'Body inválido.' });

  const bankId = Number(body.bank_id || 0);
  const source = String(body.source || 'mailing-manual'); // 'mailing-csv' | 'mailing-manual'
  const leads = Array.isArray(body.leads) ? body.leads : [];

  if (!bankId) return res.status(400).json({ ok: false, message: 'bank_id obrigatório.' });
  if (!leads.length) return res.status(400).json({ ok: false, message: 'Nenhum lead pra importar.' });
  // V34.6.h — defense-in-depth: limit dura. Frontend faz chunks de 50.
  // Se algum cliente bypassa chunking, falha rápido em vez de timeout.
  if (leads.length > 100) {
    return res.status(400).json({
      ok: false,
      message: `Batch grande demais (${leads.length} leads). Limite: 100 por request. Frontend deve fazer chunking automático.`
    });
  }

  // Valida banco pertence ao user + pega slug
  let bankSlug = null;
  try {
    const bankCheck = await req.tenantDb.query(
      `SELECT slug FROM lj_lead_banks WHERE user_id = $1 AND id = $2`,
      [userId, bankId]
    );
    if (bankCheck.rows.length === 0) return res.status(404).json({ ok: false, message: 'Banco não encontrado.' });
    bankSlug = bankCheck.rows[0].slug;
  } catch (err) {
    console.error('[leads-import-batch] bank check err:', err);
    return res.status(500).json({ ok: false, message: 'Erro validando banco.' });
  }

  const bankTag = `lj-banco-${bankSlug}`;
  const sourceTag = `lj-source-${source.replace(/^lj-source-/, '')}`; // ex: lj-source-mailing-csv

  let created = 0, updated = 0, skipped = 0, merged = 0;
  const errors = [];
  const touchedVisitorIds = []; // V34.7.f.2 — track pra recalcular score depois

  for (const raw of leads) {
    const email = String(raw.email || '').trim().toLowerCase() || null;
    const phone = normalizePhone(raw.phone) || null;
    const name = String(raw.name || '').trim() || null;

    // Sem nenhum identificador → skip
    if (!email && !phone && !name) {
      skipped++;
      continue;
    }

    try {
      // V34.6.b — Match cross-signal:
      // 1. Acha visitor por email
      // 2. Acha visitor por phone
      // 3. Se os dois bateram em visitors DIFERENTES → merge antes de updatear
      //    (mantém o mais antigo via mergeVisitors)
      // 4. Senão usa o que bateu
      let byEmail = null, byPhone = null;
      if (email) {
        const r = await req.tenantDb.query(
          `SELECT id, lj_visitor_id, bank_id, email, phone, name, external_rd_contact_id FROM lj_visitors
           WHERE user_id = $1 AND LOWER(email) = $2 LIMIT 1`,
          [userId, email]
        );
        if (r.rows.length) byEmail = r.rows[0];
      }
      if (phone) {
        const r = await req.tenantDb.query(
          `SELECT id, lj_visitor_id, bank_id, email, phone, name, external_rd_contact_id FROM lj_visitors
           WHERE user_id = $1 AND phone = $2 LIMIT 1`,
          [userId, phone]
        );
        if (r.rows.length) byPhone = r.rows[0];
      }

      let existing = null;
      let crossMerged = false;
      if (byEmail && byPhone && byEmail.lj_visitor_id !== byPhone.lj_visitor_id) {
        // Cross-signal: cada sinal achou um visitor diferente. Funde antes.
        try {
          await mergeVisitors(req.tenantDb, userId, byEmail.lj_visitor_id, byPhone.lj_visitor_id, {
            matchSignal: 'cross-email-phone',
            sourceReason: 'import-batch'
          });
          merged++;
          crossMerged = true;
          // O survivor sobreviveu — re-fetch
          const sr = await req.tenantDb.query(
            `SELECT id, lj_visitor_id, bank_id, email, phone, name, external_rd_contact_id FROM lj_visitors
             WHERE user_id = $1 AND (LOWER(email) = $2 OR phone = $3) LIMIT 1`,
            [userId, email, phone]
          );
          if (sr.rows.length) existing = sr.rows[0];
        } catch (mErr) {
          console.error('[leads-import-batch] cross-merge falhou:', mErr);
          // Fallback: usa o byEmail (mais comum como chave única)
          existing = byEmail;
        }
      } else {
        existing = byEmail || byPhone;
      }

      let visitorId;
      let isNew = false;
      if (existing) {
        // UPDATE — atualiza bank_id + dados que estão null
        visitorId = existing.lj_visitor_id;
        await req.tenantDb.query(
          `UPDATE lj_visitors SET
             bank_id = $3,
             email = COALESCE(email, $4),
             phone = COALESCE(phone, $5),
             name = COALESCE(name, $6),
             entity_type = CASE WHEN entity_type = 'suspect' THEN 'lead' ELSE entity_type END,
             promoted_to_lead_at = COALESCE(promoted_to_lead_at, NOW()),
             updated_at = NOW()
           WHERE user_id = $1 AND lj_visitor_id = $2`,
          [userId, visitorId, bankId, email, phone, name]
        );
        updated++;
        touchedVisitorIds.push(visitorId);
        // V34.7.a — Se import trouxe info nova E visitor já existe no RD CRM,
        // marca pra sync de contact. Worker assíncrono empurra depois.
        const hasNewInfo = (email && !existing.email) || (phone && !existing.phone) || (name && !existing.name);
        const hasRdContact = Boolean(existing.external_rd_contact_id);
        if (hasNewInfo && hasRdContact) {
          try {
            const { markForSync } = require('../lib/rd-contact-sync-engine');
            await markForSync(req.tenantDb, userId, visitorId, 'import-diff');
          } catch (mErr) {
            console.error('[leads-import-batch] markForSync err:', mErr.message);
          }
        }
      } else {
        // INSERT novo visitor
        visitorId = `imp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        await req.tenantDb.query(
          `INSERT INTO lj_visitors
             (lj_visitor_id, user_id, bank_id, entity_type, current_stage, email, phone, name,
              promoted_to_lead_at, first_seen_at, last_seen_at)
           VALUES ($1, $2, $3, 'lead', 'marketing-tof', $4, $5, $6, NOW(), NOW(), NOW())`,
          [visitorId, userId, bankId, email, phone, name]
        );
        created++;
        touchedVisitorIds.push(visitorId);
      }

      // Aplica tags: banco + source + tags do CSV (se existirem) + crossed se updateou
      const tagsToApply = [
        { tag: bankTag, source: 'import-csv', category: 'lj-native' },
        { tag: sourceTag, source: 'import-csv', category: 'lj-native' }
      ];
      // V34.6.b — Update em visitor existente vira "cruzamento": aplica tag de audit visual.
      if (!isNew) {
        tagsToApply.push({ tag: 'lj-crossed-import-csv', source: 'lj-motor', category: 'lj-native' });
      }
      if (Array.isArray(raw.tags)) {
        for (const t of raw.tags) {
          const tagStr = String(t || '').trim();
          if (!tagStr || tagStr.startsWith('lj-')) continue; // namespace lj- protegido
          tagsToApply.push({ tag: tagStr, source: 'import-csv', category: 'rd-manual' });
        }
      }

      for (const { tag, source: tagSource, category } of tagsToApply) {
        await req.tenantDb.query(
          `INSERT INTO lj_visitor_tags (user_id, lj_visitor_id, tag, source, category)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, lj_visitor_id, tag) DO NOTHING`,
          [userId, visitorId, tag, tagSource, category]
        );
        // Audit log da adição
        await req.tenantDb.query(
          `INSERT INTO lj_tag_audit_log (user_id, lj_visitor_id, tag, action, source)
           VALUES ($1, $2, $3, 'added', $4)`,
          [userId, visitorId, tag, tagSource]
        );
      }

      // Transition de criação (audit)
      if (isNew) {
        await req.tenantDb.query(
          `INSERT INTO lj_transitions
            (lj_visitor_id, user_id, from_entity, to_entity, from_stage, to_stage, source, raw_payload)
           VALUES ($1, $2, NULL, 'lead', NULL, 'marketing-tof', 'import-csv', $3)`,
          [visitorId, userId, JSON.stringify({ bank_id: bankId, source })]
        );
      }
    } catch (err) {
      console.error('[leads-import-batch] lead err:', err);
      errors.push({ email, phone, error: err.message });
      skipped++;
    }
  }

  // Atualiza visitor_count do banco (re-conta com COUNT)
  try {
    await req.tenantDb.query(
      `UPDATE lj_lead_banks
         SET visitor_count = (SELECT COUNT(*) FROM lj_visitors WHERE user_id = $1 AND bank_id = $2),
             updated_at = NOW()
       WHERE user_id = $1 AND id = $2`,
      [userId, bankId]
    );
  } catch (err) {
    console.error('[leads-import-batch] visitor_count update err:', err);
  }

  // V34.7.f.2 — Recalcula score dos visitors afetados (criados ou
  // atualizados). PARALLEL=3 pra não saturar DB. Erros logam mas não
  // falham o request (cron daily recalcula tudo eventualmente).
  try {
    const { applyEvent } = require('../lib/score-engine');
    const PARALLEL = 3;
    for (let i = 0; i < touchedVisitorIds.length; i += PARALLEL) {
      const slice = touchedVisitorIds.slice(i, i + PARALLEL);
      await Promise.allSettled(slice.map(vid =>
        applyEvent(req.tenantDb, userId, vid, { source: 'import-batch' })
      ));
    }
  } catch (err) {
    console.error('[leads-import-batch] score recalc err:', err.message);
  }

  return res.status(200).json({
    ok: true,
    created,
    updated,
    skipped,
    merged,                        // V34.6.b — quantos pares cross-signal foram fundidos antes de updatear
    total: leads.length,
    errors: errors.slice(0, 10)
  });
};
