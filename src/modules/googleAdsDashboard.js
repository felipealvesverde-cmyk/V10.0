// V35.3.3 — Google Ads Dashboard.
// V35.7.0-alpha1 — Reescrito: 2 sub-abas (Overview + Não associadas) lendo
// de App.state.googleAdsCampaignsCache (mock ou real). Mock prevalece
// quando sync real (alpha4) ainda não trouxe dados. Badge "Dados de
// exemplo" indica quando estamos olhando mock.
//
// Sub-tab 'overview' — campanhas vinculadas a alguma Campanha LJ + métricas
// consolidadas por Campanha LJ.
// Sub-tab 'orphans' — campanhas Ads sem Campanha LJ vinculada (órfãs).
// Botão "Associar" abre o adsAssociationWizard (alpha2).

window.GoogleAdsDashboard = {
  render() {
    // Auto-load mock se nunca carregou.
    if (App.state.googleAdsCampaignsCache === null && window.Actions?.loadGoogleAdsCampaigns) {
      setTimeout(() => Actions.loadGoogleAdsCampaigns(), 0);
    }

    const subTab = App.state.googleAdsDashboardSubTab || 'overview';
    const allAds = Array.isArray(App.state.googleAdsCampaignsCache) ? App.state.googleAdsCampaignsCache : [];
    const isMock = Boolean(App.state.googleAdsCampaignsAreMock);

    // Separar campanhas Ads em (vinculadas a alguma LJ Campaign) vs (órfãs).
    const ljCampaigns = Array.isArray(App.state.campaigns) ? App.state.campaigns : [];
    const linkedExternalIds = new Set();
    ljCampaigns.forEach(c => (c.externalLinks?.googleAds || []).forEach(id => linkedExternalIds.add(String(id))));

    const orphans = allAds.filter(a => !linkedExternalIds.has(String(a.campaign_id)));
    const linked = allAds.filter(a =>  linkedExternalIds.has(String(a.campaign_id)));

    return `<div class="space-y-4">
      ${this._hero(isMock, orphans.length)}
      ${this._subTabsBar(subTab, orphans.length)}
      ${subTab === 'orphans'
        ? this._renderOrphans(orphans, ljCampaigns)
        : this._renderOverview(linked, ljCampaigns)}
    </div>`;
  },

  _hero(isMock, orphansCount) {
    const mockBadge = isMock
      ? `<span class="ml-2 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-amber-100 border border-amber-300 text-amber-800">Dados de exemplo</span>`
      : '';
    const orphanBadge = orphansCount > 0
      ? `<span class="ml-2 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-rose-100 border border-rose-300 text-rose-800">${orphansCount} não associada${orphansCount > 1 ? 's' : ''}</span>`
      : '';
    // V35.7.0-alpha4 — Botão "Sincronizar agora" quando OAuth conectado.
    const oauthDone = Boolean(App.state.googleAdsStatus?.oauthCompleted);
    const syncBtn = oauthDone
      ? `<button onclick="Actions.triggerGoogleAdsSync()"
          class="shrink-0 px-3 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-black inline-flex items-center gap-1.5"
          style="color:#fff!important;">
          <i data-lucide="refresh-cw" class="w-3.5 h-3.5"></i> Sincronizar agora
        </button>`
      : '';
    return `<div class="rounded-3xl p-6 lg:p-8" style="background: linear-gradient(135deg, rgba(244,114,182,.18), rgba(249,168,212,.10)); border: 1px solid rgba(244,114,182,.30);">
      <div class="flex items-start gap-4">
        <div class="shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center" style="background: rgba(244,114,182,.20); border: 1px solid rgba(244,114,182,.40);">
          <i data-lucide="search" class="w-7 h-7" style="color: #F472B6;"></i>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-[10px] font-black uppercase tracking-widest mb-1" style="color: #F472B6;">Marketing · Aquisição</p>
          <h2 class="text-2xl lg:text-3xl font-black text-slate-900 flex items-center flex-wrap gap-2">Google Ads ${mockBadge}${orphanBadge}</h2>
          <p class="text-sm text-slate-600 mt-2">Search, Display, YouTube, Performance Max. Vincule cada campanha Ads a uma Campanha LJ pra consolidar gasto, ROAS e conversões por iniciativa.</p>
        </div>
        ${syncBtn}
      </div>
    </div>`;
  },

  _subTabsBar(active, orphansCount) {
    const tab = (id, label, icon, badge = '') => {
      const isActive = active === id;
      return `<button onclick="Actions.setGoogleAdsDashboardSubTab('${id}')"
        class="px-4 py-2.5 rounded-xl border-2 transition flex items-center gap-2 ${isActive ? 'bg-pink-600 border-pink-600 text-white' : 'bg-white border-slate-200 text-slate-700 hover:border-pink-300 hover:bg-pink-50'}" ${isActive ? 'style="color:#fff!important;"' : ''}>
        <i data-lucide="${icon}" class="w-4 h-4"></i>
        <span class="font-black text-sm">${label}</span>
        ${badge}
      </button>`;
    };
    const orphanCountBadge = orphansCount > 0
      ? `<span class="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ${active === 'orphans' ? 'bg-white text-pink-700' : 'bg-rose-100 text-rose-700'}">${orphansCount}</span>`
      : '';
    return `<div class="flex flex-wrap gap-2">
      ${tab('overview', 'Visão geral', 'layout-dashboard')}
      ${tab('orphans', 'Não associadas', 'link-2-off', orphanCountBadge)}
    </div>`;
  },

  _renderOrphans(orphans, ljCampaigns) {
    if (!orphans.length) {
      return `<div class="rounded-3xl bg-emerald-50 border border-emerald-200 p-8 text-center">
        <i data-lucide="check-circle-2" class="w-10 h-10 text-emerald-600 mx-auto mb-3"></i>
        <p class="text-sm font-black text-emerald-900">Tudo certo — nenhuma campanha Ads órfã.</p>
        <p class="text-[12px] text-emerald-700 mt-1">Cada campanha do Google Ads já está vinculada a uma Campanha LJ.</p>
      </div>`;
    }

    return `<div class="space-y-3">
      <div class="rounded-2xl bg-rose-50 border border-rose-200 p-4 flex items-start gap-3">
        <i data-lucide="alert-circle" class="w-5 h-5 text-rose-700 mt-0.5 shrink-0"></i>
        <div class="flex-1 text-sm text-rose-900">
          <p class="font-black">Estas campanhas Google Ads ainda não estão vinculadas a nenhuma Campanha LJ.</p>
          <p class="text-[12px] mt-1">Sem vincular, os dados não consolidam por iniciativa no Mapa da Receita nem no Pulso. Clique em <b>Associar</b> pra abrir o wizard.</p>
        </div>
        <button onclick="Actions.openAdsAssociationWizard('google-ads', [])" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black inline-flex items-center gap-1.5 shrink-0" style="color:#fff!important;">
          <i data-lucide="link" class="w-3.5 h-3.5"></i> Associar todas
        </button>
      </div>

      <div class="grid md:grid-cols-2 gap-3">
        ${orphans.map(c => this._orphanCard(c)).join('')}
      </div>
    </div>`;
  },

  _orphanCard(c) {
    const m = c.metrics_30d || {};
    const channelType = (c.advertising_channel_type || '').replace('_', ' ');
    return `<div class="rounded-2xl bg-white border border-slate-200 border-l-4 border-l-rose-500 p-4 flex flex-col gap-3 shadow-sm">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="text-[10px] font-black uppercase tracking-widest text-rose-700">${Utils.escape(channelType)} · ${Utils.escape(c.status || '?')}</p>
          <p class="text-sm font-black text-slate-900 mt-1 truncate">${Utils.escape(c.campaign_name || c.campaign_id)}</p>
          <p class="text-[10px] text-slate-500 font-mono mt-0.5">ID ${Utils.escape(c.campaign_id || '?')}</p>
        </div>
        <span class="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-rose-100 border border-rose-300 text-rose-700 shrink-0">Órfã</span>
      </div>

      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="rounded-lg bg-slate-50 border border-slate-200 p-2">
          <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">Gasto 30d</p>
          <p class="text-[12px] font-black text-slate-900 mt-0.5">R$ ${this._fmtMoney(m.cost_brl)}</p>
        </div>
        <div class="rounded-lg bg-slate-50 border border-slate-200 p-2">
          <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">Cliques</p>
          <p class="text-[12px] font-black text-slate-900 mt-0.5">${this._fmtInt(m.clicks)}</p>
        </div>
        <div class="rounded-lg bg-slate-50 border border-slate-200 p-2">
          <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">Conversões</p>
          <p class="text-[12px] font-black text-slate-900 mt-0.5">${this._fmtInt(m.conversions)}</p>
        </div>
      </div>

      <button onclick="Actions.openAdsAssociationWizard('google-ads', ['${Utils.escape(c.campaign_id)}'])"
        class="mt-1 px-3 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-black inline-flex items-center justify-center gap-1.5"
        style="color:#fff!important;">
        <i data-lucide="link" class="w-3.5 h-3.5"></i> Associar a uma Campanha LJ
      </button>
    </div>`;
  },

  _renderOverview(linked, ljCampaigns) {
    if (!linked.length) {
      return `<div class="rounded-3xl bg-slate-50 border-2 border-dashed border-slate-200 p-12 text-center">
        <i data-lucide="link-2-off" class="w-10 h-10 text-slate-400 mx-auto mb-3"></i>
        <p class="text-sm font-black text-slate-700">Nenhuma campanha Ads vinculada ainda.</p>
        <p class="text-[12px] text-slate-500 mt-1">Vá para a aba "Não associadas" e amarre cada campanha Ads a uma Campanha LJ.</p>
      </div>`;
    }

    // Agrupa por Campanha LJ.
    const byLj = new Map();
    linked.forEach(ad => {
      const lj = ljCampaigns.find(c => (c.externalLinks?.googleAds || []).map(String).includes(String(ad.campaign_id)));
      if (!lj) return;
      if (!byLj.has(lj.id)) byLj.set(lj.id, { lj, ads: [] });
      byLj.get(lj.id).ads.push(ad);
    });

    return `<div class="space-y-4">
      ${Array.from(byLj.values()).map(({ lj, ads }) => this._ljCampaignBlock(lj, ads)).join('')}
    </div>`;
  },

  _ljCampaignBlock(lj, ads) {
    let cost = 0, clicks = 0, impressions = 0, conversions = 0, conversionsValue = 0;
    ads.forEach(a => {
      const m = a.metrics_30d || {};
      cost += Number(m.cost_brl || 0);
      clicks += Number(m.clicks || 0);
      impressions += Number(m.impressions || 0);
      conversions += Number(m.conversions || 0);
      conversionsValue += Number(m.conversions_value || 0);
    });
    const roas = cost > 0 ? (conversionsValue / cost) : 0;
    const cpl = conversions > 0 ? (cost / conversions) : 0;
    const ctr = impressions > 0 ? ((clicks / impressions) * 100) : 0;

    return `<div class="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <div class="p-5 border-b border-slate-100" style="background: linear-gradient(135deg, rgba(244,114,182,.10), rgba(249,168,212,.05));">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div class="min-w-0">
            <p class="text-[10px] font-black uppercase tracking-widest text-pink-700">Campanha LJ</p>
            <h3 class="text-xl font-black text-slate-900 mt-0.5">${Utils.escape(lj.name)}</h3>
            <p class="text-[11px] text-slate-500 mt-0.5">${ads.length} campanha${ads.length > 1 ? 's' : ''} Ads vinculada${ads.length > 1 ? 's' : ''} · ${Utils.escape(lj.sector || 'Marketing')}</p>
          </div>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
            <div class="rounded-lg bg-white border border-slate-200 p-2 text-center min-w-[80px]">
              <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">Gasto 30d</p>
              <p class="text-sm font-black text-slate-900 mt-0.5">R$ ${this._fmtMoney(cost)}</p>
            </div>
            <div class="rounded-lg bg-white border border-slate-200 p-2 text-center min-w-[80px]">
              <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">ROAS</p>
              <p class="text-sm font-black ${roas >= 3 ? 'text-emerald-700' : roas >= 1 ? 'text-amber-700' : 'text-rose-700'} mt-0.5">${roas.toFixed(2)}x</p>
            </div>
            <div class="rounded-lg bg-white border border-slate-200 p-2 text-center min-w-[80px]">
              <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">CPL</p>
              <p class="text-sm font-black text-slate-900 mt-0.5">R$ ${this._fmtMoney(cpl)}</p>
            </div>
            <div class="rounded-lg bg-white border border-slate-200 p-2 text-center min-w-[80px]">
              <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">CTR</p>
              <p class="text-sm font-black text-slate-900 mt-0.5">${ctr.toFixed(2)}%</p>
            </div>
          </div>
        </div>
      </div>

      <div class="divide-y divide-slate-100">
        ${ads.map(a => this._linkedAdRow(a)).join('')}
      </div>
    </div>`;
  },

  _linkedAdRow(a) {
    const m = a.metrics_30d || {};
    const channelType = (a.advertising_channel_type || '').replace('_', ' ');
    return `<div class="p-4 flex items-center justify-between gap-3 hover:bg-slate-50">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap">
          <p class="text-sm font-black text-slate-900 truncate">${Utils.escape(a.campaign_name || a.campaign_id)}</p>
          <span class="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-pink-100 text-pink-700">${Utils.escape(channelType)}</span>
          <span class="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700">${Utils.escape(a.status || '')}</span>
        </div>
        <p class="text-[10px] text-slate-500 font-mono mt-0.5">ID ${Utils.escape(a.campaign_id)}</p>
      </div>
      <div class="hidden md:flex gap-3 text-right">
        <div>
          <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">Gasto 30d</p>
          <p class="text-[12px] font-black text-slate-900">R$ ${this._fmtMoney(m.cost_brl)}</p>
        </div>
        <div>
          <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">Conv.</p>
          <p class="text-[12px] font-black text-slate-900">${this._fmtInt(m.conversions)}</p>
        </div>
      </div>
      <button onclick="Actions.unlinkGoogleAdsCampaignFromLj('${Utils.escape(a.campaign_id)}')"
        class="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-300 text-rose-700 text-[10px] font-black inline-flex items-center gap-1 shrink-0"
        title="Desvincular esta campanha Ads">
        <i data-lucide="unlink" class="w-3 h-3"></i> Desvincular
      </button>
    </div>`;
  },

  _fmtMoney(n) {
    const v = Number(n || 0);
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  _fmtInt(n) {
    return Number(n || 0).toLocaleString('pt-BR');
  }
};
