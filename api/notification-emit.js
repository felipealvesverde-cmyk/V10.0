// V37.4.3 — POST /api/notification-emit
// Endpoint pra criação client-side de notifications.
//
// Body: { audience, kind, category, severity, title, body, data, entityKind, entityId, expiresAt }
//
// Auth: qualquer member do tenant pode emitir. Limites:
//   - audience 'tenant_wide' OU role 'owner' só Master ou tenant owner
//   - kind/category obrigatório
//   - sourceUserId é o caller (não pode forjar)

const { emit } = require('../lib/emit-notification');
const { normalizeRole } = require('../lib/permission-engine');

const CATEGORIES = ['handoff', 'event', 'state', 'operational', 'integration', 'health'];
const SEVERITIES = ['info', 'warning', 'critical'];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Tenant DB não plugado.' });

  const tenantId = req.user.tenantId;
  if (!tenantId) return res.status(400).json({ ok: false, message: 'Sem tenant ativo.' });

  const {
    audience, kind, category, severity = 'info',
    title, body, data, entityKind, entityId, expiresAt
  } = req.body || {};

  if (!kind || !category || !audience) {
    return res.status(400).json({ ok: false, message: 'kind + category + audience obrigatórios.' });
  }
  if (!CATEGORIES.includes(category)) return res.status(400).json({ ok: false, message: 'category inválida.' });
  if (severity && !SEVERITIES.includes(severity)) return res.status(400).json({ ok: false, message: 'severity inválida.' });

  // Audience tenant_wide ou by role: precisa Master ou owner.
  const isWideAudience = audience === 'tenant_wide' ||
    (typeof audience === 'object' && audience.role && audience.role !== 'self');
  if (isWideAudience && !req.user.isMaster) {
    try {
      const m = await req.db.query(
        'SELECT role FROM tenant_members WHERE tenant_id = $1 AND user_id = $2',
        [tenantId, req.user.sub]
      );
      if (!m.rows.length || normalizeRole(m.rows[0].role) !== 'owner') {
        return res.status(403).json({ ok: false, message: 'Audience ampla requer role owner.' });
      }
    } catch (err) {
      return res.status(500).json({ ok: false, message: err.message });
    }
  }

  try {
    const result = await emit(req, {
      audience, kind, category, severity,
      title, body, data, entityKind, entityId, expiresAt
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('[notification-emit]', err);
    return res.status(500).json({ ok: false, message: err.message });
  }
};
