// V32.6.0 — GET /api/clickup-test-space
// Verifica se a raiz LJ (Space/Folder/List configurado) ainda está acessível
// com o token atual. Útil pra detectar token revogado, permissions removidas
// ou nó deletado pelo cliente — ANTES da primeira task falhar.
//
// Retorna { ok: true, accessible: bool, rootId, rootKind, rootName?, message }.
const { clickupFetch } = require('../lib/clickup-client');
const { resolveCredentialOwnerId } = require('../lib/credentials-owner');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const userId = await resolveCredentialOwnerId(req);

  try {
    const credRow = await req.tenantDb.query(
      'SELECT lj_root_id, lj_root_kind, lj_space_id FROM clickup_credentials WHERE user_id = $1',
      [userId]
    );
    if (!credRow.rows.length) {
      return res.status(404).json({ ok: false, message: 'ClickUp não conectado.' });
    }
    const row = credRow.rows[0];
    // Back-compat: clientes pré-V32.6.0 só têm lj_space_id (sem root_kind).
    const rootId = row.lj_root_id || row.lj_space_id || null;
    const rootKind = row.lj_root_kind || (row.lj_space_id ? 'space' : null);

    if (!rootId || !rootKind) {
      return res.status(200).json({
        ok: true,
        accessible: false,
        message: 'Raiz LJ não inicializada. Clique em "Configurar Space" no card de Hierarquia.'
      });
    }

    const path = rootKind === 'space'  ? `/space/${rootId}`
               : rootKind === 'folder' ? `/folder/${rootId}`
               :                         `/list/${rootId}`;
    const r = await clickupFetch(req.tenantDb, userId, 'GET', path);
    if (!r.ok) {
      return res.status(200).json({
        ok: true,
        accessible: false,
        rootId, rootKind,
        statusCode: r.status,
        message: r.status === 404
          ? `${labelFor(rootKind)} raiz LJ não existe mais no ClickUp (deletado ou inacessível). Re-configure em "Trocar Space".`
          : r.status === 401 || r.status === 403
          ? 'Token sem permissão pra ler a raiz LJ. Token pode ter sido revogado/rotacionado no ClickUp.'
          : `ClickUp respondeu ${r.status}.`
      });
    }
    return res.status(200).json({
      ok: true,
      accessible: true,
      rootId, rootKind,
      rootName: r.data?.name || null,
      message: `✓ ${labelFor(rootKind)} "${r.data?.name || rootId}" acessível.`
    });
  } catch (err) {
    console.error('[clickup-test-space]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};

function labelFor(kind) {
  return kind === 'space' ? 'Space' : kind === 'folder' ? 'Folder' : kind === 'list' ? 'List' : 'Nó';
}
