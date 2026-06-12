// V37.4.0 — POST /api/notification-update
// Body: { id, action: 'read'|'unread'|'done'|'undone'|'save'|'unsave'|'snooze'|'unsnooze', snoozeUntil? }
// Atualiza estado de UMA notification do user logado.

const { updateNotificationState, markAllAsRead } = require('../lib/notification-engine');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não plugado.' });

  const tenantId = req.user.tenantId;
  const userId = req.user.sub;
  if (!tenantId) return res.status(400).json({ ok: false, message: 'Sem tenant ativo.' });

  const { id, action, snoozeUntil, bulk } = req.body || {};

  try {
    // Bulk: marcar tudo como lido
    if (bulk === 'mark_all_read') {
      const r = await markAllAsRead({ db: req.tenantDb, tenantId, userId });
      return res.status(200).json({ ok: true, ...r });
    }

    if (!id || !action) return res.status(400).json({ ok: false, message: 'id + action obrigatórios.' });

    let snoozeIso = null;
    if (action === 'snooze') {
      if (!snoozeUntil) return res.status(400).json({ ok: false, message: 'snoozeUntil obrigatório pra snooze.' });
      const d = new Date(snoozeUntil);
      if (isNaN(d.getTime()) || d <= new Date()) {
        return res.status(400).json({ ok: false, message: 'snoozeUntil deve ser data futura válida.' });
      }
      snoozeIso = d.toISOString();
    }

    const r = await updateNotificationState({
      db: req.tenantDb,
      id: Number(id),
      userId,
      action,
      snoozeUntil: snoozeIso
    });

    return res.status(200).json({ ok: true, ...r });
  } catch (err) {
    console.error('[notification-update]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
