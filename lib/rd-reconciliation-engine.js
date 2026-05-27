// V34.8.0 — Motor de conciliação RD ↔ LJ bidirecional.
//
// Filosofia: nem RD nem LJ é fonte da verdade. Os dois contribuem, motor reconcilia.
//
// 3 caminhos numa rodada:
//   1. Pull RD → LJ: pega contatos atualizados no RD desde last_rd_pull_at.
//      Pra cada um: compara campo a campo (name, phone, email).
//        - RD mais novo → atualiza LJ
//        - LJ mais novo → marca pending-contact-update (será empurrado depois)
//        - Empate / conflito real → cria alerta em lj_reconciliation_alerts
//   2. Push órfãos: visitors sem external_rd_contact_id ganham contato no RD.
//      RD retorna ID, LJ guarda. Cria a "ponte" pra próxima rodada.
//   3. Push pending: visitors marcados em (1) ou via UI (alpha49) viram PATCH /contacts/{id}.
//      Reusa o engine existente (rd-contact-sync-engine.runBatch).

const { rdFetch, runBatch: runPushBatch } = require('./rd-contact-sync-engine');

const COMPARED_FIELDS = ['name', 'phone', 'email'];
// Janela em segundos: se RD e LJ foram editados dentro deste delta E têm
// valores diferentes, vira conflito (sininho). Default: 60s.
const CONFLICT_WINDOW_SEC = 60;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function asTs(v) { return v ? new Date(v).getTime() : 0; }

