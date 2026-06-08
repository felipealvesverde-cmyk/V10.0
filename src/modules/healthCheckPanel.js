// V36.5.0 — Health Check Panel
//
// Painel no menu lateral (abaixo do badge da versão) mostrando status
// de saúde do LJ. Roda no boot + auto-refresh a cada 30s.
//
// Layout:
//   - Compacto (colapsado): 1 linha tipo "● 5/7 saudável" + chevron
//   - Expandido: lista de checks com label + status + detalhe
//
// Estados por item:
//   ✓ verde   = ok
//   ✗ vermelho = erro (hover/expand mostra mensagem)
//   ○ cinza   = não configurado (opt-in, não é erro)
//   ⏳ amarelo = carregando

window.HealthCheckPanel = {
  render() {
    const hc = App.state.healthCheck || { items: [], loading: true, expanded: false };
    const expanded = Boolean(hc.expanded);

    // Conta status
    const items = Array.isArray(hc.items) ? hc.items : [];
    const ok = items.filter(i => i.status === 'ok').length;
    const err = items.filter(i => i.status === 'error').length;
    const notCfg = items.filter(i => i.status === 'not-configured').length;
    const total = items.length;

    // Indicador resumo
    let summaryColor = '#22c55e';   // verde
    if (err > 0) summaryColor = '#ef4444';     // vermelho
    else if (hc.loading) summaryColor = '#eab308'; // amarelo carregando

    const lastCheckedAgo = hc.checkedAt
      ? this._fmtAgo(Date.now() - new Date(hc.checkedAt).getTime())
      : '—';

    if (!expanded) {
      // Modo colapsado: 1 linha compacta
      return `<div class="lj-healthcheck collapsed" onclick="Actions.toggleHealthCheck()">
        <span class="lj-hc-dot" style="background:${summaryColor}"></span>
        <span class="lj-hc-label">Health</span>
        <span class="lj-hc-count">${ok}/${total}</span>
        <i data-lucide="chevron-up" class="lj-hc-chevron"></i>
      </div>`;
    }

    // Modo expandido
    return `<div class="lj-healthcheck expanded">
      <div class="lj-hc-header" onclick="Actions.toggleHealthCheck()">
        <span class="lj-hc-dot" style="background:${summaryColor}"></span>
        <span class="lj-hc-label">Health · ${ok}/${total}</span>
        <button class="lj-hc-refresh" onclick="event.stopPropagation(); Actions.runHealthCheck();" title="Atualizar agora">
          <i data-lucide="refresh-cw" class="${hc.loading ? 'spin' : ''}"></i>
        </button>
        <i data-lucide="chevron-down" class="lj-hc-chevron"></i>
      </div>
      <div class="lj-hc-list">
        ${items.map(item => this._renderItem(item)).join('')}
      </div>
      <div class="lj-hc-footer">atualizado ${lastCheckedAgo}</div>
    </div>`;
  },

  _renderItem(item) {
    let icon = 'circle';
    let color = '#94a3b8';
    if (item.status === 'ok') { icon = 'check'; color = '#22c55e'; }
    else if (item.status === 'error') { icon = 'x'; color = '#ef4444'; }
    else if (item.status === 'loading') { icon = 'loader-2'; color = '#eab308'; }

    const tooltip = item.detail ? Utils.escape(item.detail) : '';
    return `<div class="lj-hc-item" title="${tooltip}">
      <i data-lucide="${icon}" style="color:${color}" class="lj-hc-icon ${item.status==='loading'?'spin':''}"></i>
      <span class="lj-hc-item-label">${Utils.escape(item.label)}</span>
      <span class="lj-hc-item-detail">${Utils.escape(item.shortDetail || '')}</span>
    </div>`;
  },

  _fmtAgo(ms) {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s atrás`;
    const m = Math.round(s / 60);
    if (m < 60) return `${m}min atrás`;
    return `${Math.round(m / 60)}h atrás`;
  }
};
