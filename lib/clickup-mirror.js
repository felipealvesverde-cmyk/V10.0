// V32.2.0 — Hierarquia espelhada LJ → ClickUp.
//
// Mapeamento (decisão Geraldo/Felipe 2026-05-22):
//   LJ Tenant   → Space "LeadJourney"  (lj_space_id em clickup_credentials)
//   LJ Product  → Folder
//   LJ Campaign → List
//   LJ Action   → Task PAI
//   LJ Tarefa   → Subtask
//
// Cada nível tem 1 row em clickup_lj_mappings (user_id, lj_kind, lj_id) → clickup_id.
//
// Find-or-create cascado: ensureProductFolder → ensureCampaignList → ensureActionParentTask
// → createSubtaskUnderAction. Cada um verifica se a entity ainda existe no ClickUp
// (cliente pode ter deletado) e re-cria silenciosamente se órfã.
//
// Caller passa req.tenantDb (Pool) — multi-tenant ready.
const { clickupFetch } = require('./clickup-client');

// ─────────────────────────────────────────────────────────────
// MAPPINGS HELPERS — interagem com tabela clickup_lj_mappings
// ─────────────────────────────────────────────────────────────

async function getMapping(db, userId, ljKind, ljId) {
  const r = await db.query(
    'SELECT clickup_id, clickup_kind, clickup_name FROM clickup_lj_mappings WHERE user_id = $1 AND lj_kind = $2 AND lj_id = $3',
    [userId, ljKind, Number(ljId)]
  );
  return r.rows[0] || null;
}

async function setMapping(db, userId, ljKind, ljId, clickupId, clickupKind, clickupName) {
  await db.query(
    `INSERT INTO clickup_lj_mappings (user_id, lj_kind, lj_id, clickup_id, clickup_kind, clickup_name, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_id, lj_kind, lj_id) DO UPDATE SET
       clickup_id = EXCLUDED.clickup_id,
       clickup_kind = EXCLUDED.clickup_kind,
       clickup_name = EXCLUDED.clickup_name,
       updated_at = NOW()`,
    [userId, ljKind, Number(ljId), String(clickupId), clickupKind, String(clickupName || '').slice(0, 255)]
  );
}

async function deleteMapping(db, userId, ljKind, ljId) {
  await db.query(
    'DELETE FROM clickup_lj_mappings WHERE user_id = $1 AND lj_kind = $2 AND lj_id = $3',
    [userId, ljKind, Number(ljId)]
  );
}

async function listMappings(db, userId) {
  const r = await db.query(
    `SELECT lj_kind, lj_id, clickup_id, clickup_kind, clickup_name, created_at, updated_at
     FROM clickup_lj_mappings WHERE user_id = $1 ORDER BY lj_kind, lj_id`,
    [userId]
  );
  return r.rows;
}

