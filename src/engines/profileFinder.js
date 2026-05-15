var ProfileFinder = {
  stateAliases: {
    'acre': ['ac', 'acre'],
    'alagoas': ['al', 'alagoas'],
    'amapa': ['ap', 'amapa'],
    'amazonas': ['am', 'amazonas'],
    'bahia': ['ba', 'bahia'],
    'ceara': ['ce', 'ceara'],
    'distrito federal': ['df', 'distrito federal', 'brasilia'],
    'espirito santo': ['es', 'espirito santo'],
    'goias': ['go', 'goias'],
    'maranhao': ['ma', 'maranhao'],
    'mato grosso': ['mt', 'mato grosso'],
    'mato grosso do sul': ['ms', 'mato grosso do sul'],
    'minas gerais': ['mg', 'minas gerais'],
    'para': ['pa', 'para'],
    'paraiba': ['pb', 'paraiba'],
    'parana': ['pr', 'parana'],
    'pernambuco': ['pe', 'pernambuco'],
    'piaui': ['pi', 'piaui'],
    'rio de janeiro': ['rj', 'rio de janeiro'],
    'rio grande do norte': ['rn', 'rio grande do norte'],
    'rio grande do sul': ['rs', 'rio grande do sul'],
    'rondonia': ['ro', 'rondonia'],
    'roraima': ['rr', 'roraima'],
    'santa catarina': ['sc', 'santa catarina', 'florianopolis'],
    'sao paulo': ['sp', 'sao paulo'],
    'sergipe': ['se', 'sergipe'],
    'tocantins': ['to', 'tocantins']
  },

  semanticDictionary: {
    gender: {
      feminino: ['mulher', 'mulheres', 'feminino', 'fem', 'garota', 'garotas'],
      masculino: ['homem', 'homens', 'masculino', 'masc', 'garoto', 'garotos']
    },
    temperature: {
      Quente: ['quente', 'quentes', 'hot', 'alta intencao', 'alta intenção'],
      Morno: ['morno', 'mornos', 'warm', 'media intencao', 'média intenção'],
      Frio: ['frio', 'frios', 'cold', 'baixa intencao', 'baixa intenção']
    },
    civil: {
      'solteiro': ['solteiro', 'solteira', 'solteiros', 'solteiras'],
      'casado': ['casado', 'casada', 'casados', 'casadas'],
      'divorciado': ['divorciado', 'divorciada', 'divorciados', 'divorciadas'],
      'viuvo': ['viuvo', 'viuva', 'viuvos', 'viuvas'],
      'uniao estavel': ['uniao estavel', 'união estável']
    },
    behavior: {
      '#open': ['#open', 'abriu', 'abertura', 'abriram', 'abrir email', 'abriu email', 'email aberto'],
      '#read': ['#read', 'leu', 'leram', 'leitura', 'consumiu', 'consumiram'],
      '#cta': ['#cta', 'clicou', 'clicaram', 'clique', 'cta', 'clicou no cta'],
      '#lp': ['#lp', 'landing page', 'lp', 'visitou lp', 'visitou a lp', 'pagina de captura', 'página de captura'],
      '#whatsapp': ['#whatsapp', 'whatsapp', 'respondeu whatsapp', 'zap']
    }
  },

  _diacriticsRegex: /[̀-ͯ]/g,
  _dashRegex: /[–—]/g,
  _multiSpaceRegex: /\s+/g,
  _phoneRegex: /\D+/g,
  _escapeRegex: /[.*+?^${}()|[\]\\]/g,
  _phraseCache: new Map(),
  _expandStateCache: new Map(),
  _searchableCache: new WeakMap(),
  _locationPrefix: '(?:estado\\s+de|estado\\s+do|estado\\s+da|cidade\\s+de|moram\\s+em|mora\\s+em|morando\\s+em|residem\\s+em|reside\\s+em|vivem\\s+em|vive\\s+em|localizados\\s+em|localizadas\\s+em|em|de|do|da)?\\s*',
  _paraGuardRegex: /\b(pa|estado\s+do\s+para|estado\s+do\s+pará)\b/,
  _ageRangeRegex: /(?:entre\s*)?(\d{1,3})\s*(?:a|ate|-|até)\s*(\d{1,3})\s*(?:anos?)?/,
  _ageRangeAltRegex: /(?:idade\s*)?(?:de\s*)?(\d{1,3})\s*(?:anos?)?\s*(?:ate|até)\s*(\d{1,3})\s*(?:anos?)?/,
  _ageMinRegex: /(?:idade\s*)?(?:acima|mais|maior|a partir|para cima|minimo|mínimo)\s*(?:de|que)?\s*(\d{1,3})\s*(?:anos?)?/,
  _ageMaxRegex: /(?:idade\s*)?(?:abaixo|menos|menor|ate|até|maximo|máximo)\s*(?:de|que)?\s*(\d{1,3})\s*(?:anos?)?/,
  _ageExactRegex: /\b(?:idade\s*)?(\d{1,3})\s*anos?\b/,
  _scoreExactRegex: /score\s*(?:igual\s*a|=)?\s*(\d+)\b/,
  _scoreMinRegexes: [
    /score\s*(?:>=|=>)\s*(\d+)/,
    /score\s*(\d+)\s*\+/,
    /score\s*(?:de\s*)?(\d+)\s*(?:para cima|ou mais|acima|acima disso)/,
    /score\s*(?:acima|maior|mais|minimo|mínimo|a partir|para cima)\s*(?:de|que)?\s*(\d+)/
  ],
  _scoreMaxRegexes: [
    /score\s*(?:<=|=<)\s*(\d+)/,
    /score\s*(?:abaixo|menor|menos|maximo|máximo|ate|até)\s*(?:de|que)?\s*(\d+)/
  ],
  _hasEmailRegex: /\b(com\s+e-?mail|tem\s+e-?mail|e-?mail)\b/,
  _hasPhoneRegex: /\b(com\s+telefone|tem\s+telefone|telefone|whatsapp|celular|fone)\b/,
  _orProtectRegex: /entre\s+(\d{1,3})\s+e\s+(\d{1,3})/g,
  _clusterAgeTypes: new Set(['idade_exact', 'idade_range', 'idade_min', 'idade_max']),
  _stopwords: new Set(['de', 'do', 'da', 'dos', 'das', 'com', 'sem', 'e', 'ou', 'perfil', 'lead', 'leads', 'pessoa', 'pessoas', 'anos', 'ano', 'estado', 'cidade', 'sexo', 'idade', 'entre', 'para', 'no', 'na', 'em', 'que', 'quem', 'mora', 'moram', 'morando', 'reside', 'residem', 'residentes', 'vive', 'vivem', 'localizados', 'localizadas', 'score']),
  _cleanupRegexes: [
    /\b(mulher|feminino|mulheres|fem|garota|garotas|homem|masculino|homens|masc|garoto|garotos|quente|quentes|morno|mornos|frio|frios|hot|warm|cold|com email|com e-mail|telefone|whatsapp|celular|fone)\b/g,
    /\d{1,3}\s*(?:a|ate|-|até)\s*\d{1,3}\s*(?:anos?)?/g,
    /\b\d{1,3}\s*anos?\b/g,
    /(?:acima|mais|maior|abaixo|menos|menor|minimo|mínimo|maximo|máximo|para cima|a partir)\s*(?:de|que)?\s*\d{1,3}\s*(?:anos?)?/g,
    /score\s*(?:>=|<=|=>|=<|acima|maior|>|mais|abaixo|menor|<|menos|minimo|mínimo|maximo|máximo|para cima|a partir|de)?\s*\d+\s*(?:\+|para cima|ou mais)?/g,
    /#[-\w]+/g,
    /[,;]+/g
  ],
  _hashtagRegex: /#[-\w]+/g,
  _orRegex: /\bou\b/g,
  _segmentSplitRegex: /\s+e\s+/,

  _stateAliasesSorted: null,
  _locationRegexes: null,

  _ensureCaches() {
    if (!this._stateAliasesSorted) {
      this._stateAliasesSorted = Object.entries(this.stateAliases).sort((a, b) => b[0].length - a[0].length);
    }
    if (!this._locationRegexes) {
      this._locationRegexes = new Map();
      for (const aliases of Object.values(this.stateAliases)) {
        for (const alias of aliases) {
          if (!this._locationRegexes.has(alias)) {
            const escaped = alias.replace(this._escapeRegex, '\\$&');
            this._locationRegexes.set(alias, {
              detect: new RegExp(`\\b${this._locationPrefix}${escaped}\\b`),
              strip: new RegExp(`\\b${this._locationPrefix}${escaped}\\b`, 'g')
            });
          }
        }
      }
    }
  },

  normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(this._diacriticsRegex, '')
      .toLowerCase()
      .replace(this._dashRegex, '-')
      .replace(this._multiSpaceRegex, ' ')
      .trim();
  },

  normalizePhone(value) {
    return String(value || '').replace(this._phoneRegex, '');
  },

  escapeRegex(value) {
    return String(value).replace(this._escapeRegex, '\\$&');
  },

  phraseRegex(phrase) {
    const normalized = this.normalize(phrase);
    let cached = this._phraseCache.get(normalized);
    if (!cached) {
      cached = new RegExp(`\\b${this.escapeRegex(normalized).replace(/\\s+/g, '\\s+')}\\b`);
      this._phraseCache.set(normalized, cached);
    }
    return cached;
  },

  containsAny(q, list) {
    for (const item of list) {
      if (this.phraseRegex(item).test(q)) return true;
    }
    return false;
  },

  addUniqueFilter(filters, filter) {
    const key = `${filter.type}:${filter.value || filter.label || ''}:${filter.min || ''}:${filter.max || ''}`;
    for (const item of filters) {
      const existing = `${item.type}:${item.value || item.label || ''}:${item.min || ''}:${item.max || ''}`;
      if (existing === key) return;
    }
    filters.push(filter);
  },

  extractAgeFilters(q, filters) {
    for (const pattern of [this._ageRangeRegex, this._ageRangeAltRegex]) {
      const found = q.match(pattern);
      if (found) {
        const min = Number(found[1]);
        const max = Number(found[2]);
        if (min <= 120 && max <= 120) this.addUniqueFilter(filters, { type: 'idade_range', field: 'idade', min, max, label: `Idade: ${min} a ${max} anos` });
        return;
      }
    }

    const ageMin = q.match(this._ageMinRegex);
    if (ageMin && Number(ageMin[1]) <= 120) this.addUniqueFilter(filters, { type: 'idade_min', field: 'idade', min: Number(ageMin[1]), label: `Idade: >= ${ageMin[1]}` });

    const ageMax = q.match(this._ageMaxRegex);
    if (ageMax && Number(ageMax[1]) <= 120) this.addUniqueFilter(filters, { type: 'idade_max', field: 'idade', max: Number(ageMax[1]), label: `Idade: <= ${ageMax[1]}` });

    if (!ageMin && !ageMax) {
      const exact = q.match(this._ageExactRegex);
      if (exact && Number(exact[1]) <= 120) this.addUniqueFilter(filters, { type: 'idade_exact', field: 'idade', value: Number(exact[1]), label: `Idade: ${exact[1]} anos` });
    }
  },

  extractScoreFilters(q, filters) {
    for (const pattern of this._scoreMinRegexes) {
      const found = q.match(pattern);
      if (found) {
        this.addUniqueFilter(filters, { type: 'score_min', field: 'score', min: Number(found[1]), label: `Score: >= ${found[1]}` });
        return;
      }
    }

    for (const pattern of this._scoreMaxRegexes) {
      const found = q.match(pattern);
      if (found) {
        this.addUniqueFilter(filters, { type: 'score_max', field: 'score', max: Number(found[1]), label: `Score: <= ${found[1]}` });
        return;
      }
    }

    const exact = q.match(this._scoreExactRegex);
    if (exact) this.addUniqueFilter(filters, { type: 'score_exact', field: 'score', value: Number(exact[1]), label: `Score: ${exact[1]}` });
  },

  getLocationFilters(q) {
    this._ensureCaches();
    const found = [];
    const padded = ` ${q} `;

    for (const [stateName, aliases] of this._stateAliasesSorted) {
      let matched = false;
      for (const alias of aliases) {
        if (alias === 'para' && !this._paraGuardRegex.test(q)) continue;
        if (this._locationRegexes.get(alias).detect.test(padded)) { matched = true; break; }
      }
      if (matched) found.push({ type: 'local', field: 'local', value: stateName, aliases, label: `Local: ${stateName}` });
    }
    return found;
  },

  stripRecognizedTerms(q, filters) {
    this._ensureCaches();
    let cleaned = ` ${q} `;
    for (const filter of filters) {
      if (filter.type !== 'local') continue;
      for (const alias of filter.aliases) {
        cleaned = cleaned.replace(this._locationRegexes.get(alias).strip, ' ');
      }
    }
    return cleaned;
  },

  parseBasicFilters(input, options = {}) {
    const q = this.normalize(input);
    const filters = [];

    for (const [value, aliases] of Object.entries(this.semanticDictionary.gender)) {
      if (this.containsAny(q, aliases)) this.addUniqueFilter(filters, { type: 'sexo', field: 'sexo', value, label: `Sexo: ${value === 'feminino' ? 'Feminino' : 'Masculino'}` });
    }

    this.extractAgeFilters(q, filters);
    this.extractScoreFilters(q, filters);
    for (const filter of this.getLocationFilters(q)) this.addUniqueFilter(filters, filter);

    if (this._hasEmailRegex.test(q)) this.addUniqueFilter(filters, { type: 'has_email', field: 'has_email', label: 'Tem e-mail' });
    if (this._hasPhoneRegex.test(q)) this.addUniqueFilter(filters, { type: 'has_phone', field: 'has_phone', label: 'Tem telefone' });

    for (const [value, aliases] of Object.entries(this.semanticDictionary.temperature)) {
      if (this.containsAny(q, aliases)) this.addUniqueFilter(filters, { type: 'temperatura', field: 'temperatura', value, label: `Temperatura: ${value}` });
    }

    for (const [value, aliases] of Object.entries(this.semanticDictionary.civil)) {
      if (this.containsAny(q, aliases)) this.addUniqueFilter(filters, { type: 'estado_civil', field: 'estado_civil', value, label: `Estado civil: ${value}` });
    }

    for (const ch of Config.channels) {
      if (q.includes(this.normalize(ch))) this.addUniqueFilter(filters, { type: 'canal', field: 'canal', value: ch, label: `Canal: ${ch}` });
    }

    const tagMatches = q.match(this._hashtagRegex);
    if (tagMatches) for (const t of tagMatches) this.addUniqueFilter(filters, { type: 'tag', field: 'tag', value: this.normalize(t), label: `Tag: ${t}` });
    for (const [tag, aliases] of Object.entries(this.semanticDictionary.behavior)) {
      if (this.containsAny(q, aliases)) this.addUniqueFilter(filters, { type: 'tag', field: 'tag', value: this.normalize(tag), label: `Tag: ${tag}` });
    }

    if (!options.skipText) {
      let cleaned = this.stripRecognizedTerms(q, filters);
      for (const regex of this._cleanupRegexes) cleaned = cleaned.replace(regex, ' ');
      cleaned = cleaned.trim();
      const stopwords = this._stopwords;
      const terms = cleaned.split(this._multiSpaceRegex).filter(t => t.length >= 2 && !stopwords.has(t));
      if (terms.length) this.addUniqueFilter(filters, { type: 'text', field: 'text', value: terms, label: `Busca: ${terms.join(' ')}` });
    }

    return filters;
  },

  getQueryWarnings(query) {
    const q = this.normalize(query);
    const warnings = [];
    if (/\bou\b/.test(q)) warnings.push('Você usou “OU”. Em campanhas, isso tende a abrir demais a segmentação e reduzir precisão. O sistema executou a busca, mas recomenda usar “E” para clusters claros.');
    return warnings;
  },

  sameFilter(a, b) {
    return a.type === b.type && String(a.value || '') === String(b.value || '') && String(a.min || '') === String(b.min || '') && String(a.max || '') === String(b.max || '');
  },

  hasFilter(filters, candidate) {
    return filters.some(filter => this.sameFilter(filter, candidate));
  },

  mergeFilters(filters, additions) {
    const merged = [...filters];
    for (const addition of additions) {
      if (!this.hasFilter(merged, addition)) merged.push(addition);
    }
    return merged;
  },

  isDemographicCluster(filters) {
    const ages = this._clusterAgeTypes;
    for (const f of filters) {
      if (f.type === 'sexo' || ages.has(f.type)) return true;
    }
    return false;
  },

  splitMarketingClusters(q) {
    const protectedQuery = q.replace(this._orProtectRegex, 'entre $1 ate $2');
    return protectedQuery.split(this._segmentSplitRegex).map(part => part.trim()).filter(Boolean);
  },

  parseSegmentedQuery(q) {
    const parts = this.splitMarketingClusters(q);
    if (parts.length < 2) return null;

    const partFilters = parts.map(part => this.parseBasicFilters(part, { skipText: true }));
    const demographicGroups = partFilters.filter(filters => this.isDemographicCluster(filters));
    if (demographicGroups.length < 2) return null;

    const fullFilters = this.parseBasicFilters(q, { skipText: true });
    const clusterTypes = new Set(['sexo', ...this._clusterAgeTypes]);

    const typeCounts = new Map();
    for (const filter of fullFilters) typeCounts.set(filter.type, (typeCounts.get(filter.type) || 0) + 1);

    const globalFilters = [];
    for (const filter of fullFilters) {
      if (clusterTypes.has(filter.type)) continue;
      if (typeCounts.get(filter.type) === 1) globalFilters.push(filter);
    }

    const ageFilters = fullFilters.filter(f => this._clusterAgeTypes.has(f.type));
    if (ageFilters.length === 1) {
      let groupsMissingAge = 0;
      for (const group of demographicGroups) {
        if (!group.some(f => this._clusterAgeTypes.has(f.type))) groupsMissingAge += 1;
      }
      if (groupsMissingAge > 0) globalFilters.push(ageFilters[0]);
    }

    const segments = demographicGroups.map(filters => this.mergeFilters(filters, globalFilters));
    if (segments.length < 2) return null;

    return [{
      type: 'or_segments',
      field: 'segmentos',
      segments,
      label: `Clusters somados: ${segments.map(group => group.map(f => f.label).join(' + ')).join(' | ')}`,
      marketingLogic: 'E soma clusters de público; cada cluster mantém seus próprios critérios.'
    }];
  },

  parseQuery(query) {
    const q = this.normalize(query).trim();
    if (!q) return [];
    const qForParsing = q.replace(this._orRegex, ' e ');
    const segmented = this.parseSegmentedQuery(qForParsing);
    if (segmented) return segmented;
    return this.parseBasicFilters(qForParsing);
  },

  interpretQuery(query) {
    const filters = this.parseQuery(query);
    const warnings = this.getQueryWarnings(query);
    const messages = [];
    if (!this.normalize(query)) return { filters, warnings, messages: ['Digite uma busca para interpretar.'], confidence: 0 };
    if (!filters.length) return { filters, warnings, messages: ['Não identifiquei filtros claros. Posso usar nome, email, telefone, sexo, idade, local, score, temperatura, tags, campanhas e canais.'], confidence: 0.25 };
    for (const filter of filters) {
      if (filter.type === 'or_segments') {
        messages.push('Interpretei como clusters somados por “E”:');
        filter.segments.forEach((segment, index) => messages.push(`Grupo ${index + 1}: ${segment.map(f => f.label).join(' + ')}`));
      } else {
        messages.push(filter.label);
      }
    }
    return { filters, warnings, messages, confidence: warnings.length ? 0.75 : 0.9 };
  },

  aiInterpreterDraft(query) {
    const interpretation = this.interpretQuery(query);
    return {
      source: 'local-semantic-parser',
      query,
      confidence: interpretation.confidence,
      filters: interpretation.filters,
      warnings: interpretation.warnings,
      explanation: interpretation.messages
    };
  },

  searchableText(lead) {
    if (typeof lead === 'object' && lead !== null) {
      const cached = this._searchableCache.get(lead);
      if (cached !== undefined) return cached;
      const text = this.normalize([
        lead.name,
        lead.email,
        this.normalizePhone(lead.phone),
        lead.phone,
        lead.sexo,
        lead.genero,
        lead.idade,
        lead.estado,
        this.expandState(lead.estado),
        lead.cidade,
        lead.estadoCivil,
        lead.faixaSalarial,
        lead.temperature,
        lead.globalScore,
        lead.lastChannel,
        lead.lastAction,
        ...(lead.tags || []),
        ...(lead.behaviorTags || []),
        ...(lead.campaigns || []),
        ...(lead.channels || [])
      ].join(' '));
      this._searchableCache.set(lead, text);
      return text;
    }
    return this.normalize(String(lead || ''));
  },

  expandState(value) {
    const normalized = this.normalize(value);
    if (!normalized) return normalized;
    const cached = this._expandStateCache.get(normalized);
    if (cached !== undefined) return cached;
    let expanded = normalized;
    for (const [stateName, aliases] of Object.entries(this.stateAliases)) {
      if (aliases.includes(normalized)) { expanded = [stateName, ...aliases].join(' '); break; }
    }
    this._expandStateCache.set(normalized, expanded);
    return expanded;
  },

  matchLocal(lead, filter) {
    const haystack = this.normalize(`${lead.estado || ''} ${this.expandState(lead.estado || '')} ${lead.cidade || ''}`);
    const tokens = haystack.split(this._multiSpaceRegex);
    for (const alias of filter.aliases) {
      if (tokens.includes(alias) || haystack.includes(alias)) return true;
    }
    return false;
  },

  matchFilter(lead, f) {
    if (f.type === 'or_segments') return f.segments.some(segment => segment.every(filter => this.matchFilter(lead, filter)));
    switch (f.type) {
      case 'sexo': return this.normalize(lead.sexo || lead.genero).includes(f.value);
      case 'idade_exact': return Number(lead.idade || 0) === Number(f.value);
      case 'idade_range': return Number(lead.idade || 0) >= f.min && Number(lead.idade || 0) <= f.max;
      case 'idade_min': return Number(lead.idade || 0) >= f.min;
      case 'idade_max': return Number(lead.idade || 0) <= f.max;
      case 'local': return this.matchLocal(lead, f);
      case 'has_email': return Boolean(lead.email);
      case 'has_phone': return Boolean(lead.phone);
      case 'temperatura': return lead.temperature === f.value;
      case 'score_exact': return Number(lead.globalScore || 0) === Number(f.value);
      case 'score_min': return Number(lead.globalScore || 0) >= f.min;
      case 'score_max': return Number(lead.globalScore || 0) <= f.max;
      case 'estado_civil': return this.normalize(lead.estadoCivil).includes(f.value);
      case 'tag': {
        const target = f.value.replace(/^#/, '');
        const tags = lead.tags || [];
        for (const t of tags) {
          const normalized = this.normalize(t);
          if (normalized === f.value || normalized.replace(/^#/, '') === target) return true;
        }
        const behaviorTags = lead.behaviorTags || [];
        for (const t of behaviorTags) {
          const normalized = this.normalize(t);
          if (normalized === f.value || normalized.replace(/^#/, '') === target) return true;
        }
        return false;
      }
      case 'canal': return lead.channels ? lead.channels.some(ch => this.normalize(ch) === this.normalize(f.value)) : false;
      case 'text': {
        const haystack = this.searchableText(lead);
        const phoneHaystack = this.normalizePhone(haystack);
        for (const term of f.value) {
          if (haystack.includes(term)) continue;
          const phoneTerm = this.normalizePhone(term);
          if (phoneTerm && phoneHaystack.includes(phoneTerm)) continue;
          return false;
        }
        return true;
      }
      default: return true;
    }
  },

  filterGroupKey(filter) {
    if (filter.type === 'or_segments') return 'or_segments';
    if (filter.type === 'idade_range') return `idade_range_${filter.min}_${filter.max}`;
    return filter.type;
  },

  applyFilters(leads, filters) {
    if (!filters.length) return leads;
    const groups = {};
    for (const filter of filters) {
      const key = this.filterGroupKey(filter);
      if (!groups[key]) groups[key] = [];
      groups[key].push(filter);
    }
    const groupList = Object.values(groups);
    return leads.filter(lead => {
      for (const group of groupList) {
        let matched = false;
        for (const filter of group) {
          if (this.matchFilter(lead, filter)) { matched = true; break; }
        }
        if (!matched) return false;
      }
      return true;
    });
  },

  explainNoResults(leads, filters, query) {
    const messages = [];
    const interpretation = this.interpretQuery(query);
    if (!this.normalize(query)) return ['Digite um perfil para buscar.'];
    if (!filters.length) return interpretation.messages;

    const segmentFilter = filters.find(f => f.type === 'or_segments');
    if (segmentFilter) {
      const segmentCounts = segmentFilter.segments.map(segment => ({
        label: segment.map(f => f.label).join(' + '),
        count: leads.filter(lead => segment.every(f => this.matchFilter(lead, f))).length
      }));
      const zeroSegments = segmentCounts.filter(item => item.count === 0);
      if (zeroSegments.length === segmentCounts.length) messages.push('Nenhum dos clusters da busca encontrou leads.');
      zeroSegments.slice(0, 4).forEach(item => messages.push(`Grupo sem resultado: ${item.label}`));
      return messages.length ? messages : ['A busca foi interpretada em clusters de público, mas nenhum lead passou por todos os critérios.'];
    }

    const groups = {};
    for (const filter of filters) {
      const key = this.filterGroupKey(filter);
      if (!groups[key]) groups[key] = [];
      groups[key].push(filter);
    }

    for (const group of Object.values(groups)) {
      const count = leads.filter(lead => group.some(filter => this.matchFilter(lead, filter))).length;
      if (count === 0) messages.push(`Nenhum lead atende ao critério: ${group.map(f => f.label).join(' / ')}`);
    }

    if (!messages.length) messages.push('Existem leads para cada critério separado, mas a combinação entre eles retornou zero. Verifique se idade, local, sexo e score estão preenchidos na base.');
    return messages;
  }
};
window.ProfileFinder = ProfileFinder;
