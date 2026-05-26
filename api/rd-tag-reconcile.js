// V34.0.0 — V34.6.e: Pull diário reconciliador de tags RD ↔ lj_visitor_tags.
//
// Safety net pro webhook (V34.6.c) que pode perder eventos por downtime,
// network glitch, ou RD throttling. Roda 1x/dia (ou sob demanda) e:
//   1. Pra cada user com crm_pat conectado:
//   2. Pra cada visitor desse user com external_rd_contact_id:
//   3. Lê tags atuais do RD via GET /contacts/{id}
//   4. Compara com lj_visitor_tags WHERE source IN ('rd-webhook', 'rd-pull-sync')
//   5. Adiciona faltantes (INSERT) e remove órfãs (DELETE), com audit
//
// POST /api/rd-tag-reconcile
// Auth (uma das duas):
//   - JWT do master (req.user.isMaster)
//   - Header X-Cron-Token igual a env CRON_RECONCILE_TOKEN (cron externo)
// Body opcional:
//   { user_id: 5,         // scope a um user só (debug)
//     max_visitors: 100,  // limite por run (default 100, max 1000)
//     dry_run: true       // não escreve, só conta o que mudaria
//   }
//
// Resposta:
//   { ok, usersProcessed, visitorsProcessed, tagsAdded, tagsRemoved,
//     dryRun, errors: [...] }

const { getRdCredential } = require('../lib/rd-credentials');
const tenantPoolHelper = require('../lib/tenant-pool');

