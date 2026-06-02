// V35.7.0-alpha1 — Dados fictícios de Google Ads pra cliente novo (sem
// sync real) ou conta de teste. Quando o sync real do Google Ads importar
// dados de verdade pro tenant, esses mocks somem (frontend prioriza dados
// reais quando existem).
//
// Estrutura espelha os campos GAQL reais que serão importados na alpha4:
//   - campaign.{id, name, status, advertising_channel_type}
//   - metrics_30d.{cost_brl, impressions, clicks, ctr, average_cpc,
//                  conversions, conversions_value, cost_per_conversion,
//                  value_per_conversion}
//
// Todas as 4 entram ÓRFÃS (lj_campaign_id = null) pra demonstrar o fluxo
// de associação. Cliente cria/escolhe Campanha LJ e amarra via wizard.

window.GoogleAdsMockCampaigns = {
  // V35.7.0-alpha1 — Versão fixa pra que o user veja sempre os mesmos
  // números. Não usar Date.now() ou Math.random() aqui — frustra "F5 muda
  // tudo" se cliente for comparar print/screenshot.
  data: [
    {
      campaign_id: '11000001',
      campaign_name: 'Black Friday 2025 — Search Brand',
      advertising_channel_type: 'SEARCH',
      status: 'ENABLED',
      metrics_30d: {
        cost_brl: 12480.50,
        impressions: 248320,
        clicks: 8420,
        ctr: 3.39,                       // %
        average_cpc: 1.48,
        conversions: 47,
        conversions_value: 84500.00,
        cost_per_conversion: 265.54,
        value_per_conversion: 1797.87
      }
    },
    {
      campaign_id: '11000002',
      campaign_name: 'Black Friday 2025 — YouTube Awareness',
      advertising_channel_type: 'VIDEO',
      status: 'ENABLED',
      metrics_30d: {
        cost_brl: 8730.20,
        impressions: 487210,
        clicks: 4120,
        ctr: 0.85,
        average_cpc: 2.12,
        conversions: 18,
        conversions_value: 32400.00,
        cost_per_conversion: 485.01,
        value_per_conversion: 1800.00
      }
    },
    {
      campaign_id: '11000003',
      campaign_name: 'Black Friday 2025 — Display Remarketing',
      advertising_channel_type: 'DISPLAY',
      status: 'ENABLED',
      metrics_30d: {
        cost_brl: 3210.75,
        impressions: 920140,
        clicks: 5810,
        ctr: 0.63,
        average_cpc: 0.55,
        conversions: 12,
        conversions_value: 21600.00,
        cost_per_conversion: 267.56,
        value_per_conversion: 1800.00
      }
    },
    {
      campaign_id: '11000004',
      campaign_name: 'Always-on Performance Max',
      advertising_channel_type: 'PERFORMANCE_MAX',
      status: 'ENABLED',
      metrics_30d: {
        cost_brl: 9420.00,
        impressions: 312880,
        clicks: 6240,
        ctr: 1.99,
        average_cpc: 1.51,
        conversions: 38,
        conversions_value: 68400.00,
        cost_per_conversion: 247.89,
        value_per_conversion: 1800.00
      }
    }
  ],

  // Retorna a lista mock SEMPRE que chamado. Caller decide se usa mock
  // (cliente sem dados reais) ou ignora (sync real preenche state).
  list() {
    return this.data.map(c => ({ ...c, is_mock: true }));
  }
};
