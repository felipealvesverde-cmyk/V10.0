// V12.4 — Front completo para OKRs, KPIs e escala operacional.
var OKRKPIWorkspace = {
  render() {
    const global = RevenueOKRKPIEngine.globalKpis();
    const okrs = (App.state.strategicOkrs || []).map((okr, index) => RevenueOKRKPIEngine.normalizeOkr(okr, index));
    const kpis = (App.state.operationalKpis || []).map((kpi, index) => RevenueOKRKPIEngine.normalizeKpi(kpi, index));
    const selected = okrs.find(okr => okr.id === App.state.selectedOkrId) || okrs[0] || null;
    return `<div class="space-y-4">
      ${this.executiveLayer(global)}
      <div class="grid xl:grid-cols-[1fr_1fr] gap-4">${this.okrPanel(okrs, selected)}${this.kpiPanel(kpis, selected)}</div>
      ${this.scalePanel(selected)}
      ${this.alertsPanel()}
    </div>`;
  },
  executiveLayer(global) {
    return `<section class="bg-slate-950 text-white rounded-[2rem] p-5 shadow-sm relative overflow-hidden">
      <div class="absolute inset-0 opacity-70" style="background:radial-gradient(circle at 15% 0%,rgba(124,58,237,.22),transparent 28%),radial-gradient(circle at 85% 5%,rgba(16,185,129,.18),transparent 28%)"></div>
      <div class="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4"><div><p class="text-xs font-black text-slate-300 uppercase tracking-wider">V12.4 • Motor OKR/KPI</p><h2 class="text-3xl font-black">Sistema operacional de metas de receita</h2><p class="text-sm text-slate-300 mt-1">Calcula KPIs reais a partir de produtos, campanhas, ações e leads; depois escala OKRs por produto.</p></div><button onclick="Actions.createDefaultRevenueOkrStack()" class="px-5 py-3 rounded-2xl bg-white text-slate-950 font-black text-sm">Criar stack padrão</button></div>
      <div class="relative z-10 grid grid-cols-2 lg:grid-cols-6 gap-3">
        ${this.darkMetric('Produtos', global.products)}${this.darkMetric('Campanhas', global.campaigns)}${this.darkMetric('Ações', global.actions)}${this.darkMetric('Leads', global.leads)}${this.darkMetric('Convertidos', global.converted)}${this.darkMetric('Receita', RevenueOKRKPIEngine.money(global.revenue))}
      </div>
    </section>`;
  },
  okrPanel(okrs, selected) {
    const d = App.state.okrDraft || {};
    return `<section class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><div class="flex items-start justify-between gap-3 mb-4"><div><h3 class="text-xl font-black">OKRs estratégicos</h3><p class="text-sm text-slate-500">Direção, resultado-chave, meta, responsável e status.</p></div><span class="text-3xl font-black">${okrs.length}</span></div>
      <div class="grid md:grid-cols-2 gap-3 mb-4">
        <div><label class="text-xs font-black text-slate-500">Objetivo</label><input value="${Utils.escape(d.objective || '')}" oninput="Actions.updateOkrDraft('objective', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" placeholder="Ex: Escalar receita previsível" /></div>
        <div><label class="text-xs font-black text-slate-500">Resultado-chave</label><input value="${Utils.escape(d.keyResult || '')}" oninput="Actions.updateOkrDraft('keyResult', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" placeholder="Ex: Gerar R$ 100k" /></div>
        <div><label class="text-xs font-black text-slate-500">Meta</label><input value="${Utils.escape(d.target || '')}" oninput="Actions.updateOkrDraft('target', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" placeholder="100000" /></div>
        <div><label class="text-xs font-black text-slate-500">Responsável</label><input value="${Utils.escape(d.owner || '')}" oninput="Actions.updateOkrDraft('owner', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" placeholder="Revenue / Marketing / Vendas" /></div>
        <div><label class="text-xs font-black text-slate-500">Prazo</label><input value="${Utils.escape(d.deadline || '')}" oninput="Actions.updateOkrDraft('deadline', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" placeholder="Q2 / 30 dias" /></div>
        <div><label class="text-xs font-black text-slate-500">Status</label><select onchange="Actions.updateOkrDraft('status', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold">${['Em andamento','Em risco','Concluído'].map(s => `<option ${d.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <button onclick="Actions.createStrategicOkr()" class="md:col-span-2 px-5 py-3 rounded-2xl bg-slate-900 text-white font-black lj-dark-button" style="color:#fff!important;">Criar OKR</button>
      </div>
      <div class="space-y-3 max-h-[420px] overflow-auto">${okrs.map(okr => this.okrCard(okr, selected)).join('') || Components.empty('Nenhum OKR estratégico criado.')}</div>
    </section>`;
  },
  okrCard(okr, selected) {
    const is = selected && selected.id === okr.id;
    return `<div onclick="Actions.selectStrategicOkr('${okr.id}')" class="cursor-pointer rounded-3xl p-4 border ${is ? 'border-slate-900 bg-slate-50' : 'border-slate-100 bg-slate-50'}"><div class="flex items-start justify-between gap-3"><div><h4 class="font-black text-lg">${Utils.escape(okr.objective || okr.name)}</h4><p class="text-sm text-slate-500 mt-1">${Utils.escape(okr.keyResult || 'Sem resultado-chave definido')}</p><p class="text-xs text-slate-400 mt-2">${Utils.escape(okr.owner || 'Sem responsável')} • ${Utils.escape(okr.deadline || 'Sem prazo')} • ${Utils.escape(okr.status)}</p></div><button onclick="event.stopPropagation(); Actions.deleteStrategicOkr('${okr.id}')" class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-red-500 text-xs font-black">Remover</button></div><div class="mt-3"><div class="flex justify-between text-xs font-black text-slate-500 mb-1"><span>${okr.unit === 'R$' ? RevenueOKRKPIEngine.money(okr.current) : okr.current}</span><span>${Math.round(okr.progress)}%</span></div><div class="h-3 rounded-full bg-white overflow-hidden"><div class="h-full bg-slate-900 rounded-full" style="width:${Math.min(100, okr.progress)}%"></div></div></div></div>`;
  },
  kpiPanel(kpis, selected) {
    const d = App.state.kpiDraft || {};
    const products = App.state.products || [];
    const okrs = App.state.strategicOkrs || [];
    return `<section class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><div class="flex items-start justify-between gap-3 mb-4"><div><h3 class="text-xl font-black">KPIs operacionais</h3><p class="text-sm text-slate-500">Métrica, meta, frequência, fonte e vínculo com OKR.</p></div><span class="text-3xl font-black">${kpis.length}</span></div>
      <div class="grid md:grid-cols-2 gap-3 mb-4">
        <div><label class="text-xs font-black text-slate-500">Nome do KPI</label><input value="${Utils.escape(d.name || '')}" oninput="Actions.updateKpiDraft('name', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" placeholder="Ex: Receita atribuída" /></div>
        <div><label class="text-xs font-black text-slate-500">Métrica</label><select onchange="Actions.updateKpiDraft('metric', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold">${this.metricOptions(d.metric)}</select></div>
        <div><label class="text-xs font-black text-slate-500">Escopo</label><select onchange="Actions.updateKpiDraft('scope', this.value); App.render();" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold"><option value="global" ${d.scope !== 'product' ? 'selected' : ''}>Geral</option><option value="product" ${d.scope === 'product' ? 'selected' : ''}>Produto</option></select></div>
        <div><label class="text-xs font-black text-slate-500">Produto</label><select ${d.scope === 'product' ? '' : 'disabled'} onchange="Actions.updateKpiDraft('productId', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold disabled:opacity-50">${products.map(p => `<option value="${p.id}" ${Number(d.productId) === Number(p.id) ? 'selected' : ''}>${Utils.escape(p.name)}</option>`).join('')}</select></div>
        <div><label class="text-xs font-black text-slate-500">Meta</label><input value="${Utils.escape(d.target || '')}" oninput="Actions.updateKpiDraft('target', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" placeholder="100000" /></div>
        <div><label class="text-xs font-black text-slate-500">OKR vinculado</label><select onchange="Actions.updateKpiDraft('relatedOkrId', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold"><option value="">Sem vínculo</option>${okrs.map(o => `<option value="${o.id}" ${d.relatedOkrId === o.id ? 'selected' : ''}>${Utils.escape(o.objective || o.name)}</option>`).join('')}</select></div>
        <div><label class="text-xs font-black text-slate-500">Frequência</label><input value="${Utils.escape(d.frequency || '')}" oninput="Actions.updateKpiDraft('frequency', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" /></div>
        <div><label class="text-xs font-black text-slate-500">Fonte</label><input value="${Utils.escape(d.source || '')}" oninput="Actions.updateKpiDraft('source', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold" /></div>
        <button onclick="Actions.createOperationalKpi()" class="md:col-span-2 px-5 py-3 rounded-2xl bg-slate-900 text-white font-black lj-dark-button" style="color:#fff!important;">Criar KPI</button>
      </div>
      <div class="space-y-3 max-h-[420px] overflow-auto">${kpis.map(kpi => this.kpiCard(kpi)).join('') || Components.empty('Nenhum KPI operacional criado.')}</div>
    </section>`;
  },
  metricOptions(selected) {
    const options = [['revenue','Receita'],['grossProfit','Lucro bruto'],['mrr','MRR'],['leads','Leads impactados'],['converted','Leads convertidos'],['opportunities','Oportunidades'],['conversion','Conversão'],['campaigns','Campanhas'],['actions','Ações']];
    return options.map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
  },
  kpiCard(kpi) {
    const value = kpi.unit === 'R$' ? RevenueOKRKPIEngine.money(kpi.current) : kpi.unit === '%' ? RevenueOKRKPIEngine.percent(kpi.current) : Math.round(kpi.current);
    const target = kpi.unit === 'R$' ? RevenueOKRKPIEngine.money(kpi.target) : kpi.unit === '%' ? RevenueOKRKPIEngine.percent(kpi.target) : Math.round(kpi.target || 0);
    return `<div class="rounded-3xl p-4 border border-slate-100 bg-slate-50"><div class="flex items-start justify-between gap-3"><div><h4 class="font-black text-lg">${Utils.escape(kpi.name)}</h4><p class="text-sm text-slate-500 mt-1">Atual ${value} • Meta ${target} • ${Utils.escape(kpi.frequency)}</p><p class="text-xs text-slate-400 mt-1">${Utils.escape(kpi.source)} • ${Utils.escape(kpi.health)}</p></div><button onclick="Actions.deleteOperationalKpi('${kpi.id}')" class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-red-500 text-xs font-black">Remover</button></div><div class="mt-3 h-3 rounded-full bg-white overflow-hidden"><div class="h-full bg-slate-900 rounded-full" style="width:${Math.min(100, kpi.progress)}%"></div></div></div>`;
  },
  scalePanel(selected) {
    if (!selected) return `<section class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">${Components.empty('Crie ou selecione um OKR para ver a escala por produto.')}</section>`;
    const rows = RevenueOKRKPIEngine.scaleOkr(selected);
    return `<section class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><div class="flex items-start justify-between gap-3 mb-4"><div><h3 class="text-xl font-black">Escala do OKR por produto</h3><p class="text-sm text-slate-500">Distribui a meta do OKR entre produtos usando peso de preço/receita e mostra gap operacional.</p></div><span class="px-4 py-2 rounded-2xl bg-slate-100 font-black text-sm">${Utils.escape(selected.objective)}</span></div><div class="grid md:grid-cols-2 xl:grid-cols-3 gap-3">${rows.map(row => `<div class="rounded-3xl bg-slate-50 border border-slate-100 p-4"><h4 class="font-black text-lg">${Utils.escape(row.productName)}</h4><p class="text-sm text-slate-500 mt-1">Meta: ${RevenueOKRKPIEngine.money(row.target)} • Atual: ${RevenueOKRKPIEngine.money(row.current)}</p><div class="grid grid-cols-3 gap-2 mt-3 text-center"><div class="bg-white rounded-2xl p-2"><div class="font-black">${RevenueOKRKPIEngine.money(row.gap)}</div><div class="text-xs text-slate-500">Gap</div></div><div class="bg-white rounded-2xl p-2"><div class="font-black">${row.salesNeeded}</div><div class="text-xs text-slate-500">Vendas</div></div><div class="bg-white rounded-2xl p-2"><div class="font-black">${row.campaigns}</div><div class="text-xs text-slate-500">Campanhas</div></div></div></div>`).join('') || Components.empty('Nenhum produto para escalar este OKR.')}</div></section>`;
  },
  alertsPanel() {
    const alerts = RevenueOKRKPIEngine.revopsAlerts();
    return `<section class="bg-slate-900 text-white rounded-3xl p-5 shadow-sm"><h3 class="text-xl font-black mb-3">RevOps AI — alertas do motor</h3><div class="grid md:grid-cols-2 gap-3">${alerts.map(alert => `<div class="rounded-2xl bg-white/10 border border-white/10 p-4 text-sm text-slate-200">${Utils.escape(alert)}</div>`).join('') || '<div class="rounded-2xl bg-white/10 border border-white/10 p-4 text-sm text-slate-200">Nenhum alerta crítico encontrado. Continue alimentando produtos, campanhas e ações.</div>'}</div></section>`;
  },
  darkMetric(label, value) { return `<div class="bg-white/10 border border-white/10 rounded-2xl p-4"><p class="text-xs font-black text-slate-300">${label}</p><div class="text-2xl font-black mt-1">${value}</div></div>`; }
};
window.OKRKPIWorkspace = OKRKPIWorkspace;
