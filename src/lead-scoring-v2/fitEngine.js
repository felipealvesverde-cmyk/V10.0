// V19 — Fit Engine (descriptive)
// Quem é o lead. Score 0-100, sem baseline 50. Apenas evidência soma.
// Hierarquia de pesos por segmento (B2B prioriza decisor+pain; B2C prioriza interest+age).
// Matcher estrito: exact match ou phrase containment ≥3 chars, multi-palavra para pain/interest.
window.FitEngine = {
  // V20 — pesos rebalanceados com persona expandida. Soma ~100 quando todas
  // dimensões preenchidas; quando o blueprint não tem uma dimensão, ela é
  // skipada (possible diminui, score relativo se mantém honesto).
  WEIGHTS: {
    B2B: {
      jobTitle: 22, painPoint: 18, industry: 18, companyRevenue: 15,
      decisionMaker: 10, companySize: 5, geography: 5, awarenessLevel: 7,
      interest: 0, ageRange: 0, income: 0
    },
    B2C: {
      interest: 22, income: 22, painPoint: 15, ageRange: 13,
      geography: 8, jobTitle: 5, awarenessLevel: 5, industry: 5, companyRevenue: 5,
      decisionMaker: 0, companySize: 0
    },
    Ambos: {
      jobTitle: 13, painPoint: 17, industry: 10, companyRevenue: 8, income: 8,
      decisionMaker: 8, interest: 10, ageRange: 8, companySize: 4, geography: 7,
      awarenessLevel: 7
    }
  },

  forLead(blueprint, lead) {
    if (!blueprint?._internal?.fitRules) return { score: 0, detected: 0, possible: 0, reasons: [], negativesHit: 0 };
    const rules = blueprint._internal.fitRules;
    const segment = blueprint.segment || 'B2B';
    const weights = blueprint._internal.fitWeights || this.WEIGHTS[segment] || this.WEIGHTS.B2B;
    const tags = this._tagSet(lead);
    let score = 0;
    let possible = 0;
    const reasons = [];
    const checks = [
      { key: 'decisionMaker',   value: rules.decisionMaker,   mode: 'tag-binary' },
      { key: 'companySize',     value: rules.companySize,     mode: 'ordered', orderedList: window.IcpConversationFlow?.ORDERED_COMPANY_SIZES || ['Pequena','Média','Grande'] },
      { key: 'ageRange',        value: rules.ageRange,        mode: 'ordered', orderedList: window.IcpConversationFlow?.ORDERED_AGE_RANGES || ['18-24','25-34','35-44','45-54','55+'] },
      { key: 'painPoint',       value: rules.painPoint,       mode: 'phrase' },
      { key: 'interest',        value: rules.interest,        mode: 'phrase' },
      // V20 — persona expandida
      { key: 'industry',        value: rules.industry,        mode: 'phrase-multi', leadField: 'industry' },
      { key: 'companyRevenue',  value: rules.companyRevenue,  mode: 'ordered', orderedList: window.IcpConversationFlow?.ORDERED_REVENUE_BANDS || [], leadField: 'companyRevenue' },
      { key: 'income',          value: rules.income,          mode: 'ordered', orderedList: window.IcpConversationFlow?.ORDERED_INCOME_BANDS || [], leadField: 'income' },
      { key: 'jobTitle',        value: rules.jobTitle,        mode: 'phrase-multi', leadField: 'jobTitle' },
      { key: 'geography',       value: rules.geography,       mode: 'phrase-multi', leadField: 'geography' },
      { key: 'awarenessLevel',  value: rules.awarenessLevel,  mode: 'exact', leadField: 'awarenessLevel' }
    ];
    for (const c of checks) {
      const weight = Number(weights[c.key] || 0);
      if (!c.value || !weight) continue;
      const hasValue = Array.isArray(c.value) ? c.value.length > 0 : Boolean(String(c.value).trim());
      if (!hasValue) continue;
      possible += weight;
      if (c.mode === 'ordered') {
        // ORDERED com adjacência: exato = 1.0; vizinho imediato = 0.5; demais = 0.
        // Prefere o campo dedicado do lead (lead.companyRevenue, lead.income);
        // fallback: busca o bucket nas tags.
        const targets = Array.isArray(c.value) ? c.value : [c.value];
        let leadValue = null;
        if (c.leadField && lead?.[c.leadField]) {
          leadValue = c.orderedList.find(o => o === lead[c.leadField]) || null;
        }
        if (!leadValue) leadValue = this._extractOrdered(tags, c.orderedList);
        if (!leadValue) continue;
        const factor = this._adjacencyFactor(targets, leadValue, c.orderedList);
        if (factor > 0) {
          const points = weight * factor;
          score += points;
          reasons.push({
            type: 'fit',
            label: `${c.key}: lead em ${leadValue}${factor < 1 ? ' (adjacente)' : ''}, alvo ${targets.join(' / ')}`,
            points: Math.round(points)
          });
        }
      } else if (c.mode === 'tag-binary') {
        const values = Array.isArray(c.value) ? c.value : [c.value];
        for (const v of values) {
          if (this._tagsExact(tags, v)) {
            score += weight;
            reasons.push({ type: 'fit', label: `Match em ${c.key}: ${v}`, points: weight });
            break;
          }
        }
      } else if (c.mode === 'phrase') {
        const values = Array.isArray(c.value) ? c.value : [c.value];
        for (const v of values) {
          if (this._phraseMatch(lead, v)) {
            score += weight;
            reasons.push({ type: 'fit', label: `Match em ${c.key}: ${v}`, points: weight });
            break;
          }
        }
      } else if (c.mode === 'phrase-multi') {
        // Persona expandida: testa primeiro o campo dedicado do lead (industry,
        // jobTitle, etc) — match exato normalizado. Se não tem, fallback no blob.
        const values = Array.isArray(c.value) ? c.value : [c.value];
        const leadVal = String(lead?.[c.leadField] || '').toLowerCase().trim();
        let matched = false;
        for (const v of values) {
          const vn = String(v || '').toLowerCase().trim();
          if (!vn) continue;
          if (leadVal && (leadVal === vn || leadVal.includes(vn) || vn.includes(leadVal))) { matched = true; break; }
          if (!leadVal && this._phraseMatch(lead, v)) { matched = true; break; }
        }
        if (matched) {
          score += weight;
          reasons.push({ type: 'fit', label: `${c.key}: ${Array.isArray(c.value) ? c.value.join(' / ') : c.value}`, points: weight });
        }
      } else if (c.mode === 'exact') {
        // Awareness level: campo do lead deve casar exato com o do blueprint.
        const target = String(c.value || '').toLowerCase().trim();
        const leadVal = String(lead?.[c.leadField] || '').toLowerCase().trim();
        if (target && leadVal && target === leadVal) {
          score += weight;
          reasons.push({ type: 'fit', label: `${c.key}: ${target}`, points: weight });
        }
      }
    }
    // Negativos: subtração saturada com cap de 30 (curva logística).
    let negativesHit = 0;
    const negativeSignals = blueprint._internal.negativeSignals || [];
    for (const neg of negativeSignals) {
      if (this._tagsExact(tags, neg) || this._phraseMatch(lead, neg)) {
        negativesHit += 1;
        reasons.push({ type: 'negative', label: `Negativo: ${neg}`, points: 0 });
      }
    }
    const negativeCap = 30 * (1 - Math.exp(-negativesHit / 3));
    score -= negativeCap;
    // Domain excluído na Negative Selection → cap absoluto 30.
    if (window.NegativeSelectionEngine && lead?.companyDomain && NegativeSelectionEngine.isExcludedDomain(lead.companyDomain)) {
      score = Math.min(score, 30);
      reasons.push({ type: 'negative', label: `Domínio em lista de exclusão`, points: -score });
    }
    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      detected: reasons.filter(r => r.type === 'fit').length,
      possible: possible > 0 ? 5 : 0,
      reasons,
      negativesHit: Math.round(negativeCap)
    };
  },

  _tagSet(lead) {
    const raw = Array.isArray(lead?.tags) ? lead.tags : String(lead?.tags || '').split(/[,;]/);
    return new Set(raw.map(t => this._normalize(t)).filter(Boolean));
  },

  _normalize(s) {
    return String(s || '').toLowerCase().trim().replace(/^#/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[_-]/g, ' ');
  },

  _tagsExact(tags, value) {
    const v = this._normalize(value);
    if (!v) return false;
    if (tags.has(v)) return true;
    // Alias longo: blueprint pode usar tagAliases pra mapear. Mas fallback aqui é phrase containment ≥3 chars.
    for (const t of tags) {
      if (t === v) return true;
      if (v.length >= 3 && t.length >= 3 && (t.includes(v) || v.includes(t))) return true;
    }
    return false;
  },

  // Encontra em qual bucket ordenado o lead se encaixa (ex: "25-34" presente
  // nas tags → retorna "25-34"). Retorna null se o lead não declara.
  _extractOrdered(tags, orderedList) {
    if (!Array.isArray(orderedList)) return null;
    for (const item of orderedList) {
      if (this._tagsExact(tags, item)) return item;
    }
    return null;
  },

  // Adjacência: exato = 1.0; vizinho imediato (índice ±1) = 0.5; demais = 0.
  // Usa o melhor fator entre os targets quando o usuário marcou múltiplos.
  _adjacencyFactor(targets, leadValue, orderedList) {
    if (!Array.isArray(orderedList) || !leadValue) return 0;
    const leadIdx = orderedList.indexOf(leadValue);
    if (leadIdx < 0) return 0;
    let best = 0;
    for (const t of targets) {
      const ti = orderedList.indexOf(t);
      if (ti < 0) continue;
      const diff = Math.abs(leadIdx - ti);
      const f = diff === 0 ? 1 : diff === 1 ? 0.5 : 0;
      if (f > best) best = f;
    }
    return best;
  },

  // Phrase match: para pain/interest. Exige ≥2 palavras quando a frase tem >1.
  _phraseMatch(lead, value) {
    const v = this._normalize(value);
    if (!v) return false;
    const blob = this._normalize(`${lead?.name || ''} ${lead?.email || ''} ${(lead?.notes || '')} ${(Array.isArray(lead?.tags) ? lead.tags.join(' ') : lead?.tags || '')}`);
    const words = v.split(/\s+/).filter(w => w.length >= 3);
    if (!words.length) return false;
    if (words.length === 1) return blob.includes(words[0]);
    const hits = words.filter(w => blob.includes(w)).length;
    return hits >= Math.min(2, words.length);
  }
};
