// V39.8.0 — Flow Builder (whitelabel)
// Reset conceitual: o builder se desvinculou completamente de produto,
// campanha e ação. Não consome mais App.state.actions, FlowEngine ou
// FlowConnectionEngine. State próprio (`flowBuilderNodes`/`flowBuilderEdges`),
// catálogo de tipos embutido, blocos criados do zero no canvas.
// Bugs V15.1 1-15 corrigidos por consequência da re-arquitetura.
window.ActionFlowBuilder = {
  NODE_WIDTH: 200,
  NODE_HEIGHT: 110,

  NODE_TYPES: [
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

  _internal: { container: null, dragNode: null, pendingConnection: null },

  typeById(id) { return this.NODE_TYPES.find(t => t.id === id) || this.NODE_TYPES[this.NODE_TYPES.length - 1]; },

  genId() { return `n_${Date.now()}_${Math.floor(Math.random() * 100000)}`; },

  render() {
    if (!App.state.showFlowBuilderModal) return '';
    const zoom = Number(App.state.flowBuilderZoom || 1.0);
    return `<div class="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-sm p-4 overflow-auto grid place-items-start justify-items-center">
      <div class="rounded-[2rem] overflow-hidden shadow-2xl text-white" style="width:90vw;max-width:none;background: radial-gradient(circle at 18% 10%, rgba(99,102,241,.22), transparent 30%), #071326;">
        ${this._header()}
        ${App.state.flowBuilderShowHelp ? this._helpPanel() : ''}
        <div class="p-6 grid grid-cols-[minmax(0,1fr)_280px] gap-5">
          <div class="relative min-w-0">
            ${this._zoomControls(zoom)}
            <div id="flowBuilderCanvas" class="relative rounded-3xl border border-white/10 bg-white/[0.04] min-h-[70vh] max-h-[78vh] overflow-auto min-w-0">
              ${this._emptyCanvasHint()}
            </div>
          </div>
          ${this._palette()}
        </div>
        ${this._disconnectModal()}
        ${this._editNodeModal()}
        ${this._clearConfirmModal()}
      </div>
    </div>`;
  },

  _header() {
    const nodeCount = (App.state.flowBuilderNodes || []).length;
    const edgeCount = (App.state.flowBuilderEdges || []).length;
    return `<header class="p-6 border-b border-white/10 flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-2"><i data-lucide="git-merge" class="w-4 h-4 text-indigo-300"></i><p class="text-xs font-black text-slate-300 uppercase tracking-wider">Flow Builder · Whitelabel</p></div>
        <h2 class="text-2xl font-black">Desenhe um fluxo do zero</h2>
        <p class="text-sm text-slate-300 mt-1">${nodeCount} ${nodeCount === 1 ? 'bloco' : 'blocos'} · ${edgeCount} ${edgeCount === 1 ? 'conexão' : 'conexões'} · sem vínculo com produto, campanha ou ação.</p>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="Actions.toggleFlowBuilderHelp()" title="Como funciona" class="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-black flex items-center gap-1"><i data-lucide="help-circle" class="w-3.5 h-3.5"></i> Ajuda</button>
        <button onclick="Actions.requestFlowBuilderClear()" title="Apagar tudo" class="px-3 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-400/30 text-red-200 text-xs font-black flex items-center gap-1"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Limpar</button>
        <button onclick="Actions.closeFlowBuilder()" class="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-semibold flex items-center gap-2"><i data-lucide="x" class="w-4 h-4"></i> Fechar</button>
      </div>
    </header>`;
  },

  _helpPanel() {
    return `<div class="mx-6 mt-4 rounded-2xl bg-indigo-500/15 border border-indigo-400/30 p-4 text-sm text-indigo-100">
      <div class="flex items-start justify-between gap-3 mb-2"><p class="font-black">Como funciona o Flow Builder</p><button onclick="Actions.toggleFlowBuilderHelp()" class="text-indigo-200 text-xs font-black">×</button></div>
      <ul class="space-y-1 text-xs">
        <li>• <b>Adicionar bloco:</b> clique num tipo no painel à direita. O bloco aparece no canvas.</li>
        <li>• <b>Mover bloco:</b> arraste pelo corpo do bloco.</li>
        <li>• <b>Renomear:</b> duplo clique no bloco abre modal de edição.</li>
        <li>• <b>Remover bloco:</b> botão lixeira no bloco. Remove o bloco e todas as conexões dele.</li>
        <li>• <b>Conectar:</b> clique em <b>Conexão</b> no bloco de origem (fica azul, porta cresce) → arraste da porta de saída até a porta de entrada de outro bloco.</li>
        <li>• <b>Desconectar:</b> clique numa linha de conexão. Modal pergunta confirmação.</li>
        <li>• <b>Zoom:</b> botões + e − no topo. Botão central reseta para 100%.</li>
        <li>• <b>Limpar tudo:</b> botão <b>Limpar</b> no header zera blocos e conexões.</li>
      </ul>
    </div>`;
  },

  _emptyCanvasHint() {
    const nodes = App.state.flowBuilderNodes || [];
    if (nodes.length) return '';
    return `<div class="absolute inset-0 grid place-items-center text-center p-6 pointer-events-none">
      <div class="max-w-md">
        <i data-lucide="git-merge" class="w-8 h-8 text-indigo-300 mx-auto mb-3"></i>
        <p class="text-sm text-slate-300">Canvas vazio. Clique num tipo no painel à direita para adicionar o primeiro bloco.</p>
      </div>
    </div>`;
  },

  _zoomControls(zoom) {
    return `<div class="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-2xl bg-slate-950/80 border border-white/10 p-1">
      <button onclick="Actions.setFlowBuilderZoom(-0.1)" title="Diminuir zoom" class="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 text-white font-black"><i data-lucide="minus" class="w-3.5 h-3.5 mx-auto"></i></button>
      <button onclick="Actions.resetFlowBuilderZoom()" title="Resetar zoom para 100%" class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-[11px] font-black">${Math.round(zoom * 100)}%</button>
      <button onclick="Actions.setFlowBuilderZoom(0.1)" title="Aumentar zoom" class="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 text-white font-black"><i data-lucide="plus" class="w-3.5 h-3.5 mx-auto"></i></button>
    </div>`;
  },

  _palette() {
    const items = this.NODE_TYPES.map(t => `
      <button onclick="Actions.addFlowBuilderNode('${t.id}')" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.10] border border-white/10 text-white text-left transition" style="border-left: 3px solid ${t.color};">
        <span class="w-7 h-7 rounded-lg grid place-items-center" style="background:${t.color}22;color:${t.color};"><i data-lucide="${t.icon}" class="w-3.5 h-3.5"></i></span>
        <span class="text-sm font-black flex-1">${Utils.escape(t.label)}</span>
        <i data-lucide="plus" class="w-3.5 h-3.5 text-slate-400"></i>
      </button>
    `).join('');
    return `<aside class="rounded-3xl border border-white/10 bg-white/[0.055] p-4 max-h-[78vh] overflow-auto">
      <h3 class="font-black text-sm uppercase tracking-wider text-slate-300 mb-2">Adicionar bloco</h3>
      <p class="text-xs text-slate-400 mb-3">Clique num tipo para criar um bloco novo no canvas.</p>
      <div class="space-y-2">${items}</div>
    </aside>`;
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
    const draft = App.state.flowBuilderEditNodeDraft != null ? App.state.flowBuilderEditNodeDraft : node.name;
    const type = this.typeById(node.type);
    return `<div class="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm grid place-items-center p-4">
      <div class="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md text-white">
        <h3 class="text-xl font-black mb-1">Editar bloco</h3>
        <p class="text-xs text-slate-400 mb-4">Tipo: <span style="color:${type.color}">${Utils.escape(type.label)}</span></p>
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider">Nome</label>
        <input id="flowBuilderEditNodeInput" value="${Utils.escape(draft)}" oninput="Actions.updateFlowBuilderEditNodeDraft(this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();Actions.saveFlowBuilderEditNode();}else if(event.key==='Escape'){event.preventDefault();Actions.cancelFlowBuilderEditNode();}" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm" placeholder="Nome do bloco..." />
        <div class="flex justify-end gap-2 mt-5">
          <button onclick="Actions.cancelFlowBuilderEditNode()" class="px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-black">Cancelar</button>
          <button onclick="Actions.saveFlowBuilderEditNode()" class="px-4 py-3 rounded-2xl bg-indigo-500 hover:bg-indigo-600 text-white font-black">Salvar</button>
        </div>
      </div>
    </div>`;
  },

  _clearConfirmModal() {
    if (!App.state.flowBuilderClearConfirm) return '';
    const n = (App.state.flowBuilderNodes || []).length;
    const e = (App.state.flowBuilderEdges || []).length;
    return `<div class="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm grid place-items-center p-4">
      <div class="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md text-white">
        <h3 class="text-xl font-black mb-2">Apagar todo o fluxo?</h3>
        <p class="text-sm text-slate-300 mb-4">Vão ser removidos <b>${n}</b> blocos e <b>${e}</b> conexões. Não dá pra desfazer.</p>
        <div class="flex justify-end gap-2">
          <button onclick="Actions.cancelFlowBuilderClear()" class="px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-black">Cancelar</button>
          <button onclick="Actions.confirmFlowBuilderClear()" class="px-4 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-black">Apagar tudo</button>
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
      const input = document.getElementById('flowBuilderEditNodeInput');
      if (input) input.focus();
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
    if (!nodes.length) return; // preserva o empty hint estático
    const zoom = Number(App.state.flowBuilderZoom || 1.0);
    const baseWidth = 1400, baseHeight = 720;
    const width = baseWidth * zoom, height = baseHeight * zoom;
    const svgNS = 'http://www.w3.org/2000/svg';
    root.innerHTML = '';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${baseWidth} ${baseHeight}`);
    svg.setAttribute('style', `width:${width}px;height:${height}px;min-width:100%;`);
    svg.style.cursor = 'default';

    const grid = document.createElementNS(svgNS, 'g');
    grid.setAttribute('opacity', '0.5');
    for (let x = 0; x < baseWidth; x += 40) {
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', x); line.setAttribute('y1', 0); line.setAttribute('x2', x); line.setAttribute('y2', baseHeight);
      line.setAttribute('stroke', '#334155'); line.setAttribute('stroke-width', '0.6');
      grid.appendChild(line);
    }
    for (let y = 0; y < baseHeight; y += 40) {
      const line = document.createElementNS(svgNS, 'line');
      line.setAttribute('x1', 0); line.setAttribute('y1', y); line.setAttribute('x2', baseWidth); line.setAttribute('y2', y);
      line.setAttribute('stroke', '#334155'); line.setAttribute('stroke-width', '0.6');
      grid.appendChild(line);
    }
    svg.appendChild(grid);

    const armedId = App.state.flowBuilderConnectionArm;
    const edges = App.state.flowBuilderEdges || [];

    const edgesLayer = document.createElementNS(svgNS, 'g');
    edgesLayer.setAttribute('id', 'flowEdgesLayer');
    svg.appendChild(edgesLayer);
    for (const edge of edges) this._renderEdge(svgNS, edgesLayer, edge, nodes);

    const nodesLayer = document.createElementNS(svgNS, 'g');
    nodesLayer.setAttribute('id', 'flowNodesLayer');
    svg.appendChild(nodesLayer);
    for (const node of nodes) this._renderNode(svgNS, nodesLayer, node, armedId, edges);

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
    rect.setAttribute('stroke', isArmed ? '#38bdf8' : type.color);
    rect.setAttribute('stroke-width', isArmed ? 3 : 2);
    group.appendChild(rect);

    if (isArmed) {
      const aura = document.createElementNS(svgNS, 'rect');
      aura.setAttribute('x', -4); aura.setAttribute('y', -4);
      aura.setAttribute('width', this.NODE_WIDTH + 8); aura.setAttribute('height', this.NODE_HEIGHT + 8);
      aura.setAttribute('rx', 18); aura.setAttribute('ry', 18);
      aura.setAttribute('fill', 'none'); aura.setAttribute('stroke', '#38bdf8');
      aura.setAttribute('stroke-width', '1.5'); aura.setAttribute('stroke-dasharray', '4 4');
      aura.setAttribute('opacity', '0.7');
      group.appendChild(aura);
    }

    const typeLabel = document.createElementNS(svgNS, 'text');
    typeLabel.setAttribute('x', 16); typeLabel.setAttribute('y', 26);
    typeLabel.setAttribute('fill', type.color); typeLabel.setAttribute('font-size', '10'); typeLabel.setAttribute('font-weight', '900');
    typeLabel.textContent = type.label.toUpperCase();
    group.appendChild(typeLabel);

    const nameText = document.createElementNS(svgNS, 'text');
    nameText.setAttribute('x', 16); nameText.setAttribute('y', 52);
    nameText.setAttribute('fill', '#ffffff'); nameText.setAttribute('font-size', '14'); nameText.setAttribute('font-weight', '800');
    nameText.textContent = (node.name || 'Sem nome').slice(0, 22);
    group.appendChild(nameText);

    // Botão lixeira (canto superior direito)
    const trash = document.createElementNS(svgNS, 'g');
    trash.setAttribute('transform', `translate(${this.NODE_WIDTH - 26}, 6)`);
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
    stats.setAttribute('x', 16); stats.setAttribute('y', 72);
    stats.setAttribute('fill', '#94a3b8'); stats.setAttribute('font-size', '10');
    stats.textContent = outgoing > 0 ? `${outgoing} ${outgoing === 1 ? 'saída' : 'saídas'}` : 'sem saídas';
    group.appendChild(stats);

    // Porta de entrada (esquerda) — cresce se OUTRA ação está armed (afordância de destino)
    const inputPort = document.createElementNS(svgNS, 'circle');
    inputPort.setAttribute('cx', 0); inputPort.setAttribute('cy', this.NODE_HEIGHT / 2);
    inputPort.setAttribute('r', otherArmed ? 12 : 7);
    inputPort.setAttribute('fill', otherArmed ? '#34d399' : '#10b981');
    inputPort.setAttribute('stroke', '#0b1325'); inputPort.setAttribute('stroke-width', 2);
    inputPort.setAttribute('class', 'flow-port-input');
    inputPort.dataset.nodeId = String(node.id);
    inputPort.style.cursor = 'crosshair';
    group.appendChild(inputPort);

    // Porta de saída (direita) — cresce se ESTE node está armed
    const outputPort = document.createElementNS(svgNS, 'circle');
    outputPort.setAttribute('cx', this.NODE_WIDTH); outputPort.setAttribute('cy', this.NODE_HEIGHT / 2);
    outputPort.setAttribute('r', isArmed ? 11 : 7);
    outputPort.setAttribute('fill', isArmed ? '#38bdf8' : '#10b981');
    outputPort.setAttribute('stroke', '#0b1325'); outputPort.setAttribute('stroke-width', 2);
    outputPort.setAttribute('class', 'flow-port-output');
    outputPort.dataset.nodeId = String(node.id);
    outputPort.style.cursor = 'crosshair';
    group.appendChild(outputPort);

    this._renderConnButton(svgNS, group, node, isArmed, outgoing);

    parent.appendChild(group);
  },

  _renderConnButton(svgNS, group, node, isArmed, outgoing) {
    let fill, stroke, textFill, label;
    if (isArmed) { fill = 'rgba(56,189,248,0.30)'; stroke = '#38bdf8'; textFill = '#e0f2fe'; label = 'Conectando...'; }
    else if (outgoing > 0) { fill = 'rgba(16,185,129,0.20)'; stroke = '#34d399'; textFill = '#a7f3d0'; label = `Conectada (${outgoing})`; }
    else { fill = 'rgba(255,255,255,0.06)'; stroke = '#475569'; textFill = '#cbd5e1'; label = 'Conexão'; }
    const btnY = this.NODE_HEIGHT - 30;
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
    // Hover state (bug 7) — listener pra clarear o fill
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

  _attachSvgListeners(svg) {
    const self = this;
    svg.addEventListener('mousedown', (event) => self._onMouseDown(event, svg));
    svg.addEventListener('mousemove', (event) => self._onMouseMove(event, svg));
    svg.addEventListener('mouseup', (event) => self._onMouseUp(event, svg));
    // Bug 4 corrigido: mouseleave remove TAMBÉM a linha amarela fantasma
    svg.addEventListener('mouseleave', () => {
      self._internal.dragNode = null;
      self._internal.pendingConnection = null;
      const overlay = svg.querySelector('#flowPendingEdge');
      if (overlay) overlay.remove();
    });
  },

  _svgPoint(svg, event) {
    const pt = svg.createSVGPoint();
    pt.x = event.clientX; pt.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const transformed = pt.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  },

  _onMouseDown(event, svg) {
    const target = event.target;
    if (target.closest && target.closest('.flow-no-drag')) return;
    const armedId = App.state.flowBuilderConnectionArm;
    if (target.classList?.contains('flow-port-output')) {
      const outId = target.dataset.nodeId;
      // Bug 1+3 corrigidos: feedback claro em TODOS os casos
      if (armedId && String(armedId) === String(outId)) {
        this._internal.pendingConnection = { fromId: outId };
        event.preventDefault();
        return;
      }
      if (!armedId) {
        Utils.toast('Arme a conexão clicando em "Conexão" no bloco primeiro.');
        return;
      }
      // armedId existe MAS é de outro bloco → bug 3 corrigido
      Utils.toast('Outro bloco está armado. Use a porta de saída dele ou clique de novo em "Conexão" pra desarmar.');
      return;
    }
    const group = target.closest('g[data-node-id]');
    if (!group) return;
    const nodeId = group.dataset.nodeId;
    if (armedId && String(armedId) === String(nodeId)) return; // bloco armado fica imóvel
    const node = (App.state.flowBuilderNodes || []).find(n => String(n.id) === String(nodeId));
    if (!node) return;
    const point = this._svgPoint(svg, event);
    this._internal.dragNode = {
      nodeId,
      offsetX: point.x - node.x,
      offsetY: point.y - node.y
    };
    group.style.cursor = 'grabbing';
  },

  _onMouseMove(event, svg) {
    const point = this._svgPoint(svg, event);
    if (this._internal.pendingConnection) {
      const overlay = svg.querySelector('#flowPendingEdge');
      if (overlay) overlay.remove();
      const fromNode = (App.state.flowBuilderNodes || []).find(n => String(n.id) === String(this._internal.pendingConnection.fromId));
      if (!fromNode) return;
      const fromPort = this._outputPort(fromNode);
      const svgNS = 'http://www.w3.org/2000/svg';
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('id', 'flowPendingEdge');
      path.setAttribute('d', this._edgePath(fromPort.x, fromPort.y, point.x, point.y));
      path.setAttribute('stroke', '#fbbf24');
      path.setAttribute('stroke-width', '3');
      path.setAttribute('stroke-dasharray', '6 4');
      path.setAttribute('fill', 'none');
      svg.querySelector('#flowEdgesLayer')?.appendChild(path);
      return;
    }
    if (!this._internal.dragNode) return;
    const drag = this._internal.dragNode;
    const newX = Math.max(0, point.x - drag.offsetX);
    const newY = Math.max(0, point.y - drag.offsetY);
    // Atualiza posição em memória SEM render — só move o SVG group inline.
    const node = (App.state.flowBuilderNodes || []).find(n => String(n.id) === String(drag.nodeId));
    if (node) { node.x = Math.round(newX); node.y = Math.round(newY); }
    const group = svg.querySelector(`g[data-node-id="${drag.nodeId}"]`);
    if (group) group.setAttribute('transform', `translate(${Math.round(newX)}, ${Math.round(newY)})`);
    this._redrawAllEdges(svg);
  },

  // Bug 6 corrigido: usa a MESMA helper _renderEdge do desenho principal,
  // assim cor + hit area + estilo ficam idênticos durante drag e estático.
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
      // Bug 2 corrigido: cancela SEMPRE, independente de ter caído numa porta válida.
      Actions.cancelFlowBuilderConnection();
      return;
    }
    if (this._internal.dragNode) {
      const group = svg.querySelector(`g[data-node-id="${this._internal.dragNode.nodeId}"]`);
      if (group) group.style.cursor = 'grab';
      this._internal.dragNode = null;
      App.save();
    }
  }
};
