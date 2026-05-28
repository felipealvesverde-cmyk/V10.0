// V35.0.0 — Modal Sub-Funil (versão completa).
//
// Abre ao clicar numa bolinha do Revenue Flow Map (com campanha selecionada).
// Mostra mini-funil editável: cada linha = um sub-stage (nome + tag + contagem).
// Autosave por debounce. Funil decorativo afunilado nas bordas; números honestos
// dentro de cada faixa.
//
// V35.0.0 adiciona: drag-and-drop pra reordenar, datalist com tags conhecidas
// (vocabulário derivado de lj_visitor_tags), color picker por sub-stage,
// confirm delete via modal próprio (não confirm() nativo).

// Paleta predefinida pro color picker — combina com a paleta semântica oficial
SubStageFunnelModal_COLORS = ['#F472B6', '#00CBCC', '#6BBEF9', '#F6DB5C', '#AB3ED8', '#FB923C', '#34D399', '#94A3B8'];

window.SubStageFunnelModal = {
  _palette: SubStageFunnelModal_COLORS,

  // Cor da bolinha pai (paleta semântica LJ — coerência cromática Leo)
  _parentColor(parentStage) {
    if (parentStage?.startsWith('marketing')) return { hex: '#F472B6', soft: '#F9A8D4', name: 'Marketing' };
    if (parentStage?.startsWith('vendas'))    return { hex: '#00CBCC', soft: '#5EEAD4', name: 'Vendas' };
    if (parentStage?.startsWith('cs'))        return { hex: '#6BBEF9', soft: '#93C5FD', name: 'CS' };
    return { hex: '#AB3ED8', soft: '#C084FC', name: '?' };
  },

  _stageLabel(parentStage) {
    const map = {
      'marketing-tof': 'Marketing · TOF', 'marketing-mof': 'Marketing · MOF', 'marketing-bof': 'Marketing · BOF',
      'vendas-tof':    'Vendas · TOF',    'vendas-mof':    'Vendas · MOF',    'vendas-bof':    'Vendas · BOF',
      'cs-tof':        'CS · TOF',        'cs-mof':        'CS · MOF',        'cs-bof':        'CS · BOF'
    };
    return map[parentStage] || parentStage || '?';
  },

  _campaignName(campaignId) {
    const c = (App.state.campaigns || []).find(x => Number(x.id) === Number(campaignId));
    return c?.name || `Campanha ${campaignId}`;
  },

  render() {
    const m = App.state.subStageFunnelModal;
    if (!m || !m.open) return '';
    const color = this._parentColor(m.parentStage);
    const stageLabel = this._stageLabel(m.parentStage);
    const campaignName = this._campaignName(m.campaignId);
    const total = (m.substages || []).reduce((acc, s) => acc + (s.leadCount || 0), 0);

    return `<div id="subStageFunnelBackdrop" class="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm p-4 overflow-auto" onclick="if(event.target===this) Actions.closeSubStageFunnelModal()">
      <section class="max-w-3xl mx-auto rounded-[2rem] bg-slate-50 shadow-2xl overflow-hidden border border-white/20">
        <header class="p-6 text-white" style="background: linear-gradient(135deg, ${color.hex}, ${color.hex}AA);">
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0 flex-1">
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white text-[10px] font-black mb-3 uppercase tracking-widest">
                <i data-lucide="layers" class="w-3 h-3"></i>
                Sub-funil
              </div>
              <h2 class="text-3xl font-black truncate" style="color:#fff;">${Utils.escape(stageLabel)}</h2>
              <p class="text-white/85 mt-1 text-sm">${Utils.escape(campaignName)} · ${total} lead(s) na bolinha</p>
            </div>
            <button onclick="Actions.closeSubStageFunnelModal()" class="px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 font-black flex items-center gap-2 text-white" style="color:#fff;">
              <i data-lucide="x" class="w-4 h-4"></i>
              Fechar
            </button>
          </div>
        </header>
        <main class="p-5 lg:p-6 max-h-[75vh] overflow-y-auto">
          ${m.loading ? `<p class="text-sm text-slate-500 text-center py-8">Carregando sub-funil…</p>` : this._funnel(m, color)}
        </main>
      </section>
    </div>`;
  },

  _funnel(m, color) {
    const subs = m.substages || [];
    if (!subs.length) {
      return `${this._tagsDatalist(m)}<div class="rounded-2xl bg-white border border-slate-200 p-6 text-center">
        <i data-lucide="layers" class="w-10 h-10 text-slate-300 mx-auto mb-2"></i>
        <p class="text-sm text-slate-600 font-black mb-1">Sem sub-stages configurados.</p>
        <p class="text-xs text-slate-500 mb-4">Lead que entra fica em <strong>Entrada padrão</strong> até você criar a primeira camada.</p>
        <button onclick="Actions.addSubStage()" class="px-4 py-2.5 rounded-xl text-white text-xs font-black" style="background:${color.hex}; color:#fff;">+ Criar primeiro sub-stage</button>
      </div>`;
    }
    return `
      ${this._tagsDatalist(m)}
      <div class="space-y-2" id="substage-funnel-list">
        ${subs.map((s, idx) => this._row(s, idx, subs.length, color, m.savingId === s.id)).join('')}
      </div>
      <button onclick="Actions.addSubStage()" class="w-full mt-3 px-4 py-3 rounded-xl border-2 border-dashed text-xs font-black hover:bg-white transition flex items-center justify-center gap-2"
              style="border-color: ${color.hex}55; color:${color.hex};">
        <i data-lucide="plus" class="w-4 h-4"></i>
        Adicionar sub-stage
      </button>
    `;
  },

  // V35.0.0 — Datalist com tags já usadas no tenant (vocabulário derivado).
  // HTML5 datalist faz autocomplete nativo do navegador. Sem dependência externa.
  _tagsDatalist(m) {
    const tags = Array.isArray(m.knownTags) ? m.knownTags : [];
    if (!tags.length) return '';
    return `<datalist id="lj-known-tags-list">${tags.map(t => `<option value="${Utils.escape(t.tag)}">${t.uses} uso(s)</option>`).join('')}</datalist>`;
  },

  // Cada linha do funil — borda decorativa afunilada, drag handle no canto esquerdo.
  // Largura externa decresce do 100% pro 65% ao longo das linhas.
  _row(sub, idx, total, color, isSaving) {
    const widthPct = 100 - (idx / Math.max(total - 1, 1)) * 35;
    const isDefault = idx === 0;
    const hasError = Boolean(sub._tagError);
    const tagInputClasses = `flex-1 px-2 py-1 rounded-lg bg-slate-50 border text-xs font-bold text-slate-800 focus:bg-white focus:border-slate-400 outline-none ${hasError ? 'border-red-400' : 'border-slate-200'}`;
    const stageColor = sub.color || color.hex;
    return `<div class="relative mx-auto" style="width:${widthPct}%;"
      draggable="true"
      data-substage-id="${sub.id}"
      ondragstart="Actions.subStageDragStart(event, ${sub.id})"
      ondragover="Actions.subStageDragOver(event)"
      ondrop="Actions.subStageDrop(event, ${sub.id})"
      ondragend="Actions.subStageDragEnd(event)">
      <div class="rounded-2xl bg-white border-2 p-3 shadow-sm transition" style="border-color:${stageColor}30;">
        ${isDefault ? `<span class="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest" style="color:#fff;">Entrada padrão</span>` : ''}
        <div class="flex items-start gap-2">
          <div class="shrink-0 flex flex-col items-center justify-center self-stretch text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing" title="Arraste pra reordenar">
            <i data-lucide="grip-vertical" class="w-4 h-4"></i>
          </div>
          <div class="shrink-0 flex flex-col items-center justify-center w-12 h-16 rounded-xl" style="background:${stageColor}15;">
            <span class="text-2xl font-black" style="color:${stageColor};">${sub.leadCount || 0}</span>
            <span class="text-[9px] font-black uppercase tracking-widest text-slate-500">leads</span>
          </div>
          <div class="flex-1 min-w-0 space-y-1.5">
            <input
              type="text"
              value="${Utils.escape(sub.name || '')}"
              placeholder="Nome do sub-stage"
              oninput="Actions.updateSubStageLocal(${sub.id}, 'name', this.value)"
              class="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm font-black text-slate-900 focus:bg-white focus:border-slate-400 outline-none"
            />
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tag:</span>
              <input
                type="text"
                list="lj-known-tags-list"
                value="${Utils.escape(sub.tag_trigger || '')}"
                placeholder="${isDefault ? 'nenhuma (entrada padrão)' : 'ex: proposta-enviada'}"
                oninput="Actions.updateSubStageLocal(${sub.id}, 'tag_trigger', this.value.toLowerCase())"
                data-substage-tag-input="${sub.id}"
                class="${tagInputClasses}"
              />
              ${isSaving ? `<span class="text-[10px] text-emerald-600 font-black">salvando…</span>` : ''}
            </div>
            <p id="substage-tag-err-${sub.id}" class="text-[10px] text-red-600 font-black ${hasError ? '' : 'hidden'}">${Utils.escape(sub._tagError || '')}</p>
            ${this._colorPicker(sub, stageColor)}
          </div>
          <div class="shrink-0 flex flex-col gap-1">
            <button onclick="Actions.toggleSubStageLeads(${sub.id})" title="${sub._expanded ? 'Esconder leads' : 'Ver leads neste sub-stage'}" class="p-1.5 rounded-lg hover:bg-slate-100" style="color:${stageColor};">
              <i data-lucide="${sub._expanded ? 'chevron-up' : 'users'}" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="Actions.requestDeleteSubStage(${sub.id})" title="Remover sub-stage" class="p-1.5 rounded-lg text-red-500 hover:bg-red-50">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
        ${sub._expanded ? this._leadsList(sub, color) : ''}
      </div>
    </div>`;
  },

  // V35.0.0 — Color picker (paleta predefinida). Mostra dot atual + chevron;
  // click expande row de cores. Pra economizar pixel, fica colapsado por default.
  _colorPicker(sub, current) {
    if (!sub._colorOpen) {
      return `<div class="flex items-center gap-1">
        <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cor:</span>
        <button onclick="Actions.toggleSubStageColorPicker(${sub.id})" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md hover:bg-slate-100">
          <span class="w-3 h-3 rounded-full ring-2 ring-white shadow" style="background:${current}"></span>
          <i data-lucide="chevron-down" class="w-3 h-3 text-slate-400"></i>
        </button>
      </div>`;
    }
    return `<div class="flex items-center gap-1.5 flex-wrap">
      <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cor:</span>
      ${this._palette.map(c => `<button onclick="Actions.setSubStageColor(${sub.id}, '${c}')" title="${c}" class="w-4 h-4 rounded-full ring-2 transition ${current === c ? 'ring-slate-900' : 'ring-white hover:ring-slate-300'}" style="background:${c}"></button>`).join('')}
      <button onclick="Actions.setSubStageColor(${sub.id}, null)" title="Herdar cor da bolinha" class="px-1.5 py-0.5 rounded text-[9px] font-black text-slate-500 hover:bg-slate-100">resetar</button>
      <button onclick="Actions.toggleSubStageColorPicker(${sub.id})" class="ml-auto p-0.5 text-slate-400 hover:text-slate-600">
        <i data-lucide="chevron-up" class="w-3 h-3"></i>
      </button>
    </div>`;
  },

  // V34.9.21 — Painel expansível com leads daquele sub-stage.
  _leadsList(sub, color) {
    if (sub._leads === null || sub._leads === undefined) {
      return `<div class="mt-3 pt-3 border-t border-slate-100">
        <p class="text-[11px] text-slate-500 text-center py-2">Carregando leads…</p>
      </div>`;
    }
    if (!sub._leads.length) {
      return `<div class="mt-3 pt-3 border-t border-slate-100">
        <p class="text-[11px] text-slate-500 italic text-center py-2">Nenhum lead neste sub-stage ainda.</p>
      </div>`;
    }
    return `<div class="mt-3 pt-3 border-t border-slate-100">
      <div class="flex items-center justify-between mb-2">
        <p class="text-[9px] font-black text-slate-500 uppercase tracking-widest">${sub._leads.length} lead(s) aqui</p>
        <button onclick="Actions.openBuscadorWithSubStageFilter(${sub.id})" class="text-[10px] font-black flex items-center gap-1 hover:underline" style="color:${color.hex};">
          Abrir no Buscador
          <i data-lucide="arrow-up-right" class="w-3 h-3"></i>
        </button>
      </div>
      <div class="space-y-1 max-h-48 overflow-y-auto">
        ${sub._leads.map(lead => `<div class="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs hover:bg-white transition">
          <div class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${color.hex};"></div>
          <div class="min-w-0 flex-1">
            <p class="font-black text-slate-900 truncate">${Utils.escape(lead.name || lead.email || lead.lj_visitor_id || 'Sem nome')}</p>
            <p class="text-[10px] text-slate-500 truncate">${Utils.escape(lead.email || '')}${lead.phone ? ' · ' + Utils.escape(lead.phone) : ''}</p>
          </div>
          <span class="text-[10px] font-black text-slate-600 shrink-0">${lead.global_score || 0}</span>
        </div>`).join('')}
      </div>
    </div>`;
  }
};
