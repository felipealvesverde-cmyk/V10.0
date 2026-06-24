// V39.3.0 — Pipeline Velocity Engine (A3 do roadmap RevOps LJ 2.0)
//
// Decompõe a velocidade da máquina em 4 letras:
//   V = Visitas únicas/mês        (lj_visitor_touchpoints distinct visitors)
//   C = Conversão visitor→customer (customers / visitors)
//   L = Ticket médio              (lj_hotmart_purchases aprovados 90d)
//   T = Tempo de ciclo (dias)     (mediana purchase_at - first_touch_at)
//
// Velocidade = V × C × L / T → R$/dia que a máquina gera estruturalmente.
//
// V39.3.0: agrega por PRODUTO via campaign.productId. Cliente com salesChannel
// 'checkout' funciona 100%. Modos crm/hybrid recebem 'pending' status até
// onda futura cravar a fonte (deals fechados RD + Fechamento manual).

window.PipelineVelocityEngine = {

  // Lê o cache + agrega por produto via campaigns→productId mapping.
  // Retorna { V, C, L, T, velocity, status, gargalo, diagnostico }.
  forProduct(productId) {
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    if (!product) return null;
    const channel = product?.audience?.salesChannel || null;
    if (!channel) return { status: 'blocked', salesChannel: null };

    const cache = App.state.pipelineVelocityCache;
    if (!cache) return { status: 'loading', salesChannel: channel };
    if (cache.loading) return { status: 'loading', salesChannel: channel };
    if (cache.error) return { status: 'error', salesChannel: channel, error: cache.error };

    // V40.14.10 — Modo CRM: lê de byProductCrm (agregação de lj_rd_deals do
    // tenant DB). Quando há dados → calcula V/C/L/T do funil de vendas. Sem
    // dados → pending honesto. Híbrido continua pending até onda futura que
    // some Checkout + CRM.
    if (channel === 'crm') {
      const crmRow = (cache.byProductCrm || []).find(r => Number(r.product_id_lj) === Number(productId));
      if (!crmRow) {
        return { status: 'pending', salesChannel: channel };
      }
      const V = Number(crmRow.abordagens_mes) || 0;
      const wonMes = Number(crmRow.won_mes) || 0;
      const L = Number(crmRow.avg_ticket) || 0;
      const T = Number(crmRow.cycle_days) || 0;
      // V/C/L/T pro CRM: V = abordagens no mês, C = won/abordagens no mês.
      // Pode dar > 1 em meses onde won veio de abordagem de mês anterior — clamp.
      const C = V > 0 ? Math.min(wonMes / V, 1) : 0;
      const safeT = T > 0 ? T : 1;
      const velocity = V > 0 && C > 0 && L > 0 ? (V * C * L) / safeT : 0;

      const benchmarks = cache.benchmarks || {};
      const crmConvAvg = benchmarks.crm_conversion_avg ?? 0.10;
      const crmCycleAvg = benchmarks.crm_cycle_days_avg ?? 45;

      let gargalo = null;
      const totalmenteZerado = V === 0 && wonMes === 0;
      if (!totalmenteZerado) {
        if (V === 0) gargalo = 'V';
        else if (C === 0 || (C < crmConvAvg && C < 0.08)) gargalo = 'C';
        else if (T === 0 || T > crmCycleAvg * 1.5) gargalo = 'T';
        else if (L > 0 && L < 5000) gargalo = 'L';  // ticket B2B atacado < R$ 50
      }

      return {
        status: 'ok',
        salesChannel: channel,
        V,
        C,
        L,
        T,
        velocity,
        approvedCount: wonMes,
        customersCount: wonMes,
        gargalo,
        benchmarks: { conversion_avg: crmConvAvg, conversion_good: benchmarks.crm_conversion_good ?? 0.20, cycle_days_avg: crmCycleAvg, cycle_days_good: benchmarks.crm_cycle_days_good ?? 30 },
        yyyymm: cache.period?.yyyymm || '',
        daysPassed: cache.period?.daysPassed || 0,
        daysInMonth: cache.period?.daysInMonth || 30
      };
    }

    // Híbrido continua pending — onda futura cravará a fusão checkout + CRM.
    if (channel === 'hybrid') {
      return { status: 'pending', salesChannel: channel };
    }

    // checkout: agrega tudo
    const campanhasDoProduto = (App.state.campaigns || [])
      .filter(c => Number(c.productId) === Number(productId))
      .map(c => Number(c.id));
    const campanhaSet = new Set(campanhasDoProduto);

    let V = 0;
    let customers = 0;
    for (const row of (cache.byCampaign || [])) {
      if (campanhaSet.has(Number(row.campaign_id))) {
        V += row.visitors;
        customers += row.customers;
      }
    }
    const byProductRow = (cache.byProduct || []).find(r => Number(r.product_id_lj) === Number(productId));
    const L = byProductRow ? byProductRow.avg_ticket : 0;
    const T = byProductRow ? byProductRow.cycle_days : 0;
    const approvedCount = byProductRow ? byProductRow.approved_count : 0;

    const C = V > 0 ? customers / V : 0;
    // Velocidade: (V × C × L) ocorre no mês; T em dias.
    // R$/dia estrutural = V*C*L / max(T, 1)
    const safeT = T > 0 ? T : 1;
    const velocity = V > 0 && C > 0 && L > 0 ? (V * C * L) / safeT : 0;

    // Identifica gargalo: qual letra está mais abaixo do benchmark.
    // V39.6.0 — Quando produto está 100% zerado (V=0 + C=0 + sem vendas), não
    // destaca nenhum gargalo. "Vazio" não é "ruim" — é falta de ativação.
    const benchmarks = cache.benchmarks || { conversion_avg: 0.03, conversion_good: 0.05, cycle_days_avg: 14, cycle_days_good: 7 };
    let gargalo = null;
    const totalmenteZerado = V === 0 && C === 0 && approvedCount === 0;
    if (totalmenteZerado) {
      gargalo = null;
    } else if (V === 0) gargalo = 'V';
    else if (C === 0 || (C < benchmarks.conversion_avg && C < 0.04)) gargalo = 'C';
    else if (T === 0 || T > benchmarks.cycle_days_avg * 1.5) gargalo = 'T';
    else if (L > 0 && L < 100) gargalo = 'L';

    return {
      status: 'ok',
      salesChannel: channel,
      V,
      C,
      L,
      T,
      velocity,
      approvedCount,
      customersCount: customers,
      gargalo,
      benchmarks,
      yyyymm: cache.period?.yyyymm || '',
      daysPassed: cache.period?.daysPassed || 0,
      daysInMonth: cache.period?.daysInMonth || 30
    };
  },

  diagnose(snapshot) {
    if (!snapshot || snapshot.status !== 'ok') return '';
    const { V, C, L, T, velocity, gargalo, benchmarks } = snapshot;
    if (V === 0) {
      return 'Não há visitas atribuídas a campanhas deste produto no mês. Antes de mexer em qualquer letra, ative pelo menos uma campanha com tracking UTM apontando pra este produto.';
    }
    if (C === 0 && V > 0) {
      return `Você teve ${V} visitas no mês mas 0 customers atribuídos. Pode ser problema de tracking (visitor não bate com compra Hotmart pelo email) OU conversão real zerada. Investigue.`;
    }
    const cPct = (C * 100).toFixed(1);
    const benchAvg = (benchmarks.conversion_avg * 100).toFixed(0);
    const benchGood = (benchmarks.conversion_good * 100).toFixed(0);
    const sentences = [];
    if (gargalo === 'C') {
      sentences.push(`Sua conversão (C) está em ${cPct}%. Mercado parecido converte entre ${benchAvg}% e ${benchGood}%.`);
      sentences.push(`Cada ponto a mais de conversão dobra sua velocidade sem gastar mais 1 real em mídia. Essa é a alavanca mais barata.`);
    } else if (gargalo === 'T') {
      sentences.push(`Seu ciclo (T) é de ${T.toFixed(1)} dias. Mercado de checkout médio fecha em ${benchmarks.cycle_days_good}-${benchmarks.cycle_days_avg} dias.`);
      sentences.push(`Cortar o ciclo pela metade dobra a velocidade. Nutrição automatizada, retargeting agressivo e prova social ajudam.`);
    } else if (gargalo === 'L') {
      sentences.push(`Seu ticket (L) está em R$ ${L.toFixed(0)} — relativamente baixo.`);
      sentences.push(`Adicionar um cross-sell ou subir o ticket via combo aumenta a velocidade proporcionalmente, sem mexer em conversão ou mídia.`);
    } else if (gargalo === 'V') {
      sentences.push(`Seu volume (V) é baixo. Antes de otimizar conversão ou ticket, vale investir em tráfego pago e SEO pra alimentar o topo do funil.`);
    } else {
      sentences.push(`As 4 letras estão equilibradas. Sua velocidade é R$ ${this.fmtMoney(velocity)}/dia. Pra crescer, mexa em qualquer letra — não há gargalo claro.`);
    }
    return sentences.join(' ');
  },

  // Simulador: e se eu dobrar V/C/L ou cortar T pela metade?
  simulate(snapshot) {
    if (!snapshot || snapshot.status !== 'ok' || !snapshot.velocity) return null;
    const { V, C, L, T, velocity } = snapshot;
    const safeT = T > 0 ? T : 1;
    return {
      base: velocity,
      double_V: V > 0 ? (V * 2 * C * L) / safeT : 0,
      double_C: C > 0 ? (V * (C * 2) * L) / safeT : 0,
      double_L: L > 0 ? (V * C * (L * 2)) / safeT : 0,
      half_T: T > 0 ? (V * C * L) / (T / 2) : 0
    };
  },

  fmtMoney(v) {
    const n = Number(v) || 0;
    if (Math.abs(n) >= 1000000) return `R$ ${(n / 1000000).toFixed(1)}M`;
    if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toFixed(1)}k`;
    return `R$ ${n.toFixed(0)}`;
  },

  fmtPct(v) {
    const n = Number(v) || 0;
    return `${(n * 100).toFixed(1)}%`;
  }
};
