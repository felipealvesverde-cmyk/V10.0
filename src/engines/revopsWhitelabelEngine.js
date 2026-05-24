// V32.8.0 (RevOps Whitelabel — Onda 1) — Engine novo: DRE operacional whitelabel
// sem categorias hard-coded. Cada cliente preenche conforme operação dele.
//
// Substitui (mas coexiste) com revopsFinanceEngine.js V14, que tinha 4 categorias
// fixas (software/people/structure/others) + acquisitionCosts + variableCosts
// como blocos separados. Aqui tudo vira GRUPOS DINÂMICOS com handles internos
// fixos, fórmulas cross-referenciáveis e 5 modos de cálculo.
//
// Decisões cravadas (memory: project_revops_whitelabel_v32_6):
//
// D1 — Builder A ↔ Excel B sincronizados.
//   Cada item carrega `calc.mode` + `calc.formula` ao mesmo tempo. Modo A
//   reconstrói os campos guiados a partir do mode/factor/base; modo B mostra
//   a formula livre. Item com `mode='custom_formula'` é só editável em B.
//
// D2 — Handles internos fixos.
//   Item tem `id` (handle, ex: 'mlabs') imutável. Rename do `name` (display)
//   não quebra fórmulas. Cross-refs usam handles, não nomes.
//
// D3 — 5 modos de cálculo:
//   - fixed              → value: 115.29
//   - percent_self       → factor: 70 (70% do próprio valor base, ex: alocação)
//   - percent_of         → base: 'fat_bruto', factor: 30 (30% do handle 'fat_bruto')
//   - derived            → groupRef: 'g_acquisition' (soma do grupo inteiro)
//   - custom_formula     → formula: '=mlabs + adobe + 1500' (expressão livre)
//
// Cross-references: `formula` é avaliada via parser leve com 4 operações
// (+, -, *, /) + parênteses + handles + literais. Sem IF/funções (mantém
// simples; expansão futura conforme caso real aparecer).

