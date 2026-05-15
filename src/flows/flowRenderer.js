// V15.1 — Flow Renderer
// Helpers para desenhar nós e conexões em SVG, calcular layouts automáticos
// e estilizar arestas conforme passagem de conversão.
window.FlowRenderer = {
  NODE_WIDTH: 200,
  NODE_HEIGHT: 140,

  layoutHorizontal(roots) {
    const layers = [];
    const visited = new Set();
    const visit = (node, depth) => {
      if (!node || visited.has(node.id)) return;
      visited.add(node.id);
      layers[depth] = layers[depth] || [];
      layers[depth].push(node);
      const nextIds = node.flow?.nextActions || [];
      for (const id of nextIds) {
        const next = (App.state.actions || []).find(a => Number(a.id) === Number(id));
        if (next) visit(FlowEngine.ensureActionFlow(next), depth + 1);
      }
    };
    for (const root of roots) visit(root, 0);
    const positions = new Map();
    layers.forEach((layer, depthIndex) => {
      layer.forEach((node, indexInLayer) => {
        positions.set(Number(node.id), {
          x: 80 + depthIndex * (this.NODE_WIDTH + 80),
          y: 80 + indexInLayer * (this.NODE_HEIGHT + 60)
        });
      });
    });
    return positions;
  },

  edgePath(fromX, fromY, toX, toY) {
    const dx = Math.max(60, (toX - fromX) / 2);
    return `M ${fromX} ${fromY} C ${fromX + dx} ${fromY}, ${toX - dx} ${toY}, ${toX} ${toY}`;
  },

  nodeColor(action) {
    const type = FlowEngine.actionTypeById(action.flow?.flowActionType);
    const stage = FlowEngine.stageById(action.flow?.startStage);
    return { stroke: stage.color, typeIcon: type.icon, typeLabel: type.label };
  },

  edgeStrokeForPassRate(passRate) {
    if (passRate >= 70) return '#10b981';
    if (passRate >= 40) return '#f59e0b';
    return '#ef4444';
  }
};
