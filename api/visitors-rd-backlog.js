// V34.0.0 — V34.6.z: Backlog de visitors imputados em campanha LJ mas que
// NÃO entraram no RD CRM. Cliente vê motivos agrupados + lista pra retry.
//
// GET /api/visitors-rd-backlog?campaign_id=X
//
// Resposta:
//   {
//     ok, total, byReason: { 'sem email/phone': N, 'criar deal HTTP 429': N, ... },
//     visitors: [{ lj_visitor_id, name, email, phone, sync_status, sync_error,
//                  last_attempt_at }]
//   }
//
// "Falhou" = visitor está em lj_visitor_campaign_state pra essa campanha
// MAS sem external_rd_deal_id. Pode ter:
//   - external_rd_sync_status = 'failed' (V34.6.z grava + sync_error)
//   - external_rd_sync_status = null (push nunca foi tentado)

module.exports = async function handler(req, res) {
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });

  const userId = req.user.sub;
  const campaignId = Number(req.query?.campaign_id || 0);
  if (!campaignId) return res.status(400).json({ ok: false, message: 'campaign_id obrigatório.' });

  try {
    // Visitors NA campanha mas sem deal_id no RD
    const r = await req.tenantDb.query(
      `SELECT
         v.lj_visitor_id, v.name, v.email, v.phone, v.bank_id,
         v.external_rd_sync_status,
         v.external_rd_sync_error,
         v.external_rd_synced_at AS last_attempt_at,
         b.name AS bank_name
       FROM lj_visitor_campaign_state vcs
       INNER JOIN lj_visitors v
         ON v.user_id = vcs.user_id AND v.lj_visitor_id = vcs.lj_visitor_id
       LEFT JOIN lj_lead_banks b ON b.id = v.bank_id AND b.user_id = v.user_id
       WHERE vcs.user_id = $1
         AND vcs.campaign_id = $2
         AND (v.external_rd_deal_id IS NULL OR v.external_rd_deal_id = '')
       ORDER BY v.external_rd_synced_at DESC NULLS LAST`,
      [userId, campaignId]
    );

    // Agrupa por razão. Normaliza "criar deal HTTP 429 ..." → "rate limit (429)"
    const byReason = {};
    for (const row of r.rows) {
      let key;
      if (!row.external_rd_sync_status) {
        key = 'nunca tentado';
      } else if (!row.external_rd_sync_error) {
        key = 'falhou sem erro registrado';
      } else {
        const err = String(row.external_rd_sync_error);
        if (/429/.test(err)) key = 'rate limit (429)';
        else if (/401|403/.test(err)) key = 'auth (401/403)';
        else if (/sem email|sem phone/i.test(err)) key = 'sem email/phone';
        else if (/HTTP 5\d\d/.test(err)) key = 'erro servidor RD (5xx)';
        else if (/HTTP 4\d\d/.test(err)) key = `erro cliente RD (${err.match(/HTTP \d+/)?.[0] || '4xx'})`;
        else if (/timeout/i.test(err)) key = 'timeout';
        else if (/sem id/.test(err)) key = 'RD retornou sem id';
        else key = err.slice(0, 80);
      }
      byReason[key] = (byReason[key] || 0) + 1;
    }

    return res.status(200).json({
      ok: true,
      total: r.rows.length,
      byReason,
      visitors: r.rows.map(row => ({
        lj_visitor_id: row.lj_visitor_id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        bank_name: row.bank_name,
        sync_status: row.external_rd_sync_status,
        sync_error: row.external_rd_sync_error,
        last_attempt_at: row.last_attempt_at
      }))
    });
  } catch (err) {
    console.error('[visitors-rd-backlog]', err);
    return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
  }
};
