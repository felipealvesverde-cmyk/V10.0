// V35.14.5 — Modal de conciliação Google Ads x GA4.
//
// Dispara automaticamente quando wizard GA4 conclui E o LJ detecta que
// Google Ads também está conectado. Razão: GA4 com Pack Ads ativo puxa
// googleAdsCost da mesma campanha que o Google Ads sync já puxa direto.
// Sem aviso, RevOps Aquisição duplicaria custo (uma vez "[LJ]Google ads"
// + uma vez "[LJ]GA4 Tráfego pago").
//
// Regra cravada (Felipe, conversa de 2026-06-03):
//   "RevOps SÓ cria item se Google Ads NÃO estiver conectado direto."
//
// Modal explica a regra + oferece 3 caminhos:
//   1. Manter ambos (regra automática evita duplicar) — recomendado
//   2. Desconectar Google Ads (GA4 vira fonte única — mais simples)
//   3. Voltar e desconectar GA4 (vai precisar reabrir wizard depois)
//
// Step 'inform' = mostra a regra. Step 'choose' = 3 opções.

window.Ga4ReconciliationModal = {
  render() {
    const r = App.state.ga4GoogleAdsReconciliation;
    if (!r || !r.open) return '';
    const step = r.step || 'inform';

    return `<div class="fixed inset-0 z-[95] grid place-items-center p-4"
      style="background: rgba(10,31,68,0.85); backdrop-filter: blur(6px);"
      onclick="if(event.target===this) Actions.closeGa4GoogleAdsReconciliationModal()">
      <div class="w-full max-w-xl rounded-3xl border-2 border-emerald-400/40 shadow-2xl overflow-hidden"
        style="background: linear-gradient(135deg, #0A1F44 0%, #001230 100%);">

        <div class="border-b border-white/10 px-5 py-4 flex items-start justify-between gap-3"
          style="background: linear-gradient(90deg, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0.05) 100%);">
          <div class="min-w-0">
            <p class="text-[10px] font-black text-emerald-300 uppercase tracking-widest inline-flex items-center gap-1.5">
              <i data-lucide="git-merge" class="w-3 h-3"></i> Conciliação detectada
            </p>
            <h2 class="text-lg font-black text-white mt-1 leading-tight">Google Ads ↔ Google Analytics 4</h2>
            <p class="text-[11px] text-slate-300 mt-0.5">Você tem as duas integrações ativas. Decidir agora evita confusão depois.</p>
          </div>
          <button onclick="Actions.closeGa4GoogleAdsReconciliationModal()" class="shrink-0 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 grid place-items-center">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <div class="p-5">
          ${step === 'inform' ? this._stepInform() : this._stepChoose()}
        </div>
      </div>
    </div>`;
  },

  _stepInform() {
    return `<div class="space-y-4">
      <div class="rounded-xl bg-amber-500/10 border border-amber-400/30 p-4">
        <p class="text-[11px] font-black text-amber-200 uppercase tracking-wider mb-2">
          <i data-lucide="alert-triangle" class="w-3 h-3 inline-block"></i> Por que isso importa
        </p>
        <p class="text-[12px] text-amber-100 leading-relaxed">
          Os dois sistemas medem partes parecidas. GA4 (com Pack Ads ativo) puxa <code class="bg-black/30 px-1 rounded">googleAdsCost</code> do Google Ads. Se nada for feito, o RevOps Aquisição vai mostrar o mesmo investimento <b>duas vezes</b> (uma como "[LJ]Google ads", outra como "[LJ]GA4 Tráfego pago").
        </p>
      </div>

      <div class="rounded-xl bg-emerald-500/10 border border-emerald-400/30 p-4">
        <p class="text-[11px] font-black text-emerald-200 uppercase tracking-wider mb-2">
          <i data-lucide="check-circle-2" class="w-3 h-3 inline-block"></i> Regra automática (já ativa)
        </p>
        <p class="text-[12px] text-emerald-100 leading-relaxed">
          Quando <b>Google Ads sync direto</b> está conectado, o LJ ignora <code class="bg-black/30 px-1 rounded">googleAdsCost</code> do GA4 pro item RevOps. <b>Sem duplicação.</b> O GA4 continua mostrando o dado nos dashboards dele pra você comparar.
        </p>
      </div>

      <div class="rounded-xl bg-sky-500/10 border border-sky-400/30 p-4">
        <p class="text-[11px] font-black text-sky-200 uppercase tracking-wider mb-2">
          <i data-lucide="info" class="w-3 h-3 inline-block"></i> O que cada um vê melhor
        </p>
        <ul class="text-[12px] text-sky-100 leading-relaxed list-disc pl-4 space-y-1">
          <li><b>Google Ads</b>: lances, qualidade do anúncio, quality score, conversões puras.</li>
          <li><b>GA4</b>: jornada no site após o click, funil, atribuição cross-canal.</li>
        </ul>
      </div>

      <div class="flex justify-end gap-2 pt-2 border-t border-white/10">
        <button onclick="Actions.closeGa4GoogleAdsReconciliationModal()"
          class="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-black uppercase tracking-wider">
          Tá entendido
        </button>
        <button onclick="Actions.setGa4ReconciliationStep('choose')"
          class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-900 text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
          Quero mais opções <i data-lucide="arrow-right" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    </div>`;
  },

  _stepChoose() {
    return `<div class="space-y-3">
      <p class="text-[12px] text-slate-300">Se preferir não conviver com ambos, escolha:</p>

      <button onclick="Actions.closeGa4GoogleAdsReconciliationModal()"
        class="w-full text-left rounded-xl border-2 border-emerald-400/40 bg-emerald-500/10 hover:bg-emerald-500/15 p-4 transition flex items-start gap-3">
        <i data-lucide="check-circle-2" class="w-5 h-5 text-emerald-300 shrink-0 mt-0.5"></i>
        <div class="flex-1">
          <p class="text-[12px] font-black text-emerald-100 uppercase tracking-wider">Manter ambos (recomendado)</p>
          <p class="text-[11px] text-emerald-100/90 mt-1">Regra automática evita duplicar custo no RevOps. Você ganha 2 ângulos da mesma realidade.</p>
        </div>
      </button>

      <button onclick="if(confirm('Desconectar Google Ads? Histórico ficará no banco mas a sync vai parar.')) { Actions.disconnectGoogleAds(); Actions.closeGa4GoogleAdsReconciliationModal(); }"
        class="w-full text-left rounded-xl border-2 border-sky-400/40 bg-sky-500/10 hover:bg-sky-500/15 p-4 transition flex items-start gap-3">
        <i data-lucide="unlink" class="w-5 h-5 text-sky-300 shrink-0 mt-0.5"></i>
        <div class="flex-1">
          <p class="text-[12px] font-black text-sky-100 uppercase tracking-wider">Desconectar Google Ads</p>
          <p class="text-[11px] text-sky-100/90 mt-1">GA4 vira fonte única. Mais simples mas você perde dados específicos do Ads (Quality Score, etc).</p>
        </div>
      </button>

      <button onclick="if(confirm('Desconectar GA4? Vai precisar reabrir o wizard depois.')) { Actions.disconnectGa4(); Actions.closeGa4GoogleAdsReconciliationModal(); }"
        class="w-full text-left rounded-xl border-2 border-rose-400/40 bg-rose-500/10 hover:bg-rose-500/15 p-4 transition flex items-start gap-3">
        <i data-lucide="trash-2" class="w-5 h-5 text-rose-300 shrink-0 mt-0.5"></i>
        <div class="flex-1">
          <p class="text-[12px] font-black text-rose-100 uppercase tracking-wider">Desconectar GA4</p>
          <p class="text-[11px] text-rose-100/90 mt-1">Volta ao estado anterior. Mantém só Google Ads. Você acabou de configurar — confirme se quer perder o wizard.</p>
        </div>
      </button>

      <div class="flex justify-start gap-2 pt-2 border-t border-white/10">
        <button onclick="Actions.setGa4ReconciliationStep('inform')"
          class="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
          <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i> Voltar
        </button>
      </div>
    </div>`;
  }
};
