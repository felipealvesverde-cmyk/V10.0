// V32.7.0 — POST /api/clickup-pull-action-subtasks
// Pull-based: cliente passa array de action_ids LJ, retorna as subtasks reais
// que estão NO CLICKUP debaixo da task pai de cada ação.
//
// Substitui o ExecutionTaskStore local como source of truth no step 6 do Mapa.
// Felipe (Sansone): tarefas criadas via Djow chat ou em multi-aba sumiam do
// LJ porque dependia de cópia local. Agora ClickUp = source of truth.
//
// Body: { action_ids: [123, 456, ...] }
// Retorna: {
//   ok: true,
//   subtasksByAction: {
//     '123': [
//       { id, name, status, statusType, statusColor, url, assignees, dueDate, dateCreated },
//       ...
//     ],
//     '456': []   // sem subtasks
//   },
//   skipped: {
//     '789': 'no_mapping'  // ação sem mapping no ClickUp (modo flat ou nunca criou task)
//   }
// }
//
// Limita 30 ações por request (cada uma é 1 GET na ClickUp API).
const { clickupFetch } = require('../lib/clickup-client');
const { listMappings } = require('../lib/clickup-mirror');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const userId = req.user.sub;
  const actionIds = Array.isArray(req.body?.action_ids)
    ? req.body.action_ids.map(Number).filter(Boolean).slice(0, 30)
    : [];
  if (!actionIds.length) return res.status(400).json({ ok: false, message: 'action_ids (array) obrigatório.' });

  // Verifica ClickUp conectado + modo do mirror (flat=list não tem parent task pra puxar)
  const credRow = await req.tenantDb.query(
    'SELECT lj_root_id, lj_root_kind, lj_space_id FROM clickup_credentials WHERE user_id = $1',
    [userId]
  );
  if (!credRow.rows.length) return res.status(404).json({ ok: false, message: 'ClickUp não conectado.' });
  const cred = credRow.rows[0];
  const rootKind = cred.lj_root_kind || (cred.lj_space_id ? 'space' : null);

  // Carrega TODOS os mappings de uma vez (evita N queries no DB).
  const allMappings = await listMappings(req.tenantDb, userId);
  const actionMappingById = new Map();
  allMappings
    .filter(m => m.lj_kind === 'action' && m.clickup_kind === 'task')
    .forEach(m => actionMappingById.set(Number(m.lj_id), m.clickup_id));

  // Pra cada action: GET /task/{parent_id}?include_subtasks=true em paralelo.
  // No modo flat (rootKind='list'), action não tem mapping — skipped:'no_mapping'.
  const subtasksByAction = {};
  const skipped = {};

  await Promise.all(actionIds.map(async (actionId) => {
    const parentTaskId = actionMappingById.get(actionId);
    if (!parentTaskId) {
      skipped[actionId] = rootKind === 'list' ? 'flat_mode' : 'no_mapping';
      subtasksByAction[actionId] = [];
      return;
    }
    try {
      // ClickUp v2: GET /task/{id}?include_subtasks=true retorna subtasks no body.
      const r = await clickupFetch(req.tenantDb, userId, 'GET', `/task/${parentTaskId}?include_subtasks=true`);
      if (!r.ok) {
        skipped[actionId] = `clickup_${r.status}`;
        subtasksByAction[actionId] = [];
        return;
      }
      const rawSubtasks = Array.isArray(r.data?.subtasks) ? r.data.subtasks : [];
      subtasksByAction[actionId] = rawSubtasks.map(s => ({
        id: String(s.id || ''),
        name: String(s.name || ''),
        status: s.status?.status || null,
        statusType: s.status?.type || null,        // 'open' | 'closed' | 'custom'
        statusColor: s.status?.color || null,
        url: s.url || null,
        assignees: Array.isArray(s.assignees) ? s.assignees.map(a => a.username || a.email).filter(Boolean) : [],
        dueDate: s.due_date || null,
        dateCreated: s.date_created || null
      }));
    } catch (err) {
      skipped[actionId] = `error_${err.message}`;
      subtasksByAction[actionId] = [];
    }
  }));

  return res.status(200).json({
    ok: true,
    rootKind,
    subtasksByAction,
    skipped: Object.keys(skipped).length ? skipped : null,
    requestedCount: actionIds.length
  });
};
