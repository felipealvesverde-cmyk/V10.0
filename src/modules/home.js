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

    return `<section class="lj-pulso" onmouseenter="HomeModule._hoverPause=true" onmouseleave="HomeModule._hoverPause=false">
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
          ${i < stages.length - 1 ? `<div class="lj-pulso-flow"><span class="lj-pulso-particle"></span><span class="lj-pulso-particle" style="animation-delay:.7s"></span><span class="lj-pulso-particle" style="animation-delay:1.4s"></span></div>` : ''}
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
    return `<aside class="lj-home-side">
      <div class="lj-home-side-card lj-home-djow">
        <div class="lj-home-side-header">
          <div class="lj-home-djow-mark"><i data-lucide="sparkles" class="w-4 h-4"></i></div>
          <div>
            <div class="lj-home-side-title">Djow <span class="lj-home-side-pill">AI</span></div>
            <div class="lj-home-side-sub">Seu assistente de receita</div>
          </div>
        </div>
        <div class="lj-home-djow-body">
          <div class="lj-home-djow-placeholder">
            <i data-lucide="message-square" class="w-4 h-4"></i>
            <span>Em breve: pergunte qualquer coisa sobre sua operação</span>
          </div>
          <input class="lj-home-djow-input" placeholder="Pergunte ao Djow…" disabled title="Em breve" />
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
