// V32.12.4 — Modal de relogin inline (JWT expirado).
//
// Aberto quando QUALQUER endpoint que usa lj_jwt retorna 401. Não faz logout
// automático — preserva localStorage e App.state pra cliente NÃO perder o
// trabalho não-salvo.
//
// Comportamento:
//   1. Modal cobre tela com fundo vermelho semi-transparente (sinaliza urgência).
//   2. Mostra mensagem clara: "Sessão expirou. Suas mudanças ainda estão aqui."
//   3. Campo de senha + botão "Reentrar e Salvar" (primary).
//   4. Após relogin OK: novo JWT salvo, _doPush imediato, modal fecha,
//      toast "Sessão renovada".
//   5. Botão secundário menor "Sair mesmo assim" (logoutWithBackup): baixa
//      JSON do state ANTES de limpar localStorage.
//
// Lei JWT silent failure: cravada após perda Sansone 2026-05-25.

(function() {
  'use strict';

  const ReloginInlineModal = {

    render() {
      const m = window.App?.state?.reloginInlineModal;
      if (!m?.open) return '';
      const loading = !!m.loading;
      const error = m.error || '';

      // Lê username do JWT atual pra mostrar quem está reentrando.
      let username = '';
      try {
        const jwt = localStorage.getItem('lj_jwt');
        if (jwt) {
          const payload = JSON.parse(atob(jwt.split('.')[1]));
          username = payload?.username || '';
        }
      } catch (_) {}
      if (!username) {
        try {
          const u = JSON.parse(localStorage.getItem('lj_user') || '{}');
          username = u.username || u.email || '';
        } catch (_) {}
      }

      return `
        <div class="fixed inset-0 z-[99] grid place-items-center p-4" style="background: rgba(127,29,29,0.85); backdrop-filter: blur(8px);">
          <div class="w-full max-w-md rounded-3xl bg-white shadow-2xl border-2 border-rose-300 overflow-hidden">
            <div class="bg-gradient-to-br from-rose-600 via-rose-700 to-rose-800 px-6 py-5 text-white">
              <div class="flex items-center gap-3">
                <span class="w-10 h-10 rounded-xl bg-white/15 grid place-items-center">
                  <i data-lucide="shield-alert" class="w-5 h-5"></i>
                </span>
                <div>
                  <p class="text-[10px] font-black text-rose-100 uppercase tracking-widest">Sessão Expirada</p>
                  <h2 class="text-lg font-black leading-tight">Reentre para continuar</h2>
                </div>
              </div>
              <p class="text-[12px] text-rose-100/90 mt-3 leading-relaxed">
                Sua sessão expirou enquanto você trabalhava. <b class="text-white">Suas alterações ainda estão aqui, em memória</b> — entre de novo e o sistema salva tudo automaticamente.
              </p>
            </div>

            <div class="p-6 space-y-4">
              ${username ? `<div class="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Conta</p>
                <p class="text-sm font-bold text-slate-900 mt-0.5">${Utils.escape(username)}</p>
              </div>` : ''}

              <div>
                <label class="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Senha</label>
                <input type="password" id="lj-relogin-password" ${loading ? 'disabled' : ''}
                  onkeydown="if(event.key==='Enter'){event.preventDefault();Actions.submitReloginInline(this.value);}"
                  placeholder="Digite sua senha"
                  autocomplete="current-password"
                  class="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-sm font-bold text-slate-900 focus:border-violet-500 focus:bg-white outline-none disabled:opacity-50" />
              </div>

              ${error ? `<div class="rounded-xl bg-rose-50 border border-rose-300 px-3 py-2 flex items-start gap-2">
                <i data-lucide="x-circle" class="w-4 h-4 text-rose-700 shrink-0 mt-0.5"></i>
                <p class="text-[12px] text-rose-800 font-bold leading-snug">${Utils.escape(error)}</p>
              </div>` : ''}

              <button ${loading ? 'disabled' : ''}
                onclick="Actions.submitReloginInline(document.getElementById('lj-relogin-password').value)"
                class="w-full px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-black uppercase tracking-wider inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style="color:#fff!important;">
                <i data-lucide="${loading ? 'loader-2' : 'log-in'}" class="w-4 h-4 ${loading ? 'animate-spin' : ''}"></i>
                ${loading ? 'Reentrando...' : 'Reentrar e Salvar'}
              </button>

              <div class="pt-3 border-t border-slate-200">
                <button onclick="Actions.logoutWithBackup()" ${loading ? 'disabled' : ''}
                  class="w-full text-[11px] font-bold text-slate-500 hover:text-slate-700 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                  title="Baixa um JSON de backup do seu trabalho atual ANTES de sair.">
                  <i data-lucide="download" class="w-3 h-3"></i>
                  Sair mesmo assim (baixa backup automático)
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

  };

  window.ReloginInlineModal = ReloginInlineModal;
})();
