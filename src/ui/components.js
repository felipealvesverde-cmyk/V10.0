var Components = {
      metric(label, value, icon) {
        return `<div class="bg-slate-50 rounded-3xl p-4 border border-slate-100"><div class="flex items-center justify-between mb-2"><span class="text-xs text-slate-500 font-black">${Utils.escape(label)}</span><i data-lucide="${icon}" class="w-4 h-4 text-slate-400"></i></div><div class="text-3xl font-black">${value}</div></div>`;
      },
      resultMetric(label, value) { return `<div class="bg-slate-50 rounded-3xl p-4 border border-slate-100"><div class="text-xs text-slate-500 font-black mb-2">${Utils.escape(label)}</div><div class="text-3xl font-black">${value}</div></div>`; },
      empty(text) { return `<div class="p-5 rounded-3xl bg-slate-50 text-slate-500 text-center font-semibold">${Utils.escape(text)}</div>`; },
      leadPreview(lead) { return `<div class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-slate-100"><div><p class="font-black text-sm">${Utils.escape(lead.name)}</p><p class="text-xs text-slate-500">${Utils.escape(lead.email || 'sem email')} • ${Utils.escape(lead.tags || 'sem tags')}</p></div><div class="text-xl font-black">${lead.score}</div></div>`; },
      miniFunnel(result) {
        const total = Math.max(result.total || result.leads || 0, 1);
        const stages = [{ label: 'A', value: result.opened || 0 }, { label: 'L', value: result.read || 0 }, { label: 'C', value: result.cta || 0 }];
        return `<div class="grid grid-cols-3 gap-2">${stages.map(stage => { const pct = Math.round((stage.value / total) * 100); return `<div class="bg-white rounded-2xl p-2 border border-slate-100"><div class="flex justify-between text-[10px] font-black mb-1"><span>${stage.label}</span><span>${pct}%</span></div><div class="h-2 rounded-full bg-slate-100 overflow-hidden"><div class="h-full bg-slate-900 funnel-fill" style="width:${Math.max(4, pct)}%"></div></div></div>`; }).join('')}</div>`;
      },
      animatedFunnel(stages) {
        const safeTotal = Math.max(stages[0]?.total || 0, 1);
        return `<div class="space-y-4">${stages.map((stage, index) => { const pct = Math.max(4, Math.round((stage.value / safeTotal) * 100)); const realPct = Math.round((stage.value / safeTotal) * 100); return `<div><div class="flex justify-between text-sm mb-1"><span class="font-black">${Utils.escape(stage.label)}</span><span class="text-slate-500">${stage.value} • ${realPct}%</span></div><div class="h-12 bg-slate-100 rounded-2xl overflow-hidden border border-slate-100"><div class="h-full bg-slate-900 rounded-2xl funnel-fill flex items-center justify-end pr-4 text-white font-black" style="width:${pct}%; animation-delay:${index * 90}ms">${stage.value}</div></div></div>`; }).join('')}</div>`;
      },
      okrCard(okr) { return `<div class="bg-slate-50 rounded-2xl p-3 border border-slate-100"><p class="font-black text-sm">${Utils.escape(okr.name || 'OKR sem nome')}</p><div class="grid grid-cols-2 gap-2 mt-2 text-xs"><div class="bg-white rounded-xl p-2"><span class="text-slate-500">Meta</span><div class="font-black">${Utils.escape(okr.target || '-')}</div></div><div class="bg-white rounded-xl p-2"><span class="text-slate-500">Atual</span><div class="font-black">${Utils.escape(okr.current || '-')}</div></div></div></div>`; }
    };
window.Components = Components;
