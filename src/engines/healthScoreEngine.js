// V38.1.0 — Saúde do Produto.
//
// Fórmula cravada com Felipe (2026-06-15):
//
//   Saúde = K × (0.4 × E + 0.4 × C + 0.2 × R) × 100
//
// 4 dimensões:
//   E (Eficácia, peso 40%) — % de tasks concluídas das tasks vinculadas a ações
//   C (Cobertura, peso 40%) — % das 3 áreas (M/V/CS) com KR confirmado
//   K (KR Health, MULTIPLICADOR) — média ponderada do status dos KRs
//   R (Resultado, peso 20%) — vendas_realizadas / soma_metaVendas das ofertas
//
// K é multiplicador (não peso) — produto sem KR confirmado tem K=0 → Saúde=0.
// Felipe: "produto sem KR nunca vai estar com uma saúde boa".
//
// Detalhes completos em /knowledge-base/health-score.md.

window.HealthScoreEngine = {
  AREAS: ['marketing', 'vendas', 'cs'],

  // ────────────────────────────────────────────────────────────
  // FATORES (cada um retorna 0..1)
  // ────────────────────────────────────────────────────────────

  _eficacia(productId) {
    if (!window.OperationalAggregationEngine) return { value: 0, total: 0, done: 0 };
    const m = OperationalAggregationEngine.productMetrics(productId);
    const total = m.executionsTotal || 0;
    const done = m.executionsDone || 0;
    return {
      value: total > 0 ? done / total : 0,
      total,
      done
    };
  },

  _cobertura(productId) {
    if (!window.StrategicMapEngine?.getForProduct) {
      return { value: 0, areasComKr: [], areasFaltantes: [...this.AREAS] };
    }
    // V38.1.6 — V29.0.0 moveu KRs pra branches (strategicCampaignMaps) por
    // campanha. O objectives no strategicMaps[productId] é LEGACY V28 (vazio
    // em produto novo). Junta branches + legado + productKrs pra cobertura.
    const allObjectives = this._collectAllObjectives(productId);
    const areasComKr = [];
    this.AREAS.forEach(area => {
      const hasConfirmedKr = allObjectives.some(o =>
        String(o.area || '').toLowerCase() === area &&
        (o.okrs || []).some(kr => kr.confirmed)
      );
      if (hasConfirmedKr) areasComKr.push(area);
    });
    const areasFaltantes = this.AREAS.filter(a => !areasComKr.includes(a));
    return {
      value: areasComKr.length / 3,
      areasComKr,
      areasFaltantes
    };
  },

  // V38.1.6 — Junta objectives de TODAS as fontes do produto:
  //   - legacy V28: strategicMaps[productId].objectives (vazio em produto novo)
  //   - branches V29: strategicCampaignMaps onde productId === alvo
  // Cada branch contribui suas próprias áreas (M/V/CS) e KRs filhos.
  _collectAllObjectives(productId) {
    const out = [];
    // Legado V28
    const legacyMap = StrategicMapEngine.getForProduct(productId) || {};
    (legacyMap.objectives || []).forEach(o => out.push(o));
    // Branches V29
    if (typeof StrategicMapEngine.getBranchesByProduct === 'function') {
      const branches = StrategicMapEngine.getBranchesByProduct(productId) || [];
      branches.forEach(b => (b.objectives || []).forEach(o => out.push(o)));
    }
    return out;
  },

  // K — multiplicador. Sem KR confirmado, retorna 0 (zerando Saúde inteira).
  // V38.1.4 — Retorna também krsRascunhoCount + visionPresent pra modal explicar.
  // V38.1.6 — Lê de TODAS as fontes (legado V28 + branches V29).
  _krHealth(productId) {
    if (!window.StrategicMapEngine?.getForProduct || !window.strategicOkrEngine) {
      return { value: 0, krs: [], krsConfirmadosCount: 0, krsRascunhoCount: 0, krsTotalCount: 0, visionPresent: false };
    }
    const map = StrategicMapEngine.getForProduct(productId) || {};
    const allObjectives = this._collectAllObjectives(productId);
    const allKrs = allObjectives.flatMap(o => o.okrs || []);
    const confirmedKrs = allKrs.filter(k => k.confirmed);
    const rascunhoKrs = allKrs.filter(k => !k.confirmed);
    const visionPresent = !!String(map.vision || '').trim();

    if (!confirmedKrs.length) {
      return {
        value: 0,
        krs: [],
        krsConfirmadosCount: 0,
        krsRascunhoCount: rascunhoKrs.length,
        krsTotalCount: allKrs.length,
        visionPresent
      };
    }

    const weights = confirmedKrs.map(kr => {
      const current = Number(kr.current || 0);
      if (current === 0) return { kr, weight: 0, tier: 'parado', label: 'Parado' };
      const status = strategicOkrEngine.scoreStatus(kr);
      let weight = 0.2;
      let tier = 'risk';
      if (status.tier === 'success' && (status.label || '').includes('Avançada')) {
        weight = 1.0; tier = 'avancada';
      } else if (status.tier === 'success') {
        weight = 0.8; tier = 'segura';
      } else if (status.tier === 'progress') {
        weight = 0.5; tier = 'progresso';
      }
      return { kr, weight, tier, label: status.label };
    });

    const sum = weights.reduce((s, w) => s + w.weight, 0);
    return {
      value: sum / confirmedKrs.length,
      krs: weights,
      krsConfirmadosCount: confirmedKrs.length,
      krsRascunhoCount: rascunhoKrs.length,
      krsTotalCount: allKrs.length,
      visionPresent
    };
  },

  _resultado(productId) {
    // Meta consolidada = soma das metas das ofertas do produto
    const cfg = App.state.revopsFinanceV2?.[productId];
    const offers = cfg?.offers || [];
    const metaConsolidada = offers.reduce((s, o) => s + (Number(o.metaVendas) || 0), 0);

    // V38.1.0 — Vendas realizadas vem da integração checkout (Hotmart).
    // Quando produto NÃO tem checkout vinculado ou Hotmart desconectado,
    // vendas = null (não é zero — é "desconhecido"). UI explica.
    // TODO V38.x: ler de hotmart-dashboard-metrics quando productIdHotmart
    // estiver vinculado. Por enquanto, vendas = null.
    const vendasRealizadas = null;
    const hasCheckoutConnected = false;

    if (vendasRealizadas === null || !hasCheckoutConnected) {
      return {
        value: 0,
        metaConsolidada,
        vendasRealizadas: null,
        hasCheckoutConnected: false,
        hasMeta: metaConsolidada > 0
      };
    }

    return {
      value: metaConsolidada > 0 ? Math.min(vendasRealizadas / metaConsolidada, 1) : 0,
      metaConsolidada,
      vendasRealizadas,
      hasCheckoutConnected: true,
      hasMeta: metaConsolidada > 0
    };
  },

  // ────────────────────────────────────────────────────────────
  // SCORE PRINCIPAL
  // ────────────────────────────────────────────────────────────

  compute(productId) {
    const eficacia = this._eficacia(productId);
    const cobertura = this._cobertura(productId);
    const krHealth = this._krHealth(productId);
    const resultado = this._resultado(productId);

    const E = eficacia.value;
    const C = cobertura.value;
    const K = krHealth.value;
    const R = resultado.value;

    const base = (0.4 * E) + (0.4 * C) + (0.2 * R);
    const score = Math.round(K * base * 100);

    // V38.1.4 — Estado "em construção": produto recém-criado sem NADA cadastrado.
    // Evita gritar "CRÍTICO" no rosto do cliente que acabou de criar o produto.
    // Critério: tudo zero E nenhum cadastro mínimo (0 tasks + 0 KRs + 0 ofertas
    // com meta + sem checkout). Visualmente vira tier violet "Em construção".
    const isBuilding = (
      (eficacia.total || 0) === 0 &&
      (krHealth.krsTotalCount || 0) === 0 &&
      (cobertura.areasComKr || []).length === 0 &&
      (resultado.metaConsolidada || 0) === 0 &&
      !resultado.hasCheckoutConnected
    );

    // Identifica gargalo: a dimensão que MAIS poderia subir o score.
    // Se K=0, gargalo é KRs (multiplicador é o pior caso).
    const gargalo = (() => {
      if (isBuilding) return { dim: 'building', label: 'Em construção', reason: 'Produto recém-criado — vamos cadastrar as primeiras peças?' };
      if (K === 0) return { dim: 'krs', label: 'KRs (multiplicador)', reason: 'Sem KR confirmado — Saúde zerada' };
      const ranking = [
        { dim: 'krs',      label: 'KRs',        miss: 1 - K },
        { dim: 'eficacia', label: 'Eficácia',   miss: (1 - E) * 0.4 },
        { dim: 'cobertura', label: 'Cobertura', miss: (1 - C) * 0.4 },
        { dim: 'resultado', label: 'Conversão', miss: (1 - R) * 0.2 }
      ].sort((a, b) => b.miss - a.miss);
      return { dim: ranking[0].dim, label: ranking[0].label, reason: null };
    })();

    return {
      score,
      isBuilding,
      tier: isBuilding ? { label: 'Em construção', color: 'violet' } : this._tier(score),
      gargalo,
      fatores: {
        eficacia: { weight: 0.4, value: E, ...eficacia, contribuiPts: Math.round(K * 0.4 * E * 100) },
        cobertura: { weight: 0.4, value: C, ...cobertura, contribuiPts: Math.round(K * 0.4 * C * 100) },
        krs: { weight: 'multiplicador', value: K, ...krHealth },
        resultado: { weight: 0.2, value: R, ...resultado, contribuiPts: Math.round(K * 0.2 * R * 100) }
      }
    };
  },

  _tier(score) {
    if (score >= 80) return { label: 'Saudável', color: 'emerald' };
    if (score >= 50) return { label: 'Em alerta', color: 'amber' };
    if (score >= 20) return { label: 'Em risco', color: 'orange' };
    return { label: 'Crítico', color: 'rose' };
  }
};
