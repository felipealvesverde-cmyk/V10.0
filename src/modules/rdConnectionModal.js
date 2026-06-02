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
    const rdCrm = App.state.integrations?.rdCrm || {};
    const status = App.state.rdConnectionStatus || {};
    const account = rdCfg.accountEmail || rdCrm.accountEmail || rdCfg.accountName || 'Conta RD Station';

    const sub = {
      crmPat: status.crm_pat?.status || 'unknown',
      crmOauth: status.crm_oauth?.status || 'unknown',
      marketingOauth: status.marketing_oauth?.status || 'unknown'
    };
    const mapBadgeStatus = (s) => s === 'connected' || s === 'ok' ? 'ok' : (s === 'missing' || s === 'unknown') ? 'neutral' : (s === 'error' ? 'error' : 'pending');

    const lastTestAt = status.testedAt || status.lastTestAt;
    const lastValidationLabel = lastTestAt
      ? `Última validação: ${this._fmtDate(lastTestAt)}`
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
              { label: 'Testar conexão', icon: 'activity', action: 'Actions.testRdConnections()' },
              { label: 'RD + LeadJourney', icon: 'book-open', action: "Actions.openIntegrationDeepDive('rd')" }
            ],
            helpAction: "Actions.openIntegrationDeepDive('rd')"
          })}

          <!-- 3 SUB-CARDS -->
          <div class="grid md:grid-cols-3 gap-3">
            ${this._subCard({
              title: 'Token do CRM',
              desc: 'Acesso a deals, contatos e funis via Personal API Token.',
              icon: 'key',
              status: sub.crmPat,
              action: "Actions.openSettingsModal('rd')"
            })}
            ${this._subCard({
              title: 'Tempo Real do CRM',
              desc: 'Webhook OAuth que escuta crm_deal_* em tempo real.',
              icon: 'zap',
              status: sub.crmOauth,
              action: "Actions.openSettingsModal('rd')"
            })}
            ${this._subCard({
              title: 'RD Marketing',
              desc: 'Captura de leads via LP e segmentação Marketing.',
              icon: 'mail',
              status: sub.marketingOauth,
              action: "Actions.openSettingsModal('rd')"
            })}
          </div>

          <!-- FOOTER ACTION -->
          <div class="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
            <p class="text-[11px] text-slate-300">A configuração detalhada (tokens, webhooks, OAuth) vive em Configurações enquanto migramos.</p>
            <button onclick="Actions.openSettingsModal('rd')" class="px-4 py-2.5 rounded-xl bg-pink-500 hover:bg-pink-600 text-white text-xs font-black inline-flex items-center gap-2" style="color:#fff;">
              <i data-lucide="settings" class="w-4 h-4"></i> Configuração avançada
            </button>
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
