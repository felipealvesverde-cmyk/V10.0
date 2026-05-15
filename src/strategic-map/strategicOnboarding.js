// V17 — Strategic Onboarding
// Controla o onboarding educacional do Mapa da Receita (explicação de OKR,
// importância operacional e jornada inicial). Por produto, registramos se o
// usuário já viu para não repetir.
window.StrategicOnboarding = {
  STEPS: [
    {
      id: 'what',
      title: 'O que é um OKR?',
      body: 'OKRs ajudam a transformar objetivos estratégicos em operações mensuráveis. No LeadJourney, eles conectam estratégia, fluxo operacional, ações, execução e receita.'
    },
    {
      id: 'why',
      title: 'Por que diferente aqui?',
      body: 'Diferente de sistemas tradicionais, no LeadJourney o OKR não termina em metas. Ele desce até campanhas, fluxos, ações, KPIs, execução e receita.'
    },
    {
      id: 'how',
      title: 'Como usar?',
      body: 'Comece definindo a Visão do produto. Crie Objetivos Estratégicos. Dentro de cada Objetivo, crie OKRs. Conecte cada OKR às ações operacionais. O Djow ajuda em cada passo.'
    }
  ],

  flowDiagram() {
    return ['Visão', 'Objetivo', 'OKR', 'Fluxo', 'Ação', 'Execução', 'Receita'];
  },

  hasSeen(productId) {
    return Boolean((App.state.strategicMapOnboardingSeen || {})[productId]);
  },

  markSeen(productId) {
    const seen = App.state.strategicMapOnboardingSeen || {};
    App.state.strategicMapOnboardingSeen = { ...seen, [productId]: new Date().toISOString() };
  },

  reset(productId) {
    const seen = { ...(App.state.strategicMapOnboardingSeen || {}) };
    delete seen[productId];
    App.state.strategicMapOnboardingSeen = seen;
  }
};
