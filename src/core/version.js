// V21.2 — Versão única do LeadJourney.
//
// REGRA DO DESIGN DIRECTOR (lei desde V21.2):
//   - Atualização GRANDE  → muda o primeiro número  (V21 → V22)
//   - Atualização MÉDIA   → muda o número depois do primeiro ponto  (V21.2 → V21.3)
//   - Atualização PEQUENA → muda o número depois do segundo ponto   (V21.2.0 → V21.2.1)
//
// O badge no topo das páginas (renderizado em main.js) consome window.LJVersion.
// SEMPRE atualize esta constante ao subir uma versão — é a fonte única de verdade.
window.LJVersion = 'V35.13.2';
