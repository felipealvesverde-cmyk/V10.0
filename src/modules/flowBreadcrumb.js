// V38.1.64 — FlowBreadcrumb refeito (Leonardo, ato II)
//
// V38.1.63 entregou um container cinza em cima do header escuro = lama
// visual. Felipe descartou. Refazendo com sutileza absoluta:
//
//   Sem fundo. Sem border. Sem sombra. O fluxo é uma fita narrativa
//   solta no espaço entre o header e os blocos brancos.
//
//   Só a pílula ATIVA carrega cor cheia (ancora visual única).
//   Anteriores: texto + ícone NA cor temática, sem pill.
//   Futuros:   texto + ícone em slate-400, sem pill.
//   Separador: ponto sutil "·" em slate-300 (não chevron — chevron pesa).
//
// Cromática mantida (violet → sky → amber → emerald) mas só vibra
// quando você está NAQUELE degrau. O resto é tipografia limpa.

window.FlowBreadcrumb = {
  STAGES: [
    { id: 'products',   label: 'Produtos',   icon: 'package',     tone: 'violet'  },
    { id: 'campaigns',  label: 'Campanhas',  icon: 'megaphone',   tone: 'sky'     },
    { id: 'actions',    label: 'Ações',      icon: 'plug',        tone: 'amber'   },
    { id: 'executions', label: 'Execuções',  icon: 'play-circle', tone: 'emerald' }
  ],

  render(activeStage) {
    const stages = this.STAGES;
    const activeIndex = stages.findIndex(s => s.id === activeStage);
    const items = stages.map((stage, i) => {
      const isActive = i === activeIndex;
      const isPast = activeIndex >= 0 && i < activeIndex;
      return this._item(stage, isActive, isPast);
    });
    return `<nav aria-label="Fluxo do Revenue OS" class="flex items-center justify-center flex-wrap gap-2 sm:gap-3 px-2 py-1">
      ${items.join(this._sep())}
    </nav>`;
  },

  _item(stage, isActive, isPast) {
    const { id, label, icon, tone } = stage;
    if (isActive) {
      // Única âncora visual: pill cheia colorida + sombra suave da cor.
      return `<span aria-current="page" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-${tone}-500 text-white text-[10px] font-black uppercase tracking-widest shadow-sm shadow-${tone}-500/20 cursor-default" style="color:#fff!important;">
        <i data-lucide="${icon}" class="w-3 h-3"></i>
        <span>${label}</span>
      </span>`;
    }
    if (isPast) {
      // Contexto percorrido: só texto+ícone na cor temática. Sem fundo.
      return `<button onclick="App.setTab('${id}')" aria-label="Voltar para ${label}" class="inline-flex items-center gap-1.5 text-${tone}-600 hover:text-${tone}-800 text-[10px] font-black uppercase tracking-widest transition">
        <i data-lucide="${icon}" class="w-3 h-3"></i>
        <span>${label}</span>
      </button>`;
    }
    // Futuro: neutro mas presente. Clicável.
    return `<button onclick="App.setTab('${id}')" aria-label="Ir para ${label}" class="inline-flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-[10px] font-black uppercase tracking-widest transition">
      <i data-lucide="${icon}" class="w-3 h-3"></i>
      <span>${label}</span>
    </button>`;
  },

  _sep() {
    return `<span class="text-slate-300 select-none text-xs" aria-hidden="true">·</span>`;
  }
};
