// V32.2.0 — GET /api/clickup-mappings-list
// Lista todos os mapeamentos LJ ↔ ClickUp do user pra UI mostrar o que
// já foi criado no ClickUp do cliente (links pros artifacts).
//
// Retorna agrupado por tipo:
//   { ok, products: [], campaigns: [], actions: [], lj_space_id, lj_space_name? }
const { listMappings } = require('../lib/clickup-mirror');
const { clickupFetch } = require('../lib/clickup-client');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const userId = req.user.sub;

  try {
    // V32.6.0 — lê lj_root_id/kind/name (com fallback lj_space_id pra cliente pré-V32.6.0).
    const credRow = await req.tenantDb.query(
      'SELECT lj_space_id, lj_root_id, lj_root_kind, lj_root_name, mirror_enabled FROM clickup_credentials WHERE user_id = $1',
      [userId]
    );
    const cred = credRow.rows[0] || {};
    const rootId = cred.lj_root_id || cred.lj_space_id || null;
    const rootKind = cred.lj_root_kind || (cred.lj_space_id ? 'space' : null);

    const rows = await listMappings(req.tenantDb, userId);
    const grouped = {
      products: rows.filter(r => r.lj_kind === 'product'),
      campaigns: rows.filter(r => r.lj_kind === 'campaign'),
      actions: rows.filter(r => r.lj_kind === 'action')
    };

    // Tenta buscar nome da raiz pra exibir (opcional, falha silenciosa)
    let rootName = cred.lj_root_name || null;
    if (!rootName && rootId && rootKind) {
      try {
        const path = rootKind === 'space'  ? `/space/${rootId}`
                   : rootKind === 'folder' ? `/folder/${rootId}`
                   :                         `/list/${rootId}`;
        const r = await clickupFetch(req.tenantDb, userId, 'GET', path);
        if (r.ok) rootName = r.data?.name || null;
      } catch (_) { /* silent */ }
    }

    return res.status(200).json({
      ok: true,
      // V32.6.0 — campos novos
      rootId, rootKind, rootName,
      // Back-compat: ljSpace* aparecem só quando kind='space'
      ljSpaceId: rootKind === 'space' ? rootId : null,
      ljSpaceName: rootKind === 'space' ? rootName : null,
      mirrorEnabled: cred.mirror_enabled !== false,
      counts: {
        products: grouped.products.length,
        campaigns: grouped.campaigns.length,
        actions: grouped.actions.length
      },
      mappings: grouped
    });
  } catch (err) {
    console.error('[clickup-mappings-list]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
