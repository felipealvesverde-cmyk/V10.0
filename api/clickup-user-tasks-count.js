// V37.1.0 → V37.1.4 — POST /api/clickup-user-tasks-count
// Agrega tasks por pessoa cross-space (mesmo workspace ClickUp). Pra cada user_id:
//   - particiona em LJ (space.id === lj_space_id) vs Externos
//   - conta open/done/late top-level (sem subtasks)
//   - calcula avg_hours (últimas 20 closed do POOL inteiro: LJ + Ext)
//   - daily_load: capacity planning — empilha (open_count × avg_hours) em 8h/dia
//     SEQUENCIALMENTE a partir de hoje, pulando sábado/domingo.
//
// V37.1.3 — Strategy C: 3 fetches paralelos (open + closed + late), subtasks=false.
// V37.1.4 — Mudanças cravadas:
//   1. Filter "concluída" passa de status.type==='closed' pra date_done>0.
//      Workspace Sansone usa status custom ("Concluído", "Entregue") que não
//      marca status.type='closed' mas SIM date_done preenchido.
//   2. Caps maiores: OPEN 3→6 páginas (600 max), LATE 2→5 (500 max). Flags
//      open_truncated / late_truncated indicam quando bate teto.
//   3. Horizonte vira 10 dias úteis (Seg-Sex), pulando fins de semana.
//   4. daily_load deixa de usar due_date — agora é capacity planning sequencial.
//      total_workload_hours = open_count × avg_hours. Empilha 8h/dia.
//      overflow_hours = sobra que não coube nos 10 dias úteis.
//
// Privacy: títulos de tasks externas nunca saem do backend.
const { clickupFetch } = require('../lib/clickup-client');

const MAX_PAGES_OPEN = 6;              // 600 open max top-level
const MAX_PAGES_CLOSED = 3;            // 300 closed max
const MAX_PAGES_LATE = 5;              // 500 late max
const ACTIVITY_LOOKBACK_DAYS = 30;     // V37.1.6 — só tasks mexidas/fechadas nos últimos 30d
const SAMPLE_MIN = 5;
const SAMPLE_TARGET = 20;
const BUSINESS_DAYS_HORIZON = 10;      // 2 semanas úteis (Seg-Sex × 2)
const DEFAULT_JOURNEY_HOURS = 8;
const DEFAULT_TASK_HOURS_FALLBACK = 4;
const TASK_HOURS_CAP = 8;              // V37.1.5 — cap por task antes de virar amostra

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isWeekday(date) {
  const dow = date.getDay();
  return dow !== 0 && dow !== 6;
}

// V37.1.4 — gera próximos N dias úteis a partir de hoje (pula sáb/dom).
function buildBusinessHorizon(now, businessDays) {
  const out = [];
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  let guard = 0;
  while (out.length < businessDays && guard < 365) {
    if (isWeekday(d)) out.push(ymd(d));
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return out;
}

// V37.1.6 — todos os fetches filtram por atividade nos últimos 30 dias.
// Tasks zumbi (criadas há meses, nunca mais mexidas) saem do escopo.
// "Mexida" = date_updated_gt; "Fechada" = date_done_gt.
function lookbackMs() {
  return Date.now() - (ACTIVITY_LOOKBACK_DAYS * 24 * 3600 * 1000);
}

async function fetchUserOpenTasks(db, userId, teamId, assigneeId) {
  const out = [];
  let truncated = false;
  const lb = lookbackMs();
  for (let page = 0; page < MAX_PAGES_OPEN; page++) {
    const path = `/team/${teamId}/task?assignees[]=${assigneeId}&include_closed=false&subtasks=false&date_updated_gt=${lb}&page=${page}`;
    const r = await clickupFetch(db, userId, 'GET', path);
    if (!r.ok) break;
    const tasks = Array.isArray(r.data?.tasks) ? r.data.tasks : [];
    out.push(...tasks);
    if (tasks.length < 100) break;
    if (page === MAX_PAGES_OPEN - 1 && tasks.length === 100) truncated = true;
  }
  return { tasks: out, truncated };
}

async function fetchUserClosedTasks(db, userId, teamId, assigneeId) {
  const lb = lookbackMs();
  const out = [];
  for (let page = 0; page < MAX_PAGES_CLOSED; page++) {
    const path = `/team/${teamId}/task?assignees[]=${assigneeId}&include_closed=true&subtasks=false&date_done_gt=${lb}&page=${page}`;
    const r = await clickupFetch(db, userId, 'GET', path);
    if (!r.ok) break;
    const tasks = Array.isArray(r.data?.tasks) ? r.data.tasks : [];
    out.push(...tasks);
    if (tasks.length < 100) break;
  }
  // V37.1.4 — filter por date_done > 0 (universal, cobre status custom).
  return out.filter(t => {
    const dd = Number(t.date_done);
    return Number.isFinite(dd) && dd > 0;
  });
}

async function fetchUserLateTasks(db, userId, teamId, assigneeId) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const todayMs = now.getTime();
  const lb = lookbackMs();
  const out = [];
  let truncated = false;
  for (let page = 0; page < MAX_PAGES_LATE; page++) {
    // V37.1.6 — só late mexidas nos últimos 30d. Tasks atrasadas há 6 meses
    // sem nenhum movimento saem do badge "X atrasadas".
    const path = `/team/${teamId}/task?assignees[]=${assigneeId}&include_closed=false&subtasks=false&due_date_lt=${todayMs}&date_updated_gt=${lb}&page=${page}`;
    const r = await clickupFetch(db, userId, 'GET', path);
    if (!r.ok) break;
    const tasks = Array.isArray(r.data?.tasks) ? r.data.tasks : [];
    out.push(...tasks);
    if (tasks.length < 100) break;
    if (page === MAX_PAGES_LATE - 1 && tasks.length === 100) truncated = true;
  }
  return { tasks: out, truncated };
}

