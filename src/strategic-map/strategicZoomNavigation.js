// V17.1 — Strategic Journey Navigation
// As 5 etapas sequenciais do Mapa da Receita. Cada etapa tem critério de
// conclusão (avaliado pelo StrategicMapEngine.journeyProgress) e o usuário
// avança pela jornada via CTAs "Próximo passo →" ou clicando direto na etapa.
window.StrategicZoomNavigation = {
  LEVELS: [
    { id: 'vision',     label: 'Visão',              short: 'Visão',     icon: 'eye',       description: 'Defina onde o produto quer chegar.' },
    { id: 'objectives', label: 'Objetivos',          short: 'Objetivos', icon: 'flag',      description: 'Quebre a visão em objetivos estratégicos.' },
    { id: 'okrs',       label: 'OKRs',               short: 'OKRs',      icon: 'target',    description: 'Defina resultados-chave mensuráveis.' },
    { id: 'operations', label: 'Conectar Operação',  short: 'Operação',  icon: 'plug',      description: 'Plugue cada OKR às ações que entregam o resultado.' },
    { id: 'execution',  label: 'Executar via Djow',  short: 'Executar',  icon: 'send',      description: 'Dispare tarefas no ClickUp e providers via Djow.' }
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
