// V35.6.0-alpha4 — Componente reusável Connection Status Card.
//
// Template visual estilo print 3 do RD Station — usado dentro de modais de
// integração pra mostrar status da conexão. Slots fixos:
//
//   1. Identificação principal (texto grande — email, workspace, customer ID)
//   2. Badges variáveis (0-N pills coloridas — sub-conexões, tokenType, etc)
//   3. Botões secundários (0-N — Testar conexão, Revelar PAT, etc)
//   4. Última validação (timestamp + "testado há X min")
//   5. Ícone de ajuda (?) → modal nested "X + LeadJourney" (alpha5/6)
//
// Uso (RD):
//   ConnectionStatusCard.render({
//     accentColor: 'pink',
//     identification: 'felipe@w2c.pro.br',
//     subtitle: 'Conta RD ativa',
//     badges: [
//       { label: 'Token do CRM', status: 'ok' },
//       { label: 'Tempo Real do CRM', status: 'pending' },
//       { label: 'RD Marketing', status: 'ok' }
//     ],
//     lastValidationLabel: 'Última validação: 22/05/2026, 13:39 · testado há 71 min',
//     secondaryButtons: [
//       { label: 'Testar conexão', icon: 'activity', action: 'Actions.testRdConnections()' }
//     ],
//     helpAction: 'Actions.openIntegrationDeepDive(\"rd\")'
//   });

window.ConnectionStatusCard = {
  render(opts) {
    const accent = opts.accentColor || 'slate';
    const accentMap = {
      pink:   { ring: 'ring-pink-400/40',   chip: 'text-pink-200',   helpBg: 'bg-pink-500/20 hover:bg-pink-500/30 border-pink-400/40 text-pink-200' },
      violet: { ring: 'ring-violet-400/40', chip: 'text-violet-200', helpBg: 'bg-violet-500/20 hover:bg-violet-500/30 border-violet-400/40 text-violet-200' },
      amber:  { ring: 'ring-amber-400/40',  chip: 'text-amber-200',  helpBg: 'bg-amber-500/20 hover:bg-amber-500/30 border-amber-400/40 text-amber-200' },
      orange: { ring: 'ring-orange-400/40', chip: 'text-orange-200', helpBg: 'bg-orange-500/20 hover:bg-orange-500/30 border-orange-400/40 text-orange-200' },
      slate:  { ring: 'ring-slate-400/40',  chip: 'text-slate-200',  helpBg: 'bg-slate-500/20 hover:bg-slate-500/30 border-slate-400/40 text-slate-200' }
    }[accent] || { ring: 'ring-slate-400/40', chip: 'text-slate-200', helpBg: 'bg-slate-500/20 hover:bg-slate-500/30 border-slate-400/40 text-slate-200' };

    const badgeStatusCls = {
      ok:      'bg-emerald-500/20 border-emerald-400/40 text-emerald-200',
      pending: 'bg-amber-500/20 border-amber-400/40 text-amber-200',
      error:   'bg-rose-500/20 border-rose-400/40 text-rose-200',
      neutral: 'bg-white/10 border-white/15 text-slate-200'
    };

    return `<div class="rounded-2xl p-5 ring-1 ${accentMap.ring} shadow-xl"
      style="background: linear-gradient(135deg, rgba(0,18,48,0.55) 0%, rgba(10,31,68,0.35) 100%);">

      <!-- ROW 1: identification + help -->
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="min-w-0 flex-1">
          ${opts.kicker ? `<p class="text-[10px] font-black ${accentMap.chip} uppercase tracking-widest mb-0.5">${Utils.escape(opts.kicker)}</p>` : ''}
          <h3 class="text-base font-black text-white truncate">${Utils.escape(opts.identification || '—')}</h3>
          ${opts.subtitle ? `<p class="text-[11px] text-slate-300 mt-0.5">${Utils.escape(opts.subtitle)}</p>` : ''}
        </div>
        ${opts.helpAction ? `<button onclick="${opts.helpAction}"
          title="Como esta integração troca dados com o LJ"
          class="shrink-0 w-8 h-8 rounded-lg border ${accentMap.helpBg} grid place-items-center transition">
          <i data-lucide="help-circle" class="w-4 h-4"></i>
        </button>` : ''}
      </div>

      <!-- ROW 2: badges -->
      ${(opts.badges && opts.badges.length) ? `<div class="flex flex-wrap gap-1.5 mb-3">
        ${opts.badges.map(b => `<span class="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border inline-flex items-center gap-1.5 ${badgeStatusCls[b.status] || badgeStatusCls.neutral}">
          ${b.icon ? `<i data-lucide="${b.icon}" class="w-3 h-3"></i>` : ''}
          ${Utils.escape(b.label)}
        </span>`).join('')}
      </div>` : ''}

      <!-- ROW 3: last validation -->
      ${opts.lastValidationLabel ? `<p class="text-[10px] text-slate-400 mb-3 inline-flex items-center gap-1.5">
        <i data-lucide="clock" class="w-3 h-3"></i>
        ${Utils.escape(opts.lastValidationLabel)}
      </p>` : ''}

      <!-- V36.7.0 — ROW 3.5: primary button (opcional, ação principal destacada) -->
      ${opts.primaryButton ? `<div class="mt-3">
        <button onclick="${opts.primaryButton.action}" ${opts.primaryButton.disabled ? 'disabled' : ''}
          class="w-full px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-black inline-flex items-center justify-center gap-2" style="color:#fff;">
          ${opts.primaryButton.icon ? `<i data-lucide="${opts.primaryButton.icon}" class="w-4 h-4 ${opts.primaryButton.iconClass || ''}"></i>` : ''}
          ${Utils.escape(opts.primaryButton.label)}
        </button>
      </div>` : ''}

      <!-- ROW 4: secondary buttons -->
      ${(opts.secondaryButtons && opts.secondaryButtons.length) ? `<div class="flex flex-wrap gap-2 pt-2 ${opts.primaryButton ? 'mt-2' : 'border-t border-white/10'}">
        ${opts.secondaryButtons.map(btn => `<button onclick="${btn.action}"
          class="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-slate-200 text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
          ${btn.icon ? `<i data-lucide="${btn.icon}" class="w-3 h-3"></i>` : ''}
          ${Utils.escape(btn.label)}
        </button>`).join('')}
      </div>` : ''}
    </div>`;
  }
};
