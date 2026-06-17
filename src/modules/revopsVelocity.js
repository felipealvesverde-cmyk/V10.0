// V39.3.0 — RevOps & Velocidade
//
// Tela própria no menu lateral logo abaixo de RevOps & Governança.
// Diagnóstico estrutural da máquina por produto: Pipeline Velocity decomposto
// em V (Visitas) × C (Conversão) × L (Ticket) / T (Ciclo) = R$/dia.
//
// Padrão de tela:
//   Header dark "Velocity Layer · Diagnóstico estrutural"
//   Grid de cards de produto (cada um mostra R$/dia + 4 letras compactas)
//   Click no card expande pra diagnóstico completo + simulador (e se dobrar V/C/L/T?)
//
// Sem FlowBreadcrumb — não pertence ao fluxo Produto→Campanha→Ação.

var RevopsVelocityModule = {
  render() {
    const products = (App.state.products || []).filter(p => p.archived !== true);
    return `<div class="space-y-4">
      ${this.velocityLayer(products)}
      <div class="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
        <h2 class="text-xl font-black mb-1">Diagnóstico por produto</h2>
        <p class="text-sm text-slate-500 mb-5">Cada card mostra a velocidade da máquina (R$/dia) decomposta em Visitas × Conversão × Ticket / Ciclo. Clique pra expandir o diagnóstico em prosa + simulador.</p>
        ${products.length === 0
          ? Components.empty('Cadastre um produto antes de ver diagnóstico.')
          : `<div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">${products.map(p => this.productCard(p)).join('')}</div>`}
      </div>
    </div>`;
  },

  velocityLayer(products) {
    const cache = App.state.pipelineVelocityCache;
    const status = cache?.loading ? 'loading' : cache?.error ? 'error' : cache?.loaded ? 'ok' : 'idle';
    // Velocidade agregada do tenant
    let totalVelocity = 0;
    let countOk = 0;
    if (status === 'ok' && window.PipelineVelocityEngine) {
      for (const p of products) {
        const s = PipelineVelocityEngine.forProduct(p.id);
        if (s && s.status === 'ok' && s.velocity > 0) {
          totalVelocity += s.velocity;
          countOk++;
        }
      }
    }
    const totalMes = totalVelocity * (cache?.period?.daysInMonth || 30);
    return `<div class="bg-slate-950 text-white rounded-[2rem] p-5 shadow-sm overflow-hidden relative">
      <div class="absolute inset-0 opacity-60" style="background: radial-gradient(circle at 20% 10%, rgba(139,92,246,.18), transparent 30%), radial-gradient(circle at 80% 20%, rgba(236,72,153,.14), transparent 32%);"></div>
      <div class="relative z-10 grid lg:grid-cols-[1.2fr_1fr] gap-4 items-center">
        <div>
          <div class="flex items-center gap-2 mb-3"><i data-lucide="gauge" class="w-4 h-4"></i><p class="text-xs font-black text-violet-300 uppercase tracking-wider">Velocity Layer · Diagnóstico estrutural</p></div>
          <p class="text-base text-slate-300 max-w-3xl leading-relaxed">A velocidade da máquina é o R$/dia que a operação gera estruturalmente, decomposta em quatro letras: Visitas × Conversão × Ticket / Ciclo. O diagnóstico aponta qual letra está mais fraca e onde mexer pra dobrar — sem ter que dobrar tudo.</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          ${this._darkMetric('Velocidade total', status === 'ok' ? `${PipelineVelocityEngine.fmtMoney(totalVelocity)}/dia` : '—', 'gauge')}
          ${this._darkMetric('Projeção fim do mês', status === 'ok' ? PipelineVelocityEngine.fmtMoney(totalMes) : '—', 'calendar')}
          ${this._darkMetric('Produtos com leitura', `${countOk}`, 'package')}
          ${this._darkMetric('Status', status === 'ok' ? '✓ Ativo' : status === 'loading' ? 'Carregando…' : status === 'error' ? 'Erro' : '—', 'activity')}
        </div>
      </div>
    </div>`;
  },

  _darkMetric(label, value, icon) {
    return `<div class="bg-white/10 border border-white/10 rounded-2xl p-4"><div class="flex items-center justify-between"><p class="text-xs font-black text-slate-300">${label}</p><i data-lucide="${icon}" class="w-4 h-4 text-slate-300"></i></div><div class="text-2xl font-black mt-2 leading-tight">${value}</div></div>`;
  },

  productCard(product) {
    if (!window.PipelineVelocityEngine) return '';
    const s = PipelineVelocityEngine.forProduct(product.id);
    if (!s) return '';
    const expanded = Number(App.state.revopsVelocityExpandedProductId) === Number(product.id);

    if (s.status === 'blocked') {
      return `<div class="rounded-3xl bg-amber-50 border border-amber-200 border-l-4 border-l-amber-500 p-4">
        <p class="text-[10px] font-black text-amber-700 uppercase tracking-wider mb-1">Velocity bloqueada</p>
        <h3 class="font-black text-base text-amber-900">${Utils.escape(product.name)}</h3>
        <p class="text-xs text-amber-800 leading-relaxed mt-1">Defina como esse produto vende pra destravar Velocity.</p>
        <button onclick="Actions.openAudienceWizardForExisting(${product.id})" class="mt-2 px-3 py-1.5 rounded-xl bg-amber-700 text-white text-xs font-black hover:bg-amber-800" style="color:#fff!important;">Definir agora →</button>
      </div>`;
    }

    if (s.status === 'loading') {
      return `<div class="rounded-3xl bg-slate-50 border border-slate-200 p-4 flex items-center gap-3">
        <div class="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-700 animate-spin shrink-0"></div>
        <p class="text-sm text-slate-600">Carregando Velocity de ${Utils.escape(product.name)}…</p>
      </div>`;
    }

    if (s.status === 'pending') {
      const label = s.salesChannel === 'crm' ? 'CRM' : 'Híbrido';
      return `<div class="rounded-3xl bg-violet-50 border border-violet-200 border-l-4 border-l-violet-500 p-4">
        <p class="text-[10px] font-black text-violet-700 uppercase tracking-wider mb-1">Velocity · ${label}</p>
        <h3 class="font-black text-base text-violet-900">${Utils.escape(product.name)}</h3>
        <p class="text-xs text-violet-800 leading-relaxed mt-1">Modo ${label}: Velocity depende do pipeline RD persistido + Fechamento mensal declarado. Próximas ondas.</p>
      </div>`;
    }

    if (s.status === 'error') {
      return `<div class="rounded-3xl bg-rose-50 border border-rose-200 border-l-4 border-l-rose-500 p-4">
        <p class="text-[10px] font-black text-rose-700 uppercase tracking-wider mb-1">Erro</p>
        <h3 class="font-black text-base text-rose-900">${Utils.escape(product.name)}</h3>
        <p class="text-xs text-rose-800 mt-1">${Utils.escape(App.state.pipelineVelocityCache?.error || 'desconhecido')}</p>
        <button onclick="Actions.loadPipelineVelocitySummary({force:true})" class="mt-2 px-3 py-1.5 rounded-xl bg-rose-700 text-white text-xs font-black hover:bg-rose-800" style="color:#fff!important;">Tentar de novo</button>
      </div>`;
    }

    // ok — desenha card padrão com 4 letras
    const semColor = s.gargalo
      ? (s.gargalo === 'C' || s.gargalo === 'T' ? 'amber' : 'violet')
      : 'emerald';
    return `<div class="rounded-3xl bg-${semColor}-50 border border-${semColor}-200 border-l-4 border-l-${semColor}-500 overflow-hidden">
      <button onclick="Actions.toggleRevopsVelocityProduct(${product.id})" class="w-full text-left p-4 hover:bg-${semColor}-100/40 transition">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="min-w-0 flex-1">
            <p class="text-[10px] font-black text-${semColor}-700 uppercase tracking-wider mb-0.5">Velocity · ${s.yyyymm || ''}</p>
            <h3 class="font-black text-base truncate">${Utils.escape(product.name)}</h3>
            <p class="text-xs text-slate-600 mt-1">${s.customersCount} customers em ${s.V} visitas · ${s.approvedCount} venda(s) processada(s)</p>
          </div>
          <div class="text-right shrink-0">
            <p class="text-[10px] font-black text-slate-500 uppercase">R$/dia</p>
            <p class="font-black text-xl text-${semColor}-700">${PipelineVelocityEngine.fmtMoney(s.velocity)}</p>
          </div>
        </div>
        <div class="grid grid-cols-4 gap-1.5">
          ${this._letterMini('V', 'Visitas', String(s.V), s.gargalo === 'V')}
          ${this._letterMini('C', 'Conversão', PipelineVelocityEngine.fmtPct(s.C), s.gargalo === 'C')}
          ${this._letterMini('L', 'Ticket', PipelineVelocityEngine.fmtMoney(s.L), s.gargalo === 'L')}
          ${this._letterMini('T', 'Ciclo', `${s.T.toFixed(1)}d`, s.gargalo === 'T')}
        </div>
        <p class="text-[10px] text-${semColor}-700 font-black mt-2 text-center">${expanded ? '▲ Recolher' : '▼ Ver diagnóstico'}</p>
      </button>
      ${expanded ? this._expandedBlock(s, product) : ''}
    </div>`;
  },

  _letterMini(letter, name, value, isGargalo) {
    const tone = isGargalo ? 'amber' : 'slate';
    return `<div class="bg-white rounded-xl border ${isGargalo ? 'border-amber-300' : 'border-slate-200'} px-2 py-1.5 text-center ${isGargalo ? 'ring-1 ring-amber-300' : ''}">
      <p class="text-[9px] font-black text-${tone}-600 uppercase tracking-widest">${letter} · ${name}</p>
      <p class="font-black text-sm text-slate-900 mt-0.5">${value}</p>
    </div>`;
  },

  _expandedBlock(s, product) {
    const diag = PipelineVelocityEngine.diagnose(s);
    const sim = PipelineVelocityEngine.simulate(s);
    return `<div class="border-t border-slate-200 bg-white p-4 space-y-3">
      <div class="rounded-2xl bg-violet-50 border border-violet-200 border-l-4 border-l-violet-600 p-3 flex items-start gap-2">
        <i data-lucide="lightbulb" class="w-4 h-4 text-violet-700 mt-0.5 shrink-0"></i>
        <div class="min-w-0">
          <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest mb-1">Diagnóstico</p>
          <p class="text-xs text-slate-800 leading-relaxed">${Utils.escape(diag)}</p>
        </div>
      </div>
      ${sim ? `<div>
        <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
          <i data-lucide="flask-conical" class="w-3.5 h-3.5"></i> Simulador — e se você dobrar uma letra?
        </p>
        <div class="grid grid-cols-2 gap-2">
          ${this._simRow('Dobrar V (visitas)', sim.base, sim.double_V)}
          ${this._simRow('Dobrar C (conversão)', sim.base, sim.double_C)}
          ${this._simRow('Dobrar L (ticket)', sim.base, sim.double_L)}
          ${this._simRow('Cortar T pela metade', sim.base, sim.half_T)}
        </div>
        <p class="text-[10px] text-slate-500 mt-2 leading-relaxed">Mesma fórmula V × C × L / T. Cada simulação muda só 1 letra e mantém as outras 3. Útil pra escolher qual frente atacar.</p>
      </div>` : ''}
      ${this._efficiencyBlock(product)}
      <div class="flex items-center justify-end gap-2">
        <button onclick="Actions.loadEfficiencySummary({force:true})" class="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-black hover:bg-slate-50 flex items-center gap-1.5">
          <i data-lucide="refresh-cw" class="w-3 h-3"></i> A4
        </button>
        <button onclick="Actions.loadPipelineVelocitySummary({force:true})" class="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-black hover:bg-slate-50 flex items-center gap-1.5">
          <i data-lucide="refresh-cw" class="w-3 h-3"></i> A3
        </button>
      </div>
    </div>`;
  },

  // V39.4.0 — Bloco "Eficiência de Capital" (A4): régua de 4 KPIs
  // (LTV / LTV:CAC / Payback / NRR) com semáforo + diagnóstico em prosa.
  _efficiencyBlock(product) {
    if (!window.EfficiencyEngine) return '';
    const e = EfficiencyEngine.forProduct(product.id);
    if (!e) return '';

    if (e.status === 'blocked') return '';
    if (e.status === 'loading') {
      return `<div class="rounded-2xl bg-slate-50 border border-slate-200 p-3 flex items-center gap-2">
        <div class="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin shrink-0"></div>
        <p class="text-xs text-slate-600">Carregando Eficiência de Capital…</p>
      </div>`;
    }
    if (e.status === 'pending') {
      const label = e.salesChannel === 'crm' ? 'CRM' : 'Híbrido';
      return `<div class="rounded-2xl bg-violet-50 border border-violet-200 border-l-4 border-l-violet-500 p-3">
        <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest mb-0.5">Eficiência de Capital · ${label}</p>
        <p class="text-xs text-violet-900 leading-relaxed">Em breve: depende do Fechamento mensal declarado + cruzamento com RD.</p>
      </div>`;
    }
    if (e.status === 'error') {
      return `<div class="rounded-2xl bg-rose-50 border border-rose-200 border-l-4 border-l-rose-500 p-3">
        <p class="text-[10px] font-black text-rose-700 uppercase tracking-widest mb-0.5">Eficiência de Capital · Erro</p>
        <p class="text-xs text-rose-900">${Utils.escape(e.error || 'desconhecido')}</p>
      </div>`;
    }
    if (e.status === 'empty') {
      return `<div class="rounded-2xl bg-slate-50 border border-slate-200 border-l-4 border-l-slate-400 p-3">
        <p class="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-0.5">Eficiência de Capital</p>
        <p class="text-xs text-slate-700 leading-relaxed">Sem customers registrados ainda. Espere a primeira venda Hotmart cair pra ver LTV/CAC/Payback/NRR.</p>
      </div>`;
    }

    // ok — régua de 4 KPIs (Proposta B)
    const diag = EfficiencyEngine.diagnose(e);
    const ltvCacSem = EfficiencyEngine.ltvCacSemaforo(e.ltvCacRatio, e.benchmarks);
    const paybackSem = EfficiencyEngine.paybackSemaforo(e.paybackMonths, e.benchmarks);
    const nrrSem = EfficiencyEngine.nrrSemaforo(e.nrr, e.nrrStatus, e.benchmarks);
    const semColorMap = { green: 'emerald', emerald: 'emerald', amber: 'amber', red: 'rose', gray: 'slate' };
    const semLabelMap = { green: '✓ Saudável', emerald: '✓ Saudável', amber: '⚠ Atenção', red: '✕ Crítico', gray: '—' };

    const ltvCacColor = semColorMap[ltvCacSem];
    const paybackColor = semColorMap[paybackSem];
    const nrrColor = semColorMap[nrrSem];

    const cacLabel = e.cacSource === 'declared'
      ? `CAC ${EfficiencyEngine.fmtMoney(e.cac)}`
      : `<button onclick="event.stopPropagation(); Actions.setTab('revops')" class="underline text-amber-700 font-black">Defina CAC</button>`;

    const paybackLabel = e.paybackMonths == null
      ? '—'
      : e.paybackMonths < 0.1 ? 'Instantâneo'
      : `${e.paybackMonths.toFixed(1)} mês(es)`;

    const nrrLabel = e.nrrStatus === 'na'
      ? 'N/A'
      : e.nrrStatus === 'insufficient'
      ? '— calibrando'
      : e.nrr != null ? `${(e.nrr * 100).toFixed(0)}%` : '—';

    return `<div class="rounded-2xl bg-gradient-to-br from-violet-50 to-pink-50 border-2 border-violet-200 border-l-4 border-l-violet-600 p-3">
      <div class="flex items-center justify-between mb-3">
        <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest flex items-center gap-1.5">
          <i data-lucide="gem" class="w-3.5 h-3.5"></i> Eficiência de Capital
        </p>
        <p class="text-[10px] text-slate-500">${e.customersCount} customers · últimos 12 meses</p>
      </div>
      <div class="grid grid-cols-4 gap-2 mb-3">
        <div class="bg-white rounded-xl border border-violet-200 p-2.5 text-center">
          <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest">💎 LTV</p>
          <p class="font-black text-lg text-slate-900 mt-0.5 leading-tight">${EfficiencyEngine.fmtMoney(e.ltv)}</p>
          <p class="text-[9px] text-slate-500 mt-0.5">por cliente</p>
        </div>
        <div class="bg-white rounded-xl border border-${ltvCacColor}-200 p-2.5 text-center">
          <p class="text-[10px] font-black text-${ltvCacColor}-700 uppercase tracking-widest">⚖️ LTV:CAC</p>
          <p class="font-black text-lg text-slate-900 mt-0.5 leading-tight">${e.ltvCacRatio != null ? e.ltvCacRatio.toFixed(2) + ':1' : '—'}</p>
          <p class="text-[9px] text-${ltvCacColor}-700 mt-0.5 font-black">${e.ltvCacRatio != null ? semLabelMap[ltvCacSem] : cacLabel}</p>
        </div>
        <div class="bg-white rounded-xl border border-${paybackColor}-200 p-2.5 text-center">
          <p class="text-[10px] font-black text-${paybackColor}-700 uppercase tracking-widest">⏱️ Payback</p>
          <p class="font-black text-lg text-slate-900 mt-0.5 leading-tight">${paybackLabel}</p>
          <p class="text-[9px] text-${paybackColor}-700 mt-0.5 font-black">${e.paybackMonths != null ? semLabelMap[paybackSem] : '—'}</p>
        </div>
        <div class="bg-white rounded-xl border border-${nrrColor}-200 p-2.5 text-center">
          <p class="text-[10px] font-black text-${nrrColor}-700 uppercase tracking-widest">🌱 NRR</p>
          <p class="font-black text-lg text-slate-900 mt-0.5 leading-tight">${nrrLabel}</p>
          <p class="text-[9px] text-${nrrColor}-700 mt-0.5 font-black">${e.hasSubscriptions && e.nrrStatus === 'ok' ? semLabelMap[nrrSem] : e.hasSubscriptions ? 'calibrando' : 'sem recorrência'}</p>
        </div>
      </div>
      <div class="rounded-xl bg-white/70 border border-violet-200 p-2.5">
        <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest mb-1">Diagnóstico A4</p>
        <p class="text-xs text-slate-800 leading-relaxed">${Utils.escape(diag)}</p>
      </div>
    </div>`;
  },

  _simRow(label, base, novo) {
    const delta = base > 0 ? ((novo - base) / base) : 0;
    const tone = delta > 0 ? 'emerald' : 'slate';
    return `<div class="bg-${tone}-50 border border-${tone}-200 rounded-xl px-3 py-2">
      <p class="text-[10px] font-black text-${tone}-700 uppercase tracking-widest">${label}</p>
      <div class="flex items-center justify-between gap-2 mt-1">
        <p class="text-sm font-black text-slate-900">${PipelineVelocityEngine.fmtMoney(novo)}/dia</p>
        <p class="text-[11px] font-black text-${tone}-700">${delta > 0 ? '+' : ''}${(delta * 100).toFixed(0)}%</p>
      </div>
    </div>`;
  }
};

window.RevopsVelocityModule = RevopsVelocityModule;
