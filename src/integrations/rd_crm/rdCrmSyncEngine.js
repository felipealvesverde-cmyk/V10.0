// V15 — Engine de sincronização RD CRM.
// Orquestra: lista pipelines + etapas, atualiza o stageMap local, sincroniza
// ações vinculadas, aplica tags acumulativas em leads, recalcula scoring.
// Tem dois drivers de timer: frontend (setInterval enquanto a aba está aberta)
// e Electron (recebe IPC tick do main process).
window.RdCrmSyncEngine = {
  _intervalId: null,
  _running: false,
  _electronUnsubscribe: null,

  _ensureConfig() {
    App.state.integrations = App.state.integrations || {};
    if (!App.state.integrations.rdCrm) {
      App.state.integrations.rdCrm = RdCrmConfig.defaultConfig();
    }
    return App.state.integrations.rdCrm;
  },

  _log(level, message) {
    const cfg = this._ensureConfig();
    cfg.syncLogs = Array.isArray(cfg.syncLogs) ? cfg.syncLogs : [];
    cfg.syncLogs.unshift({ at: new Date().toISOString(), level, message });
    cfg.syncLogs = cfg.syncLogs.slice(0, 20);
  },

  _shouldSyncCampaign(campaign) {
    if (!campaign?.id) return false;
    const cid = Number(campaign.id);
    const hasActions = (App.state.actions || []).some(a => Number(a.campaignId) === cid);
    const links = (App.state.campaignLeadLinks || {})[campaign.id] || (App.state.campaignLeadLinks || {})[cid] || [];
    const hasLinks = Array.isArray(links) && links.length > 0;
    const hasBlueprint = Boolean(window.RevenueScoreEngine?.hasBlueprint?.(cid)
      || window.RevenueScoreEngine?.hasBlueprint?.(campaign.id));
    return hasActions || hasLinks || hasBlueprint;
  },

  // V21.6 — Sincroniza UMA campanha: garante pipeline + 9 etapas no RD,
  // armazena em cfg.pipelinesByCampaign[campaign.id]. Idempotente: se já existe
  // pipelineId salvo, apenas reconcilia etapas.
  async syncCampaignPipeline(campaign) {
    const cfg = this._ensureConfig();
    if (!campaign?.id) return { ok: false, message: 'Campanha inválida.' };
    cfg.pipelinesByCampaign = cfg.pipelinesByCampaign || {};
    const existing = cfg.pipelinesByCampaign[campaign.id] || cfg.pipelinesByCampaign[Number(campaign.id)] || null;
    let pipelineId = existing?.pipelineId || '';
    let pipelineName = existing?.pipelineName || '';
    let collisionMsg = '';
    if (!pipelineId) {
      const baseName = RdCrmConfig.pipelineNameForCampaign(campaign);
      const found = await RdCrmPipelineService.createUniqueJourneyPipeline(baseName);
      if (!found.ok) {
        return { ok: false, message: found.message || 'Falha ao criar pipeline.' };
      }
      pipelineId = found.pipeline?.id || found.pipeline?._id || '';
      pipelineName = found.name || found.pipeline?.name || baseName;
      if (found.collisionAvoided) {
        collisionMsg = `Campanha "${campaign.name}": já existia "${found.requestedName}" no RD. Criamos "${pipelineName}".`;
        this._log('warn', collisionMsg);
      } else if (found.created) {
        this._log('info', `Pipeline criado p/ "${campaign.name}": ${pipelineName}`);
      }
    }
    const ensure = await RdCrmStageService.ensureJourneyStages(pipelineId);
    if (!ensure.ok) {
      const entry = {
        pipelineId,
        pipelineName,
        stageMap: existing?.stageMap || {},
        createdAt: existing?.createdAt || new Date().toISOString(),
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: 'stages_error',
        lastSyncMessage: ensure.message || 'Falha nas etapas.'
      };
      cfg.pipelinesByCampaign[campaign.id] = entry;
      return { ok: false, message: ensure.message || 'Falha nas etapas.' };
    }
    if (ensure.created?.length) this._log('info', `[${campaign.name}] etapas criadas: ${ensure.created.join(', ')}`);
    // V21.4.5 — Loga falhas de delete (mesmo em caso de sucesso) pra entender
    // se etapas default do RD estão sendo ignoradas/protegidas.
    if (ensure.deleteFailures?.length) {
      this._log('warn', `[${campaign.name}] falhas de delete: ${ensure.deleteFailures.join('; ')}`);
    }
    if (ensure.deleted?.length) this._log('info', `[${campaign.name}] etapas removidas: ${ensure.deleted.join(', ')}`);
    cfg.pipelinesByCampaign[campaign.id] = {
      pipelineId,
      pipelineName,
      stageMap: ensure.stageMap,
      createdAt: existing?.createdAt || new Date().toISOString(),
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: 'success',
      lastSyncMessage: collisionMsg || 'OK'
    };
    return { ok: true, pipelineId, pipelineName, stageMap: ensure.stageMap };
  },

  async runSync({ silent = false, campaignId = null } = {}) {
    if (this._running) return { ok: false, message: 'Sync já em andamento.' };
    this._running = true;
    const cfg = this._ensureConfig();
    const startedAt = new Date().toISOString();
    cfg.lastSyncStatus = 'running';
    if (!silent) App.render();
    try {
      if (!RdCrmConfig.isOAuthReady()) {
        cfg.lastSyncStatus = 'no_oauth';
        cfg.lastSyncMessage = 'Conecte o RD Station antes de sincronizar.';
        this._log('warn', 'Sync cancelado: OAuth pendente.');
        return { ok: false, message: cfg.lastSyncMessage };
      }
      const allCampaigns = Array.isArray(App.state.campaigns) ? App.state.campaigns : [];
      const targetCampaigns = campaignId
        ? allCampaigns.filter(c => Number(c.id) === Number(campaignId))
        : allCampaigns.filter(c => this._shouldSyncCampaign(c));
      if (!targetCampaigns.length) {
        cfg.lastSyncStatus = campaignId ? 'not_found' : 'no_campaigns';
        cfg.lastSyncMessage = campaignId
          ? 'Campanha não encontrada.'
          : 'Nenhuma campanha elegível para sync (sem ações, leads vinculados ou blueprint).';
        this._log('warn', cfg.lastSyncMessage);
        return { ok: false, message: cfg.lastSyncMessage };
      }
      let success = 0;
      let failed = 0;
      const failures = [];
      for (const campaign of targetCampaigns) {
        const r = await this.syncCampaignPipeline(campaign);
        if (r.ok) success += 1;
        else { failed += 1; failures.push(`${campaign.name}: ${r.message}`); }
      }
      const mapped = RdCrmActionMapper.mappedActions();
      for (const action of mapped) {
        try { RdCrmActionMapper.syncAction(action); } catch (e) { this._log('error', `Action sync falhou (${action.id}): ${e?.message || e}`); }
      }
      const rescore = RdCrmLeadScoringBridge.rescoreAll();
      cfg.lastSyncAt = startedAt;
      cfg.lastSyncStatus = failed ? (success ? 'partial' : 'failed') : 'success';
      const totalStages = Object.values(cfg.pipelinesByCampaign || {})
        .reduce((acc, p) => acc + Object.keys(p?.stageMap || {}).length, 0);
      cfg.lastSyncMessage = `${success}/${targetCampaigns.length} pipeline(s) OK • ${totalStages} etapas totais • ${mapped.length} ação(ões) sincronizadas • ${rescore.touched} lead(s) re-scoreados.${failed ? ` Falhas: ${failures.join('; ')}` : ''}`;
      this._log(failed ? 'warn' : 'info', cfg.lastSyncMessage);
      return { ok: !failed || success > 0, message: cfg.lastSyncMessage, success, failed };
    } catch (error) {
      cfg.lastSyncStatus = 'exception';
      cfg.lastSyncMessage = error?.message || 'Erro inesperado.';
      this._log('error', `Exception: ${cfg.lastSyncMessage}`);
      return { ok: false, message: cfg.lastSyncMessage };
    } finally {
      this._running = false;
      App.save();
      if (!silent) App.render();
    }
  },

  startAutoSync() {
    const cfg = this._ensureConfig();
    cfg.autoSync = true;
    if (cfg.autoSyncMode === 'electron' && window.leadJourneyDesktop?.onRdCrmTick) {
      this._electronUnsubscribe = window.leadJourneyDesktop.onRdCrmTick(() => this.runSync({ silent: true }));
      this._log('info', 'Auto-sync ativo (Electron main process).');
    } else {
      this.stopAutoSync(false);
      this._intervalId = setInterval(() => this.runSync({ silent: true }), RdCrmConfig.autoSyncIntervalMs);
      this._log('info', `Auto-sync ativo (frontend, a cada ${RdCrmConfig.autoSyncIntervalMs / 60000} min).`);
    }
  },

  stopAutoSync(saveFlag = true) {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
    if (typeof this._electronUnsubscribe === 'function') {
      try { this._electronUnsubscribe(); } catch (_) {}
      this._electronUnsubscribe = null;
    }
    if (saveFlag) {
      const cfg = this._ensureConfig();
      cfg.autoSync = false;
      this._log('info', 'Auto-sync desativado.');
    }
  },

  bootstrap() {
    const cfg = this._ensureConfig();
    if (cfg.autoSync) {
      try { this.startAutoSync(); } catch (error) { console.warn('RD CRM bootstrap falhou:', error); }
    }
  }
};
