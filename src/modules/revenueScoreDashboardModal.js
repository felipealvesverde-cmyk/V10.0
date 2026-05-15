// V19 — Revenue Score Dashboard Modal
// Reescrito sobre LeadScoringV2: Fit/Intent split, Tier A/B/C/D, Accounts B2B,
// confidence banner, drift alert, cohort, calibration curve, recycling alerts,
// outcome marking, hand-off ações.
window.RevenueScoreDashboardModal = {
  render() {
    if (!App.state.showRevenueScoreDashboard) return '';
    const campaignId = App.state.revenueScoreDashboardCampaignId;
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    if (!campaign) return '';
    const blueprint = RevenueScoreEngine.getBlueprint(campaign.id);
    if (!blueprint) return '';
    const result = window.LeadScoringV2 ? LeadScoringV2.classifyCampaign(campaign.id) : null;
    if (!result?.ok) return '';
    const insights = RevenueScoreInsights.generate(campaign.id);
    return `<div class="fixed inset-0 z-[90] bg-slate-950/85 backdrop-blur-sm p-4 overflow-auto grid place-items-start justify-items-center">
      <div class="rounded-[2rem] overflow-hidden shadow-2xl text-white" style="width:94vw;max-width:1500px;background: radial-gradient(circle at 18% 8%, rgba(99,102,241,.22), transparent 32%), radial-gradient(circle at 82% 0%, rgba(56,189,248,.18), transparent 32%), #071326;">
        ${this._header(campaign, blueprint, result)}
        <div class="p-5 lg:p-6 space-y-5 overflow-auto" style="max-height:82vh;">
          ${this._driftBanner(result)}
          ${this._confidenceBanner(result)}
          ${this._pendingDispatchBanner(campaign.id, result)}
          ${this._recyclingBanner(result)}
          ${this._topActionsCard(insights, campaign.id)}
          ${this._twoScoreCards(result)}
          ${this._profileCard(blueprint)}
          ${this._tierBreakdown(result)}
          ${blueprint.segment !== 'B2C' ? this._accountsCard(result) : ''}
          ${this._cohortCard(result)}
          ${this._calibrationCard(campaign.id, result)}
          ${this._insightsBlock(insights)}
          ${this._leadsList(campaign.id, result)}
        </div>
      </div>
      ${window.LeadDetailModal ? LeadDetailModal.render() : ''}
    </div>`;
  },

  _header(campaign, blueprint, result) {
    return `<header class="p-5 border-b border-white/10 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1"><i data-lucide="target" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Revenue Score · ${Utils.escape(blueprint.segment || '—')}</p></div>
        <h2 class="text-2xl font-black">${Utils.escape(campaign.name)}</h2>
        <p class="text-xs text-slate-300 mt-1">Blueprint v${blueprint.version || 1} · ${result.summary.total} leads · ${result.summary.accounts} account(s)</p>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="Actions.openRevenueScoreCreator(${campaign.id}, true)" class="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-black flex items-center gap-1"><i data-lucide="edit-3" class="w-3.5 h-3.5"></i> Editar</button>
        <button onclick="Actions.closeRevenueScoreDashboard()" class="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-semibold flex items-center gap-2"><i data-lucide="x" class="w-4 h-4"></i> Fechar</button>
      </div>
    </header>`;
  },

  _driftBanner(result) {
    if (!result.drift?.drift) return '';
    return `<div class="rounded-3xl bg-amber-500/15 border border-amber-400/30 p-4 flex items-start gap-3">
      <i data-lucide="alert-triangle" class="w-5 h-5 text-amber-200 mt-0.5"></i>
      <div>
        <p class="font-black text-amber-100">Concept drift detectado</p>
        <p class="text-[11px] text-amber-100/80">Distribuição de scores mudou ${result.drift.meanDelta}% na média e ${result.drift.stdDelta}% no desvio vs baseline. Revisite o blueprint ou recalibre.</p>
      </div>
    </div>`;
  },

  _confidenceBanner(result) {
    const s = result.summary;
    if (!s.total) return '';
    const conf = s.avgConfidence;
    const tone = conf >= 60 ? { bg: 'bg-emerald-500/15', border: 'border-emerald-400/30', text: 'text-emerald-100', label: 'Leitura confiável' }
      : conf >= 30 ? { bg: 'bg-amber-500/15', border: 'border-amber-400/30', text: 'text-amber-100', label: 'Leitura parcial' }
      : { bg: 'bg-red-500/15', border: 'border-red-400/30', text: 'text-red-100', label: 'Leitura insuficiente' };
    const ths = result.thresholds;
    const thsBadge = ths.source === 'dynamic'
      ? `<span class="text-[10px] font-black opacity-80">Thresholds dinâmicos · A≥${ths.A} · B≥${ths.B} · C≥${ths.C}</span>`
      : '<span class="text-[10px] font-black opacity-80">Thresholds floor (poucos leads p/ calibrar)</span>';
    return `<div class="rounded-3xl ${tone.bg} border ${tone.border} ${tone.text} p-4">
      <div class="flex items-start gap-3">
        <i data-lucide="gauge" class="w-5 h-5 mt-0.5"></i>
        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between gap-3 mb-1">
            <p class="font-black">${tone.label} · ${conf}%</p>
            ${thsBadge}
          </div>
          <div class="w-full h-1.5 rounded-full bg-white/10 overflow-hidden mb-2"><div class="h-full bg-current opacity-70" style="width:${conf}%;"></div></div>
          <p class="text-[11px] opacity-90">${s.partialCount} parcial(is) · ${s.coldCount} cold start · 2+ sinais detectados são necessários para leitura plena.</p>
        </div>
      </div>
    </div>`;
  },

  _pendingDispatchBanner(campaignId, result) {
    const triggered = (App.state.revenueReadyTriggered || {})[campaignId] || {};
    const pending = (result.classified || []).filter(c => c.revenueReady && !triggered[this._leadKey(c.lead)]);
    if (!pending.length) return '';
    return `<div class="rounded-3xl bg-emerald-500/15 border border-emerald-400/30 p-4 flex items-start justify-between gap-3">
      <div class="flex items-start gap-3">
        <i data-lucide="flame" class="w-5 h-5 text-emerald-200 mt-0.5"></i>
        <div>
          <p class="font-black text-emerald-100">${pending.length} lead(s) Revenue Ready aguardando hand-off</p>
          <p class="text-[11px] text-emerald-100/80">Disparar tarefa estruturada (com Tier, Fit, Intent, MEDDIC, motivos) via provider operacional ativo.</p>
        </div>
      </div>
      <button onclick="Actions.dispatchRevenueReadyTasks(${campaignId})" class="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black flex items-center gap-2 whitespace-nowrap" style="color:#fff!important;"><i data-lucide="send" class="w-3.5 h-3.5"></i> Hand-off ${pending.length}</button>
    </div>`;
  },

  _recyclingBanner(result) {
    if (!window.LeadRecyclingEngine) return '';
    const stale = LeadRecyclingEngine.detectStale(result.classified);
    if (!stale.length) return '';
    return `<div class="rounded-3xl bg-rose-500/15 border border-rose-400/30 p-4 flex items-start gap-3">
      <i data-lucide="recycle" class="w-5 h-5 text-rose-200 mt-0.5"></i>
      <div>
        <p class="font-black text-rose-100">${stale.length} lead(s) ultrapassaram o SLA do stage atual</p>
        <p class="text-[11px] text-rose-100/80">Reciclar para nurture acelera limpeza do funil. Veja a lista abaixo na seção de leads.</p>
      </div>
    </div>`;
  },

  _topActionsCard(insights, campaignId) {
    const top = insights.topActions || [];
    if (!top.length) return '';
    return `<div class="rounded-3xl bg-gradient-to-br from-indigo-500/15 to-sky-500/10 border border-indigo-400/30 p-5">
      <div class="flex items-center gap-2 mb-3"><i data-lucide="zap" class="w-4 h-4 text-indigo-200"></i><p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Próximas ações · RevOps AI</p></div>
      <div class="grid md:grid-cols-3 gap-3">
        ${top.map((i, idx) => {
          const isConnect = i.action === 'Conectar';
          return `<div class="rounded-2xl bg-white/[0.06] border border-white/15 p-3">
            <div class="flex items-center justify-between gap-2 mb-1.5">
              <div class="w-6 h-6 rounded-lg bg-indigo-500/30 text-indigo-100 grid place-items-center text-[10px] font-black">${idx + 1}</div>
              ${isConnect ? '' : `<span class="px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-[10px] font-black text-slate-200">${Utils.escape(i.action || '—')}</span>`}
            </div>
            <p class="text-xs text-slate-200">${Utils.escape(i.text)}${isConnect ? ` <button onclick="Actions.openConnectLeadsForCampaign(${campaignId})" class="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500 hover:bg-indigo-600 text-white text-[10px] font-black align-middle" style="color:#fff!important;"><i data-lucide="link" class="w-2.5 h-2.5"></i> Conectar</button>` : ''}</p>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  _twoScoreCards(result) {
    const s = result.summary;
    return `<div class="grid md:grid-cols-2 gap-3">
      <div class="rounded-3xl bg-white/[0.05] border border-white/10 p-5">
        <div class="flex items-center gap-2 mb-2"><i data-lucide="user-check" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Fit médio (quem é o lead)</p></div>
        <p class="text-4xl font-black mb-2">${s.avgFit}%</p>
        ${RevenueScoreDashboard.progressBar(s.avgFit, 'indigo')}
        <p class="text-[11px] text-slate-400 mt-2">Descriptive · estável · hierarquia de pesos por segmento.</p>
      </div>
      <div class="rounded-3xl bg-white/[0.05] border border-white/10 p-5">
        <div class="flex items-center gap-2 mb-2"><i data-lucide="activity" class="w-4 h-4 text-sky-300"></i><p class="text-[11px] font-black text-sky-200 uppercase tracking-wider">Intent médio (o que está fazendo)</p></div>
        <p class="text-4xl font-black mb-2">${s.avgIntent}%</p>
        ${RevenueScoreDashboard.progressBar(s.avgIntent, 'sky')}
        <p class="text-[11px] text-slate-400 mt-2">Predictive · dinâmico · decay por tipo de sinal.</p>
      </div>
    </div>`;
  },

  _profileCard(bp) {
    return `<div class="rounded-3xl bg-white/[0.05] border border-white/10 p-5">
      <div class="flex items-center gap-2 mb-2"><i data-lucide="user-check" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Perfil ideal</p></div>
      <p class="text-base text-white mb-3">${Utils.escape(bp.profileSummary || '—')}</p>
      ${(bp.fitFactors || []).length ? `<div class="flex flex-wrap gap-2 mb-3">${bp.fitFactors.map(f => `<span class="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-black text-slate-200">${Utils.escape(f)}</span>`).join('')}</div>` : ''}
      ${(bp.importantSignals || []).length ? `<div class="mb-3"><p class="text-[10px] font-black text-indigo-200 uppercase tracking-wider mb-1.5">Sinais positivos</p><div class="flex flex-wrap gap-2">${bp.importantSignals.map((s, i) => {
        const isExplicit = window.IcpConversationFlow?.isExplicit?.(s);
        const cls = isExplicit ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100' : 'bg-indigo-500/20 border-indigo-400/40 text-indigo-100';
        return `<span class="px-2.5 py-1 rounded-full border text-[11px] font-black ${cls}">${i + 1}. ${Utils.escape(s)}${isExplicit ? ' · forte' : ''}</span>`;
      }).join('')}</div></div>` : ''}
      ${(bp.negativeSignals || []).length ? `<div><p class="text-[10px] font-black text-rose-200 uppercase tracking-wider mb-1.5">Sinais negativos (subtraem)</p><div class="flex flex-wrap gap-2">${bp.negativeSignals.map(s => `<span class="px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-400/30 text-rose-100 text-[11px] font-black">${Utils.escape(s)}</span>`).join('')}</div></div>` : ''}
    </div>`;
  },

  _tierBreakdown(result) {
    const t = result.summary.tier || { A: 0, B: 0, C: 0, D: 0 };
    const total = (t.A + t.B + t.C + t.D) || 1;
    const pct = (n) => Math.round((n / total) * 100);
    return `<div class="rounded-3xl bg-white/[0.05] border border-white/10 p-5">
      <div class="flex items-center justify-between mb-3"><p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Tier breakdown (A → D)</p><span class="text-[10px] text-slate-400">${total} leads</span></div>
      <div class="grid md:grid-cols-4 gap-3">
        ${['A','B','C','D'].map(tier => {
          const meta = TierEngine.meta(tier);
          const count = t[tier] || 0;
          return `<div class="rounded-2xl bg-white/[0.04] border border-white/10 p-3">
            <div class="flex items-center justify-between mb-1">
              <span class="text-2xl font-black text-${meta.tone}-200">${tier}</span>
              <span class="text-[11px] text-slate-400">${count} (${pct(count)}%)</span>
            </div>
            <p class="text-[10px] font-black text-${meta.tone}-200">${Utils.escape(meta.label.split(' · ')[1] || meta.label)}</p>
            <p class="text-[10px] text-slate-400 mt-0.5">${Utils.escape(meta.sla)}</p>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  _accountsCard(result) {
    const accounts = (result.accounts || []).filter(a => a.domain).sort((a, b) => b.accountScore - a.accountScore).slice(0, 10);
    if (!accounts.length) return '';
    return `<div class="rounded-3xl bg-white/[0.05] border border-white/10 p-5">
      <div class="flex items-center gap-2 mb-3"><i data-lucide="building-2" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Top accounts (B2B)</p></div>
      <div class="space-y-2">${accounts.map(a => this._accountRow(a)).join('')}</div>
    </div>`;
  },

  _accountRow(a) {
    const bg = window.BuyingGroupEngine ? BuyingGroupEngine.assess(a) : { risk: 'low', missingRoles: [] };
    const riskTone = bg.risk === 'high' ? 'bg-red-500/20 text-red-200 border-red-400/40' : bg.risk === 'medium' ? 'bg-amber-500/20 text-amber-200 border-amber-400/40' : 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40';
    return `<div class="rounded-2xl bg-black/30 border border-white/10 p-3 grid grid-cols-[1fr_auto_auto_auto] items-center gap-3">
      <div class="min-w-0">
        <p class="font-black text-white text-sm truncate">${Utils.escape(a.domain)}</p>
        <p class="text-[10px] text-slate-400 truncate">${a.leadCount} lead(s) · roles: ${a.roles.length ? a.roles.join(', ') : '—'}</p>
      </div>
      <div class="text-right"><p class="text-[10px] text-slate-400">Fit</p><p class="text-sm font-black">${a.accountFit}%</p></div>
      <div class="text-right"><p class="text-[10px] text-slate-400">Intent</p><p class="text-sm font-black">${a.accountIntent}%</p></div>
      <span class="px-2 py-1 rounded-full ${riskTone} border text-[10px] font-black whitespace-nowrap">${a.accountScore}%</span>
    </div>`;
  },

  _cohortCard(result) {
    if (!window.CohortEngine) return '';
    const cohorts = CohortEngine.group(result.classified);
    if (cohorts.length < 2) return '';
    return `<div class="rounded-3xl bg-white/[0.05] border border-white/10 p-5">
      <div class="flex items-center gap-2 mb-3"><i data-lucide="calendar-range" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Cohort por mês</p></div>
      <div class="overflow-auto"><table class="w-full text-xs">
        <thead><tr class="text-slate-400"><th class="text-left p-2">Mês</th><th class="text-right p-2">Leads</th><th class="text-right p-2">Fit</th><th class="text-right p-2">Intent</th><th class="text-right p-2">Rev. ready</th><th class="text-right p-2">Conversão</th></tr></thead>
        <tbody>${cohorts.map(c => `<tr class="border-t border-white/5">
          <td class="p-2 font-black text-white">${Utils.escape(c.cohort)}</td>
          <td class="p-2 text-right">${c.total}</td>
          <td class="p-2 text-right">${c.avgFit}%</td>
          <td class="p-2 text-right">${c.avgIntent}%</td>
          <td class="p-2 text-right">${c.revenueReady}</td>
          <td class="p-2 text-right">${c.conversionRate == null ? '—' : `${c.conversionRate}%`}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`;
  },

  _calibrationCard(campaignId, result) {
    if (!window.CalibrationCurveEngine) return '';
    const curve = CalibrationCurveEngine.curveForCampaign(campaignId, result.classified);
    const hasData = curve.some(b => b.conversionRate !== null);
    if (!hasData) {
      return `<div class="rounded-3xl bg-white/[0.04] border border-dashed border-white/15 p-4 text-center text-[11px] text-slate-400">
        <i data-lucide="line-chart" class="w-4 h-4 inline mr-1"></i>
        Calibration curve precisa de leads com outcome marcado. Marque conversões na lista abaixo para começar a aferir o modelo.
      </div>`;
    }
    return `<div class="rounded-3xl bg-white/[0.05] border border-white/10 p-5">
      <div class="flex items-center gap-2 mb-3"><i data-lucide="line-chart" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Calibration curve · score vs conversão real</p></div>
      <div class="grid grid-cols-4 gap-3">${curve.map(b => `<div class="rounded-2xl bg-white/[0.04] border border-white/10 p-3">
        <p class="text-[10px] font-black text-slate-400">${Utils.escape(b.label)}</p>
        <p class="text-xs text-slate-300 mt-1">esperado: ${b.expectedRate}%</p>
        <p class="text-xl font-black text-white mt-1">${b.conversionRate == null ? '—' : `${b.conversionRate}%`}</p>
        <p class="text-[10px] text-slate-400">${b.won}/${b.won + b.lost} convertidos</p>
      </div>`).join('')}</div>
    </div>`;
  },

  _insightsBlock(insightsResult) {
    const insights = insightsResult.insights || [];
    if (!insights.length) return '';
    return `<div class="rounded-3xl bg-white/[0.05] border border-white/10 p-5">
      <div class="flex items-center gap-2 mb-3"><i data-lucide="sparkles" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Insights · RevOps AI</p></div>
      <div class="space-y-2">${insights.map(i => {
        const tone = RevenueScoreDashboard.insightTone(i.tone);
        return `<div class="rounded-2xl ${tone.bg} border ${tone.border} p-3 flex items-start gap-2"><i data-lucide="${tone.icon}" class="w-4 h-4 mt-0.5 ${tone.text} shrink-0"></i><p class="text-xs ${tone.text}">${Utils.escape(i.text)}</p></div>`;
      }).join('')}</div>
    </div>`;
  },

  _leadsList(campaignId, result) {
    const list = (result.classified || []).slice().sort((a, b) => b.revenueScore - a.revenueScore).slice(0, 25);
    if (!list.length) {
      return `<div class="rounded-3xl bg-white/[0.04] border border-dashed border-white/15 p-6 text-center text-slate-300"><p class="text-sm">Nenhum lead nesta campanha ainda.</p></div>`;
    }
    return `<div class="rounded-3xl bg-white/[0.05] border border-white/10 p-5">
      <p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider mb-3">Top 25 leads — clique no outcome para marcar conversão</p>
      <div class="space-y-2">${list.map(c => this._leadRow(campaignId, c)).join('')}</div>
    </div>`;
  },

  _leadRow(campaignId, c) {
    const tierMeta = TierEngine.meta(c.tier);
    const outcome = window.OutcomeTracker ? OutcomeTracker.get(this._leadKey(c.lead), campaignId) : null;
    const trend = c.trend || { icon: 'arrow-right', label: '→', tone: 'slate' };
    const stale = window.LifecycleEngine?.isStale(c.lead);
    const topReason = (c.reasons?.positive || [])[0];
    const reasonTip = topReason ? `${topReason.label}: +${topReason.points}` : 'Sem evidência';
    const detailKey = String(this._leadKey(c.lead)).replace(/'/g, '&#39;');
    return `<div class="rounded-2xl bg-black/30 border border-white/10 hover:bg-black/40 transition p-3" title="${Utils.escape(reasonTip)}">
      <div class="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto] items-center gap-3">
        <div class="min-w-0 cursor-pointer" onclick="Actions.openLeadDetailModal(${campaignId}, ${c.actionId}, '${detailKey}')" title="Clique para editar tags, MEDDIC e detalhes do lead">
          <div class="flex items-center gap-1.5"><p class="font-black text-white text-sm truncate hover:text-indigo-200">${Utils.escape(c.lead?.name || c.lead?.email || 'Lead')}</p>
          <i data-lucide="edit-3" class="w-3 h-3 text-slate-500"></i>
          <i data-lucide="${trend.icon}" class="w-3 h-3 text-${trend.tone}-300"></i>
          ${c.coldStart ? '<span class="px-1 rounded bg-slate-400/20 text-slate-300 text-[9px] font-black border border-slate-400/30">cold start</span>' : ''}
          ${stale ? '<span class="px-1 rounded bg-rose-400/20 text-rose-300 text-[9px] font-black border border-rose-400/30">stale</span>' : ''}
          </div>
          <p class="text-[10px] text-slate-400 truncate">${Utils.escape(c.lead?.email || '')} · ${Utils.escape(c.lead?.lifecycleStage || 'subscriber')} · stage há ${LifecycleEngine.daysInStage(c.lead) ?? '?'}d ${topReason ? ` · ${Utils.escape(topReason.label)}` : ''}</p>
        </div>
        <div class="text-right"><p class="text-[10px] text-slate-400">Fit</p><p class="text-sm font-black">${c.fit}%</p></div>
        <div class="text-right"><p class="text-[10px] text-slate-400">Intent</p><p class="text-sm font-black">${c.intent}%</p></div>
        <div class="text-right"><p class="text-[10px] text-slate-400">Conf</p><p class="text-sm font-black">${c.confidence}%</p></div>
        <span class="px-2.5 py-1 rounded-full bg-${tierMeta.tone}-500/20 text-${tierMeta.tone}-200 border border-${tierMeta.tone}-400/40 text-[10px] font-black whitespace-nowrap flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full ${tierMeta.dot}"></span>Tier ${c.tier}</span>
        ${this._outcomeWidget(campaignId, c, outcome)}
      </div>
    </div>`;
  },

  _outcomeWidget(campaignId, c, outcome) {
    const key = this._leadKey(c.lead);
    if (!key) return '<span></span>';
    if (outcome && outcome.outcome !== 'in-progress') {
      const tone = outcome.outcome === 'won' ? 'bg-emerald-500/30 text-emerald-100 border-emerald-400/50'
        : outcome.outcome === 'lost' ? 'bg-red-500/30 text-red-100 border-red-400/50'
        : 'bg-slate-500/30 text-slate-100 border-slate-400/50';
      return `<button onclick="Actions.markLeadOutcome('${Utils.escape(key)}', ${campaignId}, 'in-progress')" class="px-2 py-1 rounded-lg ${tone} border text-[10px] font-black whitespace-nowrap" title="Clique para limpar">${Utils.escape(outcome.outcome)}</button>`;
    }
    return `<div class="flex items-center gap-1">
      <button onclick="Actions.markLeadOutcome('${Utils.escape(key)}', ${campaignId}, 'won')" class="px-1.5 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-400/30 text-emerald-200 text-[9px] font-black" title="Marcar como ganha">✓</button>
      <button onclick="Actions.markLeadOutcome('${Utils.escape(key)}', ${campaignId}, 'lost')" class="px-1.5 py-1 rounded bg-red-500/15 hover:bg-red-500/30 border border-red-400/30 text-red-200 text-[9px] font-black" title="Marcar como perdida">✗</button>
    </div>`;
  },

  _leadKey(lead) {
    return String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
  }
};
