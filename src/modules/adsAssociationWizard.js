// V35.7.0-alpha2 — Wizard de Associação Ads ↔ Campanha LJ.
//
// 4 steps espelhando leadImportWizard:
//   1 — Selecionar campanhas Ads órfãs (multi-checkbox)
//   2 — Escolher Campanha LJ destino (dropdown + criar nova inline)
//   3 — Revisar consolidação (preview do que vai virar)
//   4 — Confirmar (salva mapping → state.campaigns[].externalLinks)
//
// Aberto via Actions.openAdsAssociationWizard(platform, preSelectedIds).

window.AdsAssociationWizard = {
  render() {
    const w = App.state.adsAssociationWizard;
    if (!w?.open) return '';

    return `<div class="fixed inset-0 z-[90] grid place-items-center p-4"
      style="background: rgba(15,23,42,0.78); backdrop-filter: blur(6px);"
      onclick="if(event.target===this) Actions.closeAdsAssociationWizard()">
      <div class="w-full max-w-3xl rounded-3xl bg-white shadow-2xl border-2 border-pink-300 overflow-hidden">

        <!-- HEADER -->
        <div class="bg-gradient-to-r from-pink-600 to-rose-600 px-6 py-4 text-white flex items-start justify-between gap-3">
          <div>
            <p class="text-[10px] font-black text-pink-100 uppercase tracking-widest">Vincular Ads → Campanha LJ</p>
            <h2 class="text-lg font-black leading-tight">${this._headerTitle(w)}</h2>
          </div>
          <button onclick="Actions.closeAdsAssociationWizard()" class="shrink-0 w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 text-white grid place-items-center">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        ${this._stepper(w)}

        <main class="p-5 lg:p-6 max-h-[60vh] overflow-y-auto">
          ${w.step === 1 ? this._step1Select(w) : ''}
          ${w.step === 2 ? this._step2ChooseLj(w) : ''}
          ${w.step === 3 ? this._step3Review(w) : ''}
          ${w.step === 4 ? this._step4Done(w) : ''}
        </main>

        <footer class="px-6 py-3 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50">
          ${w.step > 1 && w.step < 4 ? `<button onclick="Actions.adsWizardSetStep(${w.step - 1})" class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-black inline-flex items-center gap-1.5">
            <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Voltar
          </button>` : '<span></span>'}
          ${this._primaryAction(w)}
        </footer>
      </div>
    </div>`;
  },

  _headerTitle(w) {
    if (w.step === 1) return 'Escolha as campanhas Ads';
    if (w.step === 2) return 'Vincular a qual Campanha LJ?';
    if (w.step === 3) return 'Revisar consolidação';
    if (w.step === 4) return 'Pronto!';
    return 'Vincular';
  },

  _stepper(w) {
    const steps = [
      { n: 1, label: 'Selecionar' },
      { n: 2, label: 'Campanha LJ' },
      { n: 3, label: 'Revisar' },
      { n: 4, label: 'Pronto' }
    ];
    return `<div class="px-6 pt-4">
      <div class="flex items-center gap-2">
        ${steps.map(s => {
          const active = w.step === s.n;
          const done = w.step > s.n;
          const cls = done ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                    : active ? 'bg-pink-100 border-pink-300 text-pink-800'
                    : 'bg-slate-100 border-slate-200 text-slate-500';
          return `<div class="flex-1 px-3 py-1.5 rounded-lg border ${cls} text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5">
            <span class="w-4 h-4 rounded-full bg-white/60 grid place-items-center text-[9px]">${done ? '✓' : s.n}</span>
            ${s.label}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  },

  _step1Select(w) {
    const allAds = Array.isArray(App.state.googleAdsCampaignsCache) ? App.state.googleAdsCampaignsCache : [];
    const ljCampaigns = Array.isArray(App.state.campaigns) ? App.state.campaigns : [];
    const linkedSet = new Set();
    ljCampaigns.forEach(c => (c.externalLinks?.googleAds || []).forEach(id => linkedSet.add(String(id))));
    const orphans = allAds.filter(a => !linkedSet.has(String(a.campaign_id)));

    if (!orphans.length) {
      return `<div class="rounded-2xl bg-emerald-50 border border-emerald-200 p-6 text-center">
        <i data-lucide="check-circle-2" class="w-10 h-10 text-emerald-600 mx-auto mb-2"></i>
        <p class="text-sm font-black text-emerald-900">Nenhuma campanha Ads órfã.</p>
        <p class="text-[12px] text-emerald-700 mt-1">Todas já estão vinculadas a alguma Campanha LJ.</p>
      </div>`;
    }

    const selected = new Set(w.selectedExternalIds || []);

    return `<div class="space-y-3">
      <p class="text-[12px] text-slate-600">Marque as campanhas Google Ads que vão pertencer à mesma Campanha LJ. Você pode marcar várias — elas vão consolidar gasto e ROAS em uma só visão.</p>

      <div class="space-y-2">
        ${orphans.map(c => {
          const isSelected = selected.has(String(c.campaign_id));
          const m = c.metrics_30d || {};
          return `<label class="block cursor-pointer rounded-2xl border-2 ${isSelected ? 'border-pink-400 bg-pink-50' : 'border-slate-200 bg-white hover:border-pink-200'} p-3 transition">
            <div class="flex items-start gap-3">
              <input type="checkbox" ${isSelected ? 'checked' : ''}
                onchange="Actions.adsWizardToggleExternal('${Utils.escape(c.campaign_id)}')"
                class="mt-1 w-4 h-4 accent-pink-600 cursor-pointer">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="text-sm font-black text-slate-900">${Utils.escape(c.campaign_name || c.campaign_id)}</p>
                  <span class="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-pink-100 text-pink-700">${Utils.escape((c.advertising_channel_type || '').replace('_', ' '))}</span>
                </div>
                <p class="text-[10px] text-slate-500 mt-1">Gasto 30d <b>R$ ${this._fmtMoney(m.cost_brl)}</b> · ${this._fmtInt(m.clicks)} cliques · ${this._fmtInt(m.conversions)} conversões</p>
              </div>
            </div>
          </label>`;
        }).join('')}
      </div>
    </div>`;
  },

  _step2ChooseLj(w) {
    const ljCampaigns = Array.isArray(App.state.campaigns) ? App.state.campaigns : [];
    const showCreateForm = Boolean(w.creatingNewLj);
    const selectedLjId = w.selectedLjId || '';

    return `<div class="space-y-4">
      <p class="text-[12px] text-slate-600">Escolha uma Campanha LJ existente ou crie uma nova agora.</p>

      ${!showCreateForm ? `<div class="space-y-2">
        <label class="block">
          <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">Campanha LJ existente</span>
          <select onchange="Actions.adsWizardSetLjId(this.value)"
            class="mt-1 w-full px-3 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-bold text-slate-900">
            <option value="">— Escolha —</option>
            ${ljCampaigns.map(c => `<option value="${c.id}" ${String(selectedLjId) === String(c.id) ? 'selected' : ''}>${Utils.escape(c.name)}${c.sector ? ` · ${Utils.escape(c.sector)}` : ''}</option>`).join('')}
          </select>
        </label>

        <button onclick="Actions.adsWizardToggleCreateForm()"
          class="w-full px-3 py-2.5 rounded-xl bg-white border-2 border-dashed border-pink-300 text-pink-700 text-sm font-black inline-flex items-center justify-center gap-2 hover:bg-pink-50">
          <i data-lucide="plus" class="w-4 h-4"></i> Criar nova Campanha LJ
        </button>
      </div>` : this._step2CreateForm(w)}
    </div>`;
  },

  _step2CreateForm(w) {
    const d = w.newLjDraft || { name: '', objective: '', owner: '', sector: 'Marketing', productId: null };
    const products = Array.isArray(App.state.products) ? App.state.products : [];
    const sectors = (window.Config?.sectors) || ['Marketing', 'Vendas', 'CS'];

    return `<div class="rounded-2xl bg-pink-50 border border-pink-200 p-4 space-y-3">
      <div class="flex items-center justify-between">
        <p class="text-[10px] font-black uppercase tracking-widest text-pink-800">Nova Campanha LJ</p>
        <button onclick="Actions.adsWizardToggleCreateForm()" class="text-[10px] font-black text-pink-700 hover:underline">← voltar pra lista</button>
      </div>

      <label class="block">
        <span class="text-[10px] font-black uppercase tracking-widest text-slate-600">Nome</span>
        <input type="text" value="${Utils.escape(d.name)}"
          oninput="Actions.adsWizardUpdateDraft('name', this.value)"
          placeholder="Ex: Black Friday 2025"
          class="mt-1 w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-bold text-slate-900">
      </label>

      <label class="block">
        <span class="text-[10px] font-black uppercase tracking-widest text-slate-600">Produto</span>
        <select onchange="Actions.adsWizardUpdateDraft('productId', this.value)"
          class="mt-1 w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-bold text-slate-900">
          <option value="">— Escolha o produto —</option>
          ${products.map(p => `<option value="${p.id}" ${String(d.productId) === String(p.id) ? 'selected' : ''}>${Utils.escape(p.name)}</option>`).join('')}
        </select>
      </label>

      <label class="block">
        <span class="text-[10px] font-black uppercase tracking-widest text-slate-600">Objetivo (opcional)</span>
        <input type="text" value="${Utils.escape(d.objective)}"
          oninput="Actions.adsWizardUpdateDraft('objective', this.value)"
          placeholder="Ex: Maximizar conversões com ROAS 4x"
          class="mt-1 w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-bold text-slate-900">
      </label>

      <div class="grid grid-cols-2 gap-2">
        <label class="block">
          <span class="text-[10px] font-black uppercase tracking-widest text-slate-600">Responsável</span>
          <input type="text" value="${Utils.escape(d.owner)}"
            oninput="Actions.adsWizardUpdateDraft('owner', this.value)"
            placeholder="Quem cuida"
            class="mt-1 w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-bold text-slate-900">
        </label>

        <label class="block">
          <span class="text-[10px] font-black uppercase tracking-widest text-slate-600">Setor</span>
          <select onchange="Actions.adsWizardUpdateDraft('sector', this.value)"
            class="mt-1 w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-sm font-bold text-slate-900">
            ${sectors.map(s => `<option value="${s}" ${d.sector === s ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </label>
      </div>
    </div>`;
  },

  _step3Review(w) {
    const selectedExternalIds = w.selectedExternalIds || [];
    const allAds = Array.isArray(App.state.googleAdsCampaignsCache) ? App.state.googleAdsCampaignsCache : [];
    const selectedAds = allAds.filter(a => selectedExternalIds.includes(String(a.campaign_id)));

    let cost = 0, clicks = 0, impressions = 0, conversions = 0, conversionsValue = 0;
    selectedAds.forEach(a => {
      const m = a.metrics_30d || {};
      cost += Number(m.cost_brl || 0);
      clicks += Number(m.clicks || 0);
      impressions += Number(m.impressions || 0);
      conversions += Number(m.conversions || 0);
      conversionsValue += Number(m.conversions_value || 0);
    });
    const roas = cost > 0 ? (conversionsValue / cost) : 0;
    const cpl = conversions > 0 ? (cost / conversions) : 0;

    let ljLabel;
    if (w.creatingNewLj) {
      const d = w.newLjDraft || {};
      ljLabel = `[NOVA] ${d.name || '(sem nome)'} · ${d.sector || 'Marketing'}`;
    } else {
      const lj = (App.state.campaigns || []).find(c => Number(c.id) === Number(w.selectedLjId));
      ljLabel = lj ? `${lj.name}${lj.sector ? ' · ' + lj.sector : ''}` : '(não escolhida)';
    }

    return `<div class="space-y-4">
      <div class="rounded-2xl bg-pink-50 border border-pink-200 p-4">
        <p class="text-[10px] font-black uppercase tracking-widest text-pink-800">Vai vincular</p>
        <p class="text-sm font-black text-slate-900 mt-1">${selectedAds.length} campanha${selectedAds.length > 1 ? 's' : ''} Ads → <b>${Utils.escape(ljLabel)}</b></p>
      </div>

      <div class="rounded-2xl bg-white border border-slate-200 divide-y divide-slate-100">
        ${selectedAds.map(a => `<div class="p-3 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-black text-slate-900 truncate">${Utils.escape(a.campaign_name || a.campaign_id)}</p>
            <p class="text-[10px] text-slate-500">Gasto 30d R$ ${this._fmtMoney(a.metrics_30d?.cost_brl)} · ${this._fmtInt(a.metrics_30d?.conversions)} conversões</p>
          </div>
          <span class="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 shrink-0">${Utils.escape((a.advertising_channel_type || '').replace('_', ' '))}</span>
        </div>`).join('')}
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
          <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">Gasto 30d</p>
          <p class="text-sm font-black text-slate-900 mt-0.5">R$ ${this._fmtMoney(cost)}</p>
        </div>
        <div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
          <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">ROAS</p>
          <p class="text-sm font-black ${roas >= 3 ? 'text-emerald-700' : roas >= 1 ? 'text-amber-700' : 'text-rose-700'} mt-0.5">${roas.toFixed(2)}x</p>
        </div>
        <div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
          <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">CPL</p>
          <p class="text-sm font-black text-slate-900 mt-0.5">R$ ${this._fmtMoney(cpl)}</p>
        </div>
        <div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
          <p class="text-[9px] font-black uppercase tracking-widest text-slate-500">Conversões</p>
          <p class="text-sm font-black text-slate-900 mt-0.5">${this._fmtInt(conversions)}</p>
        </div>
      </div>
    </div>`;
  },

  _step4Done(w) {
    return `<div class="text-center space-y-4 py-8">
      <div class="inline-flex w-16 h-16 rounded-3xl bg-emerald-100 items-center justify-center">
        <i data-lucide="check" class="w-9 h-9 text-emerald-700"></i>
      </div>
      <div>
        <h3 class="text-lg font-black text-slate-900">Vínculo criado!</h3>
        <p class="text-[12px] text-slate-600 mt-1">As campanhas Ads agora consolidam métricas pela Campanha LJ escolhida.</p>
      </div>
    </div>`;
  },

  _primaryAction(w) {
    if (w.step === 1) {
      const count = (w.selectedExternalIds || []).length;
      const disabled = count === 0;
      return `<button onclick="Actions.adsWizardSetStep(2)" ${disabled ? 'disabled' : ''}
        class="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-black inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        style="${disabled ? 'background:#e2e8f0;color:#94a3b8!important;' : 'color:#fff!important;'}">
        Avançar (${count}) <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
      </button>`;
    }
    if (w.step === 2) {
      const ready = w.creatingNewLj ? Boolean(w.newLjDraft?.name?.trim() && w.newLjDraft?.productId) : Boolean(w.selectedLjId);
      return `<button onclick="Actions.adsWizardSetStep(3)" ${ready ? '' : 'disabled'}
        class="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-black inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        style="${ready ? 'color:#fff!important;' : 'background:#e2e8f0;color:#94a3b8!important;'}">
        Revisar <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
      </button>`;
    }
    if (w.step === 3) {
      return `<button onclick="Actions.confirmAdsAssociation()"
        class="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-black inline-flex items-center gap-1.5"
        style="color:#fff!important;">
        <i data-lucide="link" class="w-3.5 h-3.5"></i> Confirmar vínculo
      </button>`;
    }
    // step 4
    return `<button onclick="Actions.closeAdsAssociationWizard()"
      class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black inline-flex items-center gap-1.5"
      style="color:#fff!important;">
      <i data-lucide="check" class="w-3.5 h-3.5"></i> Concluir
    </button>`;
  },

  _fmtMoney(n) {
    return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  _fmtInt(n) {
    return Number(n || 0).toLocaleString('pt-BR');
  }
};
