// V35.1.0 — Checkout Dashboard.
//
// Tab "Checkout" dentro do Dashboard. Sub-tabs:
//   - Geral (default — agrega todos produtos Hotmart conectados)
//   - 1 sub-tab por produto Hotmart com transações
//
// Visual coerente com Home: KPI cards, gráfico simples, lista paginada.
// V35.1.1 vai adicionar painel Djow lateral à direita.

window.CheckoutDashboard = {
  render() {
    const m = App.state.checkoutDashboard || {};
    const activeSubTab = m.activeSubTab || 'all';

    // V35.3.2 / V35.3.3 — Sub-tabs especiais renderizam módulos próprios no
    // lugar dos componentes de transação. Painel Djow esconde porque não tem
    // dado pra resumir (APIs externas em standby).
    const specialSubTabs = {
      alunos:       { module: window.AlunosModule,         label: 'Alunos' },
      'meta-ads':   { module: window.MetaAdsDashboard,     label: 'Meta Ads' },
      'google-ads': { module: window.GoogleAdsDashboard,   label: 'Google Ads' }
    };
    if (specialSubTabs[activeSubTab]) {
      const meta = specialSubTabs[activeSubTab];
      const productsForTabs = (m.products && m.products.length)
        ? m.products
        : (m.loadedAt ? [] : null);
      if (productsForTabs === null) {
        setTimeout(() => Actions.loadCheckoutDashboard(), 0);
      }
      return `<div class="p-2 lg:p-4 space-y-4">
        ${this._subTabs(productsForTabs || [], activeSubTab)}
        ${meta.module ? meta.module.render() : `<p class="text-sm text-slate-500 p-6">Módulo ${meta.label} não carregado.</p>`}
      </div>`;
    }

    if (!m.loadedAt) {
      setTimeout(() => Actions.loadCheckoutDashboard(), 0);
      return `<div class="p-6"><p class="text-sm text-slate-500">Carregando Checkout…</p></div>`;
    }
    const products = m.products || [];

    // V35.1.1 — grid 2 cols: main + Djow lateral sticky (em telas grandes)
    return `<div class="p-2 lg:p-4">
      <div class="lj-checkout-grid">
        <div class="space-y-4 min-w-0">
          ${this._subTabs(products, activeSubTab)}
          ${this._headerStrip(m)}
          ${this._reasonFilterBanner(m)}
          ${this._kpiGrid(m)}
          ${this._reasonsBreakdown(m)}
          ${this._chart(m)}
          ${this._transactionsTable(m)}
        </div>
        ${window.DjowCheckoutPanel ? DjowCheckoutPanel.render() : ''}
      </div>
      ${this._othersModal(m)}
    </div>`;
  },

  // V35.2.1 — Banner do filtro ativo de motivo
  _reasonFilterBanner(m) {
    if (!m.reasonFilter) return '';
    const r = (m.cancellationReasons || []).find(x => x.code === m.reasonFilter);
    const label = r?.label || m.reasonFilter;
    return `<div class="rounded-2xl bg-red-50 border-2 border-red-300 p-3 flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 min-w-0">
        <i data-lucide="filter" class="w-4 h-4 text-red-700 shrink-0"></i>
        <p class="text-sm font-black text-slate-900 truncate">Filtrando recusas: <span class="text-red-700">${Utils.escape(label)}</span></p>
      </div>
      <button onclick="Actions.clearCheckoutReasonFilter()" class="px-3 py-1.5 rounded-xl bg-white border border-red-300 hover:bg-red-100 text-xs font-black text-red-700 flex items-center gap-1.5 shrink-0">
        <i data-lucide="x" class="w-3 h-3"></i>
        Limpar
      </button>
    </div>`;
  },

  // V35.2.1 — Breakdown top 4 motivos + barra "Outros" + botão "ver mais"
  _reasonsBreakdown(m) {
    const reasons = Array.isArray(m.cancellationReasons) ? m.cancellationReasons : [];
    if (!reasons.length) return '';
    const total = reasons.reduce((s, r) => s + (r.count || 0), 0);
    if (!total) return '';
    // Separa "OTHERS" do resto
    const others = reasons.find(r => r.code === 'OTHERS');
    const named = reasons.filter(r => r.code !== 'OTHERS').slice(0, 4);
    return `<div class="bg-white rounded-2xl border-2 border-red-100 p-4">
      <div class="flex items-center justify-between mb-3">
        <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest">Motivos de recusa</h4>
        <p class="text-[10px] text-slate-500">${total} recusa(s) no período</p>
      </div>
      <div class="space-y-1.5">
        ${named.map(r => this._reasonRow(r, total, m.reasonFilter)).join('')}
        ${others ? this._reasonRow(others, total, m.reasonFilter, true) : ''}
      </div>
    </div>`;
  },

  _reasonRow(r, total, activeFilter, isOthers = false) {
    const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
    const isActive = activeFilter === r.code;
    return `<button onclick="Actions.setCheckoutReasonFilter('${Utils.escape(r.code)}')" class="w-full grid grid-cols-[1fr_auto_auto] gap-2 items-center text-left p-1.5 rounded-lg hover:bg-slate-50 ${isActive ? 'bg-red-50 border border-red-200' : ''} transition">
      <div class="min-w-0">
        <p class="text-xs font-black text-slate-900 truncate">${Utils.escape(r.label)}${isOthers && r.details?.length ? ` <span class="text-[9px] font-normal text-slate-500">(${r.details.length} motivo${r.details.length > 1 ? 's' : ''})</span>` : ''}</p>
        <div class="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-1">
          <div class="h-full ${isActive ? 'bg-red-600' : 'bg-red-400'}" style="width:${pct}%;"></div>
        </div>
      </div>
      <span class="text-xs font-black text-slate-900 shrink-0">${r.count}</span>
      ${isOthers ? `<span onclick="event.stopPropagation(); Actions.toggleCheckoutOthersModal()" class="text-[10px] font-black text-red-700 hover:underline shrink-0 cursor-pointer">ver detalhes</span>` : `<span class="text-[10px] text-slate-400 shrink-0">${pct}%</span>`}
    </button>`;
  },

  // V35.2.1 — Modal listando os códigos crus que caíram em "Outros"
  _othersModal(m) {
    if (!m.othersModalOpen) return '';
    const others = (m.cancellationReasons || []).find(r => r.code === 'OTHERS');
    const details = others?.details || [];
    return `<div class="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" onclick="if(event.target===this) Actions.toggleCheckoutOthersModal()">
      <section class="max-w-md w-full rounded-3xl bg-white shadow-2xl overflow-hidden">
        <header class="bg-red-600 p-4 text-white" style="color:#fff;">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-[10px] font-black uppercase tracking-widest text-red-100">Recusas não mapeadas</p>
              <h3 class="text-lg font-black">Outros motivos (${others?.count || 0})</h3>
            </div>
            <button onclick="Actions.toggleCheckoutOthersModal()" class="p-1.5 rounded-lg bg-white/15 hover:bg-white/25" style="color:#fff;">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>
        </header>
        <div class="p-5 max-h-[60vh] overflow-y-auto">
          <p class="text-xs text-slate-600 mb-3">Códigos crus que a Hotmart retornou e ainda não estão mapeados em motivos específicos. Se algum aparecer com volume grande, vale pedir pra mapear.</p>
          <div class="space-y-1.5">
            ${details.length ? details.map(d => `<div class="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <span class="font-mono text-slate-700 truncate">${Utils.escape(d.code)}</span>
              <span class="font-black text-slate-900 shrink-0">${d.count}</span>
            </div>`).join('') : '<p class="text-xs text-slate-500 italic text-center py-4">Nenhum detalhe disponível.</p>'}
          </div>
        </div>
      </section>
    </div>`;
  },

  _subTabs(products, active) {
    // V35.3.2 / V35.3.3 — Sub-tabs especiais (Alunos CS, Meta+Google Marketing)
    // ficam depois de um separador visual, distinguindo das sub-tabs dinâmicas
    // de produto Hotmart.
    const specials = [
      { id: 'alunos',     label: 'Meus Alunos', icon: 'graduation-cap', semantic: 'cs',
        activeBg: '#6BBEF9', restBg: 'rgba(107,190,249,.10)', restBorder: 'rgba(107,190,249,.40)', restText: '#2563eb',
        title: 'Engajamento pós-venda (Club API)' },
      { id: 'meta-ads',   label: 'Meta Ads',    icon: 'facebook',       semantic: 'marketing',
        activeBg: '#F472B6', restBg: 'rgba(244,114,182,.10)', restBorder: 'rgba(244,114,182,.40)', restText: '#be185d',
        title: 'Facebook + Instagram + WhatsApp Ads (Meta Marketing API)' },
      { id: 'google-ads', label: 'Google Ads',  icon: 'search',         semantic: 'marketing',
        activeBg: '#F472B6', restBg: 'rgba(244,114,182,.10)', restBorder: 'rgba(244,114,182,.40)', restText: '#be185d',
        title: 'Search + Display + YouTube + Performance Max (Google Ads API)' }
    ];
    return `<div class="flex flex-wrap gap-1.5 mb-2 items-center">
      <button onclick="Actions.setCheckoutSubTab('all')" class="px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 ${active === 'all' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}" ${active === 'all' ? 'style="color:#fff;"' : ''}>
        <i data-lucide="layers" class="w-3 h-3"></i>
        Geral
      </button>
      ${products.map(p => {
        const isActive = String(active) === String(p.productIdHotmart);
        return `<button onclick="Actions.setCheckoutSubTab('${Utils.escape(String(p.productIdHotmart))}')" class="px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 ${isActive ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}" ${isActive ? 'style="color:#fff;"' : ''} title="${Utils.escape(p.productName)} — ${p.purchaseCount} compra(s)">
          <i data-lucide="package" class="w-3 h-3"></i>
          ${Utils.escape(p.productName.slice(0, 24))}${p.productName.length > 24 ? '…' : ''}
        </button>`;
      }).join('')}
      <span class="w-px h-6 bg-slate-300 mx-1"></span>
      ${specials.map(s => {
        const isActive = active === s.id;
        const style = isActive
          ? `background: ${s.activeBg}; color: #fff;`
          : `background: ${s.restBg}; border: 1px solid ${s.restBorder}; color: ${s.restText};`;
        return `<button onclick="Actions.setCheckoutSubTab('${s.id}')"
                class="px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition"
                style="${style}"
                title="${Utils.escape(s.title)}">
          <i data-lucide="${s.icon}" class="w-3 h-3"></i>
          ${s.label}
        </button>`;
      }).join('')}
    </div>`;
  },

  _headerStrip(m) {
    const days = m.period?.days || 30;
    return `<div class="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h3 class="text-lg font-black text-slate-900">Checkout · Hotmart</h3>
        <p class="text-xs text-slate-500">Últimos ${days} dias · ${m.activeSubTab === 'all' ? 'Todos produtos' : 'Filtrado por produto'}</p>
      </div>
      <div class="flex gap-2">
        ${[7, 30, 90, 180].map(d => `<button onclick="Actions.setCheckoutPeriod(${d})" class="px-3 py-1.5 rounded-xl text-[11px] font-black ${days === d ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" ${days === d ? 'style="color:#fff;"' : ''}>${d}d</button>`).join('')}
        <button onclick="Actions.syncHotmartHistory()" class="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-black flex items-center gap-1.5" style="color:#fff;" title="Puxa histórico via Sales API (requer OAuth configurado)">
          <i data-lucide="refresh-cw" class="w-3 h-3"></i>
          Sincronizar
        </button>
      </div>
    </div>`;
  },

  _kpiGrid(m) {
    const k = m.kpis || {};
    const fmtBRL = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    const cards = [
      { label: 'Receita', value: fmtBRL(k.totalRevenueCents), icon: 'dollar-sign', accent: 'revenue' },
      { label: 'Vendas aprovadas', value: k.approvedCount || 0, icon: 'check-circle-2', accent: 'sales' },
      { label: 'Ticket médio', value: fmtBRL(k.avgTicketCents), icon: 'receipt', accent: 'revenue' },
      { label: 'Comissão paga', value: fmtBRL(k.totalCommissionCents), icon: 'hand-coins', accent: 'revops' }
    ];
    const secondary = [
      { label: 'Boleto pendente', value: k.billetCount || 0, icon: 'clock', tone: 'amber' },
      { label: 'Reembolsadas', value: k.refundedCount || 0, icon: 'rotate-ccw', tone: 'slate' },
      { label: 'Chargebacks', value: k.chargebackCount || 0, icon: 'alert-triangle', tone: 'red' },
      { label: 'Canceladas', value: k.canceledCount || 0, icon: 'x-circle', tone: 'slate' }
    ];
    return `<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      ${cards.map(c => `<div class="lj-kpi-card lj-kpi-${c.accent}">
        <div class="lj-kpi-header">
          <div class="lj-kpi-icon"><i data-lucide="${c.icon}" class="w-5 h-5"></i></div>
          <div class="lj-kpi-label">${c.label}</div>
        </div>
        <div class="lj-kpi-value">${c.value}</div>
      </div>`).join('')}
    </div>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
      ${secondary.map(s => `<div class="rounded-xl bg-white border border-slate-200 p-3 flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg flex items-center justify-center bg-${s.tone}-50 text-${s.tone}-600">
          <i data-lucide="${s.icon}" class="w-4 h-4"></i>
        </div>
        <div>
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">${s.label}</p>
          <p class="text-lg font-black text-slate-900">${s.value}</p>
        </div>
      </div>`).join('')}
    </div>`;
  },

  _chart(m) {
    const series = Array.isArray(m.series) ? m.series : [];
    if (!series.length) {
      return `<div class="bg-white rounded-2xl border border-slate-200 p-4">
        <p class="text-sm text-slate-500 italic text-center py-6">Sem vendas no período pra montar gráfico.</p>
      </div>`;
    }
    const maxRevenue = Math.max(...series.map(s => s.revenueCents || 0)) || 1;
    return `<div class="bg-white rounded-2xl border border-slate-200 p-4">
      <div class="flex items-center justify-between mb-3">
        <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest">Evolução · ${series.length} dia(s)</h4>
      </div>
      <div class="flex items-end gap-1 h-32">
        ${series.map(s => {
          const hPct = ((s.revenueCents || 0) / maxRevenue) * 100;
          const dayLabel = new Date(s.day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          return `<div class="flex-1 flex flex-col items-center gap-1" title="${dayLabel}: ${s.approved} vendas · R$ ${(s.revenueCents / 100).toFixed(2)}">
            <div class="w-full rounded-t bg-emerald-400" style="height:${Math.max(hPct, 2)}%; min-height:2px;"></div>
            <span class="text-[8px] text-slate-400">${dayLabel.slice(0, 5)}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  _transactionsTable(m) {
    const tx = Array.isArray(m.transactions) ? m.transactions : [];
    const fmtBRL = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
    const statusBadge = (s) => {
      const map = {
        approved: { bg: 'emerald', label: 'Aprovada' },
        refunded: { bg: 'slate', label: 'Reembolsada' },
        chargeback: { bg: 'red', label: 'Chargeback' },
        canceled: { bg: 'slate', label: 'Cancelada' },
        billet_printed: { bg: 'amber', label: 'Boleto gerado' },
        expired: { bg: 'slate', label: 'Expirada' },
        delayed: { bg: 'amber', label: 'Atrasada' }
      };
      const t = map[s] || { bg: 'slate', label: s || '?' };
      return `<span class="inline-flex px-2 py-0.5 rounded-full bg-${t.bg}-100 text-${t.bg}-800 text-[10px] font-black">${t.label}</span>`;
    };
    if (!tx.length) {
      return `<div class="bg-white rounded-2xl border border-slate-200 p-6 text-center">
        <p class="text-sm text-slate-500 italic">Nenhuma transação no período.</p>
        <p class="text-xs text-slate-400 mt-2">Conecte OAuth e clique em "Sincronizar" pra puxar histórico.</p>
      </div>`;
    }
    // V35.2.1 — mostra coluna Motivo quando há canceladas com reason mapeado
    const hasReasons = tx.some(t => t.purchase_status === 'canceled' && t.cancellation_reason);
    const reasonsMap = Object.fromEntries(
      (m.cancellationReasons || []).filter(r => r.code !== 'OTHERS').map(r => [r.code, r.label])
    );
    const motivoLabel = (code) => reasonsMap[code] || (code ? code : '—');

    return `<div class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest">Transações</h4>
        <p class="text-[10px] text-slate-500">${tx.length} de ${m.pagination?.total || tx.length}</p>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead class="bg-slate-50">
            <tr class="text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <th class="px-3 py-2">Data</th>
              <th class="px-3 py-2">Buyer</th>
              <th class="px-3 py-2">Produto</th>
              <th class="px-3 py-2">Pgmt</th>
              <th class="px-3 py-2 text-right">Valor</th>
              <th class="px-3 py-2">Status</th>
              ${hasReasons ? '<th class="px-3 py-2">Motivo</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${tx.map(t => `<tr class="border-t border-slate-100 hover:bg-slate-50">
              <td class="px-3 py-2 text-slate-600 whitespace-nowrap">${new Date(t.occurred_at).toLocaleDateString('pt-BR')}</td>
              <td class="px-3 py-2">
                <p class="font-black text-slate-900 truncate max-w-[160px]">${Utils.escape(t.buyer_name || '—')}</p>
                <p class="text-[10px] text-slate-500 truncate max-w-[160px]">${Utils.escape(t.buyer_email || '')}</p>
              </td>
              <td class="px-3 py-2 text-slate-700 truncate max-w-[140px]">${Utils.escape(t.product_name || '—')}</td>
              <td class="px-3 py-2 text-slate-600 text-[10px]">${Utils.escape(t.payment_method || '—')}${t.installments ? ' · ' + t.installments + 'x' : ''}</td>
              <td class="px-3 py-2 text-right font-black text-slate-900 whitespace-nowrap">${fmtBRL(t.transaction_value_cents)}</td>
              <td class="px-3 py-2">${statusBadge(t.purchase_status)}</td>
              ${hasReasons ? `<td class="px-3 py-2 text-[10px] text-red-700 truncate max-w-[120px]">${t.purchase_status === 'canceled' && t.cancellation_reason ? Utils.escape(motivoLabel(t.cancellation_reason)) : '<span class="text-slate-300">—</span>'}</td>` : ''}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }
};
