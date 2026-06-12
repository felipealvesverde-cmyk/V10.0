// V31.2.33 — Consolida 4 fetches do ClickUp em 1 endpoint pra alimentar
// o modal de criação de task (assignees, statuses, tags, custom_fields).
//
// GET → { ok, workspaceId, listId, members, statuses, tags, customFields }
//
// Não-fatal: cada fetch tem try-catch isolado, se um falhar os outros vêm.
// Se default_list_id ainda não foi descoberto, tenta descobrir (lazy bootstrap).
const { clickupFetch } = require('../lib/clickup-client');
const { resolveCredentialOwnerId } = require('../lib/credentials-owner');

// V32.0.9 — clickup_credentials vivem no tenant plane. clickupFetch usa o Pool
// que o caller passa, então passamos req.tenantDb pra todos os fetches.
async function discoverFirstList(req, userId, workspaceId) {
  const spacesRes = await clickupFetch(req.tenantDb, userId, 'GET', `/team/${workspaceId}/space`);
  if (!spacesRes.ok) return null;
  const spaces = Array.isArray(spacesRes.data?.spaces) ? spacesRes.data.spaces : [];
  if (!spaces.length) return null;
  const space = spaces[0];
  const folderlessRes = await clickupFetch(req.tenantDb, userId, 'GET', `/space/${space.id}/list`);
  if (folderlessRes.ok && (folderlessRes.data?.lists || []).length) return { listId: folderlessRes.data.lists[0].id, spaceId: space.id };
  const foldersRes = await clickupFetch(req.tenantDb, userId, 'GET', `/space/${space.id}/folder`);
  const folders = foldersRes.ok ? (foldersRes.data?.folders || []) : [];
  if (folders.length) {
    const listsRes = await clickupFetch(req.tenantDb, userId, 'GET', `/folder/${folders[0].id}/list`);
    if (listsRes.ok && (listsRes.data?.lists || []).length) return { listId: listsRes.data.lists[0].id, spaceId: space.id };
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });

  const userId = await resolveCredentialOwnerId(req);
  try {
    // V32.0.9 — clickup_credentials vivem no tenant plane.
    const cred = await req.tenantDb.query('SELECT workspace_id, default_list_id FROM clickup_credentials WHERE user_id = $1', [userId]);
    if (!cred.rows.length) return res.status(404).json({ ok: false, message: 'ClickUp não conectado.' });
    const workspaceId = cred.rows[0].workspace_id;
    let listId = cred.rows[0].default_list_id;
    let spaceId = null;

    if (!listId) {
      const discovered = await discoverFirstList(req, userId, workspaceId);
      if (discovered) {
        listId = discovered.listId;
        spaceId = discovered.spaceId;
        await req.tenantDb.query('UPDATE clickup_credentials SET default_list_id = $1 WHERE user_id = $2', [listId, userId]);
      }
    }

    const result = { ok: true, workspaceId, listId, spaceId, members: [], statuses: [], tags: [], customFields: [], debug: {} };

    // V31.2.34 — Members vêm de GET /team (workspace list inclui members no payload).
    // O endpoint /team/{id}/member existe mas tem permission quirks; /team funciona pra
    // qualquer user autorizado e já traz a array de members do workspace que importa.
    try {
      const r = await clickupFetch(req.tenantDb, userId, 'GET', '/team');
      if (r.ok && Array.isArray(r.data?.teams)) {
        const team = r.data.teams.find(t => String(t.id) === String(workspaceId)) || r.data.teams[0];
        const members = Array.isArray(team?.members) ? team.members : [];
        result.members = members
          .filter(m => m.user?.id)
          .map(m => ({
            id: m.user.id,
            username: m.user.username || m.user.email || 'sem nome',
            email: m.user.email || null,
            color: m.user.color || null,
            initials: m.user.initials || null,
            profilePicture: m.user.profilePicture || null
          }));
      } else {
        result.debug.members_error = `status ${r.status}`;
      }
    } catch (err) {
      result.debug.members_error = err.message;
    }

    // Detail da list (statuses + space_id pra puxar tags)
    if (listId) {
      try {
        const r = await clickupFetch(req.tenantDb, userId, 'GET', `/list/${listId}`);
        if (r.ok) {
          result.statuses = (r.data?.statuses || []).map(s => ({ status: s.status, color: s.color, type: s.type, orderindex: s.orderindex }));
          if (!spaceId) spaceId = r.data?.space?.id || null;
        }
      } catch (_) {}

      try {
        const r = await clickupFetch(req.tenantDb, userId, 'GET', `/list/${listId}/field`);
        if (r.ok) {
          result.customFields = (r.data?.fields || []).map(f => ({ id: f.id, name: f.name, type: f.type, type_config: f.type_config || null, required: f.required || false }));
        }
      } catch (_) {}
    }

    // Tags do space (se conseguimos descobrir o spaceId)
    if (spaceId) {
      try {
        const r = await clickupFetch(req.tenantDb, userId, 'GET', `/space/${spaceId}/tag`);
        if (r.ok) {
          result.tags = (r.data?.tags || []).map(t => ({ name: t.name, fg: t.tag_fg, bg: t.tag_bg }));
        }
      } catch (_) {}
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};
