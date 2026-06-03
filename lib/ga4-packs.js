// V35.14.1 — Definição declarativa dos 9 packs do GA4.
//
// Fonte única da verdade pra:
//   - sync (que dimensions+metrics pedir pra Data API)
//   - frontend (wizard mostra os packs disponíveis)
//   - dashboards (saber o que esperar nas linhas do JSONB)
//
// Cada pack tem id, label, descrição curta, métricas e dimensões.
// Campos vêm da doc oficial GA4 Data API + DigitalApplied 2026 reference.
// Quando uma métrica aparece em vários packs, só conta uma vez no resolve.

const PACKS = {
  // -------------------------------------------------------------------------
  // 0. ESSENCIAL — sempre ligado, base de todo cliente.
  // -------------------------------------------------------------------------
  essential: {
    id: 'essential',
    label: 'Essencial',
    description: 'Tráfego básico, origem, dispositivo, conversões. Base de todo cliente.',
    alwaysOn: true,
    metrics: [
      'sessions', 'totalUsers', 'newUsers', 'activeUsers',
      'screenPageViews', 'eventCount',
      'conversions', 'conversionRate'
    ],
    dimensions: [
      'date', 'sessionDefaultChannelGroup', 'sessionSourceMedium',
      'deviceCategory', 'country'
    ]
  },

  // -------------------------------------------------------------------------
  // 1. INSTITUCIONAL — site simples, sem e-commerce.
  // -------------------------------------------------------------------------
  institutional: {
    id: 'institutional',
    label: 'Institucional / Site Simples',
    description: 'Engajamento + conteúdo mais consumido. Pra empresa de serviço, blog corporativo, portfólio.',
    metrics: [
      'engagedSessions', 'engagementRate', 'bounceRate',
      'averageSessionDuration', 'userEngagementDuration'
    ],
    dimensions: [
      'pagePath', 'pageTitle', 'landingPage'
    ]
  },

  // -------------------------------------------------------------------------
  // 2. LEAD GEN / SAAS / SERVIÇOS — captação por formulário, fecha no comercial.
  // -------------------------------------------------------------------------
  leadgen: {
    id: 'leadgen',
    label: 'Lead Gen / SaaS / Serviços',
    description: 'Atribuição de campanha, performance por LP, first touch vs last touch.',
    metrics: [
      'sessionsPerUser', 'screenPageViewsPerSession', 'eventCountPerUser'
    ],
    dimensions: [
      'sessionCampaignName', 'sessionCampaignId',
      'firstUserSource', 'firstUserMedium', 'firstUserCampaignName',
      'landingPagePlusQueryString',
      'eventName', 'newVsReturning'
    ]
  },

  // -------------------------------------------------------------------------
  // 3. E-COMMERCE — loja online (fluxo dedicado de wizard).
  // -------------------------------------------------------------------------
  ecommerce: {
    id: 'ecommerce',
    label: 'E-commerce',
    description: 'Funil completo de compra, receita, ticket médio, devoluções.',
    metrics: [
      'purchaseRevenue', 'totalRevenue', 'refundAmount', 'refunds',
      'transactions', 'ecommercePurchases',
      'addToCarts', 'checkouts',
      'itemsPurchased', 'averagePurchaseRevenue', 'averagePurchaseRevenuePerPayingUser'
    ],
    dimensions: [
      'itemName', 'itemId', 'itemBrand',
      'itemCategory', 'itemCategory2',
      'itemVariant', 'currencyCode', 'orderCoupon'
    ]
  },

  // -------------------------------------------------------------------------
  // 4. ADS / PERFORMANCE — quando GA4 está linkado ao Google Ads.
  // -------------------------------------------------------------------------
  ads: {
    id: 'ads',
    label: 'Ads / Performance Marketing',
    description: 'Custos, ROAS e atribuição vindas do Google Ads. Requer GA4 ↔ Google Ads linkado.',
    metrics: [
      'googleAdsCost', 'googleAdsClicks', 'googleAdsImpressions',
      'returnOnAdSpend', 'costPerClick', 'costPerConversion'
    ],
    dimensions: [
      'googleAdsCampaignName', 'googleAdsCampaignId', 'googleAdsCampaignType',
      'googleAdsAdGroupName', 'googleAdsAdGroupId',
      'googleAdsKeyword', 'googleAdsQuery', 'googleAdsAdNetworkType'
    ]
  },

  // -------------------------------------------------------------------------
  // 5. CONTEÚDO / MÍDIA / BLOG — foco em consumo profundo.
  // -------------------------------------------------------------------------
  content: {
    id: 'content',
    label: 'Conteúdo / Mídia / Blog',
    description: 'Profundidade de leitura, downloads, links externos, busca interna.',
    metrics: [
      'scrolledUsers'
    ],
    dimensions: [
      'pagePath', 'pageTitle', 'pageLocation', 'pageReferrer',
      'contentGroup', 'contentType', 'contentId',
      'searchTerm',
      'fileExtension', 'fileName',
      'linkUrl', 'linkDomain', 'linkText'
    ]
  },

  // -------------------------------------------------------------------------
  // 6. APP MOBILE — iOS / Android.
  // -------------------------------------------------------------------------
  mobile: {
    id: 'mobile',
    label: 'App Mobile (iOS / Android)',
    description: 'Retention DAU/MAU, estabilidade (crashes), hardware do usuário.',
    metrics: [
      'active1DayUsers', 'active7DayUsers', 'active28DayUsers',
      'dauPerMau', 'dauPerWau', 'wauPerMau',
      'crashAffectedUsers', 'crashFreeUsersRate',
      'firstTimePurchasers', 'purchasers'
    ],
    dimensions: [
      'platform', 'platformDeviceCategory',
      'operatingSystem', 'operatingSystemVersion',
      'mobileDeviceBranding', 'mobileDeviceMarketingName', 'mobileDeviceModel',
      'achievementId', 'character', 'level'
    ]
  },

  // -------------------------------------------------------------------------
  // 7. PREDITIVO — exige volume mínimo (ML treinado na propriedade).
  // -------------------------------------------------------------------------
  predictive: {
    id: 'predictive',
    label: 'Preditivo / Machine Learning',
    description: 'Probabilidade de compra, churn e receita prevista. Exige volume mínimo na propriedade.',
    requiresVolume: true,
    metrics: [
      'purchaseProbability', 'churnProbability', 'predictedRevenue'
    ],
    dimensions: []
  },

  // -------------------------------------------------------------------------
  // 8. AGÊNCIA / ENTERPRISE — DV360 / CM360 / SA360.
  // -------------------------------------------------------------------------
  agency: {
    id: 'agency',
    label: 'Agência / Enterprise (DV360 / CM360 / SA360)',
    description: 'Atribuição completa Google Marketing Platform. Pra agência grande ou enterprise.',
    metrics: [],
    dimensions: [
      // DV360 — Display & Video 360
      'dv360CampaignName', 'dv360CampaignId',
      'dv360CreativeName', 'dv360CreativeId', 'dv360CreativeFormat',
      'dv360InsertionOrderName', 'dv360InsertionOrderId',
      'dv360LineItemName', 'dv360LineItemId',
      'dv360AdvertiserName', 'dv360AdvertiserId',
      'dv360Source', 'dv360Medium', 'dv360SourceMedium',
      // CM360 — Campaign Manager 360
      'cm360CampaignName', 'cm360CampaignId',
      'cm360CreativeName', 'cm360CreativeId', 'cm360CreativeFormat',
      'cm360PlacementName', 'cm360PlacementId',
      'cm360AdvertiserName', 'cm360AdvertiserId',
      'cm360Source', 'cm360Medium', 'cm360SourceMedium',
      // SA360 — Search Ads 360
      'sa360CampaignName', 'sa360CampaignId',
      'sa360AdGroupName', 'sa360AdGroupId',
      'sa360EngineAccountName', 'sa360EngineAccountId',
      'sa360KeywordText', 'sa360Query',
      'sa360Source', 'sa360Medium', 'sa360SourceMedium'
    ]
  }
};

