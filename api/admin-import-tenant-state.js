// V40.14.15 — POST /api/admin-import-tenant-state
// Master-only. Importa um state_json bruto direto pro journey_state de um
// user específico de um tenant. Usado quando o cliente tem um arquivo
// .json de backup (gerado pelo "Baixar snapshot" / pre-manual) e o
// admin-restore-tenant-snapshot não serve porque os snapshots no banco
// têm owner_user_id divergente, ou o backup local é mais recente.
//
// Body: { tenant_slug, user_id, state_json, merge? }
//   tenant_slug: slug do tenant (ex: "sansone")
//   user_id:     id do user dono do state no tenant
//   state_json:  objeto completo do state (NÃO string — vem direto do JSON)
//   merge:       opcional. Quando presente, mescla em vez de sobrescrever.
//                Forma: { onlyProductIds: [1779461376394, ...] }
//                Pra cada productId: traz produto + campaigns(productId=id)
//                + actions(campaignId em campaigns) + revopsFinanceV2[id]
//                + strategicMaps[id] + strategicCampaignMaps(camps) +
//                metasResultado[id]. Skip se ID já existe no target.
//                Mescla customKpiCatalog/customActionCatalog por chave.
//
// Comportamento:
//   1. Valida master + tenant + user_id pertence ao tenant
//   2. Cria snapshot pre-import-admin-<ts> do state atual (proteção)
//   3. SOBRESCREVE ou MESCLA state_json (depende de merge presente)
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

    // 5. Decide se mescla ou sobrescreve
    const mergeCfg = req.body?.merge;
    let stateToSave;
    let mergeReport = null;

    if (mergeCfg && Array.isArray(mergeCfg.onlyProductIds) && mergeCfg.onlyProductIds.length > 0) {
      // MERGE: traz só os productIds especificados + tudo ligado a eles
      const productIdsToImport = mergeCfg.onlyProductIds.map(Number);
      const incomingProducts = Array.isArray(incomingState.products) ? incomingState.products : [];
      const incomingCampaigns = Array.isArray(incomingState.campaigns) ? incomingState.campaigns : [];
      const incomingActions = Array.isArray(incomingState.actions) ? incomingState.actions : [];

      const currentProducts = Array.isArray(currentState.products) ? currentState.products.slice() : [];
      const currentCampaigns = Array.isArray(currentState.campaigns) ? currentState.campaigns.slice() : [];
      const currentActions = Array.isArray(currentState.actions) ? currentState.actions.slice() : [];
      const currentRevopsV2 = { ...(currentState.revopsFinanceV2 || {}) };
      const currentStrategicMaps = { ...(currentState.strategicMaps || {}) };
      const currentStrategicCampaignMaps = { ...(currentState.strategicCampaignMaps || {}) };
      const currentMetas = { ...(currentState.metasResultado || {}) };
      const currentRevopsV1 = { ...(currentState.revopsFinance || {}) };

      const currentProductIdSet = new Set(currentProducts.map(p => Number(p?.id)));
      const currentCampaignIdSet = new Set(currentCampaigns.map(c => Number(c?.id)));
      const currentActionIdSet = new Set(currentActions.map(a => Number(a?.id)));

      const report = { productsAdded: [], productsSkipped: [], campaignsAdded: 0, actionsAdded: 0, revopsAdded: 0, mapsAdded: 0 };

      for (const pid of productIdsToImport) {
        const product = incomingProducts.find(p => Number(p?.id) === pid);
        if (!product) {
          report.productsSkipped.push({ id: pid, reason: 'não existe no JSON' });
          continue;
        }
        if (currentProductIdSet.has(pid)) {
          report.productsSkipped.push({ id: pid, name: product.name, reason: 'já existe no state atual' });
          continue;
        }
        currentProducts.push(product);
        currentProductIdSet.add(pid);
        report.productsAdded.push({ id: pid, name: product.name });

        const productCampaigns = incomingCampaigns.filter(c => Number(c?.productId) === pid);
        const productCampaignIds = new Set();
        for (const camp of productCampaigns) {
          if (currentCampaignIdSet.has(Number(camp.id))) continue;
          currentCampaigns.push(camp);
          currentCampaignIdSet.add(Number(camp.id));
          productCampaignIds.add(Number(camp.id));
          report.campaignsAdded++;
        }
        const productActions = incomingActions.filter(a => productCampaignIds.has(Number(a?.campaignId)));
        for (const act of productActions) {
          if (currentActionIdSet.has(Number(act.id))) continue;
          currentActions.push(act);
          currentActionIdSet.add(Number(act.id));
          report.actionsAdded++;
        }

        if (incomingState.revopsFinanceV2?.[pid] && !currentRevopsV2[pid]) {
          currentRevopsV2[pid] = incomingState.revopsFinanceV2[pid];
          report.revopsAdded++;
        }
        if (incomingState.revopsFinance?.[pid] && !currentRevopsV1[pid]) {
          currentRevopsV1[pid] = incomingState.revopsFinance[pid];
        }
        if (incomingState.strategicMaps?.[pid] && !currentStrategicMaps[pid]) {
          currentStrategicMaps[pid] = incomingState.strategicMaps[pid];
          report.mapsAdded++;
        }
        for (const campId of productCampaignIds) {
          if (incomingState.strategicCampaignMaps?.[campId] && !currentStrategicCampaignMaps[campId]) {
            currentStrategicCampaignMaps[campId] = incomingState.strategicCampaignMaps[campId];
          }
        }
        if (incomingState.metasResultado?.[pid] && !currentMetas[pid]) {
          currentMetas[pid] = incomingState.metasResultado[pid];
        }
      }

      // Merge customKpiCatalog/customActionCatalog (IDs únicos por área)
      const newCustomKpi = { ...(currentState.customKpiCatalog || {}) };
      for (const [area, items] of Object.entries(incomingState.customKpiCatalog || {})) {
        const existingIds = new Set((newCustomKpi[area] || []).map(k => k?.id));
        const additions = (items || []).filter(k => !existingIds.has(k?.id));
        newCustomKpi[area] = [...(newCustomKpi[area] || []), ...additions];
      }
      const newCustomAction = (() => {
        const cur = Array.isArray(currentState.customActionCatalog) ? currentState.customActionCatalog : [];
        const inc = Array.isArray(incomingState.customActionCatalog) ? incomingState.customActionCatalog : [];
        const existingIds = new Set(cur.map(a => a?.id));
        return [...cur, ...inc.filter(a => !existingIds.has(a?.id))];
      })();

      stateToSave = {
        ...currentState,
        products: currentProducts,
        campaigns: currentCampaigns,
        actions: currentActions,
        revopsFinanceV2: currentRevopsV2,
        revopsFinance: currentRevopsV1,
        strategicMaps: currentStrategicMaps,
        strategicCampaignMaps: currentStrategicCampaignMaps,
        metasResultado: currentMetas,
        customKpiCatalog: newCustomKpi,
        customActionCatalog: newCustomAction,
        lastSavedAt: new Date().toISOString()
      };
      mergeReport = report;
    } else {
      // SOBRESCREVE: comportamento original V40.14.15
      stateToSave = incomingState;
    }

    const updateRes = await tenantPool.query(
      `UPDATE journey_state
         SET state_json = $1,
             updated_at = NOW(),
             updated_by_user_id = $2
       WHERE user_id = $3`,
      [stateToSave, req.user.sub, targetUserId]
    );

    if (updateRes.rowCount === 0) {
      await tenantPool.query(
        `INSERT INTO journey_state (user_id, state_json, updated_at, updated_by_user_id)
         VALUES ($1, $2, NOW(), $3)`,
        [targetUserId, stateToSave, req.user.sub]
      );
    }

    const newProductsCount = Array.isArray(stateToSave.products) ? stateToSave.products.length : 0;
    const newProductNames = (stateToSave.products || []).map(p => p?.name).filter(Boolean);

    return res.status(200).json({
      ok: true,
      message: `State ${mergeCfg ? 'mesclado' : 'importado'} pro user ${targetUserId} no tenant ${tenant.slug}.`,
      mode: mergeCfg ? 'merge' : 'overwrite',
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      targetUserId,
      preImportSnapshotLabel: preImportLabel,
      diff: {
        productsBefore: currentProductsCount,
        productsAfter: newProductsCount,
        productNamesBefore: currentProductNames,
        productNamesAfter: newProductNames
      },
      mergeReport
    });
  } catch (err) {
    console.error('[admin-import-tenant-state] erro:', err);
    return res.status(500).json({ ok: false, message: err.message || 'Erro interno' });
  }
};
