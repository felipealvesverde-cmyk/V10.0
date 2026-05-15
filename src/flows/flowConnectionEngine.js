// V15.1 — Flow Connection Engine
// Manipula as conexões entre ações (entrada/saída) garantindo integridade
// do grafo: sem auto-conexão, sem ciclos, sem duplicatas, simetria entre
// next/previous.
window.FlowConnectionEngine = {
  _findAction(actionId) {
    return (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
  },

  _patchAction(actionId, patcher) {
    App.state.actions = (App.state.actions || []).map(a => {
      if (Number(a.id) !== Number(actionId)) return a;
      const ensured = FlowEngine.ensureActionFlow(a);
      const nextFlow = patcher({ ...ensured.flow });
      return { ...ensured, flow: nextFlow };
    });
  },

  connect(fromId, toId) {
    const from = this._findAction(fromId);
    const to = this._findAction(toId);
    if (!from || !to) return { ok: false, message: 'Ação não encontrada.' };
    const fromEnriched = FlowEngine.ensureActionFlow(from);
    const toEnriched = FlowEngine.ensureActionFlow(to);
    const validation = FlowEngine.canConnect(fromEnriched, toEnriched);
    if (!validation.ok) return validation;
    this._patchAction(fromId, flow => ({
      ...flow,
      enabled: true,
      nextActions: Array.from(new Set([...(flow.nextActions || []), Number(toId)]))
    }));
    this._patchAction(toId, flow => ({
      ...flow,
      enabled: true,
      previousActions: Array.from(new Set([...(flow.previousActions || []), Number(fromId)]))
    }));
    return { ok: true };
  },

  disconnect(fromId, toId) {
    this._patchAction(fromId, flow => ({
      ...flow,
      nextActions: (flow.nextActions || []).filter(id => Number(id) !== Number(toId))
    }));
    this._patchAction(toId, flow => ({
      ...flow,
      previousActions: (flow.previousActions || []).filter(id => Number(id) !== Number(fromId))
    }));
    return { ok: true };
  },

  setPosition(actionId, x, y) {
    this._patchAction(actionId, flow => ({
      ...flow,
      position: { x: Math.round(Number(x) || 0), y: Math.round(Number(y) || 0) }
    }));
  },

  enableFlow(actionId, enabled = true) {
    const wantEnable = Boolean(enabled);
    if (wantEnable) {
      this._patchAction(actionId, flow => ({ ...flow, enabled: true }));
      return;
    }
    // Quando DESATIVA: limpa todas as conexões de entrada e saída,
    // e remove referências a essa ação dos next/previous de outras.
    this._patchAction(actionId, flow => ({ ...flow, enabled: false, nextActions: [], previousActions: [] }));
    App.state.actions = (App.state.actions || []).map(action => {
      const ensured = FlowEngine.ensureActionFlow(action);
      return {
        ...ensured,
        flow: {
          ...ensured.flow,
          nextActions: (ensured.flow.nextActions || []).filter(id => Number(id) !== Number(actionId)),
          previousActions: (ensured.flow.previousActions || []).filter(id => Number(id) !== Number(actionId))
        }
      };
    });
  },

  setStages(actionId, startStage, endStage) {
    this._patchAction(actionId, flow => ({
      ...flow,
      startStage: startStage || flow.startStage,
      endStage: endStage || flow.endStage
    }));
  },

  setActionType(actionId, typeId) {
    if (!FlowEngine.actionTypeById(typeId)) return { ok: false };
    this._patchAction(actionId, flow => ({ ...flow, flowActionType: typeId }));
    return { ok: true };
  },

  pruneOrphans(campaignId) {
    const actionIds = new Set((App.state.actions || []).filter(a => Number(a.campaignId) === Number(campaignId)).map(a => Number(a.id)));
    App.state.actions = (App.state.actions || []).map(action => {
      if (Number(action.campaignId) !== Number(campaignId)) return action;
      const flow = FlowEngine.normalize(action.flow, action);
      return {
        ...action,
        flow: {
          ...flow,
          nextActions: (flow.nextActions || []).filter(id => actionIds.has(Number(id))),
          previousActions: (flow.previousActions || []).filter(id => actionIds.has(Number(id)))
        }
      };
    });
  }
};
