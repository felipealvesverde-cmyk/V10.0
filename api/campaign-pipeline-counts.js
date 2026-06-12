// V34.6.aa — Counts por stage de uma campanha LJ no tenant DB.
// V34.7.g — Opcionalmente filtra por bank_id (cross-filter banco × campanha).
//
// GET /api/campaign-pipeline-counts?campaign_id=X&bank_id=Y
// Resposta:
//   { ok, campaignId, bankId, total, counts: { 'marketing-tof': N, ... } }

const { resolveCredentialOwnerId } = require('../lib/credentials-owner');

module.exports = async function handler(req, res) {
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });

  // V37.4.34 — Counts vivem na linha do OWNER do tenant.
  const userId = await resolveCredentialOwnerId(req);
  const campaignId = Number(req.query?.campaign_id || 0);
  const bankId = req.query?.bank_id ? Number(req.query.bank_id) : null;
  if (!campaignId) return res.status(400).json({ ok: false, message: 'campaign_id obrigatório.' });

  try {
    // V34.7.g — INNER JOIN com lj_visitors quando bankId presente (filtra cross)
    const params = [userId, campaignId];
    let sql;
    if (bankId) {
      sql = `SELECT vcs.current_stage, COUNT(*) AS c
               FROM lj_visitor_campaign_state vcs
              INNER JOIN lj_visitors v
                ON v.user_id = vcs.user_id AND v.lj_visitor_id = vcs.lj_visitor_id
              WHERE vcs.user_id = $1 AND vcs.campaign_id = $2 AND v.bank_id = $3
              GROUP BY vcs.current_stage`;
      params.push(bankId);
    } else {
      sql = `SELECT current_stage, COUNT(*) AS c
               FROM lj_visitor_campaign_state
              WHERE user_id = $1 AND campaign_id = $2
              GROUP BY current_stage`;
    }
    const r = await req.tenantDb.query(sql, params);

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

    return res.status(200).json({ ok: true, campaignId, bankId, total, counts });
  } catch (err) {
    console.error('[campaign-pipeline-counts]', err);
    return res.status(500).json({ ok: false, message: err?.message || 'Erro interno.' });
  }
};
