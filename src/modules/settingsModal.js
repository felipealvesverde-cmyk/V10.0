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

  rdPanel() {
    const cfg = (App.state.integrations && App.state.integrations.rd) || (window.RDConfig ? RDConfig.defaultConfig() : {});
    const statusClass = ['ready_for_api_test','ready_for_oauth','configured','connected'].includes(cfg.status) ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-amber-600 bg-amber-50 border-amber-200';

    const fields = [
      ['clientId','Client ID','Client ID do app RD','text'],
      ['clientSecret','Client Secret','Client Secret do app RD','password'],
      ['redirectUri','Redirect URI','http://localhost:3000/rd/callback','text'],
      ['authorizationCode','Authorization Code','Cole aqui o code retornado pelo OAuth','text'],
      ['accessToken','Access Token','Opcional para teste interno','password'],
      ['refreshToken','Refresh Token','Opcional para teste interno','password'],
      ['accountName','Conta / Workspace','Nome da conta RD','text']
    ];

    const hasCrmToken = Boolean((cfg.crmPersonalToken || '').trim());

    return `<div class="space-y-5">
      <div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
          <div>
            <div class="flex items-center gap-2 mb-2">
              <i data-lucide="plug-zap" class="w-5 h-5 text-sky-600"></i>
              <h3 class="text-2xl font-black text-slate-950">Integração RD Station</h3>
            </div>
            <p class="text-sm text-slate-500 max-w-2xl">Configure OAuth para conectar ações RD Email ao RD Station.</p>
          </div>
          <span class="px-3 py-2 rounded-2xl border text-xs font-black ${statusClass}">${Utils.escape(cfg.status || 'not_configured')}</span>
        </div>

        <!-- V21.4.3 — CRM Personal Token em destaque: é o que de fato libera tudo do CRM -->
        <div class="rounded-2xl border ${hasCrmToken ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'} p-4 mb-4">
          <div class="flex items-start gap-3">
            <i data-lucide="key-round" class="w-5 h-5 ${hasCrmToken ? 'text-emerald-700' : 'text-amber-700'} mt-0.5"></i>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <h4 class="font-black ${hasCrmToken ? 'text-emerald-900' : 'text-amber-900'}">CRM Personal Token</h4>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${hasCrmToken ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'}">${hasCrmToken ? 'configurado' : 'obrigatório'}</span>
              </div>
              <p class="text-xs ${hasCrmToken ? 'text-emerald-800' : 'text-amber-800'} mb-3">
                Gerado em <b>RD CRM → Configurações → Todas as configurações → Integrações</b>. É <b>obrigatório</b> para qualquer feature do CRM (pipeline, stages, deals, scoring). Diferente do Access Token do OAuth abaixo, que é da família Marketing.
              </p>
              ${this._input('crmPersonalToken','','Cole aqui o token gerado no painel do CRM','password',cfg.crmPersonalToken)}
            </div>
          </div>
        </div>

        <details class="rounded-2xl border border-slate-200 bg-white mb-4">
          <summary class="cursor-pointer px-4 py-3 font-black text-sm text-slate-700 flex items-center gap-2">
            <i data-lucide="chevron-right" class="w-4 h-4"></i>
            OAuth do RD Marketing (opcional — futuro: emails, contatos, KPIs)
          </summary>
          <div class="px-4 pb-4 pt-2 grid md:grid-cols-2 gap-4">
            ${fields.map(([field, label, placeholder, type]) => this._input(field, label, placeholder, type, cfg[field])).join('')}
          </div>
        </details>

        <div class="grid md:grid-cols-2 gap-4">
          <div>
            <label class="text-xs font-black text-slate-500 uppercase tracking-wide">Frequência padrão</label>
            <select onchange="Actions.updateRDConfig('syncFrequency', this.value)" class="mt-1 w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-semibold text-slate-900">
              ${['manual','daily','weekly'].map(v => `<option value="${v}" ${cfg.syncFrequency === v ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="flex flex-wrap gap-3 mt-5">
          <button onclick="Actions.generateRDAuthUrl()" class="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black hover:bg-slate-800" style="color:#fff!important;">1) Gerar URL OAuth</button>
          <button onclick="Actions.openRDAuthUrl()" class="px-5 py-3 rounded-2xl bg-sky-600 text-white font-black hover:bg-sky-700" style="color:#fff!important;">2) Abrir URL OAuth</button>
          <button onclick="Actions.copyRDAuthUrl()" class="px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-900 font-black hover:bg-slate-50">Copiar URL</button>
          <button onclick="Actions.exchangeRDAuthorizationCode()" ${cfg.authorizationCode ? '' : 'disabled'} class="px-5 py-3 rounded-2xl ${cfg.authorizationCode ? 'bg-violet-600 hover:bg-violet-700 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'} font-black" ${cfg.authorizationCode ? 'style="color:#fff!important;"' : ''}>3) Trocar code por token</button>
          <button onclick="Actions.refreshRDAccessToken()" ${cfg.refreshToken ? '' : 'disabled'} class="px-5 py-3 rounded-2xl ${cfg.refreshToken ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'} font-black" ${cfg.refreshToken ? 'style="color:#fff!important;"' : ''}>Renovar token</button>
          <button onclick="Actions.testRDConnection()" class="px-5 py-3 rounded-2xl bg-emerald-600 text-white font-black hover:bg-emerald-700" style="color:#fff!important;">Testar conexão</button>
          <button onclick="Actions.clearRDConfig()" class="px-5 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 font-black hover:bg-red-100">Limpar RD</button>
        </div>

        ${this._rdTokenStatusBlock(cfg)}

        ${cfg.authUrl ? `<div class="mt-5 rounded-2xl bg-slate-950 p-4">
          <div class="flex items-center justify-between gap-3 mb-2">
            <p class="text-xs text-slate-400 font-black">URL OAuth gerada</p>
            <button onclick="Actions.copyRDAuthUrl()" class="px-3 py-1 rounded-xl bg-white/10 text-white text-xs font-black">Copiar</button>
          </div>
          <textarea readonly class="w-full min-h-[92px] rounded-xl bg-slate-900 border border-white/10 text-sky-100 text-xs p-3">${Utils.escape(cfg.authUrl)}</textarea>
          <p class="text-xs text-slate-400 mt-2">Depois de autorizar, copie o valor depois de <strong>?code=</strong> e cole em Authorization Code.</p>
        </div>` : `<div class="mt-5 rounded-2xl bg-slate-50 border border-slate-100 p-4">
          <p class="text-sm text-slate-600"><strong>Próximo passo:</strong> preencha Client ID e Redirect URI, depois clique em Gerar URL OAuth.</p>
        </div>`}
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

  agentsPanel() {
    const cfg = (App.state.agentConfig?.djow) || (window.AgentRegistry ? AgentRegistry.defaultConfig().djow : {});
    const health = window.AgentHealthMonitor ? AgentHealthMonitor.snapshot() : { status: 'unknown', latencyMs: null, checkedAt: null, error: null, enabled: false };
    const statusBadge = health.status === 'online'
      ? `<span class="px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-emerald-500"></span> Online ${health.latencyMs ? `• ${health.latencyMs}ms` : ''}</span>`
      : health.status === 'offline'
        ? `<span class="px-3 py-2 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-black flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-red-500"></span> Offline ${health.error ? `• ${Utils.escape(health.error)}` : ''}</span>`
        : `<span class="px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 text-xs font-black flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-slate-400"></span> Nunca testado</span>`;
    return `<div class="space-y-5">
      <div class="rounded-3xl bg-white border border-slate-100 p-5 shadow-sm">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
          <div>
            <div class="flex items-center gap-2 mb-1"><i data-lucide="cpu" class="w-5 h-5 text-indigo-600"></i><h3 class="text-2xl font-black text-slate-950">Djow (Railway)</h3></div>
            <p class="text-sm text-slate-500">Agente externo que interpreta comandos em linguagem natural e devolve tarefas estruturadas.</p>
          </div>
          ${statusBadge}
        </div>
        <div class="grid md:grid-cols-2 gap-3">
          ${this._agentInput('name', 'Nome do agente', cfg.name)}
          ${this._agentInput('url', 'URL da API Railway', cfg.url, 'https://djow-production.up.railway.app')}
          ${this._agentInput('endpoint', 'Endpoint principal', cfg.endpoint, '/execute')}
          ${this._agentInput('method', 'Método HTTP', cfg.method, 'POST')}
          ${this._agentInput('apiKey', 'API Key', cfg.apiKey, '', true)}
          ${this._agentInput('timeoutMs', 'Timeout (ms)', cfg.timeoutMs, '30000', false, 'number')}
        </div>
        <label class="mt-4 flex items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-slate-200">
          <span class="text-sm font-black text-slate-900">Agente ativo</span>
          <button onclick="Actions.toggleAgentEnabled('djow')" class="relative w-12 h-7 rounded-full transition ${cfg.enabled ? 'bg-emerald-500' : 'bg-slate-300'}" aria-pressed="${cfg.enabled}">
            <span class="absolute top-1 ${cfg.enabled ? 'right-1' : 'left-1'} w-5 h-5 rounded-full bg-white shadow"></span>
          </button>
        </label>
        <div class="flex flex-wrap gap-2 mt-4">
          <button onclick="Actions.testAgentConnection('djow')" class="px-4 py-2.5 rounded-2xl bg-slate-900 text-white font-black text-sm" style="color:#fff!important;">Testar conexão</button>
          <button onclick="Actions.saveAgentConfig('djow')" class="px-4 py-2.5 rounded-2xl bg-emerald-600 text-white font-black text-sm">Salvar</button>
          <button onclick="Actions.resetAgentConfig('djow')" class="px-4 py-2.5 rounded-2xl bg-red-50 border border-red-200 text-red-600 font-black text-sm">Limpar</button>
        </div>
        ${health.checkedAt ? `<p class="text-[11px] text-slate-400 mt-3">Última checagem: ${Utils.escape(new Date(health.checkedAt).toLocaleString('pt-BR'))}</p>` : ''}
      </div>
    </div>`;
  },

  _agentInput(field, label, value, placeholder = '', sensitive = false, type = 'text') {
    return `<div>
      <label class="text-xs font-black text-slate-500 uppercase tracking-wide">${label}</label>
      <input type="${sensitive ? 'password' : type}" value="${Utils.escape(String(value ?? ''))}" oninput="Actions.updateAgentField('djow', '${field}', this.value)" placeholder="${Utils.escape(placeholder || '')}" class="mt-1 w-full px-4 py-3 rounded-2xl bg-white border border-slate-200 font-semibold text-slate-900" />
    </div>`;
  },

  render() {
    if (!App.state.showSettingsModal) return '';

    const active = this.activeSection();
    const titleMap = { rd: 'RD Station', rdCrm: 'API RD CRM', backup: 'Backup', database: 'Banco de Dados', execution: 'Execução Operacional', agents: 'Agentes Externos' };
    const subtitleMap = {
      rd: 'Conecte o RD Station Marketing (OAuth, RD Email).',
      rdCrm: 'Provisione pipelines, etapas e sync de leads via API RD Station CRM.',
      backup: 'Prepare snapshots, restauração e segurança dos dados.',
      database: 'Escolha Local, Supabase ou Amazon e deixe o LeadScore pronto para sincronizar.',
      execution: 'Configure ClickUp, Trello, Monday, Jira, Notion ou modo Manual para onde as tarefas devem ser criadas.',
      agents: 'Configure o Djow (Railway) e outros agentes que interpretam comandos em linguagem natural.'
    };
    const title = titleMap[active] || titleMap.database;
    const subtitle = subtitleMap[active] || subtitleMap.database;

    const content = active === 'rd' ? this.rdPanel()
      : active === 'rdCrm' ? this.rdCrmPanel()
      : active === 'execution' ? this.executionPanel()
      : active === 'agents' ? this.agentsPanel()
      : active === 'backup' ? this.backupPanel()
      : this.databasePanel();

    return `<div class="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm p-4 overflow-auto">
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
            ${this.sectionButton('database','Banco de Dados','database')}
            ${this.sectionButton('rd','RD Station','plug-zap')}
            ${this.sectionButton('rdCrm','API RD CRM','workflow')}
            ${this.sectionButton('execution','Execução Operacional','kanban')}
            ${this.sectionButton('agents','Agentes Externos','cpu')}
            ${this.sectionButton('backup','Backup em breve','archive')}
          </aside>

          <section class="p-5 lg:p-6 overflow-auto">
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
