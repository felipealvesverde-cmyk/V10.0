// V31.2.32 — Cria task no ClickUp usando credenciais salvas no DB.
// Auto-descobre primeira list do workspace na primeira call e cacheia em
// clickup_credentials.default_list_id pra reusar.
//
// POST body: { name, description?, due_date?, priority?, assignee?, list_id? }
//   list_id é opcional — se omitido, usa default_list_id (ou descobre).
// Retorna: { ok, providerTaskId, externalUrl, listId }
const { clickupFetch } = require('../lib/clickup-client');
const mirror = require('../lib/clickup-mirror');

// V32.1.4 — Garante que a tag automática (lj-auto por padrão) existe no
// space da list de destino. ClickUp organiza tags por space, não por list.
// Idempotente: chama GET /space/{id}/tag, cria se não existir.
// Falha silenciosamente (return false) — não bloqueia criação da task.
async function ensureLjTagExists(req, userId, spaceId, tagName) {
  if (!spaceId || !tagName) return false;
  try {
    const list = await clickupFetch(req.tenantDb, userId, 'GET', `/space/${spaceId}/tag`);
    if (!list.ok) return false;
    const existing = Array.isArray(list.data?.tags) ? list.data.tags : [];
    const has = existing.some(t => String(t.name || '').toLowerCase() === String(tagName).toLowerCase());
    if (has) return true;
    const create = await clickupFetch(req.tenantDb, userId, 'POST', `/space/${spaceId}/tag`, {
      tag: { name: tagName, tag_fg: '#FFFFFF', tag_bg: '#7C3AED' }
    });
    return create.ok;
  } catch (_) {
    return false;
  }
}

