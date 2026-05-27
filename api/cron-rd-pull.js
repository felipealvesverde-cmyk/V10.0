// V34.8.0 — Cron bidirecional RD ↔ LJ.
//
// POST /api/cron-rd-pull
// Auth: master JWT OR X-Cron-Token (cron externo)
// Body: { only_user_id?, dry_run?, max_pull_pages?, max_orphans? }
//
// Cadência alvo: a cada 15 min (configurar no cron externo).
//
// Substitui o /api/cron-rd-sync (alpha49) — esse novo faz pull + push numa
// rodada só. Mantido o antigo por compat, mas pode aposentar.

const { runReconciliation } = require('../lib/rd-reconciliation-engine');
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
    console.error('[cron-rd-pull] resolve tenant err:', err.message);
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

  const onlyUserId = body.only_user_id ? Number(body.only_user_id) : null;
  const dryRun = Boolean(body.dry_run);
  const maxPullPages = Math.min(Number(body.max_pull_pages || 10), 20);
  const maxOrphans = Math.min(Number(body.max_orphans || 50), 200);

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
  const perUser = [];
  let totalPulled = 0, totalApplied = 0, totalAlerts = 0, totalOrphansCreated = 0;

  for (const uid of userIds) {
    const tenantDb = await resolveTenantDb(req.db, uid);
    if (!tenantDb) continue;

    let token = null;
    try {
      const cred = await getRdCredential(tenantDb, uid, 'crm_pat');
      token = cred?.token;
    } catch (_) {
      continue;
    }
    if (!token) continue;

    if (dryRun) {
      perUser.push({ userId: uid, dryRun: true });
      continue;
    }

    try {
      const r = await runReconciliation(tenantDb, uid, token, { maxPullPages, maxOrphans });
      totalPulled += r.pull?.pulled || 0;
      totalApplied += r.pull?.applied || 0;
      totalAlerts += r.pull?.alerts || 0;
      totalOrphansCreated += r.orphans?.created || 0;
      perUser.push({ userId: uid, ...r });
    } catch (err) {
      perUser.push({ userId: uid, error: err.message });
    }
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`[cron-rd-pull] ${perUser.length} users · pulled=${totalPulled} applied=${totalApplied} alerts=${totalAlerts} orphans+=${totalOrphansCreated} · ${elapsedMs}ms (triggeredBy: ${auth.source})`);

  return res.status(200).json({
    ok: true,
    dryRun,
    usersProcessed: perUser.length,
    totalPulled,
    totalApplied,
    totalAlerts,
    totalOrphansCreated,
    elapsedMs,
    triggeredBy: auth.source,
    perUser: perUser.slice(0, 20)
  });
};