const RD_API_BASE = 'https://api.rd.services/crm/v1';
const RATE_DELAY_MS = 100; // 10 calls/sec, bem abaixo do limit RD

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function rdFetch(path, token) {
  const r = await fetch(`${RD_API_BASE}${path}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    }
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  return { ok: r.ok, status: r.status, data };
}

function authorize(req) {
  // Master JWT OR cron token
  if (req.user?.isMaster) return { ok: true, source: 'master' };
  const cronToken = process.env.CRON_RECONCILE_TOKEN;
  if (cronToken) {
    const provided = req.headers['x-cron-token'] || req.query?.cron_token;
    if (provided && String(provided) === cronToken) return { ok: true, source: 'cron-token' };
  }
  return { ok: false };
}

async function reconcileVisitorTags(tenantDb, userId, ljVisitorId, rdContactId, token, opts) {
  const dryRun = Boolean(opts.dryRun);
  const stats = { added: 0, removed: 0, errors: [] };

  // 1. Tags atuais no RD
  const r = await rdFetch(`/contacts/${encodeURIComponent(rdContactId)}`, token);
  if (!r.ok) {
    stats.errors.push({ visitor: ljVisitorId, error: `RD HTTP ${r.status}` });
    return stats;
  }
  const contact = r.data?.contact || r.data || {};
  const rdTags = new Set(
    (Array.isArray(contact.tags) ? contact.tags : [])
      .map(t => String(t || '').trim())
      .filter(t => t && !t.startsWith('lj-'))  // namespace lj- nunca vem do RD
  );

  // 2. Tags atuais no LJ pra esse visitor (só fontes RD)
  const ljRes = await tenantDb.query(
    `SELECT tag FROM lj_visitor_tags
       WHERE user_id = $1 AND lj_visitor_id = $2
         AND source IN ('rd-webhook', 'rd-pull-sync')`,
    [userId, ljVisitorId]
  );
  const ljTags = new Set(ljRes.rows.map(row => row.tag));

  // 3. Diff
  const toAdd = [...rdTags].filter(t => !ljTags.has(t));
  const toRemove = [...ljTags].filter(t => !rdTags.has(t));

  if (dryRun) {
    stats.added = toAdd.length;
    stats.removed = toRemove.length;
    return stats;
  }

  // 4. Aplica
  for (const tag of toAdd) {
    try {
      await tenantDb.query(
        `INSERT INTO lj_visitor_tags (user_id, lj_visitor_id, tag, source, category)
           VALUES ($1, $2, $3, 'rd-pull-sync', 'rd-auto')
         ON CONFLICT (user_id, lj_visitor_id, tag) DO NOTHING`,
        [userId, ljVisitorId, tag]
      );
      await tenantDb.query(
        `INSERT INTO lj_tag_audit_log (user_id, lj_visitor_id, tag, action, source)
           VALUES ($1, $2, $3, 'added', 'rd-pull-sync')`,
        [userId, ljVisitorId, tag]
      );
      stats.added++;
    } catch (err) {
      stats.errors.push({ visitor: ljVisitorId, tag, error: err.message });
    }
  }
  for (const tag of toRemove) {
    try {
      const del = await tenantDb.query(
        `DELETE FROM lj_visitor_tags
           WHERE user_id = $1 AND lj_visitor_id = $2 AND tag = $3
             AND source IN ('rd-webhook', 'rd-pull-sync')
           RETURNING tag`,
        [userId, ljVisitorId, tag]
      );
      if (del.rows.length) {
        await tenantDb.query(
          `INSERT INTO lj_tag_audit_log (user_id, lj_visitor_id, tag, action, source)
             VALUES ($1, $2, $3, 'removed', 'rd-pull-sync')`,
          [userId, ljVisitorId, tag]
        );
        stats.removed++;
      }
    } catch (err) {
      stats.errors.push({ visitor: ljVisitorId, tag, error: err.message });
    }
  }
  return stats;
}

async function reconcileUser(controlPlaneDb, userId, opts) {
  const result = { userId, visitorsProcessed: 0, tagsAdded: 0, tagsRemoved: 0, errors: [] };

  // Resolve tenant DB
  let tenantDb = controlPlaneDb;
  try {
    const userRow = await controlPlaneDb.query('SELECT default_tenant_id FROM users WHERE id = $1', [userId]);
    if (!userRow.rows.length) { result.errors.push({ error: 'user not found' }); return result; }
    const tenantId = userRow.rows[0].default_tenant_id;
    if (tenantId) {
      const pool = await tenantPoolHelper.getTenantPool(controlPlaneDb, tenantId);
      if (pool) tenantDb = pool;
    }
  } catch (err) {
    result.errors.push({ error: `tenant resolve: ${err.message}` });
    return result;
  }

  // Lê crm_pat
  let token = null;
  try {
    const cred = await getRdCredential(tenantDb, userId, 'crm_pat');
    token = cred?.token;
  } catch (_) { /* sem crm_pat — skip */ }
  if (!token) return result;

  // Lista visitors com external_rd_contact_id (limit pra controlar custo)
  const max = Math.min(Number(opts.maxVisitors || 100), 1000);
  const visRes = await tenantDb.query(
    `SELECT lj_visitor_id, external_rd_contact_id FROM lj_visitors
       WHERE user_id = $1 AND external_rd_contact_id IS NOT NULL
       ORDER BY external_rd_synced_at ASC NULLS FIRST
       LIMIT $2`,
    [userId, max]
  );

  for (const v of visRes.rows) {
    const stats = await reconcileVisitorTags(tenantDb, userId, v.lj_visitor_id, v.external_rd_contact_id, token, opts);
    result.visitorsProcessed++;
    result.tagsAdded += stats.added;
    result.tagsRemoved += stats.removed;
    if (stats.errors.length) result.errors.push(...stats.errors);
    if (RATE_DELAY_MS > 0) await sleep(RATE_DELAY_MS);
  }
  return result;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });

  const auth = authorize(req);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Não autorizado (master JWT OU X-Cron-Token).' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  const scopeUserId = Number(body.user_id || 0);
  const maxVisitors = Number(body.max_visitors || 100);
  const dryRun = Boolean(body.dry_run);

  // Lista de users a processar
  let userIds = [];
  try {
    if (scopeUserId > 0) {
      userIds = [scopeUserId];
    } else {
      // Acha todos os users com crm_pat conectado (varre todos tenants ativos)
      // Otimização possível: ter tabela master users_with_rd. Por ora, varre.
      const r = await req.db.query('SELECT id FROM users WHERE is_approved = true ORDER BY id');
      userIds = r.rows.map(row => row.id);
    }
  } catch (err) {
    return res.status(500).json({ ok: false, message: `list users: ${err.message}` });
  }

  let usersProcessed = 0;
  let visitorsProcessed = 0;
  let tagsAdded = 0;
  let tagsRemoved = 0;
  const errors = [];

  for (const uid of userIds) {
    const r = await reconcileUser(req.db, uid, { maxVisitors, dryRun });
    if (r.visitorsProcessed > 0) usersProcessed++;
    visitorsProcessed += r.visitorsProcessed;
    tagsAdded += r.tagsAdded;
    tagsRemoved += r.tagsRemoved;
    if (r.errors.length) errors.push({ userId: uid, errors: r.errors.slice(0, 5) });
  }

  return res.status(200).json({
    ok: true,
    dryRun,
    usersProcessed,
    visitorsProcessed,
    tagsAdded,
    tagsRemoved,
    triggeredBy: auth.source,
    errors: errors.slice(0, 20)
  });
};
