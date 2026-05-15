
// LeadJourney V13.0.1 — RevOps AI Engine Stability Pass
window.RevOpsAIEngine = {
  n(value) {
    const n = Number(String(value ?? 0).replace("%", "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  },

  findKpi(kpis = [], matcher) {
    return kpis.find(kpi => matcher(String(kpi.name || "").toLowerCase()));
  },

  okrProgress(okr = {}) {
    const projected = this.n(okr.projected ?? okr.target ?? okr.goal ?? 0);
    const current = this.n(okr.current ?? okr.actual ?? 0);
    const gap = projected ? ((current - projected) / projected) * 100 : 0;
    return { projected, current, gap };
  },

  analyzeAction(action = {}) {
    const kpis = Array.isArray(action.kpis) ? action.kpis : [];
    const okrs = Array.isArray(action.okrs) ? action.okrs : [];
    const findings = [];

    let opens, clicks, ctr, ctor, bounces, unsub, conversions;
    for (const kpi of kpis) {
      const name = String(kpi.name || "").toLowerCase();
      if (!opens && name.includes("abertura")) opens = kpi;
      else if (!clicks && name.includes("clique")) clicks = kpi;
      else if (!ctr && name === "ctr") ctr = kpi;
      else if (!ctor && name === "ctor") ctor = kpi;
      else if (!bounces && name.includes("bounce")) bounces = kpi;
      else if (!unsub && name.includes("descadastro")) unsub = kpi;
      else if (!conversions && name.includes("convers")) conversions = kpi;
    }

    if (opens && this.n(opens.current) > 0 && this.n(opens.current) < 20) {
      findings.push({
        type: "attention",
        title: "Baixa abertura",
        insight: "A abertura está baixa para uma ação de e-mail. O gargalo pode estar em assunto, entregabilidade ou segmentação.",
        recommendation: "Testar assunto, preview text, segmentação e reputação de envio."
      });
    }

    if (ctr && this.n(ctr.current) > 0 && this.n(ctr.current) < 2) {
      findings.push({
        type: "risk",
        title: "CTR abaixo do esperado",
        insight: "Há sinal de interesse insuficiente no CTA mesmo após o envio.",
        recommendation: "Revisar CTA, promessa, hierarquia visual e aderência da oferta."
      });
    }

    if (ctor && this.n(ctor.current) > 0 && this.n(ctor.current) < 8) {
      findings.push({
        type: "risk",
        title: "CTOR baixo",
        insight: "As pessoas que abriram não estão clicando em proporção suficiente.",
        recommendation: "Revisar corpo do e-mail, clareza do próximo passo e força do benefício."
      });
    }

    if (bounces && this.n(bounces.current) > 0) {
      findings.push({
        type: "attention",
        title: "Bounces detectados",
        insight: "A base pode ter problemas de qualidade ou entregabilidade.",
        recommendation: "Higienizar lista, revisar origem dos contatos e remover e-mails inválidos."
      });
    }

    if (unsub && this.n(unsub.current) > 0) {
      findings.push({
        type: "attention",
        title: "Descadastros detectados",
        insight: "Há possível desalinhamento entre mensagem, frequência e expectativa do lead.",
        recommendation: "Revisar segmentação, frequência e promessa do conteúdo."
      });
    }

    if (clicks && conversions && this.n(clicks.current) > 0) {
      const postClick = (this.n(conversions.current) / Math.max(this.n(clicks.current), 1)) * 100;
      if (postClick < 5) {
        findings.push({
          type: "critical",
          title: "Conversão pós-clique baixa",
          insight: "O gargalo parece estar depois do clique, não necessariamente no e-mail.",
          recommendation: "Auditar landing page, formulário, checkout ou handoff para a próxima etapa."
        });
      }
    }

    okrs.forEach(okr => {
      const { projected, current, gap } = this.okrProgress(okr);
      if (projected > 0 && current < projected * 0.7) {
        findings.push({
          type: "okr_gap",
          title: `OKR abaixo da projeção: ${okr.name || "sem nome"}`,
          insight: `Atual: ${current} / Projetado: ${projected} (${Math.round(gap * 10) / 10}%).`,
          recommendation: "Cruzar KPIs desta ação com etapa do funil para achar a causa do gap."
        });
      }
    });

    if (!findings.length) {
      findings.push({
        type: "healthy",
        title: "Sem gargalo crítico detectado",
        insight: "Os KPIs e OKRs disponíveis não indicam risco operacional relevante neste momento.",
        recommendation: "Manter acompanhamento e atualizar os dados após novos ciclos de sync."
      });
    }

    const penalty = findings.filter(f => f.type !== "healthy").length * 18;
    const score = Math.max(20, Math.min(100, 100 - penalty));

    return {
      score,
      health: score >= 85 ? "Saudável" : score >= 60 ? "Atenção" : score >= 40 ? "Risco" : "Crítico",
      findings
    };
  },

  analyzeAll() {
    return (App?.state?.actions || []).map(action => ({
      actionId: action.id,
      actionName: action.name,
      analysis: this.analyzeAction(action)
    }));
  }
};
