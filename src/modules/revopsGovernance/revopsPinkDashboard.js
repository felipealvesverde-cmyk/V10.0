// V14.2 — Painel Rosa: dashboard didático que conecta receita, custo de mídia,
// CAC, contribuição unitária, margem de segurança, breakeven e curva de EBITDA.
var RevopsPinkDashboard = {
  render(config) {
    const dashboard = RevopsFinanceEngine.computeDashboard(config);
    const productId = config.productId || App.state.revopsSelectedProductId;
    const alerts = RevopsFinanceEngine.dashboardAlerts(productId);
    return `<section class="rounded-[2rem] p-5 lg:p-6 shadow-sm border border-pink-200" style="background: linear-gradient(135deg, #fdf2f8 0%, #fce7f3 60%, #fbcfe8 130%);">
      ${this._header(dashboard)}
      ${this._alertBanner(alerts, productId)}
      <div class="grid md:grid-cols-2 xl:grid-cols-5 gap-3 mt-4">
        ${this._kpiCard('Ticket Médio (TM)', RevopsFinanceEngine.money(dashboard.ticket), 'tag', 'TM ponderado pelo mix das ofertas', '', productId, 'ticket', dashboard.ticket)}
        ${this._kpiCard('Margem Contribuição Unit.', RevopsFinanceEngine.money(dashboard.contributionUnit), 'percent', `TM − ${RevopsFinanceEngine.percent(dashboard.variablePct)} de impostos/parceiros`, '', productId, 'contributionUnit', dashboard.contributionUnit)}
        ${this._kpiCard('CAC Geral', dashboard.realSales > 0 ? RevopsFinanceEngine.money(dashboard.cac) : '—', 'megaphone', `${RevopsFinanceEngine.money(dashboard.mediaInvestment)} / ${dashboard.realSales} vendas reais`, dashboard.realSales === 0 ? 'text-slate-400' : '', productId, 'cac', dashboard.cac)}
        ${this._safetyCard(dashboard, productId)}
        ${this._mediaCard(dashboard)}
      </div>
      <div class="grid xl:grid-cols-[1.2fr_1fr] gap-4 mt-4">
        ${this._breakevenThermometer(dashboard, productId)}
        ${this._ebitdaChart(config, dashboard, productId)}
      </div>
      ${this._reactivityHint(dashboard)}
    </section>`;
  },

  _alertBanner(alerts, productId) {
    if (!alerts.length) return '';
    return `<div class="mt-4 space-y-2">${alerts.map(alert => {
      const palette = alert.level === 'critical'
        ? { bg: 'bg-red-100', border: 'border-red-300', icon: 'alert-octagon', text: 'text-red-900' }
        : { bg: 'bg-amber-100', border: 'border-amber-300', icon: 'alert-triangle', text: 'text-amber-900' };
      const targetEncoded = encodeURIComponent(JSON.stringify(alert.suggestKr));
      return `<div class="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-2xl p-3 border ${palette.bg} ${palette.border}">
        <div class="flex items-start gap-3">
          <div class="w-9 h-9 rounded-xl bg-white grid place-items-center"><i data-lucide="${palette.icon}" class="w-4 h-4 ${palette.text}"></i></div>
          <div>
            <p class="text-sm font-black ${palette.text}">${Utils.escape(alert.title)}</p>
            <p class="text-xs ${palette.text} opacity-90">${Utils.escape(alert.insight)}</p>
          </div>
        </div>
        <button onclick="Actions.openRevopsOkrFromAlert(${productId}, '${targetEncoded}')" class="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-900 font-black text-xs flex items-center gap-1"><i data-lucide="compass" class="w-3.5 h-3.5"></i> Criar OKR de correção</button>
      </div>`;
    }).join('')}</div>`;
  },

  _header(d) {
    const healthClass = d.cacHealth === 'Saudável' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : d.cacHealth === 'Atenção' ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-red-100 text-red-700 border-red-200';
    return `<div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
      <div>
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-200/60 border border-rose-300 text-rose-900 text-[11px] font-black uppercase tracking-wider mb-2">
          <i data-lucide="heart-pulse" class="w-3.5 h-3.5"></i> Painel RevOps • Inteligência do Produto
        </div>
        <h2 class="text-2xl font-black text-rose-900">Estabilização antes da ação</h2>
        <p class="text-sm text-rose-900/70 max-w-2xl">Leia o produto como uma operação financeira viva. Os números abaixo reagem instantaneamente a mudanças nas campanhas, no funil e nas ofertas.</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="px-3 py-2 rounded-2xl bg-white/70 border border-rose-200 text-rose-900 text-xs font-black"><i data-lucide="activity" class="w-3.5 h-3.5 inline mr-1"></i> Saúde CAC: <b>${d.cacHealth}</b></span>
        <span class="px-3 py-2 rounded-2xl border text-xs font-black ${healthClass}">EBITDA: ${d.ebitda >= 0 ? 'no positivo' : 'no vermelho'}</span>
      </div>
    </div>`;
  },

  _kpiCard(label, value, icon, hint = '', valueClass = '', productId = null, metricId = null, currentValue = 0) {
    const okrButton = productId && metricId ? `<button onclick="Actions.openRevopsOkrFromKpi(${productId}, '${metricId}', ${Number(currentValue) || 0})" title="Criar OKR para este indicador" class="px-2 py-1 rounded-md bg-rose-100 hover:bg-rose-200 border border-rose-200 text-rose-800 text-[10px] font-black flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i> OKR</button>` : '';
    return `<div class="bg-white rounded-3xl p-4 border border-pink-100 shadow-sm">
      <div class="flex items-center justify-between mb-1 gap-2">
        <span class="text-[11px] font-black text-rose-700 uppercase tracking-wider">${Utils.escape(label)}</span>
        ${okrButton || `<i data-lucide="${icon}" class="w-4 h-4 text-rose-400"></i>`}
      </div>
      <div class="text-2xl font-black text-rose-950 ${valueClass}">${value}</div>
      <p class="text-[11px] text-slate-500 mt-1 leading-tight">${Utils.escape(hint)}</p>
    </div>`;
  },

  _safetyCard(d, productId) {
    const positive = d.safetyMargin > 0;
    const value = RevopsFinanceEngine.money(d.safetyMargin);
    const colorClass = positive ? 'text-emerald-700' : d.safetyMargin === 0 ? 'text-slate-600' : 'text-red-700';
    const pct = d.contributionUnit > 0 ? RevopsFinanceEngine.percent(d.safetyMarginPercent) : '—';
    const hint = d.realSales === 0
      ? 'Preencha vendas no funil ou ative campanhas para calcular CAC e margem de segurança.'
      : positive
        ? `Cada venda deixa ${value} líquido após pagar CAC e custos variáveis (${pct} do TM).`
        : `Sua contribuição não cobre o CAC atual. Reveja mídia, ticket ou ofertas (${pct} do TM).`;
    const okrButton = productId ? `<button onclick="Actions.openRevopsOkrFromKpi(${productId}, 'safetyMargin', ${Number(d.safetyMargin) || 0})" title="Criar OKR para Margem de Segurança" class="px-2 py-1 rounded-md bg-rose-100 hover:bg-rose-200 border border-rose-200 text-rose-800 text-[10px] font-black flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i> OKR</button>` : '';
    return `<div class="bg-white rounded-3xl p-4 border ${positive ? 'border-emerald-200' : 'border-rose-200'} shadow-sm">
      <div class="flex items-center justify-between mb-1 gap-2">
        <span class="text-[11px] font-black text-rose-700 uppercase tracking-wider">Margem Segurança Unit.</span>
        ${okrButton || '<i data-lucide="shield-check" class="w-4 h-4 text-rose-400"></i>'}
      </div>
      <div class="text-2xl font-black ${colorClass}">${value}</div>
      <p class="text-[11px] text-slate-500 mt-1 leading-tight">${Utils.escape(hint)}</p>
    </div>`;
  },

  _mediaCard(d) {
    const activeCount = (App.state.campaigns || []).filter(c => Number(c.productId) === Number(d.productId) && String(c.status || 'Ativa').toLowerCase() === 'ativa').length;
    return `<div class="bg-white rounded-3xl p-4 border border-pink-100 shadow-sm">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[11px] font-black text-rose-700 uppercase tracking-wider">Mídia ativa</span>
        <i data-lucide="wallet-cards" class="w-4 h-4 text-rose-400"></i>
      </div>
      <div class="text-2xl font-black text-rose-950">${RevopsFinanceEngine.money(d.mediaInvestment)}</div>
      <p class="text-[11px] text-slate-500 mt-1 leading-tight">${activeCount} campanha(s) ativa(s) somando este investimento. Edite cada campanha para ajustar.</p>
    </div>`;
  },

  _breakevenThermometer(d, productId) {
    if (d.breakevenSales === null) {
      return `<div class="bg-white rounded-3xl p-5 border border-pink-100 shadow-sm">
        <h3 class="text-lg font-black text-rose-900 mb-2">Breakeven indisponível</h3>
        <p class="text-sm text-slate-500">A contribuição unitária está zerada ou negativa. Ajuste ticket, mix das ofertas ou %CV para destravar o cálculo.</p>
      </div>`;
    }

    const pct = Math.min(100, Math.max(0, d.realProgress));
    const status = d.beStatus;
    const palette = {
      reached: { bar: '#10b981', label: 'Breakeven atingido', text: 'text-emerald-700' },
      close: { bar: '#f59e0b', label: 'Quase lá', text: 'text-amber-700' },
      midway: { bar: '#f59e0b', label: 'Meio caminho', text: 'text-amber-700' },
      far: { bar: '#ef4444', label: 'Zona de alerta', text: 'text-red-700' },
      pending: { bar: '#cbd5e1', label: 'Sem vendas reais', text: 'text-slate-600' },
      invalid: { bar: '#cbd5e1', label: 'Indisponível', text: 'text-slate-600' }
    }[status] || { bar: '#cbd5e1', label: 'Sem dados', text: 'text-slate-600' };

    const beXPos = 100;
    const realXPos = Math.min(100, pct);
    const remaining = d.remaining === null ? '—' : d.remaining;
    const messagePrincipal = d.realSales === 0
      ? `Você ainda não tem vendas reais. Meta: ${d.breakevenSales} unidades para o produto começar a dar lucro.`
      : status === 'reached'
        ? `Você vendeu ${d.realSales} unidades e já passou do Breakeven (${d.breakevenSales}). Lucro real começa agora.`
        : `Você vendeu ${d.realSales} unidades. Faltam ${remaining} para atingir o Breakeven de ${d.breakevenSales} e o produto começar a dar lucro.`;

    const okrButton = productId ? `<button onclick="Actions.openRevopsOkrFromKpi(${productId}, 'breakevenSales', ${Number(d.breakevenSales) || 0})" title="Criar OKR para Breakeven" class="px-2 py-1 rounded-md bg-rose-100 hover:bg-rose-200 border border-rose-200 text-rose-800 text-[10px] font-black flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i> OKR</button>` : '';
    return `<div class="bg-white rounded-3xl p-5 border border-pink-100 shadow-sm">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 class="text-lg font-black text-rose-900">Termômetro de Breakeven</h3>
          <p class="text-xs text-rose-900/70">Indicador vivo: cresce conforme as ações convertem leads em vendas reais.</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-3 py-1.5 rounded-full text-[11px] font-black ${palette.text} bg-rose-50 border border-rose-200">${palette.label}</span>
          ${okrButton}
        </div>
      </div>
      <div class="relative h-12 rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden">
        <div class="absolute inset-y-0 left-0 transition-all duration-500" style="width:${realXPos}%; background:linear-gradient(90deg, ${palette.bar}99 0%, ${palette.bar} 100%);"></div>
        <div class="absolute top-0 bottom-0 border-l-2 border-dashed border-slate-700" style="left:${beXPos}%; transform: translateX(-1px);"></div>
        <div class="absolute inset-0 flex items-center justify-between px-3 text-[11px] font-black text-slate-700">
          <span>0 vendas</span>
          <span>BE ${d.breakevenSales}</span>
        </div>
        <div class="absolute -top-1 left-0 w-full h-1 flex items-center" style="pointer-events:none;">
          <div class="absolute h-3 w-3 rounded-full bg-white border-2 border-slate-700 shadow" style="left:calc(${realXPos}% - 6px); top:50%; transform:translateY(-50%);"></div>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-2 mt-3 text-center">
        <div class="rounded-2xl bg-rose-50 border border-rose-100 p-2"><p class="text-[10px] text-rose-700 font-black uppercase">Vendido</p><p class="text-lg font-black text-rose-950">${d.realSales}</p></div>
        <div class="rounded-2xl bg-rose-50 border border-rose-100 p-2"><p class="text-[10px] text-rose-700 font-black uppercase">Faltam</p><p class="text-lg font-black text-rose-950">${remaining}</p></div>
        <div class="rounded-2xl bg-rose-50 border border-rose-100 p-2"><p class="text-[10px] text-rose-700 font-black uppercase">Meta BE</p><p class="text-lg font-black text-rose-950">${d.breakevenSales}</p></div>
      </div>
      <p class="text-sm text-slate-700 mt-3 leading-snug">${Utils.escape(messagePrincipal)}</p>
    </div>`;
  },

  _ebitdaChart(config, d, productId) {
    const curve = RevopsFinanceEngine.buildEbitdaCurve(config, 14);
    const series = curve.series;
    if (!series.length || curve.maxSales <= 0) {
      return `<div class="bg-white rounded-3xl p-5 border border-pink-100 shadow-sm">
        <h3 class="text-lg font-black text-rose-900 mb-2">EBITDA Projetado vs Real</h3>
        <p class="text-sm text-slate-500">Sem dados suficientes. Preencha ofertas, custos e ative campanhas.</p>
      </div>`;
    }
    const ebitdas = series.map(p => p.ebitda);
    const maxEbitda = Math.max(...ebitdas);
    const minEbitda = Math.min(...ebitdas);
    const W = 360, H = 200, P = 24;
    const xRange = curve.maxSales;
    const yRange = (maxEbitda - minEbitda) || 1;
    const toX = sales => P + (sales / xRange) * (W - 2 * P);
    const toY = ebitda => H - P - ((ebitda - minEbitda) / yRange) * (H - 2 * P);

    const path = series.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.sales).toFixed(1)} ${toY(p.ebitda).toFixed(1)}`).join(' ');
    const zeroY = toY(0);
    const beX = curve.breakevenSales !== null ? toX(curve.breakevenSales) : null;
    const realX = toX(curve.realSales);
    const projX = toX(curve.projectedSales);
    const realY = toY(d.realEbitda);
    const projY = toY(d.ebitda);

    const okrButton = productId ? `<button onclick="Actions.openRevopsOkrFromKpi(${productId}, 'ebitda', ${Number(d.ebitda) || 0})" title="Criar OKR para EBITDA" class="px-2 py-1 rounded-md bg-rose-100 hover:bg-rose-200 border border-rose-200 text-rose-800 text-[10px] font-black flex items-center gap-1 ml-2"><i data-lucide="plus" class="w-3 h-3"></i> OKR</button>` : '';
    return `<div class="bg-white rounded-3xl p-5 border border-pink-100 shadow-sm">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 class="text-lg font-black text-rose-900">EBITDA Projetado vs Real</h3>
          <p class="text-xs text-rose-900/70">Escala do lucro conforme o volume de vendas avança.</p>
        </div>
        <div class="flex items-start gap-2">
          <div class="text-right">
            <p class="text-[11px] text-rose-700 font-black">EBITDA real estimado</p>
            <p class="text-xl font-black ${d.realEbitda >= 0 ? 'text-emerald-700' : 'text-red-700'}">${RevopsFinanceEngine.money(d.realEbitda)}</p>
          </div>
          ${okrButton}
        </div>
      </div>
      <svg viewBox="0 0 ${W} ${H}" class="w-full h-48">
        <defs>
          <linearGradient id="ebGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#ec4899" stop-opacity="0.30"/>
            <stop offset="100%" stop-color="#ec4899" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <line x1="${P}" y1="${zeroY.toFixed(1)}" x2="${(W - P).toFixed(1)}" y2="${zeroY.toFixed(1)}" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="3 3"/>
        <text x="${(W - P - 4).toFixed(1)}" y="${(zeroY - 4).toFixed(1)}" fill="#64748b" font-size="9" text-anchor="end">linha de EBITDA = 0</text>
        <path d="${path} L ${(W - P).toFixed(1)} ${(H - P).toFixed(1)} L ${P} ${(H - P).toFixed(1)} Z" fill="url(#ebGrad)"/>
        <path d="${path}" stroke="#ec4899" stroke-width="2.5" fill="none"/>
        ${beX !== null ? `<line x1="${beX.toFixed(1)}" y1="${P}" x2="${beX.toFixed(1)}" y2="${(H - P).toFixed(1)}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="2 3"/><text x="${beX.toFixed(1)}" y="${(P - 6).toFixed(1)}" fill="#f59e0b" font-size="10" font-weight="900" text-anchor="middle">BE ${curve.breakevenSales}</text>` : ''}
        <circle cx="${realX.toFixed(1)}" cy="${realY.toFixed(1)}" r="6" fill="#10b981" stroke="white" stroke-width="2"/>
        <text x="${realX.toFixed(1)}" y="${(realY - 10).toFixed(1)}" fill="#065f46" font-size="9" font-weight="900" text-anchor="middle">Real ${curve.realSales}</text>
        <circle cx="${projX.toFixed(1)}" cy="${projY.toFixed(1)}" r="5" fill="white" stroke="#6366f1" stroke-width="2"/>
        <text x="${projX.toFixed(1)}" y="${(projY + 14).toFixed(1)}" fill="#4338ca" font-size="9" font-weight="900" text-anchor="middle">Projetado ${curve.projectedSales}</text>
        <text x="${P}" y="${(H - 4).toFixed(1)}" fill="#94a3b8" font-size="9">0 vendas</text>
        <text x="${(W - P).toFixed(1)}" y="${(H - 4).toFixed(1)}" fill="#94a3b8" font-size="9" text-anchor="end">${Math.round(curve.maxSales)} vendas</text>
      </svg>
      <div class="flex flex-wrap gap-4 text-[11px] text-rose-900/80 mt-2">
        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-pink-500"></span> Curva EBITDA</span>
        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> Vendas reais</span>
        <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full border-2 border-indigo-500 bg-white"></span> Projetado</span>
        ${curve.breakevenSales !== null ? `<span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-amber-500"></span> Breakeven</span>` : ''}
      </div>
    </div>`;
  },

  _reactivityHint(d) {
    if (d.realSales === 0) {
      return `<p class="text-xs text-rose-900/70 mt-4 italic">💡 Adicione investimento de mídia nas campanhas ativas e leads nas ações para ver o CAC e o termômetro reagindo em tempo real.</p>`;
    }
    return `<p class="text-xs text-rose-900/70 mt-4 italic">💡 Se o CAC subir nas campanhas ou cair o volume de vendas, este painel reflete imediatamente. Use o simulador para testar cenários sem afetar os números oficiais.</p>`;
  }
};
window.RevopsPinkDashboard = RevopsPinkDashboard;
