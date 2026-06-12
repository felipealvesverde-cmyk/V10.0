// V34.7.h.10 — GET /api/visitors-rd-debug
// Diagnóstico do estado do RD sync por user. Mostra quantos visitors têm
// external_rd_contact_id, distribuição por status, e exemplos recentes.

const { resolveCredentialOwnerId } = require('../lib/credentials-owner');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  // V37.4.34 — Visitors vivem na linha do OWNER do tenant.
  const userId = Number(await resolveCredentialOwnerId(req));

  try {
    const totals = await req.tenantDb.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE external_rd_contact_id IS NOT NULL)::int AS com_contact_id,
         COUNT(*) FILTER (WHERE external_rd_contact_id IS NULL)::int AS sem_contact_id
       FROM lj_visitors WHERE user_id = $1`,
      [userId]
    );

    const byStatus = await req.tenantDb.query(
      `SELECT COALESCE(external_rd_sync_status, '(null)') AS status, COUNT(*)::int AS c
         FROM lj_visitors WHERE user_id = $1
         GROUP BY 1 ORDER BY 2 DESC`,
      [userId]
    );

    const recentEnriched = await req.tenantDb.query(
      `SELECT lj_visitor_id, name, email, external_rd_contact_id,
              external_rd_sync_status, external_rd_sync_error, external_rd_synced_at
         FROM lj_visitors
        WHERE user_id = $1
          AND lj_visitor_id IN (
            SELECT lj_visitor_id FROM lj_visitor_tags
             WHERE user_id = $1 AND tag LIKE 'lj-enriched-%'
          )
        ORDER BY updated_at DESC LIMIT 10`,
      [userId]
    );

    const pendingSample = await req.tenantDb.query(
      `SELECT lj_visitor_id, name, email, external_rd_contact_id, external_rd_sync_status
         FROM lj_visitors
        WHERE user_id = $1
          AND external_rd_sync_status = 'pending-contact-update'
        ORDER BY updated_at DESC LIMIT 10`,
      [userId]
    );

    return res.status(200).json({
      ok: true,
      userId,
      totals: totals.rows[0],
      byStatus: byStatus.rows,
      recentEnriched: recentEnriched.rows,
      pendingSample: pendingSample.rows
    });
  } catch (err) {
    console.error('[visitors-rd-debug]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
