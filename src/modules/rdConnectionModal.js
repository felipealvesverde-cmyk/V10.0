// V35.6.0-alpha4 — Modal próprio de Conexão RD Station.
//
// Substitui o deep-link pra Settings > seção 'rd' (que continua viva como
// backstop até a alpha final). Fundo Iterar (#1565C0 royal blue), accent
// pink/rose (cor brand RD Station) como nuance que vibra na cor da aba.
//
// Estrutura:
//   1. Header com kicker "Integrações · Iterar"
//   2. ConnectionStatusCard com 3 badges (Token CRM / Tempo Real / RD Marketing)
//   3. Grid de 3 sub-cards (uma por conexão) — cada um leva pra Settings legacy
//   4. Botão "Configuração avançada" abre Settings legacy section 'rd'

window.RdConnectionModal = {
  render() {
    if (!App.state.rdConnectionModalOpen) return '';

    const rdCfg = App.state.integrations?.rd || {};
    const status = App.state.rdConnectionStatus || {};
    const account = (rdCfg.accountName || '').trim() || 'Conta RD não identificada';
    const testing = Boolean(App.state.rdTestingConnections);

    // V35.6.2 — Lógica de cor das badges idêntica ao header antigo
    // (_rdAccountHeader): connected=verde, missing=amarelo, error=vermelho,
    // unknown=cinza. mapBadgeStatus traduz pros 4 status do ConnectionStatusCard.
    const mapBadgeStatus = (s) =>
      s === 'connected' ? 'ok'
      : s === 'missing' ? 'pending'
      : s === 'error'   ? 'error'
      : 'neutral';

    const sub = {
      crmPat:         status.crm_pat?.status         || 'unknown',
      crmOauth:       status.crm_oauth?.status       || 'unknown',
      marketingOauth: status.marketing_oauth?.status || 'unknown'
    };

    // V35.6.2 — Última validação: pega o testedAt mais recente entre as 3
    // conexões (mesma lógica do _rdAccountHeader).
    const lastTested = ['crm_pat', 'marketing_oauth', 'crm_oauth']
      .map(k => status[k]?.testedAt ? new Date(status[k].testedAt).getTime() : 0)
      .reduce((a, b) => Math.max(a, b), 0);
    const crmAt = rdCfg.crmTestAt ? new Date(rdCfg.crmTestAt).toLocaleString('pt-BR') : null;
    const lastValidationLabel = lastTested
      ? `${crmAt ? `Validação CRM: ${crmAt} · ` : ''}testado há ${Math.max(1, Math.round((Date.now() - lastTested) / 60000))} min`
      : 'Conexão ainda não foi testada.';

    return `<div class="fixed inset-0 z-[92] grid place-items-center p-4"
      style="background: rgba(21,101,192,0.85); backdrop-filter: blur(6px);"
      onclick="if(event.target===this) Actions.closeRdConnectionModal()">
      <div class="w-full max-w-3xl rounded-3xl border-2 border-pink-400/40 shadow-2xl overflow-hidden"
        style="background: linear-gradient(135deg, #1565C0 0%, #0A3D7A 60%, #082A56 100%);">

        <!-- HEADER -->
        <div class="border-b border-white/10 px-6 py-5 flex items-start justify-between gap-3"
          style="background: linear-gradient(90deg, rgba(244,114,182,0.18) 0%, rgba(244,114,182,0.03) 100%);">
          <div class="min-w-0">
            <p class="text-[10px] font-black text-pink-200 uppercase tracking-widest inline-flex items-center gap-1.5">
              <i data-lucide="repeat" class="w-3 h-3"></i> Integrações · Iterar
            </p>
            <h2 class="text-xl font-black text-white mt-1 leading-tight">RD Station</h2>
            <p class="text-[12px] text-slate-200 mt-0.5">CRM e Marketing dialogam com o Journey em loop. Token, Tempo Real e Marketing nas 3 sub-conexões abaixo.</p>
          </div>
          <button onclick="Actions.closeRdConnectionModal()" class="shrink-0 w-9 h-9 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white grid place-items-center">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- BODY -->
        <div class="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

          ${ConnectionStatusCard.render({
            accentColor: 'pink',
            kicker: 'Conta RD',
            identification: account,
            subtitle: 'CRM + Marketing · 3 conexões nesta integração',
            badges: [
              { label: 'Token do CRM', status: mapBadgeStatus(sub.crmPat), icon: 'key' },
              { label: 'Tempo Real do CRM', status: mapBadgeStatus(sub.crmOauth), icon: 'zap' },
              { label: 'RD Marketing', status: mapBadgeStatus(sub.marketingOauth), icon: 'mail' }
            ],
            lastValidationLabel,
            secondaryButtons: [
              { label: testing ? 'Testando…' : 'Testar conexão', icon: testing ? 'loader-2' : 'activity', action: testing ? '' : 'Actions.testAllRdConnections()' },
              { label: 'RD + LeadJourney', icon: 'book-open', action: "Actions.openIntegrationDeepDive('rd')" }
            ],
            helpAction: "Actions.openIntegrationDeepDive('rd')"
          })}

          <!-- V35.6.2 — Painel completo de configuração das 3 conexões RD.
               skipHeader=true elimina o _rdAccountHeader (duplicava o
               ConnectionStatusCard acima). Wrapper branco mantém legibilidade
               dentro do fundo Iterar azul royal. -->
          <div class="rounded-2xl bg-white shadow-xl overflow-hidden">
            ${(window.SettingsModal?.rdConnectionPanel) ? SettingsModal.rdConnectionPanel({ skipHeader: true }) : '<div class="p-6 text-slate-700">Painel RD indisponível.</div>'}
          </div>

        </div>
      </div>
    </div>`;
  },

  _subCard(c) {
    const statusInfo = (c.status === 'connected' || c.status === 'ok')
      ? { label: 'Conectado', cls: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200' }
      : (c.status === 'error')
      ? { label: 'Erro', cls: 'bg-rose-500/20 border-rose-400/40 text-rose-200' }
      : (c.status === 'pending')
      ? { label: 'Pendente', cls: 'bg-amber-500/20 border-amber-400/40 text-amber-200' }
      : { label: 'Não testado', cls: 'bg-white/10 border-white/15 text-slate-300' };

    return `<button onclick="${c.action}" class="text-left rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 hover:border-pink-400/40 p-4 flex flex-col gap-2 transition">
      <div class="flex items-start justify-between gap-2">
        <span class="w-9 h-9 rounded-xl bg-pink-500/20 grid place-items-center text-pink-200">
          <i data-lucide="${c.icon}" class="w-4 h-4"></i>
        </span>
        <span class="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${statusInfo.cls}">${statusInfo.label}</span>
      </div>
      <div>
        <p class="text-[12px] font-black text-white">${Utils.escape(c.title)}</p>
        <p class="text-[10px] text-slate-300 leading-snug mt-1">${Utils.escape(c.desc)}</p>
      </div>
    </button>`;
  },

  _fmtDate(iso) {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (_) { return '—'; }
  }
};
