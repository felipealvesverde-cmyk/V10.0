// V31.1.0 — Wizard "Conectar ao Mapa da Receita"
// Plug uma ação operacional (criada no menu Ações de Campanha) num KR-mãe do
// Mapa Estratégico V29. 3 passos: Frente → KR-mãe → Confirmar.
// Após confirmar, ação ganha strategicAreaId + entra no connectedActionIds do KR.
window.ConnectActionWizardModal = {
  render() {
    const wiz = App.state.connectActionWizard;
    if (!wiz || !wiz.open) return '';
    const action = (App.state.actions || []).find(a => Number(a.id) === Number(wiz.actionId));
    if (!action) return '';
    const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(action.campaignId));
    const productId = campaign?.productId;
    const product = (App.state.products || []).find(p => Number(p.id) === Number(productId));
    if (!product) {
      return this._errorShell('Campanha desta ação não tem produto vinculado. Não dá pra conectar ao Mapa.');
    }
    return `<div class="fixed inset-0 z-[95] bg-slate-950/85 backdrop-blur-sm grid place-items-center p-4">
      <div class="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden">
        ${this._header(action, product, wiz)}
        <div class="p-5 max-h-[70vh] overflow-y-auto">
          ${this._steps(wiz)}
          ${wiz.step === 1 ? this._stepArea(product, wiz) : ''}
          ${wiz.step === 2 ? this._stepProductKr(product, wiz) : ''}
          ${wiz.step === 3 ? this._stepConfirm(action, product, wiz) : ''}
        </div>
        ${this._footer(wiz)}
      </div>
    </div>`;
  },

  _header(action, product, wiz) {
    return `<header class="bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white p-5">
      <div class="flex items-center gap-2 mb-2">
        <i data-lucide="compass" class="w-4 h-4"></i>
        <p class="text-[11px] font-black uppercase tracking-wider opacity-90">Conectar ao Mapa da Receita</p>
      </div>
      <h3 class="text-xl font-black">${Utils.escape(action.name)}</h3>
      <p class="text-xs opacity-90 mt-1">Produto <b>${Utils.escape(product.name)}</b> · ${Utils.escape(action.channel || '')}</p>
    </header>`;
  },

  _steps(wiz) {
    const steps = [
      { id: 1, label: 'Frente' },
      { id: 2, label: 'KR-mãe' },
      { id: 3, label: 'Confirmar' }
    ];
    return `<div class="grid grid-cols-3 gap-2 mb-4">
      ${steps.map(s => {
        const done = wiz.step > s.id;
        const active = wiz.step === s.id;
        const cls = done
          ? 'bg-emerald-500 text-white'
          : active
            ? 'bg-indigo-600 text-white ring-2 ring-indigo-300'
            : 'bg-slate-100 text-slate-500';
        return `<div class="rounded-2xl ${cls} p-2.5 text-center" style="${active || done ? 'color:#fff!important;' : ''}">
          <div class="font-black text-xs">${done ? '✓' : s.id}</div>
          <div class="text-[10px] font-bold opacity-90">${s.label}</div>
        </div>`;
      }).join('')}
    </div>`;
  },

  _stepArea(product, wiz) {
    const areas = window.StrategicMapEngine?.COMERCIAL_AREAS || [];
    return `<section class="space-y-3">
      <p class="text-sm font-black text-slate-700">Qual frente comercial essa ação alimenta?</p>
      <p class="text-xs text-slate-500">Marketing gera leads, Vendas fecha clientes, Sucesso devolve advogados. Onde essa ação atua?</p>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
        ${areas.map(area => {
          const isSelected = wiz.areaId === area.id;
          const tone = area.color;
          return `<button onclick="Actions.connectWizardPickArea('${area.id}')" class="rounded-2xl p-4 border-2 ${isSelected ? `border-${tone}-500 bg-${tone}-50` : 'border-slate-200 bg-white hover:bg-slate-50'} text-left transition">
            <div class="w-10 h-10 rounded-xl bg-${tone}-100 grid place-items-center mb-2"><i data-lucide="${area.icon}" class="w-5 h-5 text-${tone}-600"></i></div>
            <p class="font-black text-slate-900 text-sm">${Utils.escape(area.label)}</p>
            <p class="text-[11px] text-slate-500 mt-1">${Utils.escape(area.handoff || '')}</p>
          </button>`;
        }).join('')}
      </div>
    </section>`;
  },

  _stepProductKr(product, wiz) {
    const map = window.StrategicMapEngine?.getForProduct(product.id);
    const allKrs = (map?.productKrs || []).filter(k => k.area === wiz.areaId);
    const area = (window.StrategicMapEngine?.COMERCIAL_AREAS || []).find(a => a.id === wiz.areaId);
    const tone = area?.color || 'indigo';
    return `<section class="space-y-3">
      <p class="text-sm font-black text-slate-700">Qual KR-mãe do produto essa ação move?</p>
      <p class="text-xs text-slate-500">Os números do produto (definidos pelo CEO na etapa 3 do Mapa) que se conectam à frente <b>${Utils.escape(area?.label || '')}</b>.</p>
      ${allKrs.length === 0
        ? `<div class="rounded-2xl bg-amber-50 border border-amber-300 p-4 text-amber-900 text-sm">
            <p class="font-black mb-1">⚠️ Nenhum KR-mãe definido nessa frente</p>
            <p class="text-xs">O CEO precisa ir no Mapa da Receita → etapa 3 'Os Números' e definir KRs-mãe para <b>${Utils.escape(area?.label || '')}</b> antes de você conectar uma ação aqui.</p>
          </div>`
        : `<div class="grid grid-cols-1 gap-2 pt-2">
            ${allKrs.map(kr => {
              const isSelected = wiz.productKrId === kr.id;
              return `<button onclick="Actions.connectWizardPickProductKr('${kr.id}')" class="rounded-2xl p-3 border-2 ${isSelected ? `border-${tone}-500 bg-${tone}-50` : 'border-slate-200 bg-white hover:bg-slate-50'} text-left transition">
                <div class="flex items-center justify-between gap-2">
                  <div class="min-w-0">
                    <p class="font-black text-slate-900 text-sm">${Utils.escape(kr.name)}</p>
                    <p class="text-[11px] text-slate-500 mt-0.5">Target: <b>${Number(kr.target || 0)}</b> ${Utils.escape(kr.unit || kr.metric || '')} · Atual: ${Number(kr.current || 0)}</p>
                  </div>
                  ${isSelected ? `<i data-lucide="check-circle" class="w-5 h-5 text-${tone}-600 shrink-0"></i>` : ''}
                </div>
              </button>`;
            }).join('')}
          </div>`}
    </section>`;
  },

  _stepConfirm(action, product, wiz) {
    const area = (window.StrategicMapEngine?.COMERCIAL_AREAS || []).find(a => a.id === wiz.areaId);
    const map = window.StrategicMapEngine?.getForProduct(product.id);
    const productKr = (map?.productKrs || []).find(k => k.id === wiz.productKrId);
    const owner = window.StrategicMapEngine?.getAreaOwner ? StrategicMapEngine.getAreaOwner(product.id, wiz.areaId) : '';
    const tone = area?.color || 'indigo';
    return `<section class="space-y-3">
      <p class="text-sm font-black text-slate-700">Tudo certo? Revise antes de plugar.</p>
      <div class="rounded-3xl bg-${tone}-50 border border-${tone}-200 p-4 space-y-3">
        <div class="flex items-center gap-2 pb-2 border-b border-${tone}-200">
          <i data-lucide="${area?.icon || 'flag'}" class="w-4 h-4 text-${tone}-600"></i>
          <p class="font-black text-${tone}-900 text-sm">${Utils.escape(area?.label || '')}</p>
        </div>
        <div>
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Ação</p>
          <p class="font-bold text-slate-900 text-sm">${Utils.escape(action.name)}</p>
          <p class="text-[11px] text-slate-500">${Utils.escape(action.channel || '')} · ${Utils.escape(action.actionType || '')}</p>
        </div>
        <div>
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Alimenta o KR-mãe</p>
          <p class="font-bold text-slate-900 text-sm">${Utils.escape(productKr?.name || '')}</p>
          <p class="text-[11px] text-slate-500">Target ${Number(productKr?.target || 0)} ${Utils.escape(productKr?.unit || productKr?.metric || '')}</p>
        </div>
        <div>
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Dono herdado</p>
          <p class="font-bold text-slate-900 text-sm">${Utils.escape(owner || '— sem dono definido —')}</p>
        </div>
        <div class="rounded-xl bg-white border border-${tone}-200 p-2.5 text-[11px] text-slate-700">
          <b>Ao confirmar:</b> ação ganha tag azul, entra no rollup do KR-mãe e passa a contar como ação ativa da campanha no Mapa.
        </div>
      </div>
    </section>`;
  },

  _footer(wiz) {
    const canAdvance = (wiz.step === 1 && wiz.areaId) || (wiz.step === 2 && wiz.productKrId) || wiz.step === 3;
    return `<footer class="border-t border-slate-100 p-4 flex items-center justify-between gap-2 bg-slate-50">
      <button onclick="Actions.closeConnectWizard()" class="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs">Cancelar</button>
      <div class="flex items-center gap-2">
        ${wiz.step > 1 ? `<button onclick="Actions.connectWizardBack()" class="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-black text-xs flex items-center gap-1.5"><i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Voltar</button>` : ''}
        ${wiz.step < 3
          ? `<button ${canAdvance ? '' : 'disabled'} onclick="Actions.connectWizardNext()" class="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-black text-xs flex items-center gap-1.5" style="color:#fff!important;">Próximo <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i></button>`
          : `<button onclick="Actions.connectWizardConfirm()" class="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5" style="color:#fff!important;"><i data-lucide="check" class="w-3.5 h-3.5"></i> Plugar agora</button>`}
      </div>
    </footer>`;
  },

  _errorShell(message) {
    return `<div class="fixed inset-0 z-[95] bg-slate-950/85 backdrop-blur-sm grid place-items-center p-4">
      <div class="bg-white rounded-3xl shadow-2xl p-6 max-w-md">
        <p class="font-black text-rose-700 mb-2">Não foi possível abrir o conector</p>
        <p class="text-sm text-slate-700 mb-4">${Utils.escape(message)}</p>
        <button onclick="Actions.closeConnectWizard()" class="px-4 py-2 rounded-xl bg-slate-900 text-white font-black text-xs" style="color:#fff!important;">Fechar</button>
      </div>
    </div>`;
  }
};
