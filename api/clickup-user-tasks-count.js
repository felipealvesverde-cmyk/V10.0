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
const { resolveCredentialOwnerId } = require('../lib/credentials-owner');

const MAX_PAGES_OPEN = 6;              // 600 open max top-level
const MAX_PAGES_CLOSED = 3;            // 300 closed max
const MAX_PAGES_LATE = 5;              // 500 late max
const ACTIVITY_LOOKBACK_DAYS = 30;     // V37.1.6 — só tasks mexidas/fechadas nos últimos 30d
const SAMPLE_MIN = 5;                  // mínimo de done_count pra calcular avg
const BUSINESS_DAYS_HORIZON = 10;      // 2 semanas úteis (Seg-Sex × 2)
const DEFAULT_JOURNEY_HOURS = 8;
const DEFAULT_TASK_HOURS_FALLBACK = 4;
// V37.1.8 — avg_hours agora é capacity_derived:
//   horas úteis disponíveis no lookback ÷ tarefas concluídas no lookback
// Não usa mais (date_done - date_created) que media idade calendário.

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

// V37.1.8 — conta dias úteis (Seg-Sex) num range. Usado pra calcular
// horas úteis disponíveis no lookback: business_days × 8h.
function countBusinessDaysBetween(startMs, endMs) {
  const start = new Date(startMs);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endMs);
  end.setHours(0, 0, 0, 0);
  let count = 0;
  const d = new Date(start);
  let guard = 0;
  while (d <= end && guard < 366) {
    if (isWeekday(d)) count++;
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return count;
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

// V37.2.0 — distribui tasks por [start_date, due_date] em dias úteis.
// Cada task aloca taskHours uniforme nos dias úteis do intervalo total.
// Tasks atrasadas (due < hoje) jogam taskHours inteiro no dia de hoje.
// Tasks sem ambas datas: ignoradas (contam pra workload_no_dates_count).
// Overflow honesto: dias podem passar de journeyHours (sobreposição é vista).
function buildDistributedLoad(openTasks, taskHours, horizonDays, journeyHours, todayStr) {
  const out = Object.fromEntries(horizonDays.map(d => [d, 0]));
  const horizonEnd = horizonDays[horizonDays.length - 1];
  let totalWorkload = 0;
  let allocatedInHorizon = 0;
  let tasksWithoutDates = 0;
  let tasksLate = 0;
  let tasksScheduled = 0;
  let tasksOutsideHorizon = 0;

  const fmtDay = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  for (const t of openTasks) {
    const start = Number(t.start_date) || null;
    const due = Number(t.due_date) || null;
    if (!start || !due) { tasksWithoutDates++; continue; }
    totalWorkload += taskHours;

    const dueDate = new Date(due);
    const dueKey = fmtDay(dueDate);

    // Atrasada: due < hoje → tudo no dia de hoje
    if (dueKey < todayStr) {
      out[todayStr] = (out[todayStr] || 0) + taskHours;
      allocatedInHorizon += taskHours;
      tasksLate++;
      continue;
    }

    const startDate = new Date(start);
    const startKey = fmtDay(startDate);

    // Task completamente além do horizonte
    if (startKey > horizonEnd) { tasksOutsideHorizon++; continue; }

    // Calcula dias úteis NO INTERVALO TOTAL [start, due] — não só os do horizonte.
    // Pra task de 10 dias úteis, hoursPerDay = taskHours / 10. Aloca só os que
    // caem no horizonte; o resto vira overflow.
    const fullRangeStart = new Date(Math.max(start, Date.now() - 90 * 24 * 3600 * 1000));
    const fullRangeStartKey = fmtDay(fullRangeStart);
    const effectiveStart = fullRangeStartKey < todayStr ? todayStr : fullRangeStartKey;
    const businessDaysInFullRange = countBusinessDaysBetween(Date.parse(effectiveStart + 'T00:00:00'), due);
    if (businessDaysInFullRange < 1) continue;

    const hoursPerDay = taskHours / businessDaysInFullRange;
    let allocatedHere = 0;
    for (const d of horizonDays) {
      if (d < effectiveStart) continue;
      if (d > dueKey) break;
      out[d] = (out[d] || 0) + hoursPerDay;
      allocatedHere += hoursPerDay;
    }
    allocatedInHorizon += allocatedHere;
    tasksScheduled++;
  }

  for (const k of Object.keys(out)) out[k] = Math.round(out[k] * 10) / 10;

  return {
    dailyLoad: out,
    overflowHours: Math.max(0, Math.round((totalWorkload - allocatedInHorizon) * 10) / 10),
    totalWorkloadHours: Math.round(totalWorkload * 10) / 10,
    tasksScheduled,
    tasksLate,
    tasksWithoutDates,
    tasksOutsideHorizon
  };
}

// V37.2.0 — Adherence (% no prazo + deriva média em dias úteis).
function computeAdherence(closedTasks) {
  const withDue = closedTasks.filter(t => Number(t.due_date) > 0 && Number(t.date_done) > 0);
  if (!withDue.length) return { adherence_pct: null, deriva_avg_days: null, on_time_count: 0, late_done_count: 0, evaluated_count: 0 };
  let onTime = 0;
  let derivaSum = 0;
  for (const t of withDue) {
    const due = Number(t.due_date);
    const done = Number(t.date_done);
    if (done <= due) onTime++;
    derivaSum += (done - due) / (24 * 3600 * 1000);
  }
  return {
    adherence_pct: Math.round((onTime / withDue.length) * 100),
    deriva_avg_days: Math.round((derivaSum / withDue.length) * 10) / 10,
    on_time_count: onTime,
    late_done_count: withDue.length - onTime,
    evaluated_count: withDue.length
  };
}

// V37.2.0 — Próxima entrega: due_date mais próximo a partir de hoje.
function computeNextDelivery(openTasks, todayStr) {
  const fmtDay = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };
  let minDue = null;
  let count = 0;
  for (const t of openTasks) {
    const due = Number(t.due_date);
    if (!due) continue;
    const dueKey = fmtDay(new Date(due));
    if (dueKey < todayStr) continue;
    if (minDue == null || dueKey < minDue) {
      minDue = dueKey;
      count = 1;
    } else if (dueKey === minDue) {
      count++;
    }
  }
  return minDue ? { date: minDue, count } : null;
}

