var SettingsModal = {
  activeSection() {
    return App.state.settingsActiveSection || 'database';
  },

  _input(field, label, placeholder = '', type = 'text', value = '') {
    return `<div>
      <label class="text-xs font-black text-slate-500 uppercase tracking-wide">${label}</label>
      <input type="${type}" value="${Utils.escape(value || '')}" oninput="Actions.updateRDConfig('${field}', this.value)" placeholder="${Utils.escape(placeholder)}" class="mt-1 w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-semibold text-slate-900 placeholder:text-slate-400" />
    </div>`;
  },

  _dbInput(path, label, placeholder, type, value, hint = '') {
    const safeValue = value === undefined || value === null ? '' : String(value);
    const onInput = type === 'number'
      ? `Actions.updateDatabaseConfig('${path}', Number(this.value || 0), false)`
      : `Actions.updateDatabaseConfig('${path}', this.value, false)`;
    return `<div>
      <label class="text-xs font-black text-slate-500 uppercase tracking-wide">${label}</label>
      <input type="${type}" value="${Utils.escape(safeValue)}" oninput="${onInput}" placeholder="${Utils.escape(placeholder || '')}" class="mt-1 w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-semibold text-slate-900 placeholder:text-slate-400" />
      ${hint ? `<p class="text-[11px] text-slate-400 mt-1">${Utils.escape(hint)}</p>` : ''}
    </div>`;
  },

  _dbToggle(path, label, value, hint = '') {
    const on = Boolean(value);
    return `<label class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-slate-200">
      <span>
        <span class="block text-sm font-black text-slate-900">${Utils.escape(label)}</span>
        ${hint ? `<span class="block text-[11px] text-slate-500">${Utils.escape(hint)}</span>` : ''}
      </span>
      <button onclick="Actions.updateDatabaseConfig('${path}', ${!on})" class="relative w-12 h-7 rounded-full transition ${on ? 'bg-emerald-500' : 'bg-slate-300'}" aria-pressed="${on}">
        <span class="absolute top-1 ${on ? 'right-1' : 'left-1'} w-5 h-5 rounded-full bg-white shadow"></span>
      </button>
    </label>`;
  },

  _dbSelect(path, label, options, value) {
    return `<div>
      <label class="text-xs font-black text-slate-500 uppercase tracking-wide">${label}</label>
      <select onchange="Actions.updateDatabaseConfig('${path}', this.value)" class="mt-1 w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-semibold text-slate-900">
        ${options.map(opt => {
          const optValue = typeof opt === 'string' ? opt : opt.value;
          const optLabel = typeof opt === 'string' ? opt : opt.label;
          return `<option value="${Utils.escape(optValue)}" ${String(value || '') === String(optValue) ? 'selected' : ''}>${Utils.escape(optLabel)}</option>`;
        }).join('')}
      </select>
    </div>`;
  },

  sectionButton(section, label, icon) {
    const active = this.activeSection() === section;
    return `<button onclick="Actions.setSettingsSection('${section}')" class="w-full text-left rounded-2xl px-4 py-4 border transition ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}">
      <div class="flex items-center gap-3">
        <i data-lucide="${icon}" class="w-4 h-4"></i>
        <span class="font-black">${label}</span>
      </div>
    </button>`;
  },

  // V22.2 — Painel unificado de conexão RD Station.
  // Substitui rdPanel + rdCrmPanel. Estrutura: Hero/Stepper, Token CRM (core),
  // Pipelines por campanha (operacional), OAuth Marketing (opcional, colapsado),
  // Diagnóstico (último card, dobrável).
  rdConnectionPanel() {
    const rdCfg = (App.state.integrations && App.state.integrations.rd) || (window.RDConfig ? RDConfig.defaultConfig() : {});
    const crmCfg = (App.state.integrations && App.state.integrations.rdCrm) || (window.RdCrmConfig ? RdCrmConfig.defaultConfig() : {});

    const hasCrmToken = Boolean((rdCfg.crmPersonalToken || '').trim());
    // V22.3.2/V22.3.6 — Conexão "validada" = teste do PAT CRM passou
    // (crmTestStatus='connected'). É campo separado do `status` (que pertence
    // ao fluxo OAuth Marketing). Assim falha de OAuth não derruba validação
    // do CRM.
    const isValidated = hasCrmToken && rdCfg.crmTestStatus === 'connected' && Boolean(rdCfg.crmTestAt);
    const pipelineCount = Object.keys(crmCfg.pipelinesByCampaign || {}).length;
    const dealCount = Object.values(crmCfg.dealsByLead || {})
      .reduce((acc, byCamp) => acc + Object.keys(byCamp || {}).length, 0);
    const hasOAuth = Boolean(rdCfg.accessToken);

    // Estado de cada passo do Stepper. Passo 1 vira ✓ só após validar
    // (não apenas salvar o token).
    const steps = {
      step1: isValidated,
      step2: pipelineCount > 0,
      step3: dealCount > 0,
      step4: hasOAuth
    };
    const allCore = steps.step1 && steps.step2 && steps.step3;

    return `<div class="space-y-5">
      ${this._rdHeroBlock(steps, allCore, pipelineCount, dealCount)}
      ${this._rdAssistantBlock(rdCfg, crmCfg)}
      ${this._rdStepperBlock(steps)}
      ${this._rdCoreCrmTokenBlock(rdCfg, hasCrmToken, isValidated)}
      ${isValidated ? this._rdCrmCampaignPipelinesBlock(crmCfg, isValidated) : this._rdLockedHint('Pipelines bloqueados', hasCrmToken ? 'Teste a conexão CRM acima para liberar.' : 'Configure o token CRM acima primeiro.')}
      ${this._rdMarketingOAuthBlock(rdCfg, hasOAuth)}
      ${this._rdDiagnosticsBlock(rdCfg, crmCfg, hasCrmToken, hasOAuth)}
    </div>`;
  },

  // V22.2 — Hero card: muda de tom conforme estado da configuração.
  // Zero state (recém-reset): card grande, escuro, com CTA forte.
  // Estado operacional: card discreto com KPIs.
  _rdHeroBlock(steps, allCore, pipelineCount, dealCount) {
    if (allCore) {
      // Estado operacional: card slim com KPIs
      return `<div class="rounded-3xl bg-gradient-to-r from-emerald-50 to-sky-50 border border-emerald-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-emerald-500 grid place-items-center text-white"><i data-lucide="check-check" class="w-6 h-6"></i></div>
          <div>
            <h3 class="font-black text-emerald-900 text-lg">RD Station conectado</h3>
            <p class="text-xs text-emerald-800">${pipelineCount} pipeline(s) ativo(s) · ${dealCount} deal(s) sincronizado(s)</p>
          </div>
        </div>
        <button onclick="Actions.runRdCrmSyncNow()" class="px-4 py-2 rounded-2xl bg-slate-900 text-white text-xs font-black flex items-center gap-2 lj-dark-button" style="color:#fff!important;"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Sincronizar agora</button>
      </div>`;
    }
    // Zero/parcial: card de onboarding
    const nextAction = !steps.step1 ? { label: 'Gerar Token CRM no painel RD', icon: 'key-round' }
      : !steps.step2 ? { label: 'Criar pipelines nas campanhas elegíveis', icon: 'git-branch' }
      : { label: 'Enviar leads ICP ao RD', icon: 'send' };
    return `<div class="rounded-3xl bg-slate-950 text-white p-6 relative overflow-hidden">
      <div class="absolute inset-y-0 right-0 w-64 opacity-20 pointer-events-none"><i data-lucide="workflow" class="w-full h-full"></i></div>
      <div class="relative">
        <p class="text-xs font-black text-sky-300 uppercase tracking-wider mb-2">Onboarding — Conexão RD Station</p>
        <h3 class="text-2xl font-black mb-2">Conecte o RD Station em 2 minutos.</h3>
        <p class="text-sm text-slate-300 max-w-xl mb-4">Sincronize pipelines, deals e leads entre o Journey e o RD CRM. Para usar o módulo de e-mail (opcional), conecte também o RD Marketing.</p>
        <div class="flex items-center gap-2 text-sm">
          <i data-lucide="${nextAction.icon}" class="w-4 h-4 text-amber-300"></i>
          <span class="font-black text-amber-200">Próximo passo:</span>
          <span>${Utils.escape(nextAction.label)}</span>
        </div>
      </div>
    </div>`;
  },

  // V22.2 — Stepper com 4 passos. Passo 4 é (opcional) e não bloqueia.
  _rdStepperBlock(steps) {
    const list = [
      { key: 'step1', n: 1, label: 'Token CRM', icon: 'key-round' },
      { key: 'step2', n: 2, label: 'Pipelines', icon: 'git-branch' },
      { key: 'step3', n: 3, label: 'Leads sincronizados', icon: 'users' },
      { key: 'step4', n: 4, label: 'RD Marketing', icon: 'mail', optional: true }
    ];
    return `<div class="rounded-3xl bg-white border border-slate-100 p-4">
      <div class="grid grid-cols-4 gap-2">
        ${list.map((s, idx) => {
          const done = steps[s.key];
          const isOptionalUndone = s.optional && !done;
          const tone = done ? 'bg-emerald-500 text-white' : isOptionalUndone ? 'bg-slate-100 text-slate-400' : 'bg-amber-100 text-amber-700';
          const textTone = done ? 'text-emerald-900' : isOptionalUndone ? 'text-slate-500' : 'text-amber-900';
          return `<div class="flex flex-col items-center text-center gap-1">
            <div class="w-9 h-9 rounded-full grid place-items-center ${tone} font-black text-sm">
              ${done ? `<i data-lucide="check" class="w-4 h-4"></i>` : `<span>${s.n}</span>`}
            </div>
            <span class="text-[11px] font-black ${textTone} leading-tight">${Utils.escape(s.label)}${s.optional ? ' <span class="opacity-60">(opcional)</span>' : ''}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  // V22.2 — Card central: input do CRM Personal Token + ações principais.
  _rdCoreCrmTokenBlock(cfg, hasCrmToken, isValidated) {
    // V22.3.2 — 3 estados visuais distintos:
    //   - sem token: amber, "obrigatório"
    //   - token salvo MAS não validado: amarelo, "aguardando teste"
    //   - token validado (status=connected): verde, "validado no RD"
    const masked = hasCrmToken ? `${cfg.crmPersonalToken.slice(0, 4)}••••${cfg.crmPersonalToken.slice(-4)}` : '';
    const stateLabel = !hasCrmToken ? 'obrigatório' : (isValidated ? 'validado no RD' : 'aguardando teste');
    const tone = !hasCrmToken ? { border: 'border-amber-300', bg: 'bg-amber-50/40', icon: 'bg-amber-500', title: 'text-amber-900', chip: 'bg-amber-200 text-amber-900', body: 'text-amber-800' }
      : isValidated ? { border: 'border-emerald-300', bg: 'bg-emerald-50/40', icon: 'bg-emerald-500', title: 'text-emerald-900', chip: 'bg-emerald-200 text-emerald-900', body: 'text-emerald-800' }
      : { border: 'border-amber-300', bg: 'bg-amber-50/40', icon: 'bg-amber-500', title: 'text-amber-900', chip: 'bg-amber-200 text-amber-900', body: 'text-amber-800' };

    return `<div class="rounded-3xl border-2 ${tone.border} ${tone.bg} p-5 shadow-sm">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded-2xl ${tone.icon} grid place-items-center text-white shrink-0"><i data-lucide="key-round" class="w-6 h-6"></i></div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <h3 class="font-black text-lg ${tone.title}">Token pessoal do CRM</h3>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${tone.chip}">${stateLabel}</span>
          </div>
          <p class="text-xs ${tone.body} mb-3 max-w-2xl">
            Esse token autoriza o Journey a criar pipelines, mover deals e ler tags no seu RD CRM. Não usa OAuth — é um token estático gerado dentro do próprio CRM.
          </p>
          <details class="text-xs mb-3 ${tone.body}">
            <summary class="cursor-pointer font-black underline">Como gerar este token (45 s)</summary>
            <ol class="mt-2 ml-4 list-decimal space-y-1">
              <li>Abra <a href="https://crm.rdstation.com" target="_blank" class="underline">crm.rdstation.com</a> e faça login.</li>
              <li>Clique na engrenagem → <b>Todas as configurações</b>.</li>
              <li>Procure <b>Integrações</b> ou <b>API</b>.</li>
              <li>Clique em <b>Gerar token</b> e copie o valor.</li>
              <li>Volte aqui e cole abaixo. Não precisa fazer mais nada.</li>
            </ol>
          </details>
          ${this._input('crmPersonalToken','','Cole o token aqui','password',cfg.crmPersonalToken)}
          ${hasCrmToken ? `<p class="text-[10px] font-mono ${isValidated ? 'text-emerald-700' : 'text-amber-700'} mt-2">Token salvo: ${Utils.escape(masked)}${isValidated ? ' · validado em ' + new Date(cfg.crmTestAt).toLocaleString('pt-BR') : ' · aguardando teste de validação'}</p>` : ''}
          <div class="flex flex-wrap gap-2 mt-3">
            <button onclick="Actions.testRDConnection()" class="px-4 py-2 rounded-xl ${hasCrmToken && !isValidated ? 'bg-sky-600 hover:bg-sky-700' : 'bg-slate-900 hover:bg-slate-800'} text-white text-xs font-black flex items-center gap-1.5 ${hasCrmToken && !isValidated ? '' : 'lj-dark-button'}" style="color:#fff!important;"><i data-lucide="activity" class="w-3.5 h-3.5"></i> ${hasCrmToken && !isValidated ? 'Testar conexão (obrigatório)' : 'Testar conexão'}</button>
            ${hasCrmToken ? `<button onclick="Actions.updateRDConfig('crmPersonalToken','')" class="px-4 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-xs font-black flex items-center gap-1.5"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Substituir token</button>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  },

  // V22.2 — RD Marketing OAuth (opcional, colapsado). Não conta como bloqueio.
  _rdMarketingOAuthBlock(cfg, hasOAuth) {
    const fields = [
      ['clientId','Client ID','Client ID do app RD Marketing','text'],
      ['clientSecret','Client Secret','Client Secret do app','password'],
      ['redirectUri','Redirect URI','https://leadjourney.up.railway.app','text'],
      ['authorizationCode','Authorization Code','Code retornado após autorizar','text'],
      ['accountName','Conta / Workspace','Rótulo da conta','text']
    ];
    const expiresAt = cfg.expiresAt ? new Date(cfg.expiresAt) : null;
    const expired = expiresAt && expiresAt.getTime() <= Date.now();
    const minsLeft = expiresAt ? Math.round((expiresAt.getTime() - Date.now()) / 60000) : null;
    return `<details class="rounded-3xl border border-slate-200 bg-white p-0 shadow-sm" ${hasOAuth && !expired ? '' : ''}>
      <summary class="cursor-pointer px-5 py-4 flex items-center justify-between gap-3 list-none">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl ${hasOAuth ? (expired ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-200'} grid place-items-center ${hasOAuth ? 'text-white' : 'text-slate-500'}"><i data-lucide="mail" class="w-5 h-5"></i></div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-black text-slate-900">RD Marketing</h3>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600">opcional</span>
              ${hasOAuth ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-black ${expired ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'}">${expired ? 'expirado' : 'conectado'}</span>` : ''}
            </div>
            <p class="text-[11px] text-slate-500">${hasOAuth ? (expired ? `Token expirou há ${Math.abs(minsLeft)} min · clique pra renovar` : `Token ativo · expira em ${minsLeft} min`) : 'Conecte para automações de e-mail no futuro · não bloqueia CRM'}</p>
          </div>
        </div>
        <i data-lucide="chevron-down" class="w-5 h-5 text-slate-400"></i>
      </summary>
      <div class="px-5 pb-5 pt-2 border-t border-slate-100">
        <p class="text-xs text-slate-500 mb-3 max-w-2xl">OAuth do RD Marketing serve para futuras integrações com e-mail, contatos e KPIs. Não é necessário para CRM. <b>Você pode ignorar este passo sem perder nada.</b></p>
        <div class="grid md:grid-cols-2 gap-3 mb-4">
          ${fields.map(([f, l, p, t]) => this._input(f, l, p, t, cfg[f])).join('')}
        </div>
        <div class="flex flex-wrap gap-2">
          <button onclick="Actions.generateRDAuthUrl()" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black lj-dark-button" style="color:#fff!important;">1) Gerar URL OAuth</button>
          <button onclick="Actions.openRDAuthUrl()" class="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-black" style="color:#fff!important;">2) Abrir URL</button>
          <button onclick="Actions.exchangeRDAuthorizationCode()" class="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-black" style="color:#fff!important;">3) Trocar code por token</button>
          ${hasOAuth ? `<button onclick="Actions.refreshRDAccessToken()" class="px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-black" style="color:#fff!important;">Renovar token</button>` : ''}
          ${cfg.clientId ? `<button onclick="Actions.clearRDConfig()" class="px-4 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-xs font-black">Limpar Marketing</button>` : ''}
        </div>
        ${cfg.authUrl ? `<div class="mt-3 rounded-xl bg-slate-950 p-3">
          <p class="text-[10px] text-slate-400 font-black mb-1">URL OAuth gerada</p>
          <textarea readonly class="w-full min-h-[60px] rounded bg-slate-900 border border-white/10 text-sky-100 text-[10px] p-2 font-mono">${Utils.escape(cfg.authUrl)}</textarea>
          <p class="text-[10px] text-slate-400 mt-1">Após autorizar, copie o valor depois de <b>?code=</b> e cole em Authorization Code.</p>
        </div>` : ''}
      </div>
    </details>`;
  },

  // V22.2 — Card de diagnóstico consolidado: logs de sync, status do Live Bridge,
  // configuração de auto-sync e log de eventos RD. Tudo dobrável.
  _rdDiagnosticsBlock(rdCfg, crmCfg, hasCrmToken, hasOAuth) {
    if (!hasCrmToken && !hasOAuth) return '';
    const lastSync = crmCfg.lastSyncAt ? new Date(crmCfg.lastSyncAt).toLocaleString('pt-BR') : '—';
    const liveLastSync = App.state.rdLastSyncAt ? new Date(App.state.rdLastSyncAt).toLocaleString('pt-BR') : '—';
    const eventCount = (App.state.rdEventLog || []).length;
    return `<details class="rounded-3xl border border-slate-200 bg-white p-0 shadow-sm">
      <summary class="cursor-pointer px-5 py-4 flex items-center justify-between gap-3 list-none">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-slate-100 grid place-items-center text-slate-700"><i data-lucide="activity" class="w-5 h-5"></i></div>
          <div>
            <h3 class="font-black text-slate-900">Diagnóstico</h3>
            <p class="text-[11px] text-slate-500">Logs de sync · Live Bridge · auto-sync · eventos RD</p>
          </div>
        </div>
        <i data-lucide="chevron-down" class="w-5 h-5 text-slate-400"></i>
      </summary>
      <div class="px-5 pb-5 pt-2 border-t border-slate-100 space-y-4">
        <div class="grid md:grid-cols-3 gap-3">
          <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
            <p class="text-[10px] font-black text-slate-500 uppercase">Último sync CRM</p>
            <p class="text-sm font-black text-slate-900 mt-1">${Utils.escape(lastSync)}</p>
          </div>
          <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
            <p class="text-[10px] font-black text-slate-500 uppercase">Live Bridge</p>
            <p class="text-sm font-black text-slate-900 mt-1">${Utils.escape(liveLastSync)}</p>
          </div>
          <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
            <p class="text-[10px] font-black text-slate-500 uppercase">Eventos RD</p>
            <p class="text-sm font-black text-slate-900 mt-1">${eventCount}</p>
          </div>
        </div>

        <div class="grid md:grid-cols-2 gap-3">
          <label class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <span>
              <span class="block text-sm font-black text-slate-900">Auto-sync a cada 5 min</span>
              <span class="block text-[11px] text-slate-500">Atualiza pipelines, deals e leads automaticamente.</span>
            </span>
            <button onclick="Actions.toggleRdCrmAutoSync()" class="relative w-12 h-7 rounded-full transition ${crmCfg.autoSync ? 'bg-emerald-500' : 'bg-slate-300'}">
              <span class="absolute top-1 ${crmCfg.autoSync ? 'right-1' : 'left-1'} w-5 h-5 rounded-full bg-white shadow"></span>
            </button>
          </label>
          <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
            <p class="text-[10px] font-black text-slate-500 uppercase">Driver de sync</p>
            <select onchange="Actions.setRdCrmAutoSyncMode(this.value)" class="mt-1 w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-bold text-sm">
              <option value="frontend" ${crmCfg.autoSyncMode === 'frontend' ? 'selected' : ''}>Aba aberta (frontend)</option>
              <option value="electron" ${crmCfg.autoSyncMode === 'electron' ? 'selected' : ''}>Desktop (Electron)</option>
              <option value="backend" ${crmCfg.autoSyncMode === 'backend' ? 'selected' : ''}>Cron externo (backend)</option>
            </select>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button onclick="Actions.runRdCrmSyncNow()" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black lj-dark-button" style="color:#fff!important;"><i data-lucide="refresh-cw" class="w-3.5 h-3.5 inline mr-1"></i>Sincronizar CRM agora</button>
          <button onclick="Actions.syncRdCrmNow()" class="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-black" style="color:#fff!important;"><i data-lucide="radio-tower" class="w-3.5 h-3.5 inline mr-1"></i>Disparar Live Bridge</button>
          <button onclick="Actions.downloadStateSnapshot()" class="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-black"><i data-lucide="download" class="w-3.5 h-3.5 inline mr-1"></i>Baixar snapshot</button>
        </div>

        <div>
          <p class="text-[10px] font-black text-slate-500 uppercase mb-2">Logs recentes</p>
          <div class="rounded-2xl bg-slate-950 text-slate-200 p-3 max-h-60 overflow-auto text-[11px] font-mono space-y-1">
            ${(crmCfg.syncLogs || []).length ? (crmCfg.syncLogs || []).map(log => `<div><span class="text-slate-500">${new Date(log.at).toLocaleTimeString('pt-BR')}</span> <span class="${log.level === 'error' ? 'text-red-300' : log.level === 'warn' ? 'text-amber-300' : 'text-sky-300'}">[${log.level}]</span> ${Utils.escape(log.message)}</div>`).join('') : '<div class="text-slate-500">Sem logs ainda.</div>'}
          </div>
        </div>
      </div>
    </details>`;
  },

  // V22.2 — Placeholder visual quando uma seção depende de outra ainda não preenchida.
  _rdLockedHint(label, msg) {
    return `<div class="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-5 flex items-center gap-3 text-slate-500">
      <i data-lucide="lock" class="w-5 h-5"></i>
      <div>
        <p class="text-sm font-black text-slate-700">${Utils.escape(label)}</p>
        <p class="text-xs">${Utils.escape(msg)}</p>
      </div>
    </div>`;
  },

  // V22.3 — Detecta o passo atual da configuração baseado no state.
  // V22.3.2 — Adicionado step 'validate' (passo 1.5): força validar que
  // o token CRM funciona antes de avançar pro Passo 2 (provisionar).
  // Retorna { stage: 'crm'|'marketing'|'done', step: number|string, meta: {} }
  _rdAssistantState(rdCfg, crmCfg) {
    const hasCrmToken = Boolean((rdCfg.crmPersonalToken || '').trim());
    if (!hasCrmToken) return { stage: 'crm', step: 1 };

    // V22.3.2/V22.3.6 — Tem token mas a conexão real nunca foi testada (ou falhou).
    // Usa crmTestStatus (separado do OAuth status) para não ser sobrescrito
    // por falhas do exchange OAuth Marketing.
    const isValidated = rdCfg.crmTestStatus === 'connected' && Boolean(rdCfg.crmTestAt);
    if (!isValidated) {
      return { stage: 'crm', step: 'validate', lastStatus: rdCfg.crmTestStatus || '' };
    }

    const campaigns = Array.isArray(App.state.campaigns) ? App.state.campaigns : [];
    const eligibleCampaigns = campaigns.filter(c => window.RdCrmSyncEngine?._shouldSyncCampaign?.(c));
    const byCampaign = crmCfg.pipelinesByCampaign || {};
    const provisionedIds = new Set(Object.keys(byCampaign).map(k => Number(k)));
    const pendingPipelines = eligibleCampaigns.filter(c => !provisionedIds.has(Number(c.id)));
    if (pendingPipelines.length > 0) {
      return { stage: 'crm', step: 2, pending: pendingPipelines };
    }

    // Conta leads vinculados a campanhas com pipeline provisionado, sem deal.
    const dealsByLead = crmCfg.dealsByLead || {};
    let leadsAwaitingPush = 0;
    const pushBreakdown = [];
    for (const c of eligibleCampaigns) {
      const leads = window.LeadBaseService?.forCampaign?.(c.id) || [];
      const unsynced = leads.filter(l => {
        const key = window.LeadBaseService?.keyOf?.(l);
        if (!key) return false;
        return !dealsByLead[key]?.[c.id];
      });
      if (unsynced.length > 0) {
        leadsAwaitingPush += unsynced.length;
        pushBreakdown.push({ campaign: c, count: unsynced.length });
      }
    }
    if (leadsAwaitingPush > 0) {
      return { stage: 'crm', step: 3, leadsAwaitingPush, breakdown: pushBreakdown };
    }

    // CRM completo. Olha Marketing.
    if (rdCfg.accessToken) return { stage: 'done', step: 'done' };
    // V22.3.7 — Se usuário pulou Marketing, vai direto pra done.
    if (App.state.rdMarketingSkipped) return { stage: 'done', step: 'done' };
    if (!rdCfg.clientId || !rdCfg.clientSecret) return { stage: 'marketing', step: 'm1' };
    if (!rdCfg.authUrl) return { stage: 'marketing', step: 'm2' };
    if (!rdCfg.authorizationCode) return { stage: 'marketing', step: 'm3' };
    // V22.3.7 — Detecta falha do último exchange para mostrar mensagem
    // específica + opção de pular.
    return { stage: 'marketing', step: 'm4', lastExchangeStatus: rdCfg.status || '' };
  },

  // V22.3.1 — Assistente focado em ENSINO. Cards visuais grandes,
  // CTA principal sempre visível, instruções passo-a-passo claras.
  // Diagnóstico (status/breadcrumb) removido — fica no Stepper acima.
  _rdAssistantBlock(rdCfg, crmCfg) {
    if (App.state.rdAssistantDismissed) return '';
    const state = this._rdAssistantState(rdCfg, crmCfg);
    const origin = window.location.origin || 'https://leadjourney.up.railway.app';

    if (state.stage === 'done') return this._rdAssistantDoneCard();

    const body = state.stage === 'crm'
      ? this._rdAssistantCrmContent(state, origin)
      : this._rdAssistantMarketingContent(state, rdCfg, origin);

    return `<div class="rounded-3xl bg-white border-2 border-sky-300 shadow-md relative overflow-hidden">
      <div class="bg-gradient-to-r from-sky-600 to-indigo-600 px-6 py-3 flex items-center justify-between text-white">
        <div class="flex items-center gap-2">
          <i data-lucide="sparkles" class="w-5 h-5"></i>
          <span class="font-black text-sm uppercase tracking-wider">Assistente · te ensina a conectar</span>
        </div>
        <button onclick="Actions.toggleRdAssistant()" title="Fechar assistente" class="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center text-white"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
      </div>
      <div class="p-6">
        ${body}
      </div>
    </div>`;
  },

  // V22.3.1 — Helper: renderiza UM substep visual com circle número + texto.
  _rdAssistantSubstep(num, html) {
    return `<div class="flex items-start gap-3 py-2">
      <div class="w-7 h-7 rounded-full bg-sky-100 text-sky-900 grid place-items-center text-sm font-black shrink-0 mt-0.5">${num}</div>
      <div class="text-sm text-slate-800 leading-relaxed flex-1 min-w-0">${html}</div>
    </div>`;
  },

  // V22.3.1 — Botão CTA gigante usado no topo de cada passo.
  _rdAssistantBigButton(href, label, icon, action) {
    if (href) {
      return `<a href="${href}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm no-underline transition shadow-lg" style="color:#fff;">
        <i data-lucide="${icon}" class="w-5 h-5"></i>
        <span>${Utils.escape(label)}</span>
        <i data-lucide="arrow-right" class="w-4 h-4 ml-1"></i>
      </a>`;
    }
    return `<button onclick="${action}" class="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm transition shadow-lg" style="color:#fff;">
      <i data-lucide="${icon}" class="w-5 h-5"></i>
      <span>${Utils.escape(label)}</span>
      <i data-lucide="arrow-right" class="w-4 h-4 ml-1"></i>
    </button>`;
  },

  // V22.3.1 — Card de aviso amber (pegadinhas que descobrimos em produção).
  _rdAssistantWarning(html) {
    return `<div class="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
      <i data-lucide="alert-triangle" class="w-5 h-5 text-amber-600 mt-0.5 shrink-0"></i>
      <div class="text-sm text-amber-900 leading-relaxed">${html}</div>
    </div>`;
  },

  // V22.3.1 — Indicador "olhe ali embaixo" apontando pro próximo input.
  _rdAssistantArrowDown(text) {
    return `<div class="mt-4 rounded-2xl bg-sky-50 border-2 border-dashed border-sky-300 p-4 flex items-center gap-3 animate-pulse">
      <i data-lucide="arrow-down-circle" class="w-6 h-6 text-sky-600 shrink-0"></i>
      <div class="text-sm font-black text-sky-900">${Utils.escape(text)}</div>
    </div>`;
  },

  // V22.3.1 — Conteúdo dos passos CRM (versão pedagógica).
  _rdAssistantCrmContent(state, origin) {
    // V22.3.2 — Passo intermediário: validar que o token realmente funciona.
    if (state.step === 'validate') {
      const failed = state.lastStatus && state.lastStatus !== 'connected' && state.lastStatus !== '';
      const failedTone = failed ? 'text-red-900' : 'text-slate-950';
      return `<div>
        <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">✓ Token salvo · Passo 1.5 de 3</p>
        <h3 class="text-2xl font-black ${failedTone} mb-2">Validar a conexão com o RD CRM</h3>
        <p class="text-sm text-slate-600 mb-5">Você colou um token. Antes de provisionar pipelines, vamos garantir que o RD <b>aceita</b> esse token. O teste manda uma chamada real à API do RD.</p>

        <div class="mb-5">
          ${this._rdAssistantBigButton(null, 'Testar conexão agora', 'activity', 'Actions.testRDConnection()')}
        </div>

        ${failed ? `<div class="rounded-2xl bg-red-50 border-2 border-red-200 p-4 mb-4">
          <div class="flex items-start gap-3">
            <i data-lucide="x-circle" class="w-5 h-5 text-red-600 mt-0.5 shrink-0"></i>
            <div>
              <p class="font-black text-red-900 mb-1">Último teste falhou</p>
              <p class="text-sm text-red-800">Status retornado: <code class="bg-white px-1.5 py-0.5 rounded font-mono text-[11px]">${Utils.escape(state.lastStatus)}</code>. O token pode estar errado ou expirado. Gere um novo em <b>RD CRM → Integrações</b> e cole no campo "Token pessoal do CRM" — depois clique "Testar conexão agora" de novo.</p>
            </div>
          </div>
        </div>` : ''}

        <p class="text-sm font-black text-slate-700 mb-2">O que vai acontecer ao clicar:</p>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-2 divide-y divide-slate-200">
          ${this._rdAssistantSubstep(1, 'O Journey faz um <b>GET /deal_pipelines</b> na API real do RD CRM usando seu token.')}
          ${this._rdAssistantSubstep(2, 'Se o RD aceitar (200 OK), pulamos pro Passo 2 — Provisionar pipelines.')}
          ${this._rdAssistantSubstep(3, 'Se o RD recusar (401/403), o card vira vermelho com instruções pra gerar novo token.')}
        </div>

        ${this._rdAssistantWarning('<b>Provisionar pipelines está bloqueado</b> até esse teste passar. Sem validação real, o Journey nem deixa você avançar — evita criar pipelines com token quebrado.')}
      </div>`;
    }

    if (state.step === 1) {
      return `<div>
        <p class="text-[10px] font-black text-sky-700 uppercase tracking-widest mb-1">Passo 1 de 3</p>
        <h3 class="text-2xl font-black text-slate-950 mb-2">Pegar seu Token no RD CRM</h3>
        <p class="text-sm text-slate-600 mb-5">Leva ~45 segundos. Esse token autoriza o Journey a criar pipelines, mover deals e ler tags no seu RD CRM.</p>

        <div class="mb-5">
          ${this._rdAssistantBigButton('https://crm.rdstation.com', 'Abrir RD CRM agora', 'external-link')}
        </div>

        <p class="text-sm font-black text-slate-700 mb-2">Depois de abrir, faça nessa ordem:</p>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-2 divide-y divide-slate-200">
          ${this._rdAssistantSubstep(1, 'No topo direito do RD CRM, clique no ícone de <b>engrenagem ⚙</b>.')}
          ${this._rdAssistantSubstep(2, 'Clique em <b>Todas as configurações</b> (link azul no fim do dropdown).')}
          ${this._rdAssistantSubstep(3, 'No menu lateral da nova tela, procure por <b>Integrações</b> ou <b>API</b>.')}
          ${this._rdAssistantSubstep(4, 'Encontre <b>Token de API</b> e clique em <b>Gerar token</b>.')}
          ${this._rdAssistantSubstep(5, 'Copie o valor exibido — <b>ele só aparece UMA vez</b>.')}
          ${this._rdAssistantSubstep(6, 'Volte aqui e cole abaixo, no campo <b>"Token pessoal do CRM"</b>.')}
        </div>

        ${this._rdAssistantArrowDown('Cole o token no campo abaixo ↓')}

        ${this._rdAssistantWarning('<b>Esse token NÃO é Client ID/Secret.</b> Aquele fluxo (OAuth) é só para o RD Marketing, fica colapsado mais abaixo e é OPCIONAL. Você pode ignorar.')}
      </div>`;
    }

    if (state.step === 2) {
      const list = (state.pending || []).map(c => `<div class="flex items-center justify-between gap-2 py-2.5">
        <div class="flex items-center gap-2 min-w-0">
          <i data-lucide="git-branch" class="w-4 h-4 text-slate-500 shrink-0"></i>
          <span class="text-sm font-black text-slate-900 truncate">${Utils.escape(c.name)}</span>
        </div>
        <button onclick="Actions.generateCampaignPipeline(${c.id})" class="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black flex items-center gap-1.5" style="color:#fff;">Provisionar <i data-lucide="arrow-right" class="w-3 h-3"></i></button>
      </div>`).join('');
      return `<div>
        <p class="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">✓ Token CRM autorizado · Passo 2 de 3</p>
        <h3 class="text-2xl font-black text-slate-950 mb-2">Criar pipelines no RD para suas campanhas</h3>
        <p class="text-sm text-slate-600 mb-5">Cada campanha vira um pipeline próprio no RD CRM com <b>9 etapas</b> (Mkt/Vendas/CS × TOF/MOF/BOF).</p>

        <div class="mb-5">
          ${this._rdAssistantBigButton(null, `Provisionar todas (${state.pending.length})`, 'zap', 'Actions.syncAllCampaignPipelines()')}
        </div>

        <p class="text-sm font-black text-slate-700 mb-2">Ou provisione uma de cada vez:</p>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-1 divide-y divide-slate-200">
          ${list}
        </div>

        <div class="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600 leading-relaxed">
          <b class="text-slate-900">ℹ O que acontece:</b><br>
          Pipelines existentes na sua conta RD <b>não são tocados</b> — usamos sufixo numérico se houver colisão de nome. Etapas default do RD são <b>renomeadas</b> pra Marketing TOF/MOF/BOF (não deletadas).
        </div>
      </div>`;
    }

    if (state.step === 3) {
      const list = (state.breakdown || []).map(b => `<div class="flex items-center justify-between gap-2 py-2.5">
        <div class="flex items-center gap-2 min-w-0">
          <i data-lucide="users" class="w-4 h-4 text-slate-500 shrink-0"></i>
          <div class="min-w-0">
            <span class="block text-sm font-black text-slate-900 truncate">${Utils.escape(b.campaign.name)}</span>
            <span class="block text-[11px] text-slate-500">${b.count} lead(s) prontos</span>
          </div>
        </div>
        <button onclick="Actions.pushCampaignICPToRD(${b.campaign.id})" class="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black flex items-center gap-1.5" style="color:#fff;">Enviar <i data-lucide="send" class="w-3 h-3"></i></button>
      </div>`).join('');
      return `<div>
        <p class="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">✓ Token CRM · ✓ Pipelines · Passo 3 de 3</p>
        <h3 class="text-2xl font-black text-slate-950 mb-2">Enviar leads para o RD CRM</h3>
        <p class="text-sm text-slate-600 mb-5">Cada lead vira um <b>deal</b> em Marketing TOF do pipeline da sua campanha. O valor inicial vem do Ticket Médio do produto.</p>

        <p class="text-sm font-black text-slate-700 mb-2">${state.leadsAwaitingPush} lead(s) aguardando envio:</p>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-1 divide-y divide-slate-200">
          ${list}
        </div>

        <div class="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600 leading-relaxed">
          <b class="text-slate-900">ℹ Depois disso:</b><br>
          Conforme o lead avança no fluxo das ações (ex: clica no link da LP), o Journey move o deal entre as etapas do pipeline RD automaticamente. Sem clique manual.
        </div>
      </div>`;
    }
    return '';
  },

  // V22.3.1 — Conteúdo dos passos Marketing (versão pedagógica).
  _rdAssistantMarketingContent(state, rdCfg, origin) {
    if (state.step === 'm1') {
      return `<div>
        <p class="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">✓ CRM completo · OAuth Marketing · Passo 1 de 4</p>
        <h3 class="text-2xl font-black text-slate-950 mb-2">Criar o app no Publisher do RD</h3>
        <p class="text-sm text-slate-600 mb-5">Este é <b>opcional</b>. Só conecte se for usar features de e-mail/marketing no Journey no futuro.</p>

        <div class="mb-5">
          ${this._rdAssistantBigButton('https://appstore.rdstation.com/pt-BR/publisher', 'Abrir Publisher RD', 'external-link')}
        </div>

        <p class="text-sm font-black text-slate-700 mb-2">No publisher, faça:</p>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-2 divide-y divide-slate-200">
          ${this._rdAssistantSubstep(1, 'Clique em <b>Criar app</b>.')}
          ${this._rdAssistantSubstep(2, 'Nome: <b>LeadJourney Marketing</b> (ou outro). Tipo: <b>Privado</b>. Produto: <b>RD Station Marketing</b>.')}
          ${this._rdAssistantSubstep(3, `URL de Callback: <code class="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-800 font-mono text-[11px]">${Utils.escape(origin)}</code><button onclick="navigator.clipboard.writeText('${Utils.escape(origin)}'); Utils.toast('URL copiada')" class="ml-2 px-2 py-0.5 rounded bg-sky-600 text-white text-[10px] font-black" style="color:#fff;">copiar</button>`)}
          ${this._rdAssistantSubstep(4, 'Marque <b>TODAS</b> as permissões disponíveis.')}
          ${this._rdAssistantSubstep(5, 'Salve. Copie <b>Client ID</b> e <b>Client Secret</b> da próxima tela.')}
          ${this._rdAssistantSubstep(6, 'Cole eles no bloco <b>RD Marketing</b> mais abaixo nesta página (clique pra expandir).')}
        </div>

        ${this._rdAssistantWarning('A URL de Callback deve ser <b>exatamente</b> a do origin — sem barra no final, sem path. Erro mais comum: <code>invalid_redirect_uri</code>.')}
      </div>`;
    }

    if (state.step === 'm2') {
      return `<div>
        <p class="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Marketing · Passo 2 de 4</p>
        <h3 class="text-2xl font-black text-slate-950 mb-2">Gerar URL de autorização</h3>
        <p class="text-sm text-slate-600 mb-5">Você já preencheu Client ID e Secret. Vamos gerar a URL OAuth.</p>

        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3 mb-5">
          <p class="text-[10px] font-black text-slate-500 uppercase">Client ID detectado</p>
          <code class="block mt-1 font-mono text-xs text-slate-800">${Utils.escape(String(rdCfg.clientId || '').slice(0, 16))}…</code>
        </div>

        <div class="mb-3">
          ${this._rdAssistantBigButton(null, 'Gerar URL OAuth agora', 'link', 'Actions.generateRDAuthUrl()')}
        </div>

        <p class="text-xs text-slate-500">Após clicar, a URL gerada aparece no bloco RD Marketing abaixo. O próximo passo será abri-la.</p>
      </div>`;
    }

    if (state.step === 'm3') {
      return `<div>
        <p class="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Marketing · Passo 3 de 4</p>
        <h3 class="text-2xl font-black text-slate-950 mb-2">Autorizar no RD e copiar o "code"</h3>
        <p class="text-sm text-slate-600 mb-5">O RD precisa que você autorize. Depois ele devolve um <b>code temporário</b> (parecido com uma senha de uso único) que cola aqui pra fechar a conexão.</p>

        <div class="mb-5">
          ${this._rdAssistantBigButton(null, 'Abrir URL OAuth no RD', 'external-link', 'Actions.openRDAuthUrl()')}
        </div>

        <p class="text-sm font-black text-slate-700 mb-2">Quando abrir a nova aba do RD:</p>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-2 divide-y divide-slate-200">
          ${this._rdAssistantSubstep(1, 'Se pedir, faça login na sua conta RD.')}
          ${this._rdAssistantSubstep(2, 'Aparece uma tela "<b>Você autoriza o LeadJourney a acessar sua conta?</b>". Clique no botão verde/azul <b>Autorizar</b> ou <b>Conectar</b>.')}
          ${this._rdAssistantSubstep(3, `Após autorizar, o RD <b>redireciona automaticamente</b> a aba pra uma URL nossa, com o code anexado. Ela vai parecer assim na barra de endereço:<br>
            <div class="mt-2 rounded-xl bg-white border-2 border-sky-300 p-3">
              <p class="text-[10px] font-black text-slate-500 uppercase mb-1">URL que vai aparecer</p>
              <code class="block text-[11px] font-mono break-all leading-relaxed">${Utils.escape(origin)}/?code=<span class="bg-yellow-200 text-yellow-900 px-1 py-0.5 rounded">a1b2c3d4e5f6...</span></code>
              <p class="text-[10px] text-slate-500 mt-2">↑ a parte <span class="bg-yellow-200 text-yellow-900 px-1 rounded font-black">amarela</span> é o seu code. Você copia <b>só ela</b>.</p>
            </div>`)}
          ${this._rdAssistantSubstep(4, `<b>NÃO clique em nada na aba do RD ainda.</b> Faça assim pra copiar SÓ o code:
            <ol class="mt-2 ml-4 list-[lower-alpha] text-xs space-y-1.5">
              <li>Clique <b>uma vez</b> dentro da barra de endereço (URL) lá em cima.</li>
              <li>Com o mouse, <b>arraste pra selecionar</b> apenas os caracteres DEPOIS de <code>?code=</code>. Se houver um <code>&</code> no final, pare antes dele.</li>
              <li>Ou mais fácil: dê <b>Ctrl+L</b> (Windows) ou <b>⌘+L</b> (Mac) pra selecionar a URL toda. Depois recorte: dê Ctrl+C, abra o Bloco de Notas, cole, e edite tirando tudo que vem antes do código.</li>
              <li>Aperte <b>Ctrl+C</b> (Cmd+C no Mac) com o code selecionado.</li>
            </ol>`)}
          ${this._rdAssistantSubstep(5, 'Volte pra esta aba do LeadJourney. Role um pouco pra baixo até achar o bloco <b>RD Marketing ▾</b>, clique pra expandir, e cole no campo <b>Authorization Code</b> com <b>Ctrl+V</b> (Cmd+V no Mac).')}
        </div>

        <div class="mt-4 rounded-2xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
          <i data-lucide="alert-circle" class="w-5 h-5 text-red-600 mt-0.5 shrink-0"></i>
          <div class="text-sm text-red-900 leading-relaxed">
            <b>Se você atualizar (F5) a aba do RD por engano:</b> o code desaparece e o RD esquece. Volta aqui no Journey e clica em <b>"Abrir URL OAuth no RD"</b> de novo — gera um novo code limpo.
          </div>
        </div>

        ${this._rdAssistantWarning('O code <b>expira em ~5 minutos</b> e só pode ser usado uma vez. Por isso a pressa: copie e cole rapidinho. Se demorar, refaça o passo 2 (gerar URL nova).')}
      </div>`;
    }

    if (state.step === 'm4') {
      const accessDenied = state.lastExchangeStatus === 'exchange_failed';
      return `<div>
        <p class="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Marketing · Passo 4 de 4 ${accessDenied ? '· falha anterior' : ''}</p>
        <h3 class="text-2xl font-black text-slate-950 mb-2">Trocar o code por um token de verdade</h3>
        <p class="text-sm text-slate-600 mb-5">Último passo. Vamos pedir ao RD pra trocar o code que você colou por um access_token + refresh_token (válido por 24h, com renovação automática).</p>

        <div class="mb-5">
          ${this._rdAssistantBigButton(null, 'Trocar code por token', 'repeat', 'Actions.exchangeRDAuthorizationCode()')}
        </div>

        ${accessDenied ? `<div class="rounded-2xl bg-red-50 border-2 border-red-200 p-4 mb-4">
          <div class="flex items-start gap-3 mb-3">
            <i data-lucide="alert-octagon" class="w-5 h-5 text-red-600 mt-0.5 shrink-0"></i>
            <div>
              <p class="font-black text-red-900 mb-1">Última troca falhou (ACCESS_DENIED)</p>
              <p class="text-sm text-red-900 leading-relaxed">A causa mais comum desse erro: o app no RD foi criado com produto <b>"RD Station CRM"</b> em vez de <b>"RD Station Marketing"</b>. OAuth Marketing exige um app marcado como Marketing.</p>
            </div>
          </div>
          <p class="text-sm font-black text-red-900 mb-2">2 jeitos de resolver:</p>
          <div class="space-y-3 ml-2">
            <div class="rounded-xl bg-white border border-red-200 p-3">
              <p class="text-sm font-black text-slate-900 mb-1">Caminho A — Criar app correto no RD <span class="text-[10px] font-black bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">~3 min</span></p>
              <p class="text-xs text-slate-600 mb-2">Você cria um app NOVO no publisher do RD, agora com produto <b>"RD Station Marketing"</b>. Copia Client ID/Secret novos, volta ao Passo 1 do assistente.</p>
              <a href="https://appstore.rdstation.com/pt-BR/publisher" target="_blank" class="inline-flex items-center gap-1.5 text-xs font-black text-sky-700 no-underline hover:underline">Abrir publisher RD <i data-lucide="external-link" class="w-3 h-3"></i></a>
            </div>
            <div class="rounded-xl bg-white border border-slate-200 p-3">
              <p class="text-sm font-black text-slate-900 mb-1">Caminho B — Pular RD Marketing por enquanto <span class="text-[10px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">recomendado</span></p>
              <p class="text-xs text-slate-600 mb-2">Marketing OAuth é <b>opcional</b>. Hoje você não usa features de e-mail no Journey. Pula e foca no CRM (que já está funcionando).</p>
              <button onclick="Actions.skipMarketingOAuth()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-black" style="color:#fff;"><i data-lucide="skip-forward" class="w-3 h-3"></i>Pular RD Marketing</button>
            </div>
          </div>
        </div>` : `<div class="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600 leading-relaxed">
          <b class="text-slate-900">Se der erro:</b> a mensagem mais comum é <code>invalid_grant</code>, que significa que o code expirou (>5min) ou já foi usado. Solução: volte ao passo 3 e gere um code novo.<br>
          <br>
          Outro erro comum é <code>ACCESS_DENIED</code> — significa que o app foi criado no RD com produto errado. Se aparecer, o assistente vai te guiar.<br>
          <br>
          <button onclick="Actions.skipMarketingOAuth()" class="text-sky-700 underline font-black text-xs">Não quero conectar Marketing agora — pular este passo</button>
        </div>`}
      </div>`;
    }
    return '';
  },

  // V22.3 — Estado final do assistente. Compacto, ainda visível mas só celebrando.
  // V22.3.7 — Mensagem adapta se o Marketing foi pulado (rdMarketingSkipped).
  _rdAssistantDoneCard() {
    const mktSkipped = Boolean(App.state.rdMarketingSkipped);
    const hasOAuth = Boolean(App.state.integrations?.rd?.accessToken);
    return `<div class="rounded-3xl bg-gradient-to-r from-emerald-50 to-sky-50 border-2 border-emerald-200 p-4 relative overflow-hidden">
      <button onclick="Actions.toggleRdAssistant()" title="Dispensar assistente" class="absolute top-3 right-3 w-8 h-8 rounded-full bg-white hover:bg-slate-50 grid place-items-center text-slate-500"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-2xl bg-emerald-500 grid place-items-center text-white"><i data-lucide="check-check" class="w-5 h-5"></i></div>
        <div class="flex-1 pr-8">
          <h4 class="font-black text-emerald-900">${hasOAuth ? 'Tudo conectado.' : 'CRM conectado e operando.'}</h4>
          <p class="text-xs text-emerald-800 mt-1">${hasOAuth
            ? 'CRM + Marketing autorizados. O Journey sincroniza pipelines, deals e leads automaticamente a cada 5 min.'
            : (mktSkipped
              ? 'CRM 100% operacional. RD Marketing foi pulado — não bloqueia nada hoje. Mudou de ideia? <button onclick="Actions.unskipMarketingOAuth()" class="underline font-black text-emerald-900">Conectar Marketing agora</button>.'
              : 'CRM 100% operacional. Você pode dispensar o assistente — voltar é sempre uma engrenagem.')}</p>
        </div>
      </div>
    </div>`;
  },

  // V21.8 — Card mostrando status do OAuth: tem accessToken? quando expira?
  _rdTokenStatusBlock(cfg) {
    const hasAccess = Boolean(cfg.accessToken);
    const hasRefresh = Boolean(cfg.refreshToken);
    const expiresAt = cfg.expiresAt ? new Date(cfg.expiresAt) : null;
    const now = Date.now();
    const expired = expiresAt && expiresAt.getTime() <= now;
    const minsLeft = expiresAt ? Math.round((expiresAt.getTime() - now) / 60000) : null;
    const tone = hasAccess && !expired ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
      : hasAccess && expired ? 'bg-amber-50 border-amber-200 text-amber-800'
      : 'bg-slate-50 border-slate-200 text-slate-600';
    const label = !hasAccess ? 'Sem token — complete o passo 3 (Trocar code por token).'
      : expired ? `Token expirado há ${Math.abs(minsLeft)} min. Clique em Renovar token.`
      : `Token ativo. Expira em ${minsLeft} min.${hasRefresh ? '' : ' (Sem refresh_token — refresh automático indisponível.)'}`;
    return `<div class="mt-4 rounded-2xl border ${tone} p-3 text-xs font-black flex items-start gap-2">
      <i data-lucide="${hasAccess && !expired ? 'shield-check' : expired ? 'clock' : 'shield-alert'}" class="w-4 h-4 mt-0.5"></i>
      <div class="flex-1">
        <div>${Utils.escape(label)}</div>
        ${hasAccess ? `<div class="font-mono text-[10px] opacity-75 mt-1 break-all">access_token: ${Utils.escape(String(cfg.accessToken).slice(0, 12))}…${Utils.escape(String(cfg.accessToken).slice(-6))}</div>` : ''}
      </div>
    </div>`;
  },

  _statusBadge() {
    const result = App.state.databaseTestResult;
    const testing = App.state.databaseTesting;
    if (testing) return `<span class="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border bg-sky-50 border-sky-200 text-sky-700 text-xs font-black"><span class="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span> Testando conexão...</span>`;
    if (!result) return `<span class="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border bg-slate-50 border-slate-200 text-slate-600 text-xs font-black"><span class="w-2 h-2 rounded-full bg-slate-400"></span> Não testado ainda</span>`;
    return result.ok
      ? `<span class="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border bg-emerald-50 border-emerald-200 text-emerald-700 text-xs font-black"><i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> Conectado</span>`
      : `<span class="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border bg-red-50 border-red-200 text-red-700 text-xs font-black"><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> Precisa de ajustes</span>`;
  },

  _environmentBanner() {
    const isDesktop = DatabaseService.isDesktop();
    const supportsPicker = DatabaseService.supportsDirectoryPicker();
    if (isDesktop) {
      return `<div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
        <div class="w-9 h-9 rounded-xl bg-white grid place-items-center"><i data-lucide="laptop" class="w-4 h-4 text-emerald-700"></i></div>
        <div>
          <p class="text-sm font-black text-emerald-900">App Desktop ativo</p>
          <p class="text-xs text-emerald-800">Você pode digitar o caminho exato da pasta (ex.: <code>D:/LeadJourneyData</code>) ou clicar em "Escolher pasta" para usar o seletor do sistema. O Electron grava direto no disco.</p>
        </div>
      </div>`;
    }
    if (supportsPicker) {
      return `<div class="rounded-2xl border border-sky-200 bg-sky-50 p-4 flex items-start gap-3">
        <div class="w-9 h-9 rounded-xl bg-white grid place-items-center"><i data-lucide="globe" class="w-4 h-4 text-sky-700"></i></div>
        <div>
          <p class="text-sm font-black text-sky-900">Modo Navegador (Chrome/Edge)</p>
          <p class="text-xs text-sky-800">No browser, você precisa clicar em "Escolher pasta no computador" para autorizar gravação. Digitar o caminho não basta — é uma regra de segurança do navegador.</p>
        </div>
      </div>`;
    }
    return `<div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
      <div class="w-9 h-9 rounded-xl bg-white grid place-items-center"><i data-lucide="alert-triangle" class="w-4 h-4 text-amber-700"></i></div>
      <div>
        <p class="text-sm font-black text-amber-900">Navegador sem suporte a pasta local</p>
        <p class="text-xs text-amber-800">Use Chrome ou Edge atualizado, ou rode o app desktop (Electron). O fallback no localStorage continua funcionando.</p>
      </div>
    </div>`;
  },

  _resultCard() {
    const result = App.state.databaseTestResult;
    if (!result) return '';
    const palette = result.ok
      ? { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', icon: 'check-circle-2', iconColor: 'text-emerald-700' }
      : { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', icon: 'alert-octagon', iconColor: 'text-red-700' };
    const when = result.testedAt ? new Date(result.testedAt).toLocaleString('pt-BR') : '—';
    return `<div class="rounded-2xl border ${palette.bg} ${palette.border} p-4">
      <div class="flex items-start gap-3">
        <div class="w-9 h-9 rounded-xl bg-white grid place-items-center"><i data-lucide="${palette.icon}" class="w-4 h-4 ${palette.iconColor}"></i></div>
        <div class="flex-1">
          <p class="text-sm font-black ${palette.text}">${result.ok ? 'Tudo certo!' : 'Conexão não validada'}</p>
          <p class="text-xs ${palette.text} opacity-90 mt-0.5">${Utils.escape(result.message || '')}</p>
          <p class="text-[11px] ${palette.text} opacity-70 mt-1">Testado em ${Utils.escape(when)}</p>
        </div>
      </div>
    </div>`;
  },

  _folderStatusCard(local) {
    const path = local?.folderPath || '';
    const label = local?.folderLabel || '';
    const writeAt = local?.lastFolderWriteAt ? new Date(local.lastFolderWriteAt).toLocaleString('pt-BR') : '—';
    const readAt = local?.lastFolderReadAt ? new Date(local.lastFolderReadAt).toLocaleString('pt-BR') : '—';
    const hasFolder = Boolean(path || label);
    if (!hasFolder) {
      return `<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-center">
        <div class="w-10 h-10 rounded-xl bg-slate-100 grid place-items-center mx-auto mb-2"><i data-lucide="folder-x" class="w-5 h-5 text-slate-400"></i></div>
        <p class="text-sm font-black text-slate-700">Nenhuma pasta vinculada ainda</p>
        <p class="text-xs text-slate-500 mt-1">Clique em "Escolher pasta no computador" abaixo para começar.</p>
      </div>`;
    }
    return `<div class="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl bg-white grid place-items-center"><i data-lucide="folder-check" class="w-5 h-5 text-emerald-700"></i></div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-black text-emerald-900">Pasta vinculada</p>
          <p class="text-xs text-emerald-800 truncate">${Utils.escape(label || path)}</p>
          ${path && label && path !== label ? `<p class="text-[11px] text-emerald-700/80 truncate">${Utils.escape(path)}</p>` : ''}
          <p class="text-[11px] text-emerald-700 mt-1">Última gravação: ${Utils.escape(writeAt)} • Última leitura: ${Utils.escape(readAt)}</p>
        </div>
      </div>
    </div>`;
  },

  _localPanel(cfg) {
    const local = cfg.local || {};
    const testing = App.state.databaseTesting;
    const isDesktop = DatabaseService.isDesktop();
    const supportsPicker = DatabaseService.supportsDirectoryPicker();
    const canPickFolder = isDesktop || supportsPicker;
    const choosePathDisabled = !canPickFolder;
    const fileNameValue = local.fileName || DatabaseService.localFileName;

    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm space-y-5">
      <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-2 mb-1"><i data-lucide="hard-drive" class="w-5 h-5 text-slate-700"></i><h3 class="text-xl font-black text-slate-950">Banco Local</h3></div>
          <p class="text-sm text-slate-500 max-w-xl">3 passos para deixar o app gravando direto no seu computador. Os dados ficam offline e ao seu controle.</p>
        </div>
        ${this._statusBadge()}
      </div>

      ${this._environmentBanner()}

      <div class="grid lg:grid-cols-3 gap-3">
        ${this._stepCard(1, 'Escolha a pasta', 'Selecione onde os dados serão gravados no computador.', !!(local.folderPath || local.folderLabel))}
        ${this._stepCard(2, 'Configure (opcional)', 'Ajuste nome do arquivo, namespace e sincronização automática.', Boolean(local.fileName))}
        ${this._stepCard(3, 'Teste e salve', 'Rode o teste e clique em salvar para fixar a configuração.', Boolean(App.state.databaseTestResult?.ok))}
      </div>

      ${this._folderStatusCard(local)}

      <div class="flex flex-wrap gap-3">
        <button onclick="Actions.chooseLocalDatabaseFolder()" ${choosePathDisabled ? 'disabled' : ''} class="px-5 py-3 rounded-2xl ${choosePathDisabled ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'} font-black flex items-center gap-2 lj-dark-button" style="${choosePathDisabled ? '' : 'color:#fff!important;'}"><i data-lucide="folder-open" class="w-4 h-4"></i> Escolher pasta no computador</button>
        <button onclick="Actions.writeLocalFolderSnapshot()" class="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black hover:bg-slate-50 flex items-center gap-2"><i data-lucide="download" class="w-4 h-4"></i> Salvar snapshot agora</button>
        <button onclick="Actions.readLocalFolderSnapshot()" class="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black hover:bg-slate-50 flex items-center gap-2"><i data-lucide="upload" class="w-4 h-4"></i> Ler snapshot da pasta</button>
      </div>

      <details class="rounded-2xl border border-slate-200 bg-slate-50 p-4" ${App.state.showDatabaseTutorial ? 'open' : ''}>
        <summary class="cursor-pointer text-sm font-black text-slate-700 flex items-center gap-2" onclick="event.preventDefault(); Actions.toggleDatabaseTutorial();"><i data-lucide="sliders" class="w-4 h-4"></i> Opções avançadas (caminho, namespace, sync)</summary>
        <div class="mt-4 grid md:grid-cols-2 gap-4">
          ${this._dbInput('local.folderPath', 'Caminho da pasta (texto)', 'Ex.: D:/LeadJourneyData', 'text', local.folderPath, isDesktop ? 'Em Desktop, este valor é usado direto. No browser, serve apenas como referência — a autorização vem do botão.' : 'Em browser puro, este campo é só referência. Use o botão "Escolher pasta".')}
          ${this._dbInput('local.fileName', 'Nome do arquivo do banco', DatabaseService.localFileName, 'text', fileNameValue, 'Nome do JSON que o app criará dentro da pasta.')}
          ${this._dbInput('local.namespace', 'Namespace (fallback no navegador)', 'leadscore_local_db', 'text', local.namespace, 'Chave usada se o navegador cair no fallback de localStorage.')}
          ${this._dbToggle('local.autosync', 'Sincronização automática', local.autosync, 'Salva snapshot ao detectar alterações.')}
          ${this._dbToggle('local.browserStorageFallback', 'Fallback no navegador', local.browserStorageFallback, 'Mantém cópia no localStorage se a pasta não estiver acessível.')}
          ${this._dbSelect('local.mode', 'Modo de gravação', [{ value: 'folder', label: 'Pasta (recomendado)' }, { value: 'browser', label: 'Somente navegador' }], local.mode || 'folder')}
        </div>
      </details>

      ${this._resultCard()}

      <div class="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
        <button onclick="Actions.testDatabaseConnection()" ${testing ? 'disabled' : ''} class="px-5 py-3 rounded-2xl ${testing ? 'bg-slate-300 text-slate-600 cursor-wait' : 'bg-slate-900 hover:bg-slate-800 text-white'} font-black flex items-center gap-2 lj-dark-button" style="${testing ? '' : 'color:#fff!important;'}">
          ${testing ? '<span class="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin"></span> Testando...' : '<i data-lucide="activity" class="w-4 h-4"></i> Testar conexão'}
        </button>
        <button onclick="Actions.saveDatabaseConfig()" class="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-2"><i data-lucide="save" class="w-4 h-4"></i> Salvar configuração</button>
        <button onclick="Actions.syncDatabaseNow()" class="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black hover:bg-slate-50 flex items-center gap-2"><i data-lucide="refresh-cw" class="w-4 h-4"></i> Sincronizar agora</button>
      </div>
    </div>`;
  },

  _stepCard(number, title, hint, done) {
    const stateClass = done ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200';
    const circleClass = done ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-300 text-slate-500';
    return `<div class="rounded-2xl border ${stateClass} p-3 flex items-start gap-3">
      <div class="w-8 h-8 rounded-full grid place-items-center font-black text-sm ${circleClass}">${done ? '✓' : number}</div>
      <div>
        <p class="text-sm font-black text-slate-900">${Utils.escape(title)}</p>
        <p class="text-[11px] text-slate-500">${Utils.escape(hint)}</p>
      </div>
    </div>`;
  },

  _supabasePanel(cfg) {
    const supabase = cfg.supabase || {};
    const testing = App.state.databaseTesting;
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm space-y-5">
      <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-2 mb-1"><i data-lucide="database" class="w-5 h-5 text-emerald-700"></i><h3 class="text-xl font-black text-slate-950">Supabase</h3></div>
          <p class="text-sm text-slate-500 max-w-xl">Postgres gerenciado com API REST pronta. Cole a URL do projeto e a chave anônima.</p>
        </div>
        ${this._statusBadge()}
      </div>

      <div class="grid md:grid-cols-2 gap-4">
        ${this._dbInput('supabase.url', 'Project URL', 'https://xxxxx.supabase.co', 'text', supabase.url)}
        ${this._dbInput('supabase.anonKey', 'Anon Public Key', 'eyJ...', 'password', supabase.anonKey)}
        ${this._dbInput('supabase.schema', 'Schema', 'public', 'text', supabase.schema || 'public')}
      </div>

      ${this._resultCard()}

      <div class="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
        <button onclick="Actions.testDatabaseConnection()" ${testing ? 'disabled' : ''} class="px-5 py-3 rounded-2xl ${testing ? 'bg-slate-300 text-slate-600 cursor-wait' : 'bg-slate-900 hover:bg-slate-800 text-white'} font-black flex items-center gap-2 lj-dark-button" style="${testing ? '' : 'color:#fff!important;'}">
          ${testing ? '<span class="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin"></span> Testando...' : '<i data-lucide="activity" class="w-4 h-4"></i> Testar conexão'}
        </button>
        <button onclick="Actions.saveDatabaseConfig()" class="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-2"><i data-lucide="save" class="w-4 h-4"></i> Salvar configuração</button>
      </div>
    </div>`;
  },

  _amazonPanel(cfg) {
    const amazon = cfg.amazon || {};
    const testing = App.state.databaseTesting;
    const showSqlFields = amazon.type !== 'dynamodb';
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm space-y-5">
      <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-2 mb-1"><i data-lucide="cloud" class="w-5 h-5 text-amber-700"></i><h3 class="text-xl font-black text-slate-950">Amazon (RDS / Aurora / DynamoDB)</h3></div>
          <p class="text-sm text-slate-500 max-w-xl">Front não conecta direto em RDS por segurança. Configure aqui os dados e use uma API Gateway ou Lambda como proxy.</p>
        </div>
        ${this._statusBadge()}
      </div>

      <div class="grid md:grid-cols-2 gap-4">
        <div>
          <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Tipo Amazon</label>
          <select onchange="Actions.selectAmazonDatabaseType(this.value)" class="mt-1 w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-semibold text-slate-900">
            ${DatabaseService.amazonTypes.map(type => `<option value="${type.id}" ${amazon.type === type.id ? 'selected' : ''}>${Utils.escape(type.label)}</option>`).join('')}
          </select>
        </div>
        ${this._dbInput('amazon.region', 'Região', 'sa-east-1', 'text', amazon.region)}
        ${this._dbInput('amazon.endpoint', 'Endpoint', amazon.type === 'dynamodb' ? 'opcional para DynamoDB' : 'leadscore.xxxxx.sa-east-1.rds.amazonaws.com', 'text', amazon.endpoint)}
        ${amazon.type === 'dynamodb' ? this._dbInput('amazon.tablePrefix', 'Prefixo de tabelas', 'leadscore_', 'text', amazon.tablePrefix) : ''}
        ${showSqlFields ? this._dbInput('amazon.port', 'Porta', amazon.type === 'rds-mysql' ? '3306' : '5432', 'text', amazon.port) : ''}
        ${showSqlFields ? this._dbInput('amazon.database', 'Database', 'leadscore', 'text', amazon.database) : ''}
        ${showSqlFields ? this._dbInput('amazon.username', 'Usuário', 'admin', 'text', amazon.username) : ''}
        ${showSqlFields ? this._dbInput('amazon.password', 'Senha', '', 'password', amazon.password) : ''}
        <div class="md:col-span-2">
          ${this._dbInput('amazon.apiGatewayUrl', 'API Gateway / proxy (opcional)', 'https://api.seudominio.com/db/health', 'text', amazon.apiGatewayUrl, 'Se preenchido, o teste vai bater nessa URL para validar conectividade real.')}
        </div>
      </div>

      ${this._resultCard()}

      <div class="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
        <button onclick="Actions.testDatabaseConnection()" ${testing ? 'disabled' : ''} class="px-5 py-3 rounded-2xl ${testing ? 'bg-slate-300 text-slate-600 cursor-wait' : 'bg-slate-900 hover:bg-slate-800 text-white'} font-black flex items-center gap-2 lj-dark-button" style="${testing ? '' : 'color:#fff!important;'}">
          ${testing ? '<span class="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin"></span> Testando...' : '<i data-lucide="activity" class="w-4 h-4"></i> Testar conexão'}
        </button>
        <button onclick="Actions.saveDatabaseConfig()" class="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-2"><i data-lucide="save" class="w-4 h-4"></i> Salvar configuração</button>
      </div>
    </div>`;
  },

  _providerCard(id, title, desc, icon, provider) {
    const active = provider === id;
    return `<button onclick="Actions.selectDatabaseProvider('${id}')" class="text-left rounded-3xl border p-5 transition ${active ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50'}">
      <div class="flex items-center gap-3 mb-3">
        <i data-lucide="${icon}" class="w-5 h-5"></i>
        <h3 class="font-black">${Utils.escape(title)}</h3>
      </div>
      <p class="text-xs ${active ? 'text-slate-200' : 'text-slate-500'}">${Utils.escape(desc)}</p>
    </button>`;
  },

  _tutorialPanel(cfg) {
    const items = (window.DatabaseService && typeof DatabaseService.tutorial === 'function')
      ? DatabaseService.tutorial(cfg.provider, cfg.amazon?.type)
      : [];
    if (!items.length) return '';
    return `<details class="rounded-3xl bg-slate-900 text-white p-5" ${App.state.showDatabaseTutorial ? 'open' : ''}>
      <summary class="cursor-pointer flex items-center gap-2 font-black" onclick="event.preventDefault(); Actions.toggleDatabaseTutorial();">
        <i data-lucide="book-open" class="w-4 h-4"></i> Tutorial passo a passo para ${Utils.escape(DatabaseService.providerLabel(cfg.provider))}
      </summary>
      <ol class="mt-3 space-y-2 text-sm text-slate-200 list-decimal pl-5">${items.map(item => `<li>${Utils.escape(item)}</li>`).join('')}</ol>
    </details>`;
  },

  _railwayPanel(cfg) {
    const r = cfg.railway || {};
    const mode = r.mode === 'fields' ? 'fields' : 'url';
    const showPwd = Boolean(App.state.railwayShowPassword);
    const testing = Boolean(App.state.railwayTesting);
    const results = App.state.railwayTestResults || null;
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm space-y-5">
      <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-2 mb-1"><i data-lucide="train" class="w-5 h-5 text-violet-700"></i><h3 class="text-xl font-black text-slate-950">Railway Database</h3></div>
          <p class="text-sm text-slate-500 max-w-xl">Cole sua DATABASE_URL ou preencha os campos. O LeadJourney mantém fallback local — seus dados não somem.</p>
        </div>
        ${this._railwayStatusBadge(r)}
      </div>

      ${this._railwayGuide()}

      <div class="grid md:grid-cols-2 gap-3">
        ${this._dbSelect('railway.engine', 'Tipo de banco', [{value:'postgres',label:'PostgreSQL'},{value:'mysql',label:'MySQL'}], r.engine || 'postgres')}
        ${this._dbSelect('railway.environment', 'Ambiente', [{value:'production',label:'Produção'},{value:'staging',label:'Teste'},{value:'local',label:'Local'}], r.environment || 'production')}
        ${this._dbInput('railway.projectName', 'Nome do projeto Railway', 'meu-projeto', 'text', r.projectName)}
        ${this._dbInput('railway.serviceName', 'Nome do serviço Railway', 'postgres-prod', 'text', r.serviceName)}
      </div>

      <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3 flex flex-wrap gap-2">
        <button onclick="Actions.setRailwayMode('url')" class="px-3 py-2 rounded-xl text-xs font-black ${mode === 'url' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700'}" ${mode === 'url' ? 'style="color:#fff!important;"' : ''}>Usar DATABASE_URL</button>
        <button onclick="Actions.setRailwayMode('fields')" class="px-3 py-2 rounded-xl text-xs font-black ${mode === 'fields' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700'}" ${mode === 'fields' ? 'style="color:#fff!important;"' : ''}>Usar campos separados</button>
      </div>

      ${mode === 'url' ? this._railwayUrlBlock(r, showPwd) : this._railwayFieldsBlock(r, showPwd)}

      <div class="grid md:grid-cols-3 gap-3">
        ${this._dbInput('railway.schema', 'Schema', 'public', 'text', r.schema || 'public')}
        ${this._dbInput('railway.tablePrefix', 'Prefixo de tabelas', 'leadjourney_', 'text', r.tablePrefix || 'leadjourney_')}
        ${this._dbInput('railway.proxyUrl', 'Proxy HTTPS (opcional)', 'https://seu-proxy.railway.app/health', 'text', r.proxyUrl, 'Sem proxy, o teste valida só o formato. Com proxy, a sondagem é real.')}
      </div>

      <label class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-slate-200">
        <span><span class="block text-sm font-black text-slate-900">SSL obrigatório</span><span class="block text-[11px] text-slate-500">Railway exige SSL em produção. Mantenha ligado salvo orientação contrária.</span></span>
        <button onclick="Actions.updateDatabaseConfig('railway.ssl', ${!r.ssl})" class="relative w-12 h-7 rounded-full transition ${r.ssl ? 'bg-emerald-500' : 'bg-slate-300'}" aria-pressed="${Boolean(r.ssl)}">
          <span class="absolute top-1 ${r.ssl ? 'right-1' : 'left-1'} w-5 h-5 rounded-full bg-white shadow"></span>
        </button>
      </label>

      ${this._railwayTestResults(results, testing)}

      <div class="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
        <button onclick="Actions.testRailwayConnection()" ${testing ? 'disabled' : ''} class="px-5 py-3 rounded-2xl ${testing ? 'bg-slate-300 text-slate-600 cursor-wait' : 'bg-slate-900 hover:bg-slate-800 text-white'} font-black flex items-center gap-2 lj-dark-button" style="${testing ? '' : 'color:#fff!important;'}">${testing ? '<span class="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin"></span> Testando 5 vezes…' : '<i data-lucide="activity" class="w-4 h-4"></i> Testar conexão Railway'}</button>
        <button onclick="Actions.openRailwaySnapshotPrompt()" class="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-2" style="color:#fff!important;"><i data-lucide="save" class="w-4 h-4"></i> Salvar Railway como banco principal</button>
        <button onclick="Actions.generateDatabaseSnapshot('railway-manual')" class="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black hover:bg-slate-50 flex items-center gap-2"><i data-lucide="download" class="w-4 h-4"></i> Gerar snapshot agora</button>
      </div>
    </div>`;
  },

  _railwayStatusBadge(r) {
    const status = r.lastTest?.status || (r.markedAsPrimary ? 'primary' : (r.databaseUrl || r.host) ? 'configured' : 'not_configured');
    const map = {
      stable: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Estável' },
      unstable: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Instável' },
      critical: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500', label: 'Crítico' },
      failed: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500', label: 'Erro de conexão' },
      testing: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', dot: 'bg-sky-500', label: 'Testando' },
      primary: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', dot: 'bg-violet-500', label: 'Banco principal' },
      configured: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', dot: 'bg-slate-400', label: 'Configurado' },
      not_configured: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-500', dot: 'bg-slate-300', label: 'Não configurado' }
    };
    const t = map[status] || map.not_configured;
    return `<span class="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border ${t.bg} ${t.border} ${t.text} text-xs font-black"><span class="w-2 h-2 rounded-full ${t.dot}"></span>${t.label}</span>`;
  },

  _railwayGuide() {
    return `<details class="rounded-2xl bg-violet-50 border border-violet-200 p-4" open>
      <summary class="cursor-pointer text-sm font-black text-violet-900 flex items-center gap-2"><i data-lucide="book-open" class="w-4 h-4"></i> Passo a passo para conectar o Railway</summary>
      <ol class="mt-3 space-y-1.5 text-sm text-violet-900 list-decimal pl-5">
        <li>Acesse sua conta no Railway.</li>
        <li>Abra o projeto onde está seu banco.</li>
        <li>Clique no serviço de banco — PostgreSQL ou MySQL.</li>
        <li>Abra a aba <b>Variables</b> ou <b>Connect</b>.</li>
        <li>Copie a variável <code class="px-1 rounded bg-white border border-violet-200">DATABASE_URL</code>.</li>
        <li>Cole no campo DATABASE_URL aqui.</li>
        <li>Clique em <b>Testar conexão Railway</b>.</li>
        <li>O LeadJourney roda 5 testes seguidos e mostra a estabilidade.</li>
        <li>Se passou, clique em <b>Salvar Railway como banco principal</b>.</li>
        <li>O LeadJourney mantém um fallback local — seus dados não se perdem.</li>
      </ol>
    </details>`;
  },

  _railwayUrlBlock(r, showPwd) {
    const url = r.databaseUrl || '';
    const masked = showPwd ? url : (window.RailwayConnectionParser ? RailwayConnectionParser.mask(url) : url);
    return `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <label class="text-xs font-black text-slate-500 uppercase tracking-wide">DATABASE_URL</label>
        <button onclick="Actions.toggleRailwayPassword()" class="text-[11px] font-black text-slate-600 hover:text-slate-900 flex items-center gap-1"><i data-lucide="${showPwd ? 'eye-off' : 'eye'}" class="w-3 h-3"></i> ${showPwd ? 'Ocultar' : 'Mostrar'}</button>
      </div>
      <input type="${showPwd ? 'text' : 'password'}" value="${Utils.escape(url)}" oninput="Actions.updateDatabaseConfig('railway.databaseUrl', this.value, false)" placeholder="postgresql://user:password@host:port/database" class="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-mono text-sm text-slate-900" />
      ${url && !showPwd ? `<p class="text-[11px] text-slate-500 font-mono">${Utils.escape(masked)}</p>` : ''}
      <button onclick="Actions.parseRailwayDatabaseUrl()" class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-xs"><i data-lucide="split" class="w-3 h-3 inline mr-1"></i> Extrair para campos separados</button>
    </div>`;
  },

  _railwayFieldsBlock(r, showPwd) {
    return `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
      <div class="grid md:grid-cols-2 gap-3">
        ${this._dbInput('railway.host', 'Host', 'containers-us-west-X.railway.app', 'text', r.host)}
        ${this._dbInput('railway.port', 'Porta', r.engine === 'mysql' ? '3306' : '5432', 'text', r.port)}
        ${this._dbInput('railway.database', 'Database name', 'railway', 'text', r.database)}
        ${this._dbInput('railway.username', 'Usuário', 'postgres', 'text', r.username)}
      </div>
      <div class="flex items-end gap-2">
        <div class="flex-1">${this._dbInput('railway.password', 'Senha', '', showPwd ? 'text' : 'password', r.password)}</div>
        <button onclick="Actions.toggleRailwayPassword()" class="px-3 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black text-xs whitespace-nowrap"><i data-lucide="${showPwd ? 'eye-off' : 'eye'}" class="w-3 h-3 inline mr-1"></i> ${showPwd ? 'Ocultar' : 'Mostrar'}</button>
      </div>
      <button onclick="Actions.composeRailwayDatabaseUrl()" class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-xs"><i data-lucide="link-2" class="w-3 h-3 inline mr-1"></i> Montar DATABASE_URL a partir destes campos</button>
    </div>`;
  },

  _railwayTestResults(results, testing) {
    if (testing && !results) {
      return `<div class="rounded-2xl bg-sky-50 border border-sky-200 p-4 text-sky-800 text-sm font-black flex items-center gap-2"><span class="w-3 h-3 rounded-full border-2 border-current border-r-transparent animate-spin"></span> Rodando teste 1 de 5…</div>`;
    }
    if (!results) return '';
    const rounds = results.rounds || [];
    const summary = results.summary || {};
    const summaryMap = {
      stable: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', icon: 'check-circle-2' },
      unstable: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', icon: 'alert-triangle' },
      critical: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', icon: 'alert-octagon' },
      failed: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', icon: 'x-octagon' }
    };
    const s = summaryMap[summary.status] || summaryMap.failed;
    return `<div class="space-y-2">
      <div class="rounded-2xl ${s.bg} border ${s.border} p-4">
        <div class="flex items-start gap-3">
          <i data-lucide="${s.icon}" class="w-5 h-5 ${s.text}"></i>
          <div class="flex-1">
            <p class="text-sm font-black ${s.text}">Estabilidade: ${summary.stability ?? 0}% · Latência média: ${summary.avgLatencyMs ?? 0}ms</p>
            <p class="text-xs ${s.text} opacity-90 mt-1">${Utils.escape(summary.message || '')}</p>
          </div>
        </div>
      </div>
      <div class="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100">
        ${rounds.map(r => `<div class="px-4 py-2.5 flex items-center justify-between text-sm">
          <span class="font-black text-slate-700">Teste ${r.round}</span>
          <span class="flex items-center gap-3">
            <span class="text-xs text-slate-500">${r.latencyMs}ms</span>
            ${r.ok ? '<span class="px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-black">sucesso</span>' : `<span class="px-2 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-[11px] font-black" title="${Utils.escape(r.message || '')}">falha</span>`}
          </span>
        </div>`).join('')}
      </div>
    </div>`;
  },

  _railwaySnapshotPrompt(cfg) {
    if (!App.state.showRailwaySnapshotPrompt) return '';
    return `<div class="fixed inset-0 z-[90] bg-slate-950/75 backdrop-blur-sm grid place-items-center p-4">
      <div class="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-md p-5">
        <div class="flex items-start gap-3 mb-3">
          <div class="w-10 h-10 rounded-2xl bg-violet-100 grid place-items-center"><i data-lucide="shield-check" class="w-5 h-5 text-violet-700"></i></div>
          <div>
            <h3 class="text-lg font-black text-slate-900">Trocar banco principal</h3>
            <p class="text-sm text-slate-500 mt-1">Antes de trocar o banco principal, recomendamos gerar um snapshot dos dados atuais. O LeadJourney não apagará seus dados locais.</p>
          </div>
        </div>
        <div class="flex flex-col gap-2 mt-4">
          <button onclick="Actions.generateDatabaseSnapshot('pre-railway-switch'); Actions.confirmRailwayAsPrimary();" class="px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm" style="color:#fff!important;">Gerar snapshot e salvar Railway</button>
          <button onclick="Actions.confirmRailwayAsPrimary()" class="px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm" style="color:#fff!important;">Continuar sem snapshot</button>
          <button onclick="Actions.cancelRailwaySnapshotPrompt()" class="px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black text-sm">Cancelar</button>
        </div>
      </div>
    </div>`;
  },

  databasePanel() {
    const cfg = DatabaseService.normalize(App.state.databaseConfig);
    const provider = cfg.provider || 'local';
    const panel = provider === 'supabase' ? this._supabasePanel(cfg)
      : provider === 'amazon' ? this._amazonPanel(cfg)
      : provider === 'railway' ? this._railwayPanel(cfg)
      : this._localPanel(cfg);

    return `<div class="space-y-5">
      <div class="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        ${this._providerCard('local','Local','Banco local no seu computador. Começa imediato e fica offline.','hard-drive', provider)}
        ${this._providerCard('supabase','Supabase','Postgres gerenciado com API REST pronta para produção inicial.','database', provider)}
        ${this._providerCard('amazon','Amazon','RDS, Aurora ou DynamoDB. Preparado para escalar via backend/proxy.','cloud', provider)}
        ${this._providerCard('railway','Railway','Postgres ou MySQL no Railway. Conexão guiada por DATABASE_URL ou campos separados.','train', provider)}
      </div>
      ${panel}
      ${this._tutorialPanel(cfg)}
      ${this._railwaySnapshotPrompt(cfg)}
    </div>`;
  },

  backupPanel() {
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
      <h3 class="text-2xl font-black text-slate-950">Backup em breve</h3>
      <p class="text-sm text-slate-500 mt-2">Área reservada para backups automáticos, restauração e snapshots versionados.</p>
    </div>`;
  },

  rdCrmPanel() {
    const rd = App.state.integrations?.rd || {};
    const crm = App.state.integrations?.rdCrm || (window.RdCrmConfig ? RdCrmConfig.defaultConfig() : {});
    const oauthOk = Boolean(rd.accessToken || rd.refreshToken);
    const oauthStatus = oauthOk
      ? `<span class="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black">OAuth conectado</span>`
      : `<span class="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-black">OAuth pendente</span>`;
    const syncStatusClass = crm.lastSyncStatus === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : crm.lastSyncStatus === 'running' ? 'bg-sky-50 border-sky-200 text-sky-700'
      : crm.lastSyncStatus && crm.lastSyncStatus !== '' ? 'bg-red-50 border-red-200 text-red-700'
      : 'bg-slate-50 border-slate-200 text-slate-600';
    const lastSync = crm.lastSyncAt ? new Date(crm.lastSyncAt).toLocaleString('pt-BR') : '—';
    const nextSync = crm.autoSync && crm.lastSyncAt
      ? new Date(new Date(crm.lastSyncAt).getTime() + RdCrmConfig.autoSyncIntervalMs).toLocaleString('pt-BR')
      : (crm.autoSync ? 'Em breve' : '—');
    const stageMap = crm.stageMap || {};
    const stages = RdCrmConfig.defaultStages();

    return `<div class="space-y-5">
      ${this._rdCrmStatusBlock(oauthOk, oauthStatus, syncStatusClass, crm, lastSync, nextSync)}
      ${this._rdCrmCampaignPipelinesBlock(crm, oauthOk)}
      ${this._rdCrmLegacyPipelineBlock(crm, oauthOk, stages, stageMap)}
      ${this._rdCrmSyncBlock(crm)}
      ${this._rdCrmLiveBridgeBlock()}
      ${this._rdCrmEventLogBlock()}
      ${this._rdCrmTagsBlock()}
    </div>`;
  },

  // V21.6 — Bloco principal: 1 pipeline por campanha. Lista todas as campanhas,
  // mostra status do pipeline RD de cada uma + botão de sync individual.
  _rdCrmCampaignPipelinesBlock(crm, oauthOk) {
    const campaigns = Array.isArray(App.state.campaigns) ? App.state.campaigns : [];
    const byCampaign = crm.pipelinesByCampaign || {};
    const eligibleCount = campaigns.filter(c => window.RdCrmSyncEngine?._shouldSyncCampaign?.(c)).length;
    const syncedCount = Object.keys(byCampaign).length;
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
      <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3 mb-4">
        <div>
          <div class="flex items-center gap-2 mb-1"><i data-lucide="git-branch" class="w-5 h-5 text-sky-700"></i><h3 class="text-xl font-black text-slate-950">Pipelines por campanha</h3></div>
          <p class="text-sm text-slate-500 max-w-xl">A partir do V21.6, cada campanha tem seu próprio pipeline no RD CRM (9 etapas — Mkt/Vendas/CS × TOF/MOF/BOF). Leads não são duplicados: o mesmo contato pode estar em vários pipelines simultaneamente.</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-3 py-2 rounded-2xl border bg-slate-50 border-slate-200 text-slate-700 text-xs font-black">${syncedCount}/${campaigns.length} sincronizadas</span>
          <button onclick="Actions.syncAllCampaignPipelines()" ${!oauthOk || !eligibleCount ? 'disabled' : ''} class="px-4 py-2 rounded-2xl ${oauthOk && eligibleCount ? 'bg-sky-600 hover:bg-sky-700 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'} font-black text-xs flex items-center gap-2" ${oauthOk && eligibleCount ? 'style="color:#fff!important;"' : ''}><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Sincronizar todas (${eligibleCount} elegíveis)</button>
        </div>
      </div>
      ${campaigns.length === 0 ? `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
        Nenhuma campanha criada ainda. Crie uma campanha em <b>Menu → Campanhas</b> para liberar a sincronização.
      </div>` : `<div class="space-y-2">
        ${campaigns.map(c => this._rdCrmCampaignPipelineRow(c, byCampaign[c.id], oauthOk)).join('')}
      </div>`}
    </div>`;
  },

  _rdCrmCampaignPipelineRow(campaign, info, oauthOk) {
    const synced = Boolean(info?.pipelineId);
    const eligible = Boolean(window.RdCrmSyncEngine?._shouldSyncCampaign?.(campaign));
    const stageCount = info?.stageMap ? Object.keys(info.stageMap).length : 0;
    const lastSyncLabel = info?.lastSyncAt ? new Date(info.lastSyncAt).toLocaleString('pt-BR') : '—';
    const statusTone = info?.lastSyncStatus === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : info?.lastSyncStatus ? 'bg-red-50 border-red-200 text-red-700'
      : eligible ? 'bg-amber-50 border-amber-200 text-amber-700'
      : 'bg-slate-50 border-slate-200 text-slate-600';
    const statusLabel = synced ? `${stageCount} etapas · ${info.lastSyncStatus || 'ok'}` : (eligible ? 'pendente sync' : 'sem ações/leads');
    return `<div class="rounded-2xl border border-slate-200 bg-slate-50 p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="font-black text-slate-900 truncate">${Utils.escape(campaign.name || '(sem nome)')}</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-black border ${statusTone}">${Utils.escape(statusLabel)}</span>
        </div>
        <div class="text-[11px] text-slate-500 mt-0.5">
          ${synced ? `Pipeline RD: <b>${Utils.escape(info.pipelineName || '')}</b> · ID <code class="bg-white px-1.5 py-0.5 rounded">${Utils.escape(info.pipelineId)}</code> · último sync ${Utils.escape(lastSyncLabel)}` : 'Ainda não provisionado no RD.'}
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="Actions.syncCampaignPipeline(${campaign.id})" ${!oauthOk ? 'disabled' : ''} class="px-3 py-2 rounded-xl ${oauthOk ? 'bg-slate-900 hover:bg-slate-800 text-white lj-dark-button' : 'bg-slate-200 text-slate-500 cursor-not-allowed'} font-black text-xs flex items-center gap-1.5" ${oauthOk ? 'style="color:#fff!important;"' : ''}><i data-lucide="${synced ? 'refresh-cw' : 'zap'}" class="w-3.5 h-3.5"></i> ${synced ? 'Resincronizar' : 'Criar pipeline'}</button>
      </div>
    </div>`;
  },

  // V21.6 — Legacy global pipeline (V21.5 e anteriores) — colapsado.
  _rdCrmLegacyPipelineBlock(crm, oauthOk, stages, stageMap) {
    const hasLegacy = Boolean(crm.pipelineId);
    if (!hasLegacy) return '';
    return `<details class="rounded-3xl bg-white border border-amber-200 p-5 shadow-sm">
      <summary class="cursor-pointer flex items-center gap-2 font-black text-amber-800"><i data-lucide="archive" class="w-4 h-4"></i> Pipeline global legacy (V21.5 — desativado no V21.6)</summary>
      <div class="mt-4 space-y-3">
        <div class="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          A partir do V21.6 o Journey usa <b>1 pipeline por campanha</b>. O pipeline global abaixo permanece intacto no seu RD CRM (não é tocado pelo sync), mas <b>não recebe mais atualizações</b>. Você pode arquivá-lo no RD se quiser.
        </div>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
          <p class="text-[11px] font-black text-slate-500 uppercase">Pipeline legacy</p>
          <p class="text-sm font-black text-slate-900">${Utils.escape(crm.pipelineName || '')}</p>
          <p class="text-xs text-slate-500">ID RD: <code class="bg-white px-2 py-0.5 rounded">${Utils.escape(crm.pipelineId)}</code></p>
        </div>
        ${this._rdCrmStagesBlock(stages, stageMap)}
      </div>
    </details>`;
  },

  // V21 — Live Event Bridge: card de status + botão manual "Sincronizar agora"
  _rdCrmLiveBridgeBlock() {
    const lastSyncIso = App.state.rdLastSyncAt;
    const lastSyncLabel = lastSyncIso ? new Date(lastSyncIso).toLocaleString('pt-BR') : 'Nunca';
    const isRunning = Boolean(App.state.rdSyncRunning);
    const minsAgo = lastSyncIso ? Math.floor((Date.now() - new Date(lastSyncIso).getTime()) / 60000) : null;
    const minutesText = minsAgo === null ? 'sem sync ainda'
      : minsAgo === 0 ? 'agora mesmo'
      : `há ${minsAgo} min`;
    const tone = !lastSyncIso ? 'bg-slate-50 border-slate-200 text-slate-600'
      : (minsAgo !== null && minsAgo > 10) ? 'bg-amber-50 border-amber-200 text-amber-800'
      : 'bg-emerald-50 border-emerald-200 text-emerald-800';
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
      <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3 mb-4">
        <div>
          <div class="flex items-center gap-2 mb-1"><i data-lucide="radio-tower" class="w-5 h-5 text-violet-600"></i><h3 class="text-xl font-black text-slate-950">Live Event Bridge</h3></div>
          <p class="text-sm text-slate-500">Polling de 5 min · sync de contatos, deals, tags e estágios → base global e Revenue Score.</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-3 py-2 rounded-2xl border ${tone} text-xs font-black flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${isRunning ? 'bg-sky-500 animate-pulse' : 'bg-current'}"></span>
            ${isRunning ? 'Sincronizando…' : `Último sync ${minutesText}`}
          </span>
        </div>
      </div>
      <div class="grid md:grid-cols-3 gap-3 mb-4">
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-wider">Último sync</p>
          <p class="text-sm font-black text-slate-900 mt-1">${Utils.escape(lastSyncLabel)}</p>
        </div>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-wider">Intervalo</p>
          <p class="text-sm font-black text-slate-900 mt-1">5 minutos</p>
        </div>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-wider">Eventos no log</p>
          <p class="text-sm font-black text-slate-900 mt-1">${(App.state.rdEventLog || []).length}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button ${isRunning ? 'disabled' : ''} onclick="Actions.syncRdCrmNow()" class="px-5 py-3 rounded-2xl ${isRunning ? 'bg-slate-300 text-slate-600 cursor-wait' : 'bg-violet-600 hover:bg-violet-700 text-white'} font-black flex items-center gap-2" ${isRunning ? '' : 'style="color:#fff!important;"'}>
          ${isRunning ? '<span class="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin"></span> Sincronizando...' : '<i data-lucide="refresh-cw" class="w-4 h-4"></i> Sincronizar RD agora'}
        </button>
      </div>
    </div>`;
  },

  // V21 — Log de eventos RD: collapse mostrando os últimos 30 eventos recebidos
  _rdCrmEventLogBlock() {
    const log = (App.state.rdEventLog || []).slice(-30).reverse();
    return `<details class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
      <summary class="cursor-pointer flex items-center gap-2 font-black text-slate-900"><i data-lucide="history" class="w-4 h-4 text-slate-500"></i> Log de eventos RD (${(App.state.rdEventLog || []).length} totais)</summary>
      <div class="mt-4 space-y-2 max-h-96 overflow-auto">
        ${log.length ? log.map(e => this._rdCrmEventRow(e)).join('') : '<p class="text-xs text-slate-500 italic">Sem eventos ainda. Configure o RD ou aguarde o próximo sync.</p>'}
      </div>
    </details>`;
  },

  _rdCrmEventRow(e) {
    const when = e.ts ? new Date(e.ts).toLocaleString('pt-BR') : '—';
    const typeTone = String(e.type || '').includes('won') ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : String(e.type || '').includes('lost') ? 'bg-red-50 border-red-200 text-red-700'
      : String(e.type || '').includes('tag') ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
      : String(e.type || '').includes('stage') ? 'bg-violet-50 border-violet-200 text-violet-700'
      : 'bg-slate-50 border-slate-200 text-slate-700';
    return `<div class="rounded-xl bg-slate-50 border border-slate-100 p-2.5 flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 min-w-0">
        <span class="px-2 py-1 rounded ${typeTone} border text-[10px] font-black whitespace-nowrap">${Utils.escape(e.type || '—')}</span>
        <span class="text-[11px] text-slate-600 truncate">contato: ${Utils.escape(String(e.contactId || '—'))}</span>
      </div>
      <span class="text-[10px] text-slate-400 whitespace-nowrap">${Utils.escape(when)}</span>
    </div>`;
  },

  _rdCrmStatusBlock(oauthOk, oauthStatus, syncStatusClass, crm, lastSync, nextSync) {
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
      <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3 mb-4">
        <div>
          <div class="flex items-center gap-2 mb-1"><i data-lucide="workflow" class="w-5 h-5 text-sky-700"></i><h3 class="text-xl font-black text-slate-950">Status da conexão</h3></div>
          <p class="text-sm text-slate-500 max-w-xl">O RD CRM compartilha o OAuth do RD Station. Conecte primeiro o RD Station na aba ao lado, depois teste aqui.</p>
        </div>
        ${oauthStatus}
      </div>
      <div class="grid md:grid-cols-3 gap-3 mb-4">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p class="text-[11px] font-black text-slate-500 uppercase">Status RD CRM</p><p class="text-sm font-black text-slate-900 mt-1">${Utils.escape(crm.lastSyncStatus || 'aguardando')}</p></div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p class="text-[11px] font-black text-slate-500 uppercase">Último sync</p><p class="text-sm font-black text-slate-900 mt-1">${Utils.escape(lastSync)}</p></div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p class="text-[11px] font-black text-slate-500 uppercase">Próximo sync</p><p class="text-sm font-black text-slate-900 mt-1">${Utils.escape(nextSync)}</p></div>
      </div>
      <div class="rounded-2xl border ${syncStatusClass} p-3 text-sm">
        <p class="font-black">${Utils.escape(crm.lastSyncMessage || 'Nenhum sync executado ainda.')}</p>
      </div>
      <div class="flex flex-wrap gap-3 mt-4">
        <button onclick="Actions.testRdCrmConnection()" ${!oauthOk ? 'disabled' : ''} class="px-5 py-3 rounded-2xl ${oauthOk ? 'bg-slate-900 hover:bg-slate-800 text-white lj-dark-button' : 'bg-slate-200 text-slate-500 cursor-not-allowed'} font-black flex items-center gap-2" ${oauthOk ? 'style="color:#fff!important;"' : ''}><i data-lucide="activity" class="w-4 h-4"></i> Testar conexão</button>
        ${!oauthOk ? `<button onclick="Actions.setSettingsSection('rd')" class="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black flex items-center gap-2"><i data-lucide="arrow-right" class="w-4 h-4"></i> Ir para configurar OAuth RD</button>` : ''}
      </div>
    </div>`;
  },

  _rdCrmPipelineBlock(crm, oauthOk) {
    const hasPipeline = Boolean(crm.pipelineId);
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 class="text-xl font-black text-slate-950">Pipeline</h3>
          <p class="text-sm text-slate-500">Crie o pipeline padrão Journey no RD ou conecte um existente.</p>
        </div>
        ${hasPipeline ? `<span class="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black">Conectado</span>` : `<span class="px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-xs font-black">Não conectado</span>`}
      </div>
      ${hasPipeline ? `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-3 mb-4">
        <p class="text-[11px] font-black text-slate-500 uppercase">Pipeline ativo</p>
        <p class="text-sm font-black text-slate-900">${Utils.escape(crm.pipelineName || RdCrmConfig.defaultPipelineName)}</p>
        <p class="text-xs text-slate-500">ID RD: <code class="bg-white px-2 py-0.5 rounded">${Utils.escape(crm.pipelineId)}</code></p>
      </div>` : ''}
      <div class="flex flex-wrap gap-3">
        <button onclick="Actions.listRdCrmPipelines()" ${!oauthOk ? 'disabled' : ''} class="px-5 py-3 rounded-2xl ${oauthOk ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-slate-100 text-slate-400 cursor-not-allowed'} font-black flex items-center gap-2"><i data-lucide="list" class="w-4 h-4"></i> Listar pipelines RD</button>
        <button onclick="Actions.createJourneyRevenuePipeline()" ${!oauthOk ? 'disabled' : ''} class="px-5 py-3 rounded-2xl ${oauthOk ? 'bg-sky-600 hover:bg-sky-700 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'} font-black flex items-center gap-2" ${oauthOk ? 'style="color:#fff!important;"' : ''}><i data-lucide="zap" class="w-4 h-4"></i> Criar Journey Revenue Pipeline</button>
        <button onclick="Actions.listRdCrmStages()" ${(!oauthOk || !hasPipeline) ? 'disabled' : ''} class="px-5 py-3 rounded-2xl ${(oauthOk && hasPipeline) ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-slate-100 text-slate-400 cursor-not-allowed'} font-black flex items-center gap-2"><i data-lucide="layers" class="w-4 h-4"></i> Listar etapas</button>
      </div>
    </div>`;
  },

  _rdCrmStagesBlock(stages, stageMap) {
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
      <h3 class="text-xl font-black text-slate-950 mb-3">Etapas</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="text-left text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
            <th class="py-2 pr-3">Etapa Journey</th>
            <th class="py-2 pr-3">Código</th>
            <th class="py-2 pr-3">ID RD</th>
            <th class="py-2 pr-3">Ordem</th>
            <th class="py-2 pr-3">Status</th>
          </tr></thead>
          <tbody>
            ${stages.map(stage => {
              const mapping = stageMap[stage.code];
              const synced = Boolean(mapping?.rdStageId);
              return `<tr class="border-b border-slate-100">
                <td class="py-2 pr-3 font-black text-slate-900">${Utils.escape(stage.label)}</td>
                <td class="py-2 pr-3"><code class="bg-slate-100 px-2 py-0.5 rounded text-xs">${stage.code}</code></td>
                <td class="py-2 pr-3 text-xs text-slate-500">${synced ? `<code class="bg-white border border-slate-200 px-2 py-0.5 rounded">${Utils.escape(mapping.rdStageId)}</code>` : '—'}</td>
                <td class="py-2 pr-3 text-slate-600">${stage.order}</td>
                <td class="py-2 pr-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-black ${synced ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">${synced ? 'sync' : 'pendente'}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  },

  _rdCrmSyncBlock(crm) {
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 class="text-xl font-black text-slate-950">Sincronização</h3>
          <p class="text-sm text-slate-500">A cada 5 minutos o Journey lê o RD CRM, atualiza tags, recalcula score e refresca o dashboard.</p>
        </div>
      </div>
      <div class="grid md:grid-cols-2 gap-3 mb-4">
        <label class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
          <span>
            <span class="block text-sm font-black text-slate-900">Sync automático a cada 5 min</span>
            <span class="block text-[11px] text-slate-500">Roda enquanto a aba estiver aberta. Pode ser combinado com cron externo / Electron.</span>
          </span>
          <button onclick="Actions.toggleRdCrmAutoSync()" class="relative w-12 h-7 rounded-full transition ${crm.autoSync ? 'bg-emerald-500' : 'bg-slate-300'}">
            <span class="absolute top-1 ${crm.autoSync ? 'right-1' : 'left-1'} w-5 h-5 rounded-full bg-white shadow"></span>
          </button>
        </label>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
          <p class="text-[11px] font-black text-slate-500 uppercase">Driver de sync</p>
          <select onchange="Actions.setRdCrmAutoSyncMode(this.value)" class="mt-1 w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-bold text-sm">
            <option value="frontend" ${crm.autoSyncMode === 'frontend' ? 'selected' : ''}>Frontend (aba aberta)</option>
            <option value="electron" ${crm.autoSyncMode === 'electron' ? 'selected' : ''}>Electron main process</option>
            <option value="backend" ${crm.autoSyncMode === 'backend' ? 'selected' : ''}>Backend / cron externo</option>
          </select>
        </div>
      </div>
      <div class="flex flex-wrap gap-3">
        <button onclick="Actions.runRdCrmSyncNow()" class="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black flex items-center gap-2 lj-dark-button" style="color:#fff!important;"><i data-lucide="refresh-cw" class="w-4 h-4"></i> Sincronizar agora</button>
      </div>
      <div class="mt-4">
        <p class="text-[11px] font-black text-slate-500 uppercase mb-2">Logs recentes</p>
        <div class="rounded-2xl bg-slate-950 text-slate-200 p-3 max-h-60 overflow-auto text-[11px] font-mono space-y-1">
          ${(crm.syncLogs || []).length ? (crm.syncLogs || []).map(log => `<div><span class="text-slate-500">${new Date(log.at).toLocaleTimeString('pt-BR')}</span> <span class="${log.level === 'error' ? 'text-red-300' : log.level === 'warn' ? 'text-amber-300' : 'text-sky-300'}">[${log.level}]</span> ${Utils.escape(log.message)}</div>`).join('') : '<div class="text-slate-500">Sem logs.</div>'}
        </div>
      </div>
    </div>`;
  },

  _rdCrmTagsBlock() {
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
      <h3 class="text-xl font-black text-slate-950 mb-2">Tags e Lead Scoring</h3>
      <p class="text-sm text-slate-500 mb-4">Cada entrada de funil ou etapa adiciona uma tag acumulativa. Repetições somam contador e aumentam o score do lead.</p>
      <div class="grid md:grid-cols-2 gap-3">
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
          <p class="text-[11px] font-black text-slate-500 uppercase mb-1">Funis</p>
          <ul class="text-xs text-slate-700 space-y-1">
            <li><code class="bg-white px-1.5 py-0.5 rounded">entrada_funil_marketing</code> · peso ${RdCrmLeadScoringBridge.WEIGHTS.funnel.marketing}</li>
            <li><code class="bg-white px-1.5 py-0.5 rounded">entrada_funil_vendas</code> · peso ${RdCrmLeadScoringBridge.WEIGHTS.funnel.vendas}</li>
            <li><code class="bg-white px-1.5 py-0.5 rounded">entrada_funil_cs</code> · peso ${RdCrmLeadScoringBridge.WEIGHTS.funnel.cs}</li>
          </ul>
        </div>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
          <p class="text-[11px] font-black text-slate-500 uppercase mb-1">Etapas</p>
          <ul class="text-xs text-slate-700 space-y-1">
            ${Object.entries(RdCrmLeadScoringBridge.WEIGHTS.stage).map(([tag, weight]) => `<li><code class="bg-white px-1.5 py-0.5 rounded">${tag}</code> · peso ${weight}</li>`).join('')}
          </ul>
        </div>
      </div>
      <p class="text-[11px] text-slate-400 mt-3">Repetições somam <b>+${RdCrmLeadScoringBridge.WEIGHTS.repeatBonus}</b> por passagem. Cap total: <b>${RdCrmLeadScoringBridge.MAX_SCORE_FROM_TAGS} pts</b> sobre o score base.</p>
    </div>`;
  },

  executionPanel() {
    const cfg = App.state.executionConfig || (window.ExecutionProviderRegistry ? ExecutionProviderRegistry.defaultConfig() : { defaultProvider: 'manual', providers: {} });
    const providers = window.ExecutionProviderRegistry ? ExecutionProviderRegistry.list() : [];
    const stat = window.ExecutionStatusEngine ? ExecutionStatusEngine.globalSnapshot() : { total: 0, byProvider: {} };
    return `<div class="space-y-5">
      <div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <div class="flex items-center gap-2 mb-1"><i data-lucide="kanban" class="w-5 h-5 text-indigo-600"></i><h3 class="text-2xl font-black text-slate-950">Provider operacional padrão</h3></div>
            <p class="text-sm text-slate-500">Para onde o LeadJourney deve criar as tarefas que o Djow estruturar.</p>
          </div>
          <span class="px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-black text-slate-600">${stat.total} tarefa(s) totais</span>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          ${providers.map(p => this._providerSelectCard(p, cfg.defaultProvider === p.id, stat.byProvider[p.id])).join('')}
        </div>
      </div>
      ${providers.filter(p => p.fields.length).map(p => this._providerConfigCard(p, cfg.providers[p.id] || {})).join('')}
      ${this._providerCard_manual(cfg.providers.manual || {})}
    </div>`;
  },

  _providerSelectCard(provider, isDefault, stats) {
    const completed = stats?.completed || 0;
    const total = stats?.total || 0;
    return `<button onclick="Actions.setDefaultExecutionProvider('${provider.id}')" class="text-left p-4 rounded-2xl border ${isDefault ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'} transition">
      <div class="flex items-center gap-2 mb-1">
        <i data-lucide="${provider.icon}" class="w-4 h-4" style="color:${provider.tone};"></i>
        <p class="font-black text-slate-900">${Utils.escape(provider.label)}</p>
        ${isDefault ? '<span class="ml-auto text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-600 text-white">Padrão</span>' : ''}
      </div>
      <p class="text-[11px] text-slate-500">${total} tarefa(s) • ${completed} concluída(s)</p>
    </button>`;
  },

  _providerConfigCard(provider, cfg) {
    const connectedBadge = cfg.connected
      ? '<span class="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-black">● Conectado</span>'
      : '<span class="px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-black">○ Não conectado</span>';
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
      <div class="flex items-center justify-between gap-3 mb-4">
        <div class="flex items-center gap-2"><i data-lucide="${provider.icon}" class="w-5 h-5" style="color:${provider.tone};"></i><h4 class="text-lg font-black text-slate-900">${Utils.escape(provider.label)}</h4></div>
        ${connectedBadge}
      </div>
      <div class="grid md:grid-cols-2 gap-3">
        ${provider.fields.map(field => this._providerInput(provider.id, field, cfg[field])).join('')}
      </div>
      <div class="flex flex-wrap gap-2 mt-4">
        <button onclick="Actions.testExecutionProvider('${provider.id}')" class="px-4 py-2.5 rounded-2xl bg-slate-900 text-white font-black text-sm" style="color:#fff!important;">Testar conexão</button>
        ${cfg.lastError ? `<span class="text-xs text-red-600 font-black flex items-center">⚠ ${Utils.escape(cfg.lastError)}</span>` : ''}
        ${cfg.lastTested ? `<span class="text-[11px] text-slate-400 self-center">Último teste: ${Utils.escape(new Date(cfg.lastTested).toLocaleString('pt-BR'))}</span>` : ''}
      </div>
    </div>`;
  },

  _providerCard_manual(cfg) {
    return `<div class="rounded-3xl bg-slate-50 border border-slate-200 p-5">
      <div class="flex items-center gap-2 mb-2"><i data-lucide="edit" class="w-5 h-5 text-slate-700"></i><h4 class="text-lg font-black text-slate-900">Manual</h4></div>
      <p class="text-sm text-slate-600">No modo Manual, as tarefas vivem dentro do LeadJourney. Nada é enviado para fora — útil para times que ainda não têm um provider externo plugado.</p>
    </div>`;
  },

  _providerInput(providerId, field, value) {
    const labelMap = {
      apiToken: 'API Token', apiKey: 'API Key', token: 'Token', url: 'URL',
      workspace: 'Workspace', space: 'Space', folder: 'Folder', list: 'List ID',
      board: 'Board ID', boardId: 'Board ID', listTodo: 'List "To Do"', listDone: 'List "Done"',
      defaultGroup: 'Grupo padrão', project: 'Projeto / Key', status: 'Status "Done"',
      statusInProgress: 'Status "em execução"', statusDone: 'Status "concluído"',
      databaseId: 'Database ID', email: 'E-mail (Jira)'
    };
    const sensitive = ['apiToken','apiKey','token'].includes(field);
    return `<div>
      <label class="text-xs font-black text-slate-500 uppercase tracking-wide">${labelMap[field] || field}</label>
      <input type="${sensitive ? 'password' : 'text'}" value="${Utils.escape(value || '')}" oninput="Actions.updateExecutionProviderField('${providerId}', '${field}', this.value)" class="mt-1 w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-semibold text-slate-900" />
    </div>`;
  },

  agentsPanel() {
    const cfg = (App.state.agentConfig?.djow) || (window.AgentRegistry ? AgentRegistry.defaultConfig().djow : {});
    const health = window.AgentHealthMonitor ? AgentHealthMonitor.snapshot() : { status: 'unknown', latencyMs: null, checkedAt: null, error: null, enabled: false };
    const statusBadge = health.status === 'online'
      ? `<span class="px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> Online ${health.latencyMs ? `• ${health.latencyMs}ms` : ''}</span>`
      : health.status === 'offline'
        ? `<span class="px-3 py-2 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-black flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-red-500"></span> Offline ${health.error ? `• ${Utils.escape(health.error)}` : ''}</span>`
        : `<span class="px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 text-xs font-black flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-slate-400"></span> Nunca testado</span>`;
    return `<div class="space-y-5">
      <div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
          <div>
            <div class="flex items-center gap-2 mb-1"><i data-lucide="cpu" class="w-5 h-5 text-indigo-600"></i><h3 class="text-2xl font-black text-slate-950">Djow (Railway)</h3></div>
            <p class="text-sm text-slate-500">Agente externo que interpreta comandos em linguagem natural e devolve tarefas estruturadas.</p>
          </div>
          ${statusBadge}
        </div>
        <div class="grid md:grid-cols-2 gap-3">
          ${this._agentInput('name', 'Nome do agente', cfg.name)}
          ${this._agentInput('url', 'URL da API Railway', cfg.url, 'https://djow-production.up.railway.app')}
          ${this._agentInput('endpoint', 'Endpoint principal', cfg.endpoint, '/execute')}
          ${this._agentInput('method', 'Método HTTP', cfg.method, 'POST')}
          ${this._agentInput('apiKey', 'API Key', cfg.apiKey, '', true)}
          ${this._agentInput('timeoutMs', 'Timeout (ms)', cfg.timeoutMs, '30000', false, 'number')}
        </div>
        <label class="mt-4 flex items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-slate-200">
          <span class="text-sm font-black text-slate-900">Agente ativo</span>
          <button onclick="Actions.toggleAgentEnabled('djow')" class="relative w-12 h-7 rounded-full transition ${cfg.enabled ? 'bg-emerald-500' : 'bg-slate-300'}" aria-pressed="${cfg.enabled}">
            <span class="absolute top-1 ${cfg.enabled ? 'right-1' : 'left-1'} w-5 h-5 rounded-full bg-white shadow"></span>
          </button>
        </label>
        <div class="flex flex-wrap gap-2 mt-4">
          <button onclick="Actions.testAgentConnection('djow')" class="px-4 py-2.5 rounded-2xl bg-slate-900 text-white font-black text-sm" style="color:#fff!important;">Testar conexão</button>
          <button onclick="Actions.saveAgentConfig('djow')" class="px-4 py-2.5 rounded-2xl bg-emerald-600 text-white font-black text-sm">Salvar</button>
          <button onclick="Actions.resetAgentConfig('djow')" class="px-4 py-2.5 rounded-2xl bg-red-50 border border-red-200 text-red-600 font-black text-sm">Limpar</button>
        </div>
        ${health.checkedAt ? `<p class="text-[11px] text-slate-400 mt-3">Última checagem: ${Utils.escape(new Date(health.checkedAt).toLocaleString('pt-BR'))}</p>` : ''}
      </div>
    </div>`;
  },

  _agentInput(field, label, value, placeholder = '', sensitive = false, type = 'text') {
    return `<div>
      <label class="text-xs font-black text-slate-500 uppercase tracking-wide">${label}</label>
      <input type="${sensitive ? 'password' : type}" value="${Utils.escape(String(value ?? ''))}" oninput="Actions.updateAgentField('djow', '${field}', this.value)" placeholder="${Utils.escape(placeholder || '')}" class="mt-1 w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-semibold text-slate-900" />
    </div>`;
  },

  render() {
    if (!App.state.showSettingsModal) return '';

    const active = this.activeSection();
    // V22.2 — Consolidação: 'rd' e 'rdCrm' viraram uma seção só "Conexão RD Station".
    // Mantemos o alias 'rdCrm' redirecionando p/ 'rd' por compat de bookmarks/links.
    const resolvedActive = active === 'rdCrm' ? 'rd' : active;
    const titleMap = { rd: 'Conexão RD Station', backup: 'Backup', database: 'Banco de Dados', execution: 'Execução Operacional', agents: 'Agentes Externos' };
    const subtitleMap = {
      rd: 'Token CRM, pipelines por campanha, sincronização de leads e (opcional) RD Marketing — tudo em um lugar.',
      backup: 'Prepare snapshots, restauração e segurança dos dados.',
      database: 'Escolha Local, Supabase ou Amazon e deixe o LeadScore pronto para sincronizar.',
      execution: 'Configure ClickUp, Trello, Monday, Jira, Notion ou modo Manual para onde as tarefas devem ser criadas.',
      agents: 'Configure o Djow (Railway) e outros agentes que interpretam comandos em linguagem natural.'
    };
    const title = titleMap[resolvedActive] || titleMap.database;
    const subtitle = subtitleMap[resolvedActive] || subtitleMap.database;

    const content = resolvedActive === 'rd' ? this.rdConnectionPanel()
      : resolvedActive === 'execution' ? this.executionPanel()
      : resolvedActive === 'agents' ? this.agentsPanel()
      : resolvedActive === 'backup' ? this.backupPanel()
      : this.databasePanel();

    return `<div class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm p-4 overflow-auto">
      <section id="settingsModal" class="max-w-6xl mx-auto rounded-[2rem] bg-slate-50 shadow-2xl overflow-hidden border border-white/20">
        <header class="bg-slate-950 text-white p-6 flex items-start justify-between gap-4">
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-black mb-4">
              <i data-lucide="settings" class="w-4 h-4"></i>
              Configurações do sistema
            </div>
            <h2 class="text-3xl font-black">${title}</h2>
            <p class="text-slate-300 mt-2">${subtitle}</p>
          </div>
          <button onclick="Actions.closeSettingsModal()" class="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 font-black flex items-center gap-2">
            <i data-lucide="x" class="w-4 h-4"></i>
            Fechar
          </button>
        </header>

        <main class="grid lg:grid-cols-[260px_1fr] min-h-[620px]">
          <aside class="bg-white border-r border-slate-200 p-5 space-y-3">
            ${this.sectionButton('database','Banco de Dados','database')}
            ${this.sectionButton('rd','Conexão RD Station','plug-zap')}
            ${this.sectionButton('execution','Execução Operacional','kanban')}
            ${this.sectionButton('agents','Agentes Externos','cpu')}
            ${this.sectionButton('backup','Backup em breve','archive')}
          </aside>

          <section class="p-5 lg:p-6 overflow-auto">
            ${content}
          </section>
        </main>
      </section>
    </div>`;
  }
};
window.SettingsModal = SettingsModal;

// Stub mantido para appActions.js (Actions.openRDSettings chama RDSettingsInjection?.inject?.())
window.RDSettingsInjection = { inject() {} };
