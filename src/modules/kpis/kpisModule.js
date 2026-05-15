// V12.2 — KPIs Module
window.KPIsModule = {
  renderKPICard(kpi = {}) {
    const data = window.KPIContextEngine ? window.KPIContextEngine.normalizeKPI(kpi) : kpi;
    return `
      <div class="lj-card rounded-2xl p-4 bg-white/5 border border-white/10">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-black text-slate-400 uppercase tracking-wide">KPI de acompanhamento</p>
            <h4 class="text-white font-black mt-1">${data.name || "KPI"}</h4>
          </div>
          <span class="lj-badge">Contexto</span>
        </div>
        <div class="grid grid-cols-2 gap-3 mt-4">
          <div><p class="text-xs text-slate-400">Atual</p><p class="text-xl font-black text-white">${data.current ?? 0}</p></div>
          <div><p class="text-xs text-slate-400">Tendência</p><p class="text-xl font-black text-slate-200">${data.trend || "stable"}</p></div>
        </div>
        ${data.observation ? `<p class="text-xs text-slate-400 mt-3">${data.observation}</p>` : ""}
      </div>`;
  },
  renderKPIForm(kpi = {}, index = 0) {
    return `
      <div class="lj-card rounded-2xl p-4 bg-white/5 border border-white/10" data-kpi-row="${index}">
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-black text-slate-200">KPI de acompanhamento</h4>
          <button class="lj-btn lj-btn-danger text-xs" data-remove-kpi="${index}">Remover</button>
        </div>
        <div class="grid md:grid-cols-4 gap-3">
          <label class="block"><span class="text-xs text-slate-400 font-bold">Nome</span><input class="lj-input w-full mt-1" data-field="name" value="${kpi.name || ""}" placeholder="CTR"></label>
          <label class="block"><span class="text-xs text-slate-400 font-bold">Valor atual</span><input class="lj-input w-full mt-1" data-field="current" value="${kpi.current ?? kpi.value ?? ""}" placeholder="0"></label>
          <label class="block"><span class="text-xs text-slate-400 font-bold">Tendência</span><select class="lj-input w-full mt-1" data-field="trend">${["stable","up","down","attention"].map(s => `<option ${kpi.trend === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
          <label class="block"><span class="text-xs text-slate-400 font-bold">Observação</span><input class="lj-input w-full mt-1" data-field="observation" value="${kpi.observation || kpi.note || ""}" placeholder="Contexto operacional"></label>
        </div>
      </div>`;
  }
};