// Mapeia business_profile (escolha 1 do wizard) → packs default ativados.
// Wizard de e-commerce ativa ecommerce+essential; outros ativam só os
// relevantes ao perfil + essential. Add-ons (ads, mobile, predictive, agency)
// vêm como checkboxes adicionais em qualquer perfil.
const PROFILE_TO_DEFAULT_PACKS = {
  ecommerce:     ['essential', 'ecommerce'],
  leadgen:       ['essential', 'leadgen'],
  content:       ['essential', 'content'],
  institutional: ['essential', 'institutional'],
  custom:        ['essential']  // Custom começa só com essential, cliente escolhe o resto
};

// Resolve a lista FINAL de dimensions+metrics que vão pra API a partir de:
//   selectedPacks: ['essential', 'leadgen', 'ads']
//   customSettings: { 'subscriptionTier': { kind: 'dimension', ... }, ... }
// Dedup automático (Set). Retorna { dimensions: [], metrics: [], packsResolved: [] }.
function resolvePacksToFields(selectedPacks, customSettings) {
  const dims = new Set();
  const mets = new Set();
  const packsResolved = [];
  const packs = Array.isArray(selectedPacks) ? selectedPacks : [];
  // Garante que essential SEMPRE entra (alwaysOn).
  const effectivePacks = packs.includes('essential') ? packs : ['essential', ...packs];
  for (const packId of effectivePacks) {
    const pack = PACKS[packId];
    if (!pack) continue;
    packsResolved.push(packId);
    (pack.dimensions || []).forEach(d => dims.add(d));
    (pack.metrics || []).forEach(m => mets.add(m));
  }
  // Customs marcados pelo cliente entram além dos packs.
  if (customSettings && typeof customSettings === 'object') {
    for (const [apiName, setting] of Object.entries(customSettings)) {
      if (!setting || setting.enabled === false) continue;
      if (setting.kind === 'metric') mets.add(apiName);
      else if (setting.kind === 'dimension') dims.add(apiName);
    }
  }
  return {
    dimensions: Array.from(dims),
    metrics: Array.from(mets),
    packsResolved
  };
}

