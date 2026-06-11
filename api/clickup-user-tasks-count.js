// V37.1.0 — POST /api/clickup-user-tasks-count
// Agrega tasks por pessoa cross-space (mesmo workspace ClickUp). Pra cada user_id:
//   - particiona em LJ (space.id === lj_space_id) vs Externos
//   - conta open/done por bucket
//   - calcula avg_hours (últimas 20 closed do POOL inteiro: LJ + Ext)
//   - daily_load: 14 dias (hoje..hoje+13) somando (time_estimate_h || avg_hours)
//     pra cada task com due_date no dia. Atrasadas vão pro dia de hoje.
//
// Privacy: títulos de tasks externas nunca saem do backend. Só counts e cargas.
//
// Body: { user_ids: [123, 456, ...] }   // opcional. omitido = todos do team
// Retorna: { ok, users: [...], fetched_at, sample_min: 5 }
const { clickupFetch } = require('../lib/clickup-client');

const MAX_PAGES_PER_USER = 3;          // 300 tasks max
const SAMPLE_MIN = 5;                  // < 5 closed = avg_hours null
const SAMPLE_TARGET = 20;              // 20 mais recentes pra média
const DAILY_HORIZON = 14;              // 2 semanas

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildHorizon(now, days) {
  const out = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    out.push(ymd(d));
  }
  return out;
}

async function fetchUserTasks(db, userId, teamId, assigneeId) {
  const out = [];
  for (let page = 0; page < MAX_PAGES_PER_USER; page++) {
    const path = `/team/${teamId}/task?assignees[]=${assigneeId}&include_closed=true&subtasks=true&page=${page}`;
    const r = await clickupFetch(db, userId, 'GET', path);
    if (!r.ok) break;
    const tasks = Array.isArray(r.data?.tasks) ? r.data.tasks : [];
    out.push(...tasks);
    if (tasks.length < 100) break; // página final
  }
  return out;
}

