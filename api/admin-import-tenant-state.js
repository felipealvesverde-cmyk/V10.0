// V40.14.15 — POST /api/admin-import-tenant-state
// Master-only. Importa um state_json bruto direto pro journey_state de um
// user específico de um tenant. Usado quando o cliente tem um arquivo
// .json de backup (gerado pelo "Baixar snapshot" / pre-manual) e o
// admin-restore-tenant-snapshot não serve porque os snapshots no banco
// têm owner_user_id divergente, ou o backup local é mais recente.
//
// Body: { tenant_slug, user_id, state_json }
//   tenant_slug: slug do tenant (ex: "sansone")
//   user_id:     id do user dono do state no tenant
//   state_json:  objeto completo do state (NÃO string — vem direto do JSON)
//
// Comportamento:
//   1. Valida master + tenant + user_id pertence ao tenant
//   2. Cria snapshot pre-import-admin-<ts> do state atual (proteção)
//   3. UPDATE journey_state SET state_json com o body
//   4. Retorna diff de contagem (products antes vs depois)

const tenantPoolHelper = require('../lib/tenant-pool');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas master.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Control plane não configurado.' });

  const tenantSlug = String(req.body?.tenant_slug || '').trim().toLowerCase();
  const targetUserId = Number(req.body?.user_id);
  const incomingState = req.body?.state_json;

  if (!tenantSlug) return res.status(400).json({ ok: false, message: 'tenant_slug obrigatório.' });
  if (!targetUserId) return res.status(400).json({ ok: false, message: 'user_id obrigatório.' });
  if (!incomingState || typeof incomingState !== 'object') {
    return res.status(400).json({ ok: false, message: 'state_json obrigatório e deve ser objeto.' });
  }

  try {
    // 1. Tenant
    const tenantRes = await req.db.query(
      'SELECT id, slug, name FROM tenants WHERE LOWER(slug) = $1 LIMIT 1',
      [tenantSlug]
    );
    if (!tenantRes.rows.length) return res.status(404).json({ ok: false, message: `Tenant "${tenantSlug}" não encontrado.` });
    const tenant = tenantRes.rows[0];

    // 2. Confirma que user_id pertence ao tenant
    const memberRes = await req.db.query(
      'SELECT user_id, role FROM tenant_members WHERE tenant_id = $1 AND user_id = $2 LIMIT 1',
      [tenant.id, targetUserId]
    );
    if (!memberRes.rows.length) {
      return res.status(404).json({ ok: false, message: `user_id ${targetUserId} não pertence ao tenant ${tenantSlug}.` });
    }

    // 3. Pool
    let tenantPool;
    try {
      tenantPool = await tenantPoolHelper.getTenantPool(req.db, tenant.id);
      if (!tenantPool) tenantPool = req.db;
    } catch (err) {
      return res.status(500).json({ ok: false, message: `Falha pool: ${err.message}` });
    }

    // 4. Lê state atual + cria snapshot de proteção pre-import
    const currentRes = await tenantPool.query(
      'SELECT state_json FROM journey_state WHERE user_id = $1',
      [targetUserId]
    );
    const currentState = currentRes.rows[0]?.state_json || {};
    const currentProductsCount = Array.isArray(currentState.products) ? currentState.products.length : 0;
    const currentProductNames = (currentState.products || []).map(p => p?.name).filter(Boolean);

    const preImportLabel = `pre-import-admin-${new Date().toISOString().slice(0, 19)}`;
    try {
      await tenantPool.query(
        `INSERT INTO journey_snapshots (owner_user_id, label, state_json, triggered_by_user_id, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [targetUserId, preImportLabel, currentState, req.user.sub]
      );
    } catch (snapErr) {
      console.warn('[admin-import-tenant-state] pre-import snapshot falhou:', snapErr.message);
    }

    // 5. UPDATE journey_state com o state importado
    const updateRes = await tenantPool.query(
      `UPDATE journey_state
         SET state_json = $1,
             updated_at = NOW(),
             updated_by_user_id = $2
       WHERE user_id = $3`,
      [incomingState, req.user.sub, targetUserId]
    );

    if (updateRes.rowCount === 0) {
      // Não existia ainda — INSERT
      await tenantPool.query(
        `INSERT INTO journey_state (user_id, state_json, updated_at, updated_by_user_id)
         VALUES ($1, $2, NOW(), $3)`,
        [targetUserId, incomingState, req.user.sub]
      );
    }

    const newProductsCount = Array.isArray(incomingState.products) ? incomingState.products.length : 0;
    const newProductNames = (incomingState.products || []).map(p => p?.name).filter(Boolean);

    return res.status(200).json({
      ok: true,
      message: `State importado pro user ${targetUserId} no tenant ${tenant.slug}.`,
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      targetUserId,
      preImportSnapshotLabel: preImportLabel,
      diff: {
        productsBefore: currentProductsCount,
        productsAfter: newProductsCount,
        productNamesBefore: currentProductNames,
        productNamesAfter: newProductNames
      }
    });
  } catch (err) {
    console.error('[admin-import-tenant-state] erro:', err);
    return res.status(500).json({ ok: false, message: err.message || 'Erro interno' });
  }
};
