// V38.1.41 — Engine de Transmutação de Lead.
//
// Recebe lead (RD/state) + product.audience.schema (do AudienceFusionEngine).
// Para cada campo do schema:
//   - completude: o dado existe (não-vazio) → conta no denominador
//   - fit: existe E bate o critério-alvo → conta no denominador
// Aplica threshold (default 80%) por camada + regra do acúmulo
// (ICP só conta se PA também atingiu; BP só se ICP também).
// Retorna {layer, paPct, icpPct, bpPct, missing, threshold, evaluatedAt}.
//
// Tag final do lead: lj-suspect | lj-pa | lj-icp | lj-bp.

var AudienceTransmutationEngine = {
  DEFAULT_THRESHOLD: 0.8,
  PERSONAL_DOMAINS: ['gmail.com','hotmail.com','outlook.com','yahoo.com','yahoo.com.br','icloud.com','live.com','uol.com.br','bol.com.br','msn.com','terra.com.br'],
  DECISOR_KEYWORDS: ['ceo','cto','cfo','cmo','coo','cio','cco','cgo','founder','fundador','presidente','vice','vp','diretor','head','gerente','manager','socio','sócio'],

  // §6 — Inferências por campo. Cada função recebe lead e retorna boolean.
  // Para completude: existência. Para fit: critério-alvo.
  FIELD_INFERENCE: {
    // --- NÚCLEO COMUM ---
    geo: (l) => !!(l.estado || l.cidade || l.pais || l.geography),
    origem_lead: (l) => !!(l.fonte || l.origin || l.source),
    contato: (l) => !!(l.email || l.phone || l.telefone),
    momento_compra: (l) => {
      const qual = String(l.qualificacao_atual || l.qualificacao || l.qualification || l.lifecycleStage || '').toLowerCase();
      const score = Number(l.globalScore || l.score || 0);
      return ['mql','sql','opportunity','opportunityqualified'].some(k => qual.includes(k)) && score >= 50;
    },
    engajamento: (l) => {
      const score = Number(l.globalScore || l.score || 0);
      if (score >= 50) return true;
      const last = l.lastSyncedAt || l.lastActivity || l.last_activity_at;
      if (!last) return false;
      const days = (Date.now() - new Date(last).getTime()) / 86400000;
      return days >= 0 && days <= 30;
    },
    comportamento_compra: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      if (tags.some(t => /(intencao|carrinho|demo|proposta|trial)/.test(t))) return true;
      const events = l.triggerEvents || l.eventHistory || [];
      return events.some(e => /(demo|proposta|carrinho|trial|signup-paid)/i.test(String(e.type || e.kind || e || '')));
    },
    canal_decisor: (l) => Array.isArray(l.contatos) ? l.contatos.length > 0 : Array.isArray(l.contacts) ? l.contacts.length > 0 : false,

    // --- B2B ---
    empresa_corporativa: (l) => {
      const empresa = String(l.empresa || l.company || '').trim();
      if (empresa) return true;
      const email = String(l.email || '').trim();
      const domain = (email.split('@')[1] || '').toLowerCase();
      return !!domain && !AudienceTransmutationEngine.PERSONAL_DOMAINS.includes(domain);
    },
    setor_empresa: (l) => !!(l.segmento || l.segment || l.subsegmento || l.industry),
    porte_empresa: (l) => !!(l.numero_funcionarios || l.funcionarios || l.headcount || l.companyRevenue),
    maturidade_stack: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /(usa-|stack|ferramenta|tool-)/.test(t));
    },
    fit_porte: (l) => {
      // sem productCfg.faixaPorte vivo ainda — passa se tem dado de porte
      return !!(l.numero_funcionarios || l.funcionarios || l.headcount || l.companyRevenue);
    },
    cargo_decisor: (l) => {
      const cargo = String(l.cargo || l.role || l.jobTitle || '').toLowerCase();
      if (!cargo) return false;
      return AudienceTransmutationEngine.DECISOR_KEYWORDS.some(k => cargo.includes(k));
    },
    alcada: (l) => !!String(l.cargo || l.role || l.jobTitle || '').trim(),

    // --- B2C ---
    consumidor_final: (l) => {
      const empresa = String(l.empresa || l.company || '').trim();
      if (!empresa) return true;
      const email = String(l.email || '').trim();
      const domain = (email.split('@')[1] || '').toLowerCase();
      return AudienceTransmutationEngine.PERSONAL_DOMAINS.includes(domain);
    },
    interesse_categoria: (l) => (l.tags || []).length > 0,
    faixa_etaria: (l) => !!(l.idade || l.faixa_etaria || l.age),
    historico_conversao: (l) => {
      const qual = String(l.qualificacao_atual || l.qualificacao || l.lifecycleStage || '').toLowerCase();
      if (qual === 'customer') return true;
      const ops = l.oportunidades || l.opportunities || [];
      return ops.some(o => /(ganh|won|fechad|closed-won)/.test(String(o.status || o.stage || '').toLowerCase()));
    },
    perfil_consumo: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /(preferencia|comportamento|perfil-)/.test(t));
    },
    gatilho_pessoal: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /(gatilho|interesse-pessoal)/.test(t));
    },

    // --- B2B2C ---
    parceiro_corporativo: (l) => AudienceTransmutationEngine.FIELD_INFERENCE.empresa_corporativa(l),
    base_consumidora: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /(base|clientes-do-parceiro|usuarios-finais)/.test(t));
    },
    fit_parceiro: (l) => AudienceTransmutationEngine.FIELD_INFERENCE.fit_porte(l),
    aderencia_base_final: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /(aderencia|fit-base|base-aderente)/.test(t));
    },
    decisor_no_parceiro: (l) => AudienceTransmutationEngine.FIELD_INFERENCE.cargo_decisor(l),

    // --- C2C ---
    lado: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /^(oferta|demanda|vendedor|comprador)$/.test(t));
    },
    usuario_plataforma: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.includes('cadastrado') && (tags.includes('validado') || tags.includes('verificado'));
    },
    tem_bem_ou_capacidade: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.includes('oferta') && tags.some(t => /(estoque|capacidade|disponivel)/.test(t));
    },
    busca_recorrente: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.includes('demanda') && tags.some(t => /(recorrente|frequente|repetido)/.test(t));
    },
    confianca_reputacao: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /(reputacao|confianca|antifraude|verificado)/.test(t));
    },

    // --- SaaS ---
    uso_digital: () => true, // KB §4.1: quase sempre satisfeito, baixo peso
    usa_categoria_solucao: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /(usa-|stack-|ferramenta-)/.test(t));
    },
    orcamento_recorrente: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      if (tags.some(t => /(opex|assinatura|saas-budget)/.test(t))) return true;
      const ops = l.oportunidades || l.opportunities || [];
      return ops.some(o => Number(o.valor || o.value || 0) > 0);
    },
    objecao_formato: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /(cancel|curva|integracao|adocao)/.test(t));
    },
    gatilho: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /(manual|repetitiv|automacao|escala)/.test(t));
    },

    // --- E-commerce ---
    geo_entregavel: (l) => {
      // sem productCfg.cobertura, fallback: ter geo válido conta
      return !!(l.estado || l.cidade || l.geography);
    },
    historico_compra_online: (l) => AudienceTransmutationEngine.FIELD_INFERENCE.historico_conversao(l),
    ticket_fit: (l) => {
      const ops = l.oportunidades || l.opportunities || [];
      return ops.some(o => Number(o.valor || o.value || 0) > 0);
    },
    gatilho_recente: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      if (tags.some(t => /(carrinho|navegou|browse-recent)/.test(t))) return true;
      const last = l.lastSyncedAt || l.lastActivity;
      if (!last) return false;
      const hours = (Date.now() - new Date(last).getTime()) / 3600000;
      return hours >= 0 && hours <= 72;
    },
    objecao_logistica: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /(frete|troca|tamanho|prazo)/.test(t));
    },

    // --- Agência ---
    contrata_servico: (l) => AudienceTransmutationEngine.FIELD_INFERENCE.empresa_corporativa(l),
    investe_em_aquisicao: (l) => {
      const fonte = String(l.fonte || l.origin || l.source || '').toLowerCase();
      if (/(ads|paga|cpc|cpm)/.test(fonte)) return true;
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /(anuncia|ads-active|midia-paga)/.test(t));
    },
    ticket_compativel: (l) => AudienceTransmutationEngine.FIELD_INFERENCE.ticket_fit(l),
    gargalo_execucao: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /(sem-time|delegacao|sobrecarga-execucao)/.test(t));
    },
    objecao_alinhamento: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /(agencia-ruim|frustracao-agencia|nicho)/.test(t));
    },
    dor_sobrecarga: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /(sobrecarga|acumulo|delegar)/.test(t));
    },

    // --- Marketplace ---
    categoria_plataforma: (l) => !!(l.segmento || l.segment || l.industry),
    volume_liquidez: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /(volume|recorrente|liquido)/.test(t));
    },
    ativacao_inicial: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /(onboarding|ativado|primeiro-passo)/.test(t));
    },
    dor_lado: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /(distribuicao|sourcing|busca)/.test(t));
    },
    comportamento_plataforma: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /(engajou|plataforma|sessions)/.test(t));
    },

    // --- Freemium ---
    conta_criada: (l) => {
      const email = String(l.email || '');
      if (!email.includes('@')) return false;
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.includes('signup') || tags.includes('cadastrado') || tags.includes('account-created');
    },
    uso_ativo: (l) => {
      const score = Number(l.globalScore || l.score || 0);
      if (score >= 50) return true;
      const last = l.lastSyncedAt || l.lastActivity;
      if (!last) return false;
      const days = (Date.now() - new Date(last).getTime()) / 86400000;
      return days >= 0 && days <= 14;
    },
    atingiu_limite_free: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /(limite-free|paywall-hit|atingiu-limite)/.test(t));
    },
    caso_uso_pago: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /(caso-pago|feature-paga|use-case-paid)/.test(t));
    },
    power_user: (l) => {
      const score = Number(l.globalScore || l.score || 0);
      if (score >= 70) return true;
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.includes('power-user');
    },
    gatilho_upgrade: (l) => {
      const tags = (l.tags || []).map(t => String(t).toLowerCase());
      return tags.some(t => /(paywall|tentou-pago|upgrade-intent)/.test(t));
    }
  },

  // Avalia uma camada — retorna {pct, hits[], missing[], denom, optionalHits[]}
  // Cada item em hits/missing carrega {key, label, type, optional}.
  _evaluateLayer(lead, fields) {
    const allFields = fields || [];
    const required = allFields.filter(f => !f.optional);
    const hits = [];
    const missing = [];
    const optionalHits = [];
    for (const field of allFields) {
      const inf = this.FIELD_INFERENCE[field.key];
      const passed = inf ? !!inf(lead) : false;
      const row = { key: field.key, label: field.label, type: field.type, optional: !!field.optional };
      if (field.optional) {
        if (passed) optionalHits.push(row);
      } else {
        if (passed) hits.push(row); else missing.push(row);
      }
    }
    const pct = required.length ? hits.length / required.length : 1;
    return { pct, hits, missing, denom: required.length, optionalHits };
  },

  // V38.1.43 — Mapeia entityType (V34 hierarquia LJ) pra atalho de camada.
  // Cliente já classificado como customer/lead nunca pode ser rebaixado
  // a Suspect pela transmutação — o LJ confiou nessa classificação por
  // signals mais ricos do que só o quadro de audiência.
  _resolveEntityTypeShortcut(lead, layerFromSchema) {
    const t = String(lead.entityType || lead.entity_type || '').toLowerCase();
    if (t === 'customer') {
      // Customer sempre atinge BP — cumpriu a jornada inteira.
      if (layerFromSchema !== 'lj-bp') return { layer: 'lj-bp', via: 'entityType=customer' };
    } else if (t === 'lead') {
      // Lead identificado (não-suspect) sobe ao mínimo PA.
      if (layerFromSchema === 'lj-suspect') return { layer: 'lj-pa', via: 'entityType=lead' };
    }
    return null;
  },

  // Função principal — transmuta um lead contra o schema fundido do produto
  transmute(lead, schema, threshold) {
    if (!lead || !schema) return null;
    const T = (typeof threshold === 'number' && threshold > 0 && threshold <= 1) ? threshold : this.DEFAULT_THRESHOLD;

    const pa  = this._evaluateLayer(lead, schema.pa);
    const icp = this._evaluateLayer(lead, schema.icp);
    const bp  = this._evaluateLayer(lead, schema.bp);

    // §1 — Regra do acúmulo: ICP só atinge se PA também; BP só se ICP também.
    let layerFromSchema = 'lj-suspect';
    if (pa.pct >= T) {
      layerFromSchema = 'lj-pa';
      if (icp.pct >= T) {
        layerFromSchema = 'lj-icp';
        if (bp.pct >= T) {
          layerFromSchema = 'lj-bp';
        }
      }
    }

    // V38.1.43 — Atalho via entityType: respeita classificação V34 do LJ.
    const shortcut = this._resolveEntityTypeShortcut(lead, layerFromSchema);
    const layer = shortcut ? shortcut.layer : layerFromSchema;

    return {
      layer,
      layerFromSchema,
      shortcut, // {layer, via} | null
      threshold: T,
      paPct:  Math.round(pa.pct  * 1000) / 10,
      icpPct: Math.round(icp.pct * 1000) / 10,
      bpPct:  Math.round(bp.pct  * 1000) / 10,
      details: { pa, icp, bp },
      missing: { pa: pa.missing, icp: icp.missing, bp: bp.missing },
      entityType: String(lead.entityType || lead.entity_type || '').toLowerCase() || null,
      evaluatedAt: new Date().toISOString()
    };
  },

  // V38.1.42 — Helper pra UI de leads: descobre o produto de referência e
  // transmuta o lead contra o schema dele. Retorna null se não houver produto
  // com audiência configurada.
  // productHint: id de produto preferencial; se nulo/sem audiência, busca o
  // primeiro produto com audience.configured no tenant.
  getLayerForLead(lead, productHint) {
    if (!lead || !window.App?.state) return null;
    const products = App.state.products || [];
    let product = null;
    if (productHint) {
      product = products.find(p => Number(p.id) === Number(productHint) && p.audience?.configured && p.audience?.schema);
    }
    if (!product) {
      product = products.find(p => p.audience?.configured && p.audience?.schema);
    }
    if (!product) return null;
    const r = this.transmute(lead, product.audience.schema, product.audience.threshold);
    return r ? { ...r, productId: product.id, productName: product.name } : null;
  },

  // Sumário multi-lead contra um produto. Mais barato que somar summarize() porque
  // recebe a lista de leads diretamente (sem precisar derivar das ações do produto).
  summarizeLeadsAgainstProduct(leads, productHint) {
    const products = App.state?.products || [];
    let product = null;
    if (productHint) {
      product = products.find(p => Number(p.id) === Number(productHint) && p.audience?.configured && p.audience?.schema);
    }
    if (!product) {
      product = products.find(p => p.audience?.configured && p.audience?.schema);
    }
    if (!product) return null;
    const out = { total: leads.length, suspect: 0, pa: 0, icp: 0, bp: 0, productId: product.id, productName: product.name };
    for (const lead of leads) {
      const r = this.transmute(lead, product.audience.schema, product.audience.threshold);
      if (!r) continue;
      if (r.layer === 'lj-suspect') out.suspect++;
      else if (r.layer === 'lj-pa')  out.pa++;
      else if (r.layer === 'lj-icp') out.icp++;
      else if (r.layer === 'lj-bp')  out.bp++;
    }
    return out;
  },

  // Helpers de agregação por produto — usados pelo card + Saúde
  // Retorna {total, suspect, pa, icp, bp, paOnly, icpOnly, bpReached}
  summarize(productId) {
    if (!productId || !window.App?.state) return null;
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    if (!product || !product.audience?.schema) return null;
    const schema = product.audience.schema;
    const actions = (App.state.actions || []).filter(a => {
      const camp = (App.state.campaigns || []).find(c => Number(c.id) === Number(a.campaignId));
      return camp && Number(camp.productId) === Number(productId);
    });
    const leads = actions.flatMap(a => a.leads || []);
    const out = { total: leads.length, suspect: 0, pa: 0, icp: 0, bp: 0 };
    for (const lead of leads) {
      const r = this.transmute(lead, schema, product.audience.threshold);
      if (!r) continue;
      if (r.layer === 'lj-suspect') out.suspect++;
      else if (r.layer === 'lj-pa')  out.pa++;
      else if (r.layer === 'lj-icp') out.icp++;
      else if (r.layer === 'lj-bp')  out.bp++;
    }
    return out;
  }
};

window.AudienceTransmutationEngine = AudienceTransmutationEngine;
