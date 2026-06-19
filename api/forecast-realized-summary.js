// V39.2.0 — GET /api/forecast-realized-summary
//
// Alimenta o card "Forecast × Realizado" da aba Resultados na camada Produto.
// Soma vendas Hotmart aprovadas do mês corrente (ou período passado por query)
// agregadas por product_id_lj (mapping cravado em product_mappings).
//
// Query:
//   period (YYYY-MM, opcional, default mês corrente)
//
// Response:
// {
//   ok: true,
//   period: { yyyymm, year, month, daysInMonth, daysPassed, today },
//   products: [
//     { product_id_lj, total_revenue_cents, approved_count }
//   ]
// }

const { resolveCredentialOwnerId } = require('../lib/credentials-owner');
const { buildDemoForecastRealizedMock } = require('../lib/demo-checkout-mock');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  // V40.7.12 — Branch demo: retorna mock coerente com /api/hotmart-dashboard-metrics
  // sem tocar em lj_hotmart_purchases (tabela inexistente no demo). Backlog:
  // [[backlog-provider-abstraction]].
  if (req.user.username === 'demo@leadjourney.app') {
    return res.status(200).json(buildDemoForecastRealizedMock(req.query || {}));
  }

  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(await resolveCredentialOwnerId(req));
  const now = new Date();
  const period = String(req.query?.period || '').match(/^\d{4}-\d{2}$/)
    ? String(req.query.period)
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [yearStr, monthStr] = period.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const fromDate = `${period}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const toDate = `${period}-${String(lastDay).padStart(2, '0')}`;
  // daysPassed: se mês passado, conta todos; se mês corrente, dia atual; se futuro, 0.
  const today = now.toISOString().slice(0, 10);
  let daysPassed = lastDay;
  if (period === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`) {
    daysPassed = now.getDate();
  } else if (new Date(fromDate) > now) {
    daysPassed = 0;
  }

  try {
    const r = await req.tenantDb.query(
      `SELECT
          product_id_lj,
          COUNT(*) FILTER (WHERE purchase_status = 'approved') AS approved_count,
          COALESCE(SUM(transaction_value_cents) FILTER (WHERE purchase_status = 'approved'), 0) AS total_revenue_cents
         FROM lj_hotmart_purchases
        WHERE user_id = $1
          AND product_id_lj IS NOT NULL
          AND occurred_at >= $2::date
          AND occurred_at <= ($3::date + INTERVAL '1 day')
        GROUP BY product_id_lj`,
      [userId, fromDate, toDate]
    );

    res.json({
      ok: true,
      period: {
        yyyymm: period,
        year,
        month,
        daysInMonth: lastDay,
        daysPassed,
        today
      },
      products: r.rows.map(row => ({
        product_id_lj: Number(row.product_id_lj),
        approved_count: Number(row.approved_count || 0),
        total_revenue_cents: Number(row.total_revenue_cents || 0)
      }))
    });
  } catch (err) {
    console.error('[forecast-realized-summary] erro:', err);
    res.status(500).json({ ok: false, message: err.message || 'Erro interno' });
  }
};
