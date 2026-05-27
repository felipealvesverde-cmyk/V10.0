// V34.8.0 — /api/reconciliation-alerts
// Cliente: lista + resolve alertas de conciliação RD↔LJ do próprio user.
//
//   GET  → { count, alerts: [{ id, lj_visitor_id, field, lj_value, rd_value, ... }] }
//   POST → body { alert_id, resolution: 'keep_lj' | 'keep_rd' | 'dismiss' }
//          - keep_lj: mantém valor LJ + marca visitor como pending pra empurrar pro RD
//          - keep_rd: copia valor do RD pra LJ (sobrescreve)
//          - dismiss: marca resolvido sem mudar nada (ignora o conflito)
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
        `SELECT a.id, a.lj_visitor_id, a.field, a.lj_value, a.rd_value,
                a.lj_updated_at, a.rd_updated_at, a.detected_at,
                v.name AS visitor_name, v.email AS visitor_email
           FROM lj_reconciliation_alerts a
           LEFT JOIN lj_visitors v
             ON v.user_id = a.user_id AND v.lj_visitor_id = a.lj_visitor_id
          WHERE a.user_id = $1 AND a.resolved_at IS NULL
          ORDER BY a.detected_at DESC
          LIMIT 200`,
        [scopeUserId]
      );
      return res.status(200).json({
        ok: true,
        count: r.rows.length,
        alerts: r.rows
      });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
      body = body || {};
      const alertId = Number(body.alert_id);
      const resolution = String(body.resolution || '').toLowerCase();
      if (!alertId) return res.status(400).json({ ok: false, message: 'alert_id obrigatório.' });
      if (!['keep_lj', 'keep_rd', 'dismiss'].includes(resolution)) {
        return res.status(400).json({ ok: false, message: 'resolution deve ser keep_lj | keep_rd | dismiss.' });
      }

      const a = await req.tenantDb.query(
        `SELECT id, lj_visitor_id, field, lj_value, rd_value
           FROM lj_reconciliation_alerts
          WHERE id = $1 AND user_id = $2 AND resolved_at IS NULL`,
        [alertId, scopeUserId]
      );
      if (!a.rows.length) return res.status(404).json({ ok: false, message: 'Alerta não encontrado ou já resolvido.' });
      const alert = a.rows[0];

      const DB_COL_BY_FIELD = { name: 'name', phone: 'phone', email: 'email' };
      const dbCol = DB_COL_BY_FIELD[alert.field];

      if (resolution === 'keep_rd' && dbCol) {
        // Aplica valor RD no LJ
        await req.tenantDb.query(
          `UPDATE lj_visitors SET ${dbCol} = $3, updated_at = NOW()
            WHERE user_id = $1 AND lj_visitor_id = $2`,
          [scopeUserId, alert.lj_visitor_id, alert.rd_value]
        );
      } else if (resolution === 'keep_lj' && dbCol) {
        // Mantém LJ + marca pending pra empurrar pro RD na próxima
        await req.tenantDb.query(
          `UPDATE lj_visitors SET
             external_rd_sync_status = 'pending-contact-update',
             external_rd_sync_error = 'reconcile:keep-lj',
             updated_at = NOW()
           WHERE user_id = $1 AND lj_visitor_id = $2 AND external_rd_contact_id IS NOT NULL`,
          [scopeUserId, alert.lj_visitor_id]
        );
      }

      await req.tenantDb.query(
        `UPDATE lj_reconciliation_alerts
            SET resolved_at = NOW(), resolution = $2
          WHERE id = $1`,
        [alertId, resolution]
      );
      return res.status(200).json({ ok: true, alertId, resolution });
    }

    return res.status(405).json({ ok: false, message: 'Use GET ou POST.' });
  } catch (err) {
    console.error('[reconciliation-alerts]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