// Extrai o valor de um campo do payload do RD CRM (formato variável).
function extractRdFieldValue(rdContact, field) {
  if (!rdContact) return null;
  if (field === 'name') return rdContact.name || null;
  if (field === 'email') {
    const e = Array.isArray(rdContact.emails) ? rdContact.emails[0] : null;
    return e?.email || rdContact.email || null;
  }
  if (field === 'phone') {
    const p = Array.isArray(rdContact.phones) ? rdContact.phones[0] : null;
    return p?.phone || rdContact.phone || null;
  }
  return null;
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

// Pull paginado do RD. GET /contacts?limit=N&page=P&token=X
// V34.8.5 — Removido `order=updated_at,desc` da query: o RD CRM legacy
// retorna HTTP 400 "Request body could not be read properly" com esse param.
// Ordem default do RD é por created_at ASC (ou id). Sem order incremental
// confiável, paginamos até maxPages OR has_more=false e filtramos no client
// por updated_at > since.
async function pullUpdatedContacts(token, sinceIso, opts = {}) {
  const maxPages = opts.maxPages || 10;
  const limit = opts.limit || 100;
  const since = sinceIso ? asTs(sinceIso) : 0;
  const all = [];
  let page = 1;
  while (page <= maxPages) {
    const r = await rdFetch(`/contacts?limit=${limit}&page=${page}`, token, { method: 'GET' });
    if (!r.ok) {
      return { ok: false, error: `HTTP ${r.status}: ${(r.error || JSON.stringify(r.data || '')).slice(0, 200)}`, contacts: all };
    }
    const contacts = Array.isArray(r.data?.contacts) ? r.data.contacts : (Array.isArray(r.data) ? r.data : []);
    if (!contacts.length) break;
    // Filtra no client: só os atualizados após since
    for (const c of contacts) {
      const cTs = asTs(c.updated_at);
      if (cTs >= since) all.push(c);
    }
    // Para se has_more=false (RD avisa) OR retornou menos que limit
    const hasMore = (r.data && typeof r.data === 'object') ? Boolean(r.data.has_more) : (contacts.length === limit);
    if (!hasMore) break;
    page++;
    await sleep(150);
  }
  return { ok: true, contacts: all };
}

// Resolve visitor LJ a partir do contato RD: primeiro por external_rd_contact_id,
// depois por email.
async function resolveLjVisitor(db, userId, rdContact) {
  const rdId = rdContact?.id ? String(rdContact.id) : null;
  if (rdId) {
    const r = await db.query(
      `SELECT lj_visitor_id, name, phone, email, external_rd_contact_id, updated_at
         FROM lj_visitors WHERE user_id = $1 AND external_rd_contact_id = $2 LIMIT 1`,
      [userId, rdId]
    );
    if (r.rows.length) return r.rows[0];
  }
  const email = extractRdFieldValue(rdContact, 'email');
  if (email) {
    const r = await db.query(
      `SELECT lj_visitor_id, name, phone, email, external_rd_contact_id, updated_at
         FROM lj_visitors WHERE user_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1`,
      [userId, email]
    );
    if (r.rows.length) return r.rows[0];
  }
  return null;
}

async function recordAlert(db, userId, ljVisitorId, field, ljValue, rdValue, ljTs, rdTs) {
  try {
    // Dedupe: não cria alerta duplicado pra mesmo (visitor, field) ainda não resolvido
    const existing = await db.query(
      `SELECT id FROM lj_reconciliation_alerts
        WHERE user_id = $1 AND lj_visitor_id = $2 AND field = $3 AND resolved_at IS NULL
        LIMIT 1`,
      [userId, ljVisitorId, field]
    );
    if (existing.rows.length) {
      await db.query(
        `UPDATE lj_reconciliation_alerts
            SET lj_value = $2, rd_value = $3, lj_updated_at = $4, rd_updated_at = $5, detected_at = NOW()
          WHERE id = $1`,
        [existing.rows[0].id, ljValue, rdValue, ljTs, rdTs]
      );
      return existing.rows[0].id;
    }
    const r = await db.query(
      `INSERT INTO lj_reconciliation_alerts
         (user_id, lj_visitor_id, field, lj_value, rd_value, lj_updated_at, rd_updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [userId, ljVisitorId, field, ljValue, rdValue, ljTs, rdTs]
    );
    return r.rows[0].id;
  } catch (err) {
    console.warn('[reconciliation recordAlert]', err.message);
    return null;
  }
}

// Concilia 1 visitor com 1 contato RD. Atualiza LJ direto / marca pending /
// cria alerta conforme o caso. Retorna stats da reconciliação.
async function reconcileVisitor(db, userId, ljVisitor, rdContact) {
  const ljTs = asTs(ljVisitor.updated_at);
  const rdTs = asTs(rdContact.updated_at);
  const updates = {};
  let alerts = 0;
  let rdWonFields = 0;
  let ljWonFields = 0;

  for (const field of COMPARED_FIELDS) {
    const ljVal = ljVisitor[field];
    const rdVal = extractRdFieldValue(rdContact, field);
    if (normalize(ljVal) === normalize(rdVal)) continue; // iguais

    // Pelo menos um lado tem valor, e são diferentes
    const deltaSec = Math.abs(ljTs - rdTs) / 1000;
    const isConflict = ljTs && rdTs && deltaSec <= CONFLICT_WINDOW_SEC;
    if (isConflict) {
      await recordAlert(db, userId, ljVisitor.lj_visitor_id, field, ljVal, rdVal, ljTs ? new Date(ljTs) : null, rdTs ? new Date(rdTs) : null);
      alerts++;
      continue;
    }
    if (rdTs > ljTs) {
      // RD mais novo → atualiza LJ
      updates[field] = rdVal;
      rdWonFields++;
    } else {
      // LJ mais novo (ou RD sem timestamp) → marca pra empurrar depois
      ljWonFields++;
    }
  }

  // Garante ponte salva se não tinha
  const rdId = rdContact.id ? String(rdContact.id) : null;
  if (rdId && !ljVisitor.external_rd_contact_id) {
    updates.external_rd_contact_id = rdId;
  }

  if (Object.keys(updates).length) {
    const sets = [];
    const params = [userId, ljVisitor.lj_visitor_id];
    let idx = 3;
    for (const [col, val] of Object.entries(updates)) {
      sets.push(`${col} = $${idx++}`);
      params.push(val);
    }
    sets.push(`updated_at = NOW()`);
    await db.query(
      `UPDATE lj_visitors SET ${sets.join(', ')} WHERE user_id = $1 AND lj_visitor_id = $2`,
      params
    );
  }

  if (ljWonFields > 0) {
    // Marca pendente — o sync push (rd-contact-sync-run / cron) cuida depois
    await db.query(
      `UPDATE lj_visitors SET
         external_rd_sync_status = 'pending-contact-update',
         external_rd_sync_error = 'reconcile:lj-newer',
         updated_at = NOW()
       WHERE user_id = $1 AND lj_visitor_id = $2 AND external_rd_contact_id IS NOT NULL`,
      [userId, ljVisitor.lj_visitor_id]
    );
  }

  return { alerts, rdWonFields, ljWonFields, applied: Object.keys(updates).length };
}

// V34.9.3.5 — Tenta vincular contato a deal no RD via PATCH /deals/{id}.
// Diagnóstico real (rd-debug-deal-link) mostrou:
//   - POST /deals/{id}/contacts → 404 Page not found (não existe na API legacy)
//   - PATCH /deals/{id} body { deal: { contacts: [{id}] } } → 200 OK mas contacts
//     fica NULL no GET seguinte (RD aceita mas ignora silenciosamente)
//
// Conclusão: API legacy do RD CRM não permite vincular contato a deal post-creation.
// Fazemos a chamada PATCH pra registrar tentativa, marcamos deal_linked_at=NOW()
// pra não retry infinito. O efeito visual é resolvido pelo renameDealInRd: o
// card no kanban passa a mostrar o nome do contato no lugar de "Lead sem nome".
async function linkContactToDeal(db, userId, ljVisitor, token) {
  const dealId = ljVisitor.external_rd_deal_id;
  const contactId = ljVisitor.external_rd_contact_id;
  if (!dealId || !contactId) return { ok: false, error: 'sem deal_id ou contact_id' };

  const r = await rdFetch(`/deals/${encodeURIComponent(dealId)}`, token, {
    method: 'PATCH',
    body: { deal: { contacts: [{ id: contactId }] } }
  });
  // 200/409/422 → marca como tentado (mesmo que RD ignore o campo silenciosamente)
  if (r.ok || r.status === 409 || r.status === 422) {
    await db.query(
      `UPDATE lj_visitors SET external_rd_deal_linked_at = NOW(), updated_at = NOW()
        WHERE user_id = $1 AND lj_visitor_id = $2`,
      [userId, ljVisitor.lj_visitor_id]
    );
    return { ok: true, note: r.ok ? 'patch-ok-may-not-persist' : `treated-as-linked-${r.status}` };
  }
  return { ok: false, status: r.status, error: `HTTP ${r.status}: ${(r.error || JSON.stringify(r.data || '')).slice(0, 200)}` };
}

// V34.9.0 — Atualiza nome do deal no RD. PATCH /deals/{id} body { deal: { name } }
async function renameDealInRd(db, userId, ljVisitor, token) {
  const dealId = ljVisitor.external_rd_deal_id;
  const name = String(ljVisitor.name || '').trim();
  if (!dealId) return { ok: false, error: 'sem deal_id' };
  if (!name) return { ok: false, error: 'visitor sem name' };

  const r = await rdFetch(`/deals/${encodeURIComponent(dealId)}`, token, {
    method: 'PATCH',
    body: { deal: { name } }
  });
  if (r.ok) {
    await db.query(
      `UPDATE lj_visitors SET external_rd_deal_renamed_at = NOW(), updated_at = NOW()
        WHERE user_id = $1 AND lj_visitor_id = $2`,
      [userId, ljVisitor.lj_visitor_id]
    );
    return { ok: true };
  }
  return { ok: false, status: r.status, error: `HTTP ${r.status}: ${(r.error || JSON.stringify(r.data || '')).slice(0, 200)}` };
}

// V34.9.0 — Lista visitors que precisam de deal enrichment (link OR rename pendente).
// Filtra quem tem deal_id E (link pendente OU rename pendente AND name não-placeholder).
async function listDealsToEnrich(db, userId, maxVisitors) {
  const r = await db.query(
    `SELECT lj_visitor_id, name, email, external_rd_contact_id, external_rd_deal_id,
            external_rd_deal_linked_at, external_rd_deal_renamed_at
       FROM lj_visitors
      WHERE user_id = $1
        AND external_rd_deal_id IS NOT NULL
        AND (
              (external_rd_contact_id IS NOT NULL AND external_rd_deal_linked_at IS NULL)
              OR external_rd_deal_renamed_at IS NULL
            )
        AND name IS NOT NULL AND name <> ''
        AND LOWER(TRIM(name)) NOT IN ('lead sem nome', 'sem nome', '(sem nome)', 'lead', '-')
      ORDER BY updated_at DESC NULLS LAST
      LIMIT $2`,
    [userId, maxVisitors]
  );
  return r.rows;
}

// Cria contato no RD pra um visitor órfão (sem external_rd_contact_id).
async function createOrphanInRd(db, userId, ljVisitor, token) {
  const body = { contact: {} };
  if (ljVisitor.name) body.contact.name = ljVisitor.name;
  if (ljVisitor.email) body.contact.emails = [{ email: ljVisitor.email }];
  if (ljVisitor.phone) body.contact.phones = [{ phone: ljVisitor.phone, type: 'cellphone' }];
  if (!body.contact.name && !body.contact.emails) {
    return { ok: false, error: 'sem nome nem email' };
  }
  const r = await rdFetch('/contacts', token, { method: 'POST', body });
  if (!r.ok) {
    return { ok: false, error: `HTTP ${r.status}: ${(r.error || JSON.stringify(r.data || '')).slice(0, 200)}` };
  }
  const newId = r.data?.id || r.data?.contact?.id;
  if (!newId) return { ok: false, error: 'RD não retornou id' };

  await db.query(
    `UPDATE lj_visitors SET
       external_rd_contact_id = $3,
       external_rd_sync_status = 'synced',
       external_rd_sync_error = NULL,
       external_rd_synced_at = NOW(),
       updated_at = NOW()
     WHERE user_id = $1 AND lj_visitor_id = $2`,
    [userId, ljVisitor.lj_visitor_id, String(newId)]
  );
  return { ok: true, contactId: String(newId) };
}

// Lista órfãos do user, limitado a maxVisitors.
async function listOrphans(db, userId, maxVisitors) {
  const r = await db.query(
    `SELECT lj_visitor_id, name, email, phone
       FROM lj_visitors
      WHERE user_id = $1
        AND external_rd_contact_id IS NULL
        AND (email IS NOT NULL OR phone IS NOT NULL OR name IS NOT NULL)
      ORDER BY updated_at DESC NULLS LAST
      LIMIT $2`,
    [userId, maxVisitors]
  );
  return r.rows;
}

// Rodada completa pra um user. Chamada pelo cron OU sob demanda.
//
// V34.8.0.1 — recebe AMBOS: masterDb (pra users.last_rd_pull_at, que vive no
// control plane) e tenantDb (pra lj_visitors + lj_reconciliation_alerts, que
// vivem no Postgres do tenant — pode ser o mesmo masterDb se user usa o pool
// default, ou outro se plugou DB próprio via "Meu Banco").
async function runReconciliation(masterDb, tenantDb, userId, token, opts = {}) {
  const maxPullPages = opts.maxPullPages || 10;
  const maxOrphans = opts.maxOrphans || 50;
  const startedAt = Date.now();

  // 1. Pega last_rd_pull_at do user (control plane). force_full ignora.
  let sinceIso = null;
  if (!opts.forceFull) {
    const u = await masterDb.query('SELECT last_rd_pull_at FROM users WHERE id = $1', [userId]);
    sinceIso = u.rows[0]?.last_rd_pull_at?.toISOString?.() || null;
  }

  // 2. Pull RD → LJ (atualizações no tenant DB)
  const pull = await pullUpdatedContacts(token, sinceIso, { maxPages: maxPullPages });
  let pulled = 0, applied = 0, alerts = 0, ljWon = 0, rdWon = 0, unmatched = 0;
  if (pull.ok) {
    for (const rdContact of pull.contacts) {
      pulled++;
      const ljVisitor = await resolveLjVisitor(tenantDb, userId, rdContact);
      if (!ljVisitor) {
        unmatched++;
        // Cria visitor novo no LJ? V34.8.0: NÃO — Felipe não pediu auto-criar
        // visitors do RD (só conciliar os que já estão de ambos lados).
        continue;
      }
      const stats = await reconcileVisitor(tenantDb, userId, ljVisitor, rdContact);
      alerts += stats.alerts;
      rdWon += stats.rdWonFields;
      ljWon += stats.ljWonFields;
      if (stats.applied) applied++;
    }
  }

  // 2.5 — Push pending: visitors com external_rd_sync_status='pending-contact-update'
  // são empurrados via PATCH /contacts/{id}. Inclui:
  //   - Visitors que o pull marcou como "LJ mais novo"
  //   - Visitors marcados antes via enrich / edit manual / leads-impute
  // V34.8.3 FIX: sem isso o motor só preparava o trabalho mas não empurrava.
  let pushedSynced = 0, pushedFailed = 0, pushedRateLimit = 0;
  try {
    const pushResult = await runPushBatch(tenantDb, userId, token, { maxVisitors: 200 });
    if (pushResult.ok) {
      pushedSynced = pushResult.synced || 0;
      pushedFailed = pushResult.failed || 0;
      pushedRateLimit = pushResult.rateLimit || 0;
    }
  } catch (err) {
    console.warn('[runReconciliation] push pending falhou:', err.message);
  }

  // 2.7 — Deal enrichment: pra visitors com deal_id, vincula contato↔deal
  // e atualiza nome do deal. Resolve o caso comum (visto na V34.9.0): leads
  // criados via leads-impute-rd-push antigo criavam deals "Lead sem nome — MVP"
  // sem contato vinculado, mesmo quando o LJ tinha o contato salvo.
  let dealsLinked = 0, dealsRenamed = 0, dealsFailed = 0;
  try {
    const dealsToEnrich = await listDealsToEnrich(tenantDb, userId, Math.min(maxOrphans, 100));
    for (const v of dealsToEnrich) {
      // Link contato↔deal (se pendente)
      if (!v.external_rd_deal_linked_at && v.external_rd_contact_id) {
        const linkRes = await linkContactToDeal(tenantDb, userId, v, token);
        if (linkRes.ok) dealsLinked++;
        else dealsFailed++;
      }
      // Rename do deal (se pendente)
      if (!v.external_rd_deal_renamed_at && v.name) {
        const renameRes = await renameDealInRd(tenantDb, userId, v, token);
        if (renameRes.ok) dealsRenamed++;
        else dealsFailed++;
      }
      await sleep(200);
    }
  } catch (err) {
    console.warn('[runReconciliation] deal enrichment falhou:', err.message);
  }

  // 3. Push órfãos LJ → RD (cria contato + grava ponte)
  const orphans = await listOrphans(tenantDb, userId, maxOrphans);
  let orphansCreated = 0, orphansFailed = 0;
  for (const o of orphans) {
    const r = await createOrphanInRd(tenantDb, userId, o, token);
    if (r.ok) orphansCreated++;
    else {
      orphansFailed++;
      // Marca como failed pra não tentar de novo na próxima rodada
      await tenantDb.query(
        `UPDATE lj_visitors SET
           external_rd_sync_status = 'failed',
           external_rd_sync_error = $3,
           external_rd_synced_at = NOW()
         WHERE user_id = $1 AND lj_visitor_id = $2`,
        [userId, o.lj_visitor_id, `orphan-create: ${r.error}`.slice(0, 200)]
      );
    }
    await sleep(200);
  }

  // 4. Atualiza last_rd_pull_at SÓ se o pull deu certo. Senão preserva o
  // cursor antigo pra próxima rodada poder tentar de novo. Bug observado em
  // V34.8.0-5: cursor avançava mesmo em falha, eternizando o estado "vazio".
  if (pull.ok) {
    await masterDb.query('UPDATE users SET last_rd_pull_at = NOW() WHERE id = $1', [userId]);
  }

  // V34.9.1 — Counts restantes pro frontend saber se precisa continuar o loop.
  let dealsRemaining = 0, orphansRemaining = 0, pendingRemaining = 0;
  try {
    const r = await tenantDb.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE external_rd_deal_id IS NOT NULL
             AND (
                   (external_rd_contact_id IS NOT NULL AND external_rd_deal_linked_at IS NULL)
                   OR external_rd_deal_renamed_at IS NULL
                 )
             AND name IS NOT NULL AND name <> ''
             AND LOWER(TRIM(name)) NOT IN ('lead sem nome', 'sem nome', '(sem nome)', 'lead', '-')
         )::int AS deals_remaining,
         COUNT(*) FILTER (
           WHERE external_rd_contact_id IS NULL
             AND (email IS NOT NULL OR phone IS NOT NULL OR name IS NOT NULL)
         )::int AS orphans_remaining,
         COUNT(*) FILTER (WHERE external_rd_sync_status = 'pending-contact-update')::int AS pending_remaining
       FROM lj_visitors WHERE user_id = $1`,
      [userId]
    );
    dealsRemaining = r.rows[0]?.deals_remaining || 0;
    orphansRemaining = r.rows[0]?.orphans_remaining || 0;
    pendingRemaining = r.rows[0]?.pending_remaining || 0;
  } catch (err) {
    console.warn('[runReconciliation] remaining counts falhou:', err.message);
  }

  const elapsedMs = Date.now() - startedAt;
  return {
    ok: true,
    elapsedMs,
    pull: { ok: pull.ok, pulled, applied, alerts, ljWon, rdWon, unmatched, error: pull.error || null },
    push: { synced: pushedSynced, failed: pushedFailed, rateLimit: pushedRateLimit },
    deals: { linked: dealsLinked, renamed: dealsRenamed, failed: dealsFailed },
    orphans: { total: orphans.length, created: orphansCreated, failed: orphansFailed },
    remaining: { deals: dealsRemaining, orphans: orphansRemaining, pending: pendingRemaining }
  };
}

module.exports = {
  runReconciliation,
  reconcileVisitor,
  pullUpdatedContacts,
  createOrphanInRd,
  linkContactToDeal,
  renameDealInRd,
  listDealsToEnrich,
  listOrphans,
  resolveLjVisitor,
  recordAlert,
  COMPARED_FIELDS,
  CONFLICT_WINDOW_SEC
};
