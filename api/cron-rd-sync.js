// V34.7.h.8 — Cron RD sync: a cada 30 min processa o backlog de
// external_rd_sync_status='pending-contact-update' de TODOS os users.
//
// POST /api/cron-rd-sync
// Auth: master JWT OR X-Cron-Token (cron externo)
// Body: { max_visitors_per_user? = 100, only_user_id?, dry_run? }
//
// Setup do cron externo (cron-job.org / Railway cron / GitHub Actions):
//   POST .../api/cron-rd-sync
//   Header: X-Cron-Token: <env CRON_RECONCILE_TOKEN>
//   Cadência: a cada 30 min (ou outro intervalo a gosto)
//
// Cada user é processado isoladamente — se token RD do user X falhou, segue
// pro user Y.

const { runBatch } = require('../lib/rd-contact-sync-engine');
const { getRdCredential } = require('../lib/rd-credentials');
const tenantPoolHelper = require('../lib/tenant-pool');

function authorize(req) {
  if (req.user?.isMaster) return { ok: true, source: 'master' };
  const cronToken = process.env.CRON_RECONCILE_TOKEN;
  if (cronToken) {
    const provided = req.headers['x-cron-token'] || req.query?.cron_token;
    if (provided && String(provided) === cronToken) return { ok: true, source: 'cron-token' };
  }
  return { ok: false };
}

async function resolveTenantDb(controlPlaneDb, userId) {
  try {
    const userRow = await controlPlaneDb.query(
      'SELECT default_tenant_id FROM users WHERE id = $1',
      [userId]
    );
    if (!userRow.rows.length) return null;
    const tenantId = userRow.rows[0].default_tenant_id;
    if (!tenantId) return controlPlaneDb;
    const pool = await tenantPoolHelper.getTenantPool(controlPlaneDb, tenantId);
    return pool || controlPlaneDb;
  } catch (err) {
    console.error('[cron-rd-sync] resolve tenant err:', err.message);
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  const auth = authorize(req);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Não autorizado.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  const maxVisitorsPerUser = Math.min(Number(body.max_visitors_per_user || 100), 500);
  const onlyUserId = body.only_user_id ? Number(body.only_user_id) : null;
  const dryRun = Boolean(body.dry_run);

  let userIds = [];
  try {
    if (onlyUserId > 0) {
      userIds = [onlyUserId];
    } else {
      const r = await req.db.query('SELECT id FROM users WHERE is_approved = true ORDER BY id');
      userIds = r.rows.map(row => row.id);
    }
  } catch (err) {
    return res.status(500).json({ ok: false, message: `list users: ${err.message}` });
  }

  const startedAt = Date.now();
  let usersProcessed = 0;
  let totalSynced = 0;
  let totalFailed = 0;
  let totalRateLimit = 0;
  const errors = [];

  for (const uid of userIds) {
    const tenantDb = await resolveTenantDb(req.db, uid);
    if (!tenantDb) continue;

    // Token RD CRM do user (PAT)
    let token = null;
    try {
      const cred = await getRdCredential(tenantDb, uid, 'crm_pat');
      token = cred?.token;
    } catch (err) {
      // User não conectou RD CRM — pula silenciosamente
      continue;
    }
    if (!token) continue;

    if (dryRun) {
      try {
        const c = await tenantDb.query(
          `SELECT COUNT(*)::int AS c FROM lj_visitors
            WHERE user_id = $1
              AND external_rd_sync_status = 'pending-contact-update'
              AND external_rd_contact_id IS NOT NULL`,
          [uid]
        );
        totalSynced += c.rows[0]?.c || 0; // reuso totalSynced como "pending count" no dry_run
        usersProcessed++;
      } catch (_) {}
      continue;
    }

    try {
      const result = await runBatch(tenantDb, uid, token, { maxVisitors: maxVisitorsPerUser });
      if (result.ok) {
        usersProcessed++;
        totalSynced += result.synced || 0;
        totalFailed += result.failed || 0;
        totalRateLimit += result.rateLimit || 0;
        if (result.errors?.length) {
          errors.push({ userId: uid, errors: result.errors.slice(0, 3) });
        }
      }
    } catch (err) {
      errors.push({ userId: uid, error: err.message });
    }
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`[cron-rd-sync] ${usersProcessed} users · ${totalSynced} synced · ${totalFailed} failed · ${totalRateLimit} rate-limit · ${elapsedMs}ms (triggeredBy: ${auth.source})`);

  return res.status(200).json({
    ok: true,
    dryRun,
    usersProcessed,
    totalSynced,
    totalFailed,
    totalRateLimit,
    elapsedMs,
    triggeredBy: auth.source,
    errors: errors.slice(0, 20)
  });
};
