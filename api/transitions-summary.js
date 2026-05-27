// V34.9.3 — GET /api/transitions-summary?campaign_id=X
// Retorna count de movimentações por par (from_stage, to_stage) nos últimos 7 dias
// da campanha. Usado no modal de Triggers pra mostrar "X movimentações em 7d".

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const userId = Number(req.user.sub || req.user.id);
  const campaignId = Number(req.query?.campaign_id || 0);
  if (!campaignId) return res.status(400).json({ ok: false, message: 'campaign_id obrigatório.' });

  try {
    // Conta movimentações da campanha nos últimos 7 dias via raw_payload->campaign_id
    // (lj_transitions guarda raw_payload com campaign_id quando aplicável).
    const r = await req.tenantDb.query(
      `SELECT from_stage, to_stage, COUNT(*)::int AS c
         FROM lj_transitions
        WHERE user_id = $1
          AND occurred_at > NOW() - INTERVAL '7 days'
          AND (
                raw_payload->>'campaign_id' = $2::text
                OR raw_payload->>'campaignId' = $2::text
              )
        GROUP BY 1, 2`,
      [userId, campaignId]
    );

    const counts = {};
    for (const row of r.rows) {
      const key = `${row.from_stage || 'null'}->${row.to_stage}`;
      counts[key] = row.c;
    }

    return res.status(200).json({ ok: true, campaignId, counts });
  } catch (err) {
    console.error('[transitions-summary]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
