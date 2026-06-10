// V37.0.2 — Cron mensal de fechamento da governança RevOps.
//
// POST /api/cron-monthly-closing
// Auth: master JWT OR X-Cron-Token (cron externo)
// Body: { only_user_id?, dry_run?, period? }
//
// O que faz:
//   1. Determina o período a fechar (default: mês anterior no horário BRT).
//   2. Itera todos users aprovados (ou um single via only_user_id).
//   3. Pra cada user:
//      a. Resolve tenantDb.
//      b. Lê journey_state.state_json.
//      c. Pra cada produto em state.products:
//         • Cria snapshot kind='product_auto' se ainda não existir naquele
//           período. (idempotente via unique index)
//      d. Cria 1 snapshot kind='consolidated_monthly' status='partial' se
//         ainda não existir. Cliente associa produtos depois via UI.
//
// Setup do cron externo (cron-job.org / Railway cron / GitHub Actions):
//   POST .../api/cron-monthly-closing
//   Header: X-Cron-Token: <env CRON_RECONCILE_TOKEN>
//   Body: {}
//   Cadência: dia 1 de cada mês, 03:00 UTC (= 00:00 BRT)
//   Cron expression: 0 3 1 * *

const tenantPoolHelper = require('../lib/tenant-pool');
const {
  composeProductSnapshot,
  composeConsolidatedSnapshot,
  loadStateJson
} = require('./governance-closings');

function authorize(req) {
  if (req.user?.isMaster) return { ok: true, source: 'master' };
  const cronToken = process.env.CRON_RECONCILE_TOKEN;
  if (cronToken) {
    const provided = req.headers['x-cron-token'] || req.query?.cron_token;
    if (provided && String(provided) === cronToken) return { ok: true, source: 'cron-token' };
  }
  return { ok: false };
}

// Calcula período a fechar (mês anterior em BRT).
// Roda dia 1 de qualquer mês às 00:00 BRT → fecha mês anterior.
// Se acionado em outro dia/hora, ainda fecha o mês anterior conservadoramente.
function defaultPeriodBRT() {
  const now = new Date();
  // BRT = UTC-3. Pega "agora-1 dia" pra cair seguro no mês anterior mesmo se
  // executado no instante exato da virada.
  const safe = new Date(now.getTime() - 24 * 3600_000 - 3 * 3600_000);
  const y = safe.getUTCFullYear();
  const m = String(safe.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

async function resolveTenantDb(controlPlaneDb, userId) {
  try {
    const userRow = await controlPlaneDb.query(
      'SELECT default_tenant_id FROM users WHERE id = $1',
      [userId]
    );
    if (!userRow.rows.length) return null;
    const tenantId = userRow.rows[0].default_tenant_id;
    if (!tenantId) return controlPlaneDb; // fallback master
    const pool = await tenantPoolHelper.getTenantPool(controlPlaneDb, tenantId);
    return pool || controlPlaneDb;
  } catch (err) {
    console.error('[cron-monthly-closing] resolve tenant err:', err.message);
    return null;
  }
}

async function processUser(controlPlaneDb, userId, period, dryRun) {
  const tenantDb = await resolveTenantDb(controlPlaneDb, userId);
  if (!tenantDb) return { userId, skipped: 'no_tenant', productSnapshots: 0, monthlyCreated: false };

  let stateJson;
  try {
    stateJson = await loadStateJson(tenantDb, userId);
  } catch (err) {
    return { userId, error: `load_state: ${err.message}` };
  }
  const products = Array.isArray(stateJson.products) ? stateJson.products : [];
  if (!products.length) {
    return { userId, skipped: 'no_products', productSnapshots: 0, monthlyCreated: false };
  }

  let productSnapshots = 0;
  let monthlyCreated = false;

  for (const product of products) {
    if (!product || !product.id) continue;
    const productId = String(product.id);
    const snapshot = composeProductSnapshot(stateJson, productId, period);
    if (!snapshot) continue;
    if (dryRun) { productSnapshots++; continue; }
    try {
      const insertRes = await tenantDb.query(
        `INSERT INTO lj_governance_closings
           (user_id, period, kind, product_ids, name, status, snapshot_json, source, closed_at)
         VALUES ($1, $2, 'product_auto', $3::jsonb, $4, 'complete', $5::jsonb, 'auto', NOW())
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [userId, period, JSON.stringify([productId]), product.name || null, JSON.stringify(snapshot)]
      );
      if (insertRes.rows.length) productSnapshots++;
    } catch (err) {
      console.error(`[cron-monthly-closing] insert product_auto user=${userId} product=${productId}`, err.message);
    }
  }

  // consolidated_monthly partial — 1 por (user, period)
  if (!dryRun) {
    try {
      // Snapshot nasce vazio (cliente associa produtos depois).
      const emptySnap = composeConsolidatedSnapshot(stateJson, [], period);
      const monthlyRes = await tenantDb.query(
        `INSERT INTO lj_governance_closings
           (user_id, period, kind, product_ids, name, status, snapshot_json, source, closed_at)
         VALUES ($1, $2, 'consolidated_monthly', '[]'::jsonb, $3, 'partial', $4::jsonb, 'auto', NOW())
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [userId, period, `Fechamento Mensal · ${period}`, JSON.stringify(emptySnap)]
      );
      monthlyCreated = monthlyRes.rows.length > 0;
    } catch (err) {
      console.error(`[cron-monthly-closing] insert monthly user=${userId}`, err.message);
    }
  } else {
    monthlyCreated = true; // simulado
  }

  return { userId, productSnapshots, monthlyCreated, totalProducts: products.length };
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  const auth = authorize(req);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Não autorizado (master JWT OR X-Cron-Token).' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  const onlyUserId = body.only_user_id ? Number(body.only_user_id) : null;
  const dryRun = Boolean(body.dry_run);
  const period = body.period && /^\d{4}-\d{2}$/.test(String(body.period))
    ? String(body.period)
    : defaultPeriodBRT();

  if (!req.db) return res.status(503).json({ ok: false, message: 'Control plane indisponível.' });

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
  const results = [];
  let usersProcessed = 0;
  let productSnapshotsCreated = 0;
  let monthlySnapshotsCreated = 0;
  const errors = [];

  for (const userId of userIds) {
    try {
      const result = await processUser(req.db, userId, period, dryRun);
      results.push(result);
      usersProcessed++;
      if (result.productSnapshots) productSnapshotsCreated += result.productSnapshots;
      if (result.monthlyCreated) monthlySnapshotsCreated++;
      if (result.error) errors.push({ userId, error: result.error });
    } catch (err) {
      errors.push({ userId, error: err.message });
    }
  }

  const durationMs = Date.now() - startedAt;
  return res.status(200).json({
    ok: true,
    period,
    dryRun,
    usersProcessed,
    productSnapshotsCreated,
    monthlySnapshotsCreated,
    errors,
    durationMs,
    results: results.slice(0, 50) // capa pra payload não estourar
  });
};
