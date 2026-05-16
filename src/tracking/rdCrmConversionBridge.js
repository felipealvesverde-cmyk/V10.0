// V24.0.0 — RD CRM Conversion Bridge.
//
// Fecha o "buraco" que existia entre o pixel de LP e o RD: quando o lead
// preenche um form na landing page (eventType === 'conversion' ou variantes),
// este bridge:
//   1. upserta o contato no RD CRM com email/nome/telefone do payload
//   2. cria o deal na campanha da LP, no startStage do flow da ação
//   3. incrementa tag local do startStage + funil de marketing
//   4. empurra as tags pro RD via PATCH /contacts/{id}/tags
//   5. recalcula o score local (RdCrmLeadScoringBridge.applyToLead)
//
// Idempotência: se o lead já tem deal nessa campanha (RdCrmConfig.dealForLead),
// pula o upsert/create e só re-tagueia.
window.RdCrmConversionBridge = {
  CONVERSION_EVENT_TYPES: new Set(['conversion', 'form_submit', 'lead_capture', 'opt_in']),

  isConversionEvent(eventType) {
    return this.CONVERSION_EVENT_TYPES.has(String(eventType || '').toLowerCase());
  },

  _extractLeadFields(event) {
    const p = event?.payload || event || {};
    const email = String(p.email || p.lead_email || p.contact_email || '').trim().toLowerCase();
    const name = String(p.name || p.full_name || p.lead_name || '').trim();
    const phone = String(p.phone || p.lead_phone || p.contact_phone || '').trim();
    const company = String(p.company || p.empresa || '').trim();
    return { email, name: name || email, phone, company };
  },

  async handle(event, lpEntry, action) {
    if (!event || !lpEntry || !action) return { ok: false, reason: 'missing-args' };
    if (!lpEntry.syncRdActive) return { ok: false, reason: 'sync-rd-inactive' };
    if (!window.RdCrmConfig?.hasCrmToken?.()) return { ok: false, reason: 'no-crm-token' };

    const { email, name, phone, company } = this._extractLeadFields(event);
    if (!email) return { ok: false, reason: 'no-email' };

    const campaignId = action.campaignId;
    if (!campaignId) return { ok: false, reason: 'no-campaign' };

    const startStage = action.flow?.startStage || lpEntry.startStage || 'mkt_tof';
    const pipelineInfo = RdCrmConfig.pipelineInfoForCampaign(campaignId);
    if (!pipelineInfo?.pipelineId) return { ok: false, reason: 'no-pipeline-for-campaign' };
    const initialStage = pipelineInfo.stageMap?.[startStage] || pipelineInfo.stageMap?.mkt_tof;
    if (!initialStage?.rdStageId) return { ok: false, reason: 'no-stage-mapping' };

    const leadShape = { email, name, phone, company };
    const leadKey = window.LeadIdentityEngine?.identityKey?.(leadShape) || email;

    const existing = RdCrmConfig.dealForLead?.(leadKey, campaignId);
    let rdContactId = existing?.rdContactId || null;
    let rdDealId = existing?.rdDealId || null;
    let createdContact = false;
    let createdDeal = false;

    if (!rdContactId) {
      if (!window.RdCrmContactService?.upsertContact) return { ok: false, reason: 'no-contact-service' };
      const upsert = await RdCrmContactService.upsertContact(leadShape);
      if (!upsert.ok) return { ok: false, reason: 'contact-upsert-failed', message: upsert.message };
      rdContactId = upsert.rdContactId;
      createdContact = upsert.created;
    }

    if (!rdDealId && window.RdCrmDealService?.createDeal) {
      const product = (App.state.products || []).find(p => Number(p.id) === Number(action.productId || lpEntry.productId));
      const amount = Number(product?.priceValue) > 0
        ? Number(product.priceValue)
        : (window.ProductRevenueEngine?.parseMoney
          ? ProductRevenueEngine.parseMoney(product?.price || product?.ticket || 0)
          : 0);
      const dealRes = await RdCrmDealService.createDeal({
        rdContactId,
        pipelineId: pipelineInfo.pipelineId,
        stageId: initialStage.rdStageId,
        name: `${name || email} – ${lpEntry.name || 'LP'}`,
        amount
      });
      if (!dealRes.ok) return { ok: false, reason: 'deal-create-failed', message: dealRes.message };
      rdDealId = dealRes.rdDealId;
      createdDeal = true;
      RdCrmConfig.setDealForLead?.(leadKey, campaignId, {
        rdDealId,
        rdContactId,
        currentStageCode: startStage,
        amount,
        createdAt: new Date().toISOString(),
        lastMovedAt: new Date().toISOString()
      });
    }

    if (window.RdCrmTagService) {
      RdCrmTagService.incrementFunnel(leadKey, 'marketing');
      RdCrmTagService.incrementStage(leadKey, startStage);
      const tagList = RdCrmTagService.flattenTagList(leadKey);
      if (tagList.length && rdContactId) {
        try { await RdCrmTagService.pushTagsToContact(rdContactId, tagList); } catch (_) {}
      }
    }

    if (window.LeadBaseService?.upsert) {
      const lead = LeadBaseService.upsert({
        name, email, phone, rdContactId, tags: []
      }, 'lp-conversion');
      const lbKey = lead ? LeadBaseService.keyOf(lead) : null;
      if (lbKey) {
        LeadBaseService.pushEvent(lbKey, {
          source: 'lp-conversion',
          type: 'conversion.captured',
          campaignId: Number(campaignId),
          actionId: action.id,
          trackingId: event.trackingId,
          lpId: lpEntry.lpId,
          startStage,
          rdDealId,
          createdContact,
          createdDeal
        });
      }
    }

    this._log({
      at: new Date().toISOString(),
      email,
      campaignId: Number(campaignId),
      actionId: action.id,
      lpId: lpEntry.lpId,
      startStage,
      rdContactId,
      rdDealId,
      createdContact,
      createdDeal
    });

    return { ok: true, rdContactId, rdDealId, createdContact, createdDeal, leadKey };
  },

  _log(entry) {
    App.state.rdConversionLog = Array.isArray(App.state.rdConversionLog) ? App.state.rdConversionLog : [];
    App.state.rdConversionLog.unshift(entry);
    App.state.rdConversionLog = App.state.rdConversionLog.slice(0, 50);
  },

  recentLog(limit = 10) {
    return (App.state.rdConversionLog || []).slice(0, limit);
  }
};
