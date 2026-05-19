// V31.2.32 — Cria task no ClickUp usando credenciais salvas no DB.
// Auto-descobre primeira list do workspace na primeira call e cacheia em
// clickup_credentials.default_list_id pra reusar.
//
// POST body: { name, description?, due_date?, priority?, assignee?, list_id? }
//   list_id é opcional — se omitido, usa default_list_id (ou descobre).
// Retorna: { ok, providerTaskId, externalUrl, listId }
const { clickupFetch } = require('../lib/clickup-client');

async function discoverFirstList(req, userId) {
  // Pega workspace_id armazenado
  const cred = await req.db.query('SELECT workspace_id FROM clickup_credentials WHERE user_id = $1', [userId]);
  const workspaceId = cred.rows[0]?.workspace_id;
  if (!workspaceId) throw new Error('Workspace não encontrado nas credenciais.');

  // 1. Lista spaces do workspace
  const spacesRes = await clickupFetch(req.db, userId, 'GET', `/team/${workspaceId}/space`);
  if (!spacesRes.ok) throw new Error(`ClickUp /space falhou (${spacesRes.status}).`);
  const spaces = Array.isArray(spacesRes.data?.spaces) ? spacesRes.data.spaces : [];
  if (!spaces.length) throw new Error('Workspace sem spaces.');
  const space = spaces[0];

  // 2. Tenta folderless list primeiro (mais simples)
  const folderlessRes = await clickupFetch(req.db, userId, 'GET', `/space/${space.id}/list`);
  if (folderlessRes.ok && Array.isArray(folderlessRes.data?.lists) && folderlessRes.data.lists.length) {
    return folderlessRes.data.lists[0].id;
  }

  // 3. Se não tem folderless, busca em folders
  const foldersRes = await clickupFetch(req.db, userId, 'GET', `/space/${space.id}/folder`);
  if (foldersRes.ok && Array.isArray(foldersRes.data?.folders) && foldersRes.data.folders.length) {
    const folder = foldersRes.data.folders[0];
    const listsRes = await clickupFetch(req.db, userId, 'GET', `/folder/${folder.id}/list`);
    if (listsRes.ok && Array.isArray(listsRes.data?.lists) && listsRes.data.lists.length) {
      return listsRes.data.lists[0].id;
    }
  }

  throw new Error('Nenhuma list disponível no primeiro space.');
}

module.exports = async function handler(req, res) {
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });

  const userId = req.user.sub;
  const { name, description, due_date, priority, assignee, list_id } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, message: 'name é obrigatório.' });

  try {
    let targetListId = list_id;
    if (!targetListId) {
      const cached = await req.db.query('SELECT default_list_id FROM clickup_credentials WHERE user_id = $1', [userId]);
      targetListId = cached.rows[0]?.default_list_id;
    }
    if (!targetListId) {
      targetListId = await discoverFirstList(req, userId);
      await req.db.query('UPDATE clickup_credentials SET default_list_id = $1 WHERE user_id = $2', [targetListId, userId]);
    }

    const taskBody = {
      name: String(name).slice(0, 255),
      description: description ? String(description) : undefined,
      due_date: due_date ? new Date(due_date).getTime() : undefined,
      assignees: assignee ? [assignee] : undefined,
      priority: priority === 'high' ? 1 : priority === 'low' ? 4 : 3
    };
    // Remove campos undefined pro JSON ficar limpo
    Object.keys(taskBody).forEach(k => taskBody[k] === undefined && delete taskBody[k]);

    const createRes = await clickupFetch(req.db, userId, 'POST', `/list/${targetListId}/task`, taskBody);
    if (!createRes.ok) {
      return res.status(502).json({ ok: false, message: `ClickUp recusou (${createRes.status}).`, details: createRes.data, listId: targetListId });
    }
    return res.status(200).json({
      ok: true,
      providerTaskId: createRes.data?.id || null,
      externalUrl: createRes.data?.url || null,
      listId: targetListId
    });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};
