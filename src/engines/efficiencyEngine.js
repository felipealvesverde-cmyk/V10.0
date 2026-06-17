// V39.4.0 — Efficiency Engine (A4 da Onda A — Eficiência de Capital)
//
// Combina LTV (Hotmart pull do customer agregado) + CAC (declarado em
// revopsFinanceV2 via RevopsWhitelabelEngine.computeDashboard) pra
// derivar as 4 métricas da Tríade de Eficiência:
//   - LTV          (R$ médio por customer ao longo da vida)
//   - LTV : CAC    (proporção — saudável ≥ 3:1)
//   - Payback      (CAC ÷ ticket → meses até recuperar; one-time = instant)
//   - NRR          (proxy: 1 − cancellations_30d / active_customers_30d ; só pra subscription)
//
// V39.4.0 modo checkout: 100% funcional.
// Modos crm/hybrid: status 'pending' (depende de Fechamento declarado).

window.EfficiencyEngine = {

  forProduct(productId) {
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    if (!product) return null;
    const channel = product?.audience?.salesChannel || null;
    if (!channel) return { status: 'blocked', salesChannel: null };

    const cache = App.state.efficiencyCache;
    if (!cache) return { status: 'loading', salesChannel: channel };
    if (cache.loading) return { status: 'loading', salesChannel: channel };
    if (cache.error) return { status: 'error', salesChannel: channel, error: cache.error };

    if (channel === 'crm' || channel === 'hybrid') {
      return { status: 'pending', salesChannel: channel };
    }

    // checkout
    const row = (cache.byProduct || []).find(r => Number(r.product_id_lj) === Number(productId));
    if (!row || row.customers_count === 0) {
      return { status: 'empty', salesChannel: channel };
    }

    const ltv = row.ltv;
    const hasSubscriptions = row.has_subscriptions;
    const customersCount = row.customers_count;

    // CAC declarado (vem do RevopsFinanceV2 via engine)
    const cacInfo = this._readCAC(productId);

    let ltvCacRatio = null;
    let paybackMonths = null;
    if (cacInfo.cac > 0 && ltv > 0) {
      ltvCacRatio = ltv / cacInfo.cac;
      // Payback simplificado: CAC ÷ ticket_medio.
      // Pra one-time = LTV (compra única), payback ≤ ticket → instantâneo (zero meses)
      // Pra subscription: precisa mensalidade média. V39.4 usa ticket atual como aproximação.
      const ticket = cacInfo.ticket || ltv;
      paybackMonths = ticket > 0 ? cacInfo.cac / ticket : null;
    }

    // NRR proxy: só pra subscription
    let nrr = null;
    let nrrStatus = 'na';  // 'na' | 'ok' | 'insufficient'
    if (hasSubscriptions) {
      if (row.active_30d > 0) {
        const churnRate = (row.cancellations_30d + row.refunds_30d) / row.active_30d;
        nrr = Math.max(0, 1 - churnRate);
        nrrStatus = row.active_30d >= 10 ? 'ok' : 'insufficient';
      } else {
        nrrStatus = 'insufficient';
      }
    }

    const benchmarks = cache.benchmarks || { ltv_cac_healthy: 3.0, payback_healthy_months: 12, nrr_healthy: 1.0, nrr_excellent: 1.10 };

    return {
      status: 'ok',
      salesChannel: channel,
      ltv,
      ltvCacRatio,
      paybackMonths,
      nrr,
      nrrStatus,
      cac: cacInfo.cac,
      cacSource: cacInfo.source,  // 'declared' | 'missing'
      ticket: cacInfo.ticket,
      hasSubscriptions,
      customersCount,
      activeCustomers30d: row.active_30d,
      refunds90d: row.refunds_90d,
      cancellations90d: row.cancellations_90d,
      benchmarks
    };
  },

  // Lê o CAC declarado do produto via RevopsWhitelabelEngine.computeDashboard.
  // Fallback: tenta metasResultado legado.
  _readCAC(productId) {
    if (window.RevopsWhitelabelEngine && typeof RevopsWhitelabelEngine.computeDashboard === 'function') {
      const dash = RevopsWhitelabelEngine.computeDashboard(productId);
      if (dash && dash.cacPrevisto > 0) {
        return { cac: dash.cacPrevisto, ticket: dash.ticket || 0, source: 'declared' };
      }
    }
    // Fallback legado V37.0.0 metasResultado
    const metas = App.state.metasResultado?.[productId];
    if (metas) {
      const now = new Date();
      const yyyymm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthMeta = metas[yyyymm];
      if (monthMeta && Number(monthMeta.cac) > 0) {
        return { cac: Number(monthMeta.cac), ticket: 0, source: 'declared' };
      }
    }
    return { cac: 0, ticket: 0, source: 'missing' };
  },

  // Semáforos por métrica
  ltvCacSemaforo(ratio, benchmarks) {
    if (ratio == null) return 'gray';
    if (ratio >= benchmarks.ltv_cac_healthy) return 'green';
    if (ratio >= benchmarks.ltv_cac_healthy * 0.66) return 'amber';
    return 'red';
  },
  paybackSemaforo(months, benchmarks) {
    if (months == null) return 'gray';
    if (months < 0.1) return 'green';  // instantâneo
    if (months < benchmarks.payback_healthy_months) return 'green';
    if (months < benchmarks.payback_healthy_months * 1.5) return 'amber';
    return 'red';
  },
  nrrSemaforo(nrr, status, benchmarks) {
    if (status === 'na') return 'gray';
    if (status === 'insufficient') return 'gray';
    if (nrr == null) return 'gray';
    if (nrr >= benchmarks.nrr_excellent) return 'green';
    if (nrr >= benchmarks.nrr_healthy) return 'emerald';
    if (nrr >= 0.9) return 'amber';
    return 'red';
  },

  // Diagnóstico em prosa do A4 — qual a perna mais frágil e o que fazer.
  diagnose(snap) {
    if (!snap || snap.status !== 'ok') return '';
    const parts = [];
    if (snap.cacSource === 'missing') {
      parts.push('Você ainda não definiu CAC esperado nas ofertas do produto.');
      parts.push('Sem CAC, não dá pra calcular se o cliente "se paga". Defina nas ofertas pra destravar LTV:CAC e Payback.');
      return parts.join(' ');
    }
    if (snap.ltvCacRatio != null) {
      if (snap.ltvCacRatio >= snap.benchmarks.ltv_cac_healthy) {
        parts.push(`LTV:CAC em ${snap.ltvCacRatio.toFixed(2)}:1 — cada R$ 1 investido pra trazer cliente devolve R$ ${snap.ltvCacRatio.toFixed(2)}.`);
      } else if (snap.ltvCacRatio >= snap.benchmarks.ltv_cac_healthy * 0.66) {
        parts.push(`LTV:CAC em ${snap.ltvCacRatio.toFixed(2)}:1, abaixo do saudável (≥ 3:1). Cliente cobre o custo mas com pouca margem — risco se CAC subir.`);
      } else {
        parts.push(`LTV:CAC em ${snap.ltvCacRatio.toFixed(2)}:1, abaixo do saudável (≥ 3:1). Modelo destruindo caixa: cada cliente novo subtrai valor.`);
      }
    }
    if (snap.paybackMonths != null && snap.paybackMonths >= 0.1) {
      if (snap.paybackMonths < snap.benchmarks.payback_healthy_months) {
        parts.push(`Payback de ${snap.paybackMonths.toFixed(1)} mês(es) — bom, recupera o CAC rápido.`);
      } else {
        parts.push(`Payback de ${snap.paybackMonths.toFixed(1)} mês(es), longo demais. Exige capital de giro alto pra crescer.`);
      }
    } else if (snap.paybackMonths != null) {
      parts.push('Payback instantâneo (cliente paga o CAC na primeira compra) — produto one-time saudável.');
    }
    if (snap.nrr != null && snap.nrrStatus === 'ok') {
      if (snap.nrr >= snap.benchmarks.nrr_excellent) {
        parts.push(`NRR ${(snap.nrr * 100).toFixed(0)}% — base atual cresce sozinha sem precisar trazer novos clientes. Estado de arte.`);
      } else if (snap.nrr >= snap.benchmarks.nrr_healthy) {
        parts.push(`NRR ${(snap.nrr * 100).toFixed(0)}% — base estável. Trabalhe upsell pra subir ≥ 110% e crescer só pela retenção.`);
      } else {
        parts.push(`NRR ${(snap.nrr * 100).toFixed(0)}% — sua base encolhe ${((1 - snap.nrr) * 100).toFixed(0)}% ao mês sem novos. Você está enchendo balde furado.`);
      }
    } else if (snap.hasSubscriptions && snap.nrrStatus === 'insufficient') {
      parts.push('NRR exige ≥ 10 customers ativos em recorrência pra ser estatisticamente honesto. Aguardando mais base.');
    } else if (!snap.hasSubscriptions) {
      parts.push('NRR não se aplica a produto sem recorrência — fica como N/A.');
    }
    return parts.join(' ');
  },

  fmtMoney(v) {
    const n = Number(v) || 0;
    if (Math.abs(n) >= 1000000) return `R$ ${(n / 1000000).toFixed(1)}M`;
    if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toFixed(1)}k`;
    return `R$ ${n.toFixed(0)}`;
  }
};
