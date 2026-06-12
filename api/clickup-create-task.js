// V32.2.9 (Geraldo A7 follow-up) — Refatorado pra usar lib/clickup-task-creator.
// Antes: ~120 linhas duplicadas com api/djow-chat.js case 'create_clickup_task'
// (read cred + write_enabled guard + mirror resolve + prefix + status normalize +
// tag ensure + tags merge). Agora helper prepareTaskBody centraliza tudo isso.
//
// Endpoint cuida apenas de: parse body HTTP, normaliza assignees/priority,
// build taskBody final, POST pra ClickUp, traduz errors p/ status HTTP.
//
// POST body: { name, description?, due_date?, priority?, assignee?, list_id?,
//              mirror_context? }
// Retorna: { ok, providerTaskId, externalUrl, listId, mirror }
const { clickupFetch } = require('../lib/clickup-client');
const { prepareTaskBody } = require('../lib/clickup-task-creator');
const { resolveCredentialOwnerId } = require('../lib/credentials-owner');

module.exports = async function handler(req, res) {
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });

  // V37.4.34 — Cred ClickUp vive na linha do owner do tenant (qualquer membro pode criar task).
  const userId = await resolveCredentialOwnerId(req);
  const {
    name, description, markdown_content,
    assignees, assignee,
    list_id,
    due_date, due_date_time,
    start_date, start_date_time,
    priority, status, tags,
    time_estimate, points,
    parent, links_to,
    custom_fields,
    mirror_context  // { product, campaign, action }
  } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, message: 'name é obrigatório.' });

  try {
    const prepared = await prepareTaskBody({
      db: req.tenantDb,
      userId,
      input: { name, list_id, mirror_context, status, tags }
    });

    if (!prepared.ok) {
      if (prepared.code === 'clickup_read_only') {
        return res.status(403).json({
          ok: false, code: 'clickup_read_only',
          message: 'Modo somente-leitura ativado pra ClickUp. Tasks NÃO serão criadas. Pra reativar, vá em Configurações → Integrações → ClickUp → Modo de escrita.'
        });
      }
      if (prepared.code === 'no_default_list') return res.status(400).json(prepared);
      if (prepared.step === 'mirror_resolve') return res.status(500).json(prepared);
      return res.status(500).json(prepared);
    }

    const { targetListId, parentTaskId, finalName, finalTags, initialStatus, mirrorInfo, cred } = prepared;

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
      // parent: prioriza o que veio do mirror (action parent task), fallback pro que veio no body
      parent: parentTaskId ? String(parentTaskId) : (parent ? String(parent) : undefined),
      links_to: links_to ? String(links_to) : undefined,
      custom_fields: Array.isArray(custom_fields) && custom_fields.length ? custom_fields : undefined
    };
    Object.keys(taskBody).forEach(k => taskBody[k] === undefined && delete taskBody[k]);

    const createRes = await clickupFetch(req.tenantDb, userId, 'POST', `/list/${targetListId}/task`, taskBody);
    if (!createRes.ok) {
      let actionableMsg = `ClickUp recusou (${createRes.status}).`;
      const errStr = String(createRes.data?.err || createRes.data?.ECODE || JSON.stringify(createRes.data || {})).slice(0, 300);
      if (createRes.status === 422 || /required|CUFC/i.test(errStr)) {
        actionableMsg = `ClickUp recusou: a list "${cred.default_list_name || targetListId}" tem custom field obrigatório que não foi preenchido. Resposta: ${errStr}`;
      } else if (createRes.status === 401 || createRes.status === 403) {
        actionableMsg = `ClickUp recusou: PAT sem permissão pra criar task nessa list (${errStr}).`;
      }
      return res.status(502).json({ ok: false, message: actionableMsg, details: createRes.data, listId: targetListId });
    }
    return res.status(200).json({
      ok: true,
      providerTaskId: createRes.data?.id || null,
      externalUrl: createRes.data?.url || null,
      listId: targetListId,
      mirror: mirrorInfo
    });
  } catch (err) {
    if (err.message?.includes('ENCRYPTION_KEY')) {
      return res.status(503).json({ ok: false, message: 'ENCRYPTION_KEY ausente ou inválida no servidor.' });
    }
    if (err.message?.includes('ClickUp não conectado')) {
      return res.status(404).json({ ok: false, message: 'ClickUp não conectado. Reconecte em Configurações → Integrações.' });
    }
    return res.status(500).json({ ok: false, message: err.message });
  }
};
