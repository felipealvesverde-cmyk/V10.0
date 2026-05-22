// V17.1 — Strategic Journey Navigation
// As 5 etapas sequenciais do Mapa da Receita. Cada etapa tem critério de
// conclusão (avaliado pelo StrategicMapEngine.journeyProgress) e o usuário
// avança pela jornada via CTAs "Próximo passo →" ou clicando direto na etapa.
window.StrategicZoomNavigation = {
  // V28.1.0 — Vocabulário RevOps conectado ao produto.
  //   1. Objetivo do Produto — aonde esse produto chega em 12 meses
  //   2. Comercial           — as 3 frentes do funil (Marketing, Vendas, CS)
  //   3. Os números          — como saber que cada frente está performando
  //   4. As ações            — o que a operação faz pra mover esses números
  //   5. Colocar em campo    — disparar tarefas no provider operacional
  // V29.1.0 — 6 etapas. Etapa 4 'campaign' é onde o gestor pluga os KRs-mãe
  // do produto na campanha (cria filhos com metas próprias).
  // CEO escreve 1-3 (vision/objectives/okrs); Gestor escreve 4-6 (campaign/operations/execution).
  LEVELS: [
    { id: 'vision',     label: 'Objetivo do Produto', short: 'Objetivo',   icon: 'star',       description: 'Aonde esse produto chega nos próximos 12 meses.' },
    { id: 'objectives', label: 'Comercial',           short: 'Comercial',  icon: 'flag',       description: 'As 3 frentes do funil: Marketing, Vendas e Sucesso do Cliente.' },
    { id: 'okrs',       label: 'Os números',          short: 'Números',    icon: 'target',     description: 'Como você vai saber que cada frente está performando.' },
    { id: 'campaign',   label: 'Selecionar Campanha', short: 'Campanha',   icon: 'git-branch', description: 'Escolha em qual campanha vai trabalhar agora.' },
    { id: 'operations', label: 'As ações',            short: 'Ações',      icon: 'plug',       description: 'O que sua operação faz pra mover esses números.' },
    { id: 'execution',  label: 'Colocar em campo',    short: 'Campo',      icon: 'send',       description: 'Disparar tudo no seu provider de execução.' }
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
