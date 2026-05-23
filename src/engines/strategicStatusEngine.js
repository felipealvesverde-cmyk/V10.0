// V31.1.0 → V32.9.0 — Strategic Status Engine
// Automatiza transições de `action.strategicStatus` (Planejada/Rodando/Pausada/
// Encerrada) baseadas em datas e estados de tasks no provider operacional.
//
// V32.9.0: source of truth migra de ExecutionTaskStore local (frágil — multi-aba,
// race condition, snapshot restore podem fazer task sumir) pra clickupActionSubtasks
// cache (V32.7.0 — fresh do ClickUp). Fallback ExecutionTaskStore preservado pra
// modo flat (raiz=List, sem mapping cascado) e tasks pré-V32.7.0.
//
// Regra:
//   - sem tasks vinculadas → mantém o status manual (não mexe)
//   - TODAS as tasks concluídas (statusType='closed' / status='completed') → 'ended'
//   - alguma task in_progress / 'progress'/'doing' no nome → 'running'
//   - alguma task com dueDate passada SEM concluída → 'paused' (atrasada)
//   - senão → 'planned'
//
// Override manual: gestor clica nos chips de status no Mapa pra forçar. Engine
// não desfaz override; mas próximo recompute pode sobrescrever conforme estado
// real evoluir. Comportamento esperado: status deriva da realidade, não do clique.
window.StrategicStatusEngine = {
  _changedRecently: false,

  // V32.9.0 — Coleta tasks de uma ação combinando 2 sources:
  // 1. clickupActionSubtasks (source of truth ClickUp — modo cascado)
  // 2. ExecutionTaskStore.byAction (fallback — modo flat / pré-V32.7.0)
  // Normaliza pra shape comum { status, statusType, dueDate, startedAt, source }.
  _collectTasks(actionId) {
    const out = [];
    // 1. ClickUp subtasks via cache V32.7.0
    const cuSubs = App.state.clickupActionSubtasks?.byActionId?.[actionId]
                || App.state.clickupActionSubtasks?.byActionId?.[String(actionId)]
                || [];
    cuSubs.forEach(s => out.push({
      status: s.status || null,
      statusType: s.statusType || null,        // 'open' | 'closed' | 'custom'
      dueDate: s.dueDate ? Number(s.dueDate) : null,
      startedAt: s.dateCreated ? Number(s.dateCreated) : null,
      source: 'clickup'
    }));
    // 2. Fallback local
    if (window.ExecutionTaskStore) {
      const locals = ExecutionTaskStore.byAction(actionId);
      locals.forEach(t => {
        // Se essa task já veio do ClickUp (provider_task_id casa com algum cuSub.id),
        // não duplica — confia no fresh do ClickUp.
        const isDuplicate = cuSubs.some(s => String(s.id) === String(t.provider_task_id));
        if (isDuplicate) return;
        out.push({
          status: t.status === 'completed' ? 'complete' : t.status,
          statusType: t.status === 'completed' ? 'closed' : 'open',
          dueDate: t.due_date ? new Date(t.due_date).getTime() : null,
          startedAt: t.started_at ? new Date(t.started_at).getTime() : null,
          source: 'local'
        });
      });
    }
    return out;
  },

  // Recomputa o status de UMA ação. Retorna o novo status (ou null se sem mudança).
  recompute(actionId) {
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(actionId));
    if (!action) return null;
    if (!action.strategicAreaId) return null; // ação solta, sem strategic status
    const tasks = this._collectTasks(actionId);
    if (!tasks.length) return action.strategicStatus || 'planned';

    const now = Date.now();

    // V32.9.0 — Avalia coletivamente, não pela "task mais recente".
    // Se TODAS as tasks fecharam, ação encerrou. Senão, deriva do estado das pendentes.
    const allClosed = tasks.every(t => t.statusType === 'closed');
    if (allClosed) {
      return this._setStatus(action, 'ended');
    }

    const openTasks = tasks.filter(t => t.statusType !== 'closed');
    const hasInProgress = openTasks.some(t => {
      const s = String(t.status || '').toLowerCase();
      return /progress|doing|andamento|in_progress/.test(s);
    });
    if (hasInProgress) return this._setStatus(action, 'running');

    const hasOverdue = openTasks.some(t => t.dueDate && t.dueDate < now);
    if (hasOverdue) return this._setStatus(action, 'paused'); // atrasada — tratamos como paused/alerta

    const hasStarted = openTasks.some(t => t.startedAt && t.startedAt <= now);
    if (hasStarted) return this._setStatus(action, 'running');

    return this._setStatus(action, 'planned');
  },

  // Helper: aplica novo status SE for diferente. Marca _changedRecently pra
  // recomputeAll saber que precisa save+render.
  _setStatus(action, newStatus) {
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
