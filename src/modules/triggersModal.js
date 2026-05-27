// V34.9.3 — Modal de Triggers Engine.
//
// Aberto pelo botão "Triggers" do Revenue Flow Map (após dropdown de Campanha).
// Lista triggers Master + 8 pares de transição. Master e par têm formulário
// inline pra adicionar trigger novo (tipo + campo param + destino editável).

window.TriggersModal = {
  PAIRS: [
    { from: 'marketing-tof', to: 'marketing-mof', label: 'Marketing TOF → Marketing MOF' },
    { from: 'marketing-mof', to: 'marketing-bof', label: 'Marketing MOF → Marketing BOF' },
    { from: 'marketing-bof', to: 'vendas-tof',   label: 'Marketing BOF → Vendas TOF' },
    { from: 'vendas-tof',    to: 'vendas-mof',   label: 'Vendas TOF → Vendas MOF' },
    { from: 'vendas-mof',    to: 'vendas-bof',   label: 'Vendas MOF → Vendas BOF' },
    { from: 'vendas-bof',    to: 'cs-tof',       label: 'Vendas BOF → CS TOF' },
    { from: 'cs-tof',        to: 'cs-mof',       label: 'CS TOF → CS MOF' },
    { from: 'cs-mof',        to: 'cs-bof',       label: 'CS MOF → CS BOF' }
  ],

  ALL_STAGES: [
    { value: 'marketing-tof', label: 'Marketing TOF' },
    { value: 'marketing-mof', label: 'Marketing MOF' },
    { value: 'marketing-bof', label: 'Marketing BOF' },
    { value: 'vendas-tof',    label: 'Vendas TOF' },
    { value: 'vendas-mof',    label: 'Vendas MOF' },
    { value: 'vendas-bof',    label: 'Vendas BOF' },
    { value: 'cs-tof',        label: 'CS TOF' },
    { value: 'cs-mof',        label: 'CS MOF' },
    { value: 'cs-bof',        label: 'CS BOF' },
    { value: 'EXIT',          label: 'SAIR da campanha' }
  ],

  TYPES: [
    { value: 'cta',      label: 'CTA (click)',       paramLabel: 'URL do botão', paramKind: 'text' },
    { value: 'form',     label: 'Form (submit)',      paramLabel: 'URL, ID ou nome do form', paramKind: 'text' },
    { value: 'pageview', label: 'Pageview (visitou)', paramLabel: 'URL da página', paramKind: 'text' },
    { value: 'tag',      label: 'Tag (adicionada)',   paramLabel: 'Nome da tag (ex: lj-quente)', paramKind: 'text' },
    { value: 'payment',  label: 'Pagamento (auto)',   paramLabel: '', paramKind: 'none' },
    { value: 'time',     label: 'Tempo (dias inativo)', paramLabel: 'Dias', paramKind: 'int' },
    { value: 'score',    label: 'Score (atingiu)',     paramLabel: 'Valor', paramKind: 'int' }
  ],

  render() {
    const m = App.state.triggersModal;
    if (!m || !m.open) return '';

    const triggers = m.triggers || [];
    const masters = triggers.filter(t => t.is_master);
    const campaignName = this._campaignName(m.campaignId);

    return `<div id="triggersModalBackdrop" class="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm p-4 overflow-auto" onclick="if(event.target===this) Actions.closeTriggersModal()">
      <section class="max-w-5xl mx-auto rounded-[2rem] bg-slate-50 shadow-2xl overflow-hidden border border-white/20">
        <header class="bg-slate-950 text-white p-6 flex items-start justify-between gap-4">
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-400/20 text-sky-200 text-xs font-black mb-3">
              <i data-lucide="zap" class="w-3.5 h-3.5"></i>
              GATILHOS DE TRANSIÇÃO
            </div>
            <h2 class="text-3xl font-black">Triggers da campanha ${Utils.escape(campaignName)}</h2>
            <p class="text-slate-300 mt-2 text-sm">Configure o que faz seu lead trocar de etapa nos funis. Triggers Master pulam etapas; pares são transições lineares.</p>
          </div>
          <button onclick="Actions.closeTriggersModal()" class="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 font-black flex items-center gap-2">
            <i data-lucide="x" class="w-4 h-4"></i>
            Fechar
          </button>
        </header>

        <main class="p-5 lg:p-6 max-h-[75vh] overflow-y-auto space-y-5">
          ${this._mirrorBar()}
          ${m.loading ? `<p class="text-sm text-slate-500">Carregando…</p>` : ''}
          ${!m.loading ? this._mastersSection(masters) : ''}
          ${!m.loading ? this._pairsSection(triggers) : ''}
        </main>
      </section>
    </div>`;
  },

  _campaignName(campaignId) {
    const c = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    return c?.name || '—';
  },

  _mirrorBar() {
    const m = App.state.triggersModal;
    const otherCampaigns = (App.state.campaigns || []).filter(c => Number(c.id) !== Number(m.campaignId));
    if (!otherCampaigns.length) return '';
    return `<div class="rounded-2xl bg-violet-50 border-2 border-violet-200 p-3 flex items-center gap-2">
      <i data-lucide="copy" class="w-4 h-4 text-violet-700"></i>
      <span class="text-xs font-black text-violet-900">Espelhar triggers de:</span>
      <select onchange="if(this.value) Actions.mirrorTriggersFrom(this.value); this.value=''" class="flex-1 px-3 py-2 rounded-xl bg-white border border-violet-200 text-xs font-black text-violet-900">
        <option value="">— escolha uma campanha —</option>
        ${otherCampaigns.map(c => `<option value="${c.id}">${Utils.escape(c.name)}</option>`).join('')}
      </select>
    </div>`;
  },

  _mastersSection(masters) {
    const m = App.state.triggersModal;
    const isAddingMaster = m.draft?.is_master === true;
    return `<div class="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-black text-slate-900 uppercase tracking-widest">Triggers Master <span class="text-xs text-slate-500 normal-case font-bold">(pulam etapas)</span></h3>
        ${!isAddingMaster ? `<button onclick="Actions.startTriggerDraft(null, 'cs-tof', true)" class="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-black flex items-center gap-1.5" style="color:#fff;"><i data-lucide="plus" class="w-3 h-3"></i> Adicionar master</button>` : ''}
      </div>
      <div class="space-y-2">
        ${masters.length === 0 && !isAddingMaster ? `<p class="text-xs text-slate-500 italic">Nenhum trigger master configurado.</p>` : ''}
        ${masters.map(t => this._triggerRow(t)).join('')}
        ${isAddingMaster ? this._draftRow() : ''}
      </div>
    </div>`;
  },

  _pairsSection(triggers) {
    const m = App.state.triggersModal;
    return `<div class="space-y-3">
      ${this.PAIRS.map(p => {
        const pairTriggers = triggers.filter(t => !t.is_master && t.from_stage === p.from && t.to_stage === p.to);
        const isAddingHere = m.draft && !m.draft.is_master && m.draft.from_stage === p.from && m.draft.to_stage === p.to;
        const counts = m.transitionCounts || {};
        const count7d = counts[`${p.from}->${p.to}`] || 0;
        return `<div class="rounded-3xl bg-white border border-slate-200 p-4 shadow-sm">
          <div class="flex items-center justify-between mb-3 gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <h4 class="text-sm font-black text-slate-900 truncate">${Utils.escape(p.label)}</h4>
              <span class="px-2 py-0.5 rounded-full ${count7d > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'} text-[10px] font-black whitespace-nowrap" title="Movimentações nos últimos 7 dias">${count7d} em 7d</span>
            </div>
            ${!isAddingHere ? `<button onclick="Actions.startTriggerDraft('${p.from}', '${p.to}', false)" class="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-xs font-black flex items-center gap-1.5"><i data-lucide="plus" class="w-3 h-3"></i> Adicionar trigger</button>` : ''}
          </div>
          <div class="space-y-2">
            ${pairTriggers.length === 0 && !isAddingHere ? `<p class="text-xs text-slate-400 italic">Nenhum trigger configurado pra esta transição.</p>` : ''}
            ${pairTriggers.map(t => this._triggerRow(t)).join('')}
            ${isAddingHere ? this._draftRow() : ''}
          </div>
        </div>`;
      }).join('')}
    </div>`;
  },

  _triggerRow(t) {
    const type = this.TYPES.find(x => x.value === t.trigger_type) || { label: t.trigger_type, paramLabel: '', paramKind: 'text' };
    const paramDisplay = t.trigger_type === 'time' ? `${t.trigger_value_int || 0} dias inativo`
                       : t.trigger_type === 'score' ? `Atingiu ${t.trigger_value_int || 0}`
                       : (t.trigger_param || '(qualquer)');
    const destLabel = this.ALL_STAGES.find(s => s.value === t.to_stage)?.label || t.to_stage;
    return `<div class="flex items-center gap-2 p-2.5 rounded-xl ${t.is_active ? 'bg-slate-50' : 'bg-slate-100 opacity-60'} border border-slate-200">
      <span class="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 text-[10px] font-black">${Utils.escape(type.label)}</span>
      <span class="text-xs font-bold text-slate-700 truncate flex-1">${Utils.escape(paramDisplay)}</span>
      <span class="text-[10px] text-slate-500">→</span>
      <select onchange="Actions.updateTriggerField(${t.id}, 'to_stage', this.value)" class="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-black text-slate-700">
        ${this.ALL_STAGES.map(s => `<option value="${s.value}" ${s.value === t.to_stage ? 'selected' : ''}>${Utils.escape(s.label)}</option>`).join('')}
      </select>
      <label class="inline-flex items-center gap-1 cursor-pointer" title="Pausar/ativar trigger">
        <input type="checkbox" ${t.is_active ? 'checked' : ''} onchange="Actions.toggleTriggerActive(${t.id}, this.checked)" />
        <span class="text-[10px] font-black ${t.is_active ? 'text-emerald-700' : 'text-slate-500'}">${t.is_active ? 'ATIVO' : 'PAUSADO'}</span>
      </label>
      <button onclick="Actions.deleteTrigger(${t.id})" class="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-[10px] font-black" title="Remover trigger">
        <i data-lucide="trash-2" class="w-3 h-3"></i>
      </button>
    </div>`;
  },

  _draftRow() {
    const m = App.state.triggersModal;
    const d = m.draft;
    const typeMeta = this.TYPES.find(x => x.value === d.trigger_type) || this.TYPES[0];
    const showParam = typeMeta.paramKind !== 'none';
    const isHotmartTrigger = d.trigger_type === 'payment';

    return `<div class="p-3 rounded-xl bg-sky-50 border-2 border-sky-300">
      <div class="flex flex-wrap items-center gap-2 mb-2">
        <select onchange="Actions.updateTriggerDraft('trigger_type', this.value); App.render();" class="px-2 py-1.5 rounded-lg bg-white border border-sky-200 text-xs font-black text-slate-700">
          ${this.TYPES.map(t => `<option value="${t.value}" ${t.value === d.trigger_type ? 'selected' : ''}>${Utils.escape(t.label)}</option>`).join('')}
        </select>
        ${showParam ? (
          typeMeta.paramKind === 'int'
            ? `<input type="number" min="1" placeholder="${Utils.escape(typeMeta.paramLabel)}" value="${d.trigger_value_int || ''}" oninput="Actions.updateTriggerDraft('trigger_value_int', Number(this.value))" class="flex-1 min-w-[120px] px-2 py-1.5 rounded-lg bg-white border border-sky-200 text-xs font-bold" />`
            : `<input type="text" placeholder="${Utils.escape(typeMeta.paramLabel)}" value="${Utils.escape(d.trigger_param || '')}" oninput="Actions.updateTriggerDraft('trigger_param', this.value)" class="flex-1 min-w-[160px] px-2 py-1.5 rounded-lg bg-white border border-sky-200 text-xs font-bold" />`
        ) : `<span class="text-xs text-emerald-700 font-black px-2 py-1.5">${isHotmartTrigger ? '✓ Hotmart auto-detect' : '(sem parâmetro)'}</span>`}
        <span class="text-[10px] text-slate-500">→</span>
        <select onchange="Actions.updateTriggerDraft('to_stage', this.value)" class="px-2 py-1.5 rounded-lg bg-white border border-sky-200 text-xs font-black text-slate-700">
          ${this.ALL_STAGES.map(s => `<option value="${s.value}" ${s.value === d.to_stage ? 'selected' : ''}>${Utils.escape(s.label)}</option>`).join('')}
        </select>
      </div>
      <div class="flex items-center gap-2 mt-2">
        <button onclick="Actions.saveTriggerDraft()" class="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black" style="color:#fff;">Salvar trigger</button>
        <button onclick="Actions.cancelTriggerDraft()" class="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-black">Cancelar</button>
      </div>
    </div>`;
  }
};
