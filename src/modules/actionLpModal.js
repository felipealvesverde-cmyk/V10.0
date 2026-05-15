// V15 — Action LP Modal
// Modal especializado para criar/editar ações do tipo Landing Page.
// Inclui campos da LP, checkpoint builder (lista + reordenar), gerador
// de script de tracking e validação visual da instalação.
var ActionLpModal = {
  render() {
    if (!App.state.showLpModal || !App.state.lpDraft) return '';
    const draft = App.state.lpDraft;
    const campaigns = App.state.campaigns || [];
    const products = App.state.products || [];
    const candidateActions = (App.state.actions || []).filter(a => Number(a.campaignId) === Number(draft.campaignId) && Number(a.id) !== Number(draft.actionId));
    const registry = (App.state.lpRegistry || {})[draft.lpId];
    const lastEvent = registry?.lastEventAt ? new Date(registry.lastEventAt).toLocaleString('pt-BR') : 'Nenhum';
    const installStatus = this._installStatus(registry);
    const stages = window.FlowEngine ? FlowEngine.STAGE_PRESETS : [];
    return `<div class="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm p-4 overflow-auto">
      <div class="max-w-4xl mx-auto rounded-[2rem] overflow-hidden shadow-2xl text-white" style="background: radial-gradient(circle at 18% 10%, rgba(14,165,233,.22), transparent 30%), #071326;">
        <header class="p-6 border-b border-white/10 flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 mb-2"><i data-lucide="layout" class="w-4 h-4 text-sky-300"></i><p class="text-xs font-black text-slate-300 uppercase tracking-wider">Ação LP • Tracking + Checkpoints</p></div>
            <h2 class="text-2xl font-black">${draft.actionId ? 'Editar LP' : 'Nova LP'}</h2>
            <p class="text-sm text-slate-300 mt-1">A LP é uma ação operacional do funil. Configure URL, conexões com outras ações, checkpoints e cole o pixel na LP do RD.</p>
          </div>
          <button onclick="Actions.closeLpModal()" class="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-semibold flex items-center gap-2"><i data-lucide="x" class="w-4 h-4"></i> Fechar</button>
        </header>

        <div class="p-6 grid lg:grid-cols-2 gap-5">
          <div class="space-y-4">
            ${this._fieldsBlock(draft, campaigns, products, candidateActions, stages)}
          </div>
          <div class="space-y-4">
            ${this._installationBlock(draft, installStatus, lastEvent)}
            ${this._checkpointsBlock(draft, stages)}
          </div>
        </div>

        <footer class="p-6 border-t border-white/10 flex flex-col md:flex-row gap-3 justify-end">
          <button onclick="Actions.closeLpModal()" class="px-5 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-black">Cancelar</button>
          <button onclick="Actions.copyLpTrackingScript()" class="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black flex items-center gap-2"><i data-lucide="copy" class="w-4 h-4"></i> Copiar script</button>
          <button onclick="Actions.validateLpInstallation()" class="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black flex items-center gap-2"><i data-lucide="search-check" class="w-4 h-4"></i> Validar instalação</button>
          <button onclick="Actions.saveLpAction()" class="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black flex items-center gap-2"><i data-lucide="save" class="w-4 h-4"></i> Salvar LP</button>
        </footer>
      </div>
    </div>`;
  },

  _fieldsBlock(draft, campaigns, products, candidateActions, stages) {
    return `<div class="rounded-3xl border border-white/10 bg-white/[0.055] p-4 space-y-3">
      <h3 class="font-black text-sm uppercase tracking-wider text-slate-300">Configuração da LP</h3>
      <div>
        <label class="text-[11px] font-black text-slate-300 uppercase">Nome da LP</label>
        <input id="lp_name" data-focus-key="lp_name" value="${Utils.escape(draft.name || '')}" oninput="Actions.updateLpDraftFieldSilent('name', this.value)" onchange="App.render()" placeholder="Ex.: LP Diagnóstico Maio" class="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white font-semibold text-sm" />
      </div>
      <div>
        <label class="text-[11px] font-black text-slate-300 uppercase">URL da LP</label>
        <input id="lp_url" data-focus-key="lp_url" value="${Utils.escape(draft.url || '')}" oninput="Actions.updateLpDraftFieldSilent('url', this.value)" onchange="App.render()" placeholder="https://lp.seudominio.com.br/maio" class="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white font-semibold text-sm" />
      </div>
      <div>
        <label class="text-[11px] font-black text-slate-300 uppercase">Objetivo operacional</label>
        <textarea id="lp_objective" data-focus-key="lp_objective" oninput="Actions.updateLpDraftFieldSilent('objective', this.value)" onchange="App.render()" placeholder="Qual passagem esta LP precisa gerar?" class="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white font-semibold text-sm min-h-[70px]">${Utils.escape(draft.objective || '')}</textarea>
      </div>
      <div>
        <label class="text-[11px] font-black text-slate-300 uppercase">CTA principal</label>
        <input id="lp_cta" data-focus-key="lp_cta" value="${Utils.escape(draft.ctaPrimary || '')}" oninput="Actions.updateLpDraftFieldSilent('ctaPrimary', this.value)" onchange="App.render()" placeholder="Ex.: Quero fazer o diagnóstico" class="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/10 border border-white/15 text-white font-semibold text-sm" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-[11px] font-black text-slate-300 uppercase">Campanha</label>
          <select onchange="Actions.updateLpDraftField('campaignId', Number(this.value))" class="mt-1 w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/20 text-white font-bold text-sm" style="color-scheme: dark;">
            <option value="">— selecionar —</option>
            ${campaigns.map(c => `<option value="${c.id}" ${Number(draft.campaignId) === Number(c.id) ? 'selected' : ''} class="bg-slate-900 text-white">${Utils.escape(c.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-[11px] font-black text-slate-300 uppercase">Produto</label>
          <select onchange="Actions.updateLpDraftField('productId', Number(this.value))" class="mt-1 w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/20 text-white font-bold text-sm" style="color-scheme: dark;">
            <option value="">— selecionar —</option>
            ${products.map(p => `<option value="${p.id}" ${Number(draft.productId) === Number(p.id) ? 'selected' : ''} class="bg-slate-900 text-white">${Utils.escape(p.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-[11px] font-black text-slate-300 uppercase">Estágio inicial</label>
          <select onchange="Actions.updateLpDraftField('startStage', this.value)" class="mt-1 w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/20 text-white font-bold text-sm" style="color-scheme: dark;">
            ${stages.map(s => `<option value="${s.id}" ${draft.startStage === s.id ? 'selected' : ''} class="bg-slate-900 text-white">${Utils.escape(s.label)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-[11px] font-black text-slate-300 uppercase">Estágio final (conversão)</label>
          <select onchange="Actions.updateLpDraftField('endStage', this.value)" class="mt-1 w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/20 text-white font-bold text-sm" style="color-scheme: dark;">
            ${stages.map(s => `<option value="${s.id}" ${draft.endStage === s.id ? 'selected' : ''} class="bg-slate-900 text-white">${Utils.escape(s.label)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-[11px] font-black text-slate-300 uppercase">Ação anterior</label>
          <select onchange="Actions.updateLpDraftField('previousActionId', this.value || '')" class="mt-1 w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/20 text-white font-bold text-sm" style="color-scheme: dark;">
            <option value="">— nenhuma —</option>
            ${candidateActions.map(a => `<option value="${a.id}" ${String(draft.previousActionId) === String(a.id) ? 'selected' : ''} class="bg-slate-900 text-white">${Utils.escape(a.name)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-[11px] font-black text-slate-300 uppercase">Próxima ação</label>
          <select onchange="Actions.updateLpDraftField('nextActionId', this.value || '')" class="mt-1 w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-white/20 text-white font-bold text-sm" style="color-scheme: dark;">
            <option value="">— nenhuma —</option>
            ${candidateActions.map(a => `<option value="${a.id}" ${String(draft.nextActionId) === String(a.id) ? 'selected' : ''} class="bg-slate-900 text-white">${Utils.escape(a.name)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
        <label class="flex items-center gap-2 text-xs text-slate-300">
          <button onclick="Actions.updateLpDraftField('trackingActive', ${!draft.trackingActive})" class="relative w-10 h-6 rounded-full transition ${draft.trackingActive ? 'bg-emerald-500' : 'bg-slate-600'}"><span class="absolute top-1 ${draft.trackingActive ? 'right-1' : 'left-1'} w-4 h-4 rounded-full bg-white shadow"></span></button>
          Tracking ativo
        </label>
        <label class="flex items-center gap-2 text-xs text-slate-300">
          <button onclick="Actions.updateLpDraftField('syncRdActive', ${!draft.syncRdActive})" class="relative w-10 h-6 rounded-full transition ${draft.syncRdActive ? 'bg-emerald-500' : 'bg-slate-600'}"><span class="absolute top-1 ${draft.syncRdActive ? 'right-1' : 'left-1'} w-4 h-4 rounded-full bg-white shadow"></span></button>
          Sincronizar com RD CRM
        </label>
      </div>
    </div>`;
  },

  _installationBlock(draft, installStatus, lastEvent) {
    const script = window.LpRegistry ? LpRegistry.buildTrackingScript(draft) : '';
    return `<div class="rounded-3xl border border-white/10 bg-white/[0.055] p-4 space-y-3">
      <h3 class="font-black text-sm uppercase tracking-wider text-slate-300">Pixel Journey Tracker</h3>
      <div class="rounded-2xl bg-black/40 border border-white/10 p-3">
        <p class="text-[11px] font-black text-slate-400 uppercase mb-1">Status</p>
        <p class="text-sm font-black ${installStatus.colorClass}">${installStatus.icon} ${installStatus.label}</p>
        <p class="text-[11px] text-slate-400 mt-1">Último evento: ${Utils.escape(lastEvent)}</p>
      </div>
      <div>
        <p class="text-[11px] font-black text-slate-400 uppercase mb-2">Cole este script no &lt;head&gt; da LP do RD</p>
        <textarea readonly class="w-full min-h-[120px] rounded-xl bg-slate-900 border border-white/10 text-sky-100 text-[11px] font-mono p-3">${Utils.escape(script)}</textarea>
      </div>
      <div class="rounded-2xl bg-sky-500/10 border border-sky-400/30 p-3 text-xs text-sky-100">
        <p class="font-black mb-1">Como instalar na LP do RD Station:</p>
        <ol class="list-decimal pl-4 space-y-0.5 text-sky-200/90">
          <li>Salve esta LP no Journey.</li>
          <li>Copie o script acima.</li>
          <li>No editor da LP do RD, abra <i>Configurações → Códigos personalizados → Antes de &lt;/body&gt;</i>.</li>
          <li>Cole o script e publique.</li>
          <li>Acesse a URL da LP e clique em <b>Validar instalação</b>.</li>
        </ol>
      </div>
    </div>`;
  },

  _installStatus(registry) {
    if (!registry) return { label: 'Não instalado', colorClass: 'text-slate-400', icon: '●' };
    if (!registry.lastEventAt) return { label: 'Script salvo — aguardando primeiro evento', colorClass: 'text-amber-300', icon: '●' };
    const seconds = (Date.now() - new Date(registry.lastEventAt).getTime()) / 1000;
    if (seconds < 60) return { label: 'Recebendo eventos agora', colorClass: 'text-emerald-300', icon: '●' };
    if (seconds < 600) return { label: `Recebeu evento há ${Math.round(seconds)}s`, colorClass: 'text-emerald-300', icon: '●' };
    return { label: 'Pixel detectado anteriormente', colorClass: 'text-sky-300', icon: '●' };
  },

  _checkpointsBlock(draft, stages) {
    const events = window.FlowCheckpointEngine ? FlowCheckpointEngine.EVENTS : [];
    const checkpoints = draft.checkpoints || [];
    return `<div class="rounded-3xl border border-white/10 bg-white/[0.055] p-4 space-y-3">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="font-black text-sm uppercase tracking-wider text-slate-300">Checkpoints da LP</h3>
          <p class="text-xs text-slate-400">Cada checkpoint dispara: tag, score, movimentação para outro estágio.</p>
        </div>
        <button onclick="Actions.addLpCheckpoint()" class="px-3 py-2 rounded-xl bg-sky-500/20 text-sky-200 border border-sky-400/30 text-xs font-black flex items-center gap-1"><i data-lucide="plus" class="w-3.5 h-3.5"></i> Checkpoint</button>
      </div>
      <div class="space-y-2">${checkpoints.length ? checkpoints.map((c, i) => this._checkpointRow(c, i, checkpoints.length, events, stages)).join('') : '<p class="text-xs text-slate-400">Nenhum checkpoint. Adicione regras evento → estágio para movimentar o lead automaticamente.</p>'}</div>
    </div>`;
  },

  _checkpointRow(checkpoint, index, total, events, stages) {
    const fScore = `lp_cp_${checkpoint.id}_score`;
    return `<div class="rounded-2xl border border-white/10 bg-black/30 p-3">
      <div class="grid grid-cols-[1fr_1fr_30px] gap-2 items-center mb-2">
        <select onchange="Actions.updateLpCheckpoint('${checkpoint.id}', 'event', this.value)" class="px-2 py-2 rounded-lg bg-slate-900 border border-white/20 text-white font-bold text-xs" style="color-scheme: dark;">
          ${events.map(e => `<option value="${e.id}" ${checkpoint.event === e.id ? 'selected' : ''} class="bg-slate-900">${Utils.escape(e.label)}</option>`).join('')}
        </select>
        <select onchange="Actions.updateLpCheckpoint('${checkpoint.id}', 'moveToStage', this.value)" class="px-2 py-2 rounded-lg bg-slate-900 border border-white/20 text-white font-bold text-xs" style="color-scheme: dark;">
          <option value="" class="bg-slate-900">— sem movimento —</option>
          ${stages.map(s => `<option value="${s.id}" ${checkpoint.moveToStage === s.id ? 'selected' : ''} class="bg-slate-900">${Utils.escape(s.label)}</option>`).join('')}
        </select>
        <button onclick="Actions.removeLpCheckpoint('${checkpoint.id}')" class="w-8 h-8 rounded-lg bg-red-500/20 text-red-200 font-black text-xs">×</button>
      </div>
      <div class="grid grid-cols-[1fr_90px_50px_50px] gap-2 items-center">
        <input value="${Utils.escape(checkpoint.tagOnTrigger || '')}" oninput="Actions.updateLpCheckpointSilent('${checkpoint.id}', 'tagOnTrigger', this.value)" onchange="App.render()" placeholder="Tag (opcional)" class="px-2 py-1.5 rounded-lg bg-white/10 border border-white/15 text-white text-[11px] font-semibold" />
        <input id="${fScore}" data-focus-key="${fScore}" type="number" value="${Number(checkpoint.scoreDelta || 0)}" oninput="Actions.updateLpCheckpointSilent('${checkpoint.id}', 'scoreDelta', this.value)" onchange="App.render()" placeholder="+ Score" class="px-2 py-1.5 rounded-lg bg-white/10 border border-white/15 text-white text-[11px] font-black text-right" />
        <button onclick="Actions.reorderLpCheckpoint('${checkpoint.id}', 'up')" ${index === 0 ? 'disabled' : ''} class="w-full py-1.5 rounded-lg bg-white/10 border border-white/15 text-white text-xs font-black ${index === 0 ? 'opacity-30 cursor-not-allowed' : ''}">↑</button>
        <button onclick="Actions.reorderLpCheckpoint('${checkpoint.id}', 'down')" ${index === total - 1 ? 'disabled' : ''} class="w-full py-1.5 rounded-lg bg-white/10 border border-white/15 text-white text-xs font-black ${index === total - 1 ? 'opacity-30 cursor-not-allowed' : ''}">↓</button>
      </div>
    </div>`;
  }
};
window.ActionLpModal = ActionLpModal;
