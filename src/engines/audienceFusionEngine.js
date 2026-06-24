// V40.12.0 — Motor de Fusão de Audiência (refatorado: lê do catálogo externalizado).
//
// Histórico:
//   V38.1.39 — Motor original com átomos hardcoded
//   V40.12.0 — Sprint 1 da Onda V2 de Audiência (Felipe 2026-06-23):
//     - Átomos extraídos pra `src/data/audienceAtomsCatalog.js`
//     - Engine LÊ do catálogo (`window.AudienceAtomsCatalog`)
//     - Output da fusão inclui `atomsVersion`, `rulesVersion`, `engineVersion`
//     - Audiência salva carimba essas versões em `product.audience`
//     - Comportamento idêntico ao V38.1.39 — sem mudança visual ou de regras
//
// Próximos Sprints (cravados):
//   Sprint 2: +4 átomos (ticket, ciclo, time, tracking) + 4 modelos operacionais
//             (Atacado, Consultoria, Manufatura, Agribusiness)
//   Sprint 3: Step 5 de Conclusão "esfregando na cara" + Confidence score
//             + Catálogo de Consequências por arquétipo
//   Sprint 4: Trilha de auditoria + UI Master de gestão do catálogo
//
// Implementa o modelo composicional v2 da KB do Djow:
//   knowledge-base/djow/audiencia-kb-composicional.md
//   knowledge-base/djow/audiencia-carta-dominio.md
//
// Pura: função fuse(negocio, operacional) → quadro PA/ICP/BP determinístico.
// Sem chamada externa, sem leitura de state.

