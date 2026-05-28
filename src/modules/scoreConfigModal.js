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
    const tab = m.activeTab || 'score';
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
            <p class="text-slate-300 mt-2 text-sm">Visualização e configuração da mecânica do scoring.</p>
          </div>
          <button onclick="Actions.closeScoreConfigModal()" class="px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/15 font-black flex items-center gap-2">
            <i data-lucide="x" class="w-4 h-4"></i>
            Fechar
          </button>
        </header>

        <nav class="bg-white border-b border-slate-200 px-6 pt-4 flex gap-2">
          ${this._tabBtn('score', 'Score', tab)}
          ${this._tabBtn('settings', 'Settings', tab)}
        </nav>

        <main class="p-5 lg:p-6 max-h-[70vh] overflow-y-auto space-y-4">
          ${tab === 'settings' ? this._renderSettingsTab() : this._renderScoreTab(campaignName)}
        </main>
      </section>
    </div>`;
  },

  _tabBtn(value, label, active) {
    const isActive = value === active;
    return `<button onclick="Actions.setScoreConfigTab('${value}')" class="px-4 py-2.5 rounded-t-xl text-sm font-black ${isActive ? 'bg-slate-50 text-slate-900 border-t border-x border-slate-200' : 'text-slate-500 hover:text-slate-700'}">${label}</button>`;
  },

  // V34.9.10 — Aba "Score" com sub-tabs (Geral / Campanha)
  _renderScoreTab(campaignName) {
    const m = App.state.scoreConfigModal;
    const sub = m.scoreSubTab || 'general';
    const campaigns = App.state.campaigns || [];
    return `<div class="space-y-3">
      <div class="bg-white rounded-2xl border border-slate-200 p-2 flex gap-1">
        ${this._subTabBtn('general', 'Score Geral', sub)}
        ${this._subTabBtn('campaign', 'Score Campanha', sub)}
      </div>
      ${sub === 'campaign' ? `<div class="bg-white rounded-2xl border border-slate-200 p-3 flex items-center gap-3">
        <span class="text-xs font-black text-slate-700">Campanha:</span>
        <select onchange="App.state.scoreConfigModal.campaignId = Number(this.value); App.render();" class="flex-1 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm font-black">
          <option value="">— escolha —</option>
          ${campaigns.map(c => `<option value="${c.id}" ${Number(m.campaignId) === Number(c.id) ? 'selected' : ''}>${Utils.escape(c.name)}</option>`).join('')}
        </select>
      </div>` : ''}
      ${sub === 'general' ? this._renderGeneralTab() : (m.campaignId ? this._renderCampaignTab(m.campaignId, campaignName) : `<p class="text-sm text-slate-500 italic p-4">Escolha uma campanha acima.</p>`)}
    </div>`;
  },

  _subTabBtn(value, label, active) {
    const isActive = value === active;
    return `<button onclick="Actions.setScoreSubTab('${value}')" class="flex-1 px-4 py-2 rounded-xl text-xs font-black ${isActive ? 'bg-slate-900 text-white' : 'bg-transparent text-slate-700 hover:bg-slate-100'}">${label}</button>`;
  },

  // V34.9.10.2 — Aba Settings: pílula horizontal de modelos + botão Editar amarelo
  _renderSettingsTab() {
    const m = App.state.scoreConfigModal;
    const model = m.activeModel || 'rfv';
    const rules = m.scoreRules || [];
    const draft = m.ruleDraft;

    return `<div class="space-y-4">
      <div class="rounded-2xl bg-white border border-slate-200 p-5">
        <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-3">Modelo de Score Ativo</h4>
        <p class="text-xs text-slate-500 mb-3">Quando você ativa um modelo, ele passa a valer pra base global E pra todas as campanhas. Substitui o mecanismo de soma anterior.</p>
        ${this._modelPill(model)}
        ${this._activeModelDescription(model)}
      </div>

      ${model === 'rfv' ? this._renderRfvSettingsCard() : ''}
      ${(model === 'criteria' || model === 'hybrid') ? this._renderCriteriaSettings(rules, draft) : ''}
      ${(model === 'criteria' || model === 'hybrid') ? this._renderIcpSettings() : ''}
    </div>`;
  },

  // V34.9.11 — UI ICP Profile (editável)
  _renderIcpSettings() {
    const m = App.state.scoreConfigModal;
    const profile = m.icpProfile || { fields_json: {}, tier_method: 'percentage', tier_rules_json: { tier_1: [], tier_2: [], tier_3: [] } };
    const draft = m.icpDraft;
    if (!draft) {
      return this._renderIcpView(profile);
    }
    return this._renderIcpEditor(draft);
  },

  _renderIcpView(p) {
    const f = p.fields_json || {};
    const method = p.tier_method || 'percentage';
    const rules = p.tier_rules_json || { tier_1: [], tier_2: [], tier_3: [] };
    const fields = Object.entries(f).filter(([k]) => f[k] !== null && f[k] !== '' && f[k] !== undefined);
    const totalRuleGroups = (rules.tier_1?.length || 0) + (rules.tier_2?.length || 0) + (rules.tier_3?.length || 0);
    return `<div class="rounded-2xl bg-white border border-slate-200 p-5">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest">ICP — Perfil do Cliente Ideal</h4>
          <span class="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 text-[10px] font-black">
            <i data-lucide="${method === 'rules' ? 'shield-check' : 'percent'}" class="w-3 h-3"></i>
            ${method === 'rules' ? 'Modo: Por regras (HubSpot)' : 'Modo: Por % de match'}
          </span>
        </div>
        <button onclick="Actions.startIcpDraft()" class="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-black flex items-center gap-1.5" style="color:#fff;">
          <i data-lucide="edit-3" class="w-3 h-3"></i>
          Editar
        </button>
      </div>
      ${method === 'rules' ? `
        <p class="text-xs text-slate-500 mb-3">Tier definido por condições explícitas. Avaliação: Tier 1 → 2 → 3, primeiro que casar vence.</p>
        ${totalRuleGroups === 0 ? `<p class="text-xs text-slate-400 italic">Nenhuma regra cadastrada. Clique em Editar pra montar.</p>` : `
          <div class="grid grid-cols-3 gap-2">
            ${[1, 2, 3].map(t => {
              const color = t === 1 ? 'emerald' : t === 2 ? 'amber' : 'slate';
              const groupCount = rules[`tier_${t}`]?.length || 0;
              return `<div class="rounded-xl bg-${color}-50 border border-${color}-200 p-2 text-center">
                <p class="text-[10px] font-black text-${color}-700 uppercase tracking-widest">Tier ${t}</p>
                <p class="text-lg font-black text-${color}-900">${groupCount} grupo(s)</p>
              </div>`;
            }).join('')}
          </div>
        `}
      ` : `
        <p class="text-xs text-slate-500 mb-3">Tier definido por % de match com perfil. <span class="text-[10px] text-slate-400">Tier 1 ≥ 80% · Tier 2 ≥ 50% · Tier 3 &lt; 50%</span></p>
        ${fields.length === 0 ? `<p class="text-xs text-slate-400 italic">Nenhum critério de ICP cadastrado. Clique em Editar pra começar.</p>` : `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${fields.map(([k, v]) => `<div class="p-2 rounded-xl bg-violet-50 border border-violet-200">
              <p class="text-[10px] font-black text-violet-700 uppercase tracking-widest">${Utils.escape(this._icpFieldLabel(k))}</p>
              <p class="text-xs font-bold text-violet-900">${Utils.escape(Array.isArray(v) ? v.join(', ') : String(v))}</p>
            </div>`).join('')}
          </div>
        `}
      `}
    </div>`;
  },

  _renderIcpEditor(d) {
    const method = d.tier_method || 'percentage';
    return `<div class="rounded-2xl bg-violet-50 border-2 border-violet-300 p-5">
      <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-3">Editar ICP</h4>

      ${this._tierMethodToggle(method)}

      ${method === 'percentage' ? this._renderPercentageEditor(d) : this._renderRulesEditor(d)}

      <div class="flex gap-2 mt-3">
        <button onclick="Actions.saveIcpDraft()" class="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black" style="color:#fff;">Salvar ICP</button>
        <button onclick="Actions.cancelIcpDraft()" class="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-black">Cancelar</button>
      </div>
    </div>`;
  },

  // V34.9.13 — Toggle entre 'percentage' (proxy) e 'rules' (HubSpot puro)
  _tierMethodToggle(active) {
    return `<div class="mb-4">
      <p class="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2">Como definir o Tier do lead</p>
      <div class="flex items-stretch rounded-full bg-white border-2 border-violet-200 p-1 overflow-hidden">
        ${[
          { value: 'percentage', label: 'Por % de match', desc: 'Faixas fixas 80/50' },
          { value: 'rules', label: 'Por regras', desc: 'Condições explícitas (HubSpot)' }
        ].map(opt => {
          const isActive = opt.value === active;
          if (isActive) {
            return `<div class="flex-1 px-4 py-2.5 text-xs font-black text-center bg-violet-600 text-white rounded-full" style="color:#fff;">
              ${opt.label}<br><span class="text-[9px] font-normal opacity-80">${opt.desc}</span>
            </div>`;
          }
          return `<button onclick="Actions.setIcpDraftTierMethod('${opt.value}')" class="flex-1 px-4 py-2.5 text-xs font-black text-slate-700 hover:bg-violet-100 rounded-full">
            ${opt.label}<br><span class="text-[9px] font-normal text-slate-500">${opt.desc}</span>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  },

  _renderPercentageEditor(d) {
    const f = d.fields_json || {};
    return `<div>
      <p class="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-2">Campos do perfil ideal</p>
      <p class="text-xs text-slate-500 mb-3">Várias opções: separe por vírgula. Ex.: cidade "São Paulo, Rio de Janeiro"</p>

      ${this._icpFieldInput('sexo', 'Sexo', f.sexo || '')}
      ${this._icpFieldInput('cidade', 'Cidade', f.cidade || '')}
      ${this._icpFieldInput('estado', 'Estado/UF', f.estado || '')}
      ${this._icpFieldInput('estadoCivil', 'Estado civil', f.estadoCivil || '')}
      ${this._icpFieldInput('faixaSalarial', 'Faixa salarial', f.faixaSalarial || '')}

      <p class="text-[10px] font-black text-slate-700 uppercase tracking-widest mt-3 mb-2">Idade (faixa)</p>
      <div class="flex gap-2 mb-3">
        <input type="number" placeholder="mínima" value="${f.idade_min || ''}" oninput="Actions.updateIcpDraftField('idade_min', Number(this.value) || null)" class="flex-1 px-2 py-1.5 rounded-lg bg-white border border-violet-200 text-xs font-bold" />
        <input type="number" placeholder="máxima" value="${f.idade_max || ''}" oninput="Actions.updateIcpDraftField('idade_max', Number(this.value) || null)" class="flex-1 px-2 py-1.5 rounded-lg bg-white border border-violet-200 text-xs font-bold" />
      </div>

      <div class="rounded-xl bg-white border border-violet-200 p-3 mb-3">
        <p class="text-[10px] font-black text-slate-700 uppercase tracking-widest mb-1">Como o Tier é calculado</p>
        <p class="text-[11px] text-slate-600">Comparamos os campos do lead com este perfil e classificamos:</p>
        <ul class="text-[11px] text-slate-700 mt-1 space-y-0.5">
          <li>🥇 <strong>Tier 1</strong> — 80%+ dos campos batem</li>
          <li>🥈 <strong>Tier 2</strong> — 50% a 79% batem</li>
          <li>🥉 <strong>Tier 3</strong> — abaixo de 50%</li>
        </ul>
        <p class="text-[10px] text-slate-500 mt-1.5 italic">Modo aproximado — funciona com qualquer perfil cadastrado. Pra critério exato, use o modo Por regras.</p>
      </div>
    </div>`;
  },

  // V34.9.13 — Builder de regras HubSpot puro: 3 cards Tier 1/2/3, cada um com grupos AND
  _renderRulesEditor(d) {
    const rules = d.tier_rules_json || { tier_1: [], tier_2: [], tier_3: [] };
    const tierColors = { 1: 'emerald', 2: 'amber', 3: 'slate' };
    const tierIcons = { 1: 'crown', 2: 'medal', 3: 'circle-dashed' };
    const tierLabels = { 1: 'Tier 1 — Best fit', 2: 'Tier 2 — Medium fit', 3: 'Tier 3 — Low fit' };

    return `<div class="space-y-3">
      <div class="rounded-xl bg-white border border-violet-200 p-3 mb-2">
        <p class="text-[11px] text-slate-700">Modo <strong>HubSpot puro</strong>. Defina condições explícitas por tier. Avaliação em ordem Tier 1 → 2 → 3 — primeiro que casar vence. Dentro de cada tier, vários <strong>grupos</strong> contam como "OU"; condições dentro do grupo contam como "E".</p>
      </div>
      ${[1, 2, 3].map(t => {
        const color = tierColors[t];
        const groups = rules[`tier_${t}`] || [];
        return `<div class="rounded-2xl bg-white border-2 border-${color}-300 p-4">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <i data-lucide="${tierIcons[t]}" class="w-4 h-4 text-${color}-700"></i>
              <span class="text-sm font-black text-${color}-900">${tierLabels[t]}</span>
            </div>
            <button onclick="Actions.addTierRuleGroup(${t})" class="px-3 py-1.5 rounded-xl bg-${color}-600 hover:bg-${color}-700 text-white text-[11px] font-black flex items-center gap-1.5" style="color:#fff;">
              <i data-lucide="plus" class="w-3 h-3"></i>
              Adicionar grupo
            </button>
          </div>
          ${groups.length === 0 ? `<p class="text-[11px] text-slate-400 italic">Nenhum grupo definido. Lead não cai automaticamente em Tier ${t}.</p>` : groups.map((group, gi) => this._renderTierGroup(t, gi, group, color)).join('<p class="text-[10px] text-center text-slate-400 font-black my-1">OU</p>')}
        </div>`;
      }).join('')}
    </div>`;
  },

  _renderTierGroup(tier, groupIndex, group, color) {
    return `<div class="rounded-xl bg-${color}-50 border border-${color}-200 p-3 mb-1.5">
      <div class="flex items-center justify-between mb-2">
        <span class="text-[10px] font-black text-${color}-700 uppercase tracking-widest">Grupo ${groupIndex + 1} (todas condições E)</span>
        <button onclick="Actions.removeTierRuleGroup(${tier}, ${groupIndex})" class="text-[10px] text-red-600 hover:text-red-700 font-black">× Remover grupo</button>
      </div>
      <div class="space-y-1.5">
        ${group.map((cond, ci) => this._renderCondition(tier, groupIndex, ci, cond, color)).join('')}
      </div>
      <button onclick="Actions.addTierRuleCondition(${tier}, ${groupIndex})" class="mt-2 px-2 py-1 rounded-lg bg-white border border-${color}-300 text-[10px] font-black text-${color}-700 hover:bg-${color}-100 flex items-center gap-1">
        <i data-lucide="plus" class="w-3 h-3"></i>
        Adicionar condição (E)
      </button>
    </div>`;
  },

  _renderCondition(tier, groupIndex, condIndex, cond, color) {
    const fields = [
      { value: 'sexo', label: 'Sexo' },
      { value: 'cidade', label: 'Cidade' },
      { value: 'estado', label: 'Estado/UF' },
      { value: 'estadoCivil', label: 'Estado civil' },
      { value: 'faixaSalarial', label: 'Faixa salarial' },
      { value: 'idade', label: 'Idade' }
    ];
    const ops = [
      { value: '=', label: 'igual a' },
      { value: '!=', label: 'diferente de' },
      { value: 'in', label: 'está em (lista)' },
      { value: 'not_in', label: 'não está em (lista)' },
      { value: '>', label: 'maior que' },
      { value: '<', label: 'menor que' },
      { value: '>=', label: 'maior ou igual' },
      { value: '<=', label: 'menor ou igual' },
      { value: 'between', label: 'entre (faixa)' }
    ];
    const valStr = Array.isArray(cond.value) ? cond.value.join(', ') : String(cond.value ?? '');
    const placeholder = cond.op === 'in' || cond.op === 'not_in' ? 'opção 1, opção 2'
                      : cond.op === 'between' ? 'mín, máx'
                      : 'valor';
    return `<div class="flex gap-1.5 items-center">
      <select onchange="Actions.updateTierRuleCondition(${tier}, ${groupIndex}, ${condIndex}, 'field', this.value)" class="px-2 py-1 rounded-lg bg-white border border-${color}-200 text-[11px] font-bold">
        ${fields.map(f => `<option value="${f.value}" ${cond.field === f.value ? 'selected' : ''}>${f.label}</option>`).join('')}
      </select>
      <select onchange="Actions.updateTierRuleCondition(${tier}, ${groupIndex}, ${condIndex}, 'op', this.value)" class="px-2 py-1 rounded-lg bg-white border border-${color}-200 text-[11px] font-bold">
        ${ops.map(o => `<option value="${o.value}" ${cond.op === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
      </select>
      <input type="text" placeholder="${placeholder}" value="${Utils.escape(valStr)}"
        oninput="Actions.updateTierRuleCondition(${tier}, ${groupIndex}, ${condIndex}, 'value', this.value)"
        class="flex-1 px-2 py-1 rounded-lg bg-white border border-${color}-200 text-[11px] font-bold" />
      <button onclick="Actions.removeTierRuleCondition(${tier}, ${groupIndex}, ${condIndex})" class="px-1.5 py-1 rounded-lg text-red-500 hover:bg-red-50 text-xs" title="Remover condição">×</button>
    </div>`;
  },

  _icpFieldInput(key, label, value) {
    const val = Array.isArray(value) ? value.join(', ') : String(value || '');
    return `<div class="mb-2">
      <label class="text-[10px] font-black text-slate-700 uppercase tracking-widest block mb-1">${Utils.escape(label)}</label>
      <input type="text" placeholder="ex.: opção 1, opção 2" value="${Utils.escape(val)}" oninput="Actions.updateIcpDraftField('${key}', this.value)" class="w-full px-2 py-1.5 rounded-lg bg-white border border-violet-200 text-xs font-bold" />
    </div>`;
  },

  _icpFieldLabel(k) {
    const map = {
      sexo: 'Sexo', cidade: 'Cidade', estado: 'Estado',
      estadoCivil: 'Estado civil', faixaSalarial: 'Faixa salarial',
      idade_min: 'Idade mínima', idade_max: 'Idade máxima'
    };
    return map[k] || k;
  },

  // Pílula segmentada com 3 modelos + botão "Editar" amarelo na ponta
  _modelPill(active) {
    const segments = [
      { value: 'rfv',      label: 'RFV',       disabled: false },
      { value: 'criteria', label: 'Critérios', disabled: false },
      { value: 'hybrid',   label: 'Híbrido',   disabled: true }
    ];
    return `<div class="flex items-stretch rounded-full bg-slate-100 border border-slate-200 p-1 overflow-hidden">
      ${segments.map(s => {
        const isActive = s.value === active;
        const baseCls = 'flex-1 px-4 py-2 text-xs font-black text-center transition rounded-full';
        if (s.disabled) {
          return `<div class="${baseCls} text-slate-400 cursor-not-allowed" title="Em construção">${s.label}</div>`;
        }
        if (isActive) {
          return `<div class="${baseCls} bg-slate-900 text-white" style="color:#fff;">${s.label}</div>`;
        }
        return `<button onclick="Actions.setActiveScoreModel('${s.value}')" class="${baseCls} text-slate-700 hover:bg-slate-200">${s.label}</button>`;
      }).join('')}
      <button onclick="Actions.setScoreConfigTab('settings'); document.querySelector('.score-rules-section')?.scrollIntoView({behavior:'smooth'})"
              class="px-4 py-2 ml-1 rounded-full bg-amber-400 hover:bg-amber-500 text-amber-900 text-xs font-black flex items-center gap-1"
              title="Configurar regras">
        <i data-lucide="edit-3" class="w-3 h-3"></i>
        Editar
      </button>
    </div>`;
  },

  _activeModelDescription(model) {
    const desc = {
      rfv: 'Fórmula estatística automática (Recência × Frequência × Volume). Não exige configuração — detecta engajamento natural dos sinais agregados.',
      criteria: 'Você define regras explícitas ("tag X = +20", "form Y = +50", "tag perdido = -100"). Score é a soma de todos os pontos disparados.',
      hybrid: 'Combina RFV + Critérios com pesos editáveis. EM CONSTRUÇÃO.'
    };
    return `<p class="text-xs text-slate-600 mt-3">${desc[model] || ''}</p>`;
  },

  _renderRfvSettingsCard() {
    return `<div class="rounded-2xl bg-white border border-slate-200 p-5">
      <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest mb-3">Configuração RFV</h4>
      <p class="text-xs text-slate-500 mb-2">Pesos atuais (read-only por hora):</p>
      <ul class="text-xs space-y-1 text-slate-700">
        <li>• R (Recência) = 30%</li>
        <li>• F (Frequência) = 30%</li>
        <li>• V (Volume) = 40%</li>
      </ul>
      <p class="text-[11px] text-slate-500 mt-2">Pra detalhes da fórmula, abra a aba "Score" → "Score Geral".</p>
    </div>`;
  },

  _renderCriteriaSettings(rules, draft) {
    const TYPES = [
      { value: 'tag', label: 'Tag adicionada' },
      { value: 'pageview', label: 'Visitou página' },
      { value: 'form', label: 'Preencheu form' },
      { value: 'cta', label: 'Clicou CTA' },
      { value: 'payment', label: 'Pagamento aprovado' },
      { value: 'event', label: 'Qualquer evento' },
      { value: 'score', label: 'Atingiu score X' }
    ];
    const CATEGORIES = [
      { value: 'engagement', label: 'Engajamento' },
      { value: 'fit', label: 'Fit (ICP)' },
      { value: 'intent', label: 'Intenção' }
    ];

    return `<div class="rounded-2xl bg-white border border-slate-200 p-5 score-rules-section">
      <div class="flex items-center justify-between mb-3">
        <h4 class="text-sm font-black text-slate-900 uppercase tracking-widest">Regras de Pontuação</h4>
        ${!draft ? `<button onclick="Actions.startScoreRuleDraft()" class="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-black flex items-center gap-1.5" style="color:#fff;"><i data-lucide="plus" class="w-3 h-3"></i> Adicionar regra</button>` : ''}
      </div>
      <p class="text-xs text-slate-500 mb-3">Cada regra soma (ou subtrai) pontos no score do lead quando o gatilho dispara. Pontos negativos penalizam (ex.: tag "perdido" = -50).</p>

      <div class="space-y-2">
        ${rules.length === 0 && !draft ? `<p class="text-xs text-slate-400 italic">Nenhuma regra cadastrada ainda.</p>` : ''}
        ${rules.map(r => this._ruleRow(r, TYPES, CATEGORIES)).join('')}
        ${draft ? this._ruleDraftRow(draft, TYPES, CATEGORIES) : ''}
      </div>
    </div>`;
  },

  _ruleRow(r, types, cats) {
    const typeLabel = types.find(t => t.value === r.trigger_type)?.label || r.trigger_type;
    const catLabel = cats.find(c => c.value === r.category)?.label || '';
    const isPos = (r.points || 0) >= 0;
    return `<div class="flex items-center gap-2 p-2.5 rounded-xl ${r.is_active ? 'bg-slate-50' : 'bg-slate-100 opacity-60'} border border-slate-200">
      <span class="px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 text-[10px] font-black">${Utils.escape(typeLabel)}</span>
      <span class="text-xs font-bold text-slate-700 truncate flex-1">${Utils.escape(r.trigger_param || '(qualquer)')}</span>
      ${catLabel ? `<span class="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-black">${Utils.escape(catLabel)}</span>` : ''}
      <span class="font-black text-sm ${isPos ? 'text-emerald-700' : 'text-red-700'}">${isPos ? '+' : ''}${r.points} pts</span>
      <label class="inline-flex items-center gap-1 cursor-pointer">
        <input type="checkbox" ${r.is_active ? 'checked' : ''} onchange="Actions.toggleScoreRuleActive(${r.id}, this.checked)" />
        <span class="text-[10px] font-black ${r.is_active ? 'text-emerald-700' : 'text-slate-500'}">${r.is_active ? 'ATIVO' : 'PAUSADO'}</span>
      </label>
      <button onclick="Actions.deleteScoreRule(${r.id})" class="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-[10px] font-black" title="Remover">
        <i data-lucide="trash-2" class="w-3 h-3"></i>
      </button>
    </div>`;
  },

  _ruleDraftRow(d, types, cats) {
    return `<div class="p-3 rounded-xl bg-violet-50 border-2 border-violet-300">
      <div class="flex flex-wrap items-center gap-2 mb-2">
        <select onchange="Actions.updateScoreRuleDraft('trigger_type', this.value)" class="px-2 py-1.5 rounded-lg bg-white border border-violet-200 text-xs font-black text-slate-700">
          ${types.map(t => `<option value="${t.value}" ${t.value === d.trigger_type ? 'selected' : ''}>${Utils.escape(t.label)}</option>`).join('')}
        </select>
        <input type="text" placeholder="parâmetro (ex.: lj-quente, /checkout)" value="${Utils.escape(d.trigger_param || '')}" oninput="Actions.updateScoreRuleDraft('trigger_param', this.value)" class="flex-1 min-w-[160px] px-2 py-1.5 rounded-lg bg-white border border-violet-200 text-xs font-bold" />
        <input type="number" placeholder="pontos (+/-)" value="${d.points || ''}" oninput="Actions.updateScoreRuleDraft('points', this.value)" class="w-24 px-2 py-1.5 rounded-lg bg-white border border-violet-200 text-xs font-bold" />
        <select onchange="Actions.updateScoreRuleDraft('category', this.value)" class="px-2 py-1.5 rounded-lg bg-white border border-violet-200 text-xs font-black text-slate-700">
          <option value="">— categoria —</option>
          ${cats.map(c => `<option value="${c.value}" ${c.value === d.category ? 'selected' : ''}>${Utils.escape(c.label)}</option>`).join('')}
        </select>
      </div>
      <div class="flex gap-2">
        <button onclick="Actions.saveScoreRuleDraft()" class="px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-black" style="color:#fff;">Salvar</button>
        <button onclick="Actions.cancelScoreRuleDraft()" class="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-black">Cancelar</button>
      </div>
    </div>`;
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
