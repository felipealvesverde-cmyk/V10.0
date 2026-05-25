// V33.0.0 — Onda 3: engine de atribuição causal.
//
// Quando uma lj_transition acontece, tenta inferir qual AÇÃO ClickUp do
// usuário causou a movimentação. Critério MVP (janela de 48h):
//
//   1. Pega o último touchpoint do visitor antes da transition → campaign_id.
//   2. Lê actions do journey_state JSONB filtra por campaignId.
//   3. Filtra actions cujo destino bate com to_stage da transition
//      (action.destSector + action.destFunnelPoint → marketing-mof, etc).
//   4. Busca execution_tasks dessas actions com last_synced_at OR completed_at
//      nas últimas 48h.
//   5. Pega a mais recente. Se nenhuma encontrada → null.
//
// O caller (transition-engine) grava attribution.actionId no campo
// triggered_by_action_id da lj_transitions row recém-criada.

const ATTRIBUTION_WINDOW_HOURS = 48;

// Map de estágios LJ pra estrutura das actions: as actions usam destSector
// ('Marketing'|'Vendas'|'CS') + destFunnelPoint ('TOF'|'MOF'|'BOF') que precisa
// virar stageId ('marketing-tof'|'marketing-mof'|...).
function actionDestToStageId(action) {
  const sector = String(action.destSector || '').toLowerCase();
  const funnel = String(action.destFunnelPoint || '').toLowerCase();
  if (!sector || !funnel) return null;
  return `${sector}-${funnel}`;
}

async function getLastTouchpointCampaign(tenantDb, userId, visitorId, beforeTimestamp) {
  const r = await tenantDb.query(
    `SELECT campaign_id FROM lj_visitor_touchpoints
     WHERE user_id = $1 AND lj_visitor_id = $2 AND occurred_at <= $3
     ORDER BY occurred_at DESC LIMIT 1`,
    [userId, visitorId, beforeTimestamp]
  );
  return r.rows[0]?.campaign_id ? Number(r.rows[0].campaign_id) : null;
}

async function loadActionsFromState(tenantDb, userId) {
  const r = await tenantDb.query(
    `SELECT state_json FROM journey_state WHERE user_id = $1`,
    [userId]
  );
  const state = r.rows[0]?.state_json || {};
  return Array.isArray(state.actions) ? state.actions : [];
}

// Busca tasks de execução das actions candidatas que rodaram na janela.
// executionTasks vivem em App.state.executionTasks (mesmo JSONB).
async function loadRecentExecutionTasks(tenantDb, userId, actionIds, sinceTimestamp) {
  if (!actionIds.length) return [];
  const r = await tenantDb.query(
    `SELECT state_json FROM journey_state WHERE user_id = $1`,
    [userId]
  );
  const tasks = Array.isArray(r.rows[0]?.state_json?.executionTasks) ? r.rows[0].state_json.executionTasks : [];
  const sinceMs = new Date(sinceTimestamp).getTime();
  const actionIdSet = new Set(actionIds.map(Number));
  return tasks.filter(t => {
    if (!actionIdSet.has(Number(t.linked_action_id))) return false;
    // Considera "rodou recente" se: completed_at OR last_synced_at OR started_at nas últimas 48h.
    const stamps = [t.completed_at, t.last_synced_at, t.started_at].filter(Boolean);
    if (stamps.length === 0) return false;
    return stamps.some(s => {
      const tsMs = new Date(s).getTime();
      return tsMs >= sinceMs;
    });
  });
}

/**
 * Tenta atribuir uma transition a uma action ClickUp.
 * @returns {Promise<{actionId: number|null, reason: string}>}
 */
async function attributeTransition({ tenantDb, userId, visitorId, toStage, occurredAt }) {
  if (!toStage) return { actionId: null, reason: 'no_to_stage' };

  // 1. Pega campaign do último touchpoint antes/durante a transition
  const campaignId = await getLastTouchpointCampaign(tenantDb, userId, visitorId, occurredAt);
  if (!campaignId) return { actionId: null, reason: 'no_touchpoint_campaign' };

  // 2. Carrega actions do state e filtra por campanha + destino compatível
  const allActions = await loadActionsFromState(tenantDb, userId);
  const candidates = allActions.filter(a => {
    if (Number(a.campaignId) !== Number(campaignId)) return false;
    const dest = actionDestToStageId(a);
    return dest === toStage;
  });
  if (!candidates.length) return { actionId: null, reason: 'no_matching_actions' };

  // 3. Busca execution_tasks dessas actions na janela
  const occurredMs = new Date(occurredAt).getTime();
  const sinceMs = occurredMs - (ATTRIBUTION_WINDOW_HOURS * 60 * 60 * 1000);
  const sinceTimestamp = new Date(sinceMs).toISOString();
  const recentTasks = await loadRecentExecutionTasks(tenantDb, userId, candidates.map(a => a.id), sinceTimestamp);
  if (!recentTasks.length) return { actionId: null, reason: 'no_recent_tasks' };

  // 4. Pega a action da task mais recente (timestamp mais alto entre stamps válidos)
  let bestTask = null;
  let bestTs = -Infinity;
  for (const t of recentTasks) {
    const stamps = [t.completed_at, t.last_synced_at, t.started_at].filter(Boolean);
    const maxTs = Math.max(...stamps.map(s => new Date(s).getTime()));
    if (maxTs > bestTs && maxTs <= occurredMs) {
      bestTs = maxTs;
      bestTask = t;
    }
  }
  if (!bestTask) return { actionId: null, reason: 'no_task_within_window' };

  return {
    actionId: Number(bestTask.linked_action_id),
    reason: 'matched',
    matchedTaskId: bestTask.task_id,
    matchedAt: new Date(bestTs).toISOString()
  };
}

/**
 * Agrega métricas de atribuição por action.
 * @returns {Promise<Map<actionId, { transitions: number, customers: number, leads: number }>>}
 */
async function aggregateAttributionsByAction(tenantDb, userId, sinceDays = 30) {
  const sinceTimestamp = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const r = await tenantDb.query(
    `SELECT triggered_by_action_id AS action_id, to_entity, COUNT(*) AS c
     FROM lj_transitions
     WHERE user_id = $1 AND triggered_by_action_id IS NOT NULL
       AND occurred_at >= $2
     GROUP BY triggered_by_action_id, to_entity`,
    [userId, sinceTimestamp]
  );
  const map = new Map();
  for (const row of r.rows) {
    const aid = Number(row.action_id);
    if (!map.has(aid)) map.set(aid, { actionId: aid, transitions: 0, leads: 0, customers: 0 });
    const bucket = map.get(aid);
    bucket.transitions += Number(row.c);
    if (row.to_entity === 'lead') bucket.leads += Number(row.c);
    if (row.to_entity === 'customer') bucket.customers += Number(row.c);
  }
  return map;
}

module.exports = {
  attributeTransition,
  aggregateAttributionsByAction,
  actionDestToStageId,
  ATTRIBUTION_WINDOW_HOURS
};
