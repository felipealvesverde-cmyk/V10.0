// V34.9.9 — Purge TOTAL dos leads globais do user no LJ.
//
// Deleta visitors + tabelas dependentes (tags, touchpoints, eventos, transitions,
// campaign_state, reconciliation_alerts). NÃO toca em RD CRM (deals/contatos).
//
// POST /api/visitors-purge-all
// Body: { confirm: "DELETAR TUDO" }
// Auth: JWT autenticado (self-scope). Master pode passar user_id pra outro tenant.

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
  body = body || {};

  const confirm = String(body.confirm || '').trim();
  if (confirm !== 'DELETAR TUDO') {
    return res.status(400).json({ ok: false, message: 'confirm: "DELETAR TUDO" obrigatório no body.' });
  }

  const myId = Number(req.user.sub || req.user.id);
  const scopeUserId = req.user.isMaster && body.user_id ? Number(body.user_id) : myId;
  if (!scopeUserId) return res.status(400).json({ ok: false, message: 'JWT sem user id.' });

  const TABLES = [
    'lj_visitor_tags',
    'lj_visitor_touchpoints',
    'lj_visitor_events',
    'lj_transitions',
    'lj_visitor_campaign_state',
    'lj_reconciliation_alerts',
    'lj_visitors'  // por último, pois tem FK das demais
  ];

  const deletedByTable = {};
  for (const table of TABLES) {
    try {
      const r = await req.tenantDb.query(
        `DELETE FROM ${table} WHERE user_id = $1 RETURNING 1`,
        [scopeUserId]
      );
      deletedByTable[table] = r.rowCount || 0;
    } catch (err) {
      deletedByTable[table] = { error: err.message };
      console.warn(`[visitors-purge-all] ${table}:`, err.message);
    }
  }

  return res.status(200).json({
    ok: true,
    scopeUserId,
    deletedByTable
  });
};
