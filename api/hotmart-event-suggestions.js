// V35.2.0 — GET /api/hotmart-event-suggestions?parent_stage=X
// Devolve sugestões de sub-stages baseados no mapa Hotmart → semantic.
//
// Uso: modal sub-funil mostra, ao abrir uma bolinha, sugestões de
// sub-stages "Hotmart sugere" que o cliente pode aceitar com 1 click.
// Cliente mantém soberania — nada é criado automaticamente.

const { EVENT_MAP, REASON_MAP } = require('../lib/lj-hotmart-service');

const FIXED_STAGES = new Set([
  'marketing-tof', 'marketing-mof', 'marketing-bof',
  'vendas-tof',    'vendas-mof',    'vendas-bof',
  'cs-tof',        'cs-mof',        'cs-bof'
]);

// V35.2.1 — Sugestão de motivos só aparece quando volume passa do threshold
// pra evitar poluir o cliente com tags que nunca foram disparadas. Filtra
// últimos 60 dias.
const REASON_VOLUME_THRESHOLD = 5;
const REASON_LOOKBACK_DAYS = 60;

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

// Nomes pros sub-stages de recusa (V35.2.1)
const REASON_SUGGESTED_NAMES = {
  'lj-recusa-cartao-invalido':   'Recuperar cartão inválido',
  'lj-recusa-cartao-vencido':    'Recuperar cartão vencido',
  'lj-recusa-sem-saldo':         'Recuperar sem saldo',
  'lj-recusa-banco-fora':        'Recuperar banco fora do ar',
  'lj-recusa-banco-negou':       'Recuperar banco negou',
  'lj-recusa-fraude':            'Suspeita de fraude',
  'lj-recusa-cartao-bloqueado':  'Cartão bloqueado'
};

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });

  const parentStage = String(req.query?.parent_stage || '').toLowerCase();
  if (!FIXED_STAGES.has(parentStage)) {
    return res.status(400).json({ ok: false, message: 'parent_stage inválido.' });
  }

  // 1. Sugestões base do EVENT_MAP (semantic === parent_stage)
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

  // 2. V35.2.1 — Em vendas-bof, adiciona sugestões de motivos de recusa
  // SOMENTE pros que passaram do threshold de volume (5+ em 60 dias)
  if (parentStage === 'vendas-bof' && req.tenantDb) {
    try {
      const userId = Number(req.user.sub || req.user.id);
      const sinceDate = new Date(Date.now() - REASON_LOOKBACK_DAYS * 86400000).toISOString().slice(0, 10);
      const r = await req.tenantDb.query(
        `SELECT cancellation_reason, COUNT(*) AS count
           FROM lj_hotmart_purchases
          WHERE user_id = $1
            AND purchase_status = 'canceled'
            AND cancellation_reason IS NOT NULL
            AND occurred_at >= $2::date
          GROUP BY cancellation_reason
         HAVING COUNT(*) >= $3
          ORDER BY count DESC`,
        [userId, sinceDate, REASON_VOLUME_THRESHOLD]
      );
      for (const row of r.rows) {
        const code = row.cancellation_reason;
        const meta = REASON_MAP[code];
        if (!meta) continue;
        suggestions.push({
          event: `RECUSA_${code}`,
          tag: meta.tag,
          name: REASON_SUGGESTED_NAMES[meta.tag] || meta.label,
          description: `${row.count} recusa(s) por "${meta.label}" nos últimos ${REASON_LOOKBACK_DAYS} dias. Vale criar sub-stage pra recuperação.`,
          volume: Number(row.count)
        });
      }
    } catch (err) {
      console.warn('[hotmart-event-suggestions reasons]', err.message);
    }
  }

  return res.status(200).json({ ok: true, parentStage, suggestions });
};
