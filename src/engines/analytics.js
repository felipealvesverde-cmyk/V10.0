var Analytics = {
      _bucket(leads) {
        let total = 0, sumScore = 0, cold = 0, warm = 0, hot = 0, opened = 0, read = 0, cta = 0;
        for (const lead of leads) {
          total += 1;
          const score = Number(lead.score || 0);
          sumScore += score;
          if (score < 30) cold += 1;
          else if (score < 60) warm += 1;
          else hot += 1;
          const tags = String(lead.tags || '').toLowerCase();
          if (tags.includes('#open')) opened += 1;
          if (tags.includes('#read')) read += 1;
          if (tags.includes('#cta')) cta += 1;
        }
        return { total, leads, avgScore: total ? Math.round(sumScore / total) : 0, cold, warm, hot, opened, read, cta };
      },
      actionResult(action) {
        return this._bucket(ScoreEngine.actionLeads(action));
      },
      fromActions(actions, campaignCount) {
        const leads = actions.flatMap(action => ScoreEngine.actionLeads(action));
        const bucket = this._bucket(leads);
        return { campaigns: campaignCount, actions: actions.length, leads: bucket.total, ...bucket };
      },
      global() {
        const ids = new Set(App.state.campaigns.map(campaign => campaign.id));
        const actions = App.state.actions.filter(action => ids.has(action.campaignId));
        return this.fromActions(actions, App.state.campaigns.length);
      },
      campaign(campaignId) { return this.fromActions(App.state.actions.filter(action => action.campaignId === campaignId), 1); },
      insight(analytics) {
        if (!analytics.leads) return 'Sem base suficiente para leitura. Crie ações com leads para gerar diagnóstico.';
        const openRate = analytics.opened / analytics.leads;
        const readRate = analytics.read / analytics.leads;
        const ctaRate = analytics.cta / analytics.leads;
        if (openRate < .25) return 'O gargalo principal está na abertura. Revise assunto, canal e promessa inicial antes de criar novas ações.';
        if (readRate < .18) return 'A abertura existe, mas a leitura cai. O conteúdo pode não estar sustentando a promessa da campanha.';
        if (ctaRate < .08) return 'O público está consumindo, mas não avança. Reforce CTA, oferta e clareza do próximo passo.';
        return 'A jornada tem sinais positivos. Priorize os leads quentes e crie uma próxima ação segmentada por score.';
      }
    };
window.Analytics = Analytics;
