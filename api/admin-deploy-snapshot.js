// V32.10.5 — POST /api/admin-deploy-snapshot
// Vetor de segurança obrigatório (Felipe — Sansone perdeu dados RevOps).
// Antes de qualquer deploy de produção, master dispara este endpoint que:
//   1. Lista TODOS os tenants ativos (control plane: SELECT FROM tenants)
//   2. Pra cada tenant: abre pool, lê journey_state.state_json de cada user
//   3. Pula states vazios (guarda V32.10.4 — não polui)
//   4. Insere snapshot em journey_snapshots com label 'deploy-V32.X.Y-TIMESTAMP'
//   5. Retention: mantém só os 10 últimos snapshots de prefix 'deploy-' por owner
//
// Master-only. Retorna estatísticas: { tenants, snapshots, skipped, errors }.
//
// Workflow cravado: TODA vez que Felipe disser "subir/aplica/promove pra prod",
// o dev chama este endpoint PRIMEIRO, depois git push origin main.

const tenantPoolHelper = require('../lib/tenant-pool');

const DEPLOY_LABEL_PREFIX = 'deploy-';
const RETENTION_PER_OWNER = 10;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas master pode disparar snapshot deploy-wide.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Control plane não configurado.' });

  const label = String(req.body?.label || `${DEPLOY_LABEL_PREFIX}V${req.body?.version || 'unknown'}-${new Date().toISOString().slice(0, 19)}`).slice(0, 128);
  if (!label.startsWith(DEPLOY_LABEL_PREFIX)) {
    return res.status(400).json({ ok: false, message: `Label deve começar com '${DEPLOY_LABEL_PREFIX}' pra retenção funcionar.` });
  }

  const stats = {
    label,
    tenantsScanned: 0,
    usersScanned: 0,
    snapshotsCreated: 0,
    snapshotsSkippedEmpty: 0,
    snapshotsDeleted: 0,
    errors: []
  };

  try {
    // 1. Lista tenants ativos
    const tenantsRes = await req.db.query(
      "SELECT id, slug, name FROM tenants WHERE status = 'active' ORDER BY id"
    );
    const tenants = tenantsRes.rows;
    stats.tenantsScanned = tenants.length;

    // 2. Pra cada tenant, snapshot dos users
    for (const tenant of tenants) {
      let tenantPool;
      try {
        tenantPool = await tenantPoolHelper.getTenantPool(req.db, tenant.id);
        if (!tenantPool) tenantPool = req.db; // fallback control plane (tenant não migrado)
      } catch (err) {
        stats.errors.push({ tenant: tenant.slug, step: 'get_pool', message: err.message });
        continue;
      }

      let users;
      try {
        const usersRes = await tenantPool.query(
          'SELECT user_id, state_json, updated_at FROM journey_state'
        );
        users = usersRes.rows;
      } catch (err) {
        stats.errors.push({ tenant: tenant.slug, step: 'read_state', message: err.message });
        continue;
      }

      for (const userRow of users) {
        stats.usersScanned++;
        const state = userRow.state_json;
        // Guard: pula states vazios (anti-poluição de retention)
        const totalReal = (state?.products?.length || 0)
                        + (state?.campaigns?.length || 0)
                        + (state?.actions?.length || 0);
        if (totalReal === 0) {
          stats.snapshotsSkippedEmpty++;
          continue;
        }

        try {
          // Insere snapshot
          await tenantPool.query(
            `INSERT INTO journey_snapshots (state_json, label, triggered_by_user_id, owner_user_id)
             VALUES ($1, $2, $3, $4)`,
            [state, label, req.user.sub, userRow.user_id]
          );
          stats.snapshotsCreated++;

          // Retention: mantém só RETENTION_PER_OWNER snapshots com este prefix por owner
          const deleted = await tenantPool.query(
            `DELETE FROM journey_snapshots
             WHERE owner_user_id = $1
               AND label LIKE $2
               AND id NOT IN (
                 SELECT id FROM journey_snapshots
                 WHERE owner_user_id = $1
                   AND label LIKE $2
                 ORDER BY created_at DESC
                 LIMIT $3
               )`,
            [userRow.user_id, `${DEPLOY_LABEL_PREFIX}%`, RETENTION_PER_OWNER]
          );
          stats.snapshotsDeleted += deleted.rowCount || 0;
        } catch (err) {
          stats.errors.push({ tenant: tenant.slug, userId: userRow.user_id, step: 'insert', message: err.message });
        }
      }
    }

    return res.status(200).json({
      ok: true,
      message: `Snapshot deploy "${label}" concluído: ${stats.snapshotsCreated} snapshot(s) criado(s) em ${stats.tenantsScanned} tenant(s).`,
      stats
    });
  } catch (err) {
    console.error('[admin-deploy-snapshot]', err);
    return res.status(500).json({ ok: false, message: err.message, stats });
  }
};
