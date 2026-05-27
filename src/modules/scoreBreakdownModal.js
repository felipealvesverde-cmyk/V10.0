// V34.9.6 — Modal "Score Breakdown" item por item.
//
// Abre ao clicar no badge de score de um lead. Mostra:
//   - Header: nome/email do visitor + score atual + entity + faixa
//   - Componentes R/F/V com valores e cálculo
//   - Lista de tags (cada uma + timestamp + source + categoria positiva/negativa)
//   - Lista de touchpoints (canal, source_type, occurred_at)
//   - Lista de eventos custom
//   - Histórico de transitions
//   - Scores por campanha (visitor pode estar em N campanhas)

window.ScoreBreakdownModal = {
  render() {
    const m = App.state.scoreBreakdownModal;
    if (!m || !m.open) return '';
    const d = m.data;
    const loading = m.loading;

    return `<div id="scoreBreakdownBackdrop" class="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm p-4 overflow-auto" onclick="if(event.target===this) Actions.closeScoreBreakdownModal()">
      <section class="max-w-5xl mx-auto rounded-[2rem] bg-slate-50 shadow-2xl overflow-hidden border border-white/20">
        ${this._header(d)}
        <main class="p-5 lg:p-6 max-h-[75vh] overflow-y-auto space-y-4">
          ${loading ? `<p class="text-sm text-slate-500">Carregando breakdown…</p>` : ''}
          ${!loading && d ? this._body(d) : ''}
        </main>
      </section>
    </div>`;
  },

  _header(d) {
    const v = d?.visitor || {};
    const score = d?.score?.final || v.global_score || 0;
    const tier = this._tier(score);
    return `<header class="bg-slate-950 text-white p-6 flex items-start justify-between gap-4">
      <div class="min-w-0 flex-1">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-${tier.color}-400/20 text-${tier.color}-200 text-xs font-black mb-3">
          <i data-lucide="gauge" class="w-3.5 h-3.5"></i>
          SCORE BREAKDOWN · ${tier.label}
        </div>
        <h2 class="text-3xl font-black truncate">${Utils.escape(v.name || v.email || v.lj_visitor_id || 'Visitor')}</h2>
        <p class="text-slate-300 mt-2 text-sm">${Utils.escape(v.email || '—')}${v.phone ? ' · ' + Utils.escape(v.phone) : ''}</p>
        <div class="flex items-center gap-3 mt-3 text-xs">
          <span class="px-2 py-1 rounded-lg bg-white/10 text-white font-black">${Utils.escape(v.entity_type || '?')}</span>
          <span class="px-2 py-1 rounded-lg bg-white/10 text-white font-black">${Utils.escape(v.current_stage || '?')}</span>
          <span class="text-slate-400">Score atual: <strong class="text-white">${score}</strong></span>
        </div>
      </div>
      <button onclick="Actions.closeScoreBreakdownModal()" class="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 font-black flex items-center gap-2">
        <i data-lucide="x" class="w-4 h-4"></i>
        Fechar
      </button>
    </header>`;
  },

  _body(d) {
    return `
      ${this._componentsCard(d.components, d.weights)}
      ${this._scoreFlowCard(d.score, d.visitor)}
      ${this._countsCard(d.counts)}
      ${this._tagsCard(d.items.tags || [])}
      ${this._touchpointsCard(d.items.touchpoints || [])}
      ${this._eventsCard(d.items.events || [])}
      ${this._transitionsCard(d.items.transitions || [])}
      ${this._campaignScoresCard(d.campaignScores || [])}
    `;
  },

  _tier(score) {
    if (score >= 667) return { label: 'Customer', color: 'emerald' };
    if (score >= 501) return { label: 'Quente', color: 'orange' };
    if (score >= 334) return { label: 'Lead', color: 'amber' };
    return { label: 'Frio', color: 'slate' };
  },

  _componentsCard(c, w) {
    if (!c) return '';
    return `<div class="rounded-2xl bg-white border border-slate-200 p-5">
      <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-3">Cálculo R/F/V</h4>
      ${this._compRow('R · Recência', c.R, w.pR, 'violet',
        `${c.R.daysSinceLastEvent} dias inativo · R = e^(-${c.R.lambda} × ${c.R.daysSinceLastEvent})`)}
      ${this._compRow('F · Frequência', c.F, w.pF, 'sky',
        `${c.F.totalEvents} interações totais · saturação em ${c.F.saturation}`)}
      ${this._compRow('V · Volume', c.V, w.pV, 'emerald',
        c.V.breakdown ? Object.entries(c.V.breakdown).map(([k, val]) => `${k}: ${Number(val).toFixed(2)}`).join(' · ') : 'breakdown vazio')}
    </div>`;
  },

  _compRow(label, comp, weight, color, formula) {
    const value = comp.value || 0;
    const contribution = comp.contribution || 0;
    const valPct = Math.round(value * 100);
    const wPct = Math.round(weight * 100);
    return `<div class="mb-4 last:mb-0">
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-sm font-black text-slate-900">${label}</span>
        <span class="text-xs font-bold text-${color}-700">${value.toFixed(3)} × ${wPct}% = <strong>${contribution.toFixed(3)}</strong></span>
      </div>
      <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-1">
        <div class="h-full bg-${color}-500" style="width: ${valPct}%"></div>
      </div>
      <p class="text-[11px] text-slate-500">${Utils.escape(formula)}</p>
    </div>`;
  },

  _scoreFlowCard(s, v) {
    if (!s) return '';
    return `<div class="rounded-2xl bg-white border border-slate-200 p-5">
      <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-3">Cálculo final do score</h4>
      <div class="space-y-2 text-sm font-mono">
        <div class="flex justify-between"><span class="text-slate-600">R×pR + F×pF + V×pV =</span><strong>${s.raw01}</strong></div>
        <div class="flex justify-between"><span class="text-slate-600">Hierarquia clamp aplicada (${Utils.escape(s.appliedClamp)}) →</span><strong>${s.afterHierarchy}</strong></div>
        <div class="flex justify-between text-base"><span class="text-slate-700 font-black">× 999 → Score final:</span><strong class="text-violet-700">${s.final}</strong></div>
      </div>
    </div>`;
  },

  _countsCard(c) {
    if (!c) return '';
    return `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-4">
      <h4 class="text-xs font-black text-slate-700 uppercase tracking-widest mb-2">Resumo de sinais</h4>
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
        ${this._countCell('Tags', c.tags, 'amber')}
        ${this._countCell('+ Positivas', c.positiveTags, 'emerald')}
        ${this._countCell('− Negativas', c.negativeTags, 'red')}
        ${this._countCell('Touchpoints', c.touchpoints, 'sky')}
        ${this._countCell('Eventos', c.events, 'violet')}
        ${this._countCell('Canais', c.distinctChannels, 'slate')}
      </div>
    </div>`;
  },

  _countCell(label, val, color) {
    return `<div class="p-2 rounded-xl bg-white border border-slate-200 text-center">
      <p class="text-[10px] text-${color}-700 font-black uppercase tracking-widest">${label}</p>
      <p class="text-lg font-black text-slate-900">${val || 0}</p>
    </div>`;
  },

  _tagsCard(tags) {
    if (!tags.length) return '';
    return `<div class="rounded-2xl bg-white border border-slate-200 p-5">
      <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-3">Tags (${tags.length})</h4>
      <div class="flex flex-wrap gap-1.5">
        ${tags.map(t => `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs">
          <span class="font-black text-amber-900">${Utils.escape(t.tag)}</span>
          ${t.source ? `<span class="text-[10px] text-amber-700">· ${Utils.escape(t.source)}</span>` : ''}
          <span class="text-[10px] text-slate-500">${t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR') : ''}</span>
        </span>`).join('')}
      </div>
    </div>`;
  },

  _touchpointsCard(rows) {
    if (!rows.length) return '';
    return `<div class="rounded-2xl bg-white border border-slate-200 p-5">
      <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-3">Touchpoints (${rows.length})</h4>
      <div class="space-y-1.5 max-h-48 overflow-y-auto">
        ${rows.map(tp => `<div class="flex items-center gap-2 p-2 rounded-lg bg-sky-50 border border-sky-100 text-xs">
          <span class="font-black text-sky-900 truncate flex-1">${Utils.escape(tp.channel || '—')} · ${Utils.escape(tp.source_type || '')}</span>
          <span class="text-[10px] text-sky-700 shrink-0">${tp.occurred_at ? new Date(tp.occurred_at).toLocaleString('pt-BR') : ''}</span>
        </div>`).join('')}
      </div>
    </div>`;
  },

  _eventsCard(rows) {
    if (!rows.length) return '';
    return `<div class="rounded-2xl bg-white border border-slate-200 p-5">
      <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-3">Eventos custom (${rows.length})</h4>
      <div class="space-y-1.5 max-h-48 overflow-y-auto">
        ${rows.map(e => `<div class="flex items-center gap-2 p-2 rounded-lg bg-violet-50 border border-violet-100 text-xs">
          <span class="font-black text-violet-900 truncate flex-1">${Utils.escape(e.event_type || '—')}</span>
          <span class="text-[10px] text-violet-700 shrink-0">${e.occurred_at ? new Date(e.occurred_at).toLocaleString('pt-BR') : ''}</span>
        </div>`).join('')}
      </div>
    </div>`;
  },

  _transitionsCard(rows) {
    if (!rows.length) return '';
    return `<div class="rounded-2xl bg-white border border-slate-200 p-5">
      <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-3">Histórico de transições (${rows.length})</h4>
      <div class="space-y-1.5 max-h-48 overflow-y-auto">
        ${rows.map(t => `<div class="flex items-center gap-2 p-2 rounded-lg bg-emerald-50 border border-emerald-100 text-xs">
          <span class="text-[10px] text-emerald-700">${Utils.escape(t.from_stage || '—')}</span>
          <i data-lucide="arrow-right" class="w-3 h-3 text-emerald-600"></i>
          <span class="font-black text-emerald-900">${Utils.escape(t.to_stage || '—')}</span>
          <span class="text-[10px] text-emerald-700 ml-auto">${Utils.escape(t.source || '—')}</span>
          <span class="text-[10px] text-slate-500">${t.occurred_at ? new Date(t.occurred_at).toLocaleString('pt-BR') : ''}</span>
        </div>`).join('')}
      </div>
    </div>`;
  },

  _campaignScoresCard(rows) {
    if (!rows.length) return '';
    return `<div class="rounded-2xl bg-white border border-slate-200 p-5">
      <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-3">Scores por campanha (${rows.length})</h4>
      <div class="space-y-1.5">
        ${rows.map(cs => {
          const c = (App.state.campaigns || []).find(x => Number(x.id) === Number(cs.campaign_id));
          const name = c?.name || `Campanha ${cs.campaign_id}`;
          const tier = this._tier(cs.score || 0);
          return `<div class="flex items-center gap-2 p-2 rounded-lg bg-${tier.color}-50 border border-${tier.color}-200 text-xs">
            <span class="font-black text-slate-900 truncate flex-1">${Utils.escape(name)}</span>
            <span class="text-[10px] text-slate-600">${Utils.escape(cs.current_stage || '—')}</span>
            <span class="px-2 py-0.5 rounded-full bg-${tier.color}-100 text-${tier.color}-900 font-black">${cs.score || 0}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }
};
