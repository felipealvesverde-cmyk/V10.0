// V35.7.0-alpha1 — Dados fictícios de Google Ads pra cliente novo (sem
// sync real) ou conta de teste.
// V35.7.1 — Expandido com Grupo 3 (8 indicadores avançados) pra alimentar
// a sub-aba "Visão Geral" e o modal "Avançados".
//
// Estrutura espelha os campos GAQL reais que serão importados na alpha4+:
//   - campaign.{id, name, status, advertising_channel_type, bidding_strategy_type}
//   - campaign_budget.amount_micros
//   - metrics_30d.* (Grupo 1 + 2 + 3)
//
// Todas as 4 entram ÓRFÃS (lj_campaign_id = null) pra demonstrar o fluxo
// de associação. Cliente cria/escolhe Campanha LJ e amarra via wizard.

window.GoogleAdsMockCampaigns = {
  data: [
    {
      campaign_id: '11000001',
      campaign_name: 'Black Friday 2025 — Search Brand',
      advertising_channel_type: 'SEARCH',
      status: 'ENABLED',
      bidding_strategy_type: 'TARGET_CPA',
      daily_budget_brl: 600.00,
      metrics_30d: {
        // Grupo 1 + 2
        cost_brl: 12480.50,
        impressions: 248320,
        clicks: 8420,
        ctr: 3.39,
        average_cpc: 1.48,
        average_cpm: 50.26,
        conversions: 47,
        conversions_value: 84500.00,
        cost_per_conversion: 265.54,
        value_per_conversion: 1797.87,
        // Grupo 3
        all_conversions: 62,
        all_conversions_value: 96400.00,
        cost_per_all_conversions: 201.30,
        value_per_all_conversions: 1554.84,
        view_through_conversions: 15,
        conversions_from_interactions_rate: 0.56,
        search_impression_share: 78.4,
        search_top_impression_share: 65.2
      }
    },
    {
      campaign_id: '11000002',
      campaign_name: 'Black Friday 2025 — YouTube Awareness',
      advertising_channel_type: 'VIDEO',
      status: 'ENABLED',
      bidding_strategy_type: 'MAXIMIZE_CONVERSIONS',
      daily_budget_brl: 400.00,
      metrics_30d: {
        cost_brl: 8730.20,
        impressions: 487210,
        clicks: 4120,
        ctr: 0.85,
        average_cpc: 2.12,
        average_cpm: 17.92,
        conversions: 18,
        conversions_value: 32400.00,
        cost_per_conversion: 485.01,
        value_per_conversion: 1800.00,
        all_conversions: 31,
        all_conversions_value: 47400.00,
        cost_per_all_conversions: 281.62,
        value_per_all_conversions: 1529.03,
        view_through_conversions: 13,
        conversions_from_interactions_rate: 0.44,
        search_impression_share: null,    // YouTube não tem
        search_top_impression_share: null
      }
    },
    {
      campaign_id: '11000003',
      campaign_name: 'Black Friday 2025 — Display Remarketing',
      advertising_channel_type: 'DISPLAY',
      status: 'ENABLED',
      bidding_strategy_type: 'TARGET_ROAS',
      daily_budget_brl: 200.00,
      metrics_30d: {
        cost_brl: 3210.75,
        impressions: 920140,
        clicks: 5810,
        ctr: 0.63,
        average_cpc: 0.55,
        average_cpm: 3.49,
        conversions: 12,
        conversions_value: 21600.00,
        cost_per_conversion: 267.56,
        value_per_conversion: 1800.00,
        all_conversions: 28,
        all_conversions_value: 41600.00,
        cost_per_all_conversions: 114.67,
        value_per_all_conversions: 1485.71,
        view_through_conversions: 16,
        conversions_from_interactions_rate: 0.21,
        search_impression_share: null,
        search_top_impression_share: null
      }
    },
    {
      campaign_id: '11000004',
      campaign_name: 'Always-on Performance Max',
      advertising_channel_type: 'PERFORMANCE_MAX',
      status: 'ENABLED',
      bidding_strategy_type: 'MAXIMIZE_CONVERSION_VALUE',
      daily_budget_brl: 500.00,
      metrics_30d: {
        cost_brl: 9420.00,
        impressions: 312880,
        clicks: 6240,
        ctr: 1.99,
        average_cpc: 1.51,
        average_cpm: 30.11,
        conversions: 38,
        conversions_value: 68400.00,
        cost_per_conversion: 247.89,
        value_per_conversion: 1800.00,
        all_conversions: 52,
        all_conversions_value: 89400.00,
        cost_per_all_conversions: 181.15,
        value_per_all_conversions: 1719.23,
        view_through_conversions: 14,
        conversions_from_interactions_rate: 0.61,
        search_impression_share: null,    // PMax mistura redes, não expõe direto
        search_top_impression_share: null
      }
    }
  ],

  list() {
    return this.data.map(c => ({ ...c, is_mock: true }));
  }
};
