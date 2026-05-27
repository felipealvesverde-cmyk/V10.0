// V34.9.5 — Painel de equalização do Score Engine.
//
// Read-only por hora. Cada elemento mostra o cadeado 🔒 — quando Felipe
// quiser destravar algum, removemos o cadeado e habilitamos edição.
//
// Tabs: "Geral" (score global do visitor) e "Campanha" (score por par
// visitor↔campanha, em lj_visitor_campaign_state).
//
// Espelha lib/score-engine.js (DEFAULT_WEIGHTS, fórmulas R/F/V, faixas,
// hierarquia clamp). Valores hardcoded aqui — em V35+ podem vir do DB.

window.ScoreConfigModal = {
  // Espelhos da lib/score-engine.js — mantenha sincronizado quando refatorar
  WEIGHTS: { pR: 0.30, pF: 0.30, pV: 0.40 },
  R_LAMBDA: 0.05,                // decay exponencial (meia-vida ~14d)
  F_SATURATION: 100,             // log saturation point
  V_SIGNALS: [
    { key: 'completudePerfil', label: 'Completude do perfil', desc: '% campos preenchidos no visitor (nome, email, telefone, etc.)' },
    { key: 'engagementRate', label: 'Engajamento positivo', desc: 'Razão tags positivas / total de tags' },
    { key: 'multiCanalBonus', label: 'Multi-canal', desc: 'Quantidade de canais distintos / 5 (Meta, Google, orgânico, etc.)' }
  ],
  FAIXAS: [
    { label: 'Customer', min: 667, max: 999, color: 'emerald' },
    { label: 'Quente',   min: 501, max: 666, color: 'orange' },
    { label: 'Lead',     min: 334, max: 500, color: 'amber' },
    { label: 'Frio',     min: 0,   max: 333, color: 'slate' }
  ],
  HIERARQUIA: [
    { entity: 'suspect',  rule: 'cap em 333',           note: 'Suspect não passa de Frio até virar lead.' },
    { entity: 'lead',     rule: 'entre 334 e 666',      note: 'Lead fica na faixa intermediária.' },
    { entity: 'customer', rule: 'mínimo 667 + bônus 1.5x', note: 'Customer recebe boost; nunca cai abaixo de Quente.' }
  ],

  render() {
    const m = App.state.scoreConfigModal;
    if (!m || !m.open) return '';
    const tab = m.activeTab || 'general';
    const campaignName = this._campaignName(m.campaignId);

    return `<div id="scoreConfigBackdrop" class="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm p-4 overflow-auto" onclick="if(event.target===this) Actions.closeScoreConfigModal()">
      <section class="max-w-4xl mx-auto rounded-[2rem] bg-slate-50 shadow-2xl overflow-hidden border border-white/20">
        <header class="bg-slate-950 text-white p-6 flex items-start justify-between gap-4">
          <div>
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-200 text-xs font-black mb-3">
              <i data-lucide="gauge" class="w-3.5 h-3.5"></i>
              SCORE ENGINE
            </div>
            <h2 class="text-3xl font-black">Equalização do Score</h2>
            <p class="text-slate-300 mt-2 text-sm">Visualização da mecânica do scoring. Cada elemento bloqueado pode virar editável — me peça quando quiser destravar.</p>
          </div>
          <button onclick="Actions.closeScoreConfigModal()" class="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 font-black flex items-center gap-2">
            <i data-lucide="x" class="w-4 h-4"></i>
            Fechar
          </button>
        </header>

        <nav class="bg-white border-b border-slate-200 px-6 pt-4 flex gap-2">
          ${this._tabBtn('general', 'Score Geral', tab)}
          ${m.campaignId ? this._tabBtn('campaign', `Score Campanha · ${Utils.escape(campaignName)}`, tab) : ''}
        </nav>

        <main class="p-5 lg:p-6 max-h-[70vh] overflow-y-auto space-y-4">
          ${tab === 'general' ? this._renderGeneralTab() : this._renderCampaignTab(m.campaignId, campaignName)}
        </main>
      </section>
    </div>`;
  },

  _tabBtn(value, label, active) {
    const isActive = value === active;
    return `<button onclick="Actions.setScoreConfigTab('${value}')" class="px-4 py-2.5 rounded-t-xl text-sm font-black ${isActive ? 'bg-slate-50 text-slate-900 border-t border-x border-slate-200' : 'text-slate-500 hover:text-slate-700'}">${label}</button>`;
  },

  _campaignName(campaignId) {
    if (!campaignId) return '—';
    const c = (App.state.campaigns || []).find(c => Number(c.id) === Number(campaignId));
    return c?.name || '—';
  },

  // ============================================================
  // Conteúdo das tabs
  // ============================================================
  _renderGeneralTab() {
    return `
      ${this._intro('Score Geral', 'Calculado para cada visitor a partir de toda a base de eventos, tags e touchpoints. Independente da campanha em que o lead está.')}
      ${this._weightsCard('Geral')}
      ${this._formulaRCard()}
      ${this._formulaFCard()}
      ${this._formulaVCard()}
      ${this._faixasCard()}
      ${this._hierarquiaCard()}
    `;
  },

  _renderCampaignTab(campaignId, campaignName) {
    return `
      ${this._intro(`Score na Campanha "${Utils.escape(campaignName)}"`, 'Score por par (visitor, campanha). Mesma fórmula do Geral, mas considerando só eventos/transitions vinculados a esta campanha específica. Permite que o mesmo lead tenha "score quente em uma campanha e frio em outra".')}
      ${this._weightsCard('Campanha')}
      ${this._formulaRCard()}
      ${this._formulaFCard()}
      ${this._formulaVCard()}
      ${this._faixasCard()}
      ${this._hierarquiaCard()}
      <div class="rounded-2xl bg-amber-50 border-2 border-amber-200 p-4 text-xs text-amber-900">
        <p class="font-black mb-1">⚠ Hoje pesos são iguais entre Geral e Campanha</p>
        <p>Estrutura preparada pra você ter pesos diferentes por campanha no futuro (ex.: "campanha de upsell prioriza Volume; campanha de aquisição prioriza Recência"). Me peça quando quiser destravar.</p>
      </div>
    `;
  },

  // ============================================================
  // Blocos reutilizáveis
  // ============================================================
  _intro(title, desc) {
    return `<div class="rounded-2xl bg-white border border-slate-200 p-4">
      <h3 class="text-lg font-black text-slate-900">${title}</h3>
      <p class="text-xs text-slate-600 mt-1">${desc}</p>
    </div>`;
  },

  _locked() {
    return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-black ml-2" title="Não editável agora — peça pra destravar">🔒 Bloqueado</span>`;
  },

  _weightsCard(scope) {
    const w = this.WEIGHTS;
    return `<div class="rounded-2xl bg-white border border-slate-200 p-5">
      <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center">
        Pesos do Score (${scope}) ${this._locked()}
      </h4>
      <p class="text-xs text-slate-500 mb-3">Composição final: <code class="bg-slate-100 px-1 rounded">score = R × pR + F × pF + V × pV</code></p>
      ${this._weightBar('R (Recência)',   w.pR, 'violet')}
      ${this._weightBar('F (Frequência)', w.pF, 'sky')}
      ${this._weightBar('V (Volume)',     w.pV, 'emerald')}
    </div>`;
  },

  _weightBar(label, weight, color) {
    const pct = Math.round(weight * 100);
    return `<div class="mb-2">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-black text-slate-700">${label}</span>
        <span class="text-xs font-black text-${color}-700">${pct}%</span>
      </div>
      <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
        <div class="h-full bg-${color}-500" style="width: ${pct}%"></div>
      </div>
    </div>`;
  },

  _formulaRCard() {
    return `<div class="rounded-2xl bg-white border border-slate-200 p-5">
      <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center">
        Fórmula R — Recência ${this._locked()}
      </h4>
      <p class="text-xs text-slate-600 mb-2">Quanto mais tempo desde a última interação, menor o R.</p>
      <div class="bg-violet-50 border border-violet-200 rounded-xl p-3 mb-3">
        <code class="text-xs font-mono text-violet-900">R = e^(-${this.R_LAMBDA} × diasInativo)</code>
      </div>
      <p class="text-[11px] text-slate-500">Decay exponencial. λ atual = <strong>${this.R_LAMBDA}</strong>, meia-vida ≈ 14 dias. Lead inativo há 30 dias → R ≈ 0.22.</p>
    </div>`;
  },

  _formulaFCard() {
    return `<div class="rounded-2xl bg-white border border-slate-200 p-5">
      <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center">
        Fórmula F — Frequência ${this._locked()}
      </h4>
      <p class="text-xs text-slate-600 mb-2">Quantas interações totais o lead gerou no LJ. Soma de 3 fontes:</p>
      <ul class="text-xs text-slate-600 mb-3 space-y-1">
        <li>• <strong>Tags</strong> atribuídas ao visitor (lj-quente, comprou-curso, etc.)</li>
        <li>• <strong>Touchpoints</strong> (cliques, pageviews, forms — tracker LJ)</li>
        <li>• <strong>Eventos</strong> custom (Hotmart, RD CRM, integrações)</li>
      </ul>
      <div class="bg-sky-50 border border-sky-200 rounded-xl p-3 mb-3">
        <code class="text-xs font-mono text-sky-900">F = log(1 + N) / log(${this.F_SATURATION + 1})</code>
      </div>
      <p class="text-[11px] text-slate-500">Saturação em <strong>${this.F_SATURATION}</strong> interações. Lead com 0 interações → F=0. Com 5 → F≈0.39. Com 20 → F≈0.66. Com 100+ → F=1.0 (teto).</p>
    </div>`;
  },

  _formulaVCard() {
    return `<div class="rounded-2xl bg-white border border-slate-200 p-5">
      <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center">
        Fórmula V — Volume (qualidade dos sinais) ${this._locked()}
      </h4>
      <p class="text-xs text-slate-600 mb-3">Média ponderada de subcomponentes que medem qualidade do lead (não só quantidade):</p>
      <div class="space-y-2">
        ${this.V_SIGNALS.map(s => `<div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
          <p class="text-xs font-black text-emerald-900">${Utils.escape(s.label)}</p>
          <p class="text-[11px] text-emerald-800 mt-0.5">${Utils.escape(s.desc)}</p>
        </div>`).join('')}
      </div>
      <p class="text-[11px] text-slate-500 mt-3">Cada subcomponente devolve um valor 0..1. V é a média deles. Em V35+ vamos ter pesos individuais.</p>
    </div>`;
  },

  _faixasCard() {
    return `<div class="rounded-2xl bg-white border border-slate-200 p-5">
      <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center">
        Faixas de Score ${this._locked()}
      </h4>
      <p class="text-xs text-slate-600 mb-3">Como o score numérico (0..999) é interpretado visualmente.</p>
      <div class="space-y-2">
        ${this.FAIXAS.map(f => `<div class="flex items-center gap-3 p-2.5 rounded-xl bg-${f.color}-50 border border-${f.color}-200">
          <span class="w-3 h-3 rounded-full bg-${f.color}-500"></span>
          <span class="text-sm font-black text-${f.color}-900 flex-1">${f.label}</span>
          <span class="text-xs font-bold text-${f.color}-800">${f.min} – ${f.max === 999 ? '999' : f.max}</span>
        </div>`).join('')}
      </div>
    </div>`;
  },

  _hierarquiaCard() {
    return `<div class="rounded-2xl bg-white border border-slate-200 p-5">
      <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-3 flex items-center">
        Hierarquia Clamp ${this._locked()}
      </h4>
      <p class="text-xs text-slate-600 mb-3">O entity_type do visitor (suspect/lead/customer) limita o score independente do que R, F e V devolvem:</p>
      <div class="space-y-2">
        ${this.HIERARQUIA.map(h => `<div class="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <p class="text-xs font-black text-slate-900">${Utils.escape(h.entity)}</p>
          <p class="text-xs font-bold text-slate-700 mt-1">${Utils.escape(h.rule)}</p>
          <p class="text-[11px] text-slate-500 mt-1">${Utils.escape(h.note)}</p>
        </div>`).join('')}
      </div>
    </div>`;
  }
};
