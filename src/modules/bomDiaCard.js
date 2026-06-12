// V37.4.4 — Card "Bom Dia" na Home.
//
// Aparece na primeira visita do dia. Mostra resumo do que rolou desde a
// última visita: contagens por severidade + highlights críticos + agrupamento
// por categoria. Click leva ao sininho.
//
// Persistência: localStorage `lj_bomdia_last_seen` (YYYY-MM-DD) — se já viu hoje,
// não aparece. Dismissar manual também salva como visto.

const BOMDIA_STORAGE_KEY = 'lj_bomdia_last_seen';

window.BomDiaCard = {
  shouldShow() {
    const today = this._todayKey();
    const lastSeen = localStorage.getItem(BOMDIA_STORAGE_KEY);
    return lastSeen !== today;
  },

  markAsSeen() {
    localStorage.setItem(BOMDIA_STORAGE_KEY, this._todayKey());
  },

  _todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  async ensureLoaded() {
    const cache = App.state.bomDiaSummary;
    if (cache?.loadedAt && (Date.now() - cache.loadedAt) < 5 * 60 * 1000) return;
    if (cache?.loading) return;
    App.state.bomDiaSummary = App.state.bomDiaSummary || {};
    App.state.bomDiaSummary.loading = true;
    try {
      const token = localStorage.getItem('lj_jwt');
      // Pega desde 18h do dia anterior pra cobrir "desde ontem à noite"
      const since = new Date();
      since.setDate(since.getDate() - 1);
      since.setHours(18, 0, 0, 0);
      const r = await fetch(`/api/notifications-daily-summary?since=${encodeURIComponent(since.toISOString())}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await r.json();
      if (data.ok) {
        App.state.bomDiaSummary = {
          ...data,
          loading: false,
          loadedAt: Date.now()
        };
        App.render();
      } else {
        App.state.bomDiaSummary.loading = false;
        App.state.bomDiaSummary.error = data.message;
        App.render();
      }
    } catch (err) {
      App.state.bomDiaSummary.loading = false;
      App.state.bomDiaSummary.error = err.message;
    }
  },

  // V37.4.15 — card big-bang substituído por chip discreto. Compatibilidade
  // mantida: render() agora retorna o chip pra continuar funcionando se chamado.
  render() {
    return this.renderChip();
  },

  renderChip() {
    if (App.state.bomDiaDismissed) return '';
    const summary = App.state.bomDiaSummary;
    if (!summary) {
      setTimeout(() => this.ensureLoaded(), 0);
      return '';
    }
    if (summary.loading) return '';
    const total = summary.overall?.total || 0;
    if (total === 0) return '';

    return `<button onclick="Actions.openNotificationsFromBomDia()"
        class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/15 border border-violet-400/30 text-violet-100 text-[11px] font-bold hover:bg-violet-500/25 transition mb-3">
      <i data-lucide="bell" class="w-3 h-3"></i>
      <span>${total} atualização${total === 1 ? '' : 'ões'} desde ontem</span>
      <i data-lucide="arrow-right" class="w-3 h-3 opacity-60"></i>
    </button>`;
  },

  // Versão antiga (renderFull) mantida pra histórico mas não chamada.
  renderFull_DEPRECATED_V37_4_15() {
    if (!this.shouldShow()) return '';
    if (App.state.bomDiaDismissed) return '';

    const summary = App.state.bomDiaSummary;
    if (!summary) {
      setTimeout(() => this.ensureLoaded(), 0);
      return '';
    }
    if (summary.loading) return '';

    const total = summary.overall?.total || 0;
    if (total === 0) return ''; // nada novo, não mostra

    const userName = App.state.user?.displayName || App.currentUser?.displayName || 'aí';
    const greeting = this._greeting();

    const catLabels = {
      handoff: { label: 'handoffs pra você', color: '#7c3aed' },
      event: { label: 'eventos no tenant', color: '#0ea5e9' },
      state: { label: 'mudanças de estado', color: '#10b981' },
      operational: { label: 'alertas operacionais', color: '#f59e0b' },
      integration: { label: 'questões de integração', color: '#ef4444' },
      health: { label: 'eventos de saúde', color: '#78716c' }
    };

    const highlights = summary.highlights || [];
    const bySev = summary.overall || { critical: 0, warning: 0, info: 0 };

    return `<div class="rounded-3xl bg-gradient-to-br from-violet-50 via-white to-sky-50 border border-violet-200 shadow-sm p-5 mb-4 relative overflow-hidden" style="border-left:4px solid #7c3aed;">
      <button onclick="Actions.dismissBomDia()" class="absolute top-3 right-3 w-7 h-7 rounded-lg hover:bg-violet-100 grid place-items-center text-stone-500" title="Dispensar">
        <i data-lucide="x" class="w-3.5 h-3.5"></i>
      </button>

      <div class="flex items-start gap-3 mb-3">
        <span class="shrink-0 w-10 h-10 rounded-xl bg-violet-100 border border-violet-200 grid place-items-center text-violet-700 text-lg">
          ${this._timeIcon()}
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-[11px] font-black text-violet-700 uppercase tracking-widest">${greeting}, ${Utils.escape(userName)}</p>
          <h3 class="text-[15px] font-black text-slate-900 leading-tight mt-0.5">
            Desde ontem 18h, ${total} ${total === 1 ? 'novidade' : 'novidades'} no tenant
          </h3>
        </div>
      </div>

      <div class="flex items-center gap-2 mb-3 flex-wrap">
        ${bySev.critical > 0 ? `<span class="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-rose-100 border border-rose-300 text-rose-800"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>${bySev.critical} crítico${bySev.critical === 1 ? '' : 's'}</span>` : ''}
        ${bySev.warning > 0 ? `<span class="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-amber-100 border border-amber-300 text-amber-800"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>${bySev.warning} atenção</span>` : ''}
        ${bySev.info > 0 ? `<span class="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-sky-100 border border-sky-300 text-sky-800"><span class="w-1.5 h-1.5 rounded-full bg-sky-500"></span>${bySev.info} info</span>` : ''}
      </div>

      ${(summary.byCategory || []).length > 0 ? `
        <div class="space-y-1 mb-3">
          ${(summary.byCategory || []).slice(0, 4).map(c => {
            const meta = catLabels[c.category] || { label: c.category, color: '#78716c' };
            return `<div class="flex items-center gap-2 text-[11px] text-slate-700">
              <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${meta.color}"></span>
              <span class="font-bold text-slate-900">${c.count}</span>
              <span>${meta.label}</span>
            </div>`;
          }).join('')}
        </div>
      ` : ''}

      ${highlights.length > 0 ? `
        <div class="border-t border-stone-200 pt-3 space-y-1.5">
          <p class="text-[9px] font-black text-stone-500 uppercase tracking-widest">Pra você olhar primeiro</p>
          ${highlights.map(h => `
            <div class="flex items-start gap-2 text-[11px]">
              <span class="shrink-0 mt-0.5 w-1.5 h-1.5 rounded-full ${h.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-500'}"></span>
              <span class="text-slate-800 leading-snug">${Utils.escape(h.title || h.kind)}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div class="mt-4 flex items-center justify-between gap-2">
        <button onclick="Actions.openNotificationsFromBomDia()" class="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-black inline-flex items-center gap-1.5" style="color:#fff!important;">
          <i data-lucide="bell" class="w-3 h-3"></i>
          Ver tudo no sininho
        </button>
        <button onclick="Actions.dismissBomDia()" class="text-[11px] text-stone-500 hover:text-stone-700 font-bold">
          Vou ver depois
        </button>
      </div>
    </div>`;
  },

  _greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  },

  _timeIcon() {
    const h = new Date().getHours();
    if (h < 6 || h >= 19) return '🌙';
    if (h < 12) return '☀️';
    if (h < 18) return '🌤';
    return '🌅';
  }
};
