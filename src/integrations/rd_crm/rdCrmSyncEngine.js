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

  // V22.1 — Empurra ao RD leads vinculados à campanha que ainda não têm deal.
  // Reutiliza a lógica do Actions.pushCampaignICPToRD mas sem toast pra rodar
  // no auto-sync silencioso. Retorna contagem de pushed/failed.
  async _autoPushUnsyncedLeads(campaign) {
    if (!campaign?.id) return { pushed: 0, failed: 0 };
    if (!RdCrmConfig.hasPipelineForCampaign(campaign.id)) return { pushed: 0, failed: 0 };
    if (!window.LeadBaseService?.forCampaign) return { pushed: 0, failed: 0 };
    if (!window.RdCrmContactService?.upsertContact || !window.RdCrmDealService?.createDeal) return { pushed: 0, failed: 0 };

    const pipelineInfo = RdCrmConfig.pipelineInfoForCampaign(campaign.id);
    const initialStage = pipelineInfo?.stageMap?.mkt_tof;
    if (!initialStage?.rdStageId) return { pushed: 0, failed: 0 };

    const product = (App.state.products || []).find(p => Number(p.id) === Number(campaign.productId));
    const productPrice = Number(product?.priceValue) > 0
      ? Number(product.priceValue)
      : (window.ProductRevenueEngine?.parseMoney
        ? ProductRevenueEngine.parseMoney(product?.price || product?.ticket || 0)
        : Number(String(product?.price || product?.ticket || '0').replace(/[^\d.,-]/g, '').replace(',', '.')) || 0);

    const leads = LeadBaseService.forCampaign(campaign.id) || [];
    let pushed = 0, failed = 0;

    for (const lead of leads) {
      const leadKey = LeadBaseService.keyOf(lead);
      if (!leadKey) { failed += 1; continue; }
      const existing = RdCrmConfig.dealForLead(leadKey, campaign.id);
      if (existing?.rdDealId) continue; // já está no RD, skip silencioso
      if (!lead.email) { failed += 1; continue; } // sem email não dá pra upsert
      try {
        const contactRes = await RdCrmContactService.upsertContact(lead);
        if (!contactRes.ok) { failed += 1; continue; }
        const idShort = lead.internalId
          ? `L-${String(lead.internalId).slice(-6)}`
          : `L-${String(leadKey).replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase()}`;
        const dealRes = await RdCrmDealService.createDeal({
          rdContactId: contactRes.rdContactId,
          pipelineId: pipelineInfo.pipelineId,
          stageId: initialStage.rdStageId,
          name: `${lead.name || lead.email} – ${idShort}`,
          amount: productPrice
        });
        if (!dealRes.ok) { failed += 1; continue; }
        RdCrmConfig.setDealForLead(leadKey, campaign.id, {
          rdDealId: dealRes.rdDealId,
          rdContactId: contactRes.rdContactId,
          currentStageCode: 'mkt_tof',
          amount: productPrice,
          createdAt: new Date().toISOString(),
          lastMovedAt: new Date().toISOString()
        });
        pushed += 1;
      } catch (_) {
        failed += 1;
      }
    }
    return { pushed, failed };
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
    // V21.4.6 — Loga rename/created/reused + falhas parciais. Status do sync
    // reflete se foi total ("success") ou parcial ("partial").
    if (ensure.created?.length) this._log('info', `[${campaign.name}] criadas: ${ensure.created.join(', ')}`);
    if (ensure.renamed?.length) this._log('info', `[${campaign.name}] renomeadas: ${ensure.renamed.join(', ')}`);
    if (ensure.reused?.length) this._log('info', `[${campaign.name}] reaproveitadas: ${ensure.reused.join(', ')}`);
    if (ensure.failed?.length) this._log('warn', `[${campaign.name}] falhas parciais: ${ensure.failed.join('; ')}`);

    const stageCount = Object.keys(ensure.stageMap || {}).length;
    const totalDef = RdCrmConfig.defaultStages().length;
    const fullSuccess = stageCount === totalDef && !ensure.failed?.length;
    cfg.pipelinesByCampaign[campaign.id] = {
      pipelineId,
      pipelineName,
      stageMap: ensure.stageMap,
      createdAt: existing?.createdAt || new Date().toISOString(),
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: fullSuccess ? 'success' : 'partial',
      lastSyncMessage: (collisionMsg ? `${collisionMsg} | ` : '') + (ensure.message || 'OK')
    };
    return { ok: true, pipelineId, pipelineName, stageMap: ensure.stageMap, partial: !fullSuccess };
  },

  async runSync({ silent = false, campaignId = null } = {}) {
    if (this._running) return { ok: false, message: 'Sync já em andamento.' };
    this._running = true;
    const cfg = this._ensureConfig();
    const startedAt = new Date().toISOString();
    cfg.lastSyncStatus = 'running';
    if (!silent) App.render();
    try {
      // V22.3.4 — Gate correto pra operações CRM: hasCrmToken (PAT estático)
      // em vez de isOAuthReady (que era OAuth do Marketing — opcional).
      if (!RdCrmConfig.hasCrmToken()) {
        cfg.lastSyncStatus = 'no_crm_token';
        cfg.lastSyncMessage = 'Conecte o CRM Personal Token antes de sincronizar.';
        this._log('warn', 'Sync cancelado: CRM Personal Token ausente.');
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
      // V22.1 — Auto-push de leads não-sincronizados após pipeline pronto.
      // Pega leads vinculados à campanha que ainda não têm rdDealId em
      // dealsByLead e empurra eles pro RD. Idempotente: leads já enviados
      // são ignorados.
      let autoPushed = 0;
      let autoPushFailed = 0;
      for (const campaign of targetCampaigns) {
        try {
          const r = await this._autoPushUnsyncedLeads(campaign);
          autoPushed += r.pushed;
          autoPushFailed += r.failed;
        } catch (e) {
          this._log('warn', `Auto-push falhou para "${campaign.name}": ${e?.message || e}`);
        }
      }
      if (autoPushed > 0 || autoPushFailed > 0) {
        this._log('info', `Auto-push: ${autoPushed} lead(s) novos enviados ao RD${autoPushFailed ? `, ${autoPushFailed} falha(s)` : ''}.`);
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
