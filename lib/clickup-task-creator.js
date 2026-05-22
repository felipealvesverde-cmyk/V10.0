// V32.2.5 (Geraldo A7) — Helper compartilhado entre /api/clickup-create-task
// (endpoint REST com req.tenantDb + body padrão) e api/djow-chat.js case
// 'create_clickup_task' (tool com ctx.db + ctx.userId).
//
// Antes: ~80 linhas duplicadas entre os 2 callers (read cred + write_enabled
// guard + mirror resolve + tag ensure + status normalize + prefix + body build).
// Refator extrai pra função única.
//
// Não substitui o endpoint inteiro — apenas a parte de BUILD do task body
// + lookup de credenciais + resolve mirror. O caller cuida do auth/method/
// response shaping.
const { clickupFetch } = require('./clickup-client');
const mirror = require('./clickup-mirror');
const cache = require('./redis-cache');

// V32.3.4 — Helper interno: garante tag `lj-auto` existe no space (idempotente).
// Cacheia GET /space/{id}/tag por 5min (statuses de tags raramente mudam).
// Após criar tag nova, invalida o cache pra próxima call ver a tag recém-criada.
async function ensureLjTag(db, userId, spaceId, tagName) {
  if (!spaceId || !tagName) return false;
  try {
    const cacheKey = `clickup:space-tags:${userId}:${spaceId}`;
    const list = await cache.getOrFetch(
      cacheKey,
      300,
      () => clickupFetch(db, userId, 'GET', `/space/${spaceId}/tag`)
    );
    if (!list.ok) return false;
    const existing = Array.isArray(list.data?.tags) ? list.data.tags : [];
    const has = existing.some(t => String(t.name || '').toLowerCase() === String(tagName).toLowerCase());
    if (has) return true;
    const create = await clickupFetch(db, userId, 'POST', `/space/${spaceId}/tag`, {
      tag: { name: tagName, tag_fg: '#FFFFFF', tag_bg: '#7C3AED' }
    });
    if (create.ok) {
      // Tag nova criada — cache fica obsoleto. Invalida.
      await cache.invalidate(cacheKey);
    }
    return create.ok;
  } catch (_) {
    return false;
  }
}

/**
 * Resolve a list de destino + parent task + aplica regras safe-integration
 * (tag, prefix, status_map). Não chama POST de task — só retorna o que precisa.
 *
 * @param {Object} args
 * @param {Object} args.db                   Pool postgres (req.tenantDb ou ctx.db)
 * @param {number} args.userId               User do JWT
 * @param {Object} args.input                { name, description, list_id?, mirror_context?,
 *                                              priority?, status?, tags?, assignees?, due_date?,
 *                                              custom_fields?, ... } — payload do user
 * @param {Object} args.state                state JSON do user (necessário se mirror_context
 *                                              vier inteiro vs apenas action_id no Djow tool)
 *
 * @returns {Promise<{
 *   ok: true,
 *   targetListId, parentTaskId, finalName, finalTags, initialStatus, mirrorInfo
 * } | { ok: false, code?, step?, message }>}
 */
