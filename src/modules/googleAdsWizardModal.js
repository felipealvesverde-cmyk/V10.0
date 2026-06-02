// V35.5.0 — Google Ads Wizard Modal (4 steps).
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

    return `<div class="fixed inset-0 z-[90] grid place-items-center p-4"
      style="background: rgba(15,23,42,0.78); backdrop-filter: blur(6px);"
      onclick="if(event.target===this) Actions.closeGoogleAdsWizard()">
      <div class="w-full max-w-2xl rounded-3xl bg-slate-900 border-2 border-pink-400/40 shadow-2xl overflow-hidden">

        <div class="bg-gradient-to-r from-pink-500/20 to-rose-500/20 border-b border-white/10 px-5 py-4 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[10px] font-black text-pink-300 uppercase tracking-widest inline-flex items-center gap-1.5">
              <i data-lucide="megaphone" class="w-3 h-3"></i> Conectar Google Ads
            </p>
            <h2 class="text-lg font-black text-white mt-1 leading-tight">Marketing · Aquisição</h2>
            <p class="text-[11px] text-slate-300 mt-0.5">Investimento, ROAS, CPL e conversões dentro do LJ.</p>
          </div>
          <button onclick="Actions.closeGoogleAdsWizard()" class="shrink-0 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 grid place-items-center">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        ${this._stepper(w)}

        <div class="p-5 max-h-[65vh] overflow-y-auto">
          ${w.step === 1 ? this._step1Credentials(w) : ''}
          ${w.step === 2 ? this._step2Authorize(w) : ''}
          ${w.step === 3 ? this._step3SelectAccount(w) : ''}
          ${w.step === 4 ? this._step4Success(w) : ''}
        </div>
      </div>
    </div>`;
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
                    : active ? 'bg-pink-500/25 border-pink-400/60 text-pink-100'
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
    const oauthDone = Boolean(App.state.googleAdsStatus?.oauthCompleted);
    return `<div class="space-y-4">
      <div class="rounded-xl bg-pink-500/5 border border-pink-400/30 p-3 space-y-2">
        <p class="text-[11px] font-black text-pink-200 uppercase tracking-widest">O que você vai precisar</p>
        <ol class="text-[12px] text-slate-300 space-y-1 list-decimal pl-5">
          <li><b>Client ID + Client Secret</b> — do Google Cloud Console (em "Credenciais OAuth").</li>
          <li><b>Developer Token</b> — do painel Google Ads (Ferramentas → API Center).</li>
          <li><b>MCC ID</b> (opcional) — só se você gerencia múltiplas contas via Manager Account.</li>
        </ol>
      </div>

      <div class="space-y-1.5">
        <label class="text-[11px] font-black text-pink-300 uppercase tracking-widest">Client ID</label>
        <input type="text" value="${Utils.escape(d.clientId || '')}"
          oninput="Actions.updateGoogleAdsDraft('clientId', this.value)"
          placeholder="123456789-abc...apps.googleusercontent.com"
          class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white text-[12px] font-mono focus:border-pink-400/60 focus:outline-none" />
      </div>

      <div class="space-y-1.5">
        <label class="text-[11px] font-black text-pink-300 uppercase tracking-widest">Client Secret</label>
        <input type="password" value="${Utils.escape(d.clientSecret || '')}"
          oninput="Actions.updateGoogleAdsDraft('clientSecret', this.value)"
          placeholder="GOCSPX-xxxxxxxxxxxxx"
          class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white text-[12px] font-mono focus:border-pink-400/60 focus:outline-none" />
      </div>

      <div class="space-y-1.5">
        <label class="text-[11px] font-black text-pink-300 uppercase tracking-widest">Developer Token</label>
        <input type="password" value="${Utils.escape(d.developerToken || '')}"
          oninput="Actions.updateGoogleAdsDraft('developerToken', this.value)"
          placeholder="20+ caracteres alfanuméricos"
          class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white text-[12px] font-mono focus:border-pink-400/60 focus:outline-none" />
        <p class="text-[10px] text-slate-500">Pode levar 1-7 dias pra Google aprovar o seu Developer Token.</p>
      </div>

      <div class="space-y-1.5">
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-widest">MCC ID (opcional)</label>
        <input type="text" value="${Utils.escape(d.loginCustomerId || '')}"
          oninput="Actions.updateGoogleAdsDraft('loginCustomerId', this.value)"
          placeholder="1234567890 (sem traços)"
          class="w-full px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white text-[12px] font-mono focus:border-slate-400/60 focus:outline-none" />
        <p class="text-[10px] text-slate-500">Só preencha se você gerencia via Manager Account.</p>
      </div>

      ${w.error ? `<div class="rounded-xl bg-rose-500/10 border border-rose-400/40 p-3 text-[12px] text-rose-200">${Utils.escape(w.error)}</div>` : ''}

      <div class="flex justify-end gap-2 pt-1">
        <button onclick="Actions.closeGoogleAdsWizard()" class="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 text-xs font-black">Cancelar</button>
        <button onclick="Actions.saveGoogleAdsCredentials()" ${w.saving ? 'disabled' : ''} class="px-4 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-black flex items-center gap-2" style="color:#fff;">
          ${w.saving ? '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Salvando…' : '<i data-lucide="save" class="w-3.5 h-3.5"></i> Salvar e avançar'}
        </button>
      </div>
    </div>`;
  },

  _step2Authorize(w) {
    return `<div class="space-y-4">
      <div class="rounded-2xl bg-emerald-500/10 border border-emerald-400/40 p-3">
        <p class="text-[11px] font-black text-emerald-200 uppercase tracking-widest mb-1">✓ Credenciais salvas</p>
        <p class="text-[12px] text-emerald-100">Agora vamos autorizar o LeadJourney a acessar sua conta Google Ads.</p>
      </div>

      <div class="rounded-2xl bg-slate-800/40 border border-white/10 p-4 space-y-2">
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
        <button onclick="Actions.startGoogleAdsAuthorization()" ${w.authorizing ? 'disabled' : ''} class="px-5 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-black flex items-center gap-2" style="color:#fff;">
          ${w.authorizing ? '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Aguardando autorização…' : '<i data-lucide="external-link" class="w-3.5 h-3.5"></i> Autorizar com Google'}
        </button>
      </div>
    </div>`;
  },

  _step3SelectAccount(w) {
    const accounts = Array.isArray(w.accounts) ? w.accounts : [];
    return `<div class="space-y-4">
      <div class="rounded-2xl bg-emerald-500/10 border border-emerald-400/40 p-3">
        <p class="text-[11px] font-black text-emerald-200 uppercase tracking-widest mb-1">✓ Autorização concluída</p>
        <p class="text-[12px] text-emerald-100">Escolha qual conta Google Ads você quer conectar.</p>
      </div>

      ${accounts.length === 0 ? `<div class="rounded-xl bg-amber-500/10 border border-amber-400/40 p-3 text-[12px] text-amber-200">
        Nenhuma conta encontrada — verifique se o Developer Token está aprovado pelo Google e se você tem acesso a alguma conta Google Ads.
      </div>` : `<div class="space-y-2">
        ${accounts.map(acc => {
          const isSelected = w.selectedCustomerId === String(acc.customerId);
          return `<button onclick="Actions.setGoogleAdsSelectedCustomer('${Utils.escape(String(acc.customerId))}')"
            class="w-full text-left p-3 rounded-xl border-2 ${isSelected ? 'border-pink-400 bg-pink-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'} transition flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-pink-500/20 grid place-items-center">
              <i data-lucide="${isSelected ? 'check-circle-2' : 'circle'}" class="w-4 h-4 text-pink-300"></i>
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-[12px] font-black text-white">Customer ${Utils.escape(String(acc.customerId))}</p>
              <p class="text-[10px] text-slate-400 font-mono">${Utils.escape(String(acc.customerId))}</p>
            </div>
          </button>`;
        }).join('')}
      </div>`}

      ${w.error ? `<div class="rounded-xl bg-rose-500/10 border border-rose-400/40 p-3 text-[12px] text-rose-200">${Utils.escape(w.error)}</div>` : ''}

      <div class="flex justify-between gap-2 pt-1">
        <button onclick="Actions.setGoogleAdsWizardStep(2)" class="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 text-xs font-black flex items-center gap-2">
          <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Voltar
        </button>
        <button onclick="Actions.confirmGoogleAdsAccount()" ${(w.saving || !w.selectedCustomerId) ? 'disabled' : ''} class="px-5 py-2.5 rounded-xl ${w.selectedCustomerId ? 'bg-pink-500 hover:bg-pink-600' : 'bg-white/10 cursor-not-allowed'} text-white text-xs font-black flex items-center gap-2" style="color:#fff;">
          ${w.saving ? '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Conectando…' : 'Confirmar conexão <i data-lucide="check" class="w-3.5 h-3.5"></i>'}
        </button>
      </div>
    </div>`;
  },

  _step4Success(w) {
    const status = App.state.googleAdsStatus || {};
    return `<div class="space-y-4 text-center">
      <div class="inline-flex w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-400/40 items-center justify-center mx-auto">
        <i data-lucide="check" class="w-8 h-8 text-emerald-300"></i>
      </div>
      <div>
        <h3 class="text-lg font-black text-white">Google Ads conectado!</h3>
        <p class="text-[12px] text-slate-300 mt-1">
          Conta <span class="font-mono text-pink-300">${Utils.escape(status.selectedCustomerId || '?')}</span> ligada ao LeadJourney.
        </p>
      </div>

      <div class="rounded-2xl bg-slate-800/40 border border-white/10 p-3 text-left">
        <p class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">O que vem agora</p>
        <ul class="text-[12px] text-slate-300 space-y-1 list-disc pl-5">
          <li>Os dados de campanha vão aparecer no <b>Dashboard → Google Ads</b>.</li>
          <li>Primeira sincronização roda em background nos próximos minutos.</li>
          <li>Você pode desconectar a qualquer momento nas Configurações.</li>
        </ul>
      </div>

      <div class="flex justify-end gap-2 pt-1">
        <button onclick="Actions.closeGoogleAdsWizard()" class="px-5 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-black" style="color:#fff;">Fechar</button>
      </div>
    </div>`;
  }
};
