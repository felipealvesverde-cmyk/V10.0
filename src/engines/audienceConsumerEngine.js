// V40.12.3 — Engine consumidor da Audiência.
//
// Sprint 4 da Onda V2 do "Definir Audiência" (Felipe 2026-06-23).
//
// O QUE FAZ: helper estático que outros módulos chamam pra ler a Audiência
// de um produto + obter as consequências do arquétipo. Faz a ponte entre:
//
//   product.audience.archetypeKey  ←→  AudienceConsequencesCatalog.ARCHETYPES[key]
//
// Quando produto não tem audiência OU tem audiência sem arquétipo (legado V40.12.0):
//   - getAudience: retorna null
//   - getArchetype: retorna FALLBACK
//   - getVelocityLabels: retorna labels genéricos (Visitas/Conversão/Ticket/Ciclo)
//
// Lei [[feedback_no_source_no_dash]]: módulos consumidores tratam null como
// "placeholder honesto" — nada inventado.
//
// CONSUMIDORES (Sprint 4 conecta progressivamente):
//   ✅ Card de Velocidade (revopsVelocity.js) — V40.12.3 (esta sprint)
//   ⏳ Djow lateral (djow*.js) — futuro
//   ⏳ RevOps Equilíbrio (revopsWhitelabelPanel.js) — futuro
//   ⏳ Score Engine — futuro
//   ⏳ Mapa da Receita — futuro

(function() {
  'use strict';

  // Cache anti-thrashing: chamadas em loop dentro de 1 render não recalculam.
  // Limpa quando App.render() dispara (módulos consumidores chamam clearCache()).
  let _cache = new Map();

  const AudienceConsumerEngine = {
    clearCache() {
      _cache.clear();
    },

    // Retorna a Audiência salva no produto OU null.
    getAudience(productId) {
      if (productId == null) return null;
      const cacheKey = `aud:${productId}`;
      if (_cache.has(cacheKey)) return _cache.get(cacheKey);
      const p = (window.App?.state?.products || []).find(x => Number(x.id) === Number(productId));
      const result = p?.audience || null;
      _cache.set(cacheKey, result);
      return result;
    },

    // Retorna o arquétipo (objeto do AudienceConsequencesCatalog) ou FALLBACK.
    getArchetype(productId) {
      const cacheKey = `arch:${productId}`;
      if (_cache.has(cacheKey)) return _cache.get(cacheKey);
      const aud = this.getAudience(productId);
      const cat = window.AudienceConsequencesCatalog;
      if (!cat) { _cache.set(cacheKey, null); return null; }
      const key = aud?.archetypeKey;
      const arch = key ? cat.ARCHETYPES?.[key] : null;
      const result = arch || cat.FALLBACK || null;
      _cache.set(cacheKey, result);
      return result;
    },

    // Retorna o KEY do arquétipo (string) ou null. Útil pra UI mostrar etiqueta.
    getArchetypeKey(productId) {
      const aud = this.getAudience(productId);
      return aud?.archetypeKey || null;
    },

    // Retorna labels V·C·L·T do card de Velocidade adaptados ao arquétipo.
    // Fallback (sem audiência ou sem arquétipo): labels genéricos universais.
    getVelocityLabels(productId) {
      const arch = this.getArchetype(productId);
      const vel = arch?.velocidade;
      return {
        V: vel?.v_label || 'Visitas',
        C: vel?.c_label || 'Conversão',
        L: vel?.l_label || 'Ticket',
        T: vel?.t_label || 'Ciclo',
        source: vel?.v_source || null,
        diagnostico: vel?.diagnostico || null
      };
    },

    // Pra Djow lateral lidar com tom + foco. Null quando não tem arquétipo.
    getDjowConfig(productId) {
      const arch = this.getArchetype(productId);
      return arch?.djow || null;
    },

    // Pra RevOps mostrar ranges saudáveis. Null quando não tem arquétipo.
    getRevopsConfig(productId) {
      const arch = this.getArchetype(productId);
      return arch?.revops || null;
    },

    // Pra Score Engine pegar pesos. Null quando não tem arquétipo.
    getScoreConfig(productId) {
      const arch = this.getArchetype(productId);
      return arch?.score || null;
    },

    // Pra Mapa da Receita propor KRs. Null quando não tem arquétipo.
    getMapaConfig(productId) {
      const arch = this.getArchetype(productId);
      return arch?.mapa || null;
    },

    // V40.13.0 — Cor semântica do arquétipo pra pele dos consumidores
    // visualmente adaptativos (Card de Velocidade, Djow lateral, etc).
    // Quando arquétipo não tem `accent` definido (FALLBACK) ou catálogo
    // legado (V1.0.0 sem o campo), retorna slate genérico.
    getAccent(productId) {
      const arch = this.getArchetype(productId);
      return arch?.accent || '#64748B';
    },

    // Detecta Audiência legada/desatualizada — Sprint 4 final: mostra banner.
    // Critérios:
    //   - Produto não tem audience configurada → 'no_audience'
    //   - audience.versions ausente (pré-V40.12.0) → 'legacy_no_versions'
    //   - audience.archetypeKey null/ausente (V40.12.0/V40.12.1 sem reclassify) → 'legacy_no_archetype'
    //   - audience.versions.atoms < CATALOG_VERSION atual → 'stale_catalog'
    //   - audience.consequencesVersion < CONSEQUENCES_VERSION atual → 'stale_consequences'
    //   - tudo OK → null
    diagnoseStaleness(productId) {
      const aud = this.getAudience(productId);
      if (!aud || !aud.configured) return { status: 'no_audience',          severity: 'high'   };
      if (!aud.versions)            return { status: 'legacy_no_versions',  severity: 'medium' };
      if (!aud.archetypeKey)        return { status: 'legacy_no_archetype', severity: 'medium' };
      const catVer = window.AudienceAtomsCatalog?.CATALOG_VERSION;
      const consVer = window.AudienceConsequencesCatalog?.CONSEQUENCES_VERSION;
      if (catVer && aud.versions.atoms !== catVer) return { status: 'stale_catalog', severity: 'low' };
      if (consVer && aud.consequencesVersion !== consVer) return { status: 'stale_consequences', severity: 'low' };
      return null;
    }
  };

  window.AudienceConsumerEngine = AudienceConsumerEngine;
})();
