// V35.3.7 — Lead Import Wizard (4 steps).
//
// Substitui o modal único antigo. Flow:
//   Step 1 — Upload (arquivo OU colar texto)
//   Step 2 — Mapear (tabela com auto-mapping heurístico)
//   Step 3 — Revisar (stats + dedup preview por regra de volume)
//   Step 4 — Importar (progress + relatório + alerta sininho)

window.LeadImportWizard = {
  // Campos LJ disponíveis pra mapear
  _LJ_FIELDS: [
    { value: 'skip',          label: 'Pular' },
    { value: 'email',         label: 'Email' },
    { value: 'name',          label: 'Nome' },
    { value: 'phone',         label: 'Telefone' },
    { value: 'idade',         label: 'Idade' },
    { value: 'estado',        label: 'Estado' },
    { value: 'cidade',        label: 'Cidade' },
    { value: 'estadoCivil',   label: 'Estado civil' },
    { value: 'sexo',          label: 'Sexo' },
    { value: 'faixaSalarial', label: 'Faixa salarial' },
    { value: 'tags',          label: 'Tags' }
  ],

  render() {
    const w = App.state.leadImportWizard;
    const wizardHtml = (w && w.open) ? `<div class="fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto"
                onclick="if(event.target===this) Actions.closeLeadImportModal()">
      <section class="bg-white rounded-3xl shadow-2xl border border-white/20 max-w-4xl w-full mt-6 overflow-hidden">
        ${this._header(w)}
        ${this._stepper(w)}
        <main class="p-5 lg:p-6 max-h-[70vh] overflow-y-auto">
          ${w.step === 1 ? this._step1Upload(w) : ''}
          ${w.step === 2 ? this._step2Map(w)    : ''}
          ${w.step === 3 ? this._step3Review(w) : ''}
          ${w.step === 4 ? this._step4Import(w) : ''}
        </main>
      </section>
    </div>` : '';
    const reportsHtml = App.state.importReportsModalOpen ? this._reportsModal() : '';
    return wizardHtml + reportsHtml;
  },

  // V35.3.8 — Modal de Notificações: 2 seções (Atualizações do LJ + Imports).
  // Aberto pelo sininho da Home. Ao abrir, marca releases como vistas.
  _reportsModal() {
    const reports = App.state.leadImportReports || [];
    const unseenReleases = window.Actions?._getUnseenReleases?.() || [];
    const allReleases = window.LJChangelog || [];
    // V35.9.3 — Modal de notificações com 2 abas: Atualizações + Alertas.
    const alerts = window.Actions?._getNotificationAlerts?.() || [];
    const tab = App.state.notificationsTab || (alerts.length ? 'alerts' : 'updates');
    const updatesCount = unseenReleases.length + reports.length;

    return `<div class="fixed inset-0 z-[75] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto"
              onclick="if(event.target===this) Actions.closeImportReportsModal()">
      <section class="bg-white rounded-3xl shadow-2xl border border-white/20 max-w-2xl w-full mt-6 overflow-hidden">
        <header class="bg-slate-950 text-white p-5 flex items-start justify-between gap-3" style="color:#fff;">
          <div>
            <p class="text-[10px] font-black text-violet-300 uppercase tracking-widest mb-1">
              <i data-lucide="bell" class="w-3 h-3 inline"></i> Notificações
            </p>
            <h2 class="text-xl font-black">${tab === 'alerts' ? 'Pontos de atenção' : 'Tudo que rolou'}</h2>
            <p class="text-[12px] text-slate-300 mt-1">${alerts.length} alerta(s) · ${updatesCount} atualização(ões)</p>
          </div>
          <button onclick="Actions.closeImportReportsModal()" class="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 grid place-items-center" style="color:#fff;">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </header>

        <!-- ABAS -->
        <nav class="flex border-b border-slate-200 bg-slate-50">
          <button onclick="Actions.setNotificationsTab('updates')"
            class="flex-1 px-5 py-3 text-xs font-black uppercase tracking-widest transition border-b-2 ${tab === 'updates' ? 'border-violet-600 text-violet-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'}">
            <i data-lucide="sparkles" class="w-3 h-3 inline mr-1"></i> Atualizações
            ${updatesCount > 0 && tab !== 'updates' ? `<span class="ml-1.5 text-[9px] font-black bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">${updatesCount}</span>` : ''}
          </button>
          <button onclick="Actions.setNotificationsTab('alerts')"
            class="flex-1 px-5 py-3 text-xs font-black uppercase tracking-widest transition border-b-2 ${tab === 'alerts' ? 'border-rose-600 text-rose-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100'}">
            <i data-lucide="alert-circle" class="w-3 h-3 inline mr-1"></i> Alertas
            ${alerts.length > 0 && tab !== 'alerts' ? `<span class="ml-1.5 text-[9px] font-black bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">${alerts.length}</span>` : ''}
          </button>
        </nav>

        <main class="p-5 max-h-[55vh] overflow-y-auto space-y-5">
          ${tab === 'alerts'
            ? this._alertsSection(alerts)
            : `${this._releasesSection(allReleases, unseenReleases)}
               ${this._importReportsSection(reports)}`}
        </main>

        ${tab === 'updates' && reports.length > 0 ? `<footer class="border-t border-slate-200 p-3 flex justify-end">
          <button onclick="Actions.clearImportReports()" class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-black text-slate-700">Limpar histórico de imports</button>
        </footer>` : ''}
      </section>
    </div>`;
  },

  // V35.9.3 — Seção de alertas (pontos de atenção). Cada alerta tem
  // título + descrição + (opcional) botão pra resolver.
  // V35.11.0 — severity ('warning'|'critical') controla cor:
  //   warning = amber (1-9 falhas RD, "atenção")
  //   critical = rose (10+ falhas RD, ads órfãs, reconciliação RD pendente)
  _alertsSection(alerts) {
    if (!alerts.length) {
      return `<div class="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-center">
        <i data-lucide="check-circle-2" class="w-10 h-10 text-emerald-600 mx-auto mb-2"></i>
        <p class="text-sm font-black text-emerald-900">Sem pontos de atenção agora.</p>
        <p class="text-[12px] text-emerald-700 mt-1">Quando algo precisar de você, aparece aqui.</p>
      </div>`;
    }
    const palette = {
      warning: { border: 'border-amber-200', bg: 'bg-amber-50/60', iconBg: 'bg-amber-100', iconBorder: 'border-amber-200', iconColor: 'text-amber-700', title: 'text-amber-900', desc: 'text-amber-800/80', btnBg: 'bg-amber-600 hover:bg-amber-700' },
      critical: { border: 'border-rose-200', bg: 'bg-rose-50/60', iconBg: 'bg-rose-100', iconBorder: 'border-rose-200', iconColor: 'text-rose-700', title: 'text-rose-900', desc: 'text-rose-800/80', btnBg: 'bg-rose-600 hover:bg-rose-700' }
    };
    return `<div class="space-y-2">
      ${alerts.map(a => {
        const p = palette[a.severity === 'warning' ? 'warning' : 'critical'];
        return `<div class="rounded-2xl border ${p.border} ${p.bg} p-3">
          <div class="flex items-start gap-3">
            <span class="shrink-0 w-9 h-9 rounded-xl ${p.iconBg} border ${p.iconBorder} grid place-items-center ${p.iconColor}">
              <i data-lucide="${a.icon}" class="w-4 h-4"></i>
            </span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-black ${p.title}">${Utils.escape(a.title)}</p>
              ${a.description ? `<p class="text-[12px] ${p.desc} mt-0.5 leading-relaxed">${Utils.escape(a.description)}</p>` : ''}
            </div>
          </div>
          ${a.action ? `<div class="mt-3 flex justify-end">
            <button onclick="Actions.closeImportReportsModal(); ${a.action}" class="px-3 py-1.5 rounded-xl ${p.btnBg} text-white text-[11px] font-black inline-flex items-center gap-1.5" style="color:#fff;">
              <i data-lucide="arrow-right" class="w-3 h-3"></i> ${Utils.escape(a.actionLabel || 'Resolver')}
            </button>
          </div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  },

  _releasesSection(all, unseen) {
    if (!all.length) return '';
    const unseenSet = new Set(unseen.map(r => r.version));
    return `<div>
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="sparkles" class="w-4 h-4 text-violet-600"></i>
        <h3 class="text-sm font-black text-slate-900 uppercase tracking-widest">Atualizações do LJ</h3>
        ${unseen.length > 0 ? `<span class="text-[10px] font-black bg-violet-100 text-violet-800 px-2 py-0.5 rounded-full">${unseen.length} nova(s)</span>` : ''}
      </div>
      <div class="space-y-2">
        ${all.slice(0, 20).map(r => {
          const isNew = unseenSet.has(r.version);
          return `<div class="rounded-2xl border-2 ${isNew ? 'border-violet-300 bg-violet-50' : 'border-slate-200 bg-slate-50'} p-3">
            <div class="flex items-start justify-between gap-2 mb-1.5">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-[10px] font-black ${isNew ? 'text-violet-700' : 'text-slate-500'} font-mono">${Utils.escape(r.version)}</span>
                  ${isNew ? '<span class="text-[9px] font-black bg-violet-600 text-white px-1.5 py-0.5 rounded-full" style="color:#fff;">NOVO</span>' : ''}
                  <span class="text-[10px] text-slate-500">${Utils.escape(r.date)}</span>
                </div>
                <p class="text-sm font-black text-slate-900">${Utils.escape(r.title)}</p>
              </div>
            </div>
            ${r.bullets && r.bullets.length ? `<ul class="text-xs text-slate-700 space-y-0.5 mt-2 ml-1">
              ${r.bullets.map(b => `<li class="flex items-start gap-1.5"><span class="text-violet-500 mt-1">•</span><span>${Utils.escape(b)}</span></li>`).join('')}
            </ul>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  _importReportsSection(reports) {
    return `<div>
      <div class="flex items-center gap-2 mb-3">
        <i data-lucide="file-up" class="w-4 h-4 text-emerald-600"></i>
        <h3 class="text-sm font-black text-slate-900 uppercase tracking-widest">Importações de leads</h3>
        ${reports.length > 0 ? `<span class="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">${reports.length} recente(s)</span>` : ''}
      </div>
      <div class="space-y-2">
        ${reports.length === 0
          ? `<p class="text-center text-xs text-slate-500 italic py-4">Sem relatórios ainda. Eles aparecem aqui sempre que você importa leads.</p>`
          : reports.map(r => `<div class="rounded-2xl border border-slate-200 p-3 bg-slate-50">
              <div class="flex items-center justify-between gap-2 mb-2">
                <p class="text-[11px] font-black text-slate-700">${new Date(r.when).toLocaleString('pt-BR')}</p>
                ${r.error ? '<span class="text-[10px] font-black text-rose-700">Erro</span>' : '<span class="text-[10px] font-black text-emerald-700">✓ Concluído</span>'}
              </div>
              ${r.error
                ? `<p class="text-xs text-rose-700">${Utils.escape(r.error)}</p>`
                : `<div class="grid grid-cols-4 gap-2 text-center">
                    <div><p class="text-[9px] font-black text-emerald-700 uppercase">Criados</p><p class="text-lg font-black text-slate-900">${r.created || 0}</p></div>
                    <div><p class="text-[9px] font-black text-sky-700 uppercase">Atualizados</p><p class="text-lg font-black text-slate-900">${r.updated || 0}</p></div>
                    <div><p class="text-[9px] font-black text-slate-700 uppercase">Pulados</p><p class="text-lg font-black text-slate-900">${r.skipped || 0}</p></div>
                    <div><p class="text-[9px] font-black text-rose-700 uppercase">Erros</p><p class="text-lg font-black text-slate-900">${r.errors || 0}</p></div>
                  </div>`
              }
            </div>`).join('')
        }
      </div>
    </div>`;
  },

  _header(w) {
    return `<header class="bg-slate-950 text-white p-5 flex items-start justify-between gap-3" style="color:#fff;">
      <div class="min-w-0">
        <p class="text-[10px] font-black text-violet-300 uppercase tracking-widest mb-1">
          <i data-lucide="file-up" class="w-3 h-3 inline"></i>
          Importar Leads via CSV
        </p>
        <h2 class="text-xl font-black">Inserir leads</h2>
        <p class="text-[12px] text-slate-300 mt-1">Importe seus contatos a partir de um arquivo CSV ou colando texto.</p>
      </div>
      <button onclick="Actions.closeLeadImportModal()" class="shrink-0 w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 grid place-items-center" style="color:#fff;">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    </header>`;
  },

  _stepper(w) {
    const steps = [
      { n: 1, label: 'Upload' },
      { n: 2, label: 'Mapear' },
      { n: 3, label: 'Revisar' },
      { n: 4, label: 'Importar' }
    ];
    return `<nav class="bg-slate-100 border-b border-slate-200 px-5 py-3 flex items-center gap-2 overflow-x-auto">
      ${steps.map((s, i) => {
        const isActive = w.step === s.n;
        const isDone = w.step > s.n;
        const dot = isDone
          ? `<span class="w-7 h-7 rounded-full bg-emerald-500 grid place-items-center text-white" style="color:#fff;"><i data-lucide="check" class="w-3.5 h-3.5"></i></span>`
          : `<span class="w-7 h-7 rounded-full ${isActive ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-300'} grid place-items-center text-xs font-black" ${isActive ? 'style="color:#fff;"' : ''}>${s.n}</span>`;
        return `<div class="flex items-center gap-2 ${i < steps.length - 1 ? 'flex-1' : ''}">
          ${dot}
          <span class="text-xs font-black ${isActive ? 'text-slate-900' : isDone ? 'text-emerald-700' : 'text-slate-500'}">${s.label}</span>
          ${i < steps.length - 1 ? `<span class="flex-1 h-0.5 bg-slate-300 mx-1"></span>` : ''}
        </div>`;
      }).join('')}
    </nav>`;
  },

  // ============ STEP 1: UPLOAD ============
  _step1Upload(w) {
    const banks = App.state.leadBanksCache?.banks || [];
    return `<div class="space-y-4">
      ${this._bankSelector(w, banks)}
      ${this._inputModeToggle(w)}
      ${w.inputMode === 'file' ? this._fileInput(w) : this._pasteInput(w)}
      ${w.parseError ? `<div class="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-800 font-bold">${Utils.escape(w.parseError)}</div>` : ''}
      <div class="flex justify-end pt-2">
        <button onclick="Actions.closeLeadImportModal()" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-black text-slate-700">Cancelar</button>
      </div>
    </div>`;
  },

  _bankSelector(w, banks) {
    if (!banks.length) {
      return `<div class="rounded-2xl bg-rose-50 border border-rose-200 p-4">
        <p class="text-sm font-black text-rose-800 mb-1">Você precisa de um banco antes de importar.</p>
        <button onclick="Actions.openLeadBankEditModal()" class="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-black" style="color:#fff;">+ Criar banco</button>
      </div>`;
    }
    return `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
      <label class="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Banco de destino</label>
      <select onchange="Actions.setLeadWizardBank(this.value)" class="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-bold text-sm">
        ${banks.map(b => `<option value="${b.id}" ${w.bankId === b.id ? 'selected' : ''}>${Utils.escape(b.name)}${b.is_default ? ' · default' : ''} · ${b.visitor_count || 0} lead(s)</option>`).join('')}
      </select>
    </div>`;
  },

  _inputModeToggle(w) {
    return `<div class="grid grid-cols-2 gap-2">
      <button onclick="Actions.setLeadWizardInputMode('file')" class="px-4 py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 ${w.inputMode === 'file' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" ${w.inputMode === 'file' ? 'style="color:#fff;"' : ''}>
        <i data-lucide="upload" class="w-4 h-4"></i>
        Arquivo CSV
      </button>
      <button onclick="Actions.setLeadWizardInputMode('paste')" class="px-4 py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 ${w.inputMode === 'paste' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" ${w.inputMode === 'paste' ? 'style="color:#fff;"' : ''}>
        <i data-lucide="clipboard-paste" class="w-4 h-4"></i>
        Colar texto
      </button>
    </div>`;
  },

  _fileInput(w) {
    return `<label class="block">
      <div class="rounded-3xl bg-violet-50 border-2 border-dashed border-violet-300 p-8 text-center cursor-pointer hover:bg-violet-100 transition">
        <i data-lucide="upload-cloud" class="w-12 h-12 text-violet-500 mx-auto mb-3"></i>
        <p class="text-sm font-black text-slate-900 mb-1">Clique pra selecionar CSV</p>
        <p class="text-xs text-slate-500">Auto-detecta separador (vírgula / ponto-e-vírgula / tab) e cabeçalho</p>
      </div>
      <input type="file" accept=".csv,.txt,.tsv" class="hidden" onchange="Actions.handleLeadWizardFile(event)" />
    </label>`;
  },

  _pasteInput(w) {
    return `<div class="space-y-2">
      <label class="block text-[10px] font-black text-slate-500 uppercase tracking-widest">Cole o conteúdo CSV</label>
      <textarea
        rows="10"
        oninput="Actions.handleLeadWizardPaste(this.value)"
        placeholder="Nome,Email,Telefone&#10;Ana Souza,ana@email.com,11999999999&#10;João Mendes,joao@email.com,21988888888"
        class="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 font-mono text-xs">${Utils.escape(w.rawText || '')}</textarea>
      <button onclick="Actions.submitLeadWizardPaste()" class="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-black" style="color:#fff;">
        Continuar →
      </button>
    </div>`;
  },

  // ============ STEP 2: MAPEAR ============
  _step2Map(w) {
    const v = Actions._validateMapping(w.mapping);
    return `<div class="space-y-4">
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Step 2 · Mapeamento</p>
          <p class="text-sm font-bold text-slate-700">Pra cada coluna do seu CSV, escolha o campo correspondente no LJ.</p>
          <p class="text-xs text-slate-500 mt-1">Auto-mapeamento aplicado — revise e ajuste antes de continuar.</p>
        </div>
        <p class="text-[10px] font-black text-slate-500 text-right shrink-0">
          ${w.rows.length} linhas detectadas<br>
          ${w.fileName ? `<span class="text-violet-700">${Utils.escape(w.fileName)}</span>` : 'Texto colado'}
        </p>
      </div>

      <div class="rounded-2xl border border-slate-200 overflow-hidden">
        <table class="w-full text-xs">
          <thead class="bg-slate-50">
            <tr class="text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <th class="px-3 py-2.5">Coluna do CSV</th>
              <th class="px-3 py-2.5 w-48">Mapear para</th>
              <th class="px-3 py-2.5">Exemplo</th>
            </tr>
          </thead>
          <tbody>
            ${w.headers.map((h, idx) => {
              const current = w.mapping[h] || 'skip';
              const examples = w.preview.map(r => r[idx]).filter(Boolean).slice(0, 3).join(', ');
              const isMapped = current !== 'skip';
              return `<tr class="border-t border-slate-100">
                <td class="px-3 py-2.5">
                  <p class="font-black text-slate-900 truncate max-w-[200px]">${Utils.escape(h)}</p>
                </td>
                <td class="px-3 py-2.5">
                  <select onchange="Actions.setLeadWizardMapping('${Utils.escape(h).replace(/'/g, "\\'")}', this.value)" class="w-full px-2 py-1.5 rounded-lg ${isMapped ? 'bg-violet-50 border-2 border-violet-300' : 'bg-slate-50 border border-slate-200'} text-xs font-bold text-slate-800">
                    ${this._LJ_FIELDS.map(f => `<option value="${f.value}" ${current === f.value ? 'selected' : ''}>${f.label}</option>`).join('')}
                  </select>
                </td>
                <td class="px-3 py-2.5 text-slate-500 truncate max-w-[280px]">${Utils.escape(examples || '—')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      ${v.ok
        ? `<div class="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
            <i data-lucide="check-circle-2" class="w-4 h-4"></i>
            Mapeamento válido — você pode continuar.
          </div>`
        : `<div class="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs font-bold text-amber-800 flex items-center gap-2">
            <i data-lucide="alert-triangle" class="w-4 h-4"></i>
            ${Utils.escape(v.error)}
          </div>`
      }

      <div class="flex justify-between pt-2">
        <button onclick="Actions.setLeadWizardStep(1)" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-black text-slate-700 flex items-center gap-2">
          <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
          Voltar
        </button>
        <button ${v.ok ? '' : 'disabled'} onclick="Actions.goToWizardReview()" class="px-5 py-2.5 rounded-xl ${v.ok ? 'bg-slate-900 hover:bg-slate-800 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'} text-sm font-black flex items-center gap-2" ${v.ok ? 'style="color:#fff;"' : ''}>
          Próximo
          <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    </div>`;
  },

  // ============ STEP 3: REVISAR ============
  _step3Review(w) {
    const bank = (App.state.leadBanksCache?.banks || []).find(b => b.id === w.bankId);
    const mappedFields = Object.values(w.mapping).filter(v => v !== 'skip');
    const hasEmail = mappedFields.includes('email');
    const hasPhone = mappedFields.includes('phone');
    const hasTags  = mappedFields.includes('tags');

    return `<div class="space-y-4">
      <div>
        <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Step 3 · Revisar</p>
        <p class="text-lg font-black text-slate-900">Você vai importar <span class="text-violet-700">${w.rows.length} lead(s)</span> no banco <span class="text-violet-700">${Utils.escape(bank?.name || '?')}</span>.</p>
      </div>

      <!-- Stats -->
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
        ${this._statBox('Total no CSV', w.rows.length, 'list', 'slate')}
        ${this._statBox('Com email',    hasEmail ? w.rows.length : 0, 'mail', 'sky')}
        ${this._statBox('Com telefone', hasPhone ? w.rows.length : 0, 'phone', 'emerald')}
      </div>

      <!-- Dedup preview -->
      ${this._dedupPreviewBlock(w)}

      <!-- Comportamento de dedup -->
      <div class="rounded-2xl bg-white border border-slate-200 p-4">
        <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Quando o lead já existe</p>
        <div class="space-y-2">
          <label class="flex items-start gap-2 p-2 rounded-xl cursor-pointer ${w.dedupBehavior === 'update' ? 'bg-violet-50 border border-violet-200' : 'hover:bg-slate-50 border border-transparent'}">
            <input type="radio" name="dedupBehavior" ${w.dedupBehavior === 'update' ? 'checked' : ''} onchange="Actions.setLeadWizardDedupBehavior('update')" class="mt-0.5" />
            <div>
              <p class="text-sm font-black text-slate-900">Atualizar existentes</p>
              <p class="text-[11px] text-slate-500">Quem já está no banco recebe os dados novos do CSV (sobrescreve campos preenchidos).</p>
            </div>
          </label>
          <label class="flex items-start gap-2 p-2 rounded-xl cursor-pointer ${w.dedupBehavior === 'skip' ? 'bg-violet-50 border border-violet-200' : 'hover:bg-slate-50 border border-transparent'}">
            <input type="radio" name="dedupBehavior" ${w.dedupBehavior === 'skip' ? 'checked' : ''} onchange="Actions.setLeadWizardDedupBehavior('skip')" class="mt-0.5" />
            <div>
              <p class="text-sm font-black text-slate-900">Pular existentes</p>
              <p class="text-[11px] text-slate-500">Só importa quem ainda não está no banco — os existentes ficam intocados.</p>
            </div>
          </label>
        </div>
      </div>

      <!-- Origin tag -->
      <div class="rounded-2xl bg-white border border-slate-200 p-4">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" ${w.applyOriginTag ? 'checked' : ''} onchange="Actions.toggleLeadWizardOriginTag()" />
          <span class="text-sm font-black text-slate-900">Aplicar tag de origem em todos</span>
        </label>
        ${w.applyOriginTag ? `<div class="mt-2 flex items-center gap-2">
          <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tag:</span>
          <input type="text" value="${Utils.escape(w.originTag || '')}" oninput="Actions.setLeadWizardOriginTag(this.value)" class="flex-1 px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono font-bold" />
        </div>
        <p class="text-[10px] text-slate-500 mt-1">Útil pra você saber depois "de onde esses leads vieram" e segmentar.</p>` : ''}
      </div>

      <div class="flex justify-between pt-2">
        <button onclick="Actions.setLeadWizardStep(2)" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-black text-slate-700 flex items-center gap-2">
          <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
          Voltar
        </button>
        <button onclick="Actions.executeLeadWizardImport()" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black flex items-center gap-2" style="color:#fff;">
          <i data-lucide="rocket" class="w-3.5 h-3.5"></i>
          Importar ${w.rows.length} lead(s)
        </button>
      </div>
    </div>`;
  },

  _statBox(label, val, icon, tone) {
    return `<div class="rounded-xl bg-${tone}-50 border border-${tone}-200 p-3">
      <div class="flex items-center justify-between mb-1">
        <p class="text-[10px] font-black text-${tone}-700 uppercase tracking-widest">${label}</p>
        <i data-lucide="${icon}" class="w-3.5 h-3.5 text-${tone}-600"></i>
      </div>
      <p class="text-xl font-black text-slate-900">${val.toLocaleString('pt-BR')}</p>
    </div>`;
  },

  _dedupPreviewBlock(w) {
    const dp = w.dedupPreview;
    if (!dp) return '';

    // Caso volume > 50k
    if (dp.skipped) {
      return `<div class="rounded-2xl bg-amber-50 border-2 border-amber-300 p-4">
        <div class="flex items-start gap-3">
          <i data-lucide="alert-triangle" class="w-5 h-5 text-amber-700 shrink-0 mt-0.5"></i>
          <div class="min-w-0">
            <p class="text-sm font-black text-amber-900 mb-1">Volume alto detectado (${dp.total.toLocaleString('pt-BR')} linhas)</p>
            <p class="text-xs text-amber-800">Sugiro <strong>quebrar o CSV em lotes de 20k linhas</strong> e importar separado. O LJ aguenta acima disso, mas tem risco da página travar durante a importação.</p>
            <p class="text-[11px] text-amber-700 italic mt-1">Preview de duplicados desabilitado pra esse volume. O dedup vai acontecer normalmente no servidor durante o import.</p>
          </div>
        </div>
      </div>`;
    }

    // Loading state com cafezinho
    if (dp.loading) {
      return `<div class="rounded-2xl bg-white border-2 border-violet-200 p-5">
        ${dp.warnSlow ? `<div class="rounded-xl bg-amber-50 border border-amber-200 p-2.5 mb-4 text-[11px] font-bold text-amber-800 flex items-center gap-2">
          <i data-lucide="clock" class="w-3.5 h-3.5"></i>
          Volume médio (${dp.total.toLocaleString('pt-BR')}). Vai demorar mais que o normal, mas vai dar certo.
        </div>` : ''}
        ${this._cafezinhoLoader('Pega um cafezinho enquanto separo os duplicados…')}
      </div>`;
    }

    // Erro
    if (dp.error) {
      return `<div class="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-800">
        Preview de duplicados falhou: ${Utils.escape(dp.error)}
      </div>`;
    }

    // Resultado
    const dupTotal = (dp.duplicateEmails || 0) + (dp.duplicatePhones || 0);
    return `<div class="rounded-2xl bg-white border-2 ${dupTotal > 0 ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'} p-4">
      <div class="flex items-start gap-3">
        <i data-lucide="${dupTotal > 0 ? 'copy' : 'check-circle-2'}" class="w-5 h-5 ${dupTotal > 0 ? 'text-amber-700' : 'text-emerald-700'} shrink-0 mt-0.5"></i>
        <div class="min-w-0">
          <p class="text-sm font-black ${dupTotal > 0 ? 'text-amber-900' : 'text-emerald-900'} mb-1">
            ${dupTotal > 0 ? `${dupTotal} duplicado(s) detectado(s)` : 'Nenhum duplicado — todos os leads são novos'}
          </p>
          ${dupTotal > 0 ? `<ul class="text-xs ${dupTotal > 0 ? 'text-amber-800' : 'text-emerald-800'} space-y-0.5">
            ${dp.duplicateEmails ? `<li>· ${dp.duplicateEmails} já existem por <strong>email</strong></li>` : ''}
            ${dp.duplicatePhones ? `<li>· ${dp.duplicatePhones} já existem por <strong>telefone</strong></li>` : ''}
          </ul>` : ''}
        </div>
      </div>
    </div>`;
  },

  // ============ STEP 4: IMPORTAR ============
  _step4Import(w) {
    const r = w.result || {};
    if (r.running) {
      return `<div class="py-6 text-center space-y-4">
        ${this._cafezinhoLoader('Importando os leads no banco… aguenta firme aí.')}
      </div>`;
    }
    if (r.error) {
      return `<div class="space-y-4">
        <div class="rounded-2xl bg-rose-50 border-2 border-rose-200 p-5">
          <i data-lucide="alert-octagon" class="w-8 h-8 text-rose-700 mx-auto mb-2"></i>
          <p class="text-sm font-black text-rose-900 text-center">Falha na importação</p>
          <p class="text-xs text-rose-800 text-center mt-1">${Utils.escape(r.error)}</p>
        </div>
        <div class="flex justify-end">
          <button onclick="Actions.setLeadWizardStep(3)" class="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-black" style="color:#fff;">Voltar e tentar de novo</button>
        </div>
      </div>`;
    }
    return `<div class="space-y-4">
      <div class="rounded-3xl bg-emerald-50 border-2 border-emerald-300 p-6 text-center">
        <div class="inline-flex w-14 h-14 rounded-2xl bg-emerald-500 items-center justify-center mb-3" style="color:#fff;">
          <i data-lucide="check" class="w-7 h-7" style="color:#fff;"></i>
        </div>
        <h3 class="text-xl font-black text-emerald-900">Importação concluída</h3>
        <p class="text-xs text-emerald-700 mt-1">Relatório também ficou disponível no sino da Home.</p>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        ${this._statBox('Criados',  r.created  || 0, 'plus-circle',  'emerald')}
        ${this._statBox('Atualizados', r.updated || 0, 'refresh-cw', 'sky')}
        ${this._statBox('Pulados',  r.skipped  || 0, 'skip-forward', 'slate')}
        ${this._statBox('Erros',    r.errors   || 0, 'alert-circle', 'rose')}
      </div>

      <div class="flex justify-between pt-2">
        <button onclick="Actions.openLeadImportModal()" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-sm font-black text-slate-700 flex items-center gap-2">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
          Importar mais
        </button>
        <button onclick="Actions.closeLeadImportModal()" class="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-black" style="color:#fff;">Fechar</button>
      </div>
    </div>`;
  },

  // ============ Cafezinho Loader ============
  // Componente visual amigável pra esperas longas.
  _cafezinhoLoader(message) {
    return `<div class="flex flex-col items-center py-2">
      <div class="lj-cafezinho">
        <div class="lj-cafezinho-steam lj-cafezinho-steam-1"></div>
        <div class="lj-cafezinho-steam lj-cafezinho-steam-2"></div>
        <div class="lj-cafezinho-steam lj-cafezinho-steam-3"></div>
        <div class="lj-cafezinho-cup">
          <div class="lj-cafezinho-brew"></div>
          <div class="lj-cafezinho-handle"></div>
        </div>
        <div class="lj-cafezinho-saucer"></div>
      </div>
      <p class="text-sm font-black text-slate-700 mt-4 text-center max-w-xs">${Utils.escape(message || 'Carregando…')}</p>
      <p class="text-[10px] text-slate-500 mt-1">LJ trabalhando</p>
    </div>`;
  }
};
