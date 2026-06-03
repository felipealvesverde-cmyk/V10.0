// V35.8.0-alpha1 — Catálogo de Fórmulas Derivadas (KRs compostos).
//
// KRs derivados se calculam a partir de outros KRs/métricas atômicas.
// Não vêm direto de um campo de API — vêm de fórmula com múltiplos
// insumos.
//
// Fluxo do Djow:
//   - Etapa 2 (Classificação): nome do KR bate com algum derivado?
//     → marca como 'derived' (vs 'atomic' vs 'manual')
//   - Etapa 3b (Derived routing): aplica a fórmula, valida que cada
//     insumo existe (KR já criado ou natureza atômica conhecida)
//
// Cada fórmula declara:
//   - id, label, aliases (matching)
//   - formula: expressão em linguagem natural pro Djow exibir e em
//     formato simbólico pro engine calcular
//   - inputs: lista de "insumos esperados", cada um com:
//       - id: como referenciar no engine
//       - nature_id (opcional): se o insumo bate com uma natureza atômica
//         do KR_NATURES_CATALOG (ex: faturamento → receita_realizada)
//       - allow_kr_reference: se permite o cliente plugar um KR já
//         criado como insumo
//       - default: valor padrão quando insumo não está disponível
//       - default_label: o que mostrar pro cliente quando usar default
//   - default_unit, default_direction

