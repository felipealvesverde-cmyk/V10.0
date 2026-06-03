// V35.8.0-alpha1 — Catálogo de Naturezas Atômicas de KR.
//
// Cada natureza é uma "coisa que pode ser medida" reconhecida pelo LJ.
// Mapeia para fontes integradas (Google Ads, RD, Hotmart, etc).
//
// Usado pelo fluxo determinístico do Djow:
//   - Etapa 2 (Classificação) pode comparar o nome do KR com aliases pra
//     desambiguar atomic vs derived vs manual
//   - Etapa 3a (Atomic routing) usa o mapping pra propor fontes válidas
//   - Etapa 4 (Validação) confere se unidade/direção batem com default
//
// Não é exaustivo — começa com o que o LJ já consegue rotear (integrações
// V35.x) e expande conforme casos novos aparecem. Naturezas não-listadas
// caem pra Manual (lei) — não tentamos adivinhar.
//
// Convenção: id em snake_case ASCII, aliases incluem variantes PT-BR.

const NATURES = [
  // ============================================================
  // CATEGORIA: Aquisição Paid (Marketing pago)
  // ============================================================
  {
    id: 'alcance_paid',
    label: 'Alcance / Impressões (paid)',
    aliases: ['alcance', 'impressoes', 'impressões', 'reach', 'pessoas alcançadas'],
    category: 'aquisicao_paid',
    default_unit: 'quantidade',
    default_direction: 'higher',
    mapping: {
      google_ads: { field: 'metrics.impressions', aggregation: 'sum' }
      // meta_ads, linkedin_ads — futuro
    }
  },
  {
    id: 'cliques',
    label: 'Cliques',
    aliases: ['cliques', 'clicks', 'cliques no anuncio'],
    category: 'aquisicao_paid',
    default_unit: 'quantidade',
    default_direction: 'higher',
    mapping: {
      google_ads: { field: 'metrics.clicks', aggregation: 'sum' }
    }
  },
  {
    id: 'ctr',
    label: 'CTR (Click-Through Rate)',
    aliases: ['ctr', 'taxa de cliques', 'click through rate'],
    category: 'aquisicao_paid',
    default_unit: 'percentual',
    default_direction: 'higher',
    mapping: {
      google_ads: { field: 'metrics.ctr', aggregation: 'weighted_avg_by_impressions' }
    }
  },
  {
    id: 'cpc_medio',
    label: 'CPC médio (Custo por Clique)',
    aliases: ['cpc', 'cpc medio', 'custo por clique'],
    category: 'aquisicao_paid',
    default_unit: 'reais',
    default_direction: 'lower',
    mapping: {
      google_ads: { field: 'metrics.average_cpc', aggregation: 'weighted_avg_by_clicks' }
    }
  },
  {
    id: 'cpm_medio',
    label: 'CPM médio (Custo por Mil Impressões)',
    aliases: ['cpm', 'cpm medio', 'custo por mil'],
    category: 'aquisicao_paid',
    default_unit: 'reais',
    default_direction: 'lower',
    mapping: {
      google_ads: { field: 'metrics.average_cpm', aggregation: 'weighted_avg_by_impressions' }
    }
  },
  {
    id: 'gasto_midia',
    label: 'Gasto em mídia',
    aliases: ['gasto', 'gasto em midia', 'investimento', 'investimento em midia', 'budget gasto'],
    category: 'aquisicao_paid',
    default_unit: 'reais',
    default_direction: 'lower',     // contexto orçamento — menor é melhor
    mapping: {
      google_ads: { field: 'metrics.cost_brl', aggregation: 'sum' }
    }
  },
  {
    id: 'conversoes_paid',
    label: 'Conversões (paid)',
    aliases: ['conversoes', 'conversões', 'conversoes paid', 'eventos de conversao'],
    category: 'aquisicao_paid',
    default_unit: 'quantidade',
    default_direction: 'higher',
    mapping: {
      google_ads: { field: 'metrics.conversions', aggregation: 'sum' }
    }
  },
  {
    id: 'receita_atribuida',
    label: 'Receita atribuída (paid)',
    aliases: ['receita atribuida', 'receita atribuída', 'conversions value', 'valor das conversoes'],
    category: 'aquisicao_paid',
    default_unit: 'reais',
    default_direction: 'higher',
    mapping: {
      google_ads: { field: 'metrics.conversions_value', aggregation: 'sum' }
    }
  },
  {
    id: 'cpl_ads',
    label: 'CPL — Custo por Conversão',
    aliases: ['cpl', 'custo por lead', 'custo por conversao', 'cost per acquisition'],
    category: 'aquisicao_paid',
    default_unit: 'reais',
    default_direction: 'lower',
    mapping: {
      google_ads: { field: 'metrics.cost_per_conversion', aggregation: 'weighted_avg_by_conversions' }
    }
  },

  // ============================================================
  // CATEGORIA: CRM Vendas
  // ============================================================
  {
    id: 'mql',
    label: 'MQL (Marketing Qualified Leads)',
    aliases: ['mql', 'leads qualificados marketing', 'mqls'],
    category: 'crm_vendas',
    default_unit: 'quantidade',
    default_direction: 'higher',
    mapping: {
      rd_station: { field: 'contacts.by_stage.MQL', aggregation: 'count' }
    }
  },
  {
    id: 'sql',
    label: 'SQL (Sales Qualified Leads)',
    aliases: ['sql', 'sqls', 'leads qualificados vendas'],
    category: 'crm_vendas',
    default_unit: 'quantidade',
    default_direction: 'higher',
    mapping: {
      rd_station: { field: 'contacts.by_stage.SQL', aggregation: 'count' }
    }
  },
  {
    id: 'leads_gerados',
    label: 'Leads gerados',
    aliases: ['leads', 'leads gerados', 'novos leads', 'lead generation'],
    category: 'crm_vendas',
    default_unit: 'quantidade',
    default_direction: 'higher',
    mapping: {
      rd_station: { field: 'contacts.created', aggregation: 'count' }
    }
  },
  {
    id: 'deals_ganhos',
    label: 'Deals ganhos',
    aliases: ['deals ganhos', 'won deals', 'negocios fechados', 'deals fechados'],
    category: 'crm_vendas',
    default_unit: 'quantidade',
    default_direction: 'higher',
    mapping: {
      rd_station: { field: 'deals.won', aggregation: 'count' }
    }
  },
  {
    id: 'win_rate',
    label: 'Win Rate',
    aliases: ['win rate', 'taxa de fechamento', 'taxa de conversao deals'],
    category: 'crm_vendas',
    default_unit: 'percentual',
    default_direction: 'higher',
    mapping: {
      rd_station: { formula: 'deals.won / (deals.won + deals.lost)', aggregation: 'computed' }
    }
  },

  // ============================================================
  // CATEGORIA: Checkout / Vendas Realizadas
  // ============================================================
  {
    id: 'vendas_realizadas',
    label: 'Vendas realizadas',
    aliases: ['vendas', 'vendas realizadas', 'sales', 'purchases'],
    category: 'checkout',
    default_unit: 'quantidade',
    default_direction: 'higher',
    mapping: {
      hotmart: { field: 'events.PURCHASE_APPROVED', aggregation: 'count' }
    }
  },
  {
    id: 'receita_realizada',
    label: 'Receita realizada (vendas finalizadas)',
    aliases: ['receita', 'receita realizada', 'faturamento', 'revenue', 'gmv'],
    category: 'checkout',
    default_unit: 'reais',
    default_direction: 'higher',
    mapping: {
      hotmart: { field: 'events.PURCHASE_APPROVED.value', aggregation: 'sum' }
    }
  },
  {
    id: 'carrinho_abandonado',
    label: 'Carrinho abandonado',
    aliases: ['carrinho abandonado', 'abandono', 'cart abandonment', 'churn no checkout', 'desistencia'],
    category: 'checkout',
    default_unit: 'percentual',
    default_direction: 'lower',
    mapping: {
      hotmart: { field: 'events.PURCHASE_OUT_OF_SHOPPING_CART', aggregation: 'count' }
    }
  },
  {
    id: 'reembolso',
    label: 'Reembolso / Estorno',
    aliases: ['reembolso', 'estorno', 'refund', 'chargeback', 'devolucao'],
    category: 'checkout',
    default_unit: 'percentual',
    default_direction: 'lower',
    mapping: {
      hotmart: { field: 'events.PURCHASE_REFUNDED', aggregation: 'count' }
    }
  },
  {
    id: 'cancelamento_assinatura',
    label: 'Cancelamento de assinatura',
    aliases: ['cancelamento de assinatura', 'subscription cancellation', 'churn de assinatura'],
    category: 'checkout',
    default_unit: 'percentual',
    default_direction: 'lower',
    mapping: {
      hotmart: { field: 'events.SUBSCRIPTION_CANCELLATION', aggregation: 'count' }
    }
  },

  // ============================================================
  // CATEGORIA: Operacional (ClickUp)
  // ============================================================
  {
    id: 'tarefas_concluidas',
    label: 'Tarefas concluídas',
    aliases: ['tarefas concluidas', 'tasks done', 'tasks finalizadas', 'execucoes concluidas'],
    category: 'operacional',
    default_unit: 'quantidade',
    default_direction: 'higher',
    mapping: {
      clickup: { field: 'tasks.status.complete', aggregation: 'count' }
    }
  },
  {
    id: 'percent_tarefas_no_prazo',
    label: '% Tarefas no prazo',
    aliases: ['tarefas no prazo', 'on time tasks', 'sla cumprido'],
    category: 'operacional',
    default_unit: 'percentual',
    default_direction: 'higher',
    mapping: {
      clickup: { formula: 'tasks.completed_on_time / tasks.completed', aggregation: 'computed' }
    }
  },

  // ============================================================
  // CATEGORIA: Sem fonte (sempre manual)
  // ============================================================
  // Naturezas reconhecidas mas que não temos integração ainda — cliente
  // cria como manual e Djow alerta que vai virar manual + qual ferramenta
  // de mercado seria a fonte natural quando integrarmos.
  {
    id: 'nps',
    label: 'NPS (Net Promoter Score)',
    aliases: ['nps', 'net promoter score'],
    category: 'pesquisa',
    default_unit: 'pontuacao',
    default_direction: 'higher',
    mapping: {},                                // sem integração ativa
    suggested_tools: ['Delighted', 'Wootric', 'HubSpot CSAT', 'Typeform']
  },
  {
    id: 'csat',
    label: 'CSAT (Customer Satisfaction)',
    aliases: ['csat', 'customer satisfaction', 'satisfacao'],
    category: 'pesquisa',
    default_unit: 'pontuacao',
    default_direction: 'higher',
    mapping: {},
    suggested_tools: ['Delighted', 'HubSpot CSAT', 'Zendesk Satisfaction']
  }
];

/**
 * Busca natureza por nome livre. Match case-insensitive contra label + aliases.
 * Retorna a primeira que bate; null se nenhuma.
 * Usado pelo Djow no fallback heurístico (antes de chamar LLM).
 */
function findByName(query) {
  if (!query) return null;
  const q = String(query).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  return NATURES.find(n =>
    String(n.label).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q) ||
    (n.aliases || []).some(a => String(a).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q))
  ) || null;
}

/**
 * Lista naturezas filtradas por categoria. Útil pra apresentar opções
 * por setor no Djow.
 */
function listByCategory(category) {
  return NATURES.filter(n => n.category === category);
}

/**
 * Lista as naturezas que têm pelo menos uma integração mapeada (não-vazia).
 * Usado pra Djow saber rapidamente "essa natureza tem fonte automática".
 */
function listWithSources() {
  return NATURES.filter(n => n.mapping && Object.keys(n.mapping).length > 0);
}

module.exports = {
  NATURES,
  findByName,
  listByCategory,
  listWithSources
};
