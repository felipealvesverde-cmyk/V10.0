// V32.10.6 — POST /api/admin-restore-tenant-snapshot
// Master-only. Restaura snapshot de qualquer tenant sem precisar do user final
// logar (incidente Sansone: dados perdidos, cliente externo não consegue ir
// no LJ recuperar).
//
// Body: { tenant_slug, snapshot_id, target_user_id? }
//   tenant_slug: slug do tenant
//   snapshot_id: id do snapshot a restaurar
//   target_user_id: opcional. Se omitido, usa owner_user_id do snapshot.
//
// Comportamento:
//   1. Localiza tenant + abre pool
//   2. Busca snapshot por id
//   3. Cria pre-restore-admin-* automático do journey_state atual (proteção)
//   4. Aplica snapshot.state_json no journey_state[target_user_id]
//   5. Retorna confirmação com diff de contagem (antes vs depois)

const tenantPoolHelper = require('../lib/tenant-pool');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas master.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Control plane não configurado.' });

  const tenantSlug = String(req.body?.tenant_slug || '').trim().toLowerCase();
  const snapshotId = Number(req.body?.snapshot_id);
  const requestedTargetUserId = req.body?.target_user_id != null ? Number(req.body.target_user_id) : null;
  if (!tenantSlug) return res.status(400).json({ ok: false, message: 'tenant_slug obrigatório.' });
  if (!snapshotId) return res.status(400).json({ ok: false, message: 'snapshot_id obrigatório.' });

  try {
    // 1. Tenant
    const tenantRes = await req.db.query(
      'SELECT id, slug, name FROM tenants WHERE LOWER(slug) = $1 LIMIT 1',
      [tenantSlug]
    );
    if (!tenantRes.rows.length) return res.status(404).json({ ok: false, message: `Tenant "${tenantSlug}" não encontrado.` });
    const tenant = tenantRes.rows[0];

    // 2. Pool
    let tenantPool;
    try {
      tenantPool = await tenantPoolHelper.getTenantPool(req.db, tenant.id);
      if (!tenantPool) tenantPool = req.db;
    } catch (err) {
      return res.status(500).json({ ok: false, message: `Falha pool: ${err.message}` });
    }

    // 3. Busca snapshot
    const snapRes = await tenantPool.query(
      'SELECT id, state_json, label, owner_user_id FROM journey_snapshots WHERE id = $1',
      [snapshotId]
    );
    if (!snapRes.rows.length) return res.status(404).json({ ok: false, message: `Snapshot ${snapshotId} não encontrado neste tenant.` });
    const snapshot = snapRes.rows[0];

    // 4. Determina target_user_id
    const targetUserId = requestedTargetUserId || snapshot.owner_user_id;
    if (!targetUserId) return res.status(400).json({ ok: false, message: 'Sem target_user_id e snapshot sem owner.' });

    // 5. Backup do state atual ANTES de restaurar (proteção)
    const currentRes = await tenantPool.query(
      'SELECT state_json FROM journey_state WHERE user_id = $1',
      [targetUserId]
    );
    let beforeCounts = { products: 0, campaigns: 0, actions: 0 };
    if (currentRes.rows[0]) {
      const cs = currentRes.rows[0].state_json || {};
      beforeCounts = {
        products: (cs.products || []).length,
        campaigns: (cs.campaigns || []).length,
        actions: (cs.actions || []).length
      };
      // Pre-restore snapshot
      await tenantPool.query(
        `INSERT INTO journey_snapshots (state_json, label, triggered_by_user_id, owner_user_id)
         VALUES ($1, $2, $3, $4)`,
        [cs, `pre-restore-admin-${new Date().toISOString().slice(0, 19)}-by-${req.user.sub}`, req.user.sub, targetUserId]
      );
    }

    // 6. Aplica snapshot
    await tenantPool.query(
      `INSERT INTO journey_state (user_id, state_json, updated_at, updated_by_user_id)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (user_id) DO UPDATE SET
         state_json = EXCLUDED.state_json,
         updated_at = NOW(),
         updated_by_user_id = EXCLUDED.updated_by_user_id`,
      [targetUserId, snapshot.state_json, req.user.sub]
    );

    const afterCounts = {
      products: (snapshot.state_json?.products || []).length,
      campaigns: (snapshot.state_json?.campaigns || []).length,
      actions: (snapshot.state_json?.actions || []).length
    };

    return res.status(200).json({
      ok: true,
      message: `Snapshot "${snapshot.label}" restaurado pro user ${targetUserId} no tenant ${tenant.slug}.`,
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      targetUserId,
      snapshotLabel: snapshot.label,
      before: beforeCounts,
      after: afterCounts
    });
  } catch (err) {
    console.error('[admin-restore-tenant-snapshot]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
