// V37.4.0 — Notification engine (tenant DB).
//
// Modelo:
//   - Cada notification é uma linha pra um user específico (audience expandido)
//   - Audience pode ser: user_id direto, array de user_ids, 'tenant_wide' (todos members)
//   - Estados independentes por user: read / done / saved / snoozed
//   - kind = '<category>.<event>' (ex: 'handoff.task_assigned', 'integration.disconnected')
//
// Categorias (V37.4 design):
//   handoff     — alguém agiu pra você
//   event       — criação/mudança de entidade no tenant
//   state       — mudança de status de entidade
//   operational — tasks atrasadas, capacity, próxima entrega
//   integration — integração desconectada, webhook falhando
//   health      — tenant health (só Master)
//
// Severidades: info / warning / critical
//
// API:
//   createNotification({ db, tenantId, audience, ...opts })
//   listNotifications({ db, tenantId, userId, status, category, severity })
//   updateNotificationState({ db, id, userId, action }) — action: read|unread|done|save|unsave|snooze
//
// Lei do design diretor: notifications NÃO carregam HTML pré-renderizado — só
// data jsonb. Frontend renderiza preview rica a partir do data + kind + entityRef.

const CATEGORIES = ['handoff', 'event', 'state', 'operational', 'integration', 'health'];
const SEVERITIES = ['info', 'warning', 'critical'];

function validateCategory(c) { return CATEGORIES.includes(c) ? c : 'event'; }
function validateSeverity(s) { return SEVERITIES.includes(s) ? s : 'info'; }

async function expandAudience(db, tenantId, audience) {
  if (audience == null) return [];
  if (typeof audience === 'number') return [audience];
  if (Array.isArray(audience)) return audience.map(Number).filter(Boolean);
  if (audience === 'tenant_wide') {
    const r = await db.query('SELECT user_id FROM tenant_members WHERE tenant_id = $1', [tenantId]);
    return r.rows.map(row => Number(row.user_id));
  }
  if (typeof audience === 'object' && audience.role) {
    const r = await db.query('SELECT user_id FROM tenant_members WHERE tenant_id = $1 AND role = $2', [tenantId, audience.role]);
    return r.rows.map(row => Number(row.user_id));
  }
  return [];
}

async function createNotification({
  db,
  tenantId,
  audience,
  kind,
  category,
  severity,
  title,
  body,
  data,
  entityKind,
  entityId,
  sourceUserId,
  expiresAt
}) {
  if (!db || !tenantId || !audience || !kind) {
    throw new Error('createNotification: db + tenantId + audience + kind obrigatórios.');
  }
  const cat = validateCategory(category);
  const sev = validateSeverity(severity);
  const userIds = await expandAudience(db, tenantId, audience);
  if (!userIds.length) return { ok: true, inserted: 0, ids: [] };

  const dataJson = JSON.stringify(data || {});
  const inserted = [];

  for (const uid of userIds) {
    const r = await db.query(`
      INSERT INTO notifications (
        tenant_id, user_id, kind, category, severity,
        title, body, data, entity_kind, entity_id,
        source_user_id, expires_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, NOW())
      RETURNING id
    `, [
      tenantId, uid, kind, cat, sev,
      title || null, body || null, dataJson, entityKind || null, entityId || null,
      sourceUserId || null, expiresAt || null
    ]);
    inserted.push(r.rows[0].id);
  }

  return { ok: true, inserted: inserted.length, ids: inserted };
}

async function listNotifications({ db, tenantId, userId, status, category, severity, limit = 100 }) {
  if (!db || !tenantId || !userId) throw new Error('listNotifications: db + tenantId + userId obrigatórios.');

  const where = ['tenant_id = $1', 'user_id = $2'];
  const params = [tenantId, userId];
  let idx = 3;

  // Status:
  //   'inbox'   = não-feita + não-snoozed (ou snooze expirado) + não-saved
  //   'saved'   = saved_at NOT NULL
  //   'archive' = done_at NOT NULL
  //   'all'     = tudo
  if (status === 'inbox' || !status) {
    where.push('done_at IS NULL');
    where.push('saved_at IS NULL');
    where.push('(snoozed_until IS NULL OR snoozed_until < NOW())');
  } else if (status === 'saved') {
    where.push('saved_at IS NOT NULL');
    where.push('done_at IS NULL');
  } else if (status === 'archive') {
    where.push('done_at IS NOT NULL');
  } else if (status === 'snoozed') {
    where.push('snoozed_until > NOW()');
    where.push('done_at IS NULL');
  }

  if (category && CATEGORIES.includes(category)) {
    where.push(`category = $${idx++}`);
    params.push(category);
  }
  if (severity && SEVERITIES.includes(severity)) {
    where.push(`severity = $${idx++}`);
    params.push(severity);
  }

  params.push(limit);
  const r = await db.query(`
    SELECT id, kind, category, severity, title, body, data, entity_kind, entity_id,
           source_user_id, created_at, read_at, done_at, saved_at, snoozed_until,
           expires_at
    FROM notifications
    WHERE ${where.join(' AND ')}
    ORDER BY (read_at IS NULL) DESC, created_at DESC
    LIMIT $${idx}
  `, params);

  return r.rows.map(row => ({
    id: row.id,
    kind: row.kind,
    category: row.category,
    severity: row.severity,
    title: row.title,
    body: row.body,
    data: row.data || {},
    entityKind: row.entity_kind,
    entityId: row.entity_id,
    sourceUserId: row.source_user_id,
    createdAt: row.created_at,
    readAt: row.read_at,
    doneAt: row.done_at,
    savedAt: row.saved_at,
    snoozedUntil: row.snoozed_until,
    expiresAt: row.expires_at
  }));
}

