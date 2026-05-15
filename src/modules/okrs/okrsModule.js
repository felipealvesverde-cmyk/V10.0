// V12.2 — OKRs Module
window.OKRsModule = {
  renderOKRCard(okr = {}) {
    const data = window.OKRProjectionEngine ? window.OKRProjectionEngine.enrichOKR(okr) : okr;
    const gap = Number(data.gap || 0);
    const gapClass = gap >= 0 ? "text-emerald-300" : gap >= -10 ? "text-amber-300" : "text-red-300";
    return `
      <div class="lj-card rounded-2xl p-4 border border-violet-400/20 bg-violet-500/10">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-black text-violet-200 uppercase tracking-wide">OKR Estratégico</p>
            <h4 class="text-white font-black mt-1">${data.name || "OKR"}</h4>
          </div>
          <span class="lj-badge lj-badge-marketing">Projeção</span>
        </div>
        <div class="grid grid-cols-3 gap-3 mt-4">
          <div><p class="text-xs text-slate-400">Projetado</p><p class="text-xl font-black text-white">${data.projected ?? 0}</p></div>
          <div><p class="text-xs text-slate-400">Atual</p><p class="text-xl font-black text-white">${data.current ?? 0}</p></div>
          <div><p class="text-xs text-slate-400">Gap</p><p class="text-xl font-black ${gapClass}">${gap.toFixed(1)}%</p></div>
        </div>
        <p class="text-xs text-slate-400 mt-3">${data.sector || "Setor"} • ${data.funnelStage || "Etapa do funil"}</p>
      </div>`;
  },
  renderOKRForm(okr = {}, index = 0) {
    return `
      <div class="lj-card rounded-2xl p-4 bg-violet-500/10 border border-violet-400/20" data-okr-row="${index}">
        <div class="flex items-center justify-between mb-3">
          <h4 class="font-black text-violet-100">OKR de crescimento</h4>
          <button class="lj-btn lj-btn-danger text-xs" data-remove-okr="${index}">Remover</button>
        </div>
        <div class="grid md:grid-cols-5 gap-3">
          <label class="block"><span class="text-xs text-slate-400 font-bold">Nome</span><input class="lj-input w-full mt-1" data-field="name" value="${okr.name || ""}" placeholder="Gerar 1200 leads"></label>
          <label class="block"><span class="text-xs text-slate-400 font-bold">Projetado</span><input class="lj-input w-full mt-1" data-field="projected" value="${okr.projected ?? okr.projection ?? ""}" placeholder="1200"></label>
          <label class="block"><span class="text-xs text-slate-400 font-bold">Atual</span><input class="lj-input w-full mt-1" data-field="current" value="${okr.current ?? ""}" placeholder="0"></label>
          <label class="block"><span class="text-xs text-slate-400 font-bold">Setor</span><select class="lj-input w-full mt-1" data-field="sector">${["Marketing","Vendas","CS"].map(s => `<option ${okr.sector === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
          <label class="block"><span class="text-xs text-slate-400 font-bold">Etapa</span><select class="lj-input w-full mt-1" data-field="funnelStage">${["TOF","MOF","BOF"].map(s => `<option ${okr.funnelStage === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        </div>
      </div>`;
  }
};
