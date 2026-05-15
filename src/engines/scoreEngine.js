var ScoreEngine = {
      getById(id) { return App.state.scores.find(score => Number(score.id) === Number(id)); },
      _compileRules(scorePreset) {
        const rules = State.normalizeTagRules(scorePreset.tagRules);
        const compiled = [];
        for (const rule of rules) {
          if (!rule.tag) continue;
          compiled.push({ tag: rule.tag.toLowerCase(), score: Number(rule.score || 0) });
        }
        return compiled;
      },
      calculateLeadScore(lead, scoreId = App.state.actionDraft.scoreId) {
        const scorePreset = this.getById(scoreId) || App.state.scores[0] || Config.defaultScore;
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
