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
    const credRow = await req.tenantDb.query(
      'SELECT lj_space_id, mirror_enabled FROM clickup_credentials WHERE user_id = $1',
      [userId]
    );
    const cred = credRow.rows[0] || {};

    const rows = await listMappings(req.tenantDb, userId);
    const grouped = {
      products: rows.filter(r => r.lj_kind === 'product'),
      campaigns: rows.filter(r => r.lj_kind === 'campaign'),
      actions: rows.filter(r => r.lj_kind === 'action')
    };

    // Tenta buscar nome do Space pra exibir (opcional, falha silenciosa)
    let ljSpaceName = null;
    if (cred.lj_space_id) {
      try {
        const r = await clickupFetch(req.tenantDb, userId, 'GET', `/space/${cred.lj_space_id}`);
        if (r.ok) ljSpaceName = r.data?.name || null;
      } catch (_) { /* silent */ }
    }

    return res.status(200).json({
      ok: true,
      ljSpaceId: cred.lj_space_id || null,
      ljSpaceName,
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
