// V23.0.0 — Tela de Login full-page do LeadJourney.
// Aparece ANTES do app carregar quando não há JWT válido em localStorage.
// Tem 2 tabs: Login (existente) + Registrar (cria pendente).
window.LoginScreen = {
  state: {
    tab: 'login',         // 'login' | 'register' | 'reset' (V37.4.31)
    loginUsername: '',
    loginPassword: '',
    registerUsername: '',
    registerEmail: '',
    registerMode: 'sandbox',
    // V37.4.31 — Fluxo de reset sem email. Quando submitLogin detecta
    // passwordResetPending=true, troca tab pra 'reset' carregando username.
    resetUsername: '',
    resetNewPassword: '',
    resetConfirmPassword: '',
    loading: false,
    message: '',
    messageTone: 'info'    // 'info' | 'success' | 'error'
  },

  // V23.0.1 — Não re-renderiza em cada keystroke (destruía o input + perdia foco).
  // O browser mantém o valor digitado no DOM; só guardamos no state pra submit.
  setField(field, value) {
    this.state[field] = value;
  },

  // V23.0.1 — Mudança de modo (radio) PRECISA re-renderizar pra atualizar
  // o destaque visual do card selecionado. Antes de re-renderizar, sincroniza
  // os valores dos inputs de texto que estavam no DOM mas não no state.
  setMode(modeValue) {
    this._syncDomToState();
    this.state.registerMode = modeValue;
    this.render();
  },

  // V23.0.1 — Captura valores atuais dos inputs do DOM e atualiza state.
  // Necessário antes de qualquer render() pra não perder o que o usuário digitou.
  // V37.4.31 — Inclui campos da tela de reset.
  _syncDomToState() {
    const map = {
      loginUsernameField: 'loginUsername',
      loginPwdField: 'loginPassword',
      registerUsernameField: 'registerUsername',
      registerEmailField: 'registerEmail',
      resetNewPwdField: 'resetNewPassword',
      resetConfirmPwdField: 'resetConfirmPassword'
    };
    Object.keys(map).forEach(id => {
      const el = document.getElementById(id);
      if (el && el.value !== undefined) this.state[map[id]] = el.value;
    });
  },

  setTab(tab) {
    this._syncDomToState();
    this.state.tab = tab;
    this.state.message = '';
    this.render();
  },

  setMessage(text, tone = 'info') {
    this.state.message = text;
    this.state.messageTone = tone;
    this.render();
  },

  async submitLogin() {
    const username = String(this.state.loginUsername || '').trim();
    const password = String(this.state.loginPassword || '');
    if (!username) { this.setMessage('Informe o username/email.', 'error'); return; }
    this.state.loading = true;
    this.render();
    try {
      const res = await fetch('/api/auth-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!data.ok) {
        this.setMessage(data.message || 'Falha no login.', 'error');
        this.state.loading = false;
        this.render();
        return;
      }
      // V37.4.31 — Admin marcou esse user pra resetar senha. Vai pra tela de
      // definição de nova senha sem cobrar a atual.
      if (data.passwordResetPending) {
        this.state.tab = 'reset';
        this.state.resetUsername = data.username || username;
        this.state.resetNewPassword = '';
        this.state.resetConfirmPassword = '';
        this.state.loading = false;
        this.setMessage('Reset de senha pendente. Defina uma nova senha pra entrar.', 'info');
        return;
      }
      // Sucesso: salva JWT em localStorage + recarrega
      localStorage.setItem('lj_jwt', data.token);
      localStorage.setItem('lj_user', JSON.stringify(data.user));
      this.setMessage('Entrando...', 'success');
      setTimeout(() => window.location.reload(), 400);
    } catch (err) {
      this.setMessage(`Erro de rede: ${err?.message || err}`, 'error');
      this.state.loading = false;
      this.render();
    }
  },

  // V37.4.31 — Finaliza reset de senha (sem JWT, endpoint público).
  async submitResetPassword() {
    this._syncDomToState();
    const username = String(this.state.resetUsername || '').trim();
    const newPassword = String(this.state.resetNewPassword || '');
    const confirmPassword = String(this.state.resetConfirmPassword || '');
    if (!newPassword || newPassword.length < 8) {
      this.setMessage('Nova senha precisa de no mínimo 8 caracteres.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      this.setMessage('As senhas não conferem.', 'error');
      return;
    }
    this.state.loading = true;
    this.render();
    try {
      const res = await fetch('/api/auth-complete-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, newPassword })
      });
      const data = await res.json();
      if (!data.ok) {
        this.setMessage(data.message || 'Falha ao redefinir senha.', 'error');
        this.state.loading = false;
        this.render();
        return;
      }
      localStorage.setItem('lj_jwt', data.token);
      localStorage.setItem('lj_user', JSON.stringify(data.user));
      this.setMessage('Senha redefinida. Entrando...', 'success');
      setTimeout(() => window.location.reload(), 400);
    } catch (err) {
      this.setMessage(`Erro de rede: ${err?.message || err}`, 'error');
      this.state.loading = false;
      this.render();
    }
  },

  async submitRegister() {
    const username = String(this.state.registerUsername || '').trim();
    const email = String(this.state.registerEmail || '').trim();
    const modeRequested = this.state.registerMode;
    if (!username) { this.setMessage('Informe o username.', 'error'); return; }
    if (username.length < 3) { this.setMessage('Username muito curto (mínimo 3).', 'error'); return; }
    this.state.loading = true;
    this.render();
    try {
      const res = await fetch('/api/auth-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, modeRequested })
      });
      const data = await res.json();
      this.state.loading = false;
      if (!data.ok) {
        this.setMessage(data.message || 'Falha no cadastro.', 'error');
        this.render();
        return;
      }
      this.setMessage(data.message || 'Cadastro enviado. Aguarde aprovação.', 'success');
      this.state.registerUsername = '';
      this.state.registerEmail = '';
      this.render();
    } catch (err) {
      this.state.loading = false;
      this.setMessage(`Erro de rede: ${err?.message || err}`, 'error');
      this.render();
    }
  },

  template() {
    const s = this.state;
    const tabBtn = (key, label) => `<button onclick="LoginScreen.setTab('${key}')" class="px-5 py-2.5 rounded-2xl text-sm font-black transition ${s.tab === key ? 'bg-white text-slate-900 shadow' : 'bg-transparent text-slate-400 hover:text-white'}">${label}</button>`;
    const toneClass = s.messageTone === 'error' ? 'bg-red-500/20 border-red-400/40 text-red-100'
      : s.messageTone === 'success' ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100'
      : 'bg-sky-500/20 border-sky-400/40 text-sky-100';

    return `<div class="min-h-screen w-full flex items-center justify-center p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      <div class="w-full max-w-md">
        <div class="text-center mb-8">
          <div class="inline-flex items-center gap-3 mb-3">
            <div class="w-14 h-14 grid place-items-center">
              <img src="/public/lj-logo.png" alt="LeadJourney" class="w-14 h-14" />
            </div>
            <h1 class="text-3xl font-black text-white">LeadJourney</h1>
          </div>
          <p class="text-sm text-slate-400">Revenue Operating System · ${window.LJVersion || 'V?'}</p>
        </div>

        <div class="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
          ${s.tab !== 'reset' ? `
            <div class="bg-slate-800/60 rounded-2xl p-1 flex gap-1 mb-5">
              ${tabBtn('login', 'Entrar')}
              ${tabBtn('register', 'Solicitar acesso')}
            </div>
          ` : ''}

          ${s.tab === 'reset' ? `
            <div class="space-y-4">
              <div class="rounded-2xl bg-violet-500/15 border border-violet-400/30 px-4 py-3">
                <p class="text-[11px] font-black text-violet-200 uppercase tracking-wider">Reset de senha</p>
                <p class="text-sm text-violet-50 mt-1">Olá, <span class="font-black">${this._esc(s.resetUsername)}</span>. O admin master pediu que você redefina sua senha.</p>
              </div>
              <div>
                <label class="text-xs font-black text-slate-400 uppercase tracking-wide">Nova senha</label>
                <input type="password" id="resetNewPwdField" autocomplete="new-password" value="${this._esc(s.resetNewPassword)}"
                  oninput="LoginScreen.setField('resetNewPassword', this.value)"
                  onkeydown="if(event.key==='Enter'){document.getElementById('resetConfirmPwdField')?.focus()}"
                  class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-800/80 border border-white/10 text-white font-semibold placeholder:text-slate-500" placeholder="Mínimo 8 caracteres" />
              </div>
              <div>
                <label class="text-xs font-black text-slate-400 uppercase tracking-wide">Confirme a nova senha</label>
                <input type="password" id="resetConfirmPwdField" autocomplete="new-password" value="${this._esc(s.resetConfirmPassword)}"
                  oninput="LoginScreen.setField('resetConfirmPassword', this.value)"
                  onkeydown="if(event.key==='Enter'){LoginScreen.submitResetPassword()}"
                  class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-800/80 border border-white/10 text-white font-semibold placeholder:text-slate-500" placeholder="Repita a senha" />
              </div>
              <button onclick="LoginScreen.submitResetPassword()" ${s.loading ? 'disabled' : ''} class="w-full px-4 py-3.5 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white font-black flex items-center justify-center gap-2 disabled:opacity-50" style="color:#fff;">
                ${s.loading ? '<span class="w-4 h-4 rounded-full border-2 border-white border-r-transparent animate-spin"></span> Redefinindo...' : '<i data-lucide="key-round" class="w-4 h-4"></i> Definir senha e entrar'}
              </button>
              <button onclick="LoginScreen.setTab('login')" class="w-full text-xs text-slate-400 hover:text-slate-200 font-bold pt-1">Cancelar</button>
            </div>
          ` : s.tab === 'login' ? `
            <div class="space-y-4">
              <div>
                <label class="text-xs font-black text-slate-400 uppercase tracking-wide">Username / Email</label>
                <input type="text" id="loginUsernameField" autocomplete="username" value="${this._esc(s.loginUsername)}"
                  oninput="LoginScreen.setField('loginUsername', this.value)"
                  onkeydown="if(event.key==='Enter'){document.getElementById('loginPwdField')?.focus()}"
                  class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-800/80 border border-white/10 text-white font-semibold placeholder:text-slate-500" placeholder="felipe@w2c.pro.br" />
              </div>
              <div>
                <label class="text-xs font-black text-slate-400 uppercase tracking-wide">Senha <span class="font-normal text-slate-500">(só master)</span></label>
                <input type="password" id="loginPwdField" autocomplete="current-password" value="${this._esc(s.loginPassword)}"
                  oninput="LoginScreen.setField('loginPassword', this.value)"
                  onkeydown="if(event.key==='Enter'){LoginScreen.submitLogin()}"
                  class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-800/80 border border-white/10 text-white font-semibold placeholder:text-slate-500" placeholder="••••••••" />
              </div>
              <button onclick="LoginScreen._syncDomToState(); LoginScreen.submitLogin()" ${s.loading ? 'disabled' : ''} class="w-full px-4 py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-black flex items-center justify-center gap-2 disabled:opacity-50" style="color:#fff;">
                ${s.loading ? '<span class="w-4 h-4 rounded-full border-2 border-white border-r-transparent animate-spin"></span> Entrando...' : '<i data-lucide="log-in" class="w-4 h-4"></i> Entrar'}
              </button>
            </div>
          ` : `
            <div class="space-y-4">
              <p class="text-sm text-slate-300 leading-relaxed">Solicite acesso ao LeadJourney. Seu cadastro fica pendente até o administrador aprovar.</p>
              <div>
                <label class="text-xs font-black text-slate-400 uppercase tracking-wide">Username desejado</label>
                <input type="text" id="registerUsernameField" value="${this._esc(s.registerUsername)}"
                  oninput="LoginScreen.setField('registerUsername', this.value)"
                  class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-800/80 border border-white/10 text-white font-semibold placeholder:text-slate-500" placeholder="seu.nome" />
              </div>
              <div>
                <label class="text-xs font-black text-slate-400 uppercase tracking-wide">Email <span class="font-normal text-slate-500">(opcional)</span></label>
                <input type="email" id="registerEmailField" value="${this._esc(s.registerEmail)}"
                  oninput="LoginScreen.setField('registerEmail', this.value)"
                  class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-800/80 border border-white/10 text-white font-semibold placeholder:text-slate-500" placeholder="seu@email.com" />
              </div>
              <div>
                <label class="text-xs font-black text-slate-400 uppercase tracking-wide">Modo desejado</label>
                <div class="mt-1 grid grid-cols-2 gap-2">
                  <label class="rounded-2xl p-3 cursor-pointer border ${s.registerMode === 'sandbox' ? 'border-sky-400 bg-sky-500/15' : 'border-white/10 bg-slate-800/50'} text-white">
                    <input type="radio" name="regMode" value="sandbox" ${s.registerMode === 'sandbox' ? 'checked' : ''} onchange="LoginScreen.setMode('sandbox')" class="mr-2" />
                    <span class="font-black text-sm">Sandbox</span>
                    <span class="block text-[10px] text-slate-400 mt-0.5">Não grava no banco</span>
                  </label>
                  <label class="rounded-2xl p-3 cursor-pointer border ${s.registerMode === 'production' ? 'border-emerald-400 bg-emerald-500/15' : 'border-white/10 bg-slate-800/50'} text-white">
                    <input type="radio" name="regMode" value="production" ${s.registerMode === 'production' ? 'checked' : ''} onchange="LoginScreen.setMode('production')" class="mr-2" />
                    <span class="font-black text-sm">Produção</span>
                    <span class="block text-[10px] text-slate-400 mt-0.5">Grava tudo no banco</span>
                  </label>
                </div>
              </div>
              <button onclick="LoginScreen._syncDomToState(); LoginScreen.submitRegister()" ${s.loading ? 'disabled' : ''} class="w-full px-4 py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-black flex items-center justify-center gap-2 disabled:opacity-50" style="color:#fff;">
                ${s.loading ? '<span class="w-4 h-4 rounded-full border-2 border-white border-r-transparent animate-spin"></span> Enviando...' : '<i data-lucide="user-plus" class="w-4 h-4"></i> Solicitar acesso'}
              </button>
            </div>
          `}

          ${s.message ? `<div class="mt-4 rounded-2xl border p-3 text-xs font-black ${toneClass}">${this._esc(s.message)}</div>` : ''}
        </div>

        <p class="text-center text-xs text-slate-500 mt-6">Sandbox = browser-only (dados não persistem). Produção = sincroniza com banco Railway.</p>
      </div>
    </div>`;
  },

  _esc(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  render() {
    const container = document.getElementById('loginRoot');
    if (!container) return;
    container.innerHTML = this.template();
    if (window.lucide?.createIcons) {
      try { lucide.createIcons(); } catch (_) {}
    }
  }
};
