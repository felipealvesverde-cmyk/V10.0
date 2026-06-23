// V36.12.0 — Djow lateral do painel RevOps (DRE).
//
// Painel sticky à direita do DRE com chat compacto: cliente descreve em PT
// o que quer ("Lara ganha 5 por venda", "3% do faturamento", "ISS 5%"),
// Djow propõe fórmula + botão "Aplicar" preenche o input da linha
// selecionada. Sem LLM por ora — motor local com padrões regex.
// Quando Felipe pedir mais inteligência, plugamos /api/djow-revops-formula
// via ai-resolver (memória feedback_ai_resolver_dual_path).
//
// State:
//   revopsDjowMessages: [{ role:'user'|'djow', text, suggestion? }, ...]
//   revopsDjowSelectedLine: { productId, lineId, afterStep } | null
//   revopsDjowInput: '' (controlado)
//
// Actions: selectDjowRevopsLine, askDjowRevops, applyDjowRevopsSuggestion,
//          clearDjowRevopsHistory, updateDjowRevopsInput

window.DjowRevOpsPanel = {

  render(productId, tabId) {
    // V36.14.1 — Persiste tabId no state pra _intro saber o contexto.
    if (App.state.revopsDjowTabContext !== tabId) {
      App.state.revopsDjowTabContext = tabId;
    }
    // V40.12.4 — Sprint 5: persiste productId pro _intro e _adaptiveHint usarem.
    if (App.state.revopsDjowProductId !== productId) {
      App.state.revopsDjowProductId = productId;
    }
    const messages = Array.isArray(App.state.revopsDjowMessages) ? App.state.revopsDjowMessages : [];
    const selected = App.state.revopsDjowSelectedLine;
    const inputVal = App.state.revopsDjowInput || '';
    const stepLabel = selected ? this._stepLabel(selected.afterStep) : null;

    // V40.12.4 — Sprint 5: badge do arquétipo no header.
    // V40.13.0 — Ganha cor semântica do arquétipo (texto colorido sobre fundo
    // branco — destaca contra o gradient violet+fuchsia do header sem competir).
    const arch = window.AudienceConsumerEngine
      ? AudienceConsumerEngine.getArchetype(productId)
      : null;
    const archKey = window.AudienceConsumerEngine
      ? AudienceConsumerEngine.getArchetypeKey(productId)
      : null;
    const accent = window.AudienceConsumerEngine
      ? AudienceConsumerEngine.getAccent(productId)
      : '#64748B';
    const archHeaderBadge = arch && archKey
      ? `<span class="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/95 text-[9px] font-black uppercase tracking-widest" style="color: ${accent};" title="${Utils.escape(arch.tagline || '')}"><i data-lucide="target" class="w-2.5 h-2.5"></i>${Utils.escape(arch.label || '')}</span>`
      : '';

    return `<div class="rounded-3xl border-2 border-violet-200 shadow-md overflow-hidden flex flex-col" style="background:#f5f3f0;color-scheme:light;max-height:calc(100vh - 6rem);">
      <!-- V40.13.0 — Faixa topo do arquétipo (pele adaptativa). -->
      ${arch && archKey ? `<div class="h-1" style="background: ${accent};" title="Arquétipo: ${Utils.escape(arch.label || '—')}"></div>` : ''}
      <header class="bg-gradient-to-br from-violet-600 to-fuchsia-600 px-4 py-3 flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-white/20 border border-white/30 grid place-items-center shrink-0">
          <i data-lucide="sparkles" class="w-4 h-4 text-white"></i>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-[9px] font-black text-violet-100 uppercase tracking-widest">Djow · ajudante de fórmulas</p>
          <h3 class="text-sm font-black text-white flex items-center gap-2 flex-wrap">Como posso te ajudar? ${archHeaderBadge}</h3>
        </div>
        ${messages.length > 0 ? `<button onclick="Actions.clearDjowRevopsHistory()" title="Limpar conversa" class="text-white/70 hover:text-white text-[10px] font-bold inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20">
          <i data-lucide="rotate-ccw" class="w-3 h-3"></i>
        </button>` : ''}
      </header>

      ${selected ? `<div class="px-4 py-2 border-b border-stone-200 bg-violet-50 flex items-center gap-2">
        <i data-lucide="link" class="w-3 h-3 text-violet-700"></i>
        <span class="text-[10px] font-black text-violet-800 uppercase tracking-widest">Linha selecionada · ${Utils.escape(stepLabel)}</span>
      </div>` : `<div class="px-4 py-2 border-b border-stone-200 bg-stone-50 flex items-center gap-2">
        <i data-lucide="mouse-pointer-2" class="w-3 h-3 text-stone-500"></i>
        <span class="text-[10px] font-bold text-stone-600 italic">Clique numa linha pra eu aplicar direto</span>
      </div>`}

      <div class="flex-1 overflow-y-auto px-3 py-3 space-y-2" style="min-height:240px;">
        ${this._intro()}
        ${messages.map((m, i) => this._messageBubble(m, i)).join('')}
      </div>

      <footer class="border-t border-stone-200 bg-white/70 p-3 space-y-2">
        <textarea
          id="lj-djow-revops-input"
          oninput="Actions.updateDjowRevopsInput(this.value)"
          onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault();Actions.askDjowRevops();}"
          placeholder="Ex: Lara ganha 5 por venda. Ou: 3% do faturamento"
          class="w-full px-3 py-2 rounded-xl bg-white border border-stone-300 text-[12px] text-slate-900 placeholder-stone-400 focus:outline-none focus:border-violet-500 resize-none"
          rows="2">${Utils.escape(inputVal)}</textarea>
        <div class="flex items-center justify-between gap-2">
          <p class="text-[10px] text-stone-500">Enter envia · Shift+Enter quebra linha</p>
          <button onclick="Actions.askDjowRevops()" ${!inputVal.trim() ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-[11px] font-black inline-flex items-center gap-1.5" style="color:#fff!important;">
            <i data-lucide="send" class="w-3 h-3"></i> Enviar
          </button>
        </div>
      </footer>
    </div>`;
  },

  _intro() {
    const selected = App.state.revopsDjowSelectedLine;
    const tabContext = App.state.revopsDjowTabContext;
    const isRevops = selected?.afterStep === 'revops_mcu' || selected?.afterStep === 'revops_msu' || tabContext === 'revops';
    const isCosts = tabContext === 'costs';
    const isResult = tabContext === 'result';
    let examples;
    if (isCosts) {
      examples = `<li>• <span class="font-mono">"6000 fixos por mês"</span> (G&A)</li>
         <li>• <span class="font-mono">"15% do faturamento"</span> (imposto)</li>
         <li>• <span class="font-mono">"5,9% do ticket"</span> (Hotmart)</li>
         <li>• <span class="font-mono">"o que é S&M?"</span> / <span class="font-mono">"diferença entre fixos e variáveis"</span></li>
         <li>• <span class="font-mono">"qual bucket pra Google Ads?"</span></li>`;
    } else if (isRevops) {
      examples = `<li>• <span class="font-mono">"Comissão Hotmart de 5,9% do ticket"</span></li>
         <li>• <span class="font-mono">"15% do MCU"</span></li>
         <li>• <span class="font-mono">"Imposto 15% sobre o ticket"</span></li>
         <li>• <span class="font-mono">"5 reais por venda"</span></li>
         <li>• <span class="font-mono">"o que é MCU?"</span> / <span class="font-mono">"explica breakeven"</span></li>`;
    } else if (isResult) {
      examples = `<li>• <span class="font-mono">"como definir meta de vendas?"</span></li>
         <li>• <span class="font-mono">"o que é um CAC saudável?"</span></li>
         <li>• <span class="font-mono">"por que meu CAC tá maior que a meta?"</span></li>
         <li>• <span class="font-mono">"diferença entre vendas previstas e realizado"</span></li>
         <li>• <span class="font-mono">"explica CTC"</span> / <span class="font-mono">"o que é faturamento bruto?"</span></li>`;
    } else {
      examples = `<li>• <span class="font-mono">"Lara ganha 5 por venda"</span></li>
         <li>• <span class="font-mono">"15% do faturamento"</span></li>
         <li>• <span class="font-mono">"ISS de 5% sobre vendas líquidas"</span></li>
         <li>• <span class="font-mono">"6000 fixos"</span></li>
         <li class="text-emerald-700 font-bold">• <span class="font-mono">"cria dedução de Parceria Fulano = 15% do faturamento"</span> ⚡</li>
         <li class="text-emerald-700 font-bold">• <span class="font-mono">"adiciona item Hotmart em variáveis = 5,9% do ticket"</span> ⚡</li>
         <li>• <span class="font-mono">"O que entra em deduções?"</span> (explico)</li>`;
    }
    // V40.12.4 — Sprint 5: hint adaptativo de tom + foco quando o produto
    // tem Audiência classificada. Aparece em cima dos exemplos pra dar
    // "modo de operar" ao Djow no contexto do negócio do cliente.
    const productId = App.state.revopsDjowProductId;
    const djowConfig = window.AudienceConsumerEngine
      ? AudienceConsumerEngine.getDjowConfig(productId)
      : null;
    // V40.13.0 — Hint adaptativo ganha pele do arquétipo (border-left do
    // accent + eyebrow na cor do accent).
    const introAccent = window.AudienceConsumerEngine
      ? AudienceConsumerEngine.getAccent(productId)
      : '#64748B';
    const adaptiveHint = djowConfig?.tone
      ? `<div class="rounded-xl bg-white border border-slate-200 p-2.5 mb-2" style="border-left: 4px solid ${introAccent};">
          <p class="text-[10px] font-black uppercase tracking-wider mb-1" style="color: ${introAccent};">Eu vou te responder com:</p>
          <p class="text-[11px] text-stone-700 leading-relaxed"><b>Tom:</b> ${Utils.escape(djowConfig.tone)}</p>
          ${djowConfig.focus ? `<p class="text-[11px] text-stone-700 leading-relaxed mt-0.5"><b>Foco:</b> ${Utils.escape(djowConfig.focus)}</p>` : ''}
        </div>`
      : '';

    return `<div class="rounded-2xl border border-violet-200 bg-violet-50/60 p-3 space-y-1.5">
      ${adaptiveHint}
      <p class="text-[11px] font-black text-violet-900 leading-snug">Quer ajuda com a fórmula ou com o preenchimento?</p>
      <p class="text-[11px] text-stone-700 leading-snug">Escreve em português que eu monto a fórmula no formato certo. Exemplos:</p>
      <ul class="text-[10px] text-stone-600 space-y-0.5 pl-3">${examples}</ul>
    </div>`;
  },

  _messageBubble(m, idx) {
    if (m.role === 'user') {
      return `<div class="flex justify-end">
        <div class="max-w-[85%] rounded-2xl rounded-tr-md bg-stone-200 px-3 py-2">
          <p class="text-[11px] text-slate-800 whitespace-pre-line leading-snug">${Utils.escape(m.text)}</p>
        </div>
      </div>`;
    }
    const sugg = m.suggestion;
    const create = m.createCommand;
    // V37.0.11 — Render markdown leve no reply (**X** → bold, `X` → code)
    const replyHtml = Utils.escape(m.text || '')
      .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-stone-100 text-[10px] font-mono text-slate-800">$1</code>');
    return `<div class="flex justify-start">
      <div class="max-w-[90%] space-y-1.5">
        <div class="rounded-2xl rounded-tl-md bg-white border border-violet-200 px-3 py-2">
          <p class="text-[11px] text-slate-800 whitespace-pre-line leading-snug">${replyHtml}</p>
        </div>
        ${sugg ? `<div class="rounded-2xl border border-violet-300 bg-violet-50 px-3 py-2 flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <p class="text-[9px] font-black text-violet-700 uppercase tracking-widest">Fórmula sugerida</p>
            <p class="text-[12px] font-mono font-black text-slate-900 mt-0.5 break-all">${Utils.escape(sugg)}</p>
          </div>
          <button onclick="Actions.applyDjowRevopsSuggestion(${idx})" class="px-2.5 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-black inline-flex items-center gap-1 shrink-0" style="color:#fff!important;">
            <i data-lucide="check" class="w-3 h-3"></i> Aplicar
          </button>
        </div>` : ''}
        ${create ? `<div class="rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-3 py-2.5 space-y-2">
          <div class="flex items-start gap-1.5">
            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-emerald-700 mt-0.5"></i>
            <div class="min-w-0 flex-1">
              <p class="text-[9px] font-black text-emerald-800 uppercase tracking-widest">Criação automática</p>
              <p class="text-[11px] text-slate-800 mt-0.5"><b>${Utils.escape(create.name)}</b></p>
              <p class="text-[10px] font-mono text-slate-700 mt-0.5 break-all">${Utils.escape(create.formula)}</p>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            <button onclick="Actions.applyDjowRevopsCreate(${idx})" ${m.createApplied ? 'disabled' : ''} class="flex-1 px-2.5 py-1.5 rounded-lg ${m.createApplied ? 'bg-stone-300 text-stone-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'} text-[10px] font-black inline-flex items-center justify-center gap-1" ${!m.createApplied ? 'style="color:#fff!important;"' : ''}>
              <i data-lucide="${m.createApplied ? 'check-check' : 'plus-circle'}" class="w-3 h-3"></i> ${m.createApplied ? 'Criado' : 'Confirmar criação'}
            </button>
            ${!m.createApplied ? `<button onclick="Actions.dismissDjowRevopsCreate(${idx})" class="px-2 py-1.5 rounded-lg bg-white border border-stone-300 hover:bg-stone-50 text-stone-600 text-[10px] font-black">
              Cancelar
            </button>` : ''}
          </div>
        </div>` : ''}
      </div>
    </div>`;
  },

  _stepLabel(afterStep) {
    const map = {
      fat_bruto: 'Após Faturamento Bruto',
      deducoes_inside: 'Deduções',
      deducoes: 'Após Deduções',
      venda_liquida: 'Após Venda Líquida',
      lucro_bruto: 'Após Lucro Bruto',
      s_m: 'Após S&M',
      g_a: 'Após G&A',
      revops_mcu: 'Composição MCU',
      revops_msu: 'Composição MSU',
      group: 'Item de grupo'
    };
    return map[afterStep] || afterStep || 'Linha extra';
  },

  // ============================================================
  // MOTOR LOCAL DE SUGESTÃO — regex-based.
  // Retorna { reply, suggestion, createCommand } a partir de pergunta livre.
  // V37.0.11 — createCommand permite autonomia pra CRIAR linha/item via comando
  // natural (não só editar fórmula de linha selecionada).
  // ============================================================
  resolve(question, ctx) {
    const q = String(question || '').trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, ''); // remove acentos
    const afterStep = ctx?.afterStep || 'deducoes_inside';

    if (!q) return { reply: 'Escreve algo que eu te ajudo.', suggestion: null };

    // V37.0.11 — Tenta intent CREATE antes de tudo. Se reconhece, retorna
    // createCommand pro UI mostrar preview + botão "Confirmar criação".
    const createCmd = this._parseCreateCommand(q);
    if (createCmd) {
      const targetLabel = this._createTargetLabel(createCmd);
      return {
        reply: `Vou criar **${createCmd.name}** em ${targetLabel} com fórmula \`${createCmd.formula}\`. Confirma?`,
        suggestion: null,
        createCommand: createCmd
      };
    }

    // Pergunta conceitual: "o que entra em deduções?" / "o que é MCU?" / "explica CAC"
    const conceptMatch = q.match(/o que (entra|vai|tem|e|eh|é) (em|nas?|um|uma|o|a)?\s*(deducoes|deducao|s.?m|s e m|sm|g.?a|g e a|ga|custos|faturamento|mcu|msu|cac|breakeven|ctc|tm|ticket|meta|vendas|realizado|previsto)/);
    if (conceptMatch) {
      return { reply: this._explainConcept(conceptMatch[3]), suggestion: null };
    }
    const explainMatch = q.match(/(?:explica|me explica|explique|o que e|o que eh)\s+(?:o|a|um|uma)?\s*(mcu|msu|cac|breakeven|ctc|tm|ticket|deducoes|deducao|s.?m|sm|g.?a|ga|custos|faturamento|meta|vendas|realizado|previsto)/);
    if (explainMatch) {
      return { reply: this._explainConcept(explainMatch[1]), suggestion: null };
    }
    // V37.0.0 — Perguntas sobre meta no contexto Resultado.
    const metaMatch = q.match(/(como\s+def|definir|setar|crav|ajusta)\w*\s+(uma\s+)?(meta|metas)/);
    if (metaMatch) {
      return { reply: this._explainConcept('meta'), suggestion: null };
    }

    // "X reais fixos" / "X por mes" / "X fixo"
    const fixedMatch = q.match(/(?:^|\s)(\d+(?:[\.,]\d+)?)\s*(?:reais|r\$|brl)?\s*(?:fixos?|por mes|por m[eê]s|mensais?)/);
    if (fixedMatch) {
      const v = fixedMatch[1].replace('.', '').replace(',', '.');
      return {
        reply: `Valor fixo: R$ ${fixedMatch[1]} por mês. Cola direto sem o "=", é literal.`,
        suggestion: String(v).replace('.', ',')
      };
    }

    // "X reais por venda" / "X por venda" / "ganha X por venda" / "X reais cada venda"
    const perSaleMatch = q.match(/(\d+(?:[\.,]\d+)?)\s*(?:reais|r\$|brl)?\s*(?:por|cada|p\/|a)\s*(venda|sale)/);
    if (perSaleMatch) {
      const v = perSaleMatch[1].replace('.', '').replace(',', '.');
      return {
        reply: `Multiplica o valor unitário pelo número de vendas (handle "vendas").`,
        suggestion: `=vendas*${v}`.replace('.', ',')
      };
    }

    // "X% do faturamento" / "X por cento do faturamento" / "X% sobre faturamento"
    const pctFaturamento = q.match(/(\d+(?:[\.,]\d+)?)\s*(?:%|por cento|porcento)\s*(?:de|do|sobre|em cima de)?\s*(?:faturamento|fat|fat\.?\s*bruto)/);
    if (pctFaturamento) {
      const pct = Number(pctFaturamento[1].replace(',', '.'));
      const dec = (pct / 100).toString().replace('.', ',');
      return {
        reply: `${pct}% sobre o Faturamento Bruto. Usa o handle "fat_bruto".`,
        suggestion: `=fat_bruto*${dec}`
      };
    }

    // "X% do ticket" / "X% sobre o ticket"
    const pctTicket = q.match(/(\d+(?:[\.,]\d+)?)\s*(?:%|por cento)\s*(?:de|do|sobre)?\s*(?:ticket|tm|ticket medio)/);
    if (pctTicket) {
      const pct = Number(pctTicket[1].replace(',', '.'));
      const dec = (pct / 100).toString().replace('.', ',');
      return {
        reply: `${pct}% sobre o Ticket Médio. Usa o handle "tm" (alias de ticket).`,
        suggestion: `=tm*${dec}`
      };
    }

    // "X% da venda liquida" / "X% sobre vendas liquidas" / "ISS de X% sobre venda liquida"
    const pctVendaLiq = q.match(/(\d+(?:[\.,]\d+)?)\s*(?:%|por cento)\s*(?:de|do|da|sobre|em cima de)?\s*(?:venda|vendas)\s*(?:liquida|liquidas|liq)/);
    if (pctVendaLiq) {
      const pct = Number(pctVendaLiq[1].replace(',', '.'));
      const dec = (pct / 100).toString().replace('.', ',');
      return {
        reply: `${pct}% sobre a Venda Líquida. Usa o handle "fat_liquido" (alias de venda_liquida).`,
        suggestion: `=fat_liquido*${dec}`
      };
    }

    // "X% do lucro bruto"
    const pctLB = q.match(/(\d+(?:[\.,]\d+)?)\s*(?:%|por cento)\s*(?:de|do|sobre)?\s*(?:lucro)\s*(?:bruto|operacional)?/);
    if (pctLB) {
      const pct = Number(pctLB[1].replace(',', '.'));
      const dec = (pct / 100).toString().replace('.', ',');
      return {
        reply: `${pct}% sobre o Lucro Bruto.`,
        suggestion: `=lucro_bruto*${dec}`
      };
    }

    // V36.14.0 — Em contexto RevOps (afterStep=revops_mcu/msu), perguntas como
    // "X% do MCU" / "X% do MSU" / "X% do CAC" viram fórmulas com esses handles.
    const isRevops = afterStep === 'revops_mcu' || afterStep === 'revops_msu';
    if (isRevops) {
      const pctMCU = q.match(/(\d+(?:[\.,]\d+)?)\s*(?:%|por cento)\s*(?:de|do|sobre)?\s*(?:mcu|margem de contribui)/);
      if (pctMCU) {
        const pct = Number(pctMCU[1].replace(',', '.'));
        const dec = (pct / 100).toString().replace('.', ',');
        return { reply: `${pct}% sobre o MCU (Margem de Contribuição Unitária).`, suggestion: `=mcu*${dec}` };
      }
      const pctMSU = q.match(/(\d+(?:[\.,]\d+)?)\s*(?:%|por cento)\s*(?:de|do|sobre)?\s*(?:msu|margem real|margem de seguran)/);
      if (pctMSU) {
        const pct = Number(pctMSU[1].replace(',', '.'));
        const dec = (pct / 100).toString().replace('.', ',');
        return { reply: `${pct}% sobre o MSU (Margem de Segurança Unitária).`, suggestion: `=msu*${dec}` };
      }
      const pctCAC = q.match(/(\d+(?:[\.,]\d+)?)\s*(?:%|por cento)\s*(?:de|do|sobre)?\s*(?:cac|custo de aquisi)/);
      if (pctCAC) {
        const pct = Number(pctCAC[1].replace(',', '.'));
        const dec = (pct / 100).toString().replace('.', ',');
        return { reply: `${pct}% sobre o CAC (Custo de Aquisição).`, suggestion: `=cac*${dec}` };
      }
    }

    // Soma de "X por venda mais Y% do faturamento" → composto
    const composite = q.match(/(\d+(?:[\.,]\d+)?)\s*(?:reais|r\$)?\s*(?:por\s*venda).*?(?:mais|\+|e)\s*(\d+(?:[\.,]\d+)?)\s*%.*?(?:faturamento|fat)/);
    if (composite) {
      const v1 = composite[1].replace(',', '.');
      const pct = Number(composite[2].replace(',', '.'));
      const dec = (pct / 100).toString().replace('.', ',');
      return {
        reply: `Composto: parte fixa por venda + parte percentual do faturamento.`,
        suggestion: `=vendas*${v1.replace('.', ',')}+fat_bruto*${dec}`
      };
    }

    return {
      reply: `Não captei. Tenta de novo nesse formato:\n• "5 por venda"\n• "15% do faturamento"\n• "3% sobre venda líquida"\n• "6000 fixos"\nOu pergunta o conceito: "o que entra em deduções?"\n\n**Também posso criar do zero:** "cria dedução de Parceria Fulano = 15% do faturamento" ou "adiciona item Hotmart em variáveis = 5,9% do ticket".`,
      suggestion: null
    };
  },

  // V37.0.11 — Parse intent CREATE: tenta extrair {kind, destino, nome,
  // fórmula} de uma frase tipo "cria dedução de Parceria Fulano = 15% do
  // faturamento" ou "adiciona item Hotmart em variáveis = 5,9% do ticket".
  // Retorna null se não é intent CREATE ou não conseguiu extrair tudo.
  _parseCreateCommand(q) {
    const verbMatch = q.match(/\b(cria|insere|adiciona|p[ôo]e|coloca|novo|nova)\b/);
    if (!verbMatch) return null;

    // Destino — primeiro reconhece o tipo de entidade.
    let target = null;
    if (/(?:no|do)\s+mcu\b|componente\s+(?:no\s+)?mcu/.test(q)) target = { kind: 'revops_component', kpi: 'mcu' };
    else if (/(?:no|do)\s+msu\b|componente\s+(?:no\s+)?msu/.test(q)) target = { kind: 'revops_component', kpi: 'msu' };
    else if (/(?:em\s+)?(?:custos?\s+)?vari[áa]vei?s?/.test(q)) target = { kind: 'revops_item', bucket: 'variable' };
    else if (/(?:em\s+)?(?:custos?\s+)?aquisi[çc][ãa]o\b/.test(q) && !/dre|dedu/.test(q)) target = { kind: 'revops_item', bucket: 'acquisition' };
    else if (/(?:em\s+)?(?:custos?\s+)?fixos?\b|(?:em\s+)?g\W?a\b/.test(q) && /(?:item|custo|categoria|despesa)/.test(q)) target = { kind: 'revops_item', bucket: 'fixed' };
    else if (/(?:em\s+)?dedu[çc][ãoõe]+s?/.test(q) || /^(?:cria|insere|adiciona|p[ôo]e|coloca|nov[oa])\s+(?:uma?\s+)?dedu[çc][ãa]o/.test(q)) target = { kind: 'dre_line', afterStep: 'deducoes_inside' };
    else if (/(?:em\s+)?s\W?m\b|(?:em\s+)?(?:linha\s+)?(?:de\s+)?marketing\b/.test(q)) target = { kind: 'dre_line', afterStep: 's_m' };
    else if (/(?:em\s+)?g\W?a\b|(?:em\s+)?fixos?\b/.test(q)) target = { kind: 'dre_line', afterStep: 'g_a' };
    if (!target) return null;

    // Fórmula — reusa heurística:
    let formula = null;
    // X% de/do/sobre <handle>
    const pctMatch = q.match(/(\d+(?:[\.,]\d+)?)\s*%\s*(?:de|do|da|sobre|em|no)\s+(faturamento\s+bruto|fat[\s_]?bruto|faturamento\s+l[íi]quido|fat[\s_]?liquido|venda\s+l[íi]quida|vendas?\s+l[íi]quidas?|ticket|tm|vendas|mcu|msu|lucro\s+bruto)/);
    if (pctMatch) {
      const v = (Number(pctMatch[1].replace('.', '').replace(',', '.')) / 100).toString().replace('.', ',');
      const handleRaw = pctMatch[2].toLowerCase().replace(/\s+/g, '_');
      const handleMap = {
        faturamento_bruto: 'fat_bruto', fat_bruto: 'fat_bruto',
        faturamento_liquido: 'fat_liquido', faturamento_líquido: 'fat_liquido', fat_liquido: 'fat_liquido', fat_líquido: 'fat_liquido',
        venda_liquida: 'fat_liquido', venda_líquida: 'fat_liquido', vendas_liquidas: 'fat_liquido', vendas_líquidas: 'fat_liquido',
        ticket: 'tm', tm: 'tm',
        vendas: 'vendas', mcu: 'mcu', msu: 'msu',
        lucro_bruto: 'lucro_bruto'
      };
      const h = handleMap[handleRaw] || 'fat_bruto';
      formula = `=${h}*${v}`;
    }
    // X por venda
    if (!formula) {
      const perSale = q.match(/(\d+(?:[\.,]\d+)?)\s*(?:reais|r\$)?\s*(?:por|cada|p\/)\s*venda/);
      if (perSale) {
        const v = perSale[1].replace('.', '').replace(',', '.');
        formula = `=vendas*${v.replace('.', ',')}`;
      }
    }
    // valor fixo (4+ dígitos sem porcento nem "por venda")
    if (!formula) {
      const fixed = q.match(/(?:=|igual|consome|gasta|equivale|por)\s+(\d{2,}(?:[\.,]\d+)?)\s*(?:reais|r\$|brl)?\s*(?:fixos?|por mes|mensais?)?(?!\s*%)/);
      if (fixed) {
        formula = fixed[1].replace('.', '').replace(',', '.').replace('.', ',');
      }
    }
    if (!formula) return null;

    // Nome — entre "de/chamada/chamado/com" e a fórmula ou conector.
    let name = null;
    // Tenta "chamada/chamado/com nome X"
    let m = q.match(/(?:chamada|chamado|com\s+nome|nomeada|nomeado)\s+(.+?)(?=\s+(?:=|igual|consome|gasta|equivale|com\s+\d|\bvai\b|\bque\b|\d))/);
    if (m) name = m[1];
    if (!name) {
      // Tenta "dedução/item/linha de NOME" (capturar até a fórmula/conector)
      m = q.match(/(?:dedu[çc][ãa]o|linha|item|custo|componente|despesa|categoria)\s+(?:de\s+|do\s+|da\s+|com\s+)?([a-z0-9à-ÿ][a-z0-9à-ÿ\s\.\-]{1,60}?)(?=\s+(?:=|igual|consome|gasta|equivale|que|\d+\s*%|\d{3,}))/);
      if (m) name = m[1];
    }
    if (!name) {
      // Última tentativa: pega 1-4 palavras antes da fórmula
      m = q.match(/([a-zà-ÿ][a-zà-ÿ\s\.\-]{2,30})(?=\s+(?:=|igual|consome|gasta|equivale|\d+\s*%))/);
      if (m) name = m[1];
    }

    // Cleanup
    if (name) {
      name = name
        .replace(/\b(?:em|no|nos|na|nas|dos|das|do|da|de|com|que|consome|gasta|equivale|igual|uma?|um|os|as|cria|insere|adiciona|p[ôo]e|coloca|novo|nova|linha|item|dedu[çc][ãa]o|custo|categoria|despesa|componente|fixos?|vari[áa]vei?s?|aquisi[çc][ãa]o|marketing|mcu|msu|s\W?m|g\W?a|dre)\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      // Title case
      if (name) {
        name = name.split(' ').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      }
    }
    if (!name || name.length < 2) name = 'Nova entrada';

    return { ...target, name, formula };
  },

  _createTargetLabel(cmd) {
    if (cmd.kind === 'revops_component') return cmd.kpi === 'mcu' ? '**MCU** (componente)' : '**MSU** (componente)';
    if (cmd.kind === 'revops_item') {
      const m = { variable: '**Custos Variáveis**', acquisition: '**Aquisição (S&M)** dos Custos', fixed: '**Fixos (G&A)** dos Custos', custom: '**Outros Custos**' };
      return m[cmd.bucket] || '**Custos**';
    }
    if (cmd.kind === 'dre_line') {
      const m = { deducoes_inside: '**Deduções** (DRE)', s_m: '**S&M (Aquisição)** (DRE)', g_a: '**G&A (Fixos)** (DRE)' };
      return m[cmd.afterStep] || '**DRE**';
    }
    return cmd.kind;
  },

  _explainConcept(key) {
    const k = String(key || '').toLowerCase().replace(/\s/g, '');
    const map = {
      deducoes: 'Em **Deduções** vão tudo que sai do faturamento ANTES da venda líquida: impostos (ICMS, ISS, PIS, COFINS), comissões de plataforma (Hotmart, Eduzz, Stripe), taxas de cartão e devoluções diretas. NÃO é custo fixo (G&A) nem custo de aquisição (S&M).',
      deducao: 'Em **Deduções** vão tudo que sai do faturamento ANTES da venda líquida: impostos (ICMS, ISS, PIS, COFINS), comissões de plataforma, taxas de cartão e devoluções diretas.',
      sm: 'Em **S&M (Aquisição)** vão custos pra trazer cliente: Google Ads, Meta Ads, time comercial (SDR/closer), ferramentas de marketing, agências. É variável com escala.',
      sem: 'Em **S&M (Aquisição)** vão custos pra trazer cliente: Google Ads, Meta Ads, time comercial, ferramentas de marketing.',
      ga: 'Em **G&A (Fixos)** vão custos que não escalam com venda: aluguel, salários de back-office, contabilidade, software de gestão, jurídico. Pagar mesmo com zero venda no mês.',
      gea: 'Em **G&A (Fixos)** vão custos que não escalam com venda: aluguel, back-office, contabilidade, software de gestão.',
      custos: 'Custos no LJ se dividem em 3 buckets: Variáveis (% sobre faturamento — viram Deduções), Aquisição (S&M) e Fixos (G&A). Cadastra em **Custos**, aparece automaticamente nas etapas certas.',
      faturamento: '**Faturamento Bruto** é o topo da DRE — receita total no período antes de qualquer subtração. Calculado como vendas × ticket médio. Vem de Ofertas + Sales Projection.',
      mcu: '**MCU = Margem de Contribuição Unitária**. Quanto sobra POR VENDA depois de tirar custos variáveis (impostos, comissões de plataforma, taxa de cartão). Fórmula auto: TM − custos variáveis unitários. Use o handle **mcu** em fórmulas.',
      msu: '**MSU = Margem de Segurança Unitária**. MCU menos CAC — quanto cada venda contribui DE VERDADE pra pagar custos fixos. É o que sobra por venda depois de tudo que escala (variáveis + aquisição). Handle **msu**.',
      cac: '**CAC = Custo de Aquisição por Cliente**. CTC (Custo Total de Conversão = soma do bucket S&M) ÷ Total de Vendas. O preço de cada cliente novo. Handle **cac**.',
      breakeven: '**Breakeven** é o ponto de equilíbrio em vendas: quantas vendas precisa fazer pra empatar o mês. Fórmula: Custo Fixo (G&A) ÷ MSU. Acima dele = lucro; abaixo = prejuízo. Handle **breakeven**.',
      ctc: '**CTC = Custo Total de Conversão**. Soma de tudo cadastrado em S&M (Aquisição). Vira input do CAC: CTC ÷ vendas.',
      tm: '**TM = Ticket Médio**. Preço médio ponderado por venda. Vem da aba Ofertas baseado em mix e preços. Handle **tm** (também aceita **ticket**).',
      ticket: '**Ticket Médio** vem da aba Ofertas. Preço médio ponderado: cada oferta tem preço × mix (% das vendas), soma ponderada = TM. Handle **tm** ou **ticket**.',
      meta: '**Meta** é seu compromisso do mês. Pra **Vendas**, o alvo é realizado ≥ meta (mais é melhor — emerald). Pra **CAC**, o alvo é realizado ≤ meta (gastar menos por cliente — emerald). O snapshot mensal congela a meta vigente, então auditoria depois compara meta × realizado.',
      vendas: '**Vendas** no LJ têm 2 fontes. (1) **Previstas** = input no header do produto, alimenta a cascata RevOps (CAC, MCU, breakeven). (2) **Realizadas** = lidas do funil das ações (convertidos). A aba Resultado cruza meta × realizado e mostra a variância.',
      realizado: '**Realizado** = vendas convertidas no funil das ações desse produto. É o que efetivamente fechou — não é estimativa.',
      previsto: '**Previsto** = vendas que você cravou no header. **NÃO é meta** — é só projeção pra cascata RevOps calcular CAC/MCU/breakeven. Meta é outro campo, na aba Resultado.'
    };
    return map[k] || 'Esse conceito eu ainda não conheço. Pergunta de outro jeito ou tenta: meta, vendas, ticket, MCU, MSU, CAC, breakeven, deduções, S&M, G&A.';
  }
};
