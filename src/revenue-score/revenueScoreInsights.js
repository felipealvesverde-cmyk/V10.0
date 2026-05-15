// V18 — Revenue Score Insights
// Gera bullets de insight a partir da classificação. Sem expor pesos —
// linguagem humana e acionável. Plugado no RevOps AI futuro pela mesma API.
window.RevenueScoreInsights = {
  generate(campaignId) {
    const result = RevenueLeadClassification.classifyCampaign(campaignId);
    if (!result.ok) return { ok: false, insights: [], message: result.message };
    const s = result.summary;
    const insights = [];
    if (s.total === 0) {
      insights.push({ priority: 90, tone: 'neutral', action: 'Conectar', text: 'Nenhum lead nesta campanha ainda. Conecte ações ao Revenue Score para começar a leitura.' });
    } else {
      if (s.revenueReady > 0)               insights.push({ priority: 100, tone: 'positive', action: 'Acionar agora', text: `${s.revenueReady} lead(s) Revenue Ready — disparar contato comercial imediato.` });
      if (s.tier.hot >= 3)                  insights.push({ priority: 90,  tone: 'positive', action: 'Priorizar', text: `${s.tier.hot} leads quentes aderentes ao ICP — priorize abordagem comercial nesta semana.` });
      if (s.tier.cold > s.tier.hot * 3 && s.total >= 5) insights.push({ priority: 80, tone: 'warning', action: 'Revisar segmentação', text: 'Muitos leads frios em relação aos quentes — segmentação da captação pode estar fora do ICP.' });
      if (s.avgEngagement < 25 && s.total >= 3) insights.push({ priority: 70, tone: 'warning', action: 'Ativar gatilhos', text: 'Engajamento médio baixo. Reforce CTAs e jornadas que gerem sinais (email, checkout, scroll).' });
      if (s.avgFit > 70 && s.avgEngagement < 40) insights.push({ priority: 65, tone: 'neutral', action: 'Adicionar urgência', text: 'Fit alto mas engajamento baixo — a oferta combina, falta gatilho para agir.' });
      if (s.avgFit < 40 && s.total >= 5)    insights.push({ priority: 75, tone: 'warning', action: 'Rever ICP', text: 'Fit médio baixo. Revisite o ICP ou ajuste segmentação da captação.' });
      if (s.partialCount > s.total / 2)     insights.push({ priority: 60, tone: 'neutral', action: 'Enriquecer dados', text: `${s.partialCount} de ${s.total} leads com leitura parcial — adicione tags/atributos para melhorar a classificação.` });
      if (s.avgConfidence < 30 && s.total >= 3) insights.push({ priority: 55, tone: 'warning', action: 'Calibrar', text: `Confiança média da leitura em ${s.avgConfidence}%. O blueprint está captando poucos sinais reais nos leads.` });
    }
    insights.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    return { ok: true, summary: s, insights, topActions: insights.filter(i => i.action).slice(0, 3) };
  }
};
