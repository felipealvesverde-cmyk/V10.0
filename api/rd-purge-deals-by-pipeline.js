// V34.9.8 — Purge cirúrgico: DELETE todos deals de uma pipeline específica
// no RD CRM + reset external_rd_deal_id no lj_visitors do user.
//
// NÃO toca em contatos (cliente deleta manualmente no RD se quiser).
// NÃO toca em outras pipelines.
//
// POST /api/rd-purge-deals-by-pipeline
// Body: { pipeline_id, confirm: "DELETAR DEALS" }
// Auth: master only (operação destrutiva)

const { rdFetch } = require('../lib/rd-contact-sync-engine');
const { getRdCredential } = require('../lib/rd-credentials');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });
  if (!req.user.isMaster) return res.status(403).json({ ok: false, message: 'Apenas master pode purgar deals.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  const pipelineId = String(body.pipeline_id || '').trim();
  const confirm = String(body.confirm || '').trim();
  const scopeUserId = Number(body.user_id || req.user.sub || req.user.id);

  if (!pipelineId) return res.status(400).json({ ok: false, message: 'pipeline_id obrigatório.' });
  if (confirm !== 'DELETAR DEALS') {
    return res.status(400).json({ ok: false, message: 'confirm: "DELETAR DEALS" obrigatório no body (proteção contra rodar por acidente).' });
  }
  if (!scopeUserId) return res.status(400).json({ ok: false, message: 'user_id obrigatório (master).' });

  // Pega token RD CRM do user scope
  let token = null;
  try {
    const cred = await getRdCredential(req.tenantDb, scopeUserId, 'crm_pat');
    token = cred?.token;
  } catch (err) {
    return res.status(400).json({ ok: false, message: `RD CRM do user ${scopeUserId} não conectado: ${err.message}` });
  }
  if (!token) return res.status(400).json({ ok: false, message: 'PAT RD CRM não configurado.' });

  // Lista TODOS deals da pipeline (pagina)
  const allDeals = [];
  let page = 1;
  while (page <= 30) {
    const r = await rdFetch(`/deals?deal_pipeline_id=${encodeURIComponent(pipelineId)}&limit=200&page=${page}`, token);
    const deals = r.data?.deals || r.data?.data || (Array.isArray(r.data) ? r.data : []);
    if (!Array.isArray(deals) || !deals.length) break;
    for (const d of deals) allDeals.push(d.id || d._id);
    if (deals.length < 200) break;
    if (r.data?.has_more === false) break;
    page++;
  }

  // DELETE cada deal
  let deleted = 0, failed = 0;
  const errors = [];
  for (const dealId of allDeals) {
    const r = await rdFetch(`/deals/${encodeURIComponent(dealId)}`, token, { method: 'DELETE' });
    if (r.ok || r.status === 204) deleted++;
    else {
      failed++;
      if (errors.length < 10) errors.push({ dealId, status: r.status, msg: typeof r.data === 'object' ? JSON.stringify(r.data).slice(0, 100) : String(r.data || '').slice(0, 100) });
    }
  }

  // Reset external_rd_deal_id no lj_visitors do user scope
  let resetCount = 0;
  try {
    const resetRes = await req.tenantDb.query(
      `UPDATE lj_visitors SET external_rd_deal_id = NULL, updated_at = NOW()
        WHERE user_id = $1 AND external_rd_deal_id IS NOT NULL
        RETURNING lj_visitor_id`,
      [scopeUserId]
    );
    resetCount = resetRes.rowCount;
  } catch (err) {
    console.warn('[rd-purge-deals-by-pipeline] reset lj_visitors falhou:', err.message);
  }

  return res.status(200).json({
    ok: true,
    pipelineId,
    scopeUserId,
    totalListed: allDeals.length,
    deleted,
    failed,
    resetLjVisitors: resetCount,
    errors: errors.slice(0, 10)
  });
};