var AudienceFusionEngine = {
  // V40.12.0 — Versão do MOTOR de fusão. Bump quando comportamento mudar
  // (regras de dedupe novas, fases novas no pipeline, etc).
  // Catálogo e regras versionam separadamente em AudienceAtomsCatalog.
  ENGINE_VERSION: '2.0.0',

  // V40.12.0 — Helpers de leitura do catálogo. Se catálogo não carregou
  // (caso patológico), retornam objetos vazios — engine não quebra mas
  // gera quadros vazios. Em prod isso indica bug de ordem de scripts.
  _catalog() {
    return window.AudienceAtomsCatalog || {};
  },
  _nucleo() {
    return this._catalog().NUCLEO_COMUM || [];
  },
  _atomNegocio(key) {
    return (this._catalog().ATOMS_NEGOCIO || {})[key] || null;
  },
  _atomOperacional(key) {
    return (this._catalog().ATOMS_OPERACIONAL || {})[key] || null;
  },
  _incompatibilidades() {
    return this._catalog().INCOMPATIBILIDADES || [];
  },
  _dedupePairs() {
    return this._catalog().DEDUPE_PAIRS || [];
  },
  _atomsVersion() {
    return this._catalog().CATALOG_VERSION || '0.0.0';
  },
  _rulesVersion() {
    return this._catalog().RULES_VERSION || '0.0.0';
  },
  // V40.12.1 — Sprint 2: Átomos Refinadores (ticket, ciclo, time, tracking).
  // Lidos do catálogo pra UI montar a seção de refinamento no wizard.
  _atomsRefinamento() {
    return this._catalog().ATOMS_REFINAMENTO || {};
  },
  refinamentoOpcoes(key) {
    return (this._atomsRefinamento()[key] || {}).opcoes || [];
  },
  refinamentoMeta(key) {
    const a = this._atomsRefinamento()[key];
    if (!a) return null;
    return { label: a.label, tagline: a.tagline };
  },

  // V40.12.2 — Sprint 3: classifica Audiência em 1 dos arquétipos do
  // AudienceConsequencesCatalog. Retorna { archetype, archetypeKey, fallback }.
  // Quando nenhum arquétipo bate, retorna FALLBACK genérico (Audiência funciona
  // mas perde adaptatividade — sinal pra Master cravar arquétipo customizado).
  classifyArchetype(audience) {
    const catalog = window.AudienceConsequencesCatalog;
    if (!catalog) return null;
    if (!audience || !audience.modeloNegocio || !audience.modeloOperacional) {
      return { archetype: catalog.FALLBACK, archetypeKey: null, fallback: true };
    }
    const refinamento = audience.refinamento || {};
    for (const [key, arch] of Object.entries(catalog.ARCHETYPES)) {
      for (const m of (arch.matches || [])) {
        if (m.negocio !== audience.modeloNegocio) continue;
        if (m.operacional !== audience.modeloOperacional) continue;
        if (m.when) {
          let ok = true;
          for (const [field, allowedValues] of Object.entries(m.when)) {
            if (!refinamento[field] || !allowedValues.includes(refinamento[field])) {
              ok = false;
              break;
            }
          }
          if (!ok) continue;
        }
        return { archetype: arch, archetypeKey: key, fallback: false };
      }
    }
    return { archetype: catalog.FALLBACK, archetypeKey: null, fallback: true };
  },

  // V40.14.8 — Sugere os arquétipos cravados mais PRÓXIMOS da escolha do
  // cliente quando ele cai em fallback. Score por overlap:
  //   - Operacional bate → +2 (mais distintivo)
  //   - Negócio bate → +1
  // Retorna top N (default 2) ordenados por score desc. Usado pelo banner
  // de "Operação Não Classificada" pra dizer "talvez seja X ou Y".
  suggestNearestArchetypes(audience, topN = 2) {
    if (!audience || !audience.modeloNegocio || !audience.modeloOperacional) return [];
    const catalog = window.AudienceConsequencesCatalog;
    if (!catalog || !catalog.ARCHETYPES) return [];
    const candidates = [];
    for (const [key, arch] of Object.entries(catalog.ARCHETYPES)) {
      let bestScore = 0;
      let bestMatch = null;
      for (const m of (arch.matches || [])) {
        let score = 0;
        if (m.negocio === audience.modeloNegocio) score += 1;
        if (m.operacional === audience.modeloOperacional) score += 2;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = m;
        }
      }
      if (bestScore > 0) candidates.push({ key, arch, score: bestScore, match: bestMatch });
    }
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, topN);
  },

  // V40.12.2 — Sprint 3: confidence score 0.0-1.0 sobre a Audiência fundida.
  // Heurística simples (4 fatores) — peso por átomo individual fica pra V2.
  //   +0.30  modelos preenchidos (negócio + operacional + salesChannel)
  //   +0.30  refinamento completo (4/4 átomos refinadores preenchidos)
  //   +0.20  arquétipo bateu (não caiu no FALLBACK)
  //   +0.20  sem incompatibilidades ativas no resultado da fusão
  // Audiência ideal = 1.0. Audiência mínima viável = 0.3 (só modelos).
  confidenceScore(audience, fused) {
    if (!audience) return 0;
    let score = 0;
    if (audience.modeloNegocio && audience.modeloOperacional && audience.salesChannel) score += 0.30;
    const r = audience.refinamento || {};
    const refCount = ['ticket', 'ciclo', 'time_comercial', 'tracking_maduro'].filter(k => r[k]).length;
    score += 0.30 * (refCount / 4);
    const cls = this.classifyArchetype(audience);
    if (cls && !cls.fallback) score += 0.20;
    const notasIncompat = (fused?.notas || []).filter(n => n.origem === 'incompatibilidade');
    if (notasIncompat.length === 0) score += 0.20;
    const total = Math.min(1, Math.max(0, score));
    // V40.14.6 — Se o LJ caiu em fallback (não classificou em arquétipo cravado),
    // confidence NÃO pode ser alta. Trava em 50% (média). Antes essa fórmula
    // somava +20% por "sem incompatibilidade cravada" + 30% modelos + 30% refinamento
    // = 80% ALTA pra combinações que o LJ não sabia identificar (caso B2C+Atacado).
    // Honestidade ativa: sem classificação, não há confiança alta possível.
    if (cls && cls.fallback) return Math.min(0.5, total);
    return total;
  },

  // V40.12.2 — Sprint 4 prep: detecta Audiência fundida com catálogo desatualizado.
  // Retorna true quando audience.versions.atoms < CATALOG_VERSION atual.
  // Permite UI mostrar banner "Atualize sua Audiência" opcional não-bloqueante.
  isAudienceStale(audience) {
    if (!audience || !audience.versions) return true;  // legados pré-V40.12.0 = stale
    const current = this._atomsVersion();
    const carimbo = audience.versions.atoms || '0.0.0';
    return carimbo !== current;
  },

  // V40.12.0 — Retrocompat: expõe getters pros consumidores que ainda
  // referenciam ATOMS_NEGOCIO/ATOMS_OPERACIONAL etc direto no engine.
  // Auditei o código antes de remover: audienceCollectionAdvisor.js, modal,
  // appActions só chamam fuse() — ninguém lê constants direto. Mas defino
  // os getters por segurança, custo zero.
  get NUCLEO_COMUM()      { return this._nucleo(); },
  get ATOMS_NEGOCIO()     { return this._catalog().ATOMS_NEGOCIO || {}; },
  get ATOMS_OPERACIONAL() { return this._catalog().ATOMS_OPERACIONAL || {}; },
  get INCOMPATIBILIDADES() { return this._incompatibilidades(); },
  get DEDUPE_PAIRS()      { return this._dedupePairs(); },

  // Fusão principal — chama os 8 passos da KB §5
  // V40.12.1 — Sprint 2: 3º parâmetro `refinamento` opcional (ticket, ciclo,
  // time_comercial, tracking_maduro). Não afeta PA/ICP/BP — só viaja na
  // Audiência salva pra ser consumido por Velocidade/RevOps/Djow depois.
  fuse(modeloNegocio, modeloOperacional, refinamento = null) {
    const negocio = this._atomNegocio(modeloNegocio);
    const operacional = this._atomOperacional(modeloOperacional);
    if (!negocio || !operacional) {
      return { ok: false, error: 'Modelo de Negócio ou Operacional inválido.' };
    }

    // Passo 1 — Núcleo comum
    let fields = this._nucleo().map(f => ({ ...f, origem: 'nucleo' }));
    const notas = [];

    // Passo 2 — Aplica átomo de Negócio
    negocio.contribui.forEach(c => fields.push({ ...c, origem: 'negocio' }));
    if (negocio.remove?.length) {
      fields = fields.filter(f => !negocio.remove.includes(f.key));
    }
    if (negocio.notas) notas.push({ origem: 'negocio', texto: negocio.notas });

    // Passo 3 — Aplica átomo Operacional
    // 3.1 — refina (ex: E-commerce: geo → geo_entregavel)
    if (operacional.refina) {
      Object.entries(operacional.refina).forEach(([from, to]) => {
        fields = fields.filter(f => f.key !== from);
      });
    }
    operacional.contribui.forEach(c => fields.push({ ...c, origem: 'operacional' }));
    if (operacional.notas) notas.push({ origem: 'operacional', texto: operacional.notas });

    // Passo 4 — Dedupe (pares conhecidos que se sobrepõem)
    this._dedupePairs().forEach(pair => {
      const presentes = fields.filter(f => pair.conceitos.includes(f.key));
      if (presentes.length > 1) {
        const vencedor = presentes.find(f => f.origem === 'operacional') || presentes[0];
        fields = fields.filter(f => !pair.conceitos.includes(f.key) || f.key === vencedor.key);
      }
    });

    // Passo 5 — Resolve unidade (vencedor: Negócio, salvo Marketplace bilateraliza)
    let unidade = negocio.unidade;
    let bilateral = unidade === 'BILATERAL';
    if (operacional.bilateraliza) {
      bilateral = true;
      if (unidade === 'PJ') unidade = 'BILATERAL_PJ';
      else if (unidade === 'PF') unidade = 'BILATERAL_PF';
      notas.push({ origem: 'marketplace', texto: 'Marketplace IMPÔS 2 lados sobre o Negócio. Geramos 2 perfis sob este produto.' });
    }

    // Passo 6 — Regras de incompatibilidade
    const incomp = this._incompatibilidades().find(r =>
      r.par.negocio === modeloNegocio && r.par.operacional === modeloOperacional
    );
    if (incomp) {
      incomp.acao.rebaixar?.forEach(k => {
        const f = fields.find(x => x.key === k);
        if (f) f.optional = true;
      });
      if (incomp.acao.remover?.length) {
        fields = fields.filter(f => !incomp.acao.remover.includes(f.key));
      }
      if (incomp.acao.aviso) {
        notas.push({ origem: 'incompatibilidade', texto: incomp.acao.aviso });
      }
    }

    // Passo 7 — Monta obrigatórios por camada + denominadores
    const pa  = fields.filter(f => f.layer === 'pa');
    const icp = fields.filter(f => f.layer === 'icp');
    const bp  = fields.filter(f => f.layer === 'bp');

    const obrigatoriosPa  = pa.filter(f => !f.optional);
    const obrigatoriosIcp = icp.filter(f => !f.optional);
    const obrigatoriosBp  = bp.filter(f => !f.optional);

    // Passo 8 — Entrega
    // V40.12.1 — Refinamento entra no output. Não muda PA/ICP/BP — viaja como
    // metadados pra ser consumido por Velocidade/RevOps/Djow/Score depois.
    const refinamentoNormalizado = (refinamento && typeof refinamento === 'object')
      ? {
          ticket:           refinamento.ticket || null,
          ciclo:            refinamento.ciclo || null,
          time_comercial:   refinamento.time_comercial || null,
          tracking_maduro:  refinamento.tracking_maduro || null
        }
      : null;

    return {
      ok: true,
      modeloNegocio,
      modeloOperacional,
      negocioLabel: negocio.label,
      operacionalLabel: operacional.label,
      unidade,
      bilateral,
      pa,
      icp,
      bp,
      requiredCounts: {
        pa: obrigatoriosPa.length,
        icp: obrigatoriosIcp.length,
        bp: obrigatoriosBp.length
      },
      notas,
      refinamento: refinamentoNormalizado,
      // V40.12.0 — Carimbo de versões pra auditoria + migração futura.
      // Audiência salva (em product.audience) deve copiar essas 3 versões.
      versions: {
        atoms: this._atomsVersion(),
        rules: this._rulesVersion(),
        engine: this.ENGINE_VERSION,
        fusedAt: new Date().toISOString()
      }
    };
  }
};

window.AudienceFusionEngine = AudienceFusionEngine;
