// V35.1.0 — GET /api/hotmart-dashboard-metrics
// Alimenta a Tab Checkout do Dashboard com KPIs + lista paginada.
//
// Query:
//   product_id_hotmart  (opcional — filtra por produto; 'all' = agrega)
//   limit, offset       (paginação da lista de transações)
//   from_date, to_date  (opcional — filtra janela; default 30 dias)
//   reason              (V35.2.1 opcional — filtra transações por
//                        cancellation_reason quando ativo no breakdown)

const { REASON_MAP, REASON_OTHERS } = require('../lib/lj-hotmart-service');
const { resolveCredentialOwnerId } = require('../lib/credentials-owner');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  // V37.4.34 — Purchases vivem na linha do OWNER do tenant.
  const userId = Number(await resolveCredentialOwnerId(req));
  const productFilter = String(req.query?.product_id_hotmart || 'all').trim();
  const reasonFilter = String(req.query?.reason || '').trim().toUpperCase();
  const limit = Math.min(Number(req.query?.limit || 50), 500);
  const offset = Math.max(Number(req.query?.offset || 0), 0);
  const days = Math.min(Number(req.query?.days || 30), 365);

  const fromDate = req.query?.from_date || new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const toDate = req.query?.to_date || new Date().toISOString().slice(0, 10);

  try {
    const productWhere = productFilter && productFilter !== 'all'
      ? 'AND product_id_hotmart = $4' : '';
    const productParam = productFilter && productFilter !== 'all' ? [productFilter] : [];

    // 1. KPIs agregados (no período)
    const kpiR = await req.tenantDb.query(
      `SELECT
         COUNT(*) FILTER (WHERE purchase_status = 'approved')        AS approved_count,
         COUNT(*) FILTER (WHERE purchase_status = 'refunded')        AS refunded_count,
         COUNT(*) FILTER (WHERE purchase_status = 'chargeback')      AS chargeback_count,
         COUNT(*) FILTER (WHERE purchase_status = 'canceled')        AS canceled_count,
         COUNT(*) FILTER (WHERE purchase_status = 'billet_printed')  AS billet_count,
         COUNT(*)                                                    AS total_count,
         COALESCE(SUM(transaction_value_cents) FILTER (WHERE purchase_status = 'approved'), 0) AS total_revenue_cents,
         COALESCE(SUM(commission_cents)        FILTER (WHERE purchase_status = 'approved'), 0) AS total_commission_cents,
         COALESCE(AVG(transaction_value_cents) FILTER (WHERE purchase_status = 'approved'), 0) AS avg_ticket_cents
         FROM lj_hotmart_purchases
        WHERE user_id = $1
          AND occurred_at >= $2::date
          AND occurred_at <= ($3::date + INTERVAL '1 day')
          ${productWhere}`,
      [userId, fromDate, toDate, ...productParam]
    );

    // 2. Lista de produtos distintos (pra montar sub-tabs)
    const productsR = await req.tenantDb.query(
      `SELECT
          p.product_id_hotmart,
          COALESCE((p.raw_payload->'data'->'product'->>'name'), 'Produto sem nome') AS product_name,
          COUNT(*) AS purchase_count,
          COALESCE(SUM(p.transaction_value_cents) FILTER (WHERE p.purchase_status = 'approved'), 0) AS revenue_cents
         FROM lj_hotmart_purchases p
        WHERE p.user_id = $1
          AND p.product_id_hotmart IS NOT NULL
        GROUP BY p.product_id_hotmart, product_name
        ORDER BY purchase_count DESC
        LIMIT 50`,
      [userId]
    );

    // 3. Lista paginada de transações (no período + filtro de produto + filtro de reason)
    // V35.2.1 — quando reason está setado, filtra cancelamentos com o motivo
    const reasonWhere = reasonFilter
      ? (reasonFilter === 'OTHERS'
         ? `AND purchase_status = 'canceled' AND (cancellation_reason IS NULL OR cancellation_reason NOT IN (${Object.keys(REASON_MAP).map((_, i) => `$${productParam.length + 4 + i}`).join(', ')}))`
         : `AND purchase_status = 'canceled' AND cancellation_reason = $${productParam.length + 4}`)
      : '';
    const reasonParams = reasonFilter
      ? (reasonFilter === 'OTHERS' ? Object.keys(REASON_MAP) : [reasonFilter])
      : [];
    const txParams = [userId, fromDate, toDate, ...productParam, ...reasonParams, limit, offset];
    const limitIdx  = productParam.length + reasonParams.length + 4;
    const offsetIdx = limitIdx + 1;
    const txR = await req.tenantDb.query(
      `SELECT
          transaction_id, product_id_hotmart, product_id_lj,
          buyer_email, buyer_name, buyer_phone,
          purchase_status, transaction_value_cents, commission_cents, currency,
          is_recurring, recurrence_number, occurred_at, cancellation_reason,
          raw_payload->'data'->'product'->>'name' AS product_name,
          raw_payload->'data'->'purchase'->'payment'->>'type' AS payment_method,
          raw_payload->'data'->'purchase'->'payment'->>'installments_number' AS installments
         FROM lj_hotmart_purchases
        WHERE user_id = $1
          AND occurred_at >= $2::date
          AND occurred_at <= ($3::date + INTERVAL '1 day')
          ${productWhere}
          ${reasonWhere}
        ORDER BY occurred_at DESC
        LIMIT $${limitIdx}
        OFFSET $${offsetIdx}`,
      txParams
    );

    // 3.1. V35.2.1 — Agregado de motivos de recusa no período (sempre, sem filtro de reason)
    const reasonsR = await req.tenantDb.query(
      `SELECT cancellation_reason, COUNT(*) AS count
         FROM lj_hotmart_purchases
        WHERE user_id = $1
          AND purchase_status = 'canceled'
          AND occurred_at >= $2::date
          AND occurred_at <= ($3::date + INTERVAL '1 day')
          ${productWhere}
        GROUP BY cancellation_reason
        ORDER BY count DESC`,
      [userId, fromDate, toDate, ...productParam]
    );
    const knownReasons = new Set(Object.keys(REASON_MAP));
    const reasons = [];
    let othersCount = 0;
    const othersList = [];
    for (const row of reasonsR.rows) {
      const reason = row.cancellation_reason;
      const count = Number(row.count);
      if (reason && knownReasons.has(reason)) {
        reasons.push({
          code: reason,
          label: REASON_MAP[reason].label,
          tag: REASON_MAP[reason].tag,
          count
        });
      } else {
        othersCount += count;
        if (reason) othersList.push({ code: reason, count });
      }
    }
    if (othersCount > 0) {
      reasons.push({
        code: 'OTHERS',
        label: REASON_OTHERS.label,
        tag: REASON_OTHERS.tag,
        count: othersCount,
        details: othersList
      });
    }

    // 4. Série temporal por dia (pro gráfico)
    const seriesR = await req.tenantDb.query(
      `SELECT
          DATE(occurred_at) AS day,
          COUNT(*) FILTER (WHERE purchase_status = 'approved') AS approved,
          COALESCE(SUM(transaction_value_cents) FILTER (WHERE purchase_status = 'approved'), 0) AS revenue_cents
         FROM lj_hotmart_purchases
        WHERE user_id = $1
          AND occurred_at >= $2::date
          AND occurred_at <= ($3::date + INTERVAL '1 day')
          ${productWhere}
        GROUP BY DATE(occurred_at)
        ORDER BY day ASC`,
      [userId, fromDate, toDate, ...productParam]
    );

    const kpis = kpiR.rows[0] || {};
    return res.status(200).json({
      ok: true,
      period: { fromDate, toDate, days },
      productFilter,
      reasonFilter: reasonFilter || null,
      kpis: {
        approvedCount:   Number(kpis.approved_count || 0),
        refundedCount:   Number(kpis.refunded_count || 0),
        chargebackCount: Number(kpis.chargeback_count || 0),
        canceledCount:   Number(kpis.canceled_count || 0),
        billetCount:     Number(kpis.billet_count || 0),
        totalCount:      Number(kpis.total_count || 0),
        totalRevenueCents:    Number(kpis.total_revenue_cents || 0),
        totalCommissionCents: Number(kpis.total_commission_cents || 0),
        avgTicketCents:       Number(kpis.avg_ticket_cents || 0)
      },
      cancellationReasons: reasons,  // V35.2.1 — alimenta breakdown
      products: productsR.rows.map(p => ({
        productIdHotmart: p.product_id_hotmart,
        productName: p.product_name,
        purchaseCount: Number(p.purchase_count),
        revenueCents: Number(p.revenue_cents)
      })),
      transactions: txR.rows,
      pagination: { limit, offset, total: Number(kpis.total_count || 0) },
      series: seriesR.rows.map(s => ({
        day: s.day,
        approved: Number(s.approved),
        revenueCents: Number(s.revenue_cents)
      }))
    });
  } catch (err) {
    console.error('[hotmart-dashboard-metrics]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
