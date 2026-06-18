// V40.2.0 — Catálogo canônico de integrações/APIs do LJ. Fonte da verdade
// pro gating de tenant_integrations. Backend lê daqui pra montar respostas
// de /api/admin-tenant-integrations. Frontend tem cópia em
// src/core/integrationsCatalog.js.
//
// 2 tipos:
//   - 'external' — integração com sistema externo que o cliente CONFIGURA
//     no LJ (RD Station, ClickUp, etc). Aparece no menu Configurações →
//     Integrações.
//   - 'public-api' — endpoint público da plataforma LJ que o cliente CHAMA
//     de fora (ex: webhook entry, ingestão de leads).
//
// status:
//   - 'draft' — em construção, oculta de tenant comum mesmo se enabled
//   - 'ready' — disponível pra liberação por tenant
//   - 'ga'    — disponível por default pra todos os tenants
const INTEGRATIONS_CATALOG = [
  {
    id: 'rd-station',
    name: 'RD Station',
    description: 'Sincroniza leads, deals e ações entre LJ e RD Station CRM/Marketing.',
    type: 'external',
    icon: 'rss',
    color: '#15B8E5',
    status: 'ga',
    defaultEnabled: true
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    description: 'Espelha execuções no ClickUp como tarefas reais com responsáveis e datas.',
    type: 'external',
    icon: 'check-square',
    color: '#7B68EE',
    status: 'ga',
    defaultEnabled: true
  },
  {
    id: 'lj-public-leads-api',
    name: 'LJ Public Leads API',
    description: 'Endpoint público pra ingerir leads no LJ a partir de sistemas externos do cliente.',
    type: 'public-api',
    icon: 'webhook',
    color: '#10B981',
    status: 'ready',
    defaultEnabled: false
  }
];

function getIntegrationsCatalog() {
  return INTEGRATIONS_CATALOG.slice();
}

function getIntegrationById(id) {
  return INTEGRATIONS_CATALOG.find(i => i.id === id) || null;
}

module.exports = { INTEGRATIONS_CATALOG, getIntegrationsCatalog, getIntegrationById };
