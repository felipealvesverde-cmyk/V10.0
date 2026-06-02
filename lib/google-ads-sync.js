// V35.7.0-alpha4 — Sync de campanhas Google Ads.
//
// Roda a query GAQL oficial, parseia o resultado, faz UPSERT pela PK
// (user_id, campaign_id, date) em lj_google_ads_campaigns_daily.
//
// Janela retroativa de 30 dias por sync (cobre correções tardias do Google
// Ads — taxas de conversão e conversões assistidas podem chegar até 3
// dias depois).
//
// Pode ser disparado:
//   1. Manual via POST /api/google-ads-sync-trigger (botão na UI)
//   2. Cron 1x/dia (TODO — em release futura registrar setInterval no server.js)

const { searchGAQL, readConfig } = require('./google-ads-oauth');

const GAQL_QUERY = `
SELECT
  segments.date,
  campaign.id,
  campaign.name,
  campaign.status,
  campaign.advertising_channel_type,
  metrics.cost_micros,
  metrics.impressions,
  metrics.clicks,
  metrics.ctr,
  metrics.average_cpc,
  metrics.conversions,
  metrics.conversions_value,
  metrics.cost_per_conversion
FROM campaign
WHERE segments.date DURING LAST_30_DAYS
ORDER BY segments.date DESC
`.trim();

// Sync pra um usuário. Retorna { ok, rowsUpserted, errors }.
async function syncForUser(tenantDb, userId) {
  const cfg = await readConfig(tenantDb, userId);
  if (!cfg) return { ok: false, error: 'sem config Google Ads' };
  if (!cfg.selectedCustomerId) return { ok: false, error: 'sem customer selecionado' };
  if (!cfg.refreshToken) return { ok: false, error: 'OAuth não concluído' };

  let raw;
  try {
    raw = await searchGAQL(tenantDb, userId, cfg.selectedCustomerId, GAQL_QUERY);
  } catch (err) {
    return { ok: false, error: `GAQL falhou: ${err.message}` };
  }

  // GAQL retorna { results: [{ campaign: {...}, metrics: {...}, segments: {date} }, ...] }
  const rows = Array.isArray(raw.results) ? raw.results : [];
  if (!rows.length) return { ok: true, rowsUpserted: 0, note: 'sem campanhas no período' };

  let rowsUpserted = 0;
  const errors = [];
  for (const r of rows) {
    try {
      const campaign = r.campaign || {};
      const metrics = r.metrics || {};
      const segments = r.segments || {};
      await tenantDb.query(`
        INSERT INTO lj_google_ads_campaigns_daily (
          user_id, campaign_id, date,
          campaign_name, status, advertising_channel_type,
          cost_micros, impressions, clicks, ctr, average_cpc,
          conversions, conversions_value, cost_per_conversion,
          synced_at
        )
        VALUES ($1, $2, $3::date, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
        ON CONFLICT (user_id, campaign_id, date) DO UPDATE SET
          campaign_name = EXCLUDED.campaign_name,
          status = EXCLUDED.status,
          advertising_channel_type = EXCLUDED.advertising_channel_type,
          cost_micros = EXCLUDED.cost_micros,
          impressions = EXCLUDED.impressions,
          clicks = EXCLUDED.clicks,
          ctr = EXCLUDED.ctr,
          average_cpc = EXCLUDED.average_cpc,
          conversions = EXCLUDED.conversions,
          conversions_value = EXCLUDED.conversions_value,
          cost_per_conversion = EXCLUDED.cost_per_conversion,
          synced_at = NOW()
      `, [
        userId,
        String(campaign.id || ''),
        segments.date,                    // YYYY-MM-DD
        campaign.name || null,
        campaign.status || null,
        campaign.advertisingChannelType || null,
        Number(metrics.costMicros || 0),
        Number(metrics.impressions || 0),
        Number(metrics.clicks || 0),
        Number(metrics.ctr || 0),
        Number(metrics.averageCpc || 0) / 1_000_000,    // micros → unit
        Number(metrics.conversions || 0),
        Number(metrics.conversionsValue || 0),
        Number(metrics.costPerConversion || 0) / 1_000_000
      ]);
      rowsUpserted++;
    } catch (err) {
      errors.push({ campaign_id: r.campaign?.id, message: err.message });
    }
  }

  return { ok: true, rowsUpserted, errors };
}

// Lista campanhas agregadas dos últimos 30 dias pra um usuário.
// Retorna mesma estrutura do mock (campaign_id, campaign_name, ..., metrics_30d).
async function listCampaignsAggregated30d(tenantDb, userId) {
  const result = await tenantDb.query(`
    SELECT
      campaign_id,
      MAX(campaign_name) as campaign_name,
      MAX(status) as status,
      MAX(advertising_channel_type) as advertising_channel_type,
      SUM(cost_micros) as total_cost_micros,
      SUM(impressions) as total_impressions,
      SUM(clicks) as total_clicks,
      SUM(conversions) as total_conversions,
      SUM(conversions_value) as total_conversions_value
    FROM lj_google_ads_campaigns_daily
    WHERE user_id = $1
      AND date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY campaign_id
  `, [userId]);

  return result.rows.map(row => {
    const costBrl = Number(row.total_cost_micros || 0) / 1_000_000;
    const impressions = Number(row.total_impressions || 0);
    const clicks = Number(row.total_clicks || 0);
    const conversions = Number(row.total_conversions || 0);
    const conversionsValue = Number(row.total_conversions_value || 0);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const averageCpc = clicks > 0 ? costBrl / clicks : 0;
    const costPerConversion = conversions > 0 ? costBrl / conversions : 0;
    const valuePerConversion = conversions > 0 ? conversionsValue / conversions : 0;
    return {
      campaign_id: row.campaign_id,
      campaign_name: row.campaign_name,
      status: row.status,
      advertising_channel_type: row.advertising_channel_type,
      metrics_30d: {
        cost_brl: Number(costBrl.toFixed(2)),
        impressions,
        clicks,
        ctr: Number(ctr.toFixed(2)),
        average_cpc: Number(averageCpc.toFixed(2)),
        conversions,
        conversions_value: Number(conversionsValue.toFixed(2)),
        cost_per_conversion: Number(costPerConversion.toFixed(2)),
        value_per_conversion: Number(valuePerConversion.toFixed(2))
      }
    };
  });
}

module.exports = { syncForUser, listCampaignsAggregated30d, GAQL_QUERY };
