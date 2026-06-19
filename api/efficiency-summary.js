// V39.4.0 — GET /api/efficiency-summary
//
// Alimenta o card "Eficiência de Capital" (A4) na aba RevOps & Velocidade.
// Por produto:
//   - LTV médio       (SUM transaction_value por customer / customer count)
//   - customers       (DISTINCT lj_visitor_id com pelo menos 1 venda aprovada)
//   - has_subscriptions (BOOL: produto tem ao menos 1 compra com is_recurring=true)
//   - refunds / cancellations (últimos 90 dias)
//   - active_customers_30d  (customers com venda aprovada nos últimos 30 dias)
//
// CAC vem do frontend (revopsFinanceV2[pid] via RevopsWhitelabelEngine).
// Engine calcula LTV:CAC, Payback e NRR no frontend combinando.

const { resolveCredentialOwnerId } = require('../lib/credentials-owner');
const { buildEfficiencySummary } = require('../lib/demo-system-mocks');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  // V40.7.19 — Branch demo (tabela lj_hotmart_purchases não existe). Alimenta
  // card A4 "Eficiência de Capital" da RevOps & Velocidade com LTV/refunds.
  if (req.user.username === 'demo@leadjourney.app') {
    return res.status(200).json(buildEfficiencySummary());
  }

  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(await resolveCredentialOwnerId(req));
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  try {
    // LTV por produto: soma vendas por customer, depois agrega.
    const r = await req.tenantDb.query(
      `WITH customer_totals AS (
         SELECT
           product_id_lj,
           lj_visitor_id,
           SUM(transaction_value_cents) FILTER (WHERE purchase_status = 'approved') AS total_cents,
           BOOL_OR(COALESCE(is_recurring, false)) AS has_recurring,
           MAX(occurred_at) FILTER (WHERE purchase_status = 'approved') AS last_approved_at
         FROM lj_hotmart_purchases
         WHERE user_id = $1 AND product_id_lj IS NOT NULL AND lj_visitor_id IS NOT NULL
         GROUP BY product_id_lj, lj_visitor_id
         HAVING SUM(transaction_value_cents) FILTER (WHERE purchase_status = 'approved') > 0
       ),
       per_product AS (
         SELECT
           product_id_lj,
           COUNT(*) AS customers_count,
           AVG(total_cents)::bigint AS avg_ltv_cents,
           SUM(total_cents)::bigint AS total_revenue_cents,
           BOOL_OR(has_recurring) AS has_subscriptions,
           COUNT(*) FILTER (WHERE last_approved_at >= $2::date) AS active_30d
         FROM customer_totals
         GROUP BY product_id_lj
       ),
       refunds_cancels AS (
         SELECT
           product_id_lj,
           COUNT(*) FILTER (WHERE purchase_status = 'refunded' AND occurred_at >= $3::date) AS refunds_90d,
           COUNT(*) FILTER (WHERE purchase_status = 'canceled' AND occurred_at >= $3::date) AS cancellations_90d,
           COUNT(*) FILTER (WHERE purchase_status = 'refunded' AND occurred_at >= $2::date) AS refunds_30d,
           COUNT(*) FILTER (WHERE purchase_status = 'canceled' AND occurred_at >= $2::date) AS cancellations_30d
         FROM lj_hotmart_purchases
         WHERE user_id = $1 AND product_id_lj IS NOT NULL
         GROUP BY product_id_lj
       )
       SELECT
         p.product_id_lj,
         p.customers_count,
         p.avg_ltv_cents,
         p.total_revenue_cents,
         p.has_subscriptions,
         p.active_30d,
         COALESCE(rc.refunds_90d, 0) AS refunds_90d,
         COALESCE(rc.cancellations_90d, 0) AS cancellations_90d,
         COALESCE(rc.refunds_30d, 0) AS refunds_30d,
         COALESCE(rc.cancellations_30d, 0) AS cancellations_30d
       FROM per_product p
       LEFT JOIN refunds_cancels rc ON rc.product_id_lj = p.product_id_lj`,
      [userId, thirtyDaysAgo, ninetyDaysAgo]
    );

    res.json({
      ok: true,
      window: { ninetyDaysAgo, thirtyDaysAgo, today: new Date().toISOString().slice(0, 10) },
      benchmarks: {
        ltv_cac_healthy: 3.0,        // ≥ 3:1
        payback_healthy_months: 12,  // < 12 meses
        nrr_healthy: 1.0,            // ≥ 100%
        nrr_excellent: 1.10          // ≥ 110%
      },
      byProduct: r.rows.map(row => ({
        product_id_lj: Number(row.product_id_lj),
        customers_count: Number(row.customers_count || 0),
        ltv: Number(row.avg_ltv_cents || 0) / 100,
        total_revenue: Number(row.total_revenue_cents || 0) / 100,
        has_subscriptions: !!row.has_subscriptions,
        active_30d: Number(row.active_30d || 0),
        refunds_90d: Number(row.refunds_90d || 0),
        cancellations_90d: Number(row.cancellations_90d || 0),
        refunds_30d: Number(row.refunds_30d || 0),
        cancellations_30d: Number(row.cancellations_30d || 0)
      }))
    });
  } catch (err) {
    console.error('[efficiency-summary] erro:', err);
    res.status(500).json({ ok: false, message: err.message || 'Erro interno' });
  }
};
