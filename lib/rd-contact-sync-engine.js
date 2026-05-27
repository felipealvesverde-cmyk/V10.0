// V34.7.a — Engine de sync LJ → RD CRM (contatos).
//
// Quando o LJ aprende info nova sobre um visitor (enriquecimento Djow, import
// com diff, edit manual), marca external_rd_sync_status='pending-contact-update'.
// Este worker varre os pending e empurra pro RD via PATCH /contacts/{id}.
//
// Reaproveita lições aprendidas em V34.6.x/y:
//   - URL legacy crm.rdstation.com/api/v1 com ?token=X query param
//   - Timeout 4s por call + AbortController
//   - Retry em 429 com backoff exponencial (3 tentativas)
//   - Logs detalhados de timing
//
// NÃO faz fetch RD se visitor não tem external_rd_contact_id (não está no RD).

const RD_API_BASE = 'https://crm.rdstation.com/api/v1';
const RD_CALL_TIMEOUT_MS = 4000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function rdFetch(path, token, options = {}) {
  const maxAttempts = options.skipRetry ? 1 : 3;
  let lastResp = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const sep = path.includes('?') ? '&' : '?';
    const url = `${RD_API_BASE}${path}${sep}token=${encodeURIComponent(token)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RD_CALL_TIMEOUT_MS);
    const startMs = Date.now();
    try {
      // V34.8.4 — Content-Type só quando há body. RD CRM legacy retorna
      // HTTP 400 "Request body could not be read properly" se receber GET
      // com Content-Type: application/json mas sem body.
      const headers = {
        'Accept': 'application/json',
        ...(options.headers || {})
      };
      const hasBody = options.body !== undefined;
      if (hasBody) headers['Content-Type'] = 'application/json';
      const init = {
        method: options.method || 'GET',
        headers,
        signal: controller.signal
      };
      if (hasBody) {
        init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      }
      const response = await fetch(url, init);
      const text = await response.text();
      const elapsedMs = Date.now() - startMs;
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
      lastResp = { ok: response.ok, status: response.status, data, elapsedMs };
      if (response.status === 429 && attempt < maxAttempts) {
        clearTimeout(timer);
        await sleep(attempt * 1000);
        continue;
      }
      console.log(`[rd-contact-sync] ${init.method} ${path} → ${response.status} (${elapsedMs}ms${attempt > 1 ? ` · tent ${attempt}` : ''})`);
      return lastResp;
    } catch (err) {
      const elapsedMs = Date.now() - startMs;
      if (err.name === 'AbortError') {
        lastResp = { ok: false, status: 408, data: null, error: `timeout`, elapsedMs };
        return lastResp;
      }
      lastResp = { ok: false, status: 0, data: null, error: err.message, elapsedMs };
      return lastResp;
    } finally {
      clearTimeout(timer);
    }
  }
  return lastResp;
}

// Marca visitor como precisando sincronizar com RD.
// Razões: 'import-diff' | 'enriched-djow' | 'manual-edit'
async function markForSync(db, userId, visitorId, reason = 'manual') {
  try {
    await db.query(
      `UPDATE lj_visitors SET
         external_rd_sync_status = 'pending-contact-update',
         external_rd_sync_error = $3,
         updated_at = NOW()
       WHERE user_id = $1 AND lj_visitor_id = $2
         AND external_rd_contact_id IS NOT NULL`,
      [userId, visitorId, String(reason).slice(0, 100)]
    );
  } catch (err) {
    console.error('[rd-contact-sync markForSync]', err.message);
  }
}

// Sincroniza UM visitor: PATCH /contacts/{external_rd_contact_id}
async function syncVisitor(db, userId, visitor, token) {
  const contactId = visitor.external_rd_contact_id;
  if (!contactId) {
    return { ok: false, status: 'skipped', error: 'sem external_rd_contact_id' };
  }
  const body = {
    contact: {}
  };
  if (visitor.name) body.contact.name = visitor.name;
  if (visitor.email) body.contact.emails = [{ email: visitor.email }];
  if (visitor.phone) body.contact.phones = [{ phone: visitor.phone, type: 'cellphone' }];
  if (Object.keys(body.contact).length === 0) {
    return { ok: false, status: 'skipped', error: 'nada pra atualizar' };
  }

  const r = await rdFetch(`/contacts/${encodeURIComponent(contactId)}`, token, {
    method: 'PATCH',
    body
  });
  if (r.ok) {
    await db.query(
      `UPDATE lj_visitors SET
         external_rd_sync_status = 'synced',
         external_rd_sync_error = NULL,
         external_rd_synced_at = NOW()
       WHERE user_id = $1 AND lj_visitor_id = $2`,
      [userId, visitor.lj_visitor_id]
    );
    return { ok: true, status: 'synced' };
  }
  if (r.status === 429) {
    // Já tentou 3x com backoff e ainda 429 — deixa pending pra próxima rodada
    return { ok: false, status: 'rate-limit', error: 'rate limit RD persistente' };
  }
  // Outras falhas: grava
  await db.query(
    `UPDATE lj_visitors SET
       external_rd_sync_status = 'failed',
       external_rd_sync_error = $3,
       external_rd_synced_at = NOW()
     WHERE user_id = $1 AND lj_visitor_id = $2`,
    [userId, visitor.lj_visitor_id, `HTTP ${r.status}: ${JSON.stringify(r.data || r.error).slice(0, 200)}`]
  );
  return { ok: false, status: 'failed', error: `HTTP ${r.status}` };
}

// Roda batch de sync. opts: { maxVisitors=50, dryRun=false }
async function runBatch(db, userId, token, opts = {}) {
  const max = Math.min(Number(opts.maxVisitors || 50), 200);
  const dryRun = Boolean(opts.dryRun);

  const r = await db.query(
    `SELECT lj_visitor_id, email, phone, name,
            external_rd_contact_id, external_rd_sync_error
       FROM lj_visitors
      WHERE user_id = $1
        AND external_rd_sync_status = 'pending-contact-update'
        AND external_rd_contact_id IS NOT NULL
      ORDER BY external_rd_synced_at ASC NULLS FIRST
      LIMIT $2`,
    [userId, max]
  );

  if (dryRun) {
    return { ok: true, dryRun: true, pendingTotal: r.rows.length, visitors: r.rows.map(v => v.lj_visitor_id) };
  }

  let synced = 0, failed = 0, rateLimit = 0;
  const errors = [];
  const PARALLEL_LIMIT = 3;
  for (let i = 0; i < r.rows.length; i += PARALLEL_LIMIT) {
    const slice = r.rows.slice(i, i + PARALLEL_LIMIT);
    const results = await Promise.allSettled(slice.map(v => syncVisitor(db, userId, v, token)));
    for (let j = 0; j < results.length; j++) {
      const res = results[j];
      if (res.status === 'fulfilled') {
        if (res.value.ok) synced++;
        else if (res.value.status === 'rate-limit') rateLimit++;
        else {
          failed++;
          if (errors.length < 5) errors.push({ visitor: slice[j].lj_visitor_id, error: res.value.error });
        }
      } else {
        failed++;
        if (errors.length < 5) errors.push({ visitor: slice[j].lj_visitor_id, error: String(res.reason).slice(0, 200) });
      }
    }
    // 500ms entre sub-batches pra dar respiro ao RD
    if (i + PARALLEL_LIMIT < r.rows.length) await sleep(500);
  }

  // V34.7.h.5 — pendingRemaining: quantos ainda têm depois deste batch.
  // Frontend usa pra montar loop + barra de progresso.
  let pendingRemaining = 0;
  try {
    const rc = await db.query(
      `SELECT COUNT(*)::int AS c
         FROM lj_visitors
        WHERE user_id = $1
          AND external_rd_sync_status = 'pending-contact-update'
          AND external_rd_contact_id IS NOT NULL`,
      [userId]
    );
    pendingRemaining = rc.rows[0]?.c || 0;
  } catch (err) {
    console.warn('[rd-contact-sync] pendingRemaining count falhou:', err.message);
  }

  return { ok: true, processed: r.rows.length, synced, failed, rateLimit, errors, pendingRemaining };
}

module.exports = { markForSync, syncVisitor, runBatch, rdFetch };
