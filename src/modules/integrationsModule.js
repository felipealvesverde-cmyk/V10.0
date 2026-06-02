// V35.6.0 — Integrações IPI: menu próprio com 3 abas (Injetar / Propagar / Iterar).
// Substitui Configurações → Integrações (que morre na mesma release final).
// Backend NÃO muda nada. Migração 100% visual.
//
// Paleta azul cravada 2026-06-02: Injetar=#0A1F44 (marinho), Propagar=#0E3A6E (médio), Iterar=#1565C0 (royal).
//
// Cards do grid usam o template padrão do Google Ads V35.5.0 (border-l-4 + tone color).
// Cada integração tem categoria IPI fixa e estado próprio em App.state.

const IntegrationsModule = {
  TABS: [
    {
      id: 'injetar',
      label: 'Injetar',
      icon: 'download',
      tone: '#0A1F44',
      desc: 'Softwares que alimentam o Journey com dados. Tudo o que entra na sua jornada vem por aqui: investimento em mídia, vendas confirmadas, eventos de aluno, captura de leads. Conecte ferramentas que despejam dados crus no LJ e elas passam a alimentar automaticamente seus cards de Campanha, KPIs de Receita e o Banco de Leads.'
    },
    {
      id: 'propagar',
      label: 'Propagar',
      icon: 'send',
      tone: '#0E3A6E',
      desc: 'Softwares que executam o que o Journey decide. Quando o LJ decide acionar algo — disparar um e-mail, mandar SMS, criar uma notificação — ele propaga esse comando pra ferramentas que executam por ele. Você desenha o orquestrador no LJ; a entrega acontece nesses softwares.'
    },
    {
      id: 'iterar',
      label: 'Iterar',
      icon: 'repeat',
      tone: '#1565C0',
      desc: 'Softwares que andam lado a lado com o Journey. CRMs e ferramentas de execução que têm vida própria — seu time entra, atualiza, executa — mas precisam trocar dados em loop com o LJ pra que o ciclo Suspect→Lead→Customer se reconcilie em ambos os lados. O LJ não comanda; ele dialoga.'
    }
  ],

  render() {
    const active = App.state.integrationsTab || 'injetar';
    const tab = this.TABS.find(t => t.id === active) || this.TABS[0];

    // Auto-fetch status das integrações 1x ao abrir a página.
    if (App.state.googleAdsStatus === null && window.Actions?.loadGoogleAdsStatus) {
      setTimeout(() => Actions.loadGoogleAdsStatus(), 0);
    }
    if (App.state.hotmartStatus === null && window.Actions?.loadHotmartStatus) {
      setTimeout(() => Actions.loadHotmartStatus(), 0);
    }
    if (!App.state.clickupStatus && window.Actions?.loadClickupStatus) {
      setTimeout(() => Actions.loadClickupStatus(), 0);
    }

    return `<div class="space-y-6 max-w-6xl mx-auto px-2 pb-8">
      ${this._tabsBar(active)}
      ${this._activeTabHeader(tab)}
      ${this._cardsGrid(active)}
    </div>`;
  },

  _tabsBar(active) {
    return `<div class="flex gap-1 border-b border-slate-200">
      ${this.TABS.map(t => {
        const isActive = active === t.id;
        const style = isActive ? `color:${t.tone};border-color:${t.tone};` : '';
        return `<button onclick="Actions.setIntegrationsTab('${t.id}')"
          class="px-5 py-3 -mb-px text-sm font-black uppercase tracking-wider inline-flex items-center gap-2 transition border-b-2 ${isActive ? '' : 'border-transparent text-slate-400 hover:text-slate-600'}"
          style="${style}">
          <i data-lucide="${t.icon}" class="w-4 h-4"></i> ${t.label}
        </button>`;
      }).join('')}
    </div>`;
  },

  _activeTabHeader(tab) {
    return `<div class="rounded-3xl p-6 shadow-xl" style="background:linear-gradient(135deg, ${tab.tone} 0%, ${tab.tone}dd 50%, ${tab.tone}99 100%);">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded-2xl bg-white/15 grid place-items-center shrink-0">
          <i data-lucide="${tab.icon}" class="w-6 h-6 text-white"></i>
        </div>
        <div class="min-w-0">
          <p class="text-[10px] font-black text-white/70 uppercase tracking-widest">Integrações · IPI</p>
          <h2 class="text-2xl font-black text-white mt-1">${tab.label}</h2>
          <p class="text-[13px] text-white/85 leading-relaxed mt-2">${tab.desc}</p>
        </div>
      </div>
    </div>`;
  },

  _cardsGrid(tabId) {
    const cards = this._cardsByTab(tabId);
    if (!cards.length) {
      return `<div class="rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 p-12 text-center">
        <i data-lucide="construction" class="w-10 h-10 text-slate-400 mx-auto mb-3"></i>
        <p class="text-sm font-black text-slate-600">Nenhuma integração nesta categoria ainda.</p>
        <p class="text-[12px] text-slate-500 mt-1">Em breve.</p>
      </div>`;
    }
    return `<div class="grid md:grid-cols-3 gap-4">
      ${cards.map(c => this._gridCard(c)).join('')}
    </div>`;
  },

  _cardsByTab(tabId) {
    if (tabId === 'injetar') return this._injetarCards();
    if (tabId === 'propagar') return this._propagarCards();
    if (tabId === 'iterar') return this._iterarCards();
    return [];
  },

  _injetarCards() {
    const gAds = App.state.googleAdsStatus || {};
    const gAdsConnected = Boolean(gAds.configured && gAds.oauthCompleted);
    const hStatus = App.state.hotmartStatus || {};
    const hConnected = Boolean(hStatus.configured);
    return [
      {
        id: 'google-ads',
        name: 'Google Ads',
        desc: gAdsConnected
          ? `Conectado · Customer ${gAds.selectedCustomerId || '?'}`
          : 'Search, Display e YouTube por campanha. Imports diários.',
        icon: 'search',
        tone: 'amber',
        status: gAdsConnected ? 'connected' : 'disconnected',
        action: gAdsConnected ? 'Actions.disconnectGoogleAds()' : 'Actions.openGoogleAdsWizard()',
        actionLabel: gAdsConnected ? 'Desconectar' : 'Conectar',
        actionIcon: gAdsConnected ? 'unplug' : 'plug'
      },
      {
        id: 'hotmart',
        name: 'Hotmart',
        desc: hConnected
          ? 'Conectado · recebendo compras automaticamente'
          : 'Recebe compras automaticamente e promove leads para customers.',
        icon: 'dollar-sign',
        tone: 'orange',
        status: hConnected ? 'connected' : 'disconnected',
        action: 'Actions.openHotmartWizard()',
        actionLabel: hConnected ? 'Gerenciar' : 'Conectar',
        actionIcon: hConnected ? 'settings' : 'plug'
      },
      {
        id: 'meta',
        name: 'Meta Ads',
        desc: 'Investimento, conversões e CAC por campanha (Facebook + Instagram).',
        icon: 'megaphone',
        tone: 'sky',
        status: 'soon'
      },
      {
        id: 'stripe',
        name: 'Stripe',
        desc: 'Vendas reais, reembolsos e MRR por produto/oferta.',
        icon: 'credit-card',
        tone: 'violet',
        status: 'soon'
      }
    ];
  },

  _propagarCards() {
    // V35.6.0 — nenhuma integração ativa nesta categoria ainda.
    // Futuros: e-mail outbound, SMS, WhatsApp transactional.
    return [];
  },

  _iterarCards() {
    const rdCfg = App.state.integrations?.rd || {};
    const rdCrm = App.state.integrations?.rdCrm || {};
    const rdConnected = Boolean(rdCfg.accessToken || rdCrm.token || rdCrm.accessToken);
    const cuStatus = App.state.clickupStatus || {};
    const cuConnected = Boolean(cuStatus.connected);
    return [
      {
        id: 'rd-station',
        name: 'RD Station',
        desc: rdConnected
          ? `Conectado · CRM + Marketing`
          : 'CRM + Marketing. Token, Tempo Real e RD Marketing em uma só integração.',
        icon: 'zap',
        tone: 'pink',
        status: rdConnected ? 'connected' : 'disconnected',
        action: "Actions.openSettingsModal('rd')",
        actionLabel: rdConnected ? 'Gerenciar' : 'Conectar',
        actionIcon: rdConnected ? 'settings' : 'plug'
      },
      {
        id: 'clickup',
        name: 'ClickUp',
        desc: cuConnected
          ? `Conectado em ${Utils.escape(cuStatus.workspaceName || '?')}`
          : 'Espelha Produto > Campanha > Ação > Tarefa pra execução do time.',
        icon: 'check-square',
        tone: 'violet',
        status: cuConnected ? 'connected' : 'disconnected',
        action: "Actions.openSettingsModal('clickup')",
        actionLabel: cuConnected ? 'Gerenciar' : 'Conectar',
        actionIcon: cuConnected ? 'settings' : 'plug'
      }
    ];
  },

  _gridCard(c) {
    const toneCls = {
      sky:    { border: 'border-l-sky-500',    iconBg: 'bg-sky-500/15',    iconText: 'text-sky-700',    pill: 'text-sky-700' },
      amber:  { border: 'border-l-amber-500',  iconBg: 'bg-amber-500/15',  iconText: 'text-amber-700',  pill: 'text-amber-700' },
      violet: { border: 'border-l-violet-500', iconBg: 'bg-violet-500/15', iconText: 'text-violet-700', pill: 'text-violet-700' },
      orange: { border: 'border-l-orange-500', iconBg: 'bg-orange-500/15', iconText: 'text-orange-700', pill: 'text-orange-700' },
      pink:   { border: 'border-l-pink-500',   iconBg: 'bg-pink-500/15',   iconText: 'text-pink-700',   pill: 'text-pink-700' }
    }[c.tone] || { border: 'border-l-slate-500', iconBg: 'bg-slate-500/15', iconText: 'text-slate-700', pill: 'text-slate-700' };

    const isSoon = c.status === 'soon';
    const statusBadge = (() => {
      if (c.status === 'connected') return '<span class="text-[10px] font-black text-emerald-700 bg-emerald-500/10 border border-emerald-400/30 px-2 py-0.5 rounded-md uppercase tracking-wider">Conectado</span>';
      if (c.status === 'soon')      return '<span class="text-[10px] font-black text-slate-500 bg-slate-200/60 border border-slate-300 px-2 py-0.5 rounded-md uppercase tracking-wider">Em breve</span>';
      return '<span class="text-[10px] font-black text-slate-500 bg-slate-200/60 border border-slate-300 px-2 py-0.5 rounded-md uppercase tracking-wider">Desconectado</span>';
    })();

    return `<div class="rounded-2xl bg-white border border-slate-200 border-l-4 ${toneCls.border} p-4 flex flex-col gap-2 shadow-sm hover:shadow-md transition">
      <div class="flex items-start justify-between gap-2">
        <span class="w-9 h-9 rounded-xl ${toneCls.iconBg} grid place-items-center ${toneCls.iconText}">
          <i data-lucide="${c.icon}" class="w-4 h-4"></i>
        </span>
        ${statusBadge}
      </div>
      <div>
        <p class="text-[10px] font-black ${toneCls.pill} uppercase tracking-widest">${c.name}</p>
        <p class="text-[11px] text-slate-600 leading-snug mt-1">${c.desc}</p>
      </div>
      ${isSoon
        ? `<button disabled title="Disponível em breve" class="mt-1 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed text-[10px] font-black uppercase tracking-wider inline-flex items-center justify-center gap-1.5">
            <i data-lucide="clock" class="w-3 h-3"></i> Em breve
          </button>`
        : `<button onclick="${c.action || ''}" class="mt-1 px-3 py-1.5 rounded-lg ${c.status === 'connected' ? 'bg-slate-900 hover:bg-slate-800' : 'bg-violet-600 hover:bg-violet-700'} text-white text-[10px] font-black uppercase tracking-wider inline-flex items-center justify-center gap-1.5" style="color:#fff!important;">
            <i data-lucide="${c.actionIcon || 'plug'}" class="w-3 h-3"></i> ${c.actionLabel || 'Conectar'}
          </button>`
      }
    </div>`;
  }
};

window.IntegrationsModule = IntegrationsModule;
