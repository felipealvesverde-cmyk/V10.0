// V37.3.2 — Painel "Membros" em Configurações.
// Lista membros do tenant atual + permite editar role + permissões custom + remover.
// Convidar (V37.3.3) entra como botão "Convidar Membro" no header.
//
// Renderizado dentro de settingsModal.js quando settingsActiveSection === 'members'.

window.MembersPanel = {
  render() {
    const cache = App.state.membersCache || { loading: false, error: null, members: [], pendingInvites: [], loadedAt: null };
    const isMaster = Boolean(App.state.user?.isMaster);

    // Permissão: só Master ou Owner vê. Outros veem mensagem.
    const myRole = App.state.userPermissions?.role || 'user';
    const canManage = isMaster || myRole === 'owner';
    if (!canManage) {
      return `<div class="rounded-2xl bg-white border border-stone-200 p-8 text-center">
        <i data-lucide="users" class="w-10 h-10 text-stone-300 mx-auto mb-3"></i>
        <p class="text-[13px] text-stone-700 font-bold">Apenas o Admin Master pode gerenciar membros.</p>
        <p class="text-[11px] text-stone-500 mt-1">Fale com quem administra o tenant pra entender quem mais tem acesso.</p>
      </div>`;
    }

    if (!cache.loadedAt && !cache.loading && !cache.error) {
      setTimeout(() => Actions.loadTenantMembers(), 0);
    }

    return `<div class="space-y-4">
      ${this._header(cache)}
      ${cache.loading && !cache.members.length ? this._loadingState() : ''}
      ${cache.error ? this._errorState(cache.error) : ''}
      ${cache.members.length ? this._membersList(cache.members) : ''}
      ${cache.pendingInvites.length ? this._pendingInvites(cache.pendingInvites) : ''}
      ${App.state.memberEditModal ? this._editModal(App.state.memberEditModal) : ''}
      ${App.state.inviteModal ? this._inviteModal(App.state.inviteModal) : ''}
    </div>`;
  },

  _inviteModal(modal) {
    const result = modal.result;
    return `<div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm grid place-items-center p-4"
        onclick="Actions.closeInviteMemberModal()">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
           onclick="event.stopPropagation()" style="border-left:4px solid #7c3aed;">
        <div class="flex items-start gap-3 p-5 border-b border-stone-200">
          <span class="shrink-0 w-10 h-10 rounded-xl bg-violet-100 border border-violet-200 grid place-items-center text-violet-700">
            <i data-lucide="user-plus" class="w-5 h-5"></i>
          </span>
          <div class="min-w-0 flex-1">
            <h2 class="text-[15px] font-black text-slate-900">Convidar membro</h2>
            <p class="text-[11px] text-stone-500">Convite válido por 7 dias.</p>
          </div>
          <button onclick="Actions.closeInviteMemberModal()" class="w-8 h-8 rounded-lg hover:bg-stone-100 grid place-items-center text-stone-600">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        ${result ? this._inviteResult(result) : this._inviteForm(modal)}
      </div>
    </div>`;
  },

  _inviteForm(modal) {
    return `<div class="p-5 space-y-3">
      <div>
        <label class="block text-[10px] font-black text-stone-700 uppercase tracking-widest mb-1.5">Email do convidado</label>
        <input type="email" id="inviteEmailInput" value="${Utils.escape(modal.email || '')}"
          oninput="Actions.updateInviteDraft('email', this.value)"
          placeholder="ex: joao@empresa.com.br"
          class="w-full px-3 py-2 rounded-lg bg-white border border-stone-300 text-slate-900 text-[13px] font-medium" autocomplete="off">
      </div>
      <div>
        <label class="block text-[10px] font-black text-stone-700 uppercase tracking-widest mb-1.5">Role inicial</label>
        <select onchange="Actions.updateInviteDraft('role', this.value)"
          class="w-full px-3 py-2 rounded-lg bg-white border border-stone-300 text-slate-900 text-[13px] font-bold">
          <option value="user" ${modal.role === 'user' ? 'selected' : ''}>Usuário (acesso básico)</option>
          <option value="manager" ${modal.role === 'manager' ? 'selected' : ''}>Gerente (tudo menos integrações e Score Engine)</option>
          <option value="owner" ${modal.role === 'owner' ? 'selected' : ''}>Admin Master (tudo)</option>
        </select>
        <p class="text-[10px] text-stone-500 mt-1.5">Você pode ajustar permissões custom depois pelo card do membro.</p>
      </div>
    </div>
    <div class="px-5 py-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
      <button onclick="Actions.closeInviteMemberModal()" class="px-3 py-2 rounded-lg bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-[12px] font-bold">Cancelar</button>
      <button onclick="Actions.sendInvite()" ${modal.saving ? 'disabled' : ''}
        class="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-black inline-flex items-center gap-1.5" style="color:#fff!important;">
        <i data-lucide="${modal.saving ? 'loader-2' : 'send'}" class="w-3.5 h-3.5 ${modal.saving ? 'animate-spin' : ''}"></i>
        ${modal.saving ? 'Enviando...' : 'Enviar convite'}
      </button>
    </div>`;
  },

  _inviteResult(result) {
    const isEmailReal = result.emailSent && !result.emailSimulated;
    const smtpOn = result.smtpConfigured;
    const resendError = result.emailError;
    // V37.4.25 — 3 estados distintos: sucesso, SMTP off, SMTP on mas Resend falhou.
    const banner = isEmailReal ? `
      <div class="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 flex items-center gap-2">
        <i data-lucide="mail-check" class="w-4 h-4 text-emerald-600 shrink-0"></i>
        <p class="text-[12px] text-emerald-800"><span class="font-black">Convite enviado por email.</span></p>
      </div>`
    : (smtpOn && resendError) ? `
      <div class="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2.5 flex items-start gap-2">
        <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-600 shrink-0 mt-0.5"></i>
        <div class="min-w-0">
          <p class="text-[12px] text-rose-800 font-black">SMTP configurado mas Resend recusou o envio.</p>
          <p class="text-[11px] text-rose-700 mt-0.5 break-words"><span class="font-bold">Motivo:</span> ${Utils.escape(resendError)}${result.emailErrorStatus ? ` <span class="opacity-70">(HTTP ${result.emailErrorStatus})</span>` : ''}</p>
          <p class="text-[11px] text-rose-700 mt-1.5">Dica comum: usando <code class="font-mono">onboarding@resend.dev</code> (sandbox)? Resend só entrega pro email dono da conta. Verifique um domínio próprio em resend.com pra enviar pra qualquer endereço.</p>
        </div>
      </div>`
    : `
      <div class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 flex items-start gap-2">
        <i data-lucide="alert-circle" class="w-4 h-4 text-amber-600 shrink-0 mt-0.5"></i>
        <div>
          <p class="text-[12px] text-amber-800 font-black">SMTP não configurado.</p>
          <p class="text-[11px] text-amber-700 mt-0.5">Copie o link abaixo e envie pelo seu canal preferido (WhatsApp, Slack, etc).</p>
        </div>
      </div>`;
    return `<div class="p-5 space-y-3">
      ${banner}
      <div>
        <label class="block text-[10px] font-black text-stone-700 uppercase tracking-widest mb-1.5">Link de aceite</label>
        <div class="rounded-lg bg-stone-50 border border-stone-200 px-3 py-2.5">
          <p class="text-[11px] text-stone-700 font-mono break-all leading-snug">${Utils.escape(result.acceptUrl)}</p>
        </div>
        <p class="text-[10px] text-stone-500 mt-1.5">Expira em ${new Date(result.expiresAt).toLocaleDateString('pt-BR')}.</p>
      </div>
    </div>
    <div class="px-5 py-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
      <button onclick="Actions.closeInviteMemberModal()" class="px-3 py-2 rounded-lg bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-[12px] font-bold">Fechar</button>
      <button onclick="Actions.copyAcceptUrlFromModal()"
        class="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-black inline-flex items-center gap-1.5" style="color:#fff!important;">
        <i data-lucide="copy" class="w-3.5 h-3.5"></i>
        Copiar link
      </button>
    </div>`;
  },

  _header(cache) {
    const ageMin = cache.loadedAt ? Math.round((Date.now() - cache.loadedAt) / 60000) : null;
    const ageLabel = ageMin == null ? 'Não carregado' :
                     ageMin < 1 ? 'agora mesmo' :
                     ageMin === 1 ? 'há 1 min' : `há ${ageMin} min`;
    return `<div class="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h3 class="text-[13px] font-black text-slate-900">Membros do tenant</h3>
        <p class="text-[11px] text-stone-500">${cache.members.length} ativos · atualizado ${ageLabel}</p>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="Actions.refreshTenantMembers()" ${cache.loading ? 'disabled' : ''}
          class="px-3 py-1.5 rounded-lg bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 text-[11px] font-bold inline-flex items-center gap-1.5">
          <i data-lucide="${cache.loading ? 'loader-2' : 'refresh-cw'}" class="w-3 h-3 ${cache.loading ? 'animate-spin' : ''}"></i>
          ${cache.loading ? 'Atualizando...' : 'Atualizar'}
        </button>
        <button onclick="Actions.openInviteMemberModal()"
          class="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold inline-flex items-center gap-1.5" style="color:#fff!important;">
          <i data-lucide="user-plus" class="w-3 h-3"></i>
          Convidar membro
        </button>
      </div>
    </div>`;
  },

  _loadingState() {
    return `<div class="rounded-2xl bg-white border border-stone-200 p-8 text-center">
      <i data-lucide="loader-2" class="w-8 h-8 text-violet-500 mx-auto mb-2 animate-spin"></i>
      <p class="text-[12px] text-stone-600">Carregando membros do tenant...</p>
    </div>`;
  },

  _errorState(err) {
    return `<div class="rounded-2xl bg-rose-50 border border-rose-200 p-5">
      <p class="text-[11px] font-black text-rose-700 uppercase tracking-widest mb-1">Erro ao carregar</p>
      <p class="text-[12px] text-rose-800">${Utils.escape(err)}</p>
      <button onclick="Actions.refreshTenantMembers()" class="mt-3 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold" style="color:#fff!important;">
        Tentar novamente
      </button>
    </div>`;
  },

  _membersList(members) {
    return `<div class="rounded-2xl bg-white border border-stone-200 overflow-hidden" style="border-left:4px solid #7c3aed;">
      <div class="divide-y divide-stone-100">
        ${members.map(m => this._memberRow(m)).join('')}
      </div>
    </div>`;
  },

  _memberRow(m) {
    const initials = (m.username || m.email || '??').slice(0, 2).toUpperCase();
    const roleLabel = m.isOwner ? 'Admin Master' :
                      m.role === 'manager' ? 'Gerente' :
                      m.role === 'user' ? 'Usuário' : m.role;
    const roleColor = m.isOwner ? 'violet' : m.role === 'manager' ? 'sky' : 'stone';
    const overrideCount = Object.keys(m.permissionsOverrides || {}).length;
    return `<div class="px-4 py-3 flex items-center gap-3 hover:bg-stone-50/50 transition">
      <span class="shrink-0 w-9 h-9 rounded-xl bg-stone-700 grid place-items-center text-white text-[10px] font-black" style="color:#fff!important;">${initials}</span>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <p class="text-[13px] font-black text-slate-900 truncate">${Utils.escape(m.displayName || m.username || m.email)}</p>
          ${m.isOwner ? '<span class="text-[9px] font-black bg-violet-100 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded uppercase tracking-wider">Owner</span>' : ''}
        </div>
        <p class="text-[10px] text-stone-500 truncate">${Utils.escape(m.email)}</p>
      </div>
      <div class="flex items-center gap-2 shrink-0">
        <span class="text-[10px] font-bold text-${roleColor}-700 bg-${roleColor}-50 border border-${roleColor}-200 px-2 py-0.5 rounded">${roleLabel}</span>
        ${overrideCount > 0 ? `<span class="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded" title="Permissões customizadas pelo Admin">${overrideCount} custom</span>` : ''}
        <button onclick="Actions.openMemberEditModal(${m.userId})"
          class="text-[11px] text-violet-600 hover:text-violet-800 font-bold">Editar</button>
        ${!m.isOwner ? `<button onclick="Actions.removeTenantMember(${m.userId}, '${Utils.escape(m.email).replace(/'/g, '\\\'')}')"
          class="text-[11px] text-rose-600 hover:text-rose-800 font-bold">Remover</button>` : ''}
      </div>
    </div>`;
  },

  _pendingInvites(invites) {
    return `<div class="rounded-2xl bg-amber-50/40 border border-amber-200 overflow-hidden" style="border-left:4px solid #f59e0b;">
      <div class="px-4 py-2.5 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
        <i data-lucide="mail" class="w-3.5 h-3.5 text-amber-700"></i>
        <p class="text-[11px] font-black text-amber-900 uppercase tracking-wider">Convites pendentes · ${invites.length}</p>
      </div>
      <div class="divide-y divide-amber-100">
        ${invites.map(i => `<div class="px-4 py-2.5 flex items-center gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-[12px] font-bold text-slate-900 truncate">${Utils.escape(i.email)}</p>
            <p class="text-[10px] text-amber-800">Role: ${i.role} · ${i.expired ? 'expirado' : 'pendente'}</p>
          </div>
          <div class="flex items-center gap-3 shrink-0">
            <button onclick="Actions.copyInviteLink(${i.id})" class="text-[11px] text-violet-600 hover:text-violet-800 font-bold">Copiar link</button>
            <button onclick="Actions.cancelInvite(${i.id})" class="text-[11px] text-rose-600 hover:text-rose-800 font-bold inline-flex items-center gap-1">
              <i data-lucide="trash-2" class="w-3 h-3"></i>Cancelar
            </button>
          </div>
        </div>`).join('')}
      </div>
    </div>`;
  },

  _editModal(modal) {
    const m = (App.state.membersCache?.members || []).find(x => x.userId === modal.userId);
    if (!m) return '';
    const overrides = modal.draft?.overrides || {};
    const overrideCount = Object.keys(overrides).length;
    const actionResult = modal.actionResult;

    return `<div class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm grid place-items-center p-4"
        onclick="Actions.closeMemberEditModal()">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
           onclick="event.stopPropagation()" style="border-left:4px solid #7c3aed;">
        <div class="flex items-start gap-4 p-5 border-b border-stone-200">
          <span class="shrink-0 w-10 h-10 rounded-xl bg-stone-700 grid place-items-center text-white text-[10px] font-black" style="color:#fff!important;">${(m.username||m.email).slice(0,2).toUpperCase()}</span>
          <div class="min-w-0 flex-1">
            <h2 class="text-[15px] font-black text-slate-900">${Utils.escape(m.displayName || m.username || m.email)}</h2>
            <p class="text-[11px] text-stone-500">${Utils.escape(m.email)}</p>
          </div>
          <button onclick="Actions.closeMemberEditModal()" class="w-8 h-8 rounded-lg hover:bg-stone-100 grid place-items-center text-stone-600">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
        <div class="p-5 overflow-y-auto flex-1 space-y-4">
          <!-- ROLE & PERMISSÕES -->
          <div>
            <p class="text-[10px] font-black text-stone-700 uppercase tracking-widest mb-2">Role & permissões</p>
            <div class="rounded-xl bg-stone-50 border border-stone-200 p-3 space-y-3">
              <div>
                <label class="block text-[10px] font-black text-stone-600 uppercase tracking-widest mb-1.5">Role base</label>
                <select onchange="Actions.updateMemberEditDraft('role', this.value)"
                  class="w-full px-3 py-2 rounded-lg bg-white border border-stone-300 text-slate-900 text-[12px] font-bold" ${m.isOwner ? 'disabled' : ''}>
                  <option value="owner" ${modal.draft?.role === 'owner' ? 'selected' : ''}>Admin Master (owner)</option>
                  <option value="manager" ${modal.draft?.role === 'manager' ? 'selected' : ''}>Gerente</option>
                  <option value="user" ${modal.draft?.role === 'user' ? 'selected' : ''}>Usuário</option>
                </select>
                ${m.isOwner ? '<p class="text-[10px] text-stone-500 mt-1.5">O Admin Master do tenant não pode ser rebaixado por aqui.</p>' : ''}
              </div>
              <button onclick="Actions.openMemberPermissionsModal()"
                class="w-full px-3 py-2.5 rounded-lg bg-white border border-stone-300 hover:bg-stone-100 text-slate-700 text-[12px] font-bold inline-flex items-center justify-between gap-2">
                <span class="inline-flex items-center gap-2">
                  <i data-lucide="sliders-horizontal" class="w-3.5 h-3.5"></i>
                  Customizar permissões granulares
                </span>
                ${overrideCount > 0 ? `<span class="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">${overrideCount} custom</span>` : '<span class="text-[10px] text-stone-400">segue template</span>'}
              </button>
            </div>
          </div>

          <!-- AÇÕES DE CONTA -->
          <div>
            <p class="text-[10px] font-black text-stone-700 uppercase tracking-widest mb-2">Ações de conta</p>
            <div class="rounded-xl bg-stone-50 border border-stone-200 p-3 space-y-2">
              <button onclick="Actions.triggerMemberPasswordReset(${m.userId})" ${modal.sendingReset ? 'disabled' : ''}
                class="w-full px-3 py-2.5 rounded-lg bg-white border border-stone-300 hover:bg-stone-100 text-slate-700 text-[12px] font-bold inline-flex items-center gap-2">
                <i data-lucide="${modal.sendingReset ? 'loader-2' : 'key-round'}" class="w-3.5 h-3.5 ${modal.sendingReset ? 'animate-spin' : ''}"></i>
                ${modal.sendingReset ? 'Marcando...' : 'Resetar senha'}
              </button>
              <button onclick="Actions.sendMemberEmailChange(${m.userId})" ${modal.sendingEmailChange ? 'disabled' : ''}
                class="w-full px-3 py-2.5 rounded-lg bg-white border border-stone-300 hover:bg-stone-100 text-slate-700 text-[12px] font-bold inline-flex items-center gap-2">
                <i data-lucide="${modal.sendingEmailChange ? 'loader-2' : 'mail'}" class="w-3.5 h-3.5 ${modal.sendingEmailChange ? 'animate-spin' : ''}"></i>
                ${modal.sendingEmailChange ? 'Enviando...' : 'Solicitar troca de email'}
              </button>
              <p class="text-[10px] text-stone-500 leading-snug">
                <strong>Resetar senha:</strong> marca o membro pra definir nova senha no próximo login (sem email; válido por 24h).<br />
                <strong>Trocar email:</strong> envia link mágico (requer SMTP configurado).
              </p>
            </div>
          </div>

          ${actionResult ? this._memberActionResult(actionResult) : ''}

          <!-- ZONA DE PERIGO -->
          ${!m.isOwner ? `<div>
            <p class="text-[10px] font-black text-rose-700 uppercase tracking-widest mb-2">Zona de perigo</p>
            <div class="rounded-xl bg-rose-50/60 border border-rose-200 p-3">
              <button onclick="Actions.removeTenantMember(${m.userId}, '${Utils.escape(m.email).replace(/'/g, '\\\'')}')"
                class="w-full px-3 py-2.5 rounded-lg bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 text-[12px] font-bold inline-flex items-center gap-2">
                <i data-lucide="user-minus" class="w-3.5 h-3.5"></i>Remover do tenant
              </button>
              <p class="text-[10px] text-rose-700/80 mt-1.5">Tira o acesso a este workspace. A conta do usuário continua existindo.</p>
            </div>
          </div>` : ''}
        </div>
        <div class="px-5 py-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
          <button onclick="Actions.closeMemberEditModal()" class="px-3 py-2 rounded-lg bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-[12px] font-bold">Cancelar</button>
          <button onclick="Actions.saveMemberEdit()" ${modal.saving ? 'disabled' : ''}
            class="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-black inline-flex items-center gap-1.5" style="color:#fff!important;">
            <i data-lucide="${modal.saving ? 'loader-2' : 'check'}" class="w-3.5 h-3.5 ${modal.saving ? 'animate-spin' : ''}"></i>
            ${modal.saving ? 'Salvando...' : 'Salvar role & permissões'}
          </button>
        </div>
      </div>
      ${App.state.memberPermissionsModal ? this._permissionsSubmodal(modal) : ''}
    </div>`;
  },

  // V37.4.28 — Resultado de "Enviar reset / Solicitar troca" exibido dentro do modal pai.
  _memberActionResult(result) {
    const isEmailReal = result.emailSent && !result.emailSimulated;
    const smtpOn = result.smtpConfigured;
    const resendError = result.emailError;
    const banner = isEmailReal ? `
      <div class="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2.5 flex items-center gap-2">
        <i data-lucide="mail-check" class="w-4 h-4 text-emerald-600 shrink-0"></i>
        <p class="text-[12px] text-emerald-800"><span class="font-black">${Utils.escape(result.message || 'Email enviado.')}</span></p>
      </div>`
    : (smtpOn && resendError) ? `
      <div class="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2.5 flex items-start gap-2">
        <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-600 shrink-0 mt-0.5"></i>
        <div class="min-w-0">
          <p class="text-[12px] text-rose-800 font-black">SMTP configurado mas Resend recusou.</p>
          <p class="text-[11px] text-rose-700 mt-0.5 break-words"><span class="font-bold">Motivo:</span> ${Utils.escape(resendError)}${result.emailErrorStatus ? ` (HTTP ${result.emailErrorStatus})` : ''}</p>
        </div>
      </div>`
    : `
      <div class="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 flex items-start gap-2">
        <i data-lucide="alert-circle" class="w-4 h-4 text-amber-600 shrink-0 mt-0.5"></i>
        <p class="text-[12px] text-amber-800 font-black">SMTP não configurado.</p>
      </div>`;
    return `<div class="space-y-2">
      ${banner}
      <div>
        <label class="block text-[10px] font-black text-stone-700 uppercase tracking-widest mb-1">Link de fallback</label>
        <div class="rounded-lg bg-stone-50 border border-stone-200 px-3 py-2">
          <p class="text-[10px] text-stone-700 font-mono break-all leading-snug">${Utils.escape(result.actionUrl)}</p>
        </div>
        <button onclick="Actions.copyMemberActionUrl()" class="mt-1.5 text-[11px] text-violet-600 hover:text-violet-800 font-bold inline-flex items-center gap-1">
          <i data-lucide="copy" class="w-3 h-3"></i>Copiar link
        </button>
      </div>
    </div>`;
  },

  // V37.4.28 — Sub-modal sobreposto pra ajustar permissões granulares.
  _permissionsSubmodal(parentModal) {
    const PE = window.PermissionEngineClient || null;
    const PERMISSION_KEYS = PE?.PERMISSION_KEYS || [];
    const effective = parentModal.draft?.effective || {};
    const overrides = parentModal.draft?.overrides || {};
    const groups = {};
    PERMISSION_KEYS.forEach(k => {
      const group = k.startsWith('view.') ? 'Visualização'
                  : k.startsWith('edit.') ? 'Edição'
                  : k.startsWith('ops.') ? 'Operações'
                  : k.startsWith('admin.') ? 'Administração' : 'Outros';
      groups[group] = groups[group] || [];
      groups[group].push(k);
    });

    return `<div class="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-sm grid place-items-center p-4"
        onclick="Actions.closeMemberPermissionsModal()">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
           onclick="event.stopPropagation()" style="border-left:4px solid #7c3aed;">
        <div class="flex items-start gap-3 p-5 border-b border-stone-200">
          <span class="shrink-0 w-10 h-10 rounded-xl bg-violet-100 border border-violet-200 grid place-items-center text-violet-700">
            <i data-lucide="sliders-horizontal" class="w-5 h-5"></i>
          </span>
          <div class="min-w-0 flex-1">
            <h2 class="text-[15px] font-black text-slate-900">Permissões customizadas</h2>
            <p class="text-[11px] text-stone-500">Marque pra habilitar, desmarque pra desabilitar. Linha amarela = sobrescreve o template do role.</p>
          </div>
          <button onclick="Actions.closeMemberPermissionsModal()" class="w-8 h-8 rounded-lg hover:bg-stone-100 grid place-items-center text-stone-600">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
        <div class="p-5 overflow-y-auto flex-1 space-y-4">
          ${Object.entries(groups).map(([groupName, keys]) => `
            <div>
              <p class="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1.5">${groupName}</p>
              <div class="space-y-0.5">
                ${keys.map(k => {
                  const isOverride = Object.prototype.hasOwnProperty.call(overrides, k);
                  const isEnabled = isOverride ? overrides[k] : effective[k];
                  const label = PE?.permissionLabel ? PE.permissionLabel(k) : k;
                  return `<label class="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-stone-50 ${isOverride ? 'bg-amber-50' : ''}">
                    <input type="checkbox" ${isEnabled ? 'checked' : ''}
                      onchange="Actions.toggleMemberPermissionOverride('${k}', this.checked)"
                      class="w-3.5 h-3.5 accent-violet-600">
                    <span class="text-[11px] ${isEnabled ? 'text-slate-900 font-bold' : 'text-stone-500'}">${Utils.escape(label)}</span>
                    ${isOverride ? `<button onclick="Actions.clearMemberPermissionOverride('${k}')" class="ml-auto text-[9px] text-amber-700 hover:text-amber-900 font-bold">resetar</button>` : ''}
                  </label>`;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>
        <div class="px-5 py-4 border-t border-stone-200 bg-stone-50 flex justify-end">
          <button onclick="Actions.closeMemberPermissionsModal()" class="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-black" style="color:#fff!important;">Fechar</button>
        </div>
      </div>
    </div>`;
  }
};

// Stub do PermissionEngineClient (preenchido no boot via /api/my-permissions ou similar).
// Aqui só exposição mínima dos PERMISSION_KEYS e labels pra UI funcionar offline.
window.PermissionEngineClient = {
  PERMISSION_KEYS: [
    'view.dashboard','view.mapa','view.dre','view.revops','view.financeiro',
    'view.score','view.leads','view.checkout','view.tarefas',
    'edit.mapa','edit.campanha','edit.acao','edit.produto','edit.score','edit.kpi','edit.kr',
    'ops.integracoes','ops.lead_import','ops.lead_export','ops.rd_sync','ops.tasks',
    'admin.convidar_membro','admin.editar_role','admin.remover_membro','admin.editar_billing','admin.editar_db_tenant',
    'djow'
  ],
  permissionLabel(key) {
    const L = {
      'view.dashboard': 'Ver Dashboard',
      'view.mapa': 'Ver Mapa da Receita',
      'view.dre': 'Ver DRE',
      'view.revops': 'Ver RevOps',
      'view.financeiro': 'Ver Financeiro',
      'view.score': 'Ver Score Engine',
      'view.leads': 'Ver Leads / Buscador',
      'view.checkout': 'Ver Checkout',
      'view.tarefas': 'Ver Tarefas',
      'edit.mapa': 'Editar Mapa da Receita',
      'edit.campanha': 'Criar / editar Campanhas',
      'edit.acao': 'Criar / editar Ações',
      'edit.produto': 'Criar / editar Produtos',
      'edit.score': 'Configurar Score Engine',
      'edit.kpi': 'Editar KPIs',
      'edit.kr': 'Editar KRs',
      'ops.integracoes': 'Configurar Integrações (ClickUp/RD/GA4/Hotmart)',
      'ops.lead_import': 'Importar Leads',
      'ops.lead_export': 'Exportar Leads',
      'ops.rd_sync': 'Rodar sync RD',
      'ops.tasks': 'Operar tarefas',
      'admin.convidar_membro': 'Convidar membros',
      'admin.editar_role': 'Editar role de membros',
      'admin.remover_membro': 'Remover membros',
      'admin.editar_billing': 'Editar billing',
      'admin.editar_db_tenant': 'Plugar/trocar tenant DB',
      'djow': 'Usar o Djow'
    };
    return L[key] || key;
  }
};
