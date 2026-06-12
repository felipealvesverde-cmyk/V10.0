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
      ${App.state.tasksPersonModalUserId ? this._personModal() : ''}
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
    return `<div class="space-y-2">
      <div class="flex items-center justify-between gap-3 flex-wrap">
        <p class="text-[11px] text-stone-600 inline-flex items-center gap-1.5">
          <i data-lucide="clock" class="w-3 h-3"></i>
          ${userCount} pessoa${userCount === 1 ? '' : 's'} · atualizado ${ageLabel}
        </p>
        <button onclick="Actions.refreshTasksPersonData()" ${cache.loading ? 'disabled' : ''}
          class="px-3 py-1.5 rounded-lg bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 text-[11px] font-bold inline-flex items-center gap-1.5 ${cache.loading ? 'opacity-50 cursor-wait' : ''}">
          <i data-lucide="${cache.loading ? 'loader-2' : 'refresh-cw'}" class="w-3 h-3 ${cache.loading ? 'animate-spin' : ''}"></i>
          ${cache.loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>
      <p class="text-[10px] text-stone-500 inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-stone-100 border border-stone-200 w-fit">
        <i data-lucide="filter" class="w-2.5 h-2.5"></i>
        Considera apenas tarefas mexidas ou concluídas nos últimos 30 dias (tasks zumbi ficam fora)
      </p>
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
    // V37.1.9 — Card simplificado: visão sintética + click anywhere → modal.
    const ljActive = u.lj_open || 0;
    const extActive = u.ext_open || 0;
    const grandTotal = ljActive + extActive;
    const ljPct = grandTotal ? Math.round((ljActive / grandTotal) * 100) : 0;
    const doneTotal = (u.lj_done || 0) + (u.ext_done || 0);
    const avgLabel = this._avgLabelFor(u);

    return `<div onclick="Actions.openTasksPersonModal('${u.user_id}')"
        class="rounded-2xl bg-white border border-stone-200 shadow-sm overflow-hidden cursor-pointer hover:border-violet-300 hover:shadow-md transition">
      <div class="p-4 flex items-start gap-3">
        <span class="shrink-0 w-10 h-10 rounded-xl grid place-items-center text-white text-[11px] font-black shadow-sm"
          style="background:${u.color || '#7c3aed'};color:#fff!important;">${Utils.escape(u.initials || '??')}</span>
        <div class="min-w-0 flex-1">
          <p class="text-[13px] font-black text-slate-900 truncate" title="${Utils.escape(u.name)}">${Utils.escape(u.name)}</p>
          ${u.email ? `<p class="text-[10px] text-stone-500 truncate">${Utils.escape(u.email)}</p>` : ''}
        </div>
        <i data-lucide="chevron-right" class="w-4 h-4 text-stone-400 shrink-0 mt-0.5"></i>
      </div>

      <div class="px-4 pb-4 flex items-center gap-4">
        ${this._donutSvg(ljActive, extActive, 64, ljPct)}
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-sm shrink-0" style="background:#7c3aed;"></span>
            <span class="text-[11px] font-bold text-slate-900">LeadJourney</span>
            <span class="text-[11px] text-stone-600 ml-auto">${ljActive}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-sm shrink-0" style="background:#d4d4d8;"></span>
            <span class="text-[11px] font-bold text-slate-900">Outros projetos</span>
            <span class="text-[11px] text-stone-600 ml-auto">${extActive}</span>
          </div>
          <div class="pt-1.5 border-t border-stone-100 mt-1.5 flex items-end justify-between gap-2">
            <div>
              <p class="text-[10px] text-stone-500 uppercase tracking-wider font-bold">Total ativo</p>
              <p class="text-[14px] font-black text-slate-900">${grandTotal}${u.open_truncated ? '+' : ''}</p>
            </div>
            ${(u.late_total || 0) > 0 ? `
              <span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-100 border border-rose-300 text-rose-800 text-[11px] font-black">
                <i data-lucide="alert-triangle" class="w-3 h-3"></i>
                ${u.late_total}${u.late_truncated ? '+' : ''} atrasada${u.late_total === 1 && !u.late_truncated ? '' : 's'}
              </span>
            ` : ''}
          </div>
          ${doneTotal > 0 ? `
            <div class="flex items-center gap-1.5 pt-1">
              <i data-lucide="check-circle-2" class="w-3 h-3 text-emerald-600 shrink-0"></i>
              <span class="text-[10px] text-stone-600">
                <span class="font-bold text-emerald-700">${doneTotal}</span>
                concluída${doneTotal === 1 ? '' : 's'} nos últimos 30 dias
              </span>
            </div>
          ` : ''}
          ${u.next_delivery ? (() => {
            const nd = u.next_delivery;
            const ndDate = new Date(nd.date + 'T00:00:00');
            const today = new Date(); today.setHours(0,0,0,0);
            const daysAhead = Math.round((ndDate - today) / (24 * 3600 * 1000));
            const urgent = daysAhead <= 3;
            const tone = urgent ? 'amber' : 'sky';
            const daysLabel = daysAhead <= 0 ? 'hoje' : daysAhead === 1 ? 'amanhã' : `em ${daysAhead}d`;
            const dateLabel = ndDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
            return `
              <div class="flex items-center gap-1.5 pt-1">
                <i data-lucide="calendar" class="w-3 h-3 text-${tone}-600 shrink-0"></i>
                <span class="text-[10px] text-stone-600">
                  Próxima entrega <span class="font-bold text-${tone}-700">${dateLabel}</span>
                  <span class="text-stone-500">(${daysLabel}${nd.count > 1 ? ` · ${nd.count} tasks` : ''})</span>
                </span>
              </div>
            `;
          })() : ''}
        </div>
      </div>

      <div class="px-4 pb-4 flex items-center gap-2 text-[11px] text-stone-700 bg-stone-50/50 -mx-px py-2 border-t border-stone-100">
        <i data-lucide="timer" class="w-3 h-3 text-stone-500"></i>
        <span class="font-bold">Média de conclusão:</span>
        <span>${avgLabel}</span>
      </div>
    </div>`;
  },

  // V37.1.9 — helper compartilhado (card e modal usam o mesmo cálculo).
  _avgLabelFor(u) {
    if (u.avg_hours != null) return `${u.avg_hours.toString().replace('.', ',')}h por tarefa`;
    const doneCount = u.done_count || 0;
    if (doneCount === 0) return `— sem tarefas concluídas no período`;
    return `— amostra pequena (${doneCount}/5 concluídas)`;
  },

  // V37.1.9 — Modal central de detalhe da pessoa. Click fora fecha.
  _personModal() {
    const userId = App.state.tasksPersonModalUserId;
    const cache = App.state.tasksPersonCache || {};
    const u = (cache.users || []).find(x => String(x.user_id) === String(userId));
    if (!u) {
      return `<div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm grid place-items-center p-4"
          onclick="Actions.closeTasksPersonModal()">
        <div class="rounded-2xl bg-white p-6" onclick="event.stopPropagation()">
          <p class="text-sm text-stone-600">Pessoa não encontrada. <button onclick="Actions.closeTasksPersonModal()" class="text-violet-600 font-bold">Fechar</button></p>
        </div>
      </div>`;
    }
    const horizonDays = Array.isArray(cache.horizonDays) ? cache.horizonDays : [];
    const journeyHours = cache.journeyHours || 8;
    const ljActive = u.lj_open || 0;
    const extActive = u.ext_open || 0;
    const grandTotal = ljActive + extActive;
    const ljPct = grandTotal ? Math.round((ljActive / grandTotal) * 100) : 0;
    const doneTotal = (u.lj_done || 0) + (u.ext_done || 0);
    const avgLabel = this._avgLabelFor(u);
    const { weekCurrent, weekNext, pastInCurrentWeek } = this._splitHorizonWeeks(horizonDays);
    const taskUnit = u.task_hours_used || u.avg_hours || 4;

    return `<div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm grid place-items-center p-4"
        onclick="Actions.closeTasksPersonModal()">
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
           onclick="event.stopPropagation()">

        <div class="flex items-start gap-4 p-6 border-b border-stone-200">
          <span class="shrink-0 w-14 h-14 rounded-2xl grid place-items-center text-white text-[14px] font-black shadow-sm"
            style="background:${u.color || '#7c3aed'};color:#fff!important;">${Utils.escape(u.initials || '??')}</span>
          <div class="min-w-0 flex-1">
            <h2 class="text-xl font-black text-slate-900 truncate">${Utils.escape(u.name)}</h2>
            ${u.email ? `<p class="text-[12px] text-stone-500 truncate">${Utils.escape(u.email)}</p>` : ''}
          </div>
          <button onclick="Actions.closeTasksPersonModal()" class="w-9 h-9 rounded-lg hover:bg-stone-100 grid place-items-center text-stone-600 transition">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 p-6 bg-stone-50 border-b border-stone-200">
          ${this._modalKpiCard('Pendentes', `${grandTotal}${u.open_truncated ? '+' : ''}`, 'list-checks', 'violet', `${ljActive} LJ · ${extActive} externos`)}
          ${this._modalKpiCard('Concluídas (30d)', String(doneTotal), 'check-circle-2', 'emerald', 'Histórico do mês')}
          ${this._modalKpiCard('Atrasadas', `${u.late_total || 0}${u.late_truncated ? '+' : ''}`, 'alert-triangle', 'rose', 'Vencidas e abertas')}
          ${this._modalKpiCard('Média por tarefa', avgLabel.startsWith('—') ? '—' : avgLabel.split(' ')[0], 'timer', 'sky', u.avg_hours != null && u.done_count ? `${u.available_hours_in_lookback}h ÷ ${u.done_count}` : 'Amostra pequena')}
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 overflow-y-auto flex-1">

          <section class="space-y-3">
            <div class="flex items-center justify-between gap-2 flex-wrap">
              <h3 class="text-[11px] font-black text-stone-700 uppercase tracking-widest inline-flex items-center gap-1.5">
                <i data-lucide="calendar-range" class="w-3.5 h-3.5 text-violet-600"></i>
                Capacidade · jornada ${journeyHours}h/dia
              </h3>
              <div class="flex items-center gap-2">
                ${u.total_workload_hours > 0 ? `
                  <span class="text-[10px] text-stone-700 font-bold inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100" title="Total da fila distribuída: ${u.total_workload_hours}h">
                    <i data-lucide="briefcase" class="w-2.5 h-2.5"></i>${u.total_workload_hours.toString().replace('.', ',')}h fila
                  </span>
                ` : ''}
                ${(u.free_hours_total || 0) > 0 ? `
                  <span class="text-[10px] text-emerald-800 font-bold inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200" title="Soma de slots livres em todos os dias úteis do horizonte">
                    <i data-lucide="circle-dot" class="w-2.5 h-2.5"></i>${u.free_hours_total.toString().replace('.', ',')}h livres
                  </span>
                ` : ''}
              </div>
            </div>
            ${(() => {
              // V37.2.4 — Contador inclui scheduled + late + outsideHorizon (todos
              // com datas) + withoutDates. Total bate com grandTotal (Pendentes).
              const scheduled = u.tasks_scheduled || 0;
              const late = u.tasks_late || 0;
              const outsideHorizon = u.tasks_outside_horizon || 0;
              const withoutDates = u.tasks_without_dates || 0;
              const withDates = scheduled + late + outsideHorizon;
              const totalConsidered = withDates + withoutDates;
              if (totalConsidered === 0) return '';
              const pctWithDates = Math.round((withDates / totalConsidered) * 100);
              const isPartial = pctWithDates < 60;
              const toneCls = isPartial ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-stone-50 border-stone-200 text-stone-700';
              return `
                <div class="rounded-lg ${toneCls} border px-2.5 py-1.5 flex items-center gap-2">
                  <i data-lucide="${isPartial ? 'alert-circle' : 'info'}" class="w-3.5 h-3.5 shrink-0"></i>
                  <p class="text-[10px] leading-snug">
                    <span class="font-black">${withDates} de ${totalConsidered}</span> tarefas abertas têm início + entrega preenchidos
                    ${isPartial ? `· <span class="font-bold">empilhamento parcial</span> (${pctWithDates}%)` : ''}
                  </p>
                </div>
              `;
            })()}
            ${(() => {
              // V37.2.4 — Placeholder só aparece quando NENHUMA task tem ambas
              // datas: scheduled + late + outsideHorizon = 0. Antes só checava
              // scheduled — perdia o caso de 1 atrasada que joga carga em HOJE.
              const tasksWithDates = (u.tasks_scheduled || 0) + (u.tasks_late || 0) + (u.tasks_outside_horizon || 0);
              if (tasksWithDates === 0) {
                return `
                  <div class="rounded-xl bg-stone-50 border border-stone-200 p-5 text-center">
                    <div class="w-12 h-12 mx-auto rounded-2xl bg-white border border-stone-200 grid place-items-center mb-2">
                      <i data-lucide="calendar-x" class="w-6 h-6 text-stone-400"></i>
                    </div>
                    <p class="text-[12px] font-black text-slate-900 mb-1">Nenhuma tarefa com agenda</p>
                    <p class="text-[11px] text-stone-600 leading-relaxed max-w-xs mx-auto">
                      Pra ver capacidade visualizada por dia, preencha <span class="font-bold">data de início</span> e
                      <span class="font-bold">data de entrega</span> nas tarefas do ClickUp.
                    </p>
                  </div>
                `;
              }
              const composition = this._computeComposition(u);
              const todayKey = (() => {
                const t = new Date();
                const y = t.getFullYear(), m = String(t.getMonth() + 1).padStart(2, '0'), d = String(t.getDate()).padStart(2, '0');
                return `${y}-${m}-${d}`;
              })();
              // V37.2.0 — escala compartilhada pelas 2 semanas pra comparabilidade.
              const allDayKeys = [...weekCurrent, ...weekNext];
              const maxHours = allDayKeys.reduce((m, d) => Math.max(m, (u.daily_load || {})[d] || 0), 0);
              const scaleMaxRatio = Math.max(1, maxHours / journeyHours);
              return `
                ${weekCurrent.length ? this._weekBlock('Esta semana', weekCurrent, u.daily_load || {}, journeyHours, taskUnit, composition, todayKey, scaleMaxRatio, pastInCurrentWeek) : ''}
                ${weekNext.length ? this._weekBlock('Próxima semana', weekNext, u.daily_load || {}, journeyHours, taskUnit, composition, todayKey, scaleMaxRatio, []) : ''}
                ${composition.length ? `
                  <div class="flex items-center gap-2 flex-wrap text-[9px] text-stone-600 pt-1">
                    ${composition.map(s => `<span class="inline-flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm" style="background:${s.color}"></span>${Utils.escape(s.label)} ${Math.round(s.fraction*100)}%</span>`).join('')}
                  </div>
                ` : ''}
              `;
            })()}
            ${u.next_free_day ? (() => {
              const fd = new Date(u.next_free_day + 'T00:00:00');
              const today = new Date(); today.setHours(0,0,0,0);
              const isToday = fd.getTime() === today.getTime();
              const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
              const isTomorrow = fd.getTime() === tomorrow.getTime();
              const dateFull = fd.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
              const dateLabel = isToday ? `Ainda hoje (${dateFull})` : isTomorrow ? `Amanhã (${dateFull})` : dateFull;
              return `
                <div class="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 flex items-center gap-2">
                  <i data-lucide="calendar-check" class="w-4 h-4 text-emerald-600 shrink-0"></i>
                  <p class="text-[11px] text-emerald-800">
                    Próximo slot livre: <span class="font-black">${dateLabel}</span>
                    <span class="text-emerald-700 text-[10px]">(${u.next_free_day_hours.toString().replace('.', ',')}h disponíveis)</span>
                  </p>
                </div>
              `;
            })() : ''}
            ${u.overflow_hours > 0 ? `
              <div class="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2.5 flex items-center gap-2">
                <i data-lucide="alert-octagon" class="w-4 h-4 text-rose-600 shrink-0"></i>
                <p class="text-[12px] text-rose-800">
                  <span class="font-black">+${u.overflow_hours.toString().replace('.', ',')}h</span>
                  em backlog além das 2 semanas úteis
                  <span class="text-rose-600 text-[10px]">(~${Math.ceil(u.overflow_hours / journeyHours)} dias úteis extras)</span>
                </p>
              </div>
            ` : ''}
            ${(u.tasks_without_dates || 0) > 0 ? `
              <div class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 flex items-center gap-2">
                <i data-lucide="calendar-x" class="w-4 h-4 text-amber-600 shrink-0"></i>
                <p class="text-[11px] text-amber-800">
                  <span class="font-bold">${u.tasks_without_dates}</span> tarefa${u.tasks_without_dates === 1 ? '' : 's'} sem data de início ou entrega — fora do empilhamento.
                </p>
              </div>
            ` : ''}
            ${this._adherenceBlock(u)}
          </section>

          <section class="space-y-3">
            <h3 class="text-[11px] font-black text-stone-700 uppercase tracking-widest inline-flex items-center gap-1.5">
              <i data-lucide="layout-grid" class="w-3.5 h-3.5 text-violet-600"></i>
              Dedicação LJ por contexto
            </h3>
            ${this._dedicationBlock(u)}
          </section>

        </div>

      </div>
    </div>`;
  },

  // V37.2.0 — Bloco Aderência ao prazo (% no prazo + deriva média).
  // Renderiza só se houve closed tasks COM due_date preenchido (evaluated_count >= 1).
  _adherenceBlock(u) {
    const evaluated = u.adherence_evaluated_count || 0;
    if (evaluated < 1 || u.adherence_pct == null) {
      return '';
    }
    const pct = u.adherence_pct;
    const tone = pct >= 80 ? 'emerald' : pct >= 50 ? 'amber' : 'rose';
    const deriva = u.deriva_avg_days;
    const derivaLabel = deriva == null ? '—' :
                       deriva <= 0 ? `${Math.abs(deriva).toString().replace('.', ',')}d antes` :
                       `+${deriva.toString().replace('.', ',')}d depois`;
    const derivaTone = deriva == null ? 'stone' : deriva <= 0 ? 'emerald' : deriva <= 2 ? 'amber' : 'rose';
    return `<div class="rounded-xl bg-white border border-stone-200 p-3 space-y-2 mt-2">
      <div class="flex items-center justify-between gap-2">
        <h4 class="text-[10px] font-black text-stone-700 uppercase tracking-widest inline-flex items-center gap-1.5">
          <i data-lucide="target" class="w-3 h-3 text-violet-600"></i>
          Aderência ao prazo
          <span class="text-stone-500 normal-case tracking-normal text-[10px] font-normal ml-1">(${evaluated} fechadas com due_date)</span>
        </h4>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-lg bg-${tone}-50 border border-${tone}-200 p-2.5">
          <p class="text-[9px] font-black text-${tone}-800 uppercase tracking-widest">No prazo</p>
          <p class="text-xl font-black text-slate-900 mt-0.5">${pct}%</p>
          <p class="text-[10px] text-stone-600 mt-0.5">${u.on_time_count} de ${evaluated} fechadas</p>
        </div>
        <div class="rounded-lg bg-${derivaTone}-50 border border-${derivaTone}-200 p-2.5">
          <p class="text-[9px] font-black text-${derivaTone}-800 uppercase tracking-widest">Deriva média</p>
          <p class="text-xl font-black text-slate-900 mt-0.5">${derivaLabel}</p>
          <p class="text-[10px] text-stone-600 mt-0.5">do prazo previsto</p>
        </div>
      </div>
    </div>`;
  },

  _modalKpiCard(label, value, icon, tone, sub) {
    return `<div class="rounded-xl bg-white border border-${tone}-200 shadow-sm p-3">
      <div class="flex items-center gap-2 mb-1">
        <span class="w-7 h-7 rounded-lg bg-${tone}-100 border border-${tone}-200 grid place-items-center text-${tone}-700">
          <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
        </span>
        <p class="text-[9px] font-black text-${tone}-800 uppercase tracking-widest leading-tight">${label}</p>
      </div>
      <p class="text-2xl font-black text-slate-900">${value}</p>
      ${sub ? `<p class="text-[10px] text-stone-500 mt-0.5">${Utils.escape(sub)}</p>` : ''}
    </div>`;
  },

  _dedicationBlock(u) {
    const byList = Array.isArray(u.by_lj_list) ? u.by_lj_list : [];
    const extOpen = u.ext_open || 0;
    const ljOpen = u.lj_open || 0;
    if (byList.length === 0 && extOpen === 0) {
      return `<p class="text-[12px] text-stone-500 italic">Nenhuma tarefa pendente.</p>`;
    }
    // V37.2.1 — Mensagem clara quando 100% das ativas estão fora do LJ.
    if (ljOpen === 0 && extOpen > 0) {
      return `<div class="rounded-xl bg-stone-50 border border-stone-200 p-4 flex items-start gap-3">
        <span class="shrink-0 w-9 h-9 rounded-lg bg-white border border-stone-300 grid place-items-center text-stone-500">
          <i data-lucide="moon" class="w-4 h-4"></i>
        </span>
        <div>
          <p class="text-[12px] font-black text-slate-900">Esta pessoa não tem tarefas LJ ativas</p>
          <p class="text-[11px] text-stone-600 mt-0.5">Toda a carga atual está em outros projetos do workspace ClickUp (<span class="font-bold">${extOpen}</span> tarefa${extOpen === 1 ? '' : 's'} fora do espaço LJ).</p>
        </div>
      </div>`;
    }
    const maxCount = Math.max(...byList.map(l => l.count), extOpen, 1);
    // Agrupa por folder_name (produto). Folderless = "Sem produto".
    const groups = new Map();
    for (const item of byList) {
      const key = item.folder_name || '__folderless__';
      if (!groups.has(key)) groups.set(key, { folder_name: item.folder_name, lists: [] });
      groups.get(key).lists.push(item);
    }
    const groupArr = Array.from(groups.values()).sort((a, b) => {
      const ca = a.lists.reduce((s, l) => s + l.count, 0);
      const cb = b.lists.reduce((s, l) => s + l.count, 0);
      return cb - ca;
    });

    // V37.1.10 — cor por folder (consistência com barras de capacidade).
    const renderItem = (label, count, isMain, color) => {
      const pct = Math.round((count / maxCount) * 100);
      return `<div class="flex items-center gap-2 ${isMain ? 'mt-2' : 'pl-3'}">
        <span class="w-2.5 h-2.5 rounded-sm shrink-0" style="background:${color}"></span>
        <span class="text-[11px] ${isMain ? 'font-black text-slate-900' : 'text-slate-700'} truncate flex-1" title="${Utils.escape(label)}">${Utils.escape(label)}</span>
        <span class="text-[11px] font-bold text-slate-900 tabular-nums">${count}</span>
        <div class="w-20 h-1.5 rounded-full bg-stone-100 overflow-hidden shrink-0">
          <div class="h-full" style="width:${pct}%;background:${color};"></div>
        </div>
      </div>`;
    };

    return `<div class="rounded-xl bg-white border border-stone-200 p-3 space-y-1">
      ${groupArr.map(g => {
        const folderTotal = g.lists.reduce((s, l) => s + l.count, 0);
        const folderLabel = g.folder_name || 'Sem produto (folderless)';
        const folderColor = this._colorForFolder(g.folder_name || folderLabel);
        return `
          ${renderItem(folderLabel, folderTotal, true, folderColor)}
          ${g.lists.map(l => renderItem(l.list_name, l.count, false, folderColor)).join('')}
        `;
      }).join('')}
      ${extOpen > 0 ? `
        <div class="pt-2 mt-2 border-t border-stone-100">
          ${renderItem('Outros projetos (fora do LJ)', extOpen, true, this._EXT_COLOR)}
        </div>
      ` : ''}
    </div>`;
  },

  _splitHorizonWeeks(horizonDays) {
    // V37.1.4 — horizonte é só dias úteis. Split por semana ISO.
    // V37.1.10 — weekNext limitado a 5 dias úteis (Seg-Sex). Excedente
    // vira backlog (já reportado pelo badge overflow_hours).
    if (!horizonDays.length) return { weekCurrent: [], weekNext: [] };
    const firstDay = new Date(horizonDays[0] + 'T00:00:00');
    const dow = firstDay.getDay() || 7;
    const monday = new Date(firstDay);
    monday.setDate(firstDay.getDate() - (dow - 1));
    const sundayKey = (() => {
      const s = new Date(monday);
      s.setDate(monday.getDate() + 6);
      const y = s.getFullYear();
      const m = String(s.getMonth() + 1).padStart(2, '0');
      const d = String(s.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    })();
    const weekCurrent = horizonDays.filter(d => d <= sundayKey);
    const weekNext = horizonDays.filter(d => d > sundayKey).slice(0, 5);
    return { weekCurrent, weekNext };
  },

  // V37.1.10 — Palette por produto LJ. Cor derivada do nome do folder
  // (deterministic hash). Externos sempre cinza zinc-400.
  _LJ_PALETTE: [
    '#F472B6', '#00CBCC', '#6BBEF9', '#F6DB5C', '#AB3ED8',
    '#FB923C', '#34D399', '#F87171', '#A78BFA', '#22D3EE'
  ],
  _EXT_COLOR: '#a1a1aa',

  _colorForFolder(name) {
    if (!name) return '#94a3b8';
    let h = 0;
    const s = String(name);
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return this._LJ_PALETTE[Math.abs(h) % this._LJ_PALETTE.length];
  },

  _computeComposition(u) {
    // Agrupa by_lj_list por folder_name (1 segmento por produto LJ).
    // Adiciona externos como segmento final (cinza). Soma das fractions = 1.
    const ljOpen = u.lj_open || 0;
    const extOpen = u.ext_open || 0;
    const totalOpen = ljOpen + extOpen;
    if (totalOpen === 0) return [];

    const segments = [];
    const groups = new Map();
    for (const item of (u.by_lj_list || [])) {
      const key = item.folder_name || '__folderless__';
      if (!groups.has(key)) groups.set(key, { name: item.folder_name, count: 0 });
      groups.get(key).count += item.count;
    }
    Array.from(groups.values()).sort((a, b) => b.count - a.count).forEach(g => {
      segments.push({
        label: g.name || 'Sem produto LJ',
        fraction: g.count / totalOpen,
        color: this._colorForFolder(g.name || g.label)
      });
    });
    if (extOpen > 0) {
      segments.push({
        label: 'Outros projetos',
        fraction: extOpen / totalOpen,
        color: this._EXT_COLOR
      });
    }
    return segments;
  },

  _weekBlock(label, days, dailyLoad, journeyHours, avgHours, composition, todayKey, scaleMaxRatio, pastDays) {
    if (!days.length) return '';
    // V37.2.3 — summary só sobre dias ativos (não passados).
    const pastArr = Array.isArray(pastDays) ? pastDays : [];
    const activeDays = days.filter(d => !pastArr.includes(d));
    const summary = this._summarizeLoad(activeDays, dailyLoad, journeyHours, avgHours);
    return `<div class="space-y-1.5">
      <p class="text-[10px] font-bold text-stone-700 uppercase tracking-wider">${label}</p>
      <div class="rounded-xl bg-white border border-stone-200 p-3">
        ${this._barsSvg(days, dailyLoad, journeyHours, composition, todayKey, scaleMaxRatio, pastDays)}
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

  _barsSvg(days, dailyLoad, journeyHours, composition, todayKey, scaleMaxRatio, pastDays) {
    // V37.2.0 — escala dinâmica. V37.2.3 — pastDays apagados + livres tracejado verde.
    const barH = 72;
    const barW = 36;
    const gap = 10;
    const labelH = 14;
    const todayH = 12;
    const totalW = (barW + gap) * days.length - gap;
    const totalH = barH + labelH + todayH + 4;
    const dayLabels = { 1: 'Se', 2: 'Te', 3: 'Qa', 4: 'Qi', 5: 'Sx' };
    const fmtNum = (n) => (Math.round(n * 10) / 10).toString().replace('.', ',');
    const segs = Array.isArray(composition) && composition.length ? composition : [{ color: '#d4d4d8', fraction: 1, label: 'Sem composição' }];
    const yToday = todayKey || null;
    const scaleMax = Math.max(1, scaleMaxRatio || 1);
    const pastSet = new Set(Array.isArray(pastDays) ? pastDays : []);

    const bars = days.map((d, i) => {
      const date = new Date(d + 'T00:00:00');
      const dowIdx = date.getDay();
      const label = dayLabels[dowIdx] || '';
      const isPast = pastSet.has(d);

      // V37.2.3 — Dia passado: render apagado, sem composição, sem %.
      if (isPast) {
        const tooltipPast = `${date.toLocaleDateString('pt-BR')} · já passou`;
        return `<g transform="translate(${i * (barW + gap)}, 0)" opacity="0.4">
          <rect x="0" y="0" width="${barW}" height="${barH}" fill="#f5f5f4" rx="4">
            <title>${tooltipPast}</title>
          </rect>
          <text x="${barW/2}" y="${barH + labelH - 2}" text-anchor="middle" font-size="9" font-weight="600" fill="#a8a29e">${label}</text>
        </g>`;
      }

      const hours = dailyLoad[d] || 0;
      const free = Math.max(0, journeyHours - hours);
      const ratio = journeyHours > 0 ? hours / journeyHours : 0;
      const fillRatio = Math.min(ratio, scaleMax);
      const barFillH = (fillRatio / scaleMax) * barH;
      const isToday = yToday && d === yToday;
      const isOverflow = ratio > 1;
      const isFree = hours === 0;

      const todayMark = isToday ? `<text x="${barW/2}" y="${barH + labelH + todayH - 1}" text-anchor="middle" font-size="8" font-weight="900" fill="#7c3aed">HOJE</text>` : '';
      const borderRect = isToday ? `<rect x="-1.5" y="-1.5" width="${barW + 3}" height="${barH + 3}" fill="none" stroke="#7c3aed" stroke-width="1.5" rx="5" />` : '';

      // V37.2.3 — Dia livre (hours=0): borda tracejada emerald + "Livre" no centro.
      if (isFree) {
        const tooltipFree = `${date.toLocaleDateString('pt-BR')} · livre (${journeyHours}h disponíveis pra agendamento)`;
        return `<g transform="translate(${i * (barW + gap)}, 0)">
          ${borderRect}
          <rect x="0" y="0" width="${barW}" height="${barH}" fill="rgba(16, 185, 129, 0.06)" stroke="#34d399" stroke-width="1.4" stroke-dasharray="4,3" rx="4">
            <title>${tooltipFree}</title>
          </rect>
          <text x="${barW/2}" y="${barH/2 + 3}" text-anchor="middle" font-size="9" font-weight="700" fill="#059669">Livre</text>
          <text x="${barW/2}" y="${barH + labelH - 2}" text-anchor="middle" font-size="9" font-weight="700" fill="#57534e">${label}</text>
          ${todayMark}
        </g>`;
      }

      const pctLabel = Math.round(ratio * 100) + '%';
      const tooltip = `${date.toLocaleDateString('pt-BR')} · ${fmtNum(hours)}h ocupadas · ${fmtNum(free)}h disponíveis${isOverflow ? ' · sobrecarga' : ''}`;

      let yCursor = barH;
      const segRects = segs.map(seg => {
        const segH = barFillH * seg.fraction;
        yCursor -= segH;
        return `<rect x="0" y="${yCursor.toFixed(2)}" width="${barW}" height="${segH.toFixed(2)}" fill="${seg.color}"><title>${tooltip} — ${Utils.escape(seg.label)}: ${Math.round(seg.fraction*100)}%</title></rect>`;
      }).join('');

      const guideYInBar = barH - (1 / scaleMax) * barH;
      const overflowOverlay = isOverflow ? `<rect x="0" y="${(barH - barFillH).toFixed(2)}" width="${barW}" height="${(guideYInBar - (barH - barFillH)).toFixed(2)}" fill="rgba(190, 18, 60, 0.35)" />` : '';

      const pctY = barFillH >= 18 ? (barH - barFillH + 11) : (barH - barFillH - 4);
      const pctFill = barFillH >= 18 ? 'rgba(255,255,255,0.92)' : '#57534e';
      const pctWeight = barFillH >= 18 ? '900' : '800';

      return `<g transform="translate(${i * (barW + gap)}, 0)">
        ${borderRect}
        <rect x="0" y="0" width="${barW}" height="${barH}" fill="#f5f5f4" rx="4">
          <title>${tooltip}</title>
        </rect>
        <g clip-path="inset(0 round 4px)">
          ${segRects}
          ${overflowOverlay}
        </g>
        <text x="${barW/2}" y="${pctY}" text-anchor="middle" font-size="9" font-weight="${pctWeight}" fill="${pctFill}">${pctLabel}</text>
        <text x="${barW/2}" y="${barH + labelH - 2}" text-anchor="middle" font-size="9" font-weight="700" fill="#57534e">${label}</text>
        ${todayMark}
      </g>`;
    }).join('');

    // Linha guia da jornada (8h). Posicionada pela escala — abaixo do topo quando há sobrecarga.
    const guideY = barH - (1 / scaleMax) * barH;
    const guideLine = `<line x1="-4" y1="${guideY.toFixed(2)}" x2="${totalW + 4}" y2="${guideY.toFixed(2)}" stroke="#7c3aed" stroke-width="1" stroke-dasharray="3,3" opacity="0.55" />`;
    const guideLabel = scaleMax > 1 ? `<text x="${totalW + 6}" y="${(guideY + 3).toFixed(2)}" font-size="8" font-weight="700" fill="#7c3aed" opacity="0.8">${journeyHours}h</text>` : '';

    // V37.2.2 — viewBox com padding pra borda HOJE (1.5px acima e ao redor).
    return `<svg width="${totalW + 28}" height="${totalH + 6}" viewBox="-6 -4 ${totalW + 28} ${totalH + 6}">${guideLine}${guideLabel}${bars}</svg>`;
  },

  _summarizeLoad(days, dailyLoad, journeyHours, avgHours) {
    // V37.1.4 — Só dias úteis. Labels 3 letras pra resumo textual.
    const dayNames = { 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex' };
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
      return { day: d, label: dayNames[date.getDay()] || '?', hours, ratio, level };
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
