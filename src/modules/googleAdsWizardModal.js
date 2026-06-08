// V35.5.0 — Google Ads Wizard Modal (4 steps).
// V35.6.0-alpha3 — Paleta IPI aplicada: fundo Injetar (#0A1F44),
// accent amber (cor brand Google Ads) como nuance que vibra na cor da aba.
//
// Step 1 — Credenciais: Client ID, Client Secret, Developer Token, MCC opcional
// Step 2 — Autorizar: botão que abre popup OAuth do Google
// Step 3 — Escolher conta: lista contas acessíveis pelo refresh_token
// Step 4 — Sucesso: confirma conexão ativa
//
// Fluxo OAuth: postMessage do callback dispara auto-avanço pra Step 3.

window.GoogleAdsWizardModal = {
  render() {
    const w = App.state.googleAdsWizard;
    if (!w) return '';

    const isManage = w.mode === 'manage';
    const headerKicker = isManage ? 'Gerenciar Google Ads' : 'Conectar Google Ads';

    return `<div class="fixed inset-0 z-[90] grid place-items-center p-4"
      style="background: rgba(10,31,68,0.85); backdrop-filter: blur(6px);"
      onclick="if(event.target===this) Actions.closeGoogleAdsWizard()">
      <div class="w-full max-w-2xl rounded-3xl border-2 border-amber-400/40 shadow-2xl overflow-hidden"
        style="background: linear-gradient(135deg, #0A1F44 0%, #001230 100%);">

        <div class="border-b border-white/10 px-5 py-4 flex items-start justify-between gap-3"
          style="background: linear-gradient(90deg, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.05) 100%);">
          <div class="min-w-0">
            <p class="text-[10px] font-black text-amber-300 uppercase tracking-widest inline-flex items-center gap-1.5">
              <i data-lucide="megaphone" class="w-3 h-3"></i> ${headerKicker}
            </p>
            <h2 class="text-lg font-black text-white mt-1 leading-tight">Marketing · Aquisição</h2>
            <p class="text-[11px] text-slate-300 mt-0.5">Investimento, ROAS, CPL e conversões dentro do LJ.</p>
          </div>
          <button onclick="Actions.closeGoogleAdsWizard()" class="shrink-0 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 grid place-items-center">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        ${isManage ? '' : this._stepper(w)}

        <div class="p-5 max-h-[65vh] overflow-y-auto">
          ${isManage ? this._manageView() : ''}
          ${!isManage && w.step === 1 ? this._step1Credentials(w) : ''}
          ${!isManage && w.step === 2 ? this._step2Authorize(w) : ''}
          ${!isManage && w.step === 3 ? this._step3SelectAccount(w) : ''}
          ${!isManage && w.step === 4 ? this._step4Success(w) : ''}
        </div>
      </div>
    </div>`;
  },

  // V35.6.0-alpha6 / V36.7.0 — Modo manage com 2 sub-estados:
  //   (a) Conectado completo (selectedCustomerId presente) → card emerald, ação primária "Sincronizar"
  //   (b) Conexão pela metade (oauthCompleted + sem Customer) → card amber, ação primária "Selecionar conta"
  _manageView() {
    const s = App.state.googleAdsStatus || {};
    const hasCustomer = Boolean(s.selectedCustomerId);
    return hasCustomer ? this._manageConnectedView(s) : this._manageIncompleteView(s);
  },

  // V36.7.0 — Estado (b): OAuth ok mas conta não selecionada.
  _manageIncompleteView(s) {
    const mccActive = Boolean(s.loginCustomerId);
    return `<div class="space-y-4">
      <div class="rounded-2xl bg-amber-500/15 border-2 border-amber-400/50 p-4">
        <div class="flex items-start gap-3">
          <div class="shrink-0 w-10 h-10 rounded-xl bg-amber-500/30 grid place-items-center">
            <i data-lucide="alert-triangle" class="w-5 h-5 text-amber-200"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[10px] font-black text-amber-300 uppercase tracking-widest mb-1">Conexão pela metade</p>
            <h3 class="text-base font-black text-white">Falta escolher qual conta conectar</h3>
            <p class="text-[12px] text-amber-100/90 mt-1.5">Suas credenciais e OAuth estão ativos. Só precisa selecionar qual Customer (conta operacional do Google Ads) o LeadJourney vai puxar os dados.</p>
            <div class="mt-3 flex flex-wrap gap-1.5 text-[10px]">
              <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-black inline-flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> Credenciais</span>
              <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-black inline-flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> OAuth Google</span>
              ${mccActive ? '<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 font-black inline-flex items-center gap-1"><i data-lucide="check" class="w-3 h-3"></i> MCC</span>' : ''}
              <span class="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-400/40 text-rose-200 font-black inline-flex items-center gap-1"><i data-lucide="x" class="w-3 h-3"></i> Customer</span>
            </div>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <button onclick="Actions.openGoogleAdsAccountPicker()" class="flex-1 min-w-[180px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black inline-flex items-center justify-center gap-2" style="color:#fff;">
            <i data-lucide="list-checks" class="w-4 h-4"></i> Selecionar conta agora
          </button>
        </div>
      </div>

      <div class="flex flex-wrap justify-between items-center gap-3 pt-3 border-t border-white/10">
        <div class="flex flex-wrap gap-2">
          <button onclick="Actions.switchGoogleAdsToWizard()" class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 text-[11px] font-black inline-flex items-center gap-1.5">
            <i data-lucide="refresh-cw" class="w-3 h-3"></i> Refazer credenciais
          </button>
          <button onclick="Actions.openIntegrationDeepDive('google-ads')" class="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 text-[11px] font-black inline-flex items-center gap-1.5" title="Como o LeadJourney usa o Google Ads">
            <i data-lucide="help-circle" class="w-3 h-3"></i> Ajuda
          </button>
        </div>
        <button onclick="Actions.disconnectGoogleAds()" class="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-[11px] font-black inline-flex items-center gap-1.5">
          <i data-lucide="unplug" class="w-3 h-3"></i> Desconectar
        </button>
      </div>
    </div>`;
  },

  // V36.7.0 — Estado (a): Tudo conectado, ação primária é Sincronizar.
  _manageConnectedView(s) {
    const customer = s.selectedCustomerId || '?';
    const mccActive = Boolean(s.loginCustomerId);
    const lastSyncLabel = s.lastSyncAt
      ? `Última sincronização: ${this._fmtDate(s.lastSyncAt)}`
      : 'Primeira sincronização ainda não rodou.';
    const syncing = Boolean(App.state.googleAdsSyncTriggering);

    const badges = [
      { label: `Customer ${customer}`, status: 'ok', icon: 'hash' },
      { label: 'OAuth ativo', status: 'ok', icon: 'shield-check' }
    ];
    if (mccActive) badges.push({ label: 'Manager Account', status: 'ok', icon: 'layers' });

    return `<div class="space-y-4">
      ${window.ConnectionStatusCard ? ConnectionStatusCard.render({
        accentColor: 'emerald',
        kicker: 'Conta ativa',
        identification: `Customer ${customer}`,
        subtitle: 'OAuth Google + Developer Token operando',
        badges,
        lastValidationLabel: lastSyncLabel,
        primaryButton: {
          label: syncing ? 'Sincronizando…' : 'Sincronizar agora',
          icon: syncing ? 'loader-2' : 'refresh-cw',
          iconClass: syncing ? 'animate-spin' : '',
          action: 'Actions.triggerGoogleAdsSync()',
          disabled: syncing
        },
        secondaryButtons: [
          { label: 'Trocar conta', icon: 'list-checks', action: 'Actions.openGoogleAdsAccountPicker()' },
          { label: 'Trocar credenciais', icon: 'refresh-cw', action: 'Actions.switchGoogleAdsToWizard()' }
        ],
        helpAction: "Actions.openIntegrationDeepDive('google-ads')"
      }) : ''}

      <div class="flex flex-wrap justify-between items-center gap-3 pt-3 border-t border-white/10">
        <p class="text-[11px] text-slate-400">Pra trocar de conta, use "Trocar conta" acima. Pra revogar tudo, "Desconectar".</p>
        <button onclick="Actions.disconnectGoogleAds()" class="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/40 text-rose-200 text-xs font-black inline-flex items-center gap-1.5">
          <i data-lucide="unplug" class="w-3.5 h-3.5"></i> Desconectar
        </button>
      </div>
    </div>`;
  },

  _fmtDate(iso) {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (_) { return '—'; }
  },

  _stepper(w) {
    const steps = [
      { n: 1, label: 'Credenciais' },
      { n: 2, label: 'Autorizar' },
      { n: 3, label: 'Conta' },
      { n: 4, label: 'Pronto' }
    ];
    return `<div class="px-5 pt-4">
      <div class="flex items-center gap-2">
        ${steps.map(s => {
          const active = w.step === s.n;
          const done = w.step > s.n;
          const cls = done ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-200'
                    : active ? 'bg-amber-500/25 border-amber-400/60 text-amber-100'
                    : 'bg-white/5 border-white/10 text-slate-500';
          return `<div class="flex-1 px-3 py-2 rounded-xl border ${cls} text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5">
            <span class="w-5 h-5 rounded-full bg-white/15 grid place-items-center text-[10px]">${done ? '✓' : s.n}</span>
            ${s.label}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  _step1Credentials(w) {
    const d = w.draft;
    // V36.7.0 — Validação inline. Cada campo tem regra de formato.
    const validations = this._validateStep1Fields(d);
    const allValid = Object.values(validations).every(v => v.valid);
    const showChecklist = !w.checklistDismissed;

    return `<div class="space-y-4">
      ${showChecklist ? `
      <div class="rounded-2xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 border-2 border-amber-400/40 p-4">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div>
            <p class="text-[10px] font-black text-amber-300 uppercase tracking-widest">Antes de começar</p>
            <h4 class="text-sm font-black text-white">Pré-requisitos do Google</h4>
          </div>
          <button onclick="Actions.dismissGoogleAdsChecklist()" class="text-[10px] text-amber-200/70 hover:text-amber-200 underline">Já tenho tudo</button>
        </div>
        <ol class="text-[12px] text-slate-200 space-y-2 list-none">
          <li class="flex items-start gap-2">
            <span class="shrink-0 w-5 h-5 rounded-full bg-white/10 grid place-items-center text-[10px] font-black text-amber-300">1</span>
            <div class="flex-1 min-w-0">
              <p><b>Google Cloud Project com Google Ads API ativada</b> + OAuth Client ID criado.</p>
              <a href="https://console.cloud.google.com/apis/library/googleads.googleapis.com" target="_blank" class="text-[11px] text-amber-300 hover:text-amber-200 underline inline-flex items-center gap-1 mt-0.5">Abrir Cloud Console <i data-lucide="external-link" class="w-3 h-3"></i></a>
            </div>
          </li>
          <li class="flex items-start gap-2">
            <span class="shrink-0 w-5 h-5 rounded-full bg-white/10 grid place-items-center text-[10px] font-black text-amber-300">2</span>
            <div class="flex-1 min-w-0">
              <p><b>Manager Account (MCC)</b> no Google Ads — API Center só existe dentro de MCC, não em conta normal.</p>
              <a href="https://ads.google.com/home/tools/manager-accounts/" target="_blank" class="text-[11px] text-amber-300 hover:text-amber-200 underline inline-flex items-center gap-1 mt-0.5">Criar MCC <i data-lucide="external-link" class="w-3 h-3"></i></a>
            </div>
          </li>
          <li class="flex items-start gap-2">
            <span class="shrink-0 w-5 h-5 rounded-full bg-white/10 grid place-items-center text-[10px] font-black text-amber-300">3</span>
            <div class="flex-1 min-w-0">
              <p><b>Developer Token com Basic Access</b> aprovado pelo Google (no API Center do MCC).</p>
              <p class="text-[10px] text-slate-400">Token "Test Access" só funciona em contas de teste. Pra contas reais, solicitar Basic Access — Google aprova em 1-7 dias.</p>
            </div>
          </li>
          <li class="flex items-start gap-2">
            <span class="shrink-0 w-5 h-5 rounded-full bg-white/10 grid place-items-center text-[10px] font-black text-amber-300">4</span>
            <div class="flex-1 min-w-0">
              <p><b>Conta operacional vinculada ao MCC</b> (Customer ID que vai puxar dados).</p>
            </div>
          </li>
        </ol>
      </div>` : ''}

      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <label class="text-[11px] font-black text-amber-300 uppercase tracking-widest">Client ID</label>
          ${validations.clientId.touched ? (validations.clientId.valid ? '<i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-400"></i>' : '<span class="text-[10px] text-rose-300">' + validations.clientId.error + '</span>') : ''}
        </div>
        <input type="text" id="gads-wizard-client-id" value="${Utils.escape(d.clientId || '')}"
          oninput="Actions.updateGoogleAdsDraft('clientId', this.value); App.render();"
          placeholder="123456789-abc...apps.googleusercontent.com"
          class="w-full px-3 py-2 rounded-xl bg-[#001230] border ${validations.clientId.touched && !validations.clientId.valid ? 'border-rose-400/60' : 'border-white/15'} text-white text-[12px] font-mono focus:border-amber-400/60 focus:outline-none" />
      </div>

      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <label class="text-[11px] font-black text-amber-300 uppercase tracking-widest">Client Secret</label>
          ${validations.clientSecret.touched ? (validations.clientSecret.valid ? '<i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-400"></i>' : '<span class="text-[10px] text-rose-300">' + validations.clientSecret.error + '</span>') : ''}
        </div>
        <input type="password" id="gads-wizard-client-secret" value="${Utils.escape(d.clientSecret || '')}"
          oninput="Actions.updateGoogleAdsDraft('clientSecret', this.value); App.render();"
          placeholder="GOCSPX-xxxxxxxxxxxxx"
          class="w-full px-3 py-2 rounded-xl bg-[#001230] border ${validations.clientSecret.touched && !validations.clientSecret.valid ? 'border-rose-400/60' : 'border-white/15'} text-white text-[12px] font-mono focus:border-amber-400/60 focus:outline-none" />
      </div>

      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <label class="text-[11px] font-black text-amber-300 uppercase tracking-widest">Developer Token</label>
          ${validations.developerToken.touched ? (validations.developerToken.valid ? '<i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-400"></i>' : '<span class="text-[10px] text-rose-300">' + validations.developerToken.error + '</span>') : ''}
        </div>
        <input type="password" id="gads-wizard-developer-token" value="${Utils.escape(d.developerToken || '')}"
          oninput="Actions.updateGoogleAdsDraft('developerToken', this.value); App.render();"
          placeholder="22 caracteres alfanuméricos"
          class="w-full px-3 py-2 rounded-xl bg-[#001230] border ${validations.developerToken.touched && !validations.developerToken.valid ? 'border-rose-400/60' : 'border-white/15'} text-white text-[12px] font-mono focus:border-amber-400/60 focus:outline-none" />
        <p class="text-[10px] text-slate-500">Pegue no API Center do seu MCC. Pra contas reais, precisa Basic Access aprovado (1-7 dias).</p>
      </div>

      <div class="space-y-1.5">
        <div class="flex items-center justify-between">
          <label class="text-[11px] font-black text-slate-400 uppercase tracking-widest inline-flex items-center gap-1.5">
            MCC ID (opcional)
            <i data-lucide="help-circle" class="w-3 h-3 text-slate-500" title="ID do Manager Account (Manager) que assinou o Developer Token. Só preencha se a conta operacional está vinculada via MCC."></i>
          </label>
          ${validations.loginCustomerId.touched && d.loginCustomerId ? (validations.loginCustomerId.valid ? '<i data-lucide="check-circle-2" class="w-3.5 h-3.5 text-emerald-400"></i>' : '<span class="text-[10px] text-rose-300">' + validations.loginCustomerId.error + '</span>') : ''}
        </div>
        <input type="text" id="gads-wizard-mcc-id" value="${Utils.escape(d.loginCustomerId || '')}"
          oninput="Actions.updateGoogleAdsDraft('loginCustomerId', this.value.replace(/[^0-9]/g, '')); App.render();"
          placeholder="1234567890 (sem traços — auto-removidos)"
          class="w-full px-3 py-2 rounded-xl bg-[#001230] border ${validations.loginCustomerId.touched && d.loginCustomerId && !validations.loginCustomerId.valid ? 'border-rose-400/60' : 'border-white/15'} text-white text-[12px] font-mono focus:border-slate-400/60 focus:outline-none" />
        <p class="text-[10px] text-slate-500">Preencha se a conta operacional está vinculada via MCC. Pula se for conta direta.</p>
      </div>

      ${w.error ? `<div class="rounded-xl bg-rose-500/10 border border-rose-400/40 p-3 text-[12px] text-rose-200">${Utils.escape(w.error)}</div>` : ''}

      <div class="flex justify-end gap-2 pt-1">
        <button onclick="Actions.closeGoogleAdsWizard()" class="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 text-xs font-black">Cancelar</button>
        <button onclick="Actions.saveGoogleAdsCredentials()" ${(w.saving || !allValid) ? 'disabled' : ''} class="px-4 py-2.5 rounded-xl ${allValid ? 'bg-amber-500 hover:bg-amber-600' : 'bg-white/10 cursor-not-allowed'} text-white text-xs font-black flex items-center gap-2" style="color:#fff;">
          ${w.saving ? '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Salvando…' : '<i data-lucide="save" class="w-3.5 h-3.5"></i> Salvar e avançar'}
        </button>
      </div>
    </div>`;
  },

  // V36.7.0 — Valida cada campo do Step 1 contra regex. Retorna mapa com
  // { campo: { valid, error, touched } } pra renderização inline.
  _validateStep1Fields(d) {
    const out = {
      clientId: { valid: false, error: '', touched: Boolean(d.clientId) },
      clientSecret: { valid: false, error: '', touched: Boolean(d.clientSecret) },
      developerToken: { valid: false, error: '', touched: Boolean(d.developerToken) },
      loginCustomerId: { valid: true, error: '', touched: Boolean(d.loginCustomerId) }
    };
    // Client ID: formato {number}-{string}.apps.googleusercontent.com
    if (d.clientId) {
      const m = /^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/i.test(String(d.clientId).trim());
      out.clientId.valid = m;
      if (!m) out.clientId.error = 'deve terminar em .apps.googleusercontent.com';
    }
    // Client Secret: começa com GOCSPX-
    if (d.clientSecret) {
      const m = String(d.clientSecret).trim().startsWith('GOCSPX-') && d.clientSecret.length >= 20;
      out.clientSecret.valid = m;
      if (!m) out.clientSecret.error = 'formato GOCSPX-xxxxx (do Cloud Console)';
    }
    // Developer Token: 20-30 chars alfanuméricos
    if (d.developerToken) {
      const t = String(d.developerToken).trim();
      const m = /^[A-Za-z0-9_-]{20,30}$/.test(t);
      out.developerToken.valid = m;
      if (!m) out.developerToken.error = '22 chars alfanuméricos (do API Center)';
    }
    // MCC ID (opcional): se preenchido, 10 dígitos
    if (d.loginCustomerId) {
      const m = /^\d{10}$/.test(String(d.loginCustomerId).trim());
      out.loginCustomerId.valid = m;
      if (!m) out.loginCustomerId.error = '10 dígitos (sem traços)';
    }
    return out;
  },

  _step2Authorize(w) {
    return `<div class="space-y-4">
      <div class="rounded-2xl bg-emerald-500/10 border border-emerald-400/40 p-3">
        <p class="text-[11px] font-black text-emerald-200 uppercase tracking-widest mb-1">✓ Credenciais salvas</p>
        <p class="text-[12px] text-emerald-100">Agora vamos autorizar o LeadJourney a acessar sua conta Google Ads.</p>
      </div>

      <div class="rounded-2xl bg-[#001230]/60 border border-white/10 p-4 space-y-2">
        <p class="text-[11px] font-black text-slate-400 uppercase tracking-widest">O que vai acontecer</p>
        <ol class="text-[12px] text-slate-300 list-decimal pl-5 space-y-1">
          <li>Clica em "Autorizar com Google" abaixo.</li>
          <li>Abre uma janela do Google pedindo sua autorização.</li>
          <li>Você autoriza (pode aparecer aviso "App não verificado" — clique em "Avançar").</li>
          <li>A janela fecha sozinha e você volta aqui pra escolher a conta.</li>
        </ol>
      </div>

      ${w.error ? `<div class="rounded-xl bg-rose-500/10 border border-rose-400/40 p-3 text-[12px] text-rose-200">${Utils.escape(w.error)}</div>` : ''}

      <div class="flex justify-between gap-2 pt-1">
        <button onclick="Actions.setGoogleAdsWizardStep(1)" class="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 text-xs font-black flex items-center gap-2">
          <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Voltar
        </button>
        <button onclick="Actions.startGoogleAdsAuthorization()" ${w.authorizing ? 'disabled' : ''} class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black flex items-center gap-2" style="color:#fff;">
          ${w.authorizing ? '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Aguardando autorização…' : '<i data-lucide="external-link" class="w-3.5 h-3.5"></i> Autorizar com Google'}
        </button>
      </div>
    </div>`;
  },

  _step3SelectAccount(w) {
    const accounts = Array.isArray(w.accounts) ? w.accounts : [];
    const loadingAccounts = Boolean(w.loadingAccounts);
    return `<div class="space-y-4">
      <div class="rounded-2xl bg-emerald-500/10 border border-emerald-400/40 p-3">
        <p class="text-[11px] font-black text-emerald-200 uppercase tracking-widest mb-1">✓ Autorização concluída</p>
        <p class="text-[12px] text-emerald-100">Escolha qual conta Google Ads você quer conectar.</p>
      </div>

      ${loadingAccounts ? `<div class="rounded-xl bg-white/5 border border-white/10 p-4 text-[12px] text-slate-300 inline-flex items-center gap-2">
        <i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Buscando contas acessíveis pelo seu Developer Token…
      </div>` : (accounts.length === 0 ? `
      <!-- V36.7.0 — Diagnóstico claro pra Step 3 vazio -->
      <div class="rounded-2xl bg-rose-500/10 border-2 border-rose-400/40 p-4 space-y-3">
        <div class="flex items-start gap-3">
          <div class="shrink-0 w-9 h-9 rounded-lg bg-rose-500/20 grid place-items-center">
            <i data-lucide="alert-octagon" class="w-5 h-5 text-rose-300"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-[10px] font-black text-rose-300 uppercase tracking-widest">Nenhuma conta acessível</p>
            <h4 class="text-sm font-black text-white">O Developer Token não retornou contas</h4>
            <p class="text-[11px] text-rose-100/90 mt-1">O Google API respondeu mas a lista veio vazia. Possíveis causas em ordem de probabilidade:</p>
          </div>
        </div>
        <ul class="text-[11px] text-slate-200 space-y-1.5 list-disc pl-5">
          <li><b>Developer Token ainda em "Test Access"</b> — só funciona em contas de teste. Solicite Basic Access no API Center do MCC.</li>
          <li><b>Conta Google que autorizou não é user do MCC</b> — adicione no Admin do MCC com permissão de acesso.</li>
          <li><b>MCC ID errado no Step 1</b> — confira no Step 1 se o ID bate com o MCC que tem o token.</li>
          <li><b>Token revogado/expirado</b> — gere novo no API Center.</li>
        </ul>
        <div class="flex gap-2 pt-1">
          <a href="https://ads.google.com/aw/apicenter" target="_blank" class="text-[11px] text-rose-300 hover:text-rose-200 underline inline-flex items-center gap-1"><i data-lucide="external-link" class="w-3 h-3"></i> Abrir API Center</a>
          <button onclick="Actions.loadGoogleAdsAccounts()" class="text-[11px] text-rose-300 hover:text-rose-200 underline inline-flex items-center gap-1"><i data-lucide="refresh-cw" class="w-3 h-3"></i> Tentar de novo</button>
        </div>
      </div>` : `<div class="space-y-2 max-h-[40vh] overflow-y-auto">
        ${accounts.map(acc => {
          const isSelected = w.selectedCustomerId === String(acc.customerId);
          const formatted = String(acc.customerId).replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
          return `<button onclick="Actions.setGoogleAdsSelectedCustomer('${Utils.escape(String(acc.customerId))}')"
            class="w-full text-left p-3 rounded-xl border-2 ${isSelected ? 'border-amber-400 bg-amber-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'} transition flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-amber-500/20 grid place-items-center">
              <i data-lucide="${isSelected ? 'check-circle-2' : 'circle'}" class="w-4 h-4 text-amber-300"></i>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[12px] font-black text-white">${Utils.escape(acc.descriptiveName || `Customer ${formatted}`)}</p>
              <p class="text-[10px] text-slate-400 font-mono">${Utils.escape(formatted)}</p>
            </div>
          </button>`;
        }).join('')}
      </div>`)}

      ${w.error ? `<div class="rounded-xl bg-rose-500/10 border border-rose-400/40 p-3 text-[12px] text-rose-200">${Utils.escape(w.error)}</div>` : ''}

      <div class="flex justify-between gap-2 pt-1">
        <button onclick="Actions.setGoogleAdsWizardStep(2)" class="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 text-xs font-black flex items-center gap-2">
          <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Voltar
        </button>
        <button onclick="Actions.confirmGoogleAdsAccount()" ${(w.saving || !w.selectedCustomerId) ? 'disabled' : ''} class="px-5 py-2.5 rounded-xl ${w.selectedCustomerId ? 'bg-amber-500 hover:bg-amber-600' : 'bg-white/10 cursor-not-allowed'} text-white text-xs font-black flex items-center gap-2" style="color:#fff;">
          ${w.saving ? '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Conectando…' : 'Confirmar conexão <i data-lucide="check" class="w-3.5 h-3.5"></i>'}
        </button>
      </div>
    </div>`;
  },

  _step4Success(w) {
    const status = App.state.googleAdsStatus || {};
    const customerFormatted = String(status.selectedCustomerId || '?').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
    // V36.7.0 — Aviso se a conta tem 0 campanhas (mock vai aparecer no Dashboard).
    const isMock = Boolean(App.state.googleAdsCampaignsAreMock);
    const hasCampaigns = Array.isArray(App.state.googleAdsCampaignsCache) && App.state.googleAdsCampaignsCache.length > 0 && !isMock;

    return `<div class="space-y-4 text-center">
      <div class="inline-flex w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-400/40 items-center justify-center mx-auto">
        <i data-lucide="check" class="w-8 h-8 text-emerald-300"></i>
      </div>
      <div>
        <h3 class="text-lg font-black text-white">Google Ads conectado!</h3>
        <p class="text-[12px] text-slate-300 mt-1">
          Conta <span class="font-mono text-amber-300">${Utils.escape(customerFormatted)}</span> ligada ao LeadJourney.
        </p>
      </div>

      <div class="rounded-2xl bg-[#001230]/60 border border-white/10 p-3 text-left">
        <p class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">O que vem agora</p>
        <ul class="text-[12px] text-slate-300 space-y-1 list-disc pl-5">
          <li>Os dados de campanha vão aparecer no <b>Dashboard → Google Ads</b>.</li>
          <li>Primeira sincronização roda em background nos próximos minutos (pode forçar pelo botão "Sincronizar agora" no card).</li>
          <li>Você pode desconectar a qualquer momento nas Configurações.</li>
        </ul>
      </div>

      ${isMock || !hasCampaigns ? `
      <div class="rounded-2xl bg-amber-500/10 border border-amber-400/40 p-3 text-left">
        <div class="flex items-start gap-2">
          <i data-lucide="info" class="w-4 h-4 text-amber-300 shrink-0 mt-0.5"></i>
          <div>
            <p class="text-[11px] font-black text-amber-200 mb-1">Conta sem campanhas ativas</p>
            <p class="text-[11px] text-amber-100/90">Esta conta ainda não tem campanhas. O Dashboard vai mostrar exemplos até alguém criar campanhas reais no Google Ads. Os números vão se atualizar automaticamente.</p>
          </div>
        </div>
      </div>` : ''}

      <div class="flex justify-end gap-2 pt-1">
        <button onclick="Actions.closeGoogleAdsWizard()" class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black" style="color:#fff;">Fechar</button>
      </div>
    </div>`;
  }
};
