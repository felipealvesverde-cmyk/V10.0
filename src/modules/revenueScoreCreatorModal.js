// V18.1 — Revenue Score Creator Modal (paleta indigo + Djow conversacional)
// Auto-advance em single-choice (200ms); 4 gatilhos Djow: welcome,
// short-answer warning, transition, closing. Pergunta de sinais negativos
// no fim. Sinais explícitos marcados visualmente.
window.RevenueScoreCreatorModal = {
  render() {
    if (!App.state.showRevenueScoreCreator) return '';
    const ctx = App.state.revenueScoreCreatorCtx || {};
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(ctx.campaignId));
    if (!campaign) return '';
    const segment = ctx.answers?.segment || null;
    const totalSteps = segment ? IcpConversationFlow.totalSteps(segment) : 5;
    const stepIdx = Number(ctx.stepIndex || 0);
    const isReview = stepIdx >= totalSteps;
    return `<div class="fixed inset-0 z-[90] bg-slate-950/85 backdrop-blur-sm p-4 overflow-auto grid place-items-start justify-items-center">
      <div class="rounded-[2rem] overflow-hidden shadow-2xl text-white" style="width:92vw;max-width:960px;background: radial-gradient(circle at 18% 8%, rgba(99,102,241,.25), transparent 32%), radial-gradient(circle at 82% 0%, rgba(56,189,248,.18), transparent 32%), #071326;">
        ${this._header(campaign, ctx, isReview, totalSteps)}
        ${isReview ? this._review(campaign, ctx) : this._stepBody(campaign, ctx, stepIdx)}
      </div>
    </div>`;
  },

  _header(campaign, ctx, isReview, totalSteps) {
    const stepNum = Math.min(Number(ctx.stepIndex || 0) + 1, totalSteps);
    return `<header class="p-5 border-b border-white/10 flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1"><i data-lucide="sparkles" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Djow · ICP Intelligence</p></div>
        <h2 class="text-xl font-black">${ctx.editing ? 'Editar' : 'Criar'} Revenue Score · ${Utils.escape(campaign.name)}</h2>
        <p class="text-xs text-slate-300 mt-1">${isReview ? 'Revisão final · pronto para gerar o Blueprint' : `Passo ${stepNum} de ${totalSteps} — descoberta guiada`}</p>
      </div>
      <button onclick="Actions.cancelRevenueScoreCreator()" class="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-semibold flex items-center gap-2"><i data-lucide="x" class="w-4 h-4"></i> Cancelar</button>
    </header>`;
  },

  _stepBody(campaign, ctx, stepIdx) {
    const segment = ctx.answers?.segment || null;
    const question = IcpConversationFlow.questionAt(segment, stepIdx);
    if (!question) return '<div class="p-5 text-slate-300">Pergunta não encontrada.</div>';
    const totalSteps = segment ? IcpConversationFlow.totalSteps(segment) : 5;
    return `<div class="p-6 lg:p-8 grid lg:grid-cols-[1fr_300px] gap-5">
      <div>
        ${this._progressDots(stepIdx, totalSteps)}
        <h3 class="text-2xl lg:text-3xl font-black mt-4 mb-5 leading-tight">${Utils.escape(question.label)}</h3>
        ${this._renderQuestion(question, ctx)}
        ${this._navButtons(ctx, stepIdx, totalSteps, question)}
      </div>
      ${this._djowSide(ctx, question)}
    </div>`;
  },

  _progressDots(stepIdx, total) {
    return `<div class="flex items-center gap-1.5">${Array.from({ length: total }, (_, i) => {
      const filled = i <= stepIdx;
      return `<div class="${filled ? 'bg-indigo-400' : 'bg-white/15'} ${i === stepIdx ? 'w-8' : 'w-4'} h-1.5 rounded-full transition-all"></div>`;
    }).join('')}</div>`;
  },

  _renderQuestion(question, ctx) {
    const answer = (ctx.answers || {})[question.id];
    if (question.type === 'single') {
      return `<div class="grid grid-cols-2 md:grid-cols-3 gap-2">${question.options.map(opt => {
        const selected = answer === opt;
        return `<button onclick="Actions.answerRevenueScoreQuestion('${question.id}', '${Utils.escape(opt).replace(/'/g, '&#39;')}', 'single')" class="px-4 py-3 rounded-2xl text-sm font-black border transition ${selected ? 'bg-indigo-500/30 border-indigo-400/60 text-indigo-50' : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10'}">${Utils.escape(opt)}</button>`;
      }).join('')}</div>`;
    }
    if (question.type === 'multi') {
      const selected = Array.isArray(answer) ? answer : [];
      const isNegative = question.id === 'negativeSignals';
      const segment = ctx.answers?.segment || 'B2B';
      const customs = window.IcpConversationFlow ? IcpConversationFlow.customOptionsFor(question.id, segment) : [];
      const allOptions = [...question.options, ...customs];
      const canAddCustom = ['qualificationSignals', 'interestSignals', 'negativeSignals', 'relevantTriggers'].includes(question.id);
      return `<div class="grid grid-cols-2 md:grid-cols-3 gap-2">${allOptions.map(opt => {
        const on = selected.includes(opt);
        const isCustom = customs.includes(opt);
        const isExplicit = !isNegative && window.IcpConversationFlow?.isExplicit?.(opt);
        const onCls = isNegative
          ? 'bg-rose-500/30 border-rose-400/60 text-rose-50'
          : (isExplicit ? 'bg-emerald-500/30 border-emerald-400/60 text-emerald-50' : 'bg-indigo-500/30 border-indigo-400/60 text-indigo-50');
        const explicitBadge = (isExplicit && !on) ? '<span class="ml-1.5 text-[9px] px-1 rounded bg-emerald-400/20 text-emerald-200 border border-emerald-300/40">forte</span>' : '';
        const customBadgeCls = isNegative ? 'bg-rose-400/20 text-rose-200 border-rose-300/40' : 'bg-sky-400/20 text-sky-200 border-sky-300/40';
        const customBadge = (isCustom && !on) ? `<span class="ml-1.5 text-[9px] px-1 rounded ${customBadgeCls} border">custom</span>` : '';
        return `<button onclick="Actions.answerRevenueScoreQuestion('${question.id}', '${Utils.escape(opt).replace(/'/g, '&#39;')}', 'multi')" class="px-4 py-3 rounded-2xl text-sm font-black border transition flex items-center justify-center gap-0.5 ${on ? onCls : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10'}">${on ? '✓ ' : ''}${Utils.escape(opt)}${explicitBadge}${customBadge}</button>`;
      }).join('')}
      </div>
      <p class="text-[11px] text-slate-400 mt-2">${isNegative ? 'Marque os sinais que indicam que esse lead provavelmente NÃO converte. Opcional, mas ajuda muito.' : 'Sinais marcados como <b class="text-emerald-300">forte</b> pesam mais. <b class="text-sky-300">Custom</b> são os que você adicionou. Você pode marcar múltiplos.'} ${selected.length} selecionado(s).</p>
      ${canAddCustom ? this._customSignalRow(question.id, segment, isNegative) : ''}`;
    }
    if (question.type === 'text-with-suggestions') {
      return `<div class="space-y-3">
        <input value="${Utils.escape(answer || '')}" oninput="Actions.answerRevenueScoreQuestion('${question.id}', this.value, 'text')" placeholder="Responda com suas palavras..." class="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-white/15 text-white text-sm font-semibold placeholder:text-slate-500" autofocus />
        <div>
          <p class="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Sugestões</p>
          <div class="flex flex-wrap gap-2">${question.suggestions.map(s => `<button onclick="Actions.answerRevenueScoreQuestion('${question.id}', '${Utils.escape(s).replace(/'/g, '&#39;')}', 'text')" class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-slate-200 text-xs font-black">${Utils.escape(s)}</button>`).join('')}</div>
        </div>
      </div>`;
    }
    if (question.type === 'multi-text') {
      // Aceita string velha (backwards-compat) e array novo.
      const arr = Array.isArray(answer) ? answer : (answer ? [String(answer)] : []);
      const inputId = `mt_${question.id}`;
      return `<div class="space-y-3">
        <div class="flex flex-wrap gap-2 min-h-[36px]">
          ${arr.length ? arr.map(v => `<span class="px-2.5 py-1.5 rounded-lg bg-indigo-500/30 border border-indigo-400/60 text-indigo-50 text-sm font-black flex items-center gap-1.5"><span>${Utils.escape(v)}</span><button onclick="Actions.answerRevenueScoreQuestion('${question.id}', '${Utils.escape(v).replace(/'/g, '&#39;')}', 'multi')" class="text-indigo-200 hover:text-white" title="Remover">×</button></span>`).join('') : '<span class="text-[11px] text-slate-400 italic self-center">Marque sugestões ou digite as suas próprias respostas abaixo.</span>'}
        </div>
        <div>
          <p class="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Sugestões · clique para alternar</p>
          <div class="flex flex-wrap gap-2">${question.suggestions.map(s => {
            const on = arr.includes(s);
            return `<button onclick="Actions.answerRevenueScoreQuestion('${question.id}', '${Utils.escape(s).replace(/'/g, '&#39;')}', 'multi')" class="px-3 py-1.5 rounded-lg text-xs font-black border transition ${on ? 'bg-indigo-500/30 border-indigo-400/60 text-indigo-100' : 'bg-white/5 border-white/15 text-slate-200 hover:bg-white/10'}">${on ? '✓ ' : ''}${Utils.escape(s)}</button>`;
          }).join('')}</div>
        </div>
        <div>
          <p class="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Outro · digite e pressione Enter</p>
          <div class="flex gap-2">
            <input id="${inputId}" type="text" placeholder="Ex: outra dor específica que vc viu na operação..." class="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-semibold placeholder:text-slate-500" onkeydown="if(event.key==='Enter'){Actions.addRevenueScoreMultiText('${question.id}', '${inputId}'); event.preventDefault();}" />
            <button onclick="Actions.addRevenueScoreMultiText('${question.id}', '${inputId}')" class="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-black" style="color:#fff!important;">+ Adicionar</button>
          </div>
        </div>
        <p class="text-[11px] text-slate-400">${arr.length} selecionado(s). Em qualquer match, o lead recebe o peso cheio dessa dimensão (não soma duplo).</p>
      </div>`;
    }
    if (question.type === 'number') {
      const val = answer == null ? '' : Number(answer);
      return `<div class="space-y-2">
        <input type="number" min="${question.min || 1}" max="${question.max || 9999}" value="${val}" oninput="Actions.answerRevenueScoreQuestion('${question.id}', Number(this.value || 0), 'text')" placeholder="${Utils.escape(question.placeholder || '')}" class="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-white/15 text-white text-sm font-semibold placeholder:text-slate-500" autofocus />
        <p class="text-[11px] text-slate-400">${Utils.escape(question.placeholder || '')}</p>
      </div>`;
    }
    return '<p class="text-slate-300">Tipo de pergunta não suportado.</p>';
  },

  _navButtons(ctx, stepIdx, totalSteps, question) {
    const answer = (ctx.answers || {})[question.id];
    const hasAnswer = question.optional
      ? true
      : (question.type === 'multi' || question.type === 'multi-text')
        ? (Array.isArray(answer) ? answer.length > 0 : Boolean(String(answer || '').trim()))
        : Boolean(String(answer || '').trim());
    const nextLabel = stepIdx + 1 >= totalSteps ? 'Revisar →' : 'Continuar →';
    const skipLabel = question.optional && (!Array.isArray(answer) || !answer.length) ? 'Pular →' : nextLabel;
    return `<div class="flex justify-between items-center mt-6">
      ${stepIdx > 0 ? '<button onclick="Actions.previousRevenueScoreStep()" class="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-black">← Voltar</button>' : '<span></span>'}
      <button ${hasAnswer ? '' : 'disabled'} onclick="Actions.nextRevenueScoreStep()" class="px-5 py-3 rounded-xl ${hasAnswer ? 'bg-indigo-500 hover:bg-indigo-600 text-white' : 'bg-white/5 text-slate-500 cursor-not-allowed'} text-sm font-black flex items-center gap-2" ${hasAnswer ? 'style="color:#fff!important;"' : ''}>${skipLabel}</button>
    </div>`;
  },

  _djowSide(ctx, question) {
    const messages = Array.isArray(ctx.djowMessages) ? ctx.djowMessages : [];
    const tip = IcpIntelligenceAgent.contextualTip(question.id, ctx.answers || {});
    return `<aside class="rounded-2xl bg-white/[0.05] border border-white/10 p-4 flex flex-col" style="min-height:380px;max-height:520px;">
      <div class="flex items-center gap-2 mb-3"><i data-lucide="bot" class="w-4 h-4 text-indigo-300"></i><p class="text-[10px] font-black text-indigo-200 uppercase tracking-wider">Djow</p></div>
      <div class="flex-1 overflow-auto space-y-2 pr-1">
        ${messages.map(m => this._chatBubble(m)).join('')}
      </div>
      <div class="mt-3 pt-3 border-t border-white/10">
        <p class="text-[10px] font-black text-indigo-200 uppercase tracking-wider mb-1">Dica para este passo</p>
        <p class="text-xs text-slate-300">${Utils.escape(tip)}</p>
      </div>
    </aside>`;
  },

  _chatBubble(m) {
    const tone = m.kind === 'warning'
      ? 'bg-amber-500/15 border-amber-400/30 text-amber-100'
      : m.kind === 'celebrate'
        ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-100'
        : 'bg-white/10 border-white/15 text-slate-100';
    return `<div class="px-3 py-2 rounded-2xl border text-xs whitespace-pre-wrap ${tone}">${Utils.escape(m.text)}</div>`;
  },

  // Adicionar sinal próprio inline (sem window.prompt). Para negativos, paleta
  // rose mantém coerência semântica. Auto-marca como selecionado.
  _customSignalRow(qid, segment, isNegative) {
    const inputId = `customSignal_${qid}`;
    const isTrigger = qid === 'relevantTriggers';
    const palette = isNegative
      ? { bg: 'bg-rose-500/5', border: 'border-rose-400/40', text: 'text-rose-200', btn: 'bg-rose-500 hover:bg-rose-600' }
      : { bg: 'bg-indigo-500/5', border: 'border-indigo-400/40', text: 'text-indigo-200', btn: 'bg-indigo-500 hover:bg-indigo-600' };
    const headerLabel = isNegative
      ? 'Adicionar sinal negativo próprio'
      : isTrigger
        ? 'Adicionar trigger event próprio'
        : `Adicionar sinal positivo próprio (${segment})`;
    const hint = isNegative
      ? 'Sua operação tem padrão de lead que NÃO converte? Cadastre — fica disponível pras próximas campanhas.'
      : isTrigger
        ? 'Sua operação tem evento-gatilho específico (mudança setorial, alta sazonalidade local, regulação X)? Cadastre — fica com peso 20 e half-life 180d por default.'
        : 'Sua operação tem sinal que não está na lista? Cadastre — fica disponível pras próximas campanhas do mesmo segmento.';
    const placeholder = isNegative
      ? 'Ex: Trabalha pra concorrente direto, já é cliente, sem CNPJ'
      : isTrigger
        ? 'Ex: Recebeu auditoria fiscal, Mudou de plano de saúde, Trocou de banco'
        : 'Ex: Pediu meeting via WhatsApp';
    return `<div class="mt-3 rounded-xl ${palette.bg} border border-dashed ${palette.border} p-3">
      <div class="flex items-center gap-2 mb-2">
        <i data-lucide="${isNegative ? 'shield-off' : 'plus'}" class="w-3.5 h-3.5 ${palette.text}"></i>
        <p class="text-[11px] font-black ${palette.text} uppercase tracking-wider">${Utils.escape(headerLabel)}</p>
      </div>
      <p class="text-[11px] text-slate-400 mb-2">${Utils.escape(hint)}</p>
      <div class="flex gap-2">
        <input id="${inputId}" type="text" placeholder="${Utils.escape(placeholder)}" class="flex-1 px-3 py-2.5 rounded-xl bg-slate-900 border border-white/15 text-white text-sm font-semibold placeholder:text-slate-500" onkeydown="if(event.key==='Enter'){Actions.addCustomScoreSignalFromInput('${qid}', '${inputId}'); event.preventDefault();}" />
        <button onclick="Actions.addCustomScoreSignalFromInput('${qid}', '${inputId}')" class="px-4 py-2.5 rounded-xl ${palette.btn} text-white text-xs font-black flex items-center gap-1 whitespace-nowrap" style="color:#fff!important;"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Cadastrar</button>
      </div>
    </div>`;
  },

  // Mapeia signal positivo → tags do RD/CSV. Opcional, mas resolve o problema
  // do matcher fuzzy. Aliases ficam em ctx.answers.tagAliases[signal] = [tag, ...]
  _tagAliasesBlock(ctx, blueprint) {
    const signals = blueprint.importantSignals || [];
    if (!signals.length) return '';
    const aliases = ctx.answers?.tagAliases || {};
    return `<div class="rounded-2xl bg-sky-500/10 border border-sky-400/30 p-5">
      <div class="flex items-start gap-2 mb-3">
        <i data-lucide="link" class="w-4 h-4 text-sky-300 mt-0.5"></i>
        <div>
          <p class="text-[11px] font-black text-sky-200 uppercase tracking-wider">Mapear tags do meu sistema (opcional)</p>
          <p class="text-[11px] text-sky-100/80">Como o seu RD/CSV chama esses sinais? Ex: signal <b>Pedir orçamento</b> = tag <b>demo_solicitada</b>. Pular = matcher fuzzy (menos preciso).</p>
        </div>
      </div>
      <div class="space-y-2">${signals.map(s => this._tagAliasRow(s, aliases[s] || [])).join('')}</div>
    </div>`;
  },

  _tagAliasRow(signal, tagList) {
    const inputId = `alias_${signal.replace(/[^a-z0-9]/gi, '_')}`;
    return `<div class="rounded-xl bg-black/30 border border-white/10 p-3">
      <p class="text-xs font-black text-white mb-2">${Utils.escape(signal)}</p>
      <div class="flex flex-wrap gap-1.5 mb-2">
        ${tagList.length ? tagList.map(t => `<span class="px-2 py-1 rounded bg-sky-500/20 border border-sky-400/40 text-sky-100 text-[11px] font-black flex items-center gap-1.5"><span>${Utils.escape(t)}</span><button onclick="Actions.removeTagAlias('${Utils.escape(signal).replace(/'/g, '&#39;')}', '${Utils.escape(t).replace(/'/g, '&#39;')}')" class="text-sky-200 hover:text-white">×</button></span>`).join('') : '<span class="text-[11px] text-slate-400 italic">Sem aliases — usa matcher fuzzy.</span>'}
      </div>
      <div class="flex gap-2">
        <input id="${inputId}" type="text" placeholder="ex: pediu_orcamento, demo_request" class="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-white/15 text-white text-xs placeholder:text-slate-500" onkeydown="if(event.key==='Enter'){Actions.addTagAliasFromInput('${Utils.escape(signal).replace(/'/g, '&#39;')}', '${inputId}'); event.preventDefault();}" />
        <button onclick="Actions.addTagAliasFromInput('${Utils.escape(signal).replace(/'/g, '&#39;')}', '${inputId}')" class="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 text-white text-xs font-black" style="color:#fff!important;">+ Tag</button>
      </div>
    </div>`;
  },

  _review(campaign, ctx) {
    const blueprint = IcpBlueprintGenerator.generate(ctx.answers || {});
    const negCount = (blueprint.negativeSignals || []).length;
    return `<div class="p-6 lg:p-8 space-y-5">
      <div class="rounded-2xl bg-white/[0.05] border border-white/10 p-5">
        <div class="flex items-center gap-2 mb-3"><i data-lucide="user-check" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Perfil ideal interpretado</p></div>
        <p class="text-base text-white">${Utils.escape(blueprint.profileSummary)}</p>
        ${blueprint.fitFactors.length ? `<div class="flex flex-wrap gap-2 mt-3">${blueprint.fitFactors.map(f => `<span class="px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[11px] font-black text-slate-200">${Utils.escape(f)}</span>`).join('')}</div>` : ''}
      </div>
      ${blueprint.importantSignals.length ? `<div class="rounded-2xl bg-white/[0.05] border border-white/10 p-5">
        <div class="flex items-center gap-2 mb-3"><i data-lucide="zap" class="w-4 h-4 text-indigo-300"></i><p class="text-[11px] font-black text-indigo-200 uppercase tracking-wider">Sinais positivos</p></div>
        <div class="flex flex-wrap gap-2">${blueprint.importantSignals.map((s, i) => {
          const isExplicit = window.IcpConversationFlow?.isExplicit?.(s);
          const cls = isExplicit ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100' : 'bg-indigo-500/20 border-indigo-400/40 text-indigo-100';
          const tag = isExplicit ? ' · <span class="text-emerald-300 font-black">forte</span>' : '';
          return `<span class="px-2.5 py-1 rounded-full border text-[11px] font-black ${cls}">${i + 1}. ${Utils.escape(s)}${tag}</span>`;
        }).join('')}</div>
      </div>` : ''}
      ${negCount ? `<div class="rounded-2xl bg-white/[0.05] border border-white/10 p-5">
        <div class="flex items-center gap-2 mb-3"><i data-lucide="shield-off" class="w-4 h-4 text-rose-300"></i><p class="text-[11px] font-black text-rose-200 uppercase tracking-wider">Sinais negativos (subtraem)</p></div>
        <div class="flex flex-wrap gap-2">${blueprint.negativeSignals.map(s => `<span class="px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-400/30 text-rose-100 text-[11px] font-black">${Utils.escape(s)}</span>`).join('')}</div>
      </div>` : ''}
      ${this._tagAliasesBlock(ctx, blueprint)}
      <div class="rounded-2xl bg-emerald-500/10 border border-emerald-400/30 p-4 text-[12px] text-emerald-100 flex items-start gap-2">
        <i data-lucide="shield-check" class="w-4 h-4 mt-0.5 shrink-0"></i>
        <p>O Djow vai gerar internamente <b>Fit Score</b>, <b>Engagement Score</b> e <b>Confidence Score</b>. Engajamento sofre decay temporal (sinal antigo vale menos). Thresholds são dinâmicos por campanha. Você não configura pesos.</p>
      </div>
      <div class="flex flex-wrap justify-between items-center gap-3">
        <button onclick="Actions.previousRevenueScoreStep()" class="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm font-black">← Voltar e ajustar</button>
        <button onclick="Actions.commitRevenueScoreBlueprint()" style="color:#fff!important;" class="px-5 py-3 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-black flex items-center gap-2"><i data-lucide="check-circle-2" class="w-4 h-4"></i> ${ctx.editing ? 'Atualizar' : 'Criar'} Revenue Score</button>
      </div>
    </div>`;
  }
};
