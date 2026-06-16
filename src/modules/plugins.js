// V38.1.53 — Aba "Plugins". Catálogo de ferramentas avançadas que não fazem
// parte do fluxo principal Produto→Campanha→Ação. Cada plugin é um card que
// pode abrir modal/canvas/wizard próprio. Por enquanto só hospeda o
// "Construir Fluxo de Ações" (ActionFlowBuilder V15.1) — migrado daqui
// do botão indigo do header de "Ações plugadas".
var PluginsModule = {
  render() {
    const campaigns = App.state.campaigns || [];
    const selectedId = Number(App.state.pluginsFlowBuilderCampaignId || campaigns[0]?.id || 0);
    return `<div class="space-y-4">
      ${this.headerLayer(campaigns.length)}
      <div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
        <h2 class="text-xl font-black mb-1">Catálogo de plugins</h2>
        <p class="text-sm text-slate-500 mb-5">Ferramentas avançadas, fora do fluxo principal. Cada plugin abre seu próprio espaço de trabalho.</p>
        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          ${this.pluginCardFlowBuilder(campaigns, selectedId)}
        </div>
      </div>
      ${window.ActionFlowBuilder ? ActionFlowBuilder.render(App.state.flowBuilderCampaignId) : ''}
    </div>`;
  },

  headerLayer(campaignsCount) {
    return `<div class="bg-slate-950 text-white rounded-[2rem] p-5 shadow-sm overflow-hidden relative">
      <div class="absolute inset-0 opacity-60" style="background: radial-gradient(circle at 18% 10%, rgba(99,102,241,.22), transparent 30%), radial-gradient(circle at 82% 0%, rgba(168,62,216,.18), transparent 32%);"></div>
      <div class="relative z-10 grid lg:grid-cols-[1.2fr_1fr] gap-4 items-start">
        <div>
          <h2 class="text-3xl font-black">Plugins</h2>
          <p class="text-xs text-slate-400 mt-2">Ferramentas avançadas que estendem o LeadJourney além do fluxo padrão.</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-white/10 border border-white/10 rounded-2xl p-4"><div class="flex items-center justify-between"><p class="text-xs font-black text-slate-300">Plugins disponíveis</p><i data-lucide="puzzle" class="w-4 h-4 text-slate-300"></i></div><div class="text-3xl font-black mt-2">1</div></div>
          <div class="bg-white/10 border border-white/10 rounded-2xl p-4"><div class="flex items-center justify-between"><p class="text-xs font-black text-slate-300">Campanhas no tenant</p><i data-lucide="megaphone" class="w-4 h-4 text-slate-300"></i></div><div class="text-3xl font-black mt-2">${campaignsCount}</div></div>
        </div>
      </div>
    </div>`;
  },

  pluginCardFlowBuilder(campaigns, selectedId) {
    const hasCampaigns = campaigns.length > 0;
    const options = campaigns.map(c => `<option value="${c.id}" ${Number(c.id) === selectedId ? 'selected' : ''}>${Utils.escape(c.name)}</option>`).join('');
    return `<div class="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-3" style="border-left: 4px solid #6366f1;">
      <div class="flex items-start gap-3">
        <div class="shrink-0 w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 grid place-items-center text-indigo-700"><i data-lucide="git-merge" class="w-5 h-5"></i></div>
        <div class="min-w-0 flex-1">
          <h3 class="font-black text-slate-900">Construir Fluxo de Ações</h3>
          <p class="text-xs text-slate-500 mt-0.5">Canvas drag-and-drop pra ligar ações entre si manualmente. Modela cadeias (ex: post Instagram → email follow-up).</p>
        </div>
      </div>
      ${hasCampaigns ? `
        <div>
          <label class="text-[11px] font-black text-slate-500 uppercase tracking-wider">Campanha</label>
          <select onchange="Actions.setPluginsFlowBuilderCampaign(Number(this.value))" class="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 font-semibold text-sm">${options}</select>
        </div>
        <button onclick="Actions.openFlowBuilder(${selectedId})" class="w-full px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm flex items-center justify-center gap-2 lj-dark-button" style="color:#fff!important;"><i data-lucide="arrow-right" class="w-4 h-4"></i> Abrir Builder</button>
      ` : `
        <p class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Crie uma campanha antes pra abrir o Builder.</p>
      `}
    </div>`;
  }
};
window.PluginsModule = PluginsModule;
