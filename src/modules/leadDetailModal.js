// V19.1 — Lead Detail Modal
// Permite editar manualmente: tags (chip editor com add/remove), buyingRole,
// lifecycleStage, outcome, MEDDIC fields. Tudo opcional, persistido no lead
// dentro de App.state.actions[*].leads[*].
window.LeadDetailModal = {
  render() {
    if (!App.state.showLeadDetailModal) return '';
    const ctx = App.state.leadDetailContext;
    if (!ctx) return '';
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(ctx.actionId));
    if (!action) return '';
    const lead = (action.leads || []).find(l => this._key(l) === ctx.leadKey);
    if (!lead) return '';
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(ctx.campaignId));
    return `<div class="fixed inset-0 z-[95] bg-slate-950/85 backdrop-blur-sm p-4 overflow-auto grid place-items-start justify-items-center">
      <div class="rounded-[2rem] overflow-hidden shadow-2xl text-white" style="width:92vw;max-width:920px;background: radial-gradient(circle at 18% 8%, rgba(99,102,241,.22), transparent 32%), #071326;">
        ${this._header(lead, campaign, action)}
        <div class="p-5 lg:p-6 space-y-5 overflow-auto" style="max-height:80vh;">
          ${this._identitySection(ctx, lead)}
          ${this._personaSection(ctx, lead, campaign)}
          ${this._tagsSection(ctx, lead)}
          ${this._classificationSection(ctx, lead)}
          ${this._triggerEventsSection(ctx, lead, campaign)}
          ${this._meddicSection(ctx, lead, campaign)}
          ${this._historySection(ctx, lead, campaign)}
        </div>
      </div>
    </div>`;
  },

  _header(lead, campaign, action) {
    return `<header class="p-5 border-b border-white/10 flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1"><i data-lucide="user" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Detalhes do lead</p></div>
        <h2 class="text-2xl font-black">${Utils.escape(lead.name || lead.email || 'Lead')}</h2>
        <p class="text-xs text-slate-300 mt-1">${Utils.escape(lead.email || '—')} · campanha: <b class="text-white">${Utils.escape(campaign?.name || '—')}</b> · ação: <b class="text-white">${Utils.escape(action.name || '—')}</b></p>
      </div>
      <button onclick="Actions.closeLeadDetailModal()" class="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-semibold flex items-center gap-2"><i data-lucide="x" class="w-4 h-4"></i> Fechar</button>
    </header>`;
  },

  _identitySection(ctx, lead) {
    return `<section class="rounded-3xl bg-white/[0.05] border border-white/10 p-4 space-y-3">
      <p class="text-[10px] font-black text-indigo-200 uppercase tracking-wider">Identidade</p>
      <div class="grid md:grid-cols-2 gap-3">
        ${this._textInput('name', 'Nome', lead.name, ctx)}
        ${this._textInput('email', 'Email', lead.email, ctx)}
        ${this._textInput('phone', 'Telefone', lead.phone, ctx)}
        ${this._textInput('companyDomain', 'Domínio da empresa', lead.companyDomain, ctx, 'auto-extraído do email se vazio')}
      </div>
    </section>`;
  },

  _tagsSection(ctx, lead) {
    const tags = this._tagList(lead);
    return `<section class="rounded-3xl bg-white/[0.05] border border-white/10 p-4 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <div>
          <p class="text-[10px] font-black text-indigo-200 uppercase tracking-wider">Tags</p>
          <p class="text-[11px] text-slate-400">Tags alimentam Fit + Intent. Adicione livremente — sales pode marcar durante ligação.</p>
        </div>
        <span class="text-xs font-black text-slate-300">${tags.length}</span>
      </div>
      <div class="flex flex-wrap gap-2">
        ${tags.length ? tags.map(t => `<span class="px-2.5 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-400/40 text-indigo-100 text-xs font-black flex items-center gap-2"><span>${Utils.escape(t)}</span><button onclick="Actions.removeLeadTag('${ctx.leadKey}', '${Utils.escape(t).replace(/'/g, '&#39;')}')" class="text-indigo-200 hover:text-white" title="Remover">×</button></span>`).join('') : '<p class="text-xs text-slate-400 italic">Sem tags ainda.</p>'}
      </div>
      <div class="flex gap-2">
        <input id="leadTagInput" type="text" placeholder="Adicione uma tag (ex: pediu_orcamento) e pressione Enter" class="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-semibold placeholder:text-slate-500" onkeydown="if(event.key==='Enter'){Actions.addLeadTagFromInput('${ctx.leadKey}'); event.preventDefault();}" />
        <button onclick="Actions.addLeadTagFromInput('${ctx.leadKey}')" class="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-black" style="color:#fff!important;">+ Adicionar</button>
      </div>
    </section>`;
  },

  _classificationSection(ctx, lead) {
    const stages = window.LifecycleEngine ? LifecycleEngine.STAGES : [];
    const roles = window.BuyingGroupEngine ? BuyingGroupEngine.ROLES : ['decisor','champion','user','blocker','influencer'];
    const outcome = lead.outcome || 'in-progress';
    return `<section class="rounded-3xl bg-white/[0.05] border border-white/10 p-4 space-y-3">
      <p class="text-[10px] font-black text-indigo-200 uppercase tracking-wider">Classificação manual</p>
      <div class="grid md:grid-cols-3 gap-3">
        <div>
          <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Lifecycle stage</label>
          <select onchange="Actions.setLeadLifecycleStage('${ctx.leadKey}', ${ctx.campaignId}, this.value)" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-semibold" style="color-scheme:dark;">
            ${stages.map(s => `<option value="${s.id}" ${lead.lifecycleStage === s.id ? 'selected' : ''}>${Utils.escape(s.label)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Buying role</label>
          <select onchange="Actions.setLeadBuyingRole('${ctx.leadKey}', this.value)" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-semibold" style="color-scheme:dark;">
            <option value="">— sem papel —</option>
            ${roles.map(r => `<option value="${r}" ${lead.buyingRole === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Outcome (conversão)</label>
          <select onchange="Actions.markLeadOutcome('${ctx.leadKey}', ${ctx.campaignId}, this.value)" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-semibold" style="color-scheme:dark;">
            ${['in-progress','won','lost','no-decision'].map(o => `<option value="${o}" ${outcome === o ? 'selected' : ''}>${o}</option>`).join('')}
          </select>
        </div>
      </div>
    </section>`;
  },

  _personaSection(ctx, lead, campaign) {
    const blueprint = campaign ? RevenueScoreEngine?.getBlueprint(campaign.id) : null;
    const segment = blueprint?.segment || null;
    const revenueOpts = window.IcpConversationFlow?.ORDERED_REVENUE_BANDS || [];
    const incomeOpts = window.IcpConversationFlow?.ORDERED_INCOME_BANDS || [];
    const awarenessOpts = window.IcpConversationFlow?.AWARENESS_LEVELS || [];
    const showB2B = !segment || segment === 'B2B' || segment === 'Ambos';
    const showB2C = !segment || segment === 'B2C' || segment === 'Ambos';
    return `<section class="rounded-3xl bg-white/[0.05] border border-white/10 p-4 space-y-3">
      <p class="text-[10px] font-black text-indigo-200 uppercase tracking-wider">Persona expandida</p>
      <div class="grid md:grid-cols-2 gap-3">
        ${this._textInput('jobTitle', 'Cargo / Job title', lead.jobTitle, ctx, 'Ex: CMO, Diretor Comercial')}
        ${this._textInput('industry', 'Indústria / vertical', lead.industry, ctx, 'Ex: SaaS, Varejo')}
        ${this._textInput('geography', 'Geografia', lead.geography, ctx, 'Ex: SP, Sul, América Latina')}
        ${showB2B ? this._enumSelect('companyRevenue', 'Faturamento da empresa', revenueOpts, lead.companyRevenue, ctx) : ''}
        ${showB2C ? this._enumSelect('income', 'Renda / poder aquisitivo', incomeOpts, lead.income, ctx) : ''}
        ${this._enumSelect('awarenessLevel', 'Awareness do lead', awarenessOpts, lead.awarenessLevel, ctx)}
      </div>
    </section>`;
  },

  _triggerEventsSection(ctx, lead, campaign) {
    if (!window.TriggerEventEngine) return '';
    const blueprint = campaign ? RevenueScoreEngine?.getBlueprint(campaign.id) : null;
    const segment = blueprint?.segment || 'Ambos';
    const baseCatalog = segment === 'B2C' ? TriggerEventEngine.CATALOG.B2C
      : segment === 'Ambos' ? TriggerEventEngine.flatCatalog()
      : TriggerEventEngine.CATALOG.B2B;
    // V20.1 — triggers custom cadastrados pelo usuário aparecem também
    const customLabels = (App.state.customScoreSignals?.triggers) || [];
    const customTriggers = customLabels.map(label => ({ id: `custom_${label}`, label, halfLifeDays: 180, weight: 20, custom: true }));
    const catalog = [...baseCatalog, ...customTriggers];
    const events = Array.isArray(lead.triggerEvents) ? lead.triggerEvents : [];
    return `<section class="rounded-3xl bg-white/[0.05] border border-white/10 p-4 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <div>
          <p class="text-[10px] font-black text-indigo-200 uppercase tracking-wider">Trigger events</p>
          <p class="text-[11px] text-slate-400">Eventos-gatilho ativam intent. Decay automático por tipo (cargo dura mais, scroll menos).</p>
        </div>
        <span class="text-xs font-black text-slate-300">${events.length}</span>
      </div>
      <div class="space-y-2">
        ${events.length ? events.map((e, i) => {
          const meta = TriggerEventEngine.metaFor(e.kind || e.label || e.event);
          const days = e.ts ? Math.round((Date.now() - new Date(e.ts).getTime()) / (24 * 3600 * 1000)) : 0;
          return `<div class="rounded-xl bg-black/30 border border-white/10 p-2.5 flex items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="text-xs font-black text-white truncate">${Utils.escape(meta?.label || e.label || e.event || 'Evento')}</p>
              <p class="text-[10px] text-slate-400">há ${days}d · half-life ${meta?.halfLifeDays || '—'}d</p>
            </div>
            <button onclick="Actions.removeLeadTriggerEvent('${ctx.leadKey}', ${i})" class="px-2 py-1 rounded bg-red-500/10 border border-red-400/30 text-red-300 text-[10px] font-black">×</button>
          </div>`;
        }).join('') : '<p class="text-[11px] text-slate-400 italic">Nenhum evento-gatilho registrado.</p>'}
      </div>
      <div>
        <select id="triggerEventSelect_${ctx.leadKey}" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-semibold" style="color-scheme:dark;">
          <option value="">— escolher evento —</option>
          ${catalog.map(t => `<option value="${t.id}">${Utils.escape(t.label)}</option>`).join('')}
        </select>
        <button onclick="Actions.addLeadTriggerEvent('${ctx.leadKey}', 'triggerEventSelect_${ctx.leadKey}')" class="mt-2 w-full px-3 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-black flex items-center justify-center gap-1" style="color:#fff!important;"><i data-lucide="plus" class="w-3 h-3"></i> Registrar evento agora</button>
      </div>
    </section>`;
  },

  _enumSelect(field, label, options, value, ctx) {
    return `<div>
      <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">${Utils.escape(label)}</label>
      <select onchange="Actions.updateLeadField('${ctx.leadKey}', '${field}', this.value)" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-semibold" style="color-scheme:dark;">
        <option value="">—</option>
        ${options.map(o => `<option value="${Utils.escape(o)}" ${value === o ? 'selected' : ''}>${Utils.escape(o)}</option>`).join('')}
      </select>
    </div>`;
  },

  _meddicSection(ctx, lead, campaign) {
    const blueprint = campaign ? RevenueScoreEngine?.getBlueprint(campaign.id) : null;
    if (blueprint?.segment === 'B2C' || !window.MeddicEngine) return '';
    const meddic = lead.meddic || MeddicEngine.emptyData();
    const completeness = MeddicEngine.completeness(meddic);
    return `<section class="rounded-3xl bg-white/[0.05] border border-white/10 p-4 space-y-3">
      <div class="flex items-center justify-between gap-2">
        <div>
          <p class="text-[10px] font-black text-indigo-200 uppercase tracking-wider">MEDDIC · qualificação B2B</p>
          <p class="text-[11px] text-slate-400">Preencher dá boost de até +12 pts no fit total. Sales chega no lead com contexto.</p>
        </div>
        <span class="px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-200 border border-indigo-400/40 text-[11px] font-black">${completeness}% completo</span>
      </div>
      <div class="grid md:grid-cols-2 gap-3">
        ${MeddicEngine.FIELDS.map(f => `<div>
          <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">${Utils.escape(f.label)}</label>
          <textarea oninput="Actions.updateLeadMeddic('${ctx.leadKey}', '${f.key}', this.value)" placeholder="Resposta curta…" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white text-xs font-semibold placeholder:text-slate-500" rows="2" style="color-scheme:dark;">${Utils.escape(meddic[f.key] || '')}</textarea>
        </div>`).join('')}
      </div>
    </section>`;
  },

  _historySection(ctx, lead, campaign) {
    if (!campaign || !window.ScoreHistoryEngine) return '';
    const history = ScoreHistoryEngine.historyFor(lead, campaign.id);
    if (history.length < 2) return '';
    return `<section class="rounded-3xl bg-white/[0.05] border border-white/10 p-4">
      <p class="text-[10px] font-black text-indigo-200 uppercase tracking-wider mb-2">Histórico de score (${history.length} pontos)</p>
      <div class="grid grid-cols-${Math.min(history.length, 12)} gap-1 items-end" style="height:60px;">
        ${history.map(h => {
          const pct = Math.max(2, Number(h.revenueScore || 0));
          return `<div class="flex flex-col items-center justify-end" title="${Utils.escape(new Date(h.ts).toLocaleString('pt-BR'))}: ${h.revenueScore}%">
            <div class="w-full rounded-t bg-indigo-400/60" style="height:${pct}%;"></div>
          </div>`;
        }).join('')}
      </div>
    </section>`;
  },

  _textInput(field, label, value, ctx, hint) {
    return `<div>
      <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">${Utils.escape(label)}</label>
      <input value="${Utils.escape(value || '')}" oninput="Actions.updateLeadField('${ctx.leadKey}', '${field}', this.value)" class="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-semibold placeholder:text-slate-500" />
      ${hint ? `<p class="text-[10px] text-slate-500 mt-1">${Utils.escape(hint)}</p>` : ''}
    </div>`;
  },

  _tagList(lead) {
    const raw = Array.isArray(lead?.tags) ? lead.tags : String(lead?.tags || '').split(/[,;]/);
    return raw.map(t => String(t).trim().replace(/^#/, '')).filter(Boolean);
  },

  _key(lead) {
    return String(lead?.email || lead?.id || lead?.name || '').toLowerCase().trim();
  }
};
