// V35.6.0-alpha4 — Modal próprio de Conexão ClickUp.
//
// Substitui o deep-link pra Settings > seção 'clickup' (que continua viva
// como backstop até a alpha final). Fundo Iterar (#1565C0 royal blue),
// accent violet (cor brand ClickUp) como nuance que vibra na cor da aba.
//
// Estrutura:
//   1. Header com kicker "Integrações · Iterar"
//   2. ConnectionStatusCard com badge tokenType (OAuth | PAT)
//   3. Grid de 2 cards: "Workspace + Raiz" e "Sincronização de Tarefas"
//   4. Botão "Configuração avançada" abre Settings legacy section 'clickup'

window.ClickupConnectionModal = {
  render() {
    if (!App.state.clickupConnectionModalOpen) return '';

    const status = App.state.clickupStatus || {};
    const connected = Boolean(status.connected);
    const workspaceName = status.workspaceName || 'Workspace não selecionado';
    const tokenType = status.tokenType || null;
    const rootLabel = status.rootKind === 'list' ? 'List'
                    : status.rootKind === 'folder' ? 'Folder'
                    : status.rootKind === 'space' ? 'Space' : null;
    const rootName = status.rootName || null;
    const writeEnabled = status.writeEnabled !== false;

    const tokenBadge = tokenType === 'oauth'
      ? { label: 'via OAuth', status: 'ok', icon: 'shield-check' }
      : tokenType === 'pat'
      ? { label: 'via Personal API Token', status: 'ok', icon: 'key' }
      : { label: 'Token desconhecido', status: 'neutral', icon: 'key' };

    const writeBadge = connected
      ? (writeEnabled
        ? { label: 'Escrita ativa', status: 'ok', icon: 'pencil' }
        : { label: 'Somente leitura', status: 'pending', icon: 'pause-circle' })
      : null;

    const rootBadge = (connected && rootLabel)
      ? { label: `${rootLabel}: ${rootName || (status.rootId || '?')}`, status: 'ok', icon: 'folder-tree' }
      : null;

    const badges = [tokenBadge, writeBadge, rootBadge].filter(Boolean);

    const lastSyncAt = status.lastSyncAt || status.lastValidationAt;
    const lastValidationLabel = lastSyncAt
      ? `Última sincronização: ${this._fmtDate(lastSyncAt)}`
      : (connected ? 'Conectado, sem sincronizações registradas ainda.' : 'Ainda não conectado.');

    return `<div class="fixed inset-0 z-[92] grid place-items-center p-4"
      style="background: rgba(21,101,192,0.85); backdrop-filter: blur(6px);"
      onclick="if(event.target===this) Actions.closeClickupConnectionModal()">
      <div class="w-full max-w-3xl rounded-3xl border-2 border-violet-400/40 shadow-2xl overflow-hidden"
        style="background: linear-gradient(135deg, #1565C0 0%, #0A3D7A 60%, #082A56 100%);">

        <!-- HEADER -->
        <div class="border-b border-white/10 px-6 py-5 flex items-start justify-between gap-3"
          style="background: linear-gradient(90deg, rgba(167,139,250,0.18) 0%, rgba(167,139,250,0.03) 100%);">
          <div class="min-w-0">
            <p class="text-[10px] font-black text-violet-200 uppercase tracking-widest inline-flex items-center gap-1.5">
              <i data-lucide="repeat" class="w-3 h-3"></i> Integrações · Iterar
            </p>
            <h2 class="text-xl font-black text-white mt-1 leading-tight">ClickUp</h2>
            <p class="text-[12px] text-slate-200 mt-0.5">Espelha Produto > Campanha > Ação > Tarefa para execução do time. O ClickUp tem vida própria; o LJ dialoga em loop.</p>
          </div>
          <button onclick="Actions.closeClickupConnectionModal()" class="shrink-0 w-9 h-9 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white grid place-items-center">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- BODY -->
        <div class="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

          ${ConnectionStatusCard.render({
            accentColor: 'violet',
            kicker: connected ? 'Workspace conectado' : 'Não conectado',
            identification: workspaceName,
            subtitle: connected ? 'Mirror ativo · Produto > Campanha > Ação > Tarefa' : 'Conecte pra começar a espelhar hierarquia no ClickUp.',
            badges,
            lastValidationLabel,
            secondaryButtons: connected ? [
              ...(tokenType === 'pat' ? [{ label: 'Revelar PAT', icon: 'eye', action: 'Actions.revealClickupPat()' }] : []),
              { label: 'ClickUp + LeadJourney', icon: 'book-open', action: "Actions.openIntegrationDeepDive('clickup')" }
            ] : [],
            helpAction: "Actions.openIntegrationDeepDive('clickup')"
          })}

          <!-- V35.6.1 — Painel completo de configuração ClickUp embedado.
               Conteúdo herda layout claro do SettingsModal.clickupPanel()
               com wrapper branco pra contrastar com fundo Iterar. -->
          <div class="rounded-2xl bg-white shadow-xl overflow-hidden">
            ${(window.SettingsModal?.clickupPanel) ? SettingsModal.clickupPanel() : '<div class="p-6 text-slate-700">Painel ClickUp indisponível.</div>'}
          </div>

        </div>
      </div>
    </div>`;
  },

  _subCard(c) {
    const statusInfo = c.status === 'ok'
      ? { label: 'OK', cls: 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200' }
      : c.status === 'pending'
      ? { label: 'Pendente', cls: 'bg-amber-500/20 border-amber-400/40 text-amber-200' }
      : { label: 'Erro', cls: 'bg-rose-500/20 border-rose-400/40 text-rose-200' };

    return `<button onclick="${c.action}" class="text-left rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 hover:border-violet-400/40 p-4 flex flex-col gap-2 transition">
      <div class="flex items-start justify-between gap-2">
        <span class="w-9 h-9 rounded-xl bg-violet-500/20 grid place-items-center text-violet-200">
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
