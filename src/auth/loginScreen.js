// V23.0.0 — Tela de Login full-page do LeadJourney.
// Aparece ANTES do app carregar quando não há JWT válido em localStorage.
// Tem 2 tabs: Login (existente) + Registrar (cria pendente).
window.LoginScreen = {
  state: {
    tab: 'login',         // 'login' | 'register'
    loginUsername: '',
    loginPassword: '',
    registerUsername: '',
    registerEmail: '',
    registerMode: 'sandbox',
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
  _syncDomToState() {
    const ids = ['loginUsernameField', 'loginPwdField', 'registerUsernameField', 'registerEmailField'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const map = {
        loginUsernameField: 'loginUsername',
        loginPwdField: 'loginPassword',
        registerUsernameField: 'registerUsername',
        registerEmailField: 'registerEmail'
      };
      if (map[id] && el.value !== undefined) this.state[map[id]] = el.value;
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
            <div class="w-14 h-14 grid place-items-center" style="filter: drop-shadow(0 0 18px rgba(124, 58, 237, .55));">
              <svg viewBox="0 0 64 64" class="w-14 h-14" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="LeadJourney" style="overflow:visible;">
                <rect x="6" y="6" width="52" height="52" rx="10" ry="10" stroke="#7C3AED" stroke-width="3.5" fill="none"/>
                <g stroke="#7C3AED" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none">
                  <path d="M22 19 L22 45"/>
                  <path d="M40 19 L40 41 Q40 47 33 47 L30 47"/>
                </g>
              </svg>
            </div>
            <h1 class="text-3xl font-black text-white">LeadJourney</h1>
          </div>
          <p class="text-sm text-slate-400">Revenue Operating System · ${window.LJVersion || 'V?'}</p>
        </div>

        <div class="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
          <div class="bg-slate-800/60 rounded-2xl p-1 flex gap-1 mb-5">
            ${tabBtn('login', 'Entrar')}
            ${tabBtn('register', 'Solicitar acesso')}
          </div>

          ${s.tab === 'login' ? `
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
