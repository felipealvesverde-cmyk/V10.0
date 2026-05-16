// V26.0.0 — Djow AI Modal flutuante (atalho global Ctrl+K).
// Sobrepõe TUDO. Pode ser invocado de qualquer aba/contexto. Render é
// controlado por App.state.djowOpen via main.js render loop.
//
// UX:
//   - Ctrl+K abre (registrado em main.js init)
//   - ESC fecha
//   - Click fora fecha
//   - Mensagens scroll automático
//   - Input com placeholder "Ctrl+K para chamar o Djow a qualquer momento"
//     (some em foco; padrão UX que o user pediu)
//
// NÃO confundir com window.DjowModal (V16.3) que era o agente Railway de tarefas.
// Esse aqui é o assistente AI (Claude) plugado em /api/djow-chat.
window.DjowAIModal = {
  render() {
    const conv = App.state.djowConversation || { messages: [] };
    const messages = conv.messages || [];
    const sending = Boolean(App.state.djowSending);
    const status = App.state.djowStatus || {};
    const isConfigured = status.configured;
    const canUse = status.canUse !== false;

    const robotSvg = `<svg viewBox="0 0 64 64" class="w-8 h-8" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="djow-ai-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#A78BFA"/><stop offset="100%" stop-color="#5B21B6"/></linearGradient></defs>
      <circle cx="32" cy="8" r="3" fill="#C4B5FD"/><line x1="32" y1="11" x2="32" y2="16" stroke="#A78BFA" stroke-width="2"/>
      <rect x="14" y="16" width="36" height="32" rx="11" fill="url(#djow-ai-grad)" stroke="#7C3AED" stroke-width="1.5"/>
      <circle cx="24" cy="30" r="3.5" fill="#fff"/><circle cx="40" cy="30" r="3.5" fill="#fff"/>
      <circle cx="24" cy="30" r="1.5" fill="#5B21B6"/><circle cx="40" cy="30" r="1.5" fill="#5B21B6"/>
      <path d="M26 40 Q32 43 38 40" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>`;

    const suggestion = (text, emoji) => `<button onclick="document.getElementById('djowInput').value='${Utils.escape(text)}'; Actions.updateDjowInput('${Utils.escape(text)}'); document.getElementById('djowInput').focus();" class="lj-djow-suggest">${emoji} ${Utils.escape(text)}</button>`;

    return `<div class="lj-djow-modal-backdrop" onclick="if(event.target===this) Actions.closeDjowModal()">
      <div class="lj-djow-modal" onclick="event.stopPropagation()">
        <div class="lj-djow-modal-header">
          <div class="lj-djow-modal-title">
            ${robotSvg}
            <div>
              <div class="lj-djow-modal-name">Djow <span class="lj-home-side-pill">AI</span></div>
              <div class="lj-djow-modal-sub">${isConfigured ? (canUse ? 'Pergunte qualquer coisa sobre sua operação' : 'Sem permissão de uso') : 'Configure ANTHROPIC_API_KEY no Railway'}</div>
            </div>
          </div>
          <div class="lj-djow-modal-actions">
            ${messages.length > 0 ? `<button onclick="Actions.clearDjowConversation()" class="lj-djow-modal-btn" title="Limpar conversa"><i data-lucide="trash-2" class="w-4 h-4"></i></button>` : ''}
            <button onclick="Actions.closeDjowModal()" class="lj-djow-modal-btn" title="Fechar (ESC)"><i data-lucide="x" class="w-4 h-4"></i></button>
          </div>
        </div>

        <div class="lj-djow-modal-messages" id="djowMessages">
          ${messages.length === 0 ? `
            <div class="lj-djow-modal-empty">
              <i data-lucide="sparkles" class="w-8 h-8 text-violet-400"></i>
              <p class="lj-djow-empty-title">Como posso te ajudar?</p>
              <p class="lj-djow-empty-sub">Pergunte sobre receita, campanhas, leads, conversões, ou estratégia de RevOps/CX.</p>
              <div class="lj-djow-suggestions">
                ${suggestion('Resuma a saúde da minha operação hoje', '💡')}
                ${suggestion('Quais campanhas estão com pior conversão?', '📉')}
                ${suggestion('Onde está o gargalo do meu funil?', '🔍')}
                ${suggestion('Quais leads estão mais quentes agora?', '🔥')}
              </div>
            </div>
          ` : messages.map(m => `
            <div class="lj-djow-msg lj-djow-msg-${m.role} ${m.isError ? 'lj-djow-msg-error' : ''}">
              <div class="lj-djow-msg-role">${m.role === 'user' ? 'Você' : 'Djow'}</div>
              <div class="lj-djow-msg-content">${this._formatMessage(m.content)}</div>
              ${m.usage ? `<div class="lj-djow-msg-meta">$${Number(m.usage.costUsd || 0).toFixed(4)} · ${m.usage.tokensIn}→${m.usage.tokensOut} tokens</div>` : ''}
            </div>
          `).join('')}
          ${sending ? `
            <div class="lj-djow-msg lj-djow-msg-assistant lj-djow-typing">
              <div class="lj-djow-msg-role">Djow</div>
              <div class="lj-djow-msg-content">
                <span class="lj-djow-typing-dot"></span>
                <span class="lj-djow-typing-dot"></span>
                <span class="lj-djow-typing-dot"></span>
              </div>
            </div>
          ` : ''}
        </div>

        <div class="lj-djow-modal-footer">
          <textarea
            id="djowInput"
            class="lj-djow-modal-input"
            placeholder="Ctrl+K para chamar o Djow a qualquer momento"
            oninput="Actions.updateDjowInput(this.value)"
            onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault(); Actions.sendDjowMessage();} else if(event.key==='Escape'){Actions.closeDjowModal();}"
            onfocus="this.placeholder=''"
            onblur="if(!this.value) this.placeholder='Ctrl+K para chamar o Djow a qualquer momento'"
            ${!isConfigured || !canUse || sending ? 'disabled' : ''}
            rows="2"
          >${Utils.escape(App.state.djowInput || '')}</textarea>
          <button
            onclick="Actions.sendDjowMessage()"
            class="lj-djow-modal-send"
            ${!isConfigured || !canUse || sending ? 'disabled' : ''}
          >
            ${sending ? '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>' : '<i data-lucide="send" class="w-4 h-4"></i>'}
          </button>
        </div>

        <div class="lj-djow-modal-hint">
          <span>Enter envia · Shift+Enter nova linha · ESC fecha</span>
          ${status.stats?.totalCostUsd != null ? `<span>Total gasto: $${Number(status.stats.totalCostUsd).toFixed(4)}</span>` : ''}
        </div>
      </div>
    </div>`;
  },

  _formatMessage(text) {
    if (!text) return '';
    let html = Utils.escape(String(text));
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/^[-•]\s+(.+)$/gm, '• $1');
    html = html.replace(/\n/g, '<br>');
    return html;
  }
};
