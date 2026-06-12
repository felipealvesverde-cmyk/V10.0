// V37.5.0 — GET /api/pins-list?targetUrl=...
// Lista pins ativos pro user logado em uma URL específica.
// User vê pins onde é creator OU audience.

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não plugado.' });

  const tenantId = req.user.tenantId;
  const userId = req.user.sub;
  const targetUrl = String(req.query?.targetUrl || '').trim();

  if (!tenantId) return res.status(400).json({ ok: false, message: 'Sem tenant ativo.' });
  if (!targetUrl) return res.status(400).json({ ok: false, message: 'targetUrl obrigatório.' });

  try {
    const r = await req.tenantDb.query(`
      SELECT
        p.id, p.creator_user_id, p.target_url, p.anchor_x_pct, p.anchor_y_pct, p.text,
        p.audience_user_ids, p.seen_by_user_ids, p.created_at, p.expires_at,
        u.display_name AS creator_name, u.username AS creator_username, u.email AS creator_email
      FROM pins p
      LEFT JOIN users u ON u.id = p.creator_user_id
      WHERE p.tenant_id = $1
        AND p.target_url = $2
        AND p.archived_at IS NULL
        AND (p.expires_at IS NULL OR p.expires_at > NOW())
        AND (p.creator_user_id = $3 OR $3 = ANY(p.audience_user_ids))
      ORDER BY p.created_at DESC
    `, [tenantId, targetUrl, userId]);

    return res.status(200).json({
      ok: true,
      pins: r.rows.map(row => ({
        id: row.id,
        creatorUserId: row.creator_user_id,
        creatorName: row.creator_name || row.creator_username || row.creator_email,
        targetUrl: row.target_url,
        anchorXPct: Number(row.anchor_x_pct),
        anchorYPct: Number(row.anchor_y_pct),
        text: row.text,
        audienceUserIds: row.audience_user_ids || [],
        seenByUserIds: row.seen_by_user_ids || [],
        seenByMe: (row.seen_by_user_ids || []).includes(userId),
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        amICreator: row.creator_user_id === userId
      }))
    });
  } catch (err) {
    console.error('[pins-list]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