function aggregateForUser(tasks, ljSpaceId, horizonDays, avgHoursFallback) {
  const lj = { open: 0, done: 0, late: 0 };
  const ext = { open: 0, done: 0, late: 0 };
  const closedSorted = [];
  const dailyLoad = Object.fromEntries(horizonDays.map(d => [d, 0]));

  const todayStr = horizonDays[0];
  const todayStart = new Date(todayStr + 'T00:00:00');
  const horizonEnd = new Date(horizonDays[horizonDays.length - 1] + 'T23:59:59');

  for (const t of tasks) {
    const isLj = String(t.space?.id || '') === String(ljSpaceId);
    const isClosed = t.status?.type === 'closed';
    const bucket = isLj ? lj : ext;
    if (isClosed) {
      bucket.done++;
    } else {
      bucket.open++;
      if (t.due_date) {
        const due = new Date(Number(t.due_date));
        if (!isNaN(due.getTime()) && due < todayStart) bucket.late++;
      }
    }

    if (isClosed && t.date_done && t.date_created) {
      const start = Number(t.date_created);
      const end = Number(t.date_done);
      if (end > start) {
        const hours = (end - start) / 3600000;
        closedSorted.push({ done: end, hours });
      }
    }
  }

  closedSorted.sort((a, b) => b.done - a.done);
  const sample = closedSorted.slice(0, SAMPLE_TARGET);
  let avgHours = null;
  if (sample.length >= SAMPLE_MIN) {
    avgHours = sample.reduce((s, x) => s + x.hours, 0) / sample.length;
  }

  const taskHours = avgHours || avgHoursFallback;
  for (const t of tasks) {
    if (t.status?.type === 'closed') continue;
    if (!t.due_date) continue;
    const due = new Date(Number(t.due_date));
    if (isNaN(due.getTime())) continue;
    const taskEstimateH = t.time_estimate ? (Number(t.time_estimate) / 3600000) : taskHours;
    let dayKey;
    if (due > horizonEnd) continue;
    if (ymd(due) < todayStr) {
      dayKey = todayStr;
    } else {
      dayKey = ymd(due);
    }
    if (dailyLoad[dayKey] !== undefined) {
      dailyLoad[dayKey] += taskEstimateH;
    }
  }

  for (const k of Object.keys(dailyLoad)) {
    dailyLoad[k] = Math.round(dailyLoad[k] * 10) / 10;
  }

  return {
    lj_open: lj.open, lj_done: lj.done, lj_late: lj.late,
    ext_open: ext.open, ext_done: ext.done, ext_late: ext.late,
    late_total: lj.late + ext.late,
    avg_hours: avgHours == null ? null : Math.round(avgHours * 10) / 10,
    sample_size: sample.length,
    daily_load: dailyLoad
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const userId = req.user.sub;

  const credRow = await req.tenantDb.query(
    'SELECT workspace_id, lj_space_id FROM clickup_credentials WHERE user_id = $1',
    [userId]
  );
  if (!credRow.rows.length) return res.status(404).json({ ok: false, message: 'ClickUp não conectado.' });
  const { workspace_id: teamId, lj_space_id: ljSpaceId } = credRow.rows[0];
  if (!teamId) return res.status(400).json({ ok: false, message: 'Workspace ClickUp não inicializado.' });
  if (!ljSpaceId) return res.status(400).json({ ok: false, message: 'Space LJ não configurado (rode Setup Wizard).' });

  let requestedIds = Array.isArray(req.body?.user_ids)
    ? req.body.user_ids.map(String).filter(Boolean)
    : null;

  let members = [];
  try {
    const r = await clickupFetch(req.tenantDb, userId, 'GET', '/team');
    if (r.ok && Array.isArray(r.data?.teams)) {
      const team = r.data.teams.find(t => String(t.id) === String(teamId)) || r.data.teams[0];
      const memList = Array.isArray(team?.members) ? team.members : [];
      members = memList
        .filter(m => m.user?.id)
        .map(m => ({
          id: String(m.user.id),
          name: m.user.username || m.user.email || `User ${m.user.id}`,
          email: m.user.email || null,
          initials: m.user.initials || (m.user.username ? m.user.username.slice(0, 2).toUpperCase() : null),
          color: m.user.color || null
        }));
    }
  } catch (_) {}

  const memberById = new Map(members.map(m => [m.id, m]));
  const targetIds = requestedIds
    ? requestedIds.filter(id => memberById.has(id))
    : members.map(m => m.id);

  if (!targetIds.length) {
    return res.status(200).json({ ok: true, users: [], fetched_at: new Date().toISOString(), sample_min: SAMPLE_MIN });
  }

  const now = new Date();
  const horizonDays = buildHorizon(now, DAILY_HORIZON);

  const results = await Promise.all(targetIds.map(async (uid) => {
    try {
      const tasks = await fetchUserTasks(req.tenantDb, userId, teamId, uid);
      const agg = aggregateForUser(tasks, ljSpaceId, horizonDays, 4);
      const m = memberById.get(uid);
      return {
        user_id: uid,
        name: m?.name || `User ${uid}`,
        email: m?.email || null,
        initials: m?.initials || (m?.name ? m.name.slice(0, 2).toUpperCase() : '??'),
        color: m?.color || null,
        ...agg
      };
    } catch (err) {
      const m = memberById.get(uid);
      return {
        user_id: uid,
        name: m?.name || `User ${uid}`,
        email: m?.email || null,
        initials: m?.initials || '??',
        color: m?.color || null,
        lj_open: 0, lj_done: 0, lj_late: 0,
        ext_open: 0, ext_done: 0, ext_late: 0,
        late_total: 0,
        avg_hours: null, sample_size: 0, daily_load: {},
        error: err.message
      };
    }
  }));

  results.sort((a, b) => (b.lj_open + b.lj_done) - (a.lj_open + a.lj_done));

  return res.status(200).json({
    ok: true,
    users: results,
    horizon_days: horizonDays,
    fetched_at: new Date().toISOString(),
    sample_min: SAMPLE_MIN,
    sample_target: SAMPLE_TARGET,
    journey_hours: 8
  });
};
