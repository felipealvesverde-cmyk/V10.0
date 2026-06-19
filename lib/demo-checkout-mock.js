// V40.7.11 — Mock convincente do checkout pra demo@leadjourney.app.
// Retorna o MESMO shape de /api/hotmart-dashboard-metrics: KPIs, products,
// transactions, cancellationReasons, series, pagination.
//
// Cenário simulado: 3 produtos do Engenho Norte vendendo via checkout online
// nos últimos 30 dias. Volumes representam ~20-40% das vendas totais (o resto
// é offline — bares, eventos), pra ser plausível como cervejaria.
//
// Décadas anteriores destes endpoints e o backlog pra resolver isso direito:
// ver [[backlog-provider-abstraction]] na memory.

const { REASON_MAP } = require('./lj-hotmart-service');

// V40.7.17 — Buyer names B2B coerentes com tenant cervejaria.
// PILSEN_BUYERS pega ~67% (bares/adegas populares), WEISS_BUYERS pega ~25% (gastrobares),
// CHOPP_BUYERS pega ~7% (restaurantes premium / hotéis). E-mails comerciais.
const PILSEN_BUYERS = [
  { name: 'Bar do Toninho',           email: 'compras@bartoninho.com.br',     buyer: 'Antonio Silva' },
  { name: 'Adega Centro SP',          email: 'pedidos@adegacentrosp.com.br',  buyer: 'Marcos Oliveira' },
  { name: 'Boteco da Lapa',           email: 'lapa@botecodalapa.com.br',      buyer: 'Pedro Santos' },
  { name: 'Distribuidora Brahma Sul', email: 'compras@distrbrahmasul.com.br', buyer: 'Carlos Pereira' },
  { name: 'Mercadinho do João',       email: 'joao@mercadinhojoao.com.br',    buyer: 'João Carvalho' },
  { name: 'Petiscaria Aurora',        email: 'aurora@petisaurora.com.br',     buyer: 'Rafael Lima' },
  { name: 'Bar Esquina Feliz',        email: 'compras@esquinafeliz.com.br',   buyer: 'Bruno Almeida' },
  { name: 'Choperia Trevo',           email: 'pedidos@choperiatrevo.com.br',  buyer: 'Ricardo Souza' }
];
const WEISS_BUYERS = [
  { name: 'Gastrobar Malte & Co',     email: 'sommelier@maltecompany.com.br', buyer: 'Henrique Ferreira' },
  { name: 'Cervejaria do Largo',      email: 'curadoria@cervejarialargo.com.br', buyer: 'Diego Mendes' },
  { name: 'Beer House Premium SP',    email: 'compras@beerhousepremium.com.br', buyer: 'André Martins' },
  { name: 'Festival Cervejeiro RJ',   email: 'organizacao@festrj.com.br',     buyer: 'Larissa Ribeiro' },
  { name: 'Hotel Boutique Aurora',    email: 'fnb@hotelaurora.com.br',        buyer: 'Murilo Costa' }
];
const CHOPP_BUYERS = [
  { name: 'Restaurante Mani SP',      email: 'sommelier@manisp.com.br',       buyer: 'Vitória Araujo' },
  { name: 'Hotel Copacabana 5 Estrelas', email: 'fnb@hotelcopa5.com.br',      buyer: 'Renato Rodrigues' },
  { name: 'Casa de Eventos Privê',    email: 'eventos@caseprive.com.br',      buyer: 'Patrícia Costa' },
  { name: 'Restaurante D.O.M. Suite', email: 'curadoria@domsuite.com.br',     buyer: 'Isabela Mendes' }
];
const BUYERS_BY_PRODUCT = {
  demo_pilsen: PILSEN_BUYERS,
  demo_weiss: WEISS_BUYERS,
  demo_chopp_vinho: CHOPP_BUYERS
};

// V40.7.18 — Pilsen + Weiss saudáveis (~80% da meta), Chopp em rota errada
// (~37% da meta). Demo conta uma história: 2 produtos rodando, 1 lutando pra
// encontrar lugar no segmento Top 50/Michelin. LJ vira diagnóstico, não só
// dashboard verde.
const PRODUCTS = [
  { hotmartId: 'demo_pilsen',       ljId: 1781869701831, name: 'Cerveja Pilsen 600ml',  priceBRL: 22, monthlyApproved: 9600, share: 0.704 },
  { hotmartId: 'demo_weiss',        ljId: 5001,          name: 'Cerveja Weiss 500ml',   priceBRL: 28, monthlyApproved: 3600, share: 0.264 },
  { hotmartId: 'demo_chopp_vinho',  ljId: 5002,          name: 'Chopp de Vinho 250ml',  priceBRL: 72, monthlyApproved: 440,  share: 0.032 }
];

