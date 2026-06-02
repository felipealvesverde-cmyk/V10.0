// V35.7.2 — Dicionário de explicações dos KPIs do Dashboard.
//
// Cada entry: { title, description, formula, interpretation?, source? }
// Chave usa padrão `<dominio>.<metric>` pra não colidir entre integrações.
//
// Usado pelo KpiHelpModal — qualquer card com `helpKey` aciona via:
//   onclick="Actions.openKpiHelp('gads.cost_30d')"

window.KpiHelpDictionary = {
  // ============ GOOGLE ADS — GRUPO 1 ============
  'gads.cost_30d': {
    title: 'Gasto 30d',
    description: 'Quanto você investiu em mídia paga nos últimos 30 dias.',
    formula: 'SUM(metrics.cost_micros) ÷ 1.000.000',
    source: 'Google Ads API · GAQL'
  },
  'gads.roas': {
    title: 'ROAS — Return on Ad Spend',
    description: 'Quantos reais você gerou em receita pra cada real gasto em mídia.',
    formula: 'SUM(metrics.conversions_value) ÷ SUM(metrics.cost_brl)',
    interpretation: 'ROAS 4x = pra cada R$ 1 gasto, R$ 4 voltam. ROAS < 1x = você perde dinheiro.',
    source: 'Calculado pelo LJ (não vem direto da API)'
  },
  'gads.cpl': {
    title: 'CPL — Custo Por Lead/Conversão',
    description: 'Quanto custou em mídia, em média, gerar 1 conversão.',
    formula: 'SUM(metrics.cost_brl) ÷ SUM(metrics.conversions)',
    interpretation: 'Quanto MENOR, melhor. Compare com seu ticket médio: CPL maior que ticket = prejuízo.',
    source: 'Calculado pelo LJ (alinhado com metrics.cost_per_conversion oficial)'
  },
  'gads.ctr': {
    title: 'CTR — Click-Through Rate',
    description: 'Taxa de cliques sobre impressões. Mede a relevância do anúncio.',
    formula: 'SUM(metrics.clicks) ÷ SUM(metrics.impressions) × 100',
    interpretation: 'Benchmark Search: 3-5%. Display: 0.5-1%. Video: 0.5-2%. PMax: 1-3%.',
    source: 'Google Ads API · metrics.ctr (consolidado)'
  },

  // ============ GOOGLE ADS — GRUPO 2 ============
  'gads.impressions': {
    title: 'Impressões',
    description: 'Quantas vezes o anúncio foi exibido (não importa se clicaram).',
    formula: 'SUM(metrics.impressions)',
    source: 'Google Ads API · metrics.impressions'
  },
  'gads.clicks': {
    title: 'Cliques',
    description: 'Total de cliques nos anúncios.',
    formula: 'SUM(metrics.clicks)',
    source: 'Google Ads API · metrics.clicks'
  },
  'gads.cpc': {
    title: 'CPC médio — Custo por Clique',
    description: 'Quanto custou cada clique, em média.',
    formula: 'SUM(metrics.cost_brl) ÷ SUM(metrics.clicks)',
    interpretation: 'Search é mais caro (R$ 1-5), Display mais barato (R$ 0.30-1). Termos competitivos puxam pra cima.',
    source: 'Google Ads API · metrics.average_cpc'
  },
  'gads.cpm': {
    title: 'CPM médio — Custo por Mil Impressões',
    description: 'Quanto custa exibir o anúncio mil vezes.',
    formula: '(SUM(metrics.cost_brl) ÷ SUM(metrics.impressions)) × 1000',
    interpretation: 'Métrica chave em campanhas de alcance (YouTube, Display).',
    source: 'Google Ads API · metrics.average_cpm'
  },
  'gads.conversions': {
    title: 'Conversões',
    description: 'Quantos eventos marcados como conversão aconteceram (compra, lead, etc).',
    formula: 'SUM(metrics.conversions)',
    interpretation: 'Conta APENAS conversões primárias. Não inclui view-through nem secundárias.',
    source: 'Google Ads API · metrics.conversions'
  },
  'gads.conversions_value': {
    title: 'Receita atribuída',
    description: 'Soma do valor das conversões (geralmente vem do tag de e-commerce).',
    formula: 'SUM(metrics.conversions_value)',
    interpretation: 'Pra ter valor aqui você precisa enviar valor nas conversões (e-commerce/transação).',
    source: 'Google Ads API · metrics.conversions_value'
  },
  'gads.active_campaigns': {
    title: 'Campanhas ativas',
    description: 'Quantas campanhas Google Ads estão considerando o filtro atual.',
    formula: 'COUNT(DISTINCT campaign_id no filtro)',
    source: 'Local · contagem das ads do filtro atual'
  },
  'gads.ticket': {
    title: 'Ticket médio (das conversões)',
    description: 'Valor médio por conversão.',
    formula: 'SUM(metrics.conversions_value) ÷ SUM(metrics.conversions)',
    interpretation: 'Esse ticket é só das ads que enviam valor de conversão. Não confunda com o ticket médio do produto.',
    source: 'Calculado pelo LJ (alinhado com metrics.value_per_conversion)'
  },

  // ============ GOOGLE ADS — GRUPO 3 (Avançados) ============
  'gads.all_conversions': {
    title: 'Todas as conversões',
    description: 'Inclui primárias + secundárias + view-through conversions.',
    formula: 'SUM(metrics.all_conversions)',
    interpretation: 'Útil pra avaliar impacto total da mídia incluindo eventos micro (cadastro, add-to-cart, etc).',
    source: 'Google Ads API · metrics.all_conversions'
  },
  'gads.all_conversions_value': {
    title: 'Receita de todas as conversões',
    description: 'Valor total de TODAS as conversões trackeadas.',
    formula: 'SUM(metrics.all_conversions_value)',
    source: 'Google Ads API · metrics.all_conversions_value'
  },
  'gads.cost_per_all_conv': {
    title: 'Custo por todas as conversões',
    description: 'CPL considerando todas as conversões (não só primárias).',
    formula: 'SUM(metrics.cost_brl) ÷ SUM(metrics.all_conversions)',
    source: 'Calculado pelo LJ'
  },
  'gads.value_per_all_conv': {
    title: 'Receita por todas as conversões',
    description: 'Ticket médio considerando todas as conversões.',
    formula: 'SUM(metrics.all_conversions_value) ÷ SUM(metrics.all_conversions)',
    source: 'Calculado pelo LJ (metrics.value_per_all_conversions oficial)'
  },
  'gads.view_through': {
    title: 'View-through conversions',
    description: 'Pessoas que VIRAM o anúncio (não clicaram) e converteram depois.',
    formula: 'SUM(metrics.view_through_conversions)',
    interpretation: 'Indica impacto de awareness — anúncios YouTube/Display que plantam intenção.',
    source: 'Google Ads API · metrics.view_through_conversions'
  },
  'gads.conv_rate': {
    title: 'Taxa de conversão por interação',
    description: '% das interações (cliques + visualizações engajadas) que viraram conversão.',
    formula: 'AVG(metrics.conversions_from_interactions_rate) × 100',
    interpretation: 'Mede qualidade do tráfego pago. Tráfego frio costuma ter 1-3%, remarketing 5-15%.',
    source: 'Google Ads API · metrics.conversions_from_interactions_rate'
  },
  'gads.search_imp_share': {
    title: 'Search Impression Share',
    description: '% das vezes que seu anúncio APARECEU vs as vezes que poderia ter aparecido.',
    formula: 'AVG(metrics.search_impression_share)',
    interpretation: '100% = você apareceu em todo leilão elegível. < 80% indica budget ou bid baixos. Só vale pra Search/Shopping.',
    source: 'Google Ads API · metrics.search_impression_share'
  },
  'gads.search_top_imp_share': {
    title: 'Search Top Impression Share',
    description: '% das vezes que seu anúncio apareceu no TOPO da página de busca.',
    formula: 'AVG(metrics.search_top_impression_share)',
    interpretation: 'Mede qualidade da posição. Acima de 70% = bem posicionado.',
    source: 'Google Ads API · metrics.search_top_impression_share'
  }
};
