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
        ${this._collectionAdvisor(result)}
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

  // V38.1.46 — Assistente de Coleta agrupado por estratégia.
  // Junta missing de PA + ICP + BP e mostra como ATACAR cada grupo.
  _collectionAdvisor(result) {
    if (!window.AudienceCollectionAdvisor) return '';
    const allMissing = [
      ...(result.details.pa.missing || []),
      ...(result.details.icp.missing || []),
      ...(result.details.bp.missing || [])
    ];
    if (!allMissing.length) {
      return `<div class="rounded-2xl bg-emerald-50 border border-emerald-200 border-l-4 border-l-emerald-600 p-3 text-xs text-emerald-900 leading-relaxed">
        <b>Lead com dados completos.</b> Nenhuma sugestão de coleta — todos os campos obrigatórios estão presentes. Parabéns ao seu time de captura.
      </div>`;
    }
    const groups = AudienceCollectionAdvisor.groupByStrategy(allMissing);
    const totalGroups = Object.keys(groups).length;
    const totalFields = allMissing.length;
    const djowHints = App.state.audienceDrillModal?.djowHints || {};
    const groupsHtml = Object.entries(groups).map(([key, group]) => {
      const meta = group.meta;
      const fieldsList = group.fields.map(f => `<span class="inline-block px-1.5 py-0.5 rounded bg-white/70 border border-${meta.tone}-200 text-${meta.tone}-800 text-[10px] font-bold mr-1 mb-1">${Utils.escape(f.label || f.key)}</span>`).join('');
      const artifact = AudienceCollectionAdvisor.generateArtifact(key, group.fields);
      const djowSlot = djowHints[key];
      let djowBlock = '';
      if (djowSlot?.loading) {
        djowBlock = `<div class="rounded-lg bg-violet-50 border border-violet-200 px-2.5 py-2 flex items-center gap-2">
          <div class="w-3 h-3 rounded-full border-2 border-violet-300 border-t-violet-700 animate-spin shrink-0"></div>
          <p class="text-[10px] text-violet-900"><b>Djow está adaptando pro seu setup…</b></p>
        </div>`;
      } else if (djowSlot?.error) {
        djowBlock = `<div class="rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-2">
          <p class="text-[10px] text-rose-900"><b>Djow não respondeu:</b> ${Utils.escape(djowSlot.error)}</p>
          <button onclick="Actions.djowAudienceCollectHint('${key}')" class="mt-1 px-2 py-0.5 rounded bg-rose-700 text-white text-[10px] font-black">Tentar de novo</button>
        </div>`;
      } else if (djowSlot?.hint) {
        const paragrafos = String(djowSlot.hint).split(/\n\s*\n/).filter(p => p.trim().length);
        const djowHtml = paragrafos.map(p => `<p>${Utils.escape(p).replace(/\n/g, '<br>')}</p>`).join('');
        djowBlock = `<div class="rounded-lg bg-gradient-to-br from-violet-50 to-pink-50 border border-violet-200 border-l-2 border-l-violet-600 px-2.5 py-2">
          <div class="flex items-center gap-1.5 mb-1">
            <i data-lucide="sparkles" class="w-3 h-3 text-violet-700"></i>
            <p class="text-[9px] font-black text-violet-700 uppercase tracking-widest">Sugestão do Djow</p>
            <button onclick="Actions.djowAudienceCollectHint('${key}')" title="Pedir novamente" class="ml-auto text-[9px] text-violet-700 hover:text-violet-900"><i data-lucide="refresh-cw" class="w-2.5 h-2.5"></i></button>
          </div>
          <div class="text-[11px] text-slate-800 leading-relaxed space-y-1">${djowHtml}</div>
        </div>`;
      } else {
        djowBlock = `<button onclick="Actions.djowAudienceCollectHint('${key}')" class="text-[10px] font-black text-violet-700 hover:text-violet-900 flex items-center gap-1 underline">
          <i data-lucide="sparkles" class="w-3 h-3"></i> Pedir ao Djow refinar pro meu setup
        </button>`;
      }
      return `<details class="rounded-xl border border-${meta.tone}-200 bg-${meta.tone}-50/40 border-l-4 border-l-${meta.tone}-500 overflow-hidden">
        <summary class="px-3 py-2 cursor-pointer select-none flex items-center gap-2">
          <i data-lucide="${meta.icon}" class="w-3.5 h-3.5 text-${meta.tone}-700 shrink-0"></i>
          <span class="text-[11px] font-black text-${meta.tone}-900 flex-1">${Utils.escape(meta.label || key)}</span>
          <span class="text-[10px] font-bold text-${meta.tone}-700">${group.fields.length} campo(s)</span>
          <span class="text-[9px] font-black px-1.5 py-0.5 rounded bg-${meta.tone}-100 text-${meta.tone}-700 border border-${meta.tone}-200 shrink-0">${Utils.escape(meta.cost || '')}</span>
        </summary>
        <div class="px-3 pb-3 pt-1 space-y-2 border-t border-${meta.tone}-200">
          <div class="flex flex-wrap">${fieldsList}</div>
          <p class="text-[11px] text-slate-700 leading-relaxed">${Utils.escape(meta.diagnostico || '')}</p>
          <pre class="text-[10px] bg-slate-900 text-emerald-100 p-2.5 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono">${Utils.escape(artifact)}</pre>
          ${djowBlock}
        </div>
      </details>`;
    }).join('');

    return `<div class="rounded-2xl bg-gradient-to-br from-slate-50 to-violet-50/40 border border-slate-200 border-l-4 border-l-violet-600 p-3 space-y-2">
      <div class="flex items-center gap-2">
        <i data-lucide="lightbulb" class="w-4 h-4 text-violet-700"></i>
        <p class="text-[11px] font-black text-violet-900 uppercase tracking-widest flex-1">Assistente de coleta</p>
        <span class="text-[10px] font-bold text-violet-700">${totalGroups} estratégia(s) · ${totalFields} campo(s)</span>
      </div>
      <p class="text-[11px] text-slate-700 leading-relaxed">${totalFields} campo(s) faltando no quadro desse lead. Em vez de atacar campo por campo, o LJ agrupa por <b>estratégia de coleta</b> — assim você resolve vários de uma vez com uma única ação no RD ou no processo do time.</p>
      <div class="space-y-1.5">${groupsHtml}</div>
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