function aggregateForUser(openTasks, closedTasks, lateTasks, ljSpaceId, horizonDays, journeyHours, availableHoursInLookback) {
  const lj = { open: 0, done: 0, late: 0 };
  const ext = { open: 0, done: 0, late: 0 };

  // V37.1.9 — breakdown por folder (produto LJ) e list (campanha LJ).
  // Folder hidden true = "folderless list" — agrupa como "Sem produto".
  const byFolder = new Map();  // folder_id → { folder_name, count }
  const byList = new Map();    // list_id → { list_name, folder_id, folder_name, count }

  for (const t of openTasks) {
    const isLj = String(t.space?.id || '') === String(ljSpaceId);
    (isLj ? lj : ext).open++;

    if (isLj) {
      const folderId = String(t.folder?.id || '');
      const folderHidden = Boolean(t.folder?.hidden);
      const folderName = folderHidden ? null : (t.folder?.name || null);
      const listId = String(t.list?.id || '');
      const listName = t.list?.name || null;

      if (folderId && folderName && !folderHidden) {
        if (!byFolder.has(folderId)) byFolder.set(folderId, { folder_id: folderId, folder_name: folderName, count: 0 });
        byFolder.get(folderId).count++;
      }

      if (listId && listName) {
        if (!byList.has(listId)) {
          byList.set(listId, {
            list_id: listId,
            list_name: listName,
            folder_id: folderHidden ? null : (folderId || null),
            folder_name: folderName,
            count: 0
          });
        }
        byList.get(listId).count++;
      }
    }
  }

  for (const t of closedTasks) {
    const isLj = String(t.space?.id || '') === String(ljSpaceId);
    (isLj ? lj : ext).done++;
  }

  for (const t of lateTasks) {
    const isLj = String(t.space?.id || '') === String(ljSpaceId);
    (isLj ? lj : ext).late++;
  }

  const byLjFolder = Array.from(byFolder.values()).sort((a, b) => b.count - a.count);
  const byLjList = Array.from(byList.values()).sort((a, b) => b.count - a.count);

  // V37.1.8 — capacity_derived: horas úteis no lookback ÷ tarefas concluídas
  // no lookback. Não mede mais idade calendário da task — mede a cadência
  // REAL da pessoa no período. Realista por construção.
  const doneTotal = lj.done + ext.done;
  let avgHours = null;
  if (doneTotal >= SAMPLE_MIN) {
    avgHours = availableHoursInLookback / doneTotal;
  }

  const taskHours = avgHours != null ? avgHours : DEFAULT_TASK_HOURS_FALLBACK;
  const todayStr = horizonDays[0];

  // V37.2.0 — distribuição real por [start_date, due_date]
  const dist = buildDistributedLoad(openTasks, taskHours, horizonDays, journeyHours, todayStr);

  // Slots livres: soma de horas disponíveis em cada dia do horizonte
  let freeHoursTotal = 0;
  let nextFreeDay = null;
  let nextFreeDayHours = 0;
  for (const d of horizonDays) {
    const occupied = dist.dailyLoad[d] || 0;
    const free = Math.max(0, journeyHours - occupied);
    freeHoursTotal += free;
    if (free > 0 && nextFreeDay == null) {
      nextFreeDay = d;
      nextFreeDayHours = Math.round(free * 10) / 10;
    }
  }
  freeHoursTotal = Math.round(freeHoursTotal * 10) / 10;

  // V37.2.0 — adherence sobre closed com due preenchido
  const adherence = computeAdherence(closedTasks);

  // V37.2.0 — próxima entrega (open tasks ordenadas por due_date >= hoje)
  const nextDelivery = computeNextDelivery(openTasks, todayStr);

  return {
    lj_open: lj.open, lj_done: lj.done, lj_late: lj.late,
    ext_open: ext.open, ext_done: ext.done, ext_late: ext.late,
    late_total: lj.late + ext.late,
    avg_hours: avgHours == null ? null : Math.round(avgHours * 10) / 10,
    task_hours_used: Math.round(taskHours * 10) / 10,
    avg_hours_is_fallback: avgHours == null,
    avg_method: 'capacity_derived',
    done_count: doneTotal,
    available_hours_in_lookback: availableHoursInLookback,
    sample_size: doneTotal,
    closed_returned: closedTasks.length,
    total_workload_hours: dist.totalWorkloadHours,
    overflow_hours: dist.overflowHours,
    daily_load: dist.dailyLoad,
    tasks_scheduled: dist.tasksScheduled,
    tasks_late: dist.tasksLate,
    tasks_without_dates: dist.tasksWithoutDates,
    tasks_outside_horizon: dist.tasksOutsideHorizon,
    free_hours_total: freeHoursTotal,
    next_free_day: nextFreeDay,
    next_free_day_hours: nextFreeDayHours,
    horizon_capacity_hours: horizonDays.length * journeyHours,
    next_delivery: nextDelivery,
    adherence_pct: adherence.adherence_pct,
    deriva_avg_days: adherence.deriva_avg_days,
    on_time_count: adherence.on_time_count,
    late_done_count: adherence.late_done_count,
    adherence_evaluated_count: adherence.evaluated_count,
    by_lj_folder: byLjFolder,
    by_lj_list: byLjList
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, message: 'Use POST.' });
  if (!req.user) return res.status(401).json({ ok: false, message: 'Não autenticado.' });
  if (!req.tenantDb) return res.status(503).json({ ok: false, message: 'Banco não configurado.' });

  const userId = await resolveCredentialOwnerId(req);

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

  // V37.1.8 — calcula horas úteis disponíveis no lookback period (30 dias).
  // Será base do avg_hours (capacity_derived): available / done_count.
  const lookbackStartMs = Date.now() - (ACTIVITY_LOOKBACK_DAYS * 24 * 3600 * 1000);
  const businessDaysInLookback = countBusinessDaysBetween(lookbackStartMs, Date.now() - 24 * 3600 * 1000);
  const availableHoursInLookback = businessDaysInLookback * journeyHours;

  console.log(`[user-tasks-count] iniciando agregação pra ${targetIds.length} pessoa(s) · team=${teamId} · lj_space=${ljSpaceId} · horizonte=${horizonDays.length}d úteis · lookback=${businessDaysInLookback}d úteis (${availableHoursInLookback}h disponíveis)`);

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
      const agg = aggregateForUser(openTasks, closedTasks, lateTasks, ljSpaceId, horizonDays, journeyHours, availableHoursInLookback);
      console.log(`[user-tasks-count] ${userLabel}: open=${openTasks.length}${openResult.truncated ? '+' : ''} done=${agg.done_count} late=${lateTasks.length}${lateResult.truncated ? '+' : ''} avg=${agg.avg_hours == null ? '—(fallback ' + agg.task_hours_used + 'h)' : agg.avg_hours + 'h'} sched=${agg.tasks_scheduled} no_dates=${agg.tasks_without_dates} workload=${agg.total_workload_hours}h overflow=${agg.overflow_hours}h free=${agg.free_hours_total}h adherence=${agg.adherence_pct == null ? '—' : agg.adherence_pct + '%'} deriva=${agg.deriva_avg_days == null ? '—' : agg.deriva_avg_days + 'd'} next=${agg.next_delivery ? agg.next_delivery.date + '(' + agg.next_delivery.count + ')' : '—'}`);
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
        avg_hours: null, task_hours_used: DEFAULT_TASK_HOURS_FALLBACK,
        avg_hours_is_fallback: true, avg_method: 'capacity_derived',
        done_count: 0, available_hours_in_lookback: availableHoursInLookback,
        sample_size: 0, closed_returned: 0,
        total_workload_hours: 0, overflow_hours: 0,
        open_truncated: false, late_truncated: false,
        daily_load: {}, by_lj_folder: [], by_lj_list: [],
        tasks_scheduled: 0, tasks_late: 0, tasks_without_dates: 0, tasks_outside_horizon: 0,
        free_hours_total: 0, next_free_day: null, next_free_day_hours: 0,
        horizon_capacity_hours: horizonDays.length * journeyHours,
        next_delivery: null,
        adherence_pct: null, deriva_avg_days: null, on_time_count: 0, late_done_count: 0,
        adherence_evaluated_count: 0,
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
    journey_hours: journeyHours,
    business_days_horizon: BUSINESS_DAYS_HORIZON,
    activity_lookback_days: ACTIVITY_LOOKBACK_DAYS
  });
};
