// V36.11.0 — Visão Geral consolidada.
//
// Substitui o overview legacy do DashboardModule. É o ÚNICO lugar onde dados
// das 3 fontes (Tarefas + Checkout/Hotmart + Google Ads + GA4) se cruzam.
// Abas Tarefas/Checkout/GA4/Google Ads continuam puras (raio-x da ferramenta).
//
// Regras:
// - Janela: 7d default + filtro (7d/30d/90d) no topo
// - Agrupamento: ESTRITO por branch do Mapa (App.state.campaigns). Cliente
//   sem campanha cai no empty state.
// - KPIs só CRUZADOS (não duplicam abas filhas). Narrativa Djow no topo.
//
// State: overviewRange, overviewBranchFilter
// Actions: setOverviewRange, setOverviewBranchFilter

window.VisaoGeralDashboard = {
  render() {
    const campaigns = Array.isArray(App.state.campaigns) ? App.state.campaigns : [];
    if (!campaigns.length) return this._emptyStateNoBranches();

    const range = App.state.overviewRange || '7d';
    const branchFilter = App.state.overviewBranchFilter || 'all';
    const period = this._computePeriod(range);

    const branches = branchFilter === 'all'
      ? campaigns
      : campaigns.filter(c => String(c.id) === String(branchFilter));

    const data = this._gatherData(branches, period);
    const insights = this._generateInsights(data, branches);

    return `<div class="p-2 lg:p-4 space-y-4">
      ${this._header(period, data, branches.length, campaigns.length)}
      ${this._filters(range, branchFilter, campaigns)}
      ${this._djowNarrative(insights, data)}
      ${this._crossedKpis(data)}
      ${this._djowAlerts(insights)}
      ${this._branchBreakdown(data)}
      ${this._sourcesShortcuts(data)}
    </div>`;
  },

  // ============================================================
  // PERÍODO
  // ============================================================
  _computePeriod(range) {
    const days = range === '30d' ? 30 : range === '90d' ? 90 : 7;
    const to = new Date();
    const from = new Date(to.getTime() - days * 86400000);
    return { from, to, days, label: `${days}d` };
  },

  _inPeriod(dateStr, period) {
    if (!dateStr) return false;
    const t = new Date(dateStr).getTime();
    if (Number.isNaN(t)) return false;
    return t >= period.from.getTime() && t <= period.to.getTime();
  },

  // ============================================================
  // GATHER DATA — cruzamento por branch
  // ============================================================
  _gatherData(branches, period) {
    const allAds = Array.isArray(App.state.googleAdsCampaignsCache) ? App.state.googleAdsCampaignsCache : [];
    const allTasks = window.ExecutionTaskStore ? (ExecutionTaskStore.all() || []) : [];
    const checkout = App.state.checkoutDashboard || {};
    const ga4Rows = (App.state.ga4ReportsCache && Array.isArray(App.state.ga4ReportsCache.rows)) ? App.state.ga4ReportsCache.rows : [];

    const checkoutKpis = checkout.kpis || {};
    const totalRevenueCents = Number(checkoutKpis.totalRevenueCents || 0);
    const approvedSales = Number(checkoutKpis.approvedCount || 0);

    const perBranch = branches.map(branch => this._aggregateBranch(branch, period, { allAds, allTasks, ga4Rows }));

    const totals = perBranch.reduce((acc, b) => {
      acc.adsCost += b.ads.cost;
      acc.adsClicks += b.ads.clicks;
      acc.adsConversions += b.ads.conversions;
      acc.adsImpressions += b.ads.impressions;
      acc.sessionsGa4 += b.ga4.sessions;
      acc.tasksTotal += b.tasks.total;
      acc.tasksCompleted += b.tasks.completed;
      acc.tasksLate += b.tasks.late;
      acc.tasksPending += b.tasks.pending;
      return acc;
    }, { adsCost: 0, adsClicks: 0, adsConversions: 0, adsImpressions: 0, sessionsGa4: 0, tasksTotal: 0, tasksCompleted: 0, tasksLate: 0, tasksPending: 0 });

    const roasEffective = totals.adsCost > 0 ? (totalRevenueCents / 100) / totals.adsCost : null;
    const cacConsolidated = approvedSales > 0 ? totals.adsCost / approvedSales : null;
    const sessionsToCheckout = totals.sessionsGa4 > 0 ? (approvedSales / totals.sessionsGa4) * 100 : null;
    const clicksToSessions = totals.adsClicks > 0 ? (totals.sessionsGa4 / totals.adsClicks) * 100 : null;

    return {
      period,
      perBranch,
      totals,
      checkout: { totalRevenueCents, approvedSales, totalRefunded: Number(checkoutKpis.refundedCount || 0), avgTicketCents: Number(checkoutKpis.avgTicketCents || 0) },
      cross: { roasEffective, cacConsolidated, sessionsToCheckout, clicksToSessions },
      connections: this._connectionsStatus()
    };
  },

  _aggregateBranch(branch, period, sources) {
    const adsIds = new Set((branch.externalLinks?.googleAds || []).map(String));
    const ga4Names = new Set((branch.externalLinks?.ga4?.sessionCampaignNames || []).map(s => String(s).toLowerCase()));

    const linkedAds = sources.allAds.filter(a => adsIds.has(String(a.campaign_id)));
    const ads = linkedAds.reduce((acc, a) => {
      const m = a.metrics || a;
      acc.cost += Number(m.cost_brl || 0);
      acc.impressions += Number(m.impressions || 0);
      acc.clicks += Number(m.clicks || 0);
      acc.conversions += Number(m.conversions || 0);
      acc.conversionsValue += Number(m.conversions_value || 0);
      return acc;
    }, { cost: 0, impressions: 0, clicks: 0, conversions: 0, conversionsValue: 0, count: linkedAds.length });

    const ga4 = sources.ga4Rows.reduce((acc, row) => {
      const name = String(row.sessionCampaignName || row.campaign_name || '').toLowerCase();
      if (name && ga4Names.has(name)) {
        acc.sessions += Number(row.sessions || 0);
        acc.users += Number(row.activeUsers || row.totalUsers || 0);
        acc.conversions += Number(row.conversions || 0);
      }
      return acc;
    }, { sessions: 0, users: 0, conversions: 0 });

    const branchTasks = sources.allTasks.filter(t => Number(t.linked_campaign_id) === Number(branch.id));
    const nowT = Date.now();
    const tasks = branchTasks.reduce((acc, t) => {
      acc.total++;
      if (t.status === 'completed') acc.completed++;
      else if (t.due_date && new Date(t.due_date).getTime() < nowT && t.status !== 'completed') acc.late++;
      else acc.pending++;
      return acc;
    }, { total: 0, completed: 0, late: 0, pending: 0 });

    const completionRate = tasks.total > 0 ? (tasks.completed / tasks.total) * 100 : 0;
    const branchROAS = ads.cost > 0 ? ads.conversionsValue / ads.cost : null;

    return {
      branch,
      ads: { ...ads, roas: branchROAS },
      ga4,
      tasks: { ...tasks, completionRate },
      hasAds: ads.count > 0,
      hasGa4: ga4Names.size > 0,
      hasTasks: tasks.total > 0
    };
  },

  _connectionsStatus() {
    const checkout = App.state.checkoutDashboard || {};
    const ga4Status = App.state.ga4Status || {};
    const adsStatus = App.state.googleAdsStatus || {};
    return {
      checkout: Boolean(checkout.loadedAt) && Array.isArray(checkout.products) && checkout.products.length > 0,
      ga4: Boolean(ga4Status.configured && ga4Status.oauthCompleted && ga4Status.selectedPropertyId),
      ads: Boolean(adsStatus.selectedCustomerId)
    };
  },

  // ============================================================
  // INSIGHTS DJOW — correlações detectáveis
  // ============================================================
  _generateInsights(data, branches) {
    const insights = [];
    const { perBranch, totals, checkout, cross, connections } = data;

    if (!connections.checkout && !connections.ga4 && !connections.ads) {
      insights.push({ severity: 'info', icon: 'plug', title: 'Nenhuma fonte conectada', text: 'Conecte Hotmart, GA4 ou Google Ads em Configurações pra ver o cruzamento real.' });
    }

    perBranch.forEach(b => {
      if (b.ads.cost > 500 && b.tasks.total === 0) {
        insights.push({
          severity: 'high',
          icon: 'alert-triangle',
          title: `${b.branch.name}: gasto sem execução`,
          text: `Investimento de R$ ${this._fmtMoney(b.ads.cost)} em Ads e ZERO tarefas operacionais vinculadas no período. Time não está orquestrando essa campanha.`
        });
      }
      if (b.tasks.total > 0 && b.tasks.late > 0 && (b.tasks.late / b.tasks.total) > 0.5) {
        insights.push({
          severity: 'medium',
          icon: 'clock',
          title: `${b.branch.name}: ${b.tasks.late} tarefa(s) atrasada(s)`,
          text: `${Math.round((b.tasks.late / b.tasks.total) * 100)}% das tarefas dessa campanha estão vencidas. Execução travada.`
        });
      }
      if (b.ads.cost > 0 && b.ads.roas !== null && b.ads.roas < 1) {
        insights.push({
          severity: 'high',
          icon: 'trending-down',
          title: `${b.branch.name}: ROAS abaixo de 1`,
          text: `R$ ${this._fmtMoney(b.ads.cost)} gastos retornaram R$ ${this._fmtMoney(b.ads.conversionsValue)} em conversões. Cada R$ investido devolve R$ ${b.ads.roas.toFixed(2)}.`
        });
      }
      if (b.hasGa4 && b.ga4.sessions === 0 && b.ads.clicks > 50) {
        insights.push({
          severity: 'medium',
          icon: 'link-2-off',
          title: `${b.branch.name}: clicks sem sessões`,
          text: `${b.ads.clicks} clicks no Ads, mas GA4 não registrou nenhuma sessão. Tracking provavelmente quebrado nessa campanha.`
        });
      }
      if (b.tasks.completed > 5 && b.ads.cost === 0 && !b.hasAds) {
        insights.push({
          severity: 'low',
          icon: 'info',
          title: `${b.branch.name}: execução sem mídia`,
          text: `${b.tasks.completed} tarefas concluídas, mas nenhuma ad vinculada. Trabalho orgânico ou Ads ainda não conectado a essa campanha.`
        });
      }
    });

    if (totals.adsCost > 100 && checkout.approvedSales === 0 && connections.checkout) {
      insights.push({
        severity: 'high',
        icon: 'alert-octagon',
        title: 'Investimento sem venda',
        text: `R$ ${this._fmtMoney(totals.adsCost)} em mídia no período e 0 vendas Hotmart registradas. Olhar funil: tracking, oferta ou checkout.`
      });
    }

    if (cross.roasEffective !== null && cross.roasEffective > 3) {
      insights.push({
        severity: 'positive',
        icon: 'trending-up',
        title: 'ROAS efetivo saudável',
        text: `Receita Hotmart total dividida por gasto Ads = ${cross.roasEffective.toFixed(2)}x. Acima do baseline de 1.5x. Espaço pra escalar mídia.`
      });
    }

    if (cross.sessionsToCheckout !== null && cross.sessionsToCheckout < 0.3 && totals.sessionsGa4 > 500) {
      insights.push({
        severity: 'medium',
        icon: 'filter',
        title: 'Funil sangra na conversão',
        text: `${totals.sessionsGa4} sessões GA4 → ${data.checkout.approvedSales} vendas (${cross.sessionsToCheckout.toFixed(2)}%). Conversão abaixo do esperado (baseline 0.5-1%).`
      });
    }

    return insights.slice(0, 5);
  },

  // ============================================================
  // RENDER PARTS
  // ============================================================
  _header(period, data, branchesShown, totalBranches) {
    const scope = branchesShown === totalBranches ? `${totalBranches} campanha(s) do Mapa` : `${branchesShown} de ${totalBranches} campanha(s)`;
    return `<div class="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-violet-900 border border-violet-500/30 p-6 shadow-xl text-white">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p class="text-[10px] font-black text-violet-200 uppercase tracking-widest mb-1">Visão Geral · cruzamento consolidado</p>
          <h2 class="text-2xl lg:text-3xl font-black text-white">O que está acontecendo agora</h2>
          <p class="text-sm text-violet-100 mt-2">Últimos ${period.days} dias · ${scope} · 3 fontes cruzadas (Tarefas + Checkout + Google)</p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          ${this._connectionBadge('checkout', data.connections.checkout, 'shopping-cart', 'Hotmart')}
          ${this._connectionBadge('ads', data.connections.ads, 'search', 'Google Ads')}
          ${this._connectionBadge('ga4', data.connections.ga4, 'line-chart', 'GA4')}
        </div>
      </div>
    </div>`;
  },

  _connectionBadge(id, on, icon, label) {
    const bg = on ? 'bg-emerald-500/30 border-emerald-300/50 text-emerald-100' : 'bg-slate-500/20 border-slate-400/30 text-slate-300';
    return `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${bg}">
      <i data-lucide="${icon}" class="w-3 h-3"></i>${label} ${on ? '· ON' : '· OFF'}
    </span>`;
  },

  _filters(range, branchFilter, campaigns) {
    const ranges = [
      { id: '7d',  label: '7 dias' },
      { id: '30d', label: '30 dias' },
      { id: '90d', label: '90 dias' }
    ];
    return `<div class="flex items-center gap-3 flex-wrap">
      <label class="inline-flex items-center gap-2">
        <span class="text-[10px] font-black text-slate-600 uppercase tracking-widest">Janela</span>
        <div class="inline-flex rounded-xl bg-slate-100 border border-slate-200 p-1 gap-1">
          ${ranges.map(r => {
            const active = range === r.id;
            return `<button onclick="Actions.setOverviewRange('${r.id}')" class="px-3 py-1.5 rounded-lg text-[11px] font-black ${active ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-white'}" ${active ? 'style="color:#fff;"' : ''}>${r.label}</button>`;
          }).join('')}
        </div>
      </label>
      <label class="inline-flex items-center gap-2">
        <span class="text-[10px] font-black text-slate-600 uppercase tracking-widest">Campanha</span>
        <select onchange="Actions.setOverviewBranchFilter(this.value)" class="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 text-[12px] font-bold">
          <option value="all" ${branchFilter === 'all' ? 'selected' : ''}>Todas (${campaigns.length})</option>
          ${campaigns.map(c => `<option value="${c.id}" ${String(branchFilter) === String(c.id) ? 'selected' : ''}>${Utils.escape(c.name)}</option>`).join('')}
        </select>
      </label>
    </div>`;
  },

  _djowNarrative(insights, data) {
    let line;
    if (!insights.length) {
      const totalRev = (data.checkout.totalRevenueCents / 100);
      if (data.totals.adsCost > 0 || totalRev > 0) {
        line = `No período, R$ ${this._fmtMoney(data.totals.adsCost)} investidos em mídia e R$ ${this._fmtMoney(totalRev)} de receita Hotmart. Nenhum alerta crítico detectado — execução em ritmo normal.`;
      } else {
        line = 'Sem atividade relevante no período. Confira se as campanhas estão ativas e as integrações sincronizando.';
      }
    } else {
      const top = insights[0];
      line = `O cruzamento mais relevante agora é: ${top.text}`;
    }
    return `<div class="rounded-3xl bg-white border-2 border-violet-200 p-5 shadow-sm flex items-start gap-4">
      <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 grid place-items-center shrink-0 shadow">
        <i data-lucide="sparkles" class="w-6 h-6 text-white"></i>
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest mb-1">Djow · leitura consolidada</p>
        <p class="text-[14px] text-slate-900 leading-relaxed">${Utils.escape(line)}</p>
      </div>
    </div>`;
  },

  _crossedKpis(data) {
    const { cross, totals, checkout } = data;
    const fmtROAS = v => v === null ? '—' : `${v.toFixed(2)}x`;
    const fmtCAC = v => v === null ? '—' : `R$ ${this._fmtMoney(v)}`;
    const fmtPct = v => v === null ? '—' : `${v.toFixed(2)}%`;
    const fmtBRL = c => `R$ ${this._fmtMoney(c / 100)}`;

    const kpis = [
      { label: 'ROAS efetivo', value: fmtROAS(cross.roasEffective), hint: 'Receita Hotmart ÷ gasto Ads', icon: 'trending-up', tone: 'emerald' },
      { label: 'CAC consolidado', value: fmtCAC(cross.cacConsolidated), hint: 'Gasto Ads ÷ vendas aprovadas', icon: 'dollar-sign', tone: 'sky' },
      { label: 'Sessões → Venda', value: fmtPct(cross.sessionsToCheckout), hint: `${totals.sessionsGa4} sessões · ${checkout.approvedSales} vendas`, icon: 'filter', tone: 'violet' },
      { label: 'Clicks → Sessões', value: fmtPct(cross.clicksToSessions), hint: `${totals.adsClicks} clicks · ${totals.sessionsGa4} sessões`, icon: 'mouse-pointer-click', tone: 'amber' },
      { label: 'Receita total', value: fmtBRL(checkout.totalRevenueCents), hint: `${checkout.approvedSales} venda(s)`, icon: 'shopping-cart', tone: 'pink' },
      { label: 'Esforço operacional', value: `${totals.tasksCompleted}/${totals.tasksTotal}`, hint: `${totals.tasksLate} atrasada(s)`, icon: 'list-checks', tone: 'fuchsia' }
    ];

    return `<div>
      <h3 class="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">KPIs cruzados</h3>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        ${kpis.map(k => `<div class="rounded-2xl bg-white border-2 border-${k.tone}-200 p-3 shadow-sm">
          <div class="flex items-center gap-2 mb-1">
            <span class="w-7 h-7 rounded-lg bg-${k.tone}-100 grid place-items-center text-${k.tone}-700"><i data-lucide="${k.icon}" class="w-3.5 h-3.5"></i></span>
            <p class="text-[9px] font-black text-${k.tone}-800 uppercase tracking-widest leading-tight">${k.label}</p>
          </div>
          <p class="text-xl font-black text-slate-900">${k.value}</p>
          <p class="text-[10px] text-slate-500 mt-0.5">${k.hint}</p>
        </div>`).join('')}
      </div>
    </div>`;
  },

  _djowAlerts(insights) {
    if (!insights.length) {
      return `<div class="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 flex items-center gap-3">
        <i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-700"></i>
        <p class="text-sm text-emerald-900">Sem alertas críticos do Djow nesse período. Cruzamento limpo.</p>
      </div>`;
    }
    const toneMap = {
      high: { bg: 'rose-50', border: 'rose-300', text: 'rose-900', accent: 'rose-700' },
      medium: { bg: 'amber-50', border: 'amber-300', text: 'amber-900', accent: 'amber-700' },
      low: { bg: 'sky-50', border: 'sky-200', text: 'sky-900', accent: 'sky-700' },
      info: { bg: 'slate-50', border: 'slate-200', text: 'slate-900', accent: 'slate-700' },
      positive: { bg: 'emerald-50', border: 'emerald-200', text: 'emerald-900', accent: 'emerald-700' }
    };
    return `<div>
      <h3 class="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Alertas Djow · ${insights.length}</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        ${insights.map(i => {
          const t = toneMap[i.severity] || toneMap.info;
          return `<div class="rounded-2xl bg-${t.bg} border border-${t.border} p-3 flex items-start gap-3">
            <div class="w-8 h-8 rounded-lg bg-white grid place-items-center shrink-0 text-${t.accent}">
              <i data-lucide="${i.icon}" class="w-4 h-4"></i>
            </div>
            <div class="min-w-0">
              <p class="text-[12px] font-black text-${t.text} mb-1">${Utils.escape(i.title)}</p>
              <p class="text-[11px] text-${t.text}/80 leading-snug">${Utils.escape(i.text)}</p>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  _branchBreakdown(data) {
    if (!data.perBranch.length) return '';
    return `<div>
      <h3 class="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Por campanha do Mapa</h3>
      <div class="rounded-2xl bg-white border border-slate-200 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-3 py-2 text-left text-[10px] font-black text-slate-600 uppercase tracking-widest">Campanha</th>
              <th class="px-3 py-2 text-right text-[10px] font-black text-slate-600 uppercase tracking-widest">Gasto Ads</th>
              <th class="px-3 py-2 text-right text-[10px] font-black text-slate-600 uppercase tracking-widest">Clicks</th>
              <th class="px-3 py-2 text-right text-[10px] font-black text-slate-600 uppercase tracking-widest">Sessões GA4</th>
              <th class="px-3 py-2 text-right text-[10px] font-black text-slate-600 uppercase tracking-widest">ROAS</th>
              <th class="px-3 py-2 text-right text-[10px] font-black text-slate-600 uppercase tracking-widest">Tarefas</th>
              <th class="px-3 py-2 text-right text-[10px] font-black text-slate-600 uppercase tracking-widest">Concluídas</th>
            </tr>
          </thead>
          <tbody>
            ${data.perBranch.map(b => `<tr class="border-t border-slate-100 hover:bg-slate-50">
              <td class="px-3 py-2 font-black text-slate-900">${Utils.escape(b.branch.name)}</td>
              <td class="px-3 py-2 text-right">${b.ads.cost > 0 ? `R$ ${this._fmtMoney(b.ads.cost)}` : '—'}</td>
              <td class="px-3 py-2 text-right">${b.ads.clicks || '—'}</td>
              <td class="px-3 py-2 text-right">${b.ga4.sessions || '—'}</td>
              <td class="px-3 py-2 text-right ${b.ads.roas !== null && b.ads.roas < 1 ? 'text-rose-700 font-black' : 'text-slate-900'}">${b.ads.roas !== null ? `${b.ads.roas.toFixed(2)}x` : '—'}</td>
              <td class="px-3 py-2 text-right">${b.tasks.total || '—'}</td>
              <td class="px-3 py-2 text-right ${b.tasks.late > 0 ? 'text-amber-700' : ''}">${b.tasks.total > 0 ? `${b.tasks.completed}/${b.tasks.total}` : '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  },

  _sourcesShortcuts(data) {
    const cards = [
      {
        id: 'tarefas',
        label: 'Tarefas',
        icon: 'list-checks',
        tone: 'violet',
        primary: `${data.totals.tasksCompleted}/${data.totals.tasksTotal}`,
        secondary: `${data.totals.tasksLate} atrasada(s) · ${data.totals.tasksPending} pendente(s)`
      },
      {
        id: 'checkout',
        label: 'Checkout',
        icon: 'shopping-cart',
        tone: 'pink',
        primary: `R$ ${this._fmtMoney(data.checkout.totalRevenueCents / 100)}`,
        secondary: `${data.checkout.approvedSales} venda(s) · ${data.checkout.totalRefunded} reembolso(s)`
      },
      {
        id: 'google-ads',
        label: 'Google Ads',
        icon: 'search',
        tone: 'sky',
        primary: `R$ ${this._fmtMoney(data.totals.adsCost)}`,
        secondary: `${data.totals.adsClicks} clicks · ${data.totals.adsImpressions} impressões`
      },
      {
        id: 'ga4',
        label: 'GA4',
        icon: 'line-chart',
        tone: 'amber',
        primary: data.totals.sessionsGa4 || '—',
        secondary: 'sessões no período (vinculadas às campanhas)'
      }
    ];
    return `<div>
      <h3 class="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Mergulhe nas fontes</h3>
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
        ${cards.map(c => `<button onclick="Actions.setDashboardTab('${c.id}')" class="text-left rounded-2xl bg-white border border-${c.tone}-200 hover:border-${c.tone}-400 hover:shadow-md transition p-4">
          <div class="flex items-center gap-2 mb-2">
            <span class="w-8 h-8 rounded-lg bg-${c.tone}-100 grid place-items-center text-${c.tone}-700"><i data-lucide="${c.icon}" class="w-4 h-4"></i></span>
            <p class="text-[10px] font-black text-${c.tone}-800 uppercase tracking-widest">${c.label}</p>
          </div>
          <p class="text-xl font-black text-slate-900">${c.primary}</p>
          <p class="text-[11px] text-slate-500 mt-0.5">${c.secondary}</p>
          <p class="text-[10px] text-${c.tone}-700 mt-2 font-black flex items-center gap-1">Abrir aba <i data-lucide="arrow-right" class="w-3 h-3"></i></p>
        </button>`).join('')}
      </div>
    </div>`;
  },

  _emptyStateNoBranches() {
    return `<div class="p-2 lg:p-4">
      <div class="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-violet-900 border border-violet-500/30 p-8 text-center shadow-xl">
        <div class="inline-flex w-16 h-16 rounded-2xl bg-white/10 border border-white/20 items-center justify-center mb-4">
          <i data-lucide="map" class="w-8 h-8 text-violet-200"></i>
        </div>
        <h2 class="text-2xl font-black text-white mb-2">Sem campanha no Mapa, sem cruzamento</h2>
        <p class="text-sm text-violet-100 max-w-lg mx-auto mb-6">
          A Visão Geral cruza Tarefas + Checkout + Google por campanha registrada no Mapa da Receita.
          Crie sua primeira campanha pra começar.
        </p>
        <button onclick="Actions.openStrategicMap(App.state.selectedProductId)" class="px-5 py-2.5 rounded-xl bg-white text-slate-900 text-sm font-black inline-flex items-center gap-2 hover:bg-violet-50 transition">
          <i data-lucide="map" class="w-4 h-4"></i> Abrir Mapa da Receita
        </button>
      </div>
    </div>`;
  },

  // ============================================================
  // HELPERS
  // ============================================================
  _fmtMoney(v) {
    return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
};
