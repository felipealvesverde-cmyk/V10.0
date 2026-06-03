// V34.7.f.4 — Cron daily tick: roda manutenção diária do LJ pra todos users.
//
// POST /api/cron-daily-tick
// Auth: master JWT OR X-Cron-Token (cron externo)
// Body: { max_visitors_per_user? = 200, only_user_id?, dry_run? }
//
// O que faz hoje:
//   1. Itera todos users aprovados
//   2. Pra cada user: roda Score Engine batch_decay (recalcula scores
//      aplicando decay temporal). Score "vivo" — lead inativo cai sozinho.
//   3. V35.11.1 — Purge de lj_rd_webhook_log com received_at > 7 dias por tenant
//      (1 query por tenant_db distinto, não por user).
//
// Setup do cron externo (cron-job.org / Railway cron / GitHub Actions):
//   POST .../api/cron-daily-tick
//   Header: X-Cron-Token: <env CRON_RECONCILE_TOKEN>
//   Body: { "max_visitors_per_user": 500 }
//   Cadência: 1x/dia 04:00 UTC (madrugada cliente)
//
// Próximas ondas vão adicionar mais tarefas a este tick:
//   - Pull diário tags RD (V34.6.e — já existe endpoint separado)
//   - Enriquecimento Djow batch (V34.7.a — já existe endpoint separado)
//   - Auto-detect score-collapse (regra 20: lead sem evento 90d → frio forçado)

const { applyDecayBatch } = require('../lib/score-engine');
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
    if (!tenantId) return controlPlaneDb; // fallback master
    const pool = await tenantPoolHelper.getTenantPool(controlPlaneDb, tenantId);
    return pool || controlPlaneDb;
  } catch (err) {
    console.error('[cron-daily-tick] resolve tenant err:', err.message);
    return null;
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  const auth = authorize(req);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Não autorizado (master JWT OR X-Cron-Token).' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  const maxVisitorsPerUser = Math.min(Number(body.max_visitors_per_user || 200), 1000);
  const onlyUserId = body.only_user_id ? Number(body.only_user_id) : null;
  const dryRun = Boolean(body.dry_run);

  // Lista de users a processar
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
  let usersProcessed = 0, totalVisitorsProcessed = 0;
  const errors = [];

  // V35.11.1 — Coleta tenantDbs distintos pra rodar purge 1x por tenant.
  // Map<dbIdentity, { db, userIds: number[] }>. Identidade do db = referência
  // (Pool/Client) — control plane compartilhado vira mesma chave; tenants
  // próprios cada um vira chave distinta.
  const distinctTenantDbs = new Map();

  for (const uid of userIds) {
    const tenantDb = await resolveTenantDb(req.db, uid);
    if (!tenantDb) continue;
    if (!distinctTenantDbs.has(tenantDb)) distinctTenantDbs.set(tenantDb, { db: tenantDb, userIds: [] });
    distinctTenantDbs.get(tenantDb).userIds.push(uid);
    try {
      if (dryRun) {
        // Dry-run: só conta quantos visitors elegíveis
        const c = await tenantDb.query(
          `SELECT COUNT(*) AS c FROM lj_visitors WHERE user_id = $1`,
          [uid]
        );
        totalVisitorsProcessed += Number(c.rows[0]?.c || 0);
        usersProcessed++;
        continue;
      }
      const result = await applyDecayBatch(tenantDb, uid, { maxVisitors: maxVisitorsPerUser });
      if (result.ok && result.processed > 0) {
        usersProcessed++;
        totalVisitorsProcessed += result.processed;
      }
      if (result.errors?.length) {
        errors.push({ userId: uid, errors: result.errors.slice(0, 3) });
      }
    } catch (err) {
      errors.push({ userId: uid, error: err.message });
    }
  }

  // V35.11.1 — Purge de lj_rd_webhook_log >7d em cada tenantDb distinto.
  // Tabela pode não existir em tenants antigos — try/catch swallow.
  let webhookLogsPurged = 0;
  if (!dryRun) {
    for (const { db } of distinctTenantDbs.values()) {
      try {
        const r = await db.query(
          `DELETE FROM lj_rd_webhook_log WHERE received_at < NOW() - INTERVAL '7 days'`
        );
        webhookLogsPurged += r.rowCount || 0;
      } catch (err) {
        // Tabela não existe ou erro de DB — não derruba o cron
        if (!/relation .* does not exist/i.test(err.message)) {
          console.warn('[cron-daily-tick webhook-log purge]', err.message);
        }
      }
    }
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`[cron-daily-tick] ${usersProcessed} users · ${totalVisitorsProcessed} visitors · ${webhookLogsPurged} webhook logs purged · ${elapsedMs}ms (triggeredBy: ${auth.source})`);

  return res.status(200).json({
    ok: true,
    dryRun,
    usersProcessed,
    totalVisitorsProcessed,
    webhookLogsPurged,
    elapsedMs,
    triggeredBy: auth.source,
    errors: errors.slice(0, 20)
  });
};
