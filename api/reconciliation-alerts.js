// V34.9.4 — /api/reconciliation-alerts (versão ampliada).
//
// O sininho agrega 3 tipos de notificação:
//   1. conflicts  — campo divergente LJ↔RD (lj_reconciliation_alerts)
//   2. pendingStage — visitor com external_rd_sync_status='pending-stage-update'
//   3. pendingDeal  — visitor com external_rd_sync_status='pending-deal-creation'
//
//   GET ?include=lists     → counts + listas (alerts, stagePending, dealPending)
//   GET (sem include)      → só counts (rápido pra badge)
//   POST { action: 'mark_read' } → marca todos alerts read_at=NOW()
//   POST { alert_id, resolution: 'keep_lj'|'keep_rd'|'dismiss' } → resolve 1
//
// Badge unread conta apenas alerts não-lidos + counts brutos dos pending (sempre
// visíveis até processarem). Master pode ?user_id=X pra inspecionar outro tenant.

const { resolveCredentialOwnerId } = require('../lib/credentials-owner');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não configurado.' });

  // V37.4.34 — Alertas vivem na linha do OWNER do tenant. Master pode override ?user_id=X.
  const myId = await resolveCredentialOwnerId(req);
  const scopeUserId = (req.user.isMaster && req.query?.user_id) ? Number(req.query.user_id) : myId;
  if (!scopeUserId) return res.status(401).json({ ok: false, message: 'JWT sem user id.' });

  try {
    if (req.method === 'GET') {
      const includeLists = String(req.query?.include || '').toLowerCase() === 'lists';

      // Counts (sempre)
      const [conflictsUnread, conflictsTotal, stageCount, dealCount] = await Promise.all([
        req.tenantDb.query(
          `SELECT COUNT(*)::int AS c FROM lj_reconciliation_alerts
            WHERE user_id = $1 AND resolved_at IS NULL AND read_at IS NULL`,
          [scopeUserId]
        ),
        req.tenantDb.query(
          `SELECT COUNT(*)::int AS c FROM lj_reconciliation_alerts
            WHERE user_id = $1 AND resolved_at IS NULL`,
          [scopeUserId]
        ),
        req.tenantDb.query(
          `SELECT COUNT(*)::int AS c FROM lj_visitors
            WHERE user_id = $1 AND external_rd_sync_status = 'pending-stage-update'`,
          [scopeUserId]
        ),
        req.tenantDb.query(
          `SELECT COUNT(*)::int AS c FROM lj_visitors
            WHERE user_id = $1 AND external_rd_sync_status = 'pending-deal-creation'`,
          [scopeUserId]
        )
      ]);

      const counts = {
        conflictsUnread: conflictsUnread.rows[0]?.c || 0,
        conflictsTotal: conflictsTotal.rows[0]?.c || 0,
        pendingStage: stageCount.rows[0]?.c || 0,
        pendingDeal: dealCount.rows[0]?.c || 0
      };
      counts.totalUnread = counts.conflictsUnread + counts.pendingStage + counts.pendingDeal;

      if (!includeLists) {
        return res.status(200).json({ ok: true, counts });
      }

      // Listas (quando abrir modal)
      const [alerts, stagePending, dealPending] = await Promise.all([
        req.tenantDb.query(
          `SELECT a.id, a.lj_visitor_id, a.field, a.lj_value, a.rd_value,
                  a.lj_updated_at, a.rd_updated_at, a.detected_at, a.read_at,
                  v.name AS visitor_name, v.email AS visitor_email
             FROM lj_reconciliation_alerts a
             LEFT JOIN lj_visitors v
               ON v.user_id = a.user_id AND v.lj_visitor_id = a.lj_visitor_id
            WHERE a.user_id = $1 AND a.resolved_at IS NULL
            ORDER BY a.detected_at DESC LIMIT 200`,
          [scopeUserId]
        ),
        req.tenantDb.query(
          `SELECT lj_visitor_id, name, email, current_stage,
                  external_rd_deal_id, external_rd_sync_error, updated_at
             FROM lj_visitors
            WHERE user_id = $1 AND external_rd_sync_status = 'pending-stage-update'
            ORDER BY updated_at DESC LIMIT 100`,
          [scopeUserId]
        ),
        req.tenantDb.query(
          `SELECT lj_visitor_id, name, email, current_stage,
                  external_rd_contact_id, external_rd_sync_error, updated_at
             FROM lj_visitors
            WHERE user_id = $1 AND external_rd_sync_status = 'pending-deal-creation'
            ORDER BY updated_at DESC LIMIT 100`,
          [scopeUserId]
        )
      ]);

      return res.status(200).json({
        ok: true,
        counts,
        alerts: alerts.rows,
        stagePending: stagePending.rows,
        dealPending: dealPending.rows
      });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (_) { body = {}; } }
      body = body || {};

      // V34.9.4 — Mark all alerts as read (chamado quando modal abre)
      if (body.action === 'mark_read') {
        await req.tenantDb.query(
          `UPDATE lj_reconciliation_alerts SET read_at = NOW()
            WHERE user_id = $1 AND read_at IS NULL AND resolved_at IS NULL`,
          [scopeUserId]
        );
        return res.status(200).json({ ok: true });
      }

      const alertId = Number(body.alert_id);
      const resolution = String(body.resolution || '').toLowerCase();
      if (!alertId) return res.status(400).json({ ok: false, message: 'alert_id obrigatório (ou action=mark_read).' });
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
        await req.tenantDb.query(
          `UPDATE lj_visitors SET ${dbCol} = $3, updated_at = NOW()
            WHERE user_id = $1 AND lj_visitor_id = $2`,
          [scopeUserId, alert.lj_visitor_id, alert.rd_value]
        );
      } else if (resolution === 'keep_lj' && dbCol) {
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
            SET resolved_at = NOW(), resolution = $2, read_at = COALESCE(read_at, NOW())
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
