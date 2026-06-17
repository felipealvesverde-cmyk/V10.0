// V38.1.63 — FlowBreadcrumb (Leonardo)
//
// Componente compartilhado: o "menu de fluxo" que aparece entre o header
// escuro e os 2 blocos brancos das telas Produtos / Campanhas / Ações /
// Execuções.
//
// Visão Leonardo:
//   O fluxo Produto → Campanha → Ação → Execução é uma narrativa de zoom-in.
//   Cada degrau é um nível de concretude maior, e o usuário precisa SENTIR
//   essa hierarquia ANTES de ler. Por isso a cromática viaja do abstrato
//   pro concreto:
//     Produto    → violet   (estratégia / governança / topo do mapa)
//     Campanha   → sky      (orquestração / céu aberto)
//     Ação       → amber    (operação / terra / chão)
//     Execução   → emerald  (vida / gesto / feito)
//
// Estados visuais por pill:
//   ATIVO (estágio atual): bg cheio da cor, border-2 da cor-300, sombra
//     suave, texto branco. É o "trono" — sem onclick, cursor-default.
//   CONTEXTO (estágios anteriores): bg-{cor}-50, border-{cor}-200,
//     texto-{cor}-700, ícone-{cor}-600. Clicável.
//   FUTURO (estágios não destravados): bg-slate-50, border-slate-200,
//     texto-slate-400. Clicável também — Felipe gosta de liberdade
//     de navegação. Quem clica em Execução sem contexto vai pra tela
//     em modo "sem ação selecionada" e a tela mostra estado vazio.
//
// Entre cada pill, um chevron-right cinza que escurece quando o segmento
// anterior já foi percorrido — Gestalt de continuidade.
//
// Uso:
//   ${FlowBreadcrumb.render('actions')}      // pill ativa = Ações
//   ${FlowBreadcrumb.render('executions')}   // pill ativa = Execuções

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
    const pills = stages.map((stage, i) => {
      const isActive = i === activeIndex;
      const isPast = activeIndex >= 0 && i < activeIndex;
      const isFuture = activeIndex >= 0 && i > activeIndex;
      return this._pill(stage, { isActive, isPast, isFuture, index: i, total: stages.length, prevToneIfPast: i > 0 ? stages[i - 1].tone : null });
    });
    return `<nav aria-label="Fluxo do Revenue OS" class="flex items-center justify-center flex-wrap gap-1.5 sm:gap-2 py-3 px-2 rounded-2xl bg-white/50 backdrop-blur-sm border border-slate-200/70 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
      ${pills.join(this._chevron())}
    </nav>`;
  },

  _pill(stage, { isActive, isPast, isFuture }) {
    const { id, label, icon, tone } = stage;
    if (isActive) {
      // Trono: bg cheio da cor + sombra colorida + ring sutil.
      return `<span aria-current="page" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-${tone}-500 border-2 border-${tone}-300 text-white text-[11px] font-black uppercase tracking-widest shadow-md shadow-${tone}-500/30 cursor-default" style="color:#fff!important;">
        <i data-lucide="${icon}" class="w-3.5 h-3.5"></i>
        <span>${label}</span>
      </span>`;
    }
    if (isPast) {
      // Contexto percorrido: bg-cor-50, texto-cor-700.
      return `<button onclick="App.setTab('${id}')" aria-label="Voltar para ${label}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-${tone}-50 border border-${tone}-200 text-${tone}-700 text-[11px] font-black uppercase tracking-widest hover:bg-${tone}-100 hover:border-${tone}-300 transition cursor-pointer">
        <i data-lucide="${icon}" class="w-3 h-3 text-${tone}-600"></i>
        <span>${label}</span>
      </button>`;
    }
    // Futuro: neutro. Clicável mas sem destaque.
    return `<button onclick="App.setTab('${id}')" aria-label="Ir para ${label}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 text-[11px] font-black uppercase tracking-widest hover:bg-slate-100 hover:text-slate-600 hover:border-slate-300 transition cursor-pointer">
      <i data-lucide="${icon}" class="w-3 h-3"></i>
      <span>${label}</span>
    </button>`;
  },

  _chevron() {
    // Chevron neutro entre pills. Cor sutil pra deixar o ritmo claro
    // sem competir com as pills.
    return `<i data-lucide="chevron-right" class="w-3.5 h-3.5 text-slate-400 shrink-0"></i>`;
  }
};
