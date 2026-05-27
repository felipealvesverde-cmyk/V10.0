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

const { rdFetch } = require('./rd-contact-sync-engine');

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

// Pull paginado do RD. Retorna array de contatos com updated_at > sinceIso.
// RD GET /contacts?limit=100&order=updated_at,desc&token=X
// Como o filtro server-side de updated_at é limitado, paramos quando passamos
// o cursor sinceIso.
async function pullUpdatedContacts(token, sinceIso, opts = {}) {
  const maxPages = opts.maxPages || 10;
  const limit = opts.limit || 100;
  const since = sinceIso ? asTs(sinceIso) : 0;
  const all = [];
  let page = 1;
  while (page <= maxPages) {
    const r = await rdFetch(`/contacts?limit=${limit}&order=updated_at,desc&page=${page}`, token, { method: 'GET' });
    if (!r.ok) {
      return { ok: false, error: `HTTP ${r.status}: ${(r.error || JSON.stringify(r.data || '')).slice(0, 200)}`, contacts: all };
    }
    const contacts = Array.isArray(r.data?.contacts) ? r.data.contacts : (Array.isArray(r.data) ? r.data : []);
    if (!contacts.length) break;
    let reachedSince = false;
    for (const c of contacts) {
      const cTs = asTs(c.updated_at);
      if (cTs < since) { reachedSince = true; break; }
      all.push(c);
    }
    if (reachedSince) break;
    if (contacts.length < limit) break;
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
async function runReconciliation(db, userId, token, opts = {}) {
  const maxPullPages = opts.maxPullPages || 10;
  const maxOrphans = opts.maxOrphans || 50;
  const startedAt = Date.now();

  // 1. Pega last_rd_pull_at do user
  const u = await db.query('SELECT last_rd_pull_at FROM users WHERE id = $1', [userId]);
  const sinceIso = u.rows[0]?.last_rd_pull_at?.toISOString?.() || null;

  // 2. Pull RD → LJ
  const pull = await pullUpdatedContacts(token, sinceIso, { maxPages: maxPullPages });
  let pulled = 0, applied = 0, alerts = 0, ljWon = 0, rdWon = 0, unmatched = 0;
  if (pull.ok) {
    for (const rdContact of pull.contacts) {
      pulled++;
      const ljVisitor = await resolveLjVisitor(db, userId, rdContact);
      if (!ljVisitor) {
        unmatched++;
        // Cria visitor novo no LJ? V34.8.0: NÃO — Felipe não pediu auto-criar
        // visitors do RD (só conciliar os que já estão de ambos lados).
        // Refinar em onda futura se ficar gargalo.
        continue;
      }
      const stats = await reconcileVisitor(db, userId, ljVisitor, rdContact);
      alerts += stats.alerts;
      rdWon += stats.rdWonFields;
      ljWon += stats.ljWonFields;
      if (stats.applied) applied++;
    }
  }

  // 3. Push órfãos LJ → RD (cria contato + grava ponte)
  const orphans = await listOrphans(db, userId, maxOrphans);
  let orphansCreated = 0, orphansFailed = 0;
  for (const o of orphans) {
    const r = await createOrphanInRd(db, userId, o, token);
    if (r.ok) orphansCreated++;
    else {
      orphansFailed++;
      // Marca como failed pra não tentar de novo na próxima rodada
      await db.query(
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

  // 4. Atualiza last_rd_pull_at
  await db.query('UPDATE users SET last_rd_pull_at = NOW() WHERE id = $1', [userId]);

  const elapsedMs = Date.now() - startedAt;
  return {
    ok: true,
    elapsedMs,
    pull: { ok: pull.ok, pulled, applied, alerts, ljWon, rdWon, unmatched, error: pull.error || null },
    orphans: { total: orphans.length, created: orphansCreated, failed: orphansFailed }
  };
}

module.exports = {
  runReconciliation,
  reconcileVisitor,
  pullUpdatedContacts,
  createOrphanInRd,
  listOrphans,
  resolveLjVisitor,
  recordAlert,
  COMPARED_FIELDS,
  CONFLICT_WINDOW_SEC
};
