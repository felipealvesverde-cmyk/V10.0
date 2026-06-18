// V39.10.0 — Flow Builder com guardrails de hierarquia + painel inferior + segmentação.
// Mudanças grandes desde V39.9.3:
//   - Guardrails: Produto sem porta de entrada (só dianteira) · Execução sem
//     porta de saída (só traseira) · conexões bloqueadas fora da hierarquia
//     Produto→Campanha→Ação→Execução.
//   - Paleta lateral REMOVIDA (Auxiliares somem; nodes legacy do tipo aux ainda
//     renderizam pra compat, mas não há como criar novos).
//   - Painel inferior full-width com 2 tabs: Esteira (4 blocos) + Segmentação
//     (Canais Org / Canais Pag / Custom).
//   - Segmentação: arraste item da paleta pro canvas vira fantasma; arraste em
//     cima de uma Ação vira badge (máx 2 por Ação). Drag manual de fantasma
//     no canvas e badges dentro do card; lixeira vermelha aparece durante drag.
//   - Custom segmentations: cor via input HTML5 color (paleta milhões),
//     salvas no tenant pra reuso (`App.state.customSegmentations`).
window.ActionFlowBuilder = {
  NODE_WIDTH: 200,
  NODE_HEIGHT: 130,
  GHOST_WIDTH: 130,
  GHOST_HEIGHT: 34,
  VIEWPORT_MARGIN: 200,

  ESTEIRA_TYPES: [
    { id: 'produto',   label: 'Produto',   icon: 'package',   color: '#a855f7', hierarchy: 1 },
    { id: 'campanha',  label: 'Campanha',  icon: 'megaphone', color: '#06b6d4', hierarchy: 2 },
    { id: 'acao',      label: 'Ação',      icon: 'zap',       color: '#f59e0b', hierarchy: 3 },
    { id: 'execucao',  label: 'Execução',  icon: 'play',      color: '#10b981', hierarchy: 4 }
  ],

  // Mantido pra renderizar nodes legacy de tenants antigos. Sem path pra criar novos.
  LEGACY_AUX_TYPES: [
    { id: 'channel',  label: 'Canal',    icon: 'radio',           color: '#8b5cf6' },
    { id: 'lp',       label: 'LP',       icon: 'layout',          color: '#a78bfa' },
    { id: 'email',    label: 'Email',    icon: 'mail',            color: '#0ea5e9' },
    { id: 'webinar',  label: 'Webinar',  icon: 'video',           color: '#38bdf8' },
    { id: 'sdr',      label: 'SDR',      icon: 'phone-call',      color: '#f59e0b' },
    { id: 'whatsapp', label: 'WhatsApp', icon: 'message-circle',  color: '#10b981' },
    { id: 'checkout', label: 'Checkout', icon: 'shopping-cart',   color: '#ec4899' },
    { id: 'crm',      label: 'CRM',      icon: 'workflow',        color: '#6366f1' },
    { id: 'cs',       label: 'CS',       icon: 'heart-handshake', color: '#14b8a6' },
    { id: 'custom',   label: 'Custom',   icon: 'square',          color: '#64748b' }
  ],

  SEGMENTATION_CATEGORIES: [
    { key: 'organic', label: 'Canais Org', icon: 'leaf',        accent: '#10b981', items: [
      { key: 'instagram',     name: 'Instagram',     color: '#E4405F', icon: 'instagram' },
      { key: 'facebook',      name: 'Facebook',      color: '#1877F2', icon: 'facebook' },
      { key: 'tiktok',        name: 'TikTok',        color: '#020617', icon: 'music' },
      { key: 'whatsapp_org',  name: 'WhatsApp',      color: '#25D366', icon: 'message-circle' },
      { key: 'google_org',    name: 'Google',        color: '#4285F4', icon: 'search' },
      { key: 'youtube',       name: 'YouTube',       color: '#FF0000', icon: 'youtube' },
      { key: 'influenciador', name: 'Influenciador', color: '#F472B6', icon: 'star' },
      { key: 'newsletter',    name: 'Newsletter',    color: '#F59E0B', icon: 'mail' },
      { key: 'site',          name: 'Site',          color: '#6366F1', icon: 'globe' }
    ] },
    { key: 'paid', label: 'Canais Pag', icon: 'dollar-sign', accent: '#F59E0B', items: [
      { key: 'meta_ads',        name: 'Meta Ads',     color: '#0866FF', icon: 'target' },
      { key: 'google_ads',      name: 'Google Ads',   color: '#4285F4', icon: 'megaphone' },
      { key: 'patrocinada',     name: 'Patrocinada',  color: '#A855F7', icon: 'badge-dollar-sign' },
      { key: 'influencer_paid', name: 'Influencer',   color: '#EC4899', icon: 'star' },
      { key: 'retail_midia',    name: 'Retail Mídia', color: '#F97316', icon: 'shopping-bag' },
      { key: 'linkedin',        name: 'LinkedIn',     color: '#0A66C2', icon: 'linkedin' },
      { key: 'ooh',             name: 'OOH',          color: '#10B981', icon: 'tv' }
    ] }
  ],

  ALLOWED_CONNECTIONS: {
    produto: ['campanha'],
    campanha: ['acao'],
    acao: ['execucao'],
    execucao: []
  },

  _internal: {
    container: null,
    dragNode: null,
    pendingConnection: null,
    panning: null,
    dragGhost: null, // { ghostId, offsetX, offsetY }
    hoveredActionId: null
  },

  typeById(id) {
    return this.ESTEIRA_TYPES.find(t => t.id === id)
      || this.LEGACY_AUX_TYPES.find(t => t.id === id)
      || this.LEGACY_AUX_TYPES[this.LEGACY_AUX_TYPES.length - 1];
  },
  isEsteira(typeId) { return this.ESTEIRA_TYPES.some(t => t.id === typeId); },

  segmentationByKey(key) {
    if (!key) return null;
    for (const cat of this.SEGMENTATION_CATEGORIES) {
      const item = cat.items.find(i => i.key === key);
      if (item) return { ...item, category: cat.key };
    }
    const custom = (App.state.customSegmentations || []).find(s => s.key === key);
    if (custom) return { ...custom, category: 'custom' };
    return null;
  },

  genId() { return `n_${Date.now()}_${Math.floor(Math.random() * 100000)}`; },
  genGhostId() { return `gh_${Date.now()}_${Math.floor(Math.random() * 100000)}`; },

  defaultData(typeId) {
    switch (typeId) {
      case 'produto':  return { name: '', revenueModel: 'Venda única', type: '', price: '' };
      case 'campanha': return { name: '' };
      case 'acao':     return { name: '', sector: 'Marketing', funnel: 'MOF', objective: '', segmentations: [] };
      case 'execucao': return { name: '' };
      default:         return { name: '' };
    }
  },

  render() {
    if (!App.state.showFlowBuilderModal) return '';
    const zoom = Number(App.state.flowBuilderZoom || 1.0);
    return `<div class="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-sm p-4 overflow-auto grid place-items-start justify-items-center">
      <div class="rounded-[2rem] overflow-hidden shadow-2xl text-white" style="width:90vw;max-width:none;background: radial-gradient(circle at 18% 10%, rgba(99,102,241,.22), transparent 30%), #071326;">
        ${this._header()}
        ${App.state.flowBuilderShowHelp ? this._helpPanel() : ''}
        <div class="p-6 space-y-3">
          <div class="relative min-w-0">
            ${this._zoomControls(zoom)}
            <div id="flowBuilderCanvas" class="relative rounded-3xl border border-white/10 bg-white/[0.04] h-[58vh] overflow-hidden min-w-0"
                 ondragover="ActionFlowBuilder._onCanvasDragOver(event)"
                 ondrop="ActionFlowBuilder._onCanvasDrop(event)">
              ${this._emptyCanvasHint()}
              ${this._trashBin()}
            </div>
          </div>
          ${this._bottomPanel()}
        </div>
        ${this._disconnectModal()}
        ${this._editNodeModal()}
        ${this._clearConfirmModal()}
        ${this._loadCampaignModal()}
        ${this._customSegmentationModal()}
      </div>
    </div>`;
  },

  _header() {
    const nodes = App.state.flowBuilderNodes || [];
    const edges = App.state.flowBuilderEdges || [];
    const esteiraCount = nodes.filter(n => this.isEsteira(n.type)).length;
    const novos = nodes.filter(n => this.isEsteira(n.type) && !n.linkedRealId).length;
    const novosLabel = novos > 0 ? ` · ${novos} pendente${novos === 1 ? '' : 's'} de salvar` : '';
    return `<header class="p-6 border-b border-white/10 flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-2"><i data-lucide="git-merge" class="w-4 h-4 text-indigo-300"></i><p class="text-xs font-black text-slate-300 uppercase tracking-wider">Flow Builder · Esteira do LJ</p></div>
        <h2 class="text-2xl font-black">Desenhe Produto → Campanha → Ação → Execução</h2>
        <p class="text-sm text-slate-300 mt-1">${nodes.length} ${nodes.length === 1 ? 'bloco' : 'blocos'} · ${edges.length} ${edges.length === 1 ? 'conexão' : 'conexões'} · ${esteiraCount} da esteira${novosLabel}</p>
      </div>
      <div class="flex items-center gap-2 flex-wrap justify-end">
        <button onclick="Actions.openFlowBuilderLoadCampaign()" title="Carregar campanha existente pra editar" class="px-3 py-2.5 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/30 text-sky-100 text-xs font-black flex items-center gap-1"><i data-lucide="folder-open" class="w-3.5 h-3.5"></i> Carregar campanha</button>
        <button onclick="Actions.saveFlowBuilder()" title="Salva os blocos da esteira como Produto/Campanha/Ação/Execução reais" class="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black flex items-center gap-1"><i data-lucide="save" class="w-3.5 h-3.5"></i> Salvar esteira</button>
        <button onclick="Actions.toggleFlowBuilderHelp()" title="Como funciona" class="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-black flex items-center gap-1"><i data-lucide="help-circle" class="w-3.5 h-3.5"></i> Ajuda</button>
        <button onclick="Actions.requestFlowBuilderClear()" title="Apagar tudo do canvas" class="px-3 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-400/30 text-red-200 text-xs font-black flex items-center gap-1"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Limpar</button>
        <button onclick="Actions.closeFlowBuilder()" class="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-semibold flex items-center gap-2"><i data-lucide="x" class="w-4 h-4"></i> Fechar</button>
      </div>
    </header>`;
  },

  _helpPanel() {
    return `<div class="mx-6 mt-4 rounded-2xl bg-indigo-500/15 border border-indigo-400/30 p-4 text-sm text-indigo-100">
      <div class="flex items-start justify-between gap-3 mb-2"><p class="font-black">Como funciona o Flow Builder</p><button onclick="Actions.toggleFlowBuilderHelp()" class="text-indigo-200 text-xs font-black">×</button></div>
      <ul class="space-y-1 text-xs">
        <li>• <b>Esteira:</b> Produto · Campanha · Ação · Execução. Quando salvar, viram entidades reais nas abas do LJ.</li>
        <li>• <b>Adicionar bloco:</b> clique num tipo da Esteira no painel embaixo. Esteira abre modal pedindo nome + campos do tipo.</li>
        <li>• <b>Hierarquia rígida de conexão:</b> Produto → Campanha · Campanha → Ação · Ação → Execução. Tentar conectar fora dessa cadeia é bloqueado.</li>
        <li>• <b>Pan do canvas:</b> segure o mouse num espaço vazio e arraste. Botão central da régua de zoom volta pra origem.</li>
        <li>• <b>Editar bloco:</b> duplo clique no bloco abre modal com os campos do tipo.</li>
        <li>• <b>Segmentação:</b> tab "Segmentação" no painel embaixo. Arraste uma seg pro canvas (vira fantasma) ou direto pra uma Ação (vira badge). Máx 2 badges por Ação.</li>
        <li>• <b>Remover segmentação:</b> segure a badge dentro do card e arraste pra fora (vira fantasma) ou pra lixeira vermelha. Fantasma sozinho pode ir pra lixeira também.</li>
        <li>• <b>Carregar campanha:</b> botão azul. Importa Produto + Campanha + Ações + Execuções como blocos pré-vinculados.</li>
        <li>• <b>Salvar:</b> botão verde. Topological: Produto → Campanha → Ação → Execução. Re-saves não duplicam.</li>
      </ul>
    </div>`;
  },

  _emptyCanvasHint() {
    const nodes = App.state.flowBuilderNodes || [];
    if (nodes.length) return '';
    return `<div data-empty-hint class="absolute inset-0 grid place-items-center text-center p-6 pointer-events-none">
      <div class="max-w-md">
        <i data-lucide="git-merge" class="w-8 h-8 text-indigo-300 mx-auto mb-3"></i>
        <p class="text-sm text-slate-300">Canvas vazio. Clique em <b>Produto</b> no painel embaixo pra começar, ou em <b>Carregar campanha</b> no header pra continuar uma existente.</p>
      </div>
    </div>`;
  },

  _zoomControls(zoom) {
    return `<div class="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-2xl bg-slate-950/80 border border-white/10 p-1">
      <button onclick="Actions.setFlowBuilderZoom(-0.1)" title="Diminuir zoom" class="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 text-white font-black"><i data-lucide="minus" class="w-3.5 h-3.5 mx-auto"></i></button>
      <button onclick="Actions.resetFlowBuilderZoom()" title="Resetar zoom e voltar pra origem" class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-[11px] font-black">${Math.round(zoom * 100)}%</button>
      <button onclick="Actions.setFlowBuilderZoom(0.1)" title="Aumentar zoom" class="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 text-white font-black"><i data-lucide="plus" class="w-3.5 h-3.5 mx-auto"></i></button>
    </div>`;
  },

  _trashBin() {
    return `<div id="flowBuilderTrashBin" style="display:none;" class="absolute bottom-5 right-5 z-30 w-24 h-24 rounded-3xl bg-red-500/40 border-2 border-red-400/80 flex-col items-center justify-center text-red-100 pointer-events-none animate-pulse shadow-2xl">
      <i data-lucide="trash-2" class="w-9 h-9"></i>
      <span class="text-[10px] font-black uppercase tracking-wider mt-1">Apagar</span>
    </div>`;
  },

  _bottomPanel() {
    const tab = App.state.flowBuilderPaletteTab || 'esteira';
    return `<div class="rounded-3xl border border-white/10 bg-white/[0.055] p-4">
      <div class="flex gap-2 mb-3 border-b border-white/10 pb-3">
        <button onclick="Actions.setFlowBuilderPaletteTab('esteira')" class="${tab === 'esteira' ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100' : 'bg-white/5 border-white/10 text-slate-300'} px-4 py-2 rounded-xl font-black text-xs border flex items-center gap-1.5">
          <i data-lucide="layers" class="w-3.5 h-3.5"></i> Esteira
        </button>
        <button onclick="Actions.setFlowBuilderPaletteTab('segmentacao')" class="${tab === 'segmentacao' ? 'bg-sky-500/20 border-sky-400/40 text-sky-100' : 'bg-white/5 border-white/10 text-slate-300'} px-4 py-2 rounded-xl font-black text-xs border flex items-center gap-1.5">
          <i data-lucide="tag" class="w-3.5 h-3.5"></i> Segmentação
        </button>
      </div>
      ${tab === 'esteira' ? this._esteiraPanel() : this._segmentacaoPanel()}
    </div>`;
  },

  _esteiraPanel() {
    const items = this.ESTEIRA_TYPES.map(t => `
      <button onclick="Actions.addFlowBuilderNode('${t.id}')" class="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.10] border border-white/10 text-white text-left transition" style="border-left: 4px solid ${t.color};">
        <span class="w-9 h-9 rounded-xl grid place-items-center" style="background:${t.color}22;color:${t.color};"><i data-lucide="${t.icon}" class="w-4 h-4"></i></span>
        <span class="text-sm font-black flex-1">${Utils.escape(t.label)}</span>
        <i data-lucide="plus" class="w-4 h-4 text-slate-400"></i>
      </button>
    `).join('');
    return `<div class="grid grid-cols-4 gap-3">${items}</div>
      <p class="text-[10px] text-slate-500 mt-3">Hierarquia rígida: Produto → Campanha → Ação → Execução. Produto não recebe entrada; Execução não tem saída.</p>`;
  },

  _segmentacaoPanel() {
    const cat = App.state.flowBuilderSegCategory || 'organic';
    const customs = App.state.customSegmentations || [];
    const subtabs = `
      <div class="flex gap-2 mb-3 flex-wrap items-center">
        <button onclick="Actions.setFlowBuilderSegCategory('organic')" class="${cat === 'organic' ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-100' : 'bg-white/5 border-white/10 text-slate-300'} px-3 py-1.5 rounded-full font-black text-[11px] border flex items-center gap-1.5"><i data-lucide="leaf" class="w-3 h-3"></i> Canais Org</button>
        <button onclick="Actions.setFlowBuilderSegCategory('paid')" class="${cat === 'paid' ? 'bg-amber-500/25 border-amber-400/50 text-amber-100' : 'bg-white/5 border-white/10 text-slate-300'} px-3 py-1.5 rounded-full font-black text-[11px] border flex items-center gap-1.5"><i data-lucide="dollar-sign" class="w-3 h-3"></i> Canais Pag</button>
        <button onclick="Actions.setFlowBuilderSegCategory('custom')" class="${cat === 'custom' ? 'bg-purple-500/25 border-purple-400/50 text-purple-100' : 'bg-white/5 border-white/10 text-slate-300'} px-3 py-1.5 rounded-full font-black text-[11px] border flex items-center gap-1.5"><i data-lucide="paintbrush" class="w-3 h-3"></i> Custom</button>
        ${cat === 'custom' ? `<button onclick="Actions.openFlowBuilderCustomSegModal()" class="ml-auto px-3 py-1.5 rounded-full font-black text-[11px] bg-purple-500 hover:bg-purple-600 text-white flex items-center gap-1.5"><i data-lucide="plus" class="w-3 h-3"></i> Nova segmentação</button>` : ''}
      </div>`;

    let items;
    if (cat === 'custom') items = customs;
    else items = this.SEGMENTATION_CATEGORIES.find(c => c.key === cat)?.items || [];

    if (cat === 'custom' && !items.length) {
      return `${subtabs}<p class="text-xs text-slate-400 py-6 text-center">Nenhuma segmentação custom criada ainda. Clique em "Nova segmentação" pra criar a primeira.</p>`;
    }

    const itemsHtml = items.map(item => `
      <div draggable="true"
           ondragstart="ActionFlowBuilder._onPaletteSegDragStart(event, '${item.key}')"
           class="cursor-grab active:cursor-grabbing flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.10] border border-white/10 text-white relative group"
           style="border-left: 3px solid ${item.color};">
        <span class="w-6 h-6 rounded-lg grid place-items-center shrink-0" style="background:${item.color}33;color:${item.color};"><i data-lucide="${item.icon || 'tag'}" class="w-3 h-3"></i></span>
        <span class="text-xs font-black flex-1 truncate">${Utils.escape(item.name)}</span>
        ${cat === 'custom' ? `<button onclick="event.stopPropagation();Actions.deleteFlowBuilderCustomSegmentation('${item.key}')" title="Apagar do tenant" class="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-100 transition"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>` : ''}
      </div>
    `).join('');

    return `${subtabs}<div class="grid grid-cols-5 gap-2">${itemsHtml}</div>
      <p class="text-[10px] text-slate-500 mt-3">Arraste pro canvas (vira fantasma) ou direto pra um bloco de <b>Ação</b> (vira badge — máx 2 por ação).</p>`;
  },

  _customSegmentationModal() {
    if (!App.state.flowBuilderCustomSegModal) return '';
    const draft = App.state.flowBuilderCustomSegDraft || { name: '', color: '#a855f7' };
    return `<div class="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm grid place-items-center p-4">
      <div class="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md text-white">
        <h3 class="text-xl font-black mb-1">Nova segmentação custom</h3>
        <p class="text-xs text-slate-400 mb-4">Salva permanente no tenant — fica disponível em todos os fluxos.</p>
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Nome</label>
        <input id="flowBuilderCustomSegInput" value="${Utils.escape(draft.name)}" oninput="Actions.updateFlowBuilderCustomSegDraft('name', this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();Actions.saveFlowBuilderCustomSegmentation();}else if(event.key==='Escape'){event.preventDefault();Actions.closeFlowBuilderCustomSegModal();}" placeholder="Ex: Black Friday 2026" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm">
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider mt-3 block">Cor (paleta livre)</label>
        <div class="flex items-center gap-3 mt-1">
          <input type="color" value="${draft.color}" oninput="Actions.updateFlowBuilderCustomSegDraft('color', this.value)" class="w-14 h-14 rounded-xl border-2 border-white/15 cursor-pointer bg-transparent" title="Clique pra abrir paleta">
          <span class="text-xs font-black px-3 py-2 rounded-lg" style="background:${draft.color}33;color:${draft.color};border:1px solid ${draft.color}66;">${draft.color}</span>
          <span class="text-[10px] text-slate-500">Clique no quadrado pra abrir paleta de milhões de cores.</span>
        </div>
        <div class="flex justify-end gap-2 mt-5">
          <button onclick="Actions.closeFlowBuilderCustomSegModal()" class="px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-black">Cancelar</button>
          <button onclick="Actions.saveFlowBuilderCustomSegmentation()" class="px-4 py-3 rounded-2xl bg-purple-500 hover:bg-purple-600 text-white font-black">Salvar</button>
        </div>
      </div>
    </div>`;
  },

  _disconnectModal() {
    const edgeId = App.state.flowBuilderDisconnectEdgeId;
    if (!edgeId) return '';
    const edge = (App.state.flowBuilderEdges || []).find(e => e.id === edgeId);
    if (!edge) return '';
    const nodes = App.state.flowBuilderNodes || [];
    const from = nodes.find(n => n.id === edge.fromId);
    const to = nodes.find(n => n.id === edge.toId);
    return `<div class="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm grid place-items-center p-4">
      <div class="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md text-white">
        <h3 class="text-xl font-black mb-2">Desconectar blocos?</h3>
        <p class="text-sm text-slate-300 mb-4">Isso remove o vínculo entre <b>${Utils.escape(from?.name || '?')}</b> e <b>${Utils.escape(to?.name || '?')}</b>. Para refazer, arme a conexão novamente.</p>
        <div class="flex justify-end gap-2">
          <button onclick="Actions.cancelFlowBuilderEdgeDisconnect()" class="px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-black">Cancelar</button>
          <button onclick="Actions.confirmFlowBuilderEdgeDisconnect()" class="px-4 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-black">Confirmar desconexão</button>
        </div>
      </div>
    </div>`;
  },

  _editNodeModal() {
    const nodeId = App.state.flowBuilderEditNodeId;
    if (!nodeId) return '';
    const node = (App.state.flowBuilderNodes || []).find(n => n.id === nodeId);
    if (!node) return '';
    const type = this.typeById(node.type);
    const draft = App.state.flowBuilderEditNodeDraft || {};
    const isEsteira = this.isEsteira(node.type);
    const linked = node.linkedRealId ? `<span class="ml-2 text-[10px] font-black text-emerald-300 bg-emerald-500/15 border border-emerald-400/30 rounded-full px-2 py-0.5">já no LJ</span>` : '';
    return `<div class="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm grid place-items-center p-4">
      <div class="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md text-white">
        <h3 class="text-xl font-black mb-1 flex items-center">Editar bloco ${linked}</h3>
        <p class="text-xs text-slate-400 mb-4">Tipo: <span style="color:${type.color}">${Utils.escape(type.label)}</span>${isEsteira ? ' · vira entidade real ao salvar' : ' · só rascunho visual (legacy)'}</p>
        ${this._editNodeFields(node.type, draft)}
        <div class="flex justify-end gap-2 mt-5">
          <button onclick="Actions.cancelFlowBuilderEditNode()" class="px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-black">Cancelar</button>
          <button onclick="Actions.saveFlowBuilderEditNode()" class="px-4 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-black">Salvar</button>
        </div>
      </div>
    </div>`;
  },

  _editNodeFields(typeId, draft) {
    const v = (k, fallback) => Utils.escape(String(draft[k] != null ? draft[k] : (fallback || '')));
    const nameInput = `
      <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Nome</label>
      <input id="flowBuilderEditNodeInput" value="${v('name')}" oninput="Actions.updateFlowBuilderEditNodeField('name', this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();Actions.saveFlowBuilderEditNode();}else if(event.key==='Escape'){event.preventDefault();Actions.cancelFlowBuilderEditNode();}" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm" placeholder="Nome..." />
    `;
    if (typeId === 'produto') {
      return `${nameInput}
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider mt-3 block">Recorrência</label>
        <select onchange="Actions.updateFlowBuilderEditNodeField('revenueModel', this.value)" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm">
          <option value="Venda única" ${draft.revenueModel === 'Venda única' ? 'selected' : ''}>Venda única</option>
          <option value="Mensal" ${draft.revenueModel === 'Mensal' ? 'selected' : ''}>Mensal</option>
          <option value="Anual" ${draft.revenueModel === 'Anual' ? 'selected' : ''}>Anual</option>
          <option value="Trimestral" ${draft.revenueModel === 'Trimestral' ? 'selected' : ''}>Trimestral</option>
          <option value="Outro" ${draft.revenueModel === 'Outro' ? 'selected' : ''}>Outro</option>
        </select>
        <p class="text-[10px] text-slate-500 mt-2">Audiência (ICP), preço e custo são preenchidos depois na aba <b>Produtos</b> do LJ.</p>`;
    }
    if (typeId === 'campanha') {
      return `${nameInput}
        <p class="text-[10px] text-slate-500 mt-2">A campanha herda o produto via conexão no canvas. Setor, owner, objetivo e demais detalhes ficam pra editar depois na aba <b>Campanhas</b>.</p>`;
    }
    if (typeId === 'acao') {
      return `${nameInput}
        <div class="grid grid-cols-2 gap-2 mt-3">
          <div>
            <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Setor</label>
            <select onchange="Actions.updateFlowBuilderEditNodeField('sector', this.value)" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm">
              <option value="Marketing" ${draft.sector === 'Marketing' ? 'selected' : ''}>Marketing</option>
              <option value="Vendas" ${draft.sector === 'Vendas' ? 'selected' : ''}>Vendas</option>
              <option value="CS" ${draft.sector === 'CS' ? 'selected' : ''}>CS</option>
            </select>
          </div>
          <div>
            <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Funil</label>
            <select onchange="Actions.updateFlowBuilderEditNodeField('funnel', this.value)" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm">
              <option value="TOF" ${draft.funnel === 'TOF' ? 'selected' : ''}>TOF</option>
              <option value="MOF" ${draft.funnel === 'MOF' ? 'selected' : ''}>MOF</option>
              <option value="BOF" ${draft.funnel === 'BOF' ? 'selected' : ''}>BOF</option>
            </select>
          </div>
        </div>
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider mt-3 block">Objetivo (opcional)</label>
        <textarea oninput="Actions.updateFlowBuilderEditNodeField('objective', this.value)" rows="2" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm" placeholder="O que a ação visa entregar...">${v('objective')}</textarea>
        <p class="text-[10px] text-slate-500 mt-2">Canal, OKRs e configurações operacionais entram depois na aba <b>Ações</b> do LJ.</p>`;
    }
    if (typeId === 'execucao') {
      return nameInput + `<p class="text-[10px] text-slate-500 mt-2">Título da tarefa que aparecerá em <b>Execuções</b>.</p>`;
    }
    return nameInput;
  },

  _clearConfirmModal() {
    if (!App.state.flowBuilderClearConfirm) return '';
    const n = (App.state.flowBuilderNodes || []).length;
    const e = (App.state.flowBuilderEdges || []).length;
    return `<div class="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm grid place-items-center p-4">
      <div class="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md text-white">
        <h3 class="text-xl font-black mb-2">Apagar todo o canvas?</h3>
        <p class="text-sm text-slate-300 mb-4">Vão ser removidos <b>${n}</b> blocos, <b>${e}</b> conexões e todos os fantasmas do canvas. <span class="text-amber-300">O que já foi salvo nas abas do LJ não é desfeito</span> — só limpa o desenho.</p>
        <div class="flex justify-end gap-2">
          <button onclick="Actions.cancelFlowBuilderClear()" class="px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-black">Cancelar</button>
          <button onclick="Actions.confirmFlowBuilderClear()" class="px-4 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-black">Apagar canvas</button>
        </div>
      </div>
    </div>`;
  },

  _loadCampaignModal() {
    if (!App.state.flowBuilderLoadCampaignModal) return '';
    const products = App.state.products || [];
    const campaigns = App.state.campaigns || [];
    const actions = App.state.actions || [];
    const groups = products.map(p => {
      const ownCamps = campaigns.filter(c => Number(c.productId) === Number(p.id));
      if (!ownCamps.length) return '';
      const items = ownCamps.map(c => {
        const nActions = actions.filter(a => Number(a.campaignId) === Number(c.id)).length;
        return `<button onclick="Actions.loadCampaignToFlowBuilder(${c.id})" class="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04] hover:bg-sky-500/15 border border-white/10 hover:border-sky-400/30 text-white text-left transition">
          <span class="flex items-center gap-2 min-w-0"><i data-lucide="megaphone" class="w-3.5 h-3.5 text-cyan-300 shrink-0"></i><span class="text-sm font-black truncate">${Utils.escape(c.name)}</span></span>
          <span class="text-[11px] text-slate-400 shrink-0">${nActions} ${nActions === 1 ? 'ação' : 'ações'}</span>
        </button>`;
      }).join('');
      return `<div class="space-y-1">
        <p class="text-[11px] font-black text-purple-300 uppercase tracking-wider px-1 flex items-center gap-1.5"><i data-lucide="package" class="w-3 h-3"></i> ${Utils.escape(p.name)}</p>
        <div class="space-y-1.5">${items}</div>
      </div>`;
    }).filter(Boolean).join('');
    const orphanCamps = campaigns.filter(c => !products.find(p => Number(p.id) === Number(c.productId)));
    let orphanBlock = '';
    if (orphanCamps.length) {
      const items = orphanCamps.map(c => `<button onclick="Actions.loadCampaignToFlowBuilder(${c.id})" class="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04] hover:bg-amber-500/15 border border-amber-400/20 text-white text-left transition">
        <span class="flex items-center gap-2 min-w-0"><i data-lucide="megaphone" class="w-3.5 h-3.5 text-amber-300 shrink-0"></i><span class="text-sm font-black truncate">${Utils.escape(c.name)}</span></span>
        <span class="text-[10px] text-amber-300 shrink-0">sem produto</span>
      </button>`).join('');
      orphanBlock = `<div class="space-y-1"><p class="text-[11px] font-black text-amber-300 uppercase tracking-wider px-1">Sem produto</p><div class="space-y-1.5">${items}</div></div>`;
    }
    const empty = !groups && !orphanBlock;
    return `<div class="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm grid place-items-center p-4">
      <div class="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg text-white max-h-[80vh] flex flex-col">
        <h3 class="text-xl font-black mb-1">Carregar campanha existente</h3>
        <p class="text-xs text-slate-400 mb-4">Importa o Produto, a Campanha, todas as Ações e Execuções dela pro canvas — pré-vinculadas. Você pode adicionar mais blocos e salvar de novo.</p>
        <div class="flex-1 overflow-auto space-y-4 pr-1">
          ${empty ? '<p class="text-sm text-slate-400 text-center py-8">Nenhuma campanha existe ainda no LJ. Crie a primeira aqui mesmo: adicione um Produto na paleta, conecte uma Campanha, e salve.</p>' : ''}
          ${groups}
          ${orphanBlock}
        </div>
        <div class="flex justify-end gap-2 mt-4 pt-4 border-t border-white/10">
          <button onclick="Actions.closeFlowBuilderLoadCampaign()" class="px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-black">Fechar</button>
        </div>
      </div>
    </div>`;
  },

  attach() {
    const root = document.getElementById('flowBuilderCanvas');
    if (!root) return;
    this._internal.container = root;
    this._drawCanvas();
    setTimeout(() => {
      const inputEdit = document.getElementById('flowBuilderEditNodeInput');
      if (inputEdit) { inputEdit.focus(); inputEdit.select(); }
      const inputCustom = document.getElementById('flowBuilderCustomSegInput');
      if (inputCustom) { inputCustom.focus(); inputCustom.select(); }
    }, 0);
  },

  _inputPort(node) { return { x: node.x, y: node.y + this.NODE_HEIGHT / 2 }; },
  _outputPort(node) { return { x: node.x + this.NODE_WIDTH, y: node.y + this.NODE_HEIGHT / 2 }; },

  _edgePath(fromX, fromY, toX, toY) {
    const dx = Math.max(60, (toX - fromX) / 2);
    return `M ${fromX} ${fromY} C ${fromX + dx} ${fromY}, ${toX - dx} ${toY}, ${toX} ${toY}`;
  },

  _drawCanvas() {
    const root = this._internal.container;
    if (!root) return;
    const nodes = App.state.flowBuilderNodes || [];
    const ghosts = App.state.flowBuilderGhostSegmentations || [];
    if (!nodes.length && !ghosts.length) return;
    const rect = root.getBoundingClientRect();
    const viewW = Math.max(200, rect.width || 800);
    const viewH = Math.max(200, rect.height || 500);

    const zoom = Number(App.state.flowBuilderZoom || 1.0);
    const panX = Number(App.state.flowBuilderPanX || 0);
    const panY = Number(App.state.flowBuilderPanY || 0);

    const margin = this.VIEWPORT_MARGIN;
    const visLeft   = (-panX) / zoom - margin;
    const visTop    = (-panY) / zoom - margin;
    const visRight  = (viewW - panX) / zoom + margin;
    const visBottom = (viewH - panY) / zoom + margin;

    const nodesVisible = nodes.filter(n =>
      (n.x + this.NODE_WIDTH) >= visLeft &&
      n.x <= visRight &&
      (n.y + this.NODE_HEIGHT) >= visTop &&
      n.y <= visBottom
    );
    const visibleNodeIds = new Set(nodesVisible.map(n => String(n.id)));

    const edges = App.state.flowBuilderEdges || [];
    const edgesVisible = edges.filter(e => {
      const from = nodes.find(n => n.id === e.fromId);
      const to = nodes.find(n => n.id === e.toId);
      if (!from || !to) return false;
      if (visibleNodeIds.has(String(e.fromId)) || visibleNodeIds.has(String(e.toId))) return true;
      const fp = this._outputPort(from);
      const tp = this._inputPort(to);
      const lL = Math.min(fp.x, tp.x), lR = Math.max(fp.x, tp.x);
      const lT = Math.min(fp.y, tp.y), lB = Math.max(fp.y, tp.y);
      return lR >= visLeft && lL <= visRight && lB >= visTop && lT <= visBottom;
    });

    const ghostsVisible = ghosts.filter(g =>
      (g.x + this.GHOST_WIDTH) >= visLeft &&
      g.x <= visRight &&
      (g.y + this.GHOST_HEIGHT) >= visTop &&
      g.y <= visBottom
    );

    const svgNS = 'http://www.w3.org/2000/svg';
    // V39.10.1 — Remove só SVG/hint anteriores; preserva #flowBuilderTrashBin
    // (que precisa ficar visível durante drag de fantasma/badge).
    const oldSvg = root.querySelector('svg');
    if (oldSvg) oldSvg.remove();
    const oldHint = root.querySelector('[data-empty-hint]');
    if (oldHint) oldHint.remove();
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${viewW} ${viewH}`);
    svg.setAttribute('style', 'width:100%;height:100%;display:block;');
    svg.style.cursor = 'grab';

    const world = document.createElementNS(svgNS, 'g');
    world.setAttribute('id', 'flowWorld');
    world.setAttribute('transform', `translate(${panX}, ${panY}) scale(${zoom})`);
    svg.appendChild(world);

    const gridStep = 40;
    const gx0 = Math.floor(visLeft / gridStep) * gridStep;
    const gx1 = Math.ceil(visRight / gridStep) * gridStep;
    const gy0 = Math.floor(visTop / gridStep) * gridStep;
    const gy1 = Math.ceil(visBottom / gridStep) * gridStep;
    const grid = document.createElementNS(svgNS, 'g');
    grid.setAttribute('opacity', '0.5');
    for (let x = gx0; x <= gx1; x += gridStep) {
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', x); line.setAttribute('y1', gy0);
      line.setAttribute('x2', x); line.setAttribute('y2', gy1);
      line.setAttribute('stroke', '#334155'); line.setAttribute('stroke-width', '0.6');
      grid.appendChild(line);
    }
    for (let y = gy0; y <= gy1; y += gridStep) {
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', gx0); line.setAttribute('y1', y);
      line.setAttribute('x2', gx1); line.setAttribute('y2', y);
      line.setAttribute('stroke', '#334155'); line.setAttribute('stroke-width', '0.6');
      grid.appendChild(line);
    }
    world.appendChild(grid);

    const armedId = App.state.flowBuilderConnectionArm;

    const edgesLayer = document.createElementNS(svgNS, 'g');
    edgesLayer.setAttribute('id', 'flowEdgesLayer');
    world.appendChild(edgesLayer);
    for (const edge of edgesVisible) this._renderEdge(svgNS, edgesLayer, edge, nodes);

    const nodesLayer = document.createElementNS(svgNS, 'g');
    nodesLayer.setAttribute('id', 'flowNodesLayer');
    world.appendChild(nodesLayer);
    for (const node of nodesVisible) this._renderNode(svgNS, nodesLayer, node, armedId, edges);

    const ghostsLayer = document.createElementNS(svgNS, 'g');
    ghostsLayer.setAttribute('id', 'flowGhostsLayer');
    world.appendChild(ghostsLayer);
    for (const ghost of ghostsVisible) this._renderGhost(svgNS, ghostsLayer, ghost);

    root.appendChild(svg);
    this._attachSvgListeners(svg);
  },

  _renderEdge(svgNS, parent, edge, nodes) {
    const from = nodes.find(n => n.id === edge.fromId);
    const to = nodes.find(n => n.id === edge.toId);
    if (!from || !to) return;
    const fromPort = this._outputPort(from);
    const toPort = this._inputPort(to);
    const stroke = '#a78bfa';
    const hitArea = document.createElementNS(svgNS, 'path');
    hitArea.setAttribute('d', this._edgePath(fromPort.x, fromPort.y, toPort.x, toPort.y));
    hitArea.setAttribute('stroke', 'transparent');
    hitArea.setAttribute('stroke-width', '14');
    hitArea.setAttribute('fill', 'none');
    hitArea.style.cursor = 'pointer';
    hitArea.dataset.edgeId = edge.id;
    hitArea.addEventListener('click', (event) => {
      event.stopPropagation();
      Actions.requestFlowBuilderEdgeDisconnect(edge.id);
    });
    parent.appendChild(hitArea);
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', this._edgePath(fromPort.x, fromPort.y, toPort.x, toPort.y));
    path.setAttribute('stroke', stroke);
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('fill', 'none');
    path.style.pointerEvents = 'none';
    parent.appendChild(path);
  },

  _renderNode(svgNS, parent, node, armedId, edges) {
    const type = this.typeById(node.type);
    const isArmed = String(armedId) === String(node.id);
    const otherArmed = armedId && !isArmed;
    const isEsteira = this.isEsteira(node.type);
    const linked = isEsteira && !!node.linkedRealId;
    const isProduto = node.type === 'produto';
    const isExecucao = node.type === 'execucao';
    const isAcao = node.type === 'acao';
    const isHoveredForSeg = String(this._internal.hoveredActionId || '') === String(node.id);

    const group = document.createElementNS(svgNS, 'g');
    group.setAttribute('transform', `translate(${node.x}, ${node.y})`);
    group.dataset.nodeId = String(node.id);
    group.style.cursor = isArmed ? 'not-allowed' : 'grab';
    group.addEventListener('dblclick', (event) => {
      event.stopPropagation();
      if (window.Actions?.openFlowBuilderEditNode) Actions.openFlowBuilderEditNode(node.id);
    });

    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', 0); rect.setAttribute('y', 0);
    rect.setAttribute('width', this.NODE_WIDTH); rect.setAttribute('height', this.NODE_HEIGHT);
    rect.setAttribute('rx', 14); rect.setAttribute('ry', 14);
    rect.setAttribute('fill', '#0b1325');
    rect.setAttribute('stroke', isArmed ? '#38bdf8' : (isHoveredForSeg ? '#fbbf24' : type.color));
    rect.setAttribute('stroke-width', isHoveredForSeg ? 3.5 : (isEsteira ? (isArmed ? 3 : 2.5) : (isArmed ? 3 : 2)));
    group.appendChild(rect);

    // V39.10.1 — Tint sutil da cor da 1ª segmentação no card de Ação ("nuance")
    if (isAcao) {
      const segKeys = Array.isArray(node.data?.segmentations) ? node.data.segmentations : [];
      if (segKeys.length > 0) {
        const firstSeg = this.segmentationByKey(segKeys[0]);
        if (firstSeg && firstSeg.color) {
          const tint = document.createElementNS(svgNS, 'rect');
          tint.setAttribute('x', 0); tint.setAttribute('y', 0);
          tint.setAttribute('width', this.NODE_WIDTH); tint.setAttribute('height', this.NODE_HEIGHT);
          tint.setAttribute('rx', 14); tint.setAttribute('ry', 14);
          tint.setAttribute('fill', firstSeg.color);
          tint.setAttribute('opacity', '0.07');
          tint.style.pointerEvents = 'none';
          group.appendChild(tint);
        }
      }
    }

    if (isArmed || isHoveredForSeg) {
      const aura = document.createElementNS(svgNS, 'rect');
      aura.setAttribute('x', -4); aura.setAttribute('y', -4);
      aura.setAttribute('width', this.NODE_WIDTH + 8); aura.setAttribute('height', this.NODE_HEIGHT + 8);
      aura.setAttribute('rx', 18); aura.setAttribute('ry', 18);
      aura.setAttribute('fill', 'none');
      aura.setAttribute('stroke', isHoveredForSeg ? '#fbbf24' : '#38bdf8');
      aura.setAttribute('stroke-width', '1.5'); aura.setAttribute('stroke-dasharray', '4 4');
      aura.setAttribute('opacity', '0.7');
      group.appendChild(aura);
    }

    if (linked) {
      const badge = document.createElementNS(svgNS, 'g');
      badge.setAttribute('transform', `translate(${this.NODE_WIDTH - 56}, 6)`);
      const badgeBg = document.createElementNS(svgNS, 'rect');
      badgeBg.setAttribute('x', 0); badgeBg.setAttribute('y', 0);
      badgeBg.setAttribute('width', 26); badgeBg.setAttribute('height', 14);
      badgeBg.setAttribute('rx', 7); badgeBg.setAttribute('fill', 'rgba(16,185,129,0.20)');
      badgeBg.setAttribute('stroke', 'rgba(52,211,153,0.55)'); badgeBg.setAttribute('stroke-width', '1');
      badge.appendChild(badgeBg);
      const badgeTxt = document.createElementNS(svgNS, 'text');
      badgeTxt.setAttribute('x', 13); badgeTxt.setAttribute('y', 10);
      badgeTxt.setAttribute('fill', '#6ee7b7'); badgeTxt.setAttribute('font-size', '8'); badgeTxt.setAttribute('font-weight', '900');
      badgeTxt.setAttribute('text-anchor', 'middle');
      badgeTxt.textContent = 'SALVO';
      badge.appendChild(badgeTxt);
      group.appendChild(badge);
    }

    const typeLabel = document.createElementNS(svgNS, 'text');
    typeLabel.setAttribute('x', 16); typeLabel.setAttribute('y', 24);
    typeLabel.setAttribute('fill', type.color); typeLabel.setAttribute('font-size', '10'); typeLabel.setAttribute('font-weight', '900');
    typeLabel.textContent = type.label.toUpperCase();
    group.appendChild(typeLabel);

    const displayName = (node.data?.name || node.name || 'Sem nome').slice(0, 22);
    const nameText = document.createElementNS(svgNS, 'text');
    nameText.setAttribute('x', 16); nameText.setAttribute('y', 48);
    nameText.setAttribute('fill', '#ffffff'); nameText.setAttribute('font-size', '14'); nameText.setAttribute('font-weight', '800');
    nameText.textContent = displayName;
    group.appendChild(nameText);

    // Botão remover (×) — canto superior direito, deslocado pra esquerda se linked
    const trash = document.createElementNS(svgNS, 'g');
    trash.setAttribute('transform', `translate(${linked ? this.NODE_WIDTH - 84 : this.NODE_WIDTH - 26}, 6)`);
    trash.setAttribute('class', 'flow-no-drag');
    trash.style.cursor = 'pointer';
    trash.addEventListener('click', (event) => {
      event.stopPropagation();
      if (window.Actions?.removeFlowBuilderNode) Actions.removeFlowBuilderNode(node.id);
    });
    const trashBg = document.createElementNS(svgNS, 'rect');
    trashBg.setAttribute('x', 0); trashBg.setAttribute('y', 0);
    trashBg.setAttribute('width', 20); trashBg.setAttribute('height', 20);
    trashBg.setAttribute('rx', 6); trashBg.setAttribute('fill', 'rgba(239,68,68,0.15)');
    trashBg.setAttribute('stroke', 'rgba(239,68,68,0.35)'); trashBg.setAttribute('stroke-width', '1');
    trash.appendChild(trashBg);
    const trashIcon = document.createElementNS(svgNS, 'text');
    trashIcon.setAttribute('x', 10); trashIcon.setAttribute('y', 14);
    trashIcon.setAttribute('fill', '#fca5a5'); trashIcon.setAttribute('font-size', '11');
    trashIcon.setAttribute('text-anchor', 'middle');
    trashIcon.textContent = '×';
    trash.appendChild(trashIcon);
    group.appendChild(trash);

    const outgoing = edges.filter(e => e.fromId === node.id).length;
    const stats = document.createElementNS(svgNS, 'text');
    stats.setAttribute('x', 16); stats.setAttribute('y', 66);
    stats.setAttribute('fill', '#94a3b8'); stats.setAttribute('font-size', '10');
    stats.textContent = isExecucao ? 'fim de fluxo' : (outgoing > 0 ? `${outgoing} ${outgoing === 1 ? 'saída' : 'saídas'}` : 'sem saídas');
    group.appendChild(stats);

    // V39.10.0 — Badges de segmentação só na Ação (máx 2)
    if (isAcao) {
      const segKeys = Array.isArray(node.data?.segmentations) ? node.data.segmentations.slice(0, 2) : [];
      segKeys.forEach((segKey, i) => {
        const seg = this.segmentationByKey(segKey);
        if (!seg) return;
        const badgeG = document.createElementNS(svgNS, 'g');
        badgeG.setAttribute('transform', `translate(${16 + i * 86}, 80)`);
        badgeG.setAttribute('class', 'flow-no-drag flow-badge');
        badgeG.dataset.nodeId = String(node.id);
        badgeG.dataset.segKey = String(segKey);
        badgeG.style.cursor = 'grab';
        const bRect = document.createElementNS(svgNS, 'rect');
        bRect.setAttribute('x', 0); bRect.setAttribute('y', 0);
        bRect.setAttribute('width', 80); bRect.setAttribute('height', 18);
        bRect.setAttribute('rx', 9);
        bRect.setAttribute('fill', `${seg.color}22`);
        bRect.setAttribute('stroke', `${seg.color}88`);
        bRect.setAttribute('stroke-width', 1);
        badgeG.appendChild(bRect);
        const dot = document.createElementNS(svgNS, 'circle');
        dot.setAttribute('cx', 9); dot.setAttribute('cy', 9); dot.setAttribute('r', 4);
        dot.setAttribute('fill', seg.color);
        badgeG.appendChild(dot);
        const bTxt = document.createElementNS(svgNS, 'text');
        bTxt.setAttribute('x', 18); bTxt.setAttribute('y', 12.5);
        bTxt.setAttribute('fill', seg.color); bTxt.setAttribute('font-size', '9'); bTxt.setAttribute('font-weight', '900');
        bTxt.textContent = (seg.name || '').slice(0, 10);
        badgeG.appendChild(bTxt);
        parent.appendChild(badgeG);
      });
    }

    // Portas (respeitando hierarquia)
    if (!isProduto) {
      const inputPort = document.createElementNS(svgNS, 'circle');
      inputPort.setAttribute('cx', 0); inputPort.setAttribute('cy', this.NODE_HEIGHT / 2);
      inputPort.setAttribute('r', otherArmed ? 12 : 7);
      inputPort.setAttribute('fill', otherArmed ? '#34d399' : '#10b981');
      inputPort.setAttribute('stroke', '#0b1325'); inputPort.setAttribute('stroke-width', 2);
      inputPort.setAttribute('class', 'flow-port-input');
      inputPort.dataset.nodeId = String(node.id);
      inputPort.style.cursor = 'crosshair';
      group.appendChild(inputPort);
    }

    if (!isExecucao) {
      const outputPort = document.createElementNS(svgNS, 'circle');
      outputPort.setAttribute('cx', this.NODE_WIDTH); outputPort.setAttribute('cy', this.NODE_HEIGHT / 2);
      outputPort.setAttribute('r', isArmed ? 11 : 7);
      outputPort.setAttribute('fill', isArmed ? '#38bdf8' : '#10b981');
      outputPort.setAttribute('stroke', '#0b1325'); outputPort.setAttribute('stroke-width', 2);
      outputPort.setAttribute('class', 'flow-port-output');
      outputPort.dataset.nodeId = String(node.id);
      outputPort.style.cursor = 'crosshair';
      group.appendChild(outputPort);
    }

    if (!isExecucao) this._renderConnButton(svgNS, group, node, isArmed, outgoing);
    parent.appendChild(group);
  },

  _renderConnButton(svgNS, group, node, isArmed, outgoing) {
    let fill, stroke, textFill, label;
    if (isArmed) { fill = 'rgba(56,189,248,0.30)'; stroke = '#38bdf8'; textFill = '#e0f2fe'; label = 'Conectando...'; }
    else if (outgoing > 0) { fill = 'rgba(16,185,129,0.20)'; stroke = '#34d399'; textFill = '#a7f3d0'; label = `Conectada (${outgoing})`; }
    else { fill = 'rgba(255,255,255,0.06)'; stroke = '#475569'; textFill = '#cbd5e1'; label = 'Conexão'; }
    const btnY = this.NODE_HEIGHT - 28;
    const btnH = 22, btnX = 12, btnW = this.NODE_WIDTH - 24;
    const btn = document.createElementNS(svgNS, 'g');
    btn.setAttribute('transform', `translate(${btnX}, ${btnY})`);
    btn.setAttribute('class', 'flow-no-drag flow-conn-btn');
    btn.dataset.nodeId = String(node.id);
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (window.Actions?.armFlowBuilderConnection) Actions.armFlowBuilderConnection(node.id);
    });
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', 0); rect.setAttribute('y', 0);
    rect.setAttribute('width', btnW); rect.setAttribute('height', btnH);
    rect.setAttribute('rx', 6); rect.setAttribute('ry', 6);
    rect.setAttribute('fill', fill); rect.setAttribute('stroke', stroke); rect.setAttribute('stroke-width', '1');
    btn.appendChild(rect);
    btn.addEventListener('mouseenter', () => { rect.setAttribute('fill', isArmed ? 'rgba(56,189,248,0.45)' : (outgoing > 0 ? 'rgba(16,185,129,0.32)' : 'rgba(255,255,255,0.14)')); });
    btn.addEventListener('mouseleave', () => { rect.setAttribute('fill', fill); });
    const dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('cx', 14); dot.setAttribute('cy', btnH / 2); dot.setAttribute('r', 3.2);
    dot.setAttribute('fill', isArmed ? '#7dd3fc' : (outgoing > 0 ? '#6ee7b7' : '#94a3b8'));
    btn.appendChild(dot);
    const txt = document.createElementNS(svgNS, 'text');
    txt.setAttribute('x', btnW / 2 + 6); txt.setAttribute('y', btnH / 2 + 3.5);
    txt.setAttribute('fill', textFill); txt.setAttribute('font-size', '10.5'); txt.setAttribute('font-weight', '900');
    txt.setAttribute('text-anchor', 'middle');
    txt.textContent = label;
    btn.appendChild(txt);
    group.appendChild(btn);
  },

  _renderGhost(svgNS, parent, ghost) {
    const seg = this.segmentationByKey(ghost.segKey);
    if (!seg) return;
    const group = document.createElementNS(svgNS, 'g');
    group.setAttribute('transform', `translate(${ghost.x}, ${ghost.y})`);
    group.setAttribute('class', 'flow-ghost flow-no-drag');
    group.dataset.ghostId = String(ghost.id);
    group.style.cursor = 'grab';
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', 0); rect.setAttribute('y', 0);
    rect.setAttribute('width', this.GHOST_WIDTH); rect.setAttribute('height', this.GHOST_HEIGHT);
    rect.setAttribute('rx', 12);
    rect.setAttribute('fill', `${seg.color}33`);
    rect.setAttribute('stroke', seg.color);
    rect.setAttribute('stroke-width', 1.5);
    rect.setAttribute('stroke-dasharray', '5 3');
    rect.setAttribute('opacity', '0.85');
    group.appendChild(rect);
    const dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('cx', 14); dot.setAttribute('cy', this.GHOST_HEIGHT / 2); dot.setAttribute('r', 5);
    dot.setAttribute('fill', seg.color);
    group.appendChild(dot);
    const txt = document.createElementNS(svgNS, 'text');
    txt.setAttribute('x', 24); txt.setAttribute('y', this.GHOST_HEIGHT / 2 + 4);
    txt.setAttribute('fill', '#ffffff'); txt.setAttribute('font-size', '11'); txt.setAttribute('font-weight', '900');
    txt.textContent = (seg.name || '').slice(0, 12);
    group.appendChild(txt);
    const hint = document.createElementNS(svgNS, 'text');
    hint.setAttribute('x', this.GHOST_WIDTH / 2); hint.setAttribute('y', this.GHOST_HEIGHT + 12);
    hint.setAttribute('fill', '#fbbf24'); hint.setAttribute('font-size', '8'); hint.setAttribute('font-weight', '700');
    hint.setAttribute('text-anchor', 'middle');
    hint.textContent = 'arraste pra uma Ação';
    group.appendChild(hint);
    parent.appendChild(group);
  },

  _attachSvgListeners(svg) {
    const self = this;
    svg.addEventListener('mousedown', (event) => self._onMouseDown(event, svg));
    svg.addEventListener('mousemove', (event) => self._onMouseMove(event, svg));
    svg.addEventListener('mouseup', (event) => self._onMouseUp(event, svg));
    svg.addEventListener('mouseleave', () => {
      self._internal.dragNode = null;
      self._internal.pendingConnection = null;
      self._internal.panning = null;
      self._internal.dragGhost = null;
      self._internal.hoveredActionId = null;
      self._hideTrash();
      svg.style.cursor = 'grab';
      const overlay = svg.querySelector('#flowPendingEdge');
      if (overlay) overlay.remove();
    });
  },

  _screenToSvg(svg, event) {
    const pt = svg.createSVGPoint();
    pt.x = event.clientX; pt.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const transformed = pt.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  },

  _screenToWorld(svg, event) {
    const sp = this._screenToSvg(svg, event);
    const zoom = Number(App.state.flowBuilderZoom || 1.0) || 1.0;
    const panX = Number(App.state.flowBuilderPanX || 0);
    const panY = Number(App.state.flowBuilderPanY || 0);
    return { x: (sp.x - panX) / zoom, y: (sp.y - panY) / zoom };
  },

  _findActionAtWorld(wx, wy) {
    return (App.state.flowBuilderNodes || []).find(n =>
      n.type === 'acao' &&
      wx >= n.x && wx <= n.x + this.NODE_WIDTH &&
      wy >= n.y && wy <= n.y + this.NODE_HEIGHT
    );
  },

  _isOverTrash(clientX, clientY) {
    const trash = document.getElementById('flowBuilderTrashBin');
    if (!trash || trash.style.display === 'none') return false;
    const rect = trash.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  },

  _showTrash() {
    const trash = document.getElementById('flowBuilderTrashBin');
    if (trash) trash.style.display = 'flex';
  },
  _hideTrash() {
    const trash = document.getElementById('flowBuilderTrashBin');
    if (trash) trash.style.display = 'none';
  },

  // V39.10.1 — Anima ghost shrinking + sliding pra dentro do card de Ação antes
  // do badge final aparecer. ease-out cubic, scale center-pivot, ~280ms.
  _animateGhostToAction(ghostGroup, fromX, fromY, toX, toY, onComplete) {
    if (!ghostGroup) { if (onComplete) onComplete(); return; }
    const duration = 280;
    const start = Date.now();
    const W = this.GHOST_WIDTH, H = this.GHOST_HEIGHT;
    const tick = () => {
      const now = Date.now();
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const x = fromX + (toX - fromX) * eased;
      const y = fromY + (toY - fromY) * eased;
      const scale = 1 - 0.7 * eased;
      const opacity = 1 - eased;
      const cx = x + W / 2, cy = y + H / 2;
      ghostGroup.setAttribute('transform', `translate(${cx}, ${cy}) scale(${scale}) translate(${-W / 2}, ${-H / 2})`);
      ghostGroup.style.opacity = String(opacity);
      if (t < 1) requestAnimationFrame(tick);
      else if (onComplete) onComplete();
    };
    requestAnimationFrame(tick);
  },

  _onMouseDown(event, svg) {
    const target = event.target;
    if (target.closest && target.closest('.flow-no-drag')) {
      // Badge: inicia drag (vira fantasma)
      const badge = target.closest('.flow-badge');
      if (badge) {
        const sourceNodeId = badge.dataset.nodeId;
        const segKey = badge.dataset.segKey;
        const wp = this._screenToWorld(svg, event);
        // Remove badge da Ação, cria fantasma na world coord do mouse
        const ghostId = ActionFlowBuilder.genGhostId();
        const node = (App.state.flowBuilderNodes || []).find(n => String(n.id) === String(sourceNodeId));
        if (node) {
          node.data = node.data || {};
          node.data.segmentations = (node.data.segmentations || []).filter(k => k !== segKey);
        }
        App.state.flowBuilderGhostSegmentations = [
          ...(App.state.flowBuilderGhostSegmentations || []),
          { id: ghostId, segKey, x: wp.x - this.GHOST_WIDTH / 2, y: wp.y - this.GHOST_HEIGHT / 2 }
        ];
        this._internal.dragGhost = { ghostId, offsetX: this.GHOST_WIDTH / 2, offsetY: this.GHOST_HEIGHT / 2 };
        this._showTrash();
        App.save();
        setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
        event.preventDefault();
        return;
      }
      // Fantasma: inicia drag direto
      const ghost = target.closest('.flow-ghost');
      if (ghost) {
        const ghostId = ghost.dataset.ghostId;
        const ghostObj = (App.state.flowBuilderGhostSegmentations || []).find(g => String(g.id) === String(ghostId));
        if (!ghostObj) return;
        const wp = this._screenToWorld(svg, event);
        this._internal.dragGhost = { ghostId, offsetX: wp.x - ghostObj.x, offsetY: wp.y - ghostObj.y };
        this._showTrash();
        event.preventDefault();
        return;
      }
      return;
    }
    const armedId = App.state.flowBuilderConnectionArm;
    if (target.classList?.contains('flow-port-output')) {
      const outId = target.dataset.nodeId;
      if (armedId && String(armedId) === String(outId)) {
        this._internal.pendingConnection = { fromId: outId };
        event.preventDefault();
        return;
      }
      if (!armedId) {
        Utils.toast('Arme a conexão clicando em "Conexão" no bloco primeiro.');
        return;
      }
      Utils.toast('Outro bloco está armado. Use a porta de saída dele ou clique de novo em "Conexão" pra desarmar.');
      return;
    }
    const group = target.closest('g[data-node-id]');
    if (group) {
      const nodeId = group.dataset.nodeId;
      if (armedId && String(armedId) === String(nodeId)) return;
      const node = (App.state.flowBuilderNodes || []).find(n => String(n.id) === String(nodeId));
      if (!node) return;
      const wp = this._screenToWorld(svg, event);
      this._internal.dragNode = {
        nodeId,
        offsetX: wp.x - node.x,
        offsetY: wp.y - node.y
      };
      group.style.cursor = 'grabbing';
      return;
    }
    // Área vazia: inicia pan
    const sp = this._screenToSvg(svg, event);
    this._internal.panning = {
      startX: sp.x,
      startY: sp.y,
      initialPanX: Number(App.state.flowBuilderPanX || 0),
      initialPanY: Number(App.state.flowBuilderPanY || 0)
    };
    svg.style.cursor = 'grabbing';
    event.preventDefault();
  },

  _onMouseMove(event, svg) {
    // dragGhost: mover fantasma + detectar hover em Ação + lixeira
    if (this._internal.dragGhost) {
      const ghostId = this._internal.dragGhost.ghostId;
      const wp = this._screenToWorld(svg, event);
      const newX = wp.x - this._internal.dragGhost.offsetX;
      const newY = wp.y - this._internal.dragGhost.offsetY;
      const ghost = (App.state.flowBuilderGhostSegmentations || []).find(g => String(g.id) === String(ghostId));
      if (ghost) { ghost.x = Math.round(newX); ghost.y = Math.round(newY); }
      // Atualiza visual direto
      const node = svg.querySelector(`g.flow-ghost[data-ghost-id="${ghostId}"]`);
      if (node) node.setAttribute('transform', `translate(${Math.round(newX)}, ${Math.round(newY)})`);
      // Highlight de Ação sob ponteiro
      const acao = this._findActionAtWorld(wp.x, wp.y);
      const prevHover = this._internal.hoveredActionId;
      this._internal.hoveredActionId = acao ? acao.id : null;
      if (String(prevHover || '') !== String(this._internal.hoveredActionId || '')) {
        // re-render do canvas pra atualizar highlight (cheap pq só altera 1 node visual)
        setTimeout(() => { try { ActionFlowBuilder._drawCanvas(); } catch (_) {} }, 0);
      }
      return;
    }
    if (this._internal.panning) {
      const sp = this._screenToSvg(svg, event);
      const dx = sp.x - this._internal.panning.startX;
      const dy = sp.y - this._internal.panning.startY;
      const newPanX = this._internal.panning.initialPanX + dx;
      const newPanY = this._internal.panning.initialPanY + dy;
      App.state.flowBuilderPanX = newPanX;
      App.state.flowBuilderPanY = newPanY;
      const zoom = Number(App.state.flowBuilderZoom || 1.0);
      const world = svg.querySelector('#flowWorld');
      if (world) world.setAttribute('transform', `translate(${newPanX}, ${newPanY}) scale(${zoom})`);
      return;
    }
    if (this._internal.pendingConnection) {
      const overlay = svg.querySelector('#flowPendingEdge');
      if (overlay) overlay.remove();
      const fromNode = (App.state.flowBuilderNodes || []).find(n => String(n.id) === String(this._internal.pendingConnection.fromId));
      if (!fromNode) return;
      const fromPort = this._outputPort(fromNode);
      const wp = this._screenToWorld(svg, event);
      const svgNS = 'http://www.w3.org/2000/svg';
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('id', 'flowPendingEdge');
      path.setAttribute('d', this._edgePath(fromPort.x, fromPort.y, wp.x, wp.y));
      path.setAttribute('stroke', '#fbbf24');
      path.setAttribute('stroke-width', '3');
      path.setAttribute('stroke-dasharray', '6 4');
      path.setAttribute('fill', 'none');
      svg.querySelector('#flowEdgesLayer')?.appendChild(path);
      return;
    }
    if (!this._internal.dragNode) return;
    const drag = this._internal.dragNode;
    const wp = this._screenToWorld(svg, event);
    const newX = wp.x - drag.offsetX;
    const newY = wp.y - drag.offsetY;
    const node = (App.state.flowBuilderNodes || []).find(n => String(n.id) === String(drag.nodeId));
    if (node) { node.x = Math.round(newX); node.y = Math.round(newY); }
    const group = svg.querySelector(`g[data-node-id="${drag.nodeId}"]`);
    if (group) group.setAttribute('transform', `translate(${Math.round(newX)}, ${Math.round(newY)})`);
    this._redrawAllEdges(svg);
  },

  _redrawAllEdges(svg) {
    const edgesLayer = svg.querySelector('#flowEdgesLayer');
    if (!edgesLayer) return;
    while (edgesLayer.firstChild) edgesLayer.removeChild(edgesLayer.firstChild);
    const nodes = App.state.flowBuilderNodes || [];
    const edges = App.state.flowBuilderEdges || [];
    const svgNS = 'http://www.w3.org/2000/svg';
    for (const edge of edges) this._renderEdge(svgNS, edgesLayer, edge, nodes);
  },

  _onMouseUp(event, svg) {
    if (this._internal.dragGhost) {
      const ghostId = this._internal.dragGhost.ghostId;
      this._internal.dragGhost = null;
      this._hideTrash();
      // Lixeira tem prioridade
      if (this._isOverTrash(event.clientX, event.clientY)) {
        Actions.removeFlowBuilderGhostSegmentation(ghostId);
        this._internal.hoveredActionId = null;
        return;
      }
      // Ação sob o ponteiro: anima ghost encolhendo pro card, depois aplica badge
      const wp = this._screenToWorld(svg, event);
      const acao = this._findActionAtWorld(wp.x, wp.y);
      if (acao) {
        const ghost = (App.state.flowBuilderGhostSegmentations || []).find(g => String(g.id) === String(ghostId));
        if (ghost) {
          const ghostGroup = svg.querySelector(`g.flow-ghost[data-ghost-id="${ghostId}"]`);
          // Alvo: posição que a badge ocuparia (16, 80) + offset pra "voar" pra dentro
          const targetX = acao.x + 16 - this.GHOST_WIDTH / 2 + 40;
          const targetY = acao.y + 80 - this.GHOST_HEIGHT / 2 + 9;
          this._internal.hoveredActionId = null;
          this._animateGhostToAction(ghostGroup, ghost.x, ghost.y, targetX, targetY, () => {
            const ok = Actions.applyFlowBuilderSegmentationToAction(ghost.segKey, acao.id);
            if (ok) Actions.removeFlowBuilderGhostSegmentation(ghostId);
            else Actions.removeFlowBuilderGhostSegmentation(ghostId); // se falhou (já tem 2), libera ghost mesmo assim
          });
        } else {
          this._internal.hoveredActionId = null;
        }
        return;
      }
      // Else: fantasma fica onde está
      this._internal.hoveredActionId = null;
      App.save();
      setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
      return;
    }
    if (this._internal.panning) {
      this._internal.panning = null;
      svg.style.cursor = 'grab';
      App.save();
      setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
      return;
    }
    if (this._internal.pendingConnection) {
      const target = event.target;
      const overlay = svg.querySelector('#flowPendingEdge');
      if (overlay) overlay.remove();
      const fromId = this._internal.pendingConnection.fromId;
      this._internal.pendingConnection = null;
      if (target.classList?.contains('flow-port-input')) {
        const toId = target.dataset.nodeId;
        Actions.connectFlowBuilderNodes(fromId, toId);
      }
      Actions.cancelFlowBuilderConnection();
      return;
    }
    if (this._internal.dragNode) {
      const group = svg.querySelector(`g[data-node-id="${this._internal.dragNode.nodeId}"]`);
      if (group) group.style.cursor = 'grab';
      this._internal.dragNode = null;
      App.save();
    }
  },

  // ============ DRAG-AND-DROP HTML5 (paleta → canvas) ============
  _onPaletteSegDragStart(event, segKey) {
    if (event.dataTransfer) {
      event.dataTransfer.setData('text/plain', `seg:${segKey}`);
      event.dataTransfer.effectAllowed = 'copy';
    }
  },

  _onCanvasDragOver(event) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  },

  _onCanvasDrop(event) {
    event.preventDefault();
    const data = event.dataTransfer?.getData('text/plain') || '';
    if (!data.startsWith('seg:')) return;
    const segKey = data.slice(4);
    const canvas = document.getElementById('flowBuilderCanvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = event.clientX - rect.left;
    const sy = event.clientY - rect.top;
    const zoom = Number(App.state.flowBuilderZoom || 1.0) || 1.0;
    const panX = Number(App.state.flowBuilderPanX || 0);
    const panY = Number(App.state.flowBuilderPanY || 0);
    const wx = (sx - panX) / zoom;
    const wy = (sy - panY) / zoom;
    const acao = this._findActionAtWorld(wx, wy);
    if (acao) {
      Actions.applyFlowBuilderSegmentationToAction(segKey, acao.id);
    } else {
      Actions.addFlowBuilderGhostSegmentation(segKey, wx - this.GHOST_WIDTH / 2, wy - this.GHOST_HEIGHT / 2);
    }
  }
};