async function countByStatus({ db, tenantId, userId }) {
  if (!db || !tenantId || !userId) return { inbox: 0, saved: 0, archive: 0, snoozed: 0, criticalUnread: 0 };
  const r = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE done_at IS NULL AND saved_at IS NULL AND (snoozed_until IS NULL OR snoozed_until < NOW())) AS inbox,
      COUNT(*) FILTER (WHERE saved_at IS NOT NULL AND done_at IS NULL) AS saved,
      COUNT(*) FILTER (WHERE done_at IS NOT NULL) AS archive,
      COUNT(*) FILTER (WHERE snoozed_until > NOW() AND done_at IS NULL) AS snoozed,
      COUNT(*) FILTER (WHERE done_at IS NULL AND saved_at IS NULL AND read_at IS NULL AND severity = 'critical' AND (snoozed_until IS NULL OR snoozed_until < NOW())) AS critical_unread,
      COUNT(*) FILTER (WHERE done_at IS NULL AND saved_at IS NULL AND read_at IS NULL AND severity = 'warning' AND (snoozed_until IS NULL OR snoozed_until < NOW())) AS warning_unread,
      COUNT(*) FILTER (WHERE done_at IS NULL AND saved_at IS NULL AND read_at IS NULL AND severity = 'info' AND (snoozed_until IS NULL OR snoozed_until < NOW())) AS info_unread
    FROM notifications
    WHERE tenant_id = $1 AND user_id = $2
  `, [tenantId, userId]);
  const row = r.rows[0] || {};
  return {
    inbox: Number(row.inbox || 0),
    saved: Number(row.saved || 0),
    archive: Number(row.archive || 0),
    snoozed: Number(row.snoozed || 0),
    criticalUnread: Number(row.critical_unread || 0),
    warningUnread: Number(row.warning_unread || 0),
    infoUnread: Number(row.info_unread || 0)
  };
}

async function updateNotificationState({ db, id, userId, action, snoozeUntil }) {
  if (!db || !id || !userId || !action) throw new Error('updateNotificationState: id + userId + action obrigatórios.');

  let setClause;
  let params;

  switch (action) {
    case 'read':
      setClause = 'read_at = COALESCE(read_at, NOW())';
      params = [id, userId];
      break;
    case 'unread':
      setClause = 'read_at = NULL';
      params = [id, userId];
      break;
    case 'done':
      setClause = 'done_at = NOW(), read_at = COALESCE(read_at, NOW())';
      params = [id, userId];
      break;
    case 'undone':
      setClause = 'done_at = NULL';
      params = [id, userId];
      break;
    case 'save':
      setClause = 'saved_at = NOW(), read_at = COALESCE(read_at, NOW())';
      params = [id, userId];
      break;
    case 'unsave':
      setClause = 'saved_at = NULL';
      params = [id, userId];
      break;
    case 'snooze':
      if (!snoozeUntil) throw new Error('snooze action requer snoozeUntil');
      setClause = 'snoozed_until = $3';
      params = [id, userId, snoozeUntil];
      break;
    case 'unsnooze':
      setClause = 'snoozed_until = NULL';
      params = [id, userId];
      break;
    default:
      throw new Error(`Action inválida: ${action}`);
  }

  const r = await db.query(`
    UPDATE notifications SET ${setClause}
    WHERE id = $1 AND user_id = $2
    RETURNING id
  `, params);

  return { ok: true, affected: r.rowCount };
}

async function markAllAsRead({ db, tenantId, userId }) {
  const r = await db.query(`
    UPDATE notifications SET read_at = NOW()
    WHERE tenant_id = $1 AND user_id = $2 AND read_at IS NULL
      AND done_at IS NULL AND saved_at IS NULL
      AND (snoozed_until IS NULL OR snoozed_until < NOW())
  `, [tenantId, userId]);
  return { ok: true, affected: r.rowCount };
}

module.exports = {
  CATEGORIES,
  SEVERITIES,
  createNotification,
  listNotifications,
  countByStatus,
  updateNotificationState,
  markAllAsRead
};
