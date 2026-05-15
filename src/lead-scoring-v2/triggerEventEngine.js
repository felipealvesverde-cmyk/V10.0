// V20 — Trigger Event Engine
// Eventos-gatilho que ativam intenção de compra. Cada kind tem half-life
// próprio (cargo dura mais, redução de receita também; eventos de vida B2C
// têm curva longa também). Catalog é fonte da verdade para UI e scoring.
window.TriggerEventEngine = {
  CATALOG: {
    B2B: [
      { id: 'funding-round',     label: 'Nova rodada de funding',            halfLifeDays: 365, weight: 25 },
      { id: 'leadership-hire',   label: 'Contratação de C-level/Diretor',    halfLifeDays: 270, weight: 22 },
      { id: 'revenue-change',    label: 'Mudança grande de receita',         halfLifeDays: 180, weight: 20 },
      { id: 'expansion',         label: 'Expansão (novo mercado/país)',       halfLifeDays: 365, weight: 18 },
      { id: 'tech-change',       label: 'Troca de tecnologia/sistema',       halfLifeDays: 180, weight: 18 },
      { id: 'compliance-change', label: 'Mudança regulatória (LGPD, fiscal)', halfLifeDays: 365, weight: 15 },
      { id: 'layoff',            label: 'Demissão em massa',                 halfLifeDays: 90,  weight: 15 },
      { id: 'merger-acquisition', label: 'Fusão ou aquisição',                halfLifeDays: 365, weight: 20 }
    ],
    B2C: [
      { id: 'job-change',        label: 'Mudou de emprego',          halfLifeDays: 365, weight: 22 },
      { id: 'wedding',           label: 'Casamento',                  halfLifeDays: 540, weight: 22 },
      { id: 'baby',              label: 'Filho nasceu',               halfLifeDays: 540, weight: 25 },
      { id: 'move',              label: 'Mudou de cidade/casa',       halfLifeDays: 365, weight: 18 },
      { id: 'graduation',        label: 'Concluiu curso/faculdade',   halfLifeDays: 365, weight: 18 },
      { id: 'divorce',           label: 'Divórcio',                   halfLifeDays: 365, weight: 18 },
      { id: 'retirement',        label: 'Aposentadoria',              halfLifeDays: 720, weight: 22 },
      { id: 'health-event',      label: 'Diagnóstico de saúde',       halfLifeDays: 540, weight: 20 }
    ]
  },

  flatCatalog() {
    return [...this.CATALOG.B2B, ...this.CATALOG.B2C];
  },

  metaFor(idOrLabel) {
    if (!idOrLabel) return null;
    const target = String(idOrLabel).toLowerCase();
    for (const t of this.flatCatalog()) {
      if (t.id === target || String(t.label).toLowerCase() === target) return t;
    }
    // V20.1 — fallback custom: triggers cadastrados pelo usuário (state
    // customScoreSignals.triggers) recebem default sensato. Peso 20 fica entre
    // os mais baixos do catálogo (não desbalanceia); half-life 180d cobre
    // bem eventos pessoais e empresariais médios.
    const customs = (App.state.customScoreSignals?.triggers) || [];
    for (const label of customs) {
      if (String(label).toLowerCase() === target) {
        return { id: `custom_${label}`, label, halfLifeDays: 180, weight: 20, custom: true };
      }
    }
    return null;
  },

  // Score adicional de intent a partir dos triggerEvents do lead. Apenas os
  // triggers MARCADOS como relevantes no blueprint contam. Cada evento usa
  // seu half-life próprio.
  scoreFor(blueprint, lead) {
    const relevant = blueprint?._internal?.triggerWeights || {};
    const events = Array.isArray(lead?.triggerEvents) ? lead.triggerEvents : [];
    if (!events.length || !Object.keys(relevant).length) return { score: 0, detected: 0, possible: Object.keys(relevant).length, contributions: [] };
    const now = Date.now();
    let score = 0, detected = 0;
    const contributions = [];
    for (const ev of events) {
      const meta = this.metaFor(ev.kind || ev.label || ev.event);
      if (!meta) continue;
      const weight = relevant[meta.id] ?? relevant[meta.label] ?? null;
      if (weight === null) continue;
      const ts = ev.ts ? new Date(ev.ts).getTime() : now;
      const days = Math.max(0, (now - ts) / (24 * 3600 * 1000));
      const factor = Math.exp(-days / Math.max(1, meta.halfLifeDays));
      const pts = Number(weight) * factor;
      score += pts;
      detected += 1;
      contributions.push({ event: meta.label, points: Math.round(pts), daysAgo: Math.round(days) });
    }
    return {
      score: Math.max(0, Math.min(100, Math.round(score))),
      detected,
      possible: Object.keys(relevant).length,
      contributions
    };
  }
};
