var SettingsModal = {
  activeSection() {
    return App.state.settingsActiveSection || 'database';
  },

  _input(field, label, placeholder = '', type = 'text', value = '') {
    return `<div>
      <label class="text-xs font-black text-slate-500 uppercase tracking-wide">${label}</label>
      <input type="${type}" value="${Utils.escape(value || '')}" oninput="Actions.updateRDConfig('${field}', this.value)" placeholder="${Utils.escape(placeholder)}" class="mt-1 w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-semibold text-slate-900 placeholder:text-slate-400" />
    </div>`;
  },

  _dbInput(path, label, placeholder, type, value, hint = '') {
    const safeValue = value === undefined || value === null ? '' : String(value);
    const onInput = type === 'number'
      ? `Actions.updateDatabaseConfig('${path}', Number(this.value || 0), false)`
      : `Actions.updateDatabaseConfig('${path}', this.value, false)`;
    return `<div>
      <label class="text-xs font-black text-slate-500 uppercase tracking-wide">${label}</label>
      <input type="${type}" value="${Utils.escape(safeValue)}" oninput="${onInput}" placeholder="${Utils.escape(placeholder || '')}" class="mt-1 w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-semibold text-slate-900 placeholder:text-slate-400" />
      ${hint ? `<p class="text-[11px] text-slate-400 mt-1">${Utils.escape(hint)}</p>` : ''}
    </div>`;
  },

  _dbToggle(path, label, value, hint = '') {
    const on = Boolean(value);
    return `<label class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-slate-200">
      <span>
        <span class="block text-sm font-black text-slate-900">${Utils.escape(label)}</span>
        ${hint ? `<span class="block text-[11px] text-slate-500">${Utils.escape(hint)}</span>` : ''}
      </span>
      <button onclick="Actions.updateDatabaseConfig('${path}', ${!on})" class="relative w-12 h-7 rounded-full transition ${on ? 'bg-emerald-500' : 'bg-slate-300'}" aria-pressed="${on}">
        <span class="absolute top-1 ${on ? 'right-1' : 'left-1'} w-5 h-5 rounded-full bg-white shadow"></span>
      </button>
    </label>`;
  },

  _dbSelect(path, label, options, value) {
    return `<div>
      <label class="text-xs font-black text-slate-500 uppercase tracking-wide">${label}</label>
      <select onchange="Actions.updateDatabaseConfig('${path}', this.value)" class="mt-1 w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-semibold text-slate-900">
        ${options.map(opt => {
          const optValue = typeof opt === 'string' ? opt : opt.value;
          const optLabel = typeof opt === 'string' ? opt : opt.label;
          return `<option value="${Utils.escape(optValue)}" ${String(value || '') === String(optValue) ? 'selected' : ''}>${Utils.escape(optLabel)}</option>`;
        }).join('')}
      </select>
    </div>`;
  },

  sectionButton(section, label, icon) {
    const active = this.activeSection() === section;
    return `<button onclick="Actions.setSettingsSection('${section}')" class="w-full text-left rounded-2xl px-4 py-4 border transition ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}">
      <div class="flex items-center gap-3">
        <i data-lucide="${icon}" class="w-4 h-4"></i>
        <span class="font-black">${label}</span>
      </div>
    </button>`;
  },

  // V23.1.0 — Painel "Conexão RD" com 2 tabs (CRM | Marketing).
  // Cada tab tem seu próprio assistente, seu próprio fluxo, sua própria
  // navegação. O header é comum (identidade da conta + status agregado).
  // Justificativa arquitetural: as duas conexões usam credenciais e fluxos
  // fundamentalmente diferentes (PAT estático vs OAuth multi-step). Forçar
  // uma UX unificada confundia o usuário.
  rdConnectionPanel() {
    const rdCfg = (App.state.integrations && App.state.integrations.rd) || (window.RDConfig ? RDConfig.defaultConfig() : {});
    const crmCfg = (App.state.integrations && App.state.integrations.rdCrm) || (window.RdCrmConfig ? RdCrmConfig.defaultConfig() : {});
    const activeTab = App.state.settingsRdActiveTab || 'crm';

    return `<div class="space-y-4">
      ${this._rdAccountHeader(rdCfg, crmCfg)}
      ${App.state.rdInfoModal?.open ? this._rdInfoModalRender() : ''}
      ${this._rdTabsBar(rdCfg, crmCfg, activeTab)}
      <div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
        ${activeTab === 'marketing'
          ? this._rdMarketingTabContent(rdCfg)
          : this._rdCrmTabContent(rdCfg, crmCfg)}
      </div>
    </div>`;
  },

  // V23.1.0 — Header comum mostrando identidade RD + status dos 2 produtos.
  // V24.0.0 — Cada aba = 1 PRODUTO do RD (CRM ou Marketing). Dentro de CRM
  // existem 2 mecanismos de auth (PAT e OAuth), mas isso é detalhe interno
  // da aba, não merece tab separada.
  // V31.2.41 — Header repaginado:
  //   - Botão 1 "RD + LeadJourney" abre modal com explicação user-friendly das 3 conexões
  //   - Botão 2 "Testar conexão" dispara teste real das 3 (resultados em rdConnectionStatus)
  //   - 3 badges abaixo refletem status atual (cinza=unknown, verde=connected, amarelo=missing, vermelho=error)
  _rdAccountHeader(rdCfg, crmCfg) {
    const accountLabel = (rdCfg.accountName || '').trim() || 'Conta RD não identificada';
    const crmAt = rdCfg.crmTestAt ? new Date(rdCfg.crmTestAt).toLocaleString('pt-BR') : null;
    const testing = Boolean(App.state.rdTestingConnections);
    const status = App.state.rdConnectionStatus || {};
    const lastTested = ['crm_pat', 'marketing_oauth', 'crm_oauth']
      .map(k => status[k]?.testedAt ? new Date(status[k].testedAt).getTime() : 0)
      .reduce((a, b) => Math.max(a, b), 0);
    const lastTestedLabel = lastTested
      ? `testado há ${Math.max(1, Math.round((Date.now() - lastTested) / 60000))} min`
      : 'nunca testado';

    const badgeFor = (key, label) => {
      const s = status[key] || { status: 'unknown' };
      const cls = s.status === 'connected'
        ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
        : s.status === 'missing'
          ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
          : s.status === 'error'
            ? 'bg-red-500/20 text-red-200 border-red-400/40'
            : 'bg-slate-600/20 text-slate-300 border-slate-500/30';
      const icon = s.status === 'connected' ? '🟢' : s.status === 'missing' ? '🟡' : s.status === 'error' ? '🔴' : '⚪';
      const title = s.message ? Utils.escape(s.message) : (s.status === 'unknown' ? 'Ainda não testada — clique em "Testar conexão"' : '');
      return `<span title="${title}" class="px-3 py-1.5 rounded-full text-[11px] font-black border ${cls} flex items-center gap-1.5">${icon} ${label}</span>`;
    };

    return `<div class="rounded-3xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-5">
      <div class="flex flex-col md:flex-row md:items-start justify-between gap-3 mb-3">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-white/10 grid place-items-center"><i data-lucide="plug-zap" class="w-6 h-6"></i></div>
          <div>
            <p class="text-[10px] font-black text-sky-300 uppercase tracking-widest">Conta RD Station</p>
            <p class="text-base font-black">${Utils.escape(accountLabel)}</p>
            <p class="text-[10px] text-slate-400">${crmAt ? `Última validação CRM: ${Utils.escape(crmAt)} · ` : ''}${lastTestedLabel}</p>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <button onclick="Actions.openRdInfoModal()" class="px-3 py-1.5 rounded-full text-[11px] font-black bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/40 text-sky-100 flex items-center gap-1.5" style="color:#e0f2fe;">
            <i data-lucide="help-circle" class="w-3.5 h-3.5"></i>
            RD + LeadJourney
          </button>
          <button onclick="Actions.testAllRdConnections()" ${testing ? 'disabled' : ''} class="px-3 py-1.5 rounded-full text-[11px] font-black bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center gap-1.5 disabled:opacity-50" style="color:#fff;">
            <i data-lucide="${testing ? 'loader-2' : 'activity'}" class="w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}"></i>
            ${testing ? 'Testando…' : 'Testar conexão'}
          </button>
        </div>
      </div>
      <!-- Badges das 3 conexões -->
      <div class="flex flex-wrap gap-2 pt-3 border-t border-white/10">
        ${badgeFor('crm_pat', 'Token do CRM')}
        ${badgeFor('crm_oauth', 'Tempo Real do CRM')}
        ${badgeFor('marketing_oauth', 'RD Marketing')}
      </div>
    </div>`;
  },

  // V31.2.41 — Modal info "RD + LeadJourney": explica em linguagem amigável as
  // 3 conexões. Accordion (uma seção aberta por vez), com indicador de status
  // de cada conexão usando rdConnectionStatus.
  _rdInfoModalRender() {
    const m = App.state.rdInfoModal;
    if (!m || !m.open) return '';
    const status = App.state.rdConnectionStatus || {};
    const open = m.openSection || null;
    const statusDot = (key) => {
      const s = status[key]?.status || 'unknown';
      const colors = { connected: 'bg-emerald-500', missing: 'bg-amber-400', error: 'bg-red-500', unknown: 'bg-slate-400' };
      const labels = { connected: 'Conectada', missing: 'Falta informação', error: 'Erro', unknown: 'Não testada' };
      return `<span class="inline-flex items-center gap-1.5"><span class="w-2.5 h-2.5 rounded-full ${colors[s]}"></span><span class="text-[10px] font-bold text-slate-600">${labels[s]}</span></span>`;
    };
    const section = (key, title, emoji, body) => {
      const isOpen = open === key;
      return `<div class="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <button onclick="Actions.toggleRdInfoSection('${key}')" class="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50">
          <div class="flex items-center gap-2 text-left">
            <span class="text-xl">${emoji}</span>
            <div>
              <p class="font-black text-sm text-slate-900">${title}</p>
              ${statusDot(key)}
            </div>
          </div>
          <i data-lucide="${isOpen ? 'chevron-up' : 'chevron-down'}" class="w-4 h-4 text-slate-500"></i>
        </button>
        ${isOpen ? `<div class="px-4 pb-4 text-sm text-slate-700 space-y-2 border-t border-slate-100 pt-3">${body}</div>` : ''}
      </div>`;
    };

    return `<div class="fixed inset-0 z-[95] bg-black/70 backdrop-blur-sm grid place-items-center p-4" onclick="if(event.target === this) Actions.closeRdInfoModal()">
      <div class="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-auto shadow-2xl">
        <div class="p-5 border-b border-slate-100 flex items-start justify-between gap-3 sticky top-0 bg-white z-10">
          <div>
            <p class="text-[10px] font-black text-sky-600 uppercase tracking-widest">RD + LeadJourney</p>
            <h2 class="text-xl font-black text-slate-900 mt-0.5">Como o LJ conversa com o RD?</h2>
          </div>
          <button onclick="Actions.closeRdInfoModal()" class="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xl">×</button>
        </div>

        <div class="p-5 space-y-4">
          <!-- Intro -->
          <div class="rounded-2xl bg-sky-50 border border-sky-200 p-4 text-sm text-slate-700 leading-relaxed">
            <p class="font-black text-sky-900 mb-1">Por que o LeadJourney usa o RD?</p>
            <p>O RD Station é dividido em <b>2 produtos</b> que funcionam como sistemas separados: <b>RD CRM</b> (onde tu gerencia funis, deals e contatos de venda) e <b>RD Marketing</b> (onde tu cria campanhas, automações e listas de e-mail).</p>
            <p class="mt-2">Pra trazer o melhor dos dois pro Journey, a gente conecta cada um separado. Tem 3 conexões possíveis — só a primeira é obrigatória, as outras 2 são opcionais dependendo do que tu usa.</p>
            <p class="mt-2 text-[12px] text-sky-700">Clica em cada conexão abaixo pra entender. <b>Pra conectar, feche esta janela e siga os passos no card abaixo (no mesmo painel).</b></p>
          </div>

          <!-- 3 sections (accordion) -->
          <div class="space-y-2">
            ${section('crm_pat', 'Token do CRM (obrigatório)', '🔑', `
              <p><b>O que é:</b> uma chave única gerada no teu próprio RD CRM, em <i>Perfil → Token de API</i>.</p>
              <p><b>Pra que serve:</b> o LJ usa pra criar/mover negociações, ler tags e funis no teu RD CRM. É o básico.</p>
              <p><b>Quando precisa:</b> sempre, pra qualquer integração com CRM.</p>
            `)}
            ${section('crm_oauth', 'Tempo Real do CRM (opcional)', '⚡', `
              <p><b>O que é:</b> conexão que avisa o LJ na hora quando algo muda no CRM (deal mudou de fase, novo lead, etc).</p>
              <p><b>Pra que serve:</b> sem isso, o LJ verifica o CRM de 5 em 5 min. Com isso, atualização é instantânea.</p>
              <p><b>Quando precisa:</b> se tu quer ver mudanças do CRM ao vivo no LJ.</p>
            `)}
            ${section('marketing_oauth', 'RD Marketing (opcional)', '📧', `
              <p><b>O que é:</b> conexão com o produto RD Marketing (campanhas, automações, listas).</p>
              <p><b>Pra que serve:</b> sincronizar eventos de marketing (conversões, formulários, lead scoring) entre LJ e RD.</p>
              <p><b>Quando precisa:</b> só se tu usa o RD Marketing além do CRM. Se só faz CRM, pode pular.</p>
            `)}
          </div>
        </div>

        <div class="p-4 border-t border-slate-100 flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onclick="Actions.closeRdInfoModal()" class="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-black" style="color:#fff;">Fechar e ir para os passos</button>
        </div>
      </div>
    </div>`;
  },

  // V23.1.0 — Barra de tabs com indicador de status em cada uma.
  _rdTabsBar(rdCfg, crmCfg, active) {
    const crmStatus = this._rdCrmTabStatus(rdCfg);
    const mktStatus = this._rdMarketingTabStatus(rdCfg);
    const tab = (key, label, icon, status) => {
      const isActive = active === key;
      const chipTone = status === 'ok' ? 'bg-emerald-100 text-emerald-800'
        : status === 'warning' ? 'bg-amber-100 text-amber-800'
        : status === 'error' ? 'bg-red-100 text-red-800'
        : 'bg-slate-100 text-slate-600';
      const chipLabel = status === 'ok' ? 'ativo'
        : status === 'warning' ? 'pendente'
        : status === 'error' ? 'falha'
        : 'inativo';
      return `<button onclick="Actions.setRdActiveTab('${key}')" class="flex-1 px-4 py-3 rounded-2xl flex items-center justify-center gap-2 font-black text-sm transition ${isActive ? 'bg-slate-900 text-white shadow' : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'}" ${isActive ? 'style="color:#fff;"' : ''}>
        <i data-lucide="${icon}" class="w-4 h-4"></i>
        <span>${label}</span>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${chipTone}">${chipLabel}</span>
      </button>`;
    };
    return `<div class="flex gap-2">
      ${tab('crm', 'CRM', 'database', crmStatus)}
      ${tab('marketing', 'Marketing', 'mail', mktStatus)}
    </div>`;
  },

  _rdCrmTabStatus(rdCfg) {
    const hasToken = Boolean((rdCfg.crmPersonalToken || '').trim());
    if (!hasToken) return 'inactive';
    if (rdCfg.crmTestStatus === 'connected') return 'ok';
    if (rdCfg.crmTestStatus && rdCfg.crmTestStatus !== 'not_tested') return 'error';
    return 'warning';
  },

  _rdMarketingTabStatus(rdCfg) {
    if (App.state.rdMarketingSkipped) return 'inactive';
    if (rdCfg.accessToken) return 'ok';
    if (rdCfg.status === 'exchange_failed') return 'error';
    if (rdCfg.clientId || rdCfg.clientSecret) return 'warning';
    return 'inactive';
  },

  // V23.1.0 — Conteúdo da aba CRM. Layout vertical:
  //   1. Assistente CRM PAT (3 passos básicos)
  //   2. Token PAT
  //   3. Pipelines (gated em PAT validado)
  //   4. CRM OAuth avançado (V24.0.0 — necessário pra webhook)
  //   5. Webhook (gated em CRM OAuth conectado)
  //   6. Diagnóstico
  //
  // OAuth e PAT vivem na mesma aba porque ambos são pra MESMO produto (CRM).
  // Tab separada confunde — RD tem 2 produtos (CRM, Marketing), nós temos 2 abas.
  _rdCrmTabContent(rdCfg, crmCfg) {
    const hasToken = Boolean((rdCfg.crmPersonalToken || '').trim());
    const isValidated = hasToken && rdCfg.crmTestStatus === 'connected' && Boolean(rdCfg.crmTestAt);
    return `<div class="space-y-5">
      ${this._rdCrmAssistantBullets(rdCfg, crmCfg, hasToken, isValidated)}
      ${this._rdCoreCrmTokenBlock(rdCfg, hasToken, isValidated)}
      ${isValidated ? this._rdCrmCampaignPipelinesBlock(crmCfg, isValidated) : this._rdLockedHint('Pipelines bloqueados', hasToken ? 'Termine o Passo 2 (testar conexão) para liberar.' : 'Cole o token CRM acima para começar.')}
      ${isValidated ? this._rdCrmOauthSection(rdCfg) : ''}
      ${isValidated ? this._rdCrmWebhookBlock(rdCfg) : ''}
      ${this._rdDiagnosticsBlock(rdCfg, crmCfg, hasToken, Boolean(rdCfg.accessToken))}
    </div>`;
  },

  // V24.0.0 — Seção OAuth CRM (dentro da aba CRM). Visivelmente diferente do
  // bloco PAT acima: ícone shield-check, cor violeta, header "Avançado" pra
  // sinalizar que é opcional. Se OAuth já conectado, mostra card compacto.
  _rdCrmOauthSection(rdCfg) {
    const cfg = rdCfg.crmOauth || (window.RDConfig ? RDConfig.defaultCrmOauth() : {});
    const hasOAuth = Boolean(cfg.accessToken);
    const exchangeFailed = cfg.status === 'exchange_failed';
    const expiresAt = cfg.expiresAt ? new Date(cfg.expiresAt) : null;
    const expired = expiresAt && expiresAt.getTime() <= Date.now();
    const minsLeft = expiresAt ? Math.round((expiresAt.getTime() - Date.now()) / 60000) : null;
    const stateLabel = hasOAuth
      ? (expired ? 'expirado' : 'conectado')
      : (cfg.clientId ? 'pendente' : 'não configurado');
    const stateChip = hasOAuth
      ? (expired ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900')
      : (cfg.clientId ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-700');

    return `<div class="rounded-3xl bg-white border-2 border-violet-200 shadow-md overflow-hidden">
      <div class="bg-gradient-to-r from-violet-600 to-purple-700 px-5 py-3 flex items-center justify-between text-white">
        <div class="flex items-center gap-2">
          <i data-lucide="shield-check" class="w-4 h-4"></i>
          <span class="font-black text-xs uppercase tracking-wider">OAuth CRM avançado</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${stateChip}">${stateLabel}</span>
        </div>
        <span class="text-[10px] text-white/70 font-black">necessário pra webhook em tempo real</span>
      </div>

      <div class="p-5 space-y-4">
        <div class="rounded-2xl bg-violet-50 border border-violet-200 p-3 flex items-start gap-2">
          <i data-lucide="info" class="w-4 h-4 text-violet-700 mt-0.5"></i>
          <p class="text-xs text-violet-900 leading-relaxed">
            O token PAT acima resolve <b>90% dos casos</b> (pipelines, deals, leads). O OAuth abaixo só é necessário pra <b>webhook em tempo real</b> (endpoints <code>/crm/v2/*</code> do RD que não aceitam PAT).
            <br><b>Importante:</b> o app do Marketing (aba ao lado) <b>não serve</b> aqui — RD força 1 produto por app no Publisher. Precisa criar um app à parte com produto = "RD Station CRM".
          </p>
        </div>

        ${this._rdCrmOauthAssistantBullets(cfg, hasOAuth, exchangeFailed)}
        ${this._rdCrmOauthInlineCard(cfg, hasOAuth, expired, minsLeft)}
      </div>
    </div>`;
  },

  // V24.0.0 — Assistente da seção OAuth CRM em 5 passos (renderizado dentro
  // da aba CRM, depois do bloco Pipelines).
  // Passo 1 é mais detalhado que o do Marketing porque o usuário pode ter
  // confusão sobre "qual app é qual". A diferença CRÍTICA é o select "Produto".
  _rdCrmOauthAssistantBullets(cfg, hasOAuth, exchangeFailed) {
    if (App.state.rdAssistantDismissed) return '';
    const origin = window.location?.origin || 'https://leadjourney.up.railway.app';
    const step1Done = Boolean(cfg.clientId && cfg.clientSecret);
    const step2Done = step1Done && Boolean(cfg.redirectUri);
    const step3Done = step2Done && Boolean(cfg.authUrl);
    const step4Done = step3Done && Boolean(cfg.authorizationCode);
    const step5Done = hasOAuth;
    const currentStep = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : !step4Done ? 4 : !step5Done ? 5 : 0;

    return `<div class="rounded-3xl bg-white border-2 border-violet-200 shadow-md overflow-hidden">
      <div class="bg-gradient-to-r from-violet-600 to-purple-700 px-5 py-3 flex items-center justify-between text-white">
        <div class="flex items-center gap-2">
          <i data-lucide="shield-check" class="w-4 h-4"></i>
          <span class="font-black text-xs uppercase tracking-wider">Assistente CRM OAuth · 5 passos</span>
        </div>
        <button onclick="Actions.toggleRdAssistant()" class="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center text-white"><i data-lucide="x" class="w-3 h-3"></i></button>
      </div>
      <div class="p-5 space-y-3">
        ${this._rdBulletStep(1, currentStep, step1Done, 'Criar app no Publisher RD (PRODUTO = CRM)', [
          'Abra <a href="https://appstore.rdstation.com/pt-BR/publisher" target="_blank" class="underline text-violet-700 font-black">appstore.rdstation.com/pt-BR/publisher</a> e faça login',
          'Clique em <b>Criar Aplicativo</b> → escolha "Privado"',
          '<b>⚠ ATENÇÃO no select "Produto":</b> escolha <b>RD Station CRM</b> (NÃO Marketing!). Esse é o ponto que diferencia este app do que vc já tem',
          `Em <b>URLs de Callback</b>, cole exatamente: <code class="bg-slate-100 px-1 rounded">${Utils.escape(origin)}</code> (sem barra no final)`,
          'Salve e avance até <b>Credenciais do App</b>',
          'Copie <b>Client ID</b> e <b>Client Secret</b> e cole abaixo nos campos correspondentes'
        ])}
        ${this._rdBulletStep(2, currentStep, step2Done, 'Confirmar Redirect URI no Journey', [
          `Cole no campo <b>Redirect URI</b> a mesma URL que vc colou no RD: <code class="bg-slate-100 px-1 rounded">${Utils.escape(origin)}</code>`,
          'Importante: deve ser <b>idêntica</b> ao que está no RD. Espaço, barra extra, http vs https — tudo conta',
          'Se vc tiver dúvida, abra o app no Publisher e <b>copie literalmente</b> o valor do campo Callback'
        ])}
        ${this._rdBulletStep(3, currentStep, step3Done, 'Gerar URL OAuth', [
          'Clique em <b>1) Gerar URL OAuth</b> no card abaixo',
          'Aparece um textarea com a URL completa (algo como <code>api.rd.services/auth/dialog?client_id=...</code>)',
          'Se der erro "Client ID ausente" → volte ao Passo 1'
        ])}
        ${this._rdBulletStep(4, currentStep, step4Done, 'Autorizar no RD e copiar o code', [
          'Clique em <b>2) Abrir URL</b>',
          'Você é redirecionado pro RD CRM. Faça login (se ainda não estiver logado)',
          'RD pergunta se você autoriza o app a acessar seu CRM → clique <b>Autorizar</b>',
          'Depois, o RD redireciona pro Journey com <code>?code=ABC123</code> na URL',
          'Copie SÓ a parte depois de <code>code=</code> (sem <code>&state=</code> se aparecer)',
          'Cole no campo <b>Authorization Code</b> abaixo'
        ])}
        ${this._rdBulletStep(5, currentStep, step5Done, 'Trocar code por token', [
          'Clique em <b>3) Trocar code por token</b>',
          'Se der certo: chip vira <b>conectado</b> e o card de Webhook logo abaixo libera o botão "Cadastrar webhooks"',
          exchangeFailed ? '⚠ Erro no último try — veja a mensagem em vermelho abaixo e refaça do Passo 4' : 'O token expira em ~24h; o Journey renova automático se vc tiver atividade'
        ])}
      </div>
    </div>`;
  },

  // V24.0.0 — Card inline com os campos OAuth CRM (mesmo padrão do Marketing
  // mas separado, usando Actions próprias).
  _rdCrmOauthInlineCard(cfg, hasOAuth, expired, minsLeft) {
    const fields = [
      ['clientId','Client ID','Client ID do app RD CRM','text'],
      ['clientSecret','Client Secret','Client Secret do app','password'],
      ['redirectUri','Redirect URI (cole IGUAL ao que está no RD app — com ou sem / final)','https://seu-dominio.up.railway.app','text'],
      ['authorizationCode','Authorization Code','Code retornado após autorizar','text']
    ];
    const status = cfg.status || 'not_configured';

    return `<div class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 rounded-2xl ${hasOAuth ? (expired ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-200'} grid place-items-center ${hasOAuth ? 'text-white' : 'text-slate-500'}"><i data-lucide="shield-check" class="w-5 h-5"></i></div>
        <div class="flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="font-black text-slate-900">RD CRM OAuth</h3>
            ${hasOAuth ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-black ${expired ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'}">${expired ? 'expirado' : 'conectado'}</span>` : ''}
          </div>
          <p class="text-[11px] text-slate-500">${hasOAuth ? (expired ? `Token expirou há ${Math.abs(minsLeft || 0)} min · clique pra renovar` : `Token ativo · expira em ${minsLeft || '?'} min`) : 'Preencha os 4 campos abaixo e siga os botões em ordem'}</p>
        </div>
      </div>

      <div class="grid md:grid-cols-2 gap-3 mb-4">
        ${fields.map(([f, l, p, t]) => `
          <div>
            <label class="text-[10px] font-black text-slate-500 uppercase tracking-wide">${l}</label>
            <input type="${t}" value="${Utils.escape(cfg[f] || '')}"
              oninput="Actions.updateRdCrmOauthField('${f}', this.value)"
              placeholder="${Utils.escape(p)}"
              class="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm" />
          </div>
        `).join('')}
      </div>

      <div class="flex flex-wrap gap-2">
        <button onclick="Actions.generateRdCrmOauthUrl()" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black lj-dark-button" style="color:#fff!important;">1) Gerar URL OAuth</button>
        <button onclick="Actions.openRdCrmOauthUrl()" class="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-black" style="color:#fff!important;">2) Abrir URL</button>
        <button onclick="Actions.exchangeRdCrmOauthCode()" class="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black" style="color:#fff!important;">3) Trocar code por token</button>
        ${hasOAuth ? `<button onclick="Actions.refreshRdCrmOauthToken()" class="px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-black" style="color:#fff!important;">Renovar token</button>` : ''}
        ${(cfg.clientId || cfg.accessToken) ? `<button onclick="Actions.clearRdCrmOauth()" class="px-4 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-xs font-black">Limpar CRM OAuth</button>` : ''}
      </div>

      ${cfg.authUrl ? `<div class="mt-3 rounded-xl bg-slate-950 p-3">
        <p class="text-[10px] text-slate-400 font-black mb-1">URL OAuth gerada</p>
        <textarea readonly class="w-full min-h-[60px] rounded bg-slate-900 border border-white/10 text-violet-100 text-[10px] p-2 font-mono">${Utils.escape(cfg.authUrl)}</textarea>
        <p class="text-[10px] text-slate-400 mt-1">Após autorizar, copie o valor depois de <b>?code=</b> e cole em Authorization Code acima.</p>
      </div>` : ''}

      ${status === 'exchange_failed' ? `
        <div class="mt-3 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-800">
          <p class="font-black mb-1">Última troca falhou</p>
          <p>Causas comuns: code já usado (one-shot), Redirect URI diferente do RD, Client Secret errado, ou o app foi criado com produto Marketing em vez de CRM. Verifique e tente de novo.</p>
        </div>
      ` : ''}

      ${hasOAuth ? `
        <div class="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
          <p class="font-black mb-1">✓ Pronto pra usar</p>
          <p>Vá pro card <b>"Webhook em tempo real"</b> logo abaixo e clique em <b>Cadastrar webhooks</b>. O Journey vai usar este token pra cadastrar os webhooks no RD CRM.</p>
        </div>
      ` : ''}
    </div>`;
  },

  // V24.0.0 — Painel de configuração do webhook RD CRM.
  //
  // EVIDÊNCIA DE DESIGN:
  // O RD não tem UI nativa pra cadastrar webhook (testamos clicar em
  // Integrações → Webhooks no painel CRM e ele redireciona pros docs da API).
  // Cadastro é via POST /crm/v2/webhooks com OAuth Bearer. Então o Journey
  // cadastra os webhooks pelo user, um por event_name (RD não aceita array).
  //
  // Pré-requisito: user precisa ter OAuth conectado (do Marketing). Se o app
  // OAuth não tiver scope CRM, a chamada falha com 401/403 e a UI mostra erro
  // claro com instrução pra corrigir no Publisher.
  _rdCrmWebhookBlock(rdCfg) {
    const origin = (typeof window !== 'undefined' && window.location?.origin) || 'https://leadjourney.up.railway.app';
    const webhookUrl = `${origin}/api/rd-webhook`;
    // V24.0.0 — Gate em crmOauth.accessToken (app OAuth do CRM, aba "CRM OAuth").
    // O Marketing OAuth (rd.accessToken) não tem scope CRM, não serve aqui.
    const hasOAuth = Boolean(rdCfg.crmOauth?.accessToken);
    const registered = Array.isArray(App.state.rdWebhooks) ? App.state.rdWebhooks : [];
    const totalDesired = (Actions._RD_WEBHOOK_EVENTS || []).length;
    const registeredCount = registered.length;
    const lastFetched = App.state.rdWebhookLastFetchedAt || '';
    const ageMinutes = lastFetched ? Math.round((Date.now() - new Date(lastFetched).getTime()) / 60000) : null;
    const isLive = ageMinutes !== null && ageMinutes < 30;
    const lastError = App.state.rdWebhookRegistrationError || '';

    const allRegistered = registeredCount === totalDesired;
    const statusChip = !hasOAuth
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-700">OAuth necessário</span>'
      : allRegistered && isLive
        ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-200 text-emerald-900">ativo · recebendo eventos</span>'
        : allRegistered
          ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-200 text-sky-900">cadastrado · aguardando evento</span>'
          : registeredCount > 0
            ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-900">${registeredCount}/${totalDesired} eventos</span>`
            : '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-700">não cadastrado</span>';

    return `<div class="rounded-3xl bg-white border-2 border-violet-200 shadow-md overflow-hidden">
      <div class="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-3 flex items-center justify-between text-white">
        <div class="flex items-center gap-2">
          <i data-lucide="webhook" class="w-4 h-4"></i>
          <span class="font-black text-xs uppercase tracking-wider">Webhook em tempo real</span>
          ${statusChip}
        </div>
        <span class="text-[10px] text-white/70 font-black">cadastro automático via API · opcional mas recomendado</span>
      </div>

      <div class="p-5 space-y-4">
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3 flex items-start gap-2">
          <i data-lucide="info" class="w-4 h-4 text-slate-500 mt-0.5"></i>
          <p class="text-xs text-slate-600 leading-relaxed">
            Sem webhook, o Journey só descobre mudanças no RD a cada 5 min (polling). Com webhook, eventos chegam <b>na hora</b>. O RD não tem tela pra cadastrar webhook — é só via API. O Journey faz o cadastro pra você usando o OAuth conectado.
          </p>
        </div>

        ${!hasOAuth ? `
          <div class="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
            <i data-lucide="lock" class="w-5 h-5 text-amber-700 mt-0.5"></i>
            <div class="flex-1">
              <h4 class="font-black text-amber-900 mb-1">OAuth CRM necessário para cadastrar webhook</h4>
              <p class="text-xs text-amber-800">Conecte o OAuth CRM na seção <b>"OAuth CRM avançado"</b> logo acima (card violeta). Sem ele, o RD não autoriza o cadastro de webhooks via API.</p>
            </div>
          </div>
        ` : `
          <div class="rounded-2xl bg-slate-50 border border-slate-200 p-4">
            <div class="flex items-center justify-between gap-3 mb-3 flex-wrap">
              <div class="min-w-0">
                <h4 class="font-black text-slate-900 text-sm">Eventos que o Journey vai ouvir</h4>
                <p class="text-[11px] text-slate-500">${registeredCount}/${totalDesired} cadastrado(s) · URL alvo: <code class="text-slate-700">${Utils.escape(webhookUrl)}</code></p>
                ${(() => {
                  // V31.2.52 — Timestamp da última verificação contra o RD.
                  const lastSync = App.state.rdWebhooksLastSyncAt;
                  if (!lastSync) return '';
                  const ageMin = Math.max(1, Math.round((Date.now() - new Date(lastSync).getTime()) / 60000));
                  const stale = ageMin > 30;
                  return `<p class="text-[10px] ${stale ? 'text-amber-700' : 'text-slate-400'} mt-0.5">${stale ? '⚠ ' : '✓ '}Última verificação no RD: há ${ageMin} min${stale ? ' (stale)' : ''}</p>`;
                })()}
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button onclick="Actions.syncRdWebhooksWithRd()" title="Sincroniza state local com RD: pula divergências automaticamente" class="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-black flex items-center gap-1.5">
                  <i data-lucide="git-compare" class="w-3.5 h-3.5"></i>
                  Sincronizar
                </button>
                <button onclick="Actions.registerRdWebhooks()" class="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black flex items-center gap-1.5" style="color:#fff;">
                  <i data-lucide="${allRegistered ? 'refresh-cw' : 'plus'}" class="w-3.5 h-3.5"></i>
                  ${allRegistered ? 'Re-verificar' : registeredCount > 0 ? `Cadastrar ${totalDesired - registeredCount} faltantes` : 'Cadastrar webhooks'}
                </button>
              </div>
            </div>

            ${registered.length > 0 ? `
              <div class="space-y-1.5 max-h-48 overflow-y-auto">
                ${registered.map(w => `
                  <div class="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                      <code class="text-[11px] text-slate-800 truncate">${Utils.escape(w.eventName)}</code>
                    </div>
                    <button onclick="Actions.deleteRdWebhook('${Utils.escape(w.id)}')" class="text-[10px] text-red-600 hover:text-red-700 font-black flex items-center gap-1 shrink-0">
                      <i data-lucide="x" class="w-3 h-3"></i> Desativar
                    </button>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            ${(Actions._RD_WEBHOOK_EVENTS || []).filter(ev => !registered.some(r => r.eventName === ev)).length > 0 ? `
              <details class="mt-3">
                <summary class="cursor-pointer text-[11px] text-slate-500 font-black underline">Eventos não cadastrados</summary>
                <div class="mt-2 flex flex-wrap gap-1">
                  ${(Actions._RD_WEBHOOK_EVENTS || []).filter(ev => !registered.some(r => r.eventName === ev)).map(ev =>
                    `<span class="px-2 py-1 rounded-full bg-slate-200 text-slate-600 text-[10px] font-mono">${Utils.escape(ev)}</span>`
                  ).join('')}
                </div>
              </details>
            ` : ''}
          </div>
        `}

        ${lastError ? `
          <div class="rounded-2xl bg-red-50 border border-red-200 p-3 flex items-start gap-2">
            <i data-lucide="alert-triangle" class="w-4 h-4 text-red-600 mt-0.5"></i>
            <div class="text-xs text-red-800">
              <p class="font-black mb-1">Erro no último cadastro:</p>
              <code class="text-[11px] block break-all">${Utils.escape(lastError)}</code>
              <p class="mt-2 text-[11px]">Se o erro for <b>401/403</b>, o app OAuth CRM não tem permissão. Verifique se foi criado no Publisher com produto <b>RD Station CRM</b> (não Marketing). Use a seção "OAuth CRM avançado" acima pra reconectar.</p>
            </div>
          </div>
        ` : ''}

        ${hasOAuth ? `
          <details class="text-[11px]">
            <summary class="cursor-pointer text-slate-500 font-black">Cadastro manual (fallback via curl)</summary>
            <div class="mt-2 space-y-2">
              <p class="text-slate-600">Se o cadastro automático falhar, copie a URL abaixo e rode um curl no terminal com seu accessToken:</p>
              <div class="flex items-center gap-2 p-2 rounded-lg bg-slate-950 font-mono text-[10px] text-violet-200">
                <span class="flex-1 break-all">${Utils.escape(webhookUrl)}</span>
                <button onclick="Actions.copyWebhookUrl()" class="px-2 py-1 rounded bg-violet-600 hover:bg-violet-700 text-white" style="color:#fff;">Copiar</button>
              </div>
              <pre class="rounded-lg bg-slate-950 text-violet-100 text-[10px] p-3 overflow-x-auto">curl -X POST https://api.rd.services/crm/v2/webhooks \\
  -H "Authorization: Bearer SEU_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"data":{"name":"LeadJourney","url":"${Utils.escape(webhookUrl)}","event_name":"deal_won","http_method":"POST"}}'</pre>
            </div>
          </details>
        ` : ''}

        <div class="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div class="text-[11px] text-slate-500">
            <span class="font-black">Endpoint local:</span> <code class="text-slate-700">/api/rd-webhook</code> · buffer 500 eventos · HMAC opcional via <code>RD_WEBHOOK_SECRET</code>
          </div>
          <button onclick="Actions.syncRdCrmNow()" class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black flex items-center gap-1.5 lj-dark-button" style="color:#fff;">
            <i data-lucide="refresh-cw" class="w-3 h-3"></i> Puxar agora
          </button>
        </div>
      </div>
    </div>`;
  },

  // V23.1.0 — Assistente CRM em bullets, 3 passos.
  _rdCrmAssistantBullets(rdCfg, crmCfg, hasToken, isValidated) {
    if (App.state.rdAssistantDismissed) return '';
    const campaigns = Array.isArray(App.state.campaigns) ? App.state.campaigns : [];
    const eligibles = campaigns.filter(c => window.RdCrmSyncEngine?._shouldSyncCampaign?.(c));
    const byCampaign = crmCfg.pipelinesByCampaign || {};
    const provisioned = eligibles.filter(c => Boolean(byCampaign[c.id]));
    const pending = eligibles.filter(c => !byCampaign[c.id]);
    const step1Done = hasToken;
    const step2Done = isValidated;
    const step3Done = step2Done && eligibles.length > 0 && pending.length === 0;
    const currentStep = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : 0;
    return `<div class="rounded-3xl bg-white border-2 border-sky-200 shadow-md overflow-hidden">
      <div class="bg-gradient-to-r from-sky-600 to-indigo-600 px-5 py-3 flex items-center justify-between text-white">
        <div class="flex items-center gap-2">
          <i data-lucide="sparkles" class="w-4 h-4"></i>
          <span class="font-black text-xs uppercase tracking-wider">Assistente CRM · 3 passos</span>
        </div>
        <button onclick="Actions.toggleRdAssistant()" class="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center text-white"><i data-lucide="x" class="w-3 h-3"></i></button>
      </div>
      <div class="p-5 space-y-3">
        ${this._rdBulletStep(1, currentStep, step1Done, 'Gerar Token no RD CRM', [
          'Abra <a href="https://crm.rdstation.com" target="_blank" class="underline text-sky-700 font-black">crm.rdstation.com</a> e faça login',
          'Topo direito → <b>seta ▾</b> ao lado do avatar → <b>Perfil</b>',
          'Na página de Perfil, role até a seção <b>Token de API</b>',
          'Clique <b>Gerar token</b> e copie (só aparece 1 vez)',
          'Cole abaixo no campo <b>Token pessoal do CRM ↓</b>'
        ])}
        ${this._rdBulletStep(2, currentStep, step2Done, 'Validar conexão', [
          'Clique em <b>Testar conexão</b> no card abaixo',
          'Espera o RD retornar 200 OK',
          'Se falhar com 401: token revogado/inválido — gere outro no Passo 1'
        ])}
        ${this._rdBulletStep(3, currentStep, step3Done, eligibles.length === 0 ? 'Criar uma campanha primeiro' : `Provisionar pipelines (${pending.length} pendente${pending.length === 1 ? '' : 's'})`, eligibles.length === 0 ? [
          'Vá em <b>Menu → Campanhas</b> e crie uma campanha',
          'Adicione pelo menos 1 ação OU vincule 1 lead pra ela ser elegível',
          'Volte aqui e o Passo 3 fica disponível'
        ] : [
          `${eligibles.length} campanha(s) elegível(eis) detectada(s)`,
          'Use o card <b>"Pipelines por campanha"</b> abaixo',
          'Clique <b>"Sincronizar todas"</b> ou <b>"Provisionar"</b> individual',
          'Cada campanha vira pipeline com 9 etapas no RD CRM'
        ])}
      </div>
    </div>`;
  },

  // V23.1.0 — Conteúdo da aba Marketing (com assistente próprio e opção de pular).
  _rdMarketingTabContent(rdCfg) {
    const hasOAuth = Boolean(rdCfg.accessToken);
    const skipped = Boolean(App.state.rdMarketingSkipped);

    if (skipped) {
      return `<div class="space-y-4">
        <div class="rounded-3xl bg-slate-50 border border-slate-200 p-5 flex items-start gap-3">
          <i data-lucide="skip-forward" class="w-5 h-5 text-slate-600 mt-0.5"></i>
          <div class="flex-1">
            <h4 class="font-black text-slate-900 mb-1">RD Marketing está pulado</h4>
            <p class="text-sm text-slate-600 mb-3">Você optou por não conectar o módulo Marketing. O CRM continua funcionando normalmente. Mude de ideia quando precisar de features de e-mail (KPIs, tracking, sync de contatos).</p>
            <button onclick="Actions.unskipMarketingOAuth()" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black flex items-center gap-1.5 lj-dark-button" style="color:#fff;"><i data-lucide="undo-2" class="w-3.5 h-3.5"></i>Retomar conexão Marketing</button>
          </div>
        </div>
      </div>`;
    }

    return `<div class="space-y-5">
      <div class="rounded-2xl bg-slate-50 border border-slate-100 p-3 flex items-start justify-between gap-3">
        <div class="flex items-start gap-2 text-xs text-slate-600">
          <i data-lucide="info" class="w-4 h-4 text-slate-500 mt-0.5"></i>
          <span><b>Opcional.</b> Conecte se for usar features de e-mail (KPIs, tracking, sync de contatos). Se não, pule sem culpa.</span>
        </div>
        <button onclick="Actions.skipMarketingOAuth()" class="px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 text-xs font-black hover:bg-slate-50 shrink-0">Pular Marketing</button>
      </div>
      ${this._rdMarketingAssistantBullets(rdCfg, hasOAuth)}
      ${this._rdMarketingOAuthInlineCard(rdCfg, hasOAuth)}
    </div>`;
  },

  // V23.1.0 — Assistente Marketing em bullets, 4 passos.
  _rdMarketingAssistantBullets(rdCfg, hasOAuth) {
    if (App.state.rdAssistantDismissed) return '';
    const origin = window.location.origin || 'https://leadjourney.up.railway.app';
    const step1Done = Boolean(rdCfg.clientId && rdCfg.clientSecret);
    const step2Done = step1Done && Boolean(rdCfg.authUrl);
    const step3Done = step2Done && Boolean(rdCfg.authorizationCode);
    const step4Done = hasOAuth;
    const currentStep = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : !step4Done ? 4 : 0;
    const exchangeFailed = rdCfg.status === 'exchange_failed';

    if (step4Done) {
      return `<div class="rounded-3xl bg-emerald-50 border-2 border-emerald-200 p-5 flex items-start gap-3">
        <i data-lucide="check-check" class="w-5 h-5 text-emerald-600 mt-0.5"></i>
        <div>
          <h4 class="font-black text-emerald-900">Marketing conectado</h4>
          <p class="text-sm text-emerald-800">access_token e refresh_token salvos. Token renova automático a cada 24h.</p>
        </div>
      </div>`;
    }

    return `<div class="rounded-3xl bg-white border-2 border-sky-200 shadow-md overflow-hidden">
      <div class="bg-gradient-to-r from-sky-600 to-indigo-600 px-5 py-3 flex items-center justify-between text-white">
        <div class="flex items-center gap-2">
          <i data-lucide="sparkles" class="w-4 h-4"></i>
          <span class="font-black text-xs uppercase tracking-wider">Assistente Marketing · 4 passos</span>
        </div>
        <button onclick="Actions.toggleRdAssistant()" class="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center text-white"><i data-lucide="x" class="w-3 h-3"></i></button>
      </div>
      <div class="p-5 space-y-3">
        ${this._rdBulletStep(1, currentStep, step1Done, 'Criar app no Publisher RD', [
          'Abra <a href="https://appstore.rdstation.com/pt-BR/publisher" target="_blank" class="underline text-sky-700 font-black">appstore.rdstation.com/publisher</a>',
          'Clique <b>Criar app</b> → Nome livre, Tipo <b>Privado</b>',
          'Produto: <b class="text-red-700">⚠ RD Station Marketing</b> (NÃO CRM — erro comum)',
          `URL de Callback: <code class="px-1.5 py-0.5 rounded bg-slate-100 text-[11px]">${Utils.escape(origin)}</code> <button onclick="navigator.clipboard.writeText('${Utils.escape(origin)}'); Utils.toast('URL copiada')" class="ml-1 text-sky-700 underline text-[10px]">copiar</button>`,
          'Marque <b>todas as permissões</b> disponíveis e salve',
          'Copie <b>Client ID</b> e <b>Client Secret</b> → cole nos campos abaixo'
        ])}
        ${this._rdBulletStep(2, currentStep, step2Done, 'Gerar URL OAuth', [
          'Cole Client ID + Client Secret nos campos abaixo',
          'Confira Redirect URI: igual à do app no RD',
          'Clique <b>Gerar URL OAuth</b> abaixo'
        ])}
        ${this._rdBulletStep(3, currentStep, step3Done, 'Autorizar e copiar o code', [
          'Clique <b>Abrir URL OAuth</b> — nova aba abre no RD',
          'Faça login no RD se pedir',
          'Clique <b>Autorizar / Conectar</b> na tela de consentimento',
          `RD redireciona pra <code class="text-[10px]">${Utils.escape(origin)}/?code=<b>XYZ…</b></code>`,
          'Copie SÓ o que vem depois de <code>?code=</code> (até <code>&</code> se houver)',
          '<b>NÃO atualize</b> a aba — code é one-shot, expira em 5min',
          'Cole no campo <b>Authorization Code</b> abaixo'
        ])}
        ${this._rdBulletStep(4, currentStep, step4Done, 'Trocar code por token', [
          'Clique <b>Trocar code por token</b> abaixo',
          'Aguarde — Journey troca o code via proxy interno',
          'Se aparecer ACCESS_DENIED: app criado como CRM (deve ser Marketing). Volta ao Passo 1 e recria o app',
          'Se aparecer invalid_grant: code expirou. Volta ao Passo 3'
        ])}
        ${exchangeFailed ? `<div class="mt-2 rounded-2xl bg-red-50 border border-red-200 p-3 text-xs text-red-900">
          <b>Última troca falhou.</b> Cheque se o app no RD foi criado com produto <b>Marketing</b> (não CRM). Ou clique em <b>Pular Marketing</b> acima — não bloqueia o CRM.
        </div>` : ''}
      </div>
    </div>`;
  },

  // V23.1.0 — Card inline com os campos OAuth + botões. Substitui o
  // _rdMarketingOAuthBlock que era um <details> colapsado.
  _rdMarketingOAuthInlineCard(rdCfg, hasOAuth) {
    const fields = [
      ['clientId','Client ID','Cole o Client ID do app Marketing','text'],
      ['clientSecret','Client Secret','Cole o Client Secret','password'],
      ['redirectUri','Redirect URI (cole IGUAL ao que está no RD app — com ou sem / final)','https://leadjourney.up.railway.app','text'],
      ['authorizationCode','Authorization Code','Cole o code retornado pelo RD','text'],
      ['accountName','Conta / Workspace','Rótulo da conta (opcional)','text']
    ];
    const expiresAt = rdCfg.expiresAt ? new Date(rdCfg.expiresAt) : null;
    const expired = expiresAt && expiresAt.getTime() <= Date.now();
    const minsLeft = expiresAt ? Math.round((expiresAt.getTime() - Date.now()) / 60000) : null;
    return `<div class="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm space-y-4">
      <div class="flex items-center gap-2">
        <i data-lucide="key-square" class="w-5 h-5 text-slate-700"></i>
        <h3 class="font-black text-slate-900">Credenciais OAuth</h3>
        ${hasOAuth ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-black ${expired ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'}">${expired ? 'expirado' : `token ativo · ${minsLeft} min`}</span>` : ''}
      </div>
      <div class="grid md:grid-cols-2 gap-3">
        ${fields.map(([f, l, p, t]) => this._input(f, l, p, t, rdCfg[f])).join('')}
      </div>
      <div class="flex flex-wrap gap-2 pt-1">
        <button onclick="Actions.generateRDAuthUrl()" class="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black lj-dark-button" style="color:#fff;">1) Gerar URL OAuth</button>
        <button onclick="Actions.openRDAuthUrl()" class="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black" style="color:#fff;">2) Abrir URL</button>
        <button onclick="Actions.exchangeRDAuthorizationCode()" class="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black" style="color:#fff;">3) Trocar code por token</button>
        ${hasOAuth ? `<button onclick="Actions.refreshRDAccessToken()" class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black" style="color:#fff;">Renovar token</button>` : ''}
        ${rdCfg.clientId ? `<button onclick="Actions.clearRDConfig()" class="px-4 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-xs font-black">Limpar Marketing</button>` : ''}
      </div>
      ${rdCfg.authUrl ? `<div class="rounded-xl bg-slate-950 p-3">
        <p class="text-[10px] text-slate-400 font-black mb-1">URL OAuth gerada</p>
        <textarea readonly class="w-full min-h-[60px] rounded bg-slate-900 border border-white/10 text-sky-100 text-[10px] p-2 font-mono">${Utils.escape(rdCfg.authUrl)}</textarea>
      </div>` : ''}
    </div>`;
  },

  // V23.1.0 — Renderiza UM bullet step do assistente (CRM ou Marketing).
  _rdBulletStep(n, currentStep, done, title, bullets) {
    const isActive = !done && currentStep === n;
    const iconBg = done ? 'bg-emerald-500' : isActive ? 'bg-sky-500' : 'bg-slate-200';
    const iconText = done ? 'text-white' : isActive ? 'text-white' : 'text-slate-500';
    const titleColor = done ? 'text-slate-900' : isActive ? 'text-slate-900' : 'text-slate-500';
    const bulletColor = done ? 'text-slate-600' : isActive ? 'text-slate-800' : 'text-slate-400';
    return `<div class="rounded-2xl ${isActive ? 'bg-sky-50 border-2 border-sky-200' : 'bg-slate-50 border border-slate-200'} p-4">
      <div class="flex items-start gap-3">
        <div class="w-8 h-8 rounded-full ${iconBg} grid place-items-center font-black text-sm ${iconText} shrink-0">${done ? '<i data-lucide="check" class="w-4 h-4"></i>' : n}</div>
        <div class="flex-1 min-w-0">
          <h4 class="font-black ${titleColor} mb-2">Passo ${n}: ${title}</h4>
          <ul class="space-y-1.5 ml-1">
            ${bullets.map(b => `<li class="text-xs ${bulletColor} flex items-start gap-2"><span class="mt-1 w-1 h-1 rounded-full bg-current shrink-0"></span><span>${b}</span></li>`).join('')}
          </ul>
        </div>
      </div>
    </div>`;
  },

  // V22.2 — Hero card: muda de tom conforme estado da configuração.
  // Zero state (recém-reset): card grande, escuro, com CTA forte.
  // Estado operacional: card discreto com KPIs.
  _rdHeroBlock(steps, allCore, pipelineCount, dealCount) {
    if (allCore) {
      // Estado operacional: card slim com KPIs
      return `<div class="rounded-3xl bg-gradient-to-r from-emerald-50 to-sky-50 border border-emerald-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-emerald-500 grid place-items-center text-white"><i data-lucide="check-check" class="w-6 h-6"></i></div>
          <div>
            <h3 class="font-black text-emerald-900 text-lg">RD Station conectado</h3>
            <p class="text-xs text-emerald-800">${pipelineCount} pipeline(s) ativo(s) · ${dealCount} deal(s) sincronizado(s)</p>
          </div>
        </div>
        <button onclick="Actions.runRdCrmSyncNow()" class="px-4 py-2 rounded-2xl bg-slate-900 text-white text-xs font-black flex items-center gap-2 lj-dark-button" style="color:#fff!important;"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Sincronizar agora</button>
      </div>`;
    }
    // Zero/parcial: card de onboarding
    const nextAction = !steps.step1 ? { label: 'Gerar Token CRM no painel RD', icon: 'key-round' }
      : !steps.step2 ? { label: 'Criar pipelines nas campanhas elegíveis', icon: 'git-branch' }
      : { label: 'Enviar leads ICP ao RD', icon: 'send' };
    return `<div class="rounded-3xl bg-slate-950 text-white p-6 relative overflow-hidden">
      <div class="absolute inset-y-0 right-0 w-64 opacity-20 pointer-events-none"><i data-lucide="workflow" class="w-full h-full"></i></div>
      <div class="relative">
        <p class="text-xs font-black text-sky-300 uppercase tracking-wider mb-2">Onboarding — Conexão RD Station</p>
        <h3 class="text-2xl font-black mb-2">Conecte o RD Station em 2 minutos.</h3>
        <p class="text-sm text-slate-300 max-w-xl mb-4">Sincronize pipelines, deals e leads entre o Journey e o RD CRM. Para usar o módulo de e-mail (opcional), conecte também o RD Marketing.</p>
        <div class="flex items-center gap-2 text-sm">
          <i data-lucide="${nextAction.icon}" class="w-4 h-4 text-amber-300"></i>
          <span class="font-black text-amber-200">Próximo passo:</span>
          <span>${Utils.escape(nextAction.label)}</span>
        </div>
      </div>
    </div>`;
  },

  // V22.2 — Stepper com 4 passos. Passo 4 é (opcional) e não bloqueia.
  _rdStepperBlock(steps) {
    const list = [
      { key: 'step1', n: 1, label: 'Token CRM', icon: 'key-round' },
      { key: 'step2', n: 2, label: 'Pipelines', icon: 'git-branch' },
      { key: 'step3', n: 3, label: 'Leads sincronizados', icon: 'users' },
      { key: 'step4', n: 4, label: 'RD Marketing', icon: 'mail', optional: true }
    ];
    return `<div class="rounded-3xl bg-white border border-slate-100 p-4">
      <div class="grid grid-cols-4 gap-2">
        ${list.map((s, idx) => {
          const done = steps[s.key];
          const isOptionalUndone = s.optional && !done;
          const tone = done ? 'bg-emerald-500 text-white' : isOptionalUndone ? 'bg-slate-100 text-slate-400' : 'bg-amber-100 text-amber-700';
          const textTone = done ? 'text-emerald-900' : isOptionalUndone ? 'text-slate-500' : 'text-amber-900';
          return `<div class="flex flex-col items-center text-center gap-1">
            <div class="w-9 h-9 rounded-full grid place-items-center ${tone} font-black text-sm">
              ${done ? `<i data-lucide="check" class="w-4 h-4"></i>` : `<span>${s.n}</span>`}
            </div>
            <span class="text-[11px] font-black ${textTone} leading-tight">${Utils.escape(s.label)}${s.optional ? ' <span class="opacity-60">(opcional)</span>' : ''}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  // V22.2 — Card central: input do CRM Personal Token + ações principais.
  _rdCoreCrmTokenBlock(cfg, hasCrmToken, isValidated) {
    // V22.3.2 — 3 estados visuais distintos:
    //   - sem token: amber, "obrigatório"
    //   - token salvo MAS não validado: amarelo, "aguardando teste"
    //   - token validado (status=connected): verde, "validado no RD"
    const masked = hasCrmToken ? `${cfg.crmPersonalToken.slice(0, 4)}••••${cfg.crmPersonalToken.slice(-4)}` : '';
    const stateLabel = !hasCrmToken ? 'obrigatório' : (isValidated ? 'validado no RD' : 'aguardando teste');
    const tone = !hasCrmToken ? { border: 'border-amber-300', bg: 'bg-amber-50/40', icon: 'bg-amber-500', title: 'text-amber-900', chip: 'bg-amber-200 text-amber-900', body: 'text-amber-800' }
      : isValidated ? { border: 'border-emerald-300', bg: 'bg-emerald-50/40', icon: 'bg-emerald-500', title: 'text-emerald-900', chip: 'bg-emerald-200 text-emerald-900', body: 'text-emerald-800' }
      : { border: 'border-amber-300', bg: 'bg-amber-50/40', icon: 'bg-amber-500', title: 'text-amber-900', chip: 'bg-amber-200 text-amber-900', body: 'text-amber-800' };

    return `<div class="rounded-3xl border-2 ${tone.border} ${tone.bg} p-5 shadow-sm">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded-2xl ${tone.icon} grid place-items-center text-white shrink-0"><i data-lucide="key-round" class="w-6 h-6"></i></div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <h3 class="font-black text-lg ${tone.title}">Token pessoal do CRM</h3>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${tone.chip}">${stateLabel}</span>
          </div>
          <p class="text-xs ${tone.body} mb-3 max-w-2xl">
            Esse token autoriza o Journey a criar pipelines, mover deals e ler tags no seu RD CRM. Não usa OAuth — é um token estático gerado dentro do próprio CRM.
          </p>
          <details class="text-xs mb-3 ${tone.body}">
            <summary class="cursor-pointer font-black underline">Como gerar este token (45 s)</summary>
            <ol class="mt-2 ml-4 list-decimal space-y-1">
              <li>Abra <a href="https://crm.rdstation.com" target="_blank" class="underline">crm.rdstation.com</a> e faça login.</li>
              <li>Topo direito → clique na <b>seta ▾</b> ao lado do seu avatar.</li>
              <li>No dropdown, clique em <b>Perfil</b>.</li>
              <li>Role até a seção <b>Token de API</b> e clique em <b>Gerar token</b>.</li>
              <li>Copie o valor (só aparece 1 vez) e cole abaixo.</li>
            </ol>
          </details>
          ${this._input('crmPersonalToken','','Cole o token aqui','password',cfg.crmPersonalToken)}
          ${hasCrmToken ? `<p class="text-[10px] font-mono ${isValidated ? 'text-emerald-700' : 'text-amber-700'} mt-2">Token salvo: ${Utils.escape(masked)}${isValidated ? ' · validado em ' + new Date(cfg.crmTestAt).toLocaleString('pt-BR') : ' · aguardando teste de validação'}</p>` : ''}
          <div class="flex flex-wrap gap-2 mt-3">
            <button onclick="Actions.testRDConnection()" class="px-4 py-2 rounded-xl ${hasCrmToken && !isValidated ? 'bg-sky-600 hover:bg-sky-700' : 'bg-slate-900 hover:bg-slate-800'} text-white text-xs font-black flex items-center gap-1.5 ${hasCrmToken && !isValidated ? '' : 'lj-dark-button'}" style="color:#fff!important;"><i data-lucide="activity" class="w-3.5 h-3.5"></i> ${hasCrmToken && !isValidated ? 'Testar conexão (obrigatório)' : 'Testar conexão'}</button>
            ${hasCrmToken ? `<button onclick="Actions.updateRDConfig('crmPersonalToken','')" class="px-4 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-xs font-black flex items-center gap-1.5"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Substituir token</button>` : ''}
          </div>
        </div>
      </div>
    </div>`;
  },

  // V22.2 — RD Marketing OAuth (opcional, colapsado). Não conta como bloqueio.
  _rdMarketingOAuthBlock(cfg, hasOAuth) {
    const fields = [
      ['clientId','Client ID','Client ID do app RD Marketing','text'],
      ['clientSecret','Client Secret','Client Secret do app','password'],
      ['redirectUri','Redirect URI (cole IGUAL ao que está no RD app — com ou sem / final)','https://leadjourney.up.railway.app','text'],
      ['authorizationCode','Authorization Code','Code retornado após autorizar','text'],
      ['accountName','Conta / Workspace','Rótulo da conta','text']
    ];
    const expiresAt = cfg.expiresAt ? new Date(cfg.expiresAt) : null;
    const expired = expiresAt && expiresAt.getTime() <= Date.now();
    const minsLeft = expiresAt ? Math.round((expiresAt.getTime() - Date.now()) / 60000) : null;
    return `<details class="rounded-3xl border border-slate-200 bg-white p-0 shadow-sm" ${hasOAuth && !expired ? '' : ''}>
      <summary class="cursor-pointer px-5 py-4 flex items-center justify-between gap-3 list-none">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl ${hasOAuth ? (expired ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-200'} grid place-items-center ${hasOAuth ? 'text-white' : 'text-slate-500'}"><i data-lucide="mail" class="w-5 h-5"></i></div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-black text-slate-900">RD Marketing</h3>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600">opcional</span>
              ${hasOAuth ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-black ${expired ? 'bg-amber-200 text-amber-900' : 'bg-emerald-200 text-emerald-900'}">${expired ? 'expirado' : 'conectado'}</span>` : ''}
            </div>
            <p class="text-[11px] text-slate-500">${hasOAuth ? (expired ? `Token expirou há ${Math.abs(minsLeft)} min · clique pra renovar` : `Token ativo · expira em ${minsLeft} min`) : 'Conecte para automações de e-mail no futuro · não bloqueia CRM'}</p>
          </div>
        </div>
        <i data-lucide="chevron-down" class="w-5 h-5 text-slate-400"></i>
      </summary>
      <div class="px-5 pb-5 pt-2 border-t border-slate-100">
        <p class="text-xs text-slate-500 mb-3 max-w-2xl">OAuth do RD Marketing serve para futuras integrações com e-mail, contatos e KPIs. Não é necessário para CRM. <b>Você pode ignorar este passo sem perder nada.</b></p>
        <div class="grid md:grid-cols-2 gap-3 mb-4">
          ${fields.map(([f, l, p, t]) => this._input(f, l, p, t, cfg[f])).join('')}
        </div>
        <div class="flex flex-wrap gap-2">
          <button onclick="Actions.generateRDAuthUrl()" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black lj-dark-button" style="color:#fff!important;">1) Gerar URL OAuth</button>
          <button onclick="Actions.openRDAuthUrl()" class="px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-black" style="color:#fff!important;">2) Abrir URL</button>
          <button onclick="Actions.exchangeRDAuthorizationCode()" class="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-black" style="color:#fff!important;">3) Trocar code por token</button>
          ${hasOAuth ? `<button onclick="Actions.refreshRDAccessToken()" class="px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-black" style="color:#fff!important;">Renovar token</button>` : ''}
          ${cfg.clientId ? `<button onclick="Actions.clearRDConfig()" class="px-4 py-2 rounded-xl bg-white border border-red-200 text-red-700 text-xs font-black">Limpar Marketing</button>` : ''}
        </div>
        ${cfg.authUrl ? `<div class="mt-3 rounded-xl bg-slate-950 p-3">
          <p class="text-[10px] text-slate-400 font-black mb-1">URL OAuth gerada</p>
          <textarea readonly class="w-full min-h-[60px] rounded bg-slate-900 border border-white/10 text-sky-100 text-[10px] p-2 font-mono">${Utils.escape(cfg.authUrl)}</textarea>
          <p class="text-[10px] text-slate-400 mt-1">Após autorizar, copie o valor depois de <b>?code=</b> e cole em Authorization Code.</p>
        </div>` : ''}
      </div>
    </details>`;
  },

  // V22.2 — Card de diagnóstico consolidado: logs de sync, status do Live Bridge,
  // configuração de auto-sync e log de eventos RD. Tudo dobrável.
  _rdDiagnosticsBlock(rdCfg, crmCfg, hasCrmToken, hasOAuth) {
    if (!hasCrmToken && !hasOAuth) return '';
    const lastSync = crmCfg.lastSyncAt ? new Date(crmCfg.lastSyncAt).toLocaleString('pt-BR') : '—';
    const liveLastSync = App.state.rdLastSyncAt ? new Date(App.state.rdLastSyncAt).toLocaleString('pt-BR') : '—';
    const eventCount = (App.state.rdEventLog || []).length;
    return `<details class="rounded-3xl border border-slate-200 bg-white p-0 shadow-sm">
      <summary class="cursor-pointer px-5 py-4 flex items-center justify-between gap-3 list-none">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-slate-100 grid place-items-center text-slate-700"><i data-lucide="activity" class="w-5 h-5"></i></div>
          <div>
            <h3 class="font-black text-slate-900">Diagnóstico</h3>
            <p class="text-[11px] text-slate-500">Logs de sync · Live Bridge · auto-sync · eventos RD</p>
          </div>
        </div>
        <i data-lucide="chevron-down" class="w-5 h-5 text-slate-400"></i>
      </summary>
      <div class="px-5 pb-5 pt-2 border-t border-slate-100 space-y-4">
        <div class="grid md:grid-cols-3 gap-3">
          <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
            <p class="text-[10px] font-black text-slate-500 uppercase">Último sync CRM</p>
            <p class="text-sm font-black text-slate-900 mt-1">${Utils.escape(lastSync)}</p>
          </div>
          <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
            <p class="text-[10px] font-black text-slate-500 uppercase">Live Bridge</p>
            <p class="text-sm font-black text-slate-900 mt-1">${Utils.escape(liveLastSync)}</p>
          </div>
          <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
            <p class="text-[10px] font-black text-slate-500 uppercase">Eventos RD</p>
            <p class="text-sm font-black text-slate-900 mt-1">${eventCount}</p>
          </div>
        </div>

        <div class="grid md:grid-cols-2 gap-3">
          <label class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <span>
              <span class="block text-sm font-black text-slate-900">Auto-sync a cada 5 min</span>
              <span class="block text-[11px] text-slate-500">Atualiza pipelines, deals e leads automaticamente.</span>
            </span>
            <button onclick="Actions.toggleRdCrmAutoSync()" class="relative w-12 h-7 rounded-full transition ${crmCfg.autoSync ? 'bg-emerald-500' : 'bg-slate-300'}">
              <span class="absolute top-1 ${crmCfg.autoSync ? 'right-1' : 'left-1'} w-5 h-5 rounded-full bg-white shadow"></span>
            </button>
          </label>
          <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
            <p class="text-[10px] font-black text-slate-500 uppercase">Driver de sync</p>
            <select onchange="Actions.setRdCrmAutoSyncMode(this.value)" class="mt-1 w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-bold text-sm">
              <option value="frontend" ${crmCfg.autoSyncMode === 'frontend' ? 'selected' : ''}>Aba aberta (frontend)</option>
              <option value="electron" ${crmCfg.autoSyncMode === 'electron' ? 'selected' : ''}>Desktop (Electron)</option>
              <option value="backend" ${crmCfg.autoSyncMode === 'backend' ? 'selected' : ''}>Cron externo (backend)</option>
            </select>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button onclick="Actions.runRdCrmSyncNow()" class="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black lj-dark-button" style="color:#fff!important;"><i data-lucide="refresh-cw" class="w-3.5 h-3.5 inline mr-1"></i>Sincronizar CRM agora</button>
          <button onclick="Actions.syncRdCrmNow()" class="px-4 py-2 rounded-xl bg-violet-600 text-white text-xs font-black" style="color:#fff!important;"><i data-lucide="radio-tower" class="w-3.5 h-3.5 inline mr-1"></i>Disparar Live Bridge</button>
          <button onclick="Actions.downloadStateSnapshot()" class="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-black"><i data-lucide="download" class="w-3.5 h-3.5 inline mr-1"></i>Baixar snapshot</button>
        </div>

        <div>
          <p class="text-[10px] font-black text-slate-500 uppercase mb-2">Logs recentes</p>
          <div class="rounded-2xl bg-slate-950 text-slate-200 p-3 max-h-60 overflow-auto text-[11px] font-mono space-y-1">
            ${(crmCfg.syncLogs || []).length ? (crmCfg.syncLogs || []).map(log => `<div><span class="text-slate-500">${new Date(log.at).toLocaleTimeString('pt-BR')}</span> <span class="${log.level === 'error' ? 'text-red-300' : log.level === 'warn' ? 'text-amber-300' : 'text-sky-300'}">[${log.level}]</span> ${Utils.escape(log.message)}</div>`).join('') : '<div class="text-slate-500">Sem logs ainda.</div>'}
          </div>
        </div>
      </div>
    </details>`;
  },

  // V23.0.0 — Painel de Usuários (visível apenas para master).
  usersPanel() {
    const users = App.state._usersListCache || [];
    if (!users.length) {
      // V32.0.18 — flag em App pra evitar loop quando API retorna [] (bug latente
      // se admin não tem nenhum user — improvável mas previne defesa em
      // profundidade). Padrão idêntico ao executionPanel.
      if (!App._usersListHydrated) {
        App._usersListHydrated = true;
        setTimeout(() => Actions.loadUsersList(), 50);
      }
      return `<div class="rounded-3xl bg-white border border-slate-100 p-6 shadow-sm">
        <p class="text-sm text-slate-500">Carregando lista de usuários...</p>
      </div>`;
    }
    const pending = users.filter(u => !u.is_approved);
    const active = users.filter(u => u.is_approved);

    return `<div class="space-y-5">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-2xl font-black text-slate-950">Gerenciar usuários</h3>
          <p class="text-sm text-slate-500">${pending.length} pendente(s) · ${active.length} ativo(s)</p>
        </div>
        <button onclick="Actions.loadUsersList()" class="px-4 py-2 rounded-2xl bg-slate-900 text-white text-xs font-black flex items-center gap-1.5 lj-dark-button" style="color:#fff;"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Atualizar</button>
      </div>

      ${pending.length > 0 ? `<div class="rounded-3xl bg-amber-50 border-2 border-amber-200 p-5">
        <h4 class="font-black text-amber-900 mb-3 flex items-center gap-2"><i data-lucide="clock" class="w-4 h-4"></i>Pendentes de aprovação (${pending.length})</h4>
        <div class="space-y-2">
          ${pending.map(u => this._userRow(u, true)).join('')}
        </div>
      </div>` : ''}

      <div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
        <h4 class="font-black text-slate-900 mb-3 flex items-center gap-2"><i data-lucide="users" class="w-4 h-4"></i>Usuários ativos (${active.length})</h4>
        <div class="space-y-2">
          ${active.map(u => this._userRow(u, false)).join('')}
        </div>
      </div>
    </div>`;
  },

  _userRow(u, isPending) {
    const lastLogin = u.last_login_at ? new Date(u.last_login_at).toLocaleString('pt-BR') : 'nunca';
    const created = u.created_at ? new Date(u.created_at).toLocaleString('pt-BR') : '';
    const modeChip = u.mode === 'production'
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">produção</span>'
      : '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">sandbox</span>';
    const masterChip = u.is_master ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-violet-100 text-violet-900">master</span>' : '';
    return `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-3 flex items-center gap-3">
      <div class="w-9 h-9 rounded-full bg-slate-200 grid place-items-center text-slate-700 font-black text-sm shrink-0">${Utils.escape((u.username || '?').slice(0, 2).toUpperCase())}</div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-black text-sm text-slate-900 truncate">${Utils.escape(u.username)}</span>
          ${masterChip} ${modeChip}
        </div>
        <div class="text-[11px] text-slate-500">${Utils.escape(u.email || '—')} · cadastro ${created} · último login ${lastLogin}</div>
      </div>
      ${u.is_master ? '<span class="text-[11px] text-slate-500 italic">(você)</span>' : `
        <div class="flex items-center gap-2">
          ${isPending ? `
            <button onclick="Actions.approveUser(${u.id}, 'sandbox')" class="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-black">Aprovar (sandbox)</button>
            <button onclick="Actions.approveUser(${u.id}, 'production')" class="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black" style="color:#fff;">Aprovar (produção)</button>
          ` : `
            <select onchange="Actions.setUserMode(${u.id}, this.value)" class="px-2 py-1 rounded-xl bg-white border border-slate-200 text-xs font-black">
              <option value="sandbox" ${u.mode === 'sandbox' ? 'selected' : ''}>sandbox</option>
              <option value="production" ${u.mode === 'production' ? 'selected' : ''}>produção</option>
              <option value="demo" ${u.mode === 'demo' ? 'selected' : ''}>demo (read-only)</option>
            </select>
            <button onclick="Actions.revokeUser(${u.id})" class="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-black">Revogar</button>
          `}
        </div>
      `}
    </div>`;
  },

  // V22.2 — Placeholder visual quando uma seção depende de outra ainda não preenchida.
  _rdLockedHint(label, msg) {
    return `<div class="rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50/60 p-5 flex items-center gap-3 text-slate-500">
      <i data-lucide="lock" class="w-5 h-5"></i>
      <div>
        <p class="text-sm font-black text-slate-700">${Utils.escape(label)}</p>
        <p class="text-xs">${Utils.escape(msg)}</p>
      </div>
    </div>`;
  },

  // V22.3 — Detecta o passo atual da configuração baseado no state.
  // V22.3.2 — Adicionado step 'validate' (passo 1.5): força validar que
  // o token CRM funciona antes de avançar pro Passo 2 (provisionar).
  // Retorna { stage: 'crm'|'marketing'|'done', step: number|string, meta: {} }
  _rdAssistantState(rdCfg, crmCfg) {
    const hasCrmToken = Boolean((rdCfg.crmPersonalToken || '').trim());
    if (!hasCrmToken) return { stage: 'crm', step: 1 };

    // V22.3.2/V22.3.6 — Tem token mas a conexão real nunca foi testada (ou falhou).
    // Usa crmTestStatus (separado do OAuth status) para não ser sobrescrito
    // por falhas do exchange OAuth Marketing.
    const isValidated = rdCfg.crmTestStatus === 'connected' && Boolean(rdCfg.crmTestAt);
    if (!isValidated) {
      return { stage: 'crm', step: 'validate', lastStatus: rdCfg.crmTestStatus || '' };
    }

    const campaigns = Array.isArray(App.state.campaigns) ? App.state.campaigns : [];
    const eligibleCampaigns = campaigns.filter(c => window.RdCrmSyncEngine?._shouldSyncCampaign?.(c));
    const byCampaign = crmCfg.pipelinesByCampaign || {};
    const provisionedIds = new Set(Object.keys(byCampaign).map(k => Number(k)));
    const pendingPipelines = eligibleCampaigns.filter(c => !provisionedIds.has(Number(c.id)));
    if (pendingPipelines.length > 0) {
      return { stage: 'crm', step: 2, pending: pendingPipelines };
    }

    // Conta leads vinculados a campanhas com pipeline provisionado, sem deal.
    const dealsByLead = crmCfg.dealsByLead || {};
    let leadsAwaitingPush = 0;
    const pushBreakdown = [];
    for (const c of eligibleCampaigns) {
      const leads = window.LeadBaseService?.forCampaign?.(c.id) || [];
      const unsynced = leads.filter(l => {
        const key = window.LeadBaseService?.keyOf?.(l);
        if (!key) return false;
        return !dealsByLead[key]?.[c.id];
      });
      if (unsynced.length > 0) {
        leadsAwaitingPush += unsynced.length;
        pushBreakdown.push({ campaign: c, count: unsynced.length });
      }
    }
    if (leadsAwaitingPush > 0) {
      return { stage: 'crm', step: 3, leadsAwaitingPush, breakdown: pushBreakdown };
    }

    // CRM completo. Olha Marketing.
    if (rdCfg.accessToken) return { stage: 'done', step: 'done' };
    // V22.3.7 — Se usuário pulou Marketing, vai direto pra done.
    if (App.state.rdMarketingSkipped) return { stage: 'done', step: 'done' };
    if (!rdCfg.clientId || !rdCfg.clientSecret) return { stage: 'marketing', step: 'm1' };
    if (!rdCfg.authUrl) return { stage: 'marketing', step: 'm2' };
    if (!rdCfg.authorizationCode) return { stage: 'marketing', step: 'm3' };
    // V22.3.7 — Detecta falha do último exchange para mostrar mensagem
    // específica + opção de pular.
    return { stage: 'marketing', step: 'm4', lastExchangeStatus: rdCfg.status || '' };
  },

  // V22.3.1 — Assistente focado em ENSINO. Cards visuais grandes,
  // CTA principal sempre visível, instruções passo-a-passo claras.
  // Diagnóstico (status/breadcrumb) removido — fica no Stepper acima.
  _rdAssistantBlock(rdCfg, crmCfg) {
    if (App.state.rdAssistantDismissed) return '';
    const state = this._rdAssistantState(rdCfg, crmCfg);
    const origin = window.location.origin || 'https://leadjourney.up.railway.app';

    if (state.stage === 'done') return this._rdAssistantDoneCard();

    const body = state.stage === 'crm'
      ? this._rdAssistantCrmContent(state, origin)
      : this._rdAssistantMarketingContent(state, rdCfg, origin);

    return `<div class="rounded-3xl bg-white border-2 border-sky-300 shadow-md relative overflow-hidden">
      <div class="bg-gradient-to-r from-sky-600 to-indigo-600 px-6 py-3 flex items-center justify-between text-white">
        <div class="flex items-center gap-2">
          <i data-lucide="sparkles" class="w-5 h-5"></i>
          <span class="font-black text-sm uppercase tracking-wider">Assistente · te ensina a conectar</span>
        </div>
        <button onclick="Actions.toggleRdAssistant()" title="Fechar assistente" class="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center text-white"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
      </div>
      <div class="p-6">
        ${body}
      </div>
    </div>`;
  },

  // V22.3.1 — Helper: renderiza UM substep visual com circle número + texto.
  _rdAssistantSubstep(num, html) {
    return `<div class="flex items-start gap-3 py-2">
      <div class="w-7 h-7 rounded-full bg-sky-100 text-sky-900 grid place-items-center text-sm font-black shrink-0 mt-0.5">${num}</div>
      <div class="text-sm text-slate-800 leading-relaxed flex-1 min-w-0">${html}</div>
    </div>`;
  },

  // V22.3.1 — Botão CTA gigante usado no topo de cada passo.
  _rdAssistantBigButton(href, label, icon, action) {
    if (href) {
      return `<a href="${href}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm no-underline transition shadow-lg" style="color:#fff;">
        <i data-lucide="${icon}" class="w-5 h-5"></i>
        <span>${Utils.escape(label)}</span>
        <i data-lucide="arrow-right" class="w-4 h-4 ml-1"></i>
      </a>`;
    }
    return `<button onclick="${action}" class="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm transition shadow-lg" style="color:#fff;">
      <i data-lucide="${icon}" class="w-5 h-5"></i>
      <span>${Utils.escape(label)}</span>
      <i data-lucide="arrow-right" class="w-4 h-4 ml-1"></i>
    </button>`;
  },

  // V22.3.1 — Card de aviso amber (pegadinhas que descobrimos em produção).
  _rdAssistantWarning(html) {
    return `<div class="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
      <i data-lucide="alert-triangle" class="w-5 h-5 text-amber-600 mt-0.5 shrink-0"></i>
      <div class="text-sm text-amber-900 leading-relaxed">${html}</div>
    </div>`;
  },

  // V22.3.1 — Indicador "olhe ali embaixo" apontando pro próximo input.
  _rdAssistantArrowDown(text) {
    return `<div class="mt-4 rounded-2xl bg-sky-50 border-2 border-dashed border-sky-300 p-4 flex items-center gap-3 animate-pulse">
      <i data-lucide="arrow-down-circle" class="w-6 h-6 text-sky-600 shrink-0"></i>
      <div class="text-sm font-black text-sky-900">${Utils.escape(text)}</div>
    </div>`;
  },

  // V22.3.1 — Conteúdo dos passos CRM (versão pedagógica).
  _rdAssistantCrmContent(state, origin) {
    // V22.3.2 — Passo intermediário: validar que o token realmente funciona.
    if (state.step === 'validate') {
      const failed = state.lastStatus && state.lastStatus !== 'connected' && state.lastStatus !== '';
      const failedTone = failed ? 'text-red-900' : 'text-slate-950';
      return `<div>
        <p class="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">✓ Token salvo · Passo 1.5 de 3</p>
        <h3 class="text-2xl font-black ${failedTone} mb-2">Validar a conexão com o RD CRM</h3>
        <p class="text-sm text-slate-600 mb-5">Você colou um token. Antes de provisionar pipelines, vamos garantir que o RD <b>aceita</b> esse token. O teste manda uma chamada real à API do RD.</p>

        <div class="mb-5">
          ${this._rdAssistantBigButton(null, 'Testar conexão agora', 'activity', 'Actions.testRDConnection()')}
        </div>

        ${failed ? `<div class="rounded-2xl bg-red-50 border-2 border-red-200 p-4 mb-4">
          <div class="flex items-start gap-3">
            <i data-lucide="x-circle" class="w-5 h-5 text-red-600 mt-0.5 shrink-0"></i>
            <div>
              <p class="font-black text-red-900 mb-1">Último teste falhou</p>
              <p class="text-sm text-red-800">Status retornado: <code class="bg-white px-1.5 py-0.5 rounded font-mono text-[11px]">${Utils.escape(state.lastStatus)}</code>. O token pode estar errado ou expirado. Gere um novo em <b>RD CRM → Integrações</b> e cole no campo "Token pessoal do CRM" — depois clique "Testar conexão agora" de novo.</p>
            </div>
          </div>
        </div>` : ''}

        <p class="text-sm font-black text-slate-700 mb-2">O que vai acontecer ao clicar:</p>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-2 divide-y divide-slate-200">
          ${this._rdAssistantSubstep(1, 'O Journey faz um <b>GET /deal_pipelines</b> na API real do RD CRM usando seu token.')}
          ${this._rdAssistantSubstep(2, 'Se o RD aceitar (200 OK), pulamos pro Passo 2 — Provisionar pipelines.')}
          ${this._rdAssistantSubstep(3, 'Se o RD recusar (401/403), o card vira vermelho com instruções pra gerar novo token.')}
        </div>

        ${this._rdAssistantWarning('<b>Provisionar pipelines está bloqueado</b> até esse teste passar. Sem validação real, o Journey nem deixa você avançar — evita criar pipelines com token quebrado.')}
      </div>`;
    }

    if (state.step === 1) {
      return `<div>
        <p class="text-[10px] font-black text-sky-700 uppercase tracking-widest mb-1">Passo 1 de 3</p>
        <h3 class="text-2xl font-black text-slate-950 mb-2">Pegar seu Token no RD CRM</h3>
        <p class="text-sm text-slate-600 mb-5">Leva ~45 segundos. Esse token autoriza o Journey a criar pipelines, mover deals e ler tags no seu RD CRM.</p>

        <div class="mb-5">
          ${this._rdAssistantBigButton('https://crm.rdstation.com', 'Abrir RD CRM agora', 'external-link')}
        </div>

        <p class="text-sm font-black text-slate-700 mb-2">Depois de abrir, faça nessa ordem:</p>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-2 divide-y divide-slate-200">
          ${this._rdAssistantSubstep(1, 'No topo direito do RD CRM, clique na <b>seta ▾</b> ao lado do seu avatar.')}
          ${this._rdAssistantSubstep(2, 'No dropdown que abrir, clique em <b>Perfil</b>.')}
          ${this._rdAssistantSubstep(3, 'Na página de Perfil, role até a seção <b>Token de API</b>.')}
          ${this._rdAssistantSubstep(4, 'Clique em <b>Gerar token</b>.')}
          ${this._rdAssistantSubstep(5, 'Copie o valor exibido — <b>ele só aparece UMA vez</b>.')}
          ${this._rdAssistantSubstep(6, 'Volte aqui e cole abaixo, no campo <b>"Token pessoal do CRM"</b>.')}
        </div>

        ${this._rdAssistantArrowDown('Cole o token no campo abaixo ↓')}

        ${this._rdAssistantWarning('<b>Esse token NÃO é Client ID/Secret.</b> Aquele fluxo (OAuth) é só para o RD Marketing, fica colapsado mais abaixo e é OPCIONAL. Você pode ignorar.')}
      </div>`;
    }

    if (state.step === 2) {
      const list = (state.pending || []).map(c => `<div class="flex items-center justify-between gap-2 py-2.5">
        <div class="flex items-center gap-2 min-w-0">
          <i data-lucide="git-branch" class="w-4 h-4 text-slate-500 shrink-0"></i>
          <span class="text-sm font-black text-slate-900 truncate">${Utils.escape(c.name)}</span>
        </div>
        <button onclick="Actions.generateCampaignPipeline(${c.id})" class="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black flex items-center gap-1.5" style="color:#fff;">Provisionar <i data-lucide="arrow-right" class="w-3 h-3"></i></button>
      </div>`).join('');
      return `<div>
        <p class="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">✓ Token CRM autorizado · Passo 2 de 3</p>
        <h3 class="text-2xl font-black text-slate-950 mb-2">Criar pipelines no RD para suas campanhas</h3>
        <p class="text-sm text-slate-600 mb-5">Cada campanha vira um pipeline próprio no RD CRM com <b>9 etapas</b> (Mkt/Vendas/CS × TOF/MOF/BOF).</p>

        <div class="mb-5">
          ${this._rdAssistantBigButton(null, `Provisionar todas (${state.pending.length})`, 'zap', 'Actions.syncAllCampaignPipelines()')}
        </div>

        <p class="text-sm font-black text-slate-700 mb-2">Ou provisione uma de cada vez:</p>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-1 divide-y divide-slate-200">
          ${list}
        </div>

        <div class="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600 leading-relaxed">
          <b class="text-slate-900">ℹ O que acontece:</b><br>
          Pipelines existentes na sua conta RD <b>não são tocados</b> — usamos sufixo numérico se houver colisão de nome. Etapas default do RD são <b>renomeadas</b> pra Marketing TOF/MOF/BOF (não deletadas).
        </div>
      </div>`;
    }

    if (state.step === 3) {
      const list = (state.breakdown || []).map(b => `<div class="flex items-center justify-between gap-2 py-2.5">
        <div class="flex items-center gap-2 min-w-0">
          <i data-lucide="users" class="w-4 h-4 text-slate-500 shrink-0"></i>
          <div class="min-w-0">
            <span class="block text-sm font-black text-slate-900 truncate">${Utils.escape(b.campaign.name)}</span>
            <span class="block text-[11px] text-slate-500">${b.count} lead(s) prontos</span>
          </div>
        </div>
        <button onclick="Actions.pushCampaignICPToRD(${b.campaign.id})" class="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black flex items-center gap-1.5" style="color:#fff;">Enviar <i data-lucide="send" class="w-3 h-3"></i></button>
      </div>`).join('');
      return `<div>
        <p class="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">✓ Token CRM · ✓ Pipelines · Passo 3 de 3</p>
        <h3 class="text-2xl font-black text-slate-950 mb-2">Enviar leads para o RD CRM</h3>
        <p class="text-sm text-slate-600 mb-5">Cada lead vira um <b>deal</b> em Marketing TOF do pipeline da sua campanha. O valor inicial vem do Ticket Médio do produto.</p>

        <p class="text-sm font-black text-slate-700 mb-2">${state.leadsAwaitingPush} lead(s) aguardando envio:</p>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-1 divide-y divide-slate-200">
          ${list}
        </div>

        <div class="mt-4 rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600 leading-relaxed">
          <b class="text-slate-900">ℹ Depois disso:</b><br>
          Conforme o lead avança no fluxo das ações (ex: clica no link da LP), o Journey move o deal entre as etapas do pipeline RD automaticamente. Sem clique manual.
        </div>
      </div>`;
    }
    return '';
  },

  // V22.3.1 — Conteúdo dos passos Marketing (versão pedagógica).
  _rdAssistantMarketingContent(state, rdCfg, origin) {
    if (state.step === 'm1') {
      return `<div>
        <p class="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">✓ CRM completo · OAuth Marketing · Passo 1 de 4</p>
        <h3 class="text-2xl font-black text-slate-950 mb-2">Criar o app no Publisher do RD</h3>
        <p class="text-sm text-slate-600 mb-5">Este é <b>opcional</b>. Só conecte se for usar features de e-mail/marketing no Journey no futuro.</p>

        <div class="mb-5">
          ${this._rdAssistantBigButton('https://appstore.rdstation.com/pt-BR/publisher', 'Abrir Publisher RD', 'external-link')}
        </div>

        <p class="text-sm font-black text-slate-700 mb-2">No publisher, faça:</p>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-2 divide-y divide-slate-200">
          ${this._rdAssistantSubstep(1, 'Clique em <b>Criar app</b>.')}
          ${this._rdAssistantSubstep(2, 'Nome: <b>LeadJourney Marketing</b> (ou outro). Tipo: <b>Privado</b>. Produto: <b>RD Station Marketing</b>.')}
          ${this._rdAssistantSubstep(3, `URL de Callback: <code class="px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-800 font-mono text-[11px]">${Utils.escape(origin)}</code><button onclick="navigator.clipboard.writeText('${Utils.escape(origin)}'); Utils.toast('URL copiada')" class="ml-2 px-2 py-0.5 rounded bg-sky-600 text-white text-[10px] font-black" style="color:#fff;">copiar</button>`)}
          ${this._rdAssistantSubstep(4, 'Marque <b>TODAS</b> as permissões disponíveis.')}
          ${this._rdAssistantSubstep(5, 'Salve. Copie <b>Client ID</b> e <b>Client Secret</b> da próxima tela.')}
          ${this._rdAssistantSubstep(6, 'Cole eles no bloco <b>RD Marketing</b> mais abaixo nesta página (clique pra expandir).')}
        </div>

        ${this._rdAssistantWarning('A URL de Callback deve ser <b>exatamente</b> a do origin — sem barra no final, sem path. Erro mais comum: <code>invalid_redirect_uri</code>.')}
      </div>`;
    }

    if (state.step === 'm2') {
      return `<div>
        <p class="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Marketing · Passo 2 de 4</p>
        <h3 class="text-2xl font-black text-slate-950 mb-2">Gerar URL de autorização</h3>
        <p class="text-sm text-slate-600 mb-5">Você já preencheu Client ID e Secret. Vamos gerar a URL OAuth.</p>

        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3 mb-5">
          <p class="text-[10px] font-black text-slate-500 uppercase">Client ID detectado</p>
          <code class="block mt-1 font-mono text-xs text-slate-800">${Utils.escape(String(rdCfg.clientId || '').slice(0, 16))}…</code>
        </div>

        <div class="mb-3">
          ${this._rdAssistantBigButton(null, 'Gerar URL OAuth agora', 'link', 'Actions.generateRDAuthUrl()')}
        </div>

        <p class="text-xs text-slate-500">Após clicar, a URL gerada aparece no bloco RD Marketing abaixo. O próximo passo será abri-la.</p>
      </div>`;
    }

    if (state.step === 'm3') {
      return `<div>
        <p class="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Marketing · Passo 3 de 4</p>
        <h3 class="text-2xl font-black text-slate-950 mb-2">Autorizar no RD e copiar o "code"</h3>
        <p class="text-sm text-slate-600 mb-5">O RD precisa que você autorize. Depois ele devolve um <b>code temporário</b> (parecido com uma senha de uso único) que cola aqui pra fechar a conexão.</p>

        <div class="mb-5">
          ${this._rdAssistantBigButton(null, 'Abrir URL OAuth no RD', 'external-link', 'Actions.openRDAuthUrl()')}
        </div>

        <p class="text-sm font-black text-slate-700 mb-2">Quando abrir a nova aba do RD:</p>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-2 divide-y divide-slate-200">
          ${this._rdAssistantSubstep(1, 'Se pedir, faça login na sua conta RD.')}
          ${this._rdAssistantSubstep(2, 'Aparece uma tela "<b>Você autoriza o LeadJourney a acessar sua conta?</b>". Clique no botão verde/azul <b>Autorizar</b> ou <b>Conectar</b>.')}
          ${this._rdAssistantSubstep(3, `Após autorizar, o RD <b>redireciona automaticamente</b> a aba pra uma URL nossa, com o code anexado. Ela vai parecer assim na barra de endereço:<br>
            <div class="mt-2 rounded-xl bg-white border-2 border-sky-300 p-3">
              <p class="text-[10px] font-black text-slate-500 uppercase mb-1">URL que vai aparecer</p>
              <code class="block text-[11px] font-mono break-all leading-relaxed">${Utils.escape(origin)}/?code=<span class="bg-yellow-200 text-yellow-900 px-1 py-0.5 rounded">a1b2c3d4e5f6...</span></code>
              <p class="text-[10px] text-slate-500 mt-2">↑ a parte <span class="bg-yellow-200 text-yellow-900 px-1 rounded font-black">amarela</span> é o seu code. Você copia <b>só ela</b>.</p>
            </div>`)}
          ${this._rdAssistantSubstep(4, `<b>NÃO clique em nada na aba do RD ainda.</b> Faça assim pra copiar SÓ o code:
            <ol class="mt-2 ml-4 list-[lower-alpha] text-xs space-y-1.5">
              <li>Clique <b>uma vez</b> dentro da barra de endereço (URL) lá em cima.</li>
              <li>Com o mouse, <b>arraste pra selecionar</b> apenas os caracteres DEPOIS de <code>?code=</code>. Se houver um <code>&</code> no final, pare antes dele.</li>
              <li>Ou mais fácil: dê <b>Ctrl+L</b> (Windows) ou <b>⌘+L</b> (Mac) pra selecionar a URL toda. Depois recorte: dê Ctrl+C, abra o Bloco de Notas, cole, e edite tirando tudo que vem antes do código.</li>
              <li>Aperte <b>Ctrl+C</b> (Cmd+C no Mac) com o code selecionado.</li>
            </ol>`)}
          ${this._rdAssistantSubstep(5, 'Volte pra esta aba do LeadJourney. Role um pouco pra baixo até achar o bloco <b>RD Marketing ▾</b>, clique pra expandir, e cole no campo <b>Authorization Code</b> com <b>Ctrl+V</b> (Cmd+V no Mac).')}
        </div>

        <div class="mt-4 rounded-2xl bg-red-50 border border-red-200 p-4 flex items-start gap-3">
          <i data-lucide="alert-circle" class="w-5 h-5 text-red-600 mt-0.5 shrink-0"></i>
          <div class="text-sm text-red-900 leading-relaxed">
            <b>Se você atualizar (F5) a aba do RD por engano:</b> o code desaparece e o RD esquece. Volta aqui no Journey e clica em <b>"Abrir URL OAuth no RD"</b> de novo — gera um novo code limpo.
          </div>
        </div>

        ${this._rdAssistantWarning('O code <b>expira em ~5 minutos</b> e só pode ser usado uma vez. Por isso a pressa: copie e cole rapidinho. Se demorar, refaça o passo 2 (gerar URL nova).')}
      </div>`;
    }

    if (state.step === 'm4') {
      const accessDenied = state.lastExchangeStatus === 'exchange_failed';
      return `<div>
        <p class="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-1">Marketing · Passo 4 de 4 ${accessDenied ? '· falha anterior' : ''}</p>
        <h3 class="text-2xl font-black text-slate-950 mb-2">Trocar o code por um token de verdade</h3>
        <p class="text-sm text-slate-600 mb-5">Último passo. Vamos pedir ao RD pra trocar o code que você colou por um access_token + refresh_token (válido por 24h, com renovação automática).</p>

        <div class="mb-5">
          ${this._rdAssistantBigButton(null, 'Trocar code por token', 'repeat', 'Actions.exchangeRDAuthorizationCode()')}
        </div>

        ${accessDenied ? `<div class="rounded-2xl bg-red-50 border-2 border-red-200 p-4 mb-4">
          <div class="flex items-start gap-3 mb-3">
            <i data-lucide="alert-octagon" class="w-5 h-5 text-red-600 mt-0.5 shrink-0"></i>
            <div>
              <p class="font-black text-red-900 mb-1">Última troca falhou (ACCESS_DENIED)</p>
              <p class="text-sm text-red-900 leading-relaxed">A causa mais comum desse erro: o app no RD foi criado com produto <b>"RD Station CRM"</b> em vez de <b>"RD Station Marketing"</b>. OAuth Marketing exige um app marcado como Marketing.</p>
            </div>
          </div>
          <p class="text-sm font-black text-red-900 mb-2">2 jeitos de resolver:</p>
          <div class="space-y-3 ml-2">
            <div class="rounded-xl bg-white border border-red-200 p-3">
              <p class="text-sm font-black text-slate-900 mb-1">Caminho A — Criar app correto no RD <span class="text-[10px] font-black bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">~3 min</span></p>
              <p class="text-xs text-slate-600 mb-2">Você cria um app NOVO no publisher do RD, agora com produto <b>"RD Station Marketing"</b>. Copia Client ID/Secret novos, volta ao Passo 1 do assistente.</p>
              <a href="https://appstore.rdstation.com/pt-BR/publisher" target="_blank" class="inline-flex items-center gap-1.5 text-xs font-black text-sky-700 no-underline hover:underline">Abrir publisher RD <i data-lucide="external-link" class="w-3 h-3"></i></a>
            </div>
            <div class="rounded-xl bg-white border border-slate-200 p-3">
              <p class="text-sm font-black text-slate-900 mb-1">Caminho B — Pular RD Marketing por enquanto <span class="text-[10px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">recomendado</span></p>
              <p class="text-xs text-slate-600 mb-2">Marketing OAuth é <b>opcional</b>. Hoje você não usa features de e-mail no Journey. Pula e foca no CRM (que já está funcionando).</p>
              <button onclick="Actions.skipMarketingOAuth()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-black" style="color:#fff;"><i data-lucide="skip-forward" class="w-3 h-3"></i>Pular RD Marketing</button>
            </div>
          </div>
        </div>` : `<div class="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-sm text-slate-600 leading-relaxed">
          <b class="text-slate-900">Se der erro:</b> a mensagem mais comum é <code>invalid_grant</code>, que significa que o code expirou (>5min) ou já foi usado. Solução: volte ao passo 3 e gere um code novo.<br>
          <br>
          Outro erro comum é <code>ACCESS_DENIED</code> — significa que o app foi criado no RD com produto errado. Se aparecer, o assistente vai te guiar.<br>
          <br>
          <button onclick="Actions.skipMarketingOAuth()" class="text-sky-700 underline font-black text-xs">Não quero conectar Marketing agora — pular este passo</button>
        </div>`}
      </div>`;
    }
    return '';
  },

  // V22.3 — Estado final do assistente. Compacto, ainda visível mas só celebrando.
  // V22.3.7 — Mensagem adapta se o Marketing foi pulado (rdMarketingSkipped).
  _rdAssistantDoneCard() {
    const mktSkipped = Boolean(App.state.rdMarketingSkipped);
    const hasOAuth = Boolean(App.state.integrations?.rd?.accessToken);
    return `<div class="rounded-3xl bg-gradient-to-r from-emerald-50 to-sky-50 border-2 border-emerald-200 p-4 relative overflow-hidden">
      <button onclick="Actions.toggleRdAssistant()" title="Dispensar assistente" class="absolute top-3 right-3 w-8 h-8 rounded-full bg-white hover:bg-slate-50 grid place-items-center text-slate-500"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-2xl bg-emerald-500 grid place-items-center text-white"><i data-lucide="check-check" class="w-5 h-5"></i></div>
        <div class="flex-1 pr-8">
          <h4 class="font-black text-emerald-900">${hasOAuth ? 'Tudo conectado.' : 'CRM conectado e operando.'}</h4>
          <p class="text-xs text-emerald-800 mt-1">${hasOAuth
            ? 'CRM + Marketing autorizados. O Journey sincroniza pipelines, deals e leads automaticamente a cada 5 min.'
            : (mktSkipped
              ? 'CRM 100% operacional. RD Marketing foi pulado — não bloqueia nada hoje. Mudou de ideia? <button onclick="Actions.unskipMarketingOAuth()" class="underline font-black text-emerald-900">Conectar Marketing agora</button>.'
              : 'CRM 100% operacional. Você pode dispensar o assistente — voltar é sempre uma engrenagem.')}</p>
        </div>
      </div>
    </div>`;
  },

  // V21.8 — Card mostrando status do OAuth: tem accessToken? quando expira?
  _rdTokenStatusBlock(cfg) {
    const hasAccess = Boolean(cfg.accessToken);
    const hasRefresh = Boolean(cfg.refreshToken);
    const expiresAt = cfg.expiresAt ? new Date(cfg.expiresAt) : null;
    const now = Date.now();
    const expired = expiresAt && expiresAt.getTime() <= now;
    const minsLeft = expiresAt ? Math.round((expiresAt.getTime() - now) / 60000) : null;
    const tone = hasAccess && !expired ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
      : hasAccess && expired ? 'bg-amber-50 border-amber-200 text-amber-800'
      : 'bg-slate-50 border-slate-200 text-slate-600';
    const label = !hasAccess ? 'Sem token — complete o passo 3 (Trocar code por token).'
      : expired ? `Token expirado há ${Math.abs(minsLeft)} min. Clique em Renovar token.`
      : `Token ativo. Expira em ${minsLeft} min.${hasRefresh ? '' : ' (Sem refresh_token — refresh automático indisponível.)'}`;
    return `<div class="mt-4 rounded-2xl border ${tone} p-3 text-xs font-black flex items-start gap-2">
      <i data-lucide="${hasAccess && !expired ? 'shield-check' : expired ? 'clock' : 'shield-alert'}" class="w-4 h-4 mt-0.5"></i>
      <div class="flex-1">
        <div>${Utils.escape(label)}</div>
        ${hasAccess ? `<div class="font-mono text-[10px] opacity-75 mt-1 break-all">access_token: ${Utils.escape(String(cfg.accessToken).slice(0, 12))}…${Utils.escape(String(cfg.accessToken).slice(-6))}</div>` : ''}
      </div>
    </div>`;
  },

  _statusBadge() {
    const result = App.state.databaseTestResult;
    const testing = App.state.databaseTesting;
    if (testing) return `<span class="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border bg-sky-50 border-sky-200 text-sky-700 text-xs font-black"><span class="w-2 h-2 rounded-full bg-sky-500 animate-pulse"></span> Testando conexão...</span>`;
    if (!result) return `<span class="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border bg-slate-50 border-slate-200 text-slate-600 text-xs font-black"><span class="w-2 h-2 rounded-full bg-slate-400"></span> Não testado ainda</span>`;
    return result.ok
      ? `<span class="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border bg-emerald-50 border-emerald-200 text-emerald-700 text-xs font-black"><i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> Conectado</span>`
      : `<span class="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border bg-red-50 border-red-200 text-red-700 text-xs font-black"><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> Precisa de ajustes</span>`;
  },

  _environmentBanner() {
    const isDesktop = DatabaseService.isDesktop();
    const supportsPicker = DatabaseService.supportsDirectoryPicker();
    if (isDesktop) {
      return `<div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
        <div class="w-9 h-9 rounded-xl bg-white grid place-items-center"><i data-lucide="laptop" class="w-4 h-4 text-emerald-700"></i></div>
        <div>
          <p class="text-sm font-black text-emerald-900">App Desktop ativo</p>
          <p class="text-xs text-emerald-800">Você pode digitar o caminho exato da pasta (ex.: <code>D:/LeadJourneyData</code>) ou clicar em "Escolher pasta" para usar o seletor do sistema. O Electron grava direto no disco.</p>
        </div>
      </div>`;
    }
    if (supportsPicker) {
      return `<div class="rounded-2xl border border-sky-200 bg-sky-50 p-4 flex items-start gap-3">
        <div class="w-9 h-9 rounded-xl bg-white grid place-items-center"><i data-lucide="globe" class="w-4 h-4 text-sky-700"></i></div>
        <div>
          <p class="text-sm font-black text-sky-900">Modo Navegador (Chrome/Edge)</p>
          <p class="text-xs text-sky-800">No browser, você precisa clicar em "Escolher pasta no computador" para autorizar gravação. Digitar o caminho não basta — é uma regra de segurança do navegador.</p>
        </div>
      </div>`;
    }
    return `<div class="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
      <div class="w-9 h-9 rounded-xl bg-white grid place-items-center"><i data-lucide="alert-triangle" class="w-4 h-4 text-amber-700"></i></div>
      <div>
        <p class="text-sm font-black text-amber-900">Navegador sem suporte a pasta local</p>
        <p class="text-xs text-amber-800">Use Chrome ou Edge atualizado, ou rode o app desktop (Electron). O fallback no localStorage continua funcionando.</p>
      </div>
    </div>`;
  },

  _resultCard() {
    const result = App.state.databaseTestResult;
    if (!result) return '';
    const palette = result.ok
      ? { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', icon: 'check-circle-2', iconColor: 'text-emerald-700' }
      : { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', icon: 'alert-octagon', iconColor: 'text-red-700' };
    const when = result.testedAt ? new Date(result.testedAt).toLocaleString('pt-BR') : '—';
    return `<div class="rounded-2xl border ${palette.bg} ${palette.border} p-4">
      <div class="flex items-start gap-3">
        <div class="w-9 h-9 rounded-xl bg-white grid place-items-center"><i data-lucide="${palette.icon}" class="w-4 h-4 ${palette.iconColor}"></i></div>
        <div class="flex-1">
          <p class="text-sm font-black ${palette.text}">${result.ok ? 'Tudo certo!' : 'Conexão não validada'}</p>
          <p class="text-xs ${palette.text} opacity-90 mt-0.5">${Utils.escape(result.message || '')}</p>
          <p class="text-[11px] ${palette.text} opacity-70 mt-1">Testado em ${Utils.escape(when)}</p>
        </div>
      </div>
    </div>`;
  },

  _folderStatusCard(local) {
    const path = local?.folderPath || '';
    const label = local?.folderLabel || '';
    const writeAt = local?.lastFolderWriteAt ? new Date(local.lastFolderWriteAt).toLocaleString('pt-BR') : '—';
    const readAt = local?.lastFolderReadAt ? new Date(local.lastFolderReadAt).toLocaleString('pt-BR') : '—';
    const hasFolder = Boolean(path || label);
    if (!hasFolder) {
      return `<div class="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-center">
        <div class="w-10 h-10 rounded-xl bg-slate-100 grid place-items-center mx-auto mb-2"><i data-lucide="folder-x" class="w-5 h-5 text-slate-400"></i></div>
        <p class="text-sm font-black text-slate-700">Nenhuma pasta vinculada ainda</p>
        <p class="text-xs text-slate-500 mt-1">Clique em "Escolher pasta no computador" abaixo para começar.</p>
      </div>`;
    }
    return `<div class="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-xl bg-white grid place-items-center"><i data-lucide="folder-check" class="w-5 h-5 text-emerald-700"></i></div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-black text-emerald-900">Pasta vinculada</p>
          <p class="text-xs text-emerald-800 truncate">${Utils.escape(label || path)}</p>
          ${path && label && path !== label ? `<p class="text-[11px] text-emerald-700/80 truncate">${Utils.escape(path)}</p>` : ''}
          <p class="text-[11px] text-emerald-700 mt-1">Última gravação: ${Utils.escape(writeAt)} • Última leitura: ${Utils.escape(readAt)}</p>
        </div>
      </div>
    </div>`;
  },

  _localPanel(cfg) {
    const local = cfg.local || {};
    const testing = App.state.databaseTesting;
    const isDesktop = DatabaseService.isDesktop();
    const supportsPicker = DatabaseService.supportsDirectoryPicker();
    const canPickFolder = isDesktop || supportsPicker;
    const choosePathDisabled = !canPickFolder;
    const fileNameValue = local.fileName || DatabaseService.localFileName;

    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm space-y-5">
      <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-2 mb-1"><i data-lucide="hard-drive" class="w-5 h-5 text-slate-700"></i><h3 class="text-xl font-black text-slate-950">Banco Local</h3></div>
          <p class="text-sm text-slate-500 max-w-xl">3 passos para deixar o app gravando direto no seu computador. Os dados ficam offline e ao seu controle.</p>
        </div>
        ${this._statusBadge()}
      </div>

      ${this._environmentBanner()}

      <div class="grid lg:grid-cols-3 gap-3">
        ${this._stepCard(1, 'Escolha a pasta', 'Selecione onde os dados serão gravados no computador.', !!(local.folderPath || local.folderLabel))}
        ${this._stepCard(2, 'Configure (opcional)', 'Ajuste nome do arquivo, namespace e sincronização automática.', Boolean(local.fileName))}
        ${this._stepCard(3, 'Teste e salve', 'Rode o teste e clique em salvar para fixar a configuração.', Boolean(App.state.databaseTestResult?.ok))}
      </div>

      ${this._folderStatusCard(local)}

      <div class="flex flex-wrap gap-3">
        <button onclick="Actions.chooseLocalDatabaseFolder()" ${choosePathDisabled ? 'disabled' : ''} class="px-5 py-3 rounded-2xl ${choosePathDisabled ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'} font-black flex items-center gap-2 lj-dark-button" style="${choosePathDisabled ? '' : 'color:#fff!important;'}"><i data-lucide="folder-open" class="w-4 h-4"></i> Escolher pasta no computador</button>
        <button onclick="Actions.writeLocalFolderSnapshot()" class="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black hover:bg-slate-50 flex items-center gap-2"><i data-lucide="download" class="w-4 h-4"></i> Salvar snapshot agora</button>
        <button onclick="Actions.readLocalFolderSnapshot()" class="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black hover:bg-slate-50 flex items-center gap-2"><i data-lucide="upload" class="w-4 h-4"></i> Ler snapshot da pasta</button>
      </div>

      <details class="rounded-2xl border border-slate-200 bg-slate-50 p-4" ${App.state.showDatabaseTutorial ? 'open' : ''}>
        <summary class="cursor-pointer text-sm font-black text-slate-700 flex items-center gap-2" onclick="event.preventDefault(); Actions.toggleDatabaseTutorial();"><i data-lucide="sliders" class="w-4 h-4"></i> Opções avançadas (caminho, namespace, sync)</summary>
        <div class="mt-4 grid md:grid-cols-2 gap-4">
          ${this._dbInput('local.folderPath', 'Caminho da pasta (texto)', 'Ex.: D:/LeadJourneyData', 'text', local.folderPath, isDesktop ? 'Em Desktop, este valor é usado direto. No browser, serve apenas como referência — a autorização vem do botão.' : 'Em browser puro, este campo é só referência. Use o botão "Escolher pasta".')}
          ${this._dbInput('local.fileName', 'Nome do arquivo do banco', DatabaseService.localFileName, 'text', fileNameValue, 'Nome do JSON que o app criará dentro da pasta.')}
          ${this._dbInput('local.namespace', 'Namespace (fallback no navegador)', 'leadscore_local_db', 'text', local.namespace, 'Chave usada se o navegador cair no fallback de localStorage.')}
          ${this._dbToggle('local.autosync', 'Sincronização automática', local.autosync, 'Salva snapshot ao detectar alterações.')}
          ${this._dbToggle('local.browserStorageFallback', 'Fallback no navegador', local.browserStorageFallback, 'Mantém cópia no localStorage se a pasta não estiver acessível.')}
          ${this._dbSelect('local.mode', 'Modo de gravação', [{ value: 'folder', label: 'Pasta (recomendado)' }, { value: 'browser', label: 'Somente navegador' }], local.mode || 'folder')}
        </div>
      </details>

      ${this._resultCard()}

      <div class="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
        <button onclick="Actions.testDatabaseConnection()" ${testing ? 'disabled' : ''} class="px-5 py-3 rounded-2xl ${testing ? 'bg-slate-300 text-slate-600 cursor-wait' : 'bg-slate-900 hover:bg-slate-800 text-white'} font-black flex items-center gap-2 lj-dark-button" style="${testing ? '' : 'color:#fff!important;'}">
          ${testing ? '<span class="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin"></span> Testando...' : '<i data-lucide="activity" class="w-4 h-4"></i> Testar conexão'}
        </button>
        <button onclick="Actions.saveDatabaseConfig()" class="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-2"><i data-lucide="save" class="w-4 h-4"></i> Salvar configuração</button>
        <button onclick="Actions.syncDatabaseNow()" class="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black hover:bg-slate-50 flex items-center gap-2"><i data-lucide="refresh-cw" class="w-4 h-4"></i> Sincronizar agora</button>
      </div>
    </div>`;
  },

  _stepCard(number, title, hint, done) {
    const stateClass = done ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200';
    const circleClass = done ? 'bg-emerald-500 text-white' : 'bg-white border border-slate-300 text-slate-500';
    return `<div class="rounded-2xl border ${stateClass} p-3 flex items-start gap-3">
      <div class="w-8 h-8 rounded-full grid place-items-center font-black text-sm ${circleClass}">${done ? '✓' : number}</div>
      <div>
        <p class="text-sm font-black text-slate-900">${Utils.escape(title)}</p>
        <p class="text-[11px] text-slate-500">${Utils.escape(hint)}</p>
      </div>
    </div>`;
  },

  _supabasePanel(cfg) {
    const supabase = cfg.supabase || {};
    const testing = App.state.databaseTesting;
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm space-y-5">
      <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-2 mb-1"><i data-lucide="database" class="w-5 h-5 text-emerald-700"></i><h3 class="text-xl font-black text-slate-950">Supabase</h3></div>
          <p class="text-sm text-slate-500 max-w-xl">Postgres gerenciado com API REST pronta. Cole a URL do projeto e a chave anônima.</p>
        </div>
        ${this._statusBadge()}
      </div>

      <div class="grid md:grid-cols-2 gap-4">
        ${this._dbInput('supabase.url', 'Project URL', 'https://xxxxx.supabase.co', 'text', supabase.url)}
        ${this._dbInput('supabase.anonKey', 'Anon Public Key', 'eyJ...', 'password', supabase.anonKey)}
        ${this._dbInput('supabase.schema', 'Schema', 'public', 'text', supabase.schema || 'public')}
      </div>

      ${this._resultCard()}

      <div class="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
        <button onclick="Actions.testDatabaseConnection()" ${testing ? 'disabled' : ''} class="px-5 py-3 rounded-2xl ${testing ? 'bg-slate-300 text-slate-600 cursor-wait' : 'bg-slate-900 hover:bg-slate-800 text-white'} font-black flex items-center gap-2 lj-dark-button" style="${testing ? '' : 'color:#fff!important;'}">
          ${testing ? '<span class="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin"></span> Testando...' : '<i data-lucide="activity" class="w-4 h-4"></i> Testar conexão'}
        </button>
        <button onclick="Actions.saveDatabaseConfig()" class="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-2"><i data-lucide="save" class="w-4 h-4"></i> Salvar configuração</button>
      </div>
    </div>`;
  },

  _amazonPanel(cfg) {
    const amazon = cfg.amazon || {};
    const testing = App.state.databaseTesting;
    const showSqlFields = amazon.type !== 'dynamodb';
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm space-y-5">
      <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-2 mb-1"><i data-lucide="cloud" class="w-5 h-5 text-amber-700"></i><h3 class="text-xl font-black text-slate-950">Amazon (RDS / Aurora / DynamoDB)</h3></div>
          <p class="text-sm text-slate-500 max-w-xl">Front não conecta direto em RDS por segurança. Configure aqui os dados e use uma API Gateway ou Lambda como proxy.</p>
        </div>
        ${this._statusBadge()}
      </div>

      <div class="grid md:grid-cols-2 gap-4">
        <div>
          <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Tipo Amazon</label>
          <select onchange="Actions.selectAmazonDatabaseType(this.value)" class="mt-1 w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-semibold text-slate-900">
            ${DatabaseService.amazonTypes.map(type => `<option value="${type.id}" ${amazon.type === type.id ? 'selected' : ''}>${Utils.escape(type.label)}</option>`).join('')}
          </select>
        </div>
        ${this._dbInput('amazon.region', 'Região', 'sa-east-1', 'text', amazon.region)}
        ${this._dbInput('amazon.endpoint', 'Endpoint', amazon.type === 'dynamodb' ? 'opcional para DynamoDB' : 'leadscore.xxxxx.sa-east-1.rds.amazonaws.com', 'text', amazon.endpoint)}
        ${amazon.type === 'dynamodb' ? this._dbInput('amazon.tablePrefix', 'Prefixo de tabelas', 'leadscore_', 'text', amazon.tablePrefix) : ''}
        ${showSqlFields ? this._dbInput('amazon.port', 'Porta', amazon.type === 'rds-mysql' ? '3306' : '5432', 'text', amazon.port) : ''}
        ${showSqlFields ? this._dbInput('amazon.database', 'Database', 'leadscore', 'text', amazon.database) : ''}
        ${showSqlFields ? this._dbInput('amazon.username', 'Usuário', 'admin', 'text', amazon.username) : ''}
        ${showSqlFields ? this._dbInput('amazon.password', 'Senha', '', 'password', amazon.password) : ''}
        <div class="md:col-span-2">
          ${this._dbInput('amazon.apiGatewayUrl', 'API Gateway / proxy (opcional)', 'https://api.seudominio.com/db/health', 'text', amazon.apiGatewayUrl, 'Se preenchido, o teste vai bater nessa URL para validar conectividade real.')}
        </div>
      </div>

      ${this._resultCard()}

      <div class="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
        <button onclick="Actions.testDatabaseConnection()" ${testing ? 'disabled' : ''} class="px-5 py-3 rounded-2xl ${testing ? 'bg-slate-300 text-slate-600 cursor-wait' : 'bg-slate-900 hover:bg-slate-800 text-white'} font-black flex items-center gap-2 lj-dark-button" style="${testing ? '' : 'color:#fff!important;'}">
          ${testing ? '<span class="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin"></span> Testando...' : '<i data-lucide="activity" class="w-4 h-4"></i> Testar conexão'}
        </button>
        <button onclick="Actions.saveDatabaseConfig()" class="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-2"><i data-lucide="save" class="w-4 h-4"></i> Salvar configuração</button>
      </div>
    </div>`;
  },

  _providerCard(id, title, desc, icon, provider) {
    const active = provider === id;
    return `<button onclick="Actions.selectDatabaseProvider('${id}')" class="text-left rounded-3xl border p-5 transition ${active ? 'bg-slate-900 text-white border-slate-900 shadow-xl' : 'bg-white text-slate-900 border-slate-200 hover:bg-slate-50'}">
      <div class="flex items-center gap-3 mb-3">
        <i data-lucide="${icon}" class="w-5 h-5"></i>
        <h3 class="font-black">${Utils.escape(title)}</h3>
      </div>
      <p class="text-xs ${active ? 'text-slate-200' : 'text-slate-500'}">${Utils.escape(desc)}</p>
    </button>`;
  },

  _tutorialPanel(cfg) {
    const items = (window.DatabaseService && typeof DatabaseService.tutorial === 'function')
      ? DatabaseService.tutorial(cfg.provider, cfg.amazon?.type)
      : [];
    if (!items.length) return '';
    return `<details class="rounded-3xl bg-slate-900 text-white p-5" ${App.state.showDatabaseTutorial ? 'open' : ''}>
      <summary class="cursor-pointer flex items-center gap-2 font-black" onclick="event.preventDefault(); Actions.toggleDatabaseTutorial();">
        <i data-lucide="book-open" class="w-4 h-4"></i> Tutorial passo a passo para ${Utils.escape(DatabaseService.providerLabel(cfg.provider))}
      </summary>
      <ol class="mt-3 space-y-2 text-sm text-slate-200 list-decimal pl-5">${items.map(item => `<li>${Utils.escape(item)}</li>`).join('')}</ol>
    </details>`;
  },

  _railwayPanel(cfg) {
    const r = cfg.railway || {};
    const mode = r.mode === 'fields' ? 'fields' : 'url';
    const showPwd = Boolean(App.state.railwayShowPassword);
    const testing = Boolean(App.state.railwayTesting);
    const results = App.state.railwayTestResults || null;
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm space-y-5">
      <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
        <div>
          <div class="flex items-center gap-2 mb-1"><i data-lucide="train" class="w-5 h-5 text-violet-700"></i><h3 class="text-xl font-black text-slate-950">Railway Database</h3></div>
          <p class="text-sm text-slate-500 max-w-xl">Cole sua DATABASE_URL ou preencha os campos. O LeadJourney mantém fallback local — seus dados não somem.</p>
        </div>
        ${this._railwayStatusBadge(r)}
      </div>

      ${this._railwayGuide()}

      <div class="grid md:grid-cols-2 gap-3">
        ${this._dbSelect('railway.engine', 'Tipo de banco', [{value:'postgres',label:'PostgreSQL'},{value:'mysql',label:'MySQL'}], r.engine || 'postgres')}
        ${this._dbSelect('railway.environment', 'Ambiente', [{value:'production',label:'Produção'},{value:'staging',label:'Teste'},{value:'local',label:'Local'}], r.environment || 'production')}
        ${this._dbInput('railway.projectName', 'Nome do projeto Railway', 'meu-projeto', 'text', r.projectName)}
        ${this._dbInput('railway.serviceName', 'Nome do serviço Railway', 'postgres-prod', 'text', r.serviceName)}
      </div>

      <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3 flex flex-wrap gap-2">
        <button onclick="Actions.setRailwayMode('url')" class="px-3 py-2 rounded-xl text-xs font-black ${mode === 'url' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700'}" ${mode === 'url' ? 'style="color:#fff!important;"' : ''}>Usar DATABASE_URL</button>
        <button onclick="Actions.setRailwayMode('fields')" class="px-3 py-2 rounded-xl text-xs font-black ${mode === 'fields' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700'}" ${mode === 'fields' ? 'style="color:#fff!important;"' : ''}>Usar campos separados</button>
      </div>

      ${mode === 'url' ? this._railwayUrlBlock(r, showPwd) : this._railwayFieldsBlock(r, showPwd)}

      <div class="grid md:grid-cols-3 gap-3">
        ${this._dbInput('railway.schema', 'Schema', 'public', 'text', r.schema || 'public')}
        ${this._dbInput('railway.tablePrefix', 'Prefixo de tabelas', 'leadjourney_', 'text', r.tablePrefix || 'leadjourney_')}
        ${this._dbInput('railway.proxyUrl', 'Proxy HTTPS (opcional)', 'https://seu-proxy.railway.app/health', 'text', r.proxyUrl, 'Sem proxy, o teste valida só o formato. Com proxy, a sondagem é real.')}
      </div>

      <label class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-slate-200">
        <span><span class="block text-sm font-black text-slate-900">SSL obrigatório</span><span class="block text-[11px] text-slate-500">Railway exige SSL em produção. Mantenha ligado salvo orientação contrária.</span></span>
        <button onclick="Actions.updateDatabaseConfig('railway.ssl', ${!r.ssl})" class="relative w-12 h-7 rounded-full transition ${r.ssl ? 'bg-emerald-500' : 'bg-slate-300'}" aria-pressed="${Boolean(r.ssl)}">
          <span class="absolute top-1 ${r.ssl ? 'right-1' : 'left-1'} w-5 h-5 rounded-full bg-white shadow"></span>
        </button>
      </label>

      ${this._railwayTestResults(results, testing)}

      <div class="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
        <button onclick="Actions.testRailwayConnection()" ${testing ? 'disabled' : ''} class="px-5 py-3 rounded-2xl ${testing ? 'bg-slate-300 text-slate-600 cursor-wait' : 'bg-slate-900 hover:bg-slate-800 text-white'} font-black flex items-center gap-2 lj-dark-button" style="${testing ? '' : 'color:#fff!important;'}">${testing ? '<span class="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin"></span> Testando 5 vezes…' : '<i data-lucide="activity" class="w-4 h-4"></i> Testar conexão Railway'}</button>
        <button onclick="Actions.openRailwaySnapshotPrompt()" class="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black flex items-center gap-2" style="color:#fff!important;"><i data-lucide="save" class="w-4 h-4"></i> Salvar Railway como banco principal</button>
        <button onclick="Actions.generateDatabaseSnapshot('railway-manual')" class="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black hover:bg-slate-50 flex items-center gap-2"><i data-lucide="download" class="w-4 h-4"></i> Gerar snapshot agora</button>
      </div>
    </div>`;
  },

  _railwayStatusBadge(r) {
    const status = r.lastTest?.status || (r.markedAsPrimary ? 'primary' : (r.databaseUrl || r.host) ? 'configured' : 'not_configured');
    const map = {
      stable: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Estável' },
      unstable: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500', label: 'Instável' },
      critical: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500', label: 'Crítico' },
      failed: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', dot: 'bg-red-500', label: 'Erro de conexão' },
      testing: { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', dot: 'bg-sky-500', label: 'Testando' },
      primary: { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', dot: 'bg-violet-500', label: 'Banco principal' },
      configured: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', dot: 'bg-slate-400', label: 'Configurado' },
      not_configured: { bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-500', dot: 'bg-slate-300', label: 'Não configurado' }
    };
    const t = map[status] || map.not_configured;
    return `<span class="inline-flex items-center gap-2 px-3 py-2 rounded-2xl border ${t.bg} ${t.border} ${t.text} text-xs font-black"><span class="w-2 h-2 rounded-full ${t.dot}"></span>${t.label}</span>`;
  },

  _railwayGuide() {
    return `<details class="rounded-2xl bg-violet-50 border border-violet-200 p-4" open>
      <summary class="cursor-pointer text-sm font-black text-violet-900 flex items-center gap-2"><i data-lucide="book-open" class="w-4 h-4"></i> Passo a passo para conectar o Railway</summary>
      <ol class="mt-3 space-y-1.5 text-sm text-violet-900 list-decimal pl-5">
        <li>Acesse sua conta no Railway.</li>
        <li>Abra o projeto onde está seu banco.</li>
        <li>Clique no serviço de banco — PostgreSQL ou MySQL.</li>
        <li>Abra a aba <b>Variables</b> ou <b>Connect</b>.</li>
        <li>Copie a variável <code class="px-1 rounded bg-white border border-violet-200">DATABASE_URL</code>.</li>
        <li>Cole no campo DATABASE_URL aqui.</li>
        <li>Clique em <b>Testar conexão Railway</b>.</li>
        <li>O LeadJourney roda 5 testes seguidos e mostra a estabilidade.</li>
        <li>Se passou, clique em <b>Salvar Railway como banco principal</b>.</li>
        <li>O LeadJourney mantém um fallback local — seus dados não se perdem.</li>
      </ol>
    </details>`;
  },

  _railwayUrlBlock(r, showPwd) {
    const url = r.databaseUrl || '';
    const masked = showPwd ? url : (window.RailwayConnectionParser ? RailwayConnectionParser.mask(url) : url);
    return `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <label class="text-xs font-black text-slate-500 uppercase tracking-wide">DATABASE_URL</label>
        <button onclick="Actions.toggleRailwayPassword()" class="text-[11px] font-black text-slate-600 hover:text-slate-900 flex items-center gap-1"><i data-lucide="${showPwd ? 'eye-off' : 'eye'}" class="w-3 h-3"></i> ${showPwd ? 'Ocultar' : 'Mostrar'}</button>
      </div>
      <input type="${showPwd ? 'text' : 'password'}" value="${Utils.escape(url)}" oninput="Actions.updateDatabaseConfig('railway.databaseUrl', this.value, false)" placeholder="postgresql://user:password@host:port/database" class="w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-mono text-sm text-slate-900" />
      ${url && !showPwd ? `<p class="text-[11px] text-slate-500 font-mono">${Utils.escape(masked)}</p>` : ''}
      <button onclick="Actions.parseRailwayDatabaseUrl()" class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-xs"><i data-lucide="split" class="w-3 h-3 inline mr-1"></i> Extrair para campos separados</button>
    </div>`;
  },

  _railwayFieldsBlock(r, showPwd) {
    return `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
      <div class="grid md:grid-cols-2 gap-3">
        ${this._dbInput('railway.host', 'Host', 'containers-us-west-X.railway.app', 'text', r.host)}
        ${this._dbInput('railway.port', 'Porta', r.engine === 'mysql' ? '3306' : '5432', 'text', r.port)}
        ${this._dbInput('railway.database', 'Database name', 'railway', 'text', r.database)}
        ${this._dbInput('railway.username', 'Usuário', 'postgres', 'text', r.username)}
      </div>
      <div class="flex items-end gap-2">
        <div class="flex-1">${this._dbInput('railway.password', 'Senha', '', showPwd ? 'text' : 'password', r.password)}</div>
        <button onclick="Actions.toggleRailwayPassword()" class="px-3 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black text-xs whitespace-nowrap"><i data-lucide="${showPwd ? 'eye-off' : 'eye'}" class="w-3 h-3 inline mr-1"></i> ${showPwd ? 'Ocultar' : 'Mostrar'}</button>
      </div>
      <button onclick="Actions.composeRailwayDatabaseUrl()" class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-xs"><i data-lucide="link-2" class="w-3 h-3 inline mr-1"></i> Montar DATABASE_URL a partir destes campos</button>
    </div>`;
  },

  _railwayTestResults(results, testing) {
    if (testing && !results) {
      return `<div class="rounded-2xl bg-sky-50 border border-sky-200 p-4 text-sky-800 text-sm font-black flex items-center gap-2"><span class="w-3 h-3 rounded-full border-2 border-current border-r-transparent animate-spin"></span> Rodando teste 1 de 5…</div>`;
    }
    if (!results) return '';
    const rounds = results.rounds || [];
    const summary = results.summary || {};
    const summaryMap = {
      stable: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', icon: 'check-circle-2' },
      unstable: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-900', icon: 'alert-triangle' },
      critical: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', icon: 'alert-octagon' },
      failed: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', icon: 'x-octagon' }
    };
    const s = summaryMap[summary.status] || summaryMap.failed;
    return `<div class="space-y-2">
      <div class="rounded-2xl ${s.bg} border ${s.border} p-4">
        <div class="flex items-start gap-3">
          <i data-lucide="${s.icon}" class="w-5 h-5 ${s.text}"></i>
          <div class="flex-1">
            <p class="text-sm font-black ${s.text}">Estabilidade: ${summary.stability ?? 0}% · Latência média: ${summary.avgLatencyMs ?? 0}ms</p>
            <p class="text-xs ${s.text} opacity-90 mt-1">${Utils.escape(summary.message || '')}</p>
          </div>
        </div>
      </div>
      <div class="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100">
        ${rounds.map(r => `<div class="px-4 py-2.5 flex items-center justify-between text-sm">
          <span class="font-black text-slate-700">Teste ${r.round}</span>
          <span class="flex items-center gap-3">
            <span class="text-xs text-slate-500">${r.latencyMs}ms</span>
            ${r.ok ? '<span class="px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-black">sucesso</span>' : `<span class="px-2 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-[11px] font-black" title="${Utils.escape(r.message || '')}">falha</span>`}
          </span>
        </div>`).join('')}
      </div>
    </div>`;
  },

  _railwaySnapshotPrompt(cfg) {
    if (!App.state.showRailwaySnapshotPrompt) return '';
    return `<div class="fixed inset-0 z-[90] bg-slate-950/75 backdrop-blur-sm grid place-items-center p-4">
      <div class="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-md p-5">
        <div class="flex items-start gap-3 mb-3">
          <div class="w-10 h-10 rounded-2xl bg-violet-100 grid place-items-center"><i data-lucide="shield-check" class="w-5 h-5 text-violet-700"></i></div>
          <div>
            <h3 class="text-lg font-black text-slate-900">Trocar banco principal</h3>
            <p class="text-sm text-slate-500 mt-1">Antes de trocar o banco principal, recomendamos gerar um snapshot dos dados atuais. O LeadJourney não apagará seus dados locais.</p>
          </div>
        </div>
        <div class="flex flex-col gap-2 mt-4">
          <button onclick="Actions.generateDatabaseSnapshot('pre-railway-switch'); Actions.confirmRailwayAsPrimary();" class="px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm" style="color:#fff!important;">Gerar snapshot e salvar Railway</button>
          <button onclick="Actions.confirmRailwayAsPrimary()" class="px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm" style="color:#fff!important;">Continuar sem snapshot</button>
          <button onclick="Actions.cancelRailwaySnapshotPrompt()" class="px-4 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black text-sm">Cancelar</button>
        </div>
      </div>
    </div>`;
  },

  databasePanel() {
    const cfg = DatabaseService.normalize(App.state.databaseConfig);
    const provider = cfg.provider || 'local';
    const panel = provider === 'supabase' ? this._supabasePanel(cfg)
      : provider === 'amazon' ? this._amazonPanel(cfg)
      : provider === 'railway' ? this._railwayPanel(cfg)
      : this._localPanel(cfg);

    return `<div class="space-y-5">
      <div class="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        ${this._providerCard('local','Local','Banco local no seu computador. Começa imediato e fica offline.','hard-drive', provider)}
        ${this._providerCard('supabase','Supabase','Postgres gerenciado com API REST pronta para produção inicial.','database', provider)}
        ${this._providerCard('amazon','Amazon','RDS, Aurora ou DynamoDB. Preparado para escalar via backend/proxy.','cloud', provider)}
        ${this._providerCard('railway','Railway','Postgres ou MySQL no Railway. Conexão guiada por DATABASE_URL ou campos separados.','train', provider)}
      </div>
      ${panel}
      ${this._tutorialPanel(cfg)}
      ${this._railwaySnapshotPrompt(cfg)}
    </div>`;
  },

  backupPanel() {
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
      <h3 class="text-2xl font-black text-slate-950">Backup em breve</h3>
      <p class="text-sm text-slate-500 mt-2">Área reservada para backups automáticos, restauração e snapshots versionados.</p>
    </div>`;
  },

  rdCrmPanel() {
    const rd = App.state.integrations?.rd || {};
    const crm = App.state.integrations?.rdCrm || (window.RdCrmConfig ? RdCrmConfig.defaultConfig() : {});
    const oauthOk = Boolean(rd.accessToken || rd.refreshToken);
    const oauthStatus = oauthOk
      ? `<span class="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black">OAuth conectado</span>`
      : `<span class="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-black">OAuth pendente</span>`;
    const syncStatusClass = crm.lastSyncStatus === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : crm.lastSyncStatus === 'running' ? 'bg-sky-50 border-sky-200 text-sky-700'
      : crm.lastSyncStatus && crm.lastSyncStatus !== '' ? 'bg-red-50 border-red-200 text-red-700'
      : 'bg-slate-50 border-slate-200 text-slate-600';
    const lastSync = crm.lastSyncAt ? new Date(crm.lastSyncAt).toLocaleString('pt-BR') : '—';
    const nextSync = crm.autoSync && crm.lastSyncAt
      ? new Date(new Date(crm.lastSyncAt).getTime() + RdCrmConfig.autoSyncIntervalMs).toLocaleString('pt-BR')
      : (crm.autoSync ? 'Em breve' : '—');
    const stageMap = crm.stageMap || {};
    const stages = RdCrmConfig.defaultStages();

    return `<div class="space-y-5">
      ${this._rdCrmStatusBlock(oauthOk, oauthStatus, syncStatusClass, crm, lastSync, nextSync)}
      ${this._rdCrmCampaignPipelinesBlock(crm, oauthOk)}
      ${this._rdCrmLegacyPipelineBlock(crm, oauthOk, stages, stageMap)}
      ${this._rdCrmSyncBlock(crm)}
      ${this._rdCrmLiveBridgeBlock()}
      ${this._rdCrmEventLogBlock()}
      ${this._rdCrmTagsBlock()}
    </div>`;
  },

  // V21.6 — Bloco principal: 1 pipeline por campanha. Lista todas as campanhas,
  // mostra status do pipeline RD de cada uma + botão de sync individual.
  _rdCrmCampaignPipelinesBlock(crm, oauthOk) {
    const campaigns = Array.isArray(App.state.campaigns) ? App.state.campaigns : [];
    const byCampaign = crm.pipelinesByCampaign || {};
    const eligibleCount = campaigns.filter(c => window.RdCrmSyncEngine?._shouldSyncCampaign?.(c)).length;
    const syncedCount = Object.keys(byCampaign).length;
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
      <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3 mb-4">
        <div>
          <div class="flex items-center gap-2 mb-1"><i data-lucide="git-branch" class="w-5 h-5 text-sky-700"></i><h3 class="text-xl font-black text-slate-950">Pipelines por campanha</h3></div>
          <p class="text-sm text-slate-500 max-w-xl">A partir do V21.6, cada campanha tem seu próprio pipeline no RD CRM (9 etapas — Mkt/Vendas/CS × TOF/MOF/BOF). Leads não são duplicados: o mesmo contato pode estar em vários pipelines simultaneamente.</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-3 py-2 rounded-2xl border bg-slate-50 border-slate-200 text-slate-700 text-xs font-black">${syncedCount}/${campaigns.length} sincronizadas</span>
          <button onclick="Actions.syncAllCampaignPipelines()" ${!oauthOk || !eligibleCount ? 'disabled' : ''} class="px-4 py-2 rounded-2xl ${oauthOk && eligibleCount ? 'bg-sky-600 hover:bg-sky-700 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'} font-black text-xs flex items-center gap-2" ${oauthOk && eligibleCount ? 'style="color:#fff!important;"' : ''}><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Sincronizar todas (${eligibleCount} elegíveis)</button>
        </div>
      </div>
      ${campaigns.length === 0 ? `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
        Nenhuma campanha criada ainda. Crie uma campanha em <b>Menu → Campanhas</b> para liberar a sincronização.
      </div>` : `<div class="space-y-2">
        ${campaigns.map(c => this._rdCrmCampaignPipelineRow(c, byCampaign[c.id], oauthOk)).join('')}
      </div>`}
    </div>`;
  },

  _rdCrmCampaignPipelineRow(campaign, info, oauthOk) {
    const synced = Boolean(info?.pipelineId);
    const eligible = Boolean(window.RdCrmSyncEngine?._shouldSyncCampaign?.(campaign));
    const stageCount = info?.stageMap ? Object.keys(info.stageMap).length : 0;
    const lastSyncLabel = info?.lastSyncAt ? new Date(info.lastSyncAt).toLocaleString('pt-BR') : '—';
    const statusTone = info?.lastSyncStatus === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : info?.lastSyncStatus ? 'bg-red-50 border-red-200 text-red-700'
      : eligible ? 'bg-amber-50 border-amber-200 text-amber-700'
      : 'bg-slate-50 border-slate-200 text-slate-600';
    const statusLabel = synced ? `${stageCount} etapas · ${info.lastSyncStatus || 'ok'}` : (eligible ? 'pendente sync' : 'sem ações/leads');
    return `<div class="rounded-2xl border border-slate-200 bg-slate-50 p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="font-black text-slate-900 truncate">${Utils.escape(campaign.name || '(sem nome)')}</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-black border ${statusTone}">${Utils.escape(statusLabel)}</span>
        </div>
        <div class="text-[11px] text-slate-500 mt-0.5">
          ${synced ? `Pipeline RD: <b>${Utils.escape(info.pipelineName || '')}</b> · ID <code class="bg-white px-1.5 py-0.5 rounded">${Utils.escape(info.pipelineId)}</code> · último sync ${Utils.escape(lastSyncLabel)}` : 'Ainda não provisionado no RD.'}
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="Actions.syncCampaignPipeline(${campaign.id})" ${!oauthOk ? 'disabled' : ''} class="px-3 py-2 rounded-xl ${oauthOk ? 'bg-slate-900 hover:bg-slate-800 text-white lj-dark-button' : 'bg-slate-200 text-slate-500 cursor-not-allowed'} font-black text-xs flex items-center gap-1.5" ${oauthOk ? 'style="color:#fff!important;"' : ''}><i data-lucide="${synced ? 'refresh-cw' : 'zap'}" class="w-3.5 h-3.5"></i> ${synced ? 'Resincronizar' : 'Criar pipeline'}</button>
      </div>
    </div>`;
  },

  // V21.6 — Legacy global pipeline (V21.5 e anteriores) — colapsado.
  _rdCrmLegacyPipelineBlock(crm, oauthOk, stages, stageMap) {
    const hasLegacy = Boolean(crm.pipelineId);
    if (!hasLegacy) return '';
    return `<details class="rounded-3xl bg-white border border-amber-200 p-5 shadow-sm">
      <summary class="cursor-pointer flex items-center gap-2 font-black text-amber-800"><i data-lucide="archive" class="w-4 h-4"></i> Pipeline global legacy (V21.5 — desativado no V21.6)</summary>
      <div class="mt-4 space-y-3">
        <div class="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          A partir do V21.6 o Journey usa <b>1 pipeline por campanha</b>. O pipeline global abaixo permanece intacto no seu RD CRM (não é tocado pelo sync), mas <b>não recebe mais atualizações</b>. Você pode arquivá-lo no RD se quiser.
        </div>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
          <p class="text-[11px] font-black text-slate-500 uppercase">Pipeline legacy</p>
          <p class="text-sm font-black text-slate-900">${Utils.escape(crm.pipelineName || '')}</p>
          <p class="text-xs text-slate-500">ID RD: <code class="bg-white px-2 py-0.5 rounded">${Utils.escape(crm.pipelineId)}</code></p>
        </div>
        ${this._rdCrmStagesBlock(stages, stageMap)}
      </div>
    </details>`;
  },

  // V21 — Live Event Bridge: card de status + botão manual "Sincronizar agora"
  _rdCrmLiveBridgeBlock() {
    const lastSyncIso = App.state.rdLastSyncAt;
    const lastSyncLabel = lastSyncIso ? new Date(lastSyncIso).toLocaleString('pt-BR') : 'Nunca';
    const isRunning = Boolean(App.state.rdSyncRunning);
    const minsAgo = lastSyncIso ? Math.floor((Date.now() - new Date(lastSyncIso).getTime()) / 60000) : null;
    const minutesText = minsAgo === null ? 'sem sync ainda'
      : minsAgo === 0 ? 'agora mesmo'
      : `há ${minsAgo} min`;
    const tone = !lastSyncIso ? 'bg-slate-50 border-slate-200 text-slate-600'
      : (minsAgo !== null && minsAgo > 10) ? 'bg-amber-50 border-amber-200 text-amber-800'
      : 'bg-emerald-50 border-emerald-200 text-emerald-800';
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
      <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3 mb-4">
        <div>
          <div class="flex items-center gap-2 mb-1"><i data-lucide="radio-tower" class="w-5 h-5 text-violet-600"></i><h3 class="text-xl font-black text-slate-950">Live Event Bridge</h3></div>
          <p class="text-sm text-slate-500">Polling de 5 min · sync de contatos, deals, tags e estágios → base global e Revenue Score.</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="px-3 py-2 rounded-2xl border ${tone} text-xs font-black flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${isRunning ? 'bg-sky-500 animate-pulse' : 'bg-current'}"></span>
            ${isRunning ? 'Sincronizando…' : `Último sync ${minutesText}`}
          </span>
        </div>
      </div>
      <div class="grid md:grid-cols-3 gap-3 mb-4">
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-wider">Último sync</p>
          <p class="text-sm font-black text-slate-900 mt-1">${Utils.escape(lastSyncLabel)}</p>
        </div>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-wider">Intervalo</p>
          <p class="text-sm font-black text-slate-900 mt-1">5 minutos</p>
        </div>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-wider">Eventos no log</p>
          <p class="text-sm font-black text-slate-900 mt-1">${(App.state.rdEventLog || []).length}</p>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <button ${isRunning ? 'disabled' : ''} onclick="Actions.syncRdCrmNow()" class="px-5 py-3 rounded-2xl ${isRunning ? 'bg-slate-300 text-slate-600 cursor-wait' : 'bg-violet-600 hover:bg-violet-700 text-white'} font-black flex items-center gap-2" ${isRunning ? '' : 'style="color:#fff!important;"'}>
          ${isRunning ? '<span class="w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin"></span> Sincronizando...' : '<i data-lucide="refresh-cw" class="w-4 h-4"></i> Sincronizar RD agora'}
        </button>
      </div>
    </div>`;
  },

  // V21 — Log de eventos RD: collapse mostrando os últimos 30 eventos recebidos
  _rdCrmEventLogBlock() {
    const log = (App.state.rdEventLog || []).slice(-30).reverse();
    return `<details class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
      <summary class="cursor-pointer flex items-center gap-2 font-black text-slate-900"><i data-lucide="history" class="w-4 h-4 text-slate-500"></i> Log de eventos RD (${(App.state.rdEventLog || []).length} totais)</summary>
      <div class="mt-4 space-y-2 max-h-96 overflow-auto">
        ${log.length ? log.map(e => this._rdCrmEventRow(e)).join('') : '<p class="text-xs text-slate-500 italic">Sem eventos ainda. Configure o RD ou aguarde o próximo sync.</p>'}
      </div>
    </details>`;
  },

  _rdCrmEventRow(e) {
    const when = e.ts ? new Date(e.ts).toLocaleString('pt-BR') : '—';
    const typeTone = String(e.type || '').includes('won') ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
      : String(e.type || '').includes('lost') ? 'bg-red-50 border-red-200 text-red-700'
      : String(e.type || '').includes('tag') ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
      : String(e.type || '').includes('stage') ? 'bg-violet-50 border-violet-200 text-violet-700'
      : 'bg-slate-50 border-slate-200 text-slate-700';
    return `<div class="rounded-xl bg-slate-50 border border-slate-100 p-2.5 flex items-center justify-between gap-3">
      <div class="flex items-center gap-2 min-w-0">
        <span class="px-2 py-1 rounded ${typeTone} border text-[10px] font-black whitespace-nowrap">${Utils.escape(e.type || '—')}</span>
        <span class="text-[11px] text-slate-600 truncate">contato: ${Utils.escape(String(e.contactId || '—'))}</span>
      </div>
      <span class="text-[10px] text-slate-400 whitespace-nowrap">${Utils.escape(when)}</span>
    </div>`;
  },

  _rdCrmStatusBlock(oauthOk, oauthStatus, syncStatusClass, crm, lastSync, nextSync) {
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
      <div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3 mb-4">
        <div>
          <div class="flex items-center gap-2 mb-1"><i data-lucide="workflow" class="w-5 h-5 text-sky-700"></i><h3 class="text-xl font-black text-slate-950">Status da conexão</h3></div>
          <p class="text-sm text-slate-500 max-w-xl">O RD CRM compartilha o OAuth do RD Station. Conecte primeiro o RD Station na aba ao lado, depois teste aqui.</p>
        </div>
        ${oauthStatus}
      </div>
      <div class="grid md:grid-cols-3 gap-3 mb-4">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p class="text-[11px] font-black text-slate-500 uppercase">Status RD CRM</p><p class="text-sm font-black text-slate-900 mt-1">${Utils.escape(crm.lastSyncStatus || 'aguardando')}</p></div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p class="text-[11px] font-black text-slate-500 uppercase">Último sync</p><p class="text-sm font-black text-slate-900 mt-1">${Utils.escape(lastSync)}</p></div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p class="text-[11px] font-black text-slate-500 uppercase">Próximo sync</p><p class="text-sm font-black text-slate-900 mt-1">${Utils.escape(nextSync)}</p></div>
      </div>
      <div class="rounded-2xl border ${syncStatusClass} p-3 text-sm">
        <p class="font-black">${Utils.escape(crm.lastSyncMessage || 'Nenhum sync executado ainda.')}</p>
      </div>
      <div class="flex flex-wrap gap-3 mt-4">
        <button onclick="Actions.testRdCrmConnection()" ${!oauthOk ? 'disabled' : ''} class="px-5 py-3 rounded-2xl ${oauthOk ? 'bg-slate-900 hover:bg-slate-800 text-white lj-dark-button' : 'bg-slate-200 text-slate-500 cursor-not-allowed'} font-black flex items-center gap-2" ${oauthOk ? 'style="color:#fff!important;"' : ''}><i data-lucide="activity" class="w-4 h-4"></i> Testar conexão</button>
        ${!oauthOk ? `<button onclick="Actions.setSettingsSection('rd')" class="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-700 font-black flex items-center gap-2"><i data-lucide="arrow-right" class="w-4 h-4"></i> Ir para configurar OAuth RD</button>` : ''}
      </div>
    </div>`;
  },

  _rdCrmPipelineBlock(crm, oauthOk) {
    const hasPipeline = Boolean(crm.pipelineId);
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 class="text-xl font-black text-slate-950">Pipeline</h3>
          <p class="text-sm text-slate-500">Crie o pipeline padrão Journey no RD ou conecte um existente.</p>
        </div>
        ${hasPipeline ? `<span class="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black">Conectado</span>` : `<span class="px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-xs font-black">Não conectado</span>`}
      </div>
      ${hasPipeline ? `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-3 mb-4">
        <p class="text-[11px] font-black text-slate-500 uppercase">Pipeline ativo</p>
        <p class="text-sm font-black text-slate-900">${Utils.escape(crm.pipelineName || RdCrmConfig.defaultPipelineName)}</p>
        <p class="text-xs text-slate-500">ID RD: <code class="bg-white px-2 py-0.5 rounded">${Utils.escape(crm.pipelineId)}</code></p>
      </div>` : ''}
      <div class="flex flex-wrap gap-3">
        <button onclick="Actions.listRdCrmPipelines()" ${!oauthOk ? 'disabled' : ''} class="px-5 py-3 rounded-2xl ${oauthOk ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-slate-100 text-slate-400 cursor-not-allowed'} font-black flex items-center gap-2"><i data-lucide="list" class="w-4 h-4"></i> Listar pipelines RD</button>
        <button onclick="Actions.createJourneyRevenuePipeline()" ${!oauthOk ? 'disabled' : ''} class="px-5 py-3 rounded-2xl ${oauthOk ? 'bg-sky-600 hover:bg-sky-700 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'} font-black flex items-center gap-2" ${oauthOk ? 'style="color:#fff!important;"' : ''}><i data-lucide="zap" class="w-4 h-4"></i> Criar Journey Revenue Pipeline</button>
        <button onclick="Actions.listRdCrmStages()" ${(!oauthOk || !hasPipeline) ? 'disabled' : ''} class="px-5 py-3 rounded-2xl ${(oauthOk && hasPipeline) ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-slate-100 text-slate-400 cursor-not-allowed'} font-black flex items-center gap-2"><i data-lucide="layers" class="w-4 h-4"></i> Listar etapas</button>
      </div>
    </div>`;
  },

  _rdCrmStagesBlock(stages, stageMap) {
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
      <h3 class="text-xl font-black text-slate-950 mb-3">Etapas</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead><tr class="text-left text-[11px] font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
            <th class="py-2 pr-3">Etapa Journey</th>
            <th class="py-2 pr-3">Código</th>
            <th class="py-2 pr-3">ID RD</th>
            <th class="py-2 pr-3">Ordem</th>
            <th class="py-2 pr-3">Status</th>
          </tr></thead>
          <tbody>
            ${stages.map(stage => {
              const mapping = stageMap[stage.code];
              const synced = Boolean(mapping?.rdStageId);
              return `<tr class="border-b border-slate-100">
                <td class="py-2 pr-3 font-black text-slate-900">${Utils.escape(stage.label)}</td>
                <td class="py-2 pr-3"><code class="bg-slate-100 px-2 py-0.5 rounded text-xs">${stage.code}</code></td>
                <td class="py-2 pr-3 text-xs text-slate-500">${synced ? `<code class="bg-white border border-slate-200 px-2 py-0.5 rounded">${Utils.escape(mapping.rdStageId)}</code>` : '—'}</td>
                <td class="py-2 pr-3 text-slate-600">${stage.order}</td>
                <td class="py-2 pr-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-black ${synced ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">${synced ? 'sync' : 'pendente'}</span></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  },

  _rdCrmSyncBlock(crm) {
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 class="text-xl font-black text-slate-950">Sincronização</h3>
          <p class="text-sm text-slate-500">A cada 5 minutos o Journey lê o RD CRM, atualiza tags, recalcula score e refresca o dashboard.</p>
        </div>
      </div>
      <div class="grid md:grid-cols-2 gap-3 mb-4">
        <label class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200">
          <span>
            <span class="block text-sm font-black text-slate-900">Sync automático a cada 5 min</span>
            <span class="block text-[11px] text-slate-500">Roda enquanto a aba estiver aberta. Pode ser combinado com cron externo / Electron.</span>
          </span>
          <button onclick="Actions.toggleRdCrmAutoSync()" class="relative w-12 h-7 rounded-full transition ${crm.autoSync ? 'bg-emerald-500' : 'bg-slate-300'}">
            <span class="absolute top-1 ${crm.autoSync ? 'right-1' : 'left-1'} w-5 h-5 rounded-full bg-white shadow"></span>
          </button>
        </label>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
          <p class="text-[11px] font-black text-slate-500 uppercase">Driver de sync</p>
          <select onchange="Actions.setRdCrmAutoSyncMode(this.value)" class="mt-1 w-full px-3 py-2 rounded-xl bg-white border border-slate-200 font-bold text-sm">
            <option value="frontend" ${crm.autoSyncMode === 'frontend' ? 'selected' : ''}>Frontend (aba aberta)</option>
            <option value="electron" ${crm.autoSyncMode === 'electron' ? 'selected' : ''}>Electron main process</option>
            <option value="backend" ${crm.autoSyncMode === 'backend' ? 'selected' : ''}>Backend / cron externo</option>
          </select>
        </div>
      </div>
      <div class="flex flex-wrap gap-3">
        <button onclick="Actions.runRdCrmSyncNow()" class="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black flex items-center gap-2 lj-dark-button" style="color:#fff!important;"><i data-lucide="refresh-cw" class="w-4 h-4"></i> Sincronizar agora</button>
      </div>
      <div class="mt-4">
        <p class="text-[11px] font-black text-slate-500 uppercase mb-2">Logs recentes</p>
        <div class="rounded-2xl bg-slate-950 text-slate-200 p-3 max-h-60 overflow-auto text-[11px] font-mono space-y-1">
          ${(crm.syncLogs || []).length ? (crm.syncLogs || []).map(log => `<div><span class="text-slate-500">${new Date(log.at).toLocaleTimeString('pt-BR')}</span> <span class="${log.level === 'error' ? 'text-red-300' : log.level === 'warn' ? 'text-amber-300' : 'text-sky-300'}">[${log.level}]</span> ${Utils.escape(log.message)}</div>`).join('') : '<div class="text-slate-500">Sem logs.</div>'}
        </div>
      </div>
    </div>`;
  },

  _rdCrmTagsBlock() {
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
      <h3 class="text-xl font-black text-slate-950 mb-2">Tags e Lead Scoring</h3>
      <p class="text-sm text-slate-500 mb-4">Cada entrada de funil ou etapa adiciona uma tag acumulativa. Repetições somam contador e aumentam o score do lead.</p>
      <div class="grid md:grid-cols-2 gap-3">
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
          <p class="text-[11px] font-black text-slate-500 uppercase mb-1">Funis</p>
          <ul class="text-xs text-slate-700 space-y-1">
            <li><code class="bg-white px-1.5 py-0.5 rounded">entrada_funil_marketing</code> · peso ${RdCrmLeadScoringBridge.WEIGHTS.funnel.marketing}</li>
            <li><code class="bg-white px-1.5 py-0.5 rounded">entrada_funil_vendas</code> · peso ${RdCrmLeadScoringBridge.WEIGHTS.funnel.vendas}</li>
            <li><code class="bg-white px-1.5 py-0.5 rounded">entrada_funil_cs</code> · peso ${RdCrmLeadScoringBridge.WEIGHTS.funnel.cs}</li>
          </ul>
        </div>
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
          <p class="text-[11px] font-black text-slate-500 uppercase mb-1">Etapas</p>
          <ul class="text-xs text-slate-700 space-y-1">
            ${Object.entries(RdCrmLeadScoringBridge.WEIGHTS.stage).map(([tag, weight]) => `<li><code class="bg-white px-1.5 py-0.5 rounded">${tag}</code> · peso ${weight}</li>`).join('')}
          </ul>
        </div>
      </div>
      <p class="text-[11px] text-slate-400 mt-3">Repetições somam <b>+${RdCrmLeadScoringBridge.WEIGHTS.repeatBonus}</b> por passagem. Cap total: <b>${RdCrmLeadScoringBridge.MAX_SCORE_FROM_TAGS} pts</b> sobre o score base.</p>
    </div>`;
  },

  executionPanel() {
    const cfg = App.state.executionConfig || (window.ExecutionProviderRegistry ? ExecutionProviderRegistry.defaultConfig() : { defaultProvider: 'manual', providers: {} });
    const providers = window.ExecutionProviderRegistry ? ExecutionProviderRegistry.list() : [];
    const stat = window.ExecutionStatusEngine ? ExecutionStatusEngine.globalSnapshot() : { total: 0, byProvider: {} };
    // V32.0.16 / V32.0.18 — Hidrata credenciais V32+ ao abrir o painel (lazy load).
    // V32.0.18 fix: usa flag transitória em App (não-persistida) pra evitar loop
    // infinito de render quando a API retorna array vazio. Antes: cache.length===0
    // disparava setTimeout a cada re-render → load completa com [] → re-render →
    // dispara de novo → ∞. Agora: dispara 1× por sessão. Ações explícitas
    // (connectTrelloNew/disconnectTrelloNew) continuam re-fetcham via chamada direta.
    if (!App._execCredsHydrated) {
      App._execCredsHydrated = true;
      setTimeout(() => Actions.loadExecutionCredentials?.(), 50);
    }
    return `<div class="space-y-5">
      <div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <div class="flex items-center gap-2 mb-1"><i data-lucide="kanban" class="w-5 h-5 text-indigo-600"></i><h3 class="text-2xl font-black text-slate-950">Provider operacional padrão</h3></div>
            <p class="text-sm text-slate-500">Para onde o LeadJourney deve criar as tarefas que o Djow estruturar.</p>
          </div>
          <span class="px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-black text-slate-600">${stat.total} tarefa(s) totais</span>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          ${providers.map(p => this._providerSelectCard(p, cfg.defaultProvider === p.id, stat.byProvider[p.id])).join('')}
        </div>
      </div>
      ${providers.filter(p => p.fields.length).map(p => this._providerConfigCard(p, cfg.providers[p.id] || {})).join('')}
      ${this._providerCard_manual(cfg.providers.manual || {})}
    </div>`;
  },

  _providerSelectCard(provider, isDefault, stats) {
    const completed = stats?.completed || 0;
    const total = stats?.total || 0;
    return `<button onclick="Actions.setDefaultExecutionProvider('${provider.id}')" class="text-left p-4 rounded-2xl border ${isDefault ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white hover:bg-slate-50'} transition">
      <div class="flex items-center gap-2 mb-1">
        <i data-lucide="${provider.icon}" class="w-4 h-4" style="color:${provider.tone};"></i>
        <p class="font-black text-slate-900">${Utils.escape(provider.label)}</p>
        ${isDefault ? '<span class="ml-auto text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-600 text-white">Padrão</span>' : ''}
      </div>
      <p class="text-[11px] text-slate-500">${total} tarefa(s) • ${completed} concluída(s)</p>
    </button>`;
  },

  _providerConfigCard(provider, cfg) {
    // V32.0.16 — Trello tem fluxo novo (execution_credentials criptografado).
    // Demais providers (Monday/Jira/Notion) ainda no path legacy até V32.0.17+.
    if (provider.id === 'trello') return this._trelloConfigCard(provider, cfg);

    const connectedBadge = cfg.connected
      ? '<span class="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-black">● Conectado</span>'
      : '<span class="px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-black">○ Não conectado</span>';
    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
      <div class="flex items-center justify-between gap-3 mb-4">
        <div class="flex items-center gap-2"><i data-lucide="${provider.icon}" class="w-5 h-5" style="color:${provider.tone};"></i><h4 class="text-lg font-black text-slate-900">${Utils.escape(provider.label)}</h4></div>
        ${connectedBadge}
      </div>
      <div class="grid md:grid-cols-2 gap-3">
        ${provider.fields.map(field => this._providerInput(provider.id, field, cfg[field])).join('')}
      </div>
      <div class="flex flex-wrap gap-2 mt-4">
        <button onclick="Actions.testExecutionProvider('${provider.id}')" class="px-4 py-2.5 rounded-2xl bg-slate-900 text-white font-black text-sm" style="color:#fff!important;">Testar conexão</button>
        ${cfg.lastError ? `<span class="text-xs text-red-600 font-black flex items-center">⚠ ${Utils.escape(cfg.lastError)}</span>` : ''}
        ${cfg.lastTested ? `<span class="text-[11px] text-slate-400 self-center">Último teste: ${Utils.escape(new Date(cfg.lastTested).toLocaleString('pt-BR'))}</span>` : ''}
      </div>
    </div>`;
  },

  // V32.0.16 — Card Trello com fluxo encrypted (DB) + fallback legacy embaixo.
  // Quando user conecta via fluxo novo (POST /api/execution-connect), credenciais
  // ficam criptografadas em execution_credentials. Tasks criam via backend proxy.
  _trelloConfigCard(provider, legacyCfg) {
    const credList = App.state._executionCredentialsCache || [];
    const newConnected = credList.find(p => p.providerId === 'trello' && p.status === 'connected');
    const draft = App.state.trelloConnectDraft || { apiKey: '', token: '', board: '', listTodo: '', listDone: '' };

    const headerBadge = newConnected
      ? '<span class="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-black">● Conectado (DB criptografado)</span>'
      : (legacyCfg.connected
        ? '<span class="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-black">⚠ Legacy (plaintext)</span>'
        : '<span class="px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-slate-600 text-[11px] font-black">○ Não conectado</span>');

    return `<div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
      <div class="flex items-center justify-between gap-3 mb-4">
        <div class="flex items-center gap-2"><i data-lucide="${provider.icon}" class="w-5 h-5" style="color:${provider.tone};"></i><h4 class="text-lg font-black text-slate-900">${Utils.escape(provider.label)}</h4></div>
        ${headerBadge}
      </div>

      ${newConnected ? `
        <div class="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-black text-emerald-900 text-sm">✓ Trello conectado via padrão V32.0.14+</p>
              <p class="text-xs text-emerald-800 mt-1">Credenciais criptografadas no DB. Tasks são criadas via backend proxy — token nunca toca o browser.</p>
              ${newConnected.lastTestedAt ? `<p class="text-[11px] text-emerald-700 mt-1">Último teste: ${new Date(newConnected.lastTestedAt).toLocaleString('pt-BR')}</p>` : ''}
              ${newConnected.lastError ? `<p class="text-[11px] text-red-700 mt-1">⚠ Último erro: ${Utils.escape(newConnected.lastError)}</p>` : ''}
            </div>
            <button onclick="Actions.disconnectTrelloNew()" class="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-black shrink-0"><i data-lucide="unplug" class="w-3.5 h-3.5 inline mr-1"></i>Desconectar</button>
          </div>
        </div>
      ` : `
        <div class="rounded-2xl bg-violet-50 border-2 border-violet-200 p-4 space-y-3">
          <div>
            <p class="font-black text-violet-900 text-sm">Conectar Trello (padrão novo — credenciais criptografadas)</p>
            <p class="text-xs text-violet-800 mt-1">Pegar key+token em <a href="https://trello.com/app-key" target="_blank" class="underline font-bold">trello.com/app-key</a> · listIds: abre o card no Trello e copia o ID da URL.</p>
          </div>

          <div class="grid md:grid-cols-2 gap-3">
            <div>
              <label class="text-xs font-black text-slate-700 uppercase">API Key *</label>
              <input type="text" value="${Utils.escape(draft.apiKey || '')}" oninput="Actions.updateTrelloConnectDraftField('apiKey', this.value)" placeholder="32 chars hex" class="mt-1 w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-mono" />
            </div>
            <div>
              <label class="text-xs font-black text-slate-700 uppercase">Token *</label>
              <input type="password" value="${Utils.escape(draft.token || '')}" oninput="Actions.updateTrelloConnectDraftField('token', this.value)" placeholder="ATTA..." class="mt-1 w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-mono" />
            </div>
            <div>
              <label class="text-xs font-black text-slate-700 uppercase">Board ID (opcional)</label>
              <input type="text" value="${Utils.escape(draft.board || '')}" oninput="Actions.updateTrelloConnectDraftField('board', this.value)" class="mt-1 w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm" />
            </div>
            <div>
              <label class="text-xs font-black text-slate-700 uppercase">List "To Do" ID *</label>
              <input type="text" value="${Utils.escape(draft.listTodo || '')}" oninput="Actions.updateTrelloConnectDraftField('listTodo', this.value)" placeholder="onde tasks novas entram" class="mt-1 w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm" />
            </div>
            <div class="md:col-span-2">
              <label class="text-xs font-black text-slate-700 uppercase">List "Done" ID (opcional)</label>
              <input type="text" value="${Utils.escape(draft.listDone || '')}" oninput="Actions.updateTrelloConnectDraftField('listDone', this.value)" placeholder="pra mover quando completar" class="mt-1 w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm" />
            </div>
          </div>

          <button onclick="Actions.connectTrelloNew()" class="px-5 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-sm" style="color:#fff!important;"><i data-lucide="plug" class="w-4 h-4 inline mr-1"></i>Conectar Trello</button>
        </div>
      `}

      <details class="mt-4 text-xs text-slate-500">
        <summary class="cursor-pointer font-black select-none">Modo legacy (campos em plaintext — apenas pra compatibilidade V13-V31)</summary>
        <div class="mt-3 grid md:grid-cols-2 gap-3">
          ${provider.fields.map(field => this._providerInput(provider.id, field, legacyCfg[field])).join('')}
        </div>
        <div class="flex flex-wrap gap-2 mt-3">
          <button onclick="Actions.testExecutionProvider('${provider.id}')" class="px-3 py-1.5 rounded-xl bg-slate-200 text-slate-700 font-black text-xs">Testar legacy</button>
          ${legacyCfg.lastError ? `<span class="text-[11px] text-red-600 font-black flex items-center">⚠ ${Utils.escape(legacyCfg.lastError)}</span>` : ''}
        </div>
      </details>
    </div>`;
  },

  _providerCard_manual(cfg) {
    return `<div class="rounded-3xl bg-slate-50 border border-slate-200 p-5">
      <div class="flex items-center gap-2 mb-2"><i data-lucide="edit" class="w-5 h-5 text-slate-700"></i><h4 class="text-lg font-black text-slate-900">Manual</h4></div>
      <p class="text-sm text-slate-600">No modo Manual, as tarefas vivem dentro do LeadJourney. Nada é enviado para fora — útil para times que ainda não têm um provider externo plugado.</p>
    </div>`;
  },

  _providerInput(providerId, field, value) {
    const labelMap = {
      apiToken: 'API Token', apiKey: 'API Key', token: 'Token', url: 'URL',
      workspace: 'Workspace', space: 'Space', folder: 'Folder', list: 'List ID',
      board: 'Board ID', boardId: 'Board ID', listTodo: 'List "To Do"', listDone: 'List "Done"',
      defaultGroup: 'Grupo padrão', project: 'Projeto / Key', status: 'Status "Done"',
      statusInProgress: 'Status "em execução"', statusDone: 'Status "concluído"',
      databaseId: 'Database ID', email: 'E-mail (Jira)'
    };
    const sensitive = ['apiToken','apiKey','token'].includes(field);
    return `<div>
      <label class="text-xs font-black text-slate-500 uppercase tracking-wide">${labelMap[field] || field}</label>
      <input type="${sensitive ? 'password' : 'text'}" value="${Utils.escape(value || '')}" oninput="Actions.updateExecutionProviderField('${providerId}', '${field}', this.value)" class="mt-1 w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-semibold text-slate-900" />
    </div>`;
  },

  // V26.0.0 — Painel de configuração do Djow AI (Claude API).
  // Substituiu o painel de "Djow Railway Agent" (V13 — agente externo de execução
  // de tarefas que nunca foi usado em produção). Djow agora é o assistente AI do
  // LeadJourney, plugado em Claude API, com tools que leem o state da operação +
  // knowledge base de RevOps/CX que o dev (Felipe) popula em /knowledge-base/.
  agentsPanel() {
    const status = App.state.djowStatus || { configured: false, model: 'claude-sonnet-4-6', kbFiles: [], kbChars: 0, allowedRoles: ['master'], stats: { totalCostUsd: 0, conversationCount: 0 } };
    const cfg = App.state.djowConfig || { model: 'claude-sonnet-4-6', allowedRoles: ['master'] };
    const isConfigured = status.configured;
    const isMaster = App.currentUser?.isMaster;

    const statusBadge = isConfigured
      ? `<span class="px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> API key configurada</span>`
      : `<span class="px-3 py-2 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-black flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-amber-500"></span> Aguardando ANTHROPIC_API_KEY</span>`;

    const robotAvatar = `<svg viewBox="0 0 64 64" class="w-14 h-14" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="djow-set-grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#A78BFA"/><stop offset="100%" stop-color="#5B21B6"/></linearGradient></defs>
      <circle cx="32" cy="8" r="3" fill="#C4B5FD"/><line x1="32" y1="11" x2="32" y2="16" stroke="#A78BFA" stroke-width="2"/>
      <rect x="14" y="16" width="36" height="32" rx="11" fill="url(#djow-set-grad)" stroke="#7C3AED" stroke-width="1.5"/>
      <circle cx="24" cy="30" r="3.5" fill="#fff"/><circle cx="40" cy="30" r="3.5" fill="#fff"/>
      <circle cx="24" cy="30" r="1.5" fill="#5B21B6"/><circle cx="40" cy="30" r="1.5" fill="#5B21B6"/>
      <path d="M26 40 Q32 43 38 40" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>
      <rect x="10" y="26" width="4" height="10" rx="2" fill="#7C3AED"/><rect x="50" y="26" width="4" height="10" rx="2" fill="#7C3AED"/>
      <rect x="26" y="48" width="12" height="6" rx="2" fill="#5B21B6"/>
    </svg>`;

    return `<div class="space-y-5">
      <div class="rounded-3xl bg-gradient-to-br from-violet-50 to-white border-2 border-violet-200 p-5 shadow-md">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
          <div class="flex items-center gap-4">
            ${robotAvatar}
            <div>
              <div class="flex items-center gap-2 mb-1">
                <h3 class="text-2xl font-black text-slate-950">Djow AI</h3>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-violet-200 text-violet-900">Powered by Claude</span>
              </div>
              <p class="text-sm text-slate-600">Seu assistente de receita. Lê dados da operação, RevOps, CX e responde no chat ou via atalho global.</p>
            </div>
          </div>
          ${statusBadge}
        </div>

        ${!isConfigured ? this._djowSetupTutorial() : ''}

        ${isConfigured ? `
          <div class="grid md:grid-cols-2 gap-3 mb-4">
            <div>
              <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Modelo</label>
              <select onchange="Actions.updateDjowConfig('model', this.value)" class="mt-1 w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-semibold text-slate-900">
                <option value="claude-sonnet-4-6" ${cfg.model === 'claude-sonnet-4-6' ? 'selected' : ''}>Sonnet 4.6 (Recomendado · $0.03/pergunta)</option>
                <option value="claude-opus-4-7" ${cfg.model === 'claude-opus-4-7' ? 'selected' : ''}>Opus 4.7 (Top qualidade · $0.15/pergunta)</option>
                <option value="claude-haiku-4-5-20251001" ${cfg.model === 'claude-haiku-4-5-20251001' ? 'selected' : ''}>Haiku 4.5 (Rápido e barato · $0.005/pergunta)</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Quem pode usar</label>
              <select onchange="Actions.updateDjowAllowedRoles(this.value)" class="mt-1 w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-semibold text-slate-900" ${isMaster ? '' : 'disabled'}>
                <option value="master" ${cfg.allowedRoles?.[0] === 'master' && cfg.allowedRoles?.length === 1 ? 'selected' : ''}>Apenas master (você)</option>
                <option value="production" ${cfg.allowedRoles?.includes('production') && !cfg.allowedRoles?.includes('all') ? 'selected' : ''}>Master + Production</option>
                <option value="all" ${cfg.allowedRoles?.includes('all') ? 'selected' : ''}>Todos aprovados (inclui sandbox)</option>
              </select>
            </div>
          </div>

          <div class="grid md:grid-cols-3 gap-3 mb-4">
            <div class="rounded-2xl bg-white border border-slate-200 p-3">
              <p class="text-[10px] font-black text-slate-500 uppercase">Knowledge Base</p>
              <p class="text-lg font-black text-slate-900 mt-1">${status.kbFiles.length} arquivo(s)</p>
              <p class="text-[11px] text-slate-500">${status.kbChars.toLocaleString('pt-BR')} caracteres</p>
            </div>
            <div class="rounded-2xl bg-white border border-slate-200 p-3">
              <p class="text-[10px] font-black text-slate-500 uppercase">Conversas</p>
              <p class="text-lg font-black text-slate-900 mt-1">${status.stats.conversationCount}</p>
              <p class="text-[11px] text-slate-500">total no banco</p>
            </div>
            <div class="rounded-2xl bg-white border border-slate-200 p-3">
              <p class="text-[10px] font-black text-slate-500 uppercase">Custo acumulado</p>
              <p class="text-lg font-black text-slate-900 mt-1">$${Number(status.stats.totalCostUsd).toFixed(4)}</p>
              <p class="text-[11px] text-slate-500">USD (Anthropic)</p>
            </div>
          </div>

          ${status.kbFiles.length > 0 ? `
            <details class="rounded-2xl bg-slate-50 border border-slate-200 p-3 mb-4">
              <summary class="cursor-pointer text-xs font-black text-slate-700">Knowledge base carregada</summary>
              <ul class="mt-2 space-y-1 text-xs text-slate-600">
                ${status.kbFiles.map(f => `<li>• <code>${Utils.escape(f.name)}</code> · ${f.chars.toLocaleString('pt-BR')} chars</li>`).join('')}
              </ul>
              <p class="text-[11px] text-slate-500 mt-3">Editar/adicionar: edite arquivos em <code>/knowledge-base/</code> no repo + push pro Railway. Veja <code>knowledge-base/README.md</code>.</p>
            </details>
          ` : `
            <div class="rounded-2xl bg-amber-50 border border-amber-200 p-3 mb-4 text-xs text-amber-900">
              <p class="font-black mb-1">⚠ Knowledge base vazia</p>
              <p>Djow funciona, mas só responde com base nos dados da operação (não em conhecimento de domínio). Pra ativar insights de RevOps/CX, crie arquivos em <code>/knowledge-base/</code> (veja README lá).</p>
            </div>
          `}

          <div class="flex flex-wrap gap-2">
            <button onclick="Actions.testDjowConnection()" class="px-4 py-2.5 rounded-2xl bg-slate-900 text-white font-black text-sm lj-dark-button" style="color:#fff!important;">
              <i data-lucide="zap" class="w-3.5 h-3.5 inline"></i> Testar conexão
            </button>
            <button onclick="Actions.openDjowAIModal()" class="px-4 py-2.5 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-sm" style="color:#fff!important;">
              <i data-lucide="message-square" class="w-3.5 h-3.5 inline"></i> Abrir chat
            </button>
          </div>
        ` : ''}
      </div>
    </div>`;
  },

  // V26.0.0 — Tutorial passo-a-passo de como configurar o Djow.
  _djowSetupTutorial() {
    return `<div class="rounded-2xl bg-slate-900 text-white p-5 mb-4">
      <h4 class="font-black mb-3 flex items-center gap-2"><i data-lucide="key-round" class="w-4 h-4 text-violet-400"></i> Como ativar o Djow (3 passos)</h4>
      <ol class="space-y-3 text-sm">
        <li class="flex gap-3">
          <span class="w-6 h-6 rounded-full bg-violet-600 grid place-items-center text-xs font-black shrink-0">1</span>
          <div>
            <p class="font-black">Crie uma API key da Anthropic</p>
            <p class="text-slate-400 text-xs mt-1">Vá em <a href="https://console.anthropic.com/" target="_blank" class="text-violet-300 underline">console.anthropic.com</a> → Settings → API Keys → "Create Key". Adicione $5-10 de crédito (suficiente pra ~30 dias de uso casual).</p>
          </div>
        </li>
        <li class="flex gap-3">
          <span class="w-6 h-6 rounded-full bg-violet-600 grid place-items-center text-xs font-black shrink-0">2</span>
          <div>
            <p class="font-black">Cole no Railway como variável de ambiente</p>
            <p class="text-slate-400 text-xs mt-1">No painel Railway → seu projeto → Variables → "New Variable":<br><code class="bg-slate-800 px-2 py-0.5 rounded mt-1 inline-block">ANTHROPIC_API_KEY=sk-ant-api03-...</code></p>
          </div>
        </li>
        <li class="flex gap-3">
          <span class="w-6 h-6 rounded-full bg-violet-600 grid place-items-center text-xs font-black shrink-0">3</span>
          <div>
            <p class="font-black">Redeploy</p>
            <p class="text-slate-400 text-xs mt-1">Railway vai redeploy automaticamente. Aguarde ~1min e recarregue esta página. O badge "API key configurada" aparece quando estiver pronto.</p>
          </div>
        </li>
      </ol>
      <p class="text-[11px] text-slate-500 mt-4">⚠ <b>Segurança</b>: a key fica no servidor (Railway), nunca no browser. Apenas o user master (você) pode usar o Djow por padrão.</p>
    </div>`;
  },

  _agentInput(field, label, value, placeholder = '', sensitive = false, type = 'text') {
    return `<div>
      <label class="text-xs font-black text-slate-500 uppercase tracking-wide">${label}</label>
      <input type="${sensitive ? 'password' : type}" value="${Utils.escape(String(value ?? ''))}" oninput="Actions.updateAgentField('djow', '${field}', this.value)" placeholder="${Utils.escape(placeholder || '')}" class="mt-1 w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-semibold text-slate-900" />
    </div>`;
  },

  // V31.2.1 — Painel "Administrar Lead Journey". Ações destrutivas de dado
  // que precisam de confirmação dupla. Por hora: deletar produtos em cascata.
  adminPanel() {
    const products = App.state.products || [];
    const pending = App.state.adminDeleteProductPending || null;
    return `<div class="space-y-5">
      <div class="rounded-2xl bg-amber-50 border border-amber-300 p-4 text-amber-900 flex items-start gap-3">
        <i data-lucide="alert-triangle" class="w-5 h-5 mt-0.5 shrink-0 text-amber-700"></i>
        <div>
          <p class="font-black text-sm mb-1">Cuidado — área crítica</p>
          <p class="text-xs">Ações aqui apagam dados em cascata e <b>não têm desfazer</b>. Cada deleção remove o produto + todas as campanhas, ações, leads, OKRs, RevOps, branches e tasks vinculadas. Considere baixar um snapshot antes (Configurações → Banco de Dados).</p>
        </div>
      </div>

      <section>
        <h3 class="font-black text-slate-900 text-lg mb-3">Apagar produto + tudo que tem dependência</h3>
        ${products.length === 0
          ? `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-6 text-center text-slate-500 italic text-sm">Nenhum produto cadastrado.</div>`
          : `<div class="space-y-2">
              ${products.map(p => this._adminProductRow(p, pending)).join('')}
            </div>`}
      </section>
    </div>`;
  },

  _adminProductRow(product, pending) {
    const campaigns = (App.state.campaigns || []).filter(c => Number(c.productId) === Number(product.id));
    const campaignIds = new Set(campaigns.map(c => Number(c.id)));
    const actions = (App.state.actions || []).filter(a => campaignIds.has(Number(a.campaignId)));
    const actionIds = new Set(actions.map(a => Number(a.id)));
    const leadsCount = actions.reduce((sum, a) => sum + (a.leads || []).length, 0);
    const tasks = (App.state.executionTasks || []).filter(t =>
      campaignIds.has(Number(t.linked_campaign_id)) || actionIds.has(Number(t.linked_action_id))
    );
    const isPending = pending && Number(pending.productId) === Number(product.id);
    return `<div class="rounded-2xl bg-white border border-slate-200 p-4 flex items-start justify-between gap-3 ${isPending ? 'ring-2 ring-red-400' : ''}">
      <div class="min-w-0 flex-1">
        <p class="font-black text-slate-900 text-base">${Utils.escape(product.name)}</p>
        <p class="text-[11px] text-slate-500 mt-0.5">${campaigns.length} campanha(s) · ${actions.length} ação(ões) · ${leadsCount} lead(s) · ${tasks.length} task(s)</p>
        ${isPending ? `<div class="mt-3 rounded-xl bg-red-50 border border-red-200 p-3 space-y-2">
          <p class="text-[12px] font-black text-red-800">Confirma apagar <b>${Utils.escape(product.name)}</b> e tudo abaixo?</p>
          <ul class="text-[11px] text-red-700 list-disc pl-4 space-y-0.5">
            <li>${campaigns.length} campanha(s) e seus mapas/branches</li>
            <li>${actions.length} ação(ões) operacional(is)</li>
            <li>${leadsCount} lead(s) das ações</li>
            <li>${tasks.length} task(s) no provider</li>
            <li>RevOps Finance, productKrs, integrations pipelines, blueprints — tudo do produto</li>
          </ul>
          <p class="text-[11px] text-red-700">Digite o nome do produto pra confirmar: <b>${Utils.escape(product.name)}</b></p>
          <input value="${Utils.escape(pending.typed || '')}" oninput="Actions.adminDeleteProductTyped(this.value)" placeholder="Nome do produto…" class="w-full px-3 py-2 rounded-lg bg-white border border-red-300 text-slate-900 font-bold text-sm" />
          <div class="flex justify-end gap-2 pt-1">
            <button onclick="Actions.adminCancelDeleteProduct()" class="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-black">Cancelar</button>
            <button ${pending.typed === product.name ? '' : 'disabled'} onclick="Actions.adminConfirmDeleteProduct(${product.id})" class="px-3 py-1.5 rounded-lg ${pending.typed === product.name ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'} text-xs font-black" ${pending.typed === product.name ? 'style="color:#fff!important;"' : ''}>Apagar definitivamente</button>
          </div>
        </div>` : ''}
      </div>
      ${!isPending ? `<button onclick="Actions.adminRequestDeleteProduct(${product.id})" class="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-black flex items-center gap-1.5 shrink-0"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Apagar</button>` : ''}
    </div>`;
  },

  // V32.1.2 — "Minha Conta" — qualquer user edita o próprio perfil.
  // Hoje só display_name. Futuro: avatar, timezone, language, trocar senha.
  myAccountPanel() {
    const user = App.currentUser || {};
    const draft = App.state.profileDisplayNameDraft;
    const currentName = user.displayName || '';
    const placeholder = currentName || this._displayNameFallback(user);
    const inputValue = (draft !== undefined && draft !== '') ? draft : (currentName || '');

    return `<div class="space-y-5">
      <div class="rounded-2xl bg-violet-50 border border-violet-300 p-4 text-violet-900 flex items-start gap-3">
        <i data-lucide="user" class="w-5 h-5 mt-0.5 shrink-0 text-violet-700"></i>
        <div>
          <p class="font-black text-sm mb-1">Seu perfil neste LeadJourney</p>
          <p class="text-xs leading-relaxed">Personalize como você aparece — a saudação no topo, futuras assinaturas, etc. O nome aqui não muda o seu login, só como o LJ se refere a você.</p>
        </div>
      </div>

      <div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm space-y-4">
        <div>
          <h3 class="text-2xl font-black text-slate-950 mb-1">Identidade</h3>
          <p class="text-sm text-slate-500">Como o LeadJourney te chama na interface.</p>
        </div>

        <div>
          <label class="text-xs font-black text-slate-500 uppercase tracking-wide">E-mail (login)</label>
          <input type="text" value="${Utils.escape(user.username || user.email || '')}" disabled class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-100 text-slate-700 font-semibold cursor-not-allowed" />
          <p class="text-[11px] text-slate-400 mt-1">Pra trocar de e-mail (login), peça pro admin global.</p>
        </div>

        <div>
          <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Nome de exibição</label>
          <input
            type="text"
            value="${Utils.escape(inputValue)}"
            oninput="Actions.updateProfileDisplayNameDraft(this.value)"
            placeholder="${Utils.escape(placeholder)}"
            class="mt-1 w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-semibold text-slate-900"
          />
          <p class="text-[11px] text-slate-500 mt-1">
            ${currentName
              ? `Atualmente: <b>${Utils.escape(currentName)}</b>. Deixe em branco e salve pra voltar pro padrão.`
              : `Sem nome customizado. O LJ está usando: <b>"${Utils.escape(placeholder)}"</b> (derivado do seu e-mail).`
            }
          </p>
        </div>

        ${user.tenantName ? `
          <div>
            <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Tenant (empresa)</label>
            <input type="text" value="${Utils.escape(user.tenantName)}" disabled class="mt-1 w-full px-4 py-3 rounded-2xl bg-slate-100 text-slate-700 font-semibold cursor-not-allowed" />
            <p class="text-[11px] text-slate-400 mt-1">Você pertence a este tenant. Pra trocar, peça pro admin global.</p>
          </div>
        ` : ''}

        <div class="flex justify-end gap-2 pt-2">
          <button onclick="Actions.saveUserProfile()" class="px-5 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-sm" style="color:#fff!important;">
            <i data-lucide="check" class="w-4 h-4 inline mr-1"></i>Salvar
          </button>
        </div>
      </div>
    </div>`;
  },

  // V32.1.2 — Helper: fallback do display name baseado no e-mail (primeiro
  // segmento do DOMAIN, capitalizado). Espelha lógica de home.js _userFirstName.
  _displayNameFallback(user) {
    const raw = String(user?.username || user?.email || '').trim();
    if (!raw) return 'visitante';
    if (raw.includes('@')) {
      const domain = raw.split('@')[1] || '';
      const firstSeg = domain.split('.')[0] || domain;
      if (firstSeg) return firstSeg.charAt(0).toUpperCase() + firstSeg.slice(1);
    }
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  },

  // V32.1.1 — "Meu Banco" — self-service de tenant DB pra cliente.
  // Visível pra QUALQUER user que tem default_tenant_id (= todo cliente real,
  // independente de master ou não). Master sem tenant não vê — usa o menu
  // Tenants global pra mexer em tenant de outros.
  //
  // Diferente do menu Tenants (master-only): aqui o user só vê e mexe no
  // PRÓPRIO tenant. Backend força isso via req.user.tenantId do JWT.
  myDbPanel() {
    const user = App.currentUser || {};
    const tenantName = user.tenantName || user.tenantSlug || 'seu tenant';
    const dbPlugged = Boolean(user.tenantDbPlugged);
    const draft = String(App.state.tenantDbPlugDraft || '');
    const error = String(App.state.tenantDbPlugError || '');

    if (!user.tenantId) {
      return `<div class="rounded-3xl bg-amber-50 border border-amber-200 p-6">
        <h3 class="text-xl font-black text-amber-900 mb-1">Sem tenant associado</h3>
        <p class="text-sm text-amber-800">Você é admin global (master) sem tenant próprio. Pra plugar banco de algum cliente, use Configurações → Tenants (Global Mode).</p>
      </div>`;
    }

    return `<div class="space-y-5">
      <div class="rounded-2xl bg-violet-50 border border-violet-300 p-4 text-violet-900 flex items-start gap-3">
        <i data-lucide="database" class="w-5 h-5 mt-0.5 shrink-0 text-violet-700"></i>
        <div>
          <p class="font-black text-sm mb-1">Banco do tenant "${Utils.escape(tenantName)}"</p>
          <p class="text-xs leading-relaxed">Por padrão seus dados ficam no armazenamento compartilhado do LeadJourney. Você pode plugar um Postgres próprio (Supabase / AWS RDS / Railway / qualquer Postgres-compat) pra isolar 100% seus dados. A connection string fica criptografada no servidor (AES-256-GCM) e nunca toca o navegador.</p>
        </div>
      </div>

      <div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
        <div class="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 class="text-2xl font-black text-slate-950">Status atual</h3>
            <p class="text-sm text-slate-500">Onde seus dados estão sendo gravados agora.</p>
          </div>
          ${dbPlugged
            ? '<span class="px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black">🔌 Banco próprio plugado</span>'
            : '<span class="px-3 py-2 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-black">📦 Armazenamento compartilhado</span>'
          }
        </div>

        ${dbPlugged ? `
          <div class="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
            <p class="text-sm font-black text-emerald-900 mb-1">✓ Seus dados estão isolados</p>
            <p class="text-xs text-emerald-800 mb-3">Toda gravação (state, snapshots, integrações) vai direto pro Postgres que você configurou. Latência depende da região do banco.</p>
            <button onclick="Actions.unplugOwnTenantDb()" class="px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-black flex items-center gap-1.5">
              <i data-lucide="unplug" class="w-3.5 h-3.5"></i>Desplugar e voltar pro compartilhado
            </button>
          </div>
        ` : `
          <div class="rounded-2xl bg-violet-50 border-2 border-violet-200 p-4 space-y-3">
            <div>
              <p class="font-black text-violet-900 text-sm">Plugar Postgres próprio (opcional)</p>
              <p class="text-xs text-violet-800 mt-1">Provisione um banco em qualquer provedor (Supabase free tier 500MB, Railway, AWS RDS, Neon, etc), cole a connection string aqui. O LJ vai testar a conexão, criar o schema e migrar.</p>
            </div>

            <input
              type="password"
              value="${Utils.escape(draft)}"
              oninput="Actions.updateTenantDbPlugDraft(this.value)"
              placeholder="postgres://user:senha@host:5432/dbname"
              class="w-full px-3 py-2.5 rounded-xl bg-white border border-violet-300 text-sm font-mono"
            />

            ${error ? `<div class="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700 font-black">⚠ ${Utils.escape(error)}</div>` : ''}

            <div class="flex items-center justify-between gap-2 flex-wrap">
              <p class="text-[11px] text-violet-700">A conexão e schema serão validados antes de salvar.</p>
              <button onclick="Actions.plugOwnTenantDb()" class="px-5 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-sm" style="color:#fff!important;">
                <i data-lucide="plug" class="w-4 h-4 inline mr-1"></i>Plugar meu banco
              </button>
            </div>
          </div>

          <details class="mt-4 text-xs text-slate-500">
            <summary class="cursor-pointer font-black select-none">Como pegar a connection string?</summary>
            <div class="mt-3 space-y-3 text-slate-600">
              <p><b>Supabase:</b> dashboard → seu projeto → Project Settings → Database → "Connection string" → URI → cole aqui.</p>
              <p><b>Railway dele:</b> seu projeto Railway → service Postgres → Variables → copia <code class="bg-white px-1 py-0.5 rounded">DATABASE_URL</code>.</p>
              <p><b>AWS RDS / Neon / outros:</b> monte o URL no formato <code class="bg-white px-1 py-0.5 rounded">postgres://user:senha@host:5432/dbname</code>.</p>
              <p class="text-amber-700"><b>Atenção:</b> o usuário do banco precisa de permissão <code>CREATE TABLE</code> — o LJ vai criar ~10 tabelas automaticamente no primeiro plug.</p>
            </div>
          </details>
        `}
      </div>
    </div>`;
  },

  // V32.0.12 — Multi-tenant admin (master only).
  // Lista tenants do control plane com status + plug/unplug DB.
  // Cada tenant pode ter um Postgres próprio (db_plugged=true) ou usar control
  // plane (db_plugged=false). Plugar = cola connection string, encrypta + salva.
  tenantsPanel() {
    const tenants = App.state._tenantsListCache || [];
    if (!tenants.length) {
      // V32.0.18 — flag em App pra evitar loop. Mesmo padrão executionPanel/usersPanel.
      if (!App._tenantsListHydrated) {
        App._tenantsListHydrated = true;
        setTimeout(() => Actions.loadTenantsList(), 50);
      }
      return `<div class="rounded-3xl bg-white border border-slate-100 p-6 shadow-sm">
        <p class="text-sm text-slate-500">Carregando lista de tenants...</p>
      </div>`;
    }
    return `<div class="space-y-5">
      <div class="rounded-2xl bg-violet-50 border border-violet-300 p-4 text-violet-900 flex items-start gap-3">
        <i data-lucide="layers" class="w-5 h-5 mt-0.5 shrink-0 text-violet-700"></i>
        <div>
          <p class="font-black text-sm mb-1">Global Mode — Multi-tenant</p>
          <p class="text-xs leading-relaxed">Cada tenant pode operar no DB central (control plane) ou ter Postgres próprio plugado. Para plugar um DB próprio: provisione um Postgres no Railway/Supabase, rode <code class="bg-white px-1 py-0.5 rounded">lib/tenant-db-schema.sql</code> contra ele, e cole a connection string aqui. Próximas requests do tenant vão direto pro novo DB.</p>
        </div>
      </div>

      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-2xl font-black text-slate-950">Tenants (${tenants.length})</h3>
          <p class="text-sm text-slate-500">Master é admin global. Não aparece aqui — só clientes.</p>
        </div>
        <button onclick="Actions.loadTenantsList()" class="px-4 py-2 rounded-2xl bg-slate-900 text-white text-xs font-black flex items-center gap-1.5 lj-dark-button" style="color:#fff;"><i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Atualizar</button>
      </div>

      <div class="space-y-3">
        ${tenants.map(t => this._tenantRow(t)).join('')}
      </div>
    </div>`;
  },

  _tenantRow(t) {
    const draft = (App.state.tenantPlugDraft || {})[String(t.id)] || '';
    const statusChip = t.status === 'active'
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700">ativo</span>'
      : t.status === 'demo'
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-sky-100 text-sky-700">demo/staging</span>'
      : t.status === 'suspended'
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700">suspenso</span>'
      : `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700">${Utils.escape(t.status)}</span>`;
    const dbChip = t.db_plugged
      ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-violet-600 text-white" style="color:#fff;">🔌 DB próprio plugado</span>'
      : '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200 text-slate-700">Control plane (fallback)</span>';
    return `<div class="rounded-2xl bg-white border border-slate-200 p-4">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <p class="font-black text-slate-900 text-base">${Utils.escape(t.name)}</p>
            <code class="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-700">${Utils.escape(t.slug)}</code>
            ${statusChip}
            ${dbChip}
          </div>
          <p class="text-[11px] text-slate-500 mt-1">
            Plan: <b>${Utils.escape(t.plan || '—')}</b> ·
            Owner: <b>${Utils.escape(t.owner_username || '— (sem owner)')}</b> ·
            ${t.members_count || 0} membro(s) ·
            ${t.migrated_at ? `migrado em ${new Date(t.migrated_at).toLocaleDateString('pt-BR')}` : 'nunca migrado'}
          </p>
        </div>
      </div>

      ${t.db_plugged ? `
        <div class="flex items-center justify-between gap-3 rounded-xl bg-violet-50 border border-violet-200 p-3">
          <div class="text-[11px] text-violet-900">
            <p class="font-black mb-0.5">DB plugado e ativo.</p>
            <p>Toda request deste tenant lê/escreve no Postgres próprio. Connection string criptografada com ENCRYPTION_KEY.</p>
          </div>
          <button onclick="Actions.unplugTenantDb(${t.id})" class="px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-xs font-black flex items-center gap-1.5 shrink-0"><i data-lucide="unplug" class="w-3.5 h-3.5"></i> Desplugar</button>
        </div>
      ` : `
        <div class="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2">
          <p class="text-[11px] font-black text-slate-700">Plugar Postgres próprio (opcional)</p>
          <input
            type="password"
            value="${Utils.escape(draft)}"
            oninput="Actions.updateTenantPlugDraft(${t.id}, this.value)"
            placeholder="postgres://user:pass@host:port/dbname"
            class="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs font-mono"
          />
          <div class="flex items-center justify-between gap-2">
            <p class="text-[10px] text-slate-500">Rode <code class="bg-white px-1 py-0.5 rounded">lib/tenant-db-schema.sql</code> contra o DB ANTES de plugar.</p>
            <button onclick="Actions.plugTenantDb(${t.id})" class="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black flex items-center gap-1.5 shrink-0" style="color:#fff;"><i data-lucide="plug" class="w-3.5 h-3.5"></i> Plugar DB</button>
          </div>
        </div>
      `}
    </div>`;
  },

  // V30.0.0 — Painel de Integrações. Por enquanto só ClickUp.
  // V31.2.29 — Reescrito: conexão via Personal API Token (PAT) em 1 passo.
  // OAuth flow removido da UI (continua no backend pra quem já está conectado).
  integrationsPanel() {
    const status = App.state.clickupStatus || { connected: false, encryptionReady: true };
    const draft = App.state.clickupPatDraft || '';
    const encWarn = !status.encryptionReady ? `<div class="rounded-2xl bg-red-50 border-2 border-red-300 p-4 mb-4 text-red-800"><p class="font-black mb-1">⚠️ ENCRYPTION_KEY não configurada no servidor.</p><p class="text-sm">O admin precisa adicionar no Railway → Variables antes de você conectar. Veja README.</p></div>` : '';

    const readOnlyBanner = status.connected && status.writeEnabled === false
      ? `<div class="rounded-2xl bg-amber-100 border-2 border-amber-400 p-4 mb-4 text-amber-900 flex items-center gap-3">
          <i data-lucide="pause-circle" class="w-5 h-5 shrink-0"></i>
          <div class="flex-1">
            <p class="font-black text-sm">⚠ ClickUp em modo SOMENTE-LEITURA</p>
            <p class="text-xs">Nenhuma task será criada/atualizada no ClickUp do cliente até reativar abaixo.</p>
          </div>
        </div>`
      : '';

    // V32.2.3 (Geraldo A5) — Aviso proeminente sobre delete do Space LeadJourney.
    // Antes era texto pequeno dentro do card. Agora banner visível no topo —
    // cliente vê ANTES de fazer qualquer coisa no ClickUp.
    const spaceDeleteBanner = status.connected && status.ljSpaceId
      ? `<div class="rounded-2xl bg-red-50 border border-red-200 p-3 mb-4 text-red-900 flex items-start gap-3">
          <i data-lucide="alert-octagon" class="w-4 h-4 mt-0.5 shrink-0"></i>
          <div class="flex-1 text-xs">
            <p class="font-black">⚠ NUNCA delete o Space "LeadJourney" no ClickUp</p>
            <p>Se deletar, todo o mapeamento Produto/Campanha/Ação se perde. Tasks novas viram duplicatas das anteriores. Renomear o Space é OK (LJ acha pelo ID).</p>
          </div>
        </div>`
      : '';

    return `<div class="space-y-5">
      ${encWarn}
      ${readOnlyBanner}
      ${spaceDeleteBanner}

      <div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <div class="w-8 h-8 rounded-lg bg-purple-100 grid place-items-center"><i data-lucide="check-square" class="w-4 h-4 text-purple-700"></i></div>
              <h3 class="text-lg font-black">ClickUp</h3>
              ${status.connected ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700">✓ Conectado · ${Utils.escape(status.workspaceName || '')}</span>` : '<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-600">Não conectado</span>'}
            </div>
            <p class="text-sm text-slate-500">Crie tarefas no ClickUp direto do Mapa da Receita ou via chat do Djow.</p>
          </div>
          ${status.connected ? `<button onclick="Actions.disconnectClickup()" class="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-black">Desconectar</button>` : ''}
        </div>

        ${!status.connected ? `
        <div class="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
          <div class="flex items-center gap-2"><span class="w-6 h-6 rounded-full bg-slate-900 text-white grid place-items-center text-xs font-black">1</span><p class="font-black text-slate-900">Gere seu Personal API Token no ClickUp</p></div>
          <p class="text-sm text-slate-600">No ClickUp: clique na sua foto (canto superior direito) → <b>Settings</b> → menu <b>Apps</b> (ou <b>API da ClickUp</b>) → seção <b>API Token</b> → <b>Generate</b> (ou <b>Copy</b> se já existir). Atalho: <a href="https://app.clickup.com/settings/apps" target="_blank" class="text-purple-700 font-bold underline">app.clickup.com/settings/apps</a></p>
          <p class="text-xs text-slate-500 italic">O token começa com <code class="bg-white px-1.5 py-0.5 rounded text-purple-700 font-mono">pk_</code> e não expira.</p>
        </div>

        <div class="rounded-2xl bg-purple-50 border-2 border-purple-300 p-4 space-y-3">
          <div class="flex items-center gap-2"><span class="w-6 h-6 rounded-full bg-purple-700 text-white grid place-items-center text-xs font-black">2</span><p class="font-black text-purple-900">Cole o token e conecte</p></div>
          <input type="password" value="${Utils.escape(draft)}" oninput="Actions.updateClickupPatDraft(this.value)" placeholder="pk_xxxxxxxxxxxxxxxxxxxxxxxxxx" class="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-mono" />
          <button onclick="Actions.connectClickupWithPAT()" ${!status.encryptionReady ? 'disabled' : ''} class="px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black disabled:opacity-50" style="color:#fff!important;">🔗 Conectar ao ClickUp</button>
        </div>
        ` : `
        <div class="rounded-2xl bg-emerald-50 border-2 border-emerald-300 p-4">
          <p class="font-black text-emerald-900 mb-1">✓ ClickUp conectado em <b>${Utils.escape(status.workspaceName || '')}</b></p>
          <p class="text-sm text-emerald-800">Agora você pode criar tarefas no ClickUp diretamente do Mapa da Receita (botão "Criar tarefa via Djow") ou pedindo pro Djow no chat: <i>"cria uma task pra revisar a campanha"</i>.</p>
        </div>

        ${this._clickupMirrorCard(status)}
        ${this._clickupListConfigCard(status)}

        <!-- V32.2.3 (Geraldo A18) — Settings detalhadas em <details> colapsável.
             Antes: 5 cards em scroll vertical longo. Mobile virava inferno.
             Agora: cards principais (Mirror + List config) sempre abertos;
             "Avançado" colapsa Marker + Status map + Write mode. -->
        <details class="rounded-2xl bg-white border border-slate-200 overflow-hidden">
          <summary class="px-4 py-3 cursor-pointer font-black text-sm text-slate-700 flex items-center gap-2 select-none hover:bg-slate-50">
            <i data-lucide="chevron-right" class="w-4 h-4 transition-transform"></i>
            Configurações avançadas (marcação, status, modo de escrita)
          </summary>
          <div class="p-4 space-y-3 border-t border-slate-200 bg-slate-50">
            ${this._clickupMarkerCard(status)}
            ${this._clickupStatusMapCard(status)}
            ${this._clickupWriteModeCard(status)}
          </div>
        </details>
        `}
      </div>

      ${App.state.showClickupListPicker ? this._clickupListPickerModal() : ''}
    </div>`;
  },

  // V32.1.3 — Card "List de destino" no painel Integrações (visível quando ClickUp conectado).
  // Geraldo safe-integration: força user escolher explicitamente onde tasks nascem,
  // em vez de chutar a primeira list do ClickUp do cliente.
  // V32.2.2 (Geraldo A2) — Em modo mirror, default_list_id é morto (mirror resolve
  // via cascada). Esconde card pra evitar duplicação cognitiva.
  _clickupListConfigCard(status) {
    if (status.mirrorEnabled !== false && status.ljSpaceId) return '';
    const hasList = Boolean(status.defaultListId);
    return `<div class="rounded-2xl ${hasList ? 'bg-white border border-slate-200' : 'bg-amber-50 border-2 border-amber-300'} p-4 space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <p class="font-black ${hasList ? 'text-slate-900' : 'text-amber-900'} text-sm flex items-center gap-2">
            <i data-lucide="${hasList ? 'check-circle' : 'alert-triangle'}" class="w-4 h-4"></i>
            ${hasList ? 'List de destino configurada' : 'ATENÇÃO — List de destino NÃO configurada'}
          </p>
          ${hasList
            ? `<p class="text-xs text-slate-600 mt-1">Tasks criadas pelo LJ vão pra: <b>${Utils.escape(status.defaultListName || status.defaultListId)}</b> <code class="text-[10px] bg-slate-100 px-1 py-0.5 rounded ml-1">${Utils.escape(String(status.defaultListId))}</code></p>`
            : `<p class="text-xs text-amber-800 mt-1 leading-relaxed">Por segurança, o LJ NÃO escolhe automaticamente onde criar tasks. Tentar criar agora vai dar erro. Clique abaixo pra escolher a list (recomendado: crie uma list dedicada chamada "LeadJourney" no seu ClickUp antes).</p>`
          }
        </div>
        <button onclick="Actions.openClickupListPicker()" class="px-3 py-2 rounded-xl ${hasList ? 'bg-slate-900 text-white' : 'bg-amber-600 text-white animate-pulse'} font-black text-xs flex items-center gap-1.5 shrink-0" style="color:#fff!important;">
          <i data-lucide="list-tree" class="w-3.5 h-3.5"></i>${hasList ? 'Trocar' : 'Configurar list'}
        </button>
      </div>
    </div>`;
  },

  // V32.1.4 — Card "Marcação automática" (tag + prefixo).
  // Geraldo safe-integration #B: toda task criada pelo LJ ganha tag identificável
  // no ClickUp do cliente. Cliente vê de um lance o que é dele × o que é LJ.
  _clickupMarkerCard(status) {
    const drafts = App.state.clickupMarkerDrafts || { ljTagName: '', taskPrefix: '' };
    const currentTag = status.ljTagName;
    const currentPrefix = status.taskPrefix;

    return `<div class="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="font-black text-slate-900 text-sm flex items-center gap-2">
            <i data-lucide="tag" class="w-4 h-4 text-purple-700"></i>
            Marcação automática
          </p>
          <p class="text-[11px] text-slate-500 mt-0.5">Pra distinguir tasks do LJ × tasks do time do cliente no ClickUp.</p>
        </div>
      </div>

      <div class="grid md:grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-black text-slate-700 uppercase">Tag automática</label>
          <div class="flex items-center gap-2 mt-1">
            <input
              type="text"
              value="${Utils.escape(drafts.ljTagName || currentTag || '')}"
              oninput="Actions.updateClickupMarkerDraft('ljTagName', this.value)"
              placeholder="${Utils.escape(currentTag || 'lj-auto')}"
              maxlength="64"
              class="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-mono"
            />
            ${currentTag ? `<button onclick="Actions.clearClickupMarker('lj_tag_name')" title="Remover tag automática" class="p-2 rounded-xl bg-red-50 border border-red-200 text-red-700"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>` : ''}
          </div>
          <p class="text-[11px] text-slate-500 mt-1">
            ${currentTag
              ? `Atual: <code class="bg-slate-100 px-1 rounded">${Utils.escape(currentTag)}</code>. Tag será criada no space se não existir.`
              : 'Sugestão: <code class="bg-slate-100 px-1 rounded">lj-auto</code>. Identifica tasks criadas pelo LJ.'}
          </p>
        </div>

        <div>
          <label class="text-xs font-black text-slate-700 uppercase">Prefixo do nome</label>
          <div class="flex items-center gap-2 mt-1">
            <input
              type="text"
              value="${Utils.escape(drafts.taskPrefix || currentPrefix || '')}"
              oninput="Actions.updateClickupMarkerDraft('taskPrefix', this.value)"
              placeholder="${Utils.escape(currentPrefix || 'ex: [LJ] ')}"
              maxlength="32"
              class="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-mono"
            />
            ${currentPrefix ? `<button onclick="Actions.clearClickupMarker('task_prefix')" title="Remover prefixo" class="p-2 rounded-xl bg-red-50 border border-red-200 text-red-700"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>` : ''}
          </div>
          <p class="text-[11px] text-slate-500 mt-1">
            ${currentPrefix
              ? `Atual: <code class="bg-slate-100 px-1 rounded">${Utils.escape(currentPrefix)}</code> antes do nome da task.`
              : 'Opcional. Ex: <code class="bg-slate-100 px-1 rounded">[LJ] </code> vira "[LJ] Nome da task".'}
          </p>
        </div>
      </div>

      <div class="flex justify-end pt-1">
        <button onclick="Actions.saveClickupMarkers()" class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs flex items-center gap-1.5" style="color:#fff!important;">
          <i data-lucide="check" class="w-3.5 h-3.5"></i>Salvar marcação
        </button>
      </div>
    </div>`;
  },

  // V32.1.5 — Card "Mapping de status" (LJ → ClickUp).
  // Geraldo safe-integration #C: cliente escolhe como mapear statuses LJ
  // (pending/in_progress/completed) pros statuses da list dele. Sem
  // mapping, ClickUp usa status default da list (que pode ser qualquer).
  _clickupStatusMapCard(status) {
    if (!status.defaultListId) {
      // Sem list configurada → não dá pra mapear statuses ainda
      return '';
    }
    const meta = App.state.clickupMeta || {};
    const statuses = Array.isArray(meta.statuses) ? meta.statuses : [];
    const drafts = App.state.clickupStatusMapDraft || { pending: '', in_progress: '', completed: '' };
    const current = status.statusMap || {};
    const hasMap = Boolean(current.pending || current.in_progress || current.completed);

    // Auto-load metadata se vazio (a UI precisa dos statuses pra montar os dropdowns)
    if (!meta.loaded && !App._clickupMetaHydrated) {
      App._clickupMetaHydrated = true;
      setTimeout(() => Actions.loadClickupMetadata?.(), 50);
    }

    if (!statuses.length) {
      return `<div class="rounded-2xl bg-white border border-slate-200 p-4">
        <p class="text-xs text-slate-500 italic">Carregando statuses da list ClickUp...</p>
      </div>`;
    }

    const dropdown = (ljStatus, label) => {
      const currentValue = drafts[ljStatus] || current[ljStatus] || '';
      const opts = ['<option value="">— escolha —</option>',
        ...statuses.map(s => `<option value="${Utils.escape(s.status)}" ${currentValue === s.status ? 'selected' : ''}>${Utils.escape(s.status)}</option>`)
      ].join('');
      return `<div>
        <label class="text-xs font-black text-slate-700 uppercase">${label}</label>
        <select onchange="Actions.updateClickupStatusMapDraft('${ljStatus}', this.value)" class="mt-1 w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm">
          ${opts}
        </select>
        ${current[ljStatus] ? `<p class="text-[10px] text-slate-500 mt-0.5">Atual: <code class="bg-slate-100 px-1 rounded">${Utils.escape(current[ljStatus])}</code></p>` : ''}
      </div>`;
    };

    return `<div class="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="font-black text-slate-900 text-sm flex items-center gap-2">
            <i data-lucide="arrow-right-left" class="w-4 h-4 text-indigo-700"></i>
            Mapping de status (LJ → ClickUp)
          </p>
          <p class="text-[11px] text-slate-500 mt-0.5">Como os 3 statuses internos do LJ traduzem pros statuses da list <b>${Utils.escape(status.defaultListName || status.defaultListId)}</b>.</p>
        </div>
        ${hasMap ? `<button onclick="Actions.clearClickupStatusMap()" title="Remover mapping" class="p-2 rounded-xl bg-red-50 border border-red-200 text-red-700"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>` : ''}
      </div>

      <div class="grid md:grid-cols-3 gap-3">
        ${dropdown('pending', 'LJ "pending" →')}
        ${dropdown('in_progress', 'LJ "in_progress" →')}
        ${dropdown('completed', 'LJ "completed" →')}
      </div>

      <p class="text-[11px] text-slate-500 italic">Sem mapping: tasks novas usam o status DEFAULT da list (ClickUp escolhe).</p>

      <div class="flex justify-end pt-1">
        <button onclick="Actions.saveClickupStatusMap()" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs flex items-center gap-1.5" style="color:#fff!important;">
          <i data-lucide="check" class="w-3.5 h-3.5"></i>Salvar mapping
        </button>
      </div>
    </div>`;
  },

  // V32.2.0 — Card "Hierarquia espelhada" (Produto>Campanha>Ação>Tarefa).
  // Geraldo decision (Felipe aprovado): LJ é opinionated. Estrutura idêntica
  // entre LJ e ClickUp do cliente. Mata cognitive load de traduzir.
  _clickupMirrorCard(status) {
    const mirrorOn = status.mirrorEnabled !== false;
    const hasSpace = Boolean(status.ljSpaceId);
    const cache = App.state._clickupMappingsCache;

    // Auto-load mappings se cache vazio
    if (hasSpace && !cache && !App._clickupMappingsHydrated) {
      App._clickupMappingsHydrated = true;
      setTimeout(() => Actions.loadClickupMappings?.(), 50);
    }

    return `<div class="rounded-2xl ${hasSpace ? 'bg-violet-50 border border-violet-300' : 'bg-amber-50 border-2 border-amber-300'} p-4 space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <p class="font-black ${hasSpace ? 'text-violet-900' : 'text-amber-900'} text-sm flex items-center gap-2">
            <i data-lucide="layers" class="w-4 h-4"></i>
            Hierarquia espelhada (Produto > Campanha > Ação > Tarefa)
          </p>
          ${hasSpace ? `
            <p class="text-xs text-violet-800 mt-1 leading-relaxed">
              LJ está espelhando sua estrutura no Space <b>${Utils.escape(cache?.ljSpaceName || 'LeadJourney')}</b> do ClickUp.
              ${cache?.counts
                ? (cache.counts.products === 0 && cache.counts.campaigns === 0 && cache.counts.actions === 0
                    ? '<i class="text-violet-600">Nenhum produto espelhado ainda — a hierarquia vai sendo criada conforme você criar tasks.</i>'
                    : `Já criou ${cache.counts.products} produto(s), ${cache.counts.campaigns} campanha(s), ${cache.counts.actions} ação(ões).`)
                : ''}
            </p>
            ${(() => {
              // V32.2.5 (Geraldo A13) — Lista detalhada dos mappings em <details>.
              // Cliente pode expandir e ver exatamente quais folders/lists/tasks
              // LJ criou no ClickUp dele.
              if (!cache?.mappings) return '';
              const groups = cache.mappings;
              const total = (groups.products?.length || 0) + (groups.campaigns?.length || 0) + (groups.actions?.length || 0);
              if (total === 0) return '';
              const row = (m, kind) => `<div class="flex items-center justify-between gap-2 py-1 text-[11px]">
                <span class="flex items-center gap-1.5 min-w-0">
                  <i data-lucide="${kind === 'product' ? 'folder' : kind === 'campaign' ? 'list' : 'check-square'}" class="w-3 h-3 text-slate-500 shrink-0"></i>
                  <span class="truncate font-semibold text-slate-700">${Utils.escape(m.clickup_name || `#${m.lj_id}`)}</span>
                  <code class="text-[9px] text-slate-400">LJ #${m.lj_id}</code>
                </span>
                <code class="text-[9px] text-slate-400 shrink-0">${Utils.escape(String(m.clickup_id))}</code>
              </div>`;
              return `<details class="mt-3 rounded-lg bg-white border border-violet-200 overflow-hidden">
                <summary class="px-3 py-2 cursor-pointer text-[11px] font-black text-violet-700 select-none hover:bg-violet-50 flex items-center gap-1.5">
                  <i data-lucide="chevron-right" class="w-3 h-3"></i>
                  Ver mappings detalhados (${total})
                </summary>
                <div class="px-3 py-2 space-y-2 border-t border-violet-100 bg-violet-50/30">
                  ${groups.products?.length ? `<div>
                    <p class="text-[10px] font-black uppercase text-slate-500 mb-1">📁 Folders (Produtos)</p>
                    ${groups.products.map(m => row(m, 'product')).join('')}
                  </div>` : ''}
                  ${groups.campaigns?.length ? `<div>
                    <p class="text-[10px] font-black uppercase text-slate-500 mb-1">📋 Lists (Campanhas)</p>
                    ${groups.campaigns.map(m => row(m, 'campaign')).join('')}
                  </div>` : ''}
                  ${groups.actions?.length ? `<div>
                    <p class="text-[10px] font-black uppercase text-slate-500 mb-1">📝 Tasks pai (Ações)</p>
                    ${groups.actions.map(m => row(m, 'action')).join('')}
                  </div>` : ''}
                </div>
              </details>`;
            })()}
          ` : `
            <p class="text-xs text-amber-800 mt-1 leading-relaxed">
              <b>Setup obrigatório:</b> LJ precisa criar um Space dedicado no seu ClickUp pra ser raiz da hierarquia.
              Sem isso, modo espelhado fica inativo. Botão abaixo cria 1 Space chamado "LeadJourney".
            </p>
          `}
        </div>
        <div class="flex flex-col gap-2 shrink-0">
          ${hasSpace
            ? `<button onclick="Actions.testClickupSpace()" title="Verifica se PAT consegue acessar o Space" class="px-3 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-black text-xs flex items-center gap-1.5">
                <i data-lucide="zap" class="w-3.5 h-3.5"></i>Testar
              </button>
              <button onclick="Actions.migrateClickupToMirror()" title="Cria toda a estrutura LJ atual no ClickUp em lote" class="px-3 py-2 rounded-xl bg-violet-100 hover:bg-violet-200 text-violet-800 font-black text-xs flex items-center gap-1.5">
                <i data-lucide="git-merge" class="w-3.5 h-3.5"></i>Migrar tudo
              </button>
              <button onclick="Actions.toggleClickupMirror()" class="px-3 py-2 rounded-xl ${mirrorOn ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-violet-600 hover:bg-violet-700 text-white'} font-black text-xs flex items-center gap-1.5" ${!mirrorOn ? 'style="color:#fff!important;"' : ''}>
                <i data-lucide="${mirrorOn ? 'pause' : 'play'}" class="w-3.5 h-3.5"></i>
                ${mirrorOn ? 'Desativar' : 'Reativar'}
              </button>`
            : `<button onclick="Actions.setupClickupSpace()" class="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center gap-1.5 animate-pulse" style="color:#fff!important;">
                <i data-lucide="zap" class="w-3.5 h-3.5"></i>Inicializar Space
              </button>`
          }
        </div>
      </div>
    </div>`;
  },

  // V32.1.6 — Card "Modo de escrita" (read-only toggle).
  // Geraldo safe-integration #D: cliente pode pausar a escrita do LJ no
  // ClickUp dele temporariamente (durante teste, mudança de pipeline, etc.)
  // sem precisar desconectar credenciais inteiras.
  _clickupWriteModeCard(status) {
    const writeOn = status.writeEnabled !== false;
    return `<div class="rounded-2xl ${writeOn ? 'bg-white border border-slate-200' : 'bg-amber-50 border-2 border-amber-300'} p-4">
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="font-black ${writeOn ? 'text-slate-900' : 'text-amber-900'} text-sm flex items-center gap-2">
            <i data-lucide="${writeOn ? 'pencil' : 'pause-circle'}" class="w-4 h-4 ${writeOn ? 'text-emerald-600' : 'text-amber-700'}"></i>
            Modo de escrita: ${writeOn ? 'ATIVO' : 'SOMENTE-LEITURA'}
          </p>
          <p class="text-[11px] ${writeOn ? 'text-slate-500' : 'text-amber-800'} mt-1 leading-relaxed">
            ${writeOn
              ? 'LJ pode criar e atualizar tasks no ClickUp normalmente. Pra pausar temporariamente (sem desconectar), ative somente-leitura.'
              : '⚠ LJ NÃO está criando nem atualizando tasks. Conexão segue ativa pra leitura (modal, etc.), mas escrita está bloqueada.'
            }
          </p>
        </div>
        <button onclick="Actions.toggleClickupWriteMode()" class="px-3 py-2 rounded-xl ${writeOn ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'} font-black text-xs flex items-center gap-1.5 shrink-0" style="color:#fff!important;">
          <i data-lucide="${writeOn ? 'pause' : 'play'}" class="w-3.5 h-3.5"></i>
          ${writeOn ? 'Pausar escrita' : 'Reativar escrita'}
        </button>
      </div>
    </div>`;
  },

  // V32.1.3 — Modal de seleção de list (tree picker: spaces > folders/lists > lists).
  _clickupListPickerModal() {
    const tree = App.state._clickupTreeCache;
    const loading = App.state.clickupTreeLoading;

    return `<div class="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onclick="event.target===this && Actions.closeClickupListPicker()">
      <div class="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <header class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 class="text-xl font-black text-slate-950">Escolher list de destino</h3>
            <p class="text-xs text-slate-500 mt-0.5">Onde o LJ vai criar tasks no seu ClickUp.</p>
          </div>
          <button onclick="Actions.closeClickupListPicker()" class="p-2 rounded-xl hover:bg-slate-100"><i data-lucide="x" class="w-4 h-4"></i></button>
        </header>

        <div class="overflow-auto p-5">
          <div class="rounded-2xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 mb-4 flex items-start gap-2">
            <i data-lucide="info" class="w-4 h-4 mt-0.5 shrink-0"></i>
            <div>
              <p class="font-black mb-0.5">Recomendação Geraldo:</p>
              <p>Antes de escolher, crie uma list dedicada no ClickUp (sugestão de nome: "LeadJourney"). Isso evita misturar tasks automatizadas com o trabalho do seu time.</p>
            </div>
          </div>

          ${loading || !tree ? `
            <div class="rounded-2xl bg-slate-50 border border-slate-200 p-8 text-center">
              <i data-lucide="loader" class="w-6 h-6 animate-spin mx-auto text-slate-500"></i>
              <p class="text-sm text-slate-500 mt-3">Carregando árvore do ClickUp...</p>
            </div>
          ` : (tree.spaces || []).length === 0 ? `
            <div class="rounded-2xl bg-slate-50 border border-slate-200 p-6 text-center text-slate-500 text-sm">
              Nenhum space encontrado neste workspace.
            </div>
          ` : `
            <div class="space-y-3">
              ${(tree.spaces || []).map(space => this._clickupListPickerSpace(space, tree.defaultListId)).join('')}
            </div>
          `}
        </div>

        <footer class="px-6 py-3 border-t border-slate-200 flex justify-between items-center gap-2">
          <button onclick="Actions.loadClickupTree()" class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black flex items-center gap-1.5">
            <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i>Recarregar
          </button>
          <button onclick="Actions.closeClickupListPicker()" class="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 font-black text-xs">Cancelar</button>
        </footer>
      </div>
    </div>`;
  },

  _clickupListPickerSpace(space, currentListId) {
    return `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-3">
      <div class="flex items-center gap-2 mb-2">
        <i data-lucide="layout-grid" class="w-4 h-4 text-slate-500"></i>
        <p class="font-black text-slate-700 text-sm">${Utils.escape(space.name)}</p>
        <code class="text-[10px] text-slate-400">${Utils.escape(space.id)}</code>
      </div>

      ${(space.folderlessLists || []).length > 0 ? `
        <div class="space-y-1 mb-2">
          ${(space.folderlessLists || []).map(l => this._clickupListPickerRow(l, space, currentListId)).join('')}
        </div>
      ` : ''}

      ${(space.folders || []).map(folder => `
        <div class="ml-3 pl-3 border-l-2 border-slate-200 mt-2">
          <p class="text-xs font-black text-slate-500 mb-1 flex items-center gap-1">
            <i data-lucide="folder" class="w-3 h-3"></i>${Utils.escape(folder.name)}
          </p>
          <div class="space-y-1">
            ${(folder.lists || []).map(l => this._clickupListPickerRow(l, space, currentListId)).join('')}
          </div>
        </div>
      `).join('')}

      ${(space.folderlessLists || []).length === 0 && (space.folders || []).length === 0 ? `
        <p class="text-xs text-slate-400 italic">— Sem lists neste space —</p>
      ` : ''}
    </div>`;
  },

  _clickupListPickerRow(list, space, currentListId) {
    const isCurrent = String(currentListId) === String(list.id);
    return `<button onclick="Actions.selectClickupList('${Utils.escape(String(list.id))}', '${Utils.escape(String(space.id))}', '${Utils.escape(list.name).replace(/'/g, "&#39;")}')" class="w-full text-left px-3 py-2 rounded-lg flex items-center justify-between gap-2 ${isCurrent ? 'bg-emerald-100 border-2 border-emerald-300' : 'bg-white border border-slate-200 hover:bg-slate-50'}">
      <span class="flex items-center gap-2 text-sm">
        <i data-lucide="${isCurrent ? 'check-circle' : 'circle'}" class="w-3.5 h-3.5 ${isCurrent ? 'text-emerald-700' : 'text-slate-300'}"></i>
        <span class="${isCurrent ? 'font-black text-emerald-900' : 'text-slate-700'}">${Utils.escape(list.name)}</span>
      </span>
      <code class="text-[10px] text-slate-400">${Utils.escape(String(list.id))}</code>
    </button>`;
  },

  render() {
    if (!App.state.showSettingsModal) return '';

    const active = this.activeSection();
    // V22.2 — Consolidação: 'rd' e 'rdCrm' viraram uma seção só "Conexão RD Station".
    // Mantemos o alias 'rdCrm' redirecionando p/ 'rd' por compat de bookmarks/links.
    const resolvedActive = active === 'rdCrm' ? 'rd' : active;
    const titleMap = { rd: 'Conexão RD Station', backup: 'Backup', database: 'Banco de Dados', execution: 'Execução Operacional', integrations: 'Integrações', agents: 'Agentes Externos', users: 'Usuários', admin: 'Administrar Lead Journey', tenants: 'Tenants (Global Mode)', myDb: 'Meu Banco', myAccount: 'Minha Conta' };
    const subtitleMap = {
      rd: 'Token CRM, pipelines por campanha, sincronização de leads e (opcional) RD Marketing — tudo em um lugar.',
      backup: 'Prepare snapshots, restauração e segurança dos dados.',
      database: 'Escolha Local, Supabase ou Amazon e deixe o LeadScore pronto para sincronizar.',
      execution: 'Configure ClickUp, Trello, Monday, Jira, Notion ou modo Manual para onde as tarefas devem ser criadas.',
      integrations: 'Conecte serviços externos (ClickUp, etc.) pra criar tarefas automaticamente via Djow ou modal.',
      agents: 'Configure o Djow (Railway) e outros agentes que interpretam comandos em linguagem natural.',
      users: 'V23.0.0 — Aprove cadastros pendentes, gerencie modo (produção/sandbox) e revogue acessos.',
      admin: 'V31.2.1 — Ações administrativas críticas. Cuidado: aqui você apaga dados em cascata sem volta.',
      tenants: 'V32.0.12 — Multi-tenant SaaS. Cada cliente tem um tenant; pode opcionalmente ter Postgres próprio plugado.',
      myDb: 'V32.1.1 — Plug seu próprio Postgres pra isolar 100% seus dados. Connection string fica criptografada no servidor.',
      myAccount: 'V32.1.2 — Personalize seu nome de exibição. Login (e-mail) e tenant são imutáveis aqui.'
    };
    const title = titleMap[resolvedActive] || titleMap.database;
    const subtitle = subtitleMap[resolvedActive] || subtitleMap.database;

    const content = resolvedActive === 'rd' ? this.rdConnectionPanel()
      : resolvedActive === 'execution' ? this.executionPanel()
      : resolvedActive === 'integrations' ? this.integrationsPanel()
      : resolvedActive === 'agents' ? this.agentsPanel()
      : resolvedActive === 'backup' ? this.backupPanel()
      : resolvedActive === 'users' ? this.usersPanel()
      : resolvedActive === 'admin' ? this.adminPanel()
      : resolvedActive === 'tenants' ? this.tenantsPanel()
      : resolvedActive === 'myDb' ? this.myDbPanel()
      : resolvedActive === 'myAccount' ? this.myAccountPanel()
      : this.databasePanel();

    return `<div id="settingsModalBackdrop" class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm p-4 overflow-auto">
      <section id="settingsModal" class="max-w-6xl mx-auto rounded-[2rem] bg-slate-50 shadow-2xl overflow-hidden border border-white/20">
        <header class="bg-slate-950 text-white p-6 flex items-start justify-between gap-4">
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-black mb-4">
              <i data-lucide="settings" class="w-4 h-4"></i>
              Configurações do sistema
            </div>
            <h2 class="text-3xl font-black">${title}</h2>
            <p class="text-slate-300 mt-2">${subtitle}</p>
          </div>
          <button onclick="Actions.closeSettingsModal()" class="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 font-black flex items-center gap-2">
            <i data-lucide="x" class="w-4 h-4"></i>
            Fechar
          </button>
        </header>

        <main class="grid lg:grid-cols-[260px_1fr] min-h-[620px]">
          <aside class="bg-white border-r border-slate-200 p-5 space-y-3">
            ${this.sectionButton('myAccount','Minha Conta','user')}
            ${this.sectionButton('database','Banco de Dados','database')}
            ${App.currentUser?.tenantId ? this.sectionButton('myDb','Meu Banco','hard-drive-download') : ''}
            ${this.sectionButton('rd','Conexão RD Station','plug-zap')}
            ${App.currentUser?.isMaster ? this.sectionButton('users','Usuários','users') : ''}
            ${this.sectionButton('execution','Execução Operacional','kanban')}
            ${this.sectionButton('integrations','Integrações','link')}
            ${this.sectionButton('agents','Agentes Externos','cpu')}
            ${this.sectionButton('backup','Backup em breve','archive')}
            ${App.currentUser?.isMaster ? `<div class="border-t border-slate-200 my-3"></div>${this.sectionButton('admin','Administrar Lead Journey','shield-alert')}${this.sectionButton('tenants','Tenants (Global Mode)','layers')}` : ''}
          </aside>

          <section id="settingsModalScroll" class="p-5 lg:p-6 overflow-auto">
            ${content}
          </section>
        </main>
      </section>
    </div>`;
  }
};
window.SettingsModal = SettingsModal;

// Stub mantido para appActions.js (Actions.openRDSettings chama RDSettingsInjection?.inject?.())
window.RDSettingsInjection = { inject() {} };
