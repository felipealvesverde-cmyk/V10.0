// Modal dedicado de edição de ação. Separa o fluxo de edição do painel de listagem.
var ActionEditModal = {
  render() {
    if (!App.state.showActionEditModal || !App.state.actionEditDraft) return '';
    const draft = App.state.actionEditDraft;
    const path = FlowResolutionEngine.resolve(
      draft.originSector || draft.sector,
      draft.originFunnel || draft.funnel,
      draft.destinationSector || draft.sector,
      draft.destinationFunnel || draft.funnel
    );
    const kpis = Array.isArray(draft.okrs) ? draft.okrs : [];
    return `<div class="fixed inset-0 z-[999] bg-slate-950/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div class="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-3xl mx-auto mt-8 overflow-hidden">
        <header class="bg-slate-900 text-white p-5 flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-black text-slate-300 uppercase tracking-wider">Editar ação</p>
            <h3 class="text-2xl font-black">${Utils.escape(draft.name || 'Ação sem nome')}</h3>
          </div>
          <button onclick="Actions.closeActionEditModal()" class="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-black text-xl" title="Fechar">×</button>
        </header>

        <div class="p-5 space-y-4">
          <div>
            <label class="text-xs font-black text-slate-500">Nome da ação</label>
            <input id="action_edit_name" data-focus-key="action_edit_name" value="${Utils.escape(draft.name || '')}" oninput="Actions.updateActionEditFieldSilent('name', this.value)" onchange="App.render()" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold mt-1" />
          </div>

          <div class="rounded-3xl bg-slate-50 border border-slate-100 p-4">
            <h4 class="font-black mb-3">Contexto operacional</h4>
            <div class="grid grid-cols-2 gap-2">
              <div><label class="text-xs font-black text-slate-500">Setor</label><select onchange="Actions.updateActionEditField('sector', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold mt-1">${Config.sectors.map(s => `<option ${draft.sector === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
              <div><label class="text-xs font-black text-slate-500">Funil</label><select onchange="Actions.updateActionEditField('funnel', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold mt-1">${Config.funnels.map(f => `<option ${draft.funnel === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
              <div><label class="text-xs font-black text-slate-500">Canal</label><select onchange="Actions.updateActionEditField('channel', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold mt-1">${Config.allChannels().map(channel => `<option value="${Utils.escape(channel)}" ${draft.channel === channel ? 'selected' : ''}>${Utils.escape(channel)}</option>`).join('')}</select></div>
              <div><label class="text-xs font-black text-slate-500">Tipo</label><select onchange="Actions.updateActionEditField('actionType', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold mt-1">${Config.allActionTypes().map(t => `<option ${draft.actionType === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
            </div>
          </div>

          <div class="rounded-3xl bg-slate-50 border border-slate-100 p-4">
            <h4 class="font-black mb-1">Travessia da ação</h4>
            <p class="text-xs text-slate-500 mb-3">A origem segue o Contexto operacional: <b>${Utils.escape(draft.sector || 'Marketing')} ${Utils.escape(draft.funnel || 'MOF')}</b>. Aqui você define onde a ação termina.</p>
            <div class="grid grid-cols-2 gap-2 mb-3">
              <div><label class="text-xs font-black text-slate-500">Destino setor</label><select onchange="Actions.updateActionEditField('destinationSector', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold mt-1">${Config.sectors.map(s => `<option ${draft.destinationSector === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
              <div><label class="text-xs font-black text-slate-500">Destino funil</label><select onchange="Actions.updateActionEditField('destinationFunnel', this.value)" class="w-full px-3 py-3 rounded-2xl bg-white border border-slate-200 font-semibold mt-1">${Config.funnels.map(f => `<option ${draft.destinationFunnel === f ? 'selected' : ''}>${f}</option>`).join('')}</select></div>
            </div>
            <div class="text-xs font-black text-slate-500 mb-2">Fluxo obrigatório resolvido</div>
            <div class="flex flex-wrap gap-2">${path.map((stage, index) => `<span class="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-black">${index + 1}. ${FlowResolutionEngine.label(stage)}</span>`).join('')}</div>
          </div>

          <div>
            <label class="text-xs font-black text-slate-500">Descrição da Ação</label>
            <textarea id="action_edit_objective" data-focus-key="action_edit_objective" oninput="Actions.updateActionEditFieldSilent('objective', this.value)" onchange="App.render()" placeholder="Qual sinal esta ação precisa gerar?" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold min-h-[80px] mt-1">${Utils.escape(draft.objective || '')}</textarea>
          </div>

          <div class="rounded-3xl bg-slate-50 border border-slate-100 p-4">
            <div class="flex items-center justify-between mb-3">
              <div>
                <h4 class="font-black">KPIs da ação</h4>
                <p class="text-xs text-slate-500">Indicadores que esta ação alimenta.</p>
              </div>
              <button onclick="Actions.addActionEditKpi()" class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-black">+ Adicionar KPI</button>
            </div>
            <div class="space-y-2">${kpis.map((kpi, index) => this._kpiRow(kpi, index)).join('') || '<p class="text-sm text-slate-500">Nenhum KPI cadastrado.</p>'}</div>
          </div>

          <div>
            <label class="text-xs font-black text-slate-500">Status da ação</label>
            <select onchange="Actions.updateActionEditField('status', this.value)" class="w-full px-4 py-3 rounded-2xl bg-slate-100 font-semibold mt-1">
              ${['Pronta para conectar','Ativa','Pausada','Encerrada'].map(s => `<option ${draft.status === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>

          ${this._rdCrmBlock(draft)}
        </div>

        <footer class="px-5 py-4 border-t border-slate-100 flex flex-col md:flex-row gap-2 justify-end">
          <button onclick="Actions.closeActionEditModal()" class="px-5 py-3 rounded-2xl bg-slate-100 text-slate-700 font-black">Cancelar</button>
          <button onclick="Actions.deleteActionFromEdit()" class="px-5 py-3 rounded-2xl bg-red-50 border border-red-200 text-red-600 font-black">Excluir ação</button>
          <button onclick="Actions.saveActionEdit()" style="color:#fff!important;" class="px-5 py-3 rounded-2xl bg-slate-900 text-white font-black lj-dark-button">Salvar alterações</button>
        </footer>
      </div>
    </div>`;
  },

  _rdCrmBlock(draft) {
    const enabled = Boolean(draft.rdCrmEnabled);
    // V21.6 — stageMap vem do pipeline da campanha da action (1 pipeline por campanha).
    // Fallback para stageMap global legacy (V21.5 e anteriores).
    const stageMap = window.RdCrmConfig?.stageMapForCampaign
      ? RdCrmConfig.stageMapForCampaign(draft.campaignId)
      : (App.state.integrations?.rdCrm?.stageMap || {});
    const pipelineInfo = window.RdCrmConfig?.pipelineInfoForCampaign?.(draft.campaignId) || null;
    const stageOptions = Object.entries(stageMap).map(([code, info]) => ({
      value: info.rdStageId,
      label: `${info.label} (${code})`
    }));
    const hasStages = stageOptions.length > 0;
    const pipelineHint = pipelineInfo?.pipelineName
      ? `Pipeline RD da campanha: <b>${Utils.escape(pipelineInfo.pipelineName)}</b>`
      : 'Pipeline RD ainda não foi criado para esta campanha.';
    return `<div class="rounded-3xl bg-sky-50 border border-sky-200 p-4">
      <div class="flex items-start justify-between gap-3 mb-3">
        <div>
          <div class="flex items-center gap-2"><i data-lucide="workflow" class="w-4 h-4 text-sky-700"></i><h4 class="font-black text-sky-900">Integração RD CRM</h4></div>
          <p class="text-xs text-sky-800/80 mt-1">Acompanhe a passagem desta ação pelo pipeline do RD. A conversão é contabilizada quando o lead atinge a etapa final.</p>
        </div>
        <button onclick="Actions.updateActionEditField('rdCrmEnabled', ${!enabled})" class="relative w-12 h-7 rounded-full transition ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}" aria-pressed="${enabled}">
          <span class="absolute top-1 ${enabled ? 'right-1' : 'left-1'} w-5 h-5 rounded-full bg-white shadow"></span>
        </button>
      </div>
      ${enabled ? (hasStages ? `<div class="grid md:grid-cols-2 gap-3 mt-3">
        <div>
          <label class="text-xs font-black text-sky-700 uppercase tracking-wider">Etapa inicial</label>
          <select onchange="Actions.updateActionEditField('rdCrmStartStageId', this.value)" class="mt-1 w-full px-3 py-2.5 rounded-xl bg-white border border-sky-200 font-semibold text-sm">
            <option value="">— selecionar —</option>
            ${stageOptions.map(opt => `<option value="${Utils.escape(opt.value)}" ${draft.rdCrmStartStageId === opt.value ? 'selected' : ''}>${Utils.escape(opt.label)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="text-xs font-black text-sky-700 uppercase tracking-wider">Etapa final (conversão)</label>
          <select onchange="Actions.updateActionEditField('rdCrmEndStageId', this.value)" class="mt-1 w-full px-3 py-2.5 rounded-xl bg-white border border-sky-200 font-semibold text-sm">
            <option value="">— selecionar —</option>
            ${stageOptions.map(opt => `<option value="${Utils.escape(opt.value)}" ${draft.rdCrmEndStageId === opt.value ? 'selected' : ''}>${Utils.escape(opt.label)}</option>`).join('')}
          </select>
        </div>
        <div class="md:col-span-2 text-[11px] text-sky-700/80">
          ${draft.rdCrmLastSyncAt ? `Último sync: ${Utils.escape(new Date(draft.rdCrmLastSyncAt).toLocaleString('pt-BR'))} · Status: ${Utils.escape(draft.rdCrmSyncStatus || 'pending')}` : 'Ainda sem sync. Use "Sincronizar agora" em Configurações → API RD CRM.'}
        </div>
      </div>` : `<div class="rounded-2xl bg-white border border-sky-200 p-3 text-xs text-sky-800">
        ${pipelineHint} Vá em <b>Configurações → API RD CRM</b> e sincronize a campanha desta ação para provisionar o pipeline.
      </div>`) : ''}
    </div>`;
  },

  _kpiRow(kpi, index) {
    const fName = `action_edit_kpi_${index}_name`;
    const fTarget = `action_edit_kpi_${index}_target`;
    const fCurrent = `action_edit_kpi_${index}_current`;
    return `<div class="grid grid-cols-[1fr_74px_74px_36px] gap-2 items-center">
      <input id="${fName}" data-focus-key="${fName}" value="${Utils.escape(kpi.name || '')}" oninput="Actions.updateActionEditKpiSilent(${index}, 'name', this.value)" onchange="App.render()" placeholder="Nome do KPI" class="px-3 py-2.5 rounded-xl bg-white border border-slate-200 font-semibold text-sm" />
      <input id="${fTarget}" data-focus-key="${fTarget}" value="${Utils.escape(kpi.target || '')}" oninput="Actions.updateActionEditKpiSilent(${index}, 'target', this.value)" onchange="App.render()" placeholder="Meta" class="px-3 py-2.5 rounded-xl bg-white border border-slate-200 font-black text-sm" />
      <input id="${fCurrent}" data-focus-key="${fCurrent}" value="${Utils.escape(kpi.current || '')}" oninput="Actions.updateActionEditKpiSilent(${index}, 'current', this.value)" onchange="App.render()" placeholder="Atual" class="px-3 py-2.5 rounded-xl bg-white border border-slate-200 font-black text-sm" />
      <button onclick="Actions.removeActionEditKpi(${index})" title="Remover KPI" class="w-9 h-9 rounded-xl bg-red-50 border border-red-200 text-red-500 font-black flex items-center justify-center">×</button>
    </div>`;
  }
};
window.ActionEditModal = ActionEditModal;