const FORMULAS = [
  {
    id: 'ltv',
    label: 'LTV — Lifetime Value',
    aliases: ['ltv', 'lifetime value', 'valor do cliente'],
    formula_display: '(Faturamento ÷ Nº Clientes) × Retenção média - CAC',
    formula_symbolic: '(faturamento / clientes) * retencao_meses - cac',
    inputs: [
      {
        id: 'faturamento',
        label: 'Faturamento',
        nature_id: 'receita_realizada',
        allow_kr_reference: true
      },
      {
        id: 'clientes',
        label: 'Nº de Clientes',
        nature_id: 'vendas_realizadas',
        allow_kr_reference: true
      },
      {
        id: 'retencao_meses',
        label: 'Tempo médio de retenção (meses)',
        nature_id: null,
        allow_kr_reference: true,
        default: 12,
        default_label: 'Sem dado, vou usar 12 meses como padrão'
      },
      {
        id: 'cac',
        label: 'CAC (Custo de Aquisição)',
        nature_id: null,
        allow_kr_reference: true,                  // pega KR de CAC existente
        default: 0,
        default_label: 'Crie o KR de CAC pra incluir aqui'
      }
    ],
    default_unit: 'reais',
    default_direction: 'higher',
    description: 'Valor que cada cliente gera ao longo da relação com o produto.'
  },
  {
    id: 'cac_blended',
    label: 'CAC Blended',
    aliases: ['cac', 'cac blended', 'custo de aquisicao', 'customer acquisition cost'],
    formula_display: '(Gasto Paid + Custo SDR + Outros) ÷ Novos Clientes',
    formula_symbolic: '(gasto_paid + custo_sdr + custos_outros) / novos_clientes',
    inputs: [
      {
        id: 'gasto_paid',
        label: 'Gasto em mídia paga',
        nature_id: 'gasto_midia',
        allow_kr_reference: true
      },
      {
        id: 'custo_sdr',
        label: 'Custo do time SDR',
        nature_id: null,
        allow_kr_reference: true,
        default: 0,
        default_label: 'Sem KR de custo SDR — soma 0 por enquanto'
      },
      {
        id: 'custos_outros',
        label: 'Outros custos de aquisição',
        nature_id: null,
        allow_kr_reference: true,
        default: 0
      },
      {
        id: 'novos_clientes',
        label: 'Novos clientes no período',
        nature_id: 'vendas_realizadas',
        allow_kr_reference: true
      }
    ],
    default_unit: 'reais',
    default_direction: 'lower',
    description: 'Custo médio pra adquirir 1 cliente, somando todas as fontes.'
  },
  {
    id: 'ltv_cac_ratio',
    label: 'LTV / CAC',
    aliases: ['ltv cac', 'ltv/cac', 'razao ltv cac', 'ltv:cac'],
    formula_display: 'LTV ÷ CAC',
    formula_symbolic: 'ltv / cac',
    inputs: [
      { id: 'ltv', label: 'LTV', nature_id: null, allow_kr_reference: true },
      { id: 'cac', label: 'CAC', nature_id: null, allow_kr_reference: true }
    ],
    default_unit: 'numero',
    default_direction: 'higher',
    description: 'Quantas vezes o LTV cobre o CAC. Acima de 3x = saúde; abaixo de 1x = perda.'
  },
  {
    id: 'roas_blended',
    label: 'ROAS — Return on Ad Spend',
    aliases: ['roas', 'retorno sobre midia', 'return on ad spend'],
    formula_display: 'Receita atribuída ÷ Gasto em mídia',
    formula_symbolic: 'receita_atribuida / gasto_paid',
    inputs: [
      { id: 'receita_atribuida', label: 'Receita atribuída', nature_id: 'receita_atribuida', allow_kr_reference: true },
      { id: 'gasto_paid', label: 'Gasto em mídia', nature_id: 'gasto_midia', allow_kr_reference: true }
    ],
    default_unit: 'numero',
    default_direction: 'higher',
    description: 'Quanto a mídia paga retornou em receita pra cada R$ 1 investido.'
  },
  {
    id: 'mrr',
    label: 'MRR — Monthly Recurring Revenue',
    aliases: ['mrr', 'receita recorrente mensal'],
    formula_display: 'SUM(receita_assinaturas_ativas)',
    formula_symbolic: 'sum(assinaturas_ativas.valor_mensal)',
    inputs: [
      {
        id: 'assinaturas_ativas',
        label: 'Assinaturas ativas',
        nature_id: null,                // não temos campo direto ainda
        allow_kr_reference: false,
        default_label: 'Vamos puxar do Hotmart quando recorrência estiver disponível'
      }
    ],
    default_unit: 'reais',
    default_direction: 'higher',
    description: 'Receita previsível por mês de produtos recorrentes.'
  },
  {
    id: 'arr',
    label: 'ARR — Annual Recurring Revenue',
    aliases: ['arr', 'receita recorrente anual'],
    formula_display: 'MRR × 12',
    formula_symbolic: 'mrr * 12',
    inputs: [
      { id: 'mrr', label: 'MRR', nature_id: null, allow_kr_reference: true }
    ],
    default_unit: 'reais',
    default_direction: 'higher',
    description: 'MRR projetado pra 12 meses.'
  },
  {
    id: 'payback',
    label: 'Payback (meses)',
    aliases: ['payback', 'tempo de retorno'],
    formula_display: 'CAC ÷ Margem mensal por cliente',
    formula_symbolic: 'cac / margem_mensal_por_cliente',
    inputs: [
      { id: 'cac', label: 'CAC', nature_id: null, allow_kr_reference: true },
      { id: 'margem_mensal_por_cliente', label: 'Margem mensal por cliente', nature_id: null, allow_kr_reference: true }
    ],
    default_unit: 'numero',
    default_direction: 'lower',
    description: 'Quantos meses pra recuperar o que gastou pra adquirir 1 cliente.'
  },
  {
    id: 'margem_contribuicao',
    label: 'Margem de Contribuição',
    aliases: ['margem de contribuicao', 'margem contribuicao'],
    formula_display: '(Receita − Custos Variáveis) ÷ Receita',
    formula_symbolic: '(receita - custos_variaveis) / receita',
    inputs: [
      { id: 'receita', label: 'Receita', nature_id: 'receita_realizada', allow_kr_reference: true },
      { id: 'custos_variaveis', label: 'Custos variáveis', nature_id: null, allow_kr_reference: true }
    ],
    default_unit: 'percentual',
    default_direction: 'higher',
    description: '% da receita que sobra após custos variáveis (antes de fixos).'
  }
];

/**
 * Match nome livre contra fórmulas (label + aliases). Retorna primeira ou null.
 */
function findByName(query) {
  if (!query) return null;
  const q = String(query).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  return FORMULAS.find(f =>
    String(f.label).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q) ||
    (f.aliases || []).some(a => String(a).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q))
  ) || null;
}

/**
 * Lista todas as fórmulas (pra Djow consultar no prompt de derivados).
 */
function listAll() {
  return FORMULAS.slice();
}

module.exports = {
  FORMULAS,
  findByName,
  listAll
};
