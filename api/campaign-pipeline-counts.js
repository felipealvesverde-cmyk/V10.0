// V34.6.aa — Counts por stage de uma campanha LJ no tenant DB.
//
// Journey Pipeline mostrava 0 PESSOAS em todos estágios mesmo após Felipe
// imputar 500 leads em MVP. Causa: lia de App.state.actions (legado),
// não de lj_visitor_campaign_state. Este endpoint fecha esse gap.
//
// GET /api/campaign-pipeline-counts?campaign_id=X
// Resposta:
//   { ok, campaignId, total, counts: { 'marketing-tof': N, 'marketing-mof': N,
//     'marketing-bof': N, 'vendas-tof': N, ..., 'cs-bof': N } }

module.exports = async function handler(req, res) {
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });

  const userId = req.user.sub;
  const campaignId = Number(req.query?.campaign_id || 0);
  if (!campaignId) return res.status(400).json({ ok: false, message: 'campaign_id obrigatório.' });

  try {
    const r = await req.tenantDb.query(
      `SELECT current_stage, COUNT(*) AS c
         FROM lj_visitor_campaign_state
        WHERE user_id = $1 AND campaign_id = $2
        GROUP BY current_stage`,
      [userId, campaignId]
    );

    // Estágios canônicos do V33+ (9 estágios)
    const counts = {
      'marketing-tof': 0, 'marketing-mof': 0, 'marketing-bof': 0,
      'vendas-tof': 0, 'vendas-mof': 0, 'vendas-bof': 0,
      'cs-tof': 0, 'cs-mof': 0, 'cs-bof': 0
    };
    let total = 0;
    for (const row of r.rows) {
      const stage = String(row.current_stage || '').trim();
      const c = Number(row.c);
      counts[stage] = (counts[stage] || 0) + c;
      total += c;
    }

    return res.status(200).json({ ok: true, campaignId, total, counts });
  } catch (err) {
    console.error('[campaign-pipeline-counts]', err);
    return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
  }
};
