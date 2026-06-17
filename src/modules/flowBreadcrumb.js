// V38.1.66 — FlowBreadcrumb estilo Home (Leonardo, ato IV)
//
// V38.1.65 tinha gradiente metálico cromado. Felipe descartou — quer o
// estilo da Home: cores translúcidas suaves, glow colorido com box-shadow,
// sem efeito 3D metálico.
//
// Também: ocupar a LARGURA TOTAL abaixo do header (na proporção do header)
// sem crescer em altura. Cada chevron usa flex: 1 1 0 pra dividir o espaço
// igualmente, padding vertical fixo, padding horizontal flexível.
//
// 5 estações: Produtos → Campanhas → Ações → Execuções → Resultados.
// Cromática mantida: violet · sky · amber · emerald · rose.
//
// Padrão visual (igual home-v25.css/lj-pulso-stage-X):
//   bg     = rgba(cor, 0.12)
//   border = rgba(cor, 0.30) (interna via drop-shadow já que clip-path corta)
//   shadow = 0 12px 24px rgba(cor, 0.18)  (drop-shadow no wrapper externo)
//   texto  = cor-200 (clara, brilhante)
//
// Estação ATIVA: bg mais saturado (rgba 0.30), texto branco, glow maior.
// Inativas: estilo translúcido suave da cor temática (cada uma vibra
// levemente na sua cor — segue a paleta do Pulso da Home).

window.FlowBreadcrumb = {
  STAGES: [
    { id: 'products',   label: 'Produtos',   rgb: '139, 92, 246',  text: '#C4B5FD' }, // violet
    { id: 'campaigns',  label: 'Campanhas',  rgb: '56, 189, 248',  text: '#7DD3FC' }, // sky
    { id: 'actions',    label: 'Ações',      rgb: '251, 191, 36',  text: '#FCD34D' }, // amber
    { id: 'executions', label: 'Execuções',  rgb: '16, 185, 129',  text: '#6EE7B7' }, // emerald
    { id: 'results',    label: 'Resultados', rgb: '244, 63, 94',   text: '#FDA4AF' }  // rose
  ],

  render(activeStage) {
    const stages = this.STAGES;
    const activeIndex = stages.findIndex(s => s.id === activeStage);
    const items = stages.map((stage, i) => this._chevron(stage, i === activeIndex, i === 0));
    return `<nav aria-label="Fluxo do Revenue OS" class="flex items-stretch w-full">
      ${items.join('')}
    </nav>`;
  },

  _chevron(stage, isActive, isFirst) {
    const ARROW = 18;
    const clipPath = isFirst
      ? `polygon(0% 0%, calc(100% - ${ARROW}px) 0%, 100% 50%, calc(100% - ${ARROW}px) 100%, 0% 100%)`
      : `polygon(0% 0%, calc(100% - ${ARROW}px) 0%, 100% 50%, calc(100% - ${ARROW}px) 100%, 0% 100%, ${ARROW}px 50%)`;

    const { rgb, text, label, id } = stage;

    // Background e texto seguindo o padrão Home (.lj-pulso-stage-*):
    //   inativa: bg rgba(cor, 0.12), texto cor-300 clara
    //   ativa:   bg rgba(cor, 0.30), texto branco, drop-shadow forte
    const bg = isActive ? `rgba(${rgb}, 0.32)` : `rgba(${rgb}, 0.12)`;
    const textColor = isActive ? '#ffffff' : text;
    const fontWeight = isActive ? '950' : '800';

    // drop-shadow no wrapper externo pra dar o "border colorido" e glow
    // (clip-path corta box-shadow do chevron interno).
    const wrapperShadow = isActive
      ? `drop-shadow(0 0 0 rgba(${rgb}, 0.7)) drop-shadow(0 0 12px rgba(${rgb}, 0.35))`
      : `drop-shadow(0 0 0 rgba(${rgb}, 0.30))`;

    const onclick = !isActive ? `onclick="App.setTab('${id}')"` : 'aria-current="page"';
    const cursor = isActive ? 'default' : 'pointer';
    const marginLeft = isFirst ? '0' : '-12px';
    const padLeft = isFirst ? '20px' : '32px';
    const padRight = '32px';

    const hoverHandlers = !isActive
      ? `onmouseover="this.firstElementChild.style.background='rgba(${rgb}, 0.22)'; this.firstElementChild.style.color='#fff';" onmouseout="this.firstElementChild.style.background='rgba(${rgb}, 0.12)'; this.firstElementChild.style.color='${text}';"`
      : '';

    return `<div style="
      flex: 1 1 0;
      min-width: 0;
      margin-left: ${marginLeft};
      filter: ${wrapperShadow};
      transition: filter 0.18s;
    " ${hoverHandlers}>
      <div ${onclick} style="
        clip-path: ${clipPath};
        -webkit-clip-path: ${clipPath};
        background: ${bg};
        color: ${textColor};
        cursor: ${cursor};
        padding: 10px ${padRight} 10px ${padLeft};
        width: 100%;
        height: 100%;
        font-size: 11px;
        font-weight: ${fontWeight};
        letter-spacing: 0.14em;
        text-transform: uppercase;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.18s, color 0.18s;
        user-select: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      ">${label}</div>
    </div>`;
  }
};
