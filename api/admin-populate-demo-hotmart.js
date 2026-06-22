// V40.11.20 — Popula lj_hotmart_purchases do tenant demo com N transações
// aprovadas espalhadas no janela de 30 dias. Pipeline_velocity_summary lê
// dessa tabela e atualiza o cache que alimenta:
//   - Realizado de Vendas no Card Vendas (productConvertedCount)
//   - Realizado de Receita no Card Receita (productConvertedCount × ticket)
//   - Ticket Hotmart usado em todos os cards (productCrmTicket)
//
// "Fazendo leitura de um Checkout" (Felipe 2026-06-21): a tabela final é
// a mesma que o webhook do Hotmart popula. Pula a etapa HTTP (122k webhooks
// seria absurdo), mas mantém schema 1:1 com o que o webhook geraria.
//
// Body:
//   {
//     productId: 1781869701831,
//     count: 122000,
//     avgValueCents: 2200,   // R$ 22
//     windowDays: 30,        // espalha occurred_at nos últimos N dias
//     productIdHotmart: 'demo-pilsen-prod'  // opcional, default = 'demo-${productId}'
//   }
//
// Retorna delta: { ok, inserted, deleted }. Caller faz refetch:
//   await Actions.loadPipelineVelocitySummary({ force: true });

const BATCH_SIZE = 500;

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  const isAllowed = req.user.isMaster || req.user.username === 'demo@leadjourney.app';
  if (!isAllowed) return res.status(403).json({ ok: false, message: 'Permissão negada.' });

  const { productId, count, avgValueCents, windowDays } = req.body || {};
  const productIdHotmart = req.body?.productIdHotmart || `demo-${productId}`;

  if (!productId) return res.status(400).json({ ok: false, message: 'productId obrigatório.' });
  if (!count || count < 1) return res.status(400).json({ ok: false, message: 'count obrigatório (>= 1).' });
  if (!avgValueCents || avgValueCents < 1) return res.status(400).json({ ok: false, message: 'avgValueCents obrigatório (>= 1).' });
  const windowD = Number(windowDays) || 30;

  try {
    const DEMO_USERNAME = 'demo@leadjourney.app';
    const userRow = await req.db.query('SELECT id FROM users WHERE username = $1', [DEMO_USERNAME]);
    const demoUserId = userRow.rows[0]?.id;
    if (!demoUserId) return res.status(404).json({ ok: false, message: 'User demo não existe.' });

    // Tenant DB: pega o pool do tenant do demo
    const tenantPoolHelper = require('../lib/tenant-pool');
    const tenantInfo = await req.db.query('SELECT current_tenant_id FROM users WHERE id = $1', [demoUserId]);
    const tenantId = tenantInfo.rows[0]?.current_tenant_id;
    let tenantDb = req.db;
    if (tenantId) {
      try { tenantDb = await tenantPoolHelper.getTenantPool(req.db, tenantId); } catch (_) { tenantDb = req.db; }
    }
    if (!tenantDb) tenantDb = req.db;

    // Deleta linhas existentes do produto pra esse user (substitui o cenário)
    const delRes = await tenantDb.query(
      `DELETE FROM lj_hotmart_purchases WHERE user_id = $1 AND product_id_lj = $2`,
      [demoUserId, productId]
    );
    const deleted = delRes.rowCount || 0;

    // Gera N transações espalhadas no windowDays
    const now = Date.now();
    const windowMs = windowD * 24 * 3600 * 1000;
    let inserted = 0;

    for (let batchStart = 0; batchStart < count; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, count);
      const valuesSql = [];
      const params = [];
      let p = 1;

      for (let i = batchStart; i < batchEnd; i++) {
        // Distribui uniformemente no windowDays usando idx (sem Math.random pra determinismo)
        const ratio = i / count;
        const offsetMs = ratio * windowMs;
        const occurredAt = new Date(now - offsetMs).toISOString();
        const transactionId = `demo-${productId}-${i.toString().padStart(8, '0')}`;
        const valueCents = avgValueCents;
        const buyerEmail = `demo+${i}@leadjourney.app`;

        valuesSql.push(
          `($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`
        );
        params.push(
          demoUserId,             // user_id
          transactionId,          // transaction_id
          productIdHotmart,       // product_id_hotmart
          productId,              // product_id_lj
          buyerEmail,             // buyer_email
          `Comprador ${i}`,       // buyer_name
          null,                   // buyer_phone
          'approved',             // purchase_status
          valueCents,             // transaction_value_cents
          Math.round(valueCents * 0.7), // commission_cents (70% líquido)
          'BRL',                  // currency
          false,                  // is_recurring
          null,                   // recurrence_number
          null,                   // cancellation_reason
          JSON.stringify({ synthetic: true, source: 'admin-populate-demo-hotmart' }), // raw_payload
          occurredAt              // occurred_at
        );
      }

      await tenantDb.query(
        `INSERT INTO lj_hotmart_purchases
           (user_id, transaction_id, product_id_hotmart, product_id_lj, buyer_email, buyer_name, buyer_phone,
            purchase_status, transaction_value_cents, commission_cents, currency,
            is_recurring, recurrence_number, cancellation_reason, raw_payload, occurred_at)
         VALUES ${valuesSql.join(', ')}
         ON CONFLICT (user_id, transaction_id) DO NOTHING`,
        params
      );

      inserted += (batchEnd - batchStart);
    }

    return res.status(200).json({
      ok: true,
      applied: true,
      productId,
      deleted,
      inserted,
      avgValueCents,
      windowDays: windowD,
      hint: 'Faça Actions.loadPipelineVelocitySummary({ force: true }) no client pra atualizar o cache.'
    });
  } catch (err) {
    console.error('[admin-populate-demo-hotmart]', err);
    return res.status(500).json({ ok: false, message: err.message, stack: err.stack });
  }
};