// V32.0.9 — clickup_credentials vivem no tenant plane. Tudo aqui usa req.tenantDb.
async function discoverFirstList(req, userId) {
  // Pega workspace_id armazenado
  const cred = await req.tenantDb.query('SELECT workspace_id FROM clickup_credentials WHERE user_id = $1', [userId]);
  const workspaceId = cred.rows[0]?.workspace_id;
  if (!workspaceId) throw new Error('Workspace não encontrado nas credenciais.');

  // 1. Lista spaces do workspace
  const spacesRes = await clickupFetch(req.tenantDb, userId, 'GET', `/team/${workspaceId}/space`);
  if (!spacesRes.ok) throw new Error(`ClickUp /space falhou (${spacesRes.status}).`);
  const spaces = Array.isArray(spacesRes.data?.spaces) ? spacesRes.data.spaces : [];
  if (!spaces.length) throw new Error('Workspace sem spaces.');
  const space = spaces[0];

  // 2. Tenta folderless list primeiro (mais simples)
  const folderlessRes = await clickupFetch(req.tenantDb, userId, 'GET', `/space/${space.id}/list`);
  if (folderlessRes.ok && Array.isArray(folderlessRes.data?.lists) && folderlessRes.data.lists.length) {
    return folderlessRes.data.lists[0].id;
  }

  // 3. Se não tem folderless, busca em folders
  const foldersRes = await clickupFetch(req.tenantDb, userId, 'GET', `/space/${space.id}/folder`);
  if (foldersRes.ok && Array.isArray(foldersRes.data?.folders) && foldersRes.data.folders.length) {
    const folder = foldersRes.data.folders[0];
    const listsRes = await clickupFetch(req.tenantDb, userId, 'GET', `/folder/${folder.id}/list`);
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
    custom_fields,
    // V32.2.0 — Mirror context: caller passa estes 3 pra LJ resolver a hierarquia
    // (Produto > Campanha > Ação > Subtask). Se não passar, cai no modo legado.
    mirror_context  // { product: {id, name}, campaign: {id, name}, action: {id, name} }
  } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, message: 'name é obrigatório.' });

  try {
    // V32.1.4-V32.2.0 — carrega TODAS settings ClickUp do user.
    const credRow = await req.tenantDb.query(
      `SELECT default_list_id, default_space_id, lj_tag_name, task_prefix,
              status_map_json, write_enabled, lj_space_id, mirror_enabled
       FROM clickup_credentials WHERE user_id = $1`,
      [userId]
    );
    const cred = credRow.rows[0] || {};

    // V32.1.6 — Read-only mode: bloqueia escrita se write_enabled = false.
    // User pode habilitar/desabilitar em Configurações → ClickUp. Útil pra
    // testar conexão sem risco de criar tasks indesejadas no ClickUp do cliente.
    if (cred.write_enabled === false) {
      return res.status(403).json({
        ok: false,
        code: 'clickup_read_only',
        message: 'Modo somente-leitura ativado pra ClickUp. Tasks NÃO serão criadas. Pra reativar, vá em Configurações → Integrações → ClickUp → Modo de escrita.'
      });
    }

    let targetListId = list_id || cred.default_list_id;
    let parentTaskId = parent;  // V32.2.0: pode ser sobrescrito por mirror
    let mirrorInfo = null;       // pra retornar pro caller saber a hierarquia criada

    // V32.2.0 — Mirror mode: se mirror_enabled + mirror_context + lj_space_id,
    // resolve cascata Produto > Campanha > Ação. Subtask vira filha da task pai
    // da ação. Mata uso de default_list_id no fluxo normal.
    const useMirror = cred.mirror_enabled !== false
      && cred.lj_space_id
      && mirror_context
      && mirror_context.product?.id
      && mirror_context.campaign?.id
      && mirror_context.action?.id;

    if (useMirror) {
      try {
        const chain = await mirror.resolveActionChain(
          req.tenantDb, userId, cred.lj_space_id,
          mirror_context.product, mirror_context.campaign, mirror_context.action
        );
        targetListId = chain.listId;        // list da campanha (parent da task pai)
        parentTaskId = chain.actionParentTaskId;  // task pai = ação → subtask
        mirrorInfo = {
          folderId: chain.folderId,
          listId: chain.listId,
          actionParentTaskId: chain.actionParentTaskId,
          createdAny: chain.createdAny
        };
      } catch (err) {
        return res.status(500).json({
          ok: false,
          step: 'mirror_resolve',
          message: `Falha ao resolver hierarquia espelhada: ${err.message}. Verifique se o Space LeadJourney existe + permissões do PAT.`
        });
      }
    }

    // V32.1.3 — Sem mirror e sem default_list → bloqueia (auto-discovery removida).
    if (!targetListId) {
      return res.status(400).json({
        ok: false,
        code: 'no_default_list',
        message: cred.lj_space_id
          ? 'Modo espelhado ativado mas o request não veio com mirror_context. Caller precisa passar { product, campaign, action } pra resolver a hierarquia.'
          : 'List de destino do ClickUp não configurada e modo espelhado não inicializado. Vá em Configurações → Integrações → ClickUp pra configurar.'
      });
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

    // V32.1.4 — Aplica prefixo opcional no nome (configurável pelo user).
    const finalName = cred.task_prefix
      ? `${cred.task_prefix}${String(name)}`.slice(0, 255)
      : String(name).slice(0, 255);

    // V32.1.5 — Status inicial: se user passou um status explícito, respeita.
    // Senão usa mapping["pending"] (status que cliente configurou pra "task nova").
    let initialStatus = status ? String(status) : undefined;
    if (!initialStatus && cred.status_map_json) {
      try {
        const map = JSON.parse(cred.status_map_json);
        if (map && map.pending) initialStatus = String(map.pending);
      } catch (_) { /* mapping inválido — ignora, deixa ClickUp usar default da list */ }
    }

    // V32.1.4 — Merge da tag automática (lj_tag_name) com tags do request.
    // Tag fica criada no space (ensureLjTagExists). Idempotente, não bloqueia
    // se falhar (usuário sem permissão de criar tag, etc.) — só não aplica.
    let finalTags = Array.isArray(tags) && tags.length ? tags.map(String) : [];
    if (cred.lj_tag_name && cred.default_space_id) {
      const tagReady = await ensureLjTagExists(req, userId, cred.default_space_id, cred.lj_tag_name);
      if (tagReady && !finalTags.includes(cred.lj_tag_name)) {
        finalTags.push(cred.lj_tag_name);
      }
    }

    const taskBody = {
      name: finalName,
      description: description ? String(description) : undefined,
      markdown_content: markdown_content ? String(markdown_content) : undefined,
      assignees: assigneesArr || undefined,
      due_date: due_date ? new Date(due_date).getTime() : undefined,
      due_date_time: typeof due_date_time === 'boolean' ? due_date_time : undefined,
      start_date: start_date ? new Date(start_date).getTime() : undefined,
      start_date_time: typeof start_date_time === 'boolean' ? start_date_time : undefined,
      priority: priorityInt,
      status: initialStatus,
      tags: finalTags.length ? finalTags : undefined,
      time_estimate: Number.isFinite(Number(time_estimate)) && Number(time_estimate) > 0 ? Number(time_estimate) : undefined,
      points: Number.isFinite(Number(points)) ? Number(points) : undefined,
      parent: parentTaskId ? String(parentTaskId) : undefined,  // V32.2.0: mirror seta isso pra task virar subtask da ação
      links_to: links_to ? String(links_to) : undefined,
      custom_fields: Array.isArray(custom_fields) && custom_fields.length ? custom_fields : undefined
    };
    // Remove campos undefined pro JSON ficar limpo
    Object.keys(taskBody).forEach(k => taskBody[k] === undefined && delete taskBody[k]);

    const createRes = await clickupFetch(req.tenantDb, userId, 'POST', `/list/${targetListId}/task`, taskBody);
    if (!createRes.ok) {
      return res.status(502).json({ ok: false, message: `ClickUp recusou (${createRes.status}).`, details: createRes.data, listId: targetListId });
    }
    return res.status(200).json({
      ok: true,
      providerTaskId: createRes.data?.id || null,
      externalUrl: createRes.data?.url || null,
      listId: targetListId,
      // V32.2.0 — Devolve mirror chain criada (caller pode mostrar links na UI)
      mirror: mirrorInfo
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
