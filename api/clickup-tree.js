// V32.1.3 — GET /api/clickup-tree
// Retorna a hierarquia completa do ClickUp do user pra UI renderizar
// um list-picker (Geraldo decision: substitui auto-discovery que chutava
// a primeira list aleatória do cliente).
//
// Estrutura retornada:
//   {
//     ok: true,
//     workspaceId, workspaceName,
//     spaces: [
//       { id, name,
//         folderlessLists: [ { id, name } ],
//         folders: [
//           { id, name, lists: [ { id, name } ] }
//         ]
//       }
//     ],
//     defaultListId, defaultSpaceId  // o que tá salvo hoje, pra UI marcar
//   }
//
// Cada chamada faz N+M+P fetches contra a ClickUp API (1 /space, N /folder,
// N /folderless, M /folder/{id}/list). Resultado pode demorar 1-3s em
// workspaces grandes. Frontend deve mostrar loading state.
const { clickupFetch } = require('../lib/clickup-client');

module.exports = async function handler(req, res) {
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });

  const userId = req.user.sub;
  try {
    // Pega credenciais do tenant plane + workspace já salvo
    const cred = await req.tenantDb.query(
      'SELECT workspace_id, workspace_name, default_list_id, default_space_id FROM clickup_credentials WHERE user_id = $1',
      [userId]
    );
    if (!cred.rows.length) return res.status(404).json({ ok: false, message: 'ClickUp não conectado.' });
    const workspaceId = cred.rows[0].workspace_id;
    if (!workspaceId) return res.status(400).json({ ok: false, message: 'Workspace não definido nas credenciais.' });

    // 1. Lista spaces do workspace
    const spacesRes = await clickupFetch(req.tenantDb, userId, 'GET', `/team/${workspaceId}/space`);
    if (!spacesRes.ok) return res.status(502).json({ ok: false, message: `ClickUp /space recusou (${spacesRes.status}).` });
    const spaces = Array.isArray(spacesRes.data?.spaces) ? spacesRes.data.spaces : [];

    // 2. Pra cada space: folderless lists + folders (em paralelo)
    const spaceNodes = await Promise.all(spaces.map(async space => {
      const [folderlessRes, foldersRes] = await Promise.all([
        clickupFetch(req.tenantDb, userId, 'GET', `/space/${space.id}/list`).catch(() => ({ ok: false, data: {} })),
        clickupFetch(req.tenantDb, userId, 'GET', `/space/${space.id}/folder`).catch(() => ({ ok: false, data: {} }))
      ]);
      const folderlessLists = folderlessRes.ok && Array.isArray(folderlessRes.data?.lists)
        ? folderlessRes.data.lists.map(l => ({ id: String(l.id), name: l.name || '—' }))
        : [];
      const folders = foldersRes.ok && Array.isArray(foldersRes.data?.folders) ? foldersRes.data.folders : [];

      // 3. Pra cada folder: lists dentro (em paralelo)
      const folderNodes = await Promise.all(folders.map(async folder => {
        const listsRes = await clickupFetch(req.tenantDb, userId, 'GET', `/folder/${folder.id}/list`).catch(() => ({ ok: false, data: {} }));
        const lists = listsRes.ok && Array.isArray(listsRes.data?.lists)
          ? listsRes.data.lists.map(l => ({ id: String(l.id), name: l.name || '—' }))
          : [];
        return { id: String(folder.id), name: folder.name || '—', lists };
      }));

      return {
        id: String(space.id),
        name: space.name || '—',
        folderlessLists,
        folders: folderNodes
      };
    }));

    return res.status(200).json({
      ok: true,
      workspaceId,
      workspaceName: cred.rows[0].workspace_name || null,
      spaces: spaceNodes,
      defaultListId: cred.rows[0].default_list_id || null,
      defaultSpaceId: cred.rows[0].default_space_id || null
    });
  } catch (err) {
    console.error('[clickup-tree]', err);
    if (err.message?.includes('ENCRYPTION_KEY')) {
      return res.status(503).json({ ok: false, message: 'ENCRYPTION_KEY ausente no servidor.' });
    }
    return res.status(500).json({ ok: false, message: err.message });
  }
};
