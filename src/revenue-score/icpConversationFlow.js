// V18 — ICP Conversation Flow
// Catalogo das perguntas guiadas por segmento (B2B/B2C/Ambos). Cada pergunta
// declara opções clicáveis, se aceita texto livre e se é múltipla escolha.
// O state apenas guarda as respostas; este módulo dita a ordem.
window.IcpConversationFlow = {
  // Sinais "explícitos" pesam 2x no Engagement vs sinais implícitos.
  EXPLICIT_SIGNALS: new Set([
    'pedir orçamento',
    'visitar checkout',
    'responder sdr',
    'assistir aula inteira',
    'clicar cta',
    'responder direct'
  ]),

  isExplicit(signal) {
    return this.EXPLICIT_SIGNALS.has(String(signal || '').toLowerCase().trim());
  },

  // Custom signals salvos pelo usuário no creator. Bucket = por questão
  // (positivos B2B, positivos B2C, negativos segment-agnostic).
  // Persistidos em state.customScoreSignals.
  _bucketFor(questionId) {
    if (questionId === 'qualificationSignals') return 'B2B';
    if (questionId === 'interestSignals')      return 'B2C';
    if (questionId === 'negativeSignals')      return 'negative';
    if (questionId === 'relevantTriggers')     return 'triggers';
    return null;
  },

  customOptionsFor(questionId, segment) {
    const all = App.state.customScoreSignals || { B2B: [], B2C: [], negative: [] };
    const bucket = this._bucketFor(questionId);
    if (!bucket) return [];
    return all[bucket] || [];
  },

  addCustomSignalForQuestion(questionId, signal) {
    const bucket = this._bucketFor(questionId);
    if (!bucket) return false;
    const all = App.state.customScoreSignals || { B2B: [], B2C: [], negative: [] };
    const list = Array.isArray(all[bucket]) ? all[bucket] : [];
    const normalized = String(signal || '').trim();
    if (!normalized || list.includes(normalized)) return false;
    App.state.customScoreSignals = { ...all, [bucket]: [...list, normalized] };
    return true;
  },

  // Retrocompat: callers antigos que passavam segmento direto.
  addCustomSignal(segment, signal) {
    const qid = segment === 'B2C' ? 'interestSignals' : 'qualificationSignals';
    return this.addCustomSignalForQuestion(qid, signal);
  },

  Q_SEGMENT: {
    id: 'segment',
    label: 'Esta campanha é:',
    type: 'single',
    options: ['B2B', 'B2C', 'Ambos']
  },

  Q_NEGATIVE: {
    id: 'negativeSignals',
    label: 'E o que mostra que NÃO é o seu público? (opcional)',
    type: 'multi',
    optional: true,
    options: [
      'Empresa muito pequena/grande',
      'Cargo fora do esperado',
      'Mencionar concorrente',
      'Pediu reembolso antes',
      'Email inválido / bounce',
      'Cancela rápido',
      'Fora da região',
      'Não-pagante histórico'
    ]
  },

  // Tabelas ordenadas usadas pelo FitEngine para calcular adjacência.
  // Vizinho imediato (índice ±1) → 50% do peso. Distante (≥2) → 0.
  ORDERED_AGE_RANGES: ['18-24', '25-34', '35-44', '45-54', '55+'],
  ORDERED_COMPANY_SIZES: ['Pequena', 'Média', 'Grande'],
  ORDERED_REVENUE_BANDS: ['Até R$1M', 'R$1M-10M', 'R$10M-50M', 'R$50M-300M', 'R$300M+'],
  ORDERED_INCOME_BANDS:  ['Até R$3k', 'R$3-7k', 'R$7-15k', 'R$15-30k', 'R$30k+'],
  AWARENESS_LEVELS:      ['cold', 'aware', 'evaluation', 'decision'],

  // V20 — perguntas de persona expandida (opcionais, marcadas com optional:true)
  Q_INDUSTRY: {
    id: 'industry',
    label: 'Em quais indústrias/verticais esse público atua? (opcional)',
    type: 'multi-text',
    optional: true,
    suggestions: ['SaaS', 'Varejo', 'E-commerce', 'Educação', 'Saúde', 'Financeiro', 'Indústria', 'Serviços', 'Agro', 'Construção']
  },
  Q_REVENUE: {
    id: 'companyRevenue',
    label: 'Qual a faixa de faturamento dessas empresas? (opcional)',
    type: 'multi',
    optional: true,
    options: ['Até R$1M', 'R$1M-10M', 'R$10M-50M', 'R$50M-300M', 'R$300M+']
  },
  Q_INCOME: {
    id: 'income',
    label: 'Qual a faixa de renda desse público? (opcional)',
    type: 'multi',
    optional: true,
    options: ['Até R$3k', 'R$3-7k', 'R$7-15k', 'R$15-30k', 'R$30k+']
  },
  Q_JOB_TITLE: {
    id: 'jobTitle',
    label: 'Quais cargos específicos esse público costuma ter? (opcional)',
    type: 'multi-text',
    optional: true,
    suggestions: ['CEO', 'CMO', 'CTO', 'Diretor Comercial', 'Gerente de Marketing', 'Coordenador de RH', 'Analista', 'Empreendedor']
  },
  Q_GEOGRAPHY: {
    id: 'geography',
    label: 'Onde geograficamente esse público está? (opcional)',
    type: 'multi-text',
    optional: true,
    suggestions: ['SP', 'RJ', 'MG', 'Sul', 'Nordeste', 'Centro-Oeste', 'Norte', 'Brasil inteiro', 'América Latina']
  },
  Q_AWARENESS: {
    id: 'awarenessLevel',
    label: 'Em geral, leads dessa campanha chegam em qual estágio? (opcional)',
    type: 'single',
    optional: true,
    options: ['cold', 'aware', 'evaluation', 'decision']
  },
  Q_DECISION_CYCLE: {
    id: 'avgDecisionDays',
    label: 'Quantos dias o lead típico leva da entrada à compra? (opcional)',
    type: 'number',
    optional: true,
    placeholder: 'Ex: 30',
    min: 1,
    max: 365
  },
  Q_TRIGGER_EVENTS: {
    id: 'relevantTriggers',
    label: 'Que eventos-gatilho indicam alta intenção de compra? (opcional)',
    type: 'multi',
    optional: true,
    options: []
  },

  B2B_QUESTIONS: [
    {
      id: 'decisionMaker',
      label: 'Quem normalmente toma a decisão?',
      type: 'single',
      options: ['Dono', 'CEO', 'Comercial', 'Marketing', 'Operacional', 'Outro']
    },
    {
      id: 'companySize',
      label: 'Qual o tamanho médio dessas empresas? (pode marcar mais de uma)',
      type: 'multi',
      options: ['Pequena', 'Média', 'Grande']
    },
    {
      id: 'painPoint',
      label: 'Quais problemas principais desse público? (pode marcar mais de um)',
      type: 'multi-text',
      suggestions: ['Falta de vendas', 'Baixa margem', 'Gestão ruim', 'Poucos leads', 'Retenção baixa', 'Crescimento lento']
    },
    {
      id: 'qualificationSignals',
      label: 'O que faria esse lead parecer MUITO qualificado?',
      type: 'multi',
      options: ['Pedir orçamento', 'Visitar checkout', 'Responder SDR', 'Abrir email', 'Assistir aula inteira', 'Voltar ao site', 'Clicar CTA']
    }
  ],

  B2C_QUESTIONS: [
    {
      id: 'ageRange',
      label: 'Qual faixa etária principal? (pode marcar mais de uma — adjacentes ganham peso parcial)',
      type: 'multi',
      options: ['18-24', '25-34', '35-44', '45-54', '55+']
    },
    {
      id: 'interest',
      label: 'Quais interesses ou desejos principais desse público? (pode marcar mais de um)',
      type: 'multi-text',
      suggestions: ['Renda extra', 'Saúde e bem-estar', 'Aparência', 'Aprendizado', 'Hobby', 'Status', 'Família']
    },
    {
      id: 'interestSignals',
      label: 'O que demonstra forte interesse?',
      type: 'multi',
      options: ['Visitar checkout', 'Scroll completo na LP', 'Abrir email', 'Responder direct', 'Clicar CTA', 'Voltar ao site']
    }
  ],

  AMBOS_EXTRA: [
    {
      id: 'ageRange',
      label: 'E qual faixa etária predominante (no lado consumidor final)? (pode marcar mais de uma)',
      type: 'multi',
      options: ['18-24', '25-34', '35-44', '45-54', '55+', 'Não se aplica']
    }
  ],

  // V20 — Sequência completa: base + persona expandida + awareness + triggers + negativo.
  // Perguntas opcionais (industry/revenue/income/jobTitle/geography/awareness/cycle/triggers)
  // podem ser puladas via "Pular →".
  sequenceFor(segment) {
    let base;
    if (segment === 'B2B') base = this.B2B_QUESTIONS;
    else if (segment === 'B2C') base = this.B2C_QUESTIONS;
    else if (segment === 'Ambos') base = [...this.B2B_QUESTIONS, ...this.AMBOS_EXTRA];
    else base = this.B2B_QUESTIONS;
    // Persona expandida — branches conforme segmento
    const persona = [];
    if (segment === 'B2B' || segment === 'Ambos') {
      persona.push(this.Q_INDUSTRY, this.Q_REVENUE, this.Q_JOB_TITLE, this.Q_GEOGRAPHY);
    }
    if (segment === 'B2C' || segment === 'Ambos') {
      persona.push(this.Q_INCOME);
      if (segment === 'B2C') persona.push(this.Q_GEOGRAPHY); // só add geography uma vez
    }
    // Awareness + ciclo + triggers (todos opcionais)
    const triggerQuestion = { ...this.Q_TRIGGER_EVENTS, options: this._triggerOptionsFor(segment) };
    const meta = [this.Q_AWARENESS, this.Q_DECISION_CYCLE, triggerQuestion];
    return [...base, ...persona, ...meta, this.Q_NEGATIVE];
  },

  _triggerOptionsFor(segment) {
    const all = window.TriggerEventEngine ? TriggerEventEngine.CATALOG : { B2B: [], B2C: [] };
    if (segment === 'B2C') return (all.B2C || []).map(t => t.label);
    if (segment === 'Ambos') return [...(all.B2B || []), ...(all.B2C || [])].map(t => t.label);
    return (all.B2B || []).map(t => t.label);
  },

  totalSteps(segment) {
    return 1 + this.sequenceFor(segment).length;
  },

  questionAt(segment, stepIndex) {
    if (stepIndex === 0) return this.Q_SEGMENT;
    return this.sequenceFor(segment)[stepIndex - 1] || null;
  }
};
