// V34.0.0 — V34.6.d: Counts agregados de pendências de identity resolution.
//
// Consumido pelo "sininho" no menu Leads (badge com count > 0 chama atenção).
// Lightweight: 2 queries agregadas sem retornar rows, só counts.
//
// GET /api/visitors-pending-counts
// Resposta:
//   {
//     ok,
//     duplicateGroupsEmail: N,    // grupos com mesmo email exato (>1 visitor)
//     duplicateGroupsPhone: N,    // grupos com mesmo phone digits-only
//     duplicateGroupsTotal: N,    // soma dos dois (UI mostra esse)
//     recentMerges24h: N,         // merges nas últimas 24h (atividade)
//     lastMergeAt: ISO | null     // último merge registrado
//   }

module.exports = async function handler(req, res) {
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });

  const userId = req.user.sub;

  try {
    const emailDupCount = await req.tenantDb.query(
      `SELECT COUNT(*) AS c FROM (
         SELECT LOWER(TRIM(email))
           FROM lj_visitors
          WHERE user_id = $1 AND email IS NOT NULL AND email <> ''
          GROUP BY LOWER(TRIM(email))
         HAVING COUNT(*) > 1
       ) sub`,
      [userId]
    );
    const phoneDupCount = await req.tenantDb.query(
      `SELECT COUNT(*) AS c FROM (
         SELECT REGEXP_REPLACE(phone, '\\D', '', 'g')
           FROM lj_visitors
          WHERE user_id = $1 AND phone IS NOT NULL AND phone <> ''
          GROUP BY REGEXP_REPLACE(phone, '\\D', '', 'g')
         HAVING COUNT(*) > 1 AND LENGTH(REGEXP_REPLACE(phone, '\\D', '', 'g')) >= 8
       ) sub`,
      [userId]
    );
    const recentMerges = await req.tenantDb.query(
      `SELECT COUNT(*) AS c, MAX(merged_at) AS last_at
         FROM lj_merges
        WHERE user_id = $1 AND merged_at > NOW() - INTERVAL '24 hours'`,
      [userId]
    );

    // V34.7.a.2 — counts de enriquecimento + sync RD pra sininho expandido
    const enrichablePending = await req.tenantDb.query(
      `SELECT COUNT(*) AS c FROM lj_visitors
        WHERE user_id = $1
          AND email IS NOT NULL AND email <> ''
          AND (name IS NULL OR name = '' OR LOWER(name) = LOWER(email))`,
      [userId]
    );
    const rdSyncPending = await req.tenantDb.query(
      `SELECT COUNT(*) AS c FROM lj_visitors
        WHERE user_id = $1
          AND external_rd_sync_status = 'pending-contact-update'`,
      [userId]
    );
    const enrichedToday = await req.tenantDb.query(
      `SELECT COUNT(DISTINCT lj_visitor_id) AS c FROM lj_tag_audit_log
        WHERE user_id = $1
          AND tag LIKE 'lj-enriched-%'
          AND action = 'added'
          AND occurred_at > NOW() - INTERVAL '24 hours'`,
      [userId]
    );

    const emailGroups = Number(emailDupCount.rows[0]?.c || 0);
    const phoneGroups = Number(phoneDupCount.rows[0]?.c || 0);
    const recent = Number(recentMerges.rows[0]?.c || 0);
    const lastAt = recentMerges.rows[0]?.last_at || null;
    const enrichable = Number(enrichablePending.rows[0]?.c || 0);
    const rdSync = Number(rdSyncPending.rows[0]?.c || 0);
    const enriched24h = Number(enrichedToday.rows[0]?.c || 0);

    return res.status(200).json({
      ok: true,
      duplicateGroupsEmail: emailGroups,
      duplicateGroupsPhone: phoneGroups,
      duplicateGroupsTotal: emailGroups + phoneGroups,
      recentMerges24h: recent,
      lastMergeAt: lastAt ? new Date(lastAt).toISOString() : null,
      // V34.7.a.2 novos
      enrichablePending: enrichable,
      rdContactSyncPending: rdSync,
      enrichedLast24h: enriched24h,
      // Total agregado pra badge único
      totalPending: emailGroups + phoneGroups + enrichable + rdSync
    });
  } catch (err) {
    console.error('[visitors-pending-counts]', err);
    return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
  }
};
