// V35.4.3 — Session Expired Banner (A3 pattern).
//
// Banner discreto no topo da tela quando sessão expirou.
// Aparece SEM bloquear reads. Reads continuam servindo dado do App.state.
// Quando user tenta WRITE, modal inline aparece (separado, via interceptor).
//
// Visual: barra fina, cor âmbar (alerta sem pânico), botão "Reentrar".
//
// Convivência com ReloginInlineModal: o modal continua existindo pra
// operações destrutivas (write). Banner serve só pra dar visibilidade
// de que a sessão expirou ANTES do user tentar uma write.

window.SessionExpiredBanner = {
  render() {
    if (!App.state.sessionExpired) return '';
    // Se modal já está aberto, banner some (evita redundância visual)
    if (App.state.reloginInlineModal?.open) return '';
    return `<div class="lj-session-banner">
      <div class="lj-session-banner-inner">
        <div class="lj-session-banner-icon">
          <i data-lucide="alert-circle" class="w-4 h-4"></i>
        </div>
        <div class="lj-session-banner-text">
          <span class="lj-session-banner-title">Sua sessão expirou.</span>
          <span class="lj-session-banner-desc">Você pode continuar navegando, mas pra salvar alterações precisa reentrar.</span>
        </div>
        <button onclick="Actions.openReloginFromBanner()" class="lj-session-banner-btn">
          <i data-lucide="log-in" class="w-3.5 h-3.5"></i>
          Reentrar
        </button>
      </div>
    </div>`;
  }
};
