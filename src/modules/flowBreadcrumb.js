// V38.1.65 — FlowBreadcrumb chevron 3D industrial (Leonardo, ato III)
//
// 5 estações em chevron horizontal — cada uma é um retângulo com ponta
// triangular à direita e entrada chevron à esquerda. Encaixadas com
// margin negativo. Cada chevron tem gradiente vertical 3D (highlight no
// topo, base mais escura, reflexo inferior) — visual de dashboard
// industrial / SCADA / Process Flow.
//
// Estações inativas: cinza-prateado (gradiente neutro com brilho cromado).
// Estação atual: cor temática cheia 3D na mesma estética cromada.
//
// Cromática narrativa (5 estágios):
//   1. Produtos    — violet   (estratégia)
//   2. Campanhas   — sky      (orquestração)
//   3. Ações       — amber    (operação)
//   4. Execuções   — emerald  (gesto / vida)
//   5. Resultados  — rose     (consequência / leitura final)

window.FlowBreadcrumb = {
  STAGES: [
    { id: 'products',   label: 'Produtos',   color: { light: '#c4b5fd', mid: '#8b5cf6', dark: '#6d28d9' } }, // violet-300/500/700
    { id: 'campaigns',  label: 'Campanhas',  color: { light: '#7dd3fc', mid: '#0ea5e9', dark: '#0369a1' } }, // sky-300/500/700
    { id: 'actions',    label: 'Ações',      color: { light: '#fcd34d', mid: '#f59e0b', dark: '#b45309' } }, // amber-300/500/700
    { id: 'executions', label: 'Execuções',  color: { light: '#6ee7b7', mid: '#10b981', dark: '#047857' } }, // emerald-300/500/700
    { id: 'results',    label: 'Resultados', color: { light: '#fda4af', mid: '#f43f5e', dark: '#be123c' } }  // rose-300/500/700
  ],

  GREY: { light: '#e5e7eb', mid: '#9ca3af', dark: '#4b5563' }, // gray-200/400/600

  render(activeStage) {
    const stages = this.STAGES;
    const activeIndex = stages.findIndex(s => s.id === activeStage);
    const items = stages.map((stage, i) => this._chevron(stage, i === activeIndex, i === 0, i));
    return `<nav aria-label="Fluxo do Revenue OS" class="flex items-stretch flex-wrap py-2 overflow-x-auto">
      ${items.join('')}
    </nav>`;
  },

  _chevron(stage, isActive, isFirst, index) {
    const c = isActive ? stage.color : this.GREY;
    const textColor = isActive ? '#ffffff' : '#1f2937'; // gray-800
    const textShadow = isActive
      ? '0 1px 2px rgba(0,0,0,0.35)'
      : '0 1px 0 rgba(255,255,255,0.7)';

    // clip-path: chevron com entrada triangular à esquerda (exceto 1ª) e
    // ponta triangular à direita. Profundidade da ponta = 18px.
    const ARROW = 18;
    const clipPath = isFirst
      ? `polygon(0% 0%, calc(100% - ${ARROW}px) 0%, 100% 50%, calc(100% - ${ARROW}px) 100%, 0% 100%)`
      : `polygon(0% 0%, calc(100% - ${ARROW}px) 0%, 100% 50%, calc(100% - ${ARROW}px) 100%, 0% 100%, ${ARROW}px 50%)`;

    // Gradiente vertical 3D — highlight no topo, base mais escura,
    // reflexo sutil na base (efeito vidro/metal polido).
    const bg = `linear-gradient(180deg,
      ${c.light} 0%,
      ${c.mid} 40%,
      ${c.dark} 78%,
      ${c.mid} 100%)`;

    const onclick = !isActive ? `onclick="App.setTab('${stage.id}')"` : 'aria-current="page"';
    const cursor = isActive ? 'default' : 'pointer';

    // Encaixe: cada chevron (exceto o 1º) avança -12px sobre o anterior,
    // pra ponta direita do anterior ficar dentro do "buraco" do próximo.
    const marginLeft = isFirst ? '0' : '-12px';

    // Padding: extra à direita pra texto não invadir a ponta; extra à
    // esquerda (exceto 1º) pra texto não invadir a entrada chevron.
    const padLeft = isFirst ? '20px' : '32px';
    const padRight = '32px';

    const hover = !isActive
      ? `onmouseover="this.style.filter='brightness(1.08)'" onmouseout="this.style.filter=''"`
      : '';

    return `<div ${onclick} ${hover} style="
      clip-path: ${clipPath};
      -webkit-clip-path: ${clipPath};
      background: ${bg};
      color: ${textColor};
      text-shadow: ${textShadow};
      cursor: ${cursor};
      margin-left: ${marginLeft};
      padding: 10px ${padRight} 10px ${padLeft};
      min-width: 132px;
      font-size: 11px;
      font-weight: 900;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: filter 0.15s;
      user-select: none;
      white-space: nowrap;
      ${isActive ? '' : 'filter: saturate(0.95);'}
    ">${stage.label}</div>`;
  }
};
