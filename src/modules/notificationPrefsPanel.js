// V37.4.6 — Painel "Notificações" em Configurações.
// Toggle por categoria (sininho + email) + opt-in digest semanal.

window.NotificationPrefsPanel = {
  render() {
    const cache = App.state.notificationPrefsCache || { loading: false, prefs: null, weeklyDigest: false, error: null };
    if (!cache.prefs && !cache.loading && !cache.error) {
      setTimeout(() => Actions.loadNotificationPrefs(), 0);
    }
    if (cache.loading && !cache.prefs) {
      return `<div class="rounded-2xl bg-white border border-stone-200 p-8 text-center">
        <i data-lucide="loader-2" class="w-8 h-8 text-violet-500 mx-auto mb-2 animate-spin"></i>
        <p class="text-[12px] text-stone-600">Carregando preferências...</p>
      </div>`;
    }
    if (cache.error) {
      return `<div class="rounded-2xl bg-rose-50 border border-rose-200 p-5">
        <p class="text-[11px] font-black text-rose-700 uppercase tracking-widest mb-1">Erro</p>
        <p class="text-[12px] text-rose-800">${Utils.escape(cache.error)}</p>
        <button onclick="Actions.loadNotificationPrefs(true)" class="mt-3 px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[11px] font-bold" style="color:#fff!important;">Tentar de novo</button>
      </div>`;
    }
    const prefs = cache.prefs || {};
    const categories = [
      { key: 'handoff', label: 'Handoff (alguém agiu pra você)', body: 'Tarefa atribuída, comentário marcou você, pedido de aprovação, pin cravado.' },
      { key: 'event', label: 'Eventos no tenant', body: 'Produto/campanha/ação/KR criado, lead importado.' },
      { key: 'state', label: 'Mudanças de estado', body: 'Campanha ativada, task encerrada, KR atingiu meta ou caiu em drift.' },
      { key: 'operational', label: 'Operacional', body: 'Task atrasada, capacity alta, próxima entrega, adherência baixa.' },
      { key: 'integration', label: 'Integração', body: 'ClickUp/RD/GA4/Hotmart desconectado, webhook falhando.' },
      { key: 'health', label: 'Tenant Health', body: 'DB sem snapshot, sem login há X dias, cron parado.' }
    ];

    return `<div class="space-y-4" style="border-left:4px solid #7c3aed;">
      <div class="rounded-2xl bg-white border border-stone-200 p-5">
        <h3 class="text-[13px] font-black text-slate-900 mb-1">Por categoria</h3>
        <p class="text-[11px] text-stone-500 mb-4">Escolha onde quer receber cada tipo de notificação. <strong>Sininho</strong> é dentro do LJ, <strong>Email</strong> é fora.</p>
        <div class="rounded-xl border border-stone-200 overflow-hidden">
          <div class="grid grid-cols-[1fr,80px,80px] gap-2 px-4 py-2 bg-stone-50 border-b border-stone-200">
            <span class="text-[10px] font-black text-stone-600 uppercase tracking-widest">Categoria</span>
            <span class="text-[10px] font-black text-stone-600 uppercase tracking-widest text-center">Sininho</span>
            <span class="text-[10px] font-black text-stone-600 uppercase tracking-widest text-center">Email</span>
          </div>
          ${categories.map(c => {
            const p = prefs[c.key] || { inApp: true, email: false };
            return `<div class="grid grid-cols-[1fr,80px,80px] gap-2 px-4 py-3 items-center border-b border-stone-100 last:border-0">
              <div>
                <p class="text-[12px] font-bold text-slate-900">${Utils.escape(c.label)}</p>
                <p class="text-[10px] text-stone-500 leading-snug mt-0.5">${Utils.escape(c.body)}</p>
              </div>
              <label class="grid place-items-center cursor-pointer">
                <input type="checkbox" ${p.inApp ? 'checked' : ''}
                  onchange="Actions.updateNotificationPref('${c.key}', 'inApp', this.checked)"
                  class="w-4 h-4 accent-violet-600">
              </label>
              <label class="grid place-items-center cursor-pointer">
                <input type="checkbox" ${p.email ? 'checked' : ''}
                  onchange="Actions.updateNotificationPref('${c.key}', 'email', this.checked)"
                  class="w-4 h-4 accent-violet-600">
              </label>
            </div>`;
          }).join('')}
        </div>
      </div>

      <div class="rounded-2xl bg-white border border-stone-200 p-5" style="border-left:4px solid #7c3aed;">
        <h3 class="text-[13px] font-black text-slate-900 mb-1">Digest semanal</h3>
        <p class="text-[11px] text-stone-500 mb-3">Receba toda segunda às 9h um email com resumo da semana — útil pra ver tudo de uma vez se você não abre o LJ todo dia.</p>
        <label class="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-stone-50 border border-stone-200 hover:bg-stone-100 transition">
          <input type="checkbox" ${cache.weeklyDigest ? 'checked' : ''}
            onchange="Actions.updateWeeklyDigest(this.checked)"
            class="w-4 h-4 accent-violet-600">
          <div class="flex-1">
            <p class="text-[12px] font-bold text-slate-900">Quero o digest semanal por email</p>
            ${cache.lastDigestSentAt ? `<p class="text-[10px] text-stone-500">Último envio: ${new Date(cache.lastDigestSentAt).toLocaleDateString('pt-BR')}</p>` : '<p class="text-[10px] text-stone-500">Nunca enviado.</p>'}
          </div>
        </label>
        <p class="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 mt-3 inline-flex items-center gap-1.5">
          <i data-lucide="info" class="w-3 h-3"></i>
          Requer SMTP configurado (RESEND_API_KEY no Railway) + cron externo de envio.
        </p>
      </div>
    </div>`;
  }
};
