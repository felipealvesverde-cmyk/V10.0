// V38.1.46 — Assistente de Coleta de Audiência.
//
// Pra cada field.key do schema fundido (audienceFusionEngine), mapeia
// QUAL ESTRATÉGIA DE COLETA serve pra obter esse dado. Agrupa por
// estratégia pra o cliente atacar 4-5 campos com uma ação só.
//
// Felipe (V38.1.45/46):
//   - Granularidade AGRUPADA por estratégia (1b)
//   - LJ GERA artefato pronto (2b) — pergunta exata pro formulário,
//     script de tag pro SDR, código-modelo do webhook
//   - Drill-down + dashboard "Saúde da coleta" (3a+b)

var AudienceCollectionAdvisor = {
  // Estratégias suportadas — ordenadas por custo crescente.
  STRATEGIES: {
    automatico: {
      label: 'RD popula automaticamente',
      icon: 'zap',
      tone: 'emerald',
      cost: 'nenhum',
      diagnostico: 'Esse campo é populado automaticamente pelo RD quando o lead chega — UTM, origem, criação de contato. Se está faltando, vale revisar a configuração de captura do RD.'
    },
    comportamento: {
      label: 'Tracker LJ + comportamento',
      icon: 'activity',
      tone: 'violet',
      cost: 'já incluso',
      diagnostico: 'Esse campo lê do tracker LJ (eventHistory). Se está faltando, o tracker pode não estar instalado ou o lead chegou direto pelo RD sem passar pelo seu site/app.'
    },
    qualificacao_rd: {
      label: 'Qualificação manual do lead no RD',
      icon: 'check-circle',
      tone: 'emerald',
      cost: 'baixo',
      diagnostico: 'Esse campo exige que seu time qualifique o lead no RD (MQL → SQL → Oportunidade). Sem isso, o ICP não consegue identificar quem está pronto pra comprar.'
    },
    formulario_rd: {
      label: 'Pergunta no formulário RD',
      icon: 'form-input',
      tone: 'violet',
      cost: 'baixo',
      diagnostico: 'Esse campo deveria vir respondido nos formulários de captura do RD. Adicionar 1 pergunta no formulário resolve sem mexer em time.'
    },
    tag_manual: {
      label: 'Tag aplicada pelo time comercial',
      icon: 'tag',
      tone: 'amber',
      cost: 'médio',
      diagnostico: 'Esse campo se ativa por uma tag que o time aplica durante interação (call, email, demo). Exige treinamento, mas é o caminho quando o dado depende de conversa.'
    },
    webhook_produto: {
      label: 'Webhook do seu produto',
      icon: 'plug-zap',
      tone: 'sky',
      cost: 'médio (técnico)',
      diagnostico: 'Esse campo depende do seu produto disparar evento pro RD quando algo acontece (cadastro, paywall, ativação). Exige um pequeno desenvolvimento, mas resolve definitivo.'
    },
    enrichment: {
      label: 'Enrichment externo (Apollo/Clearbit)',
      icon: 'database',
      tone: 'rose',
      cost: 'alto (pago)',
      diagnostico: 'Esse campo exige integração com Apollo, Clearbit ou similar — APIs pagas que ainda NÃO ESTÃO ATIVAS no LJ. Considere marcar como opcional ou descartar do schema por enquanto.'
    }
  },

  // Mapa field.key → {strategy, prompt?, scriptHint?, code?} — V1 estático.
  // V2: Djow refina baseado no state do tenant via endpoint.
  FIELD_STRATEGY: {
    // --- NÚCLEO COMUM ---
    geo:                   { strategy: 'formulario_rd', prompt: 'Em qual cidade e estado você está?' },
    origem_lead:           { strategy: 'automatico' },
    contato:               { strategy: 'formulario_rd', prompt: 'Qual o melhor email e telefone pra te contatar?' },
    momento_compra:        { strategy: 'qualificacao_rd' },
    engajamento:           { strategy: 'comportamento' },
    comportamento_compra:  { strategy: 'tag_manual', scriptHint: 'Após demo ou proposta enviada, aplicar tag lj-intencao-alta no contato.' },
    canal_decisor:         { strategy: 'formulario_rd', prompt: 'Qual o melhor canal pra falar com a pessoa que decide?' },

    // --- B2B ---
    empresa_corporativa:   { strategy: 'formulario_rd', prompt: 'Qual o nome da sua empresa?' },
    setor_empresa:         { strategy: 'formulario_rd', prompt: 'Qual o setor da sua empresa?', options: 'lista de verticais — SaaS, Saúde, Educação, Varejo, Indústria, Serviços, Outros' },
    porte_empresa:         { strategy: 'enrichment' },
    maturidade_stack:      { strategy: 'tag_manual', scriptHint: 'Na 1ª call, pergunte "Qual CRM/automação vocês usam hoje?" e aplique tag usa-X (ex: usa-pipedrive).' },
    fit_porte:             { strategy: 'enrichment' },
    cargo_decisor:         { strategy: 'formulario_rd', prompt: 'Qual o seu cargo na empresa?' },
    alcada:                { strategy: 'formulario_rd', prompt: 'Qual seu cargo?' },
    horario_comercial:     { strategy: 'comportamento' },
    consumo_b2b:           { strategy: 'tag_manual', scriptHint: 'Aplique tags baixou-whitepaper, viu-case, leu-doc-api quando o lead consumir conteúdo técnico.' },

    // --- B2C ---
    consumidor_final:      { strategy: 'automatico' },
    interesse_categoria:   { strategy: 'tag_manual', scriptHint: 'Aplique tag por categoria de produto que o lead navegou ou pediu informação.' },
    faixa_etaria:          { strategy: 'formulario_rd', prompt: 'Em qual faixa etária você se encaixa? (18-25 / 26-35 / 36-50 / 50+)' },
    historico_conversao:   { strategy: 'qualificacao_rd' },
    perfil_consumo:        { strategy: 'tag_manual', scriptHint: 'Marque preferências detectadas (sustentável, premium, econômico) durante interação.' },
    gatilho_pessoal:       { strategy: 'tag_manual', scriptHint: 'Quando descobrir o gatilho (presente, ocasião, dor), aplique tag gatilho-X.' },
    horario_pessoal:       { strategy: 'comportamento' },
    consumo_b2c:           { strategy: 'tag_manual', scriptHint: 'Aplique tags promocao-ativa, comprou-com-desconto, busca-oferta quando detectar comportamento de consumo.' },

    // --- B2B2C ---
    parceiro_corporativo:  { strategy: 'formulario_rd', prompt: 'Qual a empresa parceira que vai operar nosso produto?' },
    base_consumidora:      { strategy: 'formulario_rd', prompt: 'Qual o tamanho/perfil da base de consumidores que esse parceiro atende?' },
    fit_parceiro:          { strategy: 'enrichment' },
    aderencia_base_final:  { strategy: 'tag_manual', scriptHint: 'Após análise da base do parceiro, aplique tag base-fit-alta/media/baixa.' },
    decisor_no_parceiro:   { strategy: 'formulario_rd', prompt: 'Quem na empresa parceira tem autonomia pra contratar?' },

    // --- C2C ---
    lado:                  { strategy: 'formulario_rd', prompt: 'Você quer comprar ou vender nessa plataforma?' },
    usuario_plataforma:    { strategy: 'webhook_produto' },
    tem_bem_ou_capacidade: { strategy: 'tag_manual', scriptHint: 'Pra lado=oferta, marcar capacidade de estoque/produção.' },
    busca_recorrente:      { strategy: 'tag_manual', scriptHint: 'Pra lado=demanda, marcar recorrência de busca.' },
    confianca_reputacao:   { strategy: 'webhook_produto' },

    // --- SaaS ---
    uso_digital:           { strategy: 'automatico' },
    usa_categoria_solucao: { strategy: 'tag_manual', scriptHint: 'Na qualificação, perguntar ferramenta atual e aplicar usa-X.' },
    orcamento_recorrente:  { strategy: 'qualificacao_rd' },
    objecao_formato:       { strategy: 'tag_manual', scriptHint: 'Quando lead expressar medo de cancelar, curva ou integração, aplicar tag objecao-X.' },
    gatilho:               { strategy: 'tag_manual', scriptHint: 'Quando descobrir a dor de automação/repetição, aplicar tag dor-X.' },

    // --- E-commerce ---
    geo_entregavel:        { strategy: 'formulario_rd', prompt: 'Em qual cidade você quer receber? (pra confirmar cobertura)' },
    historico_compra_online: { strategy: 'qualificacao_rd' },
    ticket_fit:            { strategy: 'qualificacao_rd' },
    gatilho_recente:       { strategy: 'comportamento' },
    objecao_logistica:     { strategy: 'tag_manual', scriptHint: 'Quando atendimento detectar dúvida sobre frete/troca/tamanho, aplicar tag.' },

    // --- Agência ---
    contrata_servico:      { strategy: 'formulario_rd', prompt: 'Sua empresa contrata serviços de marketing/agência?' },
    investe_em_aquisicao:  { strategy: 'tag_manual', scriptHint: 'Pergunte "vocês investem em ads hoje?" e aplique tag anuncia-ativo.' },
    ticket_compativel:     { strategy: 'qualificacao_rd' },
    gargalo_execucao:      { strategy: 'formulario_rd', prompt: 'Você tem time interno de marketing ou precisa terceirizar?' },
    objecao_alinhamento:   { strategy: 'tag_manual', scriptHint: 'Quando lead falar de frustração com agências passadas, aplicar tag frustracao-agencia.' },
    dor_sobrecarga:        { strategy: 'tag_manual', scriptHint: 'Quando lead expressar sobrecarga/acúmulo de função, aplicar tag dor-sobrecarga.' },

    // --- Marketplace ---
    categoria_plataforma:  { strategy: 'formulario_rd', prompt: 'Em qual categoria você quer atuar/comprar?' },
    volume_liquidez:       { strategy: 'tag_manual', scriptHint: 'Pra oferta: volume_X (alto/medio/baixo). Pra demanda: recorrencia_Y.' },
    ativacao_inicial:      { strategy: 'webhook_produto' },
    dor_lado:              { strategy: 'tag_manual', scriptHint: 'Pra oferta: dor-distribuicao. Pra demanda: dor-sourcing.' },
    comportamento_plataforma: { strategy: 'webhook_produto' },

    // --- Freemium ---
    conta_criada:          { strategy: 'webhook_produto' },
    uso_ativo:             { strategy: 'webhook_produto' },
    atingiu_limite_free:   { strategy: 'webhook_produto' },
    caso_uso_pago:         { strategy: 'webhook_produto' },
    power_user:            { strategy: 'webhook_produto' },
    gatilho_upgrade:       { strategy: 'webhook_produto' }
  },

  // Agrupa lista de campos faltantes por estratégia. Retorna {strategyKey: {meta, fields[]}}.
  groupByStrategy(missingFields) {
    const out = {};
    for (const field of (missingFields || [])) {
      const cfg = this.FIELD_STRATEGY[field.key] || { strategy: 'tag_manual' };
      const strat = cfg.strategy;
      if (!out[strat]) {
        out[strat] = { meta: this.STRATEGIES[strat] || {}, key: strat, fields: [] };
      }
      out[strat].fields.push({ ...field, ...cfg });
    }
    // Ordena estratégias por custo (do mais barato pro mais caro)
    const order = ['automatico', 'comportamento', 'qualificacao_rd', 'formulario_rd', 'tag_manual', 'webhook_produto', 'enrichment'];
    const ordered = {};
    for (const k of order) if (out[k]) ordered[k] = out[k];
    for (const k of Object.keys(out)) if (!ordered[k]) ordered[k] = out[k];
    return ordered;
  },

  // Gera artefato pronto (2b): pergunta exata pra formulário RD, script de tag etc.
  // Retorna string com a sugestão concreta agrupada pela estratégia.
  generateArtifact(strategyKey, fields) {
    switch (strategyKey) {
      case 'formulario_rd': {
        const perguntas = fields
          .filter(f => f.prompt)
          .map(f => `• "${f.prompt}"${f.options ? `   (opções: ${f.options})` : ''}`)
          .join('\n');
        return `Adicione essas ${fields.length} pergunta(s) no formulário principal de captura do RD:\n\n${perguntas}\n\nQuando o lead preencher, o RD popula automático os campos e o ICP volta a contar.`;
      }
      case 'tag_manual': {
        const scripts = fields
          .filter(f => f.scriptHint)
          .map(f => `• ${f.label}:  ${f.scriptHint}`)
          .join('\n');
        return `Treine o time comercial pra aplicar tags durante interação com o lead:\n\n${scripts}\n\nDica: crie um playbook curto pro SDR + tag-watcher no RD pra detectar tags não aplicadas em N dias.`;
      }
      case 'qualificacao_rd': {
        const list = fields.map(f => `• ${f.label}`).join('\n');
        return `Esses campos exigem QUALIFICAÇÃO ativa do lead no RD:\n\n${list}\n\nFluxo recomendado:\n1. Lead chega → estado inicial "Subscriber"\n2. Após 1ª interação significativa → MQL\n3. Após call de qualificação → SQL\n4. Quando proposta enviada → Oportunidade\n5. Marque "ganha" no fechamento\n\nO ICP lê esses estados automaticamente.`;
      }
      case 'webhook_produto': {
        const list = fields.map(f => `• ${f.label}`).join('\n');
        return `Esses campos exigem que seu produto dispare eventos pro RD:\n\n${list}\n\nCódigo-modelo de webhook (Node.js):\n\n\`\`\`\nawait fetch('https://api.rd.services/platform/conversions', {\n  method: 'POST',\n  headers: { 'Authorization': 'Bearer ' + RD_TOKEN, 'Content-Type': 'application/json' },\n  body: JSON.stringify({\n    event_type: 'CONVERSION',\n    event_family: 'CDP',\n    payload: {\n      conversion_identifier: 'evento-paywall-hit',\n      email: userEmail,\n      tags: ['lj-paywall-hit', 'caso-uso-pago']\n    }\n  })\n});\n\`\`\`\n\nDispare quando o usuário esbarrar nos eventos relevantes (signup, ativação, paywall etc).`;
      }
      case 'enrichment': {
        const list = fields.map(f => `• ${f.label}`).join('\n');
        return `Esses campos exigem ENRICHMENT EXTERNO (Apollo, Clearbit ou similar):\n\n${list}\n\n⚠️ Atenção: o LJ ainda NÃO TEM essa integração ativa. Por enquanto:\n\n• Sugestão A: marque esses campos como opcionais no schema (não contam no denominador do threshold).\n• Sugestão B: capture um proxy via formulário RD ("Quantos funcionários sua empresa tem?" como pergunta de qualificação).\n• Sugestão C: aguarde a release de enrichment do LJ.`;
      }
      case 'comportamento': {
        const list = fields.map(f => `• ${f.label}`).join('\n');
        return `Esses campos vêm do tracker LJ via eventHistory:\n\n${list}\n\nChecklist:\n1. O script do tracker LJ está instalado no seu site/app?\n2. Os leads desse produto passam pelo seu site antes de chegar no RD?\n3. O scoring V34 está ativo (gerando globalScore)?\n\nSe sim pra todas, é só questão de tempo até esses sinais aparecerem com massa suficiente.`;
      }
      case 'automatico': {
        const list = fields.map(f => `• ${f.label}`).join('\n');
        return `Esses campos deveriam vir AUTOMÁTICOS do RD:\n\n${list}\n\nRevise a captura RD:\n• UTM Source/Medium configurado nos seus links?\n• Formulários do RD com campo de origem ativo?\n• Webhooks de tracker/landing batendo no RD?\n\nSe está faltando, problema é configuração de captura, não do quadro.`;
      }
      default:
        return 'Estratégia não suportada.';
    }
  },

  // Saúde da coleta no PRODUTO: pra cada campo do schema, qual % dos leads tem o dado.
  // Retorna {covered, bloqueados: [{key, label, pctMissing, strategy}], totalFields}
  productCollectionHealth(productId) {
    if (!productId || !window.App?.state || !window.AudienceTransmutationEngine) return null;
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    if (!product?.audience?.schema) return null;
    const schema = product.audience.schema;
    const actions = (App.state.actions || []).filter(a => {
      const camp = (App.state.campaigns || []).find(c => Number(c.id) === Number(a.campaignId));
      return camp && Number(camp.productId) === Number(productId);
    });
    const leads = actions.flatMap(a => a.leads || []);
    if (!leads.length) return null;

    const allFields = [
      ...(schema.pa || []).filter(f => !f.optional),
      ...(schema.icp || []).filter(f => !f.optional),
      ...(schema.bp || []).filter(f => !f.optional)
    ];
    const stats = allFields.map(f => {
      const inf = AudienceTransmutationEngine.FIELD_INFERENCE[f.key];
      let missing = 0;
      if (inf) {
        for (const lead of leads) if (!inf(lead)) missing++;
      } else {
        missing = leads.length; // sem inferência: 100% bloqueado
      }
      const cfg = this.FIELD_STRATEGY[f.key] || { strategy: 'tag_manual' };
      return {
        key: f.key,
        label: f.label || f.key,
        type: f.type,
        pctMissing: Math.round((missing / leads.length) * 100),
        strategy: cfg.strategy,
        strategyMeta: this.STRATEGIES[cfg.strategy] || {}
      };
    });
    // Sorted desc pelo % bloqueado
    stats.sort((a, b) => b.pctMissing - a.pctMissing);
    const totalCovered = stats.filter(s => s.pctMissing < 50).length;
    return {
      totalFields: stats.length,
      covered: totalCovered,
      coveragePct: Math.round((totalCovered / stats.length) * 100),
      bloqueados: stats.slice(0, 5), // top 5
      all: stats
    };
  }
};

window.AudienceCollectionAdvisor = AudienceCollectionAdvisor;
