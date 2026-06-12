// V37.5.0 — Pin-Up MVP.
//
// Comportamento (decisões Felipe 2026-06-12):
//   - Atalho: Alt+P
//   - Botão: lado do Djow, metade do tamanho
//   - Todos podem cravar
//   - Soft limit: 5 pins na tela viram cluster colapsável
//   - Auto-archive: 7 dias sem visualização (server expires_at)
//   - Pin visível só pros marcados + criador
//
// Fluxo:
//   1. Alt+P ou click no botão → modo "colocar pin" (cursor crosshair)
//   2. Click em qualquer ponto → coords salvas, modal de criar abre
//   3. Modal: multiselect membros + textarea 400 chars + Cravar/Cancelar
//   4. Submit → POST /api/pin-create → notification dispara pra audience
//   5. Pin aparece no overlay com avatar mini do criador
//   6. Hover → preview tooltip
//   7. Click → modal completo com texto + ações (marcar visto, arquivar)

window.PinUp = {

  // ============================================================
  // Entry: botão + atalho
  // ============================================================
  bellButton() {
    const active = Boolean(App.state.pinModeActive);
    return `<button onclick="Actions.togglePinMode()"
        class="relative inline-flex items-center justify-center w-6 h-6 rounded-lg transition hover:scale-105 ${active ? 'bg-violet-600 ring-2 ring-violet-300' : 'bg-stone-100 border border-stone-300'}"
        style="${active ? 'color:#fff!important;' : ''}"
        title="Pin-Up (Alt+P) — cravar comentário no contexto">
      <i data-lucide="map-pin" class="w-3 h-3" style="color:${active ? '#fff' : '#7c3aed'}"></i>
    </button>`;
  },

  installShortcut() {
    if (window.__ljPinUpShortcutInstalled) return;
    document.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        if (window.Actions?.togglePinMode) Actions.togglePinMode();
      }
    });
    window.__ljPinUpShortcutInstalled = true;
  },

  // ============================================================
  // Overlay: modo "colocar pin" + render dos pins existentes
  // ============================================================
  overlay() {
    const active = Boolean(App.state.pinModeActive);
    const pins = App.state.pinUp?.pinsForCurrentUrl || [];
    return `${active ? this._captureOverlay() : ''}
            ${pins.length > 0 ? this._pinsLayer(pins) : ''}
            ${App.state.pinUp?.createModal ? this._createModal(App.state.pinUp.createModal) : ''}
            ${App.state.pinUp?.viewModal ? this._viewModal(App.state.pinUp.viewModal) : ''}`;
  },

  _captureOverlay() {
    return `<div onclick="Actions.capturePinPosition(event)" class="fixed inset-0 z-[60]" style="cursor: crosshair; background: rgba(124, 58, 237, 0.06);">
      <div class="fixed top-4 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-[11px] font-black shadow-lg" style="color:#fff!important;">
        <i data-lucide="map-pin" class="w-3 h-3 inline-block mr-1"></i>
        Click onde quer cravar o pin — ESC pra cancelar
      </div>
    </div>`;
  },

  _pinsLayer(pins) {
    return `<div class="fixed inset-0 pointer-events-none z-[55]">
      ${pins.map(p => this._pinMarker(p)).join('')}
    </div>`;
  },

  _pinMarker(p) {
    const seenClass = p.seenByMe ? 'opacity-70' : '';
    return `<button onclick="Actions.openPinView(${p.id})"
        class="absolute pointer-events-auto -translate-x-1/2 -translate-y-full transition-transform hover:scale-110 ${seenClass}"
        style="left: ${p.anchorXPct}%; top: ${p.anchorYPct}%;"
        title="Pin de ${Utils.escape(p.creatorName || 'alguém')}: ${Utils.escape((p.text || '').slice(0, 60))}${(p.text || '').length > 60 ? '...' : ''}">
      <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
        <path d="M14 0C6.27 0 0 6.27 0 14c0 9.5 14 22 14 22s14-12.5 14-22C28 6.27 21.73 0 14 0z" fill="#7c3aed"/>
        <circle cx="14" cy="14" r="6" fill="#fff"/>
        <text x="14" y="17" text-anchor="middle" font-size="8" font-weight="900" fill="#7c3aed">${Utils.escape((p.creatorName || '?').slice(0, 2).toUpperCase())}</text>
      </svg>
    </button>`;
  },

  // ============================================================
  // Modal de CRIAR pin
  // ============================================================
  _createModal(draft) {
    const members = App.state.membersCache?.members || [];
    return `<div class="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm grid place-items-center p-4"
        onclick="Actions.closePinCreate()">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col" style="border-left:4px solid #7c3aed;"
           onclick="event.stopPropagation()">
        <div class="flex items-start gap-3 p-5 border-b border-stone-200">
          <span class="shrink-0 w-10 h-10 rounded-xl bg-violet-100 border border-violet-200 grid place-items-center text-violet-700">
            <i data-lucide="map-pin" class="w-5 h-5"></i>
          </span>
          <div class="min-w-0 flex-1">
            <h2 class="text-[15px] font-black text-slate-900">Cravar pin</h2>
            <p class="text-[11px] text-stone-500">Visível só pros marcados + você. Some em 7 dias.</p>
          </div>
          <button onclick="Actions.closePinCreate()" class="w-8 h-8 rounded-lg hover:bg-stone-100 grid place-items-center text-stone-600">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
        <div class="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          <div>
            <label class="block text-[10px] font-black text-stone-700 uppercase tracking-widest mb-1.5">Marcar quem?</label>
            ${members.length === 0 ? `
              <p class="text-[11px] text-stone-500 italic">Nenhum membro carregado. Tente atualizar a página.</p>
            ` : `
              <div class="rounded-lg border border-stone-200 max-h-48 overflow-y-auto bg-white">
                ${members.map(m => {
                  const checked = (draft.audienceUserIds || []).includes(m.userId);
                  return `<label class="flex items-center gap-2 px-3 py-2 hover:bg-stone-50 cursor-pointer border-b border-stone-100 last:border-0">
                    <input type="checkbox" ${checked ? 'checked' : ''}
                      onchange="Actions.togglePinAudience(${m.userId}, this.checked)"
                      class="w-3.5 h-3.5 accent-violet-600">
                    <span class="text-[11px] ${checked ? 'font-bold text-slate-900' : 'text-stone-700'}">${Utils.escape(m.displayName || m.username || m.email)}</span>
                  </label>`;
                }).join('')}
              </div>
            `}
          </div>
          <div>
            <label class="block text-[10px] font-black text-stone-700 uppercase tracking-widest mb-1.5">Mensagem</label>
            <textarea id="pinTextInput" maxlength="400" rows="4"
              oninput="Actions.updatePinDraft('text', this.value)"
              placeholder="O que precisa registrar nesse ponto?"
              class="w-full px-3 py-2 rounded-lg bg-white border border-stone-300 text-slate-900 text-[12px] resize-none focus:outline-none focus:border-violet-400">${Utils.escape(draft.text || '')}</textarea>
            <p class="text-[10px] text-stone-500 mt-1">${(draft.text || '').length}/400</p>
          </div>
        </div>
        <div class="px-5 py-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
          <button onclick="Actions.closePinCreate()" class="px-3 py-2 rounded-lg bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 text-[12px] font-bold">Cancelar</button>
          <button onclick="Actions.submitPin()" ${draft.saving ? 'disabled' : ''}
            class="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[12px] font-black inline-flex items-center gap-1.5" style="color:#fff!important;">
            <i data-lucide="${draft.saving ? 'loader-2' : 'map-pin'}" class="w-3.5 h-3.5 ${draft.saving ? 'animate-spin' : ''}"></i>
            ${draft.saving ? 'Cravando...' : 'Cravar pin'}
          </button>
        </div>
      </div>
    </div>`;
  },

  // ============================================================
  // Modal de VER pin
  // ============================================================
  _viewModal(view) {
    const p = view.pin;
    if (!p) return '';
    const dateLabel = new Date(p.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const expiresLabel = p.expiresAt ? new Date(p.expiresAt).toLocaleDateString('pt-BR') : null;
    return `<div class="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm grid place-items-center p-4"
        onclick="Actions.closePinView()">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col" style="border-left:4px solid #7c3aed;"
           onclick="event.stopPropagation()">
        <div class="flex items-start gap-3 p-5 border-b border-stone-200">
          <span class="shrink-0 w-10 h-10 rounded-xl bg-violet-100 border border-violet-200 grid place-items-center text-violet-700">
            <i data-lucide="map-pin" class="w-5 h-5"></i>
          </span>
          <div class="min-w-0 flex-1">
            <h2 class="text-[13px] font-black text-slate-900 truncate">${Utils.escape(p.creatorName || 'Alguém')} cravou</h2>
            <p class="text-[11px] text-stone-500">${dateLabel}${expiresLabel ? ` · expira ${expiresLabel}` : ''}</p>
          </div>
          <button onclick="Actions.closePinView()" class="w-8 h-8 rounded-lg hover:bg-stone-100 grid place-items-center text-stone-600">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
        <div class="p-5">
          <p class="text-[13px] text-slate-900 leading-relaxed whitespace-pre-wrap">${Utils.escape(p.text || '')}</p>
        </div>
        <div class="px-5 py-4 border-t border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
          ${p.seenByMe ? '<span class="text-[10px] text-emerald-700 font-bold">✓ Você já marcou como visto</span>' : `<button onclick="Actions.markPinSeen(${p.id})" class="text-[11px] text-violet-600 hover:text-violet-800 font-bold">Marcar como visto</button>`}
          <div class="flex items-center gap-2">
            <button onclick="Actions.archivePin(${p.id})"
              class="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 border border-rose-300 text-rose-800 text-[11px] font-bold inline-flex items-center gap-1.5">
              <i data-lucide="archive" class="w-3 h-3"></i>
              Arquivar
            </button>
          </div>
        </div>
      </div>
    </div>`;
  }
};

// Auto-instala atalho na carga
if (window.PinUp) PinUp.installShortcut();
