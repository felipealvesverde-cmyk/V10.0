// V38.1.0 — Modal explicador da Saúde do Produto.
//
// Abre via "?" no card do produto. Mostra:
//   - Score grande + tier + gargalo
//   - 4 fatores (E/C/K/R) com barra + valor + contribuição em pts
//   - Botão "Pedir análise pro Djow" (lazy 1 call retorna JSON com 4 balões + veredito)
//
// State: App.state.healthModal = { productId, djowAnalysis: null|{loading,...} }

window.HealthScoreModal = {
  render() {
    const modal = App.state.healthModal;
    if (!modal) return '';
    const product = (App.state.products || []).find(p => Number(p.id) === Number(modal.productId));
    if (!product) return '';
    if (!window.HealthScoreEngine) return '';

    const h = HealthScoreEngine.compute(product.id);
    const tone = h.tier.color;
    const dj = modal.djowAnalysis;

    return `<div class="fixed inset-0 z-[80] bg-slate-900/70 backdrop-blur-sm grid place-items-center p-4 overflow-y-auto"
        onclick="Actions.closeHealthScoreModal()">
      <div class="bg-white rounded-[2rem] shadow-2xl border border-slate-200 w-full max-w-2xl my-auto overflow-hidden"
           style="border-left:4px solid #7c3aed;"
           onclick="event.stopPropagation()">

        <!-- HEADER -->
        <header class="bg-slate-900 text-white p-5 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-[10px] font-black text-slate-300 uppercase tracking-widest">Saúde do Produto</p>
            <h2 class="text-2xl font-black tracking-tight">${Utils.escape(product.name)}</h2>
            <p class="text-[11px] text-slate-400 mt-1">${Utils.escape(product.type || 'Produto')} · ${Utils.escape(product.revenueModel || 'Venda única')}</p>
          </div>
          <button onclick="Actions.closeHealthScoreModal()" class="shrink-0 w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 text-white font-black text-lg">×</button>
        </header>

        <!-- SCORE GRANDE -->
        <!-- V38.1.4 — Estado "em construção" pra produto recém-criado: tom
             violet amigável em vez do rose gritante de "CRÍTICO" -->
        <div class="p-5 border-b border-slate-100 flex items-center gap-5 bg-${tone}-50/30">
          <div class="shrink-0 w-28 h-28 rounded-full border-8 border-${tone}-500/30 bg-white grid place-items-center">
            <div class="text-center">
              ${h.isBuilding
                ? '<div class="text-3xl">🚧</div><div class="text-[9px] font-bold text-slate-400 mt-1">Em construção</div>'
                : `<div class="text-4xl font-black text-${tone}-700 leading-none">${h.score}</div><div class="text-[10px] font-bold text-slate-400">/ 100</div>`}
            </div>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[11px] font-black text-${tone}-700 uppercase tracking-widest">${Utils.escape(h.tier.label)}</p>
            ${h.isBuilding ? `
              <p class="text-sm font-bold text-slate-800 mt-1">Vamos construir a operação?</p>
              <p class="text-[12px] text-slate-600 mt-0.5">Produto recém-criado. Cadastre KRs no Mapa, vincule tasks às ações, defina metas e conecte o checkout — a Saúde sobe conforme essas peças entram.</p>
            ` : `
              <p class="text-sm font-bold text-slate-800 mt-1">Gargalo: <span class="text-${tone}-700">${Utils.escape(h.gargalo.label)}</span></p>
              ${h.gargalo.reason ? `<p class="text-[12px] text-slate-600 mt-0.5">${Utils.escape(h.gargalo.reason)}</p>` : ''}
            `}
          </div>
        </div>

        <!-- FATORES -->
        <div class="p-5 space-y-3">
          <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Fatores que compõem o score</p>
          ${this._fator('Eficácia', '💪', 0.4, h.fatores.eficacia, this._eficaciaSummary(h.fatores.eficacia), dj?.byDimension?.eficacia, 'violet')}
          ${this._fator('Cobertura', '🎯', 0.4, h.fatores.cobertura, this._coberturaSummary(h.fatores.cobertura), dj?.byDimension?.cobertura, 'sky')}
          ${this._fatorK(h.fatores.krs, dj?.byDimension?.krs)}
          ${this._fator('Conversão de Vendas', '💰', 0.2, h.fatores.resultado, this._resultadoSummary(h.fatores.resultado), dj?.byDimension?.resultado, 'emerald')}
        </div>

        <!-- VEREDITO DJOW -->
        <div class="p-5 border-t border-slate-100 bg-slate-50">
          <div class="flex items-center justify-between mb-2">
            <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest">🔪 Veredito Djow</p>
          </div>
          ${dj?.verdict ? `
            <div class="rounded-2xl bg-white border-l-4 border-violet-600 border border-slate-200 p-4">
              <p class="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">${Utils.escape(dj.verdict)}</p>
            </div>
          ` : dj?.loading ? `
            <div class="rounded-2xl bg-white border border-slate-200 p-4 flex items-center gap-2 text-slate-500 text-sm">
              <i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i>
              Djow analisando o produto...
            </div>
          ` : dj?.error ? `
            <div class="rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm text-rose-800">
              Falha ao consultar Djow: ${Utils.escape(dj.error)}
              <button onclick="Actions.askDjowHealthAnalysis(${product.id})" class="ml-2 underline font-bold">Tentar de novo</button>
            </div>
          ` : `
            <button onclick="Actions.askDjowHealthAnalysis(${product.id})"
              class="w-full px-4 py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-black text-sm inline-flex items-center justify-center gap-2"
              style="color:#fff!important;">
              <i data-lucide="bot" class="w-4 h-4"></i>
              Pedir análise pro Djow
            </button>
          `}
        </div>
      </div>
    </div>`;
  },

  // ─────────────────────────────────────────────
  // RENDERIZADORES DE FATOR
  // ─────────────────────────────────────────────

  // V38.1.4 — Tone neutro (slate) quando o valor é 0. Verde/azul/violeta em
  // "0%" passava sinal contraditório (verde sugere positivo, mas é zero).
  _fator(label, icon, weight, fator, summary, djowBalao, tone) {
    const valuePct = Math.round((fator.value || 0) * 100);
    const contrib = fator.contribuiPts || 0;
    const effectiveTone = valuePct === 0 ? 'slate' : tone;
    return `<div class="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-xl">${icon}</span>
          <p class="text-[12px] font-black text-slate-800">${label} <span class="text-[10px] text-slate-500 font-bold">(peso ${Math.round(weight*100)}%)</span></p>
        </div>
        <p class="text-sm font-black text-${effectiveTone}-${valuePct === 0 ? '400' : '700'} shrink-0">${valuePct}%</p>
      </div>
      <div class="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div class="h-full bg-${effectiveTone}-500 rounded-full" style="width:${valuePct}%;"></div>
      </div>
      <p class="text-[11px] text-slate-600">${summary} · contribui com <b class="text-slate-800">+${contrib} pts</b></p>
      ${djowBalao ? `
        <div class="rounded-xl bg-violet-50 border border-violet-200 p-2.5 mt-1">
          <p class="text-[11px] text-violet-900 leading-relaxed">💬 ${Utils.escape(djowBalao)}</p>
        </div>
      ` : ''}
    </div>`;
  },

  // K é multiplicador, renderiza diferente
  // V38.1.4 — Mensagem em 3 estados: zero KR / só rascunhos / tem confirmados.
  // Tone: slate quando não tem nada cadastrado ainda (não punir produto novo).
  _fatorK(krs, djowBalao) {
    const valuePct = Math.round((krs.value || 0) * 100);
    const tone = krs.krsTotalCount === 0
      ? 'slate'                       // produto recém-criado, nada cadastrado
      : krs.value === 0
        ? 'rose'                      // tem KRs mas nenhum confirmado
        : krs.value >= 0.7
          ? 'emerald'
          : 'amber';

    let mensagem;
    if (krs.krsTotalCount === 0) {
      mensagem = `⚠ <b>Nenhum KR cadastrado ainda.</b> Vai no Mapa da Receita criar metas pras 3 áreas (Marketing / Vendas / CS). Sem KR confirmado, Saúde fica em 0.`;
    } else if (krs.krsConfirmadosCount === 0) {
      mensagem = `⚠ <b>${krs.krsRascunhoCount} KR${krs.krsRascunhoCount === 1 ? '' : 's'} em rascunho</b>, nenhum confirmado. Pra confirmar, preencha <b>Meta Segura + Meta Avançada + Prazo</b> no Mapa. Multiplicador = 0 → Saúde zerada.`;
    } else {
      const rascunhoNote = krs.krsRascunhoCount > 0 ? ` <span class="text-amber-700">(+ ${krs.krsRascunhoCount} em rascunho)</span>` : '';
      mensagem = `${krs.krsConfirmadosCount} KR${krs.krsConfirmadosCount === 1 ? '' : 's'} confirmado${krs.krsConfirmadosCount === 1 ? '' : 's'}${rascunhoNote}. Multiplica score por <b class="text-slate-900">${krs.value.toFixed(2)}</b> (${valuePct < 100 ? `perde ${100 - valuePct}% do total` : 'sem perda'}).`;
    }

    return `<div class="rounded-2xl border-2 border-${tone}-300 bg-${tone}-50/50 p-3 space-y-2">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="text-xl">📊</span>
          <p class="text-[12px] font-black text-slate-800">KRs <span class="text-[10px] text-${tone}-700 font-black uppercase tracking-wider">(multiplicador!)</span></p>
        </div>
        <p class="text-sm font-black text-${tone}-700 shrink-0">${valuePct}%</p>
      </div>
      <div class="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div class="h-full bg-${tone}-500 rounded-full" style="width:${valuePct}%;"></div>
      </div>
      <p class="text-[11px] text-slate-700">${mensagem}</p>
      ${djowBalao ? `
        <div class="rounded-xl bg-violet-50 border border-violet-200 p-2.5 mt-1">
          <p class="text-[11px] text-violet-900 leading-relaxed">💬 ${Utils.escape(djowBalao)}</p>
        </div>
      ` : ''}
    </div>`;
  },

  // ─────────────────────────────────────────────
  // SUMMARIES POR FATOR
  // ─────────────────────────────────────────────

  _eficaciaSummary(f) {
    if (f.total === 0) return 'Sem tasks vinculadas às ações';
    return `${f.done} de ${f.total} tasks completas`;
  },

  _coberturaSummary(f) {
    if (!f.areasComKr.length) return 'Nenhuma área com KR confirmado';
    const labels = { marketing: 'Marketing', vendas: 'Vendas', cs: 'CS' };
    return `${f.areasComKr.length} de 3 áreas — ${f.areasComKr.map(a => labels[a]).join(', ')}`;
  },

  _resultadoSummary(f) {
    if (!f.hasCheckoutConnected) return 'Sem checkout conectado · configure em Integrações';
    if (!f.hasMeta) return 'Sem meta de vendas cravada · vá em RevOps → Ofertas';
    return `${f.vendasRealizadas} vendas / meta ${f.metaConsolidada}`;
  }
};
