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

  // V31.2.35 — Mensagem específica pro user resolver. Ainda joga error mas
  // o handler abaixo captura e retorna 400 com texto acionável.
  throw new Error('NO_LIST_FOUND: nenhuma list encontrada em "' + (space?.name || 'primeiro space') + '". Crie uma list folderless ou dentro de um folder no ClickUp pra poder criar tasks.');
}

module.exports = async function handler(req, res) {
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });

  const userId = req.user.sub;
  // V31.2.33 — Aceita todos os campos do POST /list/{list_id}/task da ClickUp API.
  // Normal: name (req), description, assignees.
  // Avançado opcional: due_date(+_time), start_date(+_time), priority, status, tags,
  //   time_estimate, points, parent, links_to, custom_fields, markdown_content.
  const {
    name, description, markdown_content,
    assignees, assignee, // assignee single é legado; assignees array é o novo
    list_id,
    due_date, due_date_time,
    start_date, start_date_time,
    priority, status, tags,
    time_estimate, points,
    parent, links_to,
    custom_fields
  } = req.body || {};
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

    // Normaliza assignees: aceita array ou singular (compat).
    let assigneesArr = null;
    if (Array.isArray(assignees) && assignees.length) assigneesArr = assignees.map(Number).filter(Boolean);
    else if (assignee) assigneesArr = [Number(assignee)].filter(Boolean);

    // Priority: aceita string ('urgent'|'high'|'normal'|'low') ou int direto 1-4.
    let priorityInt;
    if (typeof priority === 'number') priorityInt = priority;
    else if (priority === 'urgent') priorityInt = 1;
    else if (priority === 'high') priorityInt = 2;
    else if (priority === 'normal') priorityInt = 3;
    else if (priority === 'low') priorityInt = 4;

    const taskBody = {
      name: String(name).slice(0, 255),
      description: description ? String(description) : undefined,
      markdown_content: markdown_content ? String(markdown_content) : undefined,
      assignees: assigneesArr || undefined,
      due_date: due_date ? new Date(due_date).getTime() : undefined,
      due_date_time: typeof due_date_time === 'boolean' ? due_date_time : undefined,
      start_date: start_date ? new Date(start_date).getTime() : undefined,
      start_date_time: typeof start_date_time === 'boolean' ? start_date_time : undefined,
      priority: priorityInt,
      status: status ? String(status) : undefined,
      tags: Array.isArray(tags) && tags.length ? tags.map(String) : undefined,
      time_estimate: Number.isFinite(Number(time_estimate)) && Number(time_estimate) > 0 ? Number(time_estimate) : undefined,
      points: Number.isFinite(Number(points)) ? Number(points) : undefined,
      parent: parent ? String(parent) : undefined,
      links_to: links_to ? String(links_to) : undefined,
      custom_fields: Array.isArray(custom_fields) && custom_fields.length ? custom_fields : undefined
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
    // V31.2.35 — Mensagens específicas pro user agir
    if (err.message?.startsWith('NO_LIST_FOUND:')) {
      return res.status(400).json({ ok: false, message: err.message.replace('NO_LIST_FOUND: ', '') });
    }
    if (err.message?.includes('ENCRYPTION_KEY')) {
      return res.status(503).json({ ok: false, message: 'ENCRYPTION_KEY ausente ou inválida no servidor.' });
    }
    if (err.message?.includes('ClickUp não conectado')) {
      return res.status(404).json({ ok: false, message: 'ClickUp não conectado. Reconecte em Configurações → Integrações.' });
    }
    return res.status(500).json({ ok: false, message: err.message });
  }
};
