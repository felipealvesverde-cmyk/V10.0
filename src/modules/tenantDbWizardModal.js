// V36.8.0 — Wizard "Conectar banco de dados" pra cliente novo.
//
// 4 steps:
//   1. Escolha do provedor (Railway / Neon / Supabase / Outro)
//   2a. Se Railway: tutorial passo a passo inline (cliente segue dentro do LJ)
//   2b. Se outros: campos separados host/porta/user/password/dbname
//   3. Cole connection string (Railway) ou confirma campos (outros) → testa
//   4. Sucesso
//
// Frontend monta connection string ANTES de mandar pro backend.
// Backend (/api/tenants-plug-db) faz o trabalho real (encrypt + UPDATE tenants).

window.TenantDbWizardModal = {
  render() {
    const w = App.state.tenantDbWizard;
    if (!w || !w.open) return '';

    return `<div class="fixed inset-0 z-[120] bg-black/70 backdrop-blur-md grid place-items-center p-4" onclick="if(event.target===this) Actions.closeTenantDbWizard()">
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
        ${this._header(w)}
        ${this._stepper(w)}
        <div class="p-6">
          ${w.step === 1 ? this._step1ChooseProvider(w) : ''}
          ${w.step === 2 ? this._step2(w) : ''}
          ${w.step === 3 ? this._step3ConnectionString(w) : ''}
          ${w.step === 4 ? this._step4Success(w) : ''}
        </div>
      </div>
    </div>`;
  },

  _header(w) {
    return `<div class="p-6 border-b border-slate-100 flex items-start justify-between bg-gradient-to-br from-sky-50 to-white">
      <div>
        <p class="text-[10px] font-black text-sky-700 uppercase tracking-widest mb-1">Onboarding · Passo crítico</p>
        <h3 class="text-xl font-black text-slate-900">Conectar banco de dados</h3>
        <p class="text-xs text-slate-500 mt-1">Necessário pra ativar integrações e webhooks.</p>
      </div>
      <button onclick="Actions.closeTenantDbWizard()" class="text-slate-400 hover:text-slate-700"><i data-lucide="x" class="w-5 h-5"></i></button>
    </div>`;
  },

  _stepper(w) {
    const steps = [
      { n: 1, label: 'Provedor' },
      { n: 2, label: 'Tutorial' },
      { n: 3, label: 'Conectar' },
      { n: 4, label: 'Pronto' }
    ];
    return `<div class="px-6 pt-4">
      <div class="flex items-center gap-2">
        ${steps.map(s => {
          const active = w.step === s.n;
          const done = w.step > s.n;
          const cls = done ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                    : active ? 'bg-sky-100 border-sky-400 text-sky-800'
                    : 'bg-slate-50 border-slate-200 text-slate-400';
          return `<div class="flex-1 px-3 py-2 rounded-xl border ${cls} text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5">
            <span class="w-5 h-5 rounded-full bg-white/70 grid place-items-center text-[10px]">${done ? '✓' : s.n}</span>
            ${s.label}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  _step1ChooseProvider(w) {
    const providers = [
      {
        id: 'railway',
        name: 'Railway',
        recommended: true,
        price: 'R$30-50/mês',
        time: '5 minutos',
        why: 'Setup mais simples, backups automáticos, painel intuitivo. A gente te ensina passo a passo dentro do LJ.',
        icon: '🚂',
        color: 'violet'
      },
      {
        id: 'neon',
        name: 'Neon',
        price: 'Free tier generoso',
        time: '~10 min',
        why: 'Postgres serverless. Bom pra começar de graça, escala depois.',
        icon: '⚡',
        color: 'sky'
      },
      {
        id: 'supabase',
        name: 'Supabase',
        price: 'Free tier',
        time: '~10 min',
        why: 'Interface visual completa. Bom se você quer mexer no banco direto.',
        icon: '🟢',
        color: 'emerald'
      },
      {
        id: 'custom',
        name: 'Outro Postgres',
        price: 'Depende',
        time: 'Você sabe',
        why: 'Já tenho um Postgres rodando (AWS, GCP, on-premise, etc).',
        icon: '🛠️',
        color: 'slate'
      }
    ];
    return `<div class="space-y-3">
      <p class="text-sm text-slate-600 mb-4">Escolha onde seu banco de dados vai ficar hospedado:</p>
      ${providers.map(p => `
        <button onclick="Actions.setTenantDbProvider('${p.id}')" class="w-full text-left p-4 rounded-2xl border-2 ${p.recommended ? 'border-violet-300 bg-violet-50/50' : 'border-slate-200 bg-white hover:border-slate-300'} transition flex items-start gap-4">
          <div class="shrink-0 w-12 h-12 rounded-xl bg-white border border-slate-200 grid place-items-center text-2xl">${p.icon}</div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <p class="font-black text-base text-slate-900">${p.name}</p>
              ${p.recommended ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-violet-600 text-white uppercase" style="color:#fff;">Recomendado</span>' : ''}
            </div>
            <p class="text-[11px] text-slate-500 mt-0.5"><b>${p.price}</b> · setup em ${p.time}</p>
            <p class="text-xs text-slate-700 mt-2">${p.why}</p>
          </div>
          <i data-lucide="arrow-right" class="w-5 h-5 text-slate-400 self-center"></i>
        </button>
      `).join('')}
    </div>`;
  },

  _step2(w) {
    if (w.provider === 'railway') return this._step2RailwayTutorial(w);
    if (w.provider === 'neon') return this._step2NeonTutorial(w);
    if (w.provider === 'supabase') return this._step2SupabaseTutorial(w);
    return this._step2CustomFields(w);
  },

  _step2RailwayTutorial(w) {
    return `<div class="space-y-4">
      <div class="rounded-xl bg-violet-50 border border-violet-200 p-3 text-xs text-violet-900">
        <p class="font-black mb-1">🚂 Tutorial Railway — siga os 5 passos</p>
        <p>Demora ~5 minutos. No final você vai colar uma string aqui no Step 3.</p>
      </div>

      <div class="space-y-3">
        ${[
          { n: 1, title: 'Crie conta no Railway', body: 'Acesse <a href="https://railway.app/login" target="_blank" class="text-violet-700 underline font-black">railway.app/login</a> e crie conta com GitHub (mais rápido) ou email.' },
          { n: 2, title: 'Adicione cartão de crédito', body: 'Settings → Billing → Add Payment Method. Cobra ~R$30-50/mês conforme uso (pra escala pequena fica perto disso).' },
          { n: 3, title: 'Crie um novo projeto Postgres', body: 'Botão "New Project" → "Provision PostgreSQL". Railway cria um Postgres pronto em ~30s.' },
          { n: 4, title: 'Copie a connection string', body: 'Clique no banco criado → aba "Variables" → procure <code class="bg-slate-100 px-1 rounded">DATABASE_URL</code> → clique pra revelar → copie o valor completo (começa com <code class="bg-slate-100 px-1 rounded">postgresql://</code>).' },
          { n: 5, title: 'Cole no LJ no próximo passo', body: 'Clica em "Avançar" abaixo, cola a string e o LJ testa + conecta tudo automaticamente.' }
        ].map(p => `
          <div class="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div class="shrink-0 w-7 h-7 rounded-lg bg-violet-600 text-white grid place-items-center text-xs font-black" style="color:#fff;">${p.n}</div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-black text-slate-900">${p.title}</p>
              <p class="text-xs text-slate-600 mt-1 leading-relaxed">${p.body}</p>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="flex justify-between gap-2 pt-2">
        <button onclick="Actions.setTenantDbWizardStep(1)" class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black">← Voltar</button>
        <button onclick="Actions.setTenantDbWizardStep(3)" class="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black" style="color:#fff;">Avançar →</button>
      </div>
    </div>`;
  },

  _step2NeonTutorial(w) {
    return `<div class="space-y-4">
      <div class="rounded-xl bg-sky-50 border border-sky-200 p-3 text-xs text-sky-900">
        <p class="font-black mb-1">⚡ Tutorial Neon</p>
        <p>1. Acesse <a href="https://neon.tech" target="_blank" class="text-sky-700 underline font-black">neon.tech</a> e crie conta gratuita.</p>
        <p>2. Crie um novo Project → escolha região mais próxima do Brasil (Virgínia EUA é o mais comum).</p>
        <p>3. Na tela do dashboard, copie a "Connection string" (formato <code class="bg-white px-1 rounded">postgresql://...</code>).</p>
        <p>4. Avance e cole no próximo passo.</p>
      </div>
      <div class="flex justify-between gap-2">
        <button onclick="Actions.setTenantDbWizardStep(1)" class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black">← Voltar</button>
        <button onclick="Actions.setTenantDbWizardStep(3)" class="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black" style="color:#fff;">Avançar →</button>
      </div>
    </div>`;
  },

  _step2SupabaseTutorial(w) {
    return `<div class="space-y-4">
      <div class="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
        <p class="font-black mb-1">🟢 Tutorial Supabase</p>
        <p>1. Acesse <a href="https://supabase.com" target="_blank" class="text-emerald-700 underline font-black">supabase.com</a> → "Start your project".</p>
        <p>2. Crie um novo projeto. Anote a senha do banco que você definir.</p>
        <p>3. Após criação, vá em <b>Settings → Database → Connection string</b>. Copie a versão "URI".</p>
        <p>4. Substitua <code class="bg-white px-1 rounded">[YOUR-PASSWORD]</code> na string pela senha que você definiu.</p>
        <p>5. Avance e cole no próximo passo.</p>
      </div>
      <div class="flex justify-between gap-2">
        <button onclick="Actions.setTenantDbWizardStep(1)" class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black">← Voltar</button>
        <button onclick="Actions.setTenantDbWizardStep(3)" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black" style="color:#fff;">Avançar →</button>
      </div>
    </div>`;
  },

  _step2CustomFields(w) {
    const f = w.fields || {};
    return `<div class="space-y-4">
      <div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-700">
        <p class="font-black mb-1">🛠️ Postgres próprio</p>
        <p>Preencha os campos e o LJ vai montar a connection string pra você. Precisa ser Postgres 14+ acessível pela internet (ou seu IP do Railway via VPN).</p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2 space-y-1.5">
          <label class="text-[11px] font-black text-slate-700 uppercase tracking-wider">Host *</label>
          <input type="text" id="tenant-db-host" value="${Utils.escape(f.host || '')}"
            oninput="Actions.updateTenantDbField('host', this.value); App.render()"
            placeholder="db.exemplo.com"
            class="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-mono focus:border-sky-500 focus:outline-none" />
        </div>
        <div class="space-y-1.5">
          <label class="text-[11px] font-black text-slate-700 uppercase tracking-wider">Porta</label>
          <input type="text" id="tenant-db-port" value="${Utils.escape(f.port || '5432')}"
            oninput="Actions.updateTenantDbField('port', this.value.replace(/[^0-9]/g, '')); App.render()"
            placeholder="5432"
            class="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-mono focus:border-sky-500 focus:outline-none" />
        </div>
        <div class="space-y-1.5">
          <label class="text-[11px] font-black text-slate-700 uppercase tracking-wider">Database *</label>
          <input type="text" id="tenant-db-dbname" value="${Utils.escape(f.dbname || '')}"
            oninput="Actions.updateTenantDbField('dbname', this.value); App.render()"
            placeholder="leadjourney"
            class="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-mono focus:border-sky-500 focus:outline-none" />
        </div>
        <div class="space-y-1.5">
          <label class="text-[11px] font-black text-slate-700 uppercase tracking-wider">Usuário *</label>
          <input type="text" id="tenant-db-user" value="${Utils.escape(f.user || '')}"
            oninput="Actions.updateTenantDbField('user', this.value); App.render()"
            placeholder="postgres"
            class="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-mono focus:border-sky-500 focus:outline-none" />
        </div>
        <div class="space-y-1.5">
          <label class="text-[11px] font-black text-slate-700 uppercase tracking-wider">Senha *</label>
          <input type="password" id="tenant-db-password" value="${Utils.escape(f.password || '')}"
            oninput="Actions.updateTenantDbField('password', this.value); App.render()"
            placeholder="••••••••"
            class="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm font-mono focus:border-sky-500 focus:outline-none" />
        </div>
      </div>

      ${w.connStr ? `<div class="rounded-xl bg-slate-900 text-emerald-300 p-3 font-mono text-[11px] break-all">
        <p class="text-slate-400 text-[10px] mb-1">Connection string que vai ser usada:</p>
        ${Utils.escape(w.connStr).replace(encodeURIComponent(f.password || ''), '••••••••')}
      </div>` : ''}

      <div class="flex justify-between gap-2 pt-2">
        <button onclick="Actions.setTenantDbWizardStep(1)" class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black">← Voltar</button>
        <button onclick="Actions.setTenantDbWizardStep(3)" ${!w.connStr ? 'disabled' : ''} class="px-5 py-2 rounded-xl ${w.connStr ? 'bg-sky-600 hover:bg-sky-700' : 'bg-slate-300 cursor-not-allowed'} text-white text-xs font-black" style="color:#fff;">Avançar →</button>
      </div>
    </div>`;
  },

  _step3ConnectionString(w) {
    const isCustom = w.provider === 'custom';
    return `<div class="space-y-4">
      <div class="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
        <p class="font-black mb-1">⚠️ Antes de conectar</p>
        <p>Você precisa rodar o schema do LJ contra o banco. Isso cria as tabelas necessárias. O LJ tenta fazer automaticamente após conectar — se falhar, precisamos rodar manualmente.</p>
      </div>

      ${!isCustom ? `<div class="space-y-1.5">
        <label class="text-[11px] font-black text-slate-700 uppercase tracking-wider">Cole a connection string aqui</label>
        <input type="password" id="tenant-db-connstr" value="${Utils.escape(w.connStr || '')}"
          oninput="App.state.tenantDbWizard.connStr = this.value; App.render()"
          placeholder="postgresql://user:senha@host:5432/database"
          class="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-mono focus:border-sky-500 focus:outline-none" />
        <p class="text-[10px] text-slate-500">Cole a string completa que você copiou do ${w.provider === 'railway' ? 'Railway' : w.provider === 'neon' ? 'Neon' : 'Supabase'}. Começa com <code>postgresql://</code> ou <code>postgres://</code>.</p>
      </div>` : `<div class="rounded-xl bg-slate-900 text-emerald-300 p-3 font-mono text-[11px] break-all">
        ${Utils.escape(w.connStr || '').replace(encodeURIComponent(w.fields?.password || ''), '••••••••')}
      </div>`}

      ${w.error ? `<div class="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">${Utils.escape(w.error)}</div>` : ''}

      <div class="flex justify-between gap-2 pt-2">
        <button onclick="Actions.setTenantDbWizardStep(2)" class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black">← Voltar</button>
        <button onclick="Actions.submitTenantDbConnect()" ${(!w.connStr || w.saving) ? 'disabled' : ''} class="px-5 py-2 rounded-xl ${w.connStr && !w.saving ? 'bg-sky-600 hover:bg-sky-700' : 'bg-slate-300 cursor-not-allowed'} text-white text-xs font-black inline-flex items-center gap-2" style="color:#fff;">
          ${w.saving ? '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Conectando...' : 'Conectar banco →'}
        </button>
      </div>
    </div>`;
  },

  _step4Success(w) {
    return `<div class="space-y-4 text-center py-4">
      <div class="inline-flex w-16 h-16 rounded-3xl bg-emerald-100 grid place-items-center mx-auto">
        <i data-lucide="check" class="w-8 h-8 text-emerald-700"></i>
      </div>
      <div>
        <h3 class="text-xl font-black text-slate-900">Banco conectado!</h3>
        <p class="text-sm text-slate-600 mt-1">Seu Postgres agora recebe todos os dados do LJ.</p>
      </div>

      <div class="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-left">
        <p class="text-[11px] font-black text-slate-700 uppercase tracking-widest mb-2">O que muda agora</p>
        <ul class="text-sm text-slate-700 space-y-1.5 list-disc pl-5">
          <li><b>Integrações desbloqueadas</b> — pode conectar RD, ClickUp, Hotmart, Google Ads, GA4.</li>
          <li><b>Webhooks ao vivo</b> — RD/Hotmart/etc conseguem mandar eventos pro LJ.</li>
          <li><b>Sync entre dispositivos</b> — abre no PC ou celular, dados acompanham.</li>
          <li><b>Backups automáticos</b> — o banco que você escolheu cuida disso.</li>
        </ul>
      </div>

      <button onclick="Actions.closeTenantDbWizard()" class="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-sm font-black" style="color:#fff;">Começar a usar →</button>
    </div>`;
  }
};