(function() {
  'use strict';

  const RevopsWhitelabelEngine = {

    // V32.10.7 — Apelidos naturais de handles. Cliente BR escreve "tm" pra
    // Ticket Médio e "vendas" pra Sales naturalmente; ambos resolvem pro
    // canônico no symbol table (ver evaluate()) e validateFormula aceita.
    HANDLE_ALIASES: {
      tm: 'ticket',
      vendas: 'sales',
      faturamento: 'fat_bruto',
      faturamento_liquido: 'fat_liquido'
    },

    // ─────────────────────────────────────────────────────────────
    // DEFAULTS + FACTORY
    // ─────────────────────────────────────────────────────────────

    defaultConfig(productId = null) {
      return {
        productId,
        period: 'monthly',
        salesProjection: 0,
        // Ofertas mantém shape do legacy (V14): tab "Ofertas & TM" vai mexer
        offers: [],
        ticketMode: 'weighted',
        ticketManualValue: 0,
        // Grupos dinâmicos substituem fixedCosts categorias + acquisitionCosts + variableCosts
        groups: [],
        // Custom KPIs (rosa da planilha do Felipe) — array de { id, name, formula, unit }
        customKpis: [],
        // V32.10.9 — Linhas extras na DRE inseridas pelo cliente entre as fases.
        // Cada uma: { id, name, value (str: número ou =fórmula), signal: '+'|'-',
        // afterStep: 'fat_bruto'|'deducoes'|'venda_liquida'|'lucro_bruto'|'s_m'|'g_a' }
        dreExtraLines: [],
        savedAt: null
      };
    },

    emptyGroup(label = '', bucket = 'fixed') {
      const slug = String(label).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 32) || 'grupo';
      return {
        id: `g_${slug}_${Date.now().toString(36).slice(-4)}`,
        label: String(label || 'Novo grupo'),
        bucket,                            // 'fixed' | 'acquisition' | 'variable' | 'custom'
        items: []
      };
    },

    emptyItem(name = '') {
      const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 32) || 'item';
      return {
        id: `${slug}_${Date.now().toString(36).slice(-4)}`,
        name: String(name || 'Novo item'),
        calc: { mode: 'fixed', value: 0 }
      };
    },

    emptyCalc(mode = 'fixed') {
      switch (mode) {
        case 'fixed':           return { mode: 'fixed', value: 0 };
        case 'percent_self':    return { mode: 'percent_self', baseValue: 0, factor: 100 };
        case 'percent_of':      return { mode: 'percent_of', base: '', factor: 0 };
        case 'derived':         return { mode: 'derived', groupRef: '' };
        case 'custom_formula':  return { mode: 'custom_formula', formula: '=0' };
        default:                return { mode: 'fixed', value: 0 };
      }
    },

    // ─────────────────────────────────────────────────────────────
    // NORMALIZE — defensivo contra state sujo
    // ─────────────────────────────────────────────────────────────

    normalize(raw = {}, productId = null) {
      const base = this.defaultConfig(productId);
      if (!raw || typeof raw !== 'object') return base;
      return {
        ...base,
        ...raw,
        productId: productId ?? raw.productId ?? null,
        period: ['monthly', 'quarterly', 'yearly'].includes(raw.period) ? raw.period : base.period,
        salesProjection: this._num(raw.salesProjection),
        offers: Array.isArray(raw.offers) ? raw.offers.map(o => ({
          id: String(o.id || `offer_${Date.now().toString(36).slice(-4)}`),
          name: String(o.name || '').trim(),
          price: this._num(o.price),
          mix: this._num(o.mix),
          selectedForTicket: !!o.selectedForTicket
        })) : [],
        ticketMode: raw.ticketMode === 'manual' ? 'manual' : 'weighted',
        ticketManualValue: this._num(raw.ticketManualValue),
        groups: Array.isArray(raw.groups) ? raw.groups.map(g => this._normalizeGroup(g)).filter(Boolean) : [],
        customKpis: Array.isArray(raw.customKpis) ? raw.customKpis.map(k => ({
          id: String(k.id || `kpi_${Date.now().toString(36).slice(-4)}`),
          name: String(k.name || '').trim(),
          formula: String(k.formula || '=0'),
          unit: ['BRL', 'percent', 'unit'].includes(k.unit) ? k.unit : 'BRL'
        })) : [],
        dreExtraLines: Array.isArray(raw.dreExtraLines) ? raw.dreExtraLines.map(l => ({
          id: String(l.id || `dre_${Date.now().toString(36).slice(-4)}`),
          name: String(l.name || '').trim(),
          value: String(l.value || ''),
          signal: l.signal === '+' ? '+' : '-',
          afterStep: ['fat_bruto', 'deducoes', 'venda_liquida', 'lucro_bruto', 's_m', 'g_a'].includes(l.afterStep) ? l.afterStep : 'lucro_bruto'
        })) : [],
        savedAt: raw.savedAt || null
      };
    },

    _normalizeGroup(raw) {
      if (!raw || typeof raw !== 'object') return null;
      return {
        id: String(raw.id || `g_${Date.now().toString(36).slice(-4)}`),
        label: String(raw.label || 'Grupo'),
        bucket: ['fixed', 'acquisition', 'variable', 'custom'].includes(raw.bucket) ? raw.bucket : 'fixed',
        items: Array.isArray(raw.items) ? raw.items.map(i => this._normalizeItem(i)).filter(Boolean) : []
      };
    },

    _normalizeItem(raw) {
      if (!raw || typeof raw !== 'object') return null;
      return {
        id: String(raw.id || `item_${Date.now().toString(36).slice(-4)}`),
        name: String(raw.name || 'Item'),
        calc: this._normalizeCalc(raw.calc)
      };
    },

    _normalizeCalc(raw) {
      if (!raw || typeof raw !== 'object') return { mode: 'fixed', value: 0 };
      const mode = ['fixed', 'percent_self', 'percent_of', 'derived', 'custom_formula'].includes(raw.mode)
        ? raw.mode : 'fixed';
      const out = { mode };
      if (mode === 'fixed') out.value = this._num(raw.value);
      if (mode === 'percent_self') {
        out.baseValue = this._num(raw.baseValue);
        out.factor = this._num(raw.factor);
      }
      if (mode === 'percent_of') {
        out.base = String(raw.base || '');
        out.factor = this._num(raw.factor);
      }
      if (mode === 'derived') {
        out.groupRef = String(raw.groupRef || '');
      }
      if (mode === 'custom_formula') {
        out.formula = String(raw.formula || '=0');
      }
      return out;
    },

    // ─────────────────────────────────────────────────────────────
    // MIGRATION — V14 legacy revopsFinance → V32.8 whitelabel
    // ─────────────────────────────────────────────────────────────
    //
    // Rodada UMA VEZ por produto quando cliente abre RevOps após upgrade.
    // Mantém revopsFinance intocado por compat. revopsFinanceV2 carrega
    // o novo formato. Quando UI nova estiver pronta, droppa o legacy.

    migrateFromLegacy(legacyConfig) {
      if (!legacyConfig || typeof legacyConfig !== 'object') {
        return this.defaultConfig();
      }
      const next = this.defaultConfig(legacyConfig.productId);
      next.period = legacyConfig.period || 'monthly';
      next.salesProjection = this._num(legacyConfig.salesProjection);
      next.offers = Array.isArray(legacyConfig.offers) ? legacyConfig.offers : [];
      next.ticketMode = legacyConfig.ticketMode || 'weighted';
      next.ticketManualValue = this._num(legacyConfig.ticketManualValue);

      // 4 categorias fixedCosts hard-coded → 4 grupos dinâmicos com mesmo nome
      const fixedMap = [
        { key: 'software',  label: 'Software',  id: 'g_software'  },
        { key: 'people',    label: 'Pessoas',   id: 'g_people'    },
        { key: 'structure', label: 'Estrutura', id: 'g_structure' },
        { key: 'others',    label: 'Outros fixos', id: 'g_others' }
      ];
      for (const { key, label, id } of fixedMap) {
        const cat = legacyConfig.fixedCosts?.[key];
        if (cat && Array.isArray(cat.items) && cat.items.length) {
          next.groups.push({
            id, label, bucket: 'fixed',
            items: cat.items.map(item => ({
              id: this._slugFromName(item.name) || String(item.id || `item_${Date.now().toString(36).slice(-4)}`),
              name: String(item.name || 'Item'),
              calc: { mode: 'fixed', value: this._num(item.value) }
            }))
          });
        }
      }

      // acquisitionCosts → grupo dedicado (bucket='acquisition')
      const acq = legacyConfig.acquisitionCosts;
      if (acq && Array.isArray(acq.items) && acq.items.length) {
        next.groups.push({
          id: 'g_acquisition',
          label: 'Aquisição',
          bucket: 'acquisition',
          items: acq.items.map(item => ({
            id: this._slugFromName(item.name) || String(item.id || `acq_${Date.now().toString(36).slice(-4)}`),
            name: String(item.name || 'Item'),
            calc: { mode: 'fixed', value: this._num(item.value) }
          }))
        });
      }

      // variableCosts → grupo bucket='variable' (cada item carrega appliesTo no calc.formula
      // via convenção implícita — legacy `type='percent'` vira percent_self com factor + base implícita)
      const vc = legacyConfig.variableCosts;
      if (Array.isArray(vc) && vc.length) {
        next.groups.push({
          id: 'g_variable',
          label: 'Custos Variáveis',
          bucket: 'variable',
          items: vc.map(item => {
            const isPercent = item.type === 'percent';
            if (isPercent) {
              // percent_of base = grossRevenue (handle especial 'fat_bruto')
              // legacy 'appliesTo' (grossRevenue|netRevenue|afterFixed) vai pra metadado solto
              const baseHandle = item.appliesTo === 'netRevenue' ? 'fat_liquido'
                               : item.appliesTo === 'afterFixed' ? 'resultado_apos_fixos'
                               : 'fat_bruto';
              return {
                id: this._slugFromName(item.name) || String(item.id || `vc_${Date.now().toString(36).slice(-4)}`),
                name: String(item.name || 'Item'),
                calc: { mode: 'percent_of', base: baseHandle, factor: this._num(item.value) }
              };
            }
            // fixed
            return {
              id: this._slugFromName(item.name) || String(item.id || `vc_${Date.now().toString(36).slice(-4)}`),
              name: String(item.name || 'Item'),
              calc: { mode: 'fixed', value: this._num(item.value) }
            };
          })
        });
      }

      return next;
    },

    _slugFromName(name) {
      if (!name) return null;
      return String(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || null;
    },

    // ─────────────────────────────────────────────────────────────
    // EVALUATE — calcula valor de cada item resolvendo fórmulas
    // ─────────────────────────────────────────────────────────────
    //
    // Retorna mapa { handle → valor }. Inclui handles especiais:
    //   fat_bruto, fat_liquido, sales, ticket, g_<groupId>_total
    // Cliente pode referenciar qualquer um em custom_formula.

    evaluate(config, context = {}) {
      const cfg = this.normalize(config);
      const sales = context.sales != null ? this._num(context.sales) : cfg.salesProjection;
      const ticket = context.ticket != null ? this._num(context.ticket) : this._computeTicket(cfg);
      const fatBruto = sales * ticket;

      // Symbol table inicial com handles especiais. Cresce conforme avalia items.
      const symbols = {
        sales,
        ticket,
        fat_bruto: fatBruto,
        fat_liquido: 0,         // recomputado abaixo após variáveis sobre gross
        resultado_apos_fixos: 0 // recomputado abaixo
      };

      // Pass 1: resolve cada item por grupo. Itens podem referenciar outros via handle.
      // Iteração com max depth = 5 pra suportar refs encadeadas (item→item→item) sem loop infinito.
      const groupTotals = {};
      const itemValues = {};
      const MAX_ITER = 5;
      for (let i = 0; i < MAX_ITER; i++) {
        let changed = false;
        for (const group of cfg.groups || []) {
          for (const item of group.items || []) {
            const prev = itemValues[item.id];
            const next = this._evalItem(item, group, symbols, itemValues, cfg);
            if (next !== prev) {
              itemValues[item.id] = next;
              symbols[item.id] = next;
              changed = true;
            }
          }
          groupTotals[group.id] = (group.items || []).reduce((s, it) => s + (itemValues[it.id] || 0), 0);
          symbols[`${group.id}_total`] = groupTotals[group.id];
        }
        if (!changed) break;
      }

      // Recomputa handles agregados após pass 1 (variáveis afetam fat_liquido etc)
      const fixedTotal = (cfg.groups || []).filter(g => g.bucket === 'fixed').reduce((s, g) => s + (groupTotals[g.id] || 0), 0);
      const acquisitionTotal = (cfg.groups || []).filter(g => g.bucket === 'acquisition').reduce((s, g) => s + (groupTotals[g.id] || 0), 0);
      const variableTotal = (cfg.groups || []).filter(g => g.bucket === 'variable').reduce((s, g) => s + (groupTotals[g.id] || 0), 0);

      const fatLiquido = fatBruto - variableTotal;
      const resultadoAposFixos = fatLiquido - fixedTotal;
      const ebitda = resultadoAposFixos - acquisitionTotal;
      const ebitdaMargin = fatBruto > 0 ? (ebitda / fatBruto) * 100 : 0;

      symbols.fat_liquido = fatLiquido;
      symbols.resultado_apos_fixos = resultadoAposFixos;
      symbols.ebitda = ebitda;
      symbols.g_a_total = fixedTotal;
      symbols.aquisicao_total = acquisitionTotal;
      symbols.variavel_total = variableTotal;

      // V32.10.7 — Aliases brasileiros naturais. Cliente digita "tm" esperando
      // Ticket Médio; "vendas" pra Sales. Injetar como espelho mantém uma única
      // tabela de símbolos (parser e validateFormula resolvem sem código extra).
      for (const [alias, canonical] of Object.entries(this.HANDLE_ALIASES)) {
        if (canonical in symbols) symbols[alias] = symbols[canonical];
      }

      // Custom KPIs: avalia fórmulas no symbol table final
      const customKpiValues = {};
      for (const kpi of cfg.customKpis || []) {
        try { customKpiValues[kpi.id] = this._evalFormula(kpi.formula, symbols); }
        catch (_) { customKpiValues[kpi.id] = 0; }
      }

      return {
        sales,
        ticket,
        fatBruto,
        fatLiquido,
        fixedTotal,
        variableTotal,
        acquisitionTotal,
        resultadoAposFixos,
        ebitda,
        ebitdaMargin,
        itemValues,
        groupTotals,
        symbols,
        customKpiValues,
        health: ebitda >= 0 ? (ebitdaMargin >= 25 ? 'Saudável' : 'Atenção') : 'Crítico'
      };
    },

    _computeTicket(cfg) {
      if (cfg.ticketMode === 'manual') return this._num(cfg.ticketManualValue);
      const offers = (cfg.offers || []).filter(o => o.selectedForTicket && this._num(o.price) > 0);
      if (!offers.length) return 0;
      const totalMix = offers.reduce((s, o) => s + this._num(o.mix), 0);
      if (totalMix <= 0) {
        // sem mix definido → média simples
        return offers.reduce((s, o) => s + this._num(o.price), 0) / offers.length;
      }
      return offers.reduce((s, o) => s + (this._num(o.price) * this._num(o.mix) / totalMix), 0);
    },

    _evalItem(item, group, symbols, itemValues, cfg) {
      const calc = item.calc || { mode: 'fixed', value: 0 };
      switch (calc.mode) {
        case 'fixed':
          return this._num(calc.value);
        case 'percent_self':
          return this._num(calc.baseValue) * (this._num(calc.factor) / 100);
        case 'percent_of': {
          const baseValue = symbols[calc.base];
          if (baseValue == null) return 0;
          return this._num(baseValue) * (this._num(calc.factor) / 100);
        }
        case 'derived': {
          const ref = calc.groupRef;
          if (!ref) return 0;
          // soma do grupo referenciado (já calculado em iteração anterior se existir)
          const refGroup = (cfg.groups || []).find(g => g.id === ref);
          if (!refGroup) return 0;
          return (refGroup.items || []).reduce((s, it) => s + (itemValues[it.id] || 0), 0);
        }
        case 'custom_formula':
          try { return this._evalFormula(calc.formula, symbols); }
          catch (_) { return 0; }
        default:
          return 0;
      }
    },

    // ─────────────────────────────────────────────────────────────
    // FORMULA PARSER — leve, 4 operações + parênteses + handles
    // ─────────────────────────────────────────────────────────────
    //
    // Sintaxe: `=expr` ou `expr`.
    //   handles: [a-z_][a-z0-9_]* (case insensitive)
    //   literais: 123, 123.45
    //   ops: + - * / ( )
    // Sem IF, sem funções, sem strings. Mantém simples — expandir conforme caso real.

    _evalFormula(rawFormula, symbols) {
      let f = String(rawFormula || '').trim().replace(/^=/, '').trim();
      if (!f) return 0;
      // V32.9.6 — Normaliza vírgula BR pra ponto JS ANTES de qualquer parse.
      // Cliente brasileiro naturalmente escreve "0,059" pra 5,9%. Parser
      // anterior só aceitava "0.059" e retornava 0 silenciosamente.
      // Regex casa vírgula entre dígitos: "0,059" → "0.059", "1,5" → "1.5".
      // Não toca vírgulas entre letras (parser também rejeita letras então
      // não há ambiguidade com argumentos de função).
      f = f.replace(/(\d),(\d)/g, '$1.$2');
      // Substitui handles por valores. Casa identificadores e troca pelo valor numérico (ou 0).
      const replaced = f.replace(/[a-zA-Z_][a-zA-Z0-9_]*/g, (match) => {
        const key = match.toLowerCase();
        const val = symbols[key];
        return Number.isFinite(val) ? String(val) : '0';
      });
      // Sanity: só aceita dígitos, operadores, parênteses, ponto, espaços
      if (!/^[0-9+\-*/().\s]*$/.test(replaced)) return 0;
      try {
        // eslint-disable-next-line no-new-func
        const result = new Function(`return (${replaced || '0'});`)();
        return Number.isFinite(result) ? result : 0;
      } catch (_) {
        return 0;
      }
    },

    // ─────────────────────────────────────────────────────────────
    // FORMULA DERIVE — pra Modo B mostrar TODO item como expressão
    // ─────────────────────────────────────────────────────────────
    //
    // Pega item.calc do Modo A e retorna a fórmula equivalente que o cliente
    // veria no Modo B. Ex: { mode:'percent_of', base:'fat_bruto', factor:30 }
    // vira '=fat_bruto * 0.30'.
    //
    // Pra mode='custom_formula', retorna o próprio calc.formula sem mudar.

    deriveFormula(calc, cfg) {
      if (!calc || typeof calc !== 'object') return '=0';
      switch (calc.mode) {
        case 'fixed':
          return `=${this._num(calc.value)}`;
        case 'percent_self':
          return `=${this._num(calc.baseValue)} * ${this._num(calc.factor) / 100}`;
        case 'percent_of':
          if (!calc.base) return '=0';
          return `=${calc.base} * ${this._num(calc.factor) / 100}`;
        case 'derived':
          if (!calc.groupRef) return '=0';
          return `=${calc.groupRef}_total`;
        case 'custom_formula':
          return String(calc.formula || '=0');
        default:
          return '=0';
      }
    },

    // ─────────────────────────────────────────────────────────────
    // V32.10.0 — KPIs da cascata RevOps (TM → MCU → CAC → MSU → Fixed → Breakeven)
    // ─────────────────────────────────────────────────────────────
    //
    // Cálculos AUTO (cliente pode sobrescrever via override).
    // Override shape: { mode: 'auto'|'manual'|'composed', value?, formula?, components? }

    // Auto MCU: TM − Σ custos variáveis unitários inferidos.
    // Inferência (Opção A cravada com Felipe):
    //   - bucket='variable' + mode='percent_of' base ∈ {fat_bruto, ticket, fat_liquido}
    //     → unit = ticket × factor%
    //   - bucket='variable' + mode='custom_formula' que referencia fat_bruto/ticket/sales
    //     → unit = itemValue / sales (assume escalou com vendas)
    //   - bucket='variable' + mode='fixed': IGNORADO (assume pacote mensal, não unitário).
    //     Cliente que tem custo R$/un cadastra como percent_of base=ticket.
    computeAutoMCU(cfg, ev) {
      const ticket = ev.ticket;
      const sales = ev.sales || 1;
      let variableUnitCost = 0;
      const breakdown = [];
      for (const group of (cfg.groups || [])) {
        if (group.bucket !== 'variable') continue;
        for (const item of (group.items || [])) {
          const calc = item.calc || {};
          let unitCost = 0;
          let formulaDesc = '';
          if (calc.mode === 'percent_of') {
            const base = String(calc.base || '').toLowerCase();
            const scaleHandles = ['fat_bruto', 'fat_liquido', 'ticket', 'sales'];
            if (scaleHandles.includes(base)) {
              const factor = this._num(calc.factor) / 100;
              if (base === 'sales') {
                // sales*factor — custo total escalado por vendas → unit = factor
                unitCost = factor;
              } else if (base === 'ticket') {
                unitCost = ticket * factor;
              } else {
                // fat_bruto / fat_liquido: dimensão receita; unit = ticket * factor
                unitCost = ticket * factor;
              }
              formulaDesc = `${calc.factor}% × ${base}`;
            }
          } else if (calc.mode === 'custom_formula') {
            const f = String(calc.formula || '').toLowerCase();
            if (/fat_bruto|fat_liquido|ticket|sales/.test(f)) {
              // Escala com receita/vendas — pega valor total já calculado e divide por vendas
              const itemValue = ev.itemValues[item.id] || 0;
              unitCost = sales > 0 ? itemValue / sales : 0;
              formulaDesc = `${calc.formula} ÷ ${sales} vendas`;
            }
          }
          // mode='fixed', 'percent_self', 'derived' → não entram (assume pacote / não-unitário)
          if (unitCost > 0) {
            variableUnitCost += unitCost;
            breakdown.push({ name: item.name, unit: unitCost, formula: formulaDesc, itemId: item.id });
          }
        }
      }
      return {
        value: ticket - variableUnitCost,
        ticket,
        variableUnitCost,
        breakdown
      };
    },

    // Auto MSU = MCU − CAC
    computeAutoMSU(mcu, cac) {
      return { value: mcu - cac, mcu, cac };
    },

    // Resolve override pra valor final.
    // override = { mode, value, formula, components }
    // autoValue = valor calculado se mode='auto'
    // symbols = symbol table pra resolver fórmulas dos overrides
    resolveOverride(override, autoValue, symbols) {
      const o = override || { mode: 'auto' };
      if (o.mode === 'auto' || !o.mode) {
        return { value: autoValue, source: 'auto' };
      }
      if (o.mode === 'manual') {
        // value pode ser número ou string-fórmula. Se começa com '=' resolve.
        const raw = o.value;
        if (typeof raw === 'number' && Number.isFinite(raw)) {
          return { value: raw, source: 'manual', input: String(raw) };
        }
        const strRaw = String(raw || '').trim();
        if (strRaw.startsWith('=')) {
          const computed = this._evalFormula(strRaw, symbols);
          return { value: computed, source: 'manual', input: strRaw, isFormula: true };
        }
        const num = this._num(strRaw);
        return { value: num, source: 'manual', input: strRaw };
      }
      if (o.mode === 'composed') {
        // base = autoValue (TM pra MCU, MCU pra MSU) e components subtraem/somam
        const components = Array.isArray(o.components) ? o.components : [];
        let total = autoValue; // começa do auto
        // V32.10.0 — Compor sobre o valor BASE (TM pra MCU; MCU pra MSU).
        // Cliente deduz componentes a partir do base. Convenção: signal default = '−'.
        // Mas o componente.value pode vir negativo OU positivo, sistema soma cru.
        // Pra UX, componentes são listados como deduções (sinal − implícito).
        // override.baseValue = TM ou MCU (passado pelo caller)
        if (typeof o.baseValue === 'number') total = o.baseValue;
        for (const c of components) {
          const raw = String(c.value || '').trim();
          let v = 0;
          if (raw.startsWith('=')) v = this._evalFormula(raw, symbols);
          else v = this._num(raw);
          // Convenção: components são DEDUÇÕES (subtraem do base)
          total -= v;
        }
        return { value: total, source: 'composed', components };
      }
      return { value: autoValue, source: 'auto' };
    },

    // ─────────────────────────────────────────────────────────────
    // VALIDATE FORMULA — feedback visual pro cliente saber se fórmula está OK
    // ─────────────────────────────────────────────────────────────
    //
    // Diagnostica problemas comuns:
    //   - syntax_error: parêntese desbalanceado, operador isolado, etc.
    //   - unknown_handle: cliente escreveu 'fatBrut' em vez de 'fat_bruto'
    //   - zero_result: fórmula calcula 0 (warn — pode ser real ou base zerada)
    //   - circular_self_ref: fórmula referencia o próprio item
    //
    // Retorna { status, value, message, suggestions }
    //   status: 'ok' | 'warn' | 'error'

    validateFormula(rawFormula, symbols, itemId) {
      const empty = (msg) => ({ status: 'warn', value: 0, message: msg || 'Fórmula vazia — vai calcular 0.', suggestions: [] });
      let f = String(rawFormula || '').trim().replace(/^=/, '').trim();
      if (!f) return empty();

      // Normaliza vírgula BR
      f = f.replace(/(\d),(\d)/g, '$1.$2');

      // Extrai TODOS os identifiers (palavras) usados na fórmula
      const identifiers = (f.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || []).map(s => s.toLowerCase());
      const unknownHandles = identifiers.filter(id => !(id in symbols));
      const availableHandles = Object.keys(symbols);

      // Sugestões pra handles desconhecidos (Levenshtein simples — match parcial)
      const suggestionsFor = (handle) => {
        return availableHandles
          .filter(h => {
            // Match se prefixo OU substring de >= 4 chars
            if (h.startsWith(handle.slice(0, 4)) || handle.startsWith(h.slice(0, 4))) return true;
            if (handle.length >= 5 && h.includes(handle.slice(0, 5))) return true;
            if (h.length >= 5 && handle.includes(h.slice(0, 5))) return true;
            return false;
          })
          .slice(0, 3);
      };

      if (unknownHandles.length > 0) {
        const first = unknownHandles[0];
        const sugs = suggestionsFor(first);
        return {
          status: 'error',
          value: 0,
          message: `Handle desconhecido: "${first}"`,
          suggestions: sugs.length ? sugs : null,
          unknownHandles
        };
      }

      // Circular self-reference (item referenciando próprio id)
      if (itemId && identifiers.includes(String(itemId).toLowerCase())) {
        return {
          status: 'error',
          value: 0,
          message: `Fórmula referencia o próprio item ("${itemId}") — circular.`,
          suggestions: null
        };
      }

      // Tenta avaliar — se parser retornar 0 com handles válidos, é zero_result (warn)
      let value;
      try {
        value = this._evalFormula(rawFormula, symbols);
      } catch (e) {
        return { status: 'error', value: 0, message: `Erro de sintaxe: ${e.message}`, suggestions: null };
      }

      if (!Number.isFinite(value)) {
        return { status: 'error', value: 0, message: 'Resultado inválido (NaN ou Infinity) — operação matemática proibida (divisão por zero?).', suggestions: null };
      }

      if (value === 0) {
        return {
          status: 'warn',
          value: 0,
          message: 'Fórmula válida mas resultou 0. Verifique se as bases (ex: fat_bruto) têm valor.',
          suggestions: null
        };
      }

      return { status: 'ok', value, message: `Resultado: R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`, suggestions: null };
    },

    // ─────────────────────────────────────────────────────────────
    // HANDLES — dicionário do que está disponível pra autocomplete no Modo B
    // ─────────────────────────────────────────────────────────────

    availableHandles(config) {
      const cfg = this.normalize(config);
      const handles = [
        { id: 'sales',                label: 'Vendas previstas',        kind: 'special' },
        { id: 'ticket',               label: 'Ticket Médio',            kind: 'special' },
        { id: 'fat_bruto',            label: 'Faturamento Bruto',       kind: 'special' },
        { id: 'fat_liquido',          label: 'Faturamento Líquido',     kind: 'special' },
        { id: 'resultado_apos_fixos', label: 'Resultado após Fixos',    kind: 'special' },
        { id: 'ebitda',               label: 'EBITDA',                  kind: 'special' },
        { id: 'g_a_total',            label: 'G&A Total',               kind: 'special' },
        { id: 'aquisicao_total',      label: 'Aquisição Total',         kind: 'special' },
        { id: 'variavel_total',       label: 'Variável Total',          kind: 'special' },
        // V32.10.7 — KPIs da cascata RevOps (injetados pelo panel em ev.symbols)
        { id: 'mcu',                  label: 'MCU · Margem Contribuição Unitária', kind: 'kpi' },
        { id: 'msu',                  label: 'MSU · Margem após Aquisição',         kind: 'kpi' },
        { id: 'cac',                  label: 'CAC · Custo de Aquisição',            kind: 'kpi' },
        { id: 'breakeven',            label: 'Breakeven (vendas)',                  kind: 'kpi' }
      ];
      // V32.10.7 — Aliases naturais (tm, vendas, etc) listados no picker
      for (const [alias, canonical] of Object.entries(this.HANDLE_ALIASES)) {
        const target = handles.find(h => h.id === canonical);
        handles.push({
          id: alias,
          label: `apelido de ${target ? target.label : canonical}`,
          kind: 'alias',
          aliasOf: canonical
        });
      }
      for (const group of cfg.groups || []) {
        handles.push({ id: `${group.id}_total`, label: `${group.label} (total do grupo)`, kind: 'group_total' });
        for (const item of group.items || []) {
          handles.push({ id: item.id, label: item.name, kind: 'item', groupLabel: group.label });
        }
      }
      return handles;
    },

    // ─────────────────────────────────────────────────────────────
    // V32.10.9 — DRE FLEX (Felipe formato planilha)
    // ─────────────────────────────────────────────────────────────
    //
    // Monta lista ordenada de linhas da DRE:
    //   FB → Deduções(soma bucket variable) → VL → LB → S&M → G&A → LL
    // Entre cada par, intercala extras manuais (cfg.dreExtraLines) com
    // signal e value (number ou =fórmula). Subtotais recalculam cumulativamente.
    //
    // Retorna [{ id, kind: 'base'|'extra'|'subtotal', label, value, signal,
    //            tone, bold, highlight, deletable, isSubtotal, afterStep? }]
    evaluateDRE(cfg, ev) {
      const symbols = ev.symbols || {};
      const extras = Array.isArray(cfg.dreExtraLines) ? cfg.dreExtraLines : [];

      // Valores base (auto, vêm de evaluate())
      const fb = ev.fatBruto;
      const deducoes = ev.variableTotal;   // soma do bucket variable
      const sm = ev.acquisitionTotal;
      const ga = ev.fixedTotal;

      // Resolve valor de uma extra line. value pode ser número, string-número
      // ou fórmula '=expr'. Retorna número.
      const resolveExtra = (l) => {
        const raw = String(l.value || '').trim();
        if (!raw) return 0;
        if (raw.startsWith('=')) return this._evalFormula(raw, symbols);
        return this._num(raw);
      };

      // Soma extras de um step (signal aplicado: + soma, − subtrai)
      const sumExtras = (afterStep) => {
        return extras
          .filter(l => l.afterStep === afterStep)
          .reduce((s, l) => s + (l.signal === '+' ? resolveExtra(l) : -resolveExtra(l)), 0);
      };

      // Cálculo cumulativo
      let running = fb;
      // Extras after fat_bruto
      running += sumExtras('fat_bruto');
      // Aplica deduções
      running -= deducoes;
      // Extras after deducoes
      running += sumExtras('deducoes');
      const vendaLiquida = running;
      // Extras after venda_liquida
      running += sumExtras('venda_liquida');
      const lucroBruto = running;
      // Extras after lucro_bruto
      running += sumExtras('lucro_bruto');
      // Aplica S&M
      running -= sm;
      // Extras after s_m
      running += sumExtras('s_m');
      // Aplica G&A
      running -= ga;
      // Extras after g_a
      running += sumExtras('g_a');
      const lucroLiquido = running;

      // Renderiza linhas em ordem. Cada linha base intercalada com suas extras.
      const lines = [];
      const pushBase = (id, label, value, opts) => lines.push({
        id, kind: 'base', label, value,
        signal: opts.signal || '', tone: opts.tone || 'slate',
        bold: !!opts.bold, highlight: !!opts.highlight,
        isSubtotal: !!opts.isSubtotal,
        afterStep: id  // pra o botão + ser inserido logo após
      });
      const pushExtrasAfter = (afterStep) => {
        for (const l of extras.filter(x => x.afterStep === afterStep)) {
          lines.push({
            id: l.id, kind: 'extra',
            label: l.name || '(sem nome)',
            value: resolveExtra(l),
            signal: l.signal, raw: l.value,
            tone: l.signal === '+' ? 'emerald' : 'rose',
            bold: false, deletable: true,
            afterStep
          });
        }
      };

      pushBase('fat_bruto',     '(+) Faturamento Bruto',   fb,           { signal: '+', tone: 'emerald', bold: true });
      pushExtrasAfter('fat_bruto');
      pushBase('deducoes',      '(−) Deduções',            deducoes,     { signal: '-', tone: 'rose' });
      pushExtrasAfter('deducoes');
      pushBase('venda_liquida', '(=) Venda Líquida',       vendaLiquida, { tone: 'sky',    bold: true, isSubtotal: true });
      pushExtrasAfter('venda_liquida');
      pushBase('lucro_bruto',   '(=) Lucro Bruto',         lucroBruto,   { tone: 'sky',    bold: true, isSubtotal: true });
      pushExtrasAfter('lucro_bruto');
      pushBase('s_m',           '(−) S&M (Aquisição)',     sm,           { signal: '-', tone: 'rose' });
      pushExtrasAfter('s_m');
      pushBase('g_a',           '(−) G&A (Fixos)',         ga,           { signal: '-', tone: 'rose' });
      pushExtrasAfter('g_a');
      pushBase('lucro_liquido', '(=) Lucro Líquido',       lucroLiquido, { tone: lucroLiquido >= 0 ? 'emerald' : 'rose', bold: true, highlight: true, isSubtotal: true });

      return {
        lines,
        totals: { fb, deducoes, vendaLiquida, lucroBruto, sm, ga, lucroLiquido },
        margem: fb > 0 ? (lucroLiquido / fb) * 100 : 0
      };
    },

    // ─────────────────────────────────────────────────────────────
    // PRIVATE — utilitários
    // ─────────────────────────────────────────────────────────────

    _num(value) {
      if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
      if (value == null) return 0;
      const clean = String(value).replace(/R\$/g, '').replace(/%/g, '').replace(/\s/g, '')
        .replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
      const parsed = Number(clean);
      return Number.isFinite(parsed) ? parsed : 0;
    }
  };

  window.RevopsWhitelabelEngine = RevopsWhitelabelEngine;
})();
