// V39.2.0 — Forecast × Realizado Engine
//
// Calcula, pra cada produto LJ, o trio:
//   meta declarada     (revopsFinanceV2[pid].offers[].metaVendas)
//   realizado até hoje (lj_hotmart_purchases via forecastRealizedCache do mês corrente)
//   projeção fim do mês (realizado × dias_do_mês / dias_passados)
//
// Variância = (projeção − meta) / meta
// Semáforo:  verde se projeção ≥ meta, amarelo se ≥ 85%, vermelho < 85%.
//
// V39.2.0 atende SÓ produtos com salesChannel='checkout'. Pra 'crm' ou
// 'hybrid', forProduct devolve status='pending' apontando que a fonte do
// realizado (Fechamento mensal declarado) ainda não foi cravada — UI mostra
// placeholder. V39.3 fecha esse caminho.
//
// salesChannel=null → status='blocked' (cliente precisa preencher salesChannel
// via wizard pra destravar).

window.ForecastRealizadoEngine = {
  // Lê todas as metas das ofertas do produto e soma. Retorna em reais.
  metaForProduct(productId) {
    const v2 = (App.state.revopsFinanceV2 || {})[productId];
    if (!v2 || !Array.isArray(v2.offers)) return 0;
    return v2.offers.reduce((acc, o) => acc + (Number(o.metaVendas) || 0), 0);
  },

  // Lê realizado do cache do endpoint /api/forecast-realized-summary.
  // Retorna { ok, total_revenue, approved_count, daysInMonth, daysPassed }.
  realizedForProduct(productId) {
    const cache = App.state.forecastRealizedCache;
    if (!cache || !cache.loaded) return { ok: false, total_revenue: 0, approved_count: 0 };
    const row = (cache.products || []).find(p => Number(p.product_id_lj) === Number(productId));
    return {
      ok: true,
      total_revenue: row ? row.total_revenue_cents / 100 : 0,
      approved_count: row ? row.approved_count : 0,
      daysInMonth: cache.period?.daysInMonth || 30,
      daysPassed: cache.period?.daysPassed || 1,
      yyyymm: cache.period?.yyyymm || ''
    };
  },

  // Status leitor pra UI saber se mostra card, placeholder ou aviso.
  // Retorna 'ok' | 'pending' | 'blocked' | 'loading'.
  statusForProduct(product) {
    const channel = product?.audience?.salesChannel;
    if (!channel) return 'blocked';
    const cache = App.state.forecastRealizedCache;
    if (channel === 'checkout') {
      if (!cache) return 'loading';
      if (cache.loading) return 'loading';
      if (cache.error) return 'error';
      return 'ok';
    }
    // V39.2.0: CRM e híbrido ainda não têm fonte cravada
    return 'pending';
  },

  // Snapshot completo do produto pra UI consumir num único shot.
  forProduct(productId) {
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    if (!product) return null;
    const status = this.statusForProduct(product);
    const meta = this.metaForProduct(productId);
    const channel = product.audience?.salesChannel || null;

    if (status !== 'ok') {
      return {
        productId: Number(productId),
        status,
        salesChannel: channel,
        meta,
        realized: 0,
        projected: 0,
        variance: 0,
        progressPct: 0,
        semaforo: 'gray',
        daysInMonth: null,
        daysPassed: null,
        yyyymm: null
      };
    }

    const r = this.realizedForProduct(productId);
    const realized = r.total_revenue;
    const ratio = r.daysPassed > 0 ? r.daysInMonth / r.daysPassed : 1;
    const projected = realized * ratio;
    const variance = meta > 0 ? (projected - meta) / meta : 0;
    const progressPct = meta > 0 ? Math.min(100, Math.round((realized / meta) * 100)) : 0;
    const semaforo = meta <= 0
      ? 'gray'
      : projected >= meta
        ? 'green'
        : projected >= meta * 0.85
          ? 'amber'
          : 'red';

    return {
      productId: Number(productId),
      status: 'ok',
      salesChannel: channel,
      meta,
      realized,
      projected,
      variance,
      progressPct,
      semaforo,
      approvedCount: r.approved_count,
      daysInMonth: r.daysInMonth,
      daysPassed: r.daysPassed,
      yyyymm: r.yyyymm
    };
  },

  // Helper formatação BR.
  formatMoney(v) {
    const n = Number(v) || 0;
    if (Math.abs(n) >= 1000000) return `R$ ${(n / 1000000).toFixed(1)}M`;
    if (Math.abs(n) >= 1000) return `R$ ${(n / 1000).toFixed(0)}k`;
    return `R$ ${n.toFixed(0)}`;
  },

  formatPct(v) {
    const n = Number(v) || 0;
    const sign = n > 0 ? '+' : '';
    return `${sign}${(n * 100).toFixed(0)}%`;
  }
};
