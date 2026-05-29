// V35.2.0 — GET /api/hotmart-event-suggestions?parent_stage=X
// Devolve sugestões de sub-stages baseados no mapa Hotmart → semantic.
//
// Uso: modal sub-funil mostra, ao abrir uma bolinha, sugestões de
// sub-stages "Hotmart sugere" que o cliente pode aceitar com 1 click.
// Cliente mantém soberania — nada é criado automaticamente.

const { EVENT_MAP } = require('../lib/lj-hotmart-service');

const FIXED_STAGES = new Set([
  'marketing-tof', 'marketing-mof', 'marketing-bof',
  'vendas-tof',    'vendas-mof',    'vendas-bof',
  'cs-tof',        'cs-mof',        'cs-bof'
]);

// Nomes humanos pros sub-stages sugeridos
const SUGGESTED_NAMES = {
  'lj-cart-abandoned-hotmart':       'Carrinho recuperável',
  'lj-boleto-gerado-hotmart':        'Aguardando pagamento (boleto)',
  'lj-pagamento-atrasado-hotmart':   'Pagamento atrasado',
  'lj-compra-expirada-hotmart':      'Boleto expirado',
  'lj-compra-aprovada-hotmart':      'Comprou',
  'lj-compra-completa-hotmart':      'Compra completa',
  'lj-compra-reembolsada-hotmart':   'Reembolsado',
  'lj-compra-chargeback-hotmart':    'Chargeback',
  'lj-compra-cancelada-hotmart':     'Compra cancelada',
  'lj-churn-hotmart':                'Cancelou assinatura',
  'lj-switch-plan-hotmart':          'Mudou de plano',
  'lj-charge-date-changed-hotmart':  'Cobrança remanejada'
};

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  const parentStage = String(req.query?.parent_stage || '').toLowerCase();
  if (!FIXED_STAGES.has(parentStage)) {
    return res.status(400).json({ ok: false, message: 'parent_stage inválido.' });
  }

  // Filtra EVENT_MAP pelos que têm semantic === parent_stage
  const suggestions = [];
  for (const [event, meta] of Object.entries(EVENT_MAP)) {
    if (meta.semantic !== parentStage) continue;
    suggestions.push({
      event,
      tag: meta.tag,
      name: SUGGESTED_NAMES[meta.tag] || meta.tag,
      description: `Hotmart dispara esta tag quando o evento ${event} ocorre.`
    });
  }

  return res.status(200).json({ ok: true, parentStage, suggestions });
};