const TOTAL_APPROVED = 13640;
// V40.7.18 — Cancelamento/refund Chopp ligeiramente piores (sinal de problema)
const TOTAL_CANCELED = 488;
const TOTAL_REFUNDED = 271;
const TOTAL_CHARGEBACK = 102;
const TOTAL_BILLET = 812;

// PRNG determinístico (Mulberry32) — mesma resposta toda vez = demo previsível.
function seedrand(seed) {
  let state = seed >>> 0;
  return function() {
    state |= 0; state = state + 0x6D2B79F5 | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function pick(arr, idx) { return arr[idx % arr.length]; }
function pickProductByShare(rand) {
  const r = rand();
  let acc = 0;
  for (const p of PRODUCTS) {
    acc += p.share;
    if (r <= acc) return p;
  }
  return PRODUCTS[0];
}
function fmtDate(daysAgo) {
  const d = new Date('2026-06-19T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}
function dayOnly(daysAgo) {
  const d = new Date('2026-06-19T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function buildDemoCheckoutMock(query = {}) {
  const productFilter = String(query.product_id_hotmart || 'all').trim();
  const reasonFilter = String(query.reason || '').trim().toUpperCase();
  const days = Math.min(Number(query.days || 30), 365);
  const limit = Math.min(Number(query.limit || 50), 500);
  const offset = Math.max(Number(query.offset || 0), 0);
  const fromDate = query.from_date || dayOnly(days);
  const toDate = query.to_date || dayOnly(0);

  // Aplica filtro de produto à série/KPIs.
  const productSet = productFilter === 'all'
    ? PRODUCTS
    : PRODUCTS.filter(p => p.hotmartId === productFilter);

  const shareSum = productSet.reduce((s, p) => s + p.share, 0) || 1;
  const scaleByFilter = productSet.length === PRODUCTS.length ? 1 : (shareSum / 1);

  // Agregados de KPI (cents)
  let totalRevenueCents = 0;
  let avgTicketCents = 0;
  let weighted = 0;
  for (const p of productSet) {
    const localShare = p.share / shareSum;
    const approvedLocal = Math.round(TOTAL_APPROVED * scaleByFilter * localShare);
    const revenueLocal = approvedLocal * p.priceBRL * 100;
    totalRevenueCents += revenueLocal;
    avgTicketCents += p.priceBRL * 100 * localShare;
    weighted += localShare;
  }
  avgTicketCents = Math.round(avgTicketCents);

  const kpis = {
    approvedCount:   Math.round(TOTAL_APPROVED   * scaleByFilter),
    refundedCount:   Math.round(TOTAL_REFUNDED   * scaleByFilter),
    chargebackCount: Math.round(TOTAL_CHARGEBACK * scaleByFilter),
    canceledCount:   Math.round(TOTAL_CANCELED   * scaleByFilter),
    billetCount:     Math.round(TOTAL_BILLET     * scaleByFilter),
    totalCount:      Math.round((TOTAL_APPROVED + TOTAL_REFUNDED + TOTAL_CHARGEBACK + TOTAL_CANCELED + TOTAL_BILLET) * scaleByFilter),
    totalRevenueCents,
    totalCommissionCents: Math.round(totalRevenueCents * 0.04), // 4% gateway/processamento
    avgTicketCents
  };

  // products list (sub-tabs)
  const products = PRODUCTS.map(p => {
    const approvedLocal = Math.round(TOTAL_APPROVED * p.share);
    return {
      productIdHotmart: p.hotmartId,
      productName: p.name,
      purchaseCount: approvedLocal,
      revenueCents: approvedLocal * p.priceBRL * 100
    };
  });

  // cancellation reasons (top 5 + outros)
  const baseReasons = [
    { code: 'INSUFFICIENT_FUNDS',  share: 0.32 },
    { code: 'CARD_DECLINED_BY_BANK', share: 0.21 },
    { code: 'INVALID_CARD_NUMBER', share: 0.15 },
    { code: 'CARD_EXPIRED',        share: 0.12 },
    { code: 'FRAUD_SUSPICION',     share: 0.08 },
    { code: 'BLOCKED_CARD',        share: 0.07 },
    { code: 'ISSUING_BANK_UNAVAILABLE', share: 0.05 }
  ];
  const totalCanceledKpi = kpis.canceledCount;
  const cancellationReasons = baseReasons
    .map(r => ({
      code: r.code,
      label: REASON_MAP[r.code]?.label || r.code,
      tag:   REASON_MAP[r.code]?.tag   || `lj-recusa-${r.code.toLowerCase()}`,
      count: Math.round(totalCanceledKpi * r.share)
    }))
    .filter(r => r.count > 0);

  // série temporal — 30 dias (ou 'days' do query)
  const rand = seedrand(42);
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = dayOnly(i);
    // Variação diária: base TOTAL_APPROVED/days × 0.7 a 1.3
    const baseApproved = TOTAL_APPROVED * scaleByFilter / days;
    const variation = 0.7 + rand() * 0.6;
    const approved = Math.round(baseApproved * variation);
    let revenueCents = 0;
    for (const p of productSet) {
      const localShare = p.share / shareSum;
      revenueCents += Math.round(approved * localShare) * p.priceBRL * 100;
    }
    series.push({ day, approved, revenueCents });
  }

  // transactions paginadas (gera 50 fictícias)
  const txCount = Math.min(limit, 50);
  const transactions = [];
  const rand2 = seedrand(99);
  for (let i = 0; i < txCount; i++) {
    const idx = offset + i;
    const p = pickProductByShare(rand2);
    const pool = BUYERS_BY_PRODUCT[p.hotmartId] || PILSEN_BUYERS;
    const b = pool[(idx * 7) % pool.length];
    // 88% approved, 4% canceled, 3% billet_printed, 2% refunded, 1% chargeback, 2% billet ainda em curso
    const statusRoll = rand2();
    let status;
    if (statusRoll < 0.88) status = 'approved';
    else if (statusRoll < 0.92) status = 'canceled';
    else if (statusRoll < 0.95) status = 'billet_printed';
    else if (statusRoll < 0.97) status = 'refunded';
    else status = 'chargeback';

    let cancellationReason = null;
    if (status === 'canceled') {
      const rollReason = rand2();
      let acc = 0;
      for (const r of baseReasons) {
        acc += r.share;
        if (rollReason <= acc) { cancellationReason = r.code; break; }
      }
    }

    const daysAgo = Math.floor(idx / 2); // 2 transações por dia, mais recentes primeiro
    transactions.push({
      transaction_id: `DEMO-${idx.toString().padStart(6, '0')}`,
      product_id_hotmart: p.hotmartId,
      product_id_lj: p.ljId,
      buyer_email: b.email,
      buyer_name: `${b.name} — ${b.buyer}`,
      buyer_phone: `+551199${(100000 + idx * 137 % 900000).toString().padStart(6, '0')}`,
      purchase_status: status,
      transaction_value_cents: p.priceBRL * 100,
      commission_cents: Math.round(p.priceBRL * 100 * 0.04),
      currency: 'BRL',
      is_recurring: false,
      recurrence_number: null,
      occurred_at: fmtDate(daysAgo),
      cancellation_reason: cancellationReason,
      product_name: p.name,
      payment_method: rand2() < 0.7 ? 'CREDIT_CARD' : (rand2() < 0.85 ? 'PIX' : 'BILLET'),
      installments: rand2() < 0.6 ? '1' : (rand2() < 0.85 ? '3' : '6')
    });
  }

  return {
    ok: true,
    period: { fromDate, toDate, days },
    productFilter,
    reasonFilter: reasonFilter || null,
    kpis,
    cancellationReasons,
    products,
    transactions,
    pagination: { limit, offset, total: kpis.totalCount },
    series,
    // V40.7.11 — Flag pra UI eventualmente mostrar badge "modo demo"
    __demoMock: true
  };
}

// V40.7.12 — Mock do forecast-realized-summary. Alimenta o card
// "Forecast × Realizado" e os campos "Vendas Reais (convertidas)" /
// "Faturamento Real" do Resultado Consolidado. Retorna mesma base do
// checkout mock — coerência entre Dashboard > Checkout e Resultados.
function buildDemoForecastRealizedMock(query = {}) {
  const now = new Date('2026-06-19T00:00:00Z');
  const period = String(query.period || '').match(/^\d{4}-\d{2}$/)
    ? String(query.period)
    : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [yearStr, monthStr] = period.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const lastDay = new Date(year, month, 0).getDate();
  const isCurrentMonth = period === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let daysPassed = lastDay;
  if (isCurrentMonth) daysPassed = now.getDate();
  else if (new Date(`${period}-01`) > now) daysPassed = 0;

  // Pra mês corrente, retorna ~100% do volume mensal (já estamos no fim do mês).
  // Pra mês passado, retorna mesmo total. Pra futuro, 0.
  const factor = daysPassed === 0 ? 0 : 1;

  return {
    ok: true,
    period: { yyyymm: period, year, month, daysInMonth: lastDay, daysPassed, today: now.toISOString().slice(0, 10) },
    products: PRODUCTS.map(p => {
      const approved = Math.round(p.monthlyApproved * factor);
      return {
        product_id_lj: p.ljId,
        approved_count: approved,
        total_revenue_cents: approved * p.priceBRL * 100
      };
    }),
    __demoMock: true
  };
}

// V40.7.16 — Mock do pipeline-velocity-summary. RevOps & Velocidade decompõe
// receita por produto em V (Visitas) × C (Conversão) × T (Ticket) / Ciclo.
// Sem tabelas tracker + Hotmart no demo, retorna mock realista por produto +
// distribui visitas por campanha proporcionalmente.
function buildDemoVelocityMock(state = {}) {
  const now = new Date('2026-06-19T00:00:00Z');
  const yyyymm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysPassed = now.getDate();

  // Por produto: Visitas mensais, Customers (PDVs ativos no mês), Ticket, Ciclo
  // V40.7.17 — customers = PDV ÚNICO ATIVO no mês (bar/restaurante/distribuidora).
  // Cada PDV faz ~5 pedidos/mês de reposição → 1.920 PDVs Pilsen × 5 ≈ 9.600 vendas
  // do Checkout. Ratio 5x defensável vs 10x anterior (semanal/quinzenal de reposição).
  // V40.7.18 — Chopp em rota errada: PDVs caem 190→88 (conv 7.3%, abaixo do
  // benchmark de 10%), 88 PDVs × 5 pedidos = 440 vendas/mês do Checkout. Ciclo
  // 45d puxa velocidade pra baixo (R$ 141/dia vs R$ 304 anterior).
  const PRODUCT_METRICS = {
    1781869701831: { visitors: 12000, customers: 1920, ticket: 22, cycleDays: 5 },
    5001:          { visitors: 4500,  customers: 720,  ticket: 28, cycleDays: 9 },
    5002:          { visitors: 1200,  customers: 88,   ticket: 72, cycleDays: 45 }
  };

  const campaigns = Array.isArray(state.campaigns) ? state.campaigns : [];
  const byCampaign = [];

  // Distribui visitas/customers pelo campaigns do produto, peso uniforme.
  for (const [productIdStr, m] of Object.entries(PRODUCT_METRICS)) {
    const pid = Number(productIdStr);
    const pcamps = campaigns.filter(c => Number(c.productId) === pid);
    if (!pcamps.length) continue;
    const visPer = Math.round(m.visitors / pcamps.length);
    const custPer = Math.round(m.customers / pcamps.length);
    let distributedVis = 0, distributedCust = 0;
    pcamps.forEach((c, idx) => {
      const isLast = idx === pcamps.length - 1;
      const visitors = isLast ? (m.visitors - distributedVis) : visPer;
      const customers = isLast ? (m.customers - distributedCust) : custPer;
      distributedVis += visitors;
      distributedCust += customers;
      byCampaign.push({ campaign_id: Number(c.id), visitors, customers });
    });
  }

  const byProduct = Object.entries(PRODUCT_METRICS).map(([pid, m]) => ({
    product_id_lj: Number(pid),
    approved_count: m.customers,
    avg_ticket: m.ticket,
    cycle_days: m.cycleDays
  }));

  return {
    ok: true,
    period: { yyyymm, daysInMonth: lastDay, daysPassed },
    benchmarks: {
      // V40.7.17 — benchmarks B2B (PDV reposição), não B2C checkout direto
      conversion_avg: 0.10,           // 10% — visita-pro-PDV virar pedido recorrente
      conversion_good: 0.15,
      cycle_days_avg: 21,
      cycle_days_good: 10
    },
    byCampaign,
    byProduct,
    __demoMock: true
  };
}

module.exports = { buildDemoCheckoutMock, buildDemoForecastRealizedMock, buildDemoVelocityMock };
