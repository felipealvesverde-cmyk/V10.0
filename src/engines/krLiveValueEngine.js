// V35.10.0-alpha2 — KR Live Value Engine.
//
// Computa o valor "atual" (current) de um KR-mãe em tempo real, lendo das
// fontes apontadas pelos metadados do Djow (kr.djowMeta).
//
// Regras:
//   - KR sem djowMeta → manual. Retorna kr.current (o que o cliente digitou).
//   - KR atômico com selectedSources Google Ads → soma do campo apontado
//     das ads vinculadas a Campanhas LJ do produto, filtradas pela área
//     do KR (Marketing/Vendas/CS).
//   - KR derivado (formula) → alpha3 (não implementado nesta alpha).
//
// Filosofia: o engine é pure compute (sem side effects). Toma kr + state
// como input, devolve número. UI consome.

window.KrLiveValueEngine = {
  /**
   * Computa o current ao vivo de um KR + status vs meta + trend vs ontem.
   * @param {Object} kr — { productKr } com djowMeta
   * @param {Object|null} ctx — contexto opcional ({ state, productId })
   * @returns {{
   *   value: number,
   *   source: 'manual'|'live'|'derived',
   *   error?: string,
   *   status: { tier, color, label },
   *   progress: { vsSafe, vsStretch, normalized },
   *   trend: { direction, delta, color, snapshotValue, snapshotDate } | null,
   *   shouldSnapshot: boolean,
   *   newSnapshot: { value, date } | null
   * }}
   */
  computeCurrentValue(kr, ctx = {}) {
    if (!kr) return this._wrap(0, 'manual', kr);
    const meta = kr.djowMeta;
    let raw;
    // Sem djowMeta = manual, retorna o que o cliente digitou
    if (!meta || !meta.classification || meta.classification === 'manual') {
      raw = { value: Number(kr.current || 0), source: 'manual' };
    } else if (meta.classification === 'derived') {
      raw = this._computeDerived(kr, ctx);
    } else if (meta.classification === 'atomic') {
      raw = this._computeAtomic(kr, ctx);
    } else {
      raw = { value: Number(kr.current || 0), source: 'manual' };
    }
    return this._wrap(raw.value, raw.source, kr, raw.error);
  },

  // V35.12.0 — Enriquece result com status + progress + trend + snapshot hint.
  _wrap(value, source, kr, error) {
    const direction = (kr?.djowMeta?.direction === 'lower') ? 'lower' : 'higher';
    const targetSafe = Number(kr?.targetCommitted ?? 0);
    const targetStretch = Number(kr?.targetStretch ?? 0);

    // Progress vs metas — direction-aware.
    // higher: progress = current/target (mais é melhor)
    // lower:  progress = target/current (menos é melhor; ultrapassar pra baixo = >100%)
    const calcProgress = (target) => {
      if (!target) return 0;
      if (direction === 'higher') {
        return Math.max(0, Math.round((value / target) * 100));
      }
      // lower: se value=0, "infinito" (capa em 200%)
      if (value <= 0) return 200;
      return Math.max(0, Math.round((target / value) * 100));
    };
    const vsSafe = calcProgress(targetSafe);
    const vsStretch = calcProgress(targetStretch);

    // Status tier:
    //   stretch: >=100% vs stretch
    //   safe:    >=100% vs safe (mas <100% vs stretch)
    //   onway:   >=70% vs safe
    //   below:   <70% vs safe
    //   nometa:  sem targetSafe definido
    let tier, color, label;
    if (!targetSafe) {
      tier = 'nometa'; color = 'slate'; label = 'Sem meta';
    } else if (targetStretch && vsStretch >= 100) {
      tier = 'stretch'; color = 'yellow'; label = 'Sonho atingido';
    } else if (vsSafe >= 100) {
      tier = 'safe'; color = 'emerald'; label = 'Meta segura batida';
    } else if (vsSafe >= 70) {
      tier = 'onway'; color = 'amber'; label = 'Em curso';
    } else {
      tier = 'below'; color = 'red'; label = 'Abaixo da meta';
    }

    // Trend vs snapshot do dia anterior. Lógica de 2 buckets:
    //   snapshotValue/snapshotDate          = baseline do dia ATUAL
    //   previousSnapshotValue/Date          = baseline do dia anterior (ou null)
    // Trend = value - previousSnapshotValue (se existe previous).
    // Quando dia vira, snapshot atual rola pra previous (via Actions._processKrSnapshots).
    const today = this._todayYmd();
    const snapDate = kr?.snapshotDate || null;
    const snapValue = (kr?.snapshotValue != null) ? Number(kr.snapshotValue) : null;
    const prevDate = kr?.previousSnapshotDate || null;
    const prevValue = (kr?.previousSnapshotValue != null) ? Number(kr.previousSnapshotValue) : null;
    let trend = null;
    let shouldSnapshot = false;
    let newSnapshot = null;

    // Trend só aparece se temos baseline anterior (previous).
    if (prevValue != null && prevDate) {
      const delta = value - prevValue;
      let dir = 'flat';
      if (Math.abs(delta) > 0.0001) dir = (delta > 0) ? 'up' : 'down';
      let trendColor = 'slate';
      if (dir === 'up')   trendColor = direction === 'higher' ? 'emerald' : 'red';
      if (dir === 'down') trendColor = direction === 'higher' ? 'red'     : 'emerald';
      trend = { direction: dir, delta, color: trendColor, snapshotValue: prevValue, snapshotDate: prevDate };
    }

    // shouldSnapshot indica que o caller deve atualizar os buckets:
    //   - Sem snap atual → cria primeiro snap (sem trend ainda)
    //   - snapDate < today → rola atual pra previous, cria novo current
    if (!snapDate || snapDate !== today) {
      shouldSnapshot = true;
      newSnapshot = {
        value,
        date: today,
        // Se já tinha snap (de um dia anterior), ele vira o novo previous.
        // Se NÃO tinha (1ª vez), previous fica null (vai aparecer no próximo dia).
        rollPrevious: Boolean(snapDate)
      };
    }

    return {
      value,
      source,
      error,
      status: { tier, color, label },
      progress: { vsSafe, vsStretch, normalized: Math.min(120, vsSafe) },
      trend,
      shouldSnapshot,
      newSnapshot
    };
  },

  _todayYmd() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  },

  _computeAtomic(kr, ctx) {
    const state = ctx.state || (window.App?.state) || {};
    const productId = ctx.productId || this._findProductIdForKr(kr, state);
    if (!productId) return { value: 0, source: 'live', error: 'no-product' };

    const sources = (kr.djowMeta?.selectedSources || []);
    if (!sources.length) return { value: 0, source: 'live', error: 'no-sources' };

    // Filtra Campanhas LJ do produto na área do KR.
    const area = String(kr.area || '').toLowerCase();
    const areaToSector = { marketing: 'Marketing', vendas: 'Vendas', cs: 'CS' };
    const sectorMatch = areaToSector[area] || null;

    const ljCampaigns = (Array.isArray(state.campaigns) ? state.campaigns : [])
      .filter(c => Number(c.productId) === Number(productId))
      .filter(c => !sectorMatch || String(c.sector || '').toLowerCase() === sectorMatch.toLowerCase());

    if (!ljCampaigns.length) return { value: 0, source: 'live', error: 'no-campaigns-in-area' };

    // Junta external IDs de Google Ads dessas Campanhas LJ.
    const linkedExternalIds = new Set();
    ljCampaigns.forEach(c => (c.externalLinks?.googleAds || []).forEach(id => linkedExternalIds.add(String(id))));

    let total = 0;
    let touchedAnySource = false;

    sources.forEach(src => {
      if (!src) return;
      // V35.11.4 — Self-heal: deriva integration_id/field do src.id se vierem
      // null (KRs criados via fallback local antes da V35.11.4 ficaram assim).
      const integrationId = src.integration_id || this._deriveIntegrationFromId(src.id);
      const field = src.field || this._deriveFieldFromId(src.id);
      if (!integrationId) return;
      if (integrationId === 'google_ads') {
        const fieldKey = this._gadsFieldToCacheKey(field);
        if (!fieldKey) return;
        const allAds = Array.isArray(state.googleAdsCampaignsCache) ? state.googleAdsCampaignsCache : [];
        let sum = 0;
        allAds.forEach(ad => {
          if (!linkedExternalIds.has(String(ad.campaign_id))) return;
          sum += Number(ad.metrics_30d?.[fieldKey] || 0);
        });
        total += sum;
        touchedAnySource = true;
      }
      // V35.14.6 — GA4 como fonte de KR ao vivo.
      // Não tem conceito de "campanha vinculada" — GA4 mede a propriedade
      // inteira. Pra restringir por área (Marketing/Vendas/CS), filtro
      // por sessionDefaultChannelGroup quando o KR é setorial. Senão soma
      // todas as rows do cache.
      if (integrationId === 'ga4') {
        if (!field) return;
        const cache = state.ga4ReportsCache || {};
        const rows = Array.isArray(cache.rows) ? cache.rows : [];
        let sum = 0;
        for (const row of rows) {
          // Se KR é setorial, opcionalmente filtra por channel group
          if (sectorMatch) {
            const channel = (row.dimensions || {}).sessionDefaultChannelGroup || '';
            // Marketing → tudo exceto Direct (origem trabalho/colaboração)
            // Vendas/CS → não filtra (não tem mapping óbvio em GA4)
            if (sectorMatch === 'Marketing' && channel === 'Direct') continue;
          }
          const v = Number((row.metrics || {})[field]);
          if (Number.isFinite(v)) sum += v;
        }
        total += sum;
        touchedAnySource = true;
      }
      // V35.10+ : rd_station, hotmart, clickup, etc viriam aqui
    });

    if (!touchedAnySource) return { value: 0, source: 'live', error: 'no-supported-source' };

    // Arredonda pra 2 casas pra R$ ou 0 pra quantidade
    const unit = kr.metric || '';
    if (unit === 'reais') total = Math.round(total * 100) / 100;
    else if (unit === 'percentual') total = Math.round(total * 100) / 100;
    else total = Math.round(total);

    return { value: total, source: 'live' };
  },

  // V35.11.4 — Self-heal helpers: derivam integration_id/field do src.id
  // pra KRs que foram criados com selectedSources incompletos (fallback
  // local pré-V35.11.4 setava só { id, label } sem integration_id+field).
  _deriveIntegrationFromId(id) {
    if (!id || typeof id !== 'string') return null;
    if (id.startsWith('gads::'))    return 'google_ads';
    if (id.startsWith('ga4::'))     return 'ga4';
    if (id.startsWith('rd::'))      return 'rd_station';
    if (id.startsWith('hotmart::')) return 'hotmart';
    if (id.startsWith('clickup::')) return 'clickup';
    return null;
  },
  _deriveFieldFromId(id) {
    if (!id || typeof id !== 'string') return null;
    if (id.startsWith('gads::')) {
      const key = id.slice(6);
      const map = {
        impressions: 'metrics.impressions',
        clicks: 'metrics.clicks',
        ctr: 'metrics.ctr',
        cpc: 'metrics.average_cpc',
        cpm: 'metrics.average_cpm',
        conversions: 'metrics.conversions',
        receita_atribuida: 'metrics.conversions_value',
        gasto: 'metrics.cost_micros',
        cpa: 'metrics.cost_per_conversion'
      };
      return map[key] || null;
    }
    // V35.14.6 — GA4 fields: nome após "ga4::" já é o apiName camelCase.
    // Ex: "ga4::sessions" → "sessions" → busca em row.metrics.sessions.
    // Custom metrics que cliente nomeou no GA4 também caem aqui direto.
    if (id.startsWith('ga4::'))     return id.slice(5);
    if (id.startsWith('rd::'))      return id.slice(4);
    if (id.startsWith('hotmart::')) return id.slice(9);
    if (id.startsWith('clickup::')) return id.slice(9);
    return null;
  },

  // GAQL field → cache key. Mapping curto pro que tá no mock + sync real.
  _gadsFieldToCacheKey(field) {
    if (!field) return null;
    const f = String(field);
    if (f.includes('cost_micros') || f.includes('cost_brl')) return 'cost_brl';
    if (f === 'metrics.impressions') return 'impressions';
    if (f === 'metrics.clicks') return 'clicks';
    if (f === 'metrics.ctr') return 'ctr';
    if (f === 'metrics.average_cpc') return 'average_cpc';
    if (f === 'metrics.average_cpm') return 'average_cpm';
    if (f === 'metrics.conversions') return 'conversions';
    if (f === 'metrics.conversions_value') return 'conversions_value';
    if (f === 'metrics.cost_per_conversion') return 'cost_per_conversion';
    return null;
  },

  // V35.10.0-alpha3 — Fórmulas derivadas (LTV, CAC, ROAS, LTV/CAC, etc).
  // Pega selectedSources (que pra derivados são insumos) e aplica a
  // fórmula. Cada insumo pode ser:
  //   - uma natureza atômica conhecida (nature_id) → resolve lendo do
  //     cache da fonte como se fosse atômico
  //   - referência a outro KR já criado (kr_id) → recursivo
  //   - manual com default (ex: retencao_meses = 12)
  _computeDerived(kr, ctx) {
    const meta = kr.djowMeta;
    const formulaId = meta.formulaId;
    if (!formulaId) return { value: Number(kr.current || 0), source: 'manual', error: 'no-formula' };

    const inputs = (meta.selectedSources || []);
    // Resolve cada insumo num número
    const resolved = {};
    inputs.forEach(input => {
      const key = input.input_id || input.id;
      // Se o insumo tem default e nenhuma fonte, usa default
      if (input.default != null && (!input.integration_id && !input.nature_id && !input.kr_ref)) {
        resolved[key] = Number(input.default);
        return;
      }
      // Se referencia outro KR, busca e computa
      if (input.kr_ref) {
        const otherKr = this._findKrById(input.kr_ref, ctx);
        if (otherKr) {
          resolved[key] = this.computeCurrentValue(otherKr, ctx).value;
          return;
        }
      }
      // Se referencia natureza atômica + fonte, calcula como atômico
      if (input.integration_id && input.field) {
        const pseudoKr = { ...kr, djowMeta: { ...meta, classification: 'atomic', selectedSources: [input] } };
        resolved[key] = this._computeAtomic(pseudoKr, ctx).value;
        return;
      }
      resolved[key] = 0;
    });

    // Aplica fórmula simbólica (suporta operadores básicos + variáveis)
    const formula = meta.formulaSymbolic || '';
    if (!formula) return { value: Number(kr.current || 0), source: 'manual', error: 'no-formula-symbolic' };
    let result;
    try {
      result = this._evalFormula(formula, resolved);
    } catch (_) {
      return { value: Number(kr.current || 0), source: 'manual', error: 'formula-eval-failed' };
    }
    if (!isFinite(result)) result = 0;
    const unit = kr.metric || '';
    if (unit === 'reais') result = Math.round(result * 100) / 100;
    else if (unit === 'percentual') result = Math.round(result * 100) / 100;
    else result = Math.round(result * 100) / 100;
    return { value: result, source: 'derived' };
  },

  // Avalia uma fórmula simples (apenas operadores +, -, *, /, parênteses,
  // variáveis alfanuméricas). Substitui variáveis pelos valores resolvidos.
  // NÃO usa eval direto — substituição + Function() controlada com whitelist.
  _evalFormula(formula, vars) {
    // Substitui variáveis pelo número
    let expr = formula;
    Object.keys(vars).forEach(name => {
      const safe = String(name).replace(/[^a-zA-Z0-9_]/g, '');
      if (!safe) return;
      const re = new RegExp(`\\b${safe}\\b`, 'g');
      expr = expr.replace(re, `(${Number(vars[name])})`);
    });
    // Whitelist: só dígitos, ponto, espaço, operadores e parênteses sobram
    if (!/^[\d.\s+\-*/()]+$/.test(expr)) throw new Error('Formula contém tokens não-numéricos: ' + expr);
    // eslint-disable-next-line no-new-func
    return Function(`"use strict"; return (${expr});`)();
  },

  _findKrById(krId, ctx) {
    if (!window.StrategicMapEngine) return null;
    const state = ctx.state || (window.App?.state);
    if (!state?.products) return null;
    for (const p of state.products) {
      const krs = StrategicMapEngine.getProductKrs(p.id) || [];
      const found = krs.find(k => k.id === krId);
      if (found) return found;
    }
    return null;
  },

  _findProductIdForKr(kr, state) {
    if (!state.products) return null;
    // Itera produtos pra encontrar qual contém esse KR
    if (!window.StrategicMapEngine) return null;
    for (const p of state.products) {
      const krs = StrategicMapEngine.getProductKrs(p.id) || [];
      if (krs.some(k => k.id === kr.id)) return p.id;
    }
    return null;
  }
};
