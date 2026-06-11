var ScoreEngine = {
      // V31.0.1 — Defensivo: App.state pode ser null durante boot (State.normalize
      // chamado antes de this.state ser atribuído). Retorna undefined em vez de crashar.
      getById(id) {
        const scores = (window.App && App.state && App.state.scores) || [];
        return scores.find(score => Number(score.id) === Number(id));
      },
      _compileRules(scorePreset) {
        const rules = State.normalizeTagRules(scorePreset.tagRules);
        const compiled = [];
        for (const rule of rules) {
          if (!rule.tag) continue;
          compiled.push({ tag: rule.tag.toLowerCase(), score: Number(rule.score || 0) });
        }
        return compiled;
      },
      calculateLeadScore(lead, scoreId) {
        // V31.0.1 — Defensivo contra App.state null durante boot.
        // V37.0.9 — actionDraft.scoreId não existe mais; fallback agora é
        // direto pra scores[0] / Config.defaultScore.
        const scores = (window.App && App.state && App.state.scores) || [];
        const scorePreset = this.getById(scoreId) || scores[0] || Config.defaultScore;
        return this._scoreWithRules(lead, this._compileRules(scorePreset));
      },
      _scoreWithRules(lead, compiledRules) {
        const tags = String(lead.tags || '').toLowerCase();
        let score = 0;
        for (const rule of compiledRules) {
          if (tags.includes(rule.tag)) score += rule.score;
        }
        return score > 100 ? 100 : score;
      },
      withScore(lead, scoreId) { return { ...lead, score: this.calculateLeadScore(lead, scoreId) }; },
      actionLeads(action) {
        const leads = action.leads || [];
        if (!leads.length) return [];
        const preset = this.getById(action.scoreId) || App.state.scores[0] || Config.defaultScore;
        const compiled = this._compileRules(preset);
        return leads.map(lead => ({ ...lead, score: this._scoreWithRules(lead, compiled) }));
      }
    };
window.ScoreEngine = ScoreEngine;
