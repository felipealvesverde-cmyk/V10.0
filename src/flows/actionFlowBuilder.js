// V39.9.0 — Flow Builder com Esteira do LJ
// Forma alternativa de criar a esteira Produto→Campanha→Ação→Execução visualmente.
// Builder cria entidades reais do LJ; aparecem nas abas Produtos, Campanhas, Ações,
// Execuções normalmente. Auxiliares (Email/SDR/WhatsApp/etc) ficam como rascunho
// visual — não geram nada ao salvar.
//
// State próprio (`flowBuilderNodes` + `flowBuilderEdges`). Cada bloco da Esteira
// tem `data` (campos específicos do tipo) e `linkedRealId` (null antes do save,
// id real depois). Re-saves não duplicam.
window.ActionFlowBuilder = {
  NODE_WIDTH: 200,
  NODE_HEIGHT: 110,

  ESTEIRA_TYPES: [
    { id: 'produto',   label: 'Produto',   icon: 'package',   color: '#a855f7', hierarchy: 1 },
    { id: 'campanha',  label: 'Campanha',  icon: 'megaphone', color: '#06b6d4', hierarchy: 2 },
    { id: 'acao',      label: 'Ação',      icon: 'zap',       color: '#f59e0b', hierarchy: 3 },
    { id: 'execucao',  label: 'Execução',  icon: 'play',      color: '#10b981', hierarchy: 4 }
  ],

  AUXILIAR_TYPES: [
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

  typeById(id) {
    return this.ESTEIRA_TYPES.find(t => t.id === id)
      || this.AUXILIAR_TYPES.find(t => t.id === id)
      || this.AUXILIAR_TYPES[this.AUXILIAR_TYPES.length - 1];
  },

  isEsteira(typeId) { return this.ESTEIRA_TYPES.some(t => t.id === typeId); },

  genId() { return `n_${Date.now()}_${Math.floor(Math.random() * 100000)}`; },

  // Default `data` por tipo da Esteira (campos mínimos)
  defaultData(typeId) {
    switch (typeId) {
      case 'produto':  return { name: '', revenueModel: 'Venda única', type: '', price: '' };
      case 'campanha': return { name: '', sector: 'Marketing', objective: '' };
      case 'acao':     return { name: '', sector: 'Marketing', funnel: 'MOF', objective: '' };
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
        <div class="p-6 grid grid-cols-[minmax(0,1fr)_300px] gap-5">
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
        ${this._loadCampaignModal()}
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
        <li>• <b>Esteira:</b> Produto · Campanha · Ação · Execução. Quando salvar, essas entidades viram reais nas abas do LJ.</li>
        <li>• <b>Auxiliares:</b> Email, SDR, WhatsApp, Webinar, LP, Checkout, CRM, CS, Canal, Custom. Servem só pra rascunho visual — não geram nada ao salvar.</li>
        <li>• <b>Adicionar bloco:</b> clique num tipo na paleta direita. Esteira abre modal automático pedindo nome + campos do tipo.</li>
        <li>• <b>Conectar:</b> Produto → Campanha → Ação → Execução. Clique em <b>Conexão</b> no bloco de origem → arraste da porta de saída até a porta de entrada do bloco de destino.</li>
        <li>• <b>Editar bloco:</b> duplo clique no bloco abre modal com os campos do tipo.</li>
        <li>• <b>Carregar campanha existente:</b> botão azul no header. Importa Produto + Campanha + Ações + Execuções daquela campanha pra editar.</li>
        <li>• <b>Salvar:</b> botão verde no header. Cria Produto/Campanha/Ação/Execução reais a partir dos blocos da esteira. Blocos já salvos (com vínculo cravado) não são duplicados.</li>
        <li>• <b>Limpar:</b> apaga tudo do canvas (não desfaz o que já foi salvo nas abas do LJ).</li>
      </ul>
    </div>`;
  },

  _emptyCanvasHint() {
    const nodes = App.state.flowBuilderNodes || [];
    if (nodes.length) return '';
    return `<div class="absolute inset-0 grid place-items-center text-center p-6 pointer-events-none">
      <div class="max-w-md">
        <i data-lucide="git-merge" class="w-8 h-8 text-indigo-300 mx-auto mb-3"></i>
        <p class="text-sm text-slate-300">Canvas vazio. Clique em <b>Produto</b> na paleta pra começar uma esteira nova, ou em <b>Carregar campanha</b> no header pra continuar uma existente.</p>
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
    const esteiraItems = this.ESTEIRA_TYPES.map(t => this._paletteItem(t, true)).join('');
    const auxItems = this.AUXILIAR_TYPES.map(t => this._paletteItem(t, false)).join('');
    return `<aside class="rounded-3xl border border-white/10 bg-white/[0.055] p-4 max-h-[78vh] overflow-auto space-y-5">
      <section>
        <h3 class="font-black text-sm uppercase tracking-wider text-emerald-300 mb-1 flex items-center gap-1.5"><i data-lucide="layers" class="w-3.5 h-3.5"></i> Esteira</h3>
        <p class="text-xs text-slate-400 mb-2">Vira Produto/Campanha/Ação/Execução real ao salvar.</p>
        <div class="space-y-2">${esteiraItems}</div>
      </section>
      <section>
        <h3 class="font-black text-sm uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5"><i data-lucide="sticky-note" class="w-3.5 h-3.5"></i> Auxiliares</h3>
        <p class="text-xs text-slate-400 mb-2">Só rascunho visual — não geram entidade ao salvar.</p>
        <div class="space-y-2">${auxItems}</div>
      </section>
    </aside>`;
  },

  _paletteItem(t, isEsteira) {
    const borderAccent = isEsteira ? `border-left: 4px solid ${t.color};` : `border-left: 3px solid ${t.color};`;
    return `<button onclick="Actions.addFlowBuilderNode('${t.id}')" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.10] border border-white/10 text-white text-left transition" style="${borderAccent}">
      <span class="w-7 h-7 rounded-lg grid place-items-center" style="background:${t.color}22;color:${t.color};"><i data-lucide="${t.icon}" class="w-3.5 h-3.5"></i></span>
      <span class="text-sm font-black flex-1">${Utils.escape(t.label)}</span>
      <i data-lucide="plus" class="w-3.5 h-3.5 text-slate-400"></i>
    </button>`;
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
        <p class="text-xs text-slate-400 mb-4">Tipo: <span style="color:${type.color}">${Utils.escape(type.label)}</span>${isEsteira ? ' · vira entidade real ao salvar' : ' · só rascunho visual'}</p>
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
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider mt-3 block">Setor</label>
        <select onchange="Actions.updateFlowBuilderEditNodeField('sector', this.value)" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm">
          <option value="Marketing" ${draft.sector === 'Marketing' ? 'selected' : ''}>Marketing</option>
          <option value="Vendas" ${draft.sector === 'Vendas' ? 'selected' : ''}>Vendas</option>
          <option value="CS" ${draft.sector === 'CS' ? 'selected' : ''}>CS</option>
        </select>
        <label class="text-[11px] font-black text-slate-400 uppercase tracking-wider mt-3 block">Objetivo (opcional)</label>
        <textarea oninput="Actions.updateFlowBuilderEditNodeField('objective', this.value)" rows="2" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white font-semibold text-sm" placeholder="O que a campanha visa entregar...">${v('objective')}</textarea>`;
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
        <p class="text-sm text-slate-300 mb-4">Vão ser removidos <b>${n}</b> blocos e <b>${e}</b> conexões do canvas. <span class="text-amber-300">O que já foi salvo nas abas do LJ não é desfeito</span> — só limpa o desenho.</p>
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
      const input = document.getElementById('flowBuilderEditNodeInput');
      if (input) { input.focus(); input.select(); }
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
    if (!nodes.length) return;
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
    const isEsteira = this.isEsteira(node.type);
    const linked = isEsteira && !!node.linkedRealId;
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
    rect.setAttribute('stroke-width', isEsteira ? (isArmed ? 3 : 2.5) : (isArmed ? 3 : 2));
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

    // Badge "salvo" se for esteira já vinculada
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
    typeLabel.setAttribute('x', 16); typeLabel.setAttribute('y', 26);
    typeLabel.setAttribute('fill', type.color); typeLabel.setAttribute('font-size', '10'); typeLabel.setAttribute('font-weight', '900');
    typeLabel.textContent = type.label.toUpperCase();
    group.appendChild(typeLabel);

    const displayName = (node.data?.name || node.name || 'Sem nome').slice(0, 22);
    const nameText = document.createElementNS(svgNS, 'text');
    nameText.setAttribute('x', 16); nameText.setAttribute('y', 52);
    nameText.setAttribute('fill', '#ffffff'); nameText.setAttribute('font-size', '14'); nameText.setAttribute('font-weight', '800');
    nameText.textContent = displayName;
    group.appendChild(nameText);

    // Botão remover (×) — canto superior direito
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
    // Se tem badge "salvo", empurra o × pra esquerda
    if (linked) trash.setAttribute('transform', `translate(${this.NODE_WIDTH - 84}, 6)`);
    group.appendChild(trash);

    const outgoing = edges.filter(e => e.fromId === node.id).length;
    const stats = document.createElementNS(svgNS, 'text');
    stats.setAttribute('x', 16); stats.setAttribute('y', 72);
    stats.setAttribute('fill', '#94a3b8'); stats.setAttribute('font-size', '10');
    stats.textContent = outgoing > 0 ? `${outgoing} ${outgoing === 1 ? 'saída' : 'saídas'}` : 'sem saídas';
    group.appendChild(stats);

    const inputPort = document.createElementNS(svgNS, 'circle');
    inputPort.setAttribute('cx', 0); inputPort.setAttribute('cy', this.NODE_HEIGHT / 2);
    inputPort.setAttribute('r', otherArmed ? 12 : 7);
    inputPort.setAttribute('fill', otherArmed ? '#34d399' : '#10b981');
    inputPort.setAttribute('stroke', '#0b1325'); inputPort.setAttribute('stroke-width', 2);
    inputPort.setAttribute('class', 'flow-port-input');
    inputPort.dataset.nodeId = String(node.id);
    inputPort.style.cursor = 'crosshair';
    group.appendChild(inputPort);

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
    if (!group) return;
    const nodeId = group.dataset.nodeId;
    if (armedId && String(armedId) === String(nodeId)) return;
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
  }
};
