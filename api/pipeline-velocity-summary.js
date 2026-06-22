// V39.3.0 — GET /api/pipeline-velocity-summary
//
// Alimenta a aba RevOps & Velocidade. Retorna, por CAMPANHA (para o frontend
// agregar por produto via campaign.productId) + por PRODUTO HOTMART:
//   - V (Visitas únicas)  no mês corrente
//   - C (Customers)       no mês corrente
//   - L (Ticket médio)    nas vendas Hotmart aprovadas dos últimos 30 dias
//   - T (Ciclo médio)     mediana de days(occurred_at - first_touch) dos
//                         visitors que viraram customers no período
//
// V39.3.0 atende cliente checkout — fontes existentes via tracker + Hotmart.
// Modo CRM/híbrido vai precisar de outra peça (deals fechados RD) em onda futura.

const { resolveCredentialOwnerId } = require('../lib/credentials-owner');
const { buildDemoVelocityMock } = require('../lib/demo-checkout-mock');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  // V40.7.16 → V40.11.22 — Branch demo com fallback.
  // SE lj_hotmart_purchases existe E tem dados pra esse user → cai na query
  // real (mesmo path dos outros tenants). SENÃO → mock estático.
  // Permite popular demo via admin-populate-demo-hotmart pra simular Checkout
  // real, sem quebrar demo que nunca rodou migration.
  if (req.user.username === 'demo@leadjourney.app') {
    try {
      const userRow = await req.db.query('SELECT id FROM users WHERE username = $1', ['demo@leadjourney.app']);
      const demoUserId = userRow.rows[0]?.id;
      let state = {};
      if (demoUserId) {
        const stateRow = await req.db.query('SELECT state_json FROM journey_state WHERE user_id = $1', [demoUserId]);
        state = stateRow.rows[0]?.state_json || {};
      }

      // Tenta query real se tabela existir + tiver dados pra esse user
      if (req.tenantDb) {
        try {
          const hasRealData = await req.tenantDb.query(
            `SELECT COUNT(*)::int AS n FROM lj_hotmart_purchases
              WHERE user_id = $1 AND purchase_status = 'approved'
              LIMIT 1`,
            [demoUserId]
          );
          if (hasRealData.rows[0]?.n > 0) {
            // Tem dados reais → deixa cair no path real (não retorna mock)
            console.log(`[pipeline-velocity-summary demo] usando query real (${hasRealData.rows[0].n} purchases approved)`);
          } else {
            return res.status(200).json(buildDemoVelocityMock(state));
          }
        } catch (probeErr) {
          // Tabela não existe ou outro erro → fallback mock
          return res.status(200).json(buildDemoVelocityMock(state));
        }
      } else {
        return res.status(200).json(buildDemoVelocityMock(state));
      }
    } catch (err) {
      console.warn('[pipeline-velocity-summary demo] erro:', err.message);
      return res.status(200).json(buildDemoVelocityMock({}));
    }
    // Se chegou aqui: tem dados reais → cai no path normal abaixo
  }

  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(await resolveCredentialOwnerId(req));
  const now = new Date();
  const yyyymm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const fromDate = `${yyyymm}-01`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const toDate = `${yyyymm}-${String(lastDay).padStart(2, '0')}`;
  const daysPassed = now.getDate();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  try {
    // Por campaign_id: visitas únicas + customers atribuídos
    const byCampaignR = await req.tenantDb.query(
      `WITH visitors_with_first_touch AS (
         SELECT
           t.campaign_id,
           t.lj_visitor_id,
           MIN(t.occurred_at) AS first_at
         FROM lj_visitor_touchpoints t
         WHERE t.user_id = $1
           AND t.occurred_at >= $2::date
           AND t.occurred_at <= ($3::date + INTERVAL '1 day')
           AND t.campaign_id IS NOT NULL
         GROUP BY t.campaign_id, t.lj_visitor_id
       )
       SELECT
         vf.campaign_id,
         COUNT(DISTINCT vf.lj_visitor_id) AS visitors,
         COUNT(DISTINCT CASE WHEN v.entity_type = 'customer' THEN vf.lj_visitor_id END) AS customers
       FROM visitors_with_first_touch vf
       LEFT JOIN lj_visitors v
         ON v.lj_visitor_id = vf.lj_visitor_id AND v.user_id = $1
       GROUP BY vf.campaign_id`,
      [userId, fromDate, toDate]
    );

    // Por product_id_lj: ticket médio e ciclo médio
    const byProductR = await req.tenantDb.query(
      `WITH purchases_recent AS (
         SELECT
           product_id_lj,
           lj_visitor_id,
           occurred_at,
           transaction_value_cents
         FROM lj_hotmart_purchases
         WHERE user_id = $1
           AND purchase_status = 'approved'
           AND product_id_lj IS NOT NULL
           AND occurred_at >= $2::date
       ),
       avg_ticket AS (
         SELECT
           product_id_lj,
           COUNT(*) AS approved_count,
           COALESCE(AVG(transaction_value_cents), 0) AS avg_value_cents
         FROM purchases_recent
         GROUP BY product_id_lj
       ),
       cycle AS (
         SELECT
           p.product_id_lj,
           EXTRACT(EPOCH FROM (p.occurred_at - t.first_at)) / 86400.0 AS days_to_buy
         FROM purchases_recent p
         JOIN (
           SELECT lj_visitor_id, MIN(occurred_at) AS first_at
           FROM lj_visitor_touchpoints
           WHERE user_id = $1
           GROUP BY lj_visitor_id
         ) t ON t.lj_visitor_id = p.lj_visitor_id
         WHERE p.occurred_at > t.first_at
       ),
       cycle_agg AS (
         SELECT
           product_id_lj,
           PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY days_to_buy) AS median_days
         FROM cycle
         GROUP BY product_id_lj
       )
       SELECT
         a.product_id_lj,
         a.approved_count,
         a.avg_value_cents,
         COALESCE(c.median_days, 0) AS median_days
       FROM avg_ticket a
       LEFT JOIN cycle_agg c ON c.product_id_lj = a.product_id_lj`,
      [userId, ninetyDaysAgo]
    );

    res.json({
      ok: true,
      period: { yyyymm, daysInMonth: lastDay, daysPassed },
      benchmarks: {
        conversion_avg: 0.03,           // 3% — referência genérica de conversão site/checkout
        conversion_good: 0.05,
        cycle_days_avg: 14,             // ciclo médio mercado infoproduto
        cycle_days_good: 7
      },
      byCampaign: byCampaignR.rows.map(r => ({
        campaign_id: Number(r.campaign_id),
        visitors: Number(r.visitors || 0),
        customers: Number(r.customers || 0)
      })),
      byProduct: byProductR.rows.map(r => ({
        product_id_lj: Number(r.product_id_lj),
        approved_count: Number(r.approved_count || 0),
        avg_ticket: Number(r.avg_value_cents || 0) / 100,
        cycle_days: Number(r.median_days || 0)
      }))
    });
  } catch (err) {
    console.error('[pipeline-velocity-summary] erro:', err);
    res.status(500).json({ ok: false, message: err.message || 'Erro interno' });
  }
};
