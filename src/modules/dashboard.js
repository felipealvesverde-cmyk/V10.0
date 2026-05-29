var DashboardModule = {
      // V35.3.4 — Dashboard ganha 5 tabs paralelas no topo:
      // Visão Geral (legacy) | Checkout (Hotmart) | Meus Alunos | Meta Ads | Google Ads.
      // Cada uma renderiza seu próprio módulo. Produtos Hotmart ficam SÓ
      // como sub-tabs dentro de Checkout.
      render() {
        const activeTab = App.state.activeDashboardTab || 'overview';
        const renderers = {
          overview:     () => {
            const selected = App.state.campaigns.find(c => c.id === App.state.selectedDashboardCampaignId) || null;
            return selected ? this.campaignDetail(selected) : this.overview();
          },
          checkout:     () => window.CheckoutDashboard   ? CheckoutDashboard.render()   : '<p class="p-6 text-slate-500">CheckoutDashboard não carregado.</p>',
          alunos:       () => window.AlunosModule        ? `<div class="p-2 lg:p-4">${AlunosModule.render()}</div>`        : '<p class="p-6 text-slate-500">AlunosModule não carregado.</p>',
          'meta-ads':   () => window.MetaAdsDashboard    ? `<div class="p-2 lg:p-4">${MetaAdsDashboard.render()}</div>`    : '<p class="p-6 text-slate-500">MetaAdsDashboard não carregado.</p>',
          'google-ads': () => window.GoogleAdsDashboard  ? `<div class="p-2 lg:p-4">${GoogleAdsDashboard.render()}</div>`  : '<p class="p-6 text-slate-500">GoogleAdsDashboard não carregado.</p>'
        };
        const body = (renderers[activeTab] || renderers.overview)();
        return this._tabs(activeTab) + body;
      },
      _tabs(active) {
        // V35.3.4 — 5 tabs paralelas. Separador visual entre "Checkout" e
        // os dashs externos (Alunos / Meta Ads / Google Ads) pra agrupar.
        const tabs = [
          { id: 'overview',    label: 'Visão Geral',  icon: 'layout-dashboard', semantic: null },
          { id: 'checkout',    label: 'Checkout',     icon: 'shopping-cart',    semantic: null },
          { sep: true },
          { id: 'alunos',      label: 'Meus Alunos',  icon: 'graduation-cap',   semantic: 'cs',        color: '#6BBEF9' },
          { id: 'meta-ads',    label: 'Meta Ads',     icon: 'facebook',         semantic: 'marketing', color: '#F472B6' },
          { id: 'google-ads',  label: 'Google Ads',   icon: 'search',           semantic: 'marketing', color: '#F472B6' }
        ];
        return `<div class="px-2 pt-2">
          <div class="inline-flex rounded-2xl bg-slate-100 border border-slate-200 p-1 gap-1 mb-4 flex-wrap items-center">
            ${tabs.map(t => {
              if (t.sep) return '<span class="w-px h-6 bg-slate-300 mx-1"></span>';
              const isActive = active === t.id;
              const baseCls = 'px-4 py-2 rounded-xl text-sm font-black flex items-center gap-2 transition';
              if (t.color) {
                const style = isActive
                  ? `background: ${t.color}; color: #fff;`
                  : `background: ${t.color}1A; color: ${t.color};`;
                return `<button onclick="Actions.setDashboardTab('${t.id}')" class="${baseCls}" style="${style}">
                  <i data-lucide="${t.icon}" class="w-3.5 h-3.5"></i>
                  ${t.label}
                </button>`;
              }
              return `<button onclick="Actions.setDashboardTab('${t.id}')" class="${baseCls} ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-white'}" ${isActive ? 'style="color:#fff;"' : ''}>
                <i data-lucide="${t.icon}" class="w-3.5 h-3.5"></i>
                ${t.label}
              </button>`;
            }).join('')}
          </div>
        </div>`;
      },
      // V21 — Top 10 tags acumuladas (lê tagCounters de todos os leads via LeadBaseService)
      _topTagsWidget() {
        if (!window.LeadBaseService) return '';
        const leads = LeadBaseService.list();
        if (!leads.length) return '';
        const totals = new Map();
        for (const lead of leads) {
          const counters = lead.tagCounters || {};
          for (const [tag, count] of Object.entries(counters)) {
            if (!tag) continue;
            totals.set(tag, (totals.get(tag) || 0) + Number(count || 0));
          }
          // Fallback: leads sem counter mas com tags ainda contam 1× por tag
          if (!Object.keys(counters).length && Array.isArray(lead.tags)) {
            for (const tag of lead.tags) {
              const norm = String(tag || '').trim().replace(/^#/, '');
              if (norm) totals.set(norm, (totals.get(norm) || 0) + 1);
            }
          }
        }
        if (!totals.size) return '';
        const top = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const maxCount = top[0][1];
        return `<div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 mb-4">
          <div class="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 class="text-xl font-black">Top tags acumuladas</h3>
              <p class="text-sm text-slate-500">Sinais que mais aparecem nos leads (alimentados por RD CRM + inserções manuais).</p>
            </div>
            <span class="px-3 py-1.5 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black">${totals.size} tags únicas</span>
          </div>
          <div class="space-y-2">
            ${top.map(([tag, count]) => {
              const pct = Math.round((count / maxCount) * 100);
              return `<div class="flex items-center gap-3">
                <span class="text-xs font-black text-slate-700 w-44 truncate">${Utils.escape(tag)}</span>
                <div class="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden"><div class="h-full bg-indigo-500" style="width:${pct}%;"></div></div>
                <span class="text-xs font-black text-slate-900 w-10 text-right">${count}</span>
              </div>`;
            }).join('')}
          </div>
        </div>`;
      },
      _rdEmailDashboard() {
        if (!window.RDKpiAggregation) return '';
        const agg = RDKpiAggregation.aggregate();
        if (!agg.length) return '';
        return `<div class="lj-rd-panel mb-4"><div class="flex items-center justify-between gap-3 mb-4"><div><h3 class="lj-rd-title">RD Email — KPIs sincronizados</h3><p class="lj-rd-help">KPIs de ações RD Email agregados no dashboard.</p></div><button onclick="Actions.syncAllRDActions()" class="lj-btn lj-btn-secondary">Sincronizar RD</button></div><div class="grid md:grid-cols-3 xl:grid-cols-5 gap-3">${agg.map(kpi => `<div class="rounded-2xl bg-white/10 border border-white/10 p-3"><p class="text-xs text-slate-300 font-black">${Utils.escape(kpi.name)}</p><p class="text-2xl font-black text-white mt-1">${Utils.escape(kpi.current)}</p><p class="text-[11px] text-slate-400 mt-1">${kpi.actions} ação(ões)</p></div>`).join('')}</div></div>`;
      },
      _revopsAIWidget() {
        if (!window.RevOpsAIEngine) return '';
        const analyses = RevOpsAIEngine.analyzeAll();
        if (!analyses.length) return '';
        return `<div class="lj-rd-panel mb-4">
      <div class="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 class="lj-rd-title">RevOps AI</h3>
          <p class="lj-rd-help">Diagnóstico automático de KPIs e OKRs.</p>
        </div>
        <span class="lj-rd-kpi-chip">Fase 5</span>
      </div>

      <div class="grid lg:grid-cols-2 gap-4">
        ${analyses.map(item => `
          <div class="rounded-2xl bg-white/10 border border-white/10 p-4">
            <div class="flex items-center justify-between mb-3">
              <div>
                <p class="text-sm font-black text-white">${Utils.escape(item.actionName || 'Ação')}</p>
                <p class="text-xs text-slate-400">${Utils.escape(item.analysis.health)}</p>
              </div>

              <div class="text-3xl font-black text-white">${item.analysis.score}</div>
            </div>

            <div class="space-y-2">
              ${item.analysis.findings.map(f => `
                <div class="rounded-xl bg-black/20 border border-white/10 p-3">
                  <p class="text-xs font-black text-sky-200">${Utils.escape(f.title)}</p>
                  <p class="text-xs text-slate-300 mt-1">${Utils.escape(f.insight)}</p>
                  <p class="text-xs text-emerald-300 mt-2 font-semibold">${Utils.escape(f.recommendation)}</p>
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
      },
      overview() {
        const a = Analytics.global();
        return `<div class="space-y-4">${this._revopsAIWidget()}${this._rdEmailDashboard()}${this._topTagsWidget()}${window.OKRKPIWorkspace ? OKRKPIWorkspace.render() : ''}<div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5"><div><h2 class="text-2xl font-black">Dashboard Geral</h2><p class="text-sm text-slate-500">KPIs amplos das campanhas e leitura executiva da jornada.</p></div><div class="px-4 py-2 rounded-2xl bg-slate-900 text-white font-black text-sm pulse-soft">Visão RevOps</div></div><div class="grid grid-cols-2 lg:grid-cols-6 gap-3">${Components.metric('Campanhas', a.campaigns, 'megaphone')}${Components.metric('Ações', a.actions, 'plug')}${Components.metric('Leads', a.leads, 'users')}${Components.metric('Score médio', a.avgScore, 'gauge')}${Components.metric('Quentes', a.hot, 'flame')}${Components.metric('CTA', a.cta, 'mouse-pointer-click')}</div></div><div class="grid lg:grid-cols-3 gap-4"><div class="lg:col-span-2 bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><h3 class="text-xl font-black mb-1">Funil geral das campanhas</h3><p class="text-sm text-slate-500 mb-5">Entrada → Abertura → Leitura → CTA, somando todas as ações.</p>${Components.animatedFunnel([{ label: 'Entrada', value: a.leads, total: a.leads }, { label: 'Abertura', value: a.opened, total: a.leads }, { label: 'Leitura', value: a.read, total: a.leads }, { label: 'CTA', value: a.cta, total: a.leads }])}</div><div class="bg-slate-900 text-white rounded-3xl p-5 shadow-sm"><h3 class="text-xl font-black mb-2">Insight RevOps</h3><p class="text-sm text-slate-300">${Analytics.insight(a)}</p></div></div><div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><div class="flex items-start justify-between gap-3 mb-5"><div><h3 class="text-xl font-black">Campanhas</h3><p class="text-sm text-slate-500">Clique em uma campanha para analisar KPIs e ações ligadas.</p></div><div class="text-3xl font-black">${App.state.campaigns.length}</div></div><div class="grid md:grid-cols-2 gap-3">${App.state.campaigns.map(campaign => this.campaignCard(campaign)).join('') || Components.empty('Nenhuma campanha criada.')}</div></div></div>`;
      },
      campaignCard(campaign) {
        const a = Analytics.campaign(campaign.id);
        return `<div onclick="Actions.openDashboardCampaign(${campaign.id})" class="cursor-pointer p-4 rounded-3xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition"><div class="flex items-start justify-between gap-3 mb-3"><div><h4 class="font-black text-lg">${Utils.escape(campaign.name)}</h4><p class="text-xs text-slate-500">${a.actions} ação(ões) • ${a.leads} lead(s)</p></div><span class="px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-black">score ${a.avgScore}</span></div>${Components.miniFunnel(a)}</div>`;
      },
      campaignDetail(campaign) {
        const a = Analytics.campaign(campaign.id);
        const actions = App.state.actions.filter(action => action.campaignId === campaign.id);
        return `<div class="space-y-4">${window.OKRKPIWorkspace ? OKRKPIWorkspace.render() : ''}<div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><button onclick="App.state.selectedDashboardCampaignId=null; App.save(); App.render();" class="mb-4 px-4 py-2 rounded-2xl bg-slate-100 font-black text-sm">← Voltar ao Dashboard</button><div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5"><div><p class="text-xs font-black text-slate-500">Dashboard da campanha</p><h2 class="text-2xl font-black">${Utils.escape(campaign.name)}</h2><p class="text-sm text-slate-500">${Utils.escape(campaign.objective || 'Sem objetivo definido')}</p></div><span class="px-4 py-2 rounded-2xl bg-slate-100 font-black text-sm">${actions.length} ação(ões)</span></div><div class="grid grid-cols-2 lg:grid-cols-6 gap-3">${Components.metric('Ações', a.actions, 'plug')}${Components.metric('Leads', a.leads, 'users')}${Components.metric('Score médio', a.avgScore, 'gauge')}${Components.metric('Frios', a.cold, 'snowflake')}${Components.metric('Mornos', a.warm, 'thermometer')}${Components.metric('Quentes', a.hot, 'flame')}</div></div><div class="grid lg:grid-cols-3 gap-4"><div class="lg:col-span-2 bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><h3 class="text-xl font-black mb-1">Funil da campanha</h3><p class="text-sm text-slate-500 mb-5">Consolida todas as ações desta campanha.</p>${Components.animatedFunnel([{ label: 'Entrada', value: a.leads, total: a.leads }, { label: 'Abertura', value: a.opened, total: a.leads }, { label: 'Leitura', value: a.read, total: a.leads }, { label: 'CTA', value: a.cta, total: a.leads }])}</div><div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><h3 class="text-xl font-black mb-4">OKRs operacionais</h3><div class="space-y-3">${(campaign.okrs || []).map(Components.okrCard).join('') || Components.empty('Campanhas não possuem OKRs próprios. Os OKRs operacionais estão nas ações e alimentam o produto.')}</div></div></div><div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"><h3 class="text-xl font-black mb-1">KPIs por ação</h3><p class="text-sm text-slate-500 mb-5">Cada ação mantém seus próprios resultados e score selecionado.</p><div class="space-y-3">${actions.map(action => this.actionCard(action)).join('') || Components.empty('Nenhuma ação criada nesta campanha.')}</div></div></div>`;
      },
      actionCard(action) {
        const r = Analytics.actionResult(action);
        const score = ScoreEngine.getById(action.scoreId);
        return `<div class="p-4 rounded-3xl bg-slate-50 border border-slate-100"><div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4"><div><h4 class="font-black text-lg">${Utils.escape(action.name)}</h4><p class="text-sm text-slate-500">${Utils.escape(action.channel)} • ${Utils.escape(score?.name || 'sem score')}</p></div><div class="grid grid-cols-4 gap-2 text-center"><div class="bg-white rounded-2xl px-3 py-2"><div class="font-black">${r.total}</div><div class="text-xs text-slate-500">Leads</div></div><div class="bg-white rounded-2xl px-3 py-2"><div class="font-black">${r.avgScore}</div><div class="text-xs text-slate-500">Score</div></div><div class="bg-white rounded-2xl px-3 py-2"><div class="font-black">${r.hot}</div><div class="text-xs text-slate-500">Quentes</div></div><div class="bg-white rounded-2xl px-3 py-2"><div class="font-black">${r.cta}</div><div class="text-xs text-slate-500">CTA</div></div></div></div><div class="mt-4">${Components.miniFunnel(r)}</div></div>`;
      }
    };
window.DashboardModule = DashboardModule;