// ─────────────────────────────────────────────────────────────
// VERIFY — checa se entity ClickUp ainda existe (cliente pode ter deletado)
// Retorna true se acessível (200), false se 404/qualquer outro erro.
// ─────────────────────────────────────────────────────────────
async function verifyClickupEntity(db, userId, clickupId, kind) {
  // kind: 'folder' | 'list' | 'task'
  const path = kind === 'folder' ? `/folder/${clickupId}`
             : kind === 'list'   ? `/list/${clickupId}`
             : kind === 'task'   ? `/task/${clickupId}`
             : null;
  if (!path) return false;
  try {
    const r = await clickupFetch(db, userId, 'GET', path);
    return r.ok && r.status < 400;
  } catch (_) {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// FIND-OR-CREATE CASCADO
// ─────────────────────────────────────────────────────────────

// Folder do Produto. Cria dentro do lj_space_id do user.
// Retorna { clickupId, created: bool }
async function ensureProductFolder(db, userId, ljSpaceId, productId, productName) {
  if (!ljSpaceId) throw new Error('lj_space_id não configurado — rode o setup wizard primeiro.');
  const existing = await getMapping(db, userId, 'product', productId);
  if (existing) {
    const stillExists = await verifyClickupEntity(db, userId, existing.clickup_id, 'folder');
    if (stillExists) return { clickupId: existing.clickup_id, created: false };
    // Folder foi deletada no ClickUp → re-cria (mapping atualizado abaixo)
  }
  const createRes = await clickupFetch(db, userId, 'POST', `/space/${ljSpaceId}/folder`, {
    name: String(productName || `Produto ${productId}`).slice(0, 255)
  });
  if (!createRes.ok || !createRes.data?.id) {
    throw new Error(`Falha ao criar folder do produto (${createRes.status}): ${JSON.stringify(createRes.data).slice(0, 200)}`);
  }
  const folderId = String(createRes.data.id);
  await setMapping(db, userId, 'product', productId, folderId, 'folder', productName);
  return { clickupId: folderId, created: true };
}

// List da Campanha. Cria dentro do folder do produto pai.
async function ensureCampaignList(db, userId, folderId, campaignId, campaignName) {
  const existing = await getMapping(db, userId, 'campaign', campaignId);
  if (existing) {
    const stillExists = await verifyClickupEntity(db, userId, existing.clickup_id, 'list');
    if (stillExists) return { clickupId: existing.clickup_id, created: false };
  }
  const createRes = await clickupFetch(db, userId, 'POST', `/folder/${folderId}/list`, {
    name: String(campaignName || `Campanha ${campaignId}`).slice(0, 255)
  });
  if (!createRes.ok || !createRes.data?.id) {
    throw new Error(`Falha ao criar list da campanha (${createRes.status}): ${JSON.stringify(createRes.data).slice(0, 200)}`);
  }
  const listId = String(createRes.data.id);
  await setMapping(db, userId, 'campaign', campaignId, listId, 'list', campaignName);
  return { clickupId: listId, created: true };
}

// Task PAI da Ação. Cria dentro da list da campanha pai.
async function ensureActionParentTask(db, userId, listId, actionId, actionName) {
  const existing = await getMapping(db, userId, 'action', actionId);
  if (existing) {
    const stillExists = await verifyClickupEntity(db, userId, existing.clickup_id, 'task');
    if (stillExists) return { clickupId: existing.clickup_id, created: false };
  }
  // Cria task pai (sem subtasks ainda — apenas o container)
  const createRes = await clickupFetch(db, userId, 'POST', `/list/${listId}/task`, {
    name: `Ação: ${String(actionName || `${actionId}`)}`.slice(0, 255),
    description: 'Container desta ação. Subtasks abaixo são as tarefas operacionais criadas pelo LeadJourney.'
  });
  if (!createRes.ok || !createRes.data?.id) {
    throw new Error(`Falha ao criar task pai da ação (${createRes.status}): ${JSON.stringify(createRes.data).slice(0, 200)}`);
  }
  const taskId = String(createRes.data.id);
  await setMapping(db, userId, 'action', actionId, taskId, 'task', actionName);
  return { clickupId: taskId, created: true };
}

// Resolve a cadeia inteira até a task pai da ação, criando o que faltar.
// Retorna { actionParentTaskId, listId, folderId, createdAny: bool }
async function resolveActionChain(db, userId, ljSpaceId, product, campaign, action) {
  if (!product?.id) throw new Error('product.id obrigatório');
  if (!campaign?.id) throw new Error('campaign.id obrigatório');
  if (!action?.id) throw new Error('action.id obrigatório');

  const productRes = await ensureProductFolder(db, userId, ljSpaceId, product.id, product.name);
  const campaignRes = await ensureCampaignList(db, userId, productRes.clickupId, campaign.id, campaign.name);
  const actionRes = await ensureActionParentTask(db, userId, campaignRes.clickupId, action.id, action.name);
  return {
    folderId: productRes.clickupId,
    listId: campaignRes.clickupId,
    actionParentTaskId: actionRes.clickupId,
    createdAny: productRes.created || campaignRes.created || actionRes.created
  };
}

// ─────────────────────────────────────────────────────────────
// RENAME SYNC — quando user renomeia entity no LJ, propaga pro ClickUp
// ─────────────────────────────────────────────────────────────
async function renameMirroredEntity(db, userId, ljKind, ljId, newName) {
  const mapping = await getMapping(db, userId, ljKind, ljId);
  if (!mapping) return { ok: true, skipped: 'no_mapping' };
  const path = mapping.clickup_kind === 'folder' ? `/folder/${mapping.clickup_id}`
             : mapping.clickup_kind === 'list'   ? `/list/${mapping.clickup_id}`
             : mapping.clickup_kind === 'task'   ? `/task/${mapping.clickup_id}`
             : null;
  if (!path) return { ok: false, message: `kind desconhecido: ${mapping.clickup_kind}` };
  // Pra task, prefixa "Ação: " (mesma convenção do create)
  const finalName = mapping.clickup_kind === 'task'
    ? `Ação: ${String(newName || '').slice(0, 240)}`
    : String(newName || '').slice(0, 255);
  const r = await clickupFetch(db, userId, 'PUT', path, { name: finalName });
  if (!r.ok) return { ok: false, message: `ClickUp rejeitou rename (${r.status})` };
  // Atualiza mapping
  await db.query(
    'UPDATE clickup_lj_mappings SET clickup_name = $1, updated_at = NOW() WHERE user_id = $2 AND lj_kind = $3 AND lj_id = $4',
    [finalName, userId, ljKind, Number(ljId)]
  );
  return { ok: true, clickupId: mapping.clickup_id, kind: mapping.clickup_kind, name: finalName };
}

module.exports = {
  getMapping,
  setMapping,
  deleteMapping,
  listMappings,
  verifyClickupEntity,
  ensureProductFolder,
  ensureCampaignList,
  ensureActionParentTask,
  resolveActionChain,
  renameMirroredEntity
};
