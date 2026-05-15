// V15.1 — Flow Checkpoint Engine
// Define checkpoints que disparam mudança de estágio, tag e movimentação para
// a próxima ação. Usado tanto pelo LP tracker (V15) quanto manualmente.
window.FlowCheckpointEngine = {
  EVENTS: [
    { id: 'pageview',          label: 'Pageview' },
    { id: 'scroll_25',         label: 'Scroll 25%' },
    { id: 'scroll_50',         label: 'Scroll 50%' },
    { id: 'scroll_75',         label: 'Scroll 75%' },
    { id: 'scroll_90',         label: 'Scroll 90%' },
    { id: 'cta_click',         label: 'CTA click' },
    { id: 'form_started',      label: 'Formulário iniciado' },
    { id: 'form_submitted',    label: 'Formulário enviado' },
    { id: 'checkout_click',    label: 'Checkout click' },
    { id: 'exit',              label: 'Saída' },
    { id: 'video_watched',     label: 'Vídeo assistido' },
    { id: 'time_on_page_60s',  label: 'Tempo na página 60s' },
    { id: 'time_on_page_180s', label: 'Tempo na página 3 min' }
  ],

  emptyCheckpoint() {
    return {
      id: `cp_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      event: 'scroll_50',
      ruleValue: '',
      moveToStage: '',
      tagOnTrigger: '',
      scoreDelta: 0
    };
  },

  addCheckpoint(actionId) {
    return this._patchCheckpoints(actionId, list => [...list, this.emptyCheckpoint()]);
  },

  removeCheckpoint(actionId, checkpointId) {
    return this._patchCheckpoints(actionId, list => list.filter(c => c.id !== checkpointId));
  },

  updateCheckpoint(actionId, checkpointId, field, value) {
    return this._patchCheckpoints(actionId, list => list.map(c => {
      if (c.id !== checkpointId) return c;
      if (field === 'scoreDelta') return { ...c, scoreDelta: Number(value || 0) };
      return { ...c, [field]: value };
    }));
  },

  _patchCheckpoints(actionId, patcher) {
    App.state.actions = (App.state.actions || []).map(action => {
      if (Number(action.id) !== Number(actionId)) return action;
      const ensured = FlowEngine.ensureActionFlow(action);
      const checkpoints = patcher(ensured.flow.checkpoints || []);
      return { ...ensured, flow: { ...ensured.flow, checkpoints } };
    });
    return { ok: true };
  },

  triggerCheckpoint(action, checkpoint, leadIdentityKey) {
    if (!action || !checkpoint) return { ok: false };
    if (checkpoint.tagOnTrigger && window.RdCrmTagService) {
      RdCrmTagService.incrementStage(leadIdentityKey, checkpoint.tagOnTrigger);
    }
    if (checkpoint.moveToStage && window.RdCrmTagService) {
      RdCrmTagService.incrementStage(leadIdentityKey, checkpoint.moveToStage);
    }
    return { ok: true, fired: { actionId: action.id, checkpointId: checkpoint.id, at: new Date().toISOString() } };
  }
};
