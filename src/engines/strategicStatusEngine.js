// V31.1.0 — Strategic Status Engine
// Automatiza transições de `action.strategicStatus` (Planejada/Rodando/Pausada/
// Encerrada) baseadas em datas e estados de tasks no provider operacional
// (ClickUp via V30 ou Manual). Antes era 100% manual via chips no Mapa.
//
// Regra:
//   - sem tasks vinculadas → mantém o status manual (não mexe)
//   - task.status === 'completed' OU due_date passou → 'ended'
//   - task.status === 'paused' OU 'blocked' → 'paused'
//   - task.started_at <= now (e não acabou) → 'running'
//   - senão → 'planned'
//
// Override manual: gestor pode clicar nos chips de status no Mapa pra forçar.
// O engine não desfaz override; mas se houver nova mudança no provider, atualiza.
window.StrategicStatusEngine = {
  _changedRecently: false,

  // Recomputa o status de UMA ação. Retorna o novo status (ou null se sem mudança).
  recompute(actionId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return null;
    if (!action.strategicAreaId) return null; // ação solta, sem strategic status
    const tasks = window.ExecutionTaskStore ? ExecutionTaskStore.byAction(actionId) : [];
    if (!tasks.length) return action.strategicStatus || 'planned';

    // Pega task mais recente (heurística: maior created_at)
    const task = tasks.slice().sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    })[0];

    const now = Date.now();
    const dueDate = task.due_date ? new Date(task.due_date).getTime() : null;
    const startedAt = task.started_at ? new Date(task.started_at).getTime() : null;

    let newStatus;
    if (task.status === 'completed' || (dueDate && dueDate < now)) {
      newStatus = 'ended';
    } else if (task.status === 'paused' || task.status === 'blocked') {
      newStatus = 'paused';
    } else if (startedAt && startedAt <= now) {
      newStatus = 'running';
    } else {
      newStatus = 'planned';
    }

    if (newStatus !== action.strategicStatus) {
      action.strategicStatus = newStatus;
      this._changedRecently = true;
      return newStatus;
    }
    return null;
  },

  // Recomputa TUDO. Chamado por intervalo (tick) ou explicitamente.
  recomputeAll() {
    this._changedRecently = false;
    const actions = (App.state.actions || []).filter(a => a.strategicAreaId);
    let changed = 0;
    actions.forEach(a => {
      if (this.recompute(a.id) !== null) changed++;
    });
    if (changed > 0) {
      App.save();
      App.render();
      console.log(`[StrategicStatusEngine] ${changed} ação(ões) transitaram automaticamente.`);
    }
    return changed;
  },

  // Inicia tick periódico (5min). Demo user é skipped (read-only).
  startTick() {
    if (this._tickTimer) return;
    try {
      const u = JSON.parse(localStorage.getItem('lj_user') || '{}');
      if (u.mode === 'demo') return; // demo não recomputa (state é frozen)
    } catch (_) { /* segue */ }
    this._tickTimer = setInterval(() => {
      try { this.recomputeAll(); } catch (e) { console.warn('[StrategicStatusEngine] tick falhou:', e); }
    }, 5 * 60 * 1000);
  },

  stopTick() {
    if (this._tickTimer) { clearInterval(this._tickTimer); this._tickTimer = null; }
  }
};
