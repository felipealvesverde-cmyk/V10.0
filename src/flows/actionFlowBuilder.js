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
  // V40.6.0 (Leonardo) — bloco respira mais (escala Fibonacci ≈ 240×150).
  // Nome ganha wrap em 2 linhas. Truncamento cardinal eliminado.
  NODE_WIDTH: 240,
  NODE_HEIGHT: 150,
  GHOST_WIDTH: 130,
  GHOST_HEIGHT: 34,
  VIEWPORT_MARGIN: 200,

  // V40.6.1 (Leonardo) — Paleta semântica oficial do LJ alinhada ao Pulso da
  // Receita: Produto=RevOps roxo, Campanha=Marketing rosa, Ação=DINÂMICA por
  // setor (Marketing/Vendas/CS), Execução=herda cor da ação parent.
  ESTEIRA_TYPES: [
    { id: 'produto',   label: 'Produto',   icon: 'package',   color: '#AB3ED8', hierarchy: 1 },
    { id: 'campanha',  label: 'Campanha',  icon: 'megaphone', color: '#F472B6', hierarchy: 2 },
    { id: 'acao',      label: 'Ação',      icon: 'zap',       color: '#F472B6', hierarchy: 3 },
    { id: 'execucao',  label: 'Execução',  icon: 'play',      color: '#6BBEF9', hierarchy: 4 }
  ],

  // V40.6.1 — Cores semânticas oficiais por setor (Marketing/Vendas/CS).
  // Espelho do que está em var(--lj-X) no CSS.
  SECTOR_COLOR: {
    'Marketing': '#F472B6',
    'Vendas':    '#00CBCC',
    'CS':        '#6BBEF9'
  },

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

  // V39.12.1 — Mapa de pai → filho hierárquico pra atalho CTRL+drag (cria filho conectado).
  CHILD_TYPE: {
    produto: 'campanha',
    campanha: 'acao',
    acao: 'execucao',
    execucao: null
  },

  _internal: {
    container: null,
    dragNode: null,
    pendingConnection: null,
    panning: null,
    dragGhost: null, // { ghostId, offsetX, offsetY }
    hoveredActionId: null,
    // V39.12.1 — Box-select com ALT (precisa ter 1 card selecionado pra ditar o tipo).
    boxSelect: null, // { startX, startY, endX, endY, type }
    _escListenerAttached: false
  },

  typeById(id) {
    return this.ESTEIRA_TYPES.find(t => t.id === id)
      || this.LEGACY_AUX_TYPES.find(t => t.id === id)
      || this.LEGACY_AUX_TYPES[this.LEGACY_AUX_TYPES.length - 1];
  },
  isEsteira(typeId) { return this.ESTEIRA_TYPES.some(t => t.id === typeId); },

  // V40.6.1 (Leonardo) — Cor semântica resolvida por node, não por tipo estático:
  // - Produto: RevOps roxo (estratégico)
  // - Campanha: Marketing rosa (território nativo de campanha)
  // - Ação: cor do setor (Marketing/Vendas/CS) — repinta quando user troca setor no modal
  // - Execução: cor da ação parent (cascata cromática — execução é braço operacional da ação)
  // Quando não encontra parent ou setor desconhecido, cai no default do tipo.
  nodeColor(node, nodesPool) {
    if (!node) return '#94a3b8';
    if (node.type === 'produto')  return '#AB3ED8';
    if (node.type === 'campanha') return '#F472B6';
    if (node.type === 'acao') {
      const sector = String(node.data?.sector || 'Marketing');
      return this.SECTOR_COLOR[sector] || '#F472B6';
    }
    if (node.type === 'execucao') {
      const pool = nodesPool || App.state.flowBuilderNodes || [];
      const edges = App.state.flowBuilderEdges || [];
      const incoming = edges.find(e => String(e.toId) === String(node.id));
      if (incoming) {
        const parent = pool.find(n => String(n.id) === String(incoming.fromId));
        if (parent && parent.type === 'acao') {
          const sector = String(parent.data?.sector || 'Marketing');
          return this.SECTOR_COLOR[sector] || '#F472B6';
        }
      }
      return '#6BBEF9';
    }
    const t = this.typeById(node.type);
    return t?.color || '#94a3b8';
  },

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
      // V39.12.0 — Produto agora carrega audienceDraft (ICP) em rascunho;
      // vira product.audience apenas quando "Salvar esteira" rodar.
      case 'produto':  return { name: '', revenueModel: 'Venda única', type: '', price: '', operationalCost: '', audienceDraft: null };
      case 'campanha': return { name: '' };
      // V39.12.0 — Ação ganha form completo: setor/funil de origem, canal, tipo,
      // destino (calcula fluxo via FlowResolutionEngine), objetivo, segmentações.
      case 'acao':     return { name: '', sector: 'Marketing', funnel: 'MOF', channel: 'Instagram Orgânico', actionType: 'Post', destinationSector: 'Marketing', destinationFunnel: 'MOF', objective: '', segmentations: [] };
      case 'execucao': return { name: '' };
      default:         return { name: '' };
    }
  },

  render() {
    if (!App.state.showFlowBuilderModal) return '';
    const zoom = Number(App.state.flowBuilderZoom || 1.0);
    // V39.12.2 — user-select: none global no modal evita que arrastar o mouse
    // selecione texto no header/popup. Inputs/textarea/select recebem override.
    return `<div class="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-sm p-4 overflow-auto grid place-items-start justify-items-center" style="user-select:none;-webkit-user-select:none;-moz-user-select:none;">
      <style>.flow-builder-modal-root { user-select: none; -webkit-user-select: none; -moz-user-select: none; } .flow-builder-modal-root input, .flow-builder-modal-root textarea, .flow-builder-modal-root select { user-select: text !important; -webkit-user-select: text !important; }</style>
      <div class="flow-builder-modal-root rounded-[2rem] overflow-hidden shadow-2xl text-white" style="width:90vw;max-width:none;background:#071326;">
        ${this._header()}
        ${App.state.flowBuilderShowHelp ? this._helpPanel() : ''}
        <div class="p-6">
          <div class="relative min-w-0">
            ${this._zoomControls(zoom)}
            <div id="flowBuilderCanvas" class="relative rounded-3xl border border-white/10 bg-white/[0.04] h-[78vh] overflow-hidden min-w-0"
                 ondragover="ActionFlowBuilder._onCanvasDragOver(event)"
                 ondrop="ActionFlowBuilder._onCanvasDrop(event)">
              ${this._prototypeModeBanner()}
              ${this._emptyCanvasHint()}
              ${this._trashBin()}
            </div>
            ${this._bottomPanelOverlay()}
          </div>
        </div>
        ${this._disconnectModal()}
        ${this._editNodeModal()}
        ${this._clearConfirmModal()}
        ${this._loadCampaignModal()}
        ${this._customSegmentationModal()}
        ${this._draftsModal()}
      </div>
    </div>`;
  },

  _header() {
    const nodes = App.state.flowBuilderNodes || [];
    const edges = App.state.flowBuilderEdges || [];
    const esteiraCount = nodes.filter(n => this.isEsteira(n.type)).length;
    const novos = nodes.filter(n => this.isEsteira(n.type) && !n.linkedRealId).length;
    const selCount = (App.state.flowBuilderSelectedNodeIds || []).length;
    // V40.6.0 (Leonardo) — Hierarquia tipográfica: pendentes em pill âmbar
    // separada (estado de risco — perda de trabalho), métricas estruturais em
    // cluster cinza neutro, seleção em tag cobalto à direita.
    const pendingPill = novos > 0
      ? `<span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-200 text-[10px] font-black"><span class="w-1.5 h-1.5 rounded-full bg-amber-400"></span>${novos} pendente${novos === 1 ? '' : 's'}</span>`
      : '';
    const selTag = selCount > 0
      ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-400/30 text-indigo-200 text-[10px] font-black">${selCount} selecionado${selCount === 1 ? '' : 's'}</span>`
      : '';
    const structural = `<span class="text-xs text-slate-400">${nodes.length} ${nodes.length === 1 ? 'bloco' : 'blocos'} · ${edges.length} ${edges.length === 1 ? 'conexão' : 'conexões'} · ${esteiraCount} da esteira</span>`;
    return `<header onclick="if(App.state.flowBuilderPaletteOpen){App.state.flowBuilderPaletteOpen=false;App.save();App.render();}" class="p-6 border-b border-white/10 flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-2"><i data-lucide="git-merge" class="w-4 h-4 text-indigo-300"></i><p class="text-xs font-black text-slate-300 uppercase tracking-wider">Flow Builder · Esteira do LJ</p></div>
        <h2 class="text-2xl font-black">Desenhe Produto → Campanha → Ação → Execução</h2>
        <div class="mt-2 flex items-center flex-wrap gap-2">${pendingPill}${structural}${selTag}</div>
      </div>
      <div class="flex items-center gap-2 flex-wrap justify-end">
        ${(() => {
          // V40.6.0 (Leonardo) — Hierarquia única: Salvar = primário verde,
          // demais = ghost neutro. Limpar inerte com hover vermelho (destruição
          // pede fricção, não convite). Fechar isolado por gap de 24px.
          const draftsCount = (App.state.flowBuilderDrafts || []).length;
          const ghostCls = 'h-9 px-3 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.10] text-slate-200 text-xs font-black flex items-center gap-1.5 transition';
          return `
        <button onclick="Actions.openFlowBuilderDraftsModal()" title="Salvar rascunho atual ou abrir um rascunho salvo" class="${ghostCls}"><i data-lucide="bookmark" class="w-3.5 h-3.5"></i> Rascunhos${draftsCount ? ` <span class="ml-1 px-1.5 py-0.5 rounded-full bg-white/10 text-[10px]">${draftsCount}</span>` : ''}</button>
        <button onclick="Actions.openFlowBuilderLoadCampaign()" title="Carregar campanha existente pra editar" class="${ghostCls}"><i data-lucide="folder-open" class="w-3.5 h-3.5"></i> Carregar campanha</button>
        <button onclick="Actions.saveFlowBuilder()" title="Salva os blocos da esteira como Produto/Campanha/Ação/Execução reais" class="h-9 px-4 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"><i data-lucide="save" class="w-3.5 h-3.5"></i> Salvar esteira</button>
        <button onclick="Actions.toggleFlowBuilderHelp()" title="Como funciona" class="${ghostCls}"><i data-lucide="help-circle" class="w-3.5 h-3.5"></i> Ajuda</button>
        <button onclick="Actions.requestFlowBuilderClear()" title="Apagar tudo do canvas" class="h-9 px-3 rounded-lg border border-white/15 bg-transparent hover:bg-red-500/20 hover:border-red-400/40 hover:text-red-100 text-slate-400 text-xs font-black flex items-center gap-1.5 transition"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Limpar</button>
        <div class="w-6"></div>
        <button onclick="Actions.closeFlowBuilder()" title="Fechar" class="h-9 w-9 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.10] text-slate-300 flex items-center justify-center transition"><i data-lucide="x" class="w-4 h-4"></i></button>`;
        })()}
      </div>
    </header>`;
  },

  _helpPanel() {
    return `<div class="mx-6 mt-4 rounded-2xl bg-indigo-500/15 border border-indigo-400/30 p-4 text-sm text-indigo-100">
      <div class="flex items-start justify-between gap-3 mb-2"><p class="font-black">Como funciona o Flow Builder</p><button onclick="Actions.toggleFlowBuilderHelp()" class="text-indigo-200 text-xs font-black">×</button></div>
      <ul class="space-y-1 text-xs">
        <li>• <b>Esteira:</b> Produto · Campanha · Ação · Execução. Quando salvar, viram entidades reais nas abas do LJ.</li>
        <li>• <b>Adicionar bloco:</b> clique no botão <b>Esteira</b> da pílula embaixo do canvas e escolha o tipo. Esteira abre modal pedindo nome + campos.</li>
        <li>• <b>Hierarquia rígida de conexão:</b> Produto → Campanha · Campanha → Ação · Ação → Execução. Tentar conectar fora dessa cadeia é bloqueado.</li>
        <li>• <b>Pan do canvas:</b> segure o mouse num espaço vazio e arraste. Botão central da régua de zoom volta pra origem.</li>
        <li>• <b>Editar bloco:</b> duplo clique no bloco abre modal com os campos do tipo.</li>
        <li>• <b>Segmentação:</b> botão "Segmentação" na pílula. Arraste uma seg pro canvas (vira fantasma) ou direto pra uma Ação (vira badge). Máx 2 badges por Ação.</li>
        <li>• <b>Remover segmentação:</b> duplo clique no card de Ação abre o modal — lá tem a lista de badges com botão pra remover. Fantasmas soltos podem ir pra lixeira vermelha arrastando.</li>
        <li>• <b>Rascunhos:</b> botão âmbar no header. Salva snapshot do canvas pra continuar depois sem subir nas abas reais. Abrir um rascunho substitui o canvas.</li>
        <li>• <b>Atalhos:</b> <kbd>CTRL+arrastar</kbd> em card pai cria filho da hierarquia conectado. <kbd>CTRL+SHIFT+arrastar</kbd> duplica o card (menos Produto). <kbd>Click</kbd> seleciona (shift estende; duplo-clique abre edição). <kbd>ALT+arrastar</kbd> com seleção desenha retângulo que pega só do mesmo tipo. Vários selecionados + Conexão = conecta todos. <kbd>Delete</kbd> apaga selecionados (sem confirm nos primeiros 10s de vida do card). <kbd>ESC</kbd> fecha pílula.</li>
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
        <p class="text-sm text-slate-300">Canvas vazio. Clique no botão <b>Esteira</b> na pílula embaixo pra começar a desenhar, ou em <b>Carregar campanha</b> no header pra continuar uma existente.</p>
      </div>
    </div>`;
  },

  // V40.6.1 (Leonardo) — Aviso global "MODO PROTÓTIPO" no canto superior
  // esquerdo do canvas. Aparece SÓ quando há pelo menos 1 bloco em estado
  // protótipo (não-salvo, válido pra salvar). A maioria dos blocos no canvas
  // é protótipo — repetir o badge em cada um era ruído. Aviso único no canto
  // comunica o modo de trabalho atual com peso visual leve.
  _prototypeModeBanner() {
    const nodes = App.state.flowBuilderNodes || [];
    const hasPrototype = nodes.some(n => this.isEsteira(n.type) && !n.linkedRealId);
    if (!hasPrototype) return '';
    return `<div class="absolute left-4 top-4 z-10 pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/15 backdrop-blur border border-amber-400/35 text-amber-200 text-[10px] font-black uppercase tracking-wider shadow">
      <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
      Modo protótipo
    </div>`;
  },

  _zoomControls(zoom) {
    // V40.6.0 (Leonardo) — cluster pill no canto inferior direito (irmão do
    // pill central de navegação). Mesma linguagem visual: full pill +
    // backdrop-blur + raio 999. Respiro 24px do canto (escala Fibonacci).
    return `<div class="absolute right-6 bottom-6 z-30 flex items-center gap-1 rounded-full bg-slate-950/70 backdrop-blur border border-white/15 p-1 shadow-2xl">
      <button onclick="Actions.setFlowBuilderZoom(-0.1)" title="Diminuir zoom" class="w-9 h-9 rounded-full hover:bg-white/10 text-white grid place-items-center transition"><i data-lucide="minus" class="w-3.5 h-3.5"></i></button>
      <button onclick="Actions.resetFlowBuilderZoom()" title="Resetar zoom e voltar pra origem" class="px-3 h-9 rounded-full hover:bg-white/10 text-white text-[11px] font-black transition">${Math.round(zoom * 100)}%</button>
      <button onclick="Actions.setFlowBuilderZoom(0.1)" title="Aumentar zoom" class="w-9 h-9 rounded-full hover:bg-white/10 text-white grid place-items-center transition"><i data-lucide="plus" class="w-3.5 h-3.5"></i></button>
    </div>`;
  },

  _trashBin() {
    // V40.6.0 — bottom-left pra não colidir com o cluster de zoom (bottom-6 right-6).
    return `<div id="flowBuilderTrashBin" style="display:none;" class="absolute bottom-6 left-6 z-40 w-24 h-24 rounded-3xl bg-red-500/40 border-2 border-red-400/80 flex-col items-center justify-center text-red-100 pointer-events-none animate-pulse shadow-2xl">
      <i data-lucide="trash-2" class="w-9 h-9"></i>
      <span class="text-[10px] font-black uppercase tracking-wider mt-1">Apagar</span>
    </div>`;
  },

  // V39.11.0 — Painel inferior agora é overlay flutuante sobre o canvas.
  // Pílula compacta na base com 3 botões (Esteira · Segmentação · Mapa).
  // Botão ativo "salta" da pílula com bg branco; ao clicar abre o conteúdo
  // ACIMA da pílula como popup. Canvas não perde tamanho.
  _bottomPanelOverlay() {
    const tab = App.state.flowBuilderPaletteTab || 'esteira';
    const isOpen = !!App.state.flowBuilderPaletteOpen;
    let content = '';
    if (isOpen) {
      if (tab === 'esteira') content = this._esteiraPanel();
      else if (tab === 'segmentacao') content = this._segmentacaoPanel();
      else if (tab === 'mapaReceita') content = this._mapaReceitaPanel();
    }
    // V40.6.0 (Leonardo) — respiro 24px (Fibonacci) abaixo, espelho do zoom à direita.
    return `<div class="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-3 pointer-events-none">
      ${isOpen ? `<div onclick="event.stopPropagation()" class="bg-slate-900/95 backdrop-blur border border-white/15 rounded-3xl p-4 w-[720px] max-w-[90vw] shadow-2xl pointer-events-auto">${content}</div>` : ''}
      ${this._bottomPill(tab, isOpen)}
    </div>`;
  },

  // V39.12.0 — Pílula horizontal ~80% maior (px-14 + gap-7 = mais respiro entre
  // botões); ativo 92px x 92px cabe "Segmentação" sem cortar com leading-tight.
  // Ícone/texto pretos via style inline (garante Lucide herde via currentColor).
  _bottomPill(activeTab, isOpen) {
    const tabs = [
      { id: 'esteira',     label: 'Esteira',     icon: 'layers' },
      { id: 'segmentacao', label: 'Segmentação', icon: 'tag' },
      { id: 'mapaReceita', label: 'Mapa',        icon: 'map' }
    ];
    return `<div class="relative pt-12 pointer-events-auto">
      <div class="bg-slate-950/85 backdrop-blur border border-white/20 rounded-full px-14 py-3 flex items-center gap-7 shadow-2xl">
        ${tabs.map(t => {
          const active = activeTab === t.id && isOpen;
          if (active) {
            return `<button onclick="Actions.setFlowBuilderPaletteTab('${t.id}')" title="${Utils.escape(t.label)} — clique pra fechar" class="w-[92px] h-[92px] rounded-full bg-white shadow-xl flex flex-col items-center justify-center -translate-y-5 hover:bg-slate-100 transition" style="color:#0f172a;">
              <i data-lucide="${t.icon}" class="w-5 h-5" style="color:#0f172a;"></i>
              <span class="text-[10px] font-black mt-1 px-1 leading-tight text-center" style="color:#0f172a;">${Utils.escape(t.label)}</span>
            </button>`;
          }
          return `<button onclick="Actions.setFlowBuilderPaletteTab('${t.id}')" title="${Utils.escape(t.label)}" class="w-[70px] h-[70px] rounded-full bg-transparent text-white flex flex-col items-center justify-center hover:bg-white/10 transition">
            <i data-lucide="${t.icon}" class="w-5 h-5"></i>
            <span class="text-[10px] font-black mt-1 px-0.5 leading-tight text-center">${Utils.escape(t.label)}</span>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  },

  // V39.13.0 — Mapa da Receita no Builder: lê produto da esteira, calcula selo
  // via StrategicMapEngine.getMapSeal, mostra breakdown dos 5 mínimos + fortalecimentos.
  // Rascunho usa chave proto_<nodeId> em strategicMaps (mesma engine, sem patch).
  // Form inline de Resolver pros checks 1-3 (rascunho), botão Abrir Mapa real
  // pros checks 4-5 (precisa publicar) e pra produto já salvo.
  _mapaReceitaPanel() {
    const produtoNode = (App.state.flowBuilderNodes || []).find(n => n.type === 'produto');
    if (!produtoNode) {
      return `<div class="text-center py-10">
        <i data-lucide="map" class="w-12 h-12 text-slate-500 mx-auto mb-3"></i>
        <p class="text-sm font-black text-slate-300">Mapa da Receita</p>
        <p class="text-xs text-slate-500 mt-1">Adicione um Produto no canvas pra começar.</p>
      </div>`;
    }
    if (!window.StrategicMapEngine?.getMapSeal) {
      return `<div class="text-center py-10 text-xs text-amber-300">Engine não disponível.</div>`;
    }
    const isProto = !produtoNode.linkedRealId;
    const productKey = isProto ? `proto_${produtoNode.id}` : Number(produtoNode.linkedRealId);
    const productName = String(produtoNode.data?.name || produtoNode.name || 'sem nome').trim() || 'Produto';
    const seal = StrategicMapEngine.getMapSeal(productKey);

    const sealColors = {
      'inactive':    { bg: 'rgba(100,116,139,0.18)', border: 'rgba(148,163,184,0.45)', text: '#cbd5e1', dot: '#94a3b8' },
      'incomplete':  { bg: 'rgba(239,68,68,0.18)',   border: 'rgba(248,113,113,0.55)', text: '#fca5a5', dot: '#ef4444' },
      'in-progress': { bg: 'rgba(16,185,129,0.18)',  border: 'rgba(52,211,153,0.55)',  text: '#6ee7b7', dot: '#10b981' }
    };
    const sc = sealColors[seal.state];

    const protoBadge = isProto ? `<span class="text-[10px] font-black text-amber-300 bg-amber-500/15 border border-amber-400/30 rounded-full px-2 py-0.5">RASCUNHO</span>` : '';
    const resolveView = App.state.flowBuilderMapResolveView || null;

    // Header do popup
    const head = `<div class="flex items-start justify-between gap-3 mb-3">
      <div class="min-w-0 flex-1">
        <p class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Mapa da Receita</p>
        <h3 class="text-lg font-black text-white mt-0.5 truncate flex items-center gap-2">${Utils.escape(productName)} ${protoBadge}</h3>
      </div>
      <div class="text-right shrink-0">
        <div class="inline-flex items-center gap-2 rounded-full px-3 py-2 border" style="background:${sc.bg};border-color:${sc.border};">
          <span class="inline-block w-2.5 h-2.5 rounded-full" style="background:${sc.dot};"></span>
          <span class="text-xs font-black" style="color:${sc.text};">${Utils.escape(seal.label)}</span>
        </div>
        <p class="text-[10px] text-slate-400 mt-1">${seal.mins} de ${seal.total} mínimos · ${seal.fortifs} fortalecimentos</p>
      </div>
    </div>`;

    // Se está numa view de resolver inline, renderiza o form
    if (resolveView && isProto) {
      return head + this._mapaResolveInline(produtoNode, productKey, resolveView);
    }

    // Breakdown
    const items = seal.checks.map(c => {
      const icon = c.ok ? '✓' : (c.protoBlocked ? '—' : '✗');
      const iconColor = c.ok ? '#34d399' : (c.protoBlocked ? '#94a3b8' : '#f87171');
      const iconBg = c.ok ? 'rgba(16,185,129,0.18)' : (c.protoBlocked ? 'rgba(100,116,139,0.18)' : 'rgba(239,68,68,0.18)');
      let resolveBtn = '';
      if (!c.ok) {
        if (c.protoBlocked) {
          resolveBtn = `<span class="text-[10px] text-slate-400 italic">Salve a esteira pra liberar</span>`;
        } else if (isProto) {
          // Pra rascunho, ✗ vision/owner/krs → form inline
          if (c.id === 'vision') resolveBtn = `<button onclick="Actions.setFlowBuilderMapResolveView('vision')" class="text-[10px] font-black text-indigo-300 hover:text-indigo-100">Resolver →</button>`;
          else if (c.id === 'owner') resolveBtn = `<button onclick="Actions.setFlowBuilderMapResolveView('owner')" class="text-[10px] font-black text-indigo-300 hover:text-indigo-100">Resolver →</button>`;
          else if (c.id === 'krs') resolveBtn = `<button onclick="Actions.setFlowBuilderMapResolveView('krs')" class="text-[10px] font-black text-indigo-300 hover:text-indigo-100">Resolver →</button>`;
        } else {
          // Produto salvo: abre Mapa real direto no step
          resolveBtn = `<button onclick="Actions.openStrategicMapAtStep(${productKey}, '${c.step}')" class="text-[10px] font-black text-indigo-300 hover:text-indigo-100">Abrir Mapa →</button>`;
        }
      }
      return `<div class="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10">
        <span class="w-7 h-7 rounded-full grid place-items-center font-black shrink-0" style="background:${iconBg};color:${iconColor};">${icon}</span>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-black text-white">${Utils.escape(c.label)}</p>
          ${c.detail ? `<p class="text-[10px] text-slate-400 mt-0.5">${Utils.escape(c.detail)}</p>` : ''}
        </div>
        ${resolveBtn}
      </div>`;
    }).join('');

    // Footer: pra produto salvo, atalho geral
    const footer = !isProto
      ? `<div class="mt-3 flex justify-end"><button onclick="Actions.openStrategicMap(${productKey})" class="text-xs font-black text-indigo-300 hover:text-indigo-100 flex items-center gap-1">Abrir Mapa completo <i data-lucide="external-link" class="w-3 h-3"></i></button></div>`
      : `<p class="text-[10px] text-slate-500 mt-3 text-center">Esteira em rascunho — preencha aqui o que dá. Os 2 últimos mínimos só desbloqueiam quando você Salvar esteira.</p>`;

    return head + `<div class="space-y-1.5">${items}</div>${footer}`;
  },

  // V39.13.0 — Form inline pros 3 mínimos preenchíveis no rascunho.
  // Reusa actions que tocam direto em strategicMaps[proto_<nodeId>] via engine.
  _mapaResolveInline(produtoNode, productKey, view) {
    const map = StrategicMapEngine.getForProduct(productKey) || {};
    const back = `<button onclick="Actions.setFlowBuilderMapResolveView(null)" class="text-[11px] font-black text-slate-300 hover:text-white flex items-center gap-1 mb-3"><i data-lucide="arrow-left" class="w-3 h-3"></i> Voltar ao breakdown</button>`;
    if (view === 'vision') {
      const v = String(map.vision || '');
      return `${back}
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Objetivo do produto</label>
        <textarea id="flowBuilderMapVisionInput" rows="4" oninput="Actions.setFlowBuilderMapVision(this.value)" placeholder="Qual o objetivo deste produto?" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm">${Utils.escape(v)}</textarea>
        <p class="text-[10px] text-slate-500 mt-1">Vai pra <b>Etapa 1 — Objetivo</b> no Mapa da Receita quando você Salvar esteira.</p>`;
    }
    if (view === 'owner') {
      const ao = map.areaOwners || {};
      return `${back}
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Donos das frentes</label>
        <p class="text-[10px] text-slate-500 mt-1">Pelo menos 1 frente precisa ter dono pra liberar este mínimo.</p>
        <div class="grid grid-cols-3 gap-2 mt-2">
          <div>
            <label class="text-[10px] font-black text-pink-300 uppercase tracking-wider">Marketing</label>
            <input value="${Utils.escape(String(ao.marketing || ''))}" oninput="Actions.setFlowBuilderMapOwner('marketing', this.value)" placeholder="Nome..." class="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm" />
          </div>
          <div>
            <label class="text-[10px] font-black text-teal-300 uppercase tracking-wider">Vendas</label>
            <input value="${Utils.escape(String(ao.sales || ''))}" oninput="Actions.setFlowBuilderMapOwner('sales', this.value)" placeholder="Nome..." class="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm" />
          </div>
          <div>
            <label class="text-[10px] font-black text-sky-300 uppercase tracking-wider">CS</label>
            <input value="${Utils.escape(String(ao.cs || ''))}" oninput="Actions.setFlowBuilderMapOwner('cs', this.value)" placeholder="Nome..." class="w-full mt-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm" />
          </div>
        </div>`;
    }
    if (view === 'krs') {
      const krs = StrategicMapEngine.getProductKrs(productKey);
      const byArea = { marketing: [], sales: [], cs: [] };
      for (const k of krs) (byArea[k.area] || []).push(k);
      const areaBlock = (key, label, color) => {
        const list = byArea[key] || [];
        const items = list.map(k => `<div class="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/10">
          <input value="${Utils.escape(String(k.name || ''))}" oninput="Actions.renameFlowBuilderMapKr('${k.id}', this.value)" class="flex-1 bg-transparent text-xs font-black text-white outline-none" />
          <button onclick="Actions.removeFlowBuilderMapKr('${k.id}')" class="w-5 h-5 rounded text-red-300 hover:text-red-100 grid place-items-center"><i data-lucide="x" class="w-3 h-3"></i></button>
        </div>`).join('');
        return `<div class="rounded-xl bg-white/[0.03] border border-white/10 p-3">
          <div class="flex items-center justify-between mb-2">
            <p class="text-[11px] font-black uppercase tracking-wider" style="color:${color};">${label} <span class="text-slate-400">(${list.length}${list.length < 3 ? ` — faltam ${3 - list.length}` : ''})</span></p>
            <button onclick="Actions.addFlowBuilderMapKr('${key}')" class="text-[10px] font-black text-indigo-300 hover:text-indigo-100 flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i>Adicionar KR</button>
          </div>
          <div class="space-y-1">${items || '<p class="text-[10px] text-slate-500 italic">Nenhum KR ainda. Pelo menos 3 por área.</p>'}</div>
        </div>`;
      };
      return `${back}
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">KRs-mãe por frente</label>
        <p class="text-[10px] text-slate-500 mt-1 mb-3">Mínimo cravado: <b>3 KRs por área</b>. Adicione abaixo. No Mapa real você refina nome, métrica e metas.</p>
        <div class="space-y-2">
          ${areaBlock('marketing', 'Marketing', '#F472B6')}
          ${areaBlock('sales',     'Vendas',    '#00CBCC')}
          ${areaBlock('cs',        'CS',        '#6BBEF9')}
        </div>`;
    }
    return back;
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

  // V39.11.1 — Modal Rascunhos: salvar snapshot do canvas atual + lista pra reabrir/apagar.
  _draftsModal() {
    if (!App.state.flowBuilderDraftsModal) return '';
    const drafts = (App.state.flowBuilderDrafts || []).slice().sort((a, b) =>
      String(b.savedAt || '').localeCompare(String(a.savedAt || ''))
    );
    const nameDraft = String(App.state.flowBuilderDraftNameDraft || '');
    const nodes = App.state.flowBuilderNodes || [];
    const ghosts = App.state.flowBuilderGhostSegmentations || [];
    const canSave = !!(nodes.length || ghosts.length);
    const formatDate = (iso) => {
      if (!iso) return '—';
      try {
        const d = new Date(iso);
        return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
      } catch (_) { return '—'; }
    };
    const list = drafts.length
      ? drafts.map(d => `<div class="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/10">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-black text-white truncate">${Utils.escape(d.name)}</p>
            <p class="text-[10px] text-slate-400 mt-0.5">${formatDate(d.savedAt)} · ${(d.nodes || []).length} blocos · ${(d.edges || []).length} conexões${(d.ghostSegmentations || []).length ? ` · ${(d.ghostSegmentations || []).length} fantasmas` : ''}</p>
          </div>
          <button onclick="Actions.loadFlowBuilderDraft('${d.id}')" title="Substitui o canvas atual pelo rascunho" class="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-black flex items-center gap-1"><i data-lucide="folder-open" class="w-3.5 h-3.5"></i> Abrir</button>
          <button onclick="Actions.deleteFlowBuilderDraft('${d.id}')" title="Apagar rascunho" class="px-2 py-2 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-400/30 text-red-200"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
        </div>`).join('')
      : `<p class="text-xs text-slate-400 text-center py-6">Nenhum rascunho salvo ainda. Use o campo acima pra resguardar o canvas atual.</p>`;
    return `<div class="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm grid place-items-center p-4">
      <div class="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-lg text-white max-h-[80vh] flex flex-col">
        <h3 class="text-xl font-black mb-1 flex items-center gap-2"><i data-lucide="bookmark" class="w-5 h-5 text-amber-300"></i> Rascunhos</h3>
        <p class="text-xs text-slate-400 mb-4">Salve um snapshot do canvas atual pra continuar depois sem precisar subir nas abas reais. Abrir um rascunho substitui o que estiver no canvas.</p>
        <div class="rounded-2xl bg-amber-500/10 border border-amber-400/30 p-3 mb-4">
          <label class="text-[11px] font-black text-amber-200 uppercase tracking-wider">Salvar canvas atual como rascunho</label>
          <div class="flex gap-2 mt-1.5">
            <input id="flowBuilderDraftNameInput" value="${Utils.escape(nameDraft)}" oninput="Actions.updateFlowBuilderDraftNameDraft(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();Actions.saveFlowBuilderDraft();}" placeholder="Ex: Lançamento Black Friday — esboço" class="flex-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm" />
            <button onclick="Actions.saveFlowBuilderDraft()" ${canSave ? '' : 'disabled'} class="${canSave ? 'bg-amber-500 hover:bg-amber-600' : 'bg-white/10 cursor-not-allowed'} px-3 py-2.5 rounded-xl text-white text-xs font-black flex items-center gap-1"><i data-lucide="save" class="w-3.5 h-3.5"></i> Salvar</button>
          </div>
          ${!canSave ? '<p class="text-[10px] text-slate-400 mt-1.5">Canvas vazio — nada pra rascunhar.</p>' : ''}
        </div>
        <p class="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Rascunhos salvos</p>
        <div class="flex-1 overflow-auto space-y-1.5 pr-1">${list}</div>
        <div class="flex justify-end gap-2 mt-4 pt-4 border-t border-white/10">
          <button onclick="Actions.closeFlowBuilderDraftsModal()" class="px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-black">Fechar</button>
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
    // V39.12.0 — Ação tem layout largo (form completo); execução também.
    const widthClass = (node.type === 'acao' || node.type === 'execucao') ? 'max-w-2xl' : 'max-w-md';
    return `<div class="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm grid place-items-center p-4">
      <div class="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full ${widthClass} text-white max-h-[88vh] flex flex-col">
        <h3 class="text-xl font-black mb-1 flex items-center">Editar bloco ${linked}</h3>
        <p class="text-xs text-slate-400 mb-4">Tipo: <span style="color:${type.color}">${Utils.escape(type.label)}</span>${isEsteira ? (node.linkedRealId ? ' · re-salvar atualiza o que já está no LJ' : ' · vira entidade real ao salvar') : ' · só rascunho visual (legacy)'}</p>
        <div class="overflow-auto flex-1 pr-1">${this._editNodeFields(node.type, draft, node)}</div>
        <div class="flex items-center gap-2 mt-5 pt-4 border-t border-white/10">
          <button onclick="Actions.removeFlowBuilderNodeFromModal('${node.id}')" title="Apaga este bloco do canvas (não desfaz o que já entrou no LJ)" class="px-3 py-3 rounded-2xl bg-red-500/15 hover:bg-red-500/25 border border-red-400/30 text-red-200 font-black text-xs flex items-center gap-1.5"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Excluir bloco</button>
          <div class="flex-1"></div>
          <button onclick="Actions.cancelFlowBuilderEditNode()" class="px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-black">Cancelar</button>
          <button onclick="Actions.saveFlowBuilderEditNode()" class="px-4 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-black">Salvar</button>
        </div>
      </div>
    </div>`;
  },

  _editNodeFields(typeId, draft, node) {
    const v = (k, fallback) => Utils.escape(String(draft[k] != null ? draft[k] : (fallback || '')));
    const nameInput = `
      <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Nome</label>
      <input id="flowBuilderEditNodeInput" value="${v('name')}" oninput="Actions.updateFlowBuilderEditNodeField('name', this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();Actions.saveFlowBuilderEditNode();}else if(event.key==='Escape'){event.preventDefault();Actions.cancelFlowBuilderEditNode();}" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm" placeholder="Nome..." />
    `;

    if (typeId === 'produto') {
      // V39.12.0 — Seletor de ICP em rascunho (igual a print 3). Pill verde se
      // já configurado; CTA cinza se não. Click abre o AudienceWizard com flag
      // de target (volta pro draft do bloco em vez de product.audience).
      const a = draft.audienceDraft || null;
      let icpPill;
      if (a && a.configured) {
        const tags = [a.modeloNegocio, a.modeloOperacional].filter(Boolean).map(s => String(s).toUpperCase()).join(' · ');
        icpPill = `<button onclick="Actions.openFlowBuilderAudienceWizard('${node.id}')" class="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-100 hover:bg-emerald-500/25 transition">
          <span class="flex items-center gap-2 min-w-0"><i data-lucide="target" class="w-4 h-4 shrink-0"></i><span class="text-xs font-black truncate">ICP ${Utils.escape(tags)}</span></span>
          <span class="text-[11px] font-black">Editar</span>
        </button>`;
      } else {
        icpPill = `<button onclick="Actions.openFlowBuilderAudienceWizard('${node.id}')" class="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-2xl bg-slate-950 border border-white/15 text-slate-300 hover:bg-white/[0.06] transition">
          <span class="flex items-center gap-2"><i data-lucide="target" class="w-4 h-4"></i><span class="text-xs font-black">Definir audiência (ICP)</span></span>
          <i data-lucide="chevron-right" class="w-4 h-4"></i>
        </button>`;
      }
      return `${nameInput}
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider mt-3 block">Audiência (ICP)</label>
        <div class="mt-1">${icpPill}</div>
        <p class="text-[10px] text-slate-500 mt-1">Rascunho até salvar — o ICP só entra no LJ quando você clicar <b>Salvar esteira</b>.</p>

        <div class="grid grid-cols-2 gap-2 mt-3">
          <div>
            <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Recorrência</label>
            <select onchange="Actions.updateFlowBuilderEditNodeField('revenueModel', this.value)" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm">
              <option value="Venda única" ${draft.revenueModel === 'Venda única' ? 'selected' : ''}>Venda única</option>
              <option value="Mensal" ${draft.revenueModel === 'Mensal' ? 'selected' : ''}>Mensal</option>
              <option value="Anual" ${draft.revenueModel === 'Anual' ? 'selected' : ''}>Anual</option>
              <option value="Trimestral" ${draft.revenueModel === 'Trimestral' ? 'selected' : ''}>Trimestral</option>
              <option value="Outro" ${draft.revenueModel === 'Outro' ? 'selected' : ''}>Outro</option>
            </select>
          </div>
          <div>
            <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Tipo (opcional)</label>
            <input value="${v('type')}" oninput="Actions.updateFlowBuilderEditNodeField('type', this.value)" placeholder="SaaS / Curso / Serviço" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm" />
          </div>
        </div>
        <p class="text-[10px] text-slate-500 mt-2">Preço, custo e demais detalhes ficam pra ajustar depois na aba <b>Produtos</b>.</p>`;
    }

    if (typeId === 'campanha') {
      return `${nameInput}
        <p class="text-[10px] text-slate-500 mt-2">A campanha herda o produto via conexão no canvas. Setor, owner, objetivo e demais detalhes ficam pra editar depois na aba <b>Campanhas</b>.</p>`;
    }

    if (typeId === 'acao') {
      // V39.12.0 — Form COMPLETO igual à tela "Criar ação" do LJ (print 4):
      // Setor + Funil (Contexto operacional) · Canal + Tipo (com "+ Adicionar")
      // · Destino setor + Destino funil (Travessia) · Fluxo obrigatório calculado.
      const sector = draft.sector || 'Marketing';
      const funnel = draft.funnel || 'MOF';
      const destSector = draft.destinationSector || sector;
      const destFunnel = draft.destinationFunnel || funnel;
      const channels = window.Config?.allChannels ? Config.allChannels() : ['Instagram Orgânico', 'Email', 'Google Ads'];
      const actionTypes = window.Config?.allActionTypes ? Config.allActionTypes() : ['Post', 'Sequência', 'Automação'];
      const sectors = (window.Config?.sectors) || ['Marketing', 'Vendas', 'CS'];
      const funnels = (window.Config?.funnels) || ['TOF', 'MOF', 'BOF'];
      const flowPath = window.FlowResolutionEngine ? FlowResolutionEngine.resolve(sector, funnel, destSector, destFunnel) : [];
      const flowLabels = window.FlowResolutionEngine ? flowPath.map(s => FlowResolutionEngine.label(s)) : [];

      const segKeys = Array.isArray(draft.segmentations) ? draft.segmentations.slice(0, 2) : [];
      const segChips = segKeys.length
        ? segKeys.map(k => {
            const s = this.segmentationByKey(k);
            if (!s) return '';
            return `<div class="flex items-center gap-2 px-3 py-2 rounded-xl border" style="background:${s.color}1a;border-color:${s.color}66;">
              <span class="w-6 h-6 rounded-full grid place-items-center" style="background:${s.color}33;color:${s.color};"><i data-lucide="${s.icon || 'tag'}" class="w-3.5 h-3.5"></i></span>
              <span class="flex-1 text-xs font-black" style="color:${s.color};">${Utils.escape(s.name)}</span>
              <button onclick="Actions.removeFlowBuilderEditDraftSegmentation('${k}')" title="Remover esta segmentação" class="w-7 h-7 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-400/30 text-red-200 grid place-items-center"><i data-lucide="x" class="w-3.5 h-3.5"></i></button>
            </div>`;
          }).join('')
        : `<p class="text-[11px] text-slate-500 px-1">Nenhuma segmentação. Arraste uma seg do botão <b>Segmentação</b> da pílula pro card.</p>`;

      return `${nameInput}

        <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-4 mt-3">
          <h4 class="text-sm font-black mb-3">Contexto operacional</h4>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Setor</label>
              <select onchange="Actions.updateFlowBuilderEditNodeField('sector', this.value)" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm">
                ${sectors.map(s => `<option value="${Utils.escape(s)}" ${sector === s ? 'selected' : ''}>${Utils.escape(s)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Funil</label>
              <select onchange="Actions.updateFlowBuilderEditNodeField('funnel', this.value)" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm">
                ${funnels.map(f => `<option value="${Utils.escape(f)}" ${funnel === f ? 'selected' : ''}>${Utils.escape(f)}</option>`).join('')}
              </select>
            </div>
            <div>
              <div class="flex items-center justify-between mb-1"><label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Canal</label><button onclick="Actions.addCustomChannel(); setTimeout(()=>App.render(),50)" class="text-[10px] font-black text-indigo-300 hover:text-indigo-200 flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i>Adicionar Canal</button></div>
              <select onchange="Actions.updateFlowBuilderEditNodeField('channel', this.value)" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm">
                ${channels.map(c => `<option value="${Utils.escape(c)}" ${draft.channel === c ? 'selected' : ''}>${Utils.escape(c)}</option>`).join('')}
              </select>
            </div>
            <div>
              <div class="flex items-center justify-between mb-1"><label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Tipo</label><button onclick="Actions.addCustomActionType(); setTimeout(()=>App.render(),50)" class="text-[10px] font-black text-indigo-300 hover:text-indigo-200 flex items-center gap-1"><i data-lucide="plus" class="w-3 h-3"></i>Adicionar Tipo</button></div>
              <select onchange="Actions.updateFlowBuilderEditNodeField('actionType', this.value)" class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm">
                ${actionTypes.map(t => `<option value="${Utils.escape(t)}" ${draft.actionType === t ? 'selected' : ''}>${Utils.escape(t)}</option>`).join('')}
              </select>
            </div>
          </div>
        </div>

        <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-4 mt-3">
          <h4 class="text-sm font-black mb-1">Travessia da ação</h4>
          <p class="text-[11px] text-slate-400 mb-3">A origem é definida automaticamente pelo Contexto operacional: <b>${Utils.escape(sector)} ${Utils.escape(funnel)}</b>. Aqui você só define onde a ação deve terminar.</p>
          <div class="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Destino setor</label>
              <select onchange="Actions.updateFlowBuilderEditNodeField('destinationSector', this.value)" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm">
                ${sectors.map(s => `<option value="${Utils.escape(s)}" ${destSector === s ? 'selected' : ''}>${Utils.escape(s)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider block">Destino funil</label>
              <select onchange="Actions.updateFlowBuilderEditNodeField('destinationFunnel', this.value)" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm">
                ${funnels.map(f => `<option value="${Utils.escape(f)}" ${destFunnel === f ? 'selected' : ''}>${Utils.escape(f)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Fluxo obrigatório resolvido automaticamente</div>
          <div class="flex flex-wrap gap-2">${flowLabels.map((label, i) => `<span class="px-3 py-1.5 rounded-full bg-slate-950 border border-white/15 text-[11px] font-black text-slate-200">${i + 1}. ${Utils.escape(label)}</span>`).join('')}</div>
        </div>

        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider mt-3 block">Objetivo (opcional)</label>
        <textarea oninput="Actions.updateFlowBuilderEditNodeField('objective', this.value)" rows="2" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm" placeholder="O que a ação visa entregar...">${v('objective')}</textarea>

        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider mt-3 block">Segmentações (máx 2)</label>
        <div class="mt-1 space-y-1.5">${segChips}</div>`;
    }

    if (typeId === 'execucao') {
      // V39.12.0 — Modal de Execução com gate de ClickUp. Se já está salvo (linkedRealId
      // existe → execução real no LJ + ação real referenciada), permite abrir o
      // editor de tarefa ClickUp. Senão, mostra aviso pra salvar primeiro.
      const linkedRealId = node?.linkedRealId || null;
      const linkedTask = linkedRealId && window.ExecutionTaskStore
        ? (App.state.executionTasks || []).find(t => String(t.task_id) === String(linkedRealId))
        : null;
      const hasProvider = !!(linkedTask?.provider_task_id);
      const ctaLabel = hasProvider ? 'Atualizar tarefa no ClickUp' : 'Criar tarefa no ClickUp';
      const linkedActionId = linkedTask?.linked_action_id || null;
      const gateOk = !!(linkedRealId && linkedActionId);
      return `${nameInput}
        <div class="rounded-2xl bg-white/[0.04] border border-white/10 p-4 mt-3">
          <h4 class="text-sm font-black mb-1">Tarefa no ClickUp</h4>
          ${gateOk
            ? `<p class="text-[11px] text-slate-400 mb-3">Esta execução já existe no LJ. Clique pra editar a tarefa do ClickUp (datas, responsáveis, descrição) no editor padrão.</p>
               <button onclick="Actions.openTaskCreationModal(${linkedActionId}, ${hasProvider ? `'${linkedTask.task_id}'` : `'${linkedTask.task_id}'`})" class="w-full px-4 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-black flex items-center justify-center gap-2"><i data-lucide="send" class="w-4 h-4"></i> ${ctaLabel}</button>`
            : `<div class="rounded-xl bg-amber-500/15 border border-amber-400/40 p-3 flex items-start gap-2">
                 <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-300 shrink-0 mt-0.5"></i>
                 <div class="text-xs text-amber-100">
                   Esta execução ainda é <b>protótipo</b>. Salve a esteira primeiro (botão verde no header) — ao virar entidade real no LJ, o botão de criar tarefa no ClickUp aparece aqui.
                 </div>
               </div>`
          }
        </div>
        <p class="text-[10px] text-slate-500 mt-2">Título acima vira o nome da tarefa em <b>Execuções</b>.</p>`;
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
    // V39.12.1 — ESC fecha pílula expandida quando builder está aberto. Listener
    // global registrado UMA vez (idempotente via flag interna).
    // V39.12.2 — Mesmo listener cuida do Delete/Backspace pra apagar selecionados
    // (regra: < 10s sem confirm, ≥ 10s com confirm).
    if (!this._internal._escListenerAttached) {
      window.addEventListener('keydown', (e) => {
        if (!App.state.showFlowBuilderModal) return;
        // Modais internos abertos: deixa o handler nativo cuidar.
        const modalOpen = (
          App.state.flowBuilderEditNodeId ||
          App.state.flowBuilderCustomSegModal ||
          App.state.flowBuilderDraftsModal ||
          App.state.flowBuilderLoadCampaignModal ||
          App.state.flowBuilderClearConfirm ||
          App.state.flowBuilderDisconnectEdgeId
        );
        // Foco em input/textarea: deixa o input controlar suas próprias teclas
        // (não apagar cards quando user digita Delete dentro do input).
        const active = document.activeElement;
        const inField = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable);
        if (e.key === 'Escape') {
          if (modalOpen) return;
          if (App.state.flowBuilderPaletteOpen) {
            App.state.flowBuilderPaletteOpen = false;
            App.save(); App.render();
            e.preventDefault();
          }
          return;
        }
        if ((e.key === 'Delete' || e.key === 'Backspace') && !modalOpen && !inField) {
          const sel = App.state.flowBuilderSelectedNodeIds || [];
          if (!sel.length) return;
          e.preventDefault();
          if (window.Actions?.deleteFlowBuilderSelected) Actions.deleteFlowBuilderSelected();
        }
      });
      this._internal._escListenerAttached = true;
    }
    setTimeout(() => {
      const inputEdit = document.getElementById('flowBuilderEditNodeInput');
      if (inputEdit) { inputEdit.focus(); inputEdit.select(); }
      const inputCustom = document.getElementById('flowBuilderCustomSegInput');
      if (inputCustom) { inputCustom.focus(); inputCustom.select(); }
      const inputDraft = document.getElementById('flowBuilderDraftNameInput');
      if (inputDraft && !inputEdit && !inputCustom) { inputDraft.focus(); }
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

  // V39.12.0 — Estado do bloco: 'saved' (já no LJ) | 'ready' (válido pra salvar) | 'incomplete' (faltam campos/conexões).
  // Função pura: recebe node + edges + nodes, devolve {state, reason}.
  _nodeStatus(node, edges, nodes) {
    if (!this.isEsteira(node.type)) return { state: 'auxiliary', reason: '' };
    if (node.linkedRealId) return { state: 'saved', reason: 'Já entrou no LJ.' };
    const name = String(node.data?.name || node.name || '').trim();
    if (!name) return { state: 'incomplete', reason: 'Falta nome.' };
    const findIncoming = (parentType) => {
      const in_ = edges.filter(e => String(e.toId) === String(node.id));
      return in_.map(e => nodes.find(n => String(n.id) === String(e.fromId))).filter(n => n && n.type === parentType);
    };
    if (node.type === 'campanha') {
      const parents = findIncoming('produto');
      if (parents.length === 0) return { state: 'incomplete', reason: 'Falta conectar a um Produto.' };
      if (parents.length > 1)   return { state: 'incomplete', reason: 'Conectada a mais de 1 Produto (esperado 1).' };
    }
    if (node.type === 'acao') {
      const parents = findIncoming('campanha');
      if (parents.length === 0) return { state: 'incomplete', reason: 'Falta conectar a uma Campanha.' };
      if (parents.length > 1)   return { state: 'incomplete', reason: 'Conectada a mais de 1 Campanha (esperado 1).' };
    }
    if (node.type === 'execucao') {
      const parents = findIncoming('acao');
      if (parents.length === 0) return { state: 'incomplete', reason: 'Falta conectar a uma Ação.' };
      if (parents.length > 1)   return { state: 'incomplete', reason: 'Conectada a mais de 1 Ação (esperado 1).' };
    }
    return { state: 'ready', reason: 'Pronto pra salvar.' };
  },

  _statusVisual(state) {
    switch (state) {
      case 'saved':       return { color: '#10b981', label: 'SALVO',     bg: 'rgba(16,185,129,0.20)', border: 'rgba(52,211,153,0.55)', text: '#6ee7b7' };
      case 'ready':       return { color: '#fbbf24', label: 'PROTÓTIPO', bg: 'rgba(251,191,36,0.20)', border: 'rgba(251,191,36,0.55)', text: '#fde68a' };
      case 'incomplete':  return { color: '#ef4444', label: 'INCOMPLETO',bg: 'rgba(239,68,68,0.20)',  border: 'rgba(239,68,68,0.55)',  text: '#fca5a5' };
      default:            return { color: '#64748b', label: '',          bg: 'rgba(100,116,139,0.15)',border: 'rgba(100,116,139,0.4)', text: '#cbd5e1' };
    }
  },

  _renderEdge(svgNS, parent, edge, nodes) {
    const from = nodes.find(n => n.id === edge.fromId);
    const to = nodes.find(n => n.id === edge.toId);
    if (!from || !to) return;
    const fromPort = this._outputPort(from);
    const toPort = this._inputPort(to);
    // V40.6.0 (Leonardo) — linhas em azul-cobalto translúcido. A linha conecta,
    // não compete cromaticamente com os blocos.
    const stroke = 'rgba(110,165,255,0.55)';
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
    path.setAttribute('stroke-width', '1.75');
    path.setAttribute('fill', 'none');
    path.style.pointerEvents = 'none';
    parent.appendChild(path);
  },

  _renderNode(svgNS, parent, node, armedId, edges) {
    const type = this.typeById(node.type);
    // V40.6.1 (Leonardo) — Cor resolvida dinamicamente: Ação por setor,
    // Execução por cascata da ação parent.
    const allNodes = App.state.flowBuilderNodes || [];
    const resolvedColor = this.isEsteira(node.type) ? this.nodeColor(node, allNodes) : type.color;
    // V39.12.1 — armedId pode ser string única ou array (massa).
    const armedArr = Array.isArray(armedId) ? armedId.map(String) : (armedId ? [String(armedId)] : []);
    const isArmed = armedArr.includes(String(node.id));
    const otherArmed = armedArr.length && !isArmed;
    // V39.12.1 — Seleção: contorno mais forte quando incluído em selectedNodeIds.
    const selected = (App.state.flowBuilderSelectedNodeIds || []).map(String);
    const isSelected = selected.includes(String(node.id));
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
    // V40.6.0 (Leonardo) — profundidade escalonada: Produto enraíza (sombra
    // densa), Execução é folha no fim do galho (sombra leve). A cascata
    // semântica vira topografia visual.
    const shadowByType = {
      produto:  'drop-shadow(0 8px 20px rgba(0,0,0,0.45))',
      campanha: 'drop-shadow(0 6px 16px rgba(0,0,0,0.35))',
      acao:     'drop-shadow(0 4px 12px rgba(0,0,0,0.28))',
      execucao: 'drop-shadow(0 2px 8px rgba(0,0,0,0.20))'
    };
    if (shadowByType[node.type]) group.style.filter = shadowByType[node.type];
    group.addEventListener('dblclick', (event) => {
      event.stopPropagation();
      if (window.Actions?.openFlowBuilderEditNode) Actions.openFlowBuilderEditNode(node.id);
    });

    // V40.6.0 (Leonardo) — Seleção: glow externo na cor do tipo em vez de
    // borda branca decapitada. Stroke do rect mantém identidade cromática.
    if (isSelected && !isArmed && !isHoveredForSeg) {
      const glow = document.createElementNS(svgNS, 'rect');
      glow.setAttribute('x', -5); glow.setAttribute('y', -5);
      glow.setAttribute('width', this.NODE_WIDTH + 10); glow.setAttribute('height', this.NODE_HEIGHT + 10);
      glow.setAttribute('rx', 18); glow.setAttribute('ry', 18);
      glow.setAttribute('fill', 'none');
      glow.setAttribute('stroke', resolvedColor);
      glow.setAttribute('stroke-width', '3');
      glow.setAttribute('opacity', '0.45');
      group.appendChild(glow);
    }

    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', 0); rect.setAttribute('y', 0);
    rect.setAttribute('width', this.NODE_WIDTH); rect.setAttribute('height', this.NODE_HEIGHT);
    rect.setAttribute('rx', 14); rect.setAttribute('ry', 14);
    rect.setAttribute('fill', '#0b1325');
    // V40.6.1 (Leonardo) — Borda 1px: a sombra dominante já desenha o contorno.
    // Onde a luz fez o trabalho, a tinta vira excesso.
    rect.setAttribute('stroke', isArmed ? '#38bdf8' : (isHoveredForSeg ? '#fbbf24' : resolvedColor));
    rect.setAttribute('stroke-width', isHoveredForSeg ? 3.5 : (isArmed ? 3 : 1));
    group.appendChild(rect);

    // V39.10.4 — Nuance da cor agora vem do drop-shadow individual de cada badge
    // (renderizado mais embaixo). Tint geral do card removido — quando há 2 badges,
    // cada uma irradia sua cor no seu canto, não mistura no card inteiro.

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

    // V40.6.1 (Leonardo) — Badge individual aparece SÓ pra SALVO (verde) e
    // INCOMPLETO (vermelho). PROTÓTIPO virou aviso global no canto sup esquerdo
    // do canvas — a maioria dos blocos é protótipo, repetir em cada um era ruído.
    if (isEsteira) {
      const status = this._nodeStatus(node, edges, App.state.flowBuilderNodes || []);
      const showBadge = status.state === 'saved' || status.state === 'incomplete';
      if (showBadge) {
        const vis = this._statusVisual(status.state);
        const badge = document.createElementNS(svgNS, 'g');
        const labelW = vis.label.length * 5.2;
        const totalW = labelW + 12;
        badge.setAttribute('transform', `translate(${this.NODE_WIDTH - totalW - 12}, 12)`);
        const dot = document.createElementNS(svgNS, 'circle');
        dot.setAttribute('cx', 4); dot.setAttribute('cy', 4); dot.setAttribute('r', 3);
        dot.setAttribute('fill', vis.color);
        badge.appendChild(dot);
        const badgeTxt = document.createElementNS(svgNS, 'text');
        badgeTxt.setAttribute('x', 11); badgeTxt.setAttribute('y', 7);
        badgeTxt.setAttribute('fill', vis.text); badgeTxt.setAttribute('font-size', '7.5'); badgeTxt.setAttribute('font-weight', '900');
        badgeTxt.setAttribute('letter-spacing', '0.5');
        badgeTxt.textContent = vis.label;
        badge.appendChild(badgeTxt);
        const title = document.createElementNS(svgNS, 'title');
        title.textContent = status.reason;
        badge.appendChild(title);
        group.appendChild(badge);
      }
    }

    const typeLabel = document.createElementNS(svgNS, 'text');
    typeLabel.setAttribute('x', 16); typeLabel.setAttribute('y', 24);
    typeLabel.setAttribute('fill', resolvedColor); typeLabel.setAttribute('font-size', '10'); typeLabel.setAttribute('font-weight', '900');
    typeLabel.textContent = type.label.toUpperCase();
    group.appendChild(typeLabel);

    // V40.6.0 (Leonardo) — wrap em 2 linhas, sem truncamento agressivo.
    // Limite 24 chars/linha; quebra na palavra mais próxima do meio.
    const rawName = String(node.data?.name || node.name || 'Sem nome');
    const wrapName = (text, max) => {
      if (text.length <= max) return [text];
      const words = text.split(/\s+/);
      const lines = ['', ''];
      let idx = 0;
      for (const w of words) {
        const candidate = (lines[idx] ? lines[idx] + ' ' : '') + w;
        if (candidate.length <= max) lines[idx] = candidate;
        else if (idx === 0) { idx = 1; lines[1] = w; }
        else lines[1] += (lines[1] ? ' ' : '') + w;
      }
      if (lines[1].length > max) lines[1] = lines[1].slice(0, max - 1) + '…';
      return lines[1] ? [lines[0], lines[1]] : [lines[0]];
    };
    const nameLines = wrapName(rawName, 24);
    const nameText = document.createElementNS(svgNS, 'text');
    nameText.setAttribute('x', 16); nameText.setAttribute('y', 48);
    nameText.setAttribute('fill', '#ffffff'); nameText.setAttribute('font-size', '14'); nameText.setAttribute('font-weight', '800');
    nameLines.forEach((line, i) => {
      const tspan = document.createElementNS(svgNS, 'tspan');
      tspan.setAttribute('x', 16);
      if (i === 0) tspan.setAttribute('y', 48);
      else tspan.setAttribute('dy', '18');
      tspan.textContent = line;
      nameText.appendChild(tspan);
    });
    group.appendChild(nameText);

    // V39.12.0 — × removido do card (era atropelado por acidente ao mover).
    // Remoção agora vai pelo modal de edição (duplo clique → botão Excluir bloco).

    const outgoing = edges.filter(e => e.fromId === node.id).length;
    // V40.6.0 — stats desce conforme número de linhas do nome.
    const statsY = nameLines.length > 1 ? 86 : 70;
    const stats = document.createElementNS(svgNS, 'text');
    stats.setAttribute('x', 16); stats.setAttribute('y', statsY);
    stats.setAttribute('fill', '#94a3b8'); stats.setAttribute('font-size', '10');
    stats.textContent = isExecucao ? 'fim de fluxo' : (outgoing > 0 ? `${outgoing} ${outgoing === 1 ? 'saída' : 'saídas'}` : 'sem saídas');
    group.appendChild(stats);

    // V39.10.0 — Badges de segmentação só na Ação (máx 2)
    // V39.11.1 — Badge dentro do card é SÓ layout. Remoção apenas via duplo-clique
    // → modal de edição (evita arrastar badge sem querer quando move o card).
    if (isAcao) {
      const segKeys = Array.isArray(node.data?.segmentations) ? node.data.segmentations.slice(0, 2) : [];
      segKeys.forEach((segKey, i) => {
        const seg = this.segmentationByKey(segKey);
        if (!seg) return;
        const badgeG = document.createElementNS(svgNS, 'g');
        // V40.6.0 — badge desce pra y=106 (depois do espaço do nome em 2 linhas).
        badgeG.setAttribute('transform', `translate(${16 + i * 86}, 106)`);
        badgeG.setAttribute('class', 'flow-no-drag flow-badge-static');
        badgeG.dataset.nodeId = String(node.id);
        badgeG.dataset.segKey = String(segKey);
        badgeG.style.pointerEvents = 'none';
        // V39.10.4 — Drop-shadow colorido em volta da badge = nuance localizada
        // no canto onde a badge fica. Com 2 badges, 2 halos de cores distintas.
        badgeG.style.filter = `drop-shadow(0 0 14px ${seg.color}aa) drop-shadow(0 0 4px ${seg.color})`;
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
        group.appendChild(badgeG);
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

    if (!isExecucao) this._renderConnButton(svgNS, group, node, isArmed, outgoing, armedArr.length);
    parent.appendChild(group);
  },

  _renderConnButton(svgNS, group, node, isArmed, outgoing, armedCount = 1) {
    let fill, stroke, textFill, label;
    if (isArmed) {
      fill = 'rgba(56,189,248,0.30)'; stroke = '#38bdf8'; textFill = '#e0f2fe';
      // V39.12.1 — Quando armament é em massa, mostra contagem no botão.
      label = armedCount > 1 ? `Conectando ${armedCount}...` : 'Conectando...';
    }
    // V40.6.0 (Leonardo) — "Conectada (N)" sai do verde-Execução pra cobalto neutro.
    // Confirmação não compete cromaticamente com o tipo do bloco.
    else if (outgoing > 0) { fill = 'rgba(110,165,255,0.14)'; stroke = 'rgba(110,165,255,0.45)'; textFill = 'rgba(186,210,255,0.85)'; label = `Conectada (${outgoing})`; }
    else { fill = 'rgba(255,255,255,0.04)'; stroke = 'rgba(255,255,255,0.18)'; textFill = '#94a3b8'; label = 'Conexão'; }
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
    // V40.6.0 (Leonardo) — hover absorve a mesma família neutra/cobalto.
    btn.addEventListener('mouseenter', () => { rect.setAttribute('fill', isArmed ? 'rgba(56,189,248,0.45)' : (outgoing > 0 ? 'rgba(110,165,255,0.24)' : 'rgba(255,255,255,0.10)')); });
    btn.addEventListener('mouseleave', () => { rect.setAttribute('fill', fill); });
    const dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('cx', 14); dot.setAttribute('cy', btnH / 2); dot.setAttribute('r', 3.2);
    dot.setAttribute('fill', isArmed ? '#7dd3fc' : (outgoing > 0 ? '#bad2ff' : '#94a3b8'));
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

  // V39.10.4 — Anima "ghost voando" via div HTML overlay (position fixed). Sai
  // FORA do SVG pra não morrer no re-render do canvas. CSS transition cubic-bezier
  // pra ease-out suave. Ghost original some imediato (state update); essa div
  // é só afterimage visual.
  _animateGhostFlight(ghost, acao, seg, segIndex) {
    const canvas = document.getElementById('flowBuilderCanvas');
    if (!canvas) return;
    const canvasRect = canvas.getBoundingClientRect();
    const zoom = Number(App.state.flowBuilderZoom || 1.0) || 1.0;
    const panX = Number(App.state.flowBuilderPanX || 0);
    const panY = Number(App.state.flowBuilderPanY || 0);

    // Ghost atual em screen coords (world → svg → screen)
    const fromX = canvasRect.left + (ghost.x * zoom) + panX;
    const fromY = canvasRect.top + (ghost.y * zoom) + panY;
    const w = this.GHOST_WIDTH * zoom;
    const h = this.GHOST_HEIGHT * zoom;

    // Alvo: onde a badge vai aparecer no card (16 + i * 86, 106 desde V40.6.0)
    const badgeWorldX = acao.x + 16 + segIndex * 86;
    const badgeWorldY = acao.y + 106;
    const toX = canvasRect.left + (badgeWorldX * zoom) + panX;
    const toY = canvasRect.top + (badgeWorldY * zoom) + panY;

    const div = document.createElement('div');
    div.style.cssText = `
      position: fixed;
      left: ${fromX}px;
      top: ${fromY}px;
      width: ${w}px;
      height: ${h}px;
      background: ${seg.color}33;
      border: 1.5px dashed ${seg.color};
      border-radius: 12px;
      z-index: 9999;
      pointer-events: none;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out;
      display: flex;
      align-items: center;
      padding: 0 12px;
      box-sizing: border-box;
      color: ${seg.color};
      font-weight: 900;
      font-size: 11px;
      transform: translate(0, 0) scale(1);
      opacity: 1;
      will-change: transform, opacity;
      box-shadow: 0 0 16px ${seg.color}99;
    `;
    div.textContent = (seg.name || '').slice(0, 14);
    document.body.appendChild(div);

    // Trigger animation no próximo frame (deixa o browser comprometer o estado inicial)
    requestAnimationFrame(() => {
      div.style.transform = `translate(${toX - fromX}px, ${toY - fromY}px) scale(0.25)`;
      div.style.opacity = '0';
    });
    setTimeout(() => { try { div.remove(); } catch (_) {} }, 340);
  },

  _onMouseDown(event, svg) {
    const target = event.target;
    // V39.12.2 — QUALQUER click dentro do canvas SVG fecha a pílula expandida.
    // (Antes só "área vazia" fechava. Click em card não fechava, gerando "às
    // vezes fecha às vezes não".)
    if (App.state.flowBuilderPaletteOpen) {
      App.state.flowBuilderPaletteOpen = false;
      // Atualização sem re-render destrutivo do canvas — popup HTML some
      // sozinho via render() do App, e os drag handlers do SVG seguem vivos.
      App.save();
      // Re-render imediato pra esconder o popup, mas sem chamar attach() (não
      // destruir o SVG; o resto do canvas só precisa esconder o div HTML do popup).
      App.render();
    }
    if (target.closest && target.closest('.flow-no-drag')) {
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
    const armed = App.state.flowBuilderConnectionArm;
    const armedIds = Array.isArray(armed) ? armed.map(String) : (armed ? [String(armed)] : []);
    if (target.classList?.contains('flow-port-output')) {
      const outId = target.dataset.nodeId;
      if (armedIds.length && armedIds.includes(String(outId))) {
        // V39.12.1 — pendingConnection guarda lista de fromIds (massa).
        this._internal.pendingConnection = { fromIds: armedIds.slice() };
        event.preventDefault();
        return;
      }
      if (!armedIds.length) {
        Utils.toast('Arme a conexão clicando em "Conexão" no bloco primeiro.');
        return;
      }
      Utils.toast('Outro bloco está armado. Use a porta de saída de um dos armados ou clique em "Conexão" pra desarmar.');
      return;
    }
    const group = target.closest('g[data-node-id]');
    if (group) {
      const nodeId = group.dataset.nodeId;
      if (armedIds.length && armedIds.includes(String(nodeId))) return;
      const node = (App.state.flowBuilderNodes || []).find(n => String(n.id) === String(nodeId));
      if (!node) return;
      // V39.12.2 — CTRL+SHIFT+drag duplica o card (mesmo tipo, mesmos dados,
      // sem linkedRealId) e arrasta o duplicado. Produto NÃO pode (regra:
      // 1 Produto por canvas).
      if ((event.ctrlKey || event.metaKey) && event.shiftKey) {
        if (node.type === 'produto') {
          Utils.toast('Produto não pode ser duplicado — cada esteira tem 1 só.');
          event.preventDefault();
          return;
        }
        const wp = this._screenToWorld(svg, event);
        const cloneData = JSON.parse(JSON.stringify(node.data || {}));
        const dup = {
          id: ActionFlowBuilder.genId(),
          type: node.type,
          name: node.name || '',
          x: Math.round(wp.x - this.NODE_WIDTH / 2),
          y: Math.round(wp.y - this.NODE_HEIGHT / 2),
          data: cloneData,
          linkedRealId: null,
          createdAt: Date.now()
        };
        App.state.flowBuilderNodes = [...(App.state.flowBuilderNodes || []), dup];
        App.state.flowBuilderSelectedNodeIds = [String(dup.id)];
        this._internal.dragNode = { nodeId: String(dup.id), offsetX: this.NODE_WIDTH / 2, offsetY: this.NODE_HEIGHT / 2 };
        App.save();
        setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
        event.preventDefault();
        return;
      }
      // V39.12.1 — CTRL+drag em card pai cria filho hierárquico já conectado
      // e arrasta o NOVO. Útil pra desenhar a esteira em fluência.
      if (event.ctrlKey || event.metaKey) {
        const childType = ActionFlowBuilder.CHILD_TYPE[node.type];
        if (!childType) {
          Utils.toast('Este bloco é o fim da cadeia (não tem próximo).');
          event.preventDefault();
          return;
        }
        const wp = this._screenToWorld(svg, event);
        const newNode = {
          id: ActionFlowBuilder.genId(),
          type: childType,
          name: '',
          x: Math.round(wp.x - this.NODE_WIDTH / 2),
          y: Math.round(wp.y - this.NODE_HEIGHT / 2),
          data: ActionFlowBuilder.defaultData(childType),
          linkedRealId: null,
          createdAt: Date.now()
        };
        const newEdge = {
          id: 'e_' + Date.now() + '_' + Math.floor(Math.random() * 100000),
          fromId: String(node.id),
          toId: String(newNode.id)
        };
        App.state.flowBuilderNodes = [...(App.state.flowBuilderNodes || []), newNode];
        App.state.flowBuilderEdges = [...(App.state.flowBuilderEdges || []), newEdge];
        App.state.flowBuilderSelectedNodeIds = [String(newNode.id)];
        this._internal.dragNode = { nodeId: String(newNode.id), offsetX: this.NODE_WIDTH / 2, offsetY: this.NODE_HEIGHT / 2 };
        App.save();
        setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
        event.preventDefault();
        return;
      }
      // V39.12.1 — ALT+drag em card (com seleção existente): começa box-select
      // por tipo. Tipo vem do primeiro selecionado, OU do próprio card clicado
      // se não houver seleção (UX mais permissivo do que toast bloqueante).
      if (event.altKey) {
        const sel = App.state.flowBuilderSelectedNodeIds || [];
        const refType = sel.length
          ? ((App.state.flowBuilderNodes || []).find(n => String(n.id) === String(sel[0]))?.type)
          : node.type;
        if (!refType) return;
        const wpAlt = this._screenToWorld(svg, event);
        this._internal.boxSelect = { startX: wpAlt.x, startY: wpAlt.y, endX: wpAlt.x, endY: wpAlt.y, type: refType };
        event.preventDefault();
        return;
      }
      // V39.12.1 — Click seleciona (shift estende, sem shift substitui).
      // V39.12.2 — NÃO re-renderizar SVG aqui (destrói o group e mata o dblclick
      // listener antes do 2º click chegar). Atualiza stroke no DOM e força App.render()
      // apenas pra o header refletir contador no próximo tick.
      const cur = App.state.flowBuilderSelectedNodeIds || [];
      let next = cur;
      if (event.shiftKey) {
        if (cur.includes(String(nodeId))) {
          next = cur.filter(id => id !== String(nodeId));
        } else {
          next = [...cur, String(nodeId)];
        }
      } else if (!cur.includes(String(nodeId))) {
        next = [String(nodeId)];
      }
      const changed = next.length !== cur.length || next.some((v, i) => v !== cur[i]);
      App.state.flowBuilderSelectedNodeIds = next;
      // Atualiza visual de TODOS os cards via DOM (sem destruir SVG).
      if (changed) {
        const selSet = new Set(next.map(String));
        const allGroups = svg.querySelectorAll('g[data-node-id]');
        for (const g of allGroups) {
          const id = g.dataset.nodeId;
          const rect = g.querySelector('rect');
          if (!rect) continue;
          const isSel = selSet.has(String(id));
          if (isSel) {
            rect.setAttribute('stroke', '#ffffff');
            rect.setAttribute('stroke-width', 4.5);
          } else {
            // Restaura aproximação — não vai pegar isArmed/isHoveredForSeg
            // mas o próximo render natural resolve isso. Para click simples
            // de seleção é só visual.
            const node2 = (App.state.flowBuilderNodes || []).find(n => String(n.id) === String(id));
            if (node2) {
              const type2 = this.typeById(node2.type);
              rect.setAttribute('stroke', type2.color);
              rect.setAttribute('stroke-width', this.isEsteira(node2.type) ? 2.5 : 2);
            }
          }
        }
        App.save(); // persiste sem render
      }
      // Continua com drag normal — drag move o card. dblclick continua armado
      // porque o group SVG não foi destruído.
      const wp = this._screenToWorld(svg, event);
      this._internal.dragNode = {
        nodeId,
        offsetX: wp.x - node.x,
        offsetY: wp.y - node.y
      };
      group.style.cursor = 'grabbing';
      return;
    }
    // Área vazia
    // V39.12.1 — ALT+drag em área vazia também começa box-select (precisa de seleção).
    if (event.altKey) {
      const sel = App.state.flowBuilderSelectedNodeIds || [];
      if (!sel.length) {
        Utils.toast('Selecione um card primeiro (click nele) pra usar Alt+arrastar.');
        return;
      }
      const refType = (App.state.flowBuilderNodes || []).find(n => String(n.id) === String(sel[0]))?.type;
      if (!refType) return;
      const wp = this._screenToWorld(svg, event);
      this._internal.boxSelect = { startX: wp.x, startY: wp.y, endX: wp.x, endY: wp.y, type: refType };
      event.preventDefault();
      return;
    }
    // Click em área vazia: limpa seleção + fecha pílula + inicia pan
    if ((App.state.flowBuilderSelectedNodeIds || []).length) {
      App.state.flowBuilderSelectedNodeIds = [];
      App.save();
      setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
    }
    if (App.state.flowBuilderPaletteOpen) {
      App.state.flowBuilderPaletteOpen = false;
      App.save();
      setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
    }
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
    // V39.12.1 — Box-select com ALT: desenha retângulo dashed enquanto arrasta.
    if (this._internal.boxSelect) {
      const wp = this._screenToWorld(svg, event);
      this._internal.boxSelect.endX = wp.x;
      this._internal.boxSelect.endY = wp.y;
      const old = svg.querySelector('#flowBoxSelect');
      if (old) old.remove();
      const svgNS = 'http://www.w3.org/2000/svg';
      const bs = this._internal.boxSelect;
      const xMin = Math.min(bs.startX, bs.endX);
      const yMin = Math.min(bs.startY, bs.endY);
      const w = Math.abs(bs.endX - bs.startX);
      const h = Math.abs(bs.endY - bs.startY);
      const rect = document.createElementNS(svgNS, 'rect');
      rect.setAttribute('id', 'flowBoxSelect');
      rect.setAttribute('x', xMin); rect.setAttribute('y', yMin);
      rect.setAttribute('width', w); rect.setAttribute('height', h);
      rect.setAttribute('fill', 'rgba(99,102,241,0.10)');
      rect.setAttribute('stroke', '#818cf8');
      rect.setAttribute('stroke-width', '1.5');
      rect.setAttribute('stroke-dasharray', '6 4');
      rect.style.pointerEvents = 'none';
      const world = svg.querySelector('#flowWorld');
      if (world) world.appendChild(rect);
      return;
    }
    if (this._internal.pendingConnection) {
      const overlay = svg.querySelector('#flowPendingEdge');
      if (overlay) overlay.remove();
      // V39.12.1 — Pode ser massa: pega o PRIMEIRO from pra desenhar a guia,
      // mas o commit em mouseUp aplica em todos os fromIds.
      const fromIds = this._internal.pendingConnection.fromIds || [];
      if (!fromIds.length) return;
      const fromNode = (App.state.flowBuilderNodes || []).find(n => String(n.id) === String(fromIds[0]));
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
      if (fromIds.length > 1) {
        const txt = document.createElementNS(svgNS, 'text');
        txt.setAttribute('x', wp.x + 14); txt.setAttribute('y', wp.y - 8);
        txt.setAttribute('fill', '#fbbf24'); txt.setAttribute('font-size', '11'); txt.setAttribute('font-weight', '900');
        txt.textContent = `× ${fromIds.length}`;
        svg.querySelector('#flowEdgesLayer')?.appendChild(txt);
      }
      return;
    }
    if (!this._internal.dragNode) return;
    const drag = this._internal.dragNode;
    const wp = this._screenToWorld(svg, event);
    const newX = wp.x - drag.offsetX;
    const newY = wp.y - drag.offsetY;
    const node = (App.state.flowBuilderNodes || []).find(n => String(n.id) === String(drag.nodeId));
    if (!node) return;
    // V39.12.1 — Multi-drag: se o node arrastado faz parte da seleção e há +1
    // selecionado, todos selecionados se movem juntos preservando offset relativo.
    const sel = App.state.flowBuilderSelectedNodeIds || [];
    const oldX = node.x, oldY = node.y;
    const dx = Math.round(newX) - oldX;
    const dy = Math.round(newY) - oldY;
    if (sel.length > 1 && sel.includes(String(drag.nodeId))) {
      const setSel = new Set(sel.map(String));
      const nodes = App.state.flowBuilderNodes || [];
      for (const n of nodes) {
        if (setSel.has(String(n.id))) {
          n.x = n.x + dx;
          n.y = n.y + dy;
          const g = svg.querySelector(`g[data-node-id="${n.id}"]`);
          if (g) g.setAttribute('transform', `translate(${n.x}, ${n.y})`);
        }
      }
    } else {
      node.x = Math.round(newX); node.y = Math.round(newY);
      const group = svg.querySelector(`g[data-node-id="${drag.nodeId}"]`);
      if (group) group.setAttribute('transform', `translate(${node.x}, ${node.y})`);
    }
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
      // V39.10.2 — Checar lixeira ANTES de esconder (senão _isOverTrash retorna
      // false porque vê o display:none que _hideTrash acabou de setar).
      const overTrash = this._isOverTrash(event.clientX, event.clientY);
      this._hideTrash();
      this._internal.hoveredActionId = null;
      if (overTrash) {
        Actions.removeFlowBuilderGhostSegmentation(ghostId);
        return;
      }
      // V39.10.4 — Aplicação síncrona (badge + remove ghost) E animação em
      // paralelo via HTML overlay fixed (sai do SVG, sobrevive ao re-render).
      const wp = this._screenToWorld(svg, event);
      const acao = this._findActionAtWorld(wp.x, wp.y);
      if (acao) {
        const ghost = (App.state.flowBuilderGhostSegmentations || []).find(g => String(g.id) === String(ghostId));
        if (ghost) {
          const seg = this.segmentationByKey(ghost.segKey);
          const segs = Array.isArray(acao.data?.segmentations) ? acao.data.segmentations : [];
          const willApply = seg && segs.length < 2 && !segs.includes(ghost.segKey);
          if (willApply) this._animateGhostFlight(ghost, acao, seg, segs.length);
          const ok = Actions.applyFlowBuilderSegmentationToAction(ghost.segKey, acao.id);
          if (ok) Actions.removeFlowBuilderGhostSegmentation(ghostId);
        }
        return;
      }
      // Else: fantasma fica onde está
      App.save();
      setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
      return;
    }
    // V39.12.1 — Finaliza box-select com ALT: pega todos os nodes do tipo
    // de referência que ESTÃO dentro do retângulo (qualquer intersecção do
    // bounding-box do card com o rect serve).
    if (this._internal.boxSelect) {
      const bs = this._internal.boxSelect;
      this._internal.boxSelect = null;
      const overlay = svg.querySelector('#flowBoxSelect');
      if (overlay) overlay.remove();
      const xMin = Math.min(bs.startX, bs.endX);
      const yMin = Math.min(bs.startY, bs.endY);
      const xMax = Math.max(bs.startX, bs.endX);
      const yMax = Math.max(bs.startY, bs.endY);
      if (Math.abs(xMax - xMin) < 8 || Math.abs(yMax - yMin) < 8) {
        // Drag pequeno demais — ignora (provavelmente click acidental).
        App.save();
        setTimeout(() => { try { ActionFlowBuilder.attach(); } catch (_) {} }, 0);
        return;
      }
      const W = this.NODE_WIDTH, H = this.NODE_HEIGHT;
      const matched = (App.state.flowBuilderNodes || []).filter(n =>
        n.type === bs.type &&
        n.x + W >= xMin && n.x <= xMax &&
        n.y + H >= yMin && n.y <= yMax
      );
      App.state.flowBuilderSelectedNodeIds = matched.map(n => String(n.id));
      Utils.toast(`✓ ${matched.length} ${matched.length === 1 ? 'card selecionado' : 'cards selecionados'} (${bs.type}).`);
      App.save(); App.render();
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
      const fromIds = this._internal.pendingConnection.fromIds || [];
      this._internal.pendingConnection = null;
      if (target.classList?.contains('flow-port-input')) {
        const toId = target.dataset.nodeId;
        // V39.12.1 — Massa: cria N edges de uma vez (1 por fromId).
        Actions.connectFlowBuilderNodes(fromIds, toId);
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
