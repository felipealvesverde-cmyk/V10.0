// V18 — ICP Intelligence Agent
// "Cérebro" estratégico que interpreta as respostas do usuário e produz
// narrativa consultiva. Não expõe pesos nem fórmulas. Usa heurística local —
// pode plugar no Djow/Railway no futuro reaproveitando RailwayAgentClient.
window.IcpIntelligenceAgent = {
  contextualTip(stepId, answers) {
    const tipMap = {
      segment: 'B2B mira empresas; B2C mira pessoas; Ambos significa que sua oferta atende dos dois lados.',
      decisionMaker: 'O decisor define o tom da comunicação. Dono pede ROI; CEO quer estratégia; Comercial quer pipeline.',
      companySize: 'Tamanho da empresa muda o ciclo de venda e a complexidade da decisão.',
      painPoint: 'Quanto mais específica a dor, mais forte a qualificação. Evite "querer crescer" sem contexto.',
      qualificationSignals: 'Sinais reais de qualificação. Marque os que indicam intenção concreta no seu caso.',
      ageRange: 'Faixa etária guia tom, canal e timing das mensagens.',
      interest: 'Foque no desejo emocional — não no produto. "Mais energia", não "comprar suplemento".',
      interestSignals: 'Marque comportamentos que historicamente convertem no seu funil.'
    };
    return tipMap[stepId] || 'Selecione o que melhor representa seu público ideal.';
  },

  interpret(answers) {
    const segment = answers.segment || 'B2B';
    const signals = (segment === 'B2C' ? answers.interestSignals : answers.qualificationSignals) || [];
    const intentScore = Math.min(100, signals.length * 18);
    const fitFactors = [];
    if (answers.decisionMaker) fitFactors.push(`Decisor: ${answers.decisionMaker}`);
    if (answers.companySize) fitFactors.push(`Empresa: ${this._joinValue(answers.companySize)}`);
    if (answers.ageRange) fitFactors.push(`Idade: ${this._joinValue(answers.ageRange)}`);
    if (answers.interest) fitFactors.push(`Interesse: ${answers.interest}`);
    if (answers.painPoint) fitFactors.push(`Dor: ${answers.painPoint}`);
    return {
      segment,
      signals,
      intentScore,
      fitFactors,
      narrative: this._buildNarrative(segment, answers, signals)
    };
  },

  _joinValue(v) {
    return Array.isArray(v) ? v.join(' / ') : String(v);
  },

  _buildNarrative(segment, a, signals) {
    if (segment === 'B2C') {
      const parts = [];
      if (a.ageRange) parts.push(`público de ${this._joinValue(a.ageRange)}`);
      if (a.interest) parts.push(`movido por ${String(a.interest).toLowerCase()}`);
      const sigText = signals.length ? ` Demonstra interesse com: ${signals.slice(0, 3).join(', ').toLowerCase()}.` : '';
      return `Perfil ideal: ${parts.join(', ') || 'consumidor final'}.${sigText}`;
    }
    const parts = [];
    if (a.decisionMaker) parts.push(`${a.decisionMaker}`);
    if (a.companySize) parts.push(`em empresa ${String(this._joinValue(a.companySize)).toLowerCase()}`);
    if (a.painPoint) parts.push(`com dor de ${String(a.painPoint).toLowerCase()}`);
    if (a.ageRange) parts.push(`faixa ${this._joinValue(a.ageRange)}`);
    const sigText = signals.length ? ` Sinais de qualificação fortes: ${signals.slice(0, 3).join(', ').toLowerCase()}.` : '';
    return `Perfil ideal: ${parts.join(', ') || 'tomador de decisão B2B'}.${sigText}`;
  }
};
