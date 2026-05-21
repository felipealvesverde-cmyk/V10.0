// V32.0.12 — GET /api/tenants-list (master only)
// Lista todos os tenants do control plane com members count e flag db_plugged.
// Retorno NUNCA inclui db_connection_string_enc (segurança).
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas master pode listar tenants.' });

  try {
    const result = await req.db.query(`
      SELECT
        t.id, t.slug, t.name, t.status, t.plan,
        t.db_connection_string_enc IS NOT NULL AS db_plugged,
        t.migrated_at, t.created_at, t.updated_at,
        ou.username AS owner_username,
        (SELECT COUNT(*)::int FROM tenant_members tm WHERE tm.tenant_id = t.id) AS members_count
      FROM tenants t
      LEFT JOIN users ou ON ou.id = t.owner_user_id
      ORDER BY t.id ASC
    `);
    return res.status(200).json({ ok: true, tenants: result.rows });
  } catch (err) {
    console.error('[tenants-list]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
