// V32.5.9 — GET /api/clickup-spaces-list
// Lista todos os Spaces do workspace ClickUp do user.
//
// Usado pelo Setup Wizard (cliente escolhe Space existente OU cria novo,
// ao invés do LJ criar autonomamente um Space "LeadJourney" — princípio
// de soberania do workspace do cliente, V32.5.9).
//
// Retorna { ok: true, spaces: [{ id, name, private, archived, statuses, ... }],
//           workspaceId, workspaceName, currentLjSpaceId }.
const { clickupFetch } = require('../lib/clickup-client');
const { resolveCredentialOwnerId } = require('../lib/credentials-owner');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const userId = await resolveCredentialOwnerId(req);

  try {
    const credRow = await req.tenantDb.query(
      'SELECT workspace_id, workspace_name, lj_space_id FROM clickup_credentials WHERE user_id = $1',
      [userId]
    );
    if (!credRow.rows.length) {
      return res.status(404).json({ ok: false, message: 'ClickUp não conectado. Conecte primeiro.' });
    }
    const cred = credRow.rows[0];
    if (!cred.workspace_id) {
      return res.status(400).json({ ok: false, message: 'workspace_id não definido — reconecte ClickUp.' });
    }

    // GET /team/{workspace_id}/space?archived=false
    const r = await clickupFetch(req.tenantDb, userId, 'GET', `/team/${cred.workspace_id}/space?archived=false`);
    if (!r.ok) {
      return res.status(502).json({
        ok: false,
        step: 'list_spaces',
        message: `ClickUp recusou listar spaces (${r.status}). Token pode não ter permissão.`,
        details: r.data
      });
    }

    const rawSpaces = Array.isArray(r.data?.spaces) ? r.data.spaces : [];
    const spaces = rawSpaces.map(s => ({
      id: String(s.id),
      name: String(s.name || ''),
      private: !!s.private,
      archived: !!s.archived,
      color: s.color || null
    }));

    return res.status(200).json({
      ok: true,
      workspaceId: cred.workspace_id,
      workspaceName: cred.workspace_name || null,
      currentLjSpaceId: cred.lj_space_id || null,
      spaces
    });
  } catch (err) {
    console.error('[clickup-spaces-list]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
