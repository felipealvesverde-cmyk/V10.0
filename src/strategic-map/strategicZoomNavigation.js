// V17.1 — Strategic Journey Navigation
// As 5 etapas sequenciais do Mapa da Receita. Cada etapa tem critério de
// conclusão (avaliado pelo StrategicMapEngine.journeyProgress) e o usuário
// avança pela jornada via CTAs "Próximo passo →" ou clicando direto na etapa.
window.StrategicZoomNavigation = {
  // V28.0.0 — Renomeação didática (zero jargão de OKR na UI principal).
  //   1. O sonho     — aonde o produto chega em 12 meses
  //   2. As batalhas — 3 a 5 frentes pra realizar o sonho (eram "Objectives")
  //   3. Os números  — como saber que venceu cada batalha (eram "Key Results")
  //   4. As ações    — o que a operação faz pra mover cada número
  //   5. Colocar em campo — disparar tarefas no provider
  // Vocabulário Doerr (OKR/KR/Stretch/Committed) só em tooltips opcionais.
  LEVELS: [
    { id: 'vision',     label: 'O sonho',           short: 'O sonho',     icon: 'star',     description: 'Aonde esse produto chega em 12 meses.' },
    { id: 'objectives', label: 'As batalhas',        short: 'Batalhas',    icon: 'flag',      description: 'As 3 a 5 frentes que vão te levar lá.' },
    { id: 'okrs',       label: 'Os números',         short: 'Números',     icon: 'target',    description: 'Como você vai saber que venceu cada batalha.' },
    { id: 'operations', label: 'As ações',           short: 'Ações',       icon: 'plug',      description: 'O que sua operação faz pra mover esses números.' },
    { id: 'execution',  label: 'Colocar em campo',   short: 'Campo',       icon: 'send',      description: 'Disparar tudo no seu provider de execução.' }
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
