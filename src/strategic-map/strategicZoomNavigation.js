// V17.1 — Strategic Journey Navigation
// As 5 etapas sequenciais do Mapa da Receita. Cada etapa tem critério de
// conclusão (avaliado pelo StrategicMapEngine.journeyProgress) e o usuário
// avança pela jornada via CTAs "Próximo passo →" ou clicando direto na etapa.
window.StrategicZoomNavigation = {
  // V27.0.0 — Renomeado pra seguir Doerr (Measure What Matters / Avalie o que importa).
  //   1. Visão do Produto — 1 frase aspiracional (mantém)
  //   2. Objectives — qualitativos, 3-5 (mantém nome "Objetivos" mas explicita conceito)
  //   3. Key Results — quantitativos por Objective (renomeado de "OKRs")
  //   4. Conectar à Operação — ações que entregam o número
  //   5. Executar via Djow — tarefas no provider operacional
  LEVELS: [
    { id: 'vision',     label: 'Visão do Produto',   short: 'Visão',         icon: 'eye',       description: 'Em uma frase: onde esse produto chega em 12 meses.' },
    { id: 'objectives', label: 'Objectives',          short: 'Objectives',    icon: 'flag',      description: 'Frases qualitativas e ambiciosas. 3-5 no máximo.' },
    { id: 'okrs',       label: 'Key Results',         short: 'Key Results',   icon: 'target',    description: 'Por Objective, 3-5 KRs mensuráveis: "de X pra Y até Z".' },
    { id: 'operations', label: 'Conectar à Operação', short: 'Operação',      icon: 'plug',      description: 'Cada KR ↔ campanhas e ações que entregam o número.' },
    { id: 'execution',  label: 'Executar via Djow',   short: 'Executar',      icon: 'send',      description: 'Dispare tarefas no provider operacional.' }
  ],

  _aliasMap: { strategy: 'vision', flows: 'operations', actions: 'operations' },

  current() {
    const raw = App.state.strategicMapZoom || 'vision';
    const aliased = this._aliasMap[raw] || raw;
    return this.LEVELS.some(l => l.id === aliased) ? aliased : 'vision';
  },

  index() {
    return this.LEVELS.findIndex(l => l.id === this.current());
  },

  level(id) {
    return this.LEVELS.find(l => l.id === id) || this.LEVELS[0];
  },

  set(level) {
    const aliased = this._aliasMap[level] || level;
    if (!this.LEVELS.some(l => l.id === aliased)) return;
    App.state.strategicMapZoom = aliased;
  },

  next() {
    const idx = this.index();
    return this.LEVELS[Math.min(idx + 1, this.LEVELS.length - 1)];
  },

  isLast() { return this.index() >= this.LEVELS.length - 1; }
};