async function prepareTaskBody({ db, userId, input, state }) {
  // 1. Carrega credenciais
  // V32.6.0 — agora lê lj_root_id/lj_root_kind. lj_space_id mantido por compat
  // (apenas pra GET /space/{id}/tag em ensureLjTag quando root_kind='space').
  const credRow = await db.query(
    `SELECT default_list_id, default_space_id, default_list_name, lj_tag_name,
            task_prefix, status_map_json, write_enabled, lj_space_id, mirror_enabled,
            lj_root_id, lj_root_kind, lj_root_name
     FROM clickup_credentials WHERE user_id = $1`,
    [userId]
  );
  const cred = credRow.rows[0] || {};

  // 2. Read-only guard
  if (cred.write_enabled === false) {
    return { ok: false, code: 'clickup_read_only', message: 'ClickUp em modo somente-leitura.' };
  }

  // V32.6.0 — resolve raiz LJ. Back-compat: clientes V32.2-V32.5 ainda usam
  // lj_space_id (preenchido por backfill SQL como root_kind='space').
  const rootId = cred.lj_root_id || cred.lj_space_id || null;
  const rootKind = cred.lj_root_kind || (cred.lj_space_id ? 'space' : null);
  const root = rootId ? { id: rootId, kind: rootKind } : null;

  // 3. Resolve target list (mirror cascada OR explicit OR default)
  let targetListId = null;
  let parentTaskId = null;
  let mirrorInfo = null;

  // Mirror context pode vir já resolvido (do endpoint REST) OU só action_id (do Djow tool)
  let mirror_context = input.mirror_context;
  if (!mirror_context && input.action_id && state) {
    const actionId = Number(input.action_id);
    const action = (state.actions || []).find(a => Number(a.id) === actionId);
    if (action) {
      const campaign = (state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId));
      const product = campaign ? (state.products || []).find(p => Number(p.id) === Number(campaign.productId)) : null;
      if (campaign && product) {
        mirror_context = {
          product: { id: product.id, name: product.name },
          campaign: { id: campaign.id, name: campaign.name },
          action: { id: action.id, name: action.name }
        };
      }
    }
  }

  // V32.6.0 — Em modo 'list' (flat) basta ter action no contexto; product/campaign
  // são metadados LJ não espelhados. Modos 'space'/'folder' continuam exigindo
  // o contexto completo (folder precisa de campaign+action, space precisa de tudo).
  const useMirror = cred.mirror_enabled !== false && root && mirror_context && mirror_context.action?.id
    && (rootKind === 'list'
        || (rootKind === 'folder' && mirror_context.campaign?.id)
        || (rootKind === 'space' && mirror_context.product?.id && mirror_context.campaign?.id));

  if (useMirror) {
    try {
      const chain = await mirror.resolveActionChain(
        db, userId, root,
        mirror_context.product, mirror_context.campaign, mirror_context.action
      );
      targetListId = chain.listId;
      parentTaskId = chain.actionParentTaskId;
      mirrorInfo = {
        rootKind: chain.mode,
        productFolderId: chain.folderId,
        campaignListId: chain.listId,
        actionParentTaskId: chain.actionParentTaskId,
        createdAny: chain.createdAny
      };
    } catch (err) {
      return { ok: false, step: 'mirror_resolve', message: `Falha ao resolver hierarquia: ${err.message}` };
    }
  }

  if (!targetListId) targetListId = input.list_id || cred.default_list_id;
  if (!targetListId) {
    return {
      ok: false,
      code: 'no_default_list',
      message: root
        ? 'Modo espelhado ativo — passe action_id (ou mirror_context completo).'
        : 'List de destino não configurada (Configurações → ClickUp).'
    };
  }

  // 4. Aplica prefix
  const finalName = cred.task_prefix
    ? `${cred.task_prefix}${input.name}`.slice(0, 255)
    : String(input.name).slice(0, 255);

  // 5. Status inicial via map (com case-insensitive normalize — V32.2.4 A10)
  // V32.3.4 — GET /list/{id} cacheado por 5min (statuses raramente mudam).
  // Cliente que cria 10 tasks seguidas economiza ~9 round-trips a ClickUp.
  let initialStatus = input.status ? String(input.status) : undefined;
  if (!initialStatus && cred.status_map_json) {
    try {
      const map = JSON.parse(cred.status_map_json);
      if (map?.pending) {
        initialStatus = String(map.pending);
        try {
          const listMeta = await cache.getOrFetch(
            `clickup:list-meta:${userId}:${targetListId}`,
            300,
            () => clickupFetch(db, userId, 'GET', `/list/${targetListId}`)
          );
          const real = Array.isArray(listMeta.data?.statuses) ? listMeta.data.statuses : [];
          const match = real.find(s => String(s.status || '').toLowerCase() === initialStatus.toLowerCase());
          if (match) initialStatus = match.status;
        } catch (_) { /* mantém valor original */ }
      }
    } catch (_) { /* mapping inválido — silent */ }
  }

  // 6. Tag automática (com fallback inteligente — V32.6.0)
  // Tags ClickUp pertencem a um Space. Quando root_kind='space' usa o próprio
  // root.id. Em modos folder/list precisa descobrir o Space pai — usa
  // default_space_id (já salvo pelo /api/clickup-set-list) como fallback.
  // Se nem isso existir, pula tagging silenciosamente (não bloqueia criação).
  let finalTags = Array.isArray(input.tags) ? input.tags.map(String) : [];
  const tagSpaceId = (rootKind === 'space' ? rootId : null) || cred.default_space_id || cred.lj_space_id;
  if (cred.lj_tag_name && tagSpaceId) {
    const tagReady = await ensureLjTag(db, userId, tagSpaceId, cred.lj_tag_name);
    if (tagReady && !finalTags.includes(cred.lj_tag_name)) {
      finalTags.push(cred.lj_tag_name);
    }
  }

  return {
    ok: true,
    targetListId,
    parentTaskId,
    finalName,
    finalTags,
    initialStatus,
    mirrorInfo,
    cred  // caller pode usar pra mensagens (ex: default_list_name)
  };
}

module.exports = { prepareTaskBody, ensureLjTag };
