// V33.0.0 — Onda 2: Modal wizard "Conectar Hotmart".
//
// Aberto via Actions.openHotmartWizard(). 3 passos:
//   1. Explicação (o que é + o que vai destravar)
//   2. Form HOTTOK + mappings opcionais + salvar
//   3. URL do webhook + instrução pro cliente colar no Hotmart

(function() {
  'use strict';

  const HotmartWizardModal = {
    render() {
      const w = window.App?.state?.hotmartWizardOpen;
      if (!w) return '';
      const step = Number(w.step || 1);
      const status = App.state.hotmartStatus || {};
      const alreadyConfigured = !!status.configured;

      return `<div class="fixed inset-0 z-[92] grid place-items-center p-4"
        style="background: rgba(15,23,42,0.78); backdrop-filter: blur(6px);"
        onclick="if(event.target===this) Actions.closeHotmartWizard()">
        <div class="w-full max-w-2xl rounded-3xl bg-slate-900 border-2 border-orange-400/40 shadow-2xl overflow-hidden">

          <!-- HEADER -->
          <div class="bg-gradient-to-r from-orange-500/20 to-amber-500/20 border-b border-white/10 px-5 py-4 flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-[10px] font-black text-orange-300 uppercase tracking-widest inline-flex items-center gap-1.5">
                <i data-lucide="dollar-sign" class="w-3 h-3"></i> Conectar Hotmart
              </p>
              <h2 class="text-lg font-black text-white mt-1 leading-tight">Receita real entrando no LJ</h2>
              <p class="text-[11px] text-slate-300 mt-0.5">Quando alguém comprar, o LJ marca o lead como customer automaticamente.</p>
            </div>
            <button onclick="Actions.closeHotmartWizard()" class="shrink-0 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 grid place-items-center">
              <i data-lucide="x" class="w-4 h-4"></i>
            </button>
          </div>

          <!-- STEPPER -->
          <div class="px-5 pt-4">
            <div class="flex items-center gap-2">
              ${[1,2,3].map(n => {
                const active = n === step;
                const done = n < step || (n === 2 && alreadyConfigured);
                const cls = done ? 'bg-emerald-500/25 border-emerald-400/60 text-emerald-200'
                          : active ? 'bg-orange-500/25 border-orange-400/60 text-orange-100'
                          : 'bg-white/5 border-white/10 text-slate-500';
                const label = ['Por que conectar', 'Cadastrar HOTTOK', 'Colar webhook no Hotmart'][n-1];
                return `<button onclick="Actions.setHotmartWizardStep(${n})" class="flex-1 px-3 py-2 rounded-xl border ${cls} text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition">
                  <span class="w-5 h-5 rounded-full bg-white/15 grid place-items-center text-[10px]">${done ? '✓' : n}</span>
                  ${label}
                </button>`;
              }).join('')}
            </div>
          </div>

          <!-- BODY -->
          <div class="p-5 max-h-[60vh] overflow-y-auto">
            ${this._renderStep(step, w, status)}
          </div>

          <!-- FOOTER -->
          <div class="bg-slate-900/80 border-t border-white/5 px-5 py-3 flex items-center justify-between gap-2">
            <div>
              ${step > 1 ? `<button onclick="Actions.setHotmartWizardStep(${step-1})" class="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5">
                <i data-lucide="arrow-left" class="w-3 h-3"></i> Voltar
              </button>` : ''}
            </div>
            <div class="flex items-center gap-1.5">
              <button onclick="Actions.closeHotmartWizard()" class="px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-[10px] font-black uppercase tracking-wider">Fechar</button>
              ${this._renderFooterAction(step, w, alreadyConfigured)}
            </div>
          </div>
        </div>
      </div>`;
    },

    _renderFooterAction(step, w, alreadyConfigured) {
      if (step === 1) {
        return `<button onclick="Actions.setHotmartWizardStep(2)" class="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5" style="color:#fff!important;">
          Avançar <i data-lucide="arrow-right" class="w-3 h-3"></i>
        </button>`;
      }
      if (step === 2) {
        if (w.saving) {
          return `<button disabled class="px-3 py-2 rounded-lg bg-orange-600 opacity-60 text-white text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5" style="color:#fff!important;">
            <i data-lucide="loader-2" class="w-3 h-3 animate-spin"></i> Salvando...
          </button>`;
        }
        return `<button onclick="Actions.saveHotmartConfig()" class="px-3 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5" style="color:#fff!important;">
          <i data-lucide="save" class="w-3 h-3"></i> ${alreadyConfigured ? 'Atualizar HOTTOK' : 'Salvar e avançar'}
        </button>`;
      }
      if (step === 3) {
        return `<button onclick="Actions.copyHotmartWebhookUrl()" class="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1.5" style="color:#fff!important;">
          <i data-lucide="copy" class="w-3 h-3"></i> Copiar URL webhook
        </button>`;
      }
      return '';
    },

    _renderStep(step, w, status) {
      if (step === 1) return this._step1();
      if (step === 2) return this._step2(w, status);
      if (step === 3) return this._step3(status);
      return '';
    },

    _step1() {
      return `<div class="space-y-4">
        <div class="rounded-2xl bg-orange-500/8 border border-orange-400/20 p-4">
          <p class="text-[11px] font-black text-orange-200 uppercase tracking-widest mb-2 inline-flex items-center gap-1.5">
            <i data-lucide="info" class="w-3.5 h-3.5"></i> O que destrava
          </p>
          <p class="text-[13px] text-slate-200 leading-relaxed">
            Conectar Hotmart fecha o ciclo de receita do LJ. Toda compra que rolar
            no seu Hotmart vira <b>customer</b> automaticamente no LJ, com valor
            e data corretos. RD não precisa fazer nada manual.
          </p>
        </div>

        <div class="rounded-2xl bg-slate-800/40 border border-white/10 p-4 space-y-2">
          <p class="text-[11px] font-black text-slate-400 uppercase tracking-widest">O que o webhook vai fazer</p>
          <ul class="space-y-1.5 text-[12px] text-slate-300">
            <li class="flex items-start gap-2"><i data-lucide="user-check" class="w-3.5 h-3.5 text-emerald-300 mt-0.5 shrink-0"></i><span>Promover Lead → Customer quando pagamento for aprovado.</span></li>
            <li class="flex items-start gap-2"><i data-lucide="repeat" class="w-3.5 h-3.5 text-violet-300 mt-0.5 shrink-0"></i><span>Registrar recompras (LTV) automaticamente quando houver recorrência ou nova compra.</span></li>
            <li class="flex items-start gap-2"><i data-lucide="alert-triangle" class="w-3.5 h-3.5 text-amber-300 mt-0.5 shrink-0"></i><span>Marcar reembolsos e chargebacks no audit log (sem desfazer o customer).</span></li>
            <li class="flex items-start gap-2"><i data-lucide="dollar-sign" class="w-3.5 h-3.5 text-sky-300 mt-0.5 shrink-0"></i><span>Valor exato da transação fica salvo no visitor (alimenta RevOps depois).</span></li>
          </ul>
        </div>

        <p class="text-[11px] text-slate-500 italic">
          Clique em <b>Avançar</b> pra cadastrar o HOTTOK do seu produto Hotmart.
        </p>
      </div>`;
    },

    _step2(w, status) {
      const hottok = w.draft?.hottok || '';
      const clientId = w.draft?.clientId || '';
      const clientSecret = w.draft?.clientSecret || '';
      const syncWindowDays = w.draft?.syncWindowDays || status.syncWindowDays || 90;
      const oauthExpanded = !!(w.draft?.oauthExpanded || status.oauthConfigured);
      const alreadyConfigured = !!status.configured;
      return `<div class="space-y-4">
        ${alreadyConfigured ? `<div class="rounded-xl bg-emerald-500/10 border border-emerald-400/40 p-3">
          <p class="text-[11px] font-black text-emerald-200 uppercase tracking-widest mb-1">Já configurado</p>
          <p class="text-[12px] text-emerald-100">HOTTOK atual: <span class="font-mono">${Utils.escape(status.hottokMasked || '—')}</span>${status.oauthConfigured ? ` · OAuth: <span class="font-mono">${Utils.escape(status.clientIdMasked || '—')}</span>` : ''}</p>
          <p class="text-[10px] text-emerald-100/70 mt-1">Cole novos valores abaixo se quiser substituir.</p>
        </div>` : ''}

        <div class="rounded-2xl bg-slate-800/40 border border-white/10 p-4 space-y-2">
          <p class="text-[11px] font-black text-slate-400 uppercase tracking-widest">Onde achar o HOTTOK</p>
          <ol class="space-y-1.5 text-[12px] text-slate-300 list-decimal pl-5">
            <li>Entre no Hotmart → <b>Ferramentas</b> → <b>Webhook</b>.</li>
            <li>Selecione seu produto.</li>
            <li>O campo <b class="font-mono text-orange-300">HOTTOK</b> aparece na configuração.</li>
            <li>Copie e cole abaixo.</li>
          </ol>
        </div>

        <div class="space-y-1.5">
          <label class="text-[11px] font-black text-orange-300 uppercase tracking-widest">HOTTOK do produto <span class="text-rose-300">*</span></label>
          <input type="text" value="${Utils.escape(hottok)}"
                 oninput="Actions.updateHotmartDraft('hottok', this.value)"
                 placeholder="cole aqui o HOTTOK"
                 class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white text-[12px] font-mono focus:border-orange-400/60 focus:outline-none" />
          <p class="text-[10px] text-slate-500">Obrigatório. Fica criptografado no nosso banco.</p>
        </div>

        <!-- V35.1.0 — Seção OAuth opcional pra Sales API (histórico + reconciliação) -->
        <div class="rounded-2xl bg-violet-500/5 border-2 border-violet-400/30 overflow-hidden">
          <button onclick="Actions.updateHotmartDraft('oauthExpanded', ${!oauthExpanded})" class="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-violet-500/10 transition">
            <div class="min-w-0">
              <p class="text-[11px] font-black text-violet-300 uppercase tracking-widest inline-flex items-center gap-1.5">
                <i data-lucide="key" class="w-3 h-3"></i> OAuth · puxar histórico (opcional)
              </p>
              <p class="text-[11px] text-slate-300 mt-0.5">Sem isso: só novas vendas aparecem. Com isso: histórico vem junto.</p>
            </div>
            <i data-lucide="${oauthExpanded ? 'chevron-up' : 'chevron-down'}" class="w-4 h-4 text-violet-300 shrink-0"></i>
          </button>
          ${oauthExpanded ? `<div class="px-4 pb-4 space-y-3">
            <div class="rounded-xl bg-slate-900/50 border border-white/5 p-3">
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Onde criar as credenciais</p>
              <ol class="space-y-1 text-[11px] text-slate-300 list-decimal pl-4">
                <li>Hotmart → <b>Ferramentas</b> → <b>Developer Credentials</b>.</li>
                <li>Clique <b>Criar credencial</b>.</li>
                <li>Copie o <b class="font-mono text-violet-300">Client ID</b> e o <b class="font-mono text-violet-300">Client Secret</b>.</li>
              </ol>
            </div>
            <div class="grid grid-cols-1 gap-2">
              <div>
                <label class="text-[10px] font-black text-violet-300 uppercase tracking-widest">Client ID</label>
                <input type="text" value="${Utils.escape(clientId)}"
                       oninput="Actions.updateHotmartDraft('clientId', this.value)"
                       placeholder="cole aqui o client_id"
                       class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/15 text-white text-[11px] font-mono focus:border-violet-400/60 focus:outline-none" />
              </div>
              <div>
                <label class="text-[10px] font-black text-violet-300 uppercase tracking-widest">Client Secret</label>
                <input type="password" value="${Utils.escape(clientSecret)}"
                       oninput="Actions.updateHotmartDraft('clientSecret', this.value)"
                       placeholder="cole aqui o client_secret"
                       class="w-full px-3 py-2 rounded-lg bg-slate-950 border border-white/15 text-white text-[11px] font-mono focus:border-violet-400/60 focus:outline-none" />
              </div>
            </div>
            <div>
              <label class="text-[10px] font-black text-violet-300 uppercase tracking-widest block mb-1.5">Janela de histórico</label>
              <div class="flex gap-1">
                ${[90, 180, 365].map(d => {
                  const isActive = Number(syncWindowDays) === d;
                  return `<button onclick="Actions.updateHotmartDraft('syncWindowDays', ${d})" class="flex-1 px-3 py-2 rounded-lg text-[11px] font-black ${isActive ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}" ${isActive ? 'style="color:#fff;"' : ''}>${d} dias</button>`;
                }).join('')}
              </div>
              <p class="text-[10px] text-slate-500 mt-1.5">Puxa vendas desse período pra trás ao salvar.</p>
            </div>
          </div>` : ''}
        </div>

        ${w.error ? `<div class="rounded-xl bg-rose-500/10 border border-rose-400/40 p-3">
          <p class="text-[11px] font-black text-rose-300 uppercase tracking-widest mb-1">Erro ao salvar</p>
          <p class="text-[12px] text-rose-200">${Utils.escape(w.error)}</p>
        </div>` : ''}
      </div>`;
    },

    _step3(status) {
      const tenantId = (() => {
        try {
          const jwt = localStorage.getItem('lj_jwt');
          if (!jwt) return null;
          const payload = JSON.parse(atob(jwt.split('.')[1]));
          return payload?.tenantId || null;
        } catch (_) { return null; }
      })();
      const webhookUrl = tenantId ? `${window.location.origin}/api/hotmart-webhook?tenant_id=${tenantId}` : null;

      return `<div class="space-y-4">
        <div class="rounded-2xl bg-emerald-500/10 border border-emerald-400/40 p-4">
          <p class="text-[11px] font-black text-emerald-200 uppercase tracking-widest mb-1.5 inline-flex items-center gap-1.5">
            <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> HOTTOK salvo
          </p>
          <p class="text-[12px] text-emerald-100">
            Falta um passo: colar a URL do webhook abaixo dentro do Hotmart.
          </p>
        </div>

        ${webhookUrl ? `<div class="space-y-1.5">
          <label class="text-[11px] font-black text-orange-300 uppercase tracking-widest">URL do webhook (cole no Hotmart)</label>
          <div class="flex gap-2">
            <input type="text" readonly value="${Utils.escape(webhookUrl)}"
                   onclick="this.select()"
                   class="flex-1 px-3 py-2.5 rounded-xl bg-slate-950 border border-white/15 text-white text-[11px] font-mono focus:border-orange-400/60 focus:outline-none" />
            <button onclick="Actions.copyHotmartWebhookUrl()" class="px-3 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-black uppercase tracking-wider" style="color:#fff!important;">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>` : `<div class="rounded-xl bg-amber-500/10 border border-amber-400/40 p-3">
          <p class="text-[12px] text-amber-200">Seu user não tem tenant ativo — não consigo gerar a URL agora. Configure um produto primeiro.</p>
        </div>`}

        <div class="rounded-2xl bg-slate-800/40 border border-white/10 p-4 space-y-2">
          <p class="text-[11px] font-black text-slate-400 uppercase tracking-widest">Onde colar no Hotmart</p>
          <ol class="space-y-1.5 text-[12px] text-slate-300 list-decimal pl-5">
            <li>Volte pro Hotmart → <b>Ferramentas</b> → <b>Webhook</b>.</li>
            <li>Crie um novo webhook (ou edite o existente).</li>
            <li>Cole a URL acima no campo <b>URL de Postback</b>.</li>
            <li>Selecione os eventos: <b>PURCHASE_APPROVED</b>, <b>PURCHASE_COMPLETE</b>, <b>PURCHASE_REFUNDED</b>, <b>PURCHASE_CHARGEBACK</b>, <b>PURCHASE_CANCELED</b>, <b>PURCHASE_BILLET_PRINTED</b>, <b>PURCHASE_OUT_OF_SHOPPING_CART</b>, <b>PURCHASE_DELAYED</b>, <b>SUBSCRIPTION_CANCELLATION</b>, <b>SWITCH_PLAN</b>.</li>
            <li>Salve no Hotmart.</li>
          </ol>
        </div>

        <div class="rounded-xl bg-violet-500/10 border border-violet-400/30 p-3">
          <p class="text-[11px] text-violet-200">
            <b>Pronto.</b> A próxima compra no Hotmart vai aparecer como customer no seu LJ em segundos.
            Acompanhe via <b>Resultados → Produto Overview</b> ou no <b>Pulso da Receita</b>.
          </p>
        </div>
      </div>`;
    }
  };

  window.HotmartWizardModal = HotmartWizardModal;
})();
