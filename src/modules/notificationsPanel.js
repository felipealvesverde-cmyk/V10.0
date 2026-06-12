// V37.4.2 — Sininho refatorado estilo Linear.
//
// 2 componentes:
//   - bellButton() — botão no header com count + severity color
//   - drawer() — drawer lateral à direita com tabs (Caixa/Salvos/Arquivo)
//
// UX cravada (decisões Felipe 2026-06-12):
//   - Caixa de entrada / Salvos / Arquivo (3 abas)
//   - Filtros por categoria + severidade
//   - Triagem rápida (mark read, save, snooze, done)
//   - Severity colors no badge (cinza/azul/âmbar/rosé pulsante)
//   - Preview rica por kind (V37.4.4 expande)

window.NotificationsPanel = {

  // ============================================================
  // Bell button (header)
  // ============================================================
  bellButton() {
    const cache = App.state.notificationsCache || {};
    const counts = cache.counts || { criticalUnread: 0, warningUnread: 0, infoUnread: 0, inbox: 0 };

    // V37.5.1 — Agrega legacy counts (RD/ads/import/releases/GA4/monthly) + V2 inbox.
    // Sininho único: o que antes era 2 botões agora é 1 só, somando tudo.
    const reconCount = Number(App.state.pendingReconciliationCount || 0);
    const importCount = Number(App.state.pendingLeadImportReports || 0);
    const releaseCount = (window.Actions?._getUnseenReleases?.() || []).length;
    const adsOrphanCount = Number(window.Actions?.getAdsOrphanBellCount?.() || 0);
    const ga4AlertCount = Number(window.Actions?.getGa4AlertCount?.() || 0);
    const monthlyPendingCount = Number(window.Actions?.getMonthlyClosingPendingCount?.() || 0);
    const legacyTotal = reconCount + importCount + releaseCount + adsOrphanCount + ga4AlertCount + monthlyPendingCount;

    const total = (counts.inbox || 0) + legacyTotal;
    // Severity decision: críticas do V2 > legacy/warning > info > empty
    const severityClass = counts.criticalUnread > 0 ? 'critical'
                       : (counts.warningUnread > 0 || legacyTotal > 0) ? 'warning'
                       : counts.infoUnread > 0 ? 'info'
                       : 'empty';
    const colors = {
      empty:    { bg: '#f5f5f4', text: '#a8a29e', border: '#e7e5e4', pulse: '' },
      info:     { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe', pulse: '' },
      warning:  { bg: '#fef3c7', text: '#b45309', border: '#fde68a', pulse: '' },
      critical: { bg: '#fecaca', text: '#b91c1c', border: '#fca5a5', pulse: 'animation: pulse-bell 1.5s ease-in-out infinite;' }
    };
    const c = colors[severityClass];
    return `<button onclick="Actions.toggleNotificationsPanel()"
        class="relative inline-flex items-center justify-center w-8 h-8 rounded-xl transition hover:scale-105"
        style="background:${c.bg};border:1px solid ${c.border};${c.pulse}"
        title="Notificações${total ? ` · ${total}` : ''}">
      <i data-lucide="bell" class="w-3.5 h-3.5" style="color:${c.text}"></i>
      ${total > 0 ? `<span class="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full text-[9px] font-black grid place-items-center" style="background:${c.text};color:#fff;border:1.5px solid #fff;">${total > 99 ? '99+' : total}</span>` : ''}
    </button>
    <style>
      @keyframes pulse-bell {
        0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(185, 28, 28, 0.4); }
        50% { transform: scale(1.05); box-shadow: 0 0 0 6px rgba(185, 28, 28, 0); }
      }
    </style>`;
  },

  // ============================================================
  // Drawer (painel lateral)
  // ============================================================
  drawer() {
    if (!App.state.notificationsPanelOpen) return '';
    const cache = App.state.notificationsCache || {};
    const items = cache.items || [];

    return `<div class="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"
        onclick="Actions.closeNotificationsPanel()">
      <aside class="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] bg-white shadow-2xl overflow-hidden flex flex-col"
             onclick="event.stopPropagation()" style="border-left:4px solid #7c3aed;">
        ${this._header(cache)}
        ${this._tabs(cache)}
        ${this._filters(cache)}
        ${this._body(cache, items)}
        ${this._footer(cache)}
      </aside>
    </div>`;
  },

  _header(cache) {
    return `<div class="flex items-start gap-3 p-4 border-b border-stone-200 bg-gradient-to-br from-violet-50 to-white">
      <span class="shrink-0 w-10 h-10 rounded-xl bg-violet-100 border border-violet-200 grid place-items-center text-violet-700">
        <i data-lucide="bell" class="w-5 h-5"></i>
      </span>
      <div class="min-w-0 flex-1">
        <h2 class="text-[14px] font-black text-slate-900">Notificações</h2>
        <p class="text-[10px] text-stone-500">Triagem rápida do que rolou no tenant.</p>
      </div>
      <button onclick="Actions.refreshNotifications()" ${cache.loading ? 'disabled' : ''}
        class="w-8 h-8 rounded-lg hover:bg-violet-50 grid place-items-center text-stone-600">
        <i data-lucide="${cache.loading ? 'loader-2' : 'refresh-cw'}" class="w-4 h-4 ${cache.loading ? 'animate-spin' : ''}"></i>
      </button>
      <button onclick="Actions.closeNotificationsPanel()" class="w-8 h-8 rounded-lg hover:bg-violet-50 grid place-items-center text-stone-600">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    </div>`;
  },

  _tabs(cache) {
    const counts = cache.counts || {};
    const active = cache.activeStatus || 'inbox';
    const tab = (key, label, count) => `<button onclick="Actions.setNotificationStatus('${key}')"
      class="flex-1 py-2.5 text-[11px] font-black uppercase tracking-wider transition border-b-2 ${active === key ? 'text-violet-700 border-violet-600 bg-violet-50/30' : 'text-stone-500 border-transparent hover:text-stone-700 hover:bg-stone-50'}">
      ${label}${count > 0 ? ` <span class="${active === key ? 'text-violet-700' : 'text-stone-500'}">·</span> ${count}` : ''}
    </button>`;
    return `<div class="flex border-b border-stone-200">
      ${tab('inbox', 'Caixa', counts.inbox || 0)}
      ${tab('saved', 'Salvos', counts.saved || 0)}
      ${tab('archive', 'Arquivo', counts.archive || 0)}
    </div>`;
  },

  _filters(cache) {
    const cat = cache.activeCategory;
    const sev = cache.activeSeverity;
    const catButton = (key, label, color) => {
      const active = cat === key;
      return `<button onclick="Actions.setNotificationCategoryFilter('${active ? '' : key}')"
        class="px-2 py-1 rounded-md text-[10px] font-bold transition border ${active ? `border-${color}-400 bg-${color}-50 text-${color}-800` : 'border-stone-200 text-stone-600 hover:border-stone-300 bg-white'}">
        ${label}
      </button>`;
    };
    const sevButton = (key, label, color) => {
      const active = sev === key;
      return `<button onclick="Actions.setNotificationSeverityFilter('${active ? '' : key}')"
        class="px-2 py-1 rounded-md text-[10px] font-bold transition border ${active ? `border-${color}-400 bg-${color}-50 text-${color}-800` : 'border-stone-200 text-stone-600 hover:border-stone-300 bg-white'}">
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-${color}-500 mr-1 align-middle"></span>${label}
      </button>`;
    };
    return `<div class="px-3 py-2 border-b border-stone-100 bg-stone-50/50 space-y-1.5">
      <div class="flex items-center gap-1 flex-wrap">
        ${catButton('handoff', 'Handoff', 'violet')}
        ${catButton('event', 'Eventos', 'sky')}
        ${catButton('state', 'Estado', 'emerald')}
        ${catButton('operational', 'Operacional', 'amber')}
        ${catButton('integration', 'Integração', 'rose')}
        ${catButton('health', 'Saúde', 'stone')}
      </div>
      <div class="flex items-center gap-1 flex-wrap">
        ${sevButton('info', 'Info', 'sky')}
        ${sevButton('warning', 'Atenção', 'amber')}
        ${sevButton('critical', 'Crítico', 'rose')}
      </div>
    </div>`;
  },

  _body(cache, items) {
    if (cache.loading && !items.length) {
      return `<div class="flex-1 grid place-items-center p-8">
        <div class="text-center">
          <i data-lucide="loader-2" class="w-8 h-8 text-violet-500 mx-auto mb-2 animate-spin"></i>
          <p class="text-[12px] text-stone-600">Carregando notificações...</p>
        </div>
      </div>`;
    }
    if (cache.error) {
      return `<div class="flex-1 grid place-items-center p-8">
        <div class="text-center">
          <i data-lucide="alert-circle" class="w-8 h-8 text-rose-500 mx-auto mb-2"></i>
          <p class="text-[12px] text-rose-700">${Utils.escape(cache.error)}</p>
          <button onclick="Actions.refreshNotifications()" class="mt-3 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-bold" style="color:#fff!important;">Tentar de novo</button>
        </div>
      </div>`;
    }
    if (!items.length) return this._emptyState(cache);

    // V37.4.4 — Cluster: agrupa 3+ items mesma (source + category) em ≤4h.
    const clustered = this._clusterItems(items);

    return `<div class="flex-1 overflow-y-auto">
      <div class="divide-y divide-stone-100">
        ${clustered.map(c => c.type === 'cluster' ? this._cluster(c) : this._row(c.item)).join('')}
      </div>
    </div>`;
  },

  _clusterItems(items) {
    const CLUSTER_WINDOW_MS = 4 * 60 * 60 * 1000;
    const groups = new Map();
    const out = [];
    items.forEach((n, idx) => {
      const key = `${n.sourceUserId || 'system'}::${n.category}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ n, idx });
    });
    const grouped = new Set();
    groups.forEach((arr, key) => {
      if (arr.length < 3) return;
      // checa janela de 4h
      const first = new Date(arr[0].n.createdAt).getTime();
      const last = new Date(arr[arr.length-1].n.createdAt).getTime();
      if (Math.abs(first - last) > CLUSTER_WINDOW_MS) return;
      arr.forEach(a => grouped.add(a.idx));
    });
    items.forEach((n, idx) => {
      if (grouped.has(idx)) {
        const key = `${n.sourceUserId || 'system'}::${n.category}`;
        if (out.find(x => x.type === 'cluster' && x.key === key)) return;
        const clusterItems = items.filter((_, i) => grouped.has(i) &&
          `${items[i].sourceUserId || 'system'}::${items[i].category}` === key);
        out.push({ type: 'cluster', key, items: clusterItems });
      } else {
        out.push({ type: 'single', item: n });
      }
    });
    return out;
  },

  _cluster(c) {
    const sevColors = {
      info:     { dot: '#0ea5e9', bg: '#f0f9ff', border: '#bae6fd' },
      warning:  { dot: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
      critical: { dot: '#ef4444', bg: '#fef2f2', border: '#fecaca' }
    };
    const catLabels = {
      handoff: 'Handoff', event: 'Evento', state: 'Estado',
      operational: 'Operacional', integration: 'Integração', health: 'Saúde'
    };
    const items = c.items || [];
    const first = items[0] || {};
    const sev = sevColors[first.severity] || sevColors.info;
    const isExpanded = App.state.notificationClusterExpanded?.[c.key];
    const sourceLabel = first.sourceUserId ? 'Alguém' : 'Sistema';

    return `<div class="bg-stone-50/40">
      <div class="px-4 py-3 cursor-pointer hover:bg-stone-100 transition" onclick="Actions.toggleClusterExpanded('${Utils.escape(c.key)}')">
        <div class="flex items-start gap-3">
          <span class="shrink-0 mt-1 w-2 h-2 rounded-full" style="background:${sev.dot}"></span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded" style="background:${sev.bg};color:${sev.dot};border:1px solid ${sev.border}">${catLabels[first.category] || first.category}</span>
              <span class="text-[9px] font-black text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded uppercase tracking-wider">${items.length} agrupados</span>
            </div>
            <p class="text-[12px] font-black text-slate-900 leading-snug">
              ${items.length} ${catLabels[first.category]?.toLowerCase() || 'eventos'} ${first.sourceUserId ? 'da mesma fonte' : 'do sistema'} nas últimas 4h
            </p>
            <p class="text-[10px] text-stone-500 mt-0.5">${isExpanded ? 'Click pra agrupar' : 'Click pra expandir e ver cada um'}</p>
          </div>
          <i data-lucide="${isExpanded ? 'chevron-up' : 'chevron-down'}" class="w-4 h-4 text-stone-400 shrink-0 mt-1"></i>
        </div>
      </div>
      ${isExpanded ? `<div class="bg-white border-t border-stone-100 divide-y divide-stone-100">
        ${items.map(item => this._row(item)).join('')}
      </div>` : ''}
    </div>`;
  },

  _emptyState(cache) {
    const status = cache.activeStatus || 'inbox';
    const messages = {
      inbox: { icon: 'mail-check', title: 'Caixa de entrada vazia', body: 'Sem novidades por aqui. Quando algo rolar, aparece em tempo real.' },
      saved: { icon: 'bookmark', title: 'Nenhum item salvo', body: 'Use o botão de salvar pra reservar notificações que tu quer revisitar.' },
      archive: { icon: 'archive', title: 'Arquivo vazio', body: 'Notificações marcadas como feito ficam aqui pra histórico.' },
      snoozed: { icon: 'clock', title: 'Nada adiado', body: 'Sem notificações em snooze no momento.' }
    };
    const m = messages[status] || messages.inbox;
    return `<div class="flex-1 grid place-items-center p-8">
      <div class="text-center max-w-xs">
        <div class="w-14 h-14 mx-auto rounded-2xl bg-stone-100 grid place-items-center mb-3">
          <i data-lucide="${m.icon}" class="w-7 h-7 text-stone-400"></i>
        </div>
        <p class="text-[13px] font-black text-slate-900 mb-1">${m.title}</p>
        <p class="text-[11px] text-stone-600 leading-relaxed">${m.body}</p>
      </div>
    </div>`;
  },

  _row(n) {
    const sevColors = {
      info:     { dot: '#0ea5e9', bg: '#f0f9ff', border: '#bae6fd' },
      warning:  { dot: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
      critical: { dot: '#ef4444', bg: '#fef2f2', border: '#fecaca' }
    };
    const catLabels = {
      handoff: 'Handoff', event: 'Evento', state: 'Estado',
      operational: 'Operacional', integration: 'Integração', health: 'Saúde'
    };
    const sev = sevColors[n.severity] || sevColors.info;
    const isUnread = !n.readAt;
    const isSaved = Boolean(n.savedAt);
    const created = new Date(n.createdAt);
    const ageMin = Math.round((Date.now() - created.getTime()) / 60000);
    const ageLabel = ageMin < 1 ? 'agora' :
                     ageMin < 60 ? `${ageMin}min` :
                     ageMin < 1440 ? `${Math.round(ageMin/60)}h` :
                     `${Math.round(ageMin/1440)}d`;

    return `<div class="group relative px-4 py-3 hover:bg-stone-50 transition cursor-pointer ${isUnread ? 'bg-white' : 'bg-stone-50/30'}"
        onclick="Actions.updateNotification(${n.id}, 'read')">
      <div class="flex items-start gap-3">
        <span class="shrink-0 mt-1 w-2 h-2 rounded-full" style="background:${sev.dot}" title="${n.severity}"></span>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 mb-0.5">
            <span class="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded" style="background:${sev.bg};color:${sev.dot};border:1px solid ${sev.border}">${catLabels[n.category] || n.category}</span>
            <span class="text-[9px] text-stone-400">${ageLabel}</span>
            ${isUnread ? '<span class="ml-auto w-1.5 h-1.5 rounded-full bg-violet-600"></span>' : ''}
          </div>
          <p class="text-[12px] ${isUnread ? 'font-black text-slate-900' : 'font-bold text-stone-700'} leading-snug line-clamp-2">
            ${Utils.escape(n.title || n.kind)}
          </p>
          ${n.body ? `<p class="text-[11px] text-stone-600 mt-0.5 line-clamp-2">${Utils.escape(n.body)}</p>` : ''}
        </div>
      </div>
      <div class="opacity-0 group-hover:opacity-100 transition flex items-center gap-1 absolute right-3 top-3">
        <button onclick="event.stopPropagation(); Actions.updateNotification(${n.id}, ${isSaved ? "'unsave'" : "'save'"})"
          class="w-7 h-7 rounded-md bg-white hover:bg-violet-50 border border-stone-200 grid place-items-center text-stone-600"
          title="${isSaved ? 'Tirar dos salvos' : 'Salvar pra depois'}">
          <i data-lucide="${isSaved ? 'bookmark-x' : 'bookmark'}" class="w-3.5 h-3.5"></i>
        </button>
        <button onclick="event.stopPropagation(); Actions.snoozeNotificationPrompt(${n.id})"
          class="w-7 h-7 rounded-md bg-white hover:bg-amber-50 border border-stone-200 grid place-items-center text-stone-600"
          title="Adiar">
          <i data-lucide="clock" class="w-3.5 h-3.5"></i>
        </button>
        <button onclick="event.stopPropagation(); Actions.updateNotification(${n.id}, 'done')"
          class="w-7 h-7 rounded-md bg-white hover:bg-emerald-50 border border-stone-200 grid place-items-center text-stone-600"
          title="Marcar como feito">
          <i data-lucide="check" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    </div>`;
  },

  _footer(cache) {
    const counts = cache.counts || {};
    const hasInbox = (counts.inbox || 0) > 0;
    return `<div class="border-t border-stone-200 bg-stone-50 px-4 py-2.5 flex items-center justify-between gap-2">
      <p class="text-[10px] text-stone-500">
        ${counts.inbox || 0} ativas · ${counts.archive || 0} arquivadas
      </p>
      ${hasInbox ? `
        <button onclick="Actions.markAllNotificationsAsRead()"
          class="text-[10px] font-bold text-violet-700 hover:text-violet-900 inline-flex items-center gap-1">
          <i data-lucide="check-check" class="w-3 h-3"></i>
          Marcar tudo como lido
        </button>
      ` : ''}
    </div>`;
  }
};
