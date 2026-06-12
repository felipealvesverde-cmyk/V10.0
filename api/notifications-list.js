// V37.4.0 — GET /api/notifications-list
// Lista notifications do user logado no tenant ativo.
// Query: ?status=inbox|saved|archive|snoozed&category=X&severity=Y&limit=100

const { listNotifications, countByStatus } = require('../lib/notification-engine');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, message: 'Use GET.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não plugado.' });

  const tenantId = req.user.tenantId;
  const userId = req.user.sub;
  if (!tenantId) return res.status(400).json({ ok: false, message: 'Sem tenant ativo.' });

  const status = String(req.query?.status || 'inbox');
  const category = req.query?.category ? String(req.query.category) : null;
  const severity = req.query?.severity ? String(req.query.severity) : null;
  const limit = Math.min(500, Math.max(1, Number(req.query?.limit) || 100));

  try {
    const [items, counts] = await Promise.all([
      listNotifications({ db: req.tenantDb, tenantId, userId, status, category, severity, limit }),
      countByStatus({ db: req.tenantDb, tenantId, userId })
    ]);

    return res.status(200).json({ ok: true, items, counts });
  } catch (err) {
    console.error('[notifications-list]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
