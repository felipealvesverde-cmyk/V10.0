// V39.8.0 — Aba "Plugins". Catálogo de ferramentas avançadas que não fazem
// parte do fluxo principal Produto→Campanha→Ação. Cada plugin é um card que
// pode abrir modal/canvas/wizard próprio.
//
// Hoje hospeda só o "Flow Builder" (whitelabel V39.8.0 — sem vínculo com
// produto/campanha/ação). Card antigo tinha dropdown de campanha (V38.1.53);
// foi removido porque o builder se desvinculou completamente do domínio LJ.
var PluginsModule = {
  render() {
    return `<div class="space-y-4">
      ${this.headerLayer()}
      <div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
        <h2 class="text-xl font-black mb-1">Catálogo de plugins</h2>
        <p class="text-sm text-slate-500 mb-5">Ferramentas avançadas, fora do fluxo principal. Cada plugin abre seu próprio espaço de trabalho.</p>
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${this.pluginCardFlowBuilder()}
        </div>
      </div>
      ${window.ActionFlowBuilder ? ActionFlowBuilder.render() : ''}
    </div>`;
  },

  headerLayer() {
    return `<div class="bg-slate-950 text-white rounded-[2rem] p-5 shadow-sm overflow-hidden relative">
      <div class="absolute inset-0 opacity-60" style="background: radial-gradient(circle at 18% 10%, rgba(99,102,241,.22), transparent 30%), radial-gradient(circle at 82% 0%, rgba(168,62,216,.18), transparent 32%);"></div>
      <div class="relative z-10 grid lg:grid-cols-[1.2fr_1fr] gap-4 items-start">
        <div>
          <h2 class="text-3xl font-black">Plugins</h2>
          <p class="text-xs text-slate-400 mt-2">Ferramentas avançadas que estendem o LeadJourney além do fluxo padrão.</p>
        </div>
        <div class="grid grid-cols-1 gap-3">
          <div class="bg-white/10 border border-white/10 rounded-2xl p-4"><div class="flex items-center justify-between"><p class="text-xs font-black text-slate-300">Plugins disponíveis</p><i data-lucide="puzzle" class="w-4 h-4 text-slate-300"></i></div><div class="text-3xl font-black mt-2">1</div></div>
        </div>
      </div>
    </div>`;
  },

  pluginCardFlowBuilder() {
    const nodes = (App.state.flowBuilderNodes || []).length;
    const edges = (App.state.flowBuilderEdges || []).length;
    const subtitle = nodes
      ? `${nodes} ${nodes === 1 ? 'bloco' : 'blocos'} · ${edges} ${edges === 1 ? 'conexão' : 'conexões'}`
      : 'Canvas em branco — comece do zero';
    return `<div class="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-3" style="border-left: 4px solid #6366f1;">
      <div class="flex items-start gap-3">
        <div class="shrink-0 w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 grid place-items-center text-indigo-700"><i data-lucide="git-merge" class="w-5 h-5"></i></div>
        <div class="min-w-0 flex-1">
          <h3 class="font-black text-slate-900">Flow Builder</h3>
          <p class="text-xs text-slate-500 mt-0.5">Canvas drag-and-drop pra desenhar fluxos do zero. Sem vínculo com produto, campanha ou ação — ferramenta whitelabel.</p>
        </div>
      </div>
      <p class="text-[11px] font-black text-slate-500 uppercase tracking-wider">${subtitle}</p>
      <button onclick="Actions.openFlowBuilder()" class="w-full px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm flex items-center justify-center gap-2 lj-dark-button" style="color:#fff!important;"><i data-lucide="arrow-right" class="w-4 h-4"></i> Abrir Builder</button>
    </div>`;
  }
};
window.PluginsModule = PluginsModule;
