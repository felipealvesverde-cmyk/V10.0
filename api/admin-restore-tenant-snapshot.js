// V32.10.6 — POST /api/admin-restore-tenant-snapshot
// Master-only. Restaura snapshot de qualquer tenant sem precisar do user final
// logar (incidente Sansone: dados perdidos, cliente externo não consegue ir
// no LJ recuperar).
//
// Body: { tenant_slug, snapshot_id, target_user_id?, restore_credentials? }
//   tenant_slug: slug do tenant
//   snapshot_id: id do snapshot a restaurar
//   target_user_id: opcional. Se omitido, usa owner_user_id do snapshot.
//   restore_credentials: opcional (default true). Se snapshot tem credentials_json,
//     aplica nas 5 tabelas (clickup, google_ads, ga4, hotmart, rd).
//
// V41.0.2 — Snapshot agora inclui credentials_json. Restore restaura ambos.
// Snapshots antigos (sem credentials_json) seguem só com state_json — fallback
// silencioso.
//
// Comportamento:
//   1. Localiza tenant + abre pool
//   2. Busca snapshot por id (state_json + credentials_json)
//   3. Cria pre-restore-admin-* automático do journey_state ATUAL + credentials atuais
//   4. Aplica snapshot.state_json no journey_state[target_user_id]
//   5. Se snapshot.credentials_json existe e restore_credentials=true, aplica nas 5 tabelas
//   6. Retorna confirmação com diff de contagem + credentials restauradas

const tenantPoolHelper = require('../lib/tenant-pool');
const { dumpCredentialsForUser, restoreCredentialsForUser, ensureCredentialsColumn } = require('../lib/credentials-snapshot');
const { stampAndValidateState, forceRestampState, logTenantAudit } = require('../lib/tenant-stamp');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas master.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Control plane não configurado.' });

  const tenantSlug = String(req.body?.tenant_slug || '').trim().toLowerCase();
  const snapshotId = Number(req.body?.snapshot_id);
  const requestedTargetUserId = req.body?.target_user_id != null ? Number(req.body.target_user_id) : null;
  const restoreCredentials = req.body?.restore_credentials !== false;
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

    // V41.0.2 — garante coluna credentials_json antes do SELECT (idempotente)
    await ensureCredentialsColumn(tenantPool);

    // 3. Busca snapshot (state_json + credentials_json — null em snapshots antigos)
    const snapRes = await tenantPool.query(
      'SELECT id, state_json, credentials_json, label, owner_user_id FROM journey_snapshots WHERE id = $1',
      [snapshotId]
    );
    if (!snapRes.rows.length) return res.status(404).json({ ok: false, message: `Snapshot ${snapshotId} não encontrado neste tenant.` });
    const snapshot = snapRes.rows[0];

    // 4. Determina target_user_id
    const targetUserId = requestedTargetUserId || snapshot.owner_user_id;
    if (!targetUserId) return res.status(400).json({ ok: false, message: 'Sem target_user_id e snapshot sem owner.' });

    // 5. Backup do state atual + credentials atuais ANTES de restaurar (proteção)
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
      // V41.0.2 — pre-restore snapshot agora dumpa credentials atuais também,
      // pra que se o restore quebrar algo, dá pra voltar 100% do estado anterior.
      let currentCredentials = null;
      try {
        currentCredentials = await dumpCredentialsForUser(tenantPool, targetUserId);
      } catch (_) { /* segue */ }
      await tenantPool.query(
        `INSERT INTO journey_snapshots (state_json, label, triggered_by_user_id, owner_user_id, credentials_json)
         VALUES ($1, $2, $3, $4, $5)`,
        [cs, `pre-restore-admin-${new Date().toISOString().slice(0, 19)}-by-${req.user.sub}`, req.user.sub, targetUserId, currentCredentials]
      );
    }

    // V41.0.11 — Validação por entidade do state do snapshot ANTES de gravar.
    // Snapshot pode ter sido criado pra outro tenant (ex: master fez snapshot
    // de Sansone e tenta restaurar pro demo). Bloqueia se stamps divergem.
    // Master pode forçar com body.force_restamp=true (restamp pro tenant alvo).
    const forceRestamp = !!req.body?.force_restamp;
    const targetTenantId = Number(tenant.id);
    const stateToRestore = snapshot.state_json || {};
    let auditEntitiesAffected = 0;
    if (forceRestamp) {
      const { restamped } = forceRestampState(stateToRestore, targetTenantId);
      auditEntitiesAffected = restamped;
      console.log(`[admin-restore-tenant-snapshot] force_restamp=true — ${restamped} entidades re-estampadas pro tenant ${targetTenantId}`);
    } else {
      const { errors, stamped } = stampAndValidateState(stateToRestore, targetTenantId);
      if (errors.length) {
        return res.status(409).json({
          ok: false,
          code: 'entity_tenant_mismatch',
          message: `${errors.length} entidade(s) no snapshot pertencem a outro tenant. Re-rode com force_restamp:true se quiser sobrescrever o stamp.`,
          entities: errors.slice(0, 10),
          totalErrors: errors.length,
          targetTenantId
        });
      }
      if (stamped > 0) {
        console.log(`[admin-restore-tenant-snapshot] V41.0.11 — stamped silently: ${stamped} entidades legacy com _originTenantId = ${targetTenantId}`);
      }
      auditEntitiesAffected = stamped;
    }
    // V41.0.12 — audit log forensics
    await logTenantAudit(req.db, {
      actor_user_id: req.user.sub,
      endpoint: 'admin-restore-tenant-snapshot',
      target_tenant_id: targetTenantId,
      target_user_id: targetUserId,
      force_restamp: forceRestamp,
      entities_affected: auditEntitiesAffected,
      details: { snapshot_id: snapshotId, snapshot_label: snapshot.label }
    });

    // 6. Aplica state_json
    await tenantPool.query(
      `INSERT INTO journey_state (user_id, state_json, updated_at, updated_by_user_id)
       VALUES ($1, $2, NOW(), $3)
       ON CONFLICT (user_id) DO UPDATE SET
         state_json = EXCLUDED.state_json,
         updated_at = NOW(),
         updated_by_user_id = EXCLUDED.updated_by_user_id`,
      [targetUserId, stateToRestore, req.user.sub]
    );

    // 7. V41.0.2 — Aplica credentials se snapshot tiver e flag estiver on
    let credentialsResult = { applied: false, tables: 0, rows: 0, skipped: 0, reason: null };
    if (snapshot.credentials_json && restoreCredentials) {
      try {
        const r = await restoreCredentialsForUser(tenantPool, targetUserId, snapshot.credentials_json);
        credentialsResult = { applied: true, ...r };
      } catch (err) {
        credentialsResult = { applied: false, tables: 0, rows: 0, skipped: 0, reason: `erro: ${err.message}` };
      }
    } else if (!snapshot.credentials_json) {
      credentialsResult.reason = 'snapshot sem credentials (criado antes de V41.0.2 ou owner sem integrações)';
    } else if (!restoreCredentials) {
      credentialsResult.reason = 'restore_credentials=false no body';
    }

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
      after: afterCounts,
      credentials: credentialsResult
    });
  } catch (err) {
    console.error('[admin-restore-tenant-snapshot]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