// V37.1.4 — capacity planning: total = open × avg_hours, empilha 8h/dia
// sequencialmente nos dias do horizonte. overflow = sobra.
function buildSequentialLoad(openCount, taskHours, horizonDays, journeyHours) {
  const total = openCount * taskHours;
  const out = Object.fromEntries(horizonDays.map(d => [d, 0]));
  let remaining = total;
  for (const day of horizonDays) {
    if (remaining <= 0) break;
    const alloc = Math.min(remaining, journeyHours);
    out[day] = Math.round(alloc * 10) / 10;
    remaining -= alloc;
  }
  const overflow = Math.max(0, Math.round(remaining * 10) / 10);
  return {
    dailyLoad: out,
    overflowHours: overflow,
    totalWorkloadHours: Math.round(total * 10) / 10
  };
}

function aggregateForUser(openTasks, closedTasks, lateTasks, ljSpaceId, horizonDays, journeyHours) {
  const lj = { open: 0, done: 0, late: 0 };
  const ext = { open: 0, done: 0, late: 0 };
  const closedWithTimestamps = [];

  for (const t of openTasks) {
    const isLj = String(t.space?.id || '') === String(ljSpaceId);
    (isLj ? lj : ext).open++;
  }

  // V37.1.5 — closedTasks já filtrado por date_done > 0 (V37.1.4).
  // Cap por task em TASK_HOURS_CAP=8h pra cortar outliers (task ficou
  // 30 dias em "aguardando aprovação" ainda conta como 8h de trabalho).
  for (const t of closedTasks) {
    const isLj = String(t.space?.id || '') === String(ljSpaceId);
    (isLj ? lj : ext).done++;

    if (t.date_created) {
      const start = Number(t.date_created);
      const end = Number(t.date_done);
      if (Number.isFinite(start) && end > start) {
        const rawHours = (end - start) / 3600000;
        const cappedHours = Math.min(rawHours, TASK_HOURS_CAP);
        closedWithTimestamps.push({ done: end, hours: cappedHours, rawHours });
      }
    }
  }

  for (const t of lateTasks) {
    const isLj = String(t.space?.id || '') === String(ljSpaceId);
    (isLj ? lj : ext).late++;
  }

  closedWithTimestamps.sort((a, b) => b.done - a.done);
  const sample = closedWithTimestamps.slice(0, SAMPLE_TARGET);
  // V37.1.5 — mediana em vez de média aritmética. Estável contra
  // outliers que escapam do cap (caso uma task batido cap consistentemente).
  let avgHours = null;
  if (sample.length >= SAMPLE_MIN) {
    const sortedHours = sample.map(s => s.hours).sort((a, b) => a - b);
    const mid = Math.floor(sortedHours.length / 2);
    avgHours = sortedHours.length % 2 === 0
      ? (sortedHours[mid - 1] + sortedHours[mid]) / 2
      : sortedHours[mid];
  }

  // V37.1.4 — capacity planning sequencial (não usa due_date).
  const taskHours = avgHours != null ? avgHours : DEFAULT_TASK_HOURS_FALLBACK;
  const totalOpen = lj.open + ext.open;
  const { dailyLoad, overflowHours, totalWorkloadHours } = buildSequentialLoad(
    totalOpen, taskHours, horizonDays, journeyHours
  );

  return {
    lj_open: lj.open, lj_done: lj.done, lj_late: lj.late,
    ext_open: ext.open, ext_done: ext.done, ext_late: ext.late,
    late_total: lj.late + ext.late,
    avg_hours: avgHours == null ? null : Math.round(avgHours * 10) / 10,
    task_hours_used: Math.round(taskHours * 10) / 10,
    task_hours_cap: TASK_HOURS_CAP,
    avg_hours_is_fallback: avgHours == null,
    avg_method: 'median_capped',
    sample_size: sample.length,
    closed_returned: closedTasks.length,
    closed_with_timestamps: closedWithTimestamps.length,
    total_workload_hours: totalWorkloadHours,
    overflow_hours: overflowHours,
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
  const horizonDays = buildBusinessHorizon(now, BUSINESS_DAYS_HORIZON);
  const journeyHours = DEFAULT_JOURNEY_HOURS;

  console.log(`[user-tasks-count] iniciando agregação pra ${targetIds.length} pessoa(s) · team=${teamId} · lj_space=${ljSpaceId} · horizonte=${horizonDays.length}d úteis`);

  const results = await Promise.all(targetIds.map(async (uid) => {
    const m = memberById.get(uid);
    const userLabel = m?.name || `User ${uid}`;
    try {
      const [openResult, closedTasks, lateResult] = await Promise.all([
        fetchUserOpenTasks(req.tenantDb, userId, teamId, uid),
        fetchUserClosedTasks(req.tenantDb, userId, teamId, uid),
        fetchUserLateTasks(req.tenantDb, userId, teamId, uid)
      ]);
      const openTasks = openResult.tasks;
      const lateTasks = lateResult.tasks;
      const agg = aggregateForUser(openTasks, closedTasks, lateTasks, ljSpaceId, horizonDays, journeyHours);
      const truncatedFlags = [];
      if (openResult.truncated) truncatedFlags.push('open');
      if (lateResult.truncated) truncatedFlags.push('late');
      console.log(`[user-tasks-count] ${userLabel}: open=${openTasks.length}${openResult.truncated ? '+' : ''} closed=${closedTasks.length}(ts=${agg.closed_with_timestamps}) late=${lateTasks.length}${lateResult.truncated ? '+' : ''} sample=${agg.sample_size} avg=${agg.avg_hours == null ? '—(fallback ' + agg.task_hours_used + 'h)' : agg.avg_hours + 'h'} workload=${agg.total_workload_hours}h overflow=${agg.overflow_hours}h`);
      return {
        user_id: uid,
        name: m?.name || `User ${uid}`,
        email: m?.email || null,
        initials: m?.initials || (m?.name ? m.name.slice(0, 2).toUpperCase() : '??'),
        color: m?.color || null,
        open_truncated: openResult.truncated,
        late_truncated: lateResult.truncated,
        ...agg
      };
    } catch (err) {
      console.error(`[user-tasks-count] ${userLabel}: ERRO ${err.message}`);
      return {
        user_id: uid,
        name: userLabel,
        email: m?.email || null,
        initials: m?.initials || '??',
        color: m?.color || null,
        lj_open: 0, lj_done: 0, lj_late: 0,
        ext_open: 0, ext_done: 0, ext_late: 0,
        late_total: 0,
        avg_hours: null, task_hours_used: DEFAULT_TASK_HOURS_FALLBACK, task_hours_cap: TASK_HOURS_CAP,
        avg_hours_is_fallback: true, avg_method: 'median_capped',
        sample_size: 0, closed_returned: 0, closed_with_timestamps: 0,
        total_workload_hours: 0, overflow_hours: 0,
        open_truncated: false, late_truncated: false,
        daily_load: {},
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
    journey_hours: journeyHours,
    business_days_horizon: BUSINESS_DAYS_HORIZON,
    activity_lookback_days: ACTIVITY_LOOKBACK_DAYS
  });
};
