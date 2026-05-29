// V35.1.1 — Painel Djow lateral da Tab Checkout.
//
// Sticky à direita. Renderiza:
//   - Avatar Djow + título
//   - Resumo IA da operação (2-3 frases)
//   - 3 perguntas fixas universais + até 2 contextuais (geradas pela IA)
//   - Histórico de mensagens da sessão
//   - Input pra pergunta livre
//
// Fresh por sessão — recarrega quando muda sub-tab ou período.

window.DjowCheckoutPanel = {
  // 3 perguntas universais hardcoded. Sempre disponíveis.
  _fixedQuestions: [
    'Qual produto mais vendeu no período?',
    'Como está o ticket médio comparado ao período anterior?',
    'Tem alguma anomalia nas vendas recentes?'
  ],

  render() {
    const d = App.state.djowCheckout || {};
    // Dispara load assíncrono — idempotente
    setTimeout(() => Actions.ensureDjowCheckout(), 0);

    return `<aside class="lj-djow-checkout-panel">
      ${this._header()}
      ${this._summary(d)}
      ${this._questionsBlock(d)}
      ${this._chatHistory(d)}
      ${this._input(d)}
    </aside>`;
  },

  _header() {
    return `<div class="lj-djow-cp-header">
      <div class="lj-djow-cp-avatar">
        <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="djow-cp-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#AB3ED8"/>
              <stop offset="100%" stop-color="#6BBEF9"/>
            </linearGradient>
          </defs>
          <rect width="64" height="64" rx="14" fill="url(#djow-cp-grad)"/>
          <circle cx="22" cy="26" r="4" fill="#fff"/>
          <circle cx="42" cy="26" r="4" fill="#fff"/>
          <rect x="20" y="40" width="24" height="3" rx="1.5" fill="#fff"/>
        </svg>
      </div>
      <div>
        <p class="lj-djow-cp-title">Djow · Checkout</p>
        <p class="lj-djow-cp-subtitle">Assistente da operação</p>
      </div>
    </div>`;
  },

  _summary(d) {
    if (d.summaryLoading) {
      return `<div class="lj-djow-cp-summary lj-djow-cp-loading">
        <span class="lj-djow-cp-shimmer"></span>
        <p>Lendo a operação…</p>
      </div>`;
    }
    if (!d.summary) {
      return `<div class="lj-djow-cp-summary lj-djow-cp-empty">
        <p>Sem dados pra analisar. Sincronize histórico ou conecte OAuth.</p>
      </div>`;
    }
    return `<div class="lj-djow-cp-summary">
      <p class="lj-djow-cp-summary-label">Resumo</p>
      <p class="lj-djow-cp-summary-text">${Utils.escape(d.summary)}</p>
    </div>`;
  },

  _questionsBlock(d) {
    const contextual = Array.isArray(d.suggestions) ? d.suggestions : [];
    const all = [...this._fixedQuestions, ...contextual].slice(0, 5);
    return `<div class="lj-djow-cp-questions">
      <p class="lj-djow-cp-questions-label">Pergunte sobre…</p>
      <div class="lj-djow-cp-questions-list">
        ${all.map(q => `<button onclick="Actions.askDjowCheckout('${Utils.escape(q).replace(/'/g, "\\'")}')" class="lj-djow-cp-question-chip" title="${Utils.escape(q)}">
          ${Utils.escape(q)}
        </button>`).join('')}
      </div>
      ${d.suggestionsLoading ? '<p class="lj-djow-cp-suggestions-loading">Procurando padrões…</p>' : ''}
    </div>`;
  },

  _chatHistory(d) {
    const msgs = Array.isArray(d.messages) ? d.messages : [];
    if (!msgs.length) return '';
    return `<div class="lj-djow-cp-history">
      ${msgs.map(m => `<div class="lj-djow-cp-msg lj-djow-cp-msg-${m.role}">
        <p class="lj-djow-cp-msg-role">${m.role === 'user' ? 'Você' : 'Djow'}</p>
        <p class="lj-djow-cp-msg-text">${Utils.escape(m.text)}</p>
      </div>`).join('')}
      ${d.asking ? '<div class="lj-djow-cp-msg lj-djow-cp-msg-assistant"><p class="lj-djow-cp-msg-text lj-djow-cp-typing">Pensando…</p></div>' : ''}
    </div>`;
  },

  _input(d) {
    return `<div class="lj-djow-cp-input-wrap">
      <input
        type="text"
        value="${Utils.escape(d.input || '')}"
        placeholder="Pergunte ao Djow…"
        oninput="Actions.updateDjowCheckoutInput(this.value)"
        onkeydown="if(event.key==='Enter'){event.preventDefault(); Actions.askDjowCheckout();}"
        class="lj-djow-cp-input"
        ${d.asking ? 'disabled' : ''}
      />
      <button onclick="Actions.askDjowCheckout()" class="lj-djow-cp-submit" ${d.asking ? 'disabled' : ''}>
        <i data-lucide="send" class="w-3.5 h-3.5"></i>
      </button>
    </div>`;
  }
};
