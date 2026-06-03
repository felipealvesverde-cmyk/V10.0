// V35.11.0 — /api/rd-webhook-failures-summary
//
// GET → resumo agregado das falhas de webhook NÃO LIDAS:
//   { ok, count, breakdown: { validation, db, tenant-resolve, unknown },
//     firstFailureAt, lastFailureAt }
//
//   - count = soma de falhas com user_read_at IS NULL (até cliente clicar "Marcar como visto")
//   - breakdown = falhas por error_category
//   - count drives a escalada do sininho: 1-9 = amber, 10+ = rose (regra V35.11.0)
//
// POST { action: 'mark_read' } → marca TODAS as falhas atuais como lidas
//   (user_read_at = NOW()). Próxima falha vira nova vaga e gera nova notificação.
//   Mesma escolha (a) do Felipe: nova falha pós-leitura = nova notificação imediata.
//
// Master pode passar ?user_id=X pra inspecionar outro tenant.

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  const myId = Number(req.user.sub || req.user.id);
  const scopeUserId = (req.user.isMaster && req.query?.user_id) ? Number(req.query.user_id) : myId;
  if (!scopeUserId) return res.status(401).json({ ok: false, message: 'JWT sem user id.' });

  try {
    if (req.method === 'GET') {
      const r = await req.tenantDb.query(
        `SELECT error_category,
                COUNT(*)::int AS count,
                MIN(received_at) AS first_at,
                MAX(received_at) AS last_at
           FROM lj_rd_webhook_log
          WHERE user_id = $1
            AND status = 'error'
            AND user_read_at IS NULL
          GROUP BY error_category`,
        [scopeUserId]
      );

      const breakdown = {};
      let total = 0;
      let firstAt = null;
      let lastAt = null;
      r.rows.forEach(row => {
        const cat = row.error_category || 'unknown';
        breakdown[cat] = row.count;
        total += row.count;
        if (!firstAt || new Date(row.first_at) < new Date(firstAt)) firstAt = row.first_at;
        if (!lastAt || new Date(row.last_at) > new Date(lastAt)) lastAt = row.last_at;
      });

      return res.status(200).json({
        ok: true,
        count: total,
        breakdown,
        firstFailureAt: firstAt,
        lastFailureAt: lastAt
      });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const action = String(body.action || '').toLowerCase();
      if (action !== 'mark_read') {
        return res.status(400).json({ ok: false, message: 'action inválida.' });
      }
      const r = await req.tenantDb.query(
        `UPDATE lj_rd_webhook_log
            SET user_read_at = NOW()
          WHERE user_id = $1
            AND status = 'error'
            AND user_read_at IS NULL`,
        [scopeUserId]
      );
      return res.status(200).json({ ok: true, updated: r.rowCount || 0 });
    }

    return res.status(405).json({ ok: false, message: 'Use GET ou POST.' });
  } catch (err) {
    console.error('[rd-webhook-failures-summary]', err.message);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
