// V34.7.f — Recalcula scores RFV de visitors. Pode rodar 1 visitor, scope
// campanha, ou batch tenant inteiro (decay diário).
//
// POST /api/score-recalc
// Auth: JWT autenticado OU X-Cron-Token (cron daily)
// Body:
//   { visitor_id?: 'imp_X' }       — recalcula 1 visitor
//   { campaign_id?: 5 }            — recalcula todos da campanha
//   { batch_decay?: true }         — cron decay batch (até max_visitors)
//   { max_visitors?: 200 }
//
// Resposta:
//   { ok, processed, results: [{ visitorId, globalScore, ... }] }

const { applyEvent, applyDecayBatch } = require('../lib/score-engine');

function authorize(req) {
  if (req.user) return { ok: true, source: 'jwt' };
  const cronToken = process.env.CRON_RECONCILE_TOKEN;
  if (cronToken) {
    const provided = req.headers['x-cron-token'] || req.query?.cron_token;
    if (provided && String(provided) === cronToken) return { ok: true, source: 'cron-token' };
  }
  return { ok: false };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  const auth = authorize(req);
  if (!auth.ok) return res.status(401).json({ ok: false, message: 'Não autorizado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  const userId = Number(body.user_id || req.user?.sub || 0);
  if (!userId) return res.status(400).json({ ok: false, message: 'user_id obrigatório.' });

  const visitorId = body.visitor_id ? String(body.visitor_id) : null;
  const campaignId = body.campaign_id ? Number(body.campaign_id) : null;
  const batchDecay = Boolean(body.batch_decay);
  const maxVisitors = Number(body.max_visitors || 200);

  try {
    if (visitorId) {
      const r = await applyEvent(req.tenantDb, userId, visitorId);
      return res.status(200).json({ ...r, triggeredBy: auth.source });
    }

    if (campaignId) {
      // Recalcula todos visitors imputados na campanha
      const lst = await req.tenantDb.query(
        `SELECT lj_visitor_id FROM lj_visitor_campaign_state WHERE user_id = $1 AND campaign_id = $2 LIMIT $3`,
        [userId, campaignId, maxVisitors]
      );
      let processed = 0;
      const errors = [];
      for (const row of lst.rows) {
        try {
          await applyEvent(req.tenantDb, userId, row.lj_visitor_id);
          processed++;
        } catch (err) {
          if (errors.length < 5) errors.push({ visitor: row.lj_visitor_id, error: err.message });
        }
      }
      return res.status(200).json({ ok: true, mode: 'campaign', campaignId, processed, errors, triggeredBy: auth.source });
    }

    if (batchDecay) {
      const r = await applyDecayBatch(req.tenantDb, userId, { maxVisitors });
      return res.status(200).json({ ...r, mode: 'batch-decay', triggeredBy: auth.source });
    }

    return res.status(400).json({ ok: false, message: 'Informe visitor_id OU campaign_id OU batch_decay=true.' });
  } catch (err) {
    console.error('[score-recalc]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
