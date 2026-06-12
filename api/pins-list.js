// V37.5.0 — GET /api/pins-list?targetUrl=...
// Lista pins ativos pro user logado em uma URL específica.
// User vê pins onde é creator OU audience.
//
// V37.4.36 — Fix: pins moram no req.tenantDb (DB próprio do tenant) MAS
// users moram no req.db (control plane). LEFT JOIN entre eles explode com
// "relation users does not exist" quando o tenant tem DB próprio plugado
// (V36.8.0+). Refatorado pra 2 queries separadas (pins → tenantDb,
// users → controlPlane) e composição no JS.

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não plugado.' });
  if (!req.db) return res.status(503).json({ ok: false, message: 'Control plane DB indisponível.' });

  const tenantId = req.user.tenantId;
  const userId = req.user.sub;
  const targetUrl = String(req.query?.targetUrl || '').trim();

  if (!tenantId) return res.status(400).json({ ok: false, message: 'Sem tenant ativo.' });
  if (!targetUrl) return res.status(400).json({ ok: false, message: 'targetUrl obrigatório.' });

  try {
    // 1) Pins do tenantDb (sem JOIN).
    const pinsR = await req.tenantDb.query(`
      SELECT
        id, creator_user_id, target_url, anchor_x_pct, anchor_y_pct, text,
        audience_user_ids, seen_by_user_ids, created_at, expires_at
      FROM pins
      WHERE tenant_id = $1
        AND target_url = $2
        AND archived_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (creator_user_id = $3 OR $3 = ANY(audience_user_ids))
      ORDER BY created_at DESC
    `, [tenantId, targetUrl, userId]);

    const pins = pinsR.rows;

    // 2) Display names dos creators no control plane (1 query agregada).
    let creatorMap = new Map();
    if (pins.length) {
      const creatorIds = Array.from(new Set(pins.map(p => p.creator_user_id).filter(Boolean)));
      if (creatorIds.length) {
        const usersR = await req.db.query(
          'SELECT id, display_name, username, email FROM users WHERE id = ANY($1)',
          [creatorIds]
        );
        usersR.rows.forEach(u => creatorMap.set(u.id, u));
      }
    }

    return res.status(200).json({
      ok: true,
      pins: pins.map(row => {
        const u = creatorMap.get(row.creator_user_id) || {};
        return {
          id: row.id,
          creatorUserId: row.creator_user_id,
          creatorName: u.display_name || u.username || u.email || `User #${row.creator_user_id}`,
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
        };
      })
    });
  } catch (err) {
    console.error('[pins-list]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
