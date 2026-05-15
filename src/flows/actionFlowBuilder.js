// V15.1 — Action Flow Builder (v2)
// Canvas SVG com drag-and-drop puro + estados de conexão por card +
// modal de confirmação para desconectar + zoom in/out + filtro por etapa
// inicial + ajuda contextual. Sem libs externas.
window.ActionFlowBuilder = {
  _state: { campaignId: null, container: null, dragNode: null, pendingConnection: null },

  render(campaignId) {
    if (!App.state.showFlowBuilderModal) return '';
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    if (!campaign) return '';
    const actions = (App.state.actions || []).filter(a => Number(a.campaignId) === Number(campaignId));
    this._state.campaignId = Number(campaignId);
    const zoom = Number(App.state.flowBuilderZoom || 1.0);
    return `<div class="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-sm p-4 overflow-auto grid place-items-start justify-items-center">
      <div class="rounded-[2rem] overflow-hidden shadow-2xl text-white" style="width:90vw;max-width:none;background: radial-gradient(circle at 18% 10%, rgba(99,102,241,.22), transparent 30%), #071326;">
        ${this._header(campaign, zoom)}
        ${App.state.flowBuilderShowHelp ? this._helpPanel() : ''}
        <div class="p-6 grid grid-cols-[minmax(0,1fr)_340px] gap-5">
          <div class="relative min-w-0">
            ${this._zoomControls(zoom)}
            <div id="flowBuilderCanvas" ondragover="ActionFlowBuilder._handleCanvasDragOver(event)" ondrop="ActionFlowBuilder._handleCanvasDrop(event)" class="relative rounded-3xl border border-white/10 bg-white/[0.04] min-h-[70vh] max-h-[78vh] overflow-auto min-w-0">
              ${this._emptyCanvasHint(actions)}
            </div>
          </div>
          ${this._sidebar(actions)}
        </div>
        ${this._disconnectModal(actions)}
      </div>
    </div>`;
  },

  _header(campaign, zoom) {
    return `<header class="p-6 border-b border-white/10 flex items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-2"><i data-lucide="git-merge" class="w-4 h-4 text-indigo-300"></i><p class="text-xs font-black text-slate-300 uppercase tracking-wider">Revenue Flow Builder</p></div>
        <h2 class="text-2xl font-black">Fluxo da campanha: ${Utils.escape(campaign.name)}</h2>
        <p class="text-sm text-slate-300 mt-1">Ligue o botão <b>Conexão</b> num card para travar e puxar uma linha verde até a porta de outra ação.</p>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="Actions.toggleFlowBuilderHelp()" title="Como funciona" class="px-3 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-black flex items-center gap-1"><i data-lucide="help-circle" class="w-3.5 h-3.5"></i> Ajuda</button>
        <button onclick="Actions.closeFlowBuilder()" class="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-semibold flex items-center gap-2"><i data-lucide="x" class="w-4 h-4"></i> Fechar</button>
      </div>
    </header>`;
  },

  _helpPanel() {
    return `<div class="mx-6 mt-4 rounded-2xl bg-indigo-500/15 border border-indigo-400/30 p-4 text-sm text-indigo-100">
      <div class="flex items-start justify-between gap-3 mb-2"><p class="font-black">Como funciona o Flow Builder</p><button onclick="Actions.toggleFlowBuilderHelp()" class="text-indigo-200 text-xs font-black">×</button></div>
      <ul class="space-y-1 text-xs">
        <li>• <b>Adicionar ao fluxo:</b> clique em "Ativar" no card direito. A ação aparece no canvas.</li>
        <li>• <b>Remover do fluxo:</b> clique em "Desativar" no card. A ação some do canvas.</li>
        <li>• <b>Conectar:</b> clique no botão <b>Conexão</b> do card de origem (fica azul) → o card no canvas trava e a porta verde fica maior → arraste uma linha até a porta de outra ação.</li>
        <li>• <b>Estados do botão Conexão:</b> cinza (desligado) · azul (armado) · amarelo (conectando) · verde (conectado).</li>
        <li>• <b>Desconectar:</b> clique numa linha. Um modal pergunta se você confirma a remoção.</li>
        <li>• <b>Zoom:</b> botões + e − no topo do canvas (10% por clique). 0 reseta.</li>
        <li>• <b>Mover card:</b> arraste pelo corpo do card (não pelas portas).</li>
      </ul>
    </div>`;
  },

  _emptyCanvasHint(actions) {
    const enabled = (actions || []).filter(a => a.flow?.enabled);
    if (enabled.length) return '';
    const total = (actions || []).length;
    const msg = total === 0
      ? 'Esta campanha ainda não tem ações. Crie uma ação na aba "Ações" e volte aqui.'
      : 'Nenhuma ação está no fluxo ainda. Clique em <b>Ativar</b> num card do painel à direita para trazê-lo ao canvas.';
    return `<div class="absolute inset-0 grid place-items-center text-center p-6 pointer-events-none">
      <div class="max-w-md">
        <i data-lucide="git-merge" class="w-8 h-8 text-indigo-300 mx-auto mb-3"></i>
        <p class="text-sm text-slate-300">${msg}</p>
      </div>
    </div>`;
  },

  _zoomControls(zoom) {
    return `<div class="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-2xl bg-slate-950/80 border border-white/10 p-1">
      <button onclick="Actions.setFlowBuilderZoom(-0.1)" title="Diminuir zoom" class="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 text-white font-black"><i data-lucide="minus" class="w-3.5 h-3.5 mx-auto"></i></button>
      <button onclick="Actions.resetFlowBuilderZoom()" title="Resetar zoom" class="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-[11px] font-black">${Math.round(zoom * 100)}%</button>
      <button onclick="Actions.setFlowBuilderZoom(0.1)" title="Aumentar zoom" class="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 text-white font-black"><i data-lucide="plus" class="w-3.5 h-3.5 mx-auto"></i></button>
    </div>`;
  },

  _sidebar(actions) {
    const startFilter = App.state.flowBuilderStartFilter || 'all';
    const stages = window.FlowEngine ? FlowEngine.STAGE_PRESETS : [];
    return `<aside class="rounded-3xl border border-white/10 bg-white/[0.055] p-4 max-h-[78vh] overflow-auto">
      <h3 class="font-black text-sm uppercase tracking-wider text-slate-300 mb-2">Ações da campanha</h3>
      <p class="text-xs text-slate-400 mb-3">Arraste o card para o canvas ou clique em <b>Ativar</b>.</p>
      <select onchange="Actions.setFlowBuilderStartFilter(this.value)" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/20 text-white text-xs font-bold mb-3" style="color-scheme: dark;">
        <option value="all" ${startFilter === 'all' ? 'selected' : ''} class="bg-slate-900">Todas as etapas</option>
        ${stages.map(s => `<option value="${s.id}" ${startFilter === s.id ? 'selected' : ''} class="bg-slate-900">${Utils.escape(s.label)}</option>`).join('')}
      </select>
      <div class="space-y-2">${this._filteredSidebarActions(actions, startFilter)}</div>
    </aside>`;
  },

  _filteredSidebarActions(actions, startFilter) {
    let list = actions;
    if (startFilter !== 'all') {
      list = actions.filter(a => {
        const stage = a.flow?.startStage || (window.FlowEngine ? FlowEngine._stageIdFromLegacy(a.originSector || a.sector, a.originFunnel || a.funnel) : null);
        return stage === startFilter;
      });
    }
    if (!list.length) return '<p class="text-xs text-slate-400">Nenhuma ação nesta etapa.</p>';
    return list.map(a => this._sidebarItem(a)).join('');
  },

  _sidebarItem(action) {
    const enriched = FlowEngine.ensureActionFlow(action);
    const type = FlowEngine.actionTypeById(enriched.flow.flowActionType);
    const start = FlowEngine.stageById(enriched.flow.startStage);
    const end = FlowEngine.stageById(enriched.flow.endStage);
    const enabled = enriched.flow.enabled;
    const armed = Number(App.state.flowBuilderConnectionArm) === Number(action.id);
    const hasConnections = (enriched.flow.nextActions || []).length > 0;
    let connBtnClass, connBtnLabel;
    if (!enabled) { connBtnClass = 'bg-slate-700/40 text-slate-500 border-slate-600/30 cursor-not-allowed'; connBtnLabel = '— inativo —'; }
    else if (armed) { connBtnClass = 'bg-sky-500/30 text-sky-100 border-sky-400/50'; connBtnLabel = 'Armado: arraste a linha'; }
    else if (hasConnections) { connBtnClass = 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'; connBtnLabel = `Conectada (${enriched.flow.nextActions.length})`; }
    else { connBtnClass = 'bg-white/5 text-slate-300 border-white/15 hover:bg-white/10'; connBtnLabel = 'Conexão'; }
    return `<div draggable="${enabled ? 'false' : 'true'}" ondragstart="ActionFlowBuilder._handleSidebarDragStart(event, ${action.id})" class="rounded-2xl border ${armed ? 'border-sky-400/60' : 'border-white/10'} bg-black/30 p-3 ${enabled ? '' : 'cursor-grab active:cursor-grabbing'}" title="${enabled ? '' : 'Arraste para o canvas ou clique em Ativar'}">
      <div class="flex items-center justify-between gap-2 mb-2">
        <div class="flex items-center gap-2 min-w-0"><i data-lucide="${type.icon}" class="w-3.5 h-3.5 text-indigo-300 shrink-0"></i><p class="text-sm font-black text-white truncate">${Utils.escape(action.name || 'Ação')}</p></div>
        <button draggable="false" onclick="Actions.toggleFlowEnabled(${action.id})" class="text-[10px] font-black px-2 py-1 rounded-lg ${enabled ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30' : 'bg-slate-700/40 text-slate-400 border border-slate-600/30'}">${enabled ? 'Ativa' : 'Ativar'}</button>
      </div>
      <p class="text-[11px] text-slate-400 mb-2">${Utils.escape(type.label)} • ${Utils.escape(start.label)} → ${Utils.escape(end.label)}</p>
      <button draggable="false" onclick="${enabled ? `Actions.armFlowConnection(${action.id})` : 'Utils.toast(\"Ative a ação antes de conectar.\")'}" ${enabled ? '' : 'disabled'} class="w-full px-2 py-1.5 rounded-lg text-[11px] font-black border ${connBtnClass} flex items-center justify-center gap-1.5">
        <span class="w-2 h-2 rounded-full ${armed ? 'bg-sky-300' : (hasConnections ? 'bg-emerald-300' : (enabled ? 'bg-slate-400' : 'bg-slate-600'))}"></span>
        ${Utils.escape(connBtnLabel)}
      </button>
    </div>`;
  },

  _disconnectModal(actions) {
    const pending = App.state.flowDisconnectConfirm;
    if (!pending) return '';
    const from = actions.find(a => Number(a.id) === Number(pending.fromId));
    const to = actions.find(a => Number(a.id) === Number(pending.toId));
    return `<div class="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm grid place-items-center p-4">
      <div class="bg-slate-900 border border-white/10 rounded-3xl p-6 w-full max-w-md text-white">
        <h3 class="text-xl font-black mb-2">Desconectar ações?</h3>
        <p class="text-sm text-slate-300 mb-4">Isso vai remover o vínculo de fluxo entre <b>${Utils.escape(from?.name || '?')}</b> e <b>${Utils.escape(to?.name || '?')}</b>. Para refazer, será preciso armar a conexão novamente.</p>
        <div class="flex justify-end gap-2">
          <button onclick="Actions.cancelFlowDisconnect()" class="px-4 py-3 rounded-2xl bg-white/10 border border-white/15 text-white font-black">Cancelar</button>
          <button onclick="Actions.confirmFlowDisconnect()" class="px-4 py-3 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-black">Confirmar desconexão</button>
        </div>
      </div>
    </div>`;
  },

  _handleSidebarDragStart(event, actionId) {
    if (!event?.dataTransfer) return;
    event.dataTransfer.setData('text/plain', String(actionId));
    event.dataTransfer.effectAllowed = 'copy';
  },

  _handleCanvasDragOver(event) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  },

  _handleCanvasDrop(event) {
    event.preventDefault();
    const raw = event.dataTransfer?.getData('text/plain');
    const actionId = Number(raw);
    if (!actionId) return;
    const canvas = document.getElementById('flowBuilderCanvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const zoom = Number(App.state.flowBuilderZoom || 1.0) || 1.0;
    const dropX = (event.clientX - rect.left + canvas.scrollLeft) / zoom;
    const dropY = (event.clientY - rect.top + canvas.scrollTop) / zoom;
    const nodeW = (window.FlowRenderer?.NODE_WIDTH || 200);
    const nodeH = (window.FlowRenderer?.NODE_HEIGHT || 110);
    const x = Math.max(0, Math.round(dropX - nodeW / 2));
    const y = Math.max(0, Math.round(dropY - nodeH / 2));
    if (window.Actions?.dropActionToFlowCanvas) Actions.dropActionToFlowCanvas(actionId, x, y);
  },

  attach() {
    const root = document.getElementById('flowBuilderCanvas');
    if (!root) return;
    this._state.container = root;
    this._drawCanvas();
  },

  _drawCanvas() {
    const root = this._state.container;
    if (!root) return;
    const campaignId = this._state.campaignId;
    const actions = (App.state.actions || []).filter(a => Number(a.campaignId) === Number(campaignId) && a.flow?.enabled);
    if (!actions.length) return; // preserva o hint estático renderizado em _emptyCanvasHint
    const enriched = actions.map(a => FlowEngine.ensureActionFlow(a));
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

    const edgesLayer = document.createElementNS(svgNS, 'g');
    edgesLayer.setAttribute('id', 'flowEdgesLayer');
    svg.appendChild(edgesLayer);
    for (const action of enriched) {
      for (const nextId of (action.flow.nextActions || [])) {
        const target = enriched.find(a => Number(a.id) === Number(nextId));
        if (!target) continue;
        const fromPort = this._outputPort(action.flow.position);
        const toPort = this._inputPort(target.flow.position);
        const edgeMetrics = FlowConversionEngine.edgeMetrics(action, target);
        const stroke = FlowRenderer.edgeStrokeForPassRate(edgeMetrics?.passRate || 0);
        const hitArea = document.createElementNS(svgNS, 'path');
        hitArea.setAttribute('d', FlowRenderer.edgePath(fromPort.x, fromPort.y, toPort.x, toPort.y));
        hitArea.setAttribute('stroke', 'transparent');
        hitArea.setAttribute('stroke-width', '14');
        hitArea.setAttribute('fill', 'none');
        hitArea.style.cursor = 'pointer';
        hitArea.addEventListener('click', (event) => {
          event.stopPropagation();
          Actions.requestFlowDisconnect(action.id, nextId);
        });
        edgesLayer.appendChild(hitArea);
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', FlowRenderer.edgePath(fromPort.x, fromPort.y, toPort.x, toPort.y));
        path.setAttribute('stroke', stroke);
        path.setAttribute('stroke-width', '2.5');
        path.setAttribute('fill', 'none');
        path.style.pointerEvents = 'none';
        edgesLayer.appendChild(path);
        const labelX = (fromPort.x + toPort.x) / 2;
        const labelY = (fromPort.y + toPort.y) / 2;
        const labelBg = document.createElementNS(svgNS, 'rect');
        labelBg.setAttribute('x', labelX - 22); labelBg.setAttribute('y', labelY - 16);
        labelBg.setAttribute('width', 44); labelBg.setAttribute('height', 16);
        labelBg.setAttribute('rx', 8); labelBg.setAttribute('fill', '#0b1325');
        labelBg.setAttribute('stroke', stroke); labelBg.setAttribute('stroke-width', '1');
        labelBg.style.pointerEvents = 'none';
        edgesLayer.appendChild(labelBg);
        const label = document.createElementNS(svgNS, 'text');
        label.setAttribute('x', labelX); label.setAttribute('y', labelY - 4);
        label.setAttribute('fill', stroke); label.setAttribute('font-size', '10'); label.setAttribute('font-weight', '900');
        label.setAttribute('text-anchor', 'middle'); label.textContent = `${Math.round(edgeMetrics?.passRate || 0)}%`;
        label.style.pointerEvents = 'none';
        edgesLayer.appendChild(label);
      }
    }

    const nodesLayer = document.createElementNS(svgNS, 'g');
    nodesLayer.setAttribute('id', 'flowNodesLayer');
    svg.appendChild(nodesLayer);
    for (const action of enriched) this._renderNode(svgNS, nodesLayer, action, armedId);

    root.appendChild(svg);
    this._attachSvgListeners(svg);
  },

  _inputPort(position) { return { x: position.x, y: position.y + FlowRenderer.NODE_HEIGHT / 2 }; },
  _outputPort(position) { return { x: position.x + FlowRenderer.NODE_WIDTH, y: position.y + FlowRenderer.NODE_HEIGHT / 2 }; },

  _renderNode(svgNS, parent, action, armedId) {
    const pos = action.flow.position;
    const colors = FlowRenderer.nodeColor(action);
    const isArmed = Number(armedId) === Number(action.id);
    const group = document.createElementNS(svgNS, 'g');
    group.setAttribute('transform', `translate(${pos.x}, ${pos.y})`);
    group.dataset.actionId = String(action.id);
    group.style.cursor = isArmed ? 'not-allowed' : 'grab';

    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', 0); rect.setAttribute('y', 0);
    rect.setAttribute('width', FlowRenderer.NODE_WIDTH); rect.setAttribute('height', FlowRenderer.NODE_HEIGHT);
    rect.setAttribute('rx', 14); rect.setAttribute('ry', 14);
    rect.setAttribute('fill', '#0b1325');
    rect.setAttribute('stroke', isArmed ? '#38bdf8' : colors.stroke);
    rect.setAttribute('stroke-width', isArmed ? 3 : 2);
    group.appendChild(rect);

    if (isArmed) {
      const aura = document.createElementNS(svgNS, 'rect');
      aura.setAttribute('x', -4); aura.setAttribute('y', -4);
      aura.setAttribute('width', FlowRenderer.NODE_WIDTH + 8); aura.setAttribute('height', FlowRenderer.NODE_HEIGHT + 8);
      aura.setAttribute('rx', 18); aura.setAttribute('ry', 18);
      aura.setAttribute('fill', 'none'); aura.setAttribute('stroke', '#38bdf8');
      aura.setAttribute('stroke-width', '1.5'); aura.setAttribute('stroke-dasharray', '4 4');
      aura.setAttribute('opacity', '0.7');
      group.appendChild(aura);
    }

    const typeLabel = document.createElementNS(svgNS, 'text');
    typeLabel.setAttribute('x', 16); typeLabel.setAttribute('y', 26);
    typeLabel.setAttribute('fill', colors.stroke); typeLabel.setAttribute('font-size', '10'); typeLabel.setAttribute('font-weight', '900');
    typeLabel.textContent = colors.typeLabel;
    group.appendChild(typeLabel);

    const nameText = document.createElementNS(svgNS, 'text');
    nameText.setAttribute('x', 16); nameText.setAttribute('y', 52);
    nameText.setAttribute('fill', '#ffffff'); nameText.setAttribute('font-size', '14'); nameText.setAttribute('font-weight', '800');
    nameText.textContent = (action.name || 'Ação').slice(0, 22);
    group.appendChild(nameText);

    const start = FlowEngine.stageById(action.flow.startStage);
    const end = FlowEngine.stageById(action.flow.endStage);
    const sub = document.createElementNS(svgNS, 'text');
    sub.setAttribute('x', 16); sub.setAttribute('y', 72);
    sub.setAttribute('fill', '#94a3b8'); sub.setAttribute('font-size', '10');
    sub.textContent = `${start.label} → ${end.label}`;
    group.appendChild(sub);

    const metrics = FlowConversionEngine.actionMetrics(action);
    const stats = document.createElementNS(svgNS, 'text');
    stats.setAttribute('x', 16); stats.setAttribute('y', 92);
    stats.setAttribute('fill', '#cbd5e1'); stats.setAttribute('font-size', '10'); stats.setAttribute('font-weight', '700');
    stats.textContent = `${metrics.impacted}→${metrics.converted} • ${Math.round(metrics.conversionRate)}%`;
    group.appendChild(stats);

    const inputPort = document.createElementNS(svgNS, 'circle');
    inputPort.setAttribute('cx', 0); inputPort.setAttribute('cy', FlowRenderer.NODE_HEIGHT / 2);
    inputPort.setAttribute('r', isArmed && Number(armedId) !== Number(action.id) ? 10 : 7);
    inputPort.setAttribute('fill', '#10b981'); inputPort.setAttribute('stroke', '#0b1325'); inputPort.setAttribute('stroke-width', 2);
    inputPort.setAttribute('class', 'flow-port-input');
    inputPort.dataset.actionId = String(action.id);
    inputPort.style.cursor = 'crosshair';
    group.appendChild(inputPort);

    const outputRadius = isArmed ? 11 : 7;
    const outputPort = document.createElementNS(svgNS, 'circle');
    outputPort.setAttribute('cx', FlowRenderer.NODE_WIDTH); outputPort.setAttribute('cy', FlowRenderer.NODE_HEIGHT / 2);
    outputPort.setAttribute('r', outputRadius);
    outputPort.setAttribute('fill', isArmed ? '#38bdf8' : '#10b981');
    outputPort.setAttribute('stroke', '#0b1325'); outputPort.setAttribute('stroke-width', 2);
    outputPort.setAttribute('class', 'flow-port-output');
    outputPort.dataset.actionId = String(action.id);
    outputPort.style.cursor = 'crosshair';
    group.appendChild(outputPort);

    this._renderConnButton(svgNS, group, action, isArmed);

    parent.appendChild(group);
  },

  _renderConnButton(svgNS, group, action, isArmed) {
    const hasConn = (action.flow.nextActions || []).length > 0;
    let fill, stroke, textFill, label;
    if (isArmed) { fill = 'rgba(56,189,248,0.30)'; stroke = '#38bdf8'; textFill = '#e0f2fe'; label = 'Conectando...'; }
    else if (hasConn) { fill = 'rgba(16,185,129,0.20)'; stroke = '#34d399'; textFill = '#a7f3d0'; label = `Conectada (${action.flow.nextActions.length})`; }
    else { fill = 'rgba(255,255,255,0.06)'; stroke = '#475569'; textFill = '#cbd5e1'; label = 'Conexão'; }
    const btnY = FlowRenderer.NODE_HEIGHT - 30;
    const btnH = 22, btnX = 12, btnW = FlowRenderer.NODE_WIDTH - 24;
    const btn = document.createElementNS(svgNS, 'g');
    btn.setAttribute('transform', `translate(${btnX}, ${btnY})`);
    btn.setAttribute('class', 'flow-no-drag flow-conn-btn');
    btn.dataset.actionId = String(action.id);
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (window.Actions?.armFlowConnection) Actions.armFlowConnection(action.id);
    });
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('x', 0); rect.setAttribute('y', 0);
    rect.setAttribute('width', btnW); rect.setAttribute('height', btnH);
    rect.setAttribute('rx', 6); rect.setAttribute('ry', 6);
    rect.setAttribute('fill', fill); rect.setAttribute('stroke', stroke); rect.setAttribute('stroke-width', '1');
    btn.appendChild(rect);
    const dotR = 3.2;
    const dot = document.createElementNS(svgNS, 'circle');
    dot.setAttribute('cx', 14); dot.setAttribute('cy', btnH / 2); dot.setAttribute('r', dotR);
    dot.setAttribute('fill', isArmed ? '#7dd3fc' : (hasConn ? '#6ee7b7' : '#94a3b8'));
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
    svg.addEventListener('mouseleave', () => { self._state.dragNode = null; self._state.pendingConnection = null; });
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
      const outId = target.dataset.actionId;
      if (armedId && Number(armedId) === Number(outId)) {
        this._state.pendingConnection = { fromId: outId };
        event.preventDefault();
        return;
      }
      if (!armedId) {
        Utils.toast('Arme a conexão clicando em "Conexão" no card lateral primeiro.');
        return;
      }
    }
    const group = target.closest('g[data-action-id]');
    if (!group) return;
    const actionId = group.dataset.actionId;
    if (armedId && Number(armedId) === Number(actionId)) return; // card armado fica imóvel
    const action = FlowEngine.ensureActionFlow((App.state.actions || []).find(a => Number(a.id) === Number(actionId)));
    if (!action) return;
    const point = this._svgPoint(svg, event);
    this._state.dragNode = {
      actionId,
      offsetX: point.x - action.flow.position.x,
      offsetY: point.y - action.flow.position.y
    };
    group.style.cursor = 'grabbing';
  },

  _onMouseMove(event, svg) {
    const point = this._svgPoint(svg, event);
    if (this._state.pendingConnection) {
      const overlay = svg.querySelector('#flowPendingEdge');
      if (overlay) overlay.remove();
      const fromAction = FlowEngine.ensureActionFlow((App.state.actions || []).find(a => Number(a.id) === Number(this._state.pendingConnection.fromId)));
      if (!fromAction) return;
      const fromPort = this._outputPort(fromAction.flow.position);
      const svgNS = 'http://www.w3.org/2000/svg';
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('id', 'flowPendingEdge');
      path.setAttribute('d', FlowRenderer.edgePath(fromPort.x, fromPort.y, point.x, point.y));
      path.setAttribute('stroke', '#fbbf24');
      path.setAttribute('stroke-width', '3');
      path.setAttribute('stroke-dasharray', '6 4');
      path.setAttribute('fill', 'none');
      svg.querySelector('#flowEdgesLayer')?.appendChild(path);
      return;
    }
    if (!this._state.dragNode) return;
    const drag = this._state.dragNode;
    const newX = Math.max(0, point.x - drag.offsetX);
    const newY = Math.max(0, point.y - drag.offsetY);
    FlowConnectionEngine.setPosition(drag.actionId, newX, newY);
    const group = svg.querySelector(`g[data-action-id="${drag.actionId}"]`);
    if (group) group.setAttribute('transform', `translate(${newX}, ${newY})`);
    this._redrawAllEdges(svg);
  },

  _redrawAllEdges(svg) {
    const edgesLayer = svg.querySelector('#flowEdgesLayer');
    if (!edgesLayer) return;
    while (edgesLayer.firstChild) edgesLayer.removeChild(edgesLayer.firstChild);
    const actions = (App.state.actions || []).filter(a => Number(a.campaignId) === Number(this._state.campaignId) && a.flow?.enabled).map(a => FlowEngine.ensureActionFlow(a));
    const svgNS = 'http://www.w3.org/2000/svg';
    for (const action of actions) {
      for (const nextId of (action.flow.nextActions || [])) {
        const target = actions.find(a => Number(a.id) === Number(nextId));
        if (!target) continue;
        const fromPort = this._outputPort(action.flow.position);
        const toPort = this._inputPort(target.flow.position);
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', FlowRenderer.edgePath(fromPort.x, fromPort.y, toPort.x, toPort.y));
        path.setAttribute('stroke', '#a78bfa');
        path.setAttribute('stroke-width', '2.5');
        path.setAttribute('fill', 'none');
        edgesLayer.appendChild(path);
      }
    }
  },

  _onMouseUp(event, svg) {
    if (this._state.pendingConnection) {
      const target = event.target;
      const overlay = svg.querySelector('#flowPendingEdge');
      if (overlay) overlay.remove();
      if (target.classList?.contains('flow-port-input')) {
        const toId = target.dataset.actionId;
        const fromId = this._state.pendingConnection.fromId;
        Actions.connectFlow(fromId, toId);
        Actions.cancelFlowConnection();
      }
      this._state.pendingConnection = null;
      return;
    }
    if (this._state.dragNode) {
      const group = svg.querySelector(`g[data-action-id="${this._state.dragNode.actionId}"]`);
      if (group) group.style.cursor = 'grab';
      this._state.dragNode = null;
      App.save();
    }
  }
};