// Limites da Data API (validados na doc 2026-06):
//   max 9 dimensions e 10 metrics por request (runReport).
// Se exceder, precisamos quebrar em múltiplas chamadas e MERGE no banco.
// Função utilitária pra dividir em chunks que cabem.
const API_MAX_DIMENSIONS = 9;
const API_MAX_METRICS = 10;

function chunkFieldsForApi(dimensions, metrics) {
  // Estratégia: 'date' SEMPRE em todo chunk (pra dar pra fazer UPSERT por dia).
  // Resto das dimensões divide em grupos, métricas idem.
  // Quando há overlap, repetimos a dimensão em vários chunks (merge no banco).
  const dimsNoDate = (dimensions || []).filter(d => d !== 'date');
  const mets = metrics || [];

  // Se tudo cabe num chunk só, retorna 1 chunk.
  const dateCost = 1; // ocupa 1 slot
  if (dimsNoDate.length + dateCost <= API_MAX_DIMENSIONS && mets.length <= API_MAX_METRICS) {
    return [{ dimensions: ['date', ...dimsNoDate], metrics: mets }];
  }

  // Caso geral: cria chunks (cartesian de slices)
  const dimChunks = [];
  for (let i = 0; i < dimsNoDate.length; i += (API_MAX_DIMENSIONS - 1)) {
    dimChunks.push(['date', ...dimsNoDate.slice(i, i + (API_MAX_DIMENSIONS - 1))]);
  }
  if (!dimChunks.length) dimChunks.push(['date']);
  const metChunks = [];
  for (let i = 0; i < mets.length; i += API_MAX_METRICS) {
    metChunks.push(mets.slice(i, i + API_MAX_METRICS));
  }
  if (!metChunks.length) metChunks.push([]);

  const chunks = [];
  for (const d of dimChunks) {
    for (const m of metChunks) {
      chunks.push({ dimensions: d, metrics: m });
    }
  }
  return chunks;
}

module.exports = {
  PACKS,
  PROFILE_TO_DEFAULT_PACKS,
  resolvePacksToFields,
  chunkFieldsForApi,
  API_MAX_DIMENSIONS,
  API_MAX_METRICS
};
