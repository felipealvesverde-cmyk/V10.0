// V35.14.2 — GA4 Wizard Modal (5 steps + manage mode).
//
// Step 1 — Perfil de negócio (lead gen / e-commerce / conteúdo / institucional / custom)
// Step 2 — Credenciais (client_id + client_secret + link p/ Cloud Console)
// Step 3 — Autorizar OAuth (popup Google)
// Step 4 — Escolher property + packs + frequência de sync
// Step 5 — Sucesso
//
// Manage mode (quando já conectado): status + Atualizar agora + Desconectar.
//
// Sub-wizard de customs (Tela 7), fluxo dedicado de e-commerce e dashboard
// vêm em sub-onda seguinte.

window.Ga4WizardModal = {
  render() {
    const w = App.state.ga4Wizard;
    if (!w) return '';

    const isManage = w.mode === 'manage';
    const headerKicker = isManage ? 'Gerenciar GA4' : 'Conectar GA4';

    return `<div class="fixed inset-0 z-[90] grid place-items-center p-4"
      style="background: rgba(10,31,68,0.85); backdrop-filter: blur(6px);"
      onclick="if(event.target===this) Actions.closeGa4Wizard()">
      <div class="w-full max-w-2xl rounded-3xl border-2 border-amber-400/40 shadow-2xl overflow-hidden"
        style="background: linear-gradient(135deg, #0A1F44 0%, #001230 100%);">

        <div class="border-b border-white/10 px-5 py-4 flex items-start justify-between gap-3"
          style="background: linear-gradient(90deg, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.05) 100%);">
          <div class="min-w-0">
            <p class="text-[10px] font-black text-amber-300 uppercase tracking-widest inline-flex items-center gap-1.5">
              <i data-lucide="line-chart" class="w-3 h-3"></i> ${headerKicker}
            </p>
            <h2 class="text-lg font-black text-white mt-1 leading-tight">Google Analytics 4 · Tráfego e Funil</h2>
            <p class="text-[11px] text-slate-300 mt-0.5">Visitas, origem, conversões e funil do site. Cruza com Ads pra fechar a leitura.</p>
          </div>
          <button onclick="Actions.closeGa4Wizard()" class="shrink-0 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 grid place-items-center">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        ${isManage ? '' : this._stepper(w)}

        <div class="p-5 max-h-[65vh] overflow-y-auto">
          ${isManage ? this._manageView() : ''}
          ${!isManage && w.step === 1 ? this._step1Profile(w) : ''}
          ${!isManage && w.step === 2 ? this._step2Credentials(w) : ''}
          ${!isManage && w.step === 3 ? this._step3Authorize(w) : ''}
          ${!isManage && w.step === 4 ? this._step4PropertyAndPacks(w) : ''}
          ${!isManage && w.step === 6 ? this._step6Customs(w) : ''}
          ${!isManage && (w.step === 5 || w.step === 7) ? this._stepFinalSuccess(w) : ''}
        </div>
      </div>
    </div>`;
  },

  _stepper(w) {
    const steps = [
      { n: 1, label: 'Perfil' },
      { n: 2, label: 'Credenciais' },
      { n: 3, label: 'Autorizar' },
      { n: 4, label: 'Configurar' }
    ];
    return `<div class="px-5 py-3 border-b border-white/10 flex items-center gap-2 overflow-x-auto"
      style="background: rgba(255,255,255,0.02);">
      ${steps.map((s, i) => {
        const isCurrent = w.step === s.n;
        const isDone = w.step > s.n;
        const dotCls = isCurrent ? 'bg-amber-400 text-slate-900' : isDone ? 'bg-emerald-500 text-white' : 'bg-white/10 text-slate-400';
        const labelCls = isCurrent ? 'text-amber-200 font-black' : isDone ? 'text-emerald-300 font-bold' : 'text-slate-400';
        return `<div class="flex items-center gap-2 shrink-0">
          <span class="w-6 h-6 rounded-full ${dotCls} grid place-items-center text-[10px] font-black">${isDone ? '✓' : s.n}</span>
          <span class="text-[11px] uppercase tracking-wider ${labelCls}">${s.label}</span>
          ${i < steps.length - 1 ? '<i data-lucide="chevron-right" class="w-3 h-3 text-slate-600 mx-1"></i>' : ''}
        </div>`;
      }).join('')}
    </div>`;
  },

  // ---- STEP 1: Perfil de negócio --------------------------------------------
  _step1Profile(w) {
    const profiles = [
      { id: 'leadgen', label: 'Lead Gen / SaaS / Serviços', desc: 'Captura lead via formulário, fecha no comercial.', icon: 'users' },
      { id: 'ecommerce', label: 'E-commerce / Loja Online', desc: 'Vende produto direto pelo site. Funil de compra.', icon: 'shopping-cart' },
      { id: 'content', label: 'Conteúdo / Mídia / Blog', desc: 'Portal, jornal, blog. Foco em consumo profundo.', icon: 'newspaper' },
      { id: 'institutional', label: 'Site Institucional', desc: 'Empresa de serviço, portfólio, presença simples.', icon: 'building-2' },
      { id: 'custom', label: 'Outro — configurar manualmente', desc: 'Lista completa de métricas e dimensões.', icon: 'sliders-horizontal' }
    ];
    return `<div class="space-y-3">
      <div>
        <p class="text-sm font-black text-white">Qual fluxo encaixa no seu negócio?</p>
        <p class="text-[11px] text-slate-400 mt-1">Vou ativar automaticamente as métricas que fazem sentido pra você.</p>
      </div>
      <div class="grid grid-cols-1 gap-2">
        ${profiles.map(p => {
          const selected = w.businessProfile === p.id;
          return `<button onclick="Actions.setGa4BusinessProfile('${p.id}')"
            class="w-full text-left rounded-xl border-2 p-3 transition flex items-center gap-3 ${selected ? 'border-amber-400 bg-amber-500/15' : 'border-white/10 bg-white/[0.02] hover:border-amber-400/40 hover:bg-amber-500/5'}">
            <span class="shrink-0 w-10 h-10 rounded-xl ${selected ? 'bg-amber-500/40' : 'bg-white/10'} grid place-items-center text-amber-200">
              <i data-lucide="${p.icon}" class="w-5 h-5"></i>
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-black ${selected ? 'text-amber-100' : 'text-white'} truncate">${p.label}</p>
              <p class="text-[11px] text-slate-300 mt-0.5">${p.desc}</p>
            </div>
            ${selected ? '<i data-lucide="check-circle-2" class="w-5 h-5 text-amber-300 shrink-0"></i>' : '<i data-lucide="circle" class="w-5 h-5 text-slate-600 shrink-0"></i>'}
          </button>`;
        }).join('')}
      </div>
      <div class="flex justify-end gap-2 pt-2 border-t border-white/10">
        <button ${w.businessProfile ? '' : 'disabled'} onclick="Actions.setGa4WizardStep(2)"
          class="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 ${w.businessProfile ? 'bg-amber-500 hover:bg-amber-400 text-slate-900' : 'bg-white/5 text-slate-500 cursor-not-allowed'}">
          Próximo <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    </div>`;
  },

  // ---- STEP 2: Credenciais Cloud Console ------------------------------------
  _step2Credentials(w) {
    const errorBlock = w.error ? `<div class="rounded-xl bg-rose-500/15 border border-rose-400/40 p-3 text-[12px] text-rose-200">
      <p class="font-black mb-0.5">Erro</p>
      <p>${Utils.escape(w.error)}</p>
    </div>` : '';
    const proto = window.location.protocol;
    const host = window.location.host;
    const redirectUri = `${proto}//${host}/api/ga4-oauth-callback`;
    return `<div class="space-y-4">
      <div>
        <p class="text-sm font-black text-white">Credenciais do Cloud Console</p>
        <p class="text-[11px] text-slate-400 mt-1">Crie um OAuth Client no Google Cloud (uma vez) e cole abaixo.</p>
      </div>

      <div class="rounded-xl bg-amber-500/10 border border-amber-400/30 p-3 space-y-2">
        <p class="text-[11px] font-black text-amber-200 uppercase tracking-wider">Passos no Google Cloud Console</p>
        <ol class="text-[11px] text-slate-300 list-decimal pl-4 space-y-1 leading-relaxed">
          <li>Acesse <a href="https://console.cloud.google.com" target="_blank" class="text-amber-300 underline">console.cloud.google.com</a>, crie um Project.</li>
          <li>APIs & Services → Library → habilite <b>Google Analytics Data API</b> + <b>Google Analytics Admin API</b>.</li>
          <li>APIs & Services → Credentials → <b>Create Credentials</b> → OAuth Client ID → tipo <b>Web application</b>.</li>
          <li>Em <b>Authorized redirect URIs</b>, cole exatamente:<br/>
            <code class="block bg-slate-900/60 border border-white/10 rounded px-2 py-1 mt-1 text-amber-200 text-[10px] break-all">${Utils.escape(redirectUri)}</code>
          </li>
          <li>Anote o <b>Client ID</b> e <b>Client Secret</b> que aparecem.</li>
        </ol>
      </div>

      ${errorBlock}

      <div class="space-y-3">
        <div>
          <label class="text-[10px] font-black text-amber-200 uppercase tracking-wider block mb-1">Client ID</label>
          <input type="text" placeholder="000000000000-xxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com"
            value="${Utils.escape(w.draft.clientId)}"
            oninput="Actions.updateGa4Draft('clientId', this.value)"
            class="w-full px-3 py-2 rounded-xl bg-slate-900/60 border border-white/10 text-white text-[12px] font-mono focus:border-amber-400 outline-none"/>
        </div>
        <div>
          <label class="text-[10px] font-black text-amber-200 uppercase tracking-wider block mb-1">Client Secret</label>
          <input type="password" placeholder="GOCSPX-..."
            value="${Utils.escape(w.draft.clientSecret)}"
            oninput="Actions.updateGa4Draft('clientSecret', this.value)"
            class="w-full px-3 py-2 rounded-xl bg-slate-900/60 border border-white/10 text-white text-[12px] font-mono focus:border-amber-400 outline-none"/>
        </div>
      </div>

      <div class="flex justify-between gap-2 pt-2 border-t border-white/10">
        <button onclick="Actions.setGa4WizardStep(1)" class="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
          <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Voltar
        </button>
        <button ${w.saving ? 'disabled' : ''} onclick="Actions.saveGa4Credentials()"
          class="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
          <i data-lucide="${w.saving ? 'loader-2' : 'save'}" class="w-3.5 h-3.5 ${w.saving ? 'animate-spin' : ''}"></i>
          ${w.saving ? 'Salvando...' : 'Salvar e continuar'}
        </button>
      </div>
    </div>`;
  },

  // ---- STEP 3: Autorizar OAuth ----------------------------------------------
  _step3Authorize(w) {
    const errorBlock = w.error ? `<div class="rounded-xl bg-rose-500/15 border border-rose-400/40 p-3 text-[12px] text-rose-200">${Utils.escape(w.error)}</div>` : '';
    const properties = App.state.ga4PropertiesCache;
    const hasProperties = Array.isArray(properties) && properties.length > 0;
    return `<div class="space-y-4">
      <div>
        <p class="text-sm font-black text-white">Autorize o LJ na sua conta Google</p>
        <p class="text-[11px] text-slate-400 mt-1">Clique abaixo. Vai abrir uma janela do Google pedindo permissão de leitura do Analytics.</p>
      </div>

      ${errorBlock}

      ${hasProperties ? this._propertiesList(properties, w) : `
        <button ${w.authorizing ? 'disabled' : ''} onclick="Actions.startGa4Authorization()"
          class="w-full px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-900 text-sm font-black uppercase tracking-wider inline-flex items-center justify-center gap-2">
          <i data-lucide="${w.authorizing ? 'loader-2' : 'key-round'}" class="w-4 h-4 ${w.authorizing ? 'animate-spin' : ''}"></i>
          ${w.authorizing ? 'Aguardando autorização...' : 'Autorizar no Google'}
        </button>
        <p class="text-[10px] text-slate-500 text-center">Só leitura. LJ nunca modifica seu GA4.</p>
      `}

      <div class="flex justify-between gap-2 pt-2 border-t border-white/10">
        <button onclick="Actions.setGa4WizardStep(2)" class="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
          <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Voltar
        </button>
        ${hasProperties ? `<button ${w.selectedPropertyId ? '' : 'disabled'} onclick="Actions.setGa4WizardStep(4)"
          class="px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 ${w.selectedPropertyId ? 'bg-amber-500 hover:bg-amber-400 text-slate-900' : 'bg-white/5 text-slate-500 cursor-not-allowed'}">
          Próximo <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
        </button>` : ''}
      </div>
    </div>`;
  },

  _propertiesList(properties, w) {
    return `<div class="space-y-2">
      <p class="text-[11px] font-black text-amber-200 uppercase tracking-wider">Escolha a property GA4</p>
      <div class="space-y-1.5 max-h-72 overflow-y-auto">
        ${properties.map(p => {
          const selected = w.selectedPropertyId === p.propertyId;
          return `<button onclick="Actions.selectGa4Property('${p.propertyId}', '${Utils.escape(p.displayName).replace(/'/g, '&#39;')}')"
            class="w-full text-left rounded-xl border p-3 transition flex items-center gap-3 ${selected ? 'border-amber-400 bg-amber-500/15' : 'border-white/10 bg-white/[0.02] hover:border-amber-400/40'}">
            <span class="shrink-0 w-8 h-8 rounded-lg ${selected ? 'bg-amber-500/40' : 'bg-white/10'} grid place-items-center">
              <i data-lucide="line-chart" class="w-4 h-4 text-amber-200"></i>
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-black ${selected ? 'text-amber-100' : 'text-white'} truncate">${Utils.escape(p.displayName)}</p>
              <p class="text-[10px] text-slate-400 truncate">${Utils.escape(p.accountName || '')} · ${Utils.escape(p.propertyId)}</p>
            </div>
            ${selected ? '<i data-lucide="check-circle-2" class="w-5 h-5 text-amber-300 shrink-0"></i>' : ''}
          </button>`;
        }).join('')}
      </div>
    </div>`;
  },

  // ---- STEP 4: Packs + frequência -------------------------------------------
  _step4PropertyAndPacks(w) {
    const profile = w.businessProfile || 'leadgen';
    const packsAvailable = this._packsForProfile(profile);
    const errorBlock = w.error ? `<div class="rounded-xl bg-rose-500/15 border border-rose-400/40 p-3 text-[12px] text-rose-200">${Utils.escape(w.error)}</div>` : '';
    return `<div class="space-y-4">
      <div>
        <p class="text-sm font-black text-white">Configurar packs e sincronização</p>
        <p class="text-[11px] text-slate-400 mt-1">Packs são grupos de métricas/dimensões. Defaults já marcados pelo seu perfil.</p>
      </div>

      <div>
        <p class="text-[10px] font-black text-amber-200 uppercase tracking-wider mb-2">Packs ativos</p>
        <div class="space-y-1.5">
          ${packsAvailable.map(p => {
            const selected = (w.selectedPacks || []).includes(p.id);
            const isEssential = p.id === 'essential';
            return `<button onclick="${isEssential ? '' : `Actions.toggleGa4Pack('${p.id}')`}"
              ${isEssential ? 'disabled' : ''}
              class="w-full text-left rounded-xl border p-2.5 transition flex items-center gap-3 ${selected ? 'border-amber-400/60 bg-amber-500/10' : 'border-white/10 bg-white/[0.02] hover:border-amber-400/40'} ${isEssential ? 'opacity-90' : ''}">
              <span class="shrink-0 w-5 h-5 rounded ${selected ? 'bg-amber-500' : 'bg-white/10'} grid place-items-center">
                ${selected ? '<i data-lucide="check" class="w-3 h-3 text-slate-900"></i>' : ''}
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-[12px] font-black ${selected ? 'text-amber-100' : 'text-white'}">${Utils.escape(p.label)}${isEssential ? ' · sempre on' : ''}</p>
                <p class="text-[10px] text-slate-400 mt-0.5">${Utils.escape(p.desc)}</p>
              </div>
            </button>`;
          }).join('')}
        </div>
      </div>

      <div>
        <p class="text-[10px] font-black text-amber-200 uppercase tracking-wider mb-2">Frequência de sync automático</p>
        <div class="grid grid-cols-3 gap-2">
          ${[
            { v: 1, label: '1× / dia', desc: 'Econômico' },
            { v: 2, label: '2× / dia', desc: 'Recomendado' },
            { v: 0, label: 'Manual', desc: 'Só botão' }
          ].map(opt => {
            const selected = Number(w.syncFrequencyPerDay) === opt.v;
            return `<button onclick="Actions.setGa4SyncFrequency(${opt.v})"
              class="rounded-xl border p-2.5 text-center transition ${selected ? 'border-amber-400 bg-amber-500/15' : 'border-white/10 bg-white/[0.02] hover:border-amber-400/40'}">
              <p class="text-sm font-black ${selected ? 'text-amber-100' : 'text-white'}">${opt.label}</p>
              <p class="text-[10px] text-slate-400 mt-0.5">${opt.desc}</p>
            </button>`;
          }).join('')}
        </div>
      </div>

      ${errorBlock}

      <div class="flex justify-between gap-2 pt-2 border-t border-white/10">
        <button onclick="Actions.setGa4WizardStep(3)" class="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
          <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Voltar
        </button>
        <button ${w.saving ? 'disabled' : ''} onclick="Actions.saveGa4WizardFinal()"
          class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-900 text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
          <i data-lucide="${w.saving ? 'loader-2' : 'check'}" class="w-3.5 h-3.5 ${w.saving ? 'animate-spin' : ''}"></i>
          ${w.saving ? 'Concluindo...' : 'Concluir e sincronizar'}
        </button>
      </div>
    </div>`;
  },

  // V35.14.3 — Step 6: Sub-wizard de customs. Aparece automaticamente quando
  // getMetadata detecta customs na propriedade. Cliente marca quais quer
  // incluir, dá nome amigável e decide se vira KR pro Djow.
  _step6Customs(w) {
    const drafts = w.customsDraft || {};
    const entries = Object.values(drafts);
    const enabledCount = entries.filter(c => c.enabled).length;
    const errorBlock = w.error ? `<div class="rounded-xl bg-rose-500/15 border border-rose-400/40 p-3 text-[12px] text-rose-200">${Utils.escape(w.error)}</div>` : '';

    if (!entries.length) {
      return `<div class="space-y-4 text-center py-8">
        <i data-lucide="search-x" class="w-10 h-10 text-slate-500 mx-auto"></i>
        <p class="text-sm text-slate-300">Nenhuma métrica/dimensão custom detectada na sua propriedade.</p>
        <button onclick="Actions.setGa4WizardStep(7); Actions.triggerGa4Sync();"
          class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-[11px] font-black uppercase tracking-wider">
          Continuar
        </button>
      </div>`;
    }

    return `<div class="space-y-4">
      <div>
        <p class="text-sm font-black text-white">Detectei ${entries.length} ${entries.length === 1 ? 'item custom' : 'itens custom'} na sua propriedade GA4</p>
        <p class="text-[11px] text-slate-400 mt-1">Configure quais entram no sync, com nome amigável e categoria. Você pode mudar depois.</p>
      </div>

      <div class="rounded-xl bg-amber-500/10 border border-amber-400/30 p-3 text-[11px] text-amber-100">
        <p class="font-black mb-0.5"><i data-lucide="lightbulb" class="w-3 h-3 inline-block"></i> Dica</p>
        <p>Customs são campos que VOCÊ criou no GA4 (ex: <code class="bg-black/30 px-1 rounded">subscriptionTier</code>, <code class="bg-black/30 px-1 rounded">mrrAtSignup</code>). Aqui você decide quais o LJ usa e como chamá-los.</p>
      </div>

      ${errorBlock}

      <div class="space-y-1.5 max-h-[40vh] overflow-y-auto">
        ${entries.map(c => this._customRow(c, w)).join('')}
      </div>

      <div class="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
        <p class="text-[11px] text-slate-400">${enabledCount} de ${entries.length} ativ${enabledCount === 1 ? 'o' : 'os'}</p>
        <div class="flex gap-2">
          <button onclick="Actions.setGa4WizardStep(7); Actions.triggerGa4Sync();"
            class="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-black uppercase tracking-wider">
            Pular
          </button>
          <button ${w.saving ? 'disabled' : ''} onclick="Actions.saveGa4Customs()"
            class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-900 text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
            <i data-lucide="${w.saving ? 'loader-2' : 'check'}" class="w-3.5 h-3.5 ${w.saving ? 'animate-spin' : ''}"></i>
            ${w.saving ? 'Salvando...' : 'Salvar customs'}
          </button>
        </div>
      </div>
    </div>`;
  },

  _customRow(c, w) {
    const expanded = w.customExpanded === c.apiName;
    const kindBadge = c.kind === 'metric'
      ? '<span class="px-1.5 py-0.5 rounded bg-sky-500/20 border border-sky-400/30 text-sky-200 text-[9px] font-black uppercase tracking-wider">Métrica</span>'
      : '<span class="px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-400/30 text-violet-200 text-[9px] font-black uppercase tracking-wider">Dimensão</span>';
    const apiNameSafe = Utils.escape(c.apiName).replace(/'/g, '&#39;');

    return `<div class="rounded-xl border ${c.enabled ? 'border-amber-400/60 bg-amber-500/5' : 'border-white/10 bg-white/[0.02]'} overflow-hidden">
      <div class="flex items-center gap-2 p-2.5">
        <button onclick="Actions.toggleGa4Custom('${apiNameSafe}')"
          class="shrink-0 w-5 h-5 rounded ${c.enabled ? 'bg-amber-500' : 'bg-white/10 border border-white/20'} grid place-items-center transition">
          ${c.enabled ? '<i data-lucide="check" class="w-3 h-3 text-slate-900"></i>' : ''}
        </button>
        <button onclick="Actions.toggleGa4CustomExpanded('${apiNameSafe}')" class="flex-1 text-left min-w-0">
          <div class="flex items-center gap-1.5 flex-wrap">
            <p class="text-[12px] font-black ${c.enabled ? 'text-amber-100' : 'text-white'} truncate">${Utils.escape(c.friendlyName || c.apiName)}</p>
            ${kindBadge}
            ${c.asKr ? '<span class="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-[9px] font-black uppercase tracking-wider">KR</span>' : ''}
          </div>
          <p class="text-[10px] text-slate-400 font-mono mt-0.5">${Utils.escape(c.apiName)}</p>
        </button>
        <button onclick="Actions.toggleGa4CustomExpanded('${apiNameSafe}')"
          class="shrink-0 w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 grid place-items-center transition">
          <i data-lucide="${expanded ? 'chevron-up' : 'chevron-down'}" class="w-3.5 h-3.5"></i>
        </button>
      </div>
      ${expanded ? `<div class="border-t border-white/10 px-3 py-3 space-y-2.5 bg-black/20">
        ${c.description ? `<p class="text-[10px] text-slate-400 italic leading-relaxed">${Utils.escape(c.description)}</p>` : ''}
        <div>
          <label class="text-[9px] font-black text-amber-200 uppercase tracking-wider block mb-1">Nome amigável (aparece no dashboard)</label>
          <input type="text" value="${Utils.escape(c.friendlyName || '')}"
            oninput="Actions.setGa4CustomConfig('${apiNameSafe}', 'friendlyName', this.value)"
            class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-white/10 text-white text-[11px] focus:border-amber-400 outline-none"/>
        </div>
        <div>
          <label class="text-[9px] font-black text-amber-200 uppercase tracking-wider block mb-1">Categoria</label>
          <input type="text" placeholder="Ex: Receita, Audiência, Tier..." value="${Utils.escape(c.category || '')}"
            oninput="Actions.setGa4CustomConfig('${apiNameSafe}', 'category', this.value)"
            class="w-full px-2.5 py-1.5 rounded-lg bg-slate-900/60 border border-white/10 text-white text-[11px] focus:border-amber-400 outline-none"/>
        </div>
        ${c.kind === 'metric' ? `<div class="flex items-center justify-between gap-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-400/20">
          <div>
            <p class="text-[11px] font-black text-emerald-100">Disponibilizar como KR ao vivo</p>
            <p class="text-[10px] text-slate-400 mt-0.5">Djow vai sugerir esta métrica ao criar KRs novos.</p>
          </div>
          <button onclick="Actions.setGa4CustomConfig('${apiNameSafe}', 'asKr', ${!c.asKr})"
            class="shrink-0 w-10 h-5 rounded-full ${c.asKr ? 'bg-emerald-500' : 'bg-white/15'} transition relative">
            <span class="absolute top-0.5 ${c.asKr ? 'right-0.5' : 'left-0.5'} w-4 h-4 rounded-full bg-white transition"></span>
          </button>
        </div>` : ''}
      </div>` : ''}
    </div>`;
  },

  _stepFinalSuccess(w) {
    const customsCount = w.customsDraft ? Object.values(w.customsDraft).filter(c => c.enabled).length : 0;
    return `<div class="space-y-4 text-center py-6">
      <div class="mx-auto w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400/50 grid place-items-center">
        <i data-lucide="check" class="w-8 h-8 text-emerald-300"></i>
      </div>
      <div>
        <p class="text-lg font-black text-white">GA4 conectado!</p>
        <p class="text-[12px] text-slate-300 mt-1">Property <b>${Utils.escape(w.selectedPropertyDisplayName || '?')}</b> ligada ao LJ.</p>
        ${customsCount > 0 ? `<p class="text-[11px] text-emerald-200 mt-2">${customsCount} custom${customsCount === 1 ? '' : 's'} configurado${customsCount === 1 ? '' : 's'} pra entrar no sync.</p>` : ''}
        <p class="text-[11px] text-slate-400 mt-2">A primeira sincronização (30 dias) já começou em background. Em 1-2 minutos seus dados aparecem.</p>
      </div>
      <button onclick="Actions.closeGa4Wizard()"
        class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-[11px] font-black uppercase tracking-wider">
        Fechar
      </button>
    </div>`;
  },

  // ---- MANAGE MODE -----------------------------------------------------------
  _manageView() {
    const s = App.state.ga4Status || {};
    const propertyName = s.propertyDisplayName || s.selectedPropertyId || '?';
    const lastSyncLabel = s.lastSyncAt
      ? `Última sync: ${this._fmtDate(s.lastSyncAt)}`
      : 'Aguardando primeira sincronização.';
    const packs = Array.isArray(s.selectedPacks) ? s.selectedPacks : [];
    return `<div class="space-y-4">
      <div class="rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-4">
        <p class="text-[10px] font-black text-emerald-300 uppercase tracking-widest inline-flex items-center gap-1.5">
          <i data-lucide="check-circle-2" class="w-3 h-3"></i> Conectado
        </p>
        <p class="text-base font-black text-white mt-1.5">${Utils.escape(propertyName)}</p>
        <p class="text-[11px] text-slate-300 mt-1">${lastSyncLabel}</p>
      </div>

      <div>
        <p class="text-[10px] font-black text-amber-200 uppercase tracking-wider mb-2">Packs ativos</p>
        <div class="flex flex-wrap gap-1.5">
          ${packs.length ? packs.map(p => `<span class="px-2 py-0.5 rounded bg-white/10 border border-white/15 text-[10px] font-black text-slate-200 uppercase tracking-wider">${Utils.escape(p)}</span>`).join('') : '<p class="text-[11px] text-slate-500 italic">Nenhum pack ativado.</p>'}
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <button onclick="Actions.triggerGa4Sync()" class="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-900 text-[11px] font-black uppercase tracking-wider inline-flex items-center justify-center gap-1.5">
          <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Atualizar agora
        </button>
        <button onclick="Actions.openGa4Wizard(); App.state.ga4Wizard.mode='wizard'; App.state.ga4Wizard.step=1; App.render();"
          class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-100 text-[11px] font-black uppercase tracking-wider inline-flex items-center justify-center gap-1.5">
          <i data-lucide="settings-2" class="w-3.5 h-3.5"></i> Reconfigurar
        </button>
      </div>

      <button onclick="Actions.disconnectGa4()" class="w-full px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/30 text-rose-200 text-[10px] font-black uppercase tracking-wider inline-flex items-center justify-center gap-1.5">
        <i data-lucide="unlink" class="w-3 h-3"></i> Desconectar
      </button>
    </div>`;
  },

  _fmtDate(iso) {
    if (!iso) return '—';
    try {
      const d = new Date(iso);
      return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    } catch (_) { return String(iso); }
  },

  // Lista de packs disponíveis pra mostrar no wizard (espelha lib/ga4-packs.js).
  // Quando perfil = ecommerce, mostra essential + ecommerce + add-ons.
  // Quando perfil = custom, mostra todos.
  _packsForProfile(profile) {
    const ALL = [
      { id: 'essential', label: 'Essencial', desc: 'Tráfego, origem, dispositivo, conversões. Sempre on.' },
      { id: 'institutional', label: 'Institucional / Site Simples', desc: 'Engajamento e conteúdo mais visto.' },
      { id: 'leadgen', label: 'Lead Gen / SaaS / Serviços', desc: 'Atribuição de campanha, performance por LP.' },
      { id: 'ecommerce', label: 'E-commerce', desc: 'Funil completo, receita, devoluções, itens.' },
      { id: 'content', label: 'Conteúdo / Mídia', desc: 'Profundidade de leitura, downloads, busca interna.' },
      { id: 'ads', label: 'Ads / Performance', desc: 'Custos + ROAS do Google Ads dentro do GA4.' },
      { id: 'mobile', label: 'App Mobile', desc: 'Retention, crashes, hardware.' },
      { id: 'predictive', label: 'Preditivo / ML', desc: 'Probabilidade de compra/churn (exige volume).' },
      { id: 'agency', label: 'Agência (DV/CM/SA360)', desc: 'Atribuição Google Marketing Platform.' }
    ];
    if (profile === 'custom') return ALL;
    if (profile === 'ecommerce') {
      // ecommerce + add-ons
      return ALL.filter(p => ['essential', 'ecommerce', 'ads', 'mobile', 'predictive', 'agency'].includes(p.id));
    }
    if (profile === 'content') {
      return ALL.filter(p => ['essential', 'content', 'ads', 'mobile', 'agency'].includes(p.id));
    }
    if (profile === 'institutional') {
      return ALL.filter(p => ['essential', 'institutional', 'ads', 'mobile'].includes(p.id));
    }
    // leadgen (default)
    return ALL.filter(p => ['essential', 'leadgen', 'ads', 'mobile', 'predictive', 'agency'].includes(p.id));
  }
};
