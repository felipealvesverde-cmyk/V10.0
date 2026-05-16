// V25.0.0 — Página Início (Home).
// Layout do mockup aprovado:
//   - Greeting (Bom dia/tarde/noite) + data atual
//   - 4 KPI slots placeholder (zerados)
//   - Pulso da Receita: Produto → Campanhas → Ações → Execuções → Receita
//     com rotação a cada 7s entre produtos (random; pausa no hover; controles sutis)
//   - 3 cards inferiores: Campanhas / Ações / Execuções (sincronizam com produto vigente)
//   - Sidebar direita: Djow (placeholder) + Alertas (placeholder)
//
// Notas arquiteturais:
//   - O estado de "produto vigente" vive em App.state.homeProductIndex (persiste
//     entre reloads — não é volátil).
//   - A rotação é um timer separado (_rotationTimer) que só roda enquanto a aba
//     Início está ativa e não está em hover/pause.
//   - "Execuções" = tarefas do gestor de projeto configurado (ExecutionTaskStore),
//     filtradas pelas ações das campanhas do produto vigente.
window.HomeModule = {
  _rotationTimer: null,
  _paused: false,
  _hoverPause: false,

  _greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  },

  _userFirstName() {
    const u = App.currentUser || {};
    const raw = String(u.username || '').trim();
    if (!raw) return 'visitante';
    const base = raw.includes('@') ? raw.split('@')[0] : raw;
    const first = base.split(/[.\s_-]/)[0] || base;
    return first.charAt(0).toUpperCase() + first.slice(1);
  },

  _today() {
    return new Date().toLocaleDateString('pt-BR', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  },

  // V25.0.0 — Métricas do produto vigente.
  _productMetrics(product) {
    if (!product) return { campaigns: 0, actions: 0, executions: 0, revenue: 0, campaignList: [], actionList: [], executionList: [] };
    const campaigns = (App.state.campaigns || []).filter(c => Number(c.productId) === Number(product.id));
    const campaignIds = new Set(campaigns.map(c => Number(c.id)));
    const actions = (App.state.actions || []).filter(a => campaignIds.has(Number(a.campaignId)));
    const actionIds = new Set(actions.map(a => Number(a.id)));
    const allTasks = window.ExecutionTaskStore?.list?.() || [];
    const executions = allTasks.filter(t => actionIds.has(Number(t.actionId)));
    const revenue = Number(product.priceValue || 0);
    return {
      campaigns: campaigns.length,
      actions: actions.length,
      executions: executions.length,
      revenue,
      campaignList: campaigns,
      actionList: actions,
      executionList: executions
    };
  },

  _currentProduct() {
    const products = App.state.products || [];
    if (!products.length) return null;
    const idx = Math.min(Math.max(0, Number(App.state.homeProductIndex || 0)), products.length - 1);
    return products[idx] || products[0];
  },

  // V25.0.0 — Rotação de produto (7s). Random se >1 produto.
  // Inicia ao montar Home; para ao desmontar. Pausa em hover.
  startRotation() {
    this.stopRotation();
    const products = App.state.products || [];
    if (!products.length) return;
    this._rotationTimer = setInterval(() => {
      if (this._paused || this._hoverPause) return;
      // V26.0.2 — Skip rotação quando interrompe digitação:
      //   1. User saiu da aba Início → não tem por que re-renderizar.
      //   2. Modal Djow aberto → re-render destroi o textarea com cursor.
      //   3. User está digitando em algum input/textarea (não só Djow) → não roubamos foco.
      if (App.state.activeTab !== 'home') return;
      if (App.state.djowOpen) return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        // Pausa silenciosa: não muda produto, não re-renderiza.
        // Próximo tick (em 7s) tenta de novo.
        return;
      }
      const all = App.state.products || [];
      if (!all.length) return;
      let next = all.length === 1 ? 0 : Math.floor(Math.random() * all.length);
      // Evita repetir o mesmo (a não ser que só haja 1)
      if (all.length > 1 && next === Number(App.state.homeProductIndex || 0)) {
        next = (next + 1) % all.length;
      }
      App.state.homeProductIndex = next;
      App.save();
      App.render();
    }, 7000);
  },

  stopRotation() {
    if (this._rotationTimer) {
      clearInterval(this._rotationTimer);
      this._rotationTimer = null;
    }
  },

  pauseRotation() { this._paused = true; },
  resumeRotation() { this._paused = false; },

  nextProduct() {
    const all = App.state.products || [];
    if (!all.length) return;
    const cur = Number(App.state.homeProductIndex || 0);
    App.state.homeProductIndex = (cur + 1) % all.length;
    App.save();
    App.render();
  },

  prevProduct() {
    const all = App.state.products || [];
    if (!all.length) return;
    const cur = Number(App.state.homeProductIndex || 0);
    App.state.homeProductIndex = (cur - 1 + all.length) % all.length;
    App.save();
    App.render();
  },

  togglePause() {
    this._paused = !this._paused;
    App.render();
  },

  // -- Sub-renderers ----------------------------------------------------------

  _greetingBar() {
    const name = this._userFirstName();
    const greeting = this._greeting();
    return `<div class="lj-home-greeting">
      <div>
        <h1 class="lj-home-title">${greeting}, ${Utils.escape(name)} <span class="lj-home-wave">👋</span></h1>
        <p class="lj-home-subtitle">Sua operação está ativa e sua receita está em movimento.</p>
      </div>
      <div class="lj-home-meta">
        <button class="lj-home-icon-btn" title="Buscar"><i data-lucide="search" class="w-4 h-4"></i></button>
        <button class="lj-home-icon-btn lj-home-bell" title="Notificações">
          <i data-lucide="bell" class="w-4 h-4"></i>
          <span class="lj-home-bell-badge">3</span>
        </button>
        <div class="lj-home-date">
          <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
          <span>${Utils.escape(this._today())}</span>
        </div>
      </div>
    </div>`;
  },

  _kpiSlots() {
    // V25.0.0 — Slots zerados. Vão receber KPIs configuráveis em V25.x.
    const slots = [
      { label: 'KPI 1', icon: 'users-round', value: '0', delta: '— vs ontem', accent: 'violet' },
      { label: 'KPI 2', icon: 'target', value: '0', delta: '—', accent: 'sky' },
      { label: 'KPI 3', icon: 'filter', value: '0', delta: '— vs ontem', accent: 'emerald' },
      { label: 'KPI 4', icon: 'dollar-sign', value: 'R$ 0', delta: '— vs mês anterior', accent: 'amber' }
    ];
    return `<div class="lj-home-kpis">
      ${slots.map(s => `<div class="lj-kpi-card lj-kpi-${s.accent}">
        <div class="lj-kpi-header">
          <div class="lj-kpi-icon"><i data-lucide="${s.icon}" class="w-5 h-5"></i></div>
          <div class="lj-kpi-label">${s.label}</div>
        </div>
        <div class="lj-kpi-value">${s.value}</div>
        <div class="lj-kpi-delta">${s.delta}</div>
      </div>`).join('')}
    </div>`;
  },

  _pulsoBlock() {
    const product = this._currentProduct();
    const m = this._productMetrics(product);
    const allProducts = App.state.products || [];
    const idx = Number(App.state.homeProductIndex || 0);

    const stages = [
      { label: 'Produto', icon: 'package', value: product ? Utils.escape(product.name || '—') : '—', sub: product?.priceValue ? `R$ ${product.priceValue.toLocaleString('pt-BR')}` : 'sem preço', accent: 'violet' },
      { label: 'Campanhas', icon: 'megaphone', value: m.campaigns, sub: 'ativas', accent: 'sky' },
      { label: 'Ações', icon: 'plug', value: m.actions, sub: 'configuradas', accent: 'teal' },
      { label: 'Execuções', icon: 'check-square', value: m.executions, sub: 'tarefas no gestor', accent: 'emerald' },
      { label: 'Receita', icon: 'dollar-sign', value: m.revenue ? `R$ ${m.revenue.toLocaleString('pt-BR')}` : 'R$ 0', sub: 'prevista', accent: 'amber' }
    ];

    const navControls = allProducts.length > 1 ? `<div class="lj-pulso-controls">
      <button onclick="HomeModule.prevProduct()" title="Anterior" class="lj-pulso-ctrl"><i data-lucide="chevron-left" class="w-3.5 h-3.5"></i></button>
      <button onclick="HomeModule.togglePause()" title="${this._paused ? 'Retomar rotação' : 'Pausar rotação'}" class="lj-pulso-ctrl">
        <i data-lucide="${this._paused ? 'play' : 'pause'}" class="w-3.5 h-3.5"></i>
      </button>
      <button onclick="HomeModule.nextProduct()" title="Próximo" class="lj-pulso-ctrl"><i data-lucide="chevron-right" class="w-3.5 h-3.5"></i></button>
      <span class="lj-pulso-pos">${idx + 1}/${allProducts.length}</span>
    </div>` : '';

    // V25.0.2 — Pulso re-desenhado com ondas SVG entre estações + glow.
    // Cada par de estações é conectado por uma onda contínua animada via
    // stroke-dashoffset, e partículas circulam por cima.
    return `<section class="lj-pulso" onmouseenter="HomeModule._hoverPause=true" onmouseleave="HomeModule._hoverPause=false">
      <div class="lj-pulso-bg">
        <svg class="lj-pulso-waves" viewBox="0 0 1000 200" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="lj-pulso-wave-grad" x1="0%" y1="50%" x2="100%" y2="50%">
              <stop offset="0%" stop-color="#A855F7" stop-opacity="0"/>
              <stop offset="10%" stop-color="#A855F7" stop-opacity=".8"/>
              <stop offset="30%" stop-color="#38BDF8" stop-opacity=".8"/>
              <stop offset="55%" stop-color="#5EEAD4" stop-opacity=".8"/>
              <stop offset="75%" stop-color="#10B981" stop-opacity=".8"/>
              <stop offset="92%" stop-color="#F59E0B" stop-opacity=".8"/>
              <stop offset="100%" stop-color="#F59E0B" stop-opacity="0"/>
            </linearGradient>
            <filter id="lj-pulso-glow" x="-10%" y="-30%" width="120%" height="160%">
              <feGaussianBlur stdDeviation="6" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <g filter="url(#lj-pulso-glow)">
            <path class="lj-pulso-wave lj-pulso-wave-1" d="M0 100 Q 125 60 250 100 T 500 100 T 750 100 T 1000 100" stroke="url(#lj-pulso-wave-grad)" stroke-width="3" fill="none"/>
            <path class="lj-pulso-wave lj-pulso-wave-2" d="M0 105 Q 125 140 250 105 T 500 105 T 750 105 T 1000 105" stroke="url(#lj-pulso-wave-grad)" stroke-width="2" fill="none" opacity=".7"/>
            <path class="lj-pulso-wave lj-pulso-wave-3" d="M0 95 Q 125 50 250 95 T 500 95 T 750 95 T 1000 95" stroke="url(#lj-pulso-wave-grad)" stroke-width="1.5" fill="none" opacity=".5"/>
          </g>
        </svg>
      </div>

      <div class="lj-pulso-header">
        <div>
          <div class="lj-pulso-label">PULSO DA RECEITA</div>
          <p class="lj-pulso-tag">Visão geral da jornada dos seus leads até a receita.</p>
        </div>
        ${navControls}
      </div>

      <div class="lj-pulso-stages">
        ${stages.map((s, i) => `
          <div class="lj-pulso-stage lj-pulso-stage-${s.accent}" style="--lj-pulso-delay: ${i * 200}ms">
            <div class="lj-pulso-stage-icon"><i data-lucide="${s.icon}" class="w-5 h-5"></i></div>
            <div class="lj-pulso-stage-label">${s.label}</div>
            <div class="lj-pulso-stage-value">${s.value}</div>
            <div class="lj-pulso-stage-sub">${s.sub}</div>
          </div>
        `).join('')}
      </div>

      ${!product ? `<div class="lj-pulso-empty">Cadastre seu primeiro produto pra ver o pulso da operação.</div>` : ''}
    </section>`;
  },

  _bottomCards() {
    const product = this._currentProduct();
    const m = this._productMetrics(product);

    const campaignCard = `<div class="lj-home-card">
      <div class="lj-home-card-header">
        <div class="lj-home-card-title"><i data-lucide="megaphone" class="w-4 h-4"></i>Campanhas</div>
        <span class="lj-home-card-count">${m.campaigns}</span>
      </div>
      ${m.campaigns === 0 ? `<div class="lj-home-card-empty">Nenhuma campanha vinculada a este produto.</div>` : `<div class="lj-home-card-list">${m.campaignList.slice(0, 4).map(c => `
        <div class="lj-home-card-row">
          <div class="lj-home-card-row-main">
            <div class="lj-home-card-row-title">${Utils.escape(c.name || 'Sem nome')}</div>
            <div class="lj-home-card-row-sub">${(c.actions || []).length} ação(ões) · status: ${Utils.escape(c.status || '—')}</div>
          </div>
        </div>
      `).join('')}${m.campaigns > 4 ? `<div class="lj-home-card-more">+ ${m.campaigns - 4} outras</div>` : ''}</div>`}
    </div>`;

    const actionCard = `<div class="lj-home-card">
      <div class="lj-home-card-header">
        <div class="lj-home-card-title"><i data-lucide="plug" class="w-4 h-4"></i>Ações</div>
        <span class="lj-home-card-count">${m.actions}</span>
      </div>
      ${m.actions === 0 ? `<div class="lj-home-card-empty">Nenhuma ação configurada.</div>` : `<div class="lj-home-card-list">${m.actionList.slice(0, 4).map(a => `
        <div class="lj-home-card-row">
          <div class="lj-home-card-row-main">
            <div class="lj-home-card-row-title">${Utils.escape(a.name || 'Sem nome')}</div>
            <div class="lj-home-card-row-sub">${Utils.escape(a.channel || a.actionType || '—')} · ${Utils.escape(a.sector || '—')} ${Utils.escape(a.funnel || '')}</div>
          </div>
        </div>
      `).join('')}${m.actions > 4 ? `<div class="lj-home-card-more">+ ${m.actions - 4} outras</div>` : ''}</div>`}
    </div>`;

    const execCard = `<div class="lj-home-card">
      <div class="lj-home-card-header">
        <div class="lj-home-card-title"><i data-lucide="check-square" class="w-4 h-4"></i>Execuções</div>
        <span class="lj-home-card-count">${m.executions}</span>
      </div>
      ${m.executions === 0 ? `<div class="lj-home-card-empty">Nenhuma tarefa no gestor de projeto pra esse produto. ${window.ExecutionTaskStore ? '' : '(Plug-in não carregado)'}</div>` : `<div class="lj-home-card-list">${m.executionList.slice(0, 4).map(t => `
        <div class="lj-home-card-row">
          <div class="lj-home-card-row-main">
            <div class="lj-home-card-row-title">${Utils.escape(t.title || t.name || 'Sem título')}</div>
            <div class="lj-home-card-row-sub">${Utils.escape(t.provider || 'manual')} · ${Utils.escape(t.status || 'open')}</div>
          </div>
        </div>
      `).join('')}${m.executions > 4 ? `<div class="lj-home-card-more">+ ${m.executions - 4} outras</div>` : ''}</div>`}
    </div>`;

    return `<div class="lj-home-cards">
      ${campaignCard}${actionCard}${execCard}
    </div>`;
  },

  _sideStack() {
    // V25.0.2 — Avatar do Djow é uma carinha de robô SVG (era ícone genérico).
    const djowAvatar = `<div class="lj-home-djow-avatar">
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="djow-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#A78BFA"/>
            <stop offset="100%" stop-color="#5B21B6"/>
          </linearGradient>
        </defs>
        <!-- Antena -->
        <circle cx="32" cy="8" r="3" fill="#C4B5FD"/>
        <line x1="32" y1="11" x2="32" y2="16" stroke="#A78BFA" stroke-width="2"/>
        <!-- Cabeça -->
        <rect x="14" y="16" width="36" height="32" rx="11" fill="url(#djow-grad)" stroke="#7C3AED" stroke-width="1.5"/>
        <!-- Olhos -->
        <circle cx="24" cy="30" r="3.5" fill="#fff"/>
        <circle cx="40" cy="30" r="3.5" fill="#fff"/>
        <circle cx="24" cy="30" r="1.5" fill="#5B21B6"><animate attributeName="cy" values="30;30;30.5;30" dur="3s" repeatCount="indefinite"/></circle>
        <circle cx="40" cy="30" r="1.5" fill="#5B21B6"><animate attributeName="cy" values="30;30;30.5;30" dur="3s" repeatCount="indefinite"/></circle>
        <!-- Boca: linha sutil -->
        <path d="M26 40 Q32 43 38 40" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>
        <!-- Orelhinhas (sensores laterais) -->
        <rect x="10" y="26" width="4" height="10" rx="2" fill="#7C3AED"/>
        <rect x="50" y="26" width="4" height="10" rx="2" fill="#7C3AED"/>
        <!-- Pescoço/base -->
        <rect x="26" y="48" width="12" height="6" rx="2" fill="#5B21B6"/>
      </svg>
    </div>`;

    // V26.0.0 — Box Djow funcional (sai do placeholder). Mostra as últimas 3
    // mensagens da conversa atual + input. Botão expande pro modal Ctrl+K.
    const conv = App.state.djowConversation || { messages: [] };
    const recent = (conv.messages || []).slice(-4);
    const status = App.state.djowStatus || {};
    const isConfigured = status.configured;
    const canUse = status.canUse !== false;
    const sending = Boolean(App.state.djowSending);

    return `<aside class="lj-home-side">
      <div class="lj-home-side-card lj-home-djow">
        <div class="lj-home-side-header">
          ${djowAvatar}
          <div class="flex-1 min-w-0">
            <div class="lj-home-side-title">Djow <span class="lj-home-side-pill">AI</span></div>
            <div class="lj-home-side-sub">${isConfigured ? 'Pronto. Pergunte qualquer coisa.' : 'Aguardando configuração'}</div>
          </div>
          <button onclick="Actions.openDjowModal()" class="lj-djow-expand" title="Expandir (Ctrl+K)">
            <i data-lucide="maximize-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
        <div class="lj-home-djow-body">
          ${!isConfigured ? `
            <div class="lj-home-djow-placeholder">
              <i data-lucide="alert-circle" class="w-4 h-4"></i>
              <span>Configure em <b>Configurações → Agentes Externos → Djow</b></span>
            </div>
          ` : !canUse ? `
            <div class="lj-home-djow-placeholder">
              <i data-lucide="lock" class="w-4 h-4"></i>
              <span>Sem permissão de uso. Peça pro master habilitar.</span>
            </div>
          ` : recent.length === 0 ? `
            <div class="lj-home-djow-placeholder">
              <i data-lucide="sparkles" class="w-4 h-4"></i>
              <span>Pergunte qualquer coisa sobre sua operação</span>
            </div>
          ` : `
            <div class="lj-home-djow-recent" id="djowHomeRecent">
              ${recent.map(m => `<div class="lj-djow-msg lj-djow-msg-${m.role} ${m.isError ? 'lj-djow-msg-error' : ''}">
                <div class="lj-djow-msg-role">${m.role === 'user' ? 'Você' : 'Djow'}</div>
                <div class="lj-djow-msg-content">${Utils.escape(String(m.content || '').slice(0, 280))}${String(m.content || '').length > 280 ? '…' : ''}</div>
              </div>`).join('')}
              ${sending ? '<div class="lj-djow-msg lj-djow-msg-assistant lj-djow-typing">Djow está digitando<span class="lj-djow-dots">…</span></div>' : ''}
            </div>
          `}
          <input
            id="djowHomeInput"
            class="lj-home-djow-input"
            placeholder="Ctrl+K para chamar o Djow a qualquer momento"
            value="${Utils.escape(App.state.djowInput || '')}"
            oninput="Actions.updateDjowInput(this.value)"
            onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault(); Actions.sendDjowMessage();}"
            onfocus="this.placeholder=''"
            onblur="if(!this.value) this.placeholder='Ctrl+K para chamar o Djow a qualquer momento'"
            ${!isConfigured || !canUse || sending ? 'disabled' : ''}
          />
        </div>
      </div>

      <div class="lj-home-side-card lj-home-alerts">
        <div class="lj-home-side-header">
          <div class="lj-home-alert-mark"><i data-lucide="alert-triangle" class="w-4 h-4"></i></div>
          <div>
            <div class="lj-home-side-title">Alertas importantes</div>
            <div class="lj-home-side-sub">Pontos críticos da operação</div>
          </div>
        </div>
        <div class="lj-home-alerts-body">
          <div class="lj-home-alerts-empty">Nenhum alerta no momento.</div>
        </div>
      </div>
    </aside>`;
  },

  render() {
    // Liga rotação só quando a aba está visível
    this.startRotation();
    return `<div class="lj-home">
      ${this._greetingBar()}
      ${this._kpiSlots()}
      <div class="lj-home-main">
        <div class="lj-home-main-col">
          ${this._pulsoBlock()}
          ${this._bottomCards()}
        </div>
        ${this._sideStack()}
      </div>
    </div>`;
  }
};
