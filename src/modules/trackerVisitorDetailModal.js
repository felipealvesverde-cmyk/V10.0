// V33.0.0 — Onda 1 Fase 3.4: Modal "Jornada Causal" do visitor.
//
// Aberto via Actions.loadVisitorDetail(lj_visitor_id). Mostra timeline
// cronológica completa: touchpoints (origens), transitions (momentos críticos)
// e events (log cru). É o "prontuário" da pessoa.

(function() {
  'use strict';

  const TrackerVisitorDetailModal = {
    render() {
      const d = window.App?.state?.trackerVisitorDetail;
      if (!d) return '';
      const loading = !!d.loading;
      const error = d.error || null;
      const data = d.data || null;

      return `<div class="fixed inset-0 z-[93] grid place-items-center p-4"
        style="background: rgba(15,23,42,0.82); backdrop-filter: blur(8px);"
        onclick="if(event.target===this) Actions.closeVisitorDetail()">
        <div class="w-full max-w-3xl rounded-3xl bg-slate-900 border-2 border-violet-400/40 shadow-2xl overflow-hidden">

          <!-- HEADER -->
          <div class="bg-gradient-to-r from-violet-500/20 to-sky-500/20 border-b border-white/10 px-5 py-4 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-[10px] font-black text-violet-300 uppercase tracking-widest inline-flex items-center gap-1.5">
                <i data-lucide="user-search" class="w-3 h-3"></i> Jornada Causal
              </p>
              ${data ? `
                <h2 class="text-lg font-black text-white mt-1 leading-tight">${Utils.escape(data.visitor.name || data.visitor.email || data.visitor.phone || d.lj_visitor_id)}</h2>
                <div class="flex items-center gap-2 mt-1 flex-wrap">
                  <span class="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${this._entityBadge(data.visitor.entity_type)}">${data.visitor.entity_type || 'suspect'}</span>
                  <span class="text-[10px] text-slate-400">${Utils.escape(data.visitor.current_stage || 'marketing-tof')}</span>
                  ${data.visitor.email ? `<span class="text-[10px] text-slate-500">· ${Utils.escape(data.visitor.email)}</span>` : ''}
                </div>
              ` : `<h2 class="text-lg font-black text-white mt-1">Carregando...</h2>`}
            </div>
            <button onclick="Actions.closeVisitorDetail()" class="shrink-0 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 grid place-items-center">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>

          <!-- BODY -->
          <div class="p-5 max-h-[70vh] overflow-y-auto space-y-4">
            ${loading ? `<div class="text-center py-8">
              <i data-lucide="loader-2" class="w-8 h-8 text-violet-300 inline-block animate-spin"></i>
              <p class="text-[11px] text-slate-400 mt-2">Carregando jornada...</p>
            </div>` : ''}

            ${error ? `<div class="rounded-xl bg-rose-500/10 border border-rose-400/40 p-4">
              <p class="text-[11px] font-black text-rose-300 uppercase tracking-widest mb-2">Erro</p>
              <p class="text-[12px] text-rose-200">${Utils.escape(error)}</p>
            </div>` : ''}

            ${data ? this._renderBody(data) : ''}
          </div>

          <!-- FOOTER -->
          <div class="bg-slate-900/80 border-t border-white/5 px-5 py-3 flex justify-end">
            <button onclick="Actions.closeVisitorDetail()" class="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[10px] font-black uppercase tracking-wider">Fechar</button>
          </div>
        </div>
      </div>`;
    },

    _entityBadge(entityType) {
      if (entityType === 'customer') return 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200';
      if (entityType === 'lead') return 'bg-sky-500/15 border-sky-400/40 text-sky-200';
      return 'bg-violet-500/15 border-violet-400/40 text-violet-200'; // suspect
    },

    _renderBody(data) {
      const { visitor, touchpoints, events, transitions } = data;

      // Combina tudo em timeline única ordenada
      const items = [];
      for (const t of touchpoints) {
        items.push({
          ts: new Date(t.occurred_at).getTime(),
          kind: 'touchpoint',
          icon: 'map-pin',
          color: 'sky',
          title: `Touchpoint · ${Utils.escape(t.source || 'direct')}${t.is_first ? ' (primeiro contato)' : ''}`,
          subtitle: [
            t.utm_campaign ? `utm_campaign=${t.utm_campaign}` : null,
            t.referrer_url ? `via ${new URL(t.referrer_url).hostname}` : null,
            t.landing_url ? `→ ${t.landing_url.replace(/^https?:\/\//, '').slice(0, 50)}` : null
          ].filter(Boolean).join(' · ')
        });
      }
      for (const tr of transitions) {
        items.push({
          ts: new Date(tr.occurred_at).getTime(),
          kind: 'transition',
          icon: tr.to_entity === 'customer' ? 'crown' : tr.to_entity === 'lead' ? 'user-check' : 'sparkles',
          color: tr.to_entity === 'customer' ? 'emerald' : tr.to_entity === 'lead' ? 'sky' : 'violet',
          title: `Virou <b>${tr.to_entity.toUpperCase()}</b>${tr.from_entity ? ` (de ${tr.from_entity})` : ''}`,
          subtitle: `Estágio: ${tr.from_stage || '—'} → ${tr.to_stage} · source: ${tr.source}`
        });
      }
      for (const e of events.slice(0, 30)) {
        items.push({
          ts: new Date(e.occurred_at).getTime(),
          kind: 'event',
          icon: e.event_type === 'page_view' ? 'eye' : e.event_type === 'form_submit' ? 'mail' : 'mouse-pointer-click',
          color: 'slate',
          title: Utils.escape(e.event_type),
          subtitle: e.event_payload?.url ? Utils.escape(String(e.event_payload.url).slice(0, 60)) : (e.event_payload?.email ? `email=${Utils.escape(e.event_payload.email)}` : '')
        });
      }
      items.sort((a, b) => a.ts - b.ts);

      return `<div class="space-y-4">
        <!-- Summary cards -->
        <div class="grid grid-cols-3 gap-2">
          <div class="rounded-xl bg-sky-500/10 border border-sky-400/30 p-3">
            <p class="text-[9px] font-black text-sky-300 uppercase tracking-widest">Touchpoints</p>
            <p class="text-xl font-black text-white mt-0.5">${touchpoints.length}</p>
          </div>
          <div class="rounded-xl bg-violet-500/10 border border-violet-400/30 p-3">
            <p class="text-[9px] font-black text-violet-300 uppercase tracking-widest">Transitions</p>
            <p class="text-xl font-black text-white mt-0.5">${transitions.length}</p>
          </div>
          <div class="rounded-xl bg-slate-700/40 border border-white/10 p-3">
            <p class="text-[9px] font-black text-slate-400 uppercase tracking-widest">Eventos</p>
            <p class="text-xl font-black text-white mt-0.5">${events.length}</p>
          </div>
        </div>

        <!-- Timeline cronológica -->
        <div>
          <p class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3 inline-flex items-center gap-1.5">
            <i data-lucide="clock" class="w-3.5 h-3.5"></i> Timeline (mais antigo → mais recente)
          </p>
          ${items.length === 0 ? `<p class="text-[12px] text-slate-500 italic">Sem eventos registrados ainda.</p>` : `<div class="space-y-2">
            ${items.map(i => this._timelineRow(i)).join('')}
          </div>`}
        </div>

        <!-- RD sync status (se aplicável) -->
        ${visitor.external_rd_sync_status ? `<div class="rounded-xl bg-slate-800/40 border border-white/10 p-3">
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Sync RD CRM</p>
          <p class="text-[11px] text-slate-200">
            Status: <b class="${visitor.external_rd_sync_status === 'synced' ? 'text-emerald-300' : visitor.external_rd_sync_status === 'error' ? 'text-rose-300' : 'text-amber-300'}">${Utils.escape(visitor.external_rd_sync_status)}</b>
            ${visitor.external_rd_contact_id ? ` · contact ${Utils.escape(visitor.external_rd_contact_id)}` : ''}
            ${visitor.external_rd_deal_id ? ` · deal ${Utils.escape(visitor.external_rd_deal_id)}` : ''}
          </p>
          ${visitor.external_rd_sync_error ? `<p class="text-[10px] text-rose-300 mt-1 italic">${Utils.escape(visitor.external_rd_sync_error)}</p>` : ''}
        </div>` : ''}
      </div>`;
    },

    _timelineRow(item) {
      const when = new Date(item.ts).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
      return `<div class="flex gap-3 items-start">
        <div class="shrink-0 w-7 h-7 rounded-lg bg-${item.color}-500/20 border border-${item.color}-400/40 grid place-items-center mt-0.5">
          <i data-lucide="${item.icon}" class="w-3.5 h-3.5 text-${item.color}-200"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[12px] font-bold text-white leading-tight">${item.title}</p>
          ${item.subtitle ? `<p class="text-[10px] text-slate-400 mt-0.5 truncate" title="${Utils.escape(item.subtitle)}">${item.subtitle}</p>` : ''}
          <p class="text-[9px] text-slate-500 mt-0.5">${when}</p>
        </div>
      </div>`;
    }
  };

  window.TrackerVisitorDetailModal = TrackerVisitorDetailModal;
})();
