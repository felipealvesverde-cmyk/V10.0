// V38.1.43 — Modal "Por que esse lead virou X?"
//
// Abre quando user clica na badge de camada (SUSPECT/PA/ICP/BP) no card de
// lead na tela de Leads. Mostra:
//   - Quem é o lead + produto de referência
//   - Camada atingida + se veio do schema OU do atalho de entityType (V34)
//   - Detalhe por camada: cada campo obrigatório com ✓/✗ + por que
//   - Threshold + pct atingido por camada
//
// State: App.state.audienceDrillModal = { open: true, leadId, productId? }

var AudienceLayerDrillModal = {
  render() {
    const m = App.state.audienceDrillModal;
    if (!m || !m.open) return '';
    const lead = this._findLead(m.leadId);
    if (!lead) return '';
    if (!window.AudienceTransmutationEngine) return '';
    const result = AudienceTransmutationEngine.getLayerForLead(lead, m.productId || App.state.selectedProductId);
    if (!result) {
      return this._wrap(`<div class="p-6 text-center">
        <p class="text-sm text-slate-600">Nenhum produto com audiência configurada. Configure a audiência de pelo menos um produto pra ver o drill-down.</p>
      </div>`, 'Sem produto de referência');
    }
    const layerMap = {
      'lj-suspect': { tone: 'slate',  label: 'Suspect', icon: 'help-circle' },
      'lj-pa':      { tone: 'violet', label: 'PA',      icon: 'circle' },
      'lj-icp':     { tone: 'pink',   label: 'ICP',     icon: 'target' },
      'lj-bp':      { tone: 'amber',  label: 'BP',      icon: 'user-check' }
    };
    const m1 = layerMap[result.layer] || layerMap['lj-suspect'];
    const shortcutBanner = result.shortcut
      ? `<div class="rounded-xl bg-emerald-50 border border-emerald-200 border-l-4 border-l-emerald-600 px-3 py-2 mb-3 flex items-start gap-2">
          <i data-lucide="zap" class="w-4 h-4 text-emerald-700 mt-0.5 shrink-0"></i>
          <div class="text-xs text-emerald-900 leading-relaxed">
            <p><b>Atalho aplicado:</b> a classificação foi elevada por causa do entityType do LJ (${Utils.escape(result.shortcut.via)}).</p>
            <p class="mt-0.5 text-emerald-700">Pelo schema só, a camada seria <b>${(layerMap[result.layerFromSchema] || {}).label || result.layerFromSchema}</b>. O LJ já reconhece esse lead como mais avançado e o ICP respeita.</p>
          </div>
        </div>`
      : '';
    const header = `<div class="bg-${m1.tone}-700 text-white p-5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="text-[10px] font-black text-${m1.tone}-200 uppercase tracking-widest">Audiência · drill-down</p>
            <div class="flex items-center gap-2 mt-1 flex-wrap">
              <h2 class="text-xl font-black truncate">${Utils.escape(lead.name || lead.email || 'Lead')}</h2>
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-white/15 text-white border border-white/20"><i data-lucide="${m1.icon}" class="w-2.5 h-2.5"></i>${m1.label}</span>
            </div>
            <p class="text-xs text-${m1.tone}-200 mt-1">Produto de referência: <b>${Utils.escape(result.productName)}</b> · Threshold ${Math.round((result.threshold || 0.8) * 100)}%</p>
          </div>
          <button onclick="Actions.closeAudienceDrillModal()" title="Fechar" class="w-9 h-9 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black text-lg">×</button>
        </div>
      </div>`;
    const body = `<div class="p-5 space-y-3">
        ${shortcutBanner}
        <div class="grid md:grid-cols-3 gap-3">
          ${this._layerCard('Público-Alvo', 'PA', result.details.pa, result.paPct, result.threshold, 'violet')}
          ${this._layerCard('ICP',           'B',  result.details.icp, result.icpPct, result.threshold, 'pink')}
          ${this._layerCard('Buyer Persona', 'A',  result.details.bp,  result.bpPct,  result.threshold, 'amber')}
        </div>
        ${this._explainer(result)}
      </div>`;
    return this._wrap(header + body, '');
  },

  _wrap(inner, fallbackTitle) {
    if (fallbackTitle) {
      return `<div class="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
        <div class="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-md mx-auto mt-12 overflow-hidden">
          <header class="bg-slate-900 text-white p-4 flex items-center justify-between gap-2">
            <p class="font-black text-sm">${Utils.escape(fallbackTitle)}</p>
            <button onclick="Actions.closeAudienceDrillModal()" class="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white font-black">×</button>
          </header>
          ${inner}
        </div>
      </div>`;
    }
    return `<div class="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div class="bg-white rounded-[2rem] shadow-2xl border border-slate-100 w-full max-w-3xl mx-auto mt-8 overflow-hidden">
        ${inner}
      </div>
    </div>`;
  },

  _findLead(leadId) {
    if (!leadId) return null;
    const all = []
      .concat(App.state.globalLeads || [])
      .concat((App.state.actions || []).flatMap(a => a.leads || []));
    return all.find(l => String(l.id) === String(leadId)) || null;
  },

  _layerCard(title, tag, detail, pct, threshold, tone) {
    const thresholdPct = Math.round((threshold || 0.8) * 100);
    const passed = pct >= thresholdPct;
    const row = (rowItem, status) => {
      const icon = status === 'hit'  ? '<i data-lucide="check" class="w-3 h-3 text-emerald-600"></i>'
                 : status === 'miss' ? '<i data-lucide="x"     class="w-3 h-3 text-rose-500"></i>'
                 :                     '<i data-lucide="minus" class="w-3 h-3 text-slate-400"></i>';
      const cls = status === 'hit' ? 'bg-emerald-50/60 border-emerald-200' : status === 'miss' ? 'bg-rose-50/60 border-rose-200' : 'bg-slate-50 border-slate-200';
      const typeBadge = rowItem.type === 'fit'
        ? `<span class="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-700 border border-emerald-200">FIT</span>`
        : `<span class="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">DADO</span>`;
      const optBadge = rowItem.optional ? `<span class="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 border border-amber-200">OPC</span>` : '';
      return `<div class="rounded-lg border px-2 py-1.5 flex items-center gap-1.5 ${cls}">
        ${icon}
        <span class="text-[11px] font-bold text-slate-700 truncate flex-1">${Utils.escape(rowItem.label || rowItem.key)}</span>
        ${optBadge}
        ${typeBadge}
      </div>`;
    };
    const hits = (detail?.hits || []).map(r => row(r, 'hit')).join('');
    const misses = (detail?.missing || []).map(r => row(r, 'miss')).join('');
    const optHits = (detail?.optionalHits || []).map(r => row(r, 'optional')).join('');
    const empty = !hits && !misses && !optHits
      ? `<p class="text-[11px] text-slate-400 italic">Sem campos.</p>`
      : '';
    return `<div class="rounded-2xl bg-${tone}-50/40 border border-${tone}-200 border-l-4 border-l-${tone}-500 p-3">
      <div class="flex items-center gap-2 mb-2 flex-wrap">
        <span class="w-5 h-5 rounded-md bg-${tone}-100 text-${tone}-700 grid place-items-center text-[10px] font-black">${tag}</span>
        <p class="text-[11px] font-black text-${tone}-900 uppercase tracking-widest">${title}</p>
        <span class="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${passed ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}">${pct}% ${passed ? '✓' : ''}</span>
      </div>
      <div class="space-y-1">${hits}${misses}${optHits}${empty}</div>
    </div>`;
  },

  _explainer(result) {
    const T = Math.round((result.threshold || 0.8) * 100);
    const paOk  = result.paPct  >= T;
    const icpOk = result.icpPct >= T;
    const bpOk  = result.bpPct  >= T;
    let texto = '';
    if (result.shortcut) {
      texto = `Pelo schema só, esse lead seria <b>${result.layerFromSchema.replace('lj-', '').toUpperCase()}</b>. Como o LJ já o classificou como ${result.shortcut.via.split('=')[1]} (signals mais ricos do que o quadro de audiência), o ICP respeitou essa classificação.`;
    } else if (bpOk) {
      texto = 'Bateu todas as camadas e atingiu BP — esse lead é o seu Buyer Persona ideal: PA + ICP + pessoa decisora identificada.';
    } else if (icpOk) {
      texto = 'Atingiu PA e ICP, mas faltam campos de Buyer Persona (pessoa decisora identificada). Sobe pra BP quando esses campos chegarem.';
    } else if (paOk) {
      texto = 'Está no PA — perfil de empresa/pessoa bate. Pra virar ICP precisa de sinais de viabilidade comercial (orçamento, momento de compra, uso da categoria).';
    } else {
      texto = `Está como Suspect — não bateu ${T}% no PA. <b>Atenção:</b> ausência de sinal não significa "público ruim", costuma significar "ainda não coletamos esse dado". Olhe os ✗ acima — são oportunidades de coleta, não de descarte.`;
    }
    return `<div class="rounded-2xl bg-slate-50 border border-slate-200 border-l-4 border-l-slate-400 p-3 text-xs text-slate-700 leading-relaxed">${texto}</div>`;
  }
};

window.AudienceLayerDrillModal = AudienceLayerDrillModal;
