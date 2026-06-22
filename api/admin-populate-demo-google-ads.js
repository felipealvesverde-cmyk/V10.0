// V40.11.25 — Popula gasto Google Ads sintético no tenant demo.
// Pipeline completo: lj_google_ads_campaigns_daily (tabela real do pull) →
// /api/google-ads-campaigns-list lê → App.state.googleAdsCampaignsCache popula →
// recomputeAcquisitionAutoItem(productId, 'auto-google-ads') vincula em S&M →
// productMediaInvestment lê (V40.11.24) → CAC Realizado reflete.
//
// "Como se a Hotmart enviasse" mas pra Google Ads (Felipe 2026-06-21).
// A tabela final é a mesma que o pull real popula. Pula etapa HTTP do
// Google Ads API mas mantém schema 1:1.
//
// Body:
//   {
//     productId: 1781869701831,
//     totalCostBrl: 188000,      // gasto total 30d (vai pro item auto-google-ads)
//     daysSpread: 30,
//     manualSmItems: [           // opcional — items manuais que ficam ao lado do auto
//       { name: 'Time comercial', value: 60000 },
//       { name: 'Marketing brand', value: 20000 }
//     ]
//   }
//
// Retorna delta: { ok, campaigns, productFinance, externalCampaignIds }.

const tenantPoolHelper = require('../lib/tenant-pool');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  const isAllowed = req.user.isMaster || req.user.username === 'demo@leadjourney.app';
  if (!isAllowed) return res.status(403).json({ ok: false, message: 'Permissão negada.' });

  const { productId, totalCostBrl, daysSpread } = req.body || {};
  const manualSmItems = Array.isArray(req.body?.manualSmItems) ? req.body.manualSmItems : [];

  if (!productId) return res.status(400).json({ ok: false, message: 'productId obrigatório.' });
  if (!totalCostBrl || totalCostBrl < 1) return res.status(400).json({ ok: false, message: 'totalCostBrl obrigatório (>= 1).' });
  const days = Number(daysSpread) || 30;

  try {
    const DEMO_USERNAME = 'demo@leadjourney.app';
    const userRow = await req.db.query('SELECT id, default_tenant_id FROM users WHERE username = $1', [DEMO_USERNAME]);
    const demoUserId = userRow.rows[0]?.id;
    const tenantId = userRow.rows[0]?.default_tenant_id;
    if (!demoUserId) return res.status(404).json({ ok: false, message: 'User demo não existe.' });

    let tenantDb = req.db;
    if (tenantId) {
      try { tenantDb = await tenantPoolHelper.getTenantPool(req.db, tenantId); } catch (_) { tenantDb = req.db; }
    }
    if (!tenantDb) tenantDb = req.db;

    // 1. Bootstrap tabela lj_google_ads_campaigns_daily (idempotente)
    await tenantDb.query(`
      CREATE TABLE IF NOT EXISTS lj_google_ads_campaigns_daily (
        user_id INT NOT NULL,
        campaign_id VARCHAR(50) NOT NULL,
        date DATE NOT NULL,
        campaign_name VARCHAR(255),
        status VARCHAR(50),
        advertising_channel_type VARCHAR(50),
        cost_micros BIGINT,
        impressions BIGINT,
        clicks BIGINT,
        ctr DECIMAL(10,4),
        average_cpc DECIMAL(10,4),
        conversions DECIMAL(10,2),
        conversions_value DECIMAL(15,2),
        cost_per_conversion DECIMAL(10,2),
        synced_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (user_id, campaign_id, date)
      );
      CREATE INDEX IF NOT EXISTS idx_gads_daily_user_date
        ON lj_google_ads_campaigns_daily(user_id, date DESC);
    `);

    // 2. Pega state do demo
    const existing = await req.db.query('SELECT state_json FROM journey_state WHERE user_id = $1', [demoUserId]);
    if (existing.rowCount === 0) return res.status(409).json({ ok: false, message: 'Demo sem state.' });
    const state = existing.rows[0].state_json || {};

    // 3. Acha campanhas LJ ativas do produto
    state.campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
    const productCampaigns = state.campaigns.filter(c =>
      Number(c.productId) === Number(productId)
      && String(c.status || 'Ativa').toLowerCase() === 'ativa'
    );
    if (!productCampaigns.length) {
      return res.status(404).json({ ok: false, message: `Nenhuma campanha LJ ativa do produto ${productId}.` });
    }

    // 4. Distribui custo igualmente entre campanhas LJ.
    // Cada campanha LJ ganha 1 campanha Google Ads sintética com gasto diário.
    const totalCostMicros = Math.round(totalCostBrl * 1_000_000);
    const costPerCampaignMicros = Math.floor(totalCostMicros / productCampaigns.length);
    const costPerDayMicros = Math.floor(costPerCampaignMicros / days);

    const externalCampaignIds = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Limpa linhas antigas pra evitar acúmulo entre re-runs
    await tenantDb.query(
      `DELETE FROM lj_google_ads_campaigns_daily WHERE user_id = $1 AND campaign_id LIKE 'demo_gads_%'`,
      [demoUserId]
    );

    for (const ljCamp of productCampaigns) {
      const gAdsCampId = `demo_gads_${ljCamp.id}`;
      const gAdsCampName = `[Demo] ${ljCamp.name || `Camp ${ljCamp.id}`}`;
      externalCampaignIds.push({ ljCampaignId: ljCamp.id, gAdsCampId });

      // Insere 30 linhas (uma por dia) em batch
      const valuesSql = [];
      const params = [];
      let p = 1;
      for (let i = 0; i < days; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const impressions = Math.round(costPerDayMicros / 1500); // CPM ~R$ 1.500/k → 1.5 mil cents/impressão
        const clicks = Math.round(impressions * 0.025);          // CTR ~2.5%
        const conversions = Math.round(clicks * 0.04);           // CVR ~4%
        valuesSql.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
        params.push(
          demoUserId,             // user_id
          gAdsCampId,             // campaign_id
          dateStr,                // date
          gAdsCampName,           // campaign_name
          'ENABLED',              // status
          'SEARCH',               // advertising_channel_type
          costPerDayMicros,       // cost_micros
          impressions,            // impressions
          clicks,                 // clicks
          impressions > 0 ? (clicks / impressions) : 0,                                                // ctr
          clicks > 0 ? (costPerDayMicros / clicks / 1_000_000) : 0,                                    // average_cpc (BRL)
          conversions,            // conversions
          0,                      // conversions_value
          conversions > 0 ? (costPerDayMicros / conversions / 1_000_000) : 0                           // cost_per_conversion (BRL)
        );
      }
      await tenantDb.query(
        `INSERT INTO lj_google_ads_campaigns_daily
          (user_id, campaign_id, date, campaign_name, status, advertising_channel_type,
           cost_micros, impressions, clicks, ctr, average_cpc, conversions, conversions_value, cost_per_conversion)
         VALUES ${valuesSql.join(', ')}
         ON CONFLICT (user_id, campaign_id, date) DO UPDATE SET
           cost_micros = EXCLUDED.cost_micros,
           impressions = EXCLUDED.impressions,
           clicks = EXCLUDED.clicks,
           synced_at = NOW()`,
        params
      );

      // Vincula em state.campaigns[].externalLinks.googleAds
      ljCamp.externalLinks = ljCamp.externalLinks || {};
      ljCamp.externalLinks.googleAds = Array.isArray(ljCamp.externalLinks.googleAds) ? ljCamp.externalLinks.googleAds : [];
      if (!ljCamp.externalLinks.googleAds.includes(gAdsCampId)) {
        ljCamp.externalLinks.googleAds.push(gAdsCampId);
      }
    }

    // 5. Substitui items manuais no bucket='acquisition'. Items auto (auto-google-ads)
    // vão ser recriados via Actions.recomputeAcquisitionAutoItem no client.
    state.revopsFinanceV2 = state.revopsFinanceV2 || {};
    state.revopsFinanceV2[productId] = state.revopsFinanceV2[productId] || { groups: [] };
    const pfin = state.revopsFinanceV2[productId];
    pfin.groups = Array.isArray(pfin.groups) ? pfin.groups : [];

    let acqGroup = pfin.groups.find(g => g.bucket === 'acquisition');
    const ts = Date.now().toString(36);
    if (!acqGroup) {
      acqGroup = { id: `g_acquisition_${ts}`, label: 'S&M (Aquisição)', bucket: 'acquisition', items: [] };
      pfin.groups.push(acqGroup);
    }
    // Mantém só items source='auto-google-ads' (que vão ser recompostos no client);
    // substitui o resto pelos manualSmItems do body.
    const autoItems = (acqGroup.items || []).filter(it => it.source === 'auto-google-ads');
    const newManualItems = manualSmItems.map((it, idx) => ({
      id: `item_manual_${ts}_${idx}`,
      name: String(it.name || `Item ${idx + 1}`),
      calc: { mode: 'fixed', value: Number(it.value) || 0 }
    }));
    acqGroup.items = [...autoItems, ...newManualItems];

    // 6. Persiste state
    const newState = {
      ...state,
      lastSavedAt: new Date().toISOString()
    };
    await req.db.query(
      `UPDATE journey_state SET state_json = $1, updated_at = NOW(), updated_by_user_id = $2 WHERE user_id = $2`,
      [newState, demoUserId]
    );

    // 7. Retorna delta (campaigns e productFinance atualizados) — achado #15 evitado
    return res.status(200).json({
      ok: true,
      applied: true,
      productId,
      totalCostBrl,
      daysSpread: days,
      externalCampaignIds,
      campaignsUpdated: productCampaigns.length,
      campaigns: state.campaigns,
      productFinance: pfin
    });
  } catch (err) {
    console.error('[admin-populate-demo-google-ads]', err);
    return res.status(500).json({ ok: false, message: err.message, stack: err.stack });
  }
};
