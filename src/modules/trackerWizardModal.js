// V33.0.0 — Onda 1 Fase 3.1: Modal wizard "Conectar Landing Page".
//
// Aberto via Actions.openTrackerWizard(campaignId). Gera snippet único por
// campanha (backend /api/tracker-snippet) e guia o cliente em 3 passos pra
// colar no <head> da LP da campanha.
//
// State: App.state.trackerWizardOpen = {
//   campaignId, step (1|2|3), snippet, trackerToken, apiBase,
//   copied: bool, loading: bool, error: string|null
// }

(function() {
  'use strict';

  const TrackerWizardModal = {
    render() {
      const w = window.App?.state?.trackerWizardOpen;
      if (!w) return '';
      const campaign = (App.state.campaigns || []).find(c => Number(c.id) === Number(w.campaignId));
      const campaignName = campaign?.name || 'Campanha';
      const step = Number(w.step || 1);

      return `<div class="fixed inset-0 z-[92] grid place-items-center p-4"
        style="background: rgba(15,23,42,0.78); backdrop-filter: blur(6px);"
        onclick="if(event.target===this) Actions.closeTrackerWizard()">
        <div class="w-full max-w-2xl rounded-3xl bg-slate-900 border-2 border-sky-400/40 shadow-2xl overflow-hidden">

          <!-- HEADER -->
          <div class="bg-gradient-to-r from-sky-500/20 to-violet-500/20 border-b border-white/10 px-5 py-4 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-[10px] font-black text-sky-300 uppercase tracking-widest inline-flex items-center gap-1.5">
                <i data-lucide="plug" class="w-3 h-3"></i> Conectar Landing Page
              </p>
              <h2 class="text-lg font-black text-white mt-1 leading-tight">${Utils.escape(campaignName)}</h2>
              <p class="text-[11px] text-slate-300 mt-0.5">Rastreie suspects, leads e conversões dessa campanha automaticamente.</p>
            </div>
            <button onclick="Actions.closeTrackerWizard()" class="shrink-0 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 grid place-items-center">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>

          <!-- STEPPER -->
          <div class="px-5 pt-4">
            <div class="flex items-center gap-2">
              ${[1,2,3].map(n => {
                const active = n === step;
                const done = n < step;
                const cls = done ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-200'
                          : active ? 'bg-sky-500/25 border-sky-400/60 text-sky-100'
                          : 'bg-white/5 border-white/10 text-slate-500';
                const label = ['O que é', 'Copiar snippet', 'Colar e testar'][n-1];
                return `<button onclick="Actions.setTrackerWizardStep(${n})" class="flex-1 px-3 py-2 rounded-xl border ${cls} text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition">
                  <span class="w-5 h-5 rounded-full bg-white/15 grid place-items-center text-[10px]">${done ? '✓' : n}</span>
                  ${label}
                </button>`;
              }).join('')}
            </div>
          </div>

          <!-- BODY -->
          <div class="p-5 max-h-[60vh] overflow-y-auto">
            ${this._renderStep(step, w, campaign)}
          </div>

          <!-- FOOTER -->
          <div class="bg-slate-900/80 border-t border-white/5 px-5 py-3 flex items-center justify-between gap-2">
            <div>
              ${step > 1 ? `<button onclick="Actions.setTrackerWizardStep(${step-1})" class="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
                <i data-lucide="arrow-left" class="w-3 h-3"></i> Voltar
              </button>` : ''}
            </div>
            <div class="flex items-center gap-1.5">
              <button onclick="Actions.closeTrackerWizard()" class="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[10px] font-black uppercase tracking-wider">Fechar</button>
              ${step < 3 ? `<button onclick="Actions.setTrackerWizardStep(${step+1})" class="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5" style="color:#fff!important;">
                Avançar <i data-lucide="arrow-right" class="w-3 h-3"></i>
              </button>` : `<button onclick="Actions.testTrackerConnection(${w.campaignId})" class="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5" style="color:#fff!important;">
                <i data-lucide="zap" class="w-3 h-3"></i> Testar conexão
              </button>`}
            </div>
          </div>
        </div>
      </div>`;
    },

    _renderStep(step, w, campaign) {
      if (w.loading) {
        return `<div class="text-center py-8">
          <i data-lucide="loader-2" class="w-8 h-8 text-sky-300 inline-block animate-spin"></i>
          <p class="text-[11px] text-slate-400 mt-2">Gerando snippet...</p>
        </div>`;
      }
      if (w.error) {
        return `<div class="rounded-xl bg-rose-500/10 border border-rose-400/40 p-4">
          <p class="text-[11px] font-black text-rose-300 uppercase tracking-widest mb-2">Erro ao gerar snippet</p>
          <p class="text-[12px] text-rose-200">${Utils.escape(w.error)}</p>
        </div>`;
      }
      if (step === 1) return this._renderStep1(campaign);
      if (step === 2) return this._renderStep2(w);
      if (step === 3) return this._renderStep3(w, campaign);
      return '';
    },

    _renderStep1(campaign) {
      return `<div class="space-y-4">
        <div class="rounded-2xl bg-sky-500/8 border border-sky-400/20 p-4">
          <p class="text-[11px] font-black text-sky-200 uppercase tracking-widest mb-2 inline-flex items-center gap-1.5">
            <i data-lucide="info" class="w-3.5 h-3.5"></i> Como funciona
          </p>
          <p class="text-[13px] text-slate-200 leading-relaxed">
            O LJ vai gerar um <b>snippet de JavaScript</b> específico pra essa campanha.
            Você cola ele no <b>&lt;head&gt;</b> da landing page que vai rodar essa campanha.
            A partir daí, todo visitante que entra é rastreado automaticamente.
          </p>
        </div>

        <div class="rounded-2xl bg-slate-800/40 border border-white/10 p-4 space-y-2">
          <p class="text-[11px] font-black text-slate-400 uppercase tracking-widest">O que o snippet faz</p>
          <ul class="space-y-1.5 text-[12px] text-slate-300">
            <li class="flex items-start gap-2"><i data-lucide="user-plus" class="w-3.5 h-3.5 text-emerald-300 mt-0.5 shrink-0"></i><span>Cria um identificador único pra cada visitante (cookie).</span></li>
            <li class="flex items-start gap-2"><i data-lucide="map-pin" class="w-3.5 h-3.5 text-violet-300 mt-0.5 shrink-0"></i><span>Captura origem (UTM, referrer) e marca como suspect no funil.</span></li>
            <li class="flex items-start gap-2"><i data-lucide="zap" class="w-3.5 h-3.5 text-amber-300 mt-0.5 shrink-0"></i><span>Quando o suspect preencher um form com email, vira lead automaticamente e é empurrado pro seu RD CRM.</span></li>
            <li class="flex items-start gap-2"><i data-lucide="shield-check" class="w-3.5 h-3.5 text-sky-300 mt-0.5 shrink-0"></i><span>Tudo isolado por campanha — nenhum cliente vê dados de outro.</span></li>
          </ul>
        </div>

        <p class="text-[11px] text-slate-500 italic">
          Clique em <b>Avançar</b> pra ver o snippet pronto pra copiar.
        </p>
      </div>`;
    },

    _renderStep2(w) {
      const snippet = w.snippet || '';
      const copied = !!w.copied;
      return `<div class="space-y-3">
        <div class="flex items-center justify-between gap-2">
          <p class="text-[11px] font-black text-slate-400 uppercase tracking-widest inline-flex items-center gap-1.5">
            <i data-lucide="code-2" class="w-3.5 h-3.5"></i> Seu snippet
          </p>
          <button onclick="Actions.copyTrackerSnippet()" class="px-3 py-1.5 rounded-lg ${copied ? 'bg-emerald-600' : 'bg-violet-600 hover:bg-violet-700'} text-white text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5 transition" style="color:#fff!important;">
            <i data-lucide="${copied ? 'check' : 'copy'}" class="w-3 h-3"></i>
            ${copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>

        <pre class="rounded-xl bg-slate-950 border border-white/10 p-3 text-[10px] text-slate-300 font-mono leading-relaxed overflow-auto max-h-72" style="white-space: pre-wrap; word-break: break-all;">${Utils.escape(snippet)}</pre>

        <div class="rounded-xl bg-amber-500/10 border border-amber-400/30 p-3">
          <p class="text-[11px] font-black text-amber-200 uppercase tracking-widest mb-1 inline-flex items-center gap-1.5">
            <i data-lucide="lock" class="w-3 h-3"></i> Importante
          </p>
          <p class="text-[11px] text-amber-100">
            O snippet contém um <b>token único</b> dessa campanha. Use só na LP correspondente.
            Se quiser rastrear outra campanha, abra o wizard dela e gere o snippet próprio.
          </p>
        </div>
      </div>`;
    },

    _renderStep3(w, campaign) {
      const status = App.state.trackerStatusByCampaign?.[w.campaignId];
      const connected = !!status?.connected;
      const lastEventAt = status?.lastEventAt ? new Date(status.lastEventAt).toLocaleString('pt-BR') : null;
      const total = status?.totalVisitors || 0;

      return `<div class="space-y-4">
        <div class="rounded-2xl bg-slate-800/40 border border-white/10 p-4 space-y-3">
          <p class="text-[11px] font-black text-slate-400 uppercase tracking-widest inline-flex items-center gap-1.5">
            <i data-lucide="list-ordered" class="w-3.5 h-3.5"></i> Onde colar
          </p>
          <ol class="space-y-2 text-[12px] text-slate-300 list-decimal pl-5">
            <li>Abra o código da sua landing page (no Webflow, WordPress, código próprio, etc).</li>
            <li>Procure pela tag <b class="font-mono text-violet-300">&lt;head&gt;</b> no topo do arquivo HTML.</li>
            <li>Cole o snippet copiado <b>dentro</b> da tag <b class="font-mono text-violet-300">&lt;head&gt;</b>, antes do fechamento <b class="font-mono text-violet-300">&lt;/head&gt;</b>.</li>
            <li>Salve e publique a LP.</li>
            <li>Volte aqui e clique em <b>Testar conexão</b>.</li>
          </ol>
        </div>

        <div class="rounded-2xl ${connected ? 'bg-emerald-500/10 border-emerald-400/40' : 'bg-slate-800/40 border-white/10'} border p-4">
          <p class="text-[11px] font-black ${connected ? 'text-emerald-200' : 'text-slate-400'} uppercase tracking-widest mb-2 inline-flex items-center gap-1.5">
            <i data-lucide="${connected ? 'check-circle-2' : 'clock'}" class="w-3.5 h-3.5"></i> Status
          </p>
          ${connected ? `<p class="text-[12px] text-emerald-100">
            ✓ Snippet conectado. <b>${total}</b> visitor${total === 1 ? '' : 's'} registrado${total === 1 ? '' : 's'}.
            ${lastEventAt ? `Último evento: <b>${lastEventAt}</b>.` : ''}
          </p>` : `<p class="text-[12px] text-slate-300">
            Aguardando primeiro evento. Acesse sua LP agora pra disparar um page_view, depois clique no botão <b>Testar conexão</b> abaixo.
          </p>`}
        </div>
      </div>`;
    }
  };

  window.TrackerWizardModal = TrackerWizardModal;
})();
