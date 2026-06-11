// V36.10.3 → V37.1.0 — Tasks Dashboard
// Sub-tab "Tarefas" do Dashboard. Visão executiva AGNÓSTICA de provider
// (ClickUp/Trello/Manual/...) e AGNÓSTICA de campanha.
//
// V37.1.0 — Duas sub-abas internas:
//   • Geral (legado) — stat cards + por provider + top responsáveis
//   • Por Pessoa     — cards individuais com donut LJ% vs Externos %,
//                      média de conclusão, agenda semana atual + próxima.
//                      Privacy: nomes/títulos de tasks externas nunca aparecem.
//                      Endpoint /api/clickup-user-tasks-count (TTL 5min).

window.TasksDashboard = {
  render() {
    const allTasks = window.ExecutionTaskStore ? (ExecutionTaskStore.all() || []) : [];
    if (allTasks.length === 0) {
      return this._emptyState();
    }
    const subTab = App.state.tasksDashboardSubTab || 'geral';
    return `<div class="p-2 lg:p-4 space-y-4">
      ${this._headerWithTabs(allTasks.length, subTab)}
      ${subTab === 'porPessoa' ? this._renderPorPessoa() : this._renderGeral(allTasks)}
    </div>`;
  },

  _headerWithTabs(total, subTab) {
    const tab = (id, label, icon) => `<button onclick="Actions.setTasksDashboardSubTab('${id}')"
      class="px-3 py-1.5 rounded-lg text-[11px] font-black inline-flex items-center gap-1.5 transition ${
        subTab === id
          ? 'bg-violet-600 text-white shadow-sm'
          : 'bg-white hover:bg-violet-50 text-violet-700 border border-violet-200'
      }" ${subTab === id ? 'style="color:#fff!important;"' : ''}>
        <i data-lucide="${icon}" class="w-3 h-3"></i>${label}
      </button>`;
    return `<div class="rounded-3xl bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-200 p-5 shadow-sm">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div class="min-w-0 flex-1">
          <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest mb-1">Visão executiva da execução</p>
          <h2 class="text-2xl font-black text-slate-900">Tarefas</h2>
          <p class="text-[13px] text-stone-700 mt-1">Carga operacional do sistema independente de provider e campanha. ${total} task${total === 1 ? '' : 's'} no total.</p>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          ${tab('geral', 'Geral', 'layout-grid')}
          ${tab('porPessoa', 'Por Pessoa', 'users')}
        </div>
      </div>
    </div>`;
  },

  // ============================================================
  // SUB-TAB GERAL (legado V36.10.3)
  // ============================================================
  _renderGeral(allTasks) {
    const range = App.state.tasksDashboardRange || 'all';
    const provider = App.state.tasksDashboardProvider || 'all';
    const filtered = this._filterTasks(allTasks, range, provider);
    const stats = this._computeStats(filtered);
    const byProvider = this._aggregateByProvider(allTasks);
    const byAssignee = this._aggregateByAssignee(filtered);
    const upcoming = this._upcomingTasks(filtered, 7);
    const topOverdue = this._topOverdueTasks(filtered, 5);

    return `<div class="space-y-4">
      ${this._filters(range, provider, byProvider, allTasks.length, filtered.length)}
      ${this._statCards(stats)}
      ${this._providerDistribution(byProvider)}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        ${this._topAssignees(byAssignee)}
        <div class="space-y-4">
          ${this._upcomingPanel(upcoming)}
          ${this._overduePanel(topOverdue)}
        </div>
      </div>
    </div>`;
  },

  _filters(range, provider, byProvider, total, filtered) {
    const rangeOptions = [
      { id: 'all',     label: 'Todas' },
      { id: '7d',      label: 'Próximos 7 dias' },
      { id: '30d',     label: 'Próximos 30 dias' },
      { id: 'overdue', label: 'Vencidas' }
    ];
    const providerOptions = [
      { id: 'all',     label: 'Todos providers' },
      ...byProvider.map(p => ({ id: p.id, label: this._providerLabel(p.id) }))
    ];
    const escope = filtered === total ? `${total} task${total === 1 ? '' : 's'}` : `${filtered} de ${total}`;
    return `<div class="flex items-center gap-3 flex-wrap">
      <span class="text-[11px] text-stone-600">${escope} no escopo atual</span>
      <label class="inline-flex items-center gap-2">
        <span class="text-[10px] font-black text-stone-600 uppercase tracking-widest">Range</span>
        <select onchange="Actions.setTasksDashboardRange(this.value)" class="px-3 py-2 rounded-lg bg-white border border-stone-300 text-slate-900 text-[12px] font-bold">
          ${rangeOptions.map(o => `<option value="${o.id}" ${range === o.id ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </label>
      <label class="inline-flex items-center gap-2">
        <span class="text-[10px] font-black text-stone-600 uppercase tracking-widest">Provider</span>
        <select onchange="Actions.setTasksDashboardProvider(this.value)" class="px-3 py-2 rounded-lg bg-white border border-stone-300 text-slate-900 text-[12px] font-bold">
          ${providerOptions.map(o => `<option value="${o.id}" ${provider === o.id ? 'selected' : ''}>${o.label}</option>`).join('')}
        </select>
      </label>
    </div>`;
  },

  _statCards(s) {
    const card = (icon, label, value, tone) => `<div class="rounded-xl bg-${tone}-100 border border-${tone}-300 p-3 shadow-sm">
      <div class="flex items-center gap-2 mb-1">
        <span class="w-7 h-7 rounded-lg bg-${tone}-200 grid place-items-center text-${tone}-700"><i data-lucide="${icon}" class="w-3.5 h-3.5"></i></span>
        <p class="text-[9px] font-black text-${tone}-800 uppercase tracking-widest leading-tight">${label}</p>
      </div>
      <p class="text-2xl font-black text-slate-900">${value}</p>
    </div>`;
    return `<div class="grid grid-cols-2 md:grid-cols-5 gap-2">
      ${card('list-checks', 'Total', s.total, 'violet')}
      ${card('clock', 'Em dia', s.onTime, 'sky')}
      ${card('alert-triangle', 'Atrasadas', s.late, 'rose')}
      ${card('check-circle-2', 'Concluídas', s.completed, 'emerald')}
      ${card('user-x', 'Sem resp.', s.noAssignee, 'amber')}
    </div>`;
  },

  _providerDistribution(byProvider) {
    if (byProvider.length === 0) return '';
    return `<div class="rounded-3xl bg-white border border-slate-200 p-4 shadow-sm">
      <p class="text-[11px] font-black text-stone-600 uppercase tracking-widest mb-3 inline-flex items-center gap-1.5">
        <i data-lucide="layers" class="w-3.5 h-3.5"></i> Por provider
      </p>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        ${byProvider.map(p => {
          const isConnected = this._isProviderConnected(p.id);
          const providerName = this._providerLabel(p.id);
          return `<div class="rounded-xl bg-stone-50 border border-stone-200 p-3">
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="text-[11px] font-black text-slate-900 inline-flex items-center gap-1.5">
                <i data-lucide="${this._providerIcon(p.id)}" class="w-3.5 h-3.5 text-stone-600"></i>
                ${Utils.escape(providerName)}
              </span>
              ${isConnected ? `<span class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-700"><i data-lucide="plug" class="w-2.5 h-2.5 inline-block"></i> ON</span>` : ''}
            </div>
            <p class="text-xl font-black text-slate-900">${p.count}</p>
            <p class="text-[10px] text-stone-500">task${p.count === 1 ? '' : 's'}</p>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  _topAssignees(byAssignee) {
    if (byAssignee.length === 0) {
      return `<div class="rounded-3xl bg-white border border-slate-200 p-4 shadow-sm">
        <p class="text-[11px] font-black text-stone-600 uppercase tracking-widest mb-2 inline-flex items-center gap-1.5">
          <i data-lucide="users" class="w-3.5 h-3.5"></i> Top responsáveis
        </p>
        <p class="text-[12px] text-stone-500 italic">Nenhuma task atribuída no escopo atual.</p>
      </div>`;
    }
    const max = Math.max(...byAssignee.map(a => a.count));
    return `<div class="rounded-3xl bg-white border border-slate-200 p-4 shadow-sm">
      <p class="text-[11px] font-black text-stone-600 uppercase tracking-widest mb-3 inline-flex items-center gap-1.5">
        <i data-lucide="users" class="w-3.5 h-3.5"></i> Top responsáveis · ${byAssignee.length}
      </p>
      <div class="space-y-2">
        ${byAssignee.slice(0, 10).map(a => {
          const widthPct = Math.round((a.count / max) * 100);
          const tone = a.isNoAssignee ? 'amber' : (a.count >= max * 0.7 ? 'rose' : a.count >= max * 0.4 ? 'sky' : 'emerald');
          const initial = a.label.charAt(0).toUpperCase();
          return `<div class="rounded-xl bg-stone-50 border border-stone-200 p-3">
            <div class="flex items-center justify-between gap-3 mb-2">
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <span class="shrink-0 w-8 h-8 rounded-lg bg-${tone}-100 border border-${tone}-300 grid place-items-center text-${tone}-800 text-xs font-black">${a.isNoAssignee ? '?' : Utils.escape(initial)}</span>
                <div class="min-w-0">
                  <p class="font-black text-slate-900 text-[12px] truncate" title="${Utils.escape(a.label)}">${Utils.escape(a.label)}</p>
                  ${a.sublabel ? `<p class="text-[10px] text-stone-500 truncate">${Utils.escape(a.sublabel)}</p>` : ''}
                </div>
              </div>
              <div class="flex items-center gap-1 shrink-0">
                ${a.completed > 0 ? `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-800">✓ ${a.completed}</span>` : ''}
                ${a.onTime > 0 ? `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-sky-100 border border-sky-300 text-sky-800">⏱ ${a.onTime}</span>` : ''}
                ${a.late > 0 ? `<span class="text-[10px] font-black px-1.5 py-0.5 rounded bg-rose-100 border border-rose-300 text-rose-800">⚠ ${a.late}</span>` : ''}
                <span class="text-[12px] font-black text-slate-900 whitespace-nowrap ml-1">${a.count}</span>
              </div>
            </div>
            <div class="h-1.5 rounded-full bg-stone-100 overflow-hidden">
              <div class="h-full bg-gradient-to-r from-${tone}-500 to-${tone}-400" style="width:${widthPct}%;"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  _upcomingPanel(tasks) {
    return `<div class="rounded-3xl bg-white border border-slate-200 p-4 shadow-sm">
      <p class="text-[11px] font-black text-stone-600 uppercase tracking-widest mb-3 inline-flex items-center gap-1.5">
        <i data-lucide="calendar-clock" class="w-3.5 h-3.5"></i> Próximas 7 dias · ${tasks.length}
      </p>
      ${tasks.length === 0
        ? '<p class="text-[12px] text-stone-500 italic">Nada nos próximos 7 dias.</p>'
        : `<div class="space-y-1.5">${tasks.map(t => this._taskRow(t, 'upcoming')).join('')}</div>`}
    </div>`;
  },

  _overduePanel(tasks) {
    return `<div class="rounded-3xl bg-white border border-rose-200 p-4 shadow-sm">
      <p class="text-[11px] font-black text-rose-700 uppercase tracking-widest mb-3 inline-flex items-center gap-1.5">
        <i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> Top 5 mais atrasadas · ${tasks.length}
      </p>
      ${tasks.length === 0
        ? '<p class="text-[12px] text-stone-500 italic">Sem tasks atrasadas. 👏</p>'
        : `<div class="space-y-1.5">${tasks.map(t => this._taskRow(t, 'overdue')).join('')}</div>`}
    </div>`;
  },

  _taskRow(task, kind) {
    const dueLabel = task.due_date ? new Date(task.due_date).toLocaleDateString('pt-BR') : '—';
    const now = new Date();
    const due = task.due_date ? new Date(task.due_date) : null;
    let badgeCls, badgeLabel, badgeIcon;
    if (kind === 'overdue' && due) {
      const daysLate = Math.floor((now - due) / (24 * 60 * 60 * 1000));
      badgeCls = 'bg-rose-100 border-rose-300 text-rose-800';
      badgeLabel = `${daysLate}d atraso`;
      badgeIcon = 'alert-triangle';
    } else if (kind === 'upcoming' && due) {
      const daysAhead = Math.floor((due - now) / (24 * 60 * 60 * 1000));
      badgeCls = daysAhead <= 1 ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-sky-100 border-sky-300 text-sky-800';
      badgeLabel = daysAhead <= 0 ? 'hoje' : daysAhead === 1 ? 'amanhã' : `em ${daysAhead}d`;
      badgeIcon = 'clock';
    } else {
      badgeCls = 'bg-stone-100 border-stone-300 text-stone-700';
      badgeLabel = dueLabel;
      badgeIcon = 'calendar';
    }
    const providerName = this._providerLabel(task.provider);
    return `<button onclick="Actions.openExecutionTaskDetail('${task.task_id}')" class="w-full text-left rounded-lg bg-stone-50 hover:bg-stone-100 border border-stone-200 p-2 flex items-center justify-between gap-2 transition">
      <div class="min-w-0 flex-1">
        <p class="text-[12px] font-bold text-slate-900 truncate" title="${Utils.escape(task.title || '')}">${Utils.escape(task.title || 'Task')}</p>
        <p class="text-[10px] text-stone-500 truncate">${Utils.escape(providerName)} · entrega ${dueLabel}</p>
      </div>
      <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${badgeCls} shrink-0">
        <i data-lucide="${badgeIcon}" class="w-2.5 h-2.5"></i>
        ${badgeLabel}
      </span>
    </button>`;
  },

  // ============================================================
  // SUB-TAB POR PESSOA (V37.1.0)
  // ============================================================
  _renderPorPessoa() {
    const cache = App.state.tasksPersonCache || {};
    const horizonDays = Array.isArray(cache.horizonDays) ? cache.horizonDays : [];
    const journeyHours = cache.journeyHours || 8;
    const users = Array.isArray(cache.users) ? cache.users : [];

    if (App.state.clickupStatus?.connected && !cache.fetchedAt && !cache.loading && !cache.error) {
      setTimeout(() => Actions.loadTasksPersonData(), 0);
    }

    if (!App.state.clickupStatus?.connected) {
      return `<div class="rounded-3xl bg-white border border-stone-200 p-8 text-center">
        <i data-lucide="plug-zap" class="w-10 h-10 text-stone-400 mx-auto mb-3"></i>
        <p class="text-[13px] text-stone-700 mb-3">Conecte o ClickUp pra ver carga por pessoa cross-projeto.</p>
        <button onclick="Actions.openSettingsModal(); Actions.setSettingsSection('integrations')" class="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-black inline-flex items-center gap-1.5" style="color:#fff!important;">
          <i data-lucide="settings" class="w-3.5 h-3.5"></i> Configurar ClickUp
        </button>
      </div>`;
    }

    return `<div class="space-y-3">
      ${this._porPessoaHeader(cache, users.length)}
      ${this._porPessoaBody(cache, users, horizonDays, journeyHours)}
    </div>`;
  },

  _porPessoaHeader(cache, userCount) {
    const fetched = cache.fetchedAt ? new Date(cache.fetchedAt) : null;
    const ageMin = fetched ? Math.round((Date.now() - cache.fetchedAt) / 60000) : null;
    const ageLabel = !fetched ? 'Não carregado' :
                     ageMin < 1 ? 'agora mesmo' :
                     ageMin === 1 ? 'há 1 min' : `há ${ageMin} min`;
    return `<div class="flex items-center justify-between gap-3 flex-wrap">
      <p class="text-[11px] text-stone-600 inline-flex items-center gap-1.5">
        <i data-lucide="clock" class="w-3 h-3"></i>
        ${userCount} pessoa${userCount === 1 ? '' : 's'} · atualizado ${ageLabel}
      </p>
      <button onclick="Actions.refreshTasksPersonData()" ${cache.loading ? 'disabled' : ''}
        class="px-3 py-1.5 rounded-lg bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 text-[11px] font-bold inline-flex items-center gap-1.5 ${cache.loading ? 'opacity-50 cursor-wait' : ''}">
        <i data-lucide="${cache.loading ? 'loader-2' : 'refresh-cw'}" class="w-3 h-3 ${cache.loading ? 'animate-spin' : ''}"></i>
        ${cache.loading ? 'Atualizando...' : 'Atualizar'}
      </button>
    </div>`;
  },

  _porPessoaBody(cache, users, horizonDays, journeyHours) {
    if (cache.loading && !users.length) {
      return `<div class="rounded-3xl bg-white border border-stone-200 p-8 text-center">
        <i data-lucide="loader-2" class="w-8 h-8 text-violet-500 mx-auto mb-2 animate-spin"></i>
        <p class="text-[12px] text-stone-600">Puxando tarefas do ClickUp...</p>
      </div>`;
    }
    if (cache.error) {
      return `<div class="rounded-3xl bg-rose-50 border border-rose-200 p-5">
        <p class="text-[11px] font-black text-rose-700 uppercase tracking-widest mb-1">Erro ao carregar</p>
        <p class="text-[12px] text-rose-800">${Utils.escape(cache.error)}</p>
        <button onclick="Actions.refreshTasksPersonData()" class="mt-3 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold inline-flex items-center gap-1.5" style="color:#fff!important;">
          <i data-lucide="refresh-cw" class="w-3 h-3"></i> Tentar novamente
        </button>
      </div>`;
    }
    if (!users.length) {
      return `<div class="rounded-3xl bg-white border border-stone-200 p-8 text-center">
        <i data-lucide="user-x" class="w-10 h-10 text-stone-400 mx-auto mb-3"></i>
        <p class="text-[13px] text-stone-700">Nenhuma pessoa com tarefas LJ atribuídas ainda.</p>
      </div>`;
    }
    return `<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      ${users.map(u => this._personCard(u, horizonDays, journeyHours)).join('')}
    </div>`;
  },

  _personCard(u, horizonDays, journeyHours) {
    const expanded = Boolean(App.state.tasksPersonExpanded?.[u.user_id]);
    const ljTotal = (u.lj_open || 0) + (u.lj_done || 0);
    const extTotal = (u.ext_open || 0) + (u.ext_done || 0);
    const grandTotal = ljTotal + extTotal;
    const ljPct = grandTotal ? Math.round((ljTotal / grandTotal) * 100) : 0;
    const avgLabel = (() => {
      if (u.avg_hours != null) return `${u.avg_hours.toString().replace('.', ',')}h por tarefa`;
      const returned = u.closed_returned || 0;
      const withTs = u.closed_with_timestamps || 0;
      if (returned === 0) return `— sem tarefas concluídas no último ano`;
      if (withTs < 5 && returned >= 5) return `— ${withTs}/${returned} concluídas têm data válida (ClickUp não preencheu)`;
      return `— amostra insuficiente (${withTs}/5)`;
    })();

    const { weekCurrent, weekNext } = this._splitHorizonWeeks(horizonDays);

    return `<div class="rounded-2xl bg-white border border-stone-200 shadow-sm overflow-hidden">
      <button onclick="Actions.toggleTasksPersonExpanded('${u.user_id}')" class="w-full text-left p-4 hover:bg-stone-50 transition flex items-start gap-3">
        <span class="shrink-0 w-10 h-10 rounded-xl grid place-items-center text-white text-[11px] font-black shadow-sm"
          style="background:${u.color || '#7c3aed'};color:#fff!important;">${Utils.escape(u.initials || '??')}</span>
        <div class="min-w-0 flex-1">
          <p class="text-[13px] font-black text-slate-900 truncate" title="${Utils.escape(u.name)}">${Utils.escape(u.name)}</p>
          ${u.email ? `<p class="text-[10px] text-stone-500 truncate">${Utils.escape(u.email)}</p>` : ''}
        </div>
        <i data-lucide="${expanded ? 'chevron-up' : 'chevron-down'}" class="w-4 h-4 text-stone-400 shrink-0 mt-0.5"></i>
      </button>

      <div class="px-4 pb-4 flex items-center gap-4">
        ${this._donutSvg(ljTotal, extTotal, 64, ljPct)}
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-sm shrink-0" style="background:#7c3aed;"></span>
            <span class="text-[11px] font-bold text-slate-900">LeadJourney</span>
            <span class="text-[11px] text-stone-600 ml-auto">${ljTotal}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-sm shrink-0" style="background:#d4d4d8;"></span>
            <span class="text-[11px] font-bold text-slate-900">Outros projetos</span>
            <span class="text-[11px] text-stone-600 ml-auto">${extTotal}</span>
          </div>
          <div class="pt-1.5 border-t border-stone-100 mt-1.5 flex items-end justify-between gap-2">
            <div>
              <p class="text-[10px] text-stone-500 uppercase tracking-wider font-bold">Total ativo</p>
              <p class="text-[14px] font-black text-slate-900">${grandTotal}</p>
            </div>
            ${(u.late_total || 0) > 0 ? `
              <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-100 border border-rose-300 text-rose-800 text-[11px] font-black" title="Tarefas abertas com data de entrega vencida (LJ + externos)">
                <i data-lucide="alert-triangle" class="w-3 h-3"></i>
                ${u.late_total} atrasada${u.late_total === 1 ? '' : 's'}
              </span>
            ` : ''}
          </div>
        </div>
      </div>

      <div class="px-4 pb-4 flex items-center gap-2 text-[11px] text-stone-700 bg-stone-50/50 -mx-px py-2 border-t border-stone-100">
        <i data-lucide="timer" class="w-3 h-3 text-stone-500"></i>
        <span class="font-bold">Média de conclusão:</span>
        <span>${avgLabel}</span>
      </div>

      ${expanded ? `
      <div class="px-4 pb-4 pt-3 space-y-3 border-t border-stone-100 bg-gradient-to-b from-stone-50/50 to-white">
        <p class="text-[10px] font-black text-stone-600 uppercase tracking-widest inline-flex items-center gap-1.5">
          <i data-lucide="calendar-range" class="w-3 h-3"></i>
          Capacidade · jornada ${journeyHours}h/dia
        </p>

        ${weekCurrent.length ? this._weekBlock('Esta semana', weekCurrent, u.daily_load || {}, journeyHours, u.avg_hours || 4) : ''}
        ${weekNext.length ? this._weekBlock('Próxima semana', weekNext, u.daily_load || {}, journeyHours, u.avg_hours || 4) : ''}
      </div>
      ` : ''}
    </div>`;
  },

  _splitHorizonWeeks(horizonDays) {
    if (!horizonDays.length) return { weekCurrent: [], weekNext: [] };
    const today = new Date(horizonDays[0] + 'T00:00:00');
    const dow = today.getDay(); // 0=dom..6=sab
    const daysToSunday = 6 - dow + 1; // dias restantes até segunda da próxima semana
    const weekCurrent = horizonDays.slice(0, daysToSunday);
    const weekNext = horizonDays.slice(daysToSunday, daysToSunday + 7);
    return { weekCurrent, weekNext };
  },

  _weekBlock(label, days, dailyLoad, journeyHours, avgHours) {
    if (!days.length) return '';
    const summary = this._summarizeLoad(days, dailyLoad, journeyHours, avgHours);
    return `<div class="space-y-1.5">
      <p class="text-[10px] font-bold text-stone-700 uppercase tracking-wider">${label}</p>
      <div class="rounded-xl bg-white border border-stone-200 p-2.5">
        ${this._barsSvg(days, dailyLoad, journeyHours)}
      </div>
      ${summary ? `<p class="text-[11px] text-stone-700 leading-snug pl-0.5">${summary}</p>` : ''}
    </div>`;
  },

  _donutSvg(ljCount, extCount, size, ljPct) {
    const total = ljCount + extCount;
    const r = 22;
    const c = size / 2;
    const circumference = 2 * Math.PI * r;
    if (total === 0) {
      return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="shrink-0">
        <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#e7e5e4" stroke-width="7" />
        <text x="${c}" y="${c+1}" text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="900" fill="#a8a29e">—</text>
      </svg>`;
    }
    const ljArc = circumference * (ljCount / total);
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="shrink-0">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#d4d4d8" stroke-width="7" />
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#7c3aed" stroke-width="7"
        stroke-dasharray="${ljArc.toFixed(2)} ${circumference.toFixed(2)}"
        stroke-linecap="round"
        transform="rotate(-90 ${c} ${c})" />
      <text x="${c}" y="${c+1}" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="900" fill="#0f172a">${ljPct}%</text>
    </svg>`;
  },

  _barsSvg(days, dailyLoad, journeyHours) {
    const barH = 56;
    const barW = 22;
    const gap = 6;
    const labelH = 14;
    const totalW = (barW + gap) * days.length - gap;
    const totalH = barH + labelH + 2;
    const dayLabels = ['D','S','T','Q','Q','S','S'];
    const bars = days.map((d, i) => {
      const date = new Date(d + 'T00:00:00');
      const hours = dailyLoad[d] || 0;
      const ratio = hours / journeyHours;
      const fillRatio = Math.min(ratio, 1);
      const barFillH = fillRatio * barH;
      let color;
      if (ratio > 1) color = '#fb7185';
      else if (ratio >= 0.6) color = '#fbbf24';
      else if (ratio >= 0.05) color = '#34d399';
      else color = '#e7e5e4';
      const cap = ratio > 1
        ? `<rect x="0" y="0" width="${barW}" height="3" fill="#be123c" rx="1.5" />`
        : '';
      const dowIdx = date.getDay();
      const labelColor = (dowIdx === 0 || dowIdx === 6) ? '#a8a29e' : '#57534e';
      return `<g transform="translate(${i * (barW + gap)}, 0)">
        <rect x="0" y="0" width="${barW}" height="${barH}" fill="#f5f5f4" rx="4" />
        <rect x="0" y="${barH - barFillH}" width="${barW}" height="${barFillH}" fill="${color}" rx="4">
          <title>${date.toLocaleDateString('pt-BR')} · ${hours.toString().replace('.', ',')}h (${Math.round(ratio*100)}%)</title>
        </rect>
        ${cap}
        <text x="${barW/2}" y="${barH + labelH - 2}" text-anchor="middle" font-size="9" font-weight="700" fill="${labelColor}">${dayLabels[dowIdx]}</text>
      </g>`;
    }).join('');
    return `<svg width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">${bars}</svg>`;
  },

  _summarizeLoad(days, dailyLoad, journeyHours, avgHours) {
    const dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    const taskUnit = avgHours > 0 ? avgHours : 4;
    const buckets = days.map(d => {
      const hours = dailyLoad[d] || 0;
      const ratio = hours / journeyHours;
      let level;
      if (ratio >= 1) level = 'full';
      else if (ratio >= 0.6) level = 'high';
      else if (ratio >= 0.3) level = 'mid';
      else level = 'free';
      const date = new Date(d + 'T00:00:00');
      return { day: d, label: dayNames[date.getDay()], hours, ratio, level };
    });
    const groups = [];
    for (const b of buckets) {
      const last = groups[groups.length - 1];
      if (last && last.level === b.level) {
        last.endLabel = b.label;
        last.endRatio = b.ratio;
        last.endHours = b.hours;
      } else {
        groups.push({ level: b.level, startLabel: b.label, endLabel: b.label, startRatio: b.ratio, endRatio: b.ratio, startHours: b.hours, endHours: b.hours });
      }
    }
    const phraseFor = (g) => {
      const range = (g.startLabel === g.endLabel) ? g.startLabel : `${g.startLabel}–${g.endLabel}`;
      if (g.level === 'full') {
        return `<span class="font-bold text-rose-700">${range}</span> sem espaço`;
      }
      if (g.level === 'high') {
        const fits = Math.max(0, Math.floor((journeyHours - g.startHours) / taskUnit));
        const fitsLabel = fits > 0 ? ` (cabe ~${fits} tarefa${fits === 1 ? '' : 's'})` : '';
        return `<span class="font-bold text-amber-700">${range}</span> ${Math.round(g.startRatio*100)}%${fitsLabel}`;
      }
      if (g.level === 'mid') {
        return `<span class="font-bold text-emerald-700">${range}</span> ${Math.round(g.startRatio*100)}%`;
      }
      return `<span class="font-bold text-emerald-700">${range}</span> livre${range.includes('–') ? 's' : ''}`;
    };
    return groups.map(phraseFor).join(' · ');
  },

  _emptyState() {
    return `<div class="p-2 lg:p-4">
      <div class="rounded-3xl bg-gradient-to-br from-violet-50 to-fuchsia-50 border border-violet-200 p-8 text-center shadow-sm">
        <div class="w-16 h-16 mx-auto rounded-2xl bg-violet-100 grid place-items-center mb-3">
          <i data-lucide="list-checks" class="w-8 h-8 text-violet-700"></i>
        </div>
        <h2 class="text-xl font-black text-slate-900 mb-2">Sem tarefas ainda</h2>
        <p class="text-[13px] text-stone-700 mb-4 max-w-xl mx-auto">
          Conecte um provider operacional (ClickUp, Trello, etc.) em Integrações OU crie tasks pelo Mapa → Etapa 4 → Executar Ação. Quando rodarem, aparecem aqui agregadas.
        </p>
        <div class="flex items-center justify-center gap-2 flex-wrap">
          <button onclick="Actions.openSettingsModal(); Actions.setSettingsSection('integrations')" class="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-black inline-flex items-center gap-1.5" style="color:#fff!important;">
            <i data-lucide="plug" class="w-3.5 h-3.5"></i> Configurar provider
          </button>
          <button onclick="Actions.setView && Actions.setView('strategy')" class="px-4 py-2 rounded-xl bg-white hover:bg-stone-50 border border-stone-300 text-slate-900 text-[12px] font-black inline-flex items-center gap-1.5">
            <i data-lucide="map" class="w-3.5 h-3.5"></i> Abrir Mapa da Receita
          </button>
        </div>
      </div>
    </div>`;
  },

  // ========== Helpers de agregação ==========

  _filterTasks(tasks, range, provider) {
    const now = new Date();
    return tasks.filter(t => {
      if (provider !== 'all' && t.provider !== provider) return false;
      if (range === 'all') return true;
      const due = t.due_date ? new Date(t.due_date) : null;
      const isCompleted = t.status === 'completed';
      if (range === 'overdue') return !isCompleted && due && due < now;
      if (range === '7d') {
        if (!due) return false;
        const diff = (due - now) / (24 * 60 * 60 * 1000);
        return diff >= -1 && diff <= 7;
      }
      if (range === '30d') {
        if (!due) return false;
        const diff = (due - now) / (24 * 60 * 60 * 1000);
        return diff >= -1 && diff <= 30;
      }
      return true;
    });
  },

  _computeStats(tasks) {
    const now = new Date();
    let onTime = 0, late = 0, completed = 0, noAssignee = 0;
    tasks.forEach(t => {
      const due = t.due_date ? new Date(t.due_date) : null;
      const isCompleted = t.status === 'completed';
      if (isCompleted) completed++;
      else if (due && due < now) late++;
      else if (due) onTime++;
      if (!Array.isArray(t.assignees) || t.assignees.length === 0) noAssignee++;
    });
    return { total: tasks.length, onTime, late, completed, noAssignee };
  },

  _aggregateByProvider(tasks) {
    const map = new Map();
    tasks.forEach(t => {
      const p = t.provider || 'manual';
      map.set(p, (map.get(p) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count);
  },

  _aggregateByAssignee(tasks) {
    const now = new Date();
    const map = new Map();
    const noAssignee = { isNoAssignee: true, label: 'Sem responsável', sublabel: 'Tasks órfãs — atribua alguém', count: 0, completed: 0, late: 0, onTime: 0 };
    tasks.forEach(t => {
      const isCompleted = t.status === 'completed';
      const due = t.due_date ? new Date(t.due_date) : null;
      const isLate = !isCompleted && due && due < now;
      const isOnTime = !isCompleted && !isLate;
      const assignees = Array.isArray(t.assignees) ? t.assignees : [];
      if (assignees.length === 0) {
        noAssignee.count++;
        if (isCompleted) noAssignee.completed++;
        else if (isLate) noAssignee.late++;
        else if (isOnTime) noAssignee.onTime++;
      } else {
        assignees.forEach(aid => {
          const key = String(aid);
          if (!map.has(key)) map.set(key, { userId: key, count: 0, completed: 0, late: 0, onTime: 0 });
          const b = map.get(key);
          b.count++;
          if (isCompleted) b.completed++;
          else if (isLate) b.late++;
          else if (isOnTime) b.onTime++;
        });
      }
    });
    const members = App.state.clickupMeta?.members || [];
    const entries = Array.from(map.values()).map(b => {
      const m = members.find(mem => String(mem.id) === b.userId);
      return {
        ...b,
        isNoAssignee: false,
        label: m?.username || `User ${b.userId}`,
        sublabel: m?.email || ''
      };
    });
    entries.sort((a, b) => b.count - a.count);
    if (noAssignee.count > 0) entries.push(noAssignee);
    return entries;
  },

  _upcomingTasks(tasks, days) {
    const now = new Date();
    const horizon = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return tasks
      .filter(t => t.status !== 'completed' && t.due_date)
      .filter(t => {
        const due = new Date(t.due_date);
        return due >= now && due <= horizon;
      })
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
      .slice(0, 8);
  },

  _topOverdueTasks(tasks, n) {
    const now = new Date();
    return tasks
      .filter(t => t.status !== 'completed' && t.due_date)
      .filter(t => new Date(t.due_date) < now)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
      .slice(0, n);
  },

  _providerLabel(id) {
    const labels = { clickup: 'ClickUp', trello: 'Trello', monday: 'Monday', jira: 'Jira', notion: 'Notion', manual: 'Manual' };
    return labels[id] || id;
  },

  _providerIcon(id) {
    const icons = { clickup: 'check-square', trello: 'trello', monday: 'calendar', jira: 'shield', notion: 'book-open', manual: 'list' };
    return icons[id] || 'briefcase';
  },

  _isProviderConnected(id) {
    if (id === 'manual') return true;
    if (id === 'clickup') return Boolean(App.state.clickupStatus?.connected);
    const cfg = window.ExecutionProviderRegistry?.getProviderConfig?.(id);
    return Boolean(cfg?.connected);
  }
};
