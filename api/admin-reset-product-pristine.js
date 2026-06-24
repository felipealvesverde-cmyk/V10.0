// V40.14.14 — POST /api/admin-reset-product-pristine
//
// Zera um produto pra estado pristine no demo: mantém só estrutura comercial
// (produto + campanhas + ações + execuções) e apaga tudo que foi configurado
// em cima (arquétipo/audience, RevOps & Equilíbrio inteiro, metas, vendas
// Hotmart, deals CRM).
//
// Caso de uso: você experimentou um modelo (ex: Atacado B2B), o painel ficou
// inconsistente entre legados Checkout e ajustes manuais Atacado, e quer
// recomeçar do zero sem perder a estrutura de campanhas/ações que já tinha.
//
// Idempotente: roda quantas vezes quiser. Não falha se o produto já está
// pristine.

const tenantPoolHelper = require('../lib/tenant-pool');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  const isAllowed = req.user.isMaster || req.user.username === 'demo@leadjourney.app';
  if (!isAllowed) return res.status(403).json({ ok: false, message: 'Permissão negada.' });

  const { productId } = req.body || {};
  if (!productId) return res.status(400).json({ ok: false, message: 'productId obrigatório.' });
  const productIdNum = Number(productId);

  try {
    const DEMO_USERNAME = 'demo@leadjourney.app';
    const userRow = await req.db.query('SELECT id FROM users WHERE username = $1', [DEMO_USERNAME]);
    const demoUserId = userRow.rows[0]?.id;
    if (!demoUserId) return res.status(404).json({ ok: false, message: 'User demo não existe.' });

    const tenantInfo = await req.db.query('SELECT default_tenant_id FROM users WHERE id = $1', [demoUserId]);
    const tenantId = tenantInfo.rows[0]?.default_tenant_id;
    let tenantDb = req.db;
    if (tenantId) {
      try { tenantDb = await tenantPoolHelper.getTenantPool(req.db, tenantId); } catch (_) { tenantDb = req.db; }
    }
    if (!tenantDb) tenantDb = req.db;

    // 1) Mutação no journey_state.state_json
    const existing = await req.db.query('SELECT state_json FROM journey_state WHERE user_id = $1', [demoUserId]);
    if (existing.rowCount === 0) {
      return res.status(404).json({ ok: false, message: 'Demo user não tem state.' });
    }
    const state = existing.rows[0].state_json || {};

    const products = Array.isArray(state.products) ? state.products.slice() : [];
    const productIdx = products.findIndex(p => Number(p?.id) === productIdNum);
    if (productIdx < 0) {
      return res.status(404).json({ ok: false, message: `Produto ${productId} não encontrado no state.` });
    }
    const productName = products[productIdx]?.name;

    // Zera audience (volta pro estado "sem arquétipo configurado")
    const { audience, ...restProduct } = products[productIdx];
    products[productIdx] = restProduct;

    // Tira o produto do revopsFinanceV2 (Custos, Ofertas, Resultado, Fechamento)
    const newRevopsV2 = { ...(state.revopsFinanceV2 || {}) };
    const hadRevopsV2 = !!newRevopsV2[productIdNum];
    delete newRevopsV2[productIdNum];

    // Tira do legado V1 também, por segurança
    const newRevopsV1 = { ...(state.revopsFinance || {}) };
    const hadRevopsV1 = !!newRevopsV1[productIdNum];
    delete newRevopsV1[productIdNum];

    // Tira metas KPI cravadas no produto
    const newMetasResultado = { ...(state.metasResultado || {}) };
    const hadMetas = !!newMetasResultado[productIdNum];
    delete newMetasResultado[productIdNum];

    const newState = {
      ...state,
      products,
      revopsFinanceV2: newRevopsV2,
      revopsFinance: newRevopsV1,
      metasResultado: newMetasResultado,
      lastSavedAt: new Date().toISOString()
    };

    await req.db.query(
      `UPDATE journey_state SET state_json = $1, updated_at = NOW(), updated_by_user_id = $2 WHERE user_id = $2`,
      [newState, demoUserId]
    );

    // 2) Limpa fontes físicas de vendas/deals do produto no tenant DB
    const delHotmart = await tenantDb.query(
      `DELETE FROM lj_hotmart_purchases WHERE user_id = $1 AND product_id_lj = $2`,
      [demoUserId, productIdNum]
    );
    let deletedDeals = 0;
    try {
      const delDeals = await tenantDb.query(
        `DELETE FROM lj_rd_deals WHERE user_id = $1 AND product_id_lj = $2`,
        [demoUserId, productIdNum]
      );
      deletedDeals = delDeals.rowCount || 0;
    } catch (_) {
      // tabela lj_rd_deals pode não existir — ignora
    }

    return res.status(200).json({
      ok: true,
      productId: productIdNum,
      productName,
      cleared: {
        audience: !!audience,
        revopsFinanceV2: hadRevopsV2,
        revopsFinanceV1: hadRevopsV1,
        metasResultado: hadMetas,
        hotmartPurchases: delHotmart.rowCount || 0,
        rdDeals: deletedDeals
      },
      kept: {
        product: true,
        campaigns: 'todas as campanhas do produto mantidas',
        actions: 'todas as ações mantidas',
        executions: 'todas as execuções mantidas'
      }
    });
  } catch (err) {
    console.error('[admin-reset-product-pristine] erro:', err);
    return res.status(500).json({ ok: false, message: err.message || 'Erro interno' });
  }
};
