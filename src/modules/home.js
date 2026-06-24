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
    // V32.1.2 — Prioridade:
    //   1. user.displayName (setado em Configurações → Minha Conta) → usa cru
    //   2. fallback: primeiro segmento do DOMAIN do email (não do prefixo).
    //      Antes era prefixo do email → derivava "Felipe" pra qualquer email
    //      felipe@..., confundindo clientes não-Felipe.
    //      Agora felipe@w2c.pro.br → "W2c" (neutro até o user setar nome real).
    const u = App.currentUser || {};
    if (u.displayName && String(u.displayName).trim()) {
      return String(u.displayName).trim();
    }
    const raw = String(u.username || u.email || '').trim();
    if (!raw) return 'visitante';
    if (raw.includes('@')) {
      const domain = raw.split('@')[1] || '';
      const firstSeg = domain.split('.')[0] || domain;
      if (firstSeg) return firstSeg.charAt(0).toUpperCase() + firstSeg.slice(1);
    }
    // Sem @: usa raw direto
    return raw.charAt(0).toUpperCase() + raw.slice(1);
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
    // V35.13.4 — Fix bug pré-existente: ExecutionTaskStore expõe .all(), não
    // .list(); e o campo é `linked_action_id`, não `actionId`. Antes desse fix,
    // card EXECUÇÕES sempre mostrava 0 mesmo com tasks no store.
    const allTasks = window.ExecutionTaskStore?.all?.() || [];
    const executions = allTasks.filter(t => actionIds.has(Number(t.linked_action_id)));
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

  // V32.5.7 — Helper: produtos VISÍVEIS (filtra arquivados).
  // Produtos arquivados ficam fora do carrossel home e da rotação.
  _activeProducts() {
    return (App.state.products || []).filter(p => !p.archived);
  },

  _currentProduct() {
    const products = this._activeProducts();
    if (!products.length) return null;
    const idx = Math.min(Math.max(0, Number(App.state.homeProductIndex || 0)), products.length - 1);
    return products[idx] || products[0];
  },

  // V25.0.0 — Rotação de produto (7s). Random se >1 produto.
  // Inicia ao montar Home; para ao desmontar. Pausa em hover.
  // V32.5.7 — Usa _activeProducts() (filtra arquivados).
  startRotation() {
    this.stopRotation();
    const products = this._activeProducts();
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
      const all = this._activeProducts();
      if (!all.length) return;
      let next = all.length === 1 ? 0 : Math.floor(Math.random() * all.length);
      // Evita repetir o mesmo (a não ser que só haja 1)
      if (all.length > 1 && next === Number(App.state.homeProductIndex || 0)) {
        next = (next + 1) % all.length;
      }
      App.state.homeProductIndex = next;
      // V35.9.2 — Resetar páginas de KR quando o produto muda. Nova rodada
      // começa do bloco 1-3 de cada área.
      App.state.homeKrPages = { marketing: 0, vendas: 0, cs: 0 };
      // V36.1.2 — saveLocal em vez de save: rotação é estado visual, não
      // justifica POST /api/state-sync a cada 7s (causava cascata de 401
      // quando o servidor degradava transient e abria modal Sessão Expirada).
      App.saveLocal();
      App.render();
    }, 7000);

    // V35.9.2 — Rotação interna de páginas de KR (cada área independente).
    // Roda mais devagar que a do produto pra dar tempo de ler (10s).
    this._krRotationTimer = setInterval(() => {
      if (this._paused || this._hoverPause) return;
      if (App.state.activeTab !== 'home') return;
      if (App.state.djowOpen) return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

      const product = this._currentProduct();
      if (!product || !window.StrategicMapEngine?.getProductKrs) return;
      const krs = StrategicMapEngine.getProductKrs(product.id) || [];

      let changed = false;
      if (!App.state.homeKrPages) App.state.homeKrPages = { marketing: 0, vendas: 0, cs: 0 };
      ['marketing', 'vendas', 'cs'].forEach(area => {
        const areaKrs = krs.filter(k => String(k.area || '').toLowerCase() === area);
        const totalPages = Math.max(1, Math.ceil(areaKrs.length / 3));
        if (totalPages <= 1) return;       // só 1 página, não rotaciona
        const cur = Number(App.state.homeKrPages[area]) || 0;
        App.state.homeKrPages[area] = (cur + 1) % totalPages;
        changed = true;
      });

      // V36.1.2 — saveLocal: idem rotation do produto.
      if (changed) { App.saveLocal(); App.render(); }
    }, 10000);
  },

  stopRotation() {
    if (this._rotationTimer) {
      clearInterval(this._rotationTimer);
      this._rotationTimer = null;
    }
    if (this._krRotationTimer) {
      clearInterval(this._krRotationTimer);
      this._krRotationTimer = null;
    }
  },

  pauseRotation() { this._paused = true; },
  resumeRotation() { this._paused = false; },

  nextProduct() {
    const all = this._activeProducts();
    if (!all.length) return;
    const cur = Number(App.state.homeProductIndex || 0);
    App.state.homeProductIndex = (cur + 1) % all.length;
    App.save();
    App.render();
  },

  prevProduct() {
    const all = this._activeProducts();
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
    // V37.5.1 — Loaders de hidratação (reconciliation, RD webhook, KR snapshots,
    // GA4, governance) movidos pra TopBar.render() pra rodar em qualquer
    // página, não só na Home.
    return `<div class="lj-home-greeting">
      <div>
        <h1 class="lj-home-title">${greeting}, ${Utils.escape(name)} <span class="lj-home-wave"><i data-lucide="hand" class="lj-home-wave-icon"></i></span></h1>
        <p class="lj-home-subtitle">Sua operação está ativa e sua receita está em movimento.</p>
      </div>
      <!-- V37.5.1 — Menu de search/sininho/pin/data movido pra TopBar global (fixed em todas as páginas) -->
    </div>`;
  },

  _kpiSlots() {
    // V25.0.0 — Slots zerados. Vão receber KPIs configuráveis em V25.x.
    // V34.9.16 — Accents alinhados à paleta semântica oficial (Leo).
    // V35.9.2 — Cada card é uma ÁREA específica (Marketing / Vendas / CS).
    // 4º card (Receita) fica como placeholder. KRs do produto pulsando
    // filtrados por área. Até 3 KRs visíveis por card, página inteira gira
    // (KRs 1-3 → KRs 4-6 → 1-3 …) quando área tem mais de 3.
    const product = this._currentProduct();
    const allKrs = (product && window.StrategicMapEngine?.getProductKrs)
      ? (StrategicMapEngine.getProductKrs(product.id) || [])
      : [];

    const pages = App.state.homeKrPages || { marketing: 0, vendas: 0, cs: 0 };

    const areas = [
      { id: 'marketing', label: 'Marketing', accent: 'marketing', icon: 'megaphone' },
      { id: 'vendas',    label: 'Vendas',    accent: 'sales',     icon: 'target' },
      { id: 'cs',        label: 'CS',        accent: 'cs',        icon: 'heart' }
    ];

    const formatKrValue = (kr, v) => {
      const num = Number(v || 0);
      if (kr.metric === 'reais') return `R$ ${num.toLocaleString('pt-BR')}`;
      if (kr.metric === 'percentual') return `${num}%`;
      return num.toLocaleString('pt-BR');
    };

    const areaCards = areas.map(area => {
      const krs = allKrs.filter(k => String(k.area || '').toLowerCase() === area.id);
      const totalPages = Math.max(1, Math.ceil(krs.length / 3));
      const currentPage = (Number(pages[area.id]) || 0) % totalPages;
      const start = currentPage * 3;
      const visibleKrs = krs.slice(start, start + 3);

      const krRows = visibleKrs.length
        ? visibleKrs.map(kr => {
            // V35.10.0-alpha2 — Usa KrLiveValueEngine quando KR tem djowMeta
            // (puxa current ao vivo da fonte). Senão usa kr.current legado.
            // V35.12.0 — Engine também devolve { status, progress, trend }.
            const liveResult = window.KrLiveValueEngine?.computeCurrentValue(kr, { productId: product.id });
            const displayValue = liveResult?.value ?? kr.current;
            const isLive = liveResult?.source === 'live';
            const tier = liveResult?.status?.tier || 'nometa';
            const pct = Math.max(0, Math.min(120, Number(liveResult?.progress?.vsSafe || 0)));
            const widthPct = (pct / 120) * 100;
            const fillClass = {
              below: 'lj-kpi-kr-bar-below',
              onway: 'lj-kpi-kr-bar-onway',
              safe: 'lj-kpi-kr-bar-safe',
              stretch: 'lj-kpi-kr-bar-stretch',
              nometa: 'lj-kpi-kr-bar-nometa'
            }[tier] || 'lj-kpi-kr-bar-nometa';
            const trend = liveResult?.trend;
            const trendHtml = trend?.direction
              ? `<span class="lj-kpi-kr-trend lj-kpi-kr-trend-${trend.color}" title="vs ${trend.snapshotDate} (${trend.snapshotValue})">${trend.direction === 'up' ? '▲' : (trend.direction === 'down' ? '▼' : '—')}</span>`
              : '';
            return `<div class="lj-kpi-kr-row" title="${Utils.escape(kr.name)}${isLive ? ' (ao vivo)' : ''}${liveResult?.status?.label ? ' · ' + Utils.escape(liveResult.status.label) : ''}">
              <p class="lj-kpi-kr-name">${Utils.escape(kr.name)}${isLive ? ' <span class="text-emerald-400 text-[8px]">●</span>' : ''}</p>
              <p class="lj-kpi-kr-value">${formatKrValue(kr, displayValue)}${trendHtml}</p>
              <p class="lj-kpi-kr-meta">Meta ${formatKrValue(kr, kr.targetCommitted)}</p>
              <div class="lj-kpi-kr-bar">
                <div class="lj-kpi-kr-bar-fill ${fillClass}" style="width:${widthPct.toFixed(1)}%;"></div>
                <div class="lj-kpi-kr-bar-mark" style="left:83.33%;" title="Meta segura (100%)"></div>
              </div>
            </div>`;
          }).join('')
        : `<div class="lj-kpi-kr-empty">
            <p>Sem KR de ${area.label} ainda.</p>
            <p class="lj-kpi-kr-empty-cta">Crie no Mapa da Receita</p>
          </div>`;

      const paginationBadge = totalPages > 1
        ? `<span class="lj-kpi-pagination">${currentPage + 1}/${totalPages}</span>`
        : '';

      return `<div class="lj-kpi-card lj-kpi-${area.accent}">
        <div class="lj-kpi-header">
          <div class="lj-kpi-icon"><i data-lucide="${area.icon}" class="w-5 h-5"></i></div>
          <div class="lj-kpi-label">${area.label}</div>
          ${paginationBadge}
        </div>
        <div class="lj-kpi-krs">${krRows}</div>
      </div>`;
    }).join('');

    // V35.9.2 — Card de Receita ainda sem definição (Felipe decidirá depois).
    // Fica placeholder por enquanto.
    const revenueCard = `<div class="lj-kpi-card lj-kpi-revenue opacity-60">
      <div class="lj-kpi-header">
        <div class="lj-kpi-icon"><i data-lucide="dollar-sign" class="w-5 h-5"></i></div>
        <div class="lj-kpi-label">Receita</div>
      </div>
      <div class="lj-kpi-krs">
        <div class="lj-kpi-kr-empty">
          <p>Em definição.</p>
        </div>
      </div>
    </div>`;

    return `<div class="lj-home-kpis">
      ${areaCards}
      ${revenueCard}
    </div>`;
  },

  _pulsoBlock() {
    const product = this._currentProduct();
    const m = this._productMetrics(product);
    // V32.5.7 — Contador "1/N" reflete só produtos ativos.
    const allProducts = this._activeProducts();
    const idx = Number(App.state.homeProductIndex || 0);

    // V32.15.0 — Cada estação ganha `stationId` pra ser clicável e abrir o
    // Mapa da Receita na etapa equivalente (Actions.openPulsoStation).
    const stages = [
      { id: 'produto',   label: 'Produto',   icon: 'package',      value: product ? Utils.escape(product.name || '—') : '—', sub: product?.priceValue ? `R$ ${product.priceValue.toLocaleString('pt-BR')}` : 'sem preço', accent: 'violet' },
      { id: 'campanhas', label: 'Campanhas', icon: 'megaphone',    value: m.campaigns, sub: 'ativas',           accent: 'sky' },
      { id: 'acoes',     label: 'Ações',     icon: 'plug',         value: m.actions,   sub: 'configuradas',     accent: 'teal' },
      { id: 'execucoes', label: 'Execuções', icon: 'check-square', value: m.executions, sub: 'tarefas no gestor', accent: 'emerald' },
      { id: 'receita',   label: 'Receita',   icon: 'dollar-sign',  value: m.revenue ? `R$ ${m.revenue.toLocaleString('pt-BR')}` : 'R$ 0', sub: 'prevista', accent: 'amber' }
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
          <button
            type="button"
            ${product ? `onclick="Actions.openPulsoStation(${product.id}, '${s.id}')"` : 'disabled'}
            class="lj-pulso-stage lj-pulso-stage-${s.accent}${product ? ' lj-pulso-stage-clickable' : ''}"
            style="--lj-pulso-delay: ${i * 200}ms"
            title="${product ? `Abrir no Mapa da Receita: ${s.label}` : 'Cadastre um produto pra navegar'}"
          >
            <div class="lj-pulso-stage-icon"><i data-lucide="${s.icon}" class="w-5 h-5"></i></div>
            <div class="lj-pulso-stage-label">${s.label}</div>
            <div class="lj-pulso-stage-value">${s.value}</div>
            <div class="lj-pulso-stage-sub">${s.sub}</div>
          </button>
        `).join('')}
      </div>

      ${!product ? `<div class="lj-pulso-empty">Cadastre seu primeiro produto pra ver o pulso da operação.</div>` : ''}
    </section>`;
  },

  _bottomCards() {
    const product = this._currentProduct();
    const m = this._productMetrics(product);

    const campaignCard = `<div class="lj-home-card lj-home-card-marketing">
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

    const actionCard = `<div class="lj-home-card lj-home-card-sales">
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

    const execCard = `<div class="lj-home-card lj-home-card-cs">
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

  // V34.9.15 — 4 cards RevOps abaixo do bloco Campanhas/Ações/Execuções.
  // V35.13.0 — Prefere RevopsWhitelabelEngine V2 (painel novo de governança
  // onde Felipe configura grupos com bucket=acquisition/variable/fixed).
  // Fallback pro V1 (revopsFinanceEngine) se V2 ainda não tem config.
  _revopsCards() {
    const product = this._currentProduct();
    if (!product) return '';

    let dash = null;
    if (window.RevopsWhitelabelEngine?.computeDashboard) {
      try { dash = RevopsWhitelabelEngine.computeDashboard(product.id); }
      catch (_) {}
    }
    if (!dash && window.RevopsFinanceEngine) {
      const config = (App.state.revopsFinance || {})[product.id] || { productId: product.id };
      try { dash = RevopsFinanceEngine.computeDashboard(config); }
      catch (_) { return ''; }
    }
    if (!dash) return '';

    const fmtMoney = v => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
    const previsto = Number(dash.sales || 0);
    const realizado = Number(dash.realSales || 0);
    // V35.13.1 — CAC previsto + atual (vem da cascata do painel V2)
    const cacPrevisto = dash.cacPrevisto != null ? Number(dash.cacPrevisto) : Number(dash.cac || 0);
    const cacRealRaw = (dash.cacReal != null) ? Number(dash.cacReal) : null;
    const cacPrevistoFmt = fmtMoney(cacPrevisto);
    const cacRealFmt = cacRealRaw != null ? fmtMoney(cacRealRaw) : '—';
    // V35.13.1 — TM previsto (ofertas) + atual (receita real ÷ vendas reais).
    // V40.14.11 — Quando engine entrega realTicket > 0 (CRM com deals fechados),
    // usa fonte real. Senão cai no proxy antigo (ticket previsto se houve realização).
    const tmPrevisto = Number(dash.ticket || 0);
    const tmRealEngine = Number(dash.realTicket || 0);
    const tmRealRaw = tmRealEngine > 0 ? tmRealEngine : (realizado > 0 ? tmPrevisto : null);
    const tmPrevistoFmt = fmtMoney(tmPrevisto);
    const tmRealFmt = tmRealRaw != null ? fmtMoney(tmRealRaw) : '—';

    const breakevenSales = dash.breakevenSales;
    // V35.13.2 — Breakeven flat: PRECISA (constante = breakevenSales) × TEM (vendas reais).
    // Cor: TEM >= PRECISA verde, < PRECISA vermelho.
    const beNeeds = breakevenSales != null ? breakevenSales : null;
    const beHas = realizado;
    const beNeedsLabel = beNeeds == null ? '—' : beNeeds.toLocaleString('pt-BR');
    const beHasLabel = beHas.toLocaleString('pt-BR');
    const beHasColor = beNeeds == null
      ? 'lj-revops-pct-neutral'
      : (beHas >= beNeeds ? 'lj-revops-pct-ok' : 'lj-revops-pct-bad');

    return `<div class="lj-home-cards lj-home-revops-cards">
      <div class="lj-home-card lj-home-card-revops">
        <div class="lj-home-card-header">
          <div class="lj-home-card-title"><i data-lucide="hand-coins" class="w-4 h-4"></i>CAC</div>
        </div>
        <div class="lj-revops-pair">
          <div class="lj-revops-pair-col">
            <div class="lj-revops-pair-label">Previsto</div>
            <div class="lj-revops-pair-value">${cacPrevistoFmt}</div>
          </div>
          <div class="lj-revops-pair-sep">×</div>
          <div class="lj-revops-pair-col">
            <div class="lj-revops-pair-label">Atual</div>
            <div class="lj-revops-pair-value">${cacRealFmt}</div>
          </div>
        </div>
        <div class="lj-revops-metric-sub">Custo por aquisição · RevOps</div>
      </div>

      <div class="lj-home-card lj-home-card-sales">
        <div class="lj-home-card-header">
          <div class="lj-home-card-title"><i data-lucide="target" class="w-4 h-4"></i>Vendas</div>
        </div>
        <div class="lj-revops-pair">
          <div class="lj-revops-pair-col">
            <div class="lj-revops-pair-label">Previsto</div>
            <div class="lj-revops-pair-value">${previsto.toLocaleString('pt-BR')}</div>
          </div>
          <div class="lj-revops-pair-sep">×</div>
          <div class="lj-revops-pair-col">
            <div class="lj-revops-pair-label">Atual</div>
            <div class="lj-revops-pair-value">${realizado.toLocaleString('pt-BR')}</div>
          </div>
        </div>
        <div class="lj-revops-metric-sub">vendas no período</div>
      </div>

      <div class="lj-home-card lj-home-card-revenue">
        <div class="lj-home-card-header">
          <div class="lj-home-card-title"><i data-lucide="receipt" class="w-4 h-4"></i>TM</div>
        </div>
        <div class="lj-revops-pair">
          <div class="lj-revops-pair-col">
            <div class="lj-revops-pair-label">Previsto</div>
            <div class="lj-revops-pair-value">${tmPrevistoFmt}</div>
          </div>
          <div class="lj-revops-pair-sep">×</div>
          <div class="lj-revops-pair-col">
            <div class="lj-revops-pair-label">Atual</div>
            <div class="lj-revops-pair-value">${tmRealFmt}</div>
          </div>
        </div>
        <div class="lj-revops-metric-sub">Ticket médio · RevOps</div>
      </div>

      <div class="lj-home-card lj-home-card-revops">
        <div class="lj-home-card-header">
          <div class="lj-home-card-title"><i data-lucide="trending-up" class="w-4 h-4"></i>Breakeven</div>
        </div>
        <div class="lj-revops-pair">
          <div class="lj-revops-pair-col">
            <div class="lj-revops-pair-label">Precisa</div>
            <div class="lj-revops-pair-value">${beNeedsLabel}</div>
          </div>
          <div class="lj-revops-pair-sep">×</div>
          <div class="lj-revops-pair-col">
            <div class="lj-revops-pair-label">Tem</div>
            <div class="lj-revops-pair-value ${beHasColor}">${beHasLabel}</div>
          </div>
        </div>
        <div class="lj-revops-metric-sub">${breakevenSales ? `equilíbrio em ${breakevenSales} vendas` : 'breakeven não calculado'}</div>
      </div>
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
          <button onclick="Actions.openDjowAIModal()" class="lj-djow-expand" title="Expandir (Ctrl+K)">
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
          <div class="lj-home-djow-inputrow">
            <input
              id="djowHomeInput"
              class="lj-home-djow-input"
              placeholder="Ctrl+K para chamar o Djow"
              value="${Utils.escape(App.state.djowInput || '')}"
              oninput="App.state.djowInput=this.value"
              onkeydown="if(event.key==='Enter' && !event.shiftKey){event.preventDefault(); event.stopPropagation(); App.state.djowInput=this.value; Actions.sendDjowAIMessage();}"
              onfocus="this.placeholder=''"
              onblur="if(!this.value) this.placeholder='Ctrl+K para chamar o Djow'"
              ${!isConfigured || !canUse || sending ? 'disabled' : ''}
            />
            <button
              onclick="Actions.sendDjowAIMessage()"
              class="lj-home-djow-send"
              title="Enviar"
              ${!isConfigured || !canUse || sending ? 'disabled' : ''}
            ><i data-lucide="${sending ? 'loader-2' : 'send'}" class="w-3.5 h-3.5 ${sending ? 'animate-spin' : ''}"></i></button>
          </div>
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
          ${this._alertItems()}
        </div>
      </div>
    </aside>`;
  },

  render() {
    // Liga rotação só quando a aba está visível
    this.startRotation();
    // V32.15.1 — Inclui StrategicMapModal aqui pra que o click nas estações
    // do Pulso (Actions.openPulsoStation, V32.15.0) consiga renderizar o Mapa
    // sem trocar de tab. Antes só Produtos/Campanhas/Ações renderizavam o modal,
    // então abrir o Mapa pela Home não pintava nada no DOM.
    return `<div class="lj-home">
      ${this._greetingBar()}
      ${this._kpiSlots()}
      <div class="lj-home-main">
        <div class="lj-home-main-col">
          ${this._pulsoBlock()}
          ${this._bottomCards()}
          ${this._revopsCards()}
        </div>
        ${this._sideStack()}
      </div>
      ${window.StrategicMapModal ? StrategicMapModal.render() : ''}
    </div>`;
  },

  // V37.4.32 — Items pra preencher o card "Alertas importantes" (canto direito inferior).
  // Funde os alertas estratégicos + o resumo "X atualizações desde ontem"
  // (antes era chip flutuante no topo via BomDiaCard.renderChip).
  _alertItems() {
    const items = [];

    // V37.4.32 — Item de updates do sininho no topo (severidade violet = neutra/info).
    // Dispara load assíncrono do summary se ainda não veio.
    if (window.BomDiaCard) {
      const summary = App.state.bomDiaSummary;
      if (!summary) {
        setTimeout(() => BomDiaCard.ensureLoaded(), 0);
      } else if (!summary.loading) {
        const total = summary.overall?.total || 0;
        if (total > 0) {
          items.push({
            severity: 'violet',
            icon: 'bell',
            label: `${total} atualização${total === 1 ? '' : 'ões'} desde ontem`,
            hint: 'novidades no tenant — abre sininho',
            onclick: 'Actions.openNotificationsFromBomDia()'
          });
        }
      }
    }

    // Alertas estratégicos (lógica original V29.0.1).
    if (window.StrategicMapEngine) {
      const products = App.state.products || [];
      products.forEach(p => {
        const desplug = StrategicMapEngine.getDesplugedCampaigns ? StrategicMapEngine.getDesplugedCampaigns(p.id) : [];
        const branches = StrategicMapEngine.getBranchesByProduct ? StrategicMapEngine.getBranchesByProduct(p.id) : [];
        const orphans = StrategicMapEngine.getOrphanChildKrs ? StrategicMapEngine.getOrphanChildKrs(p.id) : [];
        desplug.forEach(c => {
          items.push({ severity: 'red', icon: 'unplug', label: `${Utils.escape(c.name)} (${Utils.escape(p.name)})`, hint: 'desplugada — não alimenta KPIs', onclick: `Actions.activateStrategicMapForCampaign(${c.id})` });
        });
        branches.forEach(b => {
          if (StrategicMapEngine.getCampaignStrategicStatus(b.campaignId) === 'configuring') {
            const camp = (App.state.campaigns || []).find(c => Number(c.id) === Number(b.campaignId));
            if (camp) items.push({ severity: 'amber', icon: 'loader', label: `${Utils.escape(camp.name)} (${Utils.escape(p.name)})`, hint: 'em configuração — faltam números', onclick: `Actions.openStrategicMapForCampaign(${b.campaignId})` });
          }
        });
        if (orphans.length) {
          items.push({ severity: 'amber', icon: 'ghost', label: `${orphans.length} número(s) órfão(s) em ${Utils.escape(p.name)}`, hint: 'sem KR-mãe — rollup não funciona', onclick: `Actions.openStrategicMap(${p.id})` });
        }
      });
    }

    if (items.length === 0) return '<div class="lj-home-alerts-empty">Nenhum alerta no momento.</div>';
    // V34.9.18 — Cores claras pra ficar legível no fundo escuro do card.
    const hintToneMap = {
      red:    'text-red-300',
      amber:  'text-amber-300',
      orange: 'text-orange-300',
      yellow: 'text-yellow-300',
      sky:    'text-sky-300',
      emerald:'text-emerald-300',
      violet: 'text-violet-300'
    };
    return items.slice(0, 8).map(it => {
      const hintTone = hintToneMap[it.severity] || 'text-slate-300';
      return `<button onclick="${it.onclick}" class="w-full flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-left transition" title="${it.hint}">
        <span class="w-1.5 h-1.5 rounded-full bg-${it.severity}-400 mt-1.5 shrink-0"></span>
        <div class="min-w-0 flex-1">
          <p class="text-[11px] font-black text-slate-100 truncate">${it.label}</p>
          <p class="text-[10px] ${hintTone}">${it.hint}</p>
        </div>
      </button>`;
    }).join('') + (items.length > 8 ? `<p class="text-[10px] text-slate-400 italic text-center pt-1">+${items.length - 8} alerta(s) mais</p>` : '');
  }
};
