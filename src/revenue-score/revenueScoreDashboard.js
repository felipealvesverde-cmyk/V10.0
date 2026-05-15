// V18 — Revenue Score Dashboard
// Helpers visuais reutilizados pelo RevenueScoreDashboardModal: pílulas,
// barras, tier color, formatação. UI pesada vive no modal.
window.RevenueScoreDashboard = {
  tierTone(tier) {
    if (tier === 'hot')  return { bg: 'bg-red-500/20', border: 'border-red-400/40', text: 'text-red-200', dot: 'bg-red-500', label: 'Quente' };
    if (tier === 'warm') return { bg: 'bg-amber-500/20', border: 'border-amber-400/40', text: 'text-amber-200', dot: 'bg-amber-500', label: 'Morno' };
    return { bg: 'bg-sky-500/20', border: 'border-sky-400/40', text: 'text-sky-200', dot: 'bg-sky-500', label: 'Frio' };
  },

  insightTone(tone) {
    if (tone === 'positive') return { bg: 'bg-emerald-500/15', border: 'border-emerald-400/30', text: 'text-emerald-100', icon: 'check-circle-2' };
    if (tone === 'warning')  return { bg: 'bg-amber-500/15', border: 'border-amber-400/30', text: 'text-amber-100', icon: 'alert-triangle' };
    return { bg: 'bg-white/[0.04]', border: 'border-white/15', text: 'text-slate-200', icon: 'sparkles' };
  },

  progressBar(percent, color = 'indigo') {
    const pct = Math.max(0, Math.min(100, Number(percent || 0)));
    const palette = { indigo: 'bg-indigo-500', emerald: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', sky: 'bg-sky-500' };
    return `<div class="w-full h-1.5 rounded-full bg-white/10 overflow-hidden"><div class="h-full ${palette[color] || palette.indigo}" style="width:${pct}%;"></div></div>`;
  }
};
