// V35.14.4 — GA4 Dashboard com 3 sub-abas.
//
// - 'overview' (Visão Geral): KPIs agregados do período + breakdown por
//   canal (sessionDefaultChannelGroup). Mostra "Total sessions", "Total users",
//   "Conversions", "Revenue" se e-commerce está ativo.
// - 'breakdown' (Detalhes): tabela com TODAS as combinações de dimensions
//   sincronizadas. Cada linha = combinação única de dimensions com soma das
//   métricas no período.
// - 'customs' (Customs): lista dos custom dimensions/metrics ativos no sync,
//   mostrando os últimos valores agregados se disponíveis.
//
// Lê de App.state.ga4ReportsCache (carregado via Actions.loadGa4Reports).
// Mostra status visual (não conectado / sem sync ainda / sem dados).

window.Ga4Dashboard = {
  render() {
    // Auto-load reports na primeira renderização.
    if (App.state.ga4ReportsCache === null && window.Actions?.loadGa4Reports) {
      setTimeout(() => Actions.loadGa4Reports(30), 0);
    }
    if (App.state.ga4Status === null && window.Actions?.loadGa4Status) {
      setTimeout(() => Actions.loadGa4Status(), 0);
    }

    const status = App.state.ga4Status || {};
    const configured = Boolean(status.configured);
    const connected = Boolean(status.configured && status.oauthCompleted && status.selectedPropertyId);

    if (!connected) {
      return `<div class="space-y-4">
        ${this._hero(status, false)}
        ${this._notConnectedState(configured)}
      </div>`;
    }

    const subTab = App.state.ga4DashboardSubTab || 'overview';
    const cache = App.state.ga4ReportsCache || {};
    const rows = Array.isArray(cache.rows) ? cache.rows : [];

    return `<div class="space-y-4">
      ${this._hero(status, true)}
      ${this._subTabsBar(subTab, rows.length)}
      ${subTab === 'breakdown' ? this._renderBreakdown(rows, status)
        : subTab === 'customs'  ? this._renderCustoms(status)
        : this._renderOverview(rows, status)}
    </div>`;
  },

  // ============================ HERO ============================
  _hero(status, connected) {
    const propertyName = status.propertyDisplayName || status.selectedPropertyId || 'Sem property';
    const lastSync = status.lastSyncAt ? this._fmtDate(status.lastSyncAt) : null;
    const lastSyncLabel = lastSync ? `Última sync: ${lastSync}` : 'Aguardando primeira sincronização';
    const statusBadge = connected
      ? `<span class="ml-2 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-emerald-400/30 border border-emerald-300/60 text-emerald-100">Conectado</span>`
      : `<span class="ml-2 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-slate-400/30 border border-slate-300/60 text-slate-100">Não conectado</span>`;
    const syncBtn = connected
      ? `<button onclick="Actions.triggerGa4Sync(); setTimeout(()=>Actions.loadGa4Reports(30), 4000);"
          class="shrink-0 px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur text-white text-xs font-black inline-flex items-center gap-1.5 border border-white/30"
          style="color:#fff!important;">
          <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Sincronizar agora
        </button>`
      : `<button onclick="Actions.openGa4Wizard()"
          class="shrink-0 px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur text-white text-xs font-black inline-flex items-center gap-1.5 border border-white/30"
          style="color:#fff!important;">
          <i data-lucide="plug" class="w-3.5 h-3.5"></i> Conectar
        </button>`;
    return `<div class="rounded-3xl p-6 lg:p-8 shadow-xl"
      style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 60%, #B45309 100%); border: 1px solid rgba(252,211,77,.40);">
      <div class="flex items-start gap-4">
        <div class="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center bg-white/15 border border-white/25">
          <i data-lucide="line-chart" class="w-7 h-7 text-white"></i>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-[10px] font-black uppercase tracking-widest mb-1 text-amber-100">Marketing · Analytics</p>
          <h2 class="text-2xl lg:text-3xl font-black text-white flex items-center flex-wrap gap-2">
            Google Analytics 4 ${statusBadge}
          </h2>
          <p class="text-sm text-amber-100/90 mt-2">${Utils.escape(propertyName)} · ${Utils.escape(lastSyncLabel)}</p>
        </div>
        ${syncBtn}
      </div>
    </div>`;
  },

  // ============================ NOT CONNECTED ============================
  _notConnectedState(configured) {
    return `<div class="rounded-3xl bg-white p-8 shadow-sm border border-slate-100 text-center">
      <div class="mx-auto w-16 h-16 rounded-full bg-amber-100 grid place-items-center mb-4">
        <i data-lucide="line-chart" class="w-8 h-8 text-amber-600"></i>
      </div>
      <h3 class="text-xl font-black text-slate-900">Conecte o GA4 pra começar</h3>
      <p class="text-sm text-slate-500 mt-2 max-w-md mx-auto">
        ${configured
          ? 'Você salvou credenciais mas ainda não concluiu o OAuth. Reabra o wizard pra continuar.'
          : 'Você ainda não conectou nenhuma propriedade GA4. Tráfego, origem, conversões e funil aparecem aqui depois da primeira sincronização.'}
      </p>
      <button onclick="Actions.openGa4Wizard()"
        class="mt-5 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-black uppercase tracking-wider inline-flex items-center gap-2">
        <i data-lucide="plug" class="w-3.5 h-3.5"></i>
        ${configured ? 'Continuar conexão' : 'Conectar GA4'}
      </button>
    </div>`;
  },

  // ============================ SUB-TABS ============================
  _subTabsBar(active, rowsCount) {
    const tab = (id, label, icon, badge = '') => {
      const isActive = active === id;
      return `<button onclick="Actions.setGa4DashboardSubTab('${id}')"
        class="px-4 py-2.5 rounded-xl border-2 transition flex items-center gap-2 ${isActive ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-amber-300 hover:bg-amber-50'}" ${isActive ? 'style="color:#fff!important;"' : ''}>
        <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
        ${label}${badge}
      </button>`;
    };
    return `<div class="flex gap-2 flex-wrap">
      ${tab('overview', 'Visão Geral', 'layout-dashboard')}
      ${tab('breakdown', 'Detalhes', 'table-properties', rowsCount > 0 ? `<span class="ml-1 text-[10px] opacity-80">${rowsCount}</span>` : '')}
      ${tab('customs', 'Customs', 'sliders-horizontal')}
    </div>`;
  },

  // ============================ OVERVIEW ============================
  _renderOverview(rows, status) {
    if (!rows.length) return this._noDataYet();

    // Soma totais e agrupa por sessionDefaultChannelGroup.
    const totals = {};
    const byChannel = new Map();
    for (const row of rows) {
      const m = row.metrics || {};
      const channel = (row.dimensions || {}).sessionDefaultChannelGroup || '—';
      for (const [k, v] of Object.entries(m)) {
        if (typeof v !== 'number') continue;
        totals[k] = (totals[k] || 0) + v;
      }
      if (!byChannel.has(channel)) byChannel.set(channel, { channel, sessions: 0, users: 0, conversions: 0, revenue: 0 });
      const ch = byChannel.get(channel);
      ch.sessions += Number(m.sessions || 0);
      ch.users += Number(m.totalUsers || m.activeUsers || 0);
      ch.conversions += Number(m.conversions || 0);
      ch.revenue += Number(m.purchaseRevenue || m.totalRevenue || 0);
    }

    const kpis = [
      { label: 'Sessions', value: totals.sessions, fmt: 'int', icon: 'mouse-pointer-click' },
      { label: 'Usuários únicos', value: totals.totalUsers || totals.activeUsers, fmt: 'int', icon: 'users' },
      { label: 'Conversões', value: totals.conversions, fmt: 'int', icon: 'target' },
      { label: 'Páginas vistas', value: totals.screenPageViews, fmt: 'int', icon: 'eye' },
      { label: 'Engaged Sessions', value: totals.engagedSessions, fmt: 'int', icon: 'flame' },
      { label: 'Receita compras', value: totals.purchaseRevenue || totals.totalRevenue, fmt: 'brl', icon: 'banknote' }
    ].filter(k => k.value != null && !Number.isNaN(k.value));

    const channels = Array.from(byChannel.values()).sort((a, b) => b.sessions - a.sessions).slice(0, 10);
    const maxSessions = channels[0]?.sessions || 1;

    return `<div class="space-y-4">
      <div class="rounded-3xl bg-white p-5 shadow-sm border border-slate-100">
        <h3 class="text-xl font-black mb-1">KPIs do período</h3>
        <p class="text-sm text-slate-500 mb-4">Agregação dos últimos ${App.state.ga4ReportsCache?.days || 30} dias.</p>
        <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          ${kpis.map(k => this._kpiCard(k.label, k.value, k.fmt, k.icon)).join('')}
        </div>
      </div>

      ${channels.length ? `<div class="rounded-3xl bg-white p-5 shadow-sm border border-slate-100">
        <h3 class="text-xl font-black mb-1">Tráfego por canal</h3>
        <p class="text-sm text-slate-500 mb-4">Sessões agrupadas por canal default (Organic, Paid, Direct, etc).</p>
        <div class="space-y-2">
          ${channels.map(c => {
            const pct = Math.round((c.sessions / maxSessions) * 100);
            return `<div class="flex items-center gap-3">
              <span class="text-xs font-black text-slate-700 w-40 truncate">${Utils.escape(c.channel)}</span>
              <div class="flex-1 h-2.5 rounded-full bg-slate-100 overflow-hidden"><div class="h-full bg-amber-500" style="width:${pct}%;"></div></div>
              <span class="text-xs font-black text-slate-900 w-16 text-right">${this._fmt(c.sessions, 'int')}</span>
              <span class="text-[10px] text-slate-500 w-20 text-right">${c.conversions ? this._fmt(c.conversions, 'int') + ' conv' : '—'}</span>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}
    </div>`;
  },

  // ============================ BREAKDOWN ============================
  _renderBreakdown(rows, status) {
    if (!rows.length) return this._noDataYet();

    // Cabeçalhos = união de todas as keys de dimensions e metrics.
    const allDims = new Set();
    const allMets = new Set();
    rows.forEach(r => {
      Object.keys(r.dimensions || {}).forEach(k => allDims.add(k));
      Object.keys(r.metrics || {}).forEach(k => allMets.add(k));
    });
    const dimsArr = Array.from(allDims).slice(0, 6); // limita pra UI não estourar
    const metsArr = Array.from(allMets).slice(0, 8);

    const showRows = rows.slice(0, 200);
    const truncated = rows.length > showRows.length;

    return `<div class="rounded-3xl bg-white p-5 shadow-sm border border-slate-100">
      <div class="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 class="text-xl font-black">Detalhes por combinação</h3>
          <p class="text-sm text-slate-500">Cada linha é uma combinação única de dimensões com soma das métricas.</p>
        </div>
        <span class="px-3 py-1.5 rounded-2xl bg-amber-100 border border-amber-200 text-amber-800 text-xs font-black">${rows.length} linhas${truncated ? ` · mostrando ${showRows.length}` : ''}</span>
      </div>

      <div class="overflow-x-auto">
        <table class="min-w-full text-xs">
          <thead>
            <tr class="border-b-2 border-slate-200">
              <th class="text-left py-2 px-2 text-slate-500 font-black uppercase tracking-wider">Data</th>
              ${dimsArr.map(d => `<th class="text-left py-2 px-2 text-slate-500 font-black uppercase tracking-wider">${Utils.escape(this._dimLabel(d, status))}</th>`).join('')}
              ${metsArr.map(m => `<th class="text-right py-2 px-2 text-slate-500 font-black uppercase tracking-wider">${Utils.escape(this._metLabel(m, status))}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${showRows.map(r => {
              const d = r.dimensions || {};
              const m = r.metrics || {};
              return `<tr class="border-b border-slate-100 hover:bg-amber-50/40">
                <td class="py-2 px-2 text-slate-700">${Utils.escape(this._fmtDate(r.date))}</td>
                ${dimsArr.map(dim => `<td class="py-2 px-2 text-slate-700 truncate max-w-[180px]" title="${Utils.escape(String(d[dim] || ''))}">${Utils.escape(String(d[dim] || '—'))}</td>`).join('')}
                ${metsArr.map(met => `<td class="py-2 px-2 text-right font-mono text-slate-900">${this._fmtMet(met, m[met])}</td>`).join('')}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      ${truncated ? `<p class="text-[11px] text-slate-500 italic mt-3">+ ${rows.length - showRows.length} linhas adicionais. Aumente o período (em desenvolvimento).</p>` : ''}
    </div>`;
  },

  // ============================ CUSTOMS ============================
  _renderCustoms(status) {
    const customSettings = status.customSettings || {};
    const availableCustoms = status.availableCustoms || [];
    const entries = Object.values(customSettings);

    if (!availableCustoms.length && !entries.length) {
      return `<div class="rounded-3xl bg-white p-8 shadow-sm border border-slate-100 text-center">
        <i data-lucide="search-x" class="w-10 h-10 text-slate-300 mx-auto"></i>
        <h3 class="text-lg font-black text-slate-700 mt-3">Nenhuma custom detectada</h3>
        <p class="text-sm text-slate-500 mt-1">Sua propriedade GA4 não tem dimensões ou métricas customizadas.</p>
        <button onclick="Actions.triggerGa4Sync()" class="mt-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-black uppercase tracking-wider">
          Re-detectar
        </button>
      </div>`;
    }

    const enabled = entries.filter(c => c.enabled);
    const disabled = entries.filter(c => !c.enabled);

    return `<div class="space-y-4">
      <div class="rounded-3xl bg-white p-5 shadow-sm border border-slate-100">
        <div class="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h3 class="text-xl font-black">Customs configurados</h3>
            <p class="text-sm text-slate-500">Dimensões e métricas que você criou no GA4 e está rastreando no LJ.</p>
          </div>
          <div class="flex gap-2">
            <span class="px-3 py-1.5 rounded-2xl bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-black">${enabled.length} ativ${enabled.length === 1 ? 'o' : 'os'}</span>
            ${disabled.length ? `<span class="px-3 py-1.5 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 text-xs font-black">${disabled.length} desligad${disabled.length === 1 ? 'o' : 'os'}</span>` : ''}
            <button onclick="Actions.openGa4Wizard(); if (App.state.ga4Wizard) { App.state.ga4Wizard.step = 6; Actions.loadGa4MetadataForWizard(); App.render(); }" class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5">
              <i data-lucide="settings-2" class="w-3 h-3"></i> Configurar
            </button>
          </div>
        </div>

        ${enabled.length ? `<div class="space-y-2 mb-4">
          ${enabled.map(c => this._customCard(c)).join('')}
        </div>` : '<p class="text-sm text-slate-500 italic mb-4">Nenhum custom ativo. Clique em Configurar pra ligar.</p>'}

        ${disabled.length ? `<details class="mt-2">
          <summary class="text-xs font-black text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700">Desligados (${disabled.length})</summary>
          <div class="mt-2 space-y-1.5 opacity-60">
            ${disabled.map(c => this._customCard(c)).join('')}
          </div>
        </details>` : ''}
      </div>
    </div>`;
  },

  _customCard(c) {
    const kindBadge = c.kind === 'metric'
      ? '<span class="px-1.5 py-0.5 rounded bg-sky-100 border border-sky-200 text-sky-700 text-[9px] font-black uppercase tracking-wider">Métrica</span>'
      : '<span class="px-1.5 py-0.5 rounded bg-violet-100 border border-violet-200 text-violet-700 text-[9px] font-black uppercase tracking-wider">Dimensão</span>';
    return `<div class="rounded-xl border border-slate-200 bg-slate-50 p-3 flex items-center gap-3">
      <div class="shrink-0 w-9 h-9 rounded-lg bg-white border border-slate-200 grid place-items-center">
        <i data-lucide="${c.kind === 'metric' ? 'gauge' : 'tag'}" class="w-4 h-4 text-slate-600"></i>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5 flex-wrap">
          <p class="text-sm font-black text-slate-900 truncate">${Utils.escape(c.friendlyName || c.apiName)}</p>
          ${kindBadge}
          ${c.asKr ? '<span class="px-1.5 py-0.5 rounded bg-emerald-100 border border-emerald-200 text-emerald-700 text-[9px] font-black uppercase tracking-wider">KR</span>' : ''}
        </div>
        <p class="text-[10px] text-slate-500 font-mono mt-0.5">${Utils.escape(c.apiName)}${c.category ? ` · ${Utils.escape(c.category)}` : ''}</p>
      </div>
    </div>`;
  },

  // ============================ HELPERS ============================
  _noDataYet() {
    return `<div class="rounded-3xl bg-white p-8 shadow-sm border border-slate-100 text-center">
      <i data-lucide="hourglass" class="w-10 h-10 text-slate-300 mx-auto"></i>
      <h3 class="text-lg font-black text-slate-700 mt-3">Aguardando primeira sincronização</h3>
      <p class="text-sm text-slate-500 mt-1 max-w-md mx-auto">Os dados aparecem aqui logo após a primeira sync. Clique em "Sincronizar agora" pra rodar manualmente.</p>
      <button onclick="Actions.triggerGa4Sync(); setTimeout(()=>Actions.loadGa4Reports(30), 4000);" class="mt-4 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs font-black uppercase tracking-wider inline-flex items-center gap-2">
        <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Sincronizar agora
      </button>
    </div>`;
  },

  _kpiCard(label, value, fmt, icon) {
    const formatted = this._fmt(value, fmt);
    return `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-3 flex items-center gap-3">
      <span class="shrink-0 w-10 h-10 rounded-xl bg-amber-100 grid place-items-center text-amber-700">
        <i data-lucide="${icon}" class="w-5 h-5"></i>
      </span>
      <div class="min-w-0">
        <p class="text-[10px] font-black text-slate-500 uppercase tracking-wider">${Utils.escape(label)}</p>
        <p class="text-lg font-black text-slate-900 mt-0.5">${formatted}</p>
      </div>
    </div>`;
  },

  _fmt(value, type) {
    const n = Number(value || 0);
    if (type === 'brl') return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    if (type === 'pct') return (n * 100).toFixed(1) + '%';
    if (type === 'int') return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    return String(value || '—');
  },

  _fmtMet(metName, value) {
    if (value == null) return '—';
    if (/Revenue|Cost/i.test(metName)) return this._fmt(value, 'brl');
    if (/Rate|Probability/i.test(metName)) return this._fmt(value, 'pct');
    return this._fmt(value, 'int');
  },

  _fmtDate(s) {
    if (!s) return '—';
    try {
      const d = new Date(s);
      if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
    } catch (_) {}
    return String(s);
  },

  // Tradução de apiName técnico → label amigável (customs preservam friendlyName)
  _dimLabel(apiName, status) {
    const customs = status.customSettings || {};
    if (customs[apiName]?.friendlyName) return customs[apiName].friendlyName;
    const MAP = {
      date: 'Data',
      sessionDefaultChannelGroup: 'Canal',
      sessionSourceMedium: 'Origem',
      sessionSource: 'Source',
      sessionMedium: 'Medium',
      sessionCampaignName: 'Campanha',
      country: 'País',
      deviceCategory: 'Dispositivo',
      pagePath: 'Página',
      pageTitle: 'Título',
      landingPage: 'LP',
      eventName: 'Evento',
      itemName: 'Produto',
      itemCategory: 'Categoria'
    };
    return MAP[apiName] || apiName;
  },

  _metLabel(apiName, status) {
    const customs = status.customSettings || {};
    if (customs[apiName]?.friendlyName) return customs[apiName].friendlyName;
    const MAP = {
      sessions: 'Sessions',
      totalUsers: 'Users',
      newUsers: 'Novos',
      activeUsers: 'Ativos',
      screenPageViews: 'Pageviews',
      eventCount: 'Eventos',
      engagedSessions: 'Engajadas',
      engagementRate: 'Tx Eng.',
      bounceRate: 'Rejeição',
      conversions: 'Conv.',
      purchaseRevenue: 'Receita',
      transactions: 'Trans.',
      addToCarts: 'Cart',
      checkouts: 'Checkout'
    };
    return MAP[apiName] || apiName;
  }
};
