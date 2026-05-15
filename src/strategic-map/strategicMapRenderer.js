// V17 — Strategic Map Renderer
// Helpers visuais leves usados pelo strategicMapModal — pílulas de progresso,
// ilustração do fluxo Visão → Receita, badges de status. UI complexa fica no
// modal; este módulo centraliza fragmentos reutilizáveis.
window.StrategicMapRenderer = {
  flowDiagramHtml() {
    const steps = ['Visão', 'Objetivo', 'OKR', 'Fluxo', 'Ação', 'Execução', 'Receita'];
    const icons = ['eye','flag','target','git-merge','plug','kanban','dollar-sign'];
    return `<div class="flex flex-wrap items-center gap-2">${steps.map((s, i) => `
      <div class="flex items-center gap-2">
        <div class="px-3 py-2 rounded-2xl bg-white/10 border border-white/15 text-white text-xs font-black flex items-center gap-1.5"><i data-lucide="${icons[i]}" class="w-3.5 h-3.5 text-indigo-300"></i>${s}</div>
        ${i < steps.length - 1 ? '<i data-lucide="arrow-right" class="w-4 h-4 text-indigo-300/70"></i>' : ''}
      </div>`).join('')}</div>`;
  },

  progressBar(percent, color = 'indigo') {
    const pct = Math.max(0, Math.min(100, Number(percent || 0)));
    const palette = {
      indigo: 'bg-indigo-500',
      emerald: 'bg-emerald-500',
      amber: 'bg-amber-500',
      red: 'bg-red-500'
    };
    return `<div class="w-full h-1.5 rounded-full bg-white/10 overflow-hidden"><div class="h-full ${palette[color] || palette.indigo}" style="width:${pct}%;"></div></div>`;
  },

  okrStatus(percent) {
    if (percent >= 80) return { color: 'emerald', label: 'No alvo' };
    if (percent >= 40) return { color: 'amber', label: 'Em ritmo' };
    if (percent > 0)  return { color: 'red', label: 'Abaixo' };
    return { color: 'indigo', label: 'Sem leitura' };
  }
};
