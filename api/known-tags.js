// V35.0.0 — GET /api/known-tags
// Retorna lista de tags distintas já usadas pelos visitors do user.
// Alimenta datalist do seletor de tag no sub-funil.

const { resolveCredentialOwnerId } = require('../lib/credentials-owner');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  // V37.4.34 — Tags vivem na linha do OWNER do tenant.
  const userId = await resolveCredentialOwnerId(req);
  const limit = Math.min(Number(req.query?.limit || 500), 2000);

  try {
    const r = await req.tenantDb.query(
      `SELECT tag, COUNT(*) AS uses
         FROM lj_visitor_tags
        WHERE user_id = $1 AND tag IS NOT NULL AND tag <> ''
        GROUP BY tag
        ORDER BY COUNT(*) DESC
        LIMIT $2`,
      [userId, limit]
    );
    return res.status(200).json({
      ok: true,
      tags: r.rows.map(row => ({ tag: row.tag, uses: Number(row.uses) }))
    });
  } catch (err) {
    console.error('[known-tags]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
