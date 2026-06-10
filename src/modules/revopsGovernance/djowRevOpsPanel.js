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
    const messages = Array.isArray(App.state.revopsDjowMessages) ? App.state.revopsDjowMessages : [];
    const selected = App.state.revopsDjowSelectedLine;
    const inputVal = App.state.revopsDjowInput || '';
    const stepLabel = selected ? this._stepLabel(selected.afterStep) : null;

    return `<div class="rounded-3xl border-2 border-violet-200 shadow-md overflow-hidden flex flex-col" style="background:#f5f3f0;color-scheme:light;max-height:calc(100vh - 6rem);">
      <header class="bg-gradient-to-br from-violet-600 to-fuchsia-600 px-4 py-3 flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-white/20 border border-white/30 grid place-items-center shrink-0">
          <i data-lucide="sparkles" class="w-4 h-4 text-white"></i>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-[9px] font-black text-violet-100 uppercase tracking-widest">Djow · ajudante de fórmulas</p>
          <h3 class="text-sm font-black text-white">Como posso te ajudar?</h3>
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
    const isRevops = selected?.afterStep === 'revops_mcu' || selected?.afterStep === 'revops_msu';
    const examples = isRevops
      ? `<li>• <span class="font-mono">"Comissão Hotmart de 5,9% do ticket"</span></li>
         <li>• <span class="font-mono">"15% do MCU"</span></li>
         <li>• <span class="font-mono">"Imposto 15% sobre o ticket"</span></li>
         <li>• <span class="font-mono">"5 reais por venda"</span></li>
         <li>• <span class="font-mono">"o que é MCU?"</span> / <span class="font-mono">"explica breakeven"</span></li>`
      : `<li>• <span class="font-mono">"Lara ganha 5 por venda"</span></li>
         <li>• <span class="font-mono">"15% do faturamento"</span></li>
         <li>• <span class="font-mono">"ISS de 5% sobre vendas líquidas"</span></li>
         <li>• <span class="font-mono">"6000 fixos"</span></li>
         <li>• <span class="font-mono">"O que entra em deduções?"</span> (explico)</li>`;
    return `<div class="rounded-2xl border border-violet-200 bg-violet-50/60 p-3 space-y-1.5">
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
    return `<div class="flex justify-start">
      <div class="max-w-[90%] space-y-1.5">
        <div class="rounded-2xl rounded-tl-md bg-white border border-violet-200 px-3 py-2">
          <p class="text-[11px] text-slate-800 whitespace-pre-line leading-snug">${Utils.escape(m.text)}</p>
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
  // Retorna { reply, suggestion } a partir de uma pergunta livre.
  // ============================================================
  resolve(question, ctx) {
    const q = String(question || '').trim().toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, ''); // remove acentos
    const afterStep = ctx?.afterStep || 'deducoes_inside';

    if (!q) return { reply: 'Escreve algo que eu te ajudo.', suggestion: null };

    // Pergunta conceitual: "o que entra em deduções?" / "o que é MCU?" / "explica CAC"
    const conceptMatch = q.match(/o que (entra|vai|tem|e|eh|é) (em|nas?|um|uma|o|a)?\s*(deducoes|deducao|s.?m|s e m|sm|g.?a|g e a|ga|custos|faturamento|mcu|msu|cac|breakeven|ctc|tm|ticket)/);
    if (conceptMatch) {
      return { reply: this._explainConcept(conceptMatch[3]), suggestion: null };
    }
    const explainMatch = q.match(/(?:explica|me explica|explique|o que e|o que eh)\s+(?:o|a|um|uma)?\s*(mcu|msu|cac|breakeven|ctc|tm|ticket|deducoes|deducao|s.?m|sm|g.?a|ga|custos|faturamento)/);
    if (explainMatch) {
      return { reply: this._explainConcept(explainMatch[1]), suggestion: null };
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
      reply: `Não captei. Tenta de novo nesse formato:\n• "5 por venda"\n• "15% do faturamento"\n• "3% sobre venda líquida"\n• "6000 fixos"\nOu pergunta o conceito: "o que entra em deduções?"`,
      suggestion: null
    };
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
      ticket: '**Ticket Médio** vem da aba Ofertas. Preço médio ponderado: cada oferta tem preço × mix (% das vendas), soma ponderada = TM. Handle **tm** ou **ticket**.'
    };
    return map[k] || 'Esse conceito eu ainda não conheço. Pergunta de outro jeito ou tenta: vendas, ticket, MCU, MSU, CAC, breakeven, deduções, S&M, G&A.';
  }
};
