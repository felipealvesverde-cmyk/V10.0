// V34.9.11 — Modal "Score Breakdown" item por item.
//
// Abre ao clicar no badge de score de um lead. Mostra:
//   - Header: nome/email do visitor + score atual + entity + faixa
//   - Componentes R/F/V com valores e cálculo (RFV)
//   - Critérios disparados + ICP Fit + composição Engagement+Bonus (Critérios/Híbrido)
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
    const model = d.activeModel || 'rfv';
    return `
      ${this._modelBadge(model)}
      ${model === 'rfv' ? this._componentsCard(d.components, d.weights) : ''}
      ${(model === 'criteria' || model === 'hybrid') ? this._criteriaCard(d.criteria) : ''}
      ${(model === 'criteria' || model === 'hybrid') ? this._fitCard(d.criteria?.fit) : ''}
      ${this._scoreFlowCard(d.score, d.visitor)}
      ${this._countsCard(d.counts)}
      ${this._tagsCard(d.items.tags || [])}
      ${this._touchpointsCard(d.items.touchpoints || [])}
      ${this._eventsCard(d.items.events || [])}
      ${this._transitionsCard(d.items.transitions || [])}
      ${this._campaignScoresCard(d.campaignScores || [])}
    `;
  },

  // V34.9.13 — Card do ICP Fit HubSpot-puro: TIER (1/2/3) em destaque.
  // 2 modos: 'percentage' (% match → tier) ou 'rules' (regras explícitas).
  _fitCard(fit) {
    if (!fit || (fit.totalFields === 0 && !fit.rulesTrace)) return '';
    const pct = Number(fit.fit_percentage || 0);
    const tier = fit.tier;
    const matched = Number(fit.matchedFields || 0);
    const total = Number(fit.totalFields || 0);
    const tierMethod = fit.tierMethod || 'percentage';
    const tierMap = {
      1: { label: 'Tier 1', sublabel: 'Best fit', color: 'emerald', icon: 'crown' },
      2: { label: 'Tier 2', sublabel: 'Medium fit', color: 'amber', icon: 'medal' },
      3: { label: 'Tier 3', sublabel: 'Low fit', color: 'slate', icon: 'circle-dashed' }
    };
    const t = tier ? tierMap[tier] : { label: 'Sem tier', sublabel: 'Nenhuma regra casou', color: 'slate', icon: 'circle-off' };
    return `<div class="rounded-2xl bg-white border border-slate-200 p-5">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest">ICP Fit</h4>
          <span class="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 text-[9px] font-black">
            <i data-lucide="${tierMethod === 'rules' ? 'shield-check' : 'percent'}" class="w-2.5 h-2.5"></i>
            ${tierMethod === 'rules' ? 'Por regras' : 'Por % match'}
          </span>
        </div>
        <div class="text-right">
          <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-${t.color}-100 border-2 border-${t.color}-300">
            <i data-lucide="${t.icon}" class="w-4 h-4 text-${t.color}-700"></i>
            <span class="text-lg font-black text-${t.color}-900">${t.label}</span>
            <span class="text-[10px] font-bold text-${t.color}-700">· ${t.sublabel}</span>
          </div>
          ${total > 0 ? `<p class="text-[10px] text-slate-500 mt-1">${pct}% · ${matched} / ${total} campo(s) batem</p>` : ''}
        </div>
      </div>
      ${total > 0 ? `<div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-3">
        <div class="h-full bg-${t.color}-500" style="width: ${pct}%"></div>
      </div>` : ''}
      ${tierMethod === 'rules' && fit.rulesTrace ? this._rulesTraceBlock(fit.rulesTrace) : ''}
      ${tierMethod === 'percentage' && Array.isArray(fit.breakdown) && fit.breakdown.length ? `
        <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Comparação campo a campo:</p>
        <div class="space-y-1.5 max-h-48 overflow-y-auto">
          ${fit.breakdown.map(b => `<div class="flex items-center gap-2 p-2 rounded-lg ${b.match ? 'bg-emerald-50 border border-emerald-100' : 'bg-slate-50 border border-slate-200'} text-xs">
            <i data-lucide="${b.match ? 'check-circle-2' : 'circle'}" class="w-3.5 h-3.5 ${b.match ? 'text-emerald-600' : 'text-slate-400'}"></i>
            <span class="font-black text-slate-900 capitalize">${Utils.escape(String(b.field))}</span>
            <span class="text-[10px] text-slate-500">Esperado:</span>
            <span class="text-[10px] font-bold text-slate-700 truncate">${Utils.escape(Array.isArray(b.expected) ? b.expected.join(', ') : String(b.expected))}</span>
            <span class="text-[10px] text-slate-400 ml-auto">Atual: ${Utils.escape(String(b.actual ?? '—'))}</span>
          </div>`).join('')}
        </div>
      ` : ''}
      <p class="text-[10px] text-slate-500 mt-3 italic">Tier é indicador paralelo ao score — não soma nem multiplica pontos (HubSpot-style).</p>
    </div>`;
  },

  _rulesTraceBlock(trace) {
    if (!trace) return '';
    if (trace.reason === 'sem_regras' || trace.reason === 'nenhuma_regra_casou') {
      return `<div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600 italic">${trace.reason === 'sem_regras' ? 'Nenhuma regra de tier cadastrada.' : 'Nenhuma regra casou com este lead.'}</div>`;
    }
    return `<div class="rounded-xl bg-emerald-50 border border-emerald-200 p-3 mb-2">
      <p class="text-[10px] font-black text-emerald-800 uppercase tracking-widest mb-1.5">Tier ${trace.matchedTier} casou no grupo ${trace.matchedGroupIndex + 1}</p>
      <div class="space-y-1">
        ${(trace.conditions || []).map(c => `<div class="text-xs flex items-center gap-1.5 ${c.match ? 'text-emerald-900' : 'text-slate-500'}">
          <i data-lucide="${c.match ? 'check' : 'x'}" class="w-3 h-3"></i>
          <span class="font-bold">${Utils.escape(String(c.cond.field))}</span>
          <span class="text-[10px]">${Utils.escape(String(c.cond.op))}</span>
          <span class="font-mono text-[10px]">${Utils.escape(Array.isArray(c.cond.value) ? c.cond.value.join(', ') : String(c.cond.value ?? ''))}</span>
        </div>`).join('')}
      </div>
    </div>`;
  },

  // V34.9.10.4 — Badge no topo identificando qual modelo está ativo
  _modelBadge(model) {
    const map = {
      rfv: { label: 'Modelo RFV', desc: 'Recência × Frequência × Volume', color: 'violet' },
      criteria: { label: 'Modelo Critérios', desc: 'Soma de pontos por regra', color: 'amber' },
      hybrid: { label: 'Modelo Híbrido', desc: 'Média RFV + Critérios', color: 'emerald' }
    };
    const m = map[model] || map.rfv;
    return `<div class="rounded-2xl bg-${m.color}-50 border-2 border-${m.color}-200 p-3 flex items-center gap-2">
      <i data-lucide="gauge" class="w-4 h-4 text-${m.color}-700"></i>
      <span class="text-sm font-black text-${m.color}-900">${m.label}</span>
      <span class="text-xs text-${m.color}-700">· ${m.desc}</span>
    </div>`;
  },

  // V34.9.10.6 — Card do modelo Critérios HubSpot puro:
  // pontos diretos + subtotais por categoria + lista de regras disparadas
  _criteriaCard(c) {
    if (!c) return '';
    const cat = c.byCategory || {};
    const catLabels = { engagement: 'Engajamento', fit: 'Fit (ICP)', intent: 'Intenção', uncategorized: 'Sem categoria' };
    const catColors = { engagement: 'sky', fit: 'violet', intent: 'emerald', uncategorized: 'slate' };
    return `<div class="rounded-2xl bg-white border border-slate-200 p-5">
      <div class="flex items-center justify-between mb-3">
        <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest">Cálculo Critérios</h4>
        <div class="text-right">
          <p class="text-2xl font-black text-amber-700">${c.totalPoints >= 0 ? '+' : ''}${c.totalPoints || 0} pts</p>
          <p class="text-[10px] text-slate-500">${c.hits || 0} regra(s) disparou</p>
        </div>
      </div>

      ${Object.keys(cat).some(k => cat[k]) ? `
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          ${['engagement', 'fit', 'intent', 'uncategorized'].filter(k => cat[k]).map(k => `<div class="rounded-xl bg-${catColors[k]}-50 border border-${catColors[k]}-200 p-2 text-center">
            <p class="text-[9px] font-black text-${catColors[k]}-700 uppercase tracking-widest">${catLabels[k]}</p>
            <p class="text-lg font-black text-${catColors[k]}-900">${cat[k] >= 0 ? '+' : ''}${cat[k]}</p>
          </div>`).join('')}
        </div>
      ` : ''}

      ${Array.isArray(c.breakdown) && c.breakdown.length ? `
        <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Regras disparadas:</p>
        <div class="space-y-1.5 max-h-48 overflow-y-auto">
          ${c.breakdown.map(b => `<div class="flex items-center gap-2 p-2 rounded-lg bg-amber-50 border border-amber-100 text-xs">
            <span class="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-black">${Utils.escape(b.type)}</span>
            <span class="font-bold text-slate-700 truncate flex-1">${Utils.escape(b.param || '(qualquer)')}</span>
            ${b.category ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-${catColors[b.category] || 'slate'}-100 text-${catColors[b.category] || 'slate'}-700 font-black">${catLabels[b.category]}</span>` : ''}
            <span class="font-black text-amber-700">${b.points >= 0 ? '+' : ''}${b.points}</span>
          </div>`).join('')}
        </div>
      ` : '<p class="text-xs text-slate-500 italic">Nenhuma regra disparou para esse lead.</p>'}
    </div>`;
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
    const model = s.model || 'rfv';
    // V34.9.10.6 — Modo Critérios: HubSpot puro, mostra só pontos diretos.
    if (model === 'criteria') {
      return `<div class="rounded-2xl bg-white border border-slate-200 p-5">
        <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-3">Score Final</h4>
        <div class="flex items-center justify-between">
          <span class="text-slate-700 font-black">Total de pontos:</span>
          <strong class="text-3xl font-black text-amber-700">${s.final >= 0 ? '+' : ''}${s.final} pts</strong>
        </div>
        <p class="text-[11px] text-slate-500 mt-2">Modelo Critérios (HubSpot): pontos diretos, sem normalização nem hierarquia.</p>
      </div>`;
    }
    // RFV e Hybrid mantêm normalização + clamp
    const formulaLabel = model === 'hybrid' ? '(RFV + Critérios) ÷ 2 =' : 'R×pR + F×pF + V×pV =';
    return `<div class="rounded-2xl bg-white border border-slate-200 p-5">
      <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-3">Cálculo final do score</h4>
      <div class="space-y-2 text-sm font-mono">
        <div class="flex justify-between"><span class="text-slate-600">${formulaLabel}</span><strong>${s.raw01}</strong></div>
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
