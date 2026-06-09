// V17 — Djow Strategic Assistant
// Camada estratégica do Djow: histórico de chat por produto, dispatcher que
// reaproveita o RailwayAgentClient quando online, com fallback local que
// devolve exemplos guiados (visão, objetivo, OKR) conforme a pergunta.
window.DjowStrategicAssistant = {
  history(productId) {
    const raw = (App.state.strategicDjowChats?.[productId]?.messages) || [];
    // V36.9.0 — dedup retroativo: histórico legado pode ter N transitions
    // duplicadas seguidas. Colapsa em 1 só leitura.
    // Normaliza typo legado "Pluge"→"Plugue" pra dedup pegar bug + fix juntos.
    const normalize = (t) => String(t || '').replace(/\bPluge\b/g, 'Plugue');
    const out = [];
    for (const m of raw) {
      if (m.role === 'transition' && out.length) {
        const last = out[out.length - 1];
        if (last.role === 'transition' && normalize(last.text) === normalize(m.text)) continue;
      }
      out.push(m);
    }
    return out;
  },

  append(productId, message) {
    const chats = App.state.strategicDjowChats || {};
    const existing = chats[productId]?.messages || [];
    // V36.9.0 — dedup: transitions com mesmo texto consecutivo viram 1.
    // Antes, advanceStrategicStep + selectStrategicCampaign empurravam o mesmo
    // hand-off cada vez que cliente voltava+avançava, enchendo a sidebar com
    // 6× o mesmo card "Campanha selecionada. Pluge os números...".
    if (message.role === 'transition' && existing.length) {
      const last = existing[existing.length - 1];
      if (last.role === 'transition' && last.text === message.text) return;
    }
    App.state.strategicDjowChats = { ...chats, [productId]: { messages: [...existing, message] } };
  },

  buildContext(productId) {
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    const map = window.StrategicMapEngine ? StrategicMapEngine.getForProduct(productId) : null;
    const summary = window.StrategicFlowBridge ? StrategicFlowBridge.summary(productId) : { campaigns: 0, actions: 0, activeFlows: 0 };
    return {
      product: product?.name || null,
      product_type: product?.type || null,
      vision: map?.vision || '',
      objectives_count: (map?.objectives || []).length,
      okrs_count: (map?.objectives || []).reduce((sum, o) => sum + (o.okrs?.length || 0), 0),
      campaigns: summary.campaigns,
      actions: summary.actions,
      flows_active: summary.activeFlows,
      zoom: App.state.strategicMapZoom || 'strategy'
    };
  },

  async dispatch(productId, userMessage) {
    const ctx = this.buildContext(productId);
    const message = String(userMessage || '').trim();
    if (!message) return { ok: false, message: 'Mensagem vazia.' };
    const agentCfg = App.state.agentConfig?.djow;
    if (agentCfg?.enabled && agentCfg?.url && window.RailwayAgentClient) {
      const response = await RailwayAgentClient.send(message, { ...ctx, channel: 'strategic-map' }, agentCfg);
      if (response.ok && response.data) {
        const text = String(response.data.message || response.data.response || response.data.description || '').trim();
        if (text) {
          if (window.AgentHealthMonitor) AgentHealthMonitor.recordSuccess(response.latencyMs);
          return { ok: true, text, source: 'djow', latencyMs: response.latencyMs };
        }
      }
      if (window.AgentHealthMonitor) AgentHealthMonitor.recordFailure(response.message);
    }
    return { ok: true, text: this._localSuggestion(message, ctx), source: 'fallback' };
  },

  _localSuggestion(message, ctx) {
    const msg = message.toLowerCase();
    // V36.9.2 — Pedido de AVALIAÇÃO da frase do objetivo: check estrutural
    // (posição + público + horizonte) com veredito + sugestão de melhoria.
    // É o que faz o Djow PARAR de ser catálogo e virar crítico real, mesmo
    // sem ter a Anthropic ligada via RailwayAgentClient.
    if (/avalia|avaliar|cr[ií]tic|melhor(ar)? minha frase/.test(msg)) {
      return this._evaluateVision(ctx?.vision, ctx?.product);
    }
    if (/posso avan[cç]ar/.test(msg)) {
      return this._evaluateVision(ctx?.vision, ctx?.product, { framing: 'advance' });
    }
    if (/visão|missão/.test(msg)) {
      return `Exemplo de Visão para "${ctx.product || 'seu produto'}":\n\n"Transformar ${ctx.product_type || 'usuários'} em referência operacional, ampliando geração de receita previsível."`;
    }
    if (/objetivo|estrat[eé]gico/.test(msg)) {
      return 'Exemplos de Objetivos Estratégicos:\n• Aumentar aquisição\n• Melhorar conversão de MOF para BOF\n• Reduzir CAC\n• Aumentar retenção / LTV';
    }
    if (/okr|meta|kpi/.test(msg)) {
      return 'Exemplo de OKR:\n\nObjetivo: Aumentar aquisição.\n→ OKR: "Gerar 2.000 leads qualificados até julho."\n• Métrica: leads qualificados\n• Meta: 2000\n• Atual: 0\n• Dono: Marketing';
    }
    if (/fluxo|campanha|conectar/.test(msg)) {
      return 'Para conectar fluxos, escolha o nível Fluxos no zoom. Selecione campanhas e ações relevantes para cada OKR. Exemplo: Instagram TOF → LP MOF → Email BOF → Checkout.';
    }
    if (/execu[cç][aã]o|tarefa|djow/.test(msg)) {
      return 'Na execução, cada ação pode gerar tarefas operacionais via Djow (modal "Criar Tarefas" no card da ação). O resultado das tarefas alimenta a leitura dos OKRs.';
    }
    return `Posso te ajudar com:\n• Visão do produto (escreva "visão")\n• Objetivos estratégicos (escreva "objetivos")\n• OKRs (escreva "okr")\n• Conectar fluxos (escreva "fluxos")\n• Execução operacional (escreva "execução")`;
  },

  // V36.9.2 — Crítico estrutural local. Olha pra frase do objetivo e devolve
  // veredito por 3 dimensões clássicas de visão de produto:
  //   POSIÇÃO  — pretende ser o quê? (referência, preferido, líder, escolha...)
  //   PÚBLICO  — pra quem? (cita público-alvo explicitamente?)
  //   HORIZONTE — em que prazo? (ano específico, "até X", "em N meses")
  // Quando faltam dimensões, devolve sugestão concreta com placeholder.
  // Esta avaliação roda mesmo SEM Anthropic configurada — Djow vira utilidade
  // imediata, não promessa de IA. Quando RailwayAgentClient está online, a
  // resposta da Anthropic toma precedência (dispatch chama esta função só
  // como fallback).
  _evaluateVision(vision, productName, opts = {}) {
    const v = String(vision || '').trim();
    if (!v) {
      return 'Você ainda não escreveu o objetivo. Quando escrever, eu avalio aqui pra ver se tá clara e acionável.';
    }
    const hasPosition = /preferid[oa]|refer[eê]ncia|primeir[oa]|favorit[oa]|escolha|melhor|l[ií]der|principal|n[uú]mero\s*1|n[ºo]\s*1/i.test(v);
    const hasYear = /20\d{2}|at[eé]\s+\d|em\s+\d+\s+(m[eê]s|ano)|pr[oó]xim[oa]s?\s+(m[eê]s|ano)/i.test(v);
    const wordCount = v.split(/\s+/).filter(Boolean).length;
    // Heurística "tem público específico": presença de marcador de público
    // (de/para/pra/dos/das/aos + algo) E comprimento >= 8 palavras.
    const hasPublicMarker = /\b(de|para|pra|pros|pras|dos|das|aos|às)\s+[a-záéíóúâêôãõç]/i.test(v);
    const hasPublic = hasPublicMarker && wordCount >= 8;

    const checks = [
      { ok: hasPosition, label: 'POSIÇÃO', hint: 'qual lugar o produto pretende ocupar — referência, preferido, líder, primeira escolha…' },
      { ok: hasPublic,   label: 'PÚBLICO',  hint: 'quem é o cliente — seja específico (não "todo mundo")' },
      { ok: hasYear,     label: 'HORIZONTE', hint: 'em que prazo — um ano ou "até X"' }
    ];
    const score = checks.filter(c => c.ok).length;
    const checklist = checks.map(c => `${c.ok ? '✓' : '⚠'} ${c.label} — ${c.ok ? 'tá' : c.hint}`).join('\n');

    let veredito;
    if (opts.framing === 'advance') {
      veredito = score === 3
        ? 'Pode avançar. Sua frase tem os 3 pilares — posição, público e horizonte.'
        : `Avançar agora é arriscado. Faltou ${checks.filter(c => !c.ok).map(c => c.label).join(' e ')}. Refina aqui antes de definir o Comercial.`;
    } else {
      veredito = score === 3
        ? 'Frase completa. Tem posição, público e horizonte — está acionável.'
        : score === 2
          ? `Quase lá. Falta só ${checks.filter(c => !c.ok).map(c => c.label).join(' e ')}.`
          : score === 1
            ? `Frase ainda genérica. Tem ${checks.filter(c => c.ok).map(c => c.label).join(', ')} mas falta ${checks.filter(c => !c.ok).map(c => c.label).join(' e ')}.`
            : 'Frase muito genérica. Precisa dos 3 pilares pra ser acionável: posição, público e horizonte.';
    }

    return `Sua frase:\n"${v}"\n\n${checklist}\n\n${veredito}\n\nTemplate ideal:\n"Ser o(a) [posição] preferido(a) de [público] até [horizonte]."`;
  }
};
