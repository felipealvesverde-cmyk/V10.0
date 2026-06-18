// V40.1.0 — Catálogo canônico de plugins do LJ. Fonte da verdade pro
// gating de tenant_plugins. Backend lê daqui pra montar respostas de
// /api/admin-tenant-plugins. Frontend tem cópia em src/core/pluginsCatalog.js.
//
// Pra adicionar plugin novo: adiciona aqui + replica em src/core/pluginsCatalog.js
// (manter os dois sincronizados manualmente — single-source no futuro).
const PLUGINS_CATALOG = [
  {
    id: 'flow-builder',
    name: 'Flow Builder',
    description: 'Crie a esteira do LJ visualmente — Produto → Campanha → Ação → Execução. Salva direto nas abas normais do LJ.',
    icon: 'git-merge',
    color: '#6366f1',
    defaultEnabled: true
  }
];

function getPluginsCatalog() {
  return PLUGINS_CATALOG.slice();
}

function getPluginById(id) {
  return PLUGINS_CATALOG.find(p => p.id === id) || null;
}

module.exports = { PLUGINS_CATALOG, getPluginsCatalog, getPluginById };
