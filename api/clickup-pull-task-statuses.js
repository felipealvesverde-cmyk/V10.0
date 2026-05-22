// V32.6.9 — POST /api/clickup-pull-task-statuses
// Recebe array de provider_task_ids, retorna status atual de cada um no ClickUp.
//
// Body: { task_ids: ['abc123', 'def456', ...] }
// Resposta: {
//   ok: true,
//   statuses: {
//     'abc123': { status: 'complete', statusType: 'closed', name: '...', url: '...' },
//     'def456': { status: 'in progress', statusType: 'open', name: '...', url: '...' },
//     'xyz789': { error: 'not_found' }
//   }
// }
//
// Usado pelo step 6 do Mapa da Receita (execução) pra mostrar status real do
// ClickUp em vez do snapshot local que nunca atualizava.
//
// Mapping de status ClickUp → status LJ (cliente decide):
//   statusType='closed'  → 'completed'
//   statusType='open' + status contém 'progress'/'doing' → 'in_progress'
//   resto (todo, open default) → 'pending'
const { clickupFetch } = require('../lib/clickup-client');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const userId = req.user.sub;
  const taskIds = Array.isArray(req.body?.task_ids) ? req.body.task_ids.filter(Boolean).map(String) : [];
  if (!taskIds.length) return res.status(400).json({ ok: false, message: 'task_ids (array) obrigatório.' });

  // Verifica que ClickUp está conectado
  const credRow = await req.tenantDb.query(
    'SELECT 1 FROM clickup_credentials WHERE user_id = $1',
    [userId]
  );
  if (!credRow.rows.length) {
    return res.status(404).json({ ok: false, message: 'ClickUp não conectado.' });
  }

  // GET /task/{id} em paralelo (limita a 20 por request pra não esgotar rate limit ClickUp)
  const limited = taskIds.slice(0, 20);
  const results = await Promise.all(limited.map(async (id) => {
    try {
      const r = await clickupFetch(req.tenantDb, userId, 'GET', `/task/${id}`);
      if (!r.ok) {
        return [id, {
          error: r.status === 404 ? 'not_found' : `clickup_${r.status}`,
          message: r.status === 404 ? 'Task deletada no ClickUp' : `ClickUp respondeu ${r.status}`
        }];
      }
      const data = r.data || {};
      const statusObj = data.status || {};
      return [id, {
        status: statusObj.status || null,
        statusType: statusObj.type || null,       // 'open' | 'closed' | 'custom'
        statusColor: statusObj.color || null,
        name: data.name || null,
        url: data.url || null,
        assignees: Array.isArray(data.assignees) ? data.assignees.map(a => a.username || a.email).filter(Boolean) : [],
        dueDate: data.due_date || null,
        listId: data.list?.id || null
      }];
    } catch (err) {
      return [id, { error: 'fetch_error', message: err.message }];
    }
  }));

  return res.status(200).json({
    ok: true,
    statuses: Object.fromEntries(results),
    limited: taskIds.length > 20 ? { requested: taskIds.length, returned: 20 } : null
  });
};
