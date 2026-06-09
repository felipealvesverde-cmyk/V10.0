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
  // V32.5.2 (Leonardo) — Trilha que esquenta. Cada step ganha cor térmica
  // própria (`thermal`) progressivamente mais quente conforme se aproxima da
  // Receita (etapa 6, gold). Etapa 1 é violeta frio (estratégia distante),
  // etapa 6 é dourado (receita = paleta semântica #F6DB5C, Tailwind ~yellow).
  // word: 1-2 palavras pra microcopy "Pendente · [word]" nos botões da tabbar.
  // titleQ: versão como pergunta/convite pro título do _stepIntro (uniformiza
  // ritmo conversacional do mapa — antes era mix de pergunta/afirmação/comando).
  LEVELS: [
    // V32.5.4 (Leonardo) — Etapa 1 vira 'slate' (cinza-azulado, frio puro)
    // pra diferenciar do violet+purple+fuchsia da V32.5.2. Antes as 3
    // primeiras viviam no mesmo eixo magenta — trilha "esquentava" mesmo só
    // a partir da etapa 4. Agora começa estrategicamente frio, esquenta
    // progressivamente sem ambiguidade.
    { id: 'vision',     label: 'Objetivo do Produto', short: 'Objetivo',  icon: 'star',       description: 'Aonde esse produto chega nos próximos 12 meses.', thermal: 'slate',   word: 'visão',     titleQ: 'Qual é o objetivo do seu produto?' },
    { id: 'objectives', label: 'Comercial',           short: 'Comercial', icon: 'flag',       description: 'As 3 frentes do funil: Marketing, Vendas e CS.',           thermal: 'violet',  word: 'donos',     titleQ: 'Quem responde por cada frente comercial?' },
    { id: 'okrs',       label: 'Os números',          short: 'Números',   icon: 'target',     description: 'Como saber que cada frente está performando.',             thermal: 'fuchsia', word: 'metas',     titleQ: 'Quais são os números deste produto?' },
    { id: 'campaign',   label: 'Selecionar Campanha', short: 'Campanha',  icon: 'git-branch', description: 'Escolha em qual campanha vai trabalhar agora.',            thermal: 'pink',    word: 'escolha',   titleQ: 'Em qual campanha você quer trabalhar?' },
    { id: 'operations', label: 'As ações',            short: 'Ações',     icon: 'plug',       description: 'O que a operação faz pra mover esses números.',            thermal: 'orange',  word: 'trabalho',  titleQ: 'Como você vai cobrir esses números?' },
    { id: 'execution',  label: 'Acompanhamento',      short: 'Acompanhamento', icon: 'activity', description: 'Como cada número e cada ação está performando no provider operacional.', thermal: 'amber', word: 'pós-execução', titleQ: 'Acompanhamento em campo' }
  ],

  // V36.9.0 — Receita = etapa 'operations' (5ª). 'execution' é pós-receita
  // (acompanhamento), não passo até receita.
  // Retorno: number = passos faltam; 0 = chegou; -1 = já passou (pós-receita); null = inválido.
  stepsUntilRevenue(stepId) {
    const idx = this.LEVELS.findIndex(l => l.id === stepId);
    if (idx < 0) return null;
    const revenueIdx = this.LEVELS.findIndex(l => l.id === 'operations');
    if (revenueIdx < 0) return null;
    if (idx > revenueIdx) return -1;
    return revenueIdx - idx;
  },

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
